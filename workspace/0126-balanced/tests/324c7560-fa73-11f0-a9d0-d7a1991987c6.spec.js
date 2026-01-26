import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324c7560-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Doubly Linked List page
class DoublyLinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    this._boundConsole = null;
    this._boundPageError = null;
  }

  // Navigate to the app and attach listeners for console/page errors
  async goto() {
    // attach listeners before navigation to catch early errors
    this.consoleMessages = [];
    this.pageErrors = [];

    this._boundConsole = (msg) => {
      // Capture all console messages for later assertions
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    };
    this.page.on('console', this._boundConsole);

    this._boundPageError = (err) => {
      // Uncaught exceptions on the page
      this.pageErrors.push(err);
    };
    this.page.on('pageerror', this._boundPageError);

    await this.page.goto(APP_URL);
    // Wait a small time to allow initial scripts/render to run
    await this.page.waitForTimeout(50);
  }

  // Clean up listeners if any
  async teardown() {
    if (this._boundConsole) this.page.off('console', this._boundConsole);
    if (this._boundPageError) this.page.off('pageerror', this._boundPageError);
  }

  // Get the input element handle
  input() {
    return this.page.locator('#nodeValue');
  }

  addButton() {
    return this.page.locator('button[onclick="addNode()"]');
  }

  removeButton() {
    return this.page.locator('button[onclick="removeNode()"]');
  }

  listContainer() {
    return this.page.locator('#listContainer');
  }

  // Simulate adding a node via the UI (fills input and clicks Add Node)
  async addNode(value) {
    await this.input().fill(value);
    await this.addButton().click();
    // Allow render to update DOM
    await this.page.waitForTimeout(50);
  }

  // Click Remove Node button
  async removeNode() {
    await this.removeButton().click();
    // Allow render to update DOM
    await this.page.waitForTimeout(50);
  }

  // Return array of node text values in order
  async getNodes() {
    const nodeLocators = this.listContainer().locator('.node');
    const count = await nodeLocators.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(await nodeLocators.nth(i).innerText());
    }
    return values;
  }

  // Return array of pointer texts (-> or <-) in DOM order
  async getPointers() {
    const pointerLocators = this.listContainer().locator('.pointer');
    const count = await pointerLocators.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(await pointerLocators.nth(i).innerText());
    }
    return values;
  }

  // Get current value of the input field
  async getInputValue() {
    return await this.input().inputValue();
  }

  // Return captured console messages (all)
  getConsoleMessages() {
    return this.consoleMessages.slice();
  }

  // Filter captured console errors (type === 'error')
  getConsoleErrors() {
    return this.consoleMessages.filter(m => m.type === 'error');
  }

  // Return captured page errors (uncaught exceptions)
  getPageErrors() {
    return this.pageErrors.slice();
  }

  // Utility to wait until nodes count equals expected (with timeout)
  async waitForNodesCount(expected, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, expectedCount) => {
        const container = document.querySelector(sel);
        if (!container) return false;
        return container.querySelectorAll('.node').length === expectedCount;
      },
      '#listContainer',
      expected,
      { timeout }
    );
  }
}

test.describe('Doubly Linked List - FSM and UI validation', () => {
  let pageObject;

  test.beforeEach(async ({ page }) => {
    pageObject = new DoublyLinkedListPage(page);
    await pageObject.goto();
  });

  test.afterEach(async () => {
    await pageObject.teardown();
  });

  test('Initial state (S0_Idle): input visible, list empty, no runtime errors', async () => {
    // Verify input exists and placeholder matches expected idle evidence
    const input = pageObject.input();
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'Enter node value');

    // List container should start empty (no .node elements)
    const nodes = await pageObject.getNodes();
    expect(nodes).toEqual([]);

    // No console errors or page errors should have occurred on initial load
    const consoleErrors = pageObject.getConsoleErrors();
    const pageErrors = pageObject.getPageErrors();
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Add Node (S0 -> S1): adding a node renders it and clears input', async () => {
    // Add a node with value 'A'
    await pageObject.addNode('A');

    // After adding, the node should be present in the visual list (Node Added state)
    const nodes = await pageObject.getNodes();
    expect(nodes).toEqual(['A']);

    // The input should have been cleared according to FSM evidence/documentation
    const inputValue = await pageObject.getInputValue();
    expect(inputValue).toBe('');

    // Ensure render updated the DOM (pointer elements should be zero for single node)
    const pointers = await pageObject.getPointers();
    expect(pointers.length).toBe(0);

    // Verify no runtime console/page errors occurred during add
    expect(pageObject.getConsoleErrors().length).toBe(0);
    expect(pageObject.getPageErrors().length).toBe(0);
  });

  test('Multiple adds show correct pointers and ordering (S1 -> S0 -> S1 ...)', async () => {
    // Add two nodes sequentially and verify structure
    await pageObject.addNode('A');
    await pageObject.addNode('B');

    // Nodes should be in insertion order
    const nodes = await pageObject.getNodes();
    expect(nodes).toEqual(['A', 'B']);

    // Inspect pointers sequence in DOM order.
    // Expected DOM: [node A, '->', '<-', node B] => pointers in order: ['->', '<-']
    const pointers = await pageObject.getPointers();
    expect(pointers).toEqual(['->', '<-']);

    // Input should be cleared after each add (check again)
    expect(await pageObject.getInputValue()).toBe('');

    // No errors expected
    expect(pageObject.getConsoleErrors().length).toBe(0);
    expect(pageObject.getPageErrors().length).toBe(0);
  });

  test('Remove Node (S0 -> S2): removing tail updates list and subsequent remove empties it (S2 -> S0)', async () => {
    // Prepare list with two nodes
    await pageObject.addNode('A');
    await pageObject.addNode('B');

    // Remove should remove the tail (B)
    await pageObject.removeNode();
    let nodes = await pageObject.getNodes();
    expect(nodes).toEqual(['A']);

    // Removing again should remove the last node and leave the list empty
    await pageObject.removeNode();
    nodes = await pageObject.getNodes();
    expect(nodes).toEqual([]);

    // Removing once more (on empty) should be a no-op and must not throw errors
    await pageObject.removeNode();
    expect(await pageObject.getNodes()).toEqual([]);

    // Confirm no uncaught page errors or console error messages happened during removes
    expect(pageObject.getConsoleErrors().length).toBe(0);
    expect(pageObject.getPageErrors().length).toBe(0);
  });

  test('Edge case: adding with empty input does nothing and does not error', async () => {
    // Ensure input is empty
    await pageObject.input().fill('');
    await pageObject.addButton().click();
    // Small wait to ensure any potential errors manifest
    await pageObject.page.waitForTimeout(50);

    // List should still be empty
    expect(await pageObject.getNodes()).toEqual([]);

    // No console errors or page errors should have occurred
    expect(pageObject.getConsoleErrors().length).toBe(0);
    expect(pageObject.getPageErrors().length).toBe(0);
  });

  test('Edge case: long or special character node values render correctly', async () => {
    const longValue = 'Node-💡-Long-Value-!@#$%^&*()_+';
    await pageObject.addNode(longValue);

    // The node text should match exactly the value added
    const nodes = await pageObject.getNodes();
    expect(nodes).toEqual([longValue]);

    // No runtime errors expected
    expect(pageObject.getConsoleErrors().length).toBe(0);
    expect(pageObject.getPageErrors().length).toBe(0);
  });

  test('Monitoring: collect console and page errors during a sequence of actions (should be none)', async () => {
    // Perform a sequence of actions that exercise the FSM transitions
    await pageObject.addNode('X');
    await pageObject.addNode('Y');
    await pageObject.removeNode();
    await pageObject.removeNode();
    await pageObject.removeNode(); // redundant remove to stress edge-case

    // After sequence, assert that no console errors or uncaught page errors were observed
    const consoleErrors = pageObject.getConsoleErrors();
    const pageErrors = pageObject.getPageErrors();

    // Provide diagnostic output in test failure messages if any errors exist
    expect(consoleErrors.length, `Console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${pageErrors.map(e => e.toString()).join('; ')}`).toBe(0);
  });

  test('Sanity check: render produces expected DOM structure when adding three nodes', async () => {
    // Add three nodes and verify nodes and pointers structure
    await pageObject.addNode('1');
    await pageObject.addNode('2');
    await pageObject.addNode('3');

    const nodes = await pageObject.getNodes();
    expect(nodes).toEqual(['1', '2', '3']);

    // For three nodes, pointer elements order:
    // Node1, '->', '<-', Node2, '->', '<-', Node3 => pointers: ['->','<-','->','<-']
    const pointers = await pageObject.getPointers();
    expect(pointers).toEqual(['->', '<-', '->', '<-']);

    // No runtime errors
    expect(pageObject.getConsoleErrors().length).toBe(0);
    expect(pageObject.getPageErrors().length).toBe(0);
  });
});