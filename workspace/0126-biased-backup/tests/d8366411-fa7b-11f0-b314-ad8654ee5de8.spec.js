import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8366411-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object for the Recursion demo page
class RecursionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#runDemo');
    this.traceOutput = page.locator('#traceOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for main interactive elements to be present
    await expect(this.runButton).toBeVisible();
    await expect(this.traceOutput).toBeHidden();
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getOutputText() {
    // textContent() returns the full string including newlines
    return (await this.traceOutput.textContent()) || '';
  }

  async isButtonDisabled() {
    return await this.runButton.isDisabled();
  }

  async getButtonText() {
    return await this.runButton.textContent();
  }

  async getTraceHiddenAttribute() {
    // returns the aria-hidden attribute (string) and the hidden boolean
    const ariaHidden = await this.traceOutput.getAttribute('aria-hidden');
    const hidden = await this.traceOutput.evaluate((el) => el.hidden);
    return { ariaHidden, hidden };
  }
}

test.describe('Recursion — FSM states and transitions (d8366411-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages including their types to validate there are no unexpected errors.
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught exceptions on the page (pageerror events).
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Assert that the page did not raise runtime page errors during the test.
    // This validates that any ReferenceError/SyntaxError/TypeError would be captured and cause a failing assertion here.
    expect(pageErrors.length, 'No uncaught page errors should have occurred').toBe(0);

    // Assert there are no console.error messages emitted during the test.
    const errorConsoleMsgs = consoleMessages.filter((m) => m.type === 'error');
    expect(
      errorConsoleMsgs.length,
      `No console.error messages expected, found: ${errorConsoleMsgs.map((m) => m.text).join(' | ')}`
    ).toBe(0);
  });

  test.describe('State S0_Idle (initial render)', () => {
    test('renders the initial UI with button visible and trace output hidden', async ({ page }) => {
      // This test validates the Idle state (S0_Idle) as described in the FSM:
      // - The button "#runDemo" should be visible and enabled.
      // - The trace output "#traceOutput" should be hidden and have aria-hidden="true".
      const app = new RecursionPage(page);
      await app.goto();

      // Verify the run button exists and shows the expected label
      await expect(app.runButton).toBeVisible();
      await expect(app.runButton).toHaveText('Show factorial call trace (n = 6)');
      expect(await app.isButtonDisabled()).toBe(false);

      // Verify trace output is hidden and aria-hidden attribute is true (initial state)
      await expect(app.traceOutput).toBeHidden();
      const { ariaHidden, hidden } = await app.getTraceHiddenAttribute();
      expect(ariaHidden).toBe('true');
      expect(hidden).toBe(true);
    });
  });

  test.describe('Event: ShowFactorialTrace and transition to S1_TraceDisplayed', () => {
    test('clicking the button displays a factorial trace, reveals output, disables button and updates button text', async ({ page }) => {
      // This test exercises the transition from S0_Idle -> S1_TraceDisplayed triggered by clicking #runDemo.
      // It verifies:
      // - trace content is set to the textual factorial call trace for n = 6
      // - the #traceOutput element is visible (hidden=false, aria-hidden="false")
      // - the button is disabled and its text changed to "Trace shown"
      const app = new RecursionPage(page);
      await app.goto();

      // Perform the user action (click)
      await app.clickRun();

      // After clicking: #traceOutput should be visible and contain the expected lines
      await expect(app.traceOutput).toBeVisible();
      const outputText = await app.getOutputText();

      // Basic sanity checks: contains the enter for factorial(6), base case, compute lines, and final RESULT
      expect(outputText).toContain('enter: factorial(6)');
      expect(outputText).toContain('base case: return 1');
      expect(outputText).toContain('RESULT: factorial(6) = 720');

      // Validate exit and compute lines present for intermediate steps (example: compute: 2 * 1 = 2)
      expect(outputText).toMatch(/compute: 2 \* 1 = 2/);
      expect(outputText).toMatch(/exit: factorial\(6\) => 720/);

      // The trace should include an 'enter' line for each depth from 6 down to 0 (7 entries total)
      const enterLines = outputText.split('\n').filter((line) => line.trim().startsWith('enter: factorial('));
      expect(enterLines.length).toBe(7);

      // Check that #traceOutput attributes reflect visible state
      const { ariaHidden, hidden } = await app.getTraceHiddenAttribute();
      expect(ariaHidden).toBe('false'); // setAttribute('aria-hidden','false') in script
      expect(hidden).toBe(false);

      // Button should be disabled and its text should update according to implementation
      await expect(app.runButton).toBeDisabled();
      await expect(app.runButton).toHaveText('Trace shown');
    });

    test('edge case: repeated interaction does not duplicate the trace or re-enable the button', async ({ page }) => {
      // This test verifies the implementation used {once:true} on the event listener and that the UI prevents repeated heavy logs:
      // - After initial click, the button is disabled and subsequent clicks do not change the output text.
      // - No uncaught exceptions or console errors occur when attempting further interactions.
      const app = new RecursionPage(page);
      await app.goto();

      // Click once to show trace
      await app.clickRun();
      await expect(app.traceOutput).toBeVisible();
      const firstOutput = await app.getOutputText();

      // Confirm the button is disabled (user can't click normally); attempt to click a second time forcefully to verify handler isn't invoked twice.
      expect(await app.isButtonDisabled()).toBe(true);

      // Force clicking a disabled button simulates a malicious/edge action; the implementation used {once:true},
      // so even if the click event could fire, it should not append another trace.
      // Use force click to simulate this edge-case user action; we do not change the page code.
      await app.runButton.click({ force: true });

      // The output should remain unchanged
      const secondOutput = await app.getOutputText();
      expect(secondOutput).toBe(firstOutput);

      // The button should remain disabled and text remain 'Trace shown'
      await expect(app.runButton).toBeDisabled();
      await expect(app.runButton).toHaveText('Trace shown');
    });
  });

  test.describe('Robustness and observability (console and page errors)', () => {
    test('no runtime page errors and no console.error messages during normal usage', async ({ page }) => {
      // This test loads the page, exercises the main interaction, and then asserts that there were no runtime page errors
      // (ReferenceError, SyntaxError, TypeError, etc.) and no console.error messages emitted.
      const app = new RecursionPage(page);

      // Note: console and pageerror listeners are set up in beforeEach; they accumulate into outer arrays
      await app.goto();

      // Interact with the page: click the demo button to exercise the script logic
      await app.clickRun();

      // Wait a short moment for any asynchronous console messages (if any)
      await page.waitForTimeout(100);

      // The afterEach hook will make assertions about pageErrors and consoleMessages.
      // We make additional local assertions here to be explicit and descriptive.
      expect(pageErrors.length).toBe(0);
      const errorConsoleMsgs = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsoleMsgs.length).toBe(0);
    });

    test('observes console.info/debug messages if present but ensures no errors', async ({ page }) => {
      // This test is mostly observational: it ensures other console message types do not imply failure,
      // but that error-level messages are absent.
      const app = new RecursionPage(page);
      await app.goto();

      // Exercise interaction
      await app.clickRun();
      await page.waitForTimeout(100);

      // Collect warnings/info (allowed), and assert none are of type 'error'
      const warnings = consoleMessages.filter((m) => m.type === 'warning');
      const infos = consoleMessages.filter((m) => m.type === 'info' || m.type === 'debug' || m.type === 'log');
      // We accept any number of informative logs; just ensure error count is zero (checked in afterEach)
      expect(Array.isArray(infos)).toBe(true);
      expect(Array.isArray(warnings)).toBe(true);
    });
  });
});