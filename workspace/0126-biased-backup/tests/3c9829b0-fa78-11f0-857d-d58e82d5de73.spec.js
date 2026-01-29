import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9829b0-fa78-11f0-857d-d58e82d5de73.html';

// Page object encapsulating common interactions and queries
class GridPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.gridSelector = '#grid';
    this.runBtn = page.locator('#runBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.cellLocator = page.locator('#grid .cell');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for grid to be populated (DOM generation done in initGrid)
    await this.page.waitForSelector('#grid .cell', { state: 'attached' });
  }

  async getCellCount() {
    return await this.cellLocator.count();
  }

  // Return number of nodes with a given class (visited, frontier, path, wall, start, end, empty)
  async countCellsByClass(cls) {
    return await this.page.$$eval(`#grid .cell.${cls}`, els => els.length);
  }

  async getRunButtonState() {
    const disabled = await this.runBtn.getAttribute('disabled');
    const text = await this.runBtn.textContent();
    return { disabled: disabled !== null, text: text?.trim() ?? '' };
  }

  async getResetButtonState() {
    const disabled = await this.resetBtn.getAttribute('disabled');
    const text = await this.resetBtn.textContent();
    return { disabled: disabled !== null, text: text?.trim() ?? '' };
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  // Wait until at least one cell has one of the animation classes (visited/frontier/path)
  async waitForAnyAnimationClass(timeout = 5000) {
    await this.page.waitForFunction(() => {
      return !!document.querySelector('#grid .cell.visited, #grid .cell.frontier, #grid .cell.path');
    }, { timeout });
  }

  // Wait for the run button to be re-enabled which indicates animation completion per implementation
  async waitForRunCompletion(timeout = 20000) {
    await this.page.waitForFunction(() => {
      const run = document.getElementById('runBtn');
      return run && run.disabled === false;
    }, { timeout });
  }

  // Collect a snapshot of counts for important classes
  async snapshotCounts() {
    const classes = ['visited', 'frontier', 'path', 'wall', 'start', 'end', 'empty'];
    const results = {};
    for (const cls of classes) {
      results[cls] = await this.countCellsByClass(cls);
    }
    return results;
  }
}

test.describe('A* Search Visualization — FSM tests (3c9829b0-fa78-11f0-857d-d58e82d5de73)', () => {
  // Capture console errors and page errors per-test so we can assert on them.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : null
        });
      }
    });

    // Collect uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err.message || String(err));
    });
  });

  test('Initial Idle state: grid initializes and buttons are enabled (S0_Idle)', async ({ page }) => {
    // This test validates the initial Idle state as described in the FSM:
    // - initGrid() called and DOM generated
    // - runBtn.disabled = false and resetBtn.disabled = false
    // - start and end nodes exist and walls are present
    const grid = new GridPage(page);
    await grid.goto();

    // Assertions for initial buttons state
    const runState = await grid.getRunButtonState();
    const resetState = await grid.getResetButtonState();

    // Run and Reset should be enabled (not disabled)
    expect(runState.disabled, 'runBtn should be enabled in Idle state').toBe(false);
    expect(resetState.disabled, 'resetBtn should be enabled in Idle state').toBe(false);
    expect(runState.text).toBe('Run Search');

    // Grid should contain ROWS * COLS cells = 12 * 18 = 216
    const count = await grid.getCellCount();
    expect(count).toBeGreaterThanOrEqual(200); // allow some tolerance but expect full grid
    expect(count).toBe(18 * 12);

    // There must be exactly 1 start and 1 end element
    const startCount = await grid.countCellsByClass('start');
    const endCount = await grid.countCellsByClass('end');
    expect(startCount).toBe(1);
    expect(endCount).toBe(1);

    // There should be some walls generated (visual aesthetic code)
    const wallCount = await grid.countCellsByClass('wall');
    expect(wallCount).toBeGreaterThan(0);

    // Ensure there are no visited/frontier/path classes before any search run
    expect(await grid.countCellsByClass('visited')).toBe(0);
    expect(await grid.countCellsByClass('frontier')).toBe(0);
    expect(await grid.countCellsByClass('path')).toBe(0);

    // Assert that no console errors or page errors occurred on load
    expect(pageErrors, `Unexpected page errors occurred during load: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console.error logs during load: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
  });

  test('Run Search click triggers Searching state and runs animation, then returns to Idle (S0 -> S1 -> S2 -> S0)', async ({ page }) => {
    // This test validates the RunSearchClick and the animation lifecycle:
    // - Clicking Run disables both buttons and sets Run text to 'Searching...'
    // - After a short delay algorithm runs producing visited/frontier/path classes
    // - When animation completes runBtn is re-enabled and text returns to 'Run Search'
    const grid = new GridPage(page);
    await grid.goto();

    // Start run and monitor lifecycle
    // Prepare snapshot before running to compare resetVisuals effect
    const before = await grid.snapshotCounts();
    await grid.clickRun();

    // Immediately after click: runBtn and resetBtn should be disabled and text updated
    // The UI updates synchronously in click handler (it sets disabled and text before setTimeout)
    await page.waitForTimeout(10); // tiny wait to let DOM updates apply
    const afterClickRunState = await grid.getRunButtonState();
    const afterClickResetState = await grid.getResetButtonState();
    expect(afterClickRunState.disabled).toBe(true);
    expect(afterClickResetState.disabled).toBe(true);
    expect(afterClickRunState.text).toBe('Searching...');

    // resetVisuals() should have cleared any previous visited/frontier/path states:
    // So right after clicking run, the counts for these classes should be zero or cleared compared to before.
    const mid = await grid.snapshotCounts();
    expect(mid.visited).toBe(0);
    expect(mid.frontier).toBe(0);
    expect(mid.path).toBe(0);

    // Wait for some animation steps to appear (visited/frontier/path)
    // This ensures we moved into Searching/Animation states with observable DOM changes.
    await grid.waitForAnyAnimationClass(7000);

    // There should be at least some visited or frontier cells
    const visitedCount = await grid.countCellsByClass('visited');
    const frontierCount = await grid.countCellsByClass('frontier');
    const pathCount = await grid.countCellsByClass('path');
    expect(visitedCount + frontierCount + pathCount).toBeGreaterThan(0);

    // Now wait for animation to complete (runBtn re-enabled) - the implementation re-enables both buttons on completion
    await grid.waitForRunCompletion(20000);

    // After completion, ensure run button text returned to 'Run Search' and both buttons enabled
    const finalRunState = await grid.getRunButtonState();
    const finalResetState = await grid.getResetButtonState();
    expect(finalRunState.disabled).toBe(false);
    expect(finalResetState.disabled).toBe(false);
    expect(finalRunState.text).toBe('Run Search');

    // After completion, path may or may not be found; at minimum visited/frontier should exist from exploration
    const finalVisited = await grid.countCellsByClass('visited');
    const finalFrontier = await grid.countCellsByClass('frontier');
    const finalPath = await grid.countCellsByClass('path');
    expect(finalVisited + finalFrontier + finalPath).toBeGreaterThan(0);

    // Ensure no console or page errors happened during the run
    expect(pageErrors, `Unexpected page errors during animation: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console.error logs during animation: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
  });

  test('Reset button resets grid to initial state when idle and after a run (S0 -> S3_Reset)', async ({ page }) => {
    // This test validates Reset behavior both in Idle and after a completed run:
    // - Clicking Reset when Idle should leave start/end/wall/empty classes intact and clear any transient classes
    // - Clicking Reset after a run should clear visited/frontier/path classes and maintain start/end/wall
    const grid = new GridPage(page);
    await grid.goto();

    // First: clicking Reset in Idle state
    const countsBeforeResetIdle = await grid.snapshotCounts();
    await grid.clickReset();

    // There should be no change in start/end/wall counts and no transient classes introduced
    const countsAfterResetIdle = await grid.snapshotCounts();
    expect(countsAfterResetIdle.start).toBe(countsBeforeResetIdle.start);
    expect(countsAfterResetIdle.end).toBe(countsBeforeResetIdle.end);
    expect(countsAfterResetIdle.wall).toBe(countsBeforeResetIdle.wall);
    expect(countsAfterResetIdle.visited).toBe(0);
    expect(countsAfterResetIdle.frontier).toBe(0);
    expect(countsAfterResetIdle.path).toBe(0);

    // Now run a search, wait for completion
    await grid.clickRun();
    await grid.waitForAnyAnimationClass(7000); // ensure animation started
    await grid.waitForRunCompletion(20000);

    // Ensure there are some animation classes to clear
    const countsAfterRun = await grid.snapshotCounts();
    expect(countsAfterRun.visited + countsAfterRun.frontier + countsAfterRun.path).toBeGreaterThan(0);

    // Click Reset after run completes - should clear visited/frontier/path
    await grid.clickReset();
    // Small timeout to allow DOM updates from resetVisuals
    await page.waitForTimeout(50);

    const afterResetCounts = await grid.snapshotCounts();
    expect(afterResetCounts.visited).toBe(0);
    expect(afterResetCounts.frontier).toBe(0);
    expect(afterResetCounts.path).toBe(0);

    // start/end/wall should still be present correctly
    expect(afterResetCounts.start).toBe(1);
    expect(afterResetCounts.end).toBe(1);
    expect(afterResetCounts.wall).toBeGreaterThan(0);

    // Ensure buttons are still enabled after manual reset (as per FSM evidence in S3_Reset)
    const runState = await grid.getRunButtonState();
    const resetState = await grid.getResetButtonState();
    expect(runState.disabled).toBe(false);
    expect(resetState.disabled).toBe(false);

    // Assert no console or page errors occurred during reset flows
    expect(pageErrors, `Unexpected page errors during reset flow: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console.error logs during reset flow: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
  });

  test('Repeated runs: Run again after completion triggers a new search and resets visuals (S2 -> S0 -> S1)', async ({ page }) => {
    // This test validates that after one complete animation cycle the Run button is restored
    // and a subsequent click triggers another search (resetVisuals called again).
    const grid = new GridPage(page);
    await grid.goto();

    // First run
    await grid.clickRun();
    await grid.waitForAnyAnimationClass(7000);
    await grid.waitForRunCompletion(20000);

    // Count path/visited after first run
    const firstRunCounts = await grid.snapshotCounts();
    expect(firstRunCounts.visited + firstRunCounts.frontier + firstRunCounts.path).toBeGreaterThan(0);

    // Click Run again immediately; resetVisuals() should clear previous classes
    await grid.clickRun();

    // After clicking, transient classes should be cleared quickly
    await page.waitForTimeout(20);
    const afterSecondClickCounts = await grid.snapshotCounts();
    expect(afterSecondClickCounts.visited).toBe(0);
    expect(afterSecondClickCounts.frontier).toBe(0);
    expect(afterSecondClickCounts.path).toBe(0);

    // Wait for the second run to produce new animation steps and complete
    await grid.waitForAnyAnimationClass(7000);
    await grid.waitForRunCompletion(20000);

    const secondRunFinalCounts = await grid.snapshotCounts();
    expect(secondRunFinalCounts.visited + secondRunFinalCounts.frontier + secondRunFinalCounts.path).toBeGreaterThan(0);

    // Ensure no console or page errors during repeated runs
    expect(pageErrors, `Unexpected page errors during repeated runs: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console.error logs during repeated runs: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
  });

  test.afterEach(async ({ page }) => {
    // Final safety checks: ensure there were no uncaught page errors or console.error logs during the test.
    // We assert again here to fail fast if any test left errors uncaught.
    expect(pageErrors, `Page errors were observed during test execution: ${JSON.stringify(pageErrors)}`).toHaveLength(0);
    expect(consoleErrors, `Console.error logs were observed during test execution: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
    // Close page to release resources (Playwright fixture handles this, but explicit for clarity)
    try {
      await page.close();
    } catch (e) {
      // ignore close errors
    }
  });
});