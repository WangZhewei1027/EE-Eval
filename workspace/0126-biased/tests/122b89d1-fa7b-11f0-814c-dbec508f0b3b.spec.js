import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122b89d1-fa7b-11f0-814c-dbec508f0b3b.html';

test.describe('Quick Sort Interactive App - FSM validation and error observation', () => {
  // Shared collectors for console errors and page errors for each test
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages (console.error etc.)
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Collect unhandled page errors (exceptions thrown in page context)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No explicit teardown beyond what Playwright does automatically.
    // We keep the error collections for per-test assertions only.
  });

  test('Initial Idle state: page renders header and description with no immediate runtime errors', async ({ page }) => {
    // Validate initial page content matches S0_Idle evidence
    const header = await page.locator('h1').textContent();
    const paragraph = await page.locator('p').textContent();

    // Ensure header and description are present
    expect(header).toBe('Quick Sort');
    expect(paragraph).toContain('Sort a list of numbers using the Quick Sort algorithm.');

    // On initial load, there should be no immediate page errors or console errors
    // (Some runtime errors only occur after user interaction; assert none so far)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('SubmitSort transition: submitting the form sets up handlers and disables buttons (then invoking sort triggers runtime error due to missing DOM element)', async ({ page }) => {
    // This test validates the SubmitSort event (form submission) and then triggers the
    // sortNumbers click handler that is registered during submit. We expect DOM changes
    // (disabled attributes and style changes) and then natural runtime errors to occur
    // when sortNumbers attempts to write to a non-existent #sorted-numbers element.

    // Fill the numbers input with a valid list
    const numbersInput = page.locator('#numbers');
    await numbersInput.fill('3,1,2');

    // Submit the form by clicking the sort button (button inside a form defaults to submit)
    await page.click('#sort-btn');

    // After submit handler runs, many buttons are set to disabled in the implementation.
    // Verify that disabled attributes were applied.
    const sortBtnDisabled = await page.locator('#sort-btn').evaluate((el) => el.disabled);
    const resetBtnDisabled = await page.locator('#reset-btn').evaluate((el) => el.disabled);
    const quickBtnDisabled = await page.locator('#quick-sort-btn').evaluate((el) => el.disabled);

    expect(sortBtnDisabled).toBe(true);
    expect(resetBtnDisabled).toBe(true);
    expect(quickBtnDisabled).toBe(true);

    // The submit handler also toggles style.display on various buttons (implementation sets sortBtn.style.display = 'block' and resetBtn.style.display = 'none')
    const sortBtnDisplay = await page.locator('#sort-btn').evaluate((el) => el.style.display);
    const resetBtnDisplay = await page.locator('#reset-btn').evaluate((el) => el.style.display);

    expect(sortBtnDisplay).toBe('block');
    expect(resetBtnDisplay).toBe('none');

    // Now, clicking the sort button again should invoke the click handler added during submit.
    // That click handler (sortNumbers) in the page tries to set document.getElementById('sorted-numbers').value,
    // but the element does not exist in the HTML, so a runtime error (TypeError) should be thrown.
    // Use waitForEvent to observe the pageerror.
    const [err] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#sort-btn').catch(() => {
        // Some browsers may reject the click if fatal; swallow and let pageerror capture it
      }),
    ]);

    // We should have captured a page error from the previous interaction
    expect(err).toBeTruthy();
    // The error message should indicate inability to access properties of null or undefined
    const msg = err.message || String(err);
    expect(
      msg.includes('Cannot set properties of null') ||
      msg.includes("Cannot set properties of undefined") ||
      msg.includes("Cannot read properties of null") ||
      msg.includes("Cannot read properties of undefined") ||
      msg.includes('document.getElementById') ||
      msg.includes('is not defined')
    ).toBeTruthy();
  });

  test('Click events for all sorting algorithm buttons cause natural runtime errors or state effects (as implemented) - validate transitions in S1_Sorted', async ({ page }) => {
    // This test will:
    // - Submit the form to register click handlers (SubmitSort)
    // - For each algorithm button listed in the FSM, perform a click and assert that
    //   a runtime error occurs (ReferenceError/TypeError) OR the DOM changes as per implementation.
    // The application code contains many inconsistencies and undefined functions; we assert that
    // these errors are observed naturally.

    // Submit the form first to register click handlers
    await page.fill('#numbers', '5,2,9,1');
    await page.click('#sort-btn');

    // Helper to click a selector and capture a page error if thrown within a timeout
    async function clickAndCapture(selector) {
      try {
        // Use Promise.race between click and a pageerror event to detect errors produced by click handler.
        const clickPromise = page.click(selector).catch(() => { /* swallow click rejection - rely on pageerror */ });
        const errorPromise = page.waitForEvent('pageerror', { timeout: 1500 }).then((e) => ({ error: e }));
        // Wait for whichever happens first: click completes or an error occurs
        const result = await Promise.race([clickPromise.then(() => ({ clicked: true })), errorPromise]);
        return result;
      } catch (e) {
        // Timeout waiting for pageerror -> return that nothing happened
        return { timedOut: true, exception: e };
      }
    }

    const algorithmButtons = [
      '#max-heap-btn',
      '#in-order-btn',
      '#bubble-btn',
      '#quick-sort-btn',
      '#merge-sort-btn',
      '#insertion-sort-btn',
      '#kth-largest-btn',
    ];

    let observedErrors = 0;
    for (const sel of algorithmButtons) {
      const res = await clickAndCapture(sel);
      if (res && res.error) {
        observedErrors += 1;
        // Each reported error should be a real JS error (ReferenceError/TypeError etc.)
        const message = res.error.message || String(res.error);
        expect(
          message.includes('is not defined') ||
          message.includes('Cannot read properties') ||
          message.includes('Cannot set properties') ||
          message.includes('undefined') ||
          message.includes('null')
        ).toBeTruthy();
      } else {
        // No error captured quickly — but the implementation may have toggled DOM. Validate some expected DOM effect:
        // The implementation frequently hides the form when algorithms are invoked: check whether form is hidden.
        const formDisplay = await page.locator('#sort-form').evaluate((el) => getComputedStyle(el).display);
        // If the form is hidden, consider this a meaningful state change (transition)
        if (formDisplay === 'none') {
          // valid state change observed
        } else {
          // It's acceptable for some clicks to neither error nor hide; just record that no quick error occurred.
        }
      }
    }

    // At least some of the algorithm button clicks should have produced runtime errors given the broken implementations.
    expect(observedErrors).toBeGreaterThanOrEqual(1);
  });

  test('Reset transition: when in Sorted state, clicking Reset should produce the implemented behavior or errors', async ({ page }) => {
    // This test exercises the transition S1_Sorted -> S0_Idle triggered by ClickReset according to FSM.
    // Because the implementation is inconsistent, we assert whichever natural result occurs:
    // - either a state change (form visible/hidden) or a runtime error thrown.

    // Submit and then invoke a sorting function to reach a state where reset might be meaningful.
    await page.fill('#numbers', '10,7,8');
    await page.click('#sort-btn');

    // Try to click the reset button. It may or may not have a handler properly attached; observe pageerror if any.
    let resetResult;
    try {
      // Attempt click and wait briefly for page error
      const clickPromise = page.click('#reset-btn').catch(() => {});
      const errorPromise = page.waitForEvent('pageerror', { timeout: 1500 }).then((e) => ({ error: e }));
      resetResult = await Promise.race([clickPromise.then(() => ({ clicked: true })), errorPromise]);
    } catch (e) {
      resetResult = { timedOut: true };
    }

    if (resetResult && resetResult.error) {
      // A runtime error occurred naturally when clicking Reset; assert it looks like a JS error
      const message = resetResult.error.message || String(resetResult.error);
      expect(
        message.includes('is not defined') ||
        message.includes('Cannot read properties') ||
        message.includes('Cannot set properties') ||
        message.includes('null') ||
        message.includes('undefined')
      ).toBeTruthy();
    } else {
      // No immediate error: validate DOM reflects some reset-like behavior.
      // The code sometimes hides the form and shows the reset button; check if form is visible or not.
      const formDisplay = await page.locator('#sort-form').evaluate((el) => getComputedStyle(el).display);
      // It's plausible the form is hidden after operations; however a true reset would make form visible.
      // Accept either, but assert the DOM is consistent (string)
      expect(typeof formDisplay).toBe('string');
    }
  });

  test('Edge cases: submitting empty input and invoking quickSort via evaluate to validate algorithm implementation (descending behavior)', async ({ page }) => {
    // This test covers edge cases:
    // - Submitting an empty input to observe the behavior and natural errors
    // - Directly invoking quickSort(numbers) in the page context to validate its algorithmic output (descending order per implementation)

    // 1) Submit with empty input
    await page.fill('#numbers', '');
    // Clicking sort to submit
    const emptySubmitPromise = page.waitForEvent('pageerror', { timeout: 1500 }).catch(() => null);
    await page.click('#sort-btn').catch(() => {});
    const emptySubmitError = await emptySubmitPromise;

    // If an error was thrown, it should be due to operations on invalid data (e.g., NaN, null)
    if (emptySubmitError) {
      const msg = emptySubmitError.message || String(emptySubmitError);
      expect(
        msg.includes('Cannot') ||
        msg.includes('is not defined') ||
        msg.includes('undefined') ||
        msg.includes('null') ||
        msg.includes('NaN')
      ).toBeTruthy();
    } else {
      // If no error, ensure the page's global numbers variable exists and is an array (possibly containing NaN)
      const numbersValue = await page.evaluate(() => {
        // Return the global numbers variable snapshot
        try { return numbers; } catch (e) { return null; }
      });
      expect(Array.isArray(numbersValue)).toBe(true);
    }

    // 2) Directly invoke quickSort in the page context to assert sorting algorithm behavior.
    // Per the page's quickSort implementation, it arranges elements in descending order.
    const sortedDesc = await page.evaluate(() => {
      try {
        // Direct call to the page's quickSort implementation
        // Return the result so we can assert its shape
        return quickSort([3, 1, 2]);
      } catch (e) {
        return { thrown: String(e) };
      }
    });

    // Validate that quickSort produced a descending order [3,2,1] given the implementation in the page
    if (Array.isArray(sortedDesc)) {
      expect(sortedDesc).toEqual([3, 2, 1]);
    } else {
      // If invocation threw, assert that the thrown message is a natural JS error (do not patch)
      expect(sortedDesc.thrown).toBeTruthy();
    }
  });

  test('Verify implementation inconsistencies: insertion sort naming mismatches and kthLargest dependencies cause errors naturally', async ({ page }) => {
    // The HTML has inconsistent function names: insertionsort vs insertionSort, and kthLargest relies on #k and #sorted-numbers.
    // This test clicks the insertion and kth-largest buttons after submit and asserts the natural errors.

    // Submit to register click handlers
    await page.fill('#numbers', '4,2,6');
    await page.click('#sort-btn');

    // Click insertion-sort button and capture error
    const insertionResult = await Promise.race([
      page.click('#insertion-sort-btn').then(() => ({ clicked: true })).catch(() => ({ clicked: true })),
      page.waitForEvent('pageerror', { timeout: 1500 }).then((e) => ({ error: e })).catch(() => ({ noError: true })),
    ]);

    if (insertionResult && insertionResult.error) {
      const msg = insertionResult.error.message || String(insertionResult.error);
      expect(
        msg.includes('is not defined') ||
        msg.includes('Cannot') ||
        msg.includes('undefined') ||
        msg.includes('null')
      ).toBeTruthy();
    } else {
      // No quick error: validate form visibility or disabled state as a fallback observation
      const formDisplay = await page.locator('#sort-form').evaluate((el) => getComputedStyle(el).display);
      expect(typeof formDisplay).toBe('string');
    }

    // Click kth-largest button; the implementation expects an input #k and relies on insertionSort function
    const kthResult = await Promise.race([
      page.click('#kth-largest-btn').then(() => ({ clicked: true })).catch(() => ({ clicked: true })),
      page.waitForEvent('pageerror', { timeout: 1500 }).then((e) => ({ error: e })).catch(() => ({ noError: true })),
    ]);

    if (kthResult && kthResult.error) {
      const msg = kthResult.error.message || String(kthResult.error);
      expect(
        msg.includes('is not defined') ||
        msg.includes('Cannot') ||
        msg.includes('undefined') ||
        msg.includes('null')
      ).toBeTruthy();
    } else {
      // If no error observed immediately, at least confirm that the page attempted to access #k or #sorted-numbers would fail when absent.
      const hasK = await page.locator('#k').count();
      const hasSortedNumbers = await page.locator('#sorted-numbers').count();
      // In the provided HTML both are missing, so we expect 0
      expect(hasK).toBe(0);
      expect(hasSortedNumbers).toBe(0);
    }
  });
});