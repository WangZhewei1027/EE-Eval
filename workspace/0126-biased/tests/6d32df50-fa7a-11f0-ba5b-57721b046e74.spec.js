import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d32df50-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Interactive Logistic Regression - FSM and UI tests', () => {
  // Capture page-level errors and console messages for assertions
  let pageErrors = [];
  let consoleMessages = [];

  // Helper to attach listeners per page instance
  async function attachListeners(page) {
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push({
        message: err.message,
        name: err.name,
        stack: err.stack
      });
    });

    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  }

  // Helper to wait until the app's globals are initialized
  async function waitForAppReady(page) {
    // Wait for DOM canvas and the global scatterChart to be defined
    await page.waitForSelector('#scatterPlot');
    await page.waitForFunction(() => {
      // scatterChart is created in initChart() at the end of the inline script
      return !!(window.scatterChart && window.updateChart && window.updateMetrics);
    });
    // small pause to allow any initial async operations to complete
    await page.waitForTimeout(200);
  }

  // Helper to read weights from the page
  async function getWeights(page) {
    return page.evaluate(() => {
      return {
        weightsArray: weights ? [...weights] : null,
        w0Text: document.getElementById('w0').textContent,
        w1Text: document.getElementById('w1').textContent,
        w2Text: document.getElementById('w2').textContent
      };
    });
  }

  // Helper to read metrics
  async function getMetrics(page) {
    return page.evaluate(() => {
      return {
        accuracy: document.getElementById('accuracy').textContent,
        loss: document.getElementById('loss').textContent,
        precision: document.getElementById('precision').textContent,
        recall: document.getElementById('recall').textContent
      };
    });
  }

  // Helper to read application state variables
  async function getAppState(page) {
    return page.evaluate(() => {
      return {
        dataPointsLength: Array.isArray(window.dataPoints) ? window.dataPoints.length : null,
        currentClass: typeof window.currentClass === 'number' ? window.currentClass : null,
        showBoundary: !!window.showBoundary,
        boundaryLineExists: !!window.boundaryLine
      };
    });
  }

  // Setup: navigate to the app before each test and attach listeners
  test.beforeEach(async ({ page }) => {
    await attachListeners(page);
    await page.goto(APP_URL);
    await waitForAppReady(page);
  });

  // Teardown: on failure dump console messages for debugging
  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      // Provide console and page error info for debugging failed tests
      // Note: Do not modify page environment, just log
      // (Playwright will display these via test runners' output)
      console.log('--- Console messages captured ---');
      for (const msg of consoleMessages) {
        console.log(`[${msg.type}] ${msg.text}`);
      }
      console.log('--- Page errors captured ---');
      for (const err of pageErrors) {
        console.log(`[${err.name}] ${err.message}`);
      }
    }
  });

  test('S0_Idle: Initial Idle state shows expected UI and default values', async ({ page }) => {
    // Validate the page title and main heading exist
    await expect(page.locator('h1')).toHaveText('Interactive Logistic Regression');

    // Validate initial weights are zeros and displayed text matches zeros
    const weights = await getWeights(page);
    expect(weights.weightsArray).toEqual([0, 0, 0]);
    expect(weights.w0Text).toMatch(/0(\.0+)?/); // w0 shows zero
    expect(weights.w1Text).toMatch(/0(\.0+)?/);
    expect(weights.w2Text).toMatch(/0(\.0+)?/);

    // Initial metrics: no data -> accuracy 0%, loss -, precision -, recall -
    const metrics = await getMetrics(page);
    expect(metrics.accuracy).toBe('0%');
    expect(metrics.loss).toBe('-');
    expect(metrics.precision).toBe('-');
    expect(metrics.recall).toBe('-');

    // App state: dataPoints empty and boundary shown by default
    const state = await getAppState(page);
    expect(state.dataPointsLength).toBe(0);
    expect(state.showBoundary).toBe(true);

    // Ensure no uncaught page errors occurred during initialization
    expect(pageErrors.length).toBe(0);
  });

  test('S1_DataAdded: Clicking "Add Random Data" adds points, updates chart and metrics', async ({ page }) => {
    // Click Add Random Data
    await page.click('#addRandomData');

    // Wait for dataPoints to be updated
    await page.waitForFunction(() => Array.isArray(window.dataPoints) && window.dataPoints.length > 0);

    // Verify dataPoints length > 0 and chart datasets updated
    const state = await getAppState(page);
    expect(state.dataPointsLength).toBeGreaterThan(0);

    // Metrics should no longer be the initial placeholders
    const metrics = await getMetrics(page);
    expect(metrics.accuracy).not.toBe('0%');
    expect(metrics.loss).not.toBe('-');

    // Ensure no uncaught page errors occurred during this transition
    expect(pageErrors.length).toBe(0);
  });

  test('S2_DataCleared: Clearing data empties dataset and resets metrics', async ({ page }) => {
    // First add data, then clear
    await page.click('#addRandomData');
    await page.waitForFunction(() => window.dataPoints.length > 0);

    // Clear data
    await page.click('#clearData');

    // Wait for dataPoints to be zero
    await page.waitForFunction(() => Array.isArray(window.dataPoints) && window.dataPoints.length === 0);

    const state = await getAppState(page);
    expect(state.dataPointsLength).toBe(0);

    // Metrics should be back to initial values
    const metrics = await getMetrics(page);
    expect(metrics.accuracy).toBe('0%');
    expect(metrics.loss).toBe('-');
    expect(metrics.precision).toBe('-');
    expect(metrics.recall).toBe('-');

    // Ensure no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('S3_ClassToggled: Toggle class changes currentClass and button state/text', async ({ page }) => {
    // Initial currentClass should be 0
    let initClass = await page.evaluate(() => window.currentClass);
    expect(initClass).toBe(0);

    const toggleBtn = page.locator('#toggleClass');

    // Click to toggle class
    await toggleBtn.click();

    // currentClass should be toggled to 1 and button should have active class and updated text
    const toggledClass = await page.evaluate(() => window.currentClass);
    expect(toggledClass).toBe(1);

    const hasActive = await page.evaluate(() => document.getElementById('toggleClass').classList.contains('active'));
    expect(hasActive).toBe(true);

    const btnText = await toggleBtn.textContent();
    expect(btnText).toContain('Add to Class 1');

    // Click again to toggle back
    await toggleBtn.click();
    const toggledBack = await page.evaluate(() => window.currentClass);
    expect(toggledBack).toBe(0);
    const hasActiveBack = await page.evaluate(() => document.getElementById('toggleClass').classList.contains('active'));
    // toggling off removes 'active' class
    expect(hasActiveBack).toBe(false);

    expect(pageErrors.length).toBe(0);
  });

  test('S4_WeightsUpdated: Training updates weights (one step) and updates UI and boundary', async ({ page }) => {
    // Ensure fresh data exists
    await page.click('#addRandomData');
    await page.waitForFunction(() => window.dataPoints.length > 0);

    // Record weights before training
    const before = await getWeights(page);
    expect(before.weightsArray).toBeDefined();

    // Click Train One Step
    await page.click('#trainOneStep');

    // Wait until weights are updated (not strictly guaranteed to change by a tiny amount, so assert not equal to exact original)
    await page.waitForFunction((w0) => {
      return window.weights && Math.abs(window.weights[0] - w0) > 1e-9;
    }, before.weightsArray[0]);

    const after = await getWeights(page);
    // At least one weight should have changed from zero (or changed in general)
    const changed = after.weightsArray.some((v, idx) => Math.abs(v - before.weightsArray[idx]) > 1e-12);
    expect(changed).toBe(true);

    // Boundary line is drawn when weights are non-zero and showBoundary is true
    const boundaryStatus = await page.evaluate(() => {
      return { showBoundary, boundaryLineExists: !!boundaryLine };
    });
    // If showBoundary true and weights non-zero, boundaryLine may be set (drawing uses updateChart)
    expect(boundaryStatus.showBoundary).toBe(true);
    // boundaryLineExists may be true or false depending on exact weight values; assert no errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('S4_WeightsUpdated: Training multiple steps updates weights further', async ({ page }) => {
    // Reset weights first to have a known baseline
    await page.click('#resetWeights');
    const base = await getWeights(page);
    expect(base.weightsArray).toEqual([0, 0, 0]);

    // Add data
    await page.click('#addRandomData');
    await page.waitForFunction(() => window.dataPoints.length > 0);

    // Click Train 100 Steps
    await page.click('#trainMultiple');

    // After training, weights should no longer be all zeros
    await page.waitForFunction(() => {
      return window.weights && (Math.abs(window.weights[0]) > 1e-9 || Math.abs(window.weights[1]) > 1e-9 || Math.abs(window.weights[2]) > 1e-9);
    });

    const after = await getWeights(page);
    const nonZero = after.weightsArray.some(v => Math.abs(v) > 1e-9);
    expect(nonZero).toBe(true);

    expect(pageErrors.length).toBe(0);
  });

  test('ResetWeights: Resetting weights sets them back to zero and updates display', async ({ page }) => {
    // Add data and train a bit to change weights
    await page.click('#addRandomData');
    await page.waitForFunction(() => window.dataPoints.length > 0);
    await page.click('#trainOneStep');
    await page.waitForTimeout(50);

    // Now reset weights
    await page.click('#resetWeights');

    // Wait for UI update
    await page.waitForFunction(() => {
      return document.getElementById('w0').textContent.trim().startsWith('0');
    });

    const weightsAfterReset = await getWeights(page);
    // The internal weights array should be exactly zeros
    expect(weightsAfterReset.weightsArray.map(v => Math.abs(v))).toEqual(weightsAfterReset.weightsArray.map(() => 0));

    // Display should reflect zeros
    expect(weightsAfterReset.w0Text).toMatch(/^0(\.0+)?$/);
    expect(weightsAfterReset.w1Text).toMatch(/^0(\.0+)?$/);
    expect(weightsAfterReset.w2Text).toMatch(/^0(\.0+)?$/);

    expect(pageErrors.length).toBe(0);
  });

  test('S5_BoundaryToggled: Toggling boundary visibility updates showBoundary and chart redraw', async ({ page }) => {
    // Ensure initial showBoundary is true
    let initial = await page.evaluate(() => window.showBoundary);
    expect(initial).toBe(true);

    // Toggle boundary off
    await page.click('#toggleBoundary');
    await page.waitForFunction(() => window.showBoundary === false);
    let afterOff = await page.evaluate(() => ({ showBoundary, boundaryLineExists: !!boundaryLine }));
    expect(afterOff.showBoundary).toBe(false);
    // When hidden, boundaryLine should be removed (boundaryLine null)
    expect(afterOff.boundaryLineExists).toBe(false);

    // Toggle boundary on
    await page.click('#toggleBoundary');
    await page.waitForFunction(() => window.showBoundary === true);
    let afterOn = await page.evaluate(() => ({ showBoundary, boundaryLineExists: !!boundaryLine }));
    expect(afterOn.showBoundary).toBe(true);
    // boundaryLine may or may not exist depending on weights; ensure no errors
    expect(pageErrors.length).toBe(0);
  });

  test('ThresholdChanged: Changing threshold updates displayed value and metrics recompute', async ({ page }) => {
    // Add some data to ensure metrics meaningful
    await page.click('#addRandomData');
    await page.waitForFunction(() => window.dataPoints.length > 0);

    // Get current displayed threshold value
    const thresholdValueBefore = await page.locator('#thresholdValue').textContent();
    expect(thresholdValueBefore).toBeDefined();

    // Change the threshold via evaluate to ensure input event fires correctly
    await page.evaluate(() => {
      const input = document.getElementById('threshold');
      input.value = '0.7';
      const evt = new Event('input', { bubbles: true });
      input.dispatchEvent(evt);
    });

    // The thresholdValue span should update to '0.7'
    await expect(page.locator('#thresholdValue')).toHaveText('0.7');

    // Metrics should update (no exceptions)
    const metricsAfter = await getMetrics(page);
    expect(metricsAfter.accuracy).toBeDefined();
    expect(pageErrors.length).toBe(0);
  });

  test('Edge Case: Training with no data should be a no-op and cause no errors', async ({ page }) => {
    // Ensure data cleared
    await page.click('#clearData');
    await page.waitForFunction(() => window.dataPoints.length === 0);

    // Record weights before trainOneStep
    const before = await getWeights(page);
    // Click trainOneStep (should early-return without throwing)
    await page.click('#trainOneStep');

    // Small wait to allow any unexpected errors to surface
    await page.waitForTimeout(100);

    const after = await getWeights(page);
    // Weights should be unchanged (still zeros)
    expect(after.weightsArray).toEqual(before.weightsArray);

    // Ensure no uncaught exceptions occurred
    const foundCriticalErrors = pageErrors.filter(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name));
    // We expect none of these critical errors to have occurred
    expect(foundCriticalErrors.length).toBe(0);
  });

  test('Sanity: There should be no uncaught page errors during normal interactions', async ({ page }) => {
    // Perform a sequence of interactions
    await page.click('#addRandomData');
    await page.waitForFunction(() => window.dataPoints.length > 0);
    await page.click('#trainOneStep');
    await page.waitForTimeout(50);
    await page.click('#toggleClass');
    await page.click('#toggleClass');
    await page.evaluate(() => {
      document.getElementById('threshold').value = '0.3';
      document.getElementById('threshold').dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(50);

    // Now assert that there were no page-level uncaught errors (ReferenceError, TypeError, SyntaxError)
    const critical = pageErrors.filter(err => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(err.name));
    // If any such critical errors exist, fail the test
    expect(critical.length).toBe(0);
  });
});