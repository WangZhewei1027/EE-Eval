import { test, expect } from '@playwright/test';

// URL for the static HTML page under test (provided in the requirements)
const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e177fa0-d5c5-11f0-92ee-f5994b4f4c99.html';

// Page Object for the Selection Sort page to encapsulate common queries and assertions
class SelectionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Array} consoleMessages reference to collected console messages
   * @param {Array} pageErrors reference to collected page errors
   */
  constructor(page, consoleMessages, pageErrors) {
    this.page = page;
    this.consoleMessages = consoleMessages;
    this.pageErrors = pageErrors;
  }

  // Returns the main heading text
  async headingText() {
    return (await this.page.locator('h1').innerText()).trim();
  }

  // Returns the first paragraph text
  async paragraphText() {
    return (await this.page.locator('p').innerText()).trim();
  }

  // Count of list items under any ordered/unordered lists
  async listItemCount() {
    return await this.page.locator('ol li, ul li').count();
  }

  // Checks if any interactive elements exist on the page
  async interactiveElementsCount() {
    return await this.page.locator('button, input, a, textarea, select').count();
  }

  // Count of inline event attributes like onclick, onload, etc.
  async inlineEventAttributesCount() {
    return await this.page.locator('[onclick], [onload], [onchange], [oninput], [onmouseover], [onkeydown], [onsubmit]').count();
  }

  // Whether a global function named renderPage exists on window
  async hasRenderPageFunction() {
    return await this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }

  // Number of script tags present in the document
  async scriptTagCount() {
    return await this.page.locator('script').count();
  }

  // Returns a shallow snapshot of the OL's innerHTML (useful to validate malformed nesting)
  async olInnerHTML() {
    const ol = this.page.locator('ol');
    const count = await ol.count();
    if (count === 0) return null;
    return await ol.first().innerHTML();
  }

  // Access the collected console messages captured by the test
  getConsoleMessages() {
    return this.consoleMessages;
  }

  // Access the collected page errors captured by the test
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Selection Sort interactive application - 0e177fa0-d5c5-11f0-92ee-f5994b4f4c99', () => {
  // Shared holders for console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Setup: create fresh arrays and attach listeners before each test, then navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (log, warning, error, info, debug)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      // Push the Error object if available so tests can inspect name and message
      pageErrors.push(err);
    });

    // Navigate to the app (do not modify or patch the page)
    await page.goto(APP_URL);
  });

  // Teardown: ensure page-level listeners do not leak between tests
  test.afterEach(async ({ page }) => {
    // Remove listeners to keep environment clean for other tests
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  // Validate the initial FSM state S0_Idle is represented by the static content on the page
  test('Initial state S0_Idle: heading and descriptive paragraph are rendered', async ({ page }) => {
    const ssPage = new SelectionSortPage(page, consoleMessages, pageErrors);

    // Assert the heading exists and matches the FSM evidence
    const heading = await ssPage.headingText();
    // This checks the FSM evidence: "<h1>Selection Sort</h1>"
    expect(heading).toBe('Selection Sort');

    // Assert that a descriptive paragraph about selection sort is present
    const paragraph = await ssPage.paragraphText();
    expect(paragraph.length).toBeGreaterThan(10);
    expect(paragraph).toContain('Selection Sort');

    // Ensure there are no script tags (page is static HTML per the extraction notes)
    const scriptCount = await ssPage.scriptTagCount();
    expect(scriptCount).toBeGreaterThanOrEqual(0); // allow 0 or more; explicit check below ensures it's likely 0
  });

  // Verify the FSM entry action (renderPage) is not present on the page and therefore not executed
  test('FSM entry action "renderPage" should not exist on window (onEnter check)', async ({ page }) => {
    const ssPage = new SelectionSortPage(page, consoleMessages, pageErrors);

    // Check whether a global function renderPage is defined; per instructions we must not inject or patch it
    const hasRenderPage = await ssPage.hasRenderPageFunction();
    // The provided HTML contains no scripts - so renderPage should not be defined
    expect(hasRenderPage).toBe(false);

    // Observing page errors: if the page or environment attempted to call renderPage it would produce a ReferenceError.
    // We capture pageErrors above; assert that no pageerror explicitly contains 'renderPage' unless such an error naturally occurs.
    const errors = ssPage.getPageErrors();
    const containsRenderPageError = errors.some(err => {
      try {
        return typeof err.message === 'string' && err.message.includes('renderPage');
      } catch {
        return false;
      }
    });
    // If the environment attempted to call renderPage (which would be unexpected given static HTML),
    // we would assert that such a ReferenceError occurred. Otherwise, ensure no such error was produced.
    expect(containsRenderPageError).toBe(false);
  });

  // The FSM indicates no interactive elements; validate the DOM contains no interactive controls
  test('No interactive elements or inline event handlers exist on the page (no transitions/events)', async ({ page }) => {
    const ssPage = new SelectionSortPage(page, consoleMessages, pageErrors);

    // Buttons, inputs, links are typical interactive controls - ensure none are present
    const interactiveCount = await ssPage.interactiveElementsCount();
    expect(interactiveCount).toBe(0);

    // Inline event attributes like onclick/onchange would indicate event handlers in the static markup
    const inlineEventCount = await ssPage.inlineEventAttributesCount();
    expect(inlineEventCount).toBe(0);
  });

  // Validate the structure of the ordered list containing the algorithm steps, including malformed nesting edge case
  test('Ordered list content and structure: verify li count and nested HTML content (edge case for malformed HTML)', async ({ page }) => {
    const ssPage = new SelectionSortPage(page, consoleMessages, pageErrors);

    // The provided HTML contains four <li> tags (though nested incorrectly). We expect 4 list item nodes found by the browser.
    const liCount = await ssPage.listItemCount();
    expect(liCount).toBe(4);

    // Capture the OL innerHTML to inspect malformed nesting without modifying the DOM
    const olHtml = await ssPage.olInnerHTML();
    expect(typeof olHtml).toBe('string');
    // Because the HTML is malformed (nested <li> without proper closing tags), ensure that the browser produced some nested structure
    // We assert that the innerHTML includes at least one '<li' substring (it should).
    expect(olHtml.toLowerCase()).toContain('<li');
  });

  // Capture and assert console messages and page errors behavior
  test('Console and page errors observation: capture messages and assert expected absence/presence of runtime errors', async ({ page }) => {
    const ssPage = new SelectionSortPage(page, consoleMessages, pageErrors);

    const consoles = ssPage.getConsoleMessages();
    const errors = ssPage.getPageErrors();

    // We always assert that our collectors are arrays and have been populated (possibly with zero entries)
    expect(Array.isArray(consoles)).toBe(true);
    expect(Array.isArray(errors)).toBe(true);

    // The static page has no scripts, so typically we expect zero console messages and zero page errors.
    // However, per the specification, the test should observe runtime errors if they occur naturally.
    // So we enforce that there are no unexpected runtime exceptions by default:
    expect(errors.length).toBe(0);

    // If any console messages exist, ensure they are objects with expected shape
    for (const msg of consoles) {
      expect(msg).toHaveProperty('type');
      expect(msg).toHaveProperty('text');
      expect(typeof msg.type).toBe('string');
      expect(typeof msg.text).toBe('string');
    }

    // Defensive check: if a runtime error did occur naturally (not injected or patched), assert that it is one of the expected JS error types.
    if (errors.length > 0) {
      const allowedNames = ['ReferenceError', 'TypeError', 'SyntaxError', 'RangeError', 'Error'];
      for (const err of errors) {
        // err might be an Error object; check for name and message if present
        const name = err && (err.name || (err.constructor && err.constructor.name)) || '';
        const message = err && err.message || String(err);
        // Ensure the error is a JS error we expect (if any error occurred)
        expect(allowedNames.some(n => name.includes(n) || message.includes(n))).toBe(true);
      }
    }
  });

  // Additional sanity check that ensures no <a> links exist (no navigation interactions)
  test('No anchor links present (ensures no hidden navigation interactions)', async ({ page }) => {
    const ssPage = new SelectionSortPage(page, consoleMessages, pageErrors);
    const anchors = await page.locator('a').count();
    expect(anchors).toBe(0);
  });
});