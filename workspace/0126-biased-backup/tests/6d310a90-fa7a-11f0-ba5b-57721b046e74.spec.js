import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d310a90-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the ACID demo app
class AcidAppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.logSelector = '#transactionLog';
    this.stateTable = '#stateTable';
    // controls
    this.createAccountBtn = '#createAccount';
    this.initialBalanceInput = '#initialBalance';
    this.fromSelect = '#fromAccount';
    this.toSelect = '#toAccount';
    this.transferAmount = '#transferAmount';
    this.transferBtn = '#transfer';
    this.depositBtn = '#deposit';
    this.depositAmount = '#depositAmount';
    this.depositAccount = '#depositAccount';
    this.withdrawBtn = '#withdraw';
    this.withdrawAmount = '#withdrawAmount';
    this.withdrawAccount = '#withdrawAccount';
    this.toggleAllBtn = '#toggleAll';
    this.failRandomBtn = '#failRandom';
    this.concurrentBtn = '#concurrentTx';
    this.clearLogBtn = '#clearLog';
    this.testAtomicityBtn = '#testAtomicity';
    this.testConsistencyBtn = '#testConsistency';
    this.testIsolationBtn = '#testIsolation';
    this.testDurabilityBtn = '#testDurability';
    // ACID toggles
    this.atomicity = '#atomicity';
    this.consistency = '#consistency';
    this.isolation = '#isolation';
    this.durability = '#durability';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // ensure app has initialized and created initial accounts
    await this.waitForLogContains('Account 1 created', 3000);
  }

  // Helpers to interact
  async createAccount(initial = '100') {
    await this.page.fill(this.initialBalanceInput, String(initial));
    await this.page.click(this.createAccountBtn);
    await this.waitForLogContains('Account', 1000); // generic wait for account creation log
  }

  async performTransfer(fromValue, toValue, amount) {
    await this.page.selectOption(this.fromSelect, String(fromValue));
    await this.page.selectOption(this.toSelect, String(toValue));
    await this.page.fill(this.transferAmount, String(amount));
    await this.page.click(this.transferBtn);
  }

  async performDeposit(accountId, amount) {
    await this.page.selectOption(this.depositAccount, String(accountId));
    await this.page.fill(this.depositAmount, String(amount));
    await this.page.click(this.depositBtn);
  }

  async performWithdraw(accountId, amount) {
    await this.page.selectOption(this.withdrawAccount, String(accountId));
    await this.page.fill(this.withdrawAmount, String(amount));
    await this.page.click(this.withdrawBtn);
  }

  async toggleAllACID() {
    await this.page.click(this.toggleAllBtn);
  }

  async simulateRandomFailure() {
    await this.page.click(this.failRandomBtn);
  }

  async runConcurrentTransactions() {
    await this.page.click(this.concurrentBtn);
  }

  async clearLog() {
    await this.page.click(this.clearLogBtn);
  }

  async clickTestAtomicity() {
    await this.page.click(this.testAtomicityBtn);
  }

  async clickTestConsistency() {
    await this.page.click(this.testConsistencyBtn);
  }

  async clickTestIsolation() {
    await this.page.click(this.testIsolationBtn);
  }

  async clickTestDurability() {
    await this.page.click(this.testDurabilityBtn);
  }

  // Wait helpers
  async waitForLogContains(substring, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, text) => {
        const el = document.querySelector(sel);
        return el && el.innerText.includes(text);
      },
      this.logSelector,
      substring,
      { timeout }
    );
  }

  async getLogText() {
    return this.page.$eval(this.logSelector, el => el.innerText);
  }

  async getAccountRows() {
    return this.page.$$eval(`${this.stateTable} tr`, rows => {
      // skip header
      return rows.slice(1).map(r => Array.from(r.cells).map(c => c.textContent.trim()));
    });
  }

  async isCheckboxChecked(selector) {
    return this.page.$eval(selector, el => el.checked);
  }

  async waitForNoActiveLocks(timeout = 2000) {
    // Wait until all "Locked" column entries are "No"
    await this.page.waitForFunction(
      sel => {
        const rows = Array.from(document.querySelectorAll(`${sel} tr`)).slice(1);
        return rows.every(r => r.cells[2].textContent.trim() === 'No');
      },
      this.stateTable,
      { timeout }
    );
  }
}

test.describe('ACID Properties Interactive Demo - End-to-End', () => {
  test.describe.configure({ mode: 'serial' });

  // Keep track of page console messages and errors
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // capture console messages for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      // capture uncaught exceptions on the page
      pageErrors.push(error);
    });

    // Navigate and ensure the app initialized properly
    const app = new AcidAppPage(page);
    await app.goto();
  });

  test.afterEach(async ({ page }) => {
    // Sanity: capture any final console output to aid debugging if a test fails
    // Do not modify page behavior.
    if (pageErrors.length > 0) {
      // If there are page errors, include them in the test failure message via expect
      const combined = pageErrors.map(e => e.toString()).join('\n---\n');
      // Use a soft assertion to provide the error context (will still fail test)
      expect(pageErrors.length, `Page encountered uncaught errors:\n${combined}`).toBe(0);
    }
  });

  test('Initialization & Idle state: app loads and initial accounts are present', async ({ page }) => {
    // Validate Idle / S0_Idle behavior: updateUI() on init results in accounts and state table populated
    const app = new AcidAppPage(page);

    const rows = await app.getAccountRows();
    // The app init creates 3 accounts initially (1000,500,200)
    expect(rows.length).toBeGreaterThanOrEqual(3);
    // Check that the first row corresponds to Account 1 and correct balance format
    expect(rows[0][0]).toBe('1');
    expect(rows[0][1]).toMatch(/^\$\d+/);

    // Verify that creation logs were emitted for initial accounts
    const log = await app.getLogText();
    expect(log).toContain('Account 1 created');
    expect(log).toContain('Account 2 created');
    expect(log).toContain('Account 3 created');

    // No uncaught page errors should be present
    expect(pageErrors.length).toBe(0);
  });

  test('Create Account transition (S0 -> S1): creating a new account updates UI and log', async ({ page }) => {
    const app = new AcidAppPage(page);

    // Create a new account with initial balance 250
    await app.createAccount('250');

    // Verify the log contains the expected account creation message
    await app.waitForLogContains('created with balance $250');

    const log = await app.getLogText();
    expect(log).toContain('created with balance $250');

    // Verify state table includes new account with correct balance
    const rows = await app.getAccountRows();
    const found = rows.find(r => r[1] === '$250');
    expect(found).toBeTruthy();
  });

  test('Transfer transition success (S0 -> S2 -> S6): perform a valid transfer and commit', async ({ page }) => {
    const app = new AcidAppPage(page);

    // Use account 1 -> account 2, transfer a small amount that will succeed
    // Read balances first
    let rows = await app.getAccountRows();
    const acct1BalanceText = rows[0][1]; // "$1000" etc
    const acct2BalanceText = rows[1][1];

    const acct1Id = rows[0][0];
    const acct2Id = rows[1][0];

    const transferAmount = 50;

    // Perform transfer
    await app.performTransfer(acct1Id, acct2Id, transferAmount);

    // Wait for expected log messages indicating progress and commit
    await app.waitForLogContains(`Starting transfer of $${transferAmount} from Account ${acct1Id} to Account ${acct2Id}`);
    await app.waitForLogContains(`Deducted $${transferAmount} from Account ${acct1Id}`);
    await app.waitForLogContains(`Added $${transferAmount} to Account ${acct2Id}`);
    await app.waitForLogContains('Transfer committed successfully');

    // Confirm balances updated in state table
    rows = await app.getAccountRows();
    const newAcct1Row = rows.find(r => r[0] === acct1Id);
    const newAcct2Row = rows.find(r => r[0] === acct2Id);

    const parseBalance = txt => parseInt(txt.replace('$', '').trim(), 10);
    expect(parseBalance(newAcct1Row[1])).toBe(parseBalance(acct1BalanceText) - transferAmount);
    expect(parseBalance(newAcct2Row[1])).toBe(parseBalance(acct2BalanceText) + transferAmount);
  });

  test('Transfer transition failure (S2 -> S5): insufficient funds should trigger Transaction Failed and rollback (if atomicity on)', async ({ page }) => {
    const app = new AcidAppPage(page);

    // Ensure consistency toggle is ON so insufficient funds throw error
    const consistencyOn = await app.isCheckboxChecked(app.consistency);
    expect(consistencyOn).toBe(true);

    // Pick an account with small balance and attempt to transfer more than it has
    const rows = await app.getAccountRows();
    const source = rows[2]; // account 3 often has smallest initial balance (200)
    const dest = rows[0];

    const sourceId = source[0];
    const destId = dest[0];
    const sourceBalance = parseInt(source[1].replace('$', ''), 10);

    // Attempt to transfer more than available -> should cause "Insufficient funds"
    const excessiveAmount = sourceBalance + 1000;
    await app.performTransfer(sourceId, destId, excessiveAmount);

    // Wait for failure log
    await app.waitForLogContains('Transaction failed: Insufficient funds');

    // Because atomicity is likely ON by default, balances should be unchanged after rollback
    const postRows = await app.getAccountRows();
    const postSource = postRows.find(r => r[0] === sourceId);
    expect(parseInt(postSource[1].replace('$', ''), 10)).toBe(sourceBalance);
  });

  test('Deposit transition (S0 -> S3 -> S6): deposit increases account balance and logs commit/durability', async ({ page }) => {
    const app = new AcidAppPage(page);

    // Deposit to account 1
    const rowsBefore = await app.getAccountRows();
    const acct1Id = rowsBefore[0][0];
    const beforeBalance = parseInt(rowsBefore[0][1].replace('$', ''), 10);

    const depositAmount = 123;
    await app.performDeposit(acct1Id, depositAmount);

    // Wait for expected logs
    await app.waitForLogContains(`Starting deposit of $${depositAmount} to Account ${acct1Id}`);
    await app.waitForLogContains('Deposit committed successfully');

    // If durability is checked, app logs "Changes made durable"
    const durabilityOn = await app.isCheckboxChecked(app.durability);
    if (durabilityOn) {
      await app.waitForLogContains('Changes made durable');
    }

    const rowsAfter = await app.getAccountRows();
    const acct1After = rowsAfter.find(r => r[0] === acct1Id);
    expect(parseInt(acct1After[1].replace('$', ''), 10)).toBe(beforeBalance + depositAmount);
  });

  test('Withdraw transition (S0 -> S4 -> S6/S5): withdraw success and failure edge cases', async ({ page }) => {
    const app = new AcidAppPage(page);

    // Successful withdrawal
    const rows = await app.getAccountRows();
    const acctId = rows[1][0];
    const before = parseInt(rows[1][1].replace('$', ''), 10);

    const withdrawAmount = Math.min(50, before); // safe amount
    await app.performWithdraw(acctId, withdrawAmount);

    await app.waitForLogContains(`Starting withdrawal of $${withdrawAmount} from Account ${acctId}`);
    await app.waitForLogContains('Withdrawal committed successfully');

    const afterRows = await app.getAccountRows();
    const acctAfter = afterRows.find(r => r[0] === acctId);
    expect(parseInt(acctAfter[1].replace('$', ''), 10)).toBe(before - withdrawAmount);

    // Failure: attempt to withdraw more than available when consistency is ON
    // Ensure consistency is ON
    const consistencyOn = await app.isCheckboxChecked(app.consistency);
    expect(consistencyOn).toBe(true);

    const largeAmount = parseInt(acctAfter[1].replace('$', ''), 10) + 10000;
    await app.performWithdraw(acctId, largeAmount);

    // Should log transaction failed due to Insufficient funds
    await app.waitForLogContains('Transaction failed: Insufficient funds');
  });

  test('Toggle All ACID properties and verify toggles and log message', async ({ page }) => {
    const app = new AcidAppPage(page);

    // Read current toggles
    const beforeAtomic = await app.isCheckboxChecked(app.atomicity);
    const beforeConsistency = await app.isCheckboxChecked(app.consistency);
    const beforeIsolation = await app.isCheckboxChecked(app.isolation);
    const beforeDurability = await app.isCheckboxChecked(app.durability);

    // Toggle all
    await app.toggleAllACID();

    // The button toggles to either enable all or disable all depending on current state.
    // We at least expect a log indicating action.
    await app.waitForLogContains('All ACID properties');

    const log = await app.getLogText();
    expect(log).toMatch(/All ACID properties (enabled|disabled)/);

    // The toggles should now be all equal (either all true or all false)
    const atomic = await app.isCheckboxChecked(app.atomicity);
    const consistency = await app.isCheckboxChecked(app.consistency);
    const isolation = await app.isCheckboxChecked(app.isolation);
    const durability = await app.isCheckboxChecked(app.durability);

    expect(atomic).toBe(consistency);
    expect(consistency).toBe(isolation);
    expect(isolation).toBe(durability);

    // Restore original toggles for subsequent tests (toggle again if needed)
    // If they differ from original, toggle to restore.
    if (atomic !== beforeAtomic) {
      await app.toggleAllACID();
      await app.waitForLogContains('All ACID properties');
    }
  });

  test('Simulate Random Failure and Run Concurrent Transactions', async ({ page }) => {
    const app = new AcidAppPage(page);

    // Simulate random failure - expect a "SYSTEM FAILURE SIMULATED" and "recovered" message
    await app.simulateRandomFailure();
    await app.waitForLogContains('SYSTEM FAILURE SIMULATED - Transactions may fail');
    await app.waitForLogContains('System recovered from failure', 4000);

    // Run concurrent transactions and verify multiple transfer logs are emitted
    await app.runConcurrentTransactions();
    await app.waitForLogContains('Starting 5 concurrent transactions...');
    // Wait for several transfer start logs to appear (there are 5 transfers staggered)
    await app.waitForLogContains('Starting transfer of', 5000);

    // At least one commit or failed transaction should have occurred in the logs
    const logText = await app.getLogText();
    expect(/Transfer committed successfully|Transaction failed:/.test(logText)).toBe(true);
  });

  test('ACID educational tests: TestAtomicity, TestConsistency, TestIsolation, TestDurability flows', async ({ page }) => {
    const app = new AcidAppPage(page);

    // Test Atomicity: this function disables atomicity temporarily and re-enables it.
    await app.clickTestAtomicity();
    await app.waitForLogContains('Testing Atomicity - Disabled atomicity', 2000);
    // Wait for the test to re-enable atomicity and finish
    await app.waitForLogContains('Atomicity testing complete. Atomicity re-enabled.', 3000);

    // Test Consistency: disables consistency and attempts over-withdrawal
    await app.clickTestConsistency();
    await app.waitForLogContains('Testing Consistency - Disabled consistency',