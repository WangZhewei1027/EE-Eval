import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b35a60-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Page object encapsulating interactions with the amortized analysis demo page.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = '#demoButton';
    this.demoOutput = '#demoOutput';
    this.demoContent = '#demoContent';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clickInsert(times = 1) {
    for (let i = 0; i < times; i++) {
      // Wait for button to be enabled/visible and click
      await this.page.waitForSelector(this.demoButton, { state: 'visible' });
      await this.page.click(this.demoButton);
      // Allow DOM updates to settle
      await this.page.waitForTimeout(50);
    }
  }

  async isOutputVisible() {
    const display = await this.page.$eval(this.demoOutput, el => window.getComputedStyle(el).display);
    return display !== 'none';
  }

  async getDemoContentHTML() {
    return await this.page.$eval(this.demoContent, el => el.innerHTML);
  }

  // Parse the operation history table into structured objects
  async getHistoryRecords() {
    // If the table doesn't exist yet, return empty array
    const hasTable = await this.page.$(`${this.demoContent} table`);
    if (!hasTable) return [];

    // Extract rows (skip header)
    const rows = await this.page.$$(`${this.demoContent} table tr`);
    const records = [];
    for (let i = 1; i < rows.length; i++) {
      const cells = await rows[i].$$('td');
      // Extract text content of each cell and trim
      const values = await Promise.all(cells.map(async cell => (await (await cell.getProperty('textContent')).jsonValue()).trim()));
      // Map to expected fields: Op#, Size, Capacity, Actual Cost, Credit
      const rec = {
        operation: Number(values[0]),
        size: Number(values[1]),
        capacity: Number(values[2]),
        actualCost: Number(values[3]),
        credit: Number(values[4])
      };
      records.push(rec);
    }
    return records;
  }
}

/**
 * Helper that computes the expected sequence of operations according to the page's algorithm.
 * This mirrors the logic in the page's updateDemo() function so we can assert DOM reflects it.
 *
 * @param {number} n - number of operations to simulate
 * @returns {Array<{operation:number,size:number,capacity:number,actualCost:number,credit:number}>}
 */
function computeExpectedSequence(n) {
  let capacity = 1;
  let size = 0;
  let credit = 0;
  let operations = 0;
  const seq = [];

  for (let i = 0; i < n; i++) {
    let resizeCost = 0;
    if (size === capacity) {
      resizeCost = capacity;
      capacity *= 2;
      // amortizedCost assignment in page does not affect our expected actualCost
      // newCredit = credit + 2 - resizeCost
      credit = credit + 2 - resizeCost;
    } else {
      credit = credit + 2;
    }
    size++;
    operations++;
    const actualCost = 1 + resizeCost;
    seq.push({
      operation: operations,
      size,
      capacity,
      actualCost,
      credit
    });
  }
  return seq;
}

test.describe('Amortized Analysis Interactive Demo - FSM validation', () => {
  // Containers for capturing console messages and page errors per test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors so tests can assert them later
    page.on('console', msg => {
      // Capture console messages with type, text and location
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location()
      });
    });

    page.on('pageerror', error => {
      // Capture unhandled exceptions (ReferenceError, TypeError, etc.)
      pageErrors.push(error);
    });

    // Navigate to the app (do not modify the page or environment)
    const demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // teardown is implicit; listeners bound to page will be disposed with the page fixture
    // Keep arrays for assertions inside tests themselves
  });

  test('Initial State (S0_Idle): button present, demo output hidden', async ({ page }) => {
    const demo = new DemoPage(page);

    // Validate that the demo button exists and is visible
    const button = await page.$(demo.demoButton);
    expect(button).not.toBeNull();
    await expect(page.locator(demo.demoButton)).toBeVisible();

    // Validate demoOutput is present but hidden by default (display: none)
    await page.waitForSelector(demo.demoOutput);
    const display = await page.$eval(demo.demoOutput, el => window.getComputedStyle(el).display);
    expect(display).toBe('none');

    // Validate demoContent is present but empty
    const contentHTML = await demo.getDemoContentHTML();
    expect(contentHTML.trim()).toBe('');

    // Ensure that no uncaught page errors have happened on initial load
    expect(pageErrors.length).toBe(0);

    // Ensure no console error-level messages were emitted on load
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('PerformInsert event transitions to S1_Inserted on first click: DOM updates and history row', async ({ page }) => {
    const demo = new DemoPage(page);

    // Click the insert button once to trigger the transition
    await demo.clickInsert(1);

    // After click, demoOutput should be displayed (entry action: updateDemo sets display = 'block')
    expect(await demo.isOutputVisible()).toBe(true);

    // The demoContent should contain the summary details and a history table with 1 row
    const html = await demo.getDemoContentHTML();
    expect(html).toContain('Inserting element 1');
    expect(html).toContain('Actual cost: 1');

    // The page's visible leading paragraph prints "Operation ${state.operations}:" BEFORE operations increment.
    // Based on the implementation, the first printed "Operation" will be 0 (quirk of ordering in code).
    expect(html).toContain('Operation 0:');

    // Validate the history table contains exactly one recorded operation and values match algorithm expectations
    const records = await demo.getHistoryRecords();
    expect(records.length).toBe(1);
    const expected = computeExpectedSequence(1)[0];
    expect(records[0]).toEqual(expected);

    // Verify no uncaught JS errors occurred during the click
    expect(pageErrors.length).toBe(0);

    // Verify no console error-level messages were emitted during the interaction
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Multiple insertions and resizes: validate capacities, sizes, actual costs and credits', async ({ page }) => {
    const demo = new DemoPage(page);

    // We'll perform 5 insertions to trigger multiple resizes (resizes expected at operations 2, 3, and 5 according to logic)
    const clicks = 5;
    await demo.clickInsert(clicks);

    // Confirm demo output visible
    expect(await demo.isOutputVisible()).toBe(true);

    // Extract history records and compare to expected sequence computed locally
    const records = await demo.getHistoryRecords();
    expect(records.length).toBe(clicks);

    const expectedSeq = computeExpectedSequence(clicks);

    // Compare each record thoroughly
    for (let i = 0; i < clicks; i++) {
      const actual = records[i];
      const expected = expectedSeq[i];

      // Provide clear assertion messages by using expect with detailed mismatch help
      expect(actual.operation, `operation number for row ${i + 1}`).toBe(expected.operation);
      expect(actual.size, `size for op ${expected.operation}`).toBe(expected.size);
      expect(actual.capacity, `capacity for op ${expected.operation}`).toBe(expected.capacity);
      expect(actual.actualCost, `actualCost for op ${expected.operation}`).toBe(expected.actualCost);
      expect(actual.credit, `credit for op ${expected.operation}`).toBe(expected.credit);
    }

    // Check the content also mentions "Resize occurred!" for operations where resizeCost > 0.
    const contentHTML = await demo.getDemoContentHTML();
    for (let i = 0; i < clicks; i++) {
      const resizeOccurred = expectedSeq[i].actualCost > 1;
      if (resizeOccurred) {
        expect(contentHTML).toContain('Resize occurred!');
      }
    }

    // Ensure no uncaught errors occurred during multiple interactions
    expect(pageErrors.length).toBe(0);

    // Also ensure console didn't emit error-level messages
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Edge case: many insertions keep credit non-negative and capacities double as expected', async ({ page }) => {
    const demo = new DemoPage(page);

    // Perform 12 insertions to force several resizes and observe growth pattern
    const clicks = 12;
    await demo.clickInsert(clicks);

    const records = await demo.getHistoryRecords();
    expect(records.length).toBe(clicks);

    // Validate doubling behavior: capacities should be powers of two as they grow
    // Build array of capacities and ensure each capacity is a power of two and non-decreasing
    const capacities = records.map(r => r.capacity);
    for (let i = 0; i < capacities.length; i++) {
      const c = capacities[i];
      // power of two check: c & (c-1) === 0
      expect((c & (c - 1)) === 0, `capacity ${c} at op ${i + 1} should be power of two`).toBe(true);
      if (i > 0) {
        expect(c).toBeGreaterThanOrEqual(capacities[i - 1]);
      }
    }

    // Ensure credit is never negative
    for (const rec of records) {
      expect(rec.credit, `credit for op ${rec.operation}`).toBeGreaterThanOrEqual(0);
    }

    // No uncaught errors should have occurred
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Observability: capture and assert console and page errors behavior (no injected modifications)', async ({ page }) => {
    const demo = new DemoPage(page);

    // No interactions - just ensure the environment remains stable and no ReferenceError/SyntaxError/TypeError occurred
    // This complies with the instruction to observe console logs and page errors and assert their presence/absence
    // (We assert that no such fatal runtime errors occurred naturally.)
    await demo.goto();

    // Give a short time to capture any async page errors if they occur
    await page.waitForTimeout(200);

    // Assert there are no page errors
    if (pageErrors.length > 0) {
      // If there are errors, fail the test and provide diagnostics
      const diagnostics = pageErrors.map(e => e.stack || e.message).join('\n---\n');
      throw new Error(`Unexpected page errors detected:\n${diagnostics}`);
    }

    // Assert console has no error-level messages
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    if (errorConsoleMessages.length > 0) {
      const messages = errorConsoleMessages.map(m => `${m.text} @ ${JSON.stringify(m.location)}`).join('\n');
      throw new Error(`Unexpected console error messages:\n${messages}`);
    }

    // For completeness, assert there is at least the demo button console presence as informational check
    expect(await page.$(demo.demoButton)).not.toBeNull();
  });
});