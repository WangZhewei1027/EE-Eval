import { test, expect } from '@playwright/test';

// URL of the page under test
const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17622dc0-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object for the Linked List demo
class LinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#value');
    this.addButton = page.locator('button[onclick="addNode()"]');
    this.removeButton = page.locator('button[onclick="removeNode()"]');
    this.list = page.locator('#list');
    this.nodeItems = page.locator('#list .node');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for critical UI elements to be present
    await Promise.all([
      this.input.waitFor({ state: 'visible' }),
      this.addButton.waitFor({ state: 'visible' }),
      this.removeButton.waitFor({ state: 'visible' }),
      this.list.waitFor({ state: 'visible' }),
    ]);
  }

  async addNode(value) {
    await this.input.fill(value);
    await this.addButton.click();
    // After adding, ensure nodes may appear
    await this.page.waitForTimeout(50); // small delay to let DOM update
  }

  async removeNode() {
    await this.removeButton.click();
    await this.page.waitForTimeout(50); // small delay to let DOM update
  }

  async getNodeValues() {
    const count = await this.nodeItems.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(await this.nodeItems.nth(i).textContent());
    }
    return values;
  }

  async nodeCount() {
    return await this.nodeItems.count();
  }
}

test.describe('Linked List Demo - FSM states and transitions', () => {
  // Collect console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Enable pass-through for dialogs not to block tests unless intentionally handled
    page.on('dialog', async dialog => {
      // For safety, accept any dialog that isn't explicitly asserted in a test.
      // Tests that verify dialog messages will use page.once('dialog', ...) before the triggering action.
      await dialog.dismiss();
    });
  });

  // Test the initial Idle state rendering and no runtime errors on load
  test('Initial Idle state: page renders input, buttons, and empty list; no console errors', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    const listPage = new LinkedListPage(page);
    // Navigate to app
    await listPage.goto();

    // Validate Idle state UI evidence per FSM
    await expect(listPage.input).toBeVisible();
    await expect(listPage.input).toHaveAttribute('placeholder', 'Enter node value');
    await expect(listPage.addButton).toBeVisible();
    await expect(listPage.removeButton).toBeVisible();
    await expect(listPage.list).toBeVisible();

    // The list should be empty initially (S0_Idle entry action: renderPage())
    const initialCount = await listPage.nodeCount();
    expect(initialCount).toBe(0);

    // Assert that there were no uncaught page errors and no console.error messages
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors).toEqual([]);
    expect(errorConsoleMsgs).toEqual([]);
  });

  // Tests covering AddNode transitions: S0 -> S1 and S1 -> S1 (add multiple)
  test.describe('Add Node transitions (AddNode event)', () => {
    test('Add a single node transitions Idle -> Node Added (S0 -> S1): DOM updates and value cleared', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const listPage = new LinkedListPage(page);
      await listPage.goto();

      // Add a node with value 'A'
      await listPage.addNode('A');

      // After add, linkedList.render() should have been called (observed via DOM)
      const values = await listPage.getNodeValues();
      expect(values).toEqual(['A']);

      // The input should be cleared after successful add
      await expect(listPage.input).toHaveValue('');

      // Ensure no runtime errors occurred during add
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(pageErrors).toEqual([]);
      expect(errorConsoleMsgs).toEqual([]);
    });

    test('Add multiple nodes transitions Node Added -> Node Added (S1 -> S1): list grows in FIFO order', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const listPage = new LinkedListPage(page);
      await listPage.goto();

      // Add multiple nodes: 'A', 'B', 'C'
      await listPage.addNode('A');
      await listPage.addNode('B');
      await listPage.addNode('C');

      // Verify the nodes are shown in insertion order (linked list append behavior)
      const values = await listPage.getNodeValues();
      expect(values).toEqual(['A', 'B', 'C']);

      // Node count should be 3
      expect(await listPage.nodeCount()).toBe(3);

      // No uncaught runtime errors
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(pageErrors).toEqual([]);
      expect(errorConsoleMsgs).toEqual([]);
    });

    test('Edge case: clicking Add Node with empty input triggers alert and does not modify list', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const listPage = new LinkedListPage(page);
      await listPage.goto();

      // Ensure list empty to start
      expect(await listPage.nodeCount()).toBe(0);

      // Listen for the alert dialog and assert its message
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        listPage.addButton.click(), // click without entering a value
      ]);
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Please enter a value!');
      await dialog.accept();

      // List should remain unchanged
      expect(await listPage.nodeCount()).toBe(0);

      // No uncaught runtime errors
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(pageErrors).toEqual([]);
      expect(errorConsoleMsgs).toEqual([]);
    });
  });

  // Tests covering RemoveNode transitions: S0 -> S2 and S1 -> S2 and S2 -> S2
  test.describe('Remove Node transitions (RemoveNode event)', () => {
    test('Remove from empty list transitions Idle -> Node Removed (S0 -> S2): shows alert and no DOM change', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const listPage = new LinkedListPage(page);
      await listPage.goto();

      // Ensure empty initially
      expect(await listPage.nodeCount()).toBe(0);

      // Click remove and assert alert "List is empty!"
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        listPage.removeButton.click(),
      ]);
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('List is empty!');
      await dialog.accept();

      // List still empty
      expect(await listPage.nodeCount()).toBe(0);

      // No uncaught runtime errors
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(pageErrors).toEqual([]);
      expect(errorConsoleMsgs).toEqual([]);
    });

    test('Remove when nodes present transitions Node Added -> Node Removed (S1 -> S2): last node removed', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const listPage = new LinkedListPage(page);
      await listPage.goto();

      // Add nodes 'A' and 'B'
      await listPage.addNode('A');
      await listPage.addNode('B');
      expect(await listPage.getNodeValues()).toEqual(['A', 'B']);

      // Remove should delete the last node (B)
      await listPage.removeNode();
      expect(await listPage.getNodeValues()).toEqual(['A']);

      // Another remove should remove the remaining node and leave list empty
      await listPage.removeNode();
      expect(await listPage.nodeCount()).toBe(0);

      // Removing once more should trigger 'List is empty!' alert (S2 -> S2)
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        listPage.removeButton.click(),
      ]);
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('List is empty!');
      await dialog.accept();

      // No uncaught runtime errors
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(pageErrors).toEqual([]);
      expect(errorConsoleMsgs).toEqual([]);
    });

    test('Repeated removes on populated list (S2 -> S2 behavior): removes nodes until empty and alerts', async ({ page }) => {
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      const listPage = new LinkedListPage(page);
      await listPage.goto();

      // Add three nodes
      await listPage.addNode('1');
      await listPage.addNode('2');
      await listPage.addNode('3');
      expect(await listPage.getNodeValues()).toEqual(['1', '2', '3']);

      // Remove three times
      await listPage.removeNode(); // removes 3
      expect(await listPage.getNodeValues()).toEqual(['1', '2']);
      await listPage.removeNode(); // removes 2
      expect(await listPage.getNodeValues()).toEqual(['1']);
      await listPage.removeNode(); // removes 1
      expect(await listPage.nodeCount()).toBe(0);

      // Further remove should alert 'List is empty!'
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        listPage.removeButton.click(),
      ]);
      expect(dialog.message()).toBe('List is empty!');
      await dialog.accept();

      // No uncaught runtime errors
      const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
      expect(pageErrors).toEqual([]);
      expect(errorConsoleMsgs).toEqual([]);
    });
  });

  // Sanity checks for render side-effects (onEnter actions: linkedList.render)
  test('Calling addNode/removeNode triggers render side-effects observable in DOM (verify onEnter actions)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const listPage = new LinkedListPage(page);
    await listPage.goto();

    // Initially empty
    expect(await listPage.nodeCount()).toBe(0);

    // Add node and check DOM updated (linkedList.render invoked internally)
    await listPage.addNode('X');
    expect(await listPage.getNodeValues()).toEqual(['X']);

    // Remove node and check DOM updated (linkedList.render invoked internally)
    await listPage.removeNode();
    expect(await listPage.nodeCount()).toBe(0);

    // No uncaught runtime errors
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors).toEqual([]);
    expect(errorConsoleMsgs).toEqual([]);
  });
});