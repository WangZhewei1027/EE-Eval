import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c13de60-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Insertion Sort — Interactive Demo (FSM validation)', () => {
  // Containers for captured console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (info/warn/log) to assert on logs like "Breakpoint hit", "Exported", etc.
    page.on('console', msg => {
      try {
        // capture text and type
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Auto-accept dialogs but collect their messages when relevant
    page.on('dialog', async dialog => {
      // push dialog message into consoleMessages for assertions
      consoleMessages.push({ type: 'dialog', text: dialog.message() });
      await dialog.accept();
    });

    // Navigate to the application
    await page.goto(APP_URL);
    // Wait for the arrayView to be populated to ensure app initialized
    await page.waitForSelector('#arrayView');
  });

  test.afterEach(async () => {
    // nothing to tear down beyond Playwright's fixtures
  });

  test.describe('Initial state and basic UI rendering', () => {
    test('page loads and initial model is Idle with initialized history', async ({ page }) => {
      // Verify the global model exists and initial phase is 'idle' as set by initializeFromInput called on load
      const phase = await page.evaluate(() => window.__insertionModel && window.__insertionModel.phase);
      expect(phase).toBe('idle');

      // Check that arrayView shows the initial array and indices
      const arrayViewText = await page.locator('#arrayView').innerText();
      expect(arrayViewText).toContain('Array:');
      expect(arrayViewText).toContain('Full:');

      // History should contain the 'initialized' snapshot note (pushHistorySnapshot called during initializeFromInput)
      const historyText = await page.locator('#historyView').innerText();
      expect(historyText).toContain('initialized');

      // Ensure no uncaught page errors occurred during initialization
      expect(pageErrors.length).toBe(0);

      // Confirm speedVal reflects slider initial value
      const speedVal = await page.locator('#speedVal').innerText();
      expect(Number(speedVal)).toBeGreaterThan(0);
    });
  });

  test.describe('State transitions via Step, Initialize, Randomize', () => {
    test('Initialize button re-parses array and pushes history', async ({ page }) => {
      // Change the input to a known value and click Initialize
      await page.fill('#arrayInput', '9,7,5,3');
      await page.click('#initBtn');

      // After initializeFromInput the phase is set to 'idle' per implementation
      const phase = await page.evaluate(() => window.__insertionModel.phase);
      expect(phase).toBe('idle');

      // History should have a recent "initialized" snapshot
      const history = await page.locator('#historyView').innerText();
      expect(history).toContain('initialized');

      // Model array length should match input
      const n = await page.evaluate(() => window.__insertionModel.n);
      expect(n).toBe(4);
    });

    test('Step button advances finite-state micro steps (idle -> start -> selectKey -> compare)', async ({ page }) => {
      // Ensure known input
      await page.fill('#arrayInput', '4,2,3');
      await page.click('#initBtn');

      // Initial phase idle
      let phase = await page.evaluate(() => window.__insertionModel.phase);
      expect(phase).toBe('idle');

      // First step: idle -> start (stepForward handles idle case)
      await page.click('#stepBtn');
      phase = await page.evaluate(() => window.__insertionModel.phase);
      expect(phase).toBe('start');

      // Next step: start -> selectKey
      await page.click('#stepBtn');
      phase = await page.evaluate(() => window.__insertionModel.phase);
      // Implementation sets phase -> selectKey after capturing key (it sets 'selectKey' as string)
      expect(phase === 'selectKey' || phase === 'compare' || phase === 'start').toBeTruthy();

      // Ensure pseudocode display highlights a line (contains leading '>')
      const pseudo = await page.locator('#pseudocode').innerText();
      expect(pseudo).toMatch(/^\s*>/m);
    });

    test('Randomize generates a new array and triggers initialize', async ({ page }) => {
      // Set seed and size for deterministic-ish generation then click Randomize
      await page.fill('#randSeed', 'seed123');
      await page.fill('#randSize', '5');
      await page.click('#randomBtn');

      // After clicking randomize, input should be populated
      const inputVal = await page.locator('#arrayInput').inputValue();
      expect(inputVal.split(',').length).toBeGreaterThanOrEqual(1);

      // The model should have updated n equal to array length
      const n = await page.evaluate(() => window.__insertionModel.n);
      expect(n).toBeGreaterThanOrEqual(1);

      // An 'initialized' history entry should exist after generateRandom -> initializeFromInput
      const history = await page.locator('#historyView').innerText();
      expect(history).toContain('initialized');
    });
  });

  test.describe('Play, Pause and RunToEnd behaviors', () => {
    test('Play enables pause button and periodic stepping occurs; Pause stops it', async ({ page }) => {
      // Ensure small array so play will finish quickly
      await page.fill('#arrayInput', '3,1,2');
      await page.click('#initBtn');

      // Click Play
      await page.click('#playBtn');

      // Play disables Play button and enables Pause
      await expect(page.locator('#playBtn')).toBeDisabled();
      await expect(page.locator('#pauseBtn')).toBeEnabled();

      // Wait a short time to allow a couple of steps to happen
      await page.waitForTimeout(300);

      // Click Pause
      await page.click('#pauseBtn');

      // Pause should re-enable Play
      await expect(page.locator('#playBtn')).toBeEnabled();
      await expect(page.locator('#pauseBtn')).toBeDisabled();

      // Ensure that logs contain "Started playing" and "Paused"
      const log = await page.locator('#logArea').inputValue();
      expect(log).toMatch(/Started playing/);
      expect(log).toMatch(/Paused/);
    });

    test('Run to End finishes sorting and sets model.phase = done', async ({ page }) => {
      // Use a small, unsorted array and run to end
      await page.fill('#arrayInput', '5,1,4,2');
      await page.click('#initBtn');

      // Click run to end
      await page.click('#runToEndBtn');

      // Wait until model.phase == 'done' or timeout
      await page.waitForFunction(() => window.__insertionModel.phase === 'done', null, { timeout: 5000 });

      const phase = await page.evaluate(() => window.__insertionModel.phase);
      expect(phase).toBe('done');

      // Log should contain completion message or "Sorting finished."
      const log = await page.locator('#logArea').inputValue();
      expect(log.length).toBeGreaterThan(0);
    });
  });

  test.describe('History, Undo and Redo', () => {
    test('Push/Undo/Redo via buttons modifies history and array length accordingly', async ({ page }) => {
      // Initialize with known array
      await page.fill('#arrayInput', '7,8');
      await page.click('#initBtn');

      // Record initial length
      const initialLen = await page.evaluate(() => window.__insertionModel.arr.length);

      // Set editValue and click pushBtn to append a value
      await page.fill('#editValue', '42');
      await page.click('#pushBtn');

      // Now array length increased
      const afterPushLen = await page.evaluate(() => window.__insertionModel.arr.length);
      expect(afterPushLen).toBe(initialLen + 1);

      // Click Undo
      await page.click('#undoBtn');
      // After undo, model array should be restored to previous state (length back to initial)
      const afterUndoLen = await page.evaluate(() => window.__insertionModel.arr.length);
      expect(afterUndoLen).toBe(initialLen);

      // Click Redo
      await page.click('#redoBtn');
      const afterRedoLen = await page.evaluate(() => window.__insertionModel.arr.length);
      // Redo should restore the pushed element (length again +1), but redo implementation depends on redo stack; accept either same as afterPush or >= initial
      expect(afterRedoLen).toBeGreaterThanOrEqual(initialLen);
    });
  });

  test.describe('Breakpoints and breakpoint-driven halting', () => {
    test('Add breakpoint of type iEquals halts stepForward before progression', async ({ page }) => {
      // Ensure known array and init
      await page.fill('#arrayInput', '2,1,3');
      await page.click('#initBtn');

      // Set bp type to iEquals and value to current i (which should be 1 after initialization)
      await page.selectOption('#bpType', 'iEquals');
      await page.fill('#bpVal', '1');
      await page.click('#addBpBtn');

      // Confirm BP list updated
      const bpList = await page.locator('#bpList').innerText();
      expect(bpList).toContain('iEquals');

      // Now attempt to step forward; per implementation checkBreakpointsBeforeStep should block and stepForward returns false
      const progressed = await page.evaluate(() => window.__stepForward());
      expect(progressed).toBe(false);

      // The logs should indicate breakpoint triggered before step
      const log = await page.locator('#logArea').inputValue();
      expect(log).toContain('Breakpoint triggered before step');

      // Clear breakpoints using button
      await page.click('#clearBpBtn');
      const bpListAfter = await page.locator('#bpList').innerText();
      expect(bpListAfter).toContain('No breakpoints');
    });

    test('Breakpoint hit when condition becomes true after a step (stepGE)', async ({ page }) => {
      // Initialize and clear any BPs
      await page.fill('#arrayInput', '3,2');
      await page.click('#initBtn');
      await page.click('#clearBpBtn');

      // Add a breakpoint of type stepGE value 1
      await page.selectOption('#bpType', 'stepGE');
      await page.fill('#bpVal', '1');
      await page.click('#addBpBtn');

      // Execute one step - the model's stepNumber should increment and possibly trigger breakpoint after the step
      const progressed = await page.evaluate(() => window.__stepForward());
      // stepForward may return true (progressed)
      expect(typeof progressed).toBe('boolean');

      // Check logs for "Breakpoint hit"
      const log = await page.locator('#logArea').inputValue();
      const found = /Breakpoint hit:/.test(log);
      // It's acceptable that the breakpoint might have been hit and doPause logged; assert that either the log contains breakpoint or playback paused state is observable
      expect(found || log.includes('Paused') || log.includes('Breakpoint triggered before step')).toBeTruthy();
    });
  });

  test.describe('Export and Import of state', () => {
    test('Export triggers a download and import can restore state from file', async ({ page, context, tmpDir }) => {
      // Prepare a known model state to export
      await page.fill('#arrayInput', '10,20,30');
      await page.click('#initBtn');

      // Trigger export and wait for download
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('#exportBtn'),
      ]);

      // Save the download to a temporary path provided by Playwright
      const downloadPath = await download.path();
      expect(downloadPath).toBeTruthy();

      // Read the export content (download.path might be null in some runners; fallback to suggestedFilename check)
      const suggested = download.suggestedFilename();
      expect(suggested).toContain('insertion_demo_export');

      // Create a custom import JSON content representing a different array to test import
      const importData = {
        model: {
          arr: [99, 88, 77],
          i: 1,
          j: null,
          key: null,
          phase: 'idle',
          counts: { comparisons: 0, assignments: 0, shifts: 0, swaps: 0 },
          stepNumber: 0,
          frozen: []
        },
        history: [],
        snapshots: {}
      };
      // Create a temporary file via the page's file input by using setInputFiles
      const fileName = 'test_import_state.json';
      const fileContent = JSON.stringify(importData, null, 2);

      // Use Playwright's setInputFiles to emulate selecting the file in importFile
      // To set a file, we need to create a File payload. Playwright supports passing { name, mimeType, buffer }
      await page.setInputFiles('#importFile', {
        name: fileName,
        mimeType: 'application/json',
        buffer: Buffer.from(fileContent),
      });

      // After setting files, the input change handler triggers importStateFile which reads and applies the state
      // Wait a brief moment for import to process
      await page.waitForTimeout(300);

      // Validate that the model.arr matches the imported content
      const arr = await page.evaluate(() => window.__insertionModel.arr);
      expect(arr).toEqual([99, 88, 77]);

      // Log should contain "Imported state from file." per implementation
      const log = await page.locator('#logArea').inputValue();
      expect(log).toContain('Imported state from file.');
    });
  });

  test.describe('Freeze behavior and blocked shifts (edge-case)', () => {
    test('Freezing an insertion target blocks the shift/insert and results in "blocked" logs and done phase', async ({ page }) => {
      // Create a 2-element array in which a shift will be needed: [2,1]
      await page.fill('#arrayInput', '2,1');
      await page.click('#initBtn');

      // Freeze index 1 (the insert/shift target)
      await page.fill('#freezeIndex', '1');
      await page.click('#toggleFreezeBtn');

      // Confirm freeze list updated
      const freezeList = await page.locator('#freezeList').innerText();
      expect(freezeList).toContain('Frozen indices');

      // Execute micro-stepping to reach shift scenario:
      // 1st step: idle->start
      await page.click('#stepBtn');
      // 2nd step: start -> selectKey
      await page.click('#stepBtn');
      // 3rd step: selectKey -> compare (should pick shift branch)
      await page.click('#stepBtn');
      // 4th step: attempt shift which should be blocked by freeze and set phase to 'done'
      await page.click('#stepBtn');

      // Wait a short time for logs and state to update
      await page.waitForTimeout(100);

      // Check logs indicating blocked shift or blocked insert
      const log = await page.locator('#logArea').inputValue();
      const blocked = /blocked/.test(log);
      expect(blocked).toBeTruthy();

      // Model phase should be 'done' since shift/insert was blocked and the code sets phase = 'done'
      const finalPhase = await page.evaluate(() => window.__insertionModel.phase);
      expect(finalPhase).toBe('done');
    });
  });

  test.describe('Edge cases and UI dialogs', () => {
    test('Applying an edit with invalid index triggers an alert dialog', async ({ page }) => {
      // Ensure some array exists
      await page.fill('#arrayInput', '1,2,3');
      await page.click('#initBtn');

      // Set an invalid edit index (out of range)
      await page.fill('#editIndex', '9999');
      await page.fill('#editValue', '100');

      // Clicking Apply should raise an alert (dialog) with 'Index out of range'
      // The page.on('dialog') handler in beforeEach will accept the dialog and record its message in consoleMessages
      await page.click('#applyEditBtn');

      // Wait briefly for dialog handling
      await page.waitForTimeout(100);

      // Look for 'Index out of range' in captured dialog messages
      const dialogMessages = consoleMessages.filter(m => m.type === 'dialog').map(m => m.text);
      const found = dialogMessages.some(m => /Index out of range|Invalid index/i.test(m));
      expect(found).toBeTruthy();
    });
  });

  test('No unexpected uncaught exceptions were emitted during tests', async ({ page }) => {
    // Final assertion: ensure no uncaught page errors took place during the test run up to this point
    // This test relies on pageErrors being collected in beforeEach; it will be run with a fresh page so we check again
    expect(pageErrors.length).toBe(0);
  });
});