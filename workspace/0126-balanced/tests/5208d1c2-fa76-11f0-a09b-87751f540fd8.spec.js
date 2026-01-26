import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/5208d1c2-fa76-11f0-a09b-87751f540fd8.html';
const EXPECTED_SORTED_TEXT = 'Sorted array: 1, 2, 3, 4, 5, 6, 7, 8, 9';

class QuickSortPage {
  /**
   * Page object for the Quick Sort interactive application.
   * Encapsulates selectors and common interactions.
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#sort-button');
    this.result = page.locator('#result');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickSort() {
    await this.button.click();
  }

  async getResultText() {
    // Use textContent so empty string is returned if element has no text
    return (await this.result.textContent()) ?? '';
  }

  async buttonIsVisible() {
    return this.button.isVisible();
  }
}

test.describe('Quick Sort interactive application (FSM verification)', () => {
  // We'll capture console errors and pageerrors per test to observe runtime issues.
  test.beforeEach(async ({ page }) => {
    // make sure we start each test with a clean page state
    // nothing to do here beyond the individual test setup
  });

  test('Initial render should show Sort button (Idle evidence) and already show sorted result (S1_Sorted) due to implementation', async ({ page }) => {
    // Comments: Validate the initial application state.
    // FSM Idle evidence expects the button; implementation also auto-sorts on load and writes to #result.
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const app = new QuickSortPage(page);
    await app.goto();

    // Verify Sort button exists (Idle evidence)
    const isVisible = await app.buttonIsVisible();
    expect(isVisible).toBe(true);

    // Verify that the page's result div contains the expected sorted text (S1_Sorted evidence)
    const resultText = (await app.getResultText()).trim();
    expect(resultText).toBe(EXPECTED_SORTED_TEXT);

    // Ensure no runtime errors were emitted immediately on load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking the Sort button should result in the Sorted state (transition: SortButtonClick)', async ({ page }) => {
    // Comments: According to FSM, clicking the button triggers quickSort on a default array.
    // The implementation already sorts on load; clicking should not produce errors and should leave the correct sorted result visible.
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const app = new QuickSortPage(page);
    await app.goto();

    // Pre-click assertion: result already sorted
    const before = (await app.getResultText()).trim();
    expect(before).toBe(EXPECTED_SORTED_TEXT);

    // Trigger the FSM event (click the sort button)
    await app.clickSort();

    // After clicking, verify the result is still the expected sorted text
    const after = (await app.getResultText()).trim();
    expect(after).toBe(EXPECTED_SORTED_TEXT);

    // No runtime errors should have been produced by the click
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Multiple clicks (edge case) - idempotency: double-clicking Sort should keep the result stable', async ({ page }) => {
    // Comments: Validate that repeated user interactions don't destabilize the DOM or throw errors.
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const app = new QuickSortPage(page);
    await app.goto();

    // Do two clicks rapidly to simulate aggressive user behavior
    await Promise.all([app.clickSort(), app.clickSort()]);

    // The result should remain the expected sorted text
    const resultText = (await app.getResultText()).trim();
    expect(resultText).toBe(EXPECTED_SORTED_TEXT);

    // No runtime errors should arise from multiple clicks
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity check: quickSort function handles empty array without throwing', async ({ page }) => {
    // Comments: Edge-case validation; calling quickSort([]) should return [] and not throw.
    const app = new QuickSortPage(page);
    await app.goto();

    // Evaluate quickSort([]) in the page context and ensure it returns an empty array
    const returned = await page.evaluate(() => {
      // If quickSort isn't defined, this will throw a ReferenceError — allow it to surface to the test.
      return window.quickSort([]); // expected to return []
    });

    expect(Array.isArray(returned)).toBe(true);
    expect(returned.length).toBe(0);
  });

  test('Error scenario: invoking quickSort with null should produce a TypeError (observed via pageerror)', async ({ page }) => {
    // Comments: Intentionally trigger an error scenario to validate that runtime exceptions are observable.
    // We will execute quickSort(null) inside a setTimeout to ensure the error is unhandled in the page context,
    // which should emit a pageerror event that Playwright can capture.
    const pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    const app = new QuickSortPage(page);
    await app.goto();

    // Ensure quickSort exists before trying to call it
    const hasQuickSort = await page.evaluate(() => typeof window.quickSort === 'function');
    expect(hasQuickSort).toBe(true);

    // Trigger an unhandled exception in the page context by calling quickSort(null) inside setTimeout
    // so the exception surfaces as a pageerror (TypeError expected).
    const waitForPageErrorPromise = page.waitForEvent('pageerror', { timeout: 3000 });

    await page.evaluate(() => {
      // Schedule an unhandled call that will throw inside the page's event loop.
      setTimeout(() => {
        // This call is expected to throw a TypeError because it will attempt to access .length of null.
        // We intentionally do NOT wrap this in try/catch so it becomes an unhandled exception.
        quickSort(null);
      }, 0);
    });

    // Wait for the pageerror event to be fired and capture the error
    const error = await waitForPageErrorPromise;
    // The thrown error should be a TypeError in most JS engines
    expect(error).toBeTruthy();
    expect(error.name).toBe('TypeError');

    // Clean up: pageErrors listener should have captured the same error
    // (it may be in the array already)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const recorded = pageErrors[pageErrors.length - 1];
    expect(recorded).toBeInstanceOf(Error);
    expect(recorded.name).toBe('TypeError');
  });

  test('FSM evidence cross-check: both Idle and Sorted evidence are present in the DOM', async ({ page }) => {
    // Comments: FSM lists two pieces of evidence: presence of #sort-button (Idle) and assignment to #result (Sorted).
    // Verify both pieces of DOM evidence exist and reflect expected values.
    const app = new QuickSortPage(page);
    await app.goto();

    // Evidence 1: button exists in DOM
    const buttonExists = await page.locator('button#sort-button').count();
    expect(buttonExists).toBe(1);

    // Evidence 2: #result innerHTML contains the "Sorted array: ..." text
    const resultInnerHTML = await page.evaluate(() => document.getElementById('result')?.innerHTML ?? '');
    expect(resultInnerHTML).toContain('Sorted array:');
    expect(resultInnerHTML).toContain('1, 2, 3'); // sanity check that it contains sorted values
    expect(resultInnerHTML.trim()).toBe(EXPECTED_SORTED_TEXT);
  });
});