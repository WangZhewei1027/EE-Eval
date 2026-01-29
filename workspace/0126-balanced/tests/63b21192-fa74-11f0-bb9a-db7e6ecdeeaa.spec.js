import { test, expect } from '@playwright/test';

test.setTimeout(180000); // Allow up to 3 minutes because the demo has deliberate visualization pauses

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b21192-fa74-11f0-bb9a-db7e6ecdeeaa.html';

/**
 * Page Object for the Knapsack Branch and Bound demo
 */
class KnapsackPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // capture console and page errors for assertions
    page.on('console', msg => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      // pageerror event includes Error objects (uncaught exceptions)
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial render: items-body present
    await this.page.waitForSelector('#items-body');
  }

  async startBranchAndBound() {
    await this.page.click('#start-btn');
  }

  async isStartDisabled() {
    return this.page.locator('#start-btn').evaluate((btn) => btn.disabled);
  }

  async getOutputText() {
    return this.page.locator('#output').textContent();
  }

  async waitForAnyBranchingOutput(timeout = 30_000) {
    // Wait until some algorithmic output is appended (a line with "[Level:")
    await this.page.waitForFunction(() => {
      const out = document.getElementById('output');
      return out && out.textContent && out.textContent.includes('[Level:');
    }, null, { timeout });
  }

  async waitForCompletion(timeout = 120_000) {
    // Wait for the final marker of completion
    await this.page.waitForFunction(() => {
      const out1 = document.getElementById('output');
      return out && out.textContent && out.textContent.includes('=== Optimal Solution ===');
    }, null, { timeout });
  }

  async getItemsRowCount() {
    return this.page.locator('#items-body tr').count();
  }

  async reload() {
    await this.page.reload();
    await this.page.waitForSelector('#items-body');
  }
}

test.describe('Branch and Bound Demo - Knapsack (FSM validation)', () => {
  // Standard per-test setup: create page object and navigate
  test.beforeEach(async ({ page }) => {
    // nothing here; each test will construct its own KnapsackPage and goto()
  });

  test('Idle state (S0_Idle): items are rendered and start button is enabled', async ({ page }) => {
    // Validate initial/idle state of the app matches FSM S0_Idle entry actions and evidence
    const knap = new KnapsackPage(page);
    await knap.goto();

    // Ensure items were rendered by renderItems() (evidence: rows in table)
    const rowCount = await knap.getItemsRowCount();
    // The implementation defines 5 items; assert they are rendered
    expect(rowCount).toBe(5);

    // Validate table has expected aria-label as component evidence
    const tableAria = await page.locator('#knapsack-table').getAttribute('aria-label');
    expect(tableAria).toBe('Items for knapsack problem');

    // Start button exists and is enabled in Idle state
    const startVisible = await page.locator('#start-btn').isVisible();
    expect(startVisible).toBe(true);

    const startDisabled = await knap.isStartDisabled();
    expect(startDisabled).toBe(false);

    // Output should be initially empty per S0_Idle evidence
    const outputText = (await knap.getOutputText()) || '';
    expect(outputText.trim()).toBe('');
  });

  test('StartBranchAndBound event triggers Branching state (S1_Branching) and disables button', async ({ page }) => {
    // This test validates the transition from Idle -> Branching on click
    const knap1 = new KnapsackPage(page);
    await knap.goto();

    // Capture console and page errors while the algorithm runs
    // Start algorithm
    await knap.startBranchAndBound();

    // On entry to Branching the code sets output.textContent = '' and startBtn.disabled = true
    // Assert start button becomes disabled shortly after clicking
    await page.waitForFunction(() => document.getElementById('start-btn').disabled === true, null, { timeout: 5000 });
    expect(await knap.isStartDisabled()).toBe(true);

    // The algorithm prints lines like "[Level: ...] Profit: ..." – wait for first such output
    await knap.waitForAnyBranchingOutput(60_000); // allow generous time for first step
    const partialOutput = await knap.getOutputText();
    expect(partialOutput).toContain('[Level:');
    expect(partialOutput).toMatch(/Profit:\s*\d+/);

    // Also assert that one of the textual evidences from FSM appears, e.g., "Adding node" or "Popped node"
    expect(/Popped node|Adding node|Pruned node|Found new max profit/i.test(partialOutput)).toBeTruthy();
  });

  test('Branching completes and transition to Completed (S2_Completed) shows optimal solution and re-enables button', async ({ page }) => {
    // Validate that the branching finishes, prints the optimal solution, and exit action re-enables button
    const knap2 = new KnapsackPage(page);
    await knap.goto();

    // Start the algorithm
    await knap.startBranchAndBound();

    // Confirm it's running (button disabled) before waiting for completion
    await page.waitForFunction(() => document.getElementById('start-btn').disabled === true, null, { timeout: 5000 });
    expect(await knap.isStartDisabled()).toBe(true);

    // Wait for final output marker
    await knap.waitForCompletion(120_000); // can take time due to visualization pauses

    // After completion, start button should be enabled again (exit action from Branching)
    await page.waitForFunction(() => document.getElementById('start-btn').disabled === false, null, { timeout: 10_000 });
    expect(await knap.isStartDisabled()).toBe(false);

    // Validate final output contains expected final evidence
    const out2 = await knap.getOutputText();
    expect(out).toContain('=== Optimal Solution ===');

    // There should be an entry for every original item (included or excluded)
    const itemLines = (out.match(/Item #\d+/g) || []).length;
    // Implementation iterates over all original items (5)
    expect(itemLines).toBe(5);

    // Validate totals are present with expected labels
    expect(out).toMatch(/Total Weight:\s*\d+\.\d{2}\s*\/\s*Capacity:\s*\d+/);
    expect(out).toMatch(/Total Value:\s*\d+/);
  });

  test('Edge case: clicking start multiple times quickly does not produce duplicate final sections', async ({ page }) => {
    // This test checks robustness: clicking start rapidly should not create multiple final solution blocks
    const knap3 = new KnapsackPage(page);
    await knap.goto();

    // Click twice quickly
    const startBtn = page.locator('#start-btn');
    await startBtn.click();
    await startBtn.click(); // second click should be ignored because button should be disabled on first click

    // Button should be disabled during run
    await page.waitForFunction(() => document.getElementById('start-btn').disabled === true, null, { timeout: 5000 });
    expect(await knap.isStartDisabled()).toBe(true);

    // Wait for completion
    await knap.waitForCompletion(120_000);

    // Check output: ensure the final marker appears only once
    const out3 = await knap.getOutputText();
    const firstIndex = out.indexOf('=== Optimal Solution ===');
    const lastIndex = out.lastIndexOf('=== Optimal Solution ===');
    expect(firstIndex).toBeGreaterThanOrEqual(0);
    expect(firstIndex).toBe(lastIndex); // only one final marker

    // Ensure no unexpected console or page errors occurred during rapid clicks
    const errorConsoleMessages = knap.consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
    expect(knap.pageErrors.length).toBe(0);
  });

  test('Runtime verification: no uncaught JavaScript errors or console.error logs during typical run', async ({ page }) => {
    // This test focuses on observing console logs and page errors and asserting none occurred
    const knap4 = new KnapsackPage(page);
    await knap.goto();

    // Start algorithm and wait for completion
    await knap.startBranchAndBound();
    await knap.waitForCompletion(120_000);

    // Assert there were no page-level uncaught exceptions
    expect(knap.pageErrors.length).toBe(0);

    // Assert console did not emit error-level messages
    const errorConsoleMessages1 = knap.consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // (If there were TypeError/ReferenceError/SyntaxError they'd appear in pageErrors or as console.error)
    // We explicitly assert none exist as part of runtime sanity checks.
  });
});