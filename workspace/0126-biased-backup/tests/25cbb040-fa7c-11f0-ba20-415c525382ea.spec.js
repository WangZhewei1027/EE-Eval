import { test, expect } from '@playwright/test';

// Test constants
const APP_URL =
  'http://127.0.0.1:5500/workspace/0126-biased/html/25cbb040-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo page
class AmortizedDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.simulateBtn = '#simulateBtn';
    this.output = '#demoResult';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickSimulate() {
    await this.page.click(this.simulateBtn);
  }

  async getOutputText() {
    return await this.page.$eval(this.output, (el) => el.textContent || '');
  }

  // Parse the output into header and data rows
  // Returns { headerLines: string[], dataRows: string[] }
  async parseOutput() {
    const raw = await this.getOutputText();
    const lines = raw.split(/\r?\n/).map((l) => l.trimEnd());
    // The implementation writes 2 header lines, then a separator, then data rows.
    // We'll locate the separator line (----) to find the start of data rows.
    const sepIndex = lines.findIndex((l) => l.startsWith('---'));
    const headerLines = sepIndex >= 0 ? lines.slice(0, sepIndex) : [];
    const dataRows = sepIndex >= 0 ? lines.slice(sepIndex + 1).filter((l) => l.trim() !== '') : [];
    return { headerLines, dataRows, raw };
  }

  // Extract flips counts from data rows. Each data row is expected to have three columns:
  // Increment, Counter (binary), Bits Flipped (separated by whitespace/tabs)
  extractFlipsFromRows(rows) {
    const flips = [];
    for (const row of rows) {
      // split by whitespace (tabs/spaces). Last token should be flips
      const tokens = row.split(/\s+/).filter(Boolean);
      if (tokens.length >= 1) {
        const last = tokens[tokens.length - 1];
        const num = parseInt(last, 10);
        if (!Number.isNaN(num)) flips.push(num);
      }
    }
    return flips;
  }
}

// Global helper: collect console messages and page errors for each test
test.describe('Amortized Analysis Demo - FSM and Interaction Tests', () => {
  // We'll set up the console and pageerror collectors in beforeEach for each test.
  test.beforeEach(async ({ page }) => {
    // Nothing special here; individual tests will attach listeners as needed.
  });

  // Test initial state: S0_Idle
  test('S0_Idle: Page renders and Idle state shows simulate button and empty result', async ({ page }) => {
    // Comment: Validate initial "Idle" state per FSM: renderPage() should run and button present.
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new AmortizedDemoPage(page);
    await demo.goto();

    // Assert simulate button exists and is visible
    const btn = await page.waitForSelector('#simulateBtn', { state: 'visible', timeout: 2000 });
    expect(btn).not.toBeNull();
    expect(await btn.textContent()).toContain('Simulate 10 Increments');

    // Assert output area exists and is initially empty (or whitespace)
    const outputEl = await page.waitForSelector('#demoResult', { state: 'attached', timeout: 2000 });
    const initialText = (await outputEl.textContent()) || '';
    expect(initialText.trim()).toBe('');

    // Assert no uncaught page errors occurred during initial render
    expect(pageErrors.length).toBe(0);
    // Assert no console.error messages occurred during initial render
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Test transition: S0_Idle -> S1_Simulating on SimulateIncrements event
  test('SimulateIncrements event transitions to S1_Simulating and produces correct output', async ({ page }) => {
    // Comment: Validate that clicking the simulate button triggers simulation (simulateIncrements())
    // and the output contains 10 increments, valid binary counters, and flips summing to <= 2*k.
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new AmortizedDemoPage(page);
    await demo.goto();

    // Click the simulate button and wait for output to be populated
    await demo.clickSimulate();

    // Wait for the output to contain at least one data row (the simulation is synchronous,
    // but we still guard with a short wait)
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.includes('1') && el.textContent.includes('0001');
      },
      demo.output,
      { timeout: 2000 }
    );

    const { headerLines, dataRows, raw } = await demo.parseOutput();

    // There should be header lines and 10 data rows per FSM description ("Simulate 10 Increments")
    expect(headerLines.length).toBeGreaterThanOrEqual(1);
    expect(dataRows.length).toBe(10);

    // Validate first data row corresponds to increment 1 and binary 0001 with flips = 1
    // Parsing tokens - flexible because whitespace/tabs are used.
    const firstRowTokens = dataRows[0].split(/\s+/).filter(Boolean);
    // first token should be "1" (increment number)
    expect(firstRowTokens[0]).toBe('1');
    // one of the tokens should be the binary representation '0001' for the first increment
    expect(firstRowTokens).toContain('0001');
    // last token should be flips count '1'
    const flipsFirst = parseInt(firstRowTokens[firstRowTokens.length - 1], 10);
    expect(flipsFirst).toBe(1);

    // Extract flips from all rows and compute sum
    const flips = demo.extractFlipsFromRows(dataRows);
    expect(flips.length).toBe(10);

    const sumFlips = flips.reduce((a, b) => a + b, 0);
    // As per aggregate analysis in the UI, total flips over k increments <= 2k
    expect(sumFlips).toBeLessThanOrEqual(2 * 10);

    // Verify each flips value is a positive integer between 1 and number of bits (4)
    for (const f of flips) {
      expect(Number.isInteger(f)).toBeTruthy();
      expect(f).toBeGreaterThanOrEqual(1);
      expect(f).toBeLessThanOrEqual(4);
    }

    // Ensure there were no unexpected global errors during simulation
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge cases and robustness tests
  test('Edge Case: Rapid double clicks produce stable output of 10 increments and no uncaught errors', async ({ page }) => {
    // Comment: Rapidly clicking the simulate button twice should leave the output in a consistent state.
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new AmortizedDemoPage(page);
    await demo.goto();

    // Rapid clicks: click twice quickly
    await Promise.all([page.click('#simulateBtn'), page.click('#simulateBtn')]);

    // Wait until demoResult contains 10 data rows
    await page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        if (!el || !el.textContent) return false;
        const lines = el.textContent.split(/\r?\n/);
        const sepIndex = lines.findIndex((l) => l.startsWith('---'));
        if (sepIndex < 0) return false;
        const dataRows = lines.slice(sepIndex + 1).filter((l) => l.trim() !== '');
        return dataRows.length === 10;
      },
      demo.output,
      { timeout: 2000 }
    );

    const { dataRows } = await demo.parseOutput();
    expect(dataRows.length).toBe(10);

    // Ensure the output corresponds to a fresh run (first row should be 0001)
    const firstRowTokens = dataRows[0].split(/\s+/).filter(Boolean);
    expect(firstRowTokens[0]).toBe('1');
    expect(firstRowTokens).toContain('0001');

    // No uncaught errors should have been thrown
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Re-running simulation replaces previous output and remains deterministic', async ({ page }) => {
    // Comment: Clicking simulate multiple times should reset the counter each run (deterministic behavior).
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const demo = new AmortizedDemoPage(page);
    await demo.goto();

    // First run
    await demo.clickSimulate();
    await page.waitForSelector('#demoResult');
    const firstRun = await demo.getOutputText();

    // Second run
    await demo.clickSimulate();
    const secondRun = await demo.getOutputText();

    // They should both contain 10 data rows and each should start with increment 1 => 0001
    const parse = (raw) => {
      const lines = raw.split(/\r?\n/);
      const sepIndex = lines.findIndex((l) => l.startsWith('---'));
      const rows = sepIndex >= 0 ? lines.slice(sepIndex + 1).filter((l) => l.trim() !== '') : [];
      return rows;
    };

    const rowsA = parse(firstRun);
    const rowsB = parse(secondRun);
    expect(rowsA.length).toBe(10);
    expect(rowsB.length).toBe(10);

    const firstRowA = rowsA[0].split(/\s+/).filter(Boolean);
    const firstRowB = rowsB[0].split(/\s+/).filter(Boolean);
    expect(firstRowA[0]).toBe('1');
    expect(firstRowB[0]).toBe('1');
    expect(firstRowA).toContain('0001');
    expect(firstRowB).toContain('0001');

    // Ensure outputs are strings and not identical if they contain time-dependent noise (they shouldn't here),
    // but the important part is determinism: both runs should start with same first-row values.
    expect(firstRowA[firstRowA.length - 1]).toBe(firstRowB[firstRowB.length - 1]);

    // No uncaught errors
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Additional negative test: ensure unknown selectors do not exist (validating DOM shape)
  test('DOM sanity checks: ensure expected components exist and unexpected elements are absent', async ({ page }) => {
    // Comment: Validate presence of expected components from FSM and that some unrelated IDs are not present.
    const demo = new AmortizedDemoPage(page);
    await demo.goto();

    // Expected components
    await expect(page.locator('#simulateBtn')).toBeVisible();
    await expect(page.locator('#demoResult')).toBeVisible();

    // Unexpected components (sanity): these IDs are not part of the given implementation
    await expect(page.locator('#nonExistentButton')).toHaveCount(0);
    await expect(page.locator('#errorLog')).toHaveCount(0);
  });
});