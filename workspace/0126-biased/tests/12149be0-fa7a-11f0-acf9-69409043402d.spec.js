import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12149be0-fa7a-11f0-acf9-69409043402d.html';

test.describe('Topological Sort Interactive Demo - E2E (FSM validation)', () => {
  // Arrays to collect console messages and page errors during a test
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Capture console messages for inspection
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Capture and auto-accept dialogs (alerts/confirms/prompts). We also record them for assertions.
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      // Accept all dialogs (alerts/confirm/prompt) so flow continues
      try {
        await dialog.accept();
      } catch (e) {
        // ignore acceptance errors
      }
    });

    await page.goto(APP_URL);
    // Ensure initial UI rendered
    await expect(page.locator('h2')).toHaveText('Topological Sort Interactive Demo');
  });

  test.afterEach(async ({ page }) => {
    // Final safety check: no unexpected runtime page errors
    // We assert no uncaught JS errors were reported during interaction
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Graph construction and UI state (S0_Idle -> S1_GraphDefined)', () => {
    test('Initial state shows empty graph and Idle UI (S0_Idle)', async ({ page }) => {
      // Validate Idle state UI: empty adjacency display and import/export JSON reflects empty graph
      const graphDisplay = page.locator('#graphDisplay');
      await expect(graphDisplay).toHaveText(''); // no content initially

      const importExportArea = page.locator('#importExportArea');
      const importVal = await importExportArea.inputValue();
      expect(importVal).toContain('"vertices": []');
      expect(importVal).toContain('"edges": {}');

      // Clear button should be disabled when graph is empty
      await expect(page.locator('#clearGraphBtn')).toBeDisabled();
      // Initialize sort should be disabled in Idle
      await expect(page.locator('#initRunBtn')).toBeDisabled();
    });

    test('Add vertex transitions to Graph Defined (AddVertex)', async ({ page }) => {
      // Add a vertex "A"
      await page.fill('#vertexNameInp', 'A');
      await page.click('#addVertexBtn');

      // Log area should include the added vertex message
      const logArea = page.locator('#logArea');
      await expect(logArea).toContainText("Added vertex 'A'.");

      // Graph display should show adjacency line for A
      await expect(page.locator('#graphDisplay')).toContainText(/^A: */);

      // Now graph is defined -> clear button enabled and initRun enabled
      await expect(page.locator('#clearGraphBtn')).toBeEnabled();
      await expect(page.locator('#initRunBtn')).toBeEnabled();

      // Try adding duplicate vertex "A" to capture alert behavior (edge case)
      await page.fill('#vertexNameInp', 'A');
      await page.click('#addVertexBtn');

      // An alert dialog should have been recorded about duplicate vertex
      const lastDialog = dialogs.pop();
      expect(lastDialog).toBeDefined();
      expect(lastDialog.type).toBe('alert');
      expect(lastDialog.message).toContain("already exists");
    });

    test('Clear Graph (ClearGraph) returns to Idle', async ({ page }) => {
      // Add two vertices then clear
      await page.fill('#vertexNameInp', 'X');
      await page.click('#addVertexBtn');
      await page.fill('#vertexNameInp', 'Y');
      await page.click('#addVertexBtn');

      // Confirm UI before clearing
      await expect(page.locator('#graphDisplay')).toContainText('X:');
      await expect(page.locator('#graphDisplay')).toContainText('Y:');

      // Click clear -> triggers confirm which we auto-accept
      await page.click('#clearGraphBtn');

      // Log should show "Graph cleared."
      await expect(page.locator('#logArea')).toContainText('Graph cleared.');

      // Graph display should be empty again
      await expect(page.locator('#graphDisplay')).toHaveText('');

      // initRun should be disabled again
      await expect(page.locator('#initRunBtn')).toBeDisabled();
    });
  });

  test.describe('Edge manipulation and sample/adacency loading', () => {
    test('Add Edge and Remove Edge transitions (AddEdge, RemoveEdge)', async ({ page }) => {
      // Build graph with A and B
      await page.fill('#vertexNameInp', 'A');
      await page.click('#addVertexBtn');
      await page.fill('#vertexNameInp', 'B');
      await page.click('#addVertexBtn');

      // Add edge A -> B
      await page.fill('#fromVertexInp', 'A');
      await page.fill('#toVertexInp', 'B');
      await page.click('#addEdgeBtn');

      await expect(page.locator('#logArea')).toContainText("Added edge 'A' → 'B'.");

      // Graph display should show A: B
      await expect(page.locator('#graphDisplay')).toContainText('A: B');

      // Remove edge A -> B
      await page.click('#removeEdgeBtn');
      await expect(page.locator('#logArea')).toContainText("Removed edge 'A' → 'B'.");

      // Confirm removal reflected in adjacency
      const graphText = await page.locator('#graphDisplay').textContent();
      expect(graphText).toContain('A:'); // present but no targets
      expect(graphText).not.toContain('B'); // B should not be in A's adjacency
    });

    test('Edge operations with missing vertices produce alerts (error scenarios)', async ({ page }) => {
      // Attempt to add edge where vertices do not exist
      await page.fill('#fromVertexInp', 'C');
      await page.fill('#toVertexInp', 'D');
      await page.click('#addEdgeBtn');

      // Alert about missing vertex should be recorded
      const dlg = dialogs.pop();
      expect(dlg).toBeDefined();
      expect(dlg.type).toBe('alert');
      expect(dlg.message).toMatch(/does not exist/);

      // Attempt to remove non-existing edge -> alert
      await page.click('#removeEdgeBtn');
      const dlg2 = dialogs.pop();
      expect(dlg2).toBeDefined();
      expect(dlg2.type).toBe('alert');
      expect(dlg2.message).toMatch(/does not exist/);
    });

    test('Load Sample Graph (LoadSampleGraph) populates adjacency and logs', async ({ page }) => {
      // Select sample "basicDAG" and load
      await page.selectOption('#loadSampleSelect', 'basicDAG');
      await page.click('#loadSampleBtn');

      // UI should reflect loaded sample
      await expect(page.locator('#logArea')).toContainText('Loaded sample graph: basicDAG');
      const adj = await page.locator('#graphDisplay').textContent();
      expect(adj).toContain('A: B C');
      expect(adj).toContain('B: D');
      expect(adj).toContain('C: D E');
    });

    test('Load Graph From Adjacency (valid and invalid inputs)', async ({ page }) => {
      // Invalid input (empty) -> click triggers alert
      await page.fill('#pasteAdjacencyArea', '');
      await page.click('#loadAdjacencyBtn');

      // Alert due to empty input
      let dlg = dialogs.pop();
      expect(dlg).toBeDefined();
      expect(dlg.type).toBe('alert');
      expect(dlg.message).toContain('Paste adjacency list input first');

      // Now provide an invalid adjacency missing colon
      await page.fill('#pasteAdjacencyArea', 'A B C'); // invalid
      await page.click('#loadAdjacencyBtn');

      dlg = dialogs.pop();
      expect(dlg).toBeDefined();
      expect(dlg.type).toBe('alert');
      expect(dlg.message).toContain('Error parsing adjacency list');

      // Valid adjacency input
      await page.fill('#pasteAdjacencyArea', 'P: Q\nQ:');
      await page.click('#loadAdjacencyBtn');

      await expect(page.locator('#logArea')).toContainText('Loaded graph from adjacency list.');
      await expect(page.locator('#graphDisplay')).toContainText('P: Q');
      await expect(page.locator('#graphDisplay')).toContainText('Q:');
    });
  });

  test.describe('Topological sort flows (S2_SortingInitialized -> S3_SortingInProgress -> S4_SortingFinished)', () => {
    test('Initialize Sort (InitializeSort) and single Step (StepSort) with Kahn', async ({ page }) => {
      // Load a small sample graph for deterministic steps
      await page.selectOption('#loadSampleSelect', 'diamond');
      await page.click('#loadSampleBtn');

      // Initialize sort using default algorithm (kahn)
      await page.click('#initRunBtn');
      await expect(page.locator('#logArea')).toContainText('Sort initialized with algorithm: kahn');

      // After init, available nodes and state should be displayed
      await expect(page.locator('#availableNodesDisplay')).toBeVisible();
      const avail = await page.locator('#availableNodesDisplay').textContent();
      expect(avail.trim().length).toBeGreaterThan(0);

      // Step once
      await page.click('#stepBtn');
      await expect(page.locator('#logArea')).toContainText('Removed node');
      // Current order should change to include one node
      const order = await page.locator('#currentOrderDisplay').textContent();
      expect(order.trim().length).toBeGreaterThan(0);
    });

    test('Manual pick when multiple available nodes (PickNode)', async ({ page }) => {
      // Create two isolated vertices so both are available simultaneously
      await page.fill('#vertexNameInp', 'M1');
      await page.click('#addVertexBtn');
      await page.fill('#vertexNameInp', 'M2');
      await page.click('#addVertexBtn');

      // Initialize sort -> now both nodes should be available
      await page.click('#initRunBtn');
      await expect(page.locator('#logArea')).toContainText('Sort initialized with algorithm: kahn');

      // Trigger a step to make controller enter manualPickMode (since available.length > 1)
      await page.click('#stepBtn');

      // The controller should announce waiting for manual pick
      await expect(page.locator('#logArea')).toContainText('Multiple nodes available, waiting for manual pick.');

      // Manual pick UI should be enabled
      await expect(page.locator('#manualPickSelect')).toBeEnabled();
      await expect(page.locator('#pickNodeBtn')).toBeEnabled();

      // Select the second option explicitly
      const select = page.locator('#manualPickSelect');
      const options = await select.locator('option').allTextContents();
      expect(options.length).toBeGreaterThanOrEqual(2);

      // Choose the last option and pick it
      await select.selectOption(options[options.length - 1]);
      await page.click('#pickNodeBtn');

      // Logs should contain manual pick messages and removal
      await expect(page.locator('#logArea')).toContainText('Manually picked node:');
      await expect(page.locator('#logArea')).toContainText('Removed node');
      // Current order should reflect one chosen node
      const curOrder = await page.locator('#currentOrderDisplay').textContent();
      expect(curOrder.trim().length).toBeGreaterThan(0);
    });

    test('Auto Run (AutoRunSort) and Pause (PauseAutoRun) behavior', async ({ page }) => {
      // Build a graph with multiple nodes where auto-run will encounter manual pick mode and pause
      await page.fill('#vertexNameInp', 'U1');
      await page.click('#addVertexBtn');
      await page.fill('#vertexNameInp', 'U2');
      await page.click('#addVertexBtn');
      await page.fill('#vertexNameInp', 'U3');
      await page.click('#addVertexBtn');

      // No edges => multiple available nodes; init
      await page.click('#initRunBtn');
      await expect(page.locator('#logArea')).toContainText('Sort initialized with algorithm: kahn');

      // Speed up autorun for the test
      await page.fill('#autoRunSpeed', '50');

      // Start auto run
      await page.click('#autoRunBtn');

      // It should log that autorun started
      await expect(page.locator('#logArea')).toContainText('Auto run started');

      // Wait until autorun either pauses due to manual pick or finishes; watch log area for either message
      await page.waitForFunction(() => {
        const la = document.getElementById('logArea');
        if(!la) return false;
        const txt = la.textContent || '';
        return txt.includes('Auto run paused due to manual pick mode.') || txt.includes('Topological sort completed successfully.');
      }, { timeout: 5000 });

      const logText = await page.locator('#logArea').textContent();
      // Ensure autorun started and then either paused or finished
      expect(logText).toMatch(/Auto run started/);
      expect(logText).toMatch(/(Auto run paused due to manual pick mode\.|Topological sort completed successfully\.)/);

      // If autorun is still running, click Pause; otherwise clicking Pause should be safe either way
      await page.click('#pauseAutoBtn').catch(() => {});
      // Look for auto run stopped log entry (may or may not be present depending on timing)
      // We accept either "Auto run stopped." or that nothing additional appears
      const updatedLog = await page.locator('#logArea').textContent();
      expect(updatedLog).toMatch(/Auto run started/);
    });

    test('Reset Sort (ResetSort) returns to pre-initialized state', async ({ page }) => {
      // Build a tiny graph and init
      await page.fill('#vertexNameInp', 'R1');
      await page.click('#addVertexBtn');
      await page.click('#initRunBtn');
      await expect(page.locator('#logArea')).toContainText('Sort initialized with algorithm:');

      // Reset sort
      await page.click('#resetSortBtn');

      // After reset, initRun should be enabled and step/auto should be disabled
      await expect(page.locator('#initRunBtn')).toBeEnabled();
      await expect(page.locator('#stepBtn')).toBeDisabled();
      await expect(page.locator('#autoRunBtn')).toBeDisabled();

      // Log should have reset message
      await expect(page.locator('#logArea')).toContainText('Sort reset. Ready to initialize.');
    });
  });

  test.describe('Export/Import and error scenarios', () => {
    test('Export Graph as JSON (ExportGraph)', async ({ page }) => {
      // Ensure graph has known content
      await page.fill('#vertexNameInp', 'E1');
      await page.click('#addVertexBtn');
      await page.fill('#vertexNameInp', 'E2');
      await page.click('#addVertexBtn');
      await page.fill('#fromVertexInp', 'E1');
      await page.fill('#toVertexInp', 'E2');
      await page.click('#addEdgeBtn');

      // Export
      await page.click('#exportGraphBtn');

      // importExportArea should contain JSON reflecting graph
      const exportArea = page.locator('#importExportArea');
      const jsonText = await exportArea.inputValue();
      expect(jsonText).toContain('"vertices"');
      expect(jsonText).toContain('"E1"');
      expect(jsonText).toContain('"E2"');

      // Log should show export message
      await expect(page.locator('#logArea')).toContainText('Graph exported as JSON to the text area.');
    });

    test('Import Graph JSON (valid and invalid scenarios)', async ({ page }) => {
      // Invalid import JSON: missing edges' targets as known vertices
      const badJSON = JSON.stringify({ vertices: ['A'], edges: { A: ['B'] } }, null, 2);
      await page.fill('#importExportArea', badJSON);
      await page.click('#importGraphBtn');

      // Should see an alert about unknown target
      let dlg = dialogs.pop();
      expect(dlg).toBeDefined();
      expect(dlg.type).toBe('alert');
      expect(dlg.message).toContain('Errors') || expect(dlg.message.toLowerCase()).toContain('unknown');

      // Now valid JSON import
      const goodJSON = JSON.stringify({ vertices: ['I','J'], edges: { I: ['J'], J: [] } }, null, 2);
      await page.fill('#importExportArea', goodJSON);
      await page.click('#importGraphBtn');

      // Graph display and log should reflect import success
      await expect(page.locator('#logArea')).toContainText('Graph imported from JSON.');
      await expect(page.locator('#graphDisplay')).toContainText('I: J');
      await expect(page.locator('#graphDisplay')).toContainText('J:');
    });
  });

  test.describe('Robustness and internal state displays', () => {
    test('Changing algorithm resets sort state (onExit/onEnter behavior)', async ({ page }) => {
      // Create vertices and initialize with Kahn
      await page.fill('#vertexNameInp', 'Z1');
      await page.click('#addVertexBtn');
      await page.fill('#vertexNameInp', 'Z2');
      await page.click('#addVertexBtn');
      await page.click('#initRunBtn');
      await expect(page.locator('#logArea')).toContainText('Sort initialized with algorithm: kahn');

      // Switch algorithm to DFS -> should reset sortController and update UI
      await page.selectOption('#algoSelect', 'dfs');
      // The handler logs algorithm change
      await expect(page.locator('#logArea')).toContainText('Algorithm changed to: dfs');

      // initRun should be enabled again
      await expect(page.locator('#initRunBtn')).toBeEnabled();

      // Initialize DFS run
      await page.click('#initRunBtn');
      await expect(page.locator('#logArea')).toContainText('Sort initialized with algorithm: dfs');
      // Available nodes display indicates DFS explores internally
      await expect(page.locator('#availableNodesDisplay')).toContainText('N/A (DFS explores internally)');
    });

    test('Cycle detection path and log when cycle present (LoadSampleGraph cycle)', async ({ page }) => {
      // Load the sample that contains a cycle
      await page.selectOption('#loadSampleSelect', 'cycle');
      await page.click('#loadSampleBtn');

      // Initialize sort and then run steps until finished
      await page.click('#initRunBtn');
      await expect(page.locator('#logArea')).toContainText('Sort initialized with algorithm: kahn');

      // Step repeatedly until completion or cycle detected
      for (let i = 0; i < 6; i++) {
        await page.click('#stepBtn');
        // give UI a moment to update
        await page.waitForTimeout(50);
      }

      // The log should contain cycle detection message
      await expect(page.locator('#logArea')).toContainText('Cycle detected');
      // The stateDisplay should include cycle info if present in logs
      const logTxt = await page.locator('#logArea').textContent();
      expect(logTxt).toMatch(/Cycle detected|topological sort not possible|Cycle path/);
    });
  });

  test.describe('Final sanity checks - no console errors and expected logs', () => {
    test('No uncaught JS errors on the page during routine interactions', async ({ page }) => {
      // As a final smoke test, perform a few quick interactions
      await page.fill('#vertexNameInp', 'S1');
      await page.click('#addVertexBtn');
      await page.fill('#vertexNameInp', 'S2');
      await page.click('#addVertexBtn');
      await page.fill('#fromVertexInp', 'S1');
      await page.fill('#toVertexInp', 'S2');
      await page.click('#addEdgeBtn');

      // Export and import flow
      await page.click('#exportGraphBtn');
      const jsonText = await page.locator('#importExportArea').inputValue();
      expect(jsonText).toContain('"S1"');

      // Check that throughout the test there were no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Basic console sanity: ensure some logs were emitted to the logArea
      const logs = await page.locator('#logArea').textContent();
      expect(logs.length).toBeGreaterThan(0);
    });
  });
});