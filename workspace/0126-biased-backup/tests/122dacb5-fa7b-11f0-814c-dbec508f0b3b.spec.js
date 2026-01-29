import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122dacb5-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object encapsulating interactions with the application
class InterpreterApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#input1');
    this.submit = page.locator('#submit');
    this.outputPre = page.locator('#output1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillInput(text) {
    await this.input.fill(text);
  }

  async clickSubmit() {
    await this.submit.click();
  }

  async getOutputText() {
    return (await this.outputPre.innerText()).trim();
  }

  async isSubmitDisabled() {
    return await this.submit.isDisabled();
  }

  async getSubmitText() {
    return (await this.submit.textContent()).trim();
  }

  async inputPlaceholder() {
    return await this.input.getAttribute('placeholder');
  }

  async elementExists(selector) {
    return await this.page.locator(selector).count().then(c => c > 0);
  }
}

test.describe('Interpreter App FSM tests (Application ID: 122dacb5-fa7b-11f0-814c-dbec508f0b3b)', () => {
  // Containers for console messages and page errors captured during each test
  /** @type {Array<import('@playwright/test').ConsoleMessage>} */
  let consoleMessages;
  /** @type {Array<Error>} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages to inspect logs and errors originating from the page
    page.on('console', msg => {
      consoleMessages.push(msg);
    });

    // Capture runtime errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown globally; individual tests verify no unexpected errors occurred by asserting pageErrors length
  });

  test('Initial Idle state renders input, submit button and empty output (S0_Idle)', async ({ page }) => {
    // Validates the Idle state: presence of input, submit button and empty output area
    const app = new InterpreterApp(page);
    await app.goto();

    // Ensure basic DOM elements exist
    expect(await app.elementExists('#input1')).toBe(true);
    expect(await app.elementExists('#submit')).toBe(true);
    expect(await app.elementExists('#output1')).toBe(true);

    // Validate placeholder text for the input (evidence from FSM)
    expect(await app.inputPlaceholder()).toBe('Enter a string');

    // Output should be empty initially in Idle state
    const outputText = await app.getOutputText();
    expect(outputText).toBe('');

    // Submit button should be enabled by default
    expect(await app.isSubmitDisabled()).toBe(false);

    // No runtime page errors should have occurred during initial load
    expect(pageErrors.length, `Expected no page errors on load. Collected: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
  });

  test('Overlong input (>100 chars) transitions to Input Too Long (S1_InputTooLong)', async ({ page }) => {
    // This test validates the error state when the input length exceeds 100 characters
    const app = new InterpreterApp(page);
    await app.goto();

    // Create a string of length 101 to trigger the "Input too long" branch
    const longInput = 'a'.repeat(101);
    await app.fillInput(longInput);

    // Click submit to trigger the validation
    await app.clickSubmit();

    // The application should display the specific error message
    const expectedErr = 'Input too long. Please enter a string less than 100 characters.';
    const actualOutput = await app.getOutputText();
    expect(actualOutput).toBe(expectedErr);

    // The submit button should remain enabled (implementation sets disabled = false in other branch,
    // but for the error branch it simply returns; check that no unexpected disabling occurred)
    expect(await app.isSubmitDisabled()).toBe(false);

    // Ensure no runtime page errors occurred while handling the overlong input
    expect(pageErrors.length, `Expected no page errors when handling overlong input. Collected: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
  });

  test('Input of exactly 100 chars is accepted and transitions to Submitted (S2_Submitted entry actions)', async ({ page }) => {
    // Verifies accepted input path: for valid inputs, the code clears output and sets submit button text & enabled state
    const app = new InterpreterApp(page);
    await app.goto();

    const validInput = 'b'.repeat(100); // exactly 100 characters (boundary)
    await app.fillInput(validInput);
    await app.clickSubmit();

    // According to the implementation, on valid input output1.innerText should be set to ""
    const outputAfterSubmit = await app.getOutputText();
    expect(outputAfterSubmit).toBe('');

    // submitButton.disabled should be false (explicitly set in code)
    expect(await app.isSubmitDisabled()).toBe(false);

    // submitButton.textContent should remain "Submit" per implementation
    expect(await app.getSubmitText()).toBe('Submit');

    // Since the application sets up an interval that only switches the UI after 101 seconds, we do NOT expect the final message yet
    // Ensure that it does NOT show the 100-iteration completed message immediately
    const finalMsg = 'You have submitted the input for 100 iterations. Please try again.';
    expect(outputAfterSubmit).not.toBe(finalMsg);

    // No runtime errors expected during normal submission
    expect(pageErrors.length, `Expected no page errors on valid submit. Collected: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
  });

  test('Empty input is accepted (edge case) and behaves like Submitted state', async ({ page }) => {
    // Edge case: empty input should be treated as valid (length 0 <= 100)
    const app = new InterpreterApp(page);
    await app.goto();

    await app.fillInput(''); // empty string
    await app.clickSubmit();

    // Behavior should mirror valid submission: output cleared, button enabled and text "Submit"
    expect(await app.getOutputText()).toBe('');
    expect(await app.isSubmitDisabled()).toBe(false);
    expect(await app.getSubmitText()).toBe('Submit');

    // Ensure no page errors occurred
    expect(pageErrors.length, `Expected no page errors for empty input. Collected: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
  });

  test('Multiple rapid submits do not immediately produce the 100-iteration message and do not create visible runtime errors', async ({ page }) => {
    // This test clicks submit multiple times to exercise creation of multiple intervals.
    // We do not attempt to clear or modify intervals; we only assert immediate behavior and absence of errors.
    const app = new InterpreterApp(page);
    await app.goto();

    const sample = 'quick';
    await app.fillInput(sample);

    // Rapidly click submit several times
    await app.clickSubmit();
    await app.clickSubmit();
    await app.clickSubmit();

    // Immediately after rapid clicks, the output should still be empty (final message only appears after >100 seconds)
    const outputNow = await app.getOutputText();
    expect(outputNow).toBe('');

    // And the submit button should remain enabled and show "Submit"
    expect(await app.isSubmitDisabled()).toBe(false);
    expect(await app.getSubmitText()).toBe('Submit');

    // Wait a short moment to ensure no synchronous runtime errors are thrown as a result of multiple submits
    await page.waitForTimeout(200);

    // Inspect collected console messages for any error-level logs
    const consoleErrorMessages = consoleMessages.filter(m => m.type() === 'error').map(m => m.text());
    expect(consoleErrorMessages.length, `Expected no console.error messages after rapid submits. Found: ${consoleErrorMessages.join('; ')}`).toBe(0);

    // Ensure no captured page errors
    expect(pageErrors.length, `Expected no page errors after rapid submits. Collected: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
  });

  test('Implementation details diverge from FSM: immediate S2->S0 clear behavior not observable; verify lack of immediate finalization', async ({ page }) => {
    // The FSM describes a transition from Submitted back to Idle (clearing intervals and showing final message),
    // but the actual implementation uses a locally scoped intervalId such that immediate clearing via another click is not possible.
    // This test asserts that clicking submit again does not immediately produce the "You have submitted..." message.
    const app = new InterpreterApp(page);
    await app.goto();

    await app.fillInput('edgecase');
    await app.clickSubmit();

    // Immediately click again to attempt to trigger the FSM-described transition
    await app.clickSubmit();

    // Immediately after these clicks, we should NOT see the 100-iterations message (would take >100 seconds)
    const immediateOutput = await app.getOutputText();
    const expectedFinalMsg = 'You have submitted the input for 100 iterations. Please try again.';
    expect(immediateOutput === expectedFinalMsg).toBe(false);

    // No runtime errors should have been produced by these interactions
    expect(pageErrors.length, `Expected no page errors during repeated click scenario. Collected: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
  });

  test('No unexpected runtime errors or exceptions were emitted during test interactions (sanity check)', async ({ page }) => {
    // This test explicitly ensures that no ReferenceError, SyntaxError, TypeError, or other page errors occurred
    // across a simple load and basic interaction sequence.
    const app = new InterpreterApp(page);
    await app.goto();

    // perform a few benign interactions
    await app.fillInput('sanity');
    await app.clickSubmit();
    await page.waitForTimeout(50);

    // Assert no page errors captured
    if (pageErrors.length > 0) {
      // If errors exist, fail the test with collected messages for easier debugging
      const msgs = pageErrors.map(e => `${e.name}: ${e.message}`).join(' | ');
      throw new Error(`Unexpected page errors detected: ${msgs}`);
    }

    // Also assert there are no console.error messages
    const consoleErrorMessages = consoleMessages.filter(m => m.type() === 'error');
    expect(consoleErrorMessages.length, `Expected no console.error messages in sanity check. Found: ${consoleErrorMessages.map(m=>m.text()).join('; ')}`).toBe(0);
  });
});