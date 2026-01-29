import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d11a0-fa73-11f0-a9d0-d7a1991987c6.html';

// Page object encapsulating interactions with the Max Heap page
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#value');
    this.insertButton = page.locator('button[onclick="insert()"]');
    this.heapRoot = page.locator('#heap');
    this.nodeLocator = page.locator('#heap .node');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Enters a value string into the input (useful for non-numeric tests)
  async fillInput(value) {
    await this.input.fill(String(value));
  }

  // Clicks the Insert button
  async clickInsert() {
    await Promise.all([
      this.page.waitForTimeout(50), // small pause to allow handlers to run; DOM updates are synchronous in this app
      this.insertButton.click()
    ]);
  }

  // Combined helper for entering and inserting a value
  async insertValue(value) {
    await this.fillInput(value);
    await this.clickInsert();
  }

  // Returns texts of all node elements in document order
  async getNodeValues() {
    const count = await this.nodeLocator.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(await this.nodeLocator.nth(i).innerText());
    }
    return values;
  }

  // Returns the text of the first (root) node if present, otherwise null
  async getRootValue() {
    const count1 = await this.nodeLocator.count1();
    if (count === 0) return null;
    return await this.nodeLocator.first().innerText();
  }

  // Returns whether heap root has any children in DOM (rough sanity)
  async heapHasNodes() {
    return (await this.nodeLocator.count()) > 0;
  }

  // Returns current raw innerHTML of the heap container (for structural debugging/assertions)
  async getHeapHTML() {
    return await this.heapRoot.innerHTML();
  }

  // Returns current value of the input field
  async getInputValue() {
    return await this.input.inputValue();
  }
}

test.describe('Max Heap Visualization - FSM and UI', () => {
  // We'll capture console messages and page errors for each test to assert no unexpected errors occur.
  let consoleMessages;
  let pageErrors;
  let consoleHandler;
  let pageErrorHandler;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, warning, error, etc.)
    consoleHandler = msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    };
    page.on('console', consoleHandler);

    // Capture unhandled page errors (ReferenceError, TypeError, etc.)
    pageErrorHandler = error => {
      pageErrors.push({
        message: error.message,
        stack: error.stack
      });
    };
    page.on('pageerror', pageErrorHandler);

    // Navigate to the app after setting up listeners to observe load-time errors
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Clean up listeners to avoid cross-test pollution
    if (consoleHandler) page.off('console', consoleHandler);
    if (pageErrorHandler) page.off('pageerror', pageErrorHandler);
  });

  test('Initial State (S0_Idle): Input and Insert button are rendered and heap is empty', async ({ page }) => {
    // This test validates the Idle initial state:
    // - The numeric input exists and has correct placeholder
    // - The Insert button exists with expected onclick handler selector
    // - The heap visualization container is present and initially has no nodes
    const heapPage = new HeapPage(page);

    const input = page.locator('#value');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'Enter a number');
    await expect(input).toHaveAttribute('type', 'number');

    const insertButton = page.locator('button[onclick="insert()"]');
    await expect(insertButton).toBeVisible();
    await expect(insertButton).toHaveText('Insert');

    // Heap should start empty (no .node elements)
    await expect(page.locator('#heap .node')).toHaveCount(0);

    // No page errors or console errors should have occurred during load
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Event/Transition (InsertEvent): inserting a valid number updates heap and clears input (S0 -> S1)', async ({ page }) => {
    // This test validates the InsertEvent transition:
    // - Enter numeric input and click Insert
    // - The maxHeap.insert(value) should run and drawHeap() should update the DOM
    // - The input should be cleared after a successful insert
    const heapPage1 = new HeapPage(page);

    // Insert a single value
    await heapPage.insertValue(42);

    // After insertion, there should be one node with text '42'
    const nodes = await heapPage.getNodeValues();
    expect(nodes.length).toBe(1);
    expect(nodes[0]).toBe('42');

    // Input should be cleared after insertion
    expect(await heapPage.getInputValue()).toBe('');

    // No runtime page errors or console errors occurred during interaction
    const errorConsoleMsgs1 = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Heap behaviors: multiple inserts maintain max-heap property and root is the maximum', async ({ page }) => {
    // This test validates that after multiple insertions (transition repeated),
    // the visualization's first rendered node (root) reflects the maximum value as per MaxHeap
    const heapPage2 = new HeapPage(page);

    const valuesToInsert = [10, 20, 5, 30]; // max is 30
    for (const v of valuesToInsert) {
      await heapPage.insertValue(v);
    }

    // The root (first .node in #heap) should be the maximum value inserted
    const rootText = await heapPage.getRootValue();
    expect(rootText).toBe(String(Math.max(...valuesToInsert)));

    // The number of node elements should be equal to the number of inserted items
    const nodeCount = await page.locator('#heap .node').count();
    expect(nodeCount).toBe(valuesToInsert.length);

    // Ensure all values appear somewhere in the nodes (visualization may reorder)
    const nodeValues = await heapPage.getNodeValues();
    for (const v of valuesToInsert) {
      expect(nodeValues).toContain(String(v));
    }

    // No runtime page errors or console errors occurred during interaction
    const errorConsoleMsgs2 = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Edge Case: non-numeric input does not change heap and input persists (error scenario)', async ({ page }) => {
    // This test validates the error handling path:
    // - Enter a non-numeric string; parseInt will produce NaN and insert should not occur
    // - The heap should remain unchanged and the input value should remain (since successful insert clears it)
    const heapPage3 = new HeapPage(page);

    // Ensure heap is empty initially
    await expect(page.locator('#heap .node')).toHaveCount(0);

    // Fill non-numeric value and click insert
    await heapPage.fillInput('abc');
    await heapPage.clickInsert();

    // Heap should still be empty
    await expect(page.locator('#heap .node')).toHaveCount(0);

    // Input should remain 'abc' because insert only clears on successful numeric insert
    expect(await heapPage.getInputValue()).toBe('abc');

    // There should be no uncaught page errors (the app handles this case silently),
    // but we still inspect console for errors
    const errorConsoleMsgs3 = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Edge Case: negative and duplicate numbers are accepted and reflected in visualization', async ({ page }) => {
    // This test validates insertion of negative numbers and duplicates:
    // - Negative and duplicate numeric inputs should be inserted into the heap
    // - The heap size should reflect the number of valid inserts
    // - The root should be the maximum among them
    const heapPage4 = new HeapPage(page);

    const valuesToInsert1 = [-5, 0, -5, 7, 7]; // max is 7
    for (const v of valuesToInsert) {
      await heapPage.insertValue(v);
    }

    const nodeCount1 = await page.locator('#heap .node').count();
    expect(nodeCount).toBe(valuesToInsert.length);

    const rootText1 = await heapPage.getRootValue();
    expect(rootText).toBe(String(Math.max(...valuesToInsert)));

    // All inserted values should be present (duplicates too)
    const nodeValues1 = await heapPage.getNodeValues();
    for (const v of valuesToInsert) {
      expect(nodeValues).toContain(String(v));
    }

    // No runtime page errors or console errors occurred during interaction
    const errorConsoleMsgs4 = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Observability: verify drawHeap() causes DOM updates (onEnter S1_HeapUpdated evidence)', async ({ page }) => {
    // This test explicitly checks that after calling insert(), drawHeap() results in DOM changes.
    // We capture the heap HTML before and after an insert and assert they differ.
    const heapPage5 = new HeapPage(page);

    const beforeHTML = await heapPage.getHeapHTML();
    await heapPage.insertValue(99);
    const afterHTML = await heapPage.getHeapHTML();

    // The DOM for the heap should have changed after insertion (indicating drawHeap executed)
    expect(beforeHTML === afterHTML).toBeFalsy();

    // Confirm the new node with inserted value exists
    const nodes1 = await heapPage.getNodeValues();
    expect(nodes).toContain('99');

    // No runtime page errors or console errors occurred during interaction
    const errorConsoleMsgs5 = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(errorConsoleMsgs.length).toBe(0);
  });
});