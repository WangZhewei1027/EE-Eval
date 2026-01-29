import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2e7281-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object for the DFS demo page
class DfsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      addNode: page.locator('#add-node'),
      addEdge: page.locator('#add-edge'),
      clearGraph: page.locator('#clear-graph'),
      startDfs: page.locator('#start-dfs'),
      stepDfs: page.locator('#step-dfs'),
      resetDfs: page.locator('#reset-dfs'),
      startNodeSelect: page.locator('#start-node'),
      speed: page.locator('#speed'),
      stackDisplay: page.locator('#stack-display'),
      log: page.locator('#log'),
      loadTree: page.locator('#load-tree'),
      loadDag: page.locator('#load-dag'),
      loadCyclic: page.locator('#load-cyclic'),
      showVisitOrder: page.locator('#show-visit-order'),
      showParents: page.locator('#show-parents'),
      graphContainer: page.locator('#graph-container'),
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // ensure initial script executed
    await this.page.waitForTimeout(100);
  }

  // Utility: count nodes in graph data structure
  async getGraphNodesCount() {
    return await this.page.evaluate(() => graph.nodes.length);
  }

  async getGraphEdgesCount() {
    return await this.page.evaluate(() => graph.edges.length);
  }

  async isDfsRunning() {
    return await this.page.evaluate(() => !!dfsState.running);
  }

  async getDfsStack() {
    return await this.page.evaluate(() => dfsState.stack.slice());
  }

  async getDfsVisited() {
    return await this.page.evaluate(() => Array.from(dfsState.visited));
  }

  async getDfsVisitOrder() {
    return await this.page.evaluate(() => dfsState.visitOrder.slice());
  }

  async getLogsText() {
    return await this.locators.log.innerText();
  }

  async addNode() {
    await this.locators.addNode.click();
    // small wait to allow DOM updates and logs
    await this.page.waitForTimeout(50);
  }

  async clearGraph() {
    await this.locators.clearGraph.click();
    await this.page.waitForTimeout(50);
  }

  async clickStartDfs() {
    await this.locators.startDfs.click();
    await this.page.waitForTimeout(50);
  }

  async clickStepDfs() {
    await this.locators.stepDfs.click();
    await this.page.waitForTimeout(50);
  }

  async clickResetDfs() {
    await this.locators.resetDfs.click();
    await this.page.waitForTimeout(50);
  }

  async loadBinaryTree() {
    await this.locators.loadTree.click();
    await this.page.waitForTimeout(50);
  }

  async loadDAG() {
    await this.locators.loadDag.click();
    await this.page.waitForTimeout(50);
  }

  async loadCyclic() {
    await this.locators.loadCyclic.click();
    await this.page.waitForTimeout(50);
  }

  async setSpeed(value) {
    // set input value and dispatch input event so page script reacts
    await this.page.evaluate((v) => {
      const slider = document.getElementById('speed');
      slider.value = v;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
    await this.page.waitForTimeout(50);
  }

  async clickNodeById(nodeId) {
    const selector = `#node-${nodeId}`;
    const el = this.page.locator(selector);
    await expect(el).toBeVisible();
    await el.click();
    await this.page.waitForTimeout(50);
  }

  async addEdgeBetween(nodeA, nodeB) {
    // Activate edge-creation mode by adding 'active' class to the button.
    // Tests may manipulate DOM class to simulate the user enabling edge selection mode.
    await this.page.evaluate(() => {
      document.getElementById('add-edge').classList.add('active');
    });
    // Click the nodes to select them in selection mode
    await this.clickNodeById(nodeA);
    await this.clickNodeById(nodeB);
    // Now click the add-edge button (its click handler will check selectedNodes length)
    await this.locators.addEdge.click();
    // remove 'active' after attempting to add edge
    await this.page.evaluate(() => {
      document.getElementById('add-edge').classList.remove('active');
    });
    await this.page.waitForTimeout(50);
  }

  async getStartNodeOptions() {
    return await this.page.evaluate(() => {
      const sel = document.getElementById('start-node');
      return Array.from(sel.options).map(o => o.value);
    });
  }

  async getStackDisplayText() {
    return await this.locators.stackDisplay.innerText();
  }
}

test.describe('DFS Interactive Demo - FSM and UI tests', () => {
  // Collect console errors and page errors for each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async () => {
    // Ensure there were no uncaught page errors or console errors during the test
    expect(pageErrors.length, `No uncaught page errors should occur`).toBe(0);
    expect(consoleErrors.length, `No console.error messages should appear`).toBe(0);
  });

  test('Initial state should be Idle with empty graph and DFS not running', async ({ page }) => {
    // Validate S0_Idle entry evidence: graph.nodes.length === 0 and dfsState.running === false
    const app = new DfsPage(page);
    await app.goto();

    // Check graph model is empty
    const nodesCount = await app.getGraphNodesCount();
    expect(nodesCount).toBe(0);

    // Check DFS is not running
    const running = await app.isDfsRunning();
    expect(running).toBe(false);

    // Stack display should be empty / minimal
    const stackText = await app.getStackDisplayText();
    expect(stackText).toContain('DFS Stack');
    // No nodes displayed in the graph container
    const graphChildren = await page.locator('#graph-container').locator('.node').count();
    expect(graphChildren).toBe(0);
  });

  test('Add Node updates graph model, UI, and start-node select', async ({ page }) => {
    // Validate AddNode event: clicking Add Node adds a node and updates start-node select
    const app = new DfsPage(page);
    await app.goto();

    // Add a node
    await app.addNode();

    const nodesCountAfter = await app.getGraphNodesCount();
    expect(nodesCountAfter).toBe(1);

    // There should be a visible node element
    const nodeElements = await page.locator('#graph-container .node').count();
    expect(nodeElements).toBe(1);

    // Start node select should contain the new node id (N1)
    const options = await app.getStartNodeOptions();
    expect(options.length).toBeGreaterThanOrEqual(1);
    expect(options[0]).toBeDefined();

    // The log should contain a message about adding the node
    const logs = await app.getLogsText();
    expect(logs).toContain('Added node');
  });

  test('Clear Graph transition leads to empty graph and reset DFS', async ({ page }) => {
    // Validate ClearGraph transition from S0_Idle to S3_Graph_Cleared
    const app = new DfsPage(page);
    await app.goto();

    // Add two nodes first to ensure clear action is meaningful
    await app.addNode();
    await app.addNode();
    let count = await app.getGraphNodesCount();
    expect(count).toBeGreaterThanOrEqual(2);

    // Clear the graph
    await app.clearGraph();

    // Graph model should be empty
    count = await app.getGraphNodesCount();
    expect(count).toBe(0);

    // DFS state should be reset and not running
    const running = await app.isDfsRunning();
    expect(running).toBe(false);

    // Log should include "Graph cleared"
    const logs = await app.getLogsText();
    expect(logs).toContain('Graph cleared');
  });

  test('Start DFS without nodes should show "No nodes in graph" message', async ({ page }) => {
    // Edge case: attempting to start DFS on empty graph
    const app = new DfsPage(page);
    await app.goto();

    // Ensure graph empty
    await app.clearGraph();

    // Click Start
    await app.clickStartDfs();

    // Expect log to show message about no nodes
    const logs = await app.getLogsText();
    expect(logs).toContain('No nodes in graph');

    // DFS should remain not running
    const running = await app.isDfsRunning();
    expect(running).toBe(false);
  });

  test('Load binary tree and run DFS to completion using Step (test S0->S1->S2)', async ({ page }) => {
    // Validate S1_DFS_Running entry action and S2_DFS_Completed exit when stack empty
    const app = new DfsPage(page);
    await app.goto();

    // Load the binary tree (7 nodes)
    await app.loadBinaryTree();
    let nodesCount = await app.getGraphNodesCount();
    expect(nodesCount).toBe(7);

    // Set speed very large to avoid the automatic interval stepping interfering with manual steps
    await app.setSpeed(2000);

    // Start DFS
    await app.clickStartDfs();

    // After starting, engine should be in running state
    let running = await app.isDfsRunning();
    expect(running).toBe(true);

    // Ensure stack is not empty (start node pushed)
    let stack = await app.getDfsStack();
    expect(stack.length).toBeGreaterThanOrEqual(1);

    // Manually step until DFS completes. Loop with timeout to avoid flakiness.
    const maxSteps = 100;
    let steps = 0;
    // We purposely avoid altering page functions; we're simulating user Step clicks.
    while (steps < maxSteps) {
      // Break if DFS already reports not running and stack empty
      const isRunning = await app.isDfsRunning();
      const currentStack = await app.getDfsStack();
      if (!isRunning && currentStack.length === 0) break;

      // Click Step to drive the algorithm
      await app.clickStepDfs();
      steps++;
      // small pause to allow updates
      await page.waitForTimeout(30);
    }

    // After stepping, DFS should be completed
    running = await app.isDfsRunning();
    expect(running).toBe(false);

    // Stack should be empty
    const finalStack = await app.getDfsStack();
    expect(finalStack.length).toBe(0);

    // Log should contain "DFS completed"
    const logs = await app.getLogsText();
    expect(logs).toContain('DFS completed');
  }, { timeout: 30000 });

  test('Reset DFS while running should stop DFS and clear state (S1->S0 transition)', async ({ page }) => {
    // Validate transition from running to idle when ResetDFS is invoked
    const app = new DfsPage(page);
    await app.goto();

    // Load a simple graph and start
    await app.loadBinaryTree();
    await app.setSpeed(2000); // slow auto-interval
    await app.clickStartDfs();

    // Ensure running
    let running = await app.isDfsRunning();
    expect(running).toBe(true);

    // Click Reset
    await app.clickResetDfs();

    // DFS should no longer be running
    running = await app.isDfsRunning();
    expect(running).toBe(false);

    // Logs should contain "DFS reset"
    const logs = await app.getLogsText();
    expect(logs).toContain('DFS reset');
  });

  test('Add Edge flow: selecting nodes and adding an edge (edge-case: enabling selection mode)', async ({ page }) => {
    // Test AddEdge event - to make node selection possible we simulate enabling selection mode by adding 'active' class
    const app = new DfsPage(page);
    await app.goto();

    // Clear and add two nodes
    await app.clearGraph();
    await app.addNode(); // N1
    await app.addNode(); // N2

    const nodesCount = await app.getGraphNodesCount();
    expect(nodesCount).toBe(2);

    // Start-node select should include N1 and N2
    const options = await app.getStartNodeOptions();
    expect(options.length).toBe(2);

    // Add an edge between N1 and N2 by enabling selection mode (simulate UI toggling)
    // This action manipulates only the class attribute to simulate user toggling the 'add-edge' mode.
    await app.addEdgeBetween('N1', 'N2');

    // Verify an edge was added to the graph data model
    const edgesCount = await app.getGraphEdgesCount();
    expect(edgesCount).toBe(1);

    // Log should mention the added edge
    const logs = await app.getLogsText();
    expect(logs).toContain('Added edge from N1 to N2');
  });

  test('Load DAG and Load Cyclic graph UI checks and DFS interactions', async ({ page }) => {
    // Validate both load DAG and load cyclic graph buttons and subsequent properties
    const app = new DfsPage(page);
    await app.goto();

    // Load DAG
    await app.loadDAG();
    let nodesCount = await app.getGraphNodesCount();
    expect(nodesCount).toBe(6); // as defined in the implementation

    // Start-node select should have values matching the DAG nodes
    let options = await app.getStartNodeOptions();
    expect(options.length).toBe(6);

    // Clear then load cyclic graph
    await app.clearGraph();
    await app.loadCyclic();
    nodesCount = await app.getGraphNodesCount();
    expect(nodesCount).toBe(5);

    options = await app.getStartNodeOptions();
    expect(options.length).toBe(5);

    // Start DFS on cyclic graph but step a few times to ensure no immediate crash on cycles
    await app.setSpeed(2000);
    await app.clickStartDfs();

    // Let it process a couple of steps manually to ensure cycle handling works without errors
    await app.clickStepDfs();
    await app.clickStepDfs();

    // DFS should still be in a valid state (not throwing) and visited set should have some entries
    const visitOrder = await app.getDfsVisitOrder();
    expect(visitOrder.length).toBeGreaterThanOrEqual(1);
  });

  test('UI check: toggling visit order and parents displays correct information', async ({ page }) => {
    // Verify show-visit-order and show-parents checkboxes influence the displays
    const app = new DfsPage(page);
    await app.goto();

    await app.loadBinaryTree();
    await app.setSpeed(2000);
    await app.clickStartDfs();

    // Step a few nodes
    await app.clickStepDfs();
    await app.clickStepDfs();

    // Toggle show visit order
    await page.locator('#show-visit-order').check();
    await page.waitForTimeout(50);
    const visitOrderText = await page.locator('#visit-order').innerText();
    expect(visitOrderText.length).toBeGreaterThan(0);

    // Toggle show parents
    await page.locator('#show-parents').check();
    await page.waitForTimeout(50);
    const parentsText = await page.locator('#parent-relationships').innerText();
    expect(parentsText.length).toBeGreaterThan(0);

    // Uncheck to ensure clearing works
    await page.locator('#show-visit-order').uncheck();
    await page.locator('#show-parents').uncheck();
    await page.waitForTimeout(50);
    const visitOrderEmpty = await page.locator('#visit-order').innerText();
    const parentsEmpty = await page.locator('#parent-relationships').innerText();
    expect(visitOrderEmpty).toBe('');
    expect(parentsEmpty).toBe('');
  });
});