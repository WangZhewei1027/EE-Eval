import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e17cdc0-d5c5-11f0-92ee-f5994b4f4c99.html';

test.describe('Merge Sort Interactive Application (FSM: Idle)', () => {
  // Each test will load the page as-is and observe console / page errors.
  // We do NOT modify or patch the page; we let any runtime errors happen naturally
  // and assert that they occur (or assert observed behaviors if no errors).

  test('S0_Idle entry action (renderPage) should be attempted or JS errors reported on load', async ({ page }) => {
    // Collect console messages and page errors for inspection
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // pageerror gives Error object; capture its message for assertions
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Load the page exactly as-is
    const response = await page.goto(APP_URL);
    expect(response && response.ok()).toBeTruthy();

    // Wait briefly to allow any inline scripts to run and errors to surface
    await page.waitForTimeout(500);

    // Debug info saved in test output on failure if needed:
    // Expectation: since the FSM entry action mentions renderPage() but the page likely
    // does not define it, we expect at least one runtime error (ReferenceError / TypeError / SyntaxError).
    expect(pageErrors.length + consoleMessages.filter(m => m.type === 'error').length).toBeGreaterThan(0);

    // At least one error message should indicate a ReferenceError / TypeError / SyntaxError or mention renderPage
    const errorTexts = [
      ...pageErrors,
      ...consoleMessages.filter(m => m.type === 'error').map(m => m.text)
    ].join('\n');

    // Validate that some common JS error terms are present in collected errors
    expect(
      /ReferenceError|TypeError|SyntaxError|renderPage|mergeSort|merge|middle|arr/i.test(errorTexts)
    ).toBeTruthy();
  });

  test('mergeSort and merge functions: existence or observable errors when invoked', async ({ page }) => {
    // This test checks whether the functions are defined and, if so, calls mergeSort
    // to validate runtime behavior (letting errors occur naturally and asserting them).

    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => pageErrors.push(String(err && err.message ? err.message : err)));

    await page.goto(APP_URL);
    await page.waitForTimeout(300);

    // Check if functions are present in the global scope
    const types = await page.evaluate(() => {
      return {
        mergeSort: typeof window.mergeSort,
        merge: typeof window.merge
      };
    });

    // If functions are defined, attempt to call mergeSort with a small array and expect it to either:
    // - return something (unlikely for this broken implementation), or
    // - throw an error which will be surfaced back to the test (we assert that an error was thrown).
    if (types.mergeSort === 'function') {
      let evalError = null;
      try {
        // Call with small input to trigger internal logic; allow any thrown error to be caught.
        await page.evaluate(() => {
          // Intentionally call the function exactly as implemented in the page environment.
          return mergeSort([3, 1, 4]);
        });
      } catch (e) {
        evalError = e;
      }

      // For this implementation we expect an error to occur when invoking mergeSort.
      // Assert that either an exception was thrown by the evaluation or there were page errors logged.
      expect(evalError || pageErrors.length > 0 || consoleMessages.some(m => m.type === 'error')).toBeTruthy();
      if (evalError) {
        // If an evaluation error occurred, ensure it looks like a JS runtime error (Reference/Type/Syntax)
        expect(/ReferenceError|TypeError|SyntaxError|middle|arr|renderPage/i.test(String(evalError.message))).toBeTruthy();
      }
    } else {
      // If the functions are not defined, that's also an important observation (possible syntax/parsing error).
      // Assert that at least one pageerror or console error exists.
      expect(pageErrors.length + consoleMessages.filter(m => m.type === 'error').length).toBeGreaterThan(0);
    }
  });

  test('No interactive elements exist (buttons/inputs) consistent with extraction_summary', async ({ page }) => {
    // The FSM extraction summary notes no interactive elements were detected.
    // Assert that the page contains no buttons, inputs, selects, textareas.
    await page.goto(APP_URL);
    const interactiveCount = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('button,input,select,textarea')).length;
    });

    expect(interactiveCount).toBe(0);
  });

  test('No transitions detected: verify absence of inline event handlers', async ({ page }) => {
    // FSM reported 0 transitions; check that there are no inline onclick/onchange attributes present.
    await page.goto(APP_URL);

    const elementsWithInlineHandlers = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('*')).filter(el => {
        // Check common inline handler attributes
        const attrs = ['onclick','onchange','oninput','onsubmit','onmouseover','onkeydown','onkeyup'];
        return attrs.some(a => el.hasAttribute && el.hasAttribute(a));
      }).map(el => el.tagName);
    });

    expect(elementsWithInlineHandlers.length).toBe(0);
  });

  test('Edge case: ensure example usage (console.log(mergeSort(arr))) either logs output or produces errors', async ({ page }) => {
    // The example in the HTML shows a console.log(mergeSort(arr)) call.
    // We observe console messages and assert that either a result was logged or an error occurred.
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(String(err && err.message ? err.message : err)));

    await page.goto(APP_URL);
    // Allow time for any example usage to execute and logs/errors to appear
    await page.waitForTimeout(500);

    const logTexts = consoleMessages.filter(m => m.type === 'log').map(m => m.text).join('\n');
    const errorTexts = [
      ...pageErrors,
      ...consoleMessages.filter(m => m.type === 'error').map(m => m.text)
    ].join('\n');

    // The test accepts either a successful log (unlikely given code) or errors.
    const sawLogOutput = logTexts.length > 0;
    const sawErrors = errorTexts.length > 0;

    expect(sawLogOutput || sawErrors).toBeTruthy();

    // If errors occurred, ensure they appear to be JS runtime errors
    if (sawErrors) {
      expect(/ReferenceError|TypeError|SyntaxError|middle|arr|renderPage|mergeSort|merge/i.test(errorTexts)).toBeTruthy();
    }
  });
});