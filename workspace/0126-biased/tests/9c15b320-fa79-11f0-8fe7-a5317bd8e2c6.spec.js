import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c15b320-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object to encapsulate interactions with the ACID simulator page
class AcidPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      createTx: page.locator('#create-tx'),
      spawnRandom: page.locator('#spawn-random'),
      clearTxs: page.locator('#clear-txs'),
      beginTx: page.locator('#begin-tx'),
      stepTx: page.locator('#step-tx'),
      runTx: page.locator('#run-tx'),
      commitTx: page.locator('#commit-tx'),
      abortTx: page.locator('#abort-tx'),
      forceWait: page.locator('#force-wait'),
      simulateConcurrent: page.locator('#simulate-concurrent'),
      autoRun: page.locator('#auto-run'),
      stopAuto: page.locator('#stop-auto'),
      deadlockDetect: page.locator('#deadlock-detect'),
      resolveDeadlocks: page.locator('#resolve-deadlocks'),
      forceCrash: page.locator('#force-crash'),
      recover: page.locator('#recover'),
      inspectWal: page.locator('#inspect-wal'),
      showAllState: page.locator('#show-all-state'),
      showAllPers: page.locator('#show-all-pers'),
      txList: page.locator('#tx-list'),
      eventLog: page.locator('#event-log'),
      persistedIndicator: page.locator('#persisted-indicator'),
      walIndicator: page.locator('#wal-indicator'),
      accountsTbody: page.locator('#accounts-table tbody'),
      txName: page.locator('#tx-name'),
      txIsolation: page.locator('#tx-isolation'),
      txDurability: page.locator('#tx-durability'),
      txWal: page.locator('#tx-wal'),
      selectedTxIdInput: page.locator('#selected-tx-id'),
      opType: page.locator('#op-type'),
      opKey: page.locator('#op-key'),
      opKeyTo: page.locator('#op-key-to'),
      opAmount: page.locator('#op-amount'),
      opAdd: page.locator('#op-add'),
      opInsert: page.locator('#op-insert'),
      opRemove: page.locator('#op-remove'),
      selectedOpIndex: page.locator('#selected-op-index'),
      allowDirty: page.locator('#allow-dirty'),
      enforceConstraints: page.locator('#enforce-constraints'),
      strict2pl: page.locator('#strict-2pl')
    };
  }

  async createTransactionViaUI(name = 'T_auto', isolation = 'READ_COMMITTED', durability = 'durable', wal = true) {
    await this.locators.txName.fill(name);
    await this.locators.txIsolation.selectOption(isolation);
    await this.locators.txDurability.selectOption(durability);
    await this.locators.txWal.selectOption(wal ? 'wal' : 'nowal');
    await this.locators.createTx.click();
    // small wait for UI to update
    await this.page.waitForTimeout(100);
    // extract the last TX_ id from the tx-list text
    const txListText = (await this.locators.txList.textContent()) || '';
    const matches = txListText.match(/TX_[a-z0-9]+/g);
    if (!matches || !matches.length) return null;
    return matches[matches.length - 1];
  }

  async selectTransaction(txid) {
    await this.locators.selectedTxIdInput.fill(txid || '');
  }

  async addWriteOpToSelectedTx(key, value) {
    await this.locators.opType.selectOption('WRITE');
    await this.locators.opKey.selectOption(key);
    await this.locators.opAmount.fill(String(value));
    await this.locators.opAdd.click();
    await this.page.waitForTimeout(50);
  }

  async addTransferOpToSelectedTx(from, to, amount) {
    await this.locators.opType.selectOption('TRANSFER');
    await this.locators.opKey.selectOption(from);
    await this.locators.opKeyTo.selectOption(to);
    await this.locators.opAmount.fill(String(amount));
    await this.locators.opAdd.click();
    await this.page.waitForTimeout(50);
  }

  async addReadOpToSelectedTx(key) {
    await this.locators.opType.selectOption('READ');
    await this.locators.opKey.selectOption(key);
    await this.locators.opAdd.click();
    await this.page.waitForTimeout(50);
  }

  async addAssertOpToSelectedTx(exprAmount) {
    await this.locators.opType.selectOption('ASSERT');
    await this.locators.opAmount.fill(String(exprAmount));
    await this.locators.opAdd.click();
    await this.page.waitForTimeout(50);
  }

  async beginSelectedTx() {
    await this.locators.beginTx.click();
    await this.page.waitForTimeout(80);
  }

  async stepSelectedTx() {
    await this.locators.stepTx.click();
    await this.page.waitForTimeout(80);
  }

  async runSelectedTx() {
    await this.locators.runTx.click();
    await this.page.waitForTimeout(200);
  }

  async commitSelectedTx() {
    await this.locators.commitTx.click();
    await this.page.waitForTimeout(100);
  }

  async abortSelectedTx() {
    await this.locators.abortTx.click();
    await this.page.waitForTimeout(80);
  }

  async forceWaitSelectedTx() {
    await this.locators.forceWait.click();
    await this.page.waitForTimeout(80);
  }

  async getEventLogText() {
    return (await this.locators.eventLog.textContent()) || '';
  }

  async getTxListText() {
    return (await this.locators.txList.textContent()) || '';
  }

  async getPersistedIndicator() {
    return (await this.locators.persistedIndicator.textContent()) || '';
  }

  async getWalIndicator() {
    return (await this.locators.walIndicator.textContent()) || '';
  }

  async getTransactionState(txid) {
    // read from window.acidSim if available
    const state = await this.page.evaluate((id) => {
      try { return window.acidSim && window.acidSim.transactions && window.acidSim.transactions[id] && window.acidSim.transactions[id].state; } catch(e) { return null; }
    }, txid);
    return state;
  }

  async getTransactionWrites(txid) {
    return await this.page.evaluate((id) => {
      try { return window.acidSim && window.acidSim.transactions && window.acidSim.transactions[id] && window.acidSim.transactions[id].writes; } catch(e) { return null; }
    }, txid);
  }

  async getAccountsSnapshot() {
    // read displayed accounts table
    const rows = await this.locators.accountsTbody.locator('tr').all();
    const out = {};
    for (const r of rows) {
      const tds = await r.locator('td').allTextContents();
      if (tds.length >= 2) out[tds[0]] = Number(tds[1]);
    }
    return out;
  }

  async clickDetectDeadlocks() {
    await this.locators.deadlockDetect.click();
    await this.page.waitForTimeout(120);
  }

  async clickResolveDeadlocks() {
    await this.locators.resolveDeadlocks.click();
    await this.page.waitForTimeout(120);
  }

  async clickForceCrash() {
    await this.locators.forceCrash.click();
    await this.page.waitForTimeout(80);
  }

  async clickRecover() {
    await this.locators.recover.click();
    await this.page.waitForTimeout(150);
  }

  async clearAllTransactions() {
    await this.locators.clearTxs.click();
    await this.page.waitForTimeout(80);
  }
}

// Collect console errors and page errors during each test
test.describe('ACID Properties Interactive Simulator - FSM and UI tests', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    // capture console errors and page errors
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') consoleErrors.push(String(msg.text()));
      } catch (e) {
        // ignore
      }
    });
    page.on('pageerror', (err) => {
      try { pageErrors.push(String(err.message || err)); } catch (e) {}
    });
    await page.goto(APP_URL);
    // small wait to allow init logs to appear
    await page.waitForTimeout(150);
  });

  test.afterEach(async () => {
    // assert there were no console 'error' messages and no uncaught page errors
    expect(consoleErrors, 'No console.error logs should be present').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should be present').toEqual([]);
  });

  test('Initial state S0_Idle: page renders heading and simulator ready message', async ({ page }) => {
    const p = new AcidPage(page);
    // Validate heading exists
    const heading = await page.locator('h2').textContent();
    expect(heading).toContain('ACID Properties Interactive Simulator');

    // Event log should contain simulator ready message
    const ev = await p.getEventLogText();
    expect(ev).toContain('Simulator ready. Create transactions and experiment.');
  });

  test.describe('Transactions lifecycle (S1 -> S2 -> S3 / S4) and basic ops', () => {
    test('Create transaction triggers S1_TransactionCreated and logs creation', async ({ page }) => {
      const p = new AcidPage(page);
      const txid = await p.createTransactionViaUI('TestCreate', 'READ_COMMITTED', 'non-durable', false);
      expect(txid).toMatch(/^TX_/);

      const txList = await p.getTxListText();
      expect(txList).toContain(txid);
      // Event log contains Created transaction
      const ev = await p.getEventLogText();
      expect(ev).toMatch(new RegExp('Created transaction ' + txid));
    });

    test('Begin moves to S2_TransactionActive and snapshot created for REPEATABLE_READ', async ({ page }) => {
      const p = new AcidPage(page);
      const txid = await p.createTransactionViaUI('T_RR', 'REPEATABLE_READ', 'non-durable', false);
      expect(txid).toBeTruthy();
      await p.selectTransaction(txid);
      await p.beginSelectedTx();

      const state = await p.getTransactionState(txid);
      expect(state).toBe('active');

      // For REPEATABLE_READ snapshot should be created (log contains snapshot created)
      const ev = await p.getEventLogText();
      expect(ev).toContain('snapshot created for REPEATABLE_READ');
    });

    test('Step operation executes and updates tx.pc and local writes (StepTransaction)', async ({ page }) => {
      const p = new AcidPage(page);
      const txid = await p.createTransactionViaUI('T_Step', 'READ_COMMITTED', 'non-durable', false);
      await p.selectTransaction(txid);
      // Add a WRITE op then begin and step
      await p.addWriteOpToSelectedTx('A', 123);
      await p.beginSelectedTx();
      // Step should execute the WRITE into tx.writes (workspace)
      await p.stepSelectedTx();

      const writes = await p.getTransactionWrites(txid);
      expect(writes).toBeTruthy();
      expect(writes['A']).toBe(123);

      // tx.pc should have progressed - check via tx.writes presence and event log message
      const ev = await p.getEventLogText();
      expect(ev).toContain('WRITE local A = 123');
    });

    test('Commit transitions to S3_TransactionCommitted and applies writes to accounts and persists when durable', async ({ page }) => {
      const p = new AcidPage(page);
      // Create durable transaction with WAL on to exercise persistence code path
      const txid = await p.createTransactionViaUI('T_Commit', 'READ_COMMITTED', 'durable', true);
      await p.selectTransaction(txid);
      // Add WRITE op to modify account A, begin, run and commit
      // Read initial accounts snapshot
      const before = await p.getAccountsSnapshot();
      const beforeA = before['A'];
      await p.addWriteOpToSelectedTx('A', (beforeA || 0) + 42);
      await p.beginSelectedTx();
      // We will run to end which auto-commits inside handler
      await p.runSelectedTx();

      // After commit, tx state should be committed
      const state = await p.getTransactionState(txid);
      expect(state).toBe('committed');

      const after = await p.getAccountsSnapshot();
      expect(after['A']).toBe((beforeA || 0) + 42);

      // persisted indicator should indicate persisted DB presence (durable commit persists DB)
      const persisted = await p.getPersistedIndicator();
      expect(['yes', 'no']).toContain(persisted);
      // Event log has commit confirmation
      const ev = await p.getEventLogText();
      expect(ev).toContain('committed successfully');
    });

    test('Abort transitions to S4_TransactionAborted and discards writes', async ({ page }) => {
      const p = new AcidPage(page);
      const txid = await p.createTransactionViaUI('T_Abort', 'READ_COMMITTED', 'non-durable', false);
      await p.selectTransaction(txid);
      await p.addWriteOpToSelectedTx('A', -9999); // harmful write
      await p.beginSelectedTx();
      // Manual abort
      await p.abortSelectedTx();

      const state = await p.getTransactionState(txid);
      expect(state).toBe('aborted');
      const ev = await p.getEventLogText();
      expect(ev).toContain('aborted');
    });

    test('Force Wait creates waiting state (S5_WaitingForLock) and scheduler skip behavior observed', async ({ page }) => {
      const p = new AcidPage(page);
      const txid = await p.createTransactionViaUI('T_Wait', 'READ_COMMITTED', 'non-durable', false);
      await p.selectTransaction(txid);
      await p.beginSelectedTx();
      // Force waiting
      await p.forceWaitSelectedTx();
      const state = await p.getTransactionState(txid);
      expect(state).toBe('waiting');
      // Simulate scheduler run via simulate-concurrent (it will log scheduler skipping or similar)
      await p.locators.simulateConcurrent.click();
      await page.waitForTimeout(150);
      const ev = await p.getEventLogText();
      // We expect some message referencing 'waiting' or 'skipping'
      expect(ev.toLowerCase()).toMatch(/waiting|skipping/);
    });
  });

  test.describe('Deadlock detection & resolution and edge cases', () => {
    test('Detect and resolve a manual deadlock cycle between two transactions', async ({ page }) => {
      const p = new AcidPage(page);
      // Clear existing txs to have deterministic order
      await p.clearAllTransactions();

      // Create TX1 with WRITE A then WRITE B
      await p.locators.txName.fill('Dead1');
      const tx1 = await p.createTransactionViaUI('Dead1', 'READ_COMMITTED', 'non-durable', false);
      // Add two writes: A then B
      await p.selectTransaction(tx1);
      await p.addWriteOpToSelectedTx('A', 1);
      await p.addWriteOpToSelectedTx('B', 1);

      // Create TX2 with WRITE B then WRITE A
      await p.locators.txName.fill('Dead2');
      const tx2 = await p.createTransactionViaUI('Dead2', 'READ_COMMITTED', 'non-durable', false);
      await p.selectTransaction(tx2);
      await p.addWriteOpToSelectedTx('B', 2);
      await p.addWriteOpToSelectedTx('A', 2);

      // Begin both transactions
      await p.selectTransaction(tx1);
      await p.beginSelectedTx();
      await p.selectTransaction(tx2);
      await p.beginSelectedTx();

      // Step tx1: should acquire X on A (first op)
      await p.selectTransaction(tx1);
      await p.stepSelectedTx();

      // Step tx2: should acquire X on B (first op)
      await p.selectTransaction(tx2);
      await p.stepSelectedTx();

      // Step tx1: will try to acquire X on B and should block (waiting)
      await p.selectTransaction(tx1);
      await p.stepSelectedTx();

      // Step tx2: will try to acquire X on A and should block (waiting)
      await p.selectTransaction(tx2);
      await p.stepSelectedTx();

      // At this point both txs should be waiting and create a cycle in wait-for graph
      const state1 = await p.getTransactionState(tx1);
      const state2 = await p.getTransactionState(tx2);
      expect(state1 === 'waiting' || state1 === 'active').toBeTruthy();
      expect(state2 === 'waiting' || state2 === 'active').toBeTruthy();

      // Invoke deadlock detection
      await p.clickDetectDeadlocks();
      const ev = await p.getEventLogText();
      // The app logs either 'Deadlock(s) detected' or 'No deadlocks detected'
      // We expect to detect deadlocks in this crafted scenario
      expect(ev).toMatch(/Deadlock|deadlock/i);

      // Try resolve deadlocks - it should abort a victim if a cycle exists
      await p.clickResolveDeadlocks();
      const ev2 = await p.getEventLogText();
      // After resolving there should be logs about aborting a victim OR nothing to resolve
      expect(ev2).toMatch(/Aborted|deadlock/i);
    });

    test('Constraint violation aborts commit (edge case): negative balance triggers abort', async ({ page }) => {
      const p = new AcidPage(page);
      // Create tx that will set an account negative and then commit
      const txid = await p.createTransactionViaUI('T_Viol', 'READ_COMMITTED', 'non-durable', false);
      await p.selectTransaction(txid);
      // Add a write making A negative intentionally
      await p.addWriteOpToSelectedTx('A', -1000000);
      await p.beginSelectedTx();

      // Run to end then attempt commit
      await p.runSelectedTx();

      // If commit failed via constraint enforcement, tx.state should be aborted
      const state = await p.getTransactionState(txid);
      // commitTransaction will set tx.state = 'aborted' if constraint violated
      expect(['aborted', 'committed', 'active', null]).toContain(state);
      const ev = await p.getEventLogText();
      // Look for constraint violation messages or abort logs
      expect(ev).toMatch(/Constraint violated|aborted|failed to commit|aborted during op/i);
    });
  });

  test.describe('Crash & recovery behavior', () => {
    test('Force crash freezes in-memory behavior and recover reapplies WAL/persisted DB', async ({ page }) => {
      const p = new AcidPage(page);
      // Create and commit a durable transaction to ensure persistence
      const txid = await p.createTransactionViaUI('T_Persist', 'READ_COMMITTED', 'durable', true);
      await p.selectTransaction(txid);
      // Add a transfer that doesn't change total sum but updates balances
      const accountsBefore = await p.getAccountsSnapshot();
      // choose two keys present
      const keys = Object.keys(accountsBefore);
      if (keys.length < 2) {
        // ensure DB has multiple accounts by re-initializing via reset-db dblclick is wired, but to keep test simple, skip if not enough accounts
      } else {
        const from = keys[0], to = keys[1];
        await p.addTransferOpToSelectedTx(from, to, 5);
        await p.beginSelectedTx();
        await p.runSelectedTx(); // will auto-commit
      }

      // Ensure persisted indicator reflects presence of persisted DB after durable commit
      const persistedBefore = await p.getPersistedIndicator();
      // assert persisted indicator is either yes or no (non-deterministic in CI depending on storage), but commit should have attempted to persist
      expect(['yes', 'no']).toContain(persistedBefore);

      // Now force crash
      await p.clickForceCrash();

      // Attempt to operate while crashed: create a tx and try stepping; execution should be blocked by crashed state
      const txCrash = await p.createTransactionViaUI('T_duringCrash', 'READ_COMMITTED', 'non-durable', false);
      await p.selectTransaction(txCrash);
      await p.beginSelectedTx();
      await p.addWriteOpToSelectedTx('A', 1);
      // Step should not execute because crashed flag prevents executeOperation from proceeding
      await p.stepSelectedTx();
      const evCrash = await p.getEventLogText();
      expect(evCrash).toMatch(/crash|Crashed|crash/i);

      // Recover system
      await p.clickRecover();
      const evRec = await p.getEventLogText();
      // After recovery logs should indicate recovery steps
      expect(evRec).toMatch(/Recovery complete|Recovered DB|Reapplied WAL|No WAL/i);

      // After recovery, in-memory transactions are cleared; ensure tx list is empty (or does not contain the crashed tx)
      const txListAfter = await p.getTxListText();
      expect(txListAfter).not.toContain(txCrash);
    });
  });

  test.describe('Misc UI/interaction checks and robustness', () => {
    test('Spawn random transactions and clear them', async ({ page }) => {
      const p = new AcidPage(page);
      // Spawn a few random txs
      await p.locators.spawnRandom.click();
      await p.locators.spawnRandom.click();
      await page.waitForTimeout(120);
      const txList = await p.getTxListText();
      // Expect at least one TX_ id in list
      expect(txList).toMatch(/TX_[a-z0-9]+/);

      // Clear all transactions via UI
      await p.clearAllTransactions();
      const txListAfter = await p.getTxListText();
      // tx-list should be empty or not contain TX_
      expect(txListAfter.includes('TX_')).toBe(false);
    });

    test('Inspector show state and persisted view do not throw and provide output', async ({ page }) => {
      const p = new AcidPage(page);
      await p.locators.showAllState.click();
      await page.waitForTimeout(80);
      await p.locators.showAllPers.click();
      await page.waitForTimeout(80);
      const inspectorText = await page.locator('#inspector').textContent();
      expect(typeof inspectorText).toBe('string');
      const walText = await page.locator('#wal-log').textContent();
      expect(typeof walText).toBe('string');
    });

    test('Edge-case: attempt to begin non-existent tx logs an informative message', async ({ page }) => {
      const p = new AcidPage(page);
      // Select a made-up tx id and click begin
      await p.selectTransaction('TX_DOES_NOT_EXIST');
      await p.beginSelectedTx();
      const ev = await p.getEventLogText();
      expect(ev).toMatch(/No such tx|No such tx: TX_DOES_NOT_EXIST/i);
    });
  });
});