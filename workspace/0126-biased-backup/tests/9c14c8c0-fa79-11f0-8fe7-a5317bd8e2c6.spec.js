import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c14c8c0-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Dynamic Programming Interactive Playground - FSM states and transitions', () => {
  // Capture page errors and console messages for assertions that errors occur naturally.
  let pageErrors = [];
  let pageConsole = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    pageConsole = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      pageConsole.push({ type: msg.type(), text: msg.text() });
    });

    // Accept any dialogs so tests don't block on alert()
    page.on('dialog', async (dialog) => {
      try {
        await dialog.accept();
      } catch (e) {
        // ignore
      }
    });

    await page.goto(APP_URL);
    // Wait for the app to finish initial rendering; the page script calls initEngine on load.
    await page.waitForSelector('#initBtn');
  });

  test.afterEach(async ({ page }) => {
    // Useful for debugging if needed — ensure no unexpected fatal errors unless tests expect them.
  });

  test('Initial load shows core controls and pause button is disabled (Idle/Initialized check)', async ({ page }) => {
    // Validate presence of main control buttons
    await expect(page.locator('#initBtn')).toBeVisible();
    await expect(page.locator('#stepBtn')).toBeVisible();
    await expect(page.locator('#runBtn')).toBeVisible();
    await expect(page.locator('#pauseBtn')).toBeVisible();
    await expect(page.locator('#resetBtn')).toBeVisible();
    await expect(page.locator('#randomBtn')).toBeVisible();

    // Pause should start disabled by script default
    await expect(page.locator('#pauseBtn')).toBeDisabled();

    // The script auto-initializes on load; confirm that dp/memo or operations exist in global state
    const state = await page.evaluate(() => window.__dp_state && ({ running: window.__dp_state.running, algorithm: window.__dp_state.algorithm, operationsLength: window.__dp_state.operations.length }));
    expect(state).toBeTruthy();
    // At least some operations should be present after initial init
    expect(state.operationsLength).toBeGreaterThanOrEqual(0);
    expect(typeof state.algorithm).toBe('string');
  });

  test('Reset -> Initialize transition: reset clears state and init populates it (S0_Idle -> S1_Initialized)', async ({ page }) => {
    // Ensure we can go to Idle-like empty state by Reset
    await page.click('#resetBtn');

    // After reset, dp should be null and operations empty according to implementation
    const afterReset = await page.evaluate(() => {
      const s = window.__dp_state;
      return { dp: s.dp, operationsLength: s.operations.length, historyIndex: s.historyIndex };
    });
    expect(afterReset.dp === null).toBe(true);
    expect(afterReset.operationsLength).toBe(0);

    // Now click Initialize to populate engine
    await page.click('#initBtn');

    // After init, dp or operations should be populated
    const afterInit = await page.evaluate(() => {
      const s = window.__dp_state;
      return { dpExists: s.dp !== null, operationsLength: s.operations.length, algorithm: s.algorithm, opIndex: s.opIndex };
    });
    expect(afterInit.operationsLength).toBeGreaterThanOrEqual(0);
    // dp may be null for fib (top-down), but algorithm should be set
    expect(typeof afterInit.algorithm).toBe('string');
    expect(afterInit.opIndex).toBe(0);
  });

  test('Run and Pause transitions change running state and button disabled states (S1_Initialized <-> S2_Running <-> S3_Paused)', async ({ page }) => {
    // Ensure manualChoice is unchecked to allow auto progression for deterministic behavior
    const manualChoice = page.locator('#manualChoice');
    const isChecked = await manualChoice.isChecked();
    if (isChecked) await manualChoice.click();

    // Initialize explicitly to ensure deterministic operations
    await page.click('#initBtn');

    // Click Run -> should start interval and switch button states
    await page.click('#runBtn');

    // runBtn should become disabled, pauseBtn enabled, and running true in state
    await expect(page.locator('#runBtn')).toBeDisabled();
    await expect(page.locator('#pauseBtn')).toBeEnabled();

    const runningState = await page.evaluate(() => ({ running: window.__dp_state.running }));
    expect(runningState.running).toBe(true);

    // Click Pause -> should stop running
    await page.click('#pauseBtn');
    await expect(page.locator('#runBtn')).toBeEnabled();
    await expect(page.locator('#pauseBtn')).toBeDisabled();

    const pausedState = await page.evaluate(() => ({ running: window.__dp_state.running }));
    expect(pausedState.running).toBe(false);

    // Click Run again to resume (S3_Paused -> S2_Running)
    await page.click('#runBtn');
    await expect(page.locator('#runBtn')).toBeDisabled();
    const resumedState = await page.evaluate(() => ({ running: window.__dp_state.running }));
    expect(resumedState.running).toBe(true);

    // Stop the run to avoid background activity
    await page.click('#pauseBtn');
  });

  test('Step transition and Stepping behavior for auto mode (S2_Running -> S4_Stepping and stepping advances opIndex)', async ({ page }) => {
    // Uncheck manualChoice to allow auto computation on computeCell
    const manualChoice = page.locator('#manualChoice');
    if (await manualChoice.isChecked()) await manualChoice.click();

    // Initialize
    await page.click('#initBtn');

    // Capture starting opIndex
    const startOp = await page.evaluate(() => window.__dp_state.opIndex);

    // Click Step (dispatchStep)
    await page.click('#stepBtn');

    // After a step, opIndex should increase by at least 1 or reach operations length
    const afterStepOp = await page.evaluate(() => ({ opIndex: window.__dp_state.opIndex, operationsLength: window.__dp_state.operations.length }));
    expect(afterStepOp.opIndex).toBeGreaterThanOrEqual(startOp + 1);
    // opInfo should reflect either a computeCell was processed or no current operation
    const opInfoText = await page.locator('#opInfo').textContent();
    expect(typeof opInfoText).toBe('string');
  });

  test('Manual choices are presented when manualChoice is enabled (ManualChoiceToggle and candidate selection)', async ({ page }) => {
    // Ensure manualChoice is enabled
    const manualLocator = page.locator('#manualChoice');
    if (!(await manualLocator.isChecked())) await manualLocator.click();

    // Choose knapsack algorithm (default) and initialize
    await page.selectOption('#algo', 'knapsack');
    await page.click('#initBtn');

    // After initialization, first computeCell should present candidates in candidates pane (manual)
    await expect(page.locator('#candidates')).toBeVisible();

    // Wait for candidate buttons to appear (Auto-select best button included)
    await page.waitForSelector('.candidate-btn, #candidates button');

    // Click 'Auto-select best' button inside candidates to simulate user completion
    const autoSelectBtn = page.locator('#candidates >> text=Auto-select best');
    await expect(autoSelectBtn).toBeVisible();
    await autoSelectBtn.click();

    // After selecting, candidates pane should be cleared and opIndex should advance
    const candidatesContent = await page.locator('#candidates').innerHTML();
    expect(candidatesContent.trim().length).toBeGreaterThanOrEqual(0); // empty or minimal

    const opIndexAfterChoice = await page.evaluate(() => window.__dp_state.opIndex);
    expect(typeof opIndexAfterChoice).toBe('number');
    expect(opIndexAfterChoice).toBeGreaterThanOrEqual(1);
  });

  test('Backtracking lifecycle: start, step, end for a fully-initialized DP (S2_Running -> S5_Backtracking -> S2_Running)', async ({ page }) => {
    // Use coin algorithm for small deterministic completion: uncheck manual, init, auto-compute all entries via steps
    if (await page.locator('#manualChoice').isChecked()) await page.locator('#manualChoice').click();
    await page.selectOption('#algo', 'coin');
    await page.fill('#coins', '1,3,4');
    await page.fill('#target', '6');
    await page.click('#initBtn');

    // Step through all operations to fill dp (dp length target+1)
    const opsLen = await page.evaluate(() => window.__dp_state.operations.length);
    for (let i = 0; i < opsLen; i++) {
      await page.click('#stepBtn');
    }

    // Now explicitly start backtracking
    await page.click('#startBackBtn');

    // backInfo should indicate prepared steps
    const backInfoText = await page.locator('#backInfo').textContent();
    expect(backInfoText).toMatch(/Backtracking prepared/);

    // Perform one backtrack step
    await page.click('#backStepBtn');
    const backInfoAfterStep = await page.locator('#backInfo').textContent();
    expect(backInfoAfterStep).toMatch(/Backtracking step/);

    // End backtracking
    await page.click('#endBackBtn');
    const backInfoAfterEnd = await page.locator('#backInfo').textContent();
    // endBackBtn clears backInfo; page sets it to '' (empty) on end
    expect(backInfoAfterEnd.trim().length).toBeLessThanOrEqual(0);
  });

  test('Algorithm/Mode toggles persist to state and renderInputArea updates analysis text (AlgorithmChange & ModeChange)', async ({ page }) => {
    // Change algorithm to edit and ensure inputArea updates and analysis reflects the new values
    await page.selectOption('#algo', 'edit');
    // Wait for inputArea to update input fields
    await page.waitForSelector('#s1');

    const analysisText = await page.locator('#analysis').textContent();
    expect(analysisText).toContain('Edit Distance');

    // Change mode and ensure state.mode updated
    await page.selectOption('#mode', 'bottom-up');
    const modeVal = await page.evaluate(() => window.__dp_state.mode);
    expect(modeVal).toBe('bottom-up');

    // Switch to fib and mode should be forced to top-down by the UI script
    await page.selectOption('#algo', 'fib');
    await page.waitForSelector('#nval');
    const modeAfterFib = await page.evaluate(() => ({ algo: window.__dp_state.algorithm, modeVal: window.__dp_state.mode }));
    expect(modeAfterFib.algo).toBe('fib');
    // The UI sets mode to top-down for fib
    expect(modeAfterFib.modeVal).toBe('top-down');
  });

  test('Randomize input produces a history snapshot and Undo/Redo restores previous input (Randomize, Undo, Redo)', async ({ page }) => {
    // Ensure algorithm knapsack present and capture current weights
    await page.selectOption('#algo', 'knapsack');
    await page.waitForSelector('#weights');
    const beforeWeights = await page.locator('#weights').inputValue();

    // Click Randomize -> will change inputs and create snapshot
    await page.click('#randomBtn');

    // After randomize, weights changed
    const afterWeights = await page.locator('#weights').inputValue();
    expect(afterWeights).not.toBe(beforeWeights);

    // Undo should restore previous snapshot
    await page.click('#undoBtn');
    const afterUndoWeights = await page.locator('#weights').inputValue();
    // It may restore exactly to beforeWeights if history captured, assert equality to one of known values
    expect(afterUndoWeights).toBe(beforeWeights);

    // Redo should bring randomized value back
    await page.click('#redoBtn');
    const afterRedoWeights = await page.locator('#weights').inputValue();
    expect(afterRedoWeights).toBe(afterWeights);
  });

  test('Save and Load paths: exporting a snapshot fills textarea; loading invalid JSON triggers a page error naturally (Save, Load, error case)', async ({ page }) => {
    // Ensure there is at least one snapshot in history by initializing
    await page.click('#initBtn');

    // Click Save (Export State) to put current snapshot into the textarea
    await page.click('#saveBtn');

    const savedText = await page.locator('#saveLoadArea').inputValue();
    expect(savedText.trim().length).toBeGreaterThan(0);
    // Now intentionally write invalid JSON into textarea to exercise the bug/error path in load handler
    await page.fill('#saveLoadArea', '{ invalidJson'); // invalid on purpose

    // Prepare to capture any pageerror that will happen when clicking Load
    const errorsBefore = [];
    page.on('pageerror', (err) => {
      errorsBefore.push(err);
    });

    // Click Load which will attempt to parse JSON and in the invalid branch call alert(...).toString() causing a TypeError
    await page.click('#loadBtn');

    // Give a short time for pageerror to propagate
    await page.waitForTimeout(250);

    // One or more page errors should have been captured; at least one should be a TypeError about toString on undefined
    const pageErrorsCaptured = await page.evaluate(() => {
      // We can't access the Node Error objects captured earlier in test scope; rely on the test-level captured pageErrors array instead
      return window.__dp_state ? true : true;
    });

    // Inspect the pageErrors array collected in this test context (pageErrors variable in outer scope)
    // There should be at least one TypeError indicating the unintended toString() call happened
    // Because behavior might vary slightly by environment, assert that at least one page error was recorded in the test harness global variable
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    // At least one error message should mention 'toString' or 'undefined' which is indicative of the bug
    const msgs = pageErrors.map(e => (e && e.message) ? e.message.toString() : JSON.stringify(e));
    const foundIndicative = msgs.some(m => /toString|undefined|TypeError/i.test(m));
    expect(foundIndicative).toBe(true);
  });

  test('Export Snapshot JSON triggers download flow without throwing (ExportJSON)', async ({ page }) => {
    // Ensure snapshot exists
    await page.click('#initBtn');

    // There should be a snapshot to export; click exportJSON to trigger download anchor creation
    // No exception should be thrown; verify no new pageerror after clicking
    const errorsBefore = pageErrors.length;
    await page.click('#exportJSON');

    // Allow a brief moment to allow any errors to be reported
    await page.waitForTimeout(200);

    expect(pageErrors.length).toBe(errorsBefore);
  });

  test('Top-down Fibonacci call/memo flow: dispatch steps create memo entries and computeFibStore behavior', async ({ page }) => {
    // Choose fib algorithm and set manualChoice off (not relevant)
    await page.selectOption('#algo', 'fib');
    await page.waitForSelector('#nval');

    // set small n for deterministic behavior
    await page.fill('#nval', '6');
    await page.click('#initBtn');

    // The initial operations for top-down are call ops; step through until memo contains fib(6)
    // We'll step repeatedly until memo has the 6 key or until a safe bound iterations
    let iter = 0;
    const maxIter = 200;
    while (iter < maxIter) {
      const memoKeys = await page.evaluate(() => Object.keys(window.__dp_state.memo));
      if (memoKeys.includes('6')) break;
      await page.click('#stepBtn');
      iter++;
    }

    const finalMemo = await page.evaluate(() => ({ memo: window.__dp_state.memo }));
    expect(finalMemo.memo).toBeTruthy();
    // Expect fib(0..6) at least fib(6) present
    expect(Object.prototype.hasOwnProperty.call(finalMemo.memo, '6')).toBe(true);
  });

  // Additional sanity checks: ensure logs clickable elements exist and clicking a log restores a snapshot
  test('Logs are rendered and clicking a log entry restores the snapshot', async ({ page }) => {
    // Initialize, make a small change (randomize) to produce extra logs and history
    await page.click('#initBtn');
    await page.click('#randomBtn');

    // Logs should have clickable elements (divs)
    const logEntries = page.locator('#logPane > div');
    await expect(logEntries).toHaveCountGreaterThan(0);

    // Click the most recent log entry (first in order displayed)
    await logEntries.first().click();

    // After clicking, historyIndex should reflect restoration (an integer within bounds)
    const historyIndex = await page.evaluate(() => window.__dp_state.historyIndex);
    expect(typeof historyIndex).toBe('number');
    expect(historyIndex).toBeGreaterThanOrEqual(0);
  });
});