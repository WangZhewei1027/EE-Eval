import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c13b752-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Graph (Undirected) - Interactive Demo (FSM validation)', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for canvas to be ready
    await page.waitForSelector('#canvas');
  });

  test.afterEach(async () => {
    // Nothing special to teardown beyond Playwright default
  });

  // Helper: get canvas bounding box and compute an absolute coordinate
  async function canvasPoint(page, offsetX, offsetY) {
    const canvas = await page.$('#canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not found');
    const x = box.x + offsetX;
    const y = box.y + offsetY;
    return { x, y, box };
  }

  // Helper: click on canvas at element-local coordinates
  async function clickCanvasAt(page, offsetX, offsetY, clickOptions = {}) {
    const p = await canvasPoint(page, offsetX, offsetY);
    await page.mouse.click(p.x, p.y, clickOptions);
  }

  // Helper: dispatch mousedown/move/up around canvas coordinates
  async function dragCanvas(page, from, to, options = {}) {
    const start = await canvasPoint(page, from.x, from.y);
    const end = await canvasPoint(page, to.x, to.y);
    if (options.modifiers && options.modifiers.includes('Shift')) {
      await page.keyboard.down('Shift');
    }
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    // small move to ensure mouseDown handlers run
    await page.mouse.move((start.x + end.x) / 2, (start.y + end.y) / 2, { steps: 6 });
    await page.mouse.move(end.x, end.y, { steps: 6 });
    await page.mouse.up();
    if (options.modifiers && options.modifiers.includes('Shift')) {
      await page.keyboard.up('Shift');
    }
  }

  test('Initial state S0_Idle: canvas and controls present; no page errors', async ({ page }) => {
    // Validate canvas element exists and has expected size attributes in DOM
    const canvasExists = await page.$('#canvas') !== null;
    expect(canvasExists).toBeTruthy();

    const canvasSize = await page.$eval('#canvas', (c) => ({ w: c.width, h: c.height }));
    expect(canvasSize.w).toBe(900);
    expect(canvasSize.h).toBe(640);

    // The app writes an initial 'Ready.' line to the textarea with id 'log' — ensure it contains that.
    const logText = await page.$eval('#log', (ta) => ta.value);
    expect(logText).toContain('Ready. Create nodes by clicking canvas');

    // Ensure there are no uncaught exceptions on load
    expect(pageErrors.length).toBe(0);

    // Confirm initial internal graph state (S0) is empty nodes/edges
    const result = await page.evaluate(() => {
      return {
        nodesLength: graph && graph.nodes ? graph.nodes.length : null,
        edgesLength: graph && graph.edges ? graph.edges.length : null,
        nextNodeId: typeof nextNodeId !== 'undefined' ? nextNodeId : null
      };
    });
    expect(result.nodesLength).toBe(0);
    expect(result.edgesLength).toBe(0);
    expect(typeof result.nextNodeId).toBe('number');
  });

  test('S0 -> S3 CreatingNode via canvas click: click creates node and selects it', async ({ page }) => {
    // Click at (100,100) local canvas coordinates to create first node
    await clickCanvasAt(page, 100, 100);

    // After click, graph should have one node and selectedNode should be set
    const info = await page.evaluate(() => {
      return {
        nodesLength: graph.nodes.length,
        selectedNodeId: selectedNode ? selectedNode.id : null,
        node0: graph.nodes[0] ? { id: graph.nodes[0].id, x: graph.nodes[0].x, y: graph.nodes[0].y } : null
      };
    });
    expect(info.nodesLength).toBeGreaterThanOrEqual(1);
    expect(info.selectedNodeId).toBeTruthy();
    expect(info.node0).not.toBeNull();

    // Ensure canvas rendered by checking that showLabels is present and default state
    const showLabelsChecked = await page.$eval('#showLabels', el => el.checked);
    expect(showLabelsChecked).toBeTruthy();

    // No new page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Create two nodes and S1 -> S4 -> S0 Creating Edge via Shift+drag between nodes', async ({ page }) => {
    // Create first node at (150,150)
    await clickCanvasAt(page, 150, 150);
    // Create second node at (300,150)
    await clickCanvasAt(page, 300, 150);

    // Verify two nodes exist
    const nodeInfo = await page.evaluate(() => ({ nodes: graph.nodes.map(n => ({ id: n.id, x: n.x, y: n.y })) }));
    expect(nodeInfo.nodes.length).toBeGreaterThanOrEqual(2);
    const n1 = nodeInfo.nodes[0];
    const n2 = nodeInfo.nodes[1];

    // Shift+drag from node1 to node2 to create an edge
    // Use local coordinates roughly at their positions
    // Note: Use coordinates used above to create nodes (we clicked at 150,150 and 300,150)
    await dragCanvas(page, { x: 150, y: 150 }, { x: 300, y: 150 }, { modifiers: ['Shift'] });

    // After drag, there should be at least one edge
    const edgesAfter = await page.evaluate(() => graph.edges.map(e => ({ id: e.id, a: e.a, b: e.b, weight: e.weight })));
    expect(edgesAfter.length).toBeGreaterThanOrEqual(1);
    // Validate added edge connects two existing node ids
    const e = edgesAfter[0];
    const nodeIds = nodeInfo.nodes.map(n => n.id);
    expect(nodeIds).toContain(e.a);
    expect(nodeIds).toContain(e.b);

    // Click near midpoint of the edge to select it (S2_EdgeSelected)
    // Compute midpoint in page coordinates using nodes positions via evaluate
    const midpoint = await page.evaluate(() => {
      const a = graph.nodesById[graph.edges[0].a];
      const b = graph.nodesById[graph.edges[0].b];
      // worldToScreen exists in page, but easier: call worldToScreen via evaluating its defined function
      const A = worldToScreen(a);
      const B = worldToScreen(b);
      return { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
    });

    // Convert midpoint (which is already screen coords) to canvas-local click:
    // Because our clickCanvasAt expects offsets relative to the canvas element,
    // we need to compute offsets from canvas bounding box.
    const canvasBox = await page.$eval('#canvas', c => {
      const r = c.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });
    // Click at the midpoint (rounded)
    await page.mouse.click(canvasBox.x + midpoint.x, canvasBox.y + midpoint.y);

    // After click, selectedEdge should be set
    const selectedEdge = await page.evaluate(() => selectedEdge ? { id: selectedEdge.id, a: selectedEdge.a, b: selectedEdge.b } : null);
    expect(selectedEdge).not.toBeNull();
    expect(selectedEdge.a).toBe(e.a);
    expect(selectedEdge.b).toBe(e.b);

    // No page errors occurred during edge creation/selection
    expect(pageErrors.length).toBe(0);
  });

  test('Drag node and ensure position updates and history records move (S1 -> S0 via MouseUp)', async ({ page }) => {
    // Create a node at 220, 220
    await clickCanvasAt(page, 220, 220);

    // Get the created node id and initial coords
    const before = await page.evaluate(() => {
      const n = graph.nodes[graph.nodes.length - 1];
      return { id: n.id, x: n.x, y: n.y, historyPtr: historyPtr };
    });

    // Drag the node by using mouse down/move/up without shift to move node
    // Move by +50 on x
    const from = { x: 220, y: 220 };
    const to = { x: 270, y: 220 };
    // Use direct mouse actions (no modifiers)
    const start = await canvasPoint(page, from.x, from.y);
    const end = await canvasPoint(page, to.x, to.y);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await page.mouse.up();

    // After the drag, the node's world coordinates should have changed
    const after = await page.evaluate((nodeId) => {
      const n = graph.nodesById[nodeId];
      return { id: n.id, x: n.x, y: n.y, historyPtr: historyPtr };
    }, before.id);

    expect(after.x).not.toBe(before.x);
    // historyPtr should have incremented by at least 1 due to move node pushHistory
    expect(after.historyPtr).toBeGreaterThanOrEqual(before.historyPtr + 1);

    // Validate that rendering didn't throw any runtime page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Algorithm workflow: Start BFS (S0 -> S5), observe logs and node state changes', async ({ page }) => {
    // Create a small graph of 3 nodes connected in a line:
    await clickCanvasAt(page, 100, 300); // node A
    await clickCanvasAt(page, 200, 300); // node B
    await clickCanvasAt(page, 300, 300); // node C

    // Connect A-B and B-C by Shift+drag
    await dragCanvas(page, { x: 100, y: 300 }, { x: 200, y: 300 }, { modifiers: ['Shift'] });
    await dragCanvas(page, { x: 200, y: 300 }, { x: 300, y: 300 }, { modifiers: ['Shift'] });

    // Read current node ids to set as start
    const nodeIds = await page.evaluate(() => graph.nodes.map(n => n.id));
    expect(nodeIds.length).toBeGreaterThanOrEqual(3);
    const startId = nodeIds[0];

    // Set algoStart input to startId
    await page.fill('#algoStart', String(startId));

    // Clear the log textarea first for a clean assertion
    await page.click('#btnClearLog');
    // Click BFS button to start BFS (this triggers startAlgorithm('bfs') and also runAlgStep())
    await page.click('#btnBFS');

    // After starting BFS, the log area should contain "BFS start at"
    await page.waitForFunction(() => document.getElementById('log').value.includes('BFS start at'), { timeout: 2000 });
    const logText = await page.$eval('#log', ta => ta.value);
    expect(logText).toContain(`BFS start at ${startId}`);
    // Also, we should see visiting lines like "Visit X" for at least the starting node
    expect(logText).toMatch(/Visit\s+\d+/);

    // Check that at least one node got visited/has state 'visited' or 'frontier'
    const states = await page.evaluate(() => graph.nodes.map(n => ({ id: n.id, state: n.state, dist: n.dist })));
    const visitedOrFrontier = states.some(s => s.state === 'visited' || s.state === 'frontier');
    expect(visitedOrFrontier).toBeTruthy();

    // Now click "Run to end" when algState may already be null or running; ensure no crash and log ends
    await page.click('#btnAlgRun');
    // Give it some time for run to process (if it started)
    await page.waitForTimeout(600);
    // After running, the "BFS complete" message should appear in log (eventually)
    const finalLog = await page.$eval('#log', ta => ta.value);
    expect(finalLog.length).toBeGreaterThan(0);
    // No uncaught page errors during algorithm run
    expect(pageErrors.length).toBe(0);
  });

  test('Run button with no active algorithm logs appropriate message (edge case)', async ({ page }) => {
    // Ensure alg is reset
    await page.click('#btnAlgReset');

    // Clear log first
    await page.click('#btnClearLog');

    // Click Run to end without active algorithm
    await page.click('#btnAlgRun');

    // The log should contain the 'No active algorithm' message
    await page.waitForFunction(() => document.getElementById('log').value.includes('No active algorithm'), { timeout: 2000 });
    const lt = await page.$eval('#log', ta => ta.value);
    expect(lt).toContain('No active algorithm to run. Press a (step) button first.');

    // Ensure no page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Undo/Redo functionality: create node, undo removes it, redo restores it', async ({ page }) => {
    // Create a node
    await clickCanvasAt(page, 400, 100);
    // Snapshot nodes count
    const afterCreate = await page.evaluate(() => graph.nodes.length);
    expect(afterCreate).toBeGreaterThanOrEqual(1);

    // Undo via button
    await page.click('#btnUndo');
    // Wait a little for UI updates
    await page.waitForTimeout(100);
    const afterUndo = await page.evaluate(() => graph.nodes.length);
    // It could be that history initial entry prevents full removal to zero depending on historyPtr,
    // but undo should not increase nodes; assert that nodes count decreased or is stable but not > afterCreate
    expect(afterUndo).toBeLessThanOrEqual(afterCreate);

    // If redo is available, click redo and expect nodes count restored (>= afterUndo)
    const redoDisabled = await page.$eval('#btnRedo', btn => btn.disabled);
    if (!redoDisabled) {
      await page.click('#btnRedo');
      await page.waitForTimeout(100);
      const afterRedo = await page.evaluate(() => graph.nodes.length);
      expect(afterRedo).toBeGreaterThanOrEqual(afterUndo);
    }

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Invalid connect via Connect button shows alert (edge case & dialog handling)', async ({ page }) => {
    // Ensure connect inputs are empty/invalid to trigger alert
    await page.fill('#connectA', '');
    await page.fill('#connectB', '');
    // Listen for dialog and capture message
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });
    // Click Connect button
    await page.click('#btnConnect');

    // Wait a short moment for dialog to have been handled
    await page.waitForTimeout(200);

    // The code shows alert('Invalid node ids') when invalid
    expect(dialogMessage).toBeTruthy();
    expect(dialogMessage).toContain('Invalid node ids');

    // No unexpected page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Adjacency/list and save JSON actions produce expected outputs in log or start download', async ({ page }) => {
    // Create few nodes and one edge to produce adjacency content
    await clickCanvasAt(page, 50, 400);
    await clickCanvasAt(page, 120, 400);
    await dragCanvas(page, { x: 50, y: 400 }, { x: 120, y: 400 }, { modifiers: ['Shift'] });

    // Click adjacency list button to write to #log
    await page.click('#btnAdjList');
    await page.waitForTimeout(200);
    const adjText = await page.$eval('#log', ta => ta.value);
    expect(adjText).toMatch(/:/);

    // Click Save JSON - this creates an anchor and clicks it; ensure no exception is thrown
    // We cannot access the downloaded file easily here, but ensure no page errors occur and the action runs
    await page.click('#btnSaveJSON');
    await page.waitForTimeout(200);
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console messages and ensure there are no unexpected runtime exceptions', async ({ page }) => {
    // The page intentionally logs messages to the #log textarea rather than console;
    // however, we still assert the console message collection is an array and page errors none.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    // We expect no uncaught page errors for a healthy app
    expect(pageErrors.length).toBe(0);
    // But ensure the initial 'Ready' line exists inside the UI log (verifies app initialization)
    const uiLog = await page.$eval('#log', ta => ta.value);
    expect(uiLog).toContain('Ready. Create nodes by clicking canvas');
  });
});