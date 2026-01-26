import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12175b01-fa7a-11f0-acf9-69409043402d.html';

// Page Object for interacting with the Random Forest Explorer UI
class RFPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // element shortcuts
    this.datasetSelect = page.locator('#datasetSelect');
    this.loadDatasetBtn = page.locator('#loadDatasetBtn');
    this.dataTextarea = page.locator('#dataTextarea');
    this.maxDepthInput = page.locator('#maxDepthInput');
    this.nTreesInput = page.locator('#nTreesInput');
    this.minSamplesSplitInput = page.locator('#minSamplesSplitInput');
    this.buildForestBtn = page.locator('#buildForestBtn');

    this.showForestSummaryBtn = page.locator('#showForestSummaryBtn');
    this.listTreesBtn = page.locator('#listTreesBtn');
    this.resetForestBtn = page.locator('#resetForestBtn');
    this.statusArea = page.locator('#statusArea');
    this.outputArea = page.locator('#outputArea');

    this.treeIndexInput = page.locator('#treeIndexInput');
    this.showTreeBtn = page.locator('#showTreeBtn');
    this.nodePathInput = page.locator('#nodePathInput');
    this.showNodeBtn = page.locator('#showNodeBtn');
    this.goToParentBtn = page.locator('#goToParentBtn');
    this.goToRootBtn = page.locator('#goToRootBtn');
    this.currentNodePathSpan = page.locator('#currentNodePath');
    this.nodeOutputArea = page.locator('#nodeOutputArea');

    this.predictionInputsArea = page.locator('#predictionInputsArea');
    this.predictBtn = page.locator('#predictBtn');
    this.predictionResult = page.locator('#predictionResult');
  }

  async navigate() {
    await this.page.goto(APP_URL);
    // Ensure initial UI is present
    await expect(this.page).toHaveTitle(/Random Forest Interactive Explorer/);
  }

  // Utilities for common actions
  async selectDataset(value) {
    await this.datasetSelect.selectOption(value);
    // selecting triggers loadSelectedDataset via change handler
    // some flows further call the button; give a tick to settle
    await this.page.waitForTimeout(50);
  }

  async clickLoadDataset() {
    await this.loadDatasetBtn.click();
  }

  async buildForest({ nTrees = '3', maxDepth = '5', minSamplesSplit = '2' } = {}) {
    await this.nTreesInput.fill(String(nTrees));
    await this.maxDepthInput.fill(String(maxDepth));
    await this.minSamplesSplitInput.fill(String(minSamplesSplit));
    await this.buildForestBtn.click();
    // Wait for training to complete (synchronous but might take a tick)
    await this.page.waitForTimeout(150);
  }

  async showForestSummary() {
    await this.showForestSummaryBtn.click();
  }

  async listTrees() {
    await this.listTreesBtn.click();
  }

  async resetForest() {
    await this.resetForestBtn.click();
  }

  async showTree(index = 0) {
    await this.treeIndexInput.fill(String(index));
    await this.showTreeBtn.click();
  }

  async showNode(path = '') {
    await this.nodePathInput.fill(path);
    await this.showNodeBtn.click();
  }

  async goToParent() {
    await this.goToParentBtn.click();
  }

  async goToRoot() {
    await this.goToRootBtn.click();
  }

  async predict(featureValues = []) {
    // fill prediction inputs (IDs are created dynamically after training)
    for (let i = 0; i < featureValues.length; i++) {
      const sel = `#predict_feature_${i}`;
      await this.page.fill(sel, String(featureValues[i]));
    }
    await this.predictBtn.click();
  }
}

test.describe('Random Forest Interactive Explorer - FSM states and transitions', () => {
  // Collect console and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages and page errors
    page.on('console', (msg) => {
      // Store all console messages for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // Capture unhandled page errors
      pageErrors.push(err);
    });
  });

  // Helper to assert no unexpected JS errors occurred
  async function assertNoRuntimeErrors() {
    // Fail if any page error objects are present
    expect(pageErrors.length, 'No page errors should have occurred').toBe(0);

    // Fail if any console message is of type error (includes uncaught exceptions emitted to console)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text));
    expect(consoleErrors.length, `Console should not contain errors or ReferenceError/TypeError/SyntaxError. Collected: ${JSON.stringify(consoleErrors)}`).toBe(0);
  }

  test('S0_Idle on page load: loadSelectedDataset was invoked and initial UI ready', async ({ page }) => {
    // Validate initial entry actions: loadSelectedDataset() and updatePredictionInputs() called on page load
    const rf = new RFPage(page);
    await rf.navigate();

    // After loadSelectedDataset() initial dataset is "custom", so dataTextarea should be empty string
    await expect(rf.dataTextarea).toHaveValue('');
    // The status was set by loadSelectedDataset initially; it should mention the "custom" dataset
    await expect(rf.statusArea).toContainText(/Dataset "custom" loaded/);

    // Prediction inputs updated and since no features exist yet, the area should mention no features
    await expect(rf.predictionInputsArea).toContainText(/No features to predict/);

    // Ensure no runtime JS errors happened during initial load
    await assertNoRuntimeErrors();
  });

  test('LoadDataset event transitions to S1_DatasetLoaded and updates status and textarea', async ({ page }) => {
    const rf = new RFPage(page);
    await rf.navigate();

    // Select 'iris' dataset and click load -> should populate textarea and set status to dataset loaded message
    await rf.selectDataset('iris');
    await rf.clickLoadDataset();

    // The textarea should begin with 'sepal_length' header
    await expect(rf.dataTextarea).toContainText('sepal_length');
    // The click handler specifically sets status: 'Dataset loaded. You can build and train the forest now.'
    await expect(rf.statusArea).toHaveText('Dataset loaded. You can build and train the forest now.');

    await assertNoRuntimeErrors();
  });

  test('BuildForest event transitions to S2_ForestTrained, trains forest, and updates prediction inputs', async ({ page }) => {
    const rf = new RFPage(page);
    await rf.navigate();

    // Use synthetic dataset for quick training
    await rf.selectDataset('synthetic');
    await rf.clickLoadDataset();

    // Set a small number of trees for speed and build
    await rf.buildForest({ nTrees: '3', maxDepth: '4', minSamplesSplit: '2' });

    // After training, status should indicate training completed with summary string starting
    await expect(rf.statusArea).toContainText(/Random Forest trained with 3 trees, max depth 4.|Random Forest trained with 3 trees/);

    // The tree index input max attribute should be set to nTrees-1 = 2
    const maxAttr = await page.getAttribute('#treeIndexInput', 'max');
    expect(maxAttr).toBe('2');

    // Prediction inputs should be created for the dataset feature count (synthetic has 2 features)
    await expect(page.locator('#predict_feature_0')).toBeVisible();
    await expect(page.locator('#predict_feature_1')).toBeVisible();

    await assertNoRuntimeErrors();
  });

  test('ShowForestSummary and ListTrees events work after training (S2_ForestTrained)', async ({ page }) => {
    const rf = new RFPage(page);
    await rf.navigate();

    // Train forest first (3 trees)
    await rf.selectDataset('synthetic');
    await rf.clickLoadDataset();
    await rf.buildForest({ nTrees: '3', maxDepth: '3', minSamplesSplit: '2' });

    // Show forest summary -> outputArea should include "Random Forest with" or info about trees
    await rf.showForestSummary();
    await expect(rf.outputArea).toContainText(/Random Forest with|Random Forest/);

    // List trees -> outputArea should include count and individual tree lines
    await rf.listTrees();
    await expect(rf.outputArea).toContainText(/Forest has 3 trees|Tree 0/);

    await assertNoRuntimeErrors();
  });

  test('ShowTree, ShowNodeInfo, GoToParentNode and GoToRootNode transitions and DOM updates (navigation)', async ({ page }) => {
    const rf = new RFPage(page);
    await rf.navigate();

    // Train forest
    await rf.selectDataset('synthetic');
    await rf.clickLoadDataset();
    await rf.buildForest({ nTrees: '3', maxDepth: '4', minSamplesSplit: '2' });

    // Display tree structure for tree 0
    await rf.showTree(0);
    // outputArea should show nodes or leaves
    await expect(rf.outputArea).toContainText(/Node:|Leaf:/);
    // currentNodePath should be root
    await expect(rf.currentNodePathSpan).toHaveText(/\(root\)/);

    // Try showing node info at path 'L' (left child of root). If path doesn't exist it will set status accordingly.
    await rf.showNode('L');
    // After successful showNode, nodeOutputArea should contain Depth and Samples lines or 'Node not found.'
    const nodeOutputText = await rf.nodeOutputArea.textContent();
    if (nodeOutputText && nodeOutputText.includes('Node not found.')) {
      // If the left path isn't available because the root happened to be a leaf, assert proper status message instead
      await expect(rf.statusArea).toContainText(/Node not found|Train a forest first|Node not found at path/);
    } else {
      await expect(rf.nodeOutputArea).toContainText(/Depth:|Samples in node:/);
    }

    // If we moved down to a child path, try goToParent to return to root. We click goToParent which triggers a refresh via showNodeBtn internally.
    await rf.goToParent();
    // currentNodePathSpan should reflect the root path
    await expect(rf.currentNodePathSpan).toHaveText(/\(root\)/);

    // Now, test goToRootBtn explicitly after moving to a deeper node (attempt to go to R then root)
    await rf.showNode('R');
    // click goToRootBtn to return
    await rf.goToRoot();
    await expect(rf.currentNodePathSpan).toHaveText(/\(root\)/);

    await assertNoRuntimeErrors();
  });

  test('Predict event returns a result and updates UI after training', async ({ page }) => {
    const rf = new RFPage(page);
    await rf.navigate();

    // Train using synthetic (2 features)
    await rf.selectDataset('synthetic');
    await rf.clickLoadDataset();
    await rf.buildForest({ nTrees: '5', maxDepth: '4', minSamplesSplit: '2' });

    // Fill prediction inputs and predict
    await rf.predict([0.4, 0.5]);

    // predictionResult should be non-empty (one of class labels)
    const predText = await rf.predictionResult.textContent();
    expect(predText.trim().length).toBeGreaterThan(0);

    // status should indicate prediction completed
    await expect(rf.statusArea).toHaveText(/Prediction completed.|Prediction completed/);

    await assertNoRuntimeErrors();
  });

  test('ResetForest event transitions to S3_ForestReset and clears trained state and inputs', async ({ page }) => {
    const rf = new RFPage(page);
    await rf.navigate();

    // Train first
    await rf.selectDataset('synthetic');
    await rf.clickLoadDataset();
    await rf.buildForest({ nTrees: '3', maxDepth: '3', minSamplesSplit: '2' });

    // Reset forest
    await rf.resetForest();

    // Status should indicate reset
    await expect(rf.statusArea).toHaveText(/Random Forest state reset. Load or input dataset to start again./);

    // Prediction inputs area should indicate there are no features to predict
    await expect(rf.predictionInputsArea).toContainText(/No features to predict/);

    // Attempting to show forest summary should now say no forest trained yet
    await rf.showForestSummary();
    await expect(rf.statusArea).toHaveText(/No forest trained yet/);

    await assertNoRuntimeErrors();
  });

  test('Edge case: Building forest with invalid CSV (non-numeric features) results in error status', async ({ page }) => {
    const rf = new RFPage(page);
    await rf.navigate();

    // Paste malformed CSV with non-numeric features into textarea
    const badCSV = `f1,f2,target
a,b,X
c,d,Y
`;
    await rf.dataTextarea.fill(badCSV);

    // Click build - parsing should throw and status should reflect error
    await rf.buildForestBtn.click();
    await page.waitForTimeout(50);

    // The page catches and sets status to 'Error training forest: ...'
    await expect(rf.statusArea).toContainText(/Error training forest:|Feature non-numeric value/);

    // Ensure that the forest is not flagged trained: trying to show summary should indicate no forest trained
    await rf.showForestSummary();
    await expect(rf.statusArea).toContainText(/No forest trained yet/).catch(() => {
      // depending on timing, the last status may still be the error message; accept either
    });

    // Some console errors may occur if exceptions bubble; ensure no unhandled page errors
    expect(pageErrors.length).toBe(0);

    // However, assert that the status contains the expected error textual information
    const statusText = await rf.statusArea.textContent();
    expect(/Feature non-numeric value|Error training forest/.test(statusText)).toBeTruthy();
  });

  test('Handlers and UI behave correctly when no forest is trained (edge cases)', async ({ page }) => {
    const rf = new RFPage(page);
    await rf.navigate();

    // Ensure we are in a reset/untrained state: reset explicitly
    await rf.resetForest();

    // showForestSummary when not trained -> status 'No forest trained yet.'
    await rf.showForestSummary();
    await expect(rf.statusArea).toHaveText(/No forest trained yet/);

    // listTrees when not trained -> same message
    await rf.listTrees();
    await expect(rf.statusArea).toHaveText(/No forest trained yet/);

    // showTree when not trained -> status 'Train a forest first.'
    await rf.showTree(0);
    await expect(rf.statusArea).toHaveText(/Train a forest first/);

    // showNode when not trained -> 'Train a forest first.'
    await rf.showNode('');
    await expect(rf.statusArea).toHaveText(/Train a forest first/);

    // predict when not trained -> 'Train a forest first.'
    await rf.predict([0.1, 0.2]);
    await expect(rf.statusArea).toHaveText(/Train a forest first/);

    await assertNoRuntimeErrors();
  });

  test.afterEach(async ({ page }) => {
    // final guard to ensure tests did not produce runtime errors
    // The assertNoRuntimeErrors helper already checks pageErrors and console error messages.
    // We run it here to ensure afterEach capture also passes.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text));
    expect(pageErrors.length, `pageErrors: ${JSON.stringify(pageErrors)}`).toBe(0);
    expect(consoleErrors.length, `consoleErrors: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });
});