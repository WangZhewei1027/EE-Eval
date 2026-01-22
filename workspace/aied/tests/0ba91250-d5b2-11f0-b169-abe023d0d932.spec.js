import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba91250-d5b2-11f0-b169-abe023d0d932.html';

test.describe('Bubble Sort Example - Page and FSM validation', () => {
  // Arrays to collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  // Common setup: navigate to the page and attach listeners for console and page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console events (log, warn, error, etc.)
    page.on('console', msg => {
      // Store type and text for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled errors thrown on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No special teardown required beyond Playwright fixtures; listeners are per-page and cleared.
  });

  test('Initial state (Idle) renders correct heading and table structure', async ({ page }) => {
    // This test validates the FSM initial state's evidence: <h1>Bubble Sort Example</h1>
    // and that the table exists with expected columns and at least the static rows present.

    // Verify the main heading exists and has the correct text
    const heading = await page.locator('h1');
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveText('Bubble Sort Example');

    // Verify the table and its headers
    const headers = page.locator('table thead tr th');
    await expect(headers).toHaveCount(3);
    await expect(headers.nth(0)).toHaveText('Number');
    await expect(headers.nth(1)).toHaveText('Input');
    await expect(headers.nth(2)).toHaveText('Sorted');

    // Verify there are 5 tbody rows as in the static HTML
    const rows = page.locator('table tbody tr');
    await expect(rows).toHaveCount(5);

    // Verify that each row's "Sorted" column text matches the static HTML content
    const expectedSorted = [
      '1, 2, 5, 8',
      '1, 2, 3, 4',
      '1, 2, 3, 4',
      '1, 2, 3, 4',
      '1, 2, 3, 4, 5'
    ];
    for (let i = 0; i < expectedSorted.length; i++) {
      const sortedCell = rows.nth(i).locator('td').nth(2);
      await expect(sortedCell).toHaveText(expectedSorted[i]);
    }

    // Assert that no page errors were recorded during initial render
    expect(pageErrors.length).toBe(0);
  });

  test('Console output contains bubble sort result and bubbleSort function exists', async ({ page }) => {
    // This test validates that the page executed the bubble sort on load (console logged)
    // and that the bubbleSort function is available on the window for direct invocation.

    // Wait a short time to allow the page script to run and emit console logs
    await page.waitForTimeout(100); // minimal wait; script runs on load and is synchronous

    // Ensure at least one console message contains "Sorted numbers:"
    const foundSortedLog = consoleMessages.find(m => m.text.includes('Sorted numbers:'));
    expect(foundSortedLog, 'Expected to find a console message containing "Sorted numbers:"').toBeTruthy();

    // Verify that there were no page errors during script execution
    expect(pageErrors.length).toBe(0);

    // Verify bubbleSort function exists on window and behaves as expected
    const result = await page.evaluate(() => {
      // Access bubbleSort from the page context and run it on a test array
      // We return both whether the function exists and the actual sorted result
      const exists = typeof window.bubbleSort === 'function';
      let sorted = null;
      if (exists) {
        sorted = window.bubbleSort([5, 2, 8, 1]);
      }
      return { exists, sorted };
    });

    expect(result.exists).toBe(true);
    expect(result.sorted).toEqual([1, 2, 5, 8]);
  });

  test('bubbleSort algorithm: edge cases and correctness (empty, single, duplicates, negatives)', async ({ page }) => {
    // This test calls the bubbleSort function with various edge-case arrays to ensure correctness.

    // 1) Empty array
    const empty = await page.evaluate(() => window.bubbleSort([]));
    expect(empty).toEqual([]);

    // 2) Single element
    const single = await page.evaluate(() => window.bubbleSort([42]));
    expect(single).toEqual([42]);

    // 3) Already sorted
    const sorted = await page.evaluate(() => window.bubbleSort([1, 2, 3, 4]));
    expect(sorted).toEqual([1, 2, 3, 4]);

    // 4) Reverse sorted
    const reversed = await page.evaluate(() => window.bubbleSort([5, 4, 3, 2, 1]));
    expect(reversed).toEqual([1, 2, 3, 4, 5]);

    // 5) With duplicates and negative numbers
    const complex = await page.evaluate(() => window.bubbleSort([3, -1, 2, -1, 3, 0]));
    expect(complex).toEqual([-1, -1, 0, 2, 3, 3]);
  });

  test('FSM onEnter action renderPage is not implemented and calling it throws', async ({ page }) => {
    // FSM mentioned an entry action renderPage(), but the page does not implement it.
    // Validate that window.renderPage is undefined and that attempting to call it inside the page context throws a TypeError.

    const exists = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    // Expect the function to NOT exist as per the provided HTML (renderPage is not defined)
    expect(exists).toBe(false);

    // Attempting to call an undefined function will throw when executed in the page.
    // We execute a function that tries to call window.renderPage and capture the thrown error message.
    const callResult = await page.evaluate(() => {
      try {
        // Intentionally call the (non-existent) function to observe the natural TypeError
        // This is NOT redefining or patching anything; just invoking what's absent to observe the error
        // eslint-disable-next-line no-undef
        return { ok: true, result: window.renderPage() };
      } catch (err) {
        return { ok: false, name: err && err.name, message: err && err.message };
      }
    });

    // The invocation should have failed; we assert that an error object was returned
    expect(callResult.ok).toBe(false);
    // Most browsers produce a TypeError when attempting to call undefined; assert the error name contains "TypeError"
    expect(callResult.name).toMatch(/TypeError/i);
    // The message should indicate that it is not a function (message wording can vary by engine)
    expect(callResult.message).toMatch(/not a function|is not a function/i);
  });

  test('Validate static sorted column values match programmatic bubbleSort of the input column', async ({ page }) => {
    // This test cross-validates the static "Input" column CSV values by running the page's bubbleSort
    // on each input and comparing against the static "Sorted" column cells in the DOM.

    const rowsCount = await page.locator('table tbody tr').count();
    for (let i = 0; i < rowsCount; i++) {
      const row = page.locator('table tbody tr').nth(i);
      const inputText = (await row.locator('td').nth(1).textContent()).trim();
      const sortedText = (await row.locator('td').nth(2).textContent()).trim();

      // Parse input CSV into numbers
      const inputArray = inputText.split(',').map(s => s.trim()).filter(s => s.length).map(Number);
      // Run bubbleSort in page context to get the computed sorted result for comparison
      const computedSorted = await page.evaluate(arr => window.bubbleSort(arr), inputArray);

      // Create a normalized string representation for comparison against the static cell
      const computedSortedText = computedSorted.join(', ');
      expect(computedSortedText).toBe(sortedText);
    }
  });

  test('Observe console message types and ensure no unexpected console.error occurred', async ({ page }) => {
    // Ensure there are console logs and that none are of type 'error' (if any appear, report them)
    const hasAnyConsole = consoleMessages.length > 0;
    expect(hasAnyConsole).toBe(true);

    // Collect any messages of type 'error'
    const errorMessages = consoleMessages.filter(m => m.type === 'error');
    // The provided page logs to console.log and should not emit console.error entries
    expect(errorMessages.length).toBe(0);
  });

  test('Verify full sorted array logged on load matches expected sorted result', async ({ page }) {
    // The page logs "Sorted numbers:" along with the sorted array on load.
    // We assert a console message contains the expected numeric sequence as digits,
    // while being tolerant of formatting differences across engines.

    await page.waitForTimeout(50);

    // Find the console message that includes "Sorted numbers:"
    const msg = consoleMessages.find(m => m.text.includes('Sorted numbers:'));
    expect(msg).toBeTruthy();

    // Assert the message text contains the expected numbers in order
    // We check for the sequence "1" then "1" then "2" ... etc using regex to be tolerant
    const expectedSequenceRegex = /1.*1.*2.*2.*3.*4.*5.*6.*6.*8/;
    expect(msg.text).toMatch(expectedSequenceRegex);
  });
});