import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3c0ea2-d360-11f0-b42e-71f0e7238799.html';

// Page Object for the Topological Sort page
class TopoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.fromInput = page.locator('#fromNode');
    this.toInput = page.locator('#toNode');
    this.addEdgeButton = page.locator("button[onclick='addEdge()']");
    this.topoButton = page.locator("button[onclick='performTopologicalSort()']");
    this.output = page.locator('#output');
  }

  // Set the input values for from/to nodes
  async setFromTo(from, to) {
    await this.fromInput.fill(from);
    await this.toInput.fill(to);
  }

  // Click the Add Edge button
  async addEdge() {
    await this.addEdgeButton.click();
  }

  // Click the Topological Sort button
  async performTopologicalSort() {
    await this.topoButton.click();
  }

  // Read the output text
  async getOutputText() {
    return (await this.output.innerText()).trim();
  }

  // Helper: add an edge via inputs and clicking the button
  async addEdgePair(from, to) {
    await this.setFromTo(from, to);
    await this.addEdge();
  }
}

test.describe('Topological Sort Visualization - FSM validation', () => {
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console messages and errors for assertions
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', (err) => {
      // pageerror events are runtime errors
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No special teardown required; tests will assert error collections when appropriate
  });

  test('Initial Idle state: UI elements render and match FSM components (S0_Idle)', async ({ page }) => {
    // This test verifies the initial Idle state UI and the presence of expected components.
    const topo = new TopoPage(page);

    // Check that inputs and buttons exist and placeholders match the FSM description
    await expect(topo.fromInput).toBeVisible();
    await expect(topo.toInput).toBeVisible();
    await expect(topo.addEdgeButton).toBeVisible();
    await expect(topo.topoButton).toBeVisible();
    await expect(topo.fromInput).toHaveAttribute('placeholder', 'From Node');
    await expect(topo.toInput).toHaveAttribute('placeholder', 'To Node');

    // Output should be empty initially (Idle state)
    const initialOutput = await topo.getOutputText();
    expect(initialOutput).toBe('', 'Expected #output to be empty in the initial Idle state');

    // The FSM entry action referenced "renderPage()". Verify whether such a function exists on the window.
    // We do NOT call it; we only assert presence/absence to "verify onEnter actions if mentioned".
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    // The current implementation does not define renderPage; assert that it's undefined to reflect the actual HTML behavior.
    expect(hasRenderPage).toBe(false);
  });

  test('Add Edge transition: adds an edge and transitions to EdgeAdded state (S1_EdgeAdded)', async ({ page }) => {
    // This test emulates the AddEdge event and asserts the expected DOM changes and state transition evidence.
    const topo = new TopoPage(page);

    // Add an edge A -> B
    await topo.addEdgePair('A', 'B');

    // The output should reflect the edge addition as described in FSM evidence
    const outAfterAdd = await topo.getOutputText();
    expect(outAfterAdd).toContain('Edge added:', 'Expected output to contain "Edge added:" after adding an edge');
    expect(outAfterAdd).toBe('Edge added: A -> B', 'Expected exact output text after adding edge A -> B');

    // Inputs should be cleared after adding the edge
    await expect(topo.fromInput).toHaveValue('');
    await expect(topo.toInput).toHaveValue('');

    // Internally the graph is a global "graph" object. Verify that it contains the edge A -> B.
    // We inspect it but do not modify it.
    const graph = await page.evaluate(() => window.graph || null);
    expect(graph).not.toBeNull();
    expect(graph.A).toBeDefined();
    expect(graph.A).toEqual(['B']);
  });

  test('Add Edge edge-case: attempting to add an edge with missing input shows alert and does not modify output', async ({ page }) => {
    // This test validates input validation behavior and the corresponding error scenario.
    const topo = new TopoPage(page);

    // Ensure both inputs are empty
    await topo.setFromTo('', '');

    // Listen for the dialog event to assert the alert message
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      topo.addEdgeButton.click(), // trigger the alert by clicking Add Edge with empty inputs
    ]);

    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe('Please enter both nodes!');
    await dialog.accept();

    // Output should remain unchanged (still empty)
    const out = await topo.getOutputText();
    expect(out).toBe('', 'Expected no output change when adding an edge with missing inputs');
  });

  test('Topological Sort transition: sorts previously added edges and shows Sorted state (S2_Sorted)', async ({ page }) => {
    // This test builds a small DAG and verifies the Topological Sort output.
    const topo = new TopoPage(page);

    // Build DAG: A -> B, B -> C
    await topo.addEdgePair('A', 'B');
    await topo.addEdgePair('B', 'C');

    // Now perform topological sort
    await topo.performTopologicalSort();

    // The output should indicate the sorted order as per FSM evidence
    const outAfterSort = await topo.getOutputText();
    expect(outAfterSort.startsWith('Topological Sort:'), 'Expected output to start with "Topological Sort:"');
    // Expect the canonical order A -> B -> C
    expect(outAfterSort).toBe('Topological Sort: A -> B -> C');
  });

  test('Topological Sort with multiple components: includes all nodes reachable from keys in graph', async ({ page }) => {
    // This validates behavior with multiple disconnected components in the graph.
    const topo = new TopoPage(page);

    // Build multiple components:
    // Component 1: X -> Y
    // Component 2: M -> N -> O
    await topo.addEdgePair('X', 'Y');
    await topo.addEdgePair('M', 'N');
    await topo.addEdgePair('N', 'O');

    // Perform topological sort
    await topo.performTopologicalSort();

    const out = await topo.getOutputText();
    expect(out.startsWith('Topological Sort:'), 'Expected Topological Sort label in output');

    // The sort should include each component; ordering between disconnected components depends on insertion order.
    // Since edges were added in order X, M, N, expected combined order is X -> Y -> M -> N -> O OR M component first depending on graph key order.
    // We assert that both components are present in the output in a topologically valid way.
    expect(out).toContain('X -> Y');
    expect(out).toContain('M -> N -> O');
  });

  test('Internal graph mutation behavior: adding duplicate edges results in duplicates in internal representation', async ({ page }) => {
    // This tests an edge-case where the same edge is added twice.
    const topo = new TopoPage(page);

    // Add duplicate edge Z -> W twice
    await topo.addEdgePair('Z', 'W');
    await topo.addEdgePair('Z', 'W');

    // Inspect internal graph to confirm duplicates were pushed
    const graph = await page.evaluate(() => window.graph || null);
    expect(graph).not.toBeNull();
    expect(Array.isArray(graph.Z)).toBe(true);
    // Since implementation uses push without deduplication, expect two entries
    expect(graph.Z.length).toBeGreaterThanOrEqual(2);
    expect(graph.Z[0]).toBe('W');
    expect(graph.Z[1]).toBe('W');
  });

  test('Runtime console and page error observation: ensure no unexpected runtime errors occurred during interactions', async ({ page }) => {
    // This test asserts collected console errors and page errors (if any).
    // It runs a couple of interactions to surface any latent runtime errors.

    const topo = new TopoPage(page);

    // Perform some interactions that exercise the code paths
    await topo.addEdgePair('P', 'Q');
    await topo.performTopologicalSort();

    // Wait a tick for any asynchronous console events (not expected here, but safe)
    await page.waitForTimeout(100);

    // Assert that there are no page runtime errors
    expect(pageErrors.length).toBe(0);

    // Assert that there are no console error messages
    expect(consoleErrors.length).toBe(0);

    // Also assert that there were no console messages of type "error" captured
    const consoleErrorEntries = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorEntries.length).toBe(0);
  });

  test('Sanity: the top-level functions required by UI are present and callable (without invoking side-effects here)', async ({ page }) => {
    // Verify existence (type) of top-level functions referenced by button onclick attributes.
    // We do not call them by name (we interact via DOM elements), but we assert they are functions.
    const functionsExist = await page.evaluate(() => {
      return {
        addEdge: typeof window.addEdge,
        performTopologicalSort: typeof window.performTopologicalSort,
        topologicalSort: typeof window.topologicalSort,
      };
    });

    expect(functionsExist.addEdge).toBe('function');
    expect(functionsExist.performTopologicalSort).toBe('function');
    expect(functionsExist.topologicalSort).toBe('function');
  });
});