import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122bd7f2-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Ternary Search app
class TernarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#ternary-search-input');
    this.searchButton = page.locator('#ternary-search-button');
    this.clearButton = page.locator('#ternary-search-clear');
    this.resultsContainer = page.locator('#ternary-search-results');
    this.resultRows = page.locator('#ternary-search-results .ternary-search-result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async enterSearchValue(value) {
    // Use fill to simulate user entering a value
    await this.input.fill(String(value));
  }

  async clickSearch() {
    await this.searchButton.click();
  }

  async clickClear() {
    await this.clearButton.click();
  }

  async getResultCount() {
    return await this.resultRows.count();
  }

  async getFirstResultText() {
    if ((await this.getResultCount()) === 0) return '';
    return await this.resultRows.first().innerText();
  }

  async isInputPresent() {
    return await this.input.count() === 1;
  }

  async isSearchButtonPresent() {
    return await this.searchButton.count() === 1;
  }

  async isClearButtonPresent() {
    return await this.clearButton.count() === 1;
  }
}

test.describe('Ternary Search FSM tests (Application ID: 122bd7f2-fa7b-11f0-814c-dbec508f0b3b)', () => {
  /** Collect console messages and page errors for each test to assert on them */
  test.beforeEach(async ({ page }) => {
    // No-op here; individual tests set up listeners so they can assert per-test
  });

  test('S0_Idle - Initial state: elements present and results empty', async ({ page }) => {
    // Collect console and page errors for this test
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new TernarySearchPage(page);
    await app.goto();

    // Validate presence of input and buttons per FSM S0_Idle evidence
    expect(await app.isInputPresent()).toBeTruthy();
    expect(await app.isSearchButtonPresent()).toBeTruthy();
    expect(await app.isClearButtonPresent()).toBeTruthy();

    // Results container should be present and initially empty
    await expect(app.resultsContainer).toBeVisible();
    expect(await app.getResultCount()).toBe(0);

    // No page errors or console errors should have occurred during initial load
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMsgs.filter(m => m.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('S1_Searching - Clicking Search with empty input should not populate results and should not throw', async ({ page }) => {
    // Collect console and page errors for this test
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new TernarySearchPage(page);
    await app.goto();

    // Ensure input is empty
    await app.enterSearchValue('');
    // Click search button - per FSM transition from S0_Idle to S1_Searching, but searchTernary should return early
    await app.clickSearch();

    // Expect no results (searchValue === '' branch returns early)
    expect(await app.getResultCount()).toBe(0);

    // No errors should have been thrown on the page
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMsgs.filter(m => m.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('S1_Searching -> S0_Idle transition: clicking Search with valid number populates results (1000) and is displayed', async ({ page }) => {
    // This test validates the entry action searchTernary() produces ternarySearchResults and displayTernarySearchResults()
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new TernarySearchPage(page);
    await app.goto();

    // Enter a numeric value and click search
    await app.enterSearchValue(42);
    await app.clickSearch();

    // The implementation creates 10*10*10 = 1000 results synchronously; wait/poll until they appear
    await expect.poll(async () => await app.getResultCount(), {
      timeout: 2000,
      interval: 50
    }).toBe(1000);

    // Verify first result contains the search value string "42" and format "i j k value"
    const firstText = await app.getFirstResultText();
    expect(firstText).toContain('42');

    // No page errors or console errors should have occurred during a normal search
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMsgs.filter(m => m.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('S1_Searching to S0_Idle via ClearButtonClick: Clear clears ternarySearchResults and UI', async ({ page }) {
    // This test validates that clearTernarySearch() empties the results and display
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new TernarySearchPage(page);
    await app.goto();

    // Produce results first
    await app.enterSearchValue(7);
    await app.clickSearch();
    await expect.poll(async () => await app.getResultCount(), { timeout: 2000, interval: 50 }).toBe(1000);

    // Now click clear to trigger clearTernarySearch()
    await app.clickClear();

    // Expect results to be cleared (ternarySearchResults = []; displayTernarySearchResults();)
    await expect.poll(async () => await app.getResultCount(), { timeout: 1000, interval: 50 }).toBe(0);

    // Clicking clear again when already cleared should keep it empty (S2_Cleared -> S0_Idle transition and idempotence)
    await app.clickClear();
    expect(await app.getResultCount()).toBe(0);

    // No unexpected runtime errors
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMsgs.filter(m => m.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('S2_Cleared -> S0_Idle: clicking Clear when already cleared remains stable and does not error', async ({ page }) => {
    // Validate the cleared state and idempotent clear behavior
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new TernarySearchPage(page);
    await app.goto();

    // Ensure initial state is cleared (no results)
    expect(await app.getResultCount()).toBe(0);

    // Click clear once (should be safe)
    await app.clickClear();
    expect(await app.getResultCount()).toBe(0);

    // Click clear again (transition S2_Cleared -> S0_Idle per FSM); still safe
    await app.clickClear();
    expect(await app.getResultCount()).toBe(0);

    // Ensure no JS runtime exceptions occurred
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMsgs.filter(m => m.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Edge cases and robustness: large numeric input, and verify sorting uses string localeCompare without throwing', async ({ page }) => {
    // This test stresses the search with different numeric input values and inspects behavior
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new TernarySearchPage(page);
    await app.goto();

    // Use a multi-digit number to confirm sorting behavior and no errors
    await app.enterSearchValue(12345678901234567890n.toString()); // big number as string
    await app.clickSearch();

    // Should still create 1000 results and not throw
    await expect.poll(async () => await app.getResultCount(), { timeout: 3000, interval: 50 }).toBe(1000);
    const first = await app.getFirstResultText();
    expect(first).toContain('12345678901234567890');

    // Clear after test
    await app.clickClear();
    expect(await app.getResultCount()).toBe(0);

    // Assert no ReferenceError/SyntaxError/TypeError in console or page errors
    expect(pageErrors.length).toBe(0);
    const criticalErrors = consoleMsgs.filter(m => /ReferenceError|SyntaxError|TypeError/.test(m.text));
    expect(criticalErrors.length).toBe(0);
  });

  test('Observe console logs and page errors across typical user flows (assert none of the critical errors occurred)', async ({ page }) => {
    // This test explicitly collects console and pageerror events across multiple interactions and asserts absence of JS errors
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const app = new TernarySearchPage(page);
    await app.goto();

    // Sequence of interactions: empty search, valid search, clear, clear again
    await app.enterSearchValue('');
    await app.clickSearch();
    await app.enterSearchValue(5);
    await app.clickSearch();
    await expect.poll(async () => await app.getResultCount(), { timeout: 2000, interval: 50 }).toBe(1000);
    await app.clickClear();
    expect(await app.getResultCount()).toBe(0);
    await app.clickClear();
    expect(await app.getResultCount()).toBe(0);

    // Collect any console errors or page errors
    // We expect zero page errors and no console messages containing the words ReferenceError, SyntaxError or TypeError
    expect(pageErrors.length).toBe(0);

    const problematic = consoleMsgs.filter(m => /ReferenceError|SyntaxError|TypeError/.test(m.text) || m.type === 'error');
    expect(problematic.length).toBe(0);
  });
});