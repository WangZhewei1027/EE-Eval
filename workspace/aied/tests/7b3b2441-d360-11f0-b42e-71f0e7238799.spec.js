import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3b2441-d360-11f0-b42e-71f0e7238799.html';

// Page Object for the Selection Sort Visualization page
class SelectionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];
    // Capture console errors and page errors for assertions
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
    this.page.on('pageerror', err => {
      // Capture Error objects thrown on the page
      this.pageErrors.push({
        message: err.message,
        name: err.name,
        stack: err.stack
      });
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async startSorting() {
    await this.page.click("button[onclick='startSorting()']");
  }

  // Return array of numeric heights (in px) of the bars currently rendered.
  async getBarHeights() {
    return await this.page.$$eval('#array-container .bar', bars =>
      bars.map(b => parseFloat(b.style.height || '0'))
    );
  }

  // Wait until the DOM shows the fully sorted bar heights
  async waitForSorted(timeout = 10000) {
    const expected = [11, 12, 22, 25, 64].map(v => v * 5); // [55,60,110,125,320]
    await this.page.waitForFunction(
      expectedHeights => {
        const bars = Array.from(document.querySelectorAll('#array-container .bar'));
        if (bars.length !== expectedHeights.length) return false;
        const heights = bars.map(b => parseFloat(b.style.height || '0'));
        return expectedHeights.every((h, i) => heights[i] === h);
      },
      expected,
      { timeout }
    );
  }

  // Helper to assert no console/page errors occurred
  assertNoRuntimeErrors() {
    // Assert there are no console 'error' messages
    expect(this.consoleErrors, 'No console.error should be emitted').toHaveLength(0);
    // Assert there are no uncaught page errors
    expect(this.pageErrors, 'No uncaught page errors should occur').toHaveLength(0);
  }
}

// Group tests for the Selection Sort Visualization FSM and interactions
test.describe('Selection Sort Visualization (FSM states and transitions)', () => {
  // Test S0: Initial Idle state - initial render
  test('S0_Idle: Initial render shows the unsorted array as bars', async ({ page }) => {
    const app = new SelectionSortPage(page);

    // Navigate to the app
    await app.goto();

    // Verify initial bars are rendered and match the initial array heights
    // Initial array: [64, 25, 12, 22, 11] -> heights *5 => [320,125,60,110,55]
    const initialExpected = [64, 25, 12, 22, 11].map(v => v * 5);
    const heights = await app.getBarHeights();

    // Validate count and exact heights to ensure renderArray(array) was executed on load (entry action of S0_Idle)
    expect(heights.length).toBe(initialExpected.length);
    expect(heights).toEqual(initialExpected);

    // Ensure no runtime errors occurred during initial load
    app.assertNoRuntimeErrors();
  });

  // Test transition from Idle -> Sorting (S0 -> S1) and eventually to Sorted (S2)
  test('StartSorting event triggers selection sort and reaches S2_Sorted: final sorted DOM is rendered', async ({ page }) => {
    const app = new SelectionSortPage(page);

    // Navigate to the app
    await app.goto();

    // Sanity: initial state before clicking
    const initialHeights = await app.getBarHeights();
    const initialExpected = [64, 25, 12, 22, 11].map(v => v * 5);
    expect(initialHeights).toEqual(initialExpected);

    // Trigger the StartSorting event (click the button) - this initiates transition S0 -> S1 (startSorting calls selectionSort)
    await app.startSorting();

    // While sorting runs asynchronously, verify that some intermediate render occurs (evidence of S1_Sorting being active).
    // We'll wait briefly and assert that the array in the DOM is not exactly equal to the initial array
    // (i.e., a change has occurred or at least sorting is in progress). We use a small delay to allow the first iteration to proceed.
    await page.waitForTimeout(600);
    const midHeights = await app.getBarHeights();

    // It is expected that after sorting has progressed some bars are different from the initial state.
    // This validates that selectionSort is mutating a displayed array copy and renderArray is called during sorting.
    const isDifferentFromInitial = JSON.stringify(midHeights) !== JSON.stringify(initialExpected);
    expect(isDifferentFromInitial).toBe(true);

    // Wait for the final sorted state (S2_Sorted)
    await app.waitForSorted(10000);

    // Confirm final sorted heights match expected ascending order
    const finalExpected = [11, 12, 22, 25, 64].map(v => v * 5); // [55,60,110,125,320]
    const finalHeights = await app.getBarHeights();
    expect(finalHeights).toEqual(finalExpected);

    // Verify that selectionSort invoked renderArray at the end (exit action evidence)
    // and that no uncaught runtime errors occurred during the process
    app.assertNoRuntimeErrors();
  });

  // Test concurrent interactions and edge cases
  test('Edge case: Multiple rapid clicks (concurrent sorts) do not produce uncaught errors and eventually produce sorted DOM', async ({ page }) => {
    const app = new SelectionSortPage(page);

    await app.goto();

    // Rapidly click the start button multiple times to simulate user spamming
    await Promise.all([
      app.startSorting(),
      app.startSorting(),
      app.startSorting()
    ]);

    // Allow sorting to progress; give generous timeout to accommodate multiple concurrent runs
    await app.waitForSorted(15000);

    // Ensure final state is sorted
    const finalExpected = [11, 12, 22, 25, 64].map(v => v * 5);
    const finalHeights = await app.getBarHeights();
    expect(finalHeights).toEqual(finalExpected);

    // Ensure no runtime errors occurred (no ReferenceError, SyntaxError, TypeError thrown)
    app.assertNoRuntimeErrors();
  });

  // Test that clicking Start after array is already sorted does not throw and results in sorted state
  test('Clicking StartSelectionSort after sorted re-runs algorithm safely (idempotent behavior) and no errors', async ({ page }) => {
    const app = new SelectionSortPage(page);

    await app.goto();

    // First run to sort array
    await app.startSorting();
    await app.waitForSorted(10000);

    // Click again after sorted
    await app.startSorting();

    // Because selectionSort uses a copy of the original array, re-running should still result in a sorted array
    await app.waitForSorted(10000);

    const finalExpected = [11, 12, 22, 25, 64].map(v => v * 5);
    const finalHeights = await app.getBarHeights();
    expect(finalHeights).toEqual(finalExpected);

    // Confirm there were no runtime errors across both runs
    app.assertNoRuntimeErrors();
  });

  // Negative / error-observation test: collect any console or page errors and inspect types (if any)
  test('Observe page and console errors (there should be none); if present, they are reported', async ({ page }) => {
    const app = new SelectionSortPage(page);

    await app.goto();

    // Trigger normal usage
    await app.startSorting();

    // Wait for sorting to finish
    await app.waitForSorted(10000);

    // Collect any captured errors
    const consoleErrors = app.consoleErrors;
    const pageErrors = app.pageErrors;

    // This test documents and asserts absence of common runtime errors.
    // If errors exist, fail with useful diagnostic info.
    if (consoleErrors.length > 0) {
      // Provide diagnostic details in assertion message
      expect(consoleErrors, `Expected no console.error messages, but found: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
    }

    if (pageErrors.length > 0) {
      expect(pageErrors, `Expected no uncaught page errors, but found: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
    }

    // If both arrays are empty, assert passes
    expect(consoleErrors.length + pageErrors.length).toBe(0);
  });
});