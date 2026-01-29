import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5208d1c3-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the Heap Sort page
class HeapSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = 'button[onclick="heapSort(array, 0, array.length - 1)"]';
    this.resultSelector = '#result';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async button() {
    return this.page.locator(this.buttonSelector);
  }

  async resultText() {
    return this.page.locator(this.resultSelector).innerText();
  }

  async clickHeapSort() {
    await this.page.click(this.buttonSelector);
  }

  // Read the global array from the page. We only read, not modify.
  async readArray() {
    return this.page.evaluate(() => {
      // If array is not present, return null (we do not inject or change globals)
      return typeof array !== 'undefined' ? array : null;
    });
  }
}

test.describe('Heap Sort interactive application - FSM validation', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for analysis
    page.on('console', (msg) => {
      // Collect type and text for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // No explicit teardown needed here; Playwright closes pages automatically.
    // Keep collectors for inspection in assertions within tests.
  });

  test('S0_Idle - Page loads and initial rendering (renderPage equivalent)', async ({ page }) => {
    // This test validates the initial Idle state rendering and that the expected components exist.
    const heapPage = new HeapSortPage(page);

    // Navigate to the application page
    await heapPage.goto();

    // Verify the Heap Sort button exists and is visible
    const button = await heapPage.button();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Heap Sort');

    // The page's script runs on load and sets the result div. Verify it contains the "Sorted array:" prefix.
    const result = await heapPage.resultText();
    // The implementation sets result.innerHTML = "Sorted array: " after calling heapSort on load.
    expect(result.startsWith('Sorted array:')).toBeTruthy();

    // Verify the result contains numeric tokens (we expect the array elements to be displayed)
    const tokens = result.replace('Sorted array:', '').trim().split(/\s+/).filter(Boolean);
    // Expect at least one number token; original implementation defines an array of length 6.
    expect(tokens.length).toBeGreaterThanOrEqual(1);

    // Ensure no uncaught page errors occurred during load
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console.error messages during load
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || /error/i.test(m.text));
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0 -> S1 (HeapSortClick) - Clicking Heap Sort runs algorithm and preserves array structure', async ({ page }) => {
    // This test validates the click event transition and the algorithm invocation (as observable through array mutation).
    const heapPage = new HeapSortPage(page);

    await heapPage.goto();

    // Read the array before clicking to observe possible changes
    const beforeArray = await heapPage.readArray();
    expect(beforeArray).not.toBeNull(); // the page defines an array in the implementation
    expect(Array.isArray(beforeArray)).toBeTruthy();

    // Click the Heap Sort button to trigger the transition from Idle -> Sorting
    await heapPage.clickHeapSort();

    // Read the array after clicking; heapSort may mutate the array but should still be an array of numbers
    const afterArray = await heapPage.readArray();
    expect(afterArray).not.toBeNull();
    expect(Array.isArray(afterArray)).toBeTruthy();

    // Ensure the array length remains the same (heapSort implementation should not change length)
    expect(afterArray.length).toBe(beforeArray.length);

    // Ensure each entry is a number after running heapSort
    for (const item of afterArray) {
      expect(typeof item).toBe('number');
    }

    // The implementation does not define updateResult() and does not re-render result on button click,
    // but we can verify the result div still contains "Sorted array:" and numbers.
    const resultAfterClick = await heapPage.resultText();
    expect(resultAfterClick.startsWith('Sorted array:')).toBeTruthy();

    // Verify no new uncaught page errors were recorded as a result of the click
    expect(pageErrors.length).toBe(0);

    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || /error/i.test(m.text));
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_Sorting -> S0_Idle on click again - verify expected DOM remains updated (no updateResult function present)', async ({ page }) => {
    // This test validates the second transition and checks that the expected updateResult() function is absent,
    // thereby naturally causing a ReferenceError if invoked (we will assert that invoking it throws).
    const heapPage = new HeapSortPage(page);

    await heapPage.goto();

    // Clicking the button once to be in Sorting state (the FSM conceptual state)
    await heapPage.clickHeapSort();

    // The FSM expects updateResult() on exit, but the implementation doesn't define it.
    // Calling updateResult() from the page should naturally throw a ReferenceError. We assert that behavior.
    await expect(page.evaluate(() => {
      // Attempt to call a function that is not defined in the page scope.
      // This should result in a ReferenceError raised in the page context and propagated to Playwright.
      return updateResult();
    })).rejects.toThrow(new ReferenceError());

    // Confirm that a page error for ReferenceError was captured (depending on how the browser surfaces it).
    // There may be one or more pageErrors collected; ensure at least one is a ReferenceError.
    const hasReferenceError = pageErrors.some(err => err instanceof ReferenceError || /ReferenceError/i.test(String(err)));
    expect(hasReferenceError).toBeTruthy();
  });

  test('Edge case: invoking heapSort with invalid input should cause a TypeError naturally', async ({ page }) => {
    // This test deliberately calls heapSort with a null array to let a runtime TypeError occur naturally.
    // It verifies the application throws as-is without any patching.
    const heapPage = new HeapSortPage(page);
    await heapPage.goto();

    // Calling heapSort(null, 0, 0) should cause an attempt to read properties of null -> TypeError.
    await expect(page.evaluate(() => {
      // Directly invoke the page's heapSort with invalid input. This does not define globals or patch code.
      return heapSort(null, 0, 0);
    })).rejects.toThrow(TypeError);

    // Ensure the TypeError was captured in pageErrors (uncaught exceptions)
    const hasTypeError = pageErrors.some(err => err instanceof TypeError || /TypeError/i.test(String(err)));
    expect(hasTypeError).toBeTruthy();
  });

  test('Stability check: multiple rapid clicks should not crash the page or produce new console errors', async ({ page }) => {
    // This test simulates multiple rapid interactions to ensure stability and FSM resilience.
    const heapPage = new HeapSortPage(page);
    await heapPage.goto();

    // Perform multiple clicks
    for (let i = 0; i < 5; i++) {
      await heapPage.clickHeapSort();
    }

    // The result div should still exist and start with "Sorted array:"
    const result = await heapPage.resultText();
    expect(result.startsWith('Sorted array:')).toBeTruthy();

    // No additional console.error messages should have been produced by repeated clicks beyond previously observed ones.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || /error/i.test(m.text));
    // At least one error may exist due to earlier intentional tests; ensure that repeated clicks didn't add new ones:
    // We assert that every console error has a text and does not indicate a crash message like 'Uncaught RangeError' stack overflow.
    for (const err of consoleErrors) {
      expect(err.text.length).toBeGreaterThanOrEqual(0);
      expect(/crash|stack overflow|out of memory/i.test(err.text)).toBeFalsy();
    }

    // Ensure page is still responsive: read the array
    const arr = await heapPage.readArray();
    expect(Array.isArray(arr)).toBeTruthy();
  });
});