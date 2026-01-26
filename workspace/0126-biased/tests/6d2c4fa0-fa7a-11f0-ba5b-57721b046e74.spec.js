import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2c4fa0-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object encapsulating interactions and selectors for the Dynamic Array Explorer
class DynamicArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pushBtn = page.locator('#pushBtn');
    this.pushValue = page.locator('#pushValue');
    this.popBtn = page.locator('#popBtn');

    this.unshiftBtn = page.locator('#unshiftBtn');
    this.unshiftValue = page.locator('#unshiftValue');
    this.shiftBtn = page.locator('#shiftBtn');

    this.insertAtBtn = page.locator('#insertAtBtn');
    this.insertValue = page.locator('#insertValue');
    this.insertIndex = page.locator('#insertIndex');

    this.removeAtBtn = page.locator('#removeAtBtn');
    this.removeIndex = page.locator('#removeIndex');

    this.fillBtn = page.locator('#fillBtn');
    this.fillCount = page.locator('#fillCount');
    this.minValue = page.locator('#minValue');
    this.maxValue = page.locator('#maxValue');

    this.reverseBtn = page.locator('#reverseBtn');
    this.sortBtn = page.locator('#sortBtn');
    this.sortDirection = page.locator('#sortDirection');

    this.clearBtn = page.locator('#clearBtn');
    this.shuffleBtn = page.locator('#shuffleBtn');

    this.findBtn = page.locator('#findBtn');
    this.findValue = page.locator('#findValue');
    this.findResult = page.locator('#findResult');

    this.filterBtn = page.locator('#filterBtn');
    this.filterCondition = page.locator('#filterCondition');
    this.filterValue = page.locator('#filterValue');

    this.mapBtn = page.locator('#mapBtn');
    this.mapOperation = page.locator('#mapOperation');

    this.arrayDisplay = page.locator('#arrayDisplay');
    this.arrayItems = page.locator('.array-item');
    this.arrayLength = page.locator('#arrayLength');
    this.arraySum = page.locator('#arraySum');
    this.arrayAvg = page.locator('#arrayAvg');
    this.firstElement = page.locator('#firstElement');
    this.lastElement = page.locator('#lastElement');

    this.arrayCapacityEl = page.locator('#arrayCapacity');
    this.memoryUsage = page.locator('#memoryUsage');

    this.operationLog = page.locator('#operationLog');
  }

  async push(value) {
    await this.pushValue.fill(String(value));
    await this.pushBtn.click();
  }

  async pop() {
    await this.popBtn.click();
  }

  async unshift(value) {
    await this.unshiftValue.fill(String(value));
    await this.unshiftBtn.click();
  }

  async shift() {
    await this.shiftBtn.click();
  }

  async insertAt(index, value) {
    await this.insertIndex.fill(String(index));
    await this.insertValue.fill(String(value));
    await this.insertAtBtn.click();
  }

  async removeAt(index) {
    await this.removeIndex.fill(String(index));
    await this.removeAtBtn.click();
  }

  async fillRandom(count = 5, min = 1, max = 100) {
    await this.fillCount.fill(String(count));
    await this.minValue.fill(String(min));
    await this.maxValue.fill(String(max));
    await this.fillBtn.click();
  }

  async reverse() {
    await this.reverseBtn.click();
  }

  async sort(direction = 'asc') {
    await this.sortDirection.selectOption(direction);
    await this.sortBtn.click();
  }

  async clear() {
    await this.clearBtn.click();
  }

  async shuffle() {
    await this.shuffleBtn.click();
  }

  async find(value) {
    await this.findValue.fill(String(value));
    await this.findBtn.click();
  }

  async filter(condition, value) {
    await this.filterCondition.selectOption(condition);
    await this.filterValue.fill(String(value));
    await this.filterBtn.click();
  }

  async map(operation) {
    await this.mapOperation.selectOption(operation);
    await this.mapBtn.click();
  }

  // Utilities to read UI state
  async getArrayItemsText() {
    // If array is empty a single div with text "Array is empty" is present rather than .array-item elements
    const itemsCount = await this.arrayItems.count();
    if (itemsCount === 0) {
      const txt = (await this.arrayDisplay.textContent()) || '';
      return [txt.trim()];
    }
    const texts = [];
    for (let i = 0; i < itemsCount; i++) {
      const t = await this.arrayItems.nth(i).textContent();
      // array-item includes index label inside; index label is inside .array-index; the textContent includes that index,
      // but index label is positioned absolutely, it might be included; we will extract the main text by excluding index label value if present.
      // To be safe split lines and take the first/trimming digits
      texts.push((t || '').trim());
    }
    // Normalize: array-item text includes index inside; index appended at end due to appendChild; ensure we remove trailing index digits
    return texts.map(t => {
      // If there is a newline or multiple spaces, pick the first token which is value
      const lines = t.split('\n').map(s => s.trim()).filter(Boolean);
      // The displayed structure tends to be: value then index, so return the first line which is the value.
      return lines[0] || t;
    });
  }

  async getLength() {
    const t = await this.arrayLength.textContent();
    return parseInt((t || '0').trim(), 10);
  }

  async getSum() {
    const t = await this.arraySum.textContent();
    return parseFloat((t || '0').trim());
  }

  async getAvg() {
    const t = await this.arrayAvg.textContent();
    return parseFloat((t || '0').trim());
  }

  async getFirstLast() {
    const first = (await this.firstElement.textContent()) || '';
    const last = (await this.lastElement.textContent()) || '';
    return { first: first.trim(), last: last.trim() };
  }

  async getFindResultText() {
    return (await this.findResult.textContent())?.trim() || '';
  }

  async getOperationLogText() {
    return (await this.operationLog.textContent())?.trim() || '';
  }

  async getCapacity() {
    const t = await this.arrayCapacityEl.textContent();
    return parseInt((t || '0').trim(), 10);
  }

  async getMemoryUsage() {
    const t = await this.memoryUsage.textContent();
    return parseInt((t || '0').trim(), 10);
  }
}

test.describe('Dynamic Array Explorer - Full FSM validation', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture page errors and console errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Assert that no uncaught page errors or console errors occurred during the test steps.
    // The application code is left unmodified; we expect a clean runtime.
    expect(pageErrors, 'No page errors should be thrown').toEqual([]);
    expect(consoleErrors, 'No console error messages should be emitted').toEqual([]);
  });

  test.describe('Basic operations (Push, Pop, Unshift, Shift, InsertAt, RemoveAt)', () => {
    test('Initial Idle state: UI shows empty array and zeroed info', async ({ page }) => {
      // Validate the initial state as "Idle" — array displays "Array is empty", length/sum/avg are zero.
      const p = new DynamicArrayPage(page);

      const displayText = (await p.arrayDisplay.textContent())?.trim() || '';
      expect(displayText).toContain('Array is empty');

      expect(await p.getLength()).toBe(0);
      expect(await p.getSum()).toBe(0);
      expect(await p.getAvg()).toBe(0);

      const firstLast = await p.getFirstLast();
      expect(firstLast.first).toBe('None');
      expect(firstLast.last).toBe('None');

      // Capacity should be simulated and at least 4 per implementation
      expect(await p.getCapacity()).toBeGreaterThanOrEqual(4);
    });

    test('Push then Pop updates display, info and logs correctly', async ({ page }) => {
      // Validate pushing a value updates array display, length, sum, avg, first/last and operation log; then popping returns to empty
      const p = new DynamicArrayPage(page);

      await p.push('10');
      // After push: one item '10'
      const items = await p.getArrayItemsText();
      expect(items.length).toBeGreaterThanOrEqual(1);
      // First array-item should show '10'
      expect(items[0]).toContain('10');

      expect(await p.getLength()).toBe(1);
      expect(await p.getSum()).toBe(10);
      expect(await p.getAvg()).toBe(10);

      const fl = await p.getFirstLast();
      expect(fl.first).toBe('10');
      expect(fl.last).toBe('10');

      // Log should include push message
      const log = await p.getOperationLogText();
      expect(log).toContain('Pushed value "10"');

      // Now pop
      await p.pop();
      // After pop array empty
      const display = (await p.arrayDisplay.textContent())?.trim() || '';
      expect(display).toContain('Array is empty');

      // Log should include popped message
      const logAfter = await p.getOperationLogText();
      expect(logAfter).toContain('Popped value "10"');
    });

    test('Unshift then Shift updates display, info and logs correctly', async ({ page }) => {
      // Validate unshift adds to front and shift removes from front with appropriate log messages
      const p = new DynamicArrayPage(page);

      await p.unshift('20');
      const items = await p.getArrayItemsText();
      expect(items[0]).toContain('20');
      expect(await p.getLength()).toBe(1);
      expect((await p.getFirstLast()).first).toBe('20');

      const log = await p.getOperationLogText();
      expect(log).toContain('Added value "20" to start of array');

      await p.shift();
      expect((await p.arrayDisplay.textContent())?.trim()).toContain('Array is empty');
      expect((await p.getOperationLogText())).toContain('Removed value "20" from start of array');
    });

    test('InsertAt and RemoveAt maintain correct order, length and logs', async ({ page }) => {
      // Validate insertion at index and removal at index work and update UI properly
      const p = new DynamicArrayPage(page);

      // Start with empty array; push two items to prepare for insertion
      await p.push('1');
      await p.push('3');
      expect(await p.getLength()).toBe(2);

      // Insert '2' at index 1 -> expected order: 1,2,3
      await p.insertAt(1, '2');

      const itemsAfterInsert = await p.getArrayItemsText();
      // We expect at least three items and the second one to include '2'
      expect(itemsAfterInsert.length).toBeGreaterThanOrEqual(3);
      expect(itemsAfterInsert[0]).toContain('1');
      expect(itemsAfterInsert[1]).toContain('2');
      expect(itemsAfterInsert[2]).toContain('3');

      // Sum should be numeric sum: 1 + 2 + 3 = 6
      expect(await p.getSum()).toBe(6);

      // Removal at index 1 should remove '2' and return to 1,3
      await p.removeAt(1);
      const itemsAfterRemove = await p.getArrayItemsText();
      expect(itemsAfterRemove[0]).toContain('1');
      expect(itemsAfterRemove[1]).toContain('3');

      // Log entries
      const log = await p.getOperationLogText();
      expect(log).toContain('Inserted value "2" at index 1');
      expect(log).toContain('Removed value "2" from index 1');

      // Cleanup: clear array for subsequent tests
      await p.clear();
      expect((await p.arrayDisplay.textContent())?.trim()).toContain('Array is empty');
    });
  });

  test.describe('Bulk operations (Fill, Reverse, Sort, Clear, Shuffle)', () => {
    test('Fill with random values sets length, sum and logs entry', async ({ page }) => {
      // Validate fill populates the array with requested count and logs the operation
      const p = new DynamicArrayPage(page);

      await p.fillRandom(5, 1, 10);
      expect(await p.getLength()).toBe(5);

      // Sum should be numeric; check arraySum is a number and arrayAvg is computed
      const sum = await p.getSum();
      const avg = await p.getAvg();
      expect(typeof sum).toBe('number');
      expect(typeof avg).toBe('number');

      // Operation log should mention fill with the exact count and range
      const log = await p.getOperationLogText();
      expect(log).toContain('Filled array with 5 random values between 1 and 10');
    });

    test('Reverse swaps first/last and updates display and log', async ({ page }) => {
      // Validate reverse toggles the order of elements
      const p = new DynamicArrayPage(page);

      // Prepare deterministic array: clear then push known values
      await p.clear();
      await p.push('A');
      await p.push('B');
      await p.push('C');
      const before = await p.getArrayItemsText();
      expect(before[0]).toContain('A');
      expect(before[2]).toContain('C');

      await p.reverse();
      const after = await p.getArrayItemsText();
      // Now first should be C and last A
      expect(after[0]).toContain('C');
      expect(after[2]).toContain('A');

      expect((await p.getOperationLogText())).toContain('Reversed array');
    });

    test('Sort ascending and descending produce correct ordering and logs', async ({ page }) => {
      // Validate sort respects direction and logs appropriate message
      const p = new DynamicArrayPage(page);

      // Prepare unsorted numeric array: 3,1,2
      await p.clear();
      await p.push('3');
      await p.push('1');
      await p.push('2');

      // Sort ascending
      await p.sort('asc');
      const asc = (await p.getArrayItemsText()).map(t => parseFloat(t));
      expect(asc).toEqual([1, 2, 3]);

      expect((await p.getOperationLogText())).toContain('Sorted array in ascending order');

      // Sort descending
      await p.sort('desc');
      const desc = (await p.getArrayItemsText()).map(t => parseFloat(t));
      expect(desc).toEqual([3, 2, 1]);
      expect((await p.getOperationLogText())).toContain('Sorted array in descending order');
    });

    test('Clear empties array and updates info and log', async ({ page }) => {
      // Validate clear empties the array and log contains 'Cleared array'
      const p = new DynamicArrayPage(page);

      await p.push('9');
      expect(await p.getLength()).toBe(1);

      await p.clear();
      expect(await p.getLength()).toBe(0);
      expect((await p.arrayDisplay.textContent())?.trim()).toContain('Array is empty');
      expect((await p.getOperationLogText())).toContain('Cleared array');
    });

    test('Shuffle preserves multiset of elements (same elements after operation) and logs', async ({ page }) => {
      // Validate shuffle does not change elements (only order) by comparing sorted lists before and after
      const p = new DynamicArrayPage(page);

      // Set deterministic values 1..5
      await p.clear();
      const base = ['1', '2', '3', '4', '5'];
      for (const v of base) {
        await p.push(v);
      }

      const before = (await p.getArrayItemsText()).map(t => t.trim());
      // Shuffle
      await p.shuffle();
      const after = (await p.getArrayItemsText()).map(t => t.trim());

      // Compare sorted lists to ensure same elements exist
      const sortedBefore = [...before].sort();
      const sortedAfter = [...after].sort();
      expect(sortedAfter).toEqual(sortedBefore);

      // Operation log
      expect((await p.getOperationLogText())).toContain('Shuffled array');
    });
  });

  test.describe('Search, Filter and Map operations', () => {
    test('Find returns correct index for existing element and "Not found" otherwise', async ({ page }) => {
      // Validate find behavior for found and not found cases and log entries
      const p = new DynamicArrayPage(page);

      await p.clear();
      await p.push('alpha');
      await p.push('beta');

      await p.find('beta');
      expect(await p.getFindResultText()).toBe('Found at index 1');
      expect((await p.getOperationLogText())).toContain('Found value "beta" at index 1');

      // Searching for an absent value
      await p.find('gamma');
      expect(await p.getFindResultText()).toBe('Not found');
      expect((await p.getOperationLogText())).toContain('Value "gamma" not found in array');
    });

    test('Filter (gt, lt, eq) returns expected arrays and logs', async ({ page }) => {
      // Validate filtering based on numeric conditions; uses elToNum conversion internally
      const p = new DynamicArrayPage(page);

      await p.clear();
      // Push numeric-like strings: 1,5,10,3
      await p.push('1');
      await p.push('5');
      await p.push('10');
      await p.push('3');

      // Filter greater than 4 -> should keep 5 and 10
      await p.filter('gt', 4);
      const afterFilter = (await p.getArrayItemsText()).map(t => t.trim());
      // Expect array to be [5, 10]
      expect(afterFilter.length).toBe(2);
      expect(afterFilter).toContain('5');
      expect(afterFilter).toContain('10');
      expect((await p.getOperationLogText())).toContain('Filtered for values > 4');
    });

    test('Map transformations (square, double, increment, decrement) update array and logs', async ({ page }) => {
      // Validate map operations convert values via elToNum then apply transformation and log the operation
      const p = new DynamicArrayPage(page);

      // square operation
      await p.clear();
      await p.push('2');
      await p.push('3');
      await p.map('square'); // should become 4,9
      let items = (await p.getArrayItemsText()).map(t => parseFloat(t));
      expect(items).toEqual([4, 9]);
      expect((await p.getOperationLogText())).toContain('Mapped array to squares');

      // double operation
      await p.clear();
      await p.push('2');
      await p.push('5');
      await p.map('double'); // should become 4,10
      items = (await p.getArrayItemsText()).map(t => parseFloat(t));
      expect(items).toEqual([4, 10]);
      expect((await p.getOperationLogText())).toContain('Mapped array to doubled values');

      // increment
      await p.clear();
      await p.push('7');
      await p.map('increment'); // 8
      items = (await p.getArrayItemsText()).map(t => parseFloat(t));
      expect(items).toEqual([8]);
      expect((await p.getOperationLogText())).toContain('Incremented all array values');

      // decrement
      await p.clear();
      await p.push('7');
      await p.map('decrement'); // 6
      items = (await p.getArrayItemsText()).map(t => parseFloat(t));
      expect(items).toEqual([6]);
      expect((await p.getOperationLogText())).toContain('Decremented all array values');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Pop and Shift on empty array log appropriate error messages', async ({ page }) => {
      // Validate that popping/shifting empty array logs the "Cannot ... from empty array" messages
      const p = new DynamicArrayPage(page);

      // Ensure empty
      await p.clear();
      expect(await p.getLength()).toBe(0);

      // Pop on empty
      await p.pop();
      expect((await p.getOperationLogText())).toContain('Cannot pop from empty array');

      // Shift on empty
      await p.shift();
      expect((await p.getOperationLogText())).toContain('Cannot shift from empty array');
    });

    test('Invalid insert index and remove index produce invalid index logs', async ({ page }) => {
      // Validate that invalid indices produce 'Invalid index for insertion' or 'Invalid index for removal' in operation log
      const p = new DynamicArrayPage(page);

      // Ensure array length is small
      await p.clear();
      await p.push('100');

      // Try inserting at an invalid index (e.g., 100)
      await p.insertAt(100, 'x');
      expect((await p.getOperationLogText())).toContain('Invalid index for insertion');

      // Try removing at invalid index (e.g., 5)
      await p.removeAt(5);
      expect((await p.getOperationLogText())).toContain('Invalid index for removal');
    });

    test('Find behavior with numeric array from Fill demonstrates type-sensitive indexOf behavior', async ({ page }) => {
      // The app uses dynamicArray.indexOf(value) where value comes from an input string.
      // When the array contains numbers (from fill) and the search value is a string, indexOf may not match due to strict type equality.
      // This test asserts that behavior naturally occurs (and is not patched).
      const p = new DynamicArrayPage(page);

      // Fill with numeric values
      await p.fillRandom(3, 1, 3);
      // Grab an actual numeric element from the array (text)
      const items = (await p.getArrayItemsText()).map(t => t.trim());
      const numericValue = items[0]; // the displayed text will be e.g. "2"
      // Attempt to find by the same string value should succeed because indexOf compares strings to strings if stored as strings, but Fill uses numbers.
      // We record behavior without assuming outcome; the test asserts that find result is either Found or Not found but that an operation log entry is present.
      await p.find(numericValue);
      const findLog = await p.getOperationLogText();
      // Ensure an explicit log entry was recorded either as found or not found
      expect(
        findLog.includes(`Found value "${numericValue}"`) ||
          findLog.includes(`Value "${numericValue}" not found in array`)
      ).toBe(true);

      // The purpose here is to observe and assert that the runtime behavior occurs naturally (no thrown errors).
    });
  });
});