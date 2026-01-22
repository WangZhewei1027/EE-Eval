import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79c5280-d361-11f0-8438-11a56595a476.html';

/**
 * Page Object for the Weighted Graph Demo page.
 * Encapsulates common interactions (clicking canvas at coordinates, clicking buttons, reading info text).
 */
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#graphCanvas');
    this.info = page.locator('#info');
    this.btnDijkstra = page.locator('#btnDijkstra');
    this.btnReset = page.locator('#btnReset');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  /**
   * Click on the canvas at coordinates relative to the canvas top-left.
   * @param {number} x
   * @param {number} y
   */
  async clickCanvasAt(x, y) {
    await this.canvas.click({ position: { x, y } });
  }

  async clickRunDijkstra() {
    await this.btnDijkstra.click();
  }

  async clickReset() {
    await this.btnReset.click();
  }

  async getInfoText() {
    return (await this.info.textContent()) || '';
  }
}

// Coordinates derived from the app's nodePositions in the HTML implementation.
// A: { x: 300, y: 60 }
// B: { x: 130, y: 130 }
// C: { x: 90, y: 280 }
// D: { x: 270, y: 290 }
// E: { x: 430, y: 280 }
// F: { x: 480, y: 140 }
// G: { x: 370, y: 70 }
const COORDS = {
  A: { x: 300, y: 60 },
  B: { x: 130, y: 130 },
  C: { x: 90, y: 280 },
  D: { x: 270, y: 290 },
  E: { x: 430, y: 280 },
  F: { x: 480, y: 140 },
  G: { x: 370, y: 70 },
};

test.describe('Weighted Graph Demo - FSM states and transitions', () => {
  // Collect page errors and console error messages per test to assert there are none.
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Listen to uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Listen to console events and collect error-level messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Collect both text and location if available
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
  });

  test('Initial state S0_Idle: page loads and shows initial instruction', async ({ page }) => {
    // Validate initial load shows Idle state instruction and UI components exist.
    const graph = new GraphPage(page);
    await graph.goto();

    // Verify UI elements are present
    await expect(page.locator('#graphCanvas')).toBeVisible();
    await expect(page.locator('#btnDijkstra')).toBeVisible();
    await expect(page.locator('#btnReset')).toBeVisible();
    await expect(page.locator('#info')).toBeVisible();

    // Check the initial info text matches the FSM evidence for S0_Idle
    await expect(graph.info).toHaveText('Click on a node to select start node.');

    // Assert there were no runtime page errors or console.error messages during initial load
    expect(pageErrors, 'No uncaught page errors on load').toEqual([]);
    expect(
      consoleErrors,
      'No console.error messages on load'
    ).toEqual([]);
  });

  test('Transition S0_Idle -> S1_NodeSelected: clicking a node selects it and updates info', async ({ page }) => {
    // Clicking on a node (A) should move app from Idle to NodeSelected state and update info text.
    const graph = new GraphPage(page);
    await graph.goto();

    // Click on node A's coordinates
    await graph.clickCanvasAt(COORDS.A.x, COORDS.A.y);

    // The info text should indicate the selected start node 'A'
    await expect(graph.info).toContainText('Selected start node: A');

    // Verify no runtime errors occurred during this interaction
    expect(pageErrors, 'No page errors after node click').toEqual([]);
    expect(consoleErrors, 'No console.error after node click').toEqual([]);
  });

  test('Edge case: clicking empty area on canvas does not select a node', async ({ page }) => {
    // Clicking an empty spot should not change the initial instruction (remain Idle)
    const graph = new GraphPage(page);
    await graph.goto();

    // Click near top-left corner, outside any node radius
    await graph.clickCanvasAt(10, 10);

    // Info should still be the initial instruction
    await expect(graph.info).toHaveText('Click on a node to select start node.');

    expect(pageErrors, 'No page errors after empty canvas click').toEqual([]);
    expect(consoleErrors, 'No console.error after empty canvas click').toEqual([]);
  });

  test('RunDijkstra event when no start node selected shows an alert (edge case)', async ({ page }) => {
    // Clicking "Run Dijkstra" without a selected start node should trigger an alert.
    const graph = new GraphPage(page);
    await graph.goto();

    // Capture dialog and assert message
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await graph.clickRunDijkstra();

    // Validate alert was shown with expected guidance about selecting a start node
    expect(dialogMessage).toBe('Please select a start node by clicking on a node in the graph first.');

    expect(pageErrors, 'No page errors after clicking Run Dijkstra without start').toEqual([]);
    expect(consoleErrors, 'No console.error after clicking Run Dijkstra without start').toEqual([]);
  });

  test('Transition S1_NodeSelected -> S2_ShortestPathComputed: selecting a node then running Dijkstra computes paths', async ({ page }) => {
    // Select node B then click Run Dijkstra; expect info text to indicate shortest paths computed.
    const graph = new GraphPage(page);
    await graph.goto();

    // Select node B
    await graph.clickCanvasAt(COORDS.B.x, COORDS.B.y);
    await expect(graph.info).toContainText('Selected start node: B');

    // Click Run Dijkstra
    // There should be no alert now because a start node is selected
    let dialogShown = false;
    page.once('dialog', async (d) => {
      dialogShown = true;
      await d.dismiss();
    });

    await graph.clickRunDijkstra();

    // Ensure no alert was displayed
    expect(dialogShown, 'No dialog should appear when running Dijkstra after selecting a node').toBe(false);

    // Info text should indicate result as per FSM S2_ShortestPathComputed
    await expect(graph.info).toContainText('Shortest paths computed from node B');

    // After computation, distances are drawn on canvas (canvas content not directly asserted),
    // but we confirm the app set the informational text as expected.
    expect(pageErrors, 'No page errors after running Dijkstra').toEqual([]);
    expect(consoleErrors, 'No console.error after running Dijkstra').toEqual([]);
  });

  test('Transition S1_NodeSelected -> S3_GraphReset: reset after selecting node clears selection', async ({ page }) => {
    // Select node C then click Reset - expect Graph Reset info and that subsequent Run Dijkstra prompts alert.
    const graph = new GraphPage(page);
    await graph.goto();

    // Select node C
    await graph.clickCanvasAt(COORDS.C.x, COORDS.C.y);
    await expect(graph.info).toContainText('Selected start node: C');

    // Click Reset
    await graph.clickReset();

    // Info should match S3_GraphReset evidence
    await expect(graph.info).toHaveText('Graph reset. Click on a node to select a start node.');

    // After reset, running Dijkstra should show the alert again (no start node)
    let dialogMessage = null;
    page.once('dialog', async (d) => {
      dialogMessage = d.message();
      await d.accept();
    });

    await graph.clickRunDijkstra();
    expect(dialogMessage).toBe('Please select a start node by clicking on a node in the graph first.');

    expect(pageErrors, 'No page errors after reset from NodeSelected').toEqual([]);
    expect(consoleErrors, 'No console.error after reset from NodeSelected').toEqual([]);
  });

  test('Transition S2_ShortestPathComputed -> S3_GraphReset: reset after computing shortest paths clears computation', async ({ page }) => {
    // Select node A, run Dijkstra, then reset. Expect Graph Reset info and no residual computation state.
    const graph = new GraphPage(page);
    await graph.goto();

    // Select node A and run Dijkstra
    await graph.clickCanvasAt(COORDS.A.x, COORDS.A.y);
    await expect(graph.info).toContainText('Selected start node: A');

    await graph.clickRunDijkstra();
    await expect(graph.info).toContainText('Shortest paths computed from node A');

    // Now reset
    await graph.clickReset();
    await expect(graph.info).toHaveText('Graph reset. Click on a node to select a start node.');

    // After reset, clicking a node should transition to NodeSelected again (S3 -> S0 via NodeClick per FSM, effectively re-selecting start)
    await graph.clickCanvasAt(COORDS.G.x, COORDS.G.y);
    await expect(graph.info).toContainText('Selected start node: G');

    expect(pageErrors, 'No page errors after reset from ShortestPathComputed').toEqual([]);
    expect(consoleErrors, 'No console.error after reset from ShortestPathComputed').toEqual([]);
  });

  test('S3_GraphReset -> S0_Idle transition via NodeClick: clicking after reset selects node', async ({ page }) => {
    // Ensure reset places app into Graph Reset state, and then clicking again selects a node (NodeSelected).
    const graph = new GraphPage(page);
    await graph.goto();

    // First, press Reset to go to Graph Reset state explicitly
    await graph.clickReset();
    await expect(graph.info).toHaveText('Graph reset. Click on a node to select a start node.');

    // Click node D to select it
    await graph.clickCanvasAt(COORDS.D.x, COORDS.D.y);
    await expect(graph.info).toContainText('Selected start node: D');

    expect(pageErrors, 'No page errors after selecting node following a reset').toEqual([]);
    expect(consoleErrors, 'No console.error after selecting node following a reset').toEqual([]);
  });

  test('Robustness: multiple interactions sequence and no uncaught exceptions', async ({ page }) => {
    // Perform a longer sequence: select B -> run -> reset -> select E -> run -> reset.
    const graph = new GraphPage(page);
    await graph.goto();

    // Select B and run
    await graph.clickCanvasAt(COORDS.B.x, COORDS.B.y);
    await expect(graph.info).toContainText('Selected start node: B');
    await graph.clickRunDijkstra();
    await expect(graph.info).toContainText('Shortest paths computed from node B');

    // Reset
    await graph.clickReset();
    await expect(graph.info).toHaveText('Graph reset. Click on a node to select a start node.');

    // Select E and run
    await graph.clickCanvasAt(COORDS.E.x, COORDS.E.y);
    await expect(graph.info).toContainText('Selected start node: E');
    await graph.clickRunDijkstra();
    await expect(graph.info).toContainText('Shortest paths computed from node E');

    // Final reset
    await graph.clickReset();
    await expect(graph.info).toHaveText('Graph reset. Click on a node to select a start node.');

    // Confirm across entire sequence there were no page errors or console.error messages
    expect(pageErrors, 'No page errors after extended interaction sequence').toEqual([]);
    expect(consoleErrors, 'No console.error after extended interaction sequence').toEqual([]);
  });
});