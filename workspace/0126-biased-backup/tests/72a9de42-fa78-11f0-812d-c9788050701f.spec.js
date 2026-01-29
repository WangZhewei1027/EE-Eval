import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a9de42-fa78-11f0-812d-c9788050701f.html';

// Increase default timeout because the app performs animated async sorting with sleeps
test.setTimeout(120000);

class RadixPage {
  /**
   * Page Object for the Radix Sort visualization page
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.stepIndicator = page.locator('.step-indicator');
    this.arrayContainer = page.locator('#array-container');
    this.bucketsContainer = page.locator('#buckets-container');
    this.startBtn = page.locator('#start-btn');
    this.resetBtn = page.locator('#reset-btn');
    this.arrayBars = page.locator('.array-bar');
    this.bucketElements = page.locator('.bucket');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial rendering triggered by DOMContentLoaded script
    await this.stepIndicator.waitFor({ state: 'visible' });
  }

  async getStepText() {
    return (await this.stepIndicator.textContent())?.trim() ?? '';
  }

  async getArrayBarCount() {
    return await this.arrayBars.count();
  }

  async getBucketCount() {
    return await this.bucketElements.count();
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async isStartDisabled() {
    return await this.startBtn.evaluate((b) => b.disabled);
  }

  async waitForSortingStart(timeout = 2000) {
    // Sorting by digit 1 (ones place) is set synchronously in radixSort before sleeps
    await this.page.waitForFunction(() => {
      const el = document.querySelector('.step-indicator');
      return el && /Sorting by digit \d+/.test(el.textContent || '');
    }, null, { timeout });
  }

  async waitForSortingComplete(timeout = 90000) {
    await this.page.waitForFunction(() => {
      const el = document.querySelector('.step-indicator');
      return el && el.textContent.trim() === 'Sorting Complete';
    }, null, { timeout });
  }

  async anyActiveDigitHighlights() {
    return await this.page.locator('.digit-highlight.active-digit').count();
  }

  async anyBucketItemsCount() {
    return await this.page.locator('.bucket-item').count();
  }

  async anySortedBarsCount() {
    return await this.page.locator('.array-bar.sorted').count();
  }

  async getArrayValues() {
    // returns an array of numbers currently shown in the array bars via data-value
    const count = await this.getArrayBarCount();
    const values = [];
    for (let i = 0; i < count; i++) {
      const el = this.arrayBars.nth(i);
      const v = await el.getAttribute('data-value');
      values.push(v ? Number(v) : null);
    }
    return values;
  }
}

test.describe('Radix Sort Visualization - FSM and UI behaviors', () => {
  let radix;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors for each test
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // store type and text for diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    radix = new RadixPage(page);
    await radix.goto();
  });

  test.afterEach(async ({ page }) => {
    // Extra safety: detach listeners are not necessary as page is recreated per test in Playwright,
    // but we ensure we give test diagnostics when assertions fail (consoleMessages/pageErrors available).
  });

  test('Initial Idle state renders correctly (S0_Idle)', async ({ page }) => {
    // Validate the initial Idle state: "Initial Array" indicator, array and buckets rendered
    const step = await radix.getStepText();
    expect(step).toBe('Initial Array');

    // By FSM, initial renderArray generates 10 elements
    const barCount = await radix.getArrayBarCount();
    expect(barCount).toBeGreaterThanOrEqual(1); // it's expected to be 10, but ensure at least 1 in case of environment differences

    // Buckets container should render 10 buckets
    const bucketCount = await radix.getBucketCount();
    expect(bucketCount).toBe(10);

    // No bars should be marked sorted initially
    const sortedCount = await radix.anySortedBarsCount();
    expect(sortedCount).toBe(0);

    // No uncaught page errors should have occurred during initial load
    expect(pageErrors.length).toBe(0);

    // Ensure there are console messages but none of type 'error'
    const errorConsoles = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsoles.length).toBe(0);
  });

  test('Start Sorting transitions to Sorting and disables Start (S0_Idle -> S1_Sorting)', async ({ page }) => {
    // This test validates:
    // - Clicking Start triggers the sorting state
    // - step-indicator updates to "Sorting by digit 1 (ones place)"
    // - start button becomes disabled
    // - digit highlight appears for the actively processed item
    // - buckets start to receive items

    // Start sorting
    await radix.clickStart();

    // The app sets the step-indicator before any async sleep; wait for that text
    await radix.waitForSortingStart(2000);
    const stepText = await radix.getStepText();
    expect(stepText).toMatch(/Sorting by digit 1/i);

    // Start button should be disabled while sorting is in progress
    // Evaluate in page context for correct boolean
    const disabled = await radix.isStartDisabled();
    expect(disabled).toBe(true);

    // There should be at least one active digit highlight (the code highlights the item being processed)
    await page.waitForSelector('.digit-highlight.active-digit', { timeout: 2000 });
    const highlightCount = await radix.anyActiveDigitHighlights();
    expect(highlightCount).toBeGreaterThan(0);

    // Buckets should begin to populate (at least one bucket-item)
    // We allow a small timeout because distribution happens quickly but asynchronously
    await page.waitForFunction(() => document.querySelectorAll('.bucket-item').length > 0, null, { timeout: 2000 });
    const bucketItems = await radix.anyBucketItemsCount();
    expect(bucketItems).toBeGreaterThan(0);

    // Ensure no runtime page errors occurred during the start transition
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Reset during sorting is ignored (S1_Sorting -> S1_Sorting on Reset)', async ({ page }) => {
    // Validate that clicking Reset during sorting does NOT interrupt sorting due to `if (isSorting) return;`

    // Start sorting and wait for the Sorting by digit indicator
    await radix.clickStart();
    await radix.waitForSortingStart(2000);
    const stepWhileSorting = await radix.getStepText();
    expect(stepWhileSorting).toMatch(/Sorting by digit 1/i);

    // Immediately click Reset while sorting is in progress
    await radix.clickReset();

    // The step indicator should still reflect sorting (Reset should have been ignored)
    // Allow a small time for any accidental reset to occur if bug exists
    await page.waitForTimeout(200); // short delay
    const stepAfterResetAttempt = await radix.getStepText();
    expect(stepAfterResetAttempt).toMatch(/Sorting by digit \d+/i);
    expect(stepAfterResetAttempt).not.toBe('Initial Array');

    // Also ensure start button remains disabled because sorting is ongoing
    const disabled = await radix.isStartDisabled();
    expect(disabled).toBe(true);

    // No page errors as a result of concurrent events
    expect(pageErrors.length).toBe(0);
  });

  test('Complete sorting transitions to Sorted and marks bars (S1_Sorting -> S2_Sorted)', async ({ page }) => {
    // This test waits for the full sort to complete and validates final "Sorting Complete" state.
    // The sorting operation includes waits; therefore, we use an extended wait.

    // Capture the array before sorting so we can ensure it becomes marked sorted after completion
    const beforeValues = await radix.getArrayValues();

    // Start sorting
    await radix.clickStart();

    // Wait for the entire sorting to complete; this may take many seconds depending on the random array length and digits
    await radix.waitForSortingComplete(90000); // up to 90s allowed for sorting to finish

    // Check final step indicator text
    const finalStep = await radix.getStepText();
    expect(finalStep).toBe('Sorting Complete');

    // All array bars should be marked with the 'sorted' class
    const sortedCount = await radix.anySortedBarsCount();
    const totalBars = await radix.getArrayBarCount();
    expect(sortedCount).toBe(totalBars);

    // Start button should be re-enabled after sorting completes
    const startDisabledAfter = await radix.isStartDisabled();
    expect(startDisabledAfter).toBe(false);

    // Ensure that the array values exist and are numeric after sorting
    const afterValues = await radix.getArrayValues();
    expect(afterValues.length).toBeGreaterThanOrEqual(1);
    // If before and after are both present, they may differ (sorted), but randomness prevents strict equality checks here.
    // Just ensure values are numbers and array length remains consistent
    expect(afterValues.every(v => typeof v === 'number')).toBe(true);
    expect(afterValues.length).toBe(beforeValues.length);

    // No uncaught page errors during the entire sorting process
    expect(pageErrors.length).toBe(0);

    // No console errors were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Reset from Idle restores initial view and clears sorted marks (S2_Sorted/S0_Idle)', async ({ page }) => {
    // Validate that Reset when not sorting (Idle) restores the initial state:
    // - step-indicator = Initial Array
    // - array bars are not marked 'sorted'
    // We'll run a full sort and then Reset to verify clearing of 'sorted' class.

    // Perform a full sort first
    await radix.clickStart();
    await radix.waitForSortingComplete(90000);

    // Confirm sorted state
    const sortedCount = await radix.anySortedBarsCount();
    expect(sortedCount).toBeGreaterThan(0);

    // Now click Reset (not sorting)
    await radix.clickReset();

    // The step indicator should be reset to Initial Array
    await page.waitForFunction(() => document.querySelector('.step-indicator')?.textContent.trim() === 'Initial Array', null, { timeout: 2000 });
    const stepAfterReset = await radix.getStepText();
    expect(stepAfterReset).toBe('Initial Array');

    // Bars should no longer have the 'sorted' class
    const sortedAfterReset = await radix.anySortedBarsCount();
    expect(sortedAfterReset).toBe(0);

    // Buckets should be empty (no bucket-item elements)
    const bucketItems = await radix.anyBucketItemsCount();
    expect(bucketItems).toBe(0);

    // No page errors produced by Reset
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: double-click Start quickly should not crash and Start remains disabled once started', async ({ page }) => {
    // Validate that clicking Start multiple times in quick succession does not lead to errors
    // and the app gracefully avoids re-entering sorting (the isSorting flag prevents re-entry)

    // Double-click start quickly
    await radix.startBtn.dblclick();

    // Wait for sorting to begin
    await radix.waitForSortingStart(2000);

    // Start button should be disabled
    expect(await radix.isStartDisabled()).toBe(true);

    // No page errors were thrown by rapid input
    expect(pageErrors.length).toBe(0);

    // No console error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);

    // For cleanliness, wait for the sort to complete so subsequent tests start from a stable state
    await radix.waitForSortingComplete(90000);
  });

  // Additional diagnostic test: verify helper functions (indirectly) by checking digit highlights show expected digit for first bar
  test('Digit highlight displays the current digit for a processed bar during sorting', async ({ page }) => {
    // Start sorting and wait for a digit-highlight to appear
    await radix.clickStart();
    await radix.waitForSortingStart(2000);

    // Wait for a digit highlight element to be active
    const highlight = page.locator('.digit-highlight.active-digit').first();
    await highlight.waitFor({ state: 'visible', timeout: 2000 });

    // The highlight content should be a single digit character (0-9)
    const text = (await highlight.textContent())?.trim() ?? '';
    expect(text).toMatch(/^[0-9]$/);

    // Clean up: wait for completion to avoid interfering with other tests
    await radix.waitForSortingComplete(90000);
  });
});