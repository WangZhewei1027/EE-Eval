import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520b42c2-fa76-11f0-a09b-87751f540fd8.html';

/**
 * Page Object for interactions with the Interpreter page.
 * Encapsulates loading the page and capturing dialog, console and page errors.
 */
class InterpreterPage {
  /**
   * Construct with the Playwright page fixture.
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    this._dialogSeen = false;
    this._lastDialogMessage = null;
    this._dialogType = null;
  }

  /**
   * Prepare listeners for console and page errors.
   * Must be called before navigate to capture early events.
   */
  _installListeners() {
    this.consoleMessages = [];
    this.pageErrors = [];
    this._dialogSeen = false;
    this._lastDialogMessage = null;
    this._dialogType = null;

    this.page.on('console', msg => {
      // Capture only textual representation
      try {
        // Only push log messages (console.log)
        if (msg.type() === 'log') {
          this.consoleMessages.push(msg.text());
        } else {
          // Still capture other console types for debugging
          this.consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
        }
      } catch (e) {
        // Defensive: ignore any console handler issues
      }
    });

    this.page.on('pageerror', err => {
      // err is an Error with message and stack
      this.pageErrors.push(err);
    });
  }

  /**
   * Load the app and respond to the prompt dialog.
   * @param {Object} options
   * @param {string|null} options.response - string to accept into prompt OR null to dismiss (simulate cancel)
   * @param {boolean} options.dismiss - if true, dismiss the prompt (simulates Cancel). If false, accept with response.
   */
  async loadAndHandlePrompt({ response = '', dismiss = false } = {}) {
    this._installListeners();

    // Install dialog handler BEFORE navigation so prompt is handled
    this.page.once('dialog', async dialog => {
      this._dialogSeen = true;
      this._lastDialogMessage = dialog.message();
      this._dialogType = dialog.type();
      if (dismiss) {
        await dialog.dismiss();
      } else {
        // Accept with provided response (must be string)
        // If response is null we still call accept(null) which behaves like empty string in some browsers;
        // to simulate user cancel we use dismiss=true.
        await dialog.accept(response);
      }
    });

    // Navigate to the page which triggers prompt immediately
    await this.page.goto(APP_URL, { waitUntil: 'load' });

    // Wait a tick to allow script to run and console/pageerror to emit
    await this.page.waitForTimeout(100);
    return {
      consoleMessages: this.consoleMessages.slice(),
      pageErrors: this.pageErrors.slice(),
      dialogSeen: this._dialogSeen,
      dialogMessage: this._lastDialogMessage,
      dialogType: this._dialogType,
    };
  }
}

test.describe('Interpreter FSM end-to-end tests (Application ID: 520b42c2-fa76-11f0-a09b-87751f540fd8)', () => {
  // Test S0_Idle -> S1_CodeInput transition: prompt should appear on page load
  test('S0_Idle -> S1_CodeInput: page load triggers prompt dialog with correct message', async ({ page }) => {
    // Arrange
    const ip = new InterpreterPage(page);

    // Act: dismiss the prompt immediately to avoid further processing
    const result = await ip.loadAndHandlePrompt({ response: '', dismiss: false });

    // Assert: dialog was seen and has the expected prompt message
    // This validates the "prompt('Enter your code: ')" entry action for the Code Input state.
    expect(result.dialogSeen).toBe(true);
    expect(result.dialogType).toBe('prompt');
    expect(result.dialogMessage).toBe("Enter your code: ");
  });

  // Test full processing for simple non-keyword code -> S2_CodeProcessed logged
  test('S1_CodeInput -> S2_CodeProcessed: simple multiline input is processed and printed via console.log', async ({ page }) => {
    // This test validates that normal input (non-keywords) flows through interpreter(), and console.log(output) occurs.
    const ip1 = new InterpreterPage(page);

    const code = `hello
world`;
    const result1 = await ip.loadAndHandlePrompt({ response: code, dismiss: false });

    // No page errors expected for valid string input
    expect(result.pageErrors.length).toBe(0);

    // Exactly one console.log expected (the script does a single console.log(output))
    expect(result.consoleMessages.length).toBeGreaterThanOrEqual(1);

    // The interpreter concatenates lines and appends newline after each non-keyword line.
    // Expect the logged output to include both lines followed by newline characters.
    const logged = result.consoleMessages.join('\n');
    expect(logged).toContain('hello');
    expect(logged).toContain('world');
    // Also expect trailing newline for each input line: at least one newline at the end
    expect(logged.endsWith('\n') || logged.includes('\n')).toBe(true);
  });

  // Test keyword lines produce "Invalid ... statement" messages because the internal stack is empty
  test('S2_CodeProcessed: keyword-only input produces "Invalid ..." messages (edge behavior)', async ({ page }) => {
    // This test validates interpreter behavior for keyword lines given the current implementation:
    // because stack is empty, all keyword checks will fall through to "Invalid ..." messages.
    const ip2 = new InterpreterPage(page);

    const code1 = `if
else
for
while
print`;
    const result2 = await ip.loadAndHandlePrompt({ response: code, dismiss: false });

    expect(result.pageErrors.length).toBe(0);
    expect(result.consoleMessages.length).toBeGreaterThanOrEqual(1);

    const output = result.consoleMessages.join('\n');

    // All keyword lines should lead to "Invalid X statement" parts in the output
    expect(output).toContain('Invalid if statement');
    expect(output).toContain('Invalid else statement');
    expect(output).toContain('Invalid for loop');
    expect(output).toContain('Invalid while loop');
    expect(output).toContain('Invalid print statement');
  });

  // Edge case: user enters an empty string -> interpreter should return a single newline (empty line)
  test('Edge case: empty string input results in a single newline output (treated as empty line)', async ({ page }) => {
    // Validate how interpreter handles an empty string input (""), which splits to [''] and results in '\n'
    const ip3 = new InterpreterPage(page);

    const result3 = await ip.loadAndHandlePrompt({ response: '', dismiss: false });

    expect(result.pageErrors.length).toBe(0);
    // Should log something (likely a newline)
    expect(result.consoleMessages.length).toBeGreaterThanOrEqual(1);

    const output1 = result.consoleMessages.join('\n');
    // The output should contain at least a newline character (representing the empty line)
    expect(output.includes('\n')).toBe(true);
  });

  // Error scenario: user cancels the prompt -> prompt returns null, interpreter will attempt code.split and throw
  test('Error scenario: canceling the prompt leads to a runtime TypeError (null.split) and an uncaught page error', async ({ page }) => {
    // This test intentionally simulates the user pressing Cancel on the prompt.
    // According to the page script, code will be null and calling code.split will throw a TypeError.
    const ip4 = new InterpreterPage(page);

    // Dismiss the prompt to simulate cancel; interpreter(code) will receive null and then calling split should error.
    const result4 = await ip.loadAndHandlePrompt({ dismiss: true });

    // We expect at least one page error to have been emitted
    expect(result.pageErrors.length).toBeGreaterThanOrEqual(1);

    // Validate that the error message references 'split' or 'Cannot read' which indicates null.split failure,
    // i.e., a TypeError thrown by attempting to call split on null.
    const messages = result.pageErrors.map(e => (e && e.message) || String(e));
    const combined = messages.join(' | ');

    // Accept multiple possible runtime messages across environments but ensure it's a TypeError due to split on null
    const hasSplitMention = /split/.test(combined);
    const hasCannotReadMention = /Cannot read/i.test(combined);
    const hasTypeError = /TypeError/.test(combined);

    expect(hasSplitMention || hasCannotReadMention || hasTypeError).toBe(true);
  });

  // Integration test validating the full FSM transitions in sequence: Idle -> CodeInput -> CodeProcessed
  test('Integration: assert the FSM-like sequence on a normal run (prompt seen, accepted, and console logged)', async ({ page }) => {
    // This test checks the sequence: on loading the app user sees prompt (S1 entry),
    // user provides code and then console.log fires indicating S2 entry action was executed.
    const ip5 = new InterpreterPage(page);

    const code2 = `line1
line2`;
    const result5 = await ip.loadAndHandlePrompt({ response: code, dismiss: false });

    // Prompt must have occurred (S1_CodeInput entry action)
    expect(result.dialogSeen).toBe(true);
    expect(result.dialogMessage).toBe("Enter your code: ");

    // No page errors for normal processing
    expect(result.pageErrors.length).toBe(0);

    // Console output should contain the processed content (S2_CodeProcessed entry action evidence)
    expect(result.consoleMessages.length).toBeGreaterThanOrEqual(1);
    const output2 = result.consoleMessages.join('\n');
    expect(output).toContain('line1');
    expect(output).toContain('line2');
  });
});