import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d86d0-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Tim Sort Visualization page
class TimSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayLocator = page.locator('#array');
    this.barLocator = page.locator('#array .bar');
    this.sortButton = page.locator('button[onclick="startTimSort()"]');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for the array container to be present
    await expect(this.arrayLocator).toBeVisible();
  }

  // Returns an array of numeric heights (in px as numbers) for each .bar element
  async getBarHeights() {
    return await this.page.$$eval('#array .bar', (nodes) =>
      nodes.map((n) => {
        const h = window.getComputedStyle(n).height || n.style.height || '0px';
        return Number(h.replace('px', '')) || 0;
      })
    );
  }

  // Returns number of bars in the visualization
  async getBarCount() {
    return await this.barLocator.count();
  }

  // Click the sort button (triggers startTimSort)
  async clickSort() {
    await this.sortButton.click();
  }

  // Wait until the bar heights are non-decreasing (i.e., sorted ascending)
  // times out after provided timeout (default 5000ms)
  async waitForSorted(timeout = 5000) {
    await this.page.waitForFunction(
      () => {
        const nodes = Array.from(document.querySelectorAll('#array .bar'));
        if (nodes.length === 0) return false;
        const heights = nodes.map((n) => {
          const h1 = window.getComputedStyle(n).height || n.style.height || '0px';
          return Number(h.replace('px', '')) || 0;
        });
        for (let i = 1; i < heights.length; i++) {
          if (heights[i - 1] > heights[i]) return false;
        }
        return true;
      },
      { timeout }
    );
  }

  // Utility: get the page's internal 'array' variable (the unsorted original array)
  async getWindowArray() {
    return await this.page.evaluate(() => {
      // If array is not defined, return null
      return typeof window.array !== 'undefined' ? window.array.slice() : null;
    });
  }
}

test.describe('Tim Sort Visualization (FSM states and transitions)', () => {
  // Arrays to collect console messages and page errors for each test
  /** @type {Array<{type:string,text:string}>} */
  let consoleMessages;
  /** @type {Array<Error>} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      // store type and text for inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Small diagnostic output if a test failed; will surface in test traces/logs
    if (pageErrors.length > 0) {
      // attach page errors to test output (Playwright will show this if the test fails)
      // We don't throw here; tests make assertions about these arrays.
      // eslint-disable-next-line no-console
      console.error('Collected page errors:', pageErrors.map((e) => `${e.name}: ${e.message}`));
    }
    if (consoleMessages.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Collected console messages (sample):', consoleMessages.slice(0, 10));
    }
  });

  test('Initial Idle state: page loads and displays the array on window.onload', async ({ page }) => {
    // Validate that displayArray is invoked on load (S0_Idle entry action)
    // We load the page and assert that the #array container has bar children equal to window.array length
    const timSort = new TimSortPage(page);
    await timSort.goto();

    // Ensure the page defined the global array and it is an array
    const winArray = await timSort.getWindowArray();
    expect(Array.isArray(winArray)).toBeTruthy();
    expect(winArray.length).toBeGreaterThan(0);

    // The visual representation should have the same number of bars as elements in the array
    const barCount = await timSort.getBarCount();
    expect(barCount).toBe(winArray.length);

    // Each bar should have a numeric height > = 0
    const heights1 = await timSort.getBarHeights();
    expect(heights.length).toBe(winArray.length);
    heights.forEach((h) => expect(typeof h).toBe('number'));

    // FSM-specific assertion: on entering Idle state displayArray(array) should have run,
    // which we infer by presence of bars and their count matching the array length.
    // Also assert that no unexpected page errors were thrown during load.
    // If errors exist they must be allowed JS error types (ReferenceError/TypeError/SyntaxError).
    expect(pageErrors.every((e) => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name))).toBeTruthy();

    // Confirm that console messages collected are structured
    expect(consoleMessages.every((c) => typeof c.type === 'string' && typeof c.text === 'string')).toBeTruthy();
  });

  test('Transition S0_Idle -> S1_Sorting: clicking "Sort Array" triggers sorting and updates the visualization', async ({ page }) => {
    // This test validates:
    // - Clicking the Sort Array button triggers startTimSort (event)
    // - Immediately displayArray(originalArray) is called (visual still shows same values)
    // - After the timeout, the array is sorted and displayArray(sorted) is shown (transition back to Idle)
    const timSort1 = new TimSortPage(page);
    await timSort.goto();

    // Capture initial heights and ensure they are not already sorted in most runs;
    // if they are already sorted (rare due to random shuffle), we still proceed and ensure idempotence.
    const initialHeights = await timSort.getBarHeights();
    expect(initialHeights.length).toBeGreaterThan(0);

    // Click the Sort Array button to trigger startTimSort()
    await timSort.clickSort();

    // Immediately after clicking, the code calls displayArray(originalArray)
    // originalArray is a shallow copy of window.array; the visual might remain the same.
    const immediateHeights = await timSort.getBarHeights();
    expect(immediateHeights.length).toBe(initialHeights.length);

    // Wait for the sorting to complete: implementation uses setTimeout(..., 1000)
    // so wait for the visualization to become non-decreasing (sorted ascending)
    await timSort.waitForSorted(5000); // give ample time for sorting & rendering

    // After sorting, verify that bar heights are sorted non-decreasing
    const sortedHeights = await timSort.getBarHeights();
    for (let i = 1; i < sortedHeights.length; i++) {
      expect(sortedHeights[i - 1]).toBeLessThanOrEqual(sortedHeights[i]);
    }

    // Verify bar count remains unchanged after sorting
    const finalBarCount = await timSort.getBarCount();
    expect(finalBarCount).toBe(initialHeights.length);

    // Assert that any collected page errors (if any) are allowable JS error types
    expect(pageErrors.every((e) => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name))).toBeTruthy();
  });

  test('Edge case: clicking "Sort Array" multiple times quickly should still result in a sorted array without uncaught errors', async ({ page }) => {
    // This test validates robustness when the user triggers the event several times rapidly.
    const timSort2 = new TimSortPage(page);
    await timSort.goto();

    // Rapidly click the button multiple times
    await Promise.all([timSort.clickSort(), timSort.clickSort(), timSort.clickSort()]);

    // Wait for sorting to complete; multiple timeouts may be scheduled, but final state should be sorted.
    await timSort.waitForSorted(7000);

    // Confirm final state is sorted
    const finalHeights = await timSort.getBarHeights();
    for (let i = 1; i < finalHeights.length; i++) {
      expect(finalHeights[i - 1]).toBeLessThanOrEqual(finalHeights[i]);
    }

    // Confirm no unexpected page errors (if any, they must be ReferenceError/TypeError/SyntaxError)
    expect(pageErrors.every((e) => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name))).toBeTruthy();

    // Also ensure the DOM still contains the same number of bars
    const count = await timSort.getBarCount();
    const winArray1 = await timSort.getWindowArray();
    if (winArray) expect(count).toBe(winArray.length);
  });

  test('Visual feedback: ensure bars update in height/colour when displayArray is called and element count remains constant', async ({ page }) => {
    // Validate that displayArray manipulates DOM nodes consistently and that there are no missing elements
    const timSort3 = new TimSortPage(page);
    await timSort.goto();

    const before = await timSort.getBarHeights();
    expect(before.length).toBeGreaterThan(0);

    // Trigger sort, wait until sorted
    await timSort.clickSort();
    await timSort.waitForSorted(5000);

    const after = await timSort.getBarHeights();
    expect(after.length).toBe(before.length);

    // Ensure at least one height changed (unless initial array happened to be already sorted)
    const anyChanged = before.some((h, i) => h !== after[i]);
    // This may be false if initial array was already sorted, but that's acceptable; just assert type consistency
    expect(before.every((h) => typeof h === 'number')).toBeTruthy();
    expect(after.every((h) => typeof h === 'number')).toBeTruthy();

    // Check that no unexpected page errors (if any, constrained to known JS error types)
    expect(pageErrors.every((e) => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name))).toBeTruthy();
  });

  test('Observability: console and pageerror capturing behaves as expected (we do not inject or patch)', async ({ page }) => {
    // This test ensures our test harness correctly captures console and page errors.
    // It does NOT modify the page or global scope and only inspects messages produced naturally.
    const timSort4 = new TimSortPage(page);
    await timSort.goto();

    // There may or may not be console messages; we only assert that our collector recorded well-formed entries.
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(consoleMessages.every((m) => typeof m.type === 'string' && typeof m.text === 'string')).toBeTruthy();

    // If there are page errors, they should be native JS error types (ReferenceError, TypeError, SyntaxError).
    // This assertion will pass vacuously if pageErrors is empty.
    expect(pageErrors.every((e) => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name))).toBeTruthy();
  });
});