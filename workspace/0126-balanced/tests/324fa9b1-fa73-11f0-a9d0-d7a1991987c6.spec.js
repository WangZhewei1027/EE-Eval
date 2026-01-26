import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324fa9b1-fa73-11f0-a9d0-d7a1991987c6.html';

// Page object encapsulating common interactions and observability (console + page errors)
class InterpreterPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages for inspection in tests
    this.page.on('console', (msg) => {
      try {
        this.consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // ignore if something unexpected happens while reading console message
      }
    });

    // Collect page errors (uncaught exceptions in the page)
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async inputExpression(expression) {
    // fill replaces current content
    await this.page.fill('#expression', expression);
  }

  async clickInterpret() {
    await this.page.click('#interpret-btn');
  }

  async getResultText() {
    // textContent can return null; normalize to empty string
    const text = await this.page.textContent('#result');
    return text === null ? '' : text.trim();
  }

  // Helper to wait a short time to let handlers execute (useful for checking no error occurred)
  async shortWait() {
    await this.page.waitForTimeout(100);
  }
}

test.describe('Interpreter Pattern Demo - FSM states and transitions', () => {
  // Sanity test: page loads and initial "Idle" state is rendered
  test('Idle state renders input, interpret button, and empty result (entry action implicit)', async ({ page }) => {
    const app = new InterpreterPage(page);
    await app.goto();

    // Verify input presence and placeholder (evidence of S0_Idle entry rendering)
    const input = page.locator('#expression');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'e.g., 3 + 5 - 2');

    // Verify interpret button exists and has expected label
    const button = page.locator('#interpret-btn');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Interpret');

    // Verify the result area exists and is empty initially
    const resultText = await app.getResultText();
    expect(resultText).toBe('', 'Result area should be empty in Idle state (no interpretation yet)');

    // No runtime errors should have happened during initial render
    await app.shortWait();
    expect(app.pageErrors.length).toBe(0);
  });

  test.describe('Successful interpretations (S0_Idle -> S1_ResultDisplayed transitions)', () => {
    test('Interpret a compound expression "3 + 5 - 2" and display correct result', async ({ page }) => {
      const app = new InterpreterPage(page);
      await app.goto();

      // Enter a valid expression with spaces as the parser expects tokens separated by spaces.
      await app.inputExpression('3 + 5 - 2');

      // Click interpret and wait for the result DOM to be updated
      await app.clickInterpret();

      // The expected result is 6
      await expect(page.locator('#result')).toHaveText('Result: 6');

      // Ensure no uncaught page errors occurred
      await app.shortWait();
      expect(app.pageErrors.length).toBe(0);

      // Optionally check that console did not emit severe errors
      const severeConsole = app.consoleMessages.find(m => m.type === 'error');
      expect(severeConsole).toBeUndefined();
    });

    test('Interpret a single number "42" and display result', async ({ page }) => {
      const app = new InterpreterPage(page);
      await app.goto();

      await app.inputExpression('42');
      await app.clickInterpret();

      await expect(page.locator('#result')).toHaveText('Result: 42');

      await app.shortWait();
      expect(app.pageErrors.length).toBe(0);
    });

    test('Empty input produces NaN result (edge case)', async ({ page }) => {
      // This test checks an edge-case behavior of the parser when given an empty input string.
      // According to the implementation, splitting "" yields [''], which the parser treats as a number,
      // parseInt('') is NaN, so the result displayed will be "Result: NaN".
      const app = new InterpreterPage(page);
      await app.goto();

      // Ensure the input is empty
      await app.inputExpression('');
      await app.clickInterpret();

      await expect(page.locator('#result')).toHaveText('Result: NaN');

      // No uncaught exceptions expected for this edge-case (result is NaN instead)
      await app.shortWait();
      expect(app.pageErrors.length).toBe(0);
    });
  });

  test.describe('Error scenarios and malformed expressions (verify runtime errors are surfaced)', () => {
    test('Expression without spaces "3+5-2" causes a runtime error (parse failure)', async ({ page }) => {
      const app = new InterpreterPage(page);
      await app.goto();

      // Fill expression WITHOUT spaces which the simple parser does not support.
      await app.inputExpression('3+5-2');

      // Trigger the click and wait for an uncaught page error event.
      // The implementation will likely attempt to call interpret() on undefined causing a TypeError.
      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.click('#interpret-btn'),
      ]);

      // Verify that an error was captured and is an Error instance with a message.
      expect(error).toBeTruthy();
      expect(typeof error.message).toBe('string');
      expect(error.message.length).toBeGreaterThan(0);

      // Basic check that the message indicates a problem calling interpret or reading properties.
      const msg = error.message.toLowerCase();
      const indicatesInterpretProblem = msg.includes('interpret') || msg.includes('cannot') || msg.includes('reading');
      expect(indicatesInterpretProblem).toBeTruthy();

      // The result area may remain unchanged or be absent; ensure that an error was indeed observed
      expect(app.pageErrors.length).toBeGreaterThanOrEqual(1);
    });

    test('Malformed expression with consecutive operators "3 + +" triggers a runtime error', async ({ page }) => {
      const app = new InterpreterPage(page);
      await app.goto();

      await app.inputExpression('3 + +');

      // Clicking interpret should cause a runtime exception due to stack underflow when building expressions
      const [error] = await Promise.all([
        page.waitForEvent('pageerror'),
        page.click('#interpret-btn'),
      ]);

      expect(error).toBeTruthy();
      expect(typeof error.message).toBe('string');
      expect(error.message.length).toBeGreaterThan(0);

      const msg = error.message.toLowerCase();
      const indicatesError = msg.includes('interpret') || msg.includes('cannot') || msg.includes('reading') || msg.includes('undefined');
      expect(indicatesError).toBeTruthy();

      expect(app.pageErrors.length).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Observability: console messages and page errors collection', () => {
    test('Collect console messages and ensure no hidden exceptions for valid expression', async ({ page }) => {
      const app = new InterpreterPage(page);
      await app.goto();

      await app.inputExpression('1 + 2');
      await app.clickInterpret();

      // Wait a bit to collect any console messages/errors
      await app.shortWait();

      // Expect at least result shown and no page errors
      await expect(page.locator('#result')).toHaveText('Result: 3');
      expect(app.pageErrors.length).toBe(0);

      // Console messages may be empty; ensure there is no console message of type 'error'
      const errorConsole = app.consoleMessages.find(m => m.type === 'error');
      expect(errorConsole).toBeUndefined();
    });
  });
});