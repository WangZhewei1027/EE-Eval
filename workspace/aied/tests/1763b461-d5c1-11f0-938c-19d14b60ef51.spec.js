import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/1763b461-d5c1-11f0-938c-19d14b60ef51.html';

/**
 * Page Object for the Counting Sort Visualization page.
 * Encapsulates common interactions and queries used in tests.
 */
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputArray');
    this.sortButton = page.locator('#sortButton');
    this.arrayContainer = page.locator('#array-container');
    this.sortedContainer = page.locator('#sorted-array-container');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async enterArray(value) {
    await this.input.fill(value);
  }

  async clickSort() {
    await this.sortButton.click();
  }

  async originalBarsCount() {
    return await this.arrayContainer.locator('.bar').count();
  }

  async sortedBarsCount() {
    return await this.sortedContainer.locator('.bar').count();
  }

  // Returns array of titles (string) for bars in a given container locator
  async getBarValues(containerLocator) {
    const bars = containerLocator.locator('.bar');
    const count = await bars.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      values.push(await bars.nth(i).getAttribute('title'));
    }
    return values;
  }

  async getBarHeights(containerLocator) {
    const bars = containerLocator.locator('.bar');
    const count = await bars.count();
    const heights = [];
    for (let i = 0; i < count; i++) {
      const h = await bars.nth(i).evaluate((el) => {
        return window.getComputedStyle(el).height;
      });
      heights.push(h);
    }
    return heights;
  }

  async originalBarValues() {
    return this.getBarValues(this.arrayContainer);
  }

  async sortedBarValues() {
    return this.getBarValues(this.sortedContainer);
  }
}

test.describe('Counting Sort Visualization - FSM and UI tests', () => {
  // Collect page errors and console messages for assertions
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Capture uncaught errors from the page
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Capture console messages for diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async () => {
    // Basic sanity: console messages collected are available for debugging if needed
    // (We won't fail tests based on console messages unless explicitly asserted)
  });

  test('Initial state S0_Idle: page loads with input, button, and empty containers', async ({ page }) => {
    // Validate initial UI elements and state (S0_Idle)
    const app = new CountingSortPage(page);
    await app.goto();

    // The input should be present with correct placeholder
    await expect(page.locator('#inputArray')).toBeVisible();
    await expect(page.locator('#inputArray')).toHaveAttribute('placeholder', 'Enter comma-separated numbers');

    // The sort button should be present and enabled
    await expect(page.locator('#sortButton')).toBeVisible();
    await expect(page.locator('#sortButton')).toBeEnabled();

    // The original and sorted containers should be empty initially
    await expect(page.locator('#array-container')).toBeEmpty();
    await expect(page.locator('#sorted-array-container')).toBeEmpty();

    // No uncaught page errors should have occurred on initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Transition and event: entering array and clicking Sort displays original and sorted arrays', async ({ page }) => {
    // This test validates the main flow described by the FSM:
    // - User inputs an array (S1_ArrayEntered)
    // - User clicks sort button (SortButtonClick)
    // - Original and sorted arrays are displayed (S2_Sorted)
    const app = new CountingSortPage(page);
    await app.goto();

    // Enter a valid numeric array and click sort
    await app.enterArray('3,1,2');
    await app.clickSort();

    // Original array should show 3 bars
    const originalCount = await app.originalBarsCount();
    expect(originalCount).toBe(3);

    // Sorted array should show 3 bars, each with 'sorted' class applied by CSS class name
    const sortedCount = await app.sortedBarsCount();
    expect(sortedCount).toBe(3);

    // Verify the titles (values) on the original bars correspond to [3,1,2]
    const originalValues = await app.originalBarValues();
    // Titles are strings, so compare stringified values
    expect(originalValues).toEqual(['3', '1', '2']);

    // Verify the sorted values are in ascending order [1,2,3]
    const sortedValues = await app.sortedBarValues();
    expect(sortedValues).toEqual(['1', '2', '3']);

    // Verify sorted bar elements include the CSS class 'sorted'
    const sortedBars = page.locator('#sorted-array-container .bar');
    for (let i = 0; i < sortedCount; i++) {
      await expect(sortedBars.nth(i)).toHaveClass(/sorted/);
    }

    // Verify that the visual heights correspond to value * 4 px (as implemented)
    const heights = await app.getBarHeights(page.locator('#sorted-array-container'));
    // Convert '12px' strings to numeric px values and compare to expected
    const expectedHeights = sortedValues.map(v => `${Number(v) * 4}px`);
    expect(heights).toEqual(expectedHeights);

    // No uncaught page errors should have occurred for valid input
    expect(pageErrors.length).toBe(0);
  });

  test('Sequential clicks update the visualization (simulate FSM transitions S0 -> S1 -> S2 again)', async ({ page }) => {
    // Validate that repeated interactions update displayed arrays correctly
    const app = new CountingSortPage(page);
    await app.goto();

    // First input and click
    await app.enterArray('4,2,5,1');
    await app.clickSort();

    let orig = await app.originalBarValues();
    let sorted = await app.sortedBarValues();
    expect(orig).toEqual(['4', '2', '5', '1']);
    // sorted ascending: [1,2,4,5]
    expect(sorted).toEqual(['1', '2', '4', '5']);

    // Modify input to a different array and click again - parts of FSM: re-enter array then sort
    await app.enterArray('6,3');
    await app.clickSort();

    orig = await app.originalBarValues();
    sorted = await app.sortedBarValues();
    expect(orig).toEqual(['6', '3']);
    expect(sorted).toEqual(['3', '6']);

    // Ensure there were no uncaught errors across both interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: empty input should be handled (no crash) and show a single bar for 0', async ({ page }) => {
    // Empty input "" yields [''] -> Number('') === 0, so we expect a single bar of value 0
    const app = new CountingSortPage(page);
    await app.goto();

    await app.enterArray('');
    await app.clickSort();

    // Expect one bar in each container
    expect(await app.originalBarsCount()).toBe(1);
    expect(await app.sortedBarsCount()).toBe(1);

    // Titles should be '0'
    expect(await app.originalBarValues()).toEqual(['0']);
    expect(await app.sortedBarValues()).toEqual(['0']);

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenario: non-numeric input produces a runtime error (expect pageerror)', async ({ page }) => {
    // This test purposely triggers a runtime error in the countingSort implementation
    // by providing non-numeric input such as "a,b". The implementation uses Math.max(...arr)
    // and new Array(max + 1) which will throw a RangeError when max is NaN.
    const app = new CountingSortPage(page);
    await app.goto();

    // Prepare to capture the pageerror that should be thrown when clicking Sort
    const waitForPageError = page.waitForEvent('pageerror');

    // Enter invalid non-numeric input and click Sort
    await app.enterArray('a,b');
    await app.clickSort();

    // Await the pageerror and assert its properties
    const error = await waitForPageError;
    // The runtime error should be a RangeError caused by invalid array length (new Array(NaN))
    // We assert that a page error occurred and its name is 'RangeError'
    expect(error).toBeTruthy();
    // Some browsers propagate name and message. Assert name if available.
    if (error.name) {
      expect(error.name).toBe('RangeError');
    } else {
      // Fallback: assert that the message mentions 'Invalid' or 'length' to indicate the array creation problem
      const msg = String(error.message || '');
      expect(msg.toLowerCase()).toContain('invalid');
    }

    // Also ensure that the original array container may or may not have been rendered before the error.
    // We do not assert exact DOM state since the error originates during sorting.
    // But we ensure at least one page error was captured in our pageErrors array
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Edge case: negative-only inputs may cause runtime errors (expect pageerror) - demonstrates algorithm limitations', async ({ page }) => {
    // Counting sort implementation assumes non-negative integers. An array with sufficiently negative
    // maximum can cause new Array(max + 1) to be created with negative length -> RangeError.
    const app = new CountingSortPage(page);
    await app.goto();

    // Use values that make max <= -2 so max + 1 < 0 -> invalid array length
    await app.enterArray('-5,-3');
    // Wait for pageerror triggered by clicking sort
    const waitForPageError = page.waitForEvent('pageerror');
    await app.clickSort();
    const error = await waitForPageError;

    expect(error).toBeTruthy();
    if (error.name) {
      expect(error.name).toBe('RangeError');
    } else {
      const msg = String(error.message || '');
      expect(msg.toLowerCase()).toMatch(/invalid|length|array/);
    }
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Console diagnostics: ensure no unexpected console errors for valid and typical usage', async ({ page }) => {
    // Validate that normal usage doesn't spam console.error with unexpected messages
    const app = new CountingSortPage(page);
    await app.goto();

    // Perform a standard sort
    await app.enterArray('2,4,1');
    await app.clickSort();

    // Give the page a short moment to emit logs if any
    await page.waitForTimeout(100);

    // Ensure no console messages of severity 'error' are present
    const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errors.length).toBe(0);

    // Validate normal console logs (if any) are not errors; just provide them for debugging if needed
  });
});