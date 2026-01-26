import { test, expect } from '@playwright/test';

test.setTimeout(120000); // allow enough time for the full animation to complete

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a9de41-fa78-11f0-812d-c9788050701f.html';

test.describe('Counting Sort Visualization - FSM states and transitions', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application page exactly as provided
    await page.goto(APP_URL);
    // Ensure the page is fully loaded and initial DOM is ready
    await expect(page.locator('#stepIndicator')).toHaveText('Initial array');
  });

  test.afterEach(async ({ page }) => {
    // For debugging purposes, if there were errors, print them to test output
    if (pageErrors.length) {
      /* eslint-disable no-console */
      console.log('Captured page errors:', pageErrors);
      /* eslint-enable no-console */
    }
    if (consoleMessages.length) {
      /* eslint-disable no-console */
      console.log('Captured console messages:', consoleMessages.slice(0, 20));
      /* eslint-enable no-console */
    }
    // Final assertion: tests expect no unexpected runtime errors on the page
    expect(pageErrors.length, 'There should be no runtime page errors').toBe(0);
  });

  test('S0_Initialized: Initial state verification', async ({ page }) => {
    // Validate initial visual state per FSM S0_Initialized
    // - stepIndicator text is 'Initial array'
    // - arrayContainer populated with original array elements
    // - countArrayContainer populated with count elements
    // - resetBtn is disabled
    const stepIndicator = page.locator('#stepIndicator');
    const arrayElements = page.locator('#arrayContainer .array-element');
    const countElements = page.locator('#countArrayContainer .count-element');
    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');

    await expect(stepIndicator).toHaveText('Initial array');
    await expect(startBtn).toBeEnabled();
    await expect(resetBtn).toBeDisabled();

    // Original array in the implementation: [4,2,2,8,3,3,1] -> length 7
    await expect(arrayElements).toHaveCount(7);

    // Max value is 8 so count array should have 9 elements (0..8)
    await expect(countElements).toHaveCount(9);

    // All count elements should initially show '0'
    const counts = await countElements.allTextContents();
    counts.forEach((txt) => expect(txt.trim()).toBe('0'));
  });

  test('StartSorting event and transitions: S0 -> S1 -> S2 -> S3 -> S4', async ({ page }) => {
    // This test walks through the entire animation and validates FSM transitions:
    // - Click Start Sorting (StartSorting event) -> S1_CountingPhase
    // - After counting completes -> S2_ModifyingCountArray
    // - After modification -> S3_SortingPhase
    // - After sorting completes -> S4_SortingComplete
    //
    // For each transition we assert the stepIndicator text, button states, and DOM effects.

    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');
    const stepIndicator = page.locator('#stepIndicator');
    const arrayContainer = page.locator('#arrayContainer');
    const countElements = page.locator('#countArrayContainer .count-element');

    // Trigger StartSorting event
    await startBtn.click();

    // Immediately after clicking, per FSM/implementation buttons should be disabled
    await expect(startBtn).toBeDisabled();
    await expect(resetBtn).toBeDisabled();

    // Wait for Counting Phase to begin (the animation sets this text on the first interval tick)
    await page.waitForFunction(
      () => document.getElementById('stepIndicator')?.textContent?.includes('Counting phase'),
      null,
      { timeout: 15000 }
    );
    await expect(stepIndicator).toHaveText('Counting phase: counting occurrences of each element');

    // Wait for Modifying Count Array phase
    await page.waitForFunction(
      () => document.getElementById('stepIndicator')?.textContent?.includes('Modifying count array'),
      null,
      { timeout: 40000 }
    );
    await expect(stepIndicator).toHaveText('Modifying count array: cumulative counts');

    // At the moment modifying begins, the raw counts should have been computed.
    // Validate that the sum of counts equals the original array length (7)
    const countsAfterCounting = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#countArrayContainer .count-element'))
        .map(el => parseInt(el.textContent || '0', 10));
    });
    const sumCounts = countsAfterCounting.reduce((s, v) => s + (Number.isFinite(v) ? v : 0), 0);
    expect(sumCounts).toBe(7);

    // Wait for Sorting Phase
    await page.waitForFunction(
      () => document.getElementById('stepIndicator')?.textContent?.includes('Sorting phase'),
      null,
      { timeout: 40000 }
    );
    await expect(stepIndicator).toHaveText('Sorting phase: placing elements in correct positions');

    // Wait for Sorting Complete final state
    await page.waitForFunction(
      () => document.getElementById('stepIndicator')?.textContent?.includes('Sorting complete'),
      null,
      { timeout: 40000 }
    );
    await expect(stepIndicator).toHaveText('Sorting complete!');

    // After completion:
    // - startBtn should remain disabled (implementation sets startBtn.disabled = true)
    // - resetBtn should be enabled
    await expect(startBtn).toBeDisabled();
    await expect(resetBtn).toBeEnabled();

    // There should be sorted elements appended with class 'sorted' equal to original array length (7)
    const sortedCount = await page.locator('.array-element.sorted').count();
    expect(sortedCount).toBe(7);

    // Validate that the cumulative effect of sorting produced a visual sorted output:
    // The sorted elements should contain the values in non-decreasing order.
    const sortedValues = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.array-element.sorted')).map(el => parseInt(el.textContent || '', 10));
    });
    const sortedCopy = [...sortedValues].sort((a, b) => a - b);
    expect(sortedValues).toEqual(sortedCopy);
  });

  test('ResetSorting event: S4 -> S0 and re-initialization behavior', async ({ page }) => {
    // This test ensures that Reset works after sorting has completed:
    // - Run the animation to completion
    // - Click Reset (ResetSorting event)
    // - Verify the application returns to the Initialized state (S0_Initialized)
    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');
    const stepIndicator = page.locator('#stepIndicator');
    const arrayElements = page.locator('#arrayContainer .array-element');
    const countElements = page.locator('#countArrayContainer .count-element');

    // Start and wait for final state (reuse waiting approach)
    await startBtn.click();
    await page.waitForFunction(
      () => document.getElementById('stepIndicator')?.textContent === 'Sorting complete!',
      null,
      { timeout: 90000 }
    );
    await expect(resetBtn).toBeEnabled();

    // Click Reset to trigger re-initialization
    await resetBtn.click();

    // After reset, the FSM should be back in Initialized state
    await expect(stepIndicator).toHaveText('Initial array');

    // resetBtn should be disabled again and startBtn enabled
    await expect(resetBtn).toBeDisabled();
    await expect(startBtn).toBeEnabled();

    // Array container should contain the original 7 array elements and no 'sorted' elements
    await expect(arrayElements).toHaveCount(7);
    const sortedAfterReset = await page.locator('.array-element.sorted').count();
    expect(sortedAfterReset).toBe(0);

    // Count elements should be reset to zeros
    const counts = await countElements.allTextContents();
    counts.forEach((txt) => expect(txt.trim()).toBe('0'));
  });

  test('Edge case checks: button states during animation and no unintended interactions', async ({ page }) => {
    // This test verifies that:
    // - Start button becomes disabled immediately after click
    // - Reset button remains disabled during the animation
    // - The UI resists clicks on disabled controls (we simply assert disabled state instead of forcing clicks)
    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');

    await startBtn.click();

    // Immediately after starting, both buttons should be disabled per implementation
    await expect(startBtn).toBeDisabled();
    await expect(resetBtn).toBeDisabled();

    // Attempting to click the disabled reset button should not be possible via normal user action.
    // We assert the disabled state rather than forcing a click (which would violate natural user behavior).
    const resetDisabled = await resetBtn.isDisabled();
    expect(resetDisabled).toBe(true);
  });
});