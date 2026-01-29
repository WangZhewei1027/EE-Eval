import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e2312-fa73-11f0-a9d0-d7a1991987c6.html';

/*
  Page object for the Recursion Demo application.
  Encapsulates common interactions and selectors.
*/
class RecursionDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#numberInput');
    this.button = page.locator("button[onclick='calculateFactorial()']");
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async setNumber(value) {
    // Use fill to set the value of the number input (works for type="number")
    await this.input.fill(String(value));
  }

  async clearNumber() {
    await this.input.fill('');
  }

  async clickCalculate() {
    await this.button.click();
  }

  async getResultText() {
    return await this.result.innerText();
  }
}

test.describe('Recursion Demo (FSM) - Comprehensive E2E tests', () => {
  // Arrays to collect console errors and page errors observed during each test
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages of type 'error'
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // Ensure listener never throws
      }
    });

    // Collect unhandled page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app
    const app = new RecursionDemoPage(page);
    await app.goto();
  });

  test.afterEach(async ({ page }) => {
    // After each test assert there were no uncaught page errors or console errors.
    // This helps detect runtime ReferenceError/SyntaxError/TypeError that may occur naturally.
    // If any such errors occurred, the assertions below will fail and surface them.
    expect(pageErrors.length, `Expected no uncaught page errors, but found: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Expected no console.error messages, but found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
    // Remove listeners to avoid memory leaks - Playwright's page will be torn down between tests, but being explicit is fine.
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial state (S0_Idle) renders expected components and exposes implementation functions', async ({ page }) => {
    // This test validates the Idle state: input, button and empty result area are present.
    // It also verifies FSM entry action "renderPage()" is not present on window (the HTML does not define it),
    // therefore we assert window.renderPage is undefined rather than attempting to call/patch it.
    const app = new RecursionDemoPage(page);

    await expect(app.input).toBeVisible();
    await expect(app.button).toBeVisible();
    await expect(app.result).toBeVisible();
    await expect(app.result).toHaveText('', { timeout: 1000 }); // result should be empty initially

    // Verify factorial function defined (implementation uses it)
    const factorialExists = await page.evaluate(() => typeof window.factorial === 'function');
    expect(factorialExists).toBe(true);

    // The FSM's extracted entry action mentions renderPage(), but the implementation does not define it.
    // We verify that renderPage is not injected on the window object (so no unintended global exists).
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');
  });

  test('Transition S0 -> S1_Error: clicking calculate with empty input shows validation message', async ({ page }) => {
    // Validate error transition when no input is provided.
    const app = new RecursionDemoPage(page);

    // Ensure input is empty then click calculate
    await app.clearNumber();
    await app.clickCalculate();

    // Expect the Error state message
    await expect(app.result).toHaveText('Please enter a valid non-negative integer.', { timeout: 2000 });
  });

  test('Transition S0 -> S1_Error: clicking calculate with negative number shows validation message', async ({ page }) => {
    // Validate error transition for negative numbers
    const app = new RecursionDemoPage(page);

    await app.setNumber(-1);
    await app.clickCalculate();

    await expect(app.result).toHaveText('Please enter a valid non-negative integer.', { timeout: 2000 });
  });

  test('Transition S0 -> S2_Result: valid positive integer computes factorial (5 -> 120)', async ({ page }) => {
    // Validate successful factorial calculation for a typical case
    const app = new RecursionDemoPage(page);

    await app.setNumber(5);
    await app.clickCalculate();

    await expect(app.result).toHaveText('Factorial of 5 is: 120', { timeout: 2000 });
  });

  test('Edge cases: factorial of 0 and 1 should both be 1 (S2_Result)', async ({ page }) => {
    // Verify the base cases of recursion
    const app = new RecursionDemoPage(page);

    await app.setNumber(0);
    await app.clickCalculate();
    await expect(app.result).toHaveText('Factorial of 0 is: 1', { timeout: 2000 });

    // Now test 1
    await app.setNumber(1);
    await app.clickCalculate();
    await expect(app.result).toHaveText('Factorial of 1 is: 1', { timeout: 2000 });
  });

  test('Edge case: decimal input is parsed using parseInt (3.7 -> treated as 3)', async ({ page }) => {
    // The implementation uses parseInt; this verifies that decimals are truncated to integer.
    const app = new RecursionDemoPage(page);

    // Use a decimal value; parseInt should convert "3.7" -> 3, factorial(3) = 6
    await app.setNumber('3.7');
    await app.clickCalculate();

    await expect(app.result).toHaveText('Factorial of 3 is: 6', { timeout: 2000 });
  });

  test('Implementation exposes factorial function that is recursive and provides correct results (direct evaluation)', async ({ page }) => {
    // Directly call factorial from the page's JS context to validate recursion works for several values.
    // This verifies the implementation details described in the FSM evidence (factorial function).
    const results = await page.evaluate(() => {
      // returns an array of checks so we can assert them in the test runner
      return {
        factorialExists: typeof window.factorial === 'function',
        f0: window.factorial ? window.factorial(0) : null,
        f1: window.factorial ? window.factorial(1) : null,
        f6: window.factorial ? window.factorial(6) : null
      };
    });

    expect(results.factorialExists).toBe(true);
    expect(results.f0).toBe(1);
    expect(results.f1).toBe(1);
    expect(results.f6).toBe(720);
  });

  test('Repeated interactions: alternating valid and invalid inputs produce correct transitions', async ({ page }) => {
    // This test exercises rapid consecutive transitions to verify state handling and DOM updates remain correct.
    const app = new RecursionDemoPage(page);

    // 1) invalid empty -> Error
    await app.clearNumber();
    await app.clickCalculate();
    await expect(app.result).toHaveText('Please enter a valid non-negative integer.', { timeout: 2000 });

    // 2) valid 4 -> Result
    await app.setNumber(4);
    await app.clickCalculate();
    await expect(app.result).toHaveText('Factorial of 4 is: 24', { timeout: 2000 });

    // 3) negative -> Error
    await app.setNumber(-5);
    await app.clickCalculate();
    await expect(app.result).toHaveText('Please enter a valid non-negative integer.', { timeout: 2000 });

    // 4) valid 2 -> Result
    await app.setNumber(2);
    await app.clickCalculate();
    await expect(app.result).toHaveText('Factorial of 2 is: 2', { timeout: 2000 });
  });
});