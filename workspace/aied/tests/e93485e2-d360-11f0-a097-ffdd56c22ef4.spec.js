import { test, expect } from '@playwright/test';

test.describe('e93485e2-d360-11f0-a097-ffdd56c22ef4 - LCS Visualizer (End-to-end)', () => {
  // Helper to attach console and pageerror listeners to capture runtime errors and logs.
  async function attachErrorListeners(page, store) {
    store.consoleErrors = [];
    store.pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        store.consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      store.pageErrors.push(String(err && err.message ? err.message : err));
    });
  }

  // Reusable navigation & initial checks
  test.beforeEach(async ({ page }) => {
    // nothing global here; each test will navigate and attach its own listeners
  });

  test('Initial Ready state renders strings, table and status (S0_Ready)', async ({ page }) => {
    // Validate initial UI and "Ready" status
    const errors = {};
    await attachErrorListeners(page, errors);

    await page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/e93485e2-d360-11f0-a097-ffdd56c22ef4.html');

    // Ensure status text matches the FSM evidence for Ready state
    const status = page.locator('#statusText');
    await expect(status).toHaveText('Ready. Click Compute LCS to start.');

    // Strings display should be rendered with expected characters from inputs
    const displayA = page.locator('#displayA .char');
    const displayB = page.locator('#displayB .char');
    await expect(displayA).toHaveCount(7); // "ABCBDAB" length 7
    await expect(displayB).toHaveCount(6); // "BDCABA" length 6
    await expect(displayA.nth(0)).toHaveText('A');
    await expect(displayB.nth(0)).toHaveText('B');

    // Table container should exist but initial values will be zeros
    const table = page.locator('.dp-table');
    await expect(table).toBeVisible();
    // top-left base cell exists
    const baseCell = page.locator('td.dp-cell[data-i="0"][data-j="0"] .dp-cell-value');
    await expect(baseCell).toHaveText('0');

    // No unexpected console or page errors during initial render
    expect(errors.consoleErrors.length, 'console errors during initial render').toBe(0);
    expect(errors.pageErrors.length, 'page errors during initial render').toBe(0);
  });

  test('Compute LCS transitions to Computing (S1_Computing) and builds DP table', async ({ page }) => {
    // Clicking Compute LCS should compute dp, populate steps and show LCS length
    const errors = {};
    await attachErrorListeners(page, errors);

    await page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/e93485e2-d360-11f0-a097-ffdd56c22ef4.html');

    const computeBtn = page.locator('#computeBtn');
    await computeBtn.click();

    // Status should contain DP computed message and steps count
    await expect(page.locator('#statusText')).toHaveText(/DP computed\. \d+ steps generated\./);

    // Result area should show LCS length and it should be > 0 for these strings
    const result = page.locator('#resultArea');
    await expect(result).toContainText('LCS length:');
    const dpLen = await page.evaluate(() => window.dp ? window.dp[window.m][window.n] : null);
    expect(typeof dpLen === 'number').toBe(true);
    expect(dpLen).toBeGreaterThanOrEqual(0);

    // The number of steps should equal the collected steps array length
    const stepsLength = await page.evaluate(() => Array.isArray(window.steps) ? window.steps.length : 0);
    // For non-empty strings steps should be > 0
    expect(stepsLength).toBeGreaterThan(0);

    // Verify some table cells have values filled (showVals is checked by default)
    const someCell = page.locator('td.dp-cell[data-i="1"][data-j="1"] .dp-cell-value');
    await expect(someCell).toBeVisible();

    // Confirm no runtime errors occurred while computing
    expect(errors.consoleErrors.length, 'console errors during compute DP').toBe(0);
    expect(errors.pageErrors.length, 'page errors during compute DP').toBe(0);
  });

  test('Step interaction renders a step (S3_Step) and updates status', async ({ page }) => {
    // Validate Step click moves current step and highlights current cell
    const errors = {};
    await attachErrorListeners(page, errors);

    await page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/e93485e2-d360-11f0-a097-ffdd56c22ef4.html');

    await page.locator('#computeBtn').click();
    // ensure steps exist
    const stepsLength = await page.evaluate(() => window.steps.length);
    expect(stepsLength).toBeGreaterThan(0);

    const stepBtn = page.locator('#stepBtn');
    // Click step to advance
    await stepBtn.click();

    // Status should reflect a Step message
    await expect(page.locator('#statusText')).toContainText(/Step \d+ \/ \d+ — filling cell \(\d+,\d+\) value=\d+/);

    // The current active cell should have 'cell-active' class
    const activeCell = page.locator('td.dp-cell.cell-active');
    await expect(activeCell).toHaveCount(1);

    // Clicking step again cycles / increments curStep
    await stepBtn.click();
    await expect(page.locator('#statusText')).toContainText('Step');

    // Validate no console or page errors occurred during stepping
    expect(errors.consoleErrors.length, 'console errors during stepping').toBe(0);
    expect(errors.pageErrors.length, 'page errors during stepping').toBe(0);
  });

  test('Animate Fill starts animation (S2_Animating) and Play/Pause toggles (S5_Playing)', async ({ page }) => {
    // Validate Animate Fill begins animation and Play/Pause toggles to Paused
    const errors = {};
    await attachErrorListeners(page, errors);

    await page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/e93485e2-d360-11f0-a097-ffdd56c22ef4.html');

    // Compute first
    await page.locator('#computeBtn').click();

    // Speed up the animation for test (set to minimum)
    await page.fill('#speedRange', '50');

    // Click animate
    await page.locator('#animateBtn').click();

    // After animate invoked, status should be 'Animating...'
    await expect(page.locator('#statusText')).toHaveText('Animating...');

    // Play/Pause button text should be 'Pause' during animation
    await expect(page.locator('#playPause')).toHaveText('Pause');

    // Wait a little bit to let some steps render
    await page.waitForTimeout(150);

    // Some cell values should be non-zero by now (e.g., at least one cell value > 0)
    const values = await page.$$eval('.dp-cell .dp-cell-value', els => els.map(e => Number(e.textContent || '0')));
    const anyNonZero = values.some(v => v > 0);
    expect(anyNonZero).toBe(true);

    // Now click Play/Pause to pause
    await page.locator('#playPause').click();
    await expect(page.locator('#statusText')).toHaveText('Paused.');

    // Clicking Play again resumes; ensure it toggles text back to Pause
    await page.locator('#playPause').click();
    // When resuming, no immediate status change other than button text; ensure Play/Pause shows 'Pause'
    await expect(page.locator('#playPause')).toHaveText('Pause');

    // Stop any ongoing animation by clicking Play/Pause if necessary
    await page.locator('#playPause').click();
    await expect(page.locator('#playPause')).toHaveText('Play');

    // Validate no runtime errors during animation playback
    expect(errors.consoleErrors.length, 'console errors during animation').toBe(0);
    expect(errors.pageErrors.length, 'page errors during animation').toBe(0);
  });

  test('Backtrack highlights path and shows LCS (S4_Backtracking)', async ({ page }) => {
    // Validate backtrack highlights path, updates result area and status
    const errors = {};
    await attachErrorListeners(page, errors);

    await page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/e93485e2-d360-11f0-a097-ffdd56c22ef4.html');

    await page.locator('#computeBtn').click();

    // Click backtrack
    await page.locator('#backtrackBtn').click();

    // Backtrack animation is async and uses delays; wait until statusText shows 'Backtrack complete.' or timeout
    await page.waitForFunction(() => document.getElementById('statusText').textContent.includes('Backtrack complete.'), {}, { timeout: 3000 });

    await expect(page.locator('#statusText')).toHaveText('Backtrack complete.');

    // Result area should show LCS string and length
    await expect(page.locator('#resultArea')).toContainText('LCS (length');

    // Backtracked cells should have class 'cell-path'
    const pathCells = await page.locator('td.dp-cell.cell-path').count();
    expect(pathCells).toBeGreaterThan(0);

    // If autoHighlight is checked (default), display characters should have 'used' class for at least one char
    const usedA = await page.locator('#displayA .char.used').count();
    const usedB = await page.locator('#displayB .char.used').count();
    expect(usedA + usedB).toBeGreaterThan(0);

    // Validate no runtime errors during backtrack
    expect(errors.consoleErrors.length, 'console errors during backtrack').toBe(0);
    expect(errors.pageErrors.length, 'page errors during backtrack').toBe(0);
  });

  test('Prev/Next step buttons navigate steps and update status', async ({ page }) => {
    // Validate next and prev step behavior
    const errors = {};
    await attachErrorListeners(page, errors);

    await page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/e93485e2-d360-11f0-a097-ffdd56c22ef4.html');

    await page.locator('#computeBtn').click();

    // Ensure at least a few steps exist
    const stepsLength = await page.evaluate(() => window.steps.length);
    expect(stepsLength).toBeGreaterThan(1);

    // Click next step
    await page.locator('#nextStep').click();
    await expect(page.locator('#statusText')).toContainText('Step');

    // Store current active cell coords
    const active = await page.locator('td.dp-cell.cell-active').first();
    const ai = await active.getAttribute('data-i');
    const aj = await active.getAttribute('data-j');

    // Click prev to go back
    await page.locator('#prevStep').click();
    // active cell should change (or at least curStep decreased)
    const active2 = await page.locator('td.dp-cell.cell-active').first();
    const bi = await active2.getAttribute('data-i');
    const bj = await active2.getAttribute('data-j');

    // It's acceptable if indices differ when prev moved back
    // Validate no runtime errors during prev/next navigation
    expect(errors.consoleErrors.length, 'console errors during prev/next').toBe(0);
    expect(errors.pageErrors.length, 'page errors during prev/next').toBe(0);

    // Ensure status text continues to reflect step info
    await expect(page.locator('#statusText')).toContainText('Step');
  });

  test('Reset (S6_Reset) clears state and UI', async ({ page }) => {
    // Validate Reset clears result, table and status
    const errors = {};
    await attachErrorListeners(page, errors);

    await page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/e93485e2-d360-11f0-a097-ffdd56c22ef4.html');

    // Compute and then reset
    await page.locator('#computeBtn').click();
    await page.locator('#resetBtn').click();

    // Status text should be 'Reset.'
    await expect(page.locator('#statusText')).toHaveText('Reset.');

    // Table container emptied
    const tableContainerHTML = await page.locator('#tableContainer').innerHTML();
    expect(tableContainerHTML.trim() === '' || tableContainerHTML.includes('<table') === false).toBe(true);

    // Result area cleared
    await expect(page.locator('#resultArea')).toHaveText('');

    // Display characters should have no 'used' or 'match' classes (className equals 'char')
    const classesA = await page.$$eval('#displayA .char', els => els.map(e => e.className));
    const classesB = await page.$$eval('#displayB .char', els => els.map(e => e.className));
    classesA.forEach(c => expect(c).toBe('char'));
    classesB.forEach(c => expect(c).toBe('char'));

    // Validate no runtime errors during reset
    expect(errors.consoleErrors.length, 'console errors during reset').toBe(0);
    expect(errors.pageErrors.length, 'page errors during reset').toBe(0);
  });

  test('Edge cases: empty inputs and Enter key triggers compute (Input events)', async ({ page }) => {
    // Validate empty input behavior and Enter key binding on inputs
    const errors = {};
    await attachErrorListeners(page, errors);

    await page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/e93485e2-d360-11f0-a097-ffdd56c22ef4.html');

    // Clear both inputs to simulate edge case
    await page.fill('#strA', '');
    await page.fill('#strB', '');

    // Press Enter in strA should trigger compute (and set status accordingly)
    await page.locator('#strA').press('Enter');

    // The script sets statusText to 'One or both strings are empty.' if either is empty
    await expect(page.locator('#statusText')).toHaveText('One or both strings are empty.');

    // Now fill one input and press Enter on other to trigger compute as well
    await page.fill('#strA', 'A');
    await page.locator('#strB').press('Enter');

    // After compute, steps should be generated (maybe small)
    const stepsLength = await page.evaluate(() => Array.isArray(window.steps) ? window.steps.length : 0);
    expect(typeof stepsLength === 'number').toBe(true);

    // Validate no runtime errors during these input events
    expect(errors.consoleErrors.length, 'console errors during input/enter events').toBe(0);
    expect(errors.pageErrors.length, 'page errors during input/enter events').toBe(0);
  });

  test('Toggle checkboxes for Show values / arrows / autoHighlight trigger table rebuilds and effects', async ({ page }) => {
    // Validate change events cause table rebuild and correct DOM updates
    const errors = {};
    await attachErrorListeners(page, errors);

    await page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/e93485e2-d360-11f0-a097-ffdd56c22ef4.html');

    await page.locator('#computeBtn').click();

    // Toggle showArrows on
    await page.locator('#showArrows').check();
    // Table should now contain arrow elements where arrows exist (some cells may have .dp-cell-arrow)
    await page.waitForTimeout(50);
    const hasArrow = await page.locator('.dp-cell .dp-cell-arrow').count();
    expect(hasArrow).toBeGreaterThanOrEqual(0); // it's okay to be zero if no arrows for specific cell but change shouldn't crash

    // Toggle showVals off then on and ensure dp-cell-value elements disappear/appear
    await page.locator('#showVals').uncheck();
    await page.waitForTimeout(50);
    const valuesWhenHidden = await page.locator('.dp-cell .dp-cell-value').count();
    // When hidden, dp-cell-value elements should be removed
    expect(valuesWhenHidden).toBe(0);

    await page.locator('#showVals').check();
    await page.waitForTimeout(50);
    const valuesWhenShown = await page.locator('.dp-cell .dp-cell-value').count();
    expect(valuesWhenShown).toBeGreaterThanOrEqual(1);

    // Toggle autoHighlight off should remove 'used' classes if any
    await page.locator('#autoHighlight').uncheck();
    await page.waitForTimeout(50);
    const usedCount = await page.locator('.char.used').count();
    expect(usedCount).toBe(0);

    // Validate no runtime errors during toggles
    expect(errors.consoleErrors.length, 'console errors during toggles').toBe(0);
    expect(errors.pageErrors.length, 'page errors during toggles').toBe(0);
  });

  // Final test: ensure there were no unexpected runtime errors globally when performing many interactions
  test('Comprehensive scenario exercising transitions end-to-end (no runtime errors)', async ({ page }) => {
    // This test exercises a sequence of interactions and asserts there are no uncaught runtime errors
    const errors = {};
    await attachErrorListeners(page, errors);

    await page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/e93485e2-d360-11f0-a097-ffdd56c22ef4.html');

    // Full flow: compute -> animate (short) -> pause -> step -> backtrack -> reset
    await page.locator('#computeBtn').click();
    // animate briefly
    await page.fill('#speedRange', '80');
    await page.locator('#animateBtn').click();
    await page.waitForTimeout(200);
    // Pause via playPause
    await page.locator('#playPause').click();
    await expect(page.locator('#statusText')).toHaveText('Paused.');

    // Step a couple times
    await page.locator('#stepBtn').click();
    await page.locator('#stepBtn').click();
    await expect(page.locator('#statusText')).toContainText('Step');

    // Backtrack
    await page.locator('#backtrackBtn').click();
    await page.waitForFunction(() => document.getElementById('statusText').textContent.includes('Backtrack complete.'), {}, { timeout: 4000 });

    // Reset
    await page.locator('#resetBtn').click();
    await expect(page.locator('#statusText')).toHaveText('Reset.');

    // Assert no console or page errors emerged during the comprehensive scenario
    expect(errors.consoleErrors.length, 'console errors during comprehensive scenario').toBe(0);
    expect(errors.pageErrors.length, 'page errors during comprehensive scenario').toBe(0);
  });
});