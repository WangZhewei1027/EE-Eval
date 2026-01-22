import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3c35b1-d360-11f0-b42e-71f0e7238799.html';

// Page Object for the Knapsack page
class KnapsackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.weights = page.locator('#weights');
    this.values = page.locator('#values');
    this.capacity = page.locator('#capacity');
    this.solveButton = page.locator('#solveButton');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillInputs({ weights = '', values = '', capacity = '' } = {}) {
    await this.weights.fill(weights);
    await this.values.fill(values);
    await this.capacity.fill(capacity);
  }

  async clickSolve() {
    await this.solveButton.click();
  }

  async getResultText() {
    return (await this.result.innerText()).trim();
  }
}

test.describe('Knapsack Problem Solver - FSM Tests (Application ID: 7b3c35b1-d360-11f0-b42e-71f0e7238799)', () => {
  let pageErrors = [];
  let consoleMessages = [];
  let consoleHandler;
  let pageErrorHandler;

  // Attach console and pageerror listeners before each test and navigate to the page.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    consoleHandler = (msg) => {
      // Collect console messages for later assertions
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    };
    pageErrorHandler = (error) => {
      // Collect uncaught page errors
      pageErrors.push(error);
    };

    page.on('console', consoleHandler);
    page.on('pageerror', pageErrorHandler);

    // Navigate to the application exactly as-is
    await page.goto(APP_URL);
  });

  // Remove listeners after each test to avoid cross-test pollution
  test.afterEach(async ({ page }) => {
    try {
      page.off('console', consoleHandler);
      page.off('pageerror', pageErrorHandler);
    } catch (e) {
      // best-effort cleanup; don't fail tests during teardown
    }
  });

  test('S0_Idle - initial render displays inputs, placeholders, button, and empty result', async ({ page }) => {
    // This test validates the initial (Idle) state S0_Idle as per the FSM:
    // - All input elements and the Solve button must be present with correct placeholders.
    // - The result area should be empty.
    // - No runtime errors should have occurred just by loading the page.
    const knapsack = new KnapsackPage(page);

    // Verify inputs and placeholders
    await expect(knapsack.weights).toBeVisible();
    await expect(knapsack.weights).toHaveAttribute('placeholder', 'e.g. 2,3,4,5');

    await expect(knapsack.values).toBeVisible();
    await expect(knapsack.values).toHaveAttribute('placeholder', 'e.g. 3,4,5,6');

    await expect(knapsack.capacity).toBeVisible();
    await expect(knapsack.capacity).toHaveAttribute('placeholder', 'e.g. 5');

    // Solve button present
    await expect(knapsack.solveButton).toBeVisible();
    await expect(knapsack.solveButton).toHaveText('Solve');

    // Result should be empty
    const resultText = await knapsack.getResultText();
    expect(resultText).toBe('');

    // Ensure no uncaught page errors were emitted on load
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console.error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_Solved - valid inputs produce the correct knapsack result (transition S0 -> S1)', async ({ page }) => {
    // This test validates the SolveButtonClick event and transition to the S1_Solved state:
    // - Using known inputs, verify the computed maximum value is as expected.
    // - Confirm the DOM result text is updated to the expected final state text.
    // - Ensure no runtime errors or console errors occurred during this successful solve.
    const knapsack = new KnapsackPage(page);

    // Sample data from FSM notes:
    // weights: 2,3,4,5
    // values:  3,4,5,6
    // capacity: 5
    // Expected optimal value: choose items weight 2 and 3 -> value 3+4 = 7
    await knapsack.fillInputs({ weights: '2,3,4,5', values: '3,4,5,6', capacity: '5' });

    await knapsack.clickSolve();

    // Wait for the result to update and assert final state text
    await expect(knapsack.result).toHaveText('Maximum value in knapsack: 7');

    // No page errors should have occurred during a normal solve
    expect(pageErrors.length).toBe(0);

    // No console.error entries
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition - clicking Solve with mismatched weights and values shows validation message', async ({ page }) => {
    // This test triggers the validation branch where weights.length !== values.length
    // and verifies the result area shows the expected validation message (still S1_Solved final state evidence).
    const knapsack = new KnapsackPage(page);

    // Provide mismatched arrays
    await knapsack.fillInputs({ weights: '1,2', values: '3', capacity: '5' });

    await knapsack.clickSolve();

    // The application should catch this and display a clear validation message.
    await expect(knapsack.result).toHaveText('Weights and values must have the same length.');

    // No runtime page errors should have been thrown for this handled validation path.
    expect(pageErrors.length).toBe(0);

    // No console.error entries
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case - empty capacity input leads to a runtime RangeError (let errors happen naturally and assert they occur)', async ({ page }) => {
    // This test intentionally supplies an empty capacity to exercise how the page behaves
    // when capacity is NaN. The implementation uses Array(capacity + 1) which will throw
    // a RangeError ("Invalid array length") when capacity is NaN. We must NOT patch or fix
    // the page — we let the error happen naturally and assert that such an error is emitted.
    const knapsack = new KnapsackPage(page);

    // Provide valid weights and values but leave capacity empty to trigger the bug
    await knapsack.fillInputs({ weights: '1,2', values: '3,4', capacity: '' });

    // Start waiting for a page error and then click solve to trigger it.
    // Use waitForEvent to reliably catch the uncaught exception emitted by the page.
    const [error] = await Promise.all([
      page.waitForEvent('pageerror', { timeout: 2000 }),
      knapsack.clickSolve()
    ]);

    // We recorded page errors in the pageErrors array as well; ensure at least one was recorded.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Assert that the received error is a RangeError or mentions invalid array length.
    // Different engines might phrase it slightly differently, so check both name and message.
    const matched = pageErrors.some(e => {
      const nameMatch = e && e.name === 'RangeError';
      const message = e && e.message ? e.message.toString() : '';
      const msgMatch = message.includes('Invalid array length') || message.toLowerCase().includes('invalid array') || message.toLowerCase().includes('array length');
      return nameMatch || msgMatch;
    });

    expect(matched).toBeTruthy();

    // Additionally ensure the specific waited-for error exists and has relevant clues
    const waitedErrorMessage = error && error.message ? error.message.toString() : '';
    expect(waitedErrorMessage || '').not.toBe('');
  });

  test('Edge case - non-numeric entries result in numeric parsing to NaN and produce a result (usually 0) without page errors', async ({ page }) => {
    // This test checks behavior when non-numeric values are provided for weights/values.
    // The page uses Number() conversion which yields NaN; algorithm's comparisons will fail
    // and should lead to a result of 0 without throwing (i.e., handled without pageerror).
    const knapsack = new KnapsackPage(page);

    await knapsack.fillInputs({ weights: 'a,b', values: 'c,d', capacity: '5' });

    await knapsack.clickSolve();

    // Expect the algorithm to finish and the result to be a number (likely 0) printed.
    await expect(knapsack.result).toHaveText('Maximum value in knapsack: 0');

    // No page errors should have occurred in this scenario
    expect(pageErrors.length).toBe(0);

    // No console.error entries
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});