import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f180a431-d366-11f0-9b19-a558354ece3e.html';

// Page object for interacting with the graph app DOM
class GraphPage {
  constructor(page) {
    this.page = page;
  }

  // Selectors
  addNodeButton() { return this.page.locator("button[onclick='addNode()']"); }
  addEdgeButton() { return this.page.locator("button[onclick='addEdge()']"); }
  findShortestPathButton() { return this.page.locator("button[onclick='findShortestPath()']"); }
  clearGraphButton() { return this.page.locator("button[onclick='clearGraph()']"); }
  generateRandomGraphButton() { return this.page.locator("button[onclick='generateRandomGraph()']"); }
  svgCanvas() { return this.page.locator('#graph-canvas'); }
  graphInfo() { return this.page.locator('#graph-info'); }
  shortestPathInfo() { return this.page.locator('#shortest-path'); }
  circles() { return this.page.locator('svg #graph-canvas circle.node, #graph-canvas circle.node, circle.node'); }

  // Click helpers
  async clickAddNode() { await this.addNodeButton().click(); }
  async clickAddEdge() { await this.addEdgeButton().click(); }
  async clickFindShortestPath() { await this.findShortestPathButton().click(); }
  async clickClearGraph() { await this.clearGraphButton().click(); }
  async clickGenerateRandomGraph() { await this.generateRandomGraphButton().click(); }

  async clickSvgAtCenter() {
    const box = await this.svgCanvas().boundingBox();
    if (!box) throw new Error('SVG bounding box not available');
    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  }
}

test.describe('Weighted Graph Visualization - FSM and error observation', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors and console messages for assertions
    page.on('pageerror', (err) => {
      // Capture the PageError object for assertions
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  // Idle state tests
  test('Idle state: initial DOM elements are present and runtime error occurs on load', async ({ page }) => {
    const gp = new GraphPage(page);

    // Validate that control buttons exist and have expected text (Idle state's evidence)
    await expect(gp.addNodeButton()).toBeVisible();
    await expect(gp.addEdgeButton()).toBeVisible();
    await expect(gp.findShortestPathButton()).toBeVisible();
    await expect(gp.clearGraphButton()).toBeVisible();
    await expect(gp.generateRandomGraphButton()).toBeVisible();

    // Validate static info elements present
    await expect(gp.svgCanvas()).toBeVisible();
    await expect(gp.graphInfo()).toHaveText(/Nodes: 0, Edges: 0/);
    await expect(gp.shortestPathInfo()).toHaveText('Shortest path will appear here');

    // The implementation contains a ReferenceError during initialization (svvgElement typo).
    // Assert that at least one pageerror occurred during page load and that it is a ReferenceError.
    expect(pageErrors.length).toBeGreaterThan(0);
    const hasReferenceError = pageErrors.some(e => e.name === 'ReferenceError' || /ReferenceError/i.test(String(e)));
    expect(hasReferenceError).toBeTruthy();

    // Also check that console captured some messages (helpful for debugging)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  // AddingNode transition tests
  test('Transition: S0_Idle -> S1_AddingNode (click Add Node) results in runtime error due to missing runtime setup', async ({ page }) => {
    const gp = new GraphPage(page);

    // Clicking the "Add Node" button will invoke an inline onclick that expects functions defined by the script.
    // Because the script failed during initialization, the function is likely not defined and will throw.
    const initialErrorCount = pageErrors.length;

    // Perform click and wait for a new pageerror to be emitted (ReferenceError expected)
    await gp.addNodeButton().click();
    const newError = await page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);
    expect(newError).not.toBeNull();
    // It should be a ReferenceError related to addNode or renderer
    expect(newError.name).toBe('ReferenceError');
    expect(String(newError.message)).toMatch(/addNode|renderer|svvgElement|is not defined/i);
  });

  // AddingEdge transition tests
  test('Transition: S0_Idle -> S2_AddingEdge (click Add Edge) results in runtime error', async ({ page }) => {
    const gp = new GraphPage(page);

    const initialErrorCount = pageErrors.length;
    await gp.addEdgeButton().click();
    const newError = await page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);
    expect(newError).not.toBeNull();
    expect(newError.name).toBe('ReferenceError');
    // addEdge function or renderer is expected to be missing due to earlier script error
    expect(String(newError.message)).toMatch(/addEdge|renderer|is not defined/i);
  });

  // FindingShortestPath transition tests
  test('Transition: S0_Idle -> S3_FindingShortestPath (click Find Shortest Path) results in runtime error', async ({ page }) => {
    const gp = new GraphPage(page);

    await gp.findShortestPathButton().click();
    const newError = await page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);
    // Because the script did not complete, the function may not be defined -> expect ReferenceError
    expect(newError).not.toBeNull();
    expect(newError.name).toBe('ReferenceError');
    expect(String(newError.message)).toMatch(/findShortestPath|renderer|is not defined/i);
  });

  // ClearingGraph transition tests
  test('Transition: S0_Idle -> S4_ClearingGraph (click Clear Graph) results in runtime error or no-op depending on script state', async ({ page }) => {
    const gp = new GraphPage(page);

    // Even if clearGraph isn't defined, the static DOM initially says Nodes: 0, Edges: 0
    const beforeInfo = await gp.graphInfo().innerText();
    await gp.clearGraphButton().click();
    // If clearGraph isn't defined, a ReferenceError is expected
    const newError = await page.waitForEvent('pageerror', { timeout: 1000 }).catch(() => null);
    if (newError) {
      expect(newError.name).toBe('ReferenceError');
      expect(String(newError.message)).toMatch(/clearGraph|renderer|is not defined/i);
    } else {
      // Otherwise ensure no changes happened to the static DOM
      const afterInfo = await gp.graphInfo().innerText();
      expect(afterInfo).toBe(beforeInfo);
    }
  });

  // GeneratingRandomGraph transition tests
  test('Transition: S0_Idle -> S5_GeneratingRandomGraph (click Generate Random Graph) results in runtime error', async ({ page }) => {
    const gp = new GraphPage(page);

    await gp.generateRandomGraphButton().click();
    const newError = await page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);
    expect(newError).not.toBeNull();
    expect(newError.name).toBe('ReferenceError');
    expect(String(newError.message)).toMatch(/generateRandomGraph|renderer|is not defined/i);
  });

  // NodeClick event tests
  test('Event: NodeClick - no nodes rendered due to initialization error; clicking SVG does not create nodes', async ({ page }) => {
    const gp = new GraphPage(page);

    // There should be no nodes rendered because the renderer failed; verify circles count is zero
    const circleCountBefore = await gp.circles().count().catch(() => 0);
    expect(circleCountBefore).toBe(0);

    // Click the SVG canvas - normally this would add a node when renderer is present.
    // Because the event listener was not attached (script failed), clicking should not change graph-info and should not create new nodes.
    const beforeInfo = await gp.graphInfo().innerText();
    await gp.clickSvgAtCenter();

    // Wait briefly to ensure no asynchronous changes occur
    await page.waitForTimeout(300);

    const afterInfo = await gp.graphInfo().innerText();
    expect(afterInfo).toBe(beforeInfo);

    // Ensure no new pageerror was emitted due to this user action
    const svgClickError = pageErrors.find(e => /addNode|renderer|is not defined/i.test(String(e.message)));
    // It is acceptable if there was already an earlier error, but clicking SVG should NOT produce a new ReferenceError because the SVG click listener wasn't set.
    // We assert that no additional pageerror was added in response to this click by checking there's no very recent pageerror
    // Since we can't reliably timestamp errors, assert that circle count remains zero and info unchanged (primary indicators).
    const circleCountAfter = await gp.circles().count().catch(() => 0);
    expect(circleCountAfter).toBe(0);
  });

  // Combined scenario: Attempt AddEdge then NodeClick to exercise the S2 -> S0 transition (will surface errors)
  test('Transition path: S2_AddingEdge -> NodeClick (attempt to add edge) surfaces runtime errors when runtime not initialized', async ({ page }) => {
    const gp = new GraphPage(page);

    // Try to enter "Adding Edge" via UI
    await gp.addEdgeButton().click();
    const addEdgeError = await page.waitForEvent('pageerror', { timeout: 2000 }).catch(() => null);
    expect(addEdgeError).not.toBeNull();
    expect(addEdgeError.name).toBe('ReferenceError');
    expect(String(addEdgeError.message)).toMatch(/addEdge|renderer|is not defined/i);

    // If a circle existed and the system had been functional, clicking it would complete the edge creation.
    // Here no circles exist; assert that there are zero node elements and that clicking a (nonexistent) node is a no-op.
    const count = await gp.circles().count().catch(() => 0);
    expect(count).toBe(0);
  });

  // Ensure that the runtime errors captured include the expected ReferenceError due to the svvgElement typo
  test('Implementation bug detection: ensure ReferenceError mentions svvgElement from constructor typo', async ({ page }) => {
    // At least one of the page errors that occurred during load should reference the svvgElement typo
    const containsSvvg = pageErrors.some(e => /svvgElement/i.test(String(e.message)));
    // Because runtime may report message variations, also accept "svvg" substring.
    const containsSvvgShort = pageErrors.some(e => /svvg/i.test(String(e.message)));
    expect(containsSvvg || containsSvvgShort).toBeTruthy();
  });
});