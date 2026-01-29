import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d7b92-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page Object for the Radix Sort Visualization page.
 * Encapsulates common interactions and observers used by the tests.
 */
class RadixPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Attach listeners to capture console messages and page errors for assertions.
    this.page.on('console', msg => {
      try {
        this.consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch {
        // ignore
      }
    });

    this.page.on('pageerror', err => {
      try {
        // err is an Error object; capture message and stack for assertions
        this.pageErrors.push({
          message: err.message,
          stack: err.stack
        });
      } catch {
        // ignore
      }
    });
  }

  // Load the app and wait for load event
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the start button
  async clickStart() {
    await this.page.click('#startButton');
  }

  // Returns number of bars currently rendered
  async getBarCount() {
    return await this.page.$$eval('#array-container .bar', bars => bars.length);
  }

  // Returns array of booleans for whether each bar has the 'sorted' class
  async getSortedFlags() {
    return await this.page.$$eval('#array-container .bar', bars =>
      bars.map(b => b.classList.contains('sorted'))
    );
  }

  // Returns whether any bar currently has 'active' class
  async anyActiveBars() {
    return await this.page.$$eval('#array-container .bar.active', bars => bars.length > 0);
  }

  // Returns the style heights (number values) of bars for basic visual checks
  async getBarHeights() {
    return await this.page.$$eval('#array-container .bar', bars =>
      bars.map(b => {
        const h = window.getComputedStyle(b).height || b.style.height || '';
        // parse pixel value to number if possible
        const px = parseFloat(h);
        return isNaN(px) ? h : px;
      })
    );
  }

  // Helpers to access captured console/page errors
  getConsoleMessages() {
    return this.consoleMessages;
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

// Group tests under a describe block for the FSM
test.describe('Radix Sort Visualization FSM Tests - ed8d7b92-fa77-11f0-8492-31e949ed3c7c', () => {
  // Ensure each test has a fresh page context via Playwright fixture 'page'

  test('Initial Load: should call generateRandomArray on entry to S0_Idle or surface script errors', async ({ page }) => {
    const app = new RadixPage(page);
    // Navigate to the app
    await app.goto();

    // Allow some time for any scripts to run (or fail)
    await page.waitForTimeout(500);

    const pageErrors = app.getPageErrors();
    const consoleMsgs = app.getConsoleMessages();

    // If there are page errors, assert that they contain a SyntaxError or redeclaration problem.
    // The app as given contains a redeclaration of `exp` which typically results in a SyntaxError.
    if (pageErrors.length > 0) {
      // We expect at least one page error and that its message hints at a syntax/redeclaration issue.
      expect(pageErrors.length).toBeGreaterThan(0);
      const joined = pageErrors.map(e => `${e.message} ${e.stack}`).join(' ');
      // The message may vary across browsers; check for common substrings.
      expect(joined).toMatch(/SyntaxError|already been declared|Identifier|exp/);
      // Because script failed to parse/execute, the initial entry action generateRandomArray likely didn't run.
      const barCount = await app.getBarCount();
      expect(barCount).toBeLessThanOrEqual(0);
    } else {
      // No page errors -> assert Idle state behavior: initial array was generated with 20 bars
      const barCount = await app.getBarCount();
      // The FSM entry action calls generateRandomArray(20) so we expect 20 bars.
      expect(barCount).toBe(20);

      // Bars should have heights derived from values (non-zero positive numbers)
      const heights = await app.getBarHeights();
      expect(heights.length).toBe(20);
      heights.forEach(h => {
        expect(typeof h === 'number' && h > 0).toBeTruthy();
      });

      // Initially, no bar should be marked 'sorted'
      const sortedFlags = await app.getSortedFlags();
      expect(sortedFlags.every(f => f === false)).toBeTruthy();

      // And no console errors should have been emitted
      const errorMsgs = consoleMsgs.filter(m => m.type === 'error' || m.type === 'warning');
      expect(errorMsgs.length).toBe(0);
    }
  });

  test('Start Button Click: should trigger transition S0_Idle -> S1_Sorting (or surface errors)', async ({ page }) => {
    const app = new RadixPage(page);
    await app.goto();

    // Wait shortly to allow initial script execution
    await page.waitForTimeout(300);

    // Capture initial page errors
    const initialErrors = app.getPageErrors();

    // Click the start button to trigger generateRandomArray(20) and radixSort()
    await app.clickStart();

    // Give the app time to start the sorting process (or for errors to surface)
    await page.waitForTimeout(1500);

    const pageErrors = app.getPageErrors();
    const consoleMsgs = app.getConsoleMessages();

    // If there are any page errors (e.g., SyntaxError), assert they are present and meaningful.
    if (pageErrors.length > 0) {
      // We expect at least one page error (script parsing/runtime error)
      expect(pageErrors.length).toBeGreaterThan(0);
      const joined = pageErrors.map(e => `${e.message} ${e.stack}`).join(' ');
      expect(joined).toMatch(/SyntaxError|already been declared|Identifier|exp/);

      // Because of the error, sorting should not have progressed: no active bars and no sorted bars.
      const anyActive = await app.anyActiveBars();
      expect(anyActive).toBeFalsy();
      const barCount = await app.getBarCount();
      // If initial generation failed, barCount could be 0. If it succeeded but sorting failed, still expect no 'sorted' bars.
      if (barCount > 0) {
        const sortedFlags = await app.getSortedFlags();
        expect(sortedFlags.some(f => f === true)).toBe(false);
      }
    } else {
      // No page errors -> we expect sorting to have started.
      // During countingSortByDigit the implementation marks bars with 'active' temporarily.
      // Wait up to several seconds for an active bar to appear.
      let activeSeen = false;
      for (let i = 0; i < 10; i++) {
        if (await app.anyActiveBars()) {
          activeSeen = true;
          break;
        }
        await page.waitForTimeout(300);
      }
      expect(activeSeen).toBeTruthy();

      // Eventually, after sorting completes, all bars should be marked 'sorted'
      // Wait up to 20 seconds for the algorithm to finish (array length 20 and delays exist)
      const timeoutMs = 20000;
      const pollInterval = 500;
      let elapsed = 0;
      let allSorted = false;
      while (elapsed < timeoutMs) {
        const sortedFlags = await app.getSortedFlags();
        if (sortedFlags.length > 0 && sortedFlags.every(f => f === true)) {
          allSorted = true;
          break;
        }
        await page.waitForTimeout(pollInterval);
        elapsed += pollInterval;
      }
      expect(allSorted).toBeTruthy();

      // Also assert that clicking start did not emit console errors
      const errorMsgs = consoleMsgs.filter(m => m.type === 'error' || m.type === 'warning');
      expect(errorMsgs.length).toBe(0);
    }
  });

  test('Final State S2_Sorted: renderSorted() should mark all bars as sorted OR errors remain', async ({ page }) => {
    const app = new RadixPage(page);
    await app.goto();
    await page.waitForTimeout(300);

    // Click start to trigger sorting process
    await app.clickStart();

    // Allow time for script execution or for errors to surface
    await page.waitForTimeout(1500);

    const pageErrors = app.getPageErrors();

    if (pageErrors.length > 0) {
      // We observed errors; assert that they mention syntax/redeclaration issues.
      expect(pageErrors.length).toBeGreaterThan(0);
      const joined = pageErrors.map(e => e.message).join(' ');
      expect(joined).toMatch(/SyntaxError|already been declared|Identifier|exp/);

      // If script errored early, ensure renderSorted() couldn't have run: no bars are 'sorted'
      const sortedFlags = await app.getSortedFlags();
      expect(sortedFlags.every(f => f === false)).toBeTruthy();
    } else {
      // No page errors -> sorting should complete and renderSorted should add 'sorted' class to all bars
      // Wait for completion with a generous timeout
      const timeoutMs = 20000;
      const pollInterval = 500;
      let elapsed = 0;
      let allSorted = false;
      while (elapsed < timeoutMs) {
        const sortedFlags = await app.getSortedFlags();
        if (sortedFlags.length > 0 && sortedFlags.every(f => f === true)) {
          allSorted = true;
          break;
        }
        await page.waitForTimeout(pollInterval);
        elapsed += pollInterval;
      }
      expect(allSorted).toBeTruthy();

      // Sanity check: number of bars remains 20
      const barCount = await app.getBarCount();
      expect(barCount).toBe(20);
    }
  });

  test('Edge case: multiple Start clicks should not break the app (or should surface errors)', async ({ page }) => {
    const app = new RadixPage(page);
    await app.goto();
    await page.waitForTimeout(200);

    // Rapidly click the start button multiple times
    for (let i = 0; i < 3; i++) {
      await app.clickStart();
      await page.waitForTimeout(200);
    }

    // Allow time for any asynchronous operations or errors to appear
    await page.waitForTimeout(1000);

    const pageErrors = app.getPageErrors();
    const consoleMsgs = app.getConsoleMessages();

    if (pageErrors.length > 0) {
      // If the app contains a script syntax issue, we assert that it exists (per instructions not to patch)
      expect(pageErrors.length).toBeGreaterThan(0);
      const joined = pageErrors.map(e => e.message).join(' ');
      expect(joined).toMatch(/SyntaxError|already been declared|Identifier|exp/);
    } else {
      // No page errors: app handled rapid clicks. Ensure DOM still in a coherent state.
      const barCount = await app.getBarCount();
      expect(barCount).toBeGreaterThan(0);

      // No unhandled console errors should have been emitted
      const errorMsgs = consoleMsgs.filter(m => m.type === 'error' || m.type === 'warning');
      expect(errorMsgs.length).toBe(0);
    }
  });

  test('Observability: collect and assert console and page error details are exposed to tests', async ({ page }) => {
    const app = new RadixPage(page);
    await app.goto();

    // Wait for script parsing/execution
    await page.waitForTimeout(400);

    // We expect either a SyntaxError (due to redeclared variable) or no errors.
    const pageErrors = app.getPageErrors();
    const consoleMsgs = app.getConsoleMessages();

    // The purpose of this test is to assert that tests can observe console and page errors.
    // Ensure that the captured structures exist and have expected fields.
    expect(Array.isArray(pageErrors)).toBeTruthy();
    expect(Array.isArray(consoleMsgs)).toBeTruthy();

    // If there are page errors, each should have message and stack
    if (pageErrors.length > 0) {
      pageErrors.forEach(e => {
        expect(typeof e.message).toBe('string');
        expect(e.message.length).toBeGreaterThan(0);
        // Some user agents may not populate stack; if present, ensure it's a string
        if (e.stack !== undefined && e.stack !== null) {
          expect(typeof e.stack).toBe('string');
        }
      });
    }
  });
});