import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99ced064-fa79-11f0-8075-e54a10595dde.html';

// Collects console messages and page errors for assertions
let consoleMessages = [];
let pageErrors = [];

test.describe('Tim Sort Interactive Demo - FSM states and transitions', () => {
  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Listen for console messages and page errors so we can assert they did/didn't occur
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // pageerror is Error object, capture its name and message
      pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Ensure we do not leak state between tests. Tests explicitly assert on console/page errors where appropriate.
    // Nothing to teardown in the page itself; listeners are attached per test run and are cleared with page.
  });

  test('S0_Idle - initial render shows title, input default and empty current state', async ({ page }) => {
    // Validate the page title and initial static content (entry action renderPage() is expected in FSM)
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Tim Sort Interactive Demo');

    // Verify input exists with expected default value
    const arrayInput = page.locator('#arrayInput');
    await expect(arrayInput).toHaveValue('5,21,7,1,89,16');

    // currentArray visual should be present and initially empty (no initSort called yet)
    const current = page.locator('#currentArray');
    await expect(current).toHaveText(''); // displayCurrent not yet called

    // Verify that global variables originalArray and sortedArray are defined and are empty arrays at initial load
    // (The HTML declares them and initializes to [], so we check that state)
    const [originalArray, sortedArray] = await page.evaluate(() => {
      return [originalArray, sortedArray];
    });
    expect(Array.isArray(originalArray)).toBe(true);
    expect(Array.isArray(sortedArray)).toBe(true);
    expect(originalArray.length).toBe(0);
    expect(sortedArray.length).toBe(0);

    // Assert there were no page runtime errors (ReferenceError/SyntaxError/TypeError) on load
    expect(pageErrors.length).toBe(0);
  });

  test('Transition InitializeSort: clicking Initialize Sort updates current state to original array (S0 -> S1)', async ({ page }) => {
    // Click the Initialize Sort button
    const initButton = page.locator('button[onclick="initSort()"]');
    await initButton.click();

    // After initSort, currentArray should show the parsed array from the input
    const currentText = await page.locator('#currentArray').innerText();
    // Expect JSON string of the original array numbers in the same order
    expect(currentText).toBe(JSON.stringify([5, 21, 7, 1, 89, 16]));

    // Confirm in-page variables are set as expected: originalArray and sortedArray should be arrays equal to parsed numbers
    const state = await page.evaluate(() => {
      return {
        originalArray,
        sortedArray,
        runSize
      };
    });
    expect(state.originalArray).toEqual([5, 21, 7, 1, 89, 16]);
    expect(state.sortedArray).toEqual([5, 21, 7, 1, 89, 16]);
    // default runSize declared in script should be 5 initially
    expect(state.runSize).toBe(5);

    // No page errors expected during initialization
    expect(pageErrors.length).toBe(0);
  });

  test('Transition SortArray: clicking Sort Array sorts the array and display updates (S1 -> S1)', async ({ page }) => {
    // Initialize first
    await page.locator('button[onclick="initSort()"]').click();

    // Click Sort Array with default runSize (5)
    await page.locator('button[onclick="sortArray()"]').click();

    // Verify that the displayed current array is sorted ascending
    const currentAfterSort = await page.locator('#currentArray').innerText();
    // Expected sorted result for [5,21,7,1,89,16] is [1,5,7,16,21,89]
    expect(currentAfterSort).toBe(JSON.stringify([1, 5, 7, 16, 21, 89]));

    // Verify in-page sortedArray also equals the sorted array
    const sortedArray = await page.evaluate(() => sortedArray);
    expect(sortedArray).toEqual([1, 5, 7, 16, 21, 89]);

    // Sorting again should be idempotent and not change the displayed state
    await page.locator('button[onclick="sortArray()"]').click();
    const currentAfterSecondSort = await page.locator('#currentArray').innerText();
    expect(currentAfterSecondSort).toBe(JSON.stringify([1, 5, 7, 16, 21, 89]));

    // No runtime errors should have occurred during sorting
    expect(pageErrors.length).toBe(0);
  });

  test('SortArray with a different run size sorts correctly (edge case for merging behavior)', async ({ page }) => {
    // Initialize the array
    await page.locator('button[onclick="initSort()"]').click();

    // Change run size to 2 and click Sort Array to exercise different merge paths
    const sizeInput = page.locator('#size');
    await sizeInput.fill('2');
    await page.locator('button[onclick="sortArray()"]').click();

    // After sorting with runSize 2, the result should still be fully sorted
    const current = await page.locator('#currentArray').innerText();
    expect(current).toBe(JSON.stringify([1, 5, 7, 16, 21, 89]));

    // Confirm runSize in page context reflects the updated value
    const runSizeValue = await page.evaluate(() => runSize);
    expect(runSizeValue).toBe(2);

    // No runtime errors should occur
    expect(pageErrors.length).toBe(0);
  });

  test('Transition ResetArray: clicking Reset Array resets current state to original array (S1 -> S0)', async ({ page }) => {
    // Initialize and then sort
    await page.locator('button[onclick="initSort()"]').click();
    await page.locator('button[onclick="sortArray()"]').click();

    // Now click Reset Array which should reset the input to originalArray.join(',') and call initSort()
    await page.locator('button[onclick="resetArray()"]').click();

    // The input value should equal the original array representation
    const inputValue = await page.locator('#arrayInput').inputValue();
    expect(inputValue).toBe('5,21,7,1,89,16');

    // currentArray should show the original (unsorted) array after reset
    const current = await page.locator('#currentArray').innerText();
    expect(current).toBe(JSON.stringify([5, 21, 7, 1, 89, 16]));

    // In-page originalArray should be the same
    const originalArrayNow = await page.evaluate(() => originalArray);
    expect(originalArrayNow).toEqual([5, 21, 7, 1, 89, 16]);

    // No runtime errors should have been emitted during reset
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: non-numeric entries produce NaN values in arrays but do not throw errors', async ({ page }) => {
    // Enter a non-numeric array string
    const arrayInput = page.locator('#arrayInput');
    await arrayInput.fill('a,b,c');

    // Initialize; initSort will map Number over entries producing NaN values
    await page.locator('button[onclick="initSort()"]').click();

    // currentArray should display an array with NaN values (JSON.stringify converts NaN to null, so we need to inspect in-page variable)
    // JSON.stringify([NaN, NaN, NaN]) => [null,null,null]
    const currentText = await page.locator('#currentArray').innerText();
    expect(currentText).toBe(JSON.stringify([null, null, null]));

    // Inspect in-page originalArray to confirm entries are NaN
    const originalValues = await page.evaluate(() => originalArray);
    expect(originalValues.length).toBe(3);
    // At least one value should be NaN
    const hasNaN = originalValues.some((v) => Number.isNaN(v));
    expect(hasNaN).toBe(true);

    // Attempt to sort (should not throw) and ensure it finishes (sortedArray may remain [NaN,...])
    await page.locator('button[onclick="sortArray()"]').click();

    // After sorting, verify no page errors were emitted
    expect(pageErrors.length).toBe(0);

    // Confirm sortedArray in page still has NaN entries
    const sortedVals = await page.evaluate(() => sortedArray);
    const sortedHasNaN = sortedVals.some((v) => Number.isNaN(v));
    expect(sortedHasNaN).toBe(true);
  });

  test('Observability: no ReferenceError, SyntaxError or TypeError should have been emitted during interactions', async ({ page }) => {
    // Run through a typical user flow
    await page.locator('button[onclick="initSort()"]').click();
    await page.locator('button[onclick="sortArray()"]').click();
    await page.locator('button[onclick="resetArray()"]').click();

    // Collect any page_errors and ensure none are ReferenceError, SyntaxError or TypeError
    const offendingErrors = pageErrors.filter(e =>
      e.name === 'ReferenceError' || e.name === 'SyntaxError' || e.name === 'TypeError'
    );

    // If any such errors exist, fail the test and include diagnostics
    expect(offendingErrors.length, `Unexpected runtime errors: ${JSON.stringify(offendingErrors, null, 2)}`).toBe(0);

    // Additionally, assert that no uncaught page errors occurred at all
    expect(pageErrors.length).toBe(0);

    // Inspect console messages for severe messages (console.error). Fail if present.
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsoleMsgs.length, `Unexpected console errors/warnings: ${JSON.stringify(errorConsoleMsgs, null, 2)}`).toBe(0);
  });
});