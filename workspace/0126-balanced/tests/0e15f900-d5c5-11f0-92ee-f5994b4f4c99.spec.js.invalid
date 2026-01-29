import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e15f900-d5c5-11f0-92ee-f5994b4f4c99.html';

test.describe('Red-Black Tree interactive application (FSM: Idle)', () => {
  // Arrays to collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;
  let consoleHandler;
  let pageErrorHandler;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages emitted by the page
    consoleHandler = msg => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      } catch (e) {
        // defensive: some console messages can throw when accessing location
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      }
    };
    page.on('console', consoleHandler);

    // Capture uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
    pageErrorHandler = error => {
      // error is an Error object; store its message for assertions
      pageErrors.push(error && error.message ? error.message : String(error));
    };
    page.on('pageerror', pageErrorHandler);

    // Navigate to the test HTML and wait for the load event to complete.
    // We let any runtime or parse errors occur naturally; we do not patch the page.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Give the page a short moment to surface asynchronous errors (if any).
    await page.waitForTimeout(100);
  });

  test.afterEach(async ({ page }) => {
    // Clean up event handlers to avoid cross-test leakage
    page.off('console', consoleHandler);
    page.off('pageerror', pageErrorHandler);
  });

  test('Idle state: initial DOM renders expected static elements', async ({ page }) => {
    // This validates the Idle state's evidence: presence of <div id="tree"></div>.
    // We also verify static headings and paragraph exist as described in the HTML.
    const h1 = await page.locator('h1').innerText();
    expect(h1).toBe('Red-Black Tree');

    const paragraph = await page.locator('p').innerText();
    expect(paragraph).toContain('This is a simple Red-Black tree');

    const treeExists = await page.locator('#tree').count();
    expect(treeExists).toBeGreaterThan(0);

    // Because the application script contains syntax/runtime issues,
    // we expect no list items were successfully appended to the #tree element.
    const liCount = await page.locator('#tree li').count();
    expect(liCount).toBe(0);
  });

  test('Script load results in syntax/runtime errors (expected failure cases are observed)', async ({ page }) => {
    // The provided HTML contains multiple JavaScript syntax/runtime issues.
    // This test asserts that at least one page error or console.error was emitted.
    // We combine both sources to be robust across browsers.
    const combinedMessages = [
      ...pageErrors.map(m => `PAGEERROR: ${m}`),
      ...consoleMessages.map(m => `${m.type.toUpperCase()}: ${m.text}`),
    ];

    // At least one error should be recorded by page.error or console.error
    expect(combinedMessages.length).toBeGreaterThan(0);

    // Ensure the messages contain at least one well-known error token:
    // - SyntaxError or Unexpected token (parse errors)
    // - ReferenceError / is not defined (runtime undefined)
    // - Non-ASCII insertion attempt or misspellings from the broken script
    const joined = combinedMessages.join(' | ');
    const errorRegex = /SyntaxError|Unexpected token|ReferenceError|is not defined|插入|taverse|taverse|Uncaught/i;
    expect(errorRegex.test(joined)).toBeTruthy();
  });

  test('Entry action renderPage() from FSM is not available on window (not implemented)', async ({ page }) => {
    // FSM entry_actions listed renderPage(), but the HTML does not define renderPage.
    // We assert that renderPage is not present on the global window object.
    const hasRenderPage = await page.evaluate(() => {
      // Do not call renderPage(); only check existence to avoid injecting behavior.
      return typeof window.renderPage !== 'function';
    });
    expect(hasRenderPage).toBeTruthy();
  });

  test('No interactive controls exist (no buttons/inputs), matching FSM extraction notes', async ({ page }) => {
    // FSM extraction notes indicate there are no interactive elements.
    // Confirm that the page contains no standard form controls or buttons.
    const controlsCount = await page.evaluate(() => {
      return document.querySelectorAll('button, input, textarea, select').length;
    });
    expect(controlsCount).toBe(0);
  });

  test('Tree container remains empty due to script parsing/execution failure (edge case)', async ({ page }) {
    // Edge case: script attempted to append nodes in a loop, but the script is malformed.
    // Ensure the #tree element has zero children (no <li> nodes appended).
    const childCount = await page.evaluate(() => {
      const root = document.getElementById('tree');
      return root ? root.children.length : -1;
    });
    // If the script failed to run entirely, children will be 0; if the script parsed incorrectly it might also be 0.
    expect(childCount).toBe(0);
  });

  test('Capture and inspect console error details for diagnostic purposes', async ({ page }) => {
    // This test demonstrates capturing the console error entries and making focused assertions.
    // We expect at least one console message of type 'error' or at least one pageerror.
    const errorTypeFound = consoleMessages.some(m => m.type === 'error');
    expect(errorTypeFound || pageErrors.length > 0).toBeTruthy();

    // If there are console error messages, ensure they include informative text.
    if (consoleMessages.length > 0) {
      const texts = consoleMessages.map(m => m.text).join(' | ');
      expect(texts.length).toBeGreaterThan(0);
    }

    // At least one of the collected pageErrors or console messages should contain keywords indicating
    // parse/runtime issues. This duplicates the earlier assertion in a more granular way.
    const allText = [...pageErrors, ...consoleMessages.map(m => m.text)].join(' | ');
    const diagnosticRegex = /SyntaxError|Unexpected token|ReferenceError|is not defined|插入|taverse/i;
    expect(diagnosticRegex.test(allText)).toBeTruthy();
  });
});