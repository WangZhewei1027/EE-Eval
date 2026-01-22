import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/1762a2f1-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object for the Binary Tree page
class TreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputValue');
    this.addButton = page.locator('button[onclick="addNode()"]');
    this.tree = page.locator('#tree');
    this.levels = page.locator('#tree .level');
    this.nodes = page.locator('#tree .node');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async addNode(value) {
    // type value to input and click add
    await this.input.fill(String(value));
    await this.addButton.click();
  }

  async clickAddWithoutTyping() {
    await this.addButton.click();
  }

  async getInputValue() {
    return await this.input.inputValue();
  }

  async getNodeCount() {
    return await this.nodes.count();
  }

  async getLevelCount() {
    return await this.levels.count();
  }

  // Return array of text contents for nodes in a given level (1-based index)
  async getNodesTextInLevel(levelIndex) {
    // levelIndex is 0-based here
    const level = this.levels.nth(levelIndex);
    const count = await level.locator('.node').count();
    const results = [];
    for (let i = 0; i < count; i++) {
      results.push(await level.locator('.node').nth(i).textContent());
    }
    return results;
  }

  async getAllNodeTexts() {
    const cnt = await this.getNodeCount();
    const texts = [];
    for (let i = 0; i < cnt; i++) {
      texts.push(await this.nodes.nth(i).textContent());
    }
    return texts;
  }
}

test.describe('Binary Tree Visualization - FSM validation', () => {
  let treePage;
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors and page errors to assert later
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    treePage = new TreePage(page);
    await treePage.goto();
  });

  test.afterEach(async () => {
    // In most tests we expect the application to run without runtime exceptions.
    // Collect any console/page errors and assert none occurred at the end of each test.
    expect(consoleErrors, `Console errors detected: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `Page errors detected: ${pageErrors.map(e => String(e)).join(' | ')}`).toHaveLength(0);
  });

  test('Initial Idle state: input and Add Node button are present and tree is empty', async () => {
    // Validate initial (Idle) state as per FSM S0_Idle:
    // - input exists with placeholder
    // - Add Node button exists
    // - tree container empty (no node elements)
    await expect(treePage.input).toBeVisible();
    await expect(treePage.input).toHaveAttribute('placeholder', 'Enter a value');
    await expect(treePage.addButton).toBeVisible();

    const nodeCount = await treePage.getNodeCount();
    expect(nodeCount).toBe(0);

    // Ensure input is initially empty
    const initialInputValue = await treePage.getInputValue();
    expect(initialInputValue).toBe('');
  });

  test('Add Node transition: entering a value and clicking Add Node displays the node and clears input', async () => {
    // This validates the transition S0_Idle -> S1_NodeAdded:
    // - tree.insert(Number(inputValue)) executed resulting in a node shown
    // - displayTree() caused DOM update with a .node
    // - input is cleared after adding (onExit behavior observed)
    await treePage.addNode(10);

    // One node should now be displayed with text '10'
    const nodeCount = await treePage.getNodeCount();
    expect(nodeCount).toBeGreaterThanOrEqual(1);

    const texts = await treePage.getAllNodeTexts();
    // The root (first node added) should be visible and equal to '10'
    expect(texts).toContain('10');

    // Input should be cleared after addNode()
    const valueAfterAdd = await treePage.getInputValue();
    expect(valueAfterAdd).toBe('');
  });

  test('Adding multiple nodes maintains level structure (BST visualization)', async () => {
    // Add root then left and right nodes to form two levels and verify DOM levels
    await treePage.addNode(10); // root
    await treePage.addNode(5);  // left of 10
    await treePage.addNode(15); // right of 10

    // There should now be at least 3 nodes
    expect(await treePage.getNodeCount()).toBeGreaterThanOrEqual(3);

    // There should be two levels: first with root, second with two nodes
    const levelCount = await treePage.getLevelCount();
    expect(levelCount).toBeGreaterThanOrEqual(2);

    // Verify text content for level 0 (root) and level 1 (children)
    const level0 = await treePage.getNodesTextInLevel(0);
    const level1 = await treePage.getNodesTextInLevel(1);

    // Root level should contain '10'
    expect(level0).toContain('10');

    // Level 1 (children) should contain both '5' and '15' in left-to-right order
    // The implementation collects left then right, so expect ['5', '15']
    // We do a loose check for both nodes being present
    expect(level1).toEqual(expect.arrayContaining(['5', '15']));
  });

  test('Clicking Add Node with empty input does nothing and does not throw errors', async () => {
    // Ensure starting from empty tree
    // Click Add Node while input empty
    await treePage.clickAddWithoutTyping();

    // No nodes should be added
    expect(await treePage.getNodeCount()).toBe(0);

    // Input should remain empty
    expect(await treePage.getInputValue()).toBe('');

    // No console or page errors should have been emitted (checked in afterEach)
  });

  test('Adding a non-numeric value results in a "NaN" node being inserted and input cleared (edge case)', async () => {
    // The implementation uses Number(inputValue) which yields NaN for non-numeric strings.
    // We validate that the tree still inserts a node whose textContent will be 'NaN'
    await treePage.addNode('abc');

    // Node(s) should exist
    expect(await treePage.getNodeCount()).toBeGreaterThanOrEqual(1);

    // At least one node's text should be 'NaN'
    const texts = await treePage.getAllNodeTexts();
    expect(texts).toContain('NaN');

    // Input should be cleared after attempting to add the non-numeric value
    expect(await treePage.getInputValue()).toBe('');
  });

  test('Repeated add of same value produces correct number of nodes and updates visualization', async () => {
    // Add duplicate values: duplicates in this BST implementation go to the right branch
    await treePage.addNode(20);
    await treePage.addNode(20); // duplicate
    await treePage.addNode(20); // duplicate

    // There should be at least 3 nodes now
    expect(await treePage.getNodeCount()).toBeGreaterThanOrEqual(3);

    // Check that nodes with text '20' appear at least three times
    const texts = await treePage.getAllNodeTexts();
    const occurrences = texts.filter(t => t === '20').length;
    expect(occurrences).toBeGreaterThanOrEqual(3);
  });

  test('FSM entry action renderPage() absence does not produce ReferenceError on load', async ({ page }) => {
    // FSM mentions an entry action renderPage(), but the page does not call it.
    // We assert that no ReferenceError related to renderPage occurred during load.
    // The pageErrors and consoleErrors are asserted to be empty in afterEach.
    // Additionally, explicitly check for any ReferenceError mention in collected arrays (defensive).
    const allConsoleErrorTexts = consoleErrors.join(' | ');
    const anyRefError = allConsoleErrorTexts.includes('ReferenceError') || pageErrors.some(e => String(e).includes('ReferenceError'));
    expect(anyRefError).toBe(false);
  });
});