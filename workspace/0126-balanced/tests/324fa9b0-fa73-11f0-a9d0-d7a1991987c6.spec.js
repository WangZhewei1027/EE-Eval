import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324fa9b0-fa73-11f0-a9d0-d7a1991987c6.html';

// Page object encapsulating interactions with the simple compiler demo page
class CompilerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.codeInput = page.locator('#codeInput');
    this.compileButton = page.locator('#compileButton');
    this.output = page.locator('#output');
  }

  // Navigate to the app and ensure core elements are present
  async goto() {
    await this.page.goto(APP_URL);
    await expect(this.codeInput).toBeVisible();
    await expect(this.compileButton).toBeVisible();
    await expect(this.output).toBeVisible();
  }

  // Fill input and click compile, then wait for output to change from previous text
  async compileExpression(input) {
    const previous = (await this.output.textContent()) ?? '';
    await this.codeInput.fill(input);
    // Click the compile button
    await this.compileButton.click();
    // Wait for output to change (either Result: ... or Error: ...)
    await this.page.waitForFunction(
      (prev) => document.getElementById('output')?.textContent !== prev,
      previous,
      { timeout: 2000 }
    );
    return (await this.output.textContent()) ?? '';
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }
}

// Grouping tests for the FSM states and transitions
test.describe('Simple Compiler Demonstration - FSM Validation', () => {
  // Collect console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // No-op here; each test sets up its own listeners as needed.
  });

  test.describe('S0_Idle (Idle) state - initial render', () => {
    test('renders textarea, compile button and empty output on load', async ({ page }) => {
      // This test validates the "renderPage()" / initial entry action by checking DOM presence.
      const consoleMessages = [];
      const pageErrors = [];

      page.on('console', (msg) => {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', (err) => {
        pageErrors.push(err);
      });

      const app = new CompilerPage(page);
      await app.goto();

      // Verify textarea placeholder text (evidence of expected component)
      await expect(app.codeInput).toHaveAttribute('placeholder', 'Enter expression here...');
      // Verify button label
      await expect(app.compileButton).toHaveText('Compile');
      // On initial load output should be empty
      await expect(app.output).toHaveText('');

      // There should be no uncaught page errors on initial load
      expect(pageErrors.length).toBe(0);

      // We capture console logs but do not require any specific log; ensure it's an array
      expect(Array.isArray(consoleMessages)).toBeTruthy();
    });
  });

  test.describe('S1_Compiled (Compiled) state - successful compilations', () => {
    test('compiles a valid arithmetic expression and shows numeric result', async ({ page }) => {
      // This test validates the transition from Idle -> Compiled on a successful eval
      const pageErrors1 = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      const app1 = new CompilerPage(page);
      await app.goto();

      const output = await app.compileExpression('2 + 2 * (3 - 1)');
      // Expect the output to show the evaluated result (2 + 2*(3-1) = 6)
      expect(output).toContain('Result:');
      expect(output).toContain('6');

      // No uncaught page errors are expected because runtime errors (if any) are caught by the app
      expect(pageErrors.length).toBe(0);
    });

    test('compiles an empty input and shows Result: undefined', async ({ page }) => {
      // Edge case: empty input should evaluate to undefined and be shown as such
      const pageErrors2 = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      const app2 = new CompilerPage(page);
      await app.goto();

      const output1 = await app.compileExpression('');
      expect(output).toContain('Result:');
      // eval('') yields undefined in JS
      expect(output).toContain('undefined');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S1_Compiled (Compiled) state - error scenarios', () => {
    test('shows a SyntaxError message when compiling incomplete expression', async ({ page }) => {
      // This test triggers a SyntaxError naturally via invalid input and asserts the error is presented in the output.
      const pageErrors3 = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      const app3 = new CompilerPage(page);
      await app.goto();

      const output2 = await app.compileExpression('2 +'); // incomplete expression -> SyntaxError
      // Application wraps eval in try/catch and sets output to "Error: <message>"
      expect(output).toMatch(/^Error:\s*/);
      // Message content may vary across engine versions, so check for common SyntaxError indicators
      expect(/Unexpected|Unexpected end|Unexpected token|SyntaxError/i.test(output)).toBeTruthy();

      // Errors thrown in eval are caught by the app; there should be no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('shows a ReferenceError message when referencing an undefined variable', async ({ page }) => {
      // This test triggers a ReferenceError naturally and asserts the DOM displays the error message.
      const pageErrors4 = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      const app4 = new CompilerPage(page);
      await app.goto();

      const varName = 'thisVariableDoesNotExist123';
      const output3 = await app.compileExpression(`${varName} + 1`);
      expect(output).toMatch(/^Error:\s*/);
      // ReferenceError messages usually indicate "is not defined" or include the variable name
      expect(/not defined|is not defined|ReferenceError|undefined/i.test(output)).toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });

    test('shows a TypeError message when attempting to call a property on null', async ({ page }) => {
      // This test triggers a TypeError naturally (null.f()) and asserts error presentation in the DOM.
      const pageErrors5 = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      const app5 = new CompilerPage(page);
      await app.goto();

      // Attempt to call a property on null which should raise a TypeError
      const output4 = await app.compileExpression('null.f()');
      expect(output).toMatch(/^Error:\s*/);
      // TypeError messages vary; check for common tokens
      expect(/Cannot read|cannot read|TypeError|is not a function|reading/i.test(output)).toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });

    test('after an error, a subsequent valid compile transitions to result correctly', async ({ page }) => {
      // This test validates the FSM transition behavior across multiple compile attempts.
      const pageErrors6 = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      const app6 = new CompilerPage(page);
      await app.goto();

      // Trigger an error first
      const errOutput = await app.compileExpression('2 +');
      expect(errOutput).toMatch(/^Error:\s*/);

      // Then compile a valid expression; expect result to override the error state
      const successOutput = await app.compileExpression('10 - 3');
      expect(successOutput).toContain('Result:');
      // 10 - 3 = 7
      expect(successOutput).toContain('7');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Additional observability checks', () => {
    test('observes console messages and ensures no uncaught exceptions bubble up', async ({ page }) => {
      // Attach listeners to capture console events and page errors that may arise during interactions.
      const consoleMessages1 = [];
      const pageErrors7 = [];
      page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', (err) => pageErrors.push(err));

      const app7 = new CompilerPage(page);
      await app.goto();

      // Perform a few interactions to generate potential messages
      await app.compileExpression('3 * 3'); // valid
      await app.compileExpression('notAThing + 1'); // ReferenceError caught and shown in DOM
      await app.compileExpression('null.x()'); // TypeError caught and shown in DOM

      // We expect the application to catch runtime errors and display them in DOM rather than letting them become uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Console messages may or may not be present; ensure collected structure is valid
      expect(Array.isArray(consoleMessages)).toBeTruthy();
    });
  });
});