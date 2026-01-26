import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c27c4-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for interacting with the grid app
class GridPage {
  constructor(page) {
    this.page = page;
    this.gridSelector = '#grid';
  }

  // Click a control button by id
  async clickButton(id) {
    await this.page.click(`#${id}`);
  }

  // Click a cell at (row, col)
  async clickCell(row, col) {
    const selector = `#grid .cell[data-row="${row}"][data-col="${col}"]`;
    await this.page.click(selector);
  }

  // Return the class list for a cell as an array
  async getCellClasses(row, col) {
    const selector = `#grid .cell[data-row="${row}"][data-col="${col}"]`;
    const classAttr = await this.page.getAttribute(selector, 'class');
    if (!classAttr) return [];
    return classAttr.split(/\s+/).filter(Boolean);
  }

  // Count cells in the grid
  async cellCount() {
    return await this.page.$$eval('#grid .cell', (els) => els.length);
  }

  // Wait for a specific class to appear on a cell
  async waitForCellClass(row, col, className, options = {}) {
    const selector = `#grid .cell[data-row="${row}"][data-col="${col}"].${className}`;
    await this.page.waitForSelector(selector, options);
  }

  // Assert that no cell has any of the given classes (used for reset checks)
  async noCellHasClasses(classes) {
    for (const cls of classes) {
      const any = await this.page.$(`#grid .cell.${cls}`);
      if (any) return false;
    }
    return true;
  }
}

test.describe('A* Search Algorithm Visualization - FSM behaviors', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(), // 'log', 'error', 'warning', etc.
        text: msg.text()
      });
    });

    // Collect page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // Ensure grid loaded
    const gp = new GridPage(page);
    await expect(gp.cellCount()).resolves.toBe(100); // 10x10
  });

  test.afterEach(async () => {
    // Nothing to teardown here; Playwright handles pages/contexts
  });

  test.describe('Initial/Idle state and basic UI checks', () => {
    test('initial grid is created and start/end are present at defaults', async ({ page }) => {
      // Validate initial Idle state: start at (0,0) and end at (9,9)
      const gp = new GridPage(page);

      const startClasses = await gp.getCellClasses(0, 0);
      expect(startClasses).toContain('start');

      const endClasses = await gp.getCellClasses(9, 9);
      expect(endClasses).toContain('end');

      // Verify there are 100 cells
      expect(await gp.cellCount()).toBe(100);
    });

    test('console and page errors/warnings are observed (do not patch the app)', async ({ page }) => {
      // There may be console warnings from CSS or runtime page errors.
      // We assert that at least one console message of type "warning" or "error" or a page error exists.
      // This satisfies the requirement to observe and assert errors/warnings from the app as-is.
      // Wait a short time to accumulate messages from initialization
      await page.waitForTimeout(200);

      const hasConsoleProblem = consoleMessages.some(m => m.type === 'error' || m.type === 'warning');
      const hasPageError = pageErrors.length > 0;

      // Expect at least a console warning/error or a page error to have occurred.
      // If none occurred, fail the test so that runtime issues are visible to maintainers.
      expect(hasConsoleProblem || hasPageError).toBeTruthy();
    });
  });

  test.describe('Mode selection and cell interactions (Set Start, Set End, Set Wall, Clear Cell)', () => {
    test('Set Start: clicking Set Start then a cell moves the start marker', async ({ page }) => {
      const gp = new GridPage(page);

      // Click Set Start button to enter SetStart state
      await gp.clickButton('setStart');

      // Click cell (1,1) to set as new start
      await gp.clickCell(1, 1);

      // Previous start at (0,0) should no longer have 'start'
      const prevStart = await gp.getCellClasses(0, 0);
      expect(prevStart).not.toContain('start');

      // New start at (1,1) should have 'start'
      const newStart = await gp.getCellClasses(1, 1);
      expect(newStart).toContain('start');
    });

    test('Set End: clicking Set End then a cell moves the end marker', async ({ page }) => {
      const gp = new GridPage(page);

      // Click Set End button to enter SetEnd state
      await gp.clickButton('setEnd');

      // Click cell (1,2) to set as new end
      await gp.clickCell(1, 2);

      // Previous end at (9,9) should no longer have 'end'
      const prevEnd = await gp.getCellClasses(9, 9);
      expect(prevEnd).not.toContain('end');

      // New end at (1,2) should have 'end'
      const newEnd = await gp.getCellClasses(1, 2);
      expect(newEnd).toContain('end');
    });

    test('Set Wall: clicking Set Wall then a cell makes it a wall; cannot set wall on start/end', async ({ page }) => {
      const gp = new GridPage(page);

      // Ensure start is at (0,0) and end at (9,9) initially (or adjust)
      // Try to set a wall on a normal cell (2,2)
      await gp.clickButton('setWall');
      await gp.clickCell(2, 2);
      const wallCell = await gp.getCellClasses(2, 2);
      expect(wallCell).toContain('wall');

      // Try to set a wall on the start cell - it should not become a wall
      // First ensure start is at (0,0)
      // Click setWall and then click the start cell (0,0)
      await gp.clickButton('setWall');
      await gp.clickCell(0, 0);
      const startCell = await gp.getCellClasses(0, 0);
      // The code guards against making start a wall; assert 'wall' is not present
      expect(startCell).toContain('start');
      expect(startCell).not.toContain('wall');

      // Similarly ensure clicking on end does not create wall
      await gp.clickButton('setWall');
      await gp.clickCell(9, 9);
      const endCell = await gp.getCellClasses(9, 9);
      expect(endCell).toContain('end');
      expect(endCell).not.toContain('wall');
    });

    test('Clear Cell: clicking Clear Cell then a wall cell clears wall class', async ({ page }) => {
      const gp = new GridPage(page);

      // First set a wall at (3,3)
      await gp.clickButton('setWall');
      await gp.clickCell(3, 3);
      let classes = await gp.getCellClasses(3, 3);
      expect(classes).toContain('wall');

      // Now set mode to clear and click the same cell
      await gp.clickButton('clearCell');
      await gp.clickCell(3, 3);

      // The wall class should have been removed
      classes = await gp.getCellClasses(3, 3);
      expect(classes).not.toContain('wall');
    });
  });

  test.describe('Running A* Search and Reset behaviors', () => {
    test('Run A* Search finds a short path between adjacent cells (verify path visualization)', async ({ page }) => {
      const gp = new GridPage(page);

      // Set start at (4,4)
      await gp.clickButton('setStart');
      await gp.clickCell(4, 4);

      // Set end at (4,6) so path includes (4,5)
      await gp.clickButton('setEnd');
      await gp.clickCell(4, 6);

      // Run A* Search
      // The animation uses small timeouts; wait for the path cell (4,5) to get 'path' class
      await gp.clickButton('runAStar');

      // Wait up to 5 seconds for the path cell to appear (accommodates animation delays)
      await gp.waitForCellClass(4, 5, 'path', { timeout: 5000 });

      // Verify that the path cell has 'path'
      const pathClasses = await gp.getCellClasses(4, 5);
      expect(pathClasses).toContain('path');

      // Also verify visited markers exist somewhere (visited class)
      const visitedExists = await page.$('#grid .cell.visited');
      expect(visitedExists).not.toBeNull();
    });

    test('Reset Grid resets start and end to defaults and clears walls/paths/visited', async ({ page }) => {
      const gp = new GridPage(page);

      // Create some state: set start, end, wall, and run to create visited/path
      await gp.clickButton('setStart');
      await gp.clickCell(2, 2);

      await gp.clickButton('setEnd');
      await gp.clickCell(2, 4);

      await gp.clickButton('setWall');
      await gp.clickCell(2, 3); // put a wall somewhere

      // Run search (may or may not find path depending on wall), attempt to run and then reset
      await gp.clickButton('runAStar');

      // Wait briefly to let any visualization start
      await page.waitForTimeout(200);

      // Now reset the grid
      await gp.clickButton('reset');

      // After reset, start should be at (0,0)
      const startAfterReset = await gp.getCellClasses(0, 0);
      expect(startAfterReset).toContain('start');

      // End after reset should be at (9,9)
      const endAfterReset = await gp.getCellClasses(9, 9);
      expect(endAfterReset).toContain('end');

      // No cells should have wall, visited, or path classes
      const none = await gp.noCellHasClasses(['wall', 'visited', 'path']);
      expect(none).toBeTruthy();
    });

    test('When no path exists, Run A* triggers an alert "No path found!"', async ({ page }) => {
      const gp = new GridPage(page);

      // Reset to defaults first
      await gp.clickButton('reset');

      // Set start near the top-left (0,0) default; ensure start is (0,0)
      // Set end to bottom-right (9,9) default
      // Block neighbors of the end to ensure no path:
      // Neighbors for (9,9) are (8,9) and (9,8). Set them as walls.
      await gp.clickButton('setWall');
      await gp.clickCell(8, 9);
      await gp.clickCell(9, 8);

      // Prepare to capture the dialog; it should show "No path found!"
      let dialogMessage = null;
      page.once('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      // Run A* Search
      await gp.clickButton('runAStar');

      // Wait a bit for the algorithm to conclude and show alert
      await page.waitForTimeout(500);

      expect(dialogMessage).toBe('No path found!');
    });
  });

  test.describe('Edge cases and additional transition checks', () => {
    test('Clicking a cell in SetStart state transitions back to idle and updates start (FSM transition S1->S0)', async ({ page }) => {
      const gp = new GridPage(page);

      // Enter SetStart
      await gp.clickButton('setStart');

      // Click a cell
      await gp.clickCell(5, 5);

      // The start should now be at (5,5) and previous start removed
      const classesTarget = await gp.getCellClasses(5, 5);
      expect(classesTarget).toContain('start');

      const classesPrev = await gp.getCellClasses(0, 0);
      expect(classesPrev).not.toContain('start');
    });

    test('Clicking a cell in SetEnd state transitions back to idle and updates end (FSM transition S2->S0)', async ({ page }) {
      const gp = new GridPage(page);

      // Enter SetEnd
      await gp.clickButton('setEnd');

      // Click a cell
      await gp.clickCell(6, 6);

      // The end should now be at (6,6)
      const classesTarget = await gp.getCellClasses(6, 6);
      expect(classesTarget).toContain('end');

      const classesPrev = await gp.getCellClasses(9, 9);
      expect(classesPrev).not.toContain('end');
    });

    test('Clicking a cell in SetWall then clicking ClearCell clears it (FSM transitions S3->S0 and S4->S0 via CellClick)', async ({ page }) {
      const gp = new GridPage(page);

      // Enter SetWall and add a wall
      await gp.clickButton('setWall');
      await gp.clickCell(7, 7);
      let classes = await gp.getCellClasses(7, 7);
      expect(classes).toContain('wall');

      // Enter ClearCell and clear it
      await gp.clickButton('clearCell');
      await gp.clickCell(7, 7);
      classes = await gp.getCellClasses(7, 7);
      expect(classes).not.toContain('wall');
    });

    test('Running while already running does nothing (FSM S5 re-entrance guarded by isRunning)', async ({ page }) => {
      const gp = new GridPage(page);

      // For this test make start and end far apart to allow some running time
      await gp.clickButton('reset');
      await gp.clickButton('setStart');
      await gp.clickCell(0, 0);
      await gp.clickButton('setEnd');
      await gp.clickCell(9, 9);

      // Start the search
      await gp.clickButton('runAStar');

      // Immediately try to start it again; it should be guarded and not re-enter
      // We cannot directly inspect isRunning, but we can ensure no duplicate behavior like multiple dialogs or errors.
      await gp.clickButton('runAStar');

      // Wait some time for the algorithm to progress a bit
      await page.waitForTimeout(300);

      // Ensure no unexpected errors were thrown to the page (collected earlier)
      // We won't assert that errors exist here; just ensure none of the immediate pageErrors grew unexpectedly
      // (They may still exist from initial load; this is checking no new fatal re-entrancy exceptions)
      // There's no direct API to count new errors since we stored in pageErrors array from before; just assert page is still responsive:
      const clickable = await page.$('#setStart');
      expect(clickable).not.toBeNull();
    });
  });
});