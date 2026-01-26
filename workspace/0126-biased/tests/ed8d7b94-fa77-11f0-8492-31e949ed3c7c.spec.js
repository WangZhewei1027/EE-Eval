import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d7b94-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the Tim Sort Visualization page
class TimSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.barsSelector = '#bars .bar';
    this.startButton = '.button';
    this.pageErrors = [];
    this.consoleMessages = [];
  }

  // Navigate to the page and set up listeners for console and page errors
  async goto() {
    // reset collections
    this.pageErrors = [];
    this.consoleMessages = [];

    // Attach listeners to capture console and page errors for assertions
    this.page.on('pageerror', (err) => {
      // Collect page errors (ReferenceError, TypeError, etc.)
      this.pageErrors.push(err);
    });

    this.page.on('console', (msg) => {
      // Collect console messages (info/warn/error)
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the Start Visualization button
  async clickStart() {
    await this.page.click(this.startButton);
  }

  // Count bars currently in the DOM
  async countBars() {
    return await this.page.$$eval(this.barsSelector, (bars) => bars.length);
  }

  // Get number of bars currently marked as sorted
  async countSortedBars() {
    return await this.page.$$eval(this.barsSelector, (bars) =>
      Array.from(bars).filter((b) => b.classList.contains('sorted')).length
    );
  }

  // Wait until at least 'n' bars have the 'sorted' class (timeout in ms)
  async waitForAtLeastSorted(n, timeout = 10000) {
    await this.page.waitForFunction(
      (selector, n) => {
        const bars = Array.from(document.querySelectorAll(selector));
        return bars.filter((b) => b.classList.contains('sorted')).length >= n;
      },
      this.barsSelector,
      n,
      { timeout }
    );
  }

  // Get heights of all bars (as numbers in px)
  async getBarHeights() {
    return await this.page.$$eval(this.barsSelector, (bars) =>
      bars.map((b) => {
        // computed style height includes "px"
        const h = window.getComputedStyle(b).height;
        return parseFloat(h);
      })
    );
  }

  // Helper to wait a short time (ms)
  async wait(ms) {
    await this.page.waitForTimeout(ms);
  }
}

test.describe('Tim Sort Visualization - FSM validation', () => {
  // Use a new page for each test via Playwright's page fixture
  test.beforeEach(async ({ page }) => {
    // nothing here; navigation happens in each test via TimSortPage.goto()
  });

  test.describe('Idle State (S0_Idle) validations', () => {
    test('Initial page renders with Start Visualization button and no bars (entry action renderPage expected)', async ({ page }) => {
      // This test validates the Idle state: button present and no bars rendered initially.
      const ts = new TimSortPage(page);
      await ts.goto();

      // The Start Visualization button (component) should be visible
      const startVisible = await page.isVisible(ts.startButton);
      expect(startVisible).toBeTruthy();

      // At Idle state, no bars should be present because createBars() is only called on start
      const barCount = await ts.countBars();
      expect(barCount).toBe(0);

      // Validate that no page runtime errors occurred on load (ReferenceError/SyntaxError/TypeError)
      // We assert that no page errors were emitted during load
      expect(ts.pageErrors.length, 'No page errors should have occurred on initial load').toBe(0);

      // Optionally, assert that there are no console.error messages emitted on load
      const consoleErrors = ts.consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages on initial load').toBe(0);
    });
  });

  test.describe('StartVisualization event and S1_Visualizing state', () => {
    test('Clicking Start Visualization creates 10 bars and begins sorting highlights (createBars onEnter)', async ({ page }) => {
      // This test validates the transition from Idle -> Visualizing:
      // - createBars() should create bars
      // - highlightSorted should start applying .sorted classes over time
      const ts = new TimSortPage(page);
      await ts.goto();

      // Click the start button to trigger StartVisualization
      await ts.clickStart();

      // Immediately after clicking, bars should be created (10 elements)
      // We give a short grace period for DOM updates
      await ts.page.waitForTimeout(100); // allow script to execute createBars()
      const barCount = await ts.countBars();
      expect(barCount).toBe(10);

      // First sorted bar should appear roughly after 800ms; wait up to 2s to be robust
      await ts.waitForAtLeastSorted(1, 2000);
      let sortedCount = await ts.countSortedBars();
      expect(sortedCount).toBeGreaterThanOrEqual(1);

      // Wait until all bars are marked sorted (the last timeout is 8000ms)
      // Use a timeout slightly above 9000ms to be safe
      await ts.waitForAtLeastSorted(10, 9500);
      sortedCount = await ts.countSortedBars();
      expect(sortedCount).toBe(10);

      // Validate the heights correspond to expected values array * 20px
      // Known array from implementation: [10,5,8,3,6,7,2,9,4,1]
      const expectedHeights = [10, 5, 8, 3, 6, 7, 2, 9, 4, 1].map((v) => v * 20);
      const barHeights = await ts.getBarHeights();
      // barHeights should have length 10 and match expectedHeights (allow small float differences)
      expect(barHeights.length).toBe(10);
      for (let i = 0; i < 10; i++) {
        expect(Math.abs(barHeights[i] - expectedHeights[i])).toBeLessThan(0.5);
      }

      // Check that no page errors occurred during the visualization run
      expect(ts.pageErrors.length, 'No runtime page errors during visualization').toBe(0);
      const consoleErrors = ts.consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages during visualization').toBe(0);
    });

    test('Clicking Start Visualization multiple times resets bars (createBars replaces existing bars)', async ({ page }) => {
      // This test verifies edge behavior when Start is clicked multiple times:
      // createBars() uses innerHTML = '', so subsequent clicks should recreate bars and remove .sorted classes.
      const ts = new TimSortPage(page);
      await ts.goto();

      // First click
      await ts.clickStart();
      await ts.page.waitForTimeout(100);
      await ts.waitForAtLeastSorted(1, 2000); // wait for first sorted to appear
      const sortedAfterFirst = await ts.countSortedBars();
      expect(sortedAfterFirst).toBeGreaterThanOrEqual(1);

      // Click start again while visualization is in progress
      await ts.clickStart();
      // Because createBars() replaces the innerHTML, sorted classes should be cleared right away.
      // Wait a short time for DOM to be replaced
      await ts.page.waitForTimeout(200);

      // After second click, there should still be 10 bars
      const barCountAfterSecond = await ts.countBars();
      expect(barCountAfterSecond).toBe(10);

      // And sorted count should be reset to 0 (since bars were recreated)
      const sortedAfterSecond = await ts.countSortedBars();
      expect(sortedAfterSecond).toBe(0);

      // Allow the sequence to progress again and ensure highlights start anew
      await ts.waitForAtLeastSorted(1, 2000);
      const sortedAfterRestart = await ts.countSortedBars();
      expect(sortedAfterRestart).toBeGreaterThanOrEqual(1);

      // Ensure again no page errors occurred
      expect(ts.pageErrors.length, 'No runtime errors during multiple clicks scenario').toBe(0);
    });

    test('Non-button clicks do not start visualization (no transition)', async ({ page }) => {
      // This test validates that clicking outside the button does not trigger the StartVisualization event.
      const ts = new TimSortPage(page);
      await ts.goto();

      // Click the container (but not the button)
      await page.click('#container');
      // Wait a bit to allow any accidental handlers to run
      await ts.page.waitForTimeout(300);

      // No bars should be created as we didn't click the .button
      const barCount = await ts.countBars();
      expect(barCount).toBe(0);

      // No page errors expected
      expect(ts.pageErrors.length).toBe(0);
    });
  });

  test.describe('FSM entry/exit actions and error observation', () => {
    test('Verify entry action createBars was invoked on visualization start (indirectly via DOM)', async ({ page }) => {
      // This test double-checks that the entry action "createBars()" for S1_Visualizing is performed.
      // We verify that after clicking the Start button, bar DOM elements are present (evidence of createBars).
      const ts = new TimSortPage(page);
      await ts.goto();

      // There is no explicit renderPage() function in the HTML; the FSM mentioned it as entry action for Idle.
      // Because the implementation does not define renderPage(), no error should be thrown on load and we assert lack of errors.
      expect(ts.pageErrors.length).toBe(0);

      // Trigger visualization
      await ts.clickStart();
      await ts.page.waitForTimeout(100);
      const bars = await ts.countBars();
      expect(bars).toBe(10);
    });

    test('Observe and assert that there are no unexpected runtime errors (ReferenceError/SyntaxError/TypeError)', async ({ page }) => {
      // This test collects page errors and console.error events and asserts that none of the unexpected error types occurred.
      const ts = new TimSortPage(page);
      await ts.goto();

      // Trigger the visualization to exercise code paths
      await ts.clickStart();

      // Wait for the full visualization duration to catch late runtime errors (a bit above 8s)
      await ts.wait(9500);

      // Collect any page errors captured by the listener
      const pageErrors = ts.pageErrors;

      // If any page errors occurred, include their messages in the expectation failure for clarity
      if (pageErrors.length > 0) {
        const messages = pageErrors.map((e) => e.message || String(e));
        // Fail the test with the aggregated messages
        expect(pageErrors.length, `No page errors expected. Found: ${messages.join(' | ')}`).toBe(0);
      } else {
        // No page errors observed
        expect(pageErrors.length).toBe(0);
      }

      // Also check console.error messages
      const consoleErrors = ts.consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages should have been logged').toBe(0);
    });
  });
});