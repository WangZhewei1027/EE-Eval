import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d0cc33-fa79-11f0-8075-e54a10595dde.html';

/**
 * Page Object for the Interactive Compiler Demo
 */
class CompilerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.source = page.locator('#source-code');
    this.compileButton = page.locator('#compile-button');
    this.resetButton = page.locator('#reset-button');
    this.options = page.locator('#options');
    this.output = page.locator('#output');
    this.errorLog = page.locator('#error-log');
    this.memoryUsage = page.locator('#memory-usage');
    this.memoryValue = page.locator('#memory-value');
    this.increaseMemory = page.locator('#increase-memory');
    this.decreaseMemory = page.locator('#decrease-memory');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getSource() {
    return this.source.inputValue();
  }

  async setSource(text) {
    await this.source.fill(text);
  }

  async clickCompile() {
    await this.compileButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async selectOptionByValue(value) {
    await this.options.selectOption({ value });
  }

  async getSelectedOptionValue() {
    return this.page.locator('#options').evaluate((el) => el.value);
  }

  async getOutputText() {
    return this.output.innerText();
  }

  async getErrorText() {
    return this.errorLog.innerText();
  }

  async setMemory(value) {
    // set underlying value and dispatch input event to trigger oninput handler
    await this.page.evaluate((v) => {
      const el = document.getElementById('memory-usage');
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  async getMemoryValue() {
    return this.memoryValue.innerText();
  }

  async clickIncreaseMemory() {
    await this.increaseMemory.click();
  }

  async clickDecreaseMemory() {
    await this.decreaseMemory.click();
  }

  async getMemoryInputValue() {
    return this.memoryUsage.evaluate((el) => el.value);
  }
}

test.describe('Interactive Compiler Demo - FSM validation (Application ID: 99d0cc33-fa79-11f0-8075-e54a10595dde)', () => {
  // Containers for console and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset trackers
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors
    page.on('console', (msg) => {
      // store with type for easier assertions later
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // store the Error object / message
      pageErrors.push(err);
    });

    // Navigate to the app under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Small sanity: ensure the page is still reachable
    // (This doesn't modify the app or environment.)
    await expect(page).toHaveURL(APP_URL);
  });

  test('Initial Idle State (S0_Idle): UI elements render and initial values are correct', async ({ page }) => {
    // This test validates the initial Idle state rendering.
    const app = new CompilerPage(page);

    // Elements exist and default values as per FSM/HTML
    await expect(app.source).toBeVisible();
    await expect(app.compileButton).toBeVisible();
    await expect(app.resetButton).toBeVisible();
    await expect(app.options).toBeVisible();
    await expect(app.output).toBeVisible();
    await expect(app.errorLog).toBeVisible();
    await expect(app.memoryUsage).toBeVisible();
    await expect(app.memoryValue).toBeVisible();

    // Initial contents
    expect(await app.getSource()).toBe('');
    expect(await app.getOutputText()).toBe('');
    expect(await app.getErrorText()).toBe('');
    expect(await app.getSelectedOptionValue()).toBe('none');
    expect(await app.getMemoryValue()).toBe('0');
    expect(await app.getMemoryInputValue()).toBe('0');

    // Observe console and page errors: expect none on initial load
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Compile Success Transition (S0_Idle -> S1_Compiled): compiling non-empty source produces output', async ({ page }) => {
    // This test verifies the Compile event when source is non-empty leads to the Compiled state.
    const app = new CompilerPage(page);

    const sourceText = 'int main() { return 0; }';
    await app.setSource(sourceText);

    // choose an optimization level to include in the output evidence
    await app.selectOptionByValue('advanced');

    await app.clickCompile();

    const output = await app.getOutputText();
    const error = await app.getErrorText();

    // Expected output matches FSM action
    const expectedOutput = `Compiled Code:\n${sourceText}\nOptimization Level: advanced`;
    expect(output).toBe(expectedOutput);

    // No errors should be displayed in the error log for successful compile
    expect(error).toBe('');

    // No runtime console errors or page errors should have occurred during this transition
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Compile Error Transition (S0_Idle -> S2_Error): compiling empty source shows error message', async ({ page }) => {
    // This test covers the error scenario when attempting to compile an empty source.
    const app = new CompilerPage(page);

    // Ensure source is empty
    await app.setSource('');

    // Sanity: option selection should not matter
    await app.selectOptionByValue('basic');

    await app.clickCompile();

    const output = await app.getOutputText();
    const error = await app.getErrorText();

    // Per FSM, compiling empty source yields the error string and output remains empty
    expect(error).toBe('Error: Source code is empty.');
    expect(output).toBe('');

    // No JS runtime errors expected; verify console and page errors arrays
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Reset from Compiled (S1_Compiled -> S0_Idle): reset clears fields and resets options', async ({ page }) => {
    // This test ensures Reset works correctly when coming from Compiled state.
    const app = new CompilerPage(page);

    // Move to compiled state by compiling valid source
    await app.setSource('print("hello world")');
    await app.selectOptionByValue('advanced');
    await app.clickCompile();

    // Ensure we are in compiled state (output present)
    expect((await app.getOutputText()).length).toBeGreaterThan(0);

    // Now click reset
    await app.clickReset();

    // Fields should be cleared and options reset per FSM exit actions
    expect(await app.getSource()).toBe('');
    expect(await app.getOutputText()).toBe('');
    expect(await app.getErrorText()).toBe('');
    expect(await app.getSelectedOptionValue()).toBe('none');

    // No JS runtime errors should have occurred
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Reset from Error (S2_Error -> S0_Idle): reset clears fields after error', async ({ page }) => {
    // This test ensures Reset works when recovering from an error state.
    const app = new CompilerPage(page);

    // Trigger error by compiling empty source
    await app.setSource('');
    await app.clickCompile();

    // Confirm error state
    expect(await app.getErrorText()).toBe('Error: Source code is empty.');

    // Click reset to go back to Idle
    await app.clickReset();

    expect(await app.getSource()).toBe('');
    expect(await app.getOutputText()).toBe('');
    expect(await app.getErrorText()).toBe('');
    expect(await app.getSelectedOptionValue()).toBe('none');

    // No runtime errors expected
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('MemoryChange event: adjusting range input updates displayed memory value (S0_Idle -> S0_Idle)', async ({ page }) => {
    // This test validates that manipulating the memory range control updates memory-value.
    const app = new CompilerPage(page);

    // Change memory to a mid-range value and assert memory-value updates
    await app.setMemory(42);
    expect(await app.getMemoryValue()).toBe('42');
    expect(await app.getMemoryInputValue()).toBe('42');

    // Change memory to another value
    await app.setMemory(99);
    expect(await app.getMemoryValue()).toBe('99');
    expect(await app.getMemoryInputValue()).toBe('99');

    // Observe no runtime console errors or page errors
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('IncreaseMemory and DecreaseMemory events: buttons modify memory and respect bounds', async ({ page }) => {
    // This test checks increase/decrease behavior and boundary conditions (0..100).
    const app = new CompilerPage(page);

    // Start from known state 0
    await app.setMemory(0);
    expect(await app.getMemoryValue()).toBe('0');

    // Decrease at 0 should keep at 0
    await app.clickDecreaseMemory();
    expect(await app.getMemoryValue()).toBe('0');
    expect(await app.getMemoryInputValue()).toBe('0');

    // Increase should increment
    await app.clickIncreaseMemory();
    expect(await app.getMemoryValue()).toBe('1');
    expect(await app.getMemoryInputValue()).toBe('1');

    // Set memory to 100 and attempt to increase (should remain 100)
    await app.setMemory(100);
    expect(await app.getMemoryValue()).toBe('100');
    await app.clickIncreaseMemory();
    expect(await app.getMemoryValue()).toBe('100');
    expect(await app.getMemoryInputValue()).toBe('100');

    // Decrease from 100 should decrement
    await app.clickDecreaseMemory();
    expect(await app.getMemoryValue()).toBe('99');
    expect(await app.getMemoryInputValue()).toBe('99');

    // Final check: no runtime errors occurred during memory adjustments
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: rapid memory changes and repeated compile/reset cycles do not produce runtime errors', async ({ page }) => {
    // This test performs a sequence of interactions to exercise multiple transitions quickly.
    const app = new CompilerPage(page);

    // Rapidly change memory via the setMemory helper multiple times
    for (const v of [0, 10, 20, 50, 75, 100, 50, 25, 0]) {
      await app.setMemory(v);
      expect(await app.getMemoryValue()).toBe(String(v));
    }

    // Repeated compile/reset cycles including empty and non-empty source
    await app.setSource('');
    await app.clickCompile();
    expect(await app.getErrorText()).toBe('Error: Source code is empty.');

    await app.clickReset();
    expect(await app.getErrorText()).toBe('');
    expect(await app.getSource()).toBe('');

    await app.setSource('let x = 1;');
    await app.selectOptionByValue('basic');
    await app.clickCompile();
    expect((await app.getOutputText()).includes('let x = 1;')).toBe(true);

    await app.clickReset();
    expect(await app.getOutputText()).toBe('');
    expect(await app.getErrorText()).toBe('');

    // Ensure no runtime console errors or page errors were logged during this stress sequence
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});