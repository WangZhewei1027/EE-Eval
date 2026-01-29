import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324cea94-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Min Heap page
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages and page errors for assertions later
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // store the Error object or message for later inspection
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setInput(value) {
    await this.page.fill('#value', String(value));
  }

  async getInputValue() {
    return await this.page.inputValue('#value');
  }

  async clickInsert() {
    await Promise.all([
      // clicking triggers JS which updates DOM; wait for potential DOM changes
      this.page.click('button[onclick="insert()"]'),
      this.page.waitForTimeout(50) // slight pause to let display() update DOM
    ]);
  }

  async clickRemoveMin() {
    // removeMin triggers an alert; return the dialog message captured
    let dialogMessage = null;
    const dialogPromise = this.page.waitForEvent('dialog').then(dialog => {
      dialogMessage = dialog.message();
      return dialog.accept();
    });
    await this.page.click('button[onclick="removeMin()"]');
    // wait for the dialog handling
    await dialogPromise;
    // allow DOM update after display()
    await this.page.waitForTimeout(50);
    return dialogMessage;
  }

  async clickDisplayHeap() {
    await Promise.all([
      this.page.click('button[onclick="displayHeap()"]'),
      this.page.waitForTimeout(50)
    ]);
  }

  async getHeapArrayText() {
    return this.page.textContent('#heap-array');
  }

  async getHeapNodesTexts() {
    const nodes = await this.page.$$('#heap-container .heap-node');
    const texts = [];
    for (const n of nodes) {
      texts.push((await n.textContent()).trim());
    }
    return texts;
  }

  // Helpers to access collected console and errors
  getConsoleMessages() {
    return this.consoleMessages;
  }
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Min Heap Visualization - FSM driven tests', () => {
  // Each test gets fresh page and HeapPage instance
  test.beforeEach(async ({ page }) => {
    // No global setup required beyond navigation in each test
  });

  test('Initial Idle state: page elements present and empty heap', async ({ page }) => {
    // Validate Idle state (S0_Idle): input and 3 buttons exist, heap containers empty
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Verify presence of components
    await expect(page.locator('#value')).toBeVisible();
    await expect(page.locator('button[onclick="insert()"]')).toBeVisible();
    await expect(page.locator('button[onclick="removeMin()"]')).toBeVisible();
    await expect(page.locator('button[onclick="displayHeap()"]')).toBeVisible();
    await expect(page.locator('#heap-container')).toBeVisible();
    await expect(page.locator('#heap-array')).toBeVisible();

    // Initially heap array text should be empty (no heap displayed yet)
    const heapArrayText = await heapPage.getHeapArrayText();
    expect(heapArrayText).toBe('', 'Expected no heap array text on initial load');

    // No heap nodes present
    const nodes = await heapPage.getHeapNodesTexts();
    expect(nodes.length).toBe(0);

    // Assert no uncaught page errors occurred during load
    const pageErrors = heapPage.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Ensure console has no error-level messages
    const consoleErrors = heapPage.getConsoleMessages().filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('DisplayHeapEvent: clicking Display Heap on empty heap should show "Heap Array: []"', async ({ page }) => {
    // Validate transition S0_Idle -> S1_HeapUpdated via DisplayHeapEvent
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Click display without inserting anything
    await heapPage.clickDisplayHeap();

    // After display(), expect the heap array to show an empty array format
    const heapArrayText = await heapPage.getHeapArrayText();
    expect(heapArrayText).toBe('Heap Array: []', 'DisplayHeap should show empty heap as []');

    // No nodes in container
    const nodes = await heapPage.getHeapNodesTexts();
    expect(nodes.length).toBe(0);

    // Check no page errors from display action
    expect(heapPage.getPageErrors().length).toBe(0);
  });

  test('InsertEvent: inserting numbers updates heap and displays nodes in min-heap order', async ({ page }) => {
    // Validate S0_Idle -> S1_HeapUpdated via InsertEvent multiple times and DOM updates
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Insert 5
    await heapPage.setInput(5);
    await heapPage.clickInsert();

    // After first insert
    let heapText = await heapPage.getHeapArrayText();
    expect(heapText).toBe('Heap Array: [5]');
    let nodes = await heapPage.getHeapNodesTexts();
    expect(nodes).toEqual(['5']);

    // Insert 3
    await heapPage.setInput(3);
    await heapPage.clickInsert();

    // After second insert => min-heap should reorder to [3, 5]
    heapText = await heapPage.getHeapArrayText();
    expect(heapText).toBe('Heap Array: [3, 5]');
    nodes = await heapPage.getHeapNodesTexts();
    expect(nodes).toEqual(['3', '5']);

    // Insert 8
    await heapPage.setInput(8);
    await heapPage.clickInsert();

    // After third insert => expected [3, 5, 8]
    heapText = await heapPage.getHeapArrayText();
    expect(heapText).toBe('Heap Array: [3, 5, 8]');
    nodes = await heapPage.getHeapNodesTexts();
    expect(nodes).toEqual(['3', '5', '8']);

    // The input should be cleared after valid insert (as per implementation)
    const inputValue = await heapPage.getInputValue();
    expect(inputValue).toBe('', 'Input should be cleared after successful insert');

    // No uncaught page errors occurred
    expect(heapPage.getPageErrors().length).toBe(0);
  });

  test('RemoveMinEvent: removing min shows alert and updates heap accordingly', async ({ page }) => {
    // Validate S0_Idle -> S1_HeapUpdated via RemoveMinEvent and that onEnter minHeap.display() updated DOM
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Setup heap by inserting numbers 10, 4, 7
    await heapPage.setInput(10);
    await heapPage.clickInsert();
    await heapPage.setInput(4);
    await heapPage.clickInsert();
    await heapPage.setInput(7);
    await heapPage.clickInsert();

    // Confirm heap state before removal: bubble results => [4,10,7]
    let heapText = await heapPage.getHeapArrayText();
    expect(heapText).toBe('Heap Array: [4, 10, 7]');
    let nodes = await heapPage.getHeapNodesTexts();
    expect(nodes).toEqual(['4', '10', '7']);

    // Click removeMin and capture alert message
    const dialogMsg = await heapPage.clickRemoveMin();
    expect(dialogMsg).toBe('Removed Min: 4');

    // After removal, expected array [7,10] (implementation places last element at root and bubbles down)
    heapText = await heapPage.getHeapArrayText();
    expect(heapText).toBe('Heap Array: [7, 10]');
    nodes = await heapPage.getHeapNodesTexts();
    expect(nodes).toEqual(['7', '10']);

    // No page errors
    expect(heapPage.getPageErrors().length).toBe(0);
  });

  test('Edge case: inserting non-numeric value should not change heap and input should remain', async ({ page }) => {
    // Validate that invalid input is ignored (no insertion) and heap remains unchanged
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Insert initial valid number to have baseline state
    await heapPage.setInput(2);
    await heapPage.clickInsert();
    let heapText = await heapPage.getHeapArrayText();
    expect(heapText).toBe('Heap Array: [2]');

    // Try to insert an invalid string
    await heapPage.setInput('abc'); // invalid
    await heapPage.clickInsert();

    // The implementation only clears input on valid number; invalid input should remain
    const inputVal = await heapPage.getInputValue();
    expect(inputVal).toBe('abc');

    // Heap should remain unchanged after invalid insert
    heapText = await heapPage.getHeapArrayText();
    expect(heapText).toBe('Heap Array: [2]');

    // No page errors
    expect(heapPage.getPageErrors().length).toBe(0);
  });

  test('Edge case: RemoveMinEvent on empty heap yields undefined removal and appropriate alert', async ({ page }) => {
    // Validate behavior when removing from empty heap - should notify Removed Min: undefined
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Ensure heap is empty initially
    let heapText = await heapPage.getHeapArrayText();
    // Could be empty string if display hasn't been called; call display to normalize
    if (!heapText || heapText.trim() === '') {
      await heapPage.clickDisplayHeap();
      heapText = await heapPage.getHeapArrayText();
    }
    expect(heapText).toBe('Heap Array: []');

    // Click removeMin on empty heap
    const dialogMsg = await heapPage.clickRemoveMin();
    expect(dialogMsg).toBe('Removed Min: undefined');

    // After attempted removal heap remains empty and display called
    const afterText = await heapPage.getHeapArrayText();
    expect(afterText).toBe('Heap Array: []');

    // No page errors
    expect(heapPage.getPageErrors().length).toBe(0);
  });

  test('Observability: monitor console and page errors during several interactions', async ({ page }) => {
    // This test performs several interactions and asserts that no JS runtime errors (pageerror) occurred.
    const heapPage = new HeapPage(page);
    await heapPage.goto();

    // Perform a sequence of interactions
    await heapPage.setInput(15);
    await heapPage.clickInsert();
    await heapPage.setInput(1);
    await heapPage.clickInsert();
    await heapPage.clickDisplayHeap();

    // Remove min twice
    const firstDialog = await heapPage.clickRemoveMin();
    const secondDialog = await heapPage.clickRemoveMin(); // might remove the second value
    expect(firstDialog).toContain('Removed Min:');
    expect(secondDialog).toContain('Removed Min:');

    // Finally display
    await heapPage.clickDisplayHeap();

    // Validate that there were no uncaught exceptions captured by pageerror
    const errors = heapPage.getPageErrors();
    expect(errors.length).toBe(0, `Expected no uncaught page errors, but found: ${errors.map(e => String(e)).join('; ')}`);

    // Check console for error-level messages and fail if any are present
    const consoleErrors = heapPage.getConsoleMessages().filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0, `Expected no console.error messages, but found: ${JSON.stringify(consoleErrors)}`);
  });
});