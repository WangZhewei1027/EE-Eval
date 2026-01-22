import { test, expect } from '@playwright/test';

// Test file for Counting Sort Demonstration interactive page
// Filename requirement: d79ceec0-d361-11f0-8438-11a56595a476.spec.js
// URL: http://127.0.0.1:5500/workspace/batch-1207/html/d79ceec0-d361-11f0-8438-11a56595a476.html

// Page Object Model for the Counting Sort page
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.inputSelector = '#inputArray';
    this.buttonSelector = '#sortButton';
    this.errorSelector = '#errorMsg';
    this.outputSelector = '#output';
    this.stepSelector = '#output .step';
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/batch-1207/html/d79ceec0-d361-11f0-8438-11a56595a476.html', { waitUntil: 'domcontentloaded' });
    // Ensure main elements are available
    await Promise.all([
      this.page.waitForSelector(this.inputSelector),
      this.page.waitForSelector(this.buttonSelector),
      this.page.waitForSelector(this.errorSelector),
      this.page.waitForSelector(this.outputSelector)
    ]);
  }

  async fillInput(value) {
    await this.page.fill(this.inputSelector, value);
  }

  async clickSort() {
    await this.page.click(this.buttonSelector);
  }

  async getErrorText() {
    return (await this.page.locator(this.errorSelector).innerText()).trim();
  }

  async getOutputStepsText() {
    const steps = await this.page.locator(this.stepSelector).allTextContents();
    return steps.map(s => s.trim());
  }

  async getOutputInnerHTML() {
    return await this.page.$eval(this.outputSelector, el => el.innerHTML);
  }

  async getLastOutputText() {
    const steps = await this.getOutputStepsText();
    return steps.length ? steps[steps.length - 1] : '';
  }

  async clearInput() {
    await this.page.fill(this.inputSelector, '');
  }
}

test.describe('Counting Sort Demonstration - FSM and UI tests', () => {

  // Global listeners per test to collect console errors and page errors.
  // Each test will assert that no unexpected runtime errors occurred.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors for assertions
    page.on('console', msg => {
      // Collect error-level console messages separately for diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.describe('Initial State (S0_Idle)', () => {
    test('renders main components on load (entry action: renderPage)', async ({ page }) => {
      // Validate that the initial page renders the input, button, error, and output elements
      const app = new CountingSortPage(page);
      await app.goto();

      // Assert presence and attributes
      await expect(page.locator(app.inputSelector)).toBeVisible();
      await expect(page.locator(app.inputSelector)).toHaveAttribute('placeholder', /4, 2, 2, 8/);
      await expect(page.locator(app.buttonSelector)).toBeVisible();
      await expect(page.locator(app.buttonSelector)).toHaveText(/Sort using Counting Sort/);
      await expect(page.locator(app.errorSelector)).toBeVisible();
      await expect(page.locator(app.outputSelector)).toBeVisible();

      // No runtime page errors or console error-level messages expected during initial render
      expect(pageErrors.length, 'No page errors on initial load').toBe(0);
      const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(errorConsoleCount, 'No console.error messages on initial load').toBe(0);
    });
  });

  test.describe('Validation and Error States (S1_InputReceived -> S2_ValidationFailed)', () => {
    test('shows error for empty input (InputEmptyError transition)', async ({ page }) => {
      // This validates transition from Idle -> InputReceived -> Validation Failed when input is empty
      const app = new CountingSortPage(page);
      await app.goto();

      // Ensure input is empty
      await app.clearInput();
      await app.clickSort();

      // Expect the specific error message for empty input
      await expect(page.locator(app.errorSelector)).toHaveText('Please enter some integers.');

      // No sorting steps should have been appended
      const steps = await app.getOutputStepsText();
      expect(steps.length, 'No output steps should be present for empty input').toBe(0);

      // Assert no runtime exceptions occurred
      expect(pageErrors.length, 'No page errors for empty input scenario').toBe(0);
      const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(errorConsoleCount, 'No console.error for empty input scenario').toBe(0);
    });

    test('shows error for non-integer input (InputValidationError transition)', async ({ page }) => {
      // Validate that invalid (non-integer) entries are rejected
      const app = new CountingSortPage(page);
      await app.goto();

      // Input containing a non-integer token
      await app.fillInput('4, 2, three, 5');
      await app.clickSort();

      // Expect validation error message
      await expect(page.locator(app.errorSelector)).toHaveText('Input must be integers only.');

      // No output steps should be present
      const steps = await app.getOutputStepsText();
      expect(steps.length, 'No output steps should be present for invalid input').toBe(0);

      // Assert no runtime exceptions occurred
      expect(pageErrors.length, 'No page errors for invalid input scenario').toBe(0);
      const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(errorConsoleCount, 'No console.error for invalid input scenario').toBe(0);
    });
  });

  test.describe('Sorting Flow (S1_InputReceived -> S4_SortedOutput)', () => {
    test('performs counting sort and displays sorted output and steps for a small array', async ({ page }) => {
      // This test validates normal sorting flow resulting in S4_SortedOutput final state.
      const app = new CountingSortPage(page);
      await app.goto();

      // Example array from FSM: 4, 2, 2, 8, 3, 3, 1
      await app.fillInput('4, 2, 2, 8, 3, 3, 1');
      await app.clickSort();

      // The output div should contain multiple step divs indicating sorting progress
      await page.waitForSelector('#output .step', { timeout: 2000 });

      const steps = await app.getOutputStepsText();
      // Expect at least the initial Input array message and final Sorted array message
      expect(steps.length, 'Should have multiple step messages (input, counts, prefix sums, placements, sorted)').toBeGreaterThanOrEqual(2);

      // The last step should include the Sorted array representation
      const last = await app.getLastOutputText();
      expect(last).toContain('Sorted array:');
      expect(last).toContain('1, 2, 2, 3, 3, 4, 8');

      // Validate that error message is cleared
      await expect(page.locator(app.errorSelector)).toHaveText('');

      // No runtime exceptions expected
      expect(pageErrors.length, 'No page errors during normal sorting flow').toBe(0);
      const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(errorConsoleCount, 'No console.error during normal sorting flow').toBe(0);
    });

    test('handles negative numbers and spaces-separated input correctly (stability and parse)', async ({ page }) => {
      // This confirms parseInput handles spaces and sorting handles negative numbers (min offset)
      const app = new CountingSortPage(page);
      await app.goto();

      // Spaces separated and including negative values and duplicates to test stability
      await app.fillInput('-1 3 0 -1 2 3');
      await app.clickSort();

      await page.waitForSelector('#output .step', { timeout: 2000 });
      const last = await app.getLastOutputText();
      expect(last).toContain('Sorted array:');
      // Sorted should be: -1, -1, 0, 2, 3, 3
      expect(last).toContain('-1, -1, 0, 2, 3, 3');

      // No runtime exceptions expected
      expect(pageErrors.length, 'No page errors for negative numbers test').toBe(0);
      const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(errorConsoleCount, 'No console.error for negative numbers test').toBe(0);
    });
  });

  test.describe('Large Range Warning (S1_InputReceived -> S3_Sorting -> S4_SortedOutput)', () => {
    test('dismiss large range warning and abort sorting', async ({ page }) => {
      // This test checks the confirm dialog is shown for large ranges and that dismissing aborts sorting
      const app = new CountingSortPage(page);
      await app.goto();

      // Prepare input that creates a large range > 100000. Use two numbers far apart.
      await app.fillInput('0, 200001');

      // Listen for dialog and dismiss it (simulate user clicking "Cancel")
      let dialogSeen = false;
      page.once('dialog', async dialog => {
        dialogSeen = true;
        expect(dialog.type()).toBe('confirm');
        // The message should include the computed range (200001 - 0 = 200001)
        expect(dialog.message()).toContain('Large range (200001)');
        await dialog.dismiss(); // User cancels -> sorting should not proceed
      });

      await app.clickSort();

      // Wait a short time to allow any potential sorting behavior to run if dialog accepted; confirm dismissed stops sorting
      await page.waitForTimeout(200);

      // Ensure the dialog was shown
      expect(dialogSeen, 'Confirm dialog for large range must be shown').toBe(true);

      // No steps should have been appended since we dismissed the confirm
      const steps = await app.getOutputStepsText();
      expect(steps.length, 'No sorting steps when large range confirm is dismissed').toBe(0);

      // The error message should remain empty (code returns silently)
      await expect(page.locator(app.errorSelector)).toHaveText('');

      // No runtime exceptions expected
      expect(pageErrors.length, 'No page errors when dismissing large range confirm').toBe(0);
      const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(errorConsoleCount, 'No console.error when dismissing large range confirm').toBe(0);
    });

    test('accept large range warning and continue sorting', async ({ page }) => {
      // This test accepts the large-range confirm and ensures sorting runs to completion
      const app = new CountingSortPage(page);
      await app.goto();

      // Use a large range that will trigger confirm but keep array small for performance
      await app.fillInput('0, 200001');

      // Handle dialog and accept it
      let dialogSeen = false;
      page.once('dialog', async dialog => {
        dialogSeen = true;
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toContain('Large range (200001)');
        await dialog.accept(); // Continue with sorting
      });

      await app.clickSort();

      // After accepting, sorting should proceed and output steps should appear
      await page.waitForSelector('#output .step', { timeout: 2000 });

      // Confirm was shown and accepted
      expect(dialogSeen, 'Confirm dialog for large range must be shown and handled').toBe(true);

      // Check that some output steps exist and final sorted array is displayed
      const steps = await app.getOutputStepsText();
      expect(steps.length, 'Sorting steps should be present after accepting large range confirm').toBeGreaterThanOrEqual(1);

      const last = await app.getLastOutputText();
      expect(last).toContain('Sorted array:');
      // Expect the sorted array to include the two values in sorted order
      expect(last).toContain('0, 200001');

      // No runtime exceptions expected
      expect(pageErrors.length, 'No page errors after accepting large range confirm').toBe(0);
      const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(errorConsoleCount, 'No console.error after accepting large range confirm').toBe(0);
    });
  });

  test.describe('Transition and onEnter/onExit checks', () => {
    test('S0_Idle -> S1_InputReceived transition clears previous error and reads input', async ({ page }) => {
      // Validate that when a user provides input and clicks Sort, the code reads input and clears previous error
      const app = new CountingSortPage(page);
      await app.goto();

      // First cause an error by submitting empty input
      await app.clearInput();
      await app.clickSort();
      await expect(page.locator(app.errorSelector)).toHaveText('Please enter some integers.');

      // Now provide valid input and click Sort to ensure error is cleared on entry to S1_InputReceived
      await app.fillInput('5,6,7');
      await app.clickSort();

      // After clicking, the error message should be cleared immediately as per evidence: errorMsg.textContent = '';
      await expect(page.locator(app.errorSelector)).toHaveText('');

      // Sorting proceeds; ensure output contains steps and final sorted array
      await page.waitForSelector('#output .step', { timeout: 2000 });
      const last = await app.getLastOutputText();
      expect(last).toContain('Sorted array:');
      expect(last).toContain('5, 6, 7');

      // No runtime errors
      expect(pageErrors.length, 'No page errors in transition test').toBe(0);
      const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(errorConsoleCount, 'No console.error in transition test').toBe(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('large input arrays still produce expected output format (performance-ish test)', async ({ page }) => {
      // This is a lightweight check that a moderately sized input sorts and produces output steps.
      // We avoid extremely large arrays to keep tests fast.
      const app = new CountingSortPage(page);
      await app.goto();

      // Create a moderately sized array with duplicates and a small range to avoid confirm
      const arr = Array.from({ length: 200 }, (_, i) => (i % 10)); // values 0..9 repeated
      await app.fillInput(arr.join(', '));
      await app.clickSort();

      // Wait for steps to appear
      await page.waitForSelector('#output .step', { timeout: 5000 });
      const steps = await app.getOutputStepsText();
      expect(steps.length, 'Should produce multiple steps for moderate-sized input').toBeGreaterThanOrEqual(1);

      // Final sorted string should show 0..9 repeated in increasing order overall
      const last = await app.getLastOutputText();
      expect(last).toContain('Sorted array:');
      // Very basic check: count occurrences of '0' in last output should be equal to number of zeros in arr (which is 20 here)
      // We'll perform a simple substring match to ensure numbers are present.
      expect(last.includes('0'), 'Sorted output should include 0').toBe(true);
      expect(last.includes('9'), 'Sorted output should include 9').toBe(true);

      // No runtime exceptions expected
      expect(pageErrors.length, 'No page errors for moderate-sized input').toBe(0);
      const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(errorConsoleCount, 'No console.error for moderate-sized input').toBe(0);
    });

    test('malformed whitespace and commas are ignored by parser', async ({ page }) => {
      // Confirm parseInput tolerates weird spacing and multiple commas
      const app = new CountingSortPage(page);
      await app.goto();

      await app.fillInput('  1, , 2   ,   3,,4  ');
      await app.clickSort();

      await page.waitForSelector('#output .step', { timeout: 2000 });
      const last = await app.getLastOutputText();
      expect(last).toContain('Sorted array:');
      expect(last).toContain('1, 2, 3, 4');

      // No runtime exceptions
      expect(pageErrors.length, 'No page errors for malformed whitespace input').toBe(0);
      const errorConsoleCount = consoleMessages.filter(m => m.type === 'error').length;
      expect(errorConsoleCount, 'No console.error for malformed whitespace input').toBe(0);
    });
  });
});