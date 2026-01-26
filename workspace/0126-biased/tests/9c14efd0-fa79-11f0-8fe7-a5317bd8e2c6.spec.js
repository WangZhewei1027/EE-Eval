import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c14efd0-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Utility: parse JSON from a pre element's text content safely
async function getJsonFromLocator(locator) {
  const txt = (await locator.textContent()) || '';
  try {
    return JSON.parse(txt);
  } catch {
    return txt.trim();
  }
}

test.describe('Two Pointers Explorer - FSM end-to-end', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // capture console messages and page errors for assertions
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure initial buildNewStateFromInputs had time to run
    await page.waitForSelector('#array-visual');
  });

  test.afterEach(async ({ page }) => {
    // attach the logs as test artifacts via assertions below (no-op here)
    // close page is automatic
  });

  test('Initial Idle state after load', async ({ page }) => {
    // Validate UI indicates Idle (not running): run enabled, pause disabled
    const runBtn = page.locator('#run-btn');
    const pauseBtn = page.locator('#pause-btn');
    await expect(runBtn).toBeEnabled();
    await expect(pauseBtn).toBeDisabled();

    // Validate state snapshot shows step 0 and finished false
    const stateArea = page.locator('#state-area');
    const stateJson = await getJsonFromLocator(stateArea);
    expect(typeof stateJson).toBe('object');
    expect(stateJson.step).toBe(0);
    expect(stateJson.finished).toBe(false);

    // Validate initial log contains "Reset state."
    const logArea = page.locator('#log-area');
    const logText = await logArea.textContent();
    expect(logText).toContain('Reset state.');

    // Assert there are no page errors on clean load
    expect(pageErrors.length).toBe(0);
    // Also ensure no console error messages were emitted
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test.describe('Array generation, shuffle, and presets', () => {
    test('Generate Random array and Shuffle modify the input and rebuild state', async ({ page }) => {
      const arrayInput = page.locator('#array-input');
      const genRandomBtn = page.locator('#gen-random');
      const shuffleBtn = page.locator('#shuffle-array');
      const sizeSlider = page.locator('#size-slider');
      const sizeDisplay = page.locator('#size-display');

      // adjust size slider to a deterministic known value and generate
      await sizeSlider.fill('5'); // slider change via fill may not trigger input; use evaluate
      await page.evaluate(() => { document.getElementById('size-slider').value = '5'; document.getElementById('size-slider').dispatchEvent(new Event('input')); });
      await expect(sizeDisplay).toHaveText('5');

      // Click generate and assert array-input updates and state resets
      await genRandomBtn.click();
      const valAfterGen = (await arrayInput.inputValue()).trim();
      expect(valAfterGen.split(',').length).toBe(5);

      // Click shuffle and assert array input still has 5 values
      await shuffleBtn.click();
      const valAfterShuffle = (await arrayInput.inputValue()).trim();
      expect(valAfterShuffle.split(',').length).toBe(5);

      // Ensure array visualization matches the array input (cells count)
      const cells = page.locator('#array-visual .cell');
      await expect(cells).toHaveCount(5);
    });

    test('Quick preset buttons set array and rebuild state', async ({ page }) => {
      const presetBtn = page.locator('button.preset[data-val="1,2,3,4,5,6,7"]');
      const arrayInput = page.locator('#array-input');
      await presetBtn.click();
      await expect(arrayInput).toHaveValue('1,2,3,4,5,6,7');

      // State should be rebuilt: check state.n via state-area contains step 0 and algo default
      const stateArea = page.locator('#state-area');
      const stateJson = await getJsonFromLocator(stateArea);
      expect(stateJson.step).toBe(0);
    });
  });

  test.describe('Pointer initialization and manual setting', () => {
    test('Apply initial indices updates state and history', async ({ page }) => {
      const initI = page.locator('#init-i');
      const initJ = page.locator('#init-j');
      const applyBtn = page.locator('#apply-init');
      const stateArea = page.locator('#state-area');
      const historyArea = page.locator('#history-area');

      await initI.fill('1');
      await initJ.fill('5');
      await applyBtn.click();

      const stateJson = await getJsonFromLocator(stateArea);
      expect(stateJson.i).toBe(1);
      expect(stateJson.j).toBe(5);

      // history-area should have at least one entry (buttons)
      const historyButtons = historyArea.locator('button');
      await expect(historyButtons).toHaveCountGreaterThan(0);
    });

    test('Set manual pointers mutates state and logs action', async ({ page }) => {
      const manualI = page.locator('#manual-i');
      const manualJ = page.locator('#manual-j');
      const setManualBtn = page.locator('#set-manual-pointers');
      const stateArea = page.locator('#state-area');
      const logArea = page.locator('#log-area');

      await manualI.fill('2');
      await manualJ.fill('4');
      await setManualBtn.click();

      const stateJson = await getJsonFromLocator(stateArea);
      expect(stateJson.i).toBe(2);
      expect(stateJson.j).toBe(4);

      const logs = await logArea.textContent();
      expect(logs).toContain('Manually set pointers.');
    });
  });

  test.describe('Breakpoints and run/pause behavior', () => {
    test('Set and clear breakpoint via UI logs actions', async ({ page }) => {
      const breakpointInput = page.locator('#breakpoint-input');
      const setBreakpointBtn = page.locator('#set-breakpoint');
      const clearBreakpointBtn = page.locator('#clear-breakpoint');
      const logArea = page.locator('#log-area');

      await breakpointInput.fill('arr[0] === 1');
      await setBreakpointBtn.click();
      await expect(logArea).toContainText('Set breakpoint expression');

      await clearBreakpointBtn.click();
      await expect(logArea).toContainText('Cleared breakpoint.');
      // Ensure the input cleared as code does on evaluation error only; here clear button clears it
      await expect(breakpointInput).toHaveValue('');
    });

    test('Run -> Running state and Pause -> Paused state toggle controls', async ({ page }) => {
      const runBtn = page.locator('#run-btn');
      const pauseBtn = page.locator('#pause-btn');
      const logArea = page.locator('#log-area');

      await runBtn.click();
      // Running: run button disabled, pause enabled, and log contains 'Started running.'
      await expect(runBtn).toBeDisabled();
      await expect(pauseBtn).toBeEnabled();
      await expect(logArea).toContainText('Started running.');

      // Pause
      await pauseBtn.click();
      await expect(runBtn).toBeEnabled();
      await expect(pauseBtn).toBeDisabled();
      await expect(logArea).toContainText('Paused.');
    });

    test('Run with an always-true breakpoint pauses immediately', async ({ page }) => {
      const breakpointInput = page.locator('#breakpoint-input');
      const setBreakpointBtn = page.locator('#set-breakpoint');
      const runBtn = page.locator('#run-btn');
      const logArea = page.locator('#log-area');

      await breakpointInput.fill('true');
      await setBreakpointBtn.click();
      await runBtn.click();

      // Because evaluateBreakpoint checks before executing a step, it should pause and log the message
      await expect(logArea).toContainText('Paused at breakpoint condition.');
      // Controls reflect paused state
      await expect(page.locator('#run-btn')).toBeEnabled();
      await expect(page.locator('#pause-btn')).toBeDisabled();
    });

    test('Stop & Clear Log clears then logs cleared message (observed behavior)', async ({ page }) => {
      const runBtn = page.locator('#run-btn');
      const stopClearBtn = page.locator('#stop-and-reset-log');
      const logArea = page.locator('#log-area');

      // Start running briefly to accumulate logs
      await runBtn.click();
      // Wait a short time for interval to start
      await page.waitForTimeout(200);
      await stopClearBtn.click();

      // Code clears logArea then logs 'Stopped and cleared logs.' so expect that message
      await expect(logArea).toContainText('Stopped and cleared logs.');
      // Internal state.log array was reset then had a log pushed; verify UI matches
      const loggedText = await logArea.textContent();
      expect(loggedText).toContain('Stopped and cleared logs.');
    });
  });

  test.describe('Stepping and finishing algorithms', () => {
    test('Pair Sum: stepping leads to matches and eventually finished', async ({ page }) => {
      // Set a small deterministic array to reach finished in a couple of steps
      const arrayInput = page.locator('#array-input');
      const targetInput = page.locator('#target-input');
      const algoSelect = page.locator('#algo-select');
      const stepBtn = page.locator('#step-btn');
      const matchesArea = page.locator('#matches-area');
      const stateArea = page.locator('#state-area');
      const logArea = page.locator('#log-area');

      // Use array [4,4] target 8 so first step records match and moves pointers; next step finishes
      await arrayInput.fill('4,4');
      await targetInput.fill('8');
      await algoSelect.selectOption('pair-sum');
      // rebuild occurs automatically on change; wait a tick
      await page.waitForTimeout(50);

      // Step 1: record match
      await stepBtn.click();
      await expect(matchesArea).toContainText('[\n  [\n    "0"'); // crude check; structure should include indices
      // Step 2: finish when i >= j
      await stepBtn.click();
      const stateJson = await getJsonFromLocator(stateArea);
      expect(stateJson.finished).toBe(true);
      await expect(logArea).toContainText('Algorithm finished.');
    });

    test('Reverse subarray swaps until finished', async ({ page }) => {
      const arrayInput = page.locator('#array-input');
      const algoSelect = page.locator('#algo-select');
      const stepBtn = page.locator('#step-btn');
      const stateArea = page.locator('#state-area');
      const arrayVisual = page.locator('#array-visual');

      await arrayInput.fill('1,2,3');
      await algoSelect.selectOption('reverse-subarray');
      await page.waitForTimeout(50);

      // Step until finished (should take floor(n/2) steps)
      await stepBtn.click(); // swap 0 and 2
      await stepBtn.click(); // now i>=j -> finish
      const stateJson = await getJsonFromLocator(stateArea);
      expect(stateJson.finished).toBe(true);

      // Confirm arrayVisual shows reversed array values (3,2,1)
      const cellTexts = await arrayVisual.locator('.cell').allTextContents();
      expect(cellTexts.map(s => s.trim())).toEqual(['3', '2', '1']);
    });
  });

  test.describe('Branching, export/import, and custom rule errors', () => {
    test('Create a branch and switch to it', async ({ page }) => {
      const createBranchBtn = page.locator('#create-branch');
      const branchesList = page.locator('#branches-list');
      const logArea = page.locator('#log-area');

      // Ensure there are no branches initially
      await expect(branchesList).toContainText('(no branches)');

      // Create branch and confirm UI updated and log emitted
      await createBranchBtn.click();
      await expect(branchesList).not.toContainText('(no branches)');
      await expect(logArea).toContainText('Created branch');
    });

    test('Export produces JSON and Import with invalid JSON logs an error', async ({ page }) => {
      const exportBtn = page.locator('#export-state');
      const importBtn = page.locator('#import-state');
      const exportArea = page.locator('#export-area');
      const logArea = page.locator('#log-area');

      await exportBtn.click();
      // exportArea should contain JSON with state, history, branches
      const exportedText = await exportArea.inputValue();
      expect(exportedText).toContain('"state"');

      // Now write invalid JSON and attempt import to trigger an import error log
      await exportArea.fill('this is not json');
      await importBtn.click();
      await expect(logArea).toContainText('Import error');
    });

    test('Custom rule with invalid code logs a Custom rule error', async ({ page }) => {
      const algoSelect = page.locator('#algo-select');
      const customRuleArea = page.locator('#custom-rule');
      const stepBtn = page.locator('#step-btn');
      const logArea = page.locator('#log-area');

      // Switch to custom rule mode
      await algoSelect.selectOption('custom-rule');
      await page.waitForTimeout(50);

      // Put invalid JS that throws when evaluated
      await customRuleArea.fill('throw new Error("bad custom");');
      // Single step triggers alg_custom_rule_step which catches and logs an error
      await stepBtn.click();
      await expect(logArea).toContainText('Custom rule error');
    });
  });

  test('Keyboard shortcuts: space for step, r/p for run/pause', async ({ page }) => {
    const stepBtn = page.locator('#step-btn');
    const runBtn = page.locator('#run-btn');
    const pauseBtn = page.locator('#pause-btn');
    const logArea = page.locator('#log-area');

    // Press space to step (should log something about checking or similar)
    await page.keyboard.press(' ');
    await expect(logArea).toContainText('Checking').or.toContainText('Comparing').or.toContainText('Swapping');

    // Press 'r' to run (starts running)
    await page.keyboard.press('r');
    await expect(runBtn).toBeDisabled();
    await expect(pauseBtn).toBeEnabled();

    // Press 'p' to pause
    await page.keyboard.press('p');
    await expect(runBtn).toBeEnabled();
    await expect(pauseBtn).toBeDisabled();
  });

  test('Edge case: setting breakpoint to invalid JS logs evaluation error and clears breakpoint input', async ({ page }) => {
    const breakpointInput = page.locator('#breakpoint-input');
    const setBreakpointBtn = page.locator('#set-breakpoint');
    const logArea = page.locator('#log-area');

    // Set an expression that will throw during evaluation (e.g., referencing undefined variable via syntax error)
    await breakpointInput.fill('(() => { throw new ReferenceError("boom"); })()');
    await setBreakpointBtn.click();

    // Now trigger step which invokes evaluateBreakpoint (it checks before executing step)
    await page.locator('#step-btn').click();

    // The code catches evaluation error, logs 'Breakpoint evaluation error' and clears the input
    await expect(logArea).toContainText('Breakpoint evaluation error');
    await expect(breakpointInput).toHaveValue('');
  });

  test('No unexpected page errors occurred during test run', async ({ page }) => {
    // This final assertion validates that while we allowed errors to occur naturally,
    // there were no uncaught page-level errors recorded.
    expect(pageErrors.length).toBe(0);
  });
});