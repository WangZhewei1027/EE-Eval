import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a32bc41-ffc5-11f0-8b43-1ffa87931c43.html';

// Page Object for the Graph App
class GraphPage {
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#graphCanvas');
    this.nodeIdInput = page.locator('#nodeIdInput');
    this.addNodeBtn = page.locator('#addNodeBtn');
    this.edgeStartInput = page.locator('#edgeStartInput');
    this.edgeEndInput = page.locator('#edgeEndInput');
    this.edgeWeightInput = page.locator('#edgeWeightInput');
    this.addEdgeBtn = page.locator('#addEdgeBtn');
    this.nodesListItems = page.locator('#nodesList li');
    this.edgesListItems = page.locator('#edgesList li');
    this.nodeCount = page.locator('#nodeCount');
    this.edgeCount = page.locator('#edgeCount');
    this.message = page.locator('#message');
    this.startNodeDijkstra = page.locator('#startNodeDijkstra');
    this.endNodeDijkstra = page.locator('#endNodeDijkstra');
    this.findPathBtn = page.locator('#findPathBtn');
    this.pathResult = page.locator('#pathResult');
  }

  // Navigate and wait for the page to stabilize
  async goto() {
    await this.page.goto(APP_URL);
    await this.page.waitForLoadState('networkidle');
  }

  // Helpers for reading list contents
  async getNodesText() {
    return this.nodesListItems.allTextContents();
  }
  async getEdgesText() {
    return this.edgesListItems.allTextContents();
  }
  async getNodeCount() {
    return parseInt((await this.nodeCount.textContent()) || '0', 10);
  }
  async getEdgeCount() {
    return parseInt((await this.edgeCount.textContent()) || '0', 10);
  }
  async getMessageText() {
    return (await this.message.textContent()) || '';
  }
  async getPathResultText() {
    return (await this.pathResult.textContent()) || '';
  }

  // Add a node via UI; waits for DOM changes
  async addNode(id) {
    await this.nodeIdInput.fill(id);
    await this.addNodeBtn.click();
    // Wait for node count to update or for message to appear
    await this.page.waitForTimeout(100); // quick settle
  }

  // Add an edge via UI
  async addEdge(from, to, weight) {
    await this.edgeStartInput.fill(from);
    await this.edgeEndInput.fill(to);
    await this.edgeWeightInput.fill(String(weight));
    await this.addEdgeBtn.click();
    await this.page.waitForTimeout(100);
  }

  // Find shortest path via UI
  async findPath(start, end) {
    await this.startNodeDijkstra.fill(start);
    await this.endNodeDijkstra.fill(end);
    await this.findPathBtn.click();
    await this.page.waitForTimeout(150);
  }

  // Get node coordinates parsed from nodes list entry like "A (x: 150.0, y: 150.0)"
  // Returns { x: number, y: number } for given nodeId
  async getNodeCoordinates(nodeId) {
    const items = await this.getNodesText();
    for (const t of items) {
      const prefix = `${nodeId} (x: `;
      if (t.startsWith(prefix)) {
        // extract numbers
        const match = t.match(/\(x:\s*([-0-9.]+),\s*y:\s*([-0-9.]+)\)/);
        if (match) {
          return { x: parseFloat(match[1]), y: parseFloat(match[2]) };
        }
      }
    }
    return null;
  }

  // Drag a node to a new absolute canvas coordinate (targetX,targetY) using page.mouse
  // targetX/Y are coordinates relative to the canvas (not page)
  async dragNodeById(nodeId, targetCanvasX, targetCanvasY) {
    const coords = await this.getNodeCoordinates(nodeId);
    if (!coords) throw new Error(`Node ${nodeId} coordinates not found`);
    const canvasBox = await this.canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas bounding box not found');

    const startPageX = canvasBox.x + coords.x;
    const startPageY = canvasBox.y + coords.y;
    const endPageX = canvasBox.x + targetCanvasX;
    const endPageY = canvasBox.y + targetCanvasY;

    // Move mouse to start, press, move, release
    await this.page.mouse.move(startPageX, startPageY);
    await this.page.mouse.down();
    // small move so that mousemove handler runs
    await this.page.mouse.move((startPageX + endPageX) / 2, (startPageY + endPageY) / 2, { steps: 5 });
    await this.page.mouse.move(endPageX, endPageY, { steps: 5 });
    await this.page.mouse.up();

    // Wait for updateGraphInfo on mouseup to update nodes list
    await this.page.waitForTimeout(120);
  }

  // Dispatch a canvas mouseleave while dragging to simulate NodeDragLeave
  async mousedownOnNode(nodeId) {
    const coords = await this.getNodeCoordinates(nodeId);
    if (!coords) throw new Error(`Node ${nodeId} coordinates not found`);
    const canvasBox = await this.canvas.boundingBox();
    if (!canvasBox) throw new Error('Canvas bounding box not found');

    const startPageX = canvasBox.x + coords.x;
    const startPageY = canvasBox.y + coords.y;
    await this.page.mouse.move(startPageX, startPageY);
    await this.page.mouse.down();
    await this.page.waitForTimeout(50);
  }

  async dispatchCanvasLeave() {
    // Use page.dispatchEvent to fire a synthetic 'mouseleave' on the canvas element
    await this.page.dispatchEvent('#graphCanvas', 'mouseleave');
    // Wait for handlers to run
    await this.page.waitForTimeout(80);
  }

  async getCanvasCursorStyle() {
    return this.page.$eval('#graphCanvas', el => el.style.cursor || getComputedStyle(el).cursor);
  }
}

test.describe('Weighted Graph Demo - FSM Validation and UI Tests', () => {
  // Collect console and page errors per test
  test.beforeEach(async ({ page }) => {
    // Attach listeners early to capture any page errors during navigation and script execution
    page._consoleErrors = [];
    page._pageErrors = [];

    page.on('console', msg => {
      // gather console errors for assertions
      if (msg.type() === 'error') {
        page._consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', err => {
      page._pageErrors.push(err);
    });
  });

  // After each test ensure there were no uncaught errors logged to the console or page
  test.afterEach(async ({ page }) => {
    // Assert no runtime page errors occurred
    expect(page._pageErrors || []).toEqual([]);
    // Assert no console.error messages were emitted
    expect(page._consoleErrors || []).toEqual([]);
  });

  test.describe('S0_Idle (Initial Render) - renderPage()', () => {
    test('Initial load shows canvas and sample graph (nodes and edges)', async ({ page }) => {
      // Validate initial Idle state rendering: canvas present and sample graph populated
      const gp = new GraphPage(page);
      await gp.goto();

      // Canvas exists and accessible
      await expect(page.locator('#graphCanvas')).toBeVisible();

      // The sample graph added by the app should include nodes A..E and several edges
      const nodeCount = await gp.getNodeCount();
      const edgeCount = await gp.getEdgeCount();

      // The implementation adds 5 sample nodes and 7 edges initially
      expect(nodeCount).toBe(5);
      expect(edgeCount).toBe(7);

      // Nodes list should contain items for A and E
      const nodes = await gp.getNodesText();
      expect(nodes.some(t => t.startsWith('A '))).toBeTruthy();
      expect(nodes.some(t => t.startsWith('E '))).toBeTruthy();

      // Edges list should contain an entry for 'A — B' and 'D — E' as per sample graph
      const edges = await gp.getEdgesText();
      expect(edges.some(t => t.includes('A — B'))).toBeTruthy();
      expect(edges.some(t => t.includes('D — E'))).toBeTruthy();
    });
  });

  test.describe('S1_NodeAdded (Add Node interactions)', () => {
    test('Add a valid new node updates lists and increments node count', async ({ page }) => {
      // Add node Z and verify node list and count update
      const gp = new GraphPage(page);
      await gp.goto();

      const initialCount = await gp.getNodeCount();
      await gp.addNode('Z'); // valid id will be uppercased by app

      // Node count increments
      const newCount = await gp.getNodeCount();
      expect(newCount).toBe(initialCount + 1);

      // Nodes list includes Z
      const nodes = await gp.getNodesText();
      expect(nodes.some(t => t.startsWith('Z '))).toBeTruthy();

      // Message area should be empty after successful add
      const msg = await gp.getMessageText();
      expect(msg.trim()).toBe('');
    });

    test('Adding duplicate node shows an error message and does not increment count', async ({ page }) => {
      // Try to add existing node A and verify error message
      const gp = new GraphPage(page);
      await gp.goto();

      const before = await gp.getNodeCount();
      await gp.addNode('A'); // A already exists

      // Node count unchanged
      const after = await gp.getNodeCount();
      expect(after).toBe(before);

      // Error message referencing existing node
      const msg = await gp.getMessageText();
      expect(msg).toContain('already exists');
      expect(msg).toContain('A');
    });

    test('Invalid node IDs are rejected with a visible error message', async ({ page }) => {
      // Lowercase or special chars invalid
      const gp = new GraphPage(page);
      await gp.goto();

      await gp.addNode('!!'); // invalid
      let msg = await gp.getMessageText();
      expect(msg).toContain('Invalid Node ID');

      await gp.addNode('ab'); // lower-case will be uppercased to AB; but validation expects uppercase letters/numbers - the validator uses regex /^[A-Z0-9]{1,3}$/ after toUpperCase, so 'ab' will be 'AB' -> valid
      // Because the input is uppercased by the app, 'ab' becomes 'AB' and is valid. To assert invalid, use characters not in A-Z0-9.
      await gp.addNode('@'); // invalid
      msg = await gp.getMessageText();
      expect(msg).toContain('Invalid Node ID');
    });
  });

  test.describe('S2_EdgeAdded (Add Edge interactions)', () => {
    test('Add a valid edge updates edge list and increments edge count', async ({ page }) => {
      // Add a new edge between nodes that exist (A and E may already have edges between them; choose nodes that don't)
      const gp = new GraphPage(page);
      await gp.goto();

      // Ensure nodes X and Y exist: add two new nodes M and N
      await gp.addNode('M');
      await gp.addNode('N');

      const edgesBefore = await gp.getEdgeCount();
      await gp.addEdge('M', 'N', 3.5);

      const edgesAfter = await gp.getEdgeCount();
      expect(edgesAfter).toBe(edgesBefore + 1);

      // Edge list should show "M — N" with weight 3.5
      const edges = await gp.getEdgesText();
      expect(edges.some(t => t.includes('M — N') && t.includes('weight: 3.5'))).toBeTruthy();

      // No error message
      const msg = await gp.getMessageText();
      expect(msg.trim()).toBe('');
    });

    test('Adding an edge with non-existing nodes shows an error', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Attempt edge with nonexistent nodes
      await gp.addEdge('X', 'Y', 2);
      let msg = await gp.getMessageText();
      expect(msg).toContain('does not exist');

      // Attempt edge with same start and end
      await gp.addNode('P');
      await gp.addEdge('P', 'P', 1);
      msg = await gp.getMessageText();
      expect(msg).toContain('Cannot create edge from a node to itself');

      // Attempt edge with non-positive weight
      await gp.addNode('Q');
      await gp.addEdge('P', 'Q', 0);
      msg = await gp.getMessageText();
      expect(msg).toContain('Weight must be a positive number');
    });
  });

  test.describe('S3_PathFound (Find Shortest Path interactions)', () => {
    test('Find shortest path between two nodes displays path result and highlights', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Use sample graph nodes A and C which are connected
      await gp.findPath('A', 'C');

      const pathText = await gp.getPathResultText();
      // Expect "Path:" and "Total weight" in the result
      expect(pathText).toMatch(/Path:/);
      expect(pathText).toMatch(/Total weight:/);

      // Message should be empty on success
      const msg = await gp.getMessageText();
      expect(msg.trim()).toBe('');

      // Ensure the displayed path contains A and C
      expect(pathText).toContain('A');
      expect(pathText).toContain('C');
    });

    test('Find path shows errors for invalid inputs and for same start/end', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Invalid node id
      await gp.findPath('!', 'B');
      let msg = await gp.getMessageText();
      expect(msg).toContain('must be valid');

      // Non-existent nodes
      await gp.findPath('X', 'Y');
      msg = await gp.getMessageText();
      expect(msg).toContain('Both nodes must exist');

      // Same start and end
      await gp.findPath('A', 'A');
      msg = await gp.getMessageText();
      expect(msg).toContain('Start and End nodes are the same');
    });

    test('Find path reports no path when nodes disconnected', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Add isolated nodes R and S without connecting edge
      await gp.addNode('R');
      await gp.addNode('S');

      await gp.findPath('R', 'S');
      const msg = await gp.getMessageText();
      // Expect message about no path found
      expect(msg).toContain('No path found between R and S');
    });
  });

  test.describe('S4_NodeDragged (Canvas Drag interactions)', () => {
    test('Mousedown on a node enters dragging state (cursor changes) and mouseup exits (cursor restored)', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Pick node A for the drag test
      const beforeCoords = await gp.getNodeCoordinates('A');
      expect(beforeCoords).not.toBeNull();

      // Simulate mousedown on node A. We expect canvas cursor to change to 'grabbing'
      await gp.mousedownOnNode('A');
      let cursor = await gp.getCanvasCursorStyle();
      expect(cursor).toContain('grabbing');

      // Release mouse button (mouseup). Cursor should switch back to 'grab' and updateGraphInfo should have been called
      await page.mouse.up();
      await page.waitForTimeout(120);

      cursor = await gp.getCanvasCursorStyle();
      // Canvas default style set in CSS: cursor: grab; When dragging ends, script sets 'grab'
      expect(cursor).toContain('grab');

      // Node list updated (positions may remain same if no movement)
      const afterCoords = await gp.getNodeCoordinates('A');
      expect(afterCoords).not.toBeNull();
    });

    test('Dragging a node moves it and updates its coordinates in the nodes list', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      const before = await gp.getNodeCoordinates('B');
      expect(before).not.toBeNull();

      // Drag node B 50px right and 30px down relative to its current canvas coordinates
      const canvasTargetX = before.x + 50;
      const canvasTargetY = before.y + 30;

      await gp.dragNodeById('B', canvasTargetX, canvasTargetY);

      const after = await gp.getNodeCoordinates('B');
      expect(after).not.toBeNull();

      // Coordinates should have changed by approximately the requested offsets
      expect(Math.abs(after.x - (before.x + 50))).toBeLessThanOrEqual(2);
      expect(Math.abs(after.y - (before.y + 30))).toBeLessThanOrEqual(2);
    });

    test('Mouseleave during dragging ends drag and updates node positions', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Start dragging node C
      const before = await gp.getNodeCoordinates('C');
      expect(before).not.toBeNull();

      await gp.mousedownOnNode('C');
      let cursor = await gp.getCanvasCursorStyle();
      expect(cursor).toContain('grabbing');

      // Dispatch a mouseleave - the app should treat this as drag end and update state
      await gp.dispatchCanvasLeave();

      // Cursor should be reset to 'grab'
      cursor = await gp.getCanvasCursorStyle();
      expect(cursor).toContain('grab');

      // Node coordinates should be present (may not have changed)
      const after = await gp.getNodeCoordinates('C');
      expect(after).not.toBeNull();
    });

    test('Mousemove while dragging triggers repeated drawGraph calls (no crash) and keeps dragging state', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Start dragging node D
      await gp.mousedownOnNode('D');
      let cursor = await gp.getCanvasCursorStyle();
      expect(cursor).toContain('grabbing');

      // Perform several mouse moves across the canvas to trigger mousemove handler
      const canvasBox = await page.locator('#graphCanvas').boundingBox();
      if (!canvasBox) throw new Error('Canvas bounding box not found for mousemove test');

      // Move to several positions; ensure no exceptions are thrown and cursor remains grabbing mid-drag
      await page.mouse.move(canvasBox.x + canvasBox.width * 0.3, canvasBox.y + canvasBox.height * 0.3, { steps: 4 });
      await page.mouse.move(canvasBox.x + canvasBox.width * 0.6, canvasBox.y + canvasBox.height * 0.6, { steps: 4 });

      // While still holding (we haven't released), cursor should still show grabbing
      cursor = await gp.getCanvasCursorStyle();
      expect(cursor).toContain('grabbing');

      // Now release
      await page.mouse.up();
      await page.waitForTimeout(120);
      cursor = await gp.getCanvasCursorStyle();
      expect(cursor).toContain('grab');
    });
  });
});