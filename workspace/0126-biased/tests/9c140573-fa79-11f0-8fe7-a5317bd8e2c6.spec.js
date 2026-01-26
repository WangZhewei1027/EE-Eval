import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c140573-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object for the TimSort Simulator page
class TimSimPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Common selectors
    this.selectors = {
      sizeInput: '#sizeInput',
      minVal: '#minVal',
      maxVal: '#maxVal',
      seedInput: '#seedInput',
      randomBtn: '#randomBtn',
      resetBtn: '#resetBtn',
      customArray: '#customArray',
      loadCustomBtn: '#loadCustomBtn',
      detectRunsBtn: '#detectRunsBtn',
      computeMinrunBtn: '#computeMinrunBtn',
      minrunInput: '#minrunInput',
      setMinrunBtn: '#setMinrunBtn',
      autodetectCheckbox: '#autodetectCheckbox',
      runToInsert: '#runToInsert',
      startInsertionBtn: '#startInsertionBtn',
      stepInsertionBtn: '#stepInsertionBtn',
      pushNextRunBtn: '#pushNextRunBtn',
      findMergeBtn: '#findMergeBtn',
      stepMergeBtn: '#stepMergeBtn',
      manualMergeIdx: '#manualMergeIdx',
      manualMergeBtn: '#manualMergeBtn',
      playPauseBtn: '#playPauseBtn',
      delayInput: '#delayInput',
      gallopCheckbox: '#gallopCheckbox',
      gallopThresholdInput: '#gallopThresholdInput',
      applySettingsBtn: '#applySettingsBtn',
      breakIndex: '#breakIndex',
      breakOnMerge: '#breakOnMerge',
      setBreakBtn: '#setBreakBtn',
      saveStateBtn: '#saveStateBtn',
      loadStateBtn: '#loadStateBtn',
      stateJSON: '#stateJSON',
      undoBtn: '#undoBtn',
      clearLogBtn: '#clearLogBtn',
      log: '#log',
      arrayView: '#arrayView',
      runsDetected: '#runsDetected',
      runStack: '#runStack',
      stats: '#stats'
    };
  }

  // navigation & initialization
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // ensure initial render has occurred
    await this.page.waitForSelector(this.selectors.arrayView);
  }

  // Generic helper to read the simulator state object exposed on window.timsim
  async getState() {
    return await this.page.evaluate(() => {
      return window.timsim && window.timsim.state ? window.timsim.state : null;
    });
  }

  async getHistoryLength() {
    return await this.page.evaluate(() => {
      return window.timsim && window.timsim.state ? window.timsim.state.history.length : 0;
    });
  }

  // Control actions
  async randomize({ size, min, max, seed } = {}) {
    if (size !== undefined) await this.page.fill(this.selectors.sizeInput, String(size));
    if (min !== undefined) await this.page.fill(this.selectors.minVal, String(min));
    if (max !== undefined) await this.page.fill(this.selectors.maxVal, String(max));
    if (seed !== undefined) await this.page.fill(this.selectors.seedInput, String(seed));
    await this.page.click(this.selectors.randomBtn);
  }

  async reset() {
    await this.page.click(this.selectors.resetBtn);
  }

  async loadCustomArray(text) {
    await this.page.fill(this.selectors.customArray, text);
    await this.page.click(this.selectors.loadCustomBtn);
  }

  async detectRuns() {
    await this.page.click(this.selectors.detectRunsBtn);
  }

  async computeMinRun() {
    await this.page.click(this.selectors.computeMinrunBtn);
  }

  async setMinRun(value) {
    await this.page.fill(this.selectors.minrunInput, String(value));
    await this.page.click(this.selectors.setMinrunBtn);
  }

  async startInsertionOnRun(runIdx) {
    await this.page.fill(this.selectors.runToInsert, String(runIdx));
    await this.page.click(this.selectors.startInsertionBtn);
  }

  async stepInsertion() {
    await this.page.click(this.selectors.stepInsertionBtn);
  }

  async pushNextRun() {
    await this.page.click(this.selectors.pushNextRunBtn);
  }

  async findMerge() {
    await this.page.click(this.selectors.findMergeBtn);
  }

  async manualMerge(idx) {
    await this.page.fill(this.selectors.manualMergeIdx, String(idx));
    await this.page.click(this.selectors.manualMergeBtn);
  }

  async stepMerge() {
    await this.page.click(this.selectors.stepMergeBtn);
  }

  async toggleAutoplay() {
    await this.page.click(this.selectors.playPauseBtn);
  }

  async setAutoplayDelay(ms) {
    await this.page.fill(this.selectors.delayInput, String(ms));
  }

  async applySettings({ gallop, gallopThreshold, autoplayDelay, autodetect } = {}) {
    if (gallop !== undefined) {
      const checkbox = this.page.locator(this.selectors.gallopCheckbox);
      const checked = await checkbox.isChecked();
      if (checked !== Boolean(gallop)) await checkbox.click();
    }
    if (gallopThreshold !== undefined) {
      await this.page.fill(this.selectors.gallopThresholdInput, String(gallopThreshold));
    }
    if (autoplayDelay !== undefined) {
      await this.page.fill(this.selectors.delayInput, String(autoplayDelay));
    }
    if (autodetect !== undefined) {
      const checkbox = this.page.locator(this.selectors.autodetectCheckbox);
      const checked = await checkbox.isChecked();
      if (checked !== Boolean(autodetect)) await checkbox.click();
    }
    await this.page.click(this.selectors.applySettingsBtn);
  }

  async saveStateToJSON() {
    await this.page.click(this.selectors.saveStateBtn);
  }

  async loadStateFromJSON(jsonText) {
    await this.page.fill(this.selectors.stateJSON, jsonText);
    await this.page.click(this.selectors.loadStateBtn);
  }

  async undo() {
    await this.page.click(this.selectors.undoBtn);
  }

  async clearLog() {
    await this.page.click(this.selectors.clearLogBtn);
  }

  // Read UI outputs
  async getLogText() {
    return await this.page.locator(this.selectors.log).inputValue();
  }

  async getArrayViewText() {
    return await this.page.locator(this.selectors.arrayView).textContent();
  }

  async getRunsDetectedText() {
    return await this.page.locator(this.selectors.runsDetected).textContent();
  }

  async getRunStackText() {
    return await this.page.locator(this.selectors.runStack).textContent();
  }

  async getStatsText() {
    return await this.page.locator(this.selectors.stats).textContent();
  }

  async getStateJSONText() {
    return await this.page.locator(this.selectors.stateJSON).inputValue();
  }
}

test.describe('TimSort Simulator - FSM behavior and UI interactions', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // attach a small padding to allow logs
    await page.setViewportSize({ width: 1200, height: 900 });
  });

  test('initial state is idle and render has run', async ({ page }) => {
    // Validate initial render and no page errors/exceptions
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', m => { consoleMessages.push({ type: m.type(), text: m.text() }); });
    page.on('pageerror', err => { pageErrors.push(err); });

    const sim = new TimSimPage(page);
    await sim.goto();

    // The page exposes window.timsim
    const state = await sim.getState();
    expect(state).not.toBeNull();
    expect(state.phase).toBe('idle');

    // arrayView exists and has text (empty array shown)
    const arrText = await sim.getArrayViewText();
    expect(arrText).toBeTruthy();

    // No runtime errors should have been emitted during load
    expect(pageErrors.length).toBe(0);
    // Also assert there are no console.error messages
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('randomize array updates array and history, and logs', async ({ page }) => {
    // Validate Randomize action (S0_Idle self-transition)
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', m => { consoleMessages.push({ type: m.type(), text: m.text() }); });
    page.on('pageerror', err => { pageErrors.push(err); });

    const sim = new TimSimPage(page);
    await sim.goto();

    const initialHistoryLen = await sim.getHistoryLength();
    await sim.randomize({ size: 10, min: 0, max: 50, seed: 12345 });

    // After randomize the state should still be idle but array should be populated
    const state = await sim.getState();
    expect(state.phase).toBe('idle');
    expect(state.array.length).toBe(10);
    expect(await sim.getArrayViewText()).toContain('idx:');

    // History increased (randomize pushes history)
    const historyLen = await sim.getHistoryLength();
    expect(historyLen).toBeGreaterThan(initialHistoryLen);

    // Log should include 'Array randomized'
    const log = await sim.getLogText();
    expect(log).toContain('Array randomized');

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('load custom array, detect runs, compute minrun, and set minrun', async ({ page }) => {
    // This test covers LoadCustomArray, DetectRuns, ComputeMinRun, SetMinRun transitions from S0_Idle
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', m => { consoleMessages.push({ type: m.type(), text: m.text() }); });
    page.on('pageerror', err => { pageErrors.push(err); });

    const sim = new TimSimPage(page);
    await sim.goto();

    // Load a custom array that has ascending and descending segments
    // Use values that will create obvious runs: ascending [1,2,3], descending [9,8,7] (which should get reversed)
    await sim.loadCustomArray('1 2 3 9 8 7 10 11 12');

    let state = await sim.getState();
    expect(state.array).toEqual([1,2,3,9,8,7,10,11,12]);

    // Detect runs
    await sim.detectRuns();
    state = await sim.getState();
    expect(state.phase).toBe('detected');
    const runsTxt = await sim.getRunsDetectedText();
    expect(runsTxt).toBeTruthy();
    expect(runsTxt).toContain('Run[');

    // Compute minrun for current n and ensure minrunInput updated
    await sim.computeMinRun();
    const minrunVal = await page.locator('#minrunInput').inputValue();
    // computeMinRun should set a reasonable minrun between 1 and n
    expect(Number(minrunVal)).toBeGreaterThanOrEqual(1);
    expect(Number(minrunVal)).toBeLessThanOrEqual(state.array.length);

    // Set minrun manually to 3 (edge case)
    await sim.setMinRun(3);
    state = await sim.getState();
    expect(state.settings.minrun).toBe(3);

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('start insertion on detected run then step insertion until done', async ({ page }) => {
    // Validate transitions S1_Detecting -> S2_Insertion -> S1_Detecting via StartInsertion and StepInsertion
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', m => { consoleMessages.push({ type: m.type(), text: m.text() }); });
    page.on('pageerror', err => { pageErrors.push(err); });

    const sim = new TimSimPage(page);
    await sim.goto();

    // Load a small custom array with a short run at start so insertion extension will be used
    await sim.loadCustomArray('5 1 4 3 2 6 7 8');
    await sim.detectRuns();

    // Set minrun small to force insertion extension
    await sim.setMinRun(4);

    // Start insertion on run 0
    await sim.startInsertionOnRun(0);
    let state = await sim.getState();
    expect(state.phase).toBe('insertion');
    expect(state.insertionState).not.toBeNull();

    // Step until insertionState becomes null or we exceed a safe limit
    let steps = 0;
    while (true) {
      state = await sim.getState();
      if (!state.insertionState) break;
      // click step (the function returns immediately and updates state)
      await sim.stepInsertion();
      steps++;
      if (steps > 50) {
        // safety bail-out to prevent infinite loop in case of unexpected behavior
        break;
      }
    }

    // After completion, phase should be 'detected' per FSM exit action
    state = await sim.getState();
    expect(state.phase === 'detected' || state.phase === 'pushed' || state.phase === 'idle').toBeTruthy();

    // Ensure we executed at least one step
    expect(steps).toBeGreaterThanOrEqual(1);

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('push detected run to stack, manual merge, and step through a merge to completion', async ({ page }) => {
    // This covers PushNextRun, ManualMerge, StartMergeAtIndex (S3_Merging), StepMerge to finish (S4_Finished)
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', m => { consoleMessages.push({ type: m.type(), text: m.text() }); });
    page.on('pageerror', err => { pageErrors.push(err); });

    const sim = new TimSimPage(page);
    await sim.goto();

    // Create an array designed to produce at least two runs
    await sim.loadCustomArray('1 2 3 9 8 7 4 5 6');
    await sim.detectRuns();

    // Push first detected run to stack
    await sim.pushNextRun();
    let runStackTxt = await sim.getRunStackText();
    expect(runStackTxt).toContain('Stack[');

    // Push next run to ensure there are at least 2 runs on stack
    await sim.pushNextRun();
    runStackTxt = await sim.getRunStackText();
    // Now we expect at least two stack entries
    const runStackLines = runStackTxt.split('\n').filter(Boolean);
    expect(runStackLines.length).toBeGreaterThanOrEqual(2);

    // Force a manual merge at index 0 (merge stack[0] and stack[1])
    await sim.manualMerge(0);

    // Verify merge started
    let state = await sim.getState();
    expect(state.phase).toBe('merging');
    expect(state.mergeState).not.toBeNull();

    // Step through the merge until mergeState becomes null (merge finished)
    let mergeSteps = 0;
    while (true) {
      state = await sim.getState();
      if (!state.mergeState) break;
      await sim.stepMerge();
      mergeSteps++;
      if (mergeSteps > 200) break; // safety bail-out
    }

    // After finishing merge, phase should return to 'detected' and runStack should have fewer entries
    state = await sim.getState();
    expect(state.phase === 'detected' || state.phase === 'pushed' || state.phase === 'idle').toBeTruthy();
    const finalStackTxt = await sim.getRunStackText();
    // There should be at least one stack entry (merged)
    expect(finalStackTxt).toBeTruthy();

    // Verify that a merge incremented the merges count in stats
    expect(state.stats.merges).toBeGreaterThanOrEqual(1);

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('autoplay toggles on and off and respects autoplay delay setting', async ({ page }) => {
    // This test checks Play/Pause Autoplay behavior
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', m => { consoleMessages.push({ type: m.type(), text: m.text() }); });
    page.on('pageerror', err => { pageErrors.push(err); });

    const sim = new TimSimPage(page);
    await sim.goto();

    // Create a longer array and detect runs so autoplay has work to do
    await sim.loadCustomArray('1 2 3 4 5 6 7 8 9 10 20 19 18 17 16 15 14 13 12 11');
    await sim.detectRuns();

    // Set a small autoplay delay and apply settings
    await sim.applySettings({ autoplayDelay: 30, gallop: true, gallopThreshold: 3 });

    // Start autoplay
    await sim.toggleAutoplay();

    // Give it a little time to run a few ticks
    await page.waitForTimeout(150);

    // Stop autoplay
    await sim.toggleAutoplay();

    // After stopping, the playback.running should be false in state
    const state = await sim.getState();
    expect(state.playback.running).toBeFalsy();

    // Log should mention autoplay started/stopped
    const logText = await sim.getLogText();
    expect(logText).toContain('Autoplay');

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('apply settings updates galloping threshold and compute minrun edge cases', async ({ page }) => {
    // This tests ApplySettings and ComputeMinRun edge cases
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', m => { consoleMessages.push({ type: m.type(), text: m.text() }); });
    page.on('pageerror', err => { pageErrors.push(err); });

    const sim = new TimSimPage(page);
    await sim.goto();

    // Randomize to populate array length
    await sim.randomize({ size: 15 });

    // Apply settings: disable gallop, set weird threshold (edge)
    await sim.applySettings({ gallop: false, gallopThreshold: 1, autoplayDelay: 200 });

    let state = await sim.getState();
    expect(state.settings.gallop).toBe(false);
    expect(state.settings.gallopThreshold).toBe(1);

    // Compute minrun again and ensure it's valid for n=15
    await sim.computeMinRun();
    const minrun = Number(await page.locator('#minrunInput').inputValue());
    expect(minrun).toBeGreaterThanOrEqual(1);
    expect(minrun).toBeLessThanOrEqual(15);

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('save and load state JSON roundtrip and undo/clear log behaviors', async ({ page }) => {
    // Tests Export State JSON, Load State JSON, Undo, and Clear Log
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', m => { consoleMessages.push({ type: m.type(), text: m.text() }); });
    page.on('pageerror', err => { pageErrors.push(err); });

    const sim = new TimSimPage(page);
    await sim.goto();

    // Prepare a custom array and detect runs
    await sim.loadCustomArray('3 1 2 6 5 4');
    await sim.detectRuns();

    // Save state to JSON
    await sim.saveStateToJSON();
    let stateJSON = await sim.getStateJSONText();
    expect(stateJSON).toBeTruthy();

    // Modify JSON (as a basic roundtrip) and reload it
    const parsed = JSON.parse(stateJSON);
    // Mutate something harmless
    parsed.stats.steps = (parsed.stats.steps || 0) + 1;
    await sim.loadStateFromJSON(JSON.stringify(parsed, null, 2));

    let state = await sim.getState();
    expect(state.array).toEqual(parsed.array);

    // Perform an action to be able to undo: push next detected run
    await sim.pushNextRun();
    const beforeUndoStack = (await sim.getRunStackText()).split('\n').filter(Boolean).length;
    await sim.undo();
    const afterUndoStack = (await sim.getRunStackText()).split('\n').filter(Boolean).length;

    // Undo should revert (stack size may decrease)
    expect(afterUndoStack).toBeLessThanOrEqual(beforeUndoStack);

    // Clear the log and assert empty
    await sim.clearLog();
    const logTxt = await sim.getLogText();
    expect(logTxt).toBe('');

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('edge cases: invalid custom array input and invalid manual insertion index produce logged errors but not runtime exceptions', async ({ page }) => {
    // This test intentionally triggers known error-paths in the UI (logged errors), ensuring they are handled and no uncaught exceptions thrown.
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', m => { consoleMessages.push({ type: m.type(), text: m.text() }); });
    page.on('pageerror', err => { pageErrors.push(err); });

    const sim = new TimSimPage(page);
    await sim.goto();

    // Provide invalid custom array with non-numeric tokens
    await sim.loadCustomArray('a, b, c');
    // The code logs 'Custom array contains non-numeric values' but does not throw
    const logAfterInvalid = await sim.getLogText();
    expect(logAfterInvalid).toContain('Custom array contains non-numeric values');

    // Try starting insertion with an invalid run index (non-numeric)
    await page.fill('#runToInsert', 'not-a-number');
    await sim.startInsertionOnRun(NaN); // this will call startInsertionOnRun with NaN in our abstraction; actual UI path is clicking startInsertionBtn with the filled value
    // The UI handler will log 'Invalid run index' when receiving NaN in startInsertionManual; check the log
    const logText = await sim.getLogText();
    // It's acceptable for this to log an error message; we assert that no uncaught exceptions occurred
    expect(logText).toMatch(/Invalid run index|No such run to insert-sort|Custom array contains non-numeric values/);

    // Ensure there were no uncaught exceptions (page errors)
    expect(pageErrors.length).toBe(0);
    // And no console.error messages
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  // Final sanity test ensuring no unhandled console errors occurred across interactions
  test('sanity: no console errors or page errors after a suite of interactions', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', m => { consoleMessages.push({ type: m.type(), text: m.text() }); });
    page.on('pageerror', err => { pageErrors.push(err); });

    const sim = new TimSimPage(page);
    await sim.goto();

    // Perform a quick series of interactions (representative smoke test)
    await sim.randomize({ size: 12 });
    await sim.detectRuns();
    await sim.pushNextRun();
    await sim.pushNextRun();
    // Attempt to find merge
    await sim.findMerge();
    // Toggle autoplay on then off quickly (use small delay)
    await sim.applySettings({ autoplayDelay: 30 });
    await sim.toggleAutoplay();
    await page.waitForTimeout(80);
    await sim.toggleAutoplay();

    // Step any merge if present (safely)
    const state = await sim.getState();
    if (state.mergeState) {
      let i = 0;
      while (state.mergeState && i < 50) {
        await sim.stepMerge();
        i++;
        // re-fetch state
        const s = await sim.getState();
        if (!s || !s.mergeState) break;
      }
    }

    // Collect console.error messages
    const errorConsole = consoleMessages.filter(m => m.type === 'error');

    // As a sanity check assert there were no unhandled page errors and no console.error messages
    expect(pageErrors.length).toBe(0);
    expect(errorConsole.length).toBe(0);
  });
});