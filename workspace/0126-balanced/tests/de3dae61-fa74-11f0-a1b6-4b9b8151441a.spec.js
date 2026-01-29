import { test, expect } from '@playwright/test';

// Test file: de3dae61-fa74-11f0-a1b6-4b9b8151441a.spec.js
// Application URL (served by the test environment)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3dae61-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object Model for the Interpreter demo page
class InterpreterPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.romanInput = page.locator('#romanInput');
    this.mathInput = page.locator('#mathInput');
    this.romanButton = page.locator('button[onclick="interpretRoman()"]');
    this.mathButton = page.locator('button[onclick="interpretMath()"]');
    this.romanResult = page.locator('#romanResult');
    this.mathResult = page.locator('#mathResult');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setRoman(value) {
    await this.romanInput.fill(value);
  }

  async clickInterpretRoman() {
    await this.romanButton.click();
  }

  async getRomanResultText() {
    return await this.romanResult.textContent();
  }

  async isRomanResultVisible() {
    // Check computed style display to determine visibility
    return await this.romanResult.evaluate((el) => {
      return window.getComputedStyle(el).display !== 'none';
    });
  }

  async getRomanResultBgColor() {
    return await this.romanResult.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
  }

  async setMath(value) {
    await this.mathInput.fill(value);
  }

  async clickInterpretMath() {
    await this.mathButton.click();
  }

  async getMathResultText() {
    return await this.mathResult.textContent();
  }

  async isMathResultVisible() {
    return await this.mathResult.evaluate((el) => {
      return window.getComputedStyle(el).display !== 'none';
    });
  }

  async getMathResultBgColor() {
    return await this.mathResult.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
  }
}

test.describe('Interpreter Pattern Demo - End-to-End', () => {
  // Arrays to collect console messages and page errors per test to observe runtime issues.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection (logs, warnings, errors)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture unhandled page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach console and page error summary to test output for debugging if test fails
    if (testInfo.status !== 'passed') {
      console.log('Captured console messages:', consoleMessages);
      console.log('Captured page errors:', pageErrors.map(e => e.message));
    }
  });

  test.describe('Initial rendering and S0_Idle state', () => {
    test('renders page and shows inputs, buttons, and hidden result areas (entry action: renderPage)', async ({ page }) => {
      // Validate that renderPage entry action effectively rendered the main UI elements
      const app = new InterpreterPage(page);
      await app.goto();

      // Header presence is evidence that renderPage ran
      await expect(app.header).toBeVisible();
      await expect(app.header).toHaveText('Interpreter Pattern Demo');

      // Inputs exist with expected placeholders (evidence components)
      await expect(app.romanInput).toBeVisible();
      await expect(app.romanInput).toHaveAttribute('placeholder', 'e.g., VII');
      await expect(app.mathInput).toBeVisible();
      await expect(app.mathInput).toHaveAttribute('placeholder', 'e.g., 5 + 3 - 2');

      // Buttons exist
      await expect(app.romanButton).toBeVisible();
      await expect(app.mathButton).toBeVisible();

      // Result areas present but initially hidden (S0_Idle expectation)
      expect(await app.isRomanResultVisible()).toBeFalsy();
      expect(await app.isMathResultVisible()).toBeFalsy();

      // Ensure no unhandled page errors occurred during initial render
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Roman numeral interpretation (S1_RomanInterpreted and edge cases)', () => {
    test('interprets a valid Roman numeral "VII" and displays correct result', async ({ page }) => {
      // This test validates the transition S0_Idle -> S1_RomanInterpreted via InterpretRoman
      const app1 = new InterpreterPage(page);
      await app.goto();

      // Fill and click interpret
      await app.setRoman('VII');
      await app.clickInterpretRoman();

      // Validate result visibility and text content per S1_RomanInterpreted evidence
      await expect(app.romanResult).toBeVisible();
      const text = (await app.getRomanResultText()).trim();
      expect(text).toBe('VII = 7');

      // Validate visual feedback: background color should correspond to success color (#e8f4f8 -> rgb(232,244,248))
      const bg = await app.getRomanResultBgColor();
      expect(bg).toBe('rgb(232, 244, 248)');

      // No unhandled errors expected
      expect(pageErrors.length).toBe(0);

      // Console may have logs; ensure no severe console errors were emitted
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('interpreting malformed Roman input results in NaN (edge case) and does not throw', async ({ page }) => {
      // The implementation will not throw for unknown Roman characters; it will likely produce NaN.
      // This validates the actual behavior and ensures the app transitions to S1_RomanInterpreted with NaN result.
      const app2 = new InterpreterPage(page);
      await app.goto();

      // Provide non-Roman characters
      await app.setRoman('ABC');
      await app.clickInterpretRoman();

      await expect(app.romanResult).toBeVisible();
      const text1 = (await app.getRomanResultText()).trim();
      // Expect the app to display the input and a NaN result rather than throwing an error
      expect(text).toBe('ABC = NaN');

      // Background should still be the success color as per implementation's try block
      const bg1 = await app.getRomanResultBgColor();
      expect(bg).toBe('rgb(232, 244, 248)');

      // Confirm no unhandled page errors were produced
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Math expression interpretation (S2_MathInterpreted and error transitions to S3_Error)', () => {
    test('interprets a valid math expression "5 + 3 - 2" correctly', async ({ page }) => {
      // This test validates the transition S0_Idle -> S2_MathInterpreted via InterpretMath
      const app3 = new InterpreterPage(page);
      await app.goto();

      await app.setMath('5 + 3 - 2');
      await app.clickInterpretMath();

      await expect(app.mathResult).toBeVisible();
      const text2 = (await app.getMathResultText()).trim();
      expect(text).toBe('5 + 3 - 2 = 6');

      // Validate success background color: #e8f4f8 -> rgb(232,244,248)
      const bg2 = await app.getMathResultBgColor();
      expect(bg).toBe('rgb(232, 244, 248)');

      expect(pageErrors.length).toBe(0);
      const consoleErrors1 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('empty math input triggers S3_Error with "Invalid expression" message', async ({ page }) => {
      // This test exercises the error path for math: S0_Idle -> S3_Error via InterpretMath (invalid expression)
      const app4 = new InterpreterPage(page);
      await app.goto();

      // Provide empty input (or whitespace)
      await app.setMath('   ');
      await app.clickInterpretMath();

      await expect(app.mathResult).toBeVisible();
      const text3 = (await app.getMathResultText()).trim();
      // The implementation throws 'Invalid expression' and displays it as "Error: Invalid expression"
      expect(text).toBe('Error: Invalid expression');

      // Error background color set in catch: #f8e8e8 -> rgb(248,232,232)
      const bg3 = await app.getMathResultBgColor();
      expect(bg).toBe('rgb(248, 232, 232)');

      // Ensure this is handled by the app (no unhandled page errors)
      expect(pageErrors.length).toBe(0);
    });

    test('math expression with unsupported operator produces error message (Unknown operator)', async ({ page }) => {
      // This test exercises S2_MathInterpreted -> S3_Error when an unknown operator is encountered
      const app5 = new InterpreterPage(page);
      await app.goto();

      // Using '*' will result in tokens that lead to "Unknown operator: 2" per implementation details
      await app.setMath('5 * 2');
      await app.clickInterpretMath();

      await expect(app.mathResult).toBeVisible();
      const text4 = (await app.getMathResultText()).trim();

      // Based on the implementation tokenization, an unknown operator error should be thrown and displayed
      // The operator value shown in the error may be surprising ('2') due to tokenization; we assert that the message starts with 'Error: Unknown operator'
      expect(text.startsWith('Error: Unknown operator')).toBeTruthy();

      // Confirm error styling applied
      const bg4 = await app.getMathResultBgColor();
      expect(bg).toBe('rgb(248, 232, 232)');

      // No unhandled page errors should be present
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Robustness checks: repeated interactions and state transitions', () => {
    test('re-interpreting after success and after error keeps consistent UI updates', async ({ page }) => {
      // This test mixes interactions to validate transitions from result states to new result/error states
      const app6 = new InterpreterPage(page);
      await app.goto();

      // 1) Valid math -> success
      await app.setMath('1 + 1');
      await app.clickInterpretMath();
      await expect(app.mathResult).toBeVisible();
      expect((await app.getMathResultText()).trim()).toBe('1 + 1 = 2');
      expect(await app.getMathResultBgColor()).toBe('rgb(232, 244, 248)');

      // 2) Invalid math -> error (S2_MathInterpreted -> S3_Error)
      await app.setMath('');
      await app.clickInterpretMath();
      await expect(app.mathResult).toBeVisible();
      expect((await app.getMathResultText()).trim()).toBe('Error: Invalid expression');
      expect(await app.getMathResultBgColor()).toBe('rgb(248, 232, 232)');

      // 3) Valid roman after math error: ensure roman result independent and correct
      await app.setRoman('IV');
      await app.clickInterpretRoman();
      await expect(app.romanResult).toBeVisible();
      expect((await app.getRomanResultText()).trim()).toBe('IV = 4');
      expect(await app.getRomanResultBgColor()).toBe('rgb(232, 244, 248)');

      // No unhandled page errors during these transitions
      expect(pageErrors.length).toBe(0);
    });
  });
});