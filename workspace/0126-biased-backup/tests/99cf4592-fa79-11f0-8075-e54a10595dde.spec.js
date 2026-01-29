import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf4592-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the PageRank demo
class PageRankPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nodeCountInput = page.locator('#nodeCount');
    this.createGraphButton = page.locator('#createGraph');
    this.calculateButton = page.locator('#calculatePageRank');
    this.graphContainer = page.locator('#graphContainer');
    this.pageRankResults = page.locator('#pageRankResults');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeadingText() {
    return this.header.textContent();
  }

  async getNodeCountValue() {
    return await this.nodeCountInput.inputValue();
  }

  async setNodeCount(value) {
    await this.nodeCountInput.fill(String(value));
    // ensure change is applied
    await this.nodeCountInput.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
  }

  async clickCreateGraph() {
    await this.createGraphButton.click();
  }

  async clickCalculatePageRank() {
    await this.calculateButton.click();
  }

  async getNodeDivs() {
    return this.graphContainer.locator('.node');
  }

  async nodeCountInDOM() {
    return await this.getNodeDivs().count();
  }

  async getLinkInputLocatorForNode(index) {
    return this.getNodeDivs().nth(index).locator('input[placeholder="Link to nodes (comma-sep)"]');
  }

  // Fill the link input for a node and dispatch change to trigger onchange handler
  async setLinksForNode(index, value) {
    const input = this.getLinkInputLocatorForNode(index);
    await input.fill(value);
    // Dispatch change to trigger the inline onchange handler
    await input.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
  }

  async getPageRankResultsText() {
    return (await this.pageRankResults.textContent()) || '';
  }

  // Read the page's runtime 'graph' variable
  async getGraph() {
    return this.page.evaluate(() => window.graph);
  }
}

test.describe('PageRank Interactive Demo - FSM validation (Application ID: 99cf4592-fa79-11f0-8075-e54a10595dde)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate will be done inside tests using the page object
  });

  test.afterEach(async () => {
    // No special teardown required - Playwright handles page context lifecycle
  });

  test.describe('State S0_Idle - Initial render checks', () => {
    test('renders the main heading and initial controls (Idle state entry action: renderPage())', async ({ page }) => {
      // Validate initial UI is present as described by FSM evidence
      const app = new PageRankPage(page);
      await app.goto();

      // Verify heading exists and matches expected text from FSM evidence
      const heading = await app.getHeadingText();
      expect(heading).toBe('Interactive PageRank Demo');

      // Verify nodeCount input default value and attributes
      const nodeCountValue = await app.getNodeCountValue();
      expect(nodeCountValue).toBe('5');

      // Verify Create Graph and Calculate PageRank buttons exist and are visible
      await expect(app.createGraphButton).toBeVisible();
      await expect(app.calculateButton).toBeVisible();

      // Verify there are no console errors or uncaught page errors during initial render
      expect(consoleMessages.filter(m => m.type === 'error')).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Transition S0_Idle -> S1_GraphCreated (CreateGraph event)', () => {
    test('clicking Create Graph creates nodes and link inputs (Graph Created state)', async ({ page }) => {
      const app = new PageRankPage(page);
      await app.goto();

      // Set node count to 4 to test non-default behavior
      await app.setNodeCount(4);
      expect(await app.getNodeCountValue()).toBe('4');

      // Trigger the CreateGraph event
      await app.clickCreateGraph();

      // Verify DOM: graphContainer should contain 4 .node elements each with an input
      const count = await app.nodeCountInDOM();
      expect(count).toBe(4);

      // Verify each node displays the correct text and contains the link input
      for (let i = 0; i < 4; i++) {
        const node = app.getNodeDivs().nth(i);
        await expect(node).toContainText(`Node ${i}`);
        const linkInput = node.locator('input[placeholder="Link to nodes (comma-sep)"]');
        await expect(linkInput).toBeVisible();
      }

      // Verify runtime graph variable was created with correct length and structure
      const runtimeGraph = await app.getGraph();
      expect(Array.isArray(runtimeGraph)).toBe(true);
      expect(runtimeGraph.length).toBe(4);
      for (let i = 0; i < runtimeGraph.length; i++) {
        expect(runtimeGraph[i]).toHaveProperty('id', i);
        expect(runtimeGraph[i]).toHaveProperty('links');
        expect(Array.isArray(runtimeGraph[i].links)).toBe(true);
      }

      // Ensure no uncaught page errors or console errors happened during graph creation
      expect(consoleMessages.filter(m => m.type === 'error')).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Transition S1_GraphCreated -> S1_GraphCreated (LinkInputChange event)', () => {
    test('changing a link input updates the graph.links for that node', async ({ page }) => {
      const app = new PageRankPage(page);
      await app.goto();

      // Create graph with 5 nodes (default)
      await app.clickCreateGraph();
      expect(await app.nodeCountInDOM()).toBe(5);

      // Set links for node 0 to "1,2" and trigger change
      await app.setLinksForNode(0, '1,2');

      // Read runtime graph and verify links updated
      const runtimeGraph = await app.getGraph();
      expect(runtimeGraph[0].links).toEqual([1, 2]);

      // Edge case: set invalid/extra values for node 1 to verify filtering of invalid links
      // Provide negative, out-of-range and non-numeric values and ensure they are filtered out
      await app.setLinksForNode(1, '100, -1, abc, 2');
      const runtimeGraphAfter = await app.getGraph();
      // Only valid numeric indices within range [0, nodeCount-1] should remain. For nodeCount=5, only 2 is valid.
      expect(runtimeGraphAfter[1]).toHaveProperty('links');
      expect(runtimeGraphAfter[1].links).toEqual([2]);

      // Ensure no console or page errors were introduced by malformed input
      expect(consoleMessages.filter(m => m.type === 'error')).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Transition S1_GraphCreated -> S2_PageRankCalculated (CalculatePageRank event)', () => {
    test('calculates PageRank and displays results (PageRank Calculated state)', async ({ page }) => {
      const app = new PageRankPage(page);
      await app.goto();

      // Create a small graph of 3 nodes and set links to produce meaningful rank distribution
      await app.setNodeCount(3);
      await app.clickCreateGraph();
      expect(await app.nodeCountInDOM()).toBe(3);

      // Build a simple cyclic graph: 0 -> 1, 1 -> 2, 2 -> 0
      await app.setLinksForNode(0, '1');
      await app.setLinksForNode(1, '2');
      await app.setLinksForNode(2, '0');

      // Trigger PageRank calculation
      await app.clickCalculatePageRank();

      // Verify results: should show three lines "Node 0: <num>", etc.
      const resultsText = await app.getPageRankResultsText();
      // There should be 3 lines, one per node
      const lines = resultsText.split('\n').map(l => l.trim()).filter(Boolean);
      // The implementation joins with <br>, but textContent will convert them to newlines in many browsers - accept either way.
      // Verify each expected line is present and contains a numeric value with 4 decimals
      expect(lines.length).toBeGreaterThanOrEqual(3);
      const rankValues = [];
      for (let i = 0; i < 3; i++) {
        const regex = new RegExp(`Node ${i}:\\s*([0-9]+\\.[0-9]{4})`);
        const match = resultsText.match(regex);
        expect(match).not.toBeNull();
        const value = parseFloat(match[1]);
        expect(Number.isFinite(value)).toBe(true);
        expect(value).toBeGreaterThan(0); // PageRank values should be positive
        rankValues.push(value);
      }

      // The sum of PageRank values should be approximately 1 (allow small tolerance)
      const sum = rankValues.reduce((a, b) => a + b, 0);
      expect(sum).toBeGreaterThan(0.99);
      expect(sum).toBeLessThan(1.01);

      // Ensure no runtime page errors or console errors were produced during PageRank computation
      expect(consoleMessages.filter(m => m.type === 'error')).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });

    test('edge case: clicking Calculate PageRank without creating graph produces empty results and no errors', async ({ page }) => {
      const app = new PageRankPage(page);
      await app.goto();

      // Without creating a graph (graph is default empty array), click calculate
      await app.clickCalculatePageRank();

      // Expect no results (empty string) because graph.length === 0 in implementation
      const results = await app.getPageRankResultsText();
      expect(results.trim()).toBe('');

      // Ensure no console errors or uncaught exceptions occurred
      expect(consoleMessages.filter(m => m.type === 'error')).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Additional behavior and robustness checks', () => {
    test('creating graph at minimum nodeCount (2) and verifying DOM + runtime graph', async ({ page }) => {
      const app = new PageRankPage(page);
      await app.goto();

      // Test min allowed nodes per input attributes
      await app.setNodeCount(2);
      await app.clickCreateGraph();

      expect(await app.nodeCountInDOM()).toBe(2);
      const runtimeGraph = await app.getGraph();
      expect(runtimeGraph.length).toBe(2);

      // Ensure inputs exist and can be set to no links
      await app.setLinksForNode(0, '');
      await app.setLinksForNode(1, '');
      const runtimeAfter = await app.getGraph();
      expect(runtimeAfter[0].links).toEqual([]);
      expect(runtimeAfter[1].links).toEqual([]);

      // No runtime errors or console errors
      expect(consoleMessages.filter(m => m.type === 'error')).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });

    test('invalid nodeCount values (below min, non-numeric) are handled by the input element and createGraph respects parsed integer', async ({ page }) => {
      const app = new PageRankPage(page);
      await app.goto();

      // Try to set a non-numeric value and create graph
      await app.nodeCountInput.fill('not-a-number');
      // Dispatch change event to emulate user finishing input
      await app.nodeCountInput.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));

      // Clicking createGraph when input isn't a valid number results in NaN parsed; implementation uses parseInt -> NaN length -> Array.from({ length: NaN }) yields empty array
      await app.clickCreateGraph();

      // DOM should show zero nodes
      const domCount = await app.nodeCountInDOM();
      expect(domCount).toBe(0);

      // Runtime graph should be an array of length 0
      const runtimeGraph = await app.getGraph();
      expect(Array.isArray(runtimeGraph)).toBe(true);
      expect(runtimeGraph.length).toBe(0);

      // Ensure no unexpected runtime errors (the implementation gracefully handles empty graph)
      expect(consoleMessages.filter(m => m.type === 'error')).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });
  });
});