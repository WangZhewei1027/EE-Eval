import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ce3423-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Binary Tree application
class BinaryTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#valueInput');
    this.addBtn = page.locator('button[onclick="addNode()"]');
    this.removeBtn = page.locator('button[onclick="removeNode()"]');
    this.inOrderBtn = page.locator('button[onclick="traverseInOrder()"]');
    this.preOrderBtn = page.locator('button[onclick="traversePreOrder()"]');
    this.postOrderBtn = page.locator('button[onclick="traversePostOrder()"]');
    this.treeOutput = page.locator('#treeOutput');
    this.traversalOutput = page.locator('#traversalOutput');
  }

  // Set value into the input (clears existing)
  async setValue(value) {
    await this.input.fill(String(value));
  }

  // Click add node (assumes input already set)
  async addNode(value) {
    if (typeof value !== 'undefined') {
      await this.setValue(value);
    }
    await this.addBtn.click();
  }

  // Click remove node (assumes input already set)
  async removeNode(value) {
    if (typeof value !== 'undefined') {
      await this.setValue(value);
    }
    await this.removeBtn.click();
  }

  async traverseInOrder() {
    await this.inOrderBtn.click();
  }

  async traversePreOrder() {
    await this.preOrderBtn.click();
  }

  async traversePostOrder() {
    await this.postOrderBtn.click();
  }

  async getTreeOutputText() {
    return (await this.treeOutput.textContent()) ?? '';
  }

  async getTraversalOutputText() {
    return (await this.traversalOutput.textContent()) ?? '';
  }
}

test.describe('Interactive Binary Tree - FSM states and transitions', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page (load exactly as-is)
    await page.goto(BASE_URL);
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright's automatic cleanup.
    // The consoleMessages and pageErrors are available to assertions in each test.
  });

  test('S0_Idle: Initial page renders with expected controls and empty outputs', async ({ page }) => {
    // Validate presence of UI components in Idle state
    const app = new BinaryTreePage(page);

    // Input and buttons should be visible
    await expect(app.input).toBeVisible();
    await expect(app.addBtn).toBeVisible();
    await expect(app.removeBtn).toBeVisible();
    await expect(app.inOrderBtn).toBeVisible();
    await expect(app.preOrderBtn).toBeVisible();
    await expect(app.postOrderBtn).toBeVisible();

    // Outputs should be empty initially
    expect(await app.getTreeOutputText()).toBe('');
    expect(await app.getTraversalOutputText()).toBe('');

    // Assert no unexpected runtime errors occurred on load
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S1_NodeAdded and traversal states: Add nodes and validate tree and traversals', async ({ page }) => {
    // This test covers: AddNode transition, S1 NodeAdded, and traverse states S3/S4/S5
    const app = new BinaryTreePage(page);

    // Add a set of nodes to build the tree: 10, 5, 15, 3, 7
    await app.addNode(10);
    // After adding root node, treeOutput should update (non-empty) - verifies updateTreeOutput() action
    let treeText = await app.getTreeOutputText();
    expect(treeText).toContain('10'); // root present
    await app.addNode(5);
    await app.addNode(15);
    await app.addNode(3);
    await app.addNode(7);

    // Tree output should contain all added values
    treeText = await app.getTreeOutputText();
    expect(treeText).toContain('10');
    expect(treeText).toContain('5');
    expect(treeText).toContain('15');
    expect(treeText).toContain('3');
    expect(treeText).toContain('7');

    // Verify In-Order traversal -> should be sorted ascending: 3, 5, 7, 10, 15
    await app.traverseInOrder();
    expect(await app.getTraversalOutputText()).toBe('3, 5, 7, 10, 15');

    // Verify Pre-Order traversal -> root-left-right: 10, 5, 3, 7, 15
    await app.traversePreOrder();
    expect(await app.getTraversalOutputText()).toBe('10, 5, 3, 7, 15');

    // Verify Post-Order traversal -> left-right-root: 3, 7, 5, 15, 10
    await app.traversePostOrder();
    expect(await app.getTraversalOutputText()).toBe('3, 7, 5, 15, 10');

    // Assert no runtime errors occurred during these interactions
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S2_NodeRemoved: Remove nodes (leaf, one-child, two-children) and validate updates', async ({ page }) => {
    // This test covers RemoveNode transitions and subsequent tree/traversal updates
    const app = new BinaryTreePage(page);

    // Build the tree again: 10,5,15,3,7
    await app.addNode(10);
    await app.addNode(5);
    await app.addNode(15);
    await app.addNode(3);
    await app.addNode(7);

    // Ensure baseline in-order
    await app.traverseInOrder();
    expect(await app.getTraversalOutputText()).toBe('3, 5, 7, 10, 15');

    // 1) Remove a leaf node (3)
    await app.removeNode(3);
    await app.traverseInOrder();
    expect(await app.getTraversalOutputText()).toBe('5, 7, 10, 15');
    // Tree output should not contain '3' anymore
    expect(await app.getTreeOutputText()).not.toContain('3');

    // 2) Remove a node with one child (remove 5 which has right child 7)
    await app.removeNode(5);
    await app.traverseInOrder();
    // After removing 5, ordering should be 7,10,15
    expect(await app.getTraversalOutputText()).toBe('7, 10, 15');
    expect(await app.getTreeOutputText()).not.toContain('5');

    // 3) Remove a node with two children. Recreate a scenario:
    // Current tree: root 10 with right 15 and left 7 (7 leaf)
    // Add children to 15 to make it have two children so removing 15 demonstrates two-children removal
    await app.addNode(12);
    await app.addNode(20);
    await app.traverseInOrder();
    // Now the in-order should include 7,10,12,15,20
    expect(await app.getTraversalOutputText()).toBe('7, 10, 12, 15, 20');

    // Remove 15 (node with two children 12 and 20)
    await app.removeNode(15);
    await app.traverseInOrder();
    // After removal, 15 replaced by its inorder successor 20 (or 12 depending on implementation). Check that 15 is gone
    const inOrderAfter = await app.getTraversalOutputText();
    expect(inOrderAfter).not.toContain('15');
    // Ensure other nodes remain
    expect(inOrderAfter).toContain('7');
    expect(inOrderAfter).toContain('10');
    expect(inOrderAfter).toContain('12');
    expect(inOrderAfter).toContain('20');

    // Assert no runtime errors occurred during removal operations
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: non-numeric input, empty input, and removing non-existent node should not crash or mutate tree incorrectly', async ({ page }) => {
    // This test validates robustness and error scenarios
    const app = new BinaryTreePage(page);

    // Start with a known tree
    await app.addNode(50);
    await app.addNode(30);
    await app.addNode(70);
    await app.traverseInOrder();
    const baseline = await app.getTraversalOutputText();
    expect(baseline).toBe('30, 50, 70');

    // Case: empty input + add should not change the tree
    await app.setValue(''); // clear
    await app.addBtn.click(); // click add without numeric value
    await app.traverseInOrder();
    expect(await app.getTraversalOutputText()).toBe(baseline);

    // Case: non-numeric input (text) - input is numeric type in DOM but we attempt to fill text via script
    await app.setValue('not-a-number');
    await app.addBtn.click();
    // Should remain unchanged
    await app.traverseInOrder();
    expect(await app.getTraversalOutputText()).toBe(baseline);

    // Case: removing a non-existent node
    await app.setValue(9999);
    await app.removeBtn.click();
    // Should remain unchanged
    await app.traverseInOrder();
    expect(await app.getTraversalOutputText()).toBe(baseline);

    // Verify treeOutput visually remains consistent (contains known nodes and no error tokens)
    const treeText = await app.getTreeOutputText();
    expect(treeText).toContain('50');
    expect(treeText).toContain('30');
    expect(treeText).toContain('70');

    // No uncaught exceptions or console errors should have occurred during edge interactions
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity check: ensure updateTreeOutput and traversal outputs change DOM textContent as expected (onEnter evidence)', async ({ page }) => {
    // This test inspects that the onEnter actions (updateTreeOutput and traversal outputs) actually update the DOM
    const app = new BinaryTreePage(page);

    // Add node and confirm updateTreeOutput fired by seeing treeOutput becomes non-empty
    await app.addNode(200);
    const afterAddTree = await app.getTreeOutputText();
    expect(afterAddTree.length).toBeGreaterThan(0);
    expect(afterAddTree).toContain('200');

    // Trigger traversals and confirm traversalOutput updates each time
    await app.traverseInOrder();
    const inOrderText = await app.getTraversalOutputText();
    expect(inOrderText).toContain('200');

    await app.traversePreOrder();
    const preOrderText = await app.getTraversalOutputText();
    expect(preOrderText).toContain('200');

    await app.traversePostOrder();
    const postOrderText = await app.getTraversalOutputText();
    expect(postOrderText).toContain('200');

    // No runtime JS errors
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});