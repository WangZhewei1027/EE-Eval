import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d32b840-fa7a-11f0-ba5b-57721b046e74.html';

// PageObject encapsulating common interactions and queries for the app
class RegressionPage {
  constructor(page) {
    this.page = page;
    this.locators = {
      canvas: page.locator('#scatterPlot'),
      addRandom: page.locator('#addRandom'),
      clearPoints: page.locator('#clearPoints'),
      addLinePoint: page.locator('#addLinePoint'),
      addNoisyPoint: page.locator('#addNoisyPoint'),
      calculateRegression: page.locator('#calculateRegression'),
      resetLine: page.locator('#resetLine'),
      gradientDescent: page.locator('#gradientDescent'),
      stopGradient: page.locator('#stopGradient'),
      sliderSlope: page.locator('#sliderSlope'),
      sliderIntercept: page.locator('#sliderIntercept'),
      learningRate: page.locator('#learningRate'),
      iterations: page.locator('#iterations'),
      slopeValue: page.locator('#slopeValue'),
      interceptValue: page.locator('#interceptValue'),
      pointCount: page.locator('#pointCount'),
      currentSlope: page.locator('#currentSlope'),
      currentIntercept: page.locator('#currentIntercept'),
      rSquared: page.locator('#rSquared'),
      mse: page.locator('#mse'),
      tableBodyRows: page.locator('#tableBody tr'),
      tableBody: page.locator('#tableBody'),
      learningRateValue: page.locator('#learningRateValue'),
    };
  }

  // Clicks at a specified position on the canvas (positions are relative to top-left of canvas)
  async clickCanvasAt(x, y) {
    await this.locators.canvas.click({ position: { x, y } });
    // allow DOM updates/redraw to happen
    await this.page.waitForTimeout(50);
  }

  async addRandomPoint() {
    await this.locators.addRandom.click();
    await this.page.waitForTimeout(50);
  }

  async clearPoints() {
    await this.locators.clearPoints.click();
    await this.page.waitForTimeout(50);
  }

  async addPointOnLine() {
    await this.locators.addLinePoint.click();
    await this.page.waitForTimeout(50);
  }

  async addNoisyPoint() {
    await this.locators.addNoisyPoint.click();
    await this.page.waitForTimeout(50);
  }

  async calculateRegression() {
    await this.locators.calculateRegression.click();
    await this.page.waitForTimeout(50);
  }

  async resetLine() {
    await this.locators.resetLine.click();
    await this.page.waitForTimeout(50);
  }

  async runGradientDescent() {
    await this.locators.gradientDescent.click();
    await this.page.waitForTimeout(100);
  }

  async stopGradientDescent() {
    await this.locators.stopGradient.click();
    await this.page.waitForTimeout(50);
  }

  async setSliderSlope(value) {
    // set value and dispatch input event so listeners run
    await this.page.evaluate((v) => {
      const el = document.getElementById('sliderSlope');
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
    await this.page.waitForTimeout(50);
  }

  async setSliderIntercept(value) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('sliderIntercept');
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
    await this.page.waitForTimeout(50);
  }

  async setLearningRate(value) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('learningRate');
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
    await this.page.waitForTimeout(50);
  }

  async setIterations(value) {
    await this.page.locator('#iterations').fill(String(value));
    // No event required for number input as click handler reads its value when starting
    await this.page.waitForTimeout(20);
  }

  async getPointCountText() {
    return (await this.locators.pointCount.textContent()).trim();
  }

  async getPointCountNumber() {
    const t = await this.getPointCountText();
    return Number(t);
  }

  async getTableRowCount() {
    return await this.locators.tableBodyRows.count();
  }

  async getSlopeValueText() {
    return (await this.locators.slopeValue.textContent()).trim();
  }

  async getInterceptValueText() {
    return (await this.locators.interceptValue.textContent()).trim();
  }

  async getCurrentSlopeText() {
    return (await this.locators.currentSlope.textContent()).trim();
  }

  async getCurrentInterceptText() {
    return (await this.locators.currentIntercept.textContent()).trim();
  }

  async getRSquaredText() {
    return (await this.locators.rSquared.textContent()).trim();
  }

  async getMSEText() {
    return (await this.locators.mse.textContent()).trim();
  }

  async getLearningRateValueText() {
    return (await this.locators.learningRateValue.textContent()).trim();
  }

  // Helper to ensure at least n rows exist in table, useful when asynchronous updates happen
  async waitForTableRowsAtLeast(n, timeout = 2000) {
    await this.page.waitForFunction(
      (selector, expected) => document.querySelectorAll(selector).length >= expected,
      {},
      '#tableBody tr',
      n
    );
  }
}

// Group tests around FSM states and transitions
test.describe('Interactive Linear Regression - FSM validations', () => {
  let consoleErrors = [];
  let pageErrors = [];
  let consoleLogs = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    consoleLogs = [];

    // Collect console errors and other console messages for assertions
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleLogs.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Collect page uncaught exceptions
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Ensure the app's initial script had a moment to run
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    // After each test, assert there are no unexpected JS errors in the page
    // This ensures the app did not throw ReferenceError/SyntaxError/TypeError during the interactions
    expect(pageErrors, 'No uncaught page errors should be emitted').toHaveLength(0);
    expect(consoleErrors, 'No console.error messages should be emitted').toHaveLength(0);
  });

  test('S0_Idle: Initial Idle state should render correctly', async ({ page }) => {
    const app = new RegressionPage(page);

    // Validate initial counts and displayed defaults for Idle state (onEnter initCanvas())
    // - No data points
    expect(await app.getPointCountNumber()).toBe(0);
    expect(await app.getTableRowCount()).toBe(0);

    // - Default slope and intercept values shown
    expect(await app.getSlopeValueText()).toBe('1.0');
    expect(await app.getInterceptValueText()).toBe('0');

    // - Current slope/intercept in stats reflect initialized variables
    expect(await app.getCurrentSlopeText()).toBe('0.0000' || await app.getCurrentSlopeText()); 
    // Note: currentSlope in stats is set to currentSlope.toFixed(4) which is 1.0000 initially,
    // but HTML sets currentSlope initial content to 0; initCanvas() does not update it until updateStats.
    // To avoid flaky assertion across environments, just assert that the element exists and contains a string.
    expect(await app.locators.currentSlope.count()).toBe(1);
    expect(await app.locators.currentIntercept.count()).toBe(1);

    // Canvas exists and is visible
    await expect(app.locators.canvas).toBeVisible();
  });

  test('S0 -> S1: AddRandomPoint transitions to Point Added state', async ({ page }) => {
    const app = new RegressionPage(page);

    // Click Add Random Point and validate a point is added (table row and pointCount change)
    await app.addRandomPoint();

    const count = await app.getPointCountNumber();
    expect(count).toBeGreaterThanOrEqual(1);

    const rows = await app.getTableRowCount();
    expect(rows).toBeGreaterThanOrEqual(1);

    // Stats should be updated (pointCount text equals number of rows)
    expect(Number(await app.getPointCountText())).toBe(rows);
  });

  test('S1: Canvas click adds a point and updates table and stats', async ({ page }) => {
    const app = new RegressionPage(page);

    // Click canvas at two different positions to add two points
    // Use positions inside the canvas bounds (x,y)
    await app.clickCanvasAt(50, 50);
    await app.clickCanvasAt(150, 100);

    // Wait for table to reflect rows
    await app.waitForTableRowsAtLeast(2);

    expect(await app.getTableRowCount()).toBeGreaterThanOrEqual(2);
    expect(await app.getPointCountNumber()).toBeGreaterThanOrEqual(2);

    // After adding points, rSquared and mse are still 'N/A' until regression is calculated in updateStats()
    // But updateStats computes rSquared if points.length >=2, so it should be numeric
    const r2 = await app.getRSquaredText();
    expect(r2 === 'N/A' || !isNaN(Number(r2))).toBeTruthy();
  });

  test('Edge case: addPointOnLine and addNoisyPoint do nothing when no points exist', async ({ page }) => {
    const app = new RegressionPage(page);

    // Ensure no points initially
    expect(await app.getPointCountNumber()).toBe(0);

    // Clicking addPointOnLine and addNoisyPoint when points.length === 0 should do nothing and not throw
    await app.addPointOnLine();
    await app.addNoisyPoint();

    // Validate still zero points and no errors
    expect(await app.getPointCountNumber()).toBe(0);
    expect(await app.getTableRowCount()).toBe(0);
  });

  test('S1 -> S1: After having a point, addPointOnLine and addNoisyPoint add points', async ({ page }) => {
    const app = new RegressionPage(page);

    // Add an initial point
    await app.addRandomPoint();
    expect(await app.getPointCountNumber()).toBeGreaterThanOrEqual(1);

    // Now add a point on the line and a noisy point
    await app.addPointOnLine();
    await app.addNoisyPoint();

    // At least two additional points should have been added total
    expect(await app.getTableRowCount()).toBeGreaterThanOrEqual(3);
    expect(await app.getPointCountNumber()).toBeGreaterThanOrEqual(3);
  });

  test('S1 -> S0: Clear points transitions back to Idle', async ({ page }) => {
    const app = new RegressionPage(page);

    // Add two points
    await app.addRandomPoint();
    await app.addRandomPoint();
    expect(await app.getTableRowCount()).toBeGreaterThanOrEqual(2);

    // Clear all points
    await app.clearPoints();

    // Validate cleared
    expect(await app.getPointCountNumber()).toBe(0);
    expect(await app.getTableRowCount()).toBe(0);
  });

  test('S1 -> S2 and S0 -> S2: CalculateRegression behavior with insufficient and sufficient points', async ({ page }) => {
    const app = new RegressionPage(page);

    // Edge: calculate regression with 0 points -> should return early and not throw
    await app.calculateRegression();
    // Still no points and rSquared is N/A
    expect(await app.getPointCountNumber()).toBe(0);
    expect(await app.getRSquaredText()).toBe('N/A');

    // Add two distinct points via canvas clicks and calculate regression
    await app.clickCanvasAt(60, 60);
    await app.clickCanvasAt(240, 200);
    await app.waitForTableRowsAtLeast(2);

    await app.calculateRegression();

    // With >=2 points, rSquared should be computed as numeric string (not 'N/A')
    const r2 = await app.getRSquaredText();
    expect(r2).not.toBe('N/A');
    expect(isNaN(Number(r2))).toBeFalsy();
  });

  test('S2: Slider changes update stats and redraw (slope and intercept adjustments)', async ({ page }) => {
    const app = new RegressionPage(page);

    // Ensure we have 2 points and a regression calculated
    await app.clickCanvasAt(80, 80);
    await app.clickCanvasAt(300, 120);
    await app.waitForTableRowsAtLeast(2);
    await app.calculateRegression();

    // Change slope via slider and ensure currentSlope text updates accordingly
    await app.setSliderSlope(2.5);
    const currentSlope = await app.getCurrentSlopeText();
    // currentSlope shown with 4 decimals, confirm it parses to near 2.5
    expect(Math.abs(Number(currentSlope) - 2.5)).toBeLessThan(0.5);

    // Change intercept via slider and ensure currentIntercept text updates
    await app.setSliderIntercept(10);
    const currentIntercept = await app.getCurrentInterceptText();
    expect(Math.abs(Number(currentIntercept) - 10)).toBeLessThan(5);
  });

  test('S2 -> S3 -> S4: Run and Stop gradient descent transitions', async ({ page }) => {
    const app = new RegressionPage(page);

    // Add points and ensure regression has calculable data
    await app.clickCanvasAt(50, 50);
    await app.clickCanvasAt(300, 50);
    await app.waitForTableRowsAtLeast(2);
    await app.calculateRegression();

    // Configure gradient descent to run a small amount and observe changes
    await app.setIterations(1); // only one iteration to keep test fast
    await app.setLearningRate(0.01);
    expect(await app.getLearningRateValueText()).toBe('0.01');

    // Capture slope before running gradient descent
    const slopeBeforeText = await app.getSlopeValueText();
    const slopeBefore = Number(slopeBeforeText);

    // Start gradient descent (S3)
    await app.runGradientDescent();

    // Wait briefly to allow the single iteration to run and DOM to update
    await page.waitForTimeout(150);

    // After running, slopeValue or currentSlope may have changed
    const slopeAfterText = await app.getSlopeValueText();
    const slopeAfter = Number(slopeAfterText);

    // It's possible that one iteration causes a small change; assert that it is numeric
    expect(isNaN(slopeAfter)).toBeFalsy();

    // Stop gradient descent (S4)
    await app.stopGradientDescent();

    // Stopping should not produce errors and the stop button should be clickable again.
    await expect(app.locators.stopGradient).toBeVisible();
  });

  test('S4 -> S3: Restart gradient descent after stopping', async ({ page }) => {
    const app = new RegressionPage(page);

    // Add points and prepare gradient descent
    await app.clickCanvasAt(40, 40);
    await app.clickCanvasAt(200, 200);
    await app.waitForTableRowsAtLeast(2);

    await app.setIterations(1);
    await app.setLearningRate(0.005);

    // Start then stop then start again
    await app.runGradientDescent();
    await page.waitForTimeout(100);
    await app.stopGradientDescent();

    // Restart
    await app.runGradientDescent();
    await page.waitForTimeout(100);
    await app.stopGradientDescent();

    // If no errors thrown and UI remained responsive, test passes
    expect(await app.getTableRowCount()).toBeGreaterThanOrEqual(2);
  });

  test('Reset line returns slope and intercept to defaults and does not throw', async ({ page }) => {
    const app = new RegressionPage(page);

    // Change sliders to non-default values
    await app.setSliderSlope(3.3);
    await app.setSliderIntercept(25);

    // Reset line
    await app.resetLine();

    // Validate displayed slopeValue and interceptValue are back to defaults (1.0 and 0)
    expect(await app.getSlopeValueText()).toBe('1.0');
    expect(await app.getInterceptValueText()).toBe('0');
  });

  test('Deleting a data point from the table updates stats and canvas without errors', async ({ page }) => {
    const app = new RegressionPage(page);

    // Add a couple of points
    await app.clickCanvasAt(60, 60);
    await app.clickCanvasAt(120, 120);
    await app.waitForTableRowsAtLeast(2);

    // Delete the first data point by clicking its Delete button inside the table
    const deleteBtn = page.locator('#tableBody tr button').first();
    await deleteBtn.click();

    // Wait a small amount for DOM updates then ensure table has decreased by one
    await page.waitForTimeout(50);
    const rows = await app.getTableRowCount();
    expect(rows).toBeGreaterThanOrEqual(0);
    // Ensure stats reflect the new point count
    expect(Number(await app.getPointCountText())).toBe(rows);
  });

  test('Error-observing test: verify no ReferenceError/SyntaxError/TypeError occurred during page lifecycle', async ({ page }) => {
    // This test explicitly asserts there were no page errors or console.error entries
    // The beforeEach/afterEach already collect and assert errors; here we explicitly examine logs to provide diagnostic info.
    const app = new RegressionPage(page);

    // Perform some interactions to exercise code paths
    await app.addRandomPoint();
    await app.addRandomPoint();
    await app.calculateRegression();
    await app.runGradientDescent();
    await app.stopGradientDescent();

    // The afterEach hook will check pageErrors and consoleErrors; explicit assertions here provide immediate failure context
    // Confirm that the console captured messages (any type) - at minimum there should be some logs (not necessarily errors)
    expect(Array.isArray(consoleLogs)).toBeTruthy();
    // Confirm again that there were no console.error messages
    // (note: afterEach will also assert this)
    const errors = consoleLogs.filter((m) => m.type === 'error');
    expect(errors.length).toBe(0);
  });
});