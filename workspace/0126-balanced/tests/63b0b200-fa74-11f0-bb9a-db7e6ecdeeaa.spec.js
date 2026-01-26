import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b0b200-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Min Heap demo
class HeapPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.insertValue = '#insertValue';
    this.insertBtn = '#insertBtn';
    this.extractBtn = '#extractBtn';
    this.peekBtn = '#peekBtn';
    this.clearBtn = '#clearBtn';
    this.heapArray = '#heapArray';
    this.message = '#message';
    this.heapSvg = '#heapSvg';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for core elements
    await Promise.all([
      this.page.waitForSelector(this.insertValue),
      this.page.waitForSelector(this.insertBtn),
      this.page.waitForSelector(this.heapArray),
      this.page.waitForSelector(this.heapSvg),
    ]);
  }

  async fillInsertValue(value) {
    // Use fill to set value of number input
    await this.page.fill(this.insertValue, value);
  }

  async clickInsert() {
    await this.page.click(this.insertBtn);
  }

  async clickExtract() {
    await this.page.click(this.extractBtn);
  }

  async clickPeek() {
    await this.page.click(this.peekBtn);
  }

  async clickClear() {
    await this.page.click(this.clearBtn);
  }

  async getHeapArrayText() {
    return (await this.page.textContent(this.heapArray)).trim();
  }

  async getMessageText() {
    const txt = await this.page.textContent(this.message);
    return (txt ?? '').trim();
  }

  // Returns the computed color (rgb(...) string) of the message element
  async getMessageColor() {
    return this.page.$eval(this.message, (el) => {
      return window.getComputedStyle(el).color;
    });
  }

  // Count number of circle elements representing nodes in the SVG
  async getSvgCircleCount() {
    return this.page.$$eval(`${this.heapSvg} circle`, (els) => els.length);
  }

  // Return array of node text values shown in the SVG (in DOM order)
  async getSvgNodeTextValues() {
    return this.page.$$eval(`${this.heapSvg} text`, (els) => els.map(e => e.textContent.trim()));
  }

  // Return whether the "Heap is empty" text node exists in SVG
  async svgHasEmptyText() {
    const texts = await this.page.$$eval(`${this.heapSvg} text`, (els) => els.map(e => e.textContent.trim()));
    return texts.includes('Heap is empty');
  }

  // Return the content of the insert input (value attribute)
  async getInsertInputValue() {
    return this.page.$eval(this.insertValue, (el) => el.value);
  }
}

test.describe('Min Heap (Binary Heap) Demo - FSM and UI validation', () => {
  let heapPage;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions in individual tests
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    heapPage = new HeapPage(page);
    await heapPage.goto();
  });

  test.afterEach(async () => {
    // Basic sanity assertions about errors observed during the test.
    // The application should not throw unhandled page errors.
    expect(pageErrors.map(e => `${e.name}: ${e.message}`)).toEqual([]);
    // Also check no console messages with type 'error' were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors).toEqual([]);
  });

  test('Initial Idle state: updateDisplay entry action runs and shows empty heap', async () => {
    // This verifies the FSM S0_Idle entry action updateDisplay() executed on load.
    // Expect the heap array to be displayed as "[ ]" (updateDisplay sets "[ <joined> ]")
    const heapText = await heapPage.getHeapArrayText();
    expect(heapText).toBe('[ ]');

    // SVG should show "Heap is empty" message
    const hasEmptyText = await heapPage.svgHasEmptyText();
    expect(hasEmptyText).toBe(true);

    // No nodes exist initially
    const circles = await heapPage.getSvgCircleCount();
    expect(circles).toBe(0);
  });

  test.describe('InsertValue transitions and validations', () => {
    test('Inserting a single value updates heap array, svg and shows inserted message', async () => {
      // Insert 42
      await heapPage.fillInsertValue('42');
      await heapPage.clickInsert();

      // Message should indicate insertion
      const msg = await heapPage.getMessageText();
      expect(msg).toBe('Inserted value 42 into the heap.');

      // Message color should be the non-error blue: #2980b9 -> rgb(41, 128, 185)
      const color = await heapPage.getMessageColor();
      expect(color).toBe('rgb(41, 128, 185)');

      // Heap array text should reflect the single item
      const heapText = await heapPage.getHeapArrayText();
      expect(heapText).toBe('[ 42 ]');

      // SVG should have one circle and node text "42"
      const circleCount = await heapPage.getSvgCircleCount();
      expect(circleCount).toBe(1);

      const nodeTexts = await heapPage.getSvgNodeTextValues();
      // There will be one text element for the node (and possibly no other texts aside from node text)
      expect(nodeTexts).toContain('42');

      // Input should be cleared after successful insert
      const inputVal = await heapPage.getInsertInputValue();
      expect(inputVal).toBe('');
    });

    test('Inserting multiple values preserves min-heap property and visualization updates', async () => {
      // Insert several values in arbitrary order
      const values = ['10', '5', '14', '2', '8'];
      for (const v of values) {
        await heapPage.fillInsertValue(v);
        await heapPage.clickInsert();
      }

      // After inserts, heap array should contain 5 numbers
      const heapText = await heapPage.getHeapArrayText();
      // We'll check that it contains the numbers inserted and is formatted correctly
      expect(heapText.startsWith('[')).toBe(true);
      expect(heapText.endsWith(']')).toBe(true);
      // Ensure each inserted value appears in the array representation
      for (const v of ['10','5','14','2','8']) {
        expect(heapText).toContain(v);
      }

      // SVG should have 5 node circles
      const circles = await heapPage.getSvgCircleCount();
      expect(circles).toBe(5);

      // The min element should be present in the svg text elements and also match heap.peek()
      // Click peek to get explicit peek message
      await heapPage.clickPeek();
      const peekMsg = await heapPage.getMessageText();
      // The minimum of [10,5,14,2,8] is 2
      expect(peekMsg).toBe('Minimum value (peek): 2');
      const peekColor = await heapPage.getMessageColor();
      expect(peekColor).toBe('rgb(41, 128, 185)');
    });

    test('Edge case: clicking Insert with empty input shows error message', async () => {
      // Ensure input is empty
      await heapPage.fillInsertValue('');
      await heapPage.clickInsert();

      const msg = await heapPage.getMessageText();
      expect(msg).toBe('Please enter a number to insert');

      // Error color should be red: #c0392b -> rgb(192, 57, 43)
      const color = await heapPage.getMessageColor();
      expect(color).toBe('rgb(192, 57, 43)');
    });

    test('Edge case: inserting invalid numeric value shows invalid input error', async () => {
      // Force an invalid value in the number input (page.fill bypasses UI constraints)
      await heapPage.fillInsertValue('not-a-number');
      await heapPage.clickInsert();

      const msg = await heapPage.getMessageText();
      expect(msg).toBe('Invalid input. Enter a valid number.');

      const color = await heapPage.getMessageColor();
      expect(color).toBe('rgb(192, 57, 43)');
    });
  });

  test.describe('ExtractMin transitions and behavior', () => {
    test('Clicking Extract Min on empty heap shows appropriate error', async () => {
      // Ensure heap is empty initially (from beforeEach)
      const before = await heapPage.getHeapArrayText();
      expect(before).toBe('[ ]');

      await heapPage.clickExtract();

      const msg = await heapPage.getMessageText();
      expect(msg).toBe('Heap is empty. Cannot extract min.');

      const color = await heapPage.getMessageColor();
      expect(color).toBe('rgb(192, 57, 43)');
    });

    test('Extracting min returns the smallest element and updates visualization', async () => {
      // Insert some values: 7,3,9
      await heapPage.fillInsertValue('7');
      await heapPage.clickInsert();
      await heapPage.fillInsertValue('3');
      await heapPage.clickInsert();
      await heapPage.fillInsertValue('9');
      await heapPage.clickInsert();

      // Verify peek shows 3 as min
      await heapPage.clickPeek();
      expect(await heapPage.getMessageText()).toBe('Minimum value (peek): 3');

      // Extract min
      await heapPage.clickExtract();

      // Message should indicate extracted minimum 3
      expect(await heapPage.getMessageText()).toBe('Extracted minimum value: 3');

      // Heap array should no longer contain 3
      const heapText = await heapPage.getHeapArrayText();
      expect(heapText).not.toContain('3');

      // SVG node count should be reduced to 2
      const circles = await heapPage.getSvgCircleCount();
      expect(circles).toBe(2);
    });
  });

  test.describe('PeekMin and ClearHeap transitions', () => {
    test('Peek on empty shows "Heap is empty."', async () => {
      // Ensure heap empty
      const before = await heapPage.getHeapArrayText();
      expect(before).toBe('[ ]');

      await heapPage.clickPeek();

      const msg = await heapPage.getMessageText();
      expect(msg).toBe('Heap is empty.');

      // Message color for this non-error is the default blue
      const color = await heapPage.getMessageColor();
      expect(color).toBe('rgb(41, 128, 185)');
    });

    test('Clear heap empties data structure and updates display and message', async () => {
      // Insert some values
      await heapPage.fillInsertValue('1');
      await heapPage.clickInsert();
      await heapPage.fillInsertValue('4');
      await heapPage.clickInsert();

      // Confirm not empty
      const before = await heapPage.getHeapArrayText();
      expect(before).toContain('1');
      expect(before).toContain('4');

      // Clear heap
      await heapPage.clickClear();

      // Message should be "Heap cleared."
      expect(await heapPage.getMessageText()).toBe('Heap cleared.');

      // Heap array should show empty representation
      const heapText = await heapPage.getHeapArrayText();
      expect(heapText).toBe('[ ]');

      // SVG should show the "Heap is empty" text again
      const hasEmptyText = await heapPage.svgHasEmptyText();
      expect(hasEmptyText).toBe(true);
      // No node circles present
      const circles = await heapPage.getSvgCircleCount();
      expect(circles).toBe(0);
    });
  });

  test('Composed scenario: sequence of insert/peek/extract/clear maintains consistent UI state', async () => {
    // Insert values: 20, 15, 30, 5
    const vals = ['20','15','30','5'];
    for (const v of vals) {
      await heapPage.fillInsertValue(v);
      await heapPage.clickInsert();
    }

    // Peek should show 5
    await heapPage.clickPeek();
    expect(await heapPage.getMessageText()).toBe('Minimum value (peek): 5');

    // Extract should remove 5
    await heapPage.clickExtract();
    expect(await heapPage.getMessageText()).toBe('Extracted minimum value: 5');

    // Next peek should show the new minimum (15 or 20 depending on heap)
    await heapPage.clickPeek();
    const peekMsg = await heapPage.getMessageText();
    // The minimum after removing 5 from [20,15,30,5] is 15
    expect(peekMsg).toBe('Minimum value (peek): 15');

    // Clear the heap
    await heapPage.clickClear();
    expect(await heapPage.getHeapArrayText()).toBe('[ ]');
    expect(await heapPage.svgHasEmptyText()).toBe(true);
  });
});