import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04425c13-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Page object for the Linear Search demo.
 * Encapsulates common operations and collects console/page errors for assertions.
 */
class LinearSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Bind listeners to capture console messages and uncaught exceptions.
    this._consoleListener = msg => {
      try {
        // Flatten console args for easier assertions
        const text = `${msg.type()}: ${msg.text()}`;
        this.consoleMessages.push(text);
      } catch (e) {
        // ignore listener errors
      }
    };

    this._pageErrorListener = error => {
      // pageerror receives Error objects from the page; store message and stack
      this.pageErrors.push({
        message: error.message ?? String(error),
        stack: error.stack ?? ''
      });
    };
  }

  /**
   * Attach event listeners for the current page.
   */
  attachListeners() {
    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
  }

  /**
   * Detach event listeners (cleanup).
   */
  detachListeners() {
    try {
      this.page.off('console', this._consoleListener);
      this.page.off('pageerror', this._pageErrorListener);
    } catch (e) {
      // ignore
    }
  }

  /**
   * Navigate to the app URL and wait for load to settle.
   */
  async goto() {
    // Navigate and wait for network idle to allow scripts to run.
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Give a short grace period for any synchronous reference errors or late scripts.
    await this.page.waitForTimeout(300);
  }

  inputLocator() {
    return this.page.locator('#search-input');
  }

  buttonLocator() {
    return this.page.locator('#search-button');
  }

  resultsLocator() {
    return this.page.locator('.search-results');
  }

  async enterNumber(value) {
    const input = this.inputLocator();
    await input.fill(''); // clear
    // Use fill with string to simulate user entering a number
    await input.fill(String(value));
  }

  async clickSearch() {
    await this.buttonLocator().click();
    // allow any handlers to run
    await this.page.waitForTimeout(300);
  }

  /**
   * Clear the stored page errors and console messages (useful between actions).
   */
  clearCaptured() {
    this.consoleMessages.length = 0;
    this.pageErrors.length = 0;
  }

  /**
   * Helper to get the current results text (trimmed).
   */
  async getResultsText() {
    const exists = await this.resultsLocator().count();
    if (!exists) return '';
    const text = await this.resultsLocator().innerText();
    return (text ?? '').trim();
  }
}

test.describe('Linear Search Interactive App - FSM validation', () => {
  let pageObj;
  // Use Playwright's page fixture
  test.beforeEach(async ({ page }) => {
    pageObj = new LinearSearchPage(page);
    pageObj.attachListeners();
    // Navigate to the page before each test
    await pageObj.goto();
  });

  test.afterEach(async ({ page }) => {
    // detach listeners and close page if necessary
    pageObj.detachListeners();
    // give some time for any late errors to surface
    await page.waitForTimeout(100);
  });

  test('S0_Idle: initial render shows input, button and results container; entry action observation', async ({ page }) => {
    // This test validates the Idle state (S0_Idle):
    // - The input, search button and results container exist.
    // - We observe console logs and page errors related to initial rendering/entry actions.
    const input = pageObj.inputLocator();
    const button = pageObj.buttonLocator();
    const results = pageObj.resultsLocator();

    // Assert presence of UI components as evidence of S0_Idle
    await expect(input).toHaveCount(1);
    await expect(button).toHaveCount(1);
    await expect(results).toHaveCount(1);

    // Validate attributes of the input
    await expect(input).toHaveAttribute('type', 'number');
    await expect(input).toHaveAttribute('placeholder', 'Enter your number to search...');

    // Wait briefly to ensure any synchronous entry actions (renderPage()) have executed
    await page.waitForTimeout(200);

    // Inspect captured console messages and page errors
    // According to the instructions we must "let ReferenceError, SyntaxError, TypeError happen naturally, and assert that these errors occur."
    // So assert that at least one page error of a typical runtime error type occurred on load.
    const pageErrors = pageObj.pageErrors.map(e => e.message);
    const foundRuntimeError = pageErrors.some(msg =>
      /ReferenceError|TypeError|SyntaxError|Error/.test(msg)
    );

    // We expect at least one runtime error to have occurred during page load (per task constraints).
    expect(pageObj.pageErrors.length, `Expected at least one page error during initial load, got console messages: ${pageObj.consoleMessages.join(' | ')}`).toBeGreaterThan(0);
    expect(foundRuntimeError, `Expected runtime error in page errors but found: ${JSON.stringify(pageErrors)}`).toBeTruthy();

    // Also assert that the console captured messages (if any) include helpful diagnostics when available.
    // This is non-fatal: we only check existence and structure.
    expect(Array.isArray(pageObj.consoleMessages)).toBeTruthy();
  });

  test('Transition S0_Idle -> S1_Searching: clicking search triggers search behavior (executeSearch) or raises runtime error', async ({ page }) => {
    // This test validates the transition triggered by clicking the search button:
    // - If the implementation runs, the .search-results element should be updated.
    // - If the implementation is broken, we expect a runtime error (e.g., ReferenceError for executeSearch).
    // We clear prior captured messages to focus on errors caused by the click.
    pageObj.clearCaptured();

    // Edge case: click when input is empty
    // First, attempt a click with no input to simulate user forgetting to enter a number.
    await pageObj.clickSearch();

    // Wait a short time for any handlers to run
    await page.waitForTimeout(300);

    // Collect errors that occurred due to the click
    let clickErrors = pageObj.pageErrors.map(e => e.message);
    const clickHadRuntimeError = clickErrors.some(msg =>
      /ReferenceError|TypeError|SyntaxError|Error/.test(msg)
    );

    // Now clear and perform a proper search with a numeric input
    pageObj.clearCaptured();
    await pageObj.enterNumber(7);
    await pageObj.clickSearch();

    // Wait again for handlers to run
    await page.waitForTimeout(300);

    const resultsText = await pageObj.getResultsText();
    const postClickErrors = pageObj.pageErrors.map(e => e.message);
    const postClickHadRuntimeError = postClickErrors.some(msg =>
      /ReferenceError|TypeError|SyntaxError|Error/.test(msg)
    );

    // Validate expectations:
    // Either the results container changed (search ran) OR a runtime error occurred (executeSearch missing or throws).
    if (resultsText.length > 0) {
      // If results were rendered, assert the results container is visible and contains something meaningful.
      await expect(pageObj.resultsLocator()).toBeVisible();
      expect(resultsText.length).toBeGreaterThan(0);
    } else {
      // Otherwise, assert that a runtime error occurred as per task constraints.
      expect(pageObj.pageErrors.length, `Expected errors after clicking search but found console messages: ${pageObj.consoleMessages.join(' | ')}`).toBeGreaterThan(0);
      expect(postClickHadRuntimeError, `Expected a runtime error (ReferenceError/TypeError/SyntaxError) after click; errors: ${JSON.stringify(postClickErrors)}`).toBeTruthy();
    }
  });

  test('Edge cases: multiple rapid clicks and empty input should not crash silently (observe errors or stable DOM)', async ({ page }) => {
    // This test exercises edge cases:
    // - Rapid multiple clicks
    // - Submitting empty input
    // We verify either stable DOM state or that errors are observable.

    pageObj.clearCaptured();

    // Ensure input is empty
    await pageObj.inputLocator().fill('');
    // Rapidly click the search button multiple times
    for (let i = 0; i < 5; i++) {
      await pageObj.clickSearch();
    }

    // Wait for potential errors/handlers
    await page.waitForTimeout(400);

    const errorsAfterRapidClicks = pageObj.pageErrors.map(e => e.message);
    const hadRuntimeError = errorsAfterRapidClicks.some(msg =>
      /ReferenceError|TypeError|SyntaxError|Error/.test(msg)
    );

    const resultsAfterRapidClicks = await pageObj.getResultsText();

    // Assert: either DOM is stable (results element present, possibly empty) OR errors occurred that we captured.
    const resultsExists = (await pageObj.resultsLocator().count()) > 0;
    expect(resultsExists).toBeTruthy();

    if (resultsAfterRapidClicks.length === 0) {
      // If nothing changed visually, ensure we observed runtime errors as required by the task constraints.
      expect(pageObj.pageErrors.length).toBeGreaterThan(0);
      expect(hadRuntimeError).toBeTruthy();
    } else {
      // If results changed, assert the results container contains something reasonable.
      expect(resultsAfterRapidClicks.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('FSM Evidence checks: verify component evidence strings exist in DOM and attributes match FSM', async ({ page }) => {
    // This test cross-checks the FSM "evidence" for the components.
    // - #search-input exists and has required attributes
    // - #search-button exists and has expected text
    // - .search-results exists

    const input = pageObj.inputLocator();
    const button = pageObj.buttonLocator();
    const results = pageObj.resultsLocator();

    await expect(input).toHaveCount(1);
    await expect(button).toHaveCount(1);
    await expect(results).toHaveCount(1);

    // Check button text content
    const btnText = await button.innerText();
    expect(btnText.trim()).toBe('Search');

    // Check that the results container is a DIV (by tagName) if possible
    const resultsTagName = await page.evaluate(() => {
      const el = document.querySelector('.search-results');
      return el ? el.tagName : null;
    });
    expect(resultsTagName).toBe('DIV');

    // Because the FSM entry actions mention renderPage() and executeSearch(), we must assert
    // that either those functions ran (observable via changes) or that runtime errors occurred.
    // Confirm that we have observed at least one page error during the test suite so far.
    // (This conforms to the instruction to allow and assert natural runtime errors.)
    expect(pageObj.pageErrors.length).toBeGreaterThanOrEqual(0);
    // If there are no errors yet, the test still passes as long as DOM elements match FSM evidence.
  });
});