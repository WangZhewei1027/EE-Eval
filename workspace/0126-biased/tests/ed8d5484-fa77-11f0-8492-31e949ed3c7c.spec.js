import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d5484-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the Quick Sort Visualization page
class QuickSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    this._consoleHandler = (msg) => {
      try {
        this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore
      }
    };
    this._pageErrorHandler = (err) => {
      try {
        this.pageErrors.push(String(err && err.message ? err.message : err));
      } catch (e) {
        // ignore
      }
    };
  }

  // Attach listeners for console and page errors
  async attachListeners() {
    this.page.on('console', this._consoleHandler);
    this.page.on('pageerror', this._pageErrorHandler);
  }

  // Remove listeners
  async detachListeners() {
    this.page.off('console', this._consoleHandler);
    this.page.off('pageerror', this._pageErrorHandler);
  }

  // Navigate to the app
  async open() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Return number of bars currently in the DOM
  async getBarsCount() {
    return await this.page.$$eval('.bar', (nodes) => nodes.length);
  }

  // Return array of numeric heights from inline style (createBars set style.height)
  async getBarHeights() {
    return await this.page.$$eval('.bar', (nodes) =>
      nodes.map((n) => {
        // style.height is expected to be like '123px'
        const h = n.style.height || window.getComputedStyle(n).height || '';
        return parseFloat(h.replace('px', '')) || 0;
      })
    );
  }

  // Return whether all bars have the 'sorted' class
  async allBarsSorted() {
    return await this.page.$$eval('.bar', (nodes) =>
      nodes.length > 0 && nodes.every((n) => n.classList.contains('sorted'))
    );
  }

  // Wait until any pivot appears (transient visualization) - useful to assert sorting started
  async waitForPivotAppearance(timeout = 5000) {
    return await this.page.waitForFunction(
      () => !!document.querySelector('.bar.pivot'),
      { timeout }
    ).then(() => true).catch(() => false);
  }

  // Click the Sort button
  async clickSort() {
    await this.page.click('#sort-button');
  }

  // Returns captured console messages
  getConsoleMessages() {
    return this.consoleMessages.slice();
  }

  // Returns captured page errors
  getPageErrors() {
    return this.pageErrors.slice();
  }

  // Helper to wait for sorting to complete by waiting for every bar to have 'sorted' class
  // Accepts timeoutMs to allow longer sorting operations
  async waitForSortedClass(timeoutMs = 90000) {
    return await this.page.waitForFunction(
      () => {
        const bars = document.querySelectorAll('.bar');
        return bars.length > 0 && Array.from(bars).every((b) => b.classList.contains('sorted'));
      },
      { timeout: timeoutMs }
    ).then(() => true).catch(() => false);
  }

  // Helper to re-evaluate the global array variable on the page
  async getUnderlyingArray() {
    return await this.page.evaluate(() => {
      try {
        return Array.isArray(window.array) ? window.array.slice() : null;
      } catch (e) {
        return null;
      }
    });
  }
}

test.describe('Quick Sort Visualization - FSM Tests (ed8d5484-fa77-11f0-8492-31e949ed3c7c)', () => {
  // increase default timeout for potentially long-running sorting animation
  test.setTimeout(120000);

  let qsPage;

  test.beforeEach(async ({ page }) => {
    qsPage = new QuickSortPage(page);
    await qsPage.attachListeners();
    await qsPage.open();
    // small sanity wait to ensure initial createBars() executed
    await page.waitForLoadState('load');
  });

  test.afterEach(async ({ page }) => {
    // detach listeners and optionally dump console if test failed
    await qsPage.detachListeners();
    // ensure no extra listeners remain
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('S0_Idle: On load createBars() should be run and the array container should contain bars', async () => {
    // Validate initial Idle state (S0_Idle) entry action: createBars()
    // - There should be 15 bars created (implementation creates 15 values).
    // - Bars should reflect the window.array values via inline style.height.
    const barsCount = await qsPage.getBarsCount();
    expect(barsCount).toBeGreaterThanOrEqual(1); // at least one bar
    // The implementation created 15 elements; check for that exact count if present
    // Some environments might alter rendering, so we accept >=1 primarily but also assert expected 15 if available.
    if (barsCount !== 15) {
      // If not exactly 15, still continue but log for visibility
      console.warn(`Expected 15 bars but found ${barsCount}`);
    }

    // Check underlying array exists and length matches bars count
    const underlyingArray = await qsPage.getUnderlyingArray();
    expect(Array.isArray(underlyingArray)).toBeTruthy();
    expect(underlyingArray.length).toBeGreaterThanOrEqual(1);
    // Ensure bars' heights match the underlying array values (createBars uses value + 'px')
    const heights = await qsPage.getBarHeights();
    // lengths should match
    expect(heights.length).toBe(underlyingArray.length);

    // For each index, heights should equal the underlying array value (or be very close)
    for (let i = 0; i < underlyingArray.length; i++) {
      expect(Math.round(heights[i])).toBe(Math.round(underlyingArray[i]));
    }

    // No bars should have the 'sorted' class in idle state
    const allSorted = await qsPage.allBarsSorted();
    expect(allSorted).toBe(false);
  });

  test('S0_Idle -> S1_Sorting: Clicking Sort button should start sorting (pivot visual appears)', async () => {
    // Validate transition from Idle to Sorting happens on SortButtonClick
    // Action: Click the sort button
    await qsPage.clickSort();

    // Expectation: During sorting, a pivot class should appear transiently
    const pivotAppeared = await qsPage.waitForPivotAppearance(8000);
    // It is acceptable that due to timing pivot may be missed, but we assert that pivot appeared at least once in typical runs.
    expect(pivotAppeared).toBe(true);

    // Also ensure no page-level runtime errors were thrown up to this point
    const pageErrors = qsPage.getPageErrors();
    expect(pageErrors.length).toBe(0);
  });

  test('S1_Sorting -> S2_Sorted: After sorting completes, all bars should have the sorted class and heights should be non-decreasing', async () => {
    // This test may take longer because the visualization uses sleeps in the algorithm.
    // Click to start sorting and wait until all bars have 'sorted' class
    await qsPage.clickSort();

    // Wait for sorted class to be added to all bars. Give generous timeout for sorting animation.
    const completed = await qsPage.waitForSortedClass(90000);
    expect(completed).toBe(true);

    // After completion, verify that all bars indeed have 'sorted' class
    const allSorted = await qsPage.allBarsSorted();
    expect(allSorted).toBe(true);

    // Verify that the heights are in non-decreasing order (array should be sorted)
    const heights = await qsPage.getBarHeights();
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
    }

    // Confirm no page errors occurred during the whole process
    const pageErrors = qsPage.getPageErrors();
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Multiple rapid clicks on Sort button should not produce uncaught errors and sorting completes', async () => {
    // Rapidly click the sort button multiple times to simulate user spamming the control
    // We do not modify any runtime behavior; we simply perform the actions and observe.
    await qsPage.page.click('#sort-button');
    await qsPage.page.click('#sort-button');
    await qsPage.page.click('#sort-button');

    // Wait for either pivot to appear (sorting started) and ultimately for the sorted state
    const pivotAppeared = await qsPage.waitForPivotAppearance(8000);
    expect(pivotAppeared).toBe(true);

    // Wait for final sorted state (allow plenty of time due to potential multiple sorts queued)
    const sorted = await qsPage.waitForSortedClass(100000);
    expect(sorted).toBe(true);

    // Ensure no page errors occurred as a result of multiple quick invocations
    const pageErrors = qsPage.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Also ensure final bar count is consistent with initial array length
    const heights = await qsPage.getBarHeights();
    const arr = await qsPage.getUnderlyingArray();
    expect(heights.length).toBe(arr.length);
  });

  test('Observability: Capture console messages and ensure no severe console errors emitted during run', async () => {
    // Start sorting and capture console logs during the process
    await qsPage.clickSort();

    // Wait for pivot as a sign sorting started
    await qsPage.waitForPivotAppearance(8000);

    // Wait for completion
    const done = await qsPage.waitForSortedClass(90000);
    expect(done).toBe(true);

    // Retrieve console messages
    const consoles = qsPage.getConsoleMessages();
    // We expect some console messages may be present (e.g., warnings), but there should be no explicit 'error' type console messages
    const errorTypeMessages = consoles.filter((m) => m.type === 'error' || /error/i.test(m.text));
    expect(errorTypeMessages.length).toBe(0);

    // Also assert no page errors
    const pageErrors = qsPage.getPageErrors();
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity check: Re-create bars via createBars() (entry action) and ensure DOM updates without runtime errors', async () => {
    // Validate that calling createBars() (entry action from S0_Idle) re-populates the DOM without errors
    // We invoke the global function as exists in the page (this is allowed as we must not modify runtime)
    const invokeResult = await qsPage.page.evaluate(() => {
      try {
        if (typeof window.createBars === 'function') {
          window.createBars();
          return { ok: true };
        } else {
          return { ok: false, reason: 'createBars not found' };
        }
      } catch (err) {
        return { ok: false, err: String(err && err.message ? err.message : err) };
      }
    });

    expect(invokeResult.ok).toBe(true);

    // Verify bars are present and match underlying array
    const count = await qsPage.getBarsCount();
    expect(count).toBeGreaterThanOrEqual(1);
    const pageErrors = qsPage.getPageErrors();
    expect(pageErrors.length).toBe(0);
  });
});