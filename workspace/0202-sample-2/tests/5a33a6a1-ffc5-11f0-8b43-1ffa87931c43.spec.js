import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a33a6a1-ffc5-11f0-8b43-1ffa87931c43.html';

// Page Object Model for the Recursion Demonstration page
class RecursionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#inputNumber');
    this.computeBtn = page.locator('#computeBtn');
    this.resultArea = page.locator('#resultArea');
    this.traceArea = page.locator('#traceArea');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for main elements to be visible
    await Promise.all([
      this.input.waitFor({ state: 'visible' }),
      this.computeBtn.waitFor({ state: 'visible' }),
      this.resultArea.waitFor({ state: 'attached' }),
      this.traceArea.waitFor({ state: 'attached' }),
    ]);
  }

  async setInput(value) {
    // use fill to set the input value; accepts string or number
    await this.input.fill(String(value));
  }

  async clearInput() {
    await this.input.fill('');
  }

  async clickCompute() {
    await this.computeBtn.click();
  }

  async getResultText() {
    return await this.resultArea.textContent();
  }

  async getResultHTML() {
    return await this.resultArea.innerHTML();
  }

  async getTraceText() {
    return await this.traceArea.textContent();
  }
}

test.describe('Recursion Demonstration - End-to-End FSM Tests', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for observation
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // store the error object for assertions later
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test, ensure we cleared state of listeners (they are per-page in Playwright)
    // This hook is kept for symmetry and potential future cleanup.
  });

  test('S0_Idle: Initial render shows input, compute button, empty result and trace', async ({ page }) => {
    const rp = new RecursionPage(page);
    // Navigate to the app
    await rp.goto();

    // Validate initial UI components (evidence for Idle state)
    // Input should be visible and have default value 5 (as per HTML)
    await expect(rp.input).toBeVisible();
    const inputValue = await rp.input.inputValue();
    expect(inputValue).toBe('5'); // default value in the HTML

    // Compute button should be visible and enabled
    await expect(rp.computeBtn).toBeVisible();
    await expect(rp.computeBtn).toBeEnabled();

    // resultArea and traceArea should be empty at start
    const resultText = await rp.getResultText();
    const traceText = await rp.getTraceText();
    expect(resultText === null || resultText.trim() === '').toBeTruthy();
    expect(traceText === null || traceText.trim() === '').toBeTruthy();

    // Inspect console and runtime errors - there should be no uncaught page errors on initial load
    // We observe and assert no ReferenceError/SyntaxError/TypeError occurred during load
    const errorNames = pageErrors.map(e => e.name);
    expect(errorNames).not.toContain('ReferenceError');
    expect(errorNames).not.toContain('SyntaxError');
    expect(errorNames).not.toContain('TypeError');
  });

  test('S1_ValidInput: Compute valid input n=5 yields correct factorial and fibonacci, traces populated', async ({ page }) => {
    const rp = new RecursionPage(page);
    await rp.goto();

    // Ensure the input is set to 5 (default), click compute
    await rp.setInput(5);
    await rp.clickCompute();

    // After clicking, resultArea.innerHTML should contain Results for n = 5 and the numeric results
    const resultHTML = await rp.getResultHTML();
    expect(resultHTML).toContain('Results for n = 5');
    expect(resultHTML).toContain('Factorial(5) = 120');
    expect(resultHTML).toContain('Fibonacci(5) = 5');

    // Trace area should show both Factorial Trace and Fibonacci Trace with recursive calls included
    const traceText = await rp.getTraceText();
    expect(traceText).toContain('Factorial Trace:');
    expect(traceText).toContain('factorial(5) called.');
    expect(traceText).toContain('factorial(0) = 1 (base case)');
    expect(traceText).toContain('Fibonacci Trace:');
    expect(traceText).toContain('fibonacci(5) called.');
    expect(traceText).toContain('fibonacci(0) = 0 (base case)');

    // Confirm no uncaught runtime errors occurred during computation
    const errorNames = pageErrors.map(e => e.name);
    expect(errorNames).not.toContain('ReferenceError');
    expect(errorNames).not.toContain('SyntaxError');
    expect(errorNames).not.toContain('TypeError');

    // Also capture console errors if any (none expected); make sure there were no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge Case: n = 0 (base cases) yields factorial 1 and fibonacci 0 with proper base case traces', async ({ page }) => {
    const rp = new RecursionPage(page);
    await rp.goto();

    await rp.setInput(0);
    await rp.clickCompute();

    const resultHTML = await rp.getResultHTML();
    expect(resultHTML).toContain('Results for n = 0');
    expect(resultHTML).toContain('Factorial(0) = 1');
    expect(resultHTML).toContain('Fibonacci(0) = 0');

    const traceText = await rp.getTraceText();
    // Base case traces must appear for both functions
    expect(traceText).toContain('factorial(0) = 1 (base case)');
    expect(traceText).toContain('fibonacci(0) = 0 (base case)');

    // No runtime errors expected
    const errorNames = pageErrors.map(e => e.name);
    expect(errorNames).not.toContain('ReferenceError');
    expect(errorNames).not.toContain('SyntaxError');
    expect(errorNames).not.toContain('TypeError');
  });

  test('S2_InvalidInput: Empty input or negative input triggers invalid input state with message and cleared trace', async ({ page }) => {
    const rp = new RecursionPage(page);
    await rp.goto();

    // Scenario A: Empty input
    await rp.clearInput();
    await rp.clickCompute();

    let resultText = (await rp.getResultText()) || '';
    let traceText = (await rp.getTraceText()) || '';
    expect(resultText.trim()).toBe('Please enter a valid non-negative integer.');
    expect(traceText.trim()).toBe('');

    // Scenario B: Negative input
    await rp.setInput(-3);
    await rp.clickCompute();

    resultText = (await rp.getResultText()) || '';
    traceText = (await rp.getTraceText()) || '';
    expect(resultText.trim()).toBe('Please enter a valid non-negative integer.');
    expect(traceText.trim()).toBe('');

    // No runtime errors expected for validation paths
    const errorNames = pageErrors.map(e => e.name);
    expect(errorNames).not.toContain('ReferenceError');
    expect(errorNames).not.toContain('SyntaxError');
    expect(errorNames).not.toContain('TypeError');
  });

  test('S3_ExceedsLimit: Input greater than 30 shows performance warning and clears trace', async ({ page }) => {
    const rp = new RecursionPage(page);
    await rp.goto();

    // Set n = 31 (exceeds recommended limit) and click compute
    await rp.setInput(31);
    await rp.clickCompute();

    const resultText = (await rp.getResultText()) || '';
    const traceText = (await rp.getTraceText()) || '';

    expect(resultText.trim()).toBe('Please enter a number 30 or less for performance reasons.');
    expect(traceText.trim()).toBe('');

    // No runtime errors expected for limit handling path
    const errorNames = pageErrors.map(e => e.name);
    expect(errorNames).not.toContain('ReferenceError');
    expect(errorNames).not.toContain('SyntaxError');
    expect(errorNames).not.toContain('TypeError');
  });

  test('Additional validation: n = 1 yields correct base case results and trace messages', async ({ page }) => {
    const rp = new RecursionPage(page);
    await rp.goto();

    await rp.setInput(1);
    await rp.clickCompute();

    const resultHTML = await rp.getResultHTML();
    expect(resultHTML).toContain('Results for n = 1');
    expect(resultHTML).toContain('Factorial(1) = 1');
    expect(resultHTML).toContain('Fibonacci(1) = 1');

    const traceText = await rp.getTraceText();
    expect(traceText).toContain('factorial(1) = 1 (base case)');
    expect(traceText).toContain('fibonacci(1) = 1 (base case)');

    const errorNames = pageErrors.map(e => e.name);
    expect(errorNames).not.toContain('ReferenceError');
    expect(errorNames).not.toContain('SyntaxError');
    expect(errorNames).not.toContain('TypeError');
  });

  test('Observes console logs and runtime errors: capture and assert no uncaught exceptions of common types', async ({ page }) => {
    const rp = new RecursionPage(page);
    await rp.goto();

    // Interact with the page to cause computations that may surface runtime errors
    await rp.setInput(7);
    await rp.clickCompute();

    // Wait a bit for traces to populate and any potential async errors (though logic is synchronous)
    await page.waitForTimeout(200);

    // Log captured console messages summary (kept as test-time diagnostics)
    // Assert that there were no uncaught runtime errors of types ReferenceError, SyntaxError, or TypeError
    const errorNames = pageErrors.map(e => e.name);
    // These expectations ensure that the page ran without uncaught critical JS errors.
    expect(errorNames).not.toContain('ReferenceError');
    expect(errorNames).not.toContain('SyntaxError');
    expect(errorNames).not.toContain('TypeError');

    // Additionally assert there were no console messages of type 'error'
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });
});