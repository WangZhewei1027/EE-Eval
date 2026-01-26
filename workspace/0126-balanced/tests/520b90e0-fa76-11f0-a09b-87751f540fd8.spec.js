import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520b90e0-fa76-11f0-a09b-87751f540fd8.html';

test.describe('520b90e0-fa76-11f0-a09b-87751f540fd8 — Logistic Regression FSM tests', () => {
  // Arrays to collect runtime errors and console error messages for each test
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    pageErrors = [];
    consoleErrors = [];

    // Collect unhandled page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // Push the Error object for detailed inspection in tests
      pageErrors.push(err);
    });

    // Collect console messages (to capture console.error and other logs)
    page.on('console', (msg) => {
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push({ type: msg.type(), text: msg.text() });
      }
    });

    // Navigate to the application under test and allow natural errors to occur
    // We wait for the load event so inline scripts have a chance to run/throw
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Clear collectors (not strictly necessary, but explicit)
    pageErrors = null;
    consoleErrors = null;
  });

  test('S0_Idle state: page renders with correct title and header (entry evidence)', async ({ page }) => {
    // This test validates the Idle state's evidence: the page title and main header exist
    // It does not attempt to modify the page or patch scripts; it simply inspects the DOM.
    const title = await page.title();
    expect(title).toBe('Logistic Regression');

    // Check main header text is present
    const headerText = await page.locator('.header h1').innerText();
    expect(headerText).toContain('Logistic Regression');

    // Check descriptive paragraph exists and contains expected phrase
    const desc = await page.locator('.header p').innerText();
    expect(desc).toContain('Logistic Regression is a supervised learning algorithm');

    // The result container should be present in the DOM (even if empty due to script errors)
    const resultHandle = page.locator('#result');
    await expect(resultHandle).toHaveCount(1);

    // Because the application script may have failed, the result content may be empty.
    // Assert that the result element exists; content may be empty string or populated depending on runtime.
    const resultText = (await resultHandle.innerText()).trim();
    // We don't assert it must be empty here; just assert it's a string (sanity)
    expect(typeof resultText).toBe('string');
  });

  test('Transition DisplayResult and S1_ResultDisplayed: detect runtime SyntaxError and absence of expected predictions', async ({ page }) => {
    // This test validates the FSM transition path that should call displayResult(predictions).
    // The page as-provided contains invalid JavaScript ("1 if (prob > 0.5) else 0") which should
    // cause a SyntaxError during script parsing/execution. We assert that such an error occurred,
    // and that the expected DOM update "Predictions: 0 1 1 1 " did NOT occur.

    // Inspect collected page errors to ensure an actual scripting error occurred
    expect(pageErrors.length).toBeGreaterThan(0);

    // Look for a SyntaxError (or an error message indicating an unexpected token / identifier)
    const syntaxErr = pageErrors.find((e) => {
      try {
        // Some environments give Error objects with name and message
        return e && (e.name === 'SyntaxError' ||
          /Unexpected token|Unexpected identifier|Unexpected reserved word|Unexpected.*if/i.test(e.message));
      } catch {
        return false;
      }
    });
    expect(syntaxErr).toBeTruthy();

    // Verify console also captured an error message referencing the syntax issue
    const consoleHasSyntax = consoleErrors.some((c) =>
      /Unexpected token|Unexpected identifier|SyntaxError|Unexpected.*if/i.test(c.text)
    );
    expect(consoleHasSyntax).toBeTruthy();

    // The expected FSM observable when transition succeeds is:
    // "Predictions: 0 1 1 1 "
    // Because a SyntaxError occurred, displayResult should not have executed; assert that the exact expected text is not present.
    const resultText = await page.locator('#result').innerText();
    expect(resultText).not.toBe('Predictions: 0 1 1 1 ');

    // Also assert that the result text does not contain the substring 'Predictions:' which would indicate displayResult ran.
    expect(resultText).not.toContain('Predictions:');

    // Verify that functions that should have been defined by the script are not available (since parsing failed)
    // We check types of makePrediction and displayResult in page global scope.
    const globals = await page.evaluate(() => {
      return {
        makePredictionType: typeof makePrediction,
        displayResultType: typeof displayResult,
        logisticRegressionType: typeof logisticRegression
      };
    });
    // If the script parsing failed, these should be 'undefined' (not 'function').
    expect(globals.makePredictionType).toBe('undefined');
    expect(globals.displayResultType).toBe('undefined');
    // In some cases partial parsing may define some functions; but we expect at least one critical function to be missing.
    // Assert that not all three are functions to ensure script did not fully execute successfully.
    const allFunctions = globals.makePredictionType === 'function'
                      && globals.displayResultType === 'function'
                      && globals.logisticRegressionType === 'function';
    expect(allFunctions).toBe(false);
  });

  test('Edge case: reload preserves the script error (consistent failure scenario)', async ({ page }) => {
    // This test reloads the page to ensure errors occur consistently across navigations.
    // It captures errors produced during the reload and ensures they match the original type (SyntaxError-like).

    // Clear previous collectors and reattach within this test scope (page listeners are already attached in beforeEach)
    // Perform reload
    await page.reload({ waitUntil: 'load' });

    // Small delay to allow pageerror events to propagate
    await page.waitForTimeout(100);

    // There should be at least one page error collected
    expect(pageErrors.length).toBeGreaterThan(0);

    // Ensure a SyntaxError-like message is present after reload as well
    const syntaxErrOnReload = pageErrors.some((e) => {
      try {
        return e && (e.name === 'SyntaxError' ||
          /Unexpected token|Unexpected identifier|Unexpected.*if|SyntaxError/i.test(e.message));
      } catch {
        return false;
      }
    });
    expect(syntaxErrOnReload).toBeTruthy();

    // After reload, the result element should still not contain the expected predictions
    const resultAfterReload = await page.locator('#result').innerText();
    expect(resultAfterReload).not.toContain('Predictions: 0 1 1 1 ');
  });

  test('Sanity check: ensure FSM expected transition would produce known output if it had executed (assertion of expectation)', async ({ page }) => {
    // This test documents the FSM expected observable and asserts that the environment does NOT currently match it.
    // It's a formal check showing the difference between expected FSM behavior and actual runtime behavior.

    const expectedOutput = 'Predictions: 0 1 1 1 ';

    // Read current DOM output
    const actualOutput = await page.locator('#result').innerText();

    // Assert the actual output is not equal to the expected FSM observable (since the page has a syntax/runtime error)
    expect(actualOutput).not.toBe(expectedOutput);

    // Additionally, assert that the page has recorded script errors (reinforcing the reason for mismatch)
    expect(pageErrors.length).toBeGreaterThan(0);
  });
});