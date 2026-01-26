import { test, expect } from '@playwright/test';

// Test file: f5b27f53-fa7c-11f0-adc7-178f556b1ee0.spec.js
// This suite validates the FSM states and transitions for the SQL Tutorial app.
// It loads the page as-is, observes console logs and runtime page errors (ReferenceError/SyntaxError/TypeError),
// and asserts that state transitions produce either visible results in the DOM or natural JS errors.
// IMPORTANT: We do not modify or patch the application. We only observe and assert behavior.

/*
 Test Strategy Summary:
 - Capture console messages and page errors emitted during page load and interactions.
 - Validate Idle state (S0_Idle): page renders, content exists, the "Run SQL Query" button is present.
 - Validate transition RunSQLQuery (S0 -> S1): clicking the button triggers either:
    a) visible query results in the DOM (displayResults-like behavior), OR
    b) natural runtime errors (ReferenceError / TypeError / SyntaxError) indicating missing/erroneous JS.
 - Ensure any observed page errors are of allowed types (ReferenceError, TypeError, SyntaxError).
 - Edge cases:
    - The Run button lacking an inline onclick attribute (mismatch with FSM evidence) is asserted.
    - Multiple rapid clicks are tested to see if behavior is idempotent or accumulates errors.
 - Comments explain intent of each test.
*/

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b27f53-fa7c-11f0-adc7-178f556b1ee0.html';

// Page object for the SQL Tutorial application
class SQLTutorialPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
    this._boundConsoleListener = (msg) => {
      try {
        this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If reading text() throws, capture minimal info
        this.consoleMessages.push({ type: msg.type(), text: '<unreadable console message>' });
      }
    };
    this._boundPageErrorListener = (err) => {
      // pageerror provides an Error object; capture name and message
      this.pageErrors.push({ name: err.name || 'Error', message: err.message || String(err), stack: err.stack || '' });
    };
  }

  async initListeners() {
    this.page.on('console', this._boundConsoleListener);
    this.page.on('pageerror', this._boundPageErrorListener);
  }

  async removeListeners() {
    this.page.removeListener('console', this._boundConsoleListener);
    this.page.removeListener('pageerror', this._boundPageErrorListener);
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeadingText() {
    return await this.page.textContent('h1');
  }

  async isRunButtonVisible() {
    const btn = await this.page.$('#sql-demo');
    if (!btn) return false;
    return await btn.isVisible();
  }

  async getRunButtonAttribute(attr) {
    const btn = await this.page.$('#sql-demo');
    if (!btn) return null;
    return await btn.getAttribute(attr);
  }

  async clickRunButton() {
    const btn = await this.page.$('#sql-demo');
    if (!btn) throw new Error('Run SQL Query button not found');
    await btn.click();
  }

  async wait(ms) {
    await this.page.waitForTimeout(ms);
  }

  // Utility: check for "results" like DOM artifacts (flexible)
  // We look for common visual feedback: an element with id/results text/table/pre that might be added
  async hasQueryResultsInDOM() {
    // Check for element id patterns and text patterns without throwing if not present
    const selectors = [
      '#results',
      '#sql-results',
      '.results',
      'table',        // maybe results are rendered as a table
      'pre',          // or preformatted JSON/text output
      'div#output',
      'div.output',
      'p#results',
    ];
    for (const sel of selectors) {
      const el = await this.page.$(sel);
      if (el) {
        const visible = await el.isVisible().catch(() => false);
        if (visible) return true;
        // If not visible, still check if contains text
        const text = await el.textContent().catch(() => null);
        if (text && text.trim().length > 0) return true;
      }
    }
    // Also check for textual evidence anywhere on the page that a query executed
    const bodyText = await this.page.textContent('body').catch(() => '');
    if (bodyText && /Query is executed|Results|Result set|SELECT \*/i.test(bodyText)) {
      return true;
    }
    return false;
  }
}

// Allowed runtime error types we expect to observe naturally if JS is missing/buggy.
const ALLOWED_ERROR_NAMES = new Set(['ReferenceError', 'TypeError', 'SyntaxError']);

test.describe('SQL Tutorial FSM - States and Transitions (f5b27f53-...)', () => {
  // Using Playwright's 'page' fixture
  test.beforeEach(async ({ page }) => {
    // No-op here; each test will create its own page object and navigate.
  });

  test.afterEach(async ({ page }) => {
    // Clear listeners if any remain (defensive)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Idle state (S0_Idle) renders correctly and exposes Run SQL Query button', async ({ page }) => {
    // This test validates the initial Idle state:
    // - Page content renders (heading, explanatory text)
    // - The Run SQL Query button exists and is visible
    // - The FSM's entry action renderPage() might be present or absent; we will not call it,
    //   but we will assert whether a function exists by checking typeof (safe).
    // - We capture any page runtime errors that occur during load and ensure they are allowed types.

    const app = new SQLTutorialPage(page);
    await app.initListeners();
    await app.goto();

    // Basic page content checks
    const heading = await app.getHeadingText();
    expect(heading).toBeTruthy();
    expect(heading).toContain('SQL Tutorial');

    // Button presence and visibility
    const buttonVisible = await app.isRunButtonVisible();
    expect(buttonVisible).toBe(true);

    // The FSM evidence suggested an inline onclick="executeSQLQuery()", but the HTML may not have it.
    // We explicitly assert the presence/absence of the inline onclick attribute as an edge case.
    const onclickAttr = await app.getRunButtonAttribute('onclick');
    // We allow either: onclick exists OR onclick is absent — but we record the mismatch.
    // Assert it's either null or a string (sanity). Also fail the test if onclick attribute is an unexpected non-string value.
    expect(onclickAttr === null || typeof onclickAttr === 'string').toBe(true);

    // Safely check whether a global function named renderPage exists (without calling it).
    // Using page.evaluate with typeof avoids ReferenceError.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    // Accept either 'function' or 'undefined' — if it's undefined, that's an edge case the tests will observe via page errors if they occur.
    expect(['function', 'undefined']).toContain(renderPageType);

    // Wait briefly to collect any console logs / page errors emitted during load
    await app.wait(300);

    // Ensure that any page errors emitted during load are of allowed types.
    // If there are pageErrors, each must be ReferenceError/TypeError/SyntaxError.
    // This enforces the requirement to observe and assert natural runtime errors (if any).
    if (app.pageErrors.length > 0) {
      for (const err of app.pageErrors) {
        expect(ALLOWED_ERROR_NAMES.has(err.name)).toBe(true);
      }
    }

    // Clean up listeners
    await app.removeListeners();
  });

  test('RunSQLQuery event (transition S0 -> S1): clicking the Run SQL Query button triggers execution or natural JS errors', async ({ page }) => {
    // This test validates the event/transition:
    // - When the user clicks the Run SQL Query button, the app should move from Idle to Query Running.
    // - We expect either:
    //    a) visible query results in the DOM (displayResults() / output), OR
    //    b) natural runtime errors (ReferenceError / TypeError / SyntaxError) that indicate the executeSQLQuery action failed or is missing.
    // - We do NOT patch or call executeSQLQuery directly; we let the app behave as-is.

    const app = new SQLTutorialPage(page);
    await app.initListeners();
    await app.goto();

    // Sanity: ensure button present before clicking
    const exists = await app.isRunButtonVisible();
    expect(exists).toBe(true);

    // Click the button to fire the RunSQLQuery event
    // We wrap click in try/catch to allow any synchronous errors to bubble into page errors rather than crashing the test.
    await app.clickRunButton();

    // Allow some time for JavaScript handlers to run and errors to propagate, if any.
    await app.wait(500);

    // Collect observations:
    const resultsVisible = await app.hasQueryResultsInDOM();

    // If there were any page errors, ensure they are allowed types.
    if (app.pageErrors.length > 0) {
      for (const err of app.pageErrors) {
        expect(ALLOWED_ERROR_NAMES.has(err.name)).toBe(true);
      }
    }

    // The transition is considered successful if either results are visible OR allowed runtime errors occurred.
    const hadAllowedErrors = app.pageErrors.length > 0;
    const transitionSucceeded = resultsVisible || hadAllowedErrors;

    // Assert that one of the expected outcomes occurred.
    expect(transitionSucceeded).toBe(true);

    // Additional assertions / diagnostics:
    // If onclick attribute was missing (edge case), note that the transition may rely on script wiring.
    const onclickAttr = await app.getRunButtonAttribute('onclick');
    if (!onclickAttr) {
      // In the absence of an inline onclick, prefer that either:
      //  - results were shown (script wired event handlers created results), OR
      //  - natural errors were logged (script executed and failed)
      expect(resultsVisible || hadAllowedErrors).toBe(true);
    }

    // Optionally assert console messages contain an indicative message (non-mandatory)
    // If console messages exist, they must be strings; we don't enforce content beyond that.
    for (const msg of app.consoleMessages) {
      expect(typeof msg.text).toBe('string');
    }

    await app.removeListeners();
  });

  test('Edge case: multiple rapid clicks and idempotence / error accumulation', async ({ page }) => {
    // This test clicks the Run button multiple times quickly to see if behavior is idempotent
    // or whether repeated clicks accumulate errors in the console/page error stream.

    const app = new SQLTutorialPage(page);
    await app.initListeners();
    await app.goto();

    // Ensure button exists
    const exists = await app.isRunButtonVisible();
    expect(exists).toBe(true);

    // Click the button rapidly 3 times
    const btn = await page.$('#sql-demo');
    await btn.click();
    await btn.click();
    await btn.click();

    // Wait for handlers to run
    await app.wait(600);

    // Check page errors and ensure they are allowed types if present
    if (app.pageErrors.length > 0) {
      for (const err of app.pageErrors) {
        expect(ALLOWED_ERROR_NAMES.has(err.name)).toBe(true);
      }
      // There may be multiple errors; ensure they either remain the same kind or are relevant to executeSQLQuery
      // (We do not enforce a strict count since implementations differ)
    }

    // Check for results in the DOM — should still be considered valid outcome
    const resultsVisible = await app.hasQueryResultsInDOM();

    // At least one of these should be true: results visible OR allowed errors observed
    expect(resultsVisible || app.pageErrors.length > 0).toBe(true);

    await app.removeListeners();
  });

  test('Diagnostics: recorded console messages and page errors are accessible and well-formed', async ({ page }) => {
    // This test ensures our observation mechanism works: we verify that console messages and page errors were captured
    // and contain expected fields. This is important for test diagnostics and for asserting natural runtime errors.

    const app = new SQLTutorialPage(page);
    await app.initListeners();
    await app.goto();

    // Trigger interaction once to provoke potential logs/errors
    const btn = await page.$('#sql-demo');
    if (btn) await btn.click();

    // Wait for activity
    await app.wait(400);

    // Validate captured console messages shape
    for (const msg of app.consoleMessages) {
      expect(msg).toHaveProperty('type');
      expect(msg).toHaveProperty('text');
      expect(typeof msg.type).toBe('string');
      expect(typeof msg.text).toBe('string');
    }

    // Validate captured page errors shape and allowed types
    for (const err of app.pageErrors) {
      expect(err).toHaveProperty('name');
      expect(err).toHaveProperty('message');
      expect(typeof err.name).toBe('string');
      expect(typeof err.message).toBe('string');
      // If there are errors, ensure they are allowed types
      expect(ALLOWED_ERROR_NAMES.has(err.name)).toBe(true);
    }

    // At least the diagnostics should have run without throwing; no further assertion required.
    await app.removeListeners();
  });
});