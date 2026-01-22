import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3b4b50-d360-11f0-b42e-71f0e7238799.html';

/**
 * Page Object Model for the Insertion Sort Visualization page.
 * Encapsulates common DOM queries and small helpers to make tests readable.
 */
class InsertionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayContainer = '#array-container';
    this.startButton = '#start-button';
  }

  // Count number of bar elements rendered
  async countBars() {
    return this.page.$$eval(`${this.arrayContainer} .bar`, bars => bars.length);
  }

  // Get array of numeric heights (pixels -> number) from the rendered bars
  async getBarHeights() {
    return this.page.$$eval(`${this.arrayContainer} .bar`, bars =>
      bars.map(b => {
        const h = b.style.height || window.getComputedStyle(b).height || '0px';
        // parse float to handle "123px" etc.
        return parseFloat(h);
      })
    );
  }

  // Returns true if at least one height differs between two arrays
  static heightsDiffer(a, b) {
    if (!a || !b || a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return true;
    }
    return false;
  }

  // Click the start button
  async clickStart() {
    await this.page.click(this.startButton);
  }
}

test.describe('Insertion Sort Visualization - FSM tests', () => {
  // Collect console messages and page errors for each test to assert no silent failures
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages including errors/warnings
    page.on('console', msg => {
      // Record stringified message with its type for assertions and debugging
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture unhandled page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application (fresh load before each test)
    await page.goto(APP_URL);
    // Wait for a minimal initial render (array container present)
    await page.waitForSelector('#array-container');
  });

  test.afterEach(async () => {
    // After each test, assert there were no uncaught page errors
    // If pageErrors exist, include them in the assertion message to aid debugging
    expect(pageErrors, `Expected no uncaught page errors, but found: ${pageErrors.map(e => String(e)).join('; ')}`)
      .toHaveLength(0);

    // Also assert there were no console.error messages emitted
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages, `Expected no console.error messages, but found: ${errorConsoleMessages.map(m => m.text).join('; ')}`)
      .toHaveLength(0);
  });

  test('S0_Idle: Initial render shows an array of 20 bars (entry action renderArray(initialArray))', async ({ page }) => {
    /**
     * This test validates the Idle state (S0_Idle) entry action:
     * - On page load, renderArray(initialArray) should have rendered 20 bars
     * - Each bar should have a computed height > 0
     * - The start button must be visible and enabled
     */

    const p = new InsertionSortPage(page);

    const barCount = await p.countBars();
    expect(barCount).toBe(20); // FSM expects generateArray(20) and renderArray(initialArray)

    const heights = await p.getBarHeights();
    // Ensure each bar has a positive height (since generateArray returns numbers 0-99, height = value*3)
    expect(heights.length).toBe(20);
    for (const h of heights) {
      // Height may be 0 for value 0, but it's acceptable; however ensure style parsed
      expect(typeof h).toBe('number');
      expect(Number.isFinite(h)).toBeTruthy();
      expect(h).toBeGreaterThanOrEqual(0);
    }

    // Start button existence and enabled state
    const startButton = await page.$('#start-button');
    expect(startButton).not.toBeNull();
    const isDisabled = await startButton.getAttribute('disabled');
    expect(isDisabled).toBeNull(); // not disabled
  });

  test('Transition S0_Idle -> S1_Sorting: clicking start re-renders and begins sorting (renderArray(array); await insertionSort(array))', async ({ page }) => {
    /**
     * This test validates the transition from Idle to Sorting activated by StartSorting (click #start-button):
     * - Clicking the start button should render a new array immediately
     * - Subsequent renders should occur as the sorting proceeds (we sample heights over time)
     * - We do not wait for full completion (could be long); instead we assert that DOM changes happen indicating sorting started
     */

    const p = new InsertionSortPage(page);

    // Capture initial heights before clicking start
    const initialHeights = await p.getBarHeights();
    expect(initialHeights.length).toBe(20);

    // Click start to initiate the sorting process
    await p.clickStart();

    // Wait for a short while for the immediate renderArray(array) invoked on click to take effect.
    // Use a waitForFunction to detect that bar heights differ from the initial array.
    const heightsChanged = await page.waitForFunction(
      (selector, beforeHeights) => {
        const bars = Array.from(document.querySelectorAll(selector + ' .bar'));
        if (bars.length !== beforeHeights.length) return false;
        const current = bars.map(b => parseFloat(b.style.height || getComputedStyle(b).height || '0px'));
        // Return true if any element differs
        for (let i = 0; i < current.length; i++) {
          if (current[i] !== beforeHeights[i]) return true;
        }
        return false;
      },
      { timeout: 5000 }, // allow up to 5s for the immediate re-render to take place
      p.arrayContainer,
      initialHeights
    );
    expect(await heightsChanged.jsonValue()).toBeTruthy();

    // After clicking, sampling heights over a short interval to ensure sorting is actively changing the DOM.
    // We'll capture three snapshots spaced 250ms apart and assert that at least one change occurred between snapshots.
    const sample1 = await p.getBarHeights();
    await page.waitForTimeout(250);
    const sample2 = await p.getBarHeights();
    await page.waitForTimeout(250);
    const sample3 = await p.getBarHeights();

    const diff12 = InsertionSortPage.heightsDiffer(sample1, sample2);
    const diff23 = InsertionSortPage.heightsDiffer(sample2, sample3);

    // At least one of the intervals should show a change as sorting proceeds and renders frequently
    expect(diff12 || diff23).toBeTruthy();

    // Ensure bar count remains stable at 20 during the process
    const barCountDuring = await p.countBars();
    expect(barCountDuring).toBe(20);
  });

  test('Edge case: multiple rapid clicks of Start button should not produce uncaught exceptions', async ({ page }) => {
    /**
     * Edge case:
     * - Clicking the start button multiple times (rapidly) may queue multiple sorting runs.
     * - The application does not disable the button, so we ensure no uncaught errors are produced when doing so.
     */

    const p = new InsertionSortPage(page);

    // Click start rapidly several times
    await Promise.all([
      p.clickStart(),
      p.clickStart(),
      p.clickStart()
    ]);

    // Allow some time for the handlers to start and a few render cycles to occur
    await page.waitForTimeout(800);

    // Verify there are still 20 bars and that DOM is stable (no exceptions)
    const barCount = await p.countBars();
    expect(barCount).toBe(20);

    // Sampling heights to ensure that the DOM is being updated and didn't error out
    const heights = await p.getBarHeights();
    expect(heights.length).toBe(20);

    // No uncaught page errors or console.error will be asserted in afterEach
  });

  test('Behavior observation: ensure renderArray is called on initial load and on start click (visual evidence via DOM changes)', async ({ page }) => {
    /**
     * This test is explicitly intended to observe the onEnter actions (renderArray(initialArray))
     * and transition actions (renderArray(array)). Since we cannot spy on functions from the test,
     * we infer these calls by observing DOM changes:
     * - Initial render present on load
     * - A new render occurs immediately after clicking start
     */

    const p = new InsertionSortPage(page);

    // Initial heights snapshot
    const initial = await p.getBarHeights();

    // Click start and immediately capture the next snapshot via waitForFunction as in previous test
    await p.clickStart();

    const changed = await page.waitForFunction(
      (selector, beforeHeights) => {
        const bars = Array.from(document.querySelectorAll(selector + ' .bar'));
        if (bars.length !== beforeHeights.length) return false;
        const curr = bars.map(b => parseFloat(b.style.height || getComputedStyle(b).height || '0px'));
        for (let i = 0; i < curr.length; i++) {
          if (curr[i] !== beforeHeights[i]) return true;
        }
        return false;
      },
      { timeout: 5000 },
      p.arrayContainer,
      initial
    );
    expect(await changed.jsonValue()).toBeTruthy();
  });

  test('Robustness: ensure no ReferenceError / SyntaxError / TypeError were raised during page lifecycle', async ({ page }) => {
    /**
     * This test explicitly inspects captured page errors to assert none of the typical
     * runtime exception types were thrown during the test lifecycle.
     *
     * Note: pageErrors are asserted to be empty in afterEach, but we make an explicit assertion here too
     * with a helpful message showing any found errors and their types.
     */

    // No additional interactions; we only inspect the already captured pageErrors
    // (they are collected in the beforeEach listener). If any exist, fail and display names.
    expect(pageErrors.length, `Expected no runtime exceptions, but found: ${pageErrors.map(e => e.name + ': ' + e.message).join('; ')}`)
      .toBe(0);
  });
});