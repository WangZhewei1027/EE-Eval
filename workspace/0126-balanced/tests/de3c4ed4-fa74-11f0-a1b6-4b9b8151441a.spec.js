import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c4ed4-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Backtracking - Sudoku Solver (Application ID: de3c4ed4-fa74-11f0-a1b6-4b9b8151441a)', () => {
  // Arrays to capture runtime diagnostics from the page.
  let pageErrors;
  let consoleMessages;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    pageErrors = [];
    consoleMessages = [];
    dialogMessages = [];

    // Collect pageerror events (uncaught exceptions, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      try {
        // err can be an Error object; store its message for assertions
        pageErrors.push(err && err.message ? err.message : String(err));
      } catch (e) {
        pageErrors.push(String(err));
      }
    });

    // Collect console messages for additional clues (e.g., "Uncaught SyntaxError")
    page.on('console', (msg) => {
      consoleMessages.push(msg.text());
    });

    // Capture dialogs (alerts) if any code managed to run and trigger them
    page.on('dialog', async (dialog) => {
      try {
        dialogMessages.push(dialog.message());
        await dialog.dismiss();
      } catch (e) {
        // ignore dismissal errors
      }
    });

    // Navigate to the application page and allow it to attempt to load.
    // We wait for full load to ensure any parsing/execution errors surface.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Small pause to let any asynchronous console/page errors report
    await page.waitForTimeout(300);
  });

  test.afterEach(async () => {
    // No special teardown required; listeners are tied to the page and will be cleaned up by Playwright.
  });

  // Test the initial Idle state: presence of static UI elements as rendered by the HTML.
  test('S0_Idle: initial UI elements are present (buttons and an empty board)', async ({ page }) => {
    // The HTML contains buttons even if the inline script fails. Verify their presence and text.
    const solveBtn = page.locator('#solveBtn');
    const clearBtn = page.locator('#clearBtn');
    const exampleBtn = page.locator('#exampleBtn');
    const board = page.locator('#board');

    await expect(solveBtn).toBeVisible();
    await expect(clearBtn).toBeVisible();
    await expect(exampleBtn).toBeVisible();
    await expect(board).toBeVisible();

    // Verify button text matches expected labels from the FSM evidence.
    await expect(solveBtn).toHaveText('Solve Sudoku');
    await expect(clearBtn).toHaveText('Clear Board');
    await expect(exampleBtn).toHaveText('Load Example');

    // The script that creates the 81 input cells likely didn't run due to the truncated script.
    // Assert that there are no .cell elements created by the script (board should be empty as in static HTML).
    const cellCount = await page.locator('.cell').count();
    expect(cellCount).toBe(0);

    // Also assert that no inputs exist (input.event handlers wouldn't be attached either).
    const inputCount = await page.locator('.cell input').count();
    expect(inputCount).toBe(0);
  });

  // Validate that a script SyntaxError or similar page error occurs during page load.
  test('Page error detection: expect a SyntaxError or parsing error due to truncated inline script', async ({ page }) => {
    // There should be at least one page error captured (SyntaxError or Unexpected end of input).
    expect(pageErrors.length).toBeGreaterThan(0);

    // Assert that at least one of the captured page errors mentions SyntaxError or Unexpected end/token.
    const matched = pageErrors.some(msg => /SyntaxError|Unexpected end|Unexpected token|Unterminated string constant|Unexpected identifier/i.test(msg));
    expect(matched).toBeTruthy();

    // Console messages often include the same error; assert we captured related console output as well.
    const consoleMatched = consoleMessages.some(msg => /SyntaxError|Unexpected end|Unexpected token|Uncaught/i.test(msg));
    expect(consoleMatched || consoleMessages.length > 0).toBeTruthy();
  });

  // Attempt the SolveSudoku transition: click the Solve button and observe behavior.
  test('S0 -> S1 SolveSudoku: clicking Solve should not complete solve (script likely failed), observe no dialog and errors present', async ({ page }) => {
    // Click the Solve button
    await page.click('#solveBtn');

    // Wait briefly to allow any event handlers (if present) to run.
    await page.waitForTimeout(300);

    // Because the script is truncated, the solve click handler is unlikely attached.
    // Assert that no alert dialog with "No solution exists for this Sudoku!" was shown.
    const expectedAlertShown = dialogMessages.some(msg => /No solution exists for this Sudoku!/i.test(msg));
    expect(expectedAlertShown).toBeFalsy();

    // Confirm that page errors were captured (the page should have reported a SyntaxError from earlier).
    expect(pageErrors.length).toBeGreaterThan(0);

    // Since solve didn't run, the board remains unpopulated.
    const cellCount1 = await page.locator('.cell').count();
    expect(cellCount).toBe(0);
  });

  // Attempt the ClearBoard transition: clicking Clear should clear inputs if they existed; in this broken run, none exist.
  test('S0 -> S2 ClearBoard: clicking Clear should leave board unchanged when script failed to initialize inputs', async ({ page }) => {
    // Click the Clear button
    await page.click('#clearBtn');

    // Wait for potential handlers (if any) to run
    await page.waitForTimeout(200);

    // There are no inputs to clear; confirm cell/input counts remain zero.
    const cellCount2 = await page.locator('.cell').count();
    const inputCount1 = await page.locator('.cell input').count();
    expect(cellCount).toBe(0);
    expect(inputCount).toBe(0);

    // Confirm that the page still reported errors during load
    expect(pageErrors.length).toBeGreaterThan(0);
  });

  // Attempt the LoadExample transition: clicking Example should populate the board if script ran, but here it should not.
  test('S0 -> S3 LoadExample: clicking Load Example does not populate the board due to script error', async ({ page }) => {
    // Click the Example button
    await page.click('#exampleBtn');

    // Allow time for any (nonexistent) handler to attempt running
    await page.waitForTimeout(300);

    // Because the example loader lives inside the truncated script, no cells should be added.
    const cellCount3 = await page.locator('.cell').count();
    expect(cellCount).toBe(0);

    // Additionally, no input elements should exist and therefore no example values are present.
    const inputs = page.locator('.cell input');
    expect(await inputs.count()).toBe(0);

    // Ensure we still observed page errors
    expect(pageErrors.length).toBeGreaterThan(0);
  });

  // Edge case: Try to manually type into a cell input if any existed; verify input validation does not happen (no inputs in this broken page).
  test('InputValidation: validate that input event handler is not present because inputs were not created', async ({ page }) => {
    // Sanity check: there should be no .cell input elements
    const inputsLocator = page.locator('.cell input');
    const inputsCount = await inputsLocator.count();
    expect(inputsCount).toBe(0);

    // If an input unexpectedly exists, test that invalid characters are rejected by the page's logic.
    // (This is a defensive check; in the broken scenario it will be skipped.)
    if (inputsCount > 0) {
      const firstInput = inputsLocator.first();
      await firstInput.fill('a'); // attempt to input invalid character
      // wait for potential input handler to sanitize the value
      await page.waitForTimeout(100);
      const value = await firstInput.inputValue();
      // Validation rule in FSM/script allows only 1-9, so 'a' should be removed to empty string
      expect(value).toBe('');
    }

    // As always, ensure page errors were recorded.
    expect(pageErrors.length).toBeGreaterThan(0);
  });

  // Verify that the application exposes the static explanation block and its content (non-script dependent).
  test('UI content: explanation text is present and readable even if script fails', async ({ page }) => {
    const explanation = page.locator('.explanation');
    await expect(explanation).toBeVisible();
    await expect(explanation).toContainText('How Backtracking Works:');
    await expect(explanation).toContainText('Find an empty cell in the Sudoku grid');
  });
});