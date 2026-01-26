import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cf4595-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Dynamic Programming Visualizer
class DPVisualizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.submitBtn = page.locator('#submitBtn');
    this.calculateBtn = page.locator('#calculateBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.resultsOutput = page.locator('#resultsOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setArrayInput(value) {
    await this.arrayInput.fill(value);
  }

  async setTargetInput(value) {
    // fill string to support non-numeric tests
    await this.targetInput.fill(String(value));
  }

  async clickSubmit() {
    await this.submitBtn.click();
  }

  async clickCalculate() {
    await this.calculateBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async getResultsText() {
    return (await this.resultsOutput.textContent()) ?? '';
  }

  async getArrayInputValue() {
    return (await this.arrayInput.inputValue()) ?? '';
  }

  async getTargetInputValue() {
    return (await this.targetInput.inputValue()) ?? '';
  }

  // Access internal globals on the page (amounts and target) for deeper verification.
  // Note: these are read-only inspections, not modifications.
  async getInternalAmounts() {
    return this.page.evaluate(() => {
      // If amounts isn't defined, return undefined
      return typeof amounts !== 'undefined' ? amounts : undefined;
    });
  }

  async getInternalTarget() {
    return this.page.evaluate(() => {
      return typeof target !== 'undefined' ? target : undefined;
    });
  }
}

test.describe('Dynamic Programming Visualizer - FSM and UI tests', () => {
  let pageErrors = [];
  let consoleMessages = [];

  // Setup and capture console and page errors before each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions from the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });
  });

  // Helper to assert no critical runtime errors occurred on the page.
  async function assertNoCriticalErrors() {
    // No uncaught page errors
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.toString()).join('\n')}`).toBe(0);

    // No console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console error messages were logged: ${JSON.stringify(consoleErrors)}`).toBe(0);

    // Ensure no ReferenceError, SyntaxError or TypeError text in any console message
    const criticalRegex = /\b(ReferenceError|SyntaxError|TypeError)\b/;
    const foundCritical = consoleMessages.find(m => criticalRegex.test(m.text));
    expect(foundCritical, `Found critical error in console messages: ${JSON.stringify(foundCritical)}`).toBeUndefined();
  }

  test.describe('Idle state (S0_Idle) - initial render and presence checks', () => {
    test('renders main controls and initial empty state', async ({ page }) => {
      // Validate initial page render (S0_Idle)
      const app = new DPVisualizerPage(page);
      await app.goto();

      // Verify UI elements exist and are visible
      await expect(app.arrayInput).toBeVisible();
      await expect(app.targetInput).toBeVisible();
      await expect(app.submitBtn).toBeVisible();
      await expect(app.calculateBtn).toBeVisible();
      await expect(app.resetBtn).toBeVisible();
      await expect(app.resultsOutput).toBeVisible();

      // Initially, inputs should be empty and resultsOutput should be empty (entry action: renderPage implicit)
      expect(await app.getArrayInputValue()).toBe('');
      expect(await app.getTargetInputValue()).toBe('');
      expect(await app.getResultsText()).toBe('');

      // Internal globals should be their initial values (defined in the script)
      const amounts = await app.getInternalAmounts();
      const target = await app.getInternalTarget();
      expect(Array.isArray(amounts)).toBe(true);
      expect(amounts.length).toBe(0);
      expect(target).toBe(0);

      // Confirm no runtime errors were emitted during initial render
      await assertNoCriticalErrors();
    });
  });

  test.describe('SubmitAmounts event and S1_AmountsSet state', () => {
    test('Submit valid comma-separated amounts transitions to AmountsSet and updates output', async ({ page }) => {
      // This verifies transition S0_Idle -> S1_AmountsSet when clicking Submit
      const app = new DPVisualizerPage(page);
      await app.goto();

      // Provide input and submit
      await app.setArrayInput('1,2,3,4,5');
      await app.clickSubmit();

      // The resultsOutput should reflect the parsed amounts
      const results = await app.getResultsText();
      expect(results).toContain('Amounts set.');
      expect(results).toContain(JSON.stringify([1, 2, 3, 4, 5]));

      // Internal amounts array should be updated accordingly
      const internalAmounts = await app.getInternalAmounts();
      expect(Array.isArray(internalAmounts)).toBe(true);
      expect(internalAmounts).toEqual([1, 2, 3, 4, 5]);

      // No critical errors produced
      await assertNoCriticalErrors();
    });

    test('Submit input with non-numeric entries filters them out', async ({ page }) => {
      // Edge case: mixed valid and invalid tokens
      const app = new DPVisualizerPage(page);
      await app.goto();

      await app.setArrayInput('1,2,a,3, ,4b,5');
      await app.clickSubmit();

      const results = await app.getResultsText();
      // Expect only numeric values remained
      expect(results).toContain('Amounts set.');
      // Numbers parsed should be [1,2,3,5] (4b and blank ignored)
      // Note: Number('4b') => NaN, so filtered out; blank => NaN
      expect(results).toContain(JSON.stringify([1, 2, 3, 5]));

      const internalAmounts = await app.getInternalAmounts();
      expect(internalAmounts).toEqual([1, 2, 3, 5]);

      await assertNoCriticalErrors();
    });
  });

  test.describe('CalculateResult event and S2_TargetSet state', () => {
    test('Calculate after submitting amounts returns expected result for target (whole path S1->S2)', async ({ page }) => {
      // This validates transition S1_AmountsSet -> S2_TargetSet on Calculate
      const app = new DPVisualizerPage(page);
      await app.goto();

      // Submit amounts then set target and calculate
      await app.setArrayInput('1,2,3,4,5');
      await app.clickSubmit();

      // Ensure internal amounts set
      const internalBefore = await app.getInternalAmounts();
      expect(internalBefore).toEqual([1, 2, 3, 4, 5]);

      // Set target to 7 and calculate
      await app.setTargetInput('7');
      await app.clickCalculate();

      // Expected dynamicProgrammingMax result for these nums and target 7 is 7
      const results = await app.getResultsText();
      expect(results).toContain('Result for target 7:');
      // JSON.stringify(7) -> "7", so result will include ": 7"
      expect(results.trim()).toBe('Result for target 7: 7');

      // Internal target should be 7
      const internalTarget = await app.getInternalTarget();
      expect(internalTarget).toBe(7);

      await assertNoCriticalErrors();
    });

    test('Calculate with no amounts returns 0 for a valid target', async ({ page }) => {
      // Edge: no amounts defined, target should yield dp[target] = 0
      const app = new DPVisualizerPage(page);
      await app.goto();

      // Ensure amounts are empty initially
      const internalAmounts = await app.getInternalAmounts();
      expect(internalAmounts).toEqual([]);

      await app.setTargetInput('5');
      await app.clickCalculate();

      const results = await app.getResultsText();
      expect(results.trim()).toBe('Result for target 5: 0');

      await assertNoCriticalErrors();
    });

    test('Calculate with invalid/non-numeric target shows validation message', async ({ page }) => {
      // Edge case: missing or invalid target should produce a user-facing validation message
      const app = new DPVisualizerPage(page);
      await app.goto();

      // Submit some amounts to be realistic
      await app.setArrayInput('1,2,3');
      await app.clickSubmit();

      // Leave target empty and calculate
      await app.setTargetInput(''); // explicit empty
      await app.clickCalculate();

      let results = await app.getResultsText();
      expect(results.trim()).toBe('Please enter a valid target amount.');

      // Try non-numeric value
      await app.setTargetInput('abc');
      await app.clickCalculate();

      results = await app.getResultsText();
      expect(results.trim()).toBe('Please enter a valid target amount.');

      await assertNoCriticalErrors();
    });
  });

  test.describe('ResetInputs event and S3_Reset state', () => {
    test('Reset from Idle clears inputs and output (S0 -> S3)', async ({ page }) => {
      // Verify transition S0_Idle -> S3_Reset by clicking Reset immediately
      const app = new DPVisualizerPage(page);
      await app.goto();

      // Pre-fill fields to simulate user interaction then reset
      await app.setArrayInput('9,8,7');
      await app.setTargetInput('10');

      // Click Reset
      await app.clickReset();

      // Inputs should be cleared
      expect(await app.getArrayInputValue()).toBe('');
      expect(await app.getTargetInputValue()).toBe('');
      expect(await app.getResultsText()).toBe('');

      // Internal variables should be reset (amounts=[], target=0)
      const internalAmounts = await app.getInternalAmounts();
      const internalTarget = await app.getInternalTarget();
      expect(Array.isArray(internalAmounts)).toBe(true);
      expect(internalAmounts.length).toBe(0);
      expect(internalTarget).toBe(0);

      await assertNoCriticalErrors();
    });

    test('Reset from AmountsSet clears inputs, output, and internal state (S1 -> S3)', async ({ page }) => {
      // Submit some amounts then reset
      const app = new DPVisualizerPage(page);
      await app.goto();

      await app.setArrayInput('1,2,3');
      await app.clickSubmit();

      // Ensure amounts set
      expect((await app.getResultsText()).includes('Amounts set.')).toBe(true);

      // Now reset
      await app.clickReset();

      expect(await app.getArrayInputValue()).toBe('');
      expect(await app.getTargetInputValue()).toBe('');
      expect(await app.getResultsText()).toBe('');

      const internalAmounts = await app.getInternalAmounts();
      const internalTarget = await app.getInternalTarget();
      expect(internalAmounts).toEqual([]);
      expect(internalTarget).toBe(0);

      await assertNoCriticalErrors();
    });

    test('Reset from TargetSet (after calculate) clears everything (S2 -> S3)', async ({ page }) => {
      // Submit amounts, calculate, then reset
      const app = new DPVisualizerPage(page);
      await app.goto();

      await app.setArrayInput('1,2,3');
      await app.clickSubmit();

      await app.setTargetInput('4');
      await app.clickCalculate();

      // Confirm result displayed
      expect((await app.getResultsText()).startsWith('Result for target 4:')).toBe(true);

      // Reset
      await app.clickReset();

      expect(await app.getArrayInputValue()).toBe('');
      expect(await app.getTargetInputValue()).toBe('');
      expect(await app.getResultsText()).toBe('');

      // Internal state cleared
      const internalAmounts = await app.getInternalAmounts();
      const internalTarget = await app.getInternalTarget();
      expect(internalAmounts).toEqual([]);
      expect(internalTarget).toBe(0);

      await assertNoCriticalErrors();
    });
  });

  test.describe('Additional edge cases and invariants', () => {
    test('Zero target should return 0 and not error', async ({ page }) => {
      const app = new DPVisualizerPage(page);
      await app.goto();

      await app.setArrayInput('1,2,3');
      await app.clickSubmit();

      await app.setTargetInput('0');
      await app.clickCalculate();

      const results = await app.getResultsText();
      expect(results.trim()).toBe('Result for target 0: 0');

      await assertNoCriticalErrors();
    });

    test('Large target with small amounts returns a computed number (no crash)', async ({ page }) => {
      const app = new DPVisualizerPage(page);
      await app.goto();

      // Use reasonable large target to test algorithm behavior without excessive time
      await app.setArrayInput('1,3,4');
      await app.clickSubmit();

      await app.setTargetInput('50');
      await app.clickCalculate();

      const results = await app.getResultsText();
      // result should be a number string, e.g. "Result for target 50: X"
      expect(results.startsWith('Result for target 50:')).toBe(true);

      // Parsed number should be convertible to integer and >= 0
      const parts = results.split(':').map(s => s.trim());
      expect(parts.length).toBeGreaterThanOrEqual(2);
      const valueStr = parts.slice(1).join(':'); // handle any colons in formatting (defensive)
      const parsed = Number(valueStr);
      expect(Number.isFinite(parsed)).toBe(true);
      expect(parsed).toBeGreaterThanOrEqual(0);

      await assertNoCriticalErrors();
    });
  });
});