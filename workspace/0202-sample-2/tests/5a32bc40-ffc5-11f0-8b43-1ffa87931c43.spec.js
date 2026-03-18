import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a32bc40-ffc5-11f0-8b43-1ffa87931c43.html';

/**
 * Page object encapsulating common interactions with the Graph app.
 */
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#graph-canvas');
    this.statusLocator = page.locator('#graph-info p').first();
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async statusText() {
    return (await this.statusLocator.textContent()) || '';
  }

  async clickAddNode() {
    await this.page.click('#add-node');
  }

  async clickAddEdge() {
    await this.page.click('#add-edge');
  }

  async clickRemoveEdge() {
    await this.page.click('#remove-edge');
  }

  async clickClearGraph() {
    await this.page.click('#clear-graph');
  }

  async switchModeTo(value) {
    // value: 'undirected' or 'directed'
    await this.page.click(`input[name="mode"][value="${value}"]`);
  }

  /**
   * Clicks on the canvas at coordinates relative to the canvas's top-left.
   * @param {number} x
   * @param {number} y
   */
  async clickCanvasAt(x, y) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not found');
    await this.page.mouse.click(box.x + x, box.y + y);
  }

  /**
   * Mousedown at (x,y) on canvas.
   */
  async mouseDownCanvasAt(x, y) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not found');
    await this.page.mouse.move(box.x + x, box.y + y);
    await this.page.mouse.down();
  }

  /**
   * Mousemove to (x,y) on canvas.
   */
  async mouseMoveCanvasTo(x, y) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not found');
    await this.page.mouse.move(box.x + x, box.y + y);
  }

  /**
   * Mouseup on canvas at current position or at given coordinates.
   */
  async mouseUpCanvasAt(x, y) {
    if (typeof x === 'number' && typeof y === 'number') {
      const box = await this.canvas.boundingBox();
      if (!box) throw new Error('Canvas bounding box not found');
      await this.page.mouse.move(box.x + x, box.y + y);
    }
    await this.page.mouse.up();
  }
}

test.describe('Graph Visualization FSM - end-to-end', () => {
  // Capture console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Nothing global needed here; per-test listeners are added in each test to capture messages.
  });

  /**
   * Helper to setup listeners that gather console errors and page errors.
   * Returns an object { consoleErrors, pageErrors } arrays that get populated.
   */
  async function attachErrorListeners(page) {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // ignore listener errors
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
    return { consoleErrors, pageErrors };
  }

  test('Initial Idle state: status message and no runtime errors on load', async ({ page }) => {
    // Validate S0_Idle entry actions and initial rendering
    const { consoleErrors, pageErrors } = await attachErrorListeners(page);
    const gp = new GraphPage(page);
    await gp.goto();

    // The FSM's Idle state sets the status line upon entry
    const status = await gp.statusText();
    expect(status).toContain('Select an action: Add Node, Add Edge, Remove Edge, or Clear Graph.');

    // Ensure the canvas exists
    const box = await gp.canvas.boundingBox();
    expect(box).toBeTruthy();
    expect(box.width).toBeGreaterThan(0);
    expect(box.height).toBeGreaterThan(0);

    // Assert no console errors or uncaught page errors were emitted during load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Add Node flow (S1_AddNode): clicking Add Node then canvas should add nodes and update status', async ({ page }) => {
    // This test validates S1_AddNode state entry action and the MOUSE_DOWN transition that adds a node.
    const { consoleErrors, pageErrors } = await attachErrorListeners(page);
    const gp = new GraphPage(page);
    await gp.goto();

    // Enter add-node mode
    await gp.clickAddNode();
    await page.waitForTimeout(50); // small delay for UI update
    let status = await gp.statusText();
    expect(status).toContain('Add Node: Click on canvas to place a new node.');

    // Add a node at (100,120)
    await gp.clickCanvasAt(100, 120);

    // After adding a node, the status shows Node 1 added at (...)
    status = await gp.statusText();
    expect(status).toMatch(/Node\s+1\s+added/);

    // Add another node to ensure multiple additions maintain state S1_AddNode
    await gp.clickCanvasAt(300, 200);
    status = await gp.statusText();
    expect(status).toMatch(/Node\s+2\s+added/);

    // No console or page errors occurred during node additions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Add Edge flow (S2_AddEdge): errors with insufficient nodes, successful edge creation, duplicate edge detection', async ({ page }) => {
    // This test validates transition from Idle -> AddEdge and the MOUSE_DOWN transitions for edge creation.
    const { consoleErrors, pageErrors } = await attachErrorListeners(page);
    const gp = new GraphPage(page);
    await gp.goto();

    // Attempt to enter Add Edge with fewer than two nodes -> should show an alert
    const dialogPromise1 = page.waitForEvent('dialog');
    await gp.clickAddEdge();
    const dialog1 = await dialogPromise1;
    expect(dialog1.type()).toBe('alert');
    expect(dialog1.message()).toContain('You need at least two nodes to add an edge.');
    await dialog1.accept();

    // Create two nodes to allow edges
    await gp.clickAddNode();
    await gp.clickCanvasAt(100, 100); // Node 1
    await gp.clickCanvasAt(300, 100); // Node 2

    // Enter add-edge mode
    await gp.clickAddEdge();
    await page.waitForTimeout(50);
    let status = await gp.statusText();
    expect(status).toContain('Add Edge: Click on first node, then second node to create edge.');

    // Click first node (approx center at 100,100) and then second node to create an edge
    await gp.clickCanvasAt(100, 100); // select node 1
    status = await gp.statusText();
    expect(status).toContain('Now click on second node');

    await gp.clickCanvasAt(300, 100); // connect to node 2
    status = await gp.statusText();
    expect(status).toMatch(/Edge added from node\s+1\s+to node\s+2/);

    // Attempt to add the same undirected edge again - should be detected as duplicate
    await gp.clickAddEdge();
    await gp.clickCanvasAt(100, 100); // select node 1
    await gp.clickCanvasAt(300, 100); // attempt to add same edge
    status = await gp.statusText();
    // For undirected mode duplicate message contains "Edge already exists"
    expect(status).toMatch(/Edge already exists/);

    // No runtime errors occurred during add-edge interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Remove Edge flow (S3_RemoveEdge): alert when no edges; remove existing edge by clicking on it', async ({ page }) => {
    // Validate the RemoveEdge state and its MOUSE_DOWN transition that removes edges.
    const { consoleErrors, pageErrors } = await attachErrorListeners(page);
    const gp = new GraphPage(page);
    await gp.goto();

    // With no edges yet, clicking remove-edge should show an alert
    const dialogPromise = page.waitForEvent('dialog');
    await gp.clickRemoveEdge();
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('No edges to remove.');
    await dialog.accept();

    // Setup: add two nodes and an edge between them
    await gp.clickAddNode();
    await gp.clickCanvasAt(150, 150); // Node 1
    await gp.clickCanvasAt(400, 150); // Node 2

    await gp.clickAddEdge();
    await gp.clickCanvasAt(150, 150); // select node1
    await gp.clickCanvasAt(400, 150); // connect to node2
    let status = await gp.statusText();
    expect(status).toMatch(/Edge added from node\s+1\s+to node\s+2/);

    // Now enter remove-edge mode
    await gp.clickRemoveEdge();
    status = await gp.statusText();
    expect(status).toContain('Remove Edge: Click on an edge to remove it.');

    // Click near midpoint of the edge to remove it
    const midX = Math.round((150 + 400) / 2);
    const midY = Math.round((150 + 150) / 2);
    await gp.clickCanvasAt(midX, midY);

    // Status should reflect edge removal
    status = await gp.statusText();
    expect(status).toMatch(/Edge removed from node\s+1\s+to node\s+2/);

    // No runtime errors during the remove-edge interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Clear Graph (S4_ClearGraph): confirm dialog and status reset', async ({ page }) => {
    // This validates the clear graph action and S4_ClearGraph entry action 'Graph cleared.'
    const { consoleErrors, pageErrors } = await attachErrorListeners(page);
    const gp = new GraphPage(page);
    await gp.goto();

    // Add a node and edge to ensure there is content to clear
    await gp.clickAddNode();
    await gp.clickCanvasAt(120, 120); // Node 1
    await gp.clickCanvasAt(220, 220); // Node 2

    await gp.clickAddEdge();
    await gp.clickCanvasAt(120, 120);
    await gp.clickCanvasAt(220, 220);
    let status = await gp.statusText();
    expect(status).toMatch(/Edge added/);

    // Click clear graph: a confirm dialog appears. Accept it.
    const dialogPromise = page.waitForEvent('dialog');
    await gp.clickClearGraph();
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toContain('Are you sure you want to clear the entire graph?');
    await dialog.accept();

    // After accepting, the status should say 'Graph cleared.'
    status = await gp.statusText();
    expect(status).toContain('Graph cleared.');

    // Verify that attempting to remove edge now prompts "No edges to remove." (graph is cleared)
    const dialogPromise2 = page.waitForEvent('dialog');
    await gp.clickRemoveEdge();
    const dialog2 = await dialogPromise2;
    expect(dialog2.message()).toContain('No edges to remove.');
    await dialog2.accept();

    // No runtime errors during clear/confirm sequence
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Switch Graph Mode (SWITCH_MODE): toggling radios updates mode and status', async ({ page }) => {
    // Validates SWITCH_MODE event and onEnter behavior for mode change.
    const { consoleErrors, pageErrors } = await attachErrorListeners(page);
    const gp = new GraphPage(page);
    await gp.goto();

    // Ensure initial mode is undirected
    await gp.switchModeTo('undirected');
    let status = await gp.statusText();
    // Selecting the already checked radio might still trigger setStatus in the implementation
    // Accept either the initial idle text or explicit switched text
    expect(status.length).toBeGreaterThan(0);

    // Switch to directed
    await gp.switchModeTo('directed');
    status = await gp.statusText();
    expect(status).toContain('Switched to Directed Graph mode.');

    // Switch back to undirected
    await gp.switchModeTo('undirected');
    status = await gp.statusText();
    expect(status).toContain('Switched to Undirected Graph mode.');

    // No runtime console or page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Drag Node (S5_DragNode): dragging updates status on drag and drop', async ({ page }) => {
    // This validates entering drag state on mousedown on a node, MOUSE_MOVE updating position,
    // and MOUSE_UP returning to Idle with drop message.
    const { consoleErrors, pageErrors } = await attachErrorListeners(page);
    const gp = new GraphPage(page);
    await gp.goto();

    // Create a node to drag
    await gp.clickAddNode();
    const startX = 200, startY = 300;
    await gp.clickCanvasAt(startX, startY); // Node 1

    // Mousedown on node center to begin drag
    await gp.mouseDownCanvasAt(startX, startY);
    // Immediately check for dragging status
    await page.waitForTimeout(50);
    let status = await gp.statusText();
    expect(status).toContain('Dragging node 1.');

    // Move the node to a new location
    const newX = 350, newY = 380;
    await gp.mouseMoveCanvasTo(newX, newY);
    await page.waitForTimeout(50);

    // Mouse up to drop the node
    await gp.mouseUpCanvasAt(newX, newY);
    await page.waitForTimeout(50);
    status = await gp.statusText();
    expect(status).toContain('Dropped node 1.');

    // Ensure no runtime console or page errors during drag/drop
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: click on empty canvas in add-edge mode and remove-edge hover behavior', async ({ page }) => {
    // Validate behavior when clicking canvas in add-edge mode outside a node,
    // and that remove-edge hover does not produce runtime errors.
    const { consoleErrors, pageErrors } = await attachErrorListeners(page);
    const gp = new GraphPage(page);
    await gp.goto();

    // Prepare two nodes so add-edge is allowed
    await gp.clickAddNode();
    await gp.clickCanvasAt(50, 50); // Node 1
    await gp.clickCanvasAt(700, 500); // Node 2

    // Enter add-edge mode
    await gp.clickAddEdge();
    await page.waitForTimeout(50);

    // Click on canvas away from any node - should prompt 'Click on a node.' in status
    await gp.clickCanvasAt(400, 300);
    let status = await gp.statusText();
    expect(status).toContain('Add Edge: Click on a node.');

    // Now add an edge for remove-edge hover testing
    await gp.clickCanvasAt(50, 50); // select node1
    await gp.clickCanvasAt(700, 500); // select node2
    status = await gp.statusText();
    expect(status).toMatch(/Edge added/);

    // Enter remove-edge mode
    await gp.clickRemoveEdge();
    await page.waitForTimeout(50);

    // Move the mouse along the edge line to trigger hover logic (should not throw)
    const midX = Math.round((50 + 700) / 2);
    const midY = Math.round((50 + 500) / 2);
    await gp.mouseMoveCanvasTo(midX, midY);
    await page.waitForTimeout(100);

    // No explicit status expected for hover, but ensure no errors during hover
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});