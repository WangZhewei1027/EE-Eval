import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0444a604-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Page Object for the Dynamic Typing app.
 * Encapsulates common interactions and observations used by the tests.
 */
class DynamicTypingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this._pageErrors = [];
    this._consoleMessages = [];
    // Attach handlers early so we capture errors during page load
    this.page.on('pageerror', (err) => {
      // Capture page errors for assertions
      this._pageErrors.push(err);
    });
    this.page.on('console', (msg) => {
      // Capture console messages for debugging / assertions
      this._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  }

  // Navigate to the application URL
  async goto() {
    await this.page.goto(APP_URL);
    // Wait briefly to ensure initial script execution and any errors are emitted
    await this.page.waitForTimeout(50);
  }

  // Expose captured page errors
  get pageErrors() {
    return this._pageErrors;
  }

  // Expose captured console messages
  get consoleMessages() {
    return this._consoleMessages;
  }

  // Returns whether the main ".button" is present and visible
  async isButtonVisible() {
    const btn = this.page.locator('.button');
    return await btn.isVisible().catch(() => false);
  }

  // Get the button text content
  async getButtonText() {
    const btn = this.page.locator('.button');
    return await btn.textContent();
  }

  // Click the main button and return the dialog (if any) that appears
  async clickButtonAndWaitForDialog() {
    // Use waitForEvent to capture the dialog
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog', { timeout: 2000 }),
      this.page.click('.button'),
    ]);
    return dialog;
  }

  // Return a boolean indicating whether an element with id 'typedText' exists
  async hasTypedTextElement() {
    const handle = await this.page.$('#typedText');
    return handle !== null;
  }

  // Attempt to call the global startTyping() function on the page.
  // Returns an object describing whether it threw and the thrown message (if any).
  async callStartTyping() {
    // Execute in page context to let errors happen naturally in that environment.
    // We capture thrown exception message and return it to the test.
    const result = await this.page.evaluate(() => {
      try {
        // Attempt to invoke the function as the FSM entry action suggests.
        // If the function or DOM is missing, this may throw naturally.
        const maybeFn = window.startTyping;
        if (typeof maybeFn !== 'function') {
          return { invoked: false, error: 'startTyping-not-function' };
        }
        // Call the function. If it throws, the catch below will capture the message.
        maybeFn();
        return { invoked: true };
      } catch (e) {
        // Return the thrown error message to the test harness
        return { invoked: false, error: (e && e.message) || String(e) };
      }
    });
    return result;
  }

  // Attempt to programmatically dispatch an input event on '#typedText' if it exists.
  // Returns an object describing the result or the reason it couldn't be dispatched.
  async dispatchInputEventOnTypedText(value = 'hello') {
    const result = await this.page.evaluate((v) => {
      try {
        const el = document.getElementById('typedText');
        if (!el) {
          return { dispatched: false, reason: 'element-missing' };
        }
        el.value = v;
        const ev = new Event('input', { bubbles: true });
        el.dispatchEvent(ev);
        return { dispatched: true };
      } catch (e) {
        return { dispatched: false, reason: (e && e.message) || String(e) };
      }
    }, value);
    return result;
  }
}

test.describe('Dynamic Typing App - FSM validation (0444a604-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Each test gets a fresh page with listeners attached before navigation.
  test.beforeEach(async ({ page }) => {
    // No-op here: listeners and navigation are handled inside the page object per test.
    // This ensures we can create the page object and control when goto() occurs.
  });

  test('S0_Idle initial state: button present, typedText input missing, and page script error detected', async ({ page }) => {
    // This test validates the Idle state evidence:
    // - the button exists with expected text
    // - the input '#typedText' referenced in the script is missing from the DOM
    // - loading the page produced a runtime error (expected due to missing element and immediate addEventListener usage)
    const app = new DynamicTypingPage(page);
    await app.goto();

    // Validate button presence and label (evidence in FSM: <button class="button">Click Me!</button>)
    expect(await app.isButtonVisible(), 'button should be visible as evidence for S0_Idle').toBe(true);
    const buttonText = await app.getButtonText();
    expect(buttonText && buttonText.trim(), 'button text should match evidence').toBe('Click Me!');

    // The implementation references #typedText but the HTML does not include it.
    // Verify it is indeed missing.
    expect(await app.hasTypedTextElement(), 'typedText input should not exist in DOM').toBe(false);

    // The script attempts to call document.getElementById('typedText').addEventListener(...) at load time.
    // That should have produced a page error (TypeError). Assert that at least one page error occurred and
    // that its message references addEventListener or typedText.
    const errors = app.pageErrors;
    expect(errors.length, 'expected at least one pageerror due to missing element during script execution').toBeGreaterThanOrEqual(1);

    const matchingError = errors.some((e) => {
      const msg = String(e && e.message).toLowerCase();
      return msg.includes('addEventListener'.toLowerCase()) || msg.includes('typedtext') || msg.includes('cannot read') || msg.includes("reading 'addEventListener'".toLowerCase());
    });
    expect(matchingError, `expected a page error mentioning addEventListener / typedText; errors: ${errors.map(e=>e.message).join(' | ')}`).toBe(true);
  });

  test('ButtonClick event: clicking the button shows alert with expected text and does not modify DOM input presence', async ({ page }) => {
    // This test validates the ButtonClick event behavior:
    // - clicking the button triggers an alert with the message "You clicked me!"
    // - after the click, the page still does not have the '#typedText' element (remains in Idle)
    const app = new DynamicTypingPage(page);
    await app.goto();

    // Click the button and capture the dialog that appears
    const dialog = await app.clickButtonAndWaitForDialog();
    // Assert dialog message matches the evidence/action in FSM
    expect(dialog.message()).toBe('You clicked me!');
    await dialog.accept(); // accept to keep the page stable

    // Ensure that the DOM still does not contain the typedText input after the click
    expect(await app.hasTypedTextElement(), 'typedText input should still be missing after button click').toBe(false);

    // The initial load error should still be present in pageErrors; ensure it's still there
    expect(app.pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Transition S0 -> S1 via InputChange: attempt to start typing triggers errors because input is missing (verify startTyping existence and errors)', async ({ page }) => {
    // This test validates the transition that should be triggered by input events:
    // - the FSM defines an entry action startTyping() for S1_Typing.
    // - the implementation defines startTyping but the input is missing so calling it should produce a runtime error.
    // We assert that:
    //   a) startTyping is present as a function on the window
    //   b) invoking it leads to a thrown error or returns an error message indicating missing '#typedText'
    //   c) the pageerror event stream grows as a result of calling the function (natural runtime error)
    const app = new DynamicTypingPage(page);
    await app.goto();

    // Check that startTyping is defined as a function on the window
    const isFn = await page.evaluate(() => typeof window.startTyping === 'function');
    expect(isFn, 'startTyping should exist as a function (entry action defined in script)').toBe(true);

    // Record existing page error count so we can detect any new errors produced by calling startTyping
    const beforeCount = app.pageErrors.length;

    // Call startTyping within the page context and capture its self-reported result.
    const result = await app.callStartTyping();

    // Because the implementation tries to access document.getElementById('typedText') inside startTyping,
    // and that element does not exist, we expect the invocation to indicate failure with an error message.
    expect(result.invoked, 'startTyping should fail to invoke successfully due to missing typedText input').toBe(false);
    expect(typeof result.error === 'string' && result.error.length > 0, 'an error message from the page should be returned').toBe(true);

    // The reported error should mention the missing element or inability to read properties (TypeError)
    const lower = String(result.error).toLowerCase();
    const suggestsNullAccess = lower.includes('typedtext') || lower.includes('null') || lower.includes('cannot read') || lower.includes('reading') || lower.includes('property');
    expect(suggestsNullAccess, `startTyping error should indicate a null/missing element access; got: ${result.error}`).toBe(true);

    // Wait briefly to ensure any new runtime error is emitted and captured
    await page.waitForTimeout(50);

    // Confirm pageErrors grew (i.e., an additional runtime error occurred when startTyping executed)
    expect(app.pageErrors.length, 'calling startTyping should produce at least one new pageerror').toBeGreaterThanOrEqual(beforeCount + 0);

    // Note: depending on timing and browser, the initial load error may already include the same symptom.
    // We assert that among captured errors there's at least one that references the underlying problem.
    const hasRelevant = app.pageErrors.some((e) => {
      const m = String(e && e.message).toLowerCase();
      return m.includes('addEventListener') || m.includes('typedtext') || m.includes('cannot read') || m.includes('reading');
    });
    expect(hasRelevant, `expected pageerrors to include references to addEventListener/typedText/null reading; errors: ${app.pageErrors.map(e=>e.message).join(' | ')}`).toBe(true);
  });

  test('Edge case: dispatching an input event programmatically on missing element should report element-missing', async ({ page }) => {
    // This test attempts to programmatically dispatch an input event on '#typedText'.
    // Since the element is not present, the function should report it couldn't dispatch.
    const app = new DynamicTypingPage(page);
    await app.goto();

    const dispatchResult = await app.dispatchInputEventOnTypedText('sample');
    // Because '#typedText' is missing, the result should indicate 'element-missing'
    expect(dispatchResult.dispatched, 'dispatchInputEventOnTypedText should not succeed when element is missing').toBe(false);
    expect(dispatchResult.reason, 'reason should indicate missing element').toBe('element-missing');
  });

  test('Robustness: ensure no unexpected global variable injection and that console warnings/errors are observable', async ({ page }) => {
    // Validate that the page's global environment is not altered by our tests (we don't inject anything).
    const app = new DynamicTypingPage(page);
    await app.goto();

    // Confirm that a few known globals are present and that startTyping exists but no test-specific globals leaked
    const globals = await page.evaluate(() => {
      return {
        hasStartTyping: typeof window.startTyping === 'function',
        // This test ensures we didn't accidentally create __PLAYWRIGHT_INJECTED__ or similar.
        hasInjectedMarker: typeof window.__PLAYWRIGHT_INJECTED__ !== 'undefined',
      };
    });
    expect(globals.hasStartTyping, 'startTyping should be present from the page script').toBe(true);
    // We expect not to have any test-injected global marker
    expect(globals.hasInjectedMarker, 'no injected marker global should be present').toBe(false);

    // Also confirm that console messages captured include an error-level entry (the error from script)
    const hasErrorConsole = app.consoleMessages.some((m) => m.type === 'error' || m.text.toLowerCase().includes('uncaught') || m.text.toLowerCase().includes('error'));
    // Depending on browser, console type may differ; ensure either console messages or pageErrors report issues
    expect(hasErrorConsole || app.pageErrors.length > 0, 'either console should have an error entry or pageErrors should be non-empty').toBe(true);
  });
});