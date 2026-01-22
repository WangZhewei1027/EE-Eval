import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0baa23c1-d5b2-11f0-b169-abe023d0d932.html';

// Page object for the Knapsack application
class KnapsackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      form: '#knapsack-form',
      weight: '#weight',
      value: '#value',
      capacity: '#capacity',
      submit: '#submit',
      output: '#output'
    };
  }

  // Navigate to the application URL
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Ensure required elements are present
  async expectInitialElements() {
    await expect(this.page.locator(this.selectors.form)).toBeVisible();
    await expect(this.page.locator(this.selectors.weight)).toBeVisible();
    await expect(this.page.locator(this.selectors.value)).toBeVisible();
    await expect(this.page.locator(this.selectors.capacity)).toBeVisible();
    await expect(this.page.locator(this.selectors.submit)).toBeVisible();
  }

  // Set numeric inputs. Accepts strings or numbers; sets value attribute directly.
  async setInputs({ weight = '', value = '', capacity = '' } = {}) {
    // Use evaluate to set values directly to avoid race with any re-rendering
    await this.page.evaluate(
      ({ s, weight, value, capacity }) => {
        const w = document.querySelector(s.weight);
        const v = document.querySelector(s.value);
        const c = document.querySelector(s.capacity);
        if (w) w.value = weight;
        if (v) v.value = value;
        if (c) c.value = capacity;
      },
      { s: this.selectors, weight: String(weight), value: String(value), capacity: String(capacity) }
    );
  }

  // Click the submit button but capture output synchronously inside page context to avoid form navigation wiping it out.
  // Returns the innerHTML of #output as produced by the click handler.
  async submitAndGetOutput() {
    const html = await this.page.evaluate((s) => {
      const submitBtn = document.querySelector(s.submit);
      // Create and dispatch a real click event synchronously. The click handler computes output synchronously.
      const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
      // Dispatch the event and then read the output immediately while still in same JS turn (before navigation).
      submitBtn.dispatchEvent(clickEvent);
      const out = document.querySelector(s.output);
      return out ? out.innerHTML : null;
    }, this.selectors);
    return html;
  }

  // Convenience to get output text content (strips HTML)
  async getOutputText() {
    return await this.page.$eval(this.selectors.output, el => el.innerText);
  }
}

test.describe('Knapsack Problem - FSM states and transitions', () => {
  // Collect console messages and page errors observed during each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages
    page.on('console', (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
    });

    // Listen to uncaught exceptions (pageerror)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // If any uncaught page errors were recorded, include them in the test failure diagnostics.
    if (pageErrors.length > 0) {
      // Print out captured console for debugging and fail the test explicitly
      // We use expect to fail with a helpful message
      const errorMessages = pageErrors.map(e => String(e)).join('\n---\n');
      const consoleDump = consoleMessages.join('\n');
      throw new Error(
        `Page had uncaught errors during test:\n${errorMessages}\n\nConsole output:\n${consoleDump}`
      );
    }
    // No explicit teardown needed beyond this; Playwright will close page/context.
  });

  test('S0_Idle: initial render contains the form and inputs (entry action renderPage())', async ({ page }) => {
    // Validate initial idle state: the page renders the knapsack form and components.
    const knapsack = new KnapsackPage(page);
    await knapsack.goto();

    // Assert the form and controls are present as evidence of the Idle state entry action.
    await knapsack.expectInitialElements();

    // Check there were no console errors during load
    const hasConsoleError = consoleMessages.some(msg => msg.toLowerCase().includes('error'));
    expect(hasConsoleError).toBeFalsy();

    // Confirm no page errors were emitted
    expect(pageErrors.length).toBe(0);
  });

  test('Transition SubmitButtonClick -> S1_Submitted: valid inputs (weight <= capacity) produce computed output', async ({ page }) => {
    // This test validates the event that triggers the transition and the entry action of Submitted state.
    const knapsack = new KnapsackPage(page);
    await knapsack.goto();

    // Provide sample values where weight <= capacity
    // weight = 2, value = 10, capacity = 4 => expect Total Value: 20 (value * capacity / weight), Remaining Capacity: 2
    await knapsack.setInputs({ weight: 2, value: 10, capacity: 4 });

    // Dispatch click and capture the output innerHTML synchronously to avoid any form navigation wiping it out.
    const outputHtml = await knapsack.submitAndGetOutput();

    // The code produces multiple "The optimal solution is:" segments, so ensure that appears.
    expect(outputHtml).toEqual(expect.any(String));
    expect(outputHtml).toContain('The optimal solution is:');

    // Check for computed numeric results that should be present given the inputs.
    expect(outputHtml).toContain('Total Value: 20');
    expect(outputHtml).toContain('Total Weight: 2').or.toContain('Total Weight: 2'); // one of the entries includes weight 2
    expect(outputHtml).toContain('Remaining Capacity: 2');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Transition SubmitButtonClick -> S1_Submitted: insufficient capacity branch (weight > capacity)', async ({ page }) => {
    // Validate the else branch where the application should show an error message
    const knapsack = new KnapsackPage(page);
    await knapsack.goto();

    // Provide values where weight > capacity
    await knapsack.setInputs({ weight: 5, value: 10, capacity: 4 });

    const outputHtml = await knapsack.submitAndGetOutput();

    // The implementation uses the specific message when capacity insufficient
    expect(outputHtml).toBe('Insufficient capacity to solve the problem.');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: weight = 0 leads to division by zero behavior (observe Infinity or similar result)', async ({ page }) => {
    // This test validates how the implementation behaves when division by zero occurs.
    const knapsack = new KnapsackPage(page);
    await knapsack.goto();

    // weight = 0 will cause value * capacity / weight to compute Infinity in JS
    await knapsack.setInputs({ weight: 0, value: 10, capacity: 4 });

    const outputHtml = await knapsack.submitAndGetOutput();

    // The output should contain "Infinity" as a result of division by zero, or may contain "NaN"
    // We assert that either Infinity or NaN appears in the HTML output (both indicate problematic arithmetic).
    const containsInfinity = outputHtml.includes('Infinity');
    const containsNaN = outputHtml.includes('NaN');

    expect(containsInfinity || containsNaN).toBeTruthy();

    // Also ensure that the output includes the marker text from the algorithm
    expect(outputHtml).toContain('The optimal solution is:');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: empty inputs produce NaN parsing and trigger insufficient capacity message', async ({ page }) => {
    // When inputs are empty, parseInt('') => NaN, comparisons using NaN should route to the insufficient-capacity branch.
    const knapsack = new KnapsackPage(page);
    await knapsack.goto();

    // Ensure inputs are empty
    await knapsack.setInputs({ weight: '', value: '', capacity: '' });

    const outputHtml = await knapsack.submitAndGetOutput();

    // Expect the insufficient capacity message as a result of NaN comparisons
    expect(outputHtml).toBe('Insufficient capacity to solve the problem.');

    // Verify no runtime page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Console and runtime observation: ensure no unexpected runtime errors on normal interactions', async ({ page }) => {
    const knapsack = new KnapsackPage(page);
    await knapsack.goto();

    // Perform a normal interaction to exercise the code path
    await knapsack.setInputs({ weight: 3, value: 9, capacity: 6 });
    const outputHtml = await knapsack.submitAndGetOutput();

    // Basic validation of output
    expect(outputHtml).toContain('The optimal solution is:');

    // Ensure console did not emit explicit error messages (console.error)
    const consoleErrorMessages = consoleMessages.filter(m => m.toLowerCase().includes('error'));
    expect(consoleErrorMessages.length).toBe(0);

    // Ensure there were no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });
});