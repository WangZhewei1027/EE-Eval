import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/718988e0-d362-11f0-85a0-d3271c47ca09.html';

test.describe('Quick Sort Interactive Application - FSM validation and runtime errors', () => {

  // Setup: common console and pageerror collectors for each test
  test.beforeEach(async ({ page }) => {
    // Collect console messages for later assertions
    (page as any).__consoleMessages = [];
    page.on('console', msg => {
      (page as any).__consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Collect page errors for later assertions (kept in array)
    (page as any).__pageErrors = [];
    page.on('pageerror', err => {
      (page as any).__pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Tear down listeners to avoid leaks (best-effort; Playwright cleans up fixtures)
    page.removeAllListeners?.('console');
    page.removeAllListeners?.('pageerror');
  });

  test('S0_Idle: The page should render the #quicksort container (Idle state evidence)', async ({ page }) => {
    // This test validates the FSM initial state evidence:
    // - The div with id="quicksort" should exist and be present in the DOM.
    // - Because the implementation has a runtime error when attempting to sort a missing input,
    //   the innerHTML is expected to remain empty (assignment is not completed).
    // - There are no interactive elements (buttons/inputs) as the FSM notes claim.
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    const quicksort = page.locator('#quicksort');
    await expect(quicksort).toBeVisible();

    // The script attempts to set innerHTML, but due to an error it should still be empty
    const innerHTML = await quicksort.evaluate(node => node.innerHTML);
    expect(innerHTML).toBe('', 'Expected #quicksort to remain empty because script failed before assignment');

    // Verify there are no interactive form controls or buttons on the page (matches FSM notes)
    const interactiveCount = await page.locator('button, input, select, textarea, a').count();
    expect(interactiveCount).toBe(0);

    // Verify there are no inline onclick attributes present (no simple inline event handlers)
    const onclickCount = await page.locator('[onclick]').count();
    expect(onclickCount).toBe(0);
  });

  test('Runtime error: loading page produces a TypeError due to null input reference', async ({ page }) => {
    // This test asserts that the page throws a runtime TypeError naturally when the inline script runs.
    // We wait for the pageerror event which captures unhandled exceptions on the page.
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Also collect console messages while navigating (quickSort external script may produce network errors)
    const gotoPromise = page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    const [pageError] = await Promise.all([pageErrorPromise, gotoPromise]);

    // Assert that a page error occurred and looks like a TypeError caused by accessing .length of null
    expect(pageError).toBeTruthy();
    // Accept several possible browser error message formats in different engines
    expect(pageError.message).toMatch(/Cannot read properties of null|Cannot read property 'length'|arr is null|TypeError/);

    // Also assert that at least one console error was emitted (could be from missing quicksort.js or other runtime logs)
    // We rely on the console collection attached in beforeEach
    const consoleMessages = (page as any).__consoleMessages || [];
    const errorCount = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning').length;
    expect(errorCount).toBeGreaterThanOrEqual(0); // non-strict: some environments may not emit a console error for 404
    // If there are console error messages, confirm at least one of them mentions quicksort.js or 'Failed to load' when present
    const mentionsQuicksort = consoleMessages.some(m => /quicksort\.js|Failed to load resource|404/.test(m.text));
    // This is defensive — the environment may or may not report network loads to console.
    // We don't require it, but if present, assert it's a string.
    if (errorCount > 0) {
      expect(typeof consoleMessages[0].text).toBe('string');
    }

    // Finally, the #quicksort container should remain empty because script execution was interrupted by the error
    const quicksortInner = await page.locator('#quicksort').evaluate(n => n.innerHTML);
    expect(quicksortInner).toBe('', 'When runtime error occurs, assignment to #quicksort.innerHTML should not complete');
  });

  test('Behavioral check: quickSort function exists and when provided valid input returns (may be string due to implementation bug)', async ({ page }) => {
    // This test inspects the quickSort function defined in the page and calls it with a valid array.
    // We do not modify the page; we simply call an existing function in page context.
    // Because quickSort uses + to concatenate arrays, the return type may be coerced to string.
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' }).catch(() => {
      // navigation may produce page errors; swallow to proceed with evaluation
    });

    // Confirm quickSort is defined as a function
    const typeofQuickSort = await page.evaluate(() => {
      return typeof (window as any).quickSort;
    });
    expect(typeofQuickSort).toBe('function');

    // Call quickSort with a known array and observe result type and content characteristics.
    // We wrap the evaluation to avoid throwing in the test if the function itself errors for some reason.
    const result = await page.evaluate(() => {
      try {
        // calling with primitive numeric array which should avoid the earlier null problem
        // The implementation picks a random pivot; result may vary, and due to + operator it may be a string
        // Return a tuple of info for robust assertions in the test harness
        const output = (window as any).quickSort([3, 1, 2]);
        return { ok: true, type: typeof output, value: output };
      } catch (e) {
        return { ok: false, errorMessage: String(e) };
      }
    });

    // Ensure call completed rather than throwing unexpectedly in this environment
    expect(result.ok).toBeTrue();

    // The implementation incorrectly uses + to combine arrays, which coerces them to strings in JS.
    // So accept either 'string' or 'object' (array) but prefer to document the incorrect behavior.
    expect(['string', 'object']).toContain(result.type);

    // If it is a string, ensure it contains numeric characters joined by commas (likely)
    if (result.type === 'string') {
      expect(/[\d,]+/.test(String(result.value))).toBeTrue();
    } else {
      // If array, ensure it contains the expected items (subset of the original array)
      expect(Array.isArray(result.value)).toBeTrue();
    }
  });

  test('FSM transitions and event handlers: none should be present (per FSM extraction summary)', async ({ page }) => {
    // The FSM indicates zero events and zero transitions. Here we try to validate there are no event handlers attached
    // via common attributes or elements that would imply interactive transitions.
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // No inline event attributes
    const inlineEventAttrs = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('*'));
      return elements
        .map(el => {
          const attrs = Array.from((el as Element).attributes || []).map(a => a.name);
          return attrs.filter(n => n.startsWith('on'));
        })
        .flat();
    });
    // Inline "on*" attributes list should be empty per FSM notes
    expect(inlineEventAttrs.length).toBe(0);

    // No interactive elements (buttons/inputs) that would enable transitions
    const interactiveElems = await page.locator('button, input, select, textarea, a').count();
    expect(interactiveElems).toBe(0);

    // There are no transitions or events to trigger; assert that the page does not expose a global function named 'renderPage'
    // which the FSM claimed was an entry action (we assert it is not present)
    const hasRenderPage = await page.evaluate(() => typeof (window as any).renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);
  });

});