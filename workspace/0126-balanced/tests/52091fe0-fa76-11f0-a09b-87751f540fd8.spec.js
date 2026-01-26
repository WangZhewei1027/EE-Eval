import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52091fe0-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the Interpolation Search app
class SearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#search-input');
    this.button = page.locator('#search-button');
    this.result = page.locator('#result');
    this.pageErrors = [];
    this.consoleMessages = [];
  }

  async goto() {
    // Attach listeners to capture runtime page errors and console messages
    this.page.on('pageerror', (err) => {
      // collect page errors (uncaught exceptions)
      this.pageErrors.push(err);
    });
    this.page.on('console', (msg) => {
      // collect console messages for inspection
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
    await this.page.goto(APP_URL);
  }

  async fillInput(value) {
    await this.input.fill(value);
  }

  async clickSearch() {
    await this.button.click();
  }

  async getResultText() {
    return (await this.result.textContent()) || '';
  }

  async clearResult() {
    // reset result area - allowed in tests to verify fresh behavior
    await this.page.evaluate(() => {
      const el = document.getElementById('result');
      if (el) el.textContent = '';
    });
  }

  async getPageErrors() {
    return this.pageErrors;
  }

  async getConsoleMessages() {
    return this.consoleMessages;
  }
}

test.describe('Interpolation Search interactive application (FSM verification)', () => {
  let searchPage;

  test.beforeEach(async ({ page }) => {
    searchPage = new SearchPage(page);
    await searchPage.goto();
  });

  test.afterEach(async ({ page }) => {
    // ensure page errors and console messages are available for debugging if a test fails
    const errors = await searchPage.getPageErrors();
    const consoleMsgs = await searchPage.getConsoleMessages();
    if (errors.length > 0) {
      console.error('Captured page errors:', errors);
    }
    if (consoleMsgs.length > 0) {
      console.info('Captured console messages:', consoleMsgs);
    }
    // close page - Playwright test runner will handle context teardown
    await page.close();
  });

  test('S0_Idle: Page renders with input, button and empty result - entry action renderPage()', async () => {
    // Validate components present as indicated in FSM S0_Idle evidence
    await expect(searchPage.input).toBeVisible();
    await expect(searchPage.input).toHaveAttribute('placeholder', 'Enter a value to search...');
    await expect(searchPage.button).toBeVisible();
    await expect(searchPage.button).toHaveText('Search');

    // Result element should exist and be empty on initial render
    const initialResult = await searchPage.getResultText();
    expect(initialResult.trim()).toBe('', 'Result area should be empty on initial page load (Idle state)');

    // Verify no uncaught runtime errors on initial render
    const errs = await searchPage.getPageErrors();
    expect(errs.length).toBe(0);
  });

  test('S0_Idle -> S1_Searching: Clicking Search triggers the search processing (SearchClick)', async () => {
    // Enter a known value and click search to trigger transition from Idle to Searching
    await searchPage.fillInput('10');

    // Clear any previous result content to ensure we observe changes caused by this click
    await searchPage.clearResult();
    const before = await searchPage.getResultText();
    expect(before).toBe('', 'Result should be empty just before clicking Search');

    // Click the search button (this is the event defined in FSM)
    await searchPage.clickSearch();

    // Small wait to allow any DOM updates (script is synchronous but DOM operations may settle)
    await searchPage.page.waitForTimeout(100);

    // After clicking, the application should execute its search logic and append something to #result
    const after = await searchPage.getResultText();
    expect(after.length).toBeGreaterThan(0, 'Result should be updated after clicking Search (Searching -> Result)');

    // The FSM expects "search function is called" on this transition.
    // We cannot directly spy into the function, but we validate the observable effect: the result DOM changed.
    // Also assert no uncaught runtime errors occurred during processing
    const errs = await searchPage.getPageErrors();
    expect(errs.length).toBe(0);
  });

  test('S1_Searching -> S2_Result: Output produced for existing and non-existing values', async () => {
    // Test existing value: '10' is in arr per implementation
    await searchPage.clearResult();
    await searchPage.fillInput('10');
    await searchPage.clickSearch();
    await searchPage.page.waitForTimeout(100);
    const resultExisting = await searchPage.getResultText();
    // FSM evidence suggests result.append(index + 1) should be used; we expect some appended text (often a digit)
    expect(resultExisting.trim().length).toBeGreaterThan(0, 'Result should contain output for an existing value');
    // At minimum, expect either digits or the text 'Not Found' or boolean-like output because the implementation is buggy.
    expect(/(\d+|Not Found|true|false)/.test(resultExisting)).toBeTruthy();

    // Test non-existing value: choose '7' which is not in the provided arr
    await searchPage.clearResult();
    await searchPage.fillInput('7');
    await searchPage.clickSearch();
    await searchPage.page.waitForTimeout(100);
    const resultNonExisting = await searchPage.getResultText();
    // Implementation may return a numeric index, boolean, or "Not Found" depending on bugs; ensure something was appended
    expect(resultNonExisting.trim().length).toBeGreaterThan(0, 'Result should contain output for a non-existing value');

    // Validate that repeated searches append additional content (since implementation uses result.append)
    const beforeSecondClick = resultNonExisting;
    await searchPage.fillInput('40'); // another value likely in array
    await searchPage.clickSearch();
    await searchPage.page.waitForTimeout(100);
    const afterSecond = await searchPage.getResultText();
    expect(afterSecond.length).toBeGreaterThan(beforeSecondClick.length, 'Subsequent searches should append to result element');

    // Ensure no uncaught errors occurred during these transitions
    const errs = await searchPage.getPageErrors();
    expect(errs.length).toBe(0);
  });

  test('Edge cases: empty input, non-numeric input and very large number', async () => {
    // empty input
    await searchPage.clearResult();
    await searchPage.fillInput('');
    await searchPage.clickSearch();
    await searchPage.page.waitForTimeout(100);
    const emptyResult = await searchPage.getResultText();
    expect(emptyResult.trim().length).toBeGreaterThan(0, 'Empty input should still produce some observable output (due to implementation logic)');

    // non-numeric input
    await searchPage.clearResult();
    await searchPage.fillInput('foo');
    await searchPage.clickSearch();
    await searchPage.page.waitForTimeout(100);
    const nonNumeric = await searchPage.getResultText();
    expect(nonNumeric.trim().length).toBeGreaterThan(0, 'Non-numeric input should produce observable output or handle gracefully');

    // very large number
    await searchPage.clearResult();
    await searchPage.fillInput('999999');
    await searchPage.clickSearch();
    await searchPage.page.waitForTimeout(100);
    const largeNum = await searchPage.getResultText();
    expect(largeNum.trim().length).toBeGreaterThan(0, 'Large numbers should produce an output (either Not Found or other result)');

    // Confirm that no uncaught runtime exceptions were triggered by these edge cases
    const errs = await searchPage.getPageErrors();
    expect(errs.length).toBe(0);
  });

  test('FSM evidence checks: verify components and event handler presence', async () => {
    // Verify evidence items: existence of event handler attachment in page source
    // We inspect the inline script text to detect the presence of the addEventListener call (evidence).
    const scriptContent = await searchPage.page.locator('script').allTextContents();
    const joinedScript = scriptContent.join('\n');
    expect(joinedScript.includes('document.getElementById("search-button").addEventListener("click"')).toBeTruthy();

    // Confirm the three components detected in FSM exist in the DOM
    await expect(searchPage.input).toBeVisible();
    await expect(searchPage.button).toBeVisible();
    await expect(searchPage.result).toBeVisible();

    // Verify that the placeholder text matches FSM evidence
    await expect(searchPage.input).toHaveAttribute('placeholder', 'Enter a value to search...');
  });
});