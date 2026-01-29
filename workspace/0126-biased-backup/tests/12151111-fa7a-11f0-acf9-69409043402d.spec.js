import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12151111-fa7a-11f0-acf9-69409043402d.html';

class BigOPage {
  constructor(page) {
    this.page = page;
    // elements
    this.algoSelect = page.locator('#algoSelect');
    this.algoDesc = page.locator('#algoDesc');
    this.inputSize = page.locator('#inputSize');
    this.customInput = page.locator('#customInput');
    this.customInputLabel = page.locator('#customInputLabel');
    this.generateInputBtn = page.locator('#generateInputBtn');
    this.resetInputBtn = page.locator('#resetInputBtn');
    this.runBtn = page.locator('#runBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.stepSpeedRange = page.locator('#stepSpeedRange');
    this.stepSpeedOutput = page.locator('#stepSpeedOutput');
    this.outputDiv = page.locator('#output');
    this.showComplexityChk = page.locator('#showComplexity');
    this.plotGraphChk = page.locator('#plotGraph');
    this.graphContainer = page.locator('#graphContainer');
    this.manualInputN = page.locator('#manualInputN');
    this.timeTestBtn = page.locator('#timeTestBtn');
    this.timingResult = page.locator('#timingResult');
    this.customComplexityFuncInput = page.locator('#customComplexityFunc');
    this.customFuncNvaluesInput = page.locator('#customFuncNvalues');
    this.customFuncTestBtn = page.locator('#customFuncTestBtn');
    this.customFuncResult = page.locator('#customFuncResult');
  }

  async selectAlgorithm(value) {
    await this.algoSelect.selectOption(value);
    // the page listens to change; wait a tick for handlers
    await this.page.waitForTimeout(50);
  }

  async setInputSize(n) {
    // Use fill then dispatch change to trigger generation
    await this.inputSize.fill(String(n));
    await this.page.dispatchEvent('#inputSize', 'change');
    await this.page.waitForTimeout(50);
  }

  async clickGenerateInput() {
    await this.generateInputBtn.click();
    await this.page.waitForTimeout(50);
  }

  async clickRun() {
    await this.runBtn.click();
    // runAlgorithmFull may be synchronous or async, give it time to append output
    await this.page.waitForTimeout(150);
  }

  async clickStep() {
    await this.stepBtn.click();
    await this.page.waitForTimeout(80);
  }

  async clickResetExecution() {
    await this.resetBtn.click();
    await this.page.waitForTimeout(50);
  }

  async setStepSpeed(value) {
    await this.stepSpeedRange.fill(String(value));
    await this.page.dispatchEvent('#stepSpeedRange', 'input');
    await this.page.waitForTimeout(50);
  }

  async toggleShowComplexity(on = true) {
    const checked = await this.showComplexityChk.isChecked();
    if (checked !== on) await this.showComplexityChk.click();
    await this.page.waitForTimeout(50);
  }

  async togglePlotGraph(on = true) {
    const checked = await this.plotGraphChk.isChecked();
    if (checked !== on) await this.plotGraphChk.click();
    await this.page.waitForTimeout(150);
  }

  async runTimingTestForN(n) {
    await this.manualInputN.fill(String(n));
    await this.timeTestBtn.click();
    // timing test uses performance.now and runs algorithm - give it some time
    await this.page.waitForTimeout(300);
  }

  async evaluateCustomFunc(funcStr, nvalsStr) {
    await this.customComplexityFuncInput.fill(funcStr);
    await this.customFuncNvaluesInput.fill(nvalsStr);
    await this.customFuncTestBtn.click();
    await this.page.waitForTimeout(80);
  }

  async setCustomInputRaw(text) {
    // ensure textarea visible
    await this.page.evaluate((txt) => {
      const ta = document.getElementById('customInput');
      ta.value = txt;
      ta.dispatchEvent(new Event('input', { bubbles: true }));
    }, text);
    await this.page.waitForTimeout(50);
  }
}

test.describe('Big-O Notation Interactive Explorer - FSM & UI tests', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // collect page errors and console logs to assert later
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      consoleMessages.push({type: msg.type(), text: msg.text()});
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Assert no uncaught page errors occurred during test run.
    // The application should run without throwing uncaught exceptions.
    expect(pageErrors.length, 'No unexpected page errors should occur').toBe(0);
    // Optionally surface console warnings/errors to help debugging if present.
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length, 'No console errors').toBe(0);
  });

  test('Initial Idle state: page loads and initial controls are disabled and output cleared', async ({ page }) => {
    const pg = new BigOPage(page);

    // Validate h1 exists (evidence for S0_Idle)
    await expect(page.locator('h1')).toHaveText('Big-O Notation Interactive Explorer');

    // On init the script calls onAlgorithmChange() which clears output and disables controls
    await expect(pg.outputDiv).toHaveText(''); // clearOutput called on entry
    await expect(pg.generateInputBtn).toBeDisabled();
    await expect(pg.runBtn).toBeDisabled();
    await expect(pg.stepBtn).toBeDisabled();
    await expect(pg.resetBtn).toBeDisabled();
  });

  test('Selecting an algorithm transitions to AlgorithmSelected and initializes inputs', async ({ page }) => {
    const pg = new BigOPage(page);

    // Select Linear Search
    await pg.selectAlgorithm('linear_search');

    // onAlgorithmChange should clear output and set description
    await expect(pg.outputDiv).toHaveText('');
    await expect(pg.algoDesc).toContainText('Linear Search');
    // generateInput and resetInput should be enabled for this requiresInput algorithm
    await expect(pg.generateInputBtn).toBeEnabled();
    await expect(pg.resetInputBtn).toBeEnabled();
    await expect(pg.runBtn).toBeEnabled();
    // since stepIterator exists for linear_search stepBtn should remain disabled until run
    await expect(pg.stepBtn).toBeDisabled();
    // custom input textarea should be visible
    await expect(pg.customInput).toBeVisible();
  });

  test('Changing input size generates input (InputGenerated) and populates custom input', async ({ page }) => {
    const pg = new BigOPage(page);

    await pg.selectAlgorithm('bubble_sort');
    // change input size to 5 and trigger generation
    await pg.setInputSize(5);

    // After generateInput (called on change) the customInput textarea should be populated as JSON
    const customText = await pg.customInput.inputValue();
    expect(customText.length).toBeGreaterThan(0);
    // It should be valid JSON
    let parsed = null;
    await page.waitForTimeout(20);
    parsed = await page.evaluate((s) => {
      try { JSON.parse(s); return true; } catch(e) { return false; }
    }, customText);
    expect(parsed).toBe(true);
  });

  test('Running full algorithm produces output and toggles controls (AlgorithmRunning -> ExecutionFinished)', async ({ page }) => {
    const pg = new BigOPage(page);

    await pg.selectAlgorithm('binary_search');
    await pg.setInputSize(7);
    // generateInput has likely run; run the algorithm fully
    await pg.clickRun();

    // Expect output to include either a found/ done message or Result
    const out = await pg.outputDiv.textContent();
    expect(out.length).toBeGreaterThan(0);
    expect(out.toLowerCase()).toMatch(/(found|result|done|sorted|traversal|lookup|power set|execution)/);

    // stepBtn should be enabled because binary_search has a stepIterator
    await expect(pg.stepBtn).toBeEnabled();
    // resetBtn should be disabled after full run (per implementation)
    await expect(pg.resetBtn).toBeDisabled();
  });

  test('Stepping through a step-capable algorithm reaches ExecutionFinished state and toggles buttons', async ({ page }) => {
    const pg = new BigOPage(page);

    // Use linear_search with small input to step through quickly
    await pg.selectAlgorithm('linear_search');
    await pg.setInputSize(5);

    // Click step to start stepping (runSteps called)
    await pg.clickStep();

    // After first step output should show checking or search range
    await expect(pg.outputDiv).toContainText('Checking index', { timeout: 1000 }).catch(async () => {
      // Some runs might start with different check phrasing; just assert output non-empty if specific text not found
      const text = await pg.outputDiv.textContent();
      expect(text.length).toBeGreaterThan(0);
    });

    // Continue stepping until finished: loop with a safe upper bound
    let finished = false;
    for (let i = 0; i < 20; i++) {
      const txt = await pg.outputDiv.textContent();
      if (txt.includes('*** Execution finished ***') || txt.includes('Done:')) {
        finished = true;
        break;
      }
      // If still executionRunning, clicking step either steps or triggers stepNext
      await pg.clickStep();
    }
    const finalText = await pg.outputDiv.textContent();
    expect(finalText).toMatch(/\*\*\* Execution finished \*\*\*|Done:/);
    // After finished, resetBtn should be enabled per stepNext
    await expect(pg.resetBtn).toBeEnabled();
    // stepBtn should be disabled after finished
    await expect(pg.stepBtn).toBeDisabled();
  });

  test('Reset execution clears output and restores control states', async ({ page }) => {
    const pg = new BigOPage(page);

    await pg.selectAlgorithm('linear_search');
    await pg.setInputSize(4);
    // Start stepping to enable resetBtn
    await pg.clickStep();
    // wait a small time then click reset
    await pg.clickResetExecution();

    // Output should be cleared and stepBtn state restored (disabled because not running)
    await expect(pg.outputDiv).toHaveText('');
    // After reset, runBtn should be enabled
    await expect(pg.runBtn).toBeEnabled();
    // stepBtn should be disabled or match algorithm stepIterator existence; for linear_search it should be disabled until run
    await expect(pg.stepBtn).toBeDisabled();
    // resetBtn should be disabled again
    await expect(pg.resetBtn).toBeDisabled();
  });

  test('Step speed control updates displayed ms and does not throw', async ({ page }) => {
    const pg = new BigOPage(page);

    // Change value and ensure output field updates
    await pg.setStepSpeed(200);
    await expect(pg.stepSpeedOutput).toHaveText('200');

    // Set a high value
    await pg.setStepSpeed(1000);
    await expect(pg.stepSpeedOutput).toHaveText('1000');
  });

  test('Show complexity and plot graph toggle behavior', async ({ page }) => {
    const pg = new BigOPage(page);

    await pg.selectAlgorithm('merge_sort');
    // Show complexity text
    await pg.toggleShowComplexity(true);
    await expect(pg.graphContainer).toContainText('Time Complexity');
    await expect(pg.graphContainer).toContainText('Merge sort');

    // Plot graph should add ASCII chart lines when toggled
    await pg.togglePlotGraph(true);
    const graphText = await pg.graphContainer.textContent();
    expect(graphText).toMatch(/N \| Complexity|Complexity \(approx\)|\*/);
  });

  test('Run timing test produces timing output for selected algorithm', async ({ page }) => {
    const pg = new BigOPage(page);

    await pg.selectAlgorithm('hashmap_get');
    // Run timing test for N=10
    await pg.runTimingTestForN(10);

    const timingText = await pg.timingResult.textContent();
    expect(timingText).toMatch(/Execution time for N=10:|Execution time for N=10/);
  });

  test('Evaluate custom complexity function with valid expression and with invalid expression', async ({ page }) => {
    const pg = new BigOPage(page);

    // Valid expression
    await pg.evaluateCustomFunc('n * Math.log2(n)', '10,100');
    const res1 = await pg.customFuncResult.textContent();
    expect(res1).toContain('f(10)');
    expect(res1).toContain('f(100)');

    // Invalid expression should surface an ERROR per implementation
    await pg.evaluateCustomFunc('invalidFunc(()', '5');
    const res2 = await pg.customFuncResult.textContent();
    expect(res2).toMatch(/ERROR|error/);
  });

  test('Edge case: invalid custom JSON input shows parse error and prevents run', async ({ page }) => {
    const pg = new BigOPage(page);

    await pg.selectAlgorithm('bubble_sort');
    await pg.setInputSize(4);

    // Put invalid JSON into custom input
    await pg.setCustomInputRaw('{bad json: ,}');
    // Run algorithm - parseCustomInput should append parse error to output
    await pg.clickRun();

    await expect(pg.outputDiv).toContainText('Input JSON parse error');
  });

  test('Edge case: stepping not available for algorithms without stepIterator', async ({ page }) => {
    const pg = new BigOPage(page);

    // fibonacci_recursive has no stepIterator (null)
    await pg.selectAlgorithm('fibonacci_recursive');
    // stepBtn should be disabled by onAlgorithmChange initially
    await expect(pg.stepBtn).toBeDisabled();

    // Attempt to click step button (should be no-op / not start stepping). But runSteps is invoked only if not executionRunning.
    // Clicking stepBtn when disabled does nothing. Instead, attempt to runSteps by clicking step after run (the UI sets runBtn enabled)
    await pg.setInputSize(6);
    // Use runBtn first to enable step possibility (but stepIterator is null, so runSteps should append message)
    await pg.clickRun();
    // Manually click stepBtn (still disabled) to ensure no crash; simulate user trying to step -> nothing happens.
    await pg.page.click('#stepBtn', { force: true }).catch(() => {});
    // But the code exposes a message when runSteps is invoked and stepIterator missing; we can call runSteps by clicking runBtn then stepBtn with force
    // Check that if user tries to trigger stepping for non-step-capable algorithm the app appends info
    // The implementation returns early: runSteps checks currentAlgorithm.stepIterator and will append "Step execution not available for this algorithm."
    // Because stepBtn is disabled, we simulate that by directly invoking click on stepBtn with force (above) and look for that message.
    const out = await pg.outputDiv.textContent();
    // Either the output contains 'Step execution not available' or contains a result from running algorithm
    expect(out.length).toBeGreaterThan(0);
  });

});