import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f180cb40-d366-11f0-9b19-a558354ece3e.html';

/**
 * Page Object for the Adjacency Matrix Demonstration app.
 * Encapsulates common interactions and queries against the page.
 */
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateButton = page.locator('#generate-graph');
    this.clearButton = page.locator('#clear-graph');
    this.toggleDirectedButton = page.locator('#toggle-directed');
    this.nodeCountInput = page.locator('#node-count');
    this.matrixContainer = page.locator('#matrix-display');
    this.canvas = page.locator('#graph-canvas');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Set number of nodes in the input element
  async setNodeCount(n) {
    await this.nodeCountInput.fill(String(n));
  }

  async clickGenerate() {
    await this.generateButton.click();
    // Wait for matrix to update (table appears)
    await this.page.waitForSelector('#matrix-display table');
  }

  async clickClear() {
    await this.clearButton.click();
    await this.page.waitForSelector('#matrix-display table');
  }

  async clickToggleDirected() {
    await this.toggleDirectedButton.click();
    // wait for matrix re-render
    await this.page.waitForSelector('#matrix-display table');
  }

  // Click a matrix cell by row/col indices (data attributes are strings)
  async clickMatrixCell(row, col) {
    const selector = `#matrix-display td.edge-cell[data-row="${row}"][data-col="${col}"]`;
    await this.page.click(selector);
    // short wait to ensure DOM update after click handler
    await this.page.waitForTimeout(50);
  }

  // Returns the matrix as nested arrays of numbers parsed from the table
  async getMatrixFromDOM() {
    return await this.page.evaluate(() => {
      const table = document.querySelector('#matrix-display table');
      if (!table) return null;
      const rows = Array.from(table.querySelectorAll('tr')).slice(1); // skip header
      return rows.map((tr) => {
        const cells = Array.from(tr.querySelectorAll('td.edge-cell'));
        return cells.map((td) => parseInt(td.textContent, 10));
      });
    });
  }

  // Get number of rows in the table including header
  async getTableRowCount() {
    return await this.page.evaluate(() => {
      const table = document.querySelector('#matrix-display table');
      return table ? table.querySelectorAll('tr').length : 0;
    });
  }

  // Read application-level graph state if available globally (graph is defined in page)
  async getGraphState() {
    return await this.page.evaluate(() => {
      // Do not modify globals - only read
      if (typeof window.graph === 'undefined') return null;
      return {
        size: window.graph.size,
        isDirected: window.graph.isDirected,
        matrix: window.graph.matrix
      };
    });
  }
}

test.describe('Adjacency Matrix Demonstration - FSM validation (f180cb40-d366-11f0-9b19-a558354ece3e)', () => {
  let app;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors for observation/assertion
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (error) => {
      // Collect page errors (uncaught exceptions)
      pageErrors.push(error);
    });

    app = new AppPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // Basic sanity: ensure we collected console messages array and pageErrors array exists
    // We do not modify page state here.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();
  });

  test('S0_Idle: Initial idle state renders page and basic controls', async ({ page }) => {
    // Validate initial rendering: H1 exists, controls present, default node count, and initial matrix displayed
    await expect(page.locator('h1')).toHaveText('Adjacency Matrix Demonstration');
    await expect(app.generateButton).toBeVisible();
    await expect(app.clearButton).toBeVisible();
    await expect(app.toggleDirectedButton).toBeVisible();
    await expect(app.nodeCountInput).toHaveValue('5'); // default value as per HTML

    // The initial updateDisplay() is called at bottom of the HTML; verify the matrix table exists with default size 5
    const tableRowCount = await app.getTableRowCount();
    // table includes header row + 5 data rows => total 6
    expect(tableRowCount).toBe(6);

    // Ensure no uncaught page errors occurred during initial load
    expect(pageErrors.length).toBe(0);
  });

  test('GenerateGraph (Transition S0 -> S1): Generate graph resizes matrix to chosen node count', async ({ page }) => {
    // Set node count to 4 and click generate
    await app.setNodeCount(4);
    await app.clickGenerate();

    // Validate the DOM table updated (header + 4 rows)
    const rows = await app.getTableRowCount();
    expect(rows).toBe(5); // header + 4

    // Validate the internal graph size if available
    const graphState = await app.getGraphState();
    expect(graphState).not.toBeNull();
    expect(graphState.size).toBe(4);

    // Validate the matrix from DOM is 4x4 and all entries are zeros initially
    const matrix = await app.getMatrixFromDOM();
    expect(matrix.length).toBe(4);
    matrix.forEach((r) => {
      expect(r.length).toBe(4);
      r.forEach((cell) => expect(cell).toBe(0));
    });

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('ToggleEdge (S1 -> S1): Clicking an edge cell toggles edge (undirected behavior)', async ({ page }) => {
    // Ensure graph is in a known undirected state with size 5
    await app.setNodeCount(5);
    await app.clickGenerate();

    // Click cell (1,2) in undirected mode; both (1,2) and (2,1) should become 1
    await app.clickMatrixCell(1, 2);

    // Read matrix from DOM
    let matrix = await app.getMatrixFromDOM();
    expect(matrix[1][2]).toBe(1);
    expect(matrix[2][1]).toBe(1);

    // Click the same cell again to remove edge; both should go back to 0
    await app.clickMatrixCell(1, 2);
    matrix = await app.getMatrixFromDOM();
    expect(matrix[1][2]).toBe(0);
    expect(matrix[2][1]).toBe(0);

    // Clicking a diagonal cell should have no effect (no self-loops)
    await app.clickMatrixCell(0, 0);
    matrix = await app.getMatrixFromDOM();
    expect(matrix[0][0]).toBe(0);

    // Ensure internal graph matrix matches DOM
    const graphState = await app.getGraphState();
    expect(graphState.matrix[1][2]).toBe(matrix[1][2]);
    expect(pageErrors.length).toBe(0);
  });

  test('ToggleDirected (S1 -> S3): Toggle directed mode and verify asymmetric edge toggling, then convert back to undirected', async ({ page }) => {
    // Create a small graph for easier assertions
    await app.setNodeCount(3);
    await app.clickGenerate();

    // Turn on directed mode
    await app.clickToggleDirected();

    // Confirm graph.isDirected is true
    let graphState = await app.getGraphState();
    expect(graphState.isDirected).toBe(true);

    // In directed mode, clicking (0,1) should only set matrix[0][1] to 1, not matrix[1][0]
    await app.clickMatrixCell(0, 1);
    let matrix = await app.getMatrixFromDOM();
    expect(matrix[0][1]).toBe(1);
    expect(matrix[1][0]).toBe(0);

    // Now toggle directed back to undirected
    await app.clickToggleDirected();

    // Confirm graph.isDirected is false
    graphState = await app.getGraphState();
    expect(graphState.isDirected).toBe(false);

    // After converting to undirected, entries should be symmetric: because one of the pair was 1, both should be 1
    matrix = await app.getMatrixFromDOM();
    expect(matrix[0][1]).toBe(1);
    expect(matrix[1][0]).toBe(1);

    expect(pageErrors.length).toBe(0);
  });

  test('ClearGraph (S1 -> S2): Clear graph empties all edges', async ({ page }) => {
    // Generate size 4 and create a couple of edges
    await app.setNodeCount(4);
    await app.clickGenerate();

    await app.clickMatrixCell(0, 1);
    await app.clickMatrixCell(2, 3);

    let matrix = await app.getMatrixFromDOM();
    // Ensure some edges exist before clearing
    expect(matrix[0][1]).toBe(1);
    expect(matrix[1][0]).toBe(1); // undirected
    expect(matrix[2][3]).toBe(1);
    expect(matrix[3][2]).toBe(1);

    // Click clear
    await app.clickClear();

    // After clearing, all entries should be zero
    matrix = await app.getMatrixFromDOM();
    matrix.forEach((row) => row.forEach((cell) => expect(cell).toBe(0)));

    // Also ensure internal graph matrix matches
    const graphState = await app.getGraphState();
    graphState.matrix.forEach((row) => row.forEach((cell) => expect(cell).toBe(0)));

    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: Node count boundaries & robust handling', async ({ page }) => {
    // Minimum allowed nodes (2)
    await app.setNodeCount(2);
    await app.clickGenerate();
    let rows = await app.getTableRowCount();
    expect(rows).toBe(3); // header + 2

    // Maximum allowed nodes (10)
    await app.setNodeCount(10);
    await app.clickGenerate();
    rows = await app.getTableRowCount();
    expect(rows).toBe(11); // header + 10

    // Try invalid small value (below min) by directly setting input and generating;
    // The UI input has min=2 but browsers may still submit lower values via script.
    // We respect the page as-is: set to 1 and click generate, then observe behavior.
    await app.setNodeCount(1);
    await app.clickGenerate();

    // The implementation will set graph.size = 1 and create a 1x1 table - ensure app didn't crash.
    // The FSM expects sizes between 2-10 but the implementation doesn't guard strictly.
    const tableRowsAfterInvalid = await app.getTableRowCount();
    expect(tableRowsAfterInvalid).toBeGreaterThanOrEqual(1);

    // Confirm no uncaught exceptions during these boundary operations
    expect(pageErrors.length).toBe(0);
  });

  test('Console and error observation: Capture console messages and page errors (no uncaught runtime errors expected)', async ({ page }) => {
    // Ensure we've captured some console messages array (may be empty)
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // Ensure no uncaught page errors were thrown during app use
    // If there are errors, this test will fail and surface those issues without attempting to patch them.
    expect(pageErrors.length).toBe(0);
  });
});