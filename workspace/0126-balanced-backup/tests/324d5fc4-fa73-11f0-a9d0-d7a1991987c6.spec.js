import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324d5fc4-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Bucket Sort Visualization page
class BucketSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('#array-container');
    this.bars = page.locator('#array-container .bar');
    this.sortButton = page.locator("button[onclick='startBucketSort()']");
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Returns the array variable from the page (the original array defined in the script)
  async getPageArray() {
    return await this.page.evaluate(() => {
      // Access the global `array` variable defined by the page script
      return typeof array !== 'undefined' ? array : null;
    });
  }

  // Returns the array produced by the bucketSort function on the page (if available)
  async getSortedArrayFromPage() {
    return await this.page.evaluate(() => {
      if (typeof bucketSort === 'function' && typeof array !== 'undefined') {
        return bucketSort(array);
      }
      return null;
    });
  }

  // Click the Sort Array button
  async clickSort() {
    await this.sortButton.click();
  }

  // Get heights (in pixels as numbers) of the rendered bars in order
  async getBarHeights() {
    const count = await this.bars.count();
    const heights = [];
    for (let i = 0; i < count; i++) {
      const handle = this.bars.nth(i);
      // Use getComputedStyle inside the page to reliably obtain the rendered height (px)
      const heightPx = await handle.evaluate((el) => {
        const s = window.getComputedStyle(el);
        return s.height;
      });
      // Parse "234px" -> 234
      heights.push(parseFloat(heightPx));
    }
    return heights;
  }

  // Get number of rendered bars
  async getBarCount() {
    return await this.bars.count();
  }
}

test.describe('Bucket Sort Visualization - FSM tests (S0_Idle -> S1_Sorted)', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // No-op here; listeners attached per-test below in each test to ensure fresh arrays
  });

  // Test initial render corresponds to S0_Idle entry action: renderArray(array)
  test('Initial state (S0_Idle) renders the initial array with correct number of bars and heights', async ({ page }) => {
    // Capture console messages and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    const app = new BucketSortPage(page);
    await app.goto();

    // Verify there are no runtime page errors immediately after load
    expect(pageErrors.length).toBe(0);
    // Also expect no console.error messages (there may be logs/info but no errors)
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);

    // The page defines an `array` global - ensure it's present and has 10 items per the implementation
    const pageArray = await app.getPageArray();
    expect(Array.isArray(pageArray)).toBe(true);
    expect(pageArray.length).toBe(10);

    // The container should have rendered one bar per array entry
    const barCount = await app.getBarCount();
    expect(barCount).toBe(pageArray.length);

    // The inline style height should be value * 300 as per implementation - validate a few exact heights
    const heights = await app.getBarHeights();
    // Compute expected heights from the pageArray
    const expectedHeights = pageArray.map(v => v * 300);

    // Allow small floating point rounding tolerances when comparing
    for (let i = 0; i < expectedHeights.length; i++) {
      // heights are in pixels; expectedHeights can be decimals, but style was set to `${value * 300}px`
      expect(Math.abs(heights[i] - expectedHeights[i])).toBeLessThan(0.5);
    }
  });

  // Test clicking the Sort Array button triggers the transition to S1_Sorted and renders a sorted array
  test('SortArray event transitions to S1_Sorted: clicking Sort Array renders the sorted array', async ({ page }) => {
    // Collect console messages and page errors so we can assert none occurred during the action
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    const app = new BucketSortPage(page);
    await app.goto();

    // Capture initial state
    const initialBars = await app.getBarCount();
    expect(initialBars).toBeGreaterThan(0);

    // Retrieve the original array and the page's own bucketSort result for expected sorted order
    const originalArray = await app.getPageArray();
    const expectedSortedArray = await app.getSortedArrayFromPage();
    expect(Array.isArray(expectedSortedArray)).toBe(true);
    // Ensure the sorted array length matches the original
    expect(expectedSortedArray.length).toBe(originalArray.length);

    // Click the sort button to trigger startBucketSort (transition)
    await app.clickSort();

    // After clicking, ensure DOM updated: same number of bars but heights should be in ascending order
    const postBarCount = await app.getBarCount();
    expect(postBarCount).toBe(originalArray.length);

    // Get heights after sorting and compare to expectedSortedArray heights
    const postHeights = await app.getBarHeights();
    const expectedHeightsAfterSort = expectedSortedArray.map(v => v * 300);

    for (let i = 0; i < expectedHeightsAfterSort.length; i++) {
      expect(Math.abs(postHeights[i] - expectedHeightsAfterSort[i])).toBeLessThan(0.5);
    }

    // Additionally assert that postHeights are non-decreasing (sorted)
    for (let i = 1; i < postHeights.length; i++) {
      expect(postHeights[i] + 0.0001).toBeGreaterThanOrEqual(postHeights[i - 1]);
    }

    // Verify no page errors or console.error during the sort transition
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  // Edge case: clicking Sort Array multiple times should be idempotent / not throw and remain sorted
  test('Clicking Sort Array multiple times remains stable and does not produce errors', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', error => pageErrors.push(error));

    const app = new BucketSortPage(page);
    await app.goto();

    // Click multiple times
    await app.clickSort();
    await app.clickSort();
    await app.clickSort();

    // Bars still same count and remain in sorted order
    const barCount = await app.getBarCount();
    expect(barCount).toBe(10);

    const heights = await app.getBarHeights();
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i] + 0.0001).toBeGreaterThanOrEqual(heights[i - 1]);
    }

    // No page errors and no console.error messages
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  // Test to assert the FSM expected actions were observable:
  // - S0 entry: initial renderArray(array) -> verified by initial DOM state
  // - Transition actions: renderArray(array) then renderArray(sortedArray) -> verified by DOM before/after click
  test('FSM observables: initial render and sorted render are both observable in the DOM', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', error => pageErrors.push(error));

    const app = new BucketSortPage(page);
    await app.goto();

    // Initial snapshot of heights
    const initialHeights = await app.getBarHeights();
    expect(initialHeights.length).toBe(10);

    // Perform the transition
    await app.clickSort();

    // Snapshot after sort
    const sortedHeights = await app.getBarHeights();
    expect(sortedHeights.length).toBe(10);

    // Ensure that at least one bar changed height between initial and sorted (indicating re-render)
    const anyChanged = initialHeights.some((h, idx) => Math.abs(h - sortedHeights[idx]) > 0.5);
    expect(anyChanged).toBe(true);

    // No page errors
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length).toBe(0);
  });

  // Negative/robustness test: ensure bucketSort function exists and returns expected length/type
  test('bucketSort function exists on the page and returns an array of correct length', async ({ page }) => {
    const app = new BucketSortPage(page);
    await app.goto();

    const hasBucketSort = await page.evaluate(() => typeof bucketSort === 'function');
    expect(hasBucketSort).toBe(true);

    const originalArray = await app.getPageArray();
    const result = await app.getSortedArrayFromPage();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(originalArray.length);

    // Ensure result is sorted in non-decreasing order
    for (let i = 1; i < result.length; i++) {
      expect(result[i] + 1e-12).toBeGreaterThanOrEqual(result[i - 1]);
    }
  });
});