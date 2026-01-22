import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3c35b0-d360-11f0-b42e-71f0e7238799.html';

/**
 * Page Object for the Fibonacci application.
 * Encapsulates interactions with the page's UI elements.
 */
class FibonacciPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('input[type="number"]#numberInput');
    this.button = page.locator('button[onclick="generateFibonacci()"]');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async enterNumber(value) {
    // Use fill to ensure the input value is exactly what we want (allow empty string too)
    await this.input.fill(String(value));
  }

  async clickGenerate() {
    await this.button.click();
  }

  async getResultText() {
    return (await this.result.innerText()).trim();
  }

  async getInputValue() {
    return await this.input.inputValue();
  }

  async buttonOnclickAttribute() {
    return await this.button.getAttribute('onclick');
  }
}

test.describe('Fibonacci Sequence Generator - FSM tests', () => {
  // Capture console errors and page errors for each test to assert no unexpected runtime errors occur.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : null,
        });
      }
    });

    // Collect uncaught page errors (e.g., ReferenceError, TypeError, SyntaxError at runtime)
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });
  });

  test.afterEach(async () => {
    // Assert there are no runtime errors logged to the console or uncaught on the page.
    // This validates that the application loaded and executed without unexpected exceptions.
    expect(consoleErrors, 'No console.error messages should be emitted during the test').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should occur during the test').toEqual([]);
  });

  test('Initial state (S0_Idle): page renders input, button, and an empty result area', async ({ page }) => {
    // Validate initial UI matches FSM Idle state's evidence.
    const app = new FibonacciPage(page);
    await app.goto();

    // Verify input exists, has correct placeholder and is empty
    await expect(app.input).toBeVisible();
    await expect(app.input).toHaveAttribute('placeholder', 'Enter a number');
    const inputValue = await app.getInputValue();
    expect(inputValue).toBe('', 'Input should be empty on initial render');

    // Verify generate button exists and has expected text
    await expect(app.button).toBeVisible();
    await expect(app.button).toHaveText('Generate');

    // Verify result area is present and initially empty
    await expect(app.result).toBeVisible();
    const initialResultText = await app.getResultText();
    expect(initialResultText).toBe('', 'Result area should be empty on initial render');

    // Verify that FSM's entry action evidence (renderPage -> initial DOM) is satisfied by DOM presence.
    // The FSM mentions renderPage(), but the implementation renders statically. We verify the observable evidence.
    // This ensures the initial state is correctly represented in the DOM.
  });

  test('Guard transition to S1_Error: clicking Generate with empty input shows validation error', async ({ page }) => {
    // Validate the transition from Idle -> Error when input is invalid (empty -> NaN guard)
    const app = new FibonacciPage(page);
    await app.goto();

    // Ensure input is empty
    await app.input.fill('');
    await app.clickGenerate();

    // Expect error message in result element as defined by S1_Error evidence
    await expect(app.result).toHaveText('Please enter a valid positive number.');

    // Additional check: after error, the input is still empty
    const inputValue = await app.getInputValue();
    expect(inputValue).toBe('', 'Input should remain empty after error transition');
  });

  test('Guard transition to S1_Error: clicking Generate with negative number shows validation error', async ({ page }) => {
    // Negative numbers should trigger the same error guard: number < 1
    const app = new FibonacciPage(page);
    await app.goto();

    await app.enterNumber(-5);
    await app.clickGenerate();

    await expect(app.result).toHaveText('Please enter a valid positive number.');
  });

  test('Transition to S2_Result: valid input produces correct Fibonacci sequence (e.g., 10)', async ({ page }) => {
    // Validate that a valid input transitions to Result state with expected observable
    const app = new FibonacciPage(page);
    await app.goto();

    // Enter 10 and click generate
    await app.enterNumber(10);
    await app.clickGenerate();

    // Expect the result string to exactly match FSM evidence for S2_Result
    // Based on the implementation the Fibonacci numbers up to 10 are: 0, 1, 1, 2, 3, 5, 8
    const expected = 'Fibonacci sequence up to 10: 0, 1, 1, 2, 3, 5, 8';
    await expect(app.result).toHaveText(expected);
  });

  test('Transition sequence: error then valid input transitions to Result (state recovery)', async ({ page }) => {
    // Validate sequence: Idle -> Error, then Error -> Result by providing valid input afterward
    const app = new FibonacciPage(page);
    await app.goto();

    // Trigger error first
    await app.input.fill('');
    await app.clickGenerate();
    await expect(app.result).toHaveText('Please enter a valid positive number.');

    // Now provide a valid number and generate again
    await app.enterNumber(5);
    await app.clickGenerate();

    // Expect the result to update to the Fibonacci sequence up to 5: 0,1,1,2,3,5
    const expected = 'Fibonacci sequence up to 5: 0, 1, 1, 2, 3, 5';
    await expect(app.result).toHaveText(expected);
  });

  test('Edge case: input of 1 produces the expected Fibonacci sequence up to 1', async ({ page }) => {
    // The implementation starts with [0,1] and pushes nextNumber while nextNumber <= number.
    // For input = 1, we expect fibonacci array to include 0,1,1
    const app = new FibonacciPage(page);
    await app.goto();

    await app.enterNumber(1);
    await app.clickGenerate();

    const expected = 'Fibonacci sequence up to 1: 0, 1, 1';
    await expect(app.result).toHaveText(expected);
  });

  test('UI evidence: button has the expected onclick handler attribute', async ({ page }) => {
    // Validate that the button has an inline onclick handler wired to generateFibonacci() as described in FSM evidence.
    const app = new FibonacciPage(page);
    await app.goto();

    const onclickAttr = await app.buttonOnclickAttribute();
    expect(onclickAttr, 'Button should have onclick attribute invoking generateFibonacci()').toBe('generateFibonacci()');
  });

  test('Robustness: large input computes without throwing and returns a result', async ({ page }) => {
    // Provide a reasonably large input (but not too large to avoid test slowness).
    const app = new FibonacciPage(page);
    await app.goto();

    await app.enterNumber(1000);
    await app.clickGenerate();

    // Ensure some result text is present and starts with the expected prefix
    const resultText = await app.getResultText();
    expect(resultText.startsWith('Fibonacci sequence up to 1000:'), 'Result should indicate the provided limit').toBeTruthy();

    // Sanity check that there are multiple numbers in the output (comma-separated)
    const numbersPart = resultText.split(':')[1] || '';
    const nums = numbersPart.split(',').map(s => s.trim()).filter(Boolean);
    expect(nums.length).toBeGreaterThan(1);
  });

  test('FSM evidence verification: DOM updates reflect expected observable assignments', async ({ page }) => {
    // This test cross-checks the textual evidence strings from the FSM with actual DOM mutations.
    const app = new FibonacciPage(page);
    await app.goto();

    // 1) Invalid -> Error observable
    await app.input.fill('');
    await app.clickGenerate();
    await expect(app.result).toHaveText('Please enter a valid positive number.');

    // 2) Valid -> Result observable
    await app.enterNumber(8);
    await app.clickGenerate();
    const expected = 'Fibonacci sequence up to 8: 0, 1, 1, 2, 3, 5, 8';
    await expect(app.result).toHaveText(expected);
  });
});