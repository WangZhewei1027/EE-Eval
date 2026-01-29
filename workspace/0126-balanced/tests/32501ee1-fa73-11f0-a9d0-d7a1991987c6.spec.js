import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/32501ee1-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the KNN demo page
class KNNPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.canvasSelector = '#canvas';
    this.buttonSelector = '#classifyButton';
  }

  async goto() {
    await this.page.goto(BASE_URL, { waitUntil: 'load' });
  }

  // Click at a position relative to the top-left of the canvas element
  async clickCanvasAt(x, y) {
    const canvas = await this.page.$(this.canvasSelector);
    await canvas.click({ position: { x, y } });
  }

  // Double-click at a position relative to the top-left of the canvas element
  async dblClickCanvasAt(x, y) {
    const canvas1 = await this.page.$(this.canvasSelector);
    await canvas.dblclick({ position: { x, y } });
  }

  async clickClassifyButton() {
    await this.page.click(this.buttonSelector);
  }

  // Read the RGBA pixel at canvas coordinates (x, y)
  async getCanvasPixel(x, y) {
    return await this.page.evaluate(
      ({ x, y, selector }) => {
        const canvas2 = document.querySelector(selector);
        const ctx = canvas.getContext('2d');
        // Clamp coordinates to canvas bounds
        const cx = Math.max(0, Math.min(Math.floor(x), canvas.width - 1));
        const cy = Math.max(0, Math.min(Math.floor(y), canvas.height - 1));
        const data = ctx.getImageData(cx, cy, 1, 1).data;
        return { r: data[0], g: data[1], b: data[2], a: data[3] };
      },
      { x, y, selector: this.canvasSelector }
    );
  }

  // Return number of stored training points from the page's JS environment
  async getPointsCount() {
    return await this.page.evaluate(() => {
      return Array.isArray(window.points) ? window.points.length : 0;
    });
  }

  // Return the newPoint object from the page (or null)
  async getNewPoint() {
    return await this.page.evaluate(() => {
      return window.newPoint ? { x: window.newPoint.x, y: window.newPoint.y } : null;
    });
  }
}

test.describe('K-Nearest Neighbors Demo - FSM and UI tests', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('Idle state loads correctly: button and canvas present, canvas dimensions match', async ({ page }) => {
    // This test validates the Idle state S0_Idle: initial UI elements exist and canvas is ready.
    const knn = new KNNPage(page);
    await knn.goto();

    // Basic DOM presence checks
    const canvas3 = await page.$('#canvas3');
    const button = await page.$('#classifyButton');
    expect(canvas).not.toBeNull();
    expect(button).not.toBeNull();

    // Verify canvas attributes (width/height) per FSM evidence
    const dims = await page.evaluate(() => {
      const c = document.getElementById('canvas');
      return { width: c.width, height: c.height };
    });
    expect(dims.width).toBe(600);
    expect(dims.height).toBe(400);

    // Check that no page errors occurred while loading the page as-is
    expect(pageErrors.length).toBe(0);

    // Ensure console did not have severe error messages on load
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  test('Clicking the canvas adds a training point (S0_Idle -> S1_PointAdded) and draws red/blue pixel', async ({ page }) => {
    // This test validates the transition from Idle to PointAdded when the canvas is clicked.
    const knn1 = new KNNPage(page);
    await knn.goto();

    // Click near the center of the canvas
    const clickX = 150;
    const clickY = 120;
    await knn.clickCanvasAt(clickX, clickY);

    // The page's points array should now have 1 element
    const pointsCount = await knn.getPointsCount();
    expect(pointsCount).toBeGreaterThanOrEqual(1);

    // The pixel at the clicked coordinate should be non-transparent and should indicate either red or blue
    const pixel = await knn.getCanvasPixel(clickX, clickY);
    expect(pixel.a).toBeGreaterThan(0); // not transparent

    // Determine if pixel color corresponds to red or blue
    const isRed = pixel.r > pixel.b;
    const isBlue = pixel.b > pixel.r;
    expect(isRed || isBlue).toBeTruthy();

    // Ensure no unexpected page errors from this interaction
    expect(pageErrors.length).toBe(0);
  });

  test('Double-click selects a new point (S0_Idle -> S2_NewPointSelected) and draws green pixel', async ({ page }) => {
    // This test validates selecting a new point by double-clicking the canvas.
    const knn2 = new KNNPage(page);
    await knn.goto();

    const dx = 220;
    const dy = 80;
    await knn.dblClickCanvasAt(dx, dy);

    // The page-level newPoint variable should be set
    const newPoint = await knn.getNewPoint();
    expect(newPoint).not.toBeNull();
    // Coordinates should be approximately where we double-clicked
    expect(Math.abs(newPoint.x - dx)).toBeLessThanOrEqual(2);
    expect(Math.abs(newPoint.y - dy)).toBeLessThanOrEqual(2);

    // The pixel at the new point should be green (green channel dominant)
    const pixel1 = await knn.getCanvasPixel(Math.floor(newPoint.x), Math.floor(newPoint.y));
    expect(pixel.a).toBeGreaterThan(0);
    // green should be the largest channel for 'green' fillStyle
    expect(pixel.g).toBeGreaterThanOrEqual(pixel.r);
    expect(pixel.g).toBeGreaterThanOrEqual(pixel.b);

    // No page errors expected
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking "Classify Point" without a new point shows an alert', async ({ page }) => {
    // This test validates the error path when the user clicks classify without selecting a newPoint.
    const knn3 = new KNNPage(page);
    await knn.goto();

    // Listen for alert dialog
    let dialogMessage = null;
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click the classify button with no newPoint set
    await knn.clickClassifyButton();

    // Wait a short time for the dialog handler to run
    await page.waitForTimeout(200);

    expect(dialogMessage).toBeTruthy();
    expect(dialogMessage).toContain('Please add a new point');

    // No page-level errors should have been thrown for this expected alert scenario
    expect(pageErrors.length).toBe(0);
  });

  test('Classifying a new point after adding training points shows predicted class alert', async ({ page }) => {
    // This validates the transition S2_NewPointSelected -> S0_Idle via ClickClassifyButton, verifying the alert with predicted class text appears.
    const knn4 = new KNNPage(page);
    await knn.goto();

    // Add multiple training points (these will get random classes A or B)
    await knn.clickCanvasAt(50, 50);
    await page.waitForTimeout(50);
    await knn.clickCanvasAt(80, 60);
    await page.waitForTimeout(50);
    await knn.clickCanvasAt(120, 70);
    await page.waitForTimeout(50);

    // Double-click to set newPoint
    await knn.dblClickCanvasAt(100, 90);

    // Capture the alert produced by classifyNewPoint
    let dialogMessage1 = null;
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click classify; since there are training points, classifyNewPoint should run and call alert with predicted class
    await knn.clickClassifyButton();

    // Wait briefly for the dialog to appear
    await page.waitForTimeout(200);

    expect(dialogMessage).toBeTruthy();
    expect(dialogMessage).toContain('Predicted class for the new point:');

    // No uncaught page errors expected in this normal classification flow
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: classifying with a new point but ZERO training points causes a runtime error (TypeError) - observe pageerror', async ({ page }) => {
    // This test intentionally triggers the known edge-case in the provided implementation:
    // classifyNewPoint uses reduce on an empty object when there are no training points, which should throw.
    // We must load the page as-is, allow the error to occur naturally, and assert it was observed.
    const knn5 = new KNNPage(page);
    await knn.goto();

    // Ensure there are zero training points at start (fresh page)
    const initialPoints = await knn.getPointsCount();
    expect(initialPoints).toBe(0);

    // Double-click to create a newPoint but do NOT add any training points
    await knn.dblClickCanvasAt(300, 200);

    // Wait to ensure newPoint is set
    const newPoint1 = await knn.getNewPoint();
    expect(newPoint).not.toBeNull();

    // Prepare to wait for a pageerror event that we expect when classify is invoked with no training points
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Click classify button which will call classifyNewPoint and (per implementation) will trigger a TypeError
    await knn.clickClassifyButton();

    // Wait for the pageerror event
    const err = await pageErrorPromise;

    // The error should be a TypeError about reducing an empty array or similar
    expect(err).toBeTruthy();
    const messageLower = (err.message || '').toString().toLowerCase();
    // Accept multiple possible error message phrasings while ensuring it's an error due to reduce/empty operation
    const indicatesReduceEmpty = messageLower.includes('reduce') || messageLower.includes('empty') || messageLower.includes('cannot') || messageLower.includes('of empty');
    expect(indicatesReduceEmpty).toBeTruthy();

    // Also confirm that the console captured at least one pageerror-type message
    const consoleError = consoleMessages.find(m => m.type === 'error') || null;
    // It's possible console.error wasn't invoked; we only require that a pageerror occurred (already asserted)
    // If there is a console error, assert it contains some content
    if (consoleError) {
      expect(consoleError.text.length).toBeGreaterThan(0);
    }
  });

  test('Sanity: verify canvas drawing persists newPoint when points are added later (drawPoints re-renders)', async ({ page }) => {
    // This test ensures drawPoints re-renders training points and preserves/overdraws newPoint properly.
    const knn6 = new KNNPage(page);
    await knn.goto();

    // Double-click to set a newPoint first
    const nx = 400, ny = 50;
    await knn.dblClickCanvasAt(nx, ny);
    const np = await knn.getNewPoint();
    expect(np).not.toBeNull();

    // Pixel at newPoint should be green
    let pixelBefore = await knn.getCanvasPixel(Math.floor(np.x), Math.floor(np.y));
    expect(pixelBefore.a).toBeGreaterThan(0);
    expect(pixelBefore.g).toBeGreaterThanOrEqual(pixelBefore.r);
    expect(pixelBefore.g).toBeGreaterThanOrEqual(pixelBefore.b);

    // Now add a new training point which triggers drawPoints() and should re-draw newPoint afterwards
    await knn.clickCanvasAt(420, 70);

    // After drawPoints, newPoint should still be green (re-drawn)
    let pixelAfter = await knn.getCanvasPixel(Math.floor(np.x), Math.floor(np.y));
    expect(pixelAfter.a).toBeGreaterThan(0);
    expect(pixelAfter.g).toBeGreaterThanOrEqual(pixelAfter.r);
    expect(pixelAfter.g).toBeGreaterThanOrEqual(pixelAfter.b);

    // Ensure no page errors occurred
    expect(pageErrors.length).toBe(0);
  });
});