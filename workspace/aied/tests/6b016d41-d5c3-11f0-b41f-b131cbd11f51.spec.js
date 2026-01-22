import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b016d41-d5c3-11f0-b41f-b131cbd11f51.html';

test.describe('Longest Common Subsequence Visualizer (FSM: 6b016d41-d5c3-11f0-b41f-b131cbd11f51)', () => {
  // Shared arrays to collect runtime diagnostics per test
  let consoleMessages;
  let pageErrors;

  // Set up listeners and navigate to the app before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page and wait for core elements to be present
    await page.goto(APP_URL);
    await page.waitForSelector('#lcs-result');
    await page.waitForSelector('#matrix-container');
  });

  test.afterEach(async () => {
    // No teardown necessary beyond Playwright fixtures — this placeholder keeps symmetry.
  });

  // ---------------------------
  // Test: Initial load and default calculation
  // Validates: startup (S0_Idle -> S1_Calculating -> S2_ResultDisplayed)
  // ---------------------------
  test('Initial load computes LCS for default inputs and displays result without runtime errors', async ({ page }) => {
    // The implementation calls calculateLCS() on DOMContentLoaded, so result should be displayed immediately.
    const lcsResult = page.locator('#lcs-result');

    // Verify the UI displays the computed LCS info
    await expect(lcsResult).toContainText('String 1:', { timeout: 2000 });
    await expect(lcsResult).toContainText('String 2:');
    await expect(lcsResult).toContainText('LCS Length:');

    // For the provided defaults ("ABCDGH" and "AEDFHR"), the LCS should be "ADH" length 3.
    await expect(lcsResult).toContainText('LCS Length:');
    await expect(lcsResult).toContainText('3'); // length 3
    await expect(lcsResult).toContainText('ADH');

    // Matrix visualization should be present and contain a table
    const table = page.locator('#matrix-container table.matrix-grid');
    await expect(table).toBeVisible();

    // Assert there were no uncaught page errors
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Assert there are no console.error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors found: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // ---------------------------
  // Test: Manual Calculate LCS (S0_Idle -> S1_Calculating -> S2_ResultDisplayed)
  // Validates: calculateBtn triggers recalculation, DOM updates and matrix refresh
  // ---------------------------
  test('Clicking Calculate LCS recalculates and displays correct LCS for custom inputs', async ({ page }) => {
    // Provide a custom example: "ABCD" and "ACDF" -> expected LCS is "ACD" length 3
    const s1 = page.locator('#string1');
    const s2 = page.locator('#string2');

    await s1.fill('ABCD');
    await s2.fill('ACDF');

    // Capture current matrix content for change detection
    const matrixContainer = page.locator('#matrix-container');
    const beforeHTML = await matrixContainer.innerHTML();

    // Click the calculate button to trigger S1_Calculating entry action (calculateLCS)
    await page.click('#calculate-btn');

    // Wait for matrix container to update (S2_ResultDisplayed)
    await expect(matrixContainer).toHaveJSProperty('innerHTML'); // simple checkpoint
    await page.waitForFunction(
      (selector, prev) => document.querySelector(selector).innerHTML !== prev,
      '#matrix-container',
      beforeHTML
    );

    // Validate displayed result contains expected sequence and length
    const lcsResult = page.locator('#lcs-result');
    await expect(lcsResult).toContainText('String 1:');
    await expect(lcsResult).toContainText('ABCD');
    await expect(lcsResult).toContainText('String 2:');
    await expect(lcsResult).toContainText('ACDF');
    await expect(lcsResult).toContainText('LCS Length:');
    await expect(lcsResult).toContainText('3');
    await expect(lcsResult).toContainText('ACD');

    // Ensure no runtime page errors or console.error were produced during the interaction
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors found: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // ---------------------------
  // Test: Random Example (S0_Idle -> S2_ResultDisplayed)
  // Validates: clicking Random Example loads one of the known pairs and updates result
  // ---------------------------
  test('Random Example loads one of the predefined examples and displays corresponding result', async ({ page }) => {
    // Known examples from the app implementation
    const validPairs = [
      { str1: 'ABCDGH', str2: 'AEDFHR' },
      { str1: 'AGGTAB', str2: 'GXTXAYB' },
      { str1: 'XMJYAUZ', str2: 'MZJAWXU' },
      { str1: 'ABCD', str2: 'ACDF' },
      { str1: 'INTENTION', str2: 'EXECUTION' }
    ];

    // Click random button
    await page.click('#random-btn');

    // Read input values after the click
    const s1Val = await page.locator('#string1').inputValue();
    const s2Val = await page.locator('#string2').inputValue();

    // The pair must match one of the predefined examples
    const matched = validPairs.some(p => p.str1 === s1Val && p.str2 === s2Val);
    expect(matched, `Random pair (${s1Val}, ${s2Val}) did not match any known example`).toBeTruthy();

    // The result display should reflect the inputs
    const lcsResult = page.locator('#lcs-result');
    await expect(lcsResult).toContainText(s1Val);
    await expect(lcsResult).toContainText(s2Val);
    await expect(lcsResult).toContainText('LCS Length:');

    // No uncaught runtime errors
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors found: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // ---------------------------
  // Test: Reset (S0_Idle -> S2_ResultDisplayed via reset)
  // Validates: clicking Reset restores default inputs and displays default result
  // ---------------------------
  test('Reset button restores default example and displays its computed LCS', async ({ page }) => {
    // Change inputs to some other values first
    await page.fill('#string1', 'XXXXX');
    await page.fill('#string2', 'YYYYY');
    // Click reset
    await page.click('#reset-btn');

    // Inputs should be back to defaults
    await expect(page.locator('#string1')).toHaveValue('ABCDGH');
    await expect(page.locator('#string2')).toHaveValue('AEDFHR');

    // Result should reflect default LCS ("ADH" length 3)
    const lcsResult = page.locator('#lcs-result');
    await expect(lcsResult).toContainText('ABCDGH');
    await expect(lcsResult).toContainText('AEDFHR');
    await expect(lcsResult).toContainText('LCS Length:');
    await expect(lcsResult).toContainText('3');
    await expect(lcsResult).toContainText('ADH');

    // No runtime page errors or console.error messages
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors found: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // ---------------------------
  // Test: Edge case - empty strings should display error and not render matrix
  // Validates: error handling branch and S0_Idle-like behavior for invalid input
  // ---------------------------
  test('Empty input strings produce a user-visible error and do not render a matrix', async ({ page }) => {
    // Clear both inputs
    await page.fill('#string1', '');
    await page.fill('#string2', '');

    // Click calculate
    await page.click('#calculate-btn');

    // Expect visible error message
    const errorLocator = page.locator('#error-message');
    await expect(errorLocator).toContainText('Please enter both strings.');

    // Matrix container should be empty (no table created)
    const matrixContainer = page.locator('#matrix-container');
    const inner = await matrixContainer.innerHTML();
    expect(inner.trim().length, 'Matrix container should be empty when inputs are invalid').toBe(0);

    // lcs-result should remain empty (implementation clears lcsResult before calculation and returns early)
    const lcsResultText = await page.locator('#lcs-result').innerText();
    // It may be empty string if cleared, or remain with previous content depending on execution order;
    // Just ensure that when inputs invalid, no LCS details are shown (no "LCS Length" term).
    expect(lcsResultText.includes('LCS Length'), 'LCS details should not be displayed for invalid input').toBe(false);

    // No uncaught runtime errors from this branch
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors found: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  // ---------------------------
  // Test: Matrix visualization structure and LCS path highlights
  // Validates: matrix dimensions and that LCS path cells are highlighted
  // ---------------------------
  test('Matrix visualization has expected dimensions and highlights the LCS path cells', async ({ page }) => {
    // Defaults are used on load: str1 length = 6, str2 length = 6
    const str1 = await page.locator('#string1').inputValue();
    const str2 = await page.locator('#string2').inputValue();

    const m = str1.length;
    const n = str2.length;

    const table = page.locator('#matrix-container table.matrix-grid');
    await expect(table).toBeVisible();

    // Rows: header row + (m+1) rows => total rows = m + 2
    const rowCount = await table.locator('tr').count();
    expect(rowCount).toBe(m + 2);

    // Header columns: 2 (empty top-left and index 0) + n (string2 chars) => 2 + n
    const headerCols = await table.locator('tr').first().locator('td').count();
    expect(headerCols).toBe(2 + n);

    // Validate that the number of matrix value columns per regular row is (n+2?):
    // Each data row creates: 1 (row label) + 1 (row index) + (n+1) matrix value cells => total 2 + (n+1)
    const dataRowCols = await table.locator('tr').nth(1).locator('td').count();
    expect(dataRowCols).toBe(2 + (n + 1));

    // LCS path cells should be highlighted with class 'lcs-path'
    const highlighted = await table.locator('td.lcs-path').count();

    // For the default example, LCS length should be 3 -> expect 3 highlighted diagonal matches
    const expectedLcsLengthText = await page.locator('#lcs-result').innerText();
    // Extract the LCS length from the displayed text as a heuristic
    const matchLength = expectedLcsLengthText.match(/LCS Length:\s*([0-9]+)/);
    const expectedLength = matchLength ? parseInt(matchLength[1], 10) : null;

    // Ensure highlighted count matches the expected LCS length if available
    if (expectedLength !== null) {
      expect(highlighted, 'Number of highlighted path cells should match the LCS length').toBe(expectedLength);
    } else {
      // At minimum, there should be at least one highlighted cell for non-trivial examples
      expect(highlighted).toBeGreaterThanOrEqual(1);
    }

    // No uncaught runtime errors or console errors
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors found: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });
});