import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17638d52-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object for the Quick Sort Visualization page
class QuickSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    // collect console messages and page errors for assertions
    this.page.on('console', msg => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
    this.page.on('pageerror', error => {
      this.pageErrors.push(error);
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Returns locator for the sort button
  sortButton() {
    return this.page.locator("button[onclick='startQuickSort()']");
  }

  // Returns array of element handles for bars
  bars() {
    return this.page.locator('#arrayContainer .bar');
  }

  // Click the Sort Random Array button
  async clickSortButton() {
    await this.sortButton().click();
  }

  // Read numeric values from the bars
  async getArrayValues() {
    const count = await this.bars().count();
    const values = [];
    for (let i = 0; i < count; i++) {
      const text = await this.bars().nth(i).innerText();
      // parse int safe
      const parsed = parseInt(text.trim(), 10);
      values.push(Number.isNaN(parsed) ? null : parsed);
    }
    return values;
  }

  // Check whether array is sorted non-decreasing
  static isSortedNonDecreasing(arr) {
    for (let i = 1; i < arr.length; i++) {
      if (arr[i] < arr[i - 1]) return false;
    }
    return true;
  }

  // Wait for the array to become sorted (polling). Timeout in ms.
  async waitForSorted(timeout = 3000, pollInterval = 100) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const values = await this.getArrayValues();
      // if any value is null (parse failed), continue waiting
      if (values.every(v => typeof v === 'number') && QuickSortPage.isSortedNonDecreasing(values)) {
        return values;
      }
      await this.page.waitForTimeout(pollInterval);
    }
    // final snapshot
    return await this.getArrayValues();
  }

  // Wait for a change in the DOM bars count (used to detect entry action displayArray)
  async waitForBarsCountChange(previousCount, timeout = 2000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const count = await this.bars().count();
      if (count !== previousCount) return count;
      await this.page.waitForTimeout(50);
    }
    return await this.bars().count();
  }
}

test.describe('Quick Sort Visualization - FSM tests (Application ID: 17638d52-d5c1-11f0-938c-19d14b60ef51)', () => {
  // Shared page instance for tests
  test.beforeEach(async ({ page }) => {
    // Nothing to do here; each test will create its own QuickSortPage and navigate
  });

  test('Idle state: initial displayArray(array) should render 10 bars on load', async ({ page }) => {
    // This test validates the S0_Idle state's entry action displayArray(array).
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Validate no uncaught page errors during initial load
    expect(qs.pageErrors).toEqual([]);

    const barsCount = await qs.bars().count();
    // The implementation creates an initial array of size 10
    expect(barsCount).toBeGreaterThanOrEqual(10);

    // Each bar should render a numeric label and have a height style
    const values = await qs.getArrayValues();
    expect(values.length).toBe(barsCount);
    for (const v of values) {
      expect(typeof v).toBe('number');
      expect(Number.isInteger(v)).toBe(true);
      // values are in range 0..99
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(100);
    }

    // Ensure there were no console errors during initial rendering
    const errorConsoleMessages = qs.consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition Idle -> Sorting: clicking Sort Random Array triggers startQuickSort and results in a sorted array', async ({ page }) => {
    // This test validates the transition from S0_Idle to S1_Sorting via the SortRandomArray event.
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Capture the initial array to compare later
    const initialValues = await qs.getArrayValues();

    // Click the sort button to trigger startQuickSort()
    await qs.clickSortButton();

    // After clicking, the page should display a new array and then sorting should complete.
    // Use waitForSorted to poll until array becomes non-decreasing.
    const finalValues = await qs.waitForSorted(3000, 50);

    // Validate that array length remains the same (generateRandomArray(10))
    expect(finalValues.length).toBeGreaterThanOrEqual(10);

    // Validate final array is sorted non-decreasing (observable effect of quickSort algorithm)
    const sorted = QuickSortPage.isSortedNonDecreasing(finalValues);
    expect(sorted).toBe(true);

    // Validate that either the array changed from initial (random generation) OR it was re-displayed (even if identical).
    const arraysEqual = JSON.stringify(initialValues) === JSON.stringify(finalValues);
    // It's acceptable if the random array happened to be already sorted; if not equal then we observed a change.
    // Assert that either initial != final OR initial was already sorted (rare).
    const initialSorted = QuickSortPage.isSortedNonDecreasing(initialValues);
    expect(arraysEqual ? initialSorted : true).toBe(true);

    // Ensure no uncaught exceptions during the sorting process
    expect(qs.pageErrors.length).toBe(0);

    // Ensure there are no console error messages raised
    const consoleErrors = qs.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM action verification: onEnter/onExit actions and UI feedback during transition', async ({ page }) => {
    // This test validates that the entry action startQuickSort() executes (by observing UI updates)
    // and that displayArray is called as part of the transition actions.
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Record pre-click bars count
    const beforeCount = await qs.bars().count();

    // Click the button — this triggers array = generateRandomArray(10) and displayArray(array)
    await qs.clickSortButton();

    // Wait for the bars count to change (displayArray called)
    const afterCount = await qs.waitForBarsCountChange(beforeCount, 2000);
    expect(afterCount).toBeGreaterThanOrEqual(10);

    // After sorting completes (quickSort), final state should be sorted
    const finalValues = await qs.waitForSorted(3000, 50);
    expect(QuickSortPage.isSortedNonDecreasing(finalValues)).toBe(true);

    // Inspect DOM: bars should have heights corresponding to numeric values
    for (let i = 0; i < finalValues.length; i++) {
      const bar = qs.bars().nth(i);
      const height = await bar.evaluate(node => node.style.height);
      const text = await bar.innerText();
      const numeric = parseInt(text.trim(), 10);
      // Height should reflect value*2 px as per implementation
      expect(height).toContain(`${numeric * 2}px`);
    }

    // Confirm no uncaught errors
    expect(qs.pageErrors.length).toBe(0);
    expect(qs.consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Edge case: clicking Sort Random Array multiple times rapidly should still produce a sorted final array', async ({ page }) => {
    // This test checks robustness: firing the Sort event multiple times in quick succession.
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Click the sort button three times quickly
    await Promise.all([
      qs.sortButton().click(),
      qs.sortButton().click(),
      qs.sortButton().click()
    ]);

    // Wait for final sorted state
    const finalValues = await qs.waitForSorted(4000, 50);
    expect(QuickSortPage.isSortedNonDecreasing(finalValues)).toBe(true);

    // No uncaught exceptions expected
    expect(qs.pageErrors.length).toBe(0);
    expect(qs.consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Error observation: collect console logs and page errors during lifecycle', async ({ page }) => {
    // This test explicitly verifies that we observe console messages and page errors,
    // and asserts that the page does not produce runtime exceptions in normal operation.
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Interact: perform a sort to exercise more code paths
    await qs.clickSortButton();
    await qs.waitForSorted(3000, 50);

    // Gather observations
    const consoleErrors = qs.consoleMessages.filter(m => m.type === 'error');
    const consoleWarnings = qs.consoleMessages.filter(m => m.type === 'warning');

    // Assert: no uncaught page errors and no console error messages produced by the page
    expect(qs.pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // We allow warnings but capture them for visibility; assert that warnings are zero or more.
    expect(consoleWarnings.length).toBeGreaterThanOrEqual(0);
  });

  test('Validation of DOM structure and component selectors as per FSM components list', async ({ page }) => {
    // This test asserts that the components described in the FSM are present in the DOM.
    const qs = new QuickSortPage(page);
    await qs.goto();

    // The FSM lists a button with onclick='startQuickSort()' and a #arrayContainer element
    const button = page.locator("button[onclick='startQuickSort()']");
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('Sort Random Array');

    const container = page.locator('#arrayContainer');
    await expect(container).toHaveCount(1);

    // Ensure the container initially contains .bar children
    const barsCount = await qs.bars().count();
    expect(barsCount).toBeGreaterThanOrEqual(10);

    // Ensure no runtime errors were triggered by querying these elements
    expect(qs.pageErrors.length).toBe(0);
  });
});