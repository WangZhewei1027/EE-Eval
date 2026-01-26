import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121733f0-fa7a-11f0-acf9-69409043402d.html';

// Helper: wait until #log contains text substring
async function waitForLogContains(page, substr, timeout = 3000) {
  await page.waitForFunction(
    (s) => {
      const log = document.getElementById('log');
      return log && log.textContent && log.textContent.indexOf(s) !== -1;
    },
    substr,
    { timeout }
  );
}

test.describe('Linear Regression Explorer - FSM states and transitions', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console error messages and page errors for assertions
    consoleErrors = [];
    pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to application
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure application loaded message present
    await waitForLogContains(page, 'Application loaded. Enter or generate data to begin.');
  });

  test.afterEach(async ({ page }) => {
    // Assert that there were no uncaught page errors or console errors during the test
    // These are unexpected runtime exceptions such as ReferenceError / TypeError.
    // Failing tests if any such errors occurred helps catch regressions.
    expect(pageErrors, 'Unexpected page errors (uncaught exceptions)').toEqual([]);
    expect(consoleErrors, 'Unexpected console.error messages').toEqual([]);
  });

  test('Idle state - initial render shows primary controls and disables metrics', async ({ page }) => {
    // Validate presence of main buttons in Idle state and initial UI setup
    const loadBtn = page.locator('#loadDataBtn');
    const clearBtn = page.locator('#clearDataBtn');
    const genBtn = page.locator('#genDataBtn');
    const computeBtn = page.locator('#computeRegressionBtn');
    const calcMetricsBtn = page.locator('#calcMetricsBtn');

    await expect(loadBtn).toBeVisible();
    await expect(clearBtn).toBeVisible();
    await expect(genBtn).toBeVisible();
    await expect(computeBtn).toBeVisible();

    // Metrics should be disabled initially (no data/regression)
    await expect(calcMetricsBtn).toBeDisabled();

    // log should indicate application loaded
    const log = page.locator('#log');
    await expect(log).toContainText('Application loaded. Enter or generate data to begin.');
  });

  test('Load Data -> DataLoaded state: fills table, redraws and logs', async ({ page }) => {
    // Provide valid multi-line datapoints
    const dataTextarea = page.locator('#datapoints');
    await dataTextarea.fill('1,2\n2,3.5\n3,4.2\n4,7');

    // Click Load Data and expect DataLoaded behavior
    await Promise.all([
      page.waitForResponse((resp) => true, { timeout: 100 }), // no network call but allow event loop
      page.locator('#loadDataBtn').click()
    ]);

    // Show table and verify rows match 4 points
    await page.locator('#showDataTableBtn').click();
    const rows = page.locator('#dataTable tbody tr');
    await expect(rows).toHaveCount(4);

    // Regression result should be empty after load
    await expect(page.locator('#regressionResult')).toHaveText('');

    // Log must mention loaded points as per FSM evidence
    await waitForLogContains(page, 'Loaded 4 data points from input.');

    // Metrics button should remain disabled after load (updateComputeMetricsState(false))
    await expect(page.locator('#calcMetricsBtn')).toBeDisabled();
  });

  test('Clear Data transition returns to Idle: clears table, resets UI', async ({ page }) => {
    // Preload some data then clear
    await page.locator('#datapoints').fill('1,2\n2,3');
    await page.locator('#loadDataBtn').click();

    // Show table to validate clearing
    await page.locator('#showDataTableBtn').click();
    await expect(page.locator('#dataTable tbody tr')).toHaveCount(2);

    // Click Clear Data
    await page.locator('#clearDataBtn').click();

    // Table should be emptied
    await expect(page.locator('#dataTable tbody tr')).toHaveCount(0);

    // Textarea cleared
    await expect(page.locator('#datapoints')).toHaveValue('');

    // Regression result and metrics outputs cleared
    await expect(page.locator('#regressionResult')).toHaveText('');
    await expect(page.locator('#metricsOutput')).toHaveText('');
  });

  test('Generate Data transition: generates new points and updates UI', async ({ page }) => {
    // Set parameters and generate
    await page.locator('#autoGenCount').fill('6');
    await page.locator('#autoGenSlope').fill('1.5');
    await page.locator('#autoGenIntercept').fill('0.5');
    await page.locator('#autoGenNoise').fill('0'); // deterministic

    await page.locator('#genDataBtn').click();

    // Show table and ensure 6 rows generated
    await page.locator('#showDataTableBtn').click();
    await expect(page.locator('#dataTable tbody tr')).toHaveCount(6);

    // Log mentions generated message
    await waitForLogContains(page, 'Generated 6 data points with slope=1.5, intercept=0.5, noise SD=0');
  });

  test('Show/Hide Data Table toggle works', async ({ page }) => {
    // Generate data so table has content
    await page.locator('#genDataBtn').click();

    const container = page.locator('#dataTableContainer');

    // Initially hidden (but genData sets, we haven't toggled yet). Click show to reveal
    await page.locator('#showDataTableBtn').click();
    await expect(container).toBeVisible();

    // Click again to hide
    await page.locator('#showDataTableBtn').click();
    // The container uses style display:block/none; check hidden via JS property
    const display = await page.locator('#dataTableContainer').evaluate((el) => getComputedStyle(el).display);
    expect(display === 'none' || display === '').toBeTruthy();
  });

  test('Sort by X and Sort by Y and restore Original Order', async ({ page }) => {
    // Generate deterministic data
    await page.locator('#autoGenCount').fill('5');
    await page.locator('#autoGenSlope').fill('2');
    await page.locator('#autoGenIntercept').fill('1');
    await page.locator('#autoGenNoise').fill('0');
    await page.locator('#genDataBtn').click();
    await page.locator('#showDataTableBtn').click();

    // Capture X values before sort (original order)
    const getXs = async () => {
      return await page.$$eval('#dataTable tbody tr td:nth-child(2)', tds => tds.map(td => parseFloat(td.textContent)));
    };
    const originalXs = await getXs();

    // Sort by Y (here Y increases with X but test the button)
    await page.locator('#sortYBtn').click();
    const ysAfterSortY = await page.$$eval('#dataTable tbody tr td:nth-child(3)', tds => tds.map(td => parseFloat(td.textContent)));
    // Ensure ascending by checking monotonicity
    for (let i = 1; i < ysAfterSortY.length; i++) {
      expect(ysAfterSortY[i]).toBeGreaterThanOrEqual(ysAfterSortY[i - 1]);
    }

    // Sort by X
    await page.locator('#sortXBtn').click();
    const xsAfterSortX = await getXs();
    for (let i = 1; i < xsAfterSortX.length; i++) {
      expect(xsAfterSortX[i]).toBeGreaterThanOrEqual(xsAfterSortX[i - 1]);
    }

    // Restore original order
    await page.locator('#clearSortBtn').click();
    const xsRestored = await getXs();
    // Should match original order values
    expect(xsRestored.map(v => Number(v.toFixed(4)))).toEqual(originalXs.map(v => Number(v.toFixed(4))));
  });

  test('Compute Analytical Regression -> RegressionComputed state and metrics enabled', async ({ page }) => {
    // Generate a small deterministic dataset
    await page.locator('#autoGenCount').fill('4');
    await page.locator('#autoGenSlope').fill('3');
    await page.locator('#autoGenIntercept').fill('2');
    await page.locator('#autoGenNoise').fill('0');
    await page.locator('#genDataBtn').click();

    // Ensure analytic is selected by default
    await expect(page.locator('input[name=method][value="analytic"]')).toBeChecked();

    // Click Compute Regression (analytic)
    await page.locator('#computeRegressionBtn').click();

    // Regression result should contain slope and MSE
    await expect(page.locator('#regressionResult')).toContainText('Slope (m):');
    await expect(page.locator('#regressionResult')).toContainText('Mean Squared Error (MSE):');

    // Metrics button should be enabled after regression computed
    await expect(page.locator('#calcMetricsBtn')).toBeEnabled();
  });

  test('Apply Manual Fit -> ManualFitApplied state and UI update', async ({ page }) => {
    // Generate data and compute analytic regression to populate manual inputs when applied
    await page.locator('#autoGenCount').fill('3');
    await page.locator('#autoGenSlope').fill('1');
    await page.locator('#autoGenIntercept').fill('0');
    await page.locator('#autoGenNoise').fill('0');
    await page.locator('#genDataBtn').click();

    // Enter manual slope and intercept values
    await page.locator('#manualM').fill('5.5');
    await page.locator('#manualB').fill('-1.25');

    // Click Apply Manual Fit
    await page.locator('#applyManualFitBtn').click();

    // The manual inputs should persist and metrics button should be enabled
    await expect(page.locator('#manualM')).toHaveValue('5.5');
    await expect(page.locator('#manualB')).toHaveValue('-1.25');
    await expect(page.locator('#calcMetricsBtn')).toBeEnabled();
  });

  test('Run Single Gradient Step (RunGDStep) when gradient method selected', async ({ page }) => {
    // Prepare data
    await page.locator('#autoGenCount').fill('5');
    await page.locator('#autoGenSlope').fill('0.5');
    await page.locator('#autoGenIntercept').fill('1');
    await page.locator('#autoGenNoise').fill('0');
    await page.locator('#genDataBtn').click();

    // Switch method to gradient to reveal GD controls
    await page.locator('input[name=method][value="gradient"]').check();
    // Ensure gradient options visible
    await expect(page.locator('#gradientOptions')).toBeVisible();

    // Ensure GD init params set to valid numbers
    await page.locator('#gdAlpha').fill('0.01');
    await page.locator('#gdIter').fill('10');
    await page.locator('#gdInitM').fill('0');
    await page.locator('#gdInitB').fill('0');

    // Click run single step
    await page.locator('#runGDStepBtn').click();

    // Regression result should indicate gradient result presence
    await expect(page.locator('#regressionResult')).toContainText('Gradient Descent Result');
    // Metrics button should be enabled
    await expect(page.locator('#calcMetricsBtn')).toBeEnabled();
  });

  test('Run Full Gradient Descent -> Running and Stop -> Stopped transitions', async ({ page }) => {
    // Generate data
    await page.locator('#autoGenCount').fill('6');
    await page.locator('#autoGenSlope').fill('1');
    await page.locator('#autoGenIntercept').fill('0');
    await page.locator('#autoGenNoise').fill('0');
    await page.locator('#genDataBtn').click();

    // Select gradient method and set short iterations to limit test duration
    await page.locator('input[name=method][value="gradient"]').check();
    await page.locator('#gdAlpha').fill('0.05');
    await page.locator('#gdIter').fill('20'); // limit but still small
    await page.locator('#gdInitM').fill('0');
    await page.locator('#gdInitB').fill('0');

    // Start full GD
    await page.locator('#runGDFullBtn').click();

    // After starting, stop button should be enabled, run full disabled
    await expect(page.locator('#stopGDBtn')).toBeEnabled();
    await expect(page.locator('#runGDFullBtn')).toBeDisabled();

    // Wait for a short while to let iterations run (but not necessarily finish)
    await page.waitForTimeout(200);

    // Now click Stop to transition to stopped state
    await page.locator('#stopGDBtn').click();

    // After stopping, stop button should be disabled and run full re-enabled
    await expect(page.locator('#stopGDBtn')).toBeDisabled();
    await expect(page.locator('#runGDFullBtn')).toBeEnabled();

    // Log should have "Gradient Descent stopped" message as evidence
    await waitForLogContains(page, 'Gradient Descent stopped');
  });

  test('Export/Import via textarea and JSON import path', async ({ page }) => {
    // Create a simple dataset and compute analytic regression
    await page.locator('#datapoints').fill('1,2\n2,3\n3,4');
    await page.locator('#loadDataBtn').click();
    await page.locator('#computeRegressionBtn').click();

    // Prepare an import JSON string (with regression)
    const importJSON = JSON.stringify({
      data: [[10, 11], [20, 25], [30, 31]],
      regression: { m: 0.8, b: 2.2 }
    });

    // Paste into the import textarea and click import from textarea
    await page.locator('#importJSONArea').fill(importJSON);
    await page.locator('#importFromTextareaBtn').click();

    // Table should update to 3 rows and manual/regression inputs should reflect imported regression
    await expect(page.locator('#dataTable tbody tr')).toHaveCount(3);
    // Regression display isn't automatically shown for imported regression, but manual inputs updated via updateManualInputs
    // updateManualInputs sets manual inputs based on manualFit OR regressionParams
    await expect(page.locator('#manualM')).toHaveValue('0.8000');
    await expect(page.locator('#manualB')).toHaveValue('2.2000');

    // Log should indicate import occurred
    await waitForLogContains(page, 'Imported data and regression from JSON.');
  });

  test('Metrics computation produces R2, RMSE and MAE outputs', async ({ page }) => {
    // Generate data and compute analytic regression
    await page.locator('#autoGenCount').fill('4');
    await page.locator('#autoGenSlope').fill('2');
    await page.locator('#autoGenIntercept').fill('1');
    await page.locator('#autoGenNoise').fill('0');
    await page.locator('#genDataBtn').click();

    // Compute analytic regression
    await page.locator('#computeRegressionBtn').click();

    // Click Calculate Metrics and expect metricsOutput to contain R² etc.
    await page.locator('#calcMetricsBtn').click();
    const metrics = page.locator('#metricsOutput');
    await expect(metrics).toContainText('R²');
    await expect(metrics).toContainText('RMSE');
    await expect(metrics).toContainText('MAE');
  });

  test('Edge cases: insufficient points on load triggers alert and invalid lines are ignored', async ({ page }) => {
    // Provide only one valid point and expect alert on Load
    await page.locator('#datapoints').fill('1,2\n'); // only 1 point

    const dialog = page.waitForEvent('dialog');
    await page.locator('#loadDataBtn').click();
    const dialogObj = await dialog;
    expect(dialogObj.message()).toContain('Need at least 2 valid data points.');
    await dialogObj.accept();

    // Provide a dataset with an invalid line and ensure parsing logs ignoring message
    await page.locator('#datapoints').fill('1,2\nbadline\n3,4');
    await page.locator('#loadDataBtn').click();

    // Should show a log entry saying ignoring invalid line
    await waitForLogContains(page, 'Ignoring invalid line 2: badline');
  });

  test('Import invalid JSON shows alert', async ({ page }) => {
    // Provide invalid JSON and expect alert dialog
    await page.locator('#importJSONArea').fill('{"data": [ [1,2], [3] ]'); // malformed JSON
    const dialog = page.waitForEvent('dialog');
    await page.locator('#importFromTextareaBtn').click();
    const dlg = await dialog;
    expect(dlg.message().toLowerCase()).toContain('invalid json');
    await dlg.accept();
  });

  test('RunGDStep with invalid alpha shows an alert', async ({ page }) => {
    // Generate valid data
    await page.locator('#autoGenCount').fill('3');
    await page.locator('#autoGenSlope').fill('1');
    await page.locator('#autoGenIntercept').fill('0');
    await page.locator('#autoGenNoise').fill('0');
    await page.locator('#genDataBtn').click();

    // Select gradient method
    await page.locator('input[name=method][value="gradient"]').check();

    // Set invalid alpha (zero)
    await page.locator('#gdAlpha').fill('0');

    // Expect an alert when running a GD step
    const dialog = page.waitForEvent('dialog');
    await page.locator('#runGDStepBtn').click();
    const dlg = await dialog;
    expect(dlg.message()).toContain('Learning rate α must be positive.');
    await dlg.accept();
  });
});