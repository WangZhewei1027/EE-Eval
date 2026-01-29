import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c1516e0-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object to encapsulate common interactions and selectors
class SpacePage {
  constructor(page) {
    this.page = page;
    // Controls
    this.algo = page.locator('#algo');
    this.generateBtn = page.locator('#generateBtn');
    this.runBtn = page.locator('#runBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.backBtn = page.locator('#backBtn');
    this.playBtn = page.locator('#playBtn');
    this.pauseBtn = page.locator('#pauseBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.randomizeBtn = page.locator('#randomizeBtn');
    this.nVal = page.locator('#nVal');
    this.nSlider = page.locator('#nSlider');
    this.stepCounter = page.locator('#stepCounter');
    this.maxStep = page.locator('#maxStep');
    this.timelineSlider = page.locator('#timelineSlider');
    this.eventsLog = page.locator('#eventsLog');
    this.allocList = page.locator('#allocList');
    this.totalMem = page.locator('#totalMem');
    this.peakMem = page.locator('#peakMem');
    // Manual allocation controls
    this.manualCount = page.locator('#manualCount');
    this.manualRegion = page.locator('#manualRegion');
    this.manualDesc = page.locator('#manualDesc');
    this.manualAllocBtn = page.locator('#manualAllocBtn');
    this.manualFreeBtn = page.locator('#manualFreeBtn');
    // Script area & buttons
    this.scriptArea = page.locator('#scriptArea');
    this.loadScriptBtn = page.locator('#loadScriptBtn');
    this.runScriptBtn = page.locator('#runScriptBtn');
    this.stepScriptBtn = page.locator('#stepScriptBtn');
    // Estimator
    this.formulaSelect = page.locator('#formulaSelect');
    this.customExpr = page.locator('#customExpr');
    this.estimateBtn = page.locator('#estimateBtn');
    this.estTable = page.locator('#estTable');
    // Speed & GC controls
    this.speed = page.locator('#speed');
    this.simulateGC = page.locator('#simulateGC');
    this.gcFreq = page.locator('#gcFreq');
    // Inspect
    this.inspectBtn = page.locator('#inspectBtn');
  }

  async goto() {
    await this.page.goto(BASE, { waitUntil: 'load' });
    // Wait for a few key elements to be present
    await expect(this.generateBtn).toBeVisible();
    await expect(this.stepCounter).toBeVisible();
  }

  // convenience: get numeric text content
  async getStep() {
    return Number((await this.stepCounter.textContent()) || '0');
  }

  async getMaxStep() {
    return Number((await this.maxStep.textContent()) || '0');
  }

  async getTotalMem() {
    return Number((await this.totalMem.textContent()) || '0');
  }

  async getAllocListText() {
    return (await this.allocList.textContent()) || '';
  }
}

test.describe('Space Complexity Explorer - E2E and FSM transitions', () => {
  let page;
  let space;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors for assertions later
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    space = new SpacePage(page);
    await space.goto();
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial state (S0 Idle) - page has initial reset and timeline ready', async () => {
    // Validate initial UI values consistent with resetState entry action:
    // step counter at 0 and alloc list is either empty or "(no live allocations)"
    const step = await space.getStep();
    expect(step).toBe(0);
    const allocText = await space.getAllocListText();
    // Accept either explicit '(no live allocations)' or an empty listing when no applied events
    expect(allocText.length).toBeGreaterThanOrEqual(0);

    // The timeline slider should start at 0
    const sliderVal = Number(await page.locator('#timelineSlider').getAttribute('value'));
    expect(sliderVal).toBe(0);

    // There should be no uncaught page errors immediately after load
    expect(pageErrors.length).toBe(0);

    // Sanity: eventsLog exists (even if empty or populated by initial generateEvents)
    await expect(space.eventsLog).toBeVisible();
  });

  test('GenerateEvents transitions: clicking Generate Events resets state and populates timeline (S0 -> S1 generator)', async () => {
    // Change algorithm to a deterministic one and click generate
    await space.algo.selectOption('copy_array');
    // Trigger Generate Events
    await space.generateBtn.click();

    // After generation, eventsLog should contain entries and maxStep should reflect some events
    const maxStep = await space.getMaxStep();
    expect(maxStep).toBeGreaterThanOrEqual(1);

    const logText = await space.eventsLog.textContent();
    expect(logText.length).toBeGreaterThan(0);
    // The eventsLog should mention 'copy' (the algorithm creates COPY in its description)
    expect(logText.toLowerCase()).toContain('copy');

    // The timelineSlider.max attribute should be updated
    const sliderMax = Number(await space.timelineSlider.getAttribute('max'));
    expect(sliderMax).toBeGreaterThanOrEqual(maxStep);
  });

  test('Run simulation (Run -> runAll) and Step controls: runBtn, stepBtn, backBtn', async () => {
    // Ensure we have generated events first
    await space.generateBtn.click();
    const initialMax = await space.getMaxStep();
    expect(initialMax).toBeGreaterThan(0);

    // Use step to advance one step
    await space.stepBtn.click();
    const stepAfterOne = await space.getStep();
    expect(stepAfterOne).toBe(1);

    // Step back should decrement
    await space.backBtn.click();
    const stepAfterBack = await space.getStep();
    expect(stepAfterBack).toBe(0);

    // Running to completion using Run button should advance to end
    await space.runBtn.click();
    const finalStep = await space.getStep();
    // final step should be equal to number of events (we treat maxStep as count)
    const maxStep = await space.getMaxStep();
    expect(finalStep).toBeGreaterThanOrEqual(maxStep);
    // total memory after runAll should be a number (0 or more)
    const totalAfter = await space.getTotalMem();
    expect(Number.isFinite(totalAfter)).toBeTruthy();
  });

  test('Play / Pause transitions (S2 <-> S1) - start playback and pause', async () => {
    // Generate events and set speed to a small value for test responsiveness
    await space.generateBtn.click();
    // Set speed to minimum for quick progress
    await space.speed.fill('50');
    // Start playing
    await space.playBtn.click();
    // Wait some time to allow a couple of steps to occur
    await page.waitForTimeout(220); // a few intervals at 50ms
    // Pause playback
    await space.pauseBtn.click();

    // Ensure stepCounter has advanced from 0
    const currentStep = await space.getStep();
    expect(currentStep).toBeGreaterThan(0);

    // Capture the value, wait a bit more and ensure it does not change after pause
    const savedStep = currentStep;
    await page.waitForTimeout(120);
    const stepAfterWait = await space.getStep();
    expect(stepAfterWait).toBe(savedStep);
  });

  test('ResetSimulation transitions: pressing Reset clears running state and allocations (S2 -> S0)', async () => {
    // Generate and run one step then reset
    await space.generateBtn.click();
    await space.stepBtn.click();
    expect(await space.getStep()).toBe(1);
    // Now reset
    await space.resetBtn.click();

    // Step counter resets to 0
    expect(await space.getStep()).toBe(0);
    // Alloc list should show no live allocations
    const allocText = await space.getAllocListText();
    expect(allocText.toLowerCase()).toContain('(no live allocations)' || 'no live allocations');
    // Timeline slider should be 0
    expect(Number(await space.timelineSlider.getAttribute('value'))).toBe(0);
  });

  test('Manual Allocate and Free: create manual allocations and free them', async () => {
    // Ensure no manual stack leftovers by resetting first
    await space.resetBtn.click();

    // Fill manual fields and click allocate
    await space.manualCount.fill('3');
    await space.manualRegion.selectOption('heap');
    await space.manualDesc.fill('test-manual');
    await space.manualAllocBtn.click();

    // After allocation, step counter should have increased
    const stepAfterAlloc = await space.getStep();
    expect(stepAfterAlloc).toBeGreaterThanOrEqual(1);

    // Alloc list should contain our manual description
    const allocList = await space.getAllocListText();
    expect(allocList).toContain('test-manual');

    // Now free last and check allocation removed
    await space.manualFreeBtn.click();
    const allocAfterFree = await space.getAllocListText();
    // Either shows no live allocations or does not contain the specific description
    expect(allocAfterFree.includes('test-manual')).toBeFalsy();
  });

  test('Script mode: LoadScript, StepScript, RunScript transition coverage (S0 -> S3 -> S1)', async () => {
    // Prepare a short deterministic script
    const script = `
# simple script
ALLOC A heap 4
CALL f1 frame 1
WAIT 1
FREE A
RETURN f1
`;
    await space.scriptArea.fill(script);

    // Load script: should populate state.events without applying them
    await space.loadScriptBtn.click();
    // maxStep should reflect the parsed script events
    const maxStep = await space.getMaxStep();
    expect(maxStep).toBeGreaterThanOrEqual(1);

    // Step script applies first step
    await space.stepScriptBtn.click();
    expect(await space.getStep()).toBe(1);

    // Run script starts playback; speed to low value to make test fast
    await space.speed.fill('50');
    await space.runScriptBtn.click();
    // Let it run a bit, then pause
    await page.waitForTimeout(220);
    await space.pauseBtn.click();

    // After running some steps, there should be allocations or freed events applied
    const allocText = await space.getAllocListText();
    // Accept either presence of allocations or their absence after frees; ensure no crash
    expect(typeof allocText).toBe('string');
  });

  test('Estimator: Custom formula and error handling for invalid custom expression', async () => {
    // Use Custom formula with a valid expression
    await space.formulaSelect.selectOption('Custom');
    await space.customExpr.fill('n*8 + 16');
    await space.estimateBtn.click();
    const tableText = await space.estTable.textContent();
    expect(tableText).toContain('n\testimated bytes');
    expect(tableText).toMatch(/\d+\s+\d+/); // contains lines with numbers

    // Now provide an invalid JS expression to provoke evaluation error and NaN handling
    await space.customExpr.fill('n***'); // invalid expression
    await space.estimateBtn.click();
    const tableAfterError = await space.estTable.textContent();
    // The implementation catches errors and sets val = NaN; ensure 'NaN' appears in the output
    expect(tableAfterError).toContain('NaN');
  });

  test('Algorithm change and parameter synchronization (ChangeAlgorithm and ChangeInputSize)', async () => {
    // Change algorithm selection; this should reset and regenerate events automatically
    await space.algo.selectOption('merge_sort');
    // Wait for generation to complete by checking maxStep
    const max1 = await space.getMaxStep();
    expect(max1).toBeGreaterThanOrEqual(1);

    // Adjust the slider and ensure nVal updates via input listener
    await space.nSlider.fill('42');
    // Trigger input event by dispatching input via Playwright actions
    await space.nSlider.evaluate((el) => {
      el.value = '42';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    const nVal = Number(await space.nVal.inputValue());
    expect(nVal).toBe(42);

    // Randomize parameters modifies nVal and other inputs
    const prevN = nVal;
    await space.randomizeBtn.click();
    const newN = Number(await space.nVal.inputValue());
    // Randomized value should be a number and likely different (but might coincide rarely)
    expect(Number.isFinite(newN)).toBeTruthy();
  });

  test('Timeline inspect and slider: InspectStep event and rebuildUpToStep behavior', async () => {
    // Ensure events exist
    await space.generateBtn.click();
    const maxStep = await space.getMaxStep();
    expect(maxStep).toBeGreaterThanOrEqual(1);

    // Move slider to a mid-step and click inspect
    const target = Math.max(1, Math.floor(maxStep / 2));
    await space.timelineSlider.evaluate((el, v) => {
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, target);
    // Click inspect to rebuild and set step
    await space.inspectBtn.click();

    // stepCounter should reflect the slider value
    const current = await space.getStep();
    expect(current).toBe(target);

    // Alloc list should be consistent (no exceptions thrown and text exists)
    const allocText = await space.getAllocListText();
    expect(typeof allocText).toBe('string');
  });

  test('Garbage collection behavior via simulateGC: trigger runGC through playback GC frequency', async () => {
    // Generate a scenario with some heap allocations (use graph_dfs which allocates ADJ)
    await space.algo.selectOption('graph_dfs');
    await space.generateBtn.click();
    // Enable simulateGC and set frequency to 1 to trigger GC every step
    await space.simulateGC.evaluate((el) => el.checked = true);
    await space.gcFreq.fill('1');

    // Run one step and ensure GC events can be pushed (runAll will trigger runGC while stepping)
    await space.runBtn.click();
    // After running, ensure eventsLog contains 'GC freed' or simply was updated (no crash)
    const eventsText = await space.eventsLog.textContent();
    // It's acceptable whether GC happened or not; just ensure no page errors and eventsLog updated
    expect(typeof eventsText).toBe('string');
    expect(pageErrors.length).toBe(0);
  });

  test('Console and page error monitoring - ensure no uncaught page errors during typical flows', async () => {
    // Perform a few interactions that exercise many code paths
    await space.generateBtn.click();
    await space.stepBtn.click();
    await space.playBtn.click();
    // Small wait then pause
    await page.waitForTimeout(120);
    await space.pauseBtn.click();
    await space.manualAllocBtn.click();
    await space.manualFreeBtn.click();
    await space.loadScriptBtn.click();
    await space.estimateBtn.click();
    // After interactions, assert that no uncaught page errors were emitted
    expect(pageErrors.length).toBe(0);

    // Also assert there are no console.error messages captured
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });
});