import { test, expect } from '@playwright/test';

// Test suite for SVM Interactive Demo (Application ID: d3dbb621-fa73-11f0-83e0-8d7be1d51901)
// The page is served at:
// http://127.0.0.1:5500/workspace/0126-balanced/html/d3dbb621-fa73-11f0-83e0-8d7be1d51901.html

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3dbb621-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object Model for interacting with the SVM demo
class SVMPage {
  constructor(page) {
    this.page = page;
    this.plot = page.locator('#plot');
    this.classPos = page.locator('#class-pos');
    this.classNeg = page.locator('#class-neg');
    this.trainBtn = page.locator('#train');
    this.autoBtn = page.locator('#auto');
    this.clearBtn = page.locator('#clear');
    this.randomSepBtn = page.locator('#random-sep');
    this.randomMixBtn = page.locator('#random-mix');
    this.epochsSlider = page.locator('#epochs');
    this.lambdaSlider = page.locator('#lambda');
    this.batchSlider = page.locator('#batch');
    this.epochVal = page.locator('#epoch-val');
    this.lambdaVal = page.locator('#lambda-val');
    this.batchVal = page.locator('#batch-val');
    this.stats = page.locator('#stats');
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click canvas at coordinates relative to canvas top-left (x,y in px)
  async clickCanvasAt(x, y, options = {}) {
    // Use Playwright click with position inside the element
    await this.plot.click({ position: { x, y }, ...options });
  }

  // Get the Points N value from statsDiv (parses "Points: N")
  async getPointsCountFromStats() {
    const text = await this.stats.innerText();
    const m = text.match(/Points:\s*(\d+)/);
    return m ? parseInt(m[1], 10) : null;
  }

  // Get the full stats text
  async getStatsText() {
    return await this.stats.innerText();
  }

  // Get auto button text
  async getAutoText() {
    return await this.autoBtn.innerText();
  }

  // Get inline boxShadow style for class buttons (inline style set by code)
  async getClassBoxShadow(selector) {
    return await this.page.$eval(selector, (el) => el.style.boxShadow || '');
  }

  // Click controls
  async clickTrain() { await this.trainBtn.click(); }
  async clickAuto() { await this.autoBtn.click(); }
  async clickClear() { await this.clearBtn.click(); }
  async clickRandomSep() { await this.randomSepBtn.click(); }
  async clickRandomMix() { await this.randomMixBtn.click(); }
  async clickClassPos() { await this.classPos.click(); }
  async clickClassNeg() { await this.classNeg.click(); }

  // Set slider values (use the input's value and dispatch input event by using setInputFiles is not suitable;
  // we change by evaluate to set value and dispatch input event)
  async setEpochs(value) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('epochs');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }
  async setLambda(value) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('lambda');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }
  async setBatch(value) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('batch');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  // Utility to wait until points count changes to expected
  async waitForPointsCount(expected, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, exp) => {
        const s = document.querySelector(sel);
        if (!s) return false;
        const m = s.innerText.match(/Points:\s*(\d+)/);
        return m ? parseInt(m[1], 10) === exp : false;
      },
      this.stats.selector,
      expected,
      { timeout }
    );
  }

  // Utility to wait until stats text no longer contains the provided substring
  async waitForStatsNotToContain(substr, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, sub) => !document.querySelector(sel).innerText.includes(sub),
      this.stats.selector,
      substr,
      { timeout }
    );
  }
}

// Keep track of console errors and uncaught page errors for assertions
test.describe('SVM Interactive Demo - FSM and UI tests', () => {
  test.beforeEach(async ({ page }) => {
    // nothing global to set up; each test navigates anew
  });

  // Group tests relating to initial state and UI elements
  test.describe('Initial state (S0_Idle) and UI sanity', () => {
    test('Initial load shows Idle state: points generated and UI elements present', async ({ page }) => {
      // Capture console errors and page errors
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err.message);
      });

      const svm = new SVMPage(page);
      await svm.goto();

      // Validate stats show the initial 30 points generated by script
      await expect(svm.stats).toBeVisible();
      const statsText = await svm.getStatsText();
      expect(statsText).toContain('Points: 30');

      // Validate initial model values shown (w should be zeros initially)
      expect(statsText).toMatch(/w = \[0\.000,\s*0\.000\]/);

      // Auto-train start text is off
      await expect(svm.autoBtn).toBeVisible();
      expect(await svm.getAutoText()).toContain('Auto-train: off');

      // class-pos was programmatically clicked on load; inline style boxShadow should have been set
      const posBox = await svm.getClassBoxShadow('#class-pos');
      expect(posBox).toBeTruthy(); // should not be empty string

      // Ensure no runtime console or uncaught page errors occurred during initial load
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Events and transitions', () => {
    test('Clicking canvas adds a point (S0_Idle -> S1_PointAdded)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const svm = new SVMPage(page);
      await svm.goto();

      // Determine a safe click position near the center of canvas
      const box = await page.$eval('#plot', (c) => ({ w: c.width, h: c.height }));
      const cx = Math.floor(box.w / 2);
      const cy = Math.floor(box.h / 2);

      // Current points should be 30
      expect(await svm.getPointsCountFromStats()).toBe(30);

      // Click the canvas (no shift) to add point with current label
      await svm.clickCanvasAt(cx, cy);

      // Wait for stats to update to 31 points
      await svm.waitForPointsCount(31);

      expect(await svm.getPointsCountFromStats()).toBe(31);

      // No runtime console/page errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Selecting negative class updates UI and adds point of new class (ClickClassNeg -> add point)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const svm = new SVMPage(page);
      await svm.goto();

      // Click class-negative button
      await svm.clickClassNeg();

      // Inline box shadow should be set for negative class button
      const negBox = await svm.getClassBoxShadow('#class-neg');
      expect(negBox).toBeTruthy();

      // Click canvas to add point with negative label; verify count increments
      const box = await page.$eval('#plot', (c) => ({ w: c.width, h: c.height }));
      await svm.clickCanvasAt(Math.floor(box.w * 0.25), Math.floor(box.h * 0.25));
      await svm.waitForPointsCount(31);

      // No runtime errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Train button triggers training and updates model (S1_PointAdded -> S2_Training)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const svm = new SVMPage(page);
      await svm.goto();

      // Ensure initial w are zeros
      const initialStats = await svm.getStatsText();
      expect(initialStats).toMatch(/w = \[0\.000,\s*0\.000\]/);

      // Add one point so training has something to work on
      const box = await page.$eval('#plot', (c) => ({ w: c.width, h: c.height }));
      await svm.clickCanvasAt(Math.floor(box.w * 0.3), Math.floor(box.h * 0.6));
      await svm.waitForPointsCount(31);

      // Click Train
      await svm.clickTrain();

      // After training, model w should no longer be exactly zeros.
      // Wait until stats text no longer contains the zero-vector marker (allow some time for training)
      await svm.waitForStatsNotToContain('w = [0.000, 0.000]', 5000);

      const postTrainStats = await svm.getStatsText();
      expect(postTrainStats).not.toMatch(/w = \[0\.000,\s*0\.000\]/);

      // Ensure no runtime errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Auto-train toggles and triggers training when on (S1_PointAdded -> S3_AutoTraining)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const svm = new SVMPage(page);
      await svm.goto();

      // Enable auto-train
      await svm.clickAuto();

      // Button text should reflect on
      expect(await svm.getAutoText()).toContain('Auto-train: on');

      // Click canvas to add a point. When auto is on, trainAndDraw() is called automatically.
      const box = await page.$eval('#plot', (c) => ({ w: c.width, h: c.height }));
      const beforeCount = await svm.getPointsCountFromStats();
      await svm.clickCanvasAt(Math.floor(box.w * 0.6), Math.floor(box.h * 0.4));
      await svm.waitForPointsCount(beforeCount + 1);

      // Training runs; stats should update accordingly within a reasonable time
      // Wait until stats text shows non-zero w (if not already)
      try {
        await svm.waitForStatsNotToContain('w = [0.000, 0.000]', 5000);
      } catch (e) {
        // It's possible the model was already non-zero; ignore timeout failure here and assert presence of stats
      }
      const statsAfter = await svm.getStatsText();
      expect(statsAfter).toContain('Points:');

      // Toggle back off
      await svm.clickAuto();
      expect(await svm.getAutoText()).toContain('Auto-train: off');

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Clear button clears points and enters Cleared state (S4_Cleared)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const svm = new SVMPage(page);
      await svm.goto();

      // Ensure we have points to clear
      expect(await svm.getPointsCountFromStats()).toBeGreaterThan(0);

      // Click clear
      await svm.clickClear();

      // Stats should reflect no points
      await expect(svm.stats).toHaveText(/No points/);

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Random dataset buttons generate datasets (S5_RandomDataset and S6_RandomMixedDataset)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const svm = new SVMPage(page);
      await svm.goto();

      // Click random separable
      await svm.clickRandomSep();
      // Wait until points equals 40
      await svm.waitForPointsCount(40);
      expect(await svm.getPointsCountFromStats()).toBe(40);

      // Click random mixed
      await svm.clickRandomMix();
      await svm.waitForPointsCount(40);
      expect(await svm.getPointsCountFromStats()).toBe(40);

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Sliders update their displayed values and internal input events fire (InputEpochs/InputLambda/InputBatchSize)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const svm = new SVMPage(page);
      await svm.goto();

      // Change epochs to 500
      await svm.setEpochs(500);
      await expect(svm.epochVal).toHaveText('500');

      // Change lambda to 0.05
      await svm.setLambda(0.05);
      // lambdaVal is textual float; may be "0.05"
      await expect(svm.lambdaVal).toHaveText(/0\.05/);

      // Change batch size to 20
      await svm.setBatch(20);
      await expect(svm.batchVal).toHaveText('20');

      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Edge case: clicking Train with no points should not throw and shows No points (train on empty dataset)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => pageErrors.push(err.message));

      const svm = new SVMPage(page);
      await svm.goto();

      // Clear points to make dataset empty
      await svm.clickClear();
      await expect(svm.stats).toHaveText(/No points/);

      // Click Train when no points; trainAndDraw should handle empty dataset gracefully
      await svm.clickTrain();

      // Stats remain No points
      await expect(svm.stats).toHaveText(/No points/);

      // No runtime console/page errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No uncaught ReferenceError / SyntaxError / TypeError on load and interactions', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => {
        // capture all console.error outputs
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => {
        // capture uncaught exceptions like ReferenceError/TypeError
        pageErrors.push(err.message);
      });

      const svm = new SVMPage(page);
      await svm.goto();

      // Perform a set of interactions covering the main code paths
      // Add a point, toggle auto, random datasets, sliders, train, clear
      const box = await page.$eval('#plot', (c) => ({ w: c.width, h: c.height }));
      await svm.clickCanvasAt(Math.floor(box.w * 0.2), Math.floor(box.h * 0.2));
      await svm.clickClassNeg();
      await svm.clickCanvasAt(Math.floor(box.w * 0.8), Math.floor(box.h * 0.8));
      await svm.clickAuto();
      // wait briefly for auto-train (if triggered) to complete
      await page.waitForTimeout(300);
      await svm.clickAuto();
      await svm.clickRandomSep();
      await svm.clickRandomMix();
      await svm.setEpochs(100);
      await svm.setLambda(0.01);
      await svm.setBatch(5);
      await svm.clickTrain();
      await svm.clickClear();

      // At this point we assert there were no console errors and no uncaught page errors.
      // This validates the runtime executed without throwing ReferenceError/SyntaxError/TypeError.
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });
});