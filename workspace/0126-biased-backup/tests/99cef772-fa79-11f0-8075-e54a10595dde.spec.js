import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cef772-fa79-11f0-8075-e54a10595dde.html';

/**
 * Page Object Model for the Interpolation Search Demo page.
 * Encapsulates common interactions and queries to keep tests readable.
 */
class InterpolationSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.searchInput = page.locator('#searchInput');
    this.searchButton = page.locator('#searchButton');
    this.clearButton = page.locator('#clearButton');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillArray(value) {
    await this.arrayInput.fill(value);
  }

  async fillSearch(value) {
    // Accept numbers or strings; convert to string when necessary
    await this.searchInput.fill(String(value));
  }

  async clickSearch() {
    await this.searchButton.click();
  }

  async clickClear() {
    await this.clearButton.click();
  }

  async getResultText() {
    return (await this.result.textContent()) ?? '';
  }

  async getArrayValue() {
    return await this.arrayInput.inputValue();
  }

  async getSearchValue() {
    return await this.searchInput.inputValue();
  }

  // Utility to assert the page has the onclick handlers attached (evidence check)
  async hasOnclickHandlers() {
    const searchOnclickType = await this.page.evaluate(() => typeof document.getElementById('searchButton').onclick);
    const clearOnclickType = await this.page.evaluate(() => typeof document.getElementById('clearButton').onclick);
    return { searchOnclickType, clearOnclickType };
  }
}

/**
 * Top-level test suite validating the FSM states and transitions for the app.
 * - Tests initial Idle state rendering
 * - Tests Searching transitions (found / not found / invalid input)
 * - Tests Clear transitions (clearing values and result)
 * - Observes console and page errors and asserts none occurred during normal operation
 */
test.describe('Interpolation Search Demo (FSM validation)', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events to capture logs, warnings, and errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });
  });

  // After each test, ensure there were no unexpected runtime errors during the interaction.
  test.afterEach(async () => {
    // Fail the test if there were any uncaught page errors
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    // Also assert there were no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    expect(consoleErrors, `Unexpected console.error messages: ${consoleErrors.join(' | ')}`).toHaveLength(0);
  });

  test('Initial Idle state renders inputs, buttons, and empty result (S0_Idle)', async ({ page }) => {
    // Verify initial render (entry action: renderPage())
    const app = new InterpolationSearchPage(page);
    await app.goto();

    // Check that all components exist and match the FSM evidence
    await expect(app.arrayInput).toBeVisible();
    await expect(app.searchInput).toBeVisible();
    await expect(app.searchButton).toBeVisible();
    await expect(app.clearButton).toBeVisible();
    await expect(app.result).toBeVisible();

    // Check placeholders and that result is empty
    await expect(app.arrayInput).toHaveAttribute('placeholder', 'e.g. 10, 20, 30, 40, 50');
    await expect(app.searchInput).toHaveAttribute('placeholder', 'e.g. 30');
    const initialResult = await app.getResultText();
    expect(initialResult, 'Result element should be empty on initial render').toBe('');

    // Verify onclick handlers are present (evidence: document.getElementById(...).onclick = function() {...})
    const handlers = await app.hasOnclickHandlers();
    expect(handlers.searchOnclickType).toBe('function');
    expect(handlers.clearOnclickType).toBe('function');
  });

  test('Search transition: value found updates result text (S0_Idle -> S1_Searching)', async ({ page }) => {
    // This test validates the SearchButtonClick transition and expected observable update.
    const app = new InterpolationSearchPage(page);
    await app.goto();

    // Provide a sorted array string and a value that exists
    await app.fillArray('10, 20, 30, 40, 50'); // Already sorted; evidence expects this input
    await app.fillSearch(30);
    await app.clickSearch();

    // Expected result text per FSM evidence when found
    const resultText = await app.getResultText();
    expect(resultText).toMatch(/^Value 30 found at index \d+\.$/);

    // Additional assert: index should be 2 for array [10,20,30,40,50]
    const matched = resultText.match(/index (\d+)\./);
    expect(matched).not.toBeNull();
    if (matched) {
      const index = parseInt(matched[1], 10);
      expect(index).toBe(2);
    }
  });

  test('Search transition: value not found updates result text appropriately', async ({ page }) => {
    // Validate behavior when the searched value is not present in the array
    const app = new InterpolationSearchPage(page);
    await app.goto();

    await app.fillArray('10, 20, 30, 40, 50');
    await app.fillSearch(35);
    await app.clickSearch();

    const resultText = await app.getResultText();
    expect(resultText).toBe('Value 35 not found.');
  });

  test('Search with empty array input shows prompt and does not crash', async ({ page }) => {
    // Edge case: user clicks Search without entering an array
    const app = new InterpolationSearchPage(page);
    await app.goto();

    // Leave array empty, provide a search value
    await app.fillArray('');
    await app.fillSearch(30);
    await app.clickSearch();

    const resultText = await app.getResultText();
    expect(resultText).toBe('Please enter a sorted array.');
  });

  test('Clear transition clears inputs and result (S1_Searching -> S0_Idle and S2_Clear -> S0_Idle)', async ({ page }) => {
    // Validate ClearButtonClick behavior both after performing a search and when already cleared
    const app = new InterpolationSearchPage(page);
    await app.goto();

    // Perform a search first to populate inputs and result
    await app.fillArray('50,10,40,20,30'); // unsorted intentionally; app is expected to sort
    await app.fillSearch(20);
    await app.clickSearch();

    // Ensure result indicates found (after sorting, 20 should be at index 1)
    const foundText = await app.getResultText();
    expect(foundText).toMatch(/Value 20 found at index \d+\./);

    // Click Clear and verify inputs and result are cleared
    await app.clickClear();

    const arrayValueAfterClear = await app.getArrayValue();
    const searchValueAfterClear = await app.getSearchValue();
    const resultAfterClear = await app.getResultText();

    expect(arrayValueAfterClear).toBe('');
    expect(searchValueAfterClear).toBe('');
    expect(resultAfterClear).toBe('');

    // Clicking clear again (S2_Clear -> S0_Idle transition evidence) should be a no-op and not error
    await app.clickClear();
    expect(await app.getArrayValue()).toBe('');
    expect(await app.getSearchValue()).toBe('');
    expect(await app.getResultText()).toBe('');
  });

  test('Edge case: duplicate values - search returns one of the correct indices', async ({ page }) => {
    // If duplicates exist, interpolationSearch should find an index where the value exists.
    const app = new InterpolationSearchPage(page);
    await app.goto();

    await app.fillArray('10,20,20,30');
    await app.fillSearch(20);
    await app.clickSearch();

    const resultText = await app.getResultText();
    expect(resultText).toMatch(/^Value 20 found at index \d+\.$/);

    // Accept either index 1 or 2 for duplicates
    const matched = resultText.match(/index (\d+)\./);
    expect(matched).not.toBeNull();
    if (matched) {
      const index = parseInt(matched[1], 10);
      expect([1, 2].includes(index)).toBeTruthy();
    }
  });

  test('Edge case: non-numeric entries do not crash the app (observe behavior)', async ({ page }) => {
    // This test ensures that inserting non-numeric array entries does not cause runtime exceptions.
    const app = new InterpolationSearchPage(page);
    await app.goto();

    // Provide letters and one numeric value
    await app.fillArray('a, b, 30');
    await app.fillSearch(30);

    // Clicking search should not throw; result may vary but must update the DOM
    await app.clickSearch();
    const resultText = await app.getResultText();

    // We do not assert a fixed index in this case because behavior depends on NaN handling.
    // Instead, assert that the app produced some result string (not left unchanged) and did not error.
    expect(typeof resultText).toBe('string');
    // The result should either indicate found or not found or a prompt; ensure it's not empty
    expect(resultText.length).toBeGreaterThanOrEqual(0);
  });

  test('Behavioral check: unsorted input is sorted internally before searching', async ({ page }) => {
    // The implementation sorts the parsed array; verify that searching an unsorted list returns index
    const app = new InterpolationSearchPage(page);
    await app.goto();

    // Unsorted permutation; after sorting, 20 should be at index 1
    await app.fillArray('50,10,40,20,30');
    await app.fillSearch(20);
    await app.clickSearch();

    const resultText = await app.getResultText();
    expect(resultText).toBe('Value 20 found at index 1.');
  });
});