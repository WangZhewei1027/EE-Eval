import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12153820-fa7a-11f0-acf9-69409043402d.html';

test.describe('Big-Omega Notation Interactive Explorer - FSM validation', () => {
  // Shared listeners for console and page errors per test
  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors to allow assertions
    page.context()._collectedConsoleMessages = [];
    page.context()._collectedPageErrors = [];

    page.on('console', msg => {
      // Collect all console text for debugging + assertions
      try {
        page.context()._collectedConsoleMessages.push({type: msg.type(), text: msg.text()});
      } catch (e) {
        // ignore collection errors
      }
    });

    page.on('pageerror', err => {
      // Collect uncaught exceptions from the page
      try {
        page.context()._collectedPageErrors.push(err);
      } catch (e) {
        // ignore collection errors
      }
    });

    await page.goto(APP_URL);
    // Wait for initial parsing clicks to complete (script triggers .click() on parse buttons)
    await page.waitForTimeout(50);
  });

  test.afterEach(async ({ page }) => {
    // Ensure no unexpected uncaught page errors happened during tests
    const errs = page.context()._collectedPageErrors || [];
    expect(errs.length).toBe(0);
  });

  test.describe('S0 Idle and parsing initial state', () => {
    test('Initial render shows controls and automatic parse set messages', async ({ page }) => {
      // Validate presence of main controls
      await expect(page.locator('#btn-parse-fn')).toBeVisible();
      await expect(page.locator('#btn-parse-gn')).toBeVisible();
      await expect(page.locator('#btn-check-omega')).toBeVisible();
      await expect(page.locator('#btn-eval-functions')).toBeVisible();
      await expect(page.locator('#btn-auto-search')).toBeVisible();
      await expect(page.locator('#btn-generate-table')).toBeVisible();
      await expect(page.locator('#btn-export-csv')).toBeVisible();
      await expect(page.locator('#btn-clear-console')).toBeVisible();

      // Because the script calls initial parse clicks, there should be parse success messages
      await expect(page.locator('#fn-parse-msg')).toHaveText('f(n) parsed successfully.');
      await expect(page.locator('#gn-parse-msg')).toHaveText('g(n) parsed successfully.');

      // Console logs should contain initial parse messages
      const consoleMsgs = page.context()._collectedConsoleMessages.map(m => m.text);
      expect(consoleMsgs.some(t => t.includes('f(n) parsed:'))).toBeTruthy();
      expect(consoleMsgs.some(t => t.includes('g(n) parsed:'))).toBeTruthy();
    });
  });

  test.describe('Parsing transitions (S0 -> S1)', () => {
    test('Parse f(n) with a new valid expression', async ({ page }) => {
      // Replace f(n) and click parse
      const fnArea = page.locator('#fn-raw');
      await fnArea.fill('2*n*n + 1');
      await page.click('#btn-parse-fn');

      // Expect success message and console log
      await expect(page.locator('#fn-parse-msg')).toHaveText('f(n) parsed successfully.');
      const consoleMsgs = page.context()._collectedConsoleMessages.map(m => m.text);
      expect(consoleMsgs.some(t => t.includes('f(n) parsed:'))).toBeTruthy();
    });

    test('Parse g(n) with a new valid expression', async ({ page }) => {
      const gnArea = page.locator('#gn-raw');
      await gnArea.fill('n*n');
      await page.click('#btn-parse-gn');
      await expect(page.locator('#gn-parse-msg')).toHaveText('g(n) parsed successfully.');
      const consoleMsgs = page.context()._collectedConsoleMessages.map(m => m.text);
      expect(consoleMsgs.some(t => t.includes('g(n) parsed:'))).toBeTruthy();
    });
  });

  test.describe('Big-Omega check (S1 -> S2)', () => {
    test('CheckOmega should report condition satisfied for default parameters', async ({ page }) => {
      // Ensure functions are parsed (script already parsed defaults, but re-parse to be safe)
      await page.click('#btn-parse-fn');
      await page.click('#btn-parse-gn');
      // Use default c=1 and n0=10
      await page.click('#btn-check-omega');

      // Expect omega-check-result to indicate satisfaction in tested range
      await expect(page.locator('#omega-check-result')).toContainText('Condition satisfied for all n');
      // Console log should contain a hold/fail message
      const consoleMsgs = page.context()._collectedConsoleMessages.map(m => m.text);
      expect(consoleMsgs.some(t => t.includes('Big-Omega condition holds') || t.includes('Big-Omega condition fails'))).toBeTruthy();
    });

    test('CheckOmega reports failure when c is too large', async ({ page }) => {
      // Ensure default functions parsed
      await page.click('#btn-parse-fn');
      await page.click('#btn-parse-gn');

      // Set c to a very large number to force a fail
      await page.fill('#const-c', '1000');
      await page.fill('#const-n0', '1');
      await page.click('#btn-check-omega');

      // Should report a failure somewhere in the tested range
      await expect(page.locator('#omega-check-result')).toContainText('Condition fails at n =');
      // Console contains failure message
      const consoleMsgs = page.context()._collectedConsoleMessages.map(m => m.text);
      expect(consoleMsgs.some(t => t.includes('Big-Omega condition fails'))).toBeTruthy();
    });
  });

  test.describe('Evaluate functions (S1 -> S3)', () => {
    test('Evaluate at selected n shows numeric values and comparison', async ({ page }) => {
      // Ensure functions parsed
      await page.click('#btn-parse-fn');
      await page.click('#btn-parse-gn');

      // Set slider n to 5 (dispatch input event to update output)
      await page.evaluate(() => {
        const slider = document.getElementById('slider-n');
        slider.value = '5';
        slider.dispatchEvent(new Event('input', { bubbles: true }));
      });
      // Ensure displayed output updated
      await expect(page.locator('#out-n')).toHaveValue('5');

      // Ensure constant c is 1 for predictable result
      await page.fill('#const-c', '1');

      // Click Evaluate
      await page.click('#btn-eval-functions');

      // Read displayed evaluation text
      const evalText = await page.locator('#eval-result').innerText();
      // It should at least contain "At n = 5" and the computed f(n) and c*g(n)
      expect(evalText).toContain('At n = 5:');
      // Using function defined in UI defaults: f(n) initially "3*n*n + 5*n - 10"
      // But tests may have changed f earlier; compute expected from current textarea value
      const fnRaw = await page.locator('#fn-raw').inputValue();
      const gnRaw = await page.locator('#gn-raw').inputValue();
      // Evaluate expected values in the test runtime (safe because expressions are simple and under our control)
      // We'll convert ^ to ** and evaluate using Function
      const makeFn = (expr) => new Function('n', 'return ' + expr.replace(/\^/g, '**') + ';');
      const fval = makeFn(fnRaw)(5);
      const gval = makeFn(gnRaw)(5);
      const c = Number(await page.locator('#const-c').inputValue());
      // The evaluation output should contain the numeric f and numeric c*gv
      expect(evalText).toContain(`f(n) = ${fval}`);
      expect(evalText).toContain(`c·g(n) = ${c} * ${gval} = ${c * gval}`);
      // And console should have logged the evaluation line
      const consoleMsgs = page.context()._collectedConsoleMessages.map(m => m.text);
      expect(consoleMsgs.some(t => t.includes('Evaluated at n=5'))).toBeTruthy();
    });

    test('Evaluate shows error when functions not parsed', async ({ page }) => {
      // Clear g(n) and parse it to produce error state
      await page.fill('#gn-raw', '');
      await page.click('#btn-parse-gn');
      await expect(page.locator('#gn-parse-msg')).toHaveText('Input cannot be empty.');

      // Try evaluating now
      await page.click('#btn-eval-functions');
      await expect(page.locator('#eval-result')).toHaveText('Please parse valid functions f(n) and g(n) first.');
      // Console should include "Evaluation aborted: functions not parsed"
      const consoleMsgs = page.context()._collectedConsoleMessages.map(m => m.text);
      expect(consoleMsgs.some(t => t.includes('Evaluation aborted: functions not parsed'))).toBeTruthy();
    });
  });

  test.describe('Auto search (S1 -> S2 via AutoSearch)', () => {
    test('Auto-search finds or reports solutions and logs appropriately', async ({ page }) => {
      // Restore default functions and parse
      await page.fill('#fn-raw', '3*n*n + 5*n - 10');
      await page.fill('#gn-raw', 'n*n');
      await page.click('#btn-parse-fn');
      await page.click('#btn-parse-gn');

      // Trigger auto search
      await page.click('#btn-auto-search');

      // Wait for the async search to finish and result to be populated
      await expect.soft(page.locator('#auto-search-result')).not.toBeEmpty({ timeout: 2000 });

      const resultText = await page.locator('#auto-search-result').innerText();
      // Either it reports suitable pairs or no suitable pairs; check that it is non-empty and contains one of the expected messages
      expect(resultText.length).toBeGreaterThan(0);
      expect(resultText.includes('Suitable (c, n₀) pairs found:') || resultText.includes('No suitable pairs')).toBeTruthy();

      // Console log should mention auto-search start and end
      const consoleMsgs = page.context()._collectedConsoleMessages.map(m => m.text).join('\n');
      expect(consoleMsgs).toMatch(/Auto searching suitable constants|Auto-search found/);
    });
  });

  test.describe('Generate table and CSV export (S1 -> S4, S5)', () => {
    test('Generate evaluation table produces expected header and row count', async ({ page }) => {
      // Ensure functions parsed
      await page.click('#btn-parse-fn');
      await page.click('#btn-parse-gn');

      // Use defaults start=1 end=20 step=1
      await page.fill('#table-start-n', '1');
      await page.fill('#table-end-n', '20');
      await page.fill('#table-step-n', '1');
      await page.click('#btn-generate-table');

      const tableValue = await page.locator('#eval-table').inputValue();
      const lines = tableValue.split('\n').filter(l => l.trim().length > 0);
      // First line is header, then 20 rows expected
      expect(lines[0]).toContain('n\tf(n)\tc·g(n)\tf(n) ≥ c·g(n)?');
      expect(lines.length).toBeGreaterThanOrEqual(2);
      // Ensure at least 20 data lines present
      expect(lines.length).toBeGreaterThanOrEqual(21);
      // Console log should have the generation message
      const consoleMsgs = page.context()._collectedConsoleMessages.map(m => m.text);
      expect(consoleMsgs.some(t => t.includes('Generated evaluation table'))).toBeTruthy();
    });

    test('Export CSV writes header and matching rows', async ({ page }) => {
      // Ensure functions parsed
      await page.click('#btn-parse-fn');
      await page.click('#btn-parse-gn');

      // Fill plot parameters
      await page.fill('#plot-start-n', '1');
      await page.fill('#plot-end-n', '10');
      await page.fill('#plot-step-n', '1');
      await page.fill('#plot-c', '1');
      await page.click('#btn-export-csv');

      const csvVal = await page.locator('#csv-output').inputValue();
      const rows = csvVal.split('\n').filter(r => r.trim().length > 0);
      // header plus 10 rows expected
      expect(rows[0]).toBe('n,f(n),c*g(n)');
      expect(rows.length).toBe(11);
      // Console log should include exported CSV message
      const consoleMsgs = page.context()._collectedConsoleMessages.map(m => m.text);
      expect(consoleMsgs.some(t => t.includes('Exported CSV plot data'))).toBeTruthy();
    });
  });

  test.describe('Console behavior and clear action', () => {
    test('Console can be cleared and displays messages before clear', async ({ page }) => {
      // Trigger some actions that log to console
      await page.click('#btn-parse-fn');
      await page.click('#btn-parse-gn');
      await page.click('#btn-check-omega');

      const consoleBefore = await page.locator('#console').innerText();
      expect(consoleBefore.length).toBeGreaterThan(0);

      // Clear console
      await page.click('#btn-clear-console');

      const consoleAfter = await page.locator('#console').innerText();
      expect(consoleAfter).toBe('');
      // The collected console messages remain in the context (they are not cleared)
      const collected = page.context()._collectedConsoleMessages || [];
      expect(collected.length).toBeGreaterThan(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Parsing invalid syntax yields parse error message and console log', async ({ page }) => {
      // Provide an expression that will cause a SyntaxError when creating the Function
      await page.fill('#fn-raw', '3**');
      await page.click('#btn-parse-fn');

      // The UI should show an error parse message
      await expect(page.locator('#fn-parse-msg')).toContainText('Error parsing f(n):');

      // Console should have recorded a parse error
      const consoleMsgs = page.context()._collectedConsoleMessages.map(m => m.text);
      expect(consoleMsgs.some(t => t.includes('f(n) parse error'))).toBeTruthy();
    });

    test('Generate table with invalid range reports an error and logs', async ({ page }) => {
      // Ensure parse
      await page.click('#btn-parse-fn');
      await page.click('#btn-parse-gn');

      // Set invalid end < start
      await page.fill('#table-start-n', '10');
      await page.fill('#table-end-n', '5');
      await page.fill('#table-step-n', '1');
      await page.click('#btn-generate-table');

      const evalTable = await page.locator('#eval-table').inputValue();
      expect(evalTable).toContain('End n must be integer ≥ start n.');
      const consoleMsgs = page.context()._collectedConsoleMessages.map(m => m.text);
      expect(consoleMsgs.some(t => t.includes('Generate table aborted: invalid end n'))).toBeTruthy();
    });

    test('Export CSV with invalid c is rejected and logs', async ({ page }) => {
      // Ensure parse
      await page.click('#btn-parse-fn');
      await page.click('#btn-parse-gn');

      // Negative c should be invalid
      await page.fill('#plot-c', '-1');
      await page.click('#btn-export-csv');

      const csvOut = await page.locator('#csv-output').inputValue();
      expect(csvOut).toContain('Constant c must be positive.');
      const consoleMsgs = page.context()._collectedConsoleMessages.map(m => m.text);
      expect(consoleMsgs.some(t => t.includes('CSV export aborted: invalid c'))).toBeTruthy();
    });
  });
});