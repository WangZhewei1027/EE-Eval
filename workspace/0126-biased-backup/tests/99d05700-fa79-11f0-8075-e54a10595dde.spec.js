import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d05700-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Query Optimization Simulator
class QuerySimulatorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectTable = page.locator('#select-table');
    this.filtersInput = page.locator('#filters');
    this.addFilterButton = page.locator('#add-filter');
    this.sortOrder = page.locator('#sort-order');
    this.limitInput = page.locator('#limit');
    this.executeButton = page.locator('#execute-query');
    this.results = page.locator('#results');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the page loaded main elements
    await expect(this.addFilterButton).toBeVisible();
    await expect(this.executeButton).toBeVisible();
  }

  async addFilter(text) {
    await this.filtersInput.fill(text);
    await this.addFilterButton.click();
  }

  async executeQuery() {
    await this.executeButton.click();
  }

  async setTable(value) {
    await this.selectTable.selectOption(value);
  }

  async setSortOrder(value) {
    await this.sortOrder.selectOption(value);
  }

  async setLimit(value) {
    // Use evaluate to set the raw value to cover number and empty values robustly
    await this.page.evaluate((v) => {
      document.getElementById('limit').value = v;
    }, String(value));
  }

  async getFiltersArray() {
    // filters is declared as a global let variable in the page script
    return await this.page.evaluate(() => {
      try {
        return Array.isArray(filters) ? filters.slice() : null;
      } catch (e) {
        return { __error__: e.toString() };
      }
    });
  }

  async isResultsVisible() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('results');
      return el && !el.classList.contains('hidden');
    });
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async getFiltersInputValue() {
    return await this.filtersInput.inputValue();
  }

  async renderPageExists() {
    return await this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }
}

// Helper to collect console messages and page errors
async function collectRuntimeLogs(page) {
  const consoleMessages = [];
  const pageErrors = [];

  page.on('console', (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });

  page.on('pageerror', (err) => {
    pageErrors.push(err);
  });

  return { consoleMessages, pageErrors };
}

test.describe('Query Optimization Simulator - FSM validation (App ID: 99d05700-fa79-11f0-8075-e54a10595dde)', () => {
  // Validate initial idle state and absence/presence of runtime errors
  test('Initial State (S0_Idle): page renders, Execute button exists, results hidden, global filters present', async ({ page }) => {
    const { consoleMessages, pageErrors } = await collectRuntimeLogs(page);
    const app = new QuerySimulatorPage(page);
    await app.goto();

    // Verify the execute button exists (evidence of S0_Idle)
    await expect(page.locator('#execute-query')).toBeVisible();

    // Results should be hidden on initial load (class 'hidden' present)
    await expect(page.locator('#results')).toHaveClass(/hidden/);

    // The global filters array should exist and be an empty array
    const filters = await app.getFiltersArray();
    expect(filters).not.toBeNull();
    expect(Array.isArray(filters)).toBe(true);
    expect(filters.length).toBe(0);

    // The FSM metadata expected an entry action renderPage(), but the implementation does not define it.
    // Confirm the function is not present on window (this validates presence/absence of onEnter actions).
    const hasRenderPage = await app.renderPageExists();
    // We assert that renderPage is not defined (so we correctly observe implementation divergence).
    expect(hasRenderPage).toBe(false);

    // No unexpected runtime errors should have occurred during page load
    expect(pageErrors.length).toBe(0);
    // Ensure no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Transitions and interactions', () => {
    test('Transition S0 -> S1 (AddFilterClick): adding a filter updates filters array and clears input and updates output', async ({ page }) => {
      const { consoleMessages, pageErrors } = await collectRuntimeLogs(page);
      const app = new QuerySimulatorPage(page);
      await app.goto();

      // Add a filter and verify FSM transition effects
      await app.addFilter('age>30');

      // filters array updated
      const filtersAfter = await app.getFiltersArray();
      expect(filtersAfter).toEqual(['age>30']);

      // filter input cleared
      const inputValue = await app.getFiltersInputValue();
      expect(inputValue).toBe('');

      // output updated (updateOutput() is expected to have run)
      const out = await app.getOutputText();
      // Must contain the WHERE clause with the filter
      expect(out).toContain('WHERE age>30');

      // Results section should still be hidden (query not yet executed)
      expect(await app.isResultsVisible()).toBe(false);

      // Confirm no runtime page errors occurred
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Add multiple filters -> output includes filters joined by AND', async ({ page }) => {
      const { consoleMessages, pageErrors } = await collectRuntimeLogs(page);
      const app = new QuerySimulatorPage(page);
      await app.goto();

      // Add first filter
      await app.addFilter('age>30');
      // Add second filter
      await app.addFilter('status=\'active\'');

      // filters array should contain both in order
      const filtersAfter = await app.getFiltersArray();
      expect(filtersAfter).toEqual(['age>30', "status='active'"]);

      // Output should include both filters joined by AND
      const out = await app.getOutputText();
      expect(out).toContain('WHERE age>30 AND status=\'active\'');

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Transition S1 -> S2 (ExecuteQueryClick): executing query displays output and reveals results', async ({ page }) => {
      const { consoleMessages, pageErrors } = await collectRuntimeLogs(page);
      const app = new QuerySimulatorPage(page);
      await app.goto();

      // Prepare UI: set table, sort order, limit and add a filter
      await app.setTable('orders');
      await app.setSortOrder('desc');
      await app.setLimit(5);
      await app.addFilter('total>100');

      // Click execute and verify the results become visible and output matches expected SQL
      await app.executeQuery();

      // Compose expected query string exactly as implementation does
      const expectedQuery = `SELECT * FROM orders WHERE total>100 ORDER BY id desc LIMIT 5;`;

      // Output text
      const out = await app.getOutputText();
      expect(out.trim()).toBe(expectedQuery);

      // Results visible (class 'hidden' removed)
      expect(await app.isResultsVisible()).toBe(true);

      // No runtime errors during the interaction
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Clicking Add Filter with empty input should not add a filter or change output', async ({ page }) => {
      const { consoleMessages, pageErrors } = await collectRuntimeLogs(page);
      const app = new QuerySimulatorPage(page);
      await app.goto();

      // Ensure starting filters are empty
      let initialFilters = await app.getFiltersArray();
      expect(initialFilters.length).toBe(0);

      // Click add filter with empty input
      await app.addFilter(''); // fill with empty then click

      // Filters should remain unchanged
      const filtersAfter = await app.getFiltersArray();
      expect(filtersAfter.length).toBe(0);

      // Output should remain default SELECT ... WHERE  ORDER BY ... with empty WHERE content
      const out = await app.getOutputText();
      expect(out).toContain('WHERE '); // implementation always includes WHERE even if empty string is joined

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Execute query with unusual limit values (empty and negative) - observe behavior', async ({ page }) => {
      const { consoleMessages, pageErrors } = await collectRuntimeLogs(page);
      const app = new QuerySimulatorPage(page);
      await app.goto();

      // Add a filter so WHERE clause is populated
      await app.addFilter('id>0');

      // Case A: empty limit -> set empty string value
      await app.setLimit('');
      await app.executeQuery();
      const outEmptyLimit = await app.getOutputText();
      // Expect LIMIT with empty value (implementation uses the raw input value)
      expect(outEmptyLimit).toContain('LIMIT ;');

      // Hide results again by reloading page to reset state
      await page.reload();
      await app.goto();
      await app.addFilter('id>0');

      // Case B: negative limit
      await app.setLimit('-1');
      await app.executeQuery();
      const outNegative = await app.getOutputText();
      expect(outNegative).toContain('LIMIT -1;');

      // No uncaught runtime errors occurred during these edge cases
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Internal globals are readable but not modified by tests - verify filters variable exists and is an Array', async ({ page }) => {
      const { consoleMessages, pageErrors } = await collectRuntimeLogs(page);
      const app = new QuerySimulatorPage(page);
      await app.goto();

      // Directly read the global filters variable
      const filters = await app.getFiltersArray();
      expect(Array.isArray(filters)).toBe(true);

      // Attempting to access a non-existing function (renderPage) should simply be undefined, not throw
      const hasRenderPage = await app.renderPageExists();
      expect(hasRenderPage).toBe(false);

      // Confirm no page errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  // Final check: if any unexpected runtime exceptions occurred at any point in the test suite they should be reported here.
  // Note: Each test already asserts pageErrors length === 0. This test ensures consistent behavior after a sequence of interactions.
  test('Sanity: full flow from idle -> add filters -> execute -> no runtime exceptions', async ({ page }) => {
    const { consoleMessages, pageErrors } = await collectRuntimeLogs(page);
    const app = new QuerySimulatorPage(page);
    await app.goto();

    // Full flow
    await app.setTable('products');
    await app.setSortOrder('asc');
    await app.setLimit(10);
    await app.addFilter('price<50');
    await app.addFilter('stock>0');

    // Execute
    await app.executeQuery();

    // Verify output contains both filters and selected table and selected sort/limit
    const out = await app.getOutputText();
    expect(out).toBe(`SELECT * FROM products WHERE price<50 AND stock>0 ORDER BY id asc LIMIT 10;`);
    expect(await app.isResultsVisible()).toBe(true);

    // Assert no uncaught runtime errors like ReferenceError, SyntaxError, TypeError occurred
    // (If such errors occurred naturally, pageErrors would contain them and this assertion would fail.)
    const relevantErrors = pageErrors.filter(err => {
      const msg = String(err);
      return msg.includes('ReferenceError') || msg.includes('SyntaxError') || msg.includes('TypeError');
    });
    expect(relevantErrors.length).toBe(0);

    // Also ensure no console 'error' messages were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});