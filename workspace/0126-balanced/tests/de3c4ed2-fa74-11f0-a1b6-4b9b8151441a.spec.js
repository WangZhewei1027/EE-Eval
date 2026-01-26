import { test, expect } from '@playwright/test';

// Test file for application: de3c4ed2-fa74-11f0-a1b6-4b9b8151441a
// Served at: http://127.0.0.1:5500/workspace/0126-balanced/html/de3c4ed2-fa74-11f0-a1b6-4b9b8151441a.html
// This suite validates the FSM states and transitions described in the provided FSM,
// verifies DOM updates and visual feedback, checks edge cases (invalid input, n > 20 behavior),
// and observes console logs and page errors without modifying the page runtime.

// Page object to encapsulate interactions with the app
class AppPage {
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c4ed2-fa74-11f0-a1b6-4b9b8151441a.html';
    this.selectors = {
      fibInput: '#fibInput',
      compareButton: 'button[onclick="runComparisons()"]',
      complexityButton: 'button[onclick="showTimeComplexity()"]',
      results: '#results',
      resultDivClass: '.result'
    };
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async getInputValue() {
    return await this.page.locator(this.selectors.fibInput).inputValue();
  }

  async setInputValue(value) {
    const locator = this.page.locator(this.selectors.fibInput);
    // Clear and type to ensure value is set
    await locator.fill(String(value));
  }

  async clickCompare() {
    await Promise.all([
      this.page.waitForResponse(() => true).catch(() => {}), // harmless; let the page do synchronous DOM update
      this.page.locator(this.selectors.compareButton).click()
    ]);
  }

  async clickShowTimeComplexity() {
    await this.page.locator(this.selectors.complexityButton).click();
  }

  async getResultsHTML() {
    return await this.page.locator(this.selectors.results).innerHTML();
  }

  async getResultsText() {
    return await this.page.locator(this.selectors.results).innerText();
  }

  async getResultsLocator() {
    return this.page.locator(this.selectors.results);
  }

  async getResultDivLocator() {
    return this.page.locator(this.selectors.resultDivClass);
  }
}

// Helper to compute Fibonacci iteratively for assertions
function fibIter(n) {
  n = Number(n);
  if (n <= 1) return n;
  let a = 0, b = 1;
  for (let i = 2; i <= n; i++) {
    const c = a + b;
    a = b;
    b = c;
  }
  return b;
}

// Global listeners arrays will be set in beforeEach for each test
test.describe('Dynamic Programming Demo - FSM and UI tests', () => {
  let consoleMessages;
  let consoleErrors;
  let pageErrors;
  let lastDialogMessage;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors for this test
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];
    lastDialogMessage = null;

    // Collect console messages and errors
    page.on('console', msg => {
      const entry = { type: msg.type(), text: msg.text() };
      consoleMessages.push(entry);
      if (msg.type() === 'error') consoleErrors.push(entry);
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Auto-handle dialogs (alerts) and record the message
    page.on('dialog', async dialog => {
      lastDialogMessage = dialog.message();
      await dialog.accept();
    });
  });

  test.describe('Initial State (S0_Idle)', () => {
    test('renders input and buttons with correct defaults and no renderPage function present', async ({ page }) => {
      // This test validates the initial Idle state:
      // - input exists with default value 10
      // - both buttons are present
      // - results div is empty
      // - FSM entry action "renderPage()" referenced in FSM is not defined in the runtime (we assert its absence)
      const app = new AppPage(page);
      await app.goto();

      // Verify input default value is "10"
      const inputVal = await app.getInputValue();
      expect(inputVal).toBe('10');

      // Verify both buttons exist
      await expect(page.locator(app.selectors.compareButton)).toHaveCount(1);
      await expect(page.locator(app.selectors.complexityButton)).toHaveCount(1);

      // Verify results is empty initially
      const resultsHTML = await app.getResultsHTML();
      expect(resultsHTML.trim()).toBe('');

      // Verify there's no global renderPage function defined (FSM mentioned renderPage() as entry_action)
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      // We assert it's 'undefined' because the implementation does not define renderPage()
      expect(renderPageType).toBe('undefined');
    });

    test('initial page load produces no console errors or uncaught exceptions', async ({ page }) => {
      // Ensure no runtime errors on page load
      const app = new AppPage(page);
      await app.goto();

      // Small delay to allow any synchronous or microtask errors to surface
      await page.waitForTimeout(50);

      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Compare Methods (CompareMethods event -> S1_ResultsDisplayed)', () => {
    test('clicking Compare Methods displays a results table and correct Fibonacci values for small n', async ({ page }) => {
      // This validates the transition S0 -> S1 by clicking Compare Methods
      // - For n <= 20 the recursive method runs (not "Too slow")
      // - Memoization, Tabulation, Optimized Tabulation values match expected Fibonacci
      const app = new AppPage(page);
      await app.goto();

      // Choose n = 7 to keep recursive feasible
      const n = 7;
      await app.setInputValue(n);

      // Click Compare Methods and wait for the results content to be populated
      await app.clickCompare();

      const resultsLocator = app.getResultsLocator();
      await expect(resultsLocator).toContainText(`Results for fib(${n})`);
      // The table should be present
      const resultsHTML = await app.getResultsHTML();
      expect(resultsHTML).toContain('<table>');

      // Extract the cells for each method by parsing innerText
      const resultsText = await app.getResultsText();
      // Ensure method names are present
      expect(resultsText).toContain('Recursive');
      expect(resultsText).toContain('Memoization (Top-down DP)');
      expect(resultsText).toContain('Tabulation (Bottom-up DP)');
      expect(resultsText).toContain('Optimized Tabulation (O(1) space)');

      // Validate numeric results for memo/tab/tabOpt equal the iterative fib value
      const expected = fibIter(n);
      // Find occurrences of expected number in resultsText; all methods except time columns should display this value
      // We assert at least three occurrences (memo, tab, tabOpt). For recursive it's also expected for n <= 20.
      const occurrences = resultsText.split(String(expected)).length - 1;
      expect(occurrences).toBeGreaterThanOrEqual(4); // recursive + memo + tab + tabOpt

      // Confirm time columns exist and look numeric (or at least have digits)
      // A crude check: ensure there's at least one numeric time substring like "0." or digits
      const timeCellsRegex = /(\d+\.\d{1,4}|\d+)(?=\s*$|\s*<\/td>|\s*\n)/m;
      expect(timeCellsRegex.test(resultsHTML)).toBe(true);
    });

    test('clicking Compare Methods for n > 20 shows "Too slow for n > 20" for Recursive and still computes other methods', async ({ page }) => {
      // This validates the documented behavior for large n where recursive is skipped
      const app = new AppPage(page);
      await app.goto();

      const n = 25;
      await app.setInputValue(n);
      await app.clickCompare();

      const resultsText = await app.getResultsText();

      // Recursive cell should indicate it's too slow
      expect(resultsText).toContain('Too slow for n > 20');

      // Other methods should still compute fib(25)
      const expected = fibIter(n);
      expect(resultsText).toContain(String(expected));
    });

    test('invalid input (negative or non-number) triggers alert and does not update results', async ({ page }) => {
      // This validates edge-case handling: runComparisons should show an alert for invalid inputs
      const app = new AppPage(page);
      await app.goto();

      // Set invalid value -1 and click compare
      await app.setInputValue(-1);
      await app.clickCompare();

      // The dialog handler in beforeEach accepted and recorded lastDialogMessage
      expect(lastDialogMessage).toBe("Please enter a valid positive number");

      // Ensure results remain empty (no table rendered)
      const resultsHTML = await app.getResultsHTML();
      expect(resultsHTML.trim()).toBe('');
    });
  });

  test.describe('Show Time Complexity (ShowTimeComplexity event -> S2_TimeComplexityDisplayed)', () => {
    test('clicking Show Time Complexity displays complexity info in results with .result styling', async ({ page }) => {
      // This validates transition S0 -> S2 by clicking Show Time Complexity
      // - Content should include "Time Complexity Comparison" and list method complexities
      // - The container should have the .result styling class applied
      const app = new AppPage(page);
      await app.goto();

      await app.clickShowTimeComplexity();

      const resultDiv = app.getResultDivLocator();
      await expect(resultDiv).toBeVisible();

      const text = await app.getResultsText();
      expect(text).toContain('Time Complexity Comparison');
      // Check presence of several expected phrases
      expect(text).toContain('Recursive');
      expect(text).toContain('Memoization');
      expect(text).toContain('Tabulation');
      expect(text).toContain('Optimized Tabulation');
      // Confirm complexity mention for optimized tabulation (O(1) space)
      expect(text).toContain('O(1)');

      // Ensure results element has the result class applied via the inner content
      const resultsHTML = await app.getResultsHTML();
      expect(resultsHTML).toContain('class="result"');
    });
  });

  test.describe('Runtime stability and logging', () => {
    test('no uncaught exceptions or console.error messages after interactions', async ({ page }) => {
      // Perform a sequence of interactions and assert there are no runtime errors emitted
      const app = new AppPage(page);
      await app.goto();

      // Interactions: show complexity, compare a small n, compare a large n, attempt invalid input
      await app.clickShowTimeComplexity();

      await app.setInputValue(6);
      await app.clickCompare();

      await app.setInputValue(30);
      await app.clickCompare();

      await app.setInputValue(-5);
      await app.clickCompare(); // this will trigger alert which we've auto-accepted

      // Wait briefly to allow any asynchronous errors to bubble up
      await page.waitForTimeout(50);

      // Assert no console errors and no uncaught exceptions were collected
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);

      // Also ensure general console messages were captured (not required, but helpful)
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    });
  });
});