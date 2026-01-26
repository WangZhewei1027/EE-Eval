import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b2a663-fa7c-11f0-adc7-178f556b1ee0.html';

class TransactionPage {
  /**
   * Simple page object for the Transaction app.
   * Encapsulates selectors and interactions used by the tests.
   */
  constructor(page) {
    this.page = page;
    this.executeButtonSelector = "button[onclick='demoTransaction()']";
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getExecuteButton() {
    return this.page.locator(this.executeButtonSelector);
  }

  // Click the Execute Transaction button and wait for a dialog to appear (if any).
  // Returns the Playwright Dialog object if one appears, otherwise returns null.
  async clickExecuteAndWaitForDialog() {
    const button = await this.getExecuteButton();
    // Use Promise.race pattern: either dialog appears or click completes
    const dialogPromise = this.page.waitForEvent('dialog', { timeout: 2000 }).catch(() => null);
    await button.click();
    const dialog = await dialogPromise;
    return dialog;
  }
}

test.describe('Transaction FSM tests - f5b2a663-fa7c-11f0-adc7-178f556b1ee0', () => {
  let pageConsoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    pageConsoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // Collect text of console messages for inspection
      try {
        pageConsoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If something goes wrong while reading console, record the raw object
        pageConsoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    page.on('pageerror', err => {
      // Collect unhandled exceptions from the page
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // nothing to teardown beyond Playwright fixtures; arrays reset in beforeEach
  });

  test('Idle state: page loads and shows the Execute Transaction button with expected attributes', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) presence and initial UI.
    const txPage = new TransactionPage(page);

    // Verify page loaded by checking the title and header text
    await expect(page).toHaveTitle(/Transaction/);
    await expect(page.locator('h1')).toHaveText('Transaction');

    // Verify the Execute Transaction button exists, is visible, and has the expected onclick attribute
    const button = await txPage.getExecuteButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Execute Transaction');

    const onclickAttr = await button.getAttribute('onclick');
    // The FSM/evidence expects onclick="demoTransaction()"
    expect(onclickAttr).toBe('demoTransaction()');

    // Verify the demoTransaction function is present on the window (without modifying it)
    const demoType = await page.evaluate(() => typeof window.demoTransaction);
    expect(demoType).toBe('function');

    // The FSM mentions an entry action 'renderPage()' for the Idle state.
    // The implementation provided does not define renderPage; assert that it's undefined.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Ensure there was no premature success console.log before any interaction
    const foundSuccessLogAtLoad = pageConsoleMessages.some(m => m.text.includes('Transaction') && m.text.includes('executed successfully'));
    expect(foundSuccessLogAtLoad).toBeFalsy();

    // Ensure no page errors were emitted on load
    expect(pageErrors.length).toBe(0);
  });

  test('Execute Transaction event: clicking the button triggers demoTransaction and shows alert for mismatched sender/receiver', async ({ page }) => {
    // This test exercises the FSM transition ExecuteTransaction from Idle -> TransactionExecuted.
    // The implementation checks sender !== receiver and alerts "Invalid sender and receiver" then returns.
    const txPage = new TransactionPage(page);

    // Listen for dialog and click the button
    const dialog = await txPage.clickExecuteAndWaitForDialog();

    // The function sets sender = "User" and receiver = "Bank", so it should alert
    // "Invalid sender and receiver" and return before logging success.
    expect(dialog).not.toBeNull();
    if (dialog) {
      try {
        expect(dialog.message()).toBe('Invalid sender and receiver');
      } finally {
        // Accept the alert to allow the page to continue
        await dialog.accept();
      }
    }

    // After clicking, verify that no success console.log about transaction execution was emitted.
    const foundSuccessLog = pageConsoleMessages.some(m => m.text.includes('Transaction') && m.text.includes('executed successfully'));
    expect(foundSuccessLog).toBeFalsy();

    // The demoTransaction function should have been invoked (we observed the alert). Confirm the function exists.
    const demoType = await page.evaluate(() => typeof window.demoTransaction);
    expect(demoType).toBe('function');

    // Confirm no unexpected page errors occurred during the click and handler
    expect(pageErrors.length).toBe(0);
  });

  test('S1 TransactionExecuted not reached due to validation: assert absence of console success message and presence of validation alert', async ({ page }) => {
    // This test asserts that the FSM's expected observable for S1 ("Transaction executed successfully")
    // does NOT occur with the current implementation because validation prevents execution.
    const txPage = new TransactionPage(page);

    // Click and handle dialog
    const dialog = await txPage.clickExecuteAndWaitForDialog();
    expect(dialog).not.toBeNull();
    if (dialog) {
      await dialog.accept();
    }

    // Confirm that the console does not contain the success message expected by S1.
    const successMessages = pageConsoleMessages.filter(m => /Transaction .* executed successfully/.test(m.text));
    expect(successMessages.length).toBe(0);

    // For transparency, also assert that we did receive an alert indicating validation failed.
    const alertMessageWasObserved = Boolean(dialog && dialog.message().includes('Invalid sender and receiver'));
    expect(alertMessageWasObserved).toBe(true);

    // No page errors should have happened during the failed transition
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case checks: validate data validation and transaction id checks are not reached because of early return', async ({ page }) => {
    // This test examines the other validation branches in the function body.
    // Given the early return on sender !== receiver, the subsequent checks are not executed.
    // We assert that no console alerts happened for "Invalid message" or "Invalid transaction ID"
    // and that no "Transaction ... executed successfully" log exists.
    const txPage = new TransactionPage(page);

    // Click to trigger the function (will hit the sender/receiver check)
    const dialog = await txPage.clickExecuteAndWaitForDialog();
    expect(dialog).not.toBeNull();
    if (dialog) {
      await dialog.accept();
    }

    // Search console messages for other validation alerts or success
    const invalidMessageAlert = pageConsoleMessages.some(m => m.text.includes('Invalid message'));
    const invalidTxIdAlert = pageConsoleMessages.some(m => m.text.includes('Invalid transaction ID'));
    const successLog = pageConsoleMessages.some(m => /Transaction .* executed successfully/.test(m.text));

    // None of these should be present because function returned early after the first validation
    expect(invalidMessageAlert).toBeFalsy();
    expect(invalidTxIdAlert).toBeFalsy();
    expect(successLog).toBeFalsy();

    // Ensure the only visible observable from the run was the 'Invalid sender and receiver' alert (dialog)
    expect(dialog && dialog.message()).toBe('Invalid sender and receiver');

    // No page errors should have been raised
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: monitor console and page errors across interactions', async ({ page }) => {
    // This test demonstrates capturing console and page errors across multiple interactions.
    // It also asserts that no unexpected runtime exceptions (ReferenceError, TypeError, etc.) occurred.
    const txPage = new TransactionPage(page);

    // Sanity: demoTransaction exists
    const demoType = await page.evaluate(() => typeof window.demoTransaction);
    expect(demoType).toBe('function');

    // Perform click once to trigger the validation alert
    const dialog = await txPage.clickExecuteAndWaitForDialog();
    if (dialog) await dialog.accept();

    // After interactions, inspect collected console messages and page errors
    // Expect zero page errors (no unhandled exceptions)
    expect(pageErrors.length).toBe(0);

    // There should be no console log indicating a successful transaction due to early validation
    const transactionSuccessConsole = pageConsoleMessages.filter(m => /executed successfully/.test(m.text));
    expect(transactionSuccessConsole.length).toBe(0);

    // There may be console messages unrelated to transaction success; assert that we captured console events without errors
    expect(Array.isArray(pageConsoleMessages)).toBe(true);
  });
});