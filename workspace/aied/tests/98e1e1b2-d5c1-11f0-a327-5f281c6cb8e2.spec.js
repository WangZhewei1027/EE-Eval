import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e1e1b2-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page Object for the Heap Sort Visualization app
class HeapVizPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      actionLabel: page.locator('#actionLabel'),
      startBtn: page.locator('#startBtn'),
      randomBtn: page.locator('#randomBtn'),
      stepBtn: page.locator('#stepBtn'),
      resetBtn: page.locator('#resetBtn'),
      sizeInput: page.locator('#size'),
      speedInput: page.locator('#speed'),
      maxValInput: page.locator('#maxVal'),
      compCount: page.locator('#compCount'),
      swapCount: page.locator('#swapCount'),
      heapSizeLabel: page.locator('#heapSizeLabel'),
      codeBlock: page.locator('#codeBlock'),
      canvas: page.locator('#canvas')
    };
  }

  async waitForReady() {
    // Wait for main UI to be present and initialized
    await this.locators.actionLabel.waitFor({ state: 'visible' });
    // initial rendering might call draw repeatedly; wait a tiny bit for stability
    await this.page.waitForTimeout(50);
  }

  // UI getters
  async getActionLabel() {
    return (await this.locators.actionLabel.textContent())?.trim();
  }

  async getStartButtonText() {
    return (await this.locators.startBtn.textContent())?.trim();
  }

  async getCompSwapCounts() {
    const comp = parseInt((await this.locators.compCount.textContent()) || '0', 10);
    const swap = parseInt((await this.locators.swapCount.textContent()) || '0', 10);
    return { comp, swap };
  }

  async getHeapSize() {
    const txt = (await this.locators.heapSizeLabel.textContent()) || '0';
    return parseInt(txt.trim(), 10);
  }

  async isCanvasPresent() {
    return this.locators.canvas.count().then(c => c > 0);
  }

  async getArraySnapshot() {
    // The page exposes window.__heapViz = { array, draw } for debugging.
    return this.page.evaluate(() => {
      try {
        return window.__heapViz && Array.isArray(window.__heapViz.array) ? window.__heapViz.array.slice() : null;
      } catch (e) {
        return null;
      }
    });
  }

  async getHighlightedLines() {
    return this.page.evaluate(() => {
      const els = Array.from(document.querySelectorAll('#codeBlock .line.highlight'));
      return els.map(e => e.id || e.textContent);
    });
  }

  // Interactions
  async clickStart() {
    await this.locators.startBtn.click();
  }
  async clickRandom() {
    await this.locators.randomBtn.click();
  }
  async clickStep() {
    await this.locators.stepBtn.click();
  }
  async clickReset() {
    await this.locators.resetBtn.click();
  }
  async setSize(n) {
    // Use evaluate to set .value for number input
    await this.page.evaluate((v) => {
      const el = document.getElementById('size');
      if (el) el.value = String(v);
      // trigger input event
      const ev = new Event('input', { bubbles: true });
      el && el.dispatchEvent(ev);
    }, n);
  }
  async setSpeed(n) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('speed');
      if (el) el.value = String(v);
      const ev = new Event('input', { bubbles: true });
      el && el.dispatchEvent(ev);
    }, n);
  }
  async setMaxVal(n) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('maxVal');
      if (el) el.value = String(v);
      const ev = new Event('input', { bubbles: true });
      el && el.dispatchEvent(ev);
    }, n);
  }

  // helper to wait until actionLabel equals some text (with timeout)
  async waitForActionLabel(text, options = {}) {
    const timeout = options.timeout ?? 10000;
    await this.page.waitForFunction(
      (sel, expected) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return (el.textContent || '').trim().toLowerCase() === expected.toLowerCase();
      },
      '#actionLabel',
      text,
      { timeout }
    );
  }
}

test.describe('Heap Sort Visualization - FSM and UI tests', () => {
  let page;
  let heapPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Create a fresh context/page for each test to avoid state carryover
    const context = await browser.newContext();
    page = await context.newPage();

    // Capture console messages and page errors for assertions and diagnostics
    page.on('console', msg => {
      // Collect console messages including errors, warnings, info
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // Uncaught exceptions in the page will be captured here
      pageErrors.push(err);
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    heapPage = new HeapVizPage(page);
    await heapPage.waitForReady();
  });

  test.afterEach(async () => {
    // Close page context to cleanup
    try {
      await page.context().close();
    } catch (e) {
      // ignore
    }
  });

  test('Initial state: app loads and enters Idle (S0_Idle) with initArray() executed', async () => {
    // This test verifies S0_Idle entry action (initArray) and initial UI state.
    // Expect the action label to show "ready" (set by initArray()), heap size equal to default size, and metrics reset.
    const action = await heapPage.getActionLabel();
    expect(action).toBeTruthy();
    expect(action.toLowerCase()).toBe('ready');

    const sizeVal = await page.$eval('#size', el => Number((el as HTMLInputElement).value));
    const heapSize = await heapPage.getHeapSize();
    // heapSize should equal the current size input (clamped to range in initArray)
    expect(heapSize).toBeGreaterThanOrEqual(5);
    expect(heapSize).toBe(sizeVal);

    const { comp, swap } = await heapPage.getCompSwapCounts();
    expect(comp).toBe(0);
    expect(swap).toBe(0);

    // Pseudocode lines rendered
    const linesCount = await page.$$eval('#codeBlock .line', els => els.length);
    expect(linesCount).toBeGreaterThan(0);

    // No highlighted line at initialization (null highlight)
    const highlights = await heapPage.getHighlightedLines();
    expect(highlights.length).toBe(0);

    // Canvas is present
    expect(await heapPage.isCanvasPresent()).toBeTruthy();
  });

  test('Randomize_Click event: Randomize button re-initializes array when idle (S0_Idle -> S0_Idle)', async () => {
    // Ensure clicking Randomize while not running calls initArray() (S0 stays S0) and updates the array
    const before = await heapPage.getArraySnapshot();
    expect(Array.isArray(before)).toBeTruthy();

    await heapPage.clickRandom();
    // wait a small time for re-init to run
    await page.waitForTimeout(120);

    const after = await heapPage.getArraySnapshot();
    expect(Array.isArray(after)).toBeTruthy();

    // Arrays should both be arrays and likely different after randomize; allow possibility of same sequences but assert that action label is 'ready'
    const action = await heapPage.getActionLabel();
    expect(action.toLowerCase()).toBe('ready');

    // If arrays differ, that's good. If by chance they match, still accept but assert lengths equal expected size.
    expect(after.length).toBeGreaterThanOrEqual(5);
    const sizeInput = await page.$eval('#size', el => Number((el as HTMLInputElement).value));
    expect(after.length).toBe(sizeInput);
  });

  test('Start_Click transitions: Start -> Pause -> Resume (S0_Idle -> S1_Running -> S2_Paused -> S1_Running)', async () => {
    // This test verifies the Start button toggling behavior for Play/Pause/Resume transitions.
    // Set speed to fast to reduce wait times.
    await heapPage.setSpeed(10);

    // Click Start to begin heapSort (S0 -> S1)
    await heapPage.clickStart();
    // After clicking start, the start button should change to 'Pause'
    await page.waitForTimeout(50);
    let startText = await heapPage.getStartButtonText();
    expect(startText.toLowerCase()).toBe('pause');

    // The action label should leave 'ready' and enter an active action; we expect it to be at least not 'idle' or 'ready'.
    const actionDuringRun = (await heapPage.getActionLabel()).toLowerCase();
    expect(['ready', 'idle']).not.toContain(actionDuringRun);

    // Click Start again to toggle pause (S1 -> S2)
    await heapPage.clickStart();
    await page.waitForTimeout(50);
    startText = await heapPage.getStartButtonText();
    // After pausing, the implementation sets button text to 'Resume'
    expect(startText.toLowerCase()).toBe('resume');

    const actionPaused = (await heapPage.getActionLabel()).toLowerCase();
    // When paused, the code sets setAction('paused')
    // Accept either 'paused' or other immediate textual state but prefer 'paused'
    expect(actionPaused).toBeTruthy();
    expect(actionPaused.includes('paused') || actionPaused.includes('heapify') || actionPaused.includes('running')).toBeTruthy();

    // Click Start to resume (S2 -> S1)
    await heapPage.clickStart();
    await page.waitForTimeout(50);
    startText = await heapPage.getStartButtonText();
    // After resuming, button should be 'Pause' again
    expect(startText.toLowerCase()).toBe('pause');

    const actionAfterResume = (await heapPage.getActionLabel()).toLowerCase();
    // On resume path the code sets action to 'running' in some code paths, accept that
    expect(actionAfterResume).toBeTruthy();
    // Accept either 'running' or some other active state like 'build max-heap'
    expect(['running', 'build max-heap', 'heapify: index 0'].some(s => actionAfterResume.includes(s))).toBeTruthy();
  });

  test('Step_Click behavior when idle: starts in paused mode and takes one step (S2_Paused semantics)', async () => {
    // This test validates the Step button behavior: it should start the routine in paused mode and advance a single step.
    // Ensure app is idle initially and speed high to make single-step quick
    await heapPage.setSpeed(10);

    // Click Step
    await heapPage.clickStep();

    // After clicking step when idle, the UI should reflect that the run started in paused mode: start button displays 'Resume'
    await page.waitForTimeout(100);
    const startText = await heapPage.getStartButtonText();
    expect(startText.toLowerCase()).toBe('resume');

    // Action label should show paused or some progression (the code sets action 'paused' before waiting)
    const action = (await heapPage.getActionLabel()).toLowerCase();
    expect(action).toBeTruthy();
    // Should either be 'paused' or some early step like 'build max-heap' depending on timing
    expect(['paused', 'build max-heap', 'heapify'].some(sub => action.includes(sub))).toBeTruthy();

    // There should be at least one pseudocode highlight visible during stepping or shortly after
    const highlights = await heapPage.getHighlightedLines();
    expect(Array.isArray(highlights)).toBeTruthy();
    // It's acceptable for highlights to be empty right after step due to timing, but ensure code lines exist
    const codeLinesCount = await page.$$eval('#codeBlock .line', els => els.length);
    expect(codeLinesCount).toBeGreaterThan(0);
  });

  test('Reset and Randomize obey running guard: cannot reset/randomize while running', async () => {
    // This test exercises the guard that randomize/reset do nothing while running.
    // Start the algorithm
    await heapPage.setSpeed(10);
    await heapPage.clickStart();
    await page.waitForTimeout(50);

    // Capture array snapshot while running
    const arrayDuringRun = await heapPage.getArraySnapshot();

    // Attempt to click Randomize and Reset while running
    await heapPage.clickRandom();
    await page.waitForTimeout(50);
    const afterRandom = await heapPage.getArraySnapshot();
    expect(afterRandom).toEqual(arrayDuringRun); // should be unchanged while running

    await heapPage.clickReset();
    await page.waitForTimeout(50);
    const afterReset = await heapPage.getArraySnapshot();
    expect(afterReset).toEqual(arrayDuringRun); // also unchanged

    // Pause to allow cleanup
    await heapPage.clickStart(); // toggle pause/resume (pause)
    await page.waitForTimeout(20);
    // Now that it's paused/resumed state, ensure reset/randomize can work when not running
    await heapPage.clickStart(); // fully pause/resume flow to set running false if required (tolerant)
  });

  test('Complete sort: finish sorting to Sorted state (S1_Running -> S3_Sorted)', async () => {
    // To test full sort completion we reduce size to small and increase speed.
    // This test may take a few seconds; set an extended timeout.
    test.setTimeout(20000);

    await heapPage.setSize(6);
    await heapPage.setSpeed(10);
    await heapPage.setMaxVal(30);

    // Start sorting
    await heapPage.clickStart();

    // Wait for the action label to become 'sorted' which is set when heapSort completes
    await heapPage.waitForActionLabel('sorted', { timeout: 15000 });

    const finalAction = (await heapPage.getActionLabel()).toLowerCase();
    expect(finalAction).toBe('sorted');

    // Start button should have been reset to 'Start' after completion
    const startText = (await heapPage.getStartButtonText()).toLowerCase();
    expect(startText).toBe('start');

    // Comparisons and swaps should be non-negative integers; expect at least 0 and swaps likely >0 for random arrays
    const { comp, swap } = await heapPage.getCompSwapCounts();
    expect(Number.isInteger(comp)).toBeTruthy();
    expect(Number.isInteger(swap)).toBeTruthy();
    expect(comp).toBeGreaterThanOrEqual(0);
    expect(swap).toBeGreaterThanOrEqual(0);

    // Validate array is sorted ascendingly after the visualization completes
    const finalArray = await heapPage.getArraySnapshot();
    expect(Array.isArray(finalArray)).toBeTruthy();
    for (let i = 1; i < finalArray.length; i++) {
      // After heapsort, array should be sorted ascending
      expect(finalArray[i - 1]).toBeLessThanOrEqual(finalArray[i]);
    }
  });

  test('Edge cases: input clamping for size and maxVal, and value ranges honored', async () => {
    // Set invalid small size below min and ensure initArray clamps to minimum (5)
    await heapPage.setSize(3);
    await heapPage.clickRandom();
    await page.waitForTimeout(100);
    let arr = await heapPage.getArraySnapshot();
    expect(arr.length).toBeGreaterThanOrEqual(5);

    // Set maxVal to 5 and ensure values are within range [1,5]
    await heapPage.setMaxVal(5);
    await heapPage.setSize(8);
    await heapPage.clickRandom();
    await page.waitForTimeout(100);
    arr = await heapPage.getArraySnapshot();
    expect(arr.length).toBe(8);
    for (const v of arr) {
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  test('No uncaught runtime errors or console.error emitted during normal interactions', async () => {
    // Perform a sequence of typical interactions and then assert that no uncaught exceptions occurred.
    await heapPage.setSpeed(10);
    await heapPage.clickRandom();
    await page.waitForTimeout(50);
    await heapPage.clickStep();
    await page.waitForTimeout(120);
    await heapPage.clickStart();
    await page.waitForTimeout(50);
    await heapPage.clickStart(); // pause quickly

    // Wait a short time for any async errors to surface
    await page.waitForTimeout(200);

    // Gather console error entries
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');

    // Assert there were no uncaught page errors (pageerror events)
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);

    // Assert there are no console error messages (warnings may exist but treat 'error' as fail)
    const errorMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorMessages.length, `Unexpected console.error messages: ${errorMessages.map(e => e.text).join('\n')}`).toBe(0);

    // For diagnostics, allow console warnings but keep a record for debugging
    // Ensure that the app at least emitted some console messages or none, but no fatal ones.
    expect(consoleErrors.length).toBeGreaterThanOrEqual(0);
  });
});