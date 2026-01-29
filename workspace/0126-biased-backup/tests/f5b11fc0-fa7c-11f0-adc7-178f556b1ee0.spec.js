import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b11fc0-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the Ternary Search demo page
class TernarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#ternary-search-demo';
    // captured console and page errors
    this.consoleMessages = [];
    this.pageErrors = [];
    // handlers references so we can remove if needed
    this._consoleHandler = (msg) => {
      // capture string representation for assertions
      try {
        this.consoleMessages.push(msg.text());
      } catch {
        // best-effort capture
        this.consoleMessages.push(String(msg));
      }
    };
    this._pageErrorHandler = (err) => {
      this.pageErrors.push(err);
    };
  }

  async initListeners() {
    this.page.on('console', this._consoleHandler);
    this.page.on('pageerror', this._pageErrorHandler);
  }

  async clearCaptured() {
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  async goto() {
    await this.page.goto(APP_URL);
    await this.initListeners();
  }

  async getSearchButton() {
    return this.page.locator(this.buttonSelector);
  }

  async clickSearch() {
    await this.page.click(this.buttonSelector);
  }

  async waitForConsoleMessagesAtLeast(count, timeout = 2000) {
    const start = Date.now();
    while (this.consoleMessages.length < count) {
      if (Date.now() - start > timeout) break;
      // small sleep
      // eslint-disable-next-line no-await-in-loop
      await new Promise((r) => setTimeout(r, 50));
    }
  }

  async detachListeners() {
    this.page.removeListener('console', this._consoleHandler);
    this.page.removeListener('pageerror', this._pageErrorHandler);
  }
}

test.describe('Ternary Search demo - FSM tests', () => {
  // Use a fresh page for each test
  test.beforeEach(async ({ page }) => {
    // nothing here; each test will instantiate page object and navigate
  });

  test.afterEach(async ({ page }) => {
    // ensure the page's lifecycle finishes
    try {
      // Attempt to close page listeners if any left
      page.removeAllListeners('console');
      page.removeAllListeners('pageerror');
    } catch {
      // ignore errors during teardown
    }
  });

  test('Idle state: page loads and initial UI is rendered (button present)', async ({ page }) => {
    // This test validates the S0_Idle state:
    // - The page loads successfully
    // - The "Search" button exists and is visible
    // - No uncaught page errors occur on initial render
    const demo = new TernarySearchPage(page);
    await demo.goto();

    // Verify the Search button exists and has correct text
    const button = await demo.getSearchButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Search');

    // On initial load we do not expect any console logs from the demo script.
    // Wait briefly to capture any synchronous console messages if present.
    await demo.waitForConsoleMessagesAtLeast(0, 200);

    // Assert that there are no uncaught page errors on initial rendering
    expect(demo.pageErrors.length).toBe(0);

    // Clean up listeners for this page object
    await demo.detachListeners();
  });

  test('Transition SearchClick: clicking Search triggers searchTernarySearch logs', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Searching:
    // - Clicking the #ternary-search-demo button executes searchTernarySearch (entry action)
    // - Console logs for left/middle/right halves are emitted
    // - Console log indicating target found in middle part is emitted
    const demo = new TernarySearchPage(page);
    await demo.goto();
    await demo.clearCaptured();

    // Click the button once and wait for expected console output
    await demo.clickSearch();

    // The implementation logs at least 4 console messages:
    // "Left half:", "Middle part:", "Right half:", and "Target element found in middle part:"
    await demo.waitForConsoleMessagesAtLeast(4, 2000);

    // Basic assertions on console messages content
    const logs = demo.consoleMessages.join('\n');

    // Assert left half log present and contains the expected items 1,2,3,4
    expect(logs).toContain('Left half:');
    expect(logs).toMatch(/1\s*,\s*2\s*,\s*3\s*,\s*4/);

    // Assert middle part log present and contains the expected items 5,6,7,8,9
    expect(logs).toContain('Middle part:');
    expect(logs).toMatch(/5\s*,\s*6\s*,\s*7\s*,\s*8\s*,\s*9/);

    // Assert right half log present and contains the expected items 6,7,8,9
    expect(logs).toContain('Right half:');
    expect(logs).toMatch(/6\s*,\s*7\s*,\s*8\s*,\s*9/);

    // Assert that the search found the target in the middle part
    // The implementation logs "Target element found in middle part:" when it finds the target
    expect(logs).toContain('Target element found in middle part:');

    // Verify that there were no uncaught page errors during the click/processing
    expect(demo.pageErrors.length).toBe(0);

    await demo.detachListeners();
  });

  test('Edge case: multiple rapid clicks produce repeated logs (idempotent behavior)', async ({ page }) => {
    // This test validates clicking the button multiple times and ensures that
    // each invocation runs the search and emits logs (no state corruption or exceptions).
    const demo = new TernarySearchPage(page);
    await demo.goto();
    await demo.clearCaptured();

    // Perform 3 rapid clicks
    await Promise.all([
      demo.clickSearch(),
      demo.clickSearch(),
      demo.clickSearch(),
    ]);

    // Expect at least 3 sets of logs (>= 12 console messages if each click emits 4 logs)
    await demo.waitForConsoleMessagesAtLeast(12, 3000);

    // Basic sanity: ensure we have repeated occurrences of the "Left half:" marker
    const occurrencesLeft = demo.consoleMessages.filter((m) => m.includes('Left half:')).length;
    expect(occurrencesLeft).toBeGreaterThanOrEqual(3);

    // Ensure no uncaught exceptions were thrown during rapid invocation
    expect(demo.pageErrors.length).toBe(0);

    await demo.detachListeners();
  });

  test('Validation: event handler is correctly attached to the button (evidence of listener)', async ({ page }) => {
    // This test uses in-page evaluation to confirm that the element exists and has an "addEventListener" bound
    // We do this by asserting that clicking triggers expected effects (since we cannot introspect listeners reliably).
    const demo = new TernarySearchPage(page);
    await demo.goto();
    await demo.clearCaptured();

    // Confirm the DOM element exists
    const hasElement = await page.evaluate(() => !!document.getElementById('ternary-search-demo'));
    expect(hasElement).toBe(true);

    // Click to produce logs and confirm handler runs
    await demo.clickSearch();
    await demo.waitForConsoleMessagesAtLeast(4, 2000);

    expect(demo.consoleMessages.some((m) => m.includes('Left half:'))).toBe(true);
    expect(demo.pageErrors.length).toBe(0);

    await demo.detachListeners();
  });

  test('Error observation: assert no ReferenceError/SyntaxError/TypeError occurred during tests', async ({ page }) => {
    // This test explicitly inspects pageerror events collected during a normal interaction
    // and asserts that they are absent. We observe errors naturally (do not patch or modify runtime).
    const demo = new TernarySearchPage(page);
    await demo.goto();
    await demo.clearCaptured();

    // Trigger demo to maximize chance of runtime issues being surfaced
    await demo.clickSearch();
    await demo.waitForConsoleMessagesAtLeast(4, 2000);

    // If any page errors are present, report them as test failure with details
    if (demo.pageErrors.length > 0) {
      // Build a helpful assertion message listing the error types and messages
      const errorSummaries = demo.pageErrors.map((e) => {
        try {
          return `${e.name}: ${e.message}`;
        } catch {
          return String(e);
        }
      }).join(' | ');
      // Fail test explicitly while providing captured errors
      expect(demo.pageErrors.length, `Unexpected page errors occurred: ${errorSummaries}`).toBe(0);
    } else {
      // No errors observed — assert explicitly
      expect(demo.pageErrors.length).toBe(0);
    }

    await demo.detachListeners();
  });
});