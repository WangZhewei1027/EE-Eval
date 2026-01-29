import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b194f2-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Divide and Conquer - Merge Sort Example (FSM: Idle -> Sorted)', () => {
  // Navigate to the page before each test to start from a clean state
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  // Test 1: Validate the initial Idle state (S0_Idle)
  test('S0_Idle: Initial render shows Merge Sort Example button and mergeSort is not defined', async ({ page }) => {
    // Ensure the button exists and is visible as evidence of the Idle state
    const button = page.locator('#merge-sort-example');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Merge Sort Example');

    // Validate that the page does not define mergeSort as a function (we do not inject or modify global state)
    // Use typeof to avoid throwing ReferenceError in the page context
    const mergeSortType = await page.evaluate(() => typeof mergeSort);
    expect(mergeSortType).toBe('undefined');

    // Ensure no immediate page errors were thrown during load (best-effort check).
    // We wait briefly for any pageerror that might happen synchronously on load; if none, test continues.
    let pageErrorOccurred = false;
    const onError = () => (pageErrorOccurred = true);
    page.on('pageerror', onError);
    // small delay to catch synchronous errors during navigation
    await page.waitForTimeout(100);
    page.off('pageerror', onError);
    expect(pageErrorOccurred).toBe(false);
  });

  // Test 2: Clicking the example should trigger the FSM transition event (MergeSortExampleClick).
  // Because mergeSort is not defined in the implementation, this should produce a ReferenceError (left to happen naturally).
  test('Transition MergeSortExampleClick: clicking the button triggers a ReferenceError for missing mergeSort and no sorted output is logged', async ({ page }) => {
    const button = page.locator('#merge-sort-example');

    // Collect console messages to assert that no sorted array gets logged
    const consoleMessages = [];
    page.on('console', msg => {
      // store both type and text for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Perform the click and wait for the runtime page error that should naturally occur (ReferenceError)
    // We await the pageerror event in parallel with the click so we capture the thrown error.
    const [pageError] = await Promise.all([
      page.waitForEvent('pageerror'),
      button.click()
    ]);

    // The runtime error should reference mergeSort being undefined.
    // Different engines format messages differently, so check for relevant substrings.
    const message = pageError.message || String(pageError);
    expect(message.toLowerCase()).toContain('mergesort');
    // Also expect it to indicate that it's not defined or is missing
    const containsNotDefined = /not defined|is not defined|is not a function|undefined/i.test(message);
    expect(containsNotDefined).toBe(true);

    // Ensure that the console did not log the sorted array (S1_Sorted entry action) due to the error.
    // The expected sorted array would contain the numbers 11 and 90 and other values; assert no console.log includes these in array form.
    const loggedTexts = consoleMessages.map(m => m.text);
    const loggedJoined = loggedTexts.join('\n');
    // If mergeSort had been called successfully, a line like "11,12,22,25,34,64,90" or "[11,12,22,25,34,64,90]" would be present.
    expect(loggedJoined).not.toMatch(/11.*12.*22.*25.*34.*64.*90/);
    expect(loggedJoined).not.toMatch(/\[?\s*11\s*,\s*12/);
  });

  // Test 3: Repeated clicks should produce repeated ReferenceErrors (edge case for repeated event handling)
  test('Multiple MergeSortExampleClick events produce repeated ReferenceErrors', async ({ page }) => {
    const button = page.locator('#merge-sort-example');
    const errorMessages = [];

    // Attach a listener to capture all pageerrors
    const onPageError = (err) => {
      errorMessages.push(err.message || String(err));
    };
    page.on('pageerror', onPageError);

    // Click the button three times sequentially, awaiting a pageerror each time
    for (let i = 0; i < 3; i++) {
      // Wait for a new pageerror caused by this click
      const [err] = await Promise.all([
        page.waitForEvent('pageerror'),
        button.click()
      ]);
      // Basic sanity: each error should reference mergeSort
      const text = err.message || String(err);
      expect(text.toLowerCase()).toContain('mergesort');
    }

    // Remove listener
    page.off('pageerror', onPageError);

    // Confirm we've captured at least three error messages via the listener as well
    expect(errorMessages.length).toBeGreaterThanOrEqual(3);
    for (const msg of errorMessages.slice(0, 3)) {
      expect(msg.toLowerCase()).toContain('mergesort');
    }
  });

  // Test 4: Validate that the application does not silently transition to the S1_Sorted "final" state.
  // Because mergeSort is missing, the expected onEnter/onExit actions described in the FSM (console.log(sortedNumbers))
  // should not successfully execute. We assert the absence of that console output even after clicking.
  test('S1_Sorted entry action (console.log(sortedNumbers)) does not occur when mergeSort is undefined', async ({ page }) => {
    const button = page.locator('#merge-sort-example');

    // Capture console logs for inspection
    const logs = [];
    page.on('console', msg => {
      if (msg.type() === 'log') logs.push(msg.text());
    });

    // Click and allow the error to occur
    await Promise.all([
      page.waitForEvent('pageerror'),
      button.click()
    ]);

    // Give a short grace period for any additional console messages (if they were to appear)
    await page.waitForTimeout(50);

    // None of the captured console.log messages should be the sortedNumbers array (e.g., "11,12,22,25,34,64,90")
    const joined = logs.join('||');
    expect(joined).not.toContain('11,12,22,25,34,64,90');
    expect(joined).not.toContain('[11,12,22,25,34,64,90]');
  });
});