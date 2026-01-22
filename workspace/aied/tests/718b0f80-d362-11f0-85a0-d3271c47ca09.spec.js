import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/718b0f80-d362-11f0-85a0-d3271c47ca09.html';

/**
 * Page Object encapsulating common queries for the Kruskal page.
 */
class KruskalPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.title = page.locator('h1');
    this.description = page.locator('p');
    this.buttons = page.locator('button');
    this.inputs = page.locator('input, textarea, select');
    this.links = page.locator('a');
    this.algorithmClassElements = page.locator('.algorithm');
  }

  async titleText() {
    return this.title.textContent();
  }

  async descriptionText() {
    return this.description.textContent();
  }

  async countButtons() {
    return this.buttons.count();
  }

  async countInputs() {
    return this.inputs.count();
  }

  async countLinks() {
    return this.links.count();
  }

  async countAlgorithmClassElements() {
    return this.algorithmClassElements.count();
  }
}

test.describe('Kruskal Algorithm - FSM and page validations (S0_Idle)', () => {
  // Arrays to collect diagnostics observed during page load.
  let consoleMessages = [];
  let pageErrors = [];
  let failedRequests = [];

  // Attach listeners before each test and navigate to the page.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    failedRequests = [];

    // Capture console messages (info, warning, error, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught exceptions thrown on the page
    page.on('pageerror', (err) => {
      // err is an Error; include its message and stack
      pageErrors.push({
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
    });

    // Capture failed network requests (e.g., missing external script)
    page.on('requestfailed', (req) => {
      failedRequests.push({
        url: req.url(),
        method: req.method(),
        failureText: req.failure() && req.failure().errorText ? req.failure().errorText : String(req.failure()),
      });
    });

    // Navigate to the application page. We wait for "load" to ensure scripts attempted to load.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('renders the Idle state evidence (title and description)', async ({ page }) => {
    // This test validates that the initial FSM state S0_Idle evidence is present in the DOM.
    const kruskal = new KruskalPage(page);

    // Verify h1 exists and has the expected text
    const title = (await kruskal.titleText())?.trim();
    expect(title).toBeDefined();
    expect(title).toContain("Kruskal's Algorithm");

    // Verify paragraph text matches FSM evidence description
    const desc = (await kruskal.descriptionText())?.trim();
    expect(desc).toBeDefined();
    expect(desc).toContain('It is an algorithm for finding the maximum sum of two elements in a given array.');
  });

  test('does not render interactive controls (FSM expected no interactions)', async ({ page }) => {
    // FSM extraction indicated there are no interactive elements or handlers.
    // This test asserts there are no common interactive controls on the page.
    const kruskal = new KruskalPage(page);

    const btnCount = await kruskal.countButtons();
    const inputCount = await kruskal.countInputs();
    const linkCount = await kruskal.countLinks();
    const algClassCount = await kruskal.countAlgorithmClassElements();

    // Expect typical interactive controls to be absent (buttons/inputs).
    expect(btnCount).toBe(0);
    expect(inputCount).toBe(0);

    // Links may be present in other pages, but for this simple static page we expect none.
    // This is aligned with the FSM which reported no detected interactive elements.
    expect(linkCount).toBe(0);

    // The CSS contains a .algorithm rule but no element uses it in the provided HTML.
    // Assert that no element uses that class in the current DOM snapshot.
    expect(algClassCount).toBe(0);
  });

  test('observes external script load failures and runtime errors if they occur', async ({ page }) => {
    // The HTML references an external script 'kruskal-algorithm.js'.
    // This test validates that the test harness observes diagnostics (failed requests and page errors).
    // We intentionally do not modify the page; we only assert what naturally occurred.

    // Ensure we captured any failed network requests for the external script.
    const failedScriptRequests = failedRequests.filter((r) => r.url.endsWith('kruskal-algorithm.js'));
    // Also collect console error messages and JS runtime errors that mention "ReferenceError", "SyntaxError", or "TypeError"
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || /error/i.test(m.text));
    const jsRuntimeErrors = pageErrors.filter((e) =>
      /ReferenceError|SyntaxError|TypeError/.test(e.name) || /ReferenceError|SyntaxError|TypeError/.test(e.message)
    );

    // Diagnostic summary assertion:
    // At least one of the following should be true in a normal deployment of this HTML without patching:
    // - the external script request failed (commonly 404 if file missing)
    // - a console error was emitted
    // - a JS runtime error was thrown (pageerror)
    const diagnosticObserved = failedScriptRequests.length > 0 || consoleErrors.length > 0 || jsRuntimeErrors.length > 0;

    // We expect that the environment will show diagnostics because an external script is referenced.
    // If the external script exists and loads cleanly, this assertion could fail; however, the test
    // requirement specifies we must observe and assert such errors when they occur naturally.
    expect(diagnosticObserved).toBeTruthy();

    // Additional, more specific assertions for clarity in test output:
    if (failedScriptRequests.length > 0) {
      // There was at least one failed network request for the external script.
      expect(failedScriptRequests[0].url).toContain('kruskal-algorithm.js');
    }

    // Log captured diagnostics into the test output for easier debugging if the test fails.
    test.info().annotations.push({ type: 'console-messages', description: JSON.stringify(consoleMessages.slice(0, 10)) });
    test.info().annotations.push({ type: 'page-errors', description: JSON.stringify(pageErrors.slice(0, 10)) });
    test.info().annotations.push({ type: 'failed-requests', description: JSON.stringify(failedRequests.slice(0, 10)) });
  });

  test('validates entry action renderPage() expectations (observed outcome or error)', async ({ page }) => {
    // The FSM lists an entry action renderPage(). The HTML itself does not call it explicitly,
    // but an external script might expect to call it. We must not modify the runtime; we only observe.
    // Acceptable observed outcomes:
    // - A runtime ReferenceError mentioning renderPage (function missing)
    // - The page DOM was modified by a script (we detect changes relative to expected initial evidence)
    //
    // Strategy:
    // - Check for a page error mentioning renderPage
    // - If no error, check whether any additional DOM elements beyond the documented evidence exist,
    //   indicating the script ran and mutated the page.
    const renderPageErrors = pageErrors.filter((e) => /renderPage/.test(e.message) || /renderPage/.test(e.stack));
    if (renderPageErrors.length > 0) {
      // If renderPage was referenced but missing, we assert that at least one ReferenceError contains 'renderPage'
      const hasRenderPageRefError = renderPageErrors.some((e) => /ReferenceError|renderPage/.test(e.message));
      expect(hasRenderPageRefError).toBeTruthy();
    } else {
      // No explicit renderPage error detected. Check for DOM mutations beyond the two evidence nodes.
      // We will consider the page mutated if there are any elements (excluding html, head, body, h1, p)
      // in the document.body children other than the documented evidence.
      const bodyChildren = await page.locator('body').evaluate((body) => {
        // collect tag names and ids/classes to detect added nodes
        return Array.from(body.children).map((c) => ({ tag: c.tagName, id: c.id || null, class: c.className || null }));
      });

      // The provided HTML has exactly h1 and p under body (and a script tag which may or may not be present as an element).
      // If script successfully executed and mutated the page, the body children count is likely > 2 (excluding script tags).
      const bodyChildrenFiltered = bodyChildren.filter((c) => c.tag !== 'SCRIPT'); // ignore script element presence
      const extraNodesExist = bodyChildrenFiltered.length > 2;

      // Assert that either there was a renderPage error or the page was mutated by scripts.
      expect(extraNodesExist || renderPageErrors.length > 0).toBeTruthy();
    }
  });

  test('edge case: page should not throw unexpected errors beyond script load/runtime issues', async ({ page }) => {
    // This test ensures that only expected kinds of diagnostics are present.
    // We will fail the test if cryptic or unrelated errors (e.g., CSP violations, browser internals) occur.
    // Collect error names found
    const unexpectedErrors = pageErrors.filter((e) =>
      // Allow ReferenceError, SyntaxError, TypeError which are likely related to missing or faulty script
      !(/ReferenceError|SyntaxError|TypeError/.test(e.name) || /renderPage/.test(e.message))
    );

    // We do not want unrelated errors. If any unexpected error exists, fail the test with diagnostic info.
    expect(unexpectedErrors.length).toBe(0);
  });
});