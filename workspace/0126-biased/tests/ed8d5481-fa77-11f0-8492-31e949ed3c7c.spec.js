import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8d5481-fa77-11f0-8492-31e949ed3c7c.html';

test.describe('Selection Sort Visualization (FSM) - ed8d5481-fa77-11f0-8492-31e949ed3c7c', () => {
  // Collect console.error messages and uncaught page errors for each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages from the page
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is; do not patch or modify
    await page.goto(APP_URL);
    // Wait a short while to ensure initial scripts (createBars) have run
    await page.waitForLoadState('networkidle');
  });

  test.afterEach(async () => {
    // No teardown modifications required. Data arrays reset in beforeEach.
  });

  test('S0_Idle - initial state: createBars executed, bars rendered, start enabled', async ({ page }) => {
    // Validate the initial (Idle) state:
    // - createBars(array) should run on load producing .bar elements
    // - startButton should be enabled (startButton.disabled = false)
    // - no bars should be marked as sorted initially
    // - no runtime console errors or page errors happened during load

    // Check start button exists and is enabled
    const start = page.locator('#start');
    await expect(start).toBeVisible();
    await expect(start).toBeEnabled();

    // There should be 15 bars rendered as per barCount variable
    const bars = page.locator('#container .bar');
    await expect(bars).toHaveCount(15);

    // None should have the 'sorted' class yet in Idle
    const sortedBars = page.locator('#container .bar.sorted');
    await expect(sortedBars).toHaveCount(0);

    // Ensure each bar has a numeric height style set (sanity check on createBars)
    const heights = await page.$$eval('#container .bar', nodes =>
      nodes.map(n => n.style.height)
    );
    // All heights should be non-empty strings like '42px'
    for (const h of heights) {
      expect(typeof h).toBe('string');
      expect(h.length).toBeGreaterThan(0);
      // simple pattern check: should end with 'px'
      expect(h.endsWith('px')).toBe(true);
    }

    // Assert no console errors or page errors occurred during initialization
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S0 -> S1 StartSorting - clicking start disables button and begins sorting', async ({ page }) => {
    // This test validates the transition from Idle (S0) to Sorting (S1):
    // - Clicking #start should disable the button immediately (onEnter action)
    // - selectionSort should begin and at least one bar should become 'active' during process
    // - There should be no uncaught console or page errors during sorting

    const start = page.locator('#start');

    // Click Start Sorting to trigger the Sorting state
    await start.click();

    // After click, start button must be disabled as per FSM evidence (startButton.disabled = true)
    await expect(start).toBeDisabled();

    // Wait for an 'active' bar to appear indicating the sorting process is progressing.
    // selectionSort marks bars with class 'active' during iteration.
    // Use a reasonable timeout to account for varying runtimes.
    await page.waitForFunction(() => !!document.querySelector('.bar.active'), null, { timeout: 3000 });

    // Assert there is at least one active bar
    const activeCount = await page.$$eval('.bar.active', nodes => nodes.length);
    expect(activeCount).toBeGreaterThan(0);

    // Ensure during sorting no console errors or uncaught exceptions have been emitted so far
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S1 -> S2 SortingComplete - after sorting, all bars are marked sorted and button re-enabled', async ({ page }) => {
    // This test validates the transition from Sorting (S1) to Sorted (S2):
    // - After the sorting completes, every .bar should have the 'sorted' class
    // - startButton.disabled should be false again (onExit action)
    // - The visual order of bar heights should be non-decreasing (sorted ascending)
    // - No console or page errors occurred during the whole process

    const start = page.locator('#start');

    // Start sorting
    await start.click();

    // Wait for sorting to finish: all bars should have the 'sorted' class.
    // Give a generous timeout to accommodate runtime differences.
    await page.waitForFunction(() => {
      const bars = document.querySelectorAll('.bar');
      return bars.length > 0 && Array.from(bars).every(b => b.classList.contains('sorted'));
    }, null, { timeout: 10000 });

    // Confirm every bar has 'sorted' class
    const sortedBarsCount = await page.$$eval('.bar.sorted', nodes => nodes.length);
    expect(sortedBarsCount).toBe(15);

    // The start button should be re-enabled after sorting completes
    await expect(start).toBeEnabled();

    // Verify that bar heights are in non-decreasing order (ascending)
    const heightsPx = await page.$$eval('.bar', nodes => nodes.map(n => parseInt(n.style.height, 10)));
    // Confirm array length and sortedness
    expect(heightsPx.length).toBe(15);
    for (let i = 1; i < heightsPx.length; i++) {
      // Non-decreasing check: heights[i] >= heights[i-1]
      expect(heightsPx[i]).toBeGreaterThanOrEqual(heightsPx[i - 1]);
    }

    // Assert no console errors or page errors occurred during sorting
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: attempting to interact while sorting does not produce uncaught exceptions', async ({ page }) => {
    // This test attempts to surface errors when interaction occurs during sorting:
    // - Start the sorting process and try to interact with the UI (e.g., click the start button programmatically)
    // - Ensure no uncaught exceptions or console.error messages occur as a result
    // Note: We do not patch or modify the page; we perform allowed interactions only.

    // Start sorting
    await page.click('#start');

    // Try to programmatically dispatch a click event on the start button while it's disabled.
    // Use page.evaluate to dispatch DOM events; this mimics a user-driven event attempt.
    // We expect the page code to handle disabled state and not throw uncaught exceptions.
    await page.evaluate(() => {
      const btn = document.getElementById('start');
      if (btn) {
        // Attempt to dispatch a click event; the click handler sets disabled synchronously,
        // so this is an attempt to reveal any mishandling of repeated events.
        const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
        try {
          btn.dispatchEvent(ev);
        } catch (e) {
          // Allow errors to surface to the page so that pageerror listener can capture them.
          throw e;
        }
      }
    });

    // Wait for sorting completion to observe possible deferred errors
    await page.waitForFunction(() => {
      const bars = document.querySelectorAll('.bar');
      return bars.length > 0 && Array.from(bars).every(b => b.classList.contains('sorted'));
    }, null, { timeout: 10000 });

    // After completion, assert there were no console errors or uncaught page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Robustness: multiple full runs - creating bars on each run and final state consistency', async ({ page }) => {
    // This test runs the full sorting process twice in a row to validate:
    // - createBars(array) executes on each run (container is re-populated)
    // - start button is enabled between runs (exit action)
    // - final sorted state is consistent on subsequent runs

    const start = page.locator('#start');

    // First run
    await start.click();
    await page.waitForFunction(() => document.querySelectorAll('.bar.sorted').length === 15, null, { timeout: 10000 });
    await expect(start).toBeEnabled();

    // Capture heights after first run
    const heightsAfterFirst = await page.$$eval('.bar', nodes => nodes.map(n => n.style.height));

    // Second run: start again without reloading the page
    await start.click();
    await page.waitForFunction(() => document.querySelectorAll('.bar.sorted').length === 15, null, { timeout: 10000 });
    await expect(start).toBeEnabled();

    const heightsAfterSecond = await page.$$eval('.bar', nodes => nodes.map(n => n.style.height));

    // Both runs should produce 15 bars each time
    expect(heightsAfterFirst.length).toBe(15);
    expect(heightsAfterSecond.length).toBe(15);

    // Ensure no runtime errors occurred across repeated runs
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});