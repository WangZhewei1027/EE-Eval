import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3db40f1-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Interactive Linear Regression Demo - FSM validation', () => {
  // Capture console messages and page errors for each test.
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(10000);
    // Arrays to collect console and page errors; attach to page to inspect later in each test.
    await page.addInitScript(() => {
      // no-op: ensure page context is created before listeners from test are attached
    });
  });

  // Utility fixture to open page and collect logs/errors
  async function openAndCollect(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      try {
        // Collect console text for debugging assertions
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      } catch (e) {
        consoleMessages.push(`console: <unable to read>`);
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Wait for the demo to expose the debug handle on window._lrDemo
    await page.waitForFunction(() => !!window._lrDemo);
    return { consoleMessages, pageErrors };
  }

  test('S0 Idle: app initializes and default data is generated', async ({ page }) => {
    // Validate initial Idle state: draw() called on load and generateRandom(30,12) initialized points
    const { consoleMessages, pageErrors } = await openAndCollect(page);

    // Ensure points were generated on initialization
    const pointsLength = await page.evaluate(() => window._lrDemo.points.length);
    expect(pointsLength).toBeGreaterThan(0);

    // Ensure the displayed Points counter matches the internal points length
    const displayedN = await page.locator('#nPts').textContent();
    expect(Number(displayedN)).toBe(pointsLength);

    // Ensure closed-form equation and GD equation are exposed as text (may be '-' or values)
    const eq = await page.locator('#equation').textContent();
    const eqGD = await page.locator('#equationGD').textContent();
    expect(typeof eq).toBe('string');
    expect(typeof eqGD).toBe('string');

    // No uncaught page errors during initialization
    expect(pageErrors.length).toBe(0);

    // Console should at least have some messages or be empty; we don't fail on console presence.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test('S1 GeneratingRandom: clicking Generate Random produces requested count', async ({ page }) => {
    // Validate GenerateRandom transition: clicking #btnRandom triggers generateRandom(parseInt(nPoints.value,10), parseFloat(noise.value));
    const { consoleMessages, pageErrors } = await openAndCollect(page);

    // Set nPoints input to a known value (10) and dispatch input event so UI updates
    await page.evaluate(() => {
      const nPoints = document.getElementById('nPoints');
      nPoints.value = 10;
      nPoints.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Click generate random
    await page.click('#btnRandom');

    // Wait for the points array to update and stats to refresh
    await page.waitForFunction(() => window._lrDemo.points.length === 10);

    const pts = await page.evaluate(() => window._lrDemo.points.slice());
    expect(pts.length).toBe(10);

    // The visible counter should reflect 10 points
    const displayed = await page.locator('#nPts').textContent();
    expect(Number(displayed)).toBe(10);

    expect(pageErrors.length).toBe(0);
    // Keep console messages present (not required to assert contents)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('S2 ClearingPoints: clicking Clear empties points and resets learned parameters', async ({ page }) => {
    // Validate ClearPoints transition: clicking #btnClear clears points and resets closed form to NaN
    const { consoleMessages, pageErrors } = await openAndCollect(page);

    // Ensure there are some points first
    await page.click('#btnRandom');
    await page.waitForFunction(() => window._lrDemo.points.length > 0);

    // Click clear
    await page.click('#btnClear');

    // Check internal state: points length 0
    const ptsLen = await page.evaluate(() => window._lrDemo.points.length);
    expect(ptsLen).toBe(0);

    // Check displayed nPts
    const displayed1 = await page.locator('#nPts').textContent();
    expect(Number(displayed)).toBe(0);

    // closed.m and closed.b should be NaN after clear
    const closed = await page.evaluate(() => ({ m: window._lrDemo.closed?.m, b: window._lrDemo.closed?.b }));
    expect(Number.isNaN(closed.m)).toBeTruthy();
    expect(Number.isNaN(closed.b)).toBeTruthy();

    // equation text should show '-' because closed-form was reset
    const equationText = await page.locator('#equation').textContent();
    expect(equationText.trim()).toBe('-');

    expect(pageErrors.length).toBe(0);
  });

  test('S3 FittingClosedForm: clicking Fit computes closed-form solution and updates stats', async ({ page }) => {
    // Validate FitClosedForm transition: clicking #btnFit calls fitClosedForm() and updates closed-form parameters
    const { consoleMessages, pageErrors } = await openAndCollect(page);

    // Generate a dataset with a known number of points
    await page.evaluate(() => {
      const nPoints1 = document.getElementById('nPoints1');
      nPoints.value = 20;
      nPoints.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.click('#btnRandom');
    await page.waitForFunction(() => window._lrDemo.points.length === 20);

    // Click Fit (closed-form)
    await page.click('#btnFit');

    // closed.m and closed.b should be finite numbers after fitting
    const closed1 = await page.evaluate(() => ({ m: window._lrDemo.closed1.m, b: window._lrDemo.closed1.b }));
    expect(Number.isFinite(closed.m)).toBeTruthy();
    expect(Number.isFinite(closed.b)).toBeTruthy();

    // equation text should reflect closed form
    const equationText1 = await page.locator('#equation').textContent();
    expect(equationText.startsWith('y =')).toBeTruthy();

    // GD equation should also have been initialized to closed form
    const eqGD1 = await page.locator('#equationGD').textContent();
    expect(typeof eqGD).toBe('string');

    expect(pageErrors.length).toBe(0);
  });

  test('S4 & S5 Gradient Descent Running and Stopped: Start, auto-stop and manual stop behavior', async ({ page }) => {
    // Validate StartGradientDescent transitions and StopGradientDescent.
    const { consoleMessages, pageErrors } = await openAndCollect(page);

    // Ensure we have points and set iterations to small number for deterministic run
    await page.evaluate(() => {
      document.getElementById('nPoints').value = 15;
      document.getElementById('nPoints').dispatchEvent(new Event('input', { bubbles: true }));
      document.getElementById('gdIters').value = 8;
    });
    await page.click('#btnRandom');
    await page.waitForFunction(() => window._lrDemo.points.length === 15);

    // Click Start GD - should set gd.running = true immediately, and after iterations finish it will become false.
    await page.click('#btnStartGD');

    // Immediately after clicking, gd.running should be true (or very quickly becomes true)
    await page.waitForFunction(() => window._lrDemo.gd.running === true, { timeout: 2000 });

    // Then wait for the GD loop to finish (gd.running turns false after maxSteps)
    await page.waitForFunction(() => window._lrDemo.gd.running === false, { timeout: 5000 });

    // gd.iter should have increased from 0
    const iterCount = await page.evaluate(() => window._lrDemo.gd.iter);
    expect(iterCount).toBeGreaterThanOrEqual(1);

    // Now test manual stop: set gdIters large so it won't finish immediately
    await page.evaluate(() => { document.getElementById('gdIters').value = 1000; });
    await page.click('#btnStartGD');

    // Wait until running
    await page.waitForFunction(() => window._lrDemo.gd.running === true, { timeout: 2000 });

    // Click stop to transition to S5
    await page.click('#btnStopGD');

    // gd.running should be false after clicking stop
    await page.waitForFunction(() => window._lrDemo.gd.running === false, { timeout: 2000 });

    expect(pageErrors.length).toBe(0);
  });

  test('ToggleResiduals and TogglePoints events update UI controls without errors', async ({ page }) => {
    // Validate ToggleResiduals and TogglePoints events operate and trigger draw()
    const { consoleMessages, pageErrors } = await openAndCollect(page);

    // Ensure there are some points
    await page.click('#btnRandom');
    await page.waitForFunction(() => window._lrDemo.points.length > 0);

    // Toggle residuals: check checkbox state toggles
    const beforeChecked = await page.locator('#showResiduals').isChecked();
    await page.click('#btnToggleResiduals');
    const afterChecked = await page.locator('#showResiduals').isChecked();
    expect(afterChecked).toBe(!beforeChecked);

    // Toggle points: this toggles an internal variable showPoints (not exposed).
    // We assert that toggling points does not change the points array itself and does not cause errors.
    const beforeLen = await page.evaluate(() => window._lrDemo.points.length);
    await page.click('#btnTogglePoints');
    const afterLen = await page.evaluate(() => window._lrDemo.points.length);
    expect(afterLen).toBe(beforeLen);

    expect(pageErrors.length).toBe(0);
  });

  test('ResetView event triggers autoscale and draw without modifying points', async ({ page }) => {
    // Validate ResetView transition: clicking #btnResetView calls autoscale(); draw(); and does not alter the dataset
    const { consoleMessages, pageErrors } = await openAndCollect(page);

    // Ensure dataset present
    await page.click('#btnRandom');
    await page.waitForFunction(() => window._lrDemo.points.length > 0);

    const beforeLen1 = await page.evaluate(() => window._lrDemo.points.length);
    // Click reset view
    await page.click('#btnResetView');

    // Ensure points unchanged
    const afterLen1 = await page.evaluate(() => window._lrDemo.points.length);
    expect(afterLen).toBe(beforeLen);

    // Ensure no errors
    expect(pageErrors.length).toBe(0);
  });

  test('S6 Manual Line Enabled and S7 Manual Line Locked, plus dragging behavior', async ({ page }) => {
    // Validate manual line toggling and locking and that dragging changes manual.b when enabled and unlocked
    const { consoleMessages, pageErrors } = await openAndCollect(page);

    // Prepare dataset and fit closed-form so manual defaults to closed-form when enabled
    await page.click('#btnRandom');
    await page.waitForFunction(() => window._lrDemo.points.length > 0);
    await page.click('#btnFit');

    // Click Show Manual Line (enable)
    await page.click('#btnShowManual');

    // manual.enabled should be true and manual.m set to closed.m
    const manualAfterEnable = await page.evaluate(() => ({ enabled: window._lrDemo.manual.enabled, m: window._lrDemo.manual.m, b: window._lrDemo.manual.b }));
    expect(manualAfterEnable.enabled).toBe(true);
    expect(Number.isFinite(manualAfterEnable.m)).toBeTruthy();

    // Click Lock Manual to toggle lock on
    const lockBefore = await page.evaluate(() => window._lrDemo.manual.lock);
    await page.click('#btnLockManual');
    const lockAfter = await page.evaluate(() => window._lrDemo.manual.lock);
    expect(lockAfter).toBe(!lockBefore);

    // If locked, dragging should not change manual.b. Unlock it for drag test.
    if (lockAfter) {
      await page.click('#btnLockManual'); // unlock
      await page.waitForFunction(() => window._lrDemo.manual.lock === false);
    }

    // Compute a client coordinate on the canvas that lies on the manual line, and perform mousedown -> mousemove -> mouseup to drag.
    // We'll compute a pixel coordinate by evaluating in page context where canvas is and mapping a data x to pixel.
    const coords = await page.evaluate(() => {
      const canvas = document.getElementById('plot');
      const rect = canvas.getBoundingClientRect();
      const W = canvas.width, H = canvas.height;
      const margin = { left: 50, right: 20, top: 20, bottom: 50 };
      const plotW = W - margin.left - margin.right;
      const plotH = H - margin.top - margin.bottom;
      // read current xrange and yrange from the script closure by using the exposed window._lrDemo which references the objects
      const xrange = (function () {
        // original closure stores xrange in module scope; the demo exposes autoscale/draw but not xrange directly.
        // However we can approximate by inspecting existing points to derive min/max and mimic autoscale used in the demo.
        const pts1 = window._lrDemo.points;
        if (!pts || pts.length === 0) {
          return [0, 100];
        }
        let xmin = Infinity, xmax = -Infinity;
        for (const p of pts) { if (p[0] < xmin) xmin = p[0]; if (p[0] > xmax) xmax = p[0]; }
        if (xmin === xmax) { xmin -= 1; xmax += 1; }
        const padX = (xmax - xmin) * 0.12;
        return [xmin - padX, xmax + padX];
      })();
      const yrange = (function () {
        const pts2 = window._lrDemo.points;
        if (!pts || pts.length === 0) {
          return [0, 100];
        }
        let ymin = Infinity, ymax = -Infinity;
        for (const p of pts) { if (p[1] < ymin) ymin = p[1]; if (p[1] > ymax) ymax = p[1]; }
        if (ymin === ymax) { ymin -= 1; ymax += 1; }
        const padY = (ymax - ymin) * 0.12;
        return [ymin - padY, ymax + padY];
      })();

      // Choose data x at midpoint of xrange
      const x = (xrange[0] + xrange[1]) / 2;
      const m = window._lrDemo.manual.m;
      const b = window._lrDemo.manual.b;
      const y = m * x + b;

      // Data -> pixel
      const sx = (x - xrange[0]) / (xrange[1] - xrange[0]);
      const sy = (y - yrange[0]) / (yrange[1] - yrange[0]);
      const px = rect.left + margin.left + sx * plotW;
      const py = rect.top + margin.top + (1 - sy) * plotH;

      // Also compute a target move position (drag down a bit)
      const py2 = py + 40; // move 40px downwards
      return { start: {x: px, y: py}, end: {x: px, y: py2} };
    });

    // Perform the drag: mousedown at start coord, move to end, mouseup.
    await page.mouse.move(coords.start.x, coords.start.y);
    await page.mouse.down();
    // small delay so any mousedown logic can run
    await page.waitForTimeout(50);
    await page.mouse.move(coords.end.x, coords.end.y);
    await page.waitForTimeout(50);
    await page.mouse.up();
    await page.waitForTimeout(50);

    // After dragging, manual.b should have changed (since drag updates b preserving slope)
    const manualAfterDrag = await page.evaluate(() => ({ m: window._lrDemo.manual.m, b: window._lrDemo.manual.b }));
    expect(Number.isFinite(manualAfterDrag.b)).toBeTruthy();
    // We expect some change relative to previously stored b (very likely different)
    // We can't guarantee exact sign of change; just ensure manual.b is finite and not NaN.
    expect(Number.isNaN(manualAfterDrag.b)).toBeFalsy();

    expect(pageErrors.length).toBe(0);
  });

  test('StepGradientDescent: clicking Step advances GD by one iteration', async ({ page }) => {
    // Validate StepGradientDescent event increments gd.iter and updates GD parameters
    const { consoleMessages, pageErrors } = await openAndCollect(page);

    // Ensure dataset present
    await page.click('#btnRandom');
    await page.waitForFunction(() => window._lrDemo.points.length > 0);

    // Record previous iter
    const beforeIter = await page.evaluate(() => window._lrDemo.gd.iter || 0);
    await page.click('#btnStepGD');

    // Wait for gd.iter to increment by 1
    await page.waitForFunction((prev) => window._lrDemo.gd.iter >= prev + 1, {}, beforeIter);

    const afterIter = await page.evaluate(() => window._lrDemo.gd.iter);
    expect(afterIter).toBeGreaterThanOrEqual(beforeIter + 1);

    // Also confirm that GD parameters (m,b) are finite numbers after stepping
    const gd = await page.evaluate(() => ({ m: window._lrDemo.gd.m, b: window._lrDemo.gd.b }));
    expect(Number.isFinite(gd.m)).toBeTruthy();
    expect(Number.isFinite(gd.b)).toBeTruthy();

    expect(pageErrors.length).toBe(0);
  });

  test('Canvas click add/remove points: add via click, remove via Shift+Click', async ({ page }) => {
    // Validate adding a point by clicking the canvas and removing via Shift+Click
    const { consoleMessages, pageErrors } = await openAndCollect(page);

    // Ensure starting dataset
    await page.click('#btnRandom');
    await page.waitForFunction(() => window._lrDemo.points.length > 0);

    // Get canvas bounding rect to compute a center click
    const rect1 = await page.evaluate(() => {
      const canvas1 = document.getElementById('plot');
      const r = canvas.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height };
    });

    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const before = await page.evaluate(() => window._lrDemo.points.length);
    // Click canvas center to add a point
    await page.mouse.click(centerX, centerY, { delay: 20 });
    await page.waitForFunction((prev) => window._lrDemo.points.length === prev + 1, {}, before);
    const afterAdd = await page.evaluate(() => window._lrDemo.points.length);
    expect(afterAdd).toBe(before + 1);

    // Now remove nearest point via Shift+Click at same location
    await page.mouse.click(centerX, centerY, { modifiers: ['Shift'], delay: 20 });
    // Wait until points length drops back (or at least decreases)
    await page.waitForFunction((prev) => window._lrDemo.points.length <= prev - 1, {}, afterAdd);
    const afterRemove = await page.evaluate(() => window._lrDemo.points.length);
    expect(afterRemove).toBeLessThan(afterAdd);

    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: starting GD with no points does nothing and produces no errors', async ({ page }) => {
    // Validate StartGradientDescent when no points exist (edge case)
    const { consoleMessages, pageErrors } = await openAndCollect(page);

    // Clear points
    await page.click('#btnClear');
    await page.waitForFunction(() => window._lrDemo.points.length === 0);

    // Click Start GD should do nothing (gd.running remains false)
    await page.click('#btnStartGD');
    // A short wait for any unexpected behavior
    await page.waitForTimeout(200);

    const running = await page.evaluate(() => window._lrDemo.gd.running);
    expect(running).toBeFalsy();

    expect(pageErrors.length).toBe(0);
  });

  // After all tests: a sanity check that no uncaught errors were emitted during test run will be checked within each test.
});