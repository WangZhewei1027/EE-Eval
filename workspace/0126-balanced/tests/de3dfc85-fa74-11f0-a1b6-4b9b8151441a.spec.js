import { test, expect } from '@playwright/test';

// Test file for Application ID: de3dfc85-fa74-11f0-a1b6-4b9b8151441a
// URL: http://127.0.0.1:5500/workspace/0126-balanced/html/de3dfc85-fa74-11f0-a1b6-4b9b8151441a.html
//
// These tests validate the FSM states/transitions for the K-Means Clustering Visualization.
// They verify Idle, Running, and Stepping states, and events: RESET_POINTS, RUN_CLUSTERING, STEP, ADD_POINT.
// Tests observe console and page errors and assert their absence (no unexpected runtime errors).
//
// Note: Tests only interact with the page as-is and do not modify application code.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3dfc85-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object Model for interacting with the K-Means app
class KMeansPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#canvas');
    this.resetBtn = page.locator('#resetBtn');
    this.clusterBtn = page.locator('#clusterBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.kInput = page.locator('#kValue');
    this.info = page.locator('#info');
  }

  // Click the "Step" button
  async clickStep() {
    await this.stepBtn.click();
  }

  // Click the "Run Clustering" button
  async clickRun() {
    await this.clusterBtn.click();
  }

  // Click the "Reset Points" button
  async clickReset() {
    await this.resetBtn.click();
  }

  // Set K value via the input
  async setK(value) {
    await this.kInput.fill(String(value));
    // blur to ensure change events if any
    await this.kInput.evaluate((el) => el.blur());
  }

  // Click the canvas at a given relative position (0-1)
  async clickCanvasAt(relativeX = 0.5, relativeY = 0.5) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    const x = Math.max(0, Math.min(box.width - 1, box.width * relativeX));
    const y = Math.max(0, Math.min(box.height - 1, box.height * relativeY));
    await this.canvas.click({ position: { x: Math.floor(x), y: Math.floor(y) } });
  }

  // Read iteration and number of clusters from info div
  async getInfoNumbers() {
    const text = (await this.info.textContent()) || '';
    // Example text contains lines: "Iteration: X" and "Number of clusters: Y"
    const iterMatch = text.match(/Iteration:\s*(\d+)/i);
    const clustersMatch = text.match(/Number of clusters:\s*(\d+)/i);
    const iteration = iterMatch ? parseInt(iterMatch[1], 10) : null;
    const clusters = clustersMatch ? parseInt(clustersMatch[1], 10) : null;
    return { iteration, clusters, raw: text };
  }

  // Get canvas data URL for visual comparison
  async getCanvasDataURL() {
    return await this.page.evaluate(() => {
      const c = document.getElementById('canvas');
      return c.toDataURL();
    });
  }

  // Wait until iteration is at least target (with timeout)
  async waitForIterationAtLeast(target, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const { iteration } = await this.getInfoNumbers();
      if (iteration !== null && iteration >= target) return;
      await this.page.waitForTimeout(100);
    }
    throw new Error(`Iteration did not reach ${target} within ${timeout}ms`);
  }
}

test.describe('K-Means Clustering Visualization - FSM states and transitions', () => {
  // Variables to capture runtime errors and console error messages for each test
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset arrays
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', (msg) => {
      // Record any console message of type 'error' for assertion
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure the main elements are present
    await page.waitForSelector('#canvas');
    await page.waitForSelector('#resetBtn');
    await page.waitForSelector('#clusterBtn');
    await page.waitForSelector('#stepBtn');
    await page.waitForSelector('#kValue');
    await page.waitForSelector('#info');
  });

  // After each test, assert that no console 'error' messages or uncaught page errors occurred.
  test.afterEach(async () => {
    // Make assertions about runtime errors to ensure app runs cleanly
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test('Initial Idle state: elements present and initial drawing (Iteration 0, 0 clusters)', async ({ page }) => {
    // Validate Idle state entry actions: initPoints() and draw() should have run.
    // The info panel should show Iteration: 0 and Number of clusters: 0.
    const app = new KMeansPage(page);

    const info = await app.getInfoNumbers();
    // Expect iteration to be 0 at initial load
    expect(info.iteration).toBe(0);
    // Expect number of clusters to be 0 before any centroids are initialized
    expect(info.clusters).toBe(0);

    // Canvas should contain a drawing; get data URL to ensure something was rendered
    const dataUrl = await app.getCanvasDataURL();
    expect(typeof dataUrl).toBe('string');
    expect(dataUrl.length).toBeGreaterThan(100); // basic sanity
  });

  test('STEP transition from Idle to Step initializes centroids and increments iteration', async ({ page }) => {
    // Clicking "Step" from Idle should initialize centroids and update iteration and clusters.
    const app1 = new KMeansPage(page);

    // Ensure starting state
    let info1 = await app.getInfoNumbers();
    expect(info.iteration).toBe(0);
    expect(info.clusters).toBe(0);

    // Click Step to perform one iteration (this should call initCentroids -> assignClusters -> updateCentroids)
    await app.clickStep();

    // Wait a short time for draw() to update info panel
    await page.waitForTimeout(200);

    info = await app.getInfoNumbers();
    // Iteration should have incremented at least to 1
    expect(info.iteration).toBeGreaterThanOrEqual(1);
    // Number of clusters should equal default K value (3)
    expect(info.clusters).toBe(3);
  });

  test('Run Clustering transition Idle -> Running: animation begins and iterations increase over time', async ({ page }) => {
    // Clicking "Run Clustering" should start an animation loop where iteration increases repeatedly.
    const app2 = new KMeansPage(page);

    // Start clustering
    await app.clickRun();

    // Wait for a few animation frames to occur
    await page.waitForTimeout(500);

    let info2 = await app.getInfoNumbers();
    expect(info.clusters).toBe(3);
    expect(info.iteration).toBeGreaterThanOrEqual(1);

    // Capture iteration and ensure it increases after some time (indicating animation continues)
    const iterationBefore = info.iteration;
    await page.waitForTimeout(400);
    info = await app.getInfoNumbers();
    const iterationAfter = info.iteration;
    expect(iterationAfter).toBeGreaterThanOrEqual(iterationBefore, 'Iteration should not decrease during animation');
    expect(iterationAfter).toBeGreaterThan(iterationBefore, 'Iteration should increase while running');
  });

  test('STEP while Running: clicking Step does not stop animation and iterations continue', async ({ page }) => {
    // Start running, then click Step while running and confirm animation continues.
    const app3 = new KMeansPage(page);

    // Start clustering animation
    await app.clickRun();
    await page.waitForTimeout(300);

    // Record iteration count
    let info3 = await app.getInfoNumbers();
    const beforeClick = info.iteration;

    // Click Step while running (should execute an additional step but not stop animation)
    await app.clickStep();

    // Wait and confirm iterations continue to increase
    await page.waitForTimeout(500);
    info = await app.getInfoNumbers();
    expect(info.iteration).toBeGreaterThan(beforeClick);
  });

  test('RESET_POINTS while Running: stops clustering and resets to Idle (centroids cleared, iteration 0)', async ({ page }) => {
    // Start running, then reset; verify the clustering stops and the app returns to Idle state.
    const app4 = new KMeansPage(page);

    // Start clustering
    await app.clickRun();
    await page.waitForTimeout(400);

    // Confirm it's running by checking iteration > 0
    let info4 = await app.getInfoNumbers();
    expect(info.iteration).toBeGreaterThanOrEqual(1);

    // Click Reset - should stop animation and reinitialize points, clear centroids and clusters, reset iteration
    await app.clickReset();

    // Wait for UI to update
    await page.waitForTimeout(200);

    info = await app.getInfoNumbers();
    // After reset, iteration should be 0 and clusters should be 0 indicating Idle
    expect(info.iteration).toBe(0);
    expect(info.clusters).toBe(0);

    // Wait some more to ensure animation does not restart inadvertently
    await page.waitForTimeout(400);
    const infoAfter = await app.getInfoNumbers();
    expect(infoAfter.iteration).toBe(0);
    expect(infoAfter.clusters).toBe(0);
  });

  test('ADD_POINT event: clicking the canvas adds a visual change on canvas', async ({ page }) => {
    // Clicking on the canvas should add a new point and redraw the canvas.
    const app5 = new KMeansPage(page);

    // Capture canvas appearance before clicking
    const beforeData = await app.getCanvasDataURL();

    // Click near the center of the canvas to add a point
    await app.clickCanvasAt(0.5, 0.5);

    // Small wait for draw() to complete
    await page.waitForTimeout(150);

    // Capture canvas appearance after clicking
    const afterData = await app.getCanvasDataURL();

    // The canvas image should change after adding a point
    expect(afterData).not.toBe(beforeData);
  });

  test('Edge case: Setting K to 1 results in single cluster after a step', async ({ page }) => {
    // Set K to 1 and step; expect Number of clusters: 1
    const app6 = new KMeansPage(page);

    await app.setK(1);

    // Perform a single step
    await app.clickStep();

    // Wait for UI
    await page.waitForTimeout(200);

    const info5 = await app.getInfoNumbers();
    expect(info.clusters).toBe(1);
    expect(info.iteration).toBeGreaterThanOrEqual(1);
  });

  test('Edge case: Setting K to 0 (invalid/min edge) and stepping should handle gracefully (0 clusters)', async ({ page }) => {
    // Directly set the input value to 0 via evaluate (bypassing native constraints) to test robustness
    // This simulates an edge-case input value and ensures the app does not throw and behaves consistently.
    const app7 = new KMeansPage(page);

    // Force input value to 0
    await page.evaluate(() => {
      const kInput = document.getElementById('kValue');
      kInput.value = '0';
      // dispatch input/change events if necessary
      kInput.dispatchEvent(new Event('input', { bubbles: true }));
      kInput.dispatchEvent(new Event('change', { bubbles: true }));
    });

    // Click step - should not crash; iteration should increase, clusters remain 0
    await app.clickStep();

    await page.waitForTimeout(200);

    const info6 = await app.getInfoNumbers();
    expect(info.iteration).toBeGreaterThanOrEqual(1);
    expect(info.clusters).toBe(0);
  });

  test('Observes console and page errors during typical usage (should have none)', async ({ page }) => {
    // Perform a series of interactions and then assert there are no console errors or page errors.
    const app8 = new KMeansPage(page);

    // Interact: step, run, click canvas, reset
    await app.clickStep();
    await page.waitForTimeout(150);
    await app.clickRun();
    await page.waitForTimeout(300);
    await app.clickCanvasAt(0.3, 0.3);
    await page.waitForTimeout(150);
    await app.clickReset();
    await page.waitForTimeout(150);

    // The afterEach hook will assert no page errors and no console errors.
    // For explicitness, also assert here before teardown.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});