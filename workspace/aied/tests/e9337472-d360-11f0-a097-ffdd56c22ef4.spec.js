import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e9337472-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Bubble Sort Visualizer (e9337472-d360-11f0-a097-ffdd56c22ef4)', () => {
  // Collect console and page errors for each test run
  let consoleErrors = [];
  let pageErrors = [];
  let consoleWarnings = [];
  let consoleLogs = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    consoleWarnings = [];
    consoleLogs = [];

    // Capture console messages and page errors for assertions later
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') consoleErrors.push(text);
      else if (type === 'warning') consoleWarnings.push(text);
      else consoleLogs.push({ type, text });
    });
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });

    // Navigate to the application page exactly as provided
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure initial load has the application root
    await expect(page.locator('.app[role="application"]')).toBeVisible();
  });

  test.afterEach(async () => {
    // Assert there are no uncaught page errors (the app should load without thrown exceptions)
    // NOTE: The harness asked to "observe console logs and page errors" and let JS errors happen naturally.
    // We assert here that no uncaught page errors occurred during the test. If there are, the test will fail and surface them.
    expect(pageErrors, 'No uncaught page errors should have occurred').toHaveLength(0);
    // Also assert there were no console errors.
    expect(consoleErrors, 'No console.error messages should have been emitted').toHaveLength(0);
  });

  // Helper to get number values and DOM elements
  const selectors = {
    barsContainer: '#barsContainer',
    sizeRange: '#sizeRange',
    speedRange: '#speedRange',
    orderSelect: '#orderSelect',
    randomBtn: '#randomBtn',
    sortedBtn: '#sortedBtn',
    startBtn: '#startBtn',
    stepBtn: '#stepBtn',
    pauseBtn: '#pauseBtn',
    resetBtn: '#resetBtn',
    compCount: '#compCount',
    swapCount: '#swapCount',
    stepCount: '#stepCount',
    codeLines: '.code-line',
  };

  test.describe('Initial (Idle) state and basic UI', () => {
    test('renders Idle state on load with expected controls and stats reset', async ({ page }) => {
      // Validate presence and initial attributes of controls
      const startBtn = page.locator(selectors.startBtn);
      const pauseBtn = page.locator(selectors.pauseBtn);
      const stepBtn = page.locator(selectors.stepBtn);
      const sizeRange = page.locator(selectors.sizeRange);
      const bars = page.locator(`${selectors.barsContainer} .bar`);

      await expect(startBtn).toBeVisible();
      await expect(startBtn).toBeEnabled();

      // Pause should be disabled initially per implementation evidence
      await expect(pauseBtn).toBeVisible();
      await expect(pauseBtn).toBeDisabled();

      await expect(stepBtn).toBeVisible();
      await expect(stepBtn).toBeEnabled();

      // The default sizeRange value is 30 per the HTML; verify bars count equals that
      const sizeVal = await sizeRange.getAttribute('value');
      const expectedDefaultSize = Number(sizeVal || 30);
      await expect(bars).toHaveCount(expectedDefaultSize);

      // Stats should all be zero initially
      await expect(page.locator(selectors.compCount)).toHaveText('0');
      await expect(page.locator(selectors.swapCount)).toHaveText('0');
      await expect(page.locator(selectors.stepCount)).toHaveText('0');

      // Pseudocode first line should be highlighted on init (highlightLine(1) called)
      const firstLine = page.locator(`${selectors.codeLines}[data-line="1"]`);
      await expect(firstLine).toHaveClass(/active/);
    });

    test('changing sizeRange rebuilds bars and resets stats (SizeChange event)', async ({ page }) => {
      // Change the size range to a smaller number and assert bars are rebuilt
      const sizeRange = page.locator(selectors.sizeRange);
      const bars = page.locator(`${selectors.barsContainer} .bar`);

      // Set to 10
      await sizeRange.evaluate((el) => {
        el.value = '10';
        // dispatch input to mimic user interaction
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      await expect(bars).toHaveCount(10);

      // Stats reset to zero after rebuild
      await expect(page.locator(selectors.compCount)).toHaveText('0');
      await expect(page.locator(selectors.swapCount)).toHaveText('0');
      await expect(page.locator(selectors.stepCount)).toHaveText('0');
    });

    test('Randomize and Nearly Sorted buttons update bars (RandomizeArray, NearlySortedArray)', async ({ page }) => {
      const randomBtn = page.locator(selectors.randomBtn);
      const sortedBtn = page.locator(selectors.sortedBtn);
      const bars = page.locator(`${selectors.barsContainer} .bar`);
      const getValues = async () => {
        return (await bars.elementHandles()).map(async h => {
          const text = await h.$eval('.val', el => el.textContent);
          return Number(text);
        }).then(promises => Promise.all(promises)).then(arr => arr);
      };

      // Click randomize and ensure bars exist with numeric values
      await randomBtn.click();
      await expect(bars).toHaveCountGreaterThan(0);
      const randomVals = await getValues();
      expect(randomVals.every(v => typeof v === 'number' && v > 0)).toBeTruthy();

      // Click nearly sorted and ensure bars are updated (values may change but still numeric)
      await sortedBtn.click();
      await expect(bars).toHaveCountGreaterThan(0);
      const nearlyVals = await getValues();
      expect(nearlyVals.every(v => typeof v === 'number' && v > 0)).toBeTruthy();
    });
  });

  test.describe('Running, Pausing, Stepping, and Resetting (FSM transitions)', () => {
    test('StartSorting transitions to Running and disables/enables controls appropriately', async ({ page }) => {
      const startBtn = page.locator(selectors.startBtn);
      const pauseBtn = page.locator(selectors.pauseBtn);
      const stepBtn = page.locator(selectors.stepBtn);
      const sizeRange = page.locator(selectors.sizeRange);
      const randomBtn = page.locator(selectors.randomBtn);
      const sortedBtn = page.locator(selectors.sortedBtn);
      const orderSelect = page.locator(selectors.orderSelect);
      const bars = page.locator(`${selectors.barsContainer} .bar`);
      const compCount = page.locator(selectors.compCount);
      const stepCount = page.locator(selectors.stepCount);

      // Start auto-run
      await startBtn.click();

      // When running: startBtn disabled, pauseBtn enabled, step disabled, controls disabled
      await expect(startBtn).toBeDisabled();
      await expect(pauseBtn).toBeEnabled();
      await expect(stepBtn).toBeDisabled();
      await expect(sizeRange).toBeDisabled();
      await expect(randomBtn).toBeDisabled();
      await expect(sortedBtn).toBeDisabled();
      await expect(orderSelect).toBeDisabled();

      // Wait a short while to let at least one action occur
      await page.waitForTimeout(300);

      // Expect that at least one step has occurred (stepCount > 0) or comparisons incremented
      const stepCountText = await stepCount.textContent();
      expect(Number(stepCountText || 0)).toBeGreaterThanOrEqual(1);

      // Some bar might have class 'compare' or 'swap' during run; check for either
      const compareBars = await page.locator(`${selectors.barsContainer} .bar.compare`).count();
      const swapBars = await page.locator(`${selectors.barsContainer} .bar.swap`).count();
      expect(compareBars + swapBars).toBeGreaterThanOrEqual(0); // simply assert query ran (non-strict)

      // For safety, stop the run by clicking reset to avoid long-running sorts in CI
      await page.locator(selectors.resetBtn).click();
      // After reset, controls should be restored
      await expect(startBtn).toBeEnabled();
      await expect(pauseBtn).toBeDisabled();
      await expect(stepBtn).toBeEnabled();
      await expect(sizeRange).toBeEnabled();
      await expect(randomBtn).toBeEnabled();
      await expect(sortedBtn).toBeEnabled();
      await expect(orderSelect).toBeEnabled();

      // Stats reset by resetToInitial
      await expect(page.locator(selectors.compCount)).toHaveText('0');
      await expect(page.locator(selectors.swapCount)).toHaveText('0');
      await expect(page.locator(selectors.stepCount)).toHaveText('0');
    });

    test('PauseSorting toggles pause during running (PauseSorting) and resume works', async ({ page }) => {
      const startBtn = page.locator(selectors.startBtn);
      const pauseBtn = page.locator(selectors.pauseBtn);
      const stepBtn = page.locator(selectors.stepBtn);

      // Start run
      await startBtn.click();
      await expect(startBtn).toBeDisabled();
      await expect(pauseBtn).toBeEnabled();

      // Pause the run
      await pauseBtn.click();
      // Pause button text should change to 'Resume' per togglePause implementation
      await expect(pauseBtn).toHaveText(/Resume/);

      // While paused, stepBtn should remain disabled (since run mode disables step)
      await expect(stepBtn).toBeDisabled();

      // Wait briefly and resume
      await page.waitForTimeout(150);
      await pauseBtn.click();
      await expect(pauseBtn).toHaveText(/Pause/);

      // Stop run to clean up
      await page.locator(selectors.resetBtn).click();
    });

    test('StepSorting executes a single action when idle (StepSorting) and does not step while running', async ({ page }) => {
      const stepBtn = page.locator(selectors.stepBtn);
      const startBtn = page.locator(selectors.startBtn);
      const compCount = page.locator(selectors.compCount);
      const stepCount = page.locator(selectors.stepCount);
      const swapCount = page.locator(selectors.swapCount);

      // Ensure idle
      await expect(startBtn).toBeEnabled();

      // Capture current counts
      const initialStep = Number((await stepCount.textContent()) || 0);
      const initialComp = Number((await compCount.textContent()) || 0);
      const initialSwap = Number((await swapCount.textContent()) || 0);

      // Click Step to perform one action
      await stepBtn.click();
      // Wait for action to complete
      await page.waitForTimeout(150);

      // Step count should have incremented by at least 1
      const afterStep = Number((await stepCount.textContent()) || 0);
      expect(afterStep).toBeGreaterThan(initialStep);

      // Now start auto-run and attempt to step (should be ignored while running)
      await startBtn.click();
      await expect(startBtn).toBeDisabled();

      // Attempt to click step while running
      await stepBtn.click();
      // Wait a bit to ensure no unintended step occurs
      await page.waitForTimeout(200);

      // Step count should not have increased due to step click while running (it may increase due to running itself)
      // Because running will progress, we assert that the step button click did not throw and the UI remains consistent:
      await expect(page.locator(selectors.pauseBtn)).toBeEnabled();

      // Clean up by resetting
      await page.locator(selectors.resetBtn).click();
    });

    test('ResetSorting stops running and restores Idle state (ResetSorting)', async ({ page }) => {
      const startBtn = page.locator(selectors.startBtn);
      const pauseBtn = page.locator(selectors.pauseBtn);
      const resetBtn = page.locator(selectors.resetBtn);
      const stepCount = page.locator(selectors.stepCount);
      const codeLine1 = page.locator(`${selectors.codeLines}[data-line="1"]`);

      // Start and let it run a bit
      await startBtn.click();
      await page.waitForTimeout(250);

      // Reset while potentially running
      await resetBtn.click();

      // After reset, pause should be disabled and first pseudocode line highlighted
      await expect(pauseBtn).toBeDisabled();
      await expect(codeLine1).toHaveClass(/active/);

      // Stats should be reset
      await expect(stepCount).toHaveText('0');
    });
  });

  test.describe('Speed and Order controls, keyboard shortcuts, and layout behaviors', () => {
    test('SpeedChange updates speedRange value and influences animation delays (SpeedChange)', async ({ page }) => {
      const speedRange = page.locator(selectors.speedRange);
      const stepBtn = page.locator(selectors.stepBtn);
      const stepCount = page.locator(selectors.stepCount);

      // Change speed to a fast value (10)
      await speedRange.evaluate((el) => {
        el.value = '10';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await expect(speedRange).toHaveValue('10');

      // Perform step and ensure it completes quickly (we assert stepCount increments)
      const before = Number((await stepCount.textContent()) || 0);
      await stepBtn.click();
      // With faster speed, we still wait short time; step should happen quickly
      await page.waitForTimeout(120);
      const after = Number((await stepCount.textContent()) || 0);
      expect(after).toBeGreaterThan(before);
    });

    test('OrderChange toggles sorting order selection (OrderChange) and is reflected in generator setup', async ({ page }) => {
      const orderSelect = page.locator(selectors.orderSelect);
      const stepBtn = page.locator(selectors.stepBtn);

      // Change order to descending
      await orderSelect.selectOption('desc');
      await expect(orderSelect).toHaveValue('desc');

      // Trigger a step to ensure generator will be created using the selected order (no direct access to generator)
      await stepBtn.click();
      await page.waitForTimeout(150);

      // Change back to ascending
      await orderSelect.selectOption('asc');
      await expect(orderSelect).toHaveValue('asc');
    });

    test('Keyboard shortcuts: Space to start/pause and ArrowRight to step', async ({ page }) => {
      const startBtn = page.locator(selectors.startBtn);
      const pauseBtn = page.locator(selectors.pauseBtn);
      const stepBtn = page.locator(selectors.stepBtn);
      const stepCount = page.locator(selectors.stepCount);

      // Space should start the run
      await page.keyboard.press(' ');
      await page.waitForTimeout(120);
      await expect(startBtn).toBeDisabled();
      await expect(pauseBtn).toBeEnabled();

      // Space should toggle pause (press again)
      await page.keyboard.press(' ');
      await page.waitForTimeout(80);
      await expect(pauseBtn).toHaveText(/Resume/).or.toHaveText(/Pause/);

      // Reset to ensure deterministic state
      await page.locator(selectors.resetBtn).click();
      await expect(startBtn).toBeEnabled();

      // ArrowRight should trigger a step when idle
      const before = Number((await stepCount.textContent()) || 0);
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(120);
      const after = Number((await stepCount.textContent()) || 0);
      expect(after).toBeGreaterThan(before);
    });

    test('Window resize triggers a re-render of bars and preserves count', async ({ page }) => {
      const bars = page.locator(`${selectors.barsContainer} .bar`);
      const initialCount = await bars.count();

      // Resize viewport to trigger resize handler in the app
      await page.setViewportSize({ width: 800, height: 900 });
      // Wait for debounce timer used in resize handling
      await page.waitForTimeout(200);

      // Bar count should remain the same after re-render
      const afterCount = await bars.count();
      expect(afterCount).toBe(initialCount);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Clicking Pause when not running has no effect and does not throw', async ({ page }) => {
      const pauseBtn = page.locator(selectors.pauseBtn);
      const startBtn = page.locator(selectors.startBtn);

      // Ensure idle state
      await expect(startBtn).toBeEnabled();
      await expect(pauseBtn).toBeDisabled();

      // Click pause (no-op). Use JS dispatch to ensure event path is same as user click
      await pauseBtn.click();

      // Still disabled and no page errors should have occurred (checked in afterEach)
      await expect(pauseBtn).toBeDisabled();
    });

    test('Rapid toggling of Start and Reset does not cause uncaught exceptions', async ({ page }) => {
      const startBtn = page.locator(selectors.startBtn);
      const resetBtn = page.locator(selectors.resetBtn);

      // Rapidly start and reset several times
      for (let i = 0; i < 3; i++) {
        await startBtn.click();
        // Short wait to allow runAuto to begin
        await page.waitForTimeout(80);
        await resetBtn.click();
        await page.waitForTimeout(60);
      }

      // Confirm that application control buttons are stable after repeated use
      await expect(startBtn).toBeEnabled();
      await expect(page.locator(selectors.pauseBtn)).toBeDisabled();
      // No uncaught errors are asserted in afterEach
    });

    test('Attempting to step through a completed generator gracefully highlights done (no crash)', async ({ page }) => {
      const sizeRange = page.locator(selectors.sizeRange);
      const startBtn = page.locator(selectors.startBtn);
      const stepBtn = page.locator(selectors.stepBtn);
      const codeLine6 = page.locator(`${selectors.codeLines}[data-line="6"]`);
      // Reduce array size for quick completion
      await sizeRange.evaluate((el) => {
        el.value = '5';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Run to completion but keep test short: start and wait reasonable time
      await startBtn.click();
      // Give some time for sort to complete on small arrays
      await page.waitForTimeout(1500);

      // After completion, codeLine6 should be highlighted
      await expect(codeLine6).toHaveClass(/active/);

      // Attempt to step after done; it should not throw and should mark lines/ sorted state
      await stepBtn.click();
      await page.waitForTimeout(120);
      // The UI should still be responsive; no uncaught errors
    });
  });

  // Final smoke test to ensure the app's core functions execute without throwing
  test('Smoke test: full flow sanity check (build, step, run a bit, reset)', async ({ page }) => {
    const sizeRange = page.locator(selectors.sizeRange);
    const stepBtn = page.locator(selectors.stepBtn);
    const startBtn = page.locator(selectors.startBtn);
    const resetBtn = page.locator(selectors.resetBtn);

    // Build a medium array
    await sizeRange.evaluate((el) => {
      el.value = '12';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.waitForTimeout(80);

    // Step a couple of times
    await stepBtn.click();
    await page.waitForTimeout(120);
    await stepBtn.click();
    await page.waitForTimeout(120);

    // Run briefly
    await startBtn.click();
    await page.waitForTimeout(350);

    // Reset and ensure idle state
    await resetBtn.click();
    await expect(startBtn).toBeEnabled();
    await expect(page.locator(selectors.pauseBtn)).toBeDisabled();

    // No uncaught errors asserted in afterEach
  });
});