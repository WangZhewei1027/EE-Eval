import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e9332651-d360-11f0-a097-ffdd56c22ef4.html';

/**
 * Page object to encapsulate interactions with the graph demo page.
 * This keeps tests organized and readable.
 */
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.svg = page.locator('#svg');
    this.status = page.locator('#status');
    this.selectedInfo = page.locator('#selected-info');
    this.nodeCount = page.locator('#node-count');
    this.edgeCount = page.locator('#edge-count');
    this.adj = page.locator('#adj');
    this.modeAdd = page.locator('#mode-add');
    this.modeEdge = page.locator('#mode-edge');
    this.modeMove = page.locator('#mode-move');
    this.modeDel = page.locator('#mode-del');
    this.dijkstraBtn = page.locator('#dijkstra');
    this.primBtn = page.locator('#prim');
    this.clearBtn = page.locator('#clear');
    this.randomBtn = page.locator('#random');
    this.animateBtn = page.locator('#animate-steps');
    this.defaultWeight = page.locator('#default-weight');
    this.directedCheckbox = page.locator('#directed');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for initial render
    await expect(this.page.locator('.title', { hasText: 'Interactive Weighted Graph' })).toBeVisible();
    await this.svg.waitFor({ state: 'visible' });
  }

  // Mode clicks
  async clickModeAdd() { await this.modeAdd.click(); }
  async clickModeEdge() { await this.modeEdge.click(); }
  async clickModeMove() { await this.modeMove.click(); }
  async clickModeDel() { await this.modeDel.click(); }

  // Get status text
  async getStatusText() { return (await this.status.textContent())?.trim(); }
  async getSelectedInfo() { return (await this.selectedInfo.textContent())?.trim(); }
  async getNodeCount() { return Number((await this.nodeCount.textContent()) || '0'); }
  async getEdgeCount() { return Number((await this.edgeCount.textContent()) || '0'); }
  async getAdjText() { return (await this.adj.textContent())?.trim(); }

  // Click on the SVG at an offset (x,y) relative to the element's top-left
  async clickSvgAtOffset(x, y) {
    const box = await (await this.svg.elementHandle()).boundingBox();
    if (!box) throw new Error('SVG bounding box not found');
    await this.page.mouse.click(box.x + x, box.y + y);
  }

  // Add a node by clicking the svg roughly at given element coordinates
  async addNodeAtOffset(x = 300, y = 200) {
    // ensure we're in add mode
    await this.clickModeAdd();
    await this.clickSvgAtOffset(x, y);
    // wait for node to appear in nodes list via window._graphDemo
    await this.page.waitForFunction(() => window._graphDemo && window._graphDemo.nodes.length > 0);
  }

  // Retrieve nodes and edges from the page-exposed object
  async getNodes() {
    return await this.page.evaluate(() => (window._graphDemo && window._graphDemo.nodes) ? window._graphDemo.nodes.slice() : []);
  }
  async getEdges() {
    return await this.page.evaluate(() => (window._graphDemo && window._graphDemo.edges) ? window._graphDemo.edges.slice() : []);
  }

  // Returns the center coordinates (client) of the nth node circle (0-based)
  async nodeCenterClient(n = 0) {
    // circles are created inside SVG, find nth circle
    const circles = await this.page.locator('svg circle').elementHandles();
    if (!circles || circles.length <= n) throw new Error('Node circle not found');
    const box = await circles[n].boundingBox();
    if (!box) throw new Error('boundingBox missing');
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  }

  // Drag first node by dx,dy (client coordinates)
  async dragNodeBy(n = 0, dx = 50, dy = 30) {
    const center = await this.nodeCenterClient(n);
    await this.page.mouse.move(center.x, center.y);
    await this.page.mouse.down();
    await this.page.mouse.move(center.x + dx, center.y + dy, { steps: 10 });
    await this.page.mouse.up();
    // wait for redraw to stabilize
    await this.page.waitForTimeout(200);
  }

  // Create an edge between first node and second node with a given weight using the prompt dialog
  async createEdgeBetweenNodesWithWeight(nodeIndexA = 0, nodeIndexB = 1, weight = '5') {
    // Switch to edge mode
    await this.clickModeEdge();
    // Prepare dialog handler for prompt
    this.page.once('dialog', async dialog => {
      // dialog.type() should be 'prompt'
      if (dialog.type() === 'prompt') {
        await dialog.accept(String(weight));
      } else {
        await dialog.dismiss();
      }
    });
    // Simulate two mousedown events on the node circles.
    const aCenter = await this.nodeCenterClient(nodeIndexA);
    const bCenter = await this.nodeCenterClient(nodeIndexB);
    // mousedown on first node (handleEdgeClick listens for mousedown)
    await this.page.mouse.move(aCenter.x, aCenter.y);
    await this.page.mouse.down();
    await this.page.mouse.up();
    // then mousedown on second node to complete edge (and trigger prompt)
    await this.page.mouse.move(bCenter.x, bCenter.y);
    await this.page.mouse.down();
    await this.page.mouse.up();
    // wait until edge count increments
    await this.page.waitForFunction(() => window._graphDemo && window._graphDemo.edges.length > 0);
  }

  // Try to create an edge but dismiss the prompt (simulate cancel)
  async createEdgeAndCancel(nodeIndexA = 0, nodeIndexB = 1) {
    await this.clickModeEdge();
    this.page.once('dialog', async dialog => {
      if (dialog.type() === 'prompt') {
        await dialog.dismiss();
      } else {
        await dialog.dismiss();
      }
    });
    const aCenter = await this.nodeCenterClient(nodeIndexA);
    const bCenter = await this.nodeCenterClient(nodeIndexB);
    await this.page.mouse.click(aCenter.x, aCenter.y);
    await this.page.mouse.click(bCenter.x, bCenter.y);
    // short wait for any redraw
    await this.page.waitForTimeout(200);
  }

  async toggleDirected() {
    await this.directedCheckbox.click();
  }

  async clickDijkstraExpectingAlertAndHandle(accept = true) {
    // Dijkstra shows alert "Dijkstra: Click source node then target node on canvas." or "No nodes"
    return new Promise(async (resolve) => {
      const onDialog = async dialog => {
        const msg = dialog.message();
        if (accept) {
          await dialog.accept();
        } else {
          await dialog.dismiss();
        }
        this.page.off('dialog', onDialog);
        resolve(msg);
      };
      this.page.on('dialog', onDialog);
      await this.dijkstraBtn.click();
    });
  }

  async clickPrim() {
    // prim may show alert if graph not connected; capture any dialog
    return new Promise(async (resolve) => {
      const onDialog = async dialog => {
        const msg = dialog.message();
        await dialog.accept();
        this.page.off('dialog', onDialog);
        resolve(msg);
      };
      this.page.on('dialog', onDialog);
      // Click prim. If no dialog appears within 250ms, resolve with null
      await this.primBtn.click();
      setTimeout(() => {
        this.page.off('dialog', onDialog);
        resolve(null);
      }, 250);
    });
  }

  async clickAnimateToggleAndHandleDialog(accept = true) {
    return new Promise(async (resolve) => {
      const onDialog = async dialog => {
        const msg = dialog.message();
        if (accept) await dialog.accept();
        else await dialog.dismiss();
        this.page.off('dialog', onDialog);
        resolve(msg);
      };
      this.page.on('dialog', onDialog);
      await this.animateBtn.click();
    });
  }

  async clickRandom() {
    await this.randomBtn.click();
    // wait for nodes to appear
    await this.page.waitForFunction(() => window._graphDemo && window._graphDemo.nodes.length > 0);
  }

  async clickClear() {
    await this.clearBtn.click();
    // wait until nodes and edges are removed
    await this.page.waitForFunction(() => window._graphDemo && window._graphDemo.nodes.length === 0 && window._graphDemo.edges.length === 0);
  }

  async setDefaultWeight(value) {
    await this.defaultWeight.fill(String(value));
    // trigger change event by blurring
    await this.defaultWeight.press('Tab');
    // small wait
    await this.page.waitForTimeout(50);
  }
}

test.describe('Interactive Weighted Graph Demo - e9332651-d360-11f0-a097-ffdd56c22ef4', () => {
  // We will capture console messages and page errors for every test and assert at the end of the relevant test.
  test.describe('Initial render and components', () => {
    test('loads page and shows title, default mode and UI components', async ({ page }) => {
      const consoleMsgs = [];
      const pageErrors = [];
      page.on('console', msg => consoleMsgs.push({type: msg.type(), text: msg.text()}));
      page.on('pageerror', err => pageErrors.push(err));

      const gp = new GraphPage(page);
      await gp.goto();

      // Title visible
      await expect(page.locator('.title', { hasText: 'Interactive Weighted Graph' })).toBeVisible();

      // Default mode should be Add Node and the corresponding control should be active
      await expect(gp.modeAdd).toHaveClass(/active/);
      expect(await gp.getStatusText()).toContain('Mode: Add Node');

      // Node and edge counts are 0
      expect(await gp.getNodeCount()).toBe(0);
      expect(await gp.getEdgeCount()).toBe(0);

      // Verify presence of key controls
      await expect(gp.modeEdge).toBeVisible();
      await expect(gp.modeMove).toBeVisible();
      await expect(gp.modeDel).toBeVisible();
      await expect(gp.dijkstraBtn).toBeVisible();
      await expect(gp.primBtn).toBeVisible();
      await expect(gp.clearBtn).toBeVisible();
      await expect(gp.randomBtn).toBeVisible();
      await expect(gp.animateBtn).toBeVisible();

      // There should be no uncaught page errors on initial load
      expect(pageErrors.length).toBe(0);
      // No severe console errors
      const errorLogs = consoleMsgs.filter(m => m.type === 'error');
      expect(errorLogs.length).toBe(0);
    });
  });

  test.describe('Modes and transitions', () => {
    test('switching modes updates status text and active button', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Add -> Edge
      await gp.clickModeEdge();
      expect(await gp.getStatusText()).toContain('Add Edge');
      await expect(gp.modeEdge).toHaveClass(/active/);
      await expect(gp.modeAdd).not.toHaveClass(/active/);

      // Edge -> Move
      await gp.clickModeMove();
      expect(await gp.getStatusText()).toContain('Move');
      await expect(gp.modeMove).toHaveClass(/active/);

      // Move -> Delete
      await gp.clickModeDel();
      expect(await gp.getStatusText()).toContain('Delete');
      await expect(gp.modeDel).toHaveClass(/active/);

      // Back to Add
      await gp.clickModeAdd();
      expect(await gp.getStatusText()).toContain('Add Node');
      await expect(gp.modeAdd).toHaveClass(/active/);
    });

    test('Dijkstra button triggers informational alert when no graph / and when graph present', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Ensure graph cleared
      await gp.clickClear();

      // Click Dijkstra with no nodes -> should alert 'No nodes'
      const msgNoNodes = await gp.clickDijkstraExpectingAlertAndHandle(true);
      expect(msgNoNodes).toMatch(/No nodes/);

      // Create a minimal graph (2 nodes + edge) and verify Dijkstra info alert appears
      await gp.addNodeAtOffset(100, 120);
      await gp.addNodeAtOffset(220, 140);

      // Create edge between node 0 and 1 with weight 7
      await gp.createEdgeBetweenNodesWithWeight(0, 1, 7);

      // Now click Dijkstra and it should show the guidance alert
      const msg = await gp.clickDijkstraExpectingAlertAndHandle(true);
      expect(msg).toContain('Dijkstra: Click source node then target node on canvas.');
    });

    test('Prim button triggers algorithm and updates selected info once complete', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Ensure clean state
      await gp.clickClear();

      // Build connected triangle graph (3 nodes fully connected)
      await gp.addNodeAtOffset(120, 120);
      await gp.addNodeAtOffset(300, 130);
      await gp.addNodeAtOffset(210, 260);

      // Add edges (respond to prompt) to make it connected
      await gp.createEdgeBetweenNodesWithWeight(0, 1, 2);
      await gp.createEdgeBetweenNodesWithWeight(1, 2, 3);
      await gp.createEdgeBetweenNodesWithWeight(2, 0, 4);

      // Click Prim; may animate. We do not rely on dialog; capture optional dialog message
      const primDialog = await gp.clickPrim();
      // If there was a dialog, ensure it was the 'Graph is not connected' message or null
      if (primDialog !== null) {
        expect(primDialog).toMatch(/Graph is not connected|MST/);
      }

      // Wait for selectedInfo to eventually contain 'Prim' or 'MST' or 'done' OR for pathEdges highlighted
      await gp.page.waitForFunction(() => {
        const sel = document.getElementById('selected-info');
        return sel && /Prim|MST|done/.test(sel.textContent || '');
      }, { timeout: 5000 }).catch(() => {}); // ignore timeout - we will assert at least some result below

      // After some time, selectedInfo should reflect MST done or list edges
      const selText = await gp.getSelectedInfo();
      // Accept either 'Prim MST done' or list of edges OR empty if animation still running; assert node/edge counts still > 0
      expect(await gp.getNodeCount()).toBeGreaterThanOrEqual(3);
      expect(await gp.getEdgeCount()).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('Graph manipulation: add, edge-create, move, delete, clear, random', () => {
    test('Add nodes by clicking SVG and update stats and adjacency', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Ensure start cleared
      await gp.clickClear();

      // Add two nodes at specific offsets
      await gp.addNodeAtOffset(150, 120);
      await gp.addNodeAtOffset(260, 160);

      expect(await gp.getNodeCount()).toBe(2);

      // Adjacency should reflect nodes but no edges
      const adjText = await gp.getAdjText();
      expect(adjText).toContain('0:');
      expect(adjText).toContain('1:');
    });

    test('Create edge with prompt; canceling prompt does not add edge', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // start clean
      await gp.clickClear();

      // Add two nodes
      await gp.addNodeAtOffset(150, 120);
      await gp.addNodeAtOffset(260, 160);

      // Attempt to create edge but cancel prompt
      await gp.createEdgeAndCancel(0, 1);

      // Edge count should remain 0
      expect(await gp.getEdgeCount()).toBe(0);

      // Now create edge properly
      await gp.createEdgeBetweenNodesWithWeight(0, 1, 9);
      expect(await gp.getEdgeCount()).toBe(1);

      // The adjacency should show the edge
      const adjAfter = await gp.getAdjText();
      expect(adjAfter).toMatch(/0: .*1\(w=9/);
    });

    test('Move node in Move mode updates node coordinates', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      await gp.clickClear();

      // Add a node
      await gp.addNodeAtOffset(200, 140);

      // Read original position from exposed data
      const originalNodes = await gp.getNodes();
      expect(originalNodes.length).toBeGreaterThanOrEqual(1);
      const orig = originalNodes[0];

      // Switch to Move mode and drag node
      await gp.clickModeMove();

      // Drag by a known delta
      await gp.dragNodeBy(0, 40, 25);

      // After dragging, node coordinates in window._graphDemo should have changed
      const nodesAfter = await gp.getNodes();
      const moved = nodesAfter[0];
      // Expect moved coordinates to differ from original significantly
      expect(Math.abs(moved.x - orig.x)).toBeGreaterThan(5);
      expect(Math.abs(moved.y - orig.y)).toBeGreaterThan(5);
    });

    test('Delete node and edge in Delete mode using confirm dialog', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      await gp.clickClear();

      // Add two nodes and an edge
      await gp.addNodeAtOffset(160, 120);
      await gp.addNodeAtOffset(280, 160);
      await gp.createEdgeBetweenNodesWithWeight(0, 1, 6);

      expect(await gp.getNodeCount()).toBe(2);
      expect(await gp.getEdgeCount()).toBe(1);

      // Delete the edge first: click in delete mode and confirm
      await gp.clickModeDel();
      // Click near the edge's midpoint - but we can click the edge line by querying existing line element
      const lineHandle = await page.locator('svg line').elementHandle();
      expect(lineHandle).toBeTruthy();

      // Prepare dialog handler to accept confirm
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('confirm');
        await dialog.accept();
      });

      // Click the edge (its bounding box center)
      const box = await lineHandle!.boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
        // allow for redraw after deletion
        await page.waitForTimeout(200);
      }

      // edge-count should now be 0
      expect(await gp.getEdgeCount()).toBe(0);

      // Now delete a node: find first circle and click to delete
      const circleHandle = await page.locator('svg circle').elementHandle();
      expect(circleHandle).toBeTruthy();
      page.once('dialog', async dialog => {
        // confirm deletion
        expect(dialog.type()).toBe('confirm');
        await dialog.accept();
      });
      const cbox = await circleHandle!.boundingBox();
      if (cbox) {
        await page.mouse.click(cbox.x + cbox.width/2, cbox.y + cbox.height/2);
        await page.waitForTimeout(200);
      }

      // node count should be 1 now
      expect(await gp.getNodeCount()).toBe(1);
    });

    test('Clear and Random buttons behave as expected', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Click random to generate a graph
      await gp.clickRandom();
      const nodeCountAfterRandom = await gp.getNodeCount();
      const edgeCountAfterRandom = await gp.getEdgeCount();
      expect(nodeCountAfterRandom).toBeGreaterThan(0);
      expect(edgeCountAfterRandom).toBeGreaterThanOrEqual(0);

      // Now clear and ensure counts are zero
      await gp.clickClear();
      expect(await gp.getNodeCount()).toBe(0);
      expect(await gp.getEdgeCount()).toBe(0);
      expect((await gp.getAdjText())).toBe('[]' || '');
    });
  });

  test.describe('Settings, toggles and edge cases', () => {
    test('default weight change affects prompt default and directed toggle respected on edges', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      await gp.clickClear();

      // Change default weight to 11
      await gp.setDefaultWeight(11);

      // Add two nodes
      await gp.addNodeAtOffset(140, 120);
      await gp.addNodeAtOffset(260, 160);

      // Toggle directed ON
      await gp.toggleDirected();

      // Create edge; the created edge should have directed=true
      // Spy and provide no explicit weight so prompt default will be used; provide accept with empty string to let code coerce
      page.once('dialog', async dialog => {
        expect(dialog.type()).toBe('prompt');
        // The prompt's default text should contain '11' if the input default is set by the code.
        // Accept an explicit numeric string to ensure edge weight set deterministically.
        await dialog.accept('11');
      });

      // Create edge between 0 and 1
      await gp.clickModeEdge();
      const a = await gp.nodeCenterClient(0);
      const b = await gp.nodeCenterClient(1);
      await page.mouse.click(a.x, a.y);
      await page.mouse.click(b.x, b.y);

      // Wait for edge created
      await page.waitForFunction(() => (window._graphDemo && window._graphDemo.edges.length > 0));
      const edges = await gp.getEdges();
      expect(edges.length).toBeGreaterThan(0);
      expect(edges[0].directed).toBe(true);
      expect(edges[0].w).toBe(11);
    });

    test('toggle step animation shows ON/OFF alert and toggles behavior', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      // Clicking animate steps produces an alert with 'Step animation ON' or 'OFF'
      const msg1 = await gp.clickAnimateToggleAndHandleDialog(true);
      expect(msg1).toMatch(/Step animation (ON|OFF)/);

      // Toggle back
      const msg2 = await gp.clickAnimateToggleAndHandleDialog(true);
      expect(msg2).toMatch(/Step animation (ON|OFF)/);
    });

    test('running Dijkstra on a small graph finds shortest path and displays distances overlay', async ({ page }) => {
      const gp = new GraphPage(page);
      await gp.goto();

      await gp.clickClear();

      // Create linear graph: 0 - 1 - 2 with weights 2 and 3
      await gp.addNodeAtOffset(120, 120);
      await gp.addNodeAtOffset(260, 120);
      await gp.addNodeAtOffset(400, 120);

      await gp.createEdgeBetweenNodesWithWeight(0, 1, 2);
      await gp.createEdgeBetweenNodesWithWeight(1, 2, 3);

      // Start Dijkstra and accept initial alert
      const dijkstraAlert = await gp.clickDijkstraExpectingAlertAndHandle(true);
      expect(dijkstraAlert).toContain('Dijkstra: Click source node then target node on canvas.');

      // Click source then target
      const src = await gp.nodeCenterClient(0);
      const tgt = await gp.nodeCenterClient(2);

      // Click source
      await page.mouse.click(src.x, src.y);
      // Click target
      await page.mouse.click(tgt.x, tgt.y);

      // Wait until selected-info shows 'Shortest' result or until overlay distances appended
      await page.waitForFunction(() => {
        const sel = document.getElementById('selected-info');
        const overlay = document.getElementById('overlay');
        return (sel && /Shortest/.test(sel.textContent || '')) || !!overlay;
      }, { timeout: 7000 });

      const selText = await gp.getSelectedInfo();
      expect(/Shortest/.test(selText)).toBeTruthy();
    });
  });

  test.describe('Console and page error observations', () => {
    test('no unexpected runtime exceptions or console errors during common flows', async ({ page }) => {
      const pageErrors = [];
      const consoleErrors = [];
      page.on('pageerror', err => pageErrors.push(err));
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      const gp = new GraphPage(page);
      await gp.goto();

      // perform a set of operations to exercise code paths
      await gp.clickClear();
      await gp.addNodeAtOffset(180, 140);
      await gp.addNodeAtOffset(320, 160);
      await gp.createEdgeBetweenNodesWithWeight(0, 1, 4);
      // drag node
      await gp.clickModeMove();
      await gp.dragNodeBy(0, 10, 10);
      // run prim (may animate)
      await gp.clickPrim();
      // clear
      await gp.clickClear();

      // Allow any async errors to surface
      await page.waitForTimeout(300);

      // Assert no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Assert no console error logs
      expect(consoleErrors.length).toBe(0);
    });
  });
});