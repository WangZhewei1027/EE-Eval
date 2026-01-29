import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b1ea84-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the Fibonacci demo page
class FibPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#fibInput');
    this.calcBtn = page.locator('#calcBtn');
    this.output = page.locator('#output');
  }

  // Navigate to the application page
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Set the input value via the visible input field
  async setInput(value) {
    // Use fill which mimics user typing for number inputs in modern browsers
    await this.input.fill(String(value));
  }

  // Directly set the input value property (useful for non-numeric strings)
  async setInputValueDirect(value) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('fibInput');
      el.value = v;
    }, String(value));
  }

  // Click the Calculate button
  async clickCalculate() {
    await this.calcBtn.click();
  }

  // Return current output text
  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  // Wait until output shows "Calculating..."
  async waitForCalculating(timeout = 2000) {
    await this.page.waitForFunction(() => {
      const el1 = document.getElementById('output');
      return el && el.textContent && el.textContent.includes('Calculating...');
    }, null, { timeout });
  }

  // Wait until output contains a substring indicating final results
  async waitForResultContaining(substring, timeout = 3000) {
    await this.page.waitForFunction((sub) => {
      const el2 = document.getElementById('output');
      return el && el.textContent && el.textContent.includes(sub);
    }, substring, { timeout });
  }
}

test.describe('Dynamic Programming Demo (Fibonacci) - FSM & UI tests', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and errors emitted by the page
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Capture unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Basic sanity: there should be no unexpected runtime errors on the page during tests.
    // We assert that there were zero unhandled page errors and zero console.error messages.
    // This observes console logs and page errors and asserts the observed state.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Initial page elements are present (S0_Idle evidence)', async ({ page }) => {
    // This test validates the presence of core UI elements that evidence the Idle state:
    // - #fibInput input with default value "30"
    // - #calcBtn button
    // - #output div exists
    const fib = new FibPage(page);
    await fib.goto();

    // Assert input and button exist and have expected attributes
    await expect(fib.input).toBeVisible();
    await expect(fib.calcBtn).toBeVisible();
    await expect(fib.output).toBeVisible();

    // The input has a default value (evidence: value="30")
    const val = await fib.input.inputValue();
    expect(val === '30' || val === '30.0').toBeTruthy();

    // The output element exists and contains some initial text (could have been updated by auto-click)
    const outText = await fib.getOutputText();
    expect(typeof outText).toBe('string');
    expect(outText.length).toBeGreaterThan(0);
  });

  test('On page load the app auto-starts calculation and transitions through Calculating -> Result Displayed (S1_Calculating -> S2_ResultDisplayed)', async ({ page }) => {
    // This test validates the automatic transition triggered by window load event:
    // - Immediately after load: output should be "Calculating..."
    // - After the scheduled computation completes: output contains "Fib(30) results"
    const fib1 = new FibPage(page);
    await fib.goto();

    // Wait for the calculating text to appear (entry action of S1_Calculating)
    await fib.waitForCalculating(2000);

    // Ensure 'Calculating...' was indeed visible at some point by checking console messages are captured too.
    // We directly assert the DOM for the existence of that text.
    const calcTextDuring = await fib.getOutputText();
    expect(calcTextDuring).toContain('Calculating...');

    // Now wait for the final result (S2_ResultDisplayed evidence)
    await fib.waitForResultContaining('Fib(30) results', 5000);

    const finalText = await fib.getOutputText();
    expect(finalText).toContain('Fib(30) results');
    // The final result text should include the Memoization and Tabulation lines
    expect(finalText).toContain('Memoization (Top-down DP):');
    expect(finalText).toContain('Tabulation (Bottom-up DP):');
  });

  test('Manual calculation: small n (e.g., n=10) includes naive recursion result (S1 -> S2)', async ({ page }) => {
    // Validate that for a small n, the naive recursion is computed (not skipped)
    const fib2 = new FibPage(page);
    await fib.goto();

    // Set input to 10 and trigger calculation
    await fib.setInput(10);
    await fib.clickCalculate();

    // Wait for 'Calculating...' to appear
    await fib.waitForCalculating(2000);

    // Wait for final result to include Fib(10)
    await fib.waitForResultContaining('Fib(10) results', 5000);

    const out = await fib.getOutputText();
    // Naive recursion should NOT be skipped for n=10
    expect(out).toContain('Naive recursion:');
    expect(out).not.toContain('...skipped for performance');
    // The numeric result for Fib(10) should be visible in Memoization/Tabulation lines as well
    expect(out).toContain('Memoization (Top-down DP): 55');
    expect(out).toContain('Tabulation (Bottom-up DP): 55');
  });

  test('Manual calculation: large n (e.g., n=36) skips naive recursion and shows results for memo and tabulation (S1 -> S2)', async ({ page }) => {
    // Validate that naive recursion is skipped for n > 35
    const fib3 = new FibPage(page);
    await fib.goto();

    await fib.setInput(36);
    await fib.clickCalculate();

    await fib.waitForCalculating(2000);
    await fib.waitForResultContaining('Fib(36) results', 5000);

    const out1 = await fib.getOutputText();
    // For n > 35 the naive recursion should be explicitly skipped
    expect(out).toContain('Naive recursion:           ...skipped for performance (n>35)');
    // Memoization and Tabulation should still present results
    expect(out).toContain('Memoization (Top-down DP):');
    expect(out).toContain('Tabulation (Bottom-up DP):');
  });

  test.describe('Invalid input handling (S3_InvalidInput)', () => {
    test('Input > 50 yields validation error', async ({ page }) => {
      // n = 51 should trigger the invalid input guard and show the specific message
      const fib4 = new FibPage(page);
      await fib.goto();

      await fib.setInput(51);
      await fib.clickCalculate();

      // Because validation happens synchronously before "Calculating...", we can directly assert result
      const out2 = await fib.getOutputText();
      expect(out.trim()).toBe('Please enter an integer n between 0 and 50.');
    });

    test('Negative input yields validation error', async ({ page }) => {
      // n = -1 should trigger the invalid input guard
      const fib5 = new FibPage(page);
      await fib.goto();

      await fib.setInput(-1);
      await fib.clickCalculate();

      const out3 = await fib.getOutputText();
      expect(out.trim()).toBe('Please enter an integer n between 0 and 50.');
    });

    test('Non-integer input (e.g., 3.5) yields validation error', async ({ page }) => {
      // Decimal should be considered non-integer and produce the invalid message
      const fib6 = new FibPage(page);
      await fib.goto();

      // Fill with decimal
      await fib.setInputValueDirect('3.5');
      await fib.clickCalculate();

      const out4 = await fib.getOutputText();
      expect(out.trim()).toBe('Please enter an integer n between 0 and 50.');
    });

    test('Non-numeric string input yields validation error (via direct value set)', async ({ page }) => {
      // Some browsers restrict non-numeric typing in type="number" inputs; we directly set the value property
      // to a non-numeric string and verify the code's validation handles it (Number('abc') => NaN).
      const fib7 = new FibPage(page);
      await fib.goto();

      await fib.setInputValueDirect('abc');
      await fib.clickCalculate();

      const out5 = await fib.getOutputText();
      expect(out.trim()).toBe('Please enter an integer n between 0 and 50.');
    });
  });

  test('Empty input behaves as Number("") === 0 and computes Fib(0)', async ({ page }) => {
    // This test documents an edge-case behavior: leaving the input empty results in Number('') === 0,
    // so the application treats it as n=0 and computes Fib(0).
    const fib8 = new FibPage(page);
    await fib.goto();

    // Clear the input (set to empty string)
    await fib.setInputValueDirect('');
    await fib.clickCalculate();

    // Expect the app to compute Fib(0)
    await fib.waitForCalculating(2000);
    await fib.waitForResultContaining('Fib(0) results', 5000);

    const out6 = await fib.getOutputText();
    expect(out).toContain('Fib(0) results');
    expect(out).toContain('Memoization (Top-down DP): 0');
    expect(out).toContain('Tabulation (Bottom-up DP): 0');
  });

  test('No unexpected runtime errors or console.error messages occurred during interactions', async ({ page }) => {
    // This test exercises a sequence of valid interactions and then asserts that no runtime errors appeared.
    const fib9 = new FibPage(page);
    await fib.goto();

    // Sequence of interactions
    await fib.setInput(5);
    await fib.clickCalculate();
    await fib.waitForResultContaining('Fib(5) results', 3000);

    await fib.setInput(20);
    await fib.clickCalculate();
    await fib.waitForResultContaining('Fib(20) results', 5000);

    await fib.setInputValueDirect('not-a-number');
    await fib.clickCalculate();
    // Expect validation message
    let out7 = await fib.getOutputText();
    expect(out.trim()).toBe('Please enter an integer n between 0 and 50.');

    // After all interactions, ensure no page errors nor console.error messages were recorded
    // Note: afterEach also verifies this, but we include an explicit check here for clarity.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});