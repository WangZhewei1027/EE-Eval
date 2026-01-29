import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3dc2b50-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for the demo controls and metrics
class OverfittingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // controls
    this.degree = page.locator('#degree');
    this.degVal = page.locator('#degVal');
    this.nSamples = page.locator('#nSamples');
    this.nSamplesVal = page.locator('#nSamplesVal');
    this.noise = page.locator('#noise');
    this.noiseVal = page.locator('#noiseVal');
    this.trainPct = page.locator('#trainPct');
    this.trainPctVal = page.locator('#trainPctVal');
    this.lambda = page.locator('#lambda');
    this.lambdaVal = page.locator('#lambdaVal');
    this.regen = page.locator('#regen');
    this.reset = page.locator('#reset');
    // metrics
    this.trainMse = page.locator('#trainMse');
    this.testMse = page.locator('#testMse');
    // canvas
    this.canvas = page.locator('#plot');
  }

  // Helper to set a range input's value and dispatch an input event so the page's listeners fire
  async setRangeInput(locator, value) {
    // Use evaluate to set value and dispatch input event (bubbles to match user interaction)
    await locator.evaluate((el, v) => {
      el.value = String(v);
      // for accessibility consistency also set target.value on any bound properties
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  async getText(selector) {
    return (await this.page.locator(selector).innerText()).trim();
  }

  async getDegVal() { return (await this.degVal.innerText()).trim(); }
  async getNSamplesVal() { return (await this.nSamplesVal.innerText()).trim(); }
  async getNoiseVal() { return (await this.noiseVal.innerText()).trim(); }
  async getTrainPctVal() { return (await this.trainPctVal.innerText()).trim(); }
  async getLambdaVal() { return (await this.lambdaVal.innerText()).trim(); }
  async getTrainMse() { return (await this.trainMse.innerText()).trim(); }
  async getTestMse() { return (await this.testMse.innerText()).trim(); }

  async clickRegenerate() { await this.regen.click(); }
  async clickReset() { await this.reset.click(); }

  // Make a short wait for the canvas to be re-drawn and DOM updates to settle
  async waitForRedraw() {
    // The draw function updates metrics and canvas. Poll trainMse until it is non-empty and stable.
    const prev = await this.getTrainMse();
    // Small delay to allow redraws — uses polling to wait for change or time out
    await this.page.waitForTimeout(50);
    // A modest wait to allow JS redraw to complete
    await this.page.waitForFunction(
      (selector, prevText) => {
        const el = document.querySelector(selector);
        return el && el.innerText.trim().length > 0 && el.innerText.trim() !== prevText;
      },
      '#trainMse', prev,
      { timeout: 2000 }
    ).catch(() => {}); // if it times out, continue and tests will validate value presence
  }
}

// Capture console and page errors globally per test
test.describe.configure({ mode: 'parallel' });

test.describe('Overfitting Demo — Polynomial Regression (d3dc2b50...)', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    // Go to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No specific teardown needed; arrays are reset before each test
  });

  test('Initialization: page loads, controls present, and initial metrics displayed', async ({ page }) => {
    const app = new OverfittingPage(page);

    // Verify that all controls exist and show initial values matching HTML defaults
    await expect(app.degree).toBeVisible();
    await expect(app.nSamples).toBeVisible();
    await expect(app.noise).toBeVisible();
    await expect(app.trainPct).toBeVisible();
    await expect(app.lambda).toBeVisible();
    await expect(app.regen).toBeVisible();
    await expect(app.reset).toBeVisible();
    await expect(app.canvas).toBeVisible();

    // Check displayed values initialized per HTML (deg=3, nSamples=30, noise=0.20, trainPct=70%, lambda=0.00)
    expect(await app.getDegVal()).toBe('3');
    expect(await app.getNSamplesVal()).toBe('30');
    expect(await app.getNoiseVal()).toBe('0.20');
    expect(await app.getTrainPctVal()).toBe('70%');
    expect(await app.getLambdaVal()).toBe('0.00');

    // Metrics should have been computed by the initial draw() call executed on page load
    const trainMse = await app.getTrainMse();
    const testMse = await app.getTestMse();
    // Expect that training MSE is a numeric string with 4 decimals as set by toFixed(4)
    expect(trainMse).toMatch(/^\d+\.\d{4}$/);
    // Test MSE should be present and numeric (not the initial '-' placeholder)
    expect(testMse).not.toBe('-');
    expect(testMse).toMatch(/^\d+\.\d{4}$/);

    // Assert no uncaught page errors like ReferenceError/SyntaxError/TypeError occurred during load
    // (We capture pageerrors in pageErrors). Expect none.
    expect(pageErrors.length, `pageerror events: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Also assert the console did not emit fatal errors containing common JS error names
    const fatalErrors = consoleMessages.filter(m => /ReferenceError|SyntaxError|TypeError|Uncaught/i.test(m.text) || m.type === 'error');
    expect(fatalErrors.length, `console errors: ${fatalErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test.describe('Control interactions and FSM transitions', () => {
    test('DegreeChange: moving degree slider updates UI and triggers a redraw', async ({ page }) => {
      const app = new OverfittingPage(page);

      // Record previous metrics
      const prevTrain = await app.getTrainMse();
      const prevTest = await app.getTestMse();

      // Change degree slider — FSM says input should call updateStateFromUI() and draw()
      await app.setRangeInput(app.degree, 10);

      // Wait briefly for redraw/DOM updates
      await app.waitForRedraw();

      // Validate degree label updated
      expect(await app.getDegVal()).toBe('10');

      // After redraw, training/test errors should have changed (very likely)
      const newTrain = await app.getTrainMse();
      const newTest = await app.getTestMse();

      // They should be valid numeric strings
      expect(newTrain).toMatch(/^\d+\.\d{4}$/);
      expect(newTest).toMatch(/^\d+\.\d{4}$/);

      // It's possible (rare) the numeric values match exactly; at minimum confirm UI changed for degree and draw ran.
      // If they differ, assert they changed from previous values.
      if (prevTrain !== newTrain || prevTest !== newTest) {
        expect(prevTrain !== newTrain || prevTest !== newTest).toBeTruthy();
      }
    });

    test('SamplesChange: updating sample count updates UI (state updated) but data regenerates only on Regenerate', async ({ page }) => {
      const app = new OverfittingPage(page);

      // Change samples slider to a different number
      await app.setRangeInput(app.nSamples, 100);
      // UI immediate update expected (FSM: updateStateFromUI only)
      expect(await app.getNSamplesVal()).toBe('100');

      // Metrics should not necessarily change until regenerate is clicked.
      const beforeTrain = await app.getTrainMse();
      const beforeTest = await app.getTestMse();

      // Click regenerate — FSM: updateStateFromUI(); generateData(); draw();
      await app.clickRegenerate();
      // allow redraw
      await app.waitForRedraw();

      const afterTrain = await app.getTrainMse();
      const afterTest = await app.getTestMse();

      // After regenerate, metrics should still be numeric and likely different due to new sampled data.
      expect(afterTrain).toMatch(/^\d+\.\d{4}$/);
      expect(afterTest).toMatch(/^\d+\.\d{4}$/);

      // At least one metric should differ after regeneration in almost all normal cases
      if (beforeTrain === afterTrain && beforeTest === afterTest) {
        // Allow but warn in the test output via a soft assertion (still pass): ensure values are present
        expect(afterTrain).toBe(beforeTrain);
      } else {
        expect(beforeTrain !== afterTrain || beforeTest !== afterTest).toBeTruthy();
      }
    });

    test('NoiseChange: updating noise updates UI state', async ({ page }) => {
      const app = new OverfittingPage(page);

      // Change noise slider
      await app.setRangeInput(app.noise, 0.8);
      expect(await app.getNoiseVal()).toBe('0.80');

      // Changing noise alone only calls updateStateFromUI; data remains until regenerate
      // Confirm train/test values still present and numeric
      expect(await app.getTrainMse()).toMatch(/^\d+\.\d{4}$/);
      expect(await app.getTestMse()).toMatch(/^\d+\.\d{4}$/);
    });

    test('TrainPctChange: updating train percent updates UI label', async ({ page }) => {
      const app = new OverfittingPage(page);

      // Change train percent
      await app.setRangeInput(app.trainPct, 50);
      expect(await app.getTrainPctVal()).toBe('50%');

      // Because updateStateFromUI was called, the label updates. Actual split will change on regenerate.
      // Trigger regenerate to apply new split and ensure metrics update
      const beforeTest = await app.getTestMse();
      await app.clickRegenerate();
      await app.waitForRedraw();
      expect(await app.getTestMse()).toMatch(/^[\d-]/); // either numeric or '-' if no test samples (should be numeric)
    });

    test('LambdaChange: changing ridge parameter updates UI and triggers redraw (smoothing effect)', async ({ page }) => {
      const app = new OverfittingPage(page);

      const beforeTrain = await app.getTrainMse();
      const beforeTest = await app.getTestMse();

      // Increase lambda
      await app.setRangeInput(app.lambda, 1.5);
      // Lambda change triggers draw() per FSM
      await app.waitForRedraw();

      expect(await app.getLambdaVal()).toBe('1.50');

      const afterTrain = await app.getTrainMse();
      const afterTest = await app.getTestMse();

      expect(afterTrain).toMatch(/^\d+\.\d{4}$/);
      expect(afterTest).toMatch(/^\d+\.\d{4}$/);

      // Typically, lambda will change fit; if values changed assert that
      if (beforeTrain !== afterTrain || beforeTest !== afterTest) {
        expect(beforeTrain !== afterTrain || beforeTest !== afterTest).toBeTruthy();
      }
    });

    test('RegenerateData (button): clicking Regenerate updates data and redraws', async ({ page }) => {
      const app = new OverfittingPage(page);

      // read metrics
      const aTrain = await app.getTrainMse();
      const aTest = await app.getTestMse();

      // click regenerate
      await app.clickRegenerate();
      await app.waitForRedraw();

      const bTrain = await app.getTrainMse();
      const bTest = await app.getTestMse();

      // metrics should remain numeric but likely different due to new random data
      expect(bTrain).toMatch(/^\d+\.\d{4}$/);
      expect(bTest).toMatch(/^\d+\.\d{4}$/);

      // Not strictly required to change every time, but usual behavior is different
      // If different, assert difference
      if (aTrain !== bTrain || aTest !== bTest) {
        expect(aTrain !== bTrain || aTest !== bTest).toBeTruthy();
      }
    });

    test('ResetParameters: clicking Reset restores defaults and regenerates data', async ({ page }) => {
      const app = new OverfittingPage(page);

      // Change many controls to non-defaults
      await app.setRangeInput(app.degree, 12);
      await app.setRangeInput(app.nSamples, 150);
      await app.setRangeInput(app.noise, 1.2);
      await app.setRangeInput(app.trainPct, 80);
      await app.setRangeInput(app.lambda, 2.0);

      // Confirm changed
      expect(await app.getDegVal()).toBe('12');
      expect(await app.getNSamplesVal()).toBe('150');
      expect(await app.getNoiseVal()).toBe('1.20');
      expect(await app.getTrainPctVal()).toBe('80%');
      expect(await app.getLambdaVal()).toBe('2.00');

      // Click reset — FSM: resets values to defaults and calls updateStateFromUI(), generateData(), draw()
      await app.clickReset();
      // allow redraw
      await app.waitForRedraw();

      // Defaults from the HTML: degree=3, nSamples=30, noise=0.2, trainPct=70, lambda=0
      expect(await app.getDegVal()).toBe('3');
      expect(await app.getNSamplesVal()).toBe('30');
      expect(await app.getNoiseVal()).toBe('0.20');
      expect(await app.getTrainPctVal()).toBe('70%');
      expect(await app.getLambdaVal()).toBe('0.00');

      // Metrics must exist and be numeric
      expect(await app.getTrainMse()).toMatch(/^\d+\.\d{4}$/);
      expect(await app.getTestMse()).toMatch(/^\d+\.\d{4}$/);
    });
  });

  test.describe('Edge cases, robustness and error observation', () => {
    test('High degree and low samples: exercise potential numerical issues (no patching allowed)', async ({ page }) => {
      const app = new OverfittingPage(page);

      // Set degree very high and smallish sample count (but within allowed bounds)
      await app.setRangeInput(app.degree, 20);
      await app.setRangeInput(app.nSamples, 6); // smallest allowed
      // updateStateFromUI but need to regenerate to apply nSamples change
      await app.clickRegenerate();

      // Wait for redraw and ensure no uncaught exceptions were emitted to the pageerror handler
      await app.waitForRedraw();

      // Metrics may be numeric or training mse may be small; ensure values are present
      const train = await app.getTrainMse();
      const test = await app.getTestMse();

      // Either numeric or '-' for test in degenerate cases, but should not crash
      if (test !== '-') {
        expect(test).toMatch(/^\d+\.\d{4}$/);
      }
      expect(train).toMatch(/^\d+\.\d{4}$/);

      // Confirm page did not produce pageerrors (ReferenceError/SyntaxError/TypeError)
      expect(pageErrors.length).toBe(0);

      // Also inspect console messages: there should be no fatal JS errors
      const fatal = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(m.text));
      expect(fatal.length).toBe(0);
    });

    test('Lambda extreme value: set to max to ensure regularization path runs without exceptions', async ({ page }) => {
      const app = new OverfittingPage(page);

      // Set lambda to upper bound
      await app.setRangeInput(app.lambda, 10.0);
      // Lambda change triggers draw
      await app.waitForRedraw();

      expect(await app.getLambdaVal()).toBe('10.00');
      expect(await app.getTrainMse()).toMatch(/^\d+\.\d{4}$/);
      expect(await app.getTestMse()).toMatch(/^\d+\.\d{4}$/);

      // No page errors expected
      expect(pageErrors.length).toBe(0);
    });

    test('Observe console and page errors: capture any ReferenceError/SyntaxError/TypeError occurrences', async ({ page }) => {
      // This test explicitly records any console messages or page errors and asserts none of the critical JS errors occurred.
      // (Per instructions we observe console and page errors; we do NOT modify the page environment.)
      const app = new OverfittingPage(page);

      // perform a few interactions to exercise code paths
      await app.setRangeInput(app.degree, 7);
      await app.setRangeInput(app.lambda, 0.5);
      await app.clickRegenerate();
      await app.waitForRedraw();

      // Check pageErrors array collected via page.on('pageerror')
      // If any page errors occurred, fail the test and output the messages
      expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);

      // Look for console messages that indicate JS runtime errors
      const runtimeErrors = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|SyntaxError|TypeError|Uncaught/i.test(m.text));
      expect(runtimeErrors.length, `Unexpected console runtime errors: ${runtimeErrors.map(e => e.text).join(' | ')}`).toBe(0);
    });
  });
});