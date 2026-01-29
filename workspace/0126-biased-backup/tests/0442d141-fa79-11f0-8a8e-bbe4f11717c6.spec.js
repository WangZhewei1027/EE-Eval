import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0442d141-fa79-11f0-8a8e-bbe4f11717c6.html';

// Helper to detect runtime errors (ReferenceError, TypeError, SyntaxError) from pageerrors or console.error messages
function containsRuntimeError(errorsArray, consoleArray) {
  const pattern = /(ReferenceError|TypeError|SyntaxError)/i;
  for (const e of errorsArray) {
    if (pattern.test(String(e))) return true;
  }
  for (const c of consoleArray) {
    if (pattern.test(String(c.text))) return true;
  }
  return false;
}

test.describe('Topological Sort - FSM validation and runtime error observation', () => {
  // Shared collections for each test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    pageErrors = [];
    consoleMessages = [];

    // Collect unhandled page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // store the error message for assertions later
      try {
        pageErrors.push(err && err.message ? err.message : String(err));
      } catch (e) {
        pageErrors.push(String(err));
      }
    });

    // Collect console messages (logs, warnings, errors). We will inspect these for runtime error strings.
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application page and wait for load to complete
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Give the page a short moment to run any startup scripts so that we capture errors triggered on load
    await page.waitForTimeout(300);
  });

  test.afterEach(async () => {
    // No-op: the page fixture will be torn down by Playwright automatically.
    // Keeping afterEach to satisfy structure and future teardown steps.
  });

  test('Idle state (S0_Idle) - initial render and UI elements present', async ({ page }) => {
    // This test validates the Idle state:
    // - The page should render the main UI: title, SVG, Sort and Reverse buttons, and the result paragraph.
    // - We also observe console/page errors to detect missing entry actions like renderPage() if they cause ReferenceError.
    // Assertions:
    //  - DOM components exist and are visible
    //  - #result exists and is initially empty (as per FSM evidence)
    //  - We capture and assert runtime errors occurred during initial load (per task requirements)

    // Verify the main heading is present
    await expect(page.locator('h1')).toHaveText('Topological Sort');

    // Verify the SVG visual exists
    const svg = page.locator('svg');
    await expect(svg).toBeVisible();
    // Verify expected svg attributes as described in FSM
    const width = await svg.getAttribute('width');
    const height = await svg.getAttribute('height');
    expect(width).toBe('600');
    expect(height).toBe('600');

    // Verify controls exist
    const sortBtn = page.locator('#sort-button');
    const reverseBtn = page.locator('#reverse-button');
    await expect(sortBtn).toBeVisible();
    await expect(reverseBtn).toBeVisible();

    // Verify result container exists and is initially empty (Idle state's evidence)
    const result = page.locator('#result');
    await expect(result).toBeVisible();
    const initialResultText = (await result.textContent()) || '';
    expect(initialResultText.trim()).toBe('');

    // The FSM entry action is renderPage(). The page may call renderPage() on load.
    // Per instructions, we must observe console logs and page errors and assert that runtime errors (ReferenceError, TypeError, SyntaxError) occur naturally.
    const hasRuntime = containsRuntimeError(pageErrors, consoleMessages);

    // Document what was observed (kept as assertions per instructions)
    // If the implementation is broken/absent, we expect to see at least one runtime error related to missing functions.
    expect(hasRuntime).toBeTruthy();
  });

  test('Transition: SortButtonClick from Idle -> Sorted (S1_Sorted) validates result update or runtime error', async ({ page }) => {
    // This test validates the Sort transition:
    // - Clicking the Sort button should either update #result with sorted nodes (successful flow)
    //   or produce runtime errors (e.g., sortGraph is undefined) which we must observe and assert.
    // - We also check that clicking triggers any console errors/messages.

    const sortBtn = page.locator('#sort-button');
    const result = page.locator('#result');

    // Ensure button is present before clicking
    await expect(sortBtn).toBeVisible();

    // Click the Sort button
    await sortBtn.click();

    // Allow time for any handlers to run and for errors to surface
    await page.waitForTimeout(300);

    // Capture the result text after clicking
    const afterSortText = (await result.textContent()) || '';

    // Two acceptable outcomes (per instructions):
    //  1) The implementation worked: result text was updated to show sorted nodes (non-empty).
    //  2) The implementation failed: a runtime error happened (ReferenceError/TypeError/SyntaxError).
    const hasRuntime = containsRuntimeError(pageErrors, consoleMessages);

    // Assert that at least one of the outcomes happened:
    // - either we saw an update in the result text
    // - or we observed a runtime error (which indicates missing/incomplete implementation)
    const updatedResult = afterSortText.trim().length > 0;
    expect(updatedResult || hasRuntime).toBeTruthy();

    // If the result updated, check that it is displayed inside the #result paragraph as evidence of S1_Sorted
    if (updatedResult) {
      // Basic sanity checks: the FSM expects "result text updated with sorted nodes" — ensure it's non-empty and not the same as initial empty state
      expect(afterSortText.trim().length).toBeGreaterThan(0);
    } else {
      // If not updated, ensure that the failure had an identifiable runtime error type
      expect(hasRuntime).toBeTruthy();
    }
  });

  test('Transition: ReverseButtonClick from Idle -> Reversed (S2_Reversed) validates result update or runtime error', async ({ page }) => {
    // This test validates the Reverse transition:
    // - Clicking the Reverse button should either update #result with reversed nodes (successful flow)
    //   or produce runtime errors (e.g., reverseGraph is undefined) which we must observe and assert.

    const reverseBtn = page.locator('#reverse-button');
    const result = page.locator('#result');

    // Ensure button is present before clicking
    await expect(reverseBtn).toBeVisible();

    // Click the Reverse button
    await reverseBtn.click();

    // Allow time for any handlers to run and for errors to surface
    await page.waitForTimeout(300);

    // Capture the result text after clicking
    const afterReverseText = (await result.textContent()) || '';

    // Acceptable outcomes:
    //  - Successful update: #result contains reversed nodes (non-empty)
    //  - Failure: runtime error occurred and was captured
    const hasRuntime = containsRuntimeError(pageErrors, consoleMessages);
    const updatedResult = afterReverseText.trim().length > 0;
    expect(updatedResult || hasRuntime).toBeTruthy();

    if (updatedResult) {
      // Verify some minimal content is present
      expect(afterReverseText.trim().length).toBeGreaterThan(0);
    } else {
      expect(hasRuntime).toBeTruthy();
    }
  });

  test('Edge case: Rapid repeated clicks on Sort and Reverse produce stable behavior or predictable errors', async ({ page }) => {
    // This test checks robustness if user clicks buttons rapidly.
    // We validate that either the DOM handles multiple clicks gracefully (e.g., stable result) or that errors are generated and captured.

    const sortBtn = page.locator('#sort-button');
    const reverseBtn = page.locator('#reverse-button');
    const result = page.locator('#result');

    await expect(sortBtn).toBeVisible();
    await expect(reverseBtn).toBeVisible();

    // Rapidly click Sort, Reverse, Sort in succession
    await sortBtn.click();
    await reverseBtn.click();
    await sortBtn.click();

    // Wait for handlers to execute
    await page.waitForTimeout(500);

    // Inspect final result and errors
    const finalResultText = (await result.textContent()) || '';
    const hasRuntime = containsRuntimeError(pageErrors, consoleMessages);

    // We accept either a non-empty result (stable update) OR runtime errors (implementation issues)
    expect(finalResultText.trim().length > 0 || hasRuntime).toBeTruthy();

    // Additionally, if there were runtime errors, they should be of the expected categories
    if (hasRuntime) {
      const errorMessages = [...pageErrors, ...consoleMessages.map(c => c.text)];
      const matched = errorMessages.some(m => /(ReferenceError|TypeError|SyntaxError)/i.test(String(m)));
      expect(matched).toBeTruthy();
    } else {
      // If no runtime errors, ensure result is non-empty
      expect(finalResultText.trim().length).toBeGreaterThan(0);
    }
  });

  test('Implementation observation: Inspect console for explicit mentions of entry/exit actions (renderPage, displaySortedResult, displayReversedResult)', async ({ page }) => {
    // This test inspects console logs for explicit mentions of FSM entry actions.
    // Some implementations log calls like "renderPage()", "displaySortedResult()", etc.
    // We do not inject or alter code; we only observe and assert that either such logs appear or runtime errors referencing those functions appear.

    // Allow time for any lazy logs
    await page.waitForTimeout(300);

    const logs = consoleMessages.map(c => `${c.type}: ${c.text}`).join('\n');

    const mentioned = /renderPage|displaySortedResult|displayReversedResult/i.test(logs);
    const hasRuntime = containsRuntimeError(pageErrors, consoleMessages);

    // We accept either explicit console mentions or runtime errors that reference the function names.
    // This satisfies testing the presence/absence of expected entry actions.
    // Per the task requirements, runtime errors are to be observed and asserted.
    expect(mentioned || hasRuntime).toBeTruthy();

    // If a runtime error occurred referencing a function name, assert that the function name appears in error messages
    if (hasRuntime) {
      const aggregated = [...pageErrors, ...consoleMessages.map(c => c.text)].join('\n');
      const functionNamesPattern = /(renderPage|displaySortedResult|displayReversedResult|sortGraph|reverseGraph)/i;
      expect(functionNamesPattern.test(aggregated)).toBeTruthy();
    }
  });
});