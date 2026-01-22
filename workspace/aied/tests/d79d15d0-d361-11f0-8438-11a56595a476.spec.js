import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79d15d0-d361-11f0-8438-11a56595a476.html';

// Page Object Model for the Linear Search Demo page
class LinearSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.searchBtn = page.locator('#searchBtn');
    this.resultDiv = page.locator('#result');
    this.container = page.locator('.container');
    this.header = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillArray(value) {
    await this.arrayInput.fill(value);
  }

  async fillTarget(value) {
    await this.targetInput.fill(value);
  }

  async clickSearch() {
    await this.searchBtn.click();
  }

  async getResultText() {
    return (await this.resultDiv.textContent()) ?? '';
  }

  async clearInputs() {
    await this.arrayInput.fill('');
    await this.targetInput.fill('');
  }
}

test.describe('Linear Search Demo - FSM Validation Tests', () => {
  // Collect console messages and page errors for assertion in teardown
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events to capture warnings/errors/info from the page
    page.on('console', (msg) => {
      // store type and text for assertions later
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test we assert that there are no unexpected runtime errors (ReferenceError, SyntaxError, TypeError)
    // The application provided should not be patched; we simply observe and assert.
    // Confirm no fatal page errors occurred during the test run
    expect(pageErrors.length).toBe(0);
    // Confirm there are no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Initial State (S0_Idle)', () => {
    test('renders main UI elements and initial state is Idle', async ({ page }) => {
      // Validate entry action of S0_Idle (renderPage() expectations)
      // We don't mutate the page; we assert DOM elements exist and are in initial state.
      const p = new LinearSearchPage(page);
      await p.goto();

      // Container and heading should be present (evidence of S0_Idle)
      await expect(p.container).toBeVisible();
      await expect(p.header).toHaveText('Linear Search Demonstration');

      // Inputs and button should be visible and empty
      await expect(p.arrayInput).toBeVisible();
      await expect(p.arrayInput).toHaveValue('');
      await expect(p.targetInput).toBeVisible();
      await expect(p.targetInput).toHaveValue('');
      await expect(p.searchBtn).toBeVisible();

      // Result div exists and is empty initially
      await expect(p.resultDiv).toBeVisible();
      const initialResult = await p.getResultText();
      expect(initialResult.trim()).toBe('');
    });
  });

  test.describe('Input Handling and Validation (S1_InputReceived -> InputValidationFailed)', () => {
    test('shows validation message when array input is empty', async ({ page }) => {
      // This validates the transition S1_InputReceived -> S3_ResultDisplayed via InputValidationFailed for empty array
      const p = new LinearSearchPage(page);
      await p.goto();

      // Ensure target has some value but array is empty
      await p.fillArray('');
      await p.fillTarget('8');

      // Click search to trigger validation
      await p.clickSearch();

      // Expect the validation message for missing array elements
      await expect(p.resultDiv).toHaveText('Please enter array elements.');
    });

    test('shows validation message when target input is empty', async ({ page }) => {
      // This validates the transition S1_InputReceived -> S3_ResultDisplayed via InputValidationFailed for empty target
      const p = new LinearSearchPage(page);
      await p.goto();

      // Provide array but leave target empty
      await p.fillArray('3, 5, 1, 8, 7');
      await p.fillTarget('');

      // Click search to trigger validation
      await p.clickSearch();

      // Expect the validation message for missing target value
      await expect(p.resultDiv).toHaveText('Please enter a target value.');
    });
  });

  test.describe('Searching Behavior (S1_InputReceived -> S2_Searching -> S3_ResultDisplayed)', () => {
    test('finds numeric target and displays detailed step log', async ({ page }) => {
      // This validates the successful path: inputs provided -> searching -> result displayed with found index
      const p = new LinearSearchPage(page);
      await p.goto();

      // Provide numeric array and numeric target
      await p.fillArray('3, 5, 1, 8, 7');
      await p.fillTarget('8');

      // Trigger search
      await p.clickSearch();

      // The result should include the starting message
      const text = await p.getResultText();
      expect(text).toContain('Starting linear search for target: 8');
      // Verify that step logs are present and include the check that found the target
      expect(text).toContain('Step 4: Check element at index 3, value = 8');
      expect(text).toContain('=> Target found at index 3.');
    });

    test('reports not found when target absent and includes full step log', async ({ page }) => {
      // This validates the path where target is not found and final log indicates not found
      const p = new LinearSearchPage(page);
      await p.goto();

      await p.fillArray('3, 5, 1, 8, 7');
      await p.fillTarget('10');

      await p.clickSearch();

      const text = await p.getResultText();
      expect(text).toContain('Starting linear search for target: 10');
      // Should have step logs for each element
      expect(text).toContain('Step 1: Check element at index 0, value = 3');
      expect(text).toContain('Step 5: Check element at index 4, value = 7');
      expect(text).toContain('=> Target not found in the array.');
    });

    test('performs string search when array elements are non-numeric', async ({ page }) => {
      // This validates type-agnostic searching for string targets
      const p = new LinearSearchPage(page);
      await p.goto();

      await p.fillArray('a, b, c, b');
      await p.fillTarget('b');

      await p.clickSearch();

      const text = await p.getResultText();
      expect(text).toContain('Starting linear search for target: "b"');
      // First occurrence of 'b' is index 1
      expect(text).toContain('Step 2: Check element at index 1, value = "b"');
      expect(text).toContain('=> Target found at index 1.');
    });

    test('handles arrays with extra spaces and empty entries gracefully', async ({ page }) => {
      // This validates parsing behavior: parseInputArray filters empty entries and trims spaces
      const p = new LinearSearchPage(page);
      await p.goto();

      // Include extra commas and spaces
      await p.fillArray('  3 , , 5,   9 , ');
      await p.fillTarget('9');

      await p.clickSearch();

      const text = await p.getResultText();
      // Expect log to show the trimmed/parsed values and find 9
      expect(text).toContain('Step 3: Check element at index 2, value = 9');
      expect(text).toContain('=> Target found at index 2.');
    });

    test('chooses numeric comparison when all inputs are numeric strings', async ({ page }) => {
      // If everything is numeric, the script coerces to Number and searches numerically
      const p = new LinearSearchPage(page);
      await p.goto();

      await p.fillArray('01, 1, 2');
      await p.fillTarget('1'); // numeric 1 should match the second element (value 1), not '01' as distinct string

      await p.clickSearch();

      const text = await p.getResultText();
      // After numeric conversion, '01' -> 1 and '1' -> 1; the script converts all with Number(), so first element leads to match
      // The implementation maps Number to all elements so index 0 should match
      expect(text).toContain('Step 1: Check element at index 0, value = 1');
      expect(text).toContain('=> Target found at index 0.');
    });
  });

  test.describe('Edge Cases & Robustness', () => {
    test('duplicate values: first occurrence is reported', async ({ page }) => {
      // Ensures that when duplicates exist, the first found index is reported as per linear search behavior
      const p = new LinearSearchPage(page);
      await p.goto();

      await p.fillArray('5, 5, 5');
      await p.fillTarget('5');

      await p.clickSearch();

      const text = await p.getResultText();
      expect(text).toContain('Step 1: Check element at index 0, value = 5');
      expect(text).toContain('=> Target found at index 0.');
      // Ensure later steps are not logged after the break (the implementation breaks on find)
      expect(text).not.toContain('Step 2: Check element at index 1, value = 5');
    });

    test('very large arrays produce logs (synthetic test, small for speed)', async ({ page }) => {
      // We won't actually create huge arrays to keep tests fast, but ensure that multiple steps are appended to the log.
      const p = new LinearSearchPage(page);
      await p.goto();

      const arr = Array.from({ length: 20 }, (_, i) => String(i)).join(', ');
      await p.fillArray(arr);
      await p.fillTarget('19');

      await p.clickSearch();

      const text = await p.getResultText();
      expect(text).toContain('Step 20: Check element at index 19, value = 19');
      expect(text).toContain('=> Target found at index 19.');
    });
  });
});