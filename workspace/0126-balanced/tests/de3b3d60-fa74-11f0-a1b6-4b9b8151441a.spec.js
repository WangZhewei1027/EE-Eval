import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b3d60-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object for interacting with the BST page
class BSTPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      input: '#nodeValue',
      insertBtn: "button[onclick='insertNode()']",
      removeBtn: "button[onclick='removeNode()']",
      findBtn: "button[onclick='findNode()']",
      inOrderBtn: "button[onclick='traverseInOrder()']",
      preOrderBtn: "button[onclick='traversePreOrder()']",
      postOrderBtn: "button[onclick='traversePostOrder()']",
      clearTraversalBtn: "button[onclick='clearTraversal()']",
      generateRandomBtn: "button[onclick='generateRandomTree()']",
      clearTreeBtn: "button[onclick='clearTree()']",
      treeContainer: '#tree',
      traversalResult: '#traversalResult',
      node: '.node'
    };
  }

  async insert(value) {
    await this.page.fill(this.selectors.input, String(value));
    await this.page.click(this.selectors.insertBtn);
  }

  async remove(value) {
    await this.page.fill(this.selectors.input, String(value));
    await this.page.click(this.selectors.removeBtn);
  }

  async find(value) {
    await this.page.fill(this.selectors.input, String(value));
    // Caller should prepare to handle dialog
    await this.page.click(this.selectors.findBtn);
  }

  async traverseInOrder() {
    await this.page.click(this.selectors.inOrderBtn);
  }

  async traversePreOrder() {
    await this.page.click(this.selectors.preOrderBtn);
  }

  async traversePostOrder() {
    await this.page.click(this.selectors.postOrderBtn);
  }

  async clearTraversal() {
    await this.page.click(this.selectors.clearTraversalBtn);
  }

  async generateRandomTree() {
    await this.page.click(this.selectors.generateRandomBtn);
  }

  async clearTree() {
    await this.page.click(this.selectors.clearTreeBtn);
  }

  async getTraversalText() {
    return (await this.page.locator(this.selectors.traversalResult).textContent()) || '';
  }

  async getNodes() {
    return await this.page.$$eval(this.selectors.node, nodes =>
      nodes.map(n => ({
        value: n.dataset.value,
        text: n.textContent,
        classes: n.className
      }))
    );
  }

  async nodeExists(value) {
    const nodes = await this.getNodes();
    return nodes.some(n => String(n.value) === String(value) || n.text === String(value));
  }

  async getHighlightedValues() {
    const nodes = await this.getNodes();
    return nodes.filter(n => n.classes.includes('highlight') || n.classes.includes('found')).map(n => n.value);
  }

  async nodeCount() {
    return await this.page.locator(this.selectors.node).count();
  }
}

test.describe('Binary Search Tree (BST) Visualization - FSM based tests', () => {
  // We'll capture page errors and console errors for each test and assert none occur.
  test.beforeEach(async ({ page }) => {
    // Capture runtime errors and console error messages
    page._pageErrors = [];
    page._consoleErrors = [];

    page.on('pageerror', (err) => {
      // store Error objects
      page._pageErrors.push(err);
    });

    page.on('console', msg => {
      if (msg.type() === 'error') {
        page._consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Navigate to the application and wait for initial render
    await page.goto(APP_URL);
    await page.waitForLoadState('networkidle');

    // Wait a short time to let initial renderTree() complete
    await page.waitForTimeout(100);
  });

  test.afterEach(async ({ page }) => {
    // Ensure no unexpected runtime errors or console errors occurred during the test
    // Comments: We assert zero page errors and zero console errors so any ReferenceError/SyntaxError/TypeError
    // that occurs will cause tests to fail and be reported.
    expect(page._pageErrors.length, `pageerrors: ${page._pageErrors.map(e=>String(e)).join('; ')}`).toBe(0);
    expect(page._consoleErrors.length, `console errors: ${page._consoleErrors.map(e=>e.text).join('; ')}`).toBe(0);
  });

  test('S0_Idle: Initial render contains expected seed nodes (evidence check)', async ({ page }) => {
    // Validate initial "Idle" state: the HTML script initializes the BST with evidence nodes.
    const p = new BSTPage(page);

    // Confirm known initial nodes are rendered
    const expected = ['25', '15', '10', '20', '30', '35', '27'];
    const nodes = await p.getNodes();
    const values = nodes.map(n => String(n.value));

    // Every expected seed value should exist in the initial nodes
    for (const v of expected) {
      expect(values.includes(v)).toBeTruthy();
    }

    // Traversal result should be empty on initial render
    const traversalText = await p.getTraversalText();
    expect(traversalText.trim()).toBe('');

    // There should be at least the expected number of nodes
    expect(values.length).toBeGreaterThanOrEqual(expected.length);
  });

  test('S1_NodeInserted: Insert new node updates tree and clears input', async ({ page }) => {
    // Insert a value and verify it appears in DOM and input is cleared
    const p = new BSTPage(page);
    const initialCount = await p.nodeCount();

    await p.insert(17);

    // Wait for render
    await page.waitForTimeout(100);

    expect(await p.nodeExists(17)).toBeTruthy();
    expect(await p.nodeCount()).toBeGreaterThanOrEqual(initialCount + 1);

    // Input should be cleared after successful insert
    const inputVal = await page.$eval(p.selectors.input, el => el.value);
    expect(inputVal).toBe('');
  });

  test('S2_NodeRemoved: Remove leaf and remove node with two children update the tree', async ({ page }) => {
    // Remove a leaf node and a node with two children and verify changes
    const p = new BSTPage(page);

    // Ensure 35 exists then remove it (leaf)
    expect(await p.nodeExists(35)).toBeTruthy();
    const countBefore = await p.nodeCount();
    await p.remove(35);
    await page.waitForTimeout(100); // allow render

    expect(await p.nodeExists(35)).toBeFalsy();
    expect(await p.nodeCount()).toBeLessThanOrEqual(countBefore - 1);

    // Remove node with two children: 15 initially has left=10 and right=20
    // Re-check presence before removing
    expect(await p.nodeExists(15)).toBeTruthy();
    const countBeforeSecondRemoval = await p.nodeCount();
    await p.remove(15);
    await page.waitForTimeout(150);

    expect(await p.nodeExists(15)).toBeFalsy();
    // Tree should still have other nodes (e.g., 25)
    expect(await p.nodeExists(25)).toBeTruthy();
    expect(await p.nodeCount()).toBeLessThanOrEqual(countBeforeSecondRemoval - 1);
  });

  test('S3_NodeFound: findNode shows alert for present and absent nodes (handles dialogs)', async ({ page }) => {
    const p = new BSTPage(page);

    // Find existing node -> expect "found" alert
    const foundMessages = [];
    page.once('dialog', async (dialog) => {
      foundMessages.push(dialog.message());
      await dialog.accept();
    });
    await p.find(20);
    // Wait for dialog handler
    await page.waitForTimeout(50);
    expect(foundMessages.length).toBe(1);
    expect(foundMessages[0].toLowerCase()).toContain('found');

    // Find non-existing node -> expect "not found" alert
    const notFoundMessages = [];
    page.once('dialog', async (dialog) => {
      notFoundMessages.push(dialog.message());
      await dialog.accept();
    });
    await p.find(9999); // likely not present
    await page.waitForTimeout(50);
    expect(notFoundMessages.length).toBe(1);
    expect(notFoundMessages[0].toLowerCase()).toContain('not found');
  });

  test('S4_InOrderTraversal: In-order traversal displays expected sequence and highlights nodes', async ({ page }) => {
    const p = new BSTPage(page);

    // Run in-order traversal
    await p.traverseInOrder();
    await page.waitForTimeout(100);

    const traversalText = await p.getTraversalText();
    expect(traversalText).toMatch(/^In-Order Traversal:/);

    // The traversal nodes should be highlighted
    const highlighted = await p.getHighlightedValues();
    expect(highlighted.length).toBeGreaterThan(0);

    // Verify that highlighted list corresponds to traversal result content
    const traversalValuesFromText = traversalText.split(':')[1].trim().split('→').map(s => s.trim()).filter(Boolean);
    // normalized values as strings
    const normalizedHighlighted = highlighted.map(String);
    // Each traversed value should be among highlighted nodes
    for (const val of traversalValuesFromText) {
      if (val) expect(normalizedHighlighted).toContain(val);
    }
  });

  test('S5_PreOrderTraversal: Pre-order traversal displays sequence', async ({ page }) => {
    const p = new BSTPage(page);

    await p.traversePreOrder();
    await page.waitForTimeout(100);

    const traversalText = await p.getTraversalText();
    expect(traversalText).toMatch(/^Pre-Order Traversal:/);

    const values = traversalText.split(':')[1].trim();
    expect(values.length).toBeGreaterThan(0);
  });

  test('S6_PostOrderTraversal: Post-order traversal displays sequence', async ({ page }) => {
    const p = new BSTPage(page);

    await p.traversePostOrder();
    await page.waitForTimeout(100);

    const traversalText = await p.getTraversalText();
    expect(traversalText).toMatch(/^Post-Order Traversal:/);

    const values = traversalText.split(':')[1].trim();
    expect(values.length).toBeGreaterThan(0);
  });

  test('S8_TraversalCleared: Clearing traversal removes traversal text and highlights', async ({ page }) => {
    const p = new BSTPage(page);

    // Run a traversal to create highlights and text
    await p.traverseInOrder();
    await page.waitForTimeout(100);

    // Ensure traversal result present
    let traversalText = await p.getTraversalText();
    expect(traversalText.length).toBeGreaterThan(0);
    let highlighted = await p.getHighlightedValues();
    expect(highlighted.length).toBeGreaterThan(0);

    // Clear traversal
    await p.clearTraversal();
    await page.waitForTimeout(100);

    traversalText = await p.getTraversalText();
    expect(traversalText.trim()).toBe('');

    highlighted = await p.getHighlightedValues();
    // After clearing traversal, there should be no highlight classes
    expect(highlighted.length).toBe(0);
  });

  test('S9_RandomTreeGenerated: Generate random tree creates multiple nodes and renders', async ({ page }) => {
    const p = new BSTPage(page);

    // Clear current tree to be sure generateRandomTree starts from empty
    await p.clearTree();
    await page.waitForTimeout(100);
    expect(await p.nodeCount()).toBe(0);

    // Generate random tree
    await p.generateRandomTree();
    await page.waitForTimeout(150);

    // Random tree should produce some nodes
    const countAfter = await p.nodeCount();
    expect(countAfter).toBeGreaterThan(0);

    // Traversal result should be either empty or recalculated by user; we only assert nodes render
    const nodes = await p.getNodes();
    expect(nodes.length).toBe(countAfter);
  });

  test('S7_TreeCleared: Clear tree removes all nodes and resets traversal', async ({ page }) => {
    const p = new BSTPage(page);

    // Ensure there are nodes
    expect(await p.nodeCount()).toBeGreaterThan(0);

    // Click clear tree
    await p.clearTree();
    await page.waitForTimeout(100);

    // There should be no nodes in the tree container after clearing
    expect(await p.nodeCount()).toBe(0);

    // Traversal result should be empty
    const traversalText = await p.getTraversalText();
    expect(traversalText.trim()).toBe('');
  });

  test('Edge cases: inserting invalid input does nothing, duplicates allowed (go to right subtree)', async ({ page }) => {
    const p = new BSTPage(page);

    const beforeCount = await p.nodeCount();

    // Insert invalid input (empty) - should not change tree
    await page.click(p.selectors.insertBtn); // with empty input this should be ignored
    await page.waitForTimeout(50);
    expect(await p.nodeCount()).toBe(beforeCount);

    // Insert a duplicate value (25 already exists). According to implementation,
    // duplicates are inserted to the right subtree (since not strictly less).
    await p.insert(25);
    await page.waitForTimeout(150);

    // Node count should have increased by 1 for the duplicate
    expect(await p.nodeCount()).toBeGreaterThanOrEqual(beforeCount + 1);
    // Ensure at least one '25' exists (there will be more than one now)
    const nodes = await p.getNodes();
    const count25 = nodes.filter(n => String(n.value) === '25').length;
    expect(count25).toBeGreaterThanOrEqual(1);
  });

  test('Transitions & onEnter/onExit: renderTree called on major actions (visual verification via DOM changes)', async ({ page }) => {
    // This test verifies that actions which are supposed to call renderTree() produce visible DOM changes.
    const p = new BSTPage(page);

    // Record initial tree width or structure snapshot
    const initialNodeCount = await p.nodeCount();

    // Insert a node -> should trigger renderTree() and cause node count to increase
    await p.insert(33);
    await page.waitForTimeout(100);
    expect(await p.nodeCount()).toBeGreaterThanOrEqual(initialNodeCount + 1);

    // Run a traversal -> renderTree should be called and traversalResult updated
    await p.traverseInOrder();
    await page.waitForTimeout(100);
    const traversalText = await p.getTraversalText();
    expect(traversalText).toContain('In-Order Traversal:');

    // Clear traversal -> renderTree should be called and traversalResult cleared
    await p.clearTraversal();
    await page.waitForTimeout(100);
    expect((await p.getTraversalText()).trim()).toBe('');
  });
});