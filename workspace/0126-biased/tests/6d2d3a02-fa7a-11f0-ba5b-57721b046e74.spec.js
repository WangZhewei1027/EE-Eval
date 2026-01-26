import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2d3a02-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the Min Heap demo
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.insertBtn = page.locator('#insert-btn');
    this.extractBtn = page.locator('#extract-min-btn');
    this.peekBtn = page.locator('#peek-btn');
    this.heapifyBtn = page.locator('#heapify-btn');
    this.clearBtn = page.locator('#clear-btn');
    this.manualInput = page.locator('#insert-value');
    this.manualInsertBtn = page.locator('#manual-insert-btn');
    this.heapSizeSlider = page.locator('#heap-size-slider');
    this.heapSizeValue = page.locator('#heap-size-value');
    this.applySizeBtn = page.locator('#apply-size-btn');
    this.viewMode = page.locator('#view-mode');
    this.toggleHighlightBtn = page.locator('#toggle-highlight');
    this.stepInsertBtn = page.locator('#step-insert-btn');
    this.stepExtractBtn = page.locator('#step-extract-btn');
    this.resetStepsBtn = page.locator('#reset-steps-btn');
    this.heapDisplay = page.locator('#heap-display');
    this.heapSizeStat = page.locator('#heap-size-stat');
    this.heapHeightStat = page.locator('#heap-height-stat');
    this.heapMinStat = page.locator('#heap-min-stat');
    this.lastOpStat = page.locator('#last-op-stat');
    this.opCountStat = page.locator('#op-count-stat');
    this.explanation = page.locator('#current-explanation');
  }

  // Basic interactions
  async clickInsert() {
    await this.insertBtn.click();
  }
  async clickExtract() {
    await this.extractBtn.click();
  }
  async clickPeek() {
    await this.peekBtn.click();
  }
  async clickHeapify() {
    await this.heapifyBtn.click();
  }
  async clickClear() {
    await this.clearBtn.click();
  }
  async manualInsert(value) {
    await this.manualInput.fill(String(value));
    await this.manualInsertBtn.click();
  }
  async clickManualInsertEmpty() {
    // Click manual insert with empty field to test edge case
    await this.manualInput.fill('');
    await this.manualInsertBtn.click();
  }
  async setHeapSizeSlider(value) {
    // set value and dispatch input event so UI updates
    await this.page.evaluate((v) => {
      const slider = document.getElementById('heap-size-slider');
      slider.value = String(v);
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
    // Wait for UI to reflect change
    await expect(this.heapSizeValue).toHaveText(String(value));
  }
  async clickApplySize() {
    await this.applySizeBtn.click();
  }
  async changeViewMode(mode) {
    await this.viewMode.selectOption(mode);
    // updateDisplay is called on change, wait briefly for rendering
    await this.page.waitForTimeout(50);
  }
  async clickToggleHighlight() {
    await this.toggleHighlightBtn.click();
  }
  async clickStepInsert() {
    await this.stepInsertBtn.click();
  }
  async clickStepExtract() {
    await this.stepExtractBtn.click();
  }
  async clickResetSteps() {
    await this.resetStepsBtn.click();
  }

  // Helpers to read UI state
  async getStats() {
    return {
      size: (await this.heapSizeStat.innerText()).trim(),
      height: (await this.heapHeightStat.innerText()).trim(),
      min: (await this.heapMinStat.innerText()).trim(),
      lastOp: (await this.lastOpStat.innerText()).trim(),
      opCount: (await this.opCountStat.innerText()).trim(),
    };
  }

  async getHeapNodes() {
    // returns texts and classes of heap nodes
    const nodes = await this.page.locator('.heap-node').elementHandles();
    const result = [];
    for (const handle of nodes) {
      const text = (await handle.innerText()).trim();
      const cls = await handle.getAttribute('class');
      const dataIndex = await handle.getAttribute('data-index');
      result.push({ text, class: cls || '', index: dataIndex });
    }
    return result;
  }

  async explanationText() {
    return (await this.explanation.innerHTML()).trim();
  }

  async nextStep() {
    const nextBtn = this.page.locator('#next-step-btn');
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();
    // allow UI to update
    await this.page.waitForTimeout(50);
  }
}

test.describe.serial('Min Heap Interactive Demo - FSM states and transitions', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Collect console messages for examination (info/warn/error)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the app fresh for each test
    await page.goto(APP_URL);
    // Allow initial scripts to run and render
    await page.waitForLoadState('networkidle');
  });

  // 1) Idle state (S0_Idle)
  test('Initialization: should render Idle state with empty heap and no errors', async ({ page }) => {
    const hp = new HeapPage(page);

    // Validate initial stats and UI indicate empty heap
    await expect(hp.heapDisplay).toContainText('Heap is empty');
    const stats = await hp.getStats();
    expect(stats.size).toBe('0'); // Heap is empty
    expect(stats.height).toBe('0');
    expect(stats.min).toBe('-');
    expect(stats.lastOp).toBe('None');
    expect(stats.opCount).toBe('0');

    // Ensure no uncaught page errors or console.error occurred during load
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(errorConsole).toBeUndefined();
  });

  // 2) InsertRandomValue -> S1_ValueInserted
  test('Insert Random Value should increase heap size and update last operation (S1_ValueInserted)', async ({ page }) => {
    const hp = new HeapPage(page);

    // Click Insert Random Value
    await hp.clickInsert();

    // After insert expect size 1, last operation text to match Inserted <number>
    await expect(hp.heapSizeStat).toHaveText('1');
    const stats = await hp.getStats();
    expect(stats.lastOp).toMatch(/^Inserted \d+$/);
    // Operations count should be 1
    expect(Number(stats.opCount)).toBeGreaterThanOrEqual(1);

    // Heap display should now contain at least one node
    const nodes = await hp.getHeapNodes();
    expect(nodes.length).toBeGreaterThanOrEqual(1);
    expect(nodes[0].text).toMatch(/^\d+$/);

    // No runtime errors should have occurred during user action
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(errorConsole).toBeUndefined();
  });

  // 3) ExtractMin: empty heap edge-case (S2_MinExtracted)
  test('Extract Min on empty heap should not crash and should report "Heap is empty" (S2_MinExtracted)', async ({ page }) => {
    const hp = new HeapPage(page);

    // On fresh page, extract should report heap is empty
    await hp.clickExtract();
    const stats = await hp.getStats();
    expect(stats.size).toBe('0');
    expect(stats.lastOp).toBe('Heap is empty');
    // operations count should remain 0 when extracting from empty heap
    expect(stats.opCount).toBe('0');

    // No errors should be thrown
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(errorConsole).toBeUndefined();
  });

  // 4) PeekMin: empty heap (S3_MinPeeked)
  test('Peek Min on empty heap should display "Heap is empty" (S3_MinPeeked)', async ({ page }) => {
    const hp = new HeapPage(page);

    // Peek on empty
    await hp.clickPeek();
    const stats = await hp.getStats();
    expect(stats.lastOp).toBe('Heap is empty');
    expect(stats.min).toBe('-');

    // No errors
    expect(pageErrors.length).toBe(0);
  });

  // 5) HeapifyArray -> S4_ArrayHeapified
  test('Heapify Random Array should populate heap based on slider size (S4_ArrayHeapified)', async ({ page }) => {
    const hp = new HeapPage(page);

    // Set slider to 5 and ensure value display updates
    await hp.setHeapSizeSlider(5);

    // Click Heapify
    await hp.clickHeapify();

    // After heapify, size stat should equal slider value (5)
    await expect(hp.heapSizeStat).toHaveText('5');

    // Last op should start with 'Heapified array: ['
    const stats = await hp.getStats();
    expect(stats.lastOp.startsWith('Heapified array: [')).toBeTruthy();

    // Heap display should not show 'Heap is empty'
    await expect(hp.heapDisplay).not.toContainText('Heap is empty');

    // No errors occurred during heapify
    expect(pageErrors.length).toBe(0);
  });

  // 6) ClearHeap -> S5_HeapCleared
  test('Clear Heap should empty the heap and set last operation (S5_HeapCleared)', async ({ page }) => {
    const hp = new HeapPage(page);

    // Prepare heap first by heapifying 3 elements
    await hp.setHeapSizeSlider(3);
    await hp.clickHeapify();
    await expect(hp.heapSizeStat).toHaveText('3');

    // Now clear
    await hp.clickClear();
    const stats = await hp.getStats();
    expect(stats.size).toBe('0');
    expect(stats.lastOp).toBe('Heap cleared');
    await expect(hp.heapDisplay).toContainText('Heap is empty');

    expect(pageErrors.length).toBe(0);
  });

  // 7) ManualInsert -> S6_ManualValueInserted and edge case with empty manual insert
  test('Manual Insert should add specific value and empty input after insertion (S6_ManualValueInserted)', async ({ page }) => {
    const hp = new HeapPage(page);

    // Insert specific value 42
    await hp.manualInsert(42);
    const stats = await hp.getStats();
    expect(stats.size).toBe('1');
    expect(stats.lastOp).toBe('Inserted 42');

    // Input cleared after insert
    const inputValue = await hp.manualInput.inputValue();
    expect(inputValue).toBe('');

    // Now test edge: clicking manual insert with empty input should not change lastOp or size
    await hp.clickManualInsertEmpty();
    const statsAfterEmpty = await hp.getStats();
    // lastOp should remain 'Inserted 42'
    expect(statsAfterEmpty.lastOp).toBe('Inserted 42');
    expect(statsAfterEmpty.size).toBe('1');

    expect(pageErrors.length).toBe(0);
  });

  // 8) AdjustHeapSize -> S7_HeapSizeAdjusted
  test('Adjust Heap Size slider updates displayed value and Apply Size triggers display update (S7_HeapSizeAdjusted)', async ({ page }) => {
    const hp = new HeapPage(page);

    // Change slider to 7, ensure the displayed heap-size-value updates via input event
    await hp.setHeapSizeSlider(7);
    await expect(hp.heapSizeValue).toHaveText('7');

    // Click apply size (which calls updateDisplay); since heap is empty, stats.size remains 0
    await hp.clickApplySize();
    const stats = await hp.getStats();
    expect(stats.size).toBe('0'); // heap unchanged by applying size (UI only)
    expect(pageErrors.length).toBe(0);
  });

  // 9) ToggleHighlight -> S8_HighlightToggled
  test('Toggle Highlight should highlight nodes in array view (S8_HighlightToggled)', async ({ page }) => {
    const hp = new HeapPage(page);

    // Prepare heap with several items
    await hp.setHeapSizeSlider(4);
    await hp.clickHeapify();
    await expect(hp.heapSizeStat).toHaveText('4');

    // Switch to array view
    await hp.changeViewMode('array');

    // Click toggle highlight - in array mode this toggles all nodes
    await hp.clickToggleHighlight();

    // At least one node should have the highlight class
    const nodes = await hp.getHeapNodes();
    const highlighted = nodes.filter(n => n.class.includes('highlight'));
    expect(highlighted.length).toBeGreaterThanOrEqual(1);

    expect(pageErrors.length).toBe(0);
  });

  // 10) StepInsert -> S9_StepInsert
  test('Step-by-step insert should populate steps and show step explanation with Next Step button (S9_StepInsert)', async ({ page }) => {
    const hp = new HeapPage(page);

    // Trigger step insert
    await hp.clickStepInsert();

    // Last operation should indicate step-by-step insert
    const stats = await hp.getStats();
    expect(stats.lastOp).toMatch(/^Step-by-step insert \d+$/);

    // Explanation area should contain step explanation and a Next Step button
    const explanationHTML = await hp.explanationText();
    expect(explanationHTML).toContain('Step Explanation');
    const nextBtn = page.locator('#next-step-btn');
    await expect(nextBtn).toBeVisible();

    // Click Next Step to advance one step (if there are multiple steps)
    await hp.nextStep();

    // After advancing, explanation should still be present (unless steps ended)
    const explanationAfter = await hp.explanationText();
    expect(explanationAfter.length).toBeGreaterThan(0);

    // No uncaught errors during step insert
    expect(pageErrors.length).toBe(0);
  });

  // 11) StepExtract -> S10_StepExtract
  test('Step-by-step extract on empty heap should result in no steps and lastOperation set accordingly (S10_StepExtract)', async ({ page }) => {
    const hp = new HeapPage(page);

    // Ensure heap is empty initially
    await expect(hp.heapSizeStat).toHaveText('0');

    // Trigger step extract
    await hp.clickStepExtract();

    // Last op should be 'Step-by-step extract min'
    const stats = await hp.getStats();
    expect(stats.lastOp).toBe('Step-by-step extract min');

    // Because heap was empty, explanation should show the empty heap message rather than step explanation
    const explanationHTML = await hp.explanationText();
    expect(explanationHTML).toContain('The heap is currently empty');

    expect(pageErrors.length).toBe(0);
  });

  // 12) ResetSteps -> S11_StepsReset
  test('Reset Steps should clear steps and remove Next Step button (S11_StepsReset)', async ({ page }) => {
    const hp = new HeapPage(page);

    // First create step insert to have steps
    await hp.clickStepInsert();
    await expect(page.locator('#next-step-btn')).toBeVisible();

    // Now reset steps
    await hp.clickResetSteps();

    // Next Step button should no longer be present
    const nextBtn = page.locator('#next-step-btn');
    await expect(nextBtn).toHaveCount(0);

    // Explanation should be non-step explanatory content
    const explanationHTML = await hp.explanationText();
    expect(explanationHTML).toContain('The heap currently contains');

    expect(pageErrors.length).toBe(0);
  });

  // Additional tests for view mode change event (ChangeViewMode) and HeapSize slider input event (HeapSizeSliderInput)
  test('Change view mode to array and back to tree updates rendering (ChangeViewMode)', async ({ page }) => {
    const hp = new HeapPage(page);

    // Populate heap
    await hp.setHeapSizeSlider(3);
    await hp.clickHeapify();
    await expect(hp.heapSizeStat).toHaveText('3');

    // Change to array view
    await hp.changeViewMode('array');
    // In array view nodes should exist and each node should have data-index attributes
    const nodesArray = await hp.getHeapNodes();
    expect(nodesArray.length).toBeGreaterThan(0);
    expect(nodesArray[0].index).toBeDefined();

    // Change back to tree view
    await hp.changeViewMode('tree');
    // In tree view nodes should exist too
    const nodesTree = await hp.getHeapNodes();
    expect(nodesTree.length).toBeGreaterThan(0);

    expect(pageErrors.length).toBe(0);
  });

  test('Heap size slider input event updates the visible slider value without causing errors (HeapSizeSliderInput)', async ({ page }) => {
    const hp = new HeapPage(page);

    // Adjust slider to 12 and check visible value updates
    await hp.setHeapSizeSlider(12);
    await expect(hp.heapSizeValue).toHaveText('12');

    // Change slider to 2
    await hp.setHeapSizeSlider(2);
    await expect(hp.heapSizeValue).toHaveText('2');

    expect(pageErrors.length).toBe(0);
  });

  // Final sanity check for runtime errors collected across interactions
  test('No uncaught ReferenceError/SyntaxError/TypeError occurred during interactions', async ({ page }) => {
    // pageErrors is collected in beforeEach and includes errors from this test's page lifecycle.
    // We assert that none of the captured page errors are ReferenceError/SyntaxError/TypeError.
    for (const err of pageErrors) {
      const name = err.name || '';
      expect(['ReferenceError', 'SyntaxError', 'TypeError']).not.toContain(name);
    }

    // Also assert there were no console.error messages flagged
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });
});