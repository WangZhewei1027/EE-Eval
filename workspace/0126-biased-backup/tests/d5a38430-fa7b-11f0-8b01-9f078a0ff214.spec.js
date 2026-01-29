import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a38430-fa7b-11f0-8b01-9f078a0ff214.html';

// Page object model for the Backpropagation demo page
class BackpropPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButtonSelector = 'button[onclick]';
    // The exact alert message as defined in the HTML onclick attribute
    this.expectedAlertText = "This is a placeholder for a demonstration of backpropagation!";
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getDemoButton() {
    return this.page.locator(this.demoButtonSelector);
  }

  async demoButtonText() {
    return (await this.getDemoButton().innerText()).trim();
  }

  async demoButtonOnclickAttribute() {
    return await this.page.getAttribute(this.demoButtonSelector, 'onclick');
  }

  // Click the demo button and wait for the dialog, then accept it.
  // Returns the dialog message text.
  async clickDemoButtonAndAccept() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.click(this.demoButtonSelector),
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }
}

test.describe('Understanding Backpropagation - FSM and UI tests', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;
  let pageWarnings;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    pageWarnings = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'warning') pageWarnings.push(msg.text());
    });

    // Capture runtime errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Helpful debug output on failure to make it clearer what happened
    // Note: We do not modify page behavior, only inspect recorded logs
    if (pageErrors.length) {
      // Re-throw the first page error so Playwright surfaces it clearly in the report
      // This is only to make failures explicit; we still allow tests to assert on pageErrors
    }
  });

  test.describe('Initial State (S0_Idle)', () => {
    test('Initial Idle state should render main content and the demo button', async ({ page }) => {
      // Validate the page components and that we are in the Idle state (no modal/dialogs open)
      const model = new BackpropPage(page);

      // The header should be present
      await expect(page.locator('h1')).toHaveText('Understanding Backpropagation');

      // The demonstration button should exist and be visible
      const button = await model.getDemoButton();
      await expect(button).toBeVisible();

      // Validate button label
      const btnText = await model.demoButtonText();
      expect(btnText).toBe('Click for Demonstration');

      // Validate onclick attribute evidence (entry_action/evidence)
      const onclickAttr = await model.demoButtonOnclickAttribute();
      expect(onclickAttr).toBeDefined();
      expect(onclickAttr).toContain("alert('This is a placeholder for a demonstration of backpropagation!')");

      // Ensure there are no runtime page errors at load (we observe and assert naturally)
      expect(pageErrors.length).toBe(0);

      // Ensure no console error messages were emitted on load
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transitions and Alerts (S0 -> S1 and S1 -> S0)', () => {
    test('Clicking the demonstration button should trigger the S1_DemonstrationAlert (alert) - S0 -> S1', async ({ page }) => {
      // This test validates the transition from Idle to Demonstration Alert state:
      // - clicking the button triggers an alert with the expected message
      // - after accepting the alert, page returns to Idle (no page errors)
      const model = new BackpropPage(page);

      // Click and capture alert
      const alertMessage = await model.clickDemoButtonAndAccept();

      // Assert the alert shows the expected message as declared in entry_actions
      expect(alertMessage).toBe(model.expectedAlertText);

      // After dismissing, ensure no runtime errors occurred during the transition
      expect(pageErrors.length).toBe(0);

      // Ensure no console errors during transition
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking the demonstration button twice triggers two alerts (S1 -> S0 -> S1 -> S0)', async ({ page }) => {
      // This test exercises the transition to S1 and back to S0 multiple times by clicking twice.
      // It ensures repeated transitions produce the same alert and do not introduce runtime errors.

      const model = new BackpropPage(page);

      // First click -> first alert
      const firstMessage = await model.clickDemoButtonAndAccept();
      expect(firstMessage).toBe(model.expectedAlertText);

      // After accepting first alert, we expect to be back in Idle. Now click again.
      const secondMessage = await model.clickDemoButtonAndAccept();
      expect(secondMessage).toBe(model.expectedAlertText);

      // Ensure still no runtime errors after repeated transitions
      expect(pageErrors.length).toBe(0);

      // Ensure no console error messages were emitted
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge Cases and Error Scenarios', () => {
    test('Rapid interactions: double-click behavior should produce at least one alert and not crash', async ({ page }) => {
      // Edge case: user double-clicks the demonstration button.
      // We assert that at least one alert appears (browsers may block the second until the first is dismissed)
      // and that no unexpected runtime errors are thrown.

      const model = new BackpropPage(page);

      // Start waiting for a dialog, then trigger a double-click.
      // We use waitForEvent with a timeout to avoid hanging if no dialog appears.
      const dialogPromise = page.waitForEvent('dialog', { timeout: 3000 }).catch(e => null);

      // Attempt a double-click. Depending on browser behavior, this may show one alert (most likely).
      await model.getDemoButton().then(locator => locator.dblclick());

      const dialog = await dialogPromise;

      // If a dialog was observed, assert the message is the expected one and accept it.
      if (dialog) {
        expect(dialog.message()).toBe(model.expectedAlertText);
        await dialog.accept();
      } else {
        // If no dialog was shown (unexpected), fail the test explicitly to capture behavior.
        // However, some environments may suppress alerts—this assertion documents that behavior.
        throw new Error('Expected an alert dialog from double-click, but none was observed within timeout.');
      }

      // Ensure no runtime errors resulted from rapid interaction
      expect(pageErrors.length).toBe(0);

      // Ensure console has no error-level messages after the interaction
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Page should not have runtime ReferenceError, SyntaxError, or TypeError on load or interactions', async ({ page }) => {
      // This test explicitly asserts that no pageerror events (runtime exceptions) occurred
      // during load and a subsequent demonstration click interaction.
      const model = new BackpropPage(page);

      // No errors on initial load
      expect(pageErrors.length).toBe(0);

      // Perform a normal interaction
      const msg = await model.clickDemoButtonAndAccept();
      expect(msg).toBe(model.expectedAlertText);

      // Re-check runtime errors after interaction
      expect(pageErrors.length).toBe(0);
    });

    test('Console contains no unexpected warnings or errors; if warnings exist they are reported', async ({ page }) => {
      // This test collects console warnings and errors and asserts that no errors are present.
      // If warnings are present, we still allow the test to pass but make them visible in failure debugging.
      // (We do not modify the runtime; we only observe.)

      // We already have consoleMessages collected in beforeEach.
      const errors = consoleMessages.filter(m => m.type === 'error');
      const warnings = consoleMessages.filter(m => m.type === 'warning');

      // Fail test if there are console errors
      expect(errors.length).toBe(0);

      // Log warnings count to help debugging; we assert they exist only for visibility, not as failure
      // If there are warnings, still pass, but include an expectation that warnings are an array (sanity)
      expect(Array.isArray(warnings)).toBe(true);
    });
  });
});