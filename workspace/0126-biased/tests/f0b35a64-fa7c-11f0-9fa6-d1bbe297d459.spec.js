import { test, expect } from '@playwright/test';

// Page Object Model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = "button[onclick='runFCFSDemo()']";
    this.outputSelector = '#demoOutput';
    this.processTableSelector = '.process-table';
  }

  async goto(url) {
    await this.page.goto(url, { waitUntil: 'load' });
  }

  async waitForRunButton() {
    await this.page.waitForSelector(this.runButton, { state: 'visible' });
  }

  async clickRunButton() {
    await this.page.click(this.runButton);
  }

  async getOutputHTML() {
    return await this.page.$eval(this.outputSelector, el => el.innerHTML);
  }

  async getOutputText() {
    return await this.page.$eval(this.outputSelector, el => el.textContent);
  }

  async hasProcessTable() {
    return await this.page.$(this.processTableSelector) !== null;
  }

  async getProcessTableRowCount() {
    const table = await this.page.$(this.processTableSelector);
    if (!table) return 0;
    return await table.$$eval('tr', trs => trs.length);
  }
}

// URL under test (as specified)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b35a64-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('CPU Scheduling Demo - FSM validation and interactive tests', () => {
  // Arrays to collect console errors and page errors per test
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions / unhandled rejection errors from the page
    page.on('pageerror', err => {
      // err is an Error object from the page context
      pageErrors.push(err);
    });

    // Navigate to the page for each test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No global teardown required; listeners are scoped to the page and removed automatically
  });

  test('Initial Idle state: page renders and shows Run FCFS Demo button and empty output', async ({ page }) => {
    // This test validates the Idle (S0_Idle) state per the FSM:
    // - The page should render
    // - The "Run FCFS Demo" button should be present
    // - The demo output container should exist and initially be empty
    const demo = new DemoPage(page);

    // Ensure the run button is visible
    await demo.waitForRunButton();
    const btn = await page.$(demo.runButton);
    expect(btn).not.toBeNull();

    // The button should have the expected label text
    const btnText = await btn!.innerText();
    expect(btnText.trim()).toBe('Run FCFS Demo');

    // The demo output area should exist
    const outputEl = await page.$(demo.outputSelector);
    expect(outputEl).not.toBeNull();

    // The demo output should be empty or contain only whitespace initially
    const outputText = await demo.getOutputText();
    expect(outputText.trim()).toBe('');

    // There should be no console.error or uncaught page errors on initial render
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Transition: clicking Run FCFS Demo moves to FCFS Demo Running state and shows expected content', async ({ page }) => {
    // This test validates the event/transition in the FSM:
    // - Clicking the button triggers runFCFSDemo()
    // - The demo output gets the FCFS paragraph, a process table, and average values
    const demo = new DemoPage(page);

    await demo.waitForRunButton();

    // Click the Run FCFS Demo button to trigger the demo
    await demo.clickRunButton();

    // After clicking, the demoOutput should include the introductory paragraph
    await page.waitForSelector(`${demo.outputSelector} p`); // wait for at least one paragraph
    const outputHTML = await demo.getOutputHTML();
    expect(outputHTML).toContain('First-Come, First-Served Scheduling Example:');

    // The process table should be present with header + 3 rows (3 processes)
    const hasTable = await demo.hasProcessTable();
    expect(hasTable).toBe(true);

    const rowCount = await demo.getProcessTableRowCount();
    // 1 header row + 3 process rows = 4
    expect(rowCount).toBe(4);

    // Validate specific computed values from the FCFS simulation:
    // Processes: P1 burst 10 -> completion 10; P2 burst 5 -> completion 15; P3 burst 8 -> completion 23
    const tableText = await page.$eval('.process-table', table => table.textContent || '');
    expect(tableText).toContain('P1');
    expect(tableText).toContain('10'); // P1 burst time and its completion
    expect(tableText).toContain('15'); // completion time for P2
    expect(tableText).toContain('23'); // completion time for P3

    // The output should include average waiting time and average turnaround time lines
    expect(outputHTML).toMatch(/Average Waiting Time:\s*\d+(\.\d+)?/);
    expect(outputHTML).toMatch(/Average Turnaround Time:\s*\d+(\.\d+)?/);

    // Ensure no console errors or page errors were produced by the normal demo run
    expect(consoleErrors, 'No console.error expected after running demo').toEqual([]);
    expect(pageErrors, 'No uncaught page errors expected after running demo').toEqual([]);
  });

  test('Idempotency: running the demo multiple times replaces previous output rather than appending duplicate tables', async ({ page }) => {
    // Validate that subsequent executions of runFCFSDemo produce a single updated output
    const demo = new DemoPage(page);
    await demo.waitForRunButton();

    // Run the demo twice
    await demo.clickRunButton();
    // Wait for table to be present
    await page.waitForSelector(demo.processTableSelector);

    // Capture number of tables after first run
    let tableCount = await page.$$eval(demo.processTableSelector, els => els.length);
    expect(tableCount).toBe(1);

    // Run again
    await demo.clickRunButton();
    // Wait briefly to allow DOM update
    await page.waitForTimeout(200);

    // Ensure still exactly one table exists (output was replaced, not appended)
    tableCount = await page.$$eval(demo.processTableSelector, els => els.length);
    expect(tableCount).toBe(1);

    // Output should still contain the expected average metrics
    const outputHTML = await demo.getOutputHTML();
    expect(outputHTML).toContain('Average Waiting Time:');
    expect(outputHTML).toContain('Average Turnaround Time:');

    // No console or page errors expected for repeated runs
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Edge case: if demo output container is removed, running demo triggers a TypeError (observed as page error)', async ({ page }) => {
    // This test intentionally removes the #demoOutput element before clicking the button
    // to validate error handling and to assert that runtime errors from the page are observed.
    // We do not patch page functions; we merely mutate the DOM and let the page code run naturally.

    const demo = new DemoPage(page);
    await demo.waitForRunButton();

    // Remove the demoOutput element from the DOM to simulate a missing element edge case
    await page.evaluate(() => {
      const el = document.getElementById('demoOutput');
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });

    // Confirm the element is removed
    const existsAfterRemoval = await page.$(demo.outputSelector);
    expect(existsAfterRemoval).toBeNull();

    // Click the run button - the inline function will attempt to access the missing element
    // and should throw a TypeError when trying to set innerHTML on null.
    await demo.clickRunButton();

    // Wait for a pageerror to be emitted. The pageerror handler pushes into pageErrors array.
    // Give some time for the error to propagate.
    await page.waitForTimeout(200);

    // Expect at least one page error resulting from the missing element (TypeError).
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Inspect the first error message to ensure it's consistent with trying to set innerHTML on null
    const firstErrorMessage = pageErrors[0].message;
    const matching = /innerHTML|Cannot set property|Cannot set properties of null|null.*\.innerHTML/i;
    expect(firstErrorMessage).toMatch(matching);

    // Also, console.error may capture messages depending on the browser; ensure at least one error
    // was emitted to the console or page errors captured it.
    expect(consoleErrors.length + pageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Robustness: page should not have unexpected global JS errors on repeated navigation', async ({ page }) => {
    // This test navigates away and back to ensure the page loads cleanly multiple times
    // and that no residual errors accumulate in the environment.
    const demo = new DemoPage(page);

    for (let i = 0; i < 2; i++) {
      await page.goto(APP_URL, { waitUntil: 'load' });
      await demo.waitForRunButton();
      // A quick click to ensure event handlers are functional
      await demo.clickRunButton();
      await page.waitForSelector(demo.processTableSelector);
    }

    // After repeated loads and runs, assert that there are no uncaught page errors
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});