import { test, expect } from '@playwright/test';

//
// 52099511-fa76-11f0-a09b-87751f540fd8.spec.js
//
// Tests for the "Recursion Example" interactive application.
// - Verifies initial page state (Idle)
// - Observes console logs produced by the recursive function on page load
// - Tests the "Run Recursion" button triggers the expected recursion logs
// - Exercises edge cases (multiple rapid clicks)
// - Observes page errors and console messages without modifying the page
//
// Notes:
// - We do NOT patch or modify the page. We load it as-is and observe behavior.
// - The page itself invokes recursiveFunction(10) on load and registers a click handler.
// - The recursive function logs "Recursive call N: undefined" for N = 2..10 when called.
// - All tests use async/await and Playwright's ES module syntax.
//

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52099511-fa76-11f0-a09b-87751f540fd8.html';

// Page object to encapsulate interactions and console observation
class RecursionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Collect console messages and page errors for assertions
    this.consoleMessages = []; // {text, type, timestamp}
    this.pageErrors = []; // Error objects from 'pageerror'
    this._onConsole = this._onConsole.bind(this);
    this._onPageError = this._onPageError.bind(this);
    this.page.on('console', this._onConsole);
    this.page.on('pageerror', this._onPageError);
  }

  // Internal console event handler
  _onConsole(msg) {
    try {
      this.consoleMessages.push({
        text: msg.text(),
        type: msg.type(),
        timestamp: Date.now(),
      });
    } catch (e) {
      // If reading msg.text() throws, still record a placeholder
      this.consoleMessages.push({
        text: `<unable to read console message: ${String(e)}>`,
        type: msg.type ? msg.type() : 'unknown',
        timestamp: Date.now(),
      });
    }
  }

  // Internal page error handler
  _onPageError(error) {
    this.pageErrors.push({ error, timestamp: Date.now() });
  }

  // Navigate to the app and wait for load
  async goto() {
    // Ensure we attach listeners before navigation to capture page-load logs
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Find the Run Recursion button
  async getRunButton() {
    return this.page.$('#run-recursion');
  }

  // Click the run button
  async clickRunButton() {
    const btn = await this.getRunButton();
    if (!btn) throw new Error('Run Recursion button not found');
    await btn.click();
  }

  // Utility: wait until consoleMessages length increases by at least delta or timeout
  async waitForConsoleIncrease(previousLength, delta, timeout = 2000) {
    const target = previousLength + delta;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (this.consoleMessages.length >= target) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    // fallthrough
  }

  // Filter console messages by substring
  findConsoleMessagesContaining(substr) {
    return this.consoleMessages.filter((m) => m.text.includes(substr)).map((m) => m.text);
  }

  // Clean up listeners
  async dispose() {
    this.page.removeListener('console', this._onConsole);
    this.page.removeListener('pageerror', this._onPageError);
  }
}

test.describe('Recursion Example FSM and behavior', () => {
  let page;
  let rp;

  test.beforeEach(async ({ browser }) => {
    // Create a new page for each test to isolate console logs and state
    page = await browser.newPage();
    rp = new RecursionPage(page);
  });

  test.afterEach(async () => {
    // Clean up listeners and close page
    if (rp) await rp.dispose();
    if (page) await page.close();
  });

  test('S0_Idle: Page loads with Run Recursion button and initial recursion logs appear', async () => {
    // Validate the Idle state:
    // - The Run Recursion button exists
    // - The page executes the script on load, which calls recursiveFunction(10) (per HTML)
    // - Observe console logs produced by the initial invocation (Recursive call 2..10)
    await rp.goto();

    // Button should exist and be visible
    const btn1 = await rp.getRunButton();
    expect(btn).not.toBeNull();
    expect(await btn.isVisible()).toBe(true);

    // Wait briefly to allow the page's on-load console logs to be captured
    await rp.waitForConsoleIncrease(0, 9, 2000); // expect at least 9 recursion logs (2..10)

    // Gather the recursion messages (we expect "Recursive call 2: undefined" through "Recursive call 10: undefined")
    const expectedMessages = [];
    for (let n = 2; n <= 10; n++) expectedMessages.push(`Recursive call ${n}: undefined`);

    // Check that each expected message appears at least once in the consoleMessages
    for (const expected of expectedMessages) {
      const found = rp.consoleMessages.some((m) => m.text.includes(expected));
      expect(found).toBe(true);
    }

    // Verify the order of the recursion messages is ascending from 2 to 10 as produced by the unwind logging
    const foundRecursionLogs = rp.consoleMessages
      .map((m) => m.text)
      .filter((text) => text.startsWith('Recursive call '));
    // Extract numeric parts
    const extractedNumbers = foundRecursionLogs.map((text) => {
      const m = text.match(/^Recursive call (\d+):/);
      return m ? parseInt(m[1], 10) : NaN;
    });

    // We expect to see increasing sequence like 2,3,...,10 as first occurrence order
    // At minimum, validate that 2 appears before 10
    const idx2 = extractedNumbers.indexOf(2);
    const idx10 = extractedNumbers.indexOf(10);
    expect(idx2).toBeGreaterThanOrEqual(0);
    expect(idx10).toBeGreaterThanOrEqual(0);
    expect(idx2).toBeLessThan(idx10);

    // Assert there are no uncaught page errors on load
    expect(rp.pageErrors.length).toBe(0);

    // The FSM's S0 entry action was "console.log('Page loaded')" per FSM,
    // but the actual HTML does not contain that exact log. Assert it's absent.
    const pageLoadedMessages = rp.consoleMessages.filter((m) => m.text.includes('Page loaded'));
    expect(pageLoadedMessages.length).toBe(0);
  });

  test('S1_RunningRecursion: Clicking the Run Recursion button triggers recursion logs again', async () => {
    // Validate transition from Idle -> RunningRecursion:
    // - Click button and observe new set of recursion logs
    await rp.goto();

    // Record current console length (includes initial load logs)
    const beforeClickCount = rp.consoleMessages.length;

    // Click the run button once
    await rp.clickRunButton();

    // The recursion logs for one invocation are 9 entries (2..10)
    await rp.waitForConsoleIncrease(beforeClickCount, 9, 2000);

    // Gather the newly added logs
    const newLogs = rp.consoleMessages.slice(beforeClickCount).map((m) => m.text);

    // Ensure the new logs contain the expected messages
    for (let n = 2; n <= 10; n++) {
      const expected = `Recursive call ${n}: undefined`;
      const found1 = newLogs.some((text) => text.includes(expected));
      expect(found).toBe(true);
    }

    // Verify no page errors occurred during the click handling
    expect(rp.pageErrors.length).toBe(0);
  });

  test('Edge case: Multiple rapid clicks produce cumulative recursion logs without errors', async () => {
    // Rapidly click the button 3 times and ensure logs accumulate (3 * 9 messages)
    await rp.goto();

    const prior = rp.consoleMessages.length;

    // Perform 3 rapid clicks
    const btn2 = await rp.getRunButton();
    expect(btn).not.toBeNull();
    await btn.click();
    await btn.click();
    await btn.click();

    // Wait for 27 new recursion logs to appear
    await rp.waitForConsoleIncrease(prior, 27, 4000);

    // Count how many recursion logs there are in the new region
    const added = rp.consoleMessages.slice(prior);
    const recursionAdded = added.filter((m) => m.text.startsWith('Recursive call '));
    expect(recursionAdded.length).toBeGreaterThanOrEqual(27);

    // Ensure no uncaught errors
    expect(rp.pageErrors.length).toBe(0);
  });

  test('Direct invocation via page.evaluate returns undefined and produces logs', async () => {
    // This test calls the recursiveFunction directly via page.evaluate (if present).
    // It asserts that the function returns undefined (per its implementation)
    // and that invoking it produces the expected console logs.
    await rp.goto();

    // Record current console count
    const before = rp.consoleMessages.length;

    // Call recursiveFunction(3) via evaluate if available
    const hasFunction = await page.evaluate(() => typeof window.recursiveFunction === 'function');
    if (!hasFunction) {
      test.skip('recursiveFunction is not exposed on window');
      return;
    }

    const returnValue = await page.evaluate(() => {
      // Call the function - according to implementation, this will produce logs and return undefined
      return window.recursiveFunction(3);
    });

    // The function should return undefined
    expect(returnValue).toBeUndefined();

    // Wait for console logs from this invocation: recursion for 2..3 yields entries for 2 and 3 (2 entries)
    await rp.waitForConsoleIncrease(before, 2, 2000);

    const newLogs1 = rp.consoleMessages.slice(before).map((m) => m.text);
    expect(newLogs.some((t) => t.includes('Recursive call 2:'))).toBe(true);
    expect(newLogs.some((t) => t.includes('Recursive call 3:'))).toBe(true);

    // No page errors expected
    expect(rp.pageErrors.length).toBe(0);
  });

  test('Error observation: no ReferenceError / TypeError / SyntaxError occur during normal operations', async () => {
    // This test intentionally monitors page errors while loading and interacting
    await rp.goto();

    // Interact once
    await rp.clickRunButton();
    await rp.waitForConsoleIncrease(0, 9, 2000); // ensure some logs after click

    // Aggregate known critical error types in pageErrors
    const errorTexts = rp.pageErrors.map((pe) => String(pe.error && pe.error.message ? pe.error.message : pe.error));
    // We assert that none of the pageErrors include ReferenceError/TypeError/SyntaxError strings.
    for (const msg of errorTexts) {
      expect(msg.includes('ReferenceError')).toBe(false);
      expect(msg.includes('TypeError')).toBe(false);
      expect(msg.includes('SyntaxError')).toBe(false);
    }

    // Additionally ensure there are no page errors at all for this app under normal conditions
    expect(rp.pageErrors.length).toBe(0);
  });
});