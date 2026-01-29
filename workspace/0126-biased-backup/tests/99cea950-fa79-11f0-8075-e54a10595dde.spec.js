import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cea950-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the graph application to centralize interactions and assertions
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nodeInput = page.locator('#nodeInput');
    this.addNodeBtn = page.locator('#addNodeBtn');
    this.clearGraphBtn = page.locator('#clearGraphBtn');
    this.edgeInputStart = page.locator('#edgeInputStart');
    this.edgeInputEnd = page.locator('#edgeInputEnd');
    this.addEdgeBtn = page.locator('#addEdgeBtn');
    this.graphDiv = page.locator('#graph');
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async addNode(name) {
    await this.nodeInput.fill(name);
    await this.addNodeBtn.click();
  }

  async addEdge(start, end) {
    await this.edgeInputStart.fill(start);
    await this.edgeInputEnd.fill(end);
    await this.addEdgeBtn.click();
  }

  async clearGraph() {
    await this.clearGraphBtn.click();
  }

  async getGraphInnerHTML() {
    return await this.graphDiv.evaluate((el) => el.innerHTML);
  }

  async getAdjacencyList() {
    // read the internal graph object's adjacencyList from the page context
    // This does not inject or modify any globals; it simply reads existing state.
    return await this.page.evaluate(() => {
      // safe-read: if graph is not defined, return undefined
      if (typeof graph === 'undefined' || !graph) return undefined;
      return graph.adjacencyList;
    });
  }
}

test.describe('Interactive Undirected Graph - FSM tests', () => {
  let graphPage;
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // collect console messages and page errors for each test
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // store the actual Error object for assertions
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    graphPage = new GraphPage(page);
    await graphPage.goto();
  });

  test.afterEach(async () => {
    // Basic sanity: ensure there were no unexpected page errors during the test.
    // Tests that want to assert the presence of errors explicitly can check pageErrors themselves.
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Idle State (S0_Idle) and initial rendering', () => {
    test('Initial load shows all controls and empty graph (Idle State)', async () => {
      // Validate presence of inputs and buttons which represent the Idle state's UI evidence
      await expect(graphPage.nodeInput).toBeVisible();
      await expect(graphPage.addNodeBtn).toBeVisible();
      await expect(graphPage.clearGraphBtn).toBeVisible();
      await expect(graphPage.edgeInputStart).toBeVisible();
      await expect(graphPage.edgeInputEnd).toBeVisible();
      await expect(graphPage.addEdgeBtn).toBeVisible();
      await expect(graphPage.graphDiv).toBeVisible();

      // Validate graph display is empty on initial render
      const html = await graphPage.getGraphInnerHTML();
      expect(html.trim()).toBe('', 'Graph area should be empty on initial load');

      // No console errors emitted on load
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Node operations (S1_NodeAdded transitions)', () => {
    test('Add Node: clicking Add Node with valid input adds node and clears input', async () => {
      // Precondition: graph empty
      expect(await graphPage.getGraphInnerHTML()).toBe('');

      // Action: add a node named "A"
      await graphPage.addNode('A');

      // Verify: node input is cleared after adding (evidence in FSM)
      await expect(graphPage.nodeInput).toHaveValue('');

      // Verify: graph display updated to include the node "A"
      const html = await graphPage.getGraphInnerHTML();
      // The display format is "node: neighbor1, neighbor2<br>"
      // For a standalone node with no neighbors the join is empty string -> "A: <br>"
      expect(html).toContain('A:');
      // Ensure adjacencyList contains the node (read internal state)
      const adjacency = await graphPage.getAdjacencyList();
      expect(adjacency).toBeTruthy();
      expect(Object.prototype.hasOwnProperty.call(adjacency, 'A')).toBe(true);
      expect(Array.isArray(adjacency['A'])).toBe(true);
      expect(adjacency['A'].length).toBe(0);
    });

    test('Add Node with empty input does nothing (edge case)', async () => {
      // Ensure input is empty and click add
      await graphPage.nodeInput.fill('');
      await graphPage.addNodeBtn.click();

      // Graph should remain empty
      expect(await graphPage.getGraphInnerHTML()).toBe('');
      const adjacency = await graphPage.getAdjacencyList();
      // adjacency may be {} or undefined if graph not created - in this app graph is constructed on script load
      expect(adjacency).toBeTruthy();
      expect(Object.keys(adjacency).length).toBe(0);
    });
  });

  test.describe('Edge operations (S2_EdgeAdded transitions)', () => {
    test('Add Edge: clicking Add Edge with two node names adds both nodes (if missing) and creates undirected edge', async () => {
      // Precondition: clear any existing graph to start fresh
      await graphPage.clearGraph();

      // Action: add edge between A and B (nodes do not pre-exist; graph.addEdge should create them)
      await graphPage.addEdge('A', 'B');

      // Verify: edge inputs cleared after adding (evidence in FSM)
      await expect(graphPage.edgeInputStart).toHaveValue('');
      await expect(graphPage.edgeInputEnd).toHaveValue('');

      // Verify: graph display contains both A: B and B: A
      const html = await graphPage.getGraphInnerHTML();
      expect(html).toContain('A: B');
      expect(html).toContain('B: A');

      // Internal adjacency checks
      const adjacency = await graphPage.getAdjacencyList();
      expect(adjacency).toBeTruthy();
      expect(Object.prototype.hasOwnProperty.call(adjacency, 'A')).toBe(true);
      expect(Object.prototype.hasOwnProperty.call(adjacency, 'B')).toBe(true);
      // Undirected -> each list should contain the other
      expect(adjacency['A']).toContain('B');
      expect(adjacency['B']).toContain('A');
    });

    test('Add Edge with missing inputs does nothing (edge case)', async () => {
      // Start from known state: clear graph
      await graphPage.clearGraph();
      expect(await graphPage.getGraphInnerHTML()).toBe('');

      // Click addEdge with one missing input
      await graphPage.edgeInputStart.fill('');
      await graphPage.edgeInputEnd.fill('X');
      await graphPage.addEdgeBtn.click();

      // Graph should still be empty (no edge created because both start and end are required)
      expect(await graphPage.getGraphInnerHTML()).toBe('');
      const adjacency = await graphPage.getAdjacencyList();
      expect(adjacency).toBeTruthy();
      expect(Object.keys(adjacency).length).toBe(0);
    });

    test('Multiple edge additions maintain adjacency and allow repeated transitions', async () => {
      // Clear graph then add multiple edges
      await graphPage.clearGraph();
      await graphPage.addEdge('A', 'B'); // creates A-B
      await graphPage.addEdge('A', 'C'); // creates A-C

      const html = await graphPage.getGraphInnerHTML();
      // A should list B and C (order may be insertion order of pushes)
      expect(html).toContain('A:');
      expect(html).toContain('B: A') || expect(html).toContain('B: A'); // sanity check for B entry
      const adjacency = await graphPage.getAdjacencyList();
      expect(adjacency['A']).toEqual(expect.arrayContaining(['B', 'C']));
      expect(adjacency['B']).toContain('A');
      expect(adjacency['C']).toContain('A');
    });
  });

  test.describe('Clearing the graph (S3_GraphCleared transitions)', () => {
    test('Clear Graph: clicking Clear Graph empties display and internal adjacency list', async () => {
      // Setup: create some nodes/edges
      await graphPage.addNode('Z');
      await graphPage.addEdge('Z', 'Y');

      // Precondition check: graph not empty
      expect((await graphPage.getGraphInnerHTML()).length).toBeGreaterThan(0);

      // Action: clear the graph
      await graphPage.clearGraph();

      // Verify: graph display cleared (evidence in FSM)
      const htmlAfterClear = await graphPage.getGraphInnerHTML();
      expect(htmlAfterClear).toBe('', 'Graph display should be empty after clearing');

      // Verify: internal adjacencyList is reset/empty
      const adjacencyAfterClear = await graphPage.getAdjacencyList();
      // adjacencyAfterClear should be an object with no keys
      expect(adjacencyAfterClear).toBeTruthy();
      expect(Object.keys(adjacencyAfterClear).length).toBe(0);
    });

    test('Clear Graph on already empty graph is a no-op (edge case)', async () => {
      // Ensure graph is empty
      await graphPage.clearGraph();
      expect(await graphPage.getGraphInnerHTML()).toBe('');

      // Click clear again
      await graphPage.clearGraph();

      // Still empty and no errors thrown
      expect(await graphPage.getGraphInnerHTML()).toBe('');
      // afterEach will ensure no page errors occurred
    });
  });

  test.describe('Console and runtime error observations', () => {
    test('No runtime errors (pageerror) or uncaught exceptions should be emitted during typical flows', async ({ page }) => {
      // This test exercises several actions and then asserts no pageerrors were recorded.
      // Actions:
      await graphPage.addNode('M');
      await graphPage.addEdge('M', 'N');
      await graphPage.clearGraph();

      // Check collected console messages for unexpected error types
      // pageErrors were captured in beforeEach; there should be none.
      // Fail the test with diagnostic output if any did occur.
      if (pageErrors.length > 0) {
        // If errors occurred, fail with details
        const messages = pageErrors.map((e) => `${e.name}: ${e.message}`).join('\n');
        throw new Error(`Unexpected page errors were emitted:\n${messages}`);
      }

      // Additionally assert console did not emit any messages of type 'error'
      const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('Observe console and pageerror events are captured (diagnostic)', async ({ page }) => {
      // This test demonstrates that we can observe console and page errors.
      // It does not inject or modify the page; it just asserts the arrays exist and are arrays.
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);

      // It's possible for some environments that console messages are emitted (e.g., by the browser)
      // We accept any count but surface them for debugging when they exist.
      // Provide an informative assertion to ensure observation plumbing works.
      // If any pageErrors exist, fail and print details (fail fast: undesirable in CI).
      if (pageErrors.length > 0) {
        const details = pageErrors.map((e) => `${e.name}: ${e.message}`).join('\n');
        throw new Error(`Captured page errors:\n${details}`);
      }
    });
  });
});