import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f0d70-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the ACID demo page
class AcidPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.atomicBtn = page.locator("button[onclick='demonstrateAtomicity()']");
    this.consistencyBtn = page.locator("button[onclick='demonstrateConsistency()']");
    this.isolationBtn = page.locator("button[onclick='demonstrateIsolation()']");
    this.durabilityBtn = page.locator("button[onclick='demonstrateDurability()']");
    this.logs = page.locator('#logs');
    // arrays to collect runtime diagnostics
    this._pageErrors = [];
    this._consoleMessages = [];
  }

  // Navigate to the page and set up listeners for console and page errors
  async goto() {
    // attach listeners before navigation to catch early errors
    this.page.on('pageerror', (err) => {
      this._pageErrors.push(err);
    });
    this.page.on('console', (msg) => {
      this._consoleMessages.push(msg);
    });
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click helpers
  async clickAtomicity() {
    await this.atomicBtn.click();
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

  // Return an array of the log entries' text content in insertion order
  async getLogsArray() {
    return await this.page.evaluate(() => {
      const container = document.getElementById('logs');
      if (!container) return [];
      return Array.from(container.children).map(c => c.textContent ? c.textContent.trim() : '');
    });
  }

  // Convenience: checks if a log entry containing `text` exists
  async hasLogContaining(text) {
    const logs = await this.getLogsArray();
    return logs.some(l => l.includes(text));
  }

  // Expose collected diagnostics
  get pageErrors() {
    return this._pageErrors;
  }
  get consoleMessages() {
    return this._consoleMessages;
  }
}

test.describe('ACID Properties Application - FSM Validation', () => {
  // Each test will get a fresh page fixture from Playwright
  test.beforeEach(async ({ page }) => {
    // Nothing global to set up here; individual tests will create AcidPage and navigate.
  });

  // Test the Idle initial state: page renders correctly with four demo buttons and logs area empty
  test('Initial Idle state renders controls and has no pre-existing logs', async ({ page }) => {
    const app = new AcidPage(page);
    await app.goto();

    // Verify the four expected buttons are present and visible
    await expect(app.atomicBtn).toBeVisible();
    await expect(app.consistencyBtn).toBeVisible();
    await expect(app.isolationBtn).toBeVisible();
    await expect(app.durabilityBtn).toBeVisible();

    // Verify logs container exists and is initially empty
    const logsArray = await app.getLogsArray();
    expect(Array.isArray(logsArray)).toBe(true);
    expect(logsArray.length).toBe(0);

    // Verify that the page has not raised any uncaught runtime page errors upon load
    expect(app.pageErrors.length).toBe(0);

    // The FSM's initial state's entry_actions mentions renderPage()
    // Confirm that renderPage is not defined on the page (the app does not implement it)
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');
  });

  // Test Atomicity transition: clicking the Atomicity button should show start/process logs and a failure message
  test('Atomicity Demonstrated: logs transaction steps and failure message', async ({ page }) => {
    const app1 = new AcidPage(page);
    await app.goto();

    // Click the Atomicity button to trigger the demonstration
    await app.clickAtomicity();

    // Wait a brief moment for DOM updates
    await page.waitForTimeout(50);

    const logs1 = await app.getLogsArray();

    // Validate expected sequence fragments appear in logs
    expect(logs.length).toBeGreaterThanOrEqual(4);
    expect(logs[0]).toContain('Starting Transaction');
    expect(logs[1]).toContain('Processing Part 1');
    expect(logs[2]).toContain('Processing Part 2');
    // The thrown error in the demo is caught and logged as "Transaction Failed: An error occurred!"
    expect(logs[3]).toContain('Transaction Failed: An error occurred!');

    // Re-validate by searching for the failure message anywhere in logs
    const hasFailure = await app.hasLogContaining('Transaction Failed: An error occurred!');
    expect(hasFailure).toBe(true);

    // Ensure no uncaught page errors occurred (the error was intentionally thrown and caught)
    expect(app.pageErrors.length).toBe(0);
  });

  // Test Consistency transition: clicking should log before and after balance messages and show correct final balance
  test('Consistency Demonstrated: shows before and after balance with expected final value', async ({ page }) => {
    const app2 = new AcidPage(page);
    await app.goto();

    await app.clickConsistency();
    // Wait briefly for DOM updates
    await page.waitForTimeout(50);

    const logs2 = await app.getLogsArray();

    // Expect two messages: before and after
    // The demo logs "Before Transaction: Balance = $100" then "After Transaction: Balance = $150"
    const beforeIdx = logs.findIndex(l => l.includes('Before Transaction: Balance = $100'));
    const afterIdx = logs.findIndex(l => l.includes('After Transaction: Balance = $150'));
    expect(beforeIdx).toBeGreaterThanOrEqual(0);
    expect(afterIdx).toBeGreaterThanOrEqual(0);
    // Ensure ordering: before message appears before after message
    expect(beforeIdx).toBeLessThan(afterIdx);

    // Also ensure there are no uncaught runtime errors
    expect(app.pageErrors.length).toBe(0);
  });

  // Test Isolation transition: ensure isolation messages and delayed completions appear in expected order
  test('Isolation Demonstrated: transactions run in isolation with delayed completion logs', async ({ page }) => {
    const app3 = new AcidPage(page);
    await app.goto();

    // Start the isolation demonstration which schedules delayed messages
    await app.clickIsolation();

    // Immediately after clicking, three immediate logs are expected (two "Transaction X: Adding..." and "Transactions running in isolation...")
    // Wait a small amount to allow immediate logs to be appended
    await page.waitForTimeout(50);
    let logs3 = await app.getLogsArray();

    // Check initial immediate entries
    const t1AddingIdx = logs.findIndex(l => l.includes('Transaction 1: Adding $50 to Balance'));
    const t2AddingIdx = logs.findIndex(l => l.includes('Transaction 2: Adding $30 to Balance'));
    const runningIsolationIdx = logs.findIndex(l => l.includes('Transactions running in isolation'));
    expect(t1AddingIdx).toBeGreaterThanOrEqual(0);
    expect(t2AddingIdx).toBeGreaterThanOrEqual(0);
    expect(runningIsolationIdx).toBeGreaterThanOrEqual(0);
    // Ensure one of the adding messages appears before "Transactions running in isolation"
    expect(Math.min(t1AddingIdx, t2AddingIdx)).toBeLessThan(runningIsolationIdx);

    // Wait for the shorter timeout first (Transaction 2 completes after 500ms)
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('#logs div')).some(d => d.textContent.includes('Transaction 2 Completed: Balance = $130'));
    }, { timeout: 1500 });

    // Then wait for the longer timeout (Transaction 1 completes after 1000ms)
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('#logs div')).some(d => d.textContent.includes('Transaction 1 Completed: Balance = $150'));
    }, { timeout: 2000 });

    // Re-read logs and validate ordering of completion messages relative to each other and prior messages
    logs = await app.getLogsArray();
    const t2CompletedIdx = logs.findIndex(l => l.includes('Transaction 2 Completed: Balance = $130'));
    const t1CompletedIdx = logs.findIndex(l => l.includes('Transaction 1 Completed: Balance = $150'));
    expect(t2CompletedIdx).toBeGreaterThanOrEqual(0);
    expect(t1CompletedIdx).toBeGreaterThanOrEqual(0);
    // Because Transaction 2 completes sooner, its index should be less than Transaction 1's index
    expect(t2CompletedIdx).toBeLessThan(t1CompletedIdx);

    // Ensure the "Transactions running in isolation..." message appears before both completions
    expect(runningIsolationIdx).toBeLessThan(t2CompletedIdx);
    expect(runningIsolationIdx).toBeLessThan(t1CompletedIdx);

    // Ensure no uncaught runtime errors occurred during the asynchronous operations
    expect(app.pageErrors.length).toBe(0);
  });

  // Test Durability: clicking should log started, transaction log and committed/permanent message
  test('Durability Demonstrated: transaction committed message appears with permanence note', async ({ page }) => {
    const app4 = new AcidPage(page);
    await app.goto();

    await app.clickDurability();
    // Wait for DOM updates
    await page.waitForTimeout(50);

    const logs4 = await app.getLogsArray();

    // Expected messages in the demo:
    // "Transaction Started...", "Transaction: Added $50", "Transaction Committed. Changes are permanent."
    const started = logs.find(l => l.includes('Transaction Started'));
    const txLog = logs.find(l => l.includes('Transaction: Added $50'));
    const committed = logs.find(l => l.includes('Transaction Committed. Changes are permanent.'));
    expect(started).toBeDefined();
    expect(txLog).toBeDefined();
    expect(committed).toBeDefined();

    // Ensure no uncaught page errors
    expect(app.pageErrors.length).toBe(0);
  });

  // Edge case: multiple clicks cause repeated logs and the application handles repeated interactions gracefully
  test('Edge Case: repeated Atomicity clicks append multiple failure logs without uncaught errors', async ({ page }) => {
    const app5 = new AcidPage(page);
    await app.goto();

    // Click atomicity twice in quick succession
    await app.clickAtomicity();
    await app.clickAtomicity();

    // Wait for DOM updates
    await page.waitForTimeout(100);

    const logs5 = await app.getLogsArray();
    // Count occurrences of the failure message
    const failureCount = logs.filter(l => l.includes('Transaction Failed: An error occurred!')).length;
    expect(failureCount).toBeGreaterThanOrEqual(2);

    // Ensure no uncaught runtime errors were emitted
    expect(app.pageErrors.length).toBe(0);
  });

  // Edge case: concurrency - trigger isolation and atomicity close together and ensure both sets of logs are present
  test('Edge Case: concurrent interactions interleave logs as expected', async ({ page }) => {
    const app6 = new AcidPage(page);
    await app.goto();

    // Trigger isolation (with delayed completions) then immediately trigger atomicity
    await app.clickIsolation();
    await app.clickAtomicity();

    // Allow immediate logs to be appended
    await page.waitForTimeout(50);

    let logs6 = await app.getLogsArray();
    // Ensure we see atomicity start and failure logs among the overall logs
    const atomicStart = logs.find(l => l.includes('Starting Transaction'));
    const atomicFailure = logs.find(l => l.includes('Transaction Failed: An error occurred!'));
    expect(atomicStart).toBeDefined();
    expect(atomicFailure).toBeDefined();

    // Wait for isolation completions
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('#logs div')).some(d => d.textContent.includes('Transaction 1 Completed: Balance = $150'));
    }, { timeout: 2000 });

    logs = await app.getLogsArray();
    // Ensure both atomicity and isolation completed logs are present
    expect(logs.some(l => l.includes('Transaction Failed: An error occurred!'))).toBe(true);
    expect(logs.some(l => l.includes('Transaction 1 Completed: Balance = $150'))).toBe(true);

    // Ensure no uncaught errors occurred
    expect(app.pageErrors.length).toBe(0);
  });

  // Final check to ensure no unexpected console errors or page errors were produced during interactions
  test('Diagnostics: no uncaught page errors and no console errors emitted during tests', async ({ page }) => {
    const app7 = new AcidPage(page);
    await app.goto();

    // Perform a sequence of actions exercising all transitions
    await app.clickAtomicity();
    await app.clickConsistency();
    await app.clickIsolation();
    await app.clickDurability();

    // Wait for possible asynchronous messages to finish (isolation uses timeouts)
    await page.waitForTimeout(1500);

    // Ensure we didn't capture any uncaught page errors
    expect(app.pageErrors.length).toBe(0);

    // Check console messages for any error-level messages (the app logs to DOM rather than console,
    // so typically there should be no console messages; at minimum ensure there's no error severity)
    const consoleErrors = app.consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});