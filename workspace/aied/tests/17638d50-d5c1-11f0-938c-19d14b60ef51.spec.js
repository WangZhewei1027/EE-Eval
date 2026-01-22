import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17638d50-d5c1-11f0-938c-19d14b60ef51.html';

/**
 * Page Object for the Insertion Sort Visualization page
 */
class InsertionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayContainer = '#array-container';
    this.startButtonSelector = "button[onclick='startInsertionSort()']";
    this.generateButtonSelector = "button[onclick='generateArray()']";
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async waitForInitialBars() {
    await this.page.waitForSelector(`${this.arrayContainer} .bar`);
  }

  async getBarsCount() {
    return await this.page.$$eval(`${this.arrayContainer} .bar`, bars => bars.length);
  }

  async getBarHeights() {
    return await this.page.$$eval(`${this.arrayContainer} .bar`, bars =>
      bars.map(b => {
        // style.height expected like "42px"
        const h = b.style.height || window.getComputedStyle(b).height;
        return parseInt(h, 10) || 0;
      })
    );
  }

  async clickStart() {
    await this.page.click(this.startButtonSelector);
  }

  async clickGenerate() {
    await this.page.click(this.generateButtonSelector);
  }

  async removeAllBarsAndClearArray() {
    // Intentionally do not redefine functions; interact only with DOM and globals as-is.
    await this.page.evaluate(() => {
      // Clear the container
      const container = document.getElementById('array-container');
      if (container) container.innerHTML = '';
      // Clear the array global if it exists
      if (typeof window.array !== 'undefined') {
        window.array = [];
      }
    });
  }

  async waitForNoHeightChange(timeout = 3000, pollInterval = 200) {
    // Wait until the bar heights stop changing for the specified timeout
    const end = Date.now() + timeout;
    let prev = await this.getBarHeights();
    while (Date.now() < end) {
      await this.page.waitForTimeout(pollInterval);
      const curr = await this.getBarHeights();
      if (prev.length === curr.length && curr.every((v, i) => v === prev[i])) {
        return; // stabilized
      }
      prev = curr;
    }
  }
}

test.describe('Insertion Sort Visualization - FSM states and transitions', () => {
  // Collect console error messages and page errors for each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore inspection errors
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      try {
        pageErrors.push(err && err.message ? err.message : String(err));
      } catch (e) {
        // ignore
      }
    });
  });

  test.afterEach(async () => {
    // Nothing extra to teardown; individual pages are closed by Playwright automatically
  });

  test('S0_Idle: On load the application generates an initial array (generateArray entry action)', async ({ page }) => {
    // This test validates the initial FSM state S0_Idle where generateArray() is called on entry.
    const app = new InsertionSortPage(page);
    await app.goto();

    // Wait for initial bars to appear as evidence of generateArray() being called
    await app.waitForInitialBars();

    // Assert there are 10 bars by default (as generateArray default size = 10)
    const count = await app.getBarsCount();
    expect(count).toBeGreaterThan(0);
    // Typical default is 10; assert at least reasonable number
    expect(count).toBeGreaterThanOrEqual(5);

    // Each bar should have a positive height value
    const heights = await app.getBarHeights();
    expect(heights.every(h => Number.isInteger(h) && h > 0)).toBeTruthy();

    // Verify no console error or page error happened during load
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('S0_Idle -> S0_Idle: Clicking "Generate New Array" produces a fresh set of bars', async ({ page }) => {
    // This test validates the GenerateNewArray event and the self-transition to Idle.
    const app = new InsertionSortPage(page);
    await app.goto();

    await app.waitForInitialBars();
    const beforeCount = await app.getBarsCount();
    const beforeHeights = await app.getBarHeights();

    // Click generate multiple times rapidly to test robustness and edge case handling
    const generateButton = app.generateButtonSelector;
    await page.click(generateButton);
    await page.click(generateButton);
    await page.click(generateButton);

    // Wait for bars to be re-rendered and stabilize
    await app.waitForNoHeightChange(2000, 150);

    const afterCount = await app.getBarsCount();
    const afterHeights = await app.getBarHeights();

    // Assert that we still have bars and count is reasonable
    expect(afterCount).toBeGreaterThanOrEqual(5);

    // Since the array is random, at least one height is expected to change after regeneration.
    // It's possible (rare) all values match; in that rare case the test will still pass as counts remain.
    const heightsChanged = beforeHeights.length !== afterHeights.length || afterHeights.some((h, i) => h !== beforeHeights[i]);
    expect(heightsChanged).toBeTruthy();

    // Ensure no console errors or page errors occurred during repeated generation
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('S0_Idle -> S1_Sorting: Clicking "Start Insertion Sort" updates bars to reflect sorting steps', async ({ page }) => {
    // This test validates the StartInsertionSort event and the transition to Sorting.
    const app = new InsertionSortPage(page);
    await app.goto();

    await app.waitForInitialBars();
    const beforeHeights = await app.getBarHeights();

    // Start the sorting process
    await app.clickStart();

    // Wait a short period to let some updates happen (the app has 200ms animation delay).
    // We ensure some progress occurs by checking heights after a bit of time.
    await page.waitForTimeout(1000);
    const midHeights = await app.getBarHeights();

    // At least some change in heights should be visible during the sort run.
    const changedDuringSort = midHeights.length !== beforeHeights.length || midHeights.some((h, i) => h !== beforeHeights[i]);
    expect(changedDuringSort).toBeTruthy();

    // Wait until heights stabilize which likely indicates sorting has finished or paused
    // Allow a generous timeout but keep tests reasonably fast
    await app.waitForNoHeightChange(5000, 300);

    // Final heights should be sorted in non-decreasing order (insertion sort sorts ascending)
    const finalHeights = await app.getBarHeights();
    const isSortedAsc = finalHeights.every((v, i, arr) => i === 0 || arr[i - 1] <= v);
    // Because the initial array could already be sorted, isSortedAsc being true is acceptable.
    expect(isSortedAsc).toBeTruthy();

    // Ensure no console errors or page errors occurred during sorting
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Edge case: Clicking "Start Insertion Sort" with an empty array should not throw errors', async ({ page }) => {
    // This test verifies handling of an empty array (edge case)
    const app = new InsertionSortPage(page);
    await app.goto();

    // Remove all bars and clear the global array variable if present
    await app.removeAllBarsAndClearArray();

    // Confirm there are no bars
    const count = await app.getBarsCount();
    expect(count).toBe(0);

    // Click start - the function should handle empty arrays gracefully
    await app.clickStart();

    // Wait briefly to see if any errors surface
    await page.waitForTimeout(500);

    // Expect no console or page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Edge case: Rapidly clicking "Start" multiple times does not produce uncaught exceptions', async ({ page }) => {
    // This test validates resilience when Start is clicked repeatedly in quick succession
    const app = new InsertionSortPage(page);
    await app.goto();

    await app.waitForInitialBars();

    // Rapid clicks
    await Promise.all([
      page.click(app.startButtonSelector),
      page.click(app.startButtonSelector),
      page.click(app.startButtonSelector),
      page.click(app.startButtonSelector)
    ]).catch(() => {
      // Some clicks may happen while the function is running. We do not intercept internal errors here.
    });

    // Give the page some time to process and stabilize
    await page.waitForTimeout(1500);
    await app.waitForNoHeightChange(3000, 200);

    // Expect no console errors or page errors from rapid interactions
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('UI components exist with expected labels and attributes (component detection evidence)', async ({ page }) => {
    // Verify that the buttons and array container exist and have expected text/structure
    const app = new InsertionSortPage(page);
    await app.goto();

    // Buttons exist
    const startBtn = await page.locator(app.startButtonSelector);
    const genBtn = await page.locator(app.generateButtonSelector);
    await expect(startBtn).toHaveCount(1);
    await expect(genBtn).toHaveCount(1);

    // Validate button text content
    await expect(startBtn).toHaveText('Start Insertion Sort');
    await expect(genBtn).toHaveText('Generate New Array');

    // Container exists
    await expect(page.locator('#array-container')).toHaveCount(1);

    // No errors emitted on initial UI inspection
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});