import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b32300-fa74-11f0-bb9a-db7e6ecdeeaa.html';
const STORAGE_KEY = 'acid_account_balances';

// Page Object for the ACID demo app
class AcidDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.amountInput = page.locator('#transferAmount');
    this.btnSuccess = page.locator('#transferSuccess');
    this.btnFail = page.locator('#transferFail');
    this.log = page.locator('#log');
    this.accountA = page.locator('#accountA');
    this.accountB = page.locator('#accountB');
  }

  async gotoAndResetBalances() {
    // Navigate to the page, then set deterministic balances and reload to ensure a predictable state.
    await this.page.goto(APP_URL);
    await this.page.evaluate((key) => {
      localStorage.setItem(key, JSON.stringify({ A: 1000, B: 500 }));
    }, STORAGE_KEY);
    await this.page.reload();
    // Wait for the initial welcome log to appear
    await expect(this.log).toContainText('Welcome! You can perform transfers to see ACID properties in action.');
  }

  async setAmount(value) {
    await this.amountInput.fill(String(value));
  }

  async clearAmount() {
    await this.amountInput.fill('');
  }

  async clickTransferSuccess() {
    await this.btnSuccess.click();
  }

  async clickTransferFail() {
    await this.btnFail.click();
  }

  async getBalances() {
    const aText = await this.accountA.textContent();
    const bText = await this.accountB.textContent();
    // Return numbers parsed from displayed formatted strings
    return {
      A: parseFloat(aText.replace(/[^0-9.-]+/g, '')),
      B: parseFloat(bText.replace(/[^0-9.-]+/g, '')),
    };
  }

  async getLogText() {
    return await this.log.textContent();
  }

  async getStoredBalances() {
    return await this.page.evaluate((key) => {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }, STORAGE_KEY);
  }

  // Wait for specific log text to appear (used for asynchronous flows)
  async waitForLogText(text, options = { timeout: 3000 }) {
    await expect(this.log).toContainText(text, options);
  }
}

test.describe('ACID Properties Demonstration - FSM tests', () => {
  // Capture console and page errors for each test to assert that runtime errors do not occur unexpectedly.
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Attach listeners before navigation to capture any load-time issues
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Intentionally assert that no unexpected JS runtime errors (pageerror) or console.error messages occurred.
    // This observes whether ReferenceError/SyntaxError/TypeError or other runtime problems happened naturally.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors: ${consoleErrors.join(' | ')}`).toBe(0);
  });

  test('Initial state (S0_Idle) - displays balances and welcome log and runs updateDisplay()', async ({ page }) => {
    const app = new AcidDemoPage(page);

    // Ensure a fresh deterministic starting state and capture initial render
    await app.gotoAndResetBalances();

    // Validate updateDisplay effect: balances are shown with two decimals
    const balances = await app.getBalances();
    expect(balances.A).toBeCloseTo(1000.00, 2);
    expect(balances.B).toBeCloseTo(500.00, 2);

    // Validate the welcome message was logged (evidence of entry_actions: updateDisplay() and initial log)
    const logText = await app.getLogText();
    expect(logText).toContain('Welcome! You can perform transfers to see ACID properties in action.');

    // Validate that localStorage reflects the same balances (durability precondition)
    const stored = await app.getStoredBalances();
    expect(stored).toEqual({ A: 1000, B: 500 });
  });

  test('Transfer success transition (S1_Transfer_Success) - transfer(amount,false) commits and updates balances & logs', async ({ page }) => {
    const app = new AcidDemoPage(page);
    await app.gotoAndResetBalances();

    // Set transfer amount and trigger a successful transfer
    await app.setAmount(100);
    await app.clickTransferSuccess();

    // Wait and verify sequence of expected messages appear in the log
    await app.waitForLogText('Starting transfer of $100.00 from Account A to Account B.');
    await app.waitForLogText('Debited $100.00 from Account A. Temporary balance: $900.00.');
    await app.waitForLogText('Credited $100.00 to Account B. Temporary balance: $600.00.');
    await app.waitForLogText('Transaction committed successfully.');

    // Verify balances updated in the DOM (A decreased by 100, B increased by 100)
    const balances = await app.getBalances();
    expect(balances.A).toBeCloseTo(900.00, 2);
    expect(balances.B).toBeCloseTo(600.00, 2);

    // Verify localStorage persisted the committed balances (Durability)
    const stored = await app.getStoredBalances();
    expect(stored.A).toBeCloseTo(900.00, 2);
    expect(stored.B).toBeCloseTo(600.00, 2);

    // Ensure the committed message is styled as success in the DOM (log contains span with class "success")
    const logHtml = await page.locator('#log').innerHTML();
    expect(logHtml).toContain('Transaction committed successfully.');
    expect(logHtml).toMatch(/class="[^"]*success[^"]*"/);
  });

  test('Transfer failure transition (S2_Transfer_Failure) - transfer(amount,true) aborts and leaves balances unchanged', async ({ page }) => {
    const app = new AcidDemoPage(page);
    await app.gotoAndResetBalances();

    // Use a mid-size amount and trigger simulated failure
    await app.setAmount(50);
    await app.clickTransferFail();

    // Wait for the error messages to appear indicating the transaction was aborted
    await app.waitForLogText('Starting transfer of $50.00 from Account A to Account B.');
    await app.waitForLogText('Debited $50.00 from Account A. Temporary balance: $950.00.');
    await app.waitForLogText('Transaction aborted: Simulated failure during transaction.');
    await app.waitForLogText('No changes applied. Data remains consistent.');

    // After a simulated failure, ensure balances in the DOM remain unchanged from initial values
    const balances = await app.getBalances();
    expect(balances.A).toBeCloseTo(1000.00, 2);
    expect(balances.B).toBeCloseTo(500.00, 2);

    // And localStorage should also remain unchanged (no commit)
    const stored = await app.getStoredBalances();
    expect(stored.A).toBeCloseTo(1000.00, 2);
    expect(stored.B).toBeCloseTo(500.00, 2);

    // Check that error messages are styled with the error class in the log
    const logHtml = await page.locator('#log').innerHTML();
    expect(logHtml).toContain('Transaction aborted: Simulated failure during transaction.');
    expect(logHtml).toMatch(/class="[^"]*error[^"]*"/);
  });

  test('Edge case: Invalid transfer amount (NaN/empty) logs error and does not call transfer()', async ({ page }) => {
    const app = new AcidDemoPage(page);
    await app.gotoAndResetBalances();

    // Clear the amount input to simulate invalid amount, then click transfer
    await app.clearAmount();
    await app.clickTransferSuccess();

    // Expect an immediate invalid amount error message and no further transfer logs
    await app.waitForLogText('Invalid transfer amount.');
    const logText = await app.getLogText();
    expect(logText).toContain('Invalid transfer amount.');
    expect(logText).not.toContain('Starting transfer of $');

    // Balances should remain unchanged
    const balances = await app.getBalances();
    expect(balances.A).toBeCloseTo(1000.00, 2);
    expect(balances.B).toBeCloseTo(500.00, 2);
  });

  test('Edge case: Insufficient funds aborts transaction with appropriate message and no commit', async ({ page }) => {
    const app = new AcidDemoPage(page);
    await app.gotoAndResetBalances();

    // Attempt to transfer more than Account A has
    await app.setAmount(2000); // greater than 1000
    await app.clickTransferSuccess();

    // Wait for insufficient funds message
    await app.waitForLogText('Starting transfer of $2000.00 from Account A to Account B.');
    await app.waitForLogText('Transaction aborted: Insufficient funds in Account A.');
    await app.waitForLogText('No changes applied. Data remains consistent.');

    // Balances should remain unchanged
    const balances = await app.getBalances();
    expect(balances.A).toBeCloseTo(1000.00, 2);
    expect(balances.B).toBeCloseTo(500.00, 2);

    // localStorage untouched
    const stored = await app.getStoredBalances();
    expect(stored.A).toBeCloseTo(1000.00, 2);
    expect(stored.B).toBeCloseTo(500.00, 2);
  });
});