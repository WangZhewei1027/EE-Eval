import { test, expect } from '@playwright/test';

// Test file for Application ID: 5208aab3-fa76-11f0-a09b-87751f540fd8
// URL: http://127.0.0.1:5500/workspace/0126-balanced/html/5208aab3-fa76-11f0-a09b-87751f540fd8.html
// This suite validates the FSM states and transitions for the Bubble Sort interactive app.
// It observes console logs and page errors naturally (does not patch or modify page JS).

// Page Object for the Bubble Sort page to encapsulate common interactions and observability.
class BubbleSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Capture console messages and page errors for assertions.
    this.consoleMessages = [];
    this.pageErrors = [];

    // Attach listeners to capture messages before navigation so we record initial script logs/errors.
    this.page.on('console', msg => {
      try {
        // Use text() to capture a human-readable representation of the console call.
        this.consoleMessages.push(msg.text());
      } catch (e) {
        // Best-effort capture; don't interfere with the page.
        this.consoleMessages.push(String(msg));
      }
    });

    this.page.on('pageerror', error => {
      // Capture error messages (Error object) thrown in page context.
      // Convert to string for flexible assertions.
      this.pageErrors.push(String(error && error.message ? error.message : error));
    });
  }

  // Navigate to the application URL.
  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-balanced/html/5208aab3-fa76-11f0-a09b-87751f540fd8.html', { waitUntil: 'networkidle' });
  }

  // Get the displayed original list text from the page DOM.
  async getOriginalListText() {
    const el = await this.page.locator('#bubble-sort pre code.list').first();
    return (await el.innerText()).trim();
  }

  // Get the displayed sorted list text from the page DOM.
  async getSortedListText() {
    // There are two pre/code.list elements on the page: original and sorted.
    // The second one is the Sorted List as per markup.
    const els = this.page.locator('#bubble-sort pre code.list');
    const count = await els.count();
    if (count >= 2) {
      return (await els.nth(1).innerText()).trim();
    }
    // Fallback: return first if only one exists.
    if (count === 1) {
      return (await els.nth(0).innerText()).trim();
    }
    return '';
  }

  // Click the Sort button using the selector detected by the FSM.
  async clickSortButton() {
    const selector = 'button[onclick="bubbleSort(8, 3, 4, 2, 1, 6, 5, 7, 9)"]';
    await this.page.click(selector);
  }

  // Directly call bubbleSort in the page context with given argument(s).
  // This intentionally invokes the page's function unmodified; used to provoke natural errors.
  async callBubbleSortWithArgs(...args) {
    // Use Function.prototype.apply in the page context so the function is invoked with arbitrary args.
    return this.page.evaluate((arr) => {
      // We can't "inject" or modify functions; just call the existing global bubbleSort.
      // The outer evaluate receives a single serialized argument; for non-array we handle accordingly.
      return bubbleSort.apply(null, arr);
    }, args);
  }
}

test.describe('Bubble Sort interactive application - FSM validation', () => {
  // Use fresh page per test via Playwright fixtures
  test.beforeEach(async ({ page }) => {
    // Nothing to do here; individual tests will instantiate page object and navigate.
  });

  test('S0_Idle: Initial render shows Original list, Sort button, and initial console logs', async ({ page }) => {
    // This test validates the initial (Idle) state: renderPage() entry action effects.
    const app = new BubbleSortPage(page);
    await app.goto();

    // Verify DOM: the original list (first pre code.list) contains the unsorted array
    const originalText = await app.getOriginalListText();
    // The markup includes the unsorted array string exactly as in the HTML.
    expect(originalText).toContain('[8, 3, 4, 2, 1, 6, 5, 7, 9]');

    // Verify the Sort button exists with the onclick handler referenced by the FSM.
    const sortButton = page.locator('button[onclick="bubbleSort(8, 3, 4, 2, 1, 6, 5, 7, 9)"]');
    await expect(sortButton).toHaveCount(1);
    await expect(sortButton).toBeVisible();
    await expect(sortButton).toHaveText('Sort');

    // Verify that initial script execution logged "Original List" and "Sorted List" to console.
    // The page's inline script calls console.log("Original List:", arr) and console.log("Sorted List:", arr).
    // We assert that consoleMessages contains those substrings.
    const anyOriginalLog = app.consoleMessages.some(m => typeof m === 'string' && m.includes('Original List'));
    const anySortedLog = app.consoleMessages.some(m => typeof m === 'string' && m.includes('Sorted List'));
    expect(anyOriginalLog).toBeTruthy();
    expect(anySortedLog).toBeTruthy();

    // Ensure no fatal page errors occurred during initial load.
    expect(app.pageErrors.length).toBe(0);
  });

  test('Transition: clicking Sort button invokes bubbleSort with incorrect arg signature and does not change DOM Sorted List', async ({ page }) => {
    // This test exercises the SortButtonClick event and validates the transition attempt.
    // According to the FSM, clicking should trigger bubbleSort(arr). The HTML's onclick passes multiple numbers
    // as separate args (bubbleSort(8,3,4,...)), which is an incorrect signature for the function expecting an array.
    // We assert behavior: click happens, no page crash, and DOM Sorted List remains the static content.
    const app1 = new BubbleSortPage(page);
    await app.goto();

    // Capture console message count before clicking.
    const beforeConsoleCount = app.consoleMessages.length;

    // Capture page errors count before clicking.
    const beforeErrorCount = app.pageErrors.length;

    // Click the Sort button (this uses the inline onclick in the HTML exactly as-is).
    await app.clickSortButton();

    // Allow a short delay to let any console messages or errors appear from the click handler.
    await page.waitForTimeout(200);

    // After clicking, observe console messages and errors.
    const afterConsoleCount = app.consoleMessages.length;
    const afterErrorCount = app.pageErrors.length;

    // Because the inline onclick calls bubbleSort with multiple numeric args instead of an array,
    // bubbleSort will receive the first number as `arr`. Accessing arr.length yields undefined (no throw),
    // so the function will simply return that non-array value and not perform swaps. Therefore:
    // - No new "Swapped" console lines should appear resulting from the click.
    // - No additional "Sorted List:" log should be emitted by that click.
    // - And typically no pageerror will be produced by this incorrect calling convention.
    const newConsoleMessages = app.consoleMessages.slice(beforeConsoleCount);
    const newErrors = app.pageErrors.slice(beforeErrorCount);

    const anyNewSwapped = newConsoleMessages.some(m => typeof m === 'string' && m.includes('Swapped'));
    const anyNewSortedLog = newConsoleMessages.some(m => typeof m === 'string' && m.includes('Sorted List'));

    expect(anyNewSwapped).toBeFalsy();
    expect(anyNewSortedLog).toBeFalsy();

    // Assert that no new fatal page errors occurred specifically from the click handler.
    expect(newErrors.length).toBe(0);

    // Verify DOM Sorted List remains the expected static content as present in the HTML.
    const sortedText = await app.getSortedListText();
    expect(sortedText).toContain('[1, 2, 3, 4, 5, 6, 7, 8, 9]');
  });

  test('Edge case & error scenario: calling bubbleSort() with no arguments triggers a runtime TypeError', async ({ page }) => {
    // This test intentionally invokes bubbleSort with no arguments to allow a natural TypeError to occur
    // in the page runtime (arr will be undefined and accessing arr.length should throw in subsequent code).
    const app2 = new BubbleSortPage(page);
    await app.goto();

    // Ensure no recorded page errors prior to this invocation.
    expect(app.pageErrors.length).toBe(0);

    // Call bubbleSort() with no args in page context. The function is defined on the page and we call it as-is.
    // The evaluate call will reject if the invocation throws in the page context.
    const callPromise = page.evaluate(() => {
      // Directly call bubbleSort without passing arguments to provoke the error naturally.
      // We do not catch/patch errors here; let them bubble and be captured by pageerror.
      return bubbleSort();
    });

    // The page should throw; assert that the promise rejects (natural runtime error).
    await expect(callPromise).rejects.toThrow();

    // Wait a short time to ensure the pageerror event handler recorded the error.
    await page.waitForTimeout(100);

    // There should now be at least one page error recorded.
    expect(app.pageErrors.length).toBeGreaterThanOrEqual(1);

    // Assert that one of the recorded page errors looks like a TypeError related to reading length of undefined
    const hasTypeErrorLike = app.pageErrors.some(msg =>
      /TypeError/i.test(msg) ||
      /Cannot read property 'length'/.test(msg) ||
      /Cannot read properties of undefined/.test(msg) ||
      /undefined is not an object/.test(msg)
    );
    expect(hasTypeErrorLike).toBeTruthy();
  });

  test('Sanity: initial script-run performed bubble sort on the provided array (logs show swaps and final sorted output)', async ({ page }) => {
    // This test double-checks that the page's initial script executed bubbleSort on a real array during load.
    // The inline script assigns let arr = [8,...]; and then calls bubbleSort(arr);
    // We validate that console messages from initial load include swap messages and a final sorted list print.
    const app3 = new BubbleSortPage(page);
    await app.goto();

    // Confirm presence of "Swapped" console logs from the initial execution (bubble sort performed swaps).
    const hasSwapped = app.consoleMessages.some(m => typeof m === 'string' && m.includes('Swapped'));
    expect(hasSwapped).toBeTruthy();

    // Confirm final sorted log from initial execution exists
    const hasSortedLog = app.consoleMessages.some(m => typeof m === 'string' && m.includes('Sorted List'));
    expect(hasSortedLog).toBeTruthy();

    // Confirm the Sorted List displayed in the DOM matches the expected final array
    const sortedText1 = await app.getSortedListText();
    expect(sortedText).toContain('[1, 2, 3, 4, 5, 6, 7, 8, 9]');
  });
});