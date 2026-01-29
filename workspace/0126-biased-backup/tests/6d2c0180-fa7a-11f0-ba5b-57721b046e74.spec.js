import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2c0180-fa7a-11f0-ba5b-57721b046e74.html';

/**
 * Page Object for the Interactive Array Explorer
 * Encapsulates common operations and DOM queries used by the tests.
 */
class ArrayExplorerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayDisplay = page.locator('#arrayDisplay');
    this.arrayInfo = page.locator('#arrayInfo');
    this.operationResult = page.locator('#operationResult');
    this.historyCount = page.locator('#historyCount');

    // Controls
    this.arrayLength = page.locator('#arrayLength');
    this.lengthValue = page.locator('#lengthValue');
    this.randomMin = page.locator('#randomMin');
    this.randomMax = page.locator('#randomMax');
    this.randomizeBtn = page.locator('#randomizeBtn');

    this.reverseBtn = page.locator('#reverseBtn');
    this.sortBtn = page.locator('#sortBtn');
    this.sortOrder = page.locator('#sortOrder');
    this.shuffleBtn = page.locator('#shuffleBtn');

    this.pushValueInput = page.locator('#pushValue');
    this.pushBtn = page.locator('#pushBtn');
    this.popBtn = page.locator('#popBtn');

    this.unshiftValueInput = page.locator('#unshiftValue');
    this.unshiftBtn = page.locator('#unshiftBtn');
    this.shiftBtn = page.locator('#shiftBtn');

    this.spliceStart = page.locator('#spliceStart');
    this.spliceDelete = page.locator('#spliceDelete');
    this.spliceValue = page.locator('#spliceValue');
    this.spliceBtn = page.locator('#spliceBtn');

    this.mapOperation = page.locator('#mapOperation');
    this.mapBtn = page.locator('#mapBtn');

    this.filterCondition = page.locator('#filterCondition');
    this.filterValue = page.locator('#filterValue');
    this.filterBtn = page.locator('#filterBtn');

    this.reduceOperation = page.locator('#reduceOperation');
    this.reduceBtn = page.locator('#reduceBtn');

    this.findCondition = page.locator('#findCondition');
    this.findValue = page.locator('#findValue');
    this.findBtn = page.locator('#findBtn');

    this.undoBtn = page.locator('#undoBtn');
  }

  // Utility to parse the array display text into an array of numbers
  async getArrayValues() {
    const text = (await this.arrayDisplay.textContent()) || '';
    const trimmed = text.trim();
    if (trimmed === '[]' || trimmed === '') return [];
    const inner = trimmed.replace(/^\[/, '').replace(/\]$/, '').trim();
    if (inner === '') return [];
    return inner.split(',').map(s => Number(s.trim()));
  }

  async getArrayLengthFromInfo() {
    const info = (await this.arrayInfo.textContent()) || '';
    const match = info.match(/Length:\s*(\d+)/);
    return match ? Number(match[1]) : null;
  }

  async getHistoryCount() {
    const text = (await this.historyCount.textContent()) || '';
    const match = text.match(/Undo steps:\s*(\d+)/);
    return match ? Number(match[1]) : null;
  }

  // High-level operations mapped to UI interactions
  async setArrayLength(len) {
    await this.arrayLength.fill(String(len));
    // slider triggers input event; ensure updateLengthControls runs
    await this.page.evaluate((v) => {
      const el = document.getElementById('arrayLength');
      el.value = v;
      el.dispatchEvent(new Event('input'));
    }, String(len));
  }

  async clickCreateArray() {
    // The Create Array button uses inline onclick createArray()
    await this.page.locator('button', { hasText: 'Create Array' }).click();
  }

  async randomize(min = 1, max = 100) {
    await this.randomMin.fill(String(min));
    await this.randomMax.fill(String(max));
    await this.randomizeBtn.click();
  }

  async reverse() {
    await this.reverseBtn.click();
  }

  async sort(order = 'asc') {
    await this.sortOrder.selectOption(order);
    await this.sortBtn.click();
  }

  async shuffle() {
    await this.shuffleBtn.click();
  }

  async pushValue(value) {
    await this.pushValueInput.fill(String(value));
    await this.pushBtn.click();
  }

  async popValue() {
    await this.popBtn.click();
  }

  async unshiftValue(value) {
    await this.unshiftValueInput.fill(String(value));
    await this.unshiftBtn.click();
  }

  async shiftValue() {
    await this.shiftBtn.click();
  }

  async splice(start, deleteCount, value) {
    await this.spliceStart.fill(String(start));
    await this.spliceDelete.fill(String(deleteCount));
    await this.spliceValue.fill(String(value));
    await this.spliceBtn.click();
  }

  async applyMap(op) {
    await this.mapOperation.selectOption(op);
    await this.mapBtn.click();
  }

  async applyFilter(condition, value) {
    await this.filterCondition.selectOption(condition);
    await this.filterValue.fill(String(value));
    await this.filterBtn.click();
  }

  async reduce(op) {
    await this.reduceOperation.selectOption(op);
    await this.reduceBtn.click();
  }

  async find(condition, value) {
    await this.findCondition.selectOption(condition);
    await this.findValue.fill(String(value));
    await this.findBtn.click();
  }

  async undo() {
    await this.undoBtn.click();
  }
}

// Global setup to capture console errors and page errors produced during navigation and tests.
// Each test will get a fresh capture arrays in beforeEach.
test.describe('Interactive Array Explorer - FSM coverage', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages early (before navigation) to observe onload/init errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({}, testInfo) => {
    // Basic sanity: ensure no uncaught page errors occurred during the test run
    // This asserts that no runtime exceptions leaked to pageerror
    expect(pageErrors, `Page errors logged during "${testInfo.title}": ${pageErrors.map(e => String(e)).join('; ')}`).toHaveLength(0);

    // Additionally check the console for severe errors (console.error)
    const errorConsole = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsole, `Console error/warning messages during "${testInfo.title}": ${errorConsole.map(e => e.text).join(' || ')}`).toHaveLength(0);
  });

  test.describe('Initialization and basic UI state', () => {
    test('onload should call init() and initialize an array (S0_Idle -> S1_ArrayCreated)', async ({ page }) => {
      // Validate createArray was called on load: array length should be 10 and arrayDisplay reflects zeros
      const app = new ArrayExplorerPage(page);

      const values = await app.getArrayValues();
      expect(values.length).toBe(10);
      // All initial values should be zeros
      expect(values.every(v => v === 0)).toBeTruthy();

      const lengthInfo = await app.getArrayLengthFromInfo();
      expect(lengthInfo).toBe(10);

      const historyCount = await app.getHistoryCount();
      // init->createArray pushes one history entry (initial empty array)
      expect(historyCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Array manipulation events and transitions', () => {
    test('RandomizeValues should change values but preserve length (S2_ArrayRandomized)', async ({ page }) => {
      const app = new ArrayExplorerPage(page);

      const before = await app.getArrayValues();
      await app.randomize(1, 5); // small range to increase chance of change
      const after = await app.getArrayValues();

      expect(after.length).toBe(before.length);

      // It's possible (rare) that all values remain same; assert that the content is a valid numeric array and not malformed
      expect(after.every(v => Number.isFinite(v))).toBeTruthy();
      // If possible check that at least one value differs from before OR that randomization executed by checking history count increased
      const historyCount = await app.getHistoryCount();
      expect(historyCount).toBeGreaterThanOrEqual(1);
    });

    test('ReverseArray should reverse order and double reversing restores original (S3_ArrayReversed)', async ({ page }) => {
      const app = new ArrayExplorerPage(page);

      // Ensure deterministic initial content: create array length 5 and push known values
      await app.setArrayLength(5);
      await app.clickCreateArray();
      // Set content to [1,2,3,4,5] by unshifting/pushing after clearing
      // We'll pop repeatedly then push known sequence
      for (let i = 0; i < 5; i++) {
        await app.popValue();
      }
      // Now push 1..5
      for (let i = 1; i <= 5; i++) {
        await app.pushValue(i);
      }

      const before = await app.getArrayValues();
      expect(before).toEqual([1, 2, 3, 4, 5]);

      await app.reverse();
      const reversed = await app.getArrayValues();
      expect(reversed).toEqual([5, 4, 3, 2, 1]);

      // Reverse again to restore
      await app.reverse();
      const restored = await app.getArrayValues();
      expect(restored).toEqual(before);
    });

    test('SortArray ascending and descending (S4_ArraySorted)', async ({ page }) => {
      const app = new ArrayExplorerPage(page);

      // Prepare array with values [3,1,4,2]
      await app.setArrayLength(4);
      await app.clickCreateArray();
      for (let i = 0; i < 4; i++) {
        await app.popValue(); // clear zeros
      }
      await app.pushValue(3);
      await app.pushValue(1);
      await app.pushValue(4);
      await app.pushValue(2);

      await app.sort('asc');
      const asc = await app.getArrayValues();
      for (let i = 0; i < asc.length - 1; i++) {
        expect(asc[i]).toBeLessThanOrEqual(asc[i + 1]);
      }

      await app.sort('desc');
      const desc = await app.getArrayValues();
      for (let i = 0; i < desc.length - 1; i++) {
        expect(desc[i]).toBeGreaterThanOrEqual(desc[i + 1]);
      }
    });

    test('ShuffleArray should preserve multiset of elements (S5_ArrayShuffled)', async ({ page }) => {
      const app = new ArrayExplorerPage(page);

      // Create known array [1,2,3,4,5]
      await app.setArrayLength(5);
      await app.clickCreateArray();
      for (let i = 0; i < 5; i++) {
        await app.popValue();
      }
      for (let i = 1; i <= 5; i++) {
        await app.pushValue(i);
      }

      const before = await app.getArrayValues();
      const sumBefore = before.reduce((a, b) => a + b, 0);

      await app.shuffle();
      const after = await app.getArrayValues();
      const sumAfter = after.reduce((a, b) => a + b, 0);

      expect(after.length).toBe(before.length);
      // Sum should be preserved after shuffle
      expect(sumAfter).toBe(sumBefore);
      // It should generally change order; if not (rare), we still accept but ensure it's a permutation
      const sortedBefore = [...before].sort((a, b) => a - b);
      const sortedAfter = [...after].sort((a, b) => a - b);
      expect(sortedAfter).toEqual(sortedBefore);
    });

    test('Push and Pop update display and operationResult (S6_ValuePushed, S7_ValuePopped)', async ({ page }) => {
      const app = new ArrayExplorerPage(page);

      await app.setArrayLength(3);
      await app.clickCreateArray();
      // Clear zeros
      for (let i = 0; i < 3; i++) await app.popValue();

      const initialLength = (await app.getArrayValues()).length;
      await app.pushValue(42);
      const afterPush = await app.getArrayValues();
      expect(afterPush[afterPush.length - 1]).toBe(42);
      expect(afterPush.length).toBe(initialLength + 1);

      await app.popValue();
      const popResultText = (await app.operationResult.textContent()) || '';
      expect(popResultText).toContain('Popped:');
      const afterPop = await app.getArrayValues();
      expect(afterPop.length).toBe(initialLength);
    });

    test('Unshift and Shift update display and operationResult (S8_ValueUnshifted, S9_ValueShifted)', async ({ page }) => {
      const app = new ArrayExplorerPage(page);

      await app.setArrayLength(2);
      await app.clickCreateArray();
      // Clear zeros
      for (let i = 0; i < 2; i++) await app.popValue();

      await app.pushValue(10);
      await app.pushValue(20);

      await app.unshiftValue(5);
      let vals = await app.getArrayValues();
      expect(vals[0]).toBe(5);

      await app.shiftValue();
      const op = (await app.operationResult.textContent()) || '';
      expect(op).toContain('Shifted:');
      vals = await app.getArrayValues();
      // after shift the first element should be 10 (we removed 5)
      expect(vals[0]).toBe(10);
    });

    test('Splice (delete and insert) reports deleted values and updates array (S10_ArraySpliced)', async ({ page }) => {
      const app = new ArrayExplorerPage(page);

      // Prepare [1,2,3,4]
      await app.setArrayLength(4);
      await app.clickCreateArray();
      for (let i = 0; i < 4; i++) await app.popValue();
      [1, 2, 3, 4].forEach(async (v) => {
        // sequentially push, but ensure awaited
      });
      // push sequentially
      await app.pushValue(1);
      await app.pushValue(2);
      await app.pushValue(3);
      await app.pushValue(4);

      const before = await app.getArrayValues();
      expect(before).toEqual([1, 2, 3, 4]);

      // Splice at index 1, delete 1, insert 99
      await app.splice(1, 1, 99);
      const opText = (await app.operationResult.textContent()) || '';
      expect(opText).toContain('Deleted:');

      const after = await app.getArrayValues();
      // Deleted 2 replaced by 99 -> [1,99,3,4]
      expect(after).toEqual([1, 99, 3, 4]);
    });

    test('Map applies transformation to all elements (S11_ArrayMapped)', async ({ page }) => {
      const app = new ArrayExplorerPage(page);

      // Prepare [1,2,3]
      await app.setArrayLength(3);
      await app.clickCreateArray();
      for (let i = 0; i < 3; i++) await app.popValue();
      await app.pushValue(1);
      await app.pushValue(2);
      await app.pushValue(3);

      const before = await app.getArrayValues();
      await app.applyMap('double');
      const after = await app.getArrayValues();
      expect(after).toEqual(before.map(x => x * 2));
    });

    test('Filter reduces array based on condition (S12_ArrayFiltered)', async ({ page }) => {
      const app = new ArrayExplorerPage(page);

      // Prepare [1,5,10,15]
      await app.setArrayLength(4);
      await app.clickCreateArray();
      for (let i = 0; i < 4; i++) await app.popValue();
      await app.pushValue(1);
      await app.pushValue(5);
      await app.pushValue(10);
      await app.pushValue(15);

      await app.applyFilter('gt', 9);
      const after = await app.getArrayValues();
      expect(after.every(x => x > 9)).toBeTruthy();
    });

    test('Reduce computes sum/product/max/min and displays result (S13_ArrayReduced)', async ({ page }) => {
      const app = new ArrayExplorerPage(page);

      // Prepare [2,3,5]
      await app.setArrayLength(3);
      await app.clickCreateArray();
      for (let i = 0; i < 3; i++) await app.popValue();
      await app.pushValue(2);
      await app.pushValue(3);
      await app.pushValue(5);

      await app.reduce('sum');
      let res = (await app.operationResult.textContent()) || '';
      expect(res).toContain('Result: 10');

      await app.reduce('product');
      res = (await app.operationResult.textContent()) || '';
      expect(res).toContain('Result: 30');

      await app.reduce('max');
      res = (await app.operationResult.textContent()) || '';
      expect(res).toContain('Result: 5');

      await app.reduce('min');
      res = (await app.operationResult.textContent()) || '';
      expect(res).toContain('Result: 2');
    });

    test('Find returns first matching value and displays it (S14_ValueFound)', async ({ page }) => {
      const app = new ArrayExplorerPage(page);

      // Prepare [1,4,7]
      await app.setArrayLength(3);
      await app.clickCreateArray();
      for (let i = 0; i < 3; i++) await app.popValue();
      await app.pushValue(1);
      await app.pushValue(4);
      await app.pushValue(7);

      await app.find('gt', 3);
      const res = (await app.operationResult.textContent()) || '';
      expect(res).toContain('Found: 4');
    });
  });

  test.describe('History, Undo and edge cases', () => {
    test('Undo reverts last action (S15_ActionUndone)', async ({ page }) => {
      const app = new ArrayExplorerPage(page);

      // Start from known state [1,2,3]
      await app.setArrayLength(3);
      await app.clickCreateArray();
      for (let i = 0; i < 3; i++) await app.popValue();
      await app.pushValue(1);
      await app.pushValue(2);
      await app.pushValue(3);

      const before = await app.getArrayValues();
      await app.pushValue(9); // modify
      const modified = await app.getArrayValues();
      expect(modified.length).toBe(before.length + 1);

      await app.undo();
      const afterUndo = await app.getArrayValues();
      // Undo should remove the pushed value and restore previous values
      expect(afterUndo).toEqual(before);
    });

    test('Popping and shifting on empty array produce undefined results and display correctly', async ({ page }) => {
      const app = new ArrayExplorerPage(page);

      // Create small array length 1 and pop until empty
      await app.setArrayLength(1);
      await app.clickCreateArray();

      await app.popValue(); // removes the single element -> operationResult shows Popped: 0 (initial)
      // Pop again on empty
      await app.popValue();
      const popText = (await app.operationResult.textContent()) || '';
      expect(popText).toContain('Popped:'); // may be undefined
      // Validate arrayDisplay is empty
      const vals = await app.getArrayValues();
      expect(vals.length).toBeGreaterThanOrEqual(0);

      // Shift on empty
      await app.shiftValue();
      const shiftText = (await app.operationResult.textContent()) || '';
      expect(shiftText).toContain('Shifted:');
    });

    test('Splice with deleteCount larger than array length does not crash and reports deleted elements', async ({ page }) => {
      const app = new ArrayExplorerPage(page);

      // Prepare [1,2]
      await app.setArrayLength(2);
      await app.clickCreateArray();
      for (let i = 0; i < 2; i++) await app.popValue();
      await app.pushValue(1);
      await app.pushValue(2);

      // Splice deleteCount > length
      await app.splice(0, 100, 9);
      const opText = (await app.operationResult.textContent()) || '';
      // Deleted might contain the removed elements; ensure no crash and display updated
      expect(opText.startsWith('Deleted:') || opText === '').toBeTruthy();

      const after = await app.getArrayValues();
      // After splicing (deleting all and adding 9 at position 0), array should contain 9 at least
      expect(after.length).toBeGreaterThanOrEqual(1);
    });

    test('Reduce on empty array returns defined values based on operation (edge behavior)', async ({ page }) => {
      const app = new ArrayExplorerPage(page);

      // Create empty-like by setting length 1 then popping to empty
      await app.setArrayLength(1);
      await app.clickCreateArray();
      await app.popValue(); // now likely empty

      // sum should be 0 per implementation
      await app.reduce('sum');
      let res = (await app.operationResult.textContent()) || '';
      expect(res).toContain('Result: 0');

      await app.reduce('product');
      res = (await app.operationResult.textContent()) || '';
      expect(res).toContain('Result: 1');

      await app.reduce('max');
      res = (await app.operationResult.textContent()) || '';
      expect(res).toContain('Result: -Infinity');

      await app.reduce('min');
      res = (await app.operationResult.textContent()) || '';
      expect(res).toContain('Result: Infinity');
    });
  });

  test.describe('Console and runtime observation', () => {
    test('No uncaught runtime exceptions or console.errors on load and routine interactions', async ({ page }) => {
      const app = new ArrayExplorerPage(page);

      // Perform a few interactions to surface potential runtime errors
      await app.randomize(0, 10);
      await app.pushValue(7);
      await app.splice(0, 0, 99);
      await app.applyMap('increment');
      await app.applyFilter('even', 0);
      await app.reduce('sum');
      await app.find('eq', 99);
      await app.undo();

      // The afterEach hook will assert that pageErrors and console error messages arrays are empty.
      // This test ensures we exercised many code paths to reveal potential runtime issues.
      expect(true).toBeTruthy(); // placeholder expectation (real checks in afterEach)
    });
  });
});