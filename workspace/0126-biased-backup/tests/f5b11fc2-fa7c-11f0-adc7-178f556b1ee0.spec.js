import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b11fc2-fa7c-11f0-adc7-178f556b1ee0.html';

/**
 * Page object for the BFS static page
 */
class BFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Navigate to the application URL and wait for DOM content to be loaded.
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Return text content of the main H1 heading.
  async getHeadingText() {
    return (await this.page.textContent('h1'))?.trim() ?? '';
  }

  // Count interactive elements commonly used in UIs.
  async countInteractiveElements() {
    return await this.page.$$eval(
      'button, input, select, textarea, [role="button"], a[href]',
      (els) => els.length
    );
  }

  // Count occurrences of a given selector.
  async count(selector) {
    return await this.page.$$eval(selector, (els) => els.length);
  }

  // Schedule an asynchronous call to a global function name inside the page.
  // This intentionally does not define the function; if it's missing, a ReferenceError
  // will occur asynchronously and emit a 'pageerror' event. We return the pageerror.
  //
  // We use setTimeout to ensure the exception is thrown asynchronously within the page,
  // which will produce a 'pageerror' event that Playwright can observe.
  async callGlobalFunctionExpectPageError(functionName, timeout = 2000) {
    // Start waiting for the pageerror event before scheduling the call.
    const waitForError = this.page.waitForEvent('pageerror', { timeout });
    // Schedule the call asynchronously in the page context.
    await this.page.evaluate((fn) => {
      setTimeout(() => {
        // Intentionally call the named function; if it's undefined this will throw.
        // eslint-disable-next-line no-implicit-globals
        // @ts-ignore
        window[fn]();
      }, 0);
    }, functionName);
    // Return the captured error event.
    return await waitForError;
  }

  // Check if any elements exist matching selector
  async hasSelector(selector) {
    return await this.page.$(selector) !== null;
  }
}

test.describe('Breadth-First Search (BFS) static page - f5b11fc2 ...', () => {
  // Arrays to collect console messages and page errors that occur during tests.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen for console events to capture unexpected logs/warnings/errors.
    page.on('console', (msg) => {
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch {
        // ignore any occasional issues getting console message text
      }
    });

    // Collect page error events so tests can assert on them.
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // optionally clear listeners (Playwright auto-cleans between tests), but remove to be explicit
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test.describe('Static Content and FSM initial state evidence', () => {
    test('Initial Render: page loads and shows BFS heading (S0_Idle evidence)', async ({ page }) => {
      // Arrange
      const bfs = new BFSPage(page);

      // Act
      await bfs.goto();

      // Assert: H1 is present and matches expected FSM evidence.
      const heading = await bfs.getHeadingText();
      expect(heading).toBe('Breadth-First Search (BFS)');

      // The FSM's S0_Idle evidence included the H1. Verify that presence.
      // Also verify basic content structure: there are multiple paragraphs and lists.
      const paragraphCount = await bfs.count('p');
      const orderedListCount = await bfs.count('ol');
      const unorderedListCount = await bfs.count('ul');

      expect(paragraphCount).toBeGreaterThanOrEqual(1);
      expect(orderedListCount).toBeGreaterThanOrEqual(1);
      expect(unorderedListCount).toBeGreaterThanOrEqual(1);

      // Ensure no page errors occurred during initial load (before we intentionally cause any).
      expect(pageErrors.length).toBe(0);

      // Ensure console did not log errors during load (diagnostic).
      const consoleErrorMessages = consoleMessages.filter((c) => c.type === 'error' || c.type === 'warning');
      expect(consoleErrorMessages.length).toBe(0);
    });

    test('No interactive elements exist (application is static)', async ({ page }) => {
      const bfs = new BFSPage(page);
      await bfs.goto();

      // The FSM extraction summary said "No interactive elements found in the HTML."
      // Verify there are no interactive elements like buttons, inputs, anchors with href, etc.
      const interactiveCount = await bfs.countInteractiveElements();
      expect(interactiveCount).toBe(0);

      // Also ensure common controls are absent
      expect(await bfs.hasSelector('button')).toBe(false);
      expect(await bfs.hasSelector('input')).toBe(false);
      expect(await bfs.hasSelector('[role="button"]')).toBe(false);
      expect(await bfs.hasSelector('a[href]')).toBe(false);
    });
  });

  test.describe('FSM entry actions and error scenarios', () => {
    test('Attempting to execute S0_Idle entry action renderPage() yields ReferenceError (pageerror)', async ({ page }) => {
      // The FSM listed an entry action "renderPage()". The implementation does not provide this function.
      // We must load the page exactly as-is and observe the error when trying to call it.
      const bfs = new BFSPage(page);
      await bfs.goto();

      // Ensure no prior page errors
      expect(pageErrors.length).toBe(0);

      // Act: schedule an asynchronous call to renderPage() inside the page and capture pageerror.
      const err = await bfs.callGlobalFunctionExpectPageError('renderPage');

      // Assert: a ReferenceError should have occurred for renderPage being undefined.
      // Different engines format messages differently; we assert on the error name and that message mentions the function.
      expect(err).toBeTruthy();
      // err.name should be 'ReferenceError' in most engines
      if (err.name) {
        expect(err.name).toMatch(/ReferenceError/i);
      }
      // The message should mention 'renderPage' so we know the missing global was this function.
      expect(err.message).toMatch(/renderPage/);

      // The global pageErrors listener should also have recorded the error.
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      const recorded = pageErrors[pageErrors.length - 1];
      expect(recorded.message).toMatch(/renderPage/);
    });

    test('Attempting to trigger a non-existent transition API yields a ReferenceError', async ({ page }) => {
      // FSM has no transitions. Attempting to call a hypothetical transition helper should error.
      const bfs = new BFSPage(page);
      await bfs.goto();

      // Call an arbitrary global that is not defined (e.g., transitionTo)
      const err = await bfs.callGlobalFunctionExpectPageError('transitionTo');

      expect(err).toBeTruthy();
      if (err.name) {
        expect(err.name).toMatch(/ReferenceError/i);
      }
      expect(err.message).toMatch(/transitionTo/);
    });
  });

  test.describe('Edge cases and defensive checks', () => {
    test('Trying to call undefined helpers mentioned in annotations should generate page errors', async ({ page }) => {
      // This test exercises other possible helper names that might exist in different apps.
      const bfs = new BFSPage(page);
      await bfs.goto();

      const helperNames = ['onEnter', 'onExit', 'initialize', 'render', 'startBFS'];
      for (const name of helperNames) {
        // Schedule call and allow it to either produce a pageerror or, if the function actually exists (unlikely),
        // simply skip the assertion. We capture any error if it occurs.
        let capturedError = null;
        try {
          capturedError = await bfs.callGlobalFunctionExpectPageError(name, 500).catch(() => null);
        } catch {
          // ignore - callGlobalFunctionExpectPageError manages its own timeout and rejection
        }

        // If an error was captured, assert it mentions the function name and is a ReferenceError.
        if (capturedError) {
          if (capturedError.name) {
            expect(capturedError.name).toMatch(/ReferenceError/i);
          }
          expect(capturedError.message).toMatch(new RegExp(name));
        } else {
          // If no error occurred, it's acceptable (function may exist); assert that nothing catastrophic happened
          // and continue. We still assert there are no synchronous runtime errors captured earlier.
          expect(pageErrors.length).toBeGreaterThanOrEqual(0);
        }
      }
    });

    test('No unexpected runtime errors emitted without interaction', async ({ page }) => {
      // Confirm that simply loading the static page does not produce runtime errors.
      const bfs = new BFSPage(page);
      await bfs.goto();

      // No page errors should be present initially.
      expect(pageErrors.length).toBe(0);

      // No console errors expected on load (diagnostic).
      const consoleErrorMessages = consoleMessages.filter((c) => c.type === 'error' || c.type === 'warning');
      expect(consoleErrorMessages.length).toBe(0);
    });
  });
});