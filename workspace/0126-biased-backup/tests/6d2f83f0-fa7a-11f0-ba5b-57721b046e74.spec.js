import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2f83f0-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object encapsulating interactions and common selectors
class SlidingWindowPage {
  constructor(page) {
    this.page = page;
    // Controls
    this.arraySize = page.locator('#arraySize');
    this.arraySizeValue = page.locator('#arraySizeValue');
    this.minValue = page.locator('#minValue');
    this.maxValue = page.locator('#maxValue');
    this.generateArrayBtn = page.locator('#generateArray');
    this.manualEditBtn = page.locator('#manualEdit');
    this.manualEditContainer = page.locator('#manualEditContainer');
    this.manualArrayInput = page.locator('#manualArrayInput');
    this.applyManualArrayBtn = page.locator('#applyManualArray');

    this.windowSize = page.locator('#windowSize');
    this.windowSizeValue = page.locator('#windowSizeValue');
    this.operation = page.locator('#operation');
    this.runAlgorithmBtn = page.locator('#runAlgorithm');
    this.stepForwardBtn = page.locator('#stepForward');
    this.resetBtn = page.locator('#reset');

    // Displays
    this.arrayDisplay = page.locator('#arrayDisplay');
    this.windowContainer = page.locator('#windowContainer');
    this.resultDisplay = page.locator('#resultDisplay');
    this.currentWindow = page.locator('#currentWindow');
    this.currentResult = page.locator('#currentResult');
    this.finalResults = page.locator('#finalResults');
    this.executionLog = page.locator('#executionLog');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getArrayAsNumbers() {
    const text = (await this.arrayDisplay.textContent()) || '';
    if (text.trim() === '') return [];
    return text.trim().split(/\s+/).map(s => parseFloat(s));
  }

  async clickGenerateArray() {
    await this.generateArrayBtn.click();
  }

  async toggleManualEdit() {
    await this.manualEditBtn.click();
  }

  async applyManualArray(input) {
    await this.manualArrayInput.fill(input);
    await this.applyManualArrayBtn.click();
  }

  async setWindowSize(value) {
    // Use evaluate to set the input value and dispatch input event for the page code to react
    await this.page.evaluate((v) => {
      const el = document.getElementById('windowSize');
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async setArraySize(value) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('arraySize');
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async changeOperation(value) {
    await this.operation.selectOption(value);
    // dispatch change so event handler runs
    await this.page.evaluate(() => {
      document.getElementById('operation').dispatchEvent(new Event('change', { bubbles: true }));
    });
  }

  async clickRunAlgorithm() {
    await this.runAlgorithmBtn.click();
  }

  async clickStepForward() {
    await this.stepForwardBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getExecutionLogText() {
    return (await this.executionLog.textContent()) || '';
  }

  async getCurrentWindowText() {
    return (await this.currentWindow.textContent()) || '';
  }

  async getCurrentResultText() {
    return (await this.currentResult.textContent()) || '';
  }

  async getFinalResultsText() {
    return (await this.finalResults.textContent()) || '';
  }

  async isManualEditVisible() {
    return (await this.manualEditContainer.evaluate((el) => {
      return window.getComputedStyle(el).display !== 'none';
    }));
  }

  async getWindowHighlightCount() {
    return await this.windowContainer.locator('.window-highlight').count();
  }
}

test.describe('Sliding Window Interactive Demo - FSM and UI tests', () => {
  let page;
  let app;
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Collect console errors and page errors to assert later
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      // pageerror is an Error object; capture name/message
      pageErrors.push({ name: err.name, message: err.message });
    });

    app = new SlidingWindowPage(page);
    await app.goto();

    // Ensure the page loaded and initial generation completed
    await expect(app.arrayDisplay).toBeVisible();
  });

  test.afterEach(async () => {
    // Assert that we did not encounter unexpected runtime errors
    // We expect zero uncaught page errors and zero console.error messages
    // These assertions validate that the page script executed without throwing ReferenceError/SyntaxError/TypeError
    expect(pageErrors.length, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);

    await page.close();
  });

  test.describe('State S0_Idle and S1_ArrayGenerated (initialization)', () => {
    test('Initial load should generate an array and display it (S0 -> S1)', async () => {
      // On initial load, generateArray() is called by script.
      // Verify array display is populated and matches arraySize value
      const sizeText = await app.arraySizeValue.textContent();
      const size = parseInt(sizeText || '0', 10);
      const arr = await app.getArrayAsNumbers();

      // Array must have been generated and have the expected size
      expect(arr.length, 'Array length should equal selected arraySize').toBe(size);

      // The execution log should be empty after reset triggered by generateArray
      const log = await app.getExecutionLogText();
      expect(log.trim()).toBe('');
    });

    test('Clicking Generate New Array should produce an array of the selected size', async () => {
      // Set array size to a known value, then click generate
      await app.setArraySize(7);
      await app.clickGenerateArray();

      const sizeText = await app.arraySizeValue.textContent();
      expect(parseInt(sizeText || '0', 10)).toBe(7);

      const arr = await app.getArrayAsNumbers();
      expect(arr.length).toBe(7);
    });
  });

  test.describe('Manual Edit - S2_ManualEdit transitions', () => {
    test('Toggling manual edit displays the manual edit container and pre-fills input', async () => {
      // Open manual edit
      await app.toggleManualEdit();

      // Manual edit container should be visible
      expect(await app.isManualEditVisible()).toBe(true);

      // The input should be pre-filled with the current array content
      const manualValue = await app.manualArrayInput.inputValue();
      const arr = await app.getArrayAsNumbers();
      const expectedPrefill = arr.join(', ');
      // Allow either comma-separated or space-separated prefill, code sets with join(', ')
      expect(manualValue.includes(String(arr[0]))).toBe(true);
    });

    test('Applying a manual array updates the displayed array and resets state', async () => {
      // Toggle to show manual edit and apply a new array
      await app.toggleManualEdit();
      expect(await app.isManualEditVisible()).toBe(true);

      const manual = '5, 10, 15, 20';
      await app.applyManualArray(manual);

      // Manual editor should be hidden after applying
      expect(await app.isManualEditVisible()).toBe(false);

      // Array display should reflect the manual values (space-separated)
      const arr = await app.getArrayAsNumbers();
      expect(arr).toEqual([5, 10, 15, 20]);

      // After applying manual array, reset() is called by applyManualArray()
      // Current window/result/final results should be in reset state
      expect(await app.getCurrentWindowText()).toBe('[]');
      expect(await app.getCurrentResultText()).toBe('-');
      expect(await app.getFinalResultsText()).toBe('[]');
    });

    test('Applying invalid manual input should not throw (edge case)', async () => {
      // Provide malformed input; the page code attempts parse and catches exceptions
      await app.toggleManualEdit();
      // Provide text that leads to NaN entries but does not throw
      const invalid = 'a, b, c';
      await app.applyManualArray(invalid);

      // The arrayDisplay will contain NaN entries; ensure array parsing produced entries (NaN allowed)
      const arr = await app.getArrayAsNumbers();
      expect(arr.length).toBeGreaterThan(0);
      // Values likely are NaN; verify that at least parsing attempted (we have entries)
    });
  });

  test.describe('Algorithm Running (S3) and Completion (S4) - run, step, reset transitions', () => {
    test('Clicking Run Sliding Window runs entire algorithm and logs start/completion', async () => {
      // Set a deterministic manual array so results are predictable
      await app.toggleManualEdit();
      await app.applyManualArray('1,2,3,4,5'); // length 5

      // Set window size to 3
      await app.setWindowSize(3);

      // Choose operation 'sum' to have predictable numeric results
      await app.changeOperation('sum');

      // Run algorithm (this runs synchronously in the page script)
      await app.clickRunAlgorithm();

      const logText = await app.getExecutionLogText();
      expect(logText).toContain('Algorithm started...');
      expect(logText).toContain('Algorithm completed.');

      // Final results should contain (5 - 3 + 1) = 3 entries for window size 3
      const finalResults = await app.getFinalResultsText();
      // finalResults text like: [6, 9, 12] for sums of windows [1,2,3]=6, [2,3,4]=9,[3,4,5]=12
      const resultsArray = finalResults.replace(/[\[\]\s]/g, '').split(',').filter(Boolean);
      expect(resultsArray.length).toBe(3);
      expect(resultsArray[0]).toBe('6'); // check the first sum
      expect(await app.page.evaluate(() => isRunning)).toBe(false); // on exit isRunning should be false
    });

    test('Step Forward advances one window and updates displays', async () => {
      // Apply a small manual array for determinism
      await app.toggleManualEdit();
      await app.applyManualArray('2,4,6,8'); // length 4

      // Window size 2
      await app.setWindowSize(2);
      await app.changeOperation('max');

      // Ensure starting reset state
      expect(await app.getCurrentWindowText()).toBe('[]');
      expect(await app.getFinalResultsText()).toBe('[]');

      // Click step forward once
      await app.clickStepForward();

      // Current window should reflect first two elements
      const currentWindow = await app.getCurrentWindowText();
      expect(currentWindow).toBe('[2, 4]');

      // Current result should reflect max of [2,4] => 4
      expect(await app.getCurrentResultText()).toBe('4');

      // Final results should contain exactly one entry
      expect(await app.getFinalResultsText()).toBe('[4]');

      // Window highlight should exist after stepping forward
      expect(await app.getWindowHighlightCount()).toBe(1);
    });

    test('Reset during "running" state clears state variables and UI (S3 -> S4 or S4 -> S0)', async () => {
      // Simulate mid-run by performing one step forward, then trigger reset
      await app.toggleManualEdit();
      await app.applyManualArray('3,6,9'); // length 3
      await app.setWindowSize(2);
      await app.changeOperation('sum');

      // Step forward once to create some state
      await app.clickStepForward();

      // Confirm there is at least one result now
      expect(await app.getFinalResultsText()).not.toBe('[]');

      // Now click reset to simulate ResetClick transition
      await app.clickReset();

      // After reset, state variables and displays should be cleared
      expect(await app.getCurrentWindowText()).toBe('[]');
      expect(await app.getCurrentResultText()).toBe('-');
      expect(await app.getFinalResultsText()).toBe('[]');
      expect(await app.getExecutionLogText()).toBe('');
      expect(await app.page.evaluate(() => currentPosition)).toBe(0);
      expect(await app.page.evaluate(() => results.length)).toBe(0);
      expect(await app.page.evaluate(() => isRunning)).toBe(false);
    });

    test('Changing operation updates subsequent step computations (edge-case coverage)', async () => {
      // Manual array [1,2,3,4], window size 2
      await app.toggleManualEdit();
      await app.applyManualArray('1,2,3,4');
      await app.setWindowSize(2);

      // Step forward with operation 'max' first
      await app.changeOperation('max');
      await app.clickStepForward();
      expect(await app.getCurrentResultText()).toBe('2'); // max of [1,2]

      // Change operation to 'sum' and step forward again (should compute sum of [2,3])
      await app.changeOperation('sum');
      await app.clickStepForward();
      expect(await app.getCurrentResultText()).toBe('5');

      // Final results should reflect both entries
      const fr = await app.getFinalResultsText();
      expect(fr).toContain('2');
      expect(fr).toContain('5');
    });
  });

  test.describe('Edge cases: window size bounds and DOM behaviors', () => {
    test('Window size slider max adjusts based on array length on reset', async () => {
      // Apply a small manual array
      await app.toggleManualEdit();
      await app.applyManualArray('7,8,9'); // length 3

      // Attempt to set window size to a larger value than array length
      // Because reset() adjusts the max, setting to 10 should be clamped to length 3
      await app.setWindowSize(10);

      // windowSizeValue should reflect the maxPossibleWindowSize (3)
      const wsVal = await app.windowSizeValue.textContent();
      expect(parseInt(wsVal || '0', 10)).toBe(3);
    });

    test('Window highlight positions correspond roughly to currentPosition and windowSize (visual feedback)', async () => {
      // Use a known array and window size
      await app.toggleManualEdit();
      await app.applyManualArray('1,2,3,4,5');
      await app.setWindowSize(2);

      // Step forward twice
      await app.clickStepForward(); // position 0 -> 1
      await app.clickStepForward(); // position 1 -> 2

      // There should be a window-highlight element present
      const highlightCount = await app.getWindowHighlightCount();
      expect(highlightCount).toBe(1);

      // Check that currentWindow matches the slice for position 2-1 = 1 (since currentPosition increments after step)
      // After two steps, currentPosition is 2, but displayed window was for position 1 (the latest)
      const currentWindow = await app.getCurrentWindowText();
      // Should equal the second window: [2, 3]
      expect(currentWindow).toBe('[2, 3]');
    });
  });
});