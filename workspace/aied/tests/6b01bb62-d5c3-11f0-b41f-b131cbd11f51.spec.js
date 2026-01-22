import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b01bb62-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object Model for the Regression App
class RegressionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#regressionCanvas');
    this.pointCount = page.locator('#pointCount');
    this.equationText = page.locator('#equationText');
    this.addRandomBtn = page.locator('#addRandom');
    this.clearBtn = page.locator('#clearPoints');
    this.showHelpBtn = page.locator('#showHelp');
    this.explanation = page.locator('#explanation');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure root elements are visible before interacting
    await expect(this.canvas).toBeVisible();
    await expect(this.pointCount).toBeVisible();
  }

  // Click on canvas at a position given as fractions of width/height (0..1)
  async clickCanvasAt(normalizedX = 0.5, normalizedY = 0.5) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box is not available');
    const x = Math.max(1, Math.min(box.width - 1, box.x + normalizedX * box.width));
    const y = Math.max(1, Math.min(box.height - 1, box.y + normalizedY * box.height));
    await this.page.mouse.click(x, y);
    // Wait a tick for UI update
    await this.page.waitForTimeout(50);
  }

  async clickAddRandom() {
    await this.addRandomBtn.click();
    await this.page.waitForTimeout(50);
  }

  async clickClear() {
    await this.clearBtn.click();
    await this.page.waitForTimeout(50);
  }

  async clickShowHelp() {
    await this.showHelpBtn.click();
    await this.page.waitForTimeout(50);
  }

  async getPointCount() {
    return Number((await this.pointCount.textContent()).trim());
  }

  async getEquationText() {
    return (await this.equationText.textContent()).trim();
  }

  async getExplanationDisplay() {
    // read computed style 'display' as set inline by the app
    return await this.page.evaluate(() => {
      const el = document.getElementById('explanation');
      return el ? el.style.display : null;
    });
  }
}

test.describe('Linear Regression Demonstration - FSM and UI Tests', () => {
  let consoleErrors = [];
  let pageErrors = [];
  let consoleHandler;
  let pageErrorHandler;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    consoleHandler = msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    };
    page.on('console', consoleHandler);

    // Capture uncaught exceptions / page errors
    pageErrorHandler = err => {
      pageErrors.push(err.message);
    };
    page.on('pageerror', pageErrorHandler);
  });

  test.afterEach(async ({ page }) => {
    // Cleanup listeners to avoid cross-test leakage
    try {
      page.off('console', consoleHandler);
      page.off('pageerror', pageErrorHandler);
    } catch (e) {
      // ignore cleanup errors
    }
  });

  test('S0_Idle: Initial state on load - canvas drawn and UI initialized', async ({ page }) => {
    // Validate initial idle state and that on-entry drawCoordinateSystem() does not throw errors
    const app = new RegressionPage(page);
    await app.goto();

    // Initial point count should be 0 (evidence of initial state)
    const initialCount = await app.getPointCount();
    expect(initialCount).toBe(0);

    // Equation text should be the initial "y = 0x + 0" string
    const initialEq = await app.getEquationText();
    expect(initialEq).toBe('y = 0x + 0');

    // Explanation should be hidden as per HTML inline style
    const explanationDisplay = await app.getExplanationDisplay();
    expect(explanationDisplay).toBe('none');

    // Ensure no unexpected runtime errors occurred during initialization
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('S0 -> S1: Clicking canvas adds a single point (Point Added)', async ({ page }) => {
    // Validate adding a single data point via canvas click
    const app = new RegressionPage(page);
    await app.goto();

    // Click near center to add one point
    await app.clickCanvasAt(0.5, 0.5);

    // Expect pointCount to be 1 (transition S0_Idle -> S1_PointAdded)
    const countAfterOne = await app.getPointCount();
    expect(countAfterOne).toBe(1);

    // With only one point the regression is not drawn (calculateRegression returns {m:0,b:0})
    const eq = await app.getEquationText();
    // It should still be in a consistent format; application sets equation only when >=2
    // After adding one point, equation should remain initial 'y = 0x + 0'
    expect(eq).toBe('y = 0x + 0');

    // No runtime errors should have occurred
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('S1 -> S1: Clicking canvas again increments points to two and draws regression', async ({ page }) => {
    // Validate adding two points results in regression line calculation and equation update
    const app = new RegressionPage(page);
    await app.goto();

    // Add two distinct points
    await app.clickCanvasAt(0.4, 0.45);
    await app.clickCanvasAt(0.6, 0.55);

    // Expect pointCount to be 2
    const countAfterTwo = await app.getPointCount();
    expect(countAfterTwo).toBe(2);

    // Expect equationText to have updated away from the initial literal 'y = 0x + 0'
    const eqAfterTwo = await app.getEquationText();
    expect(eqAfterTwo).not.toBe('y = 0x + 0');

    // Validate the equation format is numeric with two decimal places as set by toFixed(2)
    // Example: "y = -0.12x + 0.34" or similar
    expect(eqAfterTwo).toMatch(/^y = -?\d+\.\d{2}x \+ -?\d+\.\d{2}$/);

    // No runtime errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('S0 -> S2: Add Random Points adds 10 points from Idle', async ({ page }) => {
    // Validate the "Add Random Points" transition adds exactly 10 points
    const app = new RegressionPage(page);
    await app.goto();

    // Confirm starting from Idle
    expect(await app.getPointCount()).toBe(0);

    // Click Add Random Points
    await app.clickAddRandom();

    // Expect 10 points added (transition to S2_RandomPointsAdded)
    const countAfterRandom = await app.getPointCount();
    expect(countAfterRandom).toBe(10);

    // There should be an equation calculated because points >=2
    const eq = await app.getEquationText();
    expect(eq).toMatch(/^y = -?\d+\.\d{2}x \+ -?\d+\.\d{2}$/);

    // No runtime errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('S1 -> S3: Clear Points clears all points and updates count to 0', async ({ page }) => {
    // Validate clearing points from a state where points exist
    const app = new RegressionPage(page);
    await app.goto();

    // Add a couple of points
    await app.clickCanvasAt(0.45, 0.45);
    await app.clickCanvasAt(0.55, 0.55);
    expect(await app.getPointCount()).toBe(2);

    // Clear all points
    await app.clickClear();

    // Expect pointCount to be 0 (transition to S3_PointsCleared)
    const countAfterClear = await app.getPointCount();
    expect(countAfterClear).toBe(0);

    // Edge: After clearing, the UI may or may not reset the equation text.
    // The FSM evidence only requires Data Points: 0, so ensure that is true.
    // Also assert no runtime errors occurred during clear.
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('S0 -> S4: Show Help toggles the explanation visibility', async ({ page }) => {
    // Validate toggling explanation display
    const app = new RegressionPage(page);
    await app.goto();

    // Initially hidden
    expect(await app.getExplanationDisplay()).toBe('none');

    // Click show help -> visible
    await app.clickShowHelp();
    expect(await app.getExplanationDisplay()).toBe('block');

    // Click show help again -> hidden
    await app.clickShowHelp();
    expect(await app.getExplanationDisplay()).toBe('none');

    // No runtime errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Edge case: Clearing when no points does not throw and keeps count at 0', async ({ page }) => {
    // Validate clear button is safe to use in idle state
    const app = new RegressionPage(page);
    await app.goto();

    // Ensure 0 points initially
    expect(await app.getPointCount()).toBe(0);

    // Click clear when there are no points
    await app.clickClear();

    // Still 0 and no errors should have occurred
    expect(await app.getPointCount()).toBe(0);
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Edge case: Adding random points multiple times accumulates correctly', async ({ page }) => {
    // Ensure repeated Add Random actions accumulate points as expected
    const app = new RegressionPage(page);
    await app.goto();

    // Click add random twice
    await app.clickAddRandom();
    await app.clickAddRandom();

    // Expect 20 points total
    expect(await app.getPointCount()).toBe(20);

    // No runtime errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Observe console and page errors across interactions - report any runtime exceptions', async ({ page }) => {
    // This test explicitly loads app and runs through several interactions while collecting console/page errors.
    const app = new RegressionPage(page);
    await app.goto();

    // Series of interactions
    await app.clickCanvasAt(0.5, 0.4);
    await app.clickAddRandom();
    await app.clickCanvasAt(0.2, 0.8);
    await app.clickClear();
    await app.clickShowHelp();
    await app.clickShowHelp(); // toggle back

    // Allow a short time for any asynchronous errors to surface
    await page.waitForTimeout(100);

    // If any page errors occurred, surface them as test failures with context
    if (pageErrors.length > 0) {
      // Fail with collected page errors for debugging
      throw new Error('Page errors detected: ' + pageErrors.join(' | '));
    }

    // If any console errors occurred, fail the test with their contents
    if (consoleErrors.length > 0) {
      throw new Error('Console errors detected: ' + consoleErrors.join(' | '));
    }

    // If none, assert arrays are empty as a final expect
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});