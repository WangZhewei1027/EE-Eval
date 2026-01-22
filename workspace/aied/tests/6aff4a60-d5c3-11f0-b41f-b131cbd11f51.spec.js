import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6aff4a60-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object for the Stack Visualization app
class StackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#element-input');
    this.pushButton = page.locator("button[onclick='pushElement()']");
    this.popButton = page.locator("button[onclick='popElement()']");
    this.peekButton = page.locator("button[onclick='peekElement()']");
    this.clearButton = page.locator("button[onclick='clearStack()']");
    this.stackSize = page.locator('#stack-size');
    this.topElement = page.locator('#top-element');
    this.lastOperation = page.locator('#last-operation');
    this.status = page.locator('#status');
    this.stackItems = page.locator('#stack-items .stack-item');
    this.stackItemsContainer = page.locator('#stack-items');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for initial JS to run and update display
    await this.page.waitForTimeout(50);
  }

  // Actions
  async push(value) {
    await this.input.fill(value);
    await this.pushButton.click();
    // allow DOM updates
    await this.page.waitForTimeout(50);
  }

  async pushByEnter(value) {
    await this.input.fill(value);
    await this.input.press('Enter');
    await this.page.waitForTimeout(50);
  }

  async pop() {
    await this.popButton.click();
    await this.page.waitForTimeout(50);
  }

  async peek() {
    await this.peekButton.click();
    // immediate color change occurs synchronously; timeout for any DOM updates
    await this.page.waitForTimeout(50);
  }

  async clear() {
    await this.clearButton.click();
    await this.page.waitForTimeout(50);
  }

  // Getters / assertions helpers
  async getStackSize() {
    const text = await this.stackSize.textContent();
    return Number(text?.trim() ?? '0');
  }

  async getTopElementText() {
    return (await this.topElement.textContent())?.trim() ?? '';
  }

  async getLastOperationText() {
    return (await this.lastOperation.textContent())?.trim() ?? '';
  }

  async getStatusText() {
    return (await this.status.textContent())?.trim() ?? '';
  }

  async getStatusBackgroundColor() {
    // returns computed background-color (rgb(...)) from the browser
    return await this.page.$eval('#status', el => window.getComputedStyle(el).backgroundColor);
  }

  async getStackItemsCount() {
    return await this.stackItems.count();
  }

  async getStackItemText(index) {
    // index: 0 .. count-1 ; items are appended bottom-to-top, so index 0 is bottom
    return (await this.stackItems.nth(index).textContent())?.trim() ?? '';
  }

  async getTopStackItemBackgroundColorComputed() {
    const count = await this.getStackItemsCount();
    if (count === 0) return null;
    return await this.page.$eval('#stack-items .stack-item:last-child', el => window.getComputedStyle(el).backgroundColor);
  }
}

test.describe('Stack Data Structure Visualization - FSM states and transitions', () => {
  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {StackPage} */
  let stackPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    // New context and page per test to keep tests isolated
    const context = await browser.newContext();
    page = await context.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors for observability assertions
    page.on('console', msg => {
      try {
        consoleMessages.push(`${msg.type()}: ${msg.text()}`);
      } catch (e) {
        consoleMessages.push(`console: <unserializable>`);
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    stackPage = new StackPage(page);
    await stackPage.goto();
  });

  test.afterEach(async () => {
    // Assert no unexpected page errors emerged during the test
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  // Test initial FSM state S0_Empty: Stack empty
  test('Initial state (S0_Empty) should show an empty stack', async () => {
    // Validate initial DOM matches the "empty" state expectations
    const size = await stackPage.getStackSize();
    expect(size).toBe(0);

    const topText = await stackPage.getTopElementText();
    expect(topText).toBe('None');

    const lastOp = await stackPage.getLastOperationText();
    // The implementation leaves last-operation as 'None' initially
    expect(lastOp).toBe('None');

    const statusText = await stackPage.getStatusText();
    // Note: the script updates the status text to 'Stack is empty' during initialization
    expect(statusText).toBe('Stack is empty');

    const statusBg = await stackPage.getStatusBackgroundColor();
    // updateStackDisplay sets '#e3f2fd' as inline style; computed style will be 'rgb(227, 242, 253)'
    expect(statusBg).toBe('rgb(227, 242, 253)');

    // Ensure no stack-item elements are present
    const itemsCount = await stackPage.getStackItemsCount();
    expect(itemsCount).toBe(0);
  });

  // Test pushing from empty state (S0_Empty -> S1_NonEmpty)
  test('PushEvent should move stack from empty to non-empty and update UI', async () => {
    // Push a value and assert the transition observables
    await stackPage.push('A');

    expect(await stackPage.getStackSize()).toBe(1);
    expect(await stackPage.getTopElementText()).toBe('A');
    expect(await stackPage.getLastOperationText()).toBe('Pushed: A');

    // Input should be cleared after push
    const inputValue = await stackPage.input.inputValue();
    expect(inputValue).toBe('');

    // Status should reflect non-empty state and green-ish background
    expect(await stackPage.getStatusText()).toBe('Stack contains 1 element(s)');
    expect(await stackPage.getStatusBackgroundColor()).toBe('rgb(232, 245, 232)'); // '#e8f5e8'

    // One stack-item should exist and contain the pushed text
    expect(await stackPage.getStackItemsCount()).toBe(1);
    expect(await stackPage.getStackItemText(0)).toBe('A');
  });

  // Test pressing Enter key to push (EnterKeyEvent)
  test('EnterKeyEvent should push an element when Enter is pressed in the input', async () => {
    // Use Enter key to push an element
    await stackPage.pushByEnter('EnterVal');

    expect(await stackPage.getStackSize()).toBe(1);
    expect(await stackPage.getTopElementText()).toBe('EnterVal');
    expect(await stackPage.getLastOperationText()).toBe('Pushed: EnterVal');
  });

  // Test peek behavior (PeekEvent) - does not remove element; highlights top temporarily
  test('PeekEvent should show top element without removing it and highlight the top element briefly', async () => {
    // Start from empty; push two elements
    await stackPage.push('X');
    await stackPage.push('Y');

    expect(await stackPage.getStackSize()).toBe(2);
    expect(await stackPage.getTopElementText()).toBe('Y');

    // Record the top item's computed background color before peek
    const beforeColor = await stackPage.getTopStackItemBackgroundColorComputed();
    expect(beforeColor).not.toBeNull();

    // Trigger peek - this should set lastOperation and highlight the top item
    await stackPage.peek();

    // Last operation should reflect peek
    expect(await stackPage.getLastOperationText()).toBe('Peeked: Y');

    // Stack size should remain unchanged
    expect(await stackPage.getStackSize()).toBe(2);

    // Immediately after peek, top item's computed background color should equal the highlight color (#ffeb3b -> rgb(255,235,59))
    const highlightColor = 'rgb(255, 235, 59)';
    const immediateColor = await stackPage.getTopStackItemBackgroundColorComputed();
    expect(immediateColor).toBe(highlightColor);

    // After the 1s timeout in the application, the color should revert (wait a bit more than 1s)
    await stackPage.page.waitForTimeout(1200);
    const revertedColor = await stackPage.getTopStackItemBackgroundColorComputed();
    // It should revert to something other than the highlight color (likely the original HSL-derived color)
    expect(revertedColor).not.toBe(highlightColor);
    // And it should equal the initial color or at least be defined
    expect(revertedColor).toBeTruthy();
    // Ensure top element still 'Y'
    expect(await stackPage.getTopElementText()).toBe('Y');
  });

  // Test pop behavior (PopEvent) - removes top and updates UI
  test('PopEvent should remove the top element and update UI accordingly', async () => {
    // Push multiple values
    await stackPage.push('1');
    await stackPage.push('2');
    await stackPage.push('3');

    expect(await stackPage.getStackSize()).toBe(3);
    expect(await stackPage.getTopElementText()).toBe('3');

    // Pop once
    await stackPage.pop();
    expect(await stackPage.getStackSize()).toBe(2);
    expect(await stackPage.getLastOperationText()).toBe('Popped: 3');
    expect(await stackPage.getTopElementText()).toBe('2');

    // Pop second time
    await stackPage.pop();
    expect(await stackPage.getStackSize()).toBe(1);
    expect(await stackPage.getLastOperationText()).toBe('Popped: 2');
    expect(await stackPage.getTopElementText()).toBe('1');
  });

  // Test clear behavior (ClearEvent) - clears the stack and resets UI
  test('ClearEvent should clear the stack and reset the UI to empty state', async () => {
    // Push some items
    await stackPage.push('alpha');
    await stackPage.push('beta');

    expect(await stackPage.getStackSize()).toBe(2);

    // Clear the stack
    await stackPage.clear();

    // Assertions after clear
    expect(await stackPage.getStackSize()).toBe(0);
    expect(await stackPage.getTopElementText()).toBe('None');
    expect(await stackPage.getLastOperationText()).toBe('Cleared stack');
    expect(await stackPage.getStatusText()).toBe('Stack is empty');
    expect(await stackPage.getStackItemsCount()).toBe(0);
  });

  // Edge case tests: verify alerts for invalid operations and overflow
  test('Edge cases: pushing empty value, popping empty stack, peeking empty stack, and overflow', async () => {
    // 1) Pushing empty value should trigger an alert
    // Ensure input empty
    await stackPage.input.fill('');
    const pushEmptyDialog = stackPage.page.waitForEvent('dialog');
    await stackPage.pushButton.click();
    const dialog1 = await pushEmptyDialog;
    expect(dialog1.message()).toBe('Please enter a value to push');
    await dialog1.accept();
    expect(await stackPage.getStackSize()).toBe(0);

    // 2) Popping when empty should trigger underflow alert
    const popDialog = stackPage.page.waitForEvent('dialog');
    await stackPage.popButton.click();
    const dialog2 = await popDialog;
    expect(dialog2.message()).toBe('Stack underflow! Stack is empty.');
    await dialog2.accept();
    expect(await stackPage.getStackSize()).toBe(0);

    // 3) Peeking when empty should trigger alert
    const peekDialog = stackPage.page.waitForEvent('dialog');
    await stackPage.peekButton.click();
    const dialog3 = await peekDialog;
    expect(dialog3.message()).toBe('Stack is empty!');
    await dialog3.accept();

    // 4) Overflow: push up to maxStackSize (10) should succeed, the 11th push should alert overflow.
    // Push 10 times
    for (let i = 1; i <= 10; i++) {
      await stackPage.push(`v${i}`);
    }
    expect(await stackPage.getStackSize()).toBe(10);

    // Attempt 11th push - should cause overflow alert
    await stackPage.input.fill('v11');
    const overflowDialog = stackPage.page.waitForEvent('dialog');
    await stackPage.pushButton.click();
    const dialog4 = await overflowDialog;
    expect(dialog4.message()).toBe('Stack overflow! Maximum size reached.');
    await dialog4.accept();

    // Ensure stack size remains 10
    expect(await stackPage.getStackSize()).toBe(10);
    // Clean up - clear stack to leave environment consistent
    await stackPage.clear();
    expect(await stackPage.getStackSize()).toBe(0);
  });

  // Observability test: ensure no unexpected console errors/warnings were emitted during normal usage
  test('Observability: no page errors during normal operations and console captured', async () => {
    // Perform a series of normal operations
    await stackPage.push('obs1');
    await stackPage.peek();
    await stackPage.push('obs2');
    await stackPage.pop();
    await stackPage.clear();

    // We captured console and page errors in beforeEach/afterEach. Here assert that console had messages (if any)
    // This test ensures the application runs without throwing runtime exceptions (pageErrors asserted in afterEach)
    // It's acceptable if console contains info/warn messages, but no page errors should be present
    expect(Array.isArray(consoleMessages)).toBe(true);
    // At minimum, the consoleMessages array exists; we don't assert specific console entries because app does not log by design
  });
});