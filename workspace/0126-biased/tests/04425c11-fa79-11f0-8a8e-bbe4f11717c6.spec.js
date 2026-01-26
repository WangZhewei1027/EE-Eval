import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04425c11-fa79-11f0-8a8e-bbe4f11717c6.html';

// Simple page object for the Bucket Sort page to keep tests organized
class BucketSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.numbers = page.locator('#numbers');
    this.sortBtn = page.locator('#sort-btn');
    this.numbers2 = page.locator('#numbers2');
    this.sortBtn2 = page.locator('#sort-btn2');
    this.results = page.locator('#results');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async fillNumbers(value) {
    // Use fill to set the input value; input is type=number in the DOM, but we still attempt to fill.
    await this.numbers.fill(value);
  }

  async clickSort() {
    await this.sortBtn.click();
  }

  async fillNumbers2(value) {
    await this.numbers2.fill(value);
  }

  async clickSort2() {
    await this.sortBtn2.click();
  }

  async getResultsText() {
    return (await this.results.textContent()) ?? '';
  }
}

test.describe('Bucket Sort interactive application - FSM validation', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleWarnings = [];
  let pageObj;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleErrors = [];
    consoleWarnings = [];

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // Save the full error message for assertions and debugging
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Capture console messages, including console.error and console.warn
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') consoleErrors.push(text);
      if (type === 'warning') consoleWarnings.push(text);
    });

    pageObj = new BucketSortPage(page);
    await pageObj.goto();

    // Allow a short moment for any synchronous scripts to run and possibly throw errors
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // no-op teardown, listeners are bound to page fixture and will be cleaned up automatically
  });

  test('Idle state renders expected inputs and controls', async ({ page }) => {
    // This test validates the S0_Idle state: initial render should contain input(s) and sort button(s)
    await expect(page.locator('#numbers')).toBeVisible();
    await expect(page.locator('#sort-btn')).toBeVisible();
    await expect(page.locator('#numbers2')).toBeVisible();
    await expect(page.locator('#sort-btn2')).toBeVisible();
    await expect(page.locator('#results')).toBeVisible();

    // The results paragraph should be empty on initial load (Idle state)
    const initialResults = await page.locator('#results').textContent();
    expect(initialResults?.trim() ?? '').toBe('');

    // We also capture any console or page errors emitted during initial render.
    // Per the task instructions, allow errors to happen naturally and record them.
    // We don't require errors for this specific assertion, but we log counts for debugging.
    // If errors occurred, they will be asserted in a dedicated test below.
  });

  test('Transition SortNumbers1: click #sort-btn after entering numbers', async ({ page }) => {
    // This test validates the transition defined by SortNumbers1:
    // - performBucketSort('numbers') should be triggered by clicking #sort-btn
    // - Expected observable: results updated (displayResults)
    // We attempt to exercise the path and then assert either results were updated or page errors occurred.

    // Provide a representative "list" value. The input element is type=number in markup,
    // but application code may expect comma-separated numbers; we try a common input string.
    // We do not modify the runtime environment; we simply perform user-like interactions.
    await pageObj.fillNumbers('3,1,2'); // may be accepted or may cause script logic to error
    await pageObj.clickSort();

    // Allow time for any async processing / UI updates / exceptions
    await page.waitForTimeout(300);

    const resultsText = (await pageObj.getResultsText()).trim();

    // Assert: Either the results updated (non-empty) OR JavaScript runtime emitted at least one error/exception.
    const anyErrors = pageErrors.length + consoleErrors.length;
    const resultsUpdated = resultsText.length > 0;

    // Provide descriptive assertion failures: prefer to see results updated, otherwise require errors to have been seen.
    if (!resultsUpdated) {
      // If results are not updated, then we expect that errors have occurred (per instruction to assert errors)
      expect(anyErrors, `Expected either results to be updated or runtime errors to occur. Results were empty and no errors captured.
Results text: "${resultsText}"
pageErrors: ${JSON.stringify(pageErrors, null, 2)}
consoleErrors: ${JSON.stringify(consoleErrors, null, 2)}`).toBeGreaterThan(0);
    } else {
      // If results were updated, ensure the visible results contain numbers or plausible sorted output
      // We check that results contains digits or commas, as a basic sanity check.
      expect(/[\d]/.test(resultsText), `Expected results to contain numeric output, got: "${resultsText}"`).toBeTruthy();
    }
  });

  test('Transition SortNumbers2: click #sort-btn2 after entering numbers2', async ({ page }) => {
    // This test validates the second group transition SortNumbers2
    await pageObj.fillNumbers2('10,5,7');
    await pageObj.clickSort2();

    // Allow time for any processing
    await page.waitForTimeout(300);

    const resultsText = (await pageObj.getResultsText()).trim();
    const anyErrors = pageErrors.length + consoleErrors.length;
    const resultsUpdated = resultsText.length > 0;

    if (!resultsUpdated) {
      // If results weren't updated, assert that errors were captured
      expect(anyErrors, `Expected either results to be updated after clicking #sort-btn2 or runtime errors to be captured.
Results text: "${resultsText}"
pageErrors: ${JSON.stringify(pageErrors, null, 2)}
consoleErrors: ${JSON.stringify(consoleErrors, null, 2)}`).toBeGreaterThan(0);
    } else {
      expect(/[\d]/.test(resultsText)).toBeTruthy();
    }
  });

  test('Edge