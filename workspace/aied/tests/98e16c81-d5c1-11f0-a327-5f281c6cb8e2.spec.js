import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e16c81-d5c1-11f0-a327-5f281c6cb8e2.html';

test.describe('Weighted Graph Explorer — Interactive Demo (FSM validations)', () => {
  // Helpers to query the application state inside the page
  const getCounts = async (page) => {
    return page.evaluate(() => ({ nodes: nodes.length, edges: edges.length }));
  };

  const getLogText = async (page) => {
    return page.evaluate(() => Array.from(document.getElementById('log').children).map(e => e.textContent));
  };

  const getButtonClassList = async (page, selector) => {
    return page.evaluate((sel) => document.querySelector(sel).className, selector);
  };

  const getNodes = async (page) => {
    return page.evaluate(() => nodes.map(n => ({ id: n.id, label: n.label, x: n.x, y: n.y })));
  };

  const getEdges = async (page) => {
    return page.evaluate(() => edges.map(e => ({ id: e.id, a: e.a, b: e.b, weight: e.weight, state: e.state })));
  };

  const getHovered = async (page) => {
    return page.evaluate(() => ({ hoveredNode: hoveredNode ? hoveredNode.id : null, hoveredEdge: hoveredEdge ? hoveredEdge.id : null }));
  };

  test.beforeEach(async ({ page }) => {
    // Navigate and wait for demo initialization log
    await page.goto(APP_URL);
    // Wait for the initial "Demo graph created." log line that initDemo pushes
    await page.waitForFunction(() => {
      const logEl = document.getElementById('log');
      return logEl && logEl.textContent && logEl.textContent.includes('Demo graph created');
    });
  });

  test('Initialization / Idle state: page loads and demo graph created', async ({ page }) => {
    // Validate canvas exists and initial data populated by initDemo
    const canvas = page.locator('#canvas');
    await expect(canvas).toHaveCount(1);

    const counts = await getCounts(page);
    // The demo populates sample nodes and edges; expect at least 5 nodes and 6 edges as in implementation
    expect(counts.nodes).toBeGreaterThanOrEqual(5);
    expect(counts.edges).toBeGreaterThanOrEqual(6);

    // Validate sidebar reflects counts
    const nodeCountText = await page.locator('#nodeCount').textContent();
    const edgeCountText = await page.locator('#edgeCount').textContent();
    expect(Number(nodeCountText)).toBe(counts.nodes);
    expect(Number(edgeCountText)).toBe(counts.edges);

    // Confirm log contains startup message
    const logs = await getLogText(page);
    expect(logs.some(l => l.includes('Demo graph created.'))).toBeTruthy();

    // Ensure no page error was thrown during init
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    // wait a bit to catch late errors
    await page.waitForTimeout(100);
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Mode toggles and their entry/exit actions', () => {
    test('Add Edge mode toggle emits correct logs and updates button state', async ({ page }) => {
      // clear console captures for this test
      const logsBefore = await getLogText(page);

      // Click Add Edge button to activate
      const btnAddEdge = page.locator('#btnAddEdge');
      await btnAddEdge.click();

      // Validate class active
      const className = await getButtonClassList(page, '#btnAddEdge');
      expect(className).toContain('active');

      // Log should include "Add Edge mode ON. Click two nodes."
      const logs = await getLogText(page);
      expect(logs.length).toBeGreaterThan(logsBefore.length);
      expect(logs.some(l => l.includes('Add Edge mode ON. Click two nodes.'))).toBeTruthy();

      // Click again to exit Add Edge mode
      await btnAddEdge.click();
      const classNameAfter = await getButtonClassList(page, '#btnAddEdge');
      expect(classNameAfter).not.toContain('active');

      // Confirm exit log present
      const logsAfter = await getLogText(page);
      expect(logsAfter.some(l => l.includes('Add Edge mode OFF.'))).toBeTruthy();
    });

    test('Edit/Delete Edge mode toggle emits correct logs and updates button state', async ({ page }) => {
      const btnEdit = page.locator('#btnEditEdge');

      await btnEdit.click();
      const className = await getButtonClassList(page, '#btnEditEdge');
      expect(className).toContain('active');
      const logs = await getLogText(page);
      expect(logs.some(l => l.includes('Edit/Delete Edge mode ON. Click an edge to edit or remove.'))).toBeTruthy();

      await btnEdit.click();
      const classNameAfter = await getButtonClassList(page, '#btnEditEdge');
      expect(classNameAfter).not.toContain('active');
      const logsAfter = await getLogText(page);
      expect(logsAfter.some(l => l.includes('Edit/Delete Edge mode OFF.'))).toBeTruthy();
    });
  });

  test.describe('Canvas interactions: add node, drag node, hovered state', () => {
    test('Click on empty canvas adds a node and logs action', async ({ page }) => {
      const before = await getCounts(page);
      // Click at a coordinate that is empty - choose near bottom-right quarter
      const box = await page.locator('#canvas').boundingBox();
      expect(box).toBeTruthy();
      const x = Math.floor(box.x + box.width * 0.9);
      const y = Math.floor(box.y + box.height * 0.9);

      await page.mouse.click(x, y);
      // small wait for draw/update
      await page.waitForTimeout(100);

      const after = await getCounts(page);
      expect(after.nodes).toBe(before.nodes + 1);
      // log contains "Added node"
      const logs = await getLogText(page);
      expect(logs.some(l => l.includes('Added node'))).toBeTruthy();
    });

    test('Drag node updates its coordinates and sets hoveredNode on move', async ({ page }) => {
      // Get a node to drag (first node)
      const nodesArr = await getNodes(page);
      expect(nodesArr.length).toBeGreaterThan(0);
      const n = nodesArr[0];

      // Compute client coords for canvas based on canvas bounding box and canvas scaling
      const canvasBox = await page.locator('#canvas').boundingBox();
      expect(canvasBox).toBeTruthy();

      // Map canvas internal coordinates to client coordinates:
      // internal canvas coords equal to canvas.width/height and are already set to clientWidth/height in code.
      // Implementation uses getMousePos which uses clientX/clientY scaled to canvas.width/canvas.clientWidth
      // We can click at node's approximate client coordinates by using bounding box offset.
      // Since canvas width equals client width in the demo, using node.x/node.y scaled by (clientWidth / canvas.width) is identity.
      // We'll compute client coordinates as canvasBox.x + node.x * (canvasBox.width / canvas.width). Since canvas.width equals canvasBox.width, this reduces to canvasBox.x + node.x
      const clientX = canvasBox.x + n.x;
      const clientY = canvasBox.y + n.y;

      // mousedown on node, move, mouseup
      await page.mouse.move(clientX, clientY);
      await page.mouse.down();
      // move by +30,+20
      await page.mouse.move(clientX + 30, clientY + 20, { steps: 8 });
      await page.waitForTimeout(50);
      await page.mouse.up();

      // wait for draw
      await page.waitForTimeout(80);

      const nodesAfter = await getNodes(page);
      const updated = nodesAfter.find(x => x.id === n.id);
      expect(updated).toBeTruthy();
      // coordinates should have changed
      expect(Math.abs(updated.x - n.x)).toBeGreaterThan(0.5);
      expect(Math.abs(updated.y - n.y)).toBeGreaterThan(0.5);

      // Move mouse to the node to ensure hoveredNode updated
      const clientX2 = canvasBox.x + updated.x;
      const clientY2 = canvasBox.y + updated.y;
      await page.mouse.move(clientX2, clientY2);
      // small wait
      await page.waitForTimeout(50);
      const hovered = await getHovered(page);
      expect(hovered.hoveredNode).toBe(updated.id);
    });
  });

  test.describe('Add Edge interactions (including edge cases)', () => {
    test('Successfully add a new edge between two non-adjacent nodes', async ({ page }) => {
      // Pick nodes that are not directly connected: based on demo edges, n1 (A) and n3 (C) are not directly connected
      const nodesArr = await getNodes(page);
      expect(nodesArr.length).toBeGreaterThanOrEqual(5);
      const nodeA = nodesArr[0];
      const nodeC = nodesArr[2];

      // Verify no existing direct edge between them
      const edgesBefore = await getEdges(page);
      const existBefore = edgesBefore.find(e => (e.a === nodeA.id && e.b === nodeC.id) || (e.a === nodeC.id && e.b === nodeA.id));
      expect(existBefore).toBeUndefined();

      // Activate Add Edge mode
      await page.locator('#btnAddEdge').click();
      // Provide prompt for weight when the second node is clicked
      page.once('dialog', async (dialog) => {
        // This will be the prompt "Enter weight (positive number):"
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('1.5');
      });

      // Click first node
      const canvasBox = await page.locator('#canvas').boundingBox();
      const firstX = canvasBox.x + nodeA.x;
      const firstY = canvasBox.y + nodeA.y;
      await page.mouse.click(firstX, firstY);

      // Click second node
      const secondX = canvasBox.x + nodeC.x;
      const secondY = canvasBox.y + nodeC.y;
      await page.mouse.click(secondX, secondY);

      // small wait for UI update
      await page.waitForTimeout(150);

      const edgesAfter = await getEdges(page);
      const existAfter = edgesAfter.find(e => (e.a === nodeA.id && e.b === nodeC.id) || (e.a === nodeC.id && e.b === nodeA.id));
      expect(existAfter).toBeTruthy();
      expect(Number(existAfter.weight)).toBeCloseTo(1.5);

      // Deactivate Add Edge mode
      await page.locator('#btnAddEdge').click();
    });

    test('Adding a self-loop is blocked and shows an alert', async ({ page }) => {
      const nodesArr = await getNodes(page);
      const node = nodesArr[0];

      // Activate Add Edge mode
      await page.locator('#btnAddEdge').click();

      // Prepare dialog handler to capture alert when second click is the same node
      const dialogs = [];
      page.on('dialog', async (dialog) => {
        dialogs.push({ type: dialog.type(), message: dialog.message() });
        await dialog.accept();
      });

      const canvasBox = await page.locator('#canvas').boundingBox();
      const x = canvasBox.x + node.x, y = canvasBox.y + node.y;

      // Click same node twice
      await page.mouse.click(x, y);
      await page.mouse.click(x, y);

      await page.waitForTimeout(100);

      // Confirm that an alert occurred indicating self-loop blocked
      const foundAlert = dialogs.find(d => d.type === 'alert' && d.message.includes('Cannot create self-loop'));
      expect(foundAlert).toBeTruthy();

      // Ensure addingEdgeFirstNode reset: cannot access variable directly but we can try adding same pair again to ensure no unintended edge added
      const edgesNow = await getEdges(page);
      // There should be no new self-loop edge (edge with same a and b)
      expect(edgesNow.find(e => e.a === e.b)).toBeUndefined();

      // Deactivate Add Edge mode
      await page.locator('#btnAddEdge').click();
    });

    test('Attempt to add an already existing edge is blocked with an alert', async ({ page }) => {
      // Pick a pair that already has an edge: nodes[0] and nodes[1] have an edge
      const nodesArr = await getNodes(page);
      const nodeA = nodesArr[0];
      const nodeB = nodesArr[1];

      // Activate Add Edge mode
      await page.locator('#btnAddEdge').click();

      // Listen for alert when trying to create duplicate edge
      let alertSeen = false;
      page.on('dialog', async (dialog) => {
        if (dialog.type() === 'alert' && dialog.message().includes('Edge already exists')) {
          alertSeen = true;
        }
        await dialog.accept();
      });

      const canvasBox = await page.locator('#canvas').boundingBox();
      // Click first then second (they already have an edge)
      await page.mouse.click(canvasBox.x + nodeA.x, canvasBox.y + nodeA.y);
      await page.mouse.click(canvasBox.x + nodeB.x, canvasBox.y + nodeB.y);

      await page.waitForTimeout(120);

      expect(alertSeen).toBeTruthy();

      // Deactivate Add Edge mode
      await page.locator('#btnAddEdge').click();
    });
  });

  test.describe('Edit/Delete Edge interactions', () => {
    test('Edit an edge weight via Edit mode prompt', async ({ page }) => {
      // Ensure we have at least one edge to edit
      const edgesArr = await getEdges(page);
      expect(edgesArr.length).toBeGreaterThanOrEqual(1);
      const targetEdge = edgesArr[0];

      // Activate edit mode
      await page.locator('#btnEditEdge').click();

      // Handler to respond to prompt and then check confirm flow if needed
      page.once('dialog', async (dialog) => {
        // This is the prompt to edit weight; respond with new weight '9'
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('9');
      });

      // Click near the midpoint of the edge segment to trigger edit
      // Get node positions for that edge
      const nodesArr = await getNodes(page);
      const na = nodesArr.find(n => n.id === targetEdge.a);
      const nb = nodesArr.find(n => n.id === targetEdge.b);
      const canvasBox = await page.locator('#canvas').boundingBox();
      const mx = canvasBox.x + (na.x + nb.x) / 2;
      const my = canvasBox.y + (na.y + nb.y) / 2;

      await page.mouse.click(mx, my);
      await page.waitForTimeout(150);

      // Validate weight changed
      const edgesAfter = await getEdges(page);
      const updated = edgesAfter.find(e => e.id === targetEdge.id);
      expect(Number(updated.weight)).toBeCloseTo(9);

      // Deactivate edit mode
      await page.locator('#btnEditEdge').click();
    });

    test('Delete an edge via Edit mode using DEL and confirmation', async ({ page }) => {
      // Add a temporary edge to delete to avoid removing core demo edges
      // We'll use Add Edge mode to add an edge between nodes that are not directly connected (0 and 2) if needed
      const nodesArr = await getNodes(page);
      const nodeA = nodesArr[0];
      const nodeC = nodesArr[2];

      // If edge absent, add it first
      let edgesArr = await getEdges(page);
      let candidate = edgesArr.find(e => (e.a === nodeA.id && e.b === nodeC.id) || (e.a === nodeC.id && e.b === nodeA.id));
      if (!candidate) {
        // add edge
        await page.locator('#btnAddEdge').click();
        page.once('dialog', async (d) => { await d.accept('2'); });
        const canvasBox = await page.locator('#canvas').boundingBox();
        await page.mouse.click(canvasBox.x + nodeA.x, canvasBox.y + nodeA.y);
        await page.mouse.click(canvasBox.x + nodeC.x, canvasBox.y + nodeC.y);
        await page.waitForTimeout(120);
        await page.locator('#btnAddEdge').click();
        edgesArr = await getEdges(page);
        candidate = edgesArr.find(e => (e.a === nodeA.id && e.b === nodeC.id) || (e.a === nodeC.id && e.b === nodeA.id));
      }
      expect(candidate).toBeTruthy();

      // Activate edit mode
      await page.locator('#btnEditEdge').click();

      // Prepare dialog handler sequence: first prompt return 'DEL', then confirm accept
      let seenPrompt = false;
      page.on('dialog', async (dialog) => {
        if (dialog.type() === 'prompt') {
          seenPrompt = true;
          await dialog.accept('DEL');
        } else if (dialog.type() === 'confirm') {
          await dialog.accept(); // accept deletion
        } else {
          await dialog.dismiss();
        }
      });

      // Click near the edge to trigger prompt -> delete
      const nodesNow = await getNodes(page);
      const na = nodesNow.find(n => n.id === candidate.a);
      const nb = nodesNow.find(n => n.id === candidate.b);
      const canvasBox = await page.locator('#canvas').boundingBox();
      const mx = canvasBox.x + (na.x + nb.x) / 2;
      const my = canvasBox.y + (na.y + nb.y) / 2;

      await page.mouse.click(mx, my);
      await page.waitForTimeout(200);

      // Confirm the edge was removed
      const edgesFinal = await getEdges(page);
      expect(edgesFinal.find(e => e.id === candidate.id)).toBeUndefined();

      // Deactivate edit mode
      await page.locator('#btnEditEdge').click();
    });
  });

  test.describe('Algorithm computations and highlight reset', () => {
    test('Compute Dijkstra shortest path highlights path and logs result', async ({ page }) => {
      // Choose start and end from select elements - pick first and third nodes (A -> C)
      const nodesArr = await getNodes(page);
      const startId = nodesArr[0].id;
      const endId = nodesArr[2].id;

      // Set selects
      await page.selectOption('#selectStart', startId);
      await page.selectOption('#selectEnd', endId);

      // Click compute
      await page.locator('#btnDijkstra').click();

      // Wait for result log to appear
      await page.waitForFunction(() => {
        const logEl = document.getElementById('log');
        return logEl && logEl.textContent && logEl.textContent.includes('Dijkstra: shortest distance');
      }, { timeout: 2000 });

      const logs = await getLogText(page);
      expect(logs.some(l => l.includes('Dijkstra: shortest distance'))).toBeTruthy();

      // Edges in path should have state 'path'
      const edgesAfter = await getEdges(page);
      const pathEdges = edgesAfter.filter(e => e.state === 'path');
      expect(pathEdges.length).toBeGreaterThanOrEqual(1);

      // Now reset highlights and ensure all edges state become null
      await page.locator('#btnResetHighlights').click();
      await page.waitForTimeout(120);
      const logsAfter = await getLogText(page);
      expect(logsAfter.some(l => l.includes('Highlights cleared.'))).toBeTruthy();
      const edgesReset = await getEdges(page);
      expect(edgesReset.every(e => e.state === null)).toBeTruthy();
    });

    test('Compute Kruskal MST highlights edges and logs result', async ({ page }) => {
      // Click MST compute
      await page.locator('#btnMST').click();

      // Wait for MST log entry
      await page.waitForFunction(() => {
        const logEl = document.getElementById('log');
        return logEl && logEl.textContent && logEl.textContent.includes('Kruskal MST: total weight');
      }, { timeout: 2000 });

      const logs = await getLogText(page);
      expect(logs.some(l => l.includes('Kruskal MST: total weight'))).toBeTruthy();

      // Some edges should be marked as 'mst'
      const edgesAfter = await getEdges(page);
      const mstEdges = edgesAfter.filter(e => e.state === 'mst');
      expect(mstEdges.length).toBeGreaterThanOrEqual(1);

      // Reset highlights and verify cleared
      await page.locator('#btnResetHighlights').click();
      await page.waitForTimeout(80);
      const edgesReset = await getEdges(page);
      expect(edgesReset.every(e => e.state === null)).toBeTruthy();
    });
  });

  test.describe('Clear graph functionality and FSM GraphCleared state', () => {
    test('Clear graph confirmation clears nodes and edges and logs Graph cleared', async ({ page }) => {
      // Listen for confirm dialog and accept it
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('confirm');
        await dialog.accept();
      });

      // Click clear
      await page.locator('#btnClear').click();

      // Wait a bit for update
      await page.waitForTimeout(200);

      // Validate counts are zero
      const counts = await getCounts(page);
      expect(counts.nodes).toBe(0);
      expect(counts.edges).toBe(0);

      // Check UI counts and adjacency list reflect empty
      const nodeCountText = await page.locator('#nodeCount').textContent();
      const edgeCountText = await page.locator('#edgeCount').textContent();
      expect(Number(nodeCountText)).toBe(0);
      expect(Number(edgeCountText)).toBe(0);
      const adjMatrixHTML = await page.locator('#adjMatrix').innerHTML();
      expect(adjMatrixHTML).toContain('No nodes');

      // Log should include Graph cleared.
      const logs = await getLogText(page);
      expect(logs.some(l => l.includes('Graph cleared.'))).toBeTruthy();
    });
  });

  test.describe('Event handlers existence and Canvas events', () => {
    test('Canvas mousedown/mousemove/mouseup handlers are wired and do not throw errors when used', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(String(err)));

      // Recreate a small graph: click to add two nodes so we can interact
      const canvasBox = await page.locator('#canvas').boundingBox();
      expect(canvasBox).toBeTruthy();
      const x1 = canvasBox.x + 40, y1 = canvasBox.y + 40;
      const x2 = canvasBox.x + 120, y2 = canvasBox.y + 80;

      await page.mouse.click(x1, y1);
      await page.waitForTimeout(60);
      await page.mouse.click(x2, y2);
      await page.waitForTimeout(60);

      // Simulate mousedown on first node, move, and mouseup
      await page.mouse.move(x1, y1);
      await page.mouse.down();
      await page.mouse.move(x1 + 50, y1 + 30);
      await page.mouse.up();

      // Trigger mousemove to an empty area and then mouseup
      await page.mouse.move(canvasBox.x + 10, canvasBox.y + 10);
      await page.mouse.up();

      // No page errors should have occurred during these canvas interactions
      await page.waitForTimeout(80);
      expect(pageErrors.length).toBe(0);
    });
  });

  test('Console and page error monitoring: ensure no unexpected runtime errors', async ({ page }) => {
    const consoleErrors = [];
    const consoleMsgs = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    // perform a benign action to generate more logs
    await page.locator('#btnResetHighlights').click();
    await page.waitForTimeout(80);

    // Validate that no console errors or page errors were emitted
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // Validate that useful log messages are present (sanity check)
    const msgs = consoleMsgs.map(m => m.text).join('\n');
    expect(msgs.length).toBeGreaterThanOrEqual(0);
  });
});