import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b2e533-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the Fibonacci demo area
class FibonacciPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#fib-input');
    this.button = page.locator("button[onclick='runFibonacciDemo()']");
    this.output = page.locator('#fib-output');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async assertHeaderPresent() {
    // Validate initial Idle state evidence: the main header exists with expected text
    await expect(this.header).toHaveText('Dynamic Programming: A Comprehensive Guide');
  }

  async getInputValue() {
    return (await this.input.inputValue()).trim();
  }

  async setInputValue(value) {
    // Using fill to set number input; Playwright will coerce to string
    await this.input.fill(String(value));
  }

  async clickCompute() {
    await this.button.click();
  }

  async getOutputText() {
    // Return the visible text inside the output container, trimmed
    return (await this.output.innerText()).trim();
  }

  async getOutputHTML() {
    return (await this.output.innerHTML()).trim();
  }
}

test.describe('Dynamic Programming - Fibonacci Demo (f0b2e533-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console error messages for each test run
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // Capture unhandled exceptions (ReferenceError, TypeError, SyntaxError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      // Capture console 'error' level messages printed by the page
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async () => {
    // After each test, assert that there were no uncaught page errors or console errors.
    // This verifies the page executed without throwing unexpected exceptions.
    // If the app legitimately produces runtime errors in the environment, these assertions
    // will fail, surfacing the runtime issues as required by the testing policy.
    expect(pageErrors, 'No uncaught page errors should have occurred').toHaveLength(0);
    expect(consoleErrors, 'No console.error messages should have been emitted').toHaveLength(0);
  });

  test('Idle state: page renders header, input, compute button and empty output', async ({ page }) => {
    // Validate S0_Idle: initial rendering of the page and visible components
    const fibPage = new FibonacciPage(page);
    await fibPage.goto();

    // Evidence: header text exists (entry action renderPage() implied by initial HTML)
    await fibPage.assertHeaderPresent();

    // Input should exist and default value should be 10 (from HTML attributes)
    await expect(fibPage.input).toBeVisible();
    const inputVal = await fibPage.getInputValue();
    expect(inputVal).toBe('10');

    // Compute button should exist with correct text
    await expect(fibPage.button).toBeVisible();
    await expect(fibPage.button).toHaveText('Compute');

    // Output area should be visible and initially empty
    await expect(fibPage.output).toBeVisible();
    const outText = (await fibPage.getOutputText()).trim();
    expect(outText).toBe(''); // initially no content
  });

  test('Transition S0 -> S1: Compute Fibonacci for valid input (default n=10)', async ({ page }) => {
    // Validate computing Fibonacci transitions to S1_FibonacciComputed and shows the result
    const fibPage = new FibonacciPage(page);
    await fibPage.goto();

    // Use the default input value (10) and click compute
    await fibPage.clickCompute();

    // Wait for output to be populated; the demo uses synchronous calculation, so no waitFor is strictly needed
    await expect(fibPage.output).not.toHaveText('', { timeout: 2000 });

    // Verify output HTML contains the expected Fibonacci result text and timing info
    const html = await fibPage.getOutputHTML();

    // Should contain the Fibonacci result line and timing lines as per implementation
    expect(html).toContain('Fibonacci(10) ='); // result line present
    expect(html).toMatch(/Naive recursive time:/); // naive timing present
    expect(html).toMatch(/Memoized recursive time:/); // memoized timing present

    // Extract the produced numeric result from the visible text and assert its correctness
    const text = await fibPage.getOutputText();
    const match = text.match(/Fibonacci\((\d+)\)\s*=\s*(\d+)/);
    expect(match, 'Output should contain "Fibonacci(n) = result"').not.toBeNull();

    const n = Number(match[1]);
    const result = Number(match[2]);

    // Basic sanity check: Fibonacci(10) === 55
    if (n === 10) {
      expect(result).toBe(55);
    } else {
      // If different n was used for some reason, recompute expected value with iterative algorithm
      const computeFibIterative = (k) => {
        if (k <= 1) return k;
        let a = 0, b = 1;
        for (let i = 2; i <= k; i++) {
          const c = a + b;
          a = b;
          b = c;
        }
        return b;
      };
      expect(result).toBe(computeFibIterative(n));
    }
  });

  test('Transition S0 -> S1: Compute Fibonacci for small values (n=0 and n=1)', async ({ page }) => {
    // Validate edge cases for n = 0 and n = 1 produce correct outputs
    const fibPage = new FibonacciPage(page);
    await fibPage.goto();

    // Test n = 0
    await fibPage.setInputValue(0);
    await fibPage.clickCompute();
    await expect(fibPage.output).not.toHaveText('', { timeout: 2000 });
    const text0 = await fibPage.getOutputText();
    expect(text0).toContain('Fibonacci(0) = 0');

    // Test n = 1
    await fibPage.setInputValue(1);
    await fibPage.clickCompute();
    await expect(fibPage.output).not.toHaveText('', { timeout: 2000 });
    const text1 = await fibPage.getOutputText();
    expect(text1).toContain('Fibonacci(1) = 1');
  });

  test('Transition S0 -> S2: Invalid input values produce Error state', async ({ page }) => {
    // Validate S2_Error when input is out-of-range or not a number
    const fibPage = new FibonacciPage(page);
    await fibPage.goto();

    // Edge case: negative number
    await fibPage.setInputValue(-1);
    await fibPage.clickCompute();
    await expect(fibPage.output).not.toHaveText('', { timeout: 2000 });
    let out = (await fibPage.getOutputText()).trim();
    expect(out).toBe('Please enter a number between 0 and 40');

    // Edge case: greater than max (41)
    await fibPage.setInputValue(41);
    await fibPage.clickCompute();
    out = (await fibPage.getOutputText()).trim();
    expect(out).toBe('Please enter a number between 0 and 40');

    // Edge case: empty / non-number (clear the input)
    await fibPage.setInputValue('');
    await fibPage.clickCompute();
    out = (await fibPage.getOutputText()).trim();
    expect(out).toBe('Please enter a number between 0 and 40');

    // Edge case: non-integer numeric input (browser number input may enforce numeric strings; nevertheless test a decimal)
    await fibPage.setInputValue('3.14');
    await fibPage.clickCompute();
    // parseInt(3.14) => 3, so this should compute Fibonacci(3) = 2 rather than error
    await expect(fibPage.output).not.toHaveText('', { timeout: 2000 });
    const text = await fibPage.getOutputText();
    expect(text).toContain('Fibonacci(3) = 2');
  });

  test('Transition S0 -> S1: Verify that clicking the Compute button triggers runFibonacciDemo (event handler exists)', async ({ page }) => {
    // Validate that the Compute button is wired to the runFibonacciDemo() handler via onclick attribute
    const fibPage = new FibonacciPage(page);
    await fibPage.goto();

    // Check that the button has the expected onclick attribute string in the DOM
    const onclickAttr = await page.locator("button[onclick='runFibonacciDemo()']").getAttribute('onclick');
    expect(onclickAttr).toBe('runFibonacciDemo()');

    // Click and verify output is produced (sanity check for transition)
    await fibPage.clickCompute();
    await expect(fibPage.output).not.toHaveText('', { timeout: 2000 });
    const text = await fibPage.getOutputText();
    expect(text).toMatch(/Fibonacci\(\d+\)\s*=\s*\d+/);
  });

  test('Sanity check: output includes both naive and memoized timings for moderate n', async ({ page }) => {
    // Validate that the UI provides both naive and memoized timings in the UI text
    const fibPage = new FibonacciPage(page);
    await fibPage.goto();

    // Use n=12 (moderate) to get measurable times but still reasonably fast
    await fibPage.setInputValue(12);
    await fibPage.clickCompute();

    // Ensure the output contains the two timing lines
    const text = await fibPage.getOutputText();
    expect(text).toMatch(/Naive recursive time:.*ms/);
    expect(text).toMatch(/Memoized recursive time:.*ms/);
  });

  test('Observability: track console and page errors while interacting', async ({ page }) => {
    // This test deliberately interacts with the page while verifying we capture any runtime exceptions.
    // It does not assume errors are present; afterEach will assert none occurred.
    const fibPage = new FibonacciPage(page);
    await fibPage.goto();

    // Perform a sequence of interactions
    await fibPage.setInputValue(6);
    await fibPage.clickCompute();
    await expect(fibPage.output).not.toHaveText('', { timeout: 2000 });

    await fibPage.setInputValue(20);
    await fibPage.clickCompute();
    await expect(fibPage.output).not.toHaveText('', { timeout: 5000 });

    // Intentionally attempt a quick invalid input to trigger the error handling path
    await fibPage.setInputValue('not-a-number');
    await fibPage.clickCompute();

    // Confirm the error message is shown for invalid input (since parseInt('not-a-number') -> NaN)
    const out = (await fibPage.getOutputText()).trim();
    expect(out).toBe('Please enter a number between 0 and 40');

    // The afterEach will assert that no uncaught exceptions or console.error messages were emitted.
  });
});