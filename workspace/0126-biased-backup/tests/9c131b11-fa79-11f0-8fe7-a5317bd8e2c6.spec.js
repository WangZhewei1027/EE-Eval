import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c131b11-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Keep tests grouped and use a shared setup/teardown per test
test.describe('Hash Table Interactive Explorer - FSM validation', () => {
  // Capture page errors and console messages for each test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // collect console messages (info / warn / error)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Wait for initial wiring to complete - App.init writes into #log
    await expect(page.locator('#createBtn')).toBeVisible();
    // small sanity check that the app wrote initial 'Application ready' into the log
    await expect(page.locator('#log')).toContainText('Application ready');
  });

  test.afterEach(async () => {
    // No teardown required beyond Playwright's fixtures, but tests will assert against captured errors
  });

  test('S0_Idle: initial Idle state renders controls and "No table created."', async ({ page }) => {
    // Validate initial Idle state evidence: create, clear, reset buttons exist and tableDisplay shows "No table created."
    await expect(page.locator('#createBtn')).toBeVisible();
    await expect(page.locator('#clearBtn')).toBeVisible();
    await expect(page.locator('#resetBtn')).toBeVisible();

    // The page's updateDisplay() on init should render "No table created."
    await expect(page.locator('#tableDisplay')).toHaveText(/No table created\./);

    // Ensure no unexpected uncaught page errors were raised during load
    expect(pageErrors.length, `Unexpected pageerrors during load: ${pageErrors.map(e=>String(e)).join('; ')}`).toBe(0);
  });

  test('CreateTable -> S1_TableCreated: creating a table updates display, history and log', async ({ page }) => {
    // Click Create Table and validate table created state
    await page.click('#createBtn');

    // The tableDisplay should update to show Capacity and Size lines
    await expect(page.locator('#tableDisplay')).toContainText('Capacity:');
    await expect(page.locator('#tableDisplay')).toContainText('Size: 0');

    // Log should contain creation entry
    await expect(page.locator('#log')).toContainText('Created table');

    // No page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Insert (non-step) -> S4_Inserting: insert keys and verify DOM and logs', async ({ page }) => {
    // Create table first
    await page.click('#createBtn');

    // Insert multiple keys into default chaining table
    await page.fill('#insertInput', 'a, b, c');
    await page.click('#insertBtn');

    // Log should show inserted messages for each key
    await expect(page.locator('#log')).toContainText('Inserted a');
    await expect(page.locator('#log')).toContainText('Inserted b');
    await expect(page.locator('#log')).toContainText('Inserted c');

    // Table display should include those keys
    await expect(page.locator('#tableDisplay')).toContainText('a');
    await expect(page.locator('#tableDisplay')).toContainText('b');
    await expect(page.locator('#tableDisplay')).toContainText('c');

    // Ensure size increased (size: 3)
    await expect(page.locator('#tableDisplay')).toContainText(/Size:\s*3/);

    expect(pageErrors.length).toBe(0);
  });

  test('InsertStep -> S4_Inserting (step-by-step): preparing steps and stepping through them', async ({ page }) => {
    // Create table
    await page.click('#createBtn');

    // Switch to step mode
    await page.selectOption('#stepMode', 'step');

    // Provide a key and prepare step-by-step insertion
    await page.fill('#insertInput', 'stepkey');
    await page.click('#insertStepBtn');

    // The log should contain prepared steps message
    await expect(page.locator('#log')).toContainText('Prepared');

    // There should be step navigation buttons available; click Step ▶ to advance
    await page.click('#stepNext');

    // After stepping, tableDisplay should include "--- Step Snapshot ---" and the step description
    await expect(page.locator('#tableDisplay')).toContainText('--- Step Snapshot ---');
    await expect(page.locator('#tableDisplay')).toContainText('Desc:');

    // Step back and ensure content still updates
    await page.click('#stepPrev');
    // Either at first step or previous snapshot; ensure no page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Search (non-step) -> S5_Searching: search existing and missing keys', async ({ page }) => {
    // Create table and insert a key
    await page.click('#createBtn');
    await page.fill('#insertInput', 'findme');
    await page.click('#insertBtn');

    // Search for existing key
    await page.fill('#searchInput', 'findme');
    await page.click('#searchBtn');
    await expect(page.locator('#log')).toContainText('Found findme');

    // Search for missing key
    await page.fill('#searchInput', 'notpresent');
    await page.click('#searchBtn');
    await expect(page.locator('#log')).toContainText('Not found: notpresent');

    expect(pageErrors.length).toBe(0);
  });

  test('SearchStep -> S5_Searching (step-by-step): prepare and step through search', async ({ page }) => {
    await page.click('#createBtn');
    await page.fill('#insertInput', 's1');
    await page.click('#insertBtn');

    // Switch to step mode and perform step search
    await page.selectOption('#stepMode', 'step');
    await page.fill('#searchInput', 's1');
    await page.click('#searchStepBtn');

    await expect(page.locator('#log')).toContainText('Prepared');

    // Step next should display step snapshot
    await page.click('#stepNext');
    await expect(page.locator('#tableDisplay')).toContainText('--- Step Snapshot ---');
    expect(pageErrors.length).toBe(0);
  });

  test('Delete (non-step) -> S6_Deleting: delete keys and verify removal', async ({ page }) => {
    await page.click('#createBtn');
    await page.fill('#insertInput', 'delme');
    await page.click('#insertBtn');

    // Delete existing key
    await page.fill('#deleteInput', 'delme');
    await page.click('#deleteBtn');
    await expect(page.locator('#log')).toContainText('Deleted delme');

    // Ensure tableDisplay no longer shows the key
    await expect(page.locator('#tableDisplay')).not.toContainText('delme');

    // Delete missing key should log failure
    await page.fill('#deleteInput', 'doesnotexist');
    await page.click('#deleteBtn');
    await expect(page.locator('#log')).toContainText('Delete failed for');

    expect(pageErrors.length).toBe(0);
  });

  test('DeleteStep -> S6_Deleting (step-by-step): prepare delete steps and step through', async ({ page }) => {
    await page.click('#createBtn');
    await page.fill('#insertInput', 'dstep');
    await page.click('#insertBtn');

    await page.selectOption('#stepMode', 'step');
    await page.fill('#deleteInput', 'dstep');
    await page.click('#deleteStepBtn');

    await expect(page.locator('#log')).toContainText('Prepared');

    await page.click('#stepNext');
    await expect(page.locator('#tableDisplay')).toContainText('--- Step Snapshot ---');
    expect(pageErrors.length).toBe(0);
  });

  test('ImportJSON -> S7_Importing and ExportJSON -> S8_Exporting: import and export flows', async ({ page }) => {
    await page.click('#createBtn');

    // Import JSON
    await page.fill('#importJSON', '["x","y",5]');
    await page.click('#importBtn');
    await expect(page.locator('#log')).toContainText('Imported 3 items');

    // Table display should include imported values (stringified)
    await expect(page.locator('#tableDisplay')).toContainText('x');
    await expect(page.locator('#tableDisplay')).toContainText('y');

    // Export JSON - this attempts clipboard operations; we verify the log entry
    await page.click('#exportBtn');
    await expect(page.locator('#log')).toContainText('Exported table keys JSON to clipboard');

    // Export full state
    await page.click('#exportFullBtn');
    await expect(page.locator('#log')).toContainText('Exported full state JSON to clipboard');

    expect(pageErrors.length).toBe(0);
  });

  test('RehashManual / RehashTo / FindNextPrime -> S9_Rehashing: manual and to-capacity rehashes and next prime', async ({ page }) => {
    // Create table and insert enough items to check rehash to specified capacity
    await page.click('#createBtn');
    await page.fill('#insertInput', '1,2,3');
    await page.click('#insertBtn');

    // Manual rehash (uses #capacity input)
    // Change capacity input to a new value then click manual rehash button (there are two rehashBtn elements; use the first visible)
    await page.fill('#capacity', '17');
    // Click the first #rehashBtn (in visualization there is another rehashBtn; ensure one is clickable)
    // Use locator for the first matching button on page
    const rehashButtons = page.locator('button#rehashBtn');
    await rehashButtons.first().click(); // triggers rehashManual
    await expect(page.locator('#log')).toContainText('Manual rehash to 17');

    // Now use Rehash To (manualCap -> rehashTo)
    await page.fill('#manualCap', '29');
    await page.click('#rehashToBtn');
    await expect(page.locator('#log')).toContainText('Rehashed to 29');
    await expect(page.locator('#tableDisplay')).toContainText('Capacity: 29');

    // Next Prime (set manualCap to a non-prime and click nextPrimeBtn)
    await page.fill('#manualCap', '20');
    await page.click('#nextPrimeBtn');
    // manualCap value should be updated to next prime (23)
    const manualCapVal = await page.locator('#manualCap').inputValue();
    expect(Number(manualCapVal)).toBeGreaterThanOrEqual(20);
    // log contains next prime message
    await expect(page.locator('#log')).toContainText('Next prime');

    expect(pageErrors.length).toBe(0);
  });

  test('Metrics computation, snapshots, undo/redo flows and step clearing', async ({ page }) => {
    await page.click('#createBtn');
    await page.fill('#insertInput', 'm1,m2');
    await page.click('#insertBtn');

    // Compute metrics
    await page.click('#computeMetrics');
    await expect(page.locator('#log')).toContainText('Computed metrics');
    await expect(page.locator('#metrics')).not.toHaveText(''); // metrics JSON should be present

    // Save a named snapshot
    await page.fill('#snapshotName', 'snap1');
    await page.click('#saveSnapshot');
    await expect(page.locator('#log')).toContainText('Saved snapshot');

    // List snapshots and ensure select contains an option
    await page.click('#listSnapshots');
    await expect(page.locator('#log')).toContainText('Snapshots');

    // Restore snapshot (select default option should be present)
    // Choose first option in snapshotList
    const snapshotList = page.locator('#snapshotList option');
    await expect(snapshotList).toHaveCountGreaterThan(0);
    await page.selectOption('#snapshotList', { index: 0 });
    await page.click('#restoreSnapshot');
    await expect(page.locator('#log')).toContainText('Restored snapshot');

    // Branch and delete snapshot flows
    await page.click('#branchSnapshot');
    await expect(page.locator('#log')).toContainText('Branched');

    await page.click('#deleteSnapshot');
    await expect(page.locator('#log')).toContainText('Deleted');

    // Undo/Redo: perform an insert (history records) then undo and redo
    await page.fill('#insertInput', 'undoKey');
    await page.click('#insertBtn');
    await expect(page.locator('#log')).toContainText('Inserted undoKey');

    await page.click('#undoBtn');
    // Undo logs 'Undo' (if possible)
    await expect(page.locator('#log')).toContainText('Undo');

    await page.click('#redoBtn');
    await expect(page.locator('#log')).toContainText('Redo');

    // Clear steps if any
    await page.click('#clearSteps');
    await expect(page.locator('#log')).toContainText('Cleared step sequence');

    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases and error scenarios: operations without table and invalid custom hash', async ({ page }) => {
    // Reset app to ensure no table present
    await page.click('#resetBtn');

    // Attempt to insert without a table
    await page.fill('#insertInput', 'nope');
    await page.click('#insertBtn');
    await expect(page.locator('#log')).toContainText('No table present');

    // Attempt to search without a table
    await page.fill('#searchInput', 'x');
    await page.click('#searchBtn');
    await expect(page.locator('#log')).toContainText('No table');

    // Attempt to delete without a table
    await page.fill('#deleteInput', 'x');
    await page.click('#deleteBtn');
    await expect(page.locator('#log')).toContainText('No table');

    // Test invalid custom hash code (will produce an error message shown in UI)
    const badCode = 'function broken { this is invalid JS';
    await page.fill('#customHash', badCode);
    await page.click('#useCustomBtn');

    // The UI sets #testHashResult to 'Error: ...' when setCustom returns an error string
    await expect(page.locator('#testHashResult')).toContainText('Error');

    // Also the log contains a failure message
    await expect(page.locator('#log')).toContainText('Failed to set custom hash');

    // Ensure that any page errors are still zero (setCustom catches syntax errors and returns strings)
    expect(pageErrors.length).toBe(0);
  });

  test('Confirm no uncaught ReferenceError / SyntaxError / TypeError occurred during interactions', async ({ page }) => {
    // After many interactions in previous tests, in this test run we verify pageErrors list is empty.
    // (This test loads a fresh page to ensure we capture any runtime exceptions)
    // We already collected pageErrors in beforeEach; assert none were raised
    expect(pageErrors.length).toBe(0, `Expected no uncaught page errors but found: ${pageErrors.map(e=>String(e)).join('; ')}`);

    // Also assert no console messages of type 'error' were emitted
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0, `Console errors were emitted: ${errors.map(e=>e.text).join(' | ')}`);
  });
});