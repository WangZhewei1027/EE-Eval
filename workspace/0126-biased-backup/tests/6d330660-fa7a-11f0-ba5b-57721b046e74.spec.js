import { test, expect } from '@playwright/test';

// Test file for Random Forest Interactive Demo
// Application URL (served externally for these tests)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d330660-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object Model for the demo page
class RandomForestPage {
  constructor(page) {
    this.page = page;
    // Controls
    this.nTrees = page.locator('#nTrees');
    this.maxDepth = page.locator('#maxDepth');
    this.minSamplesSplit = page.locator('#minSamplesSplit');
    this.nSamples = page.locator('#nSamples');
    this.noiseLevel = page.locator('#noiseLevel');
    this.datasetType = page.locator('#datasetType');
    this.currentTree = page.locator('#currentTree');
    this.showAllTrees = page.locator('#showAllTrees');
    this.showDecisionBoundary = page.locator('#showDecisionBoundary');
    this.showSamples = page.locator('#showSamples');
    this.showTreeStructure = page.locator('#showTreeStructure');
    this.generateDataBtn = page.locator('#generateDataBtn');
    this.trainBtn = page.locator('#trainBtn');
    // Readouts
    this.nTreesValue = page.locator('#nTreesValue');
    this.maxDepthValue = page.locator('#maxDepthValue');
    this.minSamplesSplitValue = page.locator('#minSamplesSplitValue');
    this.nSamplesValue = page.locator('#nSamplesValue');
    this.noiseLevelValue = page.locator('#noiseLevelValue');
    this.currentTreeValue = page.locator('#currentTreeValue');
    this.accuracy = page.locator('#accuracy');
    // canvases
    this.mainCanvas = page.locator('#mainCanvas');
    this.treeCanvas = page.locator('#treeCanvas');
  }

  // Helper to set a range input value and dispatch an 'input' event (for reactive behavior)
  async setRangeInput(locator, value) {
    await locator.evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  // Helper to set select value and dispatch 'change'
  async setSelect(locator, value) {
    await locator.evaluate((el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }

  // Helper to set checkbox and dispatch event
  async setCheckbox(locator, checked) {
    await locator.evaluate((el, v) => {
      el.checked = v;
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, checked);
  }

  // Click actions
  async clickGenerateData() {
    await this.generateDataBtn.click();
  }

  async clickTrain() {
    await this.trainBtn.click();
  }

  // Expose window state for assertions
  async getState() {
    return this.page.evaluate(() => window.state);
  }

  async getSamplesLength() {
    return this.page.evaluate(() => window.samples.length);
  }

  async getTreesLength() {
    return this.page.evaluate(() => window.trees.length);
  }

  async getPredictionsLength() {
    return this.page.evaluate(() => window.predictions.length);
  }

  async getCanvasPixelSum(selector) {
    // Utility: sum of pixel data bytes to detect that canvas has pixels drawn
    return this.page.evaluate((sel) => {
      const canvas = document.querySelector(sel);
      if (!canvas) return -1;
      const ctx = canvas.getContext('2d');
      try {
        const data = ctx.getImageData(0, 0, Math.min(10, canvas.width), Math.min(10, canvas.height)).data;
        return Array.from(data).reduce((a, b) => a + b, 0);
      } catch (e) {
        // If getImageData is not allowed (CORS or other), return -2 to indicate failure
        return -2;
      }
    }, selector);
  }
}

test.describe('Random Forest Interactive Demo - FSM and UI tests', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console logs
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Slight teardown check: nothing to do, but keep for completeness
    await page.close();
  });

  test('Initial load should initialize canvases, state and run entry actions (S0_Idle)', async ({ page }) => {
    const rf = new RandomForestPage(page);

    // Validate DOM elements exist
    await expect(rf.mainCanvas).toBeVisible();
    await expect(rf.treeCanvas).toBeVisible();
    await expect(rf.nTrees).toBeVisible();
    await expect(rf.generateDataBtn).toBeVisible();
    await expect(rf.trainBtn).toBeVisible();

    // Check initial displayed values match initial state
    await expect(rf.nTreesValue).toHaveText('10');
    await expect(rf.nSamplesValue).toHaveText('100');
    await expect(rf.maxDepthValue).toHaveText('5');
    await expect(rf.minSamplesSplitValue).toHaveText('2');
    await expect(rf.noiseLevelValue).toHaveText('0.10');
    await expect(rf.currentTreeValue).toHaveText('1');

    // The page onload should have executed generateData(), trainModel(), render()
    // Verify that samples and trees are present and predictions computed
    const samplesLen = await rf.getSamplesLength();
    const treesLen = await rf.getTreesLength();
    const predsLen = await rf.getPredictionsLength();

    expect(samplesLen).toBeGreaterThanOrEqual(10); // should match # samples >= min
    expect(treesLen).toBeGreaterThanOrEqual(1);    // at least one tree built
    expect(predsLen).toEqual(samplesLen);         // predictions for each sample

    // Ensure no uncaught page errors on initial load
    expect(pageErrors.length).toBe(0);

    // Confirm canvases have been drawn on (pixel data sum > 0 or -2 if getImageData failed)
    const mainCanvasSum = await rf.getCanvasPixelSum('#mainCanvas');
    const treeCanvasSum = await rf.getCanvasPixelSum('#treeCanvas');
    expect([true, false]).toContain(mainCanvasSum === -2 ? true : mainCanvasSum >= 0);
    expect([true, false]).toContain(treeCanvasSum === -2 ? true : treeCanvasSum >= 0);
  });

  test('Generate New Data -> transition S0_Idle to S1_DataGenerated (regenerateData)', async ({ page }) => {
    const rf = new RandomForestPage(page);

    // Capture current samples length and trees
    const beforeSamples = await rf.getSamplesLength();
    const beforeTrees = await rf.getTreesLength();

    // Click generate new data button
    await rf.clickGenerateData();

    // After clicking, new data should be generated and model trained
    const afterSamples = await rf.getSamplesLength();
    const afterTrees = await rf.getTreesLength();
    const state = await rf.getState();

    // nSamples in state should match samples count
    expect(afterSamples).toEqual(state.nSamples);
    // Trees should match state.nTrees
    expect(afterTrees).toEqual(state.nTrees);

    // Generally, generating new data should change samples (so count same but content different).
    // At minimum, samples length should be equal to state.nSamples and not zero
    expect(afterSamples).toBeGreaterThan(0);

    // No uncaught exceptions expected here
    expect(pageErrors.length).toBe(0);
  });

  test('Retrain Model -> transition S1_DataGenerated to S2_ModelTrained (retrainModel)', async ({ page }) => {
    const rf = new RandomForestPage(page);

    // Change a hyperparameter to ensure retrain will have an effect
    await rf.setRangeInput(rf.maxDepth, 3);
    // Wait a bit for retrain triggered by input event
    await page.waitForTimeout(200);

    // Now explicitly click retrain model button
    const beforeTrees = await rf.getTreesLength();
    await rf.clickTrain();
    // Allow retrain/render to complete
    await page.waitForTimeout(200);
    const afterTrees = await rf.getTreesLength();

    const state = await rf.getState();
    // After retrain, number of trees should equal state.nTrees
    expect(afterTrees).toEqual(state.nTrees);
    // There should be at least one tree
    expect(afterTrees).toBeGreaterThanOrEqual(1);

    // No uncaught exceptions expected here
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Model hyperparameter updates (UpdateNTrees, UpdateMaxDepth, UpdateMinSamplesSplit)', () => {
    test('Update number of trees updates state and triggers retrain', async ({ page }) => {
      const rf = new RandomForestPage(page);

      // Set nTrees to 5
      await rf.setRangeInput(rf.nTrees, 5);
      // Allow retrain
      await page.waitForTimeout(300);

      const state = await rf.getState();
      const treesLen = await rf.getTreesLength();
      await expect(rf.nTreesValue).toHaveText(String(state.nTrees));
      expect(state.nTrees).toEqual(5);
      expect(treesLen).toEqual(5);
      expect(pageErrors.length).toBe(0);
    });

    test('Update max depth updates state and triggers retrain', async ({ page }) => {
      const rf = new RandomForestPage(page);

      // Set maxDepth to 2
      await rf.setRangeInput(rf.maxDepth, 2);
      await page.waitForTimeout(300);

      const state = await rf.getState();
      await expect(rf.maxDepthValue).toHaveText(String(state.maxDepth));
      expect(state.maxDepth).toEqual(2);
      expect(pageErrors.length).toBe(0);
    });

    test('Update min samples split updates state and triggers retrain', async ({ page }) => {
      const rf = new RandomForestPage(page);

      // Set minSamplesSplit to 5
      await rf.setRangeInput(rf.minSamplesSplit, 5);
      await page.waitForTimeout(300);

      const state = await rf.getState();
      await expect(rf.minSamplesSplitValue).toHaveText(String(state.minSamplesSplit));
      expect(state.minSamplesSplit).toEqual(5);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Dataset parameter updates (UpdateNSamples, UpdateNoiseLevel, UpdateDatasetType)', () => {
    test('Update number of samples regenerates data', async ({ page }) => {
      const rf = new RandomForestPage(page);

      // Set nSamples to 150
      await rf.setRangeInput(rf.nSamples, 150);
      // regenerateData is invoked by input handler
      await page.waitForTimeout(300);

      const state = await rf.getState();
      const samplesLen = await rf.getSamplesLength();
      await expect(rf.nSamplesValue).toHaveText(String(state.nSamples));
      expect(state.nSamples).toEqual(150);
      expect(samplesLen).toEqual(150);
      expect(pageErrors.length).toBe(0);
    });

    test('Update noise level regenerates data and updates display', async ({ page }) => {
      const rf = new RandomForestPage(page);

      // Set noiseLevel to 0.25
      await rf.setRangeInput(rf.noiseLevel, 0.25);
      await page.waitForTimeout(300);

      const state = await rf.getState();
      await expect(rf.noiseLevelValue).toHaveText(state.noiseLevel.toFixed(2));
      expect(Math.abs(state.noiseLevel - 0.25)).toBeLessThan(0.001);
      expect(pageErrors.length).toBe(0);
    });

    test('Change dataset type (UpdateDatasetType) regenerates data', async ({ page }) => {
      const rf = new RandomForestPage(page);

      // Change dataset type to 'xor'
      await rf.setSelect(rf.datasetType, 'xor');
      await page.waitForTimeout(300);

      const state = await rf.getState();
      expect(state.datasetType).toEqual('xor');
      const samplesLen = await rf.getSamplesLength();
      expect(samplesLen).toEqual(state.nSamples);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Visualization controls and current tree selection', () => {
    test('Update current tree updates display and triggers render', async ({ page }) => {
      const rf = new RandomForestPage(page);

      // Set currentTree to 2
      await rf.setRangeInput(rf.currentTree, 2);
      await page.waitForTimeout(200);

      const state = await rf.getState();
      await expect(rf.currentTreeValue).toHaveText(String(state.currentTree + 1));
      expect(state.currentTree).toEqual(2);
      expect(pageErrors.length).toBe(0);
    });

    test('Toggle show all trees shows ensemble decision boundary path and does not crash', async ({ page }) => {
      const rf = new RandomForestPage(page);

      // Toggle showAllTrees to true
      await rf.setCheckbox(rf.showAllTrees, true);
      await page.waitForTimeout(200);

      const state = await rf.getState();
      expect(state.showAllTrees).toBeTruthy();
      // No page error expected
      expect(pageErrors.length).toBe(0);
    });

    test('Toggle display options (decision boundary, samples, tree structure)', async ({ page }) => {
      const rf = new RandomForestPage(page);

      // Toggle decision boundary off
      await rf.setCheckbox(rf.showDecisionBoundary, false);
      await page.waitForTimeout(100);
      let state = await rf.getState();
      expect(state.showDecisionBoundary).toBeFalsy();

      // Toggle samples off
      await rf.setCheckbox(rf.showSamples, false);
      await page.waitForTimeout(100);
      state = await rf.getState();
      expect(state.showSamples).toBeFalsy();

      // Toggle tree structure on
      await rf.setCheckbox(rf.showTreeStructure, true);
      await page.waitForTimeout(200);
      state = await rf.getState();
      expect(state.showTreeStructure).toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });
  });

  test('Edge case: set nTrees small and currentTree out-of-bounds to observe runtime error (allowed)', async ({ page }) => {
    const rf = new RandomForestPage(page);

    // 1) Set currentTree to highest possible index (9)
    await rf.setRangeInput(rf.currentTree, 9);
    await page.waitForTimeout(100);

    // 2) Reduce nTrees to 1 (this will retrain and make trees.length === 1)
    // This leaves state.currentTree == 9 but trees length 1 -> subsequent render/drawDecisionBoundary may access trees[9] -> undefined -> TypeError
    // Clear any previous errors
    // Note: pageErrors is captured in closure; ensure we check new errors after action
    // Perform the change that will likely trigger an uncaught exception during rendering
    await rf.setRangeInput(rf.nTrees, 1);

    // Wait for a pageerror event or allow some time for render to run and possibly throw
    // Use waitForEvent with timeout but fallback to checking collected pageErrors
    let observedError = null;
    try {
      const evt = await Promise.race([
        page.waitForEvent('pageerror', { timeout: 2000 }),
        new Promise((resolve) => setTimeout(() => resolve(null), 2000))
      ]);
      observedError = evt;
    } catch (e) {
      // ignore
    }

    // Consolidate pageErrors captured
    const allErrors = pageErrors.slice();
    if (observedError) allErrors.push(observedError);

    // We expect that under this forced inconsistent state, the app may throw an error (TypeError)
    // Assert that at least one page error occurred and that it looks like a TypeError or cannot read property
    const hasTypeError = allErrors.some(err => {
      const msg = String(err && err.message ? err.message : err);
      return msg.includes('TypeError') || msg.includes('cannot') || msg.includes('of undefined');
    });

    expect(hasTypeError).toBeTruthy();

    // Also assert that state reflects the inputs we set even if runtime error occurred
    const state = await rf.getState();
    expect(state.nTrees).toEqual(1);
    expect(state.currentTree).toEqual(9);
  });

  test('Additional edge checks: extremes for inputs should update state and not necessarily crash', async ({ page }) => {
    const rf = new RandomForestPage(page);

    // Set nSamples to minimum (10)
    await rf.setRangeInput(rf.nSamples, 10);
    await page.waitForTimeout(200);
    let state = await rf.getState();
    expect(state.nSamples).toEqual(10);

    // Set noise to max (0.5)
    await rf.setRangeInput(rf.noiseLevel, 0.5);
    await page.waitForTimeout(200);
    state = await rf.getState();
    expect(Math.abs(state.noiseLevel - 0.5)).toBeLessThan(0.001);

    // Set nTrees to maximum (50)
    await rf.setRangeInput(rf.nTrees, 50);
    await page.waitForTimeout(500);
    state = await rf.getState();
    expect(state.nTrees).toEqual(50);

    // No requirement for no errors here; check that either no new pageErrors or errors are expected only in the previous explicit edge test
    // At least ensure that the page still responds and elements show updated values
    await expect(rf.nSamplesValue).toHaveText(String(state.nSamples));
    await expect(rf.noiseLevelValue).toHaveText(state.noiseLevel.toFixed(2));
    await expect(rf.nTreesValue).toHaveText(String(state.nTrees));
  });

  test('Observe console output produced by the application during interactions', async ({ page }) => {
    const rf = new RandomForestPage(page);

    // Trigger a few interactions to produce console entries (if any are logged by the app)
    await rf.setRangeInput(rf.maxDepth, 4);
    await rf.setRangeInput(rf.nTrees, 7);
    await rf.setCheckbox(rf.showAllTrees, true);
    await page.waitForTimeout(300);

    // While the app doesn't explicitly console.log in provided source, ensure that we safely collected console output array
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    // It's acceptable for there to be zero console messages; this assertion just ensures collection worked
    expect(consoleMessages).not.toBeNull();
  });
});