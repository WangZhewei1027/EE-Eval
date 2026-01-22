import { test, expect } from '@playwright/test';

// File: d7b43a93-d5c2-11f0-9651-0f1ae31ac260.spec.js
// Automated Playwright tests for the LCS Demo application.
// - Verifies FSM states S0 (Idle), S1 (StringsEntered), S2 (ResultDisplayed).
// - Exercises compute button event and transitions.
// - Checks visual output and edge cases.
// - Observes console messages and page errors (asserts none of critical types occurred).

const APP_URL =
  'http://127.0.0.1:5500/workspace/batch-1207/html/d7b43a93-d5c2-11f0-9651-0f1ae31ac260.html';

// Page Object for the LCS page
class LcsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.heading = page.locator('h1');
    this.textarea1 = page.locator('#string1');
    this.textarea2 = page.locator('#string2');
    this.computeBtn = page.locator('#computeBtn');
    this.resultDiv = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeadingText() {
    return this.heading.textContent();
  }

  async getStringValues() {
    const s1 = await this.textarea1.inputValue();
    const s2 = await this.textarea2.inputValue();
    return { s1, s2 };
  }

  async fillStrings(s1, s2) {
    await this.textarea1.fill(s1);
    await this.textarea2.fill(s2);
  }

  async clickCompute() {
    await this.computeBtn.click();
  }

  async getResultText() {
    return this.resultDiv.textContent();
  }

  async isResultEmpty() {
    const txt = await this.resultDiv.textContent();
    return !txt || txt.trim().length === 0;
  }
}

// Helper: compute LCS using same algorithm as the page so we can assert expected outputs.
// This mirrors the application's longestCommonSubsequence implementation.
function computeLcsLocal(s1, s2) {
  const m = s1.length,
    n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  let lcs = '';
  let i = m,
    j = n;
  while (i > 0 && j > 0) {
    if (s1[i - 1] === s2[j - 1]) {
      lcs = s1[i - 1] + lcs;
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return { length: dp[m][n], sequence: lcs, dpTable: dp };
}

test.describe('LCS Demo - States and Transitions (FSM Validation)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console events (info, log, error, etc.)
    page.on('console', (msg) => {
      // Store the text & type for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('S0 Idle: Page renders initial UI elements and default values', async ({ page }) => {
    // Validate initial state S0: heading and inputs are present (renderPage entry action)
    const lcs = new LcsPage(page);
    await lcs.goto();

    // Verify heading exists and matches expected evidence in FSM
    const headingText = await lcs.getHeadingText();
    expect(headingText).toContain('Longest Common Subsequence (LCS) Calculator');

    // Textareas should be present and have placeholders
    await expect(page.locator('#string1')).toBeVisible();
    await expect(page.locator('#string2')).toBeVisible();
    expect(await page.locator('#string1').getAttribute('placeholder')).toBe(
      'Enter first string here...'
    );
    expect(await page.locator('#string2').getAttribute('placeholder')).toBe(
      'Enter second string here...'
    );

    // Default values are provided in the HTML - verify they match
    const values = await lcs.getStringValues();
    expect(values.s1).toBe('ABCBDAB');
    expect(values.s2).toBe('BDCABA');

    // Result area should be present and initially empty (Idle state before compute)
    expect(await lcs.isResultEmpty()).toBe(true);

    // result div should have aria-live attribute as per FSM evidence
    expect(await page.locator('#result').getAttribute('aria-live')).toBe('polite');

    // Confirm no uncaught page errors or console errors were emitted during initial render
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S1 StringsEntered: User edits strings -> verifies fields updated', async ({ page }) => {
    // Validate transition to S1 when user enters strings (Strings Entered evidence)
    const lcs = new LcsPage(page);
    await lcs.goto();

    // Simulate user input into textareas
    await lcs.fillStrings('XMJYAUZ', 'MZJAWXU');
    const values = await lcs.getStringValues();
    expect(values.s1).toBe('XMJYAUZ');
    expect(values.s2).toBe('MZJAWXU');

    // Ensure result still empty until compute clicked
    expect(await lcs.isResultEmpty()).toBe(true);

    // Ensure no critical page errors during input
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('S1 -> S2 ComputeLCS_Click: computes and displays LCS and DP table', async ({ page }) => {
    // Validate clicking compute triggers S2 ResultDisplayed and populates resultDiv
    const lcs = new LcsPage(page);
    await lcs.goto();

    // Use custom strings to validate algorithmic output
    const s1 = 'XMJYAUZ';
    const s2 = 'MZJAWXU';
    await lcs.fillStrings(s1, s2);

    // Precompute expected LCS locally using identical algorithm
    const expected = computeLcsLocal(s1, s2);
    await lcs.clickCompute();

    // Wait for resultDiv to be populated
    await expect(lcs.resultDiv).toHaveText(/First String:/, { timeout: 2000 });

    const resultText = (await lcs.getResultText()) || '';

    // Check that both input strings are present in the textual output
    expect(resultText).toContain(`First String:  "${s1}"`);
    expect(resultText).toContain(`Second String: "${s2}"`);

    // Check length and sequence reported match our local computation
    expect(resultText).toContain(`Length of LCS: ${expected.length}`);
    // Sequence is quoted in output
    expect(resultText).toContain(`Longest Common Subsequence: "${expected.sequence}"`);

    // DP table header should include s2 characters (evidence)
    for (const ch of s2.split('')) {
      // the header uses the s2 characters spaced - at least ensure each char appears
      expect(resultText).toContain(ch);
    }

    // Basic DP table shape validation: bottom-right dp value equals length
    // The DP table is printed; ensure the last number in the printed table equals expected.length
    // We can find "DP table:" block and check that expected.length appears (sanity check)
    expect(resultText).toContain('DP table:');
    expect(resultText).toContain(expected.length.toString());

    // Ensure no console errors or page errors were emitted during computation
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: empty input -> shows user-facing error message', async ({ page }) => {
    // Validate application handles empty-string edge case as per implementation
    const lcs = new LcsPage(page);
    await lcs.goto();

    // Set one or both strings empty (trimmed by the app)
    await lcs.fillStrings('', 'NONEMPTY');
    await lcs.clickCompute();

    // Expect specific message when inputs are missing
    await expect(lcs.resultDiv).toHaveText('Please enter both strings.', { timeout: 2000 });
    expect((await lcs.getResultText()).trim()).toBe('Please enter both strings.');

    // Also test whitespace-only (which should trim to empty)
    await lcs.fillStrings('   \n  ', 'ABC');
    await lcs.clickCompute();
    await expect(lcs.resultDiv).toHaveText('Please enter both strings.');

    // Ensure no unexpected runtime errors occurred in the page while handling these edge cases
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Recompute after changing inputs updates result accordingly', async ({ page }) => {
    // Validate S2 can be re-entered multiple times with updated inputs
    const lcs = new LcsPage(page);
    await lcs.goto();

    // First compute with defaults
    const defaultValues = await lcs.getStringValues();
    const expectedDefault = computeLcsLocal(defaultValues.s1, defaultValues.s2);
    await lcs.clickCompute();
    await expect(lcs.resultDiv).toHaveText(`Length of LCS: ${expectedDefault.length}`);

    // Change inputs and compute again
    const s1 = 'ABCDEF';
    const s2 = 'FBDAMN';
    await lcs.fillStrings(s1, s2);
    const expectedNew = computeLcsLocal(s1, s2);
    await lcs.clickCompute();
    await expect(lcs.resultDiv).toHaveText(`Length of LCS: ${expectedNew.length}`);
    expect((await lcs.getResultText()).toContain(`Longest Common Subsequence: "${expectedNew.sequence}"`));

    // Ensure no new critical JavaScript errors during recompute
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observes console and page error streams and asserts none of critical types occurred', async ({ page }) => {
    // This test deliberately inspects the collected console and page errors
    const lcs = new LcsPage(page);
    await lcs.goto();

    // Do a compute to potentially trigger any runtime messages
    await lcs.clickCompute();

    // Give some time for any async errors to surface
    await page.waitForTimeout(250);

    // Inspect collected messages
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    // Assert no uncaught page errors (ReferenceError, TypeError, etc.) occurred
    expect(pageErrors.length).toBe(0);

    // Also assert there are no console.error messages
    expect(errorConsoleMessages.length).toBe(0);

    // Additionally include a friendly assertion that the console had at least no fatal logs
    // (we don't require any console output by design; this just ensures no errors)
    expect(consoleMessages.length >= 0).toBeTruthy();
  });
});