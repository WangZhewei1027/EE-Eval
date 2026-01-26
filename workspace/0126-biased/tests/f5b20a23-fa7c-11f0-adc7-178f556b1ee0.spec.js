import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b20a23-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Simple Page Object Model for the Amortized Analysis app
 * Encapsulates common interactions and state observation helpers.
 */
class AmortizedPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#amortized-example-button');
    this._consoleMessages = [];
    this._pageErrors = [];
    this._consoleListener = null;
    this._pageErrorListener = null;
  }

  async goto() {
    // Attach listeners before navigating so we capture events that may happen on load
    this._attachListeners();
    await this.page.goto(APP_URL);
  }

  _attachListeners() {
    // avoid double-attaching if called multiple times in the same test instance
    if (this._consoleListener || this._pageErrorListener) return;

    this._consoleListener = (msg) => {
      // store both type and the text for assertions
      this._consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    this._pageErrorListener = (err) => {
      // store the Error object for detailed assertions
      this._pageErrors.push(err);
    };
    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
  }

  detachListeners() {
    if (this._consoleListener) {
      this.page.removeListener('console', this._consoleListener);
      this._consoleListener = null;
    }
    if (this._pageErrorListener) {
      this.page.removeListener('pageerror', this._pageErrorListener);
      this._pageErrorListener = null;
    }
  }

  get consoleMessages() {
    return this._consoleMessages;
  }

  get pageErrors() {
    return this._pageErrors;
  }

  async clickApplyButton() {
    await this.button.click();
  }

  async clickApplyButtonMultiple(times = 1) {
    for (let i = 0; i < times; i++) {
      await this.button.click();
    }
  }

  async isButtonVisible() {
    return await this.button.isVisible();
  }

  async getButtonText() {
    return await this.button.textContent();
  }
}

test.describe('Amortized Analysis App - FSM states and transitions', () => {
  // We'll create a fresh AmortizedPage per test via beforeEach
  let app;

  test.beforeEach(async ({ page }) => {
    app = new AmortizedPage(page);
    await app.goto();
  });

  test.afterEach(async () => {
    // clean up listeners to avoid leaking across tests
    app.detachListeners();
  });

  test('S0_Idle: initial state shows the "Apply Amortized Analysis" button', async () => {
    // Validate the initial Idle state: button should be present and visible
    const visible = await app.isButtonVisible();
    expect(visible).toBe(true);

    // Validate text content matches FSM/evidence
    const text = await app.getButtonText();
    expect(text).toBe('Apply Amortized Analysis');

    // At idle before any interactions, there should be no entry action logs triggered
    const logs = app.consoleMessages.map(m => m.text);
    expect(logs).not.toContain(expect.stringContaining('The average cost per unit of time is:'));
    // Also assert no page errors observed so far
    expect(app.pageErrors.length).toBe(0);
  });

  test('Transition ApplyAmortizedAnalysis: clicking the button triggers the S1_AnalysisApplied entry console.log', async () => {
    // Ensure prior to click there's no amortized log
    const preLogs = app.consoleMessages.map(m => m.text);
    expect(preLogs.some(t => t.includes('The average cost per unit of time is:'))).toBe(false);

    // Perform the event: click the button (ApplyAmortizedAnalysis)
    await app.clickApplyButton();

    // The FSM expected observable is a console.log output on entering S1
    // Wait for a console message matching the expected output to appear
    // Inspect the collected console messages
    const logTexts = app.consoleMessages.map(m => m.text);
    const amortizedLog = logTexts.find(t => t.includes('The average cost per unit of time is:'));
    expect(amortizedLog).toBeTruthy();

    // The implementation calculates:
    // initialCost = 10000, interestRate = 0.10, numberOfPeriods = 5
    // totalInterestEarned = 10000 * 0.10 * 5 = 5000
    // averageCostPerUnitOfTime = 5000 / 5 = 1000 -> formatted to 1000.00
    expect(amortizedLog).toContain('$1000.00');

    // Ensure there were no uncaught page errors produced by the normal click/handler behavior
    expect(app.pageErrors.length).toBe(0);
  });

  test('S1 entry action occurs exactly on click and not before - multiple verifications', async () => {
    // Validate no entry action log before click
    expect(app.consoleMessages.some(m => m.text.includes('The average cost per unit of time is:'))).toBe(false);

    // Click once and assert one message appears
    await app.clickApplyButton();
    let occurrences = app.consoleMessages.filter(m => m.text.includes('The average cost per unit of time is:')).length;
    expect(occurrences).toBe(1);

    // Click again and assert another message (exit actions not defined, so nothing else expected)
    await app.clickApplyButton();
    occurrences = app.consoleMessages.filter(m => m.text.includes('The average cost per unit of time is:')).length;
    expect(occurrences).toBe(2);

    // Confirm formatting each time is consistent
    for (const msg of app.consoleMessages.filter(m => m.text.includes('The average cost per unit of time is:'))) {
      expect(msg.text).toContain('$1000.00');
      // Ensure message starts with expected prefix
      expect(msg.text.startsWith('The average cost per unit of time is:')).toBe(true);
    }

    // No page errors triggered by repeated clicks
    expect(app.pageErrors.length).toBe(0);
  });

  test('Edge case: rapid multiple clicks produce corresponding multiple console logs', async () => {
    // Rapidly click 5 times
    await app.clickApplyButtonMultiple(5);

    // Count amortized log occurrences
    const amortizedLogs = app.consoleMessages.filter(m => m.text.includes('The average cost per unit of time is:'));
    expect(amortizedLogs.length).toBe(5);

    // Verify each log has the expected numeric formatting
    for (const entry of amortizedLogs) {
      expect(entry.text).toMatch(/The average cost per unit of time is: \$\d+(\.\d{2})?/);
      expect(entry.text).toContain('$1000.00');
    }

    // No uncaught page errors expected under normal rapid clicks
    expect(app.pageErrors.length).toBe(0);
  });

  test('Edge case & error scenario: invoking an undefined function in page context causes a ReferenceError (observed as pageerror)', async () => {
    // This test intentionally triggers a ReferenceError inside the page to validate pageerror observation behavior.
    // We expect page.evaluate to reject and a pageerror event to be emitted which we can assert was captured.

    // Clear any existing recorded errors/messages
    app._consoleMessages.length = 0;
    app._pageErrors.length = 0;

    // Attempt to execute a non-existent function in the page context.
    // This should naturally produce a ReferenceError and be captured by our pageerror listener.
    let caught = false;
    try {
      // The page will throw; Playwright will surface this as a rejection of evaluate()
      await app.page.evaluate(() => {
        // Intentionally call a function that does not exist in the page scope
        // This must be allowed per instructions (do not patch or define the function).
        // eslint-disable-next-line no-undef
        nonExistentFunctionToTriggerReferenceError();
      });
    } catch (err) {
      // We expect an error to be thrown here; mark that we've caught it
      caught = true;
      // The thrown error may be a Playwright error wrapping the page exception
      expect(err).toBeTruthy();
    }

    expect(caught).toBe(true);

    // The pageerror listener should have captured at least one error object
    expect(app.pageErrors.length).toBeGreaterThanOrEqual(1);

    // Inspect the first captured page error for a ReferenceError
    const firstError = app.pageErrors[0];
    expect(firstError).toBeInstanceOf(Error);
    // Error message should indicate the undefined function name or ReferenceError
    const msg = firstError.message || String(firstError);
    expect(msg).toMatch(/ReferenceError|is not defined|nonExistentFunctionToTriggerReferenceError/);
  });

  test('Sanity: ensure normal console logging and no SyntaxError/TypeError on page load', async () => {
    // This test asserts that the page loads without runtime SyntaxError or TypeError occurrences.
    // We already attached listeners in beforeEach; assert no page errors that are SyntaxError/TypeError happened.
    const errors = app.pageErrors.map(e => e.message || String(e));
    const hasSyntaxOrType = errors.some(e => /SyntaxError|TypeError/.test(e));
    expect(hasSyntaxOrType).toBe(false);

    // Also ensure that clicking still produces the amortized log as expected
    await app.clickApplyButton();
    const amortized = app.consoleMessages.find(m => m.text.includes('The average cost per unit of time is:'));
    expect(amortized).toBeTruthy();
    expect(amortized.text).toContain('$1000.00');
  });
});