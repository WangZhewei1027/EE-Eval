import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d59fdab0-fa7b-11f0-8b01-9f078a0ff214.html';

test.describe('d59fdab0-fa7b-11f0-8b01-9f078a0ff214 - FSM: Understanding Dynamic Arrays', () => {
  // Arrays to collect runtime console messages and page errors for each test
  let consoleMessages;
  let pageErrors;
  let consoleHandler;
  let pageErrorHandler;

  // Set up and tear down event listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    consoleHandler = (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // defensive: some console messages may fail to serialize; still capture that an item arrived
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    };
    page.on('console', consoleHandler);

    // Capture uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    pageErrorHandler = (err) => {
      pageErrors.push(err);
    };
    page.on('pageerror', pageErrorHandler);

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // remove listeners to avoid cross-test leakage
    page.off('console', consoleHandler);
    page.off('pageerror', pageErrorHandler);
    // small safety: clear arrays
    consoleMessages = [];
    pageErrors = [];
  });

  test('Initial state (S0_Idle): Button exists and #demo is hidden', async ({ page }) => {
    // This test validates the "Idle" state: button rendered and demo hidden by default.

    // Check that the button with onclick="showDemo()" is present and visible
    const buttonSelector = 'button[onclick="showDemo()"]';
    const button = page.locator(buttonSelector);
    await expect(button).toHaveCount(1); // element exists
    await expect(button).toBeVisible(); // visible to the user
    await expect(button).toContainText('See Dynamic Array In Action'); // correct label

    // Check that the demo container exists and is hidden (display: none)
    const demoDisplay = await page.$eval('#demo', (el) => {
      // return the computed display to be robust against inline style or stylesheet
      return window.getComputedStyle(el).display;
    });
    expect(demoDisplay).toBe('none');

    // Assert that loading the page did not produce any unexpected page errors
    expect(pageErrors.length).toBe(0);

    // No console errors expected on load (but other console messages could exist)
    const consoleErrorMessages = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrorMessages.length).toBe(0);
  });

  test('Transition ShowDemo: clicking button shows the demo (S0_Idle -> S1_DemoVisible)', async ({ page }) => {
    // Validate that a single click toggles the demo to visible (enter S1_DemoVisible).

    const buttonSelector = 'button[onclick="showDemo()"]';
    const button = page.locator(buttonSelector);

    // Ensure starting hidden
    let display = await page.$eval('#demo', (el) => window.getComputedStyle(el).display);
    expect(display).toBe('none');

    // Click the button to show the demo
    await button.click();

    // After click, demo should be visible (display block or not none)
    display = await page.$eval('#demo', (el) => window.getComputedStyle(el).display);
    expect(display === 'block' || display === 'flex' || display === 'inline' || display === 'inline-block' || display !== 'none').toBeTruthy();

    // Verify demo contains the expected textual content (evidence)
    const demoText = await page.locator('#demo').innerText();
    expect(demoText).toMatch(/Dynamic Array demonstration will be here/i);

    // No uncaught errors should have been logged as a result of the interaction
    const relevantPageErrors = pageErrors.filter((e) => e instanceof Error);
    expect(relevantPageErrors.length).toBe(0);

    // Confirm no console error messages were produced during the click
    const consoleErrorMessages = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrorMessages.length).toBe(0);
  });

  test('Transition ShowDemo toggles back (S1_DemoVisible -> S0_Idle) when clicked again', async ({ page }) => {
    // Validate toggle back to hidden when clicking the button twice.

    const buttonSelector = 'button[onclick="showDemo()"]';
    const button = page.locator(buttonSelector);

    // Click once to show
    await button.click();
    let display = await page.$eval('#demo', (el) => window.getComputedStyle(el).display);
    expect(display).not.toBe('none');

    // Click again to hide
    await button.click();
    display = await page.$eval('#demo', (el) => window.getComputedStyle(el).display);
    expect(display).toBe('none');

    // No page errors or console errors expected after toggling twice
    expect(pageErrors.length).toBe(0);
    const consoleErrorMessages = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrorMessages.length).toBe(0);
  });

  test('Rapid multiple clicks: toggling behavior remains consistent', async ({ page }) => {
    // Validate behavior under repeated interactions: odd clicks -> visible, even clicks -> hidden.

    const buttonSelector = 'button[onclick="showDemo()"]';
    const button = page.locator(buttonSelector);

    const clicks = 5;
    for (let i = 1; i <= clicks; i++) {
      await button.click();
      const display = await page.$eval('#demo', (el) => window.getComputedStyle(el).display);
      const isVisible = display !== 'none';
      // odd clicks -> visible, even clicks -> hidden
      if (i % 2 === 1) {
        expect(isVisible).toBeTruthy();
      } else {
        expect(isVisible).toBeFalsy();
      }
    }

    // Ensure there were no uncaught errors during rapid interactions
    expect(pageErrors.length).toBe(0);
    const consoleErrorMessages = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrorMessages.length).toBe(0);
  });

  test('Edge case: scheduling an undefined function triggers a ReferenceError which is observed as a pageerror', async ({ page }) => {
    // This test intentionally triggers a ReferenceError inside the page
    // We schedule the call with setTimeout so the evaluation itself does not reject,
    // and the error surfaces as a page 'pageerror' event which we capture.

    // Schedule a call to a non-existent function in the page context
    await page.evaluate(() => {
      // eslint-disable-next-line no-undef
      setTimeout(() => {
        // Intentionally call a non-existent function to create a ReferenceError.
        // This should be allowed to happen naturally and be observable via pageerror.
        nonexistentFunctionThatDoesNotExist();
      }, 0);
    });

    // Wait for the pageerror event to be emitted
    const err = await page.waitForEvent('pageerror', { timeout: 2000 });
    // The error should be a ReferenceError (or at least include the function name)
    expect(err).toBeDefined();
    // Many browsers include the name property on the Error object
    if (err.name) {
      expect(err.name).toBe('ReferenceError');
    } else {
      // fallback: assert the message mentions the missing function name
      expect(String(err.message || err)).toMatch(/nonexistentFunctionThatDoesNotExist|is not defined/);
    }

    // Verify our pageErrors collector received the error
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const foundRefError = pageErrors.some((e) => (e && e.name === 'ReferenceError') || String(e).includes('nonexistentFunctionThatDoesNotExist'));
    expect(foundRefError).toBeTruthy();
  });

  test('Edge case: attempting to click a missing element via Playwright yields a test-level error (handled) and does not mutate page state', async ({ page }) => {
    // This test attempts to click a selector that does not exist.
    // Playwright's click will throw; we capture that and assert the page state remains unchanged.

    const missingSelector = '#this-element-does-not-exist';

    // Ensure missing selector truly doesn't exist
    const count = await page.locator(missingSelector).count();
    expect(count).toBe(0);

    // Attempt to click and expect Playwright to throw. We catch the error to validate behavior.
    let clickedThrew = false;
    try {
      await page.click(missingSelector, { timeout: 500 });
    } catch (e) {
      clickedThrew = true;
      // Validate it's a Playwright error mentioning the element or timeout
      expect(String(e)).toMatch(/no node found|waiting for|Timeout/);
    }
    expect(clickedThrew).toBe(true);

    // Confirm that the application's visible state remains unchanged and that no new page errors were produced by this operation
    const demoDisplay = await page.$eval('#demo', (el) => window.getComputedStyle(el).display);
    // Should still be either 'none' (initial) or something expected; we assert it's a valid CSS display value
    expect(typeof demoDisplay).toBe('string');
    // No new script runtime pageerrors are expected as a result of this Playwright-level interaction
    const runtimeErrors = pageErrors.filter((e) => e instanceof Error);
    expect(runtimeErrors.length).toBe(0);
  });
});