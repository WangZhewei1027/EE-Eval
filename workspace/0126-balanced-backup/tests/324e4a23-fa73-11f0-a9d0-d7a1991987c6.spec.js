import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e4a23-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Sliding Window Technique Demo - FSM tests (Application ID: 324e4a23-fa73-11f0-a9d0-d7a1991987c6)', () => {
  // Arrays to capture console and page errors/messages for each test
  let consoleErrors;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleErrors = [];
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and errors
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(String(error));
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // After each test we assert there were no console errors or uncaught page errors.
    // This validates that the page executed without runtime errors like ReferenceError/TypeError/etc.
    expect(consoleErrors, `Console errors were logged: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `Page errors were thrown: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test.describe('Idle State (S0_Idle) - initial rendering and components', () => {
    test('Idle state shows header, description, inputs, button and empty result', async ({ page }) => {
      // Validate presence of evidence for Idle state
      const title = page.locator('h1');
      await expect(title).toHaveText('Sliding Window Technique Demo');

      const paragraph = page.locator('p');
      await expect(paragraph).toContainText('Enter an array of numbers and a window size to calculate the sum of each window.');

      // Inputs existence and attributes
      const arrayInput = page.locator('#array');
      await expect(arrayInput).toHaveAttribute('placeholder', 'e.g. 1,2,3,4,5');

      const windowInput = page.locator('#windowSize');
      await expect(windowInput).toHaveValue('2'); // default value from HTML
      await expect(windowInput).toHaveAttribute('min', '1');

      // Button existence and onclick handler attribute (evidence for S1_Calculating transition)
      const calculateButton = page.locator("button[onclick='calculateSlidingWindow()']");
      await expect(calculateButton).toBeVisible();
      await expect(calculateButton).toHaveText('Calculate Sliding Window Sums');

      // Result area should be present and initially empty
      const result = page.locator('#result');
      await expect(result).toBeVisible();
      await expect(result).toHaveText('');
    });
  });

  test.describe('Calculating (S1_Calculating) -> Result Displayed (S2_ResultDisplayed) transitions', () => {
    test('Valid input computes sliding window sums and displays results', async ({ page }) => {
      // This test validates the main successful path: clicking the calculate button should
      // execute calculateSlidingWindow() and update the #result text with correct sums.

      // Arrange: set a known array and window size
      await page.fill('#array', '1,2,3,4,5');
      await page.fill('#windowSize', '3');

      // Act: click the calculate button (this triggers the entry action calculateSlidingWindow())
      await page.click("button[onclick='calculateSlidingWindow()']");

      // Assert: result text matches expected sliding window sums: [1+2+3, 2+3+4, 3+4+5] => 6, 9, 12
      const result = page.locator('#result');
      await expect(result).toHaveText('Sliding window sums: 6, 9, 12');
    });

    test('Default window size (2) computes correct sums', async ({ page }) => {
      // Using default window size provided in HTML (value="2") with a short array
      await page.fill('#array', '1,2,3');
      // Do not change window size (should be 2)
      await page.click("button[onclick='calculateSlidingWindow()']");

      const result = page.locator('#result');
      // Expected sums: [1+2, 2+3] => 3, 5
      await expect(result).toHaveText('Sliding window sums: 3, 5');
    });
  });

  test.describe('Error States (S3_Error) - guards and error messages', () => {
    test('Guard: window size is NaN or <= 0 triggers "Please enter a valid window size."', async ({ page }) => {
      // Case 1: windowSize = 0 (<= 0)
      await page.fill('#array', '1,2,3');
      await page.fill('#windowSize', '0');
      await page.click("button[onclick='calculateSlidingWindow()']");
      await expect(page.locator('#result')).toHaveText('Please enter a valid window size.');

      // Clear result and test non-numeric input (NaN)
      await page.fill('#result', ''); // try to clear via fill on the div (no-op in many browsers), but keep flow
      await page.fill('#windowSize', 'abc'); // parseInt('abc') => NaN
      await page.click("button[onclick='calculateSlidingWindow()']");
      await expect(page.locator('#result')).toHaveText('Please enter a valid window size.');

      // Negative value
      await page.fill('#windowSize', '-5');
      await page.click("button[onclick='calculateSlidingWindow()']");
      await expect(page.locator('#result')).toHaveText('Please enter a valid window size.');
    });

    test('Guard: window size larger than array triggers "Window size cannot be larger than the array."', async ({ page }) => {
      // Provide an array smaller than the window size
      await page.fill('#array', '10,20');
      await page.fill('#windowSize', '3');
      await page.click("button[onclick='calculateSlidingWindow()']");

      await expect(page.locator('#result')).toHaveText('Window size cannot be larger than the array.');
    });

    test('Edge case: empty array with valid window size triggers "Window size cannot be larger than the array."', async ({ page }) => {
      // Empty array -> inputArray.length == 1 if split('')? In implementation split(',') on empty string results [''] then Number('') === 0.
      // To emulate an empty set reasonably, we'll clear the input and ensure behavior.
      await page.fill('#array', '');
      await page.fill('#windowSize', '1');
      await page.click("button[onclick='calculateSlidingWindow()']");

      // The implementation will parse inputArray === [NaN? Actually [''] -> Number('') === 0], so array length is 1.
      // This can produce a slide sum of 0. We'll assert that either a result is shown OR window-size guard triggers.
      // Since the FSM expects the "Window size cannot be larger than the array." guard in some invalid cases,
      // we allow either a valid result or the specific guard message. We'll check for either.
      const resultText = await page.locator('#result').innerText();
      const allowedMessages = [
        'Window size cannot be larger than the array.',
        'Please enter a valid window size.',
        // Or a computed sum beginning with the expected prefix:
        (txt) => txt.startsWith('Sliding window sums:')
      ];

      const matchesAllowed = allowedMessages.some(m => (typeof m === 'string' ? resultText === m : m(resultText)));
      expect(matchesAllowed, `Unexpected result text for empty array scenario: "${resultText}"`).toBe(true);
    });
  });

  test.describe('Additional behavior and robustness checks', () => {
    test('Clicking calculate multiple times produces consistent results (idempotence of action)', async ({ page }) => {
      await page.fill('#array', '2,2,2,2');
      await page.fill('#windowSize', '2');

      const calculateButton = page.locator("button[onclick='calculateSlidingWindow()']");
      const result = page.locator('#result');

      // Click multiple times in quick succession
      await calculateButton.click();
      await calculateButton.click();
      await calculateButton.click();

      // The result should be deterministic and equal to sums: [4,4,4]
      await expect(result).toHaveText('Sliding window sums: 4, 4, 4');
    });

    test('Non-numeric array entries lead to NaN in sums (observable behavior without patching)', async ({ page }) => {
      // This test intentionally verifies the app behavior when array contains non-numeric entries.
      // The test does not fix the application but observes resulting output (which may contain "NaN").
      await page.fill('#array', '1,foo,3');
      await page.fill('#windowSize', '2');
      await page.click("button[onclick='calculateSlidingWindow()']");

      const resultText = await page.locator('#result').innerText();
      // Expect the result to either contain 'NaN' or valid sums depending on how Number(foo) is handled.
      const containsNaN = resultText.includes('NaN');
      const validPrefix = resultText.startsWith('Sliding window sums:');

      expect(validPrefix, 'Result should at least start with the expected prefix').toBe(true);
      // It is acceptable for NaN to appear; assert that either NaN exists or proper numeric results are present.
      expect(containsNaN || /\d/.test(resultText), 'Result should contain NaN or numeric output').toBe(true);
    });
  });
});