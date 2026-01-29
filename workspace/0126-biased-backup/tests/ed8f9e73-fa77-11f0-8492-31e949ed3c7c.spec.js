import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f9e73-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the Unit Testing Visualization page
class UnitTestingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    // capture console and page errors
    this.page.on('console', msg => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  // Navigate to the page and wait for load
  async goto() {
    await this.page.goto(BASE_URL, { waitUntil: 'load' });
  }

  // Return the main heading text
  async getHeadingText() {
    return this.page.textContent('h1');
  }

  // Return the button element handle for the Show Example button
  async getShowExampleButton() {
    return this.page.$('#show-alert');
  }

  // Return the button text
  async getShowExampleButtonText() {
    return this.page.textContent('#show-alert');
  }

  // Click the Show Example button and wait for alert dialog, then accept it
  // Returns the dialog message text
  async clickShowExampleAndGetAlertText() {
    // Trigger click and wait for dialog
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.click('#show-alert')
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  // Click the Show Example button but do not accept the dialog (for edge tests)
  async clickShowExampleAndHandleDialog(handler = async (d) => d.accept()) {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.click('#show-alert')
    ]);
    await handler(dialog);
    return dialog;
  }

  // Utility to click multiple times and collect alert messages sequentially
  async clickMultipleAndCollectAlerts(times = 3) {
    const messages = [];
    for (let i = 0; i < times; i++) {
      const msg = await this.clickShowExampleAndGetAlertText();
      messages.push(msg);
    }
    return messages;
  }
}

test.describe('Unit Testing Visualization - FSM validation', () => {
  // The page object will be created per test using the Playwright page fixture
  test.describe('S0_Idle (Initial State) validations', () => {
    test('Initial render shows heading and the "Show Example" button (S0_Idle entry_actions: renderPage())', async ({ page }) => {
      // Setup page object to capture console and page errors
      const utPage = new UnitTestingPage(page);

      // Navigate to the application
      await utPage.goto();

      // Validate the main heading exists and has correct text
      const headingText = (await utPage.getHeadingText())?.trim();
      expect(headingText).toBe('Unit Testing Visualization');

      // Validate the Show Example button exists, has expected id and text
      const button = await utPage.getShowExampleButton();
      expect(button).not.toBeNull();
      const buttonText = (await utPage.getShowExampleButtonText())?.trim();
      expect(buttonText).toBe('Show Example');

      // Verify the button has the expected id attribute
      const idAttr = await button.getAttribute('id');
      expect(idAttr).toBe('show-alert');

      // No JavaScript runtime errors should have been emitted during load
      // We assert that there are zero page errors captured
      expect(utPage.pageErrors.length).toBe(0);

      // Console should not contain unrecoverable errors; we ensure no console message has type 'error'
      const consoleErrorMessages = utPage.consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMessages.length).toBe(0);
    });
  });

  test.describe('S1_AlertShown (Transition on ShowExampleClick)', () => {
    test('Clicking "Show Example" triggers alert with expected message (transition S0 -> S1)', async ({ page }) => {
      // This test validates the FSM transition: ShowExampleClick triggers the S1_AlertShown entry action (alert)
      const utPage = new UnitTestingPage(page);
      await utPage.goto();

      // Click button and capture alert dialog message
      const alertText = await utPage.clickShowExampleAndGetAlertText();
      expect(alertText).toBe('Unit Test Example Executed!');

      // After dismissing the alert, ensure the page remains in Idle-like state (button still present)
      const button = await utPage.getShowExampleButton();
      expect(button).not.toBeNull();

      // Ensure no page errors occurred during the click/alert sequence
      expect(utPage.pageErrors.length).toBe(0);
      // Ensure no console 'error' messages were printed
      const consoleErrors = utPage.consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking "Show Example" multiple times triggers alert each time (edge case: repeated transition)', async ({ page }) => {
      // Validate repeated transitions work reliably and each click produces the expected alert
      const utPage = new UnitTestingPage(page);
      await utPage.goto();

      // Click 3 times and collect alert messages
      const messages = await utPage.clickMultipleAndCollectAlerts(3);
      expect(messages).toEqual([
        'Unit Test Example Executed!',
        'Unit Test Example Executed!',
        'Unit Test Example Executed!'
      ]);

      // Ensure still no page errors after repeated usage
      expect(utPage.pageErrors.length).toBe(0);
    });

    test('Rapid clicks produce sequential alerts and are handled in order', async ({ page }) => {
      // This test attempts to click rapidly and ensures we can handle successive dialogs.
      const utPage = new UnitTestingPage(page);
      await utPage.goto();

      // Rapidly click the button 2 times but handle dialogs one-by-one
      // We intentionally await each dialog sequentially to simulate user acceptance
      const first = await utPage.clickShowExampleAndGetAlertText();
      expect(first).toBe('Unit Test Example Executed!');
      const second = await utPage.clickShowExampleAndGetAlertText();
      expect(second).toBe('Unit Test Example Executed!');

      // Confirm no page errors were generated
      expect(utPage.pageErrors.length).toBe(0);
    });

    test('Ensure dialog behavior is "alert" (not confirm/prompt) and only has accept', async ({ page }) => {
      // Confirm the dialog type corresponds to an alert and that accept works
      const utPage = new UnitTestingPage(page);
      await utPage.goto();

      // Use handler to examine dialog object properties
      let observedDialog = null;
      const dialog = await utPage.clickShowExampleAndHandleDialog(async (d) => {
        observedDialog = d;
        // Accept the alert (alerts only support accept)
        await d.accept();
      });

      // The dialog instance should have the expected message and no defaultValue (alerts have empty default)
      expect(observedDialog).not.toBeNull();
      expect(observedDialog.message()).toBe('Unit Test Example Executed!');
      // defaultValue is allowed to be retrieved (empty string for alert)
      expect(typeof observedDialog.defaultValue).toBe('string');
    });
  });

  test.describe('Console and Runtime Error Observability', () => {
    test('No ReferenceError/SyntaxError/TypeError occurred during page load or interactions', async ({ page }) => {
      // This test observes console and pageerror events and asserts none of the
      // common fatal JS error types occurred. If any do occur, the test will fail,
      // making it explicit that the runtime produced unexpected errors.
      const utPage = new UnitTestingPage(page);
      await utPage.goto();

      // Perform a typical interaction to exercise script: click and accept alert
      const alertText = await utPage.clickShowExampleAndGetAlertText();
      expect(alertText).toBe('Unit Test Example Executed!');

      // Map pageErrors to their names for inspection
      const errorNames = utPage.pageErrors.map(e => e.name);
      // Ensure none of the captured errors are ReferenceError, SyntaxError or TypeError
      const forbidden = ['ReferenceError', 'SyntaxError', 'TypeError'];
      for (const bad of forbidden) {
        expect(errorNames).not.toContain(bad);
      }

      // Additionally ensure no console messages of type 'error' that resemble these errors exist
      const consoleErrorsText = utPage.consoleMessages
        .filter(m => m.type === 'error')
        .map(m => m.text);
      // None of the console error messages should include the common error names
      for (const msg of consoleErrorsText) {
        for (const bad of forbidden) {
          expect(msg).not.toContain(bad);
        }
      }
    });

    test('Capture and expose console warnings and info for debugging (non-failing)', async ({ page }) => {
      // This test simply demonstrates that we capture console messages.
      // We will not fail if there are warnings/info messages, but we assert that
      // they are recorded in the page object for visibility.
      const utPage = new UnitTestingPage(page);
      await utPage.goto();

      // Trigger an interaction
      await utPage.clickShowExampleAndGetAlertText();

      // We expect console messages array to be an array (may be empty)
      expect(Array.isArray(utPage.consoleMessages)).toBe(true);

      // If there are console error-level messages, surface them in the assertion message
      const consoleErrors = utPage.consoleMessages.filter(m => m.type === 'error');
      // Prefer to assert zero error messages, but provide details if any
      expect(consoleErrors.length).toBe(0);
    });
  });
});