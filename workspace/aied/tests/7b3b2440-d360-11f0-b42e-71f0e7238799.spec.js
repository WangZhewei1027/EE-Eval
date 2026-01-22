import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3b2440-d360-11f0-b42e-71f0e7238799.html';

// Page Object for the Bubble Sort page
class BubbleSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayContainer = '#array-container';
    this.startButton = '#start-sort';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getBars() {
    return this.page.$$(this.arrayContainer + ' .bar');
  }

  async getBarCount() {
    const bars = await this.getBars();
    return bars.length;
  }

  // Returns array of numeric heights (px -> number)
  async getBarHeights() {
    const heights = await this.page.$$eval(this.arrayContainer + ' .bar', (nodes) =>
      nodes.map(n => {
        // inline style like "150px"
        const h = n.style.height || window.getComputedStyle(n).height || '';
        return parseFloat(h) || 0;
      })
    );
    return heights;
  }

  async clickStart() {
    await this.page.click(this.startButton);
  }

  // Wait until at least one bar has the 'sorting' class
  async waitForSortingStart(timeout = 3000) {
    await this.page.waitForFunction(() => {
      return document.querySelectorAll('.bar.sorting').length > 0;
    }, null, { timeout });
  }

  // Wait until there are no bars with the 'sorting' class for a sustained period
  async waitForSortingToStabilize(quietPeriodMs = 600, overallTimeout = 20000) {
    // Wait for no '.bar.sorting', and ensure it stays gone for quietPeriodMs
    const start = Date.now();
    while (Date.now() - start < overallTimeout) {
      const anySorting = await this.page.$eval('body', () => !!document.querySelector('.bar.sorting'));
      if (!anySorting) {
        // ensure quiet period
        await this.page.waitForTimeout(quietPeriodMs);
        const stillSorting = await this.page.$eval('body', () => !!document.querySelector('.bar.sorting'));
        if (!stillSorting) return;
      }
      await this.page.waitForTimeout(100);
    }
    throw new Error('Sorting did not stabilize within timeout');
  }
}

test.describe('Bubble Sort Animation (FSM: Idle -> Sorting)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors and console messages for assertions
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.afterEach(async () => {
    // Basic sanity: ensure our collections are arrays
    expect(Array.isArray(pageErrors)).toBe(true);
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('S0_Idle: initial render occurs on load and displays 10 bars', async ({ page }) => {
    // Validate the Idle state entry action: renderArray(initialArray) is executed on load.
    const app = new BubbleSortPage(page);
    await app.goto();

    // Check that the DOM has 10 bars rendered as a result of initialArray and renderArray(initialArray)
    const barCount = await app.getBarCount();
    expect(barCount).toBe(10);

    // Ensure each bar has a non-zero height
    const heights = await app.getBarHeights();
    expect(heights.length).toBe(10);
    for (const h of heights) {
      expect(h).toBeGreaterThan(0);
    }

    // Ensure none are in 'sorting' state at initial idle
    const sortingCount = await page.$$eval('.bar.sorting', nodes => nodes.length);
    expect(sortingCount).toBe(0);

    // Assert there were no page runtime errors on initial load
    expect(pageErrors.length).toBe(0);
  });

  test('StartSort event transitions to S1_Sorting and sorting animation starts', async ({ page }) => {
    // Validate the StartSort event (click #start-sort) causes:
    // - generation and rendering of a (new) array
    // - bubbleSort starts and visual sorting indicators appear

    const app = new BubbleSortPage(page);
    await app.goto();

    // Capture heights before clicking to later assert they change as sorting proceeds
    const beforeHeights = await app.getBarHeights();
    expect(beforeHeights.length).toBe(10);

    // Click start to trigger transition S0_Idle -> S1_Sorting
    await app.clickStart();

    // After click, there should be a (re)rendered set of bars (10)
    const afterClickCount = await app.getBarCount();
    expect(afterClickCount).toBe(10);

    // Wait for sorting visual to start: at least one bar gains 'sorting' class
    await app.waitForSortingStart(5000);

    const sortingNow = await page.$$eval('.bar.sorting', nodes => nodes.length);
    expect(sortingNow).toBeGreaterThan(0);

    // While sorting is happening, ensure no page errors were thrown immediately after starting
    expect(pageErrors.length).toBe(0);

    // Wait for sorting to finish (stabilize). Bubble sort may take a few seconds; we wait up to 20s
    await app.waitForSortingToStabilize(600, 20000);

    // After sorting stabilizes, no bars should be marked as 'sorting'
    const sortingAfter = await page.$$eval('.bar.sorting', nodes => nodes.length);
    expect(sortingAfter).toBe(0);

    // Verify final bars are present and heights are non-decreasing (array is sorted ascending).
    // Note: Because bars heights are proportional to values, sorted ascending means heights non-decreasing.
    const finalHeights = await app.getBarHeights();
    expect(finalHeights.length).toBe(10);

    // Check non-decreasing order
    for (let i = 1; i < finalHeights.length; i++) {
      expect(finalHeights[i]).toBeGreaterThanOrEqual(finalHeights[i - 1]);
    }

    // Confirm no runtime errors surfaced during the sorting process
    expect(pageErrors.length).toBe(0);
  }, 30000); // extend timeout to allow sorting to complete

  test('Transition robustness: clicking Start multiple times does not throw and updates DOM', async ({ page }) => {
    // Edge case: user rapidly clicks Start multiple times. Ensure page remains stable (no uncaught errors)
    const app = new BubbleSortPage(page);
    await app.goto();

    // Rapidly click start multiple times
    await Promise.all([
      app.clickStart(),
      app.page.waitForTimeout(50).then(() => app.clickStart()),
      app.page.waitForTimeout(100).then(() => app.clickStart())
    ]);

    // There should be bars rendered (10)
    const count = await app.getBarCount();
    expect(count).toBe(10);

    // Wait briefly for sorting visuals; ensure the UI shows sorting or completes without uncaught errors
    try {
      await app.waitForSortingStart(3000);
    } catch (e) {
      // It's acceptable that the sorting visuals might be fleeting; we still assert no page errors
    }

    // Final assertion: no uncaught runtime exceptions resulted from multiple clicks
    expect(pageErrors.length).toBe(0);
  });

  test('Console and pageerror observation: capturing console messages and page errors', async ({ page }) => {
    // This test demonstrates that console and page errors are observed.
    const app = new BubbleSortPage(page);

    // Listen to events (already wired in beforeEach) and navigate
    await app.goto();

    // Perform a normal click to generate possible console output or errors
    await app.clickStart();

    // Allow some time for console messages and potential page errors to be emitted
    await page.waitForTimeout(1000);

    // Validate that our consoleMessages array captured entries (maybe zero, but must be an array)
    expect(Array.isArray(consoleMessages)).toBe(true);

    // If there are page errors, they will be exposed via pageErrors; assert that they are Error objects if present
    for (const err of pageErrors) {
      expect(err).toBeTruthy();
      // The pageerror payload should have a message property
      expect(typeof err.message === 'string' || typeof err.toString === 'string').toBe(true);
    }

    // We assert that no unexpected runtime errors occurred during this procedure
    expect(pageErrors.length).toBe(0);
  });
});