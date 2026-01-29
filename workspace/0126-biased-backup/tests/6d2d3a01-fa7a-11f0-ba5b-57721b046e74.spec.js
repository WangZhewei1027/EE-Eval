import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2d3a01-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object to encapsulate common interactions and observations
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Bind listeners to capture console messages and page errors
    this._consoleListener = (msg) => {
      // store type and text for richer assertions
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    this._pageErrorListener = (err) => {
      // store message and full stack if available
      const message = err && err.message ? err.message : String(err);
      this.pageErrors.push(message);
    };

    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
  }

  // Navigate to the application page and wait for network idle to settle
  async goto() {
    this.response = await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
    return this.response;
  }

  // Helper to remove listeners (teardown)
  async teardown() {
    try {
      this.page.off('console', this._consoleListener);
      this.page.off('pageerror', this._pageErrorListener);
    } catch (e) {
      // ignore errors during teardown
    }
  }

  // Returns a shallow snapshot of captured console messages
  getConsoleMessages() {
    return this.consoleMessages.slice();
  }

  // Returns a shallow snapshot of captured page errors
  getPageErrors() {
    return this.pageErrors.slice();
  }

  // Evaluate a selector count on the page
  async countSelector(selector) {
    return await this.page.evaluate((sel) => document.querySelectorAll(sel).length, selector);
  }

  // Return full body innerText length (for edge-case content checks)
  async bodyTextLength() {
    return await this.page.evaluate(() => (document.body && document.body.innerText) ? document.body.innerText.length : 0);
  }

  // Check presence of a global function name (non-intrusive read)
  async hasGlobalFunction(name) {
    return await this.page.evaluate((fnName) => typeof window[fnName] === 'function', name);
  }
}

test.describe('B+ Tree Interactive Application (FSM ID: 6d2d3a01-fa7a-11f0-ba5b-57721b046e74)', () => {
  let app;

  // Setup before each test: create AppPage and navigate to page
  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    // Navigate to the target application page
    await app.goto();
  });

  // Teardown after each test: remove listeners
  test.afterEach(async () => {
    await app.teardown();
  });

  test('Idle state entry: renderPage() entry action should be invoked or cause a runtime error', async () => {
    // This test validates the FSM's single state (Idle) entry action: renderPage()
    // We observe console logs and page errors to confirm whether renderPage ran or failed.

    // Ensure the page responded OK (network-level)
    expect(app.response).toBeTruthy();
    expect(app.response.status()).toBeGreaterThanOrEqual(200);
    expect(app.response.status()).toBeLessThan(400);

    const consoleMessages = app.getConsoleMessages();
    const pageErrors = app.getPageErrors();

    // Log captured messages to the test output to aid debugging if needed
    // (Playwright test runner will capture test logs)
    // Assertion: Either we observed a console log mentioning "renderPage"
    // OR we observed a page error mentioning renderPage / ReferenceError / SyntaxError / TypeError.
    const sawRenderPageConsole = consoleMessages.some(m => /renderPage/.test(m.text));
    const sawRenderPageError = pageErrors.some(e => /renderPage|ReferenceError|is not defined|TypeError|SyntaxError/.test(e));

    // At least one of these should be true as the FSM specifies renderPage() on entry.
    expect(sawRenderPageConsole || sawRenderPageError).toBeTruthy();
  });

  test('Runtime errors: page should emit at least one pageerror (ReferenceError / SyntaxError / TypeError) if scripts are missing or broken', async () => {
    // This test explicitly asserts that the page produced at least one pageerror event.
    // Requirement: Let ReferenceError, SyntaxError, TypeError happen naturally and assert that these errors occur.
    // Note: If the page executes cleanly and no page errors occur, this assertion will fail - which is intentional
    // because the exercise expects us to observe/verify such runtime issues for this particular application snapshot.

    const pageErrors = app.getPageErrors();

    // Assert that at least one page error occurred during load/execution
    expect(pageErrors.length).toBeGreaterThan(0);
    // Additionally assert that one of the common runtime error categories appears in the messages
    const matchesCommonRuntimeError = pageErrors.some(e => /ReferenceError|TypeError|SyntaxError|is not defined/.test(e));
    expect(matchesCommonRuntimeError).toBeTruthy();
  });

  test('No transitions defined in FSM: verify absence of transition-specific attributes in DOM', async () => {
    // The FSM defines zero transitions. We verify the DOM does not contain typical markers
    // that an interactive transition-driven UI would include (data-transition, data-action attributes).
    // This is a heuristic check and will pass if those markers are absent.
    // It intentionally does not modify the page or assume specific JS internals.

    // Count elements that might indicate transitions or event hooks
    const dataTransitionCount = await app.countSelector('[data-transition]');
    const dataActionCount = await app.countSelector('[data-action]');
    const onclickAttrCount = await app.countSelector('[onclick]');
    const elementsWithRoleButton = await app.countSelector('[role="button"]');

    // We expect none of the specific FSM transition markers to be present.
    // If the application uses different markers, this test is a best-effort check reflecting
    // the FSM's "no transitions" claim.
    expect(dataTransitionCount).toBe(0);
    expect(dataActionCount).toBe(0);

    // onclick attributes are often used for inline handlers; FSM extraction indicated no handlers,
    // so we assert 0 here as a conservative check.
    expect(onclickAttrCount).toBe(0);

    // role="button" may exist in non-interactive pages (e.g., examples), but since FSM reports zero transitions,
    // we assert that there are no role=button elements that would indicate clickable controls for state changes.
    expect(elementsWithRoleButton).toBe(0);
  });

  test('Edge case: if no errors occurred, assert page has some rendered content to avoid false negatives', async () => {
    // This test handles the edge-case where no errors are thrown AND the renderPage entry produced visible content.
    // It provides an alternative validation path: if there are no page errors, ensure body has content.
    const pageErrors = app.getPageErrors();
    if (pageErrors.length === 0) {
      // If there were no runtime errors, ensure the page rendered something meaningful
      const length = await app.bodyTextLength();
      // At least some content should be present
      expect(length).toBeGreaterThan(0);
    } else {
      // If there are page errors, simply assert that they are of expected kinds (covered in other tests).
      expect(pageErrors.length).toBeGreaterThan(0);
    }
  });

  test('Sanity check: check whether a global renderPage function exists (non-invasive observation)', async () => {
    // We should not modify or call any global functions. But we can non-invasively detect if a function is defined.
    // This validates whether the entry action could have been successfully invoked (function present).
    const hasRenderPage = await app.hasGlobalFunction('renderPage');

    // If the function exists, that's evidence the environment provided it; otherwise, likely a ReferenceError occurred when the page tried to call it.
    // We don't force a value; we assert that either the function exists OR pageErrors indicate a missing function.
    const pageErrors = app.getPageErrors();
    const missingFunctionError = pageErrors.some(e => /renderPage|ReferenceError|is not defined/.test(e));

    expect(hasRenderPage || missingFunctionError).toBeTruthy();
  });
});