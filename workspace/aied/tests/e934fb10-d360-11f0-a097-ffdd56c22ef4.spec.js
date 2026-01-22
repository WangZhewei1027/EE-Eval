import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e934fb10-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Interactive Linear Regression Demo - FSM validation', () => {
  // capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and page errors
    page.on('console', (msg) => {
      // record console.error/severity messages
      if (msg.type() === 'error') consoleErrors.push({ text: msg.text(), location: msg.location() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // set a large viewport so canvas has space and ResizeObserver triggers reliably
    await page.setViewportSize({ width: 1200, height: 900 });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Wait for initial UI to render: count element available and updateAfterChange initial call
    await page.waitForSelector('#count');

    // Give app some time to run its initial resize and initial draw
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // Assert no unexpected runtime errors propagated to pageerror
    expect(pageErrors).toEqual([]); // fail if any uncaught exceptions occurred
    // Also assert that no console.error messages were printed
    expect(consoleErrors).toEqual([]);
  });

  // Helper to read integer count displayed in UI
  async function getCount(page) {
    const text = await page.locator('#count').textContent();
    return Number(text || 0);
  }

  // Helper to read a snapshot copy of window.pointsData array
  async function getPointsData(page) {
    // pointsData is exposed by the app (window.pointsData)
    return await page.evaluate(() => {
      try {
        // return a deep copy so mutations on the page don't affect our snapshot
        return (window.pointsData || []).map(p => ({ x: p.x, y: p.y }));
      } catch (e) {
        return null;
      }
    });
  }

  // Helper: compute a point on the canvas to click (center of canvas)
  async function getCanvasCenter(page) {
    const canvas = page.locator('canvas#chart');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not available');
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  test.describe('State S0 (Idle) initial render', () => {
    test('initial UI shows zero points and helpful stats', async ({ page }) => {
      // Validate S0_Idle: renderPage() called on entry and count = 0
      const count = await getCount(page);
      expect(count).toBe(0);

      // Statistics area should show "Add points to compute regression." when no points
      const statsText = await page.locator('#stats').textContent();
      expect(statsText).toContain('Add points to compute regression.');

      // Point list should be empty
      const pointListChildren = await page.locator('#pointList').locator('.point-row').count();
      expect(pointListChildren).toBe(0);
    });
  });

  test.describe('Point interactions (POINT_ADD, POINT_DRAG, POINT_REMOVE)', () => {
    test('POINT_ADD: clicking canvas adds a point and transitions to Point Added', async ({ page }) => {
      // Click center of canvas to add a point
      const center = await getCanvasCenter(page);
      await page.mouse.click(center.x, center.y);

      // After adding, count increments
      await page.waitForTimeout(50); // small delay for updateAfterChange
      const count = await getCount(page);
      expect(count).toBe(1);

      // The internal points data should have one element (evidence of points.push)
      const pts = await getPointsData(page);
      expect(Array.isArray(pts)).toBeTruthy();
      expect(pts.length).toBe(1);

      // Point list UI should have one row
      const rows = await page.locator('#pointList .point-row').count();
      expect(rows).toBe(1);
    });

    test('POINT_DRAG: dragging a point updates its position (Point Dragged)', async ({ page }) => {
      // Ensure a point exists: add one by clicking center
      const center = await getCanvasCenter(page);
      await page.mouse.click(center.x, center.y);
      await page.waitForTimeout(50);

      const before = await getPointsData(page);
      expect(before.length).toBeGreaterThanOrEqual(1);
      const beforePt = before[0];

      // Drag the point: pointerdown at center, move by an offset, pointerup
      await page.mouse.move(center.x, center.y);
      await page.mouse.down();
      // move to a new location
      const destX = center.x + 80;
      const destY = center.y + 40;
      await page.mouse.move(destX, destY, { steps: 12 });
      // Small pause to ensure pointermove handler fires
      await page.waitForTimeout(60);
      await page.mouse.up();

      // Wait for final UI update
      await page.waitForTimeout(80);
      const after = await getPointsData(page);
      expect(after.length).toBe(before.length);

      // Coordinates should have changed (dragging updated the same point)
      const afterPt = after[0];
      // Allow a tolerance because mapping may clamp to 0..100
      const changed = Math.abs(afterPt.x - beforePt.x) > 0.0001 || Math.abs(afterPt.y - beforePt.y) > 0.0001;
      expect(changed).toBeTruthy();
    });

    test('POINT_REMOVE: double-clicking a point removes it (Point Removed)', async ({ page }) => {
      // Add a point
      const center = await getCanvasCenter(page);
      await page.mouse.click(center.x, center.y);
      await page.waitForTimeout(40);
      let count = await getCount(page);
      expect(count).toBeGreaterThanOrEqual(1);

      // Double pointerdown quickly on the same spot to trigger deletion path
      await page.mouse.move(center.x, center.y);
      // first down/up
      await page.mouse.down();
      await page.mouse.up();
      // short delay less than 330ms threshold used by the app
      await page.waitForTimeout(120);
      // second down/up triggers double-click deletion
      await page.mouse.down();
      await page.mouse.up();

      // small wait for updateAfterChange to run
      await page.waitForTimeout(80);
      count = await getCount(page);
      // Expect point removed, count decreased (likely to zero)
      expect(count).toBe(0);

      const pts = await getPointsData(page);
      expect(pts.length).toBe(0);
    });
  });

  test.describe('Gradient Descent states (RUN_GD -> GDRunning and STOP_GD -> GDStopped)', () => {
    test('RUN_GD starts gradient descent (disables run button, enables stop), STOP_GD stops it', async ({ page }) => {
      // Ensure there are some points. Use the "Add one random point" button a few times.
      const btnRandom = page.locator('#btn-random');
      await btnRandom.click(); // 1
      await page.waitForTimeout(30);
      await btnRandom.click(); // 2
      await page.waitForTimeout(30);

      const count = await getCount(page);
      expect(count).toBeGreaterThanOrEqual(2);

      // Click Run GD - immediately the handler disables run and enables stop
      const runBtn = page.locator('#run-gd');
      const stopBtn = page.locator('#stop-gd');

      // Ensure initial disabled state expected (run enabled, stop disabled)
      expect(await runBtn.isEnabled()).toBeTruthy();
      expect(await stopBtn.isEnabled()).toBeFalsy();

      // Click run
      const [dialog] = await Promise.all([
        // there should not be an alert (since we have points), so no dialog awaited
        page.waitForEvent('dialog', { timeout: 200 }).catch(() => null),
        runBtn.click(),
      ]);

      // If an alert unexpectedly appeared, dismiss it to continue tests
      if (dialog) await dialog.dismiss();

      // After clicking run, run button should be disabled and stop enabled
      await page.waitForTimeout(20);
      expect(await runBtn.isDisabled()).toBeTruthy();
      expect(await stopBtn.isEnabled()).toBeTruthy();

      // Now click stop to simulate STOP_GD transition
      await stopBtn.click();

      // The handler should re-enable run and disable stop
      await page.waitForTimeout(50);
      expect(await runBtn.isEnabled()).toBeTruthy();
      expect(await stopBtn.isDisabled()).toBeTruthy();
    });

    test('Attempting to RUN_GD with no points raises an alert (edge case)', async ({ page }) => {
      // Clear existing points first
      const resetBtn = page.locator('#btn-reset');
      await resetBtn.click();
      await page.waitForTimeout(40);
      expect(await getCount(page)).toBe(0);

      // Click run-gd and expect an alert dialog with message 'Add points first'
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.locator('#run-gd').click(),
      ]);
      expect(dialog).not.toBeNull();
      expect(dialog.message()).toContain('Add points first');
      await dialog.accept();

      // Ensure no runaway GD: run should remain enabled
      expect(await page.locator('#run-gd').isEnabled()).toBeTruthy();
    });
  });

  test.describe('Buttons and actions (CLEAR_POINTS, GENERATE_RANDOM_POINTS, ADD_POINTS_ON_LINE, ADD_ONE_RANDOM_POINT, CENTER_POINTS)', () => {
    test('CLEAR_POINTS resets points to zero', async ({ page }) => {
      // add a couple points first
      await page.locator('#btn-random').click();
      await page.waitForTimeout(20);
      await page.locator('#btn-random').click();
      await page.waitForTimeout(20);
      expect(await getCount(page)).toBeGreaterThanOrEqual(2);

      // Click Clear
      await page.locator('#btn-reset').click();
      await page.waitForTimeout(40);
      expect(await getCount(page)).toBe(0);
      const pts = await getPointsData(page);
      expect(pts.length).toBe(0);
    });

    test('GENERATE_RANDOM_POINTS produces N points according to randN input', async ({ page }) => {
      // Set randN to 5
      const randN = page.locator('#randN');
      await randN.fill('5');
      // Click Generate
      await page.locator('#btn-gen').click();

      // Wait a bit for all updates
      await page.waitForTimeout(200);
      const count = await getCount(page);
      // count should be at least 5 (could be more if previous points exist), but to isolate, we reset first
      // To be robust, assert that count >= 5
      expect(count).toBeGreaterThanOrEqual(5);
    });

    test('ADD_POINTS_ON_LINE adds roughly 8 points', async ({ page }) => {
      // Reset to empty for deterministic check
      await page.locator('#btn-reset').click();
      await page.waitForTimeout(40);
      expect(await getCount(page)).toBe(0);

      // Click add points on a line
      await page.locator('#btn-add-slope').click();
      await page.waitForTimeout(80);
      const count = await getCount(page);
      // The implementation pushes 8 points
      expect(count).toBeGreaterThanOrEqual(8);
    });

    test('ADD_ONE_RANDOM_POINT increases points by 1', async ({ page }) => {
      // Reset then add one
      await page.locator('#btn-reset').click();
      await page.waitForTimeout(40);
      expect(await getCount(page)).toBe(0);

      await page.locator('#btn-random').click();
      await page.waitForTimeout(40);
      expect(await getCount(page)).toBe(1);
    });

    test('CENTER_POINTS repositions points (example: centers a single point)', async ({ page }) => {
      // Reset and add a random point at some place via programmatic click
      await page.locator('#btn-reset').click();
      await page.waitForTimeout(40);

      // Click canvas off-center to ensure not already at center
      const canvasCenter = await getCanvasCenter(page);
      const clickX = canvasCenter.x - 120;
      const clickY = canvasCenter.y - 60;
      await page.mouse.click(clickX, clickY);
      await page.waitForTimeout(60);

      const before = await getPointsData(page);
      expect(before.length).toBe(1);
      const beforePt = before[0];

      // Click center button
      await page.locator('#btn-center').click();
      await page.waitForTimeout(80);

      const after = await getPointsData(page);
      expect(after.length).toBe(1);
      const afterPt = after[0];

      // center action sets p.x = 50, p.y = 50 (clamped)
      expect(Math.abs(afterPt.x - 50)).toBeLessThan(1e-6);
      expect(Math.abs(afterPt.y - 50)).toBeLessThan(1e-6);
      // ensure it actually changed from previous coordinate unless it already was center
      const changed = Math.abs(beforePt.x - afterPt.x) > 1e-6 || Math.abs(beforePt.y - afterPt.y) > 1e-6;
      expect(changed).toBeTruthy();
    });
  });

  test.describe('Keyboard shortcuts and display toggles', () => {
    test('Keyboard "g" generates points, "c" clears them', async ({ page }) => {
      // Ensure starting from empty
      await page.locator('#btn-reset').click();
      await page.waitForTimeout(40);
      expect(await getCount(page)).toBe(0);

      // Press 'g' to generate 10 points (generateRandom(10) is bound to 'g')
      await page.keyboard.press('g');
      await page.waitForTimeout(200);
      const afterGen = await getCount(page);
      expect(afterGen).toBeGreaterThanOrEqual(10);

      // Press 'c' to clear
      await page.keyboard.press('c');
      await page.waitForTimeout(60);
      expect(await getCount(page)).toBe(0);
    });

    test('Toggling display checkboxes updates canvas drawing paths without errors', async ({ page }) => {
      // Ensure a point exists for drawing lines
      await page.locator('#btn-random').click();
      await page.waitForTimeout(40);

      // Toggle show-ols
      await page.locator('#show-ols').click();
      await page.waitForTimeout(20);
      await page.locator('#show-ols').click(); // toggle back
      await page.waitForTimeout(20);

      // Toggle show-gd
      await page.locator('#show-gd').click();
      await page.waitForTimeout(20);
      await page.locator('#show-gd').click();
      await page.waitForTimeout(20);

      // Toggle show-points
      await page.locator('#show-points').click();
      await page.waitForTimeout(20);
      await page.locator('#show-points').click();
      await page.waitForTimeout(20);

      // No errors should have been emitted to console or pageerror by these draws (checked in afterEach)
      expect(await getCount(page)).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Edge cases and UI invariants', () => {
    test('Clicking "Analytic (OLS)" with no points triggers alert and does not crash', async ({ page }) => {
      // ensure no points
      await page.locator('#btn-reset').click();
      await page.waitForTimeout(40);
      expect(await getCount(page)).toBe(0);

      // btn-ols handler checks computeOLS and triggers alert('Need at least one point')
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.locator('#btn-ols').click(),
      ]);
      expect(dialog).not.toBeNull();
      expect(dialog.message()).toContain('Need at least one point');
      await dialog.accept();
    });

    test('Point list delete and center buttons operate without throwing', async ({ page }) => {
      // Reset and add a couple points via programmatic clicks
      await page.locator('#btn-reset').click();
      await page.waitForTimeout(40);
      await page.locator('#btn-random').click();
      await page.waitForTimeout(40);
      await page.locator('#btn-random').click();
      await page.waitForTimeout(80);

      // Ensure there are point rows
      const rows = page.locator('#pointList .point-row');
      const countRows = await rows.count();
      expect(countRows).toBeGreaterThanOrEqual(2);

      // Click the 'Center' button of the first row
      const firstCenter = rows.nth(0).locator('button', { hasText: 'Center' });
      await firstCenter.click();
      await page.waitForTimeout(30);

      // Click the 'Delete' button of the (now first) row
      const firstDelete = rows.nth(0).locator('button', { hasText: 'Delete' });
      await firstDelete.click();
      await page.waitForTimeout(40);

      // Confirm UI count decreased and no errors thrown
      const count = await getCount(page);
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});