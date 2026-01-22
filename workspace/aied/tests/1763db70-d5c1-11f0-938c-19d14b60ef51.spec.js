import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/1763db70-d5c1-11f0-938c-19d14b60ef51.html';

// Page Object for the Linear Search Demo page
class LinearSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#arrayInput');
    this.searchInput = page.locator('#searchInput');
    this.searchButton = page.locator("button[onclick='performLinearSearch()']");
    this.resultDiv = page.locator('#result');
    this.heading = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for basic elements to render
    await Promise.all([
      this.arrayInput.waitFor({ state: 'visible' }),
      this.searchInput.waitFor({ state: 'visible' }),
      this.searchButton.waitFor({ state: 'visible' }),
      this.heading.waitFor({ state: 'visible' })
    ]);
  }

  async enterArray(value) {
    await this.arrayInput.fill('');
    await this.arrayInput.type(value);
  }

  async enterSearch(value) {
    await this.searchInput.fill('');
    await this.searchInput.type(value);
  }

  async clickSearch() {
    await this.searchButton.click();
  }

  async getResultText() {
    return (await this.resultDiv.textContent())?.trim() ?? '';
  }
}

test.describe('Linear Search Demo - FSM and UI validation', () => {
  // Collect console error messages and page errors for each test to assert there's no unexpected runtime error.
  /** @type {string[]} */
  let consoleErrors;
  /** @type {Error[]} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and collect errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // record error messages printed to console
        consoleErrors.push(`${msg.text()}`);
      }
    });

    // Capture uncaught page errors (ReferenceError, TypeError, SyntaxError etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // As part of teardown we assert there were no uncaught exceptions or console errors.
    // This validates the page ran without unexpected runtime errors during the test interactions.
    expect(pageErrors, 'No uncaught page errors should occur').toHaveLength(0);
    expect(consoleErrors, 'No console.error messages should be emitted').toHaveLength(0);
    // additional sanity: ensure the page is still reachable
    await expect(page).toHaveTitle(/Linear Search Demo/);
  });

  test('Initial render (S0_Idle) - heading, inputs and button exist and evidence attributes present', async ({ page }) => {
    // This test validates the Idle state evidence and initial rendering.
    const p = new LinearSearchPage(page);
    await p.goto();

    // Heading as evidence for S0_Idle
    await expect(p.heading).toHaveText('Linear Search Demo');

    // Inputs present with expected placeholders (component evidence)
    await expect(p.arrayInput).toHaveAttribute('placeholder', 'e.g. 1,2,3,4,5');
    await expect(p.searchInput).toHaveAttribute('placeholder', 'e.g. 3');

    // Button presence and the onclick attribute linking to performLinearSearch (evidence of S1 transition trigger)
    await expect(p.searchButton).toBeVisible();
    const onclick = await page.locator("button").getAttribute('onclick');
    expect(onclick, 'Button should have onclick attribute invoking performLinearSearch()').toBe('performLinearSearch()');

    // Verify that performLinearSearch exists on window (function implemented in page)
    const hasPerform = await page.evaluate(() => typeof window.performLinearSearch === 'function');
    expect(hasPerform, 'performLinearSearch should be defined as a function on window').toBe(true);

    // Verify that renderPage (mentioned as entry action in FSM) is NOT defined (the FSM mentions it, but the HTML doesn't implement it).
    // We check presence without invoking it. This verifies awareness of onEnter actions mentioned by the FSM.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage, 'renderPage should not be defined in the page as per provided HTML (verify onEnter action presence)').toBe(false);
  });

  test('Transition S0 -> S1 -> S2: Search finds an element (Result Found)', async ({ page }) => {
    // This test validates the Searching state activation and the Result Found final state when index !== -1
    const p = new LinearSearchPage(page);
    await p.goto();

    // Input array and search value that should be found at index 2 (0-based)
    await p.enterArray('1,2,3,4,5');
    await p.enterSearch('3');

    // Click triggers performLinearSearch (transition S0 -> S1)
    await p.clickSearch();

    // Verify result matches FSM evidence: Element 3 found at index 2.
    await expect(p.resultDiv).toHaveText('Element 3 found at index 2.');

    // Also verify the linearSearch function returns expected index when invoked directly
    const index = await page.evaluate(() => linearSearch([1,2,3,4,5], 3));
    expect(index).toBe(2);
  });

  test('Transition S0 -> S1 -> S3: Search does not find an element (Result Not Found)', async ({ page }) => {
    // This test validates the Searching state and the Result Not Found final state for index === -1
    const p = new LinearSearchPage(page);
    await p.goto();

    await p.enterArray('10,20,30');
    await p.enterSearch('5');
    await p.clickSearch();

    await expect(p.resultDiv).toHaveText('Element 5 not found in the array.');

    // Verify linearSearch returns -1 for not found
    const idx = await page.evaluate(() => linearSearch([10,20,30], 5));
    expect(idx).toBe(-1);
  });

  test('Edge case: empty array input - split and Number behavior', async ({ page }) => {
    // The app converts empty string to Number('') === 0, so [''] -> [0]. This test asserts the app's current behavior.
    const p = new LinearSearchPage(page);
    await p.goto();

    await p.enterArray(''); // empty input
    await p.enterSearch('0'); // searching for 0 should find at index 0 given the implementation
    await p.clickSearch();

    // According to the implementation, array = [''] -> map(Number) -> [0], so 0 will be found at index 0
    await expect(p.resultDiv).toHaveText('Element 0 found at index 0.');

    // Searching for a different number should result in not found
    await p.enterSearch('3');
    await p.clickSearch();
    await expect(p.resultDiv).toHaveText('Element 3 not found in the array.');
  });

  test('Edge case: non-numeric tokens and NaN behavior', async ({ page }) => {
    // Verifies how the implementation handles non-numeric values (e.g., "a", "b") which become NaN.
    // NaN === NaN is false, so NaN entries won't match a NaN search; numeric entries still match.
    const p = new LinearSearchPage(page);
    await p.goto();

    // array contains non-number tokens and a numeric one at index 2
    await p.enterArray('a,b,3');
    await p.enterSearch('3');
    await p.clickSearch();
    await expect(p.resultDiv).toHaveText('Element 3 found at index 2.');

    // Searching for 'a' will convert to NaN and won't match NaN elements (NaN !== NaN), so it should be "not found"
    await p.enterSearch('a');
    await p.clickSearch();
    await expect(p.resultDiv).toHaveText('Element NaN not found in the array.');
  });

  test('Direct function existence and basic API checks (linearSearch, performLinearSearch)', async ({ page }) => {
    // This test directly inspects the functions declared in the page JS to ensure they exist and behave as expected.
    const p = new LinearSearchPage(page);
    await p.goto();

    // Check linearSearch is defined
    const linearType = await page.evaluate(() => typeof window.linearSearch);
    expect(linearType).toBe('function');

    // Test linearSearch directly for a few cases
    const results = await page.evaluate(() => {
      return {
        idx1: linearSearch([5,6,7], 6),
        idx2: linearSearch([], 1),
        idx3: linearSearch([NaN, 2], NaN) // should be -1 because NaN !== NaN
      };
    });
    expect(results).toEqual({ idx1: 1, idx2: -1, idx3: -1 });

    // Verify performLinearSearch is callable and does not throw when inputs are present
    // We will call it indirectly by clicking the button and assert expected behavior rather than invoking it directly.
    await p.enterArray('8,9');
    await p.enterSearch('9');
    await p.clickSearch();
    await expect(p.resultDiv).toHaveText('Element 9 found at index 1.');
  });

  test('FSM evidence checks: onclick handler and result content formatting for both branches', async ({ page }) => {
    // This test validates the exact evidence strings expected by the FSM:
    // - onclick="performLinearSearch()"
    // - result text templates for found and not found branches
    const p = new LinearSearchPage(page);
    await p.goto();

    // Verify onclick attribute string exactly matches the FSM evidence
    const buttonHandle = page.locator("button[onclick='performLinearSearch()']");
    await expect(buttonHandle).toBeVisible();

    // Found branch formatting
    await p.enterArray('100,200,300');
    await p.enterSearch('200');
    await p.clickSearch();
    await expect(p.resultDiv).toHaveText('Element 200 found at index 1.');

    // Not found branch formatting
    await p.enterArray('1,2,3');
    await p.enterSearch('99');
    await p.clickSearch();
    await expect(p.resultDiv).toHaveText('Element 99 not found in the array.');
  });
});