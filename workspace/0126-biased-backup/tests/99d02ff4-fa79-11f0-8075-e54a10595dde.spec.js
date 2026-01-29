import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d02ff4-fa79-11f0-8075-e54a10595dde.html';

// Page Object encapsulating interactions with the Transaction System page
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

  async setAmount(value) {
    // value can be string or number
    await this.page.fill('#amount', String(value));
  }

  async getAmountValue() {
    return await this.page.$eval('#amount', (el) => el.value);
  }

  async setTransactionType(typeValue) {
    // typeValue expected to be 'debit' or 'credit'
    await this.page.selectOption('#transactionType', typeValue);
  }

  async clickSubmit() {
    await this.page.click("button[onclick='performTransaction()']");
  }

  async clickReset() {
    await this.page.click("button[onclick='resetTransaction()']");
  }

  async clickCalculate() {
    await this.page.click("button[onclick='calculateBalance()']");
  }

  async getBalanceText() {
    return await this.page.$eval('#balance', (el) => el.textContent.trim());
  }

  async getHistoryEntries() {
    return await this.page.$$eval('#transactionHistory li', (nodes) =>
      nodes.map((n) => n.textContent.trim())
    );
  }

  async getWindowBalance() {
    return await this.page.evaluate(() => window.balance);
  }
}

test.describe('Interactive Transaction System (Application ID: 99d02ff4-fa79-11f0-8075-e54a10595dde)', () => {
  // Collect console messages and uncaught page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Basic initial state validations corresponding to S0_Idle
  test('S0 Idle: page loads with initial elements and default state', async ({ page }) => {
    // Arrange
    const tx = new TransactionPage(page);

    // Act
    await tx.goto();

    // Assert - verify UI elements exist and initial values
    await expect(page.locator("button[onclick='performTransaction()']")).toBeVisible();
    await expect(page.locator("button[onclick='resetTransaction()']")).toBeVisible();
    await expect(page.locator("button[onclick='calculateBalance()']")).toBeVisible();

    const amountVal = await tx.getAmountValue();
    expect(amountVal).toBe('0'); // amount input default value

    const history = await tx.getHistoryEntries();
    expect(history.length).toBe(0); // no history entries initially

    const balanceText = await tx.getBalanceText();
    expect(balanceText).toBe('Current Balance: 0'); // initial balance text

    // No unexpected console errors or uncaught exceptions on initial render
    // (we observe and assert that no console messages of type 'error' and no page errors)
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Transactions and State Transitions (S0 -> S1 -> S3 -> S2)', () => {
    test('Submit Transaction (credit): transitions to Transaction Performed, updates history and resets amount', async ({ page }) => {
      // This test validates:
      // - performTransaction() pushes history entry ("Credited: X")
      // - amount input is reset to 0 after submission
      // - internal balance variable updated (S1 entry action updateHistory is reflected)
      const tx = new TransactionPage(page);
      await tx.goto();

      // Set amount and type to credit
      await tx.setAmount(100);
      await tx.setTransactionType('credit');

      // Submit transaction (S0 -> S1)
      await tx.clickSubmit();

      // After submit, history should have one entry with credited amount
      const history = await tx.getHistoryEntries();
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history[history.length - 1]).toBe('Credited: 100');

      // Amount input should be reset to '0' as specified by the FSM observable
      const amountVal = await tx.getAmountValue();
      expect(amountVal).toBe('0');

      // The internal balance variable should have been updated to 100
      const wndBalance = await tx.getWindowBalance();
      expect(wndBalance).toBe(100);

      // DOM balance paragraph is only updated after calculateBalance() (S3),
      // so ensure it's still the previous displayed value (still may be 0 until calculateBalance)
      const balanceText = await tx.getBalanceText();
      // the implementation doesn't update the balance DOM in performTransaction, so it should still be 'Current Balance: 0'
      // but allow either 0 or updated if implementation updates; check at least the DOM is present
      expect(balanceText.startsWith('Current Balance:')).toBeTruthy();

      // Also assert no console errors occurred during this action
      const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Submit Transaction (debit) then Calculate Balance: negative balance and DOM updated (S1 -> S3)', async ({ page }) => {
      // This test validates a debit transaction applied and shown after calculateBalance()
      const tx = new TransactionPage(page);
      await tx.goto();

      // Start clean: reset to ensure deterministic state
      await tx.clickReset();

      // Submit credit 50
      await tx.setAmount(50);
      await tx.setTransactionType('credit');
      await tx.clickSubmit();

      // Submit debit 20
      await tx.setAmount(20);
      await tx.setTransactionType('debit');
      await tx.clickSubmit();

      // At this point internal balance should be 30
      const wndBalance = await tx.getWindowBalance();
      expect(wndBalance).toBe(30);

      // Trigger calculateBalance() to transition to S3 and update DOM
      await tx.clickCalculate();

      const balanceText = await tx.getBalanceText();
      expect(balanceText).toBe('Current Balance: 30');

      // History should contain the two entries in order
      const history = await tx.getHistoryEntries();
      // last two entries reflect our operations
      expect(history.slice(-2)).toEqual(['Credited: 50', 'Debited: 20']);

      // No console errors
      const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Reset Transaction (S0 -> S2): clears history, resets balance and amount', async ({ page }) => {
      // This test validates that resetTransaction() clears the internal state and updates DOM accordingly
      const tx = new TransactionPage(page);
      await tx.goto();

      // Create some state first
      await tx.setAmount(10);
      await tx.setTransactionType('credit');
      await tx.clickSubmit();

      await tx.setAmount(5);
      await tx.setTransactionType('debit');
      await tx.clickSubmit();

      // Ensure there's history and non-zero internal balance
      let historyBefore = await tx.getHistoryEntries();
      expect(historyBefore.length).toBeGreaterThanOrEqual(2);
      const balanceBefore = await tx.getWindowBalance();
      expect(typeof balanceBefore).toBe('number');

      // Now reset
      await tx.clickReset();

      // Internal variables should match S2 evidence: balance = 0 and transactionHistory = []
      const balanceAfter = await tx.getWindowBalance();
      expect(balanceAfter).toBe(0);

      const historyAfter = await tx.getHistoryEntries();
      expect(historyAfter.length).toBe(0);

      // DOM balance text should be reset to 'Current Balance: 0'
      const balanceText = await tx.getBalanceText();
      expect(balanceText).toBe('Current Balance: 0');

      // Amount input should be reset to 0 as well
      const amountVal = await tx.getAmountValue();
      expect(amountVal).toBe('0');

      // No console errors
      const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Submitting empty amount leads to NaN handling and creates NaN history entry', async ({ page }) => {
      // This test exercises an edge case where parseFloat on empty string produces NaN.
      // We validate how the application handles it (expecting NaN in balance and in displayed history entry).
      const tx = new TransactionPage(page);
      await tx.goto();

      // Start clean
      await tx.clickReset();

      // Set amount to empty string (simulate user clearing the numeric input)
      await tx.setAmount(''); // page.fill with empty string
      await tx.setTransactionType('credit');

      // Submit transaction
      await tx.clickSubmit();

      // History should contain an entry that includes 'NaN' due to parseFloat('') === NaN
      const history = await tx.getHistoryEntries();
      expect(history.length).toBeGreaterThanOrEqual(1);
      // The newest entry should contain 'NaN'
      const lastEntry = history[history.length - 1];
      expect(lastEntry).toMatch(/NaN/);

      // Internal balance should be NaN
      const wndBalance = await tx.getWindowBalance();
      // JavaScript NaN is not equal to itself; use isNaN check
      expect(Number.isNaN(wndBalance)).toBe(true);

      // calculateBalance() should display NaN in the DOM
      await tx.clickCalculate();
      const balanceText = await tx.getBalanceText();
      expect(balanceText).toBe('Current Balance: NaN');

      // This is an edge case; confirm there were no uncaught JS exceptions (pageerror)
      // Even though the app produced NaN, it's not necessarily a page error; assert none occurred
      const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Multiple rapid submits accumulate correctly and update history order', async ({ page }) => {
      // This test simulates rapid successive submissions and ensures transactionHistory order is preserved
      const tx = new TransactionPage(page);
      await tx.goto();

      // Reset to ensure deterministic start
      await tx.clickReset();

      // Rapidly submit three transactions
      await tx.setAmount(10);
      await tx.setTransactionType('credit');
      await tx.clickSubmit();

      await tx.setAmount(20);
      await tx.setTransactionType('debit');
      await tx.clickSubmit();

      await tx.setAmount(5);
      await tx.setTransactionType('credit');
      await tx.clickSubmit();

      // Verify internal balance is 10 - 20 + 5 = -5
      const wndBalance = await tx.getWindowBalance();
      expect(wndBalance).toBe(-5);

      // Calculate to update DOM and assert displayed balance
      await tx.clickCalculate();
      const balanceText = await tx.getBalanceText();
      expect(balanceText).toBe('Current Balance: -5');

      // Verify history entries are in the correct chronological order
      const history = await tx.getHistoryEntries();
      expect(history.slice(-3)).toEqual(['Credited: 10', 'Debited: 20', 'Credited: 5']);

      // No console errors from rapid submits
      const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No uncaught ReferenceError / SyntaxError / TypeError on normal flows', async ({ page }) => {
      // This test explicitly loads the page and performs common interactions while collecting
      // console and page errors to ensure there are no uncaught runtime errors during normal usage.
      const tx = new TransactionPage(page);
      await tx.goto();

      // Perform a set of typical interactions
      await tx.setAmount(1);
      await tx.setTransactionType('credit');
      await tx.clickSubmit();

      await tx.clickCalculate();
      await tx.clickReset();

      // After typical flows, ensure no console messages of 'error' type and no page errors captured
      const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
      // If any critical runtime errors exist, they will appear here as console error messages or pageErrors.
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});