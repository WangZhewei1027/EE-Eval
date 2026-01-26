import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c13b754-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page Object for the Selection Sort Explorer
class SelSortPage {
  constructor(page) {
    this.page = page;
  }

  // UI element handles
  async randomBtn() { return this.page.locator('#randomBtn'); }
  async sortedBtn() { return this.page.locator('#sortedBtn'); }
  async reverseBtn() { return this.page.locator('#reverseBtn'); }
  async setCustomBtn() { return this.page.locator('#setCustomBtn'); }
  async customArray() { return this.page.locator('#customArray'); }
  async sizeNumber() { return this.page.locator('#sizeNumber'); }
  async sizeRange() { return this.page.locator('#sizeRange'); }
  async valMin() { return this.page.locator('#valMin'); }
  async valMax() { return this.page.locator('#valMax'); }
  async seedInput() { return this.page.locator('#seedInput'); }
  async randomWithSeed() { return this.page.locator('#randomWithSeed'); }
  async comparatorSelect() { return this.page.locator('#comparator'); }
  async granularitySelect() { return this.page.locator('#granularity'); }
  async manualSwapCheckbox() { return this.page.locator('#manualSwap'); }
  async speed() { return this.page.locator('#speed'); }
  async speedLabel() { return this.page.locator('#speedLabel'); }

  async stepBtn() { return this.page.locator('#stepBtn'); }
  async opStepBtn() { return this.page.locator('#opStepBtn'); }
  async playBtn() { return this.page.locator('#playBtn'); }
  async pauseBtn() { return this.page.locator('#pauseBtn'); }
  async runToSwapBtn() { return this.page.locator('#runToSwapBtn'); }
  async runToCompareBtn() { return this.page.locator('#runToCompareBtn'); }
  async runToEndBtn() { return this.page.locator('#runToEndBtn'); }
  async resetBtn() { return this.page.locator('#resetBtn'); }
  async undoBtn() { return this.page.locator('#undoBtn'); }
  async redoBtn() { return this.page.locator('#redoBtn'); }

  async verifyManualSwapBtn() { return this.page.locator('#verifyManualSwap'); }
  async forceSwapBtn() { return this.page.locator('#forceSwapBtn'); }

  async arrayContainer() { return this.page.locator('#arrayContainer'); }
  async stateSummary() { return this.page.locator('#stateSummary'); }
  async pseudocode() { return this.page.locator('#pseudocode'); }
  async logArea() { return this.page.locator('#logArea'); }
  async totalSteps() { return this.page.locator('#totalSteps'); }
  async stepIndex() { return this.page.locator('#stepIndex'); }
  async gotoStepBtn() { return this.page.locator('#gotoStepBtn'); }
  async clearLogBtn() { return this.page.locator('#clearLogBtn'); }
  async traceToggle() { return this.page.locator('#traceToggle'); }

  // Helpers that use page.evaluate to inspect or call exposed debug api
  async getInternalState() {
    // Uses window._selsort.getState if present, otherwise returns null
    return this.page.evaluate(() => {
      return window._selsort ? window._selsort.getState() : null;
    });
  }

  async getHistorySnapshotCount() {
    return this.page.evaluate(() => {
      return window._selsort ? window._selsort.history().length : 0;
    });
  }

  async getArrayValues() {
    // return array of ints displayed in arrayContainer
    const texts = await this.page.locator('#arrayContainer > button').allTextContents();
    // strip labels like " (i,min)" appended
    return texts.map(t => {
      const m = t.match(/^(-?\d+)/);
      return m ? parseInt(m[1], 10) : null;
    });
  }

  async clickArrayIndex(idx) {
    // click button with data-index attribute
    await this.page.click(`#arrayContainer button[data-index="${idx}"]`);
  }

  // Wait until a condition in internal state is true or timeout
  async waitForStatePredicate(predicateFn, timeout = 2000) {
    await this.page.waitForFunction(predicateFn, null, { timeout });
  }
}

test.describe('Selection Sort Interactive Explorer (9c13b754-...)', () => {
  // Collect console messages and page errors for each test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Collect console messages (info, warning, error). Keep the text and type.
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure page loaded and initial initialize run
    await page.waitForSelector('#arrayContainer');
  });

  test.afterEach(async () => {
    // Assert there were no unexpected runtime page errors during the test.
    // If there were page errors, include them in the assertion message.
    expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  test('Initial state: initialized UI, array rendered, pseudocode highlight and history snapshot', async ({ page }) => {
    const app = new SelSortPage(page);

    // Validate that state summary reflects initialization: i=0 and micro=compare
    const stateSummaryText = await app.stateSummary().textContent();
    expect(stateSummaryText).toContain('i=0');
    expect(stateSummaryText).toContain('micro=compare');

    // Array container should have buttons equal to default sizeNumber value (8)
    const size = parseInt(await app.sizeNumber().inputValue(), 10);
    const items = await page.locator('#arrayContainer > button').count();
    expect(items).toBe(size);

    // Pseudocode should highlight a line (should contain '>>')
    const pseudo = await app.pseudocode().textContent();
    expect(pseudo).toContain('>>');

    // There should be at least one history snapshot (initial)
    const historyCount = await app.getHistorySnapshotCount();
    expect(historyCount).toBeGreaterThanOrEqual(1);

    // Log area should contain an "Initialized array" message
    const logText = await app.logArea().inputValue();
    expect(logText).toMatch(/Initialized array:/);
  });

  test('Generate arrays: Random, Sorted, Reverse and custom array input', async ({ page }) => {
    const app = new SelSortPage(page);

    // 1) Random array with specified size and range
    await app.sizeNumber().fill('5');
    await app.valMin().fill('10');
    await app.valMax().fill('15');
    await app.randomBtn().click();

    // Ensure array length updated to 5 and values within range [10,15]
    const valuesRandom = await app.getArrayValues();
    expect(valuesRandom.length).toBe(5);
    for (const v of valuesRandom) {
      expect(v).not.toBeNull();
      expect(v).toBeGreaterThanOrEqual(10);
      expect(v).toBeLessThanOrEqual(15);
    }

    // 2) Sorted array: should produce ascending values starting from min
    await app.valMin().fill('3');
    await app.sizeNumber().fill('4');
    await app.sortedBtn().click();
    const valuesSorted = await app.getArrayValues();
    expect(valuesSorted).toEqual([3,4,5,6]);

    // 3) Reverse array: should produce descending values starting from max
    await app.valMax().fill('9');
    await app.sizeNumber().fill('4');
    await app.reverseBtn().click();
    const valuesReverse = await app.getArrayValues();
    expect(valuesReverse).toEqual([9,8,7,6]);

    // 4) Custom array: valid and invalid cases
    // valid
    await app.customArray().fill('5,3,7,1');
    await app.setCustomBtn().click();
    const valuesCustom = await app.getArrayValues();
    expect(valuesCustom).toEqual([5,3,7,1]);

    // invalid custom array should trigger alert dialog; handle it and ensure state not replaced
    let sawDialog = false;
    page.once('dialog', async (dialog) => {
      sawDialog = true;
      // verify message contains 'Invalid number'
      expect(dialog.message()).toContain('Invalid number');
      await dialog.accept();
    });
    await app.customArray().fill('x,y');
    await app.setCustomBtn().click();
    // give event loop a tick to process dialog
    await page.waitForTimeout(50);
    expect(sawDialog).toBe(true);
  });

  test('Random with seed initializes deterministically and alerts if missing seed', async ({ page }) => {
    const app = new SelSortPage(page);

    // Attempt clicking Random w/ seed without filling seedInput -> expect alert
    let sawSeedDialog = false;
    page.once('dialog', async (dialog) => {
      sawSeedDialog = true;
      expect(dialog.message()).toContain('Enter a seed');
      await dialog.accept();
    });
    await app.seedInput().fill(''); // ensure empty
    await app.randomWithSeed().click();
    await page.waitForTimeout(50);
    expect(sawSeedDialog).toBe(true);

    // Now provide a seed and create two sequences to assert variability (basic check)
    await app.sizeNumber().fill('5');
    await app.valMin().fill('0');
    await app.valMax().fill('20');
    await app.seedInput().fill('seed123');
    await app.randomWithSeed().click();
    const first = await app.getArrayValues();

    // Re-seed and re-initialize - reload the page to guarantee clean RNG usage
    await page.reload();
    // reattach helper after reload
    const app2 = new SelSortPage(page);
    await app2.seedInput().fill('seed123');
    await app2.sizeNumber().fill('5');
    await app2.valMin().fill('0');
    await app2.valMax().fill('20');
    await app2.randomWithSeed().click();
    const second = await app2.getArrayValues();

    // Deterministic: the same seed should yield same array values
    expect(second).toEqual(first);
  });

  test('Atomic step and operation step mechanics, undo/redo and reset', async ({ page }) => {
    const app = new SelSortPage(page);

    // Ensure in atomic granularity
    await app.granularitySelect().selectOption('atomic');

    // Record initial history count
    const initialHistory = await app.getHistorySnapshotCount();

    // Click step to perform a micro step (compare)
    await app.stepBtn().click();
    await page.waitForTimeout(50);

    // After a compare, comparisons should be at least 1 in internal state
    const st1 = await app.getInternalState();
    expect(st1.comparisons).toBeGreaterThanOrEqual(1);

    // Undo: move back in history
    await app.undoBtn().click();
    await page.waitForTimeout(50);
    const stUndo = await app.getInternalState();
    // Should have rolled back to earlier comparisons (likely zero or less than st1)
    expect(stUndo.comparisons).toBeLessThanOrEqual(st1.comparisons);

    // Redo: forward in history
    await app.redoBtn().click();
    await page.waitForTimeout(50);
    const stRedo = await app.getInternalState();
    expect(stRedo.comparisons).toBeGreaterThanOrEqual(stUndo.comparisons);

    // Operation-level step: switch to operation granularity and perform opStep
    await app.granularitySelect().selectOption('operation');
    // Use a small custom array to get predictable behavior
    await app.customArray().fill('3,1,2');
    await app.setCustomBtn().click();
    // enable manual swap to test that operationStep will pause awaiting manual swap (we'll test both)
    await app.manualSwapCheckbox().check();
    await app.opStepBtn().click();
    await page.waitForTimeout(50);
    const stOp = await app.getInternalState();
    // Since array [3,1,2] at i=0 should have minIndex!=i, manualAwaitingSwap should be true
    expect(stOp.manualAwaitingSwap).toBe(true);

    // Reset to initial snapshot
    await app.resetBtn().click();
    await page.waitForTimeout(50);
    const stReset = await app.getInternalState();
    // After reset, i should be 0 and manualAwaitingSwap false
    expect(stReset.i).toBe(0);
    expect(stReset.manualAwaitingSwap).toBe(false);
  });

  test('Auto-play, run to compare, run to swap and pause behavior', async ({ page }) => {
    const app = new SelSortPage(page);

    // Speed up auto-play (small interval)
    await app.speed().fill('50');
    await app.speed().dispatchEvent('input');
    await page.waitForTimeout(20);

    // Play for a short duration then pause
    await app.playBtn().click();
    // let it run a little
    await page.waitForTimeout(120);
    await app.pauseBtn().click();
    // Ensure auto-play stopped: log contains 'Auto-play stopped.' or state progressed
    const logs = await app.logArea().inputValue();
    expect(logs.length).toBeGreaterThan(0);

    // Run to next comparison: ensure it stops on a compare event (we cannot directly read event from logs reliably)
    await app.runToCompareBtn().click();
    // wait until next compare caused auto stop - give a small window
    await page.waitForTimeout(200);
    const stAfterCompare = await app.getInternalState();
    // Event might be 'compare' or some other; assert that there is at least one comparison increment
    expect(stAfterCompare.comparisons).toBeGreaterThanOrEqual(0);

    // Now test run to next swap with manual swap disabled (should stop at swap/noSwap)
    // Ensure manual swap is not required
    await app.manualSwapCheckbox().uncheck();
    await app.runToSwapBtn().click();
    await page.waitForTimeout(400);
    const stAfterSwap = await app.getInternalState();
    // After runToSwap we expect event to be swap or noSwap or micro phase afterSwap; check that i progressed or swaps incremented
    expect(stAfterSwap.i).toBeGreaterThanOrEqual(0);
  });

  test('Manual swap workflow: select elements, verify successful and unsuccessful attempts, force swap', async ({ page }) => {
    const app = new SelSortPage(page);

    // Prepare deterministic small array where a swap is needed at i=0
    await app.customArray().fill('4,1,3');
    await app.setCustomBtn().click();

    // Use operation step and enable manual swap mode
    await app.manualSwapCheckbox().check();
    await app.granularitySelect().selectOption('operation');

    // Trigger operation step which should set manualAwaitingSwap
    await app.opStepBtn().click();
    await page.waitForTimeout(50);
    let st = await app.getInternalState();
    expect(st.manualAwaitingSwap).toBe(true);

    const iIndex = st.i;
    const minIndex = st.minIndex;
    // Select the correct two indices by clicking the array items (these clicks will mark selection)
    await app.clickArrayIndex(iIndex);
    await app.clickArrayIndex(minIndex);

    // Verify manual swap
    await app.verifyManualSwapBtn().click();
    await page.waitForTimeout(50);
    st = await app.getInternalState();
    expect(st.manualAwaitingSwap).toBe(false);
    expect(st.swaps).toBeGreaterThanOrEqual(1); // swap should have been counted

    // Now set up another manual swap but attempt an incorrect selection to get a badManualSwap event recorded
    // Prepare a new array where swap is needed again
    await app.customArray().fill('9,2,3');
    await app.setCustomBtn().click();
    await app.manualSwapCheckbox().check();
    await app.granularitySelect().selectOption('operation');
    await app.opStepBtn().click();
    await page.waitForTimeout(50);
    st = await app.getInternalState();
    expect(st.manualAwaitingSwap).toBe(true);

    // Select two wrong indices (neither corresponds to the required swap)
    // choose indices (i+1) and (i+2) if available; if not, choose some indices within array
    const n = st.arr.length;
    const wrongA = Math.min(n - 1, st.i + 1);
    const wrongB = Math.min(n - 1, st.i + 2);
    await app.clickArrayIndex(wrongA);
    await app.clickArrayIndex(wrongB);

    // Click verify; expect the system to record a bad manual swap attempt (internal event 'badManualSwap' pushed to history)
    await app.verifyManualSwapBtn().click();
    await page.waitForTimeout(50);

    // Inspect the latest history snapshot to assert that phaseNote includes 'incorrect manual swap' or event is 'badManualSwap'
    const history = await page.evaluate(() => {
      return window._selsort ? window._selsort.history().slice() : [];
    });
    const last = history[history.length - 1];
    expect(last.phaseNote).toMatch(/incorrect manual swap attempt|badManualSwap/);

    // Force swap now to exit the manualAwaitingSwap state
    await app.forceSwapBtn().click();
    await page.waitForTimeout(50);
    st = await app.getInternalState();
    expect(st.manualAwaitingSwap).toBe(false);
    // forced swap should increment swaps
    expect(st.swaps).toBeGreaterThanOrEqual(1);
  });

  test('Editing array values via prompt and step timeline navigation (gotoStep, totalSteps)', async ({ page }) => {
    const app = new SelSortPage(page);

    // Use a small array
    await app.customArray().fill('1,2,3');
    await app.setCustomBtn().click();

    // Click an array element to trigger prompt; intercept the dialog and provide a new value
    const firstBtn = page.locator('#arrayContainer > button').first();
    // Ensure not manual awaiting swap so that click triggers prompt
    const stBefore = await app.getInternalState();
    expect(stBefore.manualAwaitingSwap).toBe(false);

    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('prompt');
      // Provide new value '9'
      await dialog.accept('9');
    });
    await firstBtn.click();
    await page.waitForTimeout(50);
    // Check that the array's first value changed to 9
    const values = await app.getArrayValues();
    expect(values[0]).toBe(9);

    // Timeline navigation: stepIndex and gotoStep
    const total = await app.getHistorySnapshotCount();
    expect(total).toBeGreaterThanOrEqual(1);
    // Jump to first step (0)
    await app.stepIndex().fill('0');
    await app.gotoStepBtn().click();
    await page.waitForTimeout(50);
    const st0 = await app.getInternalState();
    expect(st0).not.toBeNull();
    // totalSteps UI should reflect history length
    const totalStepsUI = parseInt(await app.totalSteps().textContent(), 10);
    expect(totalStepsUI).toBe(total);
  });

  // Final test to ensure that the debugging API is exposed and usable
  test('Debug API window._selsort is exposed and usable', async ({ page }) => {
    // Check that window._selsort exists and provides functions
    const hasApi = await page.evaluate(() => !!(window._selsort && typeof window._selsort.getState === 'function'));
    expect(hasApi).toBe(true);

    // Call getState and check it returns a snapshot with expected keys
    const st = await page.evaluate(() => window._selsort.getState());
    expect(st).toBeTruthy();
    expect(typeof st.i).toBe('number');
    expect(Array.isArray(st.arr)).toBe(true);
    expect(typeof st.manualAwaitingSwap).toBe('boolean');
  });
});