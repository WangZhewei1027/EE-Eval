import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3be790-d360-11f0-b42e-71f0e7238799.html';

// Page Object for the BFS visualization page
class BFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickStart() {
    await this.page.click('#startBFS');
  }

  // Returns array of textContent of all .node elements
  async getNodeTexts() {
    return this.page.$$eval('.node', nodes => nodes.map(n => n.textContent.trim()));
  }

  // Number of .node elements
  async countNodes() {
    return this.page.$$eval('.node', nodes => nodes.length);
  }

  // Number of elements with class 'visited'
  async countVisitedNodes() {
    return this.page.$$eval('.node.visited', nodes => nodes.length);
  }

  // Wait until a specific node label has at least one DOM element marked visited
  async waitForNodeVisited(label, timeout = 5000) {
    await this.page.waitForFunction(
      (lbl) => {
        const nodes = Array.from(document.querySelectorAll('.node'));
        return nodes.some(n => n.textContent.trim() === lbl && n.classList.contains('visited'));
      },
      label,
      { timeout }
    );
  }

  // Wait until number of visited node elements equals expectedCount
  async waitForVisitedCount(expectedCount, timeout = 15000) {
    await this.page.waitForFunction(
      (expected) => {
        return document.querySelectorAll('.node.visited').length >= expected;
      },
      expectedCount,
      { timeout }
    );
  }

  // Returns mapping of label -> count of DOM nodes with that label
  async getNodeLabelCounts() {
    return this.page.$$eval('.node', nodes => {
      return nodes.reduce((acc, n) => {
        const txt = n.textContent.trim();
        acc[txt] = (acc[txt] || 0) + 1;
        return acc;
      }, {});
    });
  }
}

test.describe('BFS Visualization - FSM states and transitions', () => {
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // noop - hooks above reset arrays per test
  });

  test('Initial Idle state: Start button present and graph is empty (S0_Idle)', async ({ page }) => {
    // Validate initial Idle state: start button exists and no nodes rendered
    const bfs = new BFSPage(page);
    await bfs.goto();

    // The Start BFS button should be visible
    const startButton = await page.$('#startBFS');
    expect(startButton).not.toBeNull();

    // Graph container exists
    const graphDiv = await page.$('#graph');
    expect(graphDiv).not.toBeNull();

    // Initially there should be no .node elements (graph not created)
    const nodeCount = await bfs.countNodes();
    expect(nodeCount).toBe(0);

    // No runtime errors expected during initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S0 -> S1 transition on StartBFS: createGraph() creates nodes (S1_GraphCreated)', async ({ page }) => {
    // This test validates that clicking Start BFS triggers createGraph() and DOM nodes are created
    const bfs = new BFSPage(page);
    await bfs.goto();

    // Click start should synchronously create DOM nodes
    await bfs.clickStart();

    // createGraph is synchronous - nodes should appear immediately
    // Expect 6 unique node labels A-F
    const nodeTexts = await bfs.getNodeTexts();
    const uniqueLabels = Array.from(new Set(nodeTexts)).sort();
    expect(uniqueLabels).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);

    // There should be exactly 6 .node elements after first click
    expect(nodeTexts.length).toBe(6);

    // Ensure edges containers were added (graph children should be pairs of node + edges)
    const graphChildrenCount = await page.$eval('#graph', g => g.children.length);
    // createGraph appends 2 elements per graph node (nodeDiv + edgesDiv)
    expect(graphChildrenCount).toBe(6 * 2);

    // No runtime errors during creation
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S1 -> S2 transition: BFS starts and first node A becomes visited (S2_BFSInProgress)', async ({ page }) => {
    // This test validates bfs('A') is invoked and node A receives .visited class as BFS progresses
    const bfs = new BFSPage(page);
    await bfs.goto();

    // Start BFS: this will call createGraph() and then start setInterval-driven BFS
    await bfs.clickStart();

    // Wait for node 'A' to be marked visited (first tick at ~1s). Allow margin.
    await bfs.waitForNodeVisited('A', 4000);

    // Assert at least one node is visited
    const visitedCount = await bfs.countVisitedNodes();
    expect(visitedCount).toBeGreaterThanOrEqual(1);

    // Ensure A is among visited labels
    const visitedLabels = await page.$$eval('.node.visited', nodes => nodes.map(n => n.textContent.trim()));
    expect(visitedLabels).toContain('A');

    // No runtime errors observed so far
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S2 -> S3 transition: BFS completes and all logical nodes are visited (S3_Completed)', async ({ page }) => {
    // This test validates that BFS completes (clearInterval called internally) and all nodes become visited
    const bfs = new BFSPage(page);
    await bfs.goto();

    await bfs.clickStart();

    // Wait until all 6 node elements are marked visited. BFS visits one unique label per second,
    // total unique nodes 6 -> allow generous timeout.
    await bfs.waitForVisitedCount(6, 15000);

    // Confirm all unique node labels are visited (A-F)
    const visitedLabels = Array.from(new Set(await page.$$eval('.node.visited', nodes => nodes.map(n => n.textContent.trim())))).sort();
    expect(visitedLabels).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);

    // Confirm number of visited DOM elements equals number of .node elements (should be 6)
    const totalNodes = await bfs.countNodes();
    const totalVisited = await bfs.countVisitedNodes();
    expect(totalNodes).toBe(6);
    expect(totalVisited).toBe(6);

    // After completion, no unhandled page errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Clicking Start BFS twice creates duplicate nodes and BFS still marks duplicates (idempotency/duplicate creation)', async ({ page }) => {
    // This test validates behavior when Start BFS is clicked multiple times (S0->S1 repeated)
    const bfs = new BFSPage(page);
    await bfs.goto();

    // First click: create graph and start BFS
    await bfs.clickStart();

    // Immediately click again to simulate duplicate creation (could happen in UI)
    await bfs.clickStart();

    // After two clicks, we expect duplicate DOM nodes: 2 * 6 = 12 .node elements
    // createGraph runs synchronously on each click
    const nodeCountAfterDoubleClick = await bfs.countNodes();
    expect(nodeCountAfterDoubleClick).toBe(12);

    // Confirm label counts show duplicates (each label should have count 2)
    const labelCounts = await bfs.getNodeLabelCounts();
    const expectedLabels = ['A', 'B', 'C', 'D', 'E', 'F'];
    for (const lbl of expectedLabels) {
      // If label not present it will be undefined -> fail
      expect(labelCounts[lbl]).toBeDefined();
      // Each label should appear twice due to duplicate creation
      expect(labelCounts[lbl]).toBe(2);
    }

    // Because BFS marks DOM nodes by matching textContent, duplicates should both be marked visited
    // Wait until all 12 DOM nodes are visited (BFS visits unique labels but marks all matching DOM nodes)
    await bfs.waitForVisitedCount(12, 20000);

    const finalVisited = await bfs.countVisitedNodes();
    expect(finalVisited).toBe(12);

    // No runtime errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Robustness: No unexpected runtime errors (console or uncaught page errors) during typical flows', async ({ page }) => {
    // This test repeatedly triggers flows and ensures no page errors are thrown
    const bfs = new BFSPage(page);
    await bfs.goto();

    // Perform a sequence of actions: start, wait a bit, reload, start again
    await bfs.clickStart();

    // Wait for at least the first node to be visited
    await bfs.waitForNodeVisited('A', 4000);

    // Reload the page to reset environment
    await page.reload();

    // Start again after reload
    await bfs.clickStart();

    // Wait until BFS marks at least the first node again
    await bfs.waitForNodeVisited('A', 4000);

    // Collect final console/page errors and assert none occurred during these operations
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenario observation: Capture any ReferenceError/TypeError/SyntaxError occurrences if they happen', async ({ page }) => {
    // The application code is expected to run without throwing these errors.
    // This test purposefully does not mutate the environment; it only observes and asserts that errors did not spontaneously occur.
    // It also documents any errors captured for debugging if they exist.
    const bfs = new BFSPage(page);
    await bfs.goto();

    // Trigger the normal flow
    await bfs.clickStart();

    // Wait a short while to allow any asynchronous errors to surface
    await page.waitForTimeout(2500);

    // If any page errors occurred, fail the test with details; otherwise pass.
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      // Provide detailed failure message for easier debugging
      const consoleErrText = consoleErrors.map(e => e.text).join('\n---\n');
      const pageErrText = pageErrors.map(e => e.toString()).join('\n---\n');
      throw new Error(
        `Runtime errors observed!\nConsole errors:\n${consoleErrText || '<none>'}\n\nPage errors:\n${pageErrText || '<none>'}`
      );
    }

    // Assert none observed
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});