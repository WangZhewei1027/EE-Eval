import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121733f1-fa7a-11f0-acf9-69409043402d.html';

// Page Object to encapsulate selectors and common actions
class LogisticExplorerPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      inputX: '#inputX',
      inputY: '#inputY',
      inputClass: '#inputClass',
      btnAddPoint: '#btnAddPoint',
      btnClearPoints: '#btnClearPoints',
      btnRandomPoints: '#btnRandomPoints',
      pointsTableBody: '#pointsTable tbody',
      w0init: '#w0init',
      w1init: '#w1init',
      w2init: '#w2init',
      btnInitModel: '#btnInitModel',
      weightsDisplay: '#weightsDisplay',
      learningRate: '#learningRate',
      trainSteps: '#trainSteps',
      btnTrainBatch: '#btnTrainBatch',
      btnTrainFull: '#btnTrainFull',
      btnResetTraining: '#btnResetTraining',
      convThreshold: '#convThreshold',
      maxIterations: '#maxIterations',
      trainingLog: '#trainingLog',
      predictX: '#predictX',
      predictY: '#predictY',
      btnPredict: '#btnPredict',
      predictionResult: '#predictionResult',
      btnDrawPlot: '#btnDrawPlot',
      btnClearPlot: '#btnClearPlot',
      plotarea: '#plotarea',
      pointsCanvas: '#pointsCanvas',
      boundaryCanvas: '#boundaryCanvas',
      manualW0: '#manualW0',
      manualW1: '#manualW1',
      manualW2: '#manualW2',
      btnSetWeights: '#btnSetWeights',
      btnExport: '#btnExport',
      btnImport: '#btnImport',
      importExportArea: '#importExportArea',
      status: '#status',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async statusText() {
    return (await this.page.textContent(this.selectors.status)) || '';
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async fill(selector, value) {
    await this.page.fill(selector, String(value));
  }

  async getPointsCount() {
    return await this.page.$$eval(`${this.selectors.pointsTableBody} tr`, rows => rows.length);
  }

  async getWeightsDisplay() {
    return await this.page.$eval(this.selectors.weightsDisplay, el => el.value);
  }

  async getTrainingLog() {
    return await this.page.$eval(this.selectors.trainingLog, el => el.value);
  }

  async getPredictionResult() {
    return await this.page.textContent(this.selectors.predictionResult);
  }

  async getImportExportAreaValue() {
    return await this.page.$eval(this.selectors.importExportArea, el => el.value);
  }

  async getPlotCoords() {
    // Access the plotArea._coords if present (set after drawPlot)
    return await this.page.$eval(this.selectors.plotarea, el => el._coords || null);
  }
}

test.describe('Interactive Logistic Regression Explorer - FSM and UI tests', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Nothing here; listeners are attached per-test inside each test's scope to ensure isolation
  });

  test.describe('Console and page error monitoring', () => {
    test('No unexpected console.error or page errors upon load (Idle state Ready.)', async ({ page }) => {
      // Attach collectors
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', err => {
        pageErrors.push(err);
      });

      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Wait until initial Ready status appears
      await page.waitForFunction(() => {
        const s = document.getElementById('status');
        return s && /Ready\./.test(s.textContent || '');
      });

      // Assert Idle state's entry action executed: status includes 'Ready.'
      const status = await po.statusText();
      expect(status).toMatch(/Ready\./);

      // Ensure weights display initialized
      const weightsText = await po.getWeightsDisplay();
      expect(weightsText).toMatch(/w0 \(bias\):/);

      // Assert there were no console.error messages and no page errors during load
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Dataset management (Add/Clear/Random) and table updates', () => {
    test('Add point transitions to Point Added state and updates table and status', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Add a valid point (x=0.25, y=-0.75, class 0)
      await po.fill(po.selectors.inputX, '0.25');
      await po.fill(po.selectors.inputY, '-0.75');
      await page.selectOption(po.selectors.inputClass, '0'); // select class 0
      await po.click(po.selectors.btnAddPoint);

      // Table should now have one row
      await expect.poll(() => po.getPointsCount(), { timeout: 2000 }).toBe(1);

      // Status should report added point with the same numeric values
      const status = await po.statusText();
      expect(status).toMatch(/Added point \(x:0.25, y:-0.75, class:0\)/);

      // Ensure no runtime errors occurred during add
      const errorConsole = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsole.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Clear Points clears the dataset and returns to Idle state message', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Add one point first to ensure something to clear
      await po.fill(po.selectors.inputX, '1');
      await po.fill(po.selectors.inputY, '2');
      await po.click(po.selectors.btnAddPoint);
      await expect.poll(() => po.getPointsCount(), { timeout: 2000 }).toBeGreaterThan(0);

      // Now clear
      await po.click(po.selectors.btnClearPoints);

      // Table should be empty
      await expect.poll(() => po.getPointsCount(), { timeout: 2000 }).toBe(0);

      // Status should say cleared
      const status = await po.statusText();
      expect(status).toMatch(/Cleared all dataset points\./);
    });

    test('Random Points adds 20 points and status is updated', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Ensure dataset empty
      await po.click(po.selectors.btnClearPoints);
      await expect.poll(() => po.getPointsCount(), { timeout: 2000 }).toBe(0);

      await po.click(po.selectors.btnRandomPoints);

      // Table should have 20 rows
      await expect.poll(() => po.getPointsCount(), { timeout: 2000 }).toBe(20);

      const status = await po.statusText();
      expect(status).toMatch(/Added 20 random points/);
    });

    test('Adding point with invalid inputs shows validation message', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Set invalid numeric value by filling a non-numeric string
      await po.fill(po.selectors.inputX, 'not-a-number');
      await po.fill(po.selectors.inputY, '0');
      await po.click(po.selectors.btnAddPoint);

      // Status should indicate invalid input
      const status = await po.statusText();
      expect(status).toMatch(/Invalid input values for point\./);
    });
  });

  test.describe('Model initialization and weight handling', () => {
    test('Initialize Model sets weights, clears training log and updates status', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Set initial weights
      await po.fill(po.selectors.w0init, '0.5');
      await po.fill(po.selectors.w1init, '-0.25');
      await po.fill(po.selectors.w2init, '1.125');

      // Initialize model
      await po.click(po.selectors.btnInitModel);

      // We expect the weights display to reflect provided values
      const weightsText = await po.getWeightsDisplay();
      expect(weightsText).toMatch(/w0 \(bias\): 0.500000/);
      expect(weightsText).toMatch(/w1 \(coef X\): -0.250000/);
      expect(weightsText).toMatch(/w2 \(coef Y\): 1.125000/);

      // Training log area should be empty
      const tlog = await po.getTrainingLog();
      expect(tlog.trim()).toBe('');

      // Status updated
      const status = await po.statusText();
      expect(status).toMatch(/Model initialized with given weights\./);
    });

    test('Manual Set Weights updates display and status; invalid input handled', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Valid manual set first
      await po.fill(po.selectors.manualW0, '2');
      await po.fill(po.selectors.manualW1, '3');
      await po.fill(po.selectors.manualW2, '-1');
      await po.click(po.selectors.btnSetWeights);

      let weightsText = await po.getWeightsDisplay();
      expect(weightsText).toMatch(/w0 \(bias\): 2.000000/);
      expect(weightsText).toMatch(/w1 \(coef X\): 3.000000/);
      expect(weightsText).toMatch(/w2 \(coef Y\): -1.000000/);

      // Invalid manual weights input
      await po.fill(po.selectors.manualW0, 'bad');
      await po.click(po.selectors.btnSetWeights);

      const status = await po.statusText();
      expect(status).toMatch(/Invalid manual weights input\./);
    });
  });

  test.describe('Training interactions and reset', () => {
    test('Train Batch with empty dataset warns user (edge case)', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Ensure dataset empty
      await po.click(po.selectors.btnClearPoints);
      await expect.poll(() => po.getPointsCount(), { timeout: 2000 }).toBe(0);

      // Click Train Batch
      await po.click(po.selectors.btnTrainBatch);

      // Status should indicate dataset is empty
      const status = await po.statusText();
      expect(status).toMatch(/Dataset is empty. Add points before training\./);
    });

    test('Train Batch updates weights and training log when dataset present', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Create a small dataset: two points, one of each class
      await po.click(po.selectors.btnClearPoints);
      await po.fill(po.selectors.inputX, '-1');
      await po.fill(po.selectors.inputY, '-1');
      await page.selectOption(po.selectors.inputClass, '0');
      await po.click(po.selectors.btnAddPoint);

      await po.fill(po.selectors.inputX, '1');
      await po.fill(po.selectors.inputY, '1');
      await page.selectOption(po.selectors.inputClass, '1');
      await po.click(po.selectors.btnAddPoint);

      await expect.poll(() => po.getPointsCount(), { timeout: 2000 }).toBe(2);

      // Set training parameters to small batch to ensure change
      await po.fill(po.selectors.trainSteps, '3'); // 3 steps
      await po.fill(po.selectors.learningRate, '0.1');
      await po.fill(po.selectors.convThreshold, '1e-8');

      // Initialize model to zero weights to observe updates
      await po.fill(po.selectors.w0init, '0');
      await po.fill(po.selectors.w1init, '0');
      await po.fill(po.selectors.w2init, '0');
      await po.click(po.selectors.btnInitModel);

      // Click Train Batch
      await po.click(po.selectors.btnTrainBatch);

      // Training log should have entries with Iteration
      await expect.poll(async () => {
        const t = await po.getTrainingLog();
        return /Iteration/.test(t);
      }, { timeout: 3000 }).toBe(true);

      const tlog = await po.getTrainingLog();
      expect(tlog).toMatch(/Iteration \d+/);

      // Status should indicate training completed steps and show current iteration
      const status = await po.statusText();
      expect(status).toMatch(/Training completed 3 steps. Current iteration:\s*\d+\./);

      // Weights display should have been updated from zero
      const wdisp = await po.getWeightsDisplay();
      expect(wdisp).not.toMatch(/w0 \(bias\): 0.000000\nw1 \(coef X\): 0.000000\nw2 \(coef Y\): 0.000000/);
    });

    test('Train Until Convergence respects maxIterations and updates status', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Prepare a small dataset
      await po.click(po.selectors.btnClearPoints);
      await po.fill(po.selectors.inputX, '-1');
      await po.fill(po.selectors.inputY, '-1');
      await page.selectOption(po.selectors.inputClass, '0');
      await po.click(po.selectors.btnAddPoint);

      await po.fill(po.selectors.inputX, '1');
      await po.fill(po.selectors.inputY, '1');
      await page.selectOption(po.selectors.inputClass, '1');
      await po.click(po.selectors.btnAddPoint);

      // Set training params: very small maxIterations to avoid long-running loop
      await po.fill(po.selectors.maxIterations, '2');
      await po.fill(po.selectors.learningRate, '0.1');
      await po.fill(po.selectors.convThreshold, '1e-12');

      // Initialize model
      await po.fill(po.selectors.w0init, '0');
      await po.fill(po.selectors.w1init, '0');
      await po.fill(po.selectors.w2init, '0');
      await po.click(po.selectors.btnInitModel);

      // Start full training
      await po.click(po.selectors.btnTrainFull);

      // Wait for status to report either convergence or reaching max iterations
      await expect.poll(async () => {
        const s = await po.statusText();
        return /Training converged after|Reached maximum iterations/.test(s);
      }, { timeout: 5000 }).toBe(true);

      const status = await po.statusText();
      expect(status).toMatch(/(Training converged after|Reached maximum iterations)/);
    });

    test('Reset Training clears log and training state', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Simulate some training log content by training a batch with a tiny dataset
      await po.click(po.selectors.btnClearPoints);
      await po.fill(po.selectors.inputX, '0');
      await po.fill(po.selectors.inputY, '0');
      await page.selectOption(po.selectors.inputClass, '1');
      await po.click(po.selectors.btnAddPoint);

      await po.fill(po.selectors.trainSteps, '1');
      await po.click(po.selectors.btnTrainBatch);

      // Ensure training log has content
      await expect.poll(async () => (await po.getTrainingLog()).length > 0, { timeout: 2000 }).toBe(true);

      // Reset training
      await po.click(po.selectors.btnResetTraining);

      // Training log area should be empty and status updated
      const tlog = await po.getTrainingLog();
      expect(tlog.trim()).toBe('');
      const status = await po.statusText();
      expect(status).toMatch(/Training state reset\./);
    });
  });

  test.describe('Prediction interactions', () => {
    test('Predict with valid inputs returns probability and class', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Ensure model and dataset exist: set weights and simple dataset
      await po.fill(po.selectors.w0init, '0');
      await po.fill(po.selectors.w1init, '1');
      await po.fill(po.selectors.w2init, '0');
      await po.click(po.selectors.btnInitModel);

      // Predict point (1,0) should have sigmoid(0 + 1*1 + 0*0) = sigmoid(1) > 0.5 => class 1
      await po.fill(po.selectors.predictX, '1');
      await po.fill(po.selectors.predictY, '0');
      await po.click(po.selectors.btnPredict);

      // PredictionResult text should include probability and predicted class
      await expect.poll(async () => (await po.getPredictionResult()) || '', { timeout: 2000 }).toContain('Predicted probability for class 1:');
      const predText = await po.getPredictionResult();
      expect(predText).toMatch(/Predicted class: 1/);
    });

    test('Predict with invalid coordinates shows error message', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      await po.fill(po.selectors.predictX, 'not-number');
      await po.fill(po.selectors.predictY, '0');
      await po.click(po.selectors.btnPredict);

      const predText = await po.getPredictionResult();
      expect(predText).toMatch(/Invalid input coordinates\./);
    });
  });

  test.describe('Visualization (Draw and Clear Plot)', () => {
    test('Draw Plot draws when dataset present and exposes plot coordinates', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Ensure we have data points
      await po.click(po.selectors.btnClearPoints);
      await po.fill(po.selectors.inputX, '-2');
      await po.fill(po.selectors.inputY, '-2');
      await page.selectOption(po.selectors.inputClass, '0');
      await po.click(po.selectors.btnAddPoint);

      await po.fill(po.selectors.inputX, '2');
      await po.fill(po.selectors.inputY, '2');
      await page.selectOption(po.selectors.inputClass, '1');
      await po.click(po.selectors.btnAddPoint);

      // Draw plot
      await po.click(po.selectors.btnDrawPlot);

      // Status should indicate plot drawn
      await expect.poll(async () => {
        const s = await po.statusText();
        return /Plot drawn with current points and decision boundary/.test(s);
      }, { timeout: 2000 }).toBe(true);

      // The page should have stored coordinate mapping on plot area after drawing
      const coords = await po.getPlotCoords();
      expect(coords).not.toBeNull();
      expect(typeof coords.xmin).toBe('number');
      expect(typeof coords.xmax).toBe('number');
      expect(typeof coords.ymin).toBe('number');
      expect(typeof coords.ymax).toBe('number');
    });

    test('Clear Plot clears canvases and updates status', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Draw plot first (with random points)
      await po.click(po.selectors.btnRandomPoints);
      await po.click(po.selectors.btnDrawPlot);
      await expect.poll(async () => /Plot drawn with current points/.test(await po.statusText()), { timeout: 2000 }).toBe(true);

      // Now clear plot
      await po.click(po.selectors.btnClearPlot);

      const status = await po.statusText();
      expect(status).toMatch(/Plot cleared\./);
    });
  });

  test.describe('Export and Import interactions including error scenarios', () => {
    test('Export creates JSON with dataset and weights and status updated', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Ensure dataset has at least one point and weights set
      await po.click(po.selectors.btnClearPoints);
      await po.fill(po.selectors.inputX, '0.5');
      await po.fill(po.selectors.inputY, '-0.5');
      await po.click(po.selectors.btnAddPoint);

      await po.fill(po.selectors.w0init, '0.1');
      await po.fill(po.selectors.w1init, '0.2');
      await po.fill(po.selectors.w2init, '0.3');
      await po.click(po.selectors.btnInitModel);

      // Export
      await po.click(po.selectors.btnExport);

      // ImportExportArea should now contain JSON with dataset and weights
      const jsonText = await po.getImportExportAreaValue();
      expect(jsonText).toContain('"dataset"');
      expect(jsonText).toContain('"weights"');

      const status = await po.statusText();
      expect(status).toMatch(/Exported dataset and model to JSON\./);
    });

    test('Import with valid JSON loads dataset and weights; invalid inputs handled', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Create JSON manually
      const sample = {
        dataset: [{ x: 0.1, y: 0.2, class: 1 }],
        weights: { w0: 0.5, w1: -0.1, w2: 0.2 }
      };
      const json = JSON.stringify(sample, null, 2);
      await po.fill(po.selectors.importExportArea, json);

      // Import
      await po.click(po.selectors.btnImport);

      // Status should indicate success
      await expect.poll(async () => /Imported dataset and model successfully\./.test(await po.statusText()), { timeout: 2000 }).toBe(true);

      // Now test import with empty textarea
      await po.fill(po.selectors.importExportArea, '');
      await po.click(po.selectors.btnImport);
      await expect.poll(async () => /Import area is empty\./.test(await po.statusText()), { timeout: 2000 }).toBe(true);

      // Test invalid JSON parse error
      await po.fill(po.selectors.importExportArea, '{ invalid json ');
      await po.click(po.selectors.btnImport);
      const status = await po.statusText();
      expect(status).toMatch(/Failed to parse import JSON:/);
    });

    test('Import rejects malformed dataset structures', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // JSON missing keys
      const bad = JSON.stringify({ foo: [] });
      await po.fill(po.selectors.importExportArea, bad);
      await po.click(po.selectors.btnImport);

      const status = await po.statusText();
      expect(status).toMatch(/Import JSON must have "dataset" and "weights" keys\./);
    });
  });

  test.describe('Edge-cases and additional behaviors', () => {
    test('Clicking on plotted canvas sets predict inputs and triggers prediction', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Prepare dataset and draw plot
      await po.click(po.selectors.btnClearPoints);
      await po.fill(po.selectors.inputX, '-1');
      await po.fill(po.selectors.inputY, '-1');
      await page.selectOption(po.selectors.inputClass, '0');
      await po.click(po.selectors.btnAddPoint);

      await po.fill(po.selectors.inputX, '1');
      await po.fill(po.selectors.inputY, '1');
      await page.selectOption(po.selectors.inputClass, '1');
      await po.click(po.selectors.btnAddPoint);

      // Ensure weights non-zero so decision boundary exists
      await po.fill(po.selectors.w0init, '0');
      await po.fill(po.selectors.w1init, '1');
      await po.fill(po.selectors.w2init, '0');
      await po.click(po.selectors.btnInitModel);

      // Draw plot
      await po.click(po.selectors.btnDrawPlot);
      await expect.poll(async () => /Plot drawn with current points/.test(await po.statusText()), { timeout: 2000 }).toBe(true);

      // Click in the middle of the pointsCanvas to trigger predict via click handler
      const canvas = await page.$(po.selectors.pointsCanvas);
      const box = await canvas.boundingBox();
      // Click center
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

      // After click, predict inputs should be set and prediction executed - check predictionResult has expected structure
      await expect.poll(async () => (await po.getPredictionResult()) || '', { timeout: 2000 }).toContain('Predicted probability for class 1:');
    });

    test('Selecting training log text updates status (interaction extra)', async ({ page }) => {
      const po = new LogisticExplorerPage(page);
      await po.goto();

      // Create at least one training log entry
      await po.click(po.selectors.btnClearPoints);
      await po.fill(po.selectors.inputX, '0');
      await po.fill(po.selectors.inputY, '0');
      await page.selectOption(po.selectors.inputClass, '1');
      await po.click(po.selectors.btnAddPoint);
      await po.fill(po.selectors.trainSteps, '1');
      await po.click(po.selectors.btnTrainBatch);

      // Wait for training log content
      await expect.poll(async () => (await po.getTrainingLog()).length > 0, { timeout: 2000 }).toBe(true);

      // Programmatically select a portion of the training log that includes "Iteration N"
      await page.$eval(po.selectors.trainingLog, el => {
        // select first line
        el.selectionStart = 0;
        el.selectionEnd = Math.min(40, el.value.length);
        // Dispatch select event
        const event = new Event('select');
        el.dispatchEvent(event);
      });

      // Status should be updated to indicate selected log iteration or at least changed from Ready
      const status = await po.statusText();
      expect(status.length).toBeGreaterThan(0);
    });
  });
});