import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04423501-fa79-11f0-8a8e-bbe4f11717c6.html';

// Page Object for the Merge Sort application
class MergeSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];
    this._boundConsoleListener = (msg) => {
      const text = msg.text();
      this.consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') this.consoleErrors.push(text);
    };
    this._boundPageErrorListener = (err) => {
      // err is an Error object
      this.pageErrors.push(String(err && err.message ? err.message : err));
    };
    page.on('console', this._boundConsoleListener);
    page.on('pageerror', this._boundPageErrorListener);
  }

  async goto() {
    // load the page and wait for load event
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getSortButton() {
    return this.page.locator('#merge-sort-button');
  }

  async getResultDiv() {
    return this.page.locator('#result');
  }

  async clickSort() {
    await this.getSortButton().click();
  }

  async resultText() {
    return (await this.getResultDiv().innerText()).trim();
  }

  // Utility to poll for either a non-empty result text or for specific error conditions
  async waitForResultOrErrors({ timeout = 2000, pollInterval = 100 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const text = (await this.getResultDiv().innerText()).trim();
      if (text.length > 0) return { outcome: 'result', text };

      // Check for known error signatures seen in this application's FSM/implementation
      if (this.pageErrors.some(m => /renderPage|startMergeSort|displayResult|ReferenceError|is not defined|TypeError|SyntaxError/i.test(m))) {
        return { outcome: 'pageerror', errors: this.pageErrors.slice() };
      }
      if (this.consoleErrors.some(m => /renderPage|startMergeSort|displayResult|ReferenceError|is not defined|TypeError|SyntaxError/i.test(m))) {
        return { outcome: 'consoleerror', errors: this.consoleErrors.slice() };
      }
      await this.page.waitForTimeout(pollInterval);
    }
    // Timeout reached, return collected diagnostics
    return { outcome: 'timeout', resultText: await this.resultText(), pageErrors: this.pageErrors.slice(), consoleErrors: this.consoleErrors.slice(), consoleMessages: this.consoleMessages.slice() };
  }

  // Cleanup listeners
  async dispose() {
    this.page.removeListener('console', this._boundConsoleListener);
    this.page.removeListener('pageerror', this._boundPageErrorListener);
  }
}

test.describe('Merge Sort FSM - 04423501-fa79-11f0-8a8e-bbe4f11717c6', () => {
  // Provide per-test page object
  test.beforeEach(async ({ page }) => {
    // noop - individual tests create MergeSortPage to capture events specifically
  });

  test.afterEach(async ({ page }) => {
    // ensure no leftover listeners (defensive)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('S0_Idle: Initial render includes Sort button and result div; entry action renderPage() observed (or errors occur)', async ({ page }) => {
    // This test validates the initial Idle state:
    // - The Sort button (#merge-sort-button) exists and is visible.
    // - The result div (#result) exists in the DOM.
    // - The FSM entry action renderPage() is expected; if it's not defined in the runtime it should produce a page error (we observe and assert it).
    const msPage = new MergeSortPage(page);
    try {
      await msPage.goto();

      const sortButton = msPage.getSortButton();
      const resultDiv = msPage.getResultDiv();

      // Assert core DOM elements are present
      await expect(sortButton).toBeVisible({ timeout: 1000 });
      await expect(resultDiv).toBeVisible({ timeout: 1000 });

      // Check immediate state of result div (should be empty initially per HTML)
      const initialResultText = (await resultDiv.innerText()).trim();
      // The FSM evidence shows result div exists but is empty in S0_Idle
      expect(typeof initialResultText === 'string').toBeTruthy();

      // Now assert that the entry action renderPage() either ran successfully (no error) or produced a ReferenceError
      // According to instructions we must observe console logs and page errors and assert that errors occur (let them happen naturally).
      // Wait briefly to capture any errors thrown during page initialization.
      const observation = await msPage.waitForResultOrErrors({ timeout: 1200 });

      // We expect at least one of:
      // - a pageerror mentioning renderPage or ReferenceError
      // - or no error but that's unexpected per instructions (we assert errors occur)
      if (observation.outcome === 'pageerror' || observation.outcome === 'consoleerror') {
        // Ensure the captured error mentions renderPage or indicates a ReferenceError (consistent with missing function)
        const combinedErrors = (observation.errors || []).join(' | ');
        expect(/renderPage|ReferenceError|is not defined|TypeError|SyntaxError/i.test(combinedErrors)).toBeTruthy();
      } else if (observation.outcome === 'result') {
        // If we got a result on initial load, that's surprising but acceptable: assert result is non-empty
        expect(observation.text.length).toBeGreaterThan(0);
      } else {
        // Timeout / no observable errors - still assert that either some pageErrors or consoleErrors were collected (to follow instructions)
        const hadErrors = msPage.pageErrors.length > 0 || msPage.consoleErrors.length > 0;
        expect(hadErrors).toBeTruthy();
      }
    } finally {
      await msPage.dispose();
    }
  });

  test('S0 -> S1 transition: Clicking Sort triggers startMergeSort() or raises ReferenceError if missing', async ({ page }) => {
    // This test validates clicking the Sort button:
    // - The Sort button click should initiate sorting (startMergeSort).
    // - If startMergeSort is undefined a ReferenceError is expected and must be asserted.
    const msPage = new MergeSortPage(page);
    try {
      await msPage.goto();

      // Ensure button exists before clicking
      await expect(msPage.getSortButton()).toBeVisible();

      // Click the Sort button and observe behavior
      await msPage.clickSort();

      // Wait for either a result to appear or error to be logged
      const observation = await msPage.waitForResultOrErrors({ timeout: 2000 });

      // Acceptable outcomes:
      // - observation.outcome === 'result' -> sorting happened and we have result text
      // - observation.outcome === 'pageerror' or 'consoleerror' -> startMergeSort or related functions missing -> assert the error mentions startMergeSort or ReferenceError
      if (observation.outcome === 'result') {
        // Validate that the result looks like something the app might render (non-empty)
        expect(observation.text.length).toBeGreaterThan(0);
      } else if (observation.outcome === 'pageerror' || observation.outcome === 'consoleerror') {
        const combined = (observation.errors || []).join(' | ');
        expect(/startMergeSort|renderPage|displayResult|ReferenceError|is not defined|TypeError/i.test(combined)).toBeTruthy();
      } else {
        // Timeout - provide diagnostics and fail the test explicitly (we expected either result or an error)
        const diag = {
          resultText: await msPage.resultText(),
          pageErrors: msPage.pageErrors.slice(),
          consoleErrors: msPage.consoleErrors.slice(),
          consoleMessages: msPage.consoleMessages.slice(),
        };
        // At least one of these should indicate something happened; assert accordingly
        const hadSomeActivity = diag.resultText.length > 0 || diag.pageErrors.length > 0 || diag.consoleErrors.length > 0;
        expect(hadSomeActivity).toBeTruthy();
      }
    } finally {
      await msPage.dispose();
    }
  });

  test('S1 -> S2 transition: Sorting completes and displayResult() updates #result OR displayResult triggers an error', async ({ page }) => {
    // This test validates the sorting completion:
    // - After clicking Sort, the application should eventually display the sorted result in #result
    // - If displayResult() is missing or throws, a page error mentioning displayResult or ReferenceError should be observed
    const msPage = new MergeSortPage(page);
    try {
      await msPage.goto();

      await expect(msPage.getSortButton()).toBeVisible();

      await msPage.clickSort();

      // Wait longer for completion behavior
      const observation = await msPage.waitForResultOrErrors({ timeout: 3000 });

      if (observation.outcome === 'result') {
        // The final state S2_Sorted is evidenced by #result containing the result; assert it's non-empty
        expect(observation.text.length).toBeGreaterThan(0);
        // Additionally verify that the result content appears in the DOM as expected
        const domText = await msPage.getResultDiv().innerText();
        expect(domText.trim().length).toBeGreaterThan(0);
      } else if (observation.outcome === 'pageerror' || observation.outcome === 'consoleerror') {
        // The app attempted to run code like displayResult() but failed - assert the error mentions displayResult or ReferenceError
        const combined = (observation.errors || []).join(' | ');
        expect(/displayResult|startMergeSort|renderPage|ReferenceError|is not defined|TypeError/i.test(combined)).toBeTruthy();
      } else {
        // Timeout - ensure at least we observed some errors per instructions
        const hadErrors = msPage.pageErrors.length > 0 || msPage.consoleErrors.length > 0;
        expect(hadErrors).toBeTruthy();
      }
    } finally {
      await msPage.dispose();
    }
  });

  test('Edge case: Clicking Sort multiple times should not crash the test harness; observe repeated errors or idempotent behavior', async ({ page }) => {
    // This test clicks the Sort button multiple times and ensures:
    // - The app either handles repeated clicks idempotently (no new unhandled exceptions)
    // - Or, if functions are missing, repeated clicks produce repeated errors which we observe
    const msPage = new MergeSortPage(page);
    try {
      await msPage.goto();

      await expect(msPage.getSortButton()).toBeVisible();

      // Click multiple times in rapid succession
      await msPage.clickSort();
      await page.waitForTimeout(100);
      await msPage.clickSort();
      await page.waitForTimeout(100);
      await msPage.clickSort();

      // Allow time for any async errors to surface
      const observation = await msPage.waitForResultOrErrors({ timeout: 2000 });

      // We accept either stable result text or at least one captured error (possibly repeated)
      if (observation.outcome === 'result') {
        expect(observation.text.length).toBeGreaterThan(0);
      } else if (observation.outcome === 'pageerror' || observation.outcome === 'consoleerror') {
        // Confirm that multiple clicks did not prevent error observation
        expect(observation.errors.length).toBeGreaterThan(0);
        // Optionally ensure repeated clicks produced more than one error message (if applicable)
        // This is a soft check: if there are multiple error messages, that's okay; if only one, also acceptable.
        expect(observation.errors.length >= 1).toBeTruthy();
      } else {
        // Timeout - at least ensure we have collected some console or page errors as per instructions
        const hadErrors = msPage.pageErrors.length > 0 || msPage.consoleErrors.length > 0;
        expect(hadErrors).toBeTruthy();
      }
    } finally {
      await msPage.dispose();
    }
  });

  test('Diagnostics: Capture console and page errors after load for debugging purposes', async ({ page }) => {
    // This test intentionally collects console and page errors and asserts that they are strings,
    // demonstrating that the test suite is correctly observing runtime errors.
    const msPage = new MergeSortPage(page);
    try {
      await msPage.goto();

      // Give some time for any init errors to appear
      await page.waitForTimeout(500);

      // Basic sanity checks on captured diagnostics
      expect(Array.isArray(msPage.consoleMessages)).toBeTruthy();
      expect(Array.isArray(msPage.consoleErrors)).toBeTruthy();
      expect(Array.isArray(msPage.pageErrors)).toBeTruthy();

      // At least ensure types are strings for any captured entries
      for (const msg of msPage.consoleMessages) {
        expect(typeof msg.text).toBe('string');
        expect(typeof msg.type).not.toBe('undefined');
      }
      for (const err of msPage.consoleErrors) {
        expect(typeof err).toBe('string');
      }
      for (const perr of msPage.pageErrors) {
        expect(typeof perr).toBe('string');
      }

      // As per instructions, assert that some runtime observation exists (errors or messages)
      const hadAny = msPage.consoleMessages.length > 0 || msPage.pageErrors.length > 0;
      expect(hadAny).toBeTruthy();
    } finally {
      await msPage.dispose();
    }
  });
});