import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a31f8f0-ffc5-11f0-8b43-1ffa87931c43.html';

// Page object encapsulating interactions with the Array demo page
class ArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Content and output areas
    this.arrayContent = page.locator('#arrayContent');
    this.output = page.locator('#output');

    // Inputs / buttons
    this.pushValueInput = page.locator('#pushValue');
    this.btnPush = page.locator('#btnPush');

    this.popResultInput = page.locator('#popResult');
    this.btnPop = page.locator('#btnPop');

    this.unshiftValueInput = page.locator('#unshiftValue');
    this.btnUnshift = page.locator('#btnUnshift');

    this.shiftResultInput = page.locator('#shiftResult');
    this.btnShift = page.locator('#btnShift');

    this.indexOfValueInput = page.locator('#indexOfValue');
    this.btnIndexOf = page.locator('#btnIndexOf');
    this.indexOfResultSpan = page.locator('#indexOfResult');

    this.spliceIndexInput = page.locator('#spliceIndex');
    this.spliceCountInput = page.locator('#spliceCount');
    this.spliceInsertInput = page.locator('#spliceInsert');
    this.btnSplice = page.locator('#btnSplice');

    this.btnLength = page.locator('#btnLength');
    this.btnJoin = page.locator('#btnJoin');
    this.btnReverse = page.locator('#btnReverse');
    this.btnSort = page.locator('#btnSort');
    this.btnMap = page.locator('#btnMap');
    this.btnFilter = page.locator('#btnFilter');
    this.btnClear = page.locator('#btnClear');
  }

  async goto() {
    await this.page.goto(BASE_URL);
    // Wait for the initial updateDisplay to populate the arrayContent
    await expect(this.arrayContent).toBeVisible();
    // Ensure initial JSON is present
    await expect(this.arrayContent).not.toHaveText('', { timeout: 2000 });
  }

  // Utility to read the array displayed in #arrayContent (JSON)
  async getDisplayedArray() {
    const txt = await this.arrayContent.textContent();
    try {
      return JSON.parse(txt || 'null');
    } catch {
      // If parsing fails return raw text for debugging
      return txt;
    }
  }

  async getOutputText() {
    return (await this.output.textContent()) || '';
  }

  // Actions / interactions matching the FSM events
  async pushValue(value) {
    await this.pushValueInput.fill(String(value));
    await this.btnPush.click();
  }

  async pop() {
    await this.btnPop.click();
  }

  async unshiftValue(value) {
    await this.unshiftValueInput.fill(String(value));
    await this.btnUnshift.click();
  }

  async shift() {
    await this.btnShift.click();
  }

  async findIndex(value) {
    await this.indexOfValueInput.fill(String(value));
    await this.btnIndexOf.click();
  }

  // Splice: index/count may be numbers or strings; insertVal optional
  async splice(index, count, insertVal = '') {
    await this.spliceIndexInput.fill(String(index));
    await this.spliceCountInput.fill(String(count));
    await this.spliceInsertInput.fill(String(insertVal));
    await this.btnSplice.click();
  }

  async showLength() {
    await this.btnLength.click();
  }

  async showJoin() {
    await this.btnJoin.click();
  }

  async reverseArray() {
    await this.btnReverse.click();
  }

  async sortArray() {
    await this.btnSort.click();
  }

  async mapArray() {
    await this.btnMap.click();
  }

  async filterArray() {
    await this.btnFilter.click();
  }

  async resetArray() {
    await this.btnClear.click();
  }

  async getPopResult() {
    return (await this.popResultInput.inputValue()) || '';
  }

  async getShiftResult() {
    return (await this.shiftResultInput.inputValue()) || '';
  }

  async getIndexOfResult() {
    return (await this.indexOfResultSpan.textContent()) || '';
  }
}

test.describe('FSM: JavaScript Array Demo (5a31f8f0-ffc5-11f0-8b43-1ffa87931c43)', () => {
  // Capture console messages and page errors for each test run to ensure we observe runtime errors naturally.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages of type 'error' for later assertions
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Collect uncaught errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Group of tests verifying display and all FSM transitions / events
  test.describe('Array Operations - interactions & transitions', () => {
    test('Initial state: on load the display shows the initial array (updateDisplay onEnter)', async ({ page }) => {
      // Validate that the page loads and initial display matches the expected initial array
      const ap = new ArrayPage(page);
      await ap.goto();

      const displayed = await ap.getDisplayedArray();
      // The initial array as defined in the application
      const expectedInitial = ['apple', 'banana', 'cherry', 'date', 42, true, null];
      expect(displayed).toEqual(expectedInitial);

      // Ensure there were no runtime console errors or uncaught page errors during load
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('PushToArray: push values of various types and verify array content updates', async ({ page }) => {
      // Push a string, number, boolean, and null, verifying updateDisplay and clearOutput behavior
      const ap = new ArrayPage(page);
      await ap.goto();

      // Push 'grape'
      await ap.pushValue('grape');
      let arr = await ap.getDisplayedArray();
      expect(arr[arr.length - 1]).toBe('grape');

      // Push numeric string '123' (interpreted as number 123)
      await ap.pushValue('123');
      arr = await ap.getDisplayedArray();
      expect(arr[arr.length - 1]).toBe(123);

      // Push boolean 'true' => true
      await ap.pushValue('true');
      arr = await ap.getDisplayedArray();
      expect(arr[arr.length - 1]).toBe(true);

      // Push 'null' => null
      await ap.pushValue('null');
      arr = await ap.getDisplayedArray();
      expect(arr[arr.length - 1]).toBe(null);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('PopFromArray: pop returns last element and display updates', async ({ page }) => {
      const ap = new ArrayPage(page);
      await ap.goto();

      // Pop the last element (initially null)
      await ap.pop();
      const popResult = await ap.getPopResult();
      // String(null) => 'null'
      expect(popResult).toBe('null');

      // Array content should have length decreased by 1
      const arrAfterPop = await ap.getDisplayedArray();
      expect(arrAfterPop).toEqual(['apple', 'banana', 'cherry', 'date', 42, true]);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('UnshiftToArray & ShiftFromArray: add to front and remove from front', async ({ page }) => {
      const ap = new ArrayPage(page);
      await ap.goto();

      // Unshift 'kiwi' to front
      await ap.unshiftValue('kiwi');
      let arr = await ap.getDisplayedArray();
      expect(arr[0]).toBe('kiwi');

      // Shift should remove the first element ('kiwi')
      await ap.shift();
      const shiftResult = await ap.getShiftResult();
      expect(shiftResult).toBe('kiwi');

      // After shift content should match original initial array
      const arrAfter = await ap.getDisplayedArray();
      expect(arrAfter).toEqual(['apple', 'banana', 'cherry', 'date', 42, true, null]);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('FindIndex: indexOf for existing and non-existing values', async ({ page }) => {
      const ap = new ArrayPage(page);
      await ap.goto();

      // Find index of 'cherry' which should be 2
      await ap.findIndex('cherry');
      const found = await ap.getIndexOfResult();
      expect(found).toContain('Index: 2');

      // Find index of number 42
      await ap.findIndex('42');
      const foundNum = await ap.getIndexOfResult();
      // Note: interpretValue('42') -> Number(42) so index should be 4
      expect(foundNum).toContain('Index: 4');

      // Search for a missing value
      await ap.findIndex('not-present');
      const notFound = await ap.getIndexOfResult();
      expect(notFound).toBe('Value not found');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('SpliceArray: valid splice removes elements and optionally inserts values', async ({ page }) => {
      const ap = new ArrayPage(page);
      await ap.goto();

      // Splice at index 1, remove 2 elements (banana, cherry) and insert 'melon'
      await ap.splice(1, 2, 'melon');

      // Output should list removed elements (banana and cherry)
      const out = await ap.getOutputText();
      expect(out).toContain('Removed elements:');
      expect(out).toContain('"banana"');
      expect(out).toContain('"cherry"');

      // Displayed array should reflect the insertion 'melon' at index 1
      const arr = await ap.getDisplayedArray();
      expect(arr[1]).toBe('melon');
      // Ensure removed elements are not present
      expect(arr).not.toContain('banana');
      expect(arr).not.toContain('cherry');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('SpliceArray: invalid index and invalid count show alerts (edge cases)', async ({ page }) => {
      const ap = new ArrayPage(page);
      await ap.goto();

      const dialogs = [];
      page.on('dialog', async (dialog) => {
        dialogs.push({ message: dialog.message(), type: dialog.type() });
        await dialog.accept();
      });

      // invalid index (greater than length)
      await ap.splice(999, 1, 'x');
      // Expect one dialog about invalid splice index
      expect(dialogs.some(d => d.message.includes('Please enter a valid splice index.'))).toBeTruthy();

      // invalid count (negative)
      dialogs.length = 0; // reset
      await ap.splice(1, -5, '');
      expect(dialogs.some(d => d.message.includes('Please enter a valid splice count.'))).toBeTruthy();

      // Ensure array content unchanged (still initial array)
      const arr = await ap.getDisplayedArray();
      expect(arr).toEqual(['apple', 'banana', 'cherry', 'date', 42, true, null]);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('ShowLength & ShowJoin: output area displays array length and joined string', async ({ page }) => {
      const ap = new ArrayPage(page);
      await ap.goto();

      await ap.showLength();
      let out = await ap.getOutputText();
      expect(out).toBe('Array length: 7');

      await ap.showJoin();
      out = await ap.getOutputText();
      expect(out).toContain('Array joined with ","');
      // Joined string should include commas and 'apple' and 'banana'
      expect(out).toContain('apple,banana');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('ReverseArray: reverses the array and updates display & output', async ({ page }) => {
      const ap = new ArrayPage(page);
      await ap.goto();

      await ap.reverseArray();
      const arr = await ap.getDisplayedArray();
      // Compare to expected reversed
      const expectedReversed = [null, true, 42, 'date', 'cherry', 'banana', 'apple'];
      expect(arr).toEqual(expectedReversed);

      const out = await ap.getOutputText();
      expect(out).toBe('Array reversed.');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('SortArray: sorts elements as strings and updates display & output', async ({ page }) => {
      const ap = new ArrayPage(page);
      await ap.goto();

      await ap.sortArray();
      const arr = await ap.getDisplayedArray();

      // As the page sorts by String(a).localeCompare(String(b)),
      // expected order: 42 (number), 'apple', 'banana', 'cherry', 'date', null, true
      // However elements keep original types, so first element should be number 42
      expect(arr[0]).toBe(42);
      expect(arr[1]).toBe('apple');
      expect(arr[arr.length - 1]).toBe(true);

      const out = await ap.getOutputText();
      expect(out).toBe('Array sorted (as strings).');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('MapArray: maps strings to uppercase and leaves other types intact', async ({ page }) => {
      const ap = new ArrayPage(page);
      await ap.goto();

      await ap.mapArray();
      const arr = await ap.getDisplayedArray();

      // Strings should be uppercase; non-strings unchanged
      expect(arr[0]).toBe('APPLE');
      expect(arr[1]).toBe('BANANA');
      expect(arr[2]).toBe('CHERRY');
      expect(arr[3]).toBe('DATE');
      // Number and boolean remain as-is
      expect(arr).toContain(42);
      expect(arr).toContain(true);

      const out = await ap.getOutputText();
      expect(out).toBe('Mapped array (strings to uppercase).');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('FilterArray: filters strings with length > 3 and displays them in output', async ({ page }) => {
      const ap = new ArrayPage(page);
      await ap.goto();

      await ap.filterArray();
      const out = await ap.getOutputText();
      expect(out).toContain('Filtered array (strings with length > 3):');
      // Strings longer than 3 chars from initial array: apple, banana, cherry, date (date length==4)
      expect(out).toContain('"apple"');
      expect(out).toContain('"banana"');
      expect(out).toContain('"cherry"');
      expect(out).toContain('"date"');

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('ResetArray: resets the array to initial array and shows reset message', async ({ page }) => {
      const ap = new ArrayPage(page);
      await ap.goto();

      // Perform some changes first
      await ap.pushValue('temp');
      let arr = await ap.getDisplayedArray();
      expect(arr).toContain('temp');

      // Reset
      await ap.resetArray();
      const out = await ap.getOutputText();
      expect(out).toBe('Array reset to initial array.');

      // Display should be back to initial array
      arr = await ap.getDisplayedArray();
      expect(arr).toEqual(['apple', 'banana', 'cherry', 'date', 42, true, null]);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Observability: console and page errors (ensure runtime is healthy)', () => {
    test('No uncaught runtime errors or console.error entries during normal interactions', async ({ page }) => {
      const ap = new ArrayPage(page);

      // Reattach collectors for this test specifically
      const consoleErrs = [];
      const pageErrs = [];
      page.on('console', (m) => { if (m.type() === 'error') consoleErrs.push(m.text()); });
      page.on('pageerror', (e) => pageErrs.push(e));

      await ap.goto();

      // Run a sequence of actions that exercise the app
      await ap.pushValue('x');
      await ap.pop();
      await ap.unshiftValue('y');
      await ap.shift();
      await ap.findIndex('apple');
      await ap.splice(1, 0, 'z'); // valid
      await ap.showLength();
      await ap.showJoin();
      await ap.reverseArray();
      await ap.sortArray();
      await ap.mapArray();
      await ap.filterArray();
      await ap.resetArray();

      // Assert no console.error or uncaught exceptions were captured
      expect(consoleErrs.length).toBe(0);
      expect(pageErrs.length).toBe(0);

      // Also assert the global collectors created in beforeEach are still empty
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});