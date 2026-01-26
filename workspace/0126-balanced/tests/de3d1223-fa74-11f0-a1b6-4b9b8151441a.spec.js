import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d1223-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object for interacting with the Query Optimization demo
class QueryPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Unoptimized selectors
    this.unoptSearch = page.locator('#unopt-search');
    this.unoptRunBtn = page.locator('button[onclick="runUnoptimizedQuery()"]');
    this.unoptTime = page.locator('#unopt-time');
    this.unoptCount = page.locator('#unopt-results-count');
    this.unoptResults = page.locator('#unopt-results');

    // Optimized selectors
    this.optSearch = page.locator('#opt-search');
    this.optRunBtn = page.locator('button[onclick="runOptimizedQuery()"]');
    this.optTime = page.locator('#opt-time');
    this.optCount = page.locator('#opt-results-count');
    this.optResults = page.locator('#opt-results');

    // Columns
    this.unoptColumn = page.locator('.column.unoptimized');
    this.optColumn = page.locator('.column.optimized');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Run the unoptimized query (click the button)
  async runUnoptimized() {
    await this.unoptRunBtn.click();
  }

  // Run the optimized query (click the button)
  async runOptimized() {
    await this.optRunBtn.click();
  }

  // Set search input values
  async setUnoptimizedSearch(value) {
    await this.unoptSearch.fill(value);
  }
  async setOptimizedSearch(value) {
    await this.optSearch.fill(value);
  }

  // Helpers to get trimmed text values
  async getUnoptTimeText() {
    return (await this.unoptTime.textContent()).trim();
  }
  async getOptTimeText() {
    return (await this.optTime.textContent()).trim();
  }
  async getUnoptCountText() {
    return (await this.unoptCount.textContent()).trim();
  }
  async getOptCountText() {
    return (await this.optCount.textContent()).trim();
  }
  async getUnoptResultsText() {
    return (await this.unoptResults.textContent()).trim();
  }
  async getOptResultsText() {
    return (await this.optResults.textContent()).trim();
  }
}

test.describe('Query Optimization Demo - states and transitions', () => {
  // Arrays to capture console and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and errors
    page.on('console', (msg) => {
      const entry = { type: msg.type(), text: msg.text() };
      consoleMessages.push(entry);
      if (msg.type() === 'error') {
        consoleErrors.push(entry);
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    // Navigate to the app page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // After each test we assert that no uncaught page errors or console.error occurred.
    // This verifies the runtime executed without throwing unexpected exceptions.
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
  });

  test('Initial state: UI elements exist and show initial values', async ({ page }) => {
    // Validate the presence of main UI components and initial values for both states
    const q = new QueryPage(page);

    // Columns should have the expected classes indicating states
    await expect(q.unoptColumn).toBeVisible();
    await expect(q.optColumn).toBeVisible();

    // Verify column classes (visual hint)
    await expect(q.unoptColumn).toHaveClass(/unoptimized/);
    await expect(q.optColumn).toHaveClass(/optimized/);

    // Inputs and buttons exist
    await expect(q.unoptSearch).toBeVisible();
    await expect(q.optSearch).toBeVisible();
    await expect(q.unoptRunBtn).toBeVisible();
    await expect(q.optRunBtn).toBeVisible();

    // Initial execution times and counts should be "0 ms" and "0"
    await expect(q.unoptTime).toHaveText('0 ms');
    await expect(q.optTime).toHaveText('0 ms');
    await expect(q.unoptCount).toHaveText('0');
    await expect(q.optCount).toHaveText('0');
  });

  test('Console should show sample data generation log', async ({ page }) => {
    // Ensure the script ran the data generation (console.log in the page)
    const logs = consoleMessages.map((m) => m.text);
    const found = logs.some((t) => /Sample data generated with\s*\d+\s*products/i.test(t));
    expect(found, 'Expected console log about sample data generation').toBeTruthy();
  });

  test('Run unoptimized query without search updates execution time and results', async ({ page }) => {
    // This test validates the transition: S0_UnoptimizedQuery -> (RunUnoptimizedQuery) -> S0_UnoptimizedQuery
    // It checks time, results count, and displayed results are updated.
    const q = new QueryPage(page);

    // Confirm initial state
    await expect(q.unoptCount).toHaveText('0');

    // Run unoptimized query (empty search should return all products)
    await q.runUnoptimized();

    // Wait until the execution time updates from "0 ms"
    await expect(q.unoptTime).not.toHaveText('0 ms');

    // Result count should be numeric and expected 10000 (sample data generation creates 10000)
    const countText = await q.getUnoptCountText();
    // parse to int safely
    const count = parseInt(countText, 10);
    expect(Number.isFinite(count), 'Unoptimized results count should be a number').toBeTruthy();
    expect(count).toBeGreaterThanOrEqual(10000); // expect at least 10000 products (defensive: allow equal or greater)

    // Results pre should contain a JSON array start
    const resultsText = await q.getUnoptResultsText();
    expect(resultsText.startsWith('['), 'Unoptimized results area should display JSON array').toBeTruthy();

    // Running again should still update execution time (DOM update occurs)
    const prevTime = await q.getUnoptTimeText();
    await q.runUnoptimized();
    const newTime = await q.getUnoptTimeText();
    expect(newTime.length).toBeGreaterThan(0);
    // It's acceptable if time is the same (fast), but ensure it's formatted with ' ms'
    expect(newTime).toMatch(/\d+\.\d{2}\s*ms$/);
  });

  test('Run optimized query without search updates execution time and results', async ({ page }) => {
    // This test validates the transition: S1_OptimizedQuery -> (RunOptimizedQuery) -> S1_OptimizedQuery
    // It checks the optimized path properly returns results and updates the DOM.
    const q = new QueryPage(page);

    // Confirm initial state
    await expect(q.optCount).toHaveText('0');

    // Run optimized query (empty search)
    await q.runOptimized();

    // Execution time should update
    await expect(q.optTime).not.toHaveText('0 ms');

    // Result count should be numeric and expected 10000
    const optCountText = await q.getOptCountText();
    const optCount = parseInt(optCountText, 10);
    expect(Number.isFinite(optCount), 'Optimized results count should be a number').toBeTruthy();
    expect(optCount).toBeGreaterThanOrEqual(10000);

    // Results should be displayed (JSON array)
    const optResultsText = await q.getOptResultsText();
    expect(optResultsText.startsWith('['), 'Optimized results area should display JSON array').toBeTruthy();

    // Multiple runs should update DOM each time
    const prev = await q.getOptTimeText();
    await q.runOptimized();
    const next = await q.getOptTimeText();
    expect(next).toMatch(/\d+\.\d{2}\s*ms$/);
  });

  test('Search edge case: no matching results yields count 0 and empty JSON array for both queries', async ({ page }) => {
    // This test inputs a search string that does not exist and verifies both states handle zero results gracefully.
    const q = new QueryPage(page);

    // Use a likely unique string that is not present
    const uniqueTerm = 'NoSuchNameXYZ_ProbablyDoesNotExist_!@#';

    // Unoptimized path
    await q.setUnoptimizedSearch(uniqueTerm);
    await q.runUnoptimized();
    await expect(q.unoptCount).toHaveText('0');
    const unoptRes = await q.getUnoptResultsText();
    expect(unoptRes).toContain('[]');

    // Optimized path
    await q.setOptimizedSearch(uniqueTerm);
    await q.runOptimized();
    await expect(q.optCount).toHaveText('0');
    const optRes = await q.getOptResultsText();
    expect(optRes).toContain('[]');
  });

  test('Search with term yields results > 0 for both queries', async ({ page }) => {
    // This validates that a common term (like a brand name) returns some results in both implementations.
    const q = new QueryPage(page);

    // Brand names used in dataset include 'Acme', 'Globex', 'Soylent', 'Initech', 'Umbrella'
    const brand = 'Acme';

    // Unoptimized
    await q.setUnoptimizedSearch(brand);
    await q.runUnoptimized();
    const uCountText = await q.getUnoptCountText();
    const uCount = parseInt(uCountText, 10);
    expect(uCount).toBeGreaterThan(0);
    const uRes = await q.getUnoptResultsText();
    expect(uRes.startsWith('[')).toBeTruthy();

    // Optimized
    await q.setOptimizedSearch(brand);
    await q.runOptimized();
    const oCountText = await q.getOptCountText();
    const oCount = parseInt(oCountText, 10);
    expect(oCount).toBeGreaterThan(0);
    const oRes = await q.getOptResultsText();
    expect(oRes.startsWith('[')).toBeTruthy();
  });

  test('State invariants: clicking buttons without changing inputs does not navigate away (same state)', async ({ page }) => {
    // This test ensures repeated events keep the app in the same active states and update outputs.
    const q = new QueryPage(page);

    // Run unoptimized twice and ensure we remain in same DOM structure and values update
    await q.runUnoptimized();
    const time1 = await q.getUnoptTimeText();
    const count1 = await q.getUnoptCountText();
    await q.runUnoptimized();
    const time2 = await q.getUnoptTimeText();
    const count2 = await q.getUnoptCountText();

    expect(count2).toEqual(count1);
    expect(time2).toMatch(/\d+\.\d{2}\s*ms$/);

    // Run optimized twice
    await q.runOptimized();
    const oTime1 = await q.getOptTimeText();
    const oCount1 = await q.getOptCountText();
    await q.runOptimized();
    const oTime2 = await q.getOptTimeText();
    const oCount2 = await q.getOptCountText();

    expect(oCount2).toEqual(oCount1);
    expect(oTime2).toMatch(/\d+\.\d{2}\s*ms$/);
  });

  test('Robustness: ensure no unexpected console errors or runtime exceptions during interactions', async ({ page }) => {
    // This final test performs a series of interactions and then explicitly asserts there were no runtime errors.
    const q = new QueryPage(page);

    // Perform a sequence of interactions
    await q.setUnoptimizedSearch('Product 1');
    await q.runUnoptimized();

    await q.setOptimizedSearch('Product 2');
    await q.runOptimized();

    await q.setUnoptimizedSearch('');
    await q.runUnoptimized();

    // Inspect captured logs and errors
    const errorLogs = consoleMessages.filter(m => m.type === 'error');
    expect(errorLogs.length).toEqual(0);

    // Confirm pageerror list is empty (no uncaught exceptions)
    // NOTE: afterEach will also validate pageErrors is empty
    expect(pageErrors.length).toEqual(0);
  });
});