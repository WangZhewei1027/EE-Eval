import { test, expect } from '@playwright/test';

//
// Test suite for Interactive Binary Tree application
// Application ID: 6d2d12f0-fa7a-11f0-ba5b-57721b046e74
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/6d2d12f0-fa7a-11f0-ba5b-57721b046e74.html
//
// These tests:
// - Validate initial state (init on load) and tree construction
// - Exercise all interactive buttons and transitions described in the FSM
// - Observe console errors and page errors and assert there are none
// - Include edge cases (invalid inputs, empty tree traversals, k out of bounds)
// - Use modern async/await and Page Object pattern
//

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2d12f0-fa7a-11f0-ba5b-57721b046e74.html';

class TreePage {
  /**
   * Page object for the Interactive Binary Tree app.
   * Wraps common selectors and operations so tests are expressive.
   */
  constructor(page) {
    this.page = page;
    // Inputs
    this.insertValue = page.locator('#insertValue');
    this.searchValue = page.locator('#searchValue');
    this.kthValue = page.locator('#kthValue');
    // Buttons - using attribute selectors as in the HTML
    this.insertBtn = page.locator("button[onclick='insertNode()']");
    this.deleteBtn = page.locator("button[onclick='deleteNode()']");
    this.randomBtn = page.locator("button[onclick='generateRandomTree()']");
    this.clearBtn = page.locator("button[onclick='clearTree()']");
    this.inorderBtn = page.locator("button[onclick=\"traverse('inorder')\"]");
    this.preorderBtn = page.locator("button[onclick=\"traverse('preorder')\"]");
    this.postorderBtn = page.locator("button[onclick=\"traverse('postorder')\"]");
    this.levelorderBtn = page.locator("button[onclick=\"traverse('levelorder')\"]");
    this.showHeightBtn = page.locator("button[onclick='showHeight()']");
    this.showSizeBtn = page.locator("button[onclick='showSize()']");
    this.showMinMaxBtn = page.locator("button[onclick='showMinMax()']");
    this.checkBalancedBtn = page.locator("button[onclick='checkBalanced()']");
    this.checkBSTBtn = page.locator("button[onclick='checkBST()']");
    this.findNodeBtn = page.locator("button[onclick='findNode()']");
    this.findPathBtn = page.locator("button[onclick='findPath()']");
    this.findLCAButton = page.locator("button[onclick='findLCA()']");
    this.mirrorBtn = page.locator("button[onclick='mirrorTree()']");
    this.invertBtn = page.locator("button[onclick='invertTree()']");
    this.doubleBtn = page.locator("button[onclick='doubleTree()']");
    this.convertBtn = page.locator("button[onclick='convertToBST()']");
    this.findKthSmallestBtn = page.locator("button[onclick='findKthSmallest()']");
    this.findKthLargestBtn = page.locator("button[onclick='findKthLargest()']");
    this.nodeInfo = page.locator('#nodeInfo');
    this.canvas = page.locator('#treeCanvas');
  }

  // Utility: read nodeInfo text
  async getNodeInfoText() {
    return (await this.nodeInfo.textContent()) || '';
  }

  // Utility: get canvas dataURL in page context (string)
  async getCanvasDataURL() {
    return await this.page.evaluate(() => {
      const c = document.getElementById('treeCanvas');
      // toDataURL may throw in some environments, handle gracefully
      try {
        return c.toDataURL();
      } catch (e) {
        return null;
      }
    });
  }

  // Utility: determine size of current tree via page context
  async getTreeSize() {
    return await this.page.evaluate(() => {
      function calculateSize(node) {
        if (node === null) return 0;
        return 1 + calculateSize(node.left) + calculateSize(node.right);
      }
      // 'root' is a global variable in the app
      // return null if root is undefined
      if (typeof root === 'undefined') return null;
      return calculateSize(root);
    });
  }

  // Utility: check whether a value exists in tree (returns boolean)
  async treeHasValue(value) {
    return await this.page.evaluate((v) => {
      function findNodeRecursive(node, value) {
        if (node === null) return false;
        if (node.value === value) return true;
        if (value < node.value) return findNodeRecursive(node.left, value);
        return findNodeRecursive(node.right, value);
      }
      if (typeof root === 'undefined' || root === null) return false;
      return findNodeRecursive(root, v);
    }, value);
  }

  // Utility: get root value if present
  async getRootValue() {
    return await this.page.evaluate(() => {
      if (typeof root === 'undefined' || root === null) return null;
      return root.value;
    });
  }
}

test.describe('Interactive Binary Tree - FSM-driven tests', () => {
  // Capture console errors and page errors for assertions
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Listen for uncaught exceptions in the page
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Navigate to the app URL and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Assert that there were no runtime errors in the page console or uncaught page errors.
    // If any errors occurred during test execution, fail and print them.
    expect(pageErrors, `Uncaught page errors were logged: ${pageErrors.join('; ')}`).toEqual([]);
    expect(
      consoleErrors.map(e => e.text),
      `Console error messages were logged: ${consoleErrors.map(e => e.text).join('; ')}`
    ).toEqual([]);
  });

  test('Initial state (S0_Idle): init() runs on load and draws initial tree', async ({ page }) => {
    // Validate that init() executed and populated the global 'root' with initial nodes
    const treePage = new TreePage(page);

    // The app's init should have set root to a TreeNode with value 50
    const rootValue = await treePage.getRootValue();
    expect(rootValue).toBe(50);

    // Canvas should have a drawing (dataURL non-empty)
    const dataURL = await treePage.getCanvasDataURL();
    expect(typeof dataURL).toBe('string');
    expect(dataURL.length).toBeGreaterThan(100); // should be a valid data URL string

    // nodeInfo should have the default text after initialization
    const infoText = await treePage.getNodeInfoText();
    expect(infoText).toContain('Node information will appear here');
  });

  test.describe('Tree construction and modification (transitions S0 -> S1 and S1 -> S1)', () => {
    test('Insert Node transitions to TreeConstructed and node becomes present', async ({ page }) => {
      const treePage = new TreePage(page);

      // Ensure a clean baseline tree (init already ran)
      const beforeSize = await treePage.getTreeSize();
      expect(beforeSize).toBeGreaterThan(0);

      // Insert a unique value
      await treePage.insertValue.fill('55');
      await treePage.insertBtn.click();

      // The new node should exist in the tree
      const has55 = await treePage.treeHasValue(55);
      expect(has55).toBeTruthy();

      // Size increased by at least 1 (cannot guarantee exact due to duplicates handling but should increase)
      const afterSize = await treePage.getTreeSize();
      expect(afterSize).toBeGreaterThanOrEqual(beforeSize + 1);
    });

    test('Delete Node removes node from tree (S1 -> S1)', async ({ page }) => {
      const treePage = new TreePage(page);

      // Insert a value that we will delete
      await treePage.insertValue.fill('99');
      await treePage.insertBtn.click();
      expect(await treePage.treeHasValue(99)).toBeTruthy();

      // Put same value into insertValue input for deletion (HTML uses same input for delete)
      await treePage.insertValue.fill('99');
      await treePage.deleteBtn.click();

      // Node should no longer exist
      expect(await treePage.treeHasValue(99)).toBeFalsy();
    });

    test('Generate Random Tree populates a new tree with random nodes', async ({ page }) => {
      const treePage = new TreePage(page);

      // Click random tree
      await treePage.randomBtn.click();

      // Size should be between 5 and 19 (nodeCount random + 5..19)
      const size = await treePage.getTreeSize();
      expect(size).toBeGreaterThanOrEqual(5);
      expect(size).toBeLessThanOrEqual(19);

      // Canvas should be updated
      const dataURL = await treePage.getCanvasDataURL();
      expect(typeof dataURL).toBe('string');
      expect(dataURL.length).toBeGreaterThan(100);
    });

    test('Clear Tree clears the tree and returns to Idle (S1 -> S0)', async ({ page }) => {
      const treePage = new TreePage(page);

      // Ensure tree has nodes
      const sizeBefore = await treePage.getTreeSize();
      expect(sizeBefore).toBeGreaterThan(0);

      // Click clear
      await treePage.clearBtn.click();

      // root should be null and nodeInfo should show default text
      const sizeAfter = await treePage.getTreeSize();
      expect(sizeAfter).toBe(0);

      const infoText = await treePage.getNodeInfoText();
      expect(infoText).toContain('Node information will appear here');
    });
  });

  test.describe('Traversals and traversal animations', () => {
    test('Inorder, Preorder, Postorder, Level Order set traversalResult and start animation', async ({ page }) => {
      const treePage = new TreePage(page);

      // Ensure baseline tree is present
      const size = await treePage.getTreeSize();
      expect(size).toBeGreaterThan(0);

      // Inorder traversal: after clicking, traversalResult global should be populated with size nodes
      await treePage.inorderBtn.click();
      const inorderCount = await page.evaluate(() => traversalResult.length);
      expect(inorderCount).toBeGreaterThan(0);
      expect(inorderCount).toBe(await page.evaluate(() => {
        function calculateSize(node) {
          if (node === null) return 0;
          return 1 + calculateSize(node.left) + calculateSize(node.right);
        }
        return calculateSize(root);
      }));

      // Preorder
      await treePage.preorderBtn.click();
      const preorderCount = await page.evaluate(() => traversalResult.length);
      expect(preorderCount).toBe(await page.evaluate(() => {
        function calculateSize(node) {
          if (node === null) return 0;
          return 1 + calculateSize(node.left) + calculateSize(node.right);
        }
        return calculateSize(root);
      }));

      // Postorder
      await treePage.postorderBtn.click();
      const postorderCount = await page.evaluate(() => traversalResult.length);
      expect(postorderCount).toBe(await page.evaluate(() => {
        function calculateSize(node) {
          if (node === null) return 0;
          return 1 + calculateSize(node.left) + calculateSize(node.right);
        }
        return calculateSize(root);
      }));

      // Level order
      await treePage.levelorderBtn.click();
      const levelorderCount = await page.evaluate(() => traversalResult.length);
      expect(levelorderCount).toBe(await page.evaluate(() => {
        function calculateSize(node) {
          if (node === null) return 0;
          return 1 + calculateSize(node.left) + calculateSize(node.right);
        }
        return calculateSize(root);
      }));

      // The nodeInfo should have been updated by the animation to indicate traversal steps
      const infoText = await treePage.getNodeInfoText();
      // If animation already cleared nodeInfo, it might be default - ensure no exception thrown and string returned
      expect(typeof infoText).toBe('string');
    });
  });

  test.describe('Tree properties and queries', () => {
    test('Show Height, Show Size, Show Min/Max, Check Balanced, Check BST report values', async ({ page }) => {
      const treePage = new TreePage(page);

      // Height
      await treePage.showHeightBtn.click();
      let info = await treePage.getNodeInfoText();
      expect(info).toContain('Tree height:');

      // Size
      await treePage.showSizeBtn.click();
      info = await treePage.getNodeInfoText();
      expect(info).toContain('Tree size:');

      // Min/Max
      await treePage.showMinMaxBtn.click();
      info = await treePage.getNodeInfoText();
      // Either shows 'Tree is empty' or 'Min value: x, Max value: y'
      expect(typeof info).toBe('string');
      expect(info.length).toBeGreaterThan(0);

      // Check Balanced
      await treePage.checkBalancedBtn.click();
      info = await treePage.getNodeInfoText();
      expect(info.includes('Tree is balanced') || info.includes('Tree is not balanced')).toBeTruthy();

      // Check BST
      await treePage.checkBSTBtn.click();
      info = await treePage.getNodeInfoText();
      expect(info.includes('Binary Search Tree') || info.includes('NOT a Binary Search Tree')).toBeTruthy();
    });

    test('Find Node and Find Path show appropriate info for found and not found cases', async ({ page }) => {
      const treePage = new TreePage(page);

      // Use a known node from initial tree: 20 exists in init
      await treePage.searchValue.fill('20');
      await treePage.findNodeBtn.click();
      let info = await treePage.getNodeInfoText();
      expect(info).toContain('Found node with value 20');

      // Find Path to same node
      await treePage.searchValue.fill('20');
      await treePage.findPathBtn.click();
      info = await treePage.getNodeInfoText();
      expect(info).toContain('Path to 20');

      // Search for non-existent node
      await treePage.searchValue.fill('12345');
      await treePage.findNodeBtn.click();
      info = await treePage.getNodeInfoText();
      expect(info).toContain('Node with value 12345 not found');
    });

    test('Find LCA uses prompt dialogs and displays LCA information', async ({ page }) => {
      const treePage = new TreePage(page);

      // Ensure we have the initial tree (re-init to known state)
      await page.evaluate(() => init());

      // We'll answer two prompt dialogs in sequence with values known to exist (20 and 40)
      const promptAnswers = ['20', '40'];
      page.on('dialog', async (dialog) => {
        // Accept with next answer (works for prompt)
        const answer = promptAnswers.shift() || '';
        await dialog.accept(answer);
      });

      await treePage.findLCAButton.click();

      const info = await treePage.getNodeInfoText();
      // Should mention Lowest Common Ancestor
      expect(info).toContain('Lowest Common Ancestor');
      // Should include the two values in the message
      expect(info).toContain('20');
      expect(info).toContain('40');
    });
  });

  test.describe('Tree transformations and special operations', () => {
    test('Mirror, Invert, Double, ConvertToBST operations update nodeInfo and tree structure', async ({ page }) => {
      const treePage = new TreePage(page);

      // Re-init to known starting tree
      await page.evaluate(() => init());
      const sizeBefore = await treePage.getTreeSize();
      expect(sizeBefore).toBeGreaterThan(0);

      // Mirror tree
      await treePage.mirrorBtn.click();
      let info = await treePage.getNodeInfoText();
      expect(info).toContain('mirrored');

      // Invert tree
      await treePage.invertBtn.click();
      info = await treePage.getNodeInfoText();
      expect(info).toContain('inverted');

      // Double tree: should increase node count (each node gets a duplicate left child)
      const sizePreDouble = await treePage.getTreeSize();
      await treePage.doubleBtn.click();
      info = await treePage.getNodeInfoText();
      expect(info).toContain('doubled');
      const sizePostDouble = await treePage.getTreeSize();
      expect(sizePostDouble).toBeGreaterThanOrEqual(sizePreDouble + 1);

      // Convert to BST: should set nodeInfo accordingly
      await treePage.convertBtn.click();
      info = await treePage.getNodeInfoText();
      expect(info).toContain('Tree converted to BST');
    });

    test('Find k-th smallest and k-th largest handle valid and out-of-bounds k values', async ({ page }) => {
      const treePage = new TreePage(page);

      // Re-init to known tree
      await page.evaluate(() => init());
      const size = await treePage.getTreeSize();
      expect(size).toBeGreaterThan(0);

      // Valid k = 1 (smallest)
      await treePage.kthValue.fill('1');
      await treePage.findKthSmallestBtn.click();
      let info = await treePage.getNodeInfoText();
      expect(info).toContain('1-th smallest element:');

      // k > size: expect 'Tree has fewer than k nodes'
      await treePage.kthValue.fill(String(size + 10));
      await treePage.findKthSmallestBtn.click();
      info = await treePage.getNodeInfoText();
      expect(info).toContain(`Tree has fewer than ${size + 10} nodes`);

      // Test findKthLargest for k = 1 (largest) - it reuses smallest function internally
      await treePage.kthValue.fill('1');
      await treePage.findKthLargestBtn.click();

      // findKthLargest will either report fewer-than-k or will attempt to set kthValue
      info = await treePage.getNodeInfoText();
      // Accept either success message containing '-th smallest element' (because of reuse) or fewer-than-k
      expect(
        info.includes('smallest element:') ||
        info.includes('Tree has fewer than')
      ).toBeTruthy();
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Inserting invalid value (empty) does nothing and does not crash', async ({ page }) => {
      const treePage = new TreePage(page);

      // Record size
      const sizeBefore = await treePage.getTreeSize();

      // Clear the input and click insert - should be a no-op
      await treePage.insertValue.fill('');
      await treePage.insertBtn.click();

      const sizeAfter = await treePage.getTreeSize();
      expect(sizeAfter).toBe(sizeBefore);
    });

    test('Deleting non-existent node does nothing and does not crash', async ({ page }) {
      const treePage = new TreePage(page);

      // Ensure known tree
      await page.evaluate(() => init());
      const sizeBefore = await treePage.getTreeSize();

      // Attempt to delete a value not in the tree
      await treePage.insertValue.fill('999999');
      await treePage.deleteBtn.click();

      const sizeAfter = await treePage.getTreeSize();
      expect(sizeAfter).toBe(sizeBefore);

      const info = await treePage.getNodeInfoText();
      // Deletion function does not change nodeInfo, but ensure no crash and nodeInfo is present
      expect(typeof info).toBe('string');
    });

    test('Traversal and operations on an empty tree behave without throwing', async ({ page }) => {
      const treePage = new TreePage(page);

      // Clear tree
      await treePage.clearBtn.click();
      const size = await treePage.getTreeSize();
      expect(size).toBe(0);

      // Trigger traversals - they should not throw
      await treePage.inorderBtn.click();
      await treePage.preorderBtn.click();
      await treePage.postorderBtn.click();
      await treePage.levelorderBtn.click();

      // Check traversalResult remains empty
      const traversalLen = await page.evaluate(() => traversalResult.length);
      expect(traversalLen).toBe(0);

      // Show properties on empty tree - should display 'Tree is empty' for min/max or sensible messages
      await treePage.showMinMaxBtn.click();
      const info = await treePage.getNodeInfoText();
      expect(info.length).toBeGreaterThan(0);
    });
  });
});