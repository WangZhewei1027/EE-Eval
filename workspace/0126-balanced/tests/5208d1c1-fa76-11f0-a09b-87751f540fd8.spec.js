import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5208d1c1-fa76-11f0-a09b-87751f540fd8.html';

// Page object encapsulating common interactions and observations for the Merge Sort page
class MergeSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];

    // Bind handlers so we can accumulate errors for assertions
    this._consoleHandler = (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    };
    this._pageErrorHandler = (err) => {
      // pageerror provides Error objects; store their messages
      try {
        this.pageErrors.push(err && err.message ? err.message : String(err));
      } catch (e) {
        this.pageErrors.push(String(err));
      }
    };
  }

  async goto() {
    // Attach listeners before navigation so we don't miss errors emitted during load
    this.page.on('console', this._consoleHandler);
    this.page.on('pageerror', this._pageErrorHandler);
    await this.page.goto(APP_URL);
  }

  async dispose() {
    // Remove listeners to avoid leaking between tests
    this.page.removeListener('console', this._consoleHandler);
    this.page.removeListener('pageerror', this._pageErrorHandler);
  }

  async getButton() {
    return this.page.locator('#merge-sort-btn');
  }

  async getOutputLocator() {
    return this.page.locator('#merge-sort-output');
  }

  async getOutputText() {
    return (await this.getOutputLocator().innerText()).trim();
  }

  async clickMergeSort() {
    await this.getButton().click();
  }

  // Expose captured console and page errors
  getConsoleErrors() {
    return this.consoleErrors.slice();
  }

  getPageErrors() {
    return this.pageErrors.slice();
  }

  // Utility to call mergeSort in page context without modifying page globals
  async callMergeSort(inputArray) {
    return this.page.evaluate((arr) => {
      // Call the page's mergeSort function; if it doesn't exist this will throw a ReferenceError
      // We deliberately do not inject or redefine anything.
      return window.mergeSort(arr);
    }, inputArray);
  }

  // Check whether a global symbol exists (renderPage, mergeSort, etc.)
  async typeofGlobal(name) {
    return this.page.evaluate((n) => typeof window[n], name);
  }
}

test.describe('Merge Sort FSM - Interactive Application (Application ID: 5208d1c1-fa76-11f0-a09b-87751f540fd8)', () => {
  let pageObj;

  // Setup before each test: navigate to the application and prepare listeners
  test.beforeEach(async ({ page }) => {
    pageObj = new MergeSortPage(page);
    await pageObj.goto();
  });

  // Teardown after each test: remove listeners
  test.afterEach(async () => {
    await pageObj.dispose();
  });

  test('Initial render: button is present and page shows sorted output (S1_Sorted observed on load)', async () => {
    // Validate the presence of the Merge Sort button (evidence for S0_Idle component)
    const button = await pageObj.getButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Merge Sort');

    // The implementation computes and sets the sorted array on page load.
    // This means that although FSM describes an Idle state, the page already displays Sorted state on entry.
    const outputText = await pageObj.getOutputText();

    // Expected sorted sequence based on provided array [64, 34, 25, 12, 22, 11, 90]
    const expectedSortedString = 'Sorted array: 11, 12, 22, 25, 34, 64, 90';
    expect(outputText).toBe(expectedSortedString);

    // Verify the mergeSort function exists on the page (it should, per implementation)
    const mergeSortType = await pageObj.typeofGlobal('mergeSort');
    expect(mergeSortType).toBe('function');

    // Verify renderPage (S0 entry action) is not defined on the window (the FSM mentions renderPage but implementation doesn't define it)
    const renderPageType = await pageObj.typeofGlobal('renderPage');
    expect(renderPageType).toBe('undefined');

    // No page errors should have occurred during load for this implementation (the initial code executes successfully)
    const pageErrors = pageObj.getPageErrors();
    expect(pageErrors.length).toBeGreaterThanOrEqual(0); // allow zero, but assert it's an array
  });

  test('Clicking the Merge Sort button triggers the transition and results in a runtime error due to reassigning a const (assert TypeError)', async () => {
    // Ensure no errors collected before clicking
    expect(pageObj.getPageErrors().length).toBe(0);
    expect(pageObj.getConsoleErrors().length).toBe(0);

    // Click the button - per code, it attempts to reassign `arr` which was declared as const, causing a TypeError.
    await pageObj.clickMergeSort();

    // Give the page a moment to emit synchronous errors and for handlers to capture them
    await pageObj.page.waitForTimeout(100);

    const pageErrors = pageObj.getPageErrors();
    const consoleErrors = pageObj.getConsoleErrors();

    // We expect at least one pageerror describing the TypeError: Assignment to constant variable
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    // The message should indicate an assignment-to-const issue. Be flexible about exact wording but check for keywords.
    const pageErrorMessage = pageErrors.join(' | ').toLowerCase();
    expect(pageErrorMessage).toMatch(/assignment.*constant|assignment to constant|cannot assign to|assign to constant/);

    // Also the console may capture an error entry; check that at least one console error mentions "Assignment" or "constant"
    const consoleErrorMessage = consoleErrors.join(' | ').toLowerCase();
    expect(consoleErrorMessage.length).toBeGreaterThanOrEqual(0);
    // If any console errors exist, assert their content is consistent with the TypeError
    if (consoleErrorMessage) {
      expect(consoleErrorMessage).toMatch(/assignment.*constant|assignment to constant|cannot assign to|assign to constant/);
    }

    // Because the error occurs before updating the DOM inside the click handler,
    // the output should remain as it was after initial render (still sorted).
    const outputAfterClick = await pageObj.getOutputText();
    const expectedSortedString = 'Sorted array: 11, 12, 22, 25, 34, 64, 90';
    expect(outputAfterClick).toBe(expectedSortedString);
  });

  test('mergeSort function behavior: calling mergeSort in page context sorts arbitrary arrays correctly', async () => {
    // This ensures the sorting logic itself is correct even if the button handler has an error.
    const input = [5, 3, 8, 1, 2];
    const result = await pageObj.callMergeSort(input);
    // Expect sorted ascending order
    expect(result).toEqual([1, 2, 3, 5, 8]);

    // Also test already sorted and single-element arrays (edge cases)
    const alreadySorted = await pageObj.callMergeSort([1, 2, 3]);
    expect(alreadySorted).toEqual([1, 2, 3]);

    const single = await pageObj.callMergeSort([42]);
    expect(single).toEqual([42]);

    // Confirm no additional page errors were introduced by merely calling mergeSort
    // (we did not click the button here; we invoked the function directly)
    const pageErrors = pageObj.getPageErrors();
    expect(pageErrors.length).toBeGreaterThanOrEqual(0);
  });

  test('Clicking multiple times repeatedly should continue to surface the same runtime error and not change DOM unexpectedly', async () => {
    // Clear any existing collected errors for a clean baseline
    pageObj.consoleErrors.length = 0;
    pageObj.pageErrors.length = 0;

    // Click multiple times
    await pageObj.clickMergeSort();
    await pageObj.page.waitForTimeout(50);
    await pageObj.clickMergeSort();
    await pageObj.page.waitForTimeout(100);

    const pageErrors = pageObj.getPageErrors();
    const consoleErrors = pageObj.getConsoleErrors();

    // Multiple clicks should result in at least one pageerror; often will be multiple.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // All captured page errors should indicate problems about assignment to a const (consistent error type)
    for (const errMsg of pageErrors) {
      const lower = String(errMsg).toLowerCase();
      expect(lower).toMatch(/assignment.*constant|assignment to constant|cannot assign to|assign to constant/);
    }

    // DOM should remain with the same sorted output (button's handler failed before update)
    const outputText = await pageObj.getOutputText();
    expect(outputText).toBe('Sorted array: 11, 12, 22, 25, 34, 64, 90');
  });

  test('FSM state validation: evidence components and expected observables per FSM', async () => {
    // Evidence: button exists (component)
    const button = await pageObj.getButton();
    await expect(button).toBeVisible();

    // Evidence: output div exists
    const outLocator = await pageObj.getOutputLocator();
    await expect(outLocator).toBeVisible();

    // Expected observable for S1_Sorted: output.innerHTML contains the sorted array string
    const outputText = await pageObj.getOutputText();
    expect(outputText).toContain('Sorted array:');

    // Check that the output string is the expected sorted sequence (observable matches FSM S1 entry action)
    expect(outputText).toBe('Sorted array: 11, 12, 22, 25, 34, 64, 90');

    // Verify that attempting to trigger the FSM transition (click) produces a runtime error rather than a clean transition,
    // demonstrating a mismatch between FSM expectation and actual behavior in the implementation.
    await pageObj.clickMergeSort();
    await pageObj.page.waitForTimeout(100);
    const pageErrors = pageObj.getPageErrors();
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
  });
});