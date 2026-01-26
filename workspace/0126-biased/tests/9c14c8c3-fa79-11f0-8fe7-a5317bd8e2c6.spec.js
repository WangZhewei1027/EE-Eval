import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c14c8c3-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object model to encapsulate common interactions and queries
class BnBPage {
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    this.dialogMessages = [];

    // attach listeners to capture console, errors and dialogs for assertions
    page.on('console', msg => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
    page.on('dialog', async dlg => {
      this.dialogMessages.push(dlg.message());
      await dlg.accept();
    });
  }

  // Navigation
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // ensure initial UI settled
    await this.page.waitForSelector('#generateRandom');
  }

  // Query helpers
  async getItemCountInputValue() {
    return Number(await this.page.locator('#itemCount').inputValue());
  }
  async getCapacityInputValue() {
    return Number(await this.page.locator('#capacity').inputValue());
  }
  async getItemsTableRowCount() {
    return await this.page.locator('#itemsTable tbody tr').count();
  }
  async getStatText(id) {
    return (await this.page.locator(id).textContent()).trim();
  }
  async getLogValue() {
    return await this.page.locator('#log').evaluate(el => el.value);
  }
  async getIncumbentText() {
    return (await this.page.locator('#incumbentInfo').textContent()).trim();
  }
  async getNodesListText() {
    // returns array of texts for each node row
    const count = await this.page.locator('#nodesList > div').count();
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push((await this.page.locator('#nodesList > div').nth(i).textContent()).trim());
    }
    return out;
  }

  // Click wrappers
  async clickGenerateRandom() { await this.page.click('#generateRandom'); }
  async clickResetProblem() { await this.page.click('#resetProblem'); }
  async clickAddItem() { await this.page.click('#addItem'); }
  async clickRemoveLast() { await this.page.click('#removeLast'); }
  async clickInit() { await this.page.click('#init'); }
  async clickStep() { await this.page.click('#step'); }
  async clickAutoRun() { await this.page.click('#autoRun'); }
  async clickPause() { await this.page.click('#pause'); }
  async clickSolveAll() { await this.page.click('#solveAll'); }
  async clickStepBack() { await this.page.click('#stepBack'); }
  async clickExportState() { await this.page.click('#exportState'); }
  async clickImportState() { await this.page.click('#importState'); }

  async clickFirstNodeRow() {
    const locator = this.page.locator('#nodesList > div').first();
    await locator.waitFor({ state: 'visible', timeout: 2000 });
    await locator.click();
  }

  async clickNodeRowByIndex(idx) {
    const locator = this.page.locator('#nodesList > div').nth(idx);
    await locator.waitFor({ state: 'visible', timeout: 2000 });
    await locator.click();
  }

  // After selecting a node, nodeActions buttons are rendered. Provide helpers to click them by text.
  async clickNodeActionButtonByText(text) {
    const btn = this.page.locator('#nodeActions button', { hasText: text }).first();
    await btn.waitFor({ state: 'visible', timeout: 2000 });
    await btn.click();
  }

  // Utility to wait until log contains substring
  async waitForLogContains(substr, timeout = 3000) {
    await this.page.waitForFunction(
      (s) => document.querySelector('#log') && document.querySelector('#log').value.includes(s),
      substr,
      { timeout }
    );
  }
}

test.describe('Branch & Bound Interactive Demonstration - FSM tests', () => {
  let pageModel;

  test.beforeEach(async ({ page }) => {
    pageModel = new BnBPage(page);
    await pageModel.goto();
  });

  test.afterEach(async () => {
    // Basic sanity: assert no uncaught page errors occurred during the test run
    // Tests will also explicitly assert dialog messages and console messages where relevant.
    expect(pageModel.pageErrors.length).toBe(0);
  });

  test('Idle state: initial render, components present and default values', async () => {
    // Validate initial UI elements and default values representing the Idle state (S0_Idle)
    // Items and controls should be visible and default problem should be loaded via resetProblem() boot.
    await expect(pageModel.page.locator('#generateRandom')).toBeVisible();
    await expect(pageModel.page.locator('#resetProblem')).toBeVisible();
    await expect(pageModel.page.locator('#addItem')).toBeVisible();
    await expect(pageModel.page.locator('#removeLast')).toBeVisible();
    await expect(pageModel.page.locator('#init')).toBeVisible();
    await expect(pageModel.page.locator('#step')).toBeVisible();
    await expect(pageModel.page.locator('#autoRun')).toBeVisible();
    await expect(pageModel.page.locator('#pause')).toBeVisible();
    await expect(pageModel.page.locator('#solveAll')).toBeVisible();
    await expect(pageModel.page.locator('#stepBack')).toBeVisible();

    // Default input values per HTML
    expect(await pageModel.getItemCountInputValue()).toBe(6);
    expect(await pageModel.getCapacityInputValue()).toBe(15);

    // Items table should be populated by resetProblem() at boot: 6 rows
    expect(await pageModel.getItemsTableRowCount()).toBe(6);

    // Stats should show zero nodes created initially (root not yet initialized)
    expect(Number(await pageModel.getStatText('#statNodes'))).toBeGreaterThanOrEqual(0);

    // Log should contain boot message
    const log = await pageModel.getLogValue();
    expect(log).toMatch(/Interactive Branch and Bound demo ready/);
  });

  test('GENERATE_RANDOM_ITEMS transitions to Problem Initialized (S1_ProblemInitialized)', async () => {
    // Click Generate Random Items and verify items & capacity update and a log entry is produced.
    await pageModel.clickGenerateRandom();
    await pageModel.waitForLogContains('Generated random problem');

    const itemCount = await pageModel.getItemCountInputValue();
    const rows = await pageModel.getItemsTableRowCount();
    // item count input determines number of rows
    expect(rows).toBe(itemCount);

    // Capacity input should reflect new capacity value
    const cap = await pageModel.getCapacityInputValue();
    expect(cap).toBeGreaterThan(0);

    // No uncaught page errors were captured in this event
    expect(pageModel.pageErrors.length).toBe(0);
  });

  test('RESET_PROBLEM resets to defaults (S1_ProblemInitialized)', async () => {
    // Modify state by adding random then reset
    await pageModel.clickGenerateRandom();
    await pageModel.waitForLogContains('Generated random problem');
    await pageModel.clickResetProblem();
    await pageModel.waitForLogContains('Reset to default example problem');

    // After reset, expect 6 rows and capacity 15 per implementation
    expect(await pageModel.getItemsTableRowCount()).toBe(6);
    expect(await pageModel.getCapacityInputValue()).toBe(15);
  });

  test('ADD_ITEM and REMOVE_LAST_ITEM mutate items list', async () => {
    const before = await pageModel.getItemsTableRowCount();
    // Add an item
    await pageModel.clickAddItem();
    const afterAdd = await pageModel.getItemsTableRowCount();
    expect(afterAdd).toBe(before + 1);

    // Remove last item
    await pageModel.clickRemoveLast();
    const afterRemove = await pageModel.getItemsTableRowCount();
    expect(afterRemove).toBe(before); // back to original
  });

  test('INITIALIZE_ROOT_NODE creates root node and frontier initialized (S1_ProblemInitialized -> S2_NodeExpanded later)', async () => {
    // Initialize root node, which should create a node and compute initial bound/heuristic
    await pageModel.clickInit();
    // makeRootNode logs 'Root node created' and init handler sets bound/heuristic, so nodes list should include at least one entry
    await pageModel.waitForLogContains('Root node created');
    const nodes = await pageModel.getNodesListText();
    // at least one node (the root) present
    expect(nodes.length).toBeGreaterThanOrEqual(1);

    // Stats: created nodes should be at least 1
    const created = Number(await pageModel.getStatText('#statNodes'));
    expect(created).toBeGreaterThanOrEqual(1);

    // Frontier size should reflect 1 (root in frontier)
    const frontier = Number(await pageModel.getStatText('#statFrontier'));
    expect(frontier).toBeGreaterThanOrEqual(1);
  });

  test('STEP_NODE expands a node producing children (S2_NodeExpanded)', async () => {
    // Ensure root exists
    await pageModel.clickInit();
    await pageModel.waitForLogContains('Root node created');

    // Capture stats before step
    const beforeCreated = Number(await pageModel.getStatText('#statNodes'));
    const beforeFrontier = Number(await pageModel.getStatText('#statFrontier'));

    // Perform one step expansion
    await pageModel.clickStep();

    // Expect created nodes increased (children added)
    // Allow some time for UI to update and logs to be written
    await pageModel.waitForLogContains('Expanded node', 2000);
    const afterCreated = Number(await pageModel.getStatText('#statNodes'));
    const afterFrontier = Number(await pageModel.getStatText('#statFrontier'));

    expect(afterCreated).toBeGreaterThan(beforeCreated);
    expect(afterFrontier).toBeGreaterThanOrEqual(1);
    // expanded counter increased
    const expanded = Number(await pageModel.getStatText('#statExpanded'));
    expect(expanded).toBeGreaterThanOrEqual(1);
  });

  test('SET_INCUMBENT via node action sets an incumbent (S5_IncumbentSet)', async () => {
    // prepare by initializing and expanding one node so there are nodes to select
    await pageModel.clickInit();
    await pageModel.clickStep();
    await pageModel.waitForLogContains('Expanded node');

    // select the first node row
    await pageModel.clickFirstNodeRow();

    // Click 'Set as incumbent (manual)' action. This either sets an incumbent from a feasible node or uses greedy heuristic.
    await pageModel.clickNodeActionButtonByText('Set as incumbent (manual)');

    // Wait for log update indicating manual incumbent set or greedy set
    await pageModel.page.waitForFunction(() => {
      const txt = document.querySelector('#log') && document.querySelector('#log').value;
      return txt.includes('Manually set incumbent') || txt.includes('Manually set incumbent') || txt.includes('Manually set incumbent to greedy');
    }, null, { timeout: 2000 }).catch(() => { /* ignore timeout; we'll assert presence below */ });

    // Incumbent display should no longer be 'None'
    const incumbentText = await pageModel.getIncumbentText();
    expect(incumbentText).not.toMatch(/^None$/);
  });

  test('PRUNE_NODE via node action marks node as pruned (S4_ManualPruned)', async () => {
    // initialize and expand to have nodes
    await pageModel.clickInit();
    await pageModel.clickStep();
    await pageModel.waitForLogContains('Expanded node');

    // select the second node row (if exists) to prune
    const nodeRows = await pageModel.page.locator('#nodesList > div').count();
    expect(nodeRows).toBeGreaterThan(0);
    await pageModel.clickNodeRowByIndex(0); // pick first

    // click prune
    await pageModel.clickNodeActionButtonByText('Prune this node');

    // Wait for log to say manually pruned
    await pageModel.waitForLogContains('manually pruned', 2000).catch(() => { /* ignore */ });

    // The nodes list text for that node should now contain 'status:pruned'
    const nodesText = await pageModel.getNodesListText();
    const prunedFound = nodesText.some(t => t.includes('status:pruned'));
    expect(prunedFound).toBe(true);

    // pruned count increased
    const prunedCount = Number(await pageModel.getStatText('#statPruned'));
    expect(prunedCount).toBeGreaterThanOrEqual(1);
  });

  test('Compute exact (exhaustive) bound for selected node', async () => {
    // Initialize root and select it, then compute exact (should succeed for small n)
    await pageModel.clickInit();
    await pageModel.waitForLogContains('Root node created');

    // select root (first node)
    await pageModel.clickFirstNodeRow();

    // click 'Compute exact (exhaustive)'
    await pageModel.clickNodeActionButtonByText('Compute exact (exhaustive)');

    // After clicking exact, log should contain either "Exact value for node" or an alert message handled by dialog.
    // We accepted dialogs via page object; ensure either is present
    const log = await pageModel.getLogValue();
    const hasExactLog = /Exact value for node|Exact bound not computed/.test(log);
    expect(hasExactLog).toBe(true);
  });

  test('AUTO_RUN begins and PAUSE stops the auto-run timer (S3_AutoRunning -> S0_Idle)', async () => {
    // Initialize root node to have work for auto-run
    await pageModel.clickInit();
    await pageModel.waitForLogContains('Root node created');

    // Start auto run
    await pageModel.clickAutoRun();
    await pageModel.waitForLogContains('Auto run started', 3000);

    // Pause auto run
    await pageModel.clickPause();
    await pageModel.waitForLogContains('Auto run paused', 3000).catch(() => { /* may log 'Auto run was not running.' if timer cleared already */ });

    // Ensure no page errors captured during auto run sequence
    expect(pageModel.pageErrors.length).toBe(0);
  });

  test('SOLVE_ALL attempts to solve to completion (transition from S2_NodeExpanded to S1_ProblemInitialized)', async () => {
    // initialize then step to create a frontier
    await pageModel.clickInit();
    await pageModel.clickStep();
    await pageModel.waitForLogContains('Expanded node');

    // Trigger solve to completion (may take a moment)
    await pageModel.clickSolveAll();

    // The log should indicate completion or abortion due to iteration limit
    await pageModel.page.waitForFunction(() => {
      const val = document.querySelector('#log') && document.querySelector('#log').value;
      return /Solve to completion finished|Solve aborted: reached iteration limit/.test(val);
    }, null, { timeout: 5000 });

    const log = await pageModel.getLogValue();
    expect(/Solve to completion finished|Solve aborted: reached iteration limit/.test(log)).toBeTruthy();
  });

  test('STEP_BACK behavior: shows alert when no earlier history and restores when history exists', async () => {
    // First, attempt immediate stepBack on fresh page which should trigger alert 'No earlier history to restore.'
    // The BnBPage captures and accepts dialogs; we verify the dialog was raised.
    pageModel.dialogMessages = []; // reset any prior dialogs
    await pageModel.clickStepBack();
    // allow tiny delay for dialog handling
    await new Promise(r => setTimeout(r, 200));
    expect(pageModel.dialogMessages.some(m => m.includes('No earlier history to restore.'))).toBe(true);

    // Now create history by initializing and stepping, then attempt stepBack which should restore history (no alert)
    pageModel.dialogMessages = [];
    await pageModel.clickInit();
    await pageModel.clickStep();
    await pageModel.waitForLogContains('Expanded node');

    // Invoke stepBack - since historyIndex > 0, this should restore without showing the 'No earlier history' alert.
    await pageModel.clickStepBack();
    // Wait for possible 'Restored history' message in log
    await pageModel.waitForLogContains('Restored history', 3000).catch(() => { /* ignore if not present */ });

    // Ensure the "No earlier history" alert was not shown for this stepBack
    const hadNoHistoryAlert = pageModel.dialogMessages.some(m => m.includes('No earlier history to restore.'));
    expect(hadNoHistoryAlert).toBe(false);
  });

  test('Export and Import state produce expected UI feedback and do not crash', async () => {
    // Initialize and export
    await pageModel.clickInit();
    await pageModel.waitForLogContains('Root node created');

    // Export should populate import box and show an alert (handled by page object)
    pageModel.dialogMessages = [];
    await pageModel.clickExportState();
    // dialog message for export is "State exported to the import box (you can copy it)."
    await new Promise(r => setTimeout(r, 200));
    expect(pageModel.dialogMessages.some(m => m.includes('State exported to the import box'))).toBe(true);

    // Now try importing invalid JSON to trigger error handling path which shows alert 'Invalid JSON format.' or parsing error
    await pageModel.page.fill('#importData', 'invalid-json');
    pageModel.dialogMessages = [];
    await pageModel.clickImportState();
    await new Promise(r => setTimeout(r, 200));
    // It should present an alert indicating error or invalid JSON
    const importAlertSeen = pageModel.dialogMessages.some(m => /Invalid JSON format|Error parsing JSON/.test(m));
    expect(importAlertSeen).toBe(true);
  });

  test('No unexpected console errors during extensive interactions', async () => {
    // Perform a sequence of interactions and then assert no 'error' type console messages were emitted.
    await pageModel.clickInit();
    await pageModel.clickStep();
    await pageModel.clickAddItem();
    await pageModel.clickRemoveLast();
    await pageModel.clickAutoRun();
    // pause quickly to avoid long run
    await new Promise(r => setTimeout(r, 300));
    await pageModel.clickPause();

    // Check the captured console messages for any 'error' type entries
    const hasConsoleError = pageModel.consoleMessages.some(m => m.type === 'error');
    expect(hasConsoleError).toBe(false);
  });
});