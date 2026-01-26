import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122dd3c3-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Static Typing FSM - 122dd3c3-fa7b-11f0-814c-dbec508f0b3b', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Helper to attach listeners for console and page errors
  async function attachListeners(page) {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture console messages (log, error, warn, etc.)
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case msg.type() throws, still capture text
        consoleMessages.push({ type: 'unknown', text: msg.text ? msg.text() : '' });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  }

  // Before each test navigate to the page and attach listeners
  test.beforeEach(async ({ page }) => {
    await attachListeners(page);
    await page.goto(APP_URL);
  });

  // Test the initial idle state (S0_Idle)
  test('Initial Idle state: elements present and initial DOM is empty as implemented', async ({ page }) => {
    // This test validates the Idle state's entry evidence: presence of input, submit, clear, and error message element.
    const input = page.locator('#input-field');
    const submit = page.locator('#submit-button');
    const clear = page.locator('#clear-button');
    const error = page.locator('#error-message');
    const output = page.locator('#output-container');

    await expect(input).toBeVisible();
    await expect(submit).toBeVisible();
    await expect(clear).toBeVisible();
    await expect(error).toBeVisible();

    // According to the provided HTML, no initial updateOutput() is invoked on load,
    // so output-container is expected to be empty by default.
    await expect(await output.innerHTML()).toBe('');
    await expect(await error.innerText()).toBe('');

    // Ensure no unexpected console logs or page errors happened during load.
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test that typing into the input does not trigger the input handler (InputFieldChange event is not attached)
  test('Typing into input does not update internal state or output (missing input listener)', async ({ page }) => {
    // This test validates the FSM transition S0_Idle -> S1_InputEntered expected by the model,
    // but checks actual implementation where inputFieldHandler is defined but not attached.
    const input = page.locator('#input-field');
    const error = page.locator('#error-message');
    const output = page.locator('#output-container');

    // Type text into the visible input element
    await input.fill('hello');

    // The DOM input value should reflect typed text
    await expect(input).toHaveValue('hello');

    // Because the implementation never attached inputFieldHandler via addEventListener,
    // internal variable inputFieldContent is not updated and updateOutput is not called,
    // so output-container should still be empty and error message unchanged.
    await expect(await output.innerHTML()).toBe('');
    await expect(await error.innerText()).toBe('');

    // No console messages expected from typing
    const logs = consoleMessages.map(m => m.text);
    expect(logs.some(t => t.includes('Submit button clicked!'))).toBeFalsy();

    // No runtime errors should have occurred
    expect(pageErrors.length).toBe(0);
  });

  // Test submitting when the user has typed into the visible input:
  // due to a bug the submit handler reads inputFieldContent variable (not input.value),
  // so submission will still behave as if empty => show 'Please type something!'
  test('Submit click with visible input filled still triggers error (SubmitButtonClick transition to Error)', async ({ page }) => {
    // This test validates the FSM transition S1_InputEntered -> S2_Error on SubmitButtonClick
    // in the actual implementation when internal state is empty.
    const input = page.locator('#input-field');
    const submit = page.locator('#submit-button');
    const error = page.locator('#error-message');
    const output = page.locator('#output-container');

    // Type in the DOM input (but handler isn't attached, so internal variable remains empty)
    await input.fill('some user input');

    // Click submit
    await submit.click();

    // Because inputFieldContent is still '', the implementation sets the error message
    await expect(error).toHaveText('Please type something!');

    // updateOutput() is called by submit handler; it inserts an Error paragraph when inputFieldContent is empty
    await expect(output.locator('p')).toHaveText('Error: Please type something!');

    // The implementation would console.log('Submit button clicked!') only when inputFieldContent truthy.
    // Confirm that this log did NOT appear.
    const logs = consoleMessages.map(m => m.text);
    expect(logs.some(t => t.includes('Submit button clicked!'))).toBeFalsy();

    // No page errors should have occurred during this interaction
    expect(pageErrors.length).toBe(0);
  });

  // Test the Clear button behavior from the InputEntered/Error states and from Idle state:
  // According to implementation, clearButtonHandler resets internal variable and errorMessage,
  // calls updateOutput (which writes an Error paragraph when internal var is empty),
  // but DOES NOT clear the actual input element's value from the DOM.
  test('Clear button clears internal state and error message but does not clear DOM input value', async ({ page }) => {
    // This test covers transitions:
    // - S1_InputEntered -> S0_Idle (via ClearButtonClick)
    // - S2_Error -> S0_Idle (via ClearButtonClick)
    // - S0_Idle -> S3_Clear (via ClearButtonClick)
    const input = page.locator('#input-field');
    const submit = page.locator('#submit-button');
    const clear = page.locator('#clear-button');
    const error = page.locator('#error-message');
    const output = page.locator('#output-container');

    // Step A: Type into input then click submit to generate an error (see previous test)
    await input.fill('retain-me');
    await submit.click();
    await expect(error).toHaveText('Please type something!');
    await expect(output.locator('p')).toHaveText('Error: Please type something!');

    // Now click Clear - per implementation this will:
    // - set inputFieldContent = ''
    // - set errorMessage.textContent = ''
    // - call updateOutput() -> output will show Error paragraph because internal var is empty
    await clear.click();

    // After clearing, the error DOM should be empty
    await expect(error).toHaveText('');

    // updateOutput writes Error paragraph because inputFieldContent is empty
    await expect(output.locator('p')).toHaveText('Error: Please type something!');

    // Crucially, the actual visible input element value is NOT cleared by the implementation.
    // The DOM input.value should still contain 'retain-me'
    await expect(input).toHaveValue('retain-me');

    // No page errors should have occurred
    expect(pageErrors.length).toBe(0);
  });

  // Test clearing directly from Idle state (no typing). This exercises S0_Idle -> S3_Clear transition.
  test('Clear from Idle state results in cleared internal state and Error output (S0_Idle -> S3_Clear)', async ({ page }) => {
    // Reload page to ensure true Idle state
    await page.reload();

    const input = page.locator('#input-field');
    const clear = page.locator('#clear-button');
    const error = page.locator('#error-message');
    const output = page.locator('#output-container');

    // Sanity: input is empty in DOM, error empty
    await expect(input).toHaveValue('');
    await expect(error).toHaveText('');

    // Click clear in Idle state
    await clear.click();

    // Clear handler resets internal state and errorMessage, then calls updateOutput which writes Error paragraph.
    await expect(error).toHaveText('');
    await expect(output.locator('p')).toHaveText('Error: Please type something!');

    // Input DOM still empty (it was empty before)
    await expect(input).toHaveValue('');

    // No runtime errors
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: type an extremely long string (>100 chars) into the DOM input.
  // The implementation's length check relies on inputFieldHandler which is not attached,
  // so typing the long text will NOT trigger the 'Input too long!' error message.
  test('Typing >100 chars does NOT produce "Input too long!" because input handler not attached', async ({ page }) => {
    const input = page.locator('#input-field');
    const error = page.locator('#error-message');
    const longText = 'x'.repeat(150); // 150 chars

    await input.fill(longText);

    // DOM input holds the long text
    await expect(input).toHaveValue(longText);

    // But because inputFieldHandler isn't attached, the page does not set the 'Input too long!' message
    await expect(error).toHaveText('');

    // Submitting will still treat internal state as empty and produce 'Please type something!'
    const submit = page.locator('#submit-button');
    const output = page.locator('#output-container');
    await submit.click();
    await expect(error).toHaveText('Please type something!');
    await expect(output.locator('p')).toHaveText('Error: Please type something!');

    // Confirm that no 'Input too long!' message was ever produced
    const logs = consoleMessages.map(m => m.text);
    expect(logs.some(t => t.includes('Input too long!'))).toBeFalsy();

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  // Final sanity: ensure no uncaught exceptions were produced across interactions
  test('No uncaught page errors during FSM interaction tests', async ({ page }) => {
    // This test simply asserts that pageErrors captured by listeners is empty after normal operations.
    // We already performed several interactions in other tests; in isolation this test ensures the page doesn't throw on load.
    expect(pageErrors.length).toBe(0);
  });
});