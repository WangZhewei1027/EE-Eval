import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f0d71-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page object representing the transaction demo page.
 * Encapsulates selectors and common interactions so tests read clearly.
 */
class TransactionsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.transactionsContainer = page.locator('#transactions');
    this.transactionItems = page.locator('#transactions .transaction');
    this.processButton = page.locator('#processTransaction');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getTransactionCount() {
    return await this.transactionItems.count();
  }

  async getAllTransactionTexts() {
    return await this.transactionItems.allTextContents();
  }

  async clickProcess() {
    await this.processButton.click();
  }
}

test.describe('Transaction Concept Demonstration - FSM behavior', () => {
  // Arrays to capture page console messages and page errors for assertions.
  let consoleMessages;
  let pageErrors;
  let pageEventHandler;
  let errorHandler;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    pageEventHandler = (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case Playwright console message transforms unexpectedly, still capture raw text
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    };
    page.on('console', pageEventHandler);

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    errorHandler = (err) => {
      // err is an Error object; capture its message
      pageErrors.push(String(err && err.message ? err.message : err));
    };
    page.on('pageerror', errorHandler);

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid leaking state between tests
    page.off('console', pageEventHandler);
    page.off('pageerror', errorHandler);
  });

  test.describe('S0_Idle (Idle) state - initial display and entry action', () => {
    test('displays all transactions on load (displayTransactions entry action)', async ({ page }) => {
      // This test validates the "Idle" state's entry action displayTransactions()
      const txPage = new TransactionsPage(page);

      // Verify that the transactions container exists and contains the expected transaction entries
      await expect(txPage.transactionsContainer).toBeVisible();

      // There are 4 transactions defined in the page source; verify count
      const count = await txPage.getTransactionCount();
      expect(count).toBe(4);

      // Verify the textual content of each transaction matches the expected format
      const texts = await txPage.getAllTransactionTexts();
      expect(texts).toEqual(
        expect.arrayContaining([
          'Transaction ID: 1, Type: deposit, Amount: $100',
          'Transaction ID: 2, Type: withdrawal, Amount: $50',
          'Transaction ID: 3, Type: deposit, Amount: $200',
          'Transaction ID: 4, Type: withdrawal, Amount: $25'
        ])
      );

      // Ensure that no uncaught page errors happened during initial rendering
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('S1_Processing (Processing) state - transitions and behaviors', () => {
    test('clicking "Process Transaction" triggers processing and shows success alert (processTransaction entry action)', async ({ page }) => {
      // This test validates the FSM transition from Idle -> Processing on ProcessTransactionClick
      // and that processTransaction() runs: logs to console for each transaction and shows an alert.

      const txPage1 = new TransactionsPage(page);

      // Prepare to capture the dialog produced by alert(...)
      const dialogPromise = page.waitForEvent('dialog');

      // Click the process button - this should trigger processTransaction(), console logs, and an alert
      await txPage.clickProcess();

      // Wait for the alert dialog and assert its message
      const dialog = await dialogPromise;
      expect(dialog).toBeTruthy();
      expect(dialog.message()).toBe('All transactions processed successfully!');
      // Dismiss the alert so script execution can continue
      await dialog.dismiss();

      // Give a short moment for console messages produced by processing to be captured
      await page.waitForTimeout(150);

      // Extract text of console messages
      const texts1 = consoleMessages.map(m => m.text);

      // Expect the expected deposit/withdraw logs to be present
      expect(texts).toEqual(expect.arrayContaining([
        'Deposited $100',
        'Withdrew $50',
        'Deposited $200',
        'Withdrew $25'
      ]));

      // Ensure no console.error entries were emitted during normal processing
      const consoleErrors = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
      expect(consoleErrors).toEqual([]);

      // Verify that the transaction DOM elements are still present and unchanged after processing
      const countAfter = await txPage.getTransactionCount();
      expect(countAfter).toBe(4);
      const textsAfter = await txPage.getAllTransactionTexts();
      expect(textsAfter).toEqual(expect.arrayContaining([
        'Transaction ID: 1, Type: deposit, Amount: $100',
        'Transaction ID: 2, Type: withdrawal, Amount: $50',
        'Transaction ID: 3, Type: deposit, Amount: $200',
        'Transaction ID: 4, Type: withdrawal, Amount: $25'
      ]));

      // Confirm no uncaught page errors occurred during processing
      expect(pageErrors).toEqual([]);
    });

    test('processing can be triggered multiple times; behavior is consistent (idempotent run observation)', async ({ page }) => {
      // This test validates repeated transitions/triggers: clicking Process Transaction multiple times.
      // We expect repeated alerts and repeated console logs for each transaction run.

      const txPage2 = new TransactionsPage(page);

      // Click once and handle dialog
      const firstDialogPromise = page.waitForEvent('dialog');
      await txPage.clickProcess();
      const firstDialog = await firstDialogPromise;
      expect(firstDialog.message()).toBe('All transactions processed successfully!');
      await firstDialog.dismiss();

      // Click a second time and handle dialog again
      const secondDialogPromise = page.waitForEvent('dialog');
      await txPage.clickProcess();
      const secondDialog = await secondDialogPromise;
      expect(secondDialog.message()).toBe('All transactions processed successfully!');
      await secondDialog.dismiss();

      // Wait briefly to collect console messages from both runs
      await page.waitForTimeout(200);

      // Count occurrences of each log message -- each message should appear twice (one per click)
      const allTexts = consoleMessages.map(m => m.text);
      function countOccurrences(value) {
        return allTexts.filter(t => t === value).length;
      }

      expect(countOccurrences('Deposited $100')).toBeGreaterThanOrEqual(2);
      expect(countOccurrences('Withdrew $50')).toBeGreaterThanOrEqual(2);
      expect(countOccurrences('Deposited $200')).toBeGreaterThanOrEqual(2);
      expect(countOccurrences('Withdrew $25')).toBeGreaterThanOrEqual(2);

      // Still no page errors
      expect(pageErrors).toEqual([]);
    });

    test('no unexpected runtime errors (ReferenceError/SyntaxError/TypeError) observed during interactions', async ({ page }) => {
      // This test gathers any uncaught page errors that may have occurred naturally and asserts none happened.
      // According to the instruction, we must observe and assert page errors as they naturally occur.
      // Since this application is well-formed, we assert that no such uncaught errors occurred.
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Edge cases and robustness checks', () => {
    test('UI remains stable and interactive after processing (button still clickable and transactions intact)', async ({ page }) => {
      // This test ensures the button remains present and clickable after a processing run,
      // and that the transactions list is not removed or corrupted.

      const txPage3 = new TransactionsPage(page);

      // Ensure the button is visible and enabled
      await expect(txPage.processButton).toBeVisible();
      await expect(txPage.processButton).toBeEnabled();

      // Do a processing run (handle alert)
      const dialogPromise1 = page.waitForEvent('dialog');
      await txPage.clickProcess();
      const dialog1 = await dialogPromise;
      expect(dialog.message()).toBe('All transactions processed successfully!');
      await dialog.dismiss();

      // After processing, button should still be present and clickable
      await expect(txPage.processButton).toBeVisible();
      await expect(txPage.processButton).toBeEnabled();

      // Transactions remain present and counts unchanged
      const count1 = await txPage.getTransactionCount();
      expect(count).toBe(4);

      // No uncaught page errors were thrown
      expect(pageErrors).toEqual([]);
    });
  });
});