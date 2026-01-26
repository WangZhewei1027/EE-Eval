import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c169d84-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page Object encapsulating common interactions and selectors
class DecisionTreePage {
  constructor(page, collectors) {
    this.page = page;
    this.collectors = collectors || {};
    this.selectors = {
      h1: 'h1',
      generateData: '#generateData',
      showData: '#showData',
      downloadCSV: '#downloadCSV',
      datasetPreview: '#datasetPreview',
      dataTable: '#dataTable',
      autoBuild: '#autoBuild',
      autoMode: '#autoMode',
      stepInit: '#stepInit',
      stepNext: '#stepNext',
      stepFinish: '#stepFinish',
      stepInfo: '#stepInfo',
      treeContainer: '#treeContainer',
      selectedNodeId: '#selectedNodeId',
      leafPrediction: '#leafPrediction',
      makeLeaf: '#makeLeaf',
      evaluate: '#evaluate',
      evalOutput: '#evalOutput',
      traverseSample: '#traverseSample',
      traverseOutput: '#traverseOutput',
      splitFeature: '#splitFeature',
      applySplit: '#applySplit',
      resetTree: '#resetTree',
      randomTree: '#randomTree',
      exportTree: '#exportTree',
      treeJson: '#treeJson',
      downloadCSVBtn: '#downloadCSV'
    };
  }

  // Wait for initial demo data generation to complete (datasetPreview shows the generated text)
  async waitForInitialData() {
    await this.page.waitForSelector(this.selectors.datasetPreview);
    await expect(this.page.locator(this.selectors.datasetPreview)).toContainText('Data generated', { timeout: 5000 });
  }

  async clickGenerateData() {
    await this.page.click(this.selectors.generateData);
  }

  async clickShowData() {
    await this.page.click(this.selectors.showData);
  }

  async clickDownloadCSV() {
    // Use waitForEvent to capture download if it occurs
    return await Promise.all([
      this.page.waitForEvent('download').catch(() => null),
      this.page.click(this.selectors.downloadCSV)
    ]);
  }

  async clickAutoBuild() {
    await this.page.click(this.selectors.autoBuild);
  }

  async clickStepInit() {
    await this.page.click(this.selectors.stepInit);
  }

  async clickStepNext() {
    await this.page.click(this.selectors.stepNext);
  }

  async clickStepFinish() {
    await this.page.click(this.selectors.stepFinish);
  }

  async clickMakeLeaf() {
    await this.page.click(this.selectors.makeLeaf);
  }

  async clickEvaluate() {
    await this.page.click(this.selectors.evaluate);
  }

  async clickTraverseSample() {
    await this.page.click(this.selectors.traverseSample);
  }

  async clickApplySplit() {
    await this.page.click(this.selectors.applySplit);
  }

  async clickResetTree() {
    await this.page.click(this.selectors.resetTree);
  }

  async selectFirstNodeButton() {
    // select the first node-button rendered in treeContainer
    const btn = this.page.locator('#treeContainer button.node-button').first();
    await expect(btn).toBeVisible();
    await btn.click();
  }

  async setLeafPrediction(val) {
    await this.page.fill(this.selectors.leafPrediction, String(val));
  }

  async setSplitFeature(val) {
    await this.page.fill(this.selectors.splitFeature, String(val));
  }

  async getLogContents() {
    return await this.page.locator('#log').innerText();
  }

  async getDatasetPreviewText() {
    return await this.page.locator(this.selectors.datasetPreview).innerText();
  }

  async getDataTableHasRows() {
    // returns number of rows rendered in first 50
    const rows = await this.page.locator('#dataTable table tbody tr').count();
    return rows;
  }

  async getTreeButtonCount() {
    return await this.page.locator('#treeContainer button.node-button').count();
  }

  async getStepInfoText() {
    return await this.page.locator(this.selectors.stepInfo).innerText();
  }

  async getSelectedNodeIdText() {
    return await this.page.locator(this.selectors.selectedNodeId).innerText();
  }

  async getEvalOutputText() {
    return await this.page.locator(this.selectors.evalOutput).innerText();
  }

  async getTraverseOutputText() {
    return await this.page.locator(this.selectors.traverseOutput).innerText();
  }
}

// Global setup for each test: navigate to page and collect console/pageerrors/dialogs
test.describe('Decision Trees - FSM and UI integration tests', () => {
  test.beforeEach(async ({ page }) => {
    // Arrays to collect observations
    page['__consoleMessages'] = [];
    page['__pageErrors'] = [];
    page['__dialogs'] = [];

    // Collect console messages
    page.on('console', msg => {
      try {
        page['__consoleMessages'].push(msg.text());
      } catch (e) {
        // ignore
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', err => {
      page['__pageErrors'].push(String(err && err.message ? err.message : err));
    });

    // Intercept dialogs, record and accept them so tests proceed
    page.on('dialog', async dialog => {
      page['__dialogs'].push(dialog.message());
      try {
        await dialog.accept();
      } catch (e) {
        // ignore if dialog already handled
      }
    });

    // Navigate to the page under test
    await page.goto(BASE, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // nothing special; Playwright handles cleanup
  });

  test('S0_Idle: initial load renders page and auto-generates demo data', async ({ page }) => {
    // Validate initial page render and demo data generation triggered by script (renderPage implicit)
    const collectors = {
      console: page['__consoleMessages'],
      errors: page['__pageErrors'],
      dialogs: page['__dialogs']
    };
    const dt = new DecisionTreePage(page, collectors);

    // Ensure the main heading is present (Idle state evidence)
    await expect(page.locator('h1')).toHaveText('Decision Trees - Interactive Playground');

    // The script calls generateSyntheticData() at the end -> expect "Generated data" log and dataset preview
    await dt.waitForInitialData();
    const preview = await dt.getDatasetPreviewText();
    expect(preview).toMatch(/Data generated: \d+ samples, \d+ features/);

    // Confirm the console log contains the generated data message
    const hasGeneratedLog = (page['__consoleMessages'] || []).some(t => /Generated data: \d+ samples, \d+ features/.test(t));
    expect(hasGeneratedLog).toBeTruthy();

    // Assert no uncaught page errors on initial load
    expect(page['__pageErrors'].length).toBe(0);
  });

  test('S1_DataGenerated: Generate Data & View Dataset (GenerateData, ShowData)', async ({ page }) => {
    // This test verifies generating new data and rendering the data table (transition S0 -> S1)
    const dt = new DecisionTreePage(page);

    // Change inputs to create a recognizable dataset size
    await page.fill('#numSamples', '120');
    await page.fill('#numFeatures', '4');

    // Click Generate Synthetic Data
    await dt.clickGenerateData();

    // Expect datasetPreview text to reflect 120 samples
    await expect(page.locator('#datasetPreview')).toContainText('Data generated: 120 samples');

    // Click "View Dataset (first 50 rows)"
    await dt.clickShowData();

    // Verify that the data table exists and has rows (up to 50)
    const rows = await dt.getDataTableHasRows();
    expect(rows).toBeGreaterThan(0);

    // Confirm a related console log was emitted
    const found = (page['__consoleMessages'] || []).some(t => t.includes('Generated data:'));
    expect(found).toBeTruthy();

    // No unexpected page errors
    expect(page['__pageErrors'].length).toBe(0);
  });

  test('S2_TreeInitialized & S3_TreeBuilt via Auto Build (AutoBuildTree)', async ({ page }) => {
    // Validate tree initialization and auto-building (initTreeRoot + autoBuildTree)
    const dt = new DecisionTreePage(page);

    // Ensure we have data (demo data is already present)
    await dt.waitForInitialData();

    // Ensure autoMode is default 'fast' and click Auto Build Tree
    await expect(page.locator('#autoMode')).toHaveValue('fast');
    await dt.clickAutoBuild();

    // Expect logs for initialization and auto-built tree
    const logs = page['__consoleMessages'].join('\n');
    expect(logs).toMatch(/Initialized root node with \d+ samples, prediction:/);
    expect(logs).toMatch(/Auto-built tree with criterion/);

    // The tree container should render node buttons
    const btnCount = await dt.getTreeButtonCount();
    expect(btnCount).toBeGreaterThan(0);

    // The selectedNodeId should be set (initTreeRoot sets selectedNode to root)
    const selected = await dt.getSelectedNodeIdText();
    expect(selected).not.toBe('none');

    // No page errors from the build
    expect(page['__pageErrors'].length).toBe(0);
  });

  test('S2->S3 via Step-by-step (StepInit, StepNext, StepFinish) and inspector updates', async ({ page }) => {
    // Validate the step-by-step builder behavior and transitions S2->S3
    const dt = new DecisionTreePage(page);

    await dt.waitForInitialData();

    // Initialize the step-by-step builder
    await dt.clickStepInit();

    // stepNext and stepFinish should be enabled
    await expect(page.locator('#stepNext')).toBeEnabled();
    await expect(page.locator('#stepFinish')).toBeEnabled();

    // Click Next Step (may apply a split or indicate no further splits)
    await dt.clickStepNext();

    // Step info should update to reflect split applied or no further splits
    const stepInfo = await dt.getStepInfoText();
    expect(stepInfo.length).toBeGreaterThan(0);

    // Now Finish Build (should complete remaining splits)
    await dt.clickStepFinish();

    // Expect a log entry indicating finishBuild completed iterations
    const foundFinish = (page['__consoleMessages'] || []).some(t => /Finished step-by-step build \(iterations:/.test(t));
    expect(foundFinish).toBeTruthy();

    // step buttons should be disabled after finish
    await expect(page.locator('#stepNext')).toBeDisabled();
    await expect(page.locator('#stepFinish')).toBeDisabled();

    // Tree should be rendered with node buttons
    const btnCount = await dt.getTreeButtonCount();
    expect(btnCount).toBeGreaterThan(0);

    // No page errors
    expect(page['__pageErrors'].length).toBe(0);
  });

  test('S3_TreeBuilt -> S4_NodeEdited (MakeLeaf) and verify DOM/log updates', async ({ page }) => {
    // Build a tree and then convert a selected node into a leaf
    const dt = new DecisionTreePage(page);

    // Ensure data present
    await dt.waitForInitialData();

    // Auto-build the tree to ensure nodes are present
    await dt.clickAutoBuild();

    // Select the first node (this will set state.selectedNode and update UI)
    await dt.selectFirstNodeButton();

    // Record selected node id
    const selBefore = await dt.getSelectedNodeIdText();
    expect(selBefore).not.toBe('none');

    // Set a new prediction value and make the node a leaf
    await dt.setLeafPrediction('TEST_LABEL');
    await dt.clickMakeLeaf();

    // Expect console log about making node a leaf
    const madeLeaf = (page['__consoleMessages'] || []).some(t => /Made node .* a leaf with prediction/.test(t));
    expect(madeLeaf).toBeTruthy();

    // The selected node display should remain set
    const selAfter = await dt.getSelectedNodeIdText();
    expect(selAfter).toBe(selBefore);

    // Tree view should contain "Leaf pred" for at least one node
    const treeHtml = await page.locator('#treeContainer').innerText();
    expect(treeHtml).toMatch(/Leaf pred/);

    // No uncaught errors
    expect(page['__pageErrors'].length).toBe(0);
  });

  test('S4_NodeEdited -> S5_TreeEvaluated (Evaluate) yields metrics in evalOutput', async ({ page }) => {
    // Build a tree and run evaluation to get metrics output (Accuracy or MSE)
    const dt = new DecisionTreePage(page);

    await dt.waitForInitialData();

    // Auto-build a tree
    await dt.clickAutoBuild();

    // Click Evaluate on Test Set
    await dt.clickEvaluate();

    // Evaluate updates evalOutput with metrics; for classification expect "Accuracy", for regression "MSE"
    const evalText = await dt.getEvalOutputText();
    expect(evalText.length).toBeGreaterThan(0);
    const isClassification = (await page.locator('#taskType')).inputValue() === 'classification';
    if (isClassification) {
      expect(evalText).toMatch(/Accuracy:/);
    } else {
      expect(evalText).toMatch(/MSE:/);
    }

    // No page errors expected
    expect(page['__pageErrors'].length).toBe(0);
  });

  test('Traverse sample (TraverseSample): outputs a path JSON when a tree exists', async ({ page }) => {
    // Build a tree then traverse a sample through it
    const dt = new DecisionTreePage(page);

    await dt.waitForInitialData();

    // Auto-build
    await dt.clickAutoBuild();

    // Ensure sampleInputs are rendered
    await page.waitForSelector('#sampleInputs input');

    // Click Traverse Sample
    await dt.clickTraverseSample();

    // Traverse output should be JSON with at least one path element
    const out = await dt.getTraverseOutputText();
    expect(out).toBeTruthy();
    expect(out).toMatch(/"nodeId"/);

    // No uncaught page errors
    expect(page['__pageErrors'].length).toBe(0);
  });

  test('Edge cases: ApplySplit when no tree and invalid feature index triggers alerts', async ({ page }) => {
    // This test triggers error conditions that produce dialog alerts. We recorded dialogs in beforeEach.
    const dt = new DecisionTreePage(page);

    // Reset tree to ensure no tree exists
    await dt.clickResetTree();

    // Attempt to apply split when no tree -> should produce "No tree" alert message
    await dt.clickApplySplit();
    // Wait briefly to ensure dialog processed
    await page.waitForTimeout(200);
    const dialogs1 = page['__dialogs'] || [];
    const sawNoTree = dialogs1.some(d => /No tree/.test(d) || /No data/.test(d));
    expect(sawNoTree).toBeTruthy();

    // Clear recorded dialogs for next checks
    page['__dialogs'] = [];

    // Generate data and init root
    await dt.clickGenerateData();
    await dt.clickStepInit(); // initStepBuilder calls initTreeRoot

    // Set an invalid split feature index (too large)
    await dt.setSplitFeature('9999');

    // Attempt to apply split -> should alert 'Invalid feature index' which we accept
    await dt.clickApplySplit();
    await page.waitForTimeout(200);
    const dialogs2 = page['__dialogs'] || [];
    const sawInvalid = dialogs2.some(d => /Invalid feature index/.test(d));
    expect(sawInvalid).toBeTruthy();

    // No unexpected page errors from these edge interactions
    expect(page['__pageErrors'].length).toBe(0);
  });

  test('Download CSV triggers a download event for the dataset', async ({ page }) => {
    // Validate that clicking Download CSV initiates a download with expected filename
    const dt = new DecisionTreePage(page);

    await dt.waitForInitialData();

    // Wait for a download event when clicking the button
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#downloadCSV')
    ]);

    // The download should have been suggested with dataset.csv
    expect(download).toBeTruthy();
    const suggested = download.suggestedFilename();
    expect(suggested).toBe('dataset.csv');

    // No page errors from download
    expect(page['__pageErrors'].length).toBe(0);
  });

  test('Console & pageerrors observation: capture and assert console contains lifecycle messages', async ({ page }) => {
    // This test inspects the console messages collected across interactions and asserts presence of key lifecycle logs
    const dt = new DecisionTreePage(page);

    // Wait for demo data, then auto-build and finish to collect various logs
    await dt.waitForInitialData();
    await dt.clickAutoBuild();
    await dt.clickStepInit();
    await dt.clickStepFinish();

    // Inspect collected console messages
    const msgs = page['__consoleMessages'] || [];
    // Expect at least these lifecycle messages to appear somewhere
    const hasGenerated = msgs.some(m => /Generated data: \d+ samples, \d+ features/.test(m));
    const hasInitRoot = msgs.some(m => /Initialized root node with \d+ samples, prediction:/.test(m));
    const hasBuild = msgs.some(m => /Auto-built tree with criterion/.test(m) || /Finished step-by-step build \(iterations:/.test(m));

    expect(hasGenerated).toBeTruthy();
    expect(hasInitRoot).toBeTruthy();
    expect(hasBuild).toBeTruthy();

    // Capture any uncaught page errors and assert none present in normal operation
    expect(page['__pageErrors'].length).toBe(0);
  });
});