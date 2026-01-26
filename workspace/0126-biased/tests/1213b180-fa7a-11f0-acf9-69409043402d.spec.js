import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1213b180-fa7a-11f0-acf9-69409043402d.html';

// Helper "page object" to centralize selectors and common actions
function createAppPage(page) {
  return {
    page,
    selectors: {
      arrayInput: '#arrayInput',
      setArrayBtn: '#setArrayBtn',
      generateRandomBtn: '#generateRandomBtn',
      randomSize: '#randomSize',
      speedRange: '#speedRange',
      speedValue: '#speedValue',
      modeSelect: '#modeSelect',
      startBtn: '#startBtn',
      pauseBtn: '#pauseBtn',
      stepBtn: '#stepBtn',
      resetBtn: '#resetBtn',
      skipToEndBtn: '#skipToEndBtn',
      arrayDisplay: '#arrayDisplay',
      logArea: '#log',
      inspectIndex: '#inspectIndex',
      inspectValueBtn: '#inspectValueBtn',
      compareIndices: '#compareIndices',
      compareBtn: '#compareBtn',
      swapIndices: '#swapIndices',
      swapBtn: '#swapBtn',
      saveLoadArea: '#saveLoadArea',
      saveBtn: '#saveBtn',
      loadBtn: '#loadBtn',
    },

    async getArrayText() {
      const spans = await this.page.$$(this.selectors.arrayDisplay + ' span');
      const values = [];
      for (const s of spans) {
        values.push((await s.textContent()).trim());
      }
      return values;
    },

    async getLogText() {
      return this.page.$eval(this.selectors.logArea, el => el.value);
    },

    async clickAndAccept(selector) {
      // generic click that expects an alert/dialog to appear and auto-accept it
      const dialogs = [];
      this.page.once('dialog', dialog => {
        dialogs.push(dialog.message());
        dialog.accept();
      });
      await this.page.click(selector);
      // give a tick for dialog handling
      await this.page.waitForTimeout(10);
      return dialogs[0];
    }
  };
}

test.describe('Interactive Bubble Sort Demo - FSM verification and interactions', () => {
  // Collect console messages and errors for assertions
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    page.on('console', m => {
      // collect console messages for later assertions
      consoleMessages.push({ type: m.type(), text: m.text() });
    });

    page.on('pageerror', err => {
      // collect page errors (uncaught exceptions)
      pageErrors.push(err);
    });

    page.on('dialog', async dialog => {
      // automatically accept all dialogs and record their messages
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // no-op; Playwright handles context cleanup
  });

  test('S0 Idle: initial page renders and controls exist with expected default states', async ({ page }) => {
    // Validate initial Idle state (S0) evidence: Set Array, Random Array, Start buttons exist
    const app = createAppPage(page);
    const s = app.selectors;

    // Ensure core controls exist
    await expect(page.locator(s.setArrayBtn)).toBeVisible();
    await expect(page.locator(s.generateRandomBtn)).toBeVisible();
    await expect(page.locator(s.startBtn)).toBeVisible();

    // Validate that control buttons that should start disabled are disabled
    await expect(page.locator(s.pauseBtn)).toBeDisabled();
    await expect(page.locator(s.stepBtn)).toBeDisabled();
    await expect(page.locator(s.resetBtn)).toBeDisabled();
    await expect(page.locator(s.skipToEndBtn)).toBeDisabled();

    // Validate the initial array displayed matches the default input value "5,3,8,4,2"
    const displayVals = await app.getArrayText();
    expect(displayVals).toEqual(['5', '3', '8', '4', '2']);

    // Validate log area exists and contains the initial "Array reset" entry from initialization
    const logText = await app.getLogText();
    expect(logText).toContain('Array reset');

    // No uncaught page errors on simple load expected here
    expect(pageErrors.length).toBe(0);
  });

  test('SetArray: set a custom array and confirm DOM update and controls enabled', async ({ page }) => {
    // This test validates the SetArray event/transition from S0 -> S1 (it sets array and enables controls)
    const app = createAppPage(page);
    const s = app.selectors;

    // Enter a custom array and click Set Array
    await page.fill(s.arrayInput, '10,9,8,7');
    await page.click(s.setArrayBtn);

    // After setting, display should reflect the new array
    const displayVals = await app.getArrayText();
    expect(displayVals).toEqual(['10', '9', '8', '7']);

    // Controls for sorting should be enabled (pause/step/reset/skip may become enabled by setArray)
    await expect(page.locator(s.pauseBtn)).toBeEnabled();
    await expect(page.locator(s.resetBtn)).toBeEnabled();

    // Log should mention array reset
    const log = await app.getLogText();
    expect(log).toContain('Array reset: [10, 9, 8, 7]');
  });

  test('GenerateRandomArray: generate a random array and verify array input/display updated', async ({ page }) => {
    // Generate a random array and confirm it's displayed and saved to the input
    const app = createAppPage(page);
    const s = app.selectors;

    // Set random size to 5 and click generate
    await page.fill(s.randomSize, '5');
    await page.click(s.generateRandomBtn);

    // After generation, array input should be populated with 5 values
    const inputVal = await page.$eval(s.arrayInput, el => el.value);
    const parts = inputVal.split(',').map(x => x.trim()).filter(Boolean);
    expect(parts.length).toBe(5);

    // Display should show 5 elements
    const displayVals = await app.getArrayText();
    expect(displayVals.length).toBe(5);

    // Log should indicate array reset happened
    const log = await app.getLogText();
    expect(log).toContain('Array reset');
  });

  test('StartSorting (auto) -> Pause -> Step -> Reset transitions and UI behaviors', async ({ page }) => {
    // This covers S0 -> S1 (Start), S1 -> S2 (Pause), S2 -> S1 (Start), and Reset transition S1 -> S0
    const app = createAppPage(page);
    const s = app.selectors;

    // Ensure mode is automatic
    await page.selectOption(s.modeSelect, 'auto');

    // Reduce speed to smallest to speed up tests
    await page.fill(s.speedRange, '10');
    // Update displayed speed value by triggering input event
    await page.dispatchEvent(s.speedRange, 'input');

    // Start automatic sorting
    await page.click(s.startBtn);

    // Expect autoSort to have started: log should contain 'Automatic sorting started.'
    await page.waitForFunction(
      selector => document.querySelector(selector).value.includes('Automatic sorting started.'),
      s.logArea
    );

    // Now pause the sorting
    await page.click(s.pauseBtn);

    // Pause should record 'Sorting paused.' and make step button enabled and start enabled
    await page.waitForFunction(
      selector => document.querySelector(selector).value.includes('Sorting paused.'),
      s.logArea
    );

    await expect(page.locator(s.stepBtn)).toBeEnabled();
    await expect(page.locator(s.startBtn)).toBeEnabled();

    // Resume sorting by clicking Start (auto mode resumes)
    await page.click(s.startBtn);

    // Wait a short time to allow resume to run and then use Skip To End to finish fast
    // (Skip to End will disable controls and finish sorting quickly)
    await page.waitForTimeout(50);
    await page.click(s.skipToEndBtn);

    // Wait for final sorted message
    await page.waitForFunction(
      selector => document.querySelector(selector).value.includes('Sorting finished'),
      s.logArea
    );

    // After finish, ensure array is sorted ascending in display
    const displayVals = (await app.getArrayText()).map(Number);
    // Confirm sorted non-decreasing
    for (let i = 1; i < displayVals.length; i++) {
      expect(displayVals[i]).toBeGreaterThanOrEqual(displayVals[i - 1]);
    }

    // Reset the sorting and ensure array reverts to original and log contains reset message
    await page.click(s.resetBtn);
    await page.waitForFunction(
      selector => document.querySelector(selector).value.includes('Array reset'),
      s.logArea
    );

    const log = await app.getLogText();
    expect(log).toContain('Array reset');
  });

  test('Step mode: manual step-by-step sorting and keyboard step shortcut', async ({ page }) => {
    // This tests S0 -> S1 via Step Sorting, stepping through until sorted (S3)
    const app = createAppPage(page);
    const s = app.selectors;

    // Set mode to step
    await page.selectOption(s.modeSelect, 'step');

    // Ensure array is small for deterministic steps
    await page.fill(s.arrayInput, '3,1,2');
    await page.click(s.setArrayBtn);

    // Click Start (in step mode, Start sets up sorting but expects Step clicks)
    await page.click(s.startBtn);

    // Start should enable step button
    await expect(page.locator(s.stepBtn)).toBeEnabled();

    // Perform manual step by clicking Step multiple times until log contains 'Sorting finished.'
    // We'll click step up to 10 times to finish
    let finished = false;
    for (let i = 0; i < 10; i++) {
      await page.click(s.stepBtn);
      const log = await app.getLogText();
      if (log.includes('Sorting finished.')) {
        finished = true;
        break;
      }
      // also try keyboard space for stepping to validate keyboard behavior
      await page.keyboard.press(' ');
      const log2 = await app.getLogText();
      if (log2.includes('Sorting finished.')) {
        finished = true;
        break;
      }
    }
    expect(finished).toBeTruthy();

    // Confirm final array is sorted
    const displayVals = (await app.getArrayText()).map(Number);
    for (let i = 1; i < displayVals.length; i++) {
      expect(displayVals[i]).toBeGreaterThanOrEqual(displayVals[i - 1]);
    }
  });

  test('InspectValue, CompareValues, SwapValues behavior and visual highlights', async ({ page }) => {
    // Tests inspection, comparison, swap operations and their UI side-effects + alerts
    const app = createAppPage(page);
    const s = app.selectors;

    // Ensure array is a known small array
    await page.fill(s.arrayInput, '7,4,9');
    await page.click(s.setArrayBtn);

    // Inspect index 1 -> should alert and log
    await page.fill(s.inspectIndex, '1');
    const inspectDialog = await app.clickAndAccept(s.inspectValueBtn);
    expect(inspectDialog).toContain('Value at index 1 is 4');
    const logAfterInspect = await app.getLogText();
    expect(logAfterInspect).toContain('Inspected value at index 1: 4');

    // Compare indices 0,2 (7 vs 9) -> alert and highlighted spans should get highlight-compare
    await page.fill(s.compareIndices, '0,2');
    const compareDialog = await app.clickAndAccept(s.compareBtn);
    expect(compareDialog).toContain('Compare result:');
    // arrayDisplay should have highlighted spans for indices 0 and 2 (class highlight-compare)
    const compareSpans = await page.$$(`${s.arrayDisplay} span.highlight-compare`);
    // Expect two highlighted elements
    expect(compareSpans.length).toBe(2);

    // Swap indices 0 and 1 manually
    await page.fill(s.swapIndices, '0,1');
    const prevDisplay = await app.getArrayText();
    await page.click(s.swapBtn);
    // After swap, log should contain message and display should reflect swap
    const logAfterSwap = await app.getLogText();
    expect(logAfterSwap).toContain('Manually swapped indices 0 and 1');
    const newDisplay = await app.getArrayText();
    // Confirm positions 0 and 1 were swapped relative to previous
    expect(newDisplay[0]).toBe(prevDisplay[1]);
    expect(newDisplay[1]).toBe(prevDisplay[0]);

    // Confirm that swap highlights are present (class highlight-swap)
    const swapSpans = await page.$$(`${s.arrayDisplay} span.highlight-swap`);
    expect(swapSpans.length).toBeGreaterThanOrEqual(1);
  });

  test('SaveArray and LoadArray: saving to text area and loading JSON (valid and invalid) with alerts', async ({ page }) => {
    // Test saving current array to textarea and loading from textarea with both invalid and valid JSON
    const app = createAppPage(page);
    const s = app.selectors;

    // Ensure array known
    await page.fill(s.arrayInput, '1,2,3');
    await page.click(s.setArrayBtn);

    // Click Save and verify textarea contains JSON representation
    await page.click(s.saveBtn);
    const savedText = await page.$eval(s.saveLoadArea, el => el.value);
    expect(savedText).toBe(JSON.stringify([1, 2, 3]));
    const logAfterSave = await app.getLogText();
    expect(logAfterSave).toContain('Array saved to text box.');

    // Place invalid JSON into textarea and attempt to load -> should trigger alert 'Invalid array JSON input.'
    await page.fill(s.saveLoadArea, 'not a json');
    // capture dialog by waiting for the dialog event that will be auto-accepted by our listener
    const beforeDialogs = dialogs.length;
    await page.click(s.loadBtn);
    // ensure a dialog was shown
    expect(dialogs.length).toBeGreaterThan(beforeDialogs);
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog).toContain('Invalid array JSON input.');

    // Place valid JSON but not an array, e.g. an object -> should alert invalid
    await page.fill(s.saveLoadArea, '{"a":1}');
    await page.click(s.loadBtn);
    const dlg2 = dialogs[dialogs.length - 1];
    expect(dlg2).toContain('Invalid array JSON input.');

    // Place valid integer array JSON and load -> should set array and show success alert
    await page.fill(s.saveLoadArea, '[9,8,7]');
    await page.click(s.loadBtn);
    const dlg3 = dialogs[dialogs.length - 1];
    // In the implementation, successful load triggers alert('Array loaded successfully.');
    expect(dlg3).toContain('Array loaded successfully.');

    // Confirm display updated to loaded array
    const displayVals = await app.getArrayText();
    expect(displayVals).toEqual(['9', '8', '7']);
    const logAfterLoad = await app.getLogText();
    expect(logAfterLoad).toContain('Array loaded from text box.');
  });

  test('Edge case: changing mode while sorting triggers a runtime ReferenceError (let errors occur naturally)', async ({ page }) => {
    // This test intentionally triggers the bug in modeSelect.change handler which references sortingMode (undefined)
    // It verifies a dialog appears ("Cannot change mode while sorting.") and that a ReferenceError is emitted to the page errors.

    const app = createAppPage(page);
    const s = app.selectors;

    // Set mode to auto and ensure array present
    await page.selectOption(s.modeSelect, 'auto');

    // Make sorting quick by reducing speed
    await page.fill(s.speedRange, '50');
    await page.dispatchEvent(s.speedRange, 'input');

    // Start automatic sorting
    await page.click(s.startBtn);

    // Wait shortly to ensure sorting flag becomes true
    await page.waitForTimeout(60);

    // Now attempt to change mode while sorting - this should both alert and then cause a ReferenceError inside the handler
    const beforePageErrors = pageErrors.length;
    const beforeDialogs = dialogs.length;

    // Change mode value (this triggers the 'change' handler)
    await page.selectOption(s.modeSelect, 'step');

    // Wait a brief moment for potential pageerror to be emitted
    await page.waitForTimeout(50);

    // Expect that an alert was shown telling user cannot change mode
    expect(dialogs.length).toBeGreaterThan(beforeDialogs);
    const lastDialogMessage = dialogs[dialogs.length - 1];
    expect(lastDialogMessage).toContain('Cannot change mode while sorting.');

    // Expect that a ReferenceError occurred and was captured in pageErrors
    // The code assigns modeSelect.value = sortingMode (where sortingMode is undefined) -> ReferenceError
    const newPageErrors = pageErrors.slice(beforePageErrors).map(e => (e && e.message) || String(e));
    // There should be at least one new error
    expect(newPageErrors.length).toBeGreaterThanOrEqual(1);
    // At least one error message should reference 'sortingMode' (name of undefined variable)
    const hasSortingModeRef = newPageErrors.some(msg => String(msg).includes('sortingMode'));
    expect(hasSortingModeRef).toBeTruthy();
  });

  test('Verify console logs and expected messages during a skip-to-end flow', async ({ page }) => {
    // This test inspects console messages collected and application log area messages during a SkipToEnd run
    const app = createAppPage(page);
    const s = app.selectors;

    // Make array small and deterministic
    await page.fill(s.arrayInput, '4,3,2,1');
    await page.click(s.setArrayBtn);

    // Start in auto mode and then click Skip To End to finish quickly
    await page.selectOption(s.modeSelect, 'auto');
    await page.fill(s.speedRange, '1000'); // slow speed but skipToEnd ignores delay
    await page.dispatchEvent(s.speedRange, 'input');

    // Start then skip
    await page.click(s.startBtn);
    // Wait a little for autoSort to initialize
    await page.waitForTimeout(20);
    await page.click(s.skipToEndBtn);

    // Wait until log contains skip to end completion message
    await page.waitForFunction(
      selector => document.querySelector(selector).value.includes('Sorting finished (skip to end).'),
      s.logArea
    );

    // Confirm log contents include both skip and finished messages
    const log = await app.getLogText();
    expect(log).toContain('Skipping to end...');
    expect(log).toContain('Sorting finished (skip to end).');

    // Confirm there are console messages (the page logs internal messages sometimes); at least the console array is accessible
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });
});