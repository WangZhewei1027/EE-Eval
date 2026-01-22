import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0ba96071-d5b2-11f0-b169-abe023d0d932.html';

test.describe('FSM: Counting Sort - Idle State and implementation verification', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Before each test attach listeners and navigate to the page so inline scripts run.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console.log outputs emitted by the page's inline script
    page.on('console', (msg) => {
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        // ignore serialization issues
      }
    });

    // Collect uncaught exceptions from the page context
    page.on('pageerror', (err) => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the page (inline script will execute on load)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Ensure we leave a clean page state; close happens automatically by Playwright fixtures.
    // Intentionally kept minimal as per instructions.
    await page.evaluate(() => {}); // no-op to ensure page is reachable after tests
  });

  test('Page loads correctly and Idle state expectations (DOM and entry action missing)', async ({ page }) => {
    // Validate basic DOM content per the HTML: title and heading present
    await expect(page).toHaveTitle(/Counting Sort/);
    const h1 = page.locator('h1');
    await expect(h1).toHaveText('Counting Sort');

    // Validate descriptive paragraphs exist
    const paragraphs = page.locator('p');
    await expect(paragraphs).toHaveCountGreaterThan(1);

    // FSM mentions an entry action: renderPage()
    // The implementation does NOT define renderPage; assert that it is undefined on window.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // Confirm there were no uncaught page errors on initial load (we will intentionally trigger a ReferenceError in a later test)
    expect(pageErrors).toEqual([]);

    // Verify there are no interactive form elements as stated in the FSM extraction notes
    await expect(page.locator('button')).toHaveCount(0);
    await expect(page.locator('input')).toHaveCount(0);
    await expect(page.locator('a')).toHaveCountGreaterThan(0); // anchor tags may exist in general, but we don't rely on them
  });

  test('Inline script logs "Original array" and "Sorted array" messages to the console', async ({ page }) => {
    // The inline script logs the original and sorted arrays on load.
    // Ensure those console messages were captured.
    const joined = consoleMessages.join('\n');
    expect(joined).toContain('Original array:');
    expect(joined).toContain('Sorted array:');

    // Also ensure the inline script ran without throwing uncaught exceptions during load
    expect(pageErrors).toEqual([]);
  });

  test('countingSort function exists and returns the runtime result expected from the provided implementation', async ({ page }) => {
    // The page defines countingSort; we call it with the same example input used in the script
    const result = await page.evaluate(() => {
      // Use a fresh copy so we don't mutate the page's own arr variable
      const input = [170, 45, 75, 90, 802, 24, 2, 66];
      try {
        return countingSort(input);
      } catch (e) {
        // Return an object describing the thrown error for assertion below
        return { __thrown__: true, name: e.name, message: e.message };
      }
    });

    // Based on the provided implementation (which incorrectly calls countDigits(arr)),
    // countingSort will not perform a correct counting sort. The observed behavior is that
    // the array ends up filled with zeros (the implementation creates output filled with 0s
    // and assigns those back into arr indices).
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(8);
    // All indices should be numbers; per the implementation they are expected to be zeros
    expect(result.every((v) => v === 0)).toBe(true);
  });

  test('countDigits works for numeric input (edge case verification) and buildCountArray serialization', async ({ page }) => {
    // Verify countDigits with a straightforward numeric input behaves as a simple digit counter
    const counts = await page.evaluate(() => {
      return countDigits(170);
    });

    // Expect keys for digits 0,7,1 with counts 1 each (object keys are strings)
    expect(counts['0']).toBe(1);
    expect(counts['7']).toBe(1);
    expect(counts['1']).toBe(1);

    // Verify buildCountArray returns an array; for the provided count object it will attempt to place counts
    const countArr = await page.evaluate(() => {
      const c = { '0': 1, '1': 2, '3': 1 };
      return buildCountArray(c);
    });

    // buildCountArray uses parseInt(key) as an index. The returned array should be an Array.
    expect(Array.isArray(countArr)).toBe(true);
    // It should have entries at least up to the max numeric key (3) present or have properties; index 3 should be set
    // Some implementations in the page may leave sparse arrays; we assert that accessing index 3 yields the expected value
    expect(countArr[3]).toBe(1);
  });

  test('calling undefined entry action renderPage() produces a ReferenceError in the page context', async ({ page }) => {
    // Intentionally call renderPage() in the page to let a ReferenceError occur naturally.
    // We assert that the call is rejected and that the error message indicates renderPage is not defined.
    await expect(page.evaluate(() => {
      // This invocation should throw a ReferenceError because renderPage is not defined.
      return renderPage();
    })).rejects.toThrow(/renderPage is not defined|ReferenceError/);
  });

  test('edge cases: countingSort on empty and single-element arrays', async ({ page }) => {
    // Empty array should return an empty array (the implementation will return [] without throwing)
    const emptyResult = await page.evaluate(() => {
      return countingSort([]);
    });
    expect(Array.isArray(emptyResult)).toBe(true);
    expect(emptyResult).toHaveLength(0);

    // Single-element array: due to the implementation bug, it will likely be converted to [0]
    const singleResult = await page.evaluate(() => {
      return countingSort([5]);
    });
    expect(Array.isArray(singleResult)).toBe(true);
    expect(singleResult).toHaveLength(1);
    expect(singleResult[0]).toBe(0);
  });

  test('there are no unexpected runtime errors recorded during normal interactions (aside from intentional invocation)', async ({ page }) => {
    // At this point, we haven't intentionally invoked anything that should create page errors in this test.
    // Ensure pageErrors remain empty (initial load had none).
    expect(pageErrors).toEqual([]);
  });
});