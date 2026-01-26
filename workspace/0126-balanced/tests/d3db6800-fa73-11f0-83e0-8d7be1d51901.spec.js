import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3db6800-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object Model for interacting with the demo
class LogisticDemoPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      heading: 'h1',
      plot: '#plot',
      clear: '#clear',
      generateSep: '#generate-sep',
      generateMixed: '#generate-mixed',
      run: '#run',
      pause: '#pause',
      step: '#step',
      resetWeights: '#reset-weights',
      lr: '#lr',
      lrVal: '#lrVal',
      reg: '#reg',
      regVal: '#regVal',
      nPoints: '#nPoints',
      epochs: '#epochs',
      loss: '#loss',
      wVal: '#wVal',
      bVal: '#bVal',
      addClassRadios: 'input[name="addClass"]'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // wait for initial rendering
    await this.page.waitForSelector(this.selectors.heading);
  }

  async getText(selector) {
    return (await this.page.locator(selector).innerText()).trim();
  }

  async click(selector) {
    await this.page.locator(selector).click();
  }

  async clickCanvasAtRatio(rx = 0.5, ry = 0.5, button = 'left') {
    // click at given ratio inside the canvas (0..1)
    const canvas = this.page.locator(this.selectors.plot);
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    const x = box.x + box.width * rx;
    const y = box.y + box.height * ry;
    await this.page.mouse.click(x, y, { button });
  }

  async setRangeValue(selector, value) {
    await this.page.evaluate(
      ({ selector, value }) => {
        const el = document.querySelector(selector);
        el.value = value;
        const ev = new Event('input', { bubbles: true });
        el.dispatchEvent(ev);
      },
      { selector, value: String(value) }
    );
  }

  async selectAddClass(value) {
    // value is '0' or '1'
    await this.page.locator(`${this.selectors.addClassRadios}[value="${value}"]`).check();
  }

  async getAttribute(selector, attr) {
    return await this.page.locator(selector).getAttribute(attr);
  }

  async getEpochs() {
    const txt = await this.getText(this.selectors.epochs);
    return Number(txt);
  }

  async getNPoints() {
    const txt = await this.getText(this.selectors.nPoints);
    return Number(txt);
  }

  async getWVal() {
    return await this.getText(this.selectors.wVal);
  }

  async getBVal() {
    return await this.getText(this.selectors.bVal);
  }

  async isDisabled(selector) {
    const disabledAttr = await this.page.locator(selector).getAttribute('disabled');
    return disabledAttr !== null;
  }
}

// Global listener arrays will be created per test in beforeEach
test.describe('Interactive Logistic Regression Demo - FSM & UI tests', () => {
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // capture console messages (filter severe)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });
  });

  test.afterEach(async () => {
    // After each test we verify that no severe console/page errors occurred
    // This asserts the runtime remained free of unexpected errors like ReferenceError/TypeError/SyntaxError
    // If any such errors exist, fail the test with a helpful message.
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      const pe = pageErrors.map(e => (e && e.stack) ? e.stack : String(e)).join('\n\n');
      const ce = consoleErrors.map(c => `${c.text()}`).join('\n\n');
      // Fail with collected messages
      throw new Error(`Runtime errors detected during test execution.\nPage errors:\n${pe}\n\nConsole errors:\n${ce}`);
    }
  });

  test.describe('States: Idle, Running, Paused', () => {
    test('Idle state: initial render and controls presence', async ({ page }) => {
      // Validate Idle (S0_Idle) on load: header exists, run enabled, pause disabled, epochs 0, points 0
      const demo = new LogisticDemoPage(page);
      await demo.goto();

      // Check title text
      const heading = await demo.getText(demo.selectors.heading);
      expect(heading).toBe('Interactive Logistic Regression Demo');

      // Run button should be present and enabled
      const runDisabled = await demo.isDisabled(demo.selectors.run);
      expect(runDisabled).toBe(false);

      // Pause should be disabled initially (per HTML attributes)
      const pauseDisabled = await demo.isDisabled(demo.selectors.pause);
      expect(pauseDisabled).toBe(true);

      // Stats initially show 0 points and 0 epochs
      const nPoints = await demo.getNPoints();
      expect(nPoints).toBe(0);
      const epochs = await demo.getEpochs();
      expect(epochs).toBe(0);

      // Calling step with no points is an edge case — should not throw and should not change epochs
      // We click step and expect epochs remain 0
      await demo.click(demo.selectors.step);
      // give a short moment for any possible code to run
      await page.waitForTimeout(100);
      const epochsAfterStep = await demo.getEpochs();
      expect(epochsAfterStep).toBe(0);
    });

    test('Running and Paused transitions: Click Run -> animate -> Click Pause', async ({ page }) => {
      const demo = new LogisticDemoPage(page);
      await demo.goto();

      // Generate a small dataset so training does something
      await demo.click(demo.selectors.generateSep);
      // ensure points generated
      await page.waitForFunction(selector => {
        const el = document.querySelector(selector);
        return el && el.textContent.trim() !== '0';
      }, demo.selectors.nPoints);

      const beforeEpochs = await demo.getEpochs();

      // Click Run: expect run disabled and pause enabled (enter S1_Running)
      await demo.click(demo.selectors.run);
      expect(await demo.isDisabled(demo.selectors.run)).toBe(true);
      expect(await demo.isDisabled(demo.selectors.pause)).toBe(false);

      // Wait for epochs to increase indicating training ran
      await page.waitForFunction(
        (selector, before) => Number(document.querySelector(selector).textContent.trim()) > before,
        demo.selectors.epochs,
        beforeEpochs
      );

      const epochsDuringRun = await demo.getEpochs();
      expect(epochsDuringRun).toBeGreaterThan(beforeEpochs);

      // Click Pause: should set running=false and re-enable Run (enter S2_Paused)
      await demo.click(demo.selectors.pause);
      expect(await demo.isDisabled(demo.selectors.run)).toBe(false);
      // Pause button should be disabled again
      expect(await demo.isDisabled(demo.selectors.pause)).toBe(true);

      // Record epochs and ensure they stop incrementing after pause
      const recordedEpochs = await demo.getEpochs();
      await page.waitForTimeout(300); // wait a bit to see if animate kept running unexpectedly
      const epochsAfterWait = await demo.getEpochs();
      expect(epochsAfterWait).toBe(recordedEpochs);
    });

    test('Paused -> Run (resume) and Step behaviour', async ({ page }) => {
      const demo = new LogisticDemoPage(page);
      await demo.goto();

      // generate points
      await demo.click(demo.selectors.generateMixed);
      await page.waitForFunction(selector => document.querySelector(selector).textContent.trim() !== '0', demo.selectors.nPoints);

      // Ensure paused state by default: run enabled
      expect(await demo.isDisabled(demo.selectors.run)).toBe(false);

      // Click Run to enter Running
      await demo.click(demo.selectors.run);
      expect(await demo.isDisabled(demo.selectors.run)).toBe(true);

      // Wait a small time for some epochs
      await page.waitForFunction(selector => Number(document.querySelector(selector).textContent.trim()) > 0, demo.selectors.epochs);

      // Pause again
      await demo.click(demo.selectors.pause);
      expect(await demo.isDisabled(demo.selectors.run)).toBe(false);

      // Record epochs
      const e1 = await demo.getEpochs();

      // Click Step once: should increment epoch by 1
      await demo.click(demo.selectors.step);
      await page.waitForTimeout(50);
      const e2 = await demo.getEpochs();
      expect(e2).toBeGreaterThanOrEqual(e1 + 1);
    });
  });

  test.describe('Events & Transitions: Add/Clear/Generate/Reset/Parameters', () => {
    test('Add point via canvas click and ChangeClass radio selection', async ({ page }) => {
      const demo = new LogisticDemoPage(page);
      await demo.goto();

      // Choose class 0 (red)
      await demo.selectAddClass('0');
      // Click near the center of canvas to add a point
      await demo.clickCanvasAtRatio(0.5, 0.5, 'left');

      // Expect nPoints to be 1
      await page.waitForFunction(selector => document.querySelector(selector).textContent.trim() === '1', demo.selectors.nPoints);
      const nPoints = await demo.getNPoints();
      expect(nPoints).toBe(1);

      // Add another as class 1
      await demo.selectAddClass('1');
      await demo.clickCanvasAtRatio(0.6, 0.4, 'left');
      await page.waitForFunction(selector => Number(document.querySelector(selector).textContent.trim()) >= 2, demo.selectors.nPoints);
      const nPoints2 = await demo.getNPoints();
      expect(nPoints2).toBeGreaterThanOrEqual(2);
    });

    test('Click Clear removes points and resets epoch/loss', async ({ page }) => {
      const demo = new LogisticDemoPage(page);
      await demo.goto();

      // generate and then clear
      await demo.click(demo.selectors.generateSep);
      await page.waitForFunction(selector => document.querySelector(selector).textContent.trim() !== '0', demo.selectors.nPoints);
      // Confirm points present
      expect(await demo.getNPoints()).toBeGreaterThan(0);

      // Click clear
      await demo.click(demo.selectors.clear);
      // nPoints should be 0, epoch should be 0, loss must be '-'
      await page.waitForFunction(selector => document.querySelector(selector).textContent.trim() === '0', demo.selectors.nPoints);
      const nPoints = await demo.getNPoints();
      expect(nPoints).toBe(0);
      const epochs = await demo.getEpochs();
      expect(epochs).toBe(0);
      const lossText = await demo.getText(demo.selectors.loss);
      expect(lossText).toBe('-');
    });

    test('Generate separable and mixed datasets produce points', async ({ page }) => {
      const demo = new LogisticDemoPage(page);
      await demo.goto();

      // Separable
      await demo.click(demo.selectors.generateSep);
      await page.waitForFunction(selector => Number(document.querySelector(selector).textContent.trim()) > 0, demo.selectors.nPoints);
      const nSep = await demo.getNPoints();
      expect(nSep).toBeGreaterThan(0);

      // Clear then mixed
      await demo.click(demo.selectors.clear);
      await demo.click(demo.selectors.generateMixed);
      await page.waitForFunction(selector => Number(document.querySelector(selector).textContent.trim()) > 0, demo.selectors.nPoints);
      const nMix = await demo.getNPoints();
      expect(nMix).toBeGreaterThan(0);
    });

    test('Reset weights updates displayed weights and bias', async ({ page }) => {
      const demo = new LogisticDemoPage(page);
      await demo.goto();

      // Read initial weight and bias strings
      const wBefore = await demo.getWVal();
      const bBefore = await demo.getBVal();

      // Click reset-weights
      await demo.click(demo.selectors.resetWeights);
      // reset should update the displayed values; they should change (probabilistic but very likely)
      await page.waitForTimeout(50);
      const wAfter = await demo.getWVal();
      const bAfter = await demo.getBVal();

      // It's possible (though unlikely) the random reset yields same textual values due to formatting.
      // Assert that at least one of them changed to provide reasonable confidence the button works.
      const same = wBefore === wAfter && bBefore === bAfter;
      expect(same).toBe(false);
    });

    test('Adjust learning rate and regularization sliders update labels', async ({ page }) => {
      const demo = new LogisticDemoPage(page);
      await demo.goto();

      // Set learning rate to a new value and ensure lrVal updates
      await demo.setRangeValue(demo.selectors.lr, 1.234);
      const lrLabel = await demo.getText(demo.selectors.lrVal);
      // label is formatted to 3 decimals per implementation
      expect(lrLabel).toBe('1.234');

      // Set regularization value
      await demo.setRangeValue(demo.selectors.reg, 0.123);
      const regLabel = await demo.getText(demo.selectors.regVal);
      expect(regLabel).toBe('0.123');
    });
  });

  test.describe('Edge cases & error observations', () => {
    test('Step with no points does nothing and triggers no runtime errors', async ({ page }) => {
      const demo = new LogisticDemoPage(page);
      await demo.goto();

      // Ensure no points exist
      const n = await demo.getNPoints();
      expect(n).toBe(0);

      // Click step (edge case) - should not throw and should keep epochs at 0
      await demo.click(demo.selectors.step);
      await page.waitForTimeout(100);
      const epochs = await demo.getEpochs();
      expect(epochs).toBe(0);

      // Ensure no runtime errors captured (pageErrors/consoleErrors will be checked in afterEach)
    });

    test('Observe console and page errors during a full interaction scenario', async ({ page }) => {
      // This test performs many interactions while we capture any errors that arise.
      const demo = new LogisticDemoPage(page);
      await demo.goto();

      // Generate data, add couple points, run a few steps, pause, reset, clear
      await demo.click(demo.selectors.generateSep);
      await page.waitForFunction(selector => Number(document.querySelector(selector).textContent.trim()) > 0, demo.selectors.nPoints);

      // Add a couple of points in different places
      await demo.clickCanvasAtRatio(0.2, 0.2);
      await demo.clickCanvasAtRatio(0.8, 0.8);

      // Run briefly
      await demo.click(demo.selectors.run);
      // wait for couple of epochs to accrue
      await page.waitForFunction(selector => Number(document.querySelector(selector).textContent.trim()) >= 2, demo.selectors.epochs, { timeout: 3000 }).catch(() => {});
      // Pause
      await demo.click(demo.selectors.pause);

      // Reset weights and clear points
      await demo.click(demo.selectors.resetWeights);
      await demo.click(demo.selectors.clear);

      // After this sequence, the test will complete and afterEach asserts no runtime errors were logged.
      // No explicit expect here for errors because afterEach will fail test if any existed.
      expect(true).toBe(true);
    });
  });
});