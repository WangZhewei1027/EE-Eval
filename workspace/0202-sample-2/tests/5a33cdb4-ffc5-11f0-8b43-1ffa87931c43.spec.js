import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a33cdb4-ffc5-11f0-8b43-1ffa87931c43.html';

/**
 * Page Object for the K-Means demo page.
 * Encapsulates common interactions and assertions used across tests.
 */
class KMeansPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.canvas = '#canvas';
    this.runBtn = '#runBtn';
    this.resetBtn = '#resetBtn';
    this.clustersInput = '#clusters';
    this.legend = '#legend';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure key elements are present
    await Promise.all([
      this.page.waitForSelector(this.canvas),
      this.page.waitForSelector(this.runBtn),
      this.page.waitForSelector(this.resetBtn),
      this.page.waitForSelector(this.clustersInput),
      this.page.waitForSelector(this.legend),
    ]);
  }

  // Click canvas at given offsets (relative to top-left of canvas element)
  async clickCanvasAt(x, y) {
    // Use bounding box coordinates to compute absolute click
    const handle = await this.page.$(this.canvas);
    const box = await handle.boundingBox();
    if (!box) throw new Error('Canvas bounding box not found');
    await this.page.mouse.click(box.x + x, box.y + y);
  }

  async getCanvasDataURL() {
    return this.page.evaluate(() => {
      const c = document.getElementById('canvas');
      return c.toDataURL();
    });
  }

  async setClusters(k) {
    await this.page.fill(this.clustersInput, String(k));
  }

  async clickRun() {
    await this.page.click(this.runBtn);
  }

  async clickReset() {
    await this.page.click(this.resetBtn);
  }

  async isRunDisabled() {
    return this.page.evaluate(() => document.getElementById('runBtn').disabled);
  }

  async isResetDisabled() {
    return this.page.evaluate(() => document.getElementById('resetBtn').disabled);
  }

  async isClustersDisabled() {
    return this.page.evaluate(() => document.getElementById('clusters').disabled);
  }

  async legendChildCount() {
    return this.page.evaluate(() => document.getElementById('legend').childElementCount);
  }

  async legendText() {
    return this.page.evaluate(() => document.getElementById('legend').innerText);
  }

  // Wait until run button is enabled again (run finished)
  async waitForRunCompletion(timeout = 15000) {
    await this.page.waitForFunction(() => !document.getElementById('runBtn').disabled, null, { timeout });
  }

  // Wait until run button becomes disabled (run started)
  async waitForRunStart(timeout = 2000) {
    await this.page.waitForFunction(() => document.getElementById('runBtn').disabled === true, null, { timeout });
  }
}

test.describe('K-Means Clustering Demo - FSM and UI tests', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for each test.
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // Capture all console messages with their types for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // Capture uncaught page errors
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Nothing special to teardown; listeners are attached per-page and cleared by Playwright.
    // We could assert no unexpected page errors globally here if desired.
  });

  test('S0 Idle - Initial state: canvas present, controls enabled, no legend', async ({ page }) => {
    // Validate initial Idle state: draw() ran, canvas exists, controls in default state, no clusters legend.
    const app = new KMeansPage(page);
    await app.goto();

    // Assertions for initial UI
    const clustersValue = await page.$eval('#clusters', el => el.value);
    expect(clustersValue).toBe('3'); // default K

    expect(await app.isRunDisabled()).toBe(false);
    expect(await app.isResetDisabled()).toBe(false);
    expect(await app.isClustersDisabled()).toBe(false);

    const legendCount = await app.legendChildCount();
    expect(legendCount).toBe(0); // No legend items initially

    // Capture initial canvas snapshot (data URL) for future comparison
    const initialDataUrl = await app.getCanvasDataURL();
    expect(typeof initialDataUrl).toBe('string');
    expect(initialDataUrl.length).toBeGreaterThan(100); // sanity check

    // Assert no page errors occurred during page load and no console errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S0 -> S1: Canvas click adds a point (visual change on canvas)', async ({ page }) => {
    // Clicking the canvas should add a point and trigger draw(), altering canvas image data.
    const app = new KMeansPage(page);
    await app.goto();

    const before = await app.getCanvasDataURL();

    // Click near 100,100 on the canvas
    await app.clickCanvasAt(100, 100);

    // Give a brief moment for draw to complete
    await page.waitForTimeout(100);

    const after = await app.getCanvasDataURL();
    expect(after).not.toBe(before); // Canvas image should change after adding a point

    // Legend should remain cleared after adding single point (draw() clears legendDiv in click handler)
    const legendText = await app.legendText();
    expect(legendText).toBe('');

    // Confirm no runtime errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S1 -> S2 -> S3: Run K-Means with enough points populates legend and toggles controls', async ({ page }) => {
    // Add multiple points, run K-Means, expect:
    // - runBtn becomes disabled during run, then re-enabled when complete
    // - clusters input and reset disabled during run, then re-enabled
    // - legend populated with K entries after completion
    const app = new KMeansPage(page);
    await app.goto();

    // Add 4 distinct points so there's enough data for K=3
    await app.clickCanvasAt(50, 50);
    await page.waitForTimeout(50);
    await app.clickCanvasAt(550, 50);
    await page.waitForTimeout(50);
    await app.clickCanvasAt(50, 350);
    await page.waitForTimeout(50);
    await app.clickCanvasAt(550, 350);
    await page.waitForTimeout(50);

    // Ensure canvas changed
    const afterAdds = await app.getCanvasDataURL();
    expect(afterAdds).toBeTruthy();

    // Ensure clusters value is default 3; run with K=3
    const k = 3;
    await app.setClusters(k);

    // Start run and assert run button disabled while processing
    await app.clickRun();

    // Wait for run to start (runBtn disabled)
    await app.waitForRunStart();

    // During run, controls should be disabled
    expect(await app.isRunDisabled()).toBe(true);
    expect(await app.isClustersDisabled()).toBe(true);
    expect(await app.isResetDisabled()).toBe(true);

    // Wait for run completion (runBtn re-enabled)
    await app.waitForRunCompletion(20000);

    // After run completes, controls should be enabled again
    expect(await app.isRunDisabled()).toBe(false);
    expect(await app.isClustersDisabled()).toBe(false);
    expect(await app.isResetDisabled()).toBe(false);

    // Legend should now have entries: updateLegend inserts 2 DOM elements per cluster (color-box and label)
    const legendChildCount = await app.legendChildCount();
    expect(legendChildCount).toBe(2 * k);

    const legendInner = await app.legendText();
    // Should contain "Cluster 1" ... "Cluster k"
    for (let i = 1; i <= k; i++) {
      expect(legendInner).toContain(`Cluster ${i}`);
    }

    // Canvas should have drawn centers: resulting image should differ from afterAdds
    const afterRun = await app.getCanvasDataURL();
    expect(afterRun).not.toBe(afterAdds);

    // Ensure no console errors or page errors happened during run
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  }, 25000); // give more time for KMeans visualization

  test('S1 -> S0: Reset clears points and legend and restores canvas to initial state', async ({ page }) => {
    // Add a point, then reset and verify canvas returns to initial appearance and legend clears.
    const app = new KMeansPage(page);
    await app.goto();

    const initial = await app.getCanvasDataURL();

    // Add a point
    await app.clickCanvasAt(120, 120);
    await page.waitForTimeout(100);
    const afterAdd = await app.getCanvasDataURL();
    expect(afterAdd).not.toBe(initial);

    // Click Reset
    await app.clickReset();
    await page.waitForTimeout(100);

    const afterReset = await app.getCanvasDataURL();
    // Canvas should restore to initial drawing (empty)
    expect(afterReset).toBe(initial);

    const legendCount = await app.legendChildCount();
    expect(legendCount).toBe(0);

    // No runtime errors should have occurred
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Clicking Run with no points shows alert "Add some points first!"', async ({ page }) => {
    // Validate the alert is shown when attempting to run with zero points.
    const app = new KMeansPage(page);
    await app.goto();

    // Ensure there are no points by resetting
    await app.clickReset();

    // Listen for dialog
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    // Click Run with zero points
    await app.clickRun();

    // Wait briefly to allow dialog to fire
    await page.waitForTimeout(200);

    expect(dialogMessage).toBe('Add some points first!');

    // No page errors produced
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Invalid K (0) after adding points triggers K range alert', async ({ page }) => {
    // Add points, set K to 0 and verify proper alert
    const app = new KMeansPage(page);
    await app.goto();

    // Add two points
    await app.clickCanvasAt(60, 60);
    await page.waitForTimeout(50);
    await app.clickCanvasAt(80, 80);
    await page.waitForTimeout(50);

    // Set K to 0 (invalid)
    await app.setClusters(0);

    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await app.clickRun();
    await page.waitForTimeout(200);

    expect(dialogMessage).toBe('Please select K between 1 and 10.');

    // Ensure no uncaught page errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: K greater than number of points triggers alert', async ({ page }) => {
    // Add two points and set K to 5 -> expect alert about K exceeding points
    const app = new KMeansPage(page);
    await app.goto();

    // Ensure reset to start clean
    await app.clickReset();
    await page.waitForTimeout(50);

    // Add two points
    await app.clickCanvasAt(150, 150);
    await page.waitForTimeout(50);
    await app.clickCanvasAt(200, 150);
    await page.waitForTimeout(50);

    await app.setClusters(5);

    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await app.clickRun();
    await page.waitForTimeout(200);

    // Message is formatted with points length substituted
    expect(dialogMessage).toContain('Number of clusters (K) cannot exceed number of points');
    expect(dialogMessage).toContain('(2)');

    // Ensure no console errors or page errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});