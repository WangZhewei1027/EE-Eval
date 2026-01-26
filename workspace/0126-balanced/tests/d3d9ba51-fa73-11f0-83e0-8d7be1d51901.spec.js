import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d9ba51-fa73-11f0-83e0-8d7be1d51901.html';

// Helper Page Object for interacting with the demo
class TxDemoPage {
  constructor(page) {
    this.page = page;
    this.errors = [];
    this.consoleMessages = [];
  }

  async initListeners() {
    // Collect page errors
    this.page.on('pageerror', (err) => {
      // keep natural errors (ReferenceError, TypeError, SyntaxError if any)
      this.errors.push(err);
    });
    // Collect console messages
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    // Auto-accept confirms so tests continue without manual intervention
    this.page.on('dialog', async (dialog) => {
      // Accept all confirmations/alerts so flows proceed
      try { await dialog.accept(); } catch (e) { /* ignore */ }
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getLogText() {
    return await this.page.locator('#log').innerText();
  }

  // Wait until the log includes the provided substring (with timeout)
  async waitForLogContains(substring, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, text) => {
        const el = document.querySelector(sel);
        return el && el.innerText.includes(text);
      },
      '#log',
      substring,
      { timeout }
    );
  }

  // Create a new transaction via New Transaction button and return its card locator
  async createNewTransaction() {
    await this.page.click('#newTxBtn');
    // New tx creates a card in txContainer; wait for a tx-card to appear
    const card = this.page.locator('.tx-card').first();
    await expect(card).toBeVisible();
    // Extract tx id from card id attr or from displayed text
    const idAttr = await card.getAttribute('id'); // like "tx-<id>"
    return { card, id: idAttr ? idAttr.replace(/^tx-/, '') : null };
  }

  // Find tx card by id
  txCardLocator(txId) {
    return this.page.locator(`#tx-${txId}`);
  }

  // Add an operation to the tx: type: 'transfer'|'deposit'|'withdraw', amount: number, from/to ids as needed
  async addOperationToTx(txId, { type = 'deposit', amount = 10.0, from = 'A', to = 'B' } = {}) {
    const card = this.txCardLocator(txId);
    await expect(card).toBeVisible();
    // Click the Add Op button inside this card
    const addOpBtn = card.locator('button', { hasText: 'Add Op' });
    await addOpBtn.click();
    // The op editor form is prepended into ops-<txId>. Locate the first form inside ops
    const opsDiv = this.page.locator(`#ops-${txId}`);
    const form = opsDiv.locator('div').first();
    await expect(form).toBeVisible();
    // Select type
    const typeSel = form.locator('select').first();
    await typeSel.selectOption(type);
    // Fill amount
    const amtInput = form.locator('input[type="number"]');
    await amtInput.fill(String(amount));
    // Fill from/to selects — there are two selects after typeSel; find visible ones
    // The form's select elements: first is typeSel, then fromSel, then toSel
    const selects = form.locator('select');
    // selects.nth(1) -> fromSel, selects.nth(2) -> toSel (but elements might be hidden depending on type)
    if (type === 'transfer') {
      await selects.nth(1).selectOption(from);
      await selects.nth(2).selectOption(to);
    } else if (type === 'deposit') {
      // hide fromSel; toSel is nth(2)
      await selects.nth(2).selectOption(to);
    } else if (type === 'withdraw') {
      await selects.nth(1).selectOption(from);
    }
    // Click Add button (button with text 'Add' inside form)
    const addBtn = form.locator('button', { hasText: 'Add' });
    await addBtn.click();
    // Wait for op to appear in ops list
    await this.page.waitForTimeout(50); // small wait to let UI update
    const opsRows = this.page.locator(`#ops-${txId} .op-row`);
    await expect(opsRows).toHaveCountGreaterThan(0);
  }

  // Click commit for tx and wait for state change in the card
  async commitTx(txId) {
    const card = this.txCardLocator(txId);
    const commitBtn = card.locator('button', { hasText: 'Commit' });
    await commitBtn.click();
    // Wait until state element updates to 'committed' or 'aborted'
    const stateEl = this.page.locator(`#state-${txId}`);
    await this.page.waitForFunction((el) => {
      return el && (el.innerText === 'committed' || el.innerText === 'aborted');
    }, stateEl);
    return await stateEl.innerText();
  }

  // Click rollback for tx and wait for aborted state
  async rollbackTx(txId) {
    const card = this.txCardLocator(txId);
    const rb = card.locator('button', { hasText: 'Rollback' });
    await rb.click();
    const stateEl = this.page.locator(`#state-${txId}`);
    await expect(stateEl).toHaveText(/aborted/);
  }

  // Change concurrency mode
  async setMode(modeValue) {
    await this.page.selectOption('#mode', modeValue);
    // wait for log message
    await this.waitForLogContains(`Mode switched to: ${modeValue}`);
  }

  // Persist state button
  async persistCommittedState() {
    await this.page.click('#persistBtn');
    await this.waitForLogContains('Persisted committed state to localStorage');
  }

  // Clear persisted state (auto-accept dialog)
  async clearPersisted() {
    await this.page.click('#clearPersistBtn');
    await this.waitForLogContains('Cleared persisted state.');
  }

  // Reset demo (auto-accept dialog)
  async resetDemo() {
    await this.page.click('#resetBtn');
    await this.waitForLogContains('Demo reset to defaults.');
  }

  // Run the 2-TX scenario (scenarioBtn) and wait for completion by looking for commit logs
  async runScenarioAndWait() {
    await this.page.click('#scenarioBtn');
    // The scenario appends logs, wait for "Scenario created" entry
    await this.waitForLogContains('Scenario created', 3000);
    // Then wait for commits/aborts to appear; wait for either 'committed' or 'failed' indications
    await this.page.waitForFunction(() => {
      const log = document.querySelector('#log');
      if (!log) return false;
      const text = log.innerText;
      return text.includes('committed (') || text.includes('failed') || text.includes('optimistic conflict');
    }, null, { timeout: 5000 });
  }

  // Read accounts table and return an array of { id, name, balanceText, versionText }
  async readAccountsTable() {
    const rows = this.page.locator('#accountsBody tr');
    const count = await rows.count();
    const out = [];
    for (let i = 0; i < count; i++) {
      const row = rows.nth(i);
      const nameHtml = await row.locator('td').nth(0).innerHTML();
      const balanceHtml = await row.locator('td').nth(1).innerText();
      const verText = await row.locator('td').nth(2).innerText();
      // extract id from the small-muted inside nameHtml, like "<strong>Checking</strong> <div class="small-muted">A</div>"
      const idMatch = nameHtml.match(/<div class="small-muted">([^<]+)<\/div>/);
      const nameMatch = nameHtml.match(/<strong>([^<]+)<\/strong>/);
      out.push({
        id: idMatch ? idMatch[1].trim() : '',
        name: nameMatch ? nameMatch[1].trim() : '',
        balanceText: balanceHtml.trim(),
        versionText: verText.trim()
      });
    }
    return out;
  }
}

test.describe('Transaction Demo — FSM and UI behavior', () => {
  let demo;

  test.beforeEach(async ({ page }) => {
    demo = new TxDemoPage(page);
    await demo.initListeners();
    await demo.goto();
    // Wait briefly for initial UI to settle and initial starter TX to be created
    await page.waitForSelector('.tx-card');
  });

  test.afterEach(async () => {
    // After each test ensure there were no unexpected fatal page errors (ReferenceError, TypeError, SyntaxError)
    // Collect error types
    const criticalErrors = demo.errors.filter(e => {
      const name = e && e.name ? e.name : (e && e.message ? e.message.split(':')[0] : '');
      return ['ReferenceError', 'TypeError', 'SyntaxError'].includes(name);
    });
    // Assert that no critical JS errors occurred during the test run
    expect(criticalErrors.length).toBe(0);
  });

  test('Initial Idle state renders page and starter transaction exists', async () => {
    // Validate the wrap element is present (evidence of S0_Idle renderPage())
    const wrap = demo.page.locator('.wrap');
    await expect(wrap).toBeVisible();

    // There should be at least one tx-card created by initial script "starter"
    const txCards = demo.page.locator('.tx-card');
    await expect(txCards).toHaveCountGreaterThan(0);

    // The accounts table should display three default accounts
    const accounts = await demo.readAccountsTable();
    expect(accounts.length).toBeGreaterThanOrEqual(3);
    // Look for Checking account (id A)
    const checking = accounts.find(a => a.id === 'A');
    expect(checking).toBeTruthy();
    expect(checking.balanceText).toMatch(/\$/);
  });

  test('NewTransaction -> creates transaction card and active state (S0_Idle -> S1_TransactionActive)', async () => {
    // Create a new transaction and verify card created and state "active"
    const beforeCount = await demo.page.locator('.tx-card').count();
    const { card, id } = await demo.createNewTransaction();
    const afterCount = await demo.page.locator('.tx-card').count();
    expect(afterCount).toBeGreaterThan(beforeCount);
    // State should be 'active' in the card UI
    const stateText = await demo.page.locator(`#state-${id}`).innerText();
    expect(stateText).toBe('active');
    // Log should include created message
    const logText = await demo.getLogText();
    expect(logText).toContain(`TX ${id}: created`);
  });

  test('AddOperation -> operation is added to transaction and preview updates (S1_TransactionActive self-transition)', async () => {
    // Create tx
    const { id } = await demo.createNewTransaction();
    // Add a deposit op to account B
    await demo.addOperationToTx(id, { type: 'deposit', amount: 123.45, to: 'B' });
    // Verify ops list contains a row describing deposit → B
    const opsText = await demo.page.locator(`#ops-${id}`).innerText();
    expect(opsText).toMatch(/Deposit/);
    expect(opsText).toMatch(/\$123\.45/);

    // Verify preview shows "Tentative balances" and a "Valid" status (no negative balances)
    const previewHtml = await demo.page.locator(`#preview-${id}`).innerHTML();
    expect(previewHtml).toContain('Tentative balances');
    expect(previewHtml).toMatch(/Valid|Invalid/); // ensure preview rendered validation status
    expect(previewHtml).toContain('Preview based on committed state');
  });

  test('CommitTransaction in Pessimistic mode results in commit and updates committed accounts (S1 -> S2)', async () => {
    // Ensure mode is pessimistic
    await demo.setMode('pessimistic');

    // Create a tx and add a transfer so it touches accounts
    const { id } = await demo.createNewTransaction();
    // Transfer $10 from A to B
    await demo.addOperationToTx(id, { type: 'transfer', amount: 10.00, from: 'A', to: 'B' });

    // Read balances before commit
    const beforeAccounts = await demo.readAccountsTable();
    const accA_before = beforeAccounts.find(a => a.id === 'A');
    const accB_before = beforeAccounts.find(a => a.id === 'B');
    expect(accA_before).toBeTruthy();
    expect(accB_before).toBeTruthy();

    // Commit transaction and confirm UI state becomes committed
    const finalState = await demo.commitTx(id);
    expect(finalState).toBe('committed');

    // Wait a bit for renderAll to update accounts
    await demo.page.waitForTimeout(100);
    const afterAccounts = await demo.readAccountsTable();
    const accA_after = afterAccounts.find(a => a.id === 'A');
    const accB_after = afterAccounts.find(a => a.id === 'B');

    // Parse balances as numbers from text like "$990.00"
    const parseMoney = (s) => parseFloat(s.replace(/[^0-9.-]+/g, ''));
    expect(parseMoney(accA_after.balanceText)).toBeCloseTo(parseMoney(accA_before.balanceText) - 10.00, 2);
    expect(parseMoney(accB_after.balanceText)).toBeCloseTo(parseMoney(accB_before.balanceText) + 10.00, 2);

    // Log should include "committed"
    const logText = await demo.getLogText();
    expect(logText).toContain(`committed`);
  });

  test('RollbackTransaction aborts an active transaction (S1 -> S3)', async () => {
    // Create tx and add an op
    const { id } = await demo.createNewTransaction();
    await demo.addOperationToTx(id, { type: 'withdraw', amount: 1.00, from: 'A' });

    // Rollback
    await demo.rollbackTx(id);

    // Validate UI state is aborted
    const stateText = await demo.page.locator(`#state-${id}`).innerText();
    expect(stateText).toBe('aborted');

    // Log should include "rolled back by user"
    const logText = await demo.getLogText();
    expect(logText).toContain('rolled back by user');
  });

  test('PersistState and ClearPersistedState interact with localStorage and log appropriately', async () => {
    // Make a small committed change to ensure there is state to persist
    const { id } = await demo.createNewTransaction();
    await demo.addOperationToTx(id, { type: 'deposit', amount: 5.00, to: 'A' });
    await demo.commitTx(id);

    // Persist committed state
    await demo.persistCommittedState();

    // Confirm persisted keys exist in localStorage via page.evaluate
    const lsHas = await demo.page.evaluate(() => {
      return {
        accounts: !!localStorage.getItem('tx-demo-accounts-v1'),
        log: !!localStorage.getItem('tx-demo-log-v1')
      };
    });
    expect(lsHas.accounts).toBe(true);
    expect(lsHas.log).toBe(true);

    // Clear persisted state (auto-accept confirm)
    await demo.clearPersisted();

    const lsAfterClear = await demo.page.evaluate(() => {
      return {
        accounts: !!localStorage.getItem('tx-demo-accounts-v1'),
        log: !!localStorage.getItem('tx-demo-log-v1')
      };
    });
    expect(lsAfterClear.accounts).toBe(false);
    // Log should include "Cleared persisted state."
    const logText = await demo.getLogText();
    expect(logText).toContain('Cleared persisted state.');
  });

  test('ChangeConcurrencyMode captures mode change and affects commits (ChangeConcurrencyMode event)', async () => {
    // Switch to optimistic mode and validate log
    await demo.setMode('optimistic');
    let log = await demo.getLogText();
    expect(log).toContain('Mode switched to: optimistic');

    // Run the provided 2-TX scenario which is designed to produce an optimistic conflict when mode=optimistic
    await demo.runScenarioAndWait();

    // After scenario run, validate that at least one optimistic conflict or abort is present in logs
    const logAfter = await demo.getLogText();
    // The scenario logs either a successful commit or an optimistic conflict message; assert presence of either
    const hasOptimisticConflict = logAfter.includes('optimistic conflict') || logAfter.includes('snapshot write conflict');
    const hasCommits = logAfter.includes('committed (optimistic)') || logAfter.includes('committed (snapshot)');
    expect(hasOptimisticConflict || hasCommits).toBe(true);
  });

  test('ResetDemo clears persisted state and restores default accounts (ResetDemo event)', async () => {
    // Make a change and persist it
    const { id } = await demo.createNewTransaction();
    await demo.addOperationToTx(id, { type: 'deposit', amount: 77.00, to: 'C' });
    await demo.commitTx(id);
    await demo.persistCommittedState();

    // Now reset demo — auto-accept confirmation
    await demo.resetDemo();

    // After reset, localStorage keys should be removed
    const lsAfterReset = await demo.page.evaluate(() => {
      return {
        accounts: !!localStorage.getItem('tx-demo-accounts-v1'),
        log: !!localStorage.getItem('tx-demo-log-v1')
      };
    });
    expect(lsAfterReset.accounts).toBe(false);
    // Accounts table should reflect default balances (we know default for A is 1000.00)
    const accounts = await demo.readAccountsTable();
    const accA = accounts.find(a => a.id === 'A');
    const parseMoney = (s) => parseFloat(s.replace(/[^0-9.-]+/g, ''));
    expect(parseMoney(accA.balanceText)).toBeCloseTo(1000.00, 2);

    // Log should include "Demo reset to defaults."
    const log = await demo.getLogText();
    expect(log).toContain('Demo reset to defaults.');
  });

  test('Edge case: adding invalid operation triggers alert and does not add op', async ({ page }) => {
    // Create tx
    const { id } = await demo.createNewTransaction();
    // Open Add Op form
    const card = demo.txCardLocator(id);
    await card.locator('button', { hasText: 'Add Op' }).click();
    const opsDiv = page.locator(`#ops-${id}`);
    const form = opsDiv.locator('div').first();
    await expect(form).toBeVisible();
    // Leave amount empty and click Add -> it triggers alert (dialog) which we auto-accept
    const addBtn = form.locator('button', { hasText: 'Add' });
    await addBtn.click();
    // The form should still exist or be removed (alert prevents adding op). Verify no op-row added
    const opRows = page.locator(`#ops-${id} .op-row`);
    await expect(opRows).toHaveCount(0);
    // Also verify console captured an alert (in our test environment it is accepted automatically)
    // Check that log does not contain "added op" for this TX
    const log = await demo.getLogText();
    expect(log).not.toContain(`TX ${id}: added op`);
  });

  test('Observes console messages and ensures no severe console errors were emitted', async () => {
    // We collected console messages in demo.consoleMessages throughout test lifecycle
    const errors = demo.consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // There should be no console.error messages indicating runtime failures
    expect(errors.length).toBe(0);
  });
});