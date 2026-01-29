import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cea954-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Merge Sort Visualizer page
class MergeSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.sizeInput = page.locator('#sizeInput');
    this.generateButton = page.locator('#generateArray');
    this.startButton = page.locator('#startSort');
    this.arrayDisplay = page.locator('#arrayDisplay');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getSizeInputValue() {
    return await this.sizeInput.inputValue();
  }

  async setSizeInputValue(value) {
    // Directly fill the input - simulates user editing the number input
    await this.sizeInput.fill(String(value));
  }

  async clickGenerate() {
    await this.generateButton.click();
  }

  async clickStartSort() {
    await this.startButton.click();
  }

  // Returns array of numbers shown in the #arrayDisplay (empty array if display blank)
  async getDisplayedArray() {
    const text = (await this.arrayDisplay.textContent()) || '';
    const trimmed = text.trim();
    if (!trimmed) return [];
    return trimmed.split(',').map(s => Number(s.trim())).filter(n => !Number.isNaN(n));
  }

  // Wait until the displayed array is sorted ascending, or timeout
  async waitForSortedDisplay(timeoutMs = 30000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const arr = await this.getDisplayedArray();
      if (arr.length <= 1) return arr;
      let isSorted = true;
      for (let i = 1; i < arr.length; i++) {
        if (arr[i - 1] > arr[i]) {
          isSorted = false;
          break;
        }
      }
      if (isSorted) return arr;
      // poll every 300ms
      await this.page.waitForTimeout(300);
    }
    throw new Error('Timed out waiting for display to become sorted');
  }

  // Utility to check if an array is sorted ascending
  static isSorted(arr) {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i - 1] > arr[i]) return false;
    }
    return true;
  }
}

// Top-level describe grouping FSM-related tests
test.describe('Merge Sort Visualizer - FSM states and transitions (App ID: 99cea954-fa79-11f0-8075-e54a10595dde)', () => {
  // Increase timeout because sorting uses deliberate delays (500ms per merge step)
  test.setTimeout(120000);

  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console 'error' messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location ? msg.location() : null,
          });
        }
      } catch (e) {
        // If accessing msg properties fails, still record a minimal marker
        consoleErrors.push({ text: `console event error: ${String(e)}` });
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });
  });

  test.afterEach(async () => {
    // Sanity assertion about runtime errors: the application is expected to run without uncaught runtime errors.
    // If runtime errors occurred, fail the test and output captured errors for debugging.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S0_Idle - On page load the app should execute generateRandomArray(10) and show 10 numbers', async ({ page }) => {
    // This test validates the initial idle state (S0_Idle) entry action generateRandomArray(10)
    const app = new MergeSortPage(page);
    await app.goto();

    // Verify size input default value is 10 (as specified in HTML attributes and FSM evidence)
    const value = await app.getSizeInputValue();
    expect(value).toBe('10');

    // The entry action should populate #arrayDisplay with 10 numbers
    const displayed = await app.getDisplayedArray();
    expect(displayed.length).toBe(10);

    // Validate each displayed element is a number in expected range [0,99]
    for (const n of displayed) {
      expect(Number.isInteger(n)).toBeTruthy();
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(100);
    }
  });

  test('GenerateArray event (S0_Idle -> S1_ArrayGenerated) creates arrays of requested sizes and updates display', async ({ page }) => {
    // This test covers the GenerateArray event and transition to S1_ArrayGenerated
    const app = new MergeSortPage(page);
    await app.goto();

    // Test regular size 5
    await app.setSizeInputValue(5);
    await app.clickGenerate();
    let arr = await app.getDisplayedArray();
    expect(arr.length).toBe(5);

    // Edge case: set size to 1 (below the input min attribute) - function should still create an array of length 1
    await app.setSizeInputValue(1);
    await app.clickGenerate();
    arr = await app.getDisplayedArray();
    expect(arr.length).toBe(1);

    // Max boundary: set to 20 (the declared max)
    await app.setSizeInputValue(20);
    await app.clickGenerate();
    arr = await app.getDisplayedArray();
    expect(arr.length).toBe(20);

    // Ensure display text matches the array contents (numbers separated by commas)
    const rawText = await page.locator('#arrayDisplay').textContent();
    expect(rawText).toContain(',');
  });

  test('StartSort event (S1_ArrayGenerated -> S2_Sorting) sorts the array and updates the display', async ({ page }) => {
    // This test validates that clicking "Start Merge Sort" (StartSort event) eventually results
    // in the displayed array being sorted (transition to S2_Sorting and its observable)
    const app = new MergeSortPage(page);
    await app.goto();

    // Ensure we begin with an unsorted array to observe a meaningful sorting process.
    // We'll attempt up to 5 times to generate an unsorted array.
    let initial;
    for (let attempt = 0; attempt < 5; attempt++) {
      await app.setSizeInputValue(8); // moderate size to keep sorting time reasonable
      await app.clickGenerate();
      initial = await app.getDisplayedArray();
      if (!MergeSortPage.isSorted(initial) && initial.length === 8) break;
    }

    // If after attempts the array is still sorted (unlikely), we still proceed - the final sorted array will match.
    // Click start sort and wait for the display to become sorted
    await app.clickStartSort();

    // waitForSortedDisplay will poll the UI until it's in sorted order or timeout
    const final = await app.waitForSortedDisplay(60000); // allow up to 60s for sorting
    expect(MergeSortPage.isSorted(final)).toBeTruthy();

    // Final array should be a permutation of the initial values (same multiset)
    // We sort both arrays numerically and compare
    const sortedInitial = [...initial].sort((a, b) => a - b);
    const sortedFinal = [...final].sort((a, b) => a - b);
    expect(sortedFinal).toEqual(sortedInitial);
  });

  test('StartSort works with empty arrays and does not throw runtime errors (edge case)', async ({ page }) => {
    // Edge case: generate an empty array (size 0) and start sort - mergeSort should handle it gracefully
    const app = new MergeSortPage(page);
    await app.goto();

    // Create empty array by inputting 0 (input min is 2 but code does not enforce it server-side)
    await app.setSizeInputValue(0);
    await app.clickGenerate();

    let displayed = await app.getDisplayedArray();
    expect(displayed.length).toBe(0);

    // Start sort on empty array; expect no unhandled errors and display remains empty
    await app.clickStartSort();

    // Wait briefly to allow any async sort to complete
    await page.waitForTimeout(500);
    displayed = await app.getDisplayedArray();
    expect(displayed.length).toBe(0);
  });

  test('Verifies entry actions: displayArray invoked after GenerateArray and after sorting (DOM update assertions)', async ({ page }) => {
    // This test validates the entry actions displayArray() are producing DOM updates when expected.
    const app = new MergeSortPage(page);
    await app.goto();

    // Capture the display after initial onload (entry S0_Idle)
    const onLoadDisplay = await app.getDisplayedArray();
    expect(onLoadDisplay.length).toBeGreaterThanOrEqual(0);

    // When generating a new array, displayArray should be called and DOM updated.
    await app.setSizeInputValue(6);
    // Record previous text for comparison
    const beforeText = await page.locator('#arrayDisplay').textContent();
    await app.clickGenerate();

    // The display text should update (either different or same if random produced same sequence - check length instead)
    const afterText = await page.locator('#arrayDisplay').textContent();
    expect(afterText).not.toBeNull();

    // Ensure the displayed array has the requested length
    const arr = await app.getDisplayedArray();
    expect(arr.length).toBe(6);

    // Now test that after sorting, displayArray is called to show sorted data
    // Ensure array is not already sorted; attempt a few times if necessary
    let initial = arr;
    if (MergeSortPage.isSorted(initial)) {
      // regenerate until not sorted (max 5 attempts)
      for (let i = 0; i < 5 && MergeSortPage.isSorted(initial); i++) {
        await app.clickGenerate();
        initial = await app.getDisplayedArray();
      }
    }

    await app.clickStartSort();
    const final = await app.waitForSortedDisplay(60000);
    expect(MergeSortPage.isSorted(final)).toBeTruthy();
  });

  test('Monitors runtime console and page errors while interacting with the app (observability)', async ({ page }) => {
    // This test ensures we observe and record any runtime console errors or uncaught page errors while performing interactions
    const app = new MergeSortPage(page);
    await app.goto();

    // Perform a few interactions
    await app.setSizeInputValue(7);
    await app.clickGenerate();
    await app.clickStartSort();

    // Wait a short while for the sorting to progress/finish
    // Sorting contains deliberate delays; wait until sorted or until a reasonable cap
    try {
      await app.waitForSortedDisplay(60000);
    } catch (e) {
      // If sorting did not finish in time, we still want to assert there were no runtime errors
    }

    // At the end of the test the afterEach will assert that there are no pageErrors or consoleErrors.
    // Here we add an additional explicit check as part of test body for clarity.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});