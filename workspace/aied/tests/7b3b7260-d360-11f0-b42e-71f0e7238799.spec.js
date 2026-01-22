import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3b7260-d360-11f0-b42e-71f0e7238799.html';

// Page object for interacting with the Quick Sort visualization page
class QuickSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages and page errors for assertions
    this.page.on('console', msg => {
      // Store text and type for later assertions
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', err => {
      // Uncaught exceptions land here
      this.pageErrors.push(err);
    });
  }

  // Navigate to the app URL and wait for initial load
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Get number of bars currently displayed in the array container
  async getBarCount() {
    return await this.page.evaluate(() => {
      return document.querySelectorAll('#arrayContainer .bar').length;
    });
  }

  // Get array of bar heights (string values like "120px")
  async getBarHeights() {
    return await this.page.evaluate(() => {
      return Array.from(document.querySelectorAll('#arrayContainer .bar')).map(b => b.style.height);
    });
  }

  // Click the start button to trigger quick sort
  async clickStart() {
    await this.page.click('#startButton');
  }

  // Wait until at least one bar height differs from the provided initialHeights
  // Returns true when a change is detected, throws on timeout
  async waitForAnyHeightChange(initialHeights, timeout = 10000) {
    await this.page.waitForFunction(
      (initial) => {
        const bars = Array.from(document.querySelectorAll('#arrayContainer .bar'));
        if (bars.length !== initial.length) return true;
        for (let i = 0; i < bars.length; i++) {
          if (bars[i].style.height !== initial[i]) return true;
        }
        return false;
      },
      initialHeights,
      { timeout }
    );
  }

  // Expose collected console messages
  getConsoleMessages() {
    return this.consoleMessages;
  }

  // Expose collected page errors (uncaught exceptions)
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Quick Sort Visualization FSM (Application ID: 7b3b7260-d360-11f0-b42e-71f0e7238799)', () => {
  let qsPage;

  // Setup before each test: create page object, navigate and ensure initial state loaded
  test.beforeEach(async ({ page }) => {
    qsPage = new QuickSortPage(page);
    await qsPage.goto();
    // Ensure the initial array generation (S0_Idle entry action generateArray) has executed
    // Wait for the arrayContainer to have bars rendered (defensive wait)
    await page.waitForSelector('#arrayContainer .bar', { timeout: 5000 });
  });

  test.afterEach(async () => {
    // After each test, assert there were no uncaught page errors unless the test explicitly expects them
    const errors = qsPage.getPageErrors();
    // Fail if there are uncaught exceptions
    expect(errors.length, `Expected no uncaught page errors, but found: ${errors.map(e => e.message).join('; ')}`).toBe(0);
  });

  test('S0_Idle: on page load generateArray() should run and display 20 bars', async () => {
    // This test validates the initial FSM state S0_Idle:
    // - generateArray() should have run on window.onload
    // - arrayContainer should contain arraySize (20) bars
    // - bars should have non-empty heights (visualization present)
    const barCount = await qsPage.getBarCount();
    expect(barCount).toBeGreaterThan(0); // basic sanity
    expect(barCount).toBe(20); // as defined by arraySize in the implementation

    const heights = await qsPage.getBarHeights();
    expect(Array.isArray(heights)).toBe(true);
    // Each height should be a non-empty string ending with 'px' and correspond to a positive numeric value
    for (const h of heights) {
      expect(typeof h).toBe('string');
      expect(h).toMatch(/^\d+px$/);
      const numeric = parseInt(h.replace('px', ''), 10);
      expect(numeric).toBeGreaterThan(0);
    }

    // Ensure no console errors were logged on load
    const consoleMsgs = qsPage.getConsoleMessages();
    const errorMsgs = consoleMsgs.filter(m => m.type === 'error');
    expect(errorMsgs.length).toBe(0);
  });

  test('Transition StartQuickSort: clicking Start Quick Sort triggers quickSort and updates display (S0_Idle -> S1_Sorting)', async () => {
    // This test validates the transition defined in the FSM:
    // - Clicking #startButton should trigger generateArray() and quickSort(array)
    // - The visualization should show changes (bars heights) as swaps occur
    const initialHeights = await qsPage.getBarHeights();
    expect(initialHeights.length).toBe(20);

    // Click the start button to transit to sorting
    await qsPage.clickStart();

    // Wait for at least one change in bar heights indicating sorting is in progress
    // quickSort uses delays on swap; allow sufficient timeout for first swap to happen
    await qsPage.waitForAnyHeightChange(initialHeights, 15000);

    // After a change, ensure bar count remains consistent
    const afterCount = await qsPage.getBarCount();
    expect(afterCount).toBe(20);

    const afterHeights = await qsPage.getBarHeights();
    // There should be at least one differing height compared to initial
    const anyDifferent = afterHeights.some((h, i) => h !== initialHeights[i]);
    expect(anyDifferent).toBe(true);

    // Ensure there are no uncaught errors logged during the sorting transition
    const errors = qsPage.getPageErrors();
    expect(errors.length).toBe(0);
  });

  test('Edge case: Clicking Start multiple times rapidly should not produce uncaught exceptions and UI remains consistent', async () => {
    // This edge-case test simulates rapid repeated user interaction (Start button spam)
    // - Should not produce uncaught exceptions
    // - The UI should still contain the expected number of bars
    const initialHeights = await qsPage.getBarHeights();
    expect(initialHeights.length).toBe(20);

    // Rapidly click start multiple times
    await Promise.all([
      qsPage.clickStart(),
      qsPage.clickStart(),
      qsPage.clickStart()
    ]);

    // Wait for a display change (sorting should progress even with multiple invocations)
    await qsPage.waitForAnyHeightChange(initialHeights, 20000);

    // Verify bar count is still stable
    const finalCount = await qsPage.getBarCount();
    expect(finalCount).toBe(20);

    // Verify at least some change happened
    const finalHeights = await qsPage.getBarHeights();
    const changed = finalHeights.some((h, i) => h !== initialHeights[i]);
    expect(changed).toBe(true);

    // Assert no uncaught page errors occurred during spamming
    const errors = qsPage.getPageErrors();
    expect(errors.length).toBe(0);
  });

  test('Behavioral assertions and monitoring: console and errors observation', async ({ page }) => {
    // This test demonstrates explicit capture of console messages and page errors.
    // It ensures the application does not log error-level console messages during normal operation.
    // We will click start once and then collect console messages for a short period.

    const initialConsoleCount = qsPage.getConsoleMessages().length;
    await qsPage.clickStart();

    // Wait briefly to allow some console messages (if any) to be emitted during sorting
    await page.waitForTimeout(1200);

    const consoleMessages = qsPage.getConsoleMessages().slice(initialConsoleCount);
    // There should be no error-level console logs in normal operation
    const errorLogs = consoleMessages.filter(m => m.type === 'error');
    expect(errorLogs.length).toBe(0);

    // Also ensure no uncaught exceptions
    const pageErrors = qsPage.getPageErrors();
    expect(pageErrors.length).toBe(0);
  });
});