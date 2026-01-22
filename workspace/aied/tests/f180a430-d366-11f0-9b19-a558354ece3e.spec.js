import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f180a430-d366-11f0-9b19-a558354ece3e.html';

/**
 * Page object for interacting with the Graph Visualization page.
 * Encapsulates common actions like clicking the canvas at coordinates,
 * reading info text, and interacting with controls.
 */
class GraphPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.canvasSelector = '#graphCanvas';
    this.addNodeBtn = page.locator('#addNodeBtn');
    this.addEdgeBtn = page.locator('#addEdgeBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.graphType = page.locator('#graphType');
    this.algorithm = page.locator('#algorithm');
    this.runAlgorithmBtn = page.locator('#runAlgorithm');
    this.graphInfo = page.locator('#graphInfo');
    this.algorithmOutput = page.locator('#algorithmOutput');
  }

  // Click the canvas at coordinates relative to the top-left of the canvas.
  async clickCanvasAt(x, y) {
    await this.page.click(this.canvasSelector, { position: { x, y } });
  }

  // Convenience to add a node by clicking on the canvas.
  async addNodeAt(x, y) {
    await this.clickCanvasAt(x, y);
    // wait for graphInfo update to reflect the added node
    await this.page.waitForFunction(
      (sel, expected) => document.querySelector(sel).textContent.includes(expected),
      {},
      '#graphInfo',
      'Nodes:'
    );
  }

  // Click a node by clicking at coordinates (assumes a node exists there).
  async clickNodeAt(x, y) {
    await this.clickCanvasAt(x, y);
  }

  async clickAddNodeButton() {
    await this.addNodeBtn.click();
  }

  async clickAddEdgeButton() {
    await this.addEdgeBtn.click();
  }

  async clickClearButton() {
    await this.clearBtn.click();
  }

  async setGraphType(typeValue) {
    await this.graphType.selectOption(typeValue);
  }

  async setAlgorithm(value) {
    await this.algorithm.selectOption(value);
  }

  async clickRunAlgorithm() {
    await this.runAlgorithmBtn.click();
  }

  async getGraphInfoText() {
    return (await this.graphInfo.textContent())?.trim();
  }

  async getAlgorithmOutputText() {
    return (await this.algorithmOutput.textContent())?.trim();
  }
}

test.describe('Graph Visualization - FSM states and transitions', () => {
  // Collect console messages and uncaught page errors to assert later.
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', msg => {
      // Push message text and type for diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Load the application as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure the app had a chance to initialize (window load listener in page)
    await page.waitForTimeout(200); // small pause to allow initialization
  });

  test.afterEach(async ({}, testInfo) => {
    // If any page errors occurred, attach them to the test output for diagnostics
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        testInfo.attach('pageError', { body: String(err), contentType: 'text/plain' });
      }
    }
    // Also attach console messages for debugging if the test fails
    if (testInfo.status !== testInfo.expectedStatus) {
      testInfo.attach('consoleMessages', {
        body: JSON.stringify(consoleMessages, null, 2),
        contentType: 'application/json'
      });
    }
  });

  // Validate initial render and Idle state (S0_Idle)
  test('Initial render (Idle state): UI elements present and initial info', async ({ page }) => {
    const gp = new GraphPage(page);

    // Validate presence of main controls and canvas per FSM evidence
    await expect(page.locator('#addNodeBtn')).toBeVisible();
    await expect(page.locator('#addEdgeBtn')).toBeVisible();
    await expect(page.locator('#clearBtn')).toBeVisible();
    await expect(page.locator('#graphType')).toBeVisible();
    await expect(page.locator('#algorithm')).toBeVisible();
    await expect(page.locator('#runAlgorithm')).toBeVisible();
    await expect(page.locator('#graphCanvas')).toBeVisible();

    // The static initial Graph Information in HTML is "Nodes: 0, Edges: 0"
    const info = await gp.getGraphInfoText();
    expect(info).toBeDefined();
    expect(info).toContain('Nodes: 0');
    expect(info).toContain('Edges: 0');

    // Assert no uncaught ReferenceError/SyntaxError/TypeError occurred during load
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|SyntaxError|TypeError/.test(String(e))
    );
    expect(criticalErrors.length).toBe(0);
  });

  // Test AddNode transition -> S1_NodeAdded
  test('Add Node transition: clicking "Add Node" increases node count', async ({ page }) => {
    const gp = new GraphPage(page);

    // Ensure initial info
    let info = await gp.getGraphInfoText();
    expect(info).toContain('Nodes: 0');

    // Click the Add Node button (this triggers addRandomNode)
    await gp.clickAddNodeButton();

    // Wait until graphInfo reflects increased nodes
    await page.waitForFunction(
      sel => document.querySelector(sel).textContent.includes('Nodes: 1'),
      {},
      '#graphInfo'
    );

    info = await gp.getGraphInfoText();
    expect(info).toContain('Nodes: 1');
    // No edges should have been added by addRandomNode
    expect(info).toMatch(/Edges:\s*0/);

    // Verify no unexpected page errors during this action
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|TypeError|SyntaxError/.test(String(e))
    );
    expect(criticalErrors.length).toBe(0);
  });

  // Test adding an edge via canvas clicks -> S2_EdgeAdded
  test('Add Edge transition: selecting one node then clicking another adds an edge', async ({ page }) => {
    const gp = new GraphPage(page);

    // Add two nodes at deterministic positions by clicking the canvas
    // Positions chosen within canvas: (100,100) and (200,100)
    await gp.addNodeAt(100, 100); // node id 1
    await gp.addNodeAt(200, 100); // node id 2

    // Now select the first node (click on it)
    await gp.clickNodeAt(100, 100);

    // Now click the second node to create an edge between selectedNode and clickedNode
    await gp.clickNodeAt(200, 100);

    // After adding an edge in undirected mode, graph.edges has two entries (from->to and to->from)
    // Wait for graphInfo to update showing edges count = 2
    await page.waitForFunction(
      sel => /Edges:\s*2/.test(document.querySelector(sel).textContent),
      {},
      '#graphInfo'
    );

    const info = await gp.getGraphInfoText();
    expect(info).toContain('Nodes: 2');
    expect(info).toMatch(/Edges:\s*2/);

    // Also verify that clicking the "Add Edge" button only resets selection when used:
    // click Add Edge button should set selectedNode = null (no visible change in info),
    // so simply ensure the button is clickable and does not throw
    await gp.clickAddEdgeButton();

    // Ensure no critical page errors occurred in this flow
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|TypeError|SyntaxError/.test(String(e))
    );
    expect(criticalErrors.length).toBe(0);
  });

  // Test Clear Graph transition -> S3_GraphCleared
  test('Clear Graph transition: clicking "Clear Graph" empties nodes and edges', async ({ page }) => {
    const gp = new GraphPage(page);

    // Create nodes and an edge first
    await gp.addNodeAt(120, 120);
    await gp.addNodeAt(220, 120);
    await gp.clickNodeAt(120, 120);
    await gp.clickNodeAt(220, 120);

    // Ensure graph has nodes and edges before clearing
    let info = await gp.getGraphInfoText();
    expect(info).toContain('Nodes:');
    expect(info).toMatch(/Nodes:\s*[1-9]/); // at least one node
    expect(info).toMatch(/Edges:\s*[0-9]+/);

    // Click the Clear Graph button and wait for info to show 0 nodes
    await gp.clickClearButton();
    await page.waitForFunction(
      sel => document.querySelector(sel).textContent.includes('Nodes: 0'),
      {},
      '#graphInfo'
    );

    info = await gp.getGraphInfoText();
    expect(info).toContain('Nodes: 0');
    expect(info).toMatch(/Edges:\s*0/);

    // Edge case: clicking clear again when graph is already empty should not throw errors
    await gp.clickClearButton();

    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|TypeError|SyntaxError/.test(String(e))
    );
    expect(criticalErrors.length).toBe(0);
  });

  // Test ChangeGraphType event: toggling between undirected/directed -> FSM event ChangeGraphType
  test('Change Graph Type: selecting directed clears edges and marks graph as Directed', async ({ page }) => {
    const gp = new GraphPage(page);

    // Add edge(s) first to ensure edges get cleared on type change
    await gp.addNodeAt(130, 130);
    await gp.addNodeAt(230, 130);
    await gp.clickNodeAt(130, 130);
    await gp.clickNodeAt(230, 130);

    // Confirm edges exist
    let info = await gp.getGraphInfoText();
    expect(info).toMatch(/Edges:\s*[1-9]/);

    // Change graph type to directed. The implementation clears edges on change.
    await gp.setGraphType('directed');

    // Wait for graphInfo to reflect Directed label and zero edges
    await page.waitForFunction(
      sel => document.querySelector(sel).textContent.includes('(Directed)') &&
             /Edges:\s*0/.test(document.querySelector(sel).textContent),
      {},
      '#graphInfo'
    );

    info = await gp.getGraphInfoText();
    expect(info).toContain('(Directed)');
    expect(info).toMatch(/Edges:\s*0/);

    // Change back to undirected and confirm no errors
    await gp.setGraphType('undirected');
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|TypeError|SyntaxError/.test(String(e))
    );
    expect(criticalErrors.length).toBe(0);
  });

  // Test RunAlgorithm transition -> S4_AlgorithmRunning
  test('Run Algorithm: BFS and DFS produce expected outputs; handle edge cases', async ({ page }) => {
    const gp = new GraphPage(page);

    // Edge case 1: Running with no nodes or with "none" selected should produce an explanatory message
    await gp.setAlgorithm('none');
    await gp.clickRunAlgorithm();
    await page.waitForFunction(
      sel => document.querySelector(sel).textContent.includes('Please select an algorithm'),
      {},
      '#algorithmOutput'
    );
    let out = await gp.getAlgorithmOutputText();
    expect(out).toContain('Please select an algorithm');

    // Now construct a simple graph: node1 -> node2
    await gp.addNodeAt(150, 150); // id 1
    await gp.addNodeAt(250, 150); // id 2
    // connect 1 -> 2 by selecting 1 then clicking 2
    await gp.clickNodeAt(150, 150);
    await gp.clickNodeAt(250, 150);

    // Select BFS and run algorithm
    await gp.setAlgorithm('bfs');
    await gp.clickRunAlgorithm();

    // The algorithm output text is set synchronously by runSelectedAlgorithm before visualization delays
    await page.waitForFunction(
      () => document.getElementById('algorithmOutput').textContent.length > 0
    );

    out = await gp.getAlgorithmOutputText();
    // Expect BFS to list nodes in order starting with the first inserted node (id 1)
    expect(out).toMatch(/BFS Order:\s*1\s*→\s*2/);

    // Now test DFS
    await gp.setAlgorithm('dfs');
    await gp.clickRunAlgorithm();
    out = await gp.getAlgorithmOutputText();
    expect(out).toMatch(/DFS Order:\s*1\s*→\s*2/);

    // Ensure the visualization step (which uses async timeouts) does not throw uncaught exceptions
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|TypeError|SyntaxError/.test(String(e))
    );
    expect(criticalErrors.length).toBe(0);
  });

  // Validate console and page error observation behavior explicitly
  test('Console and runtime error observation: no critical JS errors during typical interactions', async ({ page }) => {
    const gp = new GraphPage(page);

    // Perform a sequence of interactions simulating typical user flows
    await gp.addNodeAt(60, 60);
    await gp.addNodeAt(160, 60);
    await gp.clickNodeAt(60, 60);
    await gp.clickNodeAt(160, 60);
    await gp.setAlgorithm('bfs');
    await gp.clickRunAlgorithm();
    await gp.clickClearButton();

    // Allow a brief moment for any async errors to surface
    await page.waitForTimeout(200);

    // Inspect captured page errors and console logs
    // We assert that there are no uncaught ReferenceError, TypeError or SyntaxError instances.
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|TypeError|SyntaxError/.test(String(e))
    );
    // If any such errors exist, we fail the test and include diagnostic output in attachments (handled in afterEach)
    expect(criticalErrors.length).toBe(0);

    // Also assert that console did not contain error severity logs
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
  });
});