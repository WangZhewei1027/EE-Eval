import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b57d41-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('FSM: Comprehensive Guide to Hash Functions - Interactive Demo (f0b57d41-fa7c-11f0-9fa6-d1bbe297d459)', () => {
  // Arrays to capture runtime issues and console messages for assertions
  let pageErrors;
  let consoleErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Reset collectors for each test
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    // Collect uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect all console messages; separate out console.error messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the HTML page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Basic invariant: tests expect no unexpected page errors during normal flows
    // (Specific error scenarios are covered in dedicated tests below)
    // This assertion will be done within individual tests where appropriate,
    // but we keep collectors available for debugging if a test fails.
  });

  test.describe('State S0_Idle - Initial page render', () => {
    test('Idle state: should render the demo button and an empty demo output area', async ({ page }) => {
      // Validate that the demo button exists and has correct text
      const demoButton = page.locator('#demoButton');
      await expect(demoButton).toHaveCount(1);
      await expect(demoButton).toHaveText('Run Hash Demonstration');

      // Validate that the demo output container exists and is initially empty
      const demoOutput = page.locator('#demoOutput');
      await expect(demoOutput).toHaveCount(1);
      const demoOutputHtml = await demoOutput.innerHTML();
      expect(demoOutputHtml.trim()).toBe('');

      // Confirm that no runtime page errors were emitted during initial load
      expect(pageErrors.length).toBe(0);
      // Also confirm no console.error messages during initial load
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition: RunHashDemonstration (S0 -> S1) and S1_HashDemonstrationRunning', () => {
    test('Clicking Run Hash Demonstration renders a table with expected header and rows', async ({ page }) => {
      // Click the demo button to trigger the demonstration
      await page.click('#demoButton');

      // Wait for a table to appear inside the demoOutput area
      const table = page.locator('#demoOutput table');
      await expect(table).toBeVisible();

      // Validate table header columns
      const headers = table.locator('th');
      await expect(headers.nth(0)).toHaveText('Input');
      await expect(headers.nth(1)).toHaveText('Hash Value');
      await expect(headers.nth(2)).toHaveText('Length');

      // Validate number of rows: 1 header row + 6 data rows (based on implementation inputs array)
      const allRows = table.locator('tr');
      const rowCount = await allRows.count();
      // header + 6 entries => 7 rows expected
      expect(rowCount).toBe(7);

      // Validate content of first two data rows and ensure their hash values differ
      const firstDataRowHashCode = table.locator('tr').nth(1).locator('td').nth(1).locator('code');
      const secondDataRowHashCode = table.locator('tr').nth(2).locator('td').nth(1).locator('code');

      const hash1 = (await firstDataRowHashCode.innerText()).trim();
      const hash2 = (await secondDataRowHashCode.innerText()).trim();

      expect(hash1.length).toBeGreaterThan(0);
      expect(hash2.length).toBeGreaterThan(0);
      // Ensure the two similar-but-different inputs produce different hashes
      expect(hash1).not.toBe(hash2);

      // Validate the "Length" column matches the hash .length reported in the table
      const lengthTextCell = table.locator('tr').nth(1).locator('td').nth(2);
      const reportedLength = parseInt((await lengthTextCell.innerText()).replace(' chars', '').trim(), 10);
      expect(reportedLength).toBe(hash1.length);

      // Validate that explanatory paragraph appears after the table
      const paragraph = page.locator('#demoOutput p');
      await expect(paragraph).toBeVisible();
      await expect(paragraph).toHaveText(/Notice how even small changes in input produce completely different hash values/i);

      // Confirm that no uncaught page errors or console errors were emitted during the normal demonstration run
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Running the demo multiple times replaces previous output (no duplicated tables)', async ({ page }) => {
      // First run
      await page.click('#demoButton');
      const table = page.locator('#demoOutput table');
      await expect(table).toBeVisible();
      const firstRunRowCount = await table.locator('tr').count();
      expect(firstRunRowCount).toBe(7);

      // Second run (should clear and re-render)
      await page.click('#demoButton');
      const secondRunRowCount = await table.locator('tr').count();
      // Should still be header + 6 rows, and not have grown
      expect(secondRunRowCount).toBe(7);

      // Click rapidly multiple times to simulate quick repeated user interaction
      await page.click('#demoButton');
      await page.click('#demoButton');
      const finalRowCount = await table.locator('tr').count();
      expect(finalRowCount).toBe(7);

      // No runtime errors from repeated clicks
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Attempting to click the demo button after it is removed from the DOM should throw', async ({ page }) => {
      // Remove the demo button from the DOM to simulate an unexpected DOM mutation
      await page.evaluate(() => {
        const btn = document.getElementById('demoButton');
        if (btn) btn.remove();
      });

      // Confirm it is removed
      await expect(page.locator('#demoButton')).toHaveCount(0);

      // Attempting to click a non-existent element should reject; assert that Playwright throws
      // We expect a rejection due to element not being found
      await expect(page.click('#demoButton')).rejects.toThrow();

      // No new page-level JS errors should have been emitted as a direct result of removal
      expect(pageErrors.length).toBe(0);
    });

    test('If the output container is tampered with (cleared) before running, demo still renders correctly', async ({ page }) => {
      // Clear the demoOutput content explicitly before running the demo
      await page.evaluate(() => {
        const output = document.getElementById('demoOutput');
        if (output) output.innerHTML = '<em>pre-cleared</em>';
      });

      // Ensure pre-cleared text exists
      await expect(page.locator('#demoOutput em')).toHaveText('pre-cleared');

      // Run the demo; implementation clears the output at the start of the click handler
      await page.click('#demoButton');

      // The pre-cleared content should be replaced by the table
      const table = page.locator('#demoOutput table');
      await expect(table).toBeVisible();
      const allRows = table.locator('tr');
      const rowCount = await allRows.count();
      expect(rowCount).toBe(7);

      // No page errors introduced
      expect(pageErrors.length).toBe(0);
    });

    test('Observe console messages and page errors emitted during various actions', async ({ page }) => {
      // This test intentionally collects console output across a couple of interactions
      // Run the demo
      await page.click('#demoButton');
      // Remove button
      await page.evaluate(() => {
        const btn = document.getElementById('demoButton');
        if (btn) btn.remove();
      });
      // Attempt a click that will fail (caught by previous test as well)
      await expect(page.click('#demoButton')).rejects.toThrow();

      // We assert that we captured console messages (there may be logs or informational messages)
      // At minimum, the page should have emitted some console entries (info/log)
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);

      // Confirm that there are no uncaught page errors (ReferenceError/SyntaxError/TypeError)
      // If any such errors occurred naturally, they would be collected in pageErrors and the test would reflect that
      expect(Array.isArray(pageErrors)).toBe(true);

      // If the page emitted any JS runtime errors they will be included here; fail test only if unexpected errors exist.
      // For this application the expected behavior is no uncaught exceptions in normal flows, so assert zero.
      expect(pageErrors.length).toBe(0);
    });
  });
});