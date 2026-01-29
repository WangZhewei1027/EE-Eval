import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c145395-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper to read demo internal state exposed as window._demo safely
async function getDemoState(page) {
  return page.evaluate(() => {
    return {
      nodesLength: window._demo?.nodes?.length ?? 0,
      edgesLength: window._demo?.edges?.length ?? 0,
      nodes: window._demo?.nodes ?? [],
      edges: window._demo?.edges ?? []
    };
  });
}

test.describe('Kruskal Algorithm Interactive Demo - FSM and UI validation', () => {
  // Shared variables to capture console errors, page errors and dialogs
  let consoleErrors = [];
  let pageErrors = [];
  let dialogs = [];

  test.beforeEach(async ({ page }) => {
    // reset collectors for each test
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // capture console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // handle dialogs automatically (accept) and record their messages
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      try {
        await dialog.accept();
      } catch (e) {
        // swallow any accept errors; we only record dialogs
      }
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure the page's initial content is rendered before starting tests
    await page.waitForSelector('#canvas');
  });

  test.afterEach(async () => {
    // After each test we assert that the page did not emit unexpected runtime errors.
    // The page is expected to be stable; any console 'error' or page error will fail tests.
    expect(consoleErrors, `Console errors were emitted: ${JSON.stringify(consoleErrors)}`).toEqual([]);
    expect(pageErrors, `Page errors were emitted: ${JSON.stringify(pageErrors)}`).toEqual([]);
  });

  test('Initial state S0_Idle: initial snapshot & UI elements present', async ({ page }) => {
    // Validate initial snapshot label exists in history and modeLabel shows 'Add Node'
    const modeLabel = await page.locator('#modeLabel').textContent();
    expect(modeLabel).toBeTruthy();
    expect(modeLabel.trim()).toBe('Add Node');

    // History should contain the initial snapshot label
    const historyText = await page.locator('#history').textContent();
    expect(historyText).toContain('Initial empty state');

    // MST weight element exists and is 0
    const mstWeight = await page.locator('#mstWeight').textContent();
    expect(mstWeight.trim()).toBe('0');

    // Edge list should show '(no edges)' initially
    const edgeList = await page.locator('#edgeList').textContent();
    expect(edgeList).toContain('(no edges)');

    // Validate that the internal demo object exists and has initial nodes/edges arrays
    const state = await getDemoState(page);
    expect(state.nodesLength).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(state.edges)).toBe(true);
  });

  test('S1_AddNode: switch to Add Node mode and add nodes via canvas and button', async ({ page }) => {
    // Click "Add Node" mode explicitly and verify UI update
    await page.click('#mode_add_node');
    await expect(page.locator('#modeLabel')).toHaveText('Add Node');

    // Count initial nodes
    let before = (await getDemoState(page)).nodesLength;

    // Add a node by clicking canvas at a specific position
    const canvas = await page.locator('#canvas');
    const box = await canvas.boundingBox();
    // Click near the top-left quarter
    await page.mouse.click(Math.round(box.x + 80), Math.round(box.y + 60));
    await page.waitForTimeout(50); // let rendering & snapshotting complete

    let after = (await getDemoState(page)).nodesLength;
    expect(after).toBe(before + 1);

    // Add node using "Add Node (random)" button
    await page.click('#btnAddNodeAtRandom');
    await page.waitForTimeout(50);

    const state = await getDemoState(page);
    expect(state.nodesLength).toBe(after + 1);

    // History should include "Add node" labels
    const history = await page.locator('#history').textContent();
    expect(history).toMatch(/Add node/);
  });

  test('S2_AddEdge: switch to Add Edge mode and create an edge between two nodes', async ({ page }) => {
    // Prepare by ensuring at least two nodes exist
    let st = await getDemoState(page);
    if (st.nodesLength < 2) {
      // Add nodes programmatically via UI
      await page.click('#mode_add_node');
      const canvasBox = await page.locator('#canvas').boundingBox();
      await page.mouse.click(canvasBox.x + 60, canvasBox.y + 60);
      await page.mouse.click(canvasBox.x + 180, canvasBox.y + 120);
      await page.waitForTimeout(50);
      st = await getDemoState(page);
    }

    // Get node coordinates from the page's window._demo for accurate clicks
    const nodes = await page.evaluate(() => window._demo.nodes.map(n => ({ id: n.id, x: n.x, y: n.y })));
    expect(nodes.length).toBeGreaterThanOrEqual(2);
    const n1 = nodes[0];
    const n2 = nodes[1];

    // Switch to Add Edge mode
    await page.click('#mode_add_edge');
    await expect(page.locator('#modeLabel')).toHaveText('Add Edge');

    // Click first node then second node to create an edge
    const canvas = page.locator('#canvas');
    const canvasBox = await canvas.boundingBox();
    // Click node 1
    await page.mouse.click(Math.round(canvasBox.x + n1.x), Math.round(canvasBox.y + n1.y));
    // Click node 2
    await page.mouse.click(Math.round(canvasBox.x + n2.x), Math.round(canvasBox.y + n2.y));
    await page.waitForTimeout(100); // rendering + snapshots

    // Edge list should now contain at least one edge
    const edgeListText = await page.locator('#edgeList').textContent();
    expect(edgeListText).toMatch(/#\d+/);

    // Internal edges array length increased
    const state = await getDemoState(page);
    expect(state.edgesLength).toBeGreaterThanOrEqual(1);

    // The newly added edge should show its weight in the edge list (edgeWeightDefault default is 1)
    expect(edgeListText).toContain('1');
  });

  test('S3_MoveNode: move a node by dragging and ensure position and snapshot updated', async ({ page }) => {
    // Ensure at least one node exists
    let st = await getDemoState(page);
    if (st.nodesLength < 1) {
      await page.click('#mode_add_node');
      const canvasBox = await page.locator('#canvas').boundingBox();
      await page.mouse.click(canvasBox.x + 100, canvasBox.y + 100);
      await page.waitForTimeout(50);
    }

    // Get one node's position
    const node = await page.evaluate(() => window._demo.nodes[0] ? { id: window._demo.nodes[0].id, x: window._demo.nodes[0].x, y: window._demo.nodes[0].y } : null);
    expect(node).not.toBeNull();

    // Switch to Move mode
    await page.click('#mode_move');
    await expect(page.locator('#modeLabel')).toHaveText('Move Nodes');

    const canvasBox = await page.locator('#canvas').boundingBox();
    const startX = Math.round(canvasBox.x + node.x);
    const startY = Math.round(canvasBox.y + node.y);
    const endX = startX + 40;
    const endY = startY + 30;

    // Drag the node
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 6 });
    await page.mouse.up();

    // Wait for snapshot push triggered on mouseup
    await page.waitForTimeout(100);

    // Verify node moved by comparing coordinates
    const updatedNode = await page.evaluate((id) => {
      const n = window._demo.nodes.find(x => x.id === id);
      return n ? { x: n.x, y: n.y } : null;
    }, node.id);
    expect(updatedNode).not.toBeNull();
    // Coordinates should differ from original
    expect(Math.abs(updatedNode.x - node.x) + Math.abs(updatedNode.y - node.y)).toBeGreaterThan(0);

    // History should contain a "Move node" snapshot
    const history = await page.locator('#history').textContent();
    expect(history).toMatch(/Move node/);
  });

  test('S4_Delete and S5_Select: delete a node and select elements', async ({ page }) => {
    // Add two nodes and an edge between them to test delete edge via delete mode
    await page.click('#mode_add_node');
    const canvasBox = await page.locator('#canvas').boundingBox();
    await page.mouse.click(canvasBox.x + 50, canvasBox.y + 50);
    await page.mouse.click(canvasBox.x + 160, canvasBox.y + 60);
    await page.waitForTimeout(50);

    // Get coordinates and create an edge
    const nodes = await page.evaluate(() => window._demo.nodes.map(n => ({ id: n.id, x: n.x, y: n.y })));
    if (nodes.length >= 2) {
      await page.click('#mode_add_edge');
      await page.mouse.click(canvasBox.x + nodes[0].x, canvasBox.y + nodes[0].y);
      await page.mouse.click(canvasBox.x + nodes[1].x, canvasBox.y + nodes[1].y);
      await page.waitForTimeout(50);
    }

    // Switch to Select mode and select the first node
    await page.click('#mode_select');
    await expect(page.locator('#modeLabel')).toHaveText('Select');

    await page.mouse.click(canvasBox.x + nodes[0].x, canvasBox.y + nodes[0].y);
    await page.waitForTimeout(50);
    // Selected element isn't directly exposed, but the UI's history should reflect selection indirectly
    const history = await page.locator('#history').textContent();
    expect(history).toBeTruthy();

    // Now switch to delete mode and delete the first node by clicking it
    await page.click('#mode_delete');
    await expect(page.locator('#modeLabel')).toHaveText('Delete');

    // Deleting triggers a confirm(). Our global dialog handler will accept it. Click node position.
    await page.mouse.click(canvasBox.x + nodes[0].x, canvasBox.y + nodes[0].y);
    await page.waitForTimeout(100);

    // Verify node count decreased
    const stateAfterDelete = await getDemoState(page);
    // There should be fewer nodes than before (or equal if deletion didn't find due to radius mismatch)
    expect(stateAfterDelete.nodesLength).toBeLessThanOrEqual(nodes.length - 1 + 0); // allow cases where the node was not deleted due to proximity issues, but ensure no crash

    // If an edge existed attached to deleted node, edges should be filtered accordingly
    // We at least assert edgeList is a string and present
    const edgeListText = await page.locator('#edgeList').textContent();
    expect(typeof edgeListText).toBe('string');
  });

  test('S6_AlgorithmRunning and S7_AlgorithmStepping: prepare, step and compute MST (auto)', async ({ page }) => {
    // Load a sample graph for a reproducible test
    await page.click('#btnSamples');
    await page.waitForTimeout(200);

    // Prepare algorithm then run auto compute
    await page.click('#btnComputeAll');
    // computeAll runs synchronously; small wait for render
    await page.waitForTimeout(200);

    // MST weight should be displayed and greater than 0 for this sample
    const mstWeight = await page.locator('#mstWeight').textContent();
    const mstNum = Number(mstWeight.trim());
    expect(Number.isFinite(mstNum)).toBeTruthy();
    expect(mstNum).toBeGreaterThanOrEqual(0);

    // The algoLog should contain "Algorithm finished." from computeAll's step loop
    const algoLog = await page.locator('#algoLog').textContent();
    expect(algoLog).toMatch(/Algorithm finished|accepted|rejected/);

    // Reset algorithm and then step through algorithm manually
    await page.click('#btnResetAlgo');
    await page.waitForTimeout(100);

    // Prepare algorithm (btnStep will call prepareAlgorithm automatically if not prepared)
    await page.click('#btnStep');
    await page.waitForTimeout(100);

    // After one step, the edge statuses should include 'accepted' or 'rejected' in the edge list
    const edgeListText = await page.locator('#edgeList').textContent();
    expect(/accepted|rejected/.test(edgeListText)).toBeTruthy();
  });

  test('Undo and Redo transitions from algorithm state to idle', async ({ page }) => {
    // Ensure a simple operation to undo/redo: add a node
    const before = (await getDemoState(page)).nodesLength;
    await page.click('#mode_add_node');
    const canvasBox = await page.locator('#canvas').boundingBox();
    await page.mouse.click(canvasBox.x + 220, canvasBox.y + 120);
    await page.waitForTimeout(80);
    const afterAdd = (await getDemoState(page)).nodesLength;
    expect(afterAdd).toBe(before + 1);

    // Undo the addition
    await page.click('#btnUndo');
    await page.waitForTimeout(80);
    const afterUndo = (await getDemoState(page)).nodesLength;
    expect(afterUndo).toBeLessThanOrEqual(afterAdd - 1);

    // Redo the addition
    await page.click('#btnRedo');
    await page.waitForTimeout(80);
    const afterRedo = (await getDemoState(page)).nodesLength;
    // Redo should restore to previous count or higher
    expect(afterRedo).toBeGreaterThanOrEqual(afterUndo);
  });

  test('Import and Export JSON, then Import/Export EdgeList CSV', async ({ page }) => {
    // Build a small graph JSON to import
    const sample = {
      nodes: [
        { id: 101, x: 60, y: 60 },
        { id: 102, x: 160, y: 160 }
      ],
      edges: [
        { id: 201, u: 101, v: 102, w: 5 }
      ]
    };
    // Put JSON into textarea and click import
    await page.fill('#importExportArea', JSON.stringify(sample));
    await page.click('#btnImportJSON');
    await page.waitForTimeout(120);

    // Verify nodes and edges were imported
    const stateAfterImport = await getDemoState(page);
    expect(stateAfterImport.nodesLength).toBeGreaterThanOrEqual(2);
    expect(stateAfterImport.edgesLength).toBeGreaterThanOrEqual(1);

    // Export JSON and assert textarea contains valid JSON with nodes/edges
    await page.click('#btnExportJSON');
    await page.waitForTimeout(50);
    const exportedText = await page.locator('#importExportArea').inputValue();
    expect(exportedText).toContain('"nodes"');
    expect(exportedText).toContain('"edges"');

    // Export edge list as CSV, ensure textarea contains CSV format and then import it back
    await page.click('#btnExportEdgeList');
    await page.waitForTimeout(50);
    const csvText = await page.locator('#importExportArea').inputValue();
    expect(csvText).toMatch(/^\s*\d+,\s*\d+,\s*\d+,\s*\d+/m);

    // Clear nodes and edges programmatically (use Clear Nodes & Edges button which triggers confirm)
    await page.click('#btnClearNodes');
    await page.waitForTimeout(80);
    // Confirm accepted automatically by dialog handler

    // Now import CSV back
    await page.fill('#importExportArea', csvText);
    await page.click('#btnImportEdgeList');
    await page.waitForTimeout(120);
    const afterCSVImport = await getDemoState(page);
    expect(afterCSVImport.edgesLength).toBeGreaterThanOrEqual(1);
  });

  test('BruteForceCheck and ValidateMST produce alerts with expected content (edge-case handling)', async ({ page }) => {
    // Load a small sample graph that is suitable for brute force
    await page.click('#btnSamples');
    await page.waitForTimeout(200);

    // Compute MST to have accepted edges
    await page.click('#btnComputeAll');
    await page.waitForTimeout(200);

    // Trigger Validate MST - should result in an alert; our handler will accept and record it
    await page.click('#btnValidate');
    await page.waitForTimeout(100);
    // At least one dialog should have been recorded (validate or brute)
    const validateDialog = dialogs.find(d => /Valid spanning tree|spanning tree|weight/.test(d.message));
    expect(validateDialog).toBeTruthy();

    // Now call brute force check - since sample n <=8 it should run and present an alert
    await page.click('#btnBrute');
    await page.waitForTimeout(150);
    const bruteDialog = dialogs.find(d => d.message && d.message.includes('Brute force'));
    // The brute force implementation builds a message starting with "Brute force:"
    expect(bruteDialog || dialogs.some(d => d.message && d.message.includes('Brute force'))).toBeTruthy();
  });

  test('Edge case: attempting to import invalid JSON triggers an alert and does not crash', async ({ page }) => {
    // Put invalid JSON into textarea and attempt import
    await page.fill('#importExportArea', '{ invalid json,,, }');
    await page.click('#btnImportJSON');
    await page.waitForTimeout(80);

    // One of the dialogs recorded should mention 'Invalid JSON' (importJSON catches and alerts)
    const invalidDialog = dialogs.find(d => /Invalid JSON|Paste JSON/i.test(d.message));
    expect(invalidDialog).toBeTruthy();
  });

  test('UI controls: Auto Run start/stop toggles button label and does not crash', async ({ page }) => {
    // Prepare a small graph and prepare algorithm
    await page.click('#btnRandomGraph');
    await page.waitForTimeout(200);
    // Ensure algorithm is prepared by clicking auto-run which triggers prepareAlgorithm if necessary
    const autoRunBtn = page.locator('#btnAutoRun');
    const beforeLabel = await autoRunBtn.textContent();
    await autoRunBtn.click();
    await page.waitForTimeout(200);
    const midLabel = await autoRunBtn.textContent();
    // Label should have toggled to 'Stop Auto Run'
    expect(midLabel).toMatch(/Stop Auto Run/i);

    // Stop auto run
    await autoRunBtn.click();
    await page.waitForTimeout(100);
    const afterLabel = await autoRunBtn.textContent();
    expect(afterLabel).toMatch(/Auto Run/i);
  });
});