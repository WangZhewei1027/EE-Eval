import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba98782-d5b2-11f0-b169-abe023d0d932.html';

// Page Object encapsulating selectors and common interactions
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.searchInput = page.locator('#search-term');
    this.searchButton = page.locator('#search-btn');
    this.resultDiv = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillTerm(value) {
    // Use fill which clears the input first
    await this.searchInput.fill(value);
  }

  async clickSearch() {
    await this.searchButton.click();
  }

  async getResultText() {
    return (await this.resultDiv.textContent()) ?? '';
  }

  async getInputValue() {
    // get the raw value property (string)
    return await this.searchInput.inputValue();
  }
}

test.describe('Binary Search FSM - 0ba98782-d5b2-11f0-b169-abe023d0d932', () => {
  // Arrays to capture runtime errors and console error messages for each test
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture uncaught page errors (pageerror event)
    page.on('pageerror', (err) => {
      // store the error message for assertions later
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the application
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Ensure there were no uncaught exceptions or console errors during the test interactions.
    // This verifies that the page ran without runtime errors (ReferenceError, SyntaxError, TypeError, etc.)
    expect(pageErrors, 'No uncaught page errors').toEqual([]);
    expect(consoleErrors, 'No console error messages').toEqual([]);
  });

  test('Initial Idle State renders input, button and empty result', async ({ page }) => {
    // Validate S0_Idle initial rendering (renderPage() evidence)
    // - input #search-term exists and is empty
    // - button #search-btn exists
    // - result div #result exists and is empty
    const app = new BinarySearchPage(page);

    // Elements should be visible and present
    await expect(app.searchInput).toBeVisible();
    await expect(app.searchButton).toBeVisible();
    await expect(app.resultDiv).toBeVisible();

    // Input should be empty initially
    const initialValue = await app.getInputValue();
    expect(initialValue, 'Initial input should be empty string').toBe('');

    // Result div should be empty initially (Idle state evidence)
    const initialResult = await app.getResultText();
    expect(initialResult, 'Initial result div should be empty').toBe('');
  });

  test('Empty input transition -> S4_EmptyInput: clicking search with empty input shows prompt', async ({ page }) => {
    // This verifies the transition:
    // S0_Idle --(SearchClick)--> S1_Searching --guard term === ""--> S4_EmptyInput
    // And verifies resultDiv.textContent = 'Please enter a number'
    const app = new BinarySearchPage(page);

    // Ensure the input is empty (simulate user did not type anything)
    await app.fillTerm(''); // still empty
    await app.clickSearch();

    // After clicking with empty input, the app should show the prompt as per FSM S4_EmptyInput
    const resultText = (await app.getResultText()).trim();
    expect(resultText).toBe('Please enter a number');
  });

  test('Result Found transition -> S2_ResultFound: searching for 500 (mid) returns found', async ({ page }) => {
    // This verifies S1_Searching -> S2_ResultFound (Number found at index mid)
    // For the code low=1, high=1000, first mid = 500. Searching for 500 should be found immediately.
    const app = new BinarySearchPage(page);

    // Enter 500 and click search
    await app.fillTerm('500');
    // Sanity check: input returns string '500'
    const inputVal = await app.getInputValue();
    expect(inputVal).toBe('500');

    await app.clickSearch();

    // Expect the result text to indicate found at index 500
    const resultText = (await app.getResultText()).trim();
    expect(resultText).toBe('Number 500 found at index 500');
  });

  test('Result Not Found transition -> S3_ResultNotFound: searching for 1001 (outside range) returns not found', async ({ page }) => {
    // This verifies S1_Searching -> S3_ResultNotFound when the algorithm exhausts range (low > high)
    const app = new BinarySearchPage(page);

    // Enter 1001 (outside 1..1000) and click search
    await app.fillTerm('1001');
    await app.clickSearch();

    const resultText = (await app.getResultText()).trim();
    expect(resultText).toBe('Number 1001 not found');
  });

  test('Edge case: whitespace-only input treated as empty -> S4_EmptyInput', async ({ page }) => {
    // Input contained only whitespace should be trimmed and treated as empty
    // Expect 'Please enter a number'
    const app = new BinarySearchPage(page);

    // Fill spaces
    await app.fillTerm('   ');
    // Double-check the raw input value: inputValue returns empty string for type=number when non-numeric
    // Some browsers may normalize; we rely on the behavior that trimmed value becomes ''
    await app.clickSearch();

    const resultText = (await app.getResultText()).trim();
    expect(resultText).toBe('Please enter a number');
  });

  test('Edge case: lower bound 1 is found and upper bound 1000 is found', async ({ page }) => {
    // Verify that the algorithm can find boundary values (1 and 1000)
    const app = new BinarySearchPage(page);

    // Test lower bound 1
    await app.fillTerm('1');
    await app.clickSearch();
    let resultText = (await app.getResultText()).trim();
    expect(resultText).toBe('Number 1 found at index 1');

    // Test upper bound 1000
    await app.fillTerm('1000');
    await app.clickSearch();
    resultText = (await app.getResultText()).trim();
    expect(resultText).toBe('Number 1000 found at index 1000');
  });

  test('Repeated clicks and behaviors: clicking search repeatedly with same value remains deterministic', async ({ page }) => {
    // Verify stability across multiple clicks: same input repeated produces same result and no errors
    const app = new BinarySearchPage(page);

    // Use a number that will be found after several iterations, e.g., 123
    await app.fillTerm('123');

    // Click multiple times
    for (let i = 0; i < 3; i++) {
      await app.clickSearch();
      const resultText = (await app.getResultText()).trim();
      // Should always either find or not find consistently; for 123 it should be found
      expect(resultText).toBe('Number 123 found at index 123');
    }
  });

  test('Verifies that the search button click handler is wired: clicking the button triggers DOM updates', async ({ page }) => {
    // This test validates the event wiring evidence: "searchBtn.addEventListener('click', search);"
    // We infer wiring by checking that clicking the button causes the search behavior to run.
    const app = new BinarySearchPage(page);

    // Use a known value that will lead to 'not found' to ensure the click triggers the algorithm path
    await app.fillTerm('0'); // 0 is out of range -> not found
    await app.clickSearch();

    const resultText = (await app.getResultText()).trim();
    expect(resultText).toBe('Number 0 not found');
  });
});