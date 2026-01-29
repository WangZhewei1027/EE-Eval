import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3dbdd30-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('K-Means Clustering — Interactive Demo (FSM validation)', () => {
  // Increase timeout for animations/interval driven updates
  test.slow();

  // Shared state for capturing console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors but do NOT modify the page.
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure initial UI has rendered by waiting for main elements
    await expect(page.locator('#canvas')).toBeVisible();
    await expect(page.locator('#runBtn')).toBeVisible();

    // Small pause to allow the app's setInterval(updateUI, 400) to run at least once
    await page.waitForTimeout(450);
  });

  test.afterEach(async ({ page }) => {
    // Optionally capture final console state for debugging
    // Assert that no uncaught page errors occurred during the test
    expect(pageErrors.length, 'No uncaught page errors should be emitted').toBe(0);

    // Also assert there were no console.error messages emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, 'No console.error / warnings should be emitted').toBe(0);
  });

  test.describe('Idle state (S0_Idle) validations', () => {
    test('Initial load initializes random data, legend and UI elements', async ({ page }) => {
      // Verify the K value label matches the range's default value (3)
      const kVal = await page.locator('#kVal').textContent();
      expect(kVal.trim()).toBe('3');

      // Verify points value label matches default pointsRange value (200)
      const pointsVal = await page.locator('#pointsVal').textContent();
      expect(pointsVal.trim()).toBe('200');

      // Verify speed label shows default from speedRange (500ms)
      const speedVal = await page.locator('#speedVal').textContent();
      expect(speedVal.trim()).toBe('500ms');

      // Iteration and changed counters should be present and numeric (initially 0)
      const iter = await page.locator('#iter').textContent();
      const changed = await page.locator('#changed').textContent();
      expect(parseInt(iter)).toBeGreaterThanOrEqual(0);
      expect(parseInt(changed)).toBeGreaterThanOrEqual(0);

      // Legend should have K items (3)
      const legendCount = await page.locator('#legend .legendItem').count();
      expect(legendCount).toBe(3);

      // Run button should be enabled (not running initially)
      const runDisabled = await page.locator('#runBtn').getAttribute('disabled');
      expect(runDisabled).toBeNull();
    });

    test('Changing range controls updates labels (ChangeKValue, ChangePointsValue, ChangeSpeedValue)', async ({ page }) => {
      // Change K range to 5
      await page.$eval('#kRange', el => { el.value = '5'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.waitForTimeout(50);
      expect((await page.locator('#kVal').textContent()).trim()).toBe('5');

      // Change points range to 50
      await page.$eval('#pointsRange', el => { el.value = '50'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.waitForTimeout(50);
      expect((await page.locator('#pointsVal').textContent()).trim()).toBe('50');

      // Change speed range to 1000 and ensure label updates and animationDelay is reflected
      await page.$eval('#speedRange', el => { el.value = '1000'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.waitForTimeout(50);
      expect((await page.locator('#speedVal').textContent()).trim()).toBe('1000ms');

      // Legend should reflect new K after changing slider (5 legend items)
      const legendCount = await page.locator('#legend .legendItem').count();
      expect(legendCount).toBe(5);
    });

    test('Add points by clicking canvas (AddPoint) does not throw and updates UI', async ({ page }) => {
      // Record SSE before click
      const sseBeforeText = await page.locator('#sse').textContent();
      const sseBefore = parseFloat(sseBeforeText);

      // Click canvas center to add a point
      const canvas = page.locator('#canvas');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      const cx = Math.floor(box.x + box.width / 2);
      const cy = Math.floor(box.y + box.height / 2);

      // Click once (no shift) - should add 1 point
      await page.mouse.click(cx, cy, { button: 'left' });

      // Wait for UI update cycle
      await page.waitForTimeout(120);

      // SSE should be a finite number (still numeric); cannot assert exact change deterministically
      const sseAfterText = await page.locator('#sse').textContent();
      const sseAfter = parseFloat(sseAfterText);
      expect(Number.isFinite(sseAfter)).toBe(true);

      // No uncaught exceptions should have been thrown by the click handler (captured in afterEach)
    });
  });

  test.describe('Initialization controls and algorithms', () => {
    test('Init centroids randomly (InitCentroidsRandom) resets iteration and assigns clusters', async ({ page }) => {
      // Clear points first to create a deterministic situation
      await page.click('#clearPts');
      await page.waitForTimeout(80);

      // After clearing, iter and changed should be 0
      expect((await page.locator('#iter').textContent()).trim()).toBe('0');
      expect((await page.locator('#changed').textContent()).trim()).toBe('0');

      // Click Init centroids (random)
      await page.click('#initBtn');
      await page.waitForTimeout(120);

      // Iteration should be 0 and changed should be a numeric value (assignment attempted)
      expect(parseInt((await page.locator('#iter').textContent()).trim())).toBeGreaterThanOrEqual(0);
      expect(parseInt((await page.locator('#changed').textContent()).trim())).toBeGreaterThanOrEqual(0);
    });

    test('Init k-means++ (InitKMeansPP) works with and without points', async ({ page }) => {
      // Ensure there are points; generate random points
      await page.click('#randomPts');
      await page.waitForTimeout(120);

      // Click k-means++ initialization
      await page.click('#initPP');
      await page.waitForTimeout(120);

      // Iteration should remain numeric and legend should reflect current K
      expect(Number.parseInt((await page.locator('#iter').textContent()).trim())).toBeGreaterThanOrEqual(0);
      const kVal = parseInt((await page.locator('#kVal').textContent()).trim());
      const legendCount = await page.locator('#legend .legendItem').count();
      expect(legendCount).toBe(kVal);
    });
  });

  test.describe('Running and Pausing (S1_Running <-> S2_Paused transitions)', () => {
    test('RunAlgorithm transitions to Running and iterates (from Idle)', async ({ page }) => {
      // Ensure a known state: clear and init centroids so centroids exist
      await page.click('#clearPts');
      await page.waitForTimeout(60);
      // Click randomPts to create points so algorithm can iterate
      await page.click('#randomPts');
      await page.waitForTimeout(80);

      // Click Run - should initialize centroids if needed and start interval
      await page.click('#runBtn');

      // Run button should become disabled while running
      await expect(page.locator('#runBtn')).toHaveAttribute('disabled', '');

      // Wait up to 3 seconds for iter to increase from 0 to >0 (algorithm running)
      const iterLocator = page.locator('#iter');
      await test.poll(async () => {
        const v = parseInt((await iterLocator.textContent()).trim());
        return v > 0 ? 'ok' : null;
      }, { timeout: 3000, message: 'iter should increase while running' });

      // No page errors were emitted during the run (checked in afterEach)
    });

    test('PauseAlgorithm transitions to Paused and stops iterating', async ({ page }) => {
      // Start running
      await page.click('#runBtn');
      await page.waitForTimeout(200);

      // Ensure running: run button should be disabled
      await expect(page.locator('#runBtn')).toHaveAttribute('disabled', '');

      // Pause
      await page.click('#pauseBtn');
      await page.waitForTimeout(80);

      // Run button should be enabled after pause
      const runDisabled = await page.locator('#runBtn').getAttribute('disabled');
      expect(runDisabled).toBeNull();

      // Record iter value
      const iterValText = (await page.locator('#iter').textContent()).trim();
      const iterVal = parseInt(iterValText);

      // Wait some time and ensure iter does not change after pause
      await page.waitForTimeout(500);
      const iterAfter = parseInt((await page.locator('#iter').textContent()).trim());
      expect(iterAfter).toBe(iterVal);
    });

    test('Resume from Paused by clicking Run (S2_Paused -> S1_Running)', async ({ page }) => {
      // Ensure paused state
      await page.click('#pauseBtn');
      await page.waitForTimeout(100);

      // Click Run to resume
      await page.click('#runBtn');
      await page.waitForTimeout(80);

      // Should be running (runBtn disabled)
      await expect(page.locator('#runBtn')).toHaveAttribute('disabled', '');

      // Confirm iterations resume by waiting for iter to increase
      const iterLocator = page.locator('#iter');
      const startIter = parseInt((await iterLocator.textContent()).trim());
      await test.poll(async () => {
        const v = parseInt((await iterLocator.textContent()).trim());
        return v > startIter ? 'ok' : null;
      }, { timeout: 2000 });

      // Pause again to leave a stable state for other tests
      await page.click('#pauseBtn');
      await page.waitForTimeout(80);
    });
  });

  test.describe('Reset and Step transitions', () => {
    test('ResetDemo while running stops algorithm and clears data (S1_Running -> S0_Idle)', async ({ page }) => {
      // Ensure running
      await page.click('#runBtn');
      await page.waitForTimeout(300);

      // Click Reset
      await page.click('#resetBtn');
      await page.waitForTimeout(120);

      // After reset: iter and changed should be 0
      expect((await page.locator('#iter').textContent()).trim()).toBe('0');
      expect((await page.locator('#changed').textContent()).trim()).toBe('0');

      // Run button should be enabled (not running)
      const runDisabled = await page.locator('#runBtn').getAttribute('disabled');
      expect(runDisabled).toBeNull();

      // Legend should still exist and reflect current K (reset does not change K)
      const kVal = parseInt((await page.locator('#kVal').textContent()).trim());
      const legendCount = await page.locator('#legend .legendItem').count();
      expect(legendCount).toBe(kVal);
    });

    test('StepAlgorithm performs single iteration when clicked (Step button)', async ({ page }) => {
      // Ensure there are points and centroids ready: generate random points and init centroids
      await page.click('#randomPts');
      await page.waitForTimeout(80);
      await page.click('#initBtn');
      await page.waitForTimeout(80);

      // Record iter, then click Step to advance exactly once
      const iterLocator = page.locator('#iter');
      const before = parseInt((await iterLocator.textContent()).trim());
      await page.click('#stepBtn');
      await page.waitForTimeout(120);
      const after = parseInt((await iterLocator.textContent()).trim());
      expect(after).toBeGreaterThanOrEqual(before + 1);
    });
  });

  test.describe('Other controls and edge cases', () => {
    test('Random points generation (GenerateRandomPoints) respects pointsRange value', async ({ page }) => {
      // Set pointsRange to a smaller value and dispatch input
      await page.$eval('#pointsRange', el => { el.value = '30'; el.dispatchEvent(new Event('input', { bubbles: true })); });
      await page.waitForTimeout(60);

      // Click Random points
      await page.click('#randomPts');
      await page.waitForTimeout(120);

      // pointsVal should reflect 30
      expect((await page.locator('#pointsVal').textContent()).trim()).toBe('30');

      // SSE should be a number and finite after generation
      const sse = parseFloat((await page.locator('#sse').textContent()).trim());
      expect(Number.isFinite(sse)).toBe(true);
    });

    test('Clear points (ClearPoints) empties points and centroids without errors', async ({ page }) => {
      // Generate random points, init centroids, then clear
      await page.click('#randomPts');
      await page.waitForTimeout(60);
      await page.click('#initBtn');
      await page.waitForTimeout(80);

      await page.click('#clearPts');
      await page.waitForTimeout(80);

      // Iteration and changed should be zero
      expect((await page.locator('#iter').textContent()).trim()).toBe('0');
      expect((await page.locator('#changed').textContent()).trim()).toBe('0');

      // SSE should be 0 because computeSSE returns 0 when centroids.length === 0
      const sseText = (await page.locator('#sse').textContent()).trim();
      const sse = parseFloat(sseText);
      expect(sse).toBeGreaterThanOrEqual(0);
    });

    test('Toggle showTrails affects drawing state and does not throw (ToggleShowTrails)', async ({ page }) => {
      // Ensure centroids exist
      await page.click('#randomPts');
      await page.waitForTimeout(60);
      await page.click('#initBtn');
      await page.waitForTimeout(80);

      // Toggle the checkbox
      const checkbox = page.locator('#showTrails');
      await checkbox.check();
      await page.waitForTimeout(60);
      await checkbox.uncheck();
      await page.waitForTimeout(60);

      // No errors should have occurred (asserted in afterEach)
    });

    test('Run when no centroids exists triggers initialization and runs without errors (edge-case)', async ({ page }) => {
      // Reset to clear everything
      await page.click('#resetBtn');
      await page.waitForTimeout(120);

      // At this point centroids should be empty. Click Run to test fallback path
      await page.click('#runBtn');
      await page.waitForTimeout(120);

      // Run button should be disabled (running)
      await expect(page.locator('#runBtn')).toHaveAttribute('disabled', '');

      // Wait for at least one iteration to occur
      const iterLocator = page.locator('#iter');
      await test.poll(async () => {
        const v = parseInt((await iterLocator.textContent()).trim());
        return v > 0 ? 'ok' : null;
      }, { timeout: 3000 });

      // Pause to cleanup
      await page.click('#pauseBtn');
      await page.waitForTimeout(80);
    });
  });
});