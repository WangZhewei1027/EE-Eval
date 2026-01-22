import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/d79db211-d361-11f0-8438-11a56595a476.html';

/**
 * Page object for the LCS demo page.
 * Encapsulates common interactions and queries against the DOM.
 */
class LCSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.string1 = page.locator('#string1');
    this.string2 = page.locator('#string2');
    this.findButton = page.locator('button[onclick="computeLCS()"]');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getOutputHTML() {
    return await this.output.innerHTML();
  }

  async getOutputText() {
    return await this.output.textContent();
  }

  async fillStrings(s1, s2) {
    await this.string1.fill(s1);
    await this.string2.fill(s2);
  }

  async clickFind() {
    await Promise.all([
      this.page.waitForResponse(response => response.status() === 200 || response.status() === 0).catch(() => {}), // non-blocking, safe
      this.findButton.click()
    ]);
  }

  async countHighlights() {
    return await this.page.locator('#output .highlight').count();
  }

  async countDPHighlights() {
    return await this.page.locator('#output td.lcs-cell').count();
  }

  async hasTable() {
    return await this.page.locator('#output table').count() > 0;
  }
}

test.describe('LCS Demo - states, transitions, and edge cases', () => {
  // Containers for console and page errors captured during each test run
  let consoleErrors;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors for each test
    consoleErrors = [];
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors BEFORE navigating so we catch onload-time issues
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', err => {
      // pageerror receives an Error object
      pageErrors.push(err && err.message ? err.message : String(err));
    });
  });

  test.afterEach(async () => {
    // nothing special to teardown beyond Playwright's fixtures
  });

  test('Initial load runs computeLCS automatically (S0_Idle -> S1_ResultsDisplayed via window.onload)', async ({ page }) => {
    /**
     * This test validates:
     * - The page automatically computes LCS on load (window.onload = computeLCS)
     * - Output contains the Results header and the expected LCS for the default inputs
     * - Highlighted characters for the LCS are present in the DOM
     * - DP table is rendered
     * - No console errors or page errors occurred during load
     */
    const lcsPage = new LCSPage(page);

    // Navigate to the page (listeners already attached in beforeEach)
    await lcsPage.goto();

    // The page's onload should have triggered computeLCS and populated #output
    await expect(lcsPage.output).toBeVisible();

    // Verify the results header and that the known LCS for the default inputs is present.
    // For AGGTAB and GXTXAYB the LCS is "GTAB" with length 4.
    const outputText = await lcsPage.getOutputText();
    expect(outputText).toContain('Results');
    expect(outputText).toContain('Longest Common Subsequence:');
    expect(outputText).toContain('GTAB'); // expected LCS sequence
    expect(outputText).toContain('Length of LCS:');
    expect(outputText).toContain('4'); // expected length

    // Verify that highlighted characters are injected into the output for both strings.
    // Expect 4 highlighted characters in each string => total 8 highlight spans.
    const highlightCount = await lcsPage.countHighlights();
    expect(highlightCount).toBe(8);

    // Verify the DP table is present and at least one dp-cell is marked as lcs-cell
    const hasTable = await lcsPage.hasTable();
    expect(hasTable).toBe(true);
    const dpHighlightCount = await lcsPage.countDPHighlights();
    expect(dpHighlightCount).toBeGreaterThan(0);

    // Assert no console errors or page errors occurred during load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking Find LCS recomputes results for modified inputs (ComputeLCS event)', async ({ page }) => {
    /**
     * This test validates:
     * - The ComputeLCS event (button click) triggers recomputation
     * - Output updates to reflect the new LCS and length
     * - No console or page errors are emitted during the user-triggered computation
     */
    const lcsPage = new LCSPage(page);
    await lcsPage.goto();

    // Change inputs to a simple deterministic example: 'ABC' and 'AC' -> LCS 'AC' (length 2)
    await lcsPage.fillStrings('ABC', 'AC');

    // Click the "Find LCS" button to force recomputation (transition action computeLCS())
    await lcsPage.findButton.click();

    // Wait for output to update - check that expected LCS and length appear
    await expect(lcsPage.output).toContainText('Longest Common Subsequence:');
    await expect(lcsPage.output).toContainText('AC');
    await expect(lcsPage.output).toContainText('Length of LCS:');
    await expect(lcsPage.output).toContainText('2');

    // Expect highlights for the LCS characters present: 'A' and 'C' in both strings.
    const highlightCount = await lcsPage.countHighlights();
    // Two highlights per string -> total 4
    expect(highlightCount).toBeGreaterThanOrEqual(2); // minimal sanity
    expect(highlightCount).toBeGreaterThanOrEqual(2);
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Empty input scenario shows friendly error message (edge case)', async ({ page }) => {
    /**
     * This test validates:
     * - The application handles empty inputs gracefully (edge case)
     * - The output contains the specific message: "Please enter both strings."
     * - No runtime console/page errors occur when handling this case
     */
    const lcsPage = new LCSPage(page);
    await lcsPage.goto();

    // Clear both inputs to simulate missing user input
    await lcsPage.fillStrings('', '');

    // Click the button to attempt computation
    await lcsPage.findButton.click();

    // The output should contain the friendly message and not attempt to render a DP table
    await expect(lcsPage.output).toContainText('Please enter both strings.');

    // For empty input, the DP table should not be rendered (the page replaces output with the message)
    const hasTableAfterEmpty = await lcsPage.hasTable();
    expect(hasTableAfterEmpty).toBe(false);

    // No runtime errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('No common subsequence results in "(No common subsequence)" and length 0', async ({ page }) => {
    /**
     * This test validates:
     * - When two strings share no common characters, the UI displays the special text
     * - The length reported is 0
     * - Highlights and lcs-cell entries are absent in the DP table for this case
     */
    const lcsPage = new LCSPage(page);
    await lcsPage.goto();

    // Use strings with no shared characters
    await lcsPage.fillStrings('ABC', 'DEF');

    // Trigger computation
    await lcsPage.findButton.click();

    // Verify message for no common subsequence and length 0
    await expect(lcsPage.output).toContainText('(No common subsequence)');
    await expect(lcsPage.output).toContainText('Length of LCS:');
    await expect(lcsPage.output).toContainText('0');

    // There should be ZERO highlight spans for the LCS because there's no LCS
    const highlightCount = await lcsPage.countHighlights();
    expect(highlightCount).toBe(0);

    // There should be ZERO dp cells with lcs-cell class since no matches occurred
    const dpHighlightCount = await lcsPage.countDPHighlights();
    // It is acceptable for dpHighlightCount to be 0 in this scenario
    expect(dpHighlightCount).toBe(0);

    // No runtime errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Verify DOM updates and classes for DP table and highlights (visual feedback)', async ({ page }) => {
    /**
     * This test checks:
     * - The DP table rows/columns are present and number roughly matches lengths of inputs
     * - lcs-cell class appears for matched dp cells in the example
     * - highlight spans are present within the string display paragraphs
     */
    const lcsPage = new LCSPage(page);
    await lcsPage.goto();

    // Use the default page state (AGGTAB / GXTXAYB)
    // Verify table exists
    const tableLocator = page.locator('#output table');
    await expect(tableLocator).toBeVisible();

    // Verify approximate table dimensions: rows should be m+1 where m is length of first string
    const s1Value = await page.locator('#string1').inputValue();
    const s2Value = await page.locator('#string2').inputValue();
    const m = s1Value.length;
    const n = s2Value.length;

    // Count table rows (tbody tr)
    const rowCount = await page.locator('#output table tbody tr').count();
    expect(rowCount).toBe(m + 1);

    // Count header columns for the DP entries (number of td in a row should be n+1)
    // Inspect the first data row (i = 0)
    const firstRowCellCount = await page.locator('#output table tbody tr').first().locator('td').count();
    expect(firstRowCellCount).toBe(n + 1);

    // There should be at least one lcs-cell for the known example
    const dpHighlightCount = await lcsPage.countDPHighlights();
    expect(dpHighlightCount).toBeGreaterThan(0);

    // Highlights in the textual string display should be present
    const highlightCount = await lcsPage.countHighlights();
    expect(highlightCount).toBeGreaterThan(0);

    // No runtime errors expected
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});