import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5208d1c0-fa76-11f0-a09b-87751f540fd8.html';

/**
 * Page object to encapsulate interactions and event capture for the Insertion Sort page.
 * - Captures console messages and page errors
 * - Provides helper methods for common actions/assertions
 */
class InsertionSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Bind listeners
    this._consoleListener = (msg) => {
      // store both type and text for better diagnostics
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    this._pageErrorListener = (err) => {
      // err is Error object from page
      this.pageErrors.push(err.message || String(err));
    };

    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
  }

  async goto() {
    // Navigate and wait for initial scripts to run
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
  }

  async clickSortButton() {
    await this.page.click('#insertion-sort-btn');
  }

  async getResultText() {
    const el = this.page.locator('#result');
    return (await el.textContent()) ?? '';
  }

  async getButtonText() {
    const btn = this.page.locator('#insertion-sort-btn');
    return (await btn.textContent()) ?? '';
  }

  getConsoleMessages() {
    return this.consoleMessages.slice();
  }

  getPageErrors() {
    return this.pageErrors.slice();
  }

  // Clean up listeners (call before closing the page to avoid leaking listeners)
  dispose() {
    this.page.off('console', this._consoleListener);
    this.page.off('pageerror', this._pageErrorListener);
  }
}

test.describe('Insertion Sort Interactive Application (FSM validation)', () => {
  let page;
  let model;

  test.beforeEach(async ({ browser }) => {
    // Create a fresh page per test to ensure clean listeners and state
    page = await browser.newPage();
    model = new InsertionSortPage(page);
    await model.goto();
  });

  test.afterEach(async () => {
    if (model) {
      model.dispose();
    }
    if (page) {
      await page.close();
    }
  });

  test('Initial Idle state: button rendered and result is empty (S0_Idle)', async () => {
    // Validate initial UI elements corresponding to the Idle FSM state.
    // The FSM expects a button "#insertion-sort-btn" and an empty "#result" div.
    const btnText = await model.getButtonText();
    expect(btnText.trim()).toBe('Sort by Insertion');

    const resultText = (await model.getResultText()).trim();
    expect(resultText).toBe('', 'Expected #result to be empty on initial render (Idle state).');

    // Also ensure that initial script executed and logged the sorted array to the console.
    // The page's script sorts on load and does console.log("Sorted array:", result);
    const consoleMsgs = model.getConsoleMessages();
    const hasSortedLog = consoleMsgs.some(m => m.type === 'log' && m.text.includes('Sorted array:'));
    expect(hasSortedLog).toBeTruthy();
  });

  test('Transition on click: Sort by Insertion leads to Sorted state (S1_Sorted)', async () => {
    // Validate clicking the button triggers the transition and updates the DOM as expected.
    // FSM transition actions set #result.innerHTML to "Sorted array: " + result.join(" ");
    await model.clickSortButton();

    // Wait for expected text to appear in the result element
    const expected = 'Sorted array: 11 12 22 25 34 64 90';
    await expect(model.page.locator('#result')).toHaveText(expected, { timeout: 2000 });

    const actualResult = (await model.getResultText()).trim();
    expect(actualResult).toBe(expected);

    // Verify no uncaught page errors occurred during the click-driven transition
    const pageErrors = model.getPageErrors();
    expect(pageErrors.length).toBe(0);
  });

  test('Idempotency: multiple clicks produce consistent Sorted state and DOM output', async () => {
    // Click twice and confirm the output stays identical and stable.
    await model.clickSortButton();
    await model.clickSortButton();

    const expected = 'Sorted array: 11 12 22 25 34 64 90';
    const actual = (await model.getResultText()).trim();
    expect(actual).toBe(expected);

    // Ensure repeated clicks do not add additional unexpected console errors
    const pageErrors = model.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Ensure console still contains the initial load log; clicking does not produce additional logs in the implementation.
    const consoleLogs = model.getConsoleMessages().filter(m => m.type === 'log');
    const hasInitialSortedLog = consoleLogs.some(m => m.text.includes('Sorted array:'));
    expect(hasInitialSortedLog).toBeTruthy();
  });

  test('Programmatic check: insertionSort function exists and sorts correctly', async () => {
    // Confirm the page exposes insertionSort and it returns the expected sorted array for a sample input.
    // This validates the algorithm implementation used by the FSM transition action.
    const result = await model.page.evaluate(() => {
      // Access the function as-is from the page context. This will throw if not defined (and be surfaced as a test failure).
      if (typeof insertionSort !== 'function') {
        return { error: 'insertionSort-not-found' };
      }
      const out = insertionSort([3, 1, 4, 2]);
      return { sorted: out };
    });

    // If the function was missing, we expect the page to signal that.
    if (result && result.error === 'insertionSort-not-found') {
      // Fail explicitly with a helpful message
      throw new Error('insertionSort function not found on the page (expected by the FSM).');
    }

    expect(Array.isArray(result.sorted)).toBeTruthy();
    expect(result.sorted).toEqual([1, 2, 3, 4]);
  });

  test('Monitoring for uncaught errors (edge case validation)', async () => {
    // The FSM mentions an entry action renderPage() for the Idle state, however the HTML does not call renderPage().
    // We assert that the page did not produce a ReferenceError for a missing renderPage function.
    const errors = model.getPageErrors();

    // Ensure there are no page errors at all
    expect(errors.length).toBe(0);

    // Additionally assert that there is no ReferenceError specifically referencing renderPage
    const hasRenderPageRefError = errors.some(e => e.includes('ReferenceError') && e.includes('renderPage'));
    expect(hasRenderPageRefError).toBe(false);
  });

});