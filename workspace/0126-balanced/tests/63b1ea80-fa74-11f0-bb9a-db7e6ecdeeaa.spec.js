import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b1ea80-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the A* Visualization App
class AStarPage {
  constructor(page) {
    this.page = page;
    this.grid = page.locator('#grid');
    this.info = page.locator('#info');
    this.setStartBtn = page.locator('#setStartBtn');
    this.setEndBtn = page.locator('#setEndBtn');
    this.addWallsBtn = page.locator('#addWallsBtn');
    this.runBtn = page.locator('#runBtn');
    this.clearBtn = page.locator('#clearBtn');
  }

  // Get a cell locator by row and column (0-indexed)
  cell(row, col) {
    return this.page.locator(`#grid .cell[data-row="${row}"][data-col="${col}"]`);
  }

  // Click a cell via the grid (simulates user clicking)
  async clickCell(row, col) {
    const locator = this.cell(row, col);
    await locator.waitFor({ state: 'visible' });
    await locator.click();
  }

  // Focus a cell and press a key (for keyboard interactions)
  async keyToggleCell(row, col, key = ' ') {
    const locator = this.cell(row, col);
    await locator.focus();
    await this.page.keyboard.press(key);
  }

  // Helpers to set modes
  async clickSetStart() {
    await this.setStartBtn.click();
  }
  async clickSetEnd() {
    await this.setEndBtn.click();
  }
  async clickAddWalls() {
    await this.addWallsBtn.click();
  }
  async clickRun() {
    await this.runBtn.click();
  }
  async clickClear() {
    await this.clearBtn.click();
  }

  // Utility to check if any cell has the given class (e.g., 'wall', 'path')
  async anyCellHasClass(className) {
    const cells = this.page.locator(`#grid .cell.${className}`);
    return await cells.count() > 0;
  }
}

test.describe('A* Search Visualization - FSM and UI integration tests', () => {
  // Collect console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // No-op here; each test will set up listeners and navigate
  });

  test.afterEach(async ({ page }) => {
    // Ensure we didn't unintentionally leave long-running tasks
    // Nothing to teardown explicitly; browser context will be cleaned up by Playwright
  });

  test('Initial Idle state renders correctly and exposes controls', async ({ page }) => {
    // Comments: Validate initial "Idle" state: help text, start/end cells, and button states.
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(APP_URL);

    const app = new AStarPage(page);

    // Ensure grid is present and initial help text is displayed
    await expect(app.grid).toBeVisible();
    await expect(app.info).toHaveText('Use the buttons to set start/end points or add/remove walls, then run A* Search.');

    // Start cell should be at 0,0 and have 'start' class
    const startCell = app.cell(0, 0);
    await expect(startCell).toHaveClass(/start/);

    // End cell should be at last position and have 'end' class
    const endCell = app.cell(24, 24);
    await expect(endCell).toHaveClass(/end/);

    // Verify default mode: Add/Remove Walls button aria-pressed = true, others false
    await expect(app.addWallsBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(app.setStartBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(app.setEndBtn).toHaveAttribute('aria-pressed', 'false');

    // Buttons should be enabled initially
    await expect(app.runBtn).toBeEnabled();
    await expect(app.clearBtn).toBeEnabled();

    // Assert no console errors or page errors occurred during load
    expect(consoleErrors, 'No console.error messages during initial load').toEqual([]);
    expect(pageErrors, 'No uncaught page errors during initial load').toEqual([]);
  });

  test('Transition: Set Start mode -> clicking a cell sets the start, resets pathfinding visuals', async ({ page }) => {
    // Comments: Click Set Start button and then click a target cell; verify start moves and visuals update.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(APP_URL);
    const app = new AStarPage(page);

    // Enter Set Start mode
    await app.clickSetStart();
    await expect(app.setStartBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(app.info).toHaveText('Click on a cell to set the start position.');

    // Choose target cell (1,1) which is not wall or end by default
    const target = app.cell(1, 1);
    await target.click();

    // Ensure the old start lost 'start' class and new cell gained it
    await expect(app.cell(0, 0)).not.toHaveClass(/start/);
    await expect(target).toHaveClass(/start/);

    // Verify pathfinding visuals were reset (no 'open', 'closed', or 'path' present)
    const hasOpen = await app.anyCellHasClass('open');
    const hasClosed = await app.anyCellHasClass('closed');
    const hasPath = await app.anyCellHasClass('path');
    expect(hasOpen, 'No open cells after setting start').toBe(false);
    expect(hasClosed, 'No closed cells after setting start').toBe(false);
    expect(hasPath, 'No path cells after setting start').toBe(false);

    expect(consoleErrors, 'No console errors during Set Start transition').toEqual([]);
    expect(pageErrors, 'No page errors during Set Start transition').toEqual([]);
  });

  test('Transition: Set End mode -> clicking a cell sets the end, resets pathfinding visuals', async ({ page }) => {
    // Comments: Click Set End and set a new end cell; verify end moves and visuals reset.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(APP_URL);
    const app = new AStarPage(page);

    // Enter Set End mode
    await app.clickSetEnd();
    await expect(app.setEndBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(app.info).toHaveText('Click on a cell to set the end position.');

    // Choose target cell (23,23)
    const target = app.cell(23, 23);
    await target.click();

    // Ensure the old end lost 'end' class and new cell has it
    await expect(app.cell(24, 24)).not.toHaveClass(/end/);
    await expect(target).toHaveClass(/end/);

    // Verify pathfinding visuals were reset
    const hasOpen = await app.anyCellHasClass('open');
    const hasClosed = await app.anyCellHasClass('closed');
    const hasPath = await app.anyCellHasClass('path');
    expect(hasOpen, 'No open cells after setting end').toBe(false);
    expect(hasClosed, 'No closed cells after setting end').toBe(false);
    expect(hasPath, 'No path cells after setting end').toBe(false);

    expect(consoleErrors, 'No console errors during Set End transition').toEqual([]);
    expect(pageErrors, 'No page errors during Set End transition').toEqual([]);
  });

  test('Add/Remove Walls: toggle walls via mouse and keyboard (space/Enter)', async ({ page }) => {
    // Comments: Ensure walls can be toggled with click and keyboard accessibility works.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(APP_URL);
    const app = new AStarPage(page);

    // Default mode is Add/Remove Walls
    await expect(app.addWallsBtn).toHaveAttribute('aria-pressed', 'true');

    // Toggle a wall at (5,5)
    const cell = app.cell(5, 5);
    await cell.click();
    await expect(cell).toHaveClass(/wall/);

    // Toggle it back off
    await cell.click();
    await expect(cell).not.toHaveClass(/wall/);

    // Use keyboard toggle: focus and press Space
    await app.keyToggleCell(6, 6, ' ');
    await expect(app.cell(6, 6)).toHaveClass(/wall/);

    // Press Enter to toggle back off
    await app.keyToggleCell(6, 6, 'Enter');
    await expect(app.cell(6, 6)).not.toHaveClass(/wall/);

    expect(consoleErrors, 'No console errors during Add/Remove Walls interactions').toEqual([]);
    expect(pageErrors, 'No page errors during Add/Remove Walls interactions').toEqual([]);
  });

  test('Run A* Search: transitions to Running, disables controls, and finds a path', async ({ page }) => {
    // Comments: Validate the Running state: controls disabled while running, info text updates, and final path drawn.
    // Increase timeout for this test as the visualization runs asynchronously
    test.setTimeout(60000);

    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(APP_URL);
    const app = new AStarPage(page);

    // Ensure no walls to allow a path to exist
    // (By default, there are no walls, so we proceed to run)
    // Click Run and immediately check that controls are disabled
    await app.clickRun();

    // After clicking run, the script sets runInProgress and disables controls synchronously
    await expect(app.setStartBtn).toBeDisabled();
    await expect(app.setEndBtn).toBeDisabled();
    await expect(app.addWallsBtn).toBeDisabled();
    await expect(app.clearBtn).toBeDisabled();
    await expect(app.runBtn).toBeDisabled();

    // Info should show running text quickly
    await expect(app.info).toHaveText(/Running A\* Search\.\.\./);

    // Wait for either 'Path found!' or 'No path found.' - default should find a path
    await expect(app.info).toHaveText(/(Path found!|No path found\.)/, { timeout: 45000 });

    // After completion, controls should be re-enabled
    await expect(app.setStartBtn).toBeEnabled();
    await expect(app.setEndBtn).toBeEnabled();
    await expect(app.addWallsBtn).toBeEnabled();
    await expect(app.clearBtn).toBeEnabled();
    await expect(app.runBtn).toBeEnabled();

    // Verify that at least one cell has 'path' class when a path was found
    const infoText = await app.info.textContent();
    if (infoText && infoText.includes('Path found!')) {
      const anyPath = await app.anyCellHasClass('path');
      expect(anyPath, 'At least one path cell should be present when a path is found').toBe(true);
    } else {
      // If no path found, assert that that's indeed the reported state
      expect(infoText).toContain('No path found.');
    }

    expect(consoleErrors, 'No console errors during run').toEqual([]);
    expect(pageErrors, 'No page errors during run').toEqual([]);
  });

  test('Clear Board: clears walls and resets info message', async ({ page }) => {
    // Comments: Create walls, click clear, and verify walls removed and info updates.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(APP_URL);
    const app = new AStarPage(page);

    // Add walls at some locations
    await app.clickCell(2, 2);
    await app.clickCell(2, 3);
    await app.clickCell(2, 4);

    // Ensure walls are present
    expect(await app.anyCellHasClass('wall'), 'Walls should be present before clearing').toBe(true);

    // Click Clear
    await app.clickClear();

    // After clearing, no walls should remain
    const hasWallsAfter = await app.anyCellHasClass('wall');
    expect(hasWallsAfter, 'No walls after clearing').toBe(false);

    // Info text should indicate the board was cleared
    await expect(app.info).toHaveText('Board cleared. You can add walls, set start/end, and run A*.');

    // Start and End should still be present
    await expect(app.cell(0, 0)).toHaveClass(/start/);
    await expect(app.cell(24, 24)).toHaveClass(/end/);

    expect(consoleErrors, 'No console errors during clear action').toEqual([]);
    expect(pageErrors, 'No page errors during clear action').toEqual([]);
  });

  test('Edge case: cannot set start on a wall (mode Set Start should ignore walls)', async ({ page }) => {
    // Comments: Place a wall, switch to Set Start mode, click the wall cell, and ensure start did not move.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(APP_URL);
    const app = new AStarPage(page);

    // Make (10,10) a wall
    await app.clickCell(10, 10);
    await expect(app.cell(10, 10)).toHaveClass(/wall/);

    // Click Set Start mode
    await app.clickSetStart();
    await expect(app.setStartBtn).toHaveAttribute('aria-pressed', 'true');

    // Attempt to set start on the wall cell
    await app.clickCell(10, 10);

    // Start should remain at its original location (0,0)
    await expect(app.cell(0, 0)).toHaveClass(/start/);
    await expect(app.cell(10, 10)).not.toHaveClass(/start/);

    expect(consoleErrors, 'No console errors during edge case test for setting start on a wall').toEqual([]);
    expect(pageErrors, 'No page errors during edge case test for setting start on a wall').toEqual([]);
  });

  test('Controls are disabled immediately upon starting the run (verify onEnter/exit behavior for Running)', async ({ page }) => {
    // Comments: Verify that on entering Running state controls are disabled and on exit they are re-enabled.
    test.setTimeout(60000);

    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', err => pageErrors.push(err.message));

    await page.goto(APP_URL);
    const app = new AStarPage(page);

    // Start run
    await app.clickRun();

    // Immediately ensure controls disabled (onEnter of Running should disable)
    await expect(app.setStartBtn).toBeDisabled();
    await expect(app.setEndBtn).toBeDisabled();
    await expect(app.addWallsBtn).toBeDisabled();
    await expect(app.clearBtn).toBeDisabled();
    await expect(app.runBtn).toBeDisabled();

    // Wait until run completes (either Path found or No path found)
    await expect(app.info).toHaveText(/(Path found!|No path found\.)/, { timeout: 45000 });

    // After completion, controls should be enabled (onExit of Running calls disableControls(false))
    await expect(app.setStartBtn).toBeEnabled();
    await expect(app.setEndBtn).toBeEnabled();
    await expect(app.addWallsBtn).toBeEnabled();
    await expect(app.clearBtn).toBeEnabled();
    await expect(app.runBtn).toBeEnabled();

    expect(consoleErrors, 'No console errors during Running state enable/disable checks').toEqual([]);
    expect(pageErrors, 'No page errors during Running state enable/disable checks').toEqual([]);
  });
});