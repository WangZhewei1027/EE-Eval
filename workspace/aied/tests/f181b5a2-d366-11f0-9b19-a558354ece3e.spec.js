import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f181b5a2-d366-11f0-9b19-a558354ece3e.html';

// Page Object encapsulating common interactions and queries for the app
class BellmanFordPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    // capture console messages
    this.page.on('console', msg => {
      // store console entries for later assertions
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    // capture uncaught page errors
    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  async initializeGraph() {
    await this.page.click("button[onclick='initializeGraph()']");
  }

  async runBellmanFord() {
    await this.page.click("button[onclick='runBellmanFord()']");
  }

  async stepForward() {
    await this.page.click("button[onclick='stepForward()']");
  }

  async reset() {
    await this.page.click("button[onclick='reset()']");
  }

  async setGraphInput(value) {
    const handle = await this.page.$('#graphInput');
    await handle.fill(value);
  }

  async setNodeCount(n) {
    const handle = await this.page.$('#nodeCount');
    await handle.fill(String(n));
  }

  async setStartNode(n) {
    const handle = await this.page.$('#startNode');
    await handle.fill(String(n));
  }

  async getStepInfoText() {
    const el = await this.page.$('#stepInfo');
    return (await el.innerHTML()).trim();
  }

  async getAlgorithmOutputText() {
    const el = await this.page.$('#algorithmOutput');
    return (await el.innerHTML()).trim();
  }

  async getNodeDivCount() {
    // nodes are rendered as divs with class 'node' inside #graphElements
    const nodes = await this.page.$$('#graphElements .node');
    return nodes.length;
  }

  async getWeightDivCount() {
    const weights = await this.page.$$('#graphElements .weight');
    return weights.length;
  }

  async waitForResults(timeout = 3000) {
    // wait until algorithmOutput has content (displayResults writes to it)
    await this.page.waitForFunction(() => {
      const out = document.getElementById('algorithmOutput');
      return out && out.innerHTML.trim().length > 0;
    }, null, { timeout });
  }

  // helper to step forward N times
  async stepNTimes(n, delay = 0) {
    for (let i = 0; i < n; i++) {
      await this.stepForward();
      if (delay > 0) await this.page.waitForTimeout(delay);
    }
  }
}

test.describe('Bellman-Ford Visualization - FSM state & transitions', () => {
  let app;

  test.beforeEach(async ({ page }) => {
    app = new BellmanFordPage(page);
    // Load the application page fresh for each test
    await app.goto();
    // Give the onload initializeGraph some time to run and render
    await page.waitForTimeout(100);
  });

  test.afterEach(async ({ page }) => {
    // Friendly assertions on console and page errors recorded during the test.
    // We assert no uncaught page errors occurred.
    // If any errors surfaced, fail the test showing them.
    if (app.pageErrors.length > 0) {
      // rethrow first page error to make failure visible in traces
      throw app.pageErrors[0];
    }
    // Additional lightweight check: no severe console messages of type 'error'
    const errors = app.consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
    // Close page handled by Playwright test runner automatically
  });

  test.describe('Initial state S0_Idle and Graph Initialization S1_GraphInitialized', () => {
    test('on load the app should call initializeGraph() and show Graph Initialized (S0 -> S1)', async () => {
      // When the page loads, window.onload should have invoked initializeGraph.
      const stepInfo = await app.getStepInfoText();
      // The stepInfo content set in initializeGraph includes "Graph Initialized"
      expect(stepInfo).toContain('Graph Initialized');
      // Verify node elements were created for default nodeCount (4)
      const nodeCount = await app.getNodeDivCount();
      expect(nodeCount).toBeGreaterThanOrEqual(4);
      // Verify weight labels match edges loaded from default textarea (5 edges)
      const weightCount = await app.getWeightDivCount();
      expect(weightCount).toBeGreaterThanOrEqual(5);
    });

    test('InitializeGraph button transition re-initializes graph and updates distances', async () => {
      // Modify graph input to a small graph and initialize
      const customGraph = `0,1,5
1,2,3`;
      await app.setGraphInput(customGraph);
      await app.setNodeCount(3);
      await app.setStartNode(0);
      await app.initializeGraph();

      const stepInfo = await app.getStepInfoText();
      expect(stepInfo).toContain('Graph Initialized');
      expect(stepInfo).toContain('Nodes: 3');
      expect(stepInfo).toContain('Edges: 2');
      expect(stepInfo).toContain('Start Node: 0');

      // node visuals should equal nodeCount
      const nodes = await app.getNodeDivCount();
      expect(nodes).toBe(3);
    });
  });

  test.describe('Running algorithm S2_BellmanFordRunning and Stepping S3_SteppingForward', () => {
    test('Run Bellman-Ford should compute distances and display results (S1 -> S2 -> S4)', async () => {
      // Ensure a known graph (default) then run algorithm
      await app.runBellmanFord();

      // After running, displayResults() should populate algorithmOutput
      await app.waitForResults(2000);
      const output = await app.getAlgorithmOutputText();
      expect(output).toContain('Algorithm Results:');
      // For the default sample graph there should be no negative cycle message
      expect(output).toContain('No negative cycles detected');
      // Table rows for nodes exist (node count 4 default)
      expect(output).toMatch(/<tr><td>0<\/td>/);
      expect(output).toMatch(/<tr><td>3<\/td>/);
    });

    test('Step Forward iterates through edges and eventually displays results (S2 -> S3 -> S4)', async () => {
      // Use default graph loaded on page load; read counts to compute totalSteps
      const nodeCountValue = await (await app.page.$('#nodeCount')).inputValue();
      const nodeCount = parseInt(nodeCountValue, 10);
      const graphInput = await (await app.page.$('#graphInput')).inputValue();
      const graphLines = graphInput.trim().split('\n').filter(Boolean);
      const totalSteps = nodeCount * graphLines.length;

      // Reset to ensure stepping starts from fresh state
      await app.initializeGraph();

      // Step forward totalSteps times - each step updates stepInfo, last step triggers displayResults
      await app.stepNTimes(totalSteps, 10);

      // Wait for results
      await app.waitForResults(2000);
      const out = await app.getAlgorithmOutputText();
      expect(out).toContain('Algorithm Results:');
      // When no negative cycles exist, the green message should appear
      expect(out).toContain('No negative cycles detected');
    });

    test('Step Forward shows per-step update messages and UPDATE line when relaxation happens', async () => {
      // Use a small custom graph where relaxation will definitely happen in early steps
      const customGraph = `0,1,10
0,2,5
1,2,-6`; // this will update d[2] via 0->2 and/or 1->2 depending
      await app.setGraphInput(customGraph);
      await app.setNodeCount(3);
      await app.setStartNode(0);
      await app.initializeGraph();

      // total steps
      const totalSteps = 3 * 3; // nodeCount * edges
      // perform a few steps and assert the stepInfo contains "Processing edge" and possibly "UPDATE"
      await app.stepForward(); // step 1
      let info = await app.getStepInfoText();
      expect(info).toMatch(/Processing edge:/);
      // Keep stepping to hit an UPDATE
      let sawUpdate = info.includes('UPDATE') || false;
      for (let i = 1; i < totalSteps && !sawUpdate; i++) {
        await app.stepForward();
        info = await app.getStepInfoText();
        sawUpdate = info.includes('UPDATE');
      }
      expect(sawUpdate).toBe(true);

      // finish to results
      await app.stepNTimes(totalSteps, 0);
      await app.waitForResults(2000);
      const out = await app.getAlgorithmOutputText();
      expect(out).toContain('Algorithm Results:');
    });
  });

  test.describe('Negative cycle detection and edge cases', () => {
    test('Detects negative cycle when graph contains one (edge case)', async () => {
      // Create a small graph with a negative cycle: 0->1 (1), 1->2 (-2), 2->0 (-1) sum = -2
      const negCycleGraph = `0,1,1
1,2,-2
2,0,-1`;
      await app.setGraphInput(negCycleGraph);
      await app.setNodeCount(3);
      await app.setStartNode(0);
      await app.initializeGraph();

      // Run the full algorithm
      await app.runBellmanFord();
      await app.waitForResults(2000);
      const output = await app.getAlgorithmOutputText();
      // The output should indicate a negative cycle was detected
      expect(output).toContain('Negative cycle detected');
    });

    test('Handles malformed graph input gracefully (no crashes)', async () => {
      // Provide malformed lines and ensure the app does not crash and still displays results
      const malformed = `not,a,number
0,1,4
garbage
2,3,1`;
      await app.setGraphInput(malformed);
      await app.setNodeCount(4);
      await app.setStartNode(0);
      // Initialize should parse only valid numeric triples and proceed
      await app.initializeGraph();

      // If graph parsing fails silently, ensure no thrown page errors were captured
      expect(app.pageErrors.length).toBe(0);

      // Running the algorithm should still produce results (even if some edges ignored)
      await app.runBellmanFord();
      await app.waitForResults(2000);
      const output = await app.getAlgorithmOutputText();
      expect(output).toContain('Algorithm Results:');
    });
  });

  test.describe('Reset transition S4 -> S1 and UI state checks', () => {
    test('Reset clears results and re-initializes the graph (S4 -> S1)', async () => {
      // Run algorithm first to populate results
      await app.runBellmanFord();
      await app.waitForResults(2000);
      let output = await app.getAlgorithmOutputText();
      expect(output).toContain('Algorithm Results:');

      // Click reset
      await app.reset();
      // After reset, algorithmOutput should be cleared
      const clearedOutput = await app.getAlgorithmOutputText();
      expect(clearedOutput).toBe('');
      // stepInfo should reflect a fresh Graph Initialized state
      const stepInfo = await app.getStepInfoText();
      expect(stepInfo).toContain('Graph Initialized');
    });
  });

  test.describe('Observability: console and page errors', () => {
    test('No uncaught runtime errors or console.error messages during normal usage', async () => {
      // Perform a sequence of interactions to exercise code paths and observe console/page errors
      await app.initializeGraph();
      await app.runBellmanFord();
      await app.stepForward();
      await app.reset();

      // Wait briefly for any asynchronous console/page errors
      await app.page.waitForTimeout(100);

      // Assert there were no uncaught page errors
      expect(app.pageErrors.length).toBe(0);

      // Assert no console messages of severity 'error'
      const consoleErrors = app.consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });
});