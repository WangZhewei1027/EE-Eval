import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f1805610-d366-11f0-9b19-a558354ece3e.html';

/**
 * Page object for the Binary Tree Visualization application.
 * Encapsulates common operations so tests read clearly and focus on assertions.
 */
class BinaryTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];
    this.dialogs = [];

    // Collect console error messages
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Collect uncaught exceptions from the page
    this.page.on('pageerror', error => {
      this.pageErrors.push(error);
    });

    // Collect dialogs (alerts) for validation
    this.page.on('dialog', async dialog => {
      this.dialogs.push(dialog);
      // don't automatically accept here; tests can accept if needed
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for initial rendering of nodes (script inserts sample nodes)
    await this.page.waitForLoadState('domcontentloaded');
    // The initial script creates nodes and calls visualizeTree; wait for .node presence
    await this.page.waitForSelector('.tree-container');
    // Wait a little for DOM modifications to settle
    await this.page.waitForTimeout(100);
  }

  async getNodeCount() {
    return await this.page.locator('.node').count();
  }

  async getNodeValues() {
    const nodes = this.page.locator('.node');
    const count = await nodes.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(await nodes.nth(i).textContent());
    }
    return values.map(v => v && v.trim());
  }

  async enterValue(value) {
    const input = this.page.locator('input#nodeValue');
    await input.fill(String(value));
  }

  async clickInsert() {
    await this.page.click("button[onclick='insertNode()']");
    // wait brief time for visualizeTree manipulation
    await this.page.waitForTimeout(100);
  }

  async clickDelete() {
    await this.page.click("button[onclick='deleteNode()']");
    await this.page.waitForTimeout(100);
  }

  async clickPreorder() {
    await this.page.click("button[onclick='preorderTraversal()']");
    await this.page.waitForTimeout(50);
  }

  async clickInorder() {
    await this.page.click("button[onclick='inorderTraversal()']");
    await this.page.waitForTimeout(50);
  }

  async clickPostorder() {
    await this.page.click("button[onclick='postorderTraversal()']");
    await this.page.waitForTimeout(50);
  }

  async clickClear() {
    await this.page.click("button[onclick='clearTree()']");
    await this.page.waitForTimeout(100);
  }

  async pressEnterInInput() {
    const input = this.page.locator('input#nodeValue');
    await input.press('Enter');
    await this.page.waitForTimeout(100);
  }

  async getTraversalText() {
    const el = this.page.locator('#traversalResult');
    return (await el.textContent()) || '';
  }

  getConsoleErrors() {
    return this.consoleErrors;
  }

  getPageErrors() {
    return this.pageErrors;
  }

  getDialogs() {
    return this.dialogs;
  }
}

test.describe('Binary Tree Visualization - FSM state & transition tests', () => {
  // Reload fresh page for each test to ensure deterministic starting state
  test.beforeEach(async ({ page }) => {
    // no-op here; each test will create its own BinaryTreePage and goto()
  });

  // Validate initial Idle state (S0_Idle) - visualization called on entry and initial nodes present
  test('Initial Idle state: page loads and initial tree is visualized', async ({ page }) => {
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // The implementation initializes with 7 sample nodes; verify nodes are rendered
    const nodeCount = await treePage.getNodeCount();
    // Assert that initial visualization created nodes (expected 7 based on provided script)
    expect(nodeCount).toBeGreaterThanOrEqual(7);

    // traversal result should be empty initially
    const traversalText = await treePage.getTraversalText();
    expect(traversalText.trim()).toBe('');

    // Ensure nodes have positions (left/top inline styles)
    const node = page.locator('.node').first();
    const left = await node.getAttribute('style');
    expect(left).toBeTruthy();

    // Verify no unexpected console or page errors were emitted during load
    expect(treePage.getConsoleErrors()).toEqual([]);
    expect(treePage.getPageErrors()).toEqual([]);
  });

  // Insert a node via button click (InsertNode event) and validate NodeInserted state S1_NodeInserted
  test('Insert Node via button triggers NodeInserted state and updates visualization', async ({ page }) => {
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    const beforeCount = await treePage.getNodeCount();
    await treePage.enterValue(99);
    await treePage.clickInsert();

    const afterCount = await treePage.getNodeCount();
    expect(afterCount).toBe(beforeCount + 1);

    const values = await treePage.getNodeValues();
    expect(values).toContain('99');

    // traversal result should remain unchanged (insertion doesn't auto-display traversal)
    const traversalText = await treePage.getTraversalText();
    expect(traversalText.trim()).toBe('');

    // No console or page errors
    expect(treePage.getConsoleErrors()).toEqual([]);
    expect(treePage.getPageErrors()).toEqual([]);
  });

  // Insert a node by pressing Enter in the input (InsertNodeEnter event)
  test('Insert Node via Enter key triggers NodeInserted state', async ({ page }) => {
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    const beforeCount = await treePage.getNodeCount();
    await treePage.enterValue(42);
    await treePage.pressEnterInInput();

    const afterCount = await treePage.getNodeCount();
    expect(afterCount).toBe(beforeCount + 1);

    const values = await treePage.getNodeValues();
    expect(values).toContain('42');

    // No console or page errors
    expect(treePage.getConsoleErrors()).toEqual([]);
    expect(treePage.getPageErrors()).toEqual([]);
  });

  // Delete a node using DeleteNode event and verify S2_NodeDeleted
  test('Delete Node removes a previously inserted node and visual updates', async ({ page }) => {
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // Insert a unique value to ensure predictable deletion result
    const uniqueVal = 777;
    const beforeCount = await treePage.getNodeCount();
    await treePage.enterValue(uniqueVal);
    await treePage.clickInsert();

    const afterInsertCount = await treePage.getNodeCount();
    expect(afterInsertCount).toBe(beforeCount + 1);

    // Now delete the unique value
    await treePage.enterValue(uniqueVal);
    // Accept the dialog if any (not expected for valid number)
    const deletePromise = page.waitForEvent('dialog').catch(() => null);
    await treePage.clickDelete();
    const maybeDialog = await deletePromise;
    if (maybeDialog) {
      // If a dialog appeared unexpectedly, ensure it's the validation one and then accept
      expect(maybeDialog.message()).toContain('Please enter');
      await maybeDialog.accept();
    }

    // Wait briefly for visualization to update
    await page.waitForTimeout(100);
    const afterDeleteCount = await treePage.getNodeCount();
    // Delete replaces nodeToDelete with deepest node and removes deepest node; for uniqueVal it should be removed
    expect(afterDeleteCount).toBe(beforeCount);

    const values = await treePage.getNodeValues();
    expect(values).not.toContain(String(uniqueVal));

    // No console or page errors
    expect(treePage.getConsoleErrors()).toEqual([]);
    expect(treePage.getPageErrors()).toEqual([]);
  });

  // Preorder, Inorder, Postorder traversal tests (S3, S4, S5)
  test('Traversal buttons display correct preorder, inorder, and postorder results', async ({ page }) => {
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // Based on initial inserts in the script, the tree nodes (level-order) are:
    // [10, 5, 15, 3, 7, 12, 18]
    // Preorder (Root, Left, Right): 10,5,3,7,15,12,18
    // Inorder (Left, Root, Right): 3,5,7,10,12,15,18
    // Postorder (Left, Right, Root): 3,7,5,12,18,15,10

    await treePage.clickPreorder();
    const preorderText = await treePage.getTraversalText();
    expect(preorderText).toContain('Preorder Traversal: [10, 5, 3, 7, 15, 12, 18]');

    await treePage.clickInorder();
    const inorderText = await treePage.getTraversalText();
    expect(inorderText).toContain('Inorder Traversal: [3, 5, 7, 10, 12, 15, 18]');

    await treePage.clickPostorder();
    const postorderText = await treePage.getTraversalText();
    expect(postorderText).toContain('Postorder Traversal: [3, 7, 5, 12, 18, 15, 10]');

    // No console or page errors
    expect(treePage.getConsoleErrors()).toEqual([]);
    expect(treePage.getPageErrors()).toEqual([]);
  });

  // Clear tree event (S6_TreeCleared) should clear nodes and traversal result
  test('Clear Tree clears visualization and traversal result', async ({ page }) => {
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // Ensure nodes exist initially
    const beforeCount = await treePage.getNodeCount();
    expect(beforeCount).toBeGreaterThan(0);

    // Perform a traversal first to set traversalResult, then clear
    await treePage.clickInorder();
    let traversalBefore = await treePage.getTraversalText();
    expect(traversalBefore.trim().length).toBeGreaterThan(0);

    await treePage.clickClear();

    // After clearing, traversalResult should be empty string and no .node elements
    const traversalAfter = await treePage.getTraversalText();
    expect(traversalAfter.trim()).toBe('');

    const nodeCountAfterClear = await treePage.getNodeCount();
    // Implementation clears tree and visualizeTree sets canvas empty -> expect 0 nodes
    expect(nodeCountAfterClear).toBe(0);

    // No console or page errors
    expect(treePage.getConsoleErrors()).toEqual([]);
    expect(treePage.getPageErrors()).toEqual([]);
  });

  // Edge case: invalid input should trigger an alert dialog (error scenario)
  test('Invalid input (empty or non-number) shows alert and does not change tree', async ({ page }) => {
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    // Clear input and attempt to insert with empty value
    await treePage.enterValue('');
    // Listen for dialog event explicitly
    const dialogPromise = page.waitForEvent('dialog');
    await treePage.clickInsert();
    const dialog = await dialogPromise;
    expect(dialog).toBeTruthy();
    expect(dialog.message()).toContain('Please enter a valid number');
    await dialog.accept();

    // Ensure tree remains unchanged
    const nodeCount = await treePage.getNodeCount();
    expect(nodeCount).toBeGreaterThan(0);

    // Also try a non-numeric input by directly filling (input is number type so browser will block non-numeric)
    // But simulate by setting an invalid value through evaluate to mimic user tampering (we do NOT modify app logic, only test)
    // Note: This is only reading and writing DOM values for testing; not modifying app logic.
    await page.evaluate(() => {
      const input = document.getElementById('nodeValue');
      // Force a non-numeric string into the input's value (this simulates a weird browser state)
      input.value = 'abc';
    });
    const dialogPromise2 = page.waitForEvent('dialog');
    await treePage.clickInsert();
    const dialog2 = await dialogPromise2;
    expect(dialog2).toBeTruthy();
    expect(dialog2.message()).toContain('Please enter a valid number');
    await dialog2.accept();

    // No uncaught console/page errors expected from these interactions (app uses alert for validation)
    expect(treePage.getConsoleErrors()).toEqual([]);
    expect(treePage.getPageErrors()).toEqual([]);
  });

  // Robustness test: multiple inserts should keep visual consistent (S1_NodeInserted repeated)
  test('Multiple inserts result in multiple nodes and consistent visualization', async ({ page }) => {
    const treePage = new BinaryTreePage(page);
    await treePage.goto();

    const initialCount = await treePage.getNodeCount();

    // Insert several nodes
    for (const v of [201, 202, 203]) {
      await treePage.enterValue(v);
      await treePage.clickInsert();
    }

    const finalCount = await treePage.getNodeCount();
    expect(finalCount).toBe(initialCount + 3);

    const values = await treePage.getNodeValues();
    expect(values).toContain('201');
    expect(values).toContain('202');
    expect(values).toContain('203');

    // No console or page errors
    expect(treePage.getConsoleErrors()).toEqual([]);
    expect(treePage.getPageErrors()).toEqual([]);
  });
});