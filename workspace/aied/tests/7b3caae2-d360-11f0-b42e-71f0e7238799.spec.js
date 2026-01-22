import { test, expect } from '@playwright/test';

// Test file for Application ID: 7b3caae2-d360-11f0-b42e-71f0e7238799
// Server URL (per requirements):
const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3caae2-d360-11f0-b42e-71f0e7238799.html';

// Page object encapsulating interactions with the Linear Regression Demo page.
class LinearRegressionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.addButton = page.locator('#addPoint');
    this.clearButton = page.locator('#clearPoints');
    this.equation = page.locator('#equation');
    this.canvas = page.locator('#canvas');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the "Add Random Point" button
  async addPoint() {
    await this.addButton.click();
    // Allow UI drawing and JS handlers to run
    await this.page.waitForTimeout(50);
  }

  // Click the "Clear Points" button
  async clearPoints() {
    await this.clearButton.click();
    await this.page.waitForTimeout(50);
  }

  // Read the global points array length from the page
  async getPointsLength() {
    return await this.page.evaluate(() => {
      // Accessing existing page variable; do not inject or redefine
      return typeof points !== 'undefined' ? points.length : null;
    });
  }

  // Get the equation text visible in the UI
  async getEquationText() {
    return await this.equation.innerText();
  }

  // Check whether the canvas has any non-transparent pixel (i.e., something drawn)
  async canvasHasDrawing(sampleStride = 10) {
    return await this.page.evaluate(
      ({ stride }) => {
        const canvas = document.getElementById('canvas');
        if (!canvas) return false;
        const ctx = canvas.getContext('2d');
        try {
          const { width, height } = canvas;
          // Sample pixels at intervals to detect any non-empty pixels
          const imageData = ctx.getImageData(0, 0, width, height).data;
          for (let y = 0; y < height; y += stride) {
            for (let x = 0; x < width; x += stride) {
              const idx = (y * width + x) * 4;
              const alpha = imageData[idx + 3];
              if (alpha !== 0) {
                return true;
              }
            }
          }
          return false;
        } catch (e) {
          // If getImageData throws (e.g., security), bubble up error info
          return { __error__: String(e) };
        }
      },
      { stride: sampleStride }
    );
  }

  // Check whether canvas is fully clear (all alpha === 0)
  async isCanvasEmpty() {
    return await this.page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      const { width, height } = canvas;
      const data = ctx.getImageData(0, 0, width, height).data;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) return false;
      }
      return true;
    });
  }
}

// Top-level grouping for the FSM-derived tests
test.describe('Linear Regression Demo - FSM validation', () => {
  let lrPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors for every test
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    lrPage = new LinearRegressionPage(page);
    await lrPage.goto();
  });

  test.afterEach(async () => {
    // Basic sanity assertions about page errors and console.error occurrences.
    // We assert that no uncaught page errors occurred during each test. If there
    // are any, the test will fail and the captured errors will be visible.
    expect(pageErrors.length, 'No uncaught page errors should occur').toBe(0);

    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length, 'No console.error messages should be emitted').toBe(0);
  });

  // Test initial Idle state (S0_Idle)
  test('Initial Idle state: page renders controls and default equation', async () => {
    // Validate that the UI components are present and initial state is as expected.
    // This corresponds to S0_Idle with entry action renderPage()
    await expect(lrPage.addButton).toBeVisible();
    await expect(lrPage.clearButton).toBeVisible();
    await expect(lrPage.canvas).toBeVisible();

    const eqText = await lrPage.getEquationText();
    expect(eqText).toBe('y = 0x + 0');

    const pointsLen = await lrPage.getPointsLength();
    // points array should be present and start empty
    expect(pointsLen).toBe(0);

    // Canvas should be initially empty
    const empty = await lrPage.isCanvasEmpty();
    expect(empty).toBe(true);
  });

  // Test AddPoint event and transition to PointsAdded (S1_PointsAdded)
  test('AddPoint event: transitions to PointsAdded and draws a point', async () => {
    // Click Add Random Point once (transition S0_Idle -> S1_PointsAdded)
    await lrPage.addPoint();

    // After one point, points.length should be 1
    const len = await lrPage.getPointsLength();
    expect(len).toBe(1);

    // Canvas should have some drawing (the point). We assert that canvas has non-transparent pixels.
    const hasDrawing = await lrPage.canvasHasDrawing();
    // If the evaluation returned an error object, fail with that message
    if (typeof hasDrawing === 'object' && hasDrawing !== null && hasDrawing.__error__) {
      throw new Error('Error reading canvas image data: ' + hasDrawing.__error__);
    }
    expect(hasDrawing).toBe(true);

    // With only one point, regression line shouldn't update the equation (still initial)
    const eqText = await lrPage.getEquationText();
    expect(eqText).toBe('y = 0x + 0');
  });

  // Test adding a second point: S1_PointsAdded -> S1_PointsAdded (regression computed)
  test('AddPoint again: updates regression line and equation text', async () => {
    // Add first point
    await lrPage.addPoint();
    // Add second point to trigger regression computation
    await lrPage.addPoint();

    const len = await lrPage.getPointsLength();
    expect(len).toBeGreaterThanOrEqual(2);

    // Canvas should still have drawing
    const hasDrawing = await lrPage.canvasHasDrawing();
    if (typeof hasDrawing === 'object' && hasDrawing !== null && hasDrawing.__error__) {
      throw new Error('Error reading canvas image data: ' + hasDrawing.__error__);
    }
    expect(hasDrawing).toBe(true);

    // Equation text should now reflect computed regression. Validate format and that numbers are finite.
    const eqText = await lrPage.getEquationText();
    // Basic sanity: contains 'y =', 'x', and '+'
    expect(eqText.startsWith('y = ')).toBeTrue();
    expect(eqText.includes('x')).toBeTrue();
    expect(eqText.includes('+')).toBeTrue();

    // Assert it does not contain 'NaN' or 'Infinity'
    expect(eqText.includes('NaN')).toBeFalse();
    expect(eqText.includes('Infinity')).toBeFalse();
  });

  // Test ClearPoints event: S1_PointsAdded -> S0_Idle
  test('ClearPoints event: clears canvas and resets equation', async () => {
    // Add several points first to ensure there's something to clear
    for (let i = 0; i < 3; i++) {
      await lrPage.addPoint();
    }
    const lenBefore = await lrPage.getPointsLength();
    expect(lenBefore).toBeGreaterThanOrEqual(1);

    // Click clear to transition back to Idle
    await lrPage.clearPoints();

    // points array should be emptied
    const len = await lrPage.getPointsLength();
    expect(len).toBe(0);

    // Canvas should be empty
    const empty = await lrPage.isCanvasEmpty();
    expect(empty).toBe(true);

    // Equation should be reset to initial
    const eqText = await lrPage.getEquationText();
    expect(eqText).toBe('y = 0x + 0');
  });

  // Edge case: multiple rapid AddPoint clicks and clear when empty
  test('Edge cases: rapid additions and repeated clears should not cause uncaught errors', async () => {
    // Rapidly add 10 points
    for (let i = 0; i < 10; i++) {
      await lrPage.addPoint();
    }
    const len = await lrPage.getPointsLength();
    expect(len).toBeGreaterThanOrEqual(10);

    // Equation should exist and be numeric (no NaN/Infinity)
    const eqText = await lrPage.getEquationText();
    expect(eqText.startsWith('y = ')).toBeTrue();
    expect(eqText.includes('NaN')).toBeFalse();
    expect(eqText.includes('Infinity')).toBeFalse();

    // Clear once
    await lrPage.clearPoints();
    expect(await lrPage.getPointsLength()).toBe(0);
    expect(await lrPage.isCanvasEmpty()).toBe(true);

    // Clear again (clearing empty state) - ensure no errors and stays empty
    await lrPage.clearPoints();
    expect(await lrPage.getPointsLength()).toBe(0);
    expect(await lrPage.isCanvasEmpty()).toBe(true);
  });

  // Observe console logs and page errors explicitly and assert absence of critical JS errors.
  test('Console and runtime error observation', async ({ page }) => {
    // This test specifically inspects collected console messages and page errors.
    // We already set up listeners in beforeEach; re-check them here after a typical interaction.
    await lrPage.addPoint();
    await lrPage.addPoint();
    await lrPage.clearPoints();

    // Inspect console messages captured so far
    const errors = consoleMessages.filter(m => m.type === 'error');
    // Ensure there are no console.error messages
    expect(errors.length, 'No console.error messages should be present').toBe(0);

    // Ensure there were no uncaught page errors
    expect(pageErrors.length, 'No uncaught page errors should be present').toBe(0);

    // Also assert that normal console messages (like warnings/info) did not contain "ReferenceError" etc.
    const suspicious = consoleMessages.filter(m =>
      /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(m.text)
    );
    expect(suspicious.length, 'Console should not contain runtime exceptions text').toBe(0);
  });
});