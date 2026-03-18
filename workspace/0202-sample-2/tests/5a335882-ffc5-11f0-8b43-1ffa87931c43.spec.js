import { test, expect } from '@playwright/test';

const APP_URL =
  'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a335882-ffc5-11f0-8b43-1ffa87931c43.html';

/**
 * Page Object Model for the Fibonacci demo page
 */
class FibonacciPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.countInput = page.locator('#count');
    this.generateBtn = page.locator('#generateBtn');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async setCount(value) {
    // Use fill to set the input value. Accepts strings and numbers.
    await this.countInput.fill(String(value));
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) || '';
  }

  async waitForOutputContains(substring, timeout = 2000) {
    await expect(this.output).toContainText(substring, { timeout });
  }
}

test.describe('Fibonacci FSM - States and Transitions', () => {
  // Collect console messages and page errors for each test to assert later.
  test.beforeEach(async ({ page }) => {
    // No global setup required beyond what each test does.
  });

  /**
   * Utility to attach listeners for console and page errors.
   * Returns an object with arrays to inspect later.
   */
  async function attachObservers(page) {
    const pageErrors = [];
    const consoleEntries = [];

    page.on('pageerror', (err) => {
      // Capture unhandled exceptions from the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleEntries.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    return { pageErrors, consoleEntries };
  }

  test('Initial load triggers generation (S0_Idle -> S1_Generated) and renders default 10 numbers', async ({ page }) => {
    // This test validates:
    // - The page's window.onload auto-click behavior (FSM S0 entry action)
    // - That the output shows the first 10 Fibonacci numbers
    // - That no uncaught page errors occurred during load
    const observers = await attachObservers(page);
    const fib = new FibonacciPage(page);

    // Navigate to the app. The page's window.onload should auto-click Generate.
    await fib.goto();

    // Wait for the output to reflect the default generation.
    await fib.waitForOutputContains('First 10 Fibonacci numbers', 3000);

    const outputText = await fib.getOutputText();

    // Expected sequence for n = 10
    const expectedSequence = '0, 1, 1, 2, 3, 5, 8, 13, 21, 34';

    // Verify the strong heading text and the numeric sequence are present
    expect(outputText).toContain('First 10 Fibonacci numbers:');
    expect(outputText).toContain(expectedSequence);

    // Verify there were no uncaught page errors (ReferenceError/SyntaxError/TypeError)
    expect(observers.pageErrors.length).toBe(0);

    // Verify no console error-level messages were emitted during load
    const consoleErrors = observers.consoleEntries.filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Generate with n=1 produces exactly "0" and correct header (S1_Generated)', async ({ page }) => {
    // Validate the single-element Fibonacci generation and DOM formatting
    const observers = await attachObservers(page);
    const fib = new FibonacciPage(page);

    await fib.goto();

    // Set to 1 and click Generate
    await fib.setCount(1);
    await fib.clickGenerate();

    // Output should indicate singular "Fibonacci number" and the value 0
    await fib.waitForOutputContains('First 1 Fibonacci number', 2000);
    const outputText = await fib.getOutputText();
    expect(outputText).toContain('First 1 Fibonacci number:');
    // Should contain "0" and not contain a comma (single value)
    expect(outputText).toContain('0');
    expect(outputText).not.toContain(',');

    // No runtime errors should have occurred for this interaction
    expect(observers.pageErrors.length).toBe(0);
  });

  test('Generate with n=2 produces "0, 1"', async ({ page }) => {
    // Validate the two-element Fibonacci generation
    const observers = await attachObservers(page);
    const fib = new FibonacciPage(page);

    await fib.goto();

    await fib.setCount(2);
    await fib.clickGenerate();

    await fib.waitForOutputContains('First 2 Fibonacci numbers', 2000);
    const outputText = await fib.getOutputText();
    expect(outputText).toContain('First 2 Fibonacci numbers:');
    expect(outputText).toContain('0, 1');

    expect(observers.pageErrors.length).toBe(0);
  });

  test('Sequential generates update output correctly (5 then 8)', async ({ page }) => {
    // Validate repeated transitions from S1_Generated to S1_Generated with different inputs
    const observers = await attachObservers(page);
    const fib = new FibonacciPage(page);

    await fib.goto();

    // First generate 5 numbers
    await fib.setCount(5);
    await fib.clickGenerate();
    await fib.waitForOutputContains('First 5 Fibonacci numbers', 2000);
    let outputText = await fib.getOutputText();
    expect(outputText).toContain('0, 1, 1, 2, 3');

    // Then generate 8 numbers
    await fib.setCount(8);
    await fib.clickGenerate();
    await fib.waitForOutputContains('First 8 Fibonacci numbers', 2000);
    outputText = await fib.getOutputText();
    expect(outputText).toContain('0, 1, 1, 2, 3, 5, 8, 13');

    expect(observers.pageErrors.length).toBe(0);
  });

  test('Edge case: n=0 triggers validation alert and does not update output', async ({ page }) => {
    // Validate handling of invalid input (less than 1)
    const observers = await attachObservers(page);
    const fib = new FibonacciPage(page);

    await fib.goto();

    // Listen for the dialog and capture its message
    let dialogMessage = null;
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await fib.setCount(0);
    await fib.clickGenerate();

    // Expect an alert to have been shown with the validation message
    expect(dialogMessage).toBe('Please enter a positive number (at least 1).');

    // Ensure output did not change to show "First 0 Fibonacci..."
    const outputText = await fib.getOutputText();
    expect(outputText).not.toContain('First 0 Fibonacci');

    expect(observers.pageErrors.length).toBe(0);
  });

  test('Edge case: empty input triggers validation alert (NaN path)', async ({ page }) => {
    // Validate behavior when the input is empty (parseInt -> NaN)
    const observers = await attachObservers(page);
    const fib = new FibonacciPage(page);

    await fib.goto();

    let dialogMessage = null;
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    // Clear the input to make it empty
    await fib.setCount('');
    await fib.clickGenerate();

    expect(dialogMessage).toBe('Please enter a positive number (at least 1).');

    expect(observers.pageErrors.length).toBe(0);
  });

  test('Edge case: n > 100 triggers performance alert and is rejected', async ({ page }) => {
    // Validate upper bound enforcement
    const observers = await attachObservers(page);
    const fib = new FibonacciPage(page);

    await fib.goto();

    let dialogMessage = null;
    page.on('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await fib.setCount(101);
    await fib.clickGenerate();

    expect(dialogMessage).toBe(
      'Please enter a number less than or equal to 100 to avoid performance issues.'
    );

    // Ensure output didn't attempt to render 101 numbers (no need to check sequence)
    const outputText = await fib.getOutputText();
    expect(outputText).not.toContain('First 101 Fibonacci');

    expect(observers.pageErrors.length).toBe(0);
  });

  test('Observe console and page errors during interactions (should be none)', async ({ page }) => {
    // This test concentrates on observing console messages and uncaught page errors while performing multiple operations.
    const observers = await attachObservers(page);
    const fib = new FibonacciPage(page);

    await fib.goto();

    // Perform a series of interactions
    await fib.setCount(3);
    await fib.clickGenerate();

    await fib.setCount(7);
    await fib.clickGenerate();

    await fib.setCount(1);
    await fib.clickGenerate();

    // Allow a short time for any asynchronous errors to surface
    await page.waitForTimeout(200);

    // Fail the test if any uncaught errors were emitted
    if (observers.pageErrors.length > 0) {
      // Attach the first error message to help debugging
      const first = observers.pageErrors[0];
      throw new Error(`Uncaught page error detected: ${first.message}`);
    }

    // Also ensure that the console did not log any error-level messages during these interactions.
    const consoleErrors = observers.consoleEntries.filter((c) => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM evidence check: on load the generate button should have been clicked automatically (entry evidence)', async ({ page }) => {
    // This test asserts the specific FSM evidence: window.onload triggers a click on #generateBtn.
    // We validate it by navigating to the page and asserting output is populated without manual click.
    const observers = await attachObservers(page);
    const fib = new FibonacciPage(page);

    // Navigate. The auto-click should happen during load.
    await fib.goto();

    // If the onload auto-click happened, output should display the default generation.
    await fib.waitForOutputContains('First 10 Fibonacci numbers', 3000);
    const outputText = await fib.getOutputText();
    expect(outputText).toContain('0, 1, 1, 2, 3, 5, 8, 13, 21, 34');

    // Confirm no errors occurred as a result of the automatic click
    expect(observers.pageErrors.length).toBe(0);
  });
});