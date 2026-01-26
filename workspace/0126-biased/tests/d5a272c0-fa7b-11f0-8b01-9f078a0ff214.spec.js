import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a272c0-fa7b-11f0-8b01-9f078a0ff214.html';
const EXPECTED_ALERT_TEXT = "This is a simple demonstration alert to understand ACID properties!";

class AcidPage {
  /**
   * Page object for the "Understanding ACID Properties" page.
   * Encapsulates common interactions and selectors.
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('.button');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickButton(options) {
    // Performs a click on the Test Understanding button.
    return this.button.click(options);
  }

  async getButtonText() {
    return this.button.textContent();
  }

  async getButtonOnclickAttribute() {
    return this.button.getAttribute('onclick');
  }

  async getButtonOuterHtml() {
    return this.button.evaluate((el) => el.outerHTML);
  }
}

test.describe('ACID Properties Interactive Page - States and Transitions', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for later assertions
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If reading console message fails for any reason, still record a fallback
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect uncaught page errors (e.g., ReferenceError, SyntaxError, TypeError)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test exactly as-is (no modification)
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: remove listeners by closing the page to avoid leaks.
    // This helps ensure a fresh environment for the next test.
    try {
      await page.close();
    } catch (e) {
      // ignore errors closing page in teardown
    }
  });

  test('Initial state (S0_Idle): Page renders and shows Test Understanding button', async ({ page }) => {
    // This test validates the Idle state:
    // - The page is rendered (entry action renderPage() is expected but not invoked explicitly here)
    // - The "Test Understanding" button exists with correct text and inline onclick attribute
    // - No console.error or uncaught page errors are present on initial load
    const acid = new AcidPage(page);

    // Validate button visibility and text
    await expect(acid.button).toBeVisible();
    const text = (await acid.getButtonText())?.trim();
    expect(text).toBe('Test Understanding');

    // Validate the inline onclick attribute exists and contains the expected alert call
    const onclickAttr = await acid.getButtonOnclickAttribute();
    expect(typeof onclickAttr).toBe('string');
    expect(onclickAttr).toContain("alert('This is a simple demonstration alert to understand ACID properties!')");

    // Validate the outerHTML evidence contains expected structure (as in FSM evidence)
    const outer = await acid.getButtonOuterHtml();
    expect(outer).toContain('class="button"');
    expect(outer).toContain("onclick");

    // There should be no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);

    // There should be no console messages of type 'error'
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_AlertDisplayed: Clicking button shows alert with expected text', async ({ page }) => {
    // This test validates the transition where the user clicks the Test Understanding button
    // and the alert (S1_AlertDisplayed) is displayed (onEnter action: alert(...)).
    // We assert the dialog message equals the expected text and then accept the alert.
    const acid = new AcidPage(page);

    // Click and wait for the dialog to appear concurrently to capture it reliably
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      acid.clickButton(),
    ]);
    // Validate the alert's message
    expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);

    // Accept the alert to simulate the user dismissing it (transition back to Idle)
    await dialog.accept();

    // After dismissing the alert, ensure the page returns to Idle (button still visible)
    await expect(acid.button).toBeVisible();

    // Verify no uncaught page errors and no console.error messages were introduced by the interaction
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1_AlertDisplayed -> S0_Idle and repeat: Repeated clicks open and close alert reliably', async ({ page }) => {
    // This test validates cycling through the alert state multiple times:
    // - Click to open alert, accept, then click again to open and accept again.
    // This verifies the system can return to Idle and re-enter AlertDisplayed repeatedly.
    const acid = new AcidPage(page);

    for (let i = 0; i < 2; i++) {
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        acid.clickButton(),
      ]);
      expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);
      await dialog.accept();
      // Confirm button still present after alert is closed (back in Idle)
      await expect(acid.button).toBeVisible();
    }

    // Assert there were no uncaught page errors across repeated interactions
    expect(pageErrors.length).toBe(0);

    // Assert there are no console error messages recorded during the cycle
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Attempting to interact while modal alert is open results in interaction failure (observed error)', async ({ page }) => {
    // This test intentionally attempts to interact with the page while the alert is open.
    // Browsers block page interactions while a modal alert is present. We:
    // - Open the alert and hold it open (by waiting for it)
    // - Attempt a second click with a short timeout which should fail because the dialog blocks interactions
    // - Assert that an error occurs for the second click
    // - Finally accept the alert to restore normal operation
    const acid = new AcidPage(page);

    // Start the first click and capture the dialog
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      acid.clickButton(),
    ]);

    // At this point the alert is open. Attempting another click should fail or time out.
    let secondClickError = null;
    try {
      // Use a short timeout to force a quick failure rather than hanging the test
      await acid.clickButton({ timeout: 500 });
    } catch (err) {
      secondClickError = err;
    }

    // We expect some error to have occurred when trying to interact while the alert is open.
    // The exact error message can vary across Playwright versions / browsers, so assert generically.
    expect(secondClickError).not.toBeNull();
    expect(secondClickError).toBeInstanceOf(Error);

    // Clean up: accept the dialog so the page is usable again
    await dialog.accept();

    // After accepting, ensure the button is interactable again
    await expect(acid.button).toBeVisible();

    // Assert no unexpected page-level uncaught errors (ReferenceError/SyntaxError/TypeError) were recorded
    // (If such errors occurred before or during the test they are present in pageErrors.)
    const jsErrorNames = pageErrors.map((e) => e.name).filter(Boolean);
    // We assert that there are no common JS fatal errors; if they exist, the array would include their names.
    expect(jsErrorNames).not.toContain('ReferenceError');
    expect(jsErrorNames).not.toContain('SyntaxError');
    expect(jsErrorNames).not.toContain('TypeError');

    // And no console.error entries were logged as a result
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: Capture console and page errors during full interaction flow', async ({ page }) => {
    // This test exercises the main flow and then inspects collected console messages and page errors:
    // - Validates that the alert was triggered during interactions
    // - Ensures that there are no uncaught ReferenceError/SyntaxError/TypeError issues
    // - Logs console output for diagnostic purposes (asserts no error-level messages)
    const acid = new AcidPage(page);

    // Perform a click to trigger the alert and accept it
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      acid.clickButton(),
    ]);
    expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);
    await dialog.accept();

    // Perform another cycle
    const [dialog2] = await Promise.all([
      page.waitForEvent('dialog'),
      acid.clickButton(),
    ]);
    expect(dialog2.message()).toBe(EXPECTED_ALERT_TEXT);
    await dialog2.accept();

    // After interactions, analyze captured diagnostics
    // 1) No page errors (uncaught exceptions) present
    if (pageErrors.length > 0) {
      // If any page errors exist, fail with diagnostic details for easier debugging.
      const diagnostic = pageErrors.map((e) => `${e.name}: ${e.message}`).join('; ');
      throw new Error(`Unexpected page errors detected: ${diagnostic}`);
    }
    expect(pageErrors.length).toBe(0);

    // 2) No console 'error' messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // 3) For better traceability, assert there is at least some console activity (e.g., logs or warnings) OR none
    //    (This is tolerant: presence or absence of logs is acceptable; we only enforce absence of errors.)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});