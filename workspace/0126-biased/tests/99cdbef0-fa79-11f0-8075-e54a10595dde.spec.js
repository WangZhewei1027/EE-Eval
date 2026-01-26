import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cdbef0-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Dynamic Array page
class DynamicArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      elementInput: '#elementInput',
      addButton: '#addButton',
      removeIndex: '#removeIndex',
      removeButton: '#removeButton',
      resetButton: '#resetButton',
      bulkInput: '#bulkInput',
      bulkAddButton: '#bulkAddButton',
      arrayDisplay: '#arrayDisplay',
      heading: 'h1'
    };
  }

  async goto() {
    await this.page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  }

  async getHeadingText() {
    return this.page.textContent(this.selectors.heading);
  }

  async getDisplayText() {
    return this.page.textContent(this.selectors.arrayDisplay);
  }

  async addElement(value) {
    // value may be number or string; fill the input and click Add
    await this.page.fill(this.selectors.elementInput, String(value));
    await this.page.click(this.selectors.addButton);
  }

  async removeAt(index) {
    await this.page.fill(this.selectors.removeIndex, String(index));
    await this.page.click(this.selectors.removeButton);
  }

  async resetArray() {
    await this.page.click(this.selectors.resetButton);
  }

  async bulkAdd(valuesCsv) {
    await this.page.fill(this.selectors.bulkInput, String(valuesCsv));
    await this.page.click(this.selectors.bulkAddButton);
  }

  async getElementInputValue() {
    return this.page.$eval(this.selectors.elementInput, el => el.value);
  }

  async getRemoveIndexValue() {
    return this.page.$eval(this.selectors.removeIndex, el => el.value);
  }

  async getBulkInputValue() {
    return this.page.$eval(this.selectors.bulkInput, el => el.value);
  }
}

test.describe('Dynamic Array Example - FSM and UI validation (Application ID: 99cdbef0-fa79-11f0-8075-e54a10595dde)', () => {
  // We'll capture console errors and page errors for each test to assert no unexpected runtime issues.
  test.beforeEach(async ({ page }) => {
    // No-op before each; individual tests will navigate and attach listeners as needed.
  });

  test('S0 Idle: Initial render and sanity checks (no runtime errors, presence of static content)', async ({ page }) => {
    // Capture console errors and page errors
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    const dp = new DynamicArrayPage(page);
    await dp.goto();

    // Validate heading and initial array display match the FSM evidence for S0_Idle
    const heading = await dp.getHeadingText();
    expect(heading).toBe('Dynamic Array Manipulation');

    const display = await dp.getDisplayText();
    expect(display).toBe('Array is empty');

    // Verify that renderPage (mentioned in FSM entry actions) is NOT present on window,
    // since the implementation does not define renderPage. We assert that mismatch explicitly.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Verify updateDisplay exists as a function (used in entry_actions for other states)
    const updateDisplayType = await page.evaluate(() => typeof window.updateDisplay);
    // The script defines updateDisplay as a const; therefore it should be 'function'
    expect(updateDisplayType).toBe('function');

    // The implementation uses 'let dynamicArray = []' (module-level let). That usually does not attach to window.
    // We assert this to verify the environment shape matches the implementation (dynamicArray should not be on window)
    const dynamicArrayOnWindow = await page.evaluate(() => typeof window.dynamicArray);
    expect(dynamicArrayOnWindow).toBe('undefined');

    // Ensure there were no console errors or page errors during load
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('S0 -> S1 (AddElement): Add a single element and verify display and input clearing', async ({ page }) => {
    // Track console errors and page errors
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    const dp = new DynamicArrayPage(page);
    await dp.goto();

    // Initially empty
    expect(await dp.getDisplayText()).toBe('Array is empty');

    // Add element 42 -> should transition to Element Added (S1)
    await dp.addElement(42);

    // After adding, display should show an array with 42
    const displayAfterAdd = await dp.getDisplayText();
    expect(displayAfterAdd).toBe(JSON.stringify([42]));

    // The element input should be cleared after adding
    expect(await dp.getElementInputValue()).toBe('');

    // No runtime console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('S1 -> S2 (RemoveElement): Remove an element and ensure array length decreases and display updates', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    const dp = new DynamicArrayPage(page);
    await dp.goto();

    // Prepare: add two elements to create a state where removal is meaningful
    await dp.addElement(10);
    await dp.addElement(20);
    expect(await dp.getDisplayText()).toBe(JSON.stringify([10, 20]));

    // Remove element at index 0 -> expect [20]
    await dp.removeAt(0);

    const displayAfterRemove = await dp.getDisplayText();
    expect(displayAfterRemove).toBe(JSON.stringify([20]));

    // Remove index input should be cleared
    expect(await dp.getRemoveIndexValue()).toBe('');

    // Attempt to remove with an invalid index (out of bounds) - should not throw and should leave array unchanged
    await dp.removeAt(5); // invalid index
    expect(await dp.getDisplayText()).toBe(JSON.stringify([20]));

    // Attempt to remove with negative index - should not throw and leave unchanged
    await dp.removeAt(-1);
    expect(await dp.getDisplayText()).toBe(JSON.stringify([20]));

    // No runtime console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('S1 -> S3 (ResetArray): Reset the array to empty and verify display and state', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    const dp = new DynamicArrayPage(page);
    await dp.goto();

    // Add elements first
    await dp.addElement(1);
    await dp.addElement(2);
    expect(await dp.getDisplayText()).toBe(JSON.stringify([1, 2]));

    // Click reset -> expected to transition to Array Reset (S3)
    await dp.resetArray();

    // Display should show 'Array is empty'
    expect(await dp.getDisplayText()).toBe('Array is empty');

    // No runtime console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('S0 -> S4 and S4 -> S1 (BulkAddElements): Bulk add elements and then bulk add again to append', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    const dp = new DynamicArrayPage(page);
    await dp.goto();

    // From idle, bulk add three elements -> S4_BulkElementsAdded
    await dp.bulkAdd('1,2,3');
    expect(await dp.getDisplayText()).toBe(JSON.stringify([1, 2, 3]));

    // From S4, bulk add again (e.g., "4,5") -> FSM suggests transition back to Element Added (S1)
    await dp.bulkAdd('4,5');
    // Final array should contain all five elements in order
    expect(await dp.getDisplayText()).toBe(JSON.stringify([1, 2, 3, 4, 5]));

    // Bulk input should be cleared after operation
    expect(await dp.getBulkInputValue()).toBe('');

    // No runtime console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Edge cases and error scenarios: adding invalid input, bulk with invalid entries, and ensure no exceptions', async ({ page }) => {
    // This test validates how the app handles bad/edge inputs and verifies there are no runtime exceptions.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    const dp = new DynamicArrayPage(page);
    await dp.goto();

    // Ensure starting empty
    expect(await dp.getDisplayText()).toBe('Array is empty');

    // Attempt to add a non-number: elementInput is type=number, but use invalid fill that results in empty -> should not change array
    await dp.addElement(''); // empty input
    expect(await dp.getDisplayText()).toBe('Array is empty');

    // Attempt to add NaN via string that's not a number (some browsers coerce, but script uses Number() and checks isNaN)
    await dp.page.fill(dp.selectors.elementInput, 'abc'); // type number may still set value as 'abc' in some environments
    await dp.page.click(dp.selectors.addButton);
    // Should remain empty - invalid value ignored
    expect(await dp.getDisplayText()).toBe('Array is empty');

    // Bulk add with mixture of invalid and valid entries: 'a,6,,7' -> only 6 and 7 should be added
    await dp.bulkAdd('a,6,,7');
    expect(await dp.getDisplayText()).toBe(JSON.stringify([6, 7]));

    // Try removing with an index that is a non-integer (decimal) - Number('0.5') yields 0.5, check behavior: script checks >=0 and < length, and uses splice(index,1)
    // splice will floor or coerce? splice uses ToInteger; fractional indexes will be converted; but important: no exceptions should be thrown.
    await dp.removeAt('0.5'); // should remove at index 0 after coercion if treated as 0
    // After removal we expect one element removed (likely 7 remains or 6 removed depending on coercion); we just assert no page errors and that display is consistent string or 'Array is empty'
    const dispPost = await dp.getDisplayText();
    // Validate display contains either array or 'Array is empty' and is valid JSON if array
    if (dispPost === 'Array is empty') {
      // acceptable
      expect(dispPost).toBe('Array is empty');
    } else {
      // It should be a JSON array
      expect(() => JSON.parse(dispPost)).not.toThrow();
      const arr = JSON.parse(dispPost);
      expect(Array.isArray(arr)).toBe(true);
      // length should be between 0 and 2
      expect(arr.length).toBeGreaterThanOrEqual(0);
      expect(arr.length).toBeLessThanOrEqual(2);
    }

    // Ensure there were no console errors or page errors thrown during these edge interactions
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Verify expected functions and side-effects referenced in FSM: updateDisplay effects', async ({ page }) => {
    // This test inspects behavior of updateDisplay indirectly by manipulating the DOM via the UI and asserting the display matches expected outputs.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    const dp = new DynamicArrayPage(page);
    await dp.goto();

    // Ensure updateDisplay exists and is callable via page.evaluate; call it after pushing ephemeral values via UI
    const updateDisplayExists = await page.evaluate(() => typeof window.updateDisplay === 'function');
    expect(updateDisplayExists).toBe(true);

    // Add element then call updateDisplay manually to ensure it doesn't throw (exists and is effective)
    await dp.addElement(99);
    // For explicitness, call updateDisplay via evaluate (should not throw)
    await page.evaluate(() => {
      // calling the function that was defined in the page script
      updateDisplay();
    });
    expect(await dp.getDisplayText()).toBe(JSON.stringify([99]));

    // Reset and ensure display updates
    await dp.resetArray();
    expect(await dp.getDisplayText()).toBe('Array is empty');

    // No runtime console errors or page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Clean up note: Playwright's fixtures handle browser/page teardown automatically.
});