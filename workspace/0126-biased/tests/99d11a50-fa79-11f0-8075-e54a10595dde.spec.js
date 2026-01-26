import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d11a50-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the Linear Regression Interactive Demo
class LinearRegressionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateBtn = page.locator('#generatePoints');
    this.clearBtn = page.locator('#clearPoints');
    this.numPointsInput = page.locator('#numPoints');

    this.xInput = page.locator('#xValue');
    this.yInput = page.locator('#yValue');
    this.addBtn = page.locator('#addPoint');
    this.removeBtn = page.locator('#removePoint');

    this.calculateBtn = page.locator('#calculateRegression');
    this.resetBtn = page.locator('#resetRegression');

    this.outputPoints = page.locator('#outputPoints');
    this.outputRegression = page.locator('#outputRegression');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async generatePoints(num = undefined) {
    if (typeof num === 'number') {
      await this.numPointsInput.fill(String(num));
    }
    await this.generateBtn.click();
  }

  async clearPoints() {
    await this.clearBtn.click();
  }

  async addPoint(x, y) {
    if (x !== null && x !== undefined) {
      await this.xInput.fill(String(x));
    } else {
      await this.xInput.fill('');
    }
    if (y !== null && y !== undefined) {
      await this.yInput.fill(String(y));
    } else {
      await this.yInput.fill('');
    }
    await this.addBtn.click();
  }

  async removeLastPoint() {
    await this.removeBtn.click();
  }

  async calculateRegression() {
    await this.calculateBtn.click();
  }

  async resetRegression() {
    await this.resetBtn.click();
  }

  async getOutputPointsText() {
    return (await this.outputPoints.innerText()).trim();
  }

  async getOutputRegressionText() {
    return (await this.outputRegression.innerText()).trim();
  }

  // Helper to count points by counting occurrences of '(' in the output string
  async countPointsFromOutput() {
    const text = await this.getOutputPointsText();
    const matches = text.match(/\(/g);
    return matches ? matches.length : 0;
  }
}

test.describe('Linear Regression Interactive Demo (App ID: 99d11a50-fa79-11f0-8075-e54a10595dde)', () => {
  // Common storage for console and page errors to assert unexpected runtime errors didn't happen
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app
    const lrPage = new LinearRegressionPage(page);
    await lrPage.goto();
  });

  test.afterEach(async () => {
    // After each test ensure there are no unexpected critical runtime errors
    // We assert that there are no ReferenceError, SyntaxError, or TypeError exceptions in pageErrors.
    const criticalErrors = pageErrors.filter(err => {
      const name = err && err.name;
      return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
    });

    // If any critical errors occurred, fail the test with the error details to make them visible.
    expect(criticalErrors, `Found critical runtime errors: ${criticalErrors.map(e => e?.stack || e?.message).join('\n')}`)
      .toEqual([]);
  });

  test('S0_Idle - initial render shows controls and defaults', async ({ page }) => {
    // Validate presence of key controls and default values in Idle state (S0_Idle)
    const lr = new LinearRegressionPage(page);

    // Buttons should be visible
    await expect(lr.generateBtn).toBeVisible();
    await expect(lr.clearBtn).toBeVisible();
    await expect(lr.addBtn).toBeVisible();
    await expect(lr.removeBtn).toBeVisible();
    await expect(lr.calculateBtn).toBeVisible();
    await expect(lr.resetBtn).toBeVisible();

    // numPoints default should be 5 per HTML
    await expect(lr.numPointsInput).toHaveValue('5');

    // Initially there should be no points output and no regression output
    const pointsText = await lr.getOutputPointsText();
    const regressionText = await lr.getOutputRegressionText();

    // The page hasn't called updateOutput yet, so outputs are either empty or not containing points
    expect(pointsText === '' || pointsText.startsWith('Points:'), true);
    expect(regressionText).toBe('');
  });

  test('S0 -> S1: Generate Points creates the expected number of points and renders them', async ({ page }) => {
    // Test the GeneratePoints event and transition to Points Generated (S1_PointsGenerated)
    const lr = new LinearRegressionPage(page);

    // Generate 4 random points
    await lr.generatePoints(4);

    // The output should list 4 points by checking occurrences of '('
    const count = await lr.countPointsFromOutput();
    expect(count).toBe(4);

    const outputText = await lr.getOutputPointsText();
    expect(outputText).toMatch(/^Points:\s*\(/); // starts with Points and has at least one point

    // Each point should be formatted with two decimal places like (x.xx, y.yy)
    const pointFormatRegex = /\(-?\d+\.\d{2},\s?-?\d+\.\d{2}\)/;
    expect(outputText).toMatch(pointFormatRegex);
  });

  test('S1 -> S2: Add Point appends a point and updateOutput reflects it', async ({ page }) => {
    // Generate initial points and then add a specific point
    const lr = new LinearRegressionPage(page);

    await lr.generatePoints(2);
    const initialCount = await lr.countPointsFromOutput();
    expect(initialCount).toBe(2);

    // Add a deterministic point (1.5, 2.5)
    await lr.addPoint(1.5, 2.5);

    const newCount = await lr.countPointsFromOutput();
    expect(newCount).toBe(3);

    const outputText = await lr.getOutputPointsText();
    // Ensure the added point appears formatted to two decimals
    expect(outputText).toContain('(1.50, 2.50)');
  });

  test('S2 -> S3: Remove Last Point removes the most recently added point', async ({ page }) => {
    const lr = new LinearRegressionPage(page);

    // Start with 2 points, add one, then remove it
    await lr.generatePoints(2);
    await lr.addPoint(9.99, 8.88);

    let countAfterAdd = await lr.countPointsFromOutput();
    expect(countAfterAdd).toBe(3);
    let outputText = await lr.getOutputPointsText();
    expect(outputText).toContain('(9.99, 8.88)');

    // Remove last point
    await lr.removeLastPoint();

    const countAfterRemove = await lr.countPointsFromOutput();
    expect(countAfterRemove).toBe(2);
    const textAfterRemove = await lr.getOutputPointsText();
    // Removed point should no longer be present
    expect(textAfterRemove).not.toContain('(9.99, 8.88)');
  });

  test('S1 -> S4: Calculate Regression computes slope and intercept and displays the regression line', async ({ page }) => {
    const lr = new LinearRegressionPage(page);

    // Generate points and calculate regression
    await lr.generatePoints(5);
    await lr.calculateRegression();

    const regressionText = await lr.getOutputRegressionText();
    // Regression is displayed as "y = <slope>x + <intercept>" with toFixed(2) formatting for numeric parts
    // Intercept may be negative and displayed as "+ -X.XX" per implementation
    const regressionRegex = /^y = -?\d+\.\d{2}x \+ -?\d+\.\d{2}$/;
    expect(regressionText).toMatch(regressionRegex);
  });

  test('S1 -> S5: Reset Regression clears regression output', async ({ page }) => {
    const lr = new LinearRegressionPage(page);

    // Generate, calculate, then reset
    await lr.generatePoints(3);
    await lr.calculateRegression();
    const beforeReset = await lr.getOutputRegressionText();
    expect(beforeReset.length).toBeGreaterThan(0);

    await lr.resetRegression();
    const afterReset = await lr.getOutputRegressionText();
    expect(afterReset).toBe('');
  });

  test('S1 -> S0: Clear Points removes all points and updateOutput reflects empty list', async ({ page }) => {
    const lr = new LinearRegressionPage(page);

    await lr.generatePoints(3);
    const beforeClear = await lr.countPointsFromOutput();
    expect(beforeClear).toBe(3);

    await lr.clearPoints();

    const afterClearCount = await lr.countPointsFromOutput();
    expect(afterClearCount).toBe(0);

    const output = await lr.getOutputPointsText();
    // When empty, updateOutput produces "Points: " (with trailing space)
    expect(output.startsWith('Points:')).toBeTruthy();
  });

  test('Edge case: Adding invalid or empty x/y does not add a point', async ({ page }) => {
    const lr = new LinearRegressionPage(page);

    // Start with 2 generated points
    await lr.generatePoints(2);
    const before = await lr.countPointsFromOutput();
    expect(before).toBe(2);

    // Try to add with empty x and valid y -> should not add
    await lr.addPoint(null, 3.14);
    const after1 = await lr.countPointsFromOutput();
    expect(after1).toBe(2);

    // Try to add with valid x and empty y -> should not add
    await lr.addPoint(2.71, null);
    const after2 = await lr.countPointsFromOutput();
    expect(after2).toBe(2);

    // Try to add with non-numeric string values (fill will convert to string, parseFloat => NaN) -> should not add
    await lr.xInput.fill('abc');
    await lr.yInput.fill('def');
    await lr.addBtn.click();
    const after3 = await lr.countPointsFromOutput();
    expect(after3).toBe(2);
  });

  test('Edge case: Remove Last Point when no points does nothing and does not throw', async ({ page }) => {
    const lr = new LinearRegressionPage(page);

    // Ensure no points
    await lr.clearPoints();
    const before = await lr.countPointsFromOutput();
    expect(before).toBe(0);

    // Attempt remove; should not throw and not change count
    await lr.removeLastPoint();
    const after = await lr.countPointsFromOutput();
    expect(after).toBe(0);
  });

  test('Edge case: Calculate Regression with zero points yields NaN values in output', async ({ page }) => {
    const lr = new LinearRegressionPage(page);

    // Ensure no points
    await lr.clearPoints();
    const count = await lr.countPointsFromOutput();
    expect(count).toBe(0);

    // Calculate regression with 0 points - numeric results will be NaN and toFixed produces "NaN"
    await lr.calculateRegression();

    const regressionText = await lr.getOutputRegressionText();
    // Expect NaN to appear for slope and intercept
    expect(regressionText).toMatch(/NaN/);
    expect(regressionText.startsWith('y =')).toBeTruthy();
  });

  test('Observability: No critical ReferenceError/SyntaxError/TypeError occurred during interactions', async ({ page }) => {
    // This test explicitly runs a sequence of actions while monitoring console and page errors
    // and ensures that no critical runtime exceptions occurred.
    const lr = new LinearRegressionPage(page);

    // Perform a sequence of interactions
    await lr.generatePoints(4);
    await lr.addPoint(1.0, 1.0);
    await lr.calculateRegression();
    await lr.resetRegression();
    await lr.removeLastPoint();
    await lr.clearPoints();

    // Inspect captured console messages for errors
    // We expect no console message of type 'error' that corresponds to uncaught runtime issues.
    const consoleErrors = consoleMessages.filter(msg => msg.type === 'error');
    expect(consoleErrors, `Console errors found: ${consoleErrors.map(c => c.text).join('\n')}`).toEqual([]);

    // pageErrors are asserted in afterEach for ReferenceError, SyntaxError, TypeError
    // but we assert here that, overall, there are no pageErrors at all (uncaught exceptions)
    expect(pageErrors, `Page errors: ${pageErrors.map(e => e?.stack || e?.message).join('\n')}`).toEqual([]);
  });
});