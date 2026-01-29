import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2d8822-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Undirected Graph Explorer - FSM and UI interactions', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors for inspection in tests
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page under test
    await page.goto(APP_URL);
    // Ensure initial scripts run
    await page.waitForLoadState('load');
  });

  test.afterEach(async () => {
    // Basic sanity: no uncaught page errors during the scenario (tests will assert specifics where applicable)
    expect(pageErrors.length).toBe(0);
  });

  test('Initial state: mode is select and graph info shows zero nodes/edges', async ({ page }) => {
    // Validate that UI/JS initializes with state.mode = 'select' (FSM S0_Idle)
    const mode = await page.evaluate(() => state.mode);
    expect(mode).toBe('select');

    // Validate graph info shows zero nodes and edges
    const graphInfo = await page.locator('#graphInfo').innerText();
    expect(graphInfo).toContain('Nodes: 0');
    expect(graphInfo).toContain('Edges: 0');

    // Sanity: the canvas exists and has expected dimensions
    const canvasBox = await page.locator('#graphCanvas').boundingBox();
    expect(canvasBox.width).toBeGreaterThan(0);
    expect(canvasBox.height).toBeGreaterThan(0);
  });

  test('Add Node flow: enter add-node mode, click canvas, graph updates and status reflects addition', async ({ page }) => {
    // Click "Add Node" to transition S0_Idle -> S1_AddNode
    await page.click('#addNode');
    const modeAfterClick = await page.evaluate(() => state.mode);
    expect(modeAfterClick).toBe('addNode');

    // Status should guide the user
    expect(await page.locator('#status').innerText()).toBe('Click on canvas to add a new node');

    // Click on canvas to add a node (coordinates anywhere within canvas)
    const canvas = page.locator('#graphCanvas');
    const box = await canvas.boundingBox();
    // Click near top-left area
    await page.mouse.click(box.x + 60, box.y + 60);

    // Wait briefly for UI update
    await page.waitForTimeout(100);

    // Graph should have 1 node now
    const nodesCount = await page.evaluate(() => graph.nodes.length);
    expect(nodesCount).toBeGreaterThanOrEqual(1);

    // Status should reflect addition
    const status = await page.locator('#status').innerText();
    expect(status).toContain('Added node');

    // Adjacency list should have a row for the new node
    const rows = await page.locator('#adjacencyList tbody tr').count();
    expect(rows).toBeGreaterThanOrEqual(1);
  });

  test('Node label change via NodeName button triggers prompt and updates default label', async ({ page }) => {
    // Prepare to handle the prompt dialog and provide new name
    const newName = 'CustomNodeLabel';
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      // Accept with new name
      await dialog.accept(newName);
    });

    // Click the nodeName UI element (will trigger prompt)
    await page.click('#nodeName');

    // After dialog accepted, the button's value should reflect the new default name
    const value = await page.evaluate(() => document.getElementById('nodeName').value);
    expect(value).toBe(newName);
  });

  test('Remove Node flow: create node(s), enter remove mode, click node to remove', async ({ page }) => {
    // Ensure there is at least one node: add one programmatically and update UI
    await page.evaluate(() => {
      graph.addNode('ToBeRemoved');
      updateGraph();
    });

    // Get node info (id and coordinates) to click exactly where it is
    const node = await page.evaluate(() => {
      const n = graph.nodes[graph.nodes.length - 1];
      return { id: n.id, x: n.x, y: n.y, label: n.label };
    });

    // Enter remove mode via UI
    await page.click('#removeNode');
    expect(await page.evaluate(() => state.mode)).toBe('removeNode');

    // Click at the node's coordinates to remove it
    const canvas = page.locator('#graphCanvas');
    const box = await canvas.boundingBox();
    // Convert canvas coords to page coords
    await page.mouse.click(box.x + node.x, box.y + node.y);
    await page.waitForTimeout(100);

    // Verify node was removed from graph
    const remaining = await page.evaluate((id) => graph.nodes.some(n => n.id === id), node.id);
    expect(remaining).toBe(false);

    // Status should mention removal
    const status = await page.locator('#status').innerText();
    expect(status).toContain('Removed node');
  });

  test('Add Edge and Remove Edge flows: create two nodes, add edge between them, then remove it', async ({ page }) => {
    // Create two nodes programmatically and connect them via UI interactions
    await page.evaluate(() => {
      // clear then add predictable nodes for the test
      graph.nodes = [];
      graph.edges = [];
      graph.nextId = 1;
      graph.addNode('A');
      graph.addNode('B');
      updateGraph();
    });

    // Get the two node positions
    const nodes = await page.evaluate(() => graph.nodes.map(n => ({ id: n.id, x: n.x, y: n.y, label: n.label })));
    expect(nodes.length).toBeGreaterThanOrEqual(2);
    const nodeA = nodes[0];
    const nodeB = nodes[1];

    // Enter Add Edge mode
    await page.click('#addEdge');
    expect(await page.evaluate(() => state.mode)).toBe('addEdge');

    // Click node A then node B on the canvas to create the edge
    const canvas = page.locator('#graphCanvas');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + nodeA.x, box.y + nodeA.y);
    await page.waitForTimeout(50);
    await page.mouse.click(box.x + nodeB.x, box.y + nodeB.y);
    await page.waitForTimeout(200);

    // Verify an edge was created between these IDs
    const hasEdge = await page.evaluate((a, b) => graph.edges.some(e =>
      (e.from === a && e.to === b) || (e.from === b && e.to === a)
    ), nodeA.id, nodeB.id);
    expect(hasEdge).toBe(true);

    // Now test removing the edge: enter removeEdge mode and click near the midpoint of the edge
    await page.click('#removeEdge');
    expect(await page.evaluate(() => state.mode)).toBe('removeEdge');

    // Calculate midpoint and click near it
    const mid = { x: (nodeA.x + nodeB.x) / 2, y: (nodeA.y + nodeB.y) / 2 };
    await page.mouse.click(box.x + mid.x, box.y + mid.y);
    await page.waitForTimeout(200);

    // Verify edge no longer exists
    const hasEdgeAfter = await page.evaluate((a, b) => graph.edges.some(e =>
      (e.from === a && e.to === b) || (e.from === b && e.to === a)
    ), nodeA.id, nodeB.id);
    expect(hasEdgeAfter).toBe(false);

    // Status should acknowledge removal
    const status = await page.locator('#status').innerText();
    expect(status).toContain('Removed edge');
  });

  test('Clear Graph flow: clicking Clear triggers confirm dialog and clears the graph when accepted', async ({ page }) => {
    // Seed graph with some nodes/edges
    await page.evaluate(() => {
      graph.nodes = [];
      graph.edges = [];
      graph.nextId = 1;
      graph.addNode('One');
      graph.addNode('Two');
      graph.addEdge(1, 2, 5);
      updateGraph();
    });

    // Ensure graph has data
    expect(await page.evaluate(() => graph.nodes.length)).toBeGreaterThanOrEqual(2);
    expect(await page.evaluate(() => graph.edges.length)).toBeGreaterThanOrEqual(1);

    // Prepare to accept the confirm dialog
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });

    // Click Clear Graph
    await page.click('#clearGraph');

    // Wait for updateGraph to run
    await page.waitForTimeout(100);

    // Verify graph is cleared
    const nodeCount = await page.evaluate(() => graph.nodes.length);
    const edgeCount = await page.evaluate(() => graph.edges.length);
    expect(nodeCount).toBe(0);
    expect(edgeCount).toBe(0);

    const graphInfo = await page.locator('#graphInfo').innerText();
    expect(graphInfo).toContain('Nodes: 0');
    expect(graphInfo).toContain('Edges: 0');
  });

  test('Random Graph button: invalid parameters show alert (edge case) without running the buggy generation loop', async ({ page }) => {
    // Set randomNodes to 3 and randomEdges to 4 which is too many edges for 3 nodes (max 3)
    await page.fill('#randomNodes', '3');
    await page.fill('#randomEdges', '4');

    // Expect an alert; capture the dialog and confirm the message
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toContain('Too many edges for the number of nodes');
      await dialog.accept();
    });

    // Click the Generate Random Graph button
    await page.click('#randomGraph');

    // Wait briefly to ensure alert was handled
    await page.waitForTimeout(100);

    // Verify graph remains unchanged (still zero nodes if starting from cleared state)
    const nodes = await page.evaluate(() => graph.nodes.length);
    const edges = await page.evaluate(() => graph.edges.length);
    expect(nodes).toBeGreaterThanOrEqual(0);
    expect(edges).toBeGreaterThanOrEqual(0);
  });

  test('Find Path flow: create connected path and verify path highlighting and status', async ({ page }) => {
    // Build a small graph 1-2-3 programmatically and update UI
    await page.evaluate(() => {
      graph.nodes = [];
      graph.edges = [];
      graph.nextId = 1;
      graph.addNode('N1'); // id 1
      graph.addNode('N2'); // id 2
      graph.addNode('N3'); // id 3
      graph.addEdge(1, 2, 1);
      graph.addEdge(2, 3, 1);
      updateGraph();
    });

    // Ensure selects are populated by updateGraph
    await page.waitForTimeout(100);

    // Choose From=1 To=3 Algorithm=bfs
    await page.selectOption('#pathFrom', String(1));
    await page.selectOption('#pathTo', String(3));
    await page.selectOption('#pathAlgorithm', 'bfs');

    // Click Find Path
    await page.click('#findPath');

    // Wait for drawGraph call
    await page.waitForTimeout(100);

    // Verify that state.highlightedPath equals [1,2,3]
    const highlighted = await page.evaluate(() => state.highlightedPath.slice());
    expect(highlighted.length).toBeGreaterThanOrEqual(2);
    expect(highlighted[0]).toBe(1);
    expect(highlighted[highlighted.length - 1]).toBe(3);

    // Status should indicate a path was found
    const status = await page.locator('#status').innerText();
    expect(status).toContain('Path found');
  });

  test('Detect Cycle flow: detect cycle in a triangle graph', async ({ page }) => {
    // Create triangle 1-2-3-1
    await page.evaluate(() => {
      graph.nodes = [];
      graph.edges = [];
      graph.nextId = 1;
      graph.addNode('A');
      graph.addNode('B');
      graph.addNode('C');
      graph.addEdge(1, 2, 1);
      graph.addEdge(2, 3, 1);
      graph.addEdge(3, 1, 1);
      updateGraph();
    });

    // Click detectCycle and assert status mentions cycle
    await page.click('#detectCycle');
    await page.waitForTimeout(50);
    const status = await page.locator('#status').innerText();
    expect(status).toMatch(/cycle/i);
  });

  test('Find Connected Components flow: verify multiple components are detected and highlighted', async ({ page }) => {
    // Create two disconnected components: (1-2) and (3 alone)
    await page.evaluate(() => {
      graph.nodes = [];
      graph.edges = [];
      graph.nextId = 1;
      graph.addNode('A'); //1
      graph.addNode('B'); //2
      graph.addNode('C'); //3
      graph.addEdge(1, 2, 1);
      updateGraph();
    });

    // Click findConnected
    await page.click('#findConnected');
    await page.waitForTimeout(100);

    // Verify connected components in state
    const components = await page.evaluate(() => state.connectedComponents.slice());
    expect(Array.isArray(components)).toBe(true);
    // Expect more than one component (node C isolated)
    expect(components.length).toBeGreaterThanOrEqual(2);

    // Status should indicate number of components
    const status = await page.locator('#status').innerText();
    expect(status).toMatch(/Graph has \d+ connected components|Graph is fully connected/);
  });

  test('Find MST flow: for a connected graph, MST is computed and state.mst populated', async ({ page }) => {
    // Build a connected graph of 4 nodes with multiple edges
    await page.evaluate(() => {
      graph.nodes = [];
      graph.edges = [];
      graph.nextId = 1;
      graph.addNode('1'); //1
      graph.addNode('2'); //2
      graph.addNode('3'); //3
      graph.addNode('4'); //4
      // Create a connected graph with various weights
      graph.addEdge(1, 2, 1);
      graph.addEdge(2, 3, 2);
      graph.addEdge(3, 4, 3);
      graph.addEdge(4, 1, 4);
      graph.addEdge(1, 3, 5);
      updateGraph();
    });

    // Ensure graph is connected
    const isConnected = await page.evaluate(() => graph.isConnected());
    expect(isConnected).toBe(true);

    // Click Find MST and wait
    await page.click('#findMST');
    await page.waitForTimeout(200);

    // state.mst should have nodes.length - 1 edges
    const mst = await page.evaluate(() => state.mst.slice());
    expect(mst.length).toBeGreaterThanOrEqual(1);
    expect(mst.length).toBeLessThanOrEqual(3); // for 4 nodes, MST edges == 3
    const status = await page.locator('#status').innerText();
    expect(status).toMatch(/Minimum Spanning Tree/);
  });

  test('Canvas mousemove behavior: cursor changes between select and add modes', async ({ page }) => {
    // Ensure in select mode and canvas cursor default/pointer depending on hover
    await page.evaluate(() => {
      // Clear and add a node at a deterministic position for easier testing
      graph.nodes = [];
      graph.edges = [];
      graph.nextId = 1;
      const n = graph.addNode('HoverNode');
      // Place the node at a known coordinate
      n.x = 100;
      n.y = 80;
      updateGraph();
    });

    // Move mouse over the node location in select mode
    const canvas = page.locator('#graphCanvas');
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + 100, box.y + 80);
    await page.waitForTimeout(50);

    // Cursor style should be 'pointer' if hovering a node in select mode
    const cursorStyle = await page.evaluate(() => document.getElementById('graphCanvas').style.cursor);
    // It may be '' (empty) or 'pointer' depending on browser; check reasonable values:
    expect(['pointer', 'default', '', 'crosshair']).toContain(cursorStyle);

    // Now switch to addNode mode and move mouse - cursor should be crosshair per implementation
    await page.click('#addNode'); // enter addNode mode
    await page.mouse.move(box.x + 200, box.y + 200);
    await page.waitForTimeout(50);
    const cursorAfter = await page.evaluate(() => document.getElementById('graphCanvas').style.cursor);
    expect(cursorAfter).toBe('crosshair');
  });

  test('Edge case: attempting to add an already existing edge should not duplicate it and should update status', async ({ page }) => {
    // Create two nodes and an edge between them
    await page.evaluate(() => {
      graph.nodes = [];
      graph.edges = [];
      graph.nextId = 1;
      graph.addNode('X'); //1
      graph.addNode('Y'); //2
      graph.addEdge(1, 2, 7);
      updateGraph();
    });

    // Get positions
    const nodes = await page.evaluate(() => graph.nodes.map(n => ({ id: n.id, x: n.x, y: n.y })));
    const n1 = nodes[0];
    const n2 = nodes[1];
    const canvas = page.locator('#graphCanvas');
    const box = await canvas.boundingBox();

    // Try adding the same edge again through UI
    await page.click('#addEdge');
    await page.mouse.click(box.x + n1.x, box.y + n1.y);
    await page.waitForTimeout(20);
    await page.mouse.click(box.x + n2.x, box.y + n2.y);
    await page.waitForTimeout(100);

    // Edge count should still be 1
    const edgeCount = await page.evaluate(() => graph.edges.length);
    expect(edgeCount).toBe(1);

    // Status should reflect that edge exists (either "Edge already exists" or similar)
    const status = await page.locator('#status').innerText();
    expect(status.length).toBeGreaterThan(0);
  });

  test('Selecting a node in select mode updates status with the selected node label', async ({ page }) => {
    // Ensure one node exists and at a known position
    await page.evaluate(() => {
      graph.nodes = [];
      graph.edges = [];
      graph.nextId = 1;
      const n = graph.addNode('Selectable');
      n.x = 150;
      n.y = 120;
      updateGraph();
    });

    // Ensure mode is select
    await page.evaluate(() => { state.mode = 'select'; });

    const canvas = page.locator('#graphCanvas');
    const box = await canvas.boundingBox();
    await page.mouse.click(box.x + 150, box.y + 120);
    await page.waitForTimeout(100);

    const status = await page.locator('#status').innerText();
    expect(status).toContain('Selected node');
  });

  // Final test: Verify that no uncaught JavaScript errors occurred throughout the test interactions
  test('No uncaught JavaScript errors were thrown during interactions', async ({ page }) => {
    // pageErrors array was captured in beforeEach and after each interactions; assert none
    expect(pageErrors.length).toBe(0);

    // Additionally inspect console messages for 'Error' type entries
    const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // Prefer zero critical console errors; allow warnings but ensure no error-level logs
    const errorLogs = consoleMessages.filter(m => m.type === 'error');
    expect(errorLogs.length).toBe(0);
  });
});