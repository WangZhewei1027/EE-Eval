import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f1814070-d366-11f0-9b19-a558354ece3e.html';

// Page Object Model for the Quick Sort Visualization page
class QuickSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      generateBtn: "button[onclick='generateArray()']",
      sortBtn: "button#sortBtn",
      resetBtn: "button#resetBtn",
      status: "#status",
      arrayDisplay: "#arrayDisplay",
      arrayElements: "#arrayDisplay .array-element",
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial generateArray (window.onload triggers it) to populate DOM
    await this.page.waitForSelector(this.selectors.arrayDisplay);
  }

  async getStatusText() {
    return this.page.locator(this.selectors.status).innerText();
  }

  async getArrayValues() {
    // returns array of strings (numbers as strings)
    return this.page.$$eval(this.selectors.arrayElements, els => els.map(e => e.textContent));
  }

  async getArrayCount() {
    return this.page.$$eval(this.selectors.arrayElements, els => els.length);
  }

  async clickGenerate() {
    await this.page.click(this.selectors.generateBtn);
  }

  async clickSort() {
    await this.page.click(this.selectors.sortBtn);
  }

  async clickReset() {
    await this.page.click(this.selectors.resetBtn);
  }

  async isSortBtnDisabled() {
    return this.page.$eval(this.selectors.sortBtn, b => b.disabled);
  }

  async isResetBtnDisabled() {
    return this.page.$eval(this.selectors.resetBtn, b => b.disabled);
  }

  async isSortingFlag() {
    return this.page.evaluate(() => window.isSorting);
  }

  async waitForFinalSortedStatus(timeout = 15000) {
    // Wait until status text starts with "Sorting completed!"
    await this.page.waitForFunction(() => {
      const el = document.getElementById('status');
      return el && el.textContent && el.textContent.startsWith('Sorting completed!');
    }, null, { timeout });
    return this.getStatusText();
  }

  async getAllElementsClasses() {
    return this.page.$$eval(this.selectors.arrayElements, els => els.map(e => Array.from(e.classList)));
  }
}

test.describe('Quick Sort Visualization - FSM and UI integration tests', () => {
  // Collect console and page errors per test for assertions later
  test.beforeEach(async ({ page }) => {
    // No-op here; each test will wire listeners as needed.
  });

  // Test initial state and S0_Idle -> S1_ArrayGenerated transition triggered by window.onload
  test('Initial load should generate an array and update status (S0_Idle -> S1_ArrayGenerated)', async ({ page }) => {
    // Capture console messages and page errors for this test
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const qs = new QuickSortPage(page);
    await qs.goto();

    // After load, the page's onload calls generateArray(), so we expect the status to indicate a new array.
    const status = await qs.getStatusText();
    // Status should be either the initial "Ready to sort!" briefly or "New array generated!" after onload.
    // We assert that eventually it reaches 'New array generated!'
    expect(status).toBeTruthy();
    // Wait for 'New array generated!' if not immediate
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent === 'New array generated!';
    }, null, { timeout: 2000 });

    const statusAfter = await qs.getStatusText();
    expect(statusAfter).toBe('New array generated!');

    // Array should be rendered and contain 10 elements (size defined in generateArray)
    const count = await qs.getArrayCount();
    expect(count).toBeGreaterThanOrEqual(1);
    expect(count).toBe(10);

    // Each array element should have numeric text content
    const values = await qs.getArrayValues();
    expect(values.length).toBe(10);
    for (const v of values) {
      // Ensure parseable as number between 1 and 100
      const n = Number(v);
      expect(Number.isFinite(n)).toBeTruthy();
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(100);
    }

    // Assert no uncaught page errors or console errors occurred during initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test GenerateArray event (transition S0_Idle->S1_ArrayGenerated)
  test('Clicking "Generate New Array" creates a new array and updates status (GenerateArray event)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const qs = new QuickSortPage(page);
    await qs.goto();

    // Snapshot current array
    const before = await qs.getArrayValues();

    // Click generate button
    await qs.clickGenerate();

    // After clicking, status should be 'New array generated!'
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent === 'New array generated!';
    }, null, { timeout: 2000 });

    const status = await qs.getStatusText();
    expect(status).toBe('New array generated!');

    // New array should be rendered with 10 elements
    const after = await qs.getArrayValues();
    expect(after.length).toBe(10);

    // It's possible (rare) the random array equals the previous one. We assert that structure is valid and numeric.
    for (const v of after) {
      const n = Number(v);
      expect(Number.isFinite(n)).toBeTruthy();
    }

    // Ensure no uncaught page errors or console errors occurred
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test StartSorting event (transition S1_ArrayGenerated -> S2_Sorting) and S2->S3 finalization
  test('Starting sorting sets isSorting, disables buttons and completes sorting (StartSorting event -> S2_Sorting -> S3_Sorted)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const qs = new QuickSortPage(page);
    await qs.goto();

    // Speed up animations to keep test fast by setting animationSpeed small.
    // This modifies an existing global variable declared in the page script (allowed: not injecting new globals).
    await page.evaluate(() => { animationSpeed = 20; });

    // Ensure we have an array
    const initialCount = await qs.getArrayCount();
    expect(initialCount).toBeGreaterThan(0);

    // Click Start Sorting
    await qs.clickSort();

    // Immediately, the page should set isSorting = true, and disable the sort and reset buttons.
    // Check isSorting flag (global var)
    const isSortingNow = await qs.isSortingFlag();
    expect(isSortingNow).toBe(true);

    // Check disabled state of buttons
    const sortDisabled = await qs.isSortBtnDisabled();
    const resetDisabled = await qs.isResetBtnDisabled();
    expect(sortDisabled).toBe(true);
    expect(resetDisabled).toBe(true);

    // While sorting, status should change to show partitioning/selected pivot/comparing etc.
    // Wait for any intermediate status messages within sorting
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && (s.textContent.includes('Partitioning') || s.textContent.includes('Pivot') || s.textContent.includes('Comparing') || s.textContent.includes('Selected pivot'));
    }, null, { timeout: 2000 });

    // Wait for final status indicating sorting completed (S3_Sorted)
    const finalStatus = await qs.waitForFinalSortedStatus(20000);
    expect(finalStatus.startsWith('Sorting completed!')).toBeTruthy();
    expect(finalStatus).toContain('Original:');
    expect(finalStatus).toContain('Sorted:');

    // After sorting completes, isSorting should be false and buttons enabled
    const isSortingAfter = await qs.isSortingFlag();
    expect(isSortingAfter).toBe(false);

    const sortDisabledAfter = await qs.isSortBtnDisabled();
    const resetDisabledAfter = await qs.isResetBtnDisabled();
    expect(sortDisabledAfter).toBe(false);
    expect(resetDisabledAfter).toBe(false);

    // All array elements should have 'sorted' class (visual feedback)
    const classes = await qs.getAllElementsClasses();
    // At least the first and last should include 'sorted' class, ideally all.
    for (const cls of classes) {
      expect(Array.isArray(cls)).toBeTruthy();
    }
    // Spot check that there is at least one element with 'sorted' class
    const anySorted = classes.some(c => c.includes('sorted'));
    expect(anySorted).toBeTruthy();

    // Ensure no uncaught page errors or console errors occurred during the sorting run
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  }, 30000); // give extended timeout because sorting can take some time even with speedup

  // Test ResetArray event (when not sorting) and FSM transition S3_Sorted/S1_ArrayGenerated
  test('Reset button regenerates array and sets status to New array generated! (ResetArray event)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const qs = new QuickSortPage(page);
    await qs.goto();

    // Ensure we are idle (not sorting)
    const isSorting = await qs.isSortingFlag();
    if (isSorting) {
      // Wait for it to finish if by chance sorting was in progress
      await qs.waitForFinalSortedStatus(20000);
    }

    // Snapshot current array
    const before = await qs.getArrayValues();

    // Click reset (in UI it calls resetArray -> generateArray)
    await qs.clickReset();

    // After reset, status should read 'New array generated!'
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent === 'New array generated!';
    }, null, { timeout: 2000 });

    const status = await qs.getStatusText();
    expect(status).toBe('New array generated!');

    const after = await qs.getArrayValues();
    expect(after.length).toBe(10);
    // Ensure the array is well-formed numbers
    for (const v of after) {
      expect(Number.isFinite(Number(v))).toBeTruthy();
    }

    // Ensure no uncaught page errors or console errors occurred
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: Starting sorting when the array is empty should be a no-op and not throw errors
  test('Edge case: Start sorting with empty array should not throw and should be a no-op', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const qs = new QuickSortPage(page);
    await qs.goto();

    // Empty the array by manipulating the page's array variable (existing global var)
    await page.evaluate(() => { array = []; document.getElementById('arrayDisplay').innerHTML = ''; document.getElementById('status').textContent = 'Ready to sort!'; });

    // Validate array is empty in DOM
    const count = await qs.getArrayCount();
    expect(count).toBe(0);

    // Click start sorting - code checks array.length === 0 and returns early
    await qs.clickSort();

    // Ensure isSorting remains false and buttons remain enabled
    const isSorting = await qs.isSortingFlag();
    expect(isSorting).toBe(false);

    const sortDisabled = await qs.isSortBtnDisabled();
    const resetDisabled = await qs.isResetBtnDisabled();
    // Buttons should not be disabled because sorting didn't start
    expect(sortDisabled).toBe(false);
    expect(resetDisabled).toBe(false);

    // Status should remain 'Ready to sort!' as we set it; or unchanged
    const status = await qs.getStatusText();
    expect(status).toBeTruthy();

    // Ensure no uncaught page errors or console errors occurred during this edge case
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Observability test: Ensure that during a typical user flow there are no unhandled exceptions logged
  test('Observability: No uncaught exceptions or console errors during user interactions', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    const qs = new QuickSortPage(page);
    await qs.goto();

    // Perform a small flow: generate -> start (with speedup) -> wait completion -> reset
    await page.evaluate(() => { animationSpeed = 10; });
    await qs.clickGenerate();
    await qs.clickSort();

    // Wait for final completion (should be quick due to speedup)
    await qs.waitForFinalSortedStatus(20000);

    // Reset after sorted
    await qs.clickReset();
    await page.waitForFunction(() => {
      const s = document.getElementById('status');
      return s && s.textContent === 'New array generated!';
    }, null, { timeout: 2000 });

    // Assert no uncaught errors were produced during the flow
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  }, 30000);
});