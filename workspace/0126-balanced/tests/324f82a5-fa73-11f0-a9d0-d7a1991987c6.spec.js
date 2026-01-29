import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f82a5-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Refactoring Example page
class RefactorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.num1 = '#num1';
    this.num2 = '#num2';
    this.button = 'button';
    this.result = '#result';
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async enterNumbers(n1, n2) {
    await this.page.fill(this.num1, String(n1));
    await this.page.fill(this.num2, String(n2));
  }

  async clearInputs() {
    await this.page.fill(this.num1, '');
    await this.page.fill(this.num2, '');
  }

  async clickCalculate() {
    // Use locator click to trigger the button's onclick
    await this.page.click(this.button);
  }

  async getResultText() {
    return (await this.page.textContent(this.result)) ?? '';
  }

  async getButtonOnclickName() {
    return await this.page.evaluate(() => {
      const btn = document.querySelector('button');
      // the onclick property is a function reference; return its name if present
      return btn && btn.onclick ? btn.onclick.name : null;
    });
  }

  async buttonOnclickStrictlyMatchesFunctionName(funcName) {
    return await this.page.evaluate((name) => {
      const btn1 = document.querySelector('button');
      if (!btn || !btn.onclick) return false;
      return btn.onclick.name === name;
    }, funcName);
  }

  async elementExists(selector) {
    return await this.page.$(selector) !== null;
  }

  async getPlaceholder(selector) {
    return await this.page.getAttribute(selector, 'placeholder');
  }
}

// Group tests that validate the FSM states and transitions
test.describe('Refactoring Example FSM - 324f82a5-fa73-11f0-a9d0-d7a1991987c6', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Attach listeners for console and pageerror for each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Collect console messages with type and text for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions from the page
      pageErrors.push(err);
    });
  });

  // Validates initial Idle state rendering of the page (S0_Idle)
  test('Idle state: initial render has inputs, button, and empty result', async ({ page }) => {
    const app = new RefactorPage(page);
    await app.goto();

    // Verify inputs and button exist and have correct placeholders/text
    expect(await app.elementExists(app.num1)).toBeTruthy();
    expect(await app.elementExists(app.num2)).toBeTruthy();
    expect(await app.elementExists(app.button)).toBeTruthy();

    expect(await app.getPlaceholder(app.num1)).toBe('Enter first number');
    expect(await app.getPlaceholder(app.num2)).toBe('Enter second number');

    const buttonText = await page.textContent(app.button);
    expect(buttonText).toBeTruthy();
    expect(buttonText.trim()).toBe('Calculate Sum');

    // Result should be empty on initial render
    const initialResult = await app.getResultText();
    expect(initialResult.trim()).toBe('');

    // FSM evidence: ensure the button's onclick is set to the refactored function
    const onclickName = await app.getButtonOnclickName();
    // The script sets document.querySelector('button').onclick = calculateSumRefactored;
    expect(onclickName).toBe('calculateSumRefactored');

    // Assert there were no uncaught page errors during initial render
    expect(pageErrors.length).toBe(0);

    // No console error-level messages
    expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
  });

  // Valid transition test: S0_Idle -> S1_Calculating -> S2_ResultDisplayed with integer inputs
  test('Valid numbers: clicking Calculate Sum transitions to result displayed (integers)', async ({ page }) => {
    const app1 = new RefactorPage(page);
    await app.goto();

    // Enter integer values
    await app.enterNumbers(5, 7);

    // Before clicking: result empty (still in Idle)
    expect((await app.getResultText()).trim()).toBe('');

    // Click button to trigger calculateSumRefactored (S1_Calculating entry action)
    await app.clickCalculate();

    // Wait for result to be displayed and assert final state text (S2_ResultDisplayed)
    await page.waitForFunction((sel) => {
      const el = document.querySelector(sel);
      return el && el.innerText.trim().length > 0;
    }, app.result);

    const resultText = (await app.getResultText()).trim();
    expect(resultText).toBe('12'); // 5 + 7 = 12

    // Confirm displayResult updated the DOM as per FSM evidence
    expect(resultText).toBe('12');

    // Check no runtime errors happened
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
  });

  // Validate decimal and negative numbers and tolerant comparison for floating point sums
  test('Decimals and negatives: result is numerically correct (floating point tolerant)', async ({ page }) => {
    const app2 = new RefactorPage(page);
    await app.goto();

    // Use values that produce floating point precision edge cases
    await app.enterNumbers(-2.5, 3.1);
    await app.clickCalculate();

    // Wait for result to populate
    await page.waitForFunction((sel) => {
      return document.querySelector(sel) && document.querySelector(sel).innerText.length > 0;
    }, app.result);

    const displayed = (await app.getResultText()).trim();
    // Convert displayed text to Number safely
    const displayedNumber = Number(displayed);

    // Expected mathematical result
    const expected = -2.5 + 3.1; // may be 0.6000000000000001

    // Assert the numeric difference is small (tolerant)
    expect(Number.isFinite(displayedNumber)).toBeTruthy();
    expect(Math.abs(displayedNumber - expected)).toBeLessThan(1e-12);

    // No page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
  });

  // Edge case: missing/invalid input should display the error message from computeSum/displayResult
  test('Invalid input: missing value produces "Please enter valid numbers"', async ({ page }) => {
    const app3 = new RefactorPage(page);
    await app.goto();

    // Enter only one number; leave the second empty
    await app.clearInputs();
    await page.fill(app.num1, '10');
    await page.fill(app.num2, ''); // empty

    await app.clickCalculate();

    await page.waitForFunction((sel) => {
      const el1 = document.querySelector(sel);
      return el && el.innerText.trim().length > 0;
    }, app.result);

    const displayed1 = (await app.getResultText()).trim();
    expect(displayed).toBe('Please enter valid numbers');

    // Confirm no uncaught page errors; invalid input is handled by application logic
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
  });

  // Edge case: very large numbers produce Infinity; ensure behavior is consistent with computeSum
  test('Large numbers: overflow behavior (Infinity) is reflected in result', async ({ page }) => {
    const app4 = new RefactorPage(page);
    await app.goto();

    // Very large numbers that will overflow to Infinity when added
    const large = '1e308';
    await app.enterNumbers(large, large);
    await app.clickCalculate();

    await page.waitForFunction((sel) => {
      const el2 = document.querySelector(sel);
      return el && el.innerText.trim().length > 0;
    }, app.result);

    const displayed2 = (await app.getResultText()).trim();
    // JS will produce Infinity for 1e308 + 1e308
    // The displayResult sets innerText to the computed result; assert it matches the string 'Infinity'
    expect(displayed).toBe('Infinity');

    // No runtime errors expected even with overflow
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
  });

  // Validate that the refactored functions are present and that the button's onclick references the refactored variant
  test('Implementation details: functions exist on window and button onclick points to calculateSumRefactored', async ({ page }) => {
    const app5 = new RefactorPage(page);
    await app.goto();

    // Check that functions are available on the window object
    const functionsExist = await page.evaluate(() => {
      return {
        hasCalculateSum: typeof window.calculateSum === 'function',
        hasRefactored: typeof window.calculateSumRefactored === 'function',
        hasComputeSum: typeof window.computeSum === 'function',
        hasGetNumberValue: typeof window.getNumberValue === 'function',
        hasDisplayResult: typeof window.displayResult === 'function'
      };
    });

    expect(functionsExist.hasCalculateSum).toBeTruthy();
    expect(functionsExist.hasRefactored).toBeTruthy();
    expect(functionsExist.hasComputeSum).toBeTruthy();
    expect(functionsExist.hasGetNumberValue).toBeTruthy();
    expect(functionsExist.hasDisplayResult).toBeTruthy();

    // Confirm button onclick points to the refactored function by name
    const onclickName1 = await app.getButtonOnclickName();
    expect(onclickName).toBe('calculateSumRefactored');

    // Additionally confirm strict name equality check returns true
    expect(await app.buttonOnclickStrictlyMatchesFunctionName('calculateSumRefactored')).toBeTruthy();

    // No runtime errors
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
  });

  // Test that invoking the computeSum function directly via evaluate matches expected results (internal logic test)
  test('Internal computeSum behavior: returns sum or error message when invoked directly', async ({ page }) => {
    const app6 = new RefactorPage(page);
    await app.goto();

    // Call computeSum on the page with valid numbers and invalid values
    const results = await page.evaluate(() => {
      // Call the internal computeSum with numeric and null inputs
      // Using the functions defined on the page
      const r1 = computeSum(2, 3);
      const r2 = computeSum(null, 5);
      const r3 = computeSum(1.5, 2.25);
      return { r1, r2, r3 };
    });

    expect(results.r1).toBe(5);
    expect(results.r2).toBe('Please enter valid numbers');
    // Numeric result for decimals; allow close match
    expect(Math.abs(results.r3 - 3.75)).toBeLessThan(1e-12);

    // Ensure no uncaught page errors occurred while calling internal functions
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
  });

  // After each test, surface any page errors as part of test diagnostics by asserting none exist
  test.afterEach(async () => {
    // These assertions are redundant with individual tests but provide a final safety net.
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.some(m => m.type === 'error')).toBeFalsy();
  });
});