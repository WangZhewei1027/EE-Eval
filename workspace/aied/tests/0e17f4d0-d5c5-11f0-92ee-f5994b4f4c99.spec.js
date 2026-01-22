import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e17f4d0-d5c5-11f0-92ee-f5994b4f4c99.html';

// Page object to encapsulate navigation and error/console capturing
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Bind listeners but do not navigate yet
    this.page.on('console', (msg) => {
      // Capture console messages: type and text
      try {
        this.consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // If something goes wrong capturing console, record a basic entry
        this.consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    this.page.on('pageerror', (err) => {
      // Capture runtime errors (ReferenceError, TypeError, SyntaxError when thrown at runtime)
      this.pageErrors.push({
        name: err.name || 'Error',
        message: err.message || String(err),
        stack: err.stack || '',
      });
    });
  }

  // Navigate to the app URL and wait a short time to allow scripts to execute and errors to surface
  async navigate() {
    // Navigate and wait for load event; script errors should still surface via 'pageerror' and 'console'
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Give the page a brief moment after load for any asynchronous errors or late logs to appear
    await this.page.waitForTimeout(500);
  }

  // Utility to get captured console messages
  getConsoleMessages() {
    return this.consoleMessages;
  }

  // Utility to get captured page errors
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Interactive Application - quicksort page validation (FSM: Idle)', () => {
  // Use Playwright's test fixture 'page'
  test.beforeEach(async ({ page }) => {
    // No-op setup here; each test will create its own AppPage and navigate
  });

  test.afterEach(async ({ page }) => {
    // Cleanup: reset listeners by closing the page context if needed
    // Playwright will automatically handle page lifecycle between tests.
    // We keep this hook for symmetry and future extensibility.
  });

  test('Initial load: page should be reachable and scripts (if any) should run', async ({ page }) => {
    // This test verifies the page loads and that any script errors are captured.
    const app = new AppPage(page);
    await app.navigate();

    const pageErrors = app.getPageErrors();
    const consoleMessages = app.getConsoleMessages();

    // We expect at least one script error due to the malformed quickSort implementation provided.
    // This validates that the runtime produced errors naturally without any patching.
    expect(pageErrors.length + consoleMessages.filter(m => /error/i.test(m.type) || /syntaxerror|referenceerror|typeerror/i.test(m.text.toLowerCase())).length).toBeGreaterThan(0);
  });

  test('Malformed JavaScript should produce a SyntaxError related to invalid list comprehensions', async ({ page }) => {
    // The provided implementation used Python-like list comprehensions; that should cause a SyntaxError.
    const app = new AppPage(page);
    await app.navigate();

    const pageErrors = app.getPageErrors();
    const consoleMessages = app.getConsoleMessages();

    const foundSyntaxInPageErrors = pageErrors.some(e => (e.name && e.name.toLowerCase().includes('syntaxerror')) || (e.message && e.message.toLowerCase().includes('syntaxerror')) || (e.message && e.message.toLowerCase().includes('unexpected')));
    const foundSyntaxInConsole = consoleMessages.some(m => m.text && m.text.toLowerCase().includes('syntaxerror'));

    // Assert that a syntax-related error was reported either in page errors or console
    expect(foundSyntaxInPageErrors || foundSyntaxInConsole).toBeTruthy();
  });

  test('Reference errors should occur for undefined identifiers (e.g., renderPage or quickSort variables)', async ({ page }) => {
    // FSM entry action listed "renderPage()", but the page JS does not define it — we expect a ReferenceError if it was invoked.
    const app = new AppPage(page);
    await app.navigate();

    const pageErrors = app.getPageErrors();
    const consoleMessages = app.getConsoleMessages();

    const foundRenderPageRef = pageErrors.some(e => e.message && e.message.toLowerCase().includes('renderpage')) ||
      consoleMessages.some(m => m.text && m.text.toLowerCase().includes('renderpage'));

    // The implementation also uses un-declared variables like pivot without const/let which may surface as ReferenceError or other issues.
    const foundPivotRef = pageErrors.some(e => e.message && e.message.toLowerCase().includes('pivot')) ||
      consoleMessages.some(m => m.text && m.text.toLowerCase().includes('pivot'));

    // At least one of these undefined identifier errors should be present; assert that the runtime reported undefined symbols.
    expect(foundRenderPageRef || foundPivotRef || pageErrors.length > 0).toBeTruthy();
  });

  test('Page contains no interactive form controls or links (as per FSM extraction summary)', async ({ page }) => {
    // The FSM extraction summary indicated no interactive elements; verify DOM reflects that.
    const app = new AppPage(page);
    await app.navigate();

    // Query for common interactive elements
    const interactiveSelectors = 'button, input, select, textarea, a, [role="button"], [tabindex]';
    const interactiveElements = await page.$$eval(interactiveSelectors, (els) => els.map(e => e.tagName.toLowerCase()));

    // We expect there to be either zero or very few interactive elements. The FSM said none were found, so assert none are present.
    // Allowing some slack: fail only if we detect elements that look interactive (buttons/links/inputs).
    const foundCoreInteractive = interactiveElements.some(tag => ['button', 'input', 'select', 'textarea', 'a'].includes(tag));
    expect(foundCoreInteractive).toBeFalsy();
  });

  test('Attempting to call quickSort in page context should surface errors (edge-case behavior)', async ({ page }) => {
    // This test intentionally calls quickSort in the page context to let any runtime or syntax errors manifest naturally.
    const app = new AppPage(page);
    await app.navigate();

    let evalError = null;
    try {
      // Attempt to call quickSort; if the page's script had syntax errors, quickSort may not be defined or calling it may throw.
      await page.evaluate(() => {
        // eslint-disable-next-line no-undef
        // Call quickSort if it exists
        if (typeof quickSort !== 'function') {
          // Trying to reference quickSort when it's not defined will throw a ReferenceError in some contexts
          // We explicitly attempt to access it to reproduce natural error behavior
          // Intentionally referencing an undefined identifier:
          // This may throw: ReferenceError: quickSort is not defined
          // But because typeof quickSort !== 'function' was checked above, referencing quickSort directly may still be safe.
          // To ensure we capture a natural error, we attempt to invoke it if defined.
          throw new Error('quickSort is not defined on the page');
        }
        return quickSort([4, 2, 9, 6, 1, 3, 5]);
      });
    } catch (e) {
      // Capture any error propagated back to the test harness
      evalError = e;
    }

    // The evaluation should have produced an error (either thrown by the page or by our manual throw when quickSort is missing).
    expect(evalError).not.toBeNull();

    // Ensure the error reason is related to definition/syntax of quickSort or JS parsing issues.
    const errMsg = String(evalError && evalError.message).toLowerCase();
    const acceptable = ['quicksort', 'not defined', 'syntaxerror', 'unexpected', 'unexpected identifier', 'unexpected token'];
    const matches = acceptable.some(substr => errMsg.includes(substr));
    expect(matches).toBeTruthy();
  });

  test('Collect and assert that runtime errors were reported to the pageerror handler (observability check)', async ({ page }) => {
    // Validate that at least one error was emitted through the pageerror event which Playwright captures.
    const app = new AppPage(page);
    await app.navigate();

    const pageErrors = app.getPageErrors();

    // There should be at least one pageerror captured (ReferenceError, SyntaxError, or TypeError).
    expect(pageErrors.length).toBeGreaterThan(0);

    // Log details in test output for debugging purposes (Playwright will show test output)
    for (const err of pageErrors) {
      // Assert that each captured error has a name and message
      expect(err.name).toBeTruthy();
      expect(err.message).toBeTruthy();
    }
  });

  // The FSM contains one initial state S0_Idle with an entry action "renderPage()".
  // We cannot modify the app. The tests above check that the runtime reported missing/invalid functions.
  // There are no transitions or events to trigger; assert the absence explicitly.
  test('FSM expectations: no transitions or events present (assert by checking page interactivity and absence of handlers)', async ({ page }) => {
    // Navigate and capture console/page errors
    const app = new AppPage(page);
    await app.navigate();

    // Check that there are no obvious event handlers in inline attributes for common interactive elements
    const inlineEventAttrs = await page.$$eval('*', (nodes) => {
      // Collect any elements that have inline event handler attributes like onclick, onchange, onsubmit, etc.
      const eventAttrs = ['onclick', 'ondblclick', 'onchange', 'onsubmit', 'oninput', 'onkeydown', 'onkeyup'];
      const found = [];
      for (const n of nodes) {
        for (const a of eventAttrs) {
          if (n.hasAttribute && n.hasAttribute(a)) {
            found.push({ tag: n.tagName.toLowerCase(), attr: a, value: n.getAttribute(a) });
          }
        }
      }
      return found;
    });

    // Expect no inline event handlers as extraction summary indicated zero event handlers
    expect(inlineEventAttrs.length).toBe(0);
  });
});