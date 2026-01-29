import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d9ba50-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('ACID Properties Demo — end-to-end (d3d9ba50-fa73-11f0-83e0-8d7be1d51901)', () => {
  // Shared helpers to collect console messages, page errors and dialogs
  test.beforeEach(async ({ page }) => {
    // No-op; individual tests will set up listeners per-test to isolate results
  });

  test.describe('Initial render and S0_Idle state', () => {
    test('renders database UI and shows initial totals (S0_Idle entry_actions: renderDb)', async ({ page }) => {
      const consoles = [];
      const pageErrors = [];
      const dialogs = [];

      page.on('console', (msg) => consoles.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('dialog', async (dialog) => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        // Accept any dialog to continue automated flow
        await dialog.accept();
      });

      await page.goto(BASE);

      // Verify accounts rendered
      const accountEls = await page.locator('#accounts .acct').all();
      expect(accountEls.length).toBeGreaterThanOrEqual(3); // Alice, Bob, Carol

      // Check total sum text matches expected initial total $230.00 (100 + 80 + 50)
      const totalText = await page.locator('#totalSum').textContent();
      expect(totalText).toBe('$230.00');

      // DB status contains "Initial total"
      const dbStatus = await page.locator('#dbStatus').textContent();
      expect(dbStatus).toContain('Initial total');

      // Log seeded messages include "Demo loaded"
      const logHtml = await page.locator('#log').innerHTML();
      expect(logHtml).toContain('Demo loaded');

      // Ensure no uncaught page errors during initial render
      expect(pageErrors.length).toBe(0);

      // Ensure console contains expected seeded messages
      const joined = consoles.map(c => c.text).join('||');
      expect(joined).toContain('Demo loaded');
      expect(joined).toContain('Start by creating a transaction'); // from the second seeded log
    });
  });

  test.describe('Transactions lifecycle and transitions (S0 -> S1 -> S2/S3)', () => {
    test('Start Transaction -> select it -> ApplyOperation -> Commit (serializable) -> db updated (S0 -> S1 -> S2)', async ({ page }) => {
      const consoles = [];
      const pageErrors = [];
      const dialogs = [];

      page.on('console', (msg) => consoles.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('dialog', async (dialog) => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        // For informational alerts accept automatically
        await dialog.accept();
      });

      await page.goto(BASE);

      // Start a transaction (StartTransaction event)
      await page.click('#newTxn');

      // After starting, txn list should contain an entry (T1)
      const txnItems = page.locator('#txnList .txn');
      await expect(txnItems).toHaveCount(1);

      // Select the transaction to move UI into "transaction detail" view (renderTxnDetail)
      await txnItems.first().click();

      // txnDetail should show the transaction id and (active)
      await expect(page.locator('#txnDetail')).toContainText('(active)');

      // Apply an operation: choose From Alice -> To Bob amount 10 (ApplyOperation)
      await page.selectOption('#fromAcct', 'Alice');
      await page.selectOption('#toAcct', 'Bob');
      await page.fill('#amount', '10');
      await page.click('#applyOp');

      // Log should contain applied op
      const foundApplied = consoles.some(c => c.text.includes('Applied op') || c.text.includes('Applied op'));
      expect(foundApplied).toBeTruthy();

      // The txn detail ops list should include the operation
      await expect(page.locator('#txnDetail .ops')).toContainText('Alice -> Bob');

      // Commit the selected transaction (CommitTransaction)
      await page.click('#commitTxn');

      // After commit, the txn in the list should show 'committed'
      await expect(page.locator('#txnList .txn')).toContainText('committed');

      // Database (committed) should be updated: Alice decreased by 10, Bob increased by 10
      // Read account balances text
      const accounts = await page.locator('#accounts .acct').allTextContents();
      // Find Alice and Bob entries
      const alice = accounts.find(t => t.includes('Alice'));
      const bob = accounts.find(t => t.includes('Bob'));
      expect(alice).toBeDefined();
      expect(bob).toBeDefined();
      // Alice should now be $90.00 and Bob $90.00
      expect(alice).toContain('$90.00');
      expect(bob).toContain('$90.00');

      // Total should remain $230.00 (consistency)
      const totalText = await page.locator('#totalSum').textContent();
      expect(totalText).toBe('$230.00');

      // No uncaught runtime errors
      expect(pageErrors.length).toBe(0);

      // Console logs should include a committed message
      expect(consoles.some(c => c.text.includes('committed'))).toBeTruthy();
    });

    test('Start Transaction -> ApplyOperation -> Rollback -> transaction becomes aborted and DB unchanged (S1 -> S3)', async ({ page }) => {
      const consoles = [];
      const pageErrors = [];
      const dialogs = [];

      page.on('console', (msg) => consoles.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('dialog', async (dialog) => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        await dialog.accept();
      });

      await page.goto(BASE);

      // Record db snapshot before actions
      const beforeAlice = await page.locator('#accounts .acct').nth(0).textContent();
      const beforeTotal = await page.locator('#totalSum').textContent();

      // Start a transaction
      await page.click('#newTxn');
      await page.locator('#txnList .txn').first().click();

      // Apply op: Alice -> Carol 5
      await page.selectOption('#fromAcct', 'Alice');
      await page.selectOption('#toAcct', 'Carol');
      await page.fill('#amount', '5');
      await page.click('#applyOp');

      // Rollback selected transaction via rollback button in the transaction detail area (rendered one)
      // There is a rollback button inside txnDetail actions with text 'Rollback'; click it
      await page.locator('#txnDetail button', { hasText: 'Rollback' }).click();

      // Txn should show as 'aborted'
      await expect(page.locator('#txnList .txn')).toContainText('aborted');

      // DB should remain unchanged compared to snapshot prior to transaction
      const afterAlice = await page.locator('#accounts .acct').nth(0).textContent();
      const afterTotal = await page.locator('#totalSum').textContent();
      expect(afterAlice).toBe(beforeAlice);
      expect(afterTotal).toBe(beforeTotal);

      // Console logs should include 'rolled back.'
      expect(consoles.some(c => c.text.includes('rolled back'))).toBeTruthy();

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Attempt to ApplyOperation without selecting a transaction shows alert (edge case)', async ({ page }) => {
      const dialogs = [];
      const pageErrors = [];

      page.on('dialog', async (dialog) => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        await dialog.accept();
      });
      page.on('pageerror', (err) => pageErrors.push(err));

      await page.goto(BASE);

      // Ensure no transaction selected and try to apply operation; should alert 'Select a transaction first'
      await page.selectOption('#fromAcct', 'Alice');
      await page.selectOption('#toAcct', 'Bob');
      await page.fill('#amount', '5');

      await page.click('#applyOp');

      // Expect a dialog with message about selecting a transaction
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const matched = dialogs.some(d => d.message.includes('Select a transaction'));
      expect(matched).toBeTruthy();

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Applying invalid operation (from == to) triggers alert and is not applied', async ({ page }) => {
      const dialogs = [];
      const pageErrors = [];

      page.on('dialog', async (dialog) => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        await dialog.accept();
      });
      page.on('pageerror', (err) => pageErrors.push(err));

      await page.goto(BASE);

      // Start and select transaction
      await page.click('#newTxn');
      await page.locator('#txnList .txn').first().click();

      // Set same from and to
      await page.selectOption('#fromAcct', 'Alice');
      await page.selectOption('#toAcct', 'Alice');
      await page.fill('#amount', '5');

      await page.click('#applyOp');

      // Expect an alert about From and To must be different
      expect(dialogs.some(d => d.message.includes('From and To must be different'))).toBeTruthy();

      // Also verify ops list does not include the invalid operation
      const opsText = await page.locator('#txnDetail .ops').textContent();
      expect(opsText).not.toContain('Alice -> Alice');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('CloseAllTransactions, ResetDatabase, SimulateCrash flows', () => {
    test('CloseAllTransactions closes all in-memory transactions (S1 -> S0)', async ({ page }) => {
      const consoles = [];
      const pageErrors = [];
      const dialogs = [];

      page.on('console', (msg) => consoles.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('dialog', async (dialog) => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        // The Close All button triggers a confirm. Accept it.
        await dialog.accept();
      });

      await page.goto(BASE);

      // Create two transactions
      await page.click('#newTxn');
      await page.click('#newTxn');

      // There should be two txn items
      await expect(page.locator('#txnList .txn')).toHaveCount(2);

      // Click Close All (which triggers a confirm) and ensure dialog accepted
      await page.click('#closeAll');

      // After closing all, txn list should be empty
      await expect(page.locator('#txnList .txn')).toHaveCount(0);

      // txnDetail should ask to select a transaction
      await expect(page.locator('#txnDetail')).toContainText('Select a transaction to view details');

      // Console should include 'Closed all transactions'
      expect(consoles.some(c => c.text.includes('Closed all transactions'))).toBeTruthy();

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('ResetDatabase resets committed DB to initial values (S0 -> S0)', async ({ page }) => {
      const consoles = [];
      const pageErrors = [];
      const dialogs = [];

      page.on('console', (msg) => consoles.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('dialog', async (dialog) => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        // The Reset DB button triggers a confirm; accept it.
        await dialog.accept();
      });

      await page.goto(BASE);

      // Make a committed change to ensure reset has visible effect:
      // Start txn, select it, apply op Alice->Bob 10, commit
      await page.click('#newTxn');
      await page.locator('#txnList .txn').first().click();
      await page.selectOption('#fromAcct', 'Alice');
      await page.selectOption('#toAcct', 'Bob');
      await page.fill('#amount', '10');
      await page.click('#applyOp');
      await page.click('#commitTxn');

      // Confirm database changed: Alice decreased by 10
      const aliceAfterCommit = await page.locator('#accounts .acct').nth(0).textContent();
      expect(aliceAfterCommit).toContain('$90.00');

      // Now click Reset DB (confirm dialog handled by listener)
      await page.click('#resetDb');

      // After reset, accounts should be back to original values (Alice $100.00)
      const aliceAfterReset = await page.locator('#accounts .acct').nth(0).textContent();
      expect(aliceAfterReset).toContain('$100.00');

      // Console should include reset message
      expect(consoles.some(c => c.text.includes('Database reset to initial state'))).toBeTruthy();

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('SimulateCrash reloads the page and uncommitted transactions are lost; committed persists', async ({ page }) => {
      const consoles = [];
      const pageErrors = [];
      const dialogs = [];

      page.on('console', (msg) => consoles.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('dialog', async (dialog) => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        // Accept any informational alerts
        await dialog.accept();
      });

      await page.goto(BASE);

      // Ensure a known committed baseline: reset DB to defaults via the UI to be certain
      // resetDb triggers a confirm; accept it
      page.once('dialog', async (d) => d.accept());
      await page.click('#resetDb');

      // Create one committed change and one uncommitted transaction
      // 1) committed transaction: Alice -> Bob 10
      await page.click('#newTxn');
      await page.locator('#txnList .txn').first().click();
      await page.selectOption('#fromAcct', 'Alice');
      await page.selectOption('#toAcct', 'Bob');
      await page.fill('#amount', '10');
      await page.click('#applyOp');
      await page.click('#commitTxn');
      // 2) uncommitted transaction: T2 that withdraws 20 from Alice but not committed
      await page.click('#newTxn');
      // Select new transaction (it will be second)
      await page.locator('#txnList .txn').nth(1).click();
      await page.selectOption('#fromAcct', 'Alice');
      await page.selectOption('#toAcct', 'Carol');
      await page.fill('#amount', '20');
      await page.click('#applyOp');

      // Now simulate crash (this triggers a setTimeout reload). We must wait for navigation.
      const [ navigation ] = await Promise.all([
        page.waitForNavigation({ waitUntil: 'load', timeout: 5000 }),
        page.click('#simulateCrash')
      ]);

      // After reload, in-memory transactions should be gone
      await expect(page.locator('#txnList .txn')).toHaveCount(0);

      // Committed DB changes should persist (Alice had 100 -> after committed 10 withdrawn => 90)
      // Because we reset then committed an Alice->Bob 10 earlier, Alice should be $90.00
      const alice = await page.locator('#accounts .acct').nth(0).textContent();
      expect(alice).toContain('$90.00');

      // There should be a console log about simulating crash (the log is written before reload)
      expect(consoles.some(c => c.text.includes('Simulating crash'))).toBeTruthy();

      // No uncaught page errors after reload
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Concurrency and isolation behaviors', () => {
    test('Serializable mode prevents committing a transaction that conflicts with interim commits', async ({ page }) => {
      const consoles = [];
      const pageErrors = [];
      const dialogs = [];

      page.on('console', (msg) => consoles.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('dialog', async (dialog) => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        // Accept alerts used to notify conflicts
        await dialog.accept();
      });

      await page.goto(BASE);

      // Ensure isolation mode is serializable (default checked). No change necessary.
      // Start transaction A
      await page.click('#newTxn');
      // Start transaction B
      await page.click('#newTxn');

      // Select txn A (first)
      await page.locator('#txnList .txn').first().click();
      // Make A withdraw 10 from Alice
      await page.selectOption('#fromAcct', 'Alice');
      await page.selectOption('#toAcct', 'Bob');
      await page.fill('#amount', '10');
      await page.click('#applyOp');

      // Select txn B (second)
      await page.locator('#txnList .txn').nth(1).click();
      // Make B withdraw 20 from Alice
      await page.selectOption('#fromAcct', 'Alice');
      await page.selectOption('#toAcct', 'Carol');
      await page.fill('#amount', '20');
      await page.click('#applyOp');

      // Commit transaction A first
      await page.locator('#txnList .txn').first().click();
      await page.click('#commitTxn');

      // Now attempt to commit transaction B: in serializable mode it should detect conflict and abort
      await page.locator('#txnList .txn').nth(1).click();
      // Commit B and expect an alert or a log about conflict and that the transaction became aborted
      await page.click('#commitTxn');

      // After attempted commit, the second txn should be 'aborted' if conflict detected
      await expect(page.locator('#txnList .txn')).toContainText('aborted');

      // Console should include a commit-abort/conflict message
      const conflictLogged = consoles.some(c => c.text.includes('Commit aborted') || c.text.includes('aborted due to conflict'));
      expect(conflictLogged || consoles.some(c => c.text.includes('Commit aborted due to conflict'))).toBeTruthy();

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('No Isolation mode allows last-writer-wins anomalies', async ({ page }) => {
      const consoles = [];
      const pageErrors = [];
      const dialogs = [];

      page.on('console', (msg) => consoles.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('dialog', async (dialog) => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        await dialog.accept();
      });

      await page.goto(BASE);

      // Select 'No Isolation' radio
      await page.locator('input[name="isolation"][value="none"]').check();

      // Create two transactions that modify the same account
      await page.click('#newTxn'); // T1
      await page.click('#newTxn'); // T2

      // T1: withdraw 10 from Alice
      await page.locator('#txnList .txn').first().click();
      await page.selectOption('#fromAcct', 'Alice');
      await page.selectOption('#toAcct', 'Bob');
      await page.fill('#amount', '10');
      await page.click('#applyOp');

      // T2: withdraw 20 from Alice
      await page.locator('#txnList .txn').nth(1).click();
      await page.selectOption('#fromAcct', 'Alice');
      await page.selectOption('#toAcct', 'Carol');
      await page.fill('#amount', '20');
      await page.click('#applyOp');

      // Commit T1 first
      await page.locator('#txnList .txn').first().click();
      await page.click('#commitTxn');

      // Commit T2 afterwards (no isolation mode => last-writer-wins, it should succeed and overwrite)
      await page.locator('#txnList .txn').nth(1).click();
      await page.click('#commitTxn');

      // After both commits, the final Alice balance should reflect the last committed workspace (T2's change)
      // Starting from $100, T1 => $90, T2 => $80, so expect $80
      const alice = await page.locator('#accounts .acct').nth(0).textContent();
      expect(alice).toContain('$80.00');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Observability: console and runtime errors', () => {
    test('captures console logs and ensures no uncaught exceptions during normal operations', async ({ page }) => {
      const consoles = [];
      const pageErrors = [];

      page.on('console', (msg) => consoles.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));

      await page.goto(BASE);

      // Perform a few basic operations to generate logs
      await page.click('#newTxn');
      await page.locator('#txnList .txn').first().click();
      await page.selectOption('#fromAcct', 'Alice');
      await page.selectOption('#toAcct', 'Bob');
      await page.fill('#amount', '1');
      await page.click('#applyOp');
      await page.click('#commitTxn');

      // Ensure some console entries recorded (start, applied op, committed)
      const joined = consoles.map(c => c.text).join('||');
      expect(joined).toContain('Started transaction');
      expect(joined).toContain('Applied op');
      expect(joined).toContain('committed');

      // Assert that there are no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });
});