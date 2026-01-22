import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/1763b460-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object for the Heap Sort Visualization page
class HeapSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.generateButton = page.locator("button[onclick='generateArray()']");
    this.sortButton = page.locator("button[onclick='heapSort()']");
    this.container = page.locator('#arrayContainer');
    this.barLocator = this.container.locator('.bar');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickGenerate() {
    await this.generateButton.click();
  }

  async clickSort() {
    await this.sortButton.click();
  }

  async getBarCount() {
    return await this.barLocator.count();
  }

  // Returns array of numbers (from textContent of bars)
  async getBarValues() {
    const count = await this.getBarCount();
    const values = [];
    for (let i = 0; i < count; i++) {
      const t = await this.barLocator.nth(i).textContent();
      values.push(Number(t?.trim()));
    }
    return values;
  }

  // Returns an array of booleans indicating whether each bar has class 'sorted'
  async getSortedFlags() {
    const count = await this.getBarCount();
    const flags = [];
    for (let i = 0; i < count; i++) {
      flags.push(await this.barLocator.nth(i).evaluate(node => node.classList.contains('sorted')));
    }
    return flags;
  }
}

test.describe('Heap Sort Visualization (FSM validation)', () => {
  // Arrays to capture console messages and runtime errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', msg => {
      // store text along with type for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors (runtime errors)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page for each test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // detach listeners implicitly when the page closes; nothing to teardown explicitly here.
    // but keep references for debug if necessary
  });

  test('Initial Idle state: controls present and array container is empty', async ({ page }) => {
    // This test validates the S0_Idle (initial) state.
    // Checks that the Generate and Sort buttons exist and that the array container starts empty.
    const heap = new HeapSortPage(page);

    // Buttons should be visible and enabled
    await expect(heap.generateButton).toBeVisible();
    await expect(heap.sortButton).toBeVisible();

    // array container should exist
    await expect(heap.container).toBeVisible();

    // No bars should be present initially (array is empty)
    const count = await heap.getBarCount();
    expect(count).toBe(0);

    // There should be no runtime page errors on initial render
    expect(pageErrors.length).toBe(0);

    // Record that initial state evidence exists: the buttons markup is present in the DOM
    const generateHtml = await heap.generateButton.evaluate(node => node.outerHTML);
    const sortHtml = await heap.sortButton.evaluate(node => node.outerHTML);
    expect(generateHtml).toContain('generateArray()');
    expect(sortHtml).toContain('heapSort()');
  });

  test('Clicking Sort without generating an array triggers a runtime error (edge-case)', async ({ page }) => {
    // This test verifies the error scenario: clicking "Sort Array" in S0_Idle should exercise
    // the implementation's error handling (if any). Per the implementation, sorting an empty array
    // leads to attempting to access container.children[-1] and should produce a TypeError.
    const heap = new HeapSortPage(page);

    // Ensure initial state
    const initialCount = await heap.getBarCount();
    expect(initialCount).toBe(0);

    // Click Sort and wait for a pageerror to occur
    // Use waitForEvent to deterministically capture the thrown runtime error
    const [error] = await Promise.all([
      page.waitForEvent('pageerror', { timeout: 3000 }).catch(() => null),
      heap.clickSort()
    ]);

    // We expect an error to have occurred when sorting an empty array
    expect(error).not.toBeNull();
    // The error should be a TypeError related to reading properties of undefined (classList)
    expect(error).toBeInstanceOf(Error);
    // Check that the message mentions 'classList' or 'Cannot read properties' or 'reading'
    const msg = error.message || '';
    const expectedMarkers = ['classList', 'Cannot read', 'reading', 'of undefined'];
    const matches = expectedMarkers.some(m => msg.includes(m));
    expect(matches).toBeTruthy();

    // Confirm that the collected pageErrors array also recorded the event
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    expect(pageErrors[0].message).toContain(error.message);

    // Also check console for potential uncaught exception logs (optional)
    const errorConsole = consoleMessages.find(c => c.type === 'error') || null;
    // There may or may not be a console.error depending on the browser; assert at least one pageerror captured above
    expect(error).toBeTruthy();
  });

  test('Generate Array transitions to Array Generated state: bars are drawn', async ({ page }) => {
    // This test validates the S1_ArrayGenerated state by clicking Generate Array and ensuring
    // drawArray() populated the container with 10 bars having numeric labels and proper styles.
    const heap = new HeapSortPage(page);

    // Click Generate Array
    await heap.clickGenerate();

    // Wait for bars to be created
    await page.waitForFunction(() => {
      const c = document.getElementById('arrayContainer');
      return c && c.children && c.children.length === 10;
    }, { timeout: 2000 });

    const count = await heap.getBarCount();
    expect(count).toBe(10);

    // Validate each bar has expected properties (class 'bar', numeric text, height style)
    const values = await heap.getBarValues();
    expect(values.length).toBe(10);
    for (const v of values) {
      expect(Number.isFinite(v)).toBeTruthy();
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(100);
    }

    // Ensure no runtime errors happened during generate/draw
    expect(pageErrors.length).toBe(0);

    // Confirm at least one console message (optional) - e.g., no specific logs expected but we record them
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test('Sorting transitions to Sorting state and completes to Sorted state: array becomes sorted', async ({ page }) => {
    // This test validates the S2_Sorting -> S3_Sorted transitions.
    // Steps:
    // 1. Generate an array (S1)
    // 2. Click Sort (S2)
    // 3. Wait for sorting to finish and assert final array is in ascending order and that
    //    at least the last element (index n-1) has been marked with the "sorted" class.
    //    Also assert that no runtime errors were thrown during the normal sort process.

    // Increase timeout for sorting since implementation uses several 500ms delays
    test.setTimeout(60000);

    const heap = new HeapSortPage(page);

    // Generate array first
    await heap.clickGenerate();
    await page.waitForFunction(() => {
      const c = document.getElementById('arrayContainer');
      return c && c.children && c.children.length === 10;
    }, { timeout: 2000 });

    // Capture the initial generated values
    const beforeValues = await heap.getBarValues();
    expect(beforeValues.length).toBe(10);

    // Start sorting
    await heap.clickSort();

    // Wait for the final sorted condition:
    // The implementation performs drawArray() at the end; we will wait until the DOM values are non-decreasing.
    await page.waitForFunction(() => {
      const c = document.getElementById('arrayContainer');
      if (!c || c.children.length === 0) return false;
      const vals = Array.from(c.children).map(ch => Number(ch.textContent.trim()));
      if (vals.some(isNaN)) return false;
      for (let i = 1; i < vals.length; i++) {
        if (vals[i - 1] > vals[i]) return false;
      }
      return true;
    }, { timeout: 45000 });

    // Final values should be sorted ascending
    const afterValues = await heap.getBarValues();
    expect(afterValues.length).toBe(10);
    for (let i = 1; i < afterValues.length; i++) {
      expect(afterValues[i - 1]).toBeLessThanOrEqual(afterValues[i]);
    }

    // The implementation is expected (by FSM evidence) to add 'sorted' class to container.children[n - 1]
    // Verify that the last bar (index 9) has the 'sorted' class
    const sortedFlags = await heap.getSortedFlags();
    // There should be at least one 'sorted' flag true; specifically check last element if present
    expect(sortedFlags.length).toBe(10);
    const lastIsSorted = sortedFlags[sortedFlags.length - 1];
    expect(lastIsSorted).toBeTruthy();

    // During a normal sort (after generating array) we expect no runtime errors to have been thrown
    expect(pageErrors.length).toBe(0);

    // No console 'error' messages expected during normal sort
    const consoleErrors = consoleMessages.filter(c => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Multiple Generate clicks are handled and do not throw errors (edge-case)', async ({ page }) => {
    // This test checks the behavior of generating arrays repeatedly.
    // We do not assert that the two generated arrays must differ (randomness),
    // but we assert that calling Generate twice causes the DOM to be repopulated
    // (still contains 10 bars) and does not produce runtime errors.

    const heap = new HeapSortPage(page);

    // First generate
    await heap.clickGenerate();
    await page.waitForFunction(() => {
      const c = document.getElementById('arrayContainer');
      return c && c.children && c.children.length === 10;
    }, { timeout: 2000 });
    const firstValues = await heap.getBarValues();

    // Second generate
    await heap.clickGenerate();
    await page.waitForFunction(() => {
      const c = document.getElementById('arrayContainer');
      return c && c.children && c.children.length === 10;
    }, { timeout: 2000 });
    const secondValues = await heap.getBarValues();

    // Confirm both generations produced 10 bars
    expect(firstValues.length).toBe(10);
    expect(secondValues.length).toBe(10);

    // It's possible (though very unlikely) that the same sequence is generated twice.
    // We won't fail the test in that case, but we will assert that the DOM was valid after each generation.
    expect(pageErrors.length).toBe(0);

    // Ensure bars have numeric text content
    for (const v of secondValues) {
      expect(Number.isFinite(v)).toBeTruthy();
    }
  });

  test('Verify evidence of FSM entry/exit actions where possible (onEnter drawArray usage)', async ({ page }) => {
    // FSM mentions entry action renderPage() for initial state and drawArray() for ArrayGenerated state.
    // The implementation does not define renderPage(), so we ensure that:
    // - No renderPage call exists (cannot be called) but page remains functional.
    // - drawArray() was effectively used after generateArray() by observing the DOM update.

    const heap = new HeapSortPage(page);

    // Check that there is no global function named renderPage (implementation omission)
    // We don't modify page; simply evaluate if such a function exists.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage === 'function');
    // Implementation did not define renderPage, so this should be false.
    expect(hasRenderPage).toBeFalsy();

    // Now trigger generateArray which should call drawArray and populate DOM
    await heap.clickGenerate();
    await page.waitForFunction(() => {
      const c = document.getElementById('arrayContainer');
      return c && c.children.length === 10;
    }, { timeout: 2000 });

    // Confirm drawArray effect: DOM has bars with numeric text content
    const values = await heap.getBarValues();
    expect(values.length).toBe(10);
    expect(values.every(v => Number.isFinite(v))).toBeTruthy();

    // No page errors were produced by calling generateArray/drawArray
    expect(pageErrors.length).toBe(0);
  });
});