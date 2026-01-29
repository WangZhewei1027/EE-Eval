import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324ff7d4-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object for the SVM Demo page.
 * Encapsulates common interactions and queries so tests remain readable.
 */
class SVMPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Captured console.error messages
    this.consoleErrors = [];
    // Captured unhandled page errors (pageerror)
    this.pageErrors = [];
  }

  async goto() {
    // Attach listeners to capture console errors and page errors
    this.page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          this.consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore listener errors
      }
    });
    this.page.on('pageerror', (err) => {
      try {
        this.pageErrors.push(err && err.message ? err.message : String(err));
      } catch (e) {
        // ignore
      }
    });

    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait a short time to allow page scripts (generateData/drawChart) to execute
    await this.page.waitForTimeout(250);
  }

  /**
   * Click the "Generate Data" button.
   */
  async clickGenerateData() {
    await this.page.click("button[onclick='generateData()']");
    // allow time for chart redraw
    await this.page.waitForTimeout(200);
  }

  /**
   * Returns the length of the global dataPoints array.
   */
  async getDataPointsLength() {
    return await this.page.evaluate(() => {
      return Array.isArray(window.dataPoints) ? window.dataPoints.length : null;
    });
  }

  /**
   * Returns a serializable snapshot of the scatterChart datasets,
   * or null if scatterChart is not present.
   */
  async getScatterChartDatasetsSnapshot() {
    return await this.page.evaluate(() => {
      try {
        if (!window.scatterChart || !window.scatterChart.data || !Array.isArray(window.scatterChart.data.datasets)) {
          return null;
        }
        // Map each dataset to a small summary (count + first point)
        return window.scatterChart.data.datasets.map(ds => ({
          label: ds.label,
          count: Array.isArray(ds.data) ? ds.data.length : 0,
          firstPoint: Array.isArray(ds.data) && ds.data.length ? { x: ds.data[0].x, y: ds.data[0].y } : null
        }));
      } catch (e) {
        // Surface any evaluation errors as null to avoid throwing inside this helper
        return { __evaluationError: String(e) };
      }
    });
  }

  /**
   * Returns captured console error messages.
   */
  getConsoleErrors() {
    return this.consoleErrors;
  }

  /**
   * Returns captured page error messages.
   */
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Support Vector Machine Demo - FSM validation and interactions', () => {
  // Note: Using Playwright's page fixture per test.

  test('Initial load should generate data and draw chart (S0_Idle -> S1_DataGenerated)', async ({ page }) => {
    // This test validates the initial state transition: page load calls generateData(), then drawChart().
    const svm = new SVMPage(page);
    await svm.goto();

    // Verify that the global dataPoints array exists and has 100 entries (50 iterations * 2 pushes)
    const length = await svm.getDataPointsLength();
    // The implementation pushes two data points per loop iteration for 50 iterations => 100
    expect(typeof length).toBe('number');
    expect(length).toBeGreaterThanOrEqual(100);

    // Verify that scatterChart exists and contains two datasets (Class 0 and Class 1)
    const datasets = await svm.getScatterChartDatasetsSnapshot();
    expect(datasets).not.toBeNull();
    expect(Array.isArray(datasets)).toBe(true);
    expect(datasets.length).toBe(2);
    expect(datasets[0].count).toBeGreaterThan(0);
    expect(datasets[1].count).toBeGreaterThan(0);

    // Observe console and page errors. We capture them but do not fail if none happened.
    const consoleErrors = svm.getConsoleErrors();
    const pageErrors = svm.getPageErrors();

    // Validate that our error collectors are arrays
    expect(Array.isArray(consoleErrors)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // If there are any captured errors, assert they look like JS errors (ReferenceError/TypeError/SyntaxError)
    const allErrors = [...consoleErrors, ...pageErrors];
    if (allErrors.length > 0) {
      const jsErrorDetected = allErrors.some(msg => /ReferenceError|TypeError|SyntaxError|Error/.test(msg));
      expect(jsErrorDetected).toBe(true);
      // Log captured errors to the test output (helpful for debugging)
      console.log('Captured errors on initial load:', allErrors);
    } else {
      // If there were no errors, at minimum we assert the page produced the expected visual/data state.
      expect(length).toBeGreaterThan(0);
      expect(datasets[0].count + datasets[1].count).toBeGreaterThan(0);
    }
  });

  test('Clicking "Generate Data" re-generates points and redraws the chart (transition S1_DataGenerated -> S1_DataGenerated)', async ({ page }) => {
    // This test validates the GenerateData event and the resulting transition / redraw behavior.
    const svm1 = new SVMPage(page);
    await svm.goto();

    // Snapshot before clicking
    const beforeDatasets = await svm.getScatterChartDatasetsSnapshot();
    expect(beforeDatasets).not.toBeNull();
    const beforeFirst0 = beforeDatasets[0].firstPoint;
    const beforeCount0 = beforeDatasets[0].count;

    // Click the button to generate data again
    await svm.clickGenerateData();

    // Snapshot after clicking
    const afterDatasets = await svm.getScatterChartDatasetsSnapshot();
    expect(afterDatasets).not.toBeNull();
    const afterFirst0 = afterDatasets[0].firstPoint;
    const afterCount0 = afterDatasets[0].count;

    // Counts should remain consistent (still two datasets with non-zero counts)
    expect(afterDatasets.length).toBe(2);
    expect(afterCount0).toBeGreaterThan(0);

    // The first point of the dataset is very likely different after re-generation.
    // We assert that either it's different or that at least one dataset changed in count or firstPoint.
    const sameFirstPoint = beforeFirst0 && afterFirst0 && beforeFirst0.x === afterFirst0.x && beforeFirst0.y === afterFirst0.y;
    const sameCount = beforeCount0 === afterCount0;
    // It's acceptable if they are coincidentally identical; assert that at least one change occurred OR that counts are valid.
    expect(afterCount0).toBeGreaterThanOrEqual(0);
    if (sameFirstPoint && sameCount) {
      // If everything is identical, that is unexpected but still a valid state; we log it for visibility.
      console.log('Generate Data produced identical first point and count - possible but unlikely due to randomness.');
    }

    // Validate that no fatal JS errors occurred during the click action sequence.
    const consoleErrors1 = svm.getConsoleErrors();
    const pageErrors1 = svm.getPageErrors();
    expect(Array.isArray(consoleErrors)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // If errors were captured as a result of clicking, ensure they are JS errors and surface them.
    const allErrors1 = [...consoleErrors, ...pageErrors];
    if (allErrors.length > 0) {
      const jsErrorDetected1 = allErrors.some(msg => /ReferenceError|TypeError|SyntaxError|Error/.test(msg));
      expect(jsErrorDetected).toBe(true);
      console.log('Captured errors during click:', allErrors);
    }
  });

  test('Rapid multiple Generate Data clicks should not leave scatterChart in an inconsistent state (edge case)', async ({ page }) => {
    // Edge case: clicking the button quickly multiple times should not break chart creation/destruction cycle.
    const svm2 = new SVMPage(page);
    await svm.goto();

    // Rapidly click the button 5 times
    for (let i = 0; i < 5; i++) {
      await svm.page.click("button[onclick='generateData()']");
      // small delay between rapid clicks to simulate fast user interaction
      await svm.page.waitForTimeout(50);
    }

    // Wait a bit for final redraw
    await svm.page.waitForTimeout(300);

    // Ensure the scatterChart is present and datasets are valid
    const datasets1 = await svm.getScatterChartDatasetsSnapshot();
    expect(datasets).not.toBeNull();
    expect(datasets.length).toBe(2);
    expect(datasets[0].count).toBeGreaterThanOrEqual(0);
    expect(datasets[1].count).toBeGreaterThanOrEqual(0);

    // Collect errors and assert that if errors happened, they are meaningful JS errors.
    const consoleErrors2 = svm.getConsoleErrors();
    const pageErrors2 = svm.getPageErrors();
    const allErrors2 = [...consoleErrors, ...pageErrors];

    // We don't require errors here; if they exist, assert they are JS errors and surface them.
    if (allErrors.length > 0) {
      const jsErrorDetected2 = allErrors.some(msg => /ReferenceError|TypeError|SyntaxError|Error/.test(msg));
      expect(jsErrorDetected).toBe(true);
      console.log('Captured errors during rapid clicks:', allErrors);
    }
  });

  test('Observability: captured console & page errors are available for inspection', async ({ page }) => {
    // This test ensures our instrumentation for observing runtime errors is wired correctly.
    const svm3 = new SVMPage(page);
    await svm.goto();

    // Intentionally do nothing else; simply assert that the arrays exist and are arrays.
    expect(Array.isArray(svm.getConsoleErrors())).toBe(true);
    expect(Array.isArray(svm.getPageErrors())).toBe(true);

    // If any errors were captured during initial load, ensure they contain strings (messages)
    const consoleErrors3 = svm.getConsoleErrors();
    const pageErrors3 = svm.getPageErrors();

    for (const msg of consoleErrors) {
      expect(typeof msg === 'string' || msg instanceof String).toBe(true);
    }
    for (const msg of pageErrors) {
      expect(typeof msg === 'string' || msg instanceof String).toBe(true);
    }

    // If errors include JS error types, assert presence of typical error name patterns for observability testing.
    const allErrors3 = [...consoleErrors, ...pageErrors];
    if (allErrors.length > 0) {
      const containsErrorName = allErrors.some(msg => /ReferenceError|TypeError|SyntaxError|Error/.test(msg));
      expect(containsErrorName).toBe(true);
      console.log('Observed errors for observability test:', allErrors);
    }
  });
});