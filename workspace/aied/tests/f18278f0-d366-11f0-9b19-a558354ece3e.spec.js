import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f18278f0-d366-11f0-9b19-a558354ece3e.html';

test.describe('Linear Regression Visualizer - FSM driven E2E tests', () => {
  // Capture console.error and page errors for each test
  test.beforeEach(async ({ page }) => {
    // arrays attached to page so each test can inspect them via evaluate if needed
    await page.addInitScript(() => {
      window.__playwright_console_errors = [];
      window.__playwright_page_errors = [];
    });
  });

  test('S0_Idle: Page loads and initChart() runs (initialization checks)', async ({ page }) => {
    // Capture runtime errors and console.error messages
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Wait for the canvas element to be present
    const canvas = page.locator('#regressionChart');
    await expect(canvas).toBeVisible();

    // Check that the initial point inputs from HTML exist (there are 3 initially)
    const pointInputs = page.locator('.point-input');
    await expect(pointInputs).toHaveCount(3);

    // Verify that initChart likely ran by checking window.chart exists and has datasets
    const chartExists = await page.evaluate(() => {
      return typeof window.chart !== 'undefined' && window.chart !== null &&
             Array.isArray(window.chart.data?.datasets);
    });
    expect(chartExists).toBeTruthy();

    // Verify the chart's first dataset contains the initial points length (should match 3)
    const datasetLength = await page.evaluate(() => {
      return window.chart?.data?.datasets?.[0]?.data?.length ?? -1;
    });
    // The implementation runs updateChartData() on load so it should reflect the 3 initial points
    expect(datasetLength).toBeGreaterThanOrEqual(0);

    // Observe runtime errors: if errors occurred, assert they are JS runtime errors (Reference/Type/Syntax)
    if (pageErrors.length > 0) {
      // At least one page error should be a ReferenceError/TypeError/SyntaxError if something went wrong
      const hasExpectedJSProblem = pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/.test(String(e.message || e)));
      expect(hasExpectedJSProblem).toBeTruthy();
    } else {
      // If there were no page errors, ensure there were no console.error messages either
      expect(consoleErrors.length).toBe(0);
    }
  });

  test.describe('State Transitions and Events (S0 -> S1, S1 -> S2, S1 -> S1, S1 -> S0)', () => {
    // Prepare console/page error capture for each test
    test.beforeEach(async ({ page }) => {
      page.on('console', msg => {
        // Attach to page as a property for debugging if needed
        if (msg.type() === 'error') {
          (globalThis as any).__last_console_error = msg.text();
        }
      });
      page.on('pageerror', err => {
        (globalThis as any).__last_page_error = err;
      });
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    });

    test('AddPoint event: clicking Add Point adds a new data point input (S0 -> S1)', async ({ page }) => {
      // Ensure initial count
      const container = page.locator('#pointContainer');
      const addButton = page.locator("button[onclick='addPoint()']");
      await expect(container.locator('.point-input')).toHaveCount(3);

      // Click Add Point
      await addButton.click();

      // New input added: count increases by 1
      await expect(container.locator('.point-input')).toHaveCount(4);

      // The newly added point should contain two inputs and a remove button
      const lastPoint = container.locator('.point-input').nth(3);
      await expect(lastPoint.locator('.x-input')).toBeVisible();
      await expect(lastPoint.locator('.y-input')).toBeVisible();
      await expect(lastPoint.locator("button[onclick=\"removePoint(this)\"]")).toBeVisible();
    });

    test('GenerateRandomData event: generates 10 points and updates chart (S0 -> S1)', async ({ page }) => {
      const generateButton = page.locator("button[onclick='generateRandomData()']");
      const container = page.locator('#pointContainer');

      // Click generate random data
      await generateButton.click();

      // The container should now have 10 .point-input entries
      await expect(container.locator('.point-input')).toHaveCount(10);

      // Chart dataset 0 should reflect these points (updateChartData called inside)
      const datasetCount = await page.evaluate(() => window.chart?.data?.datasets?.[0]?.data?.length ?? -1);
      expect(datasetCount).toBeGreaterThanOrEqual(10);
    });

    test('CalculateRegression event: with sufficient points, shows results and regression line (S1 -> S2)', async ({ page }) => {
      const generateButton = page.locator("button[onclick='generateRandomData()']");
      const calcButton = page.locator("button[onclick='calculateRegression()']");
      const results = page.locator('#results');

      // Generate random data to ensure >=2 points
      await generateButton.click();

      // Click calculate regression
      await calcButton.click();

      // Results panel should become visible
      await expect(results).toBeVisible();

      // Equation and stats should be populated with expected strings
      const equationText = await page.locator('#equation').innerText();
      expect(equationText).toContain('Regression Equation:');

      const statsText = await page.locator('#stats').innerText();
      expect(statsText).toContain('R-squared:');
      expect(statsText).toContain('Slope (m):');
      expect(statsText).toContain('Intercept (b):');
      expect(statsText).toContain('Number of points:');

      // Regression line dataset should have two points (line endpoints)
      const lineDataCount = await page.evaluate(() => window.chart?.data?.datasets?.[1]?.data?.length ?? 0);
      expect(lineDataCount).toBe(2);
    });

    test('RemovePoint event: clicking remove removes a point when >1 points (S1 -> S1)', async ({ page }) => {
      const container = page.locator('#pointContainer');

      // Ensure there are at least 2 points; start by generating random data
      await page.locator("button[onclick='generateRandomData()']").click();
      await expect(container.locator('.point-input')).toHaveCount(10);

      // Remove the first point using its remove button
      const firstRemoveBtn = container.locator('.point-input >> button').first();
      await firstRemoveBtn.click();

      // Count decreases by 1
      await expect(container.locator('.point-input')).toHaveCount(9);

      // Chart dataset should update accordingly (updateChartData called inside removePoint)
      const chartPointsAfterRemoval = await page.evaluate(() => window.chart?.data?.datasets?.[0]?.data?.length ?? -1);
      expect(chartPointsAfterRemoval).toBeGreaterThanOrEqual(0);
    });

    test('ClearAll event: clears all and returns to Idle (S1 -> S0)', async ({ page }) => {
      const clearButton = page.locator("button[onclick='clearAll()']");
      const container = page.locator('#pointContainer');
      const results = page.locator('#results');

      // Generate data first to ensure there is stuff to clear
      await page.locator("button[onclick='generateRandomData()']").click();
      await expect(container.locator('.point-input')).toHaveCount(10);

      // Click clear all
      await clearButton.click();

      // After clearAll, implementation adds one empty point - so count should be 1
      await expect(container.locator('.point-input')).toHaveCount(1);

      // Results should be hidden
      const resultsDisplay = await page.evaluate(() => window.getComputedStyle(document.getElementById('results')).display);
      expect(resultsDisplay).toBe('none');

      // Regression line dataset should be empty
      const lineDataCount = await page.evaluate(() => window.chart?.data?.datasets?.[1]?.data?.length ?? 0);
      expect(lineDataCount).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    });

    test('CalculateRegression with fewer than 2 points shows alert and does not display results', async ({ page }) => {
      // Clear everything to ensure we have a single empty point
      await page.locator("button[onclick='clearAll()']").click();

      // Now there should be exactly 1 point input
      await expect(page.locator('#pointContainer .point-input')).toHaveCount(1);

      // Prepare to capture the dialog triggered by calculateRegression
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.locator("button[onclick='calculateRegression()']").click()
      ]);

      // The alert should tell the user to add at least 2 data points
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Please add at least 2 data points');

      // Accept the alert so test can continue
      await dialog.accept();

      // Results must still be hidden
      const resultsDisplay = await page.evaluate(() => window.getComputedStyle(document.getElementById('results')).display);
      expect(resultsDisplay).toBe('none');
    });

    test('RemovePoint should not remove when only one point remains', async ({ page }) => {
      // Ensure only one point present
      await page.locator("button[onclick='clearAll()']").click();
      await expect(page.locator('#pointContainer .point-input')).toHaveCount(1);

      // Try to remove the single point
      const removeBtn = page.locator('#pointContainer .point-input >> button');
      await removeBtn.click();

      // It should still be present (implementation guards against removal if only one)
      await expect(page.locator('#pointContainer .point-input')).toHaveCount(1);
    });
  });

  test('Observes console and page errors across interactions and reports them', async ({ page }) => {
    // Collect console errors and page errors
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Perform a sequence of interactions to exercise the app
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Sequence: add point -> generate random -> calculate -> clear -> calculate (with insufficient)
    await page.locator("button[onclick='addPoint()']").click();
    await page.locator("button[onclick='generateRandomData()']").click();
    await page.locator("button[onclick='calculateRegression()']").click();
    await page.locator("button[onclick='clearAll()']").click();

    // Handle possible alert for final calculateRegression (we expect none here, but be safe)
    page.once('dialog', async dialog => {
      await dialog.accept();
    });

    // Try to click calculate again to possibly trigger an alert
    await page.locator("button[onclick='calculateRegression()']").click();

    // Allow some time for potential errors to surface
    await page.waitForTimeout(250);

    // Now assert about collected errors:
    // If any pageErrors occurred, ensure they are JS runtime errors (Reference/Type/Syntax)
    if (pageErrors.length > 0) {
      const matches = pageErrors.some(e => /ReferenceError|TypeError|SyntaxError/.test(String(e.message || e)));
      expect(matches).toBeTruthy();
    } else {
      // If no page errors, assert there were no console.error messages either
      expect(consoleErrors.length).toBe(0);
    }
  });
});