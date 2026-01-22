import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e93437c2-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Floyd–Warshall Algorithm — Interactive Demo (e93437c2-d360-11f0-a097-ffdd56c22ef4)', () => {
  // Collect console messages and page errors for each test so we can assert on them
  let consoleErrors = [];
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    consoleMessages = [];

    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', err => {
      // collect page uncaught exceptions
      pageErrors.push(err);
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure initial canvas and matrix are rendered before proceeding
    await page.waitForSelector('#matrixWrap table.matrix');
    await page.waitForSelector('#graphCanvas');
  });

  test.afterEach(async () => {
    // After each test, assert that there were no unexpected console error messages or page errors.
    // We assert that no uncaught page errors occurred.
    expect(pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
    // Also assert there are no console error messages logged
    expect(consoleErrors, 'No console.error messages should have been logged').toEqual([]);
  });

  test('Initial state (S0_Idle): page renders, matrix present, iteration shows not started', async ({ page }) => {
    // Validate initial UI elements and S0 Idle state observables
    const nodeCount = await page.locator('#nodeCount').inputValue();
    expect(Number(nodeCount)).toBeGreaterThanOrEqual(2);

    // Matrix should be present and size n x n (default n from input value)
    const n = Number(nodeCount);
    const cells = page.locator('#matrixWrap table.matrix tbody tr td.editable');
    await expect(cells).toHaveCount(n * n);

    // Iteration text should indicate not started per setNotInitializedState
    await expect(page.locator('#iteration')).toHaveText('Iteration: k = - (not started)');
    await expect(page.locator('#pair')).toHaveText('Pair (i, j): -');
    await expect(page.locator('#distanceInfo')).toHaveText('Selected distance: -');

    // Canvas exists and has 2D context drawn
    const canvasExists = await page.locator('#graphCanvas').isVisible();
    expect(canvasExists).toBe(true);
  });

  test('ResizeGraph event: clicking Resize updates matrix size and stays in Idle', async ({ page }) => {
    // Increase nodeCount to 4 and click Resize
    const nodeCountInput = page.locator('#nodeCount');
    await nodeCountInput.fill('4');
    await page.locator('#resizeBtn').click();

    // Matrix should now be 4x4
    const cells = page.locator('#matrixWrap table.matrix tbody tr td.editable');
    await expect(cells).toHaveCount(4 * 4);

    // Iteration should be not started after resize
    await expect(page.locator('#iteration')).toHaveText('Iteration: k = - (not started)');
  });

  test('GenerateRandomGraph event: clicking Random Graph populates adjacency and remains uninitialized', async ({ page }) => {
    // The UI shows a confirm for allowing negative edges. Accept it.
    page.once('dialog', async dialog => {
      // Accept to allow negative edges (we don't rely on the chosen value)
      await dialog.accept();
    });

    await page.locator('#randBtn').click();

    // After generation, at least one non-infinity (not '∞') cell should exist outside diagonal,
    // but diagonals may be 0. We'll assert majority of cells exist and table rendered.
    const n = Number(await page.locator('#nodeCount').inputValue());
    const cells = page.locator('#matrixWrap table.matrix tbody tr td.editable');
    await expect(cells).toHaveCount(n * n);

    // Verify that at least one cell contains a numeric character or '-' (i.e., not all Infinity)
    const texts = await cells.allTextContents();
    const hasNumeric = texts.some(t => /\d|[-]/.test(t) && !t.includes('∞'));
    expect(hasNumeric, 'Random graph should generate at least one finite edge').toBe(true);

    // Ensure still not initialized (iteration shows not started)
    await expect(page.locator('#iteration')).toHaveText('Iteration: k = - (not started)');
  });

  test('ClearGraph event: clicking Clear sets off-diagonals to ∞ and diagonals to 0', async ({ page }) => {
    await page.locator('#clearBtn').click();

    const n = Number(await page.locator('#nodeCount').inputValue());
    const rows = page.locator('#matrixWrap table.matrix tbody tr');
    await expect(rows).toHaveCount(n);

    // Check diagonal and off-diagonal cells
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const cell = page.locator(`#matrixWrap table.matrix tbody tr:nth-child(${i+1}) td.editable:nth-child(${j+1})`);
        const txt = (await cell.textContent()).trim();
        if (i === j) {
          expect(txt).toBe('0');
        } else {
          // Off-diagonal should be infinity symbol
          expect(txt).toBe('∞');
        }
      }
    }

    // Iteration remains not started
    await expect(page.locator('#iteration')).toHaveText('Iteration: k = - (not started)');
  });

  test('InitializeMatrices (S1_MatricesInitialized): clicking Initialize Matrices populates dist/next and updates UI', async ({ page }) => {
    // Ensure matrix is present, then initialize
    await page.locator('#initBtn').click();

    // Should update iteration to k = 0 and pair to (0, 0)
    await expect(page.locator('#iteration')).toHaveText('Iteration: k = 0');
    // pair text may have a space format "(0, 0)"
    await expect(page.locator('#pair')).toContainText('Pair (i, j):');

    // Matrix cell content should reflect dist (finite values or ∞)
    const cells = page.locator('#matrixWrap table.matrix tbody tr td.editable');
    const texts = await cells.allTextContents();
    expect(texts.length).toBeGreaterThan(0);
  });

  test('StepAlgorithm (S1 -> S2): clicking Step after initialize advances pair and updates matrix; also test alert when stepping before init', async ({ page }) => {
    // First verify stepping without initialize produces an alert
    // Reload to reset to initial idle state
    await page.goto(APP_URL, { waitUntil: 'load' });
    await page.waitForSelector('#matrixWrap table.matrix');

    // Expect an alert when stepping without initialization
    page.once('dialog', async dialog => {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Initialize matrices first');
      await dialog.accept();
    });
    await page.locator('#stepBtn').click();

    // Now initialize and then step
    await page.locator('#initBtn').click();
    // Capture pair before step
    const pairBefore = await page.locator('#pair').textContent();

    // Click step and ensure pair changes (i or j advanced)
    await page.locator('#stepBtn').click();
    // after step, pair will update
    const pairAfter = await page.locator('#pair').textContent();
    expect(pairAfter).not.toBe(pairBefore);
    // iteration should still be 'k = 0' or advanced if loop progressed
    const iter = await page.locator('#iteration').textContent();
    expect(iter).toContain('Iteration: k =');
  });

  test('RunToEnd (S1 -> S4): clicking Run to End completes algorithm and shows finished', async ({ page }) => {
    // Initialize then run to end
    await page.locator('#initBtn').click();
    await page.locator('#runAllBtn').click();

    // After runToEnd iteration should be 'finished' and pair reset
    await expect(page.locator('#iteration')).toHaveText('Iteration: finished');
    await expect(page.locator('#pair')).toHaveText('Pair (i, j): -');

    // Matrix should still render and cells be finite or ∞ but count unchanged
    const n = Number(await page.locator('#nodeCount').inputValue());
    await expect(page.locator('#matrixWrap table.matrix tbody tr td.editable')).toHaveCount(n * n);
  });

  test('Play/Pause (S3 <-> S2): play enables autoplay, pause stops it and toggles buttons', async ({ page }) => {
    // Ensure initialize first
    await page.locator('#initBtn').click();

    // Play should enable autoplay and disable play button while enabling pause
    await page.locator('#playBtn').click();
    await expect(page.locator('#playBtn')).toBeDisabled();
    await expect(page.locator('#pauseBtn')).toBeEnabled();

    // Pause should re-enable play and disable pause
    await page.locator('#pauseBtn').click();
    await expect(page.locator('#playBtn')).toBeEnabled();
    await expect(page.locator('#pauseBtn')).toBeDisabled();
  });

  test('ResetAlgorithm: after running to end, Reset restores iteration to k = 0 and pair to starting indices', async ({ page }) => {
    // Initialize, run to end, then reset
    await page.locator('#initBtn').click();
    await page.locator('#runAllBtn').click();

    // Now reset
    await page.locator('#resetBtn').click();

    // After reset iteration should be k = 0 and pair should reflect starting state
    await expect(page.locator('#iteration')).toHaveText('Iteration: k = 0');

    // Pair text may be formatted '(0,0)' (reset code) or '(0, 0)' depending on path; check contains (0
    const pair = await page.locator('#pair').textContent();
    expect(pair).toContain('(0');
  });

  test('ShowPath and ClearHighlightedPath: show path for trivial node and clear it', async ({ page }) {
    // Initialize matrices (nextM diagonal points to self; path from a node to itself exists)
    await page.locator('#initBtn').click();

    // Ensure selects are populated
    await page.waitForSelector('#fromSelect option');
    await page.waitForSelector('#toSelect option');

    // By default, selects should have 0 as value. Click Show Path for 0 -> 0
    await page.locator('#showPathBtn').click();

    // Selected distance for path 0->0 should be 0
    await expect(page.locator('#distanceInfo')).toHaveText('Selected distance: 0');

    // Clear highlighted path should reset distanceInfo to '-'
    await page.locator('#clearPathBtn').click();
    await expect(page.locator('#distanceInfo')).toHaveText('Selected distance: -');
  });

  test('Edge case: Run to End and Play without initialize should show alerts', async ({ page }) => {
    // Reload to ensure idle
    await page.goto(APP_URL, { waitUntil: 'load' });
    await page.waitForSelector('#matrixWrap table.matrix');

    // Try runAll without initialize -> should alert
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Initialize matrices first');
      await dialog.accept();
    });
    await page.locator('#runAllBtn').click();

    // Try play without initialize -> should alert
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Initialize matrices first');
      await dialog.accept();
    });
    await page.locator('#playBtn').click();
  });

  test('Negative cycle detection scenario: create negative diagonal and detect after runToEnd', async ({ page }) => {
    // Resize to a small graph to minimize complexity
    await page.locator('#nodeCount').fill('3');
    await page.locator('#resizeBtn').click();

    // Clear graph to known state
    await page.locator('#clearBtn').click();

    // Edit cell (0,0) to -1 to introduce a negative cycle directly (self-loop negative)
    const cell00 = page.locator('#matrixWrap table.matrix tbody tr:nth-child(1) td.editable:nth-child(1)');
    await cell00.click();
    // Select all and type '-1'
    await page.keyboard.press('Control+A');
    await page.keyboard.type('-1');
    // Enter to blur (listeners handle Enter)
    await page.keyboard.press('Enter');

    // Initialize and run to end to ensure negative cycle detection path executes
    await page.locator('#initBtn').click();
    // runToEnd should compute and then negCycle text should be updated by checkNegativeCycle()
    await page.locator('#runAllBtn').click();

    const negText = await page.locator('#negCycle').textContent();
    expect(negText).toContain('Negative cycle detected');
  });

});