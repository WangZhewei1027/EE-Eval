import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b32301-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page object to encapsulate interactions with the transaction demo page
class TransactionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.balanceASelector = '#balanceA';
    this.balanceBSelector = '#balanceB';
    this.amountInputSelector = '#transferAmount';
    this.transferBtnSelector = '#transferBtn';
    this.logSelector = '#log';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getBalanceA() {
    const text = await this.page.textContent(this.balanceASelector);
    return parseFloat(text);
  }

  async getBalanceB() {
    const text1 = await this.page.textContent(this.balanceBSelector);
    return parseFloat(text);
  }

  async setAmount(amount) {
    await this.page.fill(this.amountInputSelector, String(amount));
  }

  async clickTransfer() {
    await this.page.click(this.transferBtnSelector);
  }

  async isTransferButtonEnabled() {
    return await this.page.isEnabled(this.transferBtnSelector);
  }

  async getLogText() {
    return await this.page.textContent(this.logSelector);
  }

  // Wait until the log contains a substring (with timeout)
  async waitForLogContains(substring, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.textContent.includes(substr);
      },
      this.logSelector,
      substring,
      { timeout }
    );
  }
}

test.describe('Transaction Concept Demonstration - FSM validation', () => {
  let page;
  let txPage;
  // collectors for console messages, page errors and dialogs
  let consoleMessages;
  let consoleErrors;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    txPage = new TransactionPage(page);

    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // collect console messages and errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // collect unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // capture and auto-accept dialogs (alerts)
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      try {
        await dialog.accept();
      } catch (e) {
        // ignore accept errors
      }
    });

    await txPage.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial Idle state: balances initialized and demo-ready log present', async () => {
    // This validates S0_Idle entry action updateBalances() and evidence log
    // Check initial balances are as defined in the implementation
    const a = await txPage.getBalanceA();
    const b = await txPage.getBalanceB();

    expect(a).toBeCloseTo(1000.0, 2);
    expect(b).toBeCloseTo(500.0, 2);

    // The log should contain the demo-ready message per implementation evidence
    const log = await txPage.getLogText();
    expect(log).toContain("Demo ready. Set an amount and click 'Transfer from A to B' to start a new transaction.");

    // There should be no unhandled page errors on initial load
    expect(pageErrors.length).toBe(0);
    // There should be no console error messages
    expect(consoleErrors.length).toBe(0);
  });

  test('Successful transfer commits transaction and updates balances (S0 -> S1 -> S2)', async () => {
    // This validates the transition: Idle -> Transaction Started -> Transaction Committed
    // and the associated entry actions/logs and balance updates.

    // Ensure initial balances
    const initialA = await txPage.getBalanceA();
    const initialB = await txPage.getBalanceB();
    expect(initialA).toBeCloseTo(1000.0, 2);
    expect(initialB).toBeCloseTo(500.0, 2);

    // Set a valid transfer amount
    await txPage.setAmount(100);

    // Click transfer and wait for transfer button to be re-enabled (operation finished)
    await txPage.clickTransfer();

    // After clicking, the transfer button is disabled during operation. Wait until it's enabled again.
    await page.waitForFunction(
      (sel) => document.querySelector(sel) && !document.querySelector(sel).disabled,
      txPage.transferBtnSelector
    );

    // Verify logs contain transaction lifecycle messages
    const logText = await txPage.getLogText();
    expect(logText).toContain('Transaction started. Snapshot:');
    expect(logText).toContain('Debited $100.00 from Account A');
    expect(logText).toContain('Credited $100.00 to Account B');
    expect(logText).toContain('Transaction committed: balances updated.');
    expect(logText).toContain('Transfer successful.');

    // Balances must be updated atomically: A decreased by 100, B increased by 100
    const afterA = await txPage.getBalanceA();
    const afterB = await txPage.getBalanceB();
    expect(afterA).toBeCloseTo(initialA - 100, 2);
    expect(afterB).toBeCloseTo(initialB + 100, 2);

    // No unhandled page errors or console errors occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // There should be no dialogs for a successful transfer (dialogs captured are alerts, but success path does not alert)
    // If any dialogs were displayed, they were auto-accepted; assert there are none for success
    const anyAlertAboutFailure = dialogs.some(d => d.message && d.message.includes('Transfer failed'));
    expect(anyAlertAboutFailure).toBeFalsy();
  });

  test('Insufficient funds triggers debit failure and rollback (S1 -> S3)', async () => {
    // This validates the DebitFailed transition: an attempted debit exceeding the balance
    // should cause an exception, rollback, and no change to final balances.

    // Reset page by reloading to get original baseline balances
    await page.reload({ waitUntil: 'load' });

    // Recreate page object references to DOM elements after reload
    txPage = new TransactionPage(page);

    // Ensure starting balances are back to original baseline
    const startA = await txPage.getBalanceA();
    const startB = await txPage.getBalanceB();

    expect(startA).toBeCloseTo(1000.0, 2);
    expect(startB).toBeCloseTo(500.0, 2);

    // Use an amount larger than Account A's balance to trigger insufficient funds
    await txPage.setAmount(2000);

    // Click transfer - this should cause internal tx.debit to throw an Error which is caught by the click handler
    await txPage.clickTransfer();

    // The page click handler will show an alert with the failure message; it was auto-accepted and captured in dialogs
    // Wait for the log to contain the rollback message
    await txPage.waitForLogContains('Transaction rolled back: no changes applied.', 2000);

    // Check captured dialogs include Transfer failed message with Insufficient funds
    const failureDialog = dialogs.find(d => d.message.includes('Transfer failed'));
    expect(failureDialog).toBeDefined();
    expect(failureDialog.message).toContain('Insufficient funds');

    // Verify the log contains evidence for debit failure and rollback
    const logText1 = await txPage.getLogText();
    expect(logText).toContain('Transaction started. Snapshot:');
    expect(logText).toContain('Transaction rolled back: no changes applied.');
    expect(logText).toContain('Transfer failed: Insufficient funds');

    // Balances must be unchanged because rollback prevents applying localState
    const afterA1 = await txPage.getBalanceA();
    const afterB1 = await txPage.getBalanceB();
    expect(afterA).toBeCloseTo(startA, 2);
    expect(afterB).toBeCloseTo(startB, 2);

    // No unhandled page errors or console errors occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Invalid (non-positive) amount prevents transaction from starting', async () => {
    // This validates behavior when user enters an invalid transfer amount (<= 0 or NaN)
    // The UI shows an alert and does not start a transaction.

    // Reload page to reset state
    await page.reload({ waitUntil: 'load' });
    txPage = new TransactionPage(page);

    // Ensure baseline balances
    const startA1 = await txPage.getBalanceA();
    const startB1 = await txPage.getBalanceB();
    expect(startA).toBeCloseTo(1000.0, 2);
    expect(startB).toBeCloseTo(500.0, 2);

    // Try zero amount
    await txPage.setAmount(0);
    await txPage.clickTransfer();

    // The page shows an alert "Please enter a valid positive transfer amount" which we auto-accept
    // Confirm we captured the dialog with that message
    const invalidDialog = dialogs.find(d => d.message.includes('Please enter a valid positive transfer amount'));
    expect(invalidDialog).toBeDefined();

    // Verify no "Transaction started" log entry was appended after this invalid attempt
    const logText2 = await txPage.getLogText();
    // The demo-ready message exists; ensure there's no "Transaction started" appended after it
    // (There might be an earlier "Demo ready..." message only)
    const occurrencesOfTransactionStarted = (logText.match(/Transaction started\. Snapshot:/g) || []).length;
    expect(occurrencesOfTransactionStarted).toBe(0);

    // Balances should remain unchanged
    const afterA2 = await txPage.getBalanceA();
    const afterB2 = await txPage.getBalanceB();
    expect(afterA).toBeCloseTo(startA, 2);
    expect(afterB).toBeCloseTo(startB, 2);

    // No unhandled page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Credit error path is not reachable with current validations; assert no credit error observed', async () => {
    // The implementation's credit() throws if amount <= 0.
    // However, the click handler validates amount > 0 before starting the transaction,
    // so this CreditFailed FSM transition should not occur with the page as implemented.
    // We assert that no log contains 'Credit amount must be positive' during a valid run.

    // Reload and run a normal valid transfer
    await page.reload({ waitUntil: 'load' });
    txPage = new TransactionPage(page);

    await txPage.setAmount(50);
    await txPage.clickTransfer();

    // Wait for commit log to show up
    await txPage.waitForLogContains('Transaction committed: balances updated.', 2000);

    const logText3 = await txPage.getLogText();
    expect(logText).not.toContain('Credit amount must be positive');

    // Confirm balances updated accordingly (sanity check)
    const a1 = await txPage.getBalanceA();
    const b1 = await txPage.getBalanceB();
    // After running previous tests and reloads, balances may have changed from baseline;
    // ensure they reflect a delta of -50/+50 from their values prior to this click.
    // For robustness, we simply assert that commit occurred and no credit error logged.
    expect(logText).toContain('Transfer successful.');

    // No unhandled page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console messages and page errors across interactions (diagnostic)', async () => {
    // This test explicitly collects console messages and page errors during interactions
    // and asserts that there are no unexpected runtime errors like ReferenceError/SyntaxError/TypeError

    // Reload to have a clean slate
    await page.reload({ waitUntil: 'load' });
    txPage = new TransactionPage(page);

    // Perform a sequence: invalid amount, then valid transfer, then insufficient funds
    await txPage.setAmount(0);
    await txPage.clickTransfer();

    await txPage.setAmount(10);
    await txPage.clickTransfer();
    await page.waitForFunction(
      (sel) => document.querySelector(sel) && !document.querySelector(sel).disabled,
      txPage.transferBtnSelector
    );

    await txPage.setAmount(999999); // large amount to cause insufficient funds
    await txPage.clickTransfer();

    // Allow logs and dialogs to settle
    await txPage.waitForLogContains('Transaction rolled back: no changes applied.', 2000).catch(() => { /* may already exist */ });

    // Assert there are no uncaught page errors of types ReferenceError, SyntaxError, TypeError
    // pageErrors contains Error objects for uncaught exceptions; we expect none.
    expect(pageErrors.length).toBe(0);

    // Also assert there were no console 'error' messages emitted
    expect(consoleErrors.length).toBe(0);

    // Collect a summary for diagnostic assertion: there should be at least one console message or log updates
    // (logs are written to DOM, console may be empty). Ensure that the log area has content.
    const logText4 = await txPage.getLogText();
    expect(logText.length).toBeGreaterThan(0);
  });
});