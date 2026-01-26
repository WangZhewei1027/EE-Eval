import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b08383-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Insertion Sort FSM - f5b08383-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Runs before each test: navigate to the page and ensure it's loaded.
  test.beforeEach(async ({ page }) => {
    // Collect console and page errors to help assertions in individual tests.
    page.on('console', (msg) => {
      // keep console messages in logs for debugging if needed
      // no-op here; tests will attach their own collectors when needed
    });
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Test the Idle state (S0_Idle)
  test('S0_Idle: Page renders the insertion-sort-demo container (idle state)', async ({ page }) => {
    // This test validates the initial/idle state described in the FSM:
    // - The entry action renderPage() is represented by the presence of the div.
    // - The demo container should exist and be empty on initial load.
    const demo = await page.waitForSelector('#insertion-sort-demo', { state: 'attached' });
    expect(demo).not.toBeNull();

    // Verify the container is empty (no inner text or HTML)
    const content = await demo.evaluate((el) => el.innerHTML);
    expect(content).toBe('', 'Expected the demo container to be empty in the Idle state');
  });

  // Test the "StartSorting" event via click - this is an edge case because the HTML defines the function
  // but does NOT attach a click handler to the container. We assert the consequence.
  test('StartSorting (click): Clicking the container does NOT automatically start the demo (edge case)', async ({ page }) => {
    // This test validates the FSM event "StartSorting" which, according to the FSM,
    // should transition to S1_Sorting on click. However the provided HTML DOES NOT attach
    // a click listener. We assert the observed behavior (no change) and capture console/page errors.
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = await page.waitForSelector('#insertion-sort-demo', { state: 'attached' });
    // Click the container - expecting that nothing will happen because no listener is defined.
    await demo.click();

    // Wait a short moment to ensure any synchronous handlers would have run.
    await page.waitForTimeout(200);

    // Assert that no page errors occurred during the click.
    expect(pageErrors.length).toBe(0);

    // Assert that the demo container is still empty because no click handler was bound.
    const contentAfterClick = await demo.evaluate((el) => el.innerHTML);
    expect(contentAfterClick).toBe('', 'Clicking the container should not modify the DOM when no handler is attached');

    // Also assert that no console.error messages were emitted as part of clicking.
    const hasConsoleErrors = consoleMessages.some((m) => m.type === 'error');
    expect(hasConsoleErrors).toBeFalsy();
  });

  // Test the transition to Sorting state (S1_Sorting) by directly invoking the defined function.
  test('S1_Sorting: Direct invocation of insertionSortDemo updates the DOM with sorted values', async ({ page }) => {
    // This test validates the entry action insertionSortDemo() for S1_Sorting.
    // Because the page does not wire the click to the function, we directly call the function
    // to confirm the expected DOM update and sorted output.
    const demo = await page.waitForSelector('#insertion-sort-demo', { state: 'attached' });

    // Ensure the insertionSortDemo function is present on the page
    const hasFunction = await page.evaluate(() => typeof insertionSortDemo === 'function');
    expect(hasFunction).toBeTruthy();

    // Call the function in page context to simulate the entry action of S1_Sorting.
    await page.evaluate(() => {
      // call the global function defined in the HTML
      insertionSortDemo();
    });

    // After invocation, verify the DOM reflects the expected sorted numbers.
    const expectedText = 'Sorted numbers: 11, 12, 22, 25, 34, 64, 90';
    await expect(demo).toHaveText(expectedText);
  });

  // Test insertionSort algorithm correctness by calling insertionSort directly with custom arrays.
  test('insertionSort function correctness and idempotency', async ({ page }) => {
    // This test validates the core algorithm implementation and its behavior on various inputs,
    // including edge cases like empty arrays, single-element arrays, and already-sorted arrays.
    // We call the insertionSort function directly in page context.

    // Helper to run insertionSort in page and return the result
    const sortArray = async (arr) => {
      return await page.evaluate((input) => {
        // ensure insertionSort exists
        if (typeof insertionSort !== 'function') {
          return { error: 'insertionSort not defined' };
        }
        try {
          return { result: insertionSort(input) };
        } catch (e) {
          return { error: e && e.message ? e.message : String(e) };
        }
      }, arr);
    };

    // Edge case: empty array
    const empty = await sortArray([]);
    expect(empty.error).toBeUndefined();
    expect(empty.result).toEqual([]);

    // Single element
    const single = await sortArray([42]);
    expect(single.error).toBeUndefined();
    expect(single.result).toEqual([42]);

    // Already sorted
    const sorted = await sortArray([1, 2, 3, 4, 5]);
    expect(sorted.error).toBeUndefined();
    expect(sorted.result).toEqual([1, 2, 3, 4, 5]);

    // Reverse sorted
    const reverse = await sortArray([5, 4, 3, 2, 1]);
    expect(reverse.error).toBeUndefined();
    expect(reverse.result).toEqual([1, 2, 3, 4, 5]);

    // With duplicates
    const duplicates = await sortArray([3, 1, 2, 3, 1]);
    expect(duplicates.error).toBeUndefined();
    expect(duplicates.result).toEqual([1, 1, 2, 3, 3]);

    // Confirm idempotency: calling insertionSort on already sorted result yields same.
    const idempotent = await sortArray(duplicates.result);
    expect(idempotent.error).toBeUndefined();
    expect(idempotent.result).toEqual(duplicates.result);
  });

  // Error scenario: invoking a non-existent function should surface a ReferenceError.
  test('Error scenario: calling a non-existent function produces a ReferenceError in page context', async ({ page }) => {
    // This test intentionally calls a non-existent function to assert that ReferenceError
    // is thrown naturally by the runtime and observed by Playwright.
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Attempt to call a global function that does not exist.
    let caughtError = null;
    try {
      await page.evaluate(() => {
        // This will throw ReferenceError: nonExistentFunction is not defined
        // We do NOT define or inject anything; we simply call a name that isn't present.
        // This is allowed by the testing constraints to observe runtime errors.
        // eslint-disable-next-line no-undef
        return nonExistentFunction();
      });
    } catch (err) {
      caughtError = err;
    }

    // Playwright should surface an error when the page evaluation throws.
    expect(caughtError).not.toBeNull();
    // The message should indicate a ReferenceError or that the function is not defined.
    const message = String(caughtError.message || caughtError);
    expect(message.toLowerCase()).toContain('not defined' || 'referenceerror');

    // Additionally, the pageerror event should have fired and captured the same error.
    // Wait briefly to allow pageerror listeners to run.
    await page.waitForTimeout(50);
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const sawReferenceError = pageErrors.some((e) => {
      const m = String(e && e.message ? e.message : e);
      return /not defined/i.test(m) || /referenceerror/i.test(m);
    });
    expect(sawReferenceError).toBeTruthy();
  });

  // Verify repeated invocations and DOM updates - ensure replacement behavior is consistent.
  test('Repeated invocation of insertionSortDemo updates DOM deterministically', async ({ page }) => {
    const demo = await page.waitForSelector('#insertion-sort-demo', { state: 'attached' });

    // Call insertionSortDemo twice and assert the content is the same and deterministic.
    await page.evaluate(() => insertionSortDemo());
    const firstContent = await demo.evaluate((el) => el.innerHTML);

    // Mutate nothing and call again
    await page.evaluate(() => insertionSortDemo());
    const secondContent = await demo.evaluate((el) => el.innerHTML);

    expect(firstContent).toBe(secondContent);
    expect(firstContent).toBe('Sorted numbers: 11, 12, 22, 25, 34, 64, 90');
  });

  // Final test: observe that there are no uncaught script errors on initial load for the provided HTML.
  test('No uncaught errors on initial page load', async ({ page }) => {
    // This test ensures that loading the page as-is does not produce uncaught exceptions.
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Reload to ensure fresh capture
    await page.reload({ waitUntil: 'load' });
    // Wait a bit to allow any synchronous errors to surface
    await page.waitForTimeout(200);

    expect(pageErrors.length).toBe(0);
  });
});