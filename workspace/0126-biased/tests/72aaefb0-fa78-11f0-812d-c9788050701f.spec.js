import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aaefb0-fa78-11f0-812d-c9788050701f.html';

// Page Object for the Path Grid application
class PathGridPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Returns number of cells rendered in the grid
  async cellCount() {
    return await this.page.locator('.grid .cell').count();
  }

  // Returns locator for a cell by row/col
  cellLocator(row, col) {
    return this.page.locator(`.cell[data-row="${row}"][data-col="${col}"]`);
  }

  // Click the Visualize button
  async clickVisualize() {
    await this.page.click('#visualize-btn');
  }

  // Click the Reset button
  async clickReset() {
    await this.page.click('#reset-btn');
  }

  // Wait until at least `minPaths` cells have class 'path' (used to detect visualization progress/completion)
  async waitForAtLeastPathCells(minPaths = 5, timeout = 10000) {
    await this.page.waitForFunction(
      (min) => document.querySelectorAll('.grid .cell.path').length >= min,
      minPaths,
      { timeout }
    );
  }

  // Wait until a specific cell has class 'path'
  async waitForCellToHavePath(row, col, timeout = 10000) {
    const locator = this.cellLocator(row, col);
    await expect(locator).toHaveClass(/path/, { timeout });
  }

  // Return whether any elements currently have the 'active' class
  async anyActiveCells() {
    return await this.page.evaluate(() => {
      return document.querySelectorAll('.grid .cell.active').length > 0;
    });
  }

  // Count how many elements have the 'path' class
  async pathCellCount() {
    return await this.page.evaluate(() => document.querySelectorAll('.grid .cell.path').length);
  }
}

test.describe('Dynamic Programming Visualized - FSM states & transitions', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Increase default timeout for actions that rely on animations/timeouts
    test.setTimeout(20000);
  });

  test('Initial state (S0_Idle): renderGrid() called on load and grid is present', async ({ page }) => {
    // Arrays to collect console messages and page errors
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const app = new PathGridPage(page);
    await app.goto();

    // Validate grid rendered (renderGrid executed on DOMContentLoaded)
    const count = await app.cellCount();
    // Grid expected 5x5 per implementation
    expect(count).toBe(25);

    // Validate first cell has 'start' class and last cell has 'end' class
    const startCell = app.cellLocator(0, 0);
    const endCell = app.cellLocator(4, 4);
    await expect(startCell).toHaveClass(/start/);
    await expect(endCell).toHaveClass(/end/);

    // At initial load, there should be no cells with 'path' class (visualization not yet started)
    const initialPathCount = await app.pathCellCount();
    expect(initialPathCount).toBe(0);

    // Ensure there were no uncaught page errors during load
    expect(pageErrors.length).toBe(0);

    // Ensure console didn't emit any 'error' type messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Visualizing via VisualizeClick: cells become active and path is visualized', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new PathGridPage(page);
    await app.goto();

    // Click visualize to start visualization (transition to S1_Visualizing)
    await app.clickVisualize();

    // Immediately after clicking, some 'active' animations should appear shortly.
    // Wait up to 2s for some active cells to appear (they are scheduled with small timeouts)
    await page.waitForTimeout(600); // small wait to let initial style toggles occur
    const anyActive = await app.anyActiveCells();
    // There should be at least one active cell while animation proceeds
    expect(anyActive).toBe(true);

    // Wait for visualization to mark multiple cells as 'path' (completion indicator)
    await app.waitForAtLeastPathCells(8, 12000); // wait up to 12s for many cells to have path

    // Ensure last cell (end) eventually becomes part of a path (visualization reached end)
    await app.waitForCellToHavePath(4, 4, 12000);

    // After visualization completes, assert there are multiple path cells
    const totalPath = await app.pathCellCount();
    expect(totalPath).toBeGreaterThanOrEqual(8);

    // Validate no uncaught errors were raised during visualization
    expect(pageErrors.length).toBe(0);

    // Validate no console 'error' level logs
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1_Visualizing -> S0_Idle via ResetClick: reset should re-render the grid and clear visualization', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new PathGridPage(page);
    await app.goto();

    // Start visualization to create path classes
    await app.clickVisualize();
    await app.waitForAtLeastPathCells(6, 12000);
    const afterVisPathCount = await app.pathCellCount();
    expect(afterVisPathCount).toBeGreaterThanOrEqual(6);

    // Now click reset - expected to transition back to Idle (renderGrid called)
    await app.clickReset();

    // After reset, path classes should be gone (fresh grid)
    // Wait a short moment for re-render to complete
    await page.waitForTimeout(300);
    const finalPathCount = await app.pathCellCount();
    expect(finalPathCount).toBe(0);

    // Ensure start and end classes are present again after reset
    await expect(app.cellLocator(0, 0)).toHaveClass(/start/);
    await expect(app.cellLocator(4, 4)).toHaveClass(/end/);

    // Check no uncaught page errors during reset
    expect(pageErrors.length).toBe(0);

    // Check no console errors emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Self-transition S1_Visualizing on repeated VisualizeClick: clicking Visualize again while running continues visualization', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new PathGridPage(page);
    await app.goto();

    // Click visualize to start process
    await app.clickVisualize();

    // Wait briefly and click visualize again to simulate a user clicking while visualization is active
    await page.waitForTimeout(500);
    await app.clickVisualize();

    // The app should still reach a visualized state (path on end cell)
    await app.waitForCellToHavePath(4, 4, 12000);

    // Validate that there are path cells present indicating continuation
    const pathCount = await app.pathCellCount();
    expect(pathCount).toBeGreaterThanOrEqual(8);

    // No uncaught JS errors expected from multiple clicks
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: clicking Reset during active visualization should re-render without crashing and clear path markers', async ({ page }) => {
    // This test verifies robustness when a reset occurs mid-animation.
    // We capture page errors and console errors to assert none lead to uncaught exceptions.

    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new PathGridPage(page);
    await app.goto();

    // Start visualization
    await app.clickVisualize();

    // Wait a little then trigger reset mid-animation
    await page.waitForTimeout(700);
    await app.clickReset();

    // Wait to allow any pending animation callbacks to run (they may operate on detached nodes)
    await page.waitForTimeout(1500);

    // After reset, ensure there are no 'path' classes (fresh grid)
    const finalPathCount = await app.pathCellCount();
    expect(finalPathCount).toBe(0);

    // Ensure start and end exist
    await expect(app.cellLocator(0, 0)).toHaveClass(/start/);
    await expect(app.cellLocator(4, 4)).toHaveClass(/end/);

    // Observe if there were any page errors during this operation
    // The application implementation is careful about DOM references; we expect no uncaught errors.
    expect(pageErrors.length).toBe(0);

    // Ensure no console-level errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Sanity: repeated resets produce a fresh grid and keep grid size consistent (idempotent renderGrid)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new PathGridPage(page);
    await app.goto();

    // Perform multiple resets in a row
    for (let i = 0; i < 3; i++) {
      await app.clickReset();
      await page.waitForTimeout(150);
      const count = await app.cellCount();
      expect(count).toBe(25); // Should always render 5x5 grid
    }

    // Ensure still no page errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: capture console output and ensure no unexpected JS exceptions (ReferenceError/SyntaxError/TypeError) are thrown', async ({ page }) => {
    // This test explicitly listens for uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const app = new PathGridPage(page);
    await app.goto();

    // Perform a normal flow: visualize then reset to exercise code paths
    await app.clickVisualize();
    await app.waitForAtLeastPathCells(5, 12000);
    await app.clickReset();

    // wait briefly to collect any late errors
    await page.waitForTimeout(500);

    // Assert there were no uncaught exceptions of any kind during the run
    // If there were, pageErrors would contain Error objects (ReferenceError, TypeError, SyntaxError, etc.)
    expect(pageErrors.length).toBe(0);
  });
});