import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d7b461a1-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object Model for the Recursion Demo page
class RecursionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#numberInput');
    this.calcBtn = page.locator('#calcBtn');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getInputValue() {
    // Returns the string value attribute of the input
    return await this.input.inputValue();
  }

  async setInputValue(value) {
    // Clear and type the value as a string (works for numbers and empty string)
    await this.input.fill(String(value));
  }

  async clickCalculate() {
    await this.calcBtn.click();
  }

  async getResultText() {
    return await this.result.textContent();
  }

  async isInputPresent() {
    return await this.input.isVisible();
  }

  async isButtonPresent() {
    return await this.calcBtn.isVisible();
  }

  async resultHasLineStartingWith(prefix) {
    const txt = await this.getResultText();
    if (!txt) return false;
    return txt.split('\n').some(line => line.trim().startsWith(prefix));
  }

  async getResultLines() {
    const txt = await this.getResultText();
    if (!txt) return [];
    return txt.split('\n');
  }

  async getResultComputedBackground() {
    return await this.result.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
  }
}

test.describe('Recursion Demonstration: Factorial Calculator (FSM validation)', () => {
  // Capture console messages and page errors for each test to assert runtime health
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events
    page.on('console', (msg) => {
      // collect console messages with their type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen to uncaught exceptions in the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // nothing global to teardown beyond the built-in fixture lifecycle
  });

  test('S0_Idle: initial render shows input, button and empty result (entry action renderPage implied)', async ({ page }) => {
    // This test validates the Idle initial state: presence of components and default values.
    const app = new RecursionPage(page);
    await app.goto();

    // Verify input and button are present
    expect(await app.isInputPresent(), 'number input should be visible').toBe(true);
    expect(await app.isButtonPresent(), 'calculate button should be visible').toBe(true);

    // Default input value as per HTML implementation should be "5"
    const inputValue = await app.getInputValue();
    expect(inputValue).toBe('5');

    // Result div should be initially empty
    const resultText = (await app.getResultText()) || '';
    expect(resultText.trim()).toBe('');

    // Visual check: result element has the expected background color as defined in CSS (#eef6fb)
    const bg = await app.getResultComputedBackground();
    // CSS rgb for #eef6fb is rgb(238, 246, 251) — assert that the computed background matches expected.
    expect(bg).toMatch(/rgb\(238,\s*246,\s*251\)/);

    // Ensure no runtime page errors or console errors occurred on initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length, 'no uncaught page errors expected on load').toBe(0);
    expect(consoleErrors.length, 'no console.error messages expected on load').toBe(0);
  });

  test('S3_Completed via S2_Calculating: calculate factorial for n=5 and verify call stack and final result', async ({ page }) => {
    // This test validates the transition Idle -> Calculating -> Completed when clicking Calculate Factorial.
    const app = new RecursionPage(page);
    await app.goto();

    // Ensure starting from default value 5
    expect(await app.getInputValue()).toBe('5');

    // Click calculate and wait for result to populate
    await Promise.all([
      page.waitForFunction(() => {
        const el = document.getElementById('result');
        return el && el.textContent && el.textContent.trim().length > 0;
      }),
      app.clickCalculate()
    ]);

    // Get result text and assert expected content
    const resultText = await app.getResultText();
    expect(resultText).toBeTruthy();

    // The first logged line for 5 should be "factorial(5) called"
    const lines = resultText.split('\n').map(l => l.replace(/\r/g, ''));
    expect(lines.some(l => l.trim() === 'factorial(5) called'), 'should contain initial call line for factorial(5)').toBe(true);

    // Should include base case lines for factorial(1) or factorial(0)
    expect(lines.some(l => l.includes('Base case reached') || l.trim().startsWith('Base case reached')), 'should include base case description').toBe(true);

    // Final line should include "Factorial(5) = 120"
    expect(resultText.includes('Factorial(5) = 120'), 'final line should report Factorial(5) = 120').toBe(true);

    // Validate that the call stack contains lines that show recursive calculation and result lines
    expect(lines.some(l => l.includes('Calculating factorial(5)')), 'should log the calculation expression for factorial(5)').toBe(true);
    expect(lines.some(l => l.includes('Result of factorial(5)')), 'should log the result for factorial(5)').toBe(true);

    // Validate no runtime uncaught page errors and no console errors during calculation
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length, 'no uncaught page errors expected during factorial computation').toBe(0);
    expect(consoleErrors.length, 'no console.error messages expected during factorial computation').toBe(0);
  });

  test('S3_Completed for edge case n=0: base case behavior and final result', async ({ page }) => {
    // Validate Idle -> Calculating -> Completed path for n=0 base case
    const app = new RecursionPage(page);
    await app.goto();

    await app.setInputValue('0');
    await Promise.all([
      page.waitForFunction(() => {
        const el = document.getElementById('result');
        return el && el.textContent && el.textContent.trim().length > 0;
      }),
      app.clickCalculate()
    ]);

    const result = await app.getResultText();
    expect(result).toBeTruthy();
    expect(result.includes('factorial(0) called')).toBe(true);
    expect(result.includes('Base case reached: factorial(0) = 1')).toBe(true);
    expect(result.includes('Factorial(0) = 1')).toBe(true);

    // Confirm no page errors or console.error
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_Error transitions: invalid inputs produce error message (negative, too large, non-number)', async ({ page }) => {
    // This test validates transitions from Idle -> Error for several invalid inputs as described in the FSM.
    const app = new RecursionPage(page);
    await app.goto();

    // Helper to assert error message shown
    const expectErrorMessage = async () => {
      await page.waitForFunction(() => {
        const el = document.getElementById('result');
        return el && el.textContent && el.textContent.includes('Please enter a valid non-negative integer (0 to 15).');
      });
      const txt = await app.getResultText();
      expect(txt).toBe('Please enter a valid non-negative integer (0 to 15).');
    };

    // Negative number
    await app.setInputValue('-1');
    await Promise.all([
      page.waitForFunction(() => {
        const el = document.getElementById('result');
        return el && el.textContent && el.textContent.length > 0;
      }),
      app.clickCalculate()
    ]);
    await expectErrorMessage();

    // Too large > 15
    await app.setInputValue('20');
    await Promise.all([
      page.waitForFunction(() => {
        const el = document.getElementById('result');
        return el && el.textContent && el.textContent.length > 0;
      }),
      app.clickCalculate()
    ]);
    await expectErrorMessage();

    // Non-number (empty input)
    await app.setInputValue('');
    await Promise.all([
      page.waitForFunction(() => {
        const el = document.getElementById('result');
        return el && el.textContent && el.textContent.length > 0;
      }),
      app.clickCalculate()
    ]);
    await expectErrorMessage();

    // Ensure no runtime uncaught page errors during error handling
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S2_Calculating evidence: resulting call stack begins with "factorial(n) called" for n=3', async ({ page }) => {
    // This test asserts the presence of the evidence line pushed when computation starts:
    // "callStack.push(`${indent}factorial(${n}) called`);"
    const app = new RecursionPage(page);
    await app.goto();

    await app.setInputValue('3');
    await Promise.all([
      page.waitForFunction(() => {
        const el = document.getElementById('result');
        return el && el.textContent && el.textContent.trim().length > 0;
      }),
      app.clickCalculate()
    ]);

    const lines = await app.getResultLines();
    // The very first non-empty line should indicate the initial call
    const firstNonEmpty = lines.find(l => l.trim().length > 0);
    expect(firstNonEmpty).toBeTruthy();
    expect(firstNonEmpty.trim()).toBe('factorial(3) called');

    // Confirm the stack includes recursive call entries for factorial(2) and factorial(1)
    expect(lines.some(l => l.trim() === 'factorial(2) called')).toBe(true);
    expect(lines.some(l => l.trim() === 'factorial(1) called')).toBe(true);

    // And final aggregate line
    expect(lines.some(l => l.includes('Factorial(3) = 6'))).toBe(true);

    // No page errors or console errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Runtime monitoring: capture console messages and page errors during interactions (should be none)', async ({ page }) => {
    // This test intentionally performs several interactions and asserts that no unexpected runtime errors occur.
    const app = new RecursionPage(page);
    await app.goto();

    // Do a few interactions
    await app.setInputValue('4');
    await app.clickCalculate();
    await page.waitForFunction(() => {
      const el = document.getElementById('result');
      return el && el.textContent && el.textContent.includes('Factorial(4)');
    });

    await app.setInputValue('0');
    await app.clickCalculate();
    await page.waitForFunction(() => {
      const el = document.getElementById('result');
      return el && el.textContent && el.textContent.includes('Factorial(0) = 1');
    });

    await app.setInputValue('20'); // invalid
    await app.clickCalculate();
    await page.waitForFunction(() => {
      const el = document.getElementById('result');
      return el && el.textContent && el.textContent.includes('Please enter a valid non-negative integer (0 to 15).');
    });

    // Now assert captured console and page error state
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    // We expect no uncaught page errors or console.error messages for the correct implementation.
    expect(pageErrors.length, 'no uncaught page errors expected across multiple interactions').toBe(0);
    expect(consoleErrors.length, 'no console.error messages expected across multiple interactions').toBe(0);
  });
});