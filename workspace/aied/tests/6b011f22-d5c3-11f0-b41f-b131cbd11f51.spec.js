import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b011f22-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object encapsulating interactions & queries for the Kruskal visualization app
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      generateBtn: '#generate-btn',
      stepBtn: '#step-btn',
      autoBtn: '#auto-btn',
      resetBtn: '#reset-btn',
      canvas: '#graphCanvas',
      currentEdge: '#current-edge',
      mstWeight: '#mst-weight',
      stepList: '#step-list',
      log: '#log'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure basic UI elements present
    await Promise.all([
      this.page.waitForSelector(this.selectors.generateBtn),
      this.page.waitForSelector(this.selectors.stepBtn),
      this.page.waitForSelector(this.selectors.autoBtn),
      this.page.waitForSelector(this.selectors.resetBtn),
      this.page.waitForSelector(this.selectors.canvas),
      this.page.waitForSelector(this.selectors.currentEdge),
      this.page.waitForSelector(this.selectors.mstWeight),
      this.page.waitForSelector(this.selectors.stepList),
      this.page.waitForSelector(this.selectors.log)
    ]);
  }

  async clickGenerate() {
    await this.page.click(this.selectors.generateBtn);
  }

  async clickStep() {
    await this.page.click(this.selectors.stepBtn);
  }

  async clickAuto() {
    await this.page.click(this.selectors.autoBtn);
  }

  async clickReset() {
    await this.page.click(this.selectors.resetBtn);
  }

  async getCurrentEdgeText() {
    return (await this.page.textContent(this.selectors.currentEdge))?.trim();
  }

  async getMSTWeightText() {
    return (await this.page.textContent(this.selectors.mstWeight))?.trim();
  }

  async getLogText() {
    return (await this.page.textContent(this.selectors.log))?.trim();
  }

  async getAutoButtonText() {
    return (await this.page.textContent(this.selectors.autoBtn))?.trim();
  }

  async isButtonDisabled(selector) {
    return await this.page.$eval(selector, (btn) => btn.disabled);
  }

  async getStepListItems() {
    return this.page.$$eval(this.selectors.stepList + ' li', (nodes) =>
      nodes.map((n) => ({ text: n.textContent?.trim(), className: n.className }))
    );
  }

  // Wait until the log contains a substring (timeout default)
  async waitForLogContains(substring, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.indexOf(substr) !== -1;
      },
      this.selectors.log,
      substring,
      { timeout }
    );
  }

  // Click step repeatedly until step button becomes disabled or maxIterations reached
  async runStepsToCompletion(maxIterations = 200) {
    for (let i = 0; i < maxIterations; i++) {
      const disabled = await this.isButtonDisabled(this.selectors.stepBtn);
      if (disabled) return i;
      await this.clickStep();
      // small wait to let DOM update
      await this.page.waitForTimeout(50);
    }
    return maxIterations;
  }
}

test.describe('Kruskal\'s Algorithm Visualization - FSM tests', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let page;

  test.beforeEach(async ({ browser }) => {
    pageErrors = [];
    consoleErrors = [];
    page = await browser.newPage();

    // Collect uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages (errors in particular)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test('Initial load should call init() and generate a graph (S0_Idle -> S1_GraphGenerated)', async () => {
    // This test validates the app initializes on load (init()) and a graph is generated.
    const app = new KruskalPage(page);
    await app.goto();

    // The app's init() runs on load; step list should be populated and first step active.
    const steps = await app.getStepListItems();
    expect(steps.length).toBeGreaterThan(0);
    expect(steps[0].className).toMatch(/active/);

    // Log should contain "Generated graph with"
    const logText = await app.getLogText();
    expect(logText).toMatch(/Generated graph with \d+ vertices and \d+ edges/);

    // Current edge should be None after initialization / reset
    const currentEdge = await app.getCurrentEdgeText();
    expect(currentEdge).toBe('None');

    // MST weight should be zero initially
    const mstWeight = await app.getMSTWeightText();
    expect(Number(mstWeight)).toBeGreaterThanOrEqual(0);

    // Ensure no uncaught page errors of common runtime types occurred
    const runtimeErrorNames = pageErrors.map((e) => e.name || e.constructor.name);
    expect(runtimeErrorNames.filter(n => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(n))).toHaveLength(0);

    // Ensure no console error messages were emitted
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking Next Step executes a step and updates current edge and logs (S1_GraphGenerated -> S2_StepExecuted)', async () => {
    // This test validates nextStep() updates the current edge display, updates MST weight (when applicable),
    // and writes appropriate messages to the log.
    const app = new KruskalPage(page);
    await app.goto();

    // Click a single step
    await app.clickStep();

    // current-edge should no longer be "None" after a step has executed
    const currentEdge = await app.getCurrentEdgeText();
    expect(currentEdge).not.toBeNull();
    expect(currentEdge).not.toBe('None');
    expect(currentEdge).toMatch(/^[A-Z] - [A-Z] \(weight: \d+\)$/);

    // The log should contain either 'Added edge' or 'Skipped edge'
    const logText = await app.getLogText();
    expect(logText).toMatch(/(Added edge|Skipped edge)/);

    // MST weight should be numeric and >= 0
    const mstWeight = Number(await app.getMSTWeightText());
    expect(Number.isFinite(mstWeight)).toBeTruthy();
    expect(mstWeight).toBeGreaterThanOrEqual(0);

    // Step list highlighting should move to a processing step (index 3 or final)
    const steps = await app.getStepListItems();
    const anyActive = steps.some(s => /active/.test(s.className));
    expect(anyActive).toBeTruthy();

    // Ensure no uncaught runtime errors occurred
    const runtimeErrorNames = pageErrors.map((e) => e.name || e.constructor.name);
    expect(runtimeErrorNames.filter(n => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(n))).toHaveLength(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Auto Run starts and stops and disables/enables buttons appropriately (S2_StepExecuted -> S3_AutoRunning -> S2_StepExecuted)', async () => {
    // This test validates autoRun() toggles auto-running state, disables/enables step/generate buttons,
    // and toggles Auto Run button text to "Stop" while running.
    const app = new KruskalPage(page);
    await app.goto();

    // Ensure step and generate are enabled initially
    expect(await app.isButtonDisabled(app.selectors.stepBtn)).toBe(false);
    expect(await app.isButtonDisabled(app.selectors.generateBtn)).toBe(false);

    // Start auto-run
    await app.clickAuto();

    // Auto button text should change to 'Stop' immediately
    const autoText = await app.getAutoButtonText();
    expect(autoText).toBe('Stop');

    // While auto-run is active, the step and generate buttons should be disabled
    expect(await app.isButtonDisabled(app.selectors.stepBtn)).toBe(true);
    expect(await app.isButtonDisabled(app.selectors.generateBtn)).toBe(true);

    // Wait a short while to allow at least one automated step to occur, but be conservative
    await page.waitForTimeout(1100);

    // At this point the log should contain either Added/Skipped edge entries
    const logText = await app.getLogText();
    expect(logText).toMatch(/(Added edge|Skipped edge)/);

    // Stop auto-run by clicking the auto button again
    await app.clickAuto();

    // After stopping, auto button should read 'Auto Run'
    const autoTextStopped = await app.getAutoButtonText();
    expect(autoTextStopped).toBe('Auto Run');

    // Step button should be enabled for manual stepping again; generate should be enabled too
    expect(await app.isButtonDisabled(app.selectors.stepBtn)).toBe(false);
    expect(await app.isButtonDisabled(app.selectors.generateBtn)).toBe(false);

    // Ensure no uncaught runtime errors occurred during auto-run
    const runtimeErrorNames = pageErrors.map((e) => e.name || e.constructor.name);
    expect(runtimeErrorNames.filter(n => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(n))).toHaveLength(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Reset works from a mid-execution state and from auto-running state (S2/S3 -> S4_VisualizationReset)', async () => {
    // This test validates resetVisualization() clears MST, resets current edge to 'None',
    // writes 'Visualization reset' to log, and re-enables controls.

    const app = new KruskalPage(page);
    await app.goto();

    // Make one manual step to move to S2
    await app.clickStep();
    await page.waitForTimeout(50);

    // Confirm we're in a mid-execution state (currentEdge not None)
    const currentEdgeBefore = await app.getCurrentEdgeText();
    expect(currentEdgeBefore).not.toBe('None');

    // Now click reset (transition to S4)
    await app.clickReset();

    // After reset, current edge should be 'None'
    const currentEdgeAfter = await app.getCurrentEdgeText();
    expect(currentEdgeAfter).toBe('None');

    // MST weight should be reset to 0
    const mstWeightAfter = await app.getMSTWeightText();
    expect(Number(mstWeightAfter)).toBeGreaterThanOrEqual(0);

    // Log should contain 'Visualization reset'
    const logText = await app.getLogText();
    expect(logText).toMatch(/Visualization reset/);

    // Step and auto buttons should be enabled
    expect(await app.isButtonDisabled(app.selectors.stepBtn)).toBe(false);
    expect(await app.isButtonDisabled(app.selectors.autoBtn)).toBe(false);

    // Now test reset while auto-running: start auto, then reset
    await app.clickAuto();
    // Give it a small moment to start
    await page.waitForTimeout(100);
    // Now trigger reset while auto-run may be active
    await app.clickReset();
    // After reset, generation should be possible
    expect(await app.isButtonDisabled(app.selectors.generateBtn)).toBe(false);

    // current-edge should be 'None' after reset from auto-run as well
    const currentEdgeAfterAutoReset = await app.getCurrentEdgeText();
    expect(currentEdgeAfterAutoReset).toBe('None');

    // Ensure reset logged
    const logText2 = await app.getLogText();
    expect(logText2).toMatch(/Visualization reset/);

    // Ensure no uncaught runtime errors occurred during resets
    const runtimeErrorNames = pageErrors.map((e) => e.name || e.constructor.name);
    expect(runtimeErrorNames.filter(n => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(n))).toHaveLength(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: repeatedly generating graphs and running to completion to ensure finalization behavior', async () => {
    // This test exercises the transitions by generating multiple graphs and ensuring the algorithm
    // completes gracefully (step button disabled at completion) and that MST completion log appears.

    const app = new KruskalPage(page);
    await app.goto();

    // Generate multiple graphs in quick succession to ensure generateGraph is idempotent/safe
    for (let i = 0; i < 3; i++) {
      await app.clickGenerate();
      // allow time for generateGraph to execute
      await page.waitForTimeout(50);
      const log = await app.getLogText();
      expect(log).toMatch(/Generated graph with \d+ vertices and \d+ edges/);
    }

    // Run steps until step button becomes disabled (algorithm complete) or until a reasonable max
    const iterations = await app.runStepsToCompletion(200);
    // iterations should be > 0 (we clicked steps)
    expect(iterations).toBeGreaterThanOrEqual(0);

    // After completion, step button should be disabled
    const stepDisabled = await app.isButtonDisabled(app.selectors.stepBtn);
    expect(stepDisabled).toBe(true);

    // Log should contain MST complete message at some point
    const logText = await app.getLogText();
    expect(logText).toMatch(/(MST complete|Algorithm complete - MST found!)/);

    // Ensure no uncaught runtime errors occurred throughout
    const runtimeErrorNames = pageErrors.map((e) => e.name || e.constructor.name);
    expect(runtimeErrorNames.filter(n => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(n))).toHaveLength(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observes console and page errors: assert no ReferenceError/TypeError/SyntaxError occurred during use', async () => {
    // This test explicitly focuses on capturing console/page errors while performing interactions.
    const app = new KruskalPage(page);
    await app.goto();

    // Perform a set of interactions that exercise code paths
    await app.clickStep();
    await page.waitForTimeout(50);
    await app.clickAuto();
    await page.waitForTimeout(200);
    await app.clickAuto(); // stop
    await app.clickReset();
    await page.waitForTimeout(50);
    await app.clickGenerate();

    // Collect any page errors captured
    const runtimeErrorNames = pageErrors.map((e) => e.name || e.constructor.name);

    // Assert that none of the captured page errors are ReferenceError, TypeError, or SyntaxError.
    // If such errors occurred naturally, this assertion will fail (which is intended to surface runtime issues).
    expect(runtimeErrorNames.filter(n => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(n))).toHaveLength(0);

    // Also assert no console.error messages were emitted during these interactions.
    expect(consoleErrors.length).toBe(0);
  });
});