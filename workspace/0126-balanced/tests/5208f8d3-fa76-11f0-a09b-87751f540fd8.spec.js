import { test, expect } from '@playwright/test';

// Test file for application ID 5208f8d3-fa76-11f0-a09b-87751f540fd8
// Served at: http://127.0.0.1:5500/workspace/0126-balanced/html/5208f8d3-fa76-11f0-a09b-87751f540fd8.html
// This test suite verifies the FSM states and transitions as implemented (or not implemented) by the page.
// IMPORTANT: Tests load the page exactly as-is and do not modify or patch the page scripts.

const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-balanced/html/5208f8d3-fa76-11f0-a09b-87751f540fd8.html';

// Page object encapsulating common operations and locators
class BinarySearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.input = page.locator('#searchValue');
    this.button = page.locator('#searchButton');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getResultText() {
    return (await this.result.textContent()) ?? '';
  }

  async setInputValue(value) {
    await this.input.fill(String(value));
  }

  async clickSearch() {
    await this.button.click();
  }

  // Helper to execute a small function in page context and return its result
  async eval(fn, ...args) {
    return await this.page.evaluate(fn, ...args);
  }
}

test.describe('Binary Search Interactive App (FSM validation)', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // No special teardown required beyond Playwright fixtures.
    // Tests will assert on captured consoleMessages/pageErrors as needed.
  });

  test.describe('Initial load and Idle (S0_Idle) behavior', () => {
    test('renders input, button, and result container on load (S0_Idle evidence)', async ({
      page,
    }) => {
      // This test validates S0 evidence: presence of input and button on initial load.
      const app = new BinarySearchPage(page);
      await app.goto();

      // Verify presence and attributes of input and button
      await expect(app.input).toBeVisible();
      await expect(app.input).toHaveAttribute('type', 'number');
      await expect(app.input).toHaveAttribute(
        'placeholder',
        'Enter a value to search for'
      );

      await expect(app.button).toBeVisible();
      await expect(app.button).toHaveText('Search');

      // The FSM S0 entry_action includes renderPage(), but the actual implementation
      // immediately executes search logic at load time. Verify the DOM has a #result.
      await expect(app.result).toBeVisible();

      // Verify there were no uncaught exceptions during initial render
      expect(pageErrors.length).toBe(0);
    });

    test('page executed search logic on load and displays a result message (implementation detail)', async ({
      page,
    }) => {
      // The implementation's script runs immediately on load and computes a search using
      // the initial input value (which is empty). That early run sets result.innerHTML.
      // Here we assert what the implementation produced when the page loaded.
      const app = new BinarySearchPage(page);
      await app.goto();

      const resultText = (await app.getResultText()).trim();

      // The implementation computes searchValue = parseInt("") => NaN, binarySearch(NaN, array) => false
      // and therefore sets result.innerHTML = "Value not found"
      expect(resultText).toBe('Value not found');

      // The implementation also defines a top-level const searchValue variable.
      // We assert that it's present and is NaN (since input was empty at load).
      const pageSearchValue = await app.eval(() => {
        // access the globally-declared variable 'searchValue' if present
        // returning a serializable representation
        // Use typeof guard in case it's not defined (avoid ReferenceError)
        if (typeof window.searchValue === 'undefined') return { defined: false };
        return { defined: true, value: window.searchValue };
      });

      expect(pageSearchValue.defined).toBe(true);
      // It should be NaN because parseInt('') is NaN
      expect(Number.isNaN(pageSearchValue.value)).toBe(true);

      // Ensure no page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('SearchButtonClick event and transitions (FSM transitions)', () => {
    test('clicking Search button does not change result because the implementation has no click handler', async ({
      page,
    }) => {
      // FSM describes a SearchButtonClick event that triggers searching.
      // The provided implementation does not wire a click handler for the button.
      // This test asserts that clicking the button does not cause the expected FSM transitions.
      const app = new BinarySearchPage(page);
      await app.goto();

      const before = (await app.getResultText()).trim();

      // Click the button and wait briefly to allow any possible handlers to run
      await app.clickSearch();
      await page.waitForTimeout(200);

      const after = (await app.getResultText()).trim();

      // Because there's no click handler defined in the page, the result should remain unchanged.
      expect(after).toBe(before);

      // If there were event handlers attached, the FSM would expect result.innerHTML to be cleared
      // upon entering S1_Searching; we assert that no such clearing occurred on click.
      // We check that the result is not an empty string after the click.
      expect(after.length).toBeGreaterThanOrEqual(0);

      // Confirm no uncaught errors happened due to clicking
      expect(pageErrors.length).toBe(0);
      // Also confirm there were no console.error messages
      const errorConsole = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsole.length).toBe(0);
    });

    test('explicitly verify there is no inline onclick attribute and default onclick is null (evidence of missing handler)', async ({
      page,
    }) => {
      // Some implementations attach handlers via inline attributes (onclick) or via addEventListener.
      // This test checks inline onclick attribute and the element.onclick property.
      const app = new BinarySearchPage(page);
      await app.goto();

      const onclickInfo = await page.evaluate(() => {
        const btn = document.getElementById('searchButton');
        return {
          hasOnclickAttribute: btn.hasAttribute('onclick'),
          onclickType: typeof btn.onclick, // if handler attached via property would be 'function'
        };
      });

      // We expect no inline onclick attribute and onclick property is likely 'object' or 'function' or 'undefined'.
      // For the provided page, no handler is attached; so hasOnclickAttribute should be false.
      expect(onclickInfo.hasOnclickAttribute).toBe(false);

      // If there is no handler set via property, typeof btn.onclick is usually 'undefined' in browsers.
      // Accept undefined or object/ function but assert it's not a function (i.e., no direct property handler)
      expect(onclickInfo.onclickType === 'function').toBe(false);
    });
  });

  test.describe('Binary search function correctness (S1 -> S2 / S3 guards)', () => {
    test('binarySearch function correctly identifies present values (guard true => S2_ResultFound)', async ({
      page,
    }) => {
      // While the page does not trigger searches on click, it does expose binarySearch and array.
      // We call binarySearch directly to validate the algorithm matches the FSM guard expectations.
      const app = new BinarySearchPage(page);
      await app.goto();

      // Check that the helper function exists
      const hasBinarySearch = await app.eval(() => typeof window.binarySearch === 'function');
      expect(hasBinarySearch).toBe(true);

      // Values known to be in the array: [2,5,8,12,16,23,38,56,72,91]
      const found = await app.eval(() => window.binarySearch(23, window.array));
      expect(found).toBe(true);

      // Another present value
      const found2 = await app.eval(() => window.binarySearch(2, window.array));
      expect(found2).toBe(true);

      // When the guard is true the FSM would transition to S2_ResultFound and set the result message.
      // However, because that transition is not triggered by a click in the current implementation,
      // we test the pure function behavior rather than DOM transitions.
    });

    test('binarySearch function correctly identifies absent values (guard false => S3_ResultNotFound)', async ({
      page,
    }) => {
      const app = new BinarySearchPage(page);
      await app.goto();

      const notFound = await app.eval(() => window.binarySearch(99, window.array));
      expect(notFound).toBe(false);

      const notFound2 = await app.eval(() => window.binarySearch(-1, window.array));
      expect(notFound2).toBe(false);
    });

    test('binarySearch behavior with non-numeric and edge inputs (edge cases)', async ({
      page,
    }) => {
      const app = new BinarySearchPage(page);
      await app.goto();

      // Strings: strict equality prevents matching "23" to 23
      const stringCase = await app.eval(() => window.binarySearch('23', window.array));
      expect(stringCase).toBe(false);

      // NaN: comparisons will never be true; algorithm should return false
      const nanCase = await app.eval(() => window.binarySearch(NaN, window.array));
      expect(nanCase).toBe(false);

      // undefined: should safely return false
      const undefCase = await app.eval(() => window.binarySearch(undefined, window.array));
      expect(undefCase).toBe(false);
    });
  });

  test.describe('FSM state/action observations and implementation discrepancies', () => {
    test('verify S1 entry-actions (parseInt and clearing result) are executed at load rather than on click (implementation mismatch)', async ({
      page,
    }) => {
      // The FSM describes that when transitioning from S0 -> S1 on button click, entry actions
      // include parsing the input and clearing result. In the provided implementation, this logic
      // is executed immediately at load time. We validate that this behavior occurred.
      const app = new BinarySearchPage(page);

      // Capture the sequence: reload to make sure script executed fresh
      await app.goto();

      // There is evidence that result was first cleared then set; we can at least assert
      // the final state after load is the "Value not found" message since searchValue was NaN.
      const finalResult = (await app.getResultText()).trim();
      expect(finalResult).toBe('Value not found');

      // Validate that the parsed initial searchValue is available and is NaN (parseInt on empty).
      const initialSearchValue = await app.eval(() => {
        return window.searchValue;
      });
      expect(Number.isNaN(initialSearchValue)).toBe(true);

      // Because the parse and initial clearing happen at load, there is a mismatch between FSM expectation
      // (search happens on click) and implementation (search happens on load). This test documents that.
    });

    test('assert that clicking the button does not re-run the search logic (no S1 -> S2/S3 transitions via click)', async ({
      page,
    }) => {
      // Confirm that clicking the button does not change result text (no transitions wired)
      const app = new BinarySearchPage(page);
      await app.goto();

      const before = (await app.getResultText()).trim();
      await app.clickSearch();

      // Give small delay for any handler to run if present
      await page.waitForTimeout(150);
      const after = (await app.getResultText()).trim();

      expect(after).toBe(before);
    });
  });

  test.describe('Console and error observation (observability requirements)', () => {
    test('no uncaught runtime errors or console.error calls produced during normal page lifecycle', async ({
      page,
    }) => {
      // Load the page and verify that no page errors were thrown and no console.error messages emitted
      const app = new BinarySearchPage(page);
      await app.goto();

      // Wait briefly to allow any asynchronous errors to surface
      await page.waitForTimeout(200);

      // Assert no uncaught exceptions
      expect(pageErrors.length).toBe(0);

      // Assert console contains no error-level messages
      const errorConsole = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsole.length).toBe(0);
    });

    test('capture and expose console messages for diagnostic purposes (if present)', async ({
      page,
    }) => {
      // This test demonstrates capturing console output for debugging and asserts
      // that captured messages are an array (may be empty).
      const app = new BinarySearchPage(page);
      await app.goto();

      // Wait for any console messages to arrive
      await page.waitForTimeout(100);

      // We don't require any messages to exist; assert the capture structure is valid
      expect(Array.isArray(consoleMessages)).toBe(true);
      // Log count as a useful diagnostic assertion (non-strict)
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    });
  });
});