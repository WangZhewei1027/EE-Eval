import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a91af2-fa78-11f0-812d-c9788050701f.html';

// Page Object for the Red-Black Tree page
class TreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.insertBtn = page.locator('#insertBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.treeContainer = page.locator('#tree');
    this.nodeLocator = page.locator('.node');
    this.connectorLocator = page.locator('.connector');
  }

  // Navigate to the app
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait a moment for initial visualization to complete
    await this.page.waitForTimeout(300);
  }

  // Click the insert button and wait for the visualization to update
  async clickInsert() {
    await this.insertBtn.click();
    // after click, visualization updates and a highlight class is added briefly
    await this.page.waitForTimeout(100); // small pause to allow DOM update
  }

  // Click reset and wait for visualization
  async clickReset() {
    await this.resetBtn.click();
    // wait for the visualization to re-render
    await this.page.waitForTimeout(300);
  }

  // Get number of node elements currently rendered
  async getNodeCount() {
    return await this.nodeLocator.count();
  }

  // Get array of node values present (as numbers)
  async getNodeValues() {
    return await this.page.$$eval('.node', nodes => nodes.map(n => Number(n.textContent)));
  }

  // Returns whether any node currently has the highlight class
  async hasHighlightedNode() {
    return await this.page.$('.node.highlight') !== null;
  }

  // Wait until a highlight appears (or timeout)
  async waitForHighlight(timeout = 2000) {
    await this.page.waitForSelector('.node.highlight', { timeout });
  }

  // Wait until highlight disappears
  async waitForHighlightRemoval(timeout = 3000) {
    await this.page.waitForSelector('.node.highlight', { state: 'detached', timeout });
  }

  // Get count of connector elements (edges)
  async getConnectorCount() {
    return await this.connectorLocator.count();
  }
}

test.describe('Red-Black Tree Visualization (FSM validation)', () => {
  // Collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Observe console error messages
    page.on('console', msg => {
      // Collect only error-level console messages
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // Safety: ignore any unexpected inspector errors
      }
    });

    // Observe uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push({ message: err.message, stack: err.stack });
    });
  });

  test.afterEach(async () => {
    // Ensure no uncaught page errors occurred during test execution
    // If errors exist, surface them as test failures with details for debugging
    if (pageErrors.length > 0) {
      // Format a helpful message
      const messages = pageErrors.map(e => `PAGE ERROR: ${e.message}\n${e.stack || ''}`).join('\n\n');
      throw new Error(`Uncaught page errors were detected:\n\n${messages}`);
    }

    if (consoleErrors.length > 0) {
      const messages = consoleErrors.map(e => `CONSOLE ERROR: ${e.text}`).join('\n\n');
      throw new Error(`Console error messages were detected:\n\n${messages}`);
    }
  });

  test('Initial state (S0_Idle): page loads and initial tree is visualized', async ({ page }) => {
    // Validate Idle state entry action: visualizeTree is called and initial nodes rendered
    // This test verifies that the page initializes with the expected initial nodes
    const tree = new TreePage(page);
    await tree.goto();

    // The FSM's initialValues are: [10,5,15,3,7,12,17] -> expect these to appear
    const nodeValues = await tree.getNodeValues();
    // Check at least the known initial set exists
    const expectedInitial = [10, 5, 15, 3, 7, 12, 17];
    for (const val of expectedInitial) {
      expect(nodeValues).toContain(val);
    }

    // Node count should be >= 7 (one per initial value). It should be exactly 7 in normal circumstances.
    const nodeCount = await tree.getNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(7);

    // Ensure connectors are present (edges between nodes exist)
    const connectorCount = await tree.getConnectorCount();
    expect(connectorCount).toBeGreaterThanOrEqual(6); // tree with 7 nodes has at least 6 edges

    // No highlight nodes on initial load
    expect(await tree.hasHighlightedNode()).toBe(false);
  });

  test('Transition S0_Idle -> S1_NodeInserted: clicking Insert Node adds and highlights a new node', async ({ page }) => {
    // Validate that clicking Insert Node from Idle inserts a new node and triggers highlight
    const tree = new TreePage(page);
    await tree.goto();

    const initialCount = await tree.getNodeCount();
    await tree.clickInsert();

    // Immediately after click, a highlight should be present for the newly inserted node
    await tree.waitForHighlight(1000);
    expect(await tree.hasHighlightedNode()).toBe(true);

    // Node count should increase by at least 1
    const afterInsertCount = await tree.getNodeCount();
    expect(afterInsertCount).toBeGreaterThanOrEqual(initialCount + 1);

    // Wait for highlight to be removed (the app uses setTimeout 2000ms)
    await tree.waitForHighlightRemoval(4000);
    expect(await tree.hasHighlightedNode()).toBe(false);

    // After insertion, the tree should still render connectors
    const connectors = await tree.getConnectorCount();
    expect(connectors).toBeGreaterThanOrEqual(6);
  });

  test('Transition S1_NodeInserted -> S1_NodeInserted: multiple inserts append additional nodes and highlight each', async ({ page }) => {
    // Validate repeated insertions from NodeInserted state keep adding nodes and highlighting
    const tree = new TreePage(page);
    await tree.goto();

    const initialCount = await tree.getNodeCount();

    // Perform two rapid inserts
    await tree.clickInsert();
    await tree.waitForHighlight(1000);
    await tree.waitForHighlightRemoval(4000);

    await tree.clickInsert();
    await tree.waitForHighlight(1000);

    const afterTwoInserts = await tree.getNodeCount();
    expect(afterTwoInserts).toBeGreaterThanOrEqual(initialCount + 2);

    // Ensure at least one highlighted node after second insert
    expect(await tree.hasHighlightedNode()).toBe(true);

    // Allow highlight to clear
    await tree.waitForHighlightRemoval(4000);
    expect(await tree.hasHighlightedNode()).toBe(false);
  });

  test('Transition S0_Idle -> S2_TreeReset: clicking Reset Tree from Idle restores initial values', async ({ page }) => {
    // From Idle (fresh load), clicking Reset should re-create the initial tree
    const tree = new TreePage(page);
    await tree.goto();

    // Make a small mutation first (to ensure reset actually changes something)
    await tree.clickInsert();
    await tree.waitForHighlight(1000);

    // Now reset
    await tree.clickReset();

    // After reset, node count should be exactly the initial count (7)
    const nodeCount = await tree.getNodeCount();
    expect(nodeCount).toBe(7);

    // Validate the exact initial values are present
    const nodeValues = await tree.getNodeValues();
    const expectedInitial = [10, 5, 15, 3, 7, 12, 17];
    for (const val of expectedInitial) {
      expect(nodeValues).toContain(val);
    }

    // No highlight should remain on reset
    expect(await tree.hasHighlightedNode()).toBe(false);
  });

  test('Transition S1_NodeInserted -> S2_TreeReset: after insert, reset returns to initial state', async ({ page }) => {
    // Insert a node and then reset; ensure tree returns to initialValues
    const tree = new TreePage(page);
    await tree.goto();

    const beforeInsertValues = await tree.getNodeValues();
    await tree.clickInsert();
    // wait for highlight
    await tree.waitForHighlight(1500);
    // Reset the tree
    await tree.clickReset();

    // After reset, we should have initial values again
    const nodeValues = await tree.getNodeValues();
    const expectedInitial = [10, 5, 15, 3, 7, 12, 17];
    expect(nodeValues.length).toBe(7);
    for (const val of expectedInitial) {
      expect(nodeValues).toContain(val);
    }

    // Ensure any transient highlight from the insert is gone
    expect(await tree.hasHighlightedNode()).toBe(false);
  });

  test('Edge case: Rapid insert clicks should not throw uncaught exceptions and should render nodes', async ({ page }) => {
    // Rapidly click insert multiple times and ensure the app remains stable (no page errors)
    const tree = new TreePage(page);
    await tree.goto();

    const initialCount = await tree.getNodeCount();

    // Rapid clicks
    for (let i = 0; i < 5; i++) {
      await tree.insertBtn.click();
    }

    // Allow some time for DOM updates and highlights to clear
    await page.waitForTimeout(2500);

    const finalCount = await tree.getNodeCount();
    // Expect at least 5 new nodes added (some duplicates could exist but count should increase)
    expect(finalCount).toBeGreaterThanOrEqual(initialCount + 5);

    // Assert no page errors or console errors (afterEach will also assert)
    expect(finalCount).toBeGreaterThan(0);
  });

  test('Edge case: Rapid reset clicks should not produce errors and result in initial tree', async ({ page }) => {
    // Clicking reset repeatedly should be idempotent and not cause exceptions
    const tree = new TreePage(page);
    await tree.goto();

    // Trigger some changes
    await tree.clickInsert();
    await tree.waitForTimeout?.(100); // safe guard

    // Rapid reset clicks
    for (let i = 0; i < 3; i++) {
      await tree.resetBtn.click();
    }

    // Wait for the last reset to take effect
    await page.waitForTimeout(300);

    // After repeated resets, the tree should equal the initial configuration
    const nodeCount = await tree.getNodeCount();
    expect(nodeCount).toBe(7);

    const nodeValues = await tree.getNodeValues();
    const expectedInitial = [10, 5, 15, 3, 7, 12, 17];
    for (const val of expectedInitial) {
      expect(nodeValues).toContain(val);
    }
  });

  test('Visual feedback: nodes have correct classes for colors and layout placement', async ({ page }) => {
    // Verify that nodes render with class 'red' or 'black' and have data-value attributes
    const tree = new TreePage(page);
    await tree.goto();

    // All .node elements should have data-value attributes and a color class
    const nodes = await page.$$('.node');
    expect(nodes.length).toBeGreaterThanOrEqual(7);

    for (const nodeHandle of nodes) {
      const dataValue = await nodeHandle.getAttribute('data-value');
      expect(dataValue).not.toBeNull();

      const className = await nodeHandle.getAttribute('class');
      // Should include either 'red' or 'black'
      expect(/(\bred\b|\bblack\b)/.test(className)).toBeTruthy();

      // Check that style left/top are present (visualization positions)
      const left = await nodeHandle.evaluate(n => n.style.left);
      const top = await nodeHandle.evaluate(n => n.style.top);
      expect(left).toBeTruthy();
      expect(top).toBeTruthy();
    }
  });
});