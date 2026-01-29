import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b3e652-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object Model for the Interpreter demo
class InterpreterPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.inputArea = page.locator('#inputArea');
    this.interpretBtn = page.locator('#interpretBtn');
    this.outputArea = page.locator('#outputArea');
    this.historyList = page.locator('#historyList');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setInput(value) {
    await this.inputArea.fill(value);
  }

  async clickInterpret() {
    await this.interpretBtn.click();
  }

  async getOutputText() {
    return (await this.outputArea.textContent()) ?? '';
  }

  async getHistoryItems() {
    return await this.page.$$eval('#historyList li', (els) => els.map(e => e.textContent || ''));
  }

  async getPlaceholder() {
    return await this.inputArea.getAttribute('placeholder');
  }

  async isInterpretButtonEnabled() {
    return await this.interpretBtn.isEnabled();
  }
}

test.describe('Interpreter Pattern Demo - FSM validation and UI behavior', () => {
  let pageModel;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console messages and uncaught page errors to observe runtime problems
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Collect console messages with their type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Collect any uncaught exceptions that surface as page errors
      pageErrors.push(err);
    });

    pageModel = new InterpreterPage(page);
    await pageModel.goto();
  });

  test.afterEach(async () => {
    // Basic sanity: ensure no unexpected page errors or console.error messages occurred during the test.
    // These assertions will fail the test if there are runtime exceptions or console error calls.
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    test.expect(pageErrors.length, 'No uncaught page errors should have occurred').toBe(0);
    test.expect(errorConsole.length, 'No console.error messages should have been emitted').toBe(0);
  });

  test('S0_Idle: initial render shows input, button, empty output and empty history', async () => {
    // Validate the Idle state (onEnter: renderPage())
    // - input textarea exists with correct placeholder
    // - Interpret button exists and is enabled
    // - output area is empty
    // - history list is empty

    const placeholder = await pageModel.getPlaceholder();
    expect(placeholder).toContain("Enter simple arithmetic expressions");
    expect(await pageModel.isInterpretButtonEnabled()).toBe(true);

    const outputText = await pageModel.getOutputText();
    expect(outputText).toBe(''); // outputArea should be empty initially

    const historyItems = await pageModel.getHistoryItems();
    expect(historyItems.length).toBe(0);
  });

  test('S0 -> S1 (InterpretExpression): valid expression displays result and adds to history', async () => {
    // Validate transition from Idle to ResultDisplayed:
    // - enter a valid expression, click Interpret Expression
    // - outputArea should contain "input = result"
    // - history should be prepended with the result
    // - no page errors or console errors occur

    // First expression
    await pageModel.setInput('7 + 3 - 2');
    await pageModel.clickInterpret();

    // Expect the output text to exactly match "7 + 3 - 2 = 8"
    await expect(pageModel.outputArea).toHaveText('7 + 3 - 2 = 8');

    let history = await pageModel.getHistoryItems();
    expect(history.length).toBe(1);
    expect(history[0]).toBe('7 + 3 - 2 = 8');

    // Second expression to validate history prepend order
    await pageModel.setInput('10 - 4 + 1');
    await pageModel.clickInterpret();

    // Expect result for second expression: 10 - 4 + 1 = 7
    await expect(pageModel.outputArea).toHaveText('10 - 4 + 1 = 7');

    history = await pageModel.getHistoryItems();
    expect(history.length).toBe(2);
    // newest should be first
    expect(history[0]).toBe('10 - 4 + 1 = 7');
    expect(history[1]).toBe('7 + 3 - 2 = 8');
  });

  test('S0 -> S2 (InterpretExpression): empty input shows friendly message (edge-case)', async () => {
    // Edge case: clicking Interpret with empty input
    // The application handles this specifically and displays a user prompt message.
    // This is part of the Idle->ErrorDisplayed behavior in the sense of user-visible error-like feedback.

    await pageModel.setInput(''); // ensure empty
    await pageModel.clickInterpret();

    // Expect a friendly instruction to be shown
    await expect(pageModel.outputArea).toHaveText('Please enter an expression to interpret.');

    // History should still be empty (no entries added)
    const history1 = await pageModel.getHistoryItems();
    expect(history.length).toBe(0);
  });

  test('S0 -> S2 (InterpretExpression): invalid token triggers ErrorDisplayed and does NOT add history', async () => {
    // Invalid token e.g. letters in expression -> tokenization throws and is caught by UI
    // Expect outputArea to contain an "Error: ..." message and no history entry added.

    await pageModel.setInput('7 + x');
    await pageModel.clickInterpret();

    // The tokenizer is expected to throw something like "Invalid token at end: x" or "Invalid token: x"
    const out = await pageModel.getOutputText();
    expect(out.startsWith('Error:')).toBe(true);
    // Ensure message mentions "Invalid token" or similar by checking substring presence
    expect(out.toLowerCase()).toContain('invalid');

    // Ensure no history item was created
    const history2 = await pageModel.getHistoryItems();
    expect(history.length).toBe(0);
  });

  test('S0 -> S2 (InterpretExpression): malformed expression (trailing operator) shows parser error', async () => {
    // Malformed expression like "7 +" should cause a parse-time error that is displayed to the user

    await pageModel.setInput('7 +');
    await pageModel.clickInterpret();

    const out1 = await pageModel.getOutputText();
    expect(out.startsWith('Error:')).toBe(true);
    // Parser error should indicate that a number was expected but none was found
    expect(out.toLowerCase()).toContain('number expected');

    // No history should be created
    const history3 = await pageModel.getHistoryItems();
    expect(history.length).toBe(0);
  });

  test('Multiple sequential interpretations: results update and history maintains chronological prepend order', async () => {
    // Ensure repeated successful interpretations continue to update history in prepend order and output display

    const expressions = [
      { expr: '1 + 2', expected: '1 + 2 = 3' },
      { expr: '5 - 2', expected: '5 - 2 = 3' },
      { expr: '4 + 6 - 1', expected: '4 + 6 - 1 = 9' }
    ];

    for (const item of expressions) {
      await pageModel.setInput(item.expr);
      await pageModel.clickInterpret();
      await expect(pageModel.outputArea).toHaveText(item.expected);
    }

    const history4 = await pageModel.getHistoryItems();
    expect(history.length).toBe(expressions.length);

    // Check prepend order: last interpreted expression appears first
    expect(history[0]).toBe(expressions[2].expected);
    expect(history[1]).toBe(expressions[1].expected);
    expect(history[2]).toBe(expressions[0].expected);
  });

  test('UI resilience: non-digit characters mixed with spaces produce a clear error and no uncaught exceptions', async () => {
    // Inputs with unexpected tokens and spacing should be handled gracefully by the tokenizer, not by crashing the page.

    await pageModel.setInput('  12   +   foo  ');
    await pageModel.clickInterpret();

    const out2 = await pageModel.getOutputText();
    expect(out.startsWith('Error:')).toBe(true);
    // message should mention invalid token or similar
    expect(out.toLowerCase()).toContain('invalid');

    // Ensure application did not throw uncaught exceptions (captured by afterEach)
    const history5 = await pageModel.getHistoryItems();
    expect(history.length).toBe(0);
  });
});