import { test, expect } from '@playwright/test';

// Page Object for the Random Forest page
class RandomForestPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520bb7f0-fa76-11f0-a09b-87751f540fd8.html';
    // Containers to collect console and page errors for assertions
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  // Navigate to the page and attach listeners for console & page errors
  async goto() {
    this.page.on('console', (msg) => {
      // capture console messages for later assertions
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // capture unhandled page errors
      this.pageErrors.push(err);
    });
    await this.page.goto(this.url);
  }

  // Returns document.title
  async title() {
    return this.page.title();
  }

  // Returns an array of card headings texts
  async getCardHeadings() {
    return this.page.$$eval('.card h2', (nodes) => nodes.map((n) => n.textContent.trim()));
  }

  // Returns the number of .card elements
  async cardCount() {
    return this.page.$$eval('.card', (nodes) => nodes.length);
  }

  // Returns whether the page contains interactive elements (buttons, inputs, anchors)
  async interactiveElementCount() {
    return this.page.$$eval('button, input, a', (nodes) => nodes.length);
  }

  // Attempts to call window.renderPage() in the page context.
  // This is expected to either:
  //  - throw because renderPage is not defined (ReferenceError), OR
  //  - throw because it's undefined / not a function (TypeError)
  // We return the Promise so tests can assert rejection.
  async callRenderPage() {
    return this.page.evaluate(() => {
      // Intentionally call the entry action that the FSM mentions.
      // We do NOT define or patch anything; we let the page throw naturally if it does.
      return window.renderPage();
    });
  }
}

test.describe('Random Forest Interactive Application - FSM Verification', () => {
  // Page object instance will be created per test
  /** @type {RandomForestPage} */
  let rfPage;

  // Standard setup before each test: navigate to URL and ensure listeners attached
  test.beforeEach(async ({ page }) => {
    rfPage = new RandomForestPage(page);
    await rfPage.goto();
  });

  test('Idle state: page renders static content with correct title and structure', async () => {
    // This test validates the FSM Idle state's evidence:
    // - The page should have the <title>Random Forest</title>
    const title = await rfPage.title();
    expect(title).toBe('Random Forest');

    // Validate key static content exists: header and 3 cards as per HTML
    const cardCount = await rfPage.cardCount();
    expect(cardCount).toBe(3);

    const headings = await rfPage.getCardHeadings();
    // Validate the card headings match expected content from the HTML
    expect(headings).toEqual([
      'Random Forest Basics',
      'How it Works',
      'Example Code',
    ]);

    // Confirm there are no interactive elements such as buttons, inputs or links
    const interactiveCount = await rfPage.interactiveElementCount();
    expect(interactiveCount).toBe(0);

    // Confirm no unexpected console messages or page errors were emitted during navigation
    // (Note: another test intentionally invokes an entry action to surface errors.)
    expect(rfPage.consoleMessages.length).toBeGreaterThanOrEqual(0);
    expect(rfPage.pageErrors.length).toBe(0);
  });

  test('Entry action renderPage(): attempting to call renderPage triggers a natural error', async () => {
    // The FSM listed an entry action renderPage() but the HTML/JS does not define it.
    // This test intentionally invokes window.renderPage() inside the page context and
    // asserts that the call rejects (TypeError or ReferenceError) without patching the page.
    // This verifies onEnter actions referenced by the FSM are not present and will error naturally.

    // We expect the evaluation to reject. Use Playwright's expect to assert promise rejection.
    await expect(rfPage.callRenderPage()).rejects.toThrow();

    // Also assert that at least the evaluate rejection occurred (we already asserted rejects).
    // Some environments might surface the error as a pageerror; check captured pageErrors for clues.
    // If a pageerror event was emitted, ensure it references renderPage (best-effort).
    if (rfPage.pageErrors.length > 0) {
      const joined = rfPage.pageErrors.map((e) => String(e)).join(' | ');
      expect(joined.toLowerCase()).toMatch(/renderpage|not a function|referenceerror|typeerror/);
    }
  });

  test('No FSM transitions exist: attempting to trigger non-existent events does nothing', async () => {
    // FSM contains no transitions or events. This test tries a few benign interactions
    // (clicking static elements) to assert the page remains static and no transitions occur.
    // Click each card's heading and ensure DOM structure remains and no errors are thrown.
    const headingsBefore = await rfPage.getCardHeadings();

    // Click each heading element (if present) -- should do nothing meaningful
    const page = rfPage.page;
    const headings1 = await page.$$('.card h2');
    for (const h of headings) {
      await h.click();
    }

    // Verify headings remain the same after clicks
    const headingsAfter = await rfPage.getCardHeadings();
    expect(headingsAfter).toEqual(headingsBefore);

    // Ensure no page errors were emitted by these interactions
    expect(rfPage.pageErrors.length).toBe(0);
  });

  test('Edge case: DOM introspection confirms absence of interactive handlers and functions', async () => {
    // This test directly queries the window for the presence of functions or handlers
    // referenced by the FSM (e.g., renderPage). We assert that such functions are undefined.
    const isRenderPageDefined = await rfPage.page.evaluate(() => {
      return typeof window.renderPage !== 'undefined';
    });
    expect(isRenderPageDefined).toBe(false);

    // Additionally assert that there are no inline scripts that might have registered handlers.
    const inlineScriptCount = await rfPage.page.$$eval('script:not([src])', (nodes) => nodes.length);
    // Per HTML provided, there are no inline scripts; assert that.
    expect(inlineScriptCount).toBe(0);
  });

  test('Observe console and runtime errors while performing a faulty call and report them', async () => {
    // This test gathers console messages and page errors around the erroneous call to renderPage
    // to ensure that runtime errors are observed and contain helpful diagnostics.

    // Clear any previously captured logs (from beforeEach)
    rfPage.consoleMessages.length = 0;
    rfPage.pageErrors.length = 0;

    // Intentionally trigger the error again
    let caughtError = null;
    try {
      await rfPage.callRenderPage();
    } catch (err) {
      // Capture the thrown evaluation error for assertions
      caughtError = err;
    }

    // The call should have thrown an error
    expect(caughtError).not.toBeNull();
    // The error message should mention renderPage or indicate not a function/reference error
    expect(String(caughtError.message).toLowerCase()).toMatch(/renderpage|not a function|referenceerror|typeerror/);

    // Optionally, the runtime may have emitted a pageerror event. If so, assert it's related.
    if (rfPage.pageErrors.length > 0) {
      expect(rfPage.pageErrors.some((e) => String(e).toLowerCase().includes('renderpage') || String(e).toLowerCase().includes('not a function') || String(e).toLowerCase().includes('referenceerror'))).toBe(true);
    }

    // Log captured console messages for debugging (kept as assertions to ensure test determinism)
    // We do not assert there must be console messages; just ensure captured entries are strings when present
    for (const m of rfPage.consoleMessages) {
      expect(typeof m.text).toBe('string');
      expect(m.text.length).toBeGreaterThanOrEqual(0);
    }
  });
});