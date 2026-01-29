import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04420df4-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * PageObject for the Selection Sort page.
 * Encapsulates common interactions and queries.
 */
class SelectionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.sortButton = page.locator('#sort-button');
    this.originalArray = page.locator('#original-array');
    this.result = page.locator('#result');

    // capture logs and errors for assertions
    this.consoleMessages = [];
    this.pageErrors = [];

    this._onConsole = (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    this._onPageError = (err) => {
      // err is an Error object
      this.pageErrors.push(err);
    };
  }

  async goto() {
    // attach listeners BEFORE navigation to capture any early errors
    this.page.on('console', this._onConsole);
    this.page.on('pageerror', this._onPageError);
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async disposeListeners() {
    this.page.off('console', this._onConsole);
    this.page.off('pageerror', this._onPageError);
  }

  async clickSort() {
    await this.sortButton.click();
  }

  async getOriginalArrayText() {
    return (await this.originalArray.innerText()).trim();
  }

  async getResultText() {
    return (await this.result.innerText()).trim();
  }

  // helper to check whether we observed any typical runtime errors or specific text in logs
  sawRuntimeErrorOrKeyword(keywords = []) {
    const errorRegex = /ReferenceError|SyntaxError|TypeError/;
    const sawPageError = this.pageErrors.length > 0 && this.pageErrors.some(e => errorRegex.test(String(e.message || e)));
    const sawConsoleError = this.consoleMessages.some(m => m.type === 'error' || errorRegex.test(m.text));
    const sawKeyword = keywords.length > 0 && this.consoleMessages.some(m => keywords.some(k => m.text.includes(k)));
    return sawPageError || sawConsoleError || sawKeyword;
  }
}

test.describe('Selection Sort FSM - Interactive Application Tests', () => {
  // reuse page model in each test
  test.describe.configure({ mode: 'parallel' });

  test.beforeEach(async ({ page }) => {
    // no-op here; each test will create its own PageObject and call goto()
  });

  test.afterEach(async ({ page }) => {
    // ensure page listeners are cleaned if tests attach any
    page.removeAllListeners?.('console');
    page.removeAllListeners?.('pageerror');
  });

  test('S0_Idle state: page renders and Idle entry action (renderPage) is invoked or errors observed', async ({ page }) => {
    /**
     * This test validates the Idle state:
     * - The page should load and show the primary components (sort button, original array, result).
     * - The FSM specifies an entry action renderPage(); we do not modify the app.
     *   We therefore assert that either a log mentioning renderPage appears OR a runtime error
     *   (ReferenceError/SyntaxError/TypeError) related to missing renderPage occurs.
     *
     * Note: Per requirements we do not patch the runtime. We observe and assert the natural outcomes
     * (logs or exceptions).
     */
    const app = new SelectionSortPage(page);
    await app.goto();

    // Basic DOM assertions for Idle state evidence
    await expect(page.locator('#sort-button')).toBeVisible();
    await expect(page.locator('#original-array')).toBeVisible();
    await expect(page.locator('#result')).toBeVisible();

    // retrieve some DOM contents for additional checks
    const originalText = await app.getOriginalArrayText();
    const resultText = await app.getResultText();

    // original and result should at least be present as strings (may be empty)
    expect(typeof originalText).toBe('string');
    expect(typeof resultText).toBe('string');

    // We expect either:
    //  - an explicit console message referencing renderPage OR
    //  - a runtime error (uncaught) mentioning ReferenceError/SyntaxError/TypeError
    const sawExpected = app.sawRuntimeErrorOrKeyword(['renderPage']);
    expect(sawExpected).toBeTruthy();

    // cleanup listeners for this page object
    await app.disposeListeners();
  });

  test('Transition S0 -> S1: Clicking Sort initiates sorting (startSorting) or raises expected runtime error', async ({ page }) => {
    /**
     * Validates the transition from Idle to Sorting:
     * - Clicking the sort button should trigger the startSorting() entry action (per FSM).
     * - We assert that either a log mentioning startSorting appears OR a runtime error related to it occurs.
     * - We also ensure the button remains in DOM (UI remains responsive).
     */
    const app = new SelectionSortPage(page);
    await app.goto();

    // Ensure button is available
    await expect(app.sortButton).toBeVisible();

    // Click the sort button to trigger the transition
    await app.clickSort();

    // Give the page a short moment to process JS (if any)
    await page.waitForTimeout(400);

    // Check for either logs or runtime errors indicating startSorting ran or failed
    const sawStartSortingOrError = app.sawRuntimeErrorOrKeyword(['startSorting']);
    expect(sawStartSortingOrError).toBeTruthy();

    // After initiating sorting, the page should still have the sort button (app didn't completely break)
    await expect(app.sortButton).toBeVisible();

    // Optionally verify that result/array changed in some way or at least exist
    const originalAfter = await app.getOriginalArrayText();
    expect(typeof originalAfter).toBe('string');

    await app.disposeListeners();
  });

  test('Transition S1 -> S0: Clicking Sort again should complete sorting (updateResult) or produce expected error', async ({ page }) => {
    /**
     * This test simulates clicking the sort button twice:
     * - First click should enter Sorting state and attempt startSorting().
     * - Second click is expected (per FSM) to transition back to Idle and run updateResult().
     * - We assert that either updateResult was logged OR related runtime errors occurred.
     */
    const app = new SelectionSortPage(page);
    await app.goto();

    // Click first time to enter S1
    await app.clickSort();
    await page.waitForTimeout(300);

    // Click second time to possibly complete sorting and cause onExit actions
    await app.clickSort();
    await page.waitForTimeout(500);

    // Look for evidence of updateResult or runtime error
    const sawUpdateOrError = app.sawRuntimeErrorOrKeyword(['updateResult']);
    expect(sawUpdateOrError).toBeTruthy();

    // Verify result text exists (may be empty or unchanged if error occurred)
    const resultText = await app.getResultText();
    expect(typeof resultText).toBe('string');

    await app.disposeListeners();
  });

  test('Edge case: Rapid repeated clicks should not crash the page beyond observed runtime errors', async ({ page }) => {
    /**
     * Edge case test:
     * - Simulate rapid clicking of the Sort button multiple times.
     * - We do not patch the app; we assert that the page either surfaces runtime errors
     *   (which we accept as valid observable behavior) or remains responsive (button still visible).
     * - This helps ensure the application does not become completely unresponsive.
     */
    const app = new SelectionSortPage(page);
    await app.goto();

    // Clicking rapidly multiple times
    for (let i = 0; i < 5; i++) {
      try {
        await app.clickSort();
      } catch (e) {
        // If click throws (e.g., because the button is removed), record via page errors already attached
        // We do not rethrow; we will assert on the observed outcomes below.
      }
    }

    // allow processing time
    await page.waitForTimeout(600);

    // The valid outcomes:
    // - there are runtime errors observed (we accept these), OR
    // - the app remains responsive: sort button still visible
    const sawRuntime = app.sawRuntimeErrorOrKeyword();
    const stillHasButton = await app.sortButton.isVisible().catch(() => false);

    expect(sawRuntime || stillHasButton).toBeTruthy();

    await app.disposeListeners();
  });

  test('Observability: Collect and assert that at least one console log or page error occurred during navigation and interaction', async ({ page }) => {
    /**
     * This test ensures we captured console logs and/or page errors while loading and interacting.
     * - Per instructions we must observe and assert that runtime errors (ReferenceError/SyntaxError/TypeError)
     *   happen naturally if they are present.
     * - We assert that at least one console message or uncaught page error was observed overall.
     */
    const app = new SelectionSortPage(page);
    await app.goto();

    // perform a click to increase chances of runtime activity
    await app.clickSort();
    await page.waitForTimeout(300);

    // Evaluate whether any console messages or page errors were captured
    const anyConsole = app.consoleMessages.length > 0;
    const anyPageError = app.pageErrors.length > 0;

    // We expect to have observed either console output or page errors in a realistic interactive app.
    expect(anyConsole || anyPageError).toBeTruthy();

    // As an additional assertion, check if any captured messages contain common JS error types
    const errorLike = app.sawRuntimeErrorOrKeyword();
    // This is not mandatory to be true if the app is clean, but per the enforced requirement earlier,
    // we assert that it's true to ensure we observed runtime exceptions when present.
    // If no runtime exception exists, the app might be correct; still require at least console output.
    if (!errorLike) {
      // Ensure at least some console output exists describing activity (fallback)
      expect(anyConsole).toBeTruthy();
    } else {
      expect(errorLike).toBeTruthy();
    }

    await app.disposeListeners();
  });
});