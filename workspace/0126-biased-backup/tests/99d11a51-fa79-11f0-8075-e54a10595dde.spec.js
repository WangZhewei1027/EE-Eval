import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d11a51-fa79-11f0-8075-e54a10595dde.html';

test.describe('99d11a51-fa79-11f0-8075-e54a10595dde - Logistic Regression Interactive Demo', () => {
  // Containers to capture runtime diagnostics from the page
  let consoleMessages = [];
  let pageErrors = [];
  let dialogs = [];

  // Attach listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Capture console messages for later assertions / debugging
    page.on('console', (msg) => {
      // record only text to keep assertions simple
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Capture uncaught exceptions from the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // record the message for assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Capture dialogs (alerts) so tests can assert their presence and auto-accept them
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Ensure page is closed after each test to avoid cross-test contamination
    try {
      await page.close();
    } catch (e) {
      // ignore close errors
    }
  });

  test.describe('Initial rendering and S0 (Idle) state', () => {
    test('renders the main UI elements and has no uncaught page errors on load', async ({ page }) => {
      // Validate presence of heading (evidence of S0_Idle entry action renderPage())
      const title = page.locator('h1');
      await expect(title).toHaveText('Logistic Regression Interactive Demo');

      // Validate inputs have expected default values per FSM/components
      await expect(page.locator('#coef0')).toHaveValue('0');
      await expect(page.locator('#coef1')).toHaveValue('1');
      await expect(page.locator('#coef2')).toHaveValue('1');
      await expect(page.locator('#inputValue')).toHaveValue('0');

      // Output should be empty initially
      await expect(page.locator('#output')).toHaveText('');

      // Assert there were no uncaught page errors on initial load
      // This observes the runtime for ReferenceError/SyntaxError/TypeError occurrences
      expect(pageErrors).toEqual([]);

      // Also assert there were no unexpected console errors (we expect minimal/none)
      // This is a loose check: ensure nothing indicates 'Error' in console messages
      const hasConsoleErrorLike = consoleMessages.some((m) =>
        /error/i.test(m)
      );
      expect(hasConsoleErrorLike).toBeFalsy();
    });
  });

  test.describe('S1 ModelUpdated transition and alert behavior', () => {
    test('clicking Update Model shows alert and updates internal coefficients for future predictions', async ({ page }) => {
      // Change coefficients to known values
      await page.fill('#coef0', '0.5');
      await page.fill('#coef1', '1.2');
      await page.fill('#coef2', '-0.3');

      // Click update - per FSM an alert('Model Updated!') should appear
      await page.click('#updateButton');

      // The dialog handler in beforeEach auto-accepted the alert.
      // Confirm that an alert occurred and had the expected message.
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const lastDialog = dialogs[dialogs.length - 1];
      expect(lastDialog.type).toBe('alert');
      expect(lastDialog.message).toBe('Model Updated!');

      // No uncaught page errors should have occurred during the update interaction
      expect(pageErrors).toEqual([]);

      // To confirm the update actually had an effect (we cannot access internal "let" vars),
      // perform a prediction using a known input and check the output matches calculation
      // Using inputValue = 2 should use the updated coefficients.
      const inputValue = 2;
      await page.fill('#inputValue', String(inputValue));
      // Click predict
      await page.click('#predictButton');

      // Read output text and parse the numeric probability
      const outputText = await page.locator('#output').innerText();
      expect(outputText.startsWith('Predicted Probability:')).toBeTruthy();

      const numericPart = outputText.replace('Predicted Probability:', '').trim();
      const parsed = parseFloat(numericPart);

      // Compute expected prediction using same formula as the page script
      const coef0 = 0.5;
      const coef1 = 1.2;
      const coef2 = -0.3;
      const z = coef0 + coef1 * inputValue + coef2 * Math.pow(inputValue, 2);
      const expectedPrediction = 1 / (1 + Math.exp(-z));

      // Allow a small tolerance due to string formatting differences
      const tolerance = 1e-12;
      expect(Math.abs(parsed - expectedPrediction)).toBeLessThan(tolerance);

      // Ensure no uncaught exceptions were fired by the predict click
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('S2 Predicted transition and output behavior', () => {
    test('predict produces expected probability for given coefficients and input', async ({ page }) => {
      // Set known coefficients
      await page.fill('#coef0', '0.0');
      await page.fill('#coef1', '1.0');
      await page.fill('#coef2', '1.0');

      // Set an input value that exercises the quadratic term
      const inputValue = 3;
      await page.fill('#inputValue', String(inputValue));

      // Click predict
      await page.click('#predictButton');

      // Validate that output text updates as described in FSM/S2 entry action
      const out = await page.locator('#output').innerText();
      expect(out.startsWith('Predicted Probability:')).toBeTruthy();

      // Extract numeric value and assert correctness
      const numStr = out.replace('Predicted Probability:', '').trim();
      const parsedOut = parseFloat(numStr);

      // Compute expected
      const coef0 = 0.0;
      const coef1 = 1.0;
      const coef2 = 1.0;
      const z = coef0 + coef1 * inputValue + coef2 * Math.pow(inputValue, 2);
      const expected = 1 / (1 + Math.exp(-z));

      // Allow small tolerance in numeric comparison
      expect(Math.abs(parsedOut - expected)).toBeLessThan(1e-12);

      // No alerts should have been shown for a pure prediction action
      const anyAlert = dialogs.some((d) => d.type === 'alert');
      // There may be previous alerts from other tests in the same file; ensure at least none fired during this step:
      // We cannot time-slice dialogs easily here, but there must be no new page errors
      expect(pageErrors).toEqual([]);
    });

    test('edge case: empty inputValue yields NaN in prediction output (graceful handling)', async ({ page }) => {
      // Ensure coefficients are valid numbers
      await page.fill('#coef0', '1');
      await page.fill('#coef1', '1');
      await page.fill('#coef2', '1');

      // Clear the inputValue to an empty string to simulate missing input
      // Using evaluate to ensure we truly clear the value attribute
      await page.evaluate(() => {
        const el = document.getElementById('inputValue');
        if (el) el.value = '';
      });

      // Click predict - parseFloat('') => NaN and calculation should result in NaN displayed
      await page.click('#predictButton');

      const out = await page.locator('#output').innerText();
      expect(out.startsWith('Predicted Probability:')).toBeTruthy();

      // The numeric portion should be 'NaN' (string), or parseFloat yields NaN
      const numericPart = out.replace('Predicted Probability:', '').trim();
      // parseFloat('NaN') => NaN; isNaN check
      const parsed = parseFloat(numericPart);
      expect(Number.isNaN(parsed)).toBeTruthy();

      // This should not produce an uncaught page error (the app handles NaN gracefully)
      expect(pageErrors).toEqual([]);
    });

    test('edge case: extremely large z results in probability close to 1 (no crash)', async ({ page }) => {
      // Set coefficients and input to large values to produce a very large z
      await page.fill('#coef0', '1000');
      await page.fill('#coef1', '1000');
      await page.fill('#coef2', '1000');
      await page.fill('#inputValue', '1000');

      // Click predict
      await page.click('#predictButton');

      const out = await page.locator('#output').innerText();
      expect(out.startsWith('Predicted Probability:')).toBeTruthy();

      const numericStr = out.replace('Predicted Probability:', '').trim();
      const parsed = parseFloat(numericStr);

      // For extremely large positive z, prediction -> 1
      expect(parsed).toBeGreaterThan(0.9999999999);

      // Confirm no uncaught exceptions or console-critical messages
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Observability: console and runtime errors monitoring', () => {
    test('reports captured console messages and page errors for diagnostics', async ({ page }) => {
      // This test intentionally verifies that our monitoring captured arrays are available
      // At this point (after page load in beforeEach) there should be no uncaught page errors.
      // We record the current values and assert expected structure.

      // Basic expectations about array shapes and types
      expect(Array.isArray(consoleMessages)).toBeTruthy();
      expect(Array.isArray(pageErrors)).toBeTruthy();
      expect(Array.isArray(dialogs)).toBeTruthy();

      // By default, the page implementation should not emit uncaught runtime errors
      expect(pageErrors.length).toBe(0);

      // The console messages array may be empty or contain non-error logs; ensure no fatal messages like "SyntaxError"
      const fatalConsole = consoleMessages.find((m) =>
        /syntaxerror|referenceerror|typeerror/i.test(m)
      );
      expect(fatalConsole).toBeUndefined();
    });
  });
});