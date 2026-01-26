import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a224a0-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the Deadlock demo page
class DeadlockPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('.demo-button');
  }

  // Click the demo button and wait for an alert dialog, returning the dialog message.
  async clickDemoAndGetDialogMessage() {
    return new Promise(async (resolve) => {
      // Set up one-time dialog handler prior to clicking
      this.page.once('dialog', async (dialog) => {
        const msg = dialog.message();
        // Dismiss to allow page to continue
        await dialog.dismiss();
        resolve(msg);
      });
      await this.demoButton.click();
    });
  }

  async go() {
    await this.page.goto(APP_URL);
  }
}

test.describe('Understanding Deadlock app (FSM tests)', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, log, warn, error)
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Defensive: if msg.type() or msg.text() throws, still record raw object
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Small assertion to ensure listeners didn't accumulate unexpectedly.
    // This does not change page behavior; it's just a guard for the test environment.
    expect(page.isClosed()).toBeFalsy();
  });

  test('S0_Idle: initial state renders demo button with expected attributes', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) entry evidence:
    // - The page should render the "Demonstrate Deadlock" control.
    const dp = new DeadlockPage(page);

    // Verify the demo button exists and is visible
    await expect(dp.demoButton).toBeVisible();

    // Verify the button text matches the FSM/component extraction
    await expect(dp.demoButton).toHaveText('Demonstrate Deadlock');

    // Verify the anchor has the onclick attribute referencing demoAlert()
    const onclickAttr = await dp.demoButton.getAttribute('onclick');
    expect(onclickAttr).not.toBeNull();
    // The HTML defines onclick="demoAlert()"
    expect(onclickAttr.replace(/\s+/g, '')).toBe('demoAlert()');

    // Verify there are no unexpected page errors immediately after loading (Idle state entry)
    expect(pageErrors.length).toBe(0);

    // Check console for any error-level messages emitted on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition DemonstrateDeadlock -> S1_AlertDisplayed: clicking button displays expected alert', async ({ page }) => {
    // This test validates the FSM transition from S0_Idle to S1_AlertDisplayed:
    // - Clicking .demo-button triggers demoAlert(), which should show the expected alert message.
    const dp = new DeadlockPage(page);

    // Prepare to capture the dialog message produced by demoAlert()
    const expectedMessage = 'This is a simple demonstration of the concept of deadlock. As outlined, it occurs when processes wait indefinitely for resources held by each other.';

    // Use the helper to click and receive the dialog message
    const dialogMessage = await dp.clickDemoAndGetDialogMessage();

    // Assert the dialog message is exactly as defined in the HTML/JS
    expect(dialogMessage).toBe(expectedMessage);

    // After dismissal, ensure no unhandled page errors were raised during the transition
    expect(pageErrors.length).toBe(0);

    // Also assert that the DOM still contains the demo button and has not changed unexpectedly
    await expect(dp.demoButton).toBeVisible();
    await expect(dp.demoButton).toHaveText('Demonstrate Deadlock');
  });

  test('Alert re-triggering and multiple interactions: alert appears for each click and can be dismissed', async ({ page }) => {
    // Edge case test: click the demo-button multiple times sequentially and ensure each triggers an alert dialog.
    // This validates robustness of transition handling when invoked repeatedly.
    const dp = new DeadlockPage(page);

    const expectedMessage = 'This is a simple demonstration of the concept of deadlock. As outlined, it occurs when processes wait indefinitely for resources held by each other.';

    // Trigger and validate alert three times in a row
    for (let i = 0; i < 3; i++) {
      const msg = await dp.clickDemoAndGetDialogMessage();
      expect(msg).toBe(expectedMessage);
      // Ensure no unexpected page errors between dialogs
      expect(pageErrors.length).toBe(0);
    }

    // After repeated interactions, ensure console has no error entries
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Verify existence of demoAlert function and absence of renderPage (onEnter action not present in HTML)', async ({ page }) => {
    // The FSM mentions an entry action renderPage() for S0_Idle.
    // The HTML does not define renderPage(), so we assert its absence to validate consistency.
    // The page defines demoAlert(); assert that exists as a function on window.
    const dp = new DeadlockPage(page);

    // Evaluate presence of demoAlert and renderPage in the page global scope.
    const functionsPresence = await page.evaluate(() => {
      return {
        hasDemoAlert: typeof window.demoAlert === 'function',
        hasRenderPage: typeof window.renderPage === 'function'
      };
    });

    // demoAlert should be present as it's used by the onclick attribute.
    expect(functionsPresence.hasDemoAlert).toBe(true);

    // renderPage was an FSM entry action but is NOT implemented in the HTML.
    // We assert that it is absent (this validates that onEnter action from FSM is not actually present).
    expect(functionsPresence.hasRenderPage).toBe(false);
  });

  test('Observe console logs and page errors during full interaction sequence', async ({ page }) => {
    // This test explicitly records console messages and page errors while performing actions,
    // then asserts expectations about those observations.
    const dp = new DeadlockPage(page);

    // Perform an interaction that should produce a dialog
    const dialogPromise = dp.clickDemoAndGetDialogMessage();

    // Wait for dialog to resolve
    const dialogMessage = await dialogPromise;
    expect(typeof dialogMessage).toBe('string');
    expect(dialogMessage.length).toBeGreaterThan(0);

    // After interaction, evaluate captured console messages and page errors
    // Assert there are no uncaught JS errors (ReferenceError, SyntaxError, TypeError)
    // If any such errors occurred they would have been captured in pageErrors.
    expect(pageErrors.length).toBe(0, `Expected no page errors, but found: ${pageErrors.map(e => e.message).join('; ')}`);

    // There should be zero or more console messages, but none should be type 'error'
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);

    // Log summary via expects so test output includes helpful info on failure
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('Negative/Edge case: ensure clicking non-existent selector does not crash the page', async ({ page }) => {
    // Attempt to click a selector that does not exist and ensure it throws an expected Playwright error
    // and that the page itself does not emit uncaught exceptions as a result.
    const nonexistent = page.locator('.nonexistent-button');

    let threw = false;
    try {
      // This will throw from Playwright because the element does not exist/visible
      await nonexistent.click({ timeout: 1000 });
    } catch (err) {
      threw = true;
      // Ensure the thrown error is a Playwright timeout/element handle error (do not assert exact message)
      expect(err).toBeDefined();
    }
    expect(threw).toBe(true);

    // Ensure no page errors were emitted by the web app due to our failed click attempt
    expect(pageErrors.length).toBe(0);
  });
});