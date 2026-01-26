import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121203d0-fa7a-11f0-acf9-69409043402d.html';

// Page Object encapsulating common interactions and selectors
class ArrayPage {
  constructor(page) {
    this.page = page;
    // selectors frequently used
    this.selectors = {
      arraySizeInput: '#arraySizeInput',
      createArrayBtn: '#createArrayBtn',
      createRandomArrayBtn: '#createRandomArrayBtn',
      createSequenceArrayBtn: '#createSequenceArrayBtn',
      arrayContainer: '#arrayContainer',
      arrayLength: '#arrayLength',
      arrayJsonView: '#arrayJsonView',
      addElementBtn: '#addElementBtn',
      removeElementBtn: '#removeElementBtn',
      clearArrayBtn: '#clearArrayBtn',
      editIndexInput: '#editIndexInput',
      editValueInput: '#editValueInput',
      setElementBtn: '#setElementBtn',
      editElementError: '#editElementError',
      pushValueInput: '#pushValueInput',
      pushBtn: '#pushBtn',
      popBtn: '#popBtn',
      pushPopResult: '#pushPopResult',
      unshiftValueInput: '#unshiftValueInput',
      unshiftBtn: '#unshiftBtn',
      shiftBtn: '#shiftBtn',
      shiftUnshiftResult: '#shiftUnshiftResult',
      spliceStartInput: '#spliceStartInput',
      spliceDeleteCountInput: '#spliceDeleteCountInput',
      spliceItemsInput: '#spliceItemsInput',
      spliceBtn: '#spliceBtn',
      spliceResult: '#spliceResult',
      sliceStartInput: '#sliceStartInput',
      sliceEndInput: '#sliceEndInput',
      sliceBtn: '#sliceBtn',
      sliceResult: '#sliceResult',
      searchValueInput: '#searchValueInput',
      indexOfBtn: '#indexOfBtn',
      lastIndexOfBtn: '#lastIndexOfBtn',
      indexOfResult: '#indexOfResult',
      joinSeparatorInput: '#joinSeparatorInput',
      joinBtn: '#joinBtn',
      joinResult: '#joinResult',
      sortTypeSelect: '#sortTypeSelect',
      sortBtn: '#sortBtn',
      reverseBtn: '#reverseBtn',
      sortReverseResult: '#sortReverseResult',
      mapExpressionInput: '#mapExpressionInput',
      mapBtn: '#mapBtn',
      mapResult: '#mapResult',
      filterExpressionInput: '#filterExpressionInput',
      filterBtn: '#filterBtn',
      filterResult: '#filterResult',
      reduceExpressionInput: '#reduceExpressionInput',
      reduceInitialInput: '#reduceInitialInput',
      reduceBtn: '#reduceBtn',
      reduceResult: '#reduceResult',
      findExpressionInput: '#findExpressionInput',
      findBtn: '#findBtn',
      findResult: '#findResult',
      findIndexExpressionInput: '#findIndexExpressionInput',
      findIndexBtn: '#findIndexBtn',
      findIndexResult: '#findIndexResult',
      copyJsonBtn: '#copyJsonBtn'
    };
  }

  async goto() {
    await this.page.goto(BASE_URL, { waitUntil: 'load' });
  }

  async setValue(selector, value) {
    await this.page.fill(selector, String(value));
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async getArrayLength() {
    return Number(await this.page.textContent(this.selectors.arrayLength));
  }

  async getJson() {
    return await this.page.$eval(this.selectors.arrayJsonView, el => el.value);
  }

  async getArrayInputsCount() {
    return await this.page.$$eval(`${this.selectors.arrayContainer} input`, inputs => inputs.length);
  }

  async getArrayInputValues() {
    return await this.page.$$eval(`${this.selectors.arrayContainer} input`, inputs => inputs.map(i => i.value));
  }

  async getText(selector) {
    return await this.page.textContent(selector);
  }
}

// Global grouping of tests by functionality
test.describe('Array Interactive Demo - FSM based E2E tests', () => {
  let page;
  let arrayPage;
  let consoleErrors;
  let pageErrors;
  let dialogs;

  // Setup and listeners for console errors/page errors/dialogs
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    arrayPage = new ArrayPage(page);
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Capture console errors to ensure no silent failures
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(String(err.stack || err));
    });

    // Auto-accept alerts but record them for assertions
    page.on('dialog', async dialog => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });

    await arrayPage.goto();
  });

  test.afterEach(async () => {
    // Ensure no unexpected runtime errors were raised by the page during the test
    // The FSM/instructions required observing console and page errors. We assert none occurred.
    expect(pageErrors, 'No page error (uncaught exception) should occur').toEqual([]);
    expect(consoleErrors, 'No console.error messages should appear').toEqual([]);
    await page.close();
  });

  // Creation-related tests (S0_Idle -> S1_ArrayCreated and edge-cases)
  test.describe('Array Creation & Initialization', () => {
    test('initial state S0_Idle renders empty array and JSON view', async () => {
      // On load, array is initialized to [] and renderArray was called (onEnter check)
      const len = await arrayPage.getArrayLength();
      expect(len).toBe(0);
      const count = await arrayPage.getArrayInputsCount();
      expect(count).toBe(0);
      const json = await arrayPage.getJson();
      expect(json.trim()).toBe('[]');
    });

    test('Create Empty Array (transition to S1_ArrayCreated) with size 3', async () => {
      // Set size to 3 and click create empty array
      await arrayPage.setValue(arrayPage.selectors.arraySizeInput, '3');
      await arrayPage.click(arrayPage.selectors.createArrayBtn);

      // Expect array to have length 3 (entry action renderArray called)
      const len = await arrayPage.getArrayLength();
      expect(len).toBe(3);

      // JSON view: fill(undefined) results in nulls in JSON
      const json = await arrayPage.getJson();
      expect(JSON.parse(json).length).toBe(3);
      // expect nulls because undefined becomes null in JSON
      expect(JSON.parse(json)[0]).toBe(null);

      // There should be 3 input boxes in the UI representing elements
      const count = await arrayPage.getArrayInputsCount();
      expect(count).toBe(3);
    });

    test('Create Random Array and Create Sequence Array produce expected lengths and values', async () => {
      await arrayPage.setValue(arrayPage.selectors.arraySizeInput, '4');
      await arrayPage.click(arrayPage.selectors.createRandomArrayBtn);
      let json = JSON.parse(await arrayPage.getJson());
      expect(json.length).toBe(4);
      // elements should be numbers in 0..99
      expect(json.every(x => typeof x === 'number')).toBeTruthy();

      // Now sequence
      await arrayPage.setValue(arrayPage.selectors.arraySizeInput, '5');
      await arrayPage.click(arrayPage.selectors.createSequenceArrayBtn);
      json = JSON.parse(await arrayPage.getJson());
      expect(json).toEqual([0,1,2,3,4]);
    });

    test('Creating with invalid sizes triggers alert (edge case)', async () => {
      // Zero size
      await arrayPage.setValue(arrayPage.selectors.arraySizeInput, '0');
      await arrayPage.click(arrayPage.selectors.createArrayBtn);
      // Dialog recorded and auto-accepted
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length-1].message).toContain('Array size must be an integer between 1 and 1000');

      // Very large invalid float
      await arrayPage.setValue(arrayPage.selectors.arraySizeInput, '3.14');
      await arrayPage.click(arrayPage.selectors.createRandomArrayBtn);
      expect(dialogs[dialogs.length-1].message).toContain('Array size must be an integer between 1 and 1000');
    });
  });

  // Modification tests (Add/Remove/Clear/Push/Pop/Unshift/Shift/Splice/Slice)
  test.describe('Array Modification - S2_ArrayModified', () => {
    test.beforeEach(async () => {
      // create a known array to modify
      await arrayPage.setValue(arrayPage.selectors.arraySizeInput, '3');
      await arrayPage.click(arrayPage.selectors.createSequenceArrayBtn); // [0,1,2]
    });

    test('Add Element to End increases length and shows empty input', async () => {
      await arrayPage.click(arrayPage.selectors.addElementBtn);
      expect(await arrayPage.getArrayLength()).toBe(4);
      const inputs = await arrayPage.getArrayInputValues();
      expect(inputs[3]).toBe(''); // newly added element is empty string
    });

    test('Remove Last Element decreases length', async () => {
      await arrayPage.click(arrayPage.selectors.removeElementBtn);
      expect(await arrayPage.getArrayLength()).toBe(2);
      const json = JSON.parse(await arrayPage.getJson());
      expect(json).toEqual([0,1]);
    });

    test('Clear Array empties everything', async () => {
      await arrayPage.click(arrayPage.selectors.clearArrayBtn);
      expect(await arrayPage.getArrayLength()).toBe(0);
      expect(await arrayPage.getArrayInputsCount()).toBe(0);
      expect(await arrayPage.getJson()).toBe('[]');
    });

    test('Push and Pop update UI and show message', async () => {
      await arrayPage.setValue(arrayPage.selectors.pushValueInput, '42');
      await arrayPage.click(arrayPage.selectors.pushBtn);
      expect((await arrayPage.getArrayLength())).toBe(4); // initial 3 + push
      expect(await arrayPage.getText(arrayPage.selectors.pushPopResult)).toContain('Pushed value: 42');

      await arrayPage.click(arrayPage.selectors.popBtn);
      expect(await arrayPage.getArrayLength()).toBe(3);
      expect(await arrayPage.getText(arrayPage.selectors.pushPopResult)).toContain('Popped value: 42');
    });

    test('Unshift and Shift update UI and show messages', async () => {
      await arrayPage.setValue(arrayPage.selectors.unshiftValueInput, 'a');
      await arrayPage.click(arrayPage.selectors.unshiftBtn);
      expect(await arrayPage.getArrayLength()).toBe(4); // 3 + unshift
      expect(await arrayPage.getText(arrayPage.selectors.shiftUnshiftResult)).toContain('Unshifted value: a');

      await arrayPage.click(arrayPage.selectors.shiftBtn);
      expect(await arrayPage.getArrayLength()).toBe(3);
      expect(await arrayPage.getText(arrayPage.selectors.shiftUnshiftResult)).toContain('Shifted value:');
    });

    test('Splice removes and inserts items and displays removed items', async () => {
      // Current array [0,1,2]
      await arrayPage.setValue(arrayPage.selectors.spliceStartInput, '1');
      await arrayPage.setValue(arrayPage.selectors.spliceDeleteCountInput, '1');
      await arrayPage.setValue(arrayPage.selectors.spliceItemsInput, 'X,Y');
      await arrayPage.click(arrayPage.selectors.spliceBtn);
      const json = JSON.parse(await arrayPage.getJson());
      // one removed (1) replaced with X, Y -> [0, 'X', 'Y', 2]
      expect(json).toEqual([0, 'X', 'Y', 2]);
      const spliceResult = await arrayPage.getText(arrayPage.selectors.spliceResult);
      expect(spliceResult).toContain('Removed items: [1]');
    });

    test('Slice returns a portion and handles invalid end value gracefully', async () => {
      // slice 1..invalidEnd (-1) which should default to full length per implementation
      await arrayPage.setValue(arrayPage.selectors.sliceStartInput, '1');
      await arrayPage.setValue(arrayPage.selectors.sliceEndInput, '-5');
      await arrayPage.click(arrayPage.selectors.sliceBtn);
      const sliceResult = await arrayPage.getText(arrayPage.selectors.sliceResult);
      // Should show sliced array starting from index 1
      expect(sliceResult).toContain('Sliced array:');
      expect(sliceResult).toContain(JSON.stringify([1,2]));
    });
  });

  // Element editing (S3_ElementEdited) with valid and invalid indices
  test.describe('Element Editing - S3_ElementEdited', () => {
    test.beforeEach(async () => {
      await arrayPage.setValue(arrayPage.selectors.arraySizeInput, '3');
      await arrayPage.click(arrayPage.selectors.createSequenceArrayBtn); // [0,1,2]
    });

    test('Set element with valid index updates the array and clears input', async () => {
      await arrayPage.setValue(arrayPage.selectors.editIndexInput, '1');
      await arrayPage.setValue(arrayPage.selectors.editValueInput, '100');
      await arrayPage.click(arrayPage.selectors.setElementBtn);
      const json = JSON.parse(await arrayPage.getJson());
      expect(json[1]).toBe(100);
      // editValueInput cleared after operation
      const value = await page.$eval(arrayPage.selectors.editValueInput, el => el.value);
      expect(value).toBe('');
    });

    test('Set element with invalid index shows error message (edge case)', async () => {
      await arrayPage.setValue(arrayPage.selectors.editIndexInput, '10'); // out of range
      await arrayPage.setValue(arrayPage.selectors.editValueInput, 'foo');
      await arrayPage.click(arrayPage.selectors.setElementBtn);
      const err = await arrayPage.getText(arrayPage.selectors.editElementError);
      expect(err).toContain('Invalid index.');
    });
  });

  // Search/Join/Sort/Reverse (S4, S5, S6)
  test.describe('Search, Join, Sort and Reverse - S4_ArraySearched / S5_ArrayJoined / S6_ArraySorted', () => {
    test.beforeEach(async () => {
      // Create sequence [0,1,2,3]
      await arrayPage.setValue(arrayPage.selectors.arraySizeInput, '4');
      await arrayPage.click(arrayPage.selectors.createSequenceArrayBtn);
    });

    test('IndexOf and LastIndexOf find correct indices', async () => {
      // Add duplicate 2 at end
      await arrayPage.setValue(arrayPage.selectors.pushValueInput, '2');
      await arrayPage.click(arrayPage.selectors.pushBtn); // array now [0,1,2,3,2]
      await arrayPage.setValue(arrayPage.selectors.searchValueInput, '2');
      await arrayPage.click(arrayPage.selectors.indexOfBtn);
      let res = await arrayPage.getText(arrayPage.selectors.indexOfResult);
      expect(res).toContain('IndexOf "2": 2');

      await arrayPage.click(arrayPage.selectors.lastIndexOfBtn);
      res = await arrayPage.getText(arrayPage.selectors.indexOfResult);
      expect(res).toContain('LastIndexOf "2": 4');
    });

    test('Join displays joined string using provided separator', async () => {
      await arrayPage.setValue(arrayPage.selectors.joinSeparatorInput, '-');
      await arrayPage.click(arrayPage.selectors.joinBtn);
      const joinRes = await arrayPage.getText(arrayPage.selectors.joinResult);
      expect(joinRes).toContain('Joined string: 0-1-2-3');
    });

    test('Sort numeric asc, sort default and reverse operations', async () => {
      // Create random numbers
      await arrayPage.setValue(arrayPage.selectors.arraySizeInput, '5');
      await arrayPage.click(arrayPage.selectors.createRandomArrayBtn);
      const beforeSort = JSON.parse(await arrayPage.getJson()).slice();
      // numeric ascending
      await arrayPage.selectors; // no-op to keep clarity
      await arrayPage.setValue(arrayPage.selectors.sortTypeSelect, 'numericAsc');
      await arrayPage.click(arrayPage.selectors.sortBtn);
      const sorted = JSON.parse(await arrayPage.getJson());
      // ensure sorted non-decreasing
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i]).toBeGreaterThanOrEqual(sorted[i-1]);
      }
      expect(await arrayPage.getText(arrayPage.selectors.sortReverseResult)).toContain('Array sorted.');

      // Reverse
      await arrayPage.click(arrayPage.selectors.reverseBtn);
      expect(await arrayPage.getText(arrayPage.selectors.sortReverseResult)).toContain('Array reversed.');
      const reversedJson = JSON.parse(await arrayPage.getJson());
      expect(reversedJson[0]).toBe(sorted[sorted.length - 1]);
    });
  });

  // Map/Filter/Reduce/Find/FindIndex (S7, S8, S9, S10, S11)
  test.describe('Functional Methods - Map, Filter, Reduce, Find, FindIndex', () => {
    test.beforeEach(async () => {
      // create array [1,2,3,4,5] for these tests
      await arrayPage.setValue(arrayPage.selectors.arraySizeInput, '5');
      await arrayPage.click(arrayPage.selectors.createSequenceArrayBtn);
      // convert sequence [0..4] to [1..5] via map for convenience: set element 0..4 plus 1
      // We'll just set values directly by setting inputs (simpler)
      const inputs = await page.$$(`${arrayPage.selectors.arrayContainer} input`);
      for (let i = 0; i < inputs.length; i++) {
        await inputs[i].fill(String(i + 1));
        // trigger change event
        await inputs[i].dispatchEvent('change');
      }
      // confirm
      const json = JSON.parse(await arrayPage.getJson());
      expect(json).toEqual([1,2,3,4,5]);
    });

    test('Map with invalid expressions shows guidance and unsafe expressions are rejected', async () => {
      // empty expression
      await arrayPage.setValue(arrayPage.selectors.mapExpressionInput, '');
      await arrayPage.click(arrayPage.selectors.mapBtn);
      expect(await arrayPage.getText(arrayPage.selectors.mapResult)).toContain('Please enter a mapping expression.');

      // unsafe expression
      await arrayPage.setValue(arrayPage.selectors.mapExpressionInput, 'window.alert(1)');
      await arrayPage.click(arrayPage.selectors.mapBtn);
      expect(await arrayPage.getText(arrayPage.selectors.mapResult)).toContain('Invalid or unsafe function expression.');

      // valid expression: x * 2
      await arrayPage.setValue(arrayPage.selectors.mapExpressionInput, 'x * 2');
      await arrayPage.click(arrayPage.selectors.mapBtn);
      const mapRes = await arrayPage.getText(arrayPage.selectors.mapResult);
      expect(mapRes).toContain('Mapped array: [2,4,6,8,10]');
    });

    test('Filter works for numeric conditions', async () => {
      await arrayPage.setValue(arrayPage.selectors.filterExpressionInput, 'x > 3');
      await arrayPage.click(arrayPage.selectors.filterBtn);
      const filterRes = await arrayPage.getText(arrayPage.selectors.filterResult);
      expect(filterRes).toContain('Filtered array: [4,5]');
    });

    test('Reduce handles invalid/missing initial value and returns correct result', async () => {
      // missing expression
      await arrayPage.setValue(arrayPage.selectors.reduceExpressionInput, '');
      await arrayPage.click(arrayPage.selectors.reduceBtn);
      expect(await arrayPage.getText(arrayPage.selectors.reduceResult)).toContain('Please enter a reduce function expression.');

      // valid expression but missing initial
      await arrayPage.setValue(arrayPage.selectors.reduceExpressionInput, 'acc + x');
      await arrayPage.setValue(arrayPage.selectors.reduceInitialInput, '');
      await arrayPage.click(arrayPage.selectors.reduceBtn);
      expect(await arrayPage.getText(arrayPage.selectors.reduceResult)).toContain('Please enter an initial value for reduce.');

      // invalid initial JSON
      await arrayPage.setValue(arrayPage.selectors.reduceInitialInput, 'not json');
      await arrayPage.click(arrayPage.selectors.reduceBtn);
      expect(await arrayPage.getText(arrayPage.selectors.reduceResult)).toContain('Initial value must be valid JSON.');

      // valid reduce: sum with initial 0
      await arrayPage.setValue(arrayPage.selectors.reduceInitialInput, '0');
      await arrayPage.click(arrayPage.selectors.reduceBtn);
      expect(await arrayPage.getText(arrayPage.selectors.reduceResult)).toContain('Reduce result: 15'); // 1+2+3+4+5 = 15
    });

    test('Find and FindIndex return expected values', async () => {
      await arrayPage.setValue(arrayPage.selectors.findExpressionInput, 'x > 3');
      await arrayPage.click(arrayPage.selectors.findBtn);
      expect(await arrayPage.getText(arrayPage.selectors.findResult)).toContain('Find result: 4');

      await arrayPage.setValue(arrayPage.selectors.findIndexExpressionInput, 'x === 3');
      await arrayPage.click(arrayPage.selectors.findIndexBtn);
      expect(await arrayPage.getText(arrayPage.selectors.findIndexResult)).toContain('FindIndex result: 2');
    });
  });

  // Copy JSON to clipboard (transition back to S0_Idle) - verify alert shown and JSON content selected
  test.describe('Copy JSON and Info view', () => {
    test.beforeEach(async () => {
      // prepare simple array [7,8]
      await arrayPage.setValue(arrayPage.selectors.arraySizeInput, '2');
      await arrayPage.click(arrayPage.selectors.createRandomArrayBtn);
      // ensure there is some JSON content present
      const json = await arrayPage.getJson();
      expect(JSON.parse(json).length).toBe(2);
    });

    test('Copy JSON triggers select and copy command (dialog alert) and page remains stable', async () => {
      // Click copy; implementation shows alert after document.execCommand('copy')
      await arrayPage.click(arrayPage.selectors.copyJsonBtn);
      // dialog recorded and auto-accepted
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length-1].message).toContain('Array JSON copied to clipboard');
      // JSON view remains present and correctly formatted
      const json = await arrayPage.getJson();
      expect(() => JSON.parse(json)).not.toThrow();
    });
  });
});