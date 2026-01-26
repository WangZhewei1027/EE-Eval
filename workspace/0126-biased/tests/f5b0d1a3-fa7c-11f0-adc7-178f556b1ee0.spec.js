import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b0d1a3-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Linear Search FSM - f5b0d1a3-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Arrays to capture console messages and page errors for assertions
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  // Attach listeners before each test and navigate to the page as-is
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture all console messages (info, log, warn, error, etc.)
    page.on('console', (msg) => {
      const txt = msg.text();
      consoleMessages.push({ type: msg.type(), text: txt });
      if (msg.type() === 'error') {
        consoleErrors.push(txt);
      }
    });

    // Capture unhandled page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid cross-test leakage (best-effort)
    try {
      page.removeAllListeners?.('console');
      page.removeAllListeners?.('pageerror');
    } catch (e) {
      // Some Playwright versions may not expose removeAllListeners; ignore if not available.
    }
  });

  test('S0 Idle: initial render shows the Run Linear Search button (Idle state evidence)', async ({ page }) => {
    // This test validates the Idle state: the page renders and the primary button is present.
    const btn = page.locator('#linear-search-btn');

    // Button should be visible and have expected text
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Run Linear Search');

    // There should be no runtime page errors on initial load
    expect(pageErrors.length, 'No page errors should be present on load').toBe(0);

    // The console should not have produced any error messages during load
    expect(consoleErrors.length, 'No console.error messages on load').toBe(0);

    // Capture evidence clause from FSM: the button exists in DOM
    const hasButton = await page.$('#linear-search-btn') !== null;
    expect(hasButton).toBe(true);
  });

  test('S1 Searching -> S2 Found: clicking the button runs linearSearch and logs found message', async ({ page }) => {
    // This test validates the Searching state entry action and transition to Found.
    // It observes console output produced by the linearSearch execution.

    // Ensure the linearSearch function exists in the page global scope (verifies entry_action possibility)
    const linearSearchType = await page.evaluate(() => typeof window.linearSearch);
    expect(linearSearchType).toBe('function');

    // Call linearSearch directly in a controlled manner to assert expected return value (functionality check)
    const indexDirect = await page.evaluate(() => linearSearch([1,2,3,4,5,6], 5));
    expect(indexDirect).toBe(4);

    // Click the Run Linear Search button which should trigger the same search using page's array & target
    await page.click('#linear-search-btn');

    // Wait shortly to ensure console messages are flushed
    await page.waitForTimeout(200);

    // Find console log message that indicates the element was found
    const foundMessages = consoleMessages
      .filter(m => m.type === 'log' && m.text.includes('Target element found at index:'));

    // Must have at least one found message after the click
    expect(foundMessages.length).toBeGreaterThanOrEqual(1);

    // Verify the expected index appears in the logged message (array [1..10], target = 5 -> index 4)
    const containsIndex4 = foundMessages.some(m => m.text.includes('4'));
    expect(containsIndex4).toBe(true);

    // Ensure no unhandled exceptions occurred during the interaction
    expect(pageErrors.length, 'No runtime page errors should have occurred during click').toBe(0);
    expect(consoleErrors.length, 'No console.error messages should be produced during click').toBe(0);
  });

  test('S1 Searching: linearSearch behavior - returns -1 when target missing (function unit check)', async ({ page }) => {
    // This test directly exercises the linearSearch function with an input that should NOT be found.
    // This does not modify the page's globals but uses the existing function to validate its logic.
    const result = await page.evaluate(() => {
      // Call the existing linearSearch function with a target that is not present
      return linearSearch([10, 20, 30], 5);
    });
    expect(result).toBe(-1);
  });

  test('S3 NotFound: with the default page data, NotFound transition is NOT triggered (negative-path check)', async ({ page }) => {
    // This test asserts that given the provided runtime data (array and target),
    // the NotFound final state does not occur when clicking the button.
    // We do NOT change global data; we only observe natural behavior.

    // Ensure no "not found" messages exist yet
    expect(consoleMessages.some(m => m.text.includes('Target element not found'))).toBe(false);

    // Click the button once
    await page.click('#linear-search-btn');

    // Allow logs to be captured
    await page.waitForTimeout(200);

    // Validate that "Target element not found" was not logged
    const notFoundMessages = consoleMessages.filter(m => m.text.includes('Target element not found'));
    expect(notFoundMessages.length).toBe(0);

    // Document the reason: given the default target (5) and array [1..10], the NotFound path is not taken.
    // This verifies the guard condition behavior (index === -1 vs index !== -1) for the given data.
  });

  test('Edge case: multiple rapid clicks produce multiple found logs and no errors (robustness)', async ({ page }) => {
    // This test validates robustness under repeated interaction and ensures no errors occur.
    const clicks = 3;

    // Clear any previously recorded console messages
    consoleMessages = [];

    // Rapidly click the button multiple times
    for (let i = 0; i < clicks; i++) {
      await page.click('#linear-search-btn');
    }

    // Wait for logs to appear
    await page.waitForTimeout(300);

    // Count how many "found" logs were produced
    const foundCount = consoleMessages.filter(m => m.type === 'log' && m.text.includes('Target element found at index:')).length;
    expect(foundCount).toBeGreaterThanOrEqual(clicks);

    // Ensure no page errors or console.error entries occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Runtime errors observation: assert that no ReferenceError/SyntaxError/TypeError occurred naturally', async ({ page }) => {
    // This test explicitly verifies that no unhandled exceptions were emitted by the page environment.
    // We are not injecting or patching anything; we merely observe the environment as-is.

    // As a sanity check, interact once to surface any latent errors
    await page.click('#linear-search-btn');
    await page.waitForTimeout(200);

    // Assert no page-level exceptions were thrown
    expect(pageErrors.length, 'No unhandled page errors (e.g., ReferenceError, TypeError) should be present').toBe(0);

    // Assert no console.error messages were emitted
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleEntries.length, 'No console.error messages should be present').toBe(0);

    // If any such errors exist, include a helpful debugging assertion message listing them
    if (pageErrors.length > 0) {
      // Fail with details (this block should not be reached for the supplied HTML)
      const msgs = pageErrors.map(e => e.message).join('\n---\n');
      throw new Error('Unexpected page errors detected:\n' + msgs);
    }
  });
});