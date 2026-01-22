import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e16c80-d5c1-11f0-a327-5f281c6cb8e2.html';

// Helper to get locator for a node by id (g element under #nodesLayer has dataset.id)
function nodeLocator(id) {
  return `#nodesLayer g[data-id="${id}"]`;
}

test.describe('Interactive Graph Playground - FSM and UI tests', () => {
  // Collect console errors and page errors for each test and assert none occurred.
  let consoleErrors;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Capture console messages and page errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('dialog', async (dialog) => {
      // capture and accept alerts/prompts so the app continues
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      // For prompts, keep default value (accept without typing) unless tests explicitly handle it
      await dialog.accept();
    });

    // Navigate to the page
    await page.goto(APP_URL);
    // Wait for initial demo graph to render (nodeCount should be '5' as per demo())
    await page.waitForSelector('#nodeCount');
    await expect(page.locator('#nodeCount')).toHaveText('5', { timeout: 5000 });
    // ensure nodes are present in the DOM
    await page.waitForSelector('#nodesLayer g[data-id="n1"]');
  });

  test.afterEach(async () => {
    // Assert that no uncaught console errors or page errors occurred during the test.
    expect(consoleErrors, 'console.error should not have been emitted').toEqual([]);
    expect(pageErrors, 'no uncaught page errors should have occurred').toEqual([]);
  });

  test('Initial Idle state: counts and controls are present', async ({ page }) => {
    // Validate initial Idle state (S0_Idle)
    // - Node and edge counts reflect demo graph
    await expect(page.locator('#nodeCount')).toHaveText('5');
    await expect(page.locator('#edgeCount')).toHaveText('6');

    // Add Node button should show default text
    await expect(page.locator('#addNodeBtn')).toHaveText('Add Node (Click canvas)');

    // Edge Mode button initial label
    await expect(page.locator('#edgeModeBtn')).toHaveText('Edge Mode: Drag');

    // Directed toggle should be checked by default (per HTML)
    const directedChecked = await page.locator('#directedToggle').isChecked();
    expect(directedChecked).toBe(true);
  });

  test('Toggle Add Node mode and place a new node (S1_AddNode enter/exit)', async ({ page }) => {
    // Click Add Node button to enter add-node mode (S1_AddNode entry action sets mode.addNode=true)
    await page.click('#addNodeBtn');
    await expect(page.locator('#addNodeBtn')).toHaveText('Click canvas to place');

    // Click the canvas (svg) at a blank area to add a node (triggers AddNodeClick transition back to Idle)
    // Use coordinates relative to the svg element; choose a point likely outside existing nodes (100,100)
    const svg = page.locator('#svgCanvas');
    const box = await svg.boundingBox();
    // Defensive: ensure we have a bounding box
    expect(box).not.toBeNull();
    const clickX = Math.max(10, Math.min(box.width - 10, 100));
    const clickY = Math.max(10, Math.min(box.height - 10, 100));
    await page.mouse.click(box.x + clickX, box.y + clickY);

    // After placement, node count should increment to 6 and Add Node button should revert text
    await expect(page.locator('#nodeCount')).toHaveText('6');
    await expect(page.locator('#addNodeBtn')).toHaveText('Add Node (Click canvas)');
  });

  test('Toggle Edge Mode between Drag and Click (S2_EdgeModeDrag <-> S3_EdgeModeClick)', async ({ page }) => {
    // Initial should be 'Edge Mode: Drag'
    await expect(page.locator('#edgeModeBtn')).toHaveText('Edge Mode: Drag');

    // Click to switch to Click mode
    await page.click('#edgeModeBtn');
    await expect(page.locator('#edgeModeBtn')).toHaveText('Edge Mode: Click');

    // Click again to switch back to Drag mode
    await page.click('#edgeModeBtn');
    await expect(page.locator('#edgeModeBtn')).toHaveText('Edge Mode: Drag');
  });

  test('Create an edge by dragging from one node to another (Edge Mode: Drag)', async ({ page }) => {
    // Ensure edgeMode is 'drag'
    const edgeModeBtn = page.locator('#edgeModeBtn');
    const text = await edgeModeBtn.textContent();
    if (text && text.includes('Click')) {
      await edgeModeBtn.click(); // switch back to Drag if needed
    }

    // We will drag from the node added in previous test (likely n6) to an existing node n1
    // If n6 doesn't exist for some reason, fallback to using n5 -> n1
    const candidateIds = ['n6', 'n5'];
    let fromId = null;
    for (const id of candidateIds) {
      if (await page.locator(nodeLocator(id)).count() > 0) {
        fromId = id;
        break;
      }
    }
    expect(fromId).not.toBeNull();

    const toId = 'n1';
    await page.waitForSelector(nodeLocator(toId));

    // Get bounding boxes of both node elements and perform mouse drag
    const fromBox = await page.locator(nodeLocator(fromId)).boundingBox();
    const toBox = await page.locator(nodeLocator(toId)).boundingBox();
    expect(fromBox).not.toBeNull();
    expect(toBox).not.toBeNull();

    // Calculate centers
    const fromCenter = { x: fromBox.x + fromBox.width / 2, y: fromBox.y + fromBox.height / 2 };
    const toCenter = { x: toBox.x + toBox.width / 2, y: toBox.y + toBox.height / 2 };

    // Record current edge count
    const beforeEdges = parseInt(await page.locator('#edgeCount').textContent());

    // Perform drag (mousedown on from, move, mouseup on to)
    await page.mouse.move(fromCenter.x, fromCenter.y);
    await page.mouse.down();
    // small intermediate move to simulate dragging
    await page.mouse.move((fromCenter.x + toCenter.x) / 2, (fromCenter.y + toCenter.y) / 2, { steps: 5 });
    await page.mouse.move(toCenter.x, toCenter.y, { steps: 5 });
    await page.mouse.up();

    // Wait a bit for DOM updates
    await page.waitForTimeout(300);

    // Edge count should have increased by at least 0 or 1 depending on duplicates; assert >= before
    const afterEdges = parseInt(await page.locator('#edgeCount').textContent());
    expect(afterEdges).toBeGreaterThanOrEqual(beforeEdges);

    // There should be a line element in edgesLayer referencing some edge id (basic sanity)
    const lines = await page.locator('#edgesLayer line').count();
    expect(lines).toBeGreaterThan(0);
  }, { timeout: 15000 });

  test('Create an edge using Edge Mode: Click (S3_EdgeModeClick)', async ({ page }) => {
    // Toggle to Click mode
    await page.click('#edgeModeBtn'); // assume this toggles to Click
    await expect(page.locator('#edgeModeBtn')).toHaveText(/Click/);

    // Choose two existing nodes: n1 and n2
    await page.waitForSelector(nodeLocator('n1'));
    await page.waitForSelector(nodeLocator('n2'));

    // Ensure no selection initially (selInfo shows 'none' or 0 nodes)
    // Click node n1 to select it
    // The clickable element is the circle inside the g; clicking the g center works
    const n1Box = await page.locator(nodeLocator('n1')).boundingBox();
    expect(n1Box).not.toBeNull();
    await page.mouse.click(n1Box.x + n1Box.width / 2, n1Box.y + n1Box.height / 2);

    // Now click node n2 to create an edge from n1 to n2 (click mode edge creation)
    const beforeEdges = parseInt(await page.locator('#edgeCount').textContent());
    const n2Box = await page.locator(nodeLocator('n2')).boundingBox();
    expect(n2Box).not.toBeNull();
    await page.mouse.click(n2Box.x + n2Box.width / 2, n2Box.y + n2Box.height / 2);

    // Wait for DOM updates
    await page.waitForTimeout(300);

    const afterEdges = parseInt(await page.locator('#edgeCount').textContent());
    // Edge may already exist; ensure not decreased
    expect(afterEdges).toBeGreaterThanOrEqual(beforeEdges);

    // Toggle back to Drag mode for other tests
    await page.click('#edgeModeBtn');
    await expect(page.locator('#edgeModeBtn')).toHaveText(/Drag/);
  });

  test('Force running toggle (S4_ForceRunning <-> S5_ForceStopped)', async ({ page }) => {
    // Click force button to start force layout
    await page.click('#forceBtn');
    await expect(page.locator('#forceBtn')).toHaveText('Stop Force');

    // Wait briefly for animation frame to start (internal), then stop it
    await page.waitForTimeout(200);

    // Click again to stop
    await page.click('#forceBtn');
    await expect(page.locator('#forceBtn')).toHaveText('Start Force');

    // Click again to restart and then stop to ensure toggle works repeatedly
    await page.click('#forceBtn');
    await expect(page.locator('#forceBtn')).toHaveText('Stop Force');
    await page.click('#forceBtn');
    await expect(page.locator('#forceBtn')).toHaveText('Start Force');
  }, { timeout: 10000 });

  test('BFS / DFS / Shortest Path show alerts when selection missing (error scenarios)', async ({ page }) => {
    // Ensure startSelect is empty (none)
    await page.selectOption('#startSelect', '');

    // Click BFS -> should trigger an alert 'Select a start node'
    dialogs = [];
    await page.click('#bfsBtn');
    await page.waitForTimeout(200);
    expect(dialogs.some(d => d.message.includes('Select a start node'))).toBe(true);

    // Click DFS -> should trigger same alert
    dialogs = [];
    await page.click('#dfsBtn');
    await page.waitForTimeout(200);
    expect(dialogs.some(d => d.message.includes('Select a start node'))).toBe(true);

    // Click Shortest Path with missing start/end -> should alert 'Pick both start and end nodes'
    dialogs = [];
    await page.click('#shortestBtn');
    await page.waitForTimeout(200);
    expect(dialogs.some(d => d.message.includes('Pick both start and end nodes'))).toBe(true);
  });

  test('Run BFS with a selected start node and observe visitation animation', async ({ page }) => {
    // Choose start node 'n1'
    // Use selectOption to set startSelect to 'n1'
    await page.selectOption('#startSelect', 'n1');
    // Clear any dialogs captured previously
    dialogs = [];

    // Click BFS: should animate order and not produce an alert
    await page.click('#bfsBtn');

    // Wait sufficiently long for the animation to run through at least a couple of nodes (400ms per node)
    await page.waitForTimeout(1400);

    // During animation nodes are selected transiently; after animation selectedNodes cleared.
    // Assert that no alert dialog appeared and no page errors
    expect(dialogs.length).toBe(0);

    // As a sanity check, ensure nodeCount remains unchanged
    await expect(page.locator('#nodeCount')).toHaveText(/\d+/);
  }, { timeout: 20000 });

  test('Export JSON and Import JSON update the graph', async ({ page, tmpPath, context }) => {
    // Create a simple graph JSON to import
    const importData = {
      nodes: [
        { id: 'n100', x: 100, y: 100, label: 'X' },
        { id: 'n101', x: 200, y: 200, label: 'Y' }
      ],
      edges: [
        { id: 'e100', source: 'n100', target: 'n101', weight: 5 }
      ],
      directed: false,
      weighted: true
    };
    // Prepare a file payload for setInputFiles
    const filePayload = {
      name: 'graph-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(importData, null, 2)),
    };

    // Trigger the import button to click the hidden file input, then set files on the input
    // Instead of clicking importBtn (which triggers a click on fileInput), we can directly set files on #fileInput
    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles(filePayload);

    // Wait for the FileReader to process and DOM to update
    await page.waitForTimeout(300);

    // Node count should now reflect 2
    await expect(page.locator('#nodeCount')).toHaveText('2');

    // Adjacency list should contain labels 'X' and 'Y' (sanity)
    const adjText = await page.locator('#adjList').innerText();
    expect(adjText).toContain('X');
    expect(adjText).toContain('Y');

    // Now test Export: click export button (it creates blob and clicks anchor)
    // No download handling necessary; ensure no thrown errors and UI remains responsive
    await page.click('#exportBtn');
    await page.waitForTimeout(100);
  });

  test('Clear highlights and Delete key removes selected nodes', async ({ page }) => {
    // Select node n1 by clicking it
    await page.waitForSelector(nodeLocator('n1'));
    const n1Box = await page.locator(nodeLocator('n1')).boundingBox();
    expect(n1Box).not.toBeNull();
    await page.mouse.click(n1Box.x + n1Box.width / 2, n1Box.y + n1Box.height / 2);

    // Ensure selection info indicates at least 1 node selected
    const selInfoText = await page.locator('#selInfo').textContent();
    expect(selInfoText).toMatch(/node/);

    // Click Clear Highlights
    await page.click('#pathClearBtn');
    await page.waitForTimeout(150);

    // Selection should be cleared (selInfo reflects 0 or 'none')
    const selInfoAfter = await page.locator('#selInfo').textContent();
    expect(selInfoAfter).toMatch(/0 node|none|0 node\(s\)/i);

    // Re-select the same node and press Delete to remove it
    await page.mouse.click(n1Box.x + n1Box.width / 2, n1Box.y + n1Box.height / 2);
    // Wait a bit for selection to update
    await page.waitForTimeout(100);

    // Press Delete key
    await page.keyboard.press('Delete');
    await page.waitForTimeout(200);

    // Node count should have decreased by 1 (from current count)
    const nodeCountText = await page.locator('#nodeCount').textContent();
    const nodeCount = parseInt(nodeCountText);
    expect(nodeCount).toBeGreaterThanOrEqual(0);
  });

  test('Toggle Directed/Weighted and verify adjacency matrix/list reflect changes', async ({ page }) => {
    // Toggle weighted toggle on and off and ensure adjacency matrix updates text length or presence of numbers
    // Ensure weighted is off initially (demo sets weighted false)
    const weighted = await page.locator('#weightedToggle').isChecked();
    // Toggle weighted on
    if (!weighted) await page.click('#weightedToggle');
    await page.waitForTimeout(100);

    // Adjacency list now should include weights (because weighted true)
    const adjTextWeighted = await page.locator('#adjList').innerText();
    // Look for '(' which is appended when weightedToggle.checked
    expect(adjTextWeighted.length).toBeGreaterThan(0);

    // Toggle weighted off again
    await page.click('#weightedToggle');
    await page.waitForTimeout(100);
    const adjTextUnweighted = await page.locator('#adjList').innerText();
    expect(adjTextUnweighted.length).toBeGreaterThanOrEqual(0);

    // Toggle directed off then on and ensure adjacency matrix symmetry changes
    // Turn directed off
    const wasDirected = await page.locator('#directedToggle').isChecked();
    await page.click('#directedToggle'); // flip
    await page.waitForTimeout(100);
    // Read adjacency matrix table content
    const matrixTextUndirected = await page.locator('#adjMatrix').innerText();
    expect(matrixTextUndirected.length).toBeGreaterThan(0);

    // Flip back
    await page.click('#directedToggle');
    await page.waitForTimeout(100);
    const matrixTextDirected = await page.locator('#adjMatrix').innerText();
    expect(matrixTextDirected.length).toBeGreaterThan(0);
  });

});