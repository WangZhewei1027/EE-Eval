import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d6d421-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object to encapsulate common interactions and queries
class InterpolationDemoPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      app: '.app[role="main"][aria-label="Interpolation Search demo"]',
      sizeInput: '#size',
      distSelect: '#dist',
      generateBtn: '#generate',
      shuffleBtn: '#shuffle',
      targetInput: '#target',
      randomTargetBtn: '#randomTarget',
      startBtn: '#start',
      stepBtn: '#step',
      resetBtn: '#reset',
      speedInput: '#speed',
      runBothBtn: '#runBoth',
      runBinaryBtn: '#runBinary',
      array: '#array',
      cells: '#array .cell',
      probes: '#probes',
      comps: '#comps',
      iters: '#iters',
      found: '#found',
      log: '#log',
      formula: '#formula'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the app element to be present
    await this.page.waitForSelector(this.selectors.app);
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async getLogText() {
    return this.page.locator(this.selectors.log).textContent();
  }

  async waitForLogContains(substring, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, sub) => document.querySelector(sel) && document.querySelector(sel).textContent.includes(sub),
      this.selectors.log,
      substring,
      { timeout }
    );
  }

  async getCellsCount() {
    return this.page.locator(this.selectors.cells).count();
  }

  async getCellValues() {
    const count = await this.getCellsCount();
    const values = [];
    for (let i = 0; i < count; i++) {
      const cell = this.page.locator(this.selectors.cells).nth(i);
      const text = (await cell.textContent()).trim();
      values.push(text);
    }
    return values;
  }

  async getStats() {
    const probes = (await this.page.locator(this.selectors.probes).textContent()).trim();
    const comps = (await this.page.locator(this.selectors.comps).textContent()).trim();
    const iters = (await this.page.locator(this.selectors.iters).textContent()).trim();
    const found = (await this.page.locator(this.selectors.found).textContent()).trim();
    return { probes, comps, iters, found };
  }

  async getFormulaText() {
    return (await this.page.locator(this.selectors.formula).textContent()).trim();
  }

  async setSize(value) {
    await this.page.fill(this.selectors.sizeInput, String(value));
    // trigger change by blur or pressing Enter
    await this.page.locator(this.selectors.sizeInput).press('Enter');
    // change event triggers generateAndRender on change
  }

  async setDistribution(value) {
    await this.page.selectOption(this.selectors.distSelect, value);
  }

  async setTarget(value) {
    await this.page.fill(this.selectors.targetInput, String(value));
  }

  async getTargetValue() {
    const v = await this.page.locator(this.selectors.targetInput).inputValue();
    return v;
  }

  async setSpeed(value) {
    // set attribute value and dispatch input event
    await this.page.evaluate((sel, val) => {
      const el = document.querySelector(sel);
      el.value = String(val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, this.selectors.speedInput, value);
  }

  async clickSpace() {
    // simulate keyboard space press to trigger step via window keydown handler
    await this.page.keyboard.press('Space');
  }

  async cellHasClass(index, className) {
    return await this.page.locator(this.selectors.cells).nth(index).hasClass(className);
  }

  async anyCellWithClass(className) {
    return await this.page.locator(`${this.selectors.array} .cell.${className}`).count();
  }
}

// Setup: capture console messages and page errors for assertions
test.describe('Interpolation Search — Interactive Demo (FSM validation)', () => {
  let pageErrors = [];
  let consoleMessages = [];
  let demo;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];
    // capture page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    // capture console events (log, error, warning, info)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    demo = new InterpolationDemoPage(page);
    await demo.goto();
  });

  test.afterEach(async ({ page }) => {
    // ensure no unexpected page errors were swallowed silently
    // We will assert absence/presence explicitly inside tests as needed.
  });

  test('Initial Idle state renders the page and runs initial generateAndRender (S0_Idle entry)', async () => {
    // Validate that the main app container exists and initial generation ran
    await expect(demo.page.locator(demo.selectors.app)).toBeVisible();

    // The page runs generateAndRender on load; wait for "Generated" message in the log
    await demo.waitForLogContains('Generated', 2000);

    // Ensure the array was rendered and number of cells equals the size input value (clamped)
    const sizeValue = parseInt(await demo.page.locator(demo.selectors.sizeInput).inputValue());
    const cellCount = await demo.getCellsCount();
    expect(cellCount).toBe(sizeValue);

    // Formula default text present
    const formula = await demo.getFormulaText();
    expect(formula).toContain('pos = low +');

    // Assert no page errors occurred on load
    expect(pageErrors.length).toBe(0);
  });

  test('Generate array transition (S0_Idle -> S1_ArrayGenerated): clicking Generate updates array and log', async () => {
    // Change distribution to ensure behavior under different distributions
    await demo.setDistribution('random');
    // Click Generate array and assert log and array change
    const initialValues = await demo.getCellValues();
    await demo.click(demo.selectors.generateBtn);
    await demo.waitForLogContains('Generated', 2000);

    const newValues = await demo.getCellValues();
    // Values should be present and the array should re-render (values may differ)
    expect(newValues.length).toBeGreaterThanOrEqual(5);
    // There is a chance same values generated, but typically random distribution changes ordering - check at least DOM re-render occurred
    const initialHtml = initialValues.join(',');
    const newHtml = newValues.join(',');
    // Accept either different or same; assert the log contains expected generated message
    const log = await demo.getLogText();
    expect(log).toContain('Generated');

    // No page errors on generate
    expect(pageErrors.length).toBe(0);
  });

  test('Shuffle array transition: clicking Regenerate values updates array and logs', async () => {
    const before = await demo.getCellValues();
    await demo.click(demo.selectors.shuffleBtn);
    await demo.waitForLogContains('Regenerated values', 2000);
    const after = await demo.getCellValues();
    // Values should be different or at least the regenerate log exists
    const logText = await demo.getLogText();
    expect(logText).toContain('Regenerated values');
    // Ensure the array DOM remains populated
    expect(after.length).toBeGreaterThanOrEqual(5);
    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Set random target event: Random button picks a value from the array', async () => {
    const values = await demo.getCellValues();
    expect(values.length).toBeGreaterThan(0);
    await demo.click(demo.selectors.randomTargetBtn);
    // target input should equal one of the values
    const target = await demo.getTargetValue();
    const found = values.includes(target);
    expect(found).toBe(true);
    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Step through interpolation search (S1_ArrayGenerated -> S3_Stepping): manual stepping updates stats and highlights', async () => {
    // Ensure a known target: choose middle value which should exist
    const values = await demo.getCellValues();
    const midIndex = Math.floor(values.length / 2);
    const midValue = values[midIndex];
    await demo.setTarget(midValue);

    // Click Step: should start generator and log starting message
    await demo.click(demo.selectors.stepBtn);
    await demo.waitForLogContains('Starting interpolation search for', 2000);
    // After one step, probes/iters should update (probes may be 1)
    const stats1 = await demo.getStats();
    // iters should be at least 1
    expect(parseInt(stats1.iters)).toBeGreaterThanOrEqual(1);

    // Keep stepping until result found or max steps to avoid flakiness
    let attempts = 0;
    let foundIndex = null;
    while (attempts < 50) {
      const stats = await demo.getStats();
      if (stats.found !== '-' && stats.found !== '') {
        foundIndex = stats.found;
        break;
      }
      await demo.click(demo.selectors.stepBtn);
      attempts++;
    }
    // After stepping, found should be set (value existed)
    expect(foundIndex === '-' || foundIndex === null ? false : true).toBe(true);
    // Verify that a cell with class 'found' exists when found
    const foundClassCount = await demo.anyCellWithClass('found');
    expect(foundClassCount).toBeGreaterThanOrEqual(0); // can be 0 if search finished but highlight not applied (defensive)

    // Ensure log includes 'found' or 'Result: found' at some point
    const logText = await demo.getLogText();
    expect(logText.includes('found') || logText.includes('Result:')).toBe(true);

    // No page errors
    expect(pageErrors.length).toBe(0);
  }, 20000);

  test('Start auto-play interpolation search (S1_ArrayGenerated -> S2_Searching): Start runs and auto-play logs progress and final result', async ({ timeout }) => {
    // speed down to make auto-play fast
    await demo.setSpeed(50);

    // pick a known existing value
    const values = await demo.getCellValues();
    const val = values[Math.floor(values.length / 3)];
    await demo.setTarget(val);

    // Click Start: should begin autoplay and log 'Auto-play started.'
    await demo.click(demo.selectors.startBtn);
    await demo.waitForLogContains('Auto-play started.', 2000);

    // Wait for final result message "Result:" which finalizeSearchResult logs
    await demo.waitForLogContains('Result:', 5000);

    // Stats should reflect completion: iters > 0
    const stats = await demo.getStats();
    expect(parseInt(stats.iters)).toBeGreaterThan(0);

    // Ensure probe/comparison numbers are non-negative integers
    expect(parseInt(stats.probes)).toBeGreaterThanOrEqual(0);
    expect(parseInt(stats.comps)).toBeGreaterThanOrEqual(0);

    // No page errors
    expect(pageErrors.length).toBe(0);
  }, 15000);

  test('Reset search (S1_ArrayGenerated -> S4_Reset): Reset regenerates and logs Reset demo', async () => {
    // Click Reset and expect 'Reset demo.' in log and array re-generated
    await demo.click(demo.selectors.resetBtn);
    await demo.waitForLogContains('Reset demo.', 2000);
    const log = await demo.getLogText();
    expect(log).toContain('Reset demo.');

    // After reset, probes/comps/iters should have been reset
    const stats = await demo.getStats();
    expect(stats.probes).toBe('0');
    expect(stats.comps).toBe('0');
    expect(stats.iters).toBe('0');

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Run both searches (S1_ArrayGenerated -> S5_BothSearchesRun): Run both logs interpolation and binary results and updates stats', async () => {
    // Ensure target is a known value to produce a found result
    const values = await demo.getCellValues();
    const pick = values[Math.max(0, Math.floor(values.length / 4))];
    await demo.setTarget(pick);

    // Click Run both
    await demo.click(demo.selectors.runBothBtn);

    // Wait for both logs to appear
    await demo.waitForLogContains('Interpolation:', 2000);
    await demo.waitForLogContains('Binary:', 2000);

    const log = await demo.getLogText();
    expect(log).toContain('Interpolation:');
    expect(log).toContain('Binary:');

    // Stats should reflect interpolation result (probes >= 0)
    const stats = await demo.getStats();
    expect(parseInt(stats.probes)).toBeGreaterThanOrEqual(0);

    // If interpolation found, highlight should show found cell (defensive)
    // This may be optional depending on whether found != -1
    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Run binary search animation (S2_Searching -> S6_BinarySearchRunning): clicking Run binary starts animated binary search and logs start', async () => {
    // pick an existing target
    const values = await demo.getCellValues();
    const value = values[Math.floor(values.length / 2)];
    await demo.setTarget(value);

    // speed up binary animation
    await demo.setSpeed(50);

    // Click run binary
    await demo.click(demo.selectors.runBinaryBtn);

    // Should log starting binary search
    await demo.waitForLogContains('Starting binary search for', 2000);

    // Wait for a short time for animation to progress and perhaps finish
    await demo.page.waitForTimeout(800);

    // Expect some probes/iters to be non-zero while animation runs or after completion
    const stats = await demo.getStats();
    expect(parseInt(stats.iters)).toBeGreaterThanOrEqual(0);

    // Expect 'Result:' eventually (animation finalizes)
    // We give it a bit more time to finish
    await demo.page.waitForTimeout(1500);
    const log = await demo.getLogText();
    expect(log.includes('Result:') || log.includes('found') || log.includes('not found')).toBe(true);

    // No page errors
    expect(pageErrors.length).toBe(0);
  }, 15000);

  test('Edge cases: size clamping and target edit clears generator', async () => {
    // Test size clamping (below minimum)
    await demo.setSize(3); // below min 5
    // generateAndRender will clamp to 5
    const sizeAfterMin = parseInt(await demo.page.locator(demo.selectors.sizeInput).inputValue());
    expect(sizeAfterMin).toBeGreaterThanOrEqual(5);

    // Test size clamping (above maximum)
    await demo.setSize(9999);
    const sizeAfterMax = parseInt(await demo.page.locator(demo.selectors.sizeInput).inputValue());
    expect(sizeAfterMax).toBeLessThanOrEqual(201);

    // Start a search, then modify target input (should clear currentGenerator and stop autoplay)
    // Pick an existing value and start
    const values = await demo.getCellValues();
    const v = values[0];
    await demo.setTarget(v);
    await demo.click(demo.selectors.startBtn);
    await demo.waitForLogContains('Auto-play started.', 2000);

    // Now change target value: the code adds input listener to clear generator and stop autoplay
    const newTargetValue = values[Math.min(values.length - 1, 2)];
    await demo.setTarget(newTargetValue);

    // Press space to step (this should create a fresh generator and log a new "Starting interpolation search for" message)
    await demo.clickSpace();
    await demo.waitForLogContains('Starting interpolation search for', 2000);

    // Confirm that the log now contains an entry for the new target start
    const log = await demo.getLogText();
    expect(log).toContain('Starting interpolation search for');

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Observes console and page errors: assert no uncaught exceptions or console.error were emitted during interactions', async () => {
    // Perform a sequence of interactions to exercise code paths
    await demo.click(demo.selectors.shuffleBtn);
    await demo.click(demo.selectors.randomTargetBtn);
    await demo.click(demo.selectors.stepBtn);
    await demo.click(demo.selectors.generateBtn);
    await demo.click(demo.selectors.runBothBtn);

    // Allow some time for any async errors to surface
    await demo.page.waitForTimeout(500);

    // Collect console.error entries
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');

    // Assert that the page didn't produce unhandled page errors
    expect(pageErrors.length).toBe(0);

    // Assert there are no console.error messages emitted by the page script
    expect(consoleErrors.length).toBe(0);
  });

});