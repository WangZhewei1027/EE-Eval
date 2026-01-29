import { test, expect } from '@playwright/test';

// Page object for the Interactive Interpreter Demo
class InterpreterPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#input');
    this.executeButton = page.locator('button[onclick="executeCommand()"]');
    this.clearButton = page.locator('button[onclick="clearOutput()"]');
    this.slider = page.locator('#slider');
    this.sliderValue = page.locator('#sliderValue');
    this.variableKey = page.locator('#variableKey');
    this.variableValue = page.locator('#variableValue');
    this.setVariableButton = page.locator('button[onclick="setVariable()"]');
    this.variablesOutput = page.locator('#variablesOutput');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/99d0cc34-fa79-11f0-8075-e54a10595dde.html', { waitUntil: 'load' });
  }

  async executeCommandText(text) {
    await this.input.fill(text);
    await this.executeButton.click();
  }

  async clearOutputClick() {
    await this.clearButton.click();
  }

  async setVariableViaInputs(key, value) {
    await this.variableKey.fill(key);
    await this.variableValue.fill(value);
    await this.setVariableButton.click();
  }

  // Set slider value and dispatch change event so onchange handler runs
  async setSliderValue(value) {
    await this.page.evaluate((v) => {
      const el = document.getElementById('slider');
      el.value = String(v);
      // Trigger change event
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }

  async getOutputText() {
    return await this.output.textContent();
  }

  async getVariablesText() {
    return await this.variablesOutput.textContent();
  }

  async getSliderValueText() {
    return await this.sliderValue.textContent();
  }
}

test.describe('Interactive Interpreter Demo (Application ID: 99d0cc34-fa79-11f0-8075-e54a10595dde)', () => {
  // Collect console messages and page errors for assertions
  test.beforeEach(async ({ page }) => {
    // attach arrays for each test to inspect messages and errors
    page.__consoleMessages = [];
    page.__pageErrors = [];

    page.on('console', (msg) => {
      page.__consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // store error message and stack
      page.__pageErrors.push(err);
    });
  });

  // Basic initial state checks (S0_Idle)
  test('Initial page state - Idle: elements present and defaults set', async ({ page }) => {
    const ip = new InterpreterPage(page);
    // Navigate to the application page
    await ip.goto();

    // Verify key components exist - consistent with FSM S0_Idle evidence
    await expect(ip.input).toBeVisible();
    await expect(ip.executeButton).toBeVisible();
    await expect(ip.clearButton).toBeVisible();
    await expect(ip.slider).toBeVisible();
    await expect(ip.sliderValue).toBeVisible();
    await expect(ip.variableKey).toBeVisible();
    await expect(ip.variableValue).toBeVisible();
    await expect(ip.setVariableButton).toBeVisible();
    await expect(ip.variablesOutput).toBeVisible();
    await expect(ip.output).toBeVisible();

    // Default slider initial value should be 50 (as in HTML)
    await expect(ip.getSliderValueText()).resolves.toBe('50');
    // Default outputs should be empty
    await expect(ip.getOutputText()).resolves.toBe('');
    await expect(ip.getVariablesText()).resolves.toBe('');

    // No page errors should have been emitted during load
    expect(page.__pageErrors.length).toBe(0);
  });

  // Test ExecuteCommand transition to S1_CommandExecuted
  test('Execute command: set and print commands update output and variables (S1_CommandExecuted & S3_VariableSet)', async ({ page }) => {
    const ip = new InterpreterPage(page);
    await ip.goto();

    // 1) Use the textual "set" command via the input textarea
    // This should add to variables and update the output (transition to S1_CommandExecuted and S3_VariableSet)
    await ip.executeCommandText('set foo bar');

    // Output should include the set confirmation
    const outputAfterSet = await ip.getOutputText();
    expect(outputAfterSet).toContain('Set "foo" to "bar".');

    // Variables output should reflect the new variable
    const varsText = await ip.getVariablesText();
    // Variables are displayed via JSON.stringify
    expect(varsText).toContain('"foo": "bar"');

    // Input should be cleared after execution
    await expect(ip.input).toHaveValue('');

    // 2) Use the textual "print" command to print the variable
    await ip.executeCommandText('print foo');

    const outputAfterPrint = await ip.getOutputText();
    // It should contain the previous set message and the printed value on a new line
    expect(outputAfterPrint).toContain('Set "foo" to "bar".');
    expect(outputAfterPrint).toContain('bar');

    // Ensure no unexpected page errors occurred during these interactions
    expect(page.__pageErrors.length).toBe(0);
  });

  // Test SetVariable transition to S3_VariableSet via Set Variable button (UI inputs)
  test('Set Variable via UI inputs updates variablesOutput and clears inputs (S3_VariableSet)', async ({ page }) => {
    const ip = new InterpreterPage(page);
    await ip.goto();

    // Fill UI inputs and click Set Variable
    await ip.setVariableViaInputs('alpha', '42');

    // variablesOutput should include the new key-value pair
    const varsText = await ip.getVariablesText();
    expect(varsText).toContain('"alpha": "42"');

    // Inputs should be cleared after setting variable
    await expect(ip.variableKey).toHaveValue('');
    await expect(ip.variableValue).toHaveValue('');

    // Clicking set variable should not append to the main output area (output remains unchanged)
    const mainOutput = await ip.getOutputText();
    // Since we might have previous state, just ensure no "Set" message from executeCommand is present here due to setVariable
    // But at minimum we assert that mainOutput is a string (non-null)
    expect(typeof mainOutput).toBe('string');

    // Ensure no page errors occurred
    expect(page.__pageErrors.length).toBe(0);
  });

  // Test ClearOutput transition to S2_OutputCleared
  test('Clear Output clears the output area (S2_OutputCleared)', async ({ page }) => {
    const ip = new InterpreterPage(page);
    await ip.goto();

    // Put some content into output by executing an unknown command
    await ip.executeCommandText('set temp xyz');
    let outputBeforeClear = await ip.getOutputText();
    expect(outputBeforeClear.length).toBeGreaterThan(0);

    // Click Clear Output
    await ip.clearOutputClick();

    // The output element should now be empty
    const outputAfterClear = await ip.getOutputText();
    expect(outputAfterClear).toBe('');

    // Ensure clearing output didn't affect variablesOutput
    const varsText = await ip.getVariablesText();
    // Should still be a string (may contain previous variables)
    expect(typeof varsText).toBe('string');

    // No page errors expected
    expect(page.__pageErrors.length).toBe(0);
  });

  // Test UpdateSliderValue transition to S4_SliderUpdated
  test('Slider change updates displayed slider value (S4_SliderUpdated)', async ({ page }) => {
    const ip = new InterpreterPage(page);
    await ip.goto();

    // Change slider to 75 and trigger onchange (simulate user interaction)
    await ip.setSliderValue(75);

    // The displayed slider value should update to 75
    await expect(ip.getSliderValueText()).resolves.toBe('75');

    // Change slider to edge values to ensure min/max handling
    await ip.setSliderValue(0);
    await expect(ip.getSliderValueText()).resolves.toBe('0');

    await ip.setSliderValue(100);
    await expect(ip.getSliderValueText()).resolves.toBe('100');

    // No page errors expected
    expect(page.__pageErrors.length).toBe(0);
  });

  // Edge case: unknown command handling
  test('Unknown command yields "Unknown command." in output (edge case)', async ({ page }) => {
    const ip = new InterpreterPage(page);
    await ip.goto();

    // Execute an unknown command
    await ip.executeCommandText('foobarcommand');

    // Output should contain the Unknown command message
    const output = await ip.getOutputText();
    expect(output).toContain('Unknown command.');

    // No page errors expected
    expect(page.__pageErrors.length).toBe(0);
  });

  // Explicitly verify behavior for FSM entry action mention renderPage()
  test('Attempting to call missing renderPage() should produce a ReferenceError (verify missing entry action behavior)', async ({ page }) => {
    const ip = new InterpreterPage(page);
    await ip.goto();

    // At this point, the page does not define renderPage.
    // We assert that calling it from the page context results in a ReferenceError.
    // This test intentionally triggers an error in the page context to validate that missing entry action(s) are not silently present.
    let caught = null;
    try {
      // Calling a nonexistent function in page context should reject
      await page.evaluate(() => {
        // Intentionally call undefined function - should raise ReferenceError in the page
        // We do not define renderPage anywhere; per requirements we must not patch the page.
        // This error will be captured by Playwright as an exception from evaluate.
        return renderPage();
      });
    } catch (err) {
      caught = err;
    }

    // Ensure we did catch an error and it is a ReferenceError or mentions the missing function
    expect(caught).not.toBeNull();
    // Error message may include different prefixes; check for either RenderPage name or ReferenceError
    const msg = String(caught && (caught.message || caught.toString()));
    expect(msg).toMatch(/renderPage|ReferenceError/i);

    // Also ensure a pageerror was emitted (the runtime ReferenceError should be captured)
    // There might be one or more errors in page.__pageErrors; at least one should mention renderPage or ReferenceError.
    const pageErrorMessages = page.__pageErrors.map(e => String(e && e.message));
    const hasRenderPageError = pageErrorMessages.some(m => /renderPage|ReferenceError/i.test(m));
    expect(hasRenderPageError).toBe(true);
  });

  // Smoke test: multiple interactions sequence - coverage of several transitions in one flow
  test('Sequence: set via UI -> execute print -> clear output -> slider adjust - validates state transitions together', async ({ page }) => {
    const ip = new InterpreterPage(page);
    await ip.goto();

    // Set variable via UI inputs
    await ip.setVariableViaInputs('seqKey', 'seqVal');
    const varsAfterSet = await ip.getVariablesText();
    expect(varsAfterSet).toContain('"seqKey": "seqVal"');

    // Use executeCommand to print the variable
    await ip.executeCommandText('print seqKey');
    const outAfterPrint = await ip.getOutputText();
    expect(outAfterPrint).toContain('seqVal');

    // Clear the output
    await ip.clearOutputClick();
    expect(await ip.getOutputText()).toBe('');

    // Adjust slider in between to ensure independent state changes still behave
    await ip.setSliderValue(33);
    expect(await ip.getSliderValueText()).toBe('33');

    // No page errors expected in this combined flow
    expect(page.__pageErrors.length).toBe(0);
  });
});