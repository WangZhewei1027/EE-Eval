import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d72242-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Bellman-Ford Algorithm — Interactive Demo (d3d72242-fa73-11f0-83e0-8d7be1d51901)', () => {
  // Collect console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages, focusing on errors/warnings for visibility
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait a short while for initial sample load/rendering to complete
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // Expect no uncaught exceptions to have occurred during the test.
    // If any occur naturally, these assertions will surface them.
    expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors, null, 2)}`).toEqual([]);
    expect(consoleErrors, `Unexpected console errors: ${JSON.stringify(consoleErrors, null, 2)}`).toEqual([]);
  });

  // Helper utilities to inspect application internal state via page.evaluate
  async function getNodes(page) {
    return await page.evaluate(() => nodes.slice());
  }
  async function getEdges(page) {
    return await page.evaluate(() => edges.slice());
  }
  async function getLogText(page) {
    return await page.evaluate(() => document.getElementById('log').innerText);
  }
  async function getInitialized(page) {
    return await page.evaluate(() => !!initialized);
  }
  async function getDistances(page) {
    return await page.evaluate(() => ({ ...distances }));
  }
  async function getPlaying(page) {
    return await page.evaluate(() => !!playing);
  }
  async function getRunButtonText(page) {
    return await page.evaluate(() => document.getElementById('run').textContent);
  }
  async function getIterationAndEdgeIndex(page) {
    return await page.evaluate(() => ({ iteration, edgeIndex }));
  }

  test('Idle state: initial UI elements are present and sample loaded', async ({ page }) => {
    // Verify that main controls exist and initial sample has been loaded on startup.
    await expect(page.locator('#loadSample')).toBeVisible();
    await expect(page.locator('#init')).toBeVisible();
    await expect(page.locator('#step')).toBeVisible();
    await expect(page.locator('#run')).toBeVisible();

    // After page load, sample1 is loaded by default in the implementation.
    const nodes = await getNodes(page);
    const edges = await getEdges(page);
    expect(nodes.length).toBeGreaterThan(0);
    expect(edges.length).toBeGreaterThan(0);

    // The log should contain an entry about the loaded sample and algorithm reset.
    const log = await getLogText(page);
    expect(log).toContain('Loaded sample 1');
    expect(log).toContain('Algorithm reset.');
  });

  test('InitializeAlgorithm transitions to AlgorithmInitialized and sets distances', async ({ page }) => {
    // Pick a source (sourceSelect is populated on load). Then click Initialize.
    const sourceValue = await page.evaluate(() => document.getElementById('sourceSelect').value);
    expect(sourceValue).not.toBeUndefined();

    // Click initialize
    await page.click('#init');

    // Initialization should set initialized flag and distances[source] === 0
    const initialized = await getInitialized(page);
    expect(initialized).toBe(true);

    const distances = await getDistances(page);
    // distance for selected source should be 0
    const src = Number(sourceValue);
    expect(distances[src]).toBe(0);

    // The log should mention initialization with that source.
    const log = await getLogText(page);
    expect(log).toContain(`Initialized. Source = ${src}`);
  });

  test('StepAlgorithm: stepping produces "Considering edge" log and advances edgeIndex', async ({ page }) => {
    // Ensure initialized; if not, initialize
    let initialized = await getInitialized(page);
    if (!initialized) await page.click('#init');

    // Snapshot iteration and edgeIndex before
    const before = await getIterationAndEdgeIndex(page);

    // Click Step once
    await page.click('#step');

    // Allow some time for logs and rendering to update (and potential transient _justRelaxed timeouts)
    await page.waitForTimeout(150);

    // After stepping, log should include 'Considering edge'
    const log = await getLogText(page);
    expect(log).toMatch(/Considering edge .*→ .* \(w=.*\) \[iter .*]/);

    // edgeIndex should have advanced by at least 1 (or iteration finished and reset)
    const after = await getIterationAndEdgeIndex(page);
    const progressed = (after.edgeIndex > before.edgeIndex) || (after.iteration > before.iteration);
    expect(progressed).toBe(true);
  });

  test('AutoPlayAlgorithm: start and stop auto-playing toggles playing state and button text', async ({ page }) => {
    // Ensure algorithm is initialized
    if (!(await getInitialized(page))) await page.click('#init');

    // Start autoplay
    await page.click('#run');

    // Wait for run button to show 'Stop' to indicate playing started
    await page.waitForFunction(() => document.getElementById('run').textContent.trim() === 'Stop', null, { timeout: 2000 });

    let playing = await getPlaying(page);
    expect(playing).toBe(true);
    expect(await getRunButtonText(page)).toBe('Stop');

    // Stop autoplay by clicking again
    await page.click('#run');

    // Wait for button to revert to 'Auto'
    await page.waitForFunction(() => document.getElementById('run').textContent.trim() === 'Auto', null, { timeout: 2000 });

    playing = await getPlaying(page);
    expect(playing).toBe(false);
    expect(await getRunButtonText(page)).toBe('Auto');
  });

  test('Finish current iteration with Next Iteration advances iteration and logs completion', async ({ page }) => {
    // Initialize to be sure
    if (!(await getInitialized(page))) await page.click('#init');

    // Get current iteration
    const before = await page.evaluate(() => iteration);

    // Click Next Iteration
    await page.click('#nextIter');

    // Wait a moment for changes
    await page.waitForTimeout(200);

    const after = await page.evaluate(() => iteration);
    expect(after).toBeGreaterThanOrEqual(before + 1);

    const log = await getLogText(page);
    expect(log).toMatch(/Completed iteration|Finished iteration/);
  });

  test('CheckNegativeCycle detects negative cycles on sample2 (NegativeCycleChecked)', async ({ page }) => {
    // Load sample2 (negative cycle), using the select and Load button
    await page.selectOption('#sample', 'sample2');
    await page.click('#loadSample');

    // Wait briefly for load/render
    await page.waitForTimeout(200);

    // Initialize algorithm for sample2
    await page.click('#init');

    // Perform V-1 full iterations using finishIteration to ensure distances reflect potential cycles
    const V = await page.evaluate(() => nodes.length);
    for (let i = 0; i < Math.max(0, V - 1); i++) {
      // finishIteration completes one pass
      await page.click('#nextIter');
      await page.waitForTimeout(150);
    }

    // Now click Check Negative Cycle
    await page.click('#checkNeg');

    // Wait a bit for highlights and logs
    await page.waitForTimeout(200);

    // The log should indicate detection of negative-weight cycle
    const log = await getLogText(page);
    expect(log).toContain('Negative-weight cycle detected');

    // Edges that can be relaxed should have _justRelaxed set true in JS state
    const relaxedEdges = await page.evaluate(() => edges.filter(e => e._justRelaxed).map(e => e.id));
    expect(Array.isArray(relaxedEdges)).toBe(true);
    expect(relaxedEdges.length).toBeGreaterThan(0);
  });

  test('AddNode and AddEdge interactions: toggles, canvas clicks, prompt/confirm handling', async ({ page }) => {
    // Capture initial counts
    const beforeNodes = await getNodes(page);
    const beforeEdges = await getEdges(page);

    // Toggle addNode mode
    await page.click('#addNodeBtn');
    // Click on canvas to add a node at coordinates (100,100)
    await page.click('#canvas', { position: { x: 100, y: 100 } });
    // Wait for render/log update
    await page.waitForTimeout(150);

    const afterNodes = await getNodes(page);
    expect(afterNodes.length).toBeGreaterThan(beforeNodes.length);

    // Toggle addEdge mode
    await page.click('#addEdgeBtn');

    // Choose two existing nodes to connect: fetch their positions
    const nodePositions = await page.evaluate(() => nodes.slice(0, 3).map(n => ({ id: n.id, x: n.x, y: n.y })));
    expect(nodePositions.length).toBeGreaterThanOrEqual(2);

    // Prepare to respond to the prompt dialog that asks for edge weight
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('prompt');
      // Provide weight '5' as a string
      await dialog.accept('5');
    });

    // Click source node then target node to create edge (first two)
    const sourcePos = nodePositions[0];
    const targetPos = nodePositions[1];

    // Click on source then target on canvas (positions relative to canvas element)
    await page.click('#canvas', { position: { x: Math.round(sourcePos.x), y: Math.round(sourcePos.y) } });
    await page.waitForTimeout(50);
    await page.click('#canvas', { position: { x: Math.round(targetPos.x), y: Math.round(targetPos.y) } });

    // Allow time for edge creation and log
    await page.waitForTimeout(200);

    const afterEdges = await getEdges(page);
    expect(afterEdges.length).toBeGreaterThanOrEqual(beforeEdges.length + 1);

    // Ensure addEdge mode is still toggleable (click again to turn off)
    await page.click('#addEdgeBtn');
  });

  test('ClearGraph: confirm dialog clears all nodes and edges when accepted', async ({ page }) => {
    // Ensure there is at least one node to clear
    const nodesBefore = await getNodes(page);
    expect(nodesBefore.length).toBeGreaterThan(0);

    // Intercept the confirm dialog and accept it
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('confirm');
      await dialog.accept();
    });

    // Click clear
    await page.click('#clear');

    // Wait for reset to happen
    await page.waitForTimeout(200);

    const nodesAfter = await getNodes(page);
    const edgesAfter = await getEdges(page);

    expect(nodesAfter.length).toBe(0);
    expect(edgesAfter.length).toBe(0);

    // Edge list should reflect "No edges"
    const edgeListText = await page.evaluate(() => document.getElementById('edgeList').innerText);
    expect(edgeListText).toContain('No edges');
  });

  test('Edge case: clicking Step before initialization logs an instruction to initialize', async ({ page }) => {
    // Ensure algorithm state is cleared
    await page.click('#reset'); // clearAlgorithmState
    await page.waitForTimeout(100);

    // Now click Step without initializing
    await page.click('#step');
    await page.waitForTimeout(100);

    const log = await getLogText(page);
    expect(log).toContain('Please initialize (pick a source) before stepping.');
  });

  test('ResetAlgorithm (#reset) clears algorithm state but preserves graph', async ({ page }) => {
    // Ensure some nodes exist
    const nodesBefore = await getNodes(page);
    expect(nodesBefore.length).toBeGreaterThan(0);

    // Initialize to create algorithm state
    await page.click('#init');
    await page.waitForTimeout(50);
    expect(await getInitialized(page)).toBe(true);

    // Click reset to clear algorithm state
    await page.click('#reset');
    await page.waitForTimeout(100);

    // Algorithm should be reset (initialized false)
    expect(await getInitialized(page)).toBe(false);

    // Graph nodes should still exist after resetAlgorithmState (implementation clears only algorithm state)
    const nodesAfter = await getNodes(page);
    expect(nodesAfter.length).toBe(nodesBefore.length);

    // Log should contain "Algorithm reset."
    const log = await getLogText(page);
    expect(log).toContain('Algorithm reset.');
  });
});