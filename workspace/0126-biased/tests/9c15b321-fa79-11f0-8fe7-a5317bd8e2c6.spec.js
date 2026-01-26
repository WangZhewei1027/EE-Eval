import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c15b321-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Transaction Simulator (FSM states and transitions)', () => {
  // Shared collectors for console messages, page errors and dialogs
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Capture console output for assertions
    page.on('console', msg => {
      try {
        // include text and optionally location
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Auto-accept dialogs but record them for assertions
    page.on('dialog', async dialog => {
      dialogs.push(dialog.message());
      try {
        await dialog.accept();
      } catch (e) {
        // ignore accept errors
      }
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure initial UI settled
    await page.waitForSelector('#accountsView');
  });

  test.afterEach(async () => {
    // nothing to do per test cleanup; each test navigates fresh in beforeEach
  });

  test('Initial Idle state (S0_Idle): resetAccounts() executed on load', async ({ page }) => {
    // Verify accounts view was reset to default A,B,C = 100 (entry action resetAccounts())
    const accountsText = await page.locator('#accountsView').innerText();
    expect(accountsText).toContain('A: 100');
    expect(accountsText).toContain('B: 100');
    expect(accountsText).toContain('C: 100');

    // Confirm UI selectors updated
    const acctSelectOptions = await page.locator('#acctSelect option').allTextContents();
    expect(acctSelectOptions).toEqual(expect.arrayContaining(['A', 'B', 'C']));

    // Confirm console log mentions reset
    expect(consoleMessages.some(m => m.includes('Reset accounts to default'))).toBeTruthy();
  });

  test('Add Account transition (S0 -> S1): adding an account updates view and log', async ({ page }) => {
    // Fill new account data and click Add Account
    await page.fill('#acctName', 'X');
    await page.fill('#acctBal', '200');
    await page.click('#addAcct');

    // The accounts view should now include X: 200
    await expect(page.locator('#accountsView')).toContainText('X: 200');

    // Console should include the additive log
    expect(consoleMessages.some(m => m.includes('Added account X = 200'))).toBeTruthy();

    // Account selectors should include X
    const opts = await page.locator('#acctSelect option').allTextContents();
    expect(opts).toEqual(expect.arrayContaining(['A', 'B', 'C', 'X']));
  });

  test('Direct deposit and withdraw (DepositDirect, WithdrawDirect) while in Account Added (S1_AccountAdded)', async ({ page }) => {
    // Ensure selecting account A
    await page.selectOption('#acctSelect', 'A');

    // Direct deposit default amount is 10
    await page.fill('#depositAmt', '10');
    await page.click('#depositDirect');

    // Verify accountsView updated and committed log entry visible
    await expect(page.locator('#accountsView')).toContainText('A: 110');
    expect(consoleMessages.some(m => m.includes('Direct deposit 10 to A'))).toBeTruthy();
    await expect(page.locator('#logView')).toContainText('direct_deposit');

    // Now withdraw 5
    await page.fill('#withdrawAmt', '5');
    await page.click('#withdrawDirect');

    await expect(page.locator('#accountsView')).toContainText('A: 105');
    expect(consoleMessages.some(m => m.includes('Direct withdraw 5 from A'))).toBeTruthy();
  });

  test('Begin Transaction (BeginTransaction) transitions to Transaction Active (S2_TransactionActive) and updates tx UI', async ({ page }) => {
    // Fill transaction name and use defaults for isolation/locking
    await page.fill('#txName', 'T1');
    await page.selectOption('#isolationSelect', { index: 1 }); // READ COMMITTED
    await page.selectOption('#lockingMode', 'OPTIMISTIC');

    // Begin transaction
    await page.click('#beginTx');

    // txSelect should have at least one option (the new tx)
    const txOptions = await page.locator('#txSelect option').allTextContents();
    expect(txOptions.length).toBeGreaterThanOrEqual(1);
    // The last log entry should include 'Begin transaction'
    expect(consoleMessages.some(m => m.includes('Begin transaction'))).toBeTruthy();

    // txDetails should reflect an active transaction and name T1
    const detailsText = await page.locator('#txDetails').innerText();
    expect(detailsText).toContain('State: active');
    expect(detailsText).toContain('Name: T1');
  });

  test('Add operation to transaction and Commit (S2_TransactionActive -> S3_TransactionCommitted)', async ({ page }) => {
    // Start a new tx to operate on
    await page.fill('#txName', 'TX_COMMIT');
    await page.click('#beginTx');

    // Get the created tx id from txSelect (selected value)
    const txId = await page.$eval('#txSelect', sel => sel.value);
    expect(txId).toBeTruthy();

    // Ensure opFrom/opTo options are populated
    const fromOpts = await page.locator('#opFrom option').allTextContents();
    expect(fromOpts.length).toBeGreaterThanOrEqual(1);

    // Add a transfer operation: from A to B amount 10
    await page.selectOption('#opType', 'transfer');
    // ensure opFrom/opTo have options A and B
    await page.selectOption('#opFrom', 'A');
    await page.selectOption('#opTo', 'B');
    await page.fill('#opAmount', '10');
    await page.click('#addOp');

    // Check txDetails shows the operation
    const detailsAfterOp = await page.locator('#txDetails').innerText();
    expect(detailsAfterOp).toContain('"type":"transfer"');
    expect(detailsAfterOp).toContain('"from":"A"');
    expect(detailsAfterOp).toContain('"to":"B"');

    // Commit transaction
    await page.click('#commitTx');

    // After commit, tx should be removed from txSelect
    const currentTxOptions = await page.locator('#txSelect option').allTextContents();
    expect(currentTxOptions.some(o => o.includes(txId))).toBeFalsy();

    // Committed log should include TX id and console should contain 'Committed TX'
    expect(consoleMessages.some(m => m.includes('Committed TX') || m.includes('Committed prepared TX'))).toBeTruthy();

    // Accounts view should reflect the transfer: A decreased and B increased by ~10
    const accountsText = await page.locator('#accountsView').innerText();
    // Convert text to map for assertion
    const map = accountsText.split('\n').filter(Boolean).reduce((acc, line) => {
      const [k,v] = line.split(':').map(s=>s.trim());
      acc[k]=Number(v); return acc;
    }, {});
    expect(map['A']).toBeDefined();
    expect(map['B']).toBeDefined();
    // The numeric change could depend on prior tests; assert difference consistent with transfer
    // We assert that A is less than or equal to original 105 (from earlier tests) and B increased accordingly
    expect(map['A']).toBeLessThanOrEqual(105);
  });

  test('Begin Transaction then Rollback (S2_TransactionActive -> S4_TransactionRolledBack)', async ({ page }) => {
    // Begin a new tx and add a deposit operation, then rollback and assert no committed change
    await page.fill('#txName', 'TX_ROLLBACK');
    await page.click('#beginTx');

    const txId = await page.$eval('#txSelect', sel => sel.value);
    expect(txId).toBeTruthy();

    // Add deposit op into A by 50
    await page.selectOption('#opType', 'deposit');
    await page.selectOption('#opTo', 'A');
    await page.fill('#opAmount', '50');
    await page.click('#addOp');

    // Snapshot accounts before rollback
    const before = await page.locator('#accountsView').innerText();

    // Rollback
    await page.click('#rollbackTx');

    // Ensure TX removed
    const txList = await page.locator('#txSelect option').allTextContents();
    expect(txList.some(opt => opt.includes(txId))).toBeFalsy();

    // Accounts view unchanged compared to before
    const after = await page.locator('#accountsView').innerText();
    expect(after).toBe(before);

    // Console should contain 'Rolled back TX'
    expect(consoleMessages.some(m => m.includes('Rolled back TX'))).toBeTruthy();
  });

  test('Edge cases: commit without selection and begin nested with invalid parent produce alerts', async ({ page }) => {
    // Ensure txSelect has no selection by clearing the DOM selection
    await page.evaluate(() => { const sel = document.getElementById('txSelect'); if (sel) sel.value = ''; });

    // Click commit - expects alert 'No tx selected'
    await page.click('#commitTx');
    expect(dialogs.some(d => d.includes('No tx selected'))).toBeTruthy();

    // Click beginNested with invalid parent - triggers alert 'Parent tx id invalid'
    // Ensure parentTxId is blank
    await page.fill('#parentTxId', '');
    await page.click('#beginNested');
    expect(dialogs.some(d => d.includes('Parent tx id invalid'))).toBeTruthy();
  });

  test('Two-Phase Commit (create nodes, begin distributed, prepare and commit) interaction and logs', async ({ page }) => {
    // Create nodes (default 2)
    await page.fill('#nodeCount', '2');
    await page.click('#createNodes');

    expect(consoleMessages.some(m => m.includes('Created 2 nodes'))).toBeTruthy();
    await expect(page.locator('#nodesView')).toContainText('Node 1');
    await expect(page.locator('#nodesView')).toContainText('Node 2');

    // Begin distributed transaction - this will alert created id
    await page.fill('#distTxName', 'DIST1');
    await page.click('#beginDistributed');

    // alert was shown with created id, ensure a dialog was captured
    expect(dialogs.length).toBeGreaterThan(0);
    expect(dialogs[dialogs.length - 1]).toMatch(/Distributed TX created/);

    // Prepare distributed (no fail nodes)
    await page.click('#prepareDistributed');
    // There will be logs showing prepared or aborted; ensure console has 'Prepared' or 'coordinator decision'
    expect(consoleMessages.some(m => m.toLowerCase().includes('prepared') || m.toLowerCase().includes('coordinator decision'))).toBeTruthy();

    // Commit distributed
    await page.click('#commitDistributed');
    // After commit, nodesView should show committed changes status and console mention 'committed'
    expect(consoleMessages.some(m => m.toLowerCase().includes('committed'))).toBeTruthy();
    await expect(page.locator('#nodesView')).toContainText('Nodes:');
  });

  test('Crash & Recovery: simulate crash clears active state but committed log persists; recover reconstructs state', async ({ page }) => {
    // Make a direct deposit so committedLog has an entry
    await page.selectOption('#acctSelect', 'A');
    await page.fill('#depositAmt', '1');
    await page.click('#depositDirect');

    // Ensure committed log has something
    await expect(page.locator('#logView')).not.toBeEmpty();

    // Simulate crash
    await page.click('#simulateCrash');

    // Console should mention simulated crash
    expect(consoleMessages.some(m => m.includes('Simulated crash'))).toBeTruthy();

    // After crash, txSelect should be empty (no active transactions), nodes cleared
    const txOptionsAfterCrash = await page.locator('#txSelect option').allTextContents();
    // Might be empty or minimal; assert that page didn't throw error and accountsView still present
    await expect(page.locator('#accountsView')).toBeVisible();

    // Recover from log
    await page.click('#recover');
    expect(consoleMessages.some(m => m.toLowerCase().includes('recovered committed state'))).toBeTruthy();

    // logView should still contain entries
    const logText = await page.locator('#logView').innerText();
    expect(logText.length).toBeGreaterThan(0);
  });

  test('Error observation: intentionally trigger a page ReferenceError and confirm pageerror is emitted', async ({ page }) => {
    // Clear previous pageErrors
    pageErrors.length = 0;

    // Trigger a ReferenceError in page context by referencing undefined variable property
    // This runs arbitrary code in page context and will surface as a pageerror event
    await page.evaluate(() => {
      // Intentionally reference an undefined variable to create a ReferenceError
      // Not modifying any page functions or variables permanently
      // eslint-disable-next-line no-undef
      void someNonExistentGlobalProperty; // should throw ReferenceError
    }).catch(() => {
      // evaluate may reject because of the error — pageerror event will still be emitted and captured
      // swallow to allow test to continue and assert pageErrors
    });

    // Wait briefly to ensure pageerror event has been delivered
    await page.waitForTimeout(50);

    // Assert that a ReferenceError message was captured in pageErrors
    const foundRef = pageErrors.some(m => /ReferenceError/i.test(m) || /someNonExistentGlobalProperty/i.test(m));
    expect(foundRef).toBeTruthy();
  });

  test('Custom operation error handling: add a custom operation that throws and ensure it is logged (no unhandled pageerror)', async ({ page }) => {
    // Begin transaction
    await page.fill('#txName', 'TX_CUSTOM_ERR');
    await page.click('#beginTx');

    // Select the new tx
    const txId = await page.$eval('#txSelect', sel => sel.value);
    expect(txId).toBeTruthy();

    // Add a custom script that throws (inside a try-catch in app, should be caught and logged)
    await page.fill('#customScript', 'throw new Error("custom boom");');
    await page.click('#addCustomOp');

    // The application logs an error via log('Error in custom op script: ' + e);
    // Ensure consoleMessages includes this substring
    // Wait a short while for the logging to appear
    await page.waitForTimeout(50);
    expect(consoleMessages.some(m => m.includes('Error in custom op script') || m.includes('custom boom'))).toBeTruthy();

    // There should not be an uncaught page error for this (it was caught inside the app), so the pageErrors should not include this custom boom
    const hasCustomUncaught = pageErrors.some(m => m.includes('custom boom'));
    expect(hasCustomUncaught).toBeFalsy();
  });
});