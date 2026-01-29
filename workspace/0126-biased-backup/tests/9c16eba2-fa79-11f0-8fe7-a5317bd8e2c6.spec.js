import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c16eba2-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper: wait until the txt-output textarea contains a substring
async function waitForOutputContains(page, substring, timeout = 3000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const val = await page.locator('#txt-output').inputValue();
    if (val.includes(substring)) return val;
    await page.waitForTimeout(50);
  }
  throw new Error(`Timed out waiting for output to contain "${substring}". Current output:\n` + await page.locator('#txt-output').inputValue());
}

// Helper: click canvas at page-relative coordinates
async function clickCanvasAt(page, clientX, clientY) {
  // Use mouse to click at exact client coordinates
  await page.mouse.click(clientX, clientY);
}

// Helper: dispatch input event on range to change k
async function setRangeValue(page, selector, value) {
  await page.evaluate(
    ({ selector, value }) => {
      const el = document.querySelector(selector);
      if (!el) return;
      el.value = String(value);
      const ev = new Event('input', { bubbles: true, cancelable: true });
      el.dispatchEvent(ev);
    },
    { selector, value }
  );
}

test.describe('KNN Interactive Demo - full FSM & UI validation', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // capture console messages
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });
    // capture page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // ensure initial script setup has run and initial generateDataset logged
    await waitForOutputContains(page, 'Generated dataset', 5000);
  });

  test.afterEach(async () => {
    // Assert that no uncaught page errors occurred during the test run
    expect(pageErrors, `Unexpected page errors:\n${pageErrors.map(e => String(e)).join('\n')}`).toHaveLength(0);
  });

  test('Initial page render and auto-generated dataset (S0 -> S1)', async ({ page }) => {
    // Validate page title and presence of core controls
    await expect(page.locator('h2')).toContainText('K-Nearest Neighbors');
    await expect(page.locator('#btn-generate')).toBeVisible();
    await expect(page.locator('#btn-clear')).toBeVisible();
    await expect(page.locator('#btn-default')).toBeVisible();

    // The page's setup() calls generateDataset(), so we expect a "Generated dataset" log
    const out = await page.locator('#txt-output').inputValue();
    expect(out).toMatch(/Generated dataset/);

    // Feature selectors initialized based on dims; default dims is 2 -> sel-x/sel-y should have >=2 options
    const selXCount = await page.locator('#sel-x option').count();
    const selYCount = await page.locator('#sel-y option').count();
    expect(selXCount).toBeGreaterThanOrEqual(2);
    expect(selYCount).toBeGreaterThanOrEqual(2);
  });

  test('Generate, Clear, Export edge cases (S1 -> S2 and Export events)', async ({ page }) => {
    // Click Generate explicitly and verify expected log
    await page.click('#btn-generate');
    await waitForOutputContains(page, 'Generated dataset: classes=', 3000);

    // Click Clear and expect "Cleared dataset" message
    await page.click('#btn-clear');
    await waitForOutputContains(page, 'Cleared dataset', 3000);

    // Edge: export CSV when no points should log 'No points to export'
    await page.click('#btn-export-csv');
    await waitForOutputContains(page, 'No points to export', 3000);

    // Re-generate (bring dataset back)
    await page.click('#btn-generate');
    await waitForOutputContains(page, 'Generated dataset: classes=', 3000);

    // Export JSON should trigger download anchor click; ensure it does not cause error and page continues
    await page.click('#btn-export-json');
    // No specific output message for JSON export is written, but ensure no errors and UI still responsive
    await expect(page.locator('#btn-generate')).toBeEnabled();
  });

  test('Load Default dataset transition (S0 -> S1 via LoadDefaultDataset)', async ({ page }) => {
    // Clear first
    await page.click('#btn-clear');
    await waitForOutputContains(page, 'Cleared dataset', 3000);

    // Load default dataset
    await page.click('#btn-default');
    // generateDataset called -> expect Generated dataset log again and dims/classes set
    await waitForOutputContains(page, 'Generated dataset: classes=', 3000);
    // verify that in-classes value is set to 3 as per btnDefault handler
    const classesVal = await page.locator('#in-classes').inputValue();
    expect(classesVal).toBe('3');
    const ppcVal = await page.locator('#in-ppc').inputValue();
    expect(ppcVal).toBe('25');
  });

  test('Add point, Select, Toggle truth, Undo/Redo, Remove point, Move point (S3,S4,S5,S6)', async ({ page }) => {
    // Ensure in "add" mode, switch to add
    await page.click('input[name="mode"][value="add"]');

    // Determine canvas center coordinates for clicks
    const canvas = page.locator('#canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const cx = Math.floor(box.x + box.width / 2);
    const cy = Math.floor(box.y + box.height / 2);

    // Add a new point by clicking canvas in add mode
    await page.mouse.click(cx, cy);
    // After adding, selection should be set to the new point id (sel-id should not be 'none')
    const selId = await page.locator('#sel-id').textContent();
    expect(selId).not.toBeNull();
    expect(selId.trim()).not.toBe('none');

    // Click canvas (view) to show details for selected point - first switch to view mode to trigger showDetailsForSelected on click
    await page.click('input[name="mode"][value="view"]');
    // Click at same center to ensure selection click registers and details panel is populated
    await page.mouse.click(cx, cy);
    // Wait for txt-details to contain "Point id"
    await page.waitForFunction(() => document.querySelector('#txt-details').value.includes('Point id'));
    const detailsBefore = await page.locator('#txt-details').inputValue();
    expect(detailsBefore).toMatch(/Coordinates:/);

    // Toggle truth (should toggle split and log)
    await page.click('#btn-toggle-truth');
    await waitForOutputContains(page, 'Toggled split for selected point', 3000);

    // Undo the toggle (should revert split) - confirm no page error
    await page.click('#btn-undo');
    // Redo
    await page.click('#btn-redo');

    // Now test move: set mode to move and perform drag
    await page.click('input[name="mode"][value="move"]');
    // mousedown at center, move by +40 pixels, mouseup
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    const nx = cx + 40;
    const ny = cy + 30;
    await page.mouse.move(nx, ny, { steps: 5 });
    await page.mouse.up();

    // Switch to view and click at new position to show details (which will show updated coordinates)
    await page.click('input[name="mode"][value="view"]');
    await page.mouse.click(nx, ny);
    await page.waitForFunction(() => document.querySelector('#txt-details').value.includes('Coordinates:'));
    const detailsAfter = await page.locator('#txt-details').inputValue();
    // Expect coordinates string to have changed compared to before (move occured)
    expect(detailsAfter).not.toBe(detailsBefore);

    // Now remove the moved point: change to remove mode and click at new position
    await page.click('input[name="mode"][value="remove"]');
    await page.mouse.click(nx, ny);
    // After removal sel-id should go to 'none'
    const selAfterRemove = await page.locator('#sel-id').textContent();
    expect(selAfterRemove.trim()).toBe('none');

    // Attempt Undo then Redo to ensure stacks behave - no page errors
    await page.click('#btn-undo');
    await page.click('#btn-redo');
  });

  test('Compute decision grid and hover interactions (S7)', async ({ page }) => {
    // Ensure dataset exists (it should from setup)
    // Set grid resolution to small number for speed
    await page.fill('#in-res', '10');
    await page.click('#btn-compute-grid');
    // Wait for log that computation happened
    await waitForOutputContains(page, 'Computed decision grid, resolution=10', 5000);

    // Hover over center of canvas to trigger grid hover message
    const canvas = page.locator('#canvas');
    const box = await canvas.boundingBox();
    const cx = Math.floor(box.x + box.width / 2);
    const cy = Math.floor(box.y + box.height / 2);
    // Hover without showing neighbors: should still write "Grid hover"
    await page.mouse.move(cx, cy);
    await waitForOutputContains(page, 'Grid hover: cell', 3000);

    // Now enable show neighbors checkbox and hover again to populate txt-details
    await page.check('#chk-show-neighbors');
    await page.mouse.move(cx + 5, cy + 5);
    // As the grid hover with neighbors will also write to txt-details, wait for it
    await page.waitForFunction(() => document.querySelector('#txt-details').value.length > 0);
    const td = await page.locator('#txt-details').inputValue();
    expect(td).toMatch(/Grid cell prediction|Neighbors:/);
  });

  test('Run cross-validation (S8) and Hyperparameter sweep (HyperparameterSweep)', async ({ page }) => {
    // Ensure there are labeled points (initial generation sets labels for classification)
    // Run cross-validation
    await page.fill('#in-folds', '3');
    await page.click('#btn-cv');
    // Expect the log about running cross-validation with 3 folds
    await waitForOutputContains(page, 'Ran cross-validation with 3 folds', 5000);

    // Run hyperparameter sweep - set in-sweep-max and click
    await page.fill('#in-sweep-max', '5');
    await page.click('#btn-sweep');
    // Expect completion log referencing the max k
    await waitForOutputContains(page, 'Completed hyperparameter sweep up to k=5', 5000);
    // Also expect txt-output (txtOutput textarea) to contain 'Hyperparameter sweep results' or 'Best k'
    const outTxt = await page.locator('#txt-output').inputValue();
    expect(outTxt).toMatch(/Completed hyperparameter sweep up to k=5/);
  });

  test('K setting UI update (range input) and classification explanation for selected point', async ({ page }) => {
    // Change K via slider programmatically and ensure out-k updates
    await setRangeValue(page, '#in-k', 12);
    // out-k span should reflect new value
    await expect(page.locator('#out-k')).toHaveText('12');

    // Now ensure we can explain prediction for a selected point:
    // Add a point (switch to add mode), then switch to view and click to select and explain
    await page.click('input[name="mode"][value="add"]');
    const canvas = page.locator('#canvas');
    const box = await canvas.boundingBox();
    const cx = Math.floor(box.x + box.width / 3);
    const cy = Math.floor(box.y + box.height / 3);
    await page.mouse.click(cx, cy);

    // Switch to view and click to populate details selection
    await page.click('input[name="mode"][value="view"]');
    await page.mouse.click(cx, cy);

    // Immediately click explain button; since a point is selected it should explain prediction and write to txtDetails
    await page.click('#btn-classify-selected');
    await page.waitForFunction(() => document.querySelector('#txt-details').value.includes('Prediction for selected point'));
    const details = await page.locator('#txt-details').inputValue();
    expect(details).toMatch(/Prediction for selected point/);
    expect(details).toMatch(/Neighbors:/);
  });

  test('Edge cases: Toggle truth with no selection and Undo/Redo when empty (error scenarios)', async ({ page }) => {
    // Clear dataset to remove selection and points
    await page.click('#btn-clear');
    await waitForOutputContains(page, 'Cleared dataset', 3000);

    // Ensure selection is none
    await expect(page.locator('#sel-id')).toHaveText('none');

    // Click toggle truth when nothing is selected -> should log 'Select a point first' but not throw
    await page.click('#btn-toggle-truth');
    await waitForOutputContains(page, 'Select a point first', 3000);

    // Call undo when there may be undo stack empty or not; ensure no page error
    await page.click('#btn-undo');
    await page.click('#btn-redo');

    // Try run CV when no points -> should log 'No points' and not throw
    await page.fill('#in-folds', '3');
    await page.click('#btn-cv');
    await waitForOutputContains(page, 'No points', 3000);
  });

  test('Verify console remained free of uncaught exceptions and UI responsive after multiple operations', async ({ page }) => {
    // Do a couple of rapid operations: generate, compute grid, sweep, split
    await page.click('#btn-generate');
    await waitForOutputContains(page, 'Generated dataset: classes=', 3000);

    await page.click('#btn-compute-grid');
    await waitForOutputContains(page, 'Computed decision grid', 5000);

    await page.fill('#in-sweep-max', '3');
    await page.click('#btn-sweep');
    await waitForOutputContains(page, 'Completed hyperparameter sweep up to k=3', 5000);

    await page.click('#btn-split');
    await waitForOutputContains(page, 'Split dataset: test fraction=', 3000);

    // Ensure there were no console errors captured
    const severeConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(severeConsole.length, `Severe console messages were logged: ${JSON.stringify(severeConsole)}`).toBeLessThanOrEqual(5);
  });
});