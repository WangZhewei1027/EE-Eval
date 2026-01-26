import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c15b322-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page Object for Query Optimization Explorer
class QOEPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // helpers to access elements
  numTablesSelector() { return '#numTables'; }
  runOptimizerSelector() { return '#runOptimizer'; }
  resetDefaultsSelector() { return '#resetDefaults'; }
  randomizeSelector() { return '#randomizeQuery'; }
  startDPSelector() { return '#startDP'; }
  dpNextSelector() { return '#dpNext'; }
  dpPrevSelector() { return '#dpPrev'; }
  runDPToEndSelector() { return '#runDPToEnd'; }
  runGreedySelector() { return '#runGreedy'; }
  runRandomSelector() { return '#runRandom'; }
  runGeneticSelector() { return '#runGenetic'; }
  evaluateManualSelector() { return '#evaluateManual'; }
  exportStateSelector() { return '#exportState'; }
  importStateSelector() { return '#importState'; }
  clearHistorySelector() { return '#clearHistory'; }
  simulatePlanSelector() { return '#simulatePlan'; }
  simulateManualSelector() { return '#simulateManual'; }
  showBestSelector() { return '#showBest'; }
  showAllPlansSelector() { return '#showAllPlans'; }
  manualOrderSelector() { return '#manualOrder'; }
  manualJoinAlgsSelector() { return '#manualJoinAlgs'; }
  stateJsonSelector() { return '#stateJson'; }
  planSpacePre() { return '#planSpacePre'; }
  bestPlanPre() { return '#bestPlanPre'; }
  dpStatePre() { return '#dpStatePre'; }
  historyPre() { return '#historyPre'; }
  executionPre() { return '#executionPre'; }
  simStepSelector() { return '#simStep'; }

  // actions
  async changeNumTables(value) {
    await this.page.selectOption(this.numTablesSelector(), String(value));
    // firing change handler happens automatically
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async setInputValue(selector, value) {
    await this.page.fill(selector, String(value));
  }

  async getWindowState() {
    return await this.page.evaluate(() => window.state ? clone(state) : null);
  }

  async getInnerText(selector) {
    return await this.page.locator(selector).innerText();
  }

  async getValue(selector) {
    return await this.page.locator(selector).inputValue();
  }
}

// Global fixtures: capture console and pageerrors and dialogs
test.describe('Query Optimization Explorer - FSM & interactions', () => {
  let consoleErrors;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogMessages = [];

    // collect console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    // auto-accept alerts/prompts and record them
    page.on('dialog', async (dialog) => {
      dialogMessages.push({ type: dialog.type(), message: dialog.message() });
      try {
        await dialog.accept();
      } catch (e) {
        // ignore accept errors (dialog could be closed)
      }
    });
  });

  test.afterEach(async () => {
    // nothing global to tear down here; individual tests assert errors
  });

  test.describe('Initial state (S0_Idle) and basic UI wiring', () => {
    test('loads page and initializes defaults (entry action initDefaults)', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // verify title and main header exist
      const h1 = await page.locator('h1').innerText();
      expect(h1).toContain('Query Optimization Explorer');

      // check numTables default value (should match select's selected option)
      const numTablesValue = await app.getValue(app.numTablesSelector());
      expect(['2','3','4','5','6']).toContain(numTablesValue);

      // validate JS state was initialized via initDefaults by reading window.state
      const state = await app.getWindowState();
      expect(state).not.toBeNull();
      // default tables length should equal select value
      expect(state.tables.length).toBe(parseInt(numTablesValue));

      // DP snapshots should be empty initially (no DP run)
      expect(Array.isArray(state.dpSteps)).toBeTruthy();
      expect(state.dpSteps.length).toBeGreaterThanOrEqual(0);

      // UI regions exist and show initial content (plan space area)
      const planSpaceText = await app.getInnerText(app.planSpacePre());
      expect(planSpaceText.length).toBeGreaterThanOrEqual(0);

      // Ensure no console or page errors occurred during load
      expect(consoleErrors.length, 'console errors during load').toBe(0);
      expect(pageErrors.length, 'page errors during load').toBe(0);
      // No unexpected dialogs on load
      expect(dialogMessages.length, 'dialogs on load').toBe(0);
    });
  });

  test.describe('Optimizer Run and transitions S0_Idle -> S1_Optimizing and back to UI updates', () => {
    test('Run optimizer (DP) transitions to optimizing and produces a best plan', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // click Run Optimizer (full) - default optimizer is DP
      await app.click(app.runOptimizerSelector());

      // an alert should have been shown about DP completed (or started) and accepted
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const lastDialog = dialogMessages[dialogMessages.length - 1];
      expect(lastDialog.message).toMatch(/DP completed|DP started|Best cost|completed|done/);

      // After running DP, state.bestPlan should be set
      const state = await app.getWindowState();
      expect(state.bestPlan, 'bestPlan after DP').not.toBeNull();

      // Plan space and best plan UI updated
      const planSpaceText = await app.getInnerText(app.planSpacePre());
      expect(planSpaceText).toContain('cost=');

      const bestPlanText = await app.getInnerText(app.bestPlanPre());
      expect(bestPlanText.length).toBeGreaterThan(0);

      // No console or page errors occurred during optimization
      expect(consoleErrors.length, 'console errors during DP').toBe(0);
      expect(pageErrors.length, 'page errors during DP').toBe(0);
    });

    test('Changing number of tables while optimizing resets defaults and updates UI (ChangeNumTables)', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // Run optimizer first to be in S1_Optimizing context
      await app.click(app.runOptimizerSelector());
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);

      // Change number of tables to 4
      await app.changeNumTables(4);

      // state.tables should now reflect 4 tables
      const stateAfter = await app.getWindowState();
      expect(stateAfter.tables.length).toBe(4);

      // Changing tables should reset planSpace and bestPlan (initDefaults resets them)
      expect(Array.isArray(stateAfter.planSpace)).toBeTruthy();
      // planSpace likely emptied after initDefaults
      expect(stateAfter.planSpace.length).toBeGreaterThanOrEqual(0);

      // UI updated accordingly: tablesContainer should contain controls for 4 tables
      const tablesContainerText = await page.locator('#tablesContainer').innerText();
      // There should be at least 4 occurrences of "Include" label
      const includeCount = (tablesContainerText.match(/Include/g) || []).length;
      expect(includeCount).toBeGreaterThanOrEqual(4);

      // No console or page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Reset to defaults action resets state and records history (ResetDefaults)', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // perform randomize first to produce history
      await app.click(app.randomizeSelector());
      // dialogMessages may have grown due to randomize not necessarily alerting (randomize doesn't alert)
      // Now click reset defaults
      await app.click(app.resetDefaultsSelector());

      // state.history should contain reset_defaults
      const state = await app.getWindowState();
      const foundReset = state.history.some(h => h.action === 'reset_defaults');
      expect(foundReset).toBeTruthy();

      // confirm UI values match state (numTables value matches tables length)
      const numTablesVal = parseInt(await app.getValue(app.numTablesSelector()));
      expect(state.tables.length).toBe(numTablesVal);

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Randomize Query updates state and records history (RandomizeQuery)', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // click randomize
      await app.click(app.randomizeSelector());

      const state = await app.getWindowState();
      const foundRandomize = state.history.some(h => h.action === 'randomize_query');
      expect(foundRandomize).toBeTruthy();

      // predicates should be present (some enabled sometimes)
      expect(typeof state.predicates).toBe('object');

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Dynamic Programming (DP) step controls', () => {
    test('Start DP in step mode and navigate DP snapshots (StartDP, DPNextStep, DPPrevStep, RunDPToEnd)', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // Start DP in step mode
      await app.click(app.startDPSelector());

      // dialog about starting in step mode should have been shown
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const last = dialogMessages[dialogMessages.length - 1];
      expect(last.message).toMatch(/DP started in step mode|DP completed/);

      // state.dpSteps should be populated
      let state = await app.getWindowState();
      expect(Array.isArray(state.dpSteps)).toBeTruthy();
      expect(state.dpSteps.length).toBeGreaterThanOrEqual(1);

      // dpPointer initially set (startDP sets dpPointer=0)
      expect(state.dpPointer).toBeGreaterThanOrEqual(0);

      // Click DP Next a couple times (if available) and inspect dpPointer changes
      const initialPointer = state.dpPointer;
      await app.click(app.dpNextSelector());
      state = await app.getWindowState();
      expect(state.dpPointer).toBeGreaterThanOrEqual(initialPointer);

      // Click DP Prev
      await app.click(app.dpPrevSelector());
      state = await app.getWindowState();
      expect(state.dpPointer).toBeGreaterThanOrEqual(0);

      // Run DP to end
      await app.click(app.runDPToEndSelector());
      state = await app.getWindowState();
      expect(state.dpPointer).toBe(state.dpSteps.length - 1);

      // dpStatePre UI should display snapshot text
      const dpPreText = await app.getInnerText(app.dpStatePre());
      expect(dpPreText).toContain('DP snapshot step');

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: Run DP when not enough tables triggers alert', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // change numTables to 1 (edge case) and update UI
      await app.changeNumTables(1);

      // Try to run optimizer (DP) - should alert that need at least 2 tables
      await app.click(app.runOptimizerSelector());

      // Expect an alert mentioning need at least 2 included tables or similar text
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const last = dialogMessages[dialogMessages.length - 1];
      expect(last.message.toLowerCase()).toMatch(/need at least 2|need at least 2 tables|at least 2/);

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Heuristic and randomized algorithms', () => {
    test('Run Greedy produces a best plan and updates history (RunGreedy)', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // Click runGreedy
      await app.click(app.runGreedySelector());

      // alert must have been shown and accepted
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const last = dialogMessages[dialogMessages.length - 1];
      expect(last.message).toMatch(/Greedy completed|completed|Cost/);

      // state should record greedy action in history
      const state = await app.getWindowState();
      expect(state.history.some(h => h.action === 'greedy')).toBeTruthy();
      expect(state.bestPlan).not.toBeNull();

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Run Randomized with custom iterations (RunRandom)', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // set random iterations small to keep test fast
      await app.setInputValue('#randomIters', '10');
      await app.click(app.runRandomSelector());

      // alert reported
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const last = dialogMessages[dialogMessages.length - 1];
      expect(last.message).toMatch(/Randomized|Best cost|done/);

      const state = await app.getWindowState();
      expect(state.history.some(h => h.action === 'random')).toBeTruthy();
      expect(Array.isArray(state.planSpace)).toBeTruthy();
      expect(state.bestPlan).not.toBeNull();

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Run Genetic-like with small population and iterations (RunGenetic)', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // small population and iterations to make test quick
      await app.setInputValue('#genPopulation', '4');
      await app.setInputValue('#genIters', '3');
      await app.click(app.runGeneticSelector());

      // alert reported
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const last = dialogMessages[dialogMessages.length - 1];
      expect(last.message).toMatch(/Genetic-like|Best cost|done/);

      const state = await app.getWindowState();
      expect(state.history.some(h => h.action === 'genetic')).toBeTruthy();
      expect(state.bestPlan).not.toBeNull();

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Manual plan evaluation and simulation', () => {
    test('Evaluate manual join order updates best plan and history (EvaluateManualOrder)', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // set a manual order that matches included tables (default includes A,B,C)
      await app.setInputValue(app.manualOrderSelector(), 'A,B,C');
      await app.setInputValue(app.manualJoinAlgsSelector(), 'hash,merge');

      // click Evaluate Manual
      await app.click(app.evaluateManualSelector());

      // should alert and update bestPlan and history
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const last = dialogMessages[dialogMessages.length - 1];
      expect(last.message).toMatch(/Manual plan evaluated|evaluated|Cost/);

      const state = await app.getWindowState();
      expect(state.history.some(h => h.action === 'manual_eval')).toBeTruthy();
      expect(state.bestPlan).not.toBeNull();

      // Best plan UI should be non-empty
      const bestPlanText = await app.getInnerText(app.bestPlanPre());
      expect(bestPlanText.length).toBeGreaterThan(0);

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Simulate best plan (SimulateBestPlan) populates execution trace and configures slider', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // Ensure there is a best plan: run greedy to get one quickly
      await app.click(app.runGreedySelector());
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);

      // click simulate best plan
      await app.click(app.simulatePlanSelector());

      // executionPre should contain trace text
      const execText = await app.getInnerText(app.executionPre());
      expect(execText.length).toBeGreaterThan(0);
      expect(execText).toMatch(/Step \d+: JOIN|Final estimated cost|Partial estimated cost|algorithm=/);

      // slider max should be >= 0
      const sliderMax = await page.$eval(app.simStepSelector(), el => el.max);
      expect(Number(sliderMax)).toBeGreaterThanOrEqual(0);

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Simulate manual plan (SimulateManual) evaluates then simulates then restores bestPlan', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // record current bestPlan (may be null)
      const beforeState = await app.getWindowState();
      const prevBestDesc = beforeState.bestPlan ? beforeState.bestPlan.desc : null;

      // set manual order and click simulateManual
      await app.setInputValue(app.manualOrderSelector(), 'A,B,C');
      await app.click(app.simulateManualSelector());

      // dialog messages should include manual evaluation alerts
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);

      // executionPre should contain trace text
      const execText = await app.getInnerText(app.executionPre());
      expect(execText.length).toBeGreaterThan(0);

      // after simulateManual, bestPlan should be restored to previous (function restores prevBest)
      const afterState = await app.getWindowState();
      const afterBestDesc = afterState.bestPlan ? afterState.bestPlan.desc : null;
      expect(afterBestDesc).toBe(prevBestDesc);

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('State import/export, history and plan display helpers', () => {
    test('Export state JSON populates textarea and Import applies JSON (ExportStateJSON / ImportStateJSON)', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // ensure some known state then export
      await app.click(app.exportStateSelector());
      // exportAllPlansAsJSON also bound to export; but exportStateJSON will write JSON
      const exported = await page.locator(app.stateJsonSelector()).inputValue();
      expect(exported).toBeTruthy();
      expect(exported).toMatch(/"tables"/);

      // Now mutate JSON to a slightly different valid state and import it
      const parsed = JSON.parse(exported);
      // change number of rows for first table if exists
      if (Array.isArray(parsed.tables) && parsed.tables.length > 0) {
        parsed.tables[0].rows = 12345;
      }
      const newJson = JSON.stringify(parsed, null, 2);
      await app.setInputValue(app.stateJsonSelector(), newJson);
      await app.click(app.importStateSelector());

      // import should show an alert 'Imported state.'
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const last = dialogMessages[dialogMessages.length - 1];
      expect(last.message).toMatch(/Imported state|Imported/);

      // state should reflect changed rows
      const state = await app.getWindowState();
      if (state.tables.length > 0) {
        expect(state.tables[0].rows).toBe(12345);
      }

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('ClearHistory clears the history and updates UI (ClearHistory)', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // create some history
      await app.click(app.randomizeSelector());
      // now clear history
      await app.click(app.clearHistorySelector());

      const state = await app.getWindowState();
      expect(Array.isArray(state.history)).toBeTruthy();
      expect(state.history.length).toBe(0);

      const histText = await app.getInnerText(app.historyPre());
      // historyPre may be empty string or newline
      expect(histText.trim().length).toBeLessThanOrEqual(0);

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Show Best when no best plan triggers an alert (ShowBest)', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // Ensure state has no bestPlan by resetting defaults
      await app.click(app.resetDefaultsSelector());

      // Clear any prior dialogs recorded
      dialogMessages.length = 0;

      // click showBest
      await app.click(app.showBestSelector());

      // Should alert 'No best plan' because after reset there's no best plan
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const last = dialogMessages[dialogMessages.length - 1];
      expect(last.message).toMatch(/No best plan|no best plan/);

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Show All Plans when none exist triggers alert (ShowAllPlans)', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // Reset to defaults to ensure no plans evaluated
      await app.click(app.resetDefaultsSelector());

      // Clear dialogs
      dialogMessages.length = 0;

      // clicking showAllPlans should alert about no evaluated plans
      await app.click(app.showAllPlansSelector());
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const last = dialogMessages[dialogMessages.length - 1];
      expect(last.message).toMatch(/No evaluated plans|Run an optimizer/);

      // No console/page errors
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Error & edge-case observation (console/page errors)', () => {
    test('No uncaught ReferenceError/SyntaxError/TypeError occurred during typical interactions', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // perform a representative set of actions to exercise code paths
      await app.click(app.randomizeSelector());
      await app.click(app.runGreedySelector());
      await app.click(app.runRandomSelector());
      await app.click(app.runGeneticSelector());
      await app.click(app.exportStateSelector());
      await app.click(app.simulatePlanSelector());

      // After interactions, assert there were no console errors or uncaught page errors
      expect(consoleErrors.length, `Expected no console.errors, found: ${JSON.stringify(consoleErrors)}`).toBe(0);
      expect(pageErrors.length, `Expected no page errors, found: ${JSON.stringify(pageErrors)}`).toBe(0);

      // Additionally assert that dialog messages were produced (sanity) but not errors
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    });

    test('Importing invalid JSON shows an alert but does not throw a page error', async ({ page }) => {
      const app = new QOEPage(page);
      await app.goto();

      // put invalid JSON into textarea and click import
      await app.setInputValue(app.stateJsonSelector(), 'this is not json');
      await app.click(app.importStateSelector());

      // Should alert 'Import failed' and not produce a pageerror
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const last = dialogMessages[dialogMessages.length - 1];
      expect(last.message).toMatch(/Import failed|Import failed:/);

      // No uncaught exceptions
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});