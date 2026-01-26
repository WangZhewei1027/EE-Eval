import { test, expect } from '@playwright/test';

// Test file: 6d310a91-fa7a-11f0-ba5b-57721b046e74.spec.js
// Application under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/6d310a91-fa7a-11f0-ba5b-57721b046e74.html

// Page object encapsulating common interactions with the Transaction System page.
class TransactionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      accountSelect: '#accountSelect',
      viewAccountBtn: '#viewAccountBtn',
      accountDetails: '#accountDetails',
      accountInfo: '#accountInfo',
      newTransactionBtn: '#newTransactionBtn',
      viewHistoryBtn: '#viewHistoryBtn',
      transactionPanel: '#transactionPanel',
      transactionType: '#transactionType',
      transactionAmount: '#transactionAmount',
      transferSection: '#transferSection',
      transferAccount: '#transferAccount',
      paymentSection: '#paymentSection',
      payeeName: '#payeeName',
      payeeAccount: '#payeeAccount',
      transactionDesc: '#transactionDesc',
      transactionDate: '#transactionDate',
      transactionError: '#transactionError',
      previewTransactionBtn: '#previewTransactionBtn',
      cancelTransactionBtn: '#cancelTransactionBtn',
      previewPanel: '#previewPanel',
      previewDetails: '#previewDetails',
      confirmTransactionBtn: '#confirmTransactionBtn',
      editTransactionBtn: '#editTransactionBtn',
      historyPanel: '#historyPanel',
      historyFilter: '#historyFilter',
      historyStartDate: '#historyStartDate',
      historyEndDate: '#historyEndDate',
      applyFilterBtn: '#applyFilterBtn',
      historyTableBody: '#historyTableBody',
      closeHistoryBtn: '#closeHistoryBtn',
      confirmationPanel: '#confirmationPanel',
      confirmationDetails: '#confirmationDetails',
      newTransactionFromConfirmBtn: '#newTransactionFromConfirmBtn',
      viewAccountFromConfirmBtn: '#viewAccountFromConfirmBtn'
    };
  }

  async goto(url) {
    await this.page.goto(url, { waitUntil: 'load' });
  }

  // Helpers for visibility checks
  async isVisible(selector) {
    return await this.page.locator(selector).isVisible();
  }

  async getText(selector) {
    return await this.page.locator(selector).innerText();
  }

  // Select an account and click "View Account Details"
  async selectAccountAndView(accountValue) {
    await this.page.locator(this.selectors.accountSelect).selectOption(accountValue);
    await this.page.locator(this.selectors.viewAccountBtn).click();
    // Wait for accountDetails to be visible
    await this.page.waitForSelector(this.selectors.accountDetails, { state: 'visible' });
  }

  // Start a new transaction from account details or from confirmation/new-transaction button
  async startNewTransactionFromDetails() {
    await this.page.locator(this.selectors.newTransactionBtn).click();
    await this.page.waitForSelector(this.selectors.transactionPanel, { state: 'visible' });
  }

  async startNewTransactionFromConfirm() {
    await this.page.locator(this.selectors.newTransactionFromConfirmBtn).click();
    await this.page.waitForSelector(this.selectors.transactionPanel, { state: 'visible' });
  }

  async setTransactionType(type) {
    await this.page.locator(this.selectors.transactionType).selectOption(type);
    // handler runs synchronously; wait a tick for DOM updates
    await this.page.waitForTimeout(50);
  }

  async setAmount(amount) {
    await this.page.locator(this.selectors.transactionAmount).fill(String(amount));
  }

  async setTransferAccount(accountValue) {
    await this.page.locator(this.selectors.transferAccount).selectOption(accountValue);
  }

  async setPaymentDetails(name, account) {
    await this.page.locator(this.selectors.payeeName).fill(name);
    await this.page.locator(this.selectors.payeeAccount).fill(account);
  }

  async setDescription(desc) {
    await this.page.locator(this.selectors.transactionDesc).fill(desc);
  }

  async clickPreview() {
    await this.page.locator(this.selectors.previewTransactionBtn).click();
  }

  async clickCancel() {
    await this.page.locator(this.selectors.cancelTransactionBtn).click();
  }

  async clickConfirm() {
    await this.page.locator(this.selectors.confirmTransactionBtn).click();
  }

  async clickEdit() {
    await this.page.locator(this.selectors.editTransactionBtn).click();
  }

  async viewHistory() {
    await this.page.locator(this.selectors.viewHistoryBtn).click();
    await this.page.waitForSelector(this.selectors.historyPanel, { state: 'visible' });
  }

  async applyHistoryFilter() {
    await this.page.locator(this.selectors.applyFilterBtn).click();
  }

  async closeHistory() {
    await this.page.locator(this.selectors.closeHistoryBtn).click();
  }

  async clickViewAccountFromConfirm() {
    await this.page.locator(this.selectors.viewAccountFromConfirmBtn).click();
  }
}

// Utility to attach listeners to capture console errors and page errors for assertions.
async function attachErrorCapture(page) {
  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', (err) => {
    pageErrors.push(err);
  });

  page.on('console', (msg) => {
    // capture only error-level console messages
    if (msg.type() === 'error' || msg.type() === 'warning') {
      consoleErrors.push({ type: msg.type(), text: msg.text() });
    }
  });

  return { pageErrors, consoleErrors };
}

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d310a91-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Transaction System FSM - states and transitions', () => {
  // Each test will create its own page object and capture errors for that scenario.
  test('Initial Idle state renders page and UI basics', async ({ page }) => {
    // Attach error capture
    const { pageErrors, consoleErrors } = await attachErrorCapture(page);
    const tx = new TransactionPage(page);
    // Load the page (onEnter of Idle state should render page)
    await tx.goto(APP_URL);

    // Validate header exists (evidence of S0_Idle)
    const header = await page.locator('h1').innerText();
    expect(header).toBe('Transaction System');

    // accountDetails should be hidden initially
    expect(await tx.isVisible(tx.selectors.accountDetails)).toBeFalsy();

    // Ensure no unexpected page errors or console errors occurred during initial load
    expect(pageErrors.map(e => e.message)).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test.describe('Account selection and viewing', () => {
    test('ViewAccount transitions Idle -> Account Selected and shows account details', async ({ page }) => {
      const { pageErrors, consoleErrors } = await attachErrorCapture(page);
      const tx = new TransactionPage(page);
      await tx.goto(APP_URL);

      // Select 'checking' and view account details
      await tx.selectAccountAndView('checking');

      // accountDetails should be visible (evidence for S1_AccountSelected)
      expect(await tx.isVisible(tx.selectors.accountDetails)).toBeTruthy();

      // accountInfo should show Checking and balance
      const info = await tx.getText(tx.selectors.accountInfo);
      expect(info).toContain('Checking');
      expect(info).toContain('Balance');
      expect(info).toContain('$');

      // No page errors
      expect(pageErrors.map(e => e.message)).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('View transaction history from account details and close it (S1 -> S5 -> S1)', async ({ page }) => {
      const { pageErrors, consoleErrors } = await attachErrorCapture(page);
      const tx = new TransactionPage(page);
      await tx.goto(APP_URL);

      await tx.selectAccountAndView('checking');

      // Click view history -> history panel visible
      await tx.viewHistory();
      expect(await tx.isVisible(tx.selectors.historyPanel)).toBeTruthy();
      expect(await tx.isVisible(tx.selectors.accountDetails)).toBeFalsy();

      // History table should have entries for checking (initialized sample data)
      const bodyText = await tx.getText(tx.selectors.historyTableBody);
      expect(bodyText.length).toBeGreaterThan(0);
      expect(bodyText).toContain('Paycheck').or.toContain('ATM Withdrawal');

      // Apply filter (no-op if 'All Transactions'), ensure no exceptions
      await tx.applyHistoryFilter();
      // Close history -> accountDetails visible again
      await tx.closeHistory();
      expect(await tx.isVisible(tx.selectors.historyPanel)).toBeFalsy();
      expect(await tx.isVisible(tx.selectors.accountDetails)).toBeTruthy();

      expect(pageErrors.map(e => e.message)).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Transaction creation, preview, edit, cancel, confirm flows', () => {
    test('Start new transaction transitions S1 -> S2 and resets form', async ({ page }) => {
      const { pageErrors, consoleErrors } = await attachErrorCapture(page);
      const tx = new TransactionPage(page);
      await tx.goto(APP_URL);

      // Need to view account first
      await tx.selectAccountAndView('checking');

      await tx.startNewTransactionFromDetails();
      expect(await tx.isVisible(tx.selectors.transactionPanel)).toBeTruthy();
      // Ensure preview and history panels are hidden
      expect(await tx.isVisible(tx.selectors.previewPanel)).toBeFalsy();
      expect(await tx.isVisible(tx.selectors.historyPanel)).toBeFalsy();

      // Form reset checks: amount empty, description empty
      const amountVal = await page.locator(tx.selectors.transactionAmount).inputValue();
      const descVal = await page.locator(tx.selectors.transactionDesc).inputValue();
      expect(amountVal).toBe('');
      expect(descVal).toBe('');

      expect(pageErrors.map(e => e.message)).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('TransactionTypeChange shows transfer and payment sections appropriately', async ({ page }) => {
      const { pageErrors, consoleErrors } = await attachErrorCapture(page);
      const tx = new TransactionPage(page);
      await tx.goto(APP_URL);

      await tx.selectAccountAndView('checking');
      await tx.startNewTransactionFromDetails();

      // Change to transfer -> transferSection visible, paymentSection hidden
      await tx.setTransactionType('transfer');
      expect(await tx.isVisible(tx.selectors.transferSection)).toBeTruthy();
      expect(await tx.isVisible(tx.selectors.paymentSection)).toBeFalsy();

      // Change to payment -> paymentSection visible
      await tx.setTransactionType('payment');
      expect(await tx.isVisible(tx.selectors.paymentSection)).toBeTruthy();
      expect(await tx.isVisible(tx.selectors.transferSection)).toBeFalsy();

      // Change back to deposit -> both hidden
      await tx.setTransactionType('deposit');
      expect(await tx.isVisible(tx.selectors.transferSection)).toBeFalsy();
      expect(await tx.isVisible(tx.selectors.paymentSection)).toBeFalsy();

      expect(pageErrors.map(e => e.message)).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Preview without amount shows validation error (edge case)', async ({ page }) => {
      const { pageErrors, consoleErrors } = await attachErrorCapture(page);
      const tx = new TransactionPage(page);
      await tx.goto(APP_URL);

      await tx.selectAccountAndView('checking');
      await tx.startNewTransactionFromDetails();

      // Ensure amount is empty then click preview
      await tx.setAmount('');
      await tx.clickPreview();

      // Expect validation error
      const err = await tx.getText(tx.selectors.transactionError);
      expect(err).toBe('Please enter a valid amount');

      expect(pageErrors.map(e => e.message)).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Preview transfer without choosing destination shows validation error', async ({ page }) => {
      const { pageErrors, consoleErrors } = await attachErrorCapture(page);
      const tx = new TransactionPage(page);
      await tx.goto(APP_URL);

      await tx.selectAccountAndView('checking');
      await tx.startNewTransactionFromDetails();

      await tx.setTransactionType('transfer');
      await tx.setAmount(50);
      // Do not select transferAccount
      await tx.clickPreview();

      const err = await tx.getText(tx.selectors.transactionError);
      expect(err).toBe('Please select a transfer account');

      expect(pageErrors.map(e => e.message)).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Preview payment without payee details shows validation error', async ({ page }) => {
      const { pageErrors, consoleErrors } = await attachErrorCapture(page);
      const tx = new TransactionPage(page);
      await tx.goto(APP_URL);

      await tx.selectAccountAndView('credit'); // credit account has negative balance but we are checking validation flow
      await tx.startNewTransactionFromDetails();

      await tx.setTransactionType('payment');
      await tx.setAmount(20);
      // Leave payeeName and payeeAccount empty
      await tx.clickPreview();

      const err = await tx.getText(tx.selectors.transactionError);
      expect(err).toBe('Please enter payee details');

      expect(pageErrors.map(e => e.message)).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Insufficient funds on withdrawal/transfer/payment triggers error', async ({ page }) => {
      const { pageErrors, consoleErrors } = await attachErrorCapture(page);
      const tx = new TransactionPage(page);
      await tx.goto(APP_URL);

      // Checking balance is 1500. Attempt withdrawal of a larger amount
      await tx.selectAccountAndView('checking');
      await tx.startNewTransactionFromDetails();

      await tx.setTransactionType('withdrawal');
      await tx.setAmount(2000); // greater than balance
      await tx.clickPreview();

      const err = await tx.getText(tx.selectors.transactionError);
      expect(err).toBe('Insufficient funds');

      // Also test transfer insufficient funds
      await tx.setTransactionType('transfer');
      await tx.setAmount(2000);
      // Select a destination account
      await tx.setTransferAccount('savings');
      await tx.clickPreview();

      const err2 = await tx.getText(tx.selectors.transactionError);
      expect(err2).toBe('Insufficient funds');

      expect(pageErrors.map(e => e.message)).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Full deposit flow: preview -> confirm -> confirmation panel and navigation options', async ({ page }) => {
      const { pageErrors, consoleErrors } = await attachErrorCapture(page);
      const tx = new TransactionPage(page);
      await tx.goto(APP_URL);

      // View checking account
      await tx.selectAccountAndView('checking');

      // Read current balance from accountInfo
      const accountInfo = await tx.getText(tx.selectors.accountInfo);
      // Extract numeric balance from the string (e.g., "$1,500.00")
      const balanceMatch = accountInfo.match(/\$([0-9,]+\.\d{2})/);
      expect(balanceMatch).not.toBeNull();
      const beforeBalance = parseFloat(balanceMatch[1].replace(/,/g, ''));

      // Start new deposit
      await tx.startNewTransactionFromDetails();
      await tx.setTransactionType('deposit');
      await tx.setAmount(100);
      await tx.setDescription('Test deposit');
      await tx.clickPreview();

      // Now preview panel should be visible
      expect(await tx.isVisible(tx.selectors.previewPanel)).toBeTruthy();
      expect(await tx.isVisible(tx.selectors.transactionPanel)).toBeFalsy();

      // Confirm transaction
      await tx.clickConfirm();

      // Confirmation panel should be visible with new balance
      expect(await tx.isVisible(tx.selectors.confirmationPanel)).toBeTruthy();
      const confText = await tx.getText(tx.selectors.confirmationDetails);
      expect(confText).toContain('Transaction completed successfully');
      // New balance should reflect +100
      const newBalanceMatch = confText.match(/\$([0-9,]+\.\d{2})/);
      expect(newBalanceMatch).not.toBeNull();
      const afterBalance = parseFloat(newBalanceMatch[1].replace(/,/g, ''));
      expect(afterBalance).toBeCloseTo(beforeBalance + 100, 2);

      // From confirmation, start new transaction again (NewTransactionFromConfirm)
      await tx.startNewTransactionFromConfirm();
      expect(await tx.isVisible(tx.selectors.transactionPanel)).toBeTruthy();

      // Return to confirmation and click viewAccountFromConfirm to ensure it navigates back to account details (S4 -> S1)
      // Since we are currently in transactionPanel, navigate back to confirmation by repeating deposit quickly:
      await tx.setTransactionType('deposit');
      await tx.setAmount(1);
      await tx.clickPreview();
      await tx.clickConfirm();
      // Now click viewAccountFromConfirm
      await tx.clickViewAccountFromConfirm();
      // accountDetails should be visible
      expect(await tx.isVisible(tx.selectors.accountDetails)).toBeTruthy();

      expect(pageErrors.map(e => e.message)).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Edit transaction from preview navigates back to creation (S3 -> S2)', async ({ page }) => {
      const { pageErrors, consoleErrors } = await attachErrorCapture(page);
      const tx = new TransactionPage(page);
      await tx.goto(APP_URL);

      await tx.selectAccountAndView('savings');
      await tx.startNewTransactionFromDetails();

      await tx.setTransactionType('deposit');
      await tx.setAmount(50);
      await tx.clickPreview();

      // Now click edit to go back to transaction panel
      await tx.clickEdit();
      expect(await tx.isVisible(tx.selectors.transactionPanel)).toBeTruthy();
      expect(await tx.isVisible(tx.selectors.previewPanel)).toBeFalsy();

      expect(pageErrors.map(e => e.message)).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Cancel transaction returns to account details (S2 -> S1)', async ({ page }) => {
      const { pageErrors, consoleErrors } = await attachErrorCapture(page);
      const tx = new TransactionPage(page);
      await tx.goto(APP_URL);

      await tx.selectAccountAndView('savings');
      await tx.startNewTransactionFromDetails();

      // Click cancel
      await tx.clickCancel();
      expect(await tx.isVisible(tx.selectors.transactionPanel)).toBeFalsy();
      expect(await tx.isVisible(tx.selectors.accountDetails)).toBeTruthy();

      expect(pageErrors.map(e => e.message)).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });
});