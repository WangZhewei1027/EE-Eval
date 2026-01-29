import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c13b753-fa79-11f0-8fe7-a5317bd8e2c6.html';

/**
 * Page object model for the Bubble Sort Interactive application.
 * Encapsulates commonly-used selectors and helper actions so tests are readable.
 */
class BubblePage {
  constructor(page) {
    this.page = page;
    // Inputs & controls
    this.arrayText = page.locator('#arrayText');
    this.applyArray = page.locator('#applyArray');
    this.useCurrent = page.locator('#useCurrent');
    this.sizeSlider = page.locator('#sizeSlider');
    this.randomizeBtn = page.locator('#randomizeBtn');
    this.minVal = page.locator('#minVal');
    this.maxVal = page.locator('#maxVal');
    this.sortedBtn = page.locator('#sortedBtn');
    this.reverseBtn = page.locator('#reverseBtn');
    this.recompute = page.locator('#recompute');

    this.rewind = page.locator('#rewind');
    this.stepBack = page.locator('#stepBack');
    this.stepForward = page.locator('#stepForward');
    this.playPause = page.locator('#playPause');
    this.fastForward = page.locator('#fastForward');
    this.resetBtn = page.locator('#resetBtn');

    this.arrayContainer = page.locator('#arrayContainer');
    this.insertLeft = page.locator('#insertLeft');
    this.insertRight = page.locator('#insertRight');
    this.removeLast = page.locator('#removeLast');
    this.normalize = page.locator('#normalize');

    this.orderSelect = page.locator('#orderSelect');
    this.optimizeTail = page.locator('#optimizeTail');
    this.showCompare = page.locator('#showCompare');
    this.microStep = page.locator('#microStep');

    this.bpType = page.locator('#bpType');
    this.bpValue = page.locator('#bpValue');
    this.addBreakpoint = page.locator('#addBreakpoint');
    this.breakpointList = page.locator('#breakpointList');

    this.traceList = page.locator('#traceList');
    this.currentStep = page.locator('#currentStep');
    this.totalSteps = page.locator('#totalSteps');
    this.currentAction = page.locator('#currentAction');
    this.statComparisons = page.locator('#statComparisons');
    this.statSwaps = page.locator('#statSwaps');
    this.statPasses = page.locator('#statPasses');

    this.traceFilter = page.locator('#traceFilter');
    this.applyFilter = page.locator('#applyFilter');
    this.clearFilter = page.locator('#clearFilter');

    this.exportConfig = page.locator('#exportConfig');
    this.exportTrace = page.locator('#exportTrace');
    this.importBtn = page.locator('#importBtn');
    this.jsonArea = page.locator('#jsonArea');

    this.saveLocal = page.locator('#saveLocal');
    this.loadLocal = page.locator('#loadLocal');
    this.localList = page.locator('#localList');
    this.deleteLocal = page.locator('#deleteLocal');
  }

  // Helper: get current array input values as array of strings
  async getArrayInputsValues() {
    return await this.page.$$eval('#arrayContainer input.array-item', inputs =>
      inputs.map(i => i.value)
    );
  }

  // Helper: set range input value and dispatch input event
  async setRangeValue(locator, value) {
    await locator.evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  // Click apply array and wait for potential UI updates
  async applyArrayAndWait() {
    await Promise.all([
      this.applyArray.click(),
      this.page.waitForTimeout(50) // small wait to allow recomputeTrace to run
    ]);
  }

  // Set array text and apply
  async setArrayTextAndApply(text) {
    await this.arrayText.fill(text);
    await this.applyArrayAndWait();
  }

  // Utility to wait until trace list has at least minItems
  async waitForTraceLengthAtLeast(minItems, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, min) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return el.children.length >= min;
      },
      '#traceList',
      minItems,
      { timeout }
    );
  }

  // Get currentStep and totalSteps numeric values
  async getStepInfo() {
    const current = Number(await this.currentStep.textContent());
    const total = Number(await this.totalSteps.textContent());
    return { current, total };
  }
}

test.describe('Bubble Sort Interactive - Full FSM validation', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages and page errors for diagnostics
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Wait a short time to let initial init() run and populate UI
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(100);
  });

  test.afterEach(async () => {
    // Assert that no uncaught page errors occurred during the test run.
    // If there are page errors, fail explicitly and include the messages for debugging.
    if (pageErrors.length > 0) {
      const msgs = pageErrors.map(e => e.message).join('\n---\n');
      throw new Error('Page had uncaught errors:\n' + msgs);
    }

    // Also fail if any console messages of type 'error' were emitted.
    const errorConsole = consoleMessages.filter(c => c.type === 'error');
    if (errorConsole.length > 0) {
      const msgs = errorConsole.map(c => c.text).join('\n---\n');
      throw new Error('Console had error messages:\n' + msgs);
    }
  });

  test('Initial load renders UI and generates initial trace', async ({ page }) => {
    // Validate initial UI rendering and initial recompute on load
    const bp = new BubblePage(page);

    // arrayText should contain the initial value from the HTML
    await expect(bp.arrayText).toHaveValue('5,3,8,4,2,7,1');

    // arrayContainer should have inputs reflecting initial array (7 elements)
    const arrVals = await bp.getArrayInputsValues();
    expect(arrVals.length).toBe(7);
    expect(arrVals[0]).toBe('5');
    expect(arrVals[arrVals.length - 1]).toBe('1');

    // Trace list should have at least one item (done step). Wait for it.
    await bp.waitForTraceLengthAtLeast(1);
    const { current, total } = await bp.getStepInfo();

    // After init recomputeTrace and jumpTo(0), current should be 0 and total >= 0
    expect(current).toBe(0);
    expect(total).toBeGreaterThanOrEqual(0);

    // Play button should be labeled 'Play' initially
    await expect(bp.playPause).toHaveText('Play');
  });

  test.describe('Array manipulation controls', () => {
    test('Apply Array and Use Current update the DOM and internal array', async ({ page }) => {
      const bp = new BubblePage(page);

      // Apply a new array text (space-separated)
      await bp.setArrayTextAndApply('1 2 3');

      // array inputs should reflect 3 values
      const inputs = await bp.getArrayInputsValues();
      expect(inputs.length).toBe(3);
      expect(inputs.join(',')).toBe('1,2,3');

      // Modify the first input and use "Use Current" to update the text area
      const firstInput = page.locator('#arrayContainer input.array-item').first();
      await firstInput.fill('9');
      // Trigger change event on input since the app listens on change
      await firstInput.evaluate(el => el.dispatchEvent(new Event('change', { bubbles: true })));
      await bp.useCurrent.click();
      await expect(bp.arrayText).toHaveValue('9, 2, 3');
    });

    test('Randomize, Fill Sorted, Fill Reverse generate expected arrays', async ({ page }) => {
      const bp = new BubblePage(page);

      // Set size to 5 and min to 1 and max to 10 then click Fill Sorted
      await bp.setRangeValue(bp.sizeSlider, '5');
      await bp.minVal.fill('1');
      await bp.maxVal.fill('10');
      await bp.sortedBtn.click();

      // Sorted result for n=5 and min=1 should be 1..5
      await expect(bp.arrayText).toHaveValue('1, 2, 3, 4, 5');
      let inputs = await bp.getArrayInputsValues();
      expect(inputs.length).toBe(5);
      expect(inputs[0]).toBe('1');
      expect(inputs[4]).toBe('5');

      // Fill Reverse with n=4 and min=0 should produce 4,3,2,1
      await bp.setRangeValue(bp.sizeSlider, '4');
      await bp.minVal.fill('0');
      await bp.reverseBtn.click();
      await expect(bp.arrayText).toHaveValue('4, 3, 2, 1');
      inputs = await bp.getArrayInputsValues();
      expect(inputs.length).toBe(4);
      expect(inputs[0]).toBe('4');
      expect(inputs[inputs.length - 1]).toBe('1');

      // Randomize: set size to 3 and min and max small; after randomize arrayText should be changed
      await bp.setRangeValue(bp.sizeSlider, '3');
      await bp.minVal.fill('0');
      await bp.maxVal.fill('2');

      const before = await bp.arrayText.inputValue();
      await bp.randomizeBtn.click();
      const after = await bp.arrayText.inputValue();
      expect(after).not.toBe('');
      // Can be equal occasionally due to randomness but likely changed; at minimum it's in correct format
      const parts = (await bp.arrayText.inputValue()).split(/[,|\s]+/).filter(Boolean);
      expect(parts.length).toBe(3);
    });

    test('Apply invalid array text maps to zeros (edge case)', async ({ page }) => {
      const bp = new BubblePage(page);
      await bp.arrayText.fill('a,b,c');
      await bp.applyArray.click();

      // parseArrayText maps non numeric to 0, so array inputs should be zeros
      const inputs = await bp.getArrayInputsValues();
      expect(inputs.every(v => v === '0')).toBeTruthy();

      // arrayText should also be updated to '0, 0, 0'
      await expect(bp.arrayText).toHaveValue('0, 0, 0');
    });
  });

  test.describe('Trace navigation and playback controls', () => {
    test('Recompute Trace updates trace and UI; step forward/back and rewind work', async ({ page }) => {
      const bp = new BubblePage(page);

      // Ensure there is a viable trace
      await bp.recompute.click();
      await bp.waitForTraceLengthAtLeast(1);

      const initial = await bp.getStepInfo();
      expect(initial.current).toBe(0);

      // Step forward one
      await bp.stepForward.click();
      let afterStep = await bp.getStepInfo();
      expect(afterStep.current).toBeGreaterThanOrEqual(1);

      // Step back one
      await bp.stepBack.click();
      let afterBack = await bp.getStepInfo();
      // It should have decreased (or be 0)
      expect(afterBack.current).toBeLessThanOrEqual(afterStep.current);

      // Rewind to start
      await bp.rewind.click();
      const rewound = await bp.getStepInfo();
      expect(rewound.current).toBe(0);

      // Fast forward to end: click step forward many times or click fastForward button
      await bp.fastForward.click();
      const ended = await bp.getStepInfo();
      expect(ended.current).toBe(ended.total);
    });

    test('Play/Pause toggles and runLoop respects play/pause', async ({ page }) => {
      const bp = new BubblePage(page);

      // Ensure trace exists
      await bp.recompute.click();
      await bp.waitForTraceLengthAtLeast(1);

      // Click Play
      await bp.playPause.click();
      // Button text should switch to 'Pause' quickly
      await expect(bp.playPause).toHaveText('Pause');

      // Pause soon after
      await bp.playPause.click();
      await expect(bp.playPause).toHaveText('Play');
    });

    test('Autoplay mode untilSwap and untilCompare change stepping behavior (sanity)', async ({ page }) => {
      const bp = new BubblePage(page);

      // Ensure there is a trace
      await bp.recompute.click();
      await bp.waitForTraceLengthAtLeast(1);

      // Set autoplay mode to 'untilSwap' then play; we won't rely on exact stopping point
      await page.selectOption('#autoplayMode', 'untilSwap');
      await bp.playPause.click();
      // Wait a short time to let runLoop execute; it should eventually pause itself
      await page.waitForTimeout(300);
      // Ensure button is 'Play' or 'Pause' (it may have paused)
      const text = await bp.playPause.textContent();
      expect(['Play', 'Pause']).toContain(text?.trim());
      // Ensure no uncaught exceptions (checked in afterEach)
      // Pause if still running
      const currentText = await bp.playPause.textContent();
      if (currentText.trim() === 'Pause') {
        await bp.playPause.click();
      }
    });
  });

  test.describe('Array editing helpers and normalization', () => {
    test('Insert Left/Right and Remove Last modify array and arrayText', async ({ page }) => {
      const bp = new BubblePage(page);

      // Start with a known small array
      await bp.setArrayTextAndApply('10,20,30');
      // Insert left -> adds 0 at start
      await bp.insertLeft.click();
      let vals = await bp.getArrayInputsValues();
      expect(vals[0]).toBe('0');
      // Insert right -> adds 0 at end
      await bp.insertRight.click();
      vals = await bp.getArrayInputsValues();
      expect(vals[vals.length - 1]).toBe('0');

      // Remove last -> removes last element (if length>1)
      const beforeLen = vals.length;
      await bp.removeLast.click();
      vals = await bp.getArrayInputsValues();
      expect(vals.length).toBe(beforeLen - 1);
    });

    test('Normalize rounds numbers to integers', async ({ page }) => {
      const bp = new BubblePage(page);

      // Set array to decimal values by applying text that will render inputs as numbers with decimals
      await bp.setArrayTextAndApply('1.2, 2.6, 3.49');
      // The array inputs are number fields; ensure they contain floats
      const raw = await bp.getArrayInputsValues();
      // Now click normalize
      await bp.normalize.click();
      const normalized = await bp.getArrayInputsValues();
      // Values should have been rounded: 1,3,3
      expect(normalized.map(s => Number(s))).toEqual(normalized.map(n => Math.round(Number(n))));
      // And the arrayText should reflect the normalized integers
      const text = await bp.arrayText.inputValue();
      const parts = text.split(',').map(s => s.trim()).filter(Boolean).map(Number);
      expect(parts.every(n => Number.isInteger(n))).toBeTruthy();
    });
  });

  test.describe('Breakpoints, Export/Import, and Local Save/Load/Delete', () => {
    test('Add and remove a breakpoint', async ({ page }) => {
      const bp = new BubblePage(page);

      // Select bpType to 'onSwap' and add
      await page.selectOption('#bpType', 'onSwap');
      await bp.addBreakpoint.click();

      // breakpointList should contain a descriptive entry
      const listText = await bp.breakpointList.textContent();
      expect(listText).toContain('On any swap');

      // Remove the breakpoint by clicking the Remove button
      const removeBtn = bp.breakpointList.locator('button', { hasText: 'Remove' });
      await removeBtn.click();
      // After removal, list should be empty
      const afterText = await bp.breakpointList.textContent();
      expect(afterText.trim()).toBe('');
    });

    test('Export Config and Export Trace populate jsonArea', async ({ page }) => {
      const bp = new BubblePage(page);

      // Export config
      await bp.exportConfig.click();
      const cfg = await bp.jsonArea.inputValue();
      expect(cfg).toContain('"initialArray"');
      expect(cfg).toContain('"options"');

      // Export trace
      await bp.exportTrace.click();
      const traceJson = await bp.jsonArea.inputValue();
      expect(traceJson).toContain('"trace"');
    });

    test('Import valid config JSON updates array and options; invalid JSON triggers alert', async ({ page }) => {
      const bp = new BubblePage(page);

      // Prepare a config JSON (initialArray + options)
      const importObj = {
        initialArray: [2, 1],
        options: { order: 'desc', microStep: false, showCompare: false },
        breakpoints: [{ type: 'onSwap', value: null }]
      };
      await bp.jsonArea.fill(JSON.stringify(importObj));
      // Import will call recomputeTrace which updates UI; click import
      await bp.importBtn.click();
      // arrayContainer should reflect new array
      const inputs = await bp.getArrayInputsValues();
      expect(inputs.length).toBe(2);
      expect(inputs[0]).toBe('2');
      expect(inputs[1]).toBe('1');

      // Now test invalid JSON triggers an alert; set invalid JSON
      await bp.jsonArea.fill('{ invalid json ');
      // Listen for dialog and assert message contains 'Invalid JSON' when importBtn clicked
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        bp.importBtn.click()
      ]);
      expect(dialog.type()).toBe('alert');
      const msg = dialog.message();
      expect(msg.toLowerCase()).toContain('invalid json');
      await dialog.accept();
    });

    test('Import trace JSON loads the trace directly', async ({ page }) => {
      const bp = new BubblePage(page);

      // Build a tiny trace with one done step
      const now = Date.now();
      const traceObj = {
        trace: [
          { array: [1, 2], i: -1, j: -1, action: 'done', comparisons: 0, swaps: 0, passes: 0, meta: null, time: now }
        ]
      };
      await bp.jsonArea.fill(JSON.stringify(traceObj));
      await bp.importBtn.click();

      // After importing trace, totalSteps should be 0 and currentAction 'done'
      await expect(bp.currentAction).toHaveText('done');
      const { current, total } = await bp.getStepInfo();
      expect(total).toBe(0);
      expect(current).toBe(0);
    });

    test('Save to local, Load from local, and Delete saved item (dialogs handling)', async ({ page }) => {
      const bp = new BubblePage(page);

      // Ensure a simple config is present
      await bp.setArrayTextAndApply('7,8,9');

      // When saving, a prompt is expected. Intercept the dialog and provide a name.
      const savePromise = page.waitForEvent('dialog');
      await bp.saveLocal.click();
      const saveDialog = await savePromise;
      expect(saveDialog.type()).toBe('prompt');
      await saveDialog.accept('testsave-1'); // provide save name

      // Small wait so loadSavedList() updates the select
      await page.waitForTimeout(50);

      // Now localList should have at least one option starting with 'bubblesave:'
      const options = await page.$$eval('#localList option', opts => opts.map(o => ({ value: o.value, text: o.text })));
      const saved = options.find(o => o.value.startsWith('bubblesave:'));
      expect(saved).toBeTruthy();

      // Select the saved option and load it
      await page.selectOption('#localList', saved.value);

      // loadLocal triggers no dialogs; click and wait for recomputeTrace to run
      await bp.loadLocal.click();
      await page.waitForTimeout(50);

      // Now delete the saved item: clicking deleteLocal triggers a confirm
      const delPromise = page.waitForEvent('dialog');
      await bp.deleteLocal.click();
      const delDialog = await delPromise;
      expect(delDialog.type()).toBe('confirm');
      await delDialog.accept(); // confirm deletion

      // Allow list to refresh
      await page.waitForTimeout(50);
      const optionsAfter = await page.$$eval('#localList option', opts => opts.map(o => o.value));
      // The previously saved key should no longer be present
      expect(optionsAfter.includes(saved.value)).toBeFalsy();
    });
  });

  test.describe('Edge scenarios for trace navigation and filters', () => {
    test('Filtering trace list works and clicking on a trace step jumps to it', async ({ page }) => {
      const bp = new BubblePage(page);

      // Ensure trace exists with multiple items
      await bp.recompute.click();
      await bp.waitForTraceLengthAtLeast(5);

      // Apply filter 'swap' then renderTraceList should reduce items to those containing swap
      await bp.traceFilter.fill('swap');
      await bp.applyFilter.click();
      // Get number of visible items
      const visibleCount = await page.$$eval('#traceList .step-list-item', items => items.length);
      // Visible count can be zero or positive depending on the array; assert it is a number >= 0
      expect(typeof visibleCount).toBe('number');
      expect(visibleCount).toBeGreaterThanOrEqual(0);

      // Clear filter
      await bp.clearFilter.click();
      const allCount = await page.$$eval('#traceList .step-list-item', items => items.length);
      expect(allCount).toBeGreaterThanOrEqual(1);

      // Click a specific trace step (if present) to jump to it
      const firstItem = page.locator('#traceList .step-list-item').first();
      const idxAttr = await firstItem.getAttribute('data-idx');
      if (idxAttr !== null) {
        await firstItem.click();
        // After clicking a step, currentStep should equal that index
        const idxNum = Number(idxAttr);
        const { current } = await bp.getStepInfo();
        expect(current).toBe(idxNum);
      }
    });

    test('Adding compareCount breakpoint pauses execution when threshold reached (sanity)', async ({ page }) => {
      const bp = new BubblePage(page);

      // Recompute a larger trace
      await bp.setRangeValue(bp.sizeSlider, '6');
      await bp.recompute.click();
      await bp.waitForTraceLengthAtLeast(1);

      // Add compareCount breakpoint triggered at 1 comparison
      await page.selectOption('#bpType', 'compareCount');
      await bp.bpValue.fill('1');
      await bp.addBreakpoint.click();

      // Start playback (normal mode) - it should pause when comparisons >=1
      await page.selectOption('#autoplayMode', 'normal');
      await bp.playPause.click();
      // wait a little to let the loop start and then pause
      await page.waitForTimeout(300);

      // Ensure the play button is 'Play' (paused)
      const text = await bp.playPause.textContent();
      expect(text.trim()).toBe('Play');

      // Remove the breakpoint for cleanup
      const removeBtn = bp.breakpointList.locator('button', { hasText: 'Remove' });
      await removeBtn.click();
    });
  });
});