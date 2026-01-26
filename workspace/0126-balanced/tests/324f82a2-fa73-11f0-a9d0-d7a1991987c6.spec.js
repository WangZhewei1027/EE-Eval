import { test, expect } from '@playwright/test';

// Page Object Model for the Unit Testing Demo page
class UnitTestApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f82a2-fa73-11f0-a9d0-d7a1991987c6.html';
    this.runTestsSelector = '#run-tests';
    this.resultsSelector = '#test-results';
  }

  // Navigate to the app
  async goto() {
    await this.page.goto(this.url);
  }

  // Click the Run Tests button
  async clickRunTests() {
    await this.page.click(this.runTestsSelector);
  }

  // Return the innerHTML of the results container
  async getResultsInnerHTML() {
    return this.page.$eval(this.resultsSelector, el => el.innerHTML);
  }

  // Return the number of result item nodes (div children inside #test-results)
  async getResultCount() {
    return this.page.$$eval(`${this.resultsSelector} > div`, elems => elems.length);
  }

  // Return an array of objects representing each result: { text, classList }
  async getResultItems() {
    return this.page.$$eval(`${this.resultsSelector} > div`, elems =>
      elems.map(el => ({ text: el.textContent || '', classes: Array.from(el.classList) }))
    );
  }

  // Pre-populate the results container with custom HTML (to test clear-on-enter behavior)
  async setResultsInnerHTML(html) {
    await this.page.$eval(this.resultsSelector, (el, val) => el.innerHTML = val, html);
  }

  // Check whether the run-tests button is visible/enabled
  async isRunButtonVisible() {
    const handle = await this.page.$(this.runTestsSelector);
    if (!handle) return false;
    return handle.isVisible();
  }
}

test.describe('Unit Testing Demo (FSM verification) - 324f82a2-fa73-11f0-a9d0-d7a1991987c6', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen for console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen for uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      // err is an Error object from the page context
      pageErrors.push(err);
    });
  });

  test.describe('FSM States', () => {
    test('S0_Idle: initial render shows Run Tests button and empty results', async ({ page }) => {
      // Validate initial (Idle) state: the page should render the Run Tests button and an empty #test-results
      const app = new UnitTestApp(page);
      await app.goto();

      // Ensure button exists and is visible
      const runButton = await page.$('#run-tests');
      expect(runButton).not.toBeNull();
      expect(await runButton.isVisible()).toBeTruthy();

      // #test-results should be present and empty on initial load
      const resultsHandle = await page.$('#test-results');
      expect(resultsHandle).not.toBeNull();
      const inner = await app.getResultsInnerHTML();
      // The FSM expected that entry action renderPage() would run; in the actual implementation it does not exist.
      // We assert that the DOM matches the implemented HTML: results container exists and is initially empty.
      expect(inner.trim()).toBe('');
      // No runtime page errors should have happened just from loading the page
      expect(pageErrors.length).toBe(0);
    });

    test('S1_TestsRunning: clicking Run Tests transitions to running state and displays results', async ({ page }) => {
      // Validate transition from Idle to Tests Running: clicking should clear results then display test outputs
      const app = new UnitTestApp(page);
      await app.goto();

      // Pre-assert nothing in results
      expect(await app.getResultCount()).toBe(0);

      // Click the Run Tests button to trigger runTests()
      await app.clickRunTests();

      // After clicking, wait for up to 2s for results to appear (the test run happens synchronously but we'll wait safely)
      await page.waitForFunction(selector => {
        const el = document.querySelector(selector);
        return el && el.querySelectorAll('div').length >= 1;
      }, {}, app.resultsSelector);

      // There should be 4 test result entries as defined in the runTests function
      const count = await app.getResultCount();
      expect(count).toBe(4);

      // All results in the provided implementation are passing; verify classes and text
      const items = await app.getResultItems();
      for (const item of items) {
        expect(item.classes).toContain('pass');
        // Each passing item text should indicate "Passed"
        expect(item.text).toMatch(/Passed/);
      }

      // Ensure no failing items exist
      const failItems = await page.$$(`${app.resultsSelector} > .fail`);
      expect(failItems.length).toBe(0);

      // No uncaught page errors during running tests
      expect(pageErrors.length).toBe(0);

      // The FSM S1 entry action included clearing results (document.getElementById('test-results').innerHTML = '')
      // Validate that the implementation clears previous results when starting—simulate previous results and re-run:
      await app.setResultsInnerHTML('<div class="stub">OLD</div>');
      // Ensure precondition set
      expect(await app.getResultCount()).toBe(1);

      // Click again to trigger runTests which should clear then repopulate
      await app.clickRunTests();

      // Immediately after click, ensure the previous "OLD" content is no longer present (cleared)
      await page.waitForFunction(selector => {
        const el = document.querySelector(selector);
        return el && !el.innerHTML.includes('OLD');
      }, {}, app.resultsSelector);

      // Then ensure correct number of results are present after run
      await page.waitForFunction(selector => {
        const el = document.querySelector(selector);
        return el && el.querySelectorAll('div').length === 4;
      }, {}, app.resultsSelector);

      expect(await app.getResultCount()).toBe(4);
    });
  });

  test.describe('Events and Transitions', () => {
    test('RunTestsClick event wired to the button triggers runTests and updates the DOM', async ({ page }) => {
      // This test checks the actual event wiring: the click handler should be attached and produce DOM changes.
      const app = new UnitTestApp(page);
      await app.goto();

      // Confirm event wiring exists by clicking and observing DOM changes
      await app.clickRunTests();

      // Wait for results to appear
      await page.waitForSelector('#test-results > div', { timeout: 2000 });

      // Validate expected observable: Test results displayed in #test-results
      const resultsHTML = await app.getResultsInnerHTML();
      expect(resultsHTML.length).toBeGreaterThan(0);
      // Validate there are 4 test results as per implementation
      expect(await app.getResultCount()).toBe(4);
    });

    test('Multiple rapid Run Tests clicks do not accumulate results (runTests clears results on entry)', async ({ page }) => {
      // Clicking multiple times quickly should still result in a single set of test results, because runTests clears old results at start
      const app = new UnitTestApp(page);
      await app.goto();

      // Click twice in quick succession
      await Promise.all([
        app.clickRunTests(),
        app.clickRunTests()
      ]);

      // Wait until results reach expected stable count
      await page.waitForFunction(selector => {
        const el = document.querySelector(selector);
        return el && el.querySelectorAll('div').length === 4;
      }, {}, app.resultsSelector);

      const count = await app.getResultCount();
      expect(count).toBe(4);

      // Ensure no duplicate accumulation occurred
      const items = await app.getResultItems();
      expect(items.length).toBe(4);
      for (const item of items) {
        expect(item.classes).toContain('pass');
      }
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Invoking an undefined function in the page context produces a ReferenceError (observed via pageerror)', async ({ page }) => {
      // We intentionally call a nonexistent function in the page context to allow a natural ReferenceError to occur.
      // This validates that pageerror events are observed and propagated by Playwright.
      const app = new UnitTestApp(page);
      await app.goto();

      // Ensure we start with no captured page errors
      expect(pageErrors.length).toBe(0);

      // Attempt to call a non-existent global function to produce a ReferenceError in the page
      let evaluateError = null;
      try {
        // This will reject because nonexistentFunction is not defined in the page
        await page.evaluate(() => {
          // eslint-disable-next-line no-undef
          nonexistentFunction();
        });
      } catch (err) {
        evaluateError = err;
      }

      // The page.evaluate call should fail and throw an error in Node context
      expect(evaluateError).not.toBeNull();
      // The error message should indicate a reference to the undefined function
      expect(String(evaluateError.message)).toMatch(/nonexistentFunction|is not defined|not defined/);

      // The pageerror listener should have captured the error as well
      // Wait a short moment for the pageerror event to be delivered
      await page.waitForTimeout(100);
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      const pageErrMessages = pageErrors.map(e => e.message || String(e));
      // Ensure one of the captured page errors mentions the missing function
      expect(pageErrMessages.join(' | ')).toMatch(/nonexistentFunction|is not defined|not defined/);
    });

    test('Observing console messages and ensuring no unexpected runtime errors during normal operation', async ({ page }) => {
      // This test captures console logs and page errors while performing normal interactions.
      const app = new UnitTestApp(page);
      await app.goto();

      // Interact normally: run tests
      await app.clickRunTests();

      // Wait for results
      await page.waitForSelector('#test-results > div', { timeout: 2000 });

      // There should be no uncaught JavaScript errors during normal operation
      expect(pageErrors.length).toBe(0);

      // Console messages may be empty for this implementation; assert that any console message types are strings if present
      for (const msg of consoleMessages) {
        expect(typeof msg.type).toBe('string');
        expect(typeof msg.text).toBe('string');
      }
    });
  });

  test.afterEach(async ({ page }) => {
    // Clean up listeners by navigating away to about:blank to avoid side effects between tests
    await page.goto('about:blank');
  });
});