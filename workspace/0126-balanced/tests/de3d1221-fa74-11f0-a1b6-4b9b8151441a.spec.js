import { test, expect } from '@playwright/test';

// URL to the HTML application under test
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d1221-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object Model for the ACID demo app
class AcidDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.atomicSuccessBtn = page.locator('button[onclick="demoAtomicity(true)"]');
    this.atomicFailBtn = page.locator('button[onclick="demoAtomicity(false)"]');
    this.consistencyBtn = page.locator('button[onclick="demoConsistency()"]');
    this.isolationBtn = page.locator('button[onclick="demoIsolation()"]');
    this.durabilityBtn = page.locator('button[onclick="demoDurability()"]');

    this.atomicityResult = page.locator('#atomicityResult');
    this.consistencyResult = page.locator('#consistencyResult');
    this.isolationResult = page.locator('#isolationResult');
    this.durabilityResult = page.locator('#durabilityResult');

    this.transactionLog = page.locator('#transactionLog');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickAtomicity(success = true) {
    if (success) {
      await this.atomicSuccessBtn.click();
    } else {
      await this.atomicFailBtn.click();
    }
  }

  async clickConsistency() {
    await this.consistencyBtn.click();
  }

  async clickIsolation() {
    await this.isolationBtn.click();
  }

  async clickDurability() {
    await this.durabilityBtn.click();
  }

  async getTransactionLogEntries() {
    // returns array of { text, className }
    return await this.transactionLog.evaluate((el) => {
      const children = Array.from(el.children || []);
      return children.map(c => ({ text: c.textContent?.trim() || '', className: c.className || '' }));
    });
  }

  async getAtomicityResultText() {
    return (await this.atomicityResult.textContent())?.trim() || '';
  }

  async getConsistencyResultText() {
    return (await this.consistencyResult.textContent())?.trim() || '';
  }

  async getIsolationResultText() {
    return (await this.isolationResult.textContent())?.trim() || '';
  }

  async getDurabilityResultText() {
    return (await this.durabilityResult.textContent())?.trim() || '';
  }
}

// Global listeners for console and page errors; will be set per test
let consoleMessages = [];
let pageErrors = [];

test.describe('ACID Properties Interactive App - Comprehensive E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Reset listeners and arrays for each test
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture console messages to assert if any unexpected errors/warnings surface
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // capture unhandled page errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });
  });

  test.describe('Initial Load / Idle State (S0_Idle)', () => {
    test('renders main heading and initial layout; no runtime errors on load', async ({ page }) => {
      // Validate that the page renders the Idle state's evidence and that no page errors occur on load.
      const app = new AcidDemoPage(page);
      await app.goto();

      // The FSM's S0_Idle evidence includes the H1 header text
      await expect(app.header).toHaveText('ACID Properties in Database Transactions');

      // Transaction log should be empty at initial load
      const logs = await app.getTransactionLogEntries();
      expect(logs.length).toBe(0);

      // No unhandled page errors should have fired during load
      expect(pageErrors.length).toBe(0);

      // Collect console messages for debugging expectations - ensure there are no 'error' type messages emitted
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });
  });

  test.describe('Atomicity (S1_Atomicity_Success & S2_Atomicity_Failure)', () => {
    test('Successful atomic transaction shows success message and logs success', async ({ page }) => {
      // This test validates the SuccessfulAtomicTransaction transition to S1_Atomicity_Success:
      // - The DOM contains the success message: Transaction committed successfully!
      // - The transaction log contains a success entry describing the atomic funds transfer.
      const app1 = new AcidDemoPage(page);
      await app.goto();

      // Click the Successful Atomic Transaction button
      await app.clickAtomicity(true);

      // Assert the success message appears in the atomicity result container
      await expect(app.atomicityResult.locator('p.success')).toHaveText('Transaction committed successfully!');

      // Verify transaction log contains the success entry for atomic transfer
      const logs1 = await app.getTransactionLogEntries();
      // Expect at least one entry and the last entry to be the atomic success
      expect(logs.length).toBeGreaterThan(0);
      const last = logs[logs.length - 1];
      expect(last.text).toContain('Funds transfer completed atomically');
      expect(last.className).toContain('success');

      // There should be no unhandled errors
      expect(pageErrors.length).toBe(0);
    });

    test('Failed atomic transaction shows failure messages and logs rollback', async ({ page }) => {
      // This test validates the FailedAtomicTransaction transition to S2_Atomicity_Failure:
      // - DOM contains the failure message: Transaction failed - no changes applied
      // - Transaction log contains a failure entry.
      const app2 = new AcidDemoPage(page);
      await app.goto();

      // Click the Failed Atomic Transaction button
      await app.clickAtomicity(false);

      // The failure messages are appended within catch block. Assert that the known failure evidence appears.
      await expect(app.atomicityResult.locator('p.failure')).toContainText('Transaction failed - no changes applied');

      // Verify the transaction log has a corresponding failure entry
      const logs2 = await app.getTransactionLogEntries();
      expect(logs.length).toBeGreaterThan(0);
      const last1 = logs[logs.length - 1];
      expect(last.text).toContain('Funds transfer failed and was rolled back');
      expect(last.className).toContain('failure');

      // Ensure no unhandled page errors occurred during the handled exception
      expect(pageErrors.length).toBe(0);

      // Also ensure the DOM contains the explicit caught error message for transparency
      await expect(app.atomicityResult).toContainText('Error: Network failure during transfer');
      await expect(app.atomicityResult).toContainText('Rolling back transaction...');
    });
  });

  test.describe('Consistency (S3_Consistency_Success & S4_Consistency_Failure)', () => {
    test('Successful consistency demonstration updates balance and logs success', async ({ page }) => {
      // This test validates S3_Consistency_Success when demoConsistency() succeeds:
      // - The DOM shows "Withdrawal successful! New balance: $800"
      // - A success transaction log entry is created.
      const app3 = new AcidDemoPage(page);
      await app.goto();

      // Trigger consistency once (200 withdrawal from 1000 -> 800)
      await app.clickConsistency();

      // Assert success message with expected updated balance
      await expect(app.consistencyResult.locator('p.success')).toHaveText('Withdrawal successful! New balance: $800');

      // Verify transaction log entry contains the expected success message
      const logs3 = await app.getTransactionLogEntries();
      expect(logs.length).toBeGreaterThan(0);
      const last2 = logs[logs.length - 1];
      expect(last.text).toContain('Withdrew $200 - maintained consistency');
      expect(last.className).toContain('success');

      // No unhandled errors during the operation
      expect(pageErrors.length).toBe(0);
    });

    test('Consistency failure occurs when funds are insufficient after repeated withdrawals', async ({ page }) => {
      // This test forces the S4_Consistency_Failure path by repeatedly invoking demoConsistency()
      // until the accountBalance is exhausted and an insufficient funds error occurs.
      const app4 = new AcidDemoPage(page);
      await app.goto();

      // Withdraw repeatedly: starting balance 1000; each click withdraws 200.
      // After 5 successful withdrawals, balance will be 0. Sixth attempt should fail.
      for (let i = 0; i < 5; i++) {
        await app.clickConsistency();
        // small wait to allow DOM and log update synchronously
        await page.waitForTimeout(50);
        // confirm that each of the first 5 attempts produced a success entry (except we only check last for brevity)
      }

      // Sixth attempt should trigger the insufficient funds path
      await app.clickConsistency();

      // Wait for the failure to appear in the DOM
      await expect(app.consistencyResult.locator('p.failure')).toContainText('Insufficient funds - violates account balance constraint');

      // Verify the transaction log includes an entry marking the rejection to maintain consistency
      const logs4 = await app.getTransactionLogEntries();
      expect(logs.length).toBeGreaterThanOrEqual(6);
      const last3 = logs[logs.length - 1];
      expect(last.text).toContain('Withdrawal rejected to maintain consistency');
      expect(last.className).toContain('failure');

      // No unhandled page errors should have occurred
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Isolation (S5_Isolation)', () => {
    test('Isolation demo shows Transaction 1 uses original read value while Transaction 2 commits', async ({ page }) => {
      // This test validates the S5_Isolation state:
      // - The isolation result contains text indicating Transaction 1 read $1000 and continues with original value.
      // - The transaction log contains an entry for Transaction 2 deposit.
      const app5 = new AcidDemoPage(page);
      await app.goto();

      // Trigger isolation demonstration
      await app.clickIsolation();

      // Assert the isolation result contains the expected textual evidence
      await expect(app.isolationResult).toContainText('Transaction 1 continues working with original value: $1000');
      await expect(app.isolationResult).toContainText("Transaction 1 is isolated from Transaction 2's changes until commit");

      // Verify log contains the deposit from Transaction 2
      const logs5 = await app.getTransactionLogEntries();
      expect(logs.length).toBeGreaterThan(0);
      const found = logs.find(l => l.text.includes('Transaction 2 deposited $300'));
      expect(found).toBeTruthy();
      expect(found?.className).toContain('success');

      // Ensure no unhandled runtime errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Durability (S6_Durability)', () => {
    test('Durability demo persists transaction across simulated crash and logs persistence', async ({ page }) => {
      // This test validates the S6_Durability transition:
      // - After triggering demoDurability(), the DOM eventually contains:
      //   "Transaction committed to persistent storage" and "After recovery: Transaction remains committed"
      // - A persisted transaction log entry exists.
      const app6 = new AcidDemoPage(page);
      await app.goto();

      // Trigger durability demonstration (which uses nested setTimeouts)
      await app.clickDurability();

      // Wait for the first committed-to-storage message (occurs after ~1s)
      await expect(app.durabilityResult.locator('p.success')).toContainText('Transaction committed to persistent storage');

      // Wait for the recovery message (nested timeout approx 2s total) - give a slightly generous timeout
      await app.page.waitForTimeout(1200); // wait for nested timeout to run
      await expect(app.durabilityResult).toContainText('After recovery: Transaction remains committed');

      // Verify transaction log contains the persistence entry
      // (the log entry is added after the nested timeout as well)
      // Wait a bit more to ensure the log entry has been appended
      await app.page.waitForTimeout(200);
      const logs6 = await app.getTransactionLogEntries();
      const found1 = logs.find(l => l.text.includes('Transaction persisted despite system failure'));
      expect(found).toBeTruthy();
      expect(found?.className).toContain('success');

      // Ensure no uncaught page errors occurred during timeouts
      expect(pageErrors.length).toBe(0);
    }, { timeout: 10_000 }); // extended timeout for nested setTimeouts
  });

  test.describe('Edge cases & robustness', () => {
    test('Rapid repeated clicks on atomicity buttons create multiple log entries without causing unhandled errors', async ({ page }) => {
      // Edge case: simulate rapid user interactions (multiple quick clicks).
      // Validate that multiple entries are appended to the log and that no unhandled errors are raised.
      const app7 = new AcidDemoPage(page);
      await app.goto();

      // Rapidly click success button 3 times
      await Promise.all([
        app.atomicSuccessBtn.click(),
        app.atomicSuccessBtn.click(),
        app.atomicSuccessBtn.click()
      ]);

      // Small wait to allow DOM updates
      await page.waitForTimeout(100);

      const logs7 = await app.getTransactionLogEntries();
      // At least 3 entries related to the atomic success should exist (there may be others if previous actions ran)
      const atomicSuccessCount = logs.filter(l => l.text.includes('Funds transfer completed atomically')).length;
      expect(atomicSuccessCount).toBeGreaterThanOrEqual(3);

      // No unhandled page errors
      expect(pageErrors.length).toBe(0);

      // And ensure no console errors were emitted
      const errConsole = consoleMessages.filter(m => m.type === 'error');
      expect(errConsole.length).toBe(0);
    });
  });
});