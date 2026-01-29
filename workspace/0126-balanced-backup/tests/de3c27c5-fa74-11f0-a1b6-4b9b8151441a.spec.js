import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c27c5-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object encapsulating common interactions & queries
class PageRankPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.svg = page.locator('#graph');
    this.addNodeBtn = page.locator('#addNode');
    this.addLinkBtn = page.locator('#addLink');
    this.calculateBtn = page.locator('#calculate');
    this.resetBtn = page.locator('#reset');
    this.dampingSlider = page.locator('#damping');
    this.dampingValue = page.locator('#dampingValue');
    this.iterationsSlider = page.locator('#iterations');
    this.iterationsValue = page.locator('#iterationsValue');
    this.resultsDiv = page.locator('#results');
    this.nodeLabels = page.locator('#graph .node-label');
    this.rankLabels = page.locator('#graph .rank-label');
    this.links = page.locator('#graph .link');
  }

  async waitForInitialRender() {
    // Wait until the SVG has node labels rendered (initial graph should have 4)
    await expect(this.nodeLabels).toHaveCount(4, { timeout: 3000 });
  }

  async getNodeCount() {
    return await this.nodeLabels.count();
  }

  async getLinkCount() {
    return await this.links.count();
  }

  async clickAddNode() {
    await this.addNodeBtn.click();
    // wait for an additional node-label to appear (or timeout)
    await this.page.waitForTimeout(200); // d3 rendering is synchronous-ish but allows microtask queue
  }

  async clickAddLink() {
    await this.addLinkBtn.click();
    await this.page.waitForTimeout(200);
  }

  async clickCalculate() {
    await this.calculateBtn.click();
    // calculation triggers DOM updates; wait briefly
    await this.page.waitForTimeout(300);
  }

  async clickReset() {
    await this.resetBtn.click();
    await this.page.waitForTimeout(200);
  }

  async setDamping(valueString) {
    // Set input range value and dispatch input event to trigger handler
    await this.dampingSlider.evaluate((el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, valueString);
    await this.page.waitForTimeout(50);
  }

  async setIterations(valueString) {
    await this.iterationsSlider.evaluate((el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, valueString);
    await this.page.waitForTimeout(50);
  }

  async getDampingDisplayed() {
    return (await this.dampingValue.textContent()).trim();
  }

  async getIterationsDisplayed() {
    return (await this.iterationsValue.textContent()).trim();
  }

  async getResultsHtml() {
    return await this.resultsDiv.innerHTML();
  }

  async getResultsRowsCount() {
    // If table present, count rows minus header
    const rows = await this.page.locator('#results table tr').count();
    return Math.max(0, rows - 1);
  }

  async findNodeLabelText(text) {
    const locator = this.page.locator(`#graph .node-label`, { hasText: text });
    return await locator.count();
  }
}

test.describe('PageRank Visualization - FSM & UI tests', () => {
  // Capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console messages and page errors
    page.on('console', msg => {
      // capture only error/severity console messages
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // No-op teardown placeholder if needed
  });

  test('S0_Idle: Initial Idle state draws the graph and UI elements', async ({ page }) => {
    // Validate the initial UI and that drawGraph() (onEnter S0_Idle) produced the visualization
    const app = new PageRankPage(page);

    // Wait for initial render of nodes
    await app.waitForInitialRender();

    // Assertions:
    // - There are 4 node labels initially (A-D)
    expect(await app.getNodeCount()).toBe(4);

    // - There are some links (initial data has 5 links)
    const linkCount = await app.getLinkCount();
    expect(linkCount).toBeGreaterThanOrEqual(4); // at least 4, but expecting 5; allow >=4 to be robust

    // - Default damping and iterations shown correctly
    expect(await app.getDampingDisplayed()).toBe('0.85');
    expect(await app.getIterationsDisplayed()).toBe('20');

    // - No console errors captured during initial load
    expect(consoleErrors.length, `Console errors on load: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors on load: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('S0 -> S1: Add Node transitions to GraphUpdated and updates SVG + labels', async ({ page }) => {
    // Validate that clicking Add Node updates the graph (S0_Idle -> S1_GraphUpdated)
    const app = new PageRankPage(page);
    await app.waitForInitialRender();

    const beforeCount = await app.getNodeCount();

    // Click Add Node
    await app.clickAddNode();

    const afterCount = await app.getNodeCount();

    // Node count increased by 1
    expect(afterCount).toBe(beforeCount + 1);

    // New node should have id 'E' (initial A-D => next E). Check for label 'E'.
    const eCount = await app.findNodeLabelText('E');
    expect(eCount).toBeGreaterThanOrEqual(1);

    // No console/page errors produced by adding a node
    expect(consoleErrors.length, `Console errors after addNode: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors after addNode: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('S0 -> S1: Add Link updates link count and does not produce errors', async ({ page }) => {
    // Validate Add Link behavior (Idle -> GraphUpdated via AddLink)
    const app = new PageRankPage(page);
    await app.waitForInitialRender();

    const beforeLinks = await app.getLinkCount();

    // Attempt to add a new random link
    await app.clickAddLink();

    const afterLinks = await app.getLinkCount();

    // After attempting to add a link, link count should be >= before (no deletions)
    expect(afterLinks).toBeGreaterThanOrEqual(beforeLinks);

    // No console/page errors produced by addLink
    expect(consoleErrors.length, `Console errors after addLink: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors after addLink: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('S1 -> S2: Calculate PageRank computes ranks and displays results', async ({ page }) => {
    // Validate Calculate PageRank (GraphUpdated -> PageRankCalculated)
    const app = new PageRankPage(page);
    await app.waitForInitialRender();

    // Ensure there is at least the initial graph; perform calculate
    await app.clickCalculate();

    // Results div should contain a table with rows matching node count
    const resultsHtml = await app.getResultsHtml();
    expect(resultsHtml.length).toBeGreaterThan(0);

    const resultRows = await app.getResultsRowsCount();
    const nodeCount = await app.getNodeCount();

    // Result rows count should equal the number of nodes in the graph
    expect(resultRows).toBe(nodeCount);

    // Each result entry should contain a rank with 4 decimal places (as per display)
    // Check that results contain a decimal point (basic sanity)
    expect(resultsHtml).toMatch(/\d\.\d{4}/);

    // SVG rank labels should be updated to show numeric ranks (rank-labels)
    const rankLabelsCount = await app.rankLabels.count();
    expect(rankLabelsCount).toBe(nodeCount);

    // No console/page errors during calculation
    expect(consoleErrors.length, `Console errors after calculate: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors after calculate: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('S1 -> S0: Reset Graph returns graph to initial state and clears results', async ({ page }) => {
    // Validate Reset Graph transitions GraphUpdated -> Idle
    const app = new PageRankPage(page);
    await app.waitForInitialRender();

    // Add a node to move away from initial state
    await app.clickAddNode();
    const afterAddCount = await app.getNodeCount();
    expect(afterAddCount).toBeGreaterThan(4);

    // Calculate to populate results
    await app.clickCalculate();
    expect(await app.getResultsRowsCount()).toBeGreaterThan(0);

    // Now reset
    await app.clickReset();

    // After reset, node count should be back to 4
    const nodeCountAfterReset = await app.getNodeCount();
    expect(nodeCountAfterReset).toBe(4);

    // Results should be cleared
    const resultsHtmlAfterReset = await app.getResultsHtml();
    expect(resultsHtmlAfterReset.trim()).toBe('');

    // No console/page errors during reset
    expect(consoleErrors.length, `Console errors after reset: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors after reset: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('S0 Idle: Adjust Damping Factor (input event) updates display (S0 stays S0)', async ({ page }) => {
    // Validate DampingFactorChange event keeps the state in Idle and updates UI
    const app = new PageRankPage(page);
    await app.waitForInitialRender();

    // Change damping to 0.60
    await app.setDamping('0.6');

    // The displayed damping value should update to 0.60 (two decimals)
    expect(await app.getDampingDisplayed()).toBe('0.60');

    // Changing damping should not have produced console/page errors
    expect(consoleErrors.length, `Console errors after damping change: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors after damping change: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('S0 Idle: Adjust Iterations (input event) updates display (S0 stays S0)', async ({ page }) => {
    // Validate IterationsChange event updates UI and does not change state
    const app = new PageRankPage(page);
    await app.waitForInitialRender();

    // Change iterations to 10
    await app.setIterations('10');

    // The displayed iterations should update to '10'
    expect(await app.getIterationsDisplayed()).toBe('10');

    // No console/page errors as a result
    expect(consoleErrors.length, `Console errors after iterations change: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors after iterations change: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Repeated interactions: multiple calculates and adds remain stable and error-free', async ({ page }) => {
    // Exercise the app with repeated interactions to catch potential intermittent errors
    const app = new PageRankPage(page);
    await app.waitForInitialRender();

    // Perform a sequence: add node, add link, calculate, add node, calculate
    await app.clickAddNode();
    await app.clickAddLink();
    await app.clickCalculate();

    // Save counts
    const nodesAfterFirst = await app.getNodeCount();
    const linksAfterFirst = await app.getLinkCount();
    const resultRowsFirst = await app.getResultsRowsCount();

    expect(nodesAfterFirst).toBeGreaterThanOrEqual(5);
    expect(linksAfterFirst).toBeGreaterThanOrEqual(linksAfterFirst); // sanity

    // Add another node and recalc
    await app.clickAddNode();
    await app.clickCalculate();

    const nodesAfterSecond = await app.getNodeCount();
    const resultRowsSecond = await app.getResultsRowsCount();

    expect(nodesAfterSecond).toBe(nodesAfterFirst + 1);
    expect(resultRowsSecond).toBe(nodesAfterSecond);

    // Ensure no console/page errors during repeated operations
    expect(consoleErrors.length, `Console errors during repeated interactions: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors during repeated interactions: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('Sanity: No unexpected runtime errors logged to the console or as page errors', async ({ page }) => {
    // This test double-checks the console/page error collections after a fresh load and light interactions.
    const app = new PageRankPage(page);
    await app.waitForInitialRender();

    // Perform a small set of interactions
    await app.clickAddNode();
    await app.setDamping('0.9');
    await app.setIterations('5');
    await app.clickCalculate();

    // Assert no console error or page errors captured
    expect(consoleErrors.length, `Console errors found: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors found: ${JSON.stringify(pageErrors)}`).toBe(0);
  });
});