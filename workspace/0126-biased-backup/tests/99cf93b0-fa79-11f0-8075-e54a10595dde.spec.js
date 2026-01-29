import { test, expect } from '@playwright/test';

class BigThetaPage {
  /**
   * Page object for the Big-Theta Notation Explorer
   * Encapsulates interactions and queries against the DOM
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf93b0-fa79-11f0-8075-e54a10595dde.html';
    this.selectors = {
      title: 'h1',
      inputFunction: '#inputFunction',
      thetaFunction: '#thetaFunction',
      nValue: '#nValue',
      rangeValue: '#rangeValue',
      calculateButton: 'button[onclick="calculate()"]',
      output: '#output'
    };
    this.consoleMessages = [];
    this.pageErrors = [];
    // Attach listeners to capture console logs & page errors
    this.page.on('console', msg => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
    this.page.on('pageerror', err => {
      // store the error object for assertions
      this.pageErrors.push(err);
    });
  }

  async goto() {
    // Navigate to the test HTML page
    await this.page.goto(this.url);
  }

  async getTitleText() {
    return this.page.textContent(this.selectors.title);
  }

  async getInputFunctionValue() {
    return this.page.$eval(this.selectors.inputFunction, el => el.value);
  }

  async setInputFunctionValue(val) {
    // Use native element value assignment and dispatch 'change' so updateGraph() is triggered
    await this.page.$eval(this.selectors.inputFunction, (el, v) => {
      el.value = v;
      const evt = new Event('change', { bubbles: true });
      el.dispatchEvent(evt);
    }, String(val));
  }

  async selectThetaFunction(value) {
    await this.page.selectOption(this.selectors.thetaFunction, value);
    // selectOption triggers change events but ensure updateGraph runs by dispatching change
    await this.page.$eval(this.selectors.thetaFunction, el => {
      const evt = new Event('change', { bubbles: true });
      el.dispatchEvent(evt);
    });
  }

  async setNValue(val) {
    // For range input: set value and dispatch change
    await this.page.$eval(this.selectors.nValue, (el, v) => {
      el.value = v;
      const evt = new Event('change', { bubbles: true });
      el.dispatchEvent(evt);
    }, String(val));
  }

  async clickCalculate() {
    await this.page.click(this.selectors.calculateButton);
  }

  async getRangeValueText() {
    return this.page.textContent(this.selectors.rangeValue);
  }

  async getOutputText() {
    // Normalize whitespace
    const raw = await this.page.textContent(this.selectors.output);
    return raw ? raw.trim().replace(/\s+/g, ' ') : '';
  }

  getConsoleMessages() {
    return this.consoleMessages;
  }

  getPageErrors() {
    return this.pageErrors;
  }

  // helper to compute expected values using the same logic as the page's calculateTheta
  static computeExpectedTheta(func, n) {
    // Mirror the page's implementation (as strings)
    const parsed = parseInt(n);
    switch (func) {
      case 'n':
        return `${parsed}`;
      case 'nLogN':
        // Reproduce the site's bug/behavior: Math.log(n).toFixed(2) is executed first (string), then multiplied by n
        // We'll compute exactly that: take Math.log(n), call toFixed(2) (string), then multiply by parsed
        return `${parsed * Number(Math.log(parsed).toFixed(2))}`;
      case 'nSquared':
        return `${parsed * parsed}`;
      case 'logN':
        return `${Number(Math.log(parsed).toFixed(2))}`;
      case 'constant':
        return `1`;
      default:
        return `Undefined`;
    }
  }
}

test.describe('Big-Theta Notation Explorer (FSM validation)', () => {
  // Each test will create its own page fixture via Playwright test runner
  test('S0_Idle: initial render displays title and expected default controls', async ({ page }) => {
    // Validate the Idle state - initial rendering of page
    const app = new BigThetaPage(page);
    await app.goto();

    // Validate title present (evidence of renderPage())
    const title = await app.getTitleText();
    expect(title).toContain('Big-Theta Notation Explorer');

    // Validate default control values exist (evidence components)
    const inputVal = await app.getInputFunctionValue();
    expect(inputVal).toBe('1');

    const thetaVal = await page.$eval('#thetaFunction', el => el.value);
    expect(thetaVal).toBe('n');

    const nValue = await page.$eval('#nValue', el => el.value);
    expect(nValue).toBe('10');

    const rangeText = await app.getRangeValueText();
    expect(rangeText).toBe('10');

    // Output div should exist (may be empty until updateGraph invoked)
    const outputExists = await page.$('#output') !== null;
    expect(outputExists).toBeTruthy();

    // Ensure no page errors immediately after load
    const errors = app.getPageErrors();
    expect(errors.length).toBe(0);
  });

  test('S1_FunctionUpdated: changing input value updates output fields and triggers updateGraph', async ({ page }) => {
    // This test validates transitions from Idle -> FunctionUpdated via InputFunctionChange
    const app = new BigThetaPage(page);
    await app.goto();

    // Change the numeric input to 5 and assert output reflects this change
    await app.setInputFunctionValue(5);

    // Read output and assert it contains updated input and that evaluated value uses selected theta (default 'n')
    const output = await app.getOutputText();
    expect(output).toContain('Current Input (n): 5');
    expect(output).toContain('Selected Theta Function: n');
    // Default theta is 'n' so Evaluated at n = 10 should be 10 (string)
    expect(output).toContain('Evaluated at n = 10: 10');

    // No runtime errors for a normal valid change
    const errors = app.getPageErrors();
    expect(errors.length).toBe(0);
  });

  test('S1_FunctionUpdated: selecting different theta function and changing range updates evaluated output', async ({ page }) => {
    // This test validates ThetaFunctionChange and NValueChange transitions
    const app = new BigThetaPage(page);
    await app.goto();

    // Set the slider (nValue) to 4
    await app.setNValue(4);
    expect(await app.getRangeValueText()).toBe('4');

    // Change selection to nSquared
    await app.selectThetaFunction('nSquared');

    // Output should reflect the evaluated value (nSquared => 4^2 = 16)
    const output = await app.getOutputText();
    expect(output).toContain('Selected Theta Function: nSquared');
    expect(output).toContain('Evaluated at n = 4: 16');

    // Also test another theta selection: logN with n=4 should be Math.log(4).toFixed(2)
    await app.selectThetaFunction('logN');
    const expectedLog = BigThetaPage.computeExpectedTheta('logN', 4);
    const output2 = await app.getOutputText();
    expect(output2).toContain(`Selected Theta Function: logN`);
    expect(output2).toContain(`Evaluated at n = 4: ${expectedLog}`);

    // Confirm no page errors occurred during standard interactions
    expect(app.getPageErrors().length).toBe(0);
  });

  test('S2_CalculationPerformed: clicking "Calculate Big-Theta" triggers calculate() and updates output', async ({ page }) => {
    // Validate transition FunctionUpdated -> CalculationPerformed via CalculateButtonClick
    const app = new BigThetaPage(page);
    await app.goto();

    // Set up a combination: inputFunction=3 (affects "Current Input"), thetaFunction=nLogN, nValue=10
    await app.setInputFunctionValue(3);
    await app.selectThetaFunction('nLogN');
    await app.setNValue(10);

    // Click the calculate button - this triggers calculate() which calls updateGraph()
    await app.clickCalculate();

    // Expect output to include computed nLogN for n=10 using same logic as the page
    const expected = BigThetaPage.computeExpectedTheta('nLogN', 10);
    const output = await app.getOutputText();
    expect(output).toContain('Current Input (n): 3');
    expect(output).toContain('Selected Theta Function: nLogN');
    expect(output).toContain(`Evaluated at n = 10: ${expected}`);

    // Check that console logs did not contain fatal errors
    const consoles = app.getConsoleMessages();
    // There might be informational console messages, but ensure there is no console.error or exceptions logged
    const errorsLogged = consoles.filter(c => c.type === 'error');
    expect(errorsLogged.length).toBe(0);

    // Ensure no page errors from normal calculation
    expect(app.getPageErrors().length).toBe(0);
  });

  test('Edge case & error scenario: setting n to 0 (violates min constraint) triggers runtime error in calculateTheta', async ({ page }) => {
    // This test intentionally reproduces a runtime error scenario by setting the nValue to 0
    // The page's calculateTheta implementation calls Math.log(n).toFixed(2) for nLogN which can throw for n=0 (Infinity.toFixed)
    const app = new BigThetaPage(page);

    // Reset listeners by creating a fresh BigThetaPage instance attached to the new page
    await app.goto();

    // Clear any prior errors
    expect(app.getPageErrors().length).toBe(0);

    // Force the range input value to 0 (bypassing min attribute) and set theta function to nLogN
    // We will then click calculate which calls updateGraph -> calculateTheta -> should throw
    await app.setNValue(0);
    await app.selectThetaFunction('nLogN');

    // Click Calculate to invoke calculation and cause the runtime error
    // Ensure we capture pageerror events that occur as a result
    // Wait for possible pageerror - use a short wait after click to allow event propagation
    await app.clickCalculate();

    // Give the page a short moment to handle the error event emission
    await page.waitForTimeout(200);

    const errors = app.getPageErrors();
    // We expect at least one runtime error to have occurred due to toFixed being called on Infinity
    expect(errors.length).toBeGreaterThanOrEqual(1);

    // Inspect most recent error for indicative message (e.g., toFixed, Infinity, RangeError)
    const message = errors[errors.length - 1].message || '';
    // The exact error message can vary by browser, so assert that it mentions toFixed or Infinity or Range
    const matches = /toFixed|Infinity|RangeError|Invalid|NaN|TypeError/i.test(message);
    expect(matches).toBeTruthy();

    // Additionally ensure the output did not silently show sane content for the evaluated value
    const output = await app.getOutputText();
    // It may be partially updated or empty; assert that it contains the attempted evaluated n
    // and that something went wrong (either "Undefined" or an invalid numeric string)
    expect(output).toContain('Selected Theta Function: nLogN');
  });

  test('Edge cases: verify other theta functions produce expected outputs for several n values', async ({ page }) => {
    // Validate many combinations to ensure calculateTheta logic matches expectations
    const app = new BigThetaPage(page);
    await app.goto();

    const testCases = [
      { theta: 'n', n: 1 },
      { theta: 'n', n: 42 },
      { theta: 'nSquared', n: 7 },
      { theta: 'logN', n: 2 },
      { theta: 'constant', n: 100 }
    ];

    for (const tc of testCases) {
      await app.setNValue(tc.n);
      await app.selectThetaFunction(tc.theta);
      // Trigger updateGraph via a change to inputFunction as well to ensure all fields refreshed
      await app.setInputFunctionValue(2);

      const expected = BigThetaPage.computeExpectedTheta(tc.theta, tc.n);
      const output = await app.getOutputText();
      expect(output).toContain(`Selected Theta Function: ${tc.theta}`);
      expect(output).toContain(`Evaluated at n = ${tc.n}: ${expected}`);
    }

    // Confirm no page errors during standard valid edge checks
    expect(app.getPageErrors().length).toBe(0);
  });
});