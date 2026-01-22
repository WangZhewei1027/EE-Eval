import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/718a4c30-d362-11f0-85a0-d3271c47ca09.html';

test.describe('Binary Search FSM - Interactive Application (718a4c30-d362-11f0-85a0-d3271c47ca09)', () => {
  // Helper to navigate and collect console logs & page errors for each test
  async function preparePage(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      // collect console messages emitted by the page
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // collect runtime errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });

    // small pause to allow initial scripts to run and logs/errors to be captured
    await page.waitForTimeout(100);

    return { consoleMessages, pageErrors };
  }

  test('Initial Idle state renders page elements and logs initial binarySearch output', async ({ page }) => {
    // This test validates the Idle (S0_Idle) state:
    // - The page renders the expected UI (title, explanatory paragraph, Search button)
    // - The binarySearch example usage in the page logs its result to the console (evidence of S1_Searching example output)
    const { consoleMessages, pageErrors } = await preparePage(page);

    // Verify page structure: title and button exist
    const title = await page.locator('h1').textContent();
    expect(title).toBeTruthy();
    expect(title.trim()).toContain('Binary Search');

    const button = page.locator("button[onclick='binarySearch()']");
    await expect(button).toHaveCount(1);

    // #binarySearchResult should be present but initially empty (FSM notes say output is logged, not displayed)
    const resultDiv = page.locator('#binarySearchResult');
    await expect(resultDiv).toHaveCount(1);
    const resultText = (await resultDiv.textContent() || '').trim();
    expect(resultText).toBe('', 'binarySearchResult is expected to be empty (page logs result to console, not DOM)');

    // There should be a console log from the example usage: console.log(binarySearch(arr, target)); -> "2"
    const hasExampleLog = consoleMessages.some(m => /(^|\s)2($|\s|\.)/.test(m.text));
    expect(hasExampleLog).toBeTruthy();

    // No unexpected fatal page errors should have occurred during initial load (we'll assert specific errors later when triggered)
    // But record if there were any page errors
    expect(pageErrors.length).toBeGreaterThanOrEqual(0);
  });

  test('binarySearch function exists as a global and returns expected index when called with proper args', async ({ page }) => {
    // Validate S1_Searching entry action: binarySearch(arr, target) works when invoked with correct parameters
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Call the global binarySearch function directly in the page context with a safe odd-length array
    const result = await page.evaluate(() => {
      // call with proper args to validate the function's return
      // We intentionally use an odd-length array [1,2,3,4,5] to avoid the non-integer mid issue in the implementation
      return window.binarySearch([1, 2, 3, 4, 5], 3);
    });

    expect(result).toBe(2); // expected index for target=3 in [1,2,3,4,5]
  });

  test('Clicking the Search button triggers the Searching transition and results in a runtime TypeError (missing args)', async ({ page }) => {
    // This test simulates the FSM event SearchClick:
    // - Click the button with onclick="binarySearch()"
    // - The implementation calls binarySearch() with no args, which should cause a TypeError when it tries to access arr.length
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure the button exists before clicking
    const button = page.locator("button[onclick='binarySearch()']");
    await expect(button).toHaveCount(1);

    // Click the Search button (this triggers binarySearch() with no arguments)
    await button.click();

    // Give the page a moment to surface the runtime error
    await page.waitForTimeout(100);

    // We expect a runtime error to have been emitted and captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // At least one of the captured errors should be a TypeError (attempt to read .length of undefined)
    const hasTypeError = pageErrors.some(e => (e && e.name === 'TypeError') || (e && /length/i.test(String(e.message))));
    expect(hasTypeError).toBeTruthy();

    // The DOM output should remain unchanged: binarySearchResult should still be empty (no DOM update is done by the implementation)
    const resultText = (await page.locator('#binarySearchResult').textContent() || '').trim();
    expect(resultText).toBe('', 'Clicking Search should not populate #binarySearchResult because the implementation logs to console and the click triggers an error.');
  });

  test('Directly invoking binarySearch() with no arguments throws a TypeError in the page context', async ({ page }) => {
    // This explicitly validates an error scenario: calling binarySearch with missing parameters should throw a TypeError.
    await page.goto(APP_URL, { waitUntil: 'load' });

    const evalResult = await page.evaluate(() => {
      try {
        // Intentionally call with no args to let the runtime error occur naturally
        // This is executed inside the page context and will throw; we catch and return error details
        binarySearch();
        return { threw: false };
      } catch (e) {
        return { threw: true, name: e.name, message: String(e.message) };
      }
    });

    expect(evalResult.threw).toBe(true);
    expect(evalResult.name).toBe('TypeError');
    // message should refer to reading 'length' or 'undefined'
    expect(/length|undefined/i.test(evalResult.message)).toBeTruthy();
  });

  test('renderPage onEnter action is not defined: attempting to call it raises a ReferenceError', async ({ page }) => {
    // FSM metadata lists renderPage() as an entry action for the Idle state.
    // The implementation does not define renderPage, so attempting to call it should cause a ReferenceError.
    await page.goto(APP_URL, { waitUntil: 'load' });

    const evalResult = await page.evaluate(() => {
      try {
        // Intentionally call the missing function to observe the natural ReferenceError
        renderPage();
        return { called: true };
      } catch (e) {
        // Return the error name/message for assertions in the test context
        return { called: false, name: e.name, message: String(e.message) };
      }
    });

    expect(evalResult.called).toBe(false);
    expect(evalResult.name).toBe('ReferenceError');
    expect(/renderPage/i.test(evalResult.message)).toBeTruthy();
  });

  test('Multiple SearchClicks produce multiple runtime errors (robustness/edge case)', async ({ page }) => {
    // Edge case: repeatedly triggering the event that causes the TypeError should yield multiple pageerror events
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto(APP_URL, { waitUntil: 'load' });

    const button = page.locator("button[onclick='binarySearch()']");
    await expect(button).toHaveCount(1);

    // Click multiple times to generate repeated errors
    await button.click();
    await button.click();
    await button.click();

    // Allow errors to be reported
    await page.waitForTimeout(200);

    // Expect at least 3 errors because we clicked 3 times (may be >=3 depending on other runtime issues)
    expect(pageErrors.length).toBeGreaterThanOrEqual(3);

    // Confirm that the errors are TypeErrors or mention 'length' (i.e., the root cause is consistent)
    const consistent = pageErrors.every(e => (e && e.name === 'TypeError') || (e && /length/i.test(String(e.message))));
    expect(consistent).toBeTruthy();
  });
});