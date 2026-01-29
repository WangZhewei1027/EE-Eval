import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1215fb72-fa7a-11f0-acf9-69409043402d.html';

test.describe('ACID Properties Interactive Explorer - FSM Validation (App ID: 1215fb72-...)', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Hook to collect console and page errors for each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // Collect console messages for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // Collect uncaught exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Wait a tiny bit for initialization to complete
    await page.waitForTimeout(50);
  });

  test.afterEach(async () => {
    // After each test we simply keep the collected logs available for debug if needed.
    // (No global teardown required for this static page.)
  });

  test.describe('Initialization and Idle state (S0_Idle)', () => {
    test('should initialize to default DB state and show Idle indicators', async ({ page }) => {
      // Validate DB state box contains the default key-values
      const dbBox = page.locator('#db-state-box');
      await expect(dbBox).toBeVisible();
      const dbText = await dbBox.textContent();
      // The default DB in the app is itemA=10, itemB=20, itemC=30 formatted as lines
      expect(dbText).toContain('itemA = 10');
      expect(dbText).toContain('itemB = 20');
      expect(dbText).toContain('itemC = 30');

      // Current transaction info should indicate no transaction created (Idle)
      const currentInfo = page.locator('#current-trans-info');
      await expect(currentInfo).toHaveText(/No transaction created\./);

      // Key UI buttons must be in their initial disabled/enabled states
      await expect(page.locator('#add-op-btn')).toBeDisabled();
      await expect(page.locator('#commit-trans-btn')).toBeDisabled();
      await expect(page.locator('#start-exec-btn')).toBeDisabled();

      // Exec log should be empty at initialization
      await expect(page.locator('#exec-log')).toHaveText('');

      // Ensure there were no unexpected runtime page errors on load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transaction creation and operation management (S1_TransactionCreated)', () => {
    test('creating a transaction updates current transaction info and enables relevant buttons', async ({ page }) => {
      // Create transaction T1
      await page.fill('#trans-id-input', 'T1');
      await page.click('#create-trans-btn');

      // Creation logs the transaction created message
      const execLog = page.locator('#exec-log');
      await expect(execLog).toContainText("Transaction 'T1' created.");

      // Current transaction info updates
      await expect(page.locator('#current-trans-info')).toContainText('Transaction ID: T1');
      await expect(page.locator('#current-trans-info')).toContainText('Operations: 0');

      // Transaction ops box should indicate no operations added
      await expect(page.locator('#trans-ops-box')).toHaveText('(No operations added)');

      // After creating transaction, abort button should be enabled (transaction exists)
      await expect(page.locator('#abort-trans-btn')).toBeEnabled();

      // add-op remains disabled until valid input
      await expect(page.locator('#add-op-btn')).toBeDisabled();

      // No page errors produced by creating a transaction
      expect(pageErrors.length).toBe(0);
    });

    test('adding READ and WRITE operations updates ops list and exec log', async ({ page }) => {
      // Create transaction T1 for operations
      await page.fill('#trans-id-input', 'T1');
      await page.click('#create-trans-btn');

      // Add a READ operation
      await page.fill('#op-key-input', 'itemA');
      // Read is default opType
      await expect(page.locator('#add-op-btn')).toBeEnabled();
      await page.click('#add-op-btn');

      // Exec log should mention read op added
      await expect(page.locator('#exec-log')).toContainText("Operation added: READ key='itemA'");

      // Trans ops box should show the READ operation as first line
      await expect(page.locator('#trans-ops-box')).toContainText("1. READ  key='itemA'");

      // Now add a WRITE operation
      await page.selectOption('#op-type-select', 'write');
      // Value input becomes visible; fill both key and value
      await page.fill('#op-key-input', 'itemD');
      await page.fill('#op-value-input', '42');
      await expect(page.locator('#add-op-btn')).toBeEnabled();
      await page.click('#add-op-btn');

      // Exec log should mention the write op added
      await expect(page.locator('#exec-log')).toContainText("Operation added: WRITE key='itemD', value='42'");

      // Trans ops box should show two lines (READ then WRITE)
      const opsText = await page.locator('#trans-ops-box').textContent();
      expect(opsText).toContain("1. READ  key='itemA'");
      expect(opsText).toContain("2. WRITE key='itemD' value='42'");

      // Now commit button should be enabled (there are ops)
      await expect(page.locator('#commit-trans-btn')).toBeEnabled();

      // No page errors produced during operation additions
      expect(pageErrors.length).toBe(0);
    });

    test('attempting to click missing commit handler (edge case) does not throw page errors but has no effect', async ({ page }) => {
      // Create transaction and add a write op so commit button is enabled
      await page.fill('#trans-id-input', 'T-EDGE');
      await page.click('#create-trans-btn');
      await page.selectOption('#op-type-select', 'write');
      await page.fill('#op-key-input', 'itemX');
      await page.fill('#op-value-input', '999');
      await page.click('#add-op-btn');

      // commitTransBtn exists and is enabled - however implementation lacks an event listener for it.
      const commitBtn = page.locator('#commit-trans-btn');
      await expect(commitBtn).toBeEnabled();

      // Capture durability log length before clicking commit button
      // We cannot access internal JS variables directly, so we'll use the UI: view durability log (it will be empty)
      // But first click commit button (which should do nothing)
      await commitBtn.click();
      await page.waitForTimeout(50);

      // After clicking the button with no handler, the exec-log should not contain a commit message
      const execLog = await page.locator('#exec-log').textContent();
      expect(execLog).not.toContain("committed successfully");

      // And there should be no page errors as a result of clicking a button with no handler
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Execution flow, stepping and commit (S3_TransactionExecuting -> S4_TransactionCommitted)', () => {
    test('start execution, step through operations and see atomic commit with durability log entry', async ({ page }) => {
      // Create transaction T1 with READ then WRITE as earlier
      await page.fill('#trans-id-input', 'T1');
      await page.click('#create-trans-btn');

      // Add READ op
      await page.fill('#op-key-input', 'itemA');
      await page.click('#add-op-btn');

      // Add WRITE op
      await page.selectOption('#op-type-select', 'write');
      await page.fill('#op-key-input', 'itemD');
      await page.fill('#op-value-input', '42');
      await page.click('#add-op-btn');

      // Start execution (durability checkbox is checked by default)
      await page.click('#start-exec-btn');

      // After starting, exec log should begin with Starting execution
      await expect(page.locator('#exec-log')).toContainText("Starting execution of Transaction 'T1'");

      // The step operation button (#step-op-btn) should have been added to the DOM and enabled
      const stepBtn = page.locator('#step-op-btn');
      await expect(stepBtn).toBeVisible();
      await expect(stepBtn).toBeEnabled();

      // Step 1 (READ)
      await stepBtn.click();
      await expect(page.locator('#exec-log')).toContainText("READ 'itemA'");

      // Step 2 (WRITE buffered)
      await stepBtn.click();
      await expect(page.locator('#exec-log')).toContainText("WRITE 'itemD' = '42'");

      // Final step should trigger commit and show commit messages and updated DB state
      // The commit happens automatically when stepIndex >= operations.length
      // Click again to allow commit to process
      await stepBtn.click();

      // Wait briefly for commit to be processed
      await page.waitForTimeout(50);

      // Exec log should contain commit success message
      await expect(page.locator('#exec-log')).toContainText("committed successfully");

      // DB state box should reflect the new write (itemD = 42)
      await expect(page.locator('#db-state-box')).toContainText("itemD = 42");

      // Now view durability log contents to ensure T1 is recorded
      await page.click('#view-durability-log-btn');
      await expect(page.locator('#durability-log-section')).toBeVisible();
      await expect(page.locator('#durability-log-box')).toContainText("ID=T1");

      // Close durability log
      await page.click('#close-durability-log-btn');

      // No uncaught page errors in this successful execution
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Abort and failure handling (S2_TransactionAborted, S5_TransactionFailed)', () => {
    test('aborting a built transaction returns to Idle and clears current transaction', async ({ page }) => {
      // Create transaction T2 and add an operation
      await page.fill('#trans-id-input', 'T2');
      await page.click('#create-trans-btn');
      await page.fill('#op-key-input', 'itemB');
      await page.click('#add-op-btn');

      // Abort using abort-trans-btn
      await page.click('#abort-trans-btn');

      // Exec log should contain aborted message and current transaction cleared
      await expect(page.locator('#exec-log')).toContainText("Transaction 'T2' aborted.");
      await expect(page.locator('#current-trans-info')).toHaveText('No transaction created.');

      // trans-ops-box should indicate no transaction selected
      await expect(page.locator('#trans-ops-box')).toHaveText('(No transaction selected)');

      // No page errors triggered by abort path
      expect(pageErrors.length).toBe(0);
    });

    test('simulate failure during execution causes atomic rollback and leaves DB unchanged', async ({ page }) => {
      // Prepare DB baseline snapshot text before running the transaction
      const dbBefore = await page.locator('#db-state-box').textContent();

      // Create T3 with a single WRITE operation
      await page.fill('#trans-id-input', 'T3');
      await page.click('#create-trans-btn');
      await page.selectOption('#op-type-select', 'write');
      await page.fill('#op-key-input', 'itemCrash');
      await page.fill('#op-value-input', 'CRASHVAL');
      await page.click('#add-op-btn');

      // Start execution
      await page.click('#start-exec-btn');

      // simulate-failure button should become enabled now that execState exists
      const simFailBtn = page.locator('#simulate-failure-btn');
      await expect(simFailBtn).toBeEnabled();

      // Request simulated failure
      await simFailBtn.click();
      await expect(page.locator('#exec-log')).toContainText('Simulated failure requested');

      // Use step button - the next step will detect simulateFailure and abort
      const stepBtn = page.locator('#step-op-btn');
      await expect(stepBtn).toBeEnabled();

      // Step to trigger the failure
      await stepBtn.click();

      // After stepping, the log should include the simulated failure event and abort message
      await expect(page.locator('#exec-log')).toContainText('Simulated failure requested');
      await expect(page.locator('#exec-log')).toContainText('Simulated failure occurred');
      await expect(page.locator('#exec-log')).toContainText("aborted due to failure (atomic rollback)");

      // DB state should remain as before (no partial changes applied)
      const dbAfter = await page.locator('#db-state-box').textContent();
      expect(dbAfter).toBe(dbBefore);

      // No uncaught page errors during failure simulation
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Durability and recovery flows', () => {
    test('clear execution log and recover DB from durability log', async ({ page }) => {
      // Reset DB to known default to start
      await page.click('#reset-db-btn');
      await expect(page.locator('#exec-log')).toContainText('Database reset to default state.');

      // Create transaction T_REC and commit it by stepping execution (durability enabled)
      await page.fill('#trans-id-input', 'T_REC');
      await page.click('#create-trans-btn');

      await page.selectOption('#op-type-select', 'write');
      await page.fill('#op-key-input', 'recoveredKey');
      await page.fill('#op-value-input', 'RECVAL');
      await page.click('#add-op-btn');

      // Start exec and step to commit
      await page.click('#start-exec-btn');
      const stepBtn = page.locator('#step-op-btn');
      // One step for write (buffer) then step to commit
      await stepBtn.click(); // WRITE buffered
      await stepBtn.click(); // commit

      // Ensure durability log includes T_REC by opening durability viewer
      await page.click('#view-durability-log-btn');
      await expect(page.locator('#durability-log-box')).toContainText('ID=T_REC');

      // Close durability viewer
      await page.click('#close-durability-log-btn');

      // Now clear execution log UI using clear-log-btn and verify it's empty
      await page.click('#clear-log-btn');
      await expect(page.locator('#exec-log')).toHaveText('');

      // Recover DB from durability log (simulate starting from DEFAULT_DB)
      await page.click('#recover-db-btn');

      // After recovery, DB should contain the recoveredKey set by T_REC
      await expect(page.locator('#db-state-box')).toContainText("recoveredKey = RECVAL");

      // No page errors during durability/recovery flows
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and UI consistency', () => {
    test('keyboard shortcuts and enter key behavior do not produce errors', async ({ page }) => {
      // Enter in transIdInput triggers create transaction
      await page.fill('#trans-id-input', 'T-KBD');
      await page.press('#trans-id-input', 'Enter');
      await expect(page.locator('#current-trans-info')).toContainText('Transaction ID: T-KBD');

      // For op inputs, ensure Enter triggers add op when enabled
      await page.fill('#op-key-input', 'itemA');
      // Add op button should be enabled for READ and pressing Enter on opKeyInput triggers add
      await page.press('#op-key-input', 'Enter');

      // The operation should be added
      await expect(page.locator('#trans-ops-box')).toContainText("READ  key='itemA'");

      // No page errors introduced by keyboard shortcuts
      expect(pageErrors.length).toBe(0);
    });

    test('simulate crash button behavior when no execution in progress', async ({ page }) => {
      // simulate-crash-btn is disabled initially
      await expect(page.locator('#simulate-crash-btn')).toBeDisabled();

      // Try clicking simulate crash (should do nothing and not throw)
      await page.click('#simulate-crash-btn').catch(() => {
        // If the click fails because it's disabled, swallow - test is to ensure no page errors
      });

      // No page errors should be present
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console & Page error observations (must not hide natural errors)', () => {
    test('collects console messages and ensures no unexpected page errors occurred', async ({ page }) => {
      // Basic sanity: ensure we have captured some console messages (exec-log uses console-like logging via DOM, but there may be no console outputs)
      // We at least expect the page to have run initialization without throwing script errors.
      expect(Array.isArray(consoleMessages)).toBe(true);

      // Assert no uncaught page errors were observed
      expect(pageErrors.length).toBe(0);
    });
  });
});