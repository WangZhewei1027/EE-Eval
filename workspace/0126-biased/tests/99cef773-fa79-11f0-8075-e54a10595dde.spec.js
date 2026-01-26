import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cef773-fa79-11f0-8075-e54a10595dde.html';

// Page Object Model for the Exponential Search Demo page
class ExponentialSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.targetInput = page.locator('#targetInput');
    this.searchButton = page.locator("button[onclick='performSearch()']");
    this.resetButton = page.locator("button[onclick='resetForm()']");
    this.calculateStatsButton = page.locator("button[onclick='calculateStatistics()']");
    this.resultDisplay = page.locator('#resultDisplay');
    this.statsDisplay = page.locator('#statsDisplay');
  }

  async goto() {
    await this.page.goto(BASE_URL);
    // Ensure the primary elements have loaded
    await Promise.all([
      this.arrayInput.waitFor({ state: 'visible' }),
      this.targetInput.waitFor({ state: 'visible' }),
      this.searchButton.waitFor({ state: 'visible' }),
      this.resetButton.waitFor({ state: 'visible' }),
      this.calculateStatsButton.waitFor({ state: 'visible' }),
    ]);
  }

  async getArrayValue() {
    return this.arrayInput.inputValue();
  }

  async setArrayValue(value) {
    await this.arrayInput.fill(value);
  }

  async getTargetValue() {
    return this.targetInput.inputValue();
  }

  async setTargetValue(value) {
    // input type=number accepts string or number
    await this.targetInput.fill(String(value));
  }

  async clickSearch() {
    await this.searchButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async clickCalculateStatistics() {
    await this.calculateStatsButton.click();
  }

  async getResultText() {
    return this.resultDisplay.innerText();
  }

  async getStatsText() {
    return this.statsDisplay.innerText();
  }
}

test.describe('Exponential Search Interactive Demo - FSM states and transitions', () => {
  // We'll collect console error messages and page exceptions for each test to assert on them.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    // Capture unhandled page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown explicitly here; Playwright will close pages automatically.
    // But assert that no console errors or page errors were produced during the test run.
    // This also validates that the page JavaScript executed without uncaught runtime errors.
    expect(consoleErrors, `Console errors were emitted: ${JSON.stringify(consoleErrors, null, 2)}`).toEqual([]);
    expect(pageErrors.map(e => String(e)), `Page errors were emitted: ${pageErrors.map(e => String(e)).join('\n')}`).toEqual([]);
  });

  test('S0 Idle: initial render - elements present and expected functions exist (and renderPage is not defined)', async ({ page }) => {
    // This test validates the Idle state: initial UI is rendered with inputs/buttons and
    // that the page defines the search/stats/reset functions while not defining a renderPage function
    const app = new ExponentialSearchPage(page);
    await app.goto();

    // Validate default input values present per FSM component definitions
    await expect(app.arrayInput).toHaveValue('1,2,3,4,5,6,7,8,9,10');
    await expect(app.targetInput).toHaveValue('5');

    // Validate visible buttons and result/stat placeholders exist
    await expect(app.searchButton).toBeVisible();
    await expect(app.resetButton).toBeVisible();
    await expect(app.calculateStatsButton).toBeVisible();
    await expect(app.resultDisplay).toBeVisible();
    await expect(app.statsDisplay).toBeVisible();

    // Validate functions declared in the page script
    const functions = await Promise.all([
      page.evaluate(() => typeof performSearch),
      page.evaluate(() => typeof resetForm),
      page.evaluate(() => typeof calculateStatistics),
      page.evaluate(() => typeof exponentialSearch),
      page.evaluate(() => typeof binarySearch),
      page.evaluate(() => typeof renderPage), // FSM mentioned renderPage as S0 entry action; verify it's not present
    ]);

    // performSearch, resetForm, calculateStatistics, exponentialSearch, binarySearch should be 'function'
    expect(functions[0]).toBe('function');
    expect(functions[1]).toBe('function');
    expect(functions[2]).toBe('function');
    expect(functions[3]).toBe('function');
    expect(functions[4]).toBe('function');

    // renderPage is not part of the provided HTML; we expect it to be 'undefined'
    expect(functions[5]).toBe('undefined');
  });

  test('S1 Searching: clicking Search finds an existing element and shows correct index (default)', async ({ page }) => {
    // Validate transition Idle -> Searching by clicking Search button and observing resultDisplay
    const app = new ExponentialSearchPage(page);
    await app.goto();

    // Click Search with default values (array 1..10, target 5). Expect index 4.
    await app.clickSearch();

    // Validate the result text matches expected outcome for found element
    await expect(app.resultDisplay).toHaveText('Element found at index: 4');
  });

  test('S1 Searching: clicking Search shows "Element not found" for missing element', async ({ page }) => {
    // Validate searching for a missing element yields "Element not found"
    const app = new ExponentialSearchPage(page);
    await app.goto();

    // Change target to a value not in the array
    await app.setTargetValue(15);
    await app.clickSearch();

    await expect(app.resultDisplay).toHaveText('Element not found');
  });

  test('S2 Reset: clicking Reset resets inputs and clears displays', async ({ page }) => {
    // Validate transition Idle -> Reset resets inputs and clears outputs
    const app = new ExponentialSearchPage(page);
    await app.goto();

    // Modify inputs and outputs to non-default values
    await app.setArrayValue('10,20,30');
    await app.setTargetValue(20);
    await app.clickSearch(); // should find element at some index
    await expect(app.resultDisplay).not.toHaveText(''); // ensure some result was shown

    // Also modify statsDisplay by calculating stats on modified array
    await app.clickCalculateStatistics();
    await expect(app.statsDisplay).not.toHaveText(''); // stats should be present

    // Now click Reset to return to defaults
    await app.clickReset();

    // Validate inputs restored to defaults per FSM components
    await expect(app.arrayInput).toHaveValue('1,2,3,4,5,6,7,8,9,10');
    await expect(app.targetInput).toHaveValue('5');

    // Validate displays cleared
    await expect(app.resultDisplay).toHaveText('');
    await expect(app.statsDisplay).toHaveText('');
  });

  test('S3 Statistics: clicking Calculate Statistics computes correct stats for default array', async ({ page }) => {
    // Validate transition Idle -> Calculating Statistics and that statsDisplay shows expected values
    const app = new ExponentialSearchPage(page);
    await app.goto();

    // Click Calculate Statistics for the default array 1..10
    await app.clickCalculateStatistics();

    // Expected: Max: 10, Min: 1, Sum: 55, Average: 5.5
    await expect(app.statsDisplay).toHaveText('Max: 10, Min: 1, Sum: 55, Average: 5.5');
  });

  test('Edge case: empty array - search and statistics behavior', async ({ page }) => {
    // Edge case validation:
    // - empty array should not throw runtime errors when searching
    // - search should report "Element not found"
    // - calculateStatistics will compute with empty array semantics used in implementation
    //   (Math.max(...[]) -> -Infinity, Math.min(...[]) -> Infinity, sum=0, average=Infinity because division by 0)
    const app = new ExponentialSearchPage(page);
    await app.goto();

    // Set array to empty and search for anything
    await app.setArrayValue('');
    await app.setTargetValue(5);
    await app.clickSearch();

    // Implementation should handle empty array gracefully and return "Element not found"
    await expect(app.resultDisplay).toHaveText('Element not found');

    // Now calculate statistics on empty array
    await app.clickCalculateStatistics();

    // The implementation uses Math.max(...array) and Math.min(...array) and divide by length.
    // For an empty array that yields Max: -Infinity, Min: Infinity, Sum: 0, Average: Infinity
    await expect(app.statsDisplay).toHaveText('Max: -Infinity, Min: Infinity, Sum: 0, Average: Infinity');
  });

  test('Verify that calling search/stat/reset through UI triggers the expected DOM changes (integration)', async ({ page }) => {
    // Integration style test that exercises the whole flow:
    // 1) set a custom array
    // 2) search for an element
    // 3) calculate statistics
    // 4) reset and verify cleared
    const app = new ExponentialSearchPage(page);
    await app.goto();

    // Step 1: custom array
    await app.setArrayValue('2,4,6,8,10');
    await app.setTargetValue(8);

    // Step 2: search -> should find at index 3 (0-based)
    await app.clickSearch();
    await expect(app.resultDisplay).toHaveText('Element found at index: 3');

    // Step 3: statistics -> Max:10, Min:2, Sum:30, Average:6
    await app.clickCalculateStatistics();
    await expect(app.statsDisplay).toHaveText('Max: 10, Min: 2, Sum: 30, Average: 6');

    // Step 4: reset -> returns to original defaults and clears displays
    await app.clickReset();
    await expect(app.arrayInput).toHaveValue('1,2,3,4,5,6,7,8,9,10');
    await expect(app.targetInput).toHaveValue('5');
    await expect(app.resultDisplay).toHaveText('');
    await expect(app.statsDisplay).toHaveText('');
  });
});