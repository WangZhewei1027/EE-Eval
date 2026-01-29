import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3b3d61-fa74-11f0-a1b6-4b9b8151441a.html';

// Simple page object wrapping common interactions and selectors
class AVLPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.insertInput = page.locator('input#insertValue');
    this.insertButton = page.locator("button[onclick='insertNode()']");
    this.deleteInput = page.locator('input#deleteValue');
    this.deleteButton = page.locator("button[onclick='deleteNode()']");
    this.searchInput = page.locator('input#searchValue');
    this.searchButton = page.locator("button[onclick='searchNode()']");
    this.clearButton = page.locator("button[onclick='clearTree()']");
    this.traverseInButton = page.locator("button[onclick='traverseInOrder()']");
    this.traversePreButton = page.locator("button[onclick='traversePreOrder()']");
    this.traversePostButton = page.locator("button[onclick='traversePostOrder()']");
    this.treeContainer = page.locator('#tree');
    this.output = page.locator('#output');
    this.nodeSelector = '.node';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async insert(value) {
    await this.insertInput.fill(String(value));
    await this.insertButton.click();
  }

  async delete(value) {
    await this.deleteInput.fill(String(value));
    await this.deleteButton.click();
  }

  async search(value) {
    await this.searchInput.fill(String(value));
    await this.searchButton.click();
  }

  async clearTree() {
    await this.clearButton.click();
  }

  async traverseInOrder() {
    await this.traverseInButton.click();
  }

  async traversePreOrder() {
    await this.traversePreButton.click();
  }

  async traversePostOrder() {
    await this.traversePostButton.click();
  }

  nodes() {
    return this.page.locator(this.nodeSelector);
  }

  nodeByValue(value) {
    return this.page.locator(`${this.nodeSelector}[data-value='${value}']`);
  }

  async outputText() {
    return (await this.output.textContent())?.trim() ?? '';
  }
}

test.describe('AVL Tree Visualization - FSM states and transitions', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Capture console messages for diagnostics
    consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    pageErrors = [];
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Initial state verification - S0_Idle
  test('Initial state (Idle) renders and shows ready message', async ({ page }) => {
    const avl = new AVLPage(page);
    await avl.goto();

    // The FSM entry action for Idle calls renderTree(); the page also logs a ready message.
    await expect(avl.output).toHaveText('AVL Tree visualization ready. Insert values to build the tree.');

    // No nodes should be present on initial load
    await expect(avl.nodes()).toHaveCount(0);

    // Ensure no uncaught page errors occurred during initial render
    expect(pageErrors.length).toBe(0);
  });

  // S1_ValueInserted transition tests
  test('Insert Node transitions to ValueInserted and renders node and log', async ({ page }) => {
    const avl = new AVLPage(page);
    await avl.goto();

    // Insert a single value -> expect a node in DOM and correct log message
    await avl.insert(10);

    // The output should reflect the inserted value (entry action logOperation)
    await expect(avl.output).toHaveText('Inserted value: 10');

    // Node with data-value 10 should exist
    await expect(avl.nodeByValue(10)).toHaveCount(1);

    // Node should have a title attribute that includes 'Height:' (renderTree adds title)
    const nodeTitle = await avl.nodeByValue(10).getAttribute('title');
    expect(nodeTitle).toContain('Height:');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Insert multiple nodes and in-order traversal reflects sorted order (ValueInserted -> TraversalCompleted)', async ({ page }) => {
    const avl = new AVLPage(page);
    await avl.goto();

    // Insert a set of values
    const values = [20, 10, 30, 5, 15];
    for (const v of values) {
      await avl.insert(v);
      await expect(avl.output).toHaveText(`Inserted value: ${v}`);
    }

    // Verify nodes rendered count matches inserted unique values
    await expect(avl.nodes()).toHaveCount(values.length);

    // Trigger in-order traversal and verify sorted order is shown in output
    await avl.traverseInOrder();
    await expect(avl.output).toHaveText('In-Order Traversal: 5, 10, 15, 20, 30');

    // Pre-order traversal
    await avl.traversePreOrder();
    // We cannot guarantee a single unique pre-order across AVL balancing without replicating rotations,
    // but with this insertion sequence typical AVL pre-order is one of the valid orders; assert the output contains numbers
    const preText = await avl.outputText();
    expect(preText.startsWith('Pre-Order Traversal:')).toBeTruthy();
    expect(preText).toContain('20'); // root should be displayed somewhere

    // Post-order traversal
    await avl.traversePostOrder();
    const postText = await avl.outputText();
    expect(postText.startsWith('Post-Order Traversal:')).toBeTruthy();
    // Ensure the output contains the numbers we expect
    for (const v of values) {
      expect(postText).toContain(String(v));
    }

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  // S2_ValueDeleted transition tests
  test('Delete Node transitions to ValueDeleted and removes node from DOM and logs deletion', async ({ page }) => {
    const avl = new AVLPage(page);
    await avl.goto();

    // Insert two nodes then delete one
    await avl.insert(100);
    await expect(avl.output).toHaveText('Inserted value: 100');

    await avl.insert(50);
    await expect(avl.output).toHaveText('Inserted value: 50');

    // Ensure both nodes are present
    await expect(avl.nodes()).toHaveCount(2);

    // Delete value 50
    await avl.delete(50);
    await expect(avl.output).toHaveText('Deleted value: 50');

    // Node with value 50 should no longer exist
    await expect(avl.nodeByValue(50)).toHaveCount(0);

    // Root or other nodes remain
    await expect(avl.nodeByValue(100)).toHaveCount(1);

    expect(pageErrors.length).toBe(0);
  });

  test('Delete non-existing value logs "not found" (ValueNotFound)', async ({ page }) => {
    const avl = new AVLPage(page);
    await avl.goto();

    // Insert a single node
    await avl.insert(7);
    await expect(avl.output).toHaveText('Inserted value: 7');

    // Attempt to delete a non-existent value
    await avl.delete(999);
    await expect(avl.output).toHaveText('Value 999 not found in the tree.');

    // Ensure original node still exists
    await expect(avl.nodeByValue(7)).toHaveCount(1);

    expect(pageErrors.length).toBe(0);
  });

  // S3_ValueFound and S4_ValueNotFound tests (Search)
  test('Search Node when present highlights node and logs found (ValueFound)', async ({ page }) => {
    const avl = new AVLPage(page);
    await avl.goto();

    // Build a small tree
    await avl.insert(40);
    await expect(avl.output).toHaveText('Inserted value: 40');
    await avl.insert(20);
    await expect(avl.output).toHaveText('Inserted value: 20');
    await avl.insert(60);
    await expect(avl.output).toHaveText('Inserted value: 60');

    // Search for existing value 20
    await avl.search(20);
    await expect(avl.output).toHaveText('Found value: 20');

    // The corresponding node should have the 'highlight' class
    const node = avl.nodeByValue(20);
    await expect(node).toHaveCount(1);
    const classAttr = await node.getAttribute('class');
    expect(classAttr).toContain('highlight');

    expect(pageErrors.length).toBe(0);
  });

  test('Search Node when absent logs not found (ValueNotFound)', async ({ page }) => {
    const avl = new AVLPage(page);
    await avl.goto();

    // Ensure tree empty or with a different value
    await avl.insert(8);
    await expect(avl.output).toHaveText('Inserted value: 8');

    // Search for a value not in tree
    await avl.search(9999);
    await expect(avl.output).toHaveText('Value 9999 not found in the tree.');

    // No nodes should be highlighted
    const highlighted = page.locator('.node.highlight');
    await expect(highlighted).toHaveCount(0);

    expect(pageErrors.length).toBe(0);
  });

  // S5_TreeCleared transition tests
  test('Clear tree transitions to TreeCleared and removes all nodes', async ({ page }) => {
    const avl = new AVLPage(page);
    await avl.goto();

    // Insert a few nodes
    await avl.insert(1);
    await expect(avl.output).toHaveText('Inserted value: 1');
    await avl.insert(2);
    await expect(avl.output).toHaveText('Inserted value: 2');

    // Clear the tree
    await avl.clearTree();
    await expect(avl.output).toHaveText('Tree cleared.');

    // The tree container should have no node elements
    await expect(avl.nodes()).toHaveCount(0);

    expect(pageErrors.length).toBe(0);
  });

  // Traversal completed state S6_TraversalCompleted was partially tested above, add edge-case traversal on empty tree
  test('Traversal on empty tree still logs traversal (TraversalCompleted on empty)', async ({ page }) => {
    const avl = new AVLPage(page);
    await avl.goto();

    // Ensure tree is empty
    await avl.clearTree();
    await expect(avl.output).toHaveText('Tree cleared.');

    // Traversal should log an empty list
    await avl.traverseInOrder();
    await expect(avl.output).toHaveText('In-Order Traversal: ');

    await avl.traversePreOrder();
    await expect(avl.output).toHaveText('Pre-Order Traversal: ');

    await avl.traversePostOrder();
    await expect(avl.output).toHaveText('Post-Order Traversal: ');

    expect(pageErrors.length).toBe(0);
  });

  // Edge case and validation message tests
  test('Invalid inputs produce validation messages for insert, delete, and search', async ({ page }) => {
    const avl = new AVLPage(page);
    await avl.goto();

    // Insert with empty input
    await avl.insert(''); // fill with empty string
    await expect(avl.output).toHaveText('Please enter a valid number to insert.');

    // Delete with empty input
    await avl.delete('');
    await expect(avl.output).toHaveText('Please enter a valid number to delete.');

    // Search with empty input
    await avl.search('');
    await expect(avl.output).toHaveText('Please enter a valid number to search.');

    expect(pageErrors.length).toBe(0);
  });

  // Diagnostics: ensure there were no console errors emitted during a typical interaction sequence
  test('No uncaught page errors or console error-level messages during typical usage', async ({ page }) => {
    const avl = new AVLPage(page);
    await avl.goto();

    // Perform a typical sequence of actions
    await avl.insert(11);
    await avl.insert(22);
    await avl.search(11);
    await avl.delete(22);
    await avl.traverseInOrder();
    await avl.clearTree();

    // Assert there were no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Ensure console didn't receive any explicit error logs (console.type === 'error')
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});