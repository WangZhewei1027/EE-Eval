import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d836b232-fa7b-11f0-b314-ad8654ee5de8.html';

test.describe('d836b232-fa7b-11f0-b314-ad8654ee5de8 — Branch and Bound demo FSM tests', () => {
  // Hold console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture unhandled errors from the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // detach listeners implicitly when page is closed; no explicit teardown needed
    // (kept for clarity and future extension)
  });

  test.describe('Initial state (S0_Idle) validations', () => {
    test('Initial DOM: button present, aria-expanded=false, demo hidden', async ({ page }) => {
      // Validate the toggle button exists and matches FSM component description
      const btn = page.locator('button#demoToggle');
      await expect(btn).toHaveCount(1);
      await expect(btn).toHaveText('Show demonstration'); // initial text per FSM
      await expect(btn).toHaveAttribute('aria-expanded', 'false'); // initial aria state

      // Validate the demonstration area is hidden (S0_Idle evidence & entry action)
      const demo = page.locator('#demoArea');
      // inline style initially has display:none per HTML
      const inlineDisplay = await demo.evaluate((el) => el.style.display);
      expect(inlineDisplay).toBe('none');

      // Computed style should also indicate hidden
      const computedDisplay = await demo.evaluate((el) => window.getComputedStyle(el).display);
      expect(computedDisplay).toBe('none');

      // Playwright visible helper
      await expect(demo).not.toBeVisible();

      // There should be no pageerrors immediately after load (unless something else in environment causes them)
      // We don't assert that pageErrors is empty forcibly because some environments may emit harmless warnings.
      // But we record them for debugging if present.
    });

    test('Calling missing entry action renderPage() surfaces ReferenceError (verify onEnter action expectation)', async ({ page }) => {
      // The FSM listed an entry_action "renderPage()". The page's source does not define that function.
      // We intentionally call it to validate that the expected ReferenceError arises naturally.
      let thrown = null;
      try {
        // Execute in page context; this should throw a ReferenceError because renderPage is not defined.
        await page.evaluate(() => {
          // Intentionally call the non-existent function to let the runtime raise an error.
          // We do not modify page globals; we simply invoke the name that is expected by FSM.
          // The error will be thrown and propagated.
          return renderPage();
        });
      } catch (e) {
        thrown = e;
      }

      // Ensure an error was thrown when calling renderPage
      expect(thrown).not.toBeNull();
      // Error message content can vary across browsers/runtimes. Ensure it references renderPage.
      expect(String(thrown.message || thrown)).toMatch(/renderPage/);

      // Ensure the pageerror event captured the same error (unhandled exception on page)
      // There may be slight timing differences; wait briefly if necessary.
      // The pageerror listener should have captured at least one error referencing renderPage.
      const found = pageErrors.some((err) => {
        try {
          return String(err.message).includes('renderPage') || String(err).includes('renderPage');
        } catch (e) {
          return false;
        }
      });
      expect(found).toBeTruthy();
    });
  });

  test.describe('Toggle demonstration transitions (ToggleDemo event and transitions S0↔S1↔S2)', () => {
    test('S0_Idle -> S1_DemoVisible: click shows demo, updates button text and aria-expanded', async ({ page }) => {
      const btn = page.locator('button#demoToggle');
      const demo = page.locator('#demoArea');

      // Precondition: initial idle state
      await expect(btn).toHaveText('Show demonstration');
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
      await expect(demo).not.toBeVisible();

      // Trigger ToggleDemo event
      await btn.click();

      // Expected observables per FSM transition from S0 to S1
      await expect(btn).toHaveText('Hide demonstration');
      await expect(btn).toHaveAttribute('aria-expanded', 'true');

      // demo's inline style should be 'block'
      const inlineDisplayAfter = await demo.evaluate((el) => el.style.display);
      expect(inlineDisplayAfter).toBe('block');

      // Computed style should reflect visible state
      const computedDisplayAfter = await demo.evaluate((el) => window.getComputedStyle(el).display);
      expect(computedDisplayAfter).toBe('block');

      // Playwright visible helper
      await expect(demo).toBeVisible();

      // Ensure toggling did not produce unexpected page errors
      const toggleErrors = pageErrors.filter(err => String(err.message || err).toLowerCase().includes('renderpage') === false);
      expect(toggleErrors.length).toBeLessThan(1); // no errors from normal toggle expected
    });

    test('S1_DemoVisible -> S2_DemoHidden: click hides demo, updates button text and aria-expanded', async ({ page }) => {
      const btn = page.locator('button#demoToggle');
      const demo = page.locator('#demoArea');

      // Ensure we are visible first
      await btn.click();
      await expect(btn).toHaveText('Hide demonstration');
      await expect(demo).toBeVisible();

      // Click to hide (ToggleDemo event)
      await btn.click();

      // Expected observables per FSM transition S1 -> S2
      await expect(btn).toHaveText('Show demonstration');
      await expect(btn).toHaveAttribute('aria-expanded', 'false');

      // Inline style should revert to none
      const inlineDisplayAfterHide = await demo.evaluate((el) => el.style.display);
      expect(inlineDisplayAfterHide).toBe('none');

      const computedAfterHide = await demo.evaluate((el) => window.getComputedStyle(el).display);
      expect(computedAfterHide).toBe('none');

      await expect(demo).not.toBeVisible();
    });

    test('S2_DemoHidden -> S1_DemoVisible: clicking again shows demonstration (cycle)', async ({ page }) => {
      const btn = page.locator('button#demoToggle');
      const demo = page.locator('#demoArea');

      // Ensure hidden state
      await expect(btn).toHaveText('Show demonstration');
      await expect(demo).not.toBeVisible();

      // Click to show (ToggleDemo event)
      await btn.click();

      // Expect visible state again
      await expect(btn).toHaveText('Hide demonstration');
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
      await expect(demo).toBeVisible();
    });

    test('Edge case: rapid/double clicks toggle consistently (two clicks => back to original state)', async ({ page }) => {
      const btn = page.locator('button#demoToggle');
      const demo = page.locator('#demoArea');

      // Start from known initial state (hidden)
      await expect(btn).toHaveText('Show demonstration');
      await expect(demo).not.toBeVisible();

      // Double click quickly: this should toggle twice and return to initial state
      await btn.dblclick();

      // Because dblclick triggers two click events, the state should be same as start: hidden
      await expect(btn).toHaveText('Show demonstration');
      await expect(btn).toHaveAttribute('aria-expanded', 'false');
      await expect(demo).not.toBeVisible();

      // Now triple click: should end up visible (odd number of toggles)
      await btn.click();
      await btn.click();
      await btn.click(); // three clicks total
      await expect(btn).toHaveText('Hide demonstration');
      await expect(btn).toHaveAttribute('aria-expanded', 'true');
      await expect(demo).toBeVisible();
    });
  });

  test.describe('Observability: console and pageerror monitoring', () => {
    test('No unexpected console.error messages during normal interactions', async ({ page }) => {
      // Interact normally: show and hide demo
      const btn = page.locator('#demoToggle');
      const demo = page.locator('#demoArea');

      await btn.click();
      await btn.click();

      // Check console messages captured; ensure none are of type 'error' beyond errors intentionally triggered
      const errors = consoleMessages.filter((m) => m.type === 'error');
      // There should be no console.error messages produced by the page's normal behavior
      expect(errors.length).toBe(0);
    });

    test('Invoking missing functions produces pageerror events (ReferenceError propagation)', async ({ page }) => {
      // Call a non-existent function to ensure pageerror captures it (again)
      let thrown = null;
      try {
        await page.evaluate(() => {
          // Intentionally reference an undefined identifier to produce a ReferenceError
          return renderPage();
        });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).not.toBeNull();
      expect(String(thrown.message || thrown)).toMatch(/renderPage/);

      // Confirm that a pageerror was captured and includes the ReferenceError mentioning renderPage
      const found = pageErrors.some(err => {
        try {
          return /ReferenceError/i.test(err.name || '') || String(err.message || '').includes('renderPage') || String(err).includes('renderPage');
        } catch (e) {
          return false;
        }
      });
      expect(found).toBeTruthy();
    });
  });
});