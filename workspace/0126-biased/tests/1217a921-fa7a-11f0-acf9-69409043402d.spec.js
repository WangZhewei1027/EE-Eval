import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1217a921-fa7a-11f0-acf9-69409043402d.html';

/**
 * Page Object for the Overfitting Exploration Simulator
 * Encapsulates common interactions and queries used by the tests.
 */
class OverfittingPage {
  constructor(page) {
    this.page = page;
    this.locators = {
      generateData: page.locator('#generate-data'),
      trainModel: page.locator('#train-model'),
      evaluateModel: page.locator('#evaluate-model'),
      addPoint: page.locator('#add-point'),
      clearData: page.locator('#clear-data'),
      splitData: page.locator('#split-data'),
      computeTrainError: page.locator('#compute-train-error'),
      computeValError: page.locator('#compute-val-error'),
      trainStatus: page.locator('#train-status'),
      evalStatus: page.locator('#eval-status'),
      trainError: page.locator('#train-error'),
      valError: page.locator('#val-error'),
      dataStatus: page.locator('#data-status'),
      manualX: page.locator('#manual-x'),
      manualY: page.locator('#manual-y'),
      enablePointRemoval: page.locator('#enable-point-removal'),
      canvas: page.locator('#plot'),
      modelType: page.locator('#model-type'),
      modelParams: page.locator('#model-params'),
      valRatio: page.locator('#val-ratio'),
      noiseLevel: page.locator('#noise-level'),
      numPoints: page.locator('#num-points'),
      evalPoints: page.locator('#eval-points'),
      evalRangeFrom: page.locator('#eval-range-from'),
      evalRangeTo: page.locator('#eval-range-to'),
      showTrueFn: page.locator('#show-true-function'),
      showNoisy: page.locator('#show-noisy-data'),
      showPred: page.locator('#show-predictions'),
    };
  }

  async clickGenerateData() {
    await this.locators.generateData.click();
    // Wait for expected status text to appear
    await expect(this.locators.trainStatus).toContainText(/Data generated with/i);
  }

  async clickTrainModel() {
    await this.locators.trainModel.click();
    await expect(this.locators.trainStatus).toContainText(/Model trained:/i);
  }

  async clickEvaluateModel() {
    await this.locators.evaluateModel.click();
    await expect(this.locators.evalStatus).toContainText(/Model evaluated on grid\./i);
  }

  async clickAddPoint() {
    await this.locators.addPoint.click();
    await expect(this.locators.trainStatus).toContainText(/Added point/i);
  }

  async clickClearData() {
    await this.locators.clearData.click();
    await expect(this.locators.trainStatus).toHaveText('Dataset cleared.');
  }

  async clickSplitData() {
    await this.locators.splitData.click();
    await expect(this.locators.trainStatus).toContainText(/Data split into train/i);
  }

  async clickComputeTrainError() {
    await this.locators.computeTrainError.click();
    await expect(this.locators.trainError).toContainText(/Training MSE:/i);
  }

  async clickComputeValError() {
    await this.locators.computeValError.click();
    await expect(this.locators.valError).toContainText(/Validation MSE:/i);
  }

  async enablePointRemovalCheckbox() {
    const checked = await this.locators.enablePointRemoval.isChecked();
    if (!checked) await this.locators.enablePointRemoval.check();
    // ensure canvas cursor changes - not strictly necessary, but ensure state toggled
    await expect(this.locators.canvas).toBeVisible();
  }

  // Compute pixel coordinates inside canvas for a given normalized x (0..1)
  // Uses bounding box of canvas to compute absolute page coords suitable for page.mouse.click
  async canvasClickAtNormalized(page, xNorm, yNorm = 0.5) {
    const box = await this.locators.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    const px = box.x + (box.width - 0) * xNorm;
    const py = box.y + (box.height - 0) * (1 - yNorm);
    await page.mouse.click(px, py);
  }

  // Helper to get disabled state quickly
  async isDisabled(selectorLocator) {
    return await selectorLocator.isDisabled();
  }
}

/**
 * Global listener setup/teardown and common expectations:
 * - We capture console.error and uncaught page errors and assert there are none at the end of each test.
 * - Tests are written to follow the FSM states and transitions.
 */
test.describe('Overfitting Exploration Simulator (FSM-driven tests)', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    // Navigate to app and wait for UI to be ready
    await page.goto(APP_URL);
    await page.waitForSelector('#generate-data');
    // sanity: ensure main elements exist
    await expect(page.locator('h1')).toHaveText(/Overfitting Exploration Simulator/i);
  });

  test.afterEach(async () => {
    // Assert no uncaught page-level errors were observed during the test.
    // This confirms the app ran without ReferenceError/SyntaxError/TypeError being thrown unexpectedly.
    expect(pageErrors, `Unhandled page errors: ${JSON.stringify(pageErrors, null, 2)}`).toEqual([]);
    expect(consoleErrors, `Console error messages: ${JSON.stringify(consoleErrors, null, 2)}`).toEqual([]);
  });

  test.describe('Initial Idle State (S0_Idle) and Data Generation (S1_DataGenerated)', () => {
    test('Initial UI is idle: controls are present and training is disabled', async ({ page }) => {
      const p = new OverfittingPage(page);

      // Verify static components per FSM S0 evidence
      await expect(p.locators.generateData).toBeVisible();
      await expect(p.locators.trainModel).toBeVisible();
      await expect(p.locators.trainModel).toBeDisabled();
      await expect(p.locators.evaluateModel).toBeDisabled();
      await expect(p.locators.addPoint).toBeDisabled();
      await expect(p.locators.clearData).toBeDisabled();
      await expect(p.locators.splitData).toBeDisabled();
      await expect(p.locators.computeTrainError).toBeDisabled();
      await expect(p.locators.computeValError).toBeDisabled();

      // data-status initially empty
      await expect(p.locators.dataStatus).toBeVisible();
    });

    test('Click Generate Data -> transitions to Data Generated (S1_DataGenerated)', async ({ page }) => {
      const p = new OverfittingPage(page);

      // Set deterministic-ish parameters for generation
      await p.locators.noiseLevel.fill('0.05');
      await p.locators.numPoints.fill('20');

      // Click generate and assert S1 entry actions are visible in DOM
      await p.clickGenerateData();

      // Buttons should be enabled/disabled per generateData()
      await expect(p.locators.trainModel).toBeEnabled();
      await expect(p.locators.evaluateModel).toBeDisabled();
      await expect(p.locators.splitData).toBeEnabled();
      await expect(p.locators.addPoint).toBeEnabled();
      await expect(p.locators.clearData).toBeEnabled();
      await expect(p.locators.computeTrainError).toBeDisabled();
      await expect(p.locators.computeValError).toBeDisabled();

      // training status should mention generated points
      const trainStatusText = await p.locators.trainStatus.textContent();
      expect(trainStatusText).toMatch(/Data generated with \d+ points\./i);
    });
  });

  test.describe('Training (S2_ModelTrained) and Evaluation (S3_ModelEvaluated)', () => {
    test('Train model after data generation -> Model Trained (S2_ModelTrained)', async ({ page }) => {
      const p = new OverfittingPage(page);

      // Generate first
      await p.clickGenerateData();

      // Ensure default model params UI present (poly degree input)
      await expect(p.locators.modelParams).toBeVisible();
      // Train model
      await p.clickTrainModel();

      // Evaluate side effects per FSM S2
      await expect(p.locators.trainStatus).toContainText(/Model trained:/i);
      await expect(p.locators.evaluateModel).toBeEnabled();
      await expect(p.locators.computeTrainError).toBeEnabled();
    });

    test('Evaluate trained model -> Model Evaluated (S3_ModelEvaluated)', async ({ page }) => {
      const p = new OverfittingPage(page);

      // Generate and train
      await p.clickGenerateData();
      await p.clickTrainModel();

      // Evaluate
      await p.clickEvaluateModel();

      // Eval status expected
      const evalText = await p.locators.evalStatus.textContent();
      expect(evalText).toMatch(/Model evaluated on grid\./i);

      // The plot canvas should be drawn (canvas exists and is visible)
      await expect(p.locators.canvas).toBeVisible();
      const box = await p.locators.canvas.boundingBox();
      expect(box.width).toBeGreaterThan(0);
      expect(box.height).toBeGreaterThan(0);
    });
  });

  test.describe('Errors and Metrics (S7_TrainingErrorComputed & S8_ValidationErrorComputed)', () => {
    test('Compute Training MSE after training -> Training Error Computed (S7_TrainingErrorComputed)', async ({ page }) => {
      const p = new OverfittingPage(page);

      // Generate and train
      await p.clickGenerateData();
      await p.clickTrainModel();

      // Compute training error and validate format
      await p.clickComputeTrainError();
      const trainErrText = await p.locators.trainError.textContent();
      expect(trainErrText).toMatch(/^Training MSE:\s*[-+]?\d+(\.\d+)?/i);

      // Ensure numerical value parseable
      const numMatch = trainErrText.match(/Training MSE:\s*([-+]?\d+(\.\d+)?)/i);
      expect(numMatch).not.toBeNull();
      const val = parseFloat(numMatch[1]);
      expect(Number.isFinite(val)).toBe(true);
      expect(val).toBeGreaterThanOrEqual(0);
    });

    test('Split data, train, and compute validation MSE -> Validation Error Computed (S8_ValidationErrorComputed)', async ({ page }) => {
      const p = new OverfittingPage(page);

      // Generate data
      await p.clickGenerateData();

      // Ensure validation ratio is set to 0.2 by default; set to a small value to guarantee non-empty val set for small N
      await p.locators.valRatio.fill('0.2');

      // Click split
      await p.clickSplitData();

      // After split, training must be possible (unless train set empty)
      const trainDisabledAfterSplit = await p.locators.trainModel.isDisabled();
      expect(trainDisabledAfterSplit).toBe(false);

      // Train on the split train set
      await p.clickTrainModel();

      // After train and split, compute-val-error should be enabled by updateValErrorButton
      // Wait a tick for the updateValErrorButton handler to run
      await page.waitForTimeout(50);

      const valBtnDisabled = await p.locators.computeValError.isDisabled();
      expect(valBtnDisabled).toBe(false);

      // Compute validation MSE and validate format
      await p.clickComputeValError();
      const valErrText = await p.locators.valError.textContent();
      expect(valErrText).toMatch(/^Validation MSE:\s*[-+]?\d+(\.\d+)?/i);

      const valMatch = valErrText.match(/Validation MSE:\s*([-+]?\d+(\.\d+)?)/i);
      expect(valMatch).not.toBeNull();
      const valNum = parseFloat(valMatch[1]);
      expect(Number.isFinite(valNum)).toBe(true);
      expect(valNum).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Advanced Controls: Manual point (S4_ManualPointAdded), Clear (S5_DataCleared), and Removal', () => {
    test('Add a manual training point -> Manual Point Added (S4_ManualPointAdded) and retrain (S2)', async ({ page }) => {
      const p = new OverfittingPage(page);

      // Generate data so add-point is enabled
      await p.clickGenerateData();

      // Set manual coordinates (defaults exist), but set explicit x/y for determinism
      await p.locators.manualX.fill('0.50');
      await p.locators.manualY.fill('0.00');

      // Click Add Training Point
      await p.clickAddPoint();

      // train-status should indicate addition
      const addedText = await p.locators.trainStatus.textContent();
      expect(addedText).toMatch(/Added point/i);

      // Now retrain
      await p.clickTrainModel();
      await expect(p.locators.trainStatus).toContainText(/Model trained:/i);
    });

    test('Clear data -> Data Cleared (S5_DataCleared) disables controls', async ({ page }) => {
      const p = new OverfittingPage(page);

      // Generate data and then clear
      await p.clickGenerateData();
      await p.clickClearData();

      // Buttons should be disabled per clearData() action
      await expect(p.locators.trainModel).toBeDisabled();
      await expect(p.locators.evaluateModel).toBeDisabled();
      await expect(p.locators.addPoint).toBeDisabled();
      await expect(p.locators.clearData).toBeDisabled();
      await expect(p.locators.splitData).toBeDisabled();
      await expect(p.locators.computeTrainError).toBeDisabled();
      await expect(p.locators.computeValError).toBeDisabled();
    });

    test('Enable point removal and remove a recently added point (canvas click removes training point)', async ({ page }) => {
      const p = new OverfittingPage(page);

      // Generate data, add a manual point at a known normalized x=0.5
      await p.clickGenerateData();

      // Set manual coordinates to center and add
      await p.locators.manualX.fill('0.50');
      await p.locators.manualY.fill('0.00');
      await p.clickAddPoint();

      // Ensure removal is enabled
      await p.enablePointRemovalCheckbox();

      // Click near center of canvas where the added point should appear (x ~ 0.5)
      // We compute normalized coords and click. Use yNorm roughly 0.5 to target center vertically.
      await p.canvasClickAtNormalized(page, 0.5, 0.5);

      // After removal, train-status should mention removal
      await expect(p.locators.trainStatus).toContainText(/Removed training point/i);

      // The model must be invalidated (train-model should be enabled so user can retrain)
      await expect(p.locators.trainModel).toBeEnabled();
      // And evaluation must be disabled because trainedModel is null after removal
      await expect(p.locators.evaluateModel).toBeDisabled();
    });
  });

  test.describe('Edge cases and negative scenarios', () => {
    test('Attempting to compute train error without a trained model shows appropriate message', async ({ page }) => {
      const p = new OverfittingPage(page);

      // Generate data so compute-train-error remains disabled initially
      await p.clickGenerateData();

      // Ensure compute-train-error is disabled (no trained model)
      await expect(p.locators.computeTrainError).toBeDisabled();

      // Now train and then clear to create scenario where compute-train-error won't run:
      // Clear data and then attempt to click compute-train-error by invoking the button via Playwright API is not allowed when disabled.
      // Instead, we assert the UI prevents the action by being disabled and that train-status informs the user when Clear happened.
      await p.clickClearData();
      await expect(p.locators.computeTrainError).toBeDisabled();

      // The train-status should explicitly say dataset cleared (S5 evidence)
      await expect(p.locators.trainStatus).toHaveText('Dataset cleared.');
    });

    test('Switching model types updates params UI and does not crash', async ({ page }) => {
      const p = new OverfittingPage(page);

      // Generate data
      await p.clickGenerateData();

      // Switch to k-NN model and ensure params updated
      await p.locators.modelType.selectOption('knn');
      await expect(p.locators.modelParams).toContainText(/k \(number of neighbors\)/i);
      // Train should remain possible
      await expect(p.locators.trainModel).toBeEnabled();

      // Switch to piecewise-linear
      await p.locators.modelType.selectOption('piecewise-linear');
      await expect(p.locators.modelParams).toContainText(/Number of pieces/i);

      // Switch to moving-average
      await p.locators.modelType.selectOption('moving-average');
      await expect(p.locators.modelParams).toContainText(/Window size/i);

      // Train with current params to ensure no crash
      await p.clickTrainModel();
      await expect(p.locators.trainStatus).toContainText(/Model trained:/i);
    });
  });
});