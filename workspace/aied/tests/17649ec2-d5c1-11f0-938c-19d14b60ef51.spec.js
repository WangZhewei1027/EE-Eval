import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17649ec2-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object for the Sliding Window page
class SlidingWindowPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#array');
    this.windowInput = page.locator('#windowSize');
    this.calculateButton = page.locator('button[onclick="calculateMaxSum()"]');
    this.output = page.locator('#output');
    this.header = page.locator('h1');
    this.description = page.locator('p').first();
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setArray(value) {
    await this.arrayInput.fill(value);
  }

  async setWindowSize(value) {
    // Playwright treats numbers as strings in fill; use set input value
    await this.windowInput.fill(String(value));
  }

  async clickCalculate() {
    await this.calculateButton.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) || '';
  }

  async getOutputColor() {
    return await this.output.evaluate((el) => getComputedStyle(el).color);
  }

  async headerText() {
    return (await this.header.textContent()) || '';
  }

  async descriptionText() {
    return (await this.description.textContent()) || '';
  }
}

test.describe('Sliding Window Interactive Application (FSM Validation)', () => {
  // Arrays to capture runtime console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  // Attach listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  // Basic smoke test for initial (S0_Idle) rendering and evidence elements
  test('Initial state (S0_Idle) - page renders header, description, inputs and button', async ({ page }) => {
    const p = new SlidingWindowPage(page);
    // Navigate to the application page
    await p.goto();

    // Verify header and description are present (evidence for S0_Idle)
    await expect(p.header).toHaveText('Sliding Window Example');
    await expect(p.description).toContainText('Enter an array of numbers and a window size to see the maximum sum of the window.');

    // Inputs and button existence (evidence of S1_InputReceived components present on the page)
    await expect(p.arrayInput).toBeVisible();
    await expect(p.windowInput).toBeVisible();
    await expect(p.calculateButton).toBeVisible();

    // Check placeholder and attributes
    await expect(p.arrayInput).toHaveAttribute('placeholder', 'Enter numbers, e.g., 1,2,3,4,5');
    await expect(p.windowInput).toHaveAttribute('min', '1');

    // Ensure no runtime exceptions occurred while loading the page
    expect(consoleErrors.length, `Console errors found: ${consoleErrors.map(m => m.text())}`).toBe(0);
    expect(pageErrors.length, `Page errors found: ${pageErrors.map(e => e.message)}`).toBe(0);
  });

  // Transition: Click calculate from Idle (S0) -> InputReceived (S1) -> Error (S2) when inputs are empty
  test('Transition S0 -> S1 -> S2: clicking Calculate with empty inputs shows validation error', async ({ page }) => {
    const p = new SlidingWindowPage(page);
    await p.goto();

    // Click Calculate without providing any inputs
    await p.clickCalculate();

    // Expect the output to show the appropriate validation error message (S2_CalculationError)
    await expect(p.output).toHaveText('Please enter a valid array of numbers and window size.');

    // Confirm the output color is styled (visual feedback) - CSS sets it to green in this app
    const color = await p.getOutputColor();
    // Expect green color present - match "0, 128, 0" which corresponds to green in RGB
    expect(color).toMatch(/0,\s*128,\s*0/, `Expected output color to contain rgb(0, 128, 0) but was "${color}"`);

    // No runtime exceptions should have been thrown by this user action
    expect(consoleErrors.length, `Console errors found: ${consoleErrors.map(m => m.text())}`).toBe(0);
    expect(pageErrors.length, `Page errors found: ${pageErrors.map(e => e.message)}`).toBe(0);
  });

  // Transition: Input provided but window size > n => S2_CalculationError
  test('S1 -> S2: Window size greater than number of elements produces appropriate error', async ({ page }) => {
    const p = new SlidingWindowPage(page);
    await p.goto();

    // Provide a small array and overly large window size
    await p.setArray('1,2,3');
    await p.setWindowSize(5);

    // Click Calculate to trigger validation
    await p.clickCalculate();

    // Verify the error message for window size > n is shown
    await expect(p.output).toHaveText('Window size must be less than or equal to the number of elements in the array.');

    // Ensure there were no unexpected script errors
    expect(consoleErrors.length, `Console errors found: ${consoleErrors.map(m => m.text())}`).toBe(0);
    expect(pageErrors.length, `Page errors found: ${pageErrors.map(e => e.message)}`).toBe(0);
  });

  // Successful calculation: S1 -> S3_CalculationComplete
  test('S1 -> S3: Valid inputs compute maximum sliding window sum correctly', async ({ page }) => {
    const p = new SlidingWindowPage(page);
    await p.goto();

    // Provide valid input and window size
    await p.setArray('1,2,3,4,5');
    await p.setWindowSize(2);

    // Click Calculate and expect the correct computed output
    await p.clickCalculate();

    await expect(p.output).toHaveText('Maximum sum of any window of size 2 is: 9');

    // Also verify visual style remains as expected (output element is styled green)
    const color = await p.getOutputColor();
    expect(color).toMatch(/0,\s*128,\s*0/, `Expected output color to contain rgb(0, 128, 0) but was "${color}"`);

    // No runtime errors
    expect(consoleErrors.length, `Console errors found: ${consoleErrors.map(m => m.text())}`).toBe(0);
    expect(pageErrors.length, `Page errors found: ${pageErrors.map(e => e.message)}`).toBe(0);
  });

  // Edge case: array contains spaces and negative numbers; window size 1
  test('Edge case: array with negative numbers and spaces, window size 1 returns maximum single element', async ({ page }) => {
    const p = new SlidingWindowPage(page);
    await p.goto();

    await p.setArray(' -1,  -2, 3 , 0 ');
    await p.setWindowSize(1);

    await p.clickCalculate();

    // Window size 1 => max element is 3
    await expect(p.output).toHaveText('Maximum sum of any window of size 1 is: 3');

    // No runtime exceptions
    expect(consoleErrors.length, `Console errors found: ${consoleErrors.map(m => m.text())}`).toBe(0);
    expect(pageErrors.length, `Page errors found: ${pageErrors.map(e => e.message)}`).toBe(0);
  });

  // Edge case: non-numeric array entries -> numbers become NaN => sliding sum will be NaN; ensure app shows that result (no internal exception)
  test('Edge case: non-numeric entries produce NaN result (observed behavior - no exception thrown)', async ({ page }) => {
    const p = new SlidingWindowPage(page);
    await p.goto();

    // Provide non-numeric values; the implementation uses Number() which will yield NaN
    await p.setArray('a,b,c');
    await p.setWindowSize(2);

    await p.clickCalculate();

    // The code does not guard against NaN; it will display NaN in the message
    await expect(p.output).toHaveText('Maximum sum of any window of size 2 is: NaN');

    // We assert that this behavior did not cause runtime exceptions (only a NaN result)
    expect(consoleErrors.length, `Console errors found: ${consoleErrors.map(m => m.text())}`).toBe(0);
    expect(pageErrors.length, `Page errors found: ${pageErrors.map(e => e.message)}`).toBe(0);
  });

  // Additional check: decimal window size input is parsed via parseInt - verify behavior
  test('Window size decimal parsing: non-integer window size is truncated via parseInt (behavior verification)', async ({ page }) => {
    const p = new SlidingWindowPage(page);
    await p.goto();

    // Array length 5, we provide window size 2.9 which parseInt becomes 2
    await p.setArray('1,2,3,4,5');
    // Using string to simulate entering 2.9 in number input
    await p.windowInput.fill('2.9');

    await p.clickCalculate();

    // Expected window size used = 2 => max sum 9
    await expect(p.output).toHaveText('Maximum sum of any window of size 2 is: 9');

    // No runtime exceptions
    expect(consoleErrors.length, `Console errors found: ${consoleErrors.map(m => m.text())}`).toBe(0);
    expect(pageErrors.length, `Page errors found: ${pageErrors.map(e => e.message)}`).toBe(0);
  });

  // Verify "onEnter/onExit" evidence where possible:
  // FSM mentions an entry action "renderPage()" for S0_Idle. The HTML does not expose renderPage(), but the presence of header/description is evidence the page rendered.
  test('Verify onEnter evidence for S0_Idle (rendered page elements present)', async ({ page }) => {
    const p = new SlidingWindowPage(page);
    await p.goto();

    // Evidence for S0_Idle: header and explanatory paragraph exist
    await expect(p.header).toHaveText('Sliding Window Example');
    await expect(p.description).toContainText('Enter an array of numbers and a window size to see the maximum sum of the window.');

    // No runtime exceptions occurred during load
    expect(consoleErrors.length, `Console errors found: ${consoleErrors.map(m => m.text())}`).toBe(0);
    expect(pageErrors.length, `Page errors found: ${pageErrors.map(e => e.message)}`).toBe(0);
  });
});