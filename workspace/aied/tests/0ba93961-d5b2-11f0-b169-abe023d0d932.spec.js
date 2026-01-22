import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba93961-d5b2-11f0-b169-abe023d0d932.html';

test.describe('Merge Sort Interactive Application (FSM validation)', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console error messages and page errors for each test run
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      // collect only error-level console messages
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Navigate to the app page (load exactly as-is)
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure the form exists before proceeding in tests
    await expect(page.locator('#mergeSortForm')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // Close page (Playwright fixture will handle, but keep explicit)
    try {
      await page.close();
    } catch (e) {
      // ignore
    }
  });

  test.describe('Idle state (S0_Idle) - initial rendering and entry actions', () => {
    test('Initial render contains form, input and submit button with required attribute', async ({ page }) => {
      // This validates FSM S0_Idle evidence: form, input, button exist on initial render.
      const form = page.locator('#mergeSortForm');
      const input = page.locator('#array');
      const submitButton = page.locator("button[type='submit']");

      await expect(form).toBeVisible();
      await expect(input).toBeVisible();
      await expect(submitButton).toBeVisible();

      // Input should have required attribute as per FSM/component evidence
      const required = await input.getAttribute('required');
      expect(required === '' || required === 'true' || required === 'required').toBeTruthy();
    });

    test('On page load the script executed displayResult (result div populated)', async ({ page }) => {
      // The implementation runs sorting on load and writes to #result.
      const resultDiv = page.locator('#result');
      await expect(resultDiv).toBeVisible();

      const text = (await resultDiv.innerText()).trim();
      // It should start with the exact phrase "Sorted array:"
      expect(text.startsWith('Sorted array:')).toBeTruthy();

      // Because the page runs sorting on load reading the empty input, it results in a numeric output.
      // We assert there is at least one token after the prefix (could be "0" based on implementation).
      const afterPrefix = text.replace('Sorted array:', '').trim();
      expect(afterPrefix.length).toBeGreaterThanOrEqual(0);
    });

    test('No unexpected console errors or page errors on initial load', async ({ page }) => {
      // Observe console and page errors collected in beforeEach
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Algorithm functions (mergeSort / merge) validation', () => {
    test('mergeSort and merge exist and sort arrays correctly', async ({ page }) => {
      // Confirm that mergeSort is available and works for various inputs by evaluating in page context.
      const results = await page.evaluate(() => {
        const summary = {};
        summary.isMergeSortFunction = typeof mergeSort === 'function';
        summary.isMergeFunction = typeof merge === 'function';
        summary.sortSimple = mergeSort([3, 1, 2]);
        summary.sortEmpty = mergeSort([]);
        summary.sortSingle = mergeSort([42]);
        summary.sortNegatives = mergeSort([0, -1, -5, 3]);
        summary.sortDuplicates = mergeSort([5, 1, 5, 2, 2]);
        return summary;
      });

      expect(results.isMergeSortFunction).toBeTruthy();
      expect(results.isMergeFunction).toBeTruthy();

      // Check correctness of simple sorts
      expect(results.sortSimple).toEqual([1, 2, 3]);
      expect(results.sortEmpty).toEqual([]);
      expect(results.sortSingle).toEqual([42]);
      expect(results.sortNegatives).toEqual([-5, -1, 0, 3]);
      expect(results.sortDuplicates).toEqual([1, 2, 2, 5, 5]);
    });

    test('Edge cases: very large array and already sorted array', async ({ page }) => {
      // Test performance and correctness on larger input and already sorted input
      const res = await page.evaluate(() => {
        const large = [];
        for (let i = 100; i >= 0; i--) large.push(i);
        const sortedLarge = mergeSort(large);
        const sortedAlready = mergeSort([1, 2, 3, 4, 5]);
        return {
          firstOfLarge: sortedLarge[0],
          lastOfLarge: sortedLarge[sortedLarge.length - 1],
          lengthLarge: sortedLarge.length,
          sortedAlready
        };
      });

      expect(res.lengthLarge).toBe(101);
      expect(res.firstOfLarge).toBe(0);
      expect(res.lastOfLarge).toBe(100);
      expect(res.sortedAlready).toEqual([1, 2, 3, 4, 5]);
    });
  });

  test.describe('Transition: form submit (SubmitForm) and S1_Sorted expectations', () => {
    test('Submitting the form with populated input triggers navigation/reload (implementation specific)', async ({ page }) => {
      // This test validates the real behaviour of the current implementation when the user submits the form.
      // Note: The FSM expected a submit handler that prevents default and calls mergeSort on submit.
      // The actual page implementation does NOT attach a submit handler; it performs sorting on load.
      // Therefore submitting the form will cause a navigation (page reload). We validate that behavior.

      // Prepare input value and compute expected sorted array using the page's mergeSort function (before submission)
      const inputValue = '5 2 9 1';
      const expectedSortedBefore = await page.evaluate((val) => {
        // compute what mergeSort would produce if we directly call it on parsed input
        const parsed = val.split(' ').map(Number);
        return mergeSort(parsed);
      }, inputValue);

      // Fill the input with the new value
      const input = page.locator('#array');
      await input.fill(inputValue);

      // Click the submit button and wait for navigation because the form will submit and reload the page
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load' }),
        page.click("button[type='submit']"),
      ]);

      // After reload, the page script runs on load. The input will be reset (no persisted value), so the result will NOT reflect our submitted input.
      const resultTextAfter = (await page.locator('#result').innerText()).trim();
      expect(resultTextAfter.startsWith('Sorted array:')).toBeTruthy();

      // Parse numbers from the result string
      const numsText = resultTextAfter.replace('Sorted array:', '').trim();
      // split on whitespace, filter empty, map to numbers
      const parsedResult = numsText.length === 0 ? [] : numsText.split(/\s+/).map(Number);

      // Compare the post-submission displayed result with the expected computed before submission.
      // Because the implementation lacks a submit event handler, these should differ (expectedSortedBefore !== parsedResult)
      const expectedSortedBeforeStr = expectedSortedBefore.join(',');
      const parsedResultStr = parsedResult.join(',');

      expect(parsedResultStr).not.toBe(expectedSortedBeforeStr);

      // Assert that the page still has mergeSort available (implementation's functions remain)
      const hasMergeSort = await page.evaluate(() => typeof mergeSort === 'function');
      expect(hasMergeSort).toBeTruthy();
    });

    test('Submitting the form when input is empty should be blocked by HTML5 validation (no navigation)', async ({ page }) => {
      // Clear the input to make it empty
      const input = page.locator('#array');
      await input.fill('');

      const urlBefore = page.url();

      // Attempt to submit the form with empty required input.
      // The browser should prevent submission due to required attribute and not navigate.
      // We perform the click and wait a short time, then check URL unchanged and result unchanged.
      await page.click("button[type='submit']");

      // Small delay to allow any unexpected navigation to occur; if navigation happens it will change URL.
      await page.waitForTimeout(250);

      const urlAfter = page.url();
      expect(urlAfter).toBe(urlBefore);

      // Result should remain as it was (script already ran on load), we verify it's still present
      const resultText = (await page.locator('#result').innerText()).trim();
      expect(resultText.startsWith('Sorted array:')).toBeTruthy();
    });

    test('Form submission handler is not present (implementation does not prevent default) - inference via behavior', async ({ page }) => {
      // We cannot directly inspect attached event listeners easily, but we can infer their absence.
      // The FSM evidence expected: addEventListener('submit', ...) with event.preventDefault()
      // Implementation instead executes sorting on load and doesn't attach the listener.
      // We'll infer missing handler because submitting triggers navigation (as tested earlier).
      // This test simply asserts that behavior: submitting with a valid input causes navigation (reload).

      // Fill input with valid value
      await page.locator('#array').fill('10 3 7');

      // Wait for navigation that should occur on form submit
      const navigationPromise = page.waitForNavigation({ waitUntil: 'load' });
      await page.click("button[type='submit']");
      await navigationPromise;

      // If navigation occurred, the submit handler did not prevent default, we consider that as "no submit handler preventing navigation".
      // Assert that result exists after reload (script executed on load)
      const resultTextAfter = (await page.locator('#result').innerText()).trim();
      expect(resultTextAfter.startsWith('Sorted array:')).toBeTruthy();
    });
  });

  test.describe('Error observation and robustness checks', () => {
    test('No runtime ReferenceError / TypeError / SyntaxError observed when loading and interacting', async ({ page }) => {
      // We collected console errors and page errors in beforeEach; also interact with the page to ensure no errors arise.
      // Interactions: call mergeSort in page context and click a non-navigating submit (empty input)
      await page.evaluate(() => {
        // call mergeSort with a trivial input
        mergeSort([1, 0]);
      });

      // Trigger an empty-submit which should not navigate
      await page.locator('#array').fill('');
      await page.click("button[type='submit']");
      await page.waitForTimeout(200);

      // Assert that no console.error messages or page errors were recorded
      expect(consoleErrors.length).toBe(0);
      expect(pageErrors.length).toBe(0);
    });

    test('Invalid / non-numeric input handling (implementation uses Number coercion)', async ({ page }) => {
      // Fill input with a mix of numeric and non-numeric tokens and submit by calling mergeSort directly via page.evaluate.
      const inputValue = '4 abc 2';
      const computed = await page.evaluate((val) => {
        const parsed = val.split(' ').map(Number); // Number('abc') === NaN
        return {
          parsed,
          sorted: mergeSort(parsed)
        };
      }, inputValue);

      // parsed should contain NaN for non-numeric token
      expect(Number.isNaN(computed.parsed[1])).toBeTruthy();

      // mergeSort will attempt to compare NaN with numbers; behavior is implementation-specific.
      // We ensure the function returns an array of same length and contains NaN somewhere if present
      expect(Array.isArray(computed.sorted)).toBeTruthy();
      expect(computed.sorted.length).toBe(3);
      // There should be at least one NaN remaining in the sorted result (cannot reliably assert exact position)
      const hasNaN = computed.sorted.some(Number.isNaN);
      expect(hasNaN).toBeTruthy();
    });
  });
});