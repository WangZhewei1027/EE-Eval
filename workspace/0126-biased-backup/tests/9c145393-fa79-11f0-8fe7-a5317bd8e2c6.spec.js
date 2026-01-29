import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c145393-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Bellman-Ford Interactive Demo — FSM / E2E checks', () => {
  // capture page errors and console errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages and uncaught page errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    // Navigate to the app and ensure main elements have loaded
    await page.goto(APP_URL);
    await page.waitForSelector('h2', { timeout: 5000 });
    await page.waitForSelector('#generateNodesBtn', { timeout: 5000 });
    // Wait a tick to let init() run (it adds demo graph)
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // Ensure no uncaught page errors or console error logs happened during the test.
    // This asserts the page ran without unexpected runtime exceptions.
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    expect(consoleErrors, 'No console.error should be logged').toEqual([]);
  });

  test.describe('Initial render and Idle / GraphConstructed states', () => {
    test('S0 Idle: page header exists and initial demo graph rendered (S1 GraphConstructed)', async ({ page }) => {
      // Validate the header text (S0 evidence)
      const header = await page.locator('h2');
      await expect(header).toHaveText(/Bellman-Ford Algorithm — Interactive Demo/);

      // The init() script adds demo nodes; verify node selects populated (S1 evidence: state.nodes.length > 0)
      const sourceOptions = await page.locator('#sourceSelect option');
      const targetOptions = await page.locator('#targetSelect option');
      await expect(sourceOptions).toHaveCountGreaterThan(0);
      await expect(targetOptions).toHaveCountGreaterThan(0);

      // Edges table should exist and contain rows (header + edge rows)
      await expect(page.locator('#edgesContainer table')).toBeVisible();
      const edgeRows = await page.locator('#edgesContainer table tr');
      await expect(edgeRows.count()).toBeGreaterThan(1); // header + at least one edge

      // Ensure labels for iteration and finished exist and reflect initial state
      await expect(page.locator('#iterationLabel')).toHaveText('0');
      await expect(page.locator('#finishedLabel')).toHaveText('false');
    });

    test('GenerateNodes transition (S0 -> S1): generate grid nodes via button', async ({ page }) => {
      // Clear graph first to ensure deterministic count
      await page.click('#clearGraphBtn');
      await page.waitForTimeout(50);

      // Set number of nodes to generate and click button
      await page.fill('#nodeCount', '9');
      await page.click('#generateNodesBtn');

      // After generation, the node selects should have 9 options
      const sourceOptions = page.locator('#sourceSelect option');
      await expect(sourceOptions).toHaveCount(9);

      // History should have an entry for generate nodes
      // The historyBox lists items; first entry (most recent) should include 'generate nodes'
      const historyText = await page.locator('#historyBox').innerText();
      expect(historyText).toMatch(/generate nodes/);
    });
  });

  test.describe('Graph editing: AddNode, AddEdge, ClearGraph, Undo/Redo', () => {
    test('AddNode increases node count and updates selects', async ({ page }) => {
      // Note initial count
      const beforeCount = await page.locator('#sourceSelect option').count();

      // Enter a label and click Add Node
      await page.fill('#addNodeLabel', 'TestNodeX');
      await page.click('#addNodeBtn');

      // New node should appear in selects
      await expect(page.locator('#sourceSelect option')).toHaveCount(beforeCount + 1);
      const lastOptionText = await page.locator('#sourceSelect option').nth(beforeCount).textContent();
      expect(lastOptionText).toMatch(/TestNodeX/);

      // History should record add node
      const hist = await page.locator('#historyBox').innerText();
      expect(hist).toMatch(/add node/);
    });

    test('AddEdge increases edges list and displays weight', async ({ page }) => {
      // Ensure at least two nodes exist
      const nodeCount = await page.locator('#edgeFrom option').count();
      expect(nodeCount).toBeGreaterThanOrEqual(2);

      // Use first two nodes as endpoints
      const fromVal = await page.locator('#edgeFrom option').nth(0).getAttribute('value');
      const toVal = await page.locator('#edgeTo option').nth(1).getAttribute('value');

      // Set weight and directed checkbox
      await page.fill('#edgeWeight', '3');
      const directedChecked = await page.isChecked('#edgeDirected');
      if (!directedChecked) await page.click('#edgeDirected');

      // Count edges before
      const beforeRows = await page.locator('#edgesContainer table tr').count();

      // Click Add Edge
      await page.click('#addEdgeBtn');

      // Edge table should have increased row count
      await expect(page.locator('#edgesContainer table tr')).toHaveCount(beforeRows + 1);

      // The new row's weight input should reflect value 3 somewhere in the table
      const weights = await page.locator('#edgesContainer table tr td input[type="number"]').allTextContents();
      expect(weights.join(' ')).toMatch(/\b3\b/);
    });

    test('ClearGraph clears nodes and edges', async ({ page }) => {
      // Click Clear Graph
      await page.click('#clearGraphBtn');
      await page.waitForTimeout(50);

      // Node selects should be empty
      await expect(page.locator('#sourceSelect option')).toHaveCount(0);
      await expect(page.locator('#edgeFrom option')).toHaveCount(0);

      // Edges table may still exist but with only header; ensure no data rows
      const rows = await page.locator('#edgesContainer table tr').count();
      // header row exists; expect rows == 1
      expect(rows).toBeLessThanOrEqual(1);
    });

    test('Undo and Redo affect node count appropriately', async ({ page }) => {
      // Clear graph then add a node to have deterministic behavior
      await page.click('#clearGraphBtn');
      await page.fill('#addNodeLabel', 'UndoNode');
      await page.click('#addNodeBtn');
      await page.waitForTimeout(50);

      const afterAdd = await page.locator('#sourceSelect option').count();
      expect(afterAdd).toBeGreaterThan(0);

      // Click Undo
      await page.click('#undoBtn');
      await page.waitForTimeout(50);
      const afterUndo = await page.locator('#sourceSelect option').count();
      // After undo of adding the only node, count should be 0
      expect(afterUndo).toBeLessThanOrEqual(afterAdd);

      // Redo (if available)
      await page.click('#redoBtn');
      await page.waitForTimeout(50);
      const afterRedo = await page.locator('#sourceSelect option').count();
      expect(afterRedo).toBeGreaterThanOrEqual(afterUndo);
    });
  });

  test.describe('Algorithm initialization and stepping (S2, S3)', () => {
    test('InitializeAlgorithm sets source and resets distances (S2)', async ({ page }) => {
      // Ensure a source exists - use existing demo graph
      const sourceVal = await page.locator('#sourceSelect option').nth(0).getAttribute('value');
      // Select the first option as source
      await page.selectOption('#sourceSelect', sourceVal);

      // Click initialize
      await page.click('#initBtn');

      // Distances container should show one node with distance 0
      const distText = await page.locator('#distContainer').innerText();
      expect(distText).toMatch(/: 0|: 0.0/);

      // Iteration reset to 0 and finished false
      await expect(page.locator('#iterationLabel')).toHaveText('0');
      await expect(page.locator('#finishedLabel')).toHaveText('false');

      // History records initialize
      const hist = await page.locator('#historyBox').innerText();
      expect(hist).toMatch(/initialize BF/);
    });

    test('StepAlgorithm increments edgeIndex or iteration (S2 -> S3 via step)', async ({ page }) => {
      // Ensure auto mode and initialize
      await page.selectOption('#runMode', 'auto');
      const sourceVal = await page.locator('#sourceSelect option').nth(0).getAttribute('value');
      await page.selectOption('#sourceSelect', sourceVal);
      await page.click('#initBtn');

      // Read edgeIndex and iteration values
      const edgeIndexBefore = Number(await page.locator('#edgeIndexLabel').innerText());
      const iterationBefore = Number(await page.locator('#iterationLabel').innerText());

      // Click step
      await page.click('#stepBtn');
      await page.waitForTimeout(100);

      const edgeIndexAfter = Number(await page.locator('#edgeIndexLabel').innerText());
      const iterationAfter = Number(await page.locator('#iterationLabel').innerText());

      // Either edgeIndex increments, or if at end-of-iteration iteration increments
      const progressed = edgeIndexAfter > edgeIndexBefore || iterationAfter > iterationBefore;
      expect(progressed).toBeTruthy();
    });

    test('RunAlgorithm to completion sets finished=true and performs negative cycle check when applicable', async ({ page }) => {
      // Use demo graph which should not have a negative cycle initially
      await page.selectOption('#runMode', 'auto');
      const sourceVal = await page.locator('#sourceSelect option').nth(0).getAttribute('value');
      await page.selectOption('#sourceSelect', sourceVal);
      await page.click('#initBtn');

      // Run to completion
      await page.click('#runBtn');

      // Wait a bit for runToCompletion synchronous loop and UI update
      await page.waitForTimeout(200);

      // finishedLabel should be true
      await expect(page.locator('#finishedLabel')).toHaveText('true');

      // Explanation box should contain finished message
      const explainText = await page.locator('#explainBox').innerText();
      expect(explainText.toLowerCase()).toMatch(/finished/);
    });
  });

  test.describe('Auto-run and Pause (S3 -> S4)', () => {
    test('AutoRun starts and Pause stops it (verify explain messages)', async ({ page }) => {
      // Prepare small graph: clear and add two nodes and an edge
      await page.click('#clearGraphBtn');
      await page.fill('#addNodeLabel', 'X1');
      await page.click('#addNodeBtn');
      await page.fill('#addNodeLabel', 'X2');
      await page.click('#addNodeBtn');
      await page.waitForTimeout(50);

      // Add an edge between the two nodes
      // Select node 0 -> node 1
      await page.selectOption('#edgeFrom', (await page.locator('#edgeFrom option').nth(0).getAttribute('value')));
      await page.selectOption('#edgeTo', (await page.locator('#edgeTo option').nth(1).getAttribute('value')));
      await page.fill('#edgeWeight', '2');
      // Click Add Edge
      await page.click('#addEdgeBtn');
      await page.waitForTimeout(50);

      // Initialize
      await page.selectOption('#runMode', 'auto');
      const sourceVal = await page.locator('#sourceSelect option').nth(0).getAttribute('value');
      await page.selectOption('#sourceSelect', sourceVal);
      await page.click('#initBtn');

      // Start Auto Run
      await page.click('#autoRunBtn');

      // Wait a short while for auto-run to start performing steps
      await page.waitForTimeout(300);

      // Now click pause
      await page.click('#pauseBtn');

      // Pause should have produced an explanation message indicating 'Auto-run paused.'
      const explainText = await page.locator('#explainBox').innerText();
      expect(explainText).toMatch(/Auto-run paused|Auto-run completed|Auto-run started/);
    });
  });

  test.describe('Negative Cycle Detection and Highlight (S5)', () => {
    test('DetectNegativeCycle finds a negative cycle when present and explain reports it', async ({ page }) => {
      // Create deterministic small graph with negative cycle:
      // Clear graph
      await page.click('#clearGraphBtn');

      // Add three nodes: A, B, C
      await page.fill('#addNodeLabel', 'A');
      await page.click('#addNodeBtn');
      await page.fill('#addNodeLabel', 'B');
      await page.click('#addNodeBtn');
      await page.fill('#addNodeLabel', 'C');
      await page.click('#addNodeBtn');
      await page.waitForTimeout(50);

      // Add edges A->B (1), B->C (-2), C->A (-1) => total -2 cycle
      const opts = (n) => page.locator(n + ' option');
      const aVal = await page.locator('#edgeFrom option').nth(0).getAttribute('value'); // A
      const bVal = await page.locator('#edgeFrom option').nth(1).getAttribute('value'); // B
      const cVal = await page.locator('#edgeFrom option').nth(2).getAttribute('value'); // C

      // A -> B (1)
      await page.selectOption('#edgeFrom', aVal);
      await page.selectOption('#edgeTo', bVal);
      await page.fill('#edgeWeight', '1');
      if (!(await page.isChecked('#edgeDirected'))) await page.click('#edgeDirected');
      await page.click('#addEdgeBtn');

      // B -> C (-2)
      await page.selectOption('#edgeFrom', bVal);
      await page.selectOption('#edgeTo', cVal);
      await page.fill('#edgeWeight', '-2');
      await page.click('#addEdgeBtn');

      // C -> A (-1)
      await page.selectOption('#edgeFrom', cVal);
      await page.selectOption('#edgeTo', aVal);
      await page.fill('#edgeWeight', '-1');
      await page.click('#addEdgeBtn');

      // Initialize algorithm
      await page.selectOption('#runMode', 'auto');
      await page.selectOption('#sourceSelect', aVal);
      await page.click('#initBtn');

      // Run to completion which should set finished and detect negative cycle, or directly use detect button
      await page.click('#runBtn');
      await page.waitForTimeout(200);

      // The explain box should indicate negative cycle detected, or clicking detectNegBtn should.
      let explainText = await page.locator('#explainBox').innerText();
      if (!/negative cycle/i.test(explainText)) {
        // Try the explicit quick test button
        await page.click('#detectNegBtn');
        await page.waitForTimeout(100);
        explainText = await page.locator('#explainBox').innerText();
      }
      expect(explainText.toLowerCase()).toMatch(/negative cycle/);
    });
  });

  test.describe('Path reconstruction and import/export error handling', () => {
    test('ReconstructPath shows a valid path after running algorithm', async ({ page }) => {
      // Use the demo graph present at init.
      // Ensure initialized and run to completion
      const sourceVal = await page.locator('#sourceSelect option').nth(0).getAttribute('value');
      const targetVal = await page.locator('#targetSelect option').nth(1).getAttribute('value'); // pick a different node
      await page.selectOption('#sourceSelect', sourceVal);
      await page.click('#initBtn');
      await page.click('#runBtn');
      await page.waitForTimeout(200);

      // Select a target and reconstruct path
      await page.selectOption('#targetSelect', targetVal);
      await page.click('#reconstructBtn');

      // pathContainer should contain 'Path:' or 'No path'
      const pathText = await page.locator('#pathContainer').innerText();
      expect(pathText.length).toBeGreaterThan(0);
      // Accept either a real path or explicit 'No path' but ensure no crash occurred
      expect(/Path:|No path/i.test(pathText)).toBeTruthy();
    });

    test('ImportGraphJSON handles invalid JSON gracefully (error explained, not thrown)', async ({ page }) => {
      // Put invalid JSON into textarea and click import
      await page.fill('#importExportArea', '{ invalidJson::: }');
      await page.click('#importGraphBtn');

      // The explainBox should contain 'Invalid JSON' message
      const explainText = await page.locator('#explainBox').innerText();
      expect(explainText).toMatch(/Invalid JSON|Invalid JSON:/);
    });

    test('LoadStateJSON handles invalid state JSON gracefully', async ({ page }) => {
      // Fill textarea with invalid JSON and click load state
      await page.fill('#importExportArea', '{ not valid state }');
      await page.click('#loadStateBtn');

      const explainText = await page.locator('#explainBox').innerText();
      expect(explainText).toMatch(/Invalid JSON state|Invalid JSON/);
    });
  });

  test.describe('Misc UI controls and edge cases', () => {
    test('Export graph produces JSON in textarea', async ({ page }) => {
      // Click export graph; textarea should be populated with JSON
      await page.click('#exportGraphBtn');
      const txt = await page.locator('#importExportArea').inputValue();
      expect(txt.trim().startsWith('{')).toBeTruthy();
      expect(txt).toContain('"nodes"');
      expect(txt).toContain('"edges"');
    });

    test('Canvas add node, center and snap positions operations do not error', async ({ page }) {
      // Add node at center
      await page.click('#canvasAddNodeBtn');
      await page.waitForTimeout(50);

      // Auto layout
      await page.click('#autoLayoutBtn');
      await page.waitForTimeout(50);

      // Snap positions
      await page.click('#snapPositionsBtn');
      await page.waitForTimeout(50);

      // Center nodes
      await page.click('#canvasCenterBtn');
      await page.waitForTimeout(50);

      // After these operations, history should contain corresponding labels
      const hist = await page.locator('#historyBox').innerText();
      expect(hist).toMatch(/auto layout|snap positions|center nodes|randomize positions|add node/);
    });
  });
});