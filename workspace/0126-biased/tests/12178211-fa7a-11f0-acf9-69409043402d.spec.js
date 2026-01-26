import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12178211-fa7a-11f0-acf9-69409043402d.html';

// Page Object representing the K-Means demo page
class KMeansPage {
  constructor(page) {
    this.page = page;
    this.locators = {
      inputX: page.locator('#input-x'),
      inputY: page.locator('#input-y'),
      addPointBtn: page.locator('#add-point-btn'),
      clearPointsBtn: page.locator('#clear-points-btn'),
      genCount: page.locator('#gen-count'),
      generateRandomBtn: page.locator('#generate-random-btn'),
      kInput: page.locator('#k-input'),
      initCentroidsBtn: page.locator('#init-centroids-btn'),
      stepBtn: page.locator('#step-btn'),
      runBtn: page.locator('#run-btn'),
      resetBtn: page.locator('#reset-btn'),
      initMethodRadios: page.locator('input[name="init-method"]'),
      resetManualCentroidsBtn: page.locator('#reset-manual-centroids'),
      showDistancesBtn: page.locator('#show-distances-btn'),
      exportJsonBtn: page.locator('#export-json-btn'),
      importJsonBtn: page.locator('#import-json-btn'),
      importJsonFileInput: page.locator('#import-json-file'),
      plotArea: page.locator('#plot-area'),
      statusMessage: page.locator('#status-message'),
      iterationCount: page.locator('#iteration-count'),
      sseValue: page.locator('#sse-value'),
      clusterSizes: page.locator('#cluster-sizes')
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getStatusText() {
    return await this.locators.statusMessage.textContent();
  }

  async getIteration() {
    return (await this.locators.iterationCount.textContent()).trim();
  }

  async getSSE() {
    return (await this.locators.sseValue.textContent()).trim();
  }

  async getClusterSizesText() {
    return (await this.locators.clusterSizes.textContent()).trim();
  }

  async addPoint(x, y) {
    await this.locators.inputX.fill(String(x));
    await this.locators.inputY.fill(String(y));
    await this.locators.addPointBtn.click();
  }

  async attemptAddPointExpectAlert(x, y) {
    // Will click and return the alert message if raised
    const alerts = [];
    this.page.once('dialog', async dialog => {
      alerts.push(dialog.message());
      await dialog.accept();
    });
    await this.locators.inputX.fill(String(x));
    await this.locators.inputY.fill(String(y));
    await this.locators.addPointBtn.click();
    return alerts[0];
  }

  async clearPoints(accept = true) {
    const dialogs = [];
    this.page.once('dialog', async dialog => {
      dialogs.push(dialog.message());
      if (accept) await dialog.accept(); else await dialog.dismiss();
    });
    await this.locators.clearPointsBtn.click();
    return dialogs[0];
  }

  async generateRandom(count) {
    await this.locators.genCount.fill(String(count));
    await this.locators.generateRandomBtn.click();
  }

  async setK(k) {
    await this.locators.kInput.fill(String(k));
    // trigger change event by blurring
    await this.locators.kInput.press('Tab');
  }

  async clickInitCentroids() {
    await this.locators.initCentroidsBtn.click();
  }

  async clickStep() {
    await this.locators.stepBtn.click();
  }

  async clickRun() {
    await this.locators.runBtn.click();
  }

  async clickReset() {
    await this.locators.resetBtn.click();
  }

  async selectInitMethod(value) {
    // value is 'random' | 'kmeans++' | 'manual'
    const radio = this.page.locator(`input[name="init-method"][value="${value}"]`);
    await radio.check();
    // wait for change handlers to run
    await this.page.waitForTimeout(50);
  }

  async clickPlotAt(offsetX = 10, offsetY = 10) {
    // Click on the plot area at an offset relative to top-left
    const box = await this.locators.plotArea.boundingBox();
    if (!box) throw new Error('Plot area bounding box not available');
    const x = Math.max(1, Math.min(box.width - 1, offsetX));
    const y = Math.max(1, Math.min(box.height - 1, offsetY));
    await this.locators.plotArea.click({ position: { x, y } });
  }

  async toggleShowDistances() {
    await this.locators.showDistancesBtn.click();
  }

  async importJsonFileFromContent(filename, content) {
    // Create a temporary file via playwright setInputFiles - uses name and buffer
    await this.locators.importJsonFileInput.setInputFiles({
      name: filename,
      mimeType: 'application/json',
      buffer: Buffer.from(content, 'utf-8')
    });
    // Wait for import handler
    await this.page.waitForTimeout(100);
  }

  async countCentroidElements() {
    // Centroid circles have attribute data-centroid-index
    return await this.locators.plotArea.locator('circle[data-centroid-index]').count();
  }

  async countPointElements() {
    // Points are small circle elements without data-centroid-index
    // We'll count circles and subtract centroid circles
    const totalCircles = await this.locators.plotArea.locator('circle').count();
    const centroidCircles = await this.locators.plotArea.locator('circle[data-centroid-index]').count();
    // grid lines etc are lines, not circles
    return totalCircles - centroidCircles;
  }

  async getShowDistancesButtonText() {
    return await this.locators.showDistancesBtn.textContent();
  }

  async exportJSONClick() {
    // clicking export triggers a programmatic download; we just click and ensure no error
    await this.locators.exportJsonBtn.click();
    await this.page.waitForTimeout(50);
  }
}

// Global convenience to capture console errors and page errors
function setupErrorCapture(page) {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });
  page.on('pageerror', err => {
    pageErrors.push(String(err.message || err));
  });
  return { consoleErrors, pageErrors };
}

test.describe('K-Means Clustering Interactive Demo - FSM and UI Tests', () => {
  // Each test will set up its own page and capture console/page errors
  test('Initial state (S0_Idle): page loads and shows Idle state', async ({ page }) => {
    const errors = setupErrorCapture(page);
    const app = new KMeansPage(page);
    await app.goto();

    // Validate initial status message and disabled controls
    await expect(app.locators.statusMessage).toHaveText('No points in dataset.');
    await expect(app.locators.initCentroidsBtn).toBeDisabled();
    await expect(app.locators.stepBtn).toBeDisabled();
    await expect(app.locators.runBtn).toBeDisabled();
    await expect(app.locators.resetBtn).toBeDisabled();

    // No console or page errors occurred
    expect(errors.consoleErrors.length, `Console errors: ${errors.consoleErrors.join(' | ')}`).toBe(0);
    expect(errors.pageErrors.length, `Page errors: ${errors.pageErrors.join(' | ')}`).toBe(0);
  });

  test.describe('Point management and dataset transitions', () => {
    test('S0 -> S1 : AddPoint transitions to HasPoints and update status', async ({ page }) => {
      const errors = setupErrorCapture(page);
      const app = new KMeansPage(page);
      await app.goto();

      // Add a single point using defaults (50,50)
      await app.addPoint(50, 50);

      // Status should reflect dataset has 1 point and k default 3
      await expect(app.locators.statusMessage).toHaveText(/Dataset:\s*1 points,\s*k=3/);
      // init-centroids should be enabled (page enables it once there are any points)
      await expect(app.locators.initCentroidsBtn).toBeEnabled();

      // Graph should show one point circle
      const pointCount = await app.countPointElements();
      expect(pointCount).toBeGreaterThanOrEqual(1);

      // No console or page errors
      expect(errors.consoleErrors.length, `Console errors: ${errors.consoleErrors.join(' | ')}`).toBe(0);
      expect(errors.pageErrors.length, `Page errors: ${errors.pageErrors.join(' | ')}`).toBe(0);
    });

    test('Edge case: AddPoint with invalid coordinates triggers alert and does not add', async ({ page }) => {
      const errors = setupErrorCapture(page);
      const app = new KMeansPage(page);
      await app.goto();

      // Try to add invalid coordinate (out of range)
      const alertMessage = await app.attemptAddPointExpectAlert(150, 50); // x=150 out of range
      expect(alertMessage).toMatch(/Invalid coordinates/);

      // Ensure still in Idle (no points)
      await expect(app.locators.statusMessage).toHaveText('No points in dataset.');

      expect(errors.consoleErrors.length, `Console errors: ${errors.consoleErrors.join(' | ')}`).toBe(0);
      expect(errors.pageErrors.length, `Page errors: ${errors.pageErrors.join(' | ')}`).toBe(0);
    });

    test('GenerateRandomPoints adds multiple points and update status', async ({ page }) => {
      const errors = setupErrorCapture(page);
      const app = new KMeansPage(page);
      await app.goto();

      // Ensure we start clean; no points yet
      await expect(app.locators.statusMessage).toHaveText('No points in dataset.');

      // Generate 5 random points
      await app.generateRandom(5);

      // Status should show 5 points
      await expect(app.locators.statusMessage).toHaveText(/Dataset:\s*5 points,\s*k=3/);

      // Points rendered on plot
      const pointCount = await app.countPointElements();
      expect(pointCount).toBeGreaterThanOrEqual(5);

      expect(errors.consoleErrors.length, `Console errors: ${errors.consoleErrors.join(' | ')}`).toBe(0);
      expect(errors.pageErrors.length, `Page errors: ${errors.pageErrors.join(' | ')}`).toBe(0);
    });

    test('ClearPoints transitions back to Idle with confirmation handling', async ({ page }) => {
      const errors = setupErrorCapture(page);
      const app = new KMeansPage(page);
      await app.goto();

      // Add some points first
      await app.generateRandom(3);
      await expect(app.locators.statusMessage).toHaveText(/Dataset:\s*3 points/);

      // Test canceling the clear: should preserve points
      const cancelMsg = await app.clearPoints(false); // dismiss confirm
      expect(cancelMsg).toMatch(/Are you sure you want to clear all points/);
      await expect(app.locators.statusMessage).toHaveText(/Dataset:\s*3 points/);

      // Now accept clear
      const acceptMsg = await app.clearPoints(true);
      expect(acceptMsg).toMatch(/Are you sure you want to clear all points/);
      // After accepting, we should be back to Idle
      await expect(app.locators.statusMessage).toHaveText('No points in dataset.');
      // Verify plot is cleared (no data point circles)
      const pointCount = await app.countPointElements();
      expect(pointCount).toBeLessThanOrEqual(0);

      expect(errors.consoleErrors.length, `Console errors: ${errors.consoleErrors.join(' | ')}`).toBe(0);
      expect(errors.pageErrors.length, `Page errors: ${errors.pageErrors.join(' | ')}`).toBe(0);
    });
  });

  test.describe('Centroid initialization and iterations', () => {
    test('InitCentroids (Random) initializes centroids and enables iteration controls', async ({ page }) => {
      const errors = setupErrorCapture(page);
      const app = new KMeansPage(page);
      await app.goto();

      // Ensure we have enough points for k=3
      await app.generateRandom(10);
      await expect(app.locators.statusMessage).toHaveText(/Dataset:\s*10 points,\s*k=3/);

      // Click initialize centroids (random)
      await app.clickInitCentroids();

      // After initialization, centroid circles should be present equal to k
      // Wait briefly for drawing
      await page.waitForTimeout(100);
      const centroids = await app.countCentroidElements();
      expect(centroids).toBe(3);

      // Step and Run buttons should be enabled
      await expect(app.locators.stepBtn).toBeEnabled();
      await expect(app.locators.runBtn).toBeEnabled();

      // Iteration count should be zero after init
      expect(Number(await app.getIteration())).toBeGreaterThanOrEqual(0);

      expect(errors.consoleErrors.length, `Console errors: ${errors.consoleErrors.join(' | ')}`).toBe(0);
      expect(errors.pageErrors.length, `Page errors: ${errors.pageErrors.join(' | ')}`).toBe(0);
    });

    test('RunIteration (Step) increments iteration count and possibly converges', async ({ page }) => {
      const errors = setupErrorCapture(page);
      const app = new KMeansPage(page);
      await app.goto();

      // Prepare a small deterministic dataset: 3 points and k=3 so centroids pick points directly
      await app.generateRandom(3);
      // Initialize centroids
      await app.clickInitCentroids();
      await page.waitForTimeout(100);

      const iterBefore = Number(await app.getIteration());
      await app.clickStep();
      // Wait for update
      await page.waitForTimeout(50);
      const iterAfter = Number(await app.getIteration());
      expect(iterAfter).toBeGreaterThanOrEqual(iterBefore + 1);

      // If algorithm converged, status would contain "(Converged)"; if not, still valid.
      const status = await app.getStatusText();
      expect(status).toMatch(/Dataset:\s*\d+\s*points,\s*k=\d+/);

      expect(errors.consoleErrors.length, `Console errors: ${errors.consoleErrors.join(' | ')}`).toBe(0);
      expect(errors.pageErrors.length, `Page errors: ${errors.pageErrors.join(' | ')}`).toBe(0);
    });

    test('RunUntilConvergence handles convergence loop and updates status', async ({ page }) => {
      const errors = setupErrorCapture(page);
      const app = new KMeansPage(page);
      await app.goto();

      // Create a dataset and initialize centroids
      await app.generateRandom(6);
      await app.clickInitCentroids();
      await page.waitForTimeout(50);

      // Run until convergence (or until max iterations). The UI will append either '(Converged)' or '(Stopped after max iterations)'
      await app.clickRun();
      await page.waitForTimeout(200);

      const status = await app.getStatusText();
      // Accept either converged or stopped message.
      expect(status).toMatch(/(Converged|\(Stopped after max iterations\))/);

      expect(errors.consoleErrors.length, `Console errors: ${errors.consoleErrors.join(' | ')}`).toBe(0);
      expect(errors.pageErrors.length, `Page errors: ${errors.pageErrors.join(' | ')}`).toBe(0);
    });

    test('ResetClustering clears centroids and disables iteration controls', async ({ page }) => {
      const errors = setupErrorCapture(page);
      const app = new KMeansPage(page);
      await app.goto();

      await app.generateRandom(5);
      await app.clickInitCentroids();
      await page.waitForTimeout(50);
      // Ensure centroids exist
      expect(await app.countCentroidElements()).toBeGreaterThanOrEqual(1);

      // Click reset
      await app.clickReset();
      await page.waitForTimeout(50);

      // Centroids should be cleared
      expect(await app.countCentroidElements()).toBe(0);
      // Step & run disabled
      await expect(app.locators.stepBtn).toBeDisabled();
      await expect(app.locators.runBtn).toBeDisabled();

      expect(errors.consoleErrors.length, `Console errors: ${errors.consoleErrors.join(' | ')}`).toBe(0);
      expect(errors.pageErrors.length, `Page errors: ${errors.pageErrors.join(' | ')}`).toBe(0);
    });
  });

  test.describe('Manual centroid placement (S3_ManualCentroidMode) and transitions', () => {
    test('EnableManualCentroidPlacement enters manual mode and placing centroids via plot clicks works', async ({ page }) => {
      const errors = setupErrorCapture(page);
      const app = new KMeansPage(page);
      await app.goto();

      // Set k to 2 for faster manual placement
      await app.setK(2);
      // Add some points so dataset is non-empty
      await app.generateRandom(4);

      // Select manual init method
      await app.selectInitMethod('manual');

      // Click init centroids which should enable manual centroid add mode
      await app.clickInitCentroids();
      await page.waitForTimeout(50);

      // Status should indicate manual placement is active
      await expect(app.locators.statusMessage).toHaveText('Manual centroid placement active. Click plot to add centroids.');

      // Click on plot area two times to add centroids (positions within svg)
      await app.clickPlotAt(100, 100);
      await page.waitForTimeout(50);
      // After first click, centroid count should be 1
      let cCount = await app.countCentroidElements();
      expect(cCount).toBeGreaterThanOrEqual(1);

      // Second click to finish manual placement
      await app.clickPlotAt(200, 200);
      await page.waitForTimeout(100);

      // After adding k centroids, manual mode should have been disabled and status returns to dataset view
      const status = await app.getStatusText();
      expect(status).toMatch(/Dataset:\s*\d+\s*points,\s*k=\d+/);
      // Centroid elements must equal k
      const finalCentroids = await app.countCentroidElements();
      expect(finalCentroids).toBe(2);

      // Reset manual centroid button should be disabled once manual mode ended
      await expect(app.locators.resetManualCentroidsBtn).toBeDisabled();

      expect(errors.consoleErrors.length, `Console errors: ${errors.consoleErrors.join(' | ')}`).toBe(0);
      expect(errors.pageErrors.length, `Page errors: ${errors.pageErrors.join(' | ')}`).toBe(0);
    });
  });

  test.describe('Distances display and hover interactions', () => {
    test('ShowDistancesOnHover toggles and mousemove draws distances without errors', async ({ page }) => {
      const errors = setupErrorCapture(page);
      const app = new KMeansPage(page);
      await app.goto();

      // Prepare dataset and centroids so distances could be computed
      await app.generateRandom(6);
      await app.clickInitCentroids();
      await page.waitForTimeout(100);

      // Toggle distances on
      await app.toggleShowDistances();
      const btnText = await app.getShowDistancesButtonText();
      expect(btnText).toMatch(/Show Distances On Hover: On/);

      // Move mouse over plot area to trigger drawPlot(mouseX,mouseY)
      // Use plotArea.hover at center
      await app.locators.plotArea.hover();
      // perform a small mouse move inside plot
      const box = await app.locators.plotArea.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await page.waitForTimeout(100);
      }

      // There should be no console or page errors from drawing distances
      expect(errors.consoleErrors.length, `Console errors: ${errors.consoleErrors.join(' | ')}`).toBe(0);
      expect(errors.pageErrors.length, `Page errors: ${errors.pageErrors.join(' | ')}`).toBe(0);
    });
  });

  test.describe('Export and Import dataset functionality', () => {
    test('ExportDataset triggers download flow (no runtime errors)', async ({ page }) => {
      const errors = setupErrorCapture(page);
      const app = new KMeansPage(page);
      await app.goto();

      // Create some data
      await app.generateRandom(4);
      await app.clickInitCentroids();
      await page.waitForTimeout(50);

      // Click export; ensure no runtime error
      await app.exportJSONClick();

      expect(errors.consoleErrors.length, `Console errors: ${errors.consoleErrors.join(' | ')}`).toBe(0);
      expect(errors.pageErrors.length, `Page errors: ${errors.pageErrors.join(' | ')}`).toBe(0);
    });

    test('ImportDataset loads JSON and updates UI state', async ({ page }) => {
      const errors = setupErrorCapture(page);
      const app = new KMeansPage(page);
      await app.goto();

      // Prepare a valid JSON export blob string to import
      const importData = {
        points: [{ x: 10, y: 10, cluster: null }, { x: 20, y: 20, cluster: null }],
        centroids: [{ x: 10, y: 10, clusterIndex: 0 }],
        k: 1,
        iteration: 2,
        hasConverged: false
      };
      const jsonStr = JSON.stringify(importData, null, 2);

      // Set the hidden file input to this JSON content which triggers importJSON via change handler
      await app.importJsonFileFromContent('import-test.json', jsonStr);

      // The import handler sets statusMessage to "Imported dataset and clustering."
      // Wait a bit for FileReader and handlers to finish
      await page.waitForTimeout(200);
      await expect(app.locators.statusMessage).toHaveText('Imported dataset and clustering.');

      // The dataset should now show 2 points and k=1 reflected in the k input
      await expect(app.locators.statusMessage).toHaveText(/Dataset:\s*2 points,\s*k=1/);
      await expect(app.locators.kInput).toHaveValue('1');

      expect(errors.consoleErrors.length, `Console errors: ${errors.consoleErrors.join(' | ')}`).toBe(0);
      expect(errors.pageErrors.length, `Page errors: ${errors.pageErrors.join(' | ')}`).toBe(0);
    });

    test('ImportDataset with invalid JSON triggers alert and does not break page', async ({ page }) => {
      const errors = setupErrorCapture(page);
      const app = new KMeansPage(page);
      await app.goto();

      // Invalid JSON content (missing points)
      const badJson = JSON.stringify({ bad: 'structure' });

      // Listen for alert triggered inside importJSON when it fails parsing/validation
      let alertMessage = null;
      page.once('dialog', async dialog => {
        alertMessage = dialog.message();
        await dialog.accept();
      });

      await app.importJsonFileFromContent('bad.json', badJson);
      // Allow time for handler
      await page.waitForTimeout(200);

      expect(alertMessage).toMatch(/Error parsing import JSON/);

      // Page still functional: status message should remain or update but not crash
      const status = await app.getStatusText();
      expect(status).toBeTruthy();

      expect(errors.consoleErrors.length, `Console errors: ${errors.consoleErrors.join(' | ')}`).toBe(0);
      expect(errors.pageErrors.length, `Page errors: ${errors.pageErrors.join(' | ')}`).toBe(0);
    });
  });

  test('Global sanity: no uncaught ReferenceError/SyntaxError/TypeError on load or interactions', async ({ page }) => {
    // This test explicitly checks that no uncaught runtime errors (pageerror) happened while interacting
    const errors = setupErrorCapture(page);
    const app = new KMeansPage(page);
    await app.goto();

    // Perform a set of representative interactions
    await app.generateRandom(3);
    await app.clickInitCentroids();
    await page.waitForTimeout(50);
    await app.clickStep();
    await page.waitForTimeout(50);
    await app.toggleShowDistances();
    await page.waitForTimeout(50);
    await app.clickPlotAt(50, 50);
    await page.waitForTimeout(50);

    // Ensure there were no uncaught page errors (ReferenceError/SyntaxError/TypeError)
    // Note: we also captured console.error messages earlier; both arrays must be empty
    expect(errors.pageErrors.length, `Uncaught page errors: ${errors.pageErrors.join(' | ')}`).toBe(0);
    expect(errors.consoleErrors.length, `Console.error messages: ${errors.consoleErrors.join(' | ')}`).toBe(0);
  });
});