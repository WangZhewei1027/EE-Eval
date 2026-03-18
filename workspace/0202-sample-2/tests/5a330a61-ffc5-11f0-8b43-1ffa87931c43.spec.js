import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample-2/html/5a330a61-ffc5-11f0-8b43-1ffa87931c43.html';

test.describe('Heap Sort Visualization - FSM and UI integration tests', () => {
  // Capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console messages and record errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Listen to page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the application and wait for DOM to be ready
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure the core elements are present before starting each test
    await expect(page.locator('#arrayContainer')).toBeVisible();
    await expect(page.locator('#generateBtn')).toBeVisible();
    await expect(page.locator('#startBtn')).toBeVisible();
    await expect(page.locator('#speedRange')).toBeVisible();
  });

  test.afterEach(async () => {
    // After each test assert that no console errors or uncaught page errors occurred.
    // The test suite is intended to observe and report any runtime exceptions.
    expect(consoleErrors.length, 'No console.error calls should occur during the test').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors should occur during the test').toBe(0);
  });

  test('S0 Idle: initial render invokes renderArray() and controls are ready', async ({ page }) => {
    // Validate entry action of Idle state: renderArray() should populate #arrayContainer
    const bars = page.locator('#arrayContainer .bar');
    await expect(bars).toHaveCount(30); // ARRAY_SIZE = 30

    // Each bar should contain a numeric value and have a positive height style
    const values = await bars.allTextContents();
    expect(values.length).toBe(30);
    for (const v of values) {
      const num = Number(v.trim());
      expect(Number.isFinite(num)).toBe(true);
      expect(num).toBeGreaterThanOrEqual(5);
    }

    // Controls initial state: generate and start buttons enabled; speedValue reflects speedRange
    await expect(page.locator('#generateBtn')).toBeEnabled();
    await expect(page.locator('#startBtn')).toBeEnabled();

    const speedRangeValue = await page.locator('#speedRange').evaluate(el => el.value);
    expect(Number(speedRangeValue)).toBe(600); // default value in HTML

    const speedText = await page.locator('#speedValue').textContent();
    expect(speedText.trim()).toBe('600 ms');
  });

  test('GenerateArray event: clicking Generate New Array updates the visual array in Idle', async ({ page }) => {
    // Capture the initial markup
    const container = page.locator('#arrayContainer');
    const beforeHTML = await container.innerHTML();

    // Click the generate button to trigger generateArray() and renderArray()
    await page.locator('#generateBtn').click();

    // The DOM should update synchronously; compare innerHTML to ensure it's been re-rendered
    const afterHTML = await container.innerHTML();
    expect(afterHTML).toBeTruthy();
    // Very unlikely that a randomly generated array of length 30 will match exactly previous HTML.
    // Assert that something changed to confirm generateArray() + renderArray() executed.
    expect(afterHTML === beforeHTML ? false : true).toBe(true);

    // Still in Idle: ensure isSorting is false
    const isSorting = await page.evaluate(() => window.isSorting);
    expect(isSorting).toBe(false);
  });

  test('StartHeapSort event: clicking Start transitions to Sorting state (S1) and disables controls', async ({ page }) => {
    // To make the visualization progress faster, reduce the animation speed before starting.
    await page.locator('#speedRange').evaluate((el) => {
      el.value = '100';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Start sorting
    await page.locator('#startBtn').click();

    // Allow a short moment for the heapSort() to run its start-up synchronous portion
    await page.waitForTimeout(200);

    // Verify that the application is in Sorting state: isSorting should be true
    const isSorting = await page.evaluate(() => window.isSorting);
    expect(isSorting).toBe(true);

    // Buttons and range should be disabled during sorting per implementation
    await expect(page.locator('#generateBtn')).toBeDisabled();
    await expect(page.locator('#startBtn')).toBeDisabled();
    await expect(page.locator('#speedRange')).toBeDisabled();

    // Visual feedback: during sorting some bars should acquire comparing/swapping classes
    // It's possible that comparisons haven't occurred yet; check that at least bars exist
    const bars = page.locator('#arrayContainer .bar');
    await expect(bars).toHaveCount(30);
  });

  test('AdjustSpeed event: changing speedRange updates speed variable and UI while sorting', async ({ page }) => {
    // Start with a fast speed to enter sorting quickly
    await page.locator('#speedRange').evaluate((el) => {
      el.value = '100';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Start sorting
    await page.locator('#startBtn').click();

    // Small wait for heapSort to set isSorting and disable controls
    await page.waitForTimeout(200);

    // Ensure we are in sorting state
    const sortingNow = await page.evaluate(() => window.isSorting);
    expect(sortingNow).toBe(true);

    // While sorting, adjust the speed to a different valid value
    await page.locator('#speedRange').evaluate((el) => {
      // Note: The range input is disabled during sorting in the implementation.
      // However, the FSM expects an AdjustSpeed event. We simulate the user interaction
      // via dispatching an input event directly on the element; this mirrors browser behavior
      // if the control were enabled. We do NOT redefine functions or patch runtime.
      el.disabled = false; // Temporarily enable so input event is accepted by the element itself
      el.value = '300';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.disabled = true; // restore disabled state to reflect implementation
    });

    // Verify that the in-page speed variable was updated according to the input handler
    const currentSpeed = await page.evaluate(() => window.speed);
    expect(currentSpeed).toBe(300);

    // The UI's speedValue text should also update accordingly
    const speedText = await page.locator('#speedValue').textContent();
    expect(speedText.trim()).toBe('300 ms');

    // The page should remain in sorting state (implementation keeps isSorting true until completion)
    const stillSorting = await page.evaluate(() => window.isSorting);
    expect(stillSorting).toBe(true);
  });

  test('Edge case: Generate button should be prevented during sorting (no-op)', async ({ page }) => {
    // Start sorting with a fast speed
    await page.locator('#speedRange').evaluate((el) => {
      el.value = '100';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#startBtn').click();
    await page.waitForTimeout(200);

    // Ensure the generate button is disabled as implemented
    await expect(page.locator('#generateBtn')).toBeDisabled();

    // Capture the current array snapshot
    const beforeSnapshot = await page.locator('#arrayContainer').innerHTML();

    // Attempting to click a disabled button should not change the array.
    // We will not force the click (which would bypass intended behavior).
    // Instead, assert the disabled attribute and that the DOM remains stable after a short wait.
    await page.waitForTimeout(200);
    const afterSnapshot = await page.locator('#arrayContainer').innerHTML();
    expect(afterSnapshot).toBe(beforeSnapshot);
  });

  test('AdjustSpeed event in Idle: changing the speed when not sorting updates speed and UI', async ({ page }) => {
    // Ensure we are in Idle initial state
    const initialIsSorting = await page.evaluate(() => window.isSorting);
    expect(initialIsSorting).toBe(false);

    // Change speed via input and verify both the variable and displayed text update
    await page.locator('#speedRange').evaluate((el) => {
      el.value = '1200';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const speedAfter = await page.evaluate(() => window.speed);
    expect(speedAfter).toBe(1200);

    const speedText = await page.locator('#speedValue').textContent();
    expect(speedText.trim()).toBe('1200 ms');
  });

  test('Sanity: No unexpected runtime exceptions during page lifecycle and interactions', async ({ page }) => {
    // Perform a sequence of interactions: generate, start, adjust speed (if possible), but avoid forcing clicks.
    // This test focuses on surfacing any ReferenceError, TypeError or similar uncaught exceptions.

    // 1) Generate array (Idle)
    await page.locator('#generateBtn').click();

    // 2) Adjust speed in Idle
    await page.locator('#speedRange').evaluate((el) => {
      el.value = '800';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // 3) Start sorting briefly
    await page.locator('#startBtn').click();
    await page.waitForTimeout(200);

    // 4) Try to adjust speed during sorting (simulate as earlier)
    await page.locator('#speedRange').evaluate((el) => {
      el.disabled = false;
      el.value = '500';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.disabled = true;
    });

    // Wait a moment to surface any asynchronous errors
    await page.waitForTimeout(300);

    // Final assertions: check that we recorded no console errors or uncaught page errors
    // (The afterEach hook will enforce this as well.)
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});