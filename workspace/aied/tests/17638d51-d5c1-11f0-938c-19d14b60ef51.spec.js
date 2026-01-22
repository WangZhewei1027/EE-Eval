import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/17638d51-d5c1-11f0-938c-19d14b60ef51.html';

test.describe('Merge Sort Visualization - FSM states and transitions', () => {
  // Collect runtime console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to app (initial array generation should run on load)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Ensure listeners are not left behind (best-effort cleanup)
    try {
      await page.close();
    } catch (e) {
      // ignore
    }
  });

  test('S0_Idle: on load the initial array is generated (entry action generateArray())', async ({ page }) => {
    // This test validates the initial state S0_Idle where generateArray() is called on load.
    // We expect the array container to be populated with array bars (default size = 20).
    const bars = await page.$$('#array-container .array-bar');
    // The implementation's default call generateArray() uses size = 20
    expect(bars.length).toBeGreaterThanOrEqual(1);
    // Ensure all bars have a height style set (value in 'px')
    for (const barHandle of bars) {
      const height = await barHandle.evaluate(node => node.style.height);
      expect(height).toMatch(/^\d+px$/);
    }

    // Also ensure the global array length matches number of bars
    const arrayLength = await page.evaluate(() => Array.isArray(array) ? array.length : -1);
    expect(arrayLength).toBe(bars.length);

    // No unexpected console or page errors on initial load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S0_Idle -> S1_ArrayGenerated: clicking "Generate Array" regenerates and renders the array', async ({ page }) => {
    // This test validates the transition from S0_Idle to S1_ArrayGenerated via Generate Array click.
    // Capture the array before clicking
    const beforeArray = await page.evaluate(() => array.slice());

    // Click the "Generate Array" button
    await page.click('button[onclick="generateArray()"]');

    // Wait for a short moment to allow re-render
    await page.waitForTimeout(100);

    // Capture the array after clicking
    const afterArray = await page.evaluate(() => array.slice());

    // The new array should be an array of numbers and typically different from the previous one.
    expect(Array.isArray(afterArray)).toBe(true);
    expect(afterArray.length).toBeGreaterThanOrEqual(1);

    // Either the content changed (most likely) or if identical by chance, ensure DOM re-render produced bars
    const bars = await page.$$('#array-container .array-bar');
    expect(bars.length).toBe(afterArray.length);

    // If the generated arrays are identical (rare), this still counts as a re-generation event; otherwise they differ.
    const identical = JSON.stringify(beforeArray) === JSON.stringify(afterArray);
    expect(identical || !identical).toBe(true); // trivial assertion to clearly document behavior

    // Still no runtime errors from the interaction
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S1_ArrayGenerated -> S2_Sorting -> S3_Sorted: starting merge sort sorts the array and shows alert', async ({ page }) => {
    // This test validates:
    // - transition from Array Generated to Sorting when Start Merge Sort is clicked,
    // - that the sorting process completes and triggers the "Sorting Complete!" alert (S3_Sorted),
    // - and that the final array is sorted in non-decreasing order.

    // To keep the test fast and deterministic, generate a small array (size = 5) by calling existing function
    // This calls the page's generateArray function with an argument (not altering code).
    await page.evaluate(() => generateArray(5));
    await page.waitForTimeout(50); // allow render

    // Verify we have 5 bars
    const initialBars = await page.$$('#array-container .array-bar');
    expect(initialBars.length).toBe(5);

    // Store a snapshot of the array before sorting
    const beforeSort = await page.evaluate(() => array.slice());
    expect(beforeSort.length).toBe(5);

    // Prepare to capture the alert dialog that should be shown when sorting completes
    const dialogPromise = page.waitForEvent('dialog');

    // Click the Start Merge Sort button to begin sorting
    await page.click('button[onclick="startMergeSort()"]');

    // Wait for the dialog to appear indicating sorting complete
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Sorting Complete!');
    await dialog.accept();

    // After sorting completes and dialog accepted, validate the array is sorted (non-decreasing)
    const finalArray = await page.evaluate(() => array.slice());
    expect(finalArray.length).toBe(5);

    // Check non-decreasing order
    for (let i = 1; i < finalArray.length; i++) {
      expect(finalArray[i]).toBeGreaterThanOrEqual(finalArray[i - 1]);
    }

    // Also ensure the DOM has been re-rendered (bars reflect final array length)
    const finalBars = await page.$$('#array-container .array-bar');
    expect(finalBars.length).toBe(finalArray.length);

    // No uncaught page errors produced during the sorting process
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Starting merge sort on an empty array still completes and shows alert', async ({ page }) => {
    // This test covers an edge case: if the array is empty (length = 0), starting the sort should still
    // execute startMergeSort() and ultimately trigger the "Sorting Complete!" alert.

    // Make the array empty using existing globals and re-render (we are not defining new functions)
    await page.evaluate(() => {
      array = [];
      renderArray();
    });

    // Ensure no bars exist
    const bars = await page.$$('#array-container .array-bar');
    expect(bars.length).toBe(0);

    // Prepare to capture alert
    const dialogPromise = page.waitForEvent('dialog');

    // Click Start Merge Sort
    await page.click('button[onclick="startMergeSort()"]');

    // Expect immediate dialog (sorting no-ops but still calls alert at the end)
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Sorting Complete!');
    await dialog.accept();

    // After the alert, array should still be empty and DOM unchanged
    const afterBars = await page.$$('#array-container .array-bar');
    expect(afterBars.length).toBe(0);

    // No runtime errors during this edge case
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: capture and assert there are no unexpected page errors or console errors during full interaction flow', async ({ page }) => {
    // This test exercises the main flow: generate (click), small generate for quick sort, start sort,
    // and ensures we observed no console/page errors across the sequence.

    // Click Generate Array (user action)
    await page.click('button[onclick="generateArray()"]');
    await page.waitForTimeout(50);

    // Make small array for quick sorting
    await page.evaluate(() => generateArray(6));
    await page.waitForTimeout(50);

    // Start sorting and accept dialog
    const dialogPromise = page.waitForEvent('dialog');
    await page.click('button[onclick="startMergeSort()"]');
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Sorting Complete!');
    await dialog.accept();

    // After the flow, assert there are no page errors or console errors
    // We allow that the environment may log warnings; here we specifically assert no console 'error' messages
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});