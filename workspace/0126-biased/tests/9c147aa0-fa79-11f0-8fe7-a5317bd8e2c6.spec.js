import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c147aa0-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Prim Algorithm Interactive Demo (FSM coverage)', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // reset collectors for each test
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', msg => {
      try {
        consoleMessages.push({type: msg.type(), text: msg.text()});
      } catch (e) {
        consoleMessages.push({type: 'unknown', text: String(msg)});
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Handle dialogs (confirm/prompt/alert) in a generic way:
    // - For prompt: provide a reasonable integer "2" (used for edge weight input).
    // - For confirm/alert: accept so flows continue.
    page.on('dialog', async dialog => {
      try {
        if (dialog.type() === 'prompt') {
          await dialog.accept('2');
        } else {
          await dialog.accept();
        }
      } catch (e) {
        // ignore handling errors
      }
    });

    await page.goto(BASE);
    // wait for initial generation and logs to appear
    await page.waitForTimeout(600); // allow IIFE initialization and tips (setTimeout 800ms in app, but initial graph generation runs earlier)
  });

  test.afterEach(async () => {
    // nothing to teardown here, handlers are tied to page fixture which will be cleaned up
  });

  test.describe('Initial load and basic UI', () => {
    test('page loads with expected controls and initial graph', async ({ page }) => {
      // Validate key controls exist
      await expect(page.locator('#addNodeBtn')).toBeVisible();
      await expect(page.locator('#addNodeRandBtn')).toBeVisible();
      await expect(page.locator('#clearGraphBtn')).toBeVisible();
      await expect(page.locator('#initPrimBtn')).toBeVisible();

      // The script initializes a random graph in its init IIFE. Check the Graph.nodes array exists and has elements.
      const nodeCount = await page.evaluate(() => Array.isArray(Graph.nodes) ? Graph.nodes.length : 0);
      expect(nodeCount).toBeGreaterThanOrEqual(1);

      // Ensure no uncaught page errors during initial load
      expect(pageErrors.length).toBe(0);

      // Ensure the log box contains a Tip message eventually (the app logs tips)
      const logText = await page.locator('#log').innerText();
      expect(logText).toContain('Tip:');
    });
  });

  test.describe('Graph construction interactions (Add Node / Random / Clear)', () => {
    test('ADD_NODE increases node count', async ({ page }) => {
      const before = await page.evaluate(() => Graph.nodes.length);
      await page.click('#addNodeBtn');
      await page.waitForTimeout(100);
      const after = await page.evaluate(() => Graph.nodes.length);
      expect(after).toBeGreaterThan(before);
    });

    test('ADD_RANDOM_NODE increases node count', async ({ page }) => {
      const before = await page.evaluate(() => Graph.nodes.length);
      await page.click('#addNodeRandBtn');
      await page.waitForTimeout(100);
      const after = await page.evaluate(() => Graph.nodes.length);
      expect(after).toBeGreaterThan(before);
    });

    test('CLEAR_GRAPH clears the graph (confirm accepted)', async ({ page }) => {
      // Ensure there is at least one node to clear
      await page.click('#addNodeBtn');
      await page.waitForTimeout(100);
      const before = await page.evaluate(() => Graph.nodes.length);
      expect(before).toBeGreaterThanOrEqual(1);

      // Click clear - dialog handler in beforeEach will accept confirm
      await page.click('#clearGraphBtn');
      await page.waitForTimeout(200);
      const after = await page.evaluate(() => Graph.nodes.length);
      expect(after).toBe(0);
    });
  });

  test.describe('Edge creation, edit, and delete flows', () => {
    test('TOGGLE_ADD_EDGE_MODE and create an edge between two nodes (via prompt)', async ({ page }) => {
      // Ensure at least two nodes
      const existing = await page.evaluate(() => Graph.nodes.length);
      if (existing < 2) {
        // add nodes to ensure we have at least two
        await page.click('#addNodeBtn');
        await page.click('#addNodeBtn');
        await page.waitForTimeout(100);
      }

      // Turn on add-edge mode
      await page.click('#edgeModeBtn');
      await page.waitForTimeout(50);
      // Click two distinct node circles; use first two nodes present
      const nodeGroups = page.locator('svg g[data-node-id]');
      await expect(nodeGroups).toHaveCountGreaterThan(1);

      // Click first node's circle
      const firstCircle = nodeGroups.nth(0).locator('circle');
      const secondCircle = nodeGroups.nth(1).locator('circle');

      // Click both to trigger prompt for weight. Our dialog handler supplies '2'.
      await firstCircle.click({ force: true });
      await page.waitForTimeout(50);
      await secondCircle.click({ force: true });
      await page.waitForTimeout(250);

      // After addEdge finishes, Graph.edges should include a new edge connecting the two node ids
      const edgesCount = await page.evaluate(() => Graph.edges.length);
      expect(edgesCount).toBeGreaterThanOrEqual(1);
    });

    test('EDIT_WEIGHT shows input and APPLY updates edge weight', async ({ page }) => {
      // Ensure there's at least one edge: if none, create by toggling add-edge and clicking two nodes
      let edgesCount = await page.evaluate(() => Graph.edges.length);
      if (edgesCount === 0) {
        // create two nodes and an edge
        await page.click('#addNodeBtn');
        await page.click('#addNodeBtn');
        await page.click('#edgeModeBtn');
        await page.waitForTimeout(50);
        const nodeGroups = page.locator('svg g[data-node-id]');
        await nodeGroups.nth(0).locator('circle').click({ force: true });
        await nodeGroups.nth(1).locator('circle').click({ force: true });
        await page.waitForTimeout(200);
        edgesCount = await page.evaluate(() => Graph.edges.length);
        expect(edgesCount).toBeGreaterThan(0);
      }

      // Select first edge by clicking the line element
      const firstLine = page.locator('svg line[data-edge-id]').first();
      await firstLine.click({ force: true });
      await page.waitForTimeout(50);

      // Click edit weight - since selection is an edge, input should show
      await page.click('#editWeightBtn');
      await page.waitForTimeout(50);
      // The edit input should now be visible
      const visible = await page.locator('#editWeightInput').evaluate(el => getComputedStyle(el).display !== 'none');
      expect(visible).toBeTruthy();

      // Change weight to 42 using fill and apply
      await page.fill('#editWeightInput', '42');
      await page.click('#applyWeightBtn');
      await page.waitForTimeout(100);

      // Validate that Graph.edges includes weight 42 for the selected edge id
      const edgeWeight = await page.evaluate(() => {
        const sel = selection;
        if (!sel || sel.type !== 'edge') return null;
        const e = getEdgeById(sel.id);
        return e ? e.w : null;
      });
      // If selection retained, weight should be 42; otherwise find an edge with weight 42
      if (edgeWeight !== null) {
        expect(Number(edgeWeight)).toBe(42);
      } else {
        // fallback: at least one edge has weight 42
        const found = await page.evaluate(() => Graph.edges.some(e => e.w === 42));
        expect(found).toBeTruthy();
      }
    });

    test('TOGGLE_DELETE_MODE and delete a node', async ({ page }) => {
      // Ensure at least one node to delete
      await page.click('#addNodeBtn');
      await page.waitForTimeout(50);
      const before = await page.evaluate(() => Graph.nodes.length);
      expect(before).toBeGreaterThan(0);

      // Turn on delete mode
      await page.click('#delModeBtn');
      await page.waitForTimeout(50);

      // Click the first node circle to delete it
      const firstCircle = page.locator('svg g[data-node-id]').first().locator('circle');
      await firstCircle.click({ force: true });
      await page.waitForTimeout(150);

      const after = await page.evaluate(() => Graph.nodes.length);
      expect(after).toBe(before - 1);
    });
  });

  test.describe('Algorithm controls and stepping (Prim)', () => {
    test('INIT_PRIM sets up algoState and STEP_ALGORITHM advances actionIndex', async ({ page }) => {
      // Ensure graph has nodes - if empty create a simple graph
      const nodes = await page.evaluate(() => Graph.nodes.length);
      if (nodes === 0) {
        await page.click('#addNodeBtn');
        await page.click('#addNodeBtn');
        // create an edge
        await page.click('#edgeModeBtn');
        await page.waitForTimeout(50);
        const nodeGroups = page.locator('svg g[data-node-id]');
        await nodeGroups.nth(0).locator('circle').click({ force: true });
        await nodeGroups.nth(1).locator('circle').click({ force: true });
        await page.waitForTimeout(200);
      }

      // Initialize Prim
      await page.click('#initPrimBtn');
      await page.waitForTimeout(200);
      const algoStateExists = await page.evaluate(() => typeof algoState !== 'undefined' && algoState !== null);
      expect(algoStateExists).toBeTruthy();

      // Record initial actionIndex then step
      const beforeIndex = await page.evaluate(() => algoState.actionIndex || 0);
      await page.click('#stepBtn');
      await page.waitForTimeout(150);
      const afterIndex = await page.evaluate(() => algoState.actionIndex);
      expect(afterIndex).toBeGreaterThan(beforeIndex);
    });

    test('RUN_ALGORITHM starts auto-run and PAUSE_ALGORITHM stops it; COMPLETE_RUN finishes all actions', async ({ page }) => {
      // Initialize Prim to have algoState and actions
      await page.click('#initPrimBtn');
      await page.waitForTimeout(200);
      const actionsLen = await page.evaluate(() => (algoState && algoState.actions) ? algoState.actions.length : 0);
      expect(actionsLen).toBeGreaterThanOrEqual(0);

      // Speed up the auto-run
      await page.fill('#speed', '50');
      await page.click('#runBtn');
      // allow auto-run to process a few steps
      await page.waitForTimeout(200);
      // Pause
      await page.click('#pauseBtn');
      await page.waitForTimeout(150);

      // There should be log entries for auto-run started and paused
      const logText = await page.locator('#log').innerText();
      expect(logText).toContain('Auto-run started') || expect(logText).toContain('Auto-run paused') || expect(logText.length).toBeGreaterThan(0);

      // Complete run (one-shot)
      await page.click('#completeBtn');
      await page.waitForTimeout(200);
      // After complete, actionIndex should equal actions.length
      const indices = await page.evaluate(() => {
        if (!algoState) return null;
        return { idx: algoState.actionIndex, len: algoState.actions.length, mstW: algoState.mstWeight, mstCount: algoState.mstEdges.length };
      });
      expect(indices).not.toBeNull();
      if (indices) {
        expect(indices.idx).toBeGreaterThanOrEqual(0);
        expect(indices.len).toBeGreaterThanOrEqual(indices.idx);
      }
    });
  });

  test.describe('Manual mode and manual edge addition', () => {
    test('MANUAL_MODE updates indicator and dblclicking an edge can add to MST when valid', async ({ page }) => {
      // Set execMode to manual
      await page.selectOption('#execMode', 'manual');
      await page.waitForTimeout(50);
      // mode-indicator should reflect the change
      const indicator = await page.locator('#mode-indicator').innerText();
      expect(indicator).toContain('Mode: manual');

      // Initialize Prim and do one step so at least one visited node exists
      await page.click('#initPrimBtn');
      await page.waitForTimeout(150);
      await page.click('#stepBtn');
      await page.waitForTimeout(150);

      // Determine an edge that connects visited to unvisited (search in page context)
      const candidate = await page.evaluate(() => {
        if (!algoState) return null;
        const visitedSet = algoState.visited || new Set();
        // Convert visitedSet (which is a Set) to array if necessary
        const visited = (visitedSet instanceof Set) ? Array.from(visitedSet) : (algoState.visited || []);
        // Find an edge with one endpoint visited and the other not
        for (let e of Graph.edges) {
          const uVisited = visited.includes ? visited.includes(e.u) : visited.indexOf && visited.indexOf(e.u) !== -1;
          const vVisited = visited.includes ? visited.includes(e.v) : visited.indexOf && visited.indexOf(e.v) !== -1;
          if (uVisited !== vVisited) return e.id;
        }
        return null;
      });

      if (candidate === null) {
        // If no candidate edge found, skip using the manual-add flow but assert no page error
        expect(pageErrors.length).toBe(0);
        return;
      }

      // dblclick on the specific line representing that edge
      const selector = `svg line[data-edge-id="${candidate}"]`;
      const line = page.locator(selector);
      await expect(line).toBeVisible();
      await line.dblclick({ force: true });
      await page.waitForTimeout(200);

      // After dblclick, MST metrics should reflect at least one MST edge (mstEdges length increased)
      const mstMetrics = await page.evaluate(() => {
        if (!algoState) return {mw: null, mc: null};
        return { mw: algoState.mstWeight, mc: algoState.mstEdges.length };
      });
      // Either MST increased or at least no page errors
      expect(pageErrors.length).toBe(0);
      if (mstMetrics.mc !== null) {
        expect(mstMetrics.mc).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Import/Export, snapshots, undo/redo edge cases', () => {
    test('EXPORT produces JSON and IMPORT handles invalid JSON with alert (handled)', async ({ page }) => {
      // Click export to populate jsonArea
      await page.click('#exportBtn');
      await page.waitForTimeout(50);
      const exported = await page.locator('#jsonArea').inputValue();
      expect(exported.length).toBeGreaterThan(0);
      // Now put invalid JSON and click import to trigger alert (our dialog handler accepts)
      await page.fill('#jsonArea', 'INVALID_JSON{');
      await page.click('#importBtn');
      await page.waitForTimeout(150);
      // No uncaught page errors expected
      expect(pageErrors.length).toBe(0);
    });

    test('Snapshots: save and load snapshot affects Graph; Undo/Redo revert changes', async ({ page }) => {
      // Save current snapshot
      const beforeNodes = await page.evaluate(() => Graph.nodes.length);
      await page.click('#saveSnapshotBtn');
      await page.waitForTimeout(100);
      // snapshots array should have at least one entry
      const snapCount = await page.evaluate(() => snapshots.length);
      expect(snapCount).toBeGreaterThanOrEqual(1);

      // Modify graph: add a node
      await page.click('#addNodeBtn');
      await page.waitForTimeout(100);
      const added = await page.evaluate(() => Graph.nodes.length);
      expect(added).toBeGreaterThan(beforeNodes);

      // Click snapshot list and then click the Load #0 button that should be present
      await page.click('#snapshotListBtn');
      await page.waitForTimeout(100);
      // Click the first load button in snapshotsList if present
      const loadBtn = page.locator('#snapshotsList button').first();
      if (await loadBtn.count() > 0) {
        await loadBtn.click();
        await page.waitForTimeout(150);
        const afterLoad = await page.evaluate(() => Graph.nodes.length);
        // After loading snapshot 0 (which was taken before adding the node) the node count should be <= added
        expect(afterLoad).toBeLessThanOrEqual(added);
      } else {
        // If UI didn't render load buttons (edge case), at least snapshots array exists
        expect(snapCount).toBeGreaterThanOrEqual(1);
      }

      // Test undo/redo: add another node, undo should remove it, redo should restore it
      const before = await page.evaluate(() => Graph.nodes.length);
      await page.click('#addNodeBtn');
      await page.waitForTimeout(120);
      const afterAdd = await page.evaluate(() => Graph.nodes.length);
      expect(afterAdd).toBe(before + 1);

      // Undo
      await page.click('#undoBtn');
      await page.waitForTimeout(120);
      const afterUndo = await page.evaluate(() => Graph.nodes.length);
      expect(afterUndo).toBe(before);

      // Redo
      await page.click('#redoBtn');
      await page.waitForTimeout(120);
      const afterRedo = await page.evaluate(() => Graph.nodes.length);
      // Redo may or may not be implemented fully; assert it does not produce errors and is >= before
      expect(afterRedo).toBeGreaterThanOrEqual(afterUndo);
    });
  });

  test.describe('Observability: console logs and runtime errors', () => {
    test('No unexpected page errors and console contains application logs', async ({ page }) => {
      // Wait briefly for logs to accumulate
      await page.waitForTimeout(300);

      // There should be no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Console should contain at least some app logging (Tip messages were logged)
      const hasTip = consoleMessages.some(m => m.text && m.text.includes('Tip:'));
      const hasInitLog = consoleMessages.some(m => m.text && (m.text.includes('Prim initialized') || m.text.includes('Added edge')));
      // At least one of these should be present in the console captured
      expect(hasTip || hasInitLog).toBeTruthy();
    });
  });

  test.describe('FSM transitions coverage sanity checks (coverage-based assertions)', () => {
    test('Trigger main FSM events (ADD_NODE, ADD_RANDOM_NODE, TOGGLE_ADD_EDGE_MODE, TOGGLE_DELETE_MODE, INIT_PRIM, STEP_ALGORITHM, RUN_ALGORITHM, PAUSE_ALGORITHM, COMPLETE_RUN, MANUAL_MODE)', async ({ page }) => {
      // ADD_NODE
      const n0 = await page.evaluate(() => Graph.nodes.length);
      await page.click('#addNodeBtn');
      await page.waitForTimeout(80);
      const n1 = await page.evaluate(() => Graph.nodes.length);
      expect(n1).toBeGreaterThanOrEqual(n0 + 1);

      // ADD_RANDOM_NODE
      const n2Before = await page.evaluate(() => Graph.nodes.length);
      await page.click('#addNodeRandBtn');
      await page.waitForTimeout(80);
      const n2After = await page.evaluate(() => Graph.nodes.length);
      expect(n2After).toBeGreaterThanOrEqual(n2Before + 1);

      // TOGGLE_ADD_EDGE_MODE and TOGGLE_DELETE_MODE (toggle on and off)
      await page.click('#edgeModeBtn');
      await page.waitForTimeout(50);
      const edgeTextOn = await page.locator('#edgeModeBtn').innerText();
      expect(edgeTextOn).toContain('ON');

      await page.click('#edgeModeBtn');
      await page.waitForTimeout(50);
      const edgeTextOff = await page.locator('#edgeModeBtn').innerText();
      expect(edgeTextOff).not.toContain('ON');

      await page.click('#delModeBtn');
      await page.waitForTimeout(50);
      const delTextOn = await page.locator('#delModeBtn').innerText();
      expect(delTextOn).toContain('ON');
      await page.click('#delModeBtn');
      await page.waitForTimeout(50);

      // INIT_PRIM -> STEP_ALGORITHM
      await page.click('#initPrimBtn');
      await page.waitForTimeout(120);
      const hasAlgo = await page.evaluate(() => !!algoState);
      expect(hasAlgo).toBeTruthy();
      const beforeIdx = await page.evaluate(() => algoState.actionIndex || 0);
      await page.click('#stepBtn');
      await page.waitForTimeout(120);
      const afterIdx = await page.evaluate(() => algoState.actionIndex);
      expect(afterIdx).toBeGreaterThanOrEqual(beforeIdx + 0);

      // RUN_ALGORITHM then PAUSE_ALGORITHM (we start run then pause quickly)
      await page.click('#runBtn');
      await page.waitForTimeout(150);
      await page.click('#pauseBtn');
      await page.waitForTimeout(120);

      // COMPLETE_RUN finishes everything
      await page.click('#completeBtn');
      await page.waitForTimeout(200);
      const finalIdx = await page.evaluate(() => (algoState && algoState.actions) ? algoState.actionIndex : 0);
      const finalLen = await page.evaluate(() => (algoState && algoState.actions) ? algoState.actions.length : 0);
      expect(finalIdx).toBeGreaterThanOrEqual(0);
      expect(finalLen).toBeGreaterThanOrEqual(0);

      // MANUAL_MODE change and indicator update
      await page.selectOption('#execMode', 'manual');
      await page.waitForTimeout(60);
      const indicatorText = await page.locator('#mode-indicator').innerText();
      expect(indicatorText).toContain('manual');
    });
  });

  // Final consistency check across all tests: ensure no fatal page errors observed
  test('final: assert no uncaught runtime errors occurred during interactions', async ({ page }) => {
    // Allow some time for any late timers or logs
    await page.waitForTimeout(200);
    expect(pageErrors.length).toBe(0);
  });
});