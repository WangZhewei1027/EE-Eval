import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2d12f1-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object Model for the BST interactive page
class BSTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.insertInput = page.locator('input#insertValue');
    this.deleteInput = page.locator('input#deleteValue');
    this.searchInput = page.locator('input#searchValue');

    this.insertButton = page.locator("button[onclick='insertNode()']");
    this.deleteButton = page.locator("button[onclick='deleteNode()']");
    this.searchButton = page.locator("button[onclick='searchNode()']");
    this.clearButton = page.locator("button[onclick='clearTree()']");

    this.traverseInorder = page.locator("button[onclick=\"traverse('inorder')\"]");
    this.traversePreorder = page.locator("button[onclick=\"traverse('preorder')\"]");
    this.traversePostorder = page.locator("button[onclick=\"traverse('postorder')\"]");
    this.traverseLevel = page.locator("button[onclick=\"traverse('levelorder')\"]");
    this.traversalResult = page.locator('#traversalResult');

    this.getMinBtn = page.locator("button[onclick='getMin()']");
    this.getMaxBtn = page.locator("button[onclick='getMax()']");
    this.getHeightBtn = page.locator("button[onclick='getHeight()']");
    this.countNodesBtn = page.locator("button[onclick='countNodes()']");
    this.propertyResult = page.locator('#propertyResult');

    this.toggleBalanceBtn = page.locator("button[onclick='toggleBalance()']");
    this.togglePathsBtn = page.locator("button[onclick='togglePaths()']");
    this.randomTreeBtn = page.locator("button[onclick='randomTree()']");

    this.nodeCountRange = page.locator('input#nodeCount');
    this.nodeCountValue = page.locator('#nodeCountValue');

    this.treeContainer = page.locator('#treeContainer');
    this.status = page.locator('#status');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial render
    await expect(this.treeContainer).toBeVisible();
  }

  async setInsertValue(value) {
    await this.insertInput.fill(String(value));
  }
  async clickInsert() {
    await this.insertButton.click();
  }
  async insert(value) {
    await this.setInsertValue(value);
    await this.clickInsert();
  }

  async setDeleteValue(value) {
    await this.deleteInput.fill(String(value));
  }
  async clickDelete() {
    await this.deleteButton.click();
  }
  async delete(value) {
    await this.setDeleteValue(value);
    await this.clickDelete();
  }

  async setSearchValue(value) {
    await this.searchInput.fill(String(value));
  }
  async clickSearch() {
    await this.searchButton.click();
  }
  async search(value) {
    await this.setSearchValue(value);
    await this.clickSearch();
  }

  async clickClear() {
    await this.clearButton.click();
  }

  async traverse(orderButton) {
    await orderButton.click();
  }

  async clickGetMin() { await this.getMinBtn.click(); }
  async clickGetMax() { await this.getMaxBtn.click(); }
  async clickGetHeight() { await this.getHeightBtn.click(); }
  async clickCountNodes() { await this.countNodesBtn.click(); }

  async clickToggleBalance() { await this.toggleBalanceBtn.click(); }
  async clickTogglePaths() { await this.togglePathsBtn.click(); }
  async clickRandomTree() { await this.randomTreeBtn.click(); }

  async setNodeCount(value) {
    // Use evaluate to properly change range value and fire onchange
    await this.nodeCountRange.evaluate((el, v) => {
      el.value = String(v);
      // dispatch change event to trigger onchange handler
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }

  async getStatusText() {
    return (await this.status.textContent())?.trim() ?? '';
  }

  async getTraversalText() {
    return (await this.traversalResult.textContent())?.trim() ?? '';
  }

  async getPropertyText() {
    return (await this.propertyResult.textContent())?.trim() ?? '';
  }

  async getNodeValues() {
    const nodes = await this.page.locator('.node').all();
    const values = [];
    for (const n of nodes) {
      const text = (await n.getAttribute('data-value')) ?? (await n.textContent());
      values.push(String(text).trim());
    }
    return values;
  }

  async nodeExists(value) {
    const locator = this.page.locator(`.node[data-value="${value}"]`);
    return await locator.count() > 0;
  }

  async getHighlightedNodes() {
    const highlighted = await this.page.locator('.node.highlight').all();
    const values = [];
    for (const h of highlighted) {
      const v = (await h.getAttribute('data-value')) ?? (await h.textContent());
      values.push(String(v).trim());
    }
    return values;
  }

  async getNodeText(value) {
    const locator = this.page.locator(`.node[data-value="${value}"]`);
    if ((await locator.count()) === 0) return null;
    return (await locator.textContent())?.trim() ?? null;
  }
}

test.describe('Binary Search Tree Interactive - states and transitions', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err?.message ?? String(err));
    });

    // Collect console.error messages from the page
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test('Initial Idle state should render an empty tree', async ({ page }) => {
    // Validate the S0_Idle state: renderTree() should show "Tree is empty"
    const bst = new BSTPage(page);
    await bst.goto();

    // The tree container should indicate empty tree on initial render
    await expect(bst.treeContainer).toHaveText('Tree is empty');

    // Status should be empty initially
    await expect(bst.status).toHaveText('');

    // There should be no runtime page errors or console errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Insert nodes transitions to NodeInserted and updates DOM', async ({ page }) => {
    // Validates S1_NodeInserted entry action renderTree() and status update
    const bst = new BSTPage(page);
    await bst.goto();

    // Insert three nodes and verify status and DOM updates
    await bst.insert(50);
    await expect(bst.status).toHaveText('Inserted node with value 50');
    await expect(bst.nodeExists(50)).resolves.toBeTruthy();

    await bst.insert(30);
    await expect(bst.status).toHaveText('Inserted node with value 30');
    await expect(bst.nodeExists(30)).resolves.toBeTruthy();

    await bst.insert(70);
    await expect(bst.status).toHaveText('Inserted node with value 70');
    await expect(bst.nodeExists(70)).resolves.toBeTruthy();

    // The tree container should have node elements (at least 3)
    const values = await bst.getNodeValues();
    expect(values.length).toBeGreaterThanOrEqual(3);

    // Ensure no unexpected runtime errors happened while inserting
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Delete nodes transitions to NodeDeleted and updates DOM; handles invalid deletion', async ({ page }) => {
    // Validates S2_NodeDeleted and edge cases for invalid/non-existent deletions
    const bst = new BSTPage(page);
    await bst.goto();

    // Prepare tree
    await bst.insert(40);
    await bst.insert(20);
    await bst.insert(60);

    // Delete existing node
    await bst.delete(20);
    await expect(bst.status).toHaveText('Deleted node with value 20 (if found)');
    expect(await bst.nodeExists(20)).toBeFalsy();

    // Delete non-existent node (should still show the deleted message)
    await bst.delete(9999);
    await expect(bst.status).toHaveText('Deleted node with value 9999 (if found)');

    // Attempt to delete with invalid input (empty) - should produce validation status
    await bst.deleteInput.fill(''); // clear the input
    await bst.clickDelete();
    await expect(bst.status).toHaveText('Please enter a valid number');

    // Check no runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Search node transitions to NodeSearched - found and not found scenarios and path highlighting', async ({ page }) => {
    // Validates S3_NodeSearched; highlights path when node found; shows not found message otherwise
    const bst = new BSTPage(page);
    await bst.goto();

    // Build known tree
    await bst.insert(50);
    await bst.insert(30);
    await bst.insert(70);
    await bst.insert(25);
    await bst.insert(35);

    // Search for existing node
    await bst.search(35);
    await expect(bst.status).toHaveText('Found node with value 35');
    const highlighted = await bst.getHighlightedNodes();
    expect(highlighted.length).toBeGreaterThanOrEqual(1);
    expect(highlighted).toContain('35');

    // Toggle paths and search to ensure 'path' class is applied when showPaths is true
    await bst.clickTogglePaths();
    await bst.search(25);
    await expect(bst.status).toHaveText('Found node with value 25');
    // With showPaths true the highlighted nodes should also have class 'path'. We cannot directly query class 'path' easily per node values without additional lookups, but verifying at least highlight present is still useful.
    const highlightedAfter = await bst.getHighlightedNodes();
    expect(highlightedAfter.length).toBeGreaterThanOrEqual(1);
    expect(highlightedAfter).toContain('25');

    // Search for a non-existent node
    await bst.search(12345);
    await expect(bst.status).toHaveText('Node with value 12345 not found');

    // Search with invalid input (empty) should show validation message
    await bst.searchInput.fill('');
    await bst.clickSearch();
    await expect(bst.status).toHaveText('Please enter a valid number');

    // Ensure no runtime errors during search interactions
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Clear tree transitions to TreeCleared and resets UI', async ({ page }) => {
    // Validates S4_TreeCleared: root reset, renderTree called, traversal and property results cleared
    const bst = new BSTPage(page);
    await bst.goto();

    await bst.insert(10);
    await bst.insert(20);

    // Clear tree
    await bst.clickClear();
    await expect(bst.status).toHaveText('Tree cleared');

    // Tree container should indicate empty
    await expect(bst.treeContainer).toHaveText('Tree is empty');

    // Traversal and property results should be cleared
    await expect(bst.traversalResult).toHaveText('');
    await expect(bst.propertyResult).toHaveText('');

    // Ensure no runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Traversals produce expected traversal results (inorder, preorder, postorder, levelorder)', async ({ page }) => {
    // Validates S5_TreeTraversed: traversal results are displayed correctly
    const bst = new BSTPage(page);
    await bst.goto();

    // Build a specific tree for predictable traversal outputs
    // Insert order: 50,30,20,40,70,60,80
    await bst.insert(50);
    await bst.insert(30);
    await bst.insert(20);
    await bst.insert(40);
    await bst.insert(70);
    await bst.insert(60);
    await bst.insert(80);

    // Inorder: 20 → 30 → 40 → 50 → 60 → 70 → 80
    await bst.traverse(bst.traverseInorder);
    await expect(bst.traversalResult).toHaveText('inorder: 20 → 30 → 40 → 50 → 60 → 70 → 80');

    // Preorder: 50 → 30 → 20 → 40 → 70 → 60 → 80
    await bst.traverse(bst.traversePreorder);
    await expect(bst.traversalResult).toHaveText('preorder: 50 → 30 → 20 → 40 → 70 → 60 → 80');

    // Postorder: 20 → 40 → 30 → 60 → 80 → 70 → 50
    await bst.traverse(bst.traversePostorder);
    await expect(bst.traversalResult).toHaveText('postorder: 20 → 40 → 30 → 60 → 80 → 70 → 50');

    // Level order: 50 → 30 → 70 → 20 → 40 → 60 → 80
    await bst.traverse(bst.traverseLevel);
    await expect(bst.traversalResult).toHaveText('levelorder: 50 → 30 → 70 → 20 → 40 → 60 → 80');

    // Ensure no runtime errors occurred during traversal operations
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Properties (min, max, height, count) transition to PropertyObtained and highlight paths', async ({ page }) => {
    // Validates S6_PropertyObtained: propertyResult texts and highlighting for min/max
    const bst = new BSTPage(page);
    await bst.goto();

    // Build a known tree as in prior test
    await bst.insert(50);
    await bst.insert(30);
    await bst.insert(20);
    await bst.insert(40);
    await bst.insert(70);
    await bst.insert(60);
    await bst.insert(80);

    // Find min
    await bst.clickGetMin();
    await expect(bst.propertyResult).toHaveText('Minimum value: 20');
    const highlightedMin = await bst.getHighlightedNodes();
    expect(highlightedMin).toContain('20');

    // Find max
    await bst.clickGetMax();
    await expect(bst.propertyResult).toHaveText('Maximum value: 80');
    const highlightedMax = await bst.getHighlightedNodes();
    expect(highlightedMax).toContain('80');

    // Get height - with calculateHeight base -1, the tree height for this balanced tree should be 2
    await bst.clickGetHeight();
    await expect(bst.propertyResult).toHaveText('Tree height: 2');

    // Count nodes - should be 7
    await bst.clickCountNodes();
    await expect(bst.propertyResult).toHaveText('Node count: 7');

    // Ensure no runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Toggle visualization options toggleBalance and togglePaths affect rendering', async ({ page }) => {
    // Validates toggleBalance and togglePaths behavior and that renderTree reflects changes
    const bst = new BSTPage(page);
    await bst.goto();

    // Build tree
    await bst.insert(15);
    await bst.insert(10);
    await bst.insert(20);

    // Toggle balance: should alter node text to include balances (parentheses)
    await bst.clickToggleBalance();
    // Confirm that at least one node text now contains parentheses indicating balance shown
    const nodeValues = await bst.getNodeValues();
    let foundBalanceText = false;
    for (const val of nodeValues) {
      const text = await bst.getNodeText(val);
      if (text && text.includes('(') && text.includes(')')) {
        foundBalanceText = true;
        break;
      }
    }
    expect(foundBalanceText).toBeTruthy();

    // Toggle paths on and perform a search to verify 'path' styling is applied (class 'path' added when showPaths true)
    await bst.clickTogglePaths();
    await bst.search(20);
    await expect(bst.status).toHaveText('Found node with value 20');
    // Confirm highlighted nodes exist
    const highlighted = await bst.getHighlightedNodes();
    expect(highlighted.length).toBeGreaterThanOrEqual(1);
    expect(highlighted).toContain('20');

    // Ensure no runtime console or page errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('GenerateRandomTree and UpdateNodeCount events create a random tree with requested node count', async ({ page }) => {
    // Validates GenerateRandomTree transition to TreeCleared then populate, and UpdateNodeCount updates the UI
    const bst = new BSTPage(page);
    await bst.goto();

    // Update node count to 5
    await bst.setNodeCount(5);
    await expect(bst.nodeCountValue).toHaveText('5');

    // Generate random tree with 5 nodes
    await bst.clickRandomTree();

    // Status should indicate generated count
    await expect(bst.status).toHaveText('Generated random tree with 5 nodes');

    // There should be exactly 5 node elements
    const nodes = await page.locator('.node').all();
    expect(nodes.length).toBe(5);

    // Ensure no runtime errors during random tree generation
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Edge cases: insertion/search/deletion with invalid inputs should show validation messages and not crash', async ({ page }) => {
    // Test validation UI messages for invalid inputs and ensure no runtime errors
    const bst = new BSTPage(page);
    await bst.goto();

    // Invalid insert (empty)
    await bst.insertInput.fill('');
    await bst.clickInsert();
    await expect(bst.status).toHaveText('Please enter a valid number');

    // Invalid search (non-numeric)
    await bst.searchInput.fill('abc');
    await bst.clickSearch();
    await expect(bst.status).toHaveText('Please enter a valid number');

    // Invalid delete (non-numeric)
    await bst.deleteInput.fill('xyz');
    await bst.clickDelete();
    await expect(bst.status).toHaveText('Please enter a valid number');

    // Ensure no runtime errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('No uncaught runtime page errors or console.error calls occurred during full interaction sequence', async ({ page }) => {
    // This test navigates and performs a broad set of interactions and then asserts no pageerrors occurred.
    const bst = new BSTPage(page);
    await bst.goto();

    // Perform a variety of interactions to exercise the app
    await bst.insert(5);
    await bst.insert(3);
    await bst.insert(7);
    await bst.search(7);
    await bst.delete(3);
    await bst.traverse(bst.traverseInorder);
    await bst.clickGetMin();
    await bst.clickGetMax();
    await bst.clickGetHeight();
    await bst.clickCountNodes();
    await bst.clickToggleBalance();
    await bst.clickTogglePaths();

    // final check: we expect no uncaught page errors or console.error messages
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});