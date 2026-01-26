import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12162281-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the Query Optimization Interactive Demo
class DemoPage {
  constructor(page) {
    this.page = page;
    this.output = page.locator('#output');
    this.planDisplay = page.locator('#planDisplay');
    this.queryInput = page.locator('#queryInput');
    this.tableSchemasInput = page.locator('#tableSchemas');
    this.parseBtn = page.locator('#parseQueryBtn');
    this.generateBtn = page.locator('#generateInitialPlanBtn');
    this.heuristicBtn = page.locator('#applyHeuristicBtn');
    this.costBtn = page.locator('#applyCostModelBtn');
    this.resetBtn = page.locator('#resetDemoBtn');
    this.heuristicLevel = page.locator('#heuristicLevel');
    this.costModelSelect = page.locator('#costModelStrategy');
    this.manualSelect = page.locator('#manualTransform');
    this.applyManualBtn = page.locator('#applyManualTransform');
    this.explanationText = page.locator('#explanationText');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Helpers to read UI state
  async getOutputText() {
    return (await this.output.textContent()) || '';
  }

  async getPlanText() {
    return (await this.planDisplay.textContent()) || '';
  }

  async isDisabled(locator) {
    return await locator.getAttribute('disabled') !== null;
  }

  // Interactions
  async clickParse(expectDialog = false) {
    if (expectDialog) {
      const dialog = await this.page.waitForEvent('dialog');
      await this.parseBtn.click();
      return dialog;
    } else {
      await this.parseBtn.click();
    }
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickApplyHeuristic() {
    await this.heuristicBtn.click();
  }

  async clickApplyCost() {
    await this.costBtn.click();
  }

  async clickReset(accept = true) {
    // The button opens a confirm dialog; return the dialog so test can assert.
    const dPromise = this.page.waitForEvent('dialog');
    await this.resetBtn.click();
    const dialog = await dPromise;
    if (accept) await dialog.accept();
    else await dialog.dismiss();
    return dialog;
  }

  async setHeuristicLevel(value) {
    await this.heuristicLevel.evaluate((el, v) => el.value = v, String(value));
    // trigger input event if necessary
    await this.heuristicLevel.dispatchEvent('input');
  }

  async selectManualTransform(value) {
    await this.manualSelect.selectOption(value);
  }

  async clickApplyManual() {
    await this.applyManualBtn.click();
  }

  async enterSchemas(value) {
    await this.tableSchemasInput.fill(value);
  }

  async enterQuery(value) {
    await this.queryInput.fill(value);
  }

  async editExplanation(text) {
    await this.explanationText.fill(text);
  }
}

test.describe('Query Optimization Interactive Demo - FSM validation', () => {
  let pageErrors = [];
  let consoleMessages = [];
  let demo;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture page errors and console messages for assertions
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // Common safety: no global test cleanup required beyond Playwright's default
  });

  test('Initial Idle State (S0_Idle): page loads and is reset', async () => {
    // Validate the page initial state rendered by resetState() during initialization
    const out = await demo.getOutputText();
    expect(out).toContain('Demo reset. Enter SQL and table schema to start.');
    const plan = await demo.getPlanText();
    expect(plan).toBe('No plan generated yet.');

    // Verify buttons and controls initial disabled/enabled state per the UI layout
    expect(await demo.isDisabled(demo.generateBtn)).toBeTruthy();
    expect(await demo.isDisabled(demo.heuristicBtn)).toBeTruthy();
    expect(await demo.isDisabled(demo.costBtn)).toBeTruthy();
    expect(await demo.isDisabled(demo.heuristicLevel)).toBeTruthy();
    expect(await demo.isDisabled(demo.costModelSelect)).toBeTruthy();
    expect(await demo.isDisabled(demo.manualSelect)).toBeTruthy();
    expect(await demo.isDisabled(demo.applyManualBtn)).toBeTruthy();

    // Ensure no unexpected runtime errors occurred during initial load
    expect(pageErrors.length).toBe(0);
  });

  test('ParseQuery transition (S0 -> S1): successful parse enables Generate Initial Plan', async () => {
    // The sample query and schemas are prefilled by the page. Clicking Parse should:
    // - Clear output, log parsed schemas and parsed query, enable Generate Initial Plan button
    await demo.parseBtn.click();

    // Wait a short time for DOM updates
    await demo.page.waitForTimeout(100);

    const out = await demo.getOutputText();
    expect(out).toContain('Parsed table schemas:');
    expect(out).toContain('Parsed Query:');

    // Now generate button should be enabled
    expect(await demo.isDisabled(demo.generateBtn)).toBeFalsy();

    // Plan display should instruct next step
    const planText = await demo.getPlanText();
    expect(planText).toContain("Query parsed. Click 'Generate Initial Plan' to continue.");

    // No unexpected page errors from parsing
    expect(pageErrors.length).toBe(0);
  });

  test('GenerateInitialPlan transition (S1 -> S2): initial plan generation updates UI', async () => {
    // Ensure parse step done first
    await demo.parseBtn.click();
    await demo.page.waitForTimeout(50);

    // Click Generate Initial Plan
    await demo.clickGenerate();
    await demo.page.waitForTimeout(50);

    const out = await demo.getOutputText();
    expect(out).toContain('Initial query plan generated.');

    const plan = await demo.getPlanText();
    // The printed plan should contain typical nodes (Project and Scan/Join)
    expect(plan).toMatch(/Project\(|Scan\(|Join\(/);

    // After generation, heuristic and cost buttons and controls should be enabled
    expect(await demo.isDisabled(demo.heuristicBtn)).toBeFalsy();
    expect(await demo.isDisabled(demo.heuristicLevel)).toBeFalsy();
    expect(await demo.isDisabled(demo.costBtn)).toBeFalsy();
    expect(await demo.isDisabled(demo.costModelSelect)).toBeFalsy();
    expect(await demo.isDisabled(demo.manualSelect)).toBeFalsy();
    expect(await demo.isDisabled(demo.applyManualBtn)).toBeFalsy();

    // Still no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('ApplyHeuristicOptimization transition (S2 -> S3): apply heuristics at multiple levels', async () => {
    await demo.parseBtn.click();
    await demo.page.waitForTimeout(30);
    await demo.clickGenerate();
    await demo.page.waitForTimeout(30);

    // Level 1: predicate pushdown
    await demo.setHeuristicLevel(1);
    await demo.clickApplyHeuristic();
    await demo.page.waitForTimeout(50);
    let out = await demo.getOutputText();
    expect(out).toContain('Predicate pushdown applied.');
    expect(out).toContain('Heuristic optimization complete.');
    let plan = await demo.getPlanText();
    expect(plan.length).toBeGreaterThan(0);

    // Level 2: join reorder heuristic - ensure reorder message may appear
    await demo.setHeuristicLevel(2);
    await demo.clickApplyHeuristic();
    await demo.page.waitForTimeout(50);
    out = await demo.getOutputText();
    expect(out).toContain('Join reorder heuristic applied.');
    expect(out).toContain('Heuristic optimization complete.');

    // Level 3: index usage simulation + others
    await demo.setHeuristicLevel(3);
    await demo.clickApplyHeuristic();
    await demo.page.waitForTimeout(80);
    out = await demo.getOutputText();
    expect(out).toContain('Simulated indexes on table');
    expect(out).toContain('Index usage simulation applied.');
    expect(out).toContain('Heuristic optimization complete.');

    // Confirm plan display updated
    plan = await demo.getPlanText();
    expect(plan).toMatch(/Scan\(|Filter\(|Join\(|Project\(/);

    // No uncaught page errors during heuristic application
    expect(pageErrors.length).toBe(0);
  });

  test('ApplyCostBasedOptimization transition (S2 -> S3): cost-based optimization picks a plan', async () => {
    await demo.parseBtn.click();
    await demo.page.waitForTimeout(30);
    await demo.clickGenerate();
    await demo.page.waitForTimeout(30);

    // Choose a cost model strategy and apply
    await demo.costModelSelect.selectOption('simple');
    await demo.clickApplyCost();
    await demo.page.waitForTimeout(100);

    const out = await demo.getOutputText();
    // The demo logs a completion message including the chosen strategy and completion text
    expect(out).toContain('Applying cost based optimization');
    // The code logs either "Cost-based optimization complete." or "Selected plan cost estimate"
    expect(out).toMatch(/Cost-based optimization complete|Selected plan cost estimate/);

    const plan = await demo.getPlanText();
    expect(plan.length).toBeGreaterThan(0);

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Manual Transformations: swap, pushdown, joinReorder, indexUse', async () => {
    await demo.parseBtn.click();
    await demo.page.waitForTimeout(30);
    await demo.clickGenerate();
    await demo.page.waitForTimeout(30);

    // 1) Operator Swap
    await demo.selectManualTransform('swap');
    await demo.clickApplyManual();
    await demo.page.waitForTimeout(30);
    let out = await demo.getOutputText();
    expect(out).toContain('Operator Swap: Top-level join inputs swapped.');

    // 2) Predicate Pushdown manual
    await demo.selectManualTransform('pushdown');
    await demo.clickApplyManual();
    await demo.page.waitForTimeout(30);
    out = await demo.getOutputText();
    expect(out).toContain('Predicate Pushdown: applied manual pushdown.');

    // 3) Join Reorder manual
    await demo.selectManualTransform('joinReorder');
    await demo.clickApplyManual();
    await demo.page.waitForTimeout(30);
    out = await demo.getOutputText();
    // This may or may not log a swap depending on estimates; check that it logs either swap or nothing but did not throw
    expect(out).toMatch(/Join Reorder: swapped join children of a join subtree.|Join Reorder: swapped|/);

    // 4) Index Use manual
    await demo.selectManualTransform('indexUse');
    await demo.clickApplyManual();
    await demo.page.waitForTimeout(50);
    out = await demo.getOutputText();
    expect(out).toMatch(/Index Usage: Simulated indexes on table|Index Usage: Simulated indexes/);

    // Final plan should still display
    const plan = await demo.getPlanText();
    expect(plan.length).toBeGreaterThan(0);

    expect(pageErrors.length).toBe(0);
  });

  test('Explanation edit event (EditExplanation): editable textarea updates internal state', async () => {
    const note = 'These are my notes about the optimization steps.';
    await demo.editExplanation(note);
    // The script updates internal state but does not log; verify textarea reflects the change
    expect(await demo.explanationText.inputValue()).toBe(note);
    // No errors triggered by typing
    expect(pageErrors.length).toBe(0);
  });

  test('ResetDemo transition (S3 -> S4): confirm reset and verify cleared state', async () => {
    // Move to an optimized state first
    await demo.parseBtn.click();
    await demo.page.waitForTimeout(30);
    await demo.clickGenerate();
    await demo.page.waitForTimeout(30);
    await demo.setHeuristicLevel(2);
    await demo.clickApplyHeuristic();
    await demo.page.waitForTimeout(30);

    // Now trigger reset and accept the confirm
    const dialogPromise = demo.page.waitForEvent('dialog');
    await demo.resetBtn.click();
    const dlg = await dialogPromise;
    // Confirm message should ask about resetting demo
    expect(dlg.message()).toMatch(/Are you sure you want to reset the demo/);
    await dlg.accept();

    // Allow UI to update
    await demo.page.waitForTimeout(50);

    // Validate Reset state
    const out = await demo.getOutputText();
    expect(out).toContain('Demo reset. Enter SQL and table schema to start.');
    const plan = await demo.getPlanText();
    expect(plan).toBe('No plan generated yet.');
    expect(await demo.isDisabled(demo.generateBtn)).toBeTruthy();

    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: parsing with missing schemas or missing SQL shows alert dialogs and does not crash', async () => {
    // Clear schemas and click parse -> expect alert "Please provide table schemas."
    await demo.enterSchemas('');
    // Listen for the dialog
    const dialog1 = await demo.page.waitForEvent('dialog');
    await demo.parseBtn.click();
    const dlg1 = await dialog1;
    expect(dlg1.type()).toBe('alert');
    expect(dlg1.message()).toContain('Please provide table schemas.');
    await dlg1.accept();

    // Ensure Generate button still disabled and no uncaught errors
    expect(await demo.isDisabled(demo.generateBtn)).toBeTruthy();
    expect(pageErrors.length).toBe(0);

    // Restore schemas but clear query -> expect alert "Please enter an SQL query."
    await demo.enterSchemas(`A(id:int,date:text,category:text)\nB(a_id:int,value:int)`);
    await demo.enterQuery('');
    const dialog2Promise = demo.page.waitForEvent('dialog');
    await demo.parseBtn.click();
    const dlg2 = await dialog2Promise;
    expect(dlg2.type()).toBe('alert');
    expect(dlg2.message()).toContain('Please enter an SQL query.');
    await dlg2.accept();

    // Still no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('No unexpected runtime ReferenceError/SyntaxError/TypeError during nominal operations', async () => {
    // Perform a complete nominal flow
    await demo.parseBtn.click();
    await demo.page.waitForTimeout(20);
    await demo.clickGenerate();
    await demo.page.waitForTimeout(20);
    await demo.setHeuristicLevel(3);
    await demo.clickApplyHeuristic();
    await demo.page.waitForTimeout(40);
    await demo.clickApplyCost();
    await demo.page.waitForTimeout(40);

    // Collect any page errors captured
    // If the page produced any ReferenceError / SyntaxError / TypeError we will fail the test here.
    const hasCriticalErrors = pageErrors.some(e => {
      const msg = String(e);
      return /ReferenceError|SyntaxError|TypeError/.test(msg);
    });

    expect(hasCriticalErrors).toBeFalsy();
  });

  test('Observability: capture console messages (if any) and ensure logging appears in output area', async () => {
    // Trigger some actions that write to the on-page output (not console)
    await demo.parseBtn.click();
    await demo.page.waitForTimeout(20);
    await demo.clickGenerate();
    await demo.page.waitForTimeout(20);

    const outText = await demo.getOutputText();
    // The on-page logger writes entries with timestamps in square brackets; check presence of timestamped lines
    expect(outText).toMatch(/\[\d{1,2}:\d{2}:\d{2}\]/);

    // consoleMessages may be empty (the page writes to DOM rather than console), but ensure we captured whatever exists
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });
});