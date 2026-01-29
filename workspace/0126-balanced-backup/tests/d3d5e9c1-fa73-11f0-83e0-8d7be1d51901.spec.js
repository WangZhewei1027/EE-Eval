import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d5e9c1-fa73-11f0-83e0-8d7be1d51901.html';

// Page object for interacting with the graph app
class GraphApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.svg = page.locator('#svg');
    this.btnAddNode = page.locator('#btnAddNode');
    this.btnAddEdge = page.locator('#btnAddEdge');
    this.btnDelete = page.locator('#btnDelete');
    this.btnClear = page.locator('#btnClear');
    this.btnBFS = page.locator('#btnBFS');
    this.btnDFS = page.locator('#btnDFS');
    this.btnTopSort = page.locator('#btnTopSort');
    this.btnCycle = page.locator('#btnCycle');
    this.btnShortest = page.locator('#btnShortest');
    this.btnExport = page.locator('#btnExport');
    this.btnImport = page.locator('#btnImport');
    this.jsonArea = page.locator('#jsonArea');
    this.adjList = page.locator('#adjList');
    this.message = page.locator('#message');
    this.speed = page.locator('#speed');
  }

  async clickAddNode() {
    await this.btnAddNode.click();
  }
  async clickAddEdge() {
    await this.btnAddEdge.click();
  }
  async clickDelete() {
    await this.btnDelete.click();
  }
  async clickClear() {
    await this.btnClear.click();
  }
  async clickBFS() {
    await this.btnBFS.click();
  }
  async clickDFS() {
    await this.btnDFS.click();
  }
  async clickTopSort() {
    await this.btnTopSort.click();
  }
  async clickCycle() {
    await this.btnCycle.click();
  }
  async clickShortest() {
    await this.btnShortest.click();
  }
  async clickExport() {
    await this.btnExport.click();
  }
  async clickImport() {
    await this.btnImport.click();
  }

  async setJsonArea(value) {
    await this.jsonArea.fill(value);
  }

  async getJsonAreaValue() {
    return await this.jsonArea.inputValue();
  }

  async getMessageText() {
    return (await this.message.textContent())?.trim() ?? '';
  }

  async getAdjListText() {
    return (await this.adjList.textContent())?.trim() ?? '';
  }

  async clickSvgAt(x, y) {
    // Click at coordinates relative to the SVG element
    const box = await this.svg.boundingBox();
    if (!box) throw new Error('SVG bounding box not available');
    await this.page.mouse.click(box.x + x, box.y + y, { button: 'left' });
  }

  async clickNodeById(id) {
    // Click the circle element corresponding to node id
    const locator = this.page.locator(`circle.nodeCircle[data-id="${id}"]`);
    await expect(locator).toHaveCount(1);
    await locator.click();
  }

  async getNodeCenter(id) {
    const locator = this.page.locator(`circle.nodeCircle[data-id="${id}"]`);
    await expect(locator).toHaveCount(1);
    const box = await locator.boundingBox();
    if (!box) throw new Error('Bounding box missing for node ' + id);
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  async dragNodeById(id, dx, dy) {
    const center = await this.getNodeCenter(id);
    await this.page.mouse.move(center.x, center.y);
    await this.page.mouse.down();
    await this.page.mouse.move(center.x + dx, center.y + dy, { steps: 8 });
    await this.page.mouse.up();
  }

  async countNodesRendered() {
    return await this.page.locator('circle.nodeCircle').count();
  }

  async getNodeAttribute(id, attr) {
    const locator = this.page.locator(`circle.nodeCircle[data-id="${id}"]`);
    await expect(locator).toHaveCount(1);
    return await locator.getAttribute(attr);
  }

  async waitForMessageContains(sub, timeout = 3000) {
    await this.page.waitForFunction(
      (selector, sub) => {
        const el = document.querySelector(selector);
        return el && el.textContent && el.textContent.includes(sub);
      },
      '#message',
      sub,
      { timeout }
    );
  }
}

test.describe('Directed Graph — Interactive Demo (FSM validation)', () => {
  // Capture console messages and uncaught page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    await page.goto(APP_URL);
    // ensure app finished initial demo loading message
    const app = new GraphApp(page);
    await app.waitForMessageContains('Sample graph loaded', 3000);
  });

  test.afterEach(async () => {
    // no-op: assertions on console/page errors are inside tests as needed
  });

  test('Initial Idle state: sample graph loads and Idle evidence present', async ({ page }) => {
    const app = new GraphApp(page);
    // The demo initialises with sample graph and notifies the user
    const message = await app.getMessageText();
    expect(message).toContain('Sample graph loaded');

    // adjacency list should reflect nodes 1..5
    const adj = await app.getAdjListText();
    expect(adj).toContain('1 ->');
    expect(adj).toContain('5 ->');

    // There should be no uncaught page errors on initial load
    expect(pageErrors).toHaveLength(0);
    // Also no console.error messages
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Add Node flow: transitions S0_Idle -> S1_AddingNode -> S0_Idle (node added)', async ({ page }) => {
    const app = new GraphApp(page);

    // Click Add Node => should prompt user to click canvas
    await app.clickAddNode();
    await app.waitForMessageContains('Click on canvas to add a node');
    expect(await app.getMessageText()).toContain('Click on canvas to add a node.');

    // Click on empty area of SVG to add a node
    // choose coordinates away from sample nodes (e.g., top-left corner)
    await app.clickSvgAt(20, 20);

    // After adding, notify 'Node added.'
    await app.waitForMessageContains('Node added', 2000);
    expect(await app.getMessageText()).toContain('Node added.');

    // The adjacency list should now include a new node (id 6)
    const adj = await app.getAdjListText();
    expect(adj).toMatch(/6\s*->/);

    // No runtime errors produced by adding a node
    const pageErrs = pageErrors.map(e => e.message || String(e));
    expect(pageErrs).toHaveLength(0);
  });

  test('Add Edge flow: S0_Idle -> S2_AddingEdge -> S0_Idle (edge added notification and adj list updated)', async ({ page }) => {
    const app = new GraphApp(page);

    // Ensure a node 6 exists (from sample + previous test maybe not persistent) - create one to be safe
    // Add a temporary node at bottom-left if none with id 6 exists
    const existingSix = await page.locator('circle.nodeCircle[data-id="6"]').count();
    if (existingSix === 0) {
      await app.clickAddNode();
      await app.clickSvgAt(30, 30);
      await app.waitForMessageContains('Node added', 2000);
    }

    // Click Add Edge to enter edge-adding mode
    await app.clickAddEdge();
    await app.waitForMessageContains('Add Edge: click source node, then destination node.', 2000);

    // Click source node 6 then destination node 1
    await app.clickNodeById(6);
    await app.waitForMessageContains('Source node selected (ID 6)', 2000);

    await app.clickNodeById(1);
    // Even if the edge exists or duplicate, app notifies 'Edge added ...' per implementation
    await app.waitForMessageContains('Edge added 6 -> 1', 2000);
    expect(await app.getMessageText()).toContain('Edge added 6 -> 1');

    // adjacency list should reflect the new (or existing) edge
    const adj = await app.getAdjListText();
    // '6 -> [1]' expected
    expect(adj).toMatch(/6\s*->\s*\[.*1.*\]/);

    // Ensure no uncaught page errors happened
    expect(pageErrors).toHaveLength(0);
  });

  test('Delete Selected and Delete with no selection edge case', async ({ page }) => {
    const app = new GraphApp(page);

    // Edge case: clicking Delete when none is selected should show informative message
    await app.clickDelete();
    await app.waitForMessageContains('No node selected to delete.', 2000);
    expect(await app.getMessageText()).toContain('No node selected to delete.');

    // Now select a node (1) and delete it
    await app.clickNodeById(1);
    await app.waitForMessageContains('Selected node 1', 2000);

    const beforeAdj = await app.getAdjListText();
    expect(beforeAdj).toContain('1 ->');

    await app.clickDelete();
    await app.waitForMessageContains('Deleted node 1', 2000);
    const afterAdj = await app.getAdjListText();
    // Node 1 line should be gone
    expect(afterAdj).not.toContain('1 ->');

    // No uncaught runtime errors
    expect(pageErrors).toHaveLength(0);
  });

  test('Clear Graph: handles confirm dialog and clears nodes', async ({ page }) => {
    const app = new GraphApp(page);

    // Prepare to accept the confirm dialog that appears on clear
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });

    // Click clear - after confirming, adjacency list should be empty
    await app.clickClear();

    // Wait for adjacency list to update to '(empty)'
    await expect(app.adjList).toHaveText('(empty)', { timeout: 2000 });

    // No nodes rendered
    const nodeCount = await app.countNodesRendered();
    expect(nodeCount).toBe(0);

    // The app should not have produced any uncaught page errors
    expect(pageErrors).toHaveLength(0);
  });

  test('BFS and DFS traversals: S0_Idle -> S3_ChoosingBFS -> S0_Idle and S4_ChoosingDFS -> S0_Idle', async ({ page }) => {
    const app = new GraphApp(page);

    // Reload a fresh demo to ensure nodes present
    await page.reload();
    await app.waitForMessageContains('Sample graph loaded', 3000);

    // BFS: click BFS button then start at node 1
    await app.clickBFS();
    await app.waitForMessageContains('BFS: click start node.', 2000);
    await app.clickNodeById(1);

    // After animation, final message will contain "BFS order:" or at least the animation result that includes order
    await app.waitForMessageContains('BFS order:', 3000);
    const bfsMsg = await app.getMessageText();
    expect(bfsMsg).toContain('BFS order:');

    // DFS: click DFS button then start at node 1
    await app.clickDFS();
    await app.waitForMessageContains('DFS: click start node.', 2000);
    await app.clickNodeById(1);

    await app.waitForMessageContains('DFS order:', 3000);
    const dfsMsg = await app.getMessageText();
    expect(dfsMsg).toContain('DFS order:');

    // No page errors during traversal runs
    expect(pageErrors).toHaveLength(0);
  });

  test('Shortest Path flow: S5_ChoosingSPStart -> S6_ChoosingSPEnd -> S0_Idle (path computed and highlighted)', async ({ page }) => {
    const app = new GraphApp(page);

    // Ensure demo loaded
    await page.reload();
    await app.waitForMessageContains('Sample graph loaded', 3000);

    // Start shortest path selection
    await app.clickShortest();
    await app.waitForMessageContains('Shortest Path: click start node.', 2000);

    // Click start (1) then end (3)
    await app.clickNodeById(1);
    await app.waitForMessageContains('Start selected:', 2000);
    expect((await app.getMessageText())).toContain('Start selected:');

    await app.clickNodeById(3);

    // The app first notifies 'Shortest path: ...' and then animates and eventually notifies 'Reached: ...'
    // Wait for either 'Shortest path' or final 'Reached'
    await app.waitForMessageContains('Shortest path:', 3000);
    const spMsg = await app.getMessageText();
    expect(spMsg).toContain('Shortest path:');

    // Wait for final animation completion message 'Reached:'
    await app.waitForMessageContains('Reached:', 5000);
    const finalMsg = await app.getMessageText();
    expect(finalMsg).toContain('Reached:');

    // No uncaught errors during the shortest path computation
    expect(pageErrors).toHaveLength(0);
  });

  test('Topological Sort and Cycle detection: algorithms notify correctly and cycle detection detects imported cycle', async ({ page }) => {
    const app = new GraphApp(page);

    // Ensure fresh demo
    await page.reload();
    await app.waitForMessageContains('Sample graph loaded', 3000);

    // TopSort on acyclic sample should produce topological order
    await app.clickTopSort();
    await app.waitForMessageContains('Topological order:', 2000);
    expect(await app.getMessageText()).toContain('Topological order:');

    // Cycle detect on initial sample should say no cycle
    await app.clickCycle();
    await app.waitForMessageContains('No cycle detected', 2000);
    expect(await app.getMessageText()).toContain('No cycle detected (DAG).');

    // Now import a graph that has a cycle: 1->2,2->3,3->1
    const cycleGraph = {
      nodes: [
        { id: 1, x: 50, y: 50 },
        { id: 2, x: 150, y: 50 },
        { id: 3, x: 100, y: 150 }
      ],
      edges: [
        { from: 1, to: 2 },
        { from: 2, to: 3 },
        { from: 3, to: 1 }
      ]
    };
    await app.setJsonArea(JSON.stringify(cycleGraph, null, 2));
    // Import and wait for notification
    await app.clickImport();
    await app.waitForMessageContains('Imported graph.', 2000);
    expect(await app.getMessageText()).toContain('Imported graph.');

    // Now cycle detection should find a cycle
    await app.clickCycle();
    await app.waitForMessageContains('Cycle detected', 2000);
    expect((await app.getMessageText())).toMatch(/Cycle detected!|Cycle detected/);

    // TopSort on cyclic graph should indicate that topological sort is not possible
    await app.clickTopSort();
    await app.waitForMessageContains('topological sort not possible', 2000);
    expect((await app.getMessageText()).toLowerCase()).toContain('topological sort not possible');

    // No uncaught runtime page errors
    expect(pageErrors).toHaveLength(0);
  });

  test('Export JSON produces valid structure and Import error handling shows alert for malformed JSON', async ({ page }) => {
    const app = new GraphApp(page);

    // Ensure fresh demo
    await page.reload();
    await app.waitForMessageContains('Sample graph loaded', 3000);

    // Click export and verify jsonArea is populated with nodes and edges arrays
    await app.clickExport();
    const jsonValue = await app.getJsonAreaValue();
    expect(jsonValue).toBeTruthy();
    const parsed = JSON.parse(jsonValue);
    expect(Array.isArray(parsed.nodes)).toBe(true);
    expect(Array.isArray(parsed.edges)).toBe(true);

    // Now set malformed JSON and assert that btnImport triggers an alert with "Import error"
    await app.setJsonArea('this is not valid json');
    page.once('dialog', async (dialog) => {
      // the implementation uses alert('Import error: ' + err)
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Import error');
      await dialog.accept();
    });
    await app.clickImport();

    // No uncaught page errors beyond the handled alert
    expect(pageErrors).toHaveLength(0);
  });

  test('Drag node interaction updates node position (visual/DOM change)', async ({ page }) => {
    const app = new GraphApp(page);

    // Ensure fresh demo
    await page.reload();
    await app.waitForMessageContains('Sample graph loaded', 3000);

    // Pick node 2, get initial cx attribute
    const beforeCx = await app.getNodeAttribute(2, 'cx');
    const beforeCy = await app.getNodeAttribute(2, 'cy');
    expect(beforeCx).toBeTruthy();
    expect(beforeCy).toBeTruthy();

    // Drag node 2 by (+40, +20) pixels in viewport coords
    await app.dragNodeById(2, 40, 20);

    // After dragging, node coordinates should have changed
    const afterCx = await app.getNodeAttribute(2, 'cx');
    const afterCy = await app.getNodeAttribute(2, 'cy');
    expect(afterCx).toBeTruthy();
    expect(afterCy).toBeTruthy();
    // Values are strings; ensure at least one changed
    expect(afterCx !== beforeCx || afterCy !== beforeCy).toBeTruthy();

    // No runtime page errors caused by dragging
    expect(pageErrors).toHaveLength(0);
  });

  test('Sanity: capture and assert no unexpected console errors or uncaught page errors', async ({ page }) => {
    // This test ensures the app runs without throwing ReferenceError/SyntaxError/TypeError
    // (they would be captured as page 'pageerror' events or console.error)
    const app = new GraphApp(page);
    // Interact lightly
    await app.clickBFS();
    await app.waitForMessageContains('BFS: click start node.', 2000);
    await app.clickNodeById(2);
    await app.waitForMessageContains('BFS order:', 3000);

    // Check captured console messages for error level
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);

    // Check that there were no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });
});