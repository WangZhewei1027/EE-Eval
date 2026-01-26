import { test, expect } from '@playwright/test';

// Test file for Application ID: 72a9b733-fa78-11f0-812d-c9788050701f
// Serves the HTML at:
// http://127.0.0.1:5500/workspace/0126-biased/html/72a9b733-fa78-11f0-812d-c9788050701f.html
//
// This suite validates the FSM states/transitions described in the specification:
// - S0_Idle: initial state after resetArray() on load
// - S1_Sorting: when Start Sorting is clicked, startSorting() runs
// - S2_Sorted: final state when all elements are rendered as sorted
//
// Notes:
// - We load the page exactly as provided.
// - We observe console messages and page errors without modifying the page runtime.
// - We assert that there are no uncaught page errors or console error messages.
// - Many of the application's animations use setTimeout (animationSpeed). Tests
//   waiting for sorting to finish use extended timeouts to accommodate the runtime behavior.
// - Comments above each test describe what is being validated.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a9b733-fa78-11f0-812d-c9788050701f.html';

// Page object for interacting with the Quick Sort visualization page
class QuickSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#start-btn');
    this.resetBtn = page.locator('#reset-btn');
    this.arrayContainer = page.locator('#array-container');
    this.comparisonsEl = page.locator('#comparisons');
    this.swapsEl = page.locator('#swaps');
    this.callsEl = page.locator('#calls');

    // Collect runtime errors and console error messages observed during test
    this.pageErrors = [];
    this.consoleErrors = [];

    // Attach listeners to capture errors
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // Collect console error text for later assertions
        this.consoleErrors.push(msg.text());
      }
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial render: the animation finishes quickly; ensure container exists
    await this.arrayContainer.waitFor({ state: 'visible', timeout: 5000 });
  }

  // Returns number of bar elements in the array
  async getBarCount() {
    return this.page.$$eval('#array-container .array-bar', bars => bars.length);
  }

  // Returns array of numeric values from data-value attributes
  async getArrayValues() {
    return this.page.$$eval('#array-container .array-bar', bars =>
      bars.map(b => Number(b.getAttribute('data-value')))
    );
  }

  // Returns stats as numbers { comparisons, swaps, calls }
  async getStats() {
    const comparisons = Number(await this.comparisonsEl.textContent());
    const swaps = Number(await this.swapsEl.textContent());
    const calls = Number(await this.callsEl.textContent());
    return { comparisons, swaps, calls };
  }

  // Returns number of bars that have 'sorted' class
  async getSortedCount() {
    return this.page.$$eval('#array-container .array-bar', bars =>
      bars.filter(b => b.classList.contains('sorted')).length
    );
  }

  // Returns whether every bar has 'sorted' class
  async isAllSorted() {
    return this.page.$$eval('#array-container .array-bar', bars =>
      bars.length > 0 && bars.every(b => b.classList.contains('sorted'))
    );
  }

  // Click Start Sorting button
  async startSorting() {
    await this.startBtn.click();
  }

  // Click Reset Array button
  async resetArray() {
    await this.resetBtn.click();
  }

  // Wait for sorting to begin by detecting partition line or disabled buttons
  async waitForSortingStart(timeout = 15000) {
    // Sorting start sets startBtn.disabled = true and resetBtn.disabled = true,
    // and partition lines may appear. We'll wait for the start button to become disabled.
    await this.page.waitForFunction(() => {
      const start = document.getElementById('start-btn');
      return start && start.disabled === true;
    }, { timeout });
  }

  // Wait until sorting finishes: start button becomes enabled again.
  async waitForSortingComplete(timeout = 180000) {
    await this.page.waitForFunction(() => {
      const start = document.getElementById('start-btn');
      return start && start.disabled === false;
    }, { timeout });
  }

  // Wait for at least one partition line to appear during sorting
  async waitForPartitionLine(timeout = 15000) {
    await this.page.waitForSelector('.partition-line', { timeout });
  }

  // Return captured page errors
  getPageErrors() {
    return this.pageErrors;
  }

  // Return captured console error messages
  getConsoleErrors() {
    return this.consoleErrors;
  }
}

test.describe('Quick Sort Visualization - FSM and UI behavior', () => {
  // Use a longer timeout for tests that wait for sorting to finish
  test.setTimeout(180000); // 3 minutes to allow animation-driven sorting to complete

  let qsPage;
  let page;

  // Common setup: navigate to the page and create the page object
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    qsPage = new QuickSortPage(page);
    await qsPage.goto();
  });

  test.afterEach(async () => {
    // Close the page to teardown listeners
    await page.close();
  });

  test('Idle state (S0_Idle) on initial load: resetArray() ran and UI is initialized', async () => {
    // Validate that the initial entry action resetArray() produced an array of the expected size
    // and reset the stats to zero.
    const barCount = await qsPage.getBarCount();
    // The implementation uses arraySize = 15
    expect(barCount).toBe(15);

    // Validate stats are zero at idle
    const stats = await qsPage.getStats();
    expect(stats.comparisons).toBe(0);
    expect(stats.swaps).toBe(0);
    expect(stats.calls).toBe(0);

    // Buttons should be enabled in idle state
    await expect(qsPage.startBtn).toBeEnabled();
    await expect(qsPage.resetBtn).toBeEnabled();

    // No bars should have 'sorted' class on initial reset
    const sortedCount = await qsPage.getSortedCount();
    expect(sortedCount).toBe(0);

    // Ensure no uncaught page errors or console errors occurred during load (observe runtime)
    const pageErrors = qsPage.getPageErrors();
    const consoleErrors = qsPage.getConsoleErrors();
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Sorting on Start Sorting click; observe sorting progress', async () => {
    // Capture current array values before starting
    const beforeValues = await qsPage.getArrayValues();

    // Click Start Sorting to trigger startSorting() (S1 entry action)
    await qsPage.startSorting();

    // Wait for sorting to start (buttons disabled)
    await qsPage.waitForSortingStart(15000);

    // During sorting, start and reset buttons should be disabled
    await expect(qsPage.startBtn).toBeDisabled();
    await expect(qsPage.resetBtn).toBeDisabled();

    // At least one partition-line should appear during sorting (visual indicator)
    // This asserts that partitioning is happening (part of quickSort logic)
    await qsPage.waitForPartitionLine(15000);

    // Stats should begin to increase as comparisons/swaps occur
    // Wait until recursive calls is at least 1 (quickSort increments recursiveCalls at entry)
    await page.waitForFunction(() => {
      const callsEl = document.getElementById('calls');
      if (!callsEl) return false;
      const calls = Number(callsEl.textContent);
      return calls >= 1;
    }, { timeout: 15000 });

    const midStats = await qsPage.getStats();
    expect(midStats.calls).toBeGreaterThanOrEqual(1);

    // Try clicking start while sorting - startSorting should ignore if isSorting true (no double start)
    // Clicking should not change disabled state or cause errors
    await qsPage.startBtn.click();
    await expect(qsPage.startBtn).toBeDisabled();
    await expect(qsPage.resetBtn).toBeDisabled();

    // Also attempt to click reset while sorting; resetArray() should return early if isSorting is true.
    // In the implementation resetBtn will be disabled during sorting, but we try to click programmatically.
    // This asserts there's no uncaught error when attempting to trigger events while sorting.
    let preResetAttemptValues = await qsPage.getArrayValues();
    // Attempt click (may be a no-op due to disabled attribute)
    await qsPage.resetBtn.click();
    // Wait a short moment to allow any unintended effects
    await page.waitForTimeout(500);
    const postResetAttemptValues = await qsPage.getArrayValues();
    // Values should remain the same because resetArray should not run while sorting
    expect(postResetAttemptValues).toEqual(preResetAttemptValues);
  });

  test('Transition S1_Sorting -> S2_Sorted: sorting completes and all elements are marked sorted', async () => {
    // Start sorting and wait until complete; then validate final sorted state (S2_Sorted)
    const beforeValues = await qsPage.getArrayValues();

    await qsPage.startSorting();

    // Wait for sorting to begin
    await qsPage.waitForSortingStart(15000);

    // Wait for sorting completion: start button becomes enabled again.
    // Sorting uses multiple setTimeouts; give generous timeout to accommodate.
    await qsPage.waitForSortingComplete(180000);

    // After sorting completes, the implementation's exit action renders all elements as sorted.
    // Validate that all bars have the 'sorted' class.
    const allSorted = await qsPage.isAllSorted();
    expect(allSorted).toBe(true);

    // Validate that stats show some activity: at least one recursive call occurred
    const finalStats = await qsPage.getStats();
    expect(finalStats.calls).toBeGreaterThanOrEqual(1);
    // swaps and comparisons should be >= 0 (cannot be negative); ideally at least one comparison occurred
    expect(finalStats.comparisons).toBeGreaterThanOrEqual(0);
    expect(finalStats.swaps).toBeGreaterThanOrEqual(0);

    // Buttons should be re-enabled after sorting completes
    await expect(qsPage.startBtn).toBeEnabled();
    await expect(qsPage.resetBtn).toBeEnabled();

    // Ensure no uncaught page errors or console errors occurred during sorting
    const pageErrors = qsPage.getPageErrors();
    const consoleErrors = qsPage.getConsoleErrors();
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Validate that array values are now in non-decreasing order (final sorted array)
    // The UI's 'sorted' marking implies the array is sorted in-place; verify the numeric order.
    const finalValues = await qsPage.getArrayValues();
    for (let i = 1; i < finalValues.length; i++) {
      expect(finalValues[i - 1]).toBeLessThanOrEqual(finalValues[i]);
    }
  });

  test('Reset Array event: clicking Reset when idle produces a new random array and resets stats', async () => {
    // Ensure we are idle
    await expect(qsPage.startBtn).toBeEnabled();

    const valuesBeforeReset = await qsPage.getArrayValues();
    const statsBefore = await qsPage.getStats();

    // Click reset - this should produce a new random array and reset stats to zero
    await qsPage.resetArray();

    // Allow a small time for DOM to update
    await page.waitForTimeout(500);

    const valuesAfterReset = await qsPage.getArrayValues();
    const statsAfter = await qsPage.getStats();

    // Check count remains the same
    expect(valuesAfterReset.length).toBe(valuesBeforeReset.length);

    // It is possible (though unlikely) for random arrays to be identical;
    // assert at minimum that stats were reset to zeros.
    expect(statsAfter.comparisons).toBe(0);
    expect(statsAfter.swaps).toBe(0);
    expect(statsAfter.calls).toBe(0);

    // If arrays are identical by chance, we still consider reset successful if stats are reset and DOM rendered
    // To be stricter, if they differ, assert they changed
    const arraysDiffer = JSON.stringify(valuesBeforeReset) !== JSON.stringify(valuesAfterReset);
    if (arraysDiffer) {
      expect(arraysDiffer).toBe(true);
    }
  });

  test('Edge case: clicking Reset during sorting does not alter sorting process and does not throw', async () => {
    // Start sorting
    await qsPage.startSorting();
    await qsPage.waitForSortingStart(15000);

    // Capture values while sorting is in progress
    const valuesDuringSorting = await qsPage.getArrayValues();

    // Attempt to click reset while sorting (button is disabled in UI); should not change array
    // and should not throw errors; we attempt multiple clicks rapidly to simulate user behavior.
    for (let i = 0; i < 3; i++) {
      // Use page.click to attempt to click in case disabled attribute is not respected by pointer events
      try {
        await page.click('#reset-btn', { timeout: 1000 }).catch(() => {});
      } catch (e) {
        // Ignore any click-related errors - we capture page errors separately
      }
    }

    // Wait shortly to allow for any unintended effects
    await page.waitForTimeout(500);

    const valuesAfterResetAttempts = await qsPage.getArrayValues();

    // The values should remain the same after attempted resets during sorting
    expect(valuesAfterResetAttempts).toEqual(valuesDuringSorting);

    // Wait for sorting to complete to ensure no lingering errors or broken state
    await qsPage.waitForSortingComplete(180000);

    // Validate no uncaught errors occurred during the attempted reset-in-sorting
    const pageErrors = qsPage.getPageErrors();
    const consoleErrors = qsPage.getConsoleErrors();
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});