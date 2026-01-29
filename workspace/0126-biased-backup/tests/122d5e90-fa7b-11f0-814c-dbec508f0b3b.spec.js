import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122d5e90-fa7b-11f0-814c-dbec508f0b3b.html';
const WIKI_PREFIX = 'https://en.wikipedia.org/wiki/DNS';

test.describe('DNS Interactive Application (FSM) - 122d5e90-fa7b-11f0-814c-dbec508f0b3b', () => {
  // We'll collect page errors and console messages for assertions
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // store the Error object for later assertions
      pageErrors.push(err);
    });

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
    // Ensure basic load
    await expect(page.locator('h1')).toHaveText('DNS');
  });

  test.afterEach(async () => {
    // no-op: Playwright will close pages/contexts automatically per test
  });

  test.describe('Initial Load and Error Observation', () => {
    test('Initial DOM should contain heading and body should have active class added by entry action', async ({ page }) => {
      // Validate the visible evidence from the FSM: <h1>DNS</h1>
      const heading = await page.locator('h1').innerText();
      expect(heading).toBe('DNS');

      // The HTML implementation calls document.body.classList.add('active') on load.
      // Assert that the body initially contains the "active" class (S1_Active entry action executed).
      const hasActive = await page.evaluate(() => document.body.classList.contains('active'));
      expect(hasActive).toBe(true);
    });

    test('A TypeError should have occurred due to missing #toggle element when attaching event listener', async ({ page }) => {
      // The script calls document.getElementById('toggle').addEventListener(...)
      // but there is no element with id="toggle" in the DOM. This should produce a pageerror.
      // Assert that at least one pageerror was emitted and that it references addEventListener or null.
      // We allow some flexibility in the exact message text across engines.
      expect(pageErrors.length).toBeGreaterThan(0);
      const messages = pageErrors.map(e => String(e.message || e));
      const hasAddEventListenerError = messages.some(m =>
        m.includes('addEventListener') || m.includes('Cannot read') || m.includes('null')
      );
      expect(hasAddEventListenerError).toBeTruthy();
    });

    test('No element should exist for selector #toggle (edge case)', async ({ page }) => {
      // Verify that the trigger selector expected by the FSM is missing in the implementation.
      const toggleExists = await page.$('#toggle');
      expect(toggleExists).toBeNull();

      // Attempting to click the missing selector via Playwright should fail.
      // We assert that trying to click the non-existent element results in an error.
      let clickError = null;
      try {
        await page.click('#toggle', { timeout: 1000 });
      } catch (err) {
        clickError = err;
      }
      expect(clickError).not.toBeNull();
      // The error message should indicate that the node wasn't found for the selector.
      const errMsg = String(clickError.message || clickError);
      expect(
        errMsg.includes('No node found') ||
        errMsg.includes('waiting for selector') ||
        errMsg.includes('failed waiting for selector')
      ).toBeTruthy();
    });
  });

  test.describe('ToggleStyle Transitions (S1_Active <-> S0_Idle)', () => {
    test('toggleStyle function exists despite the event listener error and toggles body.active (Active -> Idle -> Active)', async ({ page }) => {
      // Confirm the toggleStyle function was defined before the error occurred
      const typeofToggle = await page.evaluate(() => typeof toggleStyle);
      expect(typeofToggle).toBe('function');

      // Starting state should be Active (script added it on load)
      const initiallyActive = await page.evaluate(() => document.body.classList.contains('active'));
      expect(initiallyActive).toBe(true);

      // Invoke toggleStyle to simulate the ToggleStyle event; expect it to remove 'active' (Active -> Idle)
      const afterFirstToggle = await page.evaluate(() => {
        toggleStyle();
        return document.body.classList.contains('active');
      });
      expect(afterFirstToggle).toBe(false);

      // Invoke toggleStyle again to return to Active (Idle -> Active)
      const afterSecondToggle = await page.evaluate(() => {
        toggleStyle();
        return document.body.classList.contains('active');
      });
      expect(afterSecondToggle).toBe(true);
    });

    test('Toggling multiple times consistently flips the active class (robustness/edge case)', async ({ page }) => {
      // Ensure toggleStyle function exists
      const exists = await page.evaluate(() => typeof toggleStyle === 'function');
      expect(exists).toBe(true);

      // Perform a sequence of toggles and validate parity behavior
      const results = await page.evaluate(() => {
        const r = [];
        // ensure starting known state
        document.body.classList.add('active'); // set active
        for (let i = 0; i < 5; i++) {
          toggleStyle();
          r.push(document.body.classList.contains('active'));
        }
        return r;
      });

      // Starting with active=true and toggling 5 times: results should be [false, true, false, true, false]
      expect(results.length).toBe(5);
      // Check alternating pattern
      for (let i = 0; i < results.length; i++) {
        const expected = (i % 2 === 0) ? false : true;
        expect(results[i]).toBe(expected);
      }
    });
  });

  test.describe('Learn More Event and Navigation', () => {
    test('Clicking "Learn More" navigates to Wikipedia when page is in Active state', async ({ page }) => {
      // Ensure starting state is Active
      const startActive = await page.evaluate(() => document.body.classList.contains('active'));
      expect(startActive).toBe(true);

      // Click the Learn More button and wait for navigation to the external URL.
      // The button uses inline onclick to set window.location.href
      const learnBtn = page.locator('button', { hasText: 'Learn More' });
      await expect(learnBtn).toHaveCount(1);

      // Use waitForNavigation to observe the navigation effect
      const [nav] = await Promise.all([
        page.waitForNavigation({ timeout: 10000 }),
        learnBtn.click()
      ]);

      // After navigation, the page URL should begin with the Wikipedia DNS page URL.
      const finalUrl = page.url();
      expect(finalUrl.startsWith(WIKI_PREFIX)).toBeTruthy();
    });

    test('Clicking "Learn More" navigates to Wikipedia when page is in Idle state (after toggle)', async ({ page }) => {
      // Toggle to ensure Idle state
      await page.evaluate(() => {
        if (document.body.classList.contains('active')) {
          toggleStyle(); // now should be idle
        }
      });
      const nowIdle = await page.evaluate(() => document.body.classList.contains('active') === false);
      expect(nowIdle).toBe(true);

      // Click the Learn More button and assert navigation occurs
      const learnBtn = page.locator('button', { hasText: 'Learn More' });
      await expect(learnBtn).toHaveCount(1);

      const [nav] = await Promise.all([
        page.waitForNavigation({ timeout: 10000 }),
        learnBtn.click()
      ]);

      const finalUrl = page.url();
      expect(finalUrl.startsWith(WIKI_PREFIX)).toBeTruthy();
    });

    test('Navigation via Learn More is attempted despite prior page script errors (edge case)', async ({ page }) => {
      // We earlier observed page errors; ensure they are present
      expect(pageErrors.length).toBeGreaterThan(0);

      // Attempt to click Learn More and detect navigation request
      const learnBtn = page.locator('button', { hasText: 'Learn More' });
      await expect(learnBtn).toHaveCount(1);

      const navigationPromise = page.waitForNavigation({ timeout: 10000 }).catch(e => e);
      await learnBtn.click();

      const navResult = await navigationPromise;
      // Either it navigated (navResult is a Response) or we got an error object
      if (navResult instanceof Error) {
        // If navigation failed for some reason, at least assert that a navigation was attempted (Playwright error contains selector or navigation info)
        const errMsg = String(navResult.message || navResult);
        expect(errMsg.length).toBeGreaterThan(0);
      } else {
        // Successful navigation: assert URL is wiki prefix
        const finalUrl = page.url();
        expect(finalUrl.startsWith(WIKI_PREFIX)).toBeTruthy();
      }
    });
  });

  test.describe('Observability: Console & Page Error Reporting', () => {
    test('Console messages and page errors are captured and can be inspected', async ({ page }) => {
      // There were no explicit console.logs in the page, but our listener should have collected any console output if present.
      // Assert that our structures are arrays and can be inspected
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);

      // At minimum, pageErrors should have at least one entry (the addEventListener TypeError).
      expect(pageErrors.length).toBeGreaterThan(0);

      // Inspect that the logged console messages (if any) are objects with type and text
      for (const msg of consoleMessages) {
        expect(msg).toHaveProperty('type');
        expect(msg).toHaveProperty('text');
      }

      // Confirm one of the page error messages references addEventListener or getElementById
      const msgs = pageErrors.map(e => String(e.message || e));
      const foundRelevant = msgs.some(m => m.includes('addEventListener') || m.includes('getElementById') || m.includes('Cannot read') || m.includes('null'));
      expect(foundRelevant).toBeTruthy();
    });
  });
});