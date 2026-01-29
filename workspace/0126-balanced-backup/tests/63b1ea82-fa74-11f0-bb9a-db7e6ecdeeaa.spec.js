import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b1ea82-fa74-11f0-bb9a-db7e6ecdeeaa.html';

test.describe('Recursion Demonstration (FSM validation) - 63b1ea82-fa74-11f0-bb9a-db7e6ecdeeaa', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (type & text)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the provided HTML page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No teardown modifications to the page; listeners are per-page and cleaned up by Playwright.
    // This hook exists to satisfy structure requirements.
  });

  test.describe('Initial State (S0_Idle) validations', () => {
    test('Initial DOM elements present and input has default attributes', async ({ page }) => {
      // Verify the number input exists and has the expected default value and attributes
      const numberInput = page.locator('#numberInput');
      await expect(numberInput).toHaveCount(1);
      await expect(numberInput).toHaveAttribute('type', 'number');
      await expect(numberInput).toHaveAttribute('min', '1');
      await expect(numberInput).toHaveAttribute('max', '15');
      await expect(numberInput).toHaveValue('5'); // default value is "5"

      // Verify the Run Recursion button exists
      const runBtn = page.locator('#runBtn');
      await expect(runBtn).toHaveCount(1);
      await expect(runBtn).toHaveText('Run Recursion');

      // Verify output container exists and is initially empty (S0_Idle entry action: renderPage -> empty output)
      const output = page.locator('#output');
      await expect(output).toHaveCount(1);
      const outputText = await output.textContent();
      expect(outputText.trim()).toBe(''); // should be empty on initial render

      // Verify accessibility attributes on output
      await expect(output).toHaveAttribute('aria-live', 'polite');
      await expect(output).toHaveAttribute('aria-label', 'Recursion output log');
    });
  });

  test.describe('Computing state (S1_Computing) and transitions', () => {
    test('Clicking Run Recursion enters Computing state and shows computing header and recursive calls (n = 3)', async ({ page }) => {
      // Set input to 3 for a concise recursion trace
      const numberInput = page.locator('#numberInput');
      await numberInput.fill('3');

      // Insert a marker: ensure output is not pre-populated
      const output = page.locator('#output');
      await expect(output).toHaveText(''); // starting from idle

      // Click run to trigger computation (transition: S0_Idle -> S1_Computing)
      await page.click('#runBtn');

      // After clicking, entry action should clear output; then computing header appended
      await expect(output).toContainText('Computing factorial of 3 recursively...');

      // The recursion should log each call and return
      const outText = await output.textContent();
      // Ensure the call sequence and base case/returning lines are present
      expect(outText).toContain('factorial(3) called');
      expect(outText).toContain('factorial(2) called');
      expect(outText).toContain('factorial(1) called');
      expect(outText).toContain('Base case reached: factorial(1) = 1');
      expect(outText).toContain('Returning: 2 * factorial(1) = 2');
      expect(outText).toContain('Returning: 3 * factorial(2) = 6');

      // Final result appended after recursion completes
      expect(outText).toContain('Factorial(3) = 6');
    });

    test('Running twice clears previous output (validates onExit/onEnter action: output.textContent = "")', async ({ page }) => {
      // First run with n = 4
      await page.fill('#numberInput', '4');
      await page.click('#runBtn');

      const output = page.locator('#output');
      const firstRun = await output.textContent();
      expect(firstRun).toContain('Computing factorial of 4 recursively...');
      expect(firstRun).toContain('Factorial(4) = 24');

      // Second run with n = 2, output should be cleared before computing (entry action)
      await page.fill('#numberInput', '2');
      await page.click('#runBtn');

      const secondRun = await output.textContent();
      // secondRun should not include previous result (24)
      expect(secondRun).not.toContain('Factorial(4) = 24');
      expect(secondRun).toContain('Computing factorial of 2 recursively...');
      expect(secondRun).toContain('Factorial(2) = 2');
    });

    test('Base case behavior (S2_BaseCase) when n = 1: immediate base case and final result', async ({ page }) => {
      // Set input to 1 to force immediate base case
      await page.fill('#numberInput', '1');
      await page.click('#runBtn');

      const output = page.locator('#output');
      const outText = await output.textContent();

      // Should show computing header and base case reached message
      expect(outText).toContain('Computing factorial of 1 recursively...');
      expect(outText).toContain('factorial(1) called');
      expect(outText).toContain('Base case reached: factorial(1) = 1');

      // Final result should be Factorial(1) = 1
      expect(outText).toContain('Factorial(1) = 1');
    });

    test('Returning result messages (S3_Returning) contain expected arithmetic and ordering for n = 5', async ({ page }) => {
      // Use n = 5 for a longer trace and ensure "Returning:" messages include correct computations
      await page.fill('#numberInput', '5');
      await page.click('#runBtn');

      const output = page.locator('#output');
      const outText = await output.textContent();

      // Check a few returning lines to ensure recursion unwinds correctly
      expect(outText).toContain('Returning: 2 * factorial(1) = 2');
      expect(outText).toContain('Returning: 3 * factorial(2) = 6');
      expect(outText).toContain('Returning: 4 * factorial(3) = 24');
      expect(outText).toContain('Returning: 5 * factorial(4) = 120');
      expect(outText).toContain('Factorial(5) = 120');
    });
  });

  test.describe('InputChange event semantics and edge-case validation', () => {
    test('Changing input to out-of-range value (0) displays validation message', async ({ page }) => {
      // Fill an invalid value 0 (below min) and click run
      await page.fill('#numberInput', '0');
      await page.click('#runBtn');

      const output = page.locator('#output');
      await expect(output).toHaveText('Please enter a positive integer between 1 and 15.');
    });

    test('Changing input to out-of-range value (16) displays validation message', async ({ page }) => {
      // Fill an invalid value 16 (above max) and click run
      await page.fill('#numberInput', '16');
      await page.click('#runBtn');

      const output = page.locator('#output');
      await expect(output).toHaveText('Please enter a positive integer between 1 and 15.');
    });

    test('Non-numeric input results in validation message (empty input)', async ({ page }) => {
      // Clear the input entirely (simulate non-number)
      await page.fill('#numberInput', '');
      await page.click('#runBtn');

      const output = page.locator('#output');
      await expect(output).toHaveText('Please enter a positive integer between 1 and 15.');
    });

    test('Changing input before clicking Run and then clicking triggers expected computation (verifies InputChange -> Computing transition)', async ({ page }) {
      // Change input to 4 (InputChange event in FSM), then click run
      await page.fill('#numberInput', '4');

      // Ensure input actually changed before clicking
      const numberInput = page.locator('#numberInput');
      await expect(numberInput).toHaveValue('4');

      // Click run and expect normal computation
      await page.click('#runBtn');

      const output = page.locator('#output');
      await expect(output).toContainText('Computing factorial of 4 recursively...');
      const outText = await output.textContent();
      expect(outText).toContain('Factorial(4) = 24');
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('No uncaught page errors and no console.error messages were emitted during normal interactions', async ({ page }) => {
      // Perform a representative interaction sequence
      await page.fill('#numberInput', '3');
      await page.click('#runBtn');

      // Wait a tick to allow potential async errors to surface
      await page.waitForTimeout(100);

      // Assert there were no uncaught page errors
      expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

      // Assert there were no console messages with type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length, `Console errors: ${consoleErrors.map(m => m.text).join('; ')}`).toBe(0);

      // Optionally assert presence of informational console logs if any (not required by implementation)
      // We at least surface captured console messages for debugging in case tests fail
    });

    test('Capture and report any console messages (keeps tests observant of unexpected warnings/errors)', async ({ page }) => {
      // Trigger a run to collect console messages
      await page.fill('#numberInput', '2');
      await page.click('#runBtn');

      // Wait a small amount for console events to propagate
      await page.waitForTimeout(50);

      // At minimum, ensure we have captured console events array (may be empty)
      expect(Array.isArray(consoleMessages)).toBe(true);

      // If there are console messages of any kind, they should be strings
      for (const msg of consoleMessages) {
        expect(typeof msg.text).toBe('string');
        expect(typeof msg.type).toBe('string');
      }
    });
  });
});