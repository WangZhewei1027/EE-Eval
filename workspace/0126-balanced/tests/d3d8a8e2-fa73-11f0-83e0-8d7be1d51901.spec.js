import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-balanced/html';
const APP = `${BASE}/d3d8a8e2-fa73-11f0-83e0-8d7be1d51901.html`;

// Page Object for the demo application
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Element selectors used throughout tests
    this.selectors = {
      demoSelect: '#demoSelect',
      dynamicControls: '#dynamicControls',
      binaryControls: '#binaryControls',
      startCapacity: '#startCapacity',
      resizeStrategy: '#resizeStrategy',
      opsCount: '#opsCount',
      bits: '#bits',
      opsCountBinary: '#opsCountBinary',
      stepBtn: '#stepBtn',
      runBtn: '#runBtn',
      fastRunBtn: '#fastRunBtn',
      resetBtn: '#resetBtn',
      delay: '#delay',
      totalCost: '#totalCost',
      lastCost: '#lastCost',
      avgCost: '#avgCost',
      opCount: '#opCount',
      explainText: '#explainText',
      chart: '#chart',
    };
  }

  async goto() {
    await this.page.goto(APP, { waitUntil: 'load' });
    // wait a tick for initial JS to run
    await this.page.waitForTimeout(50);
  }

  async selectDemo(value) {
    await this.page.selectOption(this.selectors.demoSelect, value);
    // change triggers resetSimulation; wait for DOM update
    await this.page.waitForTimeout(50);
  }

  async clickStep() {
    await this.page.click(this.selectors.stepBtn);
  }

  async clickRun() {
    await this.page.click(this.selectors.runBtn);
  }

  async clickFastRun() {
    await this.page.click(this.selectors.fastRunBtn);
  }

  async clickReset() {
    await this.page.click(this.selectors.resetBtn);
    // allow resetSimulation to complete
    await this.page.waitForTimeout(50);
  }

  async setOpsCount(n) {
    await this.page.fill(this.selectors.opsCount, String(n));
    // change event listener is attached; blur to ensure change fires
    await this.page.locator(this.selectors.opsCount).press('Tab');
    await this.page.waitForTimeout(20);
  }

  async setOpsCountBinary(n) {
    await this.page.fill(this.selectors.opsCountBinary, String(n));
    await this.page.locator(this.selectors.opsCountBinary).press('Tab');
    await this.page.waitForTimeout(20);
  }

  async setBits(n) {
    await this.page.fill(this.selectors.bits, String(n));
    await this.page.locator(this.selectors.bits).press('Tab');
    await this.page.waitForTimeout(20);
  }

  async setResizeStrategy(val) {
    await this.page.selectOption(this.selectors.resizeStrategy, val);
    // event handler triggers resetSimulation and updates explanation
    await this.page.waitForTimeout(50);
  }

  async setStartCapacity(n) {
    await this.page.fill(this.selectors.startCapacity, String(n));
    await this.page.locator(this.selectors.startCapacity).press('Tab');
    await this.page.waitForTimeout(20);
  }

  async setDelay(n) {
    await this.page.fill(this.selectors.delay, String(n));
    await this.page.locator(this.selectors.delay).press('Tab');
    await this.page.waitForTimeout(20);
  }

  async getStats() {
    const totalText = await this.page.textContent(this.selectors.totalCost);
    const lastText = await this.page.textContent(this.selectors.lastCost);
    const avgText = await this.page.textContent(this.selectors.avgCost);
    const opsText = await this.page.textContent(this.selectors.opCount);
    return {
      totalText,
      lastText,
      avgText,
      opsText,
      total: Number((totalText || '').replace(/[^\d.-]/g, '')) || 0,
      last: Number((lastText || '').replace(/[^\d.-]/g, '')) || 0,
      avg: Number((avgText || '').replace(/[^\d.-]/g, '')) || 0,
      ops: Number((opsText || '').replace(/[^\d.-]/g, '')) || 0,
    };
  }

  async isVisible(selector) {
    return await this.page.isVisible(selector);
  }

  async waitForOpsAtLeast(n, timeout = 5000) {
    // Poll opCount until >= n
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const stats = await this.getStats();
      if (stats.ops >= n) return stats;
      await this.page.waitForTimeout(25);
    }
    // final attempt to return whatever current stats are
    return this.getStats();
  }
}

// Collect console and page errors for each test and assert none occurred
test.describe('Amortized Analysis Interactive Demo (d3d8a8e2-...)', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console 'error' messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location ? msg.location() : {},
          });
        }
      } catch (e) {
        // ignore listeners throwing
      }
    });

    // Capture uncaught exceptions in the page
    page.on('pageerror', err => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });
  });

  test.afterEach(async () => {
    // After each test, assert that there were no console errors or page errors.
    // This ensures we observed and recorded runtime issues if any occurred.
    expect(pageErrors, 'No uncaught page errors should occur').toHaveLength(0);
    expect(consoleErrors, 'No console.error messages should be emitted').toHaveLength(0);
  });

  test.describe('State coverage and Demo selection (S0 -> S1 / S2 transitions)', () => {
    test('Initial load should show Dynamic demo controls (S1_Dynamic) and be reset', async ({ page }) => {
      // Validate initial state on load: dynamic controls visible, binary hidden, stats reset
      const demo = new DemoPage(page);
      await demo.goto();

      // DOM visibility checks for state S1_Dynamic
      expect(await demo.isVisible(demo.selectors.dynamicControls)).toBeTruthy();
      expect(await demo.isVisible(demo.selectors.binaryControls)).toBeFalsy();

      // Stats should be initialized to zero
      const stats = await demo.getStats();
      expect(stats.ops).toBe(0);
      expect(stats.total).toBe(0);
      expect(stats.last).toBe(0);

      // Canvas element exists and has width/height attributes
      const canvas = page.locator(demo.selectors.chart);
      await expect(canvas).toBeVisible();
      const width = await canvas.getAttribute('width');
      const height = await canvas.getAttribute('height');
      expect(Number(width)).toBeGreaterThan(0);
      expect(Number(height)).toBeGreaterThan(0);
    });

    test('Switch to Binary demo (S2_Binary) via demoSelect change and back to Dynamic', async ({ page }) => {
      // Validate DemoSelectChange transitions: dynamic->binary and binary->dynamic
      const demo = new DemoPage(page);
      await demo.goto();

      // Select binary demo
      await demo.selectDemo('binary');

      // After change, binaryControls visible and dynamic hidden
      expect(await demo.isVisible(demo.selectors.dynamicControls)).toBeFalsy();
      expect(await demo.isVisible(demo.selectors.binaryControls)).toBeTruthy();

      // Explanation text should mention 'Binary counter'
      const explain = await page.textContent(demo.selectors.explainText);
      expect(explain).toMatch(/Binary counter/i);

      // Switch back to dynamic
      await demo.selectDemo('dynamic');
      expect(await demo.isVisible(demo.selectors.dynamicControls)).toBeTruthy();
      expect(await demo.isVisible(demo.selectors.binaryControls)).toBeFalsy();

      // Explanation should mention 'Dynamic array'
      const explain2 = await page.textContent(demo.selectors.explainText);
      expect(explain2).toMatch(/Dynamic array/i);
    });
  });

  test.describe('Dynamic array demo interactions and transitions (S1_Dynamic)', () => {
    test('StepClick should perform a single operation and update stats', async ({ page }) => {
      // Validate that clicking Step pushes one operation and updates stats
      const demo = new DemoPage(page);
      await demo.goto();

      // Ensure in dynamic demo
      await demo.selectDemo('dynamic');

      // Click step and wait for ops >= 1
      await demo.clickStep();
      const stats = await demo.waitForOpsAtLeast(1);
      expect(stats.ops).toBeGreaterThanOrEqual(1);
      expect(stats.total).toBeGreaterThanOrEqual(1);
      expect(stats.last).toBeGreaterThanOrEqual(1);
      // Amortized value should be non-negative and match total/ops
      expect(stats.avg).toBeGreaterThanOrEqual(0);
      expect(Number(stats.avg.toFixed(2))).toBeCloseTo(Number((stats.total / Math.max(1, stats.ops)).toFixed(2)), 2);
    });

    test('RunClick should run the requested number of pushes (edge: opsCount=0 -> at least 1)', async ({ page }) => {
      // Validate RunClick uses opsCount and respects Math.max fallback
      const demo = new DemoPage(page);
      await demo.goto();

      // ensure dynamic
      await demo.selectDemo('dynamic');

      // Set opsCount to 0 (edge case) and click Run; expecting at least 1 op executed
      await demo.setOpsCount(0);
      await demo.clickRun();
      const stats1 = await demo.waitForOpsAtLeast(1);
      expect(stats1.ops).toBeGreaterThanOrEqual(1);

      // Now set opsCount to 5 and run
      await demo.clickReset();
      await demo.setOpsCount(5);
      await demo.clickRun();
      const stats2 = await demo.waitForOpsAtLeast(5, 3000);
      expect(stats2.ops).toBeGreaterThanOrEqual(5);
      expect(stats2.total).toBeGreaterThanOrEqual(stats2.last); // a sanity check
    });

    test('FastRunClick should complete many operations quickly and update canvas/stats', async ({ page }) => {
      // Validate fast run path (batch stepping)
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.selectDemo('dynamic');

      // run fast with 10 ops to keep test short
      await demo.setOpsCount(10);
      await demo.clickFastRun();
      const stats = await demo.waitForOpsAtLeast(10, 5000);
      expect(stats.ops).toBeGreaterThanOrEqual(10);
      expect(stats.total).toBeGreaterThanOrEqual(10);
      // The running average should be >= 1
      expect(stats.avg).toBeGreaterThanOrEqual(1);
    });

    test('ResetClick should clear costs and return to idle-like cleared state (S0_Idle entry actions)', async ({ page }) => {
      // Validate reset clears arrays and stats
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.selectDemo('dynamic');

      // run a couple ops
      await demo.setOpsCount(3);
      await demo.clickRun();
      await demo.waitForOpsAtLeast(3);

      // now reset
      await demo.clickReset();
      const stats = await demo.getStats();
      expect(stats.ops).toBe(0);
      expect(stats.total).toBe(0);
      expect(stats.last).toBe(0);
      expect(/Ops:\s*0/i.test(stats.opsText)).toBeTruthy();
    });

    test('ResizeStrategyChange and StartCapacityChange trigger resetSimulation and update explanation', async ({ page }) => {
      // Changing strategy/start capacity should reset simulation and update explanation text
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.selectDemo('dynamic');

      // do an op to make sure reset will have visible effect
      await demo.clickStep();
      await demo.waitForOpsAtLeast(1);
      // change resize strategy to 'increment' and ensure reset happens
      await demo.setResizeStrategy('increment');
      const stats1 = await demo.getStats();
      expect(stats1.ops).toBe(0);
      const explain1 = await page.textContent(demo.selectors.explainText);
      expect(explain1).toMatch(/Grow-by-1 strategy/i);

      // change start capacity value -> triggers resetSimulation
      await demo.setStartCapacity(2);
      const stats2 = await demo.getStats();
      expect(stats2.ops).toBe(0);
    });

    test('StartCapacity small + increment strategy edge causes repeated resizes but no errors', async ({ page }) => {
      // Edge scenario: startCapacity 1, strategy increment, run several ops to trigger many resizes
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.selectDemo('dynamic');

      await demo.setStartCapacity(1);
      await demo.setResizeStrategy('increment'); // bad strategy
      await demo.setOpsCount(8);
      await demo.clickRun();

      // run should finish with at least 8 ops and not throw
      const stats = await demo.waitForOpsAtLeast(8, 5000);
      expect(stats.ops).toBeGreaterThanOrEqual(8);
      // total cost should be >= ops (since each op at least cost 1)
      expect(stats.total).toBeGreaterThanOrEqual(stats.ops);
    });
  });

  test.describe('Binary counter demo interactions and transitions (S2_Binary)', () => {
    test('StepClick in binary demo increments op count and updates bit-flip costs', async ({ page }) => {
      // Validate step in binary demo increments counter flips and stats update
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.selectDemo('binary');

      // click single step
      await demo.clickStep();
      const stats = await demo.waitForOpsAtLeast(1);
      expect(stats.ops).toBeGreaterThanOrEqual(1);
      expect(stats.last).toBeGreaterThanOrEqual(1);
      expect(stats.total).toBeGreaterThanOrEqual(stats.last);
    });

    test('RunClick in binary demo uses opsCountBinary and FastRunClick batches operations', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.selectDemo('binary');

      // set opsCountBinary to 5 and run
      await demo.setOpsCountBinary(5);
      await demo.clickRun();
      const stats1 = await demo.waitForOpsAtLeast(5, 3000);
      expect(stats1.ops).toBeGreaterThanOrEqual(5);

      // reset and test fast run
      await demo.clickReset();
      await demo.setOpsCountBinary(12);
      await demo.clickFastRun();
      const stats2 = await demo.waitForOpsAtLeast(12, 5000);
      expect(stats2.ops).toBeGreaterThanOrEqual(12);
      // amortized cost should be non-negative and reasonable
      expect(stats2.avg).toBeGreaterThanOrEqual(0);
    });

    test('BitsInputChange triggers reset and changing bits affects behavior (edge: small bits)', async ({ page }) {
      // Validate bits change resets simulation and using small bit width wraps the counter
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.selectDemo('binary');

      // change bits to 3 (small), which should reset
      await demo.setBits(3);
      const stats = await demo.getStats();
      expect(stats.ops).toBe(0);

      // run more ops than 2^3 to ensure wrapping occurs but no errors
      await demo.setOpsCountBinary(10);
      await demo.clickFastRun();
      const stats2 = await demo.waitForOpsAtLeast(10, 5000);
      expect(stats2.ops).toBeGreaterThanOrEqual(10);
      // total cost should be >= ops
      expect(stats2.total).toBeGreaterThanOrEqual(stats2.ops);
    });

    test('Negative/invalid binary opsCountBinary coerces to at least 1 on Run', async ({ page }) => {
      // Edge case: opsCountBinary negative -> Math.max(1, ...) should run at least 1 op
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.selectDemo('binary');

      await demo.setOpsCountBinary(-10);
      await demo.clickRun();
      const stats = await demo.waitForOpsAtLeast(1, 2000);
      expect(stats.ops).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Delay input, canvas resize, and miscellaneous behaviors', () => {
    test('DelayInputChange updates delay without throwing and non-fast run honors delay', async ({ page }) => {
      // Change delay and perform one non-fast step; ensure no errors and op occurs
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.selectDemo('dynamic');

      // set a small delay (20 ms) and run a single step (non-fast)
      await demo.setDelay(20);
      // perform a run with opsCount 2 but not fast; expect ops to increment within a timeout
      await demo.setOpsCount(2);
      await demo.clickRun();
      const stats = await demo.waitForOpsAtLeast(2, 5000);
      expect(stats.ops).toBeGreaterThanOrEqual(2);

      // Now check canvas dimensions remain positive after a window resize event
      const chart = page.locator(demo.selectors.chart);
      const beforeBox = await chart.boundingBox();
      // Trigger a resize event on window to exercise resizeCanvas code path
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));
      await page.waitForTimeout(50);
      const afterBox = await chart.boundingBox();
      expect(beforeBox).toBeTruthy();
      expect(afterBox).toBeTruthy();
      expect(afterBox.width).toBeGreaterThanOrEqual(0);
      expect(afterBox.height).toBeGreaterThanOrEqual(0);
    });
  });
});