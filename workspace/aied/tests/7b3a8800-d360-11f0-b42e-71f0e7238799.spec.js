import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3a8800-d360-11f0-b42e-71f0e7238799.html';

// Page Object for the Binary Tree page
class TreePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = '#valueInput';
    this.addButton = "button[onclick='addNode()']";
    this.resetButton = "button[onclick='resetTree()']";
    this.container = '#treeContainer';
    this.levels = '.level';
    this.nodes = '.node';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillInput(value) {
    // Use fill to set numeric or empty values as needed
    await this.page.fill(this.input, String(value));
  }

  async clickAdd() {
    await this.page.click(this.addButton);
  }

  async clickReset() {
    await this.page.click(this.resetButton);
  }

  async getInputValue() {
    return this.page.$eval(this.input, el => el.value);
  }

  async getContainerInnerHTML() {
    return this.page.$eval(this.container, el => el.innerHTML);
  }

  async getLevelCount() {
    return this.page.$$eval(this.levels, els => els.length);
  }

  async getNodeValues() {
    return this.page.$$eval(this.nodes, els => els.map(e => e.textContent.trim()));
  }

  async waitForNodesCount(count, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, expected) => document.querySelectorAll(sel).length === expected,
      this.nodes,
      count,
      { timeout }
    );
  }

  async hasClassOnContainer(className) {
    return this.page.$eval(this.container, (el, cls) => el.classList.contains(cls), className);
  }
}

test.describe('Binary Tree Visualization - FSM states and transitions', () => {
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and errors for later assertions
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      // err is an Error object, capture message and stack
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    // Navigate to the application URL
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // No special teardown required, but keep hooks for clarity.
    await page.close();
  });

  test('Initial Idle state renders controls and empty tree (S0_Idle)', async ({ page }) => {
    // This test validates the initial Idle state: controls exist and tree is empty.
    const tree = new TreePage(page);

    // Verify input is present and empty
    await expect(page.locator(tree.input)).toBeVisible();
    const inputValue = await tree.getInputValue();
    expect(inputValue).toBe('', 'Input should be empty on initial render');

    // Verify Add Node and Reset Tree buttons exist with correct text
    await expect(page.locator(tree.addButton)).toBeVisible();
    await expect(page.locator(tree.resetButton)).toBeVisible();
    const addText = await page.locator(tree.addButton).textContent();
    const resetText = await page.locator(tree.resetButton).textContent();
    expect(addText.trim()).toBe('Add Node');
    expect(resetText.trim()).toBe('Reset Tree');

    // The tree container should be present and initially empty
    await expect(page.locator(tree.container)).toBeVisible();
    const containerHTML = await tree.getContainerInnerHTML();
    expect(containerHTML).toBe('', 'treeContainer should be empty initially');

    // The container should have class 'tree' as in implementation
    const hasTreeClass = await tree.hasClassOnContainer('tree');
    expect(hasTreeClass).toBe(true);

    // Validate no uncaught page errors occurred during load
    expect(pageErrors.length).toBe(0, `No page errors expected on load, found: ${JSON.stringify(pageErrors)}`);

    // Also assert there are no console.error messages
    expect(consoleErrors.length).toBe(0);
  });

  test('AddNode transition: adding a single node displays it in visualization (S0_Idle -> S1_NodeAdded)', async ({ page }) => {
    // This test validates adding one node transitions to NodeAdded and updates DOM
    const tree = new TreePage(page);

    // Add a value 10
    await tree.fillInput(10);
    await tree.clickAdd();

    // After adding, input should be cleared
    const inputValue = await tree.getInputValue();
    expect(inputValue).toBe('', 'Input should be cleared after successful addNode()');

    // The tree should now have one level with one node showing "10"
    await expect(page.locator(`${tree.levels} ${tree.nodes}`)).toHaveCount(1);
    const nodeValues = await tree.getNodeValues();
    expect(nodeValues).toEqual(['10']);

    // Validate no uncaught page errors or console errors were emitted by adding
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Add multiple nodes: verify tree structure and transitions (S1_NodeAdded -> S0_Idle etc.)', async ({ page }) => {
    // This test validates repeated AddNode behaviour and basic binary placement logic
    const tree = new TreePage(page);

    // Insert root 10
    await tree.fillInput(10);
    await tree.clickAdd();
    await tree.waitForNodesCount(1);

    // Insert 5 (should go left)
    await tree.fillInput(5);
    await tree.clickAdd();
    // Insert 15 (should go right)
    await tree.fillInput(15);
    await tree.clickAdd();

    // Now there should be nodes 10 (level 0), 5 and 15 (level 1)
    const levelCount = await tree.getLevelCount();
    expect(levelCount).toBeGreaterThanOrEqual(2, 'Expected at least 2 levels after adding root, left and right children');

    const nodeValues = await tree.getNodeValues();
    // Order in DOM for level-by-level may place 5 and 15 in level1; ensure all values present
    expect(nodeValues).toContain('10');
    expect(nodeValues).toContain('5');
    expect(nodeValues).toContain('15');

    // Visual check: count of nodes should be 3
    await expect(page.locator(tree.nodes)).toHaveCount(3);

    // Confirm no uncaught errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ResetTree transition clears visualization and input (S1_NodeAdded -> S2_TreeReset -> S0_Idle)', async ({ page }) => {
    // This test validates resetTree clears the tree and resets input
    const tree = new TreePage(page);

    // Add a node first
    await tree.fillInput(42);
    await tree.clickAdd();
    await tree.waitForNodesCount(1);
    await expect(page.locator(tree.nodes)).toHaveCount(1);

    // Now reset
    await tree.clickReset();

    // After reset the container should be empty and input cleared
    const containerHTML = await tree.getContainerInnerHTML();
    expect(containerHTML).toBe('', 'treeContainer should be cleared after resetTree()');

    const inputValue = await tree.getInputValue();
    expect(inputValue).toBe('', 'Input should be cleared after resetTree()');

    // No nodes should be present
    await expect(page.locator(tree.nodes)).toHaveCount(0);

    // Confirm no uncaught errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ResetTree on already-empty tree leaves state stable (S0_Idle -> S2_TreeReset -> S0_Idle)', async ({ page }) => {
    // This test validates calling reset when nothing exists does not throw and keeps tree empty
    const tree = new TreePage(page);

    // Ensure starting empty
    const initialHTML = await tree.getContainerInnerHTML();
    expect(initialHTML).toBe('');

    // Click reset
    await tree.clickReset();

    // Should remain empty
    const afterHTML = await tree.getContainerInnerHTML();
    expect(afterHTML).toBe('');

    // Input remains empty
    const inputValue = await tree.getInputValue();
    expect(inputValue).toBe('');

    // No uncaught errors expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: invalid input triggers alert and does not modify the tree', async ({ page }) => {
    // This test validates the error scenario when Add Node is triggered with invalid input
    const tree = new TreePage(page);

    // Ensure tree empty to begin
    const beforeHTML = await tree.getContainerInnerHTML();
    expect(beforeHTML).toBe('');

    // Leave input empty and click add - should show an alert
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click(tree.addButton)
    ]);

    // Assert dialog message matches expected alert text
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe('Please enter a valid number.');

    // Dismiss the dialog (alert must be accepted)
    await dialog.accept();

    // Tree should remain unchanged
    const afterHTML = await tree.getContainerInnerHTML();
    expect(afterHTML).toBe('', 'Tree should not be modified after invalid add attempt');

    // No uncaught errors expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observes console and page errors; verify no ReferenceError for missing FSM hooks like renderPage()', async ({ page }) => {
    // This test explicitly inspects captured console and page errors to ensure there are no ReferenceErrors
    // related to non-existent FSM hook calls (e.g., renderPage())
    const tree = new TreePage(page);

    // Add a quick sanity operation to allow any deferred errors to surface
    await tree.fillInput(1);
    await tree.clickAdd();

    // Give a short moment for any asynchronous errors to appear
    await page.waitForTimeout(200);

    // Check that none of the page errors are ReferenceError or mention renderPage
    const referenceErrors = pageErrors.filter(e => {
      const msg = e.message || '';
      return msg.includes('ReferenceError') || msg.includes('renderPage');
    });

    // Assert no such errors found
    expect(referenceErrors.length).toBe(0, `No ReferenceError related to renderPage expected, found: ${JSON.stringify(referenceErrors)}`);

    // Also ensure console errors do not indicate ReferenceError
    const consoleRefErrors = consoleErrors.filter(text => text.includes('ReferenceError') || text.includes('renderPage'));
    expect(consoleRefErrors.length).toBe(0);

    // Finally, assert no pageerrors at all (defensive)
    expect(pageErrors.length).toBe(0);
  });
});