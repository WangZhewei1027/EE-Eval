import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1fd92-fa7b-11f0-8b01-9f078a0ff214.html';
const BUTTON_SELECTOR = '.button';
const EXPECTED_ALERT_TEXT = 'Demo: Process states transition. New → Ready → Running → Waiting → Terminated';

class ProcessDemoPage {
  /**
   * Simple page object for the Process State Demo page.
   * Encapsulates common actions and selectors.
   */
  constructor(page) {
    this.page = page;
    this.url = APP_URL;
    this.button = this.page.locator(BUTTON_SELECTOR);
  }

  async goto() {
    await this.page.goto(this.url, { waitUntil: 'load' });
  }

  async isButtonVisible() {
    return await this.button.isVisible();
  }

  async getButtonText() {
    return await this.button.textContent();
  }

  /**
   * Clicks the demo button and waits for the alert dialog to appear.
   * Returns the dialog message and accepts it.
   */
  async clickAndGetDialogMessage() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.button.click()
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  /**
   * Focuses the demo button and triggers it via keyboard (Enter).
   */
  async activateWithKeyboard() {
    await this.button.focus();
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.keyboard.press('Enter')
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }
}

test.describe('Process State Demo (d5a1fd92-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Arrays to collect observed console errors and page errors during each test.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled page errors (e.g., ReferenceError, TypeError, SyntaxError)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async () => {
    // Nothing special to teardown per test beyond Playwright's automatic cleanup.
    // We still assert in tests about collected errors; this hook is reserved for potential future cleanup.
  });

  test('S0_Idle - initial render shows the demo button and page content', async ({ page }) => {
    // Validate the initial Idle state: the page renders and the "Show Process State Demo" button is present.
    const demo = new ProcessDemoPage(page);
    await demo.goto();

    // The FSM expected entry action renderPage() - the implementation should render the page.
    // Check that the button is visible and has the correct text.
    expect(await demo.isButtonVisible()).toBe(true);
    const btnText = (await demo.getButtonText())?.trim();
    expect(btnText).toBe('Show Process State Demo');

    // Ensure no unexpected page runtime errors occurred while loading the page.
    // The test intentionally observes page errors and console errors (they are allowed to happen naturally).
    // Here we assert that none occurred during the initial render.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S0_Idle -> S1_DemoShown transition: clicking the button shows an alert with expected text', async ({ page }) => {
    // Validate the transition triggered by the ShowDemo event (click on the button).
    const demo = new ProcessDemoPage(page);
    await demo.goto();

    // Click the button and capture the alert (dialog). Verify the alert text matches FSM evidence.
    const dialogMessage = await demo.clickAndGetDialogMessage();
    expect(dialogMessage).toBe(EXPECTED_ALERT_TEXT);

    // After the alert, verify no page errors or console errors were emitted during the interaction.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_DemoShown - multiple interactions: repeated clicks produce alerts each time', async ({ page }) => {
    // Edge case: clicking the button multiple times should show the alert each time.
    const demo = new ProcessDemoPage(page);
    await demo.goto();

    const messages = [];
    // Click twice, accepting each dialog in sequence.
    for (let i = 0; i < 2; i++) {
      const msg = await demo.clickAndGetDialogMessage();
      messages.push(msg);
    }

    // Both alerts should show the exact same expected message.
    expect(messages.length).toBe(2);
    for (const m of messages) {
      expect(m).toBe(EXPECTED_ALERT_TEXT);
    }

    // Ensure no runtime errors occurred during repeated interactions.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Activation via keyboard: focusing the button and pressing Enter triggers the demo alert', async ({ page }) => {
    // Accessibility and interaction edge case: keyboard activation should work like clicking.
    const demo = new ProcessDemoPage(page);
    await demo.goto();

    // Use keyboard to trigger the button. Wait for dialog and assert message.
    const message = await demo.activateWithKeyboard();
    expect(message).toBe(EXPECTED_ALERT_TEXT);

    // Check no unexpected errors during keyboard activation.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe console and page errors: report any runtime exceptions (none expected, assert none)', async ({ page }) => {
    // This test's purpose is to explicitly observe and assert on any console/page errors.
    // According to the test runner requirements, we must observe console logs and page errors,
    // let ReferenceError/SyntaxError/TypeError happen naturally, and assert about them.
    // In this implementation, the page is expected to be well-formed; therefore we assert that none occurred.
    const demo = new ProcessDemoPage(page);
    await demo.goto();

    // Perform a simple interaction to ensure scripts run: click and accept dialog.
    const dialogMessage = await demo.clickAndGetDialogMessage();
    expect(dialogMessage).toBe(EXPECTED_ALERT_TEXT);

    // Now assert that no page errors or console error messages were recorded.
    // If the implementation had a runtime error (ReferenceError/TypeError/SyntaxError), it would be captured in pageErrors
    // or consoleErrors and this assertion would fail, surfacing the issue as intended.
    expect(pageErrors.length, `Expected no page errors, but found: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console errors, but found: ${consoleErrors.join('; ')}`).toBe(0);
  });

  test('Sanity edge-case: interacting with a non-existent selector should time out or throw - ensure app resilience', async ({ page }) => {
    // This test intentionally tries an interaction that should not exist in the DOM to see how the page behaves.
    // We DO NOT modify the page or its JS; we attempt to click a selector that isn't present and assert behavior.
    await page.goto(APP_URL, { waitUntil: 'load' });

    const missingSelector = '.non-existent-button';
    const locator = page.locator(missingSelector);

    // Attempting to click a non-existent element should throw a timeout error from Playwright when trying to click.
    // We'll assert that Playwright throws when we try to click without waiting for the element to appear.
    let threw = false;
    try {
      // Use a small timeout to keep test fast; this should trigger an error.
      await locator.click({ timeout: 1000 });
    } catch (err) {
      threw = true;
      // Ensure the error is indeed a Playwright timeout/error about element not found.
      expect(err.message).toContain('waiting for element'); // generic check to ensure it's a locator-related error
    }
    expect(threw).toBe(true);

    // Ensure that the page itself didn't emit unexpected runtime errors as a result of this failed click.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});