import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b0d1a1-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Bucket Sort FSM and interactive application tests (f5b0d1a1-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // These arrays will be repopulated in beforeEach for each test to collect console messages / errors.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Prepare collectors for console and page errors for each test run.
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // store console messages (type and text) for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // store page errors (Error objects) for assertions
      pageErrors.push(err);
    });

    // Load the page exactly as provided (do not modify it)
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Tear down: ensure listeners don't leak between tests (Playwright typically isolates pages per test).
    // Explicitly remove listeners added in beforeEach if needed. (Best-effort; page is isolated per test by Playwright.)
    // No modifications to global page environment per instructions.
  });

  test('Initial state (S0_Idle): Button is present and visible; functions are defined on the page', async ({ page }) => {
    // Validate Idle state's evidence: the Run Bucket Sort button exists with correct id and text.
    const button = await page.locator('#run-bucket-sort');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Run Bucket Sort');

    // Verify that the functions referenced in FSM are defined on the window context
    const functionsDefined = await page.evaluate(() => {
      return {
        hasRunBucketSort: typeof runBucketSort === 'function',
        hasDivideData: typeof divideData === 'function',
        hasSortBucket: typeof sortBucket === 'function',
        hasCombineSortedOutput: typeof combineSortedOutput === 'function',
      };
    });

    expect(functionsDefined.hasRunBucketSort).toBe(true);
    expect(functionsDefined.hasDivideData).toBe(true);
    expect(functionsDefined.hasSortBucket).toBe(true);
    expect(functionsDefined.hasCombineSortedOutput).toBe(true);
  });

  test('Calling divideData directly triggers the expected runtime error (edge case)', async ({ page }) => {
    // This test invokes divideData in the page context and asserts that it throws a TypeError
    // (based on the provided implementation which fails to initialize bucket subarrays).
    const result = await page.evaluate(() => {
      try {
        divideData();
        return { threw: false };
      } catch (e) {
        // Serialize key parts of the error so assertions can be made outside the page context.
        return { threw: true, name: e && e.name, message: e && e.message };
      }
    });

    // We expect divideData to throw due to push on undefined (buckets entries not initialized).
    expect(result.threw).toBe(true);
    expect(typeof result.name).toBe('string');
    // Error should be a TypeError; at minimum its message should mention 'push' or 'undefined' or similar.
    expect(result.name).toMatch(/TypeError/i);
    expect(result.message.toLowerCase()).toMatch(/push|cannot read|undefined/);
  });

  test('Clicking "Run Bucket Sort" triggers runBucketSort and results in a runtime pageerror (transition S0 -> S1)', async ({ page }) => {
    // Validate that clicking the button triggers the event handler and lets the runtime error surface naturally.
    const btn = page.locator('#run-bucket-sort');
    await expect(btn).toBeVisible();

    // Prepare to wait for a pageerror that should be produced by runBucketSort (due to divideData)
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Click the button to trigger the FSM transition from Idle to Sorting
    await btn.click();

    // Wait for the runtime error to be emitted from the page
    const error = await pageErrorPromise;

    // Store in our collector as well (already stored by page.on listener)
    // Assert the error is a TypeError originating from attempt to push into undefined bucket
    expect(error).toBeTruthy();
    expect(typeof error.message).toBe('string');
    // The message should indicate the nature of the bug (accessing push on undefined or similar)
    expect(error.message.toLowerCase()).toMatch(/push|cannot read|undefined/);

    // Ensure that console did NOT contain a successful sorted output array log (the intended observable),
    // since the runtime error prevents the final console.log(sortedOutput) from running.
    const printedArrays = consoleMessages.filter(m => m.type === 'log' && /\[.*\d.*\]/.test(m.text));
    expect(printedArrays.length).toBe(0);
  });

  test('Multiple clicks cause repeated runtime errors (robustness check)', async ({ page }) => {
    // Clicking multiple times should repeatedly try to run runBucketSort and thus produce multiple pageerrors.
    const btn = page.locator('#run-bucket-sort');
    await expect(btn).toBeVisible();

    // Trigger two sequential clicks and wait for two pageerror events.
    const errorPromises = [
      page.waitForEvent('pageerror'),
      page.waitForEvent('pageerror')
    ];

    // First click
    await btn.click();
    // Second click
    await btn.click();

    // Await both errors
    const errors = await Promise.all(errorPromises);

    expect(errors.length).toBe(2);
    for (const err of errors) {
      expect(err.message.toLowerCase()).toMatch(/push|cannot read|undefined/);
    }

    // Our page.on collector should have recorded the errors as well
    expect(pageErrors.length).toBeGreaterThanOrEqual(2);
    pageErrors.forEach(err => {
      expect(err.message.toLowerCase()).toMatch(/push|cannot read|undefined/);
    });
  });

  test('combineSortedOutput behaves correctly when given valid buckets (unit-like test without mutating page state)', async ({ page }) => {
    // We can call combineSortedOutput directly with a valid array of buckets because the function is defined
    // and uses the page-level k value (k = 3). Provide a 3-bucket array and assert concatenation behaves as expected.
    const combined = await page.evaluate(() => {
      // Provide explicit buckets corresponding to k = 3
      const testBuckets = [
        [5, 6],
        [1],
        [2, 3, 4]
      ];
      return combineSortedOutput(testBuckets);
    });

    expect(combined).toEqual([5, 6, 1, 2, 3, 4]);
  });

  test('sortBucket sorts an array in place as implemented (algorithm correctness check for bucket-level sort)', async ({ page }) => {
    // Validate the helper sortBucket sorts a provided bucket array in place as per its selection-like sort.
    const sorted = await page.evaluate(() => {
      const b = [9, 2, 7, 3];
      sortBucket(b);
      return b;
    });

    expect(sorted).toEqual([2, 3, 7, 9]);
  });

  test('Event handler existence: the button has an event listener attached (inferred via click causing handler logic)', async ({ page }) => {
    // We cannot introspect addEventListener directly, but we can infer presence because clicking triggers the runBucketSort function.
    // Use page.waitForEvent to capture the runtime error emitted by handler execution to infer the listener exists.
    const btn = page.locator('#run-bucket-sort');

    // Confirm that clicking the button produces a pageerror (handler executed)
    const promise = page.waitForEvent('pageerror');
    await btn.click();
    const err = await promise;

    expect(err).toBeTruthy();
    expect(err.message.toLowerCase()).toMatch(/push|cannot read|undefined/);
  });

  test('Sanity: no unexpected syntax or reference errors on page load (page-level errors are captured)', async ({ page }) => {
    // On initial load we expect no ReferenceError or SyntaxError during parse/execution of the provided script.
    // We recorded pageErrors in beforeEach; verify none of them are SyntaxError or ReferenceError emitted at load time.
    // (Note: clicks in other tests may have produced errors; this test runs in isolation so pageErrors here refer to load-time)
    // If there are any errors, ensure they are not SyntaxError/ReferenceError (but allow TypeError during interactions in other tests).
    const loadTimeErrors = pageErrors.slice(); // snapshot
    for (const err of loadTimeErrors) {
      // Ensure load-time errors are not syntax/reference parsing errors
      expect(err.name).not.toMatch(/SyntaxError|ReferenceError/);
    }
  });
});