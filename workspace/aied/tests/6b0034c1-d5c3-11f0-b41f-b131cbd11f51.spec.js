import { test, expect } from '@playwright/test';

// Test file for Application ID: 6b0034c1-d5c3-11f0-b41f-b131cbd11f51
// URL: http://127.0.0.1:5500/workspace/batch-1207/html/6b0034c1-d5c3-11f0-b41f-b131cbd11f51.html
// This suite validates the FSM states and transitions, DOM updates, and watches for runtime/page errors.
// Note: Tests intentionally do not modify application source; they observe runtime behavior as-is.

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b0034c1-d5c3-11f0-b41f-b131cbd11f51.html';

class AppPage {
  /**
   * Page object encapsulating common interactions with the adjacency matrix app.
   * Methods are small wrappers around Playwright locators and provide assertions helpers.
   */
  constructor(page) {
    this.page = page;
    this.nodeCountInput = page.locator('#nodeCount');
    this.generateBtn = page.locator('#generateBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.randomBtn = page.locator('#randomBtn');
    this.matrixTable = page.locator('#adjacencyMatrix');
    this.edgeCells = () => this.page.locator('#adjacencyMatrix .edge-cell');
    this.matrixInfoEdgeCount = page.locator('#edgeCount');
    this.matrixInfoSymmetry = page.locator('#symmetryCheck');
    this.canvas = page.locator('#graphCanvas');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async setNodeCount(value) {
    await this.nodeCountInput.fill(String(value));
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async clickRandom() {
    await this.randomBtn.click();
  }

  // returns number of table rows (including header)
  async getTableRowCount() {
    return await this.page.evaluate(() => {
      const t = document.getElementById('adjacencyMatrix');
      if (!t) return 0;
      return t.querySelectorAll('tr').length;
    });
  }

  // returns labels of header row as array (A,B,...)
  async getHeaderLabels() {
    return await this.page.evaluate(() => {
      const t = document.getElementById('adjacencyMatrix');
      if (!t) return [];
      const headerRow = t.querySelector('tr');
      if (!headerRow) return [];
      // skip first th (corner)
      const ths = Array.from(headerRow.querySelectorAll('th')).slice(1);
      return ths.map(th => th.textContent.trim());
    });
  }

  // returns array of edge-cell texts as numbers in row-major order
  async getEdgeCellValues() {
    return await this.page.evaluate(() => {
      const cells = Array.from(document.querySelectorAll('#adjacencyMatrix .edge-cell'));
      return cells.map(c => c.textContent.trim());
    });
  }

  async clickEdgeCellByIndex(index) {
    await this.edgeCells().nth(index).click();
  }

  async countEdgePresentCells() {
    return await this.page.evaluate(() => {
      return document.querySelectorAll('#adjacencyMatrix .edge-present').length;
    });
  }

  async getEdgeCountText() {
    return (await this.matrixInfoEdgeCount.textContent())?.trim() ?? '';
  }

  async getSymmetryText() {
    return (await this.matrixInfoSymmetry.textContent())?.trim() ?? '';
  }

  async canvasSize() {
    return await this.page.evaluate(() => {
      const c = document.getElementById('graphCanvas');
      return c ? { width: c.width, height: c.height } : null;
    });
  }
}

test.describe('Adjacency Matrix Visualization - FSM and UI tests', () => {
  // Containers for observed console errors and page errors
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled exceptions (page errors)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app
    const app = new AppPage(page);
    await app.goto();

    // Wait a small amount for initialization side effects (matrix render)
    await page.waitForLoadState('domcontentloaded');
  });

  test.afterEach(async ({ page }) => {
    // Nothing special to teardown; Playwright handles page context cleanup.
    // We keep this hook to satisfy structure and to allow future cleanup steps.
  });

  test('Initial state (S0_Idle) initializes matrix on load', async ({ page }) => {
    // Validate that initializeMatrix() was effectively executed on DOMContentLoaded.
    // We expect the adjacency matrix table to be rendered with default nodeCount (5),
    // matrix info to show 0 edges and symmetric true, and no runtime errors occurred during initialization.
    const app = new AppPage(page);

    // Wait for table to be rendered - header row should exist
    await expect(app.matrixTable).toBeVisible();

    const nodeCountAttr = await app.nodeCountInput.inputValue();
    const nodeCount = Number(nodeCountAttr);

    // Row count should equal nodeCount + 1 (header)
    const rows = await app.getTableRowCount();
    expect(rows).toBe(nodeCount + 1);

    // Header labels should be A..(A+nodeCount-1)
    const headers = await app.getHeaderLabels();
    expect(headers.length).toBe(nodeCount);
    expect(headers[0]).toBe('A');

    // Edge count should start at 0
    const edgeText = await app.getEdgeCountText();
    expect(edgeText).toBe('Total edges: 0');

    // Symmetry should be recognized (no edges -> symmetric)
    const symmetryText = await app.getSymmetryText();
    expect(symmetryText.startsWith('Symmetric')).toBeTruthy();
    // Expect value to be Yes for an initially symmetric zero matrix
    expect(symmetryText).toBe('Symmetric: Yes');

    // Canvas exists and has expected dimensions
    const canvasInfo = await app.canvasSize();
    expect(canvasInfo).not.toBeNull();
    expect(canvasInfo.width).toBeGreaterThanOrEqual(100);
    expect(canvasInfo.height).toBeGreaterThanOrEqual(100);

    // Assert that no runtime page errors or console errors were emitted during initialization
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Generate Matrix (GenerateMatrix event) renders matrix for new node count (S0 -> S1)', async ({ page }) => {
    // Validate clicking Generate Matrix after changing node count re-renders table and info.
    const app = new AppPage(page);

    // Set a smaller node count and generate
    await app.setNodeCount(3);
    await app.clickGenerate();

    // After generating, table rows should be 4 (header + 3)
    await expect(app.matrixTable).toBeVisible();
    const rows = await app.getTableRowCount();
    expect(rows).toBe(4);

    // Header labels should be A, B, C
    const headers = await app.getHeaderLabels();
    expect(headers).toEqual(['A', 'B', 'C']);

    // Edge count should still read 0 and symmetry Yes
    const edgeText = await app.getEdgeCountText();
    expect(edgeText).toBe('Total edges: 0');
    const symmetryText = await app.getSymmetryText();
    expect(symmetryText).toBe('Symmetric: Yes');

    // No runtime errors on this user-driven transition
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ToggleEdge (ToggleEdge event) toggles an off-diagonal cell and updates matrix and graph (S1 -> S2)', async ({ page }) => {
    // Validate toggling an edge updates the cell text, adds edge-present CSS class,
    // updates the Total edges counter, and preserves symmetry.
    const app = new AppPage(page);

    // Ensure matrix generated with 4 nodes for clearer testing
    await app.setNodeCount(4);
    await app.clickGenerate();

    // Get initial cell values
    let values = await app.getEdgeCellValues();
    // pick the second edge-cell which corresponds to row0-col1 (i=0,j=1) in row-major order
    // Ensure it starts as '0'
    expect(values[1]).toBe('0');

    // Click the off-diagonal cell to toggle it on
    await app.clickEdgeCellByIndex(1);

    // After toggling, the cell should show '1' and have class edge-present
    values = await app.getEdgeCellValues();
    expect(values[1]).toBe('1');

    const edgePresentCount = await app.countEdgePresentCells();
    // For symmetric matrix each undirected edge appears twice (i,j and j,i) in the table.
    // Toggling one off-diagonal edge should produce exactly 2 cells with .edge-present
    expect(edgePresentCount).toBeGreaterThanOrEqual(2);

    // Matrix info should reflect 1 undirected edge (edgeCount counts unique edges)
    const edgeText = await app.getEdgeCountText();
    expect(edgeText).toBe('Total edges: 1');

    // Symmetry should be Yes after toggling since code keeps matrix symmetric
    const symmetryText = await app.getSymmetryText();
    expect(symmetryText).toBe('Symmetric: Yes');

    // Toggle same cell off again and verify it returns to '0'
    await app.clickEdgeCellByIndex(1);
    values = await app.getEdgeCellValues();
    expect(values[1]).toBe('0');
    const edgePresentAfter = await app.countEdgePresentCells();
    expect(edgePresentAfter).toBe(0);

    // No runtime errors during toggle interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Clear All Edges (ClearAllEdges event) removes all edges and updates info (S1 -> S1)', async ({ page }) => {
    // Validate that after creating edges, clicking Clear All Edges removes them and updates UI.
    const app = new AppPage(page);

    // Generate matrix and create a couple of edges
    await app.setNodeCount(5);
    await app.clickGenerate();

    // Toggle two distinct off-diagonal cells (ensure different edges)
    await app.clickEdgeCellByIndex(1); // edge (0,1)
    await app.clickEdgeCellByIndex(3); // likely edge (0,3) depending on traversal order

    // Ensure some edges present
    let present = await app.countEdgePresentCells();
    expect(present).toBeGreaterThan(0);

    // Click Clear All Edges
    await app.clickClear();

    // After clearing, no cells should have edge-present class
    present = await app.countEdgePresentCells();
    expect(present).toBe(0);

    // Edge count text must be zero
    const edgeText = await app.getEdgeCountText();
    expect(edgeText).toBe('Total edges: 0');

    // Symmetry remains Yes (all zeros)
    const symmetryText = await app.getSymmetryText();
    expect(symmetryText).toBe('Symmetric: Yes');

    // No runtime errors emitted during clearing
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Random Graph (RandomGraph event) generates symmetric random edges and updates UI (S1 -> S1)', async ({ page }) => {
    // Validate generateRandomGraph runs and updates the matrix and info panel appropriately.
    const app = new AppPage(page);

    await app.setNodeCount(6);
    await app.clickGenerate();

    // Click Random Graph to populate edges randomly
    await app.clickRandom();

    // After randomization, verify matrix dimensions unchanged
    const rows = await app.getTableRowCount();
    expect(rows).toBe(7); // header + 6 nodes

    // Verify all edge-cell values are either '0' or '1'
    const values = await app.getEdgeCellValues();
    expect(values.length).toBeGreaterThan(0);
    for (const v of values) {
      expect(['0', '1']).toContain(v);
    }

    // Symmetry text should be Yes since generation enforces symmetry
    const symmetryText = await app.getSymmetryText();
    expect(symmetryText).toBe('Symmetric: Yes');

    // Edge count must be a non-negative integer displayed in the info panel
    const edgeText = await app.getEdgeCountText();
    expect(edgeText).toMatch(/^Total edges: \d+$/);

    // No runtime errors during random generation
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: nodeCount clamping to min and max when generating', async ({ page }) => {
    // Validate that generate button clamps node count to min (2) and max (10) per implementation.
    const app = new AppPage(page);

    // Try to set below minimum (1) - expect clamped to 2
    await app.setNodeCount(1);
    await app.clickGenerate();
    let rows = await app.getTableRowCount();
    expect(rows).toBe(3); // header + 2

    // Try to set above maximum (20) - expect clamped to 10
    await app.setNodeCount(20);
    await app.clickGenerate();
    rows = await app.getTableRowCount();
    expect(rows).toBe(11); // header + 10

    // No runtime errors triggered by out-of-range input
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Sanity: Canvas remains present and unchanged shape after multiple operations', async ({ page }) => {
    // This test ensures drawGraph is invoked enough times without throwing and canvas dimensions persist.
    const app = new AppPage(page);

    // Record initial canvas dimensions
    const initialCanvas = await app.canvasSize();
    expect(initialCanvas).not.toBeNull();

    // Perform a series of operations
    await app.setNodeCount(5);
    await app.clickGenerate();
    await app.clickRandom();
    await app.clickEdgeCellByIndex(2);
    await app.clickClear();
    await app.clickRandom();

    // Confirm canvas dimensions unchanged
    const finalCanvas = await app.canvasSize();
    expect(finalCanvas).not.toBeNull();
    expect(finalCanvas.width).toBe(initialCanvas.width);
    expect(finalCanvas.height).toBe(initialCanvas.height);

    // No runtime page errors observed
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe console and page errors collection mechanism works (no unexpected errors)', async ({ page }) => {
    // This test validates that our instrumentation captured any console/page errors if they occurred.
    // We assert that usually there are none for this implementation. If errors are present they will
    // surface as test failures, highlighting runtime issues in the app.
    // The test purposefully only inspects collected arrays.
    expect(Array.isArray(pageErrors)).toBeTruthy();
    expect(Array.isArray(consoleErrors)).toBeTruthy();

    // Assert that there were no captured runtime errors (ReferenceError, TypeError, etc.)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});