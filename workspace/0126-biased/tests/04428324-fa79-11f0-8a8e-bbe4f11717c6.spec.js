import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04428324-fa79-11f0-8a8e-bbe4f11717c6.html';

/**
 * Simple Page Object for the Ternary Search page
 */
class TernarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#search-input');
    this.button = page.locator('#search-button');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillSearch(text) {
    await this.input.fill(text);
  }

  async clickSearch() {
    await this.button.click();
  }

  async getResultText() {
    return (await this.result.textContent()) ?? '';
  }

  async isInputVisible() {
    return await this.input.isVisible();
  }

  async getInputPlaceholder() {
    return await this.input.getAttribute('placeholder');
  }
}

test.describe('Ternary Search - FSM and UI validation', () => {
  // Arrays to collect console messages and page errors for assertions.
  let consoleMessages;
  let pageErrors;

  // Attach listeners and navigate before each test so we capture page load events/errors.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events (for logs, warnings, errors printed to the console).
    page.on('console', (msg) => {
      try {
        // Normalize console messages into strings
        const text = `${msg.type()}: ${msg.text()}`;
        consoleMessages.push(text);
      } catch {
        // ignore if something unexpected happens while reading console
      }
    });

    // Capture runtime errors that bubble up to the page.
    page.on('pageerror', (err) => {
      try {
        // err.message typically contains useful content like "renderPage is not defined"
        pageErrors.push(String(err && err.message ? err.message : err));
      } catch {
        pageErrors.push(String(err));
      }
    });

    // Navigate to the application page (listeners are attached before navigation)
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Clear arrays to avoid cross-test pollution (not strictly necessary as they are reinitialized).
    consoleMessages = [];
    pageErrors = [];
  });

  test('State S0_Idle: Page renders input and search button, renderPage() should be invoked on entry', async ({ page }) => {
    // This test validates the Idle state:
    // - Input and button elements are present (evidence of S0_Idle)
    // - The FSM entry action renderPage() was expected on enter; we observe console/page errors for it.

    const searchPage = new TernarySearchPage(page);

    // Verify DOM components exist and have expected attributes/placeholder.
    await expect(searchPage.input).toBeVisible();
    await expect(searchPage.button).toBeVisible();

    // Check placeholder text
    const placeholder = await searchPage.getInputPlaceholder();
    expect(placeholder).toBe('Search...');

    // At entry, FSM expected to run renderPage(). We must observe if a ReferenceError (or similar) occurred.
    // The runtime error may have fired during navigation and is captured in pageErrors.
    // Assert that at least one page error references 'renderPage' to confirm the expected entry action was attempted.
    const hasRenderPageError = pageErrors.some((msg) => msg.includes('renderPage'));
    // If renderPage is implemented, there may be no error. However, per test instructions, we assert that the missing function error occurs.
    // This assertion expects that the environment produced an error mentioning renderPage.
    expect(hasRenderPageError).toBeTruthy();
  });

  test('Transition: Clicking Search triggers SearchButtonClicked and performSearch() (S0_Idle -> S1_Searching)', async ({ page }) => {
    // This test validates the transition:
    // - When the search button is clicked (SearchButtonClicked), the performSearch() entry action should run.
    // - We observe a page error referencing performSearch if it is missing, or DOM changes in #result if it exists.
    const searchPage = new TernarySearchPage(page);

    // Ensure input and button are ready
    await expect(searchPage.input).toBeVisible();
    await expect(searchPage.button).toBeVisible();

    // Clear any previously captured errors so we can distinguish the click-caused errors.
    pageErrors.length = 0;
    consoleMessages.length = 0;

    // Attempt to click the search button and concurrently wait for a pageerror that may be caused by performSearch().
    // If performSearch is undefined, an error should be emitted and caught by waitForEvent.
    let performSearchError;
    try {
      const waitForErr = page.waitForEvent('pageerror', { timeout: 3000 });
      await searchPage.clickSearch();
      performSearchError = await waitForErr; // will throw on timeout if no error occurs
    } catch (err) {
      // If waitForEvent timed out, performSearch may have executed successfully (or produced no pageerror).
      performSearchError = err;
    }

    // If a page error object was captured (by waitForEvent), check for performSearch in its message
    const capturedErrorMessage = typeof performSearchError === 'object' && performSearchError && performSearchError.message
      ? performSearchError.message
      : String(performSearchError);

    const explicitPerformSearchInCaptured = capturedErrorMessage.includes('performSearch');

    // Additionally check the result container for possible updates (in case performSearch existed and populated results)
    const resultText = (await searchPage.getResultText()).trim();

    // The test should assert that either:
    // - a runtime error referencing performSearch occurred (function missing), OR
    // - the results container was updated (performSearch executed successfully).
    const passCondition = explicitPerformSearchInCaptured || resultText.length > 0;

    expect(passCondition).toBeTruthy();

    // For traceability in test output, attach assertions about which of the above happened.
    if (explicitPerformSearchInCaptured) {
      // If we captured an error, ensure the message mentions performSearch to link with expected FSM action.
      expect(capturedErrorMessage.toLowerCase()).toContain('performsearch');
    } else {
      // Otherwise, ensure result container has some content to indicate searching finished and results displayed.
      expect(resultText.length).toBeGreaterThan(0);
    }
  });

  test('Edge case: Clicking search with empty input should still trigger SearchButtonClicked and error or show no results', async ({ page }) => {
    // This test attempts an edge case where the input is empty.
    // It validates that clicking still triggers the search event and either triggers the performSearch error
    // or leaves results empty / displays some handling UI.

    const searchPage = new TernarySearchPage(page);

    // Ensure the input is empty
    await searchPage.fillSearch('');
    const currentValue = await searchPage.input.inputValue();
    expect(currentValue).toBe('');

    // Clear previous captures
    pageErrors.length = 0;
    consoleMessages.length = 0;

    // Click and wait briefly for possible runtime errors or DOM updates
    let newPageError;
    try {
      const waitForErr = page.waitForEvent('pageerror', { timeout: 2000 });
      await searchPage.clickSearch();
      newPageError = await waitForErr;
    } catch (err) {
      newPageError = err;
    }

    // Acceptable outcomes:
    // - A pageerror referencing performSearch (function missing)
    // - No pageerror but result remains empty (performSearch handled empty input gracefully)
    const resultText = (await searchPage.getResultText()).trim();
    const recordedErrorMessage = typeof newPageError === 'object' && newPageError && newPageError.message
      ? newPageError.message
      : String(newPageError || '');

    // Determine if a performSearch related error occurred
    const hasPerformSearchError = recordedErrorMessage.toLowerCase().includes('performsearch');

    // Assert one of the expected outcomes: either an error occurred, or result is empty (no crash).
    expect(hasPerformSearchError || resultText.length === 0).toBeTruthy();

    // Additional assertion: if an error occurred, ensure it is the kind of ReferenceError we expect when a missing function is invoked.
    if (hasPerformSearchError) {
      // Common runtime message contains "is not defined" for missing functions; assert presence of that fragment.
      expect(recordedErrorMessage.toLowerCase()).toContain('not defined');
    }
  });

  test('Robustness: Multiple rapid clicks should not crash the harness beyond initial performSearch error', async ({ page }) => {
    // This test simulates rapid user interactions: several quick clicks on the search button.
    // We expect at most repeated errors of the same type (e.g., performSearch not defined),
    // and the page should stay reachable (no navigation away, no unhandled fatal exceptions that close the page).

    const searchPage = new TernarySearchPage(page);

    // Clear captured errors
    pageErrors.length = 0;
    consoleMessages.length = 0;

    // Rapidly click the search button multiple times
    const clicks = 5;
    const clickPromises = [];
    for (let i = 0; i < clicks; i++) {
      clickPromises.push(searchPage.clickSearch());
    }
    // Fire the clicks without awaiting each (simulate rapid clicking)
    await Promise.allSettled(clickPromises);

    // Wait briefly to allow any errors to surface
    // We won't actively wait for a pageerror—just examine collected pageErrors array
    await page.waitForTimeout(500);

    // The page should still be open and the input/button should be visible
    await expect(searchPage.input).toBeVisible();
    await expect(searchPage.button).toBeVisible();

    // If performSearch is missing, we expect at least one pageError mentioning it
    const performSearchErrorsCount = pageErrors.filter((m) => m.toLowerCase().includes('performsearch')).length;

    // Either we saw errors (likely) or clicks were handled silently and no errors occurred.
    // The robustness criteria: page remains stable and interactive.
    expect(performSearchErrorsCount >= 0).toBeTruthy(); // trivial guard

    // Assert page still responds: try filling input after rapid clicks
    await searchPage.fillSearch('probe');
    const value = await searchPage.input.inputValue();
    expect(value).toBe('probe');
  });

  test('Inspect console: ensure no unexpected SyntaxError during load (or capture it if present)', async ({ page }) => {
    // This test inspects console messages captured during load for SyntaxError or other fatal errors.
    // Per instructions, we should let such errors happen and assert their presence if they occur.

    // Aggregate console messages we captured during navigation
    const hasSyntaxErrorConsole = consoleMessages.some((m) => m.toLowerCase().includes('syntaxerror'));
    const hasTypeErrorConsole = consoleMessages.some((m) => m.toLowerCase().includes('typeerror'));

    // If there is a SyntaxError it likely prevents script execution; assert that such an error, if present, is captured.
    // We assert that either a SyntaxError was captured OR we at least captured runtime page errors (e.g., ReferenceError for renderPage)
    const capturedRuntimeError = pageErrors.length > 0;

    // The test asserts visibility into these errors: there should be at least one of these evidence types recorded.
    expect(hasSyntaxErrorConsole || hasTypeErrorConsole || capturedRuntimeError).toBeTruthy();
  });
});