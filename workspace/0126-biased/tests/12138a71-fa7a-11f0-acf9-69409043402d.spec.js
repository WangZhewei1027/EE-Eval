import { test, expect } from '@playwright/test';

// Test file: 12138a71-fa7a-11f0-acf9-69409043402d.spec.js
// URL under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/12138a71-fa7a-11f0-acf9-69409043402d.html

// Page object for interacting with the Directed Graph Interactive Explorer UI
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // selectors
    this.nodeInput = '#nodeInput';
    this.addNodeBtn = '#addNodeBtn';
    this.nodeRemoveSelect = '#nodeRemoveSelect';
    this.removeNodeBtn = '#removeNodeBtn';
    this.edgeFromSelect = '#edgeFromSelect';
    this.edgeToSelect = '#edgeToSelect';
    this.edgeWeightInput = '#edgeWeightInput';
    this.addEdgeBtn = '#addEdgeBtn';
    this.edgeRemoveFromSelect = '#edgeRemoveFromSelect';
    this.edgeRemoveToSelect = '#edgeRemoveToSelect';
    this.removeEdgeBtn = '#removeEdgeBtn';

    this.showAdjListBtn = '#showAdjListBtn';
    this.showAdjMatrixBtn = '#showAdjMatrixBtn';
    this.showEdgesBtn = '#showEdgesBtn';
    this.graphOutput = '#graphOutput';

    this.algorithmSelect = '#algorithmSelect';
    this.startNodeInput = '#startNodeInput';
    this.endNodeInput = '#endNodeInput';
    this.runAlgorithmBtn = '#runAlgorithmBtn';
    this.pathResult = '#pathResult';
    this.clearOutputBtn = '#clearOutputBtn';

    this.importArea = '#importArea';
    this.importGraphBtn = '#importGraphBtn';
    this.exportGraphBtn = '#exportGraphBtn';
    this.exportArea = '#exportArea';

    this.computeMetricsBtn = '#computeMetricsBtn';
    this.metricsOutput = '#metricsOutput';
  }

  async addNode(label) {
    await this.page.fill(this.nodeInput, label);
    await this.page.click(this.addNodeBtn);
  }

  async removeNode(label) {
    // select the label option
    await this.page.selectOption(this.nodeRemoveSelect, label);
    // Accept confirm dialog if appears
    this.page.once('dialog', async dialog => dialog.accept());
    await this.page.click(this.removeNodeBtn);
  }

  async addEdge(from, to, weight = '1') {
    await this.page.selectOption(this.edgeFromSelect, from);
    await this.page.selectOption(this.edgeToSelect, to);
    await this.page.fill(this.edgeWeightInput, String(weight));
    await this.page.click(this.addEdgeBtn);
  }

  async removeEdge(from, to) {
    await this.page.selectOption(this.edgeRemoveFromSelect, from);
    // wait for dependent update of to-select
    await this.page.waitForTimeout(50); // small wait for UI to update
    await this.page.selectOption(this.edgeRemoveToSelect, to);
    this.page.once('dialog', async dialog => dialog.accept());
    await this.page.click(this.removeEdgeBtn);
  }

  async showAdjList() {
    await this.page.click(this.showAdjListBtn);
  }

  async showEdges() {
    await this.page.click(this.showEdgesBtn);
  }

  async showAdjMatrix() {
    await this.page.click(this.showAdjMatrixBtn);
  }

  async runAlgorithm(alg, start, end = '') {
    await this.page.selectOption(this.algorithmSelect, alg);
    // allow UI to adjust endNode visibility
    await this.page.waitForTimeout(50);
    if (start) await this.page.selectOption(this.startNodeInput, start);
    if (end) await this.page.selectOption(this.endNodeInput, end);
    await this.page.click(this.runAlgorithmBtn);
  }

  async importGraph(jsonString) {
    await this.page.fill(this.importArea, jsonString);
    // accept alert dialogs
    this.page.once('dialog', async dialog => dialog.accept());
    await this.page.click(this.importGraphBtn);
  }

  async exportGraph() {
    await this.page.click(this.exportGraphBtn);
    return this.page.locator(this.exportArea).innerText();
  }

  async computeMetrics() {
    await this.page.click(this.computeMetricsBtn);
  }

  async clearOutput() {
    await this.page.click(this.clearOutputBtn);
  }

  async getGraphOutputText() {
    return this.page.locator(this.graphOutput).innerText();
  }

  async getPathResultText() {
    return this.page.locator(this.pathResult).innerText();
  }

  async getMetricsText() {
    return this.page.locator(this.metricsOutput).innerText();
  }

  async getNodeRemoveOptions() {
    return this.page.$$eval(`${this.nodeRemoveSelect} option`, opts => opts.map(o => o.textContent.trim()));
  }

  async getEdgeRemoveToOptions() {
    return this.page.$$eval(`${this.edgeRemoveToSelect} option`, opts => opts.map(o => o.textContent.trim()));
  }
}

test.describe.serial('Directed Graph Interactive Explorer - FSM & UI tests', () => {
  const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12138a71-fa7a-11f0-acf9-69409043402d.html';
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // capture console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // capture uncaught exceptions and JS errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Basic check: ensure there were no unexpected runtime exceptions during a test's page lifecycle.
    // If any page errors were observed, fail explicitly and include messages for debugging.
    expect(pageErrors, `Expected no uncaught page errors, but found: ${pageErrors.map(e => e.message).join(' | ')}`).toEqual([]);
    // Also assert there were no console.error messages
    expect(consoleErrors, `Expected no console.error messages, but found: ${consoleErrors.map(e => e.text).join(' | ')}`).toEqual([]);
  });

  // S0 Idle / initialSetup validation
  test('S0_Idle: initial setup executed and UI initialized', async ({ page }) => {
    const gp = new GraphPage(page);
    // initialSetup should populate selectors to indicate "no nodes" state
    // nodeRemoveSelect should show "--No nodes--"
    const removeOptions = await gp.getNodeRemoveOptions();
    expect(removeOptions.length).toBeGreaterThan(0);
    expect(removeOptions[0]).toMatch(/--No nodes--/);
    // Graph output initially empty (no graph)
    const gOut = await gp.getGraphOutputText();
    // Could be empty string because initial UI didn't print anything
    expect(typeof gOut).toBe('string');
  });

  test.describe('1. Graph Node and Edge Management (S1, S2, S3, S4)', () => {
    test('Add Node (transition S0 -> S1): adding nodes updates selectors and clears input', async ({ page }) => {
      const gp = new GraphPage(page);
      // Add node "A"
      await gp.addNode('A');
      // After add, nodeInput should be cleared
      const nodeInputValue = await page.locator(gp.nodeInput).inputValue();
      expect(nodeInputValue).toBe('');
      // nodeRemoveSelect should now include "A"
      const removeOptions = await gp.getNodeRemoveOptions();
      expect(removeOptions).toContain('A');

      // Add another node "B"
      await gp.addNode('B');
      const removeOptions2 = await gp.getNodeRemoveOptions();
      expect(removeOptions2).toEqual(expect.arrayContaining(['A', 'B']));
    });

    test('Add Node edge case: empty label triggers alert and no node added', async ({ page }) => {
      const gp = new GraphPage(page);
      // Keep track of dialog message
      let dialogMessage = '';
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });
      // Ensure input is empty then click Add Node
      await page.fill(gp.nodeInput, '');
      await page.click(gp.addNodeBtn);
      // Wait briefly for dialog handler to run if any
      await page.waitForTimeout(50);
      // Expect an alert instructing to enter a node label
      expect(dialogMessage).toMatch(/enter a node label/i);
      // Confirm no node added (nodeRemoveSelect still shows "--No nodes--" or empty)
      const removeOptions = await gp.getNodeRemoveOptions();
      // Should still include the placeholder
      expect(removeOptions[0]).toMatch(/--No nodes--/i);
    });

    test('Remove Node (transition S0 -> S2): removing a node updates graph and selectors', async ({ page }) => {
      const gp = new GraphPage(page);
      // Prepare by adding nodes C and D
      await gp.addNode('C');
      await gp.addNode('D');
      // Confirm both present
      let opts = await gp.getNodeRemoveOptions();
      expect(opts).toEqual(expect.arrayContaining(['C', 'D']));
      // Remove node C - accept confirm
      await gp.removeNode('C');
      // After removal, C should not be present
      opts = await gp.getNodeRemoveOptions();
      expect(opts).not.toContain('C');
      expect(opts).toContain('D');
    });

    test('Add Edge (transition S0 -> S3) and Remove Edge (S0 -> S4): add an edge and then remove it', async ({ page }) => {
      const gp = new GraphPage(page);
      // Start from clean: add nodes X and Y
      await gp.addNode('X');
      await gp.addNode('Y');
      // Add edge X -> Y weight 2
      await gp.addEdge('X', 'Y', 2);
      // Visualize edges and assert presence
      await gp.showEdges();
      const edgesText = await gp.getGraphOutputText();
      expect(edgesText).toMatch(/X\s*->\s*Y\s*\(weight:\s*2\)/i);

      // Now remove the edge (use removeEdge UI which requires confirm)
      await gp.removeEdge('X', 'Y');
      // Show edges should now indicate no edges
      await gp.showEdges();
      const edgesAfter = await gp.getGraphOutputText();
      expect(edgesAfter).toMatch(/\(No edges in graph\)|\(Graph is empty\)/i);
    });

    test('Add Edge error cases: missing nodes or missing selections show alerts', async ({ page }) => {
      const gp = new GraphPage(page);
      // Ensure selects are empty by adding and removing any nodes
      // Remove any node if present: collect names and remove them
      const existing = await gp.getNodeRemoveOptions();
      // Filter out placeholder entries
      const toRemove = existing.filter(t => t && !t.startsWith('--'));
      for (const n of toRemove) {
        // Accept confirm
        page.once('dialog', async d => d.accept());
        await page.selectOption(gp.nodeRemoveSelect, n);
        await page.click(gp.removeNodeBtn);
      }

      // Now attempt to add edge with no selections - should alert
      let dialogMessage = '';
      page.once('dialog', async dialog => {
        dialogMessage = dialog.message();
        await dialog.accept();
      });
      await page.click(gp.addEdgeBtn);
      await page.waitForTimeout(50);
      expect(dialogMessage).toMatch(/select both "from" and "to" nodes/i);
    });
  });

  test.describe('2. Graph Visualization (S6)', () => {
    test('Show Adjacency List on empty graph displays "(Graph is empty)"', async ({ page }) => {
      const gp = new GraphPage(page);
      // Ensure no nodes exist: attempt to remove any if present
      const existing = await gp.getNodeRemoveOptions();
      const toRemove = existing.filter(t => t && !t.startsWith('--'));
      for (const n of toRemove) {
        page.once('dialog', async d => d.accept());
        await gp.removeNode(n);
      }

      await gp.showAdjList();
      const out = await gp.getGraphOutputText();
      expect(out.trim()).toMatch(/\(Graph is empty\)/i);
    });

    test('Show Adjacency List / Matrix after adding nodes and edges produces expected formatted output', async ({ page }) => {
      const gp = new GraphPage(page);
      // Add nodes P,Q,R and edges P->Q(1), Q->R(3), P->R(2)
      await gp.addNode('P');
      await gp.addNode('Q');
      await gp.addNode('R');

      await gp.addEdge('P', 'Q', 1);
      await gp.addEdge('Q', 'R', 3);
      await gp.addEdge('P', 'R', 2);

      // Adjacency list
      await gp.showAdjList();
      const adjList = await gp.getGraphOutputText();
      expect(adjList).toMatch(/P\s*->\s*(Q\(1\).*R\(2\)|.*R\(2\).*Q\(1\))/i);
      expect(adjList).toMatch(/Q\s*->\s*R\(3\)/i);
      expect(adjList).toMatch(/R\s*->\s*\[No edges\]/i);

      // Adjacency matrix
      await gp.showAdjMatrix();
      const matrix = await gp.getGraphOutputText();
      // header should include nodes P,Q,R
      expect(matrix).toMatch(/\bP\b.*\bQ\b.*\bR\b/);
      // rows should include P, Q, R row labels
      expect(matrix).toMatch(/^P\t/mi);
      expect(matrix).toMatch(/^Q\t/mi);
      expect(matrix).toMatch(/^R\t/mi);
    });

    test('Show Edge List (S6) lists edges correctly', async ({ page }) => {
      const gp = new GraphPage(page);
      // Using previously added P,Q,R edges
      await gp.showEdges();
      const edges = await gp.getGraphOutputText();
      // Expect at least the three edges added
      expect(edges).toMatch(/P\s*->\s*Q\s*\(weight:\s*1\)/i);
      expect(edges).toMatch(/P\s*->\s*R\s*\(weight:\s*2\)/i);
      expect(edges).toMatch(/Q\s*->\s*R\s*\(weight:\s*3\)/i);
    });
  });

  test.describe('3. Graph Algorithms and Exploration (S5)', () => {
    test('BFS and DFS produce expected traversal orders', async ({ page }) => {
      const gp = new GraphPage(page);
      // Build small graph A->B, B->C, A->C (costs irrelevant for BFS/DFS)
      // Clear existing nodes: remove all present first
      const existing = await gp.getNodeRemoveOptions();
      const toRemove = existing.filter(t => t && !t.startsWith('--'));
      for (const n of toRemove) {
        page.once('dialog', async d => d.accept());
        await page.selectOption(gp.nodeRemoveSelect, n);
        await page.click(gp.removeNodeBtn);
      }

      await gp.addNode('A');
      await gp.addNode('B');
      await gp.addNode('C');
      await gp.addEdge('A', 'B', 1);
      await gp.addEdge('B', 'C', 1);
      await gp.addEdge('A', 'C', 5);

      // BFS from A should be A -> B -> C (B discovered before C through A->B, although A->C exists)
      await gp.runAlgorithm('bfs', 'A');
      const bfsOut = await gp.getPathResultText();
      expect(bfsOut).toMatch(/BFS order:\s*\n?A\s*->\s*B\s*->\s*C/i);

      // DFS from A (preorder) should be A -> B -> C (A visits B then B visits C)
      await gp.runAlgorithm('dfs', 'A');
      const dfsOut = await gp.getPathResultText();
      expect(dfsOut).toMatch(/DFS order:\s*\n?A\s*->\s*B\s*->\s*C/i);
    });

    test('Topological sort (topo) on acyclic graph returns order, on cyclic returns alert', async ({ page }) => {
      const gp = new GraphPage(page);
      // Graph currently A->B->C is acyclic
      await gp.runAlgorithm('topo', 'A');
      const topoOut = await gp.getPathResultText();
      expect(topoOut).toMatch(/Topological order:/i);
      // Now create a cycle: C -> A
      await gp.addEdge('C', 'A', 1);
      // Running topo should trigger alert because topologicalSort returns error which UI shows via alert
      let dialogMsg = '';
      page.once('dialog', async d => { dialogMsg = d.message(); await d.accept(); });
      await gp.runAlgorithm('topo', 'A');
      // The code calls topologicalSort and, if result.error, alert(result.error)
      expect(dialogMsg).toMatch(/Graph contains cycles/i);
      // Remove the cycle for downstream tests
      await gp.removeEdge('C', 'A');
    });

    test('Dijkstra shortest path (shortest) returns path and total cost; allPaths works as expected', async ({ page }) => {
      const gp = new GraphPage(page);
      // Ensure shortest path between A and C: via B cost 2 (A->B 1, B->C 1) while direct A->C cost 5
      // Run shortest
      await gp.runAlgorithm('shortest', 'A', 'C');
      const shortestOut = await gp.getPathResultText();
      expect(shortestOut).toMatch(/Shortest path from "A" to "C":/i);
      expect(shortestOut).toMatch(/A\s*->\s*B\s*->\s*C/i);
      expect(shortestOut).toMatch(/Total cost:\s*2/);

      // allPaths between A and C should list at least two paths (A->B->C and A->C)
      await gp.runAlgorithm('allPaths', 'A', 'C');
      const allPathsOut = await gp.getPathResultText();
      expect(allPathsOut).toMatch(/All paths from "A" to "C"/i);
      expect(allPathsOut).toMatch(/1\.\s*A\s*->\s*B\s*->\s*C/);
      expect(allPathsOut).toMatch(/2\.\s*A\s*->\s*C/);
    });

    test('Algorithm error scenarios: missing start or end nodes prompt alerts', async ({ page }) => {
      const gp = new GraphPage(page);
      // Clear start selection and attempt to run BFS (no start selected)
      // First, set startNodeInput to empty (select the placeholder)
      await page.selectOption(gp.startNodeInput, '');
      let alerted = '';
      page.once('dialog', async d => { alerted = d.message(); await d.accept(); });
      await page.click(gp.runAlgorithmBtn);
      await page.waitForTimeout(50);
      expect(alerted).toMatch(/select a start node/i);

      // For shortest path, ensure end required: select start A but leave end empty
      await page.selectOption(gp.startNodeInput, 'A');
      await page.selectOption(gp.endNodeInput, ''); // ensure placeholder
      page.once('dialog', async d => { alerted = d.message(); await d.accept(); });
      await page.selectOption(gp.algorithmSelect, 'shortest');
      await page.waitForTimeout(50);
      await page.click(gp.runAlgorithmBtn);
      await page.waitForTimeout(50);
      expect(alerted).toMatch(/select an end node/i);

      // Start and end equal should alert
      await page.selectOption(gp.startNodeInput, 'A');
      await page.selectOption(gp.endNodeInput, 'A');
      page.once('dialog', async d => { alerted = d.message(); await d.accept(); });
      await page.click(gp.runAlgorithmBtn);
      await page.waitForTimeout(50);
      expect(alerted).toMatch(/Start and end node must be different/i);
    });
  });

  test.describe('4. Import / Export Graph (S7, S8)', () => {
    test('Import Graph (S7): valid JSON imports and updates UI; invalid JSON shows alert', async ({ page }) => {
      const gp = new GraphPage(page);
      // Good JSON example
      const json = JSON.stringify({ A: { B: 1 }, B: { C: 2 }, C: {} });
      let importAlert = '';
      page.once('dialog', async d => { importAlert = d.message(); await d.accept(); });
      await gp.importGraph(json);
      await page.waitForTimeout(50);
      expect(importAlert).toMatch(/Graph successfully imported/i);

      // Confirm nodes A,B,C present
      const nodeOptions = await gp.getNodeRemoveOptions();
      expect(nodeOptions).toEqual(expect.arrayContaining(['A', 'B', 'C']));

      // Now invalid JSON: malformed
      let invalidAlert = '';
      page.once('dialog', async d => { invalidAlert = d.message(); await d.accept(); });
      await page.fill(gp.importArea, '{invalid json');
      await page.click(gp.importGraphBtn);
      await page.waitForTimeout(50);
      expect(invalidAlert).toMatch(/Invalid JSON/i);
    });

    test('Export Graph (S8): exports a JSON representation when graph non-empty, alerts when empty', async ({ page }) => {
      const gp = new GraphPage(page);
      // Export now should work because graph has nodes
      const exported = await gp.exportGraph();
      expect(exported).toContain('"A"');
      // Now clear graph by removing nodes to make it empty then attempt export to trigger alert
      const existing = await gp.getNodeRemoveOptions();
      const toRemove = existing.filter(t => t && !t.startsWith('--'));
      for (const n of toRemove) {
        page.once('dialog', async d => d.accept());
        await gp.removeNode(n);
      }
      // Now attempt export and capture alert
      let exportAlert = '';
      page.once('dialog', async d => { exportAlert = d.message(); await d.accept(); });
      await page.click(gp.exportGraphBtn);
      await page.waitForTimeout(50);
      expect(exportAlert).toMatch(/Graph is empty/i);
    });
  });

  test.describe('5. Graph Metrics (S9)', () => {
    test('Compute Metrics produces a descriptive summary when graph non-empty', async ({ page }) => {
      const gp = new GraphPage(page);
      // Build a small graph for predictable metrics
      // Remove existing nodes if any
      const existing = await gp.getNodeRemoveOptions();
      const toRemove = existing.filter(t => t && !t.startsWith('--'));
      for (const n of toRemove) {
        page.once('dialog', async d => d.accept());
        await gp.removeNode(n);
      }

      // Create nodes M,N with single edge M->N
      await gp.addNode('M');
      await gp.addNode('N');
      await gp.addEdge('M', 'N', 4);

      await gp.computeMetrics();
      const metrics = await gp.getMetricsText();
      expect(metrics).toMatch(/Nodes count:\s*2/);
      expect(metrics).toMatch(/Edges count:\s*1/);
      expect(metrics).toMatch(/Graph is acyclic|Graph is cyclic/); // either is fine; here should be acyclic
      expect(metrics).toMatch(/Strongly connected components:/i);
    });

    test('Compute Metrics on empty graph shows "(Graph is empty)"', async ({ page }) => {
      const gp = new GraphPage(page);
      // Remove nodes
      const existing = await gp.getNodeRemoveOptions();
      const toRemove = existing.filter(t => t && !t.startsWith('--'));
      for (const n of toRemove) {
        page.once('dialog', async d => d.accept());
        await gp.removeNode(n);
      }
      await gp.computeMetrics();
      const metrics = await gp.getMetricsText();
      expect(metrics.trim()).toMatch(/\(Graph is empty\)/i);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No uncaught JS errors or console.error messages should occur during normal interactions', async ({ page }) => {
      // This test purposefully performs a set of interactions while listeners from beforeEach collect any errors.
      const gp = new GraphPage(page);
      // Add a node and run a simple visualization to exercise code paths
      await gp.addNode('Z');
      await gp.addNode('Y');
      await gp.addEdge('Z', 'Y', 1);
      await gp.showAdjList();
      await gp.showAdjMatrix();
      await gp.showEdges();
      await gp.runAlgorithm('bfs', 'Z');

      // We do not need to assert here because afterEach will assert no console/page errors were observed.
      // Add a small expectation to ensure the UI responded:
      const out = await gp.getGraphOutputText();
      expect(out.length).toBeGreaterThan(0);
    });
  });
});