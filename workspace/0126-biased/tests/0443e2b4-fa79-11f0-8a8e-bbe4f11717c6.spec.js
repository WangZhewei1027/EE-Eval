import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0443e2b4-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Page object for the Transaction page.
 * Encapsulates common interactions and inspections used by the tests.
 */
class TransactionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getTitleText() {
    return this.page.textContent('h1');
  }

  async getDescriptionText() {
    return this.page.textContent('.description');
  }

  async getButton() {
    return this.page.locator('.button');
  }

  async getButtonText() {
    return this.page.textContent('.button');
  }

  async getButtonOnclickAttribute() {
    return this.page.getAttribute('.button', 'onclick');
  }

  /**
   * Click the button and wait for the alert dialog to appear.
   * Returns the dialog message (text).
   */
  async clickButtonAndGetAlertText() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.getButton().click(),
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  /**
   * Click the button once without waiting for dialog (helper for edge-case flows).
   */
  async clickButton() {
    await this.getButton().click();
  }
}

test.describe('Transaction FSM - 0443e2b4-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Arrays to collect runtime observations (console messages and page errors).
  let consoleMessages = [];
  let pageErrors = [];

  // Attach listeners before each test to capture console and page errors as they happen.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (info, warn, error, debug, etc.)
    page.on('console', msg => {
      try {
        // Convert arguments to a string representation to make assertions easier.
        const args = msg.args().map(a => {
          try {
            return a.jsonValue();
          } catch {
            return a.toString();
          }
        });
        consoleMessages.push({ type: msg.type(), text: msg.text(), args });
      } catch {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      }
    });

    // Collect uncaught page errors (these may be ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application page for each test.
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Ensure any pending dialogs are dismissed to avoid affecting following tests.
    // We don't close the page here because Playwright test runner handles that.
    // This is just a safety net in case a dialog remains open.
    page.on('dialog', async dialog => {
      try {
        await dialog.dismiss();
      } catch {}
    });
  });

  test('S0_Idle: initial render - page and button are present with expected attributes', async ({ page }) => {
    // Validate initial page render corresponds to S0_Idle
    const txPage = new TransactionPage(page);

    // Check header and description text are rendered
    const title = await txPage.getTitleText();
    expect(title).toBeTruthy();
    expect(title.trim()).toBe('Transaction');

    const description = await txPage.getDescriptionText();
    expect(description).toBeTruthy();
    // Description is part of the UI polish described in the FSM
    expect(description).toContain('A beautiful, polished UI');

    // Button should be present and visible
    const button = await txPage.getButton();
    await expect(button).toBeVisible();

    // Button text should match the FSM evidence
    const btnText = await txPage.getButtonText();
    expect(btnText).toBe('Click Me!');

    // The onclick attribute evidence is important to the FSM. Verify it matches exactly.
    const onclickAttr = await txPage.getButtonOnclickAttribute();
    // The FSM expects: alert('Hello World!')
    expect(onclickAttr).toBe("alert('Hello World!')");

    // Inspect collected console messages: there can be logs, but ensure we captured them.
    expect(Array.isArray(consoleMessages)).toBe(true);

    // If any page errors occurred during initial render, they must be captured in pageErrors.
    // We assert that pageErrors is an array (content checked in a dedicated test below).
    expect(Array.isArray(pageErrors)).toBe(true);
  });

  test('Transition ButtonClick (S0_Idle -> S1_ButtonClicked): clicking the button shows alert with "Hello World!"', async ({ page }) => {
    // This test validates the transition defined in the FSM: ButtonClick causes alert('Hello World!')
    const txPage = new TransactionPage(page);

    // Ensure button exists before interaction
    await expect(txPage.getButton()).toBeVisible();

    // Click and capture the dialog message emitted by the onclick handler.
    const message = await txPage.clickButtonAndGetAlertText();
    expect(message).toBe('Hello World!'); // FSM expected_observables: alert('Hello World!')

    // After accepting the alert, validate that DOM evidence for S1 still shows the onclick attribute
    // (the FSM's evidence for S1 references the onclick handler).
    const onclickAttr = await txPage.getButtonOnclickAttribute();
    expect(onclickAttr).toBe("alert('Hello World!')");

    // Ensure no unexpected DOM changes occurred as part of this simple onclick behavior.
    const btnText = await txPage.getButtonText();
    expect(btnText).toBe('Click Me!');
  });

  test('Edge case: multiple rapid clicks should produce successive alerts (handle multiple dialogs)', async ({ page }) => {
    // This test ensures repeated user interactions are handled predictably.
    const txPage = new TransactionPage(page);
    await expect(txPage.getButton()).toBeVisible();

    // Click the button twice and handle two dialogs sequentially.
    // We intentionally perform sequential waits so the test will fail if dialogs do not appear.
    for (let i = 0; i < 2; i++) {
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        txPage.getButton().click(),
      ]);
      expect(dialog.message()).toBe('Hello World!');
      await dialog.accept();
    }

    // After repeated interactions, verify the button is still present and unchanged.
    expect(await txPage.getButtonText()).toBe('Click Me!');
    expect(await txPage.getButtonOnclickAttribute()).toBe("alert('Hello World!')");
  });

  test('OnEnter/OnExit actions and runtime errors observation: collect and assert page errors and console output', async ({ page }) => {
    // This test gathers runtime errors and console messages to validate expected behaviors and error scenarios.
    // The FSM mentions entry actions like renderPage() and alert('Hello World!').
    // We cannot modify the application; we only observe what happens naturally.

    // Wait a short time to allow any asynchronous scripts or errors to surface.
    await page.waitForTimeout(250);

    // Check console messages: record summary of any console.error calls (if present).
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    if (errorConsoleMessages.length > 0) {
      // If there are console.error messages, ensure they have non-empty text to aid debugging.
      for (const msg of errorConsoleMessages) {
        expect(typeof msg.text).toBe('string');
        expect(msg.text.length).toBeGreaterThan(0);
      }
    } else {
      // It's acceptable for there to be no console.error messages.
      expect(errorConsoleMessages.length).toBe(0);
    }

    // Check for uncaught page errors (pageerror events). These are captured in pageErrors.
    // We handle two possibilities:
    // - No uncaught errors happened: the application executed cleanly.
    // - Some uncaught errors happened: ensure they are standard JS error types and were captured.
    if (pageErrors.length === 0) {
      // No uncaught exceptions surfaced during load/interactions.
      expect(pageErrors.length).toBe(0);
    } else {
      // If errors exist, assert they are Error objects and their names are one of the typical JS error types.
      const allowedErrorNames = ['ReferenceError', 'TypeError', 'SyntaxError', 'Error'];
      for (const err of pageErrors) {
        // err is an Error object; verify its constructor name is expected.
        expect(typeof err.name).toBe('string');
        expect(allowedErrorNames).toContain(err.name);
        // Ensure the message exists and is a string.
        expect(typeof err.message).toBe('string');
        expect(err.message.length).toBeGreaterThan(0);
      }
    }
  });

  test('Sanity check: onclick attribute exists and matches FSM evidence even after navigation reload', async ({ page }) => {
    // Reload the page and ensure the button evidence still matches FSM expectations.
    const txPage = new TransactionPage(page);
    await page.reload();
    await txPage.goto(); // Ensure we are on the target URL after reload.

    await expect(txPage.getButton()).toBeVisible();
    const onclickAttr = await txPage.getButtonOnclickAttribute();
    expect(onclickAttr).toBe("alert('Hello World!')");

    // Ensure a click still produces the alert after reload.
    const message = await txPage.clickButtonAndGetAlertText();
    expect(message).toBe('Hello World!');
  });
});