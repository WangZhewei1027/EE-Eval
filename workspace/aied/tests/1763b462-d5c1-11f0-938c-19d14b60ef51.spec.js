import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/1763b462-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object for the Radix Sort demo
class RadixSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Get the Sort Array button
  getSortButton() {
    return this.page.locator("button[onclick='startSort()']");
  }

  // Get all bar elements in the array container
  getBars() {
    return this.page.locator('#array-container .bar');
  }

  // Return an array of numeric values (from bar.title)
  async getBarValues() {
    const bars = await this.getBars().elementHandles();
    const values = [];
    for (const bar of bars) {
      const title = await bar.getAttribute('title');
      // parse title as int; if missing, push NaN to surface issues
      values.push(title !== null ? Number(title) : NaN);
    }
    return values;
  }

  // Check that number of bars equals expected
  async expectBarsCount(count) {
    await expect(this.getBars()).toHaveCount(count);
  }

  // Wait until the array appears sorted (non-decreasing) or timeout
  async waitForSorted(timeout = 5000, pollInterval = 100) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const vals = await this.getBarValues();
      if (vals.length > 0) {
        let sorted = true;
        for (let i = 1; i < vals.length; i++) {
          if (Number.isNaN(vals[i - 1]) || Number.isNaN(vals[i]) || vals[i - 1] > vals[i]) {
            sorted = false;
            break;
          }
        }
        if (sorted) return vals;
      }
      await this.page.waitForTimeout(pollInterval);
    }
    // Final attempt to return values even if not sorted
    return await this.getBarValues();
  }
}

// Grouping all FSM related tests
test.describe('Radix Sort Demonstration - FSM and UI tests', () => {
  // Shared variables to capture console messages and page errors per test
  let consoleMessages = [];
  let pageErrors = [];

  // Setup: navigate to the page and attach listeners
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, warn, error, etc.)
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the application exactly as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({}, testInfo) => {
    // If there are any page errors, include them in the test output for easier debugging
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        testInfo.attach('pageerror', { body: String(err.stack || err), contentType: 'text/plain' });
      }
    }
    if (consoleMessages.length > 0) {
      testInfo.attach('console', { body: JSON.stringify(consoleMessages, null, 2), contentType: 'application/json' });
    }
  });

  // Validate initial state S0_Idle: Idle and rendered array
  test('S0_Idle: Initial render shows an array of bars (renderArray entry_action)', async ({ page }) => {
    // This test validates the initial state S0_Idle as per FSM:
    // - renderArray() should have executed on page load
    // - There should be 10 bars rendered, each with a numeric title attribute

    const app = new RadixSortPage(page);

    // The FSM expects an initial render; ensure container contains bars
    await app.expectBarsCount(10);

    // Verify each bar has a numeric title between 0 and 999 (reasonable bounds)
    const values = await app.getBarValues();
    expect(values.length).toBe(10);
    for (const val of values) {
      expect(typeof val).toBe('number');
      expect(Number.isNaN(val)).toBeFalsy();
      // values were generated with Math.floor(Math.random() * 100)
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(100);
    }

    // Ensure there were no uncaught page errors during initial render
    expect(pageErrors.length, `Expected no page errors on initial render; found: ${pageErrors.length}`).toBe(0);

    // Ensure no console.error messages emitted during initial render
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error on initial render; found: ${consoleErrors.length}`).toBe(0);
  });

  // Validate transition S0_Idle -> S1_Sorting triggered by Sort Array click
  test('Transition: SortArray_Click moves from Idle to Sorting (S1_Sorting)', async ({ page }) => {
    // This test validates that clicking the Sort Array button triggers the sorting process:
    // - startSort() is bound to the button and executes setTimeout
    // - renderArray() is called before and during sorting (we validate DOM updates)
    // - No runtime errors should occur during the transition

    const app = new RadixSortPage(page);

    // Capture initial snapshot of values
    const beforeValues = await app.getBarValues();
    expect(beforeValues.length).toBe(10);

    // Click the Sort Array button to trigger startSort()
    await app.getSortButton().click();

    // Immediately after clicking, the app calls renderArray() (entry_action for Sorting)
    // Assert there are still 10 bars (UI remains consistent)
    await app.expectBarsCount(10);

    // No immediate errors should have been thrown due to the click handler
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Validate the full sorting process and final state S2_Sorted
  test('S1_Sorting -> S2_Sorted: After sorting completes the array is sorted and rendered', async ({ page }) => {
    // This test validates:
    // - The sorting finishes eventually (radixSort executed after setTimeout)
    // - The final renderArray() produces a non-decreasing sequence of bar titles (sorted)
    // - renderArray() was used as entry/exit action (observed via DOM updates)
    // - No unhandled exceptions occurred during sorting

    const app = new RadixSortPage(page);

    // Start sorting
    await app.getSortButton().click();

    // Wait for sorting to complete - the implementation uses setTimeout 1000ms before starting
    // and then performs radixSort synchronously; allow generous timeout to be robust in CI
    const finalValues = await app.waitForSorted(7000, 150);

    // Validate that finalValues are non-decreasing
    expect(finalValues.length).toBe(10);

    let sorted = true;
    for (let i = 1; i < finalValues.length; i++) {
      if (finalValues[i - 1] > finalValues[i]) {
        sorted = false;
        break;
      }
    }
    expect(sorted, `Expected the array to be sorted non-decreasing; got ${finalValues}`).toBeTruthy();

    // After sorting, ensure there were no uncaught page errors
    expect(pageErrors.length, `Expected no page errors during sorting; found: ${pageErrors.length}`).toBe(0);

    // Ensure there were no console.error messages during sorting
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error during sorting; found: ${consoleErrors.length}`).toBe(0);
  });

  // Edge case: clicking the Sort Array button multiple times rapidly
  test('Edge case: Rapid multiple clicks do not cause uncaught exceptions and produce a sorted result', async ({ page }) => {
    // This test validates robustness:
    // - Clicking the Sort button multiple times in quick succession should not crash the page
    // - Final state should still be a sorted array
    // - No uncaught page errors should be present

    const app = new RadixSortPage(page);

    // Perform rapid clicks
    await Promise.all([
      app.getSortButton().click(),
      app.getSortButton().click(),
      app.getSortButton().click()
    ]);

    // Wait for sorting to settle
    const finalValues = await app.waitForSorted(8000, 200);

    // Validate sortedness
    let sorted = true;
    for (let i = 1; i < finalValues.length; i++) {
      if (finalValues[i - 1] > finalValues[i]) {
        sorted = false;
        break;
      }
    }
    expect(sorted, `Expected sorted array after rapid clicks; got ${finalValues}`).toBeTruthy();

    // Validate no uncaught page errors occurred
    expect(pageErrors.length, 'No uncaught page errors should result from rapid clicks').toBe(0);

    // Validate no console.error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console.error messages should be emitted from rapid clicks').toBe(0);
  });

  // Error observation test: capture console and page errors and assert they are absent
  test('Observability: Console and page errors should be observed and asserted (no unexpected runtime errors)', async ({ page }) => {
    // This test explicitly demonstrates observing console and page errors.
    // Per constraints we observe them and then assert expected behavior (here: expecting none).
    // If any ReferenceError/SyntaxError/TypeError occurs naturally in page runtime they will be captured
    // by the listeners attached in beforeEach and cause this test to fail.

    const app = new RadixSortPage(page);

    // Ensure initial state rendered
    await app.expectBarsCount(10);

    // No synthetic interactions here; simply ensure that the captured arrays exist
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();

    // Assert that there are currently no uncaught page errors
    // If runtime errors like ReferenceError or TypeError occurred they would be present here and fail the test.
    expect(pageErrors.length, `Detected page errors: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // Assert that console.error messages are not present (if they are, they will be included in failure message)
    const consoleErrs = consoleMessages.filter(c => c.type === 'error');
    expect(consoleErrs.length, `Detected console.error messages: ${JSON.stringify(consoleErrs, null, 2)}`).toBe(0);
  });
});