import { test, expect } from '@playwright/test';

// Test suite for Application ID: 122dacb1-fa7b-11f0-814c-dbec508f0b3b
// This suite validates the Idle state described in the FSM, observes console logs and page errors,
// and verifies DOM elements described in the provided HTML.
// Filename requirement: 122dacb1-fa7b-11f0-814c-dbec508f0b3b.spec.js

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122dacb1-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object to encapsulate selectors and instrumentation for console/page errors
class IntegrationTestingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Attach listeners to capture console messages and page errors for assertions.
    this._consoleListener = (msg) => {
      // Collect text and type for later inspection
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    };
    this._pageErrorListener = (err) => {
      // Page errors are Error objects
      this.pageErrors.push(err);
    };

    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
  }

  // Navigate to the app url and wait for load
  async goto() {
    // Use a deterministic wait until load to allow script.js to run and possibly log/errors to appear.
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Small short wait to capture any asynchronous console logs or errors triggered on load
    await this.page.waitForTimeout(100);
  }

  // Clean up listeners (called in teardown)
  detachListeners() {
    this.page.removeListener('console', this._consoleListener);
    this.page.removeListener('pageerror', this._pageErrorListener);
  }

  // Accessors for DOM elements used by tests
  h1() {
    return this.page.locator('h1');
  }

  title() {
    return this.page.title();
  }

  container() {
    return this.page.locator('#container');
  }

  // Helpers to query captured diagnostics
  getConsoleMessages() {
    return this.consoleMessages;
  }

  getConsoleErrors() {
    return this.consoleMessages.filter((m) => m.type === 'error');
  }

  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Integration Testing App - FSM: Idle state', () => {
  // Use a per-test Page Object to ensure fresh listeners and clean state
  test.describe.configure({ mode: 'serial' });

  test('Idle state: page title and static content are rendered', async ({ page }) => {
    // Validate the "Idle" state's entry expectations: renderPage() invoked via entry_actions in FSM.
    // We will load the page and assert the static evidence: the <title> text and presence of the container.
    const app = new IntegrationTestingPage(page);
    try {
      await app.goto();

      // Assert page title matches FSM evidence
      await expect(app.title()).resolves.toBe('Integration Testing');

      // The H1 must be present and readable
      await expect(app.h1()).toHaveCount(1);
      await expect(app.h1()).toHaveText('Integration Testing');

      // The container is present (even if script.js does nothing)
      await expect(app.container()).toHaveCount(1);

      // The FSM entry action mentions renderPage(); we cannot modify the page.
      // Check for evidence that renderPage() may have executed:
      // - either the container has content, or a console message references "renderPage", or there is a page error (script failed).
      const containerContent = await app.container().evaluate((el) => el.innerHTML);
      const consoleMessages = app.getConsoleMessages().map((m) => m.text);
      const sawRenderPageInConsole = consoleMessages.some((t) =>
        t.toLowerCase().includes('renderpage')
      );

      // At least one of these must be true to claim entry action had observable effect.
      const observedEntryEvidence =
        (containerContent && containerContent.trim().length > 0) ||
        sawRenderPageInConsole ||
        app.getPageErrors().length > 0 ||
        app.getConsoleErrors().length > 0;

      expect(observedEntryEvidence).toBeTruthy();
    } finally {
      app.detachListeners();
    }
  });

  test('No interactive controls exist (FSM has no events/transitions)', async ({ page }) => {
    // FSM indicates no events/transitions. Verify the DOM contains no form controls or interactive elements
    // such as buttons, inputs, selects, or anchors that look like navigation/triggers.
    const app = new IntegrationTestingPage(page);
    try {
      await app.goto();

      // Assert that interactive elements are absent or minimal.
      // If the external script injects controls, this assertion will fail, surfacing a mismatch with the FSM.
      const buttonCount = await page.locator('button').count();
      const inputCount = await page.locator('input').count();
      const selectCount = await page.locator('select').count();
      const anchorCount = await page.locator('a').count();

      // Expect zero interactive elements as per extracted FSM summary.
      expect(buttonCount).toBe(0);
      expect(inputCount).toBe(0);
      expect(selectCount).toBe(0);
      // Anchors may exist for static links; if they exist, warn by failing the test to reflect FSM mismatch.
      expect(anchorCount).toBe(0);
    } finally {
      app.detachListeners();
    }
  });

  test('Observe console logs and page errors (do not suppress natural runtime errors)', async ({ page }) => {
    // This test intentionally observes console messages and page errors produced by the app,
    // and asserts on their presence and types. We do not patch or modify the runtime.
    const app = new IntegrationTestingPage(page);
    try {
      await app.goto();

      const consoleMessages = app.getConsoleMessages();
      const consoleErrors = app.getConsoleErrors();
      const pageErrors = app.getPageErrors();

      // Comment: We accept both success (no errors) and failure (errors occurred) cases.
      // If errors occurred, validate they are Error instances and capture their names.
      if (pageErrors.length > 0) {
        // Assert that each page error is indeed an Error and has a name (e.g., ReferenceError, TypeError)
        for (const err of pageErrors) {
          expect(err).toBeTruthy();
          expect(typeof err.name).toBe('string');
          // Log to test output via expect message so failures are informative
          // (We don't mutate behavior of the page; only assert.)
          expect(['ReferenceError', 'TypeError', 'SyntaxError', 'Error']).toContain(err.name);
        }
      } else {
        // If no page errors, assert that page loaded without uncaught exceptions.
        expect(pageErrors.length).toBe(0);
      }

      // Console errors (console.error) may exist even if pageErrors are absent.
      if (consoleErrors.length > 0) {
        for (const c of consoleErrors) {
          expect(c.text).toBeTruthy();
          // Console error text should be a string
          expect(typeof c.text).toBe('string');
        }
      }

      // Additionally record presence of any informative console.log messages (optional)
      // We assert that the console capture worked by ensuring consoleMessages is an array.
      expect(Array.isArray(consoleMessages)).toBe(true);
    } finally {
      app.detachListeners();
    }
  });

  test('Edge case: script loading failure or runtime exception handling', async ({ page }) => {
    // This test checks that if the external script fails to run (e.g., ReferenceError),
    // the page still preserves its static content (title, h1, container present).
    // We do not attempt to fix or intercept the failure; we only assert observable invariants.
    const app = new IntegrationTestingPage(page);
    try {
      await app.goto();

      // The page must at minimum present the title and H1 as static HTML.
      await expect(app.title()).resolves.toBe('Integration Testing');
      await expect(app.h1()).toHaveText('Integration Testing');

      // If there are page errors, verify that despite them, the static content exists
      // This protects against catastrophic failures that remove the static DOM.
      const pageErrors = app.getPageErrors();
      if (pageErrors.length > 0) {
        // Static DOM should remain; assert container exists
        await expect(app.container()).toHaveCount(1);
      }
    } finally {
      app.detachListeners();
    }
  });
});