import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3c83d1-d360-11f0-b42e-71f0e7238799.html';

// Page Object for the Recursion Demo page
class RecursionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputNumber');
    this.button = page.locator('button', { hasText: 'Calculate Factorial' });
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Fill the input with the provided value (string to allow '3.5' or '')
  async enterNumber(value) {
    await this.input.fill(''); // clear
    // fill with value as string
    await this.input.fill(String(value));
  }

  async clickCalculate() {
    await this.button.click();
  }

  async getResultText() {
    return (await this.result.textContent())?.trim() ?? '';
  }

  // Helper to run full flow
  async calculate(value) {
    await this.enterNumber(value);
    await this.clickCalculate();
  }
}

// Shared arrays to gather runtime issues per test
let collectedConsoleMessages = [];
let collectedPageErrors = [];

test.describe('Recursion Demo - Factorial FSM tests', () => {
  test.beforeEach(async ({ page }) => {
    // Reset collectors
    collectedConsoleMessages = [];
    collectedPageErrors = [];

    // Collect console messages (including errors)
    page.on('console', msg => {
      // store type and text for assertions
      collectedConsoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', err => {
      collectedPageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test assert that there were no fatal runtime errors such as ReferenceError, TypeError, SyntaxError.
    // Tests are intended to observe console/page errors; we assert none of these serious errors occurred.
    const fatalNames = ['ReferenceError', 'TypeError', 'SyntaxError'];

    const fatalPageErrors = collectedPageErrors.filter(err => fatalNames.includes(err.name));
    if (fatalPageErrors.length > 0) {
      // Provide details if any fatal errors occurred
      const messages = fatalPageErrors.map(e => `${e.name}: ${e.message}`).join('\n');
      // Fail the test by throwing with collected messages
      throw new Error(`Fatal page errors were observed:\n${messages}`);
    }

    // Also check console error messages for mentions of these fatal error names
    const fatalConsoleMessages = collectedConsoleMessages.filter(m =>
      m.type === 'error' && fatalNames.some(fn => m.text.includes(fn))
    );
    if (fatalConsoleMessages.length > 0) {
      const messages = fatalConsoleMessages.map(m => `console.${m.type}: ${m.text}`).join('\n');
      throw new Error(`Fatal console error messages were observed:\n${messages}`);
    }

    // Clean up listeners to avoid cross-test noise
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial Idle state: input, button, and empty result are present', async ({ page }) => {
    // Validate the page renders expected initial components (FSM S0_Idle evidence)
    const app = new RecursionPage(page);
    await app.goto();

    // Input should exist with correct attributes
    await expect(app.input).toBeVisible();
    await expect(app.input).toHaveAttribute('type', 'number');
    await expect(app.input).toHaveAttribute('min', '0');
    await expect(app.input).toHaveAttribute('placeholder', 'Enter a non-negative integer');

    // Button should exist and have the expected text (event trigger)
    await expect(app.button).toBeVisible();
    await expect(app.button).toHaveText('Calculate Factorial');

    // Result area should be present and initially empty
    await expect(app.result).toBeVisible();
    const initialResult = await app.getResultText();
    expect(initialResult).toBe('', 'Expected #result to be empty on initial render (Idle state).');
  });

  test('Verify FSM entry action presence: renderPage() (onEnter) - check implementation presence', async ({ page }) => {
    // FSM mentioned renderPage() as an entry action for S0_Idle.
    // The implementation does not define renderPage; verify whether it exists without modifying the page.
    const app = new RecursionPage(page);
    await app.goto();

    // Evaluate presence of global renderPage function
    const hasRenderPage = await page.evaluate(() => {
      // We only inspect, do not call or modify anything
      return typeof window.renderPage === 'function';
    });

    // Assert whether the entry action function is implemented.
    // The FSM expected renderPage but the HTML/JS did not implement it. We assert that it's not present.
    expect(hasRenderPage).toBe(false);
  });

  test('Valid input: 5 -> displays "Factorial of 5 is 120."', async ({ page }) => {
    // This validates transition S0_Idle -> S1_ResultDisplayed for a typical positive integer
    const app = new RecursionPage(page);
    await app.goto();

    await app.calculate('5');

    // Wait for the result text to update
    await expect(app.result).toHaveText('Factorial of 5 is 120.');

    // Ensure the displayed text exactly matches FSM evidence
    const resultText = await app.getResultText();
    expect(resultText).toBe('Factorial of 5 is 120.');
  });

  test('Edge case: 0 and 1 both yield factorial 1', async ({ page }) => {
    // Validate S1_ResultDisplayed for n = 0 and n = 1
    const app = new RecursionPage(page);
    await app.goto();

    // 0
    await app.calculate('0');
    await expect(app.result).toHaveText('Factorial of 0 is 1.');
    expect(await app.getResultText()).toBe('Factorial of 0 is 1.');

    // 1
    await app.calculate('1');
    await expect(app.result).toHaveText('Factorial of 1 is 1.');
    expect(await app.getResultText()).toBe('Factorial of 1 is 1.');
  });

  test('Non-integer input "3.5" should be parsed via parseInt and compute factorial(3) => 6', async ({ page }) => {
    // Because the implementation uses parseInt, "3.5" becomes 3; verify the displayed result matches that behavior.
    const app = new RecursionPage(page);
    await app.goto();

    await app.calculate('3.5');

    await expect(app.result).toHaveText('Factorial of 3 is 6.');
    expect(await app.getResultText()).toBe('Factorial of 3 is 6.');
  });

  test('Empty input results in error message (S2_Error)', async ({ page }) => {
    // Empty input should produce the FSM S2_Error state with the corresponding message
    const app = new RecursionPage(page);
    await app.goto();

    // Ensure input is empty and click
    await app.enterNumber('');
    await app.clickCalculate();

    await expect(app.result).toHaveText('Please enter a valid non-negative integer.');
    expect(await app.getResultText()).toBe('Please enter a valid non-negative integer.');
  });

  test('Negative input results in error message (S2_Error)', async ({ page }) => {
    // Negative number should trigger the error path
    const app = new RecursionPage(page);
    await app.goto();

    await app.calculate('-3');

    await expect(app.result).toHaveText('Please enter a valid non-negative integer.');
    expect(await app.getResultText()).toBe('Please enter a valid non-negative integer.');
  });

  test('Large but reasonable input: 10 -> 3628800', async ({ page }) => {
    // Validate correctness for a larger input to ensure recursion works across more calls
    const app = new RecursionPage(page);
    await app.goto();

    await app.calculate('10');
    await expect(app.result).toHaveText('Factorial of 10 is 3628800.');
    expect(await app.getResultText()).toBe('Factorial of 10 is 3628800.');
  });

  test('Sequential interactions update result correctly (multiple transitions)', async ({ page }) => {
    // Verify that multiple successive calculations update the #result element each time
    const app = new RecursionPage(page);
    await app.goto();

    await app.calculate('4');
    await expect(app.result).toHaveText('Factorial of 4 is 24.');
    expect(await app.getResultText()).toBe('Factorial of 4 is 24.');

    await app.calculate('2');
    await expect(app.result).toHaveText('Factorial of 2 is 2.');
    expect(await app.getResultText()).toBe('Factorial of 2 is 2.');

    // Then an invalid input should replace it with the error message
    await app.calculate('');
    await expect(app.result).toHaveText('Please enter a valid non-negative integer.');
    expect(await app.getResultText()).toBe('Please enter a valid non-negative integer.');

    // And a valid input again should update back to a result
    await app.calculate('6');
    await expect(app.result).toHaveText('Factorial of 6 is 720.');
    expect(await app.getResultText()).toBe('Factorial of 6 is 720.');
  });

  test('Observe console and page errors during interactions (no fatal errors expected)', async ({ page }) => {
    // This test intentionally runs through multiple interactions and asserts no fatal runtime errors occurred.
    const app = new RecursionPage(page);
    await app.goto();

    // Perform a variety of actions to potentially reveal runtime errors (if present)
    await app.calculate('3');
    await app.calculate('0');
    await app.calculate('7');
    await app.calculate('');
    await app.calculate('-1');
    await app.calculate('3.9');

    // Final assertion: after the sequence, ensure the most recent result matches the parseInt(3.9) -> 3
    await expect(app.result).toHaveText('Factorial of 3 is 6.');

    // Also check our collectors (the afterEach will check for fatal errors and fail if any were observed).
    // Here we also make explicit assertions to provide clearer failure messages if something unexpected was logged.
    const seriousConsoleErrors = collectedConsoleMessages.filter(m =>
      m.type === 'error' && /(ReferenceError|TypeError|SyntaxError)/.test(m.text)
    );
    expect(seriousConsoleErrors.length).toBe(0);
    const seriousPageErrors = collectedPageErrors.filter(e =>
      ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name)
    );
    expect(seriousPageErrors.length).toBe(0);
  });
});