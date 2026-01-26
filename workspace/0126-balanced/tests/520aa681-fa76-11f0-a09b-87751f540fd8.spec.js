import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520aa681-fa76-11f0-a09b-87751f540fd8.html';

test.describe('520aa681-fa76-11f0-a09b-87751f540fd8 - Query Optimization FSM tests', () => {
  // Will collect console messages and page errors from the page during each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages with timestamps so we can assert order reliably
    page.on('console', (msg) => {
      // Only capture text-based console messages for assertions
      try {
        const text = msg.text();
        consoleMessages.push({
          text,
          type: msg.type(),
          timestamp: Date.now(),
        });
      } catch (e) {
        // If reading console message fails for any reason, still record a placeholder
        consoleMessages.push({
          text: `<unreadable console message: ${String(e)}>`,
          type: 'unknown',
          timestamp: Date.now(),
        });
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is; do not modify or inject
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Clear arrays to avoid cross-test leakage (not strictly necessary since new arrays per test run)
    consoleMessages = [];
    pageErrors = [];
  });

  test('S0 Idle: initial render shows header and table (renderPage entry action)', async ({ page }) => {
    // Validate initial static DOM (Idle state entry action renderPage() is implied by page load)
    // Check header exists and contains expected text
    const header = page.locator('h1');
    await expect(header).toHaveText('Query Optimization');

    // Check the table exists with expected id and has header columns
    const table = page.locator('#query-optimization-table');
    await expect(table).toBeVisible();

    const headerCells = table.locator('tr').first().locator('th');
    await expect(headerCells.nth(0)).toHaveText('Query');
    await expect(headerCells.nth(1)).toHaveText('Indexing');
    await expect(headerCells.nth(2)).toHaveText('Execution Time');
    await expect(headerCells.nth(3)).toHaveText('Cost');

    // Validate that the table includes the three expected query rows (static content)
    const rows = table.locator('tr');
    const rowCount = await rows.count();
    // 1 header row + 3 data rows expected
    expect(rowCount).toBeGreaterThanOrEqual(4);

    // Check that the last data row contains the full query and indexing information
    const thirdDataRow = rows.nth(3);
    const thirdRowCells = thirdDataRow.locator('td');
    await expect(thirdRowCells.nth(0)).toHaveText("SELECT * FROM users WHERE age > 18 AND country='USA' AND city='New York';");
    await expect(thirdRowCells.nth(1)).toHaveText('Indexing: index on age AND country AND city;');
    await expect(thirdRowCells.nth(2)).toHaveText('Execution Time: 0.0003s');
    await expect(thirdRowCells.nth(3)).toHaveText('Cost: 0');
  });

  test('Transitions: S4 -> S2 -> S1 -> S3 logs appear in expected order and contain expected values', async ({ page }) => {
    // This test validates the timeout-driven transitions and onEnter console.log actions:
    // According to the implementation: ExecutionTimeMeasurement (100ms), Indexing (200ms),
    // QueryExecution (300ms), CostCalculation (400ms).
    // We'll wait a safe margin and then assert that corresponding console messages were emitted
    // in expected order: Execution Time, Indexing, Query, Cost.

    // Wait sufficiently long for all timeouts to fire (use 1000ms to be safe)
    await page.waitForTimeout(1000);

    // Extract texts in the order received
    const texts = consoleMessages.map((m) => m.text);

    // Find first occurrences of the key messages
    const idxExecutionTime = texts.findIndex((t) => t.includes('Execution Time:'));
    const idxIndexing = texts.findIndex((t) => t.includes('Indexing:'));
    const idxQuery = texts.findIndex((t) => t.includes('Query:'));
    const idxCost = texts.findIndex((t) => {
      // There might be 'Cost:' in the Execution Time log as well; find the explicit standalone 'Cost:' log as well
      // We will accept any console message that contains 'Cost:' but prefer the one that is a separate 'Cost:' log
      return t.match(/\bCost:/);
    });

    // Assert that each expected log appeared at least once
    expect(idxExecutionTime).toBeGreaterThanOrEqual(0);
    expect(idxIndexing).toBeGreaterThanOrEqual(0);
    expect(idxQuery).toBeGreaterThanOrEqual(0);
    expect(idxCost).toBeGreaterThanOrEqual(0);

    // Assert the chronological order of first occurrences matches expected timeouts:
    // Execution Time (100ms) should be before Indexing (200ms) before Query (300ms) before Cost (400ms)
    expect(idxExecutionTime).toBeLessThan(idxIndexing);
    expect(idxIndexing).toBeLessThan(idxQuery);
    expect(idxQuery).toBeLessThan(idxCost);

    // Additional content checks: ensure logged messages include the expected substrings
    expect(texts[idxExecutionTime]).toContain('Execution Time:');
    expect(texts[idxExecutionTime]).toMatch(/Execution Time: .*s, Cost:/);

    expect(texts[idxIndexing]).toContain('Indexing:');
    expect(texts[idxIndexing]).toContain('index on age AND country AND city');

    expect(texts[idxQuery]).toContain('Query:');
    expect(texts[idxQuery]).toContain("SELECT * FROM users WHERE age > 18 AND country='USA' AND city='New York';");

    // The cost log may come as part of Execution Time log and also separately; ensure at least one 'Cost:' log has numeric value
    const costMessages = texts.filter((t) => t.includes('Cost:'));
    expect(costMessages.length).toBeGreaterThanOrEqual(1);

    // Parse a numeric cost from one of the cost-containing messages
    const costRegex = /Cost:\s*([0-9]*\.?[0-9]+)/;
    let parsedCost = null;
    for (const msg of costMessages) {
      const m = msg.match(costRegex);
      if (m) {
        parsedCost = parseFloat(m[1]);
        if (!Number.isNaN(parsedCost)) break;
      }
    }
    expect(parsedCost).not.toBeNull();
    expect(typeof parsedCost).toBe('number');
    expect(parsedCost).toBeGreaterThanOrEqual(0);

    // Parse execution time value from the execution time message and validate numeric range
    const execTimeRegex = /Execution Time:\s*([0-9]*\.?[0-9]+)s/;
    const execMatch = texts[idxExecutionTime].match(execTimeRegex);
    expect(execMatch).not.toBeNull();
    const parsedExecTime = parseFloat(execMatch[1]);
    expect(typeof parsedExecTime).toBe('number');
    // In implementation, executionTime is Math.random() * 0.0001 + 0.0001 => between 0.0001 and 0.0002 (toFixed(2) will round)
    // We will only assert it's a small positive number
    expect(parsedExecTime).toBeGreaterThanOrEqual(0);
  });

  test('S1..S4 entry actions log messages are present and reproducible after reload (edge case)', async ({ page }) => {
    // This test checks that after a reload the same timeout-driven logs appear again,
    // which validates that the transitions are re-triggered on page load (stateless timeouts).

    // First run: wait and record counts
    await page.waitForTimeout(600);
    const firstRunCount = consoleMessages.length;

    // Reload the page and reset our captured arrays by reattaching listeners via new page context
    // For safety, we re-navigate the same page (without modifying runtime)
    // Clear captured arrays
    consoleMessages = [];
    pageErrors = [];
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait again for timeouts to fire
    await page.waitForTimeout(600);
    const secondRunCount = consoleMessages.length;

    // We expect console messages again on reload (same or similar number >= 1)
    expect(secondRunCount).toBeGreaterThanOrEqual(1);

    // Ensure key messages appear in the second run as well
    const texts = consoleMessages.map((m) => m.text);
    expect(texts.some((t) => t.includes('Execution Time:'))).toBeTruthy();
    expect(texts.some((t) => t.includes('Indexing:'))).toBeTruthy();
    expect(texts.some((t) => t.includes('Query:'))).toBeTruthy();
    expect(texts.some((t) => t.includes('Cost:'))).toBeTruthy();
  });

  test('No unexpected page errors (ReferenceError/SyntaxError/TypeError) occurred during the scenario', async ({ page }) => {
    // Wait a bit to allow any runtime errors to occur due to page execution
    await page.waitForTimeout(600);

    // Assert that no uncaught exceptions were emitted to the page
    // The application is expected to run with timeouts and console logs without raising page errors.
    // If there are errors they will be recorded in pageErrors array; we assert zero here.
    expect(pageErrors.length).toBe(0);
  });

  test('DOM stability: timeouts do not modify the static table content (edge verification)', async ({ page }) => {
    // Confirm that after all timeouts, the table content remains as originally rendered (no dynamic DOM mutation expected)
    const table = page.locator('#query-optimization-table');
    const rows = table.locator('tr');
    // Wait for timeouts to complete
    await page.waitForTimeout(600);

    // Re-verify the third data row content is unchanged
    const thirdDataRow = rows.nth(3);
    const thirdRowCells = thirdDataRow.locator('td');
    await expect(thirdRowCells.nth(0)).toHaveText("SELECT * FROM users WHERE age > 18 AND country='USA' AND city='New York';");
    await expect(thirdRowCells.nth(1)).toHaveText('Indexing: index on age AND country AND city;');
    await expect(thirdRowCells.nth(2)).toHaveText('Execution Time: 0.0003s');
    await expect(thirdRowCells.nth(3)).toHaveText('Cost: 0');
  });

  // Additional test documenting captured console messages for debugging purposes (not modifying runtime)
  test('Captured console messages contain expected keywords (diagnostic)', async ({ page }) => {
    // Wait for all timeouts to complete
    await page.waitForTimeout(1000);

    // Ensure we captured at least one console log and it contains the header-like messages
    const texts = consoleMessages.map((m) => m.text);
    // Diagnostic assertions: at least one of each expected categories exists
    expect(texts.some((t) => t.includes('Execution Time:'))).toBeTruthy();
    expect(texts.some((t) => t.includes('Indexing:'))).toBeTruthy();
    expect(texts.some((t) => t.includes('Query:'))).toBeTruthy();
    expect(texts.some((t) => t.includes('Cost:'))).toBeTruthy();

    // For maintainability, attach an assertion that the messages array is non-empty
    expect(texts.length).toBeGreaterThan(0);

    // Log the captured console messages to the test output for debugging (Playwright will show them on failure)
    // This does not modify the page, only provides test-time diagnostics
    for (const msg of consoleMessages) {
      // Ensure every captured console entry has text
      expect(typeof msg.text).toBe('string');
    }
  });
});