import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e934fb12-d360-11f0-a097-ffdd56c22ef4.html';

/**
 * Page Object Model for the K-Means demo page.
 * Encapsulates common interactions and state queries.
 */
class KMeansPage {
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#plot');
    this.initBtn = page.locator('#initBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.runBtn = page.locator('#runBtn');
    this.stopBtn = page.locator('#stopBtn');
    this.randomBtn = page.locator('#randomBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.nPointsInput = page.locator('#nPoints');
    this.kInput = page.locator('#k');
    this.speedInput = page.locator('#speed');
    this.nPointsVal = page.locator('#nPointsVal');
    this.kVal = page.locator('#kVal');
    this.speedVal = page.locator('#speedVal');
    this.addToggle = page.locator('#addToggle');
    this.dragToggle = page.locator('#dragToggle');
    this.iterElem = page.locator('#iter');
    this.changedElem = page.locator('#changed');
    this.sseElem = page.locator('#sse');
    this.emptyElem = page.locator('#empty');
    this.legend = page.locator('#legend');
  }

  async clickInitialize() { await this.initBtn.click(); }
  async clickStep() { await this.stepBtn.click(); }
  async clickRun() { await this.runBtn.click(); }
  async clickStop() { await this.stopBtn.click(); }
  async clickRandom() { await this.randomBtn.click(); }
  async clickClear() { await this.clearBtn.click(); }
  async clickReset() { await this.resetBtn.click(); }

  async getText(selector) { return this.page.locator(selector).innerText(); }

  async getPointsCount() {
    return await this.page.evaluate(() => Array.isArray(window._kmeansDemo?.points) ? window._kmeansDemo.points.length : (window.points ? window.points.length : 0));
  }
  async getCentroidsCount() {
    return await this.page.evaluate(() => Array.isArray(window._kmeansDemo?.centroids) ? window._kmeansDemo.centroids.length : (window.centroids ? window.centroids.length : 0));
  }
  async getIteration() {
    return Number(await this.iterElem.innerText());
  }
  async getChanged() {
    const t = await this.changedElem.innerText();
    return t === '—' ? null : Number(t);
  }
  async getSSE() {
    const t = await this.sseElem.innerText();
    return t === '—' ? null : Number(t);
  }
  async getEmpty() {
    const t = await this.emptyElem.innerText();
    return t === '—' ? null : Number(t);
  }
  async getLegendCount() {
    return await this.legend.locator('.legend-item').count();
  }
  async getRunButtonDisabled() {
    return await this.page.evaluate(() => document.getElementById('runBtn').disabled);
  }
  async getStopButtonDisabled() {
    return await this.page.evaluate(() => document.getElementById('stopBtn').disabled);
  }
  async getNPointsVal() {
    return Number(await this.nPointsVal.innerText());
  }
  async getKVal() {
    return Number(await this.kVal.innerText());
  }
  async getSpeedVal() {
    return Number(await this.speedVal.innerText());
  }

  // Helper: click canvas at offset ratio (0..1 for x and y)
  async clickCanvasAtRatio(xRatio = 0.5, yRatio = 0.5, options = {}) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    const x = box.x + box.width * xRatio;
    const y = box.y + box.height * yRatio;
    await this.page.mouse.click(x, y, options);
  }

  // Helper: mousedown/move/mouseup to simulate drag on canvas
  async dragOnCanvas(fromRatio, toRatio, steps = 5) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    const startX = box.x + box.width * fromRatio.x;
    const startY = box.y + box.height * fromRatio.y;
    const endX = box.x + box.width * toRatio.x;
    const endY = box.y + box.height * toRatio.y;
    await this.page.mouse.move(startX, startY);
    await this.page.mouse.down();
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await this.page.mouse.move(startX + (endX - startX) * t, startY + (endY - startY) * t);
      // small delay between moves to mimic human drag
      await this.page.waitForTimeout(20);
    }
    await this.page.mouse.up();
  }

  // Read the closest point coordinates in canvas pixel space for a given point index (useful for verifying drag)
  async getPointCanvasPosition(index = 0) {
    return this.page.evaluate((idx) => {
      // returns pixel coordinates according to toCanvas helper in page
      const canvas = document.getElementById('plot');
      const padding = 30;
      function toCanvasLocal(p){
        return {cx: padding + p.x*(canvas.width-2*padding), cy: padding + (1-p.y)*(canvas.height-2*padding)};
      }
      const p = (window.points && window.points[idx]) ? window.points[idx] : null;
      if (!p) return null;
      return toCanvasLocal(p);
    }, index);
  }
}

/**
 * Global setup for each test: capture console messages and page errors.
 * We assert at the end of the suite that there are no uncaught errors in pageError array.
 */
test.describe('K-Means Clustering Interactive Demo (FSM validation)', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection (info, warning, error)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait a bit for initial JS to run (generateData, renderLegend, fixCanvasSize)
    await page.waitForTimeout(200);
  });

  test.afterEach(async ({ page }) => {
    // leave hooks — no navigation required
    // make sure any running intervals are stopped to avoid background activity interfering with other tests
    await page.evaluate(() => {
      if (window._kmeansDemo && typeof window._kmeansDemo.stop === 'function') {
        try { window._kmeansDemo.stop(); } catch (e) { /* ignore */ }
      }
    });
  });

  // After all tests in this describe block, assert there were no uncaught page errors
  test.afterAll(async () => {
    // It's important to assert that the page didn't throw unexpected runtime errors
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    // Also assert there were no console.error entries
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test.describe('Initial load and Idle state (S0_Idle)', () => {
    test('Page loads and initial UI is rendered (renderPage conceptually) and initial data generated', async ({ page }) => {
      const app = new KMeansPage(page);

      // Validate key UI elements exist
      await expect(page.locator('#plot')).toBeVisible();
      await expect(app.initBtn).toBeVisible();
      await expect(app.stepBtn).toBeVisible();
      await expect(app.runBtn).toBeVisible();
      await expect(app.stopBtn).toBeVisible();

      // Validate default control values reflect initial state
      const nPoints = await app.getNPointsVal();
      const kVal = await app.getKVal();
      const speed = await app.getSpeedVal();
      expect(nPoints).toBe(150);
      expect(kVal).toBe(4);
      expect(speed).toBe(250);

      // Points should be generated initially (generateData called in init)
      const pointsCount = await app.getPointsCount();
      expect(pointsCount).toBeGreaterThanOrEqual(10); // nPoints minimum is 10
      expect(pointsCount).toBeGreaterThanOrEqual(100); // default 150, allow some leeway

      // Stop button should be disabled initially (S0 Idle evidence)
      const stopDisabled = await app.getStopButtonDisabled();
      expect(stopDisabled).toBe(true);

      // Legend initial rendering should show k entries
      const legendCount = await app.getLegendCount();
      expect(legendCount).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Initialization and Stepping (S1_Initialized -> S4_Stepped)', () => {
    test('Click Initialize creates centroids and updates stats (S1_Initialized)', async ({ page }) => {
      const app = new KMeansPage(page);

      // Ensure we start from Idle: centroids should be empty (initial generateData sets centroids later by initialization only)
      const beforeCentroids = await app.getCentroidsCount();
      // It might be 0 initially (expected)
      // Click initialize
      await app.clickInitialize();

      // Wait until centroids equal K (k input). Use waitForFunction to handle async DOM updates
      await page.waitForFunction(() => {
        const k = Number(document.getElementById('k').value);
        return (window.centroids && window.centroids.length === k) || (window._kmeansDemo && window._kmeansDemo.centroids && window._kmeansDemo.centroids.length === k);
      }, {}, { timeout: 2000 });

      const centroidsCount = await app.getCentroidsCount();
      const expectedK = await app.getKVal();
      expect(centroidsCount).toBe(expectedK);

      // After initialization stats should be shown (changed maybe > 0)
      const changed = await app.getChanged();
      expect(changed === null ? true : changed >= 0).toBe(true);

      // SSE should be a finite number
      const sse = await app.getSSE();
      expect(sse === null ? true : Number.isFinite(sse)).toBe(true);
    });

    test('Click Step increments iteration (S4_Stepped)', async ({ page }) => {
      const app = new KMeansPage(page);

      // Ensure initialized
      await app.clickInitialize();
      await page.waitForTimeout(100);

      const iterBefore = await app.getIteration();
      await app.clickStep();

      // Wait until iteration increments by 1 (or at least changes)
      await page.waitForFunction((before) => {
        const it = Number(document.getElementById('iter').textContent);
        return it > before;
      }, iterBefore, { timeout: 1000 });

      const iterAfter = await app.getIteration();
      expect(iterAfter).toBeGreaterThan(iterBefore);
    });
  });

  test.describe('Run and Stop behavior (S2_Running -> S3_Stopped)', () => {
    test('Run starts the algorithm loop and toggles Run/Stop buttons (S2_Running)', async ({ page }) => {
      const app = new KMeansPage(page);

      // Initialize centroids to ensure run has something to iterate
      await app.clickInitialize();

      // Click Run
      await app.clickRun();

      // Immediately the UI should disable the Run button and enable Stop
      await page.waitForFunction(() => document.getElementById('runBtn').disabled === true, {}, { timeout: 500 });
      const runDisabled = await app.getRunButtonDisabled();
      const stopDisabled = await app.getStopButtonDisabled();
      expect(runDisabled).toBe(true);
      expect(stopDisabled).toBe(false);

      // Let it run for a short while then stop
      await page.waitForTimeout(300);
      await app.clickStop();

      // After stopping, Run should be enabled again and Stop disabled
      await page.waitForFunction(() => document.getElementById('runBtn').disabled === false && document.getElementById('stopBtn').disabled === true, {}, { timeout: 1000 });
      const runDisabledAfter = await app.getRunButtonDisabled();
      const stopDisabledAfter = await app.getStopButtonDisabled();
      expect(runDisabledAfter).toBe(false);
      expect(stopDisabledAfter).toBe(true);
    });

    test('Changing speed while running resets the interval without throwing', async ({ page }) => {
      const app = new KMeansPage(page);

      await app.clickInitialize();
      await app.clickRun();

      // change speed while running
      await app.speedInput.fill('100');
      await app.speedInput.evaluate((el) => el.dispatchEvent(new Event('input', { bubbles: true })));

      // Expect no page errors and that run/stop buttons remain in the running state (run disabled)
      await page.waitForTimeout(150);
      const runDisabled = await app.getRunButtonDisabled();
      const stopDisabled = await app.getStopButtonDisabled();
      expect(runDisabled).toBe(true);
      expect(stopDisabled).toBe(false);

      // Stop to clean up
      await app.clickStop();
    });
  });

  test.describe('Data manipulation controls (S5_DataRandomized, S6_PointsCleared, S7_Reset)', () => {
    test('Randomize Data resets centroids and iteration (S5_DataRandomized)', async ({ page }) => {
      const app = new KMeansPage(page);

      // Ensure there are centroids first by initializing
      await app.clickInitialize();
      await page.waitForTimeout(50);

      // Click Randomize
      await app.clickRandom();

      // After randomize: centroids should be cleared (length 0), iteration 0, and points length should equal nPoints input
      await page.waitForTimeout(100);
      const centroidsCount = await app.getCentroidsCount();
      const iter = await app.getIteration();
      const pointsCount = await app.getPointsCount();
      const nPoints = await app.getNPointsVal();

      expect(centroidsCount === 0 || centroidsCount === null).toBeTruthy();
      expect(iter).toBe(0);
      expect(pointsCount).toBe(nPoints);
    });

    test('Clear Points clears all points and centroids (S6_PointsCleared)', async ({ page }) => {
      const app = new KMeansPage(page);

      // Click Clear
      await app.clickClear();

      // After clear, points and centroids should be empty, iteration zero
      await page.waitForTimeout(100);
      const pointsCount = await app.getPointsCount();
      const centroidsCount = await app.getCentroidsCount();
      const iter = await app.getIteration();

      expect(pointsCount).toBe(0);
      expect(centroidsCount === 0 || centroidsCount === null).toBeTruthy();
      expect(iter).toBe(0);
    });

    test('Reset All restores default controls and regenerates default data (S7_Reset)', async ({ page }) => {
      const app = new KMeansPage(page);

      // Change controls away from defaults
      await app.nPointsInput.fill('300');
      await app.nPointsInput.evaluate((el) => el.dispatchEvent(new Event('input', { bubbles: true })));
      await app.kInput.fill('6');
      await app.kInput.evaluate((el) => el.dispatchEvent(new Event('input', { bubbles: true })));
      await app.speedInput.fill('800');
      await app.speedInput.evaluate((el) => el.dispatchEvent(new Event('input', { bubbles: true })));
      // Confirm they changed
      const changedN = await app.getNPointsVal();
      expect(changedN).toBe(300);

      // Click Reset
      await app.clickReset();

      // Wait for reset effects
      await page.waitForTimeout(200);
      const nAfter = await app.getNPointsVal();
      const kAfter = await app.getKVal();
      const speedAfter = await app.getSpeedVal();
      const pointsCount = await app.getPointsCount();

      expect(nAfter).toBe(150);
      expect(kAfter).toBe(4);
      expect(speedAfter).toBe(250);
      expect(pointsCount).toBeGreaterThanOrEqual(100);
      // centroids should be empty right after reset (generateData called but centroids cleared in reset)
      const centroidsCount = await app.getCentroidsCount();
      expect(centroidsCount === 0 || centroidsCount === null).toBeTruthy();
    });
  });

  test.describe('Canvas interactions: Add, Drag, Double-click removal (edge cases & interaction)', () => {
    test('Add Points mode allows adding a point by clicking on canvas', async ({ page }) => {
      const app = new KMeansPage(page);

      // Count before adding
      const before = await app.getPointsCount();

      // Enable Add Points toggle
      const isChecked = await app.addToggle.evaluate((el) => el.checked);
      if (!isChecked) {
        await app.addToggle.click();
      }

      // Click at center of canvas to add a point
      await app.clickCanvasAtRatio(0.5, 0.5);

      // Wait briefly and assert points increased by 1
      await page.waitForTimeout(100);
      const after = await app.getPointsCount();
      expect(after).toBe(before + 1);
    });

    test('Dragging a newly added point moves it (drag behavior)', async ({ page }) => {
      const app = new KMeansPage(page);

      // Ensure Add Points is enabled and Drag Points is enabled
      if (!(await app.addToggle.evaluate(el => el.checked))) {
        await app.addToggle.click();
      }
      if (!(await app.dragToggle.evaluate(el => el.checked))) {
        await app.dragToggle.click();
      }

      // Add a point at center
      await app.clickCanvasAtRatio(0.5, 0.5);
      await page.waitForTimeout(50);
      const total = await app.getPointsCount();
      expect(total).toBeGreaterThan(0);

      // The newly added point should be the last point; capture its canvas position
      const lastIndex = total - 1;
      const beforePos = await app.getPointCanvasPosition(lastIndex);
      expect(beforePos).not.toBeNull();

      // Disable Add Points so that mouse down will attempt drag rather than add
      if ((await app.addToggle.evaluate(el => el.checked))) {
        await app.addToggle.click();
      }

      // Perform drag by moving the mouse from the point to a new location
      // Convert current canvas pos to ratio coordinates to drag slightly
      const box = await app.canvas.boundingBox();
      const startRatio = { x: (beforePos.cx - box.x) / box.width, y: (beforePos.cy - box.y) / box.height };
      const endRatio = { x: Math.min(0.95, startRatio.x + 0.15), y: Math.max(0.05, startRatio.y - 0.15) };

      // Execute drag
      await app.dragOnCanvas(startRatio, endRatio, 6);

      // Wait shortly and then check that the point moved (pixel coords changed)
      await page.waitForTimeout(100);
      const afterPos = await app.getPointCanvasPosition(lastIndex);
      expect(afterPos).not.toBeNull();
      // Some movement should be observed
      const moved = Math.hypot(afterPos.cx - beforePos.cx, afterPos.cy - beforePos.cy);
      expect(moved).toBeGreaterThan(2); // moved a few pixels
    });

    test('Double-click removes a nearby point', async ({ page }) => {
      const app = new KMeansPage(page);

      // Ensure Add Points enabled to create a point at center
      if (!(await app.addToggle.evaluate(el => el.checked))) {
        await app.addToggle.click();
      }

      // Add a point at center
      await app.clickCanvasAtRatio(0.6, 0.6);
      await page.waitForTimeout(50);

      // Count points
      const before = await app.getPointsCount();
      expect(before).toBeGreaterThan(0);

      // Double-click at the same location to remove
      const box = await app.canvas.boundingBox();
      const x = box.x + box.width * 0.6;
      const y = box.y + box.height * 0.6;
      await page.mouse.dblclick(x, y);

      // Wait and confirm one less point
      await page.waitForTimeout(100);
      const after = await app.getPointsCount();
      expect(after).toBe(before - 1);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Initialize with K larger than points gracefully handles empty clusters (no exceptions)', async ({ page }) => {
      const app = new KMeansPage(page);

      // Clear points to create potential edge-case for empty clusters
      await app.clickClear();
      await page.waitForTimeout(50);

      // Set k input to a large number (beyond number of points)
      await app.kInput.fill('12');
      await app.kInput.evaluate(el => el.dispatchEvent(new Event('input', { bubbles: true })));
      // Click initialize - code should handle empty points gracefully (no uncaught exceptions)
      await app.clickInitialize();

      // Wait a bit for any potential errors to surface
      await page.waitForTimeout(150);

      // Verify there are no page errors (these will be asserted in afterAll, but also assert here)
      // Ensure centroids is an array even if reinitialized
      const centroidsCount = await app.getCentroidsCount();
      expect(Array.isArray(await page.evaluate(() => window.centroids || window._kmeansDemo && window._kmeansDemo.centroids))).toBeTruthy();
      expect(centroidsCount >= 0).toBeTruthy();
    });

    test('Keyboard shortcuts (space for step, r for regenerate) do not throw and behave as intended', async ({ page }) => {
      const app = new KMeansPage(page);

      // Save iteration count
      const iterBefore = await app.getIteration();

      // Press Space to step (should call stepAndDraw)
      await page.keyboard.press('Space');
      await page.waitForTimeout(150);
      const iterAfter = await app.getIteration();
      expect(iterAfter).toBeGreaterThanOrEqual(iterBefore);

      // Press 'r' to regenerate data
      const beforePoints = await app.getPointsCount();
      await page.keyboard.press('r');
      await page.waitForTimeout(150);
      const afterPoints = await app.getPointsCount();
      // Points should be regenerated and likely equal to nPoints input
      expect(afterPoints).toBeGreaterThanOrEqual(10);
      expect(afterPoints).not.toBeNull();
    });
  });
});