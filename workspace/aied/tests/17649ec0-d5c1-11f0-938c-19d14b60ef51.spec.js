import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17649ec0-d5c1-11f0-938c-19d14b60ef51.html';

test.describe('Recursion Demonstration - FSM validation (17649ec0-d5c1-11f0-938c-19d14b60ef51)', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors for each test
    consoleMessages = [];
    pageErrors = [];

    // Capture console events (log, error, warning, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught exceptions and other page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Basic sanity: tests should evaluate and then we can inspect captured logs/errors
    // No explicit teardown required because Playwright cleans up pages between tests
  });

  test('Initial render (Idle state): input, button, and empty result are present; renderPage() not defined', async ({ page }) => {
    // This test validates the S0_Idle state as defined in the FSM:
    // - input#number exists
    // - button with onclick calculateFactorial exists
    // - #result is present and initially empty
    // - The FSM entry action renderPage() is mentioned in the FSM; verify it's NOT present on window (so we observe actual implementation)
    const numberInput = page.locator('#number');
    const button = page.locator('button[onclick="calculateFactorial()"]');
    const result = page.locator('#result');

    await expect(numberInput).toBeVisible();
    await expect(button).toBeVisible();
    await expect(result).toBeVisible();
    await expect(result).toHaveText(''); // initially empty

    // Verify that renderPage is not defined in the page's global scope (FSM mentioned it but HTML doesn't define it)
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // Ensure no unexpected page runtime errors occurred during initial load
    expect(pageErrors.length).toBe(0);

    // No console error-level messages should have been emitted on load; record for visibility if present
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Calculate factorial for a positive integer: transition to Result Displayed (S1_ResultDisplayed)', async ({ page }) => {
    // Validates transition: S0_Idle -> S1_ResultDisplayed when clicking after entering a positive number
    const numberInput = page.locator('#number');
    const button = page.locator('button[onclick="calculateFactorial()"]');
    const result = page.locator('#result');

    // Enter 5 and click Calculate Factorial
    await numberInput.fill('5');
    await button.click();

    // Expect the correct result text and no page errors
    await expect(result).toHaveText('Factorial of 5 is 120.');
    expect(pageErrors.length).toBe(0);

    // No console errors should have been printed as a consequence of successful calculation
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Calculate factorial for zero: edge case resulting in 1 (S1_ResultDisplayed)', async ({ page }) => {
    // Validate edge-case transition for 0 -> factorial is 1
    const numberInput = page.locator('#number');
    const button = page.locator('button[onclick="calculateFactorial()"]');
    const result = page.locator('#result');

    await numberInput.fill('0');
    await button.click();

    await expect(result).toHaveText('Factorial of 0 is 1.');
    expect(pageErrors.length).toBe(0);

    // Check no console error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Calculate factorial for a negative integer: transition to Error state (S2_Error)', async ({ page }) => {
    // Validate transition: S0_Idle -> S2_Error when clicking after entering a negative number
    const numberInput = page.locator('#number');
    const button = page.locator('button[onclick="calculateFactorial()"]');
    const result = page.locator('#result');

    // Even though the input has min="0", filling bypasses native validation
    await numberInput.fill('-3');
    await button.click();

    // Expect the specific error message in the #result element
    await expect(result).toHaveText('Please enter a non-negative integer.');

    // No page runtime errors should be produced for this handled error path
    expect(pageErrors.length).toBe(0);

    // No console errors expected
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
  });

  test('Empty input causes runtime error due to NaN recursion; capture pageerror (RangeError / maximum call stack)', async ({ page }) => {
    // This test intentionally triggers the unhandled recursion scenario:
    // - parseInt('') is NaN, the code checks only (num < 0) which is false for NaN,
    //   so factorial(NaN) is called and leads to infinite recursion -> RangeError / Maximum call stack size exceeded.
    // We assert that a pageerror is emitted and contains an indicative message.

    const numberInput = page.locator('#number');
    const button = page.locator('button[onclick="calculateFactorial()"]');

    // Ensure input is empty
    await numberInput.fill('');

    // Wait for a pageerror event as the click triggers infinite recursion
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      button.click(),
    ]);

    // The captured pageerror should be an Error object; assert its message indicates stack overflow/recursion
    expect(error).toBeDefined();
    const message = String(error.message || error.toString() || '');
    // Check for common phrases used in stack overflow errors across engines
    const matches = /maximum call stack|Maximum call stack|call stack size exceeded|RangeError/i.test(message);
    expect(matches).toBe(true);

    // Also ensure our pageErrors collector captured the same error
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const anyMatches = pageErrors.some(e => /maximum call stack|Maximum call stack|call stack size exceeded|RangeError/i.test(String(e.message || e)));
    expect(anyMatches).toBe(true);

    // The UI #result may remain unchanged or contain partial content; just verify there was a runtime error captured
  });

  test('Repeated clicks and inputs: ensure state transitions are consistent and idempotent', async ({ page }) => {
    // Validate repeated interactions behave consistently
    const numberInput = page.locator('#number');
    const button = page.locator('button[onclick="calculateFactorial()"]');
    const result = page.locator('#result');

    // Sequence: 3 -> expect 6
    await numberInput.fill('3');
    await button.click();
    await expect(result).toHaveText('Factorial of 3 is 6.');
    expect(pageErrors.length).toBe(0);

    // Immediately change to 4 -> expect 24
    await numberInput.fill('4');
    await button.click();
    await expect(result).toHaveText('Factorial of 4 is 24.');
    expect(pageErrors.length).toBe(0);

    // Enter negative again -> error message
    await numberInput.fill('-1');
    await button.click();
    await expect(result).toHaveText('Please enter a non-negative integer.');
    expect(pageErrors.length).toBe(0);

    // Re-enter positive -> correct result again
    await numberInput.fill('2');
    await button.click();
    await expect(result).toHaveText('Factorial of 2 is 2.');
    expect(pageErrors.length).toBe(0);
  });
});