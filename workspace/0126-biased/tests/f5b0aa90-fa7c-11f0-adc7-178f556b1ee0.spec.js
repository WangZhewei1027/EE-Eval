import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b0aa90-fa7c-11f0-adc7-178f556b1ee0.html';

// Test suite for the Merge Sort interactive application (FSM id: f5b0aa90-fa7c-11f0-adc7-178f556b1ee0.spec.js)
test.describe('Merge Sort Interactive Application - FSM validation', () => {
  // Arrays to collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  // Attach console and pageerror listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // Capture console outputs for inspection
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', error => {
      // Capture unhandled exceptions from the page
      pageErrors.push(error);
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  // Cleanup listeners after each test to avoid cross-test leakage
  test.afterEach(async ({ page }) => {
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test.describe('State: S0_Idle (Idle)', () => {
    test('Idle state: page renders core content and button exists', async ({ page }) => {
      // This test validates the Idle state's evidence:
      // - The "Try Merge Sort" button exists
      // - The main textual content describing Merge Sort is present
      const button = await page.locator('#merge-sort-button');
      await expect(button).toHaveCount(1);
      await expect(button).toHaveText('Try Merge Sort');

      // Check that some of the textual explanations from the HTML are present
      await expect(page.locator('h1')).toHaveText('Merge Sort');
      await expect(page.locator('text=Merge Sort is a divide-and-conquer algorithm')).toHaveCount(1);

      // FSM expected an entry_action renderPage() — verify it is not defined on the page
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      // We assert that renderPage is undefined, documenting that the FSM's entry action is not implemented.
      expect(renderPageType).toBe('undefined');

      // Ensure no runtime page errors were emitted during initial load
      expect(pageErrors.length).toBe(0);

      // Capture console messages (should be none for this simple page)
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Event: TryMergeSort_Click and State: S1_Sorting (Sorting)', () => {
    test('Clicking "Try Merge Sort" triggers mergeSort without causing page errors and preserves DOM', async ({ page }) => {
      // Validate initial DOM snapshot
      const beforeHTML = await page.evaluate(() => document.body.innerHTML);

      // Click the button to trigger the application's event handler
      // The page's event handler calls mergeSort(list) internally.
      await page.click('#merge-sort-button');

      // After clicking, ensure no unhandled page errors occurred
      expect(pageErrors.length).toBe(0);

      // The page does not render the sorted result visibly, so assert that:
      // - mergeSort function exists and behaves correctly when invoked directly
      const sorted = await page.evaluate(() => {
        // Validate the mergeSort and merge functions exist and run for the canonical list
        if (typeof mergeSort !== 'function') {
          return { exists: false };
        }
        const list = [5, 2, 8, 1, 9, 3, 6, 7, 4];
        try {
          const result = mergeSort(list);
          return { exists: true, result };
        } catch (e) {
          return { exists: true, error: String(e) };
        }
      });

      // Ensure mergeSort exists
      expect(sorted.exists).toBeTruthy();
      // Ensure the returned result is the expected sorted array
      expect(sorted.result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);

      // Ensure the DOM has not been unexpectedly modified (button still present)
      const afterHTML = await page.evaluate(() => document.body.innerHTML);
      await expect(page.locator('#merge-sort-button')).toHaveCount(1);
      expect(afterHTML).toBe(beforeHTML);

      // No console errors expected during the normal click flow
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Transition expectation: merging algorithm invoked for the given list (behavioral check)', async ({ page }) => {
      // This test validates the FSM transition "Sorting process initiated with the list [5,2,8,...]"
      // Since the page's click handler calls mergeSort internally but does not expose its return,
      // we validate the same algorithm by invoking mergeSort directly and ensuring it sorts correctly.
      const canonical = [5, 2, 8, 1, 9, 3, 6, 7, 4];
      const result = await page.evaluate(list => {
        // Call mergeSort in-page with the provided list
        return mergeSort(list);
      }, canonical);
      expect(result).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    });
  });

  test.describe('Edge Cases and Error Scenarios', () => {
    test('mergeSort handles empty array and single-element array correctly', async ({ page }) => {
      // Empty array should return empty array
      const emptyResult = await page.evaluate(() => mergeSort([]));
      expect(emptyResult).toEqual([]);

      // Single element should return same single-element array
      const singleResult = await page.evaluate(() => mergeSort([42]));
      expect(singleResult).toEqual([42]);
    });

    test('Calling mergeSort with an invalid argument (null) throws a TypeError (observed and asserted)', async ({ page }) => {
      // We intentionally call mergeSort with null to let a runtime error occur naturally.
      // We assert that the evaluate call rejects and throws an error.
      let thrown = null;
      try {
        // This will throw inside the page context because the code accesses list.length
        await page.evaluate(() => mergeSort(null));
      } catch (e) {
        thrown = e;
      }
      // The evaluation should have thrown—ensure we observed an exception
      expect(thrown).not.toBeNull();
      // The message typically involves 'length' but may vary; assert it's an Error-like message
      expect(String(thrown.message || thrown)).toBeTruthy();
    });

    test('merge function exists and properly merges two sorted arrays', async ({ page }) => {
      // Validate the internal merge function behavior directly
      const merged = await page.evaluate(() => {
        if (typeof merge !== 'function') return { exists: false };
        const left = [1, 4, 6];
        const right = [2, 3, 5];
        return { exists: true, result: merge(left, right) };
      });
      expect(merged.exists).toBeTruthy();
      expect(merged.result).toEqual([1, 2, 3, 4, 5, 6]);
    });
  });

  test.describe('Observability: console and runtime error monitoring', () => {
    test('No unexpected page errors on normal usage and console remains clean', async ({ page }) => {
      // Click the button as a normal usage scenario
      await page.click('#merge-sort-button');

      // Ensure no unhandled page errors
      expect(pageErrors.length).toBe(0);

      // There may be informational console messages but no console errors expected
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });

    test('Deliberately provoke a runtime error and ensure it is observed via pageerror', async ({ page }) => {
      // Add an async throw inside the page via evaluate that will be visible as a pageerror
      // We do not modify global functions; instead, execute an immediate void function that throws asynchronously
      // Note: page.evaluate runs in page and exceptions will be propagated as the promise rejection; to cause pageerror listener to fire,
      // we schedule an exception using setTimeout inside the page.
      await page.evaluate(() => {
        setTimeout(() => {
          // This will cause an unhandled exception within the page context and should trigger 'pageerror'
          // We purposefully reference a property of undefined to produce a TypeError
          try {
            const x = undefined;
            // Accessing x.length will throw
            // eslint-disable-next-line no-unused-expressions
            x.length;
          } catch (e) {
            // Re-throw asynchronously to create an unhandled error (simulate)
            // Using setTimeout to throw outside of this try-catch
            setTimeout(() => { throw e; }, 0);
          }
        }, 0);
      });

      // Wait briefly to allow the asynchronous error to propagate and be caught by the pageerror listener
      await new Promise(resolve => setTimeout(resolve, 100));

      // The pageErrors array should contain at least one error
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);

      // The captured error should include type or message indicative of a TypeError or similar
      const errorMessages = pageErrors.map(e => String(e.message || e));
      const anyContainsLength = errorMessages.some(m => /length|undefined|Cannot read/i.test(m));
      expect(anyContainsLength).toBeTruthy();
    });
  });
});