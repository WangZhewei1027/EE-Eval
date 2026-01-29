import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e2314-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Fibonacci demo page
class FibonacciPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#numInput');
    this.button = page.locator('button[onclick="calculateFibonacci()"]');
    this.result = page.locator('#result');

    // For collecting console messages and page errors per test instance
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  // Attach listeners to capture console messages and page errors
  async attachListeners() {
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  // Navigate to the app URL and wait for initial render
  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the input to be visible as an indication of render complete
    await expect(this.input).toBeVisible();
  }

  // Set the numeric input value (as string)
  async setInput(value) {
    // Use fill to set the input value; works for type=number as well
    await this.input.fill(String(value));
  }

  // Clear the input (make it empty)
  async clearInput() {
    await this.input.fill('');
  }

  // Click the calculate button
  async clickCalculate() {
    await this.button.click();
  }

  // Get result text content
  async getResultText() {
    return await this.result.textContent();
  }

  // Helper to assert no console errors or page errors occurred during the test
  assertNoConsoleOrPageErrors() {
    const errorConsole = this.consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // Assert there were no console.error/warning messages
    expect(errorConsole, `Expected no console errors/warnings, found: ${JSON.stringify(errorConsole)}`)
      .toHaveLength(0);
    // Assert there were no uncaught page errors
    expect(this.pageErrors, `Expected no page errors, found: ${this.pageErrors.map(e => String(e))}`)
      .toHaveLength(0);
  }
}

test.describe('Dynamic Programming Demo - Fibonacci (FSM Validation)', () => {
  // Group of tests covering all FSM states and transitions described in the specification

  // Test the Idle state (S0_Idle) renders correctly
  test('Idle state renders input, button and empty result (S0_Idle)', async ({ page }) => {
    const fibPage = new FibonacciPage(page);
    await fibPage.attachListeners();

    // Navigate to the page (this represents the S0 entry action renderPage())
    await fibPage.goto();

    // Validate presence of input with correct attributes (evidence from FSM S0_Idle)
    await expect(fibPage.input).toHaveAttribute('type', 'number');
    await expect(fibPage.input).toHaveAttribute('min', '0');
    // Default value is "0"
    await expect(fibPage.input).toHaveValue('0');

    // Validate presence of the Calculate Fibonacci button (evidence from FSM S0_Idle)
    await expect(fibPage.button).toHaveCount(1);
    await expect(fibPage.button).toBeVisible();

    // Result should be empty on initial render
    await expect(fibPage.result).toHaveText('', { timeout: 1000 });

    // Ensure no console errors or page errors occurred during initial render
    fibPage.assertNoConsoleOrPageErrors();
  });

  test.describe('Transitions and Outcomes', () => {
    // Transition: S0_Idle -> S1_Calculating (user clicks button)
    // Then either S1_Calculating -> S3_Result (valid n) or S1_Calculating -> S2_Error (invalid n)

    test('Valid input leads to result (transition S0 -> S1 -> S3_Result)', async ({ page }) => {
      const fibPage1 = new FibonacciPage(page);
      await fibPage.attachListeners();
      await fibPage.goto();

      // Set n = 10 and click Calculate (10 => Fibonacci(10) = 55)
      await fibPage.setInput('10');

      // Click triggers calculateFibonacci() (this is the S0->S1 event "CalculateFibonacci")
      await fibPage.clickCalculate();

      // After calculation expect the result element to show correct computed value
      await expect(fibPage.result).toHaveText('Fibonacci(10) = 55', { timeout: 2000 });

      // Also ensure no console/page errors
      fibPage.assertNoConsoleOrPageErrors();
    });

    test('Edge case n = 0 and n = 1 produce correct results', async ({ page }) => {
      const fibPage2 = new FibonacciPage(page);
      await fibPage.attachListeners();
      await fibPage.goto();

      // n = 0 => Fibonacci(0) = 0
      await fibPage.setInput('0');
      await fibPage.clickCalculate();
      await expect(fibPage.result).toHaveText('Fibonacci(0) = 0', { timeout: 2000 });

      // n = 1 => Fibonacci(1) = 1
      await fibPage.setInput('1');
      await fibPage.clickCalculate();
      await expect(fibPage.result).toHaveText('Fibonacci(1) = 1', { timeout: 2000 });

      fibPage.assertNoConsoleOrPageErrors();
    });

    test('Large n produces correct Fibonacci number (performance + correctness)', async ({ page }) => {
      const fibPage3 = new FibonacciPage(page);
      await fibPage.attachListeners();
      await fibPage.goto();

      // Use n = 40 which should be reasonably fast and equals 102334155
      await fibPage.setInput('40');
      await fibPage.clickCalculate();

      await expect(fibPage.result).toHaveText('Fibonacci(40) = 102334155', { timeout: 5000 });

      fibPage.assertNoConsoleOrPageErrors();
    });

    test('Invalid input: negative number transitions to Error state (S1 -> S2_Error)', async ({ page }) => {
      const fibPage4 = new FibonacciPage(page);
      await fibPage.attachListeners();
      await fibPage.goto();

      // Set negative number
      await fibPage.setInput('-5');
      await fibPage.clickCalculate();

      // Expect error message as described in S2_Error evidence
      await expect(fibPage.result).toHaveText('Please enter a non-negative integer.', { timeout: 2000 });

      fibPage.assertNoConsoleOrPageErrors();
    });

    test('Invalid input: empty input transitions to Error state (S1 -> S2_Error)', async ({ page }) => {
      const fibPage5 = new FibonacciPage(page);
      await fibPage.attachListeners();
      await fibPage.goto();

      // Clear input to create NaN when parsed
      await fibPage.clearInput();
      await fibPage.clickCalculate();

      // Expect the same error message
      await expect(fibPage.result).toHaveText('Please enter a non-negative integer.', { timeout: 2000 });

      fibPage.assertNoConsoleOrPageErrors();
    });

    test('Non-integer decimal input is parsed by parseInt and handled accordingly', async ({ page }) => {
      const fibPage6 = new FibonacciPage(page);
      await fibPage.attachListeners();
      await fibPage.goto();

      // Enter a decimal value. parseInt('4.7') -> 4, so result should be Fibonacci(4) = 3
      await fibPage.setInput('4.7');
      await fibPage.clickCalculate();

      // Expect the page to show Fibonacci(4) = 3 due to parseInt behavior
      await expect(fibPage.result).toHaveText('Fibonacci(4) = 3', { timeout: 2000 });

      fibPage.assertNoConsoleOrPageErrors();
    });
  });

  test.describe('Robustness checks and FSM evidence validation', () => {
    test('Button click triggers calculation function (observable through DOM update)', async ({ page }) => {
      const fibPage7 = new FibonacciPage(page);
      await fibPage.attachListeners();
      await fibPage.goto();

      // Evidence: clicking the button should cause calculateFibonacci() to run and update #result
      await fibPage.setInput('7'); // Fibonacci(7) = 13
      await fibPage.clickCalculate();

      // Verify the evidence string in FSM: result innerText updated to contain "Fibonacci(7) = 13"
      await expect(fibPage.result).toHaveText('Fibonacci(7) = 13', { timeout: 2000 });

      fibPage.assertNoConsoleOrPageErrors();
    });

    test('Validate that initial page contains the components listed in the FSM components list', async ({ page }) => {
      const fibPage8 = new FibonacciPage(page);
      await fibPage.attachListeners();
      await fibPage.goto();

      // Check input exists
      await expect(fibPage.input).toBeVisible();
      // Check button exists and has expected text
      await expect(fibPage.button).toHaveText('Calculate Fibonacci');
      // Check result container exists
      await expect(fibPage.result).toBeVisible();

      fibPage.assertNoConsoleOrPageErrors();
    });
  });
});