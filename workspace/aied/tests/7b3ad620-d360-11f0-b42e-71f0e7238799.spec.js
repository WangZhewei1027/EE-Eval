import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3ad620-d360-11f0-b42e-71f0e7238799.html';

test.describe('7b3ad620-d360-11f0-b42e-71f0e7238799 - Directed and Undirected Graph Visualization (FSM validations)', () => {

  // Navigate to the application before each test
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  // Basic Idle state checks (S0_Idle)
  test('Initial Idle state: page renders controls and empty graph', async ({ page }) => {
    // Validate presence of the two buttons from the FSM evidence
    const directedButton = page.locator("button[onclick='drawDirectedGraph()']");
    const undirectedButton = page.locator("button[onclick='drawUndirectedGraph()']");
    await expect(directedButton).toHaveCount(1);
    await expect(undirectedButton).toHaveCount(1);

    // Validate SVG graph container exists and has expected attributes
    const svg = page.locator('#graph');
    await expect(svg).toHaveCount(1);
    await expect(await svg.getAttribute('width')).toBe('600');
    await expect(await svg.getAttribute('height')).toBe('400');

    // Initially there should be no node elements and no SVG line edges
    await expect(page.locator('.node')).toHaveCount(0);
    await expect(page.locator('#graph line')).toHaveCount(0);
  });

  // Test drawing a directed graph: S0 -> S1
  test('Draw Directed Graph creates nodes and triggers a runtime page error due to invalid selector', async ({ page }) => {
    // Clicking the directed graph button will:
    // - call drawDirectedGraph()
    // - call drawNodes() which appends 3 .node elements
    // - then drawEdges() which uses an invalid CSS selector (.node:contains(...)) causing a DOMException
    // We assert nodes are created and an uncaught page error is emitted.

    const directedSelector = "button[onclick='drawDirectedGraph()']";

    // Click and capture the page error that is expected to be thrown by drawEdges
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click(directedSelector)
    ]);

    // The thrown error should indicate the selector was invalid
    expect(error).toBeTruthy();
    expect(String(error.message)).toMatch(/not a valid selector|Failed to execute 'querySelector'/i);

    // Nodes should have been created despite the error (3 nodes for the directed graph)
    await expect(page.locator('.node')).toHaveCount(3);

    // Because the error occurs before edges are appended, there should be no <line> elements in the SVG
    await expect(page.locator('#graph line')).toHaveCount(0);
  });

  // Test the exit action / transition for directed graph: S1 -> S0 when DrawDirectedGraph event occurs again
  test('Clicking Draw Directed Graph again invokes clearGraph() (nodes are removed then re-created) and emits another error', async ({ page }) => {
    const directedSelector = "button[onclick='drawDirectedGraph()']";

    // First click to enter S1 (Directed Graph Drawn)
    const [firstError] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click(directedSelector)
    ]);
    expect(firstError).toBeTruthy();
    await expect(page.locator('.node')).toHaveCount(3);

    // Prepare to observe the transient clearing behavior:
    // clearGraph() should remove all '.node' elements before drawNodes() re-adds them.
    // We'll wait for the moment when node count becomes 0 during the second click.
    const clearedPromise = page.waitForFunction(() => document.querySelectorAll('.node').length === 0, null, { timeout: 5000 });
    const errorPromise = page.waitForEvent('pageerror');

    // Trigger the transition event (clicking the same button again). This should:
    // - call clearGraph() (nodes removed)
    // - then attempt to draw again (nodes re-created) and produce a pageerror again
    await page.click(directedSelector);

    // Wait for both the clearing moment and the subsequent error
    const cleared = await clearedPromise;
    const secondError = await errorPromise;

    // Ensure the transient cleared state was observed
    expect(cleared).toBeTruthy();
    expect(secondError).toBeTruthy();
    expect(String(secondError.message)).toMatch(/not a valid selector|Failed to execute 'querySelector'/i);

    // After the second click final state should again display 3 nodes
    await expect(page.locator('.node')).toHaveCount(3);
    // Still no SVG lines due to the same selector error
    await expect(page.locator('#graph line')).toHaveCount(0);
  });

  // Test drawing an undirected graph: S0 -> S2
  test('Draw Undirected Graph creates nodes (4) and triggers the same runtime error', async ({ page }) => {
    const undirectedSelector = "button[onclick='drawUndirectedGraph()']";

    // Clicking undirected graph button appends 4 nodes, then drawEdges() runs and throws due to invalid selector.
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click(undirectedSelector)
    ]);

    expect(error).toBeTruthy();
    expect(String(error.message)).toMatch(/not a valid selector|Failed to execute 'querySelector'/i);

    // Nodes for undirected graph should be 4
    await expect(page.locator('.node')).toHaveCount(4);

    // Edges should not have been appended due to the error
    await expect(page.locator('#graph line')).toHaveCount(0);
  });

  // Test transition from Undirected Graph Drawn back to Idle via clicking DrawUndirectedGraph again
  test('Clicking Draw Undirected Graph again clears previous undirected graph and re-draws (clearGraph exit action) and emits error', async ({ page }) => {
    const undirectedSelector = "button[onclick='drawUndirectedGraph()']";

    // First click to enter S2
    const [firstError] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click(undirectedSelector)
    ]);
    expect(firstError).toBeTruthy();
    await expect(page.locator('.node')).toHaveCount(4);

    // Prepare to detect clearing during the second click
    const clearedPromise = page.waitForFunction(() => document.querySelectorAll('.node').length === 0, null, { timeout: 5000 });
    const errorPromise = page.waitForEvent('pageerror');

    // Trigger second click which should clear and attempt to re-draw (and error again)
    await page.click(undirectedSelector);

    const cleared = await clearedPromise;
    const secondError = await errorPromise;

    expect(cleared).toBeTruthy();
    expect(secondError).toBeTruthy();
    expect(String(secondError.message)).toMatch(/not a valid selector|Failed to execute 'querySelector'/i);

    // Final DOM should have 4 nodes again after re-draw
    await expect(page.locator('.node')).toHaveCount(4);
    await expect(page.locator('#graph line')).toHaveCount(0);
  });

  // Cross-transition: Draw Undirected then Draw Directed (S0 -> S2 then S1)
  test('Cross-transition: drawing undirected then drawing directed clears previous nodes and results in directed nodes', async ({ page }) => {
    const directedSelector = "button[onclick='drawDirectedGraph()']";
    const undirectedSelector = "button[onclick='drawUndirectedGraph()']";

    // Draw undirected first
    const [undError] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click(undirectedSelector)
    ]);
    expect(undError).toBeTruthy();
    await expect(page.locator('.node')).toHaveCount(4);

    // Now draw directed; this should invoke clearGraph() (removing 4 nodes) then draw 3 nodes for directed
    const clearedPromise = page.waitForFunction(() => document.querySelectorAll('.node').length === 0, null, { timeout: 5000 });
    const directedErrorPromise = page.waitForEvent('pageerror');

    // Trigger directed draw
    await page.click(directedSelector);

    const cleared = await clearedPromise;
    const dirError = await directedErrorPromise;

    expect(cleared).toBeTruthy(); // clearGraph ran
    expect(dirError).toBeTruthy();
    expect(String(dirError.message)).toMatch(/not a valid selector|Failed to execute 'querySelector'/i);

    // Final state should have 3 nodes from the directed graph
    await expect(page.locator('.node')).toHaveCount(3);
    await expect(page.locator('#graph line')).toHaveCount(0);
  });

  // Edge case: Rapid repeated clicks on buttons (stress test) to ensure repeated errors and DOM stability
  test('Edge case: rapid repeated clicks on Draw Directed Graph should repeatedly attempt to draw and produce repeated errors without leaving orphaned lines', async ({ page }) => {
    const directedSelector = "button[onclick='drawDirectedGraph()']";

    // Attempt 3 rapid clicks; for each click we expect a pageerror and final node count stable at 3 and no lines.
    const errorPromises = [];
    for (let i = 0; i < 3; i++) {
      // Start waiting for error then click
      errorPromises.push(page.waitForEvent('pageerror'));
      await page.click(directedSelector);
      // Give a tiny delay allowing DOM operations to run
      await page.waitForTimeout(50);
    }

    // Await all errors
    const errors = await Promise.all(errorPromises);
    expect(errors.length).toBe(3);
    errors.forEach(err => {
      expect(String(err.message)).toMatch(/not a valid selector|Failed to execute 'querySelector'/i);
    });

    // Final DOM sanity checks
    await expect(page.locator('.node')).toHaveCount(3);
    // No svg <line> added due to repeated selector error
    await expect(page.locator('#graph line')).toHaveCount(0);
  });

  // Validate that auxiliary SVG defs (marker arrowhead) exist in DOM (component evidence)
  test('SVG defs (arrowhead marker) exist in DOM as evidence of directed rendering intent', async ({ page }) => {
    // The HTML includes an invisible svg with a marker definition for arrowhead
    const marker = page.locator('marker#arrowhead');
    await expect(marker).toHaveCount(1);
    // Validate the polygon inside the marker exists
    await expect(marker.locator('polygon')).toHaveCount(1);
  });

});