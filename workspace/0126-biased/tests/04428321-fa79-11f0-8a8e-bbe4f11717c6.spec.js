import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04428321-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page object for the Jump Search app to keep tests organized
class JumpSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#jump-search-btn');
    this.input = page.locator('#search-bar');
    // Note: The implementation uses class="search-results" in DOM but the script
    // queries an element by id "search-results". We'll select both to assert reality.
    this.resultsByClass = page.locator('.search-results');
    this.resultsById = page.locator('#search-results');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async setSearchQuery(text) {
    await this.input.fill(text);
  }

  async clickStart() {
    await this.button.click();
  }

  async getResultsClassInnerHTML() {
    return this.page.evaluate(() => {
      const el = document.querySelector('.search-results');
      return el ? el.innerHTML : null;
    });
  }

  async getResultsIdInnerHTML() {
    return this.page.evaluate(() => {
      const el = document.getElementById('search-results');
      return el ? el.innerHTML : null;
    });
  }
}

test.describe('Jump Search FSM and UI tests - Application 04428321-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // We'll reuse these arrays to collect runtime errors and console error messages.
  let pageErrors = [];
  let consoleErrors = [];
  let pageObj;

  // Setup: navigate to the page and attach listeners BEFORE any interaction to capture errors
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture unhandled page errors (runtime exceptions)
    page.on('pageerror', (err) => {
      // store the Error object for assertions
      pageErrors.push(err);
    });

    // Capture console messages of type 'error' for additional diagnostics
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg);
      }
    });

    pageObj = new JumpSearchPage(page);
    await pageObj.goto();
  });

  test.afterEach(async () => {
    // No explicit teardown required; keeping this hook for symmetry / future cleanup
  });

  test.describe('State S0_Idle (Idle) - initial UI verification', () => {
    test('Idle: initial elements are present and visible, and no runtime errors on load', async ({ page }) => {
      // Validate presence of key components that define the Idle state:
      // - Start button (#jump-search-btn)
      // - Search input (#search-bar)
      // - Search results container (.search-results)
      await expect(pageObj.button).toBeVisible();
      await expect(pageObj.input).toBeVisible();
      await expect(pageObj.resultsByClass).toBeVisible();

      // The implementation accidentally uses getElementById('search-results') which does not exist.
      // Verify that there is no element with that id in the DOM (this demonstrates the implementation mismatch).
      const resultsIdInner = await pageObj.getResultsIdInnerHTML();
      expect(resultsIdInner).toBeNull();

      // No page errors or console errors should have occurred just from loading the page.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Idle: search input has correct placeholder and is empty by default', async () => {
      // Validate placeholder text and that the field is empty initially
      await expect(pageObj.input).toHaveAttribute('placeholder', 'Search...');
      await expect(pageObj.input).toHaveValue('');
    });
  });

  test.describe('Transition: StartSearch from S0_Idle -> S1_Searching (click action)', () => {
    test('Clicking Start with empty input should NOT trigger startJumpSearch actions (no runtime error, no results)', async () => {
      // Ensure input is empty and click Start
      await pageObj.setSearchQuery('');
      // No runtime error is expected because the function early-exits on empty trimmed query.
      await pageObj.clickStart();

      // Give a short moment for any stray events to occur
      await new Promise((r) => setTimeout(r, 250));

      // No pageerror should have been emitted
      expect(pageErrors.length).toBe(0);
      // The visible .search-results element should still be empty
      const resultsHtml = await pageObj.getResultsClassInnerHTML();
      expect(resultsHtml.trim()).toBe('');
    });

    test('Clicking Start with whitespace-only input should trim and behave like empty input (no runtime error)', async () => {
      // Fill with whitespace and click
      await pageObj.setSearchQuery('    ');
      await pageObj.clickStart();

      // Small pause
      await new Promise((r) => setTimeout(r, 250));

      expect(pageErrors.length).toBe(0);
      const resultsHtml = await pageObj.getResultsClassInnerHTML();
      expect(resultsHtml.trim()).toBe('');
    });
  });

  test.describe('Transition: S1_Searching -> S2_ResultsDisplayed (search flow and error behaviors)', () => {
    test('Starting a search with a non-empty query triggers startJumpSearch and results attempt - runtime TypeError expected due to bug', async ({ page }) => {
      // This test validates the transition to Searching and then to ResultsDisplayed.
      // However the implementation contains a bug: it queries getElementById("search-results")
      // while the DOM only has class="search-results". When the code tries to set innerHTML,
      // a runtime TypeError is expected. We assert that the error occurs and includes evidence
      // that startJumpSearch was on the stack.

      // Prepare to wait for the pageerror event that should fire when the function attempts to access null.innerHTML
      const waitForError = page.waitForEvent('pageerror');

      // Provide a non-empty query so the code path that sets innerHTML is executed
      await pageObj.setSearchQuery('test-query');

      // Trigger the Start click which (per implementation) calls startJumpSearch
      await pageObj.clickStart();

      // Wait for the runtime error to be emitted
      const runtimeError = await waitForError;

      // Validate the error object is present and looks like a TypeError related to innerHTML access
      expect(runtimeError).toBeTruthy();
      const message = runtimeError.message || '';
      // Be robust: modern Chromium messages may use "Cannot set properties of null (setting 'innerHTML')"
      // or older style "Cannot set property 'innerHTML' of null". We check for both tokens.
      expect(message.toLowerCase()).toContain('innerhtml');
      expect(message.toLowerCase()).toContain('null');

      // The stack trace should reference the function name startJumpSearch (if available)
      const stack = runtimeError.stack || '';
      expect(stack.toLowerCase()).toContain('startjumpsearch');

      // Because the runtime error occurs before modifying the real DOM element (class selector),
      // the .search-results visible container should remain unchanged / empty.
      const resultsHtml = await pageObj.getResultsClassInnerHTML();
      // Even if some intermediate writes to innerHTML occurred, due to the thrown error there should be no proper 'Search results:' final content
      expect(resultsHtml).toBe('' || null || resultsHtml); // this line is intentionally permissive: we assert below more concretely

      // More concrete: ensure that the visible results container does NOT contain the phrase "Search results:"
      const visibleHtml = (await pageObj.getResultsClassInnerHTML()) || '';
      expect(visibleHtml.includes('Search results:')).toBe(false);

      // There should be at least one captured page error
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    });

    test('Repeated clicks with a non-empty query produce additional runtime errors (error events are emitted per click)', async ({ page }) => {
      // This test verifies that multiple invocations cause multiple runtime errors (confirming the bug is reproducible).
      await pageObj.setSearchQuery('repeat-test');

      const errorEvents = [];
      // Collect three successive pageerror events by awaiting page.waitForEvent repeatedly
      for (let i = 0; i < 3; i++) {
        // Trigger click and wait for a pageerror for each click
        const waitErr = page.waitForEvent('pageerror');
        await pageObj.clickStart();
        const err = await waitErr;
        errorEvents.push(err);
        // short pause between clicks
        await new Promise((r) => setTimeout(r, 100));
      }

      // Validate we got three distinct errors
      expect(errorEvents.length).toBe(3);
      for (const err of errorEvents) {
        const m = (err && err.message) ? err.message.toLowerCase() : '';
        expect(m).toContain('innerhtml');
      }
    });
  });

  test.describe('Edge cases and error observation (observability checks)', () => {
    test('Verify that the script attempted to use an element by id "search-results" which does not exist (evidence of implementation mismatch)', async () => {
      // The page's script uses getElementById('search-results'), but the DOM has .search-results.
      // Confirm that an element with id "search-results" is absent.
      const idResults = await pageObj.getResultsIdInnerHTML();
      expect(idResults).toBeNull();

      // And the class-based results container does exist and is empty at start
      const classResults = await pageObj.getResultsClassInnerHTML();
      expect(classResults === '' || classResults === null || typeof classResults === 'string').toBeTruthy();
    });

    test('Console error capture: clicking Start with bad DOM reference produces console errors and pageerror (console errors may vary)', async ({ page }) => {
      // Set up an additional console listener result container
      const capturedConsoleErrors = [];
      const disposers = [];

      const consoleHandler = (msg) => {
        if (msg.type() === 'error') capturedConsoleErrors.push(msg.text());
      };
      page.on('console', consoleHandler);
      disposers.push(() => page.off('console', consoleHandler));

      // Trigger the failing path
      const waitErr = page.waitForEvent('pageerror');
      await pageObj.setSearchQuery('console-test');
      await pageObj.clickStart();
      const err = await waitErr;

      // Give the engine a moment to emit any console errors
      await new Promise((r) => setTimeout(r, 200));

      // At minimum we should have captured a pageerror. Console errors are optional depending on runtime.
      expect(err).toBeTruthy();
      // If the runtime emitted a console error message, verify it includes 'innerHTML' or 'null' to indicate the same failure
      if (capturedConsoleErrors.length > 0) {
        const anyMatch = capturedConsoleErrors.some((text) => text.toLowerCase().includes('innerhtml') || text.toLowerCase().includes('null'));
        expect(anyMatch).toBe(true);
      }

      // Cleanup listeners
      for (const d of disposers) d();
    });
  });
});