import { test, expect } from '@playwright/test';

// Test file for application: ed8d5483-fa77-11f0-8492-31e949ed3c7c
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/ed8d5483-fa77-11f0-8492-31e949ed3c7c.html
//
// This suite validates the FSM states and transitions for the Merge Sort Visualization app.
// It observes console messages and page errors (without modifying the page), triggers UI events,
// and asserts DOM/state changes that correspond to S0_Idle, S1_Sorting, and S2_Sorted.
//
// NOTE: The tests intentionally do not patch or change the application code. They only load the page,
// observe runtime behavior, and assert expected or observed errors/nol-errors.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d5483-fa77-11f0-8492-31e949ed3c7c.html';

class MergeSortPage {
  /**
   * Page object wrapper for the Merge Sort Visualization.
   * Collects console and page errors and provides helper actions/assertions.
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.consoleWarnings = [];
    this.consoleInfos = [];
    this.pageErrors = [];

    // Capture console messages and page errors for later assertions
    this.page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') this.consoleErrors.push(text);
      else if (type === 'warning') this.consoleWarnings.push(text);
      else this.consoleInfos.push({ type, text });
    });

    this.page.on('pageerror', (err) => {
      // pageerror produces Error objects
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getBars() {
    return this.page.$$('#visualization .bar');
  }

  // Returns numeric heights (as integers) extracted from inline style.height (e.g., "240px")
  async getBarHeights() {
    const bars = await this.getBars();
    const heights = [];
    for (const b of bars) {
      const h = await b.evaluate((el) => el.style.height || window.getComputedStyle(el).height);
      // parse px -> number
      const px = typeof h === 'string' && h.endsWith('px') ? parseFloat(h.replace('px', '')) : NaN;
      heights.push(px);
    }
    return heights;
  }

  async clickStart() {
    await this.page.click('.button');
  }

  async waitForAnyMerging({ timeout = 10000 } = {}) {
    // Wait for at least one element to gain the 'merging' class
    await this.page.waitForSelector('.bar.merging', { timeout });
  }

  async waitForAllSorted({ timeout = 60000 } = {}) {
    // Wait until each bar has the 'sorted' class.
    // The page adds 'sorted' to each existing bar after sorting completes.
    await this.page.waitForFunction(() => {
      const bars = document.querySelectorAll('#visualization .bar');
      if (!bars || bars.length === 0) return false;
      return Array.from(bars).every((b) => b.classList.contains('sorted'));
    }, null, { timeout });
  }

  getConsoleErrors() {
    return this.consoleErrors.slice();
  }

  getPageErrors() {
    return this.pageErrors.slice();
  }
}

test.describe('Merge Sort Visualization - FSM and UI integration tests', () => {
  // Group-level variables
  let page;
  let msPage;

  test.beforeEach(async ({ browser }) => {
    // create new context & page for each test to isolate console/page errors
    const context = await browser.newContext();
    page = await context.newPage();
    msPage = new MergeSortPage(page);
    await msPage.goto();
  });

  test.afterEach(async () => {
    // Close page/context to free resources
    await page.close();

    // Note: we do not fail tests here solely on console messages because individual tests
    // explicitly assert on the presence or absence of errors as required.
  });

  test('S0_Idle: On initial load the visualization is drawn with correct number of bars and heights', async () => {
    // This test validates the Idle state: drawBars(data) should run on entry and produce bars.
    // We expect 7 bars with heights equal to data * 4 px as per implementation.
    // Also ensure no runtime page errors (ReferenceError/SyntaxError/TypeError) occurred on load.

    // Verify number of bars
    const bars = await msPage.getBars();
    expect(bars.length).toBe(7);

    // Verify heights correspond to expected data values: [60,10,40,70,20,50,30] * 4
    const expectedData = [60, 10, 40, 70, 20, 50, 30];
    const heights = await msPage.getBarHeights();
    // Map expected to px
    const expectedHeights = expectedData.map((v) => v * 4);
    expect(heights).toEqual(expectedHeights);

    // Ensure there are ZERO page-level uncaught errors on load
    const pageErrors = msPage.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Ensure no console.error messages were logged during initial load
    const consoleErrors = msPage.getConsoleErrors();
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_Sorting: Clicking Start triggers sorting; intermediate merging highlights appear', async () => {
    // Validate transition Idle -> Sorting (StartSort event).
    // Clicking the button should start async merges. We assert that at least one merging highlight appears.
    // Then we also assert no unhandled exceptions occurred during the early phase.

    // Click the start button to trigger startSort()
    await msPage.clickStart();

    // Wait for some merging visual indicator to appear (merging class)
    // The implementation uses a 500ms delay in merge; allow reasonable timeout.
    await msPage.waitForAnyMerging({ timeout: 15000 });

    // At least one merging bar should be present
    const mergingBars = await page.$$('.bar.merging');
    expect(mergingBars.length).toBeGreaterThanOrEqual(1);

    // During sorting early phase, ensure no fatal page errors have been thrown yet
    expect(msPage.getPageErrors().length).toBe(0);

    // Also ensure no console.error messages so far
    expect(msPage.getConsoleErrors().length).toBe(0);
  });

  test('S2_Sorted: Sorting completes and all bars receive the sorted class; final drawBars(data) observed', async () => {
    // This test validates the Sorting -> Sorted transition.
    // It asserts that after sorting completes:
    // - All bars have class 'sorted'
    // - drawBars(data) was invoked at the end, which in this implementation re-draws the original dataset.
    //   Therefore final heights should match the initial heights (data * 4).
    // - No uncaught page errors occurred during the full sort process.

    // This operation can take multiple seconds due to many 500ms delays; increase timeout for this test.
    test.setTimeout(60000);

    // Capture initial heights for comparison after sort completes
    const initialHeights = await msPage.getBarHeights();

    // Start sorting
    await msPage.clickStart();

    // Wait until app marks all bars as sorted (S2_Sorted)
    await msPage.waitForAllSorted({ timeout: 45000 });

    // Verify that all bars have sorted class
    const sortedBars = await page.$$('#visualization .bar.sorted');
    expect(sortedBars.length).toBe(7);

    // Verify final heights match the initial heights because the app calls drawBars(data) at the end.
    const finalHeights = await msPage.getBarHeights();
    expect(finalHeights).toEqual(initialHeights);

    // Ensure there were no uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
    const pageErrors = msPage.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Ensure no console.error logs were emitted during the full sort
    const consoleErrors = msPage.getConsoleErrors();
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: clicking Start multiple times while sorting does not throw errors and ends in Sorted state', async () => {
    // This test triggers the StartSort event multiple times in quick succession to validate resilience.
    // We assert that no runtime exceptions are thrown, and the app still reaches the final Sorted state.

    // Increase timeout to allow sort to finish
    test.setTimeout(60000);

    // Start sorting, then click the button again a couple of times rapidly
    await msPage.clickStart();
    // Wait a short time to allow the first click to start async operation
    await page.waitForTimeout(200); // small delay; not altering app logic
    await msPage.clickStart();
    await page.waitForTimeout(200);
    await msPage.clickStart();

    // Ensure at least one merging indicator appears
    await msPage.waitForAnyMerging({ timeout: 15000 });

    // Wait for sorted state
    await msPage.waitForAllSorted({ timeout: 45000 });

    // Assert final sorted classes present
    const sortedBars = await page.$$('#visualization .bar.sorted');
    expect(sortedBars.length).toBe(7);

    // Assert no page errors occurred as a result of multiple clicks
    expect(msPage.getPageErrors().length).toBe(0);

    // Assert no console.error was emitted
    expect(msPage.getConsoleErrors().length).toBe(0);
  });

  test('Error observation test: collect and report any console or page errors (if they occur)', async () => {
    // This test intentionally collects page and console errors that might have occurred in previous operations.
    // It does not force errors, but asserts the observed arrays are available and are of the expected types.
    // If any errors are present, the test will fail to encourage investigation.

    // Trigger a load and a sort to surface potential runtime issues
    await msPage.clickStart();

    // Wait briefly for some activity
    await page.waitForTimeout(1000);

    // Inspect collected messages
    const consoleErrors = msPage.getConsoleErrors();
    const pageErrors = msPage.getPageErrors();

    // The intended behavior of this application is to run without uncaught ReferenceError/SyntaxError/TypeError.
    // Assert that nothing unexpected was thrown during usage.
    expect(consoleErrors).toBeInstanceOf(Array);
    expect(pageErrors).toBeInstanceOf(Array);

    // Fail if any actual errors were recorded
    expect(consoleErrors.length, `console.error messages found: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `page errors found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
  });
});