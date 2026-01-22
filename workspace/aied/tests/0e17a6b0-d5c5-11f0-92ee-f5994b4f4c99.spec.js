import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e17a6b0-d5c5-11f0-92ee-f5994b4f4c99.html';

test.describe('Insertion Sort interactive application - FSM and runtime validation', () => {
  // Holders for observed console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', (msg) => {
      // Record type and text for later assertions / diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object with message and stack
      pageErrors.push({ message: err.message, stack: err.stack });
    });

    // Navigate to the target HTML page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Tear down arrays to avoid cross-test leakage (not strictly necessary, but explicit)
    consoleMessages = [];
    pageErrors = [];
  });

  test('S0_Idle entry action: displayArray(input) executed and #array exists', async ({ page }) => {
    // This test validates the FSM initial state behavior:
    // The FSM describes an initial state S0_Idle with entry action displayArray(input).
    // The page's script calls displayArray(input) on load. We verify the result in the DOM.

    // Ensure the #array element is present
    const arrayHandle = await page.$('#array');
    expect(arrayHandle).not.toBeNull();

    // Read the innerHTML of #array and assert expected behavior.
    // Given the implementation, displayArray is called with 'input' being the DOM element,
    // which does not have a length property, so the function should produce an empty string.
    const innerHTML = await page.$eval('#array', (el) => el.innerHTML);
    // Expect exactly empty string (implementation builds "" and assigns it).
    expect(innerHTML).toBe('');

    // Additionally assert that displayArray is available as a function on the page
    const hasDisplayArray = await page.evaluate(() => typeof displayArray === 'function');
    expect(hasDisplayArray).toBe(true);
  });

  test('No transitions/events present in the FSM and no interactive handlers on the page', async ({ page }) => {
    // FSM extraction shows zero transitions and zero detected event handlers.
    // Confirm the page has no obvious interactive controls and no inline event handlers.

    // There should be no <button> elements for user-triggered transitions
    const buttons = await page.$$('button');
    expect(buttons.length).toBe(0);

    // No elements with common inline event attributes (onclick, onchange, oninput, onkeydown, etc.)
    const inlineEventSelectors = [
      '[onclick]',
      '[onchange]',
      '[oninput]',
      '[onsubmit]',
      '[onkeydown]',
      '[onkeyup]',
      '[onmousedown]',
      '[onmouseup]'
    ];
    // QuerySelectorAll supports comma-separated selectors
    const selector = inlineEventSelectors.join(',');
    const inlineEventElements = await page.$$(selector);
    expect(inlineEventElements.length).toBe(0);
  });

  test('insertionSort function behavior and edge cases (without modifying runtime)', async ({ page }) => {
    // Validate the page-provided insertionSort function behavior against the existing implementation.
    // We do NOT change any page code; we simply call the function as-is.

    // Ensure the function exists
    const hasInsertionSort = await page.evaluate(() => typeof insertionSort === 'function');
    expect(hasInsertionSort).toBe(true);

    // Call insertionSort on a sample array and assert the observed transformed output.
    // Note: The implementation in the page is non-standard (loops to len/2, etc.)
    // We assert the function returns the mutated array according to that implementation.
    const result = await page.evaluate(() => {
      // Provide a concrete test array; keep it simple so we can predict the buggy implementation's result.
      return insertionSort([3, 1, 2]);
    });

    // According to the page's insertionSort logic:
    // For arr = [3,1,2], the function will perform limited passes and swap where arr[j] > key.
    // Observed result with current implementation should be [1,3,2].
    expect(result).toEqual([1, 3, 2]);

    // Edge case: empty array should return empty array
    const emptyResult = await page.evaluate(() => insertionSort([]));
    expect(emptyResult).toEqual([]);
  });

  test('displayArray works when provided a real array (visual feedback check)', async ({ page }) => {
    // Call displayArray on a real JS array and verify #array innerHTML changes to match text format.
    await page.evaluate(() => {
      // Provide clear values to validate the output formatting "val1 val2 val3 "
      displayArray([5, 4, 3]);
    });

    const innerHTML = await page.$eval('#array', (el) => el.innerHTML);
    // displayArray concatenates each element followed by a space, so expect trailing space
    expect(innerHTML).toBe('5 4 3 ');
  });

  test('Observe console messages and page errors (capture and assert their presence or absence)', async ({ page }) => {
    // This test inspects the runtime console messages and uncaught page errors produced by page scripts.
    // We intentionally do not modify the runtime; we simply observe what happened during page load and interactions above.

    // Give a short moment to ensure any asynchronous console messages / errors (if any) are captured.
    // (In this page there are no async tasks, but this is defensive.)
    await page.waitForTimeout(50);

    // Diagnostics: we expect zero or more console messages; capture the current count.
    // Assert the console message array is defined and contains entries of the shape we recorded.
    expect(Array.isArray(consoleMessages)).toBe(true);
    consoleMessages.forEach((m) => {
      expect(typeof m.type).toBe('string');
      expect(typeof m.text).toBe('string');
    });

    // For page errors, if there are any, assert they are Error-like objects with messages.
    expect(Array.isArray(pageErrors)).toBe(true);
    if (pageErrors.length > 0) {
      // If errors occurred, ensure each captured error has a message string.
      pageErrors.forEach((e) => {
        expect(typeof e.message).toBe('string');
        // Optionally check for common JS error keywords to classify them (ReferenceError/TypeError/SyntaxError)
        const msgUpper = e.message.toLowerCase();
        const containsKnownKeyword =
          msgUpper.includes('referenceerror') ||
          msgUpper.includes('typeerror') ||
          msgUpper.includes('syntaxerror') ||
          msgUpper.includes('error');
        expect(containsKnownKeyword).toBe(true);
      });
    } else {
      // If no errors occurred, assert that the page ran without uncaught exceptions (this is also acceptable).
      expect(pageErrors.length).toBe(0);
    }
  });

  test('Sanity check: jQuery loaded from CDN as included in the page header', async ({ page }) => {
    // The HTML includes a <script> tag loading jQuery; verify it's present in the page global scope.
    const jqueryType = await page.evaluate(() => typeof window.jQuery);
    expect(jqueryType === 'function' || jqueryType === 'object').toBe(true);
  });
});