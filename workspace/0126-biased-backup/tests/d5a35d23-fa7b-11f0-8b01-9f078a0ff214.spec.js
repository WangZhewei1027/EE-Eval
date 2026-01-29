import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a35d23-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object encapsulating interactions with the K-NN demo page
class KNNDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = 'button[onclick]';
    this.headingSelector = 'h1';
    this.containerSelector = '.container';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeadingText() {
    return this.page.locator(this.headingSelector).innerText();
  }

  async isButtonVisible() {
    return this.page.locator(this.buttonSelector).isVisible();
  }

  async getButtonText() {
    return this.page.locator(this.buttonSelector).innerText();
  }

  // Click the show demonstration button and wait for the alert dialog
  async clickShowDemoAndCaptureDialog() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.click(this.buttonSelector)
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  // Helper to ensure main container still present (state unchanged)
  async isContainerPresent() {
    return this.page.locator(this.containerSelector).count().then(c => c > 0);
  }
}

test.describe('K-Nearest Neighbors Explained - FSM and UI Tests', () => {
  // Arrays to capture console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for the page
    page.on('console', msg => {
      // store text and type for richer assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions in page context)
    page.on('pageerror', err => {
      // err is an Error object from the page context
      pageErrors.push(err.message || String(err));
    });
  });

  test('Idle state: page loads and renders expected static content', async ({ page }) => {
    // This test validates that the page renders correctly in the Idle state (S0_Idle).
    const demo = new KNNDemoPage(page);
    await demo.goto();

    // Verify the main heading is present and correct
    const heading = await demo.getHeadingText();
    expect(heading).toContain('K-Nearest Neighbors');

    // Verify the primary container exists
    const containerPresent = await demo.isContainerPresent();
    expect(containerPresent).toBe(true);

    // Verify the Show Demonstration button is present and has expected text
    expect(await demo.isButtonVisible()).toBe(true);
    expect(await demo.getButtonText()).toBe('Show Demonstration');

    // Verify no unexpected page errors were emitted during load
    expect(pageErrors).toEqual([]);

    // Verify console did not log any errors during load (it's acceptable if empty)
    // We assert that there are no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ShowDemonstration event: clicking the button triggers alert and state remains Idle', async ({ page }) => {
    // This test validates the FSM transition on clicking the Show Demonstration button:
    // From S0_Idle to S0_Idle with an alert dialog as observable behavior.
    const demo = new KNNDemoPage(page);
    await demo.goto();

    // Click the button and capture the alert dialog message
    const dialogMessage = await demo.clickShowDemoAndCaptureDialog();

    // Assert the dialog message matches the expected alert text from the HTML onclick
    expect(dialogMessage).toBe("Demonstration is yet to be implemented. This page is focused on textual learning.");

    // After accepting the alert, verify that the page remains in the Idle state visually:
    // Heading still present and container present and button still visible
    expect(await demo.getHeadingText()).toContain('K-Nearest Neighbors');
    expect(await demo.isButtonVisible()).toBe(true);
    expect(await demo.isContainerPresent()).toBe(true);

    // There should be no page errors (the alert is a normal dialog, not an error)
    expect(pageErrors).toEqual([]);

    // No console errors were emitted as a result of this interaction
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Repeated ShowDemonstration clicks show dialogs each time (idempotence of transition)', async ({ page }) => {
    // This test validates that repeated invocations of the transition behave consistently
    const demo = new KNNDemoPage(page);
    await demo.goto();

    // Click the button multiple times and assert dialogs appear each time with same message
    for (let i = 0; i < 3; i++) {
      const dialogPromise = page.waitForEvent('dialog');
      await page.click(demo.buttonSelector);
      const dialog = await dialogPromise;
      expect(dialog.message()).toContain('Demonstration is yet to be implemented.');
      await dialog.accept();
    }

    // Ensure no page errors occurred during repeated interactions
    expect(pageErrors).toEqual([]);

    // Ensure the page still shows the primary content (no state loss)
    expect(await demo.getHeadingText()).toContain('K-Nearest Neighbors');
    expect(await demo.isButtonVisible()).toBe(true);
  });

  test('Edge case: clicking a non-existent selector results in an actionable test error', async ({ page }) => {
    // This test intentionally attempts to click a non-existent element to validate
    // that missing elements are handled as errors by the test/runtime.
    await page.goto(APP_URL);

    // Attempting to click a selector that does not exist should reject.
    // We keep the timeout low to avoid long waits in the negative scenario.
    const clickPromise = page.click('button[onclickx]', { timeout: 1000 });
    await expect(clickPromise).rejects.toThrow();
  });

  test('Error scenario: intentional ReferenceError in page context is observed via pageerror', async ({ page }) => {
    // This test intentionally calls a non-existent function in the page context to generate
    // a ReferenceError and asserts that the pageerror event captures it.
    await page.goto(APP_URL);

    // Reset captured pageErrors array for a clean assertion
    pageErrors = [];

    // Evaluate an expression that will throw a ReferenceError in the page context.
    // This is done to exercise the requirement to observe page errors naturally.
    const evalPromise = page.evaluate(() => {
      // Intentionally call an undefined function to cause a ReferenceError in the page.
      // This runs inside the page context.
      // Note: We do NOT define any globals or modify the page; we simply invoke an undefined symbol.
      // eslint-disable-next-line no-undef
      return nonExistentFunction();
    });

    // The evaluate should reject because the function is not defined.
    await expect(evalPromise).rejects.toThrow();

    // Give a short moment for pageerror propagation (listeners are synchronous but be safe)
    await page.waitForTimeout(50);

    // Assert that the pageerror listener captured at least one error and it looks like a ReferenceError
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const hasReferenceError = pageErrors.some(msg => /ReferenceError|is not defined/i.test(msg));
    expect(hasReferenceError).toBe(true);
  });

  test('Console observation: ensure no unexpected console errors emitted during interactions', async ({ page }) => {
    // This test ensures that the application does not emit console errors during normal interaction flows.
    const demo = new KNNDemoPage(page);
    await demo.goto();

    // Interact with the page: click the button to show the alert
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click(demo.buttonSelector)
    ]);
    await dialog.accept();

    // Allow microtasks/console events to propagate
    await page.waitForTimeout(20);

    // Inspect captured console messages: there should be no entries of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // We still validate that consoleMessages is an array (could be empty)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test.afterEach(async () => {
    // After each test we don't need to do explicit teardown here as Playwright fixtures handle page lifecycle.
    // This hook is present to show where teardown steps would normally go (e.g., clearing storage, resetting state).
  });
});