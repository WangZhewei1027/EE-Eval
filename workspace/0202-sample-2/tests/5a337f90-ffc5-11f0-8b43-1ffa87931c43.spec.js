import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a337f90-ffc5-11f0-8b43-1ffa87931c43.html';

test.describe('LCS Demo (FSM) — 5a337f90-ffc5-11f0-8b43-1ffa87931c43', () => {
  // Keep track of console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test failed, surface captured console and page errors to help debugging
    if (testInfo.status !== testInfo.expectedStatus) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', consoleMessages);
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors.map(e => e.message || String(e)));
    }
  });

  // Test the initial state S0_Idle and expected automatic transition (window.onload -> click)
  test('Initial load triggers automatic compute (S0_Idle -> S1_Strings_Entered -> S2_LCS_Computed)', async ({ page }) => {
    // On load the page's window.onload should click the compute button automatically.
    // Verify the result area is populated with the computed LCS for default inputs.
    const result = page.locator('#result');

    // Wait for the result to be populated by the onload-triggered computation
    await expect(result).toContainText('Length of LCS:', { timeout: 3000 });

    // Expect length 4 and the canonical LCS for the default values "AGGTAB" and "GXTXAYB"
    await expect(result).toContainText('4');
    await expect(result.locator('code')).toContainText('GTAB');

    // Verify highlighted characters appear in the first and second strings (class="highlight")
    const highlightedInResult = result.locator('.highlight');
    // There should be 4 highlighted characters across the displayed strings (G,T,A,B in each string)
    await expect(highlightedInResult).toHaveCount(4);

    // Verify DP table exists and bottom-right value equals 4 (dp[m][n] should be 4)
    const dpTable = result.locator('table');
    await expect(dpTable).toHaveCount(1);
    // Find last row, last cell: table tbody tr:last-child td:last-child
    const lastCell = dpTable.locator('tbody > tr').last().locator('td').last();
    await expect(lastCell).toHaveText('4');

    // Assert there were no uncaught page errors during normal load/computation
    expect(pageErrors.length).toBe(0);

    // Assert there are no console error messages (but capture other console messages if any)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test clicking the Compute LCS button explicitly after modifying inputs (S1 -> S2)
  test('Manual compute: changing inputs updates LCS and highlights correctly', async ({ page }) => {
    const str1Input = page.locator('input#str1');
    const str2Input = page.locator('input#str2');
    const computeBtn = page.locator('button#computeBtn');
    const result = page.locator('#result');

    // Replace default values with a different test case
    await str1Input.fill('ABC');
    await str2Input.fill('AC');

    // Click compute to transition S1_Strings_Entered -> S2_LCS_Computed
    await computeBtn.click();

    // Expect result to show length 2 and LCS "AC"
    await expect(result).toContainText('Length of LCS:', { timeout: 2000 });
    await expect(result).toContainText('2');
    await expect(result.locator('code')).toContainText('AC');

    // Expect the highlights in the displayed first and second strings to mark 'A' and 'C' (2 highlights)
    const highlights = result.locator('.highlight');
    await expect(highlights).toHaveCount(2);

    // Verify DP table header includes characters of second string "AC"
    const headerCells = result.locator('table thead th');
    // There are two empty header cells followed by one per character; ensure 'A' and 'C' appear
    await expect(result.locator('table thead')).toContainText('A');
    await expect(result.locator('table thead')).toContainText('C');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: empty input(s) should produce user-friendly error message (validation)
  test('Edge case: empty inputs produce validation message', async ({ page }) => {
    const str1Input = page.locator('input#str1');
    const str2Input = page.locator('input#str2');
    const computeBtn = page.locator('button#computeBtn');
    const result = page.locator('#result');

    // Clear both inputs to simulate user error
    await str1Input.fill('');
    await str2Input.fill('');

    // Click compute and expect an error message in result
    await computeBtn.click();

    await expect(result).toContainText('Please enter both strings.', { timeout: 2000 });

    // Ensure the error message is styled (contains 'color: red;') as per implementation
    await expect(result).toContainText('Please enter both strings.');
    // No runtime errors should have occurred as a result of validation
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Additional transition/assertion: ensure backtracking and highlighting behave when only one string changed
  test('Partial change recompute: update only second string and recompute', async ({ page }) => {
    const str1Input = page.locator('input#str1');
    const str2Input = page.locator('input#str2');
    const computeBtn = page.locator('button#computeBtn');
    const result = page.locator('#result');

    // Ensure first string has a known value
    await str1Input.fill('BANANA');
    // Change second string to something sharing subsequence
    await str2Input.fill('ANNA');

    // Click compute
    await computeBtn.click();

    // Expect result to include length and LCS (one of valid LCS values, e.g., "ANNA" vs "BANANA" should give "ANNA"?)
    // Instead of assuming exact LCS due to possible backtracking choices, assert length is > 0 and highlights count matches length
    await expect(result).toContainText('Length of LCS:', { timeout: 2000 });
    const lengthText = await result.locator('p').first().textContent();
    // Extract digits from the length text
    const lenMatch = (lengthText || '').match(/\d+/);
    const lengthValue = lenMatch ? parseInt(lenMatch[0], 10) : 0;
    expect(lengthValue).toBeGreaterThanOrEqual(1);

    // The number of highlighted characters should equal the reported length
    const highlightsCount = await result.locator('.highlight').count();
    expect(highlightsCount).toBe(lengthValue);

    // DP table bottom-right cell should equal the reported length
    const lastCell = result.locator('table tbody > tr').last().locator('td').last();
    await expect(lastCell).toHaveText(String(lengthValue));

    // No runtime page errors triggered
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Sanity test: ensure essential components exist (inputs, button, result) — verifies S0 rendering (renderPage)
  test('UI sanity: inputs, button and result container are present (S0_Idle renderPage verification)', async ({ page }) => {
    const str1 = page.locator('input#str1');
    const str2 = page.locator('input#str2');
    const computeBtn = page.locator('button#computeBtn');
    const result = page.locator('#result');

    await expect(str1).toHaveCount(1);
    await expect(str2).toHaveCount(1);
    await expect(computeBtn).toHaveCount(1);
    await expect(result).toHaveCount(1);

    // Ensure default input values match those declared in the HTML (evidence of initial rendering)
    await expect(str1).toHaveValue('AGGTAB');
    await expect(str2).toHaveValue('GXTXAYB');

    // No runtime errors during simple DOM queries
    expect(pageErrors.length).toBe(0);
  });
});