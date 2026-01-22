import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3c83d2-d360-11f0-b42e-71f0e7238799.html';

// Page Object for the Divide and Conquer Demonstration app
class DivideAndConquerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#arrayInput');
    this.sortButton = page.locator('#sortButton');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setInput(value) {
    await this.input.fill(value);
  }

  async clickSort() {
    await this.sortButton.click();
  }

  async getResultText() {
    return (await this.result.innerText()).trim();
  }
}

// Helper to collect console errors and page errors for assertions
async function setupErrorCollectors(page) {
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    // record only error-level console messages
    try {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    } catch (e) {
      // ignore any unexpected inspection errors
    }
  });

  page.on('pageerror', err => {
    // pageerror gives us Error objects from the page context
    pageErrors.push(String(err && err.message ? err.message : err));
  });

  return { consoleErrors, pageErrors };
}

test.describe('Divide and Conquer Demonstration - Merge Sort UI (FSM validation)', () => {
  // Reuse a fresh page for each test
  test.beforeEach(async ({ page }) => {
    // No special setup here; each test will navigate when needed.
  });

  test.afterEach(async ({ page }) => {
    // ensure page is closed/reset by Playwright automatically
  });

  test('S0_Idle: Initial state renders input, button, and empty result (no runtime errors on load)', async ({ page }) => {
    // Validate initial (Idle) UI and ensure no console or page errors occurred during load.
    const { consoleErrors, pageErrors } = await setupErrorCollectors(page);
    const app = new DivideAndConquerPage(page);

    // Navigate to the application page
    await app.goto();

    // The input and button should be present and visible
    await expect(app.input).toBeVisible();
    await expect(app.sortButton).toBeVisible();

    // Result area should initially be empty
    const initialResult = await app.getResultText();
    expect(initialResult).toBe(''); // empty string expected

    // Assert there were no console error messages and no page errors (ReferenceError/SyntaxError/TypeError)
    // If any such errors occurred naturally in the page runtime they will be present in these arrays.
    expect(consoleErrors, `Unexpected console.error messages on initial load: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Unexpected page errors on initial load: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('S0 -> S1 -> S2: Valid numeric input leads to Sorted state with correct output', async ({ page }) => {
    // This test validates the transition from Idle to InputReceived to Sorted when valid input is provided.
    const { consoleErrors, pageErrors } = await setupErrorCollectors(page);
    const app = new DivideAndConquerPage(page);

    await app.goto();

    // Provide a typical unsorted list including duplicates
    await app.setInput('5,2,9,1,5,6');

    // Click the Sort button to trigger the SortArrayClick event
    await app.clickSort();

    // The result should reflect the Sorted state evidence: Sorted Array: <sorted numbers joined by ", ">
    const resultText = await app.getResultText();
    expect(resultText).toBe('Sorted Array: 1, 2, 5, 5, 6, 9');

    // Ensure there were no runtime errors during parsing/sorting
    expect(consoleErrors, `Console errors during sorting: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Page errors during sorting: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('S1 -> S3: Empty input (or whitespace) produces Invalid Input state message', async ({ page }) => {
    // This test checks that providing an empty string or whitespace triggers the Invalid Input final state.
    const { consoleErrors, pageErrors } = await setupErrorCollectors(page);
    const app = new DivideAndConquerPage(page);

    await app.goto();

    // Case A: explicit empty string
    await app.setInput('');
    await app.clickSort();
    let resultText = await app.getResultText();
    expect(resultText).toBe('Please enter a valid array of numbers.');

    // Case B: whitespace-only input
    await app.setInput('   ');
    await app.clickSort();
    resultText = await app.getResultText();
    expect(resultText).toBe('Please enter a valid array of numbers.');

    // No runtime errors should occur while handling invalid input
    expect(consoleErrors, `Console errors while handling empty/whitespace input: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Page errors while handling empty/whitespace input: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('S1 -> S3: Non-numeric inputs are filtered out and if none remain, Invalid Input is shown', async ({ page }) => {
    // Verify that non-numeric tokens are filtered and invalid input path occurs when result array is empty.
    const { consoleErrors, pageErrors } = await setupErrorCollectors(page);
    const app = new DivideAndConquerPage(page);

    await app.goto();

    // Provide totally non-numeric tokens
    await app.setInput('a,b,c,hello');
    await app.clickSort();
    const resultText = await app.getResultText();
    expect(resultText).toBe('Please enter a valid array of numbers.');

    // No runtime errors such as TypeError/ReferenceError should have happened
    expect(consoleErrors, `Console errors while handling non-numeric input: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Page errors while handling non-numeric input: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('Edge case: trailing commas and extra whitespace are handled; results sorted numerically', async ({ page }) => {
    // Validate that trailing commas and blank tokens are ignored and sorting works correctly numerically.
    const { consoleErrors, pageErrors } = await setupErrorCollectors(page);
    const app = new DivideAndConquerPage(page);

    await app.goto();

    // Example with trailing commas and blank entries
    await app.setInput('3, ,2,10,');
    await app.clickSort();
    const resultText = await app.getResultText();
    // After filtering, array should be [3,2,10] sorted to [2,3,10]
    expect(resultText).toBe('Sorted Array: 2, 3, 10');

    expect(consoleErrors, `Console errors during trailing-comma handling: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Page errors during trailing-comma handling: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('Edge case: negatives and duplicates sort correctly (numerical sort, not lexicographic)', async ({ page }) => {
    // Ensure negative numbers and duplicates are properly sorted numerically
    const { consoleErrors, pageErrors } = await setupErrorCollectors(page);
    const app = new DivideAndConquerPage(page);

    await app.goto();

    await app.setInput('-1, -3, -2, 0, 0');
    await app.clickSort();
    const resultText = await app.getResultText();
    expect(resultText).toBe('Sorted Array: -3, -2, -1, 0, 0');

    expect(consoleErrors, `Console errors during negative-number sorting: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Page errors during negative-number sorting: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('Multiple consecutive clicks: idempotent behavior and consistent final state', async ({ page }) => {
    // Validate that multiple clicks (without changing input) produce consistent results and do not cause errors
    const { consoleErrors, pageErrors } = await setupErrorCollectors(page);
    const app = new DivideAndConquerPage(page);

    await app.goto();

    await app.setInput('4,1,3');
    // First click
    await app.clickSort();
    let resultText = await app.getResultText();
    expect(resultText).toBe('Sorted Array: 1, 3, 4');

    // Second click (should produce same result)
    await app.clickSort();
    resultText = await app.getResultText();
    expect(resultText).toBe('Sorted Array: 1, 3, 4');

    // Third click after small input tweak to ensure re-sorting still works
    await app.setInput('2,4,1,3');
    await app.clickSort();
    resultText = await app.getResultText();
    expect(resultText).toBe('Sorted Array: 1, 2, 3, 4');

    expect(consoleErrors, `Console errors during consecutive clicks: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Page errors during consecutive clicks: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('FSM evidence: verify that the expected DOM evidence elements exist and match FSM component selectors', async ({ page }) => {
    // This test checks that the components described in the FSM (input, button, result) actually exist in the DOM.
    const { consoleErrors, pageErrors } = await setupErrorCollectors(page);
    const app = new DivideAndConquerPage(page);

    await app.goto();

    // The FSM evidence included #arrayInput, #sortButton, #result
    await expect(page.locator('#arrayInput')).toHaveCount(1);
    await expect(page.locator('#sortButton')).toHaveCount(1);
    await expect(page.locator('#result')).toHaveCount(1);

    // Confirm basic attributes like placeholder text and button text
    const placeholder = await page.locator('#arrayInput').getAttribute('placeholder');
    expect(placeholder).toBe('e.g. 5,2,9,1,5,6');

    const buttonText = await page.locator('#sortButton').innerText();
    expect(buttonText.trim()).toBe('Sort Array');

    expect(consoleErrors, `Console errors while checking FSM evidence elements: ${consoleErrors.join(' | ')}`).toEqual([]);
    expect(pageErrors, `Page errors while checking FSM evidence elements: ${pageErrors.join(' | ')}`).toEqual([]);
  });

  test('Runtime error observation: capture any ReferenceError/SyntaxError/TypeError if they occur during interactions', async ({ page }) => {
    // This test intentionally captures and asserts on any JavaScript runtime errors that occur naturally.
    // It does not inject or patch the page; it only observes and reports.
    const { consoleErrors, pageErrors } = await setupErrorCollectors(page);
    const app = new DivideAndConquerPage(page);

    await app.goto();

    // Perform a typical interaction sequence
    await app.setInput('8,3,7');
    await app.clickSort();

    // After interactions, examine collected errors for specific JS error types
    const combinedErrors = [...consoleErrors, ...pageErrors].join(' || ');

    // If any runtime errors occurred, fail and include the messages.
    expect(combinedErrors, `Unexpected runtime JavaScript errors observed: ${combinedErrors}`).toBe('');

    // Also assert that we reached a valid Sorted state (sanity check)
    const resultText = await app.getResultText();
    expect(resultText).toBe('Sorted Array: 3, 7, 8');
  });
});