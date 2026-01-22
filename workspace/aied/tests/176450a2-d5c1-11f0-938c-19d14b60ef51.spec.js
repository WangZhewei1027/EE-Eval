import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/176450a2-d5c1-11f0-938c-19d14b60ef51.html';

/**
 * Page Object for the Knapsack Demo page.
 * Encapsulates common interactions and queries.
 */
class KnapsackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.weightsSelector = '#weights';
    this.valuesSelector = '#values';
    this.limitSelector = '#weightLimit';
    this.resultSelector = '#result';
    this.solveButtonSelector = "button[onclick='solveKnapsack()']";
  }

  async goto() {
    await this.page.goto(BASE_URL);
  }

  async fillWeights(text) {
    await this.page.fill(this.weightsSelector, text);
  }

  async fillValues(text) {
    await this.page.fill(this.valuesSelector, text);
  }

  async setLimit(value) {
    // Use fill to set number or blank
    await this.page.fill(this.limitSelector, String(value));
  }

  async clickSolve() {
    await this.page.click(this.solveButtonSelector);
  }

  async getResultText() {
    return (await this.page.locator(this.resultSelector).innerText()).trim();
  }

  async getHeaderText() {
    return (await this.page.locator('h1').innerText()).trim();
  }

  async getPlaceholders() {
    const w = await this.page.getAttribute(this.weightsSelector, 'placeholder');
    const v = await this.page.getAttribute(this.valuesSelector, 'placeholder');
    const l = await this.page.getAttribute(this.limitSelector, 'placeholder');
    return { weights: w, values: v, limit: l };
  }
}

test.describe('Knapsack Problem Demo - FSM and UI tests', () => {
  // Collect console messages and page errors for assertions
  test.beforeEach(async ({ page }) => {
    // No-op: individual tests will create KnapsackPage and goto
  });

  // Test the initial Idle state (S0_Idle)
  test('Initial Idle state renders header, inputs and placeholders (S0_Idle entry actions)', async ({ page }) => {
    // This test validates the initial rendering (renderPage() evidence: <h1>Knapsack Problem Solver</h1>)
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const kp = new KnapsackPage(page);
    await kp.goto();

    // Verify header exists and matches FSM evidence
    const header = await kp.getHeaderText();
    expect(header).toBe('Knapsack Problem Solver');

    // Verify input placeholders as described in the FSM components
    const placeholders = await kp.getPlaceholders();
    expect(placeholders.weights).toBe('e.g. 1,2,3,2');
    expect(placeholders.values).toBe('e.g. 10,10,40,30');
    expect(placeholders.limit).toBe('e.g. 5');

    // Result div should be present and empty initially
    const resultText = await kp.getResultText();
    expect(resultText).toBe('');

    // There should be no console errors or page errors on a fresh load
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // Test the solve transition (S0_Idle -> S1_Solved) with a normal valid input
  test('Solve transition computes correct maximum value (S0_Idle -> S1_Solved)', async ({ page }) => {
    // This test validates the SolveKnapsack event, solveKnapsack() action, and S1_Solved entry action displayResult()
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    const kp = new KnapsackPage(page);
    await kp.goto();

    // Provide a set of items and a weight limit where we can calculate expected answer.
    // Items: weights [1,2,3], values [10,15,40], limit = 5
    // Best selection: items 2 (w=2,v=15) and 3 (w=3,v=40) => total value 55
    await kp.fillWeights('1,2,3');
    await kp.fillValues('10,15,40');
    await kp.setLimit('5');

    // Click the Solve Knapsack button to trigger transition.
    await kp.clickSolve();

    // Verify the result text matches the expected DP computation
    const result = await kp.getResultText();
    expect(result).toBe('Maximum value in knapsack: 55');

    // Ensure no page errors occurred during the valid computation
    expect(consoleErrors).toHaveLength(0);
    expect(pageErrors).toHaveLength(0);
  });

  // Edge case: mismatched weights and values should trigger an alert and not set the result
  test('Mismatched weights and values triggers alert and does not produce a result', async ({ page }) => {
    // This test validates error handling path in solveKnapsack():
    // if weights.length !== values.length then alert is shown and function returns early.
    const kp = new KnapsackPage(page);
    await kp.goto();

    // Prepare to capture the dialog (alert)
    const dialogPromise = page.waitForEvent('dialog');

    await kp.fillWeights('1,2');      // two weights
    await kp.fillValues('10');        // one value -> mismatch
    await kp.setLimit('5');

    // Click solve and wait for alert
    await kp.clickSolve();
    const dialog = await dialogPromise;
    // The page uses alert("Weights and values must have the same length.");
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe('Weights and values must have the same length.');
    await dialog.accept();

    // Ensure that the result div remains empty because the function should have returned early
    const resultAfter = await kp.getResultText();
    expect(resultAfter).toBe('');
  });

  // Error scenario: missing or invalid weight limit should cause a runtime error (let errors happen naturally)
  test('Missing weight limit (NaN) causes a runtime page error when solving (assert pageerror occurs)', async ({ page }) => {
    // This test intentionally triggers a runtime error by leaving weightLimit blank.
    // The implementation uses:
    // const weightLimit = parseInt(document.getElementById('weightLimit').value);
    // and then Array(weightLimit + 1) which will throw if weightLimit is NaN -> we expect a pageerror.
    const kp = new KnapsackPage(page);
    await kp.goto();

    // Capture pageerror event and console errors
    const pageErrorPromise = page.waitForEvent('pageerror');
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Fill valid weights and values but leave the weightLimit empty (parseInt('') -> NaN)
    await kp.fillWeights('1,2,3');
    await kp.fillValues('10,15,40');
    await kp.setLimit(''); // blank

    // Click solve to trigger the error
    await kp.clickSolve();

    // Wait for a pageerror to be emitted (should happen naturally due to invalid array length).
    // If no error occurs within the timeout, the test will fail (we are asserting an error occurs).
    const err = await pageErrorPromise;

    // Assert that an error occurred and has an informative name/message.
    expect(err).toBeTruthy();
    // The thrown error in this situation is typically a RangeError due to invalid array length,
    // but different engines may produce different names. We assert it is an Error and has a message.
    expect(typeof err.message).toBe('string');
    expect(err.message.length).toBeGreaterThan(0);

    // Also assert that a console error was recorded (the runtime error should surface to console)
    // There may be zero or more console error messages depending on the runtime; at least ensure the captured error(s) are present when available.
    // We don't strictly require a console error, but if present it should be a non-empty string.
    if (consoleErrors.length > 0) {
      for (const c of consoleErrors) {
        expect(typeof c).toBe('string');
        expect(c.length).toBeGreaterThan(0);
      }
    }
  });
});