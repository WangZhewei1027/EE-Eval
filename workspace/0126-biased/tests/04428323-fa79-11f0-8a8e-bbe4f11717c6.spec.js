import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04428323-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Exponential Search - FSM validation (04428323-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Collect console messages and page errors for each test to assert runtime errors (ReferenceError, SyntaxError, TypeError)
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Nothing special to teardown; listeners are bound to page and cleared automatically when page is closed by Playwright.
  });

  test.describe('Initial State (S0_Idle)', () => {
    test('renders search input and at least one search button, result element exists but is hidden', async ({ page }) => {
      // Validate the input exists and has the expected placeholder
      const input = page.locator('.search-input');
      await expect(input).toHaveCount(1);
      await expect(input).toHaveAttribute('placeholder', 'Search...');
      await expect(input).toHaveAttribute('type', 'search');

      // There are two .search-button elements in the DOM (one in the form and one in the description area)
      const buttons = page.locator('.search-button');
      await expect(buttons).toHaveCount(2);

      // The result element exists and initially should not be visible (CSS display: none)
      const result = page.locator('#result');
      await expect(result).toHaveCount(1);

      // Check initial text content is empty
      await expect(result).toHaveText('');

      // Because the implementation never toggles the "show" class, the element remains hidden by default.
      // Assert that it does not have .show class initially.
      await expect(result).not.toHaveClass(/show/);
    });
  });

  test.describe('Search transitions and states (S1 -> S2/S3/S4)', () => {
    test('Empty Query (S4_EmptyQuery): clicking Search with empty input sets "Please enter a search query"', async ({ page }) => {
      // Ensure input is empty and click the first search button
      const input = page.locator('.search-input');
      await input.fill(''); // ensure empty
      const firstButton = page.locator('.search-button').first();
      await firstButton.click();

      const result = page.locator('#result');

      // The script sets textContent to 'Please enter a search query' when query is empty.
      await expect(result).toHaveText('Please enter a search query');

      // The implementation doesn't toggle visibility class; ensure element remains without .show
      await expect(result).not.toHaveClass(/show/);

      // Ensure whitespace-only input is treated as empty (edge case)
      await input.fill('   ');
      await firstButton.click();
      await expect(result).toHaveText('Please enter a search query');
    });

    test('Not Found (S3_ResultNotFound): searching for a value that is not found sets "Not found"', async ({ page }) => {
      const input = page.locator('.search-input');
      const firstButton = page.locator('.search-button').first();
      const result = page.locator('#result');

      // Search for a value that is definitely not in the array
      await input.fill('xyz');
      await firstButton.click();

      await expect(result).toHaveText('Not found');

      // Search for a numeric string that due to implementation type mismatch is also "Not found"
      // The underlying array is numbers [1..10]. Because .indexOf('5') will not match number 5, expect "Not found".
      await input.fill('5');
      await firstButton.click();
      await expect(result).toHaveText('Not found');

      // Behavior comment: this asserts that S3 is reachable and exercised by the current implementation.
    });

    test('Found (S2_ResultFound) - verify that "Found" outcome is not produced due to type mismatch in current implementation', async ({ page }) => {
      const input = page.locator('.search-input');
      const firstButton = page.locator('.search-button').first();
      const result = page.locator('#result');

      // Try to trigger a "Found" result by searching for an item expected to be in the array (e.g., 3)
      await input.fill('3');
      await firstButton.click();

      // The page script uses indexOf on an array of numbers with a string input, so it does not find the match.
      // Assert that the observed behavior is "Not found" and NOT a "Found ..." message.
      await expect(result).toHaveText('Not found');

      // Logically, this demonstrates that S2 (ResultFound) is not reachable with the current, unmodified code.
      // We assert that "Found" did not occur.
      const text = await result.textContent();
      expect(text).not.toContain('Found');

      // We still include this test to cover the FSM state and document the mismatch between FSM and implementation.
    });

    test('Clicking the second .search-button (unbound) does not trigger search logic', async ({ page }) => {
      // There are two buttons with class 'search-button'. The implementation attaches the listener to the first one only.
      const input = page.locator('.search-input');
      const buttons = page.locator('.search-button');
      const firstButton = buttons.nth(0);
      const secondButton = buttons.nth(1);
      const result = page.locator('#result');

      // Ensure result is cleared
      await input.fill('');
      await firstButton.click();
      await expect(result).toHaveText('Please enter a search query');

      // Set a value that would normally produce "Not found"
      await input.fill('7');
      // Click the SECOND button which likely has no event listener attached by the current script
      await secondButton.click();

      // Because second button is not wired, the result text should remain as previous content
      // (i.e., unchanged or still 'Please enter a search query' depending on timing). We assert it did NOT change to "Found".
      const currentText = await result.textContent();
      expect(currentText === 'Please enter a search query' || currentText === 'Not found' || currentText === '').toBeTruthy();

      // To be explicit, ensure we do not get a "Found" message as a result of clicking the second button.
      expect(currentText).not.toContain('Found');
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('whitespace-only query is treated as empty and triggers empty-query message', async ({ page }) => {
      const input = page.locator('.search-input');
      const firstButton = page.locator('.search-button').first();
      const result = page.locator('#result');

      await input.fill('    \t\n  ');
      await firstButton.click();

      await expect(result).toHaveText('Please enter a search query');
    });

    test('multiple rapid clicks do not throw runtime exceptions and produce deterministic output', async ({ page }) => {
      const input = page.locator('.search-input');
      const firstButton = page.locator('.search-button').first();
      const result = page.locator('#result');

      await input.fill('abc');

      // Click rapidly several times
      await Promise.all([
        firstButton.click(),
        firstButton.click(),
        firstButton.click()
      ]);

      // Expect stable final state (Not found)
      await expect(result).toHaveText('Not found');
    });
  });

  test.describe('Console and runtime error checks', () => {
    test('no ReferenceError, SyntaxError, or TypeError occurred during page load and interactions', async ({ page }) => {
      // Perform a variety of interactions to surface potential errors
      const input = page.locator('.search-input');
      const firstButton = page.locator('.search-button').first();
      const secondButton = page.locator('.search-button').nth(1);

      // Interactions
      await input.fill('');
      await firstButton.click();
      await input.fill('5');
      await firstButton.click();
      await secondButton.click();
      await input.fill('   ');
      await firstButton.click();

      // Allow any asynchronous handlers to run for a short time
      await page.waitForTimeout(100);

      // Check captured page errors (uncaught exceptions)
      // Assert that there are no page errors that are ReferenceError, SyntaxError, or TypeError
      const offendingPageErrors = pageErrors.filter(e => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name));
      if (offendingPageErrors.length > 0) {
        // If any such errors occurred, include them in the test failure message
        const messages = offendingPageErrors.map(e => `${e.name}: ${e.message}`).join('; ');
        throw new Error(`Detected runtime page errors of types ReferenceError/SyntaxError/TypeError: ${messages}`);
      }

      // Also ensure there are no console.error messages that include those error names
      const consoleErrors = consoleMessages.filter(m => m.type === 'error' && /ReferenceError|SyntaxError|TypeError/.test(m.text));
      if (consoleErrors.length > 0) {
        const msgs = consoleErrors.map(m => m.text).join('; ');
        throw new Error(`Detected console.error messages indicating runtime errors: ${msgs}`);
      }

      // Finally assert that overall there were no page errors at all (informative)
      expect(pageErrors.length).toBe(0);
      // And no console error-level messages
      expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    });
  });

  test.describe('FSM coverage summary assertions', () => {
    test('assert that we exercised Idle, Searching, EmptyQuery, and ResultNotFound behaviors', async ({ page }) => {
      const input = page.locator('.search-input');
      const firstButton = page.locator('.search-button').first();
      const result = page.locator('#result');

      // Idle: check initial
      await expect(input).toHaveCount(1);

      // Searching: click to trigger search behavior
      await input.fill('abc');
      await firstButton.click();
      await expect(result).toHaveText('Not found'); // Searching -> NotFound

      // Empty query: clear and click
      await input.fill('');
      await firstButton.click();
      await expect(result).toHaveText('Please enter a search query');

      // Note: ResultFound (S2) is not reached by the unmodified implementation due to type mismatch
      const finalText = await result.textContent();
      expect(finalText).not.toContain('Found');
    });
  });
});