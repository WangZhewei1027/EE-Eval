import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04423502-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Quick Sort Interactive Application - FSM validation', () => {
  // Validate that the page loads and the initial "Sorted" entry action runs (S1_Sorted)
  test('Initial load -> Sorted state entry action should log sorted array and DOM should contain expected elements', async ({ page }) => {
    // Collect console messages and page errors emitted during navigation and interaction
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page (listeners attached before goto to capture load-time logs)
    await page.goto(APP_URL);

    // Basic DOM assertions for Initial State (S0_Initial evidence)
    const sortButton = await page.$('#sort-button');
    const reverseButton = await page.$('#reverse-button');
    expect(sortButton).not.toBeNull();
    expect(reverseButton).not.toBeNull();

    // Verify the example array's DOM representation exists and contains expected text
    const preText = await page.locator('pre').innerText();
    expect(preText.trim()).toBe('1 3 5 7 9');

    // Verify quickSort and partition functions are defined on the page (implementation existence)
    const functionsExist = await page.evaluate(() => {
      return {
        quickSort: typeof quickSort === 'function',
        partition: typeof partition === 'function'
      };
    });
    expect(functionsExist.quickSort).toBe(true);
    expect(functionsExist.partition).toBe(true);

    // The script performs an initial quickSort(...) and logs "Sorted array:" on load (S1 entry_action)
    // Assert that the console captured a "Sorted array:" message during page load
    const hasSortedLog = consoleMessages.some((m) => m.includes('Sorted array:'));
    expect(hasSortedLog).toBeTruthy();

    // The initial array is already sorted and quickSort was called on load - verify runtime arr value
    const arrValue = await page.evaluate(() => {
      // Return a shallow copy to avoid exposing internal references
      return Array.isArray(arr) ? arr.slice() : null;
    });
    expect(arrValue).toEqual([1, 3, 5, 7, 9]);

    // There should be no page load errors
    expect(pageErrors.length).toBe(0);
  });

  // Validate clicking the Sort button - implementation does not attach an event handler.
  // FSM expects a SortButtonClick transition, but the page does not implement it.
  test('Clicking "Sort" button should not trigger an additional sorted log (missing handler scenario)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      try {
        consoleMessages.push(msg.text());
      } catch {
        consoleMessages.push(String(msg));
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    // Clear any logs captured during load so we can focus on messages produced by the click
    consoleMessages.length = 0;
    pageErrors.length = 0;

    // Click the Sort button; since there is no attached handler in the implementation, nothing should happen
    await page.click('#sort-button');

    // Allow a short time for any potential asynchronous logs or errors to appear
    await page.waitForTimeout(150);

    // Verify that clicking Sort did not produce a new "Sorted array:" log (handler missing)
    const postClickSortedLog = consoleMessages.some((m) => m.includes('Sorted array:'));
    expect(postClickSortedLog).toBeFalsy();

    // And there should be no new page errors as a result of clicking Sort
    expect(pageErrors.length).toBe(0);

    // Verify that arr remained a valid array and unchanged
    const arrValueAfterSortClick = await page.evaluate(() => Array.isArray(arr) ? arr.slice() : null);
    expect(arrValueAfterSortClick).toEqual([1, 3, 5, 7, 9]);
  });

  // Validate clicking the Reverse button triggers the implemented code path which attempts to reassign a const
  // This should cause a runtime TypeError (Assignment to constant variable). FSM expected a reversed state log,
  // but due to the const reassignment error, the "Array after reversing:" log will not be emitted.
  test('Clicking "Reverse" button should attempt to reverse arr, cause a TypeError due to const reassignment, and NOT log the reversed array', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      try {
        consoleMessages.push(msg.text());
      } catch {
        consoleMessages.push(String(msg));
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    // Clear logs from load to isolate messages produced by the click action
    consoleMessages.length = 0;
    pageErrors.length = 0;

    // Click the Reverse button - this triggers the event handler that does: arr = arr.slice().reverse(); console.log(...)
    await page.click('#reverse-button');

    // Wait a bit for the error to surface and any console messages to be emitted
    await page.waitForTimeout(200);

    // We expect at least one pageerror because the handler attempts to assign to a const variable
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Assert that at least one of the page errors is a TypeError and mentions assignment/constant in the message (robust check)
    const foundTypeError = pageErrors.some((err) => {
      if (!err) return false;
      const nameOk = err.name === 'TypeError';
      const msg = (err.message || '').toString();
      const messageContainsAssignment = /assignment to constant variable/i.test(msg) || /Assignment to constant variable/i.test(msg) || /cannot assign to/i.test(msg);
      return nameOk || messageContainsAssignment;
    });
    expect(foundTypeError).toBeTruthy();

    // FSM expected an entry_action console.log("Array after reversing:", arr);
    // Because the assignment throws, the console.log should NOT have been executed.
    const reversedLogPresent = consoleMessages.some((m) => m.includes('Array after reversing:'));
    expect(reversedLogPresent).toBeFalsy();

    // Ensure arr value is unchanged due to failed reassignment
    const arrValueAfterReverseAttempt = await page.evaluate(() => Array.isArray(arr) ? arr.slice() : null);
    expect(arrValueAfterReverseAttempt).toEqual([1, 3, 5, 7, 9]);

    // Also validate that repeated clicks continue to produce errors (edge case)
    await page.click('#reverse-button');
    await page.waitForTimeout(150);
    expect(pageErrors.length).toBeGreaterThanOrEqual(2);
  });

  // Additional edge-case test: ensure the application does not unexpectedly throw other error types on load and interactions
  test('No unexpected runtime errors (other than the known assignment TypeError) should be emitted', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto(APP_URL);

    // Click the reverse button to reproduce known TypeError
    await page.click('#reverse-button');
    await page.waitForTimeout(150);

    // Collect names of distinct error types emitted
    const errorTypes = Array.from(new Set(pageErrors.map((e) => (e && e.name) || String(e))));

    // Expect that the only error type present is TypeError (due to const reassignment). If other types appear, that's unexpected.
    // This assertion allows for zero errors (in case environment differs) but if errors exist they should be TypeError(s).
    if (errorTypes.length > 0) {
      expect(errorTypes.every((t) => t === 'TypeError')).toBeTruthy();
    }
  });
});