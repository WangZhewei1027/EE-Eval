import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba98781-d5b2-11f0-b169-abe023d0d932.html';

/**
 * Page Object for the Linear Search app
 */
class LinearSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#search-input');
    this.button = page.locator('#search-button');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async fillInput(value) {
    await this.input.fill(value);
  }

  async clickSearch() {
    await this.button.click();
  }

  async getResultText() {
    return (await this.result.textContent()) ?? '';
  }

  async isInputVisible() {
    return await this.input.isVisible();
  }

  async isButtonVisible() {
    return await this.button.isVisible();
  }
}

test.describe('Linear Search FSM - 0ba98781-d5b2-11f0-b169-abe023d0d932', () => {
  // Arrays to collect console messages and page errors for each test.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      // capture type and text for richer assertions/debugging
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled page errors (e.g., ReferenceError, TypeError)
    page.on('pageerror', error => {
      // error is an Error object
      pageErrors.push(error);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach console and page errors to test results for debugging if available
    testInfo.attach('console-messages', {
      body: JSON.stringify(consoleMessages, null, 2),
      contentType: 'application/json',
    });
    testInfo.attach('page-errors', {
      body: JSON.stringify(
        pageErrors.map(e => ({ name: e.name, message: e.message, stack: e.stack })),
        null,
        2
      ),
      contentType: 'application/json',
    });
  });

  test('Initial Idle state (S0_Idle) renders input, button, and empty result', async ({ page }) => {
    // Validate initial render as per S0_Idle entry_actions: renderPage()
    const app = new LinearSearchPage(page);

    // Elements should be visible
    expect(await app.isInputVisible()).toBeTruthy();
    expect(await app.isButtonVisible()).toBeTruthy();

    // Placeholder text validation
    const placeholder = await page.locator('#search-input').getAttribute('placeholder');
    expect(placeholder).toBe('Enter the number to search for');

    // Result div should be empty initially
    const initialResult = await app.getResultText();
    expect(initialResult.trim()).toBe('');

    // Verify there are no console errors or uncaught page errors on initial load
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Searching with empty input transitions S1_Searching -> S2_NotFound (empty guard)', async ({ page }) => {
    // This validates transition where inputValue === '' resulting in message prompting user to enter a number
    const app = new LinearSearchPage(page);

    // Ensure input is empty
    await app.fillInput('');
    await app.clickSearch();

    // Expect the Not Found final state message for empty input per FSM
    const result = (await app.getResultText()).trim();
    expect(result).toBe('Please enter a number to search for.');

    // Confirm no console errors or page errors during this interaction
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Searching with a non-existent number transitions S1_Searching -> S2_NotFound (index === -1)', async ({ page }) => {
    // This validates the Not Found branch when the searched number is not present in the list
    const app = new LinearSearchPage(page);

    // Use a number not in the list (e.g., 42)
    await app.fillInput('42');
    await app.clickSearch();

    // Expect not found message with the input echoed
    const result = (await app.getResultText()).trim();
    expect(result).toBe('Number 42 not found in the list.');

    // Confirm no console errors or page errors during this interaction
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Searching with an existing number - attempt to reach S3_Found (this app contains a type mismatch bug)', async ({ page }) => {
    // The implementation stores numbers as actual numbers: [1,2,...]
    // The search reads input.value (a string) and uses indexOf(inputValue) -> will not match numbers.
    // This test documents that attempting to reach the Found state with a textual input fails and yields Not Found.
    const app = new LinearSearchPage(page);

    // Try to search for "5" which logically should exist at index 4
    await app.fillInput('5');
    await app.clickSearch();

    const result = (await app.getResultText()).trim();

    // According to the FSM, a successful search should set:
    // `Number ${inputValue} found at index ${index}.`
    // However, due to the implementation using indexOf with mixed types, index will be -1.
    // Assert actual behavior (not found) and note that Found state was not reached.
    expect(result).toBe('Number 5 not found in the list.');

    // For completeness, assert that the "found" message is not present
    expect(result).not.toMatch(/found at index/);

    // Ensure no console errors or page errors occurred during this attempt
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: whitespace-only input is trimmed and treated as empty (should show prompt)', async ({ page }) => {
    // This test verifies trimming behavior and the empty-guard transition
    const app = new LinearSearchPage(page);

    await app.fillInput('    ');
    await app.clickSearch();

    const result = (await app.getResultText()).trim();
    expect(result).toBe('Please enter a number to search for.');

    // No console errors or page errors expected
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observe console and page errors across interactions (assert none occurred)', async ({ page }) => {
    // This test performs a set of interactions and asserts that there are no unexpected runtime errors
    const app = new LinearSearchPage(page);

    // Sequence of interactions
    await app.fillInput('');
    await app.clickSearch();

    await app.fillInput('1000');
    await app.clickSearch();

    await app.fillInput('3');
    await app.clickSearch();

    // Collect any console error entries
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');

    // Attach first few console messages into test output for debugging context
    // (attachments are created in afterEach as well, but we keep assertions here)
    // Assert that there were no console errors or uncaught page errors during these flows
    expect(errorConsoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});