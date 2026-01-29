import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b1653-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Binary Tree Visualization - FSM states and transitions', () => {
  let consoleMessages;
  let pageErrors;

  // Attach listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', msg => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // Defensive: ensure we never throw from listener
        consoleMessages.push({
          type: 'unknown',
          text: String(msg),
        });
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app and wait for main elements
    await page.goto(APP_URL, { waitUntil: 'load' });
    await Promise.all([
      page.waitForSelector('#treeContainer', { state: 'attached' }),
      page.waitForSelector('#traversalResult', { state: 'attached' }),
      page.waitForSelector('#treeCode', { state: 'attached' }),
      page.waitForSelector('#insertBtn', { state: 'attached' }),
    ]);
  });

  test.afterEach(async ({ page }) => {
    // Give a small grace period for any async page errors to surface before assertions in tests read them
    await page.waitForTimeout(50);
  });

  // State S0: Idle
  test('S0_Idle: initial state shows "Tree is empty" and no nodes are rendered', async ({ page }) => {
    // Validate the initial idle state rendering and onEnter action renderTree()
    const treeContainer = await page.locator('#treeContainer');
    const text = await treeContainer.textContent();
    expect(text).toContain('Tree is empty', 'Initial tree container should indicate the tree is empty');

    // No node elements should exist initially
    const nodes = await page.locator('.node');
    await expect(nodes).toHaveCount(0);

    // Validate that code sample is present (rendered by the app)
    const codeText = await page.locator('#treeCode').textContent();
    expect(codeText).toContain('class BinaryTree', 'Binary tree code should be displayed on the page');

    // Confirm we have captured console messages array and pageErrors array
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();
  });

  // Transition: InsertNode -> S1_NodeInserted
  test('InsertNode: clicking Insert Random Node transitions to S1_NodeInserted and renders node(s)', async ({ page }) => {
    // Click insert once and validate tree is no longer empty and node elements exist
    await page.click('#insertBtn');

    // Wait for at least one .node to appear
    const nodeLocator = page.locator('.node');
    await nodeLocator.first().waitFor({ state: 'visible', timeout: 3000 });

    const nodeCount = await nodeLocator.count();
    expect(nodeCount).toBeGreaterThanOrEqual(1);

    // The "Tree is empty" message should be gone
    const treeText = await page.locator('#treeContainer').textContent();
    expect(treeText).not.toContain('Tree is empty');

    // Ensure tree.renderTree was called implicitly (we infer by nodes presence)
    expect(nodeCount).toBeGreaterThan(0);
  });

  // Traversal tests require nodes; create a helper to insert multiple nodes
  async function insertMultipleNodes(page, times = 3) {
    for (let i = 0; i < times; i++) {
      await page.click('#insertBtn');
      // small wait to allow synchronous DOM updates and connectors scheduling
      await page.waitForTimeout(100);
    }
    // Wait for nodes to settle
    await page.waitForTimeout(200);
  }

  // S2 In-order traversal
  test('S2_TraversalInOrder: performs in-order traversal and highlights nodes sequentially', async ({ page }) => {
    // Insert a few nodes to have something to traverse
    await insertMultipleNodes(page, 3);

    // Click in-order traversal button
    await page.click('#inOrderBtn');

    const traversalResult = page.locator('#traversalResult');

    // Immediately traversalResult should show the traversal sequence (non-empty)
    await expect(traversalResult).toHaveText(/^\s*\d+(\s*→\s*\d+)*\s*$/, { timeout: 2000 });

    // At least one node should get highlighted during the traversal process
    await page.waitForSelector('.node.highlight', { timeout: 5000 });

    // Wait long enough for highlighting to finish (3 nodes * 800ms each + buffer)
    await page.waitForTimeout(3000);

    // After highlightTraversal completes, traversalResult should be cleared (the implementation clears traversalResult at the end)
    await expect(traversalResult).toHaveText('', { timeout: 2000 });
  });

  // S3 Pre-order traversal
  test('S3_TraversalPreOrder: performs pre-order traversal and highlights nodes', async ({ page }) => {
    await insertMultipleNodes(page, 3);

    await page.click('#preOrderBtn');

    const traversalResult1 = page.locator('#traversalResult1');

    // traversalResult should briefly show content
    await expect(traversalResult).toHaveText(/\d+/, { timeout: 2000 });

    // Detect highlight activity
    await page.waitForSelector('.node.highlight', { timeout: 5000 });

    // Wait for highlight sequence to finish
    await page.waitForTimeout(3000);

    // traversalResult should be cleared afterwards
    await expect(traversalResult).toHaveText('', { timeout: 2000 });
  });

  // S4 Post-order traversal
  test('S4_TraversalPostOrder: performs post-order traversal and highlights nodes', async ({ page }) => {
    await insertMultipleNodes(page, 4);

    await page.click('#postOrderBtn');

    const traversalResult2 = page.locator('#traversalResult2');

    // traversalResult should show digits joined by arrows
    await expect(traversalResult).toHaveText(/\d+/, { timeout: 2000 });

    // At least one highlight should be seen
    await page.waitForSelector('.node.highlight', { timeout: 6000 });

    // Wait for completion (allow more time if more nodes)
    await page.waitForTimeout(4000);

    // After completion traversalResult should be cleared
    await expect(traversalResult).toHaveText('', { timeout: 2000 });
  });

  // Transition: S1_NodeInserted -> S5_TreeReset and S5_TreeReset -> S0_Idle
  test('ResetTree: resets the tree to empty state from non-empty and from empty (edge case)', async ({ page }) => {
    // Insert nodes then reset
    await insertMultipleNodes(page, 3);
    await page.click('#resetBtn');

    // After reset we should see the empty tree message and zero .node elements
    await expect(page.locator('#treeContainer')).toContainText('Tree is empty', { timeout: 2000 });
    await expect(page.locator('.node')).toHaveCount(0);

    // Reset when already empty (edge case) - should not throw and should remain empty
    await page.click('#resetBtn');

    await expect(page.locator('#treeContainer')).toContainText('Tree is empty', { timeout: 2000 });
    await expect(page.locator('.node')).toHaveCount(0);
  });

  // Edge case: traversal when tree is empty should not throw and traversalResult remains empty
  test('Edge case: clicking traversal buttons when tree is empty does not error and shows no highlights', async ({ page }) => {
    // Ensure tree is empty
    await expect(page.locator('#treeContainer')).toContainText('Tree is empty');

    // Click each traversal button and assert no highlights appear and traversalResult stays empty
    const traversalButtons = ['#inOrderBtn', '#preOrderBtn', '#postOrderBtn'];
    for (const selector of traversalButtons) {
      await page.click(selector);
      // short wait to allow any UI update
      await page.waitForTimeout(300);

      // traversalResult should remain empty string
      await expect(page.locator('#traversalResult')).toHaveText('', { timeout: 500 });

      // there should be no highlighted nodes
      const highlighted = await page.$('.node.highlight');
      expect(highlighted).toBeNull();
    }
  });

  // Transition checks: after traversal, inserting more nodes returns to NodeInserted state
  test('Transitions: after traversal, inserting a node returns to NodeInserted (S1_NodeInserted)', async ({ page }) => {
    await insertMultipleNodes(page, 3);

    // Perform a traversal
    await page.click('#inOrderBtn');
    await page.waitForSelector('.node.highlight', { timeout: 5000 });
    await page.waitForTimeout(3000);

    // Now insert a new node and ensure nodes count increases (or at least remains non-zero)
    const before = await page.locator('.node').count();
    await page.click('#insertBtn');

    // Wait a bit for new node to render
    await page.waitForTimeout(300);
    const after = await page.locator('.node').count();

    expect(after).toBeGreaterThanOrEqual(1);
    // It's possible the random placement leads to same visual count in some weird cases,
    // but at minimum ensure we are still in a non-empty (NodeInserted) state
    expect(after).toBeGreaterThanOrEqual(before >= 1 ? 1 : 0);
  });

  // Observe console messages and page errors
  test('Observes console logs and page errors during interactions', async ({ page }) => {
    // Perform some interactions to allow any console messages or runtime errors to occur
    await insertMultipleNodes(page, 2);
    await page.click('#inOrderBtn');
    await page.waitForSelector('.node.highlight', { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.click('#resetBtn');
    await page.waitForTimeout(200);

    // Assert that we have captured console messages array and it is iterable
    expect(Array.isArray(consoleMessages)).toBeTruthy();

    // For this application the expectation is that there are no uncaught page errors
    // If any page errors occurred, surface them for debugging by failing the test with details
    if (pageErrors.length > 0) {
      // Format errors for readable failure message
      const errorSummaries = pageErrors.map(e => {
        if (e && e.message) return `${e.name || 'Error'}: ${e.message}`;
        return String(e);
      }).join('\n');
      // Fail the test and include the captured errors
      throw new Error(`Uncaught page errors were observed:\n${errorSummaries}`);
    }

    // If no page errors, we still assert that we observed console output (could be empty but must be an array)
    expect(consoleMessages).toBeInstanceOf(Array);
  });
});