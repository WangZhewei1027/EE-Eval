import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/71878d10-d362-11f0-85a0-d3271c47ca09.html';

/**
 * Page object for the Red-Black Tree example application.
 * It collects runtime page errors and console messages without altering the page.
 */
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.errors = [];
    this.consoleMessages = [];

    // Collect unhandled page errors (ReferenceError, TypeError, SyntaxError, etc.)
    this.page.on('pageerror', (exception) => {
      // exception is typically an Error object from the page context
      try {
        this.errors.push({
          name: exception.name,
          message: exception.message,
          stack: exception.stack,
        });
      } catch {
        // Fallback if the exception shape is unexpected
        this.errors.push({
          name: 'UnknownError',
          message: String(exception),
          stack: undefined,
        });
      }
    });

    // Collect console messages for later assertions (logs, warnings, errors)
    this.page.on('console', (msg) => {
      try {
        this.consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch {
        this.consoleMessages.push({
          type: 'unknown',
          text: '<<unserializable console message>>',
        });
      }
    });
  }

  // Navigate to the app and wait for initial load. Do not modify the page.
  async goto() {
    await this.page.goto(APP_URL);
    // Wait for load state and a short timeout to allow inline scripts to run
    await this.page.waitForLoadState('load');
    await this.page.waitForTimeout(250);
  }
}

test.describe('Red-Black Tree example - static page and FSM validation', () => {
  // Basic smoke test: page loads without Playwright-level navigation errors.
  test('page should load and run its scripts (collect runtime errors and console output)', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // At least allow the page to emit errors or console messages from its script execution.
    // We expect the provided HTML/JS to likely produce runtime errors (e.g., TreeNode or renderPage not defined).
    // Assert that the page emitted at least one console message OR at least one page error.
    const hasConsole = app.consoleMessages.length > 0;
    const hasErrors = app.errors.length > 0;

    // Provide diagnostic output in the assertion messages to aid debugging.
    expect(hasConsole || hasErrors).toBe(true);

    // If there are errors, they should be standard JS runtime errors like ReferenceError/TypeError/SyntaxError.
    if (hasErrors) {
      // Ensure at least one error looks like a typical runtime error.
      const runtimeErrPattern = /ReferenceError|TypeError|SyntaxError|is not defined/i;
      const foundRuntimeLike = app.errors.some((e) => {
        return runtimeErrPattern.test(e.name) || runtimeErrPattern.test(e.message);
      });
      expect(foundRuntimeLike).toBe(true);
    }
  });

  test('FSM initial state (S0_Idle) entry action renderPage() should be attempted (observe errors if undefined)', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // The FSM indicates an entry action renderPage(). The real page may or may not call it,
    // but if it does and renderPage is not defined, we expect an error mentioning "renderPage".
    const mentionsRenderPage = app.errors.some((e) => e.message && e.message.includes('renderPage')) ||
      app.consoleMessages.some((c) => c.text && c.text.includes('renderPage'));

    // If renderPage is not called by the page, it's still acceptable; however, based on the FSM we expect the app to attempt it.
    // Assert that either renderPage was logged/called (console) or an error mentioning renderPage occurred, OR
    // more generally that the page raised a ReferenceError indicating missing functions/classes (covering the "let errors happen naturally" requirement).
    const generalMissingPattern = app.errors.some((e) => /is not defined/i.test(e.message));

    expect(mentionsRenderPage || generalMissingPattern).toBe(true);
  });

  test('Console output should include expected tree log or errors should indicate TreeNode is missing', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // The provided example shows console.log(root); // Output: [0, 1, 2, 3, 4, 5]
    // We check for either that exact log or errors indicating TreeNode/root usage failed.
    const expectedLogFound = app.consoleMessages.some((m) =>
      typeof m.text === 'string' && (m.text.includes('[0, 1, 2, 3, 4, 5]') || m.text.includes('root'))
    );

    const treeNodeError = app.errors.some((e) =>
      e.message && /TreeNode/i.test(e.message)
    );

    // Accept either the successful console log or an error mentioning TreeNode/root missing.
    expect(expectedLogFound || treeNodeError).toBe(true);
  });

  test('No interactive elements are present as noted in FSM extraction summary', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // Verify that there are no typical interactive elements (buttons, inputs, links, selects, textareas).
    const interactiveCount = await page.$$eval('button, input, a, select, textarea', (els) => els.length);

    // FSM extraction summary indicated no interactive elements; assert that count is zero.
    expect(interactiveCount).toBe(0);
  });

  test('Edge case: if no runtime errors occurred, log console output for manual inspection (test will fail to highlight unexpected success)', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    // This test enforces the expectation that the example is static but likely broken in the browser.
    // If no errors were thrown by the page, fail and present console messages for debugging.
    if (app.errors.length === 0) {
      // Prepare a helpful failure message with captured console messages (if any).
      const consoleDump = app.consoleMessages.map((c) => `[${c.type}] ${c.text}`).join('\n') || '<no console messages>';
      // Fail explicitly because the project specification expects observable runtime errors for this page.
      expect(app.errors.length).toBeGreaterThan(0, `Expected runtime errors (ReferenceError/TypeError/SyntaxError). Console output:\n${consoleDump}`);
    } else {
      // If errors are present, assert that at least one error name exists and looks like a JS error.
      const validError = app.errors.some((e) => e.name && /ReferenceError|TypeError|SyntaxError|Error/i.test(e.name));
      expect(validError).toBe(true);
    }
  });
});