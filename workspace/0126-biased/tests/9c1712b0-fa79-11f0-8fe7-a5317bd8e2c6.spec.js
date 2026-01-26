import { test, expect } from '@playwright/test';

// Test file for Application ID: 9c1712b0-fa79-11f0-8fe7-a5317bd8e2c6
// This suite validates the FSM states, transitions, UI behaviors, DOM updates,
// and observes console/page errors and dialogs as the app runs.
// It intentionally does NOT modify the app implementation; it interacts with it as-is.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c1712b0-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object for interacting with the demo
class OverfitPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async getInnerText(selector) {
    return await this.page.$eval(selector, el => el.innerText);
  }

  async getInnerHTML(selector) {
    return await this.page.$eval(selector, el => el.innerHTML);
  }

  async getValue(selector) {
    return await this.page.$eval(selector, el => el.value);
  }

  async setValue(selector, value) {
    await this.page.fill(selector, String(value));
  }

  async getAppState() {
    return await this.page.evaluate(() => {
      // Return a shallow copy of appState for assertions
      return {
        points: (window.appState && window.appState.points) ? window.appState.points.slice() : null,
        seed: window.appState ? window.appState.seed : null,
        numPoints: window.appState ? window.appState.numPoints : null,
        noise: window.appState ? window.appState.noise : null,
        trainPct: window.appState ? window.appState.trainPct : null,
        model: window.appState ? window.appState.model : null,
        lambda: window.appState ? window.appState.lambda : null,
        degree: window.appState ? window.appState.degree : null
      };
    });
  }

  async getStateBoxValue() {
    return await this.getValue('#stateBox');
  }

  async dialogOnceExpectMessage(action, expectedSubstr) {
    // helper: run action that triggers dialog, capture message and accept
    return new Promise(async (resolve) => {
      const handler = dialog => {
        try {
          // Accept and capture
          dialog.accept();
          resolve(dialog.message());
        } finally {
          this.page.off('dialog', handler);
        }
      };
      this.page.on('dialog', handler);
      await action();
      // If dialog never appears within a short timeout, resolve null
      setTimeout(() => {
        this.page.off('dialog', handler);
        resolve(null);
      }, 2000);
    });
  }
}

test.describe('Overfitting Interactive Demo - FSM and UI tests', () => {
  // arrays to capture console errors and page errors per test
  let consoleErrors;
  let pageErrors;
  let app;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    page.on('console', msg => {
      // capture console.error and other error-like messages
      if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), location: msg.location() });
    });
    page.on('pageerror', err => {
      // capture unhandled exceptions
      pageErrors.push(err);
    });

    app = new OverfitPage(page);
    await app.goto();
    // ensure page loaded and initial script executed
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async () => {
    // Basic sanity: no runtime page errors occurred during a test.
    // If any errors exist, include them in assertion messages for debugging.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.length > 0 ? pageErrors.map(e => e.message).join('; ') : 'none'}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error logs: ${consoleErrors.length > 0 ? consoleErrors.map(e => e.text).join('; ') : 'none'}`).toBe(0);
  });

  test.describe('Initialization and basic UI state', () => {
    test('Page loads and initial generated data exists (S1_DataGenerated)', async () => {
      // Validate page title and that initial generateData() resulted in points in appState
      const title = await app.page.title();
      expect(title).toContain('Overfitting Interactive Demo');

      const state = await app.getAppState();
      // The script calls generateData() on load, so points should be an array with length > 0
      expect(Array.isArray(state.points)).toBeTruthy();
      expect(state.points.length).toBeGreaterThan(0);

      // Visual evidence: the metrics area should exist and contain "Train MSE"
      const metrics = await app.getInnerHTML('#metrics');
      expect(metrics).toContain('Train MSE:');
    });
  });

  test.describe('Data generation and model fitting transitions', () => {
    test('Generate Data button creates expected number of points (S0_Idle -> S1_DataGenerated)', async () => {
      // Set a deterministic number of points and seed, then generate
      await app.setValue('#seed', '42');
      await app.setValue('#numPoints', '25'); // range input value as string
      // fire input event manually for range (some browsers require it)
      await app.page.$eval('#numPoints', el => el.dispatchEvent(new Event('input')));
      await app.click('#genData');

      // verify appState updated
      const state = await app.getAppState();
      expect(state.seed).toBe(42);
      expect(state.numPoints).toBe(25);
      expect(Array.isArray(state.points)).toBeTruthy();
      expect(state.points.length).toBe(25);
    });

    test('Fit Model transitions to S2_ModelFitted and updates metrics & coeffs', async () => {
      // Ensure data present
      await app.click('#genData');
      // set degree to 3
      await app.setValue('#degree', '3');
      await app.page.$eval('#degree', el => el.dispatchEvent(new Event('input')));
      // Fit model (no regularization)
      await app.click('#fitModel');

      // appState should now contain a model
      const state = await app.getAppState();
      expect(state.model, 'appState.model should exist after fitting').not.toBeNull();
      expect(Array.isArray(state.model.coeffs)).toBeTruthy();
      expect(state.degree).toBe(3);

      // metrics area should display coefficients
      const metricsHtml = await app.getInnerHTML('#metrics');
      expect(metricsHtml).toContain('Coefficients');
      // coeffsBox should contain inputs for each coefficient
      const coeffsHtml = await app.getInnerHTML('#coeffsBox');
      expect(coeffsHtml).toContain('<table>');
      expect(coeffsHtml).toContain('Coeff');
    });

    test('Fit with L2 regularization (FitWithReg) sets lambda and fits model', async () => {
      await app.click('#genData');
      // set lambda slider to non-zero
      await app.setValue('#lambda', '2.5');
      await app.page.$eval('#lambda', el => el.dispatchEvent(new Event('input')));

      // click fit with reg
      await app.click('#fitWithReg');

      const state = await app.getAppState();
      // model should exist and lambda should be stored in appState
      expect(state.model).not.toBeNull();
      // app sets appState.lambda in fitCurrent; expect it equals the slider value
      expect(Number(state.lambda)).toBeCloseTo(2.5, 3);

      const metricsHtml = await app.getInnerHTML('#metrics');
      expect(metricsHtml).toContain('Coefficients');
    });
  });

  test.describe('Point manipulations, undo/redo, clear, and outlier', () => {
    test('Clear Points transitions to S3_PointsCleared and empties points', async () => {
      await app.click('#genData');
      const before = (await app.getAppState()).points.length;
      expect(before).toBeGreaterThan(0);

      await app.click('#clearPoints');
      const after = (await app.getAppState()).points.length;
      expect(after).toBe(0);

      // UI should reflect no points (metrics may show '-')
      const metricsHtml = await app.getInnerHTML('#metrics');
      expect(metricsHtml).toContain('Train MSE: -');
    });

    test('Add Random Outlier increases point count (S4_OutlierAdded)', async () => {
      await app.click('#genData');
      const before = (await app.getAppState()).points.length;
      await app.click('#addOutlier');
      const after = (await app.getAppState()).points.length;
      expect(after).toBe(before + 1);
    });

    test('Undo and Redo restore previous point counts', async () => {
      await app.click('#genData');
      const startCount = (await app.getAppState()).points.length;
      await app.click('#addOutlier');
      const plusOne = (await app.getAppState()).points.length;
      expect(plusOne).toBe(startCount + 1);

      // undo should revert
      await app.click('#undo');
      const afterUndo = (await app.getAppState()).points.length;
      expect(afterUndo).toBe(startCount);

      // redo should reapply
      await app.click('#redo');
      const afterRedo = (await app.getAppState()).points.length;
      expect(afterRedo).toBe(startCount + 1);
    });

    test('Delete nearest button removes a point when present', async () => {
      await app.click('#genData');
      const before = (await app.getAppState()).points.length;
      // click deleteNearest - the handler will delete nearest point to canvas center
      await app.click('#deleteNearest');
      const after = (await app.getAppState()).points.length;
      // either removed or same if no points - but since points exist expect decreased by 1
      expect(after).toBe(before - 1);
    });
  });

  test.describe('Saving, loading, CSV export/import (S5_StateSaved, S6_StateLoaded, S7_CSVExported, S8_CSVImported)', () => {
    test('Save state to JSON and load it back', async () => {
      // Ensure a model is fitted and state saved
      await app.click('#genData');
      await app.click('#fitModel');
      // save state
      await app.click('#saveState');

      const saved = await app.getStateBoxValue();
      expect(saved).toContain('"points"');
      // Clear points to demonstrate load
      await app.click('#clearPoints');
      const cleared = (await app.getAppState()).points.length;
      expect(cleared).toBe(0);

      // Put saved JSON back into textarea (it should already be there, but ensure)
      await app.page.fill('#stateBox', saved);
      // load state
      // loadStateJSON shows alert on invalid JSON, but we expect valid JSON
      await app.click('#loadStateBtn');

      // appState should be restored
      const state = await app.getAppState();
      expect(Array.isArray(state.points)).toBeTruthy();
      expect(state.points.length).toBeGreaterThan(0);
    });

    test('Export CSV and then import it back (S7_CSVExported -> S8_CSVImported)', async () => {
      await app.click('#genData');
      // export to CSV
      await app.click('#exportCSV');

      const csv = await app.getStateBoxValue();
      expect(csv.split('\n')[0]).toBe('x,y,set');

      // clear and import
      await app.click('#clearPoints');
      expect((await app.getAppState()).points.length).toBe(0);

      // ensure stateBox contains CSV then import
      await app.click('#importCSVBtn');
      // after import, points should be restored
      const restored = (await app.getAppState()).points.length;
      // number of data rows is csv lines minus header (ignore empty trailing)
      const csvLines = csv.trim().split(/\r?\n/).filter(Boolean);
      const expectedPts = csvLines.length - 1;
      expect(restored).toBe(expectedPts);
    });

    test('Import CSV with empty textarea triggers alert (edge case)', async () => {
      // clear textarea explicitly
      await app.page.fill('#stateBox', '');
      const dialogMsg = await app.dialogOnceExpectMessage(async () => {
        await app.click('#importCSVBtn');
      }, 'Paste CSV into the textarea first.');

      // Confirm an alert was shown with expected text
      expect(dialogMsg).toBeTruthy();
      expect(dialogMsg).toContain('Paste CSV into the textarea first.');
    });

    test('Load invalid JSON triggers alert (edge case)', async () => {
      await app.page.fill('#stateBox', '{ bad json }');
      const dialogMsg = await app.dialogOnceExpectMessage(async () => {
        await app.click('#loadStateBtn');
      }, 'Invalid JSON');

      expect(dialogMsg).toBeTruthy();
      expect(dialogMsg).toContain('Invalid JSON');
    });
  });

  test.describe('Cross-validation, Grid Search, Bootstrap, Sweep (S9..S13)', () => {
    test('Run Grid Search produces results and auto-fits best model (S9_GridSearchRun)', async () => {
      await app.click('#genData');

      // set grid parameters to small to speed up the test
      await app.setValue('#gridMaxDeg', '4');
      await app.setValue('#gridLambdas', '0,1');

      await app.click('#runGrid');

      // gridResults should contain a table
      const gridHtml = await app.getInnerHTML('#gridResults');
      expect(gridHtml.toLowerCase()).toContain('<table>');
      // After auto-selection the degree input should reflect the chosen degree
      const degVal = Number(await app.getValue('#degree'));
      expect(!isNaN(degVal)).toBeTruthy();
      // And there should be a model fitted after runGridSearch
      const state = await app.getAppState();
      expect(state.model).not.toBeNull();
      expect(Array.isArray(state.model.coeffs)).toBeTruthy();
    });

    test('Run CV displays CV MSE text (S10_CVRun)', async () => {
      await app.click('#genData');
      // ensure model fitted so runCV can use training points
      await app.click('#fitModel');

      await app.click('#runCV');
      // gridResults shows CV MSE (k=...)
      const gridText = await app.getInnerText('#gridResults');
      expect(gridText).toMatch(/CV MSE \(k=\d+\):/);
    });

    test('Run Bootstrap produces textual bootstrap results (S11_BootstrapRun)', async () => {
      await app.click('#genData');
      await app.click('#fitModel');

      await app.click('#runBootstrap');

      // bootstrapResults should contain "Bootstrap results"
      const bootText = await app.getInnerText('#bootstrapResults');
      expect(bootText).toContain('Bootstrap results');
      expect(bootText).toContain('Average Variance');
    });

    test('Run Sweep starts and Stop Sweep halts it (S12_SweepRun -> S13_SweepStopped)', async () => {
      await app.click('#genData');
      // speed up sweep by narrowing range
      await app.setValue('#sweepFrom', '0');
      await app.setValue('#sweepTo', '3');
      await app.setValue('#sweepStep', '1');

      // start sweep
      await app.click('#runSweep');
      // allow some time for sweep to begin
      await app.page.waitForTimeout(200);

      // click stop
      await app.click('#stopSweep');

      // ensure sweepRunning is false
      const sweepRunning = await app.page.evaluate(() => window.sweepRunning);
      expect(sweepRunning).toBeFalsy();

      // sweepResults should contain textual summary
      const sweepResults = await app.getInnerText('#sweepResults');
      expect(sweepResults.toLowerCase()).toContain('degree sweep results');
    });
  });

  test.describe('Additional interactions and edge behaviors', () => {
    test('Editing coefficients input updates appState.model.coeffs and persists via undo', async () => {
      // Fit a model to get coeff inputs
      await app.click('#genData');
      await app.click('#fitModel');

      // Read first coeff input selector
      const firstCoeffSelector = '#coeffsBox input[data-idx="0"]';
      const exists = await app.page.$(firstCoeffSelector);
      expect(exists, 'coeff input should exist').not.toBeNull();

      // Get current value, modify it, trigger change
      const orig = await app.getValue(firstCoeffSelector);
      // change to a new value
      const newVal = (parseFloat(orig || '0') + 1.0).toFixed(6);
      await app.page.fill(firstCoeffSelector, String(newVal));
      // dispatch change event so the app picks it up
      await app.page.$eval(firstCoeffSelector, el => el.dispatchEvent(new Event('change')));

      // appState.model.coeffs[0] should reflect the new value
      const stateAfterEdit = await app.getAppState();
      expect(Number(stateAfterEdit.model.coeffs[0])).toBeCloseTo(Number(newVal), 5);

      // Undo should revert the coeff change
      await app.click('#undo');
      const stateAfterUndo = await app.getAppState();
      expect(Number(stateAfterUndo.model.coeffs[0])).not.toBeCloseTo(Number(newVal), 5);
    });

    test('Keyboard shortcuts trigger actions (g for generate, f for fit, ctrl+z for undo)', async () => {
      // Press 'g' to generate
      await app.page.keyboard.press('g');
      await app.page.waitForTimeout(100);
      const afterGen = (await app.getAppState()).points.length;
      expect(afterGen).toBeGreaterThan(0);

      // Press 'f' to fit
      await app.page.keyboard.press('f');
      await app.page.waitForTimeout(100);
      const modelExists = (await app.getAppState()).model !== null;
      expect(modelExists).toBeTruthy();

      // Modify something and undo via ctrl+z
      await app.click('#addOutlier');
      const withOutlier = (await app.getAppState()).points.length;
      await app.page.keyboard.down('Control');
      await app.page.keyboard.press('z');
      await app.page.keyboard.up('Control');
      await app.page.waitForTimeout(100);
      const afterUndo = (await app.getAppState()).points.length;
      expect(afterUndo).toBe(withOutlier - 1);
    });
  });
});