import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79dd920-d361-11f0-8438-11a56595a476.html';

// Page Object Model for the Recursion Demo page
class RecursionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.numberInput = page.locator('#number');
    this.calcButton = page.locator('#calcBtn');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getInputValue() {
    return (await this.numberInput.inputValue()).toString();
  }

  async setNumber(value) {
    // Use fill so empty string can be set
    await this.numberInput.fill(String(value));
  }

  async clickCalculate() {
    await this.calcButton.click();
  }

  async waitForCalculating(timeout = 1000) {
    await expect(this.output).toHaveText('Calculating...', { timeout });
  }

  async waitForFinalResultContaining(text, timeout = 2000) {
    // Wait until output contains the expected final result text
    await expect(this.output).toContainText(text, { timeout });
  }

  async getOutputText() {
    return await this.output.textContent();
  }
}

test.describe('Recursion Demo (FSM) - d79dd920-d361-11f0-8438-11a56595a476', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    pageErrors = [];
    consoleMessages = [];

    // Collect console messages and page errors for assertions
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // Capture page errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });
  });

  // Validate the Idle state and initial render
  test('Idle state: initial render shows input default and calc button, output empty', async ({ page }) => {
    const app = new RecursionPage(page);
    // Load the page exactly as-is
    await app.goto();

    // Verify expected DOM components exist per FSM "evidence"
    await expect(app.numberInput).toBeVisible();
    await expect(app.calcButton).toBeVisible();
    await expect(app.output).toBeVisible();

    // The input has default value "5" in the HTML - validate it (Idle state's evidence)
    const initialValue = await app.getInputValue();
    expect(initialValue).toBe('5');

    // Output should be empty initially
    const outputText = (await app.getOutputText()) ?? '';
    expect(outputText.trim()).toBe('');

    // Confirm no unexpected page errors occurred on initial render
    expect(pageErrors.length).toBe(0);
    // Ensure there are no console error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Transitions and States', () => {
    // Test the transition from Idle -> Calculating (on button click)
    test('Transition: Idle -> Calculating shows "Calculating..." immediately on click', async ({ page }) => {
      const app = new RecursionPage(page);
      await app.goto();

      // Click the Calculate Factorial button and verify Calculating... is shown
      await app.clickCalculate();

      // The FSM S1_Calculating entry action: output.textContent = 'Calculating...';
      await app.waitForCalculating();

      // Ensure no page errors occurred during the transition
      expect(pageErrors.length).toBe(0);

      // Make sure console didn't emit an error-level message
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    // Test the full calculation path to Result state for a typical value
    test('Transition: Calculating -> Result produces trace and final result for n=5', async ({ page }) => {
      const app = new RecursionPage(page);
      await app.goto();

      // Ensure input is 5 (default) to match FSM example
      const defaultValue = await app.getInputValue();
      expect(defaultValue).toBe('5');

      // Click calculate and observe 'Calculating...' then final output
      await app.clickCalculate();

      // Verify Calculating transitional state
      await app.waitForCalculating();

      // Wait for final output to show result for factorial(5) = 120
      await app.waitForFinalResultContaining('Final Result: factorial(5) = 120');

      const finalOutput = (await app.getOutputText()) ?? '';
      // Check that trace contains expected recursion messages
      expect(finalOutput).toContain('factorial(5) called');
      expect(finalOutput).toContain('Base case reached, factorial(0) = 1' || 'Base case reached, factorial(1) = 1');
      expect(finalOutput).toContain('Final Result: factorial(5) = 120');

      // Verify no page errors or console errors during calculation
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    // Edge cases: n = 0 and n = 1 should both return 1 and show base case trace
    test('Result state for edge inputs: n=0 and n=1 show base case and final result = 1', async ({ page }) => {
      const app = new RecursionPage(page);
      await app.goto();

      // Test n = 0
      await app.setNumber(0);
      await app.clickCalculate();
      await app.waitForCalculating();
      await app.waitForFinalResultContaining('Final Result: factorial(0) = 1');
      let out = (await app.getOutputText()) ?? '';
      expect(out).toContain('Base case reached, factorial(0) = 1');
      expect(out).toContain('Final Result: factorial(0) = 1');

      // Test n = 1
      await app.setNumber(1);
      await app.clickCalculate();
      await app.waitForCalculating();
      await app.waitForFinalResultContaining('Final Result: factorial(1) = 1');
      out = (await app.getOutputText()) ?? '';
      expect(out).toContain('Base case reached, factorial(1) = 1');
      expect(out).toContain('Final Result: factorial(1) = 1');

      // No page errors introduced
      expect(pageErrors.length).toBe(0);
    });

    // Test large but valid input (max allowed 12)
    test('Result state for maximum allowed input n=12 produces correct final result', async ({ page }) => {
      const app = new RecursionPage(page);
      await app.goto();

      await app.setNumber(12);
      await app.clickCalculate();

      // Verify transitional state
      await app.waitForCalculating();

      // Factorial(12) = 479001600
      await app.waitForFinalResultContaining('Final Result: factorial(12) = 479001600', 5000);

      const out = (await app.getOutputText()) ?? '';
      expect(out).toContain('factorial(12) called');
      expect(out).toContain('Final Result: factorial(12) = 479001600');

      expect(pageErrors.length).toBe(0);
    });

    // Error transitions and guards: invalid inputs should go to Error state
    test('Error state: invalid inputs (negative, >12, empty) show error message', async ({ page }) => {
      const app = new RecursionPage(page);
      await app.goto();

      // Helper to assert error behavior
      const assertErrorFor = async (value) => {
        await app.setNumber(value);
        await app.clickCalculate();
        // Error is set synchronously in the handler if guard fails
        await expect(app.output).toHaveText('Please enter a valid number between 0 and 12.');
        const out = (await app.getOutputText()) ?? '';
        expect(out.trim()).toBe('Please enter a valid number between 0 and 12.');
      };

      // Negative number
      await assertErrorFor(-1);

      // Greater than 12
      await assertErrorFor(13);

      // Empty input -> parseInt('') => NaN -> error
      await app.setNumber(''); // clear input
      await app.clickCalculate();
      await expect(app.output).toHaveText('Please enter a valid number between 0 and 12.');

      // Confirm no page errors occurred during error handling
      expect(pageErrors.length).toBe(0);
    });
  });

  // Validate console and page errors overall for completeness
  test('Console and page errors are observed and reported (no unexpected runtime errors)', async ({ page }) => {
    const app = new RecursionPage(page);
    await app.goto();

    // Prime some interactions to potentially trigger errors
    // 1. Valid calculation
    await app.setNumber(3);
    await app.clickCalculate();
    await app.waitForCalculating();
    await app.waitForFinalResultContaining('Final Result: factorial(3) = 6');

    // 2. Invalid calculation
    await app.setNumber('invalid'); // this will produce NaN
    await app.clickCalculate();
    await expect(app.output).toHaveText('Please enter a valid number between 0 and 12.');

    // At this point, capture the aggregated errors and console messages
    // The application as provided should not produce runtime exceptions, assert that
    expect(pageErrors.length).toBe(0);

    // Ensure console didn't emit error messages during interactions
    const consoleErrorMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    expect(consoleErrorMessages.length).toBe(0);

    // But record the presence of console logs (if any) for debugging visibility
    // Ensure that consoleMessages is an array (test-level check)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});