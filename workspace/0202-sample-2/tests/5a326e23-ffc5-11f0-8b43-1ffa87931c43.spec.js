import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a326e23-ffc5-11f0-8b43-1ffa87931c43.html';

// Page Object for the Binary Tree Demo
class BinaryTreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.valueInput = page.locator('#valueInput');
    this.insertBtn = page.locator('#insertBtn');
    this.clearBtn = page.locator('#clearBtn');
    this.preOrderBtn = page.locator('#preOrderBtn');
    this.inOrderBtn = page.locator('#inOrderBtn');
    this.postOrderBtn = page.locator('#postOrderBtn');
    this.levelOrderBtn = page.locator('#levelOrderBtn');
    this.traversalOutput = page.locator('#traversalOutput');
    this.canvas = page.locator('#treeCanvas');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Insert an integer value using the UI
  async insertValue(value) {
    await this.valueInput.fill(String(value));
    await this.insertBtn.click();
  }

  // Insert raw text (for invalid input tests)
  async insertRaw(text) {
    await this.valueInput.fill(String(text));
    await this.insertBtn.click();
  }

  async clearTree() {
    await this.clearBtn.click();
  }

  async clickPreOrder() {
    await this.preOrderBtn.click();
  }

  async clickInOrder() {
    await this.inOrderBtn.click();
  }

  async clickPostOrder() {
    await this.postOrderBtn.click();
  }

  async clickLevelOrder() {
    await this.levelOrderBtn.click();
  }

  async getTraversalText() {
    return (await this.traversalOutput.textContent()) ?? '';
  }

  async getInputValue() {
    return (await this.valueInput.inputValue()) ?? '';
  }

  async canvasDataURL() {
    return this.page.evaluate(() => {
      const c = document.getElementById('treeCanvas');
      // If canvas is not present for some reason, return null
      if (!c || typeof c.toDataURL !== 'function') return null;
      try {
        return c.toDataURL();
      } catch (e) {
        return null;
      }
    });
  }
}

test.describe('Binary Tree Interactive Demonstration (5a326e23-ffc5-11f0-8b43-1ffa87931c43)', () => {
  // Capture console errors and page errors for each test and assert none occurred.
  test.beforeEach(async ({ page }) => {
    // No-op here; per-test arrays will be installed in each test to avoid cross-test leakage.
  });

  test.describe('State transitions and core functionality', () => {
    test('Initial state (S0_Idle): page loads, canvas drawn, traversal output empty', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];

      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => pageErrors.push(String(err)));

      const app = new BinaryTreePage(page);
      await app.goto();

      // Validate main UI elements exist
      await expect(app.canvas).toBeVisible();
      await expect(app.valueInput).toBeVisible();
      await expect(app.insertBtn).toBeVisible();
      await expect(app.clearBtn).toBeVisible();

      // Traversal output should be empty at initial idle state
      const initialTraversal = await app.getTraversalText();
      expect(initialTraversal).toBe('', 'Expected traversal output to be empty in Idle state');

      // Canvas should have something drawn; toDataURL should return a PNG data URL
      const dataURL = await app.canvasDataURL();
      expect(dataURL).not.toBeNull();
      expect(typeof dataURL).toBe('string');
      expect(dataURL!.startsWith('data:image')).toBeTruthy();

      // Click a traversal button in idle state -> should show "Tree is empty."
      await app.clickPreOrder();
      const preText = await app.getTraversalText();
      expect(preText).toBe('Tree is empty.');

      // No console errors or page errors occurred during load and initial interactions
      expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
      expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });

    test('Insert nodes (S0 -> S2) and verify traversals (S3-S6)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));

      const app = new BinaryTreePage(page);
      await app.goto();

      // Insert a set of nodes that produce a balanced-ish BST
      const values = [50, 30, 70, 20, 40, 60, 80];
      for (const v of values) {
        await app.insertValue(v);
        // After insertion the input should be cleared and traversalOutput should be cleared
        const inputVal = await app.getInputValue();
        expect(inputVal).toBe('', 'Input should be cleared after successful insertion');
        const out = await app.getTraversalText();
        expect(out).toBe('', 'Traversal output cleared after insertion');
      }

      // Pre-order traversal (S3)
      await app.clickPreOrder();
      const expectedPre = 'Pre-order: 50, 30, 20, 40, 70, 60, 80';
      expect(await app.getTraversalText()).toBe(expectedPre);

      // In-order traversal (S4) -> should be sorted ascending
      await app.clickInOrder();
      const expectedIn = 'In-order: 20, 30, 40, 50, 60, 70, 80';
      expect(await app.getTraversalText()).toBe(expectedIn);

      // Post-order traversal (S5)
      await app.clickPostOrder();
      const expectedPost = 'Post-order: 20, 40, 30, 60, 80, 70, 50';
      expect(await app.getTraversalText()).toBe(expectedPost);

      // Level-order traversal (S6)
      await app.clickLevelOrder();
      const expectedLevel = 'Level-order: 50, 30, 70, 20, 40, 60, 80';
      expect(await app.getTraversalText()).toBe(expectedLevel);

      // No console/page errors during insertions and traversals
      expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
      expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });

    test('Clear tree transitions (S2_NodeInserted -> S0_Idle) and subsequent insertion (S1 -> S2)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));

      const app = new BinaryTreePage(page);
      await app.goto();

      // Insert a couple nodes
      await app.insertValue(10);
      await app.insertValue(5);

      // Ensure in-order shows two values
      await app.clickInOrder();
      expect(await app.getTraversalText()).toBe('In-order: 5, 10');

      // Clear tree (S2 -> S0)
      await app.clearTree();
      // After clear, traversalOutput should be empty
      expect(await app.getTraversalText()).toBe('', 'Traversal output should be cleared after clearing the tree');

      // Traversal should now report empty tree
      await app.clickPreOrder();
      expect(await app.getTraversalText()).toBe('Tree is empty.');

      // Insert after clearing (S1_TreeCleared -> S2_NodeInserted)
      await app.insertValue(42);
      // New traversal should show single-node results
      await app.clickLevelOrder();
      expect(await app.getTraversalText()).toBe('Level-order: 42');

      // No console/page errors
      expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
      expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Inserting invalid (non-integer) values shows alert dialog and does not modify tree', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));

      const app = new BinaryTreePage(page);
      await app.goto();

      // Ensure tree is empty initially
      await app.clickPreOrder();
      expect(await app.getTraversalText()).toBe('Tree is empty.');

      // Prepare to capture dialog
      const dialogs = [];
      page.on('dialog', dialog => {
        dialogs.push({ message: dialog.message(), type: dialog.type() });
        dialog.accept();
      });

      // Insert a string
      await app.insertRaw('abc');
      // Insert a float
      await app.insertRaw('3.14');
      // Insert empty string
      await app.insertRaw('');

      // We expect three dialogs to have appeared for invalid inputs
      expect(dialogs.length).toBeGreaterThanOrEqual(3);
      // Validate the dialog messages are the expected alert text
      for (const d of dialogs) {
        expect(d.type).toBe('alert');
        expect(d.message).toContain('Please enter a valid integer value.');
      }

      // Tree should still be empty after invalid attempts
      await app.clickLevelOrder();
      expect(await app.getTraversalText()).toBe('Tree is empty.');

      // No console/page errors triggered by these invalid input flows
      expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
      expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });

    test('Duplicate values are allowed and affect traversal order (duplicates go to right subtree)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(String(err)));

      const app = new BinaryTreePage(page);
      await app.goto();

      // Insert duplicates
      await app.insertValue(10);
      await app.insertValue(10); // duplicate should go to right
      await app.insertValue(10); // further duplicates to right subtree chain

      // In-order should show duplicates in non-decreasing order (left->node->right)
      await app.clickInOrder();
      const inText = await app.getTraversalText();
      // Expect three tens
      expect(inText).toBe('In-order: 10, 10, 10');

      // Pre-order should show root first then right subtree nodes
      await app.clickPreOrder();
      expect(await app.getTraversalText()).toMatch(/^Pre-order: 10(, 10){2}$/);

      // No console/page errors
      expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
      expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });
  });
});