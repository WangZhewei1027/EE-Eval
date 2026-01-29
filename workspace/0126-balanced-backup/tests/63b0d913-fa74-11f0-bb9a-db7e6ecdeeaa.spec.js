import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b0d913-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Increase the default timeout because the visualization uses real-time delays
test.setTimeout(120000);

test.describe('Bubble Sort Visualization (FSM) - 63b0d913-fa74-11f0-bb9a-db7e6ecdeeaa', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Setup: navigate to the page and capture console / page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Ensure the main UI is present before tests run
    await expect(page.locator('#array-container')).toBeVisible();
    await expect(page.locator('#start-btn')).toBeVisible();
  });

  test.describe('S0_Idle (Initial state)', () => {
    test('Initial render: array container has 20 bars, heights match displayed values, and render/bubble functions exist', async ({ page }) => {
      // Validate number of bars equals ARRAY_SIZE (20)
      const bars = await page.$$('#array-container .bar');
      expect(bars.length).toBe(20);

      // Validate that each bar's text content is numeric and matches its inline height style
      const texts = await page.$$eval('#array-container .bar', nodes => nodes.map(n => n.textContent.trim()).map(Number));
      expect(texts.length).toBe(20);
      // Ensure all texts are numbers and within expected range (10..160)
      for (const v of texts) {
        expect(typeof v).toBe('number');
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(10);
        expect(v).toBeLessThanOrEqual(160);
      }

      // Check inline heights correspond to the numeric labels
      const heights = await page.$$eval('#array-container .bar', nodes => nodes.map(n => n.style.height));
      for (let i = 0; i < heights.length; i++) {
        expect(heights[i]).toBe(`${texts[i]}px`);
      }

      // Ensure the functions referenced in the FSM/implementation are defined in the page context
      const hasRenderArray = await page.evaluate(() => typeof renderArray === 'function');
      const hasBubbleSort = await page.evaluate(() => typeof bubbleSort === 'function');
      const hasGenerateArray = await page.evaluate(() => typeof generateArray === 'function');

      expect(hasRenderArray).toBe(true);
      expect(hasBubbleSort).toBe(true);
      expect(hasGenerateArray).toBe(true);

      // No script errors should have occurred on initial load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transitions and Sorting behavior (S0 -> S1 -> S2)', () => {
    test('S0 -> S1: Clicking Start disables the button and visual "comparing" highlights appear', async ({ page }) => {
      // Capture initial array for later comparison
      const initialNumbers = await page.$$eval('#array-container .bar', nodes => nodes.map(n => Number(n.textContent.trim())));
      expect(initialNumbers.length).toBe(20);

      // Click the Start Bubble Sort button to trigger transition from Idle to Sorting
      await page.click('#start-btn');

      // Immediately after click, the button should be disabled (exit action of S0 -> S1)
      const disabledAfterClick = await page.$eval('#start-btn', btn => btn.disabled);
      expect(disabledAfterClick).toBe(true);

      // During sorting we expect visual "comparing" feedback to appear at least once
      // Wait for any bar to get the .comparing class
      await page.waitForSelector('.bar.comparing', { timeout: 60000 });

      // It is possible that no .swapped class appears if the array was already sorted;
      // but we should at least detect comparing highlights to confirm the algorithm started.
      const comparingCount = await page.$$eval('.bar.comparing', nodes => nodes.length);
      expect(comparingCount).toBeGreaterThan(0);

      // Verify there were no page runtime errors while sorting was running
      expect(pageErrors.length).toBe(0);
    });

    test('S1 -> S2: After sorting completes, button is enabled, highlights cleared, and final array is sorted', async ({ page }) => {
      // Capture an initial snapshot of numbers
      const initialNumbers = await page.$$eval('#array-container .bar', nodes => nodes.map(n => Number(n.textContent.trim())));
      expect(initialNumbers.length).toBe(20);

      // Start sorting
      await page.click('#start-btn');

      // Ensure button is disabled shortly after click
      await page.waitForFunction(() => document.getElementById('start-btn').disabled === true, { timeout: 5000 });

      // Wait for sorting to complete: start button becomes enabled again (S1 -> S2 transition action)
      await page.waitForFunction(() => !document.getElementById('start-btn').disabled, { timeout: 110000 });

      // Now the button should be enabled
      const finalDisabled = await page.$eval('#start-btn', btn => btn.disabled);
      expect(finalDisabled).toBe(false);

      // After final render (S2 entry action), no bars should have comparing or swapped classes
      const comparingFinal = await page.$$eval('#array-container .bar.comparing', nodes => nodes.length);
      const swappedFinal = await page.$$eval('#array-container .bar.swapped', nodes => nodes.length);
      expect(comparingFinal).toBe(0);
      expect(swappedFinal).toBe(0);

      // The final array (as read from the DOM) should be sorted in non-decreasing order
      const finalNumbers = await page.$$eval('#array-container .bar', nodes => nodes.map(n => Number(n.textContent.trim())));
      expect(finalNumbers.length).toBe(initialNumbers.length);
      for (let i = 1; i < finalNumbers.length; i++) {
        expect(finalNumbers[i - 1]).toBeLessThanOrEqual(finalNumbers[i]);
      }

      // Confirm no runtime page errors occurred during the full sorting process
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Click while disabled: Start button should prevent repeated starts (button remains disabled while sorting)', async ({ page }) => {
      // Start sorting
      const initialNumbers = await page.$$eval('#array-container .bar', nodes => nodes.map(n => Number(n.textContent.trim())));
      await page.click('#start-btn');

      // Confirm the button is disabled
      await page.waitForFunction(() => document.getElementById('start-btn').disabled === true, { timeout: 5000 });

      // Attempt to programmatically click the button (this simulates a user trying to click again)
      // Note: clicking a disabled HTMLButtonElement does nothing; we assert button remains disabled.
      await page.evaluate(() => {
        const b = document.getElementById('start-btn');
        // call click() - native click on disabled button is a no-op in standard browsers
        try { b.click(); } catch (e) { /* ignore errors from test harness - not expected */ }
      });

      // Still disabled until sorting completes
      const stillDisabled = await page.$eval('#start-btn', btn => btn.disabled);
      expect(stillDisabled).toBe(true);

      // Wait for sorting to complete
      await page.waitForFunction(() => !document.getElementById('start-btn').disabled, { timeout: 110000 });

      // After completion, button is enabled again
      const finalDisabled = await page.$eval('#start-btn', btn => btn.disabled);
      expect(finalDisabled).toBe(false);

      // No runtime errors occurred
      expect(pageErrors.length).toBe(0);
    });

    test('Edge behavior when initial array is already sorted: algorithm may not produce .swapped visuals', async ({ page }) => {
      // Capture initial array
      const initialNumbers = await page.$$eval('#array-container .bar', nodes => nodes.map(n => Number(n.textContent.trim())));

      // Helper to determine if an array is already non-decreasing
      const isSorted = (arr) => {
        for (let i = 1; i < arr.length; i++) {
          if (arr[i - 1] > arr[i]) return false;
        }
        return true;
      };

      await page.click('#start-btn');

      // Wait for at least one comparing highlight to show the algorithm started
      await page.waitForSelector('.bar.comparing', { timeout: 60000 });

      // Wait for sorting completion
      await page.waitForFunction(() => !document.getElementById('start-btn').disabled, { timeout: 110000 });

      // Count swapped visuals that may have appeared during sorting
      // Note: If initialNumbers were already sorted, swapped may be 0 by design (early exit)
      const swappedDuring = await page.$$eval('#array-container .bar.swapped', nodes => nodes.length);

      // If swappedDuring === 0 then initialNumbers must have been already sorted (edge case)
      if (swappedDuring === 0) {
        // Confirm the initial array was indeed sorted
        expect(isSorted(initialNumbers)).toBe(true);
      } else {
        // If swaps occurred, final array must be sorted
        const finalNumbers = await page.$$eval('#array-container .bar', nodes => nodes.map(n => Number(n.textContent.trim())));
        for (let i = 1; i < finalNumbers.length; i++) {
          expect(finalNumbers[i - 1]).toBeLessThanOrEqual(finalNumbers[i]);
        }
      }

      // No unhandled runtime errors occurred
      expect(pageErrors.length).toBe(0);
    });

    test('Implementation functions exist and are not throwing on invocation boundaries (observational checks only)', async ({ page }) => {
      // We must not modify or patch the page implementation per instructions.
      // Here we only check that calling typeof on key functions is safe (does not throw)
      const types = await page.evaluate(() => {
        return {
          renderArrayType: typeof renderArray,
          bubbleSortType: typeof bubbleSort,
          generateArrayType: typeof generateArray,
          sleepType: typeof sleep
        };
      });
      expect(types.renderArrayType).toBe('function');
      expect(types.bubbleSortType).toBe('function');
      expect(types.generateArrayType).toBe('function');
      expect(types.sleepType).toBe('function');

      // No runtime errors captured
      expect(pageErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // As part of teardown, assert that no uncaught errors were silently emitted to the page
    // This is a final sanity check for each test
    expect(pageErrors.length).toBe(0);

    // Optionally log console messages for debugging if needed (kept minimal)
    // If needed, tests could assert specific console messages here
    // consoleMessages.forEach(m => console.log(m.type, m.text));
  });
});