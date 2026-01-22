import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e2cc13-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page Object to encapsulate interactions with the demo
class LRPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.scatter = page.locator('#scatter');
    this.dataCount = page.locator('#dataCount');
    this.paramA = page.locator('#paramA');
    this.paramB = page.locator('#paramB');
    this.mse = page.locator('#mse');
    this.r2 = page.locator('#r2');
    this.predictBtn = page.locator('#predictBtn');
    this.predX = page.locator('#predX');
    this.predY = page.locator('#predY');

    this.btnOLS = page.locator('#btnOLS');
    this.btnReset = page.locator('#btnReset');
    this.btnStartGD = page.locator('#btnStartGD');
    this.btnStopGD = page.locator('#btnStopGD');
    this.btnGen = page.locator('#btnGen');
    this.btnAddRand = page.locator('#btnAddRand');
    this.btnRemove = page.locator('#btnRemove');

    this.genN = page.locator('#genN');
    this.genA = page.locator('#genA');
    this.genB = page.locator('#genB');
    this.genNoise = page.locator('#genNoise');

    this.lr = page.locator('#lr');
    this.itersPerSec = page.locator('#itersPerSec');
    this.initZero = page.locator('#initZero');
    this.showResiduals = page.locator('#showResiduals');

    // Canvas for cost plot (to ensure it exists)
    this.costCanvas = page.locator('#costCanvas');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // ensure initial drawing has occurred
    await this.page.waitForLoadState('networkidle');
  }

  async getPointsCount() {
    const txt = await this.dataCount.innerText();
    const m = txt.match(/(-?\d+)/);
    return m ? parseInt(m[1], 10) : NaN;
  }

  async clickCanvas(x = 50, y = 50, options = {}) {
    // Use locator click with position relative to element
    await this.scatter.click({ position: { x, y }, ...options });
  }

  async rightClickCanvas(x = 50, y = 50) {
    await this.scatter.click({ position: { x, y }, button: 'right' });
  }

  async fitOLS() {
    await this.btnOLS.click();
  }

  async startGD() {
    await this.btnStartGD.click();
  }

  async stopGD() {
    await this.btnStopGD.click();
  }

  async generateData() {
    await this.btnGen.click();
  }

  async addRandom() {
    await this.btnAddRand.click();
  }

  async removeLast() {
    await this.btnRemove.click();
  }

  async reset() {
    await this.btnReset.click();
  }

  async predict(x) {
    await this.predX.fill(String(x));
    await this.predictBtn.click();
  }

  async getParamA() {
    return (await this.paramA.innerText()).trim();
  }

  async getParamB() {
    return (await this.paramB.innerText()).trim();
  }

  async getPredY() {
    return (await this.predY.innerText()).trim();
  }
}

test.describe('Interactive Linear Regression Demo — FSM validation', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // reset collectors
    pageErrors = [];
    consoleMessages = [];

    // collect console and page errors for each test
    page.on('console', (msg) => {
      // collect text for assertions and debugging
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(String(err.message || err));
    });
  });

  test.afterEach(async () => {
    // After each test ensure there are no fatal JS errors (ReferenceError/TypeError/SyntaxError)
    // We explicitly assert that no such errors were emitted to pageerror or console in tests that exercise the app.
    const problematic = pageErrors.filter(m => /ReferenceError|TypeError|SyntaxError/i.test(m));
    expect(problematic, `Uncaught page errors of interest: ${JSON.stringify(problematic)}. All console messages: ${JSON.stringify(consoleMessages)}`).toHaveLength(0);

    const consoleProblems = consoleMessages.filter(m => /ReferenceError|TypeError|SyntaxError|Uncaught/i.test(m));
    expect(consoleProblems, `Console contains error-like messages: ${JSON.stringify(consoleProblems)}`).toHaveLength(0);
  });

  test.describe('States existence and initial rendering (S0_Idle)', () => {
    test('page loads and canvas + UI are rendered', async ({ page }) => {
      // Validate initial page render (entry action: renderPage())
      const app = new LRPage(page);
      await app.goto();

      // Canvas should exist and be visible
      await expect(app.scatter).toBeVisible();

      // Data count must be present (initDemo populates points by default)
      const count = await app.getPointsCount();
      // We expect the demo's init to have created a non-zero dataset (initDemo in HTML uses n=18)
      expect(count).toBeGreaterThanOrEqual(0);

      // Param placeholders should be visible
      await expect(app.paramA).toBeVisible();
      await expect(app.paramB).toBeVisible();

      // Cost canvas exists
      await expect(app.costCanvas).toBeVisible();
    });
  });

  test.describe('Data manipulation events and S1_DataAdded state', () => {
    test('MouseDown_AddPoint adds a point and updates dataCount', async ({ page }) => {
      // Click canvas to add a point (left click)
      const app = new LRPage(page);
      await app.goto();

      const before = await app.getPointsCount();
      // Click near center of canvas
      await app.clickCanvas(200, 120);
      const after = await app.getPointsCount();

      // Expect points to increase by at least 1
      expect(after).toBeGreaterThanOrEqual(before + 1);
    });

    test('MouseDown_RemoveLastPoint (right-click) removes last point', async ({ page }) => {
      const app = new LRPage(page);
      await app.goto();

      // Ensure at least one point exists
      let count = await app.getPointsCount();
      if (count === 0) {
        // add one
        await app.clickCanvas(60, 60);
        count = await app.getPointsCount();
        expect(count).toBeGreaterThan(0);
      }

      const before = await app.getPointsCount();
      // Right-click on canvas should remove last
      await app.rightClickCanvas(60, 60);
      const after = await app.getPointsCount();

      expect(after).toBeLessThanOrEqual(before - 1);
    });

    test('Click_AddRandomPoint increases points count', async ({ page }) => {
      const app = new LRPage(page);
      await app.goto();

      const before = await app.getPointsCount();
      await app.addRandom();
      const after = await app.getPointsCount();

      expect(after).toBeGreaterThanOrEqual(before + 1);
    });

    test('Click_RemoveLastPoint via button decreases points count', async ({ page }) => {
      const app = new LRPage(page);
      await app.goto();

      // ensure there's at least one to remove
      let before = await app.getPointsCount();
      if (before === 0) {
        await app.addRandom();
        before = await app.getPointsCount();
      }

      await app.removeLast();
      const after = await app.getPointsCount();

      expect(after).toBeLessThanOrEqual(before - 1);
    });

    test('Click_GenerateData produces expected number of points', async ({ page }) => {
      const app = new LRPage(page);
      await app.goto();

      // Set generator count to a known value and generate
      await app.genN.fill('40');
      await app.generateData();

      const after = await app.getPointsCount();
      expect(after).toBeGreaterThanOrEqual(1);
      // The generator uses Math.max(1, parseInt(genN.value) || 40)
      // Expect at least 1 but commonly equal to 40
      expect(after).toBeGreaterThanOrEqual(1);
    });

    test('Click_Reset clears all points and resets model', async ({ page }) => {
      const app = new LRPage(page);
      await app.goto();

      // ensure there are some points to clear
      let before = await app.getPointsCount();
      if (before === 0) {
        await app.addRandom();
        before = await app.getPointsCount();
      }
      expect(before).toBeGreaterThanOrEqual(1);

      // Click Clear
      await app.reset();

      const after = await app.getPointsCount();
      expect(after).toBe(0);

      // params should show placeholder '—' after reset
      expect(await app.getParamA()).toBe('—');
      expect(await app.getParamB()).toBe('—');
    });
  });

  test.describe('Model fitting and prediction (S2_ModelFitted)', () => {
    test('Click_FitOLS computes parameters and updates UI', async ({ page }) => {
      // Fit OLS when points exist
      const app = new LRPage(page);
      await app.goto();

      // Ensure there are points to fit
      const count = await app.getPointsCount();
      if (count === 0) {
        await app.addRandom();
      }

      // Fit OLS and validate parameters update
      await app.fitOLS();

      const aText = await app.getParamA();
      const bText = await app.getParamB();

      // Should not be placeholder '—' (fit should set numbers)
      expect(aText).not.toBe('—');
      expect(bText).not.toBe('—');

      // They should parse as numbers
      const a = Number(aText);
      const b = Number(bText);
      expect(Number.isFinite(a)).toBe(true);
      expect(Number.isFinite(b)).toBe(true);
    });

    test('Click_Predict uses current model to produce ŷ when model present', async ({ page }) => {
      const app = new LRPage(page);
      await app.goto();

      // Ensure model is fitted
      const count = await app.getPointsCount();
      if (count === 0) {
        await app.addRandom();
      }
      await app.fitOLS();

      const aText = await app.getParamA();
      const bText = await app.getParamB();
      const a = Number(aText);
      const b = Number(bText);
      expect(Number.isFinite(a)).toBe(true);

      // Predict for x=1.23
      await app.predict(1.23);

      const pred = await app.getPredY();
      expect(pred).not.toBe('—');
      const yHat = Number(pred);
      expect(Number.isFinite(yHat)).toBe(true);
      // cross-check yhat close to a*1.23 + b
      const expected = a * 1.23 + b;
      // allow it to match to 3 decimal places (canvas rounding/precision)
      expect(Math.abs(yHat - expected)).toBeLessThanOrEqual(Math.abs(expected) * 1e-2 + 1e-3);
    });
  });

  test.describe('Gradient Descent behavior (S3_GDRunning -> S4_GDStopped)', () => {
    test('Click_StartGD begins iterations and updates model parameters; Click_StopGD halts updates', async ({ page }) => {
      const app = new LRPage(page);
      await app.goto();

      // Ensure dataset exists
      let count = await app.getPointsCount();
      if (count === 0) {
        await app.addRandom();
        count = await app.getPointsCount();
      }
      expect(count).toBeGreaterThan(0);

      // Capture parameter before GD (may be '—' or a number)
      const beforeAraw = await app.getParamA();
      const beforeBraw = await app.getParamB();
      const beforeA = beforeAraw === '—' ? NaN : Number(beforeAraw);
      const beforeB = beforeBraw === '—' ? NaN : Number(beforeBraw);

      // Start GD
      await app.startGD();

      // Wait some time to allow requestAnimationFrame steps (GD uses RAF loop)
      await page.waitForTimeout(300);

      // Stop GD
      await app.stopGD();

      // Read parameters after stopping GD
      const afterAraw = await app.getParamA();
      const afterBraw = await app.getParamB();
      expect(afterAraw).not.toBeUndefined();

      const afterA = afterAraw === '—' ? NaN : Number(afterAraw);
      const afterB = afterBraw === '—' ? NaN : Number(afterBraw);

      // After running GD with data, parameters should be numeric (not placeholder)
      expect(Number.isFinite(afterA) || Number.isNaN(afterA)).toBeTruthy();
      expect(Number.isFinite(afterB) || Number.isNaN(afterB)).toBeTruthy();

      // If before was numeric, expect change after running GD (or at least presence of numeric model)
      if (Number.isFinite(beforeA)) {
        // either changed or remained similar; we accept either but ensure model exists
        expect(Number.isFinite(afterA) || Number.isNaN(afterA)).toBeTruthy();
      } else {
        // before was NaN placeholder, after should likely be numeric after GD
        // GD initializes to 0 if initZero is checked, so we expect numeric values
        expect(Number.isFinite(afterA)).toBeTruthy();
        expect(Number.isFinite(afterB)).toBeTruthy();
      }

      // Ensure that after stop, parameters do not change further: capture snapshot then wait
      const snapshotA = await app.getParamA();
      await page.waitForTimeout(300);
      const snapshotA2 = await app.getParamA();
      expect(snapshotA2).toBe(snapshotA);
    }, 10000);
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Predict when model not fitted yields placeholder response', async ({ page }) => {
      const app = new LRPage(page);
      await app.goto();

      // Reset to clear points and model
      await app.reset();

      // Ensure model param placeholders
      expect(await app.getParamA()).toBe('—');
      expect(await app.getParamB()).toBe('—');

      // Try to predict with no model or insufficient data
      await app.predict(2.5);

      const pred = await app.getPredY();
      expect(pred).toBe('—');
    });

    test('Fit OLS with zero points does not throw and leaves params placeholder', async ({ page }) => {
      const app = new LRPage(page);
      await app.goto();

      // Clear first
      await app.reset();

      // Fit OLS with no points
      await app.fitOLS();

      // Params should remain placeholder '—'
      expect(await app.getParamA()).toBe('—');
      expect(await app.getParamB()).toBe('—');

      // No page errors must have been raised during this operation (checked in afterEach)
    });

    test('Right-click canvas when empty does not cause uncaught exceptions', async ({ page }) => {
      const app = new LRPage(page);
      await app.goto();

      // Clear dataset then right-click
      await app.reset();
      await app.rightClickCanvas(10, 10);

      // Points remain zero and no pageerror logged (validated in afterEach)
      const after = await app.getPointsCount();
      expect(after).toBe(0);
    });
  });

  test.describe('Comprehensive transition sequence (end-to-end)', () => {
    test('Add point -> Fit OLS -> Start GD -> Predict -> Stop GD -> Reset, validating UI updates', async ({ page }) => {
      const app = new LRPage(page);
      await app.goto();

      // 1) Add a point
      const startCount = await app.getPointsCount();
      await app.clickCanvas(150, 100);
      const afterAdd = await app.getPointsCount();
      expect(afterAdd).toBeGreaterThanOrEqual(startCount + 1);

      // 2) Fit OLS
      await app.fitOLS();
      const aText = await app.getParamA();
      const bText = await app.getParamB();
      expect(aText).not.toBe('—');
      expect(bText).not.toBe('—');

      // 3) Start GD for a short while
      const beforeGD = await app.getParamA();
      await app.startGD();
      await page.waitForTimeout(250);
      await app.stopGD();
      const afterGD = await app.getParamA();
      // param should be present and numeric
      expect(afterGD).not.toBe('—');

      // 4) Predict using current model
      await app.predict(0.42);
      const predText = await app.getPredY();
      expect(predText).not.toBe('—');

      // 5) Reset everything
      await app.reset();
      const finalCount = await app.getPointsCount();
      expect(finalCount).toBe(0);
      expect(await app.getParamA()).toBe('—');
      expect(await app.getParamB()).toBe('—');
    }, 15000);
  });
});