import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf4593-fa79-11f0-8075-e54a10595dde.html';

// Simple page object to encapsulate selectors and common actions
class RecursionPage {
  constructor(page) {
    this.page = page;
    this.factorialInput = page.locator('#factorial-input');
    this.factorialButton = page.locator('button[onclick="calculateFactorial()"]');
    this.factorialResult = page.locator('#factorial-result');

    this.fibonacciInput = page.locator('#fibonacci-input');
    this.fibonacciButton = page.locator('button[onclick="calculateFibonacci()"]');
    this.fibonacciResult = page.locator('#fibonacci-result');

    this.stringInput = page.locator('#string-input');
    this.reverseButton = page.locator('button[onclick="reverseString()"]');
    this.stringResult = page.locator('#string-result');

    this.depthInput = page.locator('#depth-input');
    this.countButton = page.locator('button[onclick="countUpDown()"]');
    this.countResult = page.locator('#count-result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Utility to capture current content of all result areas
  async readAllResults() {
    return {
      factorial: (await this.factorialResult.textContent())?.trim() ?? '',
      fibonacci: (await this.fibonacciResult.textContent())?.trim() ?? '',
      reversed: (await this.stringResult.textContent())?.trim() ?? '',
      counting: (await this.countResult.textContent())?.trim() ?? '',
    };
  }
}

test.describe('Interactive Recursion Demo - FSM driven tests', () => {
  // Arrays to collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', msg => {
      // capture text and type for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (unhandled exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test.describe('Idle state and initial render (S0_Idle)', () => {
    test('page loads and Idle UI components are present; renderPage is not defined', async ({ page }) => {
      // Validate presence of all controls from the Idle state evidence and verify renderPage not injected
      const app = new RecursionPage(page);
      await app.goto();

      // Verify inputs and buttons exist
      await expect(app.factorialInput).toBeVisible();
      await expect(app.factorialButton).toBeVisible();
      await expect(app.fibonacciInput).toBeVisible();
      await expect(app.fibonacciButton).toBeVisible();
      await expect(app.stringInput).toBeVisible();
      await expect(app.reverseButton).toBeVisible();
      await expect(app.depthInput).toBeVisible();
      await expect(app.countButton).toBeVisible();

      // Verify that the FSM-specified entry action renderPage() is NOT present in the global scope
      // (The HTML does not define renderPage; we assert that it is undefined.)
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).toBe('undefined');

      // No page errors should have occurred simply from loading the page
      expect(pageErrors.length).toBe(0);

      // No critical console errors on load
      const errorConsole = consoleMessages.find(m => m.type === 'error');
      expect(errorConsole).toBeUndefined();
    });
  });

  test.describe('Factorial interactions (S0_Idle -> S1_Factorial_Calculated)', () => {
    test('calculates factorial for valid input (default 5 -> 120)', async ({ page }) => {
      // This test validates the normal transition for CalculateFactorial
      const app = new RecursionPage(page);
      await app.goto();

      // Click calculate and assert correct result
      await app.factorialButton.click();
      await expect(app.factorialResult).toHaveText('Factorial: 120');

      // Ensure no runtime page errors occurred for the normal path
      expect(pageErrors.length).toBe(0);
    });

    test('edge case: empty input leads to runtime recursion error (expect pageerror)', async ({ page }) => {
      // This test intentionally triggers an invalid input to exercise error behavior
      const app = new RecursionPage(page);
      await app.goto();

      // Clear the factorial input to produce an invalid parseInt -> NaN -> recursion
      await app.factorialInput.fill('');
      // Wait for the pageerror event that should result from infinite recursion / stack overflow
      const [err] = await Promise.all([
        page.waitForEvent('pageerror'),
        app.factorialButton.click()
      ]);

      // The error should be a recursion/stack overflow style error
      expect(err).toBeTruthy();
      expect(err.message).toMatch(/Maximum call stack|call stack|stack overflow/i);

      // After the error, the factorial result is unlikely to be set or will be empty
      const text = (await app.factorialResult.textContent())?.trim() ?? '';
      // Accept either empty or a NaN/undefined-like result, but ensure it is not the successful expected string
      expect(text !== 'Factorial: 120').toBeTruthy();
    });
  });

  test.describe('Fibonacci interactions (S0_Idle -> S2_Fibonacci_Calculated)', () => {
    test('calculates fibonacci for valid input (default 5 -> 5)', async ({ page }) => {
      // Validate CalculateFibonacci transition and DOM update
      const app = new RecursionPage(page);
      await app.goto();

      await app.fibonacciButton.click();
      await expect(app.fibonacciResult).toHaveText('Fibonacci: 5');

      // Sanity: no page errors for this path
      expect(pageErrors.length).toBe(0);
    });

    test('edge case: large input may be slow but with small defaults should not error', async ({ page }) => {
      // Keep default small input (5) to avoid expensive recursion; this test demonstrates an edge check
      const app = new RecursionPage(page);
      await app.goto();

      // Set a moderate value and assert result updates (5 -> 5)
      await app.fibonacciInput.fill('6'); // fibonacci(6) = 8
      await app.fibonacciButton.click();
      await expect(app.fibonacciResult).toHaveText('Fibonacci: 8');

      // Ensure there are no unexpected runtime errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('String reversal interactions (S0_Idle -> S3_String_Reversed)', () => {
    test('reverses the default string "hello" -> "olleh"', async ({ page }) => {
      // Validate ReverseString transition and DOM mutation
      const app = new RecursionPage(page);
      await app.goto();

      await app.reverseButton.click();
      await expect(app.stringResult).toHaveText('Reversed: olleh');

      expect(pageErrors.length).toBe(0);
    });

    test('edge case: empty string reversal returns empty without error', async ({ page }) => {
      // Verify reversing an empty string is handled gracefully
      const app = new RecursionPage(page);
      await app.goto();

      await app.stringInput.fill('');
      await app.reverseButton.click();
      await expect(app.stringResult).toHaveText('Reversed: ');

      // No page errors expected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Count Up/Down interactions (S0_Idle -> S4_Counting_Completed)', () => {
    test('clicking Count Up/Down triggers runtime recursion error due to duplicate function override', async ({ page }) => {
      // This test documents and asserts the known faulty behavior: duplicate function definitions
      // The second countUpDown overrides the recursive implementation and calls itself recursively
      // causing a stack overflow / maximum call stack size exceeded error.

      const app = new RecursionPage(page);
      await app.goto();

      // Sanity check: the final countUpDown function is present and has zero declared parameters
      const fnType = await page.evaluate(() => typeof window.countUpDown);
      expect(fnType).toBe('function');
      const fnLength = await page.evaluate(() => window.countUpDown.length);
      // Because the HTML defines a second countUpDown() that overrides the first, the length should be 0
      expect(fnLength).toBe(0);

      // Trigger the broken button and wait for the pageerror event which indicates recursion overflow
      const [err] = await Promise.all([
        page.waitForEvent('pageerror'),
        app.countButton.click()
      ]);

      expect(err).toBeTruthy();
      // Typical message contains "Maximum call stack"
      expect(err.message).toMatch(/Maximum call stack|call stack|stack overflow/i);

      // Ensure count result was not successfully produced
      const countText = (await app.countResult.textContent())?.trim() ?? '';
      expect(countText === '' || !countText.startsWith('Counting:')).toBeTruthy();
    });

    test('edge case: setting depth to 1 results (if function were correct) would return simple answer; here we still expect error', async ({ page }) => {
      // Even with depth 1, due to the override bug we expect an error
      const app = new RecursionPage(page);
      await app.goto();

      await app.depthInput.fill('1');
      const [err] = await Promise.all([
        page.waitForEvent('pageerror'),
        app.countButton.click()
      ]);

      expect(err).toBeTruthy();
      expect(err.message).toMatch(/Maximum call stack|call stack|stack overflow/i);
    });
  });

  test.describe('Observability: console and page error monitoring', () => {
    test('captured console messages and page errors are exposed to test and reflect expected faults', async ({ page }) => {
      // This test demonstrates we are observing console and page errors while exercising the app.
      const app = new RecursionPage(page);
      await app.goto();

      // Initially there should be no page errors
      expect(pageErrors.length).toBe(0);

      // Trigger a known error path (countUpDown) and verify that it gets captured in pageErrors
      const promiseError = page.waitForEvent('pageerror');
      await app.countButton.click();
      const err = await promiseError;
      expect(err).toBeTruthy();
      expect(err.message).toMatch(/Maximum call stack|call stack|stack overflow/i);

      // Also ensure console messages were captured (even if none are errors)
      // We don't assert a specific console message, just that the capture mechanism worked
      // (consoleMessages may be empty if the page does not log anything to console)
      expect(Array.isArray(consoleMessages)).toBe(true);
    });
  });
});