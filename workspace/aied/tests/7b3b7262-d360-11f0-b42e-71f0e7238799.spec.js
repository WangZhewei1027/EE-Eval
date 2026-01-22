import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3b7262-d360-11f0-b42e-71f0e7238799.html';

// Page Object for the Counting Sort page
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#numberInput');
    this.sortButton = page.locator('button[onclick="performCountingSort()"]');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async enterNumbers(text) {
    await this.input.fill(text);
  }

  async clickSort() {
    await this.sortButton.click();
  }

  async getOutputText() {
    return await this.output.textContent();
  }
}

test.describe('Counting Sort Demonstration (FSM tests)', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events (info, error, warning, etc.)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, RangeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    const countingSortPage = new CountingSortPage(page);
    await countingSortPage.goto();
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright fixtures; handlers are garbage-collected with page.
  });

  test('S0_Idle: initial render shows input, placeholder, and Sort button', async ({ page }) => {
    // Validate Idle state UI components exist and are visible
    const countingSortPage = new CountingSortPage(page);

    // The input should be visible and have the expected placeholder
    await expect(countingSortPage.input).toBeVisible();
    await expect(countingSortPage.input).toHaveAttribute('placeholder', 'e.g. 4, 2, 2, 8, 3, 3, 1');

    // The Sort button should be visible and have the expected onclick attribute
    await expect(countingSortPage.sortButton).toBeVisible();
    await expect(countingSortPage.sortButton).toHaveText('Sort');

    // Output area should be present but initially empty
    await expect(countingSortPage.output).toBeVisible();
    await expect(countingSortPage.output).toHaveText('');

    // There should be no page errors on initial render
    // (we observe console + page errors but do not suppress them)
    expect(pageErrors.length).toBe(0);
    // Also ensure no console 'error' messages were emitted during load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Sorted: valid input sorts correctly', async ({ page }) => {
    // This validates the FSM transition triggered by the Sort button click
    const countingSortPage = new CountingSortPage(page);

    // Enter a typical comma-separated list and click Sort
    await countingSortPage.enterNumbers('4, 2, 2, 8, 3, 3, 1');
    await countingSortPage.clickSort();

    // Expect the output to show the sorted array (ascending)
    await expect(countingSortPage.output).toHaveText('Sorted Array: 1, 2, 2, 3, 3, 4, 8');

    // Ensure no uncaught page errors happened during sorting
    expect(pageErrors.length).toBe(0);

    // Console should not contain errors from this action
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Sorted: input tolerates extra spaces and formatting', async ({ page }) => {
    // Confirm robustness to spacing around commas
    const countingSortPage = new CountingSortPage(page);

    await countingSortPage.enterNumbers(' 10 ,5,  7 , 5,2 ');
    await countingSortPage.clickSort();

    // Sorted expected: 2, 5, 5, 7, 10
    await expect(countingSortPage.output).toHaveText('Sorted Array: 2, 5, 5, 7, 10');
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: empty input should surface a runtime error (RangeError) due to implementation assumption', async ({ page }) => {
    // The implementation calls Math.max(...arr) and then new Array(maxElement + 1)
    // If arr is empty this should lead to RangeError: Invalid array length (or similar)
    const countingSortPage = new CountingSortPage(page);

    // Make input empty and click Sort
    await countingSortPage.enterNumbers('');
    // Wait for pageerror event to fire as a result of the click
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      countingSortPage.clickSort()
    ]);

    // Assert that an error occurred and it is consistent with invalid array length
    expect(err).toBeTruthy();
    expect(err.message).toMatch(/Invalid array length|RangeError/i);
  });

  test('Edge case: non-numeric input should result in empty parsed array and thus runtime error', async ({ page }) => {
    // All entries are non-numeric; arr becomes empty -> same RangeError path
    const countingSortPage = new CountingSortPage(page);

    await countingSortPage.enterNumbers('a, b, foo');
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      countingSortPage.clickSort()
    ]);

    expect(err).toBeTruthy();
    expect(err.message).toMatch(/Invalid array length|RangeError/i);
  });

  test('Edge case: negative numbers - implementation is not designed for negatives but should not necessarily throw', async ({ page }) => {
    // Counting sort as implemented assumes non-negative integers.
    // We verify the page does not throw an uncaught error and produces some output text.
    const countingSortPage = new CountingSortPage(page);

    await countingSortPage.enterNumbers('-1, -2, -1');
    await countingSortPage.clickSort();

    // Implementation behavior with negatives is undefined in FSM; we assert:
    // - page did not crash with a pageerror
    // - output contains a "Sorted Array:" prefix (indicating function reached the end)
    const outputText = (await countingSortPage.getOutputText()) || '';
    expect(outputText.startsWith('Sorted Array:')).toBe(true);
    expect(pageErrors.length).toBe(0);
  });

  test('Single element input should remain the same after sorting', async ({ page }) => {
    const countingSortPage = new CountingSortPage(page);

    await countingSortPage.enterNumbers('5');
    await countingSortPage.clickSort();

    await expect(countingSortPage.output).toHaveText('Sorted Array: 5');
    expect(pageErrors.length).toBe(0);
  });

  test('Large max element: sorting should handle sparse large max values (memory permitting)', async ({ page }) => {
    // This verifies behavior when max value is large (e.g., 100). Implementation creates an array of length max+1.
    const countingSortPage = new CountingSortPage(page);

    await countingSortPage.enterNumbers('100, 3');
    await countingSortPage.clickSort();

    await expect(countingSortPage.output).toHaveText('Sorted Array: 3, 100');
    expect(pageErrors.length).toBe(0);
  });

  test('FSM onEnter verification: renderPage() is not implemented on the page (as per provided HTML)', async ({ page }) => {
    // The FSM listed an onEnter action renderPage() for S0_Idle.
    // The HTML does not define renderPage(), so verify it is undefined (we do not inject or modify globals).
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');
  });

  test('Observability: capture console messages and ensure no unexpected console errors during typical usage', async ({ page }) => {
    const countingSortPage = new CountingSortPage(page);

    // Clear any previously collected console messages
    consoleMessages.length = 0;

    // Perform a typical sort
    await countingSortPage.enterNumbers('1,4,2');
    await countingSortPage.clickSort();
    await expect(countingSortPage.output).toHaveText('Sorted Array: 1, 2, 4');

    // Inspect captured console messages for 'error' type
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0, `Unexpected console.error messages: ${JSON.stringify(consoleErrors)}`);
  });
});