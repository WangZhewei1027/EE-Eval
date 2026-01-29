import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf1e84-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the Kruskal demo page
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      nodeInput: '#node-input',
      edgeInput: '#edge-input',
      addNodeBtn: '#add-node',
      addEdgeBtn: '#add-edge',
      runAlgorithmBtn: '#run-algorithm',
      nodesArea: '#nodes-area',
      edgesArea: '#edges-area',
      mstArea: '#mst-area'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async addNode(nodeLabel) {
    await this.page.fill(this.selectors.nodeInput, nodeLabel);
    await this.page.click(this.selectors.addNodeBtn);
  }

  async addEdge(edgeSpec) {
    await this.page.fill(this.selectors.edgeInput, edgeSpec);
    await this.page.click(this.selectors.addEdgeBtn);
  }

  async runAlgorithm() {
    await this.page.click(this.selectors.runAlgorithmBtn);
  }

  async getNodesAreaText() {
    return this.page.locator(this.selectors.nodesArea).innerText();
  }

  async getEdgesAreaText() {
    return this.page.locator(this.selectors.edgesArea).innerText();
  }

  async getMstAreaText() {
    return this.page.locator(this.selectors.mstArea).innerText();
  }

  // Access global variables for deeper assertions
  async getGlobalNodes() {
    return this.page.evaluate(() => typeof nodes !== 'undefined' ? nodes.slice() : undefined);
  }

  async getGlobalEdges() {
    return this.page.evaluate(() => typeof edges !== 'undefined' ? edges.map(e => ({ nodes: e.nodes.slice(), weight: e.weight })) : undefined);
  }

  async callKruskal() {
    return this.page.evaluate(() => {
      if (typeof kruskalAlgorithm === 'function') {
        return kruskalAlgorithm(nodes, edges).map(e => ({ nodes: e.nodes.slice(), weight: e.weight }));
      }
      return null;
    });
  }
}

test.describe('Kruskal Algorithm Interactive Demo - FSM validation', () => {
  // Capture console messages and page errors for each test to inspect runtime issues
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    // Navigate to the app
    const app = new KruskalPage(page);
    await app.goto();
  });

  test.afterEach(async ({ page }) => {
    // As a final check after each test, assert that there were no unexpected runtime errors
    // The application code is expected to run without throwing errors into the page context.
    // If there are errors, they will be surfaced here and cause test failures.
    expect(pageErrors, 'No page errors should have occurred').toEqual([]);
    // Also assert that console did not emit 'error' type messages
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole, 'No console.error messages should have been emitted').toEqual([]);
  });

  test.describe('Idle State (S0_Idle)', () => {
    test('Initial page renders controls and empty areas', async ({ page }) => {
      const app = new KruskalPage(page);

      // Verify inputs and buttons exist
      await expect(page.locator(app.selectors.nodeInput)).toBeVisible();
      await expect(page.locator(app.selectors.edgeInput)).toBeVisible();
      await expect(page.locator(app.selectors.addNodeBtn)).toBeVisible();
      await expect(page.locator(app.selectors.addEdgeBtn)).toBeVisible();
      await expect(page.locator(app.selectors.runAlgorithmBtn)).toBeVisible();

      // Verify areas are initially empty
      const nodesText = await app.getNodesAreaText();
      const edgesText = await app.getEdgesAreaText();
      const mstText = await app.getMstAreaText();
      expect(nodesText).toBe('');
      expect(edgesText).toBe('');
      expect(mstText).toBe('');

      // Validate that global arrays exist and are initially empty
      const globalNodes = await app.getGlobalNodes();
      const globalEdges = await app.getGlobalEdges();
      expect(globalNodes).toEqual([]);
      expect(globalEdges).toEqual([]);
    });
  });

  test.describe('Add Node (S1_NodeAdded) and related transitions', () => {
    test('Adding a valid node updates DOM and global state', async ({ page }) => {
      const app = new KruskalPage(page);

      // Add node "A"
      await app.addNode('A');

      // Node should appear in nodes-area and input cleared
      const nodesArea = page.locator(app.selectors.nodesArea);
      await expect(nodesArea.locator('.node')).toHaveCount(1);
      await expect(nodesArea.locator('.node')).toHaveText('A');
      await expect(page.locator(app.selectors.nodeInput)).toHaveValue('');

      // Global nodes array should include 'A'
      const globalNodes = await app.getGlobalNodes();
      expect(globalNodes).toEqual(['A']);
    });

    test('Adding a duplicate node triggers an alert and does not modify state', async ({ page }) => {
      const app = new KruskalPage(page);

      // Add node "B"
      await app.addNode('B');

      // Attempt to add "B" again; expect an alert with a specific message
      const dialogPromise = page.waitForEvent('dialog');
      await app.addNode('B');
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Invalid or duplicate node.');
      await dialog.accept();

      // Ensure only one 'B' exists in DOM and global state
      const nodesArea = page.locator(app.selectors.nodesArea);
      // There should be exactly one node with text 'B' (and possibly others from prior tests if any)
      const nodeTexts = await nodesArea.allInnerTexts();
      // Count occurrences of 'B' in nodeTexts
      const occurrences = nodeTexts.filter(t => t === 'B').length;
      expect(occurrences).toBe(1);

      const globalNodes = await app.getGlobalNodes();
      // 'B' should appear only once in the global array
      const bCount = globalNodes.filter(n => n === 'B').length;
      expect(bCount).toBe(1);
    });
  });

  test.describe('Add Edge (S2_EdgeAdded) and validations', () => {
    test('Adding a well-formed edge updates DOM and global state', async ({ page }) => {
      const app = new KruskalPage(page);

      // Ensure nodes exist for clarity (though edges are accepted regardless)
      await app.addNode('A');
      await app.addNode('C');

      // Add edge "A-C:5"
      await app.addEdge('A-C:5');

      // Edge should appear in edges-area and input cleared
      const edgesArea = page.locator(app.selectors.edgesArea);
      await expect(edgesArea.locator('.edge')).toHaveCount(1);
      await expect(edgesArea.locator('.edge')).toHaveText('A-C:5');
      await expect(page.locator(app.selectors.edgeInput)).toHaveValue('');

      // Global edges array should include the edge object
      const globalEdges = await app.getGlobalEdges();
      expect(globalEdges.length).toBeGreaterThanOrEqual(1);
      // Find a matching edge
      const matches = globalEdges.filter(e => e.weight === 5 && e.nodes[0] === 'A' && e.nodes[1] === 'C');
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });

    test('Adding an edge with invalid format triggers alert and does not add edge', async ({ page }) => {
      const app = new KruskalPage(page);

      // Invalid format: missing weight
      const dialogPromise = page.waitForEvent('dialog');
      await app.addEdge('X-Y'); // no :weight
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Invalid edge format.');
      await dialog.accept();

      // Ensure no new edge was added to the global array
      const globalEdges = await app.getGlobalEdges();
      // Should be empty (or unchanged)
      expect(globalEdges).toEqual([]);
    });

    test('Adding an edge with non-numeric weight triggers alert', async ({ page }) => {
      const app = new KruskalPage(page);

      const dialogPromise = page.waitForEvent('dialog');
      await app.addEdge('A-B:abc'); // weight not a number
      const dialog = await dialogPromise;
      expect(dialog.message()).toBe('Invalid edge format.');
      await dialog.accept();

      // No edges should be present
      const globalEdges = await app.getGlobalEdges();
      expect(globalEdges).toEqual([]);
    });
  });

  test.describe('Run Algorithm (S3_AlgorithmRun) and MST computation', () => {
    test('Running Kruskal on a small graph produces expected MST edges in the DOM', async ({ page }) => {
      const app = new KruskalPage(page);

      // Build graph:
      // Nodes: A, B, C
      // Edges: A-B:3, B-C:1, A-C:2
      await app.addNode('A');
      await app.addNode('B');
      await app.addNode('C');

      await app.addEdge('A-B:3');
      await app.addEdge('B-C:1');
      await app.addEdge('A-C:2');

      // Click run algorithm
      await app.runAlgorithm();

      // The MST should be B-C:1 and A-C:2 (in that order because edges are sorted by weight)
      const mstText = await app.getMstAreaText();
      // Allow possible spacing variations but expect these two edges in this order joined by comma-space
      expect(mstText).toBe('B-C:1, A-C:2');

      // Also validate MST produced by kruskalAlgorithm function directly via evaluate
      const mst = await app.callKruskal();
      expect(Array.isArray(mst)).toBe(true);
      expect(mst.length).toBe(2);
      const serialized = mst.map(e => `${e.nodes.join('-')}:${e.weight}`).join(', ');
      expect(serialized).toBe('B-C:1, A-C:2');
    });

    test('Running algorithm with no edges does not throw and produces empty MST area', async ({ page }) => {
      const app = new KruskalPage(page);

      // Ensure no nodes/edges present
      const globalNodes = await app.getGlobalNodes();
      const globalEdges = await app.getGlobalEdges();
      expect(globalNodes).toEqual([]);
      expect(globalEdges).toEqual([]);

      // Run algorithm
      await app.runAlgorithm();

      // MST area should be empty string
      const mstText = await app.getMstAreaText();
      expect(mstText).toBe('');
    });
  });

  test.describe('FSM transition coverage and onEnter/onExit checks', () => {
    test('Triggering AddNode, AddEdge, RunAlgorithm correspond to FSM events and DOM changes', async ({ page }) => {
      const app = new KruskalPage(page);

      // S0_Idle -> S1_NodeAdded
      await app.addNode('N1');
      let globalNodes = await app.getGlobalNodes();
      expect(globalNodes).toContain('N1');

      // S0_Idle -> S2_EdgeAdded (we can add edge after nodes)
      await app.addNode('N2');
      await app.addEdge('N1-N2:7');
      let globalEdges = await app.getGlobalEdges();
      const addedEdge = globalEdges.find(e => e.weight === 7 && e.nodes.includes('N1') && e.nodes.includes('N2'));
      expect(addedEdge).toBeTruthy();

      // S0_Idle -> S3_AlgorithmRun
      await app.runAlgorithm();
      const mstText = await app.getMstAreaText();
      // With only one edge connecting N1 and N2, MST should include that edge
      expect(mstText).toBe('N1-N2:7');

      // Check that there is no function named renderPage called on entry (S0 entry action mentions renderPage())
      // We verify that calling renderPage is not necessary for the application to function.
      // If renderPage were invoked but missing, a ReferenceError would have appeared in pageErrors and been caught above.
      // Because we assert pageErrors is empty in afterEach, the absence of ReferenceError is validated.
      // Here, we still confirm that renderPage is not defined on the page (non-intrusive check).
      const hasRenderPage = await page.evaluate(() => typeof renderPage !== 'undefined');
      expect(hasRenderPage).toBe(false);
    });
  });

  test.describe('Observability: Console and runtime error monitoring', () => {
    test('No runtime page errors or console.error emitted during typical flows', async ({ page }) => {
      const app = new KruskalPage(page);

      // Perform a normal sequence of operations
      await app.addNode('X');
      await app.addNode('Y');
      await app.addEdge('X-Y:4');
      await app.runAlgorithm();

      // We already assert no page errors and no console.error in afterEach hook.
      // Here we also explicitly check that console messages collected do not include error types.
      // Collect console messages from the page context (they were captured in beforeEach).
      // Use a short wait to allow any asynchronous console messages to surface.
      await page.waitForTimeout(50);

      // Pull console messages via evaluate (we captured them in the beforeEach handler in the test scope).
      // Nothing to assert here because the afterEach will enforce no errors; this test simply exercises the monitoring path.
      expect(true).toBe(true);
    });
  });
});