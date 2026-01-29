import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf93b1-fa79-11f0-8075-e54a10595dde.html';

class BigOmegaPage {
  /**
   * Page object wrapper for the Big-Omega interactive demo.
   * Encapsulates selectors and common actions.
   */
  constructor(page) {
    this.page = page;
    this.selectedFunction = page.locator('#selectedFunction');
    this.executionTime = page.locator('#executionTime');
    this.omegaNotation = page.locator('#omegaNotation');
    this.inputSize = page.locator('#inputSize');

    this.buttonConstant = page.locator('button[onclick="selectFunction(\'constant\')"]');
    this.buttonLinear = page.locator('button[onclick="selectFunction(\'linear\')"]');
    this.buttonQuadratic = page.locator('button[onclick="selectFunction(\'quadratic\')"]');
    this.buttonLogarithmic = page.locator('button[onclick="selectFunction(\'logarithmic\')"]');
    this.buttonCalculate = page.locator('button[onclick="calculate()"]');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure initial render has happened
    await expect(this.page.locator('h1')).toHaveText('Big-Omega Notation Interactive Demo');
  }

  async selectFunction(funcType) {
    switch (funcType) {
      case 'constant':
        await this.buttonConstant.click();
        break;
      case 'linear':
        await this.buttonLinear.click();
        break;
      case 'quadratic':
        await this.buttonQuadratic.click();
        break;
      case 'logarithmic':
        await this.buttonLogarithmic.click();
        break;
      default:
        throw new Error('Unknown function type: ' + funcType);
    }
  }

  // Sets the input size value and triggers the change event
  async setInputSize(value) {
    // Use fill to change the value, then dispatch a 'change' event so onchange attribute runs
    await this.inputSize.fill(String(value));
    await this.inputSize.dispatchEvent('change');
  }

  async clickCalculate() {
    await this.buttonCalculate.click();
  }

  async getSelectedFunctionText() {
    return this.selectedFunction.innerText();
  }

  async getExecutionTimeText() {
    return this.executionTime.innerText();
  }

  async getOmegaNotationText() {
    return this.omegaNotation.innerText();
  }
}

test.describe('Big-Omega Notation Interactive Demo (FSM validation)', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors to assert against later.
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Capture any uncaught exceptions from the page
      pageErrors.push(err.message || String(err));
    });

    page.on('console', (msg) => {
      // Collect console messages for inspection; helpful for debugging runtime issues
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test('Initial state (S0_Idle) renders correctly and has no runtime errors', async ({ page }) => {
    // This test validates the initial Idle state UI and ensures no immediate runtime errors were thrown.
    const app = new BigOmegaPage(page);
    await app.goto();

    // Verify initial textual evidence for the Idle state
    await expect(page.locator('h1')).toHaveText('Big-Omega Notation Interactive Demo');
    await expect(app.getSelectedFunctionText()).resolves.toBe('Selected Function: None');
    await expect(app.getExecutionTimeText()).resolves.toBe('Execution Time (T(n)): None');
    await expect(app.getOmegaNotationText()).resolves.toBe('Omega Notation: None');

    // Assert that loading the page produced no uncaught page errors (ReferenceError/SyntaxError/TypeError etc.)
    expect(pageErrors.length).toBe(0);
  });

  test.describe('SelectFunction event -> S1_FunctionSelected transitions', () => {
    test('Selecting Constant updates selected function and output (constant -> S1 then S2)', async ({ page }) => {
      // Selecting a function should update the selectedFunction DOM and call updateOutput() which triggers calculate()
      const app = new BigOmegaPage(page);
      await app.goto();

      // Click constant
      await app.selectFunction('constant');

      // Evidence of transition: Selected Function text updated
      await expect(app.selectedFunction).toHaveText('Selected Function: constant');

      // Since updateOutput and calculate are invoked, execution time should update for n=1 by default
      await expect(app.executionTime).toHaveText('Execution Time (T(n)): 1');
      await expect(app.omegaNotation).toHaveText('Omega Notation: Ω(1)');

      // No uncaught errors occurred during the selection and update
      expect(pageErrors.length).toBe(0);
    });

    test('Selecting Linear updates selected function and output (linear -> S1 then S2)', async ({ page }) => {
      const app = new BigOmegaPage(page);
      await app.goto();

      await app.selectFunction('linear');

      await expect(app.selectedFunction).toHaveText('Selected Function: linear');
      // default n=1 => executionTime = 1
      await expect(app.executionTime).toHaveText('Execution Time (T(n)): 1');
      await expect(app.omegaNotation).toHaveText('Omega Notation: Ω(n)');

      expect(pageErrors.length).toBe(0);
    });

    test('Selecting Quadratic updates selected function and output (quadratic -> S1 then S2)', async ({ page }) => {
      const app = new BigOmegaPage(page);
      await app.goto();

      await app.selectFunction('quadratic');

      await expect(app.selectedFunction).toHaveText('Selected Function: quadratic');
      // default n=1 => executionTime = 1
      await expect(app.executionTime).toHaveText('Execution Time (T(n)): 1');
      await expect(app.omegaNotation).toHaveText('Omega Notation: Ω(n^2)');

      expect(pageErrors.length).toBe(0);
    });

    test('Selecting Logarithmic updates selected function and output (logarithmic -> S1 then S2)', async ({ page }) => {
      const app = new BigOmegaPage(page);
      await app.goto();

      await app.selectFunction('logarithmic');

      await expect(app.selectedFunction).toHaveText('Selected Function: logarithmic');
      // Math.log(1) === 0
      await expect(app.executionTime).toHaveText('Execution Time (T(n)): 0');
      await expect(app.omegaNotation).toHaveText('Omega Notation: Ω(log n)');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('InputSizeChange event -> S2_OutputUpdated transitions', () => {
    test('Changing input size triggers updateOutput and calculate for linear function', async ({ page }) => {
      // This validates the InputSizeChange event triggers calculate() (S1 -> S2 transition) via onchange handler.
      const app = new BigOmegaPage(page);
      await app.goto();

      await app.selectFunction('linear');

      // change input size to 5 and dispatch 'change'
      await app.setInputSize(5);

      // executionTime should update to 5 for linear function
      await expect(app.executionTime).toHaveText('Execution Time (T(n)): 5');
      await expect(app.omegaNotation).toHaveText('Omega Notation: Ω(n)');

      expect(pageErrors.length).toBe(0);
    });

    test('Changing input size to 0 (edge case) yields expected numeric behavior', async ({ page }) => {
      const app = new BigOmegaPage(page);
      await app.goto();

      await app.selectFunction('linear');

      // although min=1 in the input, we can programmatically set to 0 to observe behavior
      await app.setInputSize(0);

      // parseInt('0') === 0 so executionTime should display 0
      await expect(app.executionTime).toHaveText('Execution Time (T(n)): 0');
      await expect(app.omegaNotation).toHaveText('Omega Notation: Ω(n)');

      expect(pageErrors.length).toBe(0);
    });

    test('Clearing input size (non-numeric) results in NaN execution time (edge case)', async ({ page }) => {
      // This test asserts behavior when parseInt returns NaN.
      const app = new BigOmegaPage(page);
      await app.goto();

      await app.selectFunction('linear');

      // Clear the input value to create an invalid parseInt scenario
      await app.setInputSize(''); // empty string -> parseInt('') === NaN

      // Execution time should be 'NaN' string in the DOM after calculation
      await expect(app.executionTime).toHaveText(/Execution Time \(T\(n\)\):\s*NaN/);
      // Omega notation still reflects the selected function
      await expect(app.omegaNotation).toHaveText('Omega Notation: Ω(n)');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('CalculateExecutionTime event -> S2_OutputUpdated transitions via Calculate button', () => {
    test('Clicking Calculate uses current selected function and input size (quadratic example)', async ({ page }) => {
      // This validates clicking the Calculate Execution Time button triggers calculate() (S1 -> S2 transition).
      const app = new BigOmegaPage(page);
      await app.goto();

      // choose quadratic and set n=3
      await app.selectFunction('quadratic');
      await app.setInputSize(3);

      // Clear any automatic update (though updateOutput runs automatically on select), explicitly click calculate to trigger the event path
      await app.clickCalculate();

      // executionTime should be 9 for n=3 and quadratic
      await expect(app.executionTime).toHaveText('Execution Time (T(n)): 9');
      await expect(app.omegaNotation).toHaveText('Omega Notation: Ω(n^2)');

      expect(pageErrors.length).toBe(0);
    });

    test('Clicking Calculate without selecting function results in N/A outputs', async ({ page }) {
      const app = new BigOmegaPage(page);
      await app.goto();

      // Ensure no function is selected yet
      await expect(app.selectedFunction).toHaveText('Selected Function: None');

      // Click Calculate
      await app.clickCalculate();

      // Expect calculate() to fall through to default branch producing 'N/A'
      await expect(app.executionTime).toHaveText('Execution Time (T(n)): N/A');
      await expect(app.omegaNotation).toHaveText('Omega Notation: N/A');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Robustness and additional edge cases', () => {
    test('Very large input for quadratic (potentially big numbers) still processes without page errors', async ({ page }) => {
      const app = new BigOmegaPage(page);
      await app.goto();

      await app.selectFunction('quadratic');

      // Large n; ensures calculate handles large numeric values (may produce Infinity)
      const largeN = 100000; // n^2 = 1e10, still representable
      await app.setInputSize(largeN);

      // After update, executionTime text should reflect the numeric value or scientific notation string
      const execText = await app.getExecutionTimeText();
      // Ensure the execution time contains the number representation (not throwing)
      expect(execText).toMatch(/Execution Time \(T\(n\)\):\s*\d+/);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Console and page error observation: no ReferenceError/SyntaxError/TypeError should have occurred during interactions', async ({ page }) => {
      // This test aggregates interactions and verifies that no unexpected runtime errors were observed.
      const app = new BigOmegaPage(page);
      await app.goto();

      // Perform a sequence of interactions
      await app.selectFunction('linear');
      await app.setInputSize(10);
      await app.selectFunction('logarithmic');
      await app.setInputSize(2);
      await app.clickCalculate();

      // Log diagnostic console messages in the test output (useful during failures)
      // Note: We don't mutate page; just ensure we observed console messages array
      // Expect no page errors (uncaught exceptions) gathered
      expect(pageErrors.length).toBe(0);

      // Optionally assert that consoleMessages is an array (it may be empty depending on page implementation)
      expect(Array.isArray(consoleMessages)).toBeTruthy();
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // If any page errors occurred during a failing test, include them in test output for debugging.
    if (pageErrors.length > 0) {
      // Attach page errors to the test report (Playwright will capture this)
      testInfo.annotations.push({
        type: 'pageErrors',
        description: pageErrors.join('\n'),
      });
    }
  });
});