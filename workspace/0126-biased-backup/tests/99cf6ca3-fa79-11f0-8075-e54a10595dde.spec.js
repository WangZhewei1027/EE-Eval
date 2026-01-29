import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf6ca3-fa79-11f0-8075-e54a10595dde.html';

// Simple page object to encapsulate selectors and actions for the Sliding Window Maximum app
class SlidingWindowPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.windowSize = page.locator('#windowSize');
    this.calculateButton = page.locator('#calculateButton');
    this.resetButton = page.locator('#resetButton');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async enterArray(value) {
    await this.arrayInput.fill(value);
  }

  async setWindowSize(value) {
    // fill accepts string; use toString if number provided
    await this.windowSize.fill(String(value));
  }

  async clickCalculate() {
    await this.calculateButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async getOutputText() {
    return await this.output.innerText();
  }

  async getArrayValue() {
    return await this.arrayInput.inputValue();
  }

  async getWindowSizeValue() {
    return await this.windowSize.inputValue();
  }
}

test.describe('Sliding Window Maximum - FSM states and transitions (App ID: 99cf6ca3-fa79-11f0-8075-e54a10595dde)', () => {
  // Hold console and page error messages for assertions
  let consoleErrors;
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Reset arrays for each test
    consoleErrors = [];
    pageErrors = [];
    consoleMessages = [];

    // Capture console messages and page errors to observe runtime problems without patching the page
    page.on('console', (msg) => {
      const type = msg.type(); // 'log', 'error', 'info', etc.
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', (err) => {
      // Uncaught exceptions in page context
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the page under test exactly as-is
    await page.goto(APP_URL);
  });

  test('Idle state - initial render shows expected elements and defaults', async ({ page }) => {
    // Validate initial Idle state (S0_Idle) as per FSM entry action renderPage()
    const app = new SlidingWindowPage(page);

    // Check that inputs and buttons are present and have expected attributes/defaults
    await expect(app.arrayInput).toBeVisible();
    await expect(app.arrayInput).toHaveAttribute('placeholder', 'e.g. 1,3,-1,-3,5,3,6,7');

    await expect(app.windowSize).toBeVisible();
    // The default value attribute is 3 as per FSM and HTML; inputValue returns string
    expect(await app.getWindowSizeValue()).toBe('3');

    await expect(app.calculateButton).toBeVisible();
    await expect(app.calculateButton).toHaveText('Calculate Maximums');

    await expect(app.resetButton).toBeVisible();
    await expect(app.resetButton).toHaveText('Reset');

    // Output should be empty on idle
    expect(await app.getOutputText()).toBe('');

    // Ensure no uncaught page errors or console errors happened during initial load
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Calculating state - valid input produces correct sliding window maximums', async ({ page }) => {
    // Validate transition S0_Idle -> S1_Calculating via CalculateClick event
    const app = new SlidingWindowPage(page);

    // Enter example input and default window size 3
    await app.enterArray('1,3,-1,-3,5,3,6,7');
    // windowSize defaults to 3; assert it still is 3
    expect(await app.getWindowSizeValue()).toBe('3');

    // Click calculate to trigger computation
    await app.clickCalculate();

    // The output should show the correct sliding window maximums for k=3
    const expected = 'Maximums in each sliding window: 3, 3, 5, 5, 6, 7';
    await expect(app.output).toHaveText(expected);

    // Validate that the DOM retained input values (the code doesn't clear them on calculate)
    expect(await app.getArrayValue()).toBe('1,3,-1,-3,5,3,6,7');
    expect(await app.getWindowSizeValue()).toBe('3');

    // Ensure no uncaught page errors or console errors occurred during calculation
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Calculating state - invalid input yields user-facing error message', async ({ page }) => {
    // Edge/error scenario: empty array input should show a validation message
    const app = new SlidingWindowPage(page);

    // Ensure array is empty and window size is something valid
    await app.enterArray('');
    await app.setWindowSize(3);

    // Click calculate
    await app.clickCalculate();

    // The UI should show the validation message described in FSM/evidence
    await expect(app.output).toHaveText('Please enter valid input and window size.');

    // No uncaught exceptions expected (app handles invalid input gracefully)
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Reset transition from Idle - clicking Reset clears inputs and output', async ({ page }) => {
    // Validate S0_Idle -> S2_Reset via ResetClick event
    const app = new SlidingWindowPage(page);

    // Populate fields first to ensure reset changes them
    await app.enterArray('10,20,30');
    await app.setWindowSize(2);
    await expect(app.arrayInput).toHaveValue('10,20,30');
    await expect(app.windowSize).toHaveValue('2');

    // Click reset
    await app.clickReset();

    // After reset, array input should be empty, window size reset to 3, and output empty
    expect(await app.getArrayValue()).toBe('');
    expect(await app.getWindowSizeValue()).toBe('3');
    expect(await app.getOutputText()).toBe('');

    // Ensure no uncaught page errors or console errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Reset transition from Calculating - calculate then reset returns app to Idle defaults', async ({ page }) => {
    // Validate S1_Calculating -> S0_Idle via ResetClick event
    const app = new SlidingWindowPage(page);

    // Perform a calculation first
    await app.enterArray('1,2,3,4');
    await app.setWindowSize(2);
    await app.clickCalculate();

    // Ensure some output is present after calculation
    await expect(app.output).not.toHaveText('');

    // Now click reset - should clear and return to idle defaults
    await app.clickReset();

    expect(await app.getArrayValue()).toBe('');
    expect(await app.getWindowSizeValue()).toBe('3'); // default per implementation
    expect(await app.getOutputText()).toBe('');

    // Ensure no uncaught page errors or console errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Edge case: window size larger than array length produces empty result list', async ({ page }) => {
    // k > nums.length should yield an empty result (no windows)
    const app = new SlidingWindowPage(page);

    await app.enterArray('1,2');
    await app.setWindowSize(3); // k=3 on array length 2

    await app.clickCalculate();

    // Expected output is the label followed by empty list => trailing space after colon
    await expect(app.output).toHaveText('Maximums in each sliding window: ');

    // Ensure no uncaught page errors or console errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Edge case: non-numeric array elements produce NaN in results (observable behavior)', async ({ page }) => {
    // The implementation only validates the window size; non-numeric items are converted to NaN
    // and will surface as 'NaN' in the output string. We assert the observed behavior (do not patch).
    const app = new SlidingWindowPage(page);

    await app.enterArray('a,b,c');
    await app.setWindowSize(2);

    await app.clickCalculate();

    // Expect the output to include 'NaN' because Number('a') => NaN and the algorithm will push NaN
    const out = await app.getOutputText();
    expect(out).toContain('Maximums in each sliding window:');

    // There should be at least one 'NaN' in the output string (behavior of the current implementation)
    expect(out).toMatch(/NaN/);

    // No uncaught page errors or console errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Console and page error observation - verify no uncaught runtime exceptions on a set of interactions', async ({ page }) => {
    // This test performs a sequence of interactions and asserts there were no page errors or console errors.
    const app = new SlidingWindowPage(page);

    // Sequence of interactions covering main transitions
    await app.enterArray('5,4,3,2,1');
    await app.setWindowSize(2);
    await app.clickCalculate();
    await expect(app.output).toHaveText('Maximums in each sliding window: 5, 4, 3, 2');

    await app.clickReset();
    expect(await app.getArrayValue()).toBe('');
    expect(await app.getWindowSizeValue()).toBe('3');
    expect(await app.getOutputText()).toBe('');

    // Interact with invalid input to trigger UI-level error messaging (not runtime exceptions)
    await app.enterArray('');
    await app.setWindowSize(0);
    await app.clickCalculate();
    await expect(app.output).toHaveText('Please enter valid input and window size.');

    // Finally, verify that no uncaught exceptions were thrown in the page context
    // and no console.error messages were emitted during this test.
    // We capture any such events above via page.on listeners in beforeEach.
    expect(pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
    expect(consoleErrors, 'No console.error messages should have been emitted').toEqual([]);

    // For debugging, also assert that consoleMessages contains typical harmless logs only (optional)
    // This assertion is lenient: we only fail if there are console errors (handled above).
  });
});