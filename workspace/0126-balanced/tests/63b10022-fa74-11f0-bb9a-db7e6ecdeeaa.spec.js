import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b10022-fa74-11f0-bb9a-db7e6ecdeeaa.html';

/**
 * Page Object for the Merge Sort Visualization page.
 * Encapsulates common interactions and queries.
 */
class MergeSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arraySize = page.locator('#arraySize');
    this.generateBtn = page.locator('#generateBtn');
    this.sortBtn = page.locator('#sortBtn');
    this.arrayContainer = page.locator('#arrayContainer');
    this.barSelector = '#arrayContainer .bar';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getArraySizeValue() {
    const val = await this.arraySize.inputValue();
    return parseInt(val, 10);
  }

  async setArraySize(value) {
    await this.arraySize.fill(String(value));
  }

  async clickGenerate() {
    await this.generateBtn.click();
  }

  async clickSort() {
    await this.sortBtn.click();
  }

  async getBars() {
    return await this.page.$$(this.barSelector);
  }

  async getBarCount() {
    return (await this.getBars()).length;
  }

  async countBarsWithClass(className) {
    return await this.page.locator(`${this.barSelector}.${className}`).count();
  }

  async anyBarHasClass(className) {
    const count = await this.countBarsWithClass(className);
    return count > 0;
  }

  async allBarsHaveClass(className) {
    const total = await this.getBarCount();
    if (total === 0) return false;
    const classCount = await this.countBarsWithClass(className);
    return classCount === total;
  }

  async isGenerateDisabled() {
    return await this.generateBtn.isDisabled();
  }

  async isSortDisabled() {
    return await this.sortBtn.isDisabled();
  }

  async isArraySizeDisabled() {
    return await this.arraySize.isDisabled();
  }
}

test.describe('Merge Sort Visualization - FSM states and transitions', () => {
  // Collect console errors and page errors during each test for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // store console messages with type for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('S0_Idle - Initial page load should render array via renderArray() (initial state)', async ({ page }) => {
    const p = new MergeSortPage(page);

    // Navigate to the app URL - init() is called on window.onload in the page
    await p.goto();

    // Wait for bars to be rendered (renderArray called on load)
    await page.waitForSelector('#arrayContainer .bar', { timeout: 5000 });

    // The number of bars should equal the array size input's value (default 20)
    const inputSize = await p.getArraySizeValue();
    const barsCount = await p.getBarCount();
    // Validate initial state: array rendered and length matches input's default
    expect(barsCount).toBe(inputSize);

    // Bars should be present with titles (the numeric values)
    const bars = await p.getBars();
    for (const barHandle of bars.slice(0, Math.min(5, bars.length))) {
      const title = await barHandle.getAttribute('title');
      expect(title).toBeTruthy(); // ensure numeric title exists
      const height = await barHandle.evaluate((b) => b.style.height);
      expect(height).toMatch(/px$/);
    }

    // Ensure no uncaught page errors occurred during initial load
    expect(pageErrors.length, 'There should be no page errors on initial load').toBe(0);

    // Ensure console has no messages of level 'error'
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, 'There should be no console errors on initial load').toBe(0);
  });

  test('S0_Idle -> S1_ArrayGenerated - Clicking "Generate New Array" regenerates array with requested size', async ({ page }) => {
    const p1 = new MergeSortPage(page);
    await p.goto();

    // Change the array size to a smaller number and generate
    await p.setArraySize(10);
    await p.clickGenerate();

    // Wait for new bars to render and assert the count matches requested size
    await page.waitForSelector('#arrayContainer .bar', { timeout: 5000 });
    const barsCount1 = await p.getBarCount();
    expect(barsCount).toBe(10);

    // Newly generated bars should be in default (unsorted) visual state: class 'bar' present, no 'finished' initially
    const finishedCount = await p.countBarsWithClass('finished');
    expect(finishedCount, 'No bars should be marked finished immediately after generation').toBe(0);

    // Ensure controls remain enabled after generation
    expect(await p.isGenerateDisabled()).toBe(false);
    expect(await p.isSortDisabled()).toBe(false);
    expect(await p.isArraySizeDisabled()).toBe(false);

    // Validate no page errors during generation
    const pageErrorDuringGenerate = pageErrors.length;
    expect(pageErrorDuringGenerate, 'There should be no page errors when generating array').toBe(0);

    // No console errors either
    const consoleErrors1 = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, 'There should be no console errors when generating array').toBe(0);
  });

  test('S1_ArrayGenerated -> S2_Sorting -> S3_Sorted - Starting merge sort disables controls, shows merging/highlight states, and finishes sorted', async ({ page }) => {
    const p2 = new MergeSortPage(page);
    await p.goto();

    // Use a small array to keep the sort time reasonable in test
    const size = 6;
    await p.setArraySize(size);
    await p.clickGenerate();

    // Ensure array of requested size is present
    await page.waitForSelector('#arrayContainer .bar', { timeout: 5000 });
    expect(await p.getBarCount()).toBe(size);

    // Start sorting
    const waitForDisabled = Promise.all([
      // clicking should immediately disable controls (setControlsDisabled(true) executed before awaiting mergeSortVisual)
      p.clickSort(),
      page.waitForTimeout(50) // brief small wait to ensure handler runs
    ]);

    await waitForDisabled;

    // Controls should be disabled while sorting is in progress
    expect(await p.isGenerateDisabled(), 'Generate should be disabled during sorting').toBe(true);
    expect(await p.isSortDisabled(), 'Sort should be disabled during sorting').toBe(true);
    expect(await p.isArraySizeDisabled(), 'Array size input should be disabled during sorting').toBe(true);

    // During sorting, we expect to see either 'merging' or 'highlight' class at some point
    // Wait up to 10s for at least one visual indicator of activity
    const indicator = await page.waitForSelector('#arrayContainer .bar.merging, #arrayContainer .bar.highlight', { timeout: 10000 });
    expect(indicator, 'There should be a merging or highlight bar during sorting').toBeTruthy();

    // Wait for sorting to complete: the page code re-enables controls at the end.
    // Use a larger timeout because sorting includes sleeps.
    await expect(p.sortBtn).toBeEnabled({ timeout: 30000 });

    // All bars should now have the 'finished' class indicating final sorted state
    const totalBars = await p.getBarCount();
    const finishedBars = await p.countBarsWithClass('finished');
    expect(finishedBars, 'All bars should be marked finished after sorting').toBe(totalBars);

    // Controls should be re-enabled after sorting completes
    expect(await p.isGenerateDisabled(), 'Generate should be enabled after sorting completes').toBe(false);
    expect(await p.isSortDisabled(), 'Sort should be enabled after sorting completes').toBe(false);
    expect(await p.isArraySizeDisabled(), 'Array size input should be enabled after sorting completes').toBe(false);

    // Verify final renderArray({}, {}, finished) was called effectively by presence of 'finished' classes.
    expect(await p.allBarsHaveClass('finished')).toBe(true);

    // Ensure no uncaught page errors occurred during sorting
    expect(pageErrors.length, 'There should be no page errors during sorting').toBe(0);

    // Ensure no console errors during the full sort lifecycle
    const consoleErrors2 = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, 'There should be no console errors during sorting').toBe(0);
  }, 45000); // increased timeout for sorting test

  test('Edge Case: Invalid array size should show alert and NOT regenerate array', async ({ page }) => {
    const p3 = new MergeSortPage(page);
    await p.goto();

    // Capture current bars count to compare after invalid input
    await page.waitForSelector('#arrayContainer .bar');
    const originalCount = await p.getBarCount();

    // Prepare to handle the alert dialog triggered by invalid size
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog', { timeout: 2000 }),
      (async () => {
        // Enter invalid size below minimum and click generate
        await p.setArraySize(3);
        await p.clickGenerate();
      })()
    ]);

    // Validate the alert message
    expect(dialog).toBeTruthy();
    expect(dialog.type()).toBe('alert');
    const message = dialog.message();
    expect(message).toContain('Please enter a valid array size between 5 and 50.');

    // Accept the dialog to proceed
    await dialog.accept();

    // Ensure the array was not regenerated to an invalid size; count remains unchanged
    const countAfterInvalid = await p.getBarCount();
    expect(countAfterInvalid).toBe(originalCount);

    // No page errors expected during this edge case
    expect(pageErrors.length).toBe(0);

    // No console errors either
    const consoleErrors3 = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Observability: Collect and assert there are no unexpected console errors or uncaught exceptions during typical flows', async ({ page }) => {
    const p4 = new MergeSortPage(page);
    await p.goto();

    // Perform a generate and a quick sort on a small array to capture any runtime errors
    await p.setArraySize(5);
    await p.clickGenerate();
    await page.waitForSelector('#arrayContainer .bar');

    // Start sort and wait for completion
    await p.clickSort();
    await expect(p.sortBtn).toBeEnabled({ timeout: 30000 });

    // After interactions, assert that no page errors or console errors were recorded
    expect(pageErrors.length, 'No uncaught exceptions should have been thrown during interactions').toBe(0);
    const consoleErrors4 = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length, 'No console errors should be present after interactions').toBe(0);
  }, 40000);
});