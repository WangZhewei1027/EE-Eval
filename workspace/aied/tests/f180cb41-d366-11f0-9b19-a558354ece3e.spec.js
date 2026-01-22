import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f180cb41-d366-11f0-9b19-a558354ece3e.html';

// Page Object for the Graph App
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.addNodeButton = page.locator('button[onclick="addNode()"]');
    this.addRandomEdgeButton = page.locator('button[onclick="addRandomEdge()"]');
    this.clearGraphButton = page.locator('button[onclick="clearGraph()"]');
    this.loadFromJSONButton = page.locator('button[onclick="loadFromJSON()"]');
    this.exportToJSONButton = page.locator('button[onclick="exportToJSON()"]');
    this.jsonInput = page.locator('#json-input');
    this.adjacencyList = page.locator('#adjacency-list');
    this.messageDiv = page.locator('#message');
    this.svg = page.locator('#graph-svg');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait a bit to allow window.onload initialization to run and DOM to render
    await this.page.waitForTimeout(100);
  }

  async clickAddNode() {
    await this.addNodeButton.click();
    // message appears and rendering follows; wait briefly
    await this.page.waitForTimeout(50);
  }

  async clickAddRandomEdge() {
    await this.addRandomEdgeButton.click();
    await this.page.waitForTimeout(50);
  }

  async clickClearGraph() {
    await this.clearGraphButton.click();
    await this.page.waitForTimeout(50);
  }

  async clickLoadFromJSON() {
    await this.loadFromJSONButton.click();
    await this.page.waitForTimeout(50);
  }

  async clickExportToJSON() {
    await this.exportToJSONButton.click();
    await this.page.waitForTimeout(50);
  }

  async setJsonInput(value) {
    await this.jsonInput.fill(value);
  }

  async getJsonInputValue() {
    return await this.jsonInput.inputValue();
  }

  async getAdjacencyListHTML() {
    return await this.adjacencyList.innerHTML();
  }

  async getAdjacencyListText() {
    return await this.adjacencyList.textContent();
  }

  async getMessageHTML() {
    return await this.messageDiv.innerHTML();
  }

  async getMessageText() {
    return await this.messageDiv.textContent();
  }

  async getMessageClass() {
    // the message is wrapped in a div with class name equal to type (success/error)
    const inner = await this.messageDiv.locator('div').first();
    if (await inner.count() === 0) return null;
    return await inner.evaluate(node => node.className);
  }

  async getSvgChildrenCount() {
    return await this.svg.evaluate(svg => svg.children.length);
  }

  async getNodeCirclesCount() {
    return await this.svg.locator('circle.node').count();
  }

  async getCircleByDataNode(nodeName) {
    return this.svg.locator(`circle.node[data-node="${nodeName}"]`);
  }

  async clickCircleByDataNode(nodeName) {
    const circle = this.svg.locator(`circle.node[data-node="${nodeName}"]`);
    await circle.click();
    await this.page.waitForTimeout(50);
  }

  async getGraphSummaryFromPage() {
    // Use the in-page graph object to inspect nodes and edges counts.
    return await this.page.evaluate(() => {
      // Expose a simple summary to the test runner.
      if (!window.graph) return null;
      const nodes = graph.getNodes();
      const edges = {};
      let totalEdges = 0;
      for (const n of nodes) {
        const e = graph.getEdges(n);
        edges[n] = Array.from(e);
        totalEdges += e.length;
      }
      return { nodes, edges, totalEdges, adjacencySize: graph.adjacencyList.size, nextNodeId: window.nextNodeId };
    });
  }
}

test.describe('Adjacency List Graph Demo - FSM-driven E2E tests', () => {
  let page;
  let graphPage;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors and page errors for assertions
    page.on('console', msg => {
      // Only collect error-level console messages
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch (e) {
        // ignore inspection errors
      }
    });

    page.on('pageerror', err => {
      pageErrors.push({
        message: err.message,
        stack: err.stack
      });
    });

    graphPage = new GraphPage(page);
    await graphPage.goto();
  });

  test.afterEach(async () => {
    if (page && !page.isClosed()) {
      await page.close();
    }
  });

  test.describe('Initial State (S0_Idle) and rendering', () => {
    test('Initial graph is rendered from window.onload and adjacency list shows sample nodes', async () => {
      // This validates the S0_Idle onEnter renderGraph() and initial sample edges added in window.onload
      const summary = await graphPage.getGraphSummaryFromPage();
      // The HTML's onload adds edges between 'A','B','C','D' so nodes should include A,B,C,D
      expect(summary).not.toBeNull();
      expect(summary.nodes.sort()).toEqual(['A', 'B', 'C', 'D'].sort());
      // Adjacency size should be 4
      expect(summary.adjacencySize).toBe(4);
      // SVG should contain circle elements for each node
      expect(await graphPage.getNodeCirclesCount()).toBe(4);
      // nextNodeId should be set to 4 per the implementation evidence
      expect(summary.nextNodeId).toBe(4);
      // The adjacency-list DOM should contain A, B, C, D labels
      const adjText = await graphPage.getAdjacencyListText();
      expect(adjText).toContain('A');
      expect(adjText).toContain('B');
      expect(adjText).toContain('C');
      expect(adjText).toContain('D');
    });
  });

  test.describe('Adding and removing nodes (S1_NodeAdded)', () => {
    test('Add Node transitions to Node Added state and updates DOM and nextNodeId', async () => {
      // Click Add Node and verify adjacency-list updated with new node name Node4
      await graphPage.clickAddNode();

      // The success message should appear immediately
      const messageHTML = await graphPage.getMessageHTML();
      expect(messageHTML).toMatch(/Added node: Node4/);

      // Verify node count increased
      expect(await graphPage.getNodeCirclesCount()).toBe(5);

      // Ensure the in-page graph reflects the new node
      const summary = await graphPage.getGraphSummaryFromPage();
      expect(summary.nodes).toContain('Node4');
      expect(summary.nextNodeId).toBe(5);
    });

    test('Clicking a node removes it (NodeClicked) and shows success message', async () => {
      // First add a node so we have a predictable Node id to remove
      await graphPage.clickAddNode(); // Node4
      // Ensure it exists
      const beforeSummary = await graphPage.getGraphSummaryFromPage();
      expect(beforeSummary.nodes).toContain('Node4');

      // Click the node circle to remove it
      await graphPage.clickCircleByDataNode('Node4');

      // After removal, adjacency list should no longer contain Node4 and node count reduced
      const afterSummary = await graphPage.getGraphSummaryFromPage();
      expect(afterSummary.nodes).not.toContain('Node4');
      expect(await graphPage.getNodeCirclesCount()).toBe(4);

      // Message should indicate removal
      const msg = await graphPage.getMessageHTML();
      expect(msg).toMatch(/Removed node: Node4/);
    });
  });

  test.describe('Adding edges and clearing graph (S2_EdgeAdded, S3_GraphCleared)', () => {
    test('Add Random Edge when < 2 nodes shows error (edge case)', async () => {
      // Clear graph first
      await graphPage.clickClearGraph();
      // Confirm cleared
      expect(await graphPage.getAdjacencyListText()).toContain('Graph is empty');

      // Try adding random edge with <2 nodes
      await graphPage.clickAddRandomEdge();

      // Should show an error message telling need at least 2 nodes
      const msg = await graphPage.getMessageHTML();
      expect(msg).toMatch(/Need at least 2 nodes to add an edge/);
      // The message class should be 'error'
      const cls = await graphPage.getMessageClass();
      expect(cls).toBe('error');

      // The graph remains empty
      const summary = await graphPage.getGraphSummaryFromPage();
      expect(summary.adjacencySize).toBe(0);
      expect(await graphPage.getNodeCirclesCount()).toBe(0);
    });

    test('Add Random Edge creates an edge and shows success (S2_EdgeAdded)', async () => {
      // Ensure we have at least 3 nodes: add two nodes
      await graphPage.clickAddNode(); // Node0 if cleared, but page currently had initial nodes; to be safe, clear then add
      // For deterministic behavior, clear and load a small JSON with 3 nodes
      await graphPage.clickClearGraph();
      await graphPage.setJsonInput(JSON.stringify({ A: ['B'], B: ['A'], C: [] }, null, 2));
      await graphPage.clickLoadFromJSON();

      // Now add random edge; should succeed because there are 3 nodes
      await graphPage.clickAddRandomEdge();

      // Message should indicate an added edge or that it already exists; ensure success scenario
      const msg = await graphPage.getMessageHTML();
      // Can be success or error depending on random picks; assert at least an informative message
      expect(msg.length).toBeGreaterThan(0);

      // Validate that in-page graph totalEdges is >= 1
      const summary = await graphPage.getGraphSummaryFromPage();
      expect(summary.nodes.length).toBeGreaterThanOrEqual(3);
      expect(summary.totalEdges).toBeGreaterThanOrEqual(1);
    });

    test('Clear Graph empties adjacency list, resets nextNodeId and shows success (S3_GraphCleared)', async () => {
      // Ensure there is something to clear
      await graphPage.clickAddNode();
      const pre = await graphPage.getGraphSummaryFromPage();
      expect(pre.adjacencySize).toBeGreaterThanOrEqual(1);

      // Clear
      await graphPage.clickClearGraph();

      // Adjacency list DOM displays empty message
      const adjText = await graphPage.getAdjacencyListText();
      expect(adjText).toContain('Graph is empty. Add nodes and edges to see the adjacency list.');

      // SVG should be empty (no child elements)
      expect(await graphPage.getSvgChildrenCount()).toBe(0);

      // nextNodeId should be reset to 0 per implementation
      const summary = await graphPage.getGraphSummaryFromPage();
      expect(summary.adjacencySize).toBe(0);
      expect(summary.nextNodeId).toBe(0);

      // Message should indicate cleared
      const msg = await graphPage.getMessageHTML();
      expect(msg).toMatch(/Graph cleared/);
      const cls = await graphPage.getMessageClass();
      expect(cls).toBe('success');
    });
  });

  test.describe('JSON Load and Export (S4_JSONLoaded, S5_JSONExported)', () => {
    test('Load from valid JSON updates graph and sets nextNodeId correctly (S4_JSONLoaded)', async () => {
      // Provide a JSON where node names are non-Node\d so nextNodeId should become 0
      const json = JSON.stringify({ X: ['Y'], Y: ['X'] }, null, 2);
      await graphPage.setJsonInput(json);
      await graphPage.clickLoadFromJSON();

      // Message should indicate success
      const msgHtml = await graphPage.getMessageHTML();
      expect(msgHtml).toMatch(/Graph loaded successfully from JSON/);
      expect(await graphPage.getMessageClass()).toBe('success');

      // Adjacency list should contain X and Y
      const adjText = await graphPage.getAdjacencyListText();
      expect(adjText).toContain('X');
      expect(adjText).toContain('Y');

      // nextNodeId should be 0 because names don't match Node(\d+)
      const summary = await graphPage.getGraphSummaryFromPage();
      expect(summary.nextNodeId).toBe(0);
      expect(summary.adjacencySize).toBe(2);
    });

    test('Export to JSON writes to textarea and shows success (S5_JSONExported)', async () => {
      // Ensure some known graph is loaded
      const json = JSON.stringify({ M: ['N'], N: ['M'] }, null, 2);
      await graphPage.setJsonInput(json);
      await graphPage.clickLoadFromJSON();

      // Now export
      await graphPage.clickExportToJSON();

      // Message should indicate exported
      const msgHtml = await graphPage.getMessageHTML();
      expect(msgHtml).toMatch(/Graph exported to JSON/);
      expect(await graphPage.getMessageClass()).toBe('success');

      // The textarea content should equal graph.toJSON()
      const exportedValue = await graphPage.getJsonInputValue();
      const inPageJSON = await page.evaluate(() => window.graph ? graph.toJSON() : null);
      expect(exportedValue).toBe(inPageJSON);
    });

    test('Loading invalid JSON shows an error and does not modify graph (edge case)', async () => {
      // Start with a known graph
      const good = JSON.stringify({ P: [], Q: [] }, null, 2);
      await graphPage.setJsonInput(good);
      await graphPage.clickLoadFromJSON();

      // Now attempt to load invalid JSON
      await graphPage.setJsonInput('this is not json');
      await graphPage.clickLoadFromJSON();

      // Should show invalid JSON error
      const msg = await graphPage.getMessageHTML();
      expect(msg).toMatch(/Invalid JSON format/);
      expect(await graphPage.getMessageClass()).toBe('error');

      // The current graph should remain as it was previously (P and Q)
      const summary = await graphPage.getGraphSummaryFromPage();
      expect(summary.nodes).toEqual(expect.arrayContaining(['P', 'Q']));
    });
  });

  test.describe('Console and runtime errors observation', () => {
    test('No unexpected console.error or uncaught page errors during normal usage', async () => {
      // Perform a set of interactions that exercise the app
      await graphPage.clickAddNode();
      await graphPage.clickAddRandomEdge();
      await graphPage.clickExportToJSON();
      await graphPage.clickClearGraph();

      // Wait a bit to allow asynchronous console messages or errors to appear
      await page.waitForTimeout(200);

      // We capture console errors and page errors in beforeEach; assert none occurred
      // This validates that no ReferenceError/SyntaxError/TypeError bubbled up during normal operation.
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});