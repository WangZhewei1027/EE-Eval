import { test, expect } from '@playwright/test';

test.setTimeout(60000); // allow up to 60s because visualization uses many timeouts

// Page object for the Branch and Bound visualization page
class BranchAndBoundPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aaefb3-fa78-11f0-812d-c9788050701f.html';
    this.consoleErrors = [];
    this.pageErrors = [];
    this.consoleMessages = [];
  }

  async goto() {
    // Attach listeners to capture console errors and page errors
    this.page.on('console', (msg) => {
      // capture error-level console messages separately for assertions
      const type = msg.type();
      const text = msg.text();
      this.consoleMessages.push({ type, text });
      if (type === 'error') this.consoleErrors.push(text);
    });
    this.page.on('pageerror', (err) => {
      // capture uncaught exceptions on the page
      this.pageErrors.push(err);
    });

    await this.page.goto(this.url);
    // Wait for DOMContentLoaded / root elements to be present
    await this.page.waitForSelector('#tree');
    await this.page.waitForSelector('#startBtn');
    await this.page.waitForSelector('#resetBtn');
  }

  async startVisualization() {
    await this.page.click('#startBtn');
  }

  async resetVisualization() {
    await this.page.click('#resetBtn');
  }

  async isStartDisabled() {
    return await this.page.$eval('#startBtn', el => !!el.disabled);
  }

  async isResetDisabled() {
    return await this.page.$eval('#resetBtn', el => !!el.disabled);
  }

  async getLevelsCount() {
    return await this.page.$$eval('.level', els => els.length);
  }

  async getNodesCount() {
    return await this.page.$$eval('.node', els => els.length);
  }

  async anyNodeHasClass(className) {
    return await this.page.$$eval(`.node.${className}`, els => els.length > 0);
  }

  async nodeHasClass(nodeValue, className) {
    // Because multiple nodes may share the same data-id, this checks any matching node
    return await this.page.$eval(
      `.node[data-id="${nodeValue}"]`,
      (el, cls) => el.classList.contains(cls),
      className
    ).catch(() => false);
  }

  async locatorNode(nodeValue) {
    return this.page.locator(`.node[data-id="${nodeValue}"]`);
  }

  async waitForNodeClass(nodeValue, className, timeout = 30000) {
    // Wait for any node with the given data-id to acquire className
    const selector = `.node[data-id="${nodeValue}"].${className}`;
    await this.page.waitForSelector(selector, { timeout });
    return true;
  }

  async boundValueShownFor(nodeValue) {
    // check the bound-value sibling next to a node with given data-id
    return await this.page.evaluate((value) => {
      const node = document.querySelector(`.node[data-id="${value}"]`);
      if (!node) return false;
      const bound = node.nextElementSibling;
      if (!bound || !bound.classList.contains('bound-value')) return false;
      return bound.classList.contains('show');
    }, nodeValue);
  }

  async anyPrunedCount() {
    return await this.page.$$eval('.node.pruned', els => els.length);
  }

  async anySolutionCount() {
    return await this.page.$$eval('.node.solution', els => els.length);
  }

  async anyPulseCount() {
    return await this.page.$$eval('.node.pulse', els => els.length);
  }
}

test.describe('Branch and Bound Visualization (FSM states & transitions)', () => {
  // Each test gets a fresh page and page object
  test.beforeEach(async ({ page }) => {
    // noop - individual tests will instantiate page object and goto
  });

  test('Initial Idle state renders the tree and UI elements correctly', async ({ page }) => {
    // This test validates the S0_Idle state: renderTree() must have been called on DOMContentLoaded
    const app = new BranchAndBoundPage(page);
    await app.goto();

    // There should be 4 levels (levels 0 through 3)
    const levels = await app.getLevelsCount();
    expect(levels).toBe(4);

    // There are 15 nodes in the full tree (1 + 2 + 4 + 8)
    const nodes = await app.getNodesCount();
    expect(nodes).toBe(15);

    // Start button should be enabled initially (idle)
    const startDisabled = await app.isStartDisabled();
    expect(startDisabled).toBe(false);

    // Reset button should be enabled (no restrictions)
    const resetDisabled = await app.isResetDisabled();
    expect(resetDisabled).toBe(false);

    // Initially there should be no active/pruned/solution/pulse classes applied
    expect(await app.anyNodeHasClass('active')).toBe(false);
    expect(await app.anyNodeHasClass('pruned')).toBe(false);
    expect(await app.anyNodeHasClass('solution')).toBe(false);
    expect(await app.anyNodeHasClass('pulse')).toBe(false);

    // Assert no uncaught page errors or console errors so far
    expect(app.pageErrors.length).toBe(0);
    expect(app.consoleErrors.length).toBe(0);
  });

  test('Start Visualization transitions to Visualizing and disables Start button', async ({ page }) => {
    // This test validates transition: S0_Idle --StartVisualization--> S1_Visualizing
    // and checks entry_action performBranchAndBound and evidence startBtn.disabled = true
    const app = new BranchAndBoundPage(page);
    await app.goto();

    // Start visualization
    await app.startVisualization();

    // Immediately the start button should be disabled per exit/transition evidence
    const disabled = await app.isStartDisabled();
    expect(disabled).toBe(true);

    // Wait for the root node (value 0) to become active as the first scheduled highlight
    await app.waitForNodeClass(0, 'active', 10000); // root should appear active within ~1s

    // Confirm that at least one node is active
    expect(await app.anyNodeHasClass('active')).toBe(true);

    // No page errors or console errors while visualizing (should allow natural errors if they occur)
    expect(app.pageErrors.length).toBe(0);
    expect(app.consoleErrors.length).toBe(0);
  });

  test('Visualization finds optimal solution (node 14) and pulses; pruned nodes appear', async ({ page }) => {
    // This test validates that the algorithm eventually marks the optimal solution (14),
    // applies .solution and .pulse classes, shows bound values, and marks pruned nodes.
    const app = new BranchAndBoundPage(page);
    await app.goto();

    // Start the visualization
    await app.startVisualization();

    // The algorithm explores nodes over time. Wait for the known optimal leaf value 14 to be marked as solution.
    // This may take many scheduled timeouts (several seconds), so allow up to 30s.
    await app.waitForNodeClass(14, 'solution', 40000);

    // Verify that the solution node has the pulse animation class
    // The pulse is added after marking solution
    await app.waitForNodeClass(14, 'pulse', 5000);

    // Confirm at least one node has the solution class (expected exactly 1 at the end)
    expect(await app.anySolutionCount()).toBeGreaterThanOrEqual(1);

    // The pulse count should be >=1
    expect(await app.anyPulseCount()).toBeGreaterThanOrEqual(1);

    // Check that some nodes were pruned (prunedNodes are marked when bound < current optimal bound)
    const prunedCount = await app.anyPrunedCount();
    expect(prunedCount).toBeGreaterThanOrEqual(1);

    // Check that the bound-value next to the solution has been shown
    const boundShown = await app.boundValueShownFor(14);
    expect(boundShown).toBe(true);

    // Final assertions: no uncaught errors during the run
    expect(app.pageErrors.length).toBe(0);
    expect(app.consoleErrors.length).toBe(0);
  });

  test('Reset during visualization clears highlights, stops timeouts, and re-enables Start', async ({ page }) => {
    // This test validates the S1_Visualizing --ResetVisualization--> S2_Reset transition and S2 -> S0 behavior.
    // It ensures resetVisualization() clears scheduled timeouts and resets UI state.
    const app = new BranchAndBoundPage(page);
    await app.goto();

    // Start visualization and wait for one node to become active
    await app.startVisualization();
    await app.waitForNodeClass(0, 'active', 10000);

    // Click reset while visualization is in progress
    await app.resetVisualization();

    // After reset, Start button must be enabled again (S2_Reset exit action leads to S0_Idle)
    const startEnabledAfterReset = await app.isStartDisabled();
    expect(startEnabledAfterReset).toBe(false);

    // After reset, no node should have 'active', 'solution' or 'pruned' classes
    // (resetVisualization removes these classes from all nodes)
    // Wait a brief moment to allow DOM updates to settle
    await page.waitForTimeout(200);
    expect(await app.anyNodeHasClass('active')).toBe(false);
    expect(await app.anyNodeHasClass('pruned')).toBe(false);
    expect(await app.anyNodeHasClass('solution')).toBe(false);
    expect(await app.anyNodeHasClass('pulse')).toBe(false);

    // Bound values should not be visible
    const anyBoundShown = await page.$$eval('.bound-value.show', els => els.length);
    expect(anyBoundShown).toBe(0);

    // Ensure that scheduled timeouts do not later re-apply classes: wait 2 more seconds and check again
    await page.waitForTimeout(2000);
    expect(await app.anyNodeHasClass('active')).toBe(false);
    expect(await app.anyNodeHasClass('solution')).toBe(false);

    // Assert no uncaught page errors occurred
    expect(app.pageErrors.length).toBe(0);
    expect(app.consoleErrors.length).toBe(0);
  });

  test('After reset, starting again re-enters Visualizing (S2_Reset -> S0_Idle -> S1_Visualizing)', async ({ page }) => {
    // Validate that starting after a reset returns the app to Visualizing
    const app = new BranchAndBoundPage(page);
    await app.goto();

    // Click reset before starting (edge case): should keep start enabled
    await app.resetVisualization();
    expect(await app.isStartDisabled()).toBe(false);

    // Start once - should disable start button
    await app.startVisualization();
    expect(await app.isStartDisabled()).toBe(true);

    // Try clicking start again (button disabled) - it should remain disabled and not throw
    // Attempt a click; Playwright will throw if element is disabled only for click with force false.
    // We assert the start button is disabled and that no additional errors were logged.
    const startDisabled = await app.isStartDisabled();
    expect(startDisabled).toBe(true);

    // Wait for at least one active node to appear to verify visualization began
    await app.waitForNodeClass(0, 'active', 10000);
    expect(await app.anyNodeHasClass('active')).toBe(true);

    // Clean up by resetting
    await app.resetVisualization();
    expect(await app.isStartDisabled()).toBe(false);

    // Final error assertions
    expect(app.pageErrors.length).toBe(0);
    expect(app.consoleErrors.length).toBe(0);
  });

  test('Edge case: ensure renderNode and positioning do not throw and duplicate data-ids exist (DOM structure validation)', async ({ page }) => {
    // This test checks DOM structure and presence of duplicate data-ids (the implementation uses node.value as id which duplicates)
    const app = new BranchAndBoundPage(page);
    await app.goto();

    // Collect list of data-id values and ensure duplicates exist for some values like 12 and 11
    const dataIds = await page.$$eval('.node', nodes => nodes.map(n => n.getAttribute('data-id')));
    // Expect duplicates for some known values
    const occurrences = dataIds.reduce((acc, id) => {
      acc[id] = (acc[id] || 0) + 1;
      return acc;
    }, {});
    // Values 12 and 11 appear more than once in the tree as defined in the HTML data structure
    expect(occurrences['12']).toBeGreaterThanOrEqual(2);
    expect(occurrences['11']).toBeGreaterThanOrEqual(2);

    // Validate that connectors exist (some .connector elements were added during render)
    const connectors = await page.$$eval('.connector', els => els.length);
    expect(connectors).toBeGreaterThanOrEqual(1);

    // Final error assertions
    expect(app.pageErrors.length).toBe(0);
    expect(app.consoleErrors.length).toBe(0);
  });
});