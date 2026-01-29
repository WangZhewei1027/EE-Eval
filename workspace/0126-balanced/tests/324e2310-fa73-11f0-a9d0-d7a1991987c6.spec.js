import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e2310-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object Model for the A* Visualization page
class AStarPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.gridSelector = '#grid';
    this.cellSelector = '#grid .cell';
    this.startBtnSelector = '#startBtn';
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  async initListeners() {
    this.page.on('console', (msg) => {
      // collect console messages for inspection in tests
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // collect uncaught exceptions
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for grid to be initialized by the page script
    await this.page.waitForSelector(this.gridSelector);
  }

  // return locator for a cell by row/col (0-indexed)
  cellLocator(row, col) {
    // cells are appended in row-major order; compute index
    const index = row * 10 + col;
    return this.page.locator(this.cellSelector).nth(index);
  }

  async clickCell(row, col) {
    const cell = this.cellLocator(row, col);
    await cell.click();
  }

  async getCellClasses(row, col) {
    const cell1 = this.cellLocator(row, col);
    const className = await cell.getAttribute('class');
    return (className || '').split(/\s+/).filter(Boolean);
  }

  async clickStart() {
    await this.page.click(this.startBtnSelector);
  }

  async countCells() {
    return await this.page.locator(this.cellSelector).count();
  }

  async countByClass(className) {
    return await this.page.locator(`#grid .${className}`).count();
  }

  async waitForVisited(min = 1, timeout = 2000) {
    // Wait until at least min visited cells exist (or timeout)
    await this.page.waitForFunction(
      (sel, c) => document.querySelectorAll(sel).length >= c,
      {},
      `#grid .visited`,
      min
    , { timeout });
  }
}

test.describe('A* Search Algorithm Visualization - End-to-End Tests (FSM Validation)', () => {
  // Create a fresh page object for each test
  test.beforeEach(async ({ page }) => {
    // Nothing global to set up here; specific tests will create AStarPage and call initListeners/goto
  });

  test('S0_Idle: initializeGrid() should create a 10x10 grid and mark start/goal cells', async ({ page }) => {
    // Validate entry action initializeGrid was executed and Idle state is observable by DOM
    const app = new AStarPage(page);
    await app.initListeners();
    await app.goto();

    // The grid should contain 100 cells (10x10)
    const total = await app.countCells();
    expect(total).toBe(100);

    // Start cell (0,0) should have .start class
    const startClasses = await app.getCellClasses(0, 0);
    expect(startClasses).toContain('start');

    // Goal cell (9,9) should have .goal class
    const goalClasses = await app.getCellClasses(9, 9);
    expect(goalClasses).toContain('goal');

    // The Start button exists and is visible
    await expect(page.locator(app.startBtnSelector)).toBeVisible();

    // No uncaught page errors should be present on initial load
    expect(app.pageErrors.length).toBe(0);
  });

  test('CellClick: clicking a regular cell toggles wall class; clicking start/goal does nothing', async ({ page }) => {
    // Test toggling walls and ensure start/goal can't be turned into walls
    const app1 = new AStarPage(page);
    await app.initListeners();
    await app.goto();

    // Choose a middle cell (5,5) that is not start/goal
    const row = 5, col = 5;
    const initialClasses = await app.getCellClasses(row, col);
    expect(initialClasses).not.toContain('wall');

    // Click to set wall
    await app.clickCell(row, col);
    const afterWallClasses = await app.getCellClasses(row, col);
    expect(afterWallClasses).toContain('wall');

    // Click again to remove wall
    await app.clickCell(row, col);
    const afterRemoveClasses = await app.getCellClasses(row, col);
    expect(afterRemoveClasses).not.toContain('wall');

    // Try toggling start cell - should remain start and not get wall class
    await app.clickCell(0, 0);
    const startClasses1 = await app.getCellClasses(0, 0);
    expect(startClasses).toContain('start');
    expect(startClasses).not.toContain('wall');

    // Try toggling goal cell - should remain goal and not get wall class
    await app.clickCell(9, 9);
    const goalClasses1 = await app.getCellClasses(9, 9);
    expect(goalClasses).toContain('goal');
    expect(goalClasses).not.toContain('wall');

    // Ensure no page errors occurred during clicks
    expect(app.pageErrors.length).toBe(0);
  });

  test('S1_Searching -> S2_PathFound: Starting search on an unblocked grid should run and not trigger "No path found!" alert', async ({ page }) => {
    // Validate transition S0 -> S1 by clicking Start, then observe that search runs and does not show 'No path found!' alert (interpreted as path found)
    const app2 = new AStarPage(page);
    await app.initListeners();
    await app.goto();

    // Setup dialog handler to catch any alert
    let dialogShown = false;
    let dialogMessage = '';
    page.on('dialog', async (dialog) => {
      dialogShown = true;
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    // Click Start to begin A* search
    await app.clickStart();

    // Allow algorithm some time to mark visited nodes (it runs synchronously, but give small breathing room)
    // Wait for at least one visited cell to appear or a dialog to be shown
    try {
      await Promise.race([
        app.page.waitForSelector('#grid .visited', { timeout: 1200 }),
        new Promise((resolve) => setTimeout(resolve, 1200))
      ]);
    } catch (e) {
      // ignore timeout
    }

    // If an alert was shown, it indicates No Path scenario. For this test we expect no alert (path found).
    expect(dialogShown).toBeFalsy();

    // There should be some visited nodes indicating the search progressed
    const visitedCount = await app.countByClass('visited');
    expect(visitedCount).toBeGreaterThanOrEqual(1);

    // The goal should still have 'goal' class
    const goalClasses2 = await app.getCellClasses(9, 9);
    expect(goalClasses).toContain('goal');

    // No uncaught page errors
    expect(app.pageErrors.length).toBe(0);
  });

  test('S1_Searching -> S3_NoPath: Blocking start neighbors should cause "No path found!" alert', async ({ page }) => {
    // Place walls to block all immediate neighbors of the start cell so no path exists, then start search and assert alert appears
    const app3 = new AStarPage(page);
    await app.initListeners();
    await app.goto();

    // Block neighbors of start (0,0): (1,0) and (0,1)
    await app.clickCell(1, 0);
    await app.clickCell(0, 1);

    // Verify they are walls
    expect((await app.getCellClasses(1, 0))).toContain('wall');
    expect((await app.getCellClasses(0, 1))).toContain('wall');

    // Capture dialog
    let dialogSeen = false;
    let dialogText = '';
    page.on('dialog', async (dialog) => {
      dialogSeen = true;
      dialogText = dialog.message();
      // Dismiss so test can continue
      await dialog.dismiss();
    });

    // Click Start to begin A* search
    await app.clickStart();

    // Wait briefly for alert to fire (algorithm is synchronous)
    await page.waitForTimeout(200);

    // Expect an alert indicating no path found
    expect(dialogSeen).toBe(true);
    expect(dialogText).toBe('No path found!');

    // Ensure that due to blocking, visited nodes may be present but path not found
    const visitedCount1 = await app.countByClass('visited');
    expect(visitedCount).toBeGreaterThanOrEqual(0); // can be 0 or more depending on algorithm order

    // No uncaught page errors
    expect(app.pageErrors.length).toBe(0);
  });

  test('S1_Searching transitions: Running search when openSet contains items with undefined f property does not throw runtime error', async ({ page }) => {
    // This test exercises the branch where items may be pushed to openSet without an f property (the implementation does push {cell: neighbor}).
    // We ensure that executing the algorithm does not raise uncaught exceptions (TypeError/ReferenceError/SyntaxError).
    const app4 = new AStarPage(page);
    await app.initListeners();
    await app.goto();

    // Ensure some walls exist so openSet behavior is exercised but not completely blocked; place a few walls combinatorially
    await app.clickCell(2, 0);
    await app.clickCell(0, 2);
    await app.clickCell(1, 1);

    // Track any page errors thrown during the search
    // Start the search
    await app.clickStart();

    // Give a short time for the synchronous algorithm to finish and any errors to bubble up
    await page.waitForTimeout(200);

    // Assert that no uncaught page errors of critical types occurred
    const criticalErrors = app.pageErrors.filter(err => {
      const msg = String(err && err.message ? err.message : err);
      return /ReferenceError|TypeError|SyntaxError/.test(msg);
    });
    expect(criticalErrors.length).toBe(0);

    // Also assert there were no console messages of type 'error'
    const consoleErrors = app.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Rapid toggling of many cells and starting search remains stable', async ({ page }) => {
    // Rapidly toggle a line of walls, then start search to exercise robustness and ensure no page errors
    const app5 = new AStarPage(page);
    await app.initListeners();
    await app.goto();

    // Toggle an entire column 0..9 at column 4
    for (let r = 0; r < 10; r++) {
      await app.clickCell(r, 4);
    }

    // Verify walls count in that column is 10
    let wallsInColumn = 0;
    for (let r = 0; r < 10; r++) {
      if ((await app.getCellClasses(r, 4)).includes('wall')) wallsInColumn++;
    }
    expect(wallsInColumn).toBe(10);

    // Start search - this will either find a path around the wall or alert No path found if fully blocked; we will treat both outcomes as acceptable,
    // but must assert no uncaught runtime errors and ensure UI remains stable (grid still has 100 cells)
    let dialogSeen1 = false;
    page.on('dialog', async (dialog) => {
      dialogSeen = true;
      await dialog.dismiss();
    });

    await app.clickStart();

    await page.waitForTimeout(300);

    // Grid still intact
    const total1 = await app.countCells();
    expect(total).toBe(100);

    // No syntax/reference/type errors
    const criticalErrors1 = app.pageErrors.filter(err => {
      const msg1 = String(err && err.message ? err.message : err);
      return /ReferenceError|TypeError|SyntaxError/.test(msg);
    });
    expect(criticalErrors.length).toBe(0);

    // Console should not contain critical error messages
    const consoleErrors1 = app.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Runtime error observation: Assert there are zero uncaught page errors on a clean load', async ({ page }) => {
    // Explicitly collect page errors and verify none occurred at load time (observability test)
    const app6 = new AStarPage(page);
    await app.initListeners();
    await app.goto();

    // Small wait for any late synchronous errors
    await page.waitForTimeout(100);

    // Expect no page errors caught by the 'pageerror' handler
    expect(app.pageErrors.length).toBe(0);

    // Expect no console messages of type 'error'
    const consoleErrors2 = app.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});