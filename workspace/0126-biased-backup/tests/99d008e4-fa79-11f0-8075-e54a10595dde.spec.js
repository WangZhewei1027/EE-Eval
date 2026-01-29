import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d008e4-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Interactive SQL Explorer
class SQLExplorerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      query: '#query',
      executeBtn: "button[onclick='executeQuery()']",
      filter: '#filter',
      applyFilterBtn: "button[onclick='applyFilter()']",
      sort: '#sort',
      applySortBtn: "button[onclick='applySort()']",
      limit: '#limit',
      applyLimitBtn: "button[onclick='applyLimit()']",
      resetBtn: "button[onclick='resetFilters()']",
      output: '#output'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setQuery(text) {
    await this.page.fill(this.selectors.query, text);
  }

  async clickExecute() {
    await this.page.click(this.selectors.executeBtn);
  }

  async setFilter(text) {
    await this.page.fill(this.selectors.filter, text);
  }

  async clickApplyFilter() {
    await this.page.click(this.selectors.applyFilterBtn);
  }

  async setSort(text) {
    await this.page.fill(this.selectors.sort, text);
  }

  async clickApplySort() {
    await this.page.click(this.selectors.applySortBtn);
  }

  async setLimit(value) {
    await this.page.fill(this.selectors.limit, String(value));
  }

  async clickApplyLimit() {
    await this.page.click(this.selectors.applyLimitBtn);
  }

  async clickReset() {
    await this.page.click(this.selectors.resetBtn);
  }

  async getOutputText() {
    return this.page.textContent(this.selectors.output);
  }

  async getOutputJson() {
    const text = (await this.getOutputText()) || '';
    try {
      return JSON.parse(text);
    } catch {
      // If output isn't valid JSON return null to let tests assert accordingly
      return null;
    }
  }

  async getGlobalVar(varName) {
    return this.page.evaluate((name) => {
      // intentionally read global variables that exist in the page script
      return window[name];
    }, varName);
  }
}

// Helper to attach listeners to collect console messages and page errors
function attachLoggingListeners(page) {
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', (err) => {
    // Capture the error message string for assertions
    pageErrors.push(err.message);
  });

  return { consoleMessages, pageErrors };
}

test.describe('Interactive SQL Explorer - FSM states and transitions', () => {
  // Test the Idle state and that the base UI renders as expected.
  test('Idle state (S0_Idle) - initial render shows inputs and buttons', async ({ page }) => {
    // Attach listeners to observe console and runtime errors
    const { consoleMessages, pageErrors } = attachLoggingListeners(page);

    const app = new SQLExplorerPage(page);
    await app.goto();

    // Validate that main components are present and have expected placeholders / labels
    await expect(page.locator(app.selectors.query)).toBeVisible();
    await expect(page.locator(app.selectors.query)).toHaveAttribute('placeholder', 'SELECT * FROM table_name');

    await expect(page.locator(app.selectors.executeBtn)).toBeVisible();
    await expect(page.locator(app.selectors.filter)).toBeVisible();
    await expect(page.locator(app.selectors.filter)).toHaveAttribute('placeholder', 'e.g., column_name=value');

    await expect(page.locator(app.selectors.sort)).toBeVisible();
    await expect(page.locator(app.selectors.sort)).toHaveAttribute('placeholder', 'e.g., column_name ASC|DESC');

    await expect(page.locator(app.selectors.limit)).toBeVisible();
    await expect(page.locator(app.selectors.limit)).toHaveAttribute('placeholder', 'e.g., 10');

    await expect(page.locator(app.selectors.resetBtn)).toBeVisible();
    await expect(page.locator(app.selectors.output)).toBeVisible();

    // On initial load there should be no runtime errors emitted by the page
    expect(pageErrors.length).toBe(0);
    // Also expect no console error messages
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  // Full chain: Execute -> ApplyFilter -> ApplySort -> ApplyLimit -> Reset
  test('Full transition chain: ExecuteQuery -> ApplyFilter -> ApplySort -> ApplyLimit -> ResetFilters', async ({ page }) => {
    // This test validates the sequence of FSM transitions S0 -> S1 -> S2 -> S3 -> S4 -> S5
    const { consoleMessages, pageErrors } = attachLoggingListeners(page);
    const app = new SQLExplorerPage(page);
    await app.goto();

    // 1) Execute Query (S0 -> S1)
    // Set a non-empty query so updateOutput will render filteredData (initially full database)
    await app.setQuery('SELECT * FROM users');
    await app.clickExecute();

    // After executing, updateOutput should set the output to the current filteredData (which is full database)
    const outputAfterExecute = await app.getOutputJson();
    expect(Array.isArray(outputAfterExecute)).toBeTruthy();
    // Expect the database to include the four predefined names
    const names = outputAfterExecute.map(r => r.name).sort();
    expect(names).toEqual(['Alice', 'Bob', 'Charlie', 'David']);

    // Check the global variable currentQuery was updated (onEnter action)
    const currentQuery = await app.getGlobalVar('currentQuery');
    expect(currentQuery).toBe('SELECT * FROM users');

    // 2) Apply Filter (S1 -> S2)
    // Filter to age=35 -> should leave only Charlie
    await app.setFilter('age=35');
    await app.clickApplyFilter();

    const outputAfterFilter = await app.getOutputJson();
    expect(Array.isArray(outputAfterFilter)).toBeTruthy();
    expect(outputAfterFilter.length).toBe(1);
    expect(outputAfterFilter[0].name).toBe('Charlie');

    // Ensure filteredData global has length 1
    const filteredDataAfterFilter = await app.getGlobalVar('filteredData');
    expect(Array.isArray(filteredDataAfterFilter)).toBeTruthy();
    expect(filteredDataAfterFilter.length).toBe(1);
    expect(filteredDataAfterFilter[0].name).toBe('Charlie');

    // 3) Apply Sort (S2 -> S3)
    // Sorting a single-item set should not change results, but it should execute without errors
    await app.setSort('age DESC');
    await app.clickApplySort();

    const outputAfterSort = await app.getOutputJson();
    expect(Array.isArray(outputAfterSort)).toBeTruthy();
    expect(outputAfterSort.length).toBe(1);
    expect(outputAfterSort[0].name).toBe('Charlie');

    // 4) Apply Limit (S3 -> S4)
    // Set limit to 1 - since we only have one record in filteredData, result remains same
    await app.setLimit(1);
    await app.clickApplyLimit();

    const outputAfterLimit = await app.getOutputJson();
    expect(Array.isArray(outputAfterLimit)).toBeTruthy();
    expect(outputAfterLimit.length).toBe(1);
    expect(outputAfterLimit[0].name).toBe('Charlie');

    // Check limit global variable set
    const limitValue = await app.getGlobalVar('limit');
    expect(limitValue).toBe(1);

    // 5) Reset Filters (S4 -> S5)
    await app.clickReset();

    // After reset, filteredData should be full database, limit null, currentQuery empty, inputs cleared, and output shows original database
    const filteredAfterReset = await app.getGlobalVar('filteredData');
    expect(Array.isArray(filteredAfterReset)).toBeTruthy();
    expect(filteredAfterReset.length).toBe(4);

    const limitAfterReset = await app.getGlobalVar('limit');
    expect(limitAfterReset === null).toBeTruthy();

    const currentQueryAfterReset = await app.getGlobalVar('currentQuery');
    expect(currentQueryAfterReset).toBe('');

    // Inputs should be cleared
    await expect(page.locator(app.selectors.filter)).toHaveValue('');
    await expect(page.locator(app.selectors.sort)).toHaveValue('');
    await expect(page.locator(app.selectors.limit)).toHaveValue('');

    // Output should show original database (because currentQuery is empty -> updateOutput uses database)
    const outputAfterReset = await app.getOutputJson();
    expect(Array.isArray(outputAfterReset)).toBeTruthy();
    const resetNames = outputAfterReset.map(r => r.name).sort();
    expect(resetNames).toEqual(['Alice', 'Bob', 'Charlie', 'David']);

    // Throughout the happy path no runtime page errors should have been emitted
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  // Edge case: malformed filter input (missing '=') should naturally produce a runtime TypeError
  test('Edge case: ApplyFilter with malformed input (no "=") should produce a runtime error', async ({ page }) => {
    // We intentionally trigger the known failure mode in applyFilter:
    // filterString.split('=') yields undefined for value, then value.trim() throws TypeError.
    const { consoleMessages, pageErrors } = attachLoggingListeners(page);
    const app = new SQLExplorerPage(page);
    await app.goto();

    // Provide malformed filter
    await app.setFilter('invalidfilter-without-equals');

    // Wait for the pageerror event triggered by the click that causes value.trim() on undefined.
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      app.clickApplyFilter()
    ]);

    // Ensure we captured at least one page error and that it mentions 'trim' or 'undefined'
    expect(err).toBeTruthy();
    const message = err.message || '';
    expect(message.toLowerCase()).toMatch(/trim|undefined|cannot read/);

    // Our pageErrors listener should also have recorded it
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    expect(pageErrors.some(m => /trim|undefined|cannot read/i.test(m))).toBeTruthy();

    // The console should have an 'error' entry as well (depending on browser/runtime)
    const hadConsoleError = consoleMessages.some(m => m.type === 'error' || /trim|undefined|cannot read/i.test(m.text));
    expect(hadConsoleError).toBeTruthy();
  });

  // Edge case: applySort with empty input should produce a runtime error (order is undefined -> order.trim() throws)
  test('Edge case: ApplySort with empty input triggers runtime error', async ({ page }) => {
    const { consoleMessages, pageErrors } = attachLoggingListeners(page);
    const app = new SQLExplorerPage(page);
    await app.goto();

    // Ensure sort input is empty
    await app.setSort('');

    // Clicking applySort will run code that expects "order" to be defined and call order.trim()
    // This should trigger a pageerror; use waitForEvent to catch it deterministically
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      app.clickApplySort()
    ]);

    expect(err).toBeTruthy();
    const message = err.message || '';
    expect(message.toLowerCase()).toMatch(/trim|undefined|cannot read/);

    // Ensure our listener collected the error
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    expect(pageErrors.some(m => /trim|undefined|cannot read/i.test(m))).toBeTruthy();

    // Also expect a console error present
    const hadConsoleError = consoleMessages.some(m => m.type === 'error' || /trim|undefined|cannot read/i.test(m.text));
    expect(hadConsoleError).toBeTruthy();
  });

  // Additional sanity tests: assert that applyLimit with invalid number results in NaN limit but does not throw
  test('ApplyLimit with non-numeric input results in NaN limit (graceful handling, no runtime error)', async ({ page }) => {
    const { consoleMessages, pageErrors } = attachLoggingListeners(page);
    const app = new SQLExplorerPage(page);
    await app.goto();

    // Set a query so updateOutput will consider filteredData if currentQuery is set
    await app.setQuery('SELECT * FROM users');
    await app.clickExecute();

    // Provide a non-numeric limit (e.g., 'abc') - parseInt('abc') -> NaN
    await app.setLimit('abc');

    // Clicking applyLimit should not throw; instead limit becomes NaN and updateOutput will treat it falsy
    await app.clickApplyLimit();

    // Check the global 'limit' is NaN
    const limitValue = await app.getGlobalVar('limit');
    expect(Number.isNaN(limitValue)).toBeTruthy();

    // Output should be unaffected (since if (limit) falsey -> no slicing). Because currentQuery is non-empty, it shows filteredData (full DB)
    const output = await app.getOutputJson();
    expect(Array.isArray(output)).toBeTruthy();
    expect(output.length).toBe(4);

    // No runtime errors expected for this path
    expect(pageErrors.length).toBe(0);
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });
});