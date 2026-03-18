import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3714df3-ffc4-11f0-821c-7d25bc609266.html';

// Page object for the LCS demo page
class LcsDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.btn = page.locator('#demoBtn');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Click the demo button and wait for the output to be populated
  async runDemo() {
    await this.btn.click();
    // Wait until demoOutput contains the length line (ensures the click handler has run and updated content)
    await expect(this.output).toHaveText(/Length of Longest Common Subsequence:/, { timeout: 2000 });
    return await this.output.textContent();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }
}

test.describe('LCS Demo App - a3714df3-ffc4-11f0-821c-7d25bc609266', () => {
  // Arrays to capture any console errors or page errors that occur while loading/interacting with the page.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({
            text: msg.text(),
            location: msg.location()
          });
        }
      } catch (e) {
        // swallow in listener
      }
    });

    // Capture uncaught errors on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Test initial Idle state: page renders the demo button and an initially-empty output area.
  test('Initial state (S0_Idle): renders Run LCS Demonstration button and empty demo output', async ({ page }) => {
    const demo = new LcsDemoPage(page);
    await demo.goto();

    // Validate button exists, visible, and has correct text and attributes
    await expect(demo.btn).toBeVisible();
    await expect(demo.btn).toHaveAttribute('id', 'demoBtn');
    await expect(demo.btn).toHaveAttribute('type', 'button');
    await expect(demo.btn).toHaveText('Run LCS Demonstration');

    // Validate output container exists and is initially empty
    await expect(demo.output).toBeVisible();
    const initialText = await demo.getOutputText();
    // It may be empty or whitespace; assert there's no substantive content before running the demo
    expect(initialText.trim()).toBe('');

    // Ensure accessibility attributes expected by the FSM are present
    await expect(demo.output).toHaveAttribute('aria-live', 'polite');
    await expect(demo.output).toHaveAttribute('aria-atomic', 'true');

    // No runtime errors should have been emitted during initial load
    expect(consoleErrors.length, `console.error messages on page load: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
    expect(pageErrors.length, `page errors on page load: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
  });

  // Test the transition from Idle to DemoRunning triggered by clicking the button.
  test('Transition RunDemo (S0_Idle -> S1_DemoRunning): clicking the button computes LCS and updates demoOutput', async ({ page }) => {
    const demo = new LcsDemoPage(page);
    await demo.goto();

    // Click the button and wait for update
    const outputText = await demo.runDemo();

    // Basic content checks: input strings are shown and length line exists
    expect(outputText).toContain('String X: ABCBDAB');
    expect(outputText).toContain('String Y: BDCABA');
    expect(outputText).toMatch(/Length of Longest Common Subsequence:\s*4/);

    // Extract the reported LCS string from the output and validate it is a subsequence of both inputs and has length 4
    const lcsMatch = outputText.match(/One Longest Common Subsequence:\s*(.*)$/m);
    expect(lcsMatch, 'Expected "One Longest Common Subsequence:" line to be present').not.toBeNull();
    const reportedLcs = (lcsMatch && lcsMatch[1]) ? lcsMatch[1].trim() : '';
    // It should be some non-empty string of length 4
    expect(reportedLcs.length).toBe(4);

    // Helper to assert subsequence relation: checks that small is a subsequence of big
    const isSubsequence = (big, small) => {
      let i = 0, j = 0;
      while (i < big.length && j < small.length) {
        if (big[i] === small[j]) j++;
        i++;
      }
      return j === small.length;
    };

    expect(isSubsequence('ABCBDAB', reportedLcs), `Reported LCS "${reportedLcs}" should be subsequence of X`).toBe(true);
    expect(isSubsequence('BDCABA', reportedLcs), `Reported LCS "${reportedLcs}" should be subsequence of Y`).toBe(true);

    // Validate the dp length reported indirectly (dp[m][n] == 4) already validated by the text line above.
    // Ensure no console/page errors happened as a result of clicking and computation.
    expect(consoleErrors.length, `console.error messages after running demo: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
    expect(pageErrors.length, `page errors after running demo: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
  });

  // Edge-case testing of the underlying functions via page.evaluate:
  // - empty strings
  // - single-character matches and mismatches
  // We call the functions that exist in the page's global scope; we do not redefine or patch anything.
  test('Edge cases for lcsLength and reconstructLCS functions (empty and single-char inputs)', async ({ page }) => {
    const demo = new LcsDemoPage(page);
    await demo.goto();

    // Test empty strings: dp should be 1x1 with 0 and reconstruct should return empty string
    const emptyResult = await page.evaluate(() => {
      const dp = lcsLength('', '');
      const lcs = reconstructLCS(dp, '', '');
      return {
        rows: dp.length,
        cols: dp[0].length,
        dp00: dp[0][0],
        lcs
      };
    });
    expect(emptyResult.rows).toBe(1);
    expect(emptyResult.cols).toBe(1);
    expect(emptyResult.dp00).toBe(0);
    expect(emptyResult.lcs).toBe('');

    // Test single-character equal strings
    const singleEqual = await page.evaluate(() => {
      const X = 'A';
      const Y = 'A';
      const dp = lcsLength(X, Y);
      const lcs = reconstructLCS(dp, X, Y);
      return {
        dp11: dp[1][1],
        lcs
      };
    });
    expect(singleEqual.dp11).toBe(1);
    expect(singleEqual.lcs).toBe('A');

    // Test single-character different strings
    const singleDiff = await page.evaluate(() => {
      const X = 'A';
      const Y = 'B';
      const dp = lcsLength(X, Y);
      const lcs = reconstructLCS(dp, X, Y);
      return {
        dp11: dp[1][1],
        lcs
      };
    });
    expect(singleDiff.dp11).toBe(0);
    expect(singleDiff.lcs).toBe('');

    // Ensure no runtime errors appeared during these evaluations
    expect(consoleErrors.length, `console.error messages during edge-case tests: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
    expect(pageErrors.length, `page errors during edge-case tests: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
  });

  // Validate robustness: clicking multiple times updates output deterministically and does not create errors
  test('Idempotent behavior and multiple clicks: repeated runs update output and remain error-free', async ({ page }) => {
    const demo = new LcsDemoPage(page);
    await demo.goto();

    // Run demo twice in succession and verify output remains consistent and no errors occur
    const first = await demo.runDemo();
    const second = await demo.runDemo();

    // The output should be non-empty and contain the expected length each time
    expect(first).toMatch(/Length of Longest Common Subsequence:\s*4/);
    expect(second).toMatch(/Length of Longest Common Subsequence:\s*4/);

    // Content should remain meaningfully similar (both should have the same input strings)
    expect(first).toContain('String X: ABCBDAB');
    expect(second).toContain('String X: ABCBDAB');

    // No new console or page errors should be introduced by repeated interaction
    expect(consoleErrors.length, `console.error messages after repeated runs: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
    expect(pageErrors.length, `page errors after repeated runs: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
  });

  // Visual and accessibility checks for UI components mentioned in the FSM
  test('UI and accessibility validations for components described in FSM', async ({ page }) => {
    const demo = new LcsDemoPage(page);
    await demo.goto();

    // Button should be focusable and enabled
    await demo.btn.focus();
    expect(await demo.btn.isEnabled()).toBe(true);

    // The demo output area should have the 'demo-output' class and be a <pre> element
    const tagName = await demo.output.evaluate(node => node.tagName);
    expect(tagName.toLowerCase()).toBe('pre');
    await expect(demo.output).toHaveClass(/demo-output/);

    // Run demo to ensure aria-live content changes (practical verification)
    await demo.runDemo();
    // After running demo, the output should still have aria attributes
    await expect(demo.output).toHaveAttribute('aria-live', 'polite');
    await expect(demo.output).toHaveAttribute('aria-atomic', 'true');

    // No runtime errors emitted during these checks
    expect(consoleErrors.length, `console.error messages during UI/accessibility checks: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
    expect(pageErrors.length, `page errors during UI/accessibility checks: ${pageErrors.map(e => String(e)).join(' | ')}`).toBe(0);
  });
});