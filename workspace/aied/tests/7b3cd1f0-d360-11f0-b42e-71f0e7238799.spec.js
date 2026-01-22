import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3cd1f0-d360-11f0-b42e-71f0e7238799.html';

// Helper page object for interacting with the KNN demo page
class KNNPage {
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#canvas');
    this.addButton = page.locator('#addData');
    this.kInput = page.locator('#kValue');
    // capture console and page errors for assertions
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  async initListeners() {
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // pageerror is an Error object
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    await this.initListeners();
    // Ensure page scripts run
    await this.page.waitForLoadState('networkidle');
  }

  async getDataPoints() {
    // return a deep copy of dataPoints array from page
    return await this.page.evaluate(() => {
      // dataPoints is declared in the global scope in the app
      return (window.dataPoints || []).map(p => ({ x: p.x, y: p.y, label: p.label }));
    });
  }

  async clickAddData() {
    await this.addButton.click();
    // wait for at least one data point in page scope (non-deterministic timing)
    await this.page.waitForFunction(() => (window.dataPoints || []).length > 0);
  }

  async clickCanvasAt(x, y) {
    // Click relative to the canvas element at coordinates (x,y)
    await this.canvas.click({ position: { x, y } });
    // After click, application adds a point synchronously and draws prediction,
    // but wait a tiny bit to ensure drawing operations complete
    await this.page.waitForTimeout(50);
  }

  async setK(value) {
    await this.kInput.fill(String(value));
  }

  async getCanvasPixelRGBA(x, y) {
    // Clamp integers and fetch pixel via getImageData
    return await this.page.evaluate(({ x, y }) => {
      const c = document.getElementById('canvas');
      const ctx = c.getContext('2d');
      const ix = Math.floor(x);
      const iy = Math.floor(y);
      try {
        const data = ctx.getImageData(ix, iy, 1, 1).data;
        return { r: data[0], g: data[1], b: data[2], a: data[3] };
      } catch (e) {
        // getImageData may throw if coordinates out of bounds; return null to signal
        return null;
      }
    }, { x, y });
  }
}

test.describe('K-Nearest Neighbors (KNN) Demo - states and transitions', () => {
  // Each test gets a fresh page
  test.beforeEach(async ({ page }) => {
    // nothing global here; each test creates its own KNNPage and navigates
  });

  test('Initial state (S0_Idle) - page loads and drawPoints() has produced initial state', async ({ page }) => {
    // This test validates the Idle state:
    // - dataPoints should exist and be empty initially (drawPoints called on entry)
    // - no page errors on initial load
    const knn = new KNNPage(page);
    await knn.goto();

    const dataPoints = await knn.getDataPoints();
    expect(Array.isArray(dataPoints)).toBe(true);
    expect(dataPoints.length).toBe(0);

    // Canvas exists with expected dimensions
    const canvasSize = await page.evaluate(() => {
      const c = document.getElementById('canvas');
      return { width: c.width, height: c.height, exists: !!c };
    });
    expect(canvasSize.exists).toBe(true);
    expect(canvasSize.width).toBe(400);
    expect(canvasSize.height).toBe(400);

    // Ensure no runtime page errors occurred during initial load
    expect(knn.pageErrors.length).toBe(0);

    // Console should not have error messages (info/debug allowed)
    const errorConsoleMessages = knn.consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition via Add Data Point button (S0_Idle -> S1_DataAdded) - adds a random point and draws it', async ({ page }) => {
    // This test validates:
    // - Clicking #addData triggers addDataPoint(randomX, randomY, label)
    // - After click, a new data point is present in dataPoints
    // - The point is drawn onto the canvas (pixel at point center is non-transparent)
    const knn = new KNNPage(page);
    await knn.goto();

    // Sanity: ensure initially zero points
    let before = await knn.getDataPoints();
    expect(before.length).toBe(0);

    // Click the add button to trigger transition
    await knn.clickAddData();

    // Verify data point was added
    const after = await knn.getDataPoints();
    expect(after.length).toBeGreaterThanOrEqual(1);

    const last = after[after.length - 1];
    // Coordinates should be within canvas bounds
    expect(last.x).toBeGreaterThanOrEqual(0);
    expect(last.x).toBeLessThanOrEqual(400);
    expect(last.y).toBeGreaterThanOrEqual(0);
    expect(last.y).toBeLessThanOrEqual(400);
    // Label should be either 0 or 1 (colors length = 2)
    expect([0, 1]).toContain(last.label);

    // Pixel at the center of the drawn point should have non-zero alpha (drawn)
    const pixel = await knn.getCanvasPixelRGBA(last.x, last.y);
    expect(pixel).not.toBeNull();
    expect(pixel.a).toBeGreaterThan(0);

    // No page errors should have occurred
    expect(knn.pageErrors.length).toBe(0);

    // No console error messages
    const errorConsole = knn.consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  test('Transition via Canvas click (S0_Idle -> S1_DataAdded) - clicking canvas adds user-labeled point and draws prediction overlay', async ({ page }) => {
    // This test validates:
    // - Clicking on the canvas at a specific coordinate adds a data point with a userLabel
    // - knn() is invoked and a prediction overlay (larger circle) is drawn (green fallback expected)
    // - dataPoints length increments
    const knn = new KNNPage(page);
    await knn.goto();

    // Pick a point well inside the canvas
    const clickX = 100;
    const clickY = 120;

    // Confirm initially empty
    let before = await knn.getDataPoints();
    expect(before.length).toBe(0);

    // Click canvas to add new data point via CanvasClick event
    await knn.clickCanvasAt(clickX, clickY);

    // Verify data point count now 1
    const after = await knn.getDataPoints();
    expect(after.length).toBe(1);

    const point = after[0];
    // The saved coordinates should roughly match where we clicked (allow some float differences)
    expect(Math.abs(point.x - clickX)).toBeLessThanOrEqual(1);
    expect(Math.abs(point.y - clickY)).toBeLessThanOrEqual(1);

    // Because the code sets userLabel = colors.length (2), predicted overlay logic will attempt to compute knn
    // and then attempt to draw the predicted label. For a lone point the prediction will lead to the fallback
    // fillStyle = 'green'. So the pixel at the center should show a non-transparent color; green fallback generally has non-zero RGB.
    const pixel = await knn.getCanvasPixelRGBA(point.x, point.y);
    expect(pixel).not.toBeNull();
    expect(pixel.a).toBeGreaterThan(0);
    // Ensure at least one of r/g/b channels is non-zero
    expect(pixel.r + pixel.g + pixel.b).toBeGreaterThan(0);

    // No unexpected page errors for the normal canvas click scenario
    expect(knn.pageErrors.length).toBe(0);
  });

  test('Edge case: k = 0 leads to runtime TypeError inside knn() reduce() - observe pageerror', async ({ page }) => {
    // This test intentionally sets k = 0 to exercise an error path:
    // - When k = 0, knn() slices neighbors with length 0, resulting in votes = {}
    // - Object.keys(votes).reduce(...) on empty array will throw a TypeError.
    // - The test asserts that a pageerror occurs and the message indicates a reduce-of-empty-array type error.
    const knn = new KNNPage(page);
    await knn.goto();

    // Set k to 0 (violates min but we must allow natural behavior)
    await knn.setK(0);

    // Click canvas to trigger the classification path which will call knn and should throw
    // Listen for a pageerror; we already have a listener in knn.pageErrors
    await knn.clickCanvasAt(50, 50);

    // Wait briefly to ensure any async error bubbles up
    await page.waitForTimeout(50);

    // We expect at least one page error captured
    expect(knn.pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one of the page errors should mention 'Reduce' (reduce on empty array) or similar.
    const messages = knn.pageErrors.map(e => String(e && e.message ? e.message : e));
    const hasReduceMessage = messages.some(msg => /reduce/i.test(msg) || /Reduce/.test(msg) || /empty array/i.test(msg) || /empty/i.test(msg));
    expect(hasReduceMessage).toBe(true);
  });

  test('Edge case: k larger than available data points - function should tolerate and not crash', async ({ page }) => {
    // This test validates:
    // - When k > dataPoints.length, knn() will simply consider available neighbors (slice will be shorter)
    // - No runtime error should occur and prediction overlay should be drawn
    const knn = new KNNPage(page);
    await knn.goto();

    // Add two data points using the add button twice
    await knn.clickAddData();
    await knn.clickAddData();

    const before = await knn.getDataPoints();
    expect(before.length).toBeGreaterThanOrEqual(2);

    // Set k to a large number (10)
    await knn.setK(10);

    // Click canvas to classify a new point
    const clickX = 200;
    const clickY = 200;
    await knn.clickCanvasAt(clickX, clickY);

    // After classification, there should be one more data point (added by click)
    const after = await knn.getDataPoints();
    expect(after.length).toBeGreaterThanOrEqual(before.length + 1);

    const newPoint = after[after.length - 1];
    // Pixel at new point should be non-transparent (overlay drawn)
    const pixel = await knn.getCanvasPixelRGBA(newPoint.x, newPoint.y);
    expect(pixel).not.toBeNull();
    expect(pixel.a).toBeGreaterThan(0);

    // No page errors should have occurred in this scenario
    expect(knn.pageErrors.length).toBe(0);
  });

  test('Visual sanity: colors used for predicted label fallback and known labels', async ({ page }) => {
    // This test checks visual feedback for known labels when using Add Data Point:
    // - Add a point via the button which chooses label 0 or 1 (red/blue)
    // - The overlay drawn for the randomly added point when predictedLabel maps to colors[0|1]
    //   should use a visible color (not necessarily verifying exact RGB), but alpha > 0 suffices
    const knn = new KNNPage(page);
    await knn.goto();

    // Click add data to ensure label 0 or 1 used
    await knn.clickAddData();

    const pts = await knn.getDataPoints();
    expect(pts.length).toBeGreaterThanOrEqual(1);
    const last = pts[pts.length - 1];

    // The overlay radius is 10 so check a pixel near the center; expect alpha > 0
    const pixel = await knn.getCanvasPixelRGBA(last.x, last.y);
    expect(pixel).not.toBeNull();
    expect(pixel.a).toBeGreaterThan(0);

    // Confirm label is one of known color indices
    expect([0, 1]).toContain(last.label);
  });
});