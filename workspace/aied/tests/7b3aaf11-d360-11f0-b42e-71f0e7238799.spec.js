import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3aaf11-d360-11f0-b42e-71f0e7238799.html';

test.describe('Heap Implementation (Min/Max) - FSM validation', () => {
  // We'll collect console messages and page errors for each test to assert on them.
  test.beforeEach(async ({ page }) => {
    // Attach listeners early to capture any errors during load
    page.context().setDefaultTimeout(10000);
  });

  // Helper to attach listeners and return containers
  async function attachLogCollectors(page) {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
    return { consoleMessages, pageErrors };
  }

  test('S0_Idle: Initial render shows title and empty heap lists (renderPage entry)', async ({ page }) => {
    // Validate initial Idle state: page renders heading and empty heaps.
    const { consoleMessages, pageErrors } = await attachLogCollectors(page);

    await page.goto(APP_URL);

    // Verify page title and header rendered (evidence for S0_Idle)
    await expect(page.locator('h1')).toHaveText('Min/Max Heap Implementation');

    // Input and buttons exist
    await expect(page.locator('#value')).toBeVisible();
    await expect(page.locator('#addMinHeap')).toBeVisible();
    await expect(page.locator('#addMaxHeap')).toBeVisible();

    // Heaps are present and empty on load
    await expect(page.locator('#minHeap')).toBeVisible();
    await expect(page.locator('#maxHeap')).toBeVisible();
    await expect(page.locator('#minHeap li')).toHaveCount(0);
    await expect(page.locator('#maxHeap li')).toHaveCount(0);

    // There should be no uncaught page errors during initial render
    expect(pageErrors.length, 'No page errors should be thrown on initial load').toBe(0);

    // No console error level messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, 'No console errors/warnings on initial load').toBe(0);
  });

  test('S1_MinHeapUpdated: Adding a number to Min Heap updates internal heap and DOM', async ({ page }) => {
    // Test the AddToMinHeap event and the transition to S1_MinHeapUpdated
    const { consoleMessages, pageErrors } = await attachLogCollectors(page);
    await page.goto(APP_URL);

    // Enter a number and click Add to Min Heap
    await page.fill('#value', '5');
    await page.click('#addMinHeap');

    // The DOM should reflect the inserted value in minHeap list
    const minItems = page.locator('#minHeap li');
    await expect(minItems).toHaveCount(1);
    await expect(minItems.first()).toHaveText('5');

    // Validate the internal JS MinHeap instance (evidence: minHeap.getHeap())
    const minHeapArray = await page.evaluate(() => {
      // Return the heap array as-is from the page context
      if (typeof minHeap === 'undefined' || typeof minHeap.getHeap !== 'function') return null;
      return minHeap.getHeap();
    });
    expect(minHeapArray, 'minHeap.getHeap() should be an array').not.toBeNull();
    expect(minHeapArray).toEqual([5]);

    // Ensure Max heap is still empty
    await expect(page.locator('#maxHeap li')).toHaveCount(0);

    // Ensure no runtime page errors occurred
    expect(pageErrors.length, 'No page errors after adding to Min Heap').toBe(0);

    // No console errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, 'No console errors/warnings after adding to Min Heap').toBe(0);
  });

  test('S2_MaxHeapUpdated: Adding a number to Max Heap updates internal heap and DOM', async ({ page }) => {
    // Test the AddToMaxHeap event and the transition to S2_MaxHeapUpdated
    const { consoleMessages, pageErrors } = await attachLogCollectors(page);
    await page.goto(APP_URL);

    // Enter a number and click Add to Max Heap
    await page.fill('#value', '10');
    await page.click('#addMaxHeap');

    // The DOM should reflect the inserted value in maxHeap list
    const maxItems = page.locator('#maxHeap li');
    await expect(maxItems).toHaveCount(1);
    await expect(maxItems.first()).toHaveText('10');

    // Validate the internal JS MaxHeap instance (evidence: maxHeap.getHeap())
    const maxHeapArray = await page.evaluate(() => {
      if (typeof maxHeap === 'undefined' || typeof maxHeap.getHeap !== 'function') return null;
      return maxHeap.getHeap();
    });
    expect(maxHeapArray, 'maxHeap.getHeap() should be an array').not.toBeNull();
    expect(maxHeapArray).toEqual([10]);

    // Ensure Min heap is still empty
    await expect(page.locator('#minHeap li')).toHaveCount(0);

    // Ensure no runtime page errors occurred
    expect(pageErrors.length, 'No page errors after adding to Max Heap').toBe(0);

    // No console errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, 'No console errors/warnings after adding to Max Heap').toBe(0);
  });

  test('Min Heap maintains heap property after multiple inserts (root is smallest)', async ({ page }) => {
    // Validate heap bubble-up logic by inserting multiple values
    const { consoleMessages, pageErrors } = await attachLogCollectors(page);
    await page.goto(APP_URL);

    const values = [7, 3, 9, 1, 5];
    for (const v of values) {
      await page.fill('#value', String(v));
      await page.click('#addMinHeap');
    }

    // Internal heap array should have the smallest element at index 0
    const minHeapArray = await page.evaluate(() => {
      return minHeap.getHeap();
    });
    expect(minHeapArray.length).toBe(values.length);
    // Root should be minimum of inserted values
    const expectedMin = Math.min(...values);
    expect(minHeapArray[0]).toBe(expectedMin);

    // DOM should reflect the same array order
    const domValues = await page.$$eval('#minHeap li', lis => lis.map(li => Number(li.textContent)));
    expect(domValues).toEqual(minHeapArray);

    // No runtime page errors
    expect(pageErrors.length, 'No page errors after multiple Min Heap inserts').toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, 'No console errors/warnings after multiple Min Heap inserts').toBe(0);
  });

  test('Max Heap maintains heap property after multiple inserts (root is largest)', async ({ page }) => {
    // Validate max-heap bubble-up logic
    const { consoleMessages, pageErrors } = await attachLogCollectors(page);
    await page.goto(APP_URL);

    const values = [2, 11, 6, 14, 9];
    for (const v of values) {
      await page.fill('#value', String(v));
      await page.click('#addMaxHeap');
    }

    const maxHeapArray = await page.evaluate(() => {
      return maxHeap.getHeap();
    });
    expect(maxHeapArray.length).toBe(values.length);
    const expectedMax = Math.max(...values);
    expect(maxHeapArray[0]).toBe(expectedMax);

    // DOM should reflect the same array order
    const domValues = await page.$$eval('#maxHeap li', lis => lis.map(li => Number(li.textContent)));
    expect(domValues).toEqual(maxHeapArray);

    // No runtime errors
    expect(pageErrors.length, 'No page errors after multiple Max Heap inserts').toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, 'No console errors/warnings after multiple Max Heap inserts').toBe(0);
  });

  test('Edge case: Empty input results in NaN insertion and DOM shows "NaN" for Min Heap', async ({ page }) => {
    // This validates how the app handles empty input (parseInt('') -> NaN)
    const { consoleMessages, pageErrors } = await attachLogCollectors(page);
    await page.goto(APP_URL);

    // Ensure input is empty
    await page.fill('#value', '');
    await page.click('#addMinHeap');

    // DOM should show "NaN"
    const minItems = page.locator('#minHeap li');
    await expect(minItems).toHaveCount(1);
    await expect(minItems.first()).toHaveText('NaN');

    // Internal heap should contain NaN; use Number.isNaN in page context
    const hasNaN = await page.evaluate(() => {
      const arr = minHeap.getHeap();
      return Array.isArray(arr) && arr.length > 0 && Number.isNaN(arr[0]);
    });
    expect(hasNaN, 'Internal minHeap should contain NaN for empty input').toBe(true);

    // No uncaught page errors (inserting NaN is allowed in implementation)
    expect(pageErrors.length, 'No page errors when inserting NaN').toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, 'No console errors/warnings when inserting NaN').toBe(0);
  });

  test('Edge case: Non-integer numeric input is truncated by parseInt (3.7 -> 3)', async ({ page }) => {
    // parseInt should truncate decimals; confirm behavior
    const { consoleMessages, pageErrors } = await attachLogCollectors(page);
    await page.goto(APP_URL);

    await page.fill('#value', '3.7');
    await page.click('#addMinHeap');

    // DOM should show "3" because parseInt('3.7') === 3
    await expect(page.locator('#minHeap li')).toHaveCount(1);
    await expect(page.locator('#minHeap li').first()).toHaveText('3');

    // Internal heap should contain 3
    const minHeapArray = await page.evaluate(() => minHeap.getHeap());
    expect(minHeapArray[0]).toBe(3);

    // No page errors
    expect(pageErrors.length, 'No page errors for non-integer input').toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, 'No console errors/warnings for non-integer input').toBe(0);
  });

  test('Edge case: Very large number insertion into Max Heap', async ({ page }) => {
    // Validate large integer handling
    const { consoleMessages, pageErrors } = await attachLogCollectors(page);
    await page.goto(APP_URL);

    const bigNumber = String(9_000_000_000);
    await page.fill('#value', bigNumber);
    await page.click('#addMaxHeap');

    await expect(page.locator('#maxHeap li')).toHaveCount(1);
    await expect(page.locator('#maxHeap li').first()).toHaveText(bigNumber);

    const maxHeapArray = await page.evaluate(() => maxHeap.getHeap());
    // parseInt on large number string should still produce a number
    expect(maxHeapArray[0]).toBe(Number(bigNumber));

    // No runtime errors
    expect(pageErrors.length, 'No page errors after inserting very large number').toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, 'No console errors/warnings after inserting very large number').toBe(0);
  });

  test('Sanity: Multiple rapid clicks and inserts do not throw runtime exceptions', async ({ page }) => {
    // Rapid interactions might reveal race conditions; ensure stability
    const { consoleMessages, pageErrors } = await attachLogCollectors(page);
    await page.goto(APP_URL);

    // Simulate rapid sequence of inputs and clicks
    const entries = ['4', '1', '8', '2', '6'];
    for (const val of entries) {
      await page.fill('#value', val);
      await Promise.all([
        page.click('#addMinHeap'),
        page.click('#addMaxHeap')
      ]);
    }

    // Both heaps should have the expected counts
    await expect(page.locator('#minHeap li')).toHaveCount(entries.length);
    await expect(page.locator('#maxHeap li')).toHaveCount(entries.length);

    // No uncaught page errors were triggered by rapid interaction
    expect(pageErrors.length, 'No page errors after rapid interactions').toBe(0);

    // No console errors/warnings
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, 'No console errors/warnings after rapid interactions').toBe(0);
  });
});