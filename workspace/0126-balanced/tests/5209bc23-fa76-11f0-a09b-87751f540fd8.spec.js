import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5209bc23-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Sliding Window App (FSM State: Idle)', () => {
  // Containers for observed console messages and page errors
  let consoleMessages;
  let pageErrors;
  let consoleHandler;
  let pageErrorHandler;

  // Attach listeners before each test to observe runtime behavior (console logs and uncaught errors)
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect all console messages
    consoleHandler = (msg) => {
      try {
        // Some console messages have multiple args; use text() which is a concatenation
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    };
    page.on('console', consoleHandler);

    // Collect uncaught page errors
    pageErrorHandler = (err) => {
      // err is an Error object emitted from page context
      pageErrors.push(err);
    };
    page.on('pageerror', pageErrorHandler);

    // Navigate to the application URL and wait for load (this triggers the script execution)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Detach listeners after each test to keep a clean slate
  test.afterEach(async ({ page }) => {
    if (consoleHandler) {
      page.off('console', consoleHandler);
    }
    if (pageErrorHandler) {
      page.off('pageerror', pageErrorHandler);
    }
  });

  test('Entry action slidingWindow() is invoked on load and results in a runtime error (expected)', async ({ page }) => {
    // This test validates that the FSM initial state's entry action slidingWindow() runs on page load
    // and that it produces a runtime error (observed as a pageerror event).
    // We expect a ReferenceError related to 'windowStart' due to the function's usage of a local variable before initialization.

    // Wait for at least one pageerror event (the script calls slidingWindow immediately)
    const error = await page.waitForEvent('pageerror');
    expect(error).toBeTruthy();

    // The error message should indicate the problem with windowStart; be tolerant to exact phrasing
    const msg = error.message || String(error);
    expect(msg.toLowerCase()).toContain('windowstart');

    // Ensure we have captured the same error via the global handler array as well
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const recorded = pageErrors[0];
    const recordedMsg = recorded && recorded.message ? recorded.message : String(recorded);
    expect(recordedMsg.toLowerCase()).toContain('windowstart');
  });

  test('No interactive elements exist (FSM expected: no events or transitions)', async ({ page }) => {
    // The FSM extraction summary said there are no interactive elements.
    // Verify that common interactive controls are absent from the DOM.
    const buttonCount = await page.locator('button').count();
    const inputCount = await page.locator('input').count();
    const selectCount = await page.locator('select').count();
    const textareaCount = await page.locator('textarea').count();

    expect(buttonCount).toBe(0);
    expect(inputCount).toBe(0);
    expect(selectCount).toBe(0);
    expect(textareaCount).toBe(0);

    // Also verify the visible window element exists but is empty (no dynamic content inserted due to error)
    const windowLocator = page.locator('#window');
    await expect(windowLocator).toBeVisible();
    const windowText = (await windowLocator.innerText()).trim();
    expect(windowText).toBe('');
  });

  test('Global variables remain at initial values because slidingWindow() failed early', async ({ page }) => {
    // Validate that the script's early failure prevented mutation of certain globals.
    // `result` should remain an empty array and `currentElement` should remain 0.

    // Evaluate the global variables from the page context
    const { resultValue, currentElementValue } = await page.evaluate(() => {
      // Access globals declared in the page script; they should exist even if the function threw.
      return {
        resultValue: typeof result !== 'undefined' ? result : undefined,
        currentElementValue: typeof currentElement !== 'undefined' ? currentElement : undefined,
      };
    });

    // result was declared as [] at top of the script; since slidingWindow errored before pushing, it should still be []
    expect(Array.isArray(resultValue)).toBe(true);
    expect(resultValue.length).toBe(0);

    // currentElement was initialized to 0 in the script; it should remain 0 because increment didn't run
    expect(currentElementValue).toBe(0);
  });

  test('Console logs do not show processed elements (no result logging due to early script error)', async ({ page }) => {
    // The script would log `result` after calling slidingWindow(); because an error occurs,
    // console.log(result) is not expected to have run. Verify no console message contains known elements.

    // Gather console messages captured during page load
    // Give a small grace period to ensure all console messages arrived
    await page.waitForTimeout(50);

    // Ensure none of the console messages include any of the fruit names from the elements array
    const forbidden = ['apple', 'banana', 'cherry', 'date', 'elderberry', 'result'];
    const lowerMessages = consoleMessages.map((m) => String(m).toLowerCase());

    for (const term of forbidden) {
      const found = lowerMessages.some((m) => m.includes(term));
      // We specifically expect no 'result' log or any fruit name logged
      expect(found).toBe(false);
    }
  });

  test('Invoking slidingWindow() manually from page context reproduces the same ReferenceError', async ({ page }) => {
    // Call slidingWindow() via page.evaluate and capture the thrown error message in a controlled manner.
    // This verifies the function is still present and will throw consistently without runtime fixes.

    const result = await page.evaluate(() => {
      try {
        // Attempt to call the function again; this should throw due to accessing a local TDZ variable
        slidingWindow();
        return { success: true };
      } catch (e) {
        // Return the error message so the test can assert on it
        return { success: false, errorMessage: e && e.message ? e.message : String(e) };
      }
    });

    expect(result.success).toBe(false);
    expect(result.errorMessage).toBeTruthy();
    expect(result.errorMessage.toLowerCase()).toContain('windowstart');
  });

  test('Robustness check: page remains responsive and no unrecoverable crashes after the error', async ({ page }) => {
    // Even though the script threw an error, the page itself should remain functional.
    // We check that we can still query the DOM and that the error didn't crash the renderer.

    // Query the document title as a lightweight liveness check
    const title = await page.title();
    expect(title).toBe('Sliding Window');

    // The #window element should still be present
    const hasWindow = await page.locator('#window').count();
    expect(hasWindow).toBe(1);
  });
});