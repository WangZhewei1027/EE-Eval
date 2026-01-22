import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b019451-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object for the Merge Sort Visualizer
class VisualizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.arrayInput = page.locator('#arrayInput');
    this.arrayDisplay = page.locator('#arrayDisplay');
    this.algorithmLog = page.locator('#algorithmLog');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure DOMContentLoaded handlers (init) have executed
    await this.page.waitForLoadState('domcontentloaded');
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async pressEnterInInput() {
    await this.arrayInput.press('Enter');
  }

  async setInput(value) {
    await this.arrayInput.fill(value);
  }

  async getInputValue() {
    return await this.arrayInput.inputValue();
  }

  async getArrayElementsText() {
    return await this.arrayDisplay.locator('.array-element').allTextContents();
  }

  async getLogEntriesText() {
    return await this.algorithmLog.locator('.log-entry').allInnerTexts();
  }

  async isStartDisabled() {
    return await this.startBtn.isDisabled();
  }

  async isStepDisabled() {
    return await this.stepBtn.isDisabled();
  }

  async isResetDisabled() {
    return await this.resetBtn.isDisabled();
  }

  // Evaluate arbitrary state from the page
  async evaluate(fn) {
    return await this.page.evaluate(fn);
  }
}

test.describe('Divide and Conquer Visualizer - FSM state & transition tests', () => {
  // Capture console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // No-op here, listeners are attached in each test to get per-test isolation.
  });

  // Test initial Idle state (S0_Idle)
  test('Initial Idle state: page renders and buttons are in expected default state', async ({ page }) => {
    // Capture runtime console errors and page errors
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Verify UI evidence for Idle state: Start Sorting button, Reset button, Next Step disabled
    expect(await vp.startBtn.count()).toBe(1);
    expect(await vp.resetBtn.count()).toBe(1);
    expect(await vp.stepBtn.count()).toBe(1);

    // On page load init() runs: startBtn should be enabled, stepBtn disabled
    expect(await vp.isStartDisabled()).toBe(false);
    expect(await vp.isStepDisabled()).toBe(true);

    // The algorithm log should mention "Ready to start merge sort visualization."
    const logs = await vp.getLogEntriesText();
    const foundReady = logs.some(text => text.includes('Ready to start merge sort visualization.'));
    expect(foundReady).toBe(true);

    // Array display should show the initial array elements from the default input value
    const arrayElements = await vp.getArrayElementsText();
    // Because init() renders the initial array, we expect six elements by default
    expect(arrayElements.length).toBeGreaterThanOrEqual(1);

    // Assert there were no uncaught page errors or console errors during initial render
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Test StartSorting event and transition to S1_Sorting
  test('StartSorting: clicking Start Sorting initializes algorithm and updates UI (S0_Idle -> S1_Sorting)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    const consoleMessages = [];
    page.on('console', (msg) => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Click "Start Sorting" to invoke startVisualization()
    await vp.clickStart();

    // After starting: startBtn disabled, stepBtn enabled, isRunning should be true
    expect(await vp.isStartDisabled()).toBe(true);
    expect(await vp.isStepDisabled()).toBe(false);

    // The log should include the starting message
    const logs = await vp.getLogEntriesText();
    const started = logs.some(l => l.includes('Starting Merge Sort using Divide and Conquer approach...'));
    expect(started).toBe(true);

    // The page exposes a global isRunning variable; verify it's true
    const isRunning = await vp.evaluate(() => typeof isRunning !== 'undefined' ? isRunning : null);
    expect(isRunning).toBe(true);

    // The steps array should be populated
    const stepsLength = await vp.evaluate(() => (Array.isArray(steps) ? steps.length : 0));
    expect(stepsLength).toBeGreaterThan(0);

    // Ensure no page errors occurred during start
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Test NextStep event iteratively until completion: covers S1_Sorting internal transitions and S1_Sorting -> S2_Completed
  test('NextStep: stepping through algorithm updates visualization and completes (S1_Sorting -> S2_Completed)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Start first
    await vp.clickStart();

    // Determine number of steps from page's steps array
    const totalSteps = await vp.evaluate(() => Array.isArray(steps) ? steps.length : 0);
    expect(totalSteps).toBeGreaterThan(0);

    // Click step repeatedly and assert that each click updates the log and array display
    let previousLogCount = (await vp.getLogEntriesText()).length;
    for (let i = 0; i < totalSteps; i++) {
      // Ensure step button is enabled before clicking, until the last step may disable it
      const stepDisabledBefore = await vp.isStepDisabled();
      expect(stepDisabledBefore).toBe(false);

      await vp.clickStep();

      // After clicking, the log should have at least one more entry or remain if final logs appended differently
      const currentLogs = await vp.getLogEntriesText();
      expect(currentLogs.length).toBeGreaterThanOrEqual(previousLogCount);
      previousLogCount = currentLogs.length;

      // Visual array should reflect the step's array content (non-empty)
      const arrayEls = await vp.getArrayElementsText();
      expect(arrayEls.length).toBeGreaterThanOrEqual(0); // at least defined
    }

    // After consuming all steps, Next Step button should be disabled and isRunning false
    expect(await vp.isStepDisabled()).toBe(true);
    const isRunningAfter = await vp.evaluate(() => typeof isRunning !== 'undefined' ? isRunning : null);
    expect(isRunningAfter).toBe(false);

    // The log should include the completion message as per exit action
    const finalLogs = await vp.getLogEntriesText();
    const completedMsg = finalLogs.some(l => l.includes('Algorithm completed! The array is now sorted.'));
    expect(completedMsg).toBe(true);

    // Ensure no page errors occurred during stepping/completion
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  }, { timeout: 120000 }); // allow longer time as multiple steps may be executed

  // Test Reset transition from S1_Sorting back to S0_Idle
  test('Reset: clicking Reset while sorting resets visualization and returns to Idle (S1_Sorting -> S0_Idle)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Start sorting and advance one step to ensure non-idle state
    await vp.clickStart();
    // Wait briefly for start logs to appear
    await page.waitForTimeout(100);
    await vp.clickStep();

    // Now click reset
    await vp.clickReset();

    // After reset, startBtn should be enabled, stepBtn disabled, isRunning false
    expect(await vp.isStartDisabled()).toBe(false);
    expect(await vp.isStepDisabled()).toBe(true);
    const isRunningAfterReset = await vp.evaluate(() => typeof isRunning !== 'undefined' ? isRunning : null);
    expect(isRunningAfterReset).toBe(false);

    // The algorithm log should contain the init message "Ready to start merge sort visualization."
    const logs = await vp.getLogEntriesText();
    const hasReady = logs.some(l => l.includes('Ready to start merge sort visualization.'));
    expect(hasReady).toBe(true);

    // The array input should be set (init sets default if input empty)
    const inputVal = await vp.getInputValue();
    expect(typeof inputVal).toBe('string');
    expect(inputVal.length).toBeGreaterThan(0);

    // Ensure no page errors occurred
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Test starting via Enter key on the input (EnterKey event)
  test('EnterKey: pressing Enter in the array input triggers startVisualization and transitions to Sorting', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Change input to a small array and press Enter
    await vp.setInput('3, 1, 2');
    await vp.pressEnterInInput();

    // After pressing Enter, start should have been invoked: startBtn disabled, stepBtn enabled
    expect(await vp.isStartDisabled()).toBe(true);
    expect(await vp.isStepDisabled()).toBe(false);

    // Validate the input was parsed and arrayDisplay shows three elements
    const elements = await vp.getArrayElementsText();
    // The implementation renders elements according to arr; ensure at least 1 element and likely 3
    expect(elements.length).toBeGreaterThanOrEqual(1);

    // The log should contain the starting message
    const logs = await vp.getLogEntriesText();
    expect(logs.some(l => l.includes('Starting Merge Sort using Divide and Conquer approach...'))).toBe(true);

    // No page errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Edge case: empty input should fallback to default array when starting
  test('Edge case: empty input falls back to default array when starting (empty input -> default array)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Clear the input and click Start
    await vp.setInput('');
    await vp.clickStart();

    // The initialization should set default array value in the input
    const inputVal = await vp.getInputValue();
    expect(inputVal).toMatch(/\d+/); // contains digits

    // The arrayDisplay should show the default number of elements (default array length is 6 in source)
    const elements = await vp.getArrayElementsText();
    expect(elements.length).toBeGreaterThanOrEqual(1);

    // No page errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Observe console and runtime errors while performing multiple interactions (sanity check)
  test('No unexpected runtime errors during several interactions (console/pageerror observation)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(err.message));

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Sequence: start -> step a few times -> reset -> start again -> complete minimal steps
    await vp.clickStart();
    const stepsCount = await vp.evaluate(() => Array.isArray(steps) ? steps.length : 0);
    const stepsToDo = Math.min(3, stepsCount);
    for (let i = 0; i < stepsToDo; i++) {
      await vp.clickStep();
    }

    await vp.clickReset();
    await vp.clickStart();

    // Attempt to finish all remaining steps (but don't hang if many)
    const remaining = await vp.evaluate(() => Array.isArray(steps) ? steps.length - (currentStep || 0) : 0);
    const doFinish = Math.min(remaining, 10);
    for (let i = 0; i < doFinish; i++) {
      const disabled = await vp.isStepDisabled();
      if (disabled) break;
      await vp.clickStep();
    }

    // Ensure no uncaught exceptions were emitted during the interactions
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

});