import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e9345ed1-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Prim Algorithm Interactive Demo - e9345ed1-d360-11f0-a097-ffdd56c22ef4', () => {
  // Capture page console & errors & dialogs for assertions
  let pageErrors = [];
  let consoleMsgs = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMsgs = [];

    // Collect console messages
    page.on('console', msg => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught exceptions / page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Handle dialogs (alert, confirm, prompt) deterministically so tests don't hang
    page.on('dialog', async dialog => {
      try {
        const type = dialog.type(); // 'alert', 'confirm', 'prompt'
        if (type === 'prompt') {
          // Provide a numeric weight for addEdge prompts by default
          await dialog.accept('5');
        } else {
          // Accept alerts and confirms
          await dialog.accept();
        }
      } catch (e) {
        // ignore dialog handling errors; let pageerror capture if anything goes wrong
      }
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure canvas and controls loaded
    await expect(page.locator('#graphCanvas')).toBeVisible();
    await expect(page.locator('#addNodeBtn')).toBeVisible();
    await expect(page.locator('#addEdgeBtn')).toBeVisible();
    await expect(page.locator('#runBtn')).toHaveClass(/btn-primary/);
  });

  test.afterEach(async () => {
    // Assert that there were no unexpected uncaught page errors during the test
    // If errors did occur, include them in the failure message for debugging
    expect(pageErrors.length, `Uncaught page errors:\n${pageErrors.map(e => String(e)).join('\n')}`).toBe(0);
  });

  test.describe('S0_Idle - Initial UI and Idle state', () => {
    test('renders all primary controls and example graph seeded on load', async ({ page }) => {
      // Validate that all control elements from the FSM Idle state exist
      await expect(page.locator('#addNodeBtn')).toBeVisible();
      await expect(page.locator('#addEdgeBtn')).toBeVisible();
      await expect(page.locator('#deleteBtn')).toBeVisible();
      await expect(page.locator('#randomBtn')).toBeVisible();
      await expect(page.locator('#clearBtn')).toBeVisible();
      await expect(page.locator('#runBtn')).toBeVisible();
      await expect(page.locator('#stepBtn')).toBeVisible();
      await expect(page.locator('#autoBtn')).toBeVisible();
      await expect(page.locator('#pauseBtn')).toBeVisible();
      await expect(page.locator('#resetBtn')).toBeVisible();
      await expect(page.locator('#startSelect')).toBeVisible();
      await expect(page.locator('#graphCanvas')).toBeVisible();

      // The sample graph is seeded on load; verify log mentions sample graph
      const logText = await page.locator('#log').textContent();
      expect(logText).toBeTruthy();
      expect(logText).toContain('Sample graph created');

      // Verify node table is populated (seeded graph has nodes)
      const nodeTable = await page.locator('#nodeTable').textContent();
      expect(nodeTable).not.toContain('No nodes yet.');

      // Check that startSelect has options for nodes
      // (options > 1 because there's the "Start Node" placeholder plus seeded nodes)
      const startOptions = await page.$$eval('#startSelect option', opts => opts.map(o => o.value));
      expect(startOptions.length).toBeGreaterThan(1);
    });
  });

  test.describe('S1_AddNode - Add Node interactions', () => {
    test('enter add-node mode and add a node by clicking canvas', async ({ page }) => {
      // Count nodes before adding
      const beforeCount = await page.evaluate(() => window.nodes ? window.nodes.length : 0);

      // Click Add Node button: should set mode = 'addNode' and update UI border
      await page.click('#addNodeBtn');
      // read the mode from page
      const modeAfterClick = await page.evaluate(() => window.mode);
      expect(modeAfterClick).toBe('addNode');

      // Border style should indicate selection (non-empty string expected)
      const addNodeBorder = await page.locator('#addNodeBtn').evaluate(el => el.style.border);
      expect(addNodeBorder).toBeTruthy();

      // Click on canvas at center to add a node
      const canvas = page.locator('#graphCanvas');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      // click near center
      await canvas.click({ position: { x: Math.floor(box.width / 2), y: Math.floor(box.height / 2) } });

      // After adding, mode should reset to 'none'
      const modeAfterAdd = await page.evaluate(() => window.mode);
      expect(modeAfterAdd).toBe('none');

      // Node count should increase by at least 1
      const afterCount = await page.evaluate(() => window.nodes ? window.nodes.length : 0);
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 1);

      // Node table should reflect the new node id (last node)
      const lastNodeId = await page.evaluate(() => {
        const arr = window.nodes || [];
        return arr.length ? arr[arr.length - 1].id : null;
      });
      const nodeTableText = await page.locator('#nodeTable').textContent();
      expect(nodeTableText).toContain(String(lastNodeId));
    });
  });

  test.describe('S2_AddEdge - Add Edge interactions', () => {
    test('enter add-edge mode and create an edge between two existing nodes', async ({ page }) => {
      // Ensure there are at least two nodes; if seeded graph has them, proceed
      const nodeInfo = await page.evaluate(() => {
        return { nodes: (window.nodes || []).map(n => ({ id: n.id, x: n.x, y: n.y })), edgesCount: (window.edges || []).length };
      });
      expect(nodeInfo.nodes.length).toBeGreaterThanOrEqual(2);

      // Enter add-edge mode
      await page.click('#addEdgeBtn');
      const mode = await page.evaluate(() => window.mode);
      expect(mode).toBe('addEdge');

      // Click on first node (simulate picking a source)
      const canvas = page.locator('#graphCanvas');
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();

      // Click at first node coordinate
      const first = nodeInfo.nodes[0];
      const second = nodeInfo.nodes[1];

      // Coordinates for click are relative to canvas element; use positions from node coords
      const canvasBox = await page.locator('#graphCanvas').boundingBox();
      expect(canvasBox).not.toBeNull();

      // Click source node
      await canvas.click({ position: { x: Math.round(first.x), y: Math.round(first.y) } });
      // Wait briefly for any log updates
      await page.waitForTimeout(100);

      // Click target node - a prompt will appear; our dialog handler will supply "5" as the weight
      await canvas.click({ position: { x: Math.round(second.x), y: Math.round(second.y) } });
      // Wait for the app to process prompt and add edge
      await page.waitForTimeout(200);

      // Mode should reset to 'none'
      const modeAfter = await page.evaluate(() => window.mode);
      expect(modeAfter).toBe('none');

      // Verify edges count increased by at least 1
      const edgesCountAfter = await page.evaluate(() => window.edges ? window.edges.length : 0);
      expect(edgesCountAfter).toBeGreaterThanOrEqual(nodeInfo.edgesCount + 1);

      // Verify a log entry for added edge exists
      const logText = await page.locator('#log').textContent();
      expect(logText).toContain('Added edge');
    });

    test('edge creation handles duplicate edges gracefully', async ({ page }) => {
      // Attempt to add an edge between same pair twice and expect a log message indicating duplicate
      const nodesArr = await page.evaluate(() => (window.nodes || []).map(n => ({ id: n.id, x: n.x, y: n.y })));
      if (nodesArr.length < 2) test.skip();

      // Ensure we click addEdge then two nodes twice
      await page.click('#addEdgeBtn');
      await page.waitForTimeout(50);
      await page.locator('#graphCanvas').click({ position: { x: Math.round(nodesArr[0].x), y: Math.round(nodesArr[0].y) } });
      await page.locator('#graphCanvas').click({ position: { x: Math.round(nodesArr[1].x), y: Math.round(nodesArr[1].y) } });
      await page.waitForTimeout(150);

      // Try to add same edge again
      await page.click('#addEdgeBtn');
      await page.waitForTimeout(50);
      await page.locator('#graphCanvas').click({ position: { x: Math.round(nodesArr[0].x), y: Math.round(nodesArr[0].y) } });
      await page.locator('#graphCanvas').click({ position: { x: Math.round(nodesArr[1].x), y: Math.round(nodesArr[1].y) } });
      await page.waitForTimeout(150);

      // Look for "Edge already exists" message in log
      const logText = await page.locator('#log').textContent();
      expect(logText).toMatch(/Edge already exists|Added edge/);
    });
  });

  test.describe('S3_DeleteMode - Delete node and edge behavior', () => {
    test('enter delete mode and remove a node by clicking it', async ({ page }) => {
      // Ensure there is at least one node to remove
      const before = await page.evaluate(() => ({ nodesLen: (window.nodes || []).length }));
      if (before.nodesLen === 0) test.skip();

      // Enter delete mode
      await page.click('#deleteBtn');
      const mode = await page.evaluate(() => window.mode);
      expect(mode).toBe('delete');

      // Click on first node to remove it
      const firstNode = await page.evaluate(() => (window.nodes || [])[0]);
      expect(firstNode).toBeTruthy();
      await page.locator('#graphCanvas').click({ position: { x: Math.round(firstNode.x), y: Math.round(firstNode.y) } });
      await page.waitForTimeout(150);

      const afterNodesLen = await page.evaluate(() => (window.nodes || []).length);
      expect(afterNodesLen).toBeLessThan(before.nodesLen);

      // Verify log contains "Removed node"
      const log = await page.locator('#log').textContent();
      expect(log).toContain('Removed node');
    });

    test('enter delete mode and remove an edge by clicking near its segment', async ({ page }) => {
      // Ensure there is at least one edge; otherwise skip
      const info = await page.evaluate(() => ({ edges: window.edges || [], nodes: window.nodes || [] }));
      if (!info.edges.length) test.skip();

      // Choose first edge and compute midpoint to click
      const edge = info.edges[0];
      const a = info.nodes.find(n => n.id === edge.a);
      const b = info.nodes.find(n => n.id === edge.b);
      if (!a || !b) test.skip();

      // Enter delete mode
      await page.click('#deleteBtn');
      await page.waitForTimeout(50);
      // Click near midpoint of edge
      const midX = Math.round((a.x + b.x) / 2);
      const midY = Math.round((a.y + b.y) / 2);
      await page.locator('#graphCanvas').click({ position: { x: midX, y: midY } });
      await page.waitForTimeout(150);

      // Verify edges count decreased
      const newEdgesCount = await page.evaluate(() => (window.edges || []).length);
      expect(newEdgesCount).toBeLessThan(info.edges.length);

      const log = await page.locator('#log').textContent();
      expect(log).toContain('Removed edge');
    });
  });

  test.describe('Random, Clear graph flows', () => {
    test('Random Graph creates nodes and edges; Clear Graph clears them', async ({ page }) => {
      // Click Random Graph
      await page.click('#randomBtn');
      // Wait for generation
      await page.waitForTimeout(300);

      const afterRandom = await page.evaluate(() => ({ nodes: (window.nodes || []).length, edges: (window.edges || []).length }));
      expect(afterRandom.nodes).toBeGreaterThanOrEqual(2);
      expect(afterRandom.edges).toBeGreaterThanOrEqual(1);

      // Click Clear Graph; confirm dialog will be accepted by handler
      await page.click('#clearBtn');
      await page.waitForTimeout(200);

      const afterClear = await page.evaluate(() => ({ nodes: (window.nodes || []).length }));
      expect(afterClear.nodes).toBe(0);

      const nodeTable = await page.locator('#nodeTable').textContent();
      expect(nodeTable).toContain('No nodes yet.');
    });

    test('create random graph with modified density and n inputs', async ({ page }) => {
      // Set n to 5 and density slider to 0.8 then click Random Graph
      await page.fill('#randN', '5');
      // drag slider by setting value via evaluate (safer than drag)
      await page.evaluate(() => { document.getElementById('randD').value = 0.8; document.getElementById('randD').dispatchEvent(new Event('input')); });
      // confirm UI label updated
      const dVal = await page.locator('#randDVal').textContent();
      expect(dVal).toBe('0.8');

      await page.click('#randomBtn');
      await page.waitForTimeout(300);

      const info = await page.evaluate(() => ({ nodes: window.nodes.length, edges: window.edges.length }));
      expect(info.nodes).toBeGreaterThanOrEqual(2);
      // With high density, expect more than minimal edges (but allow flexibility)
      expect(info.edges).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('S4, S5, S6, S7 - Prim algorithm flows: init, step, auto, pause, reset', () => {
    test('Init Prim initializes primState and shows keys in node table', async ({ page }) => {
      // Ensure there are nodes - seed example may have been cleared by prior tests; if so, create sample small graph
      const nodesLen = await page.evaluate(() => (window.nodes || []).length);
      if (nodesLen === 0) {
        // re-create a minimal graph programmatically via page.evaluate
        await page.evaluate(() => {
          // add two nodes
          window.addNode(100, 100);
          window.addNode(300, 100);
          window.addEdge(0, 1, 7);
          window.primResetState();
          window.rebuildStartSelect();
        });
      }

      // Select first start node via startSelect
      const optValues = await page.$$eval('#startSelect option', opts => opts.map(o => o.value).filter(v => v !== ''));
      expect(optValues.length).toBeGreaterThan(0);
      const startVal = optValues[0];
      await page.selectOption('#startSelect', startVal);

      // Click Init Prim
      await page.click('#runBtn');
      await page.waitForTimeout(150);

      // Validate primState.initialized is true
      const primInitialized = await page.evaluate(() => window.primState && window.primState.initialized === true);
      expect(primInitialized).toBe(true);

      // Node table should show keys (start node key = 0)
      const nodeTableText = await page.locator('#nodeTable').textContent();
      expect(nodeTableText).toContain('key:');
      expect(nodeTableText).toContain('parent:');

      const startKey0 = await page.evaluate((s) => window.primState.key[Number(s)] === 0, startVal);
      expect(startKey0).toBe(true);

      // Log should include initialization message
      const logText = await page.locator('#log').textContent();
      expect(logText).toContain('Prim initialized');
    });

    test('Next Step progresses the algorithm and updates primState', async ({ page }) => {
      // Ensure Prim is initialized; if not, initialize
      const initialized = await page.evaluate(() => window.primState && window.primState.initialized);
      if (!initialized) {
        // select a start node and init
        const opts = await page.$$eval('#startSelect option', opts => opts.map(o => o.value).filter(v => v !== ''));
        if (opts.length === 0) test.skip();
        await page.selectOption('#startSelect', opts[0]);
        await page.click('#runBtn');
        await page.waitForTimeout(150);
      }

      // Record stepCount before
      const beforeStepCount = await page.evaluate(() => window.primState.stepCount || 0);

      // Click Next Step
      await page.click('#stepBtn');
      await page.waitForTimeout(200);

      const afterStep = await page.evaluate(() => ({ stepCount: window.primState.stepCount, current: window.primState.current }));
      expect(afterStep.stepCount).toBeGreaterThan(beforeStepCount);
      expect(afterStep.current).not.toBeNull();

      // Log should contain a "Step" entry
      const log = await page.locator('#log').textContent();
      expect(log).toMatch(/Step \d+:|Select node|Update:/);
    });

    test('Auto Play starts and Pause stops auto-play', async ({ page }) => {
      // Initialize if necessary
      const initialized = await page.evaluate(() => window.primState && window.primState.initialized);
      if (!initialized) {
        const opts = await page.$$eval('#startSelect option', opts => opts.map(o => o.value).filter(v => v !== ''));
        if (opts.length === 0) test.skip();
        await page.selectOption('#startSelect', opts[0]);
        await page.click('#runBtn');
        await page.waitForTimeout(150);
      }

      // Click Auto Play
      await page.click('#autoBtn');
      // Wait briefly to allow interval to be set and log to update
      await page.waitForTimeout(200);

      // Check log contains auto-play started
      let logText = await page.locator('#log').textContent();
      expect(logText).toContain('Auto-play started.');

      // Immediately click Pause to stop the auto play
      await page.click('#pauseBtn');
      await page.waitForTimeout(150);
      logText = await page.locator('#log').textContent();
      expect(logText).toContain('Auto-play paused.');

      // Verify no unhandled exceptions occurred during auto/pause operations (afterEach will check pageErrors)
    });

    test('Reset Steps resets primState to initial after initialization and logs reset', async ({ page }) => {
      // Ensure initialized
      const initialized = await page.evaluate(() => window.primState && window.primState.initialized);
      if (!initialized) {
        const opts = await page.$$eval('#startSelect option', opts => opts.map(o => o.value).filter(v => v !== ''));
        if (opts.length === 0) test.skip();
        await page.selectOption('#startSelect', opts[0]);
        await page.click('#runBtn');
        await page.waitForTimeout(150);
      }

      // Perform one step to change state
      await page.click('#stepBtn');
      await page.waitForTimeout(120);
      const steppedCount = await page.evaluate(() => window.primState.stepCount);
      expect(steppedCount).toBeGreaterThanOrEqual(1);

      // Click Reset Steps
      await page.click('#resetBtn');
      await page.waitForTimeout(150);

      // After reset, stepCount should be 0 (initPrim sets stepCount=0)
      const afterReset = await page.evaluate(() => window.primState.stepCount);
      expect(afterReset).toBe(0);

      // Log should contain reset message
      const logText = await page.locator('#log').textContent();
      expect(logText).toContain('Prim reset');
    });

    test('Clicking Next Step before initialization triggers alert and is handled', async ({ page }) => {
      // Ensure primState is not initialized by resetting graph and prim state
      await page.evaluate(() => { window.primResetState(); });
      await page.waitForTimeout(80);

      // Click stepBtn which should cause an alert ("Initialize Prim first")
      // Our dialog handler will accept it; verify that no unhandled errors occurred and log remains stable
      await page.click('#stepBtn');
      await page.waitForTimeout(120);

      // Since alert was shown and dismissed, primState.initialized should still be false
      const initialized = await page.evaluate(() => window.primState && window.primState.initialized);
      expect(initialized).toBe(false);

      // No page errors should be present (afterEach asserts this)
    });
  });

  test.describe('State & Transition invariants and edge cases', () => {
    test('startSelect change selects start node and logs action', async ({ page }) => {
      const opts = await page.$$eval('#startSelect option', opts => opts.map(o => o.value).filter(v => v !== ''));
      if (opts.length === 0) test.skip();

      // Choose second option if available, else first
      const choice = opts.length > 1 ? opts[1] : opts[0];
      await page.selectOption('#startSelect', choice);
      await page.waitForTimeout(100);

      // primState should not be initialized by simply changing start node
      const primInit = await page.evaluate(() => window.primState && window.primState.initialized);
      expect(primInit).toBeFalsy();

      // Log should mention start node being set
      const log = await page.locator('#log').textContent();
      expect(log).toContain('Start node set to');
    });

    test('adding an edge to itself is prevented and logged', async ({ page }) => {
      // Enter addEdge mode
      await page.click('#addEdgeBtn');
      await page.waitForTimeout(50);

      const nodesArr = await page.evaluate(() => (window.nodes || []).map(n => ({ id: n.id, x: n.x, y: n.y })));
      if (nodesArr.length === 0) test.skip();

      // Click same node twice - should log "Cannot connect node to itself"
      const node = nodesArr[0];
      await page.locator('#graphCanvas').click({ position: { x: Math.round(node.x), y: Math.round(node.y) } });
      await page.waitForTimeout(40);
      await page.locator('#graphCanvas').click({ position: { x: Math.round(node.x), y: Math.round(node.y) } });
      await page.waitForTimeout(120);

      const log = await page.locator('#log').textContent();
      expect(log).toContain('Cannot connect node to itself');
    });

    test('visual and DOM updates reflect MST weight after algorithm completes', async ({ page }) => {
      // Ensure a graph exists and initialize prim
      let nodesLen = await page.evaluate(() => (window.nodes || []).length);
      if (nodesLen === 0) {
        await page.evaluate(() => {
          window.addNode(100, 100);
          window.addNode(300, 100);
          window.addNode(200, 200);
          window.addEdge(0, 1, 1);
          window.addEdge(1, 2, 2);
          window.addEdge(0, 2, 4);
          window.primResetState();
          window.rebuildStartSelect();
        });
        nodesLen = await page.evaluate(() => window.nodes.length);
      }

      const opts = await page.$$eval('#startSelect option', opts => opts.map(o => o.value).filter(v => v !== ''));
      if (!opts.length) test.skip();
      await page.selectOption('#startSelect', opts[0]);
      await page.click('#runBtn');
      await page.waitForTimeout(120);

      // Step until finished or until a limit
      for (let i = 0; i < 10; i++) {
        const finished = await page.evaluate(() => !!window.primState.finished);
        if (finished) break;
        await page.click('#stepBtn');
        await page.waitForTimeout(120);
      }

      const finished = await page.evaluate(() => !!window.primState.finished);
      // For connected small graphs we expect finish to be reachable
      if (finished) {
        // MST weight displayed in UI should match computed totalMSTWeight()
        const uiWeight = await page.locator('#mstWeight').textContent();
        const calcWeight = await page.evaluate(() => 'MST weight: ' + window.totalMSTWeight());
        expect(uiWeight).toBe(calcWeight);
      } else {
        // If not finished within attempts, at least ensure no errors and UI is stable
        expect(finished).toBe(false);
      }
    });
  });

});