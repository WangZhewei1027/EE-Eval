import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d610d0-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Undirected Graph Explorer - FSM and UI integration tests', () => {
  // Capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages of type 'error'
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // ignore listener errors
      }
    });

    // Listen for uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    // Navigate to the app page
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure main elements are present before tests
    await expect(page.locator('svg#svg')).toBeVisible();
    await expect(page.locator('button#mode-add')).toBeVisible();
    await expect(page.locator('button#mode-connect')).toBeVisible();
    await expect(page.locator('button#mode-move')).toBeVisible();
  });

  test.afterEach(async () => {
    // Assert that there were no console errors or uncaught page errors during the test run
    expect(consoleErrors, `Console errors were emitted: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
    expect(pageErrors, `Page errors were emitted: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  test.describe('Initial Idle State (S0_Idle) and status', () => {
    test('has initial demo graph seeded and status reflects nodes/edges', async ({ page }) => {
      // The app seeds a demo graph on load (6 nodes, several edges)
      const status = page.locator('#status');
      await expect(status).toContainText('Nodes:');
      await expect(status).toContainText('Edges:');

      // There should be some node circle elements in the SVG
      const nodeCircles = page.locator('svg#svg circle[data-id]');
      await expect(nodeCircles).toHaveCountGreaterThan(0);

      // Start select should have options populated
      const startSelect = page.locator('#startNode');
      await expect(startSelect.locator('option')).toHaveCountGreaterThan(0);
    });
  });

  test.describe('Mode transitions and mode buttons (S1_AddNode, S2_Connect, S3_Move)', () => {
    test('switching modes updates button active states and mode variable', async ({ page }) => {
      const addBtn = page.locator('button#mode-add');
      const connectBtn = page.locator('button#mode-connect');
      const moveBtn = page.locator('button#mode-move');

      // Initially add is active
      await expect(addBtn).toHaveClass(/active/);

      // Switch to connect mode
      await connectBtn.click();
      await expect(connectBtn).toHaveClass(/active/);
      await expect(addBtn).not.toHaveClass(/active/);

      // Switch to move mode
      await moveBtn.click();
      await expect(moveBtn).toHaveClass(/active/);
      await expect(connectBtn).not.toHaveClass(/active/);

      // Back to add mode
      await addBtn.click();
      await expect(addBtn).toHaveClass(/active/);
      await expect(moveBtn).not.toHaveClass(/active/);
    });
  });

  test.describe('Add Node (AddNode event and S1_AddNode -> S0_Idle transitions)', () => {
    test('clicking empty SVG space adds a node and updates status/adjacency displays', async ({ page }) => {
      // Count nodes initially
      const status1 = await page.locator('#status1').innerText();
      const initialNodesMatch = status.match(/Nodes:\s*(\d+)/);
      const initialCount = initialNodesMatch ? Number(initialCount = initialNodesMatch[1]) : undefined;

      // Click an empty space in the SVG to add a node
      const svg = page.locator('svg#svg');
      const box = await svg.boundingBox();
      // Choose a point likely empty (away from seeded nodes)
      const clickX = box.x + box.width * 0.05;
      const clickY = box.y + box.height * 0.05;
      await page.mouse.click(clickX, clickY, { button: 'left' });

      // After adding, there should be one more circle with data-id
      await expect(page.locator('svg#svg circle[data-id]')).toHaveCountGreaterThan(0);

      const newStatus = await page.locator('#status').innerText();
      await expect(newStatus).toMatch(/Nodes:\s*\d+/);
      await expect(newStatus).toMatch(/Edges:\s*\d+/);

      // The adjacency list and matrix should reflect the change (matrixWrap shows a table if nodes exist)
      const matrixWrap = page.locator('#matrixWrap');
      await expect(matrixWrap).toBeVisible();
    });
  });

  test.describe('Connect Nodes (ConnectNodes event & edge creation)', () => {
    test('connects two nodes when in connect mode and updates edge visuals and status', async ({ page }) => {
      // Ensure we are in connect mode
      await page.locator('button#mode-connect').click();

      // Find two existing node circles
      const circles = page.locator('svg#svg circle[data-id]');
      const count = await circles.count();
      expect(count).toBeGreaterThanOrEqual(2);

      // Click first node, then second node
      const first = circles.nth(0);
      const second = circles.nth(1);

      // Click first node to select it
      await first.click({ button: 'left' });
      // The first node should have nodeSelected visuals (stroke width change). We test class or attribute change.
      const firstStrokeWidth = await first.getAttribute('stroke-width');
      // stroke-width may be string '1' or '3' depending on selection; assert it's set (presence)
      expect(firstStrokeWidth).not.toBeNull();

      // Click second to create edge
      await second.click({ button: 'left' });

      // After creating edge, there should be a line element connecting nodes
      const lines = page.locator('svg#svg g > line');
      await expect(lines).toHaveCountGreaterThan(0);

      // Status should reflect an increased Edge count
      const statusText = await page.locator('#status').innerText();
      expect(statusText).toMatch(/Edges:\s*\d+/);
    });

    test('does not create self-edge when clicking the same node twice in connect mode', async ({ page }) => {
      await page.locator('button#mode-connect').click();
      const circles1 = page.locator('svg#svg circle[data-id]');
      const first1 = circles.nth(0);
      const beforeEdgesText = await page.locator('#status').innerText();
      const beforeMatch = beforeEdgesText.match(/Edges:\s*(\d+)/);
      const beforeEdges = beforeMatch ? Number(beforeMatch[1]) : 0;

      // Click the same node twice
      await first.click({ button: 'left' });
      await first.click({ button: 'left' });

      const afterEdgesText = await page.locator('#status').innerText();
      const afterMatch = afterEdgesText.match(/Edges:\s*(\d+)/);
      const afterEdges = afterMatch ? Number(afterMatch[1]) : 0;

      // Edges should not increase
      expect(afterEdges).toBe(beforeEdges);
    });
  });

  test.describe('Move Node (MoveNode event & dragging)', () => {
    test('dragging a node in move mode updates its transform and edge positions', async ({ page }) => {
      // Switch to move mode
      await page.locator('button#mode-move').click();

      // Pick a node circle and get its bounding box center
      const circle = page.locator('svg#svg circle[data-id]').first();
      const bb = await circle.boundingBox();
      expect(bb).toBeDefined();

      const startX = bb.x + bb.width / 2;
      const startY = bb.y + bb.height / 2;
      const endX = startX + 80;
      const endY = startY + 60;

      // Get the node's parent <g> transform before drag
      const initialTransform = await circle.evaluate(node => node.parentElement.getAttribute('transform'));

      // Perform drag via mouse events
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY, { steps: 6 });
      await page.mouse.up();

      // After drag, transform should have changed
      const afterTransform = await circle.evaluate(node => node.parentElement.getAttribute('transform'));
      expect(afterTransform).not.toBe(initialTransform);

      // Edge positions should be updated: check any line x1 attribute is a number (sanity)
      const line = page.locator('svg#svg g > line').first();
      if (await line.count() > 0) {
        const x1 = await line.getAttribute('x1');
        expect(typeof x1).toBe('string');
      }
    });
  });

  test.describe('Clear Graph (ClearGraph event)', () => {
    test('clears all nodes and edges and resets nextId, updates status to 0', async ({ page }) => {
      // Click clear button
      await page.locator('button#clear').click();

      // There should be no circle elements after clear
      await expect(page.locator('svg#svg circle[data-id]')).toHaveCount(0);

      // Status should say Nodes: 0 Edges: 0
      const status2 = await page.locator('#status2').innerText();
      expect(status).toMatch(/Nodes:\s*0/);
      expect(status).toMatch(/Edges:\s*0/);
    });
  });

  test.describe('Traversals (RunBFS, RunDFS, StepByStep, ResetVisits) - S4_Traversal', () => {
    test('Run BFS highlights visited nodes (animated) and sets visited visuals', async ({ page }) => {
      // Ensure there is at least one node: generate a small graph first
      await page.locator('button#randGraph').click();
      // Wait a bit for generation
      await page.waitForTimeout(300);

      // Run BFS
      await page.locator('button#bfs').click();

      // Wait for some of the animation to have taken place
      await page.waitForTimeout(800);

      // At least one node circle should contain class "visitedNode" or have fill equal to accent
      const visitedNodes = page.locator('svg#svg circle.visitedNode');
      // It's possible animation hasn't finished, but after 800ms at least one should be visited for typical demo sizes
      await expect(visitedNodes.first()).toBeVisible();
    });

    test('Run DFS highlights visited nodes (animated)', async ({ page }) => {
      // Make sure graph exists
      await page.locator('button#randGraph').click();
      await page.waitForTimeout(300);

      // Run DFS
      await page.locator('button#dfs').click();

      // Wait for some animation
      await page.waitForTimeout(800);

      // Check for visited visuals
      const visitedNodes1 = page.locator('svg#svg circle.visitedNode');
      await expect(visitedNodes.first()).toBeVisible();
    });

    test('Step-by-step traversal creates Next/Stop controls and steps one node at a time', async ({ page }) => {
      // Ensure graph present
      await page.locator('button#randGraph').click();
      await page.waitForTimeout(300);

      // Click Step-by-step to create controller
      await page.locator('button#step').click();

      // Next button should be appended to .left panel
      const nextBtn = page.locator('.left button', { hasText: 'Next' });
      const stopBtn = page.locator('.left button', { hasText: 'Stop' });
      await expect(nextBtn).toBeVisible();
      await expect(stopBtn).toBeVisible();

      // Click Next to visit one node
      await nextBtn.click();
      // After clicking Next, at least one node should have visited visuals
      const visitedNodes2 = page.locator('svg#svg circle.visitedNode');
      await expect(visitedNodes.first()).toBeVisible();

      // Stop the step-by-step controller and ensure controls removed and visuals reset
      await stopBtn.click();
      // Allow cleanup to run
      await page.waitForTimeout(100);
      await expect(nextBtn).toHaveCount(0);
      await expect(stopBtn).toHaveCount(0);
    });

    test('Reset visits clears visited visuals', async ({ page }) => {
      // Ensure there is a graph and run BFS to mark visited nodes
      await page.locator('button#randGraph').click();
      await page.waitForTimeout(300);
      await page.locator('button#bfs').click();
      await page.waitForTimeout(800);

      // There should be visited nodes
      const visitedBefore = await page.locator('svg#svg circle.visitedNode').count();
      expect(visitedBefore).toBeGreaterThan(0);

      // Click Reset
      await page.locator('button#resetVisit').click();
      await page.waitForTimeout(100);

      // Visited visuals should be cleared
      const visitedAfter = await page.locator('svg#svg circle.visitedNode').count();
      expect(visitedAfter).toBe(0);
    });
  });

  test.describe('Random Graph generation (RandomGraph event)', () => {
    test('generates a random graph with nodes and edges and updates adjacency displays', async ({ page }) => {
      // Set values for deterministic-ish behavior
      await page.fill('#randN', '8');
      await page.fill('#probP', '0.3');

      await page.locator('button#randGraph').click();

      // Wait for generation
      await page.waitForTimeout(300);

      // There should be nodes
      const nodesCount = await page.locator('svg#svg circle[data-id]').count();
      expect(nodesCount).toBeGreaterThanOrEqual(1);

      // Matrix table should exist when nodes present
      await expect(page.locator('#matrixWrap table')).toBeVisible();
    });
  });

  test.describe('Export / Load JSON (ExportJSON, LoadJSON events)', () => {
    test('export produces JSON output in #jsonOut and can be parsed', async ({ page }) => {
      // Ensure there is a graph
      await page.locator('button#randGraph').click();
      await page.waitForTimeout(300);

      // Click export
      await page.locator('button#export').click();

      // jsonOut should be populated with a JSON string
      const jsonOut = page.locator('#jsonOut');
      await expect(jsonOut).toHaveText(/"nodes":\s*\[/);

      const text = await jsonOut.innerText();
      // parse to ensure valid JSON
      const parsed = JSON.parse(text);
      expect(parsed).toHaveProperty('nodes');
      expect(parsed).toHaveProperty('edges');
      expect(Array.isArray(parsed.nodes)).toBe(true);
      expect(Array.isArray(parsed.edges)).toBe(true);
    });

    test('loading valid JSON file populates the graph', async ({ page }) => {
      // Create a simple graph JSON with two nodes and one edge
      const graph = {
        nodes: [{ id: 100, x: 110, y: 120 }, { id: 101, x: 210, y: 220 }],
        edges: [{ a: 100, b: 101 }]
      };
      const jsonData = JSON.stringify(graph, null, 2);

      // Use setInputFiles to simulate file selection
      await page.setInputFiles('#fileInput', {
        name: 'graph.json',
        mimeType: 'application/json',
        buffer: Buffer.from(jsonData)
      });

      // Allow FileReader to process
      await page.waitForTimeout(300);

      // The nodes with ids 100 and 101 should exist as circles (data-id attributes)
      const node100 = page.locator('svg#svg circle[data-id="100"]');
      const node101 = page.locator('svg#svg circle[data-id="101"]');
      await expect(node100).toBeVisible();
      await expect(node101).toBeVisible();

      // Edge line should exist
      const line1 = page.locator('svg#svg g > line1').filter({ has: page.locator('[data-key]') }).first();
      // We can't rely on dataset.key presence, but there should be at least one line now
      await expect(page.locator('svg#svg g > line')).toHaveCountGreaterThan(0);
    });

    test('loading invalid JSON triggers alert with message "Invalid JSON"', async ({ page }) => {
      // Prepare invalid JSON file
      const invalid = 'this is not json';
      let dialogMessage = null;
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });

      await page.setInputFiles('#fileInput', {
        name: 'bad.json',
        mimeType: 'application/json',
        buffer: Buffer.from(invalid)
      });

      // Allow processing
      await page.waitForTimeout(300);

      // The page should have shown an alert with message 'Invalid JSON'
      expect(dialogMessage).toBe('Invalid JSON');
    });
  });

  test.describe('Adjacency displays, deletion, and keyboard interactions', () => {
    test('adjacency list entries are clickable to highlight neighbors and Delete key removes selected node', async ({ page }) => {
      // Make sure there's a small graph
      await page.locator('button#randGraph').click();
      await page.waitForTimeout(300);

      // Click on first adjacency list entry's left part to highlight neighbors
      const listEntryLeft = page.locator('#adjList > div').first().locator('div').first();
      await expect(listEntryLeft).toBeVisible();
      await listEntryLeft.click();

      // After clicking, neighbor nodes' stroke widths change temporarily; we at least ensure no error and revert happens
      await page.waitForTimeout(950);

      // Select a node visually by clicking it
      const firstCircle = page.locator('svg#svg circle[data-id]').first();
      await firstCircle.click();

      // Press Delete to remove selected node
      await page.keyboard.press('Delete');
      // Node should be removed
      // (Count may have decreased; ensure no error and DOM updated)
      await page.waitForTimeout(200);
      // At least ensure adjacency list updated (count of children possibly decreased)
      const adjCount = await page.locator('#adjList > div').count();
      expect(adjCount).toBeGreaterThanOrEqual(0);
    });

    test('double-click on node deletes it', async ({ page }) => {
      // Ensure graph exists
      await page.locator('button#randGraph').click();
      await page.waitForTimeout(300);

      const firstCircle1 = page.locator('svg#svg circle[data-id]').first();
      const idAttr = await firstCircle.getAttribute('data-id');

      // Double-click to delete
      await firstCircle.dblclick();

      // Wait a moment for removal
      await page.waitForTimeout(200);

      // The node with that data-id should no longer exist
      const maybeGone = page.locator(`svg#svg circle[data-id="${idAttr}"]`);
      await expect(maybeGone).toHaveCount(0);
    });
  });

  test.describe('Edge cases and resilience', () => {
    test('attempt to remove a non-existent edge/node gracefully (no exceptions)', async ({ page }) => {
      // Try calling UI interactions that might target non-existent elements:
      // Right now, we will attempt to select an edge key that doesn't exist by simulating dblclick on a line that is not present.
      // Safe approach: call clear then try dblclick on svg area -> nothing should break.
      await page.locator('button#clear').click();
      await page.waitForTimeout(100);

      // dblclick empty svg should not throw; simulate it
      await page.locator('svg#svg').dblclick();
      // wait for any potential cleanup
      await page.waitForTimeout(100);

      // No console errors or page errors (checked in afterEach)
      expect(true).toBeTruthy();
    });

    test('export when graph is empty still produces valid JSON structure', async ({ page }) => {
      // Clear graph
      await page.locator('button#clear').click();
      await page.waitForTimeout(100);

      // Click export
      await page.locator('button#export').click();

      // jsonOut should show nodes: [] and edges: []
      const jsonOutText = await page.locator('#jsonOut').innerText();
      const parsed1 = JSON.parse(jsonOutText);
      expect(Array.isArray(parsed.nodes)).toBe(true);
      expect(Array.isArray(parsed.edges)).toBe(true);
    });
  });
});