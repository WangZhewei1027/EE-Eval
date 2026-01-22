import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/7b3b7261-d360-11f0-b42e-71f0e7238799.html';

test.describe('Heap Sort Visualization (FSM: 7b3b7261-d360-11f0-b42e-71f0e7238799)', () => {
  // Shared collectors for console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (type + text)
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app page (this should cause displayArray() to run for initial state)
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Make sure the page is closed after each test for cleanup (Playwright normally does this)
    try {
      await page.close();
    } catch (e) {
      // ignore
    }
  });

  test('S0_Idle - Initial state: displayArray() runs on load and shows the initial array', async ({ page }) => {
    // This test validates the Idle state (S0_Idle)
    // Ensure the array-display exists and has the expected number of bars (10)
    const bars = page.locator('#array-display .bar');
    await expect(bars).toHaveCount(10);

    // Validate a couple of bar heights correspond to the initial array values:
    // initial array: [35, 33, 42, 10, 14, 19, 27, 44, 26, 31]
    // height = value * 5 px, so first bar = 175px, second = 165px, fourth = 50px
    const heights = await Promise.all([
      bars.nth(0).evaluate((el) => el.style.height),
      bars.nth(1).evaluate((el) => el.style.height),
      bars.nth(3).evaluate((el) => el.style.height)
    ]);

    expect(heights[0]).toBe('175px'); // 35 * 5
    expect(heights[1]).toBe('165px'); // 33 * 5
    expect(heights[2]).toBe('50px');  // 10 * 5

    // Visual feedback: bars should have the CSS width set by displayArray
    const width = await bars.nth(0).evaluate(el => el.style.width);
    expect(width).toBe('20px');

    // There should be no uncaught page errors immediately after load
    expect(pageErrors.length).toBe(0);
    // Console should not have error-level messages by default
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || /ReferenceError|TypeError|SyntaxError/.test(m.text));
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0 -> S1 -> S2: clicking Sort Array triggers heapSort() and final sorted displayArray()', async ({ page }) => {
    // This test validates the Sorting state (S1_Sorting) and final Sorted state (S2_Sorted)
    const button = page.locator("button[onclick='heapSort()']");
    await expect(button).toBeVisible();

    // Click the Sort Array button to trigger heapSort()
    // heapSort is synchronous but performs multiple displayArray() calls; wait until final sorted order appears.
    await button.click();

    // Wait until the first bar becomes the smallest (10 => 50px). That indicates ascending sorted order start.
    // Using waitForFunction in case the synchronous updates take a moment to reflect in the browser.
    await page.waitForFunction(() => {
      const first = document.querySelector('#array-display .bar');
      if (!first) return false;
      return first.style.height === '50px';
    }, null, { timeout: 2000 });

    // After sorting, bars should be in ascending order of heights.
    const bars = page.locator('#array-display .bar');
    await expect(bars).toHaveCount(10);

    // Extract all heights and verify they are non-decreasing (ascending)
    const heights = await bars.evaluateAll(nodes => nodes.map(n => parseFloat(n.style.height)));
    // Check strictly ascending or non-decreasing
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
    }

    // Validate final sorted values correspond to expected sorted array (by checking heights)
    // Expected sorted values: [10,14,19,26,27,31,33,35,42,44] -> heights multiply by 5
    const expectedHeights = [10, 14, 19, 26, 27, 31, 33, 35, 42, 44].map(v => v * 5);
    const numericHeights = heights.map(h => Math.round(h));
    expect(numericHeights).toEqual(expectedHeights);

    // Ensure no uncaught page errors occurred during sorting
    expect(pageErrors.length).toBe(0);

    // Ensure console does not contain JS runtime errors such as ReferenceError/TypeError/SyntaxError
    const criticalConsoleErrors = consoleMessages.filter(m => /ReferenceError|TypeError|SyntaxError/.test(m.text) || m.type === 'error');
    expect(criticalConsoleErrors.length).toBe(0);
  });

  test('Edge case: multiple rapid clicks on Sort Array do not cause uncaught exceptions and result remains sorted', async ({ page }) => {
    // This test exercises an edge case: repeated activation of the Sort action
    const button = page.locator("button[onclick='heapSort()']");
    await expect(button).toBeVisible();

    // Perform multiple rapid clicks
    await Promise.all([
      button.click(),
      button.click(),
      button.click()
    ]);

    // Wait for final sorted state (first bar should be smallest)
    await page.waitForFunction(() => {
      const first = document.querySelector('#array-display .bar');
      return first && first.style.height === '50px';
    }, null, { timeout: 2000 });

    // Verify final result is still sorted ascending
    const heights = await page.locator('#array-display .bar').evaluateAll(nodes => nodes.map(n => parseFloat(n.style.height)));
    for (let i = 1; i < heights.length; i++) {
      expect(heights[i]).toBeGreaterThanOrEqual(heights[i - 1]);
    }

    // No page errors should be collected from rapid interactions
    expect(pageErrors.length).toBe(0);

    // No critical console errors
    const criticalConsoleErrors = consoleMessages.filter(m => /ReferenceError|TypeError|SyntaxError/.test(m.text) || m.type === 'error');
    expect(criticalConsoleErrors.length).toBe(0);
  });

  test('Visual integrity: bars exist, have expected classes and inline styles after sorting', async ({ page }) => {
    // Ensure base visual and DOM correctness after performing a sort
    const button = page.locator("button[onclick='heapSort()']");
    await button.click();

    await page.waitForFunction(() => {
      const bars = document.querySelectorAll('#array-display .bar');
      return bars.length === 10 && Array.from(bars).every(b => b.style.height && b.style.width === '20px');
    }, null, { timeout: 2000 });

    const bars = page.locator('#array-display .bar');
    // Check that each bar has the 'bar' class and inline styles present
    for (let i = 0; i < 10; i++) {
      await expect(bars.nth(i)).toHaveClass(/bar/);
      const style = await bars.nth(i).evaluate(el => ({ h: el.style.height, w: el.style.width }));
      expect(style.h).toMatch(/^\d+px$/);
      expect(style.w).toBe('20px');
    }

    // No page errors or critical console errors
    expect(pageErrors.length).toBe(0);
    const criticalConsoleErrors = consoleMessages.filter(m => /ReferenceError|TypeError|SyntaxError/.test(m.text) || m.type === 'error');
    expect(criticalConsoleErrors.length).toBe(0);
  });

  test('Observability: ensure that the expected DOM elements referenced in FSM exist (button and array display)', async ({ page }) => {
    // Check components described in the FSM exist on the page
    const button = page.locator("button[onclick='heapSort()']");
    const display = page.locator('#array-display');

    await expect(button).toBeVisible();
    await expect(button).toHaveText('Sort Array');

    await expect(display).toBeVisible();
    // Ensure it initially contains bar children (displayArray() was invoked on load)
    const barCount = await page.locator('#array-display .bar').count();
    expect(barCount).toBeGreaterThan(0);

    // No unexpected errors
    expect(pageErrors.length).toBe(0);
    const criticalConsoleErrors = consoleMessages.filter(m => /ReferenceError|TypeError|SyntaxError/.test(m.text) || m.type === 'error');
    expect(criticalConsoleErrors.length).toBe(0);
  });

});