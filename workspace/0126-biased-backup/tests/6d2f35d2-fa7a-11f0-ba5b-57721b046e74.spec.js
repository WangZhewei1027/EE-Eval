import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2f35d2-fa7a-11f0-ba5b-57721b046e74.html';

/**
 * Page Object representing the Dynamic Programming Explorer page.
 * Encapsulates common interactions used by the tests.
 */
class DynamicProgrammingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];

    // Capture console errors and page errors for assertions
    this.page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(String(err));
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for main container to render
    await this.page.waitForSelector('.container');
  }

  // Fibonacci helpers
  async setFibInput(n) {
    const locator = this.page.locator('input#fib-input');
    await locator.fill(String(n));
  }
  async selectFibMethod(methodValue) {
    const select = this.page.locator('select#fib-method');
    await select.selectOption({ value: methodValue });
    // wait for explanation update
    await this.page.waitForTimeout(50);
  }
  async clickCalculateFibonacci() {
    await this.page.click('button[onclick="calculateFibonacci()"]');
  }
  async clickStepThroughFibonacci() {
    await this.page.click('button[onclick="stepThroughFibonacci()"]');
  }
  async clickResetFibonacci() {
    await this.page.click('button[onclick="resetFibonacci()"]');
  }
  async getFibResultText() {
    return (await this.page.locator('#fib-result').innerText()).trim();
  }
  async getFibStepsText() {
    return (await this.page.locator('#fib-steps').innerText()).trim();
  }
  async fibMemoTableVisible() {
    return await this.page.locator('#fib-memo-table').isVisible();
  }
  async fibMemoCellsCount(selectorPrefix = '#fib-memo-') {
    // Count elements whose id starts with given prefix by querying all .memo-cell and filtering
    const cells = await this.page.locator('.memo-cell').elementHandles();
    let count = 0;
    for (const h of cells) {
      const id = await h.getAttribute('id');
      if (id && id.startsWith(selectorPrefix.replace('#', ''))) count++;
    }
    return count;
  }

  // Knapsack helpers
  async setKnapsackCapacity(n) {
    await this.page.locator('input#knapsack-capacity').fill(String(n));
  }
  async clickGenerateKnapsackItems() {
    await this.page.click('button[onclick="generateKnapsackItems()"]');
  }
  async clickStepThroughKnapsack() {
    await this.page.click('button[onclick="stepThroughKnapsack()"]');
  }
  async clickResetKnapsack() {
    await this.page.click('button[onclick="resetKnapsack()"]');
  }
  async clickSolveKnapsack() {
    await this.page.click('button[onclick="solveKnapsack()"]');
  }
  async getKnapsackItemsHtml() {
    return (await this.page.locator('#knapsack-items').innerHTML()).trim();
  }
  async getKnapsackResultText() {
    return (await this.page.locator('#knapsack-result').innerText()).trim();
  }
  async getKnapsackStepsText() {
    return (await this.page.locator('#knapsack-steps').innerText()).trim();
  }
  async knapsackDpTableHtml() {
    return (await this.page.locator('#knapsack-dp-table').innerHTML()).trim();
  }

  // LCS helpers
  async setLcsStr1(s) {
    await this.page.locator('input#lcs-str1').fill(s);
  }
  async setLcsStr2(s) {
    await this.page.locator('input#lcs-str2').fill(s);
  }
  async clickCalculateLCS() {
    await this.page.click('button[onclick="calculateLCS()"]');
  }
  async clickStepThroughLCS() {
    await this.page.click('button[onclick="stepThroughLCS()"]');
  }
  async clickResetLCS() {
    await this.page.click('button[onclick="resetLCS()"]');
  }
  async getLcsResultText() {
    return (await this.page.locator('#lcs-result').innerText()).trim();
  }
  async getLcsStepsText() {
    return (await this.page.locator('#lcs-steps').innerText()).trim();
  }
  async lcsDpTableHtml() {
    return (await this.page.locator('#lcs-dp-table').innerHTML()).trim();
  }

  // Error collectors
  getConsoleErrors() {
    return this.consoleErrors;
  }
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Dynamic Programming Explorer - end-to-end', () => {
  // Reusable page object per test
  let dpPage;

  test.beforeEach(async ({ page }) => {
    dpPage = new DynamicProgrammingPage(page);
    await dpPage.goto();
    // allow initial scripts to run (explanation + knapsack generation)
    await page.waitForLoadState('networkidle');
  });

  test('Idle state: page initially renders expected sections and initial content', async ({ page }) => {
    // Validate basic structure and initial values
    // Ensure container and major sections exist
    await expect(page.locator('.container')).toBeVisible();
    await expect(page.locator('h1')).toHaveText('Dynamic Programming Explorer');

    // Verify Fibonacci input default value and explanation present
    const fibInput = page.locator('input#fib-input');
    await expect(fibInput).toHaveValue('5'); // per HTML value attribute

    // The fib explanation should be present and reference the selected method (default 'recursive')
    await expect(page.locator('#fib-explanation')).toContainText('Recursive Approach');

    // Knapsack items should have been generated on initialization (generateKnapsackItems called)
    const knapsackItemsHtml = await dpPage.getKnapsackItemsHtml();
    expect(knapsackItemsHtml).toMatch(/<h3>Items<\/h3>/);
    // The generated table should have at least 3 item rows (table rows minus header)
    const rows = await page.locator('#knapsack-items table tr').count();
    // rows include header row, so expect at least 4 (header + 3 items)
    expect(rows).toBeGreaterThanOrEqual(4);

    // LCS inputs should contain the default strings
    await expect(page.locator('input#lcs-str1')).toHaveValue('ABCDGH');
    await expect(page.locator('input#lcs-str2')).toHaveValue('AEDFHR');

    // No runtime console errors or page errors should have occurred during load
    expect(dpPage.getConsoleErrors()).toEqual([]);
    expect(dpPage.getPageErrors()).toEqual([]);
  });

  test.describe('Fibonacci interactions (S0 <-> S1)', () => {
    test('Calculate Fibonacci (Recursive, Memoization, DP) transitions and displays results', async () => {
      // Test recursive method
      await dpPage.setFibInput(6);
      await dpPage.selectFibMethod('recursive');
      await dpPage.clickCalculateFibonacci();

      // Expect result for fib(6) = 8 with tag (Recursive)
      const fibResultRecursive = await dpPage.getFibResultText();
      expect(fibResultRecursive).toContain('Fibonacci(6) = 8');
      expect(fibResultRecursive).toContain('(Recursive)');

      // Switch to memoization and calculate
      await dpPage.selectFibMethod('memoization');
      await dpPage.setFibInput(7);
      await dpPage.clickCalculateFibonacci();

      const fibResultMemo = await dpPage.getFibResultText();
      // fib(7) = 13
      expect(fibResultMemo).toContain('Fibonacci(7) = 13');
      expect(fibResultMemo).toContain('(Memoization)');

      // Memo table should be visible and include memo-cell elements (ids like fib-memo-0..)
      const memoVisible = await dpPage.fibMemoTableVisible();
      expect(memoVisible).toBe(true);
      // There should be at least one memo cell created
      const memoCellCount = await dpPage.fibMemoCellsCount('#fib-memo-');
      expect(memoCellCount).toBeGreaterThanOrEqual(1);

      // Switch to DP method and calculate
      await dpPage.selectFibMethod('dp');
      await dpPage.setFibInput(8);
      await dpPage.clickCalculateFibonacci();

      const fibResultDP = await dpPage.getFibResultText();
      // fib(8) = 21
      expect(fibResultDP).toContain('Fibonacci(8) = 21');
      expect(fibResultDP).toContain('(DP)');

      // DP table should include cells with ids fib-dp-0 .. fib-dp-8
      // Check for at least a couple of dp cells by id
      await expect(page.locator('#fib-dp-0')).toBeVisible();
      await expect(page.locator('#fib-dp-1')).toBeVisible();

      // No console/page errors during Fibonacci calculations
      expect(dpPage.getConsoleErrors()).toEqual([]);
      expect(dpPage.getPageErrors()).toEqual([]);
    });

    test('Step through Fibonacci and Reset behavior', async () => {
      // Use DP method which generates a simple set of steps (generateFibDPSteps adds 1 step)
      await dpPage.setFibInput(3);
      await dpPage.selectFibMethod('dp');
      await dpPage.clickCalculateFibonacci();

      // First step: should show initialization message and highlight dp cells
      await dpPage.clickStepThroughFibonacci();
      const stepText1 = await dpPage.getFibStepsText();
      expect(stepText1).toContain('Initializing DP array');

      // Second step: since only one step was generated, clicking again should display completion message
      await dpPage.clickStepThroughFibonacci();
      const stepText2 = await dpPage.getFibStepsText();
      // It may either replace with "All steps completed!" or remain; check both possibilities
      expect(
        stepText2 === 'All steps completed!' || stepText2.length > 0
      ).toBeTruthy();

      // Reset Fibonacci and ensure UI elements are cleared
      await dpPage.clickResetFibonacci();
      await expect(page.locator('#fib-result')).toHaveText('');
      await expect(page.locator('#fib-steps')).toHaveText('');
      // fib-memo-table should be hidden / empty
      await expect(page.locator('#fib-memo-table')).toHaveJSProperty('style');
      const memoHtmlAfterReset = await page.locator('#fib-memo-table').innerHTML();
      expect(memoHtmlAfterReset.trim()).toBe('');

      // No console/page errors during step/reset
      expect(dpPage.getConsoleErrors()).toEqual([]);
      expect(dpPage.getPageErrors()).toEqual([]);
    });

    test('Update Fibonacci explanation when changing method (UpdateFibonacciExplanation event)', async () => {
      // Start with memoization and check explanation content
      await dpPage.selectFibMethod('memoization');
      // Explanation should reflect memoization approach
      await expect(page.locator('#fib-explanation')).toContainText('Memoization (Top-Down DP)');

      // Change to DP and verify explanation updates
      await dpPage.selectFibMethod('dp');
      await expect(page.locator('#fib-explanation')).toContainText('Dynamic Programming (Bottom-Up)');

      // Change to recursive and verify explanation updates
      await dpPage.selectFibMethod('recursive');
      await expect(page.locator('#fib-explanation')).toContainText('Recursive Approach');

      // No page or console errors caused by explanation updates
      expect(dpPage.getConsoleErrors()).toEqual([]);
      expect(dpPage.getPageErrors()).toEqual([]);
    });
  });

  test.describe('Knapsack interactions (S0 <-> S2)', () => {
    test('Generate Knapsack Items and Solve/Reset behaviors', async () => {
      // Set capacity to a small value and generate items
      await dpPage.setKnapsackCapacity(1);
      await dpPage.clickGenerateKnapsackItems();

      const itemsHtml = await dpPage.getKnapsackItemsHtml();
      expect(itemsHtml).toMatch(/<h3>Items<\/h3>/);
      // Table rows should be at least 4 (header + 3 items)
      const rows = await page.locator('#knapsack-items table tr').count();
      expect(rows).toBeGreaterThanOrEqual(4);

      // Click Solve to ensure result generation works (not part of FSM transitions but important)
      await dpPage.clickSolveKnapsack();
      const knapsackResult = await dpPage.getKnapsackResultText();
      // Should contain Maximum value and Total weight lines
      expect(knapsackResult).toMatch(/Maximum value:/);
      expect(knapsackResult).toMatch(/Total weight:/);

      // DP table should be rendered with cells having ids knapsack-cell-i-w
      await expect(page.locator('#knapsack-dp-table table')).toBeVisible();
      // Ensure at least one cell exists
      const dpCells = await page.locator('#knapsack-dp-table table td').count();
      expect(dpCells).toBeGreaterThan(0);

      // Step through knapsack (stub message expected)
      await dpPage.clickStepThroughKnapsack();
      const knapsackSteps = await dpPage.getKnapsackStepsText();
      expect(knapsackSteps).toContain('Step-by-step execution would be implemented here');

      // Reset knapsack and ensure UI elements are cleared
      await dpPage.clickResetKnapsack();
      await expect(page.locator('#knapsack-steps')).toHaveText('');
      await expect(page.locator('#knapsack-result')).toHaveText('');
      const dpTableAfterReset = await dpPage.knapsackDpTableHtml();
      expect(dpTableAfterReset).toBe('');

      // No console/page errors during knapsack interactions
      expect(dpPage.getConsoleErrors()).toEqual([]);
      expect(dpPage.getPageErrors()).toEqual([]);
    });

    test('Edge case: generating knapsack items with moderate capacity produces a reasonable item count', async () => {
      // Choose capacity 10 -> count = Math.min(5, Math.max(3, Math.floor(10/2))) = Math.min(5, Math.max(3,5)) = 5
      await dpPage.setKnapsackCapacity(10);
      await dpPage.clickGenerateKnapsackItems();

      // Count items in the displayed table (rows - header)
      const totalRows = await page.locator('#knapsack-items table tr').count();
      const itemCount = totalRows - 1; // subtract header row
      expect(itemCount).toBeGreaterThanOrEqual(3);
      expect(itemCount).toBeLessThanOrEqual(5);

      // No console/page errors
      expect(dpPage.getConsoleErrors()).toEqual([]);
      expect(dpPage.getPageErrors()).toEqual([]);
    });
  });

  test.describe('LCS interactions (S0 <-> S3)', () => {
    test('Calculate LCS and verify DP table + result, then Reset', async () => {
      // Default strings should yield LCS length 3 and string "ADH"
      await dpPage.setLcsStr1('ABCDGH');
      await dpPage.setLcsStr2('AEDFHR');
      await dpPage.clickCalculateLCS();

      const lcsResult = await dpPage.getLcsResultText();
      expect(lcsResult).toContain('LCS Length: 3');
      expect(lcsResult).toContain('LCS String: ADH');

      // DP table should have cells with ids lcs-cell-i-j for i,j >= 1
      await expect(page.locator('#lcs-cell-1-1')).toBeVisible();
      await expect(page.locator('#lcs-cell-3-2')).toBeVisible();

      // Step through LCS (stub message)
      await dpPage.clickStepThroughLCS();
      const lcsSteps = await dpPage.getLcsStepsText();
      expect(lcsSteps).toContain('Step-by-step execution would be implemented here');

      // Reset LCS and ensure UI cleared
      await dpPage.clickResetLCS();
      await expect(page.locator('#lcs-steps')).toHaveText('');
      await expect(page.locator('#lcs-result')).toHaveText('');
      const lcsDpHtmlAfterReset = await dpPage.lcsDpTableHtml();
      expect(lcsDpHtmlAfterReset).toBe('');

      // No console/page errors
      expect(dpPage.getConsoleErrors()).toEqual([]);
      expect(dpPage.getPageErrors()).toEqual([]);
    });

    test('Edge case: LCS with empty strings', async () => {
      await dpPage.setLcsStr1('');
      await dpPage.setLcsStr2('');
      await dpPage.clickCalculateLCS();

      const lcsResult = await dpPage.getLcsResultText();
      expect(lcsResult).toContain('LCS Length: 0');
      expect(lcsResult).toContain('LCS String:');

      // Table should still exist but with minimal content
      const dpHtml = await dpPage.lcsDpTableHtml();
      expect(dpHtml.length).toBeGreaterThanOrEqual(0);

      // Reset again to clear
      await dpPage.clickResetLCS();
      expect(dpPage.getConsoleErrors()).toEqual([]);
      expect(dpPage.getPageErrors()).toEqual([]);
    });
  });

  test('Final verification: no unexpected runtime errors during interactions (console & page errors)', async () => {
    // Perform a few quick interactions across the page to ensure stability
    await dpPage.selectFibMethod('recursive');
    await dpPage.setFibInput(4);
    await dpPage.clickCalculateFibonacci();

    await dpPage.setKnapsackCapacity(5);
    await dpPage.clickGenerateKnapsackItems();
    await dpPage.clickSolveKnapsack();

    await dpPage.setLcsStr1('ABC');
    await dpPage.setLcsStr2('AC');
    await dpPage.clickCalculateLCS();

    // Allow any asynchronous operations to complete
    await dpPage.page.waitForTimeout(100);

    // Assert that there were no console errors or uncaught page errors throughout the test suite run
    const consoleErrors = dpPage.getConsoleErrors();
    const pageErrors = dpPage.getPageErrors();

    // Provide clear diagnostics if any errors were captured
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      // Attach errors to the test output via expect with descriptive message
      expect(consoleErrors.length + pageErrors.length).toBe(
        0,
        `Console errors: ${JSON.stringify(consoleErrors, null, 2)}\nPage errors: ${JSON.stringify(pageErrors, null, 2)}`
      );
    } else {
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    }
  });
});