import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d1222-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the transaction demo page
class TransactionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      balance1: '#balance1',
      balance2: '#balance2',
      amount: '#amount',
      transferBtn: '#transferBtn',
      transferWithErrorBtn: '#transferWithErrorBtn',
      logEntries: '#log div',
      logRoot: '#log',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getBalances() {
    const aText = await this.page.locator(this.selectors.balance1).textContent();
    const bText = await this.page.locator(this.selectors.balance2).textContent();
    return {
      accountA: parseInt(aText || '0', 10),
      accountB: parseInt(bText || '0', 10),
    };
  }

  async setAmount(value) {
    await this.page.fill(this.selectors.amount, String(value));
    // blur to ensure any change events processed (though not required here)
    await this.page.locator(this.selectors.amount).evaluate((el) => el.blur());
  }

  async clickTransfer() {
    await this.page.click(this.selectors.transferBtn);
  }

  async clickTransferWithError() {
    await this.page.click(this.selectors.transferWithErrorBtn);
  }

  async getLogMessages() {
    return this.page.$$eval(this.selectors.logEntries, (nodes) =>
      nodes.map((n) => n.textContent || '')
    );
  }

  async waitForLogMessage(substring, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, substr) => Array.from(document.querySelectorAll(sel)).some((n) => n.textContent && n.textContent.includes(substr)),
      this.selectors.logEntries,
      substring,
      { timeout }
    );
  }

  async getLastLogEntryText() {
    const count = await this.page.locator(this.selectors.logEntries).count();
    if (count === 0) return '';
    return this.page.locator(this.selectors.logEntries).nth(count - 1).textContent();
  }

  async getLogEntryClasses() {
    return this.page.$$eval(this.selectors.logEntries, (nodes) => nodes.map((n) => n.className || ''));
  }
}

// Collect console and page errors for assertions
test.describe.configure({ mode: 'serial' });

test.describe('Transaction Demonstration - FSM based tests', () => {
  let pageErrors = [];
  let consoleMessages = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors for each test
    pageErrors = [];
    consoleMessages = [];
    consoleErrors = [];

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages and errors
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });
  });

  // Describe initial state behavior (S0_Idle)
  test.describe('Initial State - S0_Idle', () => {
    test('should load the page and display initial balances (updateBalances on entry)', async ({ page }) => {
      const txn = new TransactionPage(page);
      await txn.goto();

      // Verify initial balances are displayed correctly
      const balances = await txn.getBalances();
      expect(balances.accountA).toBe(1000);
      expect(balances.accountB).toBe(500);

      // No transaction log messages at load except possibly initialization; ensure no uncaught exceptions
      expect(pageErrors.length).toBe(0);
      // There are no console errors produced by the app on correct load
      expect(consoleErrors.length).toBe(0);
    });
  });

  // Successful transaction path (S0 -> S1 -> S2)
  test.describe('Successful Transaction (S1 -> S2)', () => {
    test('should perform a successful transfer and commit the transaction', async ({ page }) => {
      const txn = new TransactionPage(page);
      await txn.goto();

      // Start a transfer of $200 from Account A to Account B
      await txn.setAmount(200);
      await txn.clickTransfer();

      // Wait for key log messages to appear in the transaction log
      await txn.waitForLogMessage('Starting transaction: Transfer $200');
      await txn.waitForLogMessage('Transaction started');
      await txn.waitForLogMessage('Withdrawn $200');
      await txn.waitForLogMessage('Deposited $200');
      await txn.waitForLogMessage('Transaction committed successfully');

      // Verify order: "Transaction started" should appear before "Transaction committed successfully"
      const logs = await txn.getLogMessages();
      const idxStarted = logs.findIndex((t) => t.includes('Transaction started'));
      const idxCommitted = logs.findIndex((t) => t.includes('Transaction committed successfully'));
      expect(idxStarted).toBeGreaterThanOrEqual(0);
      expect(idxCommitted).toBeGreaterThanOrEqual(0);
      expect(idxStarted).toBeLessThan(idxCommitted);

      // Verify balances updated correctly after commit
      const balances = await txn.getBalances();
      expect(balances.accountA).toBe(1000 - 200); // 800
      expect(balances.accountB).toBe(500 + 200);  // 700

      // Ensure no uncaught page errors occurred during the transaction
      expect(pageErrors.length).toBe(0);
    });
  });

  // Error scenarios (S1 -> S3)
  test.describe('Transaction Failure Scenarios (S1 -> S3)', () => {
    test('should handle simulated network error (transferWithError) and log failure and rollback entries', async ({ page }) => {
      const txn = new TransactionPage(page);
      await txn.goto();

      // Use an amount that is within the available balance so withdrawal happens before simulated failure
      await txn.setAmount(150);
      await txn.clickTransferWithError();

      // Wait and assert for expected failure-related log messages
      await txn.waitForLogMessage('Starting transaction: Transfer $150');
      await txn.waitForLogMessage('Transaction started');
      await txn.waitForLogMessage('Withdrawn $150');
      await txn.waitForLogMessage('Transaction failed: Simulated transaction failure (network error)');
      await txn.waitForLogMessage('Rolling back transaction...');
      await txn.waitForLogMessage('Transaction rolled back');

      // Inspect balances after simulated network error.
      // Note: The implementation withdraws before throwing and does not restore balances,
      // so the demo will reflect the withdrawn amount despite the "rollback" message.
      const balances = await txn.getBalances();
      expect(balances.accountA).toBe(1000 - 150); // 850 (withdrawn but not restored)
      expect(balances.accountB).toBe(500);       // still 500 (deposit didn't happen)

      // Ensure no uncaught exceptions bubbled up
      expect(pageErrors.length).toBe(0);
    });

    test('should handle insufficient funds error and not change balances', async ({ page }) => {
      const txn = new TransactionPage(page);
      await txn.goto();

      // Set amount greater than account A's balance to trigger "Insufficient funds" before withdrawal
      await txn.setAmount(2000);
      await txn.clickTransfer();

      // Wait and assert for expected error messages
      await txn.waitForLogMessage('Starting transaction: Transfer $2000');
      await txn.waitForLogMessage('Transaction started');
      await txn.waitForLogMessage('Transaction failed: Insufficient funds in Account A');
      await txn.waitForLogMessage('Rolling back transaction...');
      await txn.waitForLogMessage('Transaction rolled back');

      // Because the throw happens before withdrawal, balances should remain unchanged
      const balances = await txn.getBalances();
      expect(balances.accountA).toBe(1000);
      expect(balances.accountB).toBe(500);

      // Ensure error message entries have the error styling (class 'error')
      const logClasses = await txn.getLogEntryClasses();
      // There should be at least one entry with class containing 'error' (the failed transaction message)
      expect(logClasses.some((c) => c.includes('error'))).toBeTruthy();

      // No uncaught exceptions
      expect(pageErrors.length).toBe(0);
    });
  });

  // Edge cases and validation checks
  test.describe('Edge cases and validations', () => {
    test('should validate amount input and show a validation error for zero or invalid amount', async ({ page }) => {
      const txn = new TransactionPage(page);
      await txn.goto();

      // Set invalid amount 0 and click transfer
      await txn.setAmount(0);
      await txn.clickTransfer();

      // Expect a validation error message in the log
      await txn.waitForLogMessage('Please enter a valid positive amount');

      const logs = await txn.getLogMessages();
      expect(logs.some((t) => t.includes('Please enter a valid positive amount'))).toBeTruthy();

      // The error should be styled with the 'error' class
      const classes = await txn.getLogEntryClasses();
      expect(classes.some((c) => c.includes('error'))).toBeTruthy();

      // Balances should remain unchanged
      const balances = await txn.getBalances();
      expect(balances.accountA).toBe(1000);
      expect(balances.accountB).toBe(500);

      // No uncaught exceptions
      expect(pageErrors.length).toBe(0);
    });
  });

  // General assertions about console/page errors for the whole test suite run
  test('should not emit uncaught page errors or console.errors during normal operations', async ({ page }) => {
    // This test will perform a simple sequence and assert there were no uncaught exceptions recorded by the browser
    const txn = new TransactionPage(page);
    await txn.goto();

    // Do a successful small transaction
    await txn.setAmount(50);
    await txn.clickTransfer();

    await txn.waitForLogMessage('Transaction committed successfully');

    // Assert no uncaught page-level exceptions
    expect(pageErrors.length).toBe(0);

    // Assert no console.error messages recorded
    expect(consoleErrors.length).toBe(0);
  });
});