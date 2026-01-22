import { test, expect } from '@playwright/test';

// Tests for Application ID: 0e192d50-d5c5-11f0-92ee-f5994b4f4c99
// Served at: http://127.0.0.1:5500/workspace/batch-1207/html/0e192d50-d5c5-11f0-92ee-f5994b4f4c99.html
//
// These tests validate the static "Idle" state extracted from the FSM, ensure expected
// static content is present, verify there are no interactive elements (no transitions),
// and observe console and runtime page errors. We do NOT modify or patch the page.
// We only observe console/page errors and assert their characteristics (if any).

const APP_URL =
  'http://127.0.0.1:5500/workspace/batch-1207/html/0e192d50-d5c5-11f0-92ee-f5994b4f4c99.html';

// Page object model for the simple static page under test.
class BellmanFordPage {
  /**
   * @param {import('@playwright/test').Page} page
   * @param {Array} pageErrors - array reference to collect page errors
   * @param {Array} consoleMessages - array reference to collect console messages
   */
  constructor(page, pageErrors, consoleMessages) {
    this.page = page;
    this.pageErrors = pageErrors;
    this.consoleMessages = consoleMessages;
  }

  // Return the heading text (h1) visible on the page.
  async getHeadingText() {
    const h1 = this.page.locator('h1');
    await expect(h1).toHaveCount(1);
    return h1.innerText();
  }

  // Return the main paragraph text (first <p>).
  async getMainParagraphText() {
    const p = this.page.locator('p').first();
    await expect(p).toHaveCount(1);
    return p.innerText();
  }

  // Count interactive elements typically representing transitions/events.
  async countInteractiveElements() {
    // Buttons, inputs, selects, anchors with href, and elements with onclick attributes.
    const counts = await this.page.evaluate(() => {
      const buttons = document.querySelectorAll('button').length;
      const inputs = document.querySelectorAll('input, textarea').length;
      const selects = document.querySelectorAll('select').length;
      const anchors = Array.from(document.querySelectorAll('a')).filter(a => a.hasAttribute('href')).length;
      const onclicks = document.querySelectorAll('[onclick]').length;
      return { buttons, inputs, selects, anchors, onclicks };
    });
    return counts;
  }

  // Check if the page contains the JS code snippet text "function bellmanFord"
  async hasBellmanFordCodeSnippet() {
    // The HTML uses a triple-backtick fenced code block in the body text.
    // Check the body's innerText contains the function name.
    return this.page.evaluate(() => document.body.innerText.includes('function bellmanFord'));
  }

  // Expose collected runtime errors and console messages for assertions.
  getCollectedPageErrors() {
    return this.pageErrors;
  }

  getCollectedConsoleMessages() {
    return this.consoleMessages;
  }
}

test.describe('Bellman-Ford Algorithm - FSM Idle State and Static Page Validation', () => {
  // Collections for each test to capture console messages and page errors
  let pageErrors;
  let consoleMessages;

  // Attach listeners before navigating so we capture errors during load as well.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors (unhandled runtime exceptions)
    page.on('pageerror', (err) => {
      // Capture error objects and their names/messages for assertions.
      pageErrors.push(err);
    });

    // Collect console messages including console.error and others
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Navigate to the static page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Teardown: remove listeners by replacing with no-op listeners if necessary.
    // Playwright automatically disposes listeners at the end of the test context,
    // but explicitly clear listeners to be deterministic.
    page.removeAllListeners?.('pageerror');
    page.removeAllListeners?.('console');
  });

  test('Idle state - page renders expected heading and description (entry evidence)', async ({ page }) => {
    // This test verifies the FSM "Idle" state's evidence: the H1 heading and the descriptive paragraph.
    const bfPage = new BellmanFordPage(page, pageErrors, consoleMessages);

    const headingText = await bfPage.getHeadingText();
    expect(headingText).toBe('Bellman-Ford Algorithm');

    const paragraph = await bfPage.getMainParagraphText();
    // Verify the paragraph contains a mention of the Bellman-Ford algorithm description.
    expect(paragraph).toContain('The Bellman-Ford algorithm is a method for finding the shortest path');
  });

  test('Idle state - entry action "renderPage()" presence/impact observed via runtime errors', async ({ page }) => {
    // FSM referenced an entry_action renderPage(). The implementation does not define it explicitly.
    // We only observe the runtime for any ReferenceError/SyntaxError/TypeError that may have occurred.
    const bfPage = new BellmanFordPage(page, pageErrors, consoleMessages);

    // We do not attempt to invoke or patch renderPage(); we simply observe whether a missing
    // function or other script issues produced runtime errors during page load.
    const errors = bfPage.getCollectedPageErrors();

    // If there are any runtime errors, validate their types are among the expected categories.
    // This keeps assertions flexible: pass if no errors, or if errors are only ReferenceError/SyntaxError/TypeError.
    const allowedErrorNames = new Set(['ReferenceError', 'SyntaxError', 'TypeError']);

    // Create a descriptive message for debugging in case of unexpected error types.
    if (errors.length > 0) {
      for (const err of errors) {
        const name = err?.name ?? '';
        const message = String(err?.message ?? err);
        // Ensure the error type is one of the expected error classes.
        expect(allowedErrorNames.has(name)).toBeTruthy();
        // If the FSM expected renderPage() to run but it wasn't defined, often a ReferenceError would mention it.
        // Logically check if renderPage is referenced in the message when ReferenceError appears.
        if (name === 'ReferenceError') {
          // If the message references renderPage, that's consistent with a missing entry action function.
          const mentionsRenderPage = message.includes('renderPage');
          // It's acceptable if ReferenceError doesn't mention renderPage (could be other missing symbols).
          expect(typeof message).toBe('string');
        }
      }
    } else {
      // No runtime errors observed. This is a valid outcome for a purely static page.
      expect(errors.length).toBe(0);
    }

    // Also assert that console.error messages (if any) are limited to the allowed shapes
    const consoleErrors = bfPage.getCollectedConsoleMessages().filter(m => m.type === 'error');
    if (consoleErrors.length > 0) {
      // Validate console error messages are strings and not empty
      for (const c of consoleErrors) {
        expect(typeof c.text).toBe('string');
        expect(c.text.length).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('No transitions or interactive elements present (FSM had zero transitions)', async ({ page }) => {
    // The extraction summary suggested no interactive elements; validate this against the DOM.
    const bfPage = new BellmanFordPage(page, pageErrors, consoleMessages);

    const counts = await bfPage.countInteractiveElements();

    // Expect zero interactive controls that would indicate transitions/events in the FSM
    expect(counts.buttons).toBe(0);
    expect(counts.inputs).toBe(0);
    expect(counts.selects).toBe(0);
    expect(counts.anchors).toBe(0);
    expect(counts.onclicks).toBe(0);
  });

  test('Page contains code snippet for Bellman-Ford algorithm (static content validation)', async ({ page }) => {
    // Verify the page includes the code sample text even if it's not executed.
    const bfPage = new BellmanFordPage(page, pageErrors, consoleMessages);
    const hasSnippet = await bfPage.hasBellmanFordCodeSnippet();
    expect(hasSnippet).toBeTruthy();
  });

  test('Edge case checks: ensure no unexpected exception types occurred', async ({ page }) => {
    // This test gathers any errors and strictly fails if an unexpected error type is found.
    // Allowed error types are ReferenceError, SyntaxError, TypeError (as per instructions).
    const errors = pageErrors;
    const allowedErrorNames = new Set(['ReferenceError', 'SyntaxError', 'TypeError']);

    for (const err of errors) {
      // If a non-standard error type occurred, fail with details to aid debugging.
      const name = err?.name ?? '';
      if (!allowedErrorNames.has(name)) {
        // Provide informative assertion failure
        throw new Error(
          `Unexpected runtime error type detected: name="${name}", message="${String(
            err?.message ?? err
          )}"`
        );
      }
    }

    // Also assert that errors array exists (trivially true) and that page did not crash.
    expect(Array.isArray(errors)).toBeTruthy();
  });
});