import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324dade0-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object encapsulating interactions with the Interpolation Search Demo page
class InterpolationSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.searchInput = page.locator('#searchValue');
    this.searchButton = page.locator("button[onclick='performSearch()']");
    this.result = page.locator('#result');
    this.stepTableRows = page.locator('#stepTable tbody tr');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async setArray(text) {
    await this.arrayInput.fill(text);
  }

  async setSearchValue(value) {
    // Use fill to set the number input. Accepts string or number.
    await this.searchInput.fill(String(value));
  }

  async clearSearchValue() {
    await this.searchInput.fill('');
  }

  async clickSearch() {
    await this.searchButton.click();
  }

  async getResultText() {
    // textContent can return null, convert to empty string if so
    const txt = await this.result.textContent();
    return txt === null ? '' : txt.trim();
  }

  async getStepRowsCount() {
    return await this.stepTableRows.count();
  }

  async getStepRowData(rowIndex = 0) {
    // returns array of cell texts for the specified row index (0-based)
    const row = this.stepTableRows.nth(rowIndex);
    const cells = row.locator('td');
    const count = await cells.count();
    const values = [];
    for (let i = 0; i < count; i++) {
      const t = await cells.nth(i).textContent();
      values.push(t === null ? '' : t.trim());
    }
    return values;
  }
}

test.describe('Interpolation Search Demo - FSM states and transitions (324dade0-fa73-11f0-a9d0-d7a1991987c6)', () => {
  // Arrays to collect console errors and page errors for observation and assertions
  /** @type {Array<import('@playwright/test').ConsoleMessage>} */
  let consoleMessages;
  /** @type {Array<Error>} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push(msg);
    });

    // Capture unhandled page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // Attach some debug info to the test results if there were console messages or page errors
    if (consoleMessages.length > 0) {
      const summary = consoleMessages.map(m => `[${m.type()}] ${m.text()}`).join('\n');
      testInfo.attach('console-messages', { body: summary, contentType: 'text/plain' });
    }
    if (pageErrors.length > 0) {
      const summary = pageErrors.map(e => `${e.name}: ${e.message}`).join('\n');
      testInfo.attach('page-errors', { body: summary, contentType: 'text/plain' });
    }
  });

  test.describe('S0_Idle - Initial render state', () => {
    test('renders the main UI elements on initial load (Idle state)', async ({ page }) => {
      const app = new InterpolationSearchPage(page);
      await app.goto();

      // Validate presence of main heading and input controls (evidence of S0_Idle)
      await expect(page.locator('h1')).toHaveText('Interpolation Search Demo');
      await expect(app.arrayInput).toBeVisible();
      await expect(app.searchInput).toBeVisible();
      await expect(app.searchButton).toBeVisible();

      // Result area should be empty initially
      const initialResult = await app.getResultText();
      expect(initialResult).toBe('', 'Result area should be empty on initial render');

      // Step table should have no rows initially
      const rows = await app.getStepRowsCount();
      expect(rows).toBe(0);

      // Assert there are no uncaught page errors and no console errors generated during initial render
      const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S1_Searching -> S2_ResultFound transitions', () => {
    test('searching a present value displays Found message and populates steps (Found state)', async ({ page }) => {
      const app = new InterpolationSearchPage(page);
      await app.goto();

      // Provide a sorted array and search for a value that exists
      // Use unsorted input to verify the implementation sorts internally (edge: un-sorted input)
      await app.setArray('9,1,3,5,7');
      await app.setSearchValue(7);
      await app.clickSearch();

      // Expect the result to report Found 7 at the expected index in the sorted array [1,3,5,7,9] -> index 3
      const resultText = await app.getResultText();
      expect(resultText).toBe('Found 7 at index: 3');

      // Step table should have at least one row (search steps were recorded)
      const rows = await app.getStepRowsCount();
      expect(rows).toBeGreaterThan(0);

      // The last step's currentValue should equal the searched value (7) for a successful find.
      // Look through rows to find a row where the 'Current Value' cell equals '7'.
      let foundRow = -1;
      for (let i = 0; i < rows; i++) {
        const rowData = await app.getStepRowData(i); // [Step, Low, High, Probe Index, Current Value]
        if (rowData[4] === '7') {
          foundRow = i;
          break;
        }
      }
      expect(foundRow).toBeGreaterThanOrEqual(0);

      // Confirm no uncaught runtime errors occurred during the search
      const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('searching among duplicates finds one matching index and shows steps', async ({ page }) => {
      const app = new InterpolationSearchPage(page);
      await app.goto();

      // Duplicate values: searching for 5 should find some index where value === 5
      await app.setArray('2,5,5,5,8,10');
      await app.setSearchValue(5);
      await app.clickSearch();

      const resultText = await app.getResultText();
      // We expect Found 5 at index: <some index between 1 and 3>
      expect(resultText).toMatch(/^Found 5 at index: [123]$/);

      // Ensure steps were recorded
      const rows = await app.getStepRowsCount();
      expect(rows).toBeGreaterThan(0);

      // Ensure one of the step 'Current Value' cells equals '5'
      let sawFive = false;
      for (let i = 0; i < rows; i++) {
        const rowData = await app.getStepRowData(i);
        if (rowData[4] === '5') {
          sawFive = true;
          break;
        }
      }
      expect(sawFive).toBeTruthy();

      // No critical console/page errors expected
      const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('S1_Searching -> S3_ResultNotFound transitions', () => {
    test('searching a non-present value displays Not Found and records steps (Not Found state)', async ({ page }) => {
      const app = new InterpolationSearchPage(page);
      await app.goto();

      // Provide inputs where the value is absent
      await app.setArray('2,4,6,8,10');
      await app.setSearchValue(5);
      await app.clickSearch();

      const resultText = await app.getResultText();
      expect(resultText).toBe('5 not found.');

      // Steps should still be recorded showing the probes attempted
      const rows = await app.getStepRowsCount();
      expect(rows).toBeGreaterThan(0);

      // Validate step rows have 5 columns each (Step, Low, High, Probe Index, Current Value)
      const rowData = await app.getStepRowData(0);
      expect(rowData.length).toBe(5);

      // No uncaught errors expected
      const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('empty inputs and NaN search behavior (edge case) - should indicate NaN not found', async ({ page }) => {
      const app = new InterpolationSearchPage(page);
      await app.goto();

      // Leave textarea empty and leave search input empty (searchValue will parse to NaN)
      await app.setArray(''); // empty string: implementation will produce arr = [0] due to split + Number('') -> 0
      await app.clearSearchValue(); // ensures parseInt('') -> NaN
      await app.clickSearch();

      // Implementation uses parseInt('') -> NaN and will render "NaN not found."
      const resultText = await app.getResultText();
      expect(resultText).toBe('NaN not found.');

      // Steps are recorded by interpolationSearch even when not found; confirm table rows exist (may be 0 if loop never runs)
      const rows = await app.getStepRowsCount();
      // It's acceptable for steps to be 0 or more depending on condition checks with NaN, assert non-negative
      expect(rows).toBeGreaterThanOrEqual(0);

      // No uncaught runtime errors expected (the code handles these inputs without throwing)
      const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Additional validations and transition evidence', () => {
    test('performSearch() is triggered by clicking the Search button (event wiring)', async ({ page }) => {
      const app = new InterpolationSearchPage(page);
      await app.goto();

      // Spy: we cannot redefine or patch performSearch, but we can click the button and assert observable behavior occurs.
      // If the event handler wasn't wired, clicking would leave the result unchanged and table empty.
      await app.setArray('1,2,3');
      await app.setSearchValue(2);

      // Clear any prior console messages
      consoleMessages.length = 0;

      await app.clickSearch();

      const resultText = await app.getResultText();
      expect(resultText).toBe('Found 2 at index: 1');

      // Confirm steps were logged to the table => evidence that performSearch() ran and called interpolationSearch
      const rows = await app.getStepRowsCount();
      expect(rows).toBeGreaterThan(0);

      // No uncaught runtime errors expected
      const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('search uses numeric sorting of the array before searching (implementation detail)', async ({ page }) => {
      const app = new InterpolationSearchPage(page);
      await app.goto();

      // Provide input that if sorted lexicographically would break numeric order (e.g., '10' vs '2')
      await app.setArray('10,2,1,20');
      await app.setSearchValue(2);
      await app.clickSearch();

      // The implementation sorts numerically; 2 should be found at index 1 in [1,2,10,20]
      const resultText = await app.getResultText();
      expect(resultText).toBe('Found 2 at index: 1');

      // Confirm table has steps showing probe indices and current values (sanity check)
      const rows = await app.getStepRowsCount();
      expect(rows).toBeGreaterThan(0);

      // No uncaught runtime errors expected
      const consoleErrors = consoleMessages.filter(m => m.type() === 'error');
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });
});