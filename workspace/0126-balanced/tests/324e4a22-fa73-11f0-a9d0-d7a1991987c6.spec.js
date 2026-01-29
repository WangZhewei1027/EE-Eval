import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e4a22-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Knapsack app
class KnapsackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.weights = page.locator('#weights');
    this.values = page.locator('#values');
    this.capacity = page.locator('#capacity');
    this.solveButton = page.locator("button[onclick='solveKnapsack()']");
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setWeights(text) {
    await this.weights.fill(text);
  }

  async setValues(text) {
    await this.values.fill(text);
  }

  async setCapacity(value) {
    // fill to support non-numeric testing
    await this.capacity.fill(String(value));
  }

  async clickSolve() {
    await this.solveButton.click();
  }

  async getResultText() {
    return (await this.result.textContent()) || '';
  }
}

test.describe('324e4a22-fa73-11f0-a9d0-d7a1991987c6 - Branch and Bound Knapsack FSM tests', () => {
  // Capture console errors and page errors for each test to assert runtime stability
  test.beforeEach(async ({ page }) => {
    // No-op here; listeners are attached inside each test so they are test-scoped
  });

  // Test Idle state: verify initial render (S0_Idle)
  test('Idle state: page renders inputs, button and empty result on load', async ({ page }) => {
    // Collect console errors and page errors for this test
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    const knapsack = new KnapsackPage(page);
    await knapsack.goto();

    // Verify inputs are present and have expected placeholders/defaults (evidence of renderPage)
    await expect(knapsack.weights).toBeVisible();
    await expect(knapsack.values).toBeVisible();
    await expect(knapsack.capacity).toBeVisible();
    await expect(knapsack.solveButton).toBeVisible();

    // Check placeholders and default capacity value
    const weightsPlaceholder = await knapsack.weights.getAttribute('placeholder');
    const valuesPlaceholder = await knapsack.values.getAttribute('placeholder');
    const capacityValue = await knapsack.capacity.inputValue();

    expect(weightsPlaceholder).toBe('e.g. 2,3,4,5');
    expect(valuesPlaceholder).toBe('e.g. 3,4,5,6');
    expect(capacityValue).toBe('5');

    // Result should initially be empty (S0 evidence includes <pre id="result"></pre>)
    const initialResult = await knapsack.getResultText();
    expect(initialResult.trim()).toBe('');

    // Ensure no runtime errors on initial render
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test transition S0_Idle -> S1_Solving -> S2_Result with a normal valid input set
  test('SolveKnapsack event: valid inputs produce correct Maximum Value and result text', async ({ page }) => {
    // Collect console errors and page errors for this test
    const consoleErrors1 = [];
    const pageErrors1 = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    const knapsack1 = new KnapsackPage(page);
    await knapsack.goto();

    // Provide inputs known to produce a deterministic result:
    // weights: 2,3,4 and values: 3,4,5 with capacity 5 should pick items with weights 2 and 3 for total value 7.
    await knapsack.setWeights('2,3,4');
    await knapsack.setValues('3,4,5');
    await knapsack.setCapacity(5);

    // Click the Solve Knapsack button (this triggers solveKnapsack -> S1_Solving)
    await knapsack.clickSolve();

    // After solving, the app writes to #result with "Maximum Value: X" and possibly "Max Value Updated: ..."
    // Wait for the result to update and assert expected content (S2_Result)
    await expect.poll(async () => {
      return (await knapsack.getResultText()).trim();
    }, { timeout: 2000 }).toContain('Maximum Value:');

    const resultText = await knapsack.getResultText();

    // Validate expected computed values are present
    expect(resultText).toContain('Maximum Value: 7');
    expect(resultText).toContain('Max Value Updated: 7 with Weight: 5');

    // Ensure no runtime errors occurred during solve (no References/Syntax/Type errors)
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: empty inputs - ensure algorithm handles them without throwing and reports Maximum Value: 0
  test('Edge case: empty inputs should not throw and should produce "Maximum Value: 0"', async ({ page }) => {
    const consoleErrors2 = [];
    const pageErrors2 = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    const knapsack2 = new KnapsackPage(page);
    await knapsack.goto();

    // Set empty strings for weights and values (user might clear fields)
    await knapsack.setWeights('');
    await knapsack.setValues('');
    await knapsack.setCapacity(5);

    await knapsack.clickSolve();

    // Expect the app to handle gracefully and display at least "Maximum Value: 0"
    await expect.poll(async () => (await knapsack.getResultText()).trim(), { timeout: 2000 }).toContain('Maximum Value:');

    const resultText1 = await knapsack.getResultText();
    // Given the implementation, in many empty/NaN scenarios maxValue remains 0 and result string may be empty after newline
    expect(resultText).toContain('Maximum Value: 0');

    // There should not be any runtime errors thrown by malformed input
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: mismatched array lengths (weights longer than values) - should not throw exceptions
  test('Edge case: mismatched weights/values lengths does not throw and result is produced', async ({ page }) => {
    const consoleErrors3 = [];
    const pageErrors3 = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    const knapsack3 = new KnapsackPage(page);
    await knapsack.goto();

    // Provide more weights than values intentionally
    await knapsack.setWeights('2,3,4,5');
    await knapsack.setValues('3,4'); // shorter values array
    await knapsack.setCapacity(10);

    await knapsack.clickSolve();

    // Ensure the result area is updated with "Maximum Value:" even if some numeric computations become NaN
    await expect.poll(async () => (await knapsack.getResultText()).trim(), { timeout: 2000 }).toContain('Maximum Value:');

    const resultText2 = await knapsack.getResultText();
    expect(resultText).toMatch(/Maximum Value:\s*[-\dNaN]+/); // Accept numeric or NaN-like outputs

    // Confirm no page-level exceptions were thrown
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: non-numeric capacity - ensure parseInt produces NaN and the app still doesn't throw
  test('Edge case: non-numeric capacity should not crash the app', async ({ page }) => {
    const consoleErrors4 = [];
    const pageErrors4 = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err.message));

    const knapsack4 = new KnapsackPage(page);
    await knapsack.goto();

    await knapsack.setWeights('1,2,3');
    await knapsack.setValues('6,10,12');
    await knapsack.setCapacity('abc'); // non-numeric capacity

    await knapsack.clickSolve();

    // Expect UI to update with some "Maximum Value:" line and no thrown errors
    await expect.poll(async () => (await knapsack.getResultText()).trim(), { timeout: 2000 }).toContain('Maximum Value:');

    const resultText3 = await knapsack.getResultText();
    expect(resultText).toContain('Maximum Value:');

    // No runtime errors should have been emitted
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Validate that the Solve button has the onclick handler exactly as in the FSM evidence
  test('UI contract: Solve Knapsack button uses onclick="solveKnapsack()" as declared in FSM evidence', async ({ page }) => {
    const knapsack5 = new KnapsackPage(page);
    await knapsack.goto();

    // Check the attribute value for the onclick handler
    const onclickAttr = await knapsack.solveButton.getAttribute('onclick');
    expect(onclickAttr).toBe('solveKnapsack()');

    // Also ensure clicking the button triggers an update to the result area (smoke check)
    await knapsack.setWeights('2');
    await knapsack.setValues('3');
    await knapsack.setCapacity(1);
    await knapsack.clickSolve();

    await expect.poll(async () => (await knapsack.getResultText()).trim(), { timeout: 2000 }).toContain('Maximum Value:');
  });
});