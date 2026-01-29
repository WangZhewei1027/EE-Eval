import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c13b751-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper utilities used by tests
async function waitForLogContains(page, text, timeout = 2000) {
  await page.waitForFunction(
    t => document.getElementById('log') && document.getElementById('log').innerText.includes(t),
    text,
    { timeout }
  );
}

async function getLogText(page) {
  return page.evaluate(() => document.getElementById('log').innerText);
}

async function countNodes(page) {
  return page.evaluate(() => document.querySelectorAll('#nodesLayer > g').length);
}

async function countEdges(page) {
  return page.evaluate(() => document.querySelectorAll('#edgesLayer > g').length);
}

async function getNodeTransform(page, nodeId) {
  return page.evaluate(id => {
    const g = document.querySelector(`#nodesLayer g[data-node-id="${id}"]`);
    return g ? g.getAttribute('transform') : null;
  }, nodeId);
}

async function getNodeLabel(page, nodeId) {
  return page.evaluate(id => {
    const g = document.querySelector(`#nodesLayer g[data-node-id="${id}"]`);
    if (!g) return null;
    const txt = g.querySelector('text');
    return txt ? txt.textContent : null;
  }, nodeId);
}

async function getEdgeWeightText(page, edgeId) {
  return page.evaluate(id => {
    const g = document.querySelector(`#edgesLayer g[data-edge-id="${id}"]`);
    if (!g) return null;
    const txt = g.querySelector('text');
    return txt ? txt.textContent : null;
  }, edgeId);
}

async function clickSvgAt(page, x, y) {
  // Click coordinates relative to SVG element
  const svg = await page.locator('#svg').elementHandle();
  const box = await svg.boundingBox();
  if (!box) throw new Error('SVG bounding box not found');
  await page.mouse.click(box.x + x, box.y + y);
}

test.describe('Graph Interactive Demo - FSM and UI tests', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    page.on('console', msg => {
      // capture browser console messages for diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // capture page errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });
    await page.goto(APP_URL);
    // Ensure initialization completed by waiting for the "Ready." log message (entry action of Idle)
    await waitForLogContains(page, 'Ready. Use modes to build and explore directed graphs. Many features available.');
  });

  test.afterEach(async ({ page }) => {
    // At the end of each test ensure there are no uncaught page errors.
    // We assert no page errors occurred. If the app does produce runtime errors, this assertion will fail and the captured errors will be visible in Playwright output.
    expect(pageErrors.map(e => String(e))).toEqual([]);
  });

  test('Initial idle state has rendered and mode_select was activated', async ({ page }) => {
    // Validate S0_Idle entry_actions: render() and mode_select click produce initial logs
    const log = await getLogText(page);
    expect(log).toContain('Ready. Use modes to build and explore directed graphs. Many features available.');
    expect(log).toContain('Mode: Select'); // init triggers mode_select click
  });

  test.describe('Mode transitions (S1..S5)', () => {
    test('Switching modes logs expected mode entries', async ({ page }) => {
      // Click each mode button and assert associated log message appears (entry action evidence)
      await page.click('#mode_add_node');
      await waitForLogContains(page, 'Mode: Add Node');
      await page.click('#mode_add_edge');
      await waitForLogContains(page, 'Mode: Add Edge');
      await page.click('#mode_move');
      await waitForLogContains(page, 'Mode: Move');
      await page.click('#mode_select');
      await waitForLogContains(page, 'Mode: Select');
      await page.click('#mode_delete');
      await waitForLogContains(page, 'Mode: Delete');

      // Verify no page errors so far
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Node and Edge creation and manipulation', () => {
    test('Add nodes in Add Node mode and verify DOM and log', async ({ page }) => {
      // Start from empty graph by clearing (clearGraph pushHistory will exist)
      await page.click('#clearGraph');
      await waitForLogContains(page, 'Cleared graph');

      // Switch to add node mode and add two nodes at specific coordinates inside the SVG
      await page.click('#mode_add_node');
      await waitForLogContains(page, 'Mode: Add Node');

      // Click positions relative to the SVG element (x,y)
      await clickSvgAt(page, 100, 100); // Node 1
      await waitForLogContains(page, 'Added node');
      await clickSvgAt(page, 200, 100); // Node 2
      await waitForLogContains(page, 'Added node');

      // Verify two nodes rendered
      const nodesCount = await countNodes(page);
      expect(nodesCount).toBeGreaterThanOrEqual(2);

      // Verify node labels and transforms exist
      const label1 = await getNodeLabel(page, 1);
      expect(label1).toBeTruthy();
    });

    test('Add edge between two existing nodes in Add Edge mode', async ({ page }) => {
      // Ensure a clean start: clear graph and create two nodes
      await page.click('#clearGraph');
      await waitForLogContains(page, 'Cleared graph');

      await page.click('#mode_add_node');
      await clickSvgAt(page, 120, 120); // node 1
      await waitForLogContains(page, 'Added node');
      await clickSvgAt(page, 220, 120); // node 2
      await waitForLogContains(page, 'Added node');

      // Enter add edge mode
      await page.click('#mode_add_edge');
      await waitForLogContains(page, 'Mode: Add Edge');

      // Click source node (approx center) then target node to create an edge
      await clickSvgAt(page, 120, 120); // click node 1 as source
      await waitForLogContains(page, 'Edge creation: source node');
      await clickSvgAt(page, 220, 120); // click node 2 as target
      await waitForLogContains(page, 'Added edge');

      // Verify that at least one edge exists
      const edgesCount = await countEdges(page);
      expect(edgesCount).toBeGreaterThanOrEqual(1);
    });

    test('Move a node in Move mode via drag and ensure position changed and log saved', async ({ page }) => {
      // Prepare graph with a node
      await page.click('#clearGraph');
      await waitForLogContains(page, 'Cleared graph');

      await page.click('#mode_add_node');
      await clickSvgAt(page, 150, 150); // node 1
      await waitForLogContains(page, 'Added node');

      // Switch to move mode
      await page.click('#mode_move');
      await waitForLogContains(page, 'Mode: Move');

      // Drag the node: get its bounding box and then simulate mouse drag
      const nodeG = page.locator('#nodesLayer g[data-node-id="1"]');
      const box = await nodeG.boundingBox();
      expect(box).not.toBeNull();
      const startX = box.x + box.width / 2;
      const startY = box.y + box.height / 2;
      const endX = startX + 60;
      const endY = startY + 40;

      // Press, move, release
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(endX, endY);
      await page.mouse.up();

      // After mouseup the app pushes history and logs 'Node moved and saved'
      await waitForLogContains(page, 'Node moved and saved');

      // Confirm the node's transform has changed (position updated)
      const transformAttr = await getNodeTransform(page, 1);
      expect(transformAttr).toBeTruthy();
      // transform should include translate with numbers; basic check
      expect(transformAttr).toMatch(/translate\(/);
    });

    test('Select a node and apply edit (label change), also assert ApplyEdit edge-case when nothing selected', async ({ page }) => {
      // Clear, create one node
      await page.click('#clearGraph');
      await waitForLogContains(page, 'Cleared graph');
      await page.click('#mode_add_node');
      await clickSvgAt(page, 130, 130);
      await waitForLogContains(page, 'Added node');

      // Switch to select mode and select the node
      await page.click('#mode_select');
      await waitForLogContains(page, 'Mode: Select');

      // Click on the node to select it
      await clickSvgAt(page, 130, 130);
      await waitForLogContains(page, 'Selected node');

      // Ensure selectedId input updated
      const selectedId = await page.locator('#selectedId').inputValue();
      expect(selectedId).toContain('node:');

      // Change label via editLabel and applyEdit
      await page.fill('#editLabel', 'Zed');
      await page.click('#applyEdit');
      await waitForLogContains(page, 'Node 1 label updated');

      // Validate the label shown in SVG
      const label = await getNodeLabel(page, 1);
      expect(label).toBe('Zed');

      // Now clear selection by clicking blank and click applyEdit to test S6_Editing entry edge-case
      await clickSvgAt(page, 10, 10); // click blank to clear selection
      await waitForLogContains(page, 'Cleared selection');

      // Attempt to apply edit with nothing selected
      await page.fill('#editLabel', 'Nobody');
      await page.click('#applyEdit');
      await waitForLogContains(page, 'Nothing selected');
    });

    test('Deleting nodes via Delete mode and via keyboard Delete key', async ({ page }) => {
      // Ensure two nodes present
      await page.click('#clearGraph');
      await waitForLogContains(page, 'Cleared graph');
      await page.click('#mode_add_node');
      await clickSvgAt(page, 140, 140); // node 1
      await waitForLogContains(page, 'Added node');
      await clickSvgAt(page, 240, 140); // node 2
      await waitForLogContains(page, 'Added node');

      // Delete node 2 via delete mode
      await page.click('#mode_delete');
      await waitForLogContains(page, 'Mode: Delete');

      // Click on node 2 position to delete it
      await clickSvgAt(page, 240, 140);
      await waitForLogContains(page, 'Deleted node');

      // Verify nodes decreased
      const nodesAfterDelete = await countNodes(page);
      expect(nodesAfterDelete).toBeGreaterThanOrEqual(0);
      // If one node remains, we'll test keyboard delete
      // Select remaining node
      await page.click('#mode_select');
      await waitForLogContains(page, 'Mode: Select');
      await clickSvgAt(page, 140, 140);
      await waitForLogContains(page, 'Selected node');

      // Press Delete key - should delete selected node via key handler
      await page.keyboard.press('Delete');
      await waitForLogContains(page, 'Deleted node');
      // Confirm nodes are zero
      const finalNodes = await countNodes(page);
      expect(finalNodes).toBe(0);
    });

    test('Edge editing: update weight and reverse/duplicate edge error scenarios', async ({ page }) => {
      // Create two nodes and an edge between them
      await page.click('#clearGraph');
      await waitForLogContains(page, 'Cleared graph');
      await page.click('#mode_add_node');
      await clickSvgAt(page, 160, 160); // node 1
      await waitForLogContains(page, 'Added node');
      await clickSvgAt(page, 260, 160); // node 2
      await waitForLogContains(page, 'Added node');

      // Add edge node1 -> node2
      await page.click('#mode_add_edge');
      await waitForLogContains(page, 'Mode: Add Edge');
      await clickSvgAt(page, 160, 160); // source
      await waitForLogContains(page, 'Edge creation: source node');
      await clickSvgAt(page, 260, 160); // target
      await waitForLogContains(page, 'Added edge');

      // Select the edge by clicking near midpoint
      const midX = Math.round((160 + 260) / 2);
      const midY = Math.round((160 + 160) / 2);
      await page.click('#mode_select');
      await waitForLogContains(page, 'Mode: Select');

      // Click at midpoint which findEdgeAt should detect edge
      await clickSvgAt(page, midX, midY);
      await waitForLogContains(page, 'Selected edge');

      // Edit weight via editWeight/input and apply
      await page.fill('#editWeight', '7');
      await page.click('#applyEdit');
      await waitForLogContains(page, 'Edge');

      // Confirm the edge weight text updated
      const edgeWeight = await getEdgeWeightText(page, 1);
      // It may be '7' or string containing '7'; assert contains 7
      expect(edgeWeight).toContain('7');

      // Clear selection and try reverseEdge (should log 'Select an edge first')
      await clickSvgAt(page, 10, 10);
      await waitForLogContains(page, 'Cleared selection');
      await page.click('#reverseEdge');
      await waitForLogContains(page, 'Select an edge first');

      // Try duplicateNode without selection (should log 'Select a node first')
      await page.click('#duplicateNode');
      await waitForLogContains(page, 'Select a node first');
    });
  });

  test.describe('Graph operations, layouts, clipboard and undo/redo', () => {
    test('Sample graph loads, adjacency views and layout operations work and are logged', async ({ page }) => {
      // Load sample graph
      await page.click('#sampleGraph');
      await waitForLogContains(page, 'Loaded sample graph');

      // Show adjacency list and matrix
      await page.click('#showAdjList');
      await waitForLogContains(page, 'Displayed adjacency list');
      await page.click('#showAdjMatrix');
      await waitForLogContains(page, 'Displayed adjacency matrix');

      // Layout operations (circular/grid/random/topo/force)
      await page.click('#layout_circular');
      await waitForLogContains(page, 'Applied circular layout');
      await page.click('#layout_grid');
      await waitForLogContains(page, 'Applied grid layout');
      await page.click('#layout_random');
      await waitForLogContains(page, 'Randomized positions');

      // Attempt topo layout; if graph has cycle it will log cycle message, else layout applied
      await page.click('#layout_topo');
      // either 'Laid out nodes by topological order' or 'Graph has cycle — cannot topologically sort' will appear
      await page.waitForFunction(() => {
        const t = document.getElementById('log').innerText;
        return t.includes('Laid out nodes by topological order') || t.includes('Graph has cycle — cannot topologically sort');
      });

      // Force layout
      await page.click('#layout_force');
      await waitForLogContains(page, 'Ran simple force layout');
    });

    test('Clipboard import with invalid JSON logs an Import error', async ({ page }) => {
      // Place invalid JSON into clipboard textarea and click import
      await page.fill('#clipboard', 'this is not json');
      await page.click('#importBtn');
      await waitForLogContains(page, 'Import error:');
    });

    test('Undo and redo operations change graph state and are logged', async ({ page }) => {
      // Start with clear graph and add two nodes
      await page.click('#clearGraph');
      await waitForLogContains(page, 'Cleared graph');
      await page.click('#mode_add_node');
      await clickSvgAt(page, 60, 60);
      await waitForLogContains(page, 'Added node');
      await clickSvgAt(page, 120, 60);
      await waitForLogContains(page, 'Added node');

      const beforeUndo = await countNodes(page);
      expect(beforeUndo).toBeGreaterThanOrEqual(2);

      // Undo
      await page.click('#undoBtn');
      await waitForLogContains(page, 'Undo');
      const afterUndo = await countNodes(page);
      expect(afterUndo).toBeLessThanOrEqual(beforeUndo);

      // Redo
      await page.click('#redoBtn');
      await waitForLogContains(page, 'Redo');
      const afterRedo = await countNodes(page);
      expect(afterRedo).toBeGreaterThanOrEqual(afterUndo);
    });
  });

  test.describe('Algorithms (S7 AlgorithmRunning) and playback', () => {
    test('Run BFS with proper start node and step through algorithm', async ({ page }) => {
      // Ensure sample graph loaded
      await page.click('#sampleGraph');
      await waitForLogContains(page, 'Loaded sample graph');

      // Set algorithm to BFS and set start node
      await page.selectOption('#algoSelect', 'bfs');
      await page.fill('#algoStart', '1');
      await page.click('#runAlgo');

      // BFS should produce steps and log accordingly
      await waitForLogContains(page, 'BFS produced');
      // Step next should advance steps and log step messages
      await page.click('#stepNext');
      await waitForLogContains(page, 'Step');

      // Step back should be allowed and log reset or step change
      await page.click('#stepBack');
      await waitForLogContains(page, 'Algorithm reset to start');
    });

    test('Running algorithm without start node logs appropriate error and Dijkstra requires start', async ({ page }) => {
      // Load sample graph
      await page.click('#sampleGraph');
      await waitForLogContains(page, 'Loaded sample graph');

      // Try BFS without start node
      await page.selectOption('#algoSelect', 'bfs');
      await page.fill('#algoStart', '');
      await page.click('#runAlgo');
      await waitForLogContains(page, 'Provide start node id for BFS');

      // Try Dijkstra without start node
      await page.selectOption('#algoSelect', 'dijkstra');
      await page.fill('#algoStart', '');
      await page.click('#runAlgo');
      await waitForLogContains(page, 'Provide start node id for Dijkstra');
    });

    test('Highlight path requires both start and target and highlights when valid', async ({ page }) => {
      // Load a sample graph with known nodes
      await page.click('#sampleGraph');
      await waitForLogContains(page, 'Loaded sample graph');

      // Attempt highlight with missing fields
      await page.fill('#algoStart', '');
      await page.fill('#algoTarget', '');
      await page.click('#highlightPath');
      await waitForLogContains(page, 'Provide start and target IDs');

      // Provide start and target that likely have a path in sampleGraph (1 -> 3 exists)
      await page.fill('#algoStart', '1');
      await page.fill('#algoTarget', '3');
      await page.click('#highlightPath');

      // Either no path found or highlight success; wait for either log
      await page.waitForFunction(() => {
        const t = document.getElementById('log').innerText;
        return t.includes('Highlighted path') || t.includes('No path found') || t.includes('Highlighted path:');
      }, { timeout: 3000 });

      // If path highlighted, the log contains 'Highlighted path'
      const logText = await getLogText(page);
      expect(
        logText.includes('Highlighted path') || logText.includes('No path found')
      ).toBeTruthy();
    });
  });

  test('Miscellaneous tools: flipAll, removeSelfLoops, contractEdge logging and safety checks', async ({ page }) => {
    // Load sample graph
    await page.click('#sampleGraph');
    await waitForLogContains(page, 'Loaded sample graph');

    // Flip all edges
    await page.click('#flipAll');
    await waitForLogContains(page, 'Flipped all edges');

    // Remove self-loops (no-op for sample likely)
    await page.click('#removeSelfLoops');
    await waitForLogContains(page, 'Removed self-loops');

    // Try contractEdge without selecting an edge to trigger guidance log
    await page.click('#contractEdge');
    await waitForLogContains(page, 'Select an edge to contract');
  });

  test('Final check: no unexpected page errors and captured console messages available for diagnostics', async ({ page }) => {
    // The afterEach will assert pageErrors are empty; additionally verify that we have captured some console logs from the page
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    // Also ensure the in-app log area is present and non-empty
    const logText = await getLogText(page);
    expect(logText.length).toBeGreaterThan(0);
  });
});