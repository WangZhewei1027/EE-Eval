import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e19f0a0-d5c5-11f0-92ee-f5994b4f4c99.html';

test.describe('0e19f0a0-d5c5-11f0-92ee-f5994b4f4c99 - Fibonacci Sequence App', () => {
  // Container for console messages and page errors captured during navigation/execution
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection (info, warning, error, etc.)
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', error => {
      pageErrors.push(String(error));
    });

    // Navigate to the application page (load it exactly as-is)
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // no-op teardown; keeping hooks explicit for clarity
  });

  test('Initial state (S0_Idle) renders Fibonacci(5) into #sequence and page content is present', async ({ page }) => {
    // This test validates the FSM's single state evidence:
    // The page should set #sequence.innerHTML to fibonacci(5) on load.
    // We assert visible DOM shows "5" and basic static content exists.

    // Check page title and headings exist
    await expect(page.locator('h1')).toHaveText('The Fibonacci Sequence');
    await expect(page.locator('p')).toContainText('It is a mathematical sequence'); // first paragraph contains this phrase

    // The span#sequence should contain the computed fibonacci(5) which is '5'
    const seq = page.locator('#sequence');
    await expect(seq).toBeVisible();
    await expect(seq).toHaveText('5');

    // Verify no unexpected runtime errors were thrown during page load
    expect(pageErrors.length, 'No uncaught page errors should have occurred').toBe(0);

    // Verify no console error messages were emitted during load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console.error messages should have been produced').toBe(0);
  });

  test('Fibonacci function exists and computes correct values for several inputs (edge cases included)', async ({ page }) => {
    // Validate that the fibonacci function (declared in the page) is available and returns expected results.
    // We call it within the page context via evaluate (do NOT inject or redefine anything).

    // typeof fibonacci should be 'function' in page context
    const typeofFibonacci = await page.evaluate(() => {
      try {
        return typeof fibonacci;
      } catch (e) {
        // If fibonacci is not defined, return a sentinel string
        return 'undefined';
      }
    });
    expect(typeofFibonacci).toBe('function');

    // Test several inputs, including edge cases mentioned by the HTML script (n <= 1)
    const results = await page.evaluate(() => {
      return {
        f0: fibonacci(0),   // expected 0
        f1: fibonacci(1),   // expected 1
        f2: fibonacci(2),   // expected 1
        f5: fibonacci(5),   // expected 5 (also what the page displays)
        f10: fibonacci(10), // expected 55
        fNegative: fibonacci(-1) // expected -1 by the function's implementation (returns n if n <= 1)
      };
    });

    expect(results.f0).toBe(0);
    expect(results.f1).toBe(1);
    expect(results.f2).toBe(1);
    expect(results.f5).toBe(5);
    expect(results.f10).toBe(55);
    expect(results.fNegative).toBe(-1);

    // Ensure no page errors or console errors occurred while invoking the function
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Implementation vs FSM: entry action "renderPage" is not present in the runtime (verify mismatch)', async ({ page }) => {
    // FSM entry_actions listed "renderPage()". The implementation does not define renderPage.
    // This test verifies that renderPage is undefined in the page context (i.e., the FSM entry action does not exist).
    // We do NOT attempt to call renderPage (must not cause additional runtime errors).

    const renderPageType = await page.evaluate(() => {
      try {
        return typeof renderPage;
      } catch (e) {
        return 'reference-error';
      }
    });

    // Expect that renderPage is not defined (typeof === 'undefined')
    expect(renderPageType).toBe('undefined');

    // Also assert the page still produced the expected evidence (sequence innerHTML was set)
    await expect(page.locator('#sequence')).toHaveText('5');

    // No runtime exceptions should have been thrown just by accessing the typeof
    expect(pageErrors.length).toBe(0);
  });

  test('No interactive elements or transitions: verifies absence of buttons and event handlers elements', async ({ page }) => {
    // The FSM declares zero events/transitions. The implementation is static.
    // Verify that there are no <button> elements and no obvious interactive controls.
    const buttonCount = await page.evaluate(() => document.querySelectorAll('button').length);
    expect(buttonCount).toBe(0);

    // Verify there are no input elements that suggest interactivity
    const inputCount = await page.evaluate(() => document.querySelectorAll('input, textarea, select, button').length);
    // Expect only zero interactive controls; it's acceptable if none exist
    expect(inputCount).toBe(0);

    // Confirm that the page remains stable with no console errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Robustness check: calling fibonacci with a moderately larger input via page.evaluate to ensure recursion works within reasonable limits', async ({ page }) => {
    // This test calls fibonacci(15) to ensure recursion functions and doesn't crash.
    // We keep the number modest to avoid excessive CPU/time.

    const value15 = await page.evaluate(() => {
      try {
        return { ok: true, value: fibonacci(15) }; // expected 610
      } catch (e) {
        return { ok: false, error: String(e) };
      }
    });

    expect(value15.ok, 'fibonacci(15) should compute successfully').toBe(true);
    expect(value15.value).toBe(610);

    // Confirm still no runtime errors captured globally
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Console and page error capture sanity: ensure we recorded console messages and they contain no errors', async ({ page }) => {
    // This test simply asserts that our console capture worked and that there are no error-level logs.
    // We do not assert on info/debug logs because they may vary, but error logs should be absent.

    // At least ensure the consoleMessages array has been populated (could be empty for a silent page)
    expect(Array.isArray(consoleMessages)).toBe(true);

    // Filter any 'error' type console messages; expect none for a correct runtime
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);

    // And assert no uncaught page errors were captured
    expect(pageErrors.length).toBe(0);
  });
});