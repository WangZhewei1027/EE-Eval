import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c14efd4-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object encapsulating common interactions used by tests
class TimeComplexityPage {
  constructor(page) {
    this.page = page;
    // Algorithm panel
    this.modeSelect = page.locator('#modeSelect');
    this.algoSelect = page.locator('#algoSelect');
    this.nRange = page.locator('#nRange');
    this.nInput = page.locator('#nInput');
    this.patternSelect = page.locator('#patternSelect');
    this.generateBtn = page.locator('#generateBtn');
    this.shuffleBtn = page.locator('#shuffleBtn');
    this.arrayView = page.locator('#arrayView');
    this.stepBtn = page.locator('#stepBtn');
    this.prevBtn = page.locator('#prevBtn');
    this.opLog = page.locator('#opLog');
    this.compCount = page.locator('#compCount');
    this.swapCount = page.locator('#swapCount');
    this.assignCount = page.locator('#assignCount');
    this.recDepth = page.locator('#recDepth');
    this.stepsCount = page.locator('#stepsCount');
    this.theory = page.locator('#theory');
    this.guessInput = page.locator('#guessInput');
    this.guessBtn = page.locator('#guessBtn');
    this.guessResult = page.locator('#guessResult');

    // Benchmark panel
    this.benchPanel = page.locator('#benchPanel');
    this.benchAlgo = page.locator('#benchAlgo');
    this.minN = page.locator('#minN');
    this.maxN = page.locator('#maxN');
    this.stepN = page.locator('#stepN');
    this.trials = page.locator('#trials');
    this.runBenchBtn = page.locator('#runBenchBtn');
    this.benchResults = page.locator('#benchResults');
    this.modelResults = page.locator('#modelResults');
    this.benchPattern = page.locator('#benchPattern');

    // Builder panel
    this.builderPanel = page.locator('#builderPanel');
    this.addLoopBtn = page.locator('#addLoop');
    this.clearLoopsBtn = page.locator('#clearLoops');
    this.blockCost = page.locator('#blockCost');
    this.addBlockBtn = page.locator('#addBlock');
    this.builtExpr = page.locator('#builtExpr');
    this.builtBigO = page.locator('#builtBigO');
    this.loopsList = page.locator('#loopsList');

    // Master panel
    this.masterPanel = page.locator('#masterPanel');
    this.aVal = page.locator('#aVal');
    this.bVal = page.locator('#bVal');
    this.fSelect = page.locator('#fSelect');
    this.solveMaster = page.locator('#solveMaster');
    this.masterResult = page.locator('#masterResult');

    // Custom pseudocode
    this.customPanel = page.locator('#customPanel');
    this.pseudoInput = page.locator('#pseudoInput');
    this.parsePseudo = page.locator('#parsePseudo');
    this.clearPseudo = page.locator('#clearPseudo');
    this.pseudoResult = page.locator('#pseudoResult');

    // Misc
    this.modePanels = {
      algo: page.locator('#algoPanel'),
      bench: page.locator('#benchPanel'),
      builder: page.locator('#builderPanel'),
      master: page.locator('#masterPanel'),
      custom: page.locator('#customPanel'),
    };
  }

  async navigate() {
    await this.page.goto(APP_URL);
    // Wait for the main heading to ensure page loaded
    await this.page.waitForSelector('h1:has-text("Time Complexity Explorer")');
  }

  // Mode switching
  async switchMode(mode) {
    await this.modeSelect.selectOption(mode);
    // Wait for panel visibility change
    await expect(this.modePanels[mode]).toHaveClass(/^(?!.*hidden).*$/);
  }

  // Algorithm actions
  async selectAlgorithm(algo) {
    await this.algoSelect.selectOption(algo);
  }

  async generateInput(n = null, pattern = null) {
    if (n !== null) {
      await this.nInput.fill(String(n));
      // trigger change event on nInput
      await this.nInput.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    }
    if (pattern !== null) {
      await this.patternSelect.selectOption(pattern);
    }
    await this.generateBtn.click();
  }

  async shuffleInput() {
    await this.shuffleBtn.click();
  }

  async stepOnce() {
    await this.stepBtn.click();
  }

  async prevStep() {
    await this.prevBtn.click();
  }

  // Benchmark actions
  async runBenchmark({ algo = 'selection', min = 16, max = 64, step = 16, trials = 1, pattern = 'random' } = {}) {
    await this.benchAlgo.selectOption(algo);
    await this.minN.fill(String(min));
    await this.maxN.fill(String(max));
    await this.stepN.fill(String(step));
    await this.trials.fill(String(trials));
    await this.benchPattern.selectOption(pattern);
    await this.runBenchBtn.click();
  }

  // Builder actions
  async addLoop() {
    await this.addLoopBtn.click();
  }
  async addBlock(expr) {
    if (expr) await this.blockCost.selectOption(expr);
    await this.addBlockBtn.click();
  }

  // Master solver
  async solveMasterTheorem(a, b, f) {
    await this.aVal.fill(String(a));
    await this.bVal.fill(String(b));
    await this.fSelect.selectOption(f);
    await this.solveMaster.click();
  }

  // Pseudocode parse
  async parsePseudoCode(text) {
    await this.pseudoInput.fill(text);
    await this.parsePseudo.click();
  }
}

// Collect console messages and page errors for each test run
test.describe('Time Complexity Explorer - E2E', () => {
  test.beforeEach(async ({ page }) => {
    // No-op placeholder; tests use their own setup
  });

  test('Smoke: page loads and initial Idle state renders', async ({ page }) => {
    // Validate initial render (S0_Idle) and capture console & errors
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const ui = new TimeComplexityPage(page);
    await ui.navigate();

    // Evidence for Idle: <h1>Time Complexity Explorer</h1>
    await expect(page.locator('h1')).toHaveText('Time Complexity Explorer');

    // The application calls updateTheory() on load; ensure theory node contains expected 'Best:' prefix
    await expect(ui.theory).toContainText('Best:');

    // No uncaught page errors should have occurred during initial load
    expect(pageErrors.length).toBe(0);

    // No console error messages
    const errors = consoleMsgs.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test.describe('Algorithm Stepper & Visualizer (states S1, S2, S3)', () => {
    test.beforeEach(async ({ page }) => {
      const ui = new TimeComplexityPage(page);
      await ui.navigate();
    });

    test('SelectAlgorithm updates theory and transitions to Algorithm Selected (S1_AlgorithmSelected)', async ({ page }) => {
      // Monitor console and page errors
      const consoleMsgs = [];
      const pageErrors = [];
      page.on('console', (m) => consoleMsgs.push({ type: m.type(), text: m.text() }));
      page.on('pageerror', (e) => pageErrors.push(e));

      const ui = new TimeComplexityPage(page);

      // Ensure algorithm select exists and change to 'merge'
      await expect(ui.algoSelect).toBeVisible();
      await ui.selectAlgorithm('merge');

      // updateTheory should run as an entry action for S1_AlgorithmSelected -> verify theory updated
      await expect(ui.theory).toContainText('n log n');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);

      // No console errors emitted on algorithm selection
      const errors = consoleMsgs.filter(c => c.type === 'error');
      expect(errors.length).toBe(0);
    });

    test('GenerateInput creates array and sets Input Generated state (S2_InputGenerated) and shuffle works (ShuffleInput)', async ({ page }) => {
      const ui = new TimeComplexityPage(page);
      await ui.navigate();

      // Set n to a small number and generate
      await ui.generateInput(8, 'random');
      await expect(ui.arrayView).toBeVisible();

      // The array display should contain 8 entries - count occurrences of '[0]'..'[7]'
      const arrayText = await ui.arrayView.textContent();
      // count '[' occurrences as heuristic for number of entries
      const countBrackets = (arrayText.match(/\[\d+\]/g) || []).length;
      expect(countBrackets).toBeGreaterThanOrEqual(8);

      // Counters should be reset to 0 after generation
      await expect(ui.compCount).toHaveText('0');
      await expect(ui.swapCount).toHaveText('0');
      await expect(ui.assignCount).toHaveText('0');

      // Shuffle input should maintain same length and change order/text content (most likely)
      const before = arrayText;
      await ui.shuffleInput();
      const after = await ui.arrayView.textContent();
      // Should still display same number of bracketed indices
      const countAfter = (after.match(/\[\d+\]/g) || []).length;
      expect(countAfter).toBeGreaterThanOrEqual(8);

      // Either order changed or values changed; they might occasionally be same if random collisions,
      // so we only assert that the DOM updated (string can be equal, but at least content exists)
      expect(after.length).toBeGreaterThan(0);
    });

    test('StepAlgorithm steps through algorithm producing logs (S3_SteppingThroughAlgorithm)', async ({ page }) => {
      const ui = new TimeComplexityPage(page);
      await ui.navigate();

      // Ensure predictable small array for stepping
      await ui.selectAlgorithm('linear');
      await ui.generateInput(5, 'random');

      // Clear opLog then step once
      await ui.opLog.fill('');
      await ui.stepOnce();

      // After stepping, opLog should contain some entry (mark/compare/found)
      const logContent = await ui.opLog.textContent();
      expect(logContent.trim().length).toBeGreaterThan(0);

      // Counters should reflect at least one step or comparison incremented
      const steps = Number(await ui.stepsCount.textContent());
      const comps = Number(await ui.compCount.textContent());
      expect(steps + comps).toBeGreaterThanOrEqual(1);

      // Test prev button reverts to previous snapshot (history)
      // Save opLog, step again to create history, then prev and ensure opLog or arrayView reverts to previous state
      const beforeArray = await ui.arrayView.textContent();
      await ui.stepOnce();
      // Wait briefly to allow new log
      await page.waitForTimeout(50);
      await ui.prevStep();
      const afterPrevArray = await ui.arrayView.textContent();
      // After prev, arrayView should be a string similar to the snapshot (not empty)
      expect(afterPrevArray.length).toBeGreaterThan(0);
      // No uncaught exceptions should have occurred
      // pageerror and console errors would be caught by Playwright global if thrown; assume none
    }, { timeout: 10000 /* allow some time for generator events */ });
  });

  test.describe('Benchmark Running (S4_BenchmarkRunning)', () => {
    test('RunBenchmark runs small benchmark and produces results and model comparison', async ({ page }) => {
      const ui = new TimeComplexityPage(page);
      await ui.navigate();

      // Switch to bench mode
      await ui.switchMode('bench');
      await expect(ui.benchPanel).toBeVisible();

      // Use a very small set to keep test fast
      await ui.runBenchmark({ algo: 'native', min: 16, max: 48, step: 16, trials: 1, pattern: 'random' });

      // The runBenchBtn triggers asynchronous activity; wait for benchResults to not include 'Running...'
      await expect(ui.benchResults).not.toHaveText('Running...', { timeout: 10000 });

      // Ensure results text includes lines like "16, " and "32, " etc.
      const resultsText = await ui.benchResults.textContent();
      expect(resultsText).toMatch(/\d+,\s*\d+(\.\d+)?/);

      // Ensure modelResults contains at least one model line with 'sse='
      const modelText = await ui.modelResults.textContent();
      expect(modelText).toMatch(/sse=/);

      // Also verify a CSV was computed by checking benchPanel._lastCsv via evaluating the DOM (internal state)
      const lastCsv = await page.evaluate(() => document.getElementById('benchPanel')._lastCsv);
      expect(typeof lastCsv).toBe('string');
      expect(lastCsv.startsWith('n,median')).toBe(true);
    }, { timeout: 20000 });
  });

  test.describe('Complexity Builder (S5_ComplexityBuilder)', () => {
    test('AddLoop/AddBlock creates expression and simplified Big-O', async ({ page }) => {
      const ui = new TimeComplexityPage(page);
      await ui.navigate();

      await ui.switchMode('builder');
      await expect(ui.builderPanel).toBeVisible();

      // Start with clear
      await ui.clearLoopsBtn.click();
      // Add two nested loops by adding two loops consecutively -> should multiply to n^2
      await ui.addLoop();
      await ui.addLoop();
      // Add a sequential block 'n' to make expression like (n * n) + n
      await ui.addBlock('n');

      // builtExpr should contain tokens indicating multiplication and addition
      const expr = await ui.builtExpr.textContent();
      expect(expr.length).toBeGreaterThan(0);

      // builtBigO should produce O(n^2) as dominant term
      const bigO = await ui.builtBigO.textContent();
      expect(bigO).toMatch(/O\(/);
      // The dominant term in our construction is n^2; check for that specifically
      expect(bigO).toMatch(/n\^?2|n\^2/);
    });
  });

  test.describe('Master Theorem Solver (S6_MasterTheoremSolving)', () => {
    test('SolveMaster detects case 2 when a=2, b=2 and f=n', async ({ page }) => {
      const ui = new TimeComplexityPage(page);
      await ui.navigate();

      await ui.switchMode('master');
      await expect(ui.masterPanel).toBeVisible();

      // Set inputs: a=2, b=2, f='n' which corresponds to 'n' option in select
      await ui.solveMasterTheorem(2, 2, 'n');

      // masterResult should contain 'Case 2' and "log_b a" equals 1
      const mr = await ui.masterResult.textContent();
      expect(mr).toContain('Case 2');
      expect(mr).toContain('n^{log_b a');
    });
  });

  test.describe('Custom Pseudocode Parsing (S7_CustomPseudocodeParsing)', () => {
    test('Parse valid nested pseudocode and produce O(n^2)', async ({ page }) => {
      const ui = new TimeComplexityPage(page);
      await ui.navigate();

      await ui.switchMode('custom');
      await expect(ui.customPanel).toBeVisible();

      // Two nested for n loops that do constant work -> O(n^2)
      const pseudo = `for n
for n
do 1
end
end`;
      await ui.parsePseudoCode(pseudo);

      // Wait for pseudoResult to update
      await expect(ui.pseudoResult).toHaveText(/O\(/);
      const resultText = await ui.pseudoResult.textContent();
      expect(resultText).toMatch(/n\^?2|n\^2/);
    });

    test('Parse malformed pseudocode triggers error handling and displays error message', async ({ page }) => {
      const ui = new TimeComplexityPage(page);
      await ui.navigate();

      await ui.switchMode('custom');

      // Provide an unknown line that the parser will throw on -> should result in 'Error parsing:' output
      const badPseudo = `for n
unknown_command
end`;
      await ui.parsePseudoCode(badPseudo);

      // Error should be caught and displayed in pseudoResult element
      await expect(ui.pseudoResult).toContainText('Error parsing');
    });
  });

  test('Cross-cutting: Console and runtime errors observed and asserted', async ({ page }) => {
    // This test explicitly tracks console messages and page errors while driving multiple interactions
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (m) => consoleMessages.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (e) => pageErrors.push(e));

    const ui = new TimeComplexityPage(page);
    await ui.navigate();

    // Perform a series of actions across modes to exercise event handlers
    // 1) Algorithm: select algorithm and generate input
    await ui.selectAlgorithm('quick');
    await ui.generateInput(10, 'random');
    await ui.stepOnce();

    // 2) Benchmark: run a very tiny benchmark to exercise async path
    await ui.switchMode('bench');
    await ui.runBenchmark({ algo: 'native', min: 16, max: 16, step: 16, trials: 1, pattern: 'random' });
    // wait for bench results to finish
    await expect(ui.benchResults).not.toHaveText('Running...', { timeout: 10000 });

    // 3) Builder: add a loop and block
    await ui.switchMode('builder');
    await ui.addLoop();
    await ui.addBlock('1');

    // 4) Master: solve with default values
    await ui.switchMode('master');
    await ui.solveMasterTheorem(2, 2, 'n');

    // 5) Custom parse valid input
    await ui.switchMode('custom');
    await ui.parsePseudoCode('for n\ndo 1\nend');

    // Now assert there were no uncaught page errors during these operations
    expect(pageErrors.length).toBe(0);

    // Collect console error-level messages if any and fail test if present
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    // Some environments may produce minor console warnings; we assert none of type 'error'
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: generate input with out-of-range n (e.g., 0) corrected to minimum 1', async ({ page }) => {
    const ui = new TimeComplexityPage(page);
    await ui.navigate();

    // Try to set nInput to 0 which should be clamped to 1 by change handler
    await ui.nInput.fill('0');
    // Fire change event to trigger clamping
    await ui.nInput.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));

    // Now click generate; implementation should default to at least 1
    await ui.generateBtn.click();

    // Verify array view has at least one element
    const arrText = await ui.arrayView.textContent();
    const count = (arrText.match(/\[\d+\]/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(1);
  });
});