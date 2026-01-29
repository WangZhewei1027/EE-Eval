import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520b69d1-fa76-11f0-a09b-87751f540fd8.html';

// Page Object Model for the Dynamic Typing page
class DynamicTypingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.inputSelector = '#input-field';
    this.resultSelector = '#result';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async input() {
    return this.page.locator(this.inputSelector);
  }

  async result() {
    return this.page.locator(this.resultSelector);
  }

  // Type text into the input (clears first)
  async typeText(text) {
    const inp = await this.input();
    await inp.fill(''); // ensure deterministic starting point
    // Use press keys to trigger input events naturally
    await inp.type(text);
  }

  // Set the input to a given value via fill (also triggers input event)
  async fillText(text) {
    const inp1 = await this.input();
    await inp.fill(text);
    // In modern browsers fill triggers input event via Playwright, but to be robust:
    await inp.dispatchEvent('input');
  }

  async clear() {
    const inp2 = await this.input();
    await inp.fill('');
    await inp.dispatchEvent('input');
  }

  async getResultText() {
    const res = await this.result();
    return (await res.textContent()) ?? '';
  }

  async placeholder() {
    const inp3 = await this.input();
    return await inp.getAttribute('placeholder');
  }
}

test.describe('Dynamic Typing - FSM states and transitions', () => {
  // Collect console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events (info, log, warning, error, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen for uncaught exceptions and other page errors
    page.on('pageerror', (err) => {
      // err is an Error; capture message and name
      pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });

    // Navigate to the app page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Nothing to tear down besides letting Playwright close the page context
  });

  // Validate there are no unexpected JS errors on load and during simple interactions.
  test('No runtime errors (ReferenceError/SyntaxError/TypeError) should occur during load and basic interactions', async ({ page }) => {
    const app = new DynamicTypingPage(page);

    // Basic assertions about initial page load: the page should have input and result elements
    await expect(page.locator('#input-field')).toBeVisible();
    await expect(page.locator('#result')).toBeVisible();

    // Perform a few interactions to trigger the event handler
    await app.typeText('a'); // invalid (length 1)
    await expect(await app.getResultText()).toBe('Please enter at least 3 characters');

    await app.typeText('abc'); // valid (length 3)
    await expect(await app.getResultText()).toBe('You entered: abc');

    // Assert that no page errors of critical JS types occurred
    // We allow console logs, but fail if there were uncaught page errors
    // or console.error messages indicating runtime problems.
    const errorConsoleEntries = consoleMessages.filter((c) => c.type === 'error');

    // Assert there were no uncaught exceptions
    expect(pageErrors, 'Expected no uncaught page errors during load/interactions').toEqual([]);

    // Assert there were no console.error messages
    expect(errorConsoleEntries, 'Expected no console.error messages during load/interactions').toEqual([]);
  });

  test.describe('FSM State Coverage', () => {
    // Test Idle state (S0_Idle)
    test('Idle state: before any typing, result div should be empty', async ({ page }) => {
      const app1 = new DynamicTypingPage(page);

      // Ensure page is in initial state: input exists and result is empty
      await expect(page.locator('#input-field')).toBeVisible();
      await expect(page.locator('#input-field')).toHaveAttribute('placeholder', 'Enter a string');

      const resultText = await app.getResultText();
      // On initial load, the implementation does not set any result text until input occurs
      expect(resultText, 'Result div should be empty on initial load (Idle state)').toBe('');
    });

    // Test Invalid Input state (S2_InvalidInput)
    test('Invalid Input state: inputs shorter than 3 characters display validation message', async ({ page }) => {
      const app2 = new DynamicTypingPage(page);

      // Type 1 character and assert invalid message
      await app.typeText('x');
      let result = await app.getResultText();
      expect(result).toBe('Please enter at least 3 characters');

      // Type 2 characters and assert invalid message
      await app.typeText('yz');
      result = await app.getResultText();
      expect(result).toBe('Please enter at least 3 characters');

      // From S2_InvalidInput -> S2_InvalidInput transition check:
      // Type another 1-char change (still under threshold) and expect same invalid message
      await app.typeText('m'); // single char again
      result = await app.getResultText();
      expect(result).toBe('Please enter at least 3 characters');
    });

    // Test Valid Input state (S1_ValidInput)
    test('Valid Input state: inputs with length >= 3 show the entered value', async ({ page }) => {
      const app3 = new DynamicTypingPage(page);

      // Type exactly 3 characters
      await app.typeText('hey');
      let result1 = await app.getResultText();
      expect(result).toBe('You entered: hey');

      // Extend to 5 characters and ensure the message updates accordingly
      await app.typeText('hello');
      result = await app.getResultText();
      expect(result).toBe('You entered: hello');

      // Staying in S1_ValidInput: type another valid input and ensure message reflects new input
      await app.typeText('world');
      result = await app.getResultText();
      expect(result).toBe('You entered: world');
    });

    // Test transitions between Invalid and Valid states
    test('Transitions: Invalid -> Valid and Valid -> Invalid occur correctly on input events', async ({ page }) => {
      const app4 = new DynamicTypingPage(page);

      // Start invalid
      await app.typeText('ab'); // 2 chars
      let result2 = await app.getResultText();
      expect(result).toBe('Please enter at least 3 characters');

      // Transition to valid
      await app.typeText('abc'); // 3 chars
      result = await app.getResultText();
      expect(result).toBe('You entered: abc');

      // Transition back to invalid by shortening input
      // Use fill to set a 1-char value to simulate deletion
      await app.fillText('z');
      result = await app.getResultText();
      expect(result).toBe('Please enter at least 3 characters');

      // Transition to valid again with a longer string
      await app.fillText('playwright');
      result = await app.getResultText();
      expect(result).toBe('You entered: playwright');
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Exactly three whitespace characters counts as length 3 (should be treated as valid)', async ({ page }) => {
      const app5 = new DynamicTypingPage(page);

      // Fill exactly 3 spaces
      await app.fillText('   ');
      const result3 = await app.getResultText();
      // The implementation checks length only, so whitespace counts
      expect(result).toBe('You entered:    ');
    });

    test('Very long input is accepted and displayed correctly', async ({ page }) => {
      const app6 = new DynamicTypingPage(page);

      const longText = 'a'.repeat(1000);
      await app.fillText(longText);
      const result4 = await app.getResultText();
      expect(result).toBe('You entered: ' + longText);
    });

    test('Rapid typing updates reflect the latest value and do not produce errors', async ({ page }) => {
      const app7 = new DynamicTypingPage(page);

      // Simulate rapid typing by sending keystrokes; use type which simulates typing with small delays
      const inp4 = await app.input();
      await inp.fill('');
      await inp.type('ab'); // currently invalid
      // Immediately continue to type more to reach valid
      await inp.type('cde'); // makes it 'abcde' valid
      // Wait a tick for event processing
      await page.waitForTimeout(50);
      const result5 = await app.getResultText();
      expect(result).toBe('You entered: abcde');

      // Ensure no console errors occurred during rapid typing
      const errorConsoleEntries1 = consoleMessages.filter((c) => c.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Clearing the input triggers the invalid state message (length 0)', async ({ page }) => {
      const app8 = new DynamicTypingPage(page);

      await app.fillText('abc'); // valid
      let result6 = await app.getResultText();
      expect(result).toBe('You entered: abc');

      // Clear the input
      await app.clear();
      result = await app.getResultText();
      // For zero-length input, length < 3 so invalid message expected
      expect(result).toBe('Please enter at least 3 characters');
    });
  });

  // Observability tests: ensure console output and pageerror behavior are as expected
  test.describe('Console and error observation', () => {
    test('Observes console messages and ensures no SyntaxError/ReferenceError/TypeError occurred', async ({ page }) => {
      const app9 = new DynamicTypingPage(page);

      // Interact to potentially surface latent errors
      await app.typeText('test');
      await app.typeText('ok');

      // Check collected pageErrors from event listener
      // If there were any real runtime JS exceptions, they would be captured here.
      // We assert none of them are critical JS error types.
      for (const err of pageErrors) {
        // Fail if name matches critical JavaScript error classes
        expect(['ReferenceError', 'SyntaxError', 'TypeError']).not.toContain(err.name);
      }

      // Also check console messages for mentions of these error names
      const problematicConsole = consoleMessages.filter((c) =>
        /ReferenceError|SyntaxError|TypeError/.test(c.text)
      );
      expect(problematicConsole, 'Console should not contain JS error traces').toEqual([]);
    });
  });
});