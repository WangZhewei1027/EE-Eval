import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3dfc80-fa74-11f0-a1b6-4b9b8151441a.html';

/**
 * RegressionPage: Page Object encapsulating interactions and queries for the Linear Regression Demo
 */
class RegressionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.resetBtn = page.locator('#resetBtn');
    this.randomBtn = page.locator('#randomBtn');
    this.calculateBtn = page.locator('#calculateBtn');
    this.canvas = page.locator('#regressionChart');
    this.dataPointsEl = page.locator('#dataPoints');
    this.equationEl = page.locator('#equation');
    this.slopeEl = page.locator('#slope');
    this.interceptEl = page.locator('#intercept');
    this.rSquaredEl = page.locator('#rSquared');
  }

  // Navigate to the app and wait until initial random points populate the textarea (the page triggers randomBtn.click())
  async gotoAndWait() {
    await this.page.goto(APP_URL);
    // Wait for the initial random population to complete: dataPoints textarea should become non-empty
    await this.page.waitForFunction(() => {
      const el = document.getElementById('dataPoints');
      return !!el && el.value.length > 0;
    });
  }

  // Click the canvas at the given offsets (x,y) relative to top-left of canvas bounding box
  async clickCanvasAt(offsetX = 10, offsetY = 10) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    const x = box.x + offsetX;
    const y = box.y + offsetY;
    await this.page.mouse.click(x, y);
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async clickRandom() {
    await this.randomBtn.click();
  }

  async clickCalculate() {
    await this.calculateBtn.click();
  }

  async getDataPointsText() {
    return (await this.dataPointsEl.inputValue()).trim();
  }

  async getEquationText() {
    return (await this.equationEl.textContent())?.trim();
  }

  async getSlopeText() {
    return (await this.slopeEl.textContent())?.trim();
  }

  async getInterceptText() {
    return (await this.interceptEl.textContent())?.trim();
  }

  async getRSquaredText() {
    return (await this.rSquaredEl.textContent())?.trim();
  }

  // Returns the number of points currently in the scatter dataset (dataset[0])
  async getChartPointCount() {
    return await this.page.evaluate(() => {
      const canvas = document.getElementById('regressionChart');
      // Chart.getChart is available in Chart.js v3+ to access chart instance by canvas
      const chart = window.Chart && window.Chart.getChart ? window.Chart.getChart(canvas) : null;
      if (!chart) return null;
      return chart.data.datasets[0].data.length;
    });
  }

  // Programmatically add a point using the page's addDataPoint function (calls into app code)
  async addDataPointViaEval(x, y) {
    await this.page.evaluate((xx, yy) => {
      // addDataPoint is defined in the page script scope (global)
      if (typeof window.addDataPoint === 'function') {
        window.addDataPoint(xx, yy);
      } else {
        // If addDataPoint isn't exposed on window (function declarations are global), try direct access
        // This is intentionally non-invasive: we just attempt to call the function if available.
        // If not available, nothing happens.
      }
    }, x, y);
  }

  // Read chart regression line endpoints (dataset[1])
  async getRegressionLineEndpoints() {
    return await this.page.evaluate(() => {
      const canvas1 = document.getElementById('regressionChart');
      const chart1 = window.Chart && window.Chart.getChart ? window.Chart.getChart(canvas) : null;
      if (!chart) return null;
      const data = chart.data.datasets[1].data;
      return data.map(p => ({ x: p.x, y: p.y }));
    });
  }
}

test.describe('Linear Regression Demo - FSM validation and interactions', () => {
  // Collect console errors and page errors observed during the test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages, especially errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown at top-level; assertions about console/page errors are done inside tests
  });

  test('Initial load should render page and populate initial random data (S0 -> S1 via auto-random click)', async ({ page }) => {
    const app = new RegressionPage(page);

    // Load the page; the app's script triggers randomBtn.click() on load
    await app.gotoAndWait();

    // Validate the page title indicates correct app (evidence for S0_Idle entry)
    await expect(page).toHaveTitle(/Linear Regression Demo/);

    // Data points textarea should have been populated by the initial randomBtn.click()
    const dataText = await app.getDataPointsText();
    expect(dataText.length).toBeGreaterThan(0);

    // There should be approximately 10 data points created by the initial random fill
    const dataLines = dataText.split('\n').filter(Boolean);
    expect(dataLines.length).toBeGreaterThanOrEqual(8); // allow some tolerance
    expect(dataLines.length).toBeLessThanOrEqual(12);

    // Chart dataset should reflect the same number of points
    const chartCount = await app.getChartPointCount();
    expect(chartCount).toBeGreaterThanOrEqual(8);

    // Equation, slope, intercept, rSquared should be present and formatted
    const eq = await app.getEquationText();
    expect(eq).toMatch(/^y = .*x \+ .*$/);
    const slopeText = await app.getSlopeText();
    const interceptText = await app.getInterceptText();
    const rText = await app.getRSquaredText();
    expect(slopeText.length).toBeGreaterThan(0);
    expect(interceptText.length).toBeGreaterThan(0);
    expect(rText.length).toBeGreaterThan(0);

    // Ensure no uncaught page errors occurred during load
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.toString()).join(', ')}`).toBe(0);

    // Ensure there are no console error messages
    expect(consoleErrors.length, `Unexpected console errors: ${consoleErrors.map(e => e.text).join(', ')}`).toBe(0);
  });

  test('Reset Data transitions to Idle (S1 -> S0) and clears data, chart, and stats', async ({ page }) => {
    const app1 = new RegressionPage(page);
    await app.gotoAndWait();

    // Click Reset Data to clear points
    await app.clickReset();

    // Data textarea should be empty
    const dataTextAfterReset = await app.getDataPointsText();
    expect(dataTextAfterReset).toBe('');

    // Chart should have zero scatter points
    const chartCountAfterReset = await app.getChartPointCount();
    expect(chartCountAfterReset).toBe(0);

    // Equation, slope, intercept, rSquared should be reset to textual zeros as updateRegression is called
    const eq1 = await app.getEquationText();
    expect(eq).toBe('y = 0.00x + 0.00');
    expect(await app.getSlopeText()).toBe('0.0000');
    expect(await app.getInterceptText()).toBe('0.0000');
    expect(await app.getRSquaredText()).toBe('0.0000');

    // No runtime errors should have been thrown as a result of reset
    expect(pageErrors.length, `Unexpected page errors after reset: ${pageErrors.map(e => e.toString()).join(', ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console errors after reset: ${consoleErrors.map(e => e.text).join(', ')}`).toBe(0);
  });

  test('Clicking on the canvas adds a data point (S0 -> S1 via ClickAddDataPoint)', async ({ page }) => {
    const app2 = new RegressionPage(page);
    await app.gotoAndWait();

    // Ensure a clean baseline by resetting first
    await app.clickReset();
    expect(await app.getChartPointCount()).toBe(0);
    expect(await app.getDataPointsText()).toBe('');

    // Click canvas at center to add a new point
    const box1 = await app.canvas.boundingBox();
    if (!box) throw new Error('Canvas not available for clicking');
    const centerX = Math.floor(box.width / 2);
    const centerY = Math.floor(box.height / 2);
    await app.clickCanvasAt(centerX, centerY);

    // After click, the textarea should have one line describing the point
    const dataText1 = await app.getDataPointsText();
    const lines = dataText.split('\n').filter(Boolean);
    expect(lines.length).toBe(1);

    // Chart should show 1 data point
    const chartCount1 = await app.getChartPointCount();
    expect(chartCount).toBe(1);

    // Because only 1 point exists, regression calculation returns zeros (edge case)
    expect(await app.getSlopeText()).toBe('0.0000');
    expect(await app.getInterceptText()).toBe('0.0000');
    expect(await app.getRSquaredText()).toBe('0.0000');

    // No unexpected errors occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Add Random Points button populates ~10 points and updates regression (S0 -> S1 via ClickAddRandomPoints)', async ({ page }) => {
    const app3 = new RegressionPage(page);
    await app.gotoAndWait();

    // Reset first for a deterministic test
    await app.clickReset();
    expect(await app.getChartPointCount()).toBe(0);

    // Click Add Random Points
    await app.clickRandom();

    // After clicking, textarea should have ~10 entries
    const dataText2 = await app.getDataPointsText();
    const lines1 = dataText.split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(8);
    expect(lines.length).toBeLessThanOrEqual(12);

    // Chart scatter dataset should match count
    const chartCount2 = await app.getChartPointCount();
    expect(chartCount).toBeGreaterThanOrEqual(8);

    // Ensure slope/intercept/r-squared are strings representing finite numbers
    const slopeVal = parseFloat(await app.getSlopeText());
    const interceptVal = parseFloat(await app.getInterceptText());
    const rVal = parseFloat(await app.getRSquaredText());
    expect(Number.isFinite(slopeVal)).toBe(true);
    expect(Number.isFinite(interceptVal)).toBe(true);
    expect(Number.isFinite(rVal)).toBe(true);

    // No runtime errors during random generation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Calculate Manually updates regression for programmatically added points (S1 -> S1 via ClickCalculateManually)', async ({ page }) => {
    const app4 = new RegressionPage(page);
    await app.gotoAndWait();

    // Reset to ensure we start with zero points
    await app.clickReset();
    expect(await app.getChartPointCount()).toBe(0);

    // Programmatically add two points that form a simple line y = 2x + 1
    await app.addDataPointViaEval(1, 3); // y = 2*1 + 1 = 3
    await app.addDataPointViaEval(2, 5); // y = 2*2 + 1 = 5

    // Ensure the points were added to the textarea
    const dataText3 = await app.getDataPointsText();
    const lines2 = dataText.split('\n').filter(Boolean);
    expect(lines.length).toBe(2);

    // Now click Calculate Manually to force updateRegression()
    await app.clickCalculate();

    // Verify the slope and intercept approximate the expected values (2 and 1)
    const slope = parseFloat(await app.getSlopeText());
    const intercept = parseFloat(await app.getInterceptText());
    const rSquared = parseFloat(await app.getRSquaredText());

    // Use tolerances for floating point rounding
    expect(Math.abs(slope - 2)).toBeLessThan(1e-6);
    expect(Math.abs(intercept - 1)).toBeLessThan(1e-6);
    // With exact points, rSquared should be 1
    expect(Math.abs(rSquared - 1)).toBeLessThan(1e-6);

    // Regression line endpoints should reflect a line that fits those points
    const endpoints = await app.getRegressionLineEndpoints();
    expect(Array.isArray(endpoints) && endpoints.length === 2).toBe(true);

    // No runtime errors from manual calculation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: calculating regression with fewer than 2 points returns zeros and does not throw', async ({ page }) => {
    const app5 = new RegressionPage(page);
    await app.gotoAndWait();

    // Reset to zero points
    await app.clickReset();
    expect(await app.getChartPointCount()).toBe(0);

    // Click calculate with 0 points
    await app.clickCalculate();
    expect(await app.getSlopeText()).toBe('0.0000');
    expect(await app.getInterceptText()).toBe('0.0000');
    expect(await app.getRSquaredText()).toBe('0.0000');

    // Add a single point programmatically
    await app.addDataPointViaEval(4, 7);
    const afterOne = (await app.getDataPointsText()).split('\n').filter(Boolean).length;
    expect(afterOne).toBe(1);

    // Click calculate with 1 point (should still be zeros)
    await app.clickCalculate();
    expect(await app.getSlopeText()).toBe('0.0000');
    expect(await app.getInterceptText()).toBe('0.0000');
    expect(await app.getRSquaredText()).toBe('0.0000');

    // Ensure no errors occurred for these edge conditions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observes console and page errors during interactions (assert none of ReferenceError/SyntaxError/TypeError occurred)', async ({ page }) => {
    const app6 = new RegressionPage(page);
    await app.gotoAndWait();

    // Perform some interactions that exercise code paths
    await app.clickReset();
    await app.clickRandom();
    await app.clickCalculate();

    // After interactions, verify that there were no page-level errors
    // If there are pageErrors, list them to aid debugging
    if (pageErrors.length > 0) {
      // Fail with descriptive information
      const msgs = pageErrors.map(e => e.toString()).join('\n---\n');
      expect(pageErrors.length, `Unexpected page errors:\n${msgs}`).toBe(0);
    }

    // Ensure console errors array is empty
    if (consoleErrors.length > 0) {
      const msgs1 = consoleErrors.map(e => e.text).join('\n---\n');
      expect(consoleErrors.length, `Unexpected console error messages:\n${msgs}`).toBe(0);
    }

    // Additional explicit checks that no common JS error names appeared in captured page errors
    for (const err of pageErrors) {
      const name = err && err.name ? err.name : '';
      expect(name !== 'ReferenceError' && name !== 'SyntaxError' && name !== 'TypeError', `Unexpected JS error type: ${name}`).toBe(true);
    }
  });
});