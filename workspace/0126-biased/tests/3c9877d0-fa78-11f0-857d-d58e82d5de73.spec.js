import { test, expect } from '@playwright/test';

// Increase global timeout to allow the animation to run to completion in CI environments
test.setTimeout(120000);

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9877d0-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Backtracking Visualization - FSM comprehensive tests', () => {
  let consoleErrors;
  let pageErrors;

  // Attach listeners before each test to capture console.error and page exceptions
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture console errors
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      // capture unhandled exceptions from the page context
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate and wait for onload handler to run (the app sets window.onload = init)
    await page.goto(APP_URL);
    await page.waitForLoadState('load');
  });

  // Test initial Idle state S0_Idle
  test('Initial Idle state: reset disabled, start enabled, and visual elements initialized', async ({ page }) => {
    // This test validates the S0_Idle evidence:
    // - resetBtn.disabled = true
    // - start button present and enabled
    // - visualizer grid and start/end cells are present
    //
    // Also ensures no console/page errors occurred during initial load.

    // Reset should be disabled at idle
    await expect(page.locator('#reset-btn')).toBeDisabled();

    // Start should be enabled
    await expect(page.locator('#start-btn')).toBeEnabled();

    // Start button aria-pressed should be "false" initially
    await expect(page.locator('#start-btn')).toHaveAttribute('aria-pressed', 'false');

    // Visualizer exists
    await expect(page.locator('.visualizer')).toBeVisible();

    // Grid should have been generated (many <line> and <rect> elements inside the svg)
    const svgLines = await page.locator('#backtrack-svg line').count();
    const svgRects  = await page.locator('#backtrack-svg rect').count();
    expect(svgLines).toBeGreaterThan(0);
    expect(svgRects).toBeGreaterThan(0);

    // Start and end cells should be marked by classes 'start' and 'end'
    const startCells = await page.locator('#backtrack-svg rect.start').count();
    const endCells = await page.locator('#backtrack-svg rect.end').count();
    expect(startCells).toBeGreaterThanOrEqual(1);
    expect(endCells).toBeGreaterThanOrEqual(1);

    // No console errors or page errors on initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test that StartClick triggers the Animating state S1_Animating and some path updates happen
  test('StartClick transitions to Animating (S1_Animating) and yields visual path steps', async ({ page }) => {
    // This test validates:
    // - Clicking #start-btn triggers animateBacktracking()
    // - startBtn.disabled becomes true while animating
    // - at least one cell gets the 'path' class soon after starting

    // Click Start to trigger animation
    await page.click('#start-btn');

    // Immediately, start button should be disabled (evidence of animating = true, startBtn.disabled = true)
    await expect(page.locator('#start-btn')).toBeDisabled();

    // While animating, we expect at least one 'path' cell to appear within a reasonable timeout
    // The implementation yields a path step then awaits ~350ms, so 5s timeout should be enough
    await page.waitForSelector('#backtrack-svg rect.cell.path', { timeout: 10000 });

    const pathCount = await page.locator('#backtrack-svg rect.cell.path').count();
    expect(pathCount).toBeGreaterThan(0);

    // There should be no console errors produced by starting the animation
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test that the animation eventually completes moving to Completed (S2_Completed)
  test('Animation completes to Completed (S2_Completed) and highlights the solution path', async ({ page }) => {
    // This test validates:
    // - After clicking Start, the run completes and resetBtn becomes enabled (animating => false)
    // - The solution path is highlighted (cells retain 'path' class and path fill color)
    // - startBtn becomes enabled again and resetBtn becomes enabled
    //
    // NOTE: We wait for the reset button to become enabled which the implementation flips at the end.

    // Kick off the animation
    await page.click('#start-btn');

    // Wait for completion: reset button will be enabled when animation finishes
    // The animation may take several seconds; allow up to 60s
    await page.waitForSelector('#reset-btn:not([disabled])', { timeout: 60000 });

    // After completion:
    await expect(page.locator('#start-btn')).toBeEnabled();
    await expect(page.locator('#reset-btn')).toBeEnabled();

    // There should be at least one cell with 'path' class (solution highlighted)
    const finalPathCount = await page.locator('#backtrack-svg rect.cell.path').count();
    expect(finalPathCount).toBeGreaterThan(0);

    // Sample a path cell and assert its fill attribute corresponds to the path highlight color
    // Implementation sets pathColor = '#3b82f6cc' when highlighting path cells
    const samplePathLocator = page.locator('#backtrack-svg rect.cell.path').first();
    const sampleFill = await samplePathLocator.getAttribute('fill');
    // The highlightSolution and animateBacktracking set fill to '#3b82f6cc' for path cells
    expect(sampleFill).toBe('#3b82f6cc');

    // Check aria-pressed toggles to expected values (start false after completion, reset true)
    await expect(page.locator('#start-btn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#reset-btn')).toHaveAttribute('aria-pressed', 'true');

    // No console or page errors should have occurred during the entire animation to completion
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test ResetClick transitions back to Idle (S0_Idle) from Completed or Animating via resetVisualization
  test('ResetClick transitions back to Idle (S0_Idle) and clears visual states', async ({ page }) => {
    // This test validates:
    // - After animation completes, clicking Reset calls resetVisualization()
    // - resetVisualization disables reset button, enables start button, and clears path/deadend classes

    // Start and wait for completion
    await page.click('#start-btn');
    await page.waitForSelector('#reset-btn:not([disabled])', { timeout: 60000 });

    // Sanity check: there are path elements currently
    const beforeResetPathCount = await page.locator('#backtrack-svg rect.cell.path').count();
    expect(beforeResetPathCount).toBeGreaterThan(0);

    // Click reset to return to Idle
    await page.click('#reset-btn');

    // After reset, reset should be disabled and start enabled (evidence of Idle)
    await expect(page.locator('#reset-btn')).toBeDisabled();
    await expect(page.locator('#start-btn')).toBeEnabled();

    // Visual path classes should be cleared (no .cell.path)
    // Give a short moment for the resetVisualization/clearVisualStates to update DOM
    await page.waitForTimeout(200); // small pause to let transitions apply
    const afterResetPathCount = await page.locator('#backtrack-svg rect.cell.path').count();
    expect(afterResetPathCount).toBe(0);

    // Start and reset aria-pressed attributes should represent Idle state: start false, reset false
    await expect(page.locator('#start-btn')).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('#reset-btn')).toHaveAttribute('aria-pressed', 'false');

    // No console or page errors in the process
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: attempt to trigger Start while animating; should be ignored and not produce errors
  test('Edge case: clicking Start while animating is ignored and produces no errors', async ({ page }) => {
    // This test validates:
    // - The click handler for Start checks animating and returns early if already animating
    // - Rapid user attempts to start again should not produce JS errors

    // Start animation
    await page.click('#start-btn');

    // Immediately try to click Start again (the button should become disabled quickly)
    // We avoid forcing the click to keep behavior realistic (disabled buttons are not normally clickable)
    // But clicking again without force should not do anything and should not produce errors
    try {
      await page.click('#start-btn', { timeout: 1000 });
    } catch (err) {
      // If click fails because element is disabled/uninteractable, that's acceptable and not a JS error
      // We swallow that here because the important part is that no console/page errors occurred
    }

    // Wait briefly and then cancel the animation by clicking Reset when enabled later
    await page.waitForSelector('#reset-btn:not([disabled])', { timeout: 60000 });

    // Ensure there were no JS console errors during the rapid double-click scenario
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Explicit test to observe page console and pageerror events during typical interaction sequence.
  test('Observe console and page errors during load and interactions - must be none', async ({ page }) => {
    // This test merely performs a typical full flow and asserts the page produced no reported errors.
    // Flow: load -> start -> wait completion -> reset
    await page.click('#start-btn');
    await page.waitForSelector('#reset-btn:not([disabled])', { timeout: 60000 });
    await page.click('#reset-btn');

    // Small pause to collect any late errors
    await page.waitForTimeout(250);

    // Assert no console or page errors occurred across the entire flow
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});