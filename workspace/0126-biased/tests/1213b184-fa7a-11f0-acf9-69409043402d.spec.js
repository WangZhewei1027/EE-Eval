import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1213b184-fa7a-11f0-acf9-69409043402d.html';

// Utility to parse the array text displayed in #arrayState pre
async function parseArrayStateText(page) {
  const text = await page.locator('#arrayState').textContent();
  if (!text) return [];
  // The display shows two lines: values line and indices line. We only need the first line.
  const firstLine = text.split('\n')[0] || '';
  const parts = firstLine.trim().split(/\s+/).filter(Boolean);
  return parts.map(p => {
    // padded numbers may include signs; parseInt handles it
    const n = parseInt(p, 10);
    return isNaN(n) ? null : n;
  }).filter(x => x !== null);
}

test.describe('Quick Sort Interactive Explorer - FSM and UI behaviors', () => {
  // Collect console messages and page errors for each test run.
  test.beforeEach(async ({ page }) => {
    // Attach listeners for diagnostics
    page.context().clearCookies && await page.context().clearCookies().catch(()=>{});
  });

  test('Initial load: init() runs and page shows expected initial state (S0_Idle entry)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Verify the status area shows the initialization message from init()
    const status = await page.locator('#statusArea').textContent();
    expect(status).toBeTruthy();
    expect(status).toContain('Ready to sort');

    // Verify the arrayState shows the initial array digits (from input value "5,2,9,1,5,6")
    const arr = await parseArrayStateText(page);
    expect(arr.length).toBeGreaterThan(0);
    // Should contain the numbers from the default value
    expect(arr).toEqual(expect.arrayContaining([5,2,9,1,5,6]));

    // Call stack and subarrays displays are initially hidden
    const callStackDisplay = await page.locator('#callStackDisplay').evaluate(el => el.style.display);
    const subarraysDisplay = await page.locator('#subarraysDisplay').evaluate(el => el.style.display);
    expect(callStackDisplay === 'none' || callStackDisplay === '' ).toBeTruthy();
    expect(subarraysDisplay === 'none' || subarraysDisplay === '' ).toBeTruthy();

    // Ensure no uncaught page errors occurred during init
    expect(pageErrors.length).toBe(0);
    // Collect any console.error messages if present and fail if there are severe errors
    const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errors.length).toBe(0);
  });

  test('LoadArray event: loading a custom array transitions to Array Loaded (S1_ArrayLoaded)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Replace the input with a new array and click Load Array
    const input = page.locator('#arrayInput');
    await input.fill('3, 1, 4, 1, 5');
    await page.locator('#loadArrayBtn').click();

    // After clicking, statusArea should reflect loaded state per FSM transition
    await expect(page.locator('#statusArea')).toHaveText(/Loaded array and ready to sort\./);

    // The displayed array should match the loaded array
    const arr = await parseArrayStateText(page);
    expect(arr).toEqual([3,1,4,1,5]);

    // There should be no page-level JS errors
    expect(pageErrors.length).toBe(0);
  });

  test('RandomArray event: generates a random array, updates input and status (S1_ArrayLoaded)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Set random size and max to small values and click Random Array
    await page.locator('#randomSize').fill('8');
    await page.locator('#randomMax').fill('20');
    await page.locator('#randomArrayBtn').click();

    // Status should indicate random array generated
    await expect(page.locator('#statusArea')).toHaveText(/Random array generated and ready\./);

    // The array input should have been updated to include numbers separated by commas
    const inputVal = await page.locator('#arrayInput').inputValue();
    const parsed = inputVal.split(/[\s,]+/).filter(Boolean).map(s => parseInt(s,10));
    expect(parsed.length).toBeGreaterThanOrEqual(1);
    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('ChangePivotStrategy event: selecting pivot updates strategy and resets working array', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Change pivot strategy to 'middle'
    await page.locator('#pivotStrategy').selectOption('middle');

    // Status should reflect pivot strategy change
    await expect(page.locator('#statusArea')).toHaveText(/Pivot strategy changed to 'middle'\. Reset and ready\./);

    // The working array should have been reset to the original array (from input)
    const arr = await parseArrayStateText(page);
    expect(arr.length).toBeGreaterThan(0);

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Step event: perform stepwise sorting until sorted (S1_ArrayLoaded -> S2_Sorting -> S3_Sorted)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Ensure a known array so behavior is deterministic
    await page.locator('#arrayInput').fill('4,3,2,1');
    await page.locator('#loadArrayBtn').click();
    await expect(page.locator('#statusArea')).toHaveText(/Loaded array and ready to sort\./);

    // Step repeatedly until the status indicates sorting complete.
    // We guard with a reasonable loop count to avoid infinite loops.
    let iterations = 0;
    const maxIter = 100;
    while (iterations < maxIter) {
      iterations++;
      await page.locator('#stepBtn').click();

      const status = (await page.locator('#statusArea').textContent()) || '';
      // If step executed, status might be "Step executed." or final "Sorting complete."
      if (status.includes('Sorting complete')) break;

      // Small wait for DOM updates
      await page.waitForTimeout(20);
    }

    // Expect that we exited due to sorting complete and not by hitting the max iterations
    expect(iterations).toBeLessThan(maxIter);

    // After complete, verify the array displayed is sorted ascending
    const arr = await parseArrayStateText(page);
    for (let i = 1; i < arr.length; i++) {
      expect(arr[i-1]).toBeLessThanOrEqual(arr[i]);
    }

    // Status should indicate sorted
    await expect(page.locator('#statusArea')).toHaveText(/Sorting complete/);

    // No page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('AutoRun and Pause events: start auto-run and pause mid-run (S1_ArrayLoaded -> S2_Sorting)', async ({ page }) => {
    // This test intentionally exercises timing aspects. Keep console/page error collection.
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Create a larger array so auto-run takes some time
    await page.locator('#randomSize').fill('30');
    await page.locator('#randomMax').fill('100');
    await page.locator('#randomArrayBtn').click();
    await expect(page.locator('#statusArea')).toHaveText(/Random array generated and ready\./);

    // Set auto-run speed to minimal to proceed fast
    await page.locator('#speedRange').evaluate((el, v) => { el.value = v; }, '20');
    // Update speedDisplay by firing input event
    await page.locator('#speedRange').dispatchEvent('input');

    // Start auto-run
    await page.locator('#autoRunBtn').click();
    await expect(page.locator('#statusArea')).toHaveText(/Auto run started\./);

    // Pause shortly after to ensure we can detect the "Auto run paused." status
    await page.waitForTimeout(50);
    await page.locator('#pauseBtn').click();

    // When paused, statusArea should be "Auto run paused."
    // Note: stopAutoRun sets statusArea.textContent = "Auto run paused.";
    await expect(page.locator('#statusArea')).toHaveText(/Auto run paused\./);

    // Ensure no page errors and no console.error entries
    const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Reset while sorting: reset to original array and verify status (S2_Sorting -> S1_ArrayLoaded)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Load a sortable array
    await page.locator('#arrayInput').fill('9,7,8,1,2');
    await page.locator('#loadArrayBtn').click();

    // Perform a step to enter sorting
    await page.locator('#stepBtn').click();
    // Ensure we are in a partitioning/step state
    const statusBefore = await page.locator('#statusArea').textContent();
    expect(statusBefore).toBeTruthy();

    // Now click reset
    await page.locator('#resetBtn').click();
    await expect(page.locator('#statusArea')).toHaveText(/Reset to original array\./);

    // The array display should be equal to the original array values
    const arr = await parseArrayStateText(page);
    expect(arr).toEqual(expect.arrayContaining([9,7,8,1,2]));

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Undo, Redo and JumpToStep events: history navigation works and updates status', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Load a simple array to control steps
    await page.locator('#arrayInput').fill('4,3,2,1');
    await page.locator('#loadArrayBtn').click();

    // Perform 3 steps to create history entries
    await page.locator('#stepBtn').click();
    await page.locator('#stepBtn').click();
    await page.locator('#stepBtn').click();

    // Undo once
    await page.locator('#undoBtn').click();
    // Status should include "Undo to step"
    await expect(page.locator('#statusArea')).toHaveText(/Undo to step \d+/);

    // Redo back
    await page.locator('#redoBtn').click();
    await expect(page.locator('#statusArea')).toHaveText(/Redo to step \d+/);

    // Jump to step 0 and check status
    await page.locator('#jumpToStepInput').fill('0');
    // Listen for potential alert on invalid step; should not happen
    page.on('dialog', async dialog => {
      // If a dialog appears, fail the test by rejecting it (we'll assert none should appear for a valid step)
      await dialog.dismiss();
    });
    await page.locator('#jumpToStepBtn').click();
    await expect(page.locator('#statusArea')).toHaveText(/Jumped to step 0/);

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Toggle Call Stack and Subarrays views: visibility toggles and button labels change', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Initial callStackDisplay should be hidden
    const callStackDisplayInitial = await page.locator('#callStackDisplay').evaluate(el => el.style.display);
    expect(callStackDisplayInitial === 'none' || callStackDisplayInitial === '').toBeTruthy();

    // Click Toggle Call Stack button
    await page.locator('#showCallStackBtn').click();
    // Now callStackDisplay should be visible and button text should change
    const callStackDisplayAfter = await page.locator('#callStackDisplay').evaluate(el => el.style.display);
    expect(callStackDisplayAfter).toBe('block');
    const btnTextAfter = await page.locator('#showCallStackBtn').textContent();
    expect(btnTextAfter).toBe('Hide Call Stack');

    // Toggle back
    await page.locator('#showCallStackBtn').click();
    const callStackDisplayHiddenAgain = await page.locator('#callStackDisplay').evaluate(el => el.style.display);
    expect(callStackDisplayHiddenAgain).toBe('none');
    const btnTextShow = await page.locator('#showCallStackBtn').textContent();
    // After hiding the code sets "Show Call Stack"
    expect(btnTextShow).toBe('Show Call Stack');

    // Subarrays toggle
    const subBefore = await page.locator('#subarraysDisplay').evaluate(el => el.style.display);
    expect(subBefore === 'none' || subBefore === '').toBeTruthy();

    await page.locator('#showSubarraysBtn').click();
    const subAfter = await page.locator('#subarraysDisplay').evaluate(el => el.style.display);
    expect(subAfter).toBe('block');
    const subBtnText = await page.locator('#showSubarraysBtn').textContent();
    expect(subBtnText).toBe('Hide Subarrays View');

    // Toggle back
    await page.locator('#showSubarraysBtn').click();
    const subHiddenAgain = await page.locator('#subarraysDisplay').evaluate(el => el.style.display);
    expect(subHiddenAgain).toBe('none');
    const subBtnText2 = await page.locator('#showSubarraysBtn').textContent();
    expect(subBtnText2).toBe('Show Subarrays View');

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: invalid array input triggers alert and does not load (error scenario)', async ({ page }) => {
    await page.goto(APP_URL);

    // Intercept dialogs to assert the alert text
    let dialogMessage = null;
    page.on('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    // Fill invalid input and click load
    await page.locator('#arrayInput').fill('a, b, c');
    await page.locator('#loadArrayBtn').click();

    // Expect an alert to have happened with the invalid input message
    expect(dialogMessage).toBeTruthy();
    expect(dialogMessage).toContain('Invalid input array');

    // Status area should not be updated to "Loaded array and ready to sort."
    const status = await page.locator('#statusArea').textContent();
    expect(status).not.toContain('Loaded array and ready to sort.');
  });

  test('No unexpected runtime errors (ReferenceError / TypeError / SyntaxError) occur during standard interactions', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Perform a sequence of typical interactions to surface any runtime errors
    await page.locator('#stepBtn').click();
    await page.locator('#undoBtn').click();
    await page.locator('#redoBtn').click();
    await page.locator('#showCallStackBtn').click();
    await page.locator('#showSubarraysBtn').click();
    await page.locator('#speedRange').dispatchEvent('input');

    // Allow a short time for any asynchronous errors to surface
    await page.waitForTimeout(100);

    // Assert that no page errors were observed during these interactions
    expect(pageErrors.length).toBe(0);
  });
});