import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e162010-d5c5-11f0-92ee-f5994b4f4c99.html';

test.describe('Heap FSM - Interactive Application (0e162010-d5c5-11f0-92ee-f5994b4f4c99)', () => {

  // Test the initial Idle state (S0_Idle)
  test('Initial Idle state: button exists, #heap empty, global heap initialized, and page error observed on load', async ({ page }) => {
    // Collect page errors (runtime errors) and console error messages
    const pageErrors = [];
    page.on('pageerror', (err) => {
      // pageerror emits Error objects for unhandled exceptions
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        // also capture console error messages
        pageErrors.push(new Error(msg.text()));
      }
    });

    // Navigate to the page
    await page.goto(APP_URL);

    // Verify the Create Heap button is present and visible (evidence for Idle state)
    const btn = await page.waitForSelector("button[onclick='createHeap()']", { state: 'visible', timeout: 2000 });
    expect(btn).not.toBeNull();
    // Verify the visual component #heap exists and is initially empty
    const heapEl = await page.waitForSelector('#heap', { state: 'attached' });
    expect(heapEl).not.toBeNull();
    const heapText = (await heapEl.textContent()) || '';
    expect(heapText.trim()).toBe('');

    // Verify a global heap array exists (script defines var heap = [])
    const hasHeapArray = await page.evaluate(() => Array.isArray(window.heap));
    expect(hasHeapArray).toBe(true);
    const heapLength = await page.evaluate(() => window.heap.length);
    expect(heapLength).toBe(0);

    // Allow a small delay for the runtime error (from the invalid function call in the page script) to be emitted
    await page.waitForTimeout(100);

    // There should be at least one runtime error caused by the unexpected call "共产ize(1, 2, 3, 4);"
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Combine messages and assert the ReferenceError about the missing identifier appears
    const combinedMessages = pageErrors.map(e => (e && e.message) ? e.message : String(e)).join(' | ');
    // The page contains a call to a non-existent function named "共产ize", ensure that appears in error text
    expect(combinedMessages).toContain('共产ize');
    // Also assert typical "not defined" / ReferenceError text is present (case-insensitive)
    expect(combinedMessages.toLowerCase()).toContain('not defined');
  });

  // Test the CreateHeap event/transition: clicking the button should invoke createHeap() and update the heap array
  test('CreateHeap event: clicking button appends 4 random integers (0..3) to heap; visual not updated and updateHeapDisplay missing', async ({ page }) => {
    // Capture runtime errors but do not fail the test just because the page had the pre-existing error
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => { if (msg.type() === 'error') pageErrors.push(new Error(msg.text())); });

    await page.goto(APP_URL);

    // Confirm createHeap exists as a function on the page
    const createType = await page.evaluate(() => typeof window.createHeap);
    expect(createType).toBe('function');

    // Confirm initial heap length is 0
    const initialLen = await page.evaluate(() => window.heap.length);
    expect(initialLen).toBe(0);

    // Click the Create Heap button (trigger the CreateHeap event & transition S0 -> S1)
    await page.click("button[onclick='createHeap()']");

    // After the click, createHeap pushes 4 values to the heap array
    const newLen = await page.evaluate(() => window.heap.length);
    expect(newLen).toBe(initialLen + 4);

    // Validate the newly added values are integers in the range [0, 3]
    const addedValues = await page.evaluate(() => window.heap.slice(-4));
    expect(Array.isArray(addedValues)).toBe(true);
    expect(addedValues.length).toBe(4);
    for (const v of addedValues) {
      // each value should be an integer
      expect(Number.isInteger(v)).toBe(true);
      // random values should be within 0..3 inclusive
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
    }

    // The FSM mentions updateHeapDisplay() as an entry action for S1, but the implementation does not define it.
    // Verify updateHeapDisplay is undefined (i.e., not called / not present)
    const updateType = await page.evaluate(() => typeof window.updateHeapDisplay);
    expect(updateType).toBe('undefined');

    // Verify the visual (#heap) was not updated by the page (no DOM update logic provided)
    const heapTextAfter = (await page.$eval('#heap', el => el.textContent)).trim();
    expect(heapTextAfter).toBe('');

    // Ensure pre-existing reference error is still present (from page load). Clicking should not introduce additional unexpected errors.
    await page.waitForTimeout(50);
    const combined = pageErrors.map(e => (e && e.message) ? e.message : String(e)).join(' | ');
    expect(combined).toContain('共产ize');
  });

  // Edge case: multiple clicks append multiple groups of 4 elements
  test('Edge case: repeated CreateHeap clicks append cumulatively to heap', async ({ page }) => {
    await page.goto(APP_URL);

    // Click twice
    await page.click("button[onclick='createHeap()']");
    await page.click("button[onclick='createHeap()']");

    // Expect 8 items in the heap after two clicks
    const len = await page.evaluate(() => window.heap.length);
    expect(len).toBe(8);

    // Check that the values are still integers in [0,3]
    const values = await page.evaluate(() => window.heap.slice(-8));
    expect(values.length).toBe(8);
    for (const v of values) {
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
    }
  });

  // Validate that createHeap is callable via evaluate and returns undefined (no explicit return)
  test('Calling createHeap programmatically returns undefined and mutates heap as expected', async ({ page }) => {
    await page.goto(APP_URL);

    // Programmatically call createHeap() and capture its return value
    const ret = await page.evaluate(() => {
      // call and return the function's return value (should be undefined)
      return createHeap();
    });
    expect(ret).toBeUndefined();

    // And verify the side-effect: heap length increased by 4
    const length = await page.evaluate(() => window.heap.length);
    expect(length).toBe(4);
  });

  // Explicitly assert that a ReferenceError occurred on page load for the invalid function name
  test('Page load should emit a ReferenceError due to the missing function "共产ize"', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(err));
    await page.goto(APP_URL);
    // wait briefly to ensure event delivery
    await page.waitForTimeout(100);

    // There must be at least one runtime error and one should reference the missing identifier
    expect(errors.length).toBeGreaterThanOrEqual(1);
    const found = errors.some(e => {
      const msg = (e && e.message) ? e.message : String(e);
      return msg.includes('共产ize') || msg.includes('Not defined') || /ReferenceError/i.test(msg);
    });
    expect(found).toBe(true);
  });

});