import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52091fe2-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Ternary Search Interactive Application (52091fe2-fa76-11f0-a09b-87751f540fd8)', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Setup: open a new page for each test and attach listeners to capture console logs and page errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Store console messages for assertions. Convert all console messages to strings.
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If msg.text() throws for some reason, push a fallback
        consoleMessages.push({ type: msg.type ? msg.type() : 'unknown', text: String(msg) });
      }
    });

    page.on('pageerror', (err) => {
      // Capture unhandled exceptions on the page
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
  });

  // Teardown is automatic by Playwright fixture; no explicit afterEach needed beyond closures.

  // Utility to wait until console messages array contains at least `minCount` messages
  // that include `substring`. Times out after `timeoutMs`.
  async function waitForConsoleMessagesContaining(substring, minCount = 1, timeoutMs = 1500) {
    const pollInterval = 50;
    const maxTries = Math.ceil(timeoutMs / pollInterval);
    let tries = 0;
    while (tries < maxTries) {
      const count = consoleMessages.filter((m) => m.text.includes(substring)).length;
      if (count >= minCount) return;
      await new Promise((r) => setTimeout(r, pollInterval));
      tries++;
    }
    // let caller assert on consoleMessages if not enough found
  }

  test('Initial Idle state: page renders header and Start button with expected onclick', async ({ page }) => {
    // Validate S0_Idle evidence: page renders Start button and heading
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Ternary Search');

    const startButton = page.locator('button[onclick="searchTernary(0, 10)"]');
    await expect(startButton).toHaveCount(1);
    await expect(startButton).toHaveText('Start');

    // Ensure no searching logs present before any interaction
    const searchingLogsBefore = consoleMessages.filter((m) => m.text.includes('Searching for value'));
    expect(searchingLogsBefore.length).toBe(0);

    // Ensure no page errors on initial load
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking Start triggers Searching (S0 -> S1): console logs show recursive searches', async ({ page }) => {
    const startButton1 = page.locator('button[onclick="searchTernary(0, 10)"]');
    // Confirm function exists on the page
    const hasFunction = await page.evaluate(() => typeof window.searchTernary === 'function');
    expect(hasFunction).toBe(true);

    // Click Start and wait for searching logs to appear
    await startButton.click();

    // Wait for at least one Searching log to be captured
    await waitForConsoleMessagesContaining('Searching for value', 1, 2000);

    // Collect all Searching logs
    const searchingLogs = consoleMessages.filter((m) => m.text.startsWith('Searching for value'));
    // Based on the implementation and the range 0..10, we expect 4 recursive searching logs:
    // mid sequence: 5, 8, 9, 10 -> values: 16, 25, 28, 31
    // Assert we have at least 4 such logs (exact 4 is expected here)
    expect(searchingLogs.length).toBeGreaterThanOrEqual(1);
    // Try to assert exact expected count of 4 for stronger verification
    expect(searchingLogs.length).toBe(4);

    // Validate the format and numeric content of each Searching log
    const searchingRegex = /^Searching for value (\d+) between (\d+) and (\d+)$/;
    const parsed = searchingLogs.map((m) => {
      const match = m.text.match(searchingRegex);
      return match ? { value: Number(match[1]), start: Number(match[2]), end: Number(match[3]) } : null;
    });
    // All logs must match the expected pattern
    expect(parsed.every((p) => p !== null)).toBe(true);

    // Spot check the sequence of 'start' and 'end' values are consistent with ternary/recursive calls
    // The 'start'/'end' pairs should narrow down; ensure each subsequent range is within previous bounds
    for (let i = 1; i < parsed.length; i++) {
      const prev = parsed[i - 1];
      const cur = parsed[i];
      expect(cur.start).toBeGreaterThanOrEqual(prev.start);
      expect(cur.end).toBeLessThanOrEqual(prev.end);
    }

    // Ensure final "Value ... found" log did NOT appear (S2_ValueFound should not be reached with given code)
    const foundLogs = consoleMessages.filter((m) => m.text.startsWith('Value ') && m.text.includes('found at index'));
    expect(foundLogs.length).toBe(0);

    // Ensure no runtime errors occurred during the search
    expect(pageErrors.length).toBe(0);
  });

  test('ValueFound (S2) is not reachable with current implementation: assert absence of found message', async ({ page }) => {
    // Directly invoke the search function via page.evaluate to ensure search runs
    // The function exists; run searchTernary(0, 10)
    await page.evaluate(() => {
      // Call the existing function (do not modify or patch it)
      if (typeof window.searchTernary === 'function') {
        window.searchTernary(0, 10);
      }
    });

    // Wait for searching logs to appear
    await waitForConsoleMessagesContaining('Searching for value', 1, 2000);

    // Assert that no 'Value ... found at index ...' messages are in console logs
    const foundMessages = consoleMessages.filter((m) => /Value \d+ found at index \d+/.test(m.text));
    expect(foundMessages.length).toBe(0);

    // If the FSM expected a ValueFound transition, document that it did not occur
    // Verify no page errors as a result of the call
    expect(pageErrors.length).toBe(0);
  });

  test('Base case: calling searchTernary with start > end should return silently (edge case)', async ({ page }) => {
    // Clear previously captured messages
    consoleMessages = [];

    // Call with start > end; per implementation, function should return immediately and produce no logs
    await page.evaluate(() => {
      if (typeof window.searchTernary === 'function') {
        window.searchTernary(5, 4);
      }
    });

    // Short wait to ensure any logs would be captured
    await new Promise((r) => setTimeout(r, 200));

    // Assert no Searching logs and no ValueFound logs
    const searching = consoleMessages.filter((m) => m.text.includes('Searching for value'));
    const found = consoleMessages.filter((m) => m.text.includes('found at index'));
    expect(searching.length).toBe(0);
    expect(found.length).toBe(0);

    // No runtime errors expected for this valid edge-case call
    expect(pageErrors.length).toBe(0);
  });

  test('Rapid repeated clicks produce repeated Searching logs (robustness / repeated event handling)', async ({ page }) => {
    const startButton2 = page.locator('button[onclick="searchTernary(0, 10)"]');

    // Clear console messages
    consoleMessages = [];

    // Click twice rapidly
    await Promise.all([
      startButton.click(),
      startButton.click()
    ]);

    // Wait for searching logs to appear; each click should produce ~4 Searching logs => ~8 total
    await waitForConsoleMessagesContaining('Searching for value', 6, 3000);

    const searchingLogs1 = consoleMessages.filter((m) => m.text.startsWith('Searching for value'));
    // Expect at least 6 logs and likely exactly 8 depending on timings; assert minimum to avoid flakiness
    expect(searchingLogs.length).toBeGreaterThanOrEqual(6);

    // Ensure no ValueFound logs were produced
    const foundLogs1 = consoleMessages.filter((m) => m.text.includes('found at index'));
    expect(foundLogs.length).toBe(0);

    // Ensure no page errors as a result of rapid clicks
    expect(pageErrors.length).toBe(0);
  });

  test('Validate expected event handler attribute exists (evidence of FSM StartSearch event)', async ({ page }) => {
    // The FSM indicates a StartSearch event triggered by button[onclick="searchTernary(0, 10)"]
    const startButton3 = page.locator('button[onclick="searchTernary(0, 10)"]');
    await expect(startButton).toHaveCount(1);

    // Check the raw attribute value from the DOM
    const attr = await startButton.getAttribute('onclick');
    expect(attr).toBe('searchTernary(0, 10)');

    // Clicking should invoke the search function (search logs will appear)
    await startButton.click();
    await waitForConsoleMessagesContaining('Searching for value', 1, 2000);

    // Check no page errors triggered by click
    expect(pageErrors.length).toBe(0);
  });
});