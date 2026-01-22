import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b394f80-d360-11f0-b42e-71f0e7238799.html';

// Page Object for the Array Demonstration app
class ArrayPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.addButton = page.locator('#addButton');
    this.sortButton = page.locator('#sortButton');
    this.clearButton = page.locator('#clearButton');
    this.arrayDisplay = page.locator('#arrayDisplay');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickAdd() {
    await this.addButton.click();
  }

  async clickSort() {
    await this.sortButton.click();
  }

  async clickClear() {
    await this.clearButton.click();
  }

  // Returns the parsed array shown in the UI (as a real JS array)
  async getDisplayedArray() {
    const text = await this.arrayDisplay.textContent();
    // text is like 'Array: []' or 'Array: [1,2,3]'
    const prefix = 'Array: ';
    if (!text || !text.startsWith(prefix)) return null;
    const json = text.slice(prefix.length);
    try {
      return await this.page.evaluate((s) => JSON.parse(s), json);
    } catch {
      // If JSON.parse fails, return the raw string for further assertions
      return json;
    }
  }

  // Helper to read the runtime numbersArray variable from the page
  async readRuntimeNumbersArray() {
    return this.page.evaluate(() => {
      // Return a shallow copy if exists, otherwise undefined
      try {
        return typeof numbersArray !== 'undefined' ? numbersArray.slice() : undefined;
      } catch (e) {
        return { __error__: e && e.message ? e.message : String(e) };
      }
    });
  }

  // Helper to check if updateArrayDisplay function exists in the page
  async hasUpdateArrayDisplay() {
    return this.page.evaluate(() => typeof updateArrayDisplay === 'function');
  }
}

test.describe('Array Demonstration FSM - end-to-end', () => {
  // Collect console messages and uncaught page errors for each test
  test.beforeEach(async ({ page }) => {
    // Attach listeners to capture console messages and page errors
    page['_capturedConsole'] = [];
    page['_capturedPageErrors'] = [];

    page.on('console', (msg) => {
      page['_capturedConsole'].push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', (err) => {
      page['_capturedPageErrors'].push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // When a test finishes, log captured console messages and errors to the test output
    // This helps debugging if something goes wrong.
    if (page && page['_capturedConsole']) {
      for (const c of page['_capturedConsole']) {
        // no-op logging; test runners will surface expects if needed
      }
    }
    if (page && page['_capturedPageErrors']) {
      for (const e of page['_capturedPageErrors']) {
        // no-op logging; test runners will surface expects if needed
      }
    }
  });

  test('Initial state S0_Empty: page loads and shows an empty array', async ({ page }) => {
    // Validate the application's initial state S0: Array: []
    const app = new ArrayPage(page);

    // Navigate to the page
    await app.goto();

    // Verify the updateArrayDisplay function exists (entry action expectation)
    const hasUpdateFn = await app.hasUpdateArrayDisplay();
    expect(hasUpdateFn).toBe(true);

    // Verify displayed array equals empty
    const displayed = await app.getDisplayedArray();
    expect(displayed).toEqual([]); // S0 state evidence: Array: []

    // Verify runtime numbersArray exists and matches UI
    const runtimeArray = await app.readRuntimeNumbersArray();
    expect(Array.isArray(runtimeArray)).toBe(true);
    expect(runtimeArray).toEqual([]);

    // Buttons should be visible and enabled
    await expect(app.addButton).toBeVisible();
    await expect(app.sortButton).toBeVisible();
    await expect(app.clearButton).toBeVisible();
    await expect(app.addButton).toBeEnabled();
    await expect(app.sortButton).toBeEnabled();
    await expect(app.clearButton).toBeEnabled();

    // Assert there were no uncaught page errors during load (expect no ReferenceError/SyntaxError/TypeError)
    const pageErrors = page['_capturedPageErrors'] || [];
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: AddRandomNumber (S0 -> S1) adds a single random number and updates display', async ({ page }) => {
    // This test validates the "Add Random Number" event and the S1_NumbersAdded state
    const app = new ArrayPage(page);
    await app.goto();

    // Click add once
    await app.clickAdd();

    // After clicking, the UI should update to show one number in the array
    const displayed = await app.getDisplayedArray();
    expect(Array.isArray(displayed)).toBe(true);
    expect(displayed.length).toBe(1);
    const num = displayed[0];
    expect(typeof num).toBe('number');
    expect(Number.isInteger(num)).toBe(true);
    // Random number should be within [0,99] per implementation
    expect(num).toBeGreaterThanOrEqual(0);
    expect(num).toBeLessThanOrEqual(99);

    // Runtime numbersArray should reflect the same content
    const runtimeArray = await app.readRuntimeNumbersArray();
    expect(runtimeArray.length).toBe(1);
    expect(runtimeArray[0]).toBe(displayed[0]);

    // No uncaught page errors
    const pageErrors = page['_capturedPageErrors'] || [];
    expect(pageErrors.length).toBe(0);
  });

  test('Multiple Adds lead to correct S1 state: adding multiple numbers updates array length and contents', async ({ page }) => {
    // Validate repeated AddRandomNumber events accumulate numbers
    const app = new ArrayPage(page);
    await app.goto();

    // Add 3 numbers
    await app.clickAdd();
    await app.clickAdd();
    await app.clickAdd();

    const displayed = await app.getDisplayedArray();
    expect(Array.isArray(displayed)).toBe(true);
    expect(displayed.length).toBe(3);

    // All elements should be integers in [0,99]
    for (const n of displayed) {
      expect(typeof n).toBe('number');
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(99);
    }

    // Runtime and UI should match
    const runtimeArray = await app.readRuntimeNumbersArray();
    expect(runtimeArray).toEqual(displayed);

    // No uncaught page errors
    const pageErrors = page['_capturedPageErrors'] || [];
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: SortArray (S1 -> S2) sorts numbers in ascending order', async ({ page }) => {
    // Validate the "Sort Array" event from a state with numbers added
    const app = new ArrayPage(page);
    await app.goto();

    // Add 5 numbers
    for (let i = 0; i < 5; i++) {
      await app.clickAdd();
    }

    const beforeSort = await app.getDisplayedArray();
    expect(beforeSort.length).toBe(5);

    // Trigger sort
    await app.clickSort();

    const afterSort = await app.getDisplayedArray();
    // Should still be length 5
    expect(afterSort.length).toBe(5);

    // Should be sorted ascending
    for (let i = 1; i < afterSort.length; i++) {
      expect(afterSort[i]).toBeGreaterThanOrEqual(afterSort[i - 1]);
    }

    // Sorting should not change the multiset of values
    const sortedCopy = [...beforeSort].sort((a, b) => a - b);
    expect(afterSort).toEqual(sortedCopy);

    // No uncaught page errors
    const pageErrors = page['_capturedPageErrors'] || [];
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: ClearArray from S1 returns to S0 (clearing when numbers present)', async ({ page }) => {
    // Validate ClearArray event when numbers exist (S1 -> S0)
    const app = new ArrayPage(page);
    await app.goto();

    // Add some numbers
    await app.clickAdd();
    await app.clickAdd();

    // Ensure there are numbers
    const beforeClear = await app.getDisplayedArray();
    expect(beforeClear.length).toBeGreaterThan(0);

    // Clear
    await app.clickClear();

    // UI should show empty array again
    const afterClear = await app.getDisplayedArray();
    expect(afterClear).toEqual([]);

    // Runtime numbersArray should be empty as well
    const runtimeArray = await app.readRuntimeNumbersArray();
    expect(runtimeArray).toEqual([]);

    // No uncaught page errors
    const pageErrors = page['_capturedPageErrors'] || [];
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: ClearArray from S2 returns to S0 (clearing after sorting)', async ({ page }) => {
    // Validate ClearArray event when array is sorted (S2 -> S0)
    const app = new ArrayPage(page);
    await app.goto();

    // Add and sort
    await app.clickAdd();
    await app.clickAdd();
    await app.clickSort();

    // Ensure array is non-empty and sorted
    const sorted = await app.getDisplayedArray();
    expect(sorted.length).toBeGreaterThan(0);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]).toBeGreaterThanOrEqual(sorted[i - 1]);
    }

    // Clear
    await app.clickClear();

    // Expect empty UI and runtime
    const afterClear = await app.getDisplayedArray();
    expect(afterClear).toEqual([]);
    const runtimeArray = await app.readRuntimeNumbersArray();
    expect(runtimeArray).toEqual([]);

    // No uncaught page errors
    const pageErrors = page['_capturedPageErrors'] || [];
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Sort and Clear on an empty array should be no-ops and not throw errors', async ({ page }) => {
    // Validate SortArray and ClearArray behavior when starting from S0
    const app = new ArrayPage(page);
    await app.goto();

    // Starting state should be empty
    const initial = await app.getDisplayedArray();
    expect(initial).toEqual([]);

    // Click sort on empty array
    await app.clickSort();
    const afterSort = await app.getDisplayedArray();
    expect(afterSort).toEqual([]); // should remain empty

    // Click clear on empty array
    await app.clickClear();
    const afterClear = await app.getDisplayedArray();
    expect(afterClear).toEqual([]); // should remain empty

    // Ensure no uncaught page errors like ReferenceError/SyntaxError/TypeError occurred
    const pageErrors = page['_capturedPageErrors'] || [];
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity: confirm UI update method was used as entry action for each state (function presence)', async ({ page }) => {
    // Validate that updateArrayDisplay() exists and can be observed via the DOM updates (entry actions)
    const app = new ArrayPage(page);
    await app.goto();

    // updateArrayDisplay should exist (entry action used on state entries)
    const hasUpdateFn = await app.hasUpdateArrayDisplay();
    expect(hasUpdateFn).toBe(true);

    // Trigger transitions and ensure DOM reflects expected updateArrayDisplay calls indirectly
    await app.clickAdd();
    expect(await app.getDisplayedArray()).toHaveLength(1);

    await app.clickSort();
    expect(Array.isArray(await app.getDisplayedArray())).toBe(true);

    await app.clickClear();
    expect(await app.getDisplayedArray()).toEqual([]);

    // No uncaught page errors during these operations
    const pageErrors = page['_capturedPageErrors'] || [];
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: capture console logs and ensure no runtime errors were emitted', async ({ page }) => {
    // This test simply loads the app and asserts there were no console.error or uncaught page errors.
    const app = new ArrayPage(page);
    await app.goto();

    // After load, inspect captured console messages
    const consoles = page['_capturedConsole'] || [];
    // Ensure there are no console messages with type 'error'
    const consoleErrors = consoles.filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Ensure no uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    const pageErrors = page['_capturedPageErrors'] || [];
    // If any pageError occurred, fail the test by asserting zero length
    expect(pageErrors.length).toBe(0);
  });
});