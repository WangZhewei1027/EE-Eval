import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b405f3-fa7c-11f0-adc7-178f556b1ee0.html';

// Page object model for the SVM demo page
class SVMPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.pageErrors = [];
    this.consoleErrors = [];
    this.consoleMessages = [];

    // Collect page errors and console errors for assertions
    this.page.on('pageerror', (err) => {
      // err is an Error object; store its message for easier assertions
      try {
        this.pageErrors.push(err && err.message ? err.message : String(err));
      } catch (e) {
        this.pageErrors.push(String(err));
      }
    });

    this.page.on('console', (msg) => {
      const text = msg.text();
      this.consoleMessages.push(text);
      try {
        if (msg.type() === 'error') {
          this.consoleErrors.push(text);
        }
      } catch (e) {
        // ignore
      }
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Wait for the page to fully load and the basic DOM to be present
  async waitForReady() {
    await this.page.waitForSelector('h1');
    await this.page.waitForSelector('#demo-button');
  }

  async clickDemo() {
    await this.page.click('#demo-button');
  }

  async getDemoButtonText() {
    const btn = await this.page.$('#demo-button');
    if (!btn) return null;
    return await btn.textContent();
  }

  async hasResultElement() {
    const el = await this.page.$('#result');
    return !!el;
  }

  async getResultText() {
    const el = await this.page.$('#result');
    if (!el) return null;
    return await el.textContent();
  }

  // Wait up to timeoutMs for at least one page error to be captured
  async waitForAnyPageError(timeoutMs = 2000) {
    if (this.pageErrors.length > 0) return this.pageErrors[0];
    return new Promise((resolve) => {
      const checkInterval = 50;
      let waited = 0;
      const interval = setInterval(() => {
        if (this.pageErrors.length > 0) {
          clearInterval(interval);
          resolve(this.pageErrors[0]);
        } else if ((waited += checkInterval) >= timeoutMs) {
          clearInterval(interval);
          resolve(null);
        }
      }, checkInterval);
    });
  }

  // Wait up to timeoutMs for N page errors to be captured
  async waitForPageErrorsCount(count = 1, timeoutMs = 2000) {
    if (this.pageErrors.length >= count) return this.pageErrors.slice(0, count);
    return new Promise((resolve) => {
      const checkInterval = 50;
      let waited = 0;
      const interval = setInterval(() => {
        if (this.pageErrors.length >= count) {
          clearInterval(interval);
          resolve(this.pageErrors.slice(0, count));
        } else if ((waited += checkInterval) >= timeoutMs) {
          clearInterval(interval);
          resolve(this.pageErrors.slice(0)); // whatever we have
        }
      }, checkInterval);
    });
  }

  // Expose the collected console error texts
  getConsoleErrors() {
    return this.consoleErrors.slice();
  }

  // Expose the collected console messages
  getConsoleMessages() {
    return this.consoleMessages.slice();
  }
}

test.describe('FSM: Support Vector Machine interactive demo (f5b405f3...ee0)', () => {
  // Provide fresh page object before each test
  test.beforeEach(async ({ page }) => {
    // No-op here; individual tests will instantiate SVMPage as needed.
  });

  test.describe('S0_Idle (Initial) state validations', () => {
    test('Idle: page renders and shows demo button (renderPage entry action)', async ({ page }) => {
      // Validate that initial rendering matches the FSM evidence for S0_Idle:
      // - The page is loaded
      // - The "Run Demonstration" button is present
      const svmPage = new SVMPage(page);
      await svmPage.goto();
      await svmPage.waitForReady();

      // Assert the document title and heading are present
      await expect(page).toHaveTitle(/Support Vector Machine/);
      const heading = await page.locator('h1').textContent();
      expect(heading).toBeTruthy();
      expect(heading).toMatch(/Support Vector Machine/);

      // The demonstration button should be present and have correct text
      const demoText = await svmPage.getDemoButtonText();
      expect(demoText).toBeTruthy();
      expect(demoText.trim()).toBe('Run Demonstration');

      // There should be no result element in the Idle state according to the provided HTML
      const hasResult = await svmPage.hasResultElement();
      expect(hasResult).toBe(false);
    });

    test('Idle: evidence text paragraphs and theory content exist', async ({ page }) => {
      // Validate some textual content exists as part of the initial render
      const svmPage = new SVMPage(page);
      await svmPage.goto();
      await svmPage.waitForReady();

      // Check that some expected paragraphs are present
      const pageText = await page.textContent('body');
      expect(pageText).toContain('Introduction');
      expect(pageText).toContain('The Support Vector Machine (SVM) is a supervised learning algorithm');
      expect(pageText).toContain('Demonstration Button');
    });
  });

  test.describe('S1_Demonstration_Running (after click) validations', () => {
    test('Transition: clicking demo button triggers the demonstration and runtime errors occur (as-implemented)', async ({ page }) => {
      // This test validates the FSM transition from S0_Idle to S1_Demonstration_Running via the RunDemonstration event.
      // The page's implementation contains bugs. Per instructions we must NOT patch them and must assert that errors happen.
      const svmPage = new SVMPage(page);
      await svmPage.goto();
      await svmPage.waitForReady();

      // Click the demo button to trigger the runSVM behavior (this corresponds to the FSM action runSVM())
      await svmPage.clickDemo();

      // Wait for at least one page error to surface from the broken implementation
      const firstError = await svmPage.waitForAnyPageError(3000);

      // The implementation is expected to throw runtime errors. Assert that we captured an error.
      expect(firstError, 'Expected a runtime error to be thrown when running the demo').not.toBeNull();

      // The code has several probable failure modes:
      // - Local variable shadowing: "var svm = svm(X, y, kernel);" will likely cause "svm is not a function"
      // - Attempting to write into document.getElementById('result') when that element does not exist will throw
      // Assert that one of these recognizable messages appears in the error text
      const errText = (firstError || '').toString();
      const expectedPatterns = [/not a function/i, /cannot set properties of null/i, /cannot read properties of null/i, /is not defined/i, /TypeError/i];
      const matchesAny = expectedPatterns.some((re) => re.test(errText));
      expect(matchesAny, `Captured error message ("${errText}") should indicate a runtime failure consistent with the broken SVM implementation`).toBe(true);

      // Additionally assert that no #result element was successfully written to (the expected_observables "result displayed" won't be satisfied)
      const hasResult = await svmPage.hasResultElement();
      // In this HTML there is no #result element in the markup; therefore even if code attempted to write, it should have errored.
      expect(hasResult).toBe(false);

      // Also check that console captured error messages consistent with pageerror (if any)
      const consoleErrs = svmPage.getConsoleErrors();
      // At least one console error message or page error should exist
      expect(consoleErrs.length + svmPage.pageErrors.length).toBeGreaterThan(0);
    });

    test('Edge case: multiple clicks keep producing runtime errors and do not produce a result element', async ({ page }) => {
      // Validate behavior when the user clicks the demo button repeatedly.
      // The broken implementation should continue to throw errors on subsequent clicks.
      const svmPage = new SVMPage(page);
      await svmPage.goto();
      await svmPage.waitForReady();

      // Clear any initial errors by relying on a fresh SVMPage instance (constructor cleared arrays)
      // Perform two successive clicks
      await svmPage.clickDemo();
      await svmPage.clickDemo();

      // Wait for at least two page errors to have been captured (or as many as possible within timeout)
      const errors = await svmPage.waitForPageErrorsCount(2, 3000);

      // We expect at least one error. Preferably two due to two clicks, but depending on timing we assert at least one and prefer two.
      expect(errors.length).toBeGreaterThanOrEqual(1);

      // If two errors were collected, assert that they are runtime-like errors
      for (const e of errors) {
        const text = String(e || '');
        expect(/(not a function|cannot set properties of null|cannot read properties of null|TypeError|ReferenceError)/i.test(text)).toBeTruthy();
      }

      // Confirm still no #result element was created
      expect(await svmPage.hasResultElement()).toBe(false);

      // Also assert console errors are recorded
      const consoleErrors = svmPage.getConsoleErrors();
      expect(consoleErrors.length + errors.length).toBeGreaterThan(0);
    });

    test('Error assertion matches multiple possible engine messages (robust against different browsers)', async ({ page }) => {
      // Ensure our assertions are robust: different JS engines produce slightly different messages.
      // We verify that at least one captured error contains common substrings.
      const svmPage = new SVMPage(page);
      await svmPage.goto();
      await svmPage.waitForReady();

      await svmPage.clickDemo();
      const firstError = await svmPage.waitForAnyPageError(3000);
      expect(firstError).not.toBeNull();

      const text = (firstError || '').toString();
      // Accept multiple possible phrasings
      const allowedSubstrings = [
        'not a function',
        'svm is not a function',
        'Cannot set properties of null',
        'Cannot read properties of null',
        'is not defined',
        'TypeError',
        'ReferenceError'
      ];
      const containsAllowed = allowedSubstrings.some((s) => text.includes(s) || text.toLowerCase().includes(s.toLowerCase()));
      expect(containsAllowed, `Error message "${text}" should contain one of the known failure indicators`).toBe(true);
    });
  });

  test.describe('FSM coverage and onEnter/onExit implications', () => {
    test('FSM: onEnter action for S1 (runSVM) is invoked and causes expected runtime failure', async ({ page }) => {
      // This test documents that the FSM transition's entry action runSVM() is triggered by the click
      // and that the page's implementation throws (we observe that via pageerror).
      const svmPage = new SVMPage(page);
      await svmPage.goto();
      await svmPage.waitForReady();

      // Trigger transition
      await svmPage.clickDemo();

      // Wait for and assert pageerror happened
      const err = await svmPage.waitForAnyPageError(3000);
      expect(err).not.toBeNull();

      // The presence of the error is evidence that the entry action (runSVM invocation) executed (even if it errored).
      // Validate the error content references the SVM/run sequence (heuristic)
      const msg = (err || '').toString();
      expect(/svm|kernel|result|function/i.test(msg) || /not a function|TypeError|ReferenceError/i.test(msg)).toBeTruthy();
    });
  });
});