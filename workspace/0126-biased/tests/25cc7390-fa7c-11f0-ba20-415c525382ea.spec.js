import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cc7390-fa7c-11f0-ba20-415c525382ea.html';

test.describe('B-Tree Search Demo (Application ID: 25cc7390-fa7c-11f0-ba20-415c525382ea)', () => {
  // Shared variables to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection (info, warn, error, etc.)
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case msg.text() throws, still capture something
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture any uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  // Test the Idle state: S0_Idle
  test('Initial Idle state: button present and output empty', async ({ page }) => {
    // Verify the Search button exists and is enabled
    const button = page.locator('#search-btn');
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
    await expect(button).toHaveText('Search for Key 12');

    // Verify the demo output element exists and starts empty
    const output = page.locator('#demo-output');
    await expect(output).toBeVisible();
    await expect(output).toHaveText('', { timeout: 100 }); // should be empty initially

    // Assert no runtime page errors occurred while loading the page (observing console and errors)
    // The environment instructions require observing console logs and page errors; we assert none happened on load.
    expect(pageErrors.length).toBe(0);
    // No console error messages of type 'error' should have been emitted during load
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });

  // Test transition: S0_Idle -> S1_Searching when clicking the button
  test('Clicking the search button enters Searching state and shows "Starting search..." and disables button', async ({ page }) => {
    const button = page.locator('#search-btn');
    const output = page.locator('#demo-output');

    // Click the button to start the search (this should synchronously disable it and set Starting text)
    await button.click();

    // Immediately assert the button is disabled (exit action in FSM: btn.disabled = true)
    await expect(button).toBeDisabled();

    // The transition entry action sets outputEl.textContent = 'Starting search...\n\n';
    // Check that the demo output contains the starting message
    await expect(output).toContainText('Starting search...', { timeout: 500 });

    // There should be no uncaught page errors at this point
    expect(pageErrors.length).toBe(0);
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });

  // Test transition: S1_Searching -> S2_SearchComplete and verify the simulated search log
  test('Search completes and logs steps, includes "Search successful." and re-enables button', async ({ page }) => {
    const button = page.locator('#search-btn');
    const output = page.locator('#demo-output');

    // Start search
    await button.click();

    // Wait for the completion message to be appended by the setTimeout and simulateSearch
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.textContent && el.textContent.includes('Search successful.');
    }, { timeout: 2000 });

    // Confirm the output contains the full sequence of expected messages
    const text = await output.textContent();
    // Expectation: visiting root node, moving to child, visiting child node, finding key, and success
    expect(text).toContain('Visiting node with keys: [10]');
    expect(text).toContain('Key not found, moving to child index 1');
    expect(text).toContain('Visiting node with keys: [12, 20, 30]');
    expect(text).toContain('Key 12 found at index 0 in node.');
    expect(text).toContain('Search successful.');

    // After the simulated search completes, the button should be re-enabled
    await expect(button).toBeEnabled();

    // Ensure no uncaught page errors occurred during the search
    expect(pageErrors.length).toBe(0);
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });

  // Edge case: Rapid multiple clicks — ensure only one search runs while button is disabled
  test('Rapid multiple clicks should not start multiple simultaneous searches', async ({ page }) => {
    const button = page.locator('#search-btn');
    const output = page.locator('#demo-output');

    // Rapidly attempt to click twice: second click should be effectively ignored because button is disabled immediately
    await Promise.all([
      button.click(),
      // Small delay before second click attempt to simulate user rapid double-click; second should be ignored
      page.waitForTimeout(5).then(() => button.click().catch(() => {}))
    ]);

    // Wait for search to complete
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.textContent && el.textContent.includes('Search successful.');
    }, { timeout: 2000 });

    const finalText = await output.textContent();

    // Ensure the "Starting search..." marker appears only once (i.e., only one search was started)
    const startOccurrences = finalText.split('Starting search...').length - 1;
    expect(startOccurrences).toBe(1);

    // Ensure the "Search successful." message appears only once for single search run
    const successOccurrences = finalText.split('Search successful.').length - 1;
    expect(successOccurrences).toBe(1);

    // Ensure no page errors were emitted during this rapid interaction
    expect(pageErrors.length).toBe(0);
  });

  // Test repeated searches: after completion, starting another search appends new logs
  test('Subsequent search after completion appends logs and toggles button state correctly', async ({ page }) => {
    const button = page.locator('#search-btn');
    const output = page.locator('#demo-output');

    // First search
    await button.click();
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.textContent && el.textContent.includes('Search successful.');
    }, { timeout: 2000 });

    // Record output after first search
    const afterFirst = await output.textContent();
    const firstSuccessCount = afterFirst.split('Search successful.').length - 1;
    expect(firstSuccessCount).toBeGreaterThanOrEqual(1);

    // Start second search (button should be enabled now)
    await button.click();

    // While second search is running, button should be disabled
    await expect(button).toBeDisabled();

    // Wait for second search to complete
    await page.waitForFunction((prevCount) => {
      const el = document.getElementById('demo-output');
      if (!el || !el.textContent) return false;
      return (el.textContent.split('Search successful.').length - 1) > prevCount;
    }, { arg: firstSuccessCount, timeout: 3000 });

    // Verify that logs were appended (i.e., now there are more occurrences of success)
    const finalText = await output.textContent();
    const finalSuccessCount = finalText.split('Search successful.').length - 1;
    expect(finalSuccessCount).toBeGreaterThan(firstSuccessCount);

    // Ensure the button is enabled at the end of the second search
    await expect(button).toBeEnabled();

    // Final check: no uncaught errors occurred during repeated searches
    expect(pageErrors.length).toBe(0);
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });

  // Defensive test: verify simulated search returns 'Search unsuccessful.' for a key not present
  // We do not modify page code; instead we simulate this by invoking the simulateSearch function via page.evaluate
  // Note: The page defines simulateSearch in a closure and not globally accessible. As required, DO NOT modify page code.
  // Therefore we assert that simulateSearch is not accessible globally (this validates encapsulation) and that attempting to call it fails naturally.
  test('simulateSearch function is encapsulated and not callable from global scope (encapsulation / error observation)', async ({ page }) => {
    // Try to read simulateSearch from window — it should be undefined because it is inside an IIFE closure
    const isDefined = await page.evaluate(() => {
      // Accessing simulateSearch should return undefined if properly encapsulated in IIFE.
      // This does not modify the page or patch anything; it observes the environment.
      return typeof window.simulateSearch !== 'function';
    });

    // Expect that simulateSearch is not exported to window (true means undefined / not a function)
    expect(isDefined).toBe(true);
  });

  // Final test: ensure overall page had no uncaught exceptions across actions
  test('No uncaught page errors were emitted during the suite of interactions in this test instance', async ({ page }) => {
    // At this point in an isolated test the pageErrors array is only for this test run.
    // We simply assert there are no uncaught errors for this test's lifecycle.
    expect(pageErrors.length).toBe(0);
  });
});