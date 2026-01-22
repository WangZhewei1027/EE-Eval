import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/batch-1207/html/d7b30211-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object for interacting with the Heap demo
class HeapPage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      heapType: '#heapType',
      newValue: '#newValue',
      insertBtn: '#insertBtn',
      extractBtn: '#extractBtn',
      clearBtn: '#clearBtn',
      messages: '#messages',
      heapArray: '#heapArray',
      treeCanvas: '#treeCanvas',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial display update
    await this.page.waitForSelector(this.selectors.heapArray);
  }

  async getHeapArrayText() {
    return this.page.$eval(this.selectors.heapArray, (el) => el.textContent.trim());
  }

  async getMessageText() {
    return this.page.$eval(this.selectors.messages, (el) => el.textContent.trim());
  }

  async getMessageColor() {
    // returns computed color e.g. 'rgb(51, 51, 51)' or 'rgb(221, 51, 51)'
    return this.page.$eval(this.selectors.messages, (el) => {
      return window.getComputedStyle(el).color;
    });
  }

  async fillNewValue(value) {
    await this.page.fill(this.selectors.newValue, String(value));
  }

  async clickInsert() {
    await this.page.click(this.selectors.insertBtn);
  }

  async clickExtract() {
    await this.page.click(this.selectors.extractBtn);
  }

  async clickClear() {
    await this.page.click(this.selectors.clearBtn);
  }

  async changeHeapTypeByValue(value) {
    await this.page.selectOption(this.selectors.heapType, value);
  }

  async getInputValue() {
    return this.page.$eval(this.selectors.newValue, (el) => el.value);
  }

  async getCanvasDimension() {
    return this.page.$eval(this.selectors.treeCanvas, (c) => {
      return { width: c.width, height: c.height };
    });
  }
}

test.describe('Heap (Min/Max) Demonstration - FSM and UI tests', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // capture console errors and uncaught page errors for assertions
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors or console error messages
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    expect(consoleErrors, 'No console error messages should be logged').toEqual([]);
  });

  test('Initial state S0_HeapInitialized: page loads and displays empty heap', async ({ page }) => {
    const heap = new HeapPage(page);
    await heap.goto();

    // Validate heap array displays empty array representation
    const heapText = await heap.getHeapArrayText();
    expect(heapText).toBe('[]');

    // Validate messages area starts empty
    const msg = await heap.getMessageText();
    expect(msg).toBe('');

    // Validate canvas exists and has expected dimensions (sanity check for visual area)
    const dims = await heap.getCanvasDimension();
    expect(dims.width).toBeGreaterThan(0);
    expect(dims.height).toBeGreaterThan(0);
  });

  test('InsertValue event and S1_ValueInserted state: successful insertion and UI updates', async ({ page }) => {
    const heap = new HeapPage(page);
    await heap.goto();

    // Insert 5 and verify transition to ValueInserted state behavior
    await heap.fillNewValue('5');
    await heap.clickInsert();

    // After insert: input should be cleared
    const inputVal = await heap.getInputValue();
    expect(inputVal).toBe('');

    // Heap array should reflect inserted value
    const heapText = await heap.getHeapArrayText();
    expect(heapText).toBe('[5]');

    // Message should appear and be non-error color (#333 -> rgb(51,51,51))
    const message = await heap.getMessageText();
    expect(message).toBe('Inserted value 5.');

    const color = await heap.getMessageColor();
    expect(color).toBe('rgb(51, 51, 51)');

    // Message should auto-clear after ~3s; wait slightly more and verify cleared
    await page.waitForTimeout(3200);
    const clearedMsg = await heap.getMessageText();
    expect(clearedMsg).toBe('');
  });

  test('Multiple inserts maintain min-heap property (S1_ValueInserted repeated transitions)', async ({ page }) => {
    const heap = new HeapPage(page);
    await heap.goto();

    // Insert sequence: 10, 3, 7
    await heap.fillNewValue('10');
    await heap.clickInsert();
    await heap.fillNewValue('3');
    await heap.clickInsert();
    await heap.fillNewValue('7');
    await heap.clickInsert();

    // For a min-heap the internal array after these inserts should be [3,10,7]
    const heapText = await heap.getHeapArrayText();
    expect(heapText).toBe('[3,10,7]');
  });

  test('ExtractRoot event and S2_RootExtracted state: extracting root from non-empty heap', async ({ page }) => {
    const heap = new HeapPage(page);
    await heap.goto();

    // Prepare heap with [3,10,7]
    await heap.fillNewValue('10');
    await heap.clickInsert();
    await heap.fillNewValue('3');
    await heap.clickInsert();
    await heap.fillNewValue('7');
    await heap.clickInsert();

    // Extract root
    await heap.clickExtract();

    // Message shows extracted value (min root 3)
    const message = await heap.getMessageText();
    expect(message).toBe('Extracted root value 3.');

    // For the algorithm, array should now be [7,10] after extraction
    const heapText = await heap.getHeapArrayText();
    expect(heapText).toBe('[7,10]');

    // Non-error message color
    const color = await heap.getMessageColor();
    expect(color).toBe('rgb(51, 51, 51)');

    // Wait for auto-clear of message
    await page.waitForTimeout(3200);
    expect(await heap.getMessageText()).toBe('');
  });

  test('ExtractRoot from empty heap shows an error (edge case)', async ({ page }) => {
    const heap = new HeapPage(page);
    await heap.goto();

    // Ensure heap is empty
    const initialHeap = await heap.getHeapArrayText();
    expect(initialHeap).toBe('[]');

    // Click extract on empty heap
    await heap.clickExtract();

    // Error message should be displayed
    const message = await heap.getMessageText();
    expect(message).toBe('Heap is empty, nothing to extract.');

    // Error message color should be '#d33' -> rgb(221, 51, 51)
    const color = await heap.getMessageColor();
    expect(color).toBe('rgb(221, 51, 51)');

    // Wait for auto-clear and verify it clears
    await page.waitForTimeout(3200);
    expect(await heap.getMessageText()).toBe('');
  });

  test('ClearHeap event and S3_HeapCleared state: clearing the heap resets UI', async ({ page }) => {
    const heap = new HeapPage(page);
    await heap.goto();

    // Insert some values
    await heap.fillNewValue('1');
    await heap.clickInsert();
    await heap.fillNewValue('2');
    await heap.clickInsert();

    // Heap is not empty now
    expect(await heap.getHeapArrayText()).not.toBe('[]');

    // Clear the heap
    await heap.clickClear();

    // Heap array should be empty
    expect(await heap.getHeapArrayText()).toBe('[]');

    // Message should indicate clearing and be non-error
    expect(await heap.getMessageText()).toBe('Heap cleared.');
    expect(await heap.getMessageColor()).toBe('rgb(51, 51, 51)');

    // Wait for auto-clear
    await page.waitForTimeout(3200);
    expect(await heap.getMessageText()).toBe('');
  });

  test('ChangeHeapType event and S4_HeapTypeChanged state: switching to Max Heap clears heap', async ({ page }) => {
    const heap = new HeapPage(page);
    await heap.goto();

    // Insert values into min heap
    await heap.fillNewValue('4');
    await heap.clickInsert();
    await heap.fillNewValue('9');
    await heap.clickInsert();

    // Ensure heap non-empty
    expect(await heap.getHeapArrayText()).not.toBe('[]');

    // Change to max heap
    await heap.changeHeapTypeByValue('max');

    // After change, heap should be cleared by implementation
    expect(await heap.getHeapArrayText()).toBe('[]');

    // Message should mention switched to Max Heap
    // The exact message string in implementation: "Switched to ${heapTypeSelect.options[heapTypeSelect.selectedIndex].text}. Heap cleared."
    // For 'max' option the text is "Max Heap"
    expect(await heap.getMessageText()).toBe('Switched to Max Heap. Heap cleared.');
    expect(await heap.getMessageColor()).toBe('rgb(51, 51, 51)');

    // Wait and confirm message clears
    await page.waitForTimeout(3200);
    expect(await heap.getMessageText()).toBe('');
  });

  test('Insert error scenarios: empty input and invalid number', async ({ page }) => {
    const heap = new HeapPage(page);
    await heap.goto();

    // Ensure empty input leads to error message
    await heap.fillNewValue(''); // clear if necessary
    await heap.clickInsert();
    const msgEmpty = await heap.getMessageText();
    expect(msgEmpty).toBe('Please enter a value to insert.');
    expect(await heap.getMessageColor()).toBe('rgb(221, 51, 51)');

    // Wait for auto-clear
    await page.waitForTimeout(3200);
    expect(await heap.getMessageText()).toBe('');

    // Fill with invalid number (input is type=number but fill with non-numeric string)
    // Playwright fill will set the value attribute; the page code uses Number(valStr) which will produce NaN
    await heap.fillNewValue('abc');
    await heap.clickInsert();
    const msgInvalid = await heap.getMessageText();
    expect(msgInvalid).toBe('Invalid number entered.');
    expect(await heap.getMessageColor()).toBe('rgb(221, 51, 51)');

    // Wait for auto-clear
    await page.waitForTimeout(3200);
    expect(await heap.getMessageText()).toBe('');
  });

  test('Canvas exists and is updated (sanity check for visualization after operations)', async ({ page }) => {
    const heap = new HeapPage(page);
    await heap.goto();

    // canvas initial dims
    const dimsBefore = await heap.getCanvasDimension();
    expect(dimsBefore.width).toBeGreaterThan(0);
    expect(dimsBefore.height).toBeGreaterThan(0);

    // Insert a value which should trigger a redraw
    await heap.fillNewValue('42');
    await heap.clickInsert();

    // After insertion canvas dimensions should remain but we can assert it still exists and has same dimensions
    const dimsAfter = await heap.getCanvasDimension();
    expect(dimsAfter.width).toBe(dimsBefore.width);
    expect(dimsAfter.height).toBe(dimsBefore.height);
  });
});