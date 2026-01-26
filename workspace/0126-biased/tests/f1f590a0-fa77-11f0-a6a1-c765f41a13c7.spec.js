import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f590a0-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Bubble Sort — Visual Elegance (FSM validation)', () => {
  // Collect console messages and page errors for each test to assert runtime health
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(10_000);
    // arrays to capture diagnostics
    page.context().storageState; // noop to quiet linter about page usage

    page['_consoleMessages'] = [];
    page['_pageErrors'] = [];

    page.on('console', msg => {
      // store console messages (type and text)
      page['_consoleMessages'].push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // store page errors (Error objects)
      page['_pageErrors'].push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    // ensure the app had time to run initial scripts and render bars
    await page.waitForTimeout(250);
  });

  test.afterEach(async ({ page }) => {
    // After each test, assert there were no uncaught page errors.
    // The application should initialize and run without throwing exceptions.
    const pageErrors = page['_pageErrors'] || [];
    expect(pageErrors.length, `Expected no page errors, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

    // Also ensure no console.error was emitted
    const consoleErrors = (page['_consoleMessages'] || []).filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected no console.error messages, got: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test.describe('Idle State (S0_Idle) validations', () => {
    test('Initial UI is in Idle state: controls enabled, stats reset, bars rendered', async ({ page }) => {
      // Validate start and shuffle buttons exist and are enabled
      const startBtn = page.locator('#startBtn');
      const shuffleBtn = page.locator('#shuffleBtn');
      await expect(startBtn).toHaveText(/Start Animation/i);
      await expect(startBtn).toBeEnabled();
      await expect(shuffleBtn).toBeEnabled();

      // Validate stat-size is set to 12 (as per implementation)
      const statSize = page.locator('#stat-size');
      await expect(statSize).toHaveText('12');

      // Validate comparison and swap counters are zero in Idle
      const statComp = page.locator('#stat-comp');
      const statSwap = page.locator('#stat-swap');
      await expect(statComp).toHaveText('0');
      await expect(statSwap).toHaveText('0');

      // Validate bars are rendered and count equals declared N (12)
      const bars = page.locator('.bar');
      await expect(bars).toHaveCount(12);

      // Validate each bar has a numeric data-value attribute and a numeric label
      const count = await bars.count();
      for (let i = 0; i < count; i++) {
        const bar = bars.nth(i);
        const dataValue = await bar.getAttribute('data-value');
        const label = await bar.locator('.num').innerText();
        // numeric checks
        expect(Number.isFinite(Number(dataValue))).toBeTruthy();
        expect(Number.isFinite(Number(label))).toBeTruthy();
      }
    });

    test('Shuffle button shuffles array and resets stats (S0_Idle -> S0_Idle)', async ({ page }) => {
      // Capture values before shuffle
      const barsBefore = page.locator('.bar');
      const beforeCount = await barsBefore.count();
      expect(beforeCount).toBeGreaterThan(0);

      const beforeValues = [];
      for (let i = 0; i < beforeCount; i++) {
        beforeValues.push(await barsBefore.nth(i).getAttribute('data-value'));
      }

      // Click shuffle (should be allowed in Idle)
      await page.click('#shuffleBtn');
      // reset() is synchronous and immediate in implementation, but animation may run; give a short pause
      await page.waitForTimeout(120);

      // Assertions after shuffle: stats should be reset
      await expect(page.locator('#stat-comp')).toHaveText('0');
      await expect(page.locator('#stat-swap')).toHaveText('0');

      // Start button text should be 'Start Animation' after shuffle
      await expect(page.locator('#startBtn')).toHaveText(/Start Animation/i);

      // Bars still present and count stable
      const barsAfter = page.locator('.bar');
      const afterCount = await barsAfter.count();
      expect(afterCount).toBe(beforeCount);

      // Capture values after shuffle
      const afterValues = [];
      for (let i = 0; i < afterCount; i++) {
        afterValues.push(await barsAfter.nth(i).getAttribute('data-value'));
      }

      // It's extremely unlikely that a random shuffle yields the exact same sequence.
      // Assert that at least one value changed between before and after.
      const arraysEqual = beforeValues.every((v, idx) => v === afterValues[idx]);
      expect(arraysEqual, 'Expected shuffle to produce at least one different element, but arrays were identical').toBeFalsy();
    });
  });

  test.describe('Sorting State (S1_Sorting) and related interactions', () => {
    test('Click Start Animation transitions to Sorting state (entry actions observed)', async ({ page }) => {
      // Ensure idle first
      await expect(page.locator('#startBtn')).toBeEnabled();

      // Click the start button to begin sorting - bubbleSortVisual sets sorting=true, disables buttons, and changes text
      await page.click('#startBtn');

      // Immediately after click: startBtn and shuffleBtn should be disabled and text should show 'Sorting...'
      const startBtn = page.locator('#startBtn');
      const shuffleBtn = page.locator('#shuffleBtn');

      await expect(startBtn).toBeDisabled();
      await expect(shuffleBtn).toBeDisabled();
      await expect(startBtn).toHaveText(/Sorting\.\.\./i);

      // During sorting, bars should get 'comparing' or 'swapping' classes as visual feedback.
      // Wait briefly for the first compare/swapping to occur.
      await page.waitForTimeout(600); // allow a step to run (delay is 420ms in code)

      // At least one bar should have either 'comparing' or 'swapping' class.
      const comparingBars = page.locator('.bar.comparing, .bar.swapping');
      const comparingCount = await comparingBars.count();
      expect(comparingCount).toBeGreaterThan(0);

      // Edge case: pressing the start shortcut while sorting should not re-trigger sorting (handler checks `if(sorting) return`)
      // Press 's' key and ensure no console errors and that button remains disabled
      await page.keyboard.press('s');
      await page.waitForTimeout(120);
      await expect(startBtn).toBeDisabled();
      await expect(shuffleBtn).toBeDisabled();
    });

    test('Attempting to shuffle during sorting is ignored (Shuffle event during S1_Sorting)', async ({ page }) => {
      // Start sorting
      await page.click('#startBtn');
      await page.waitForTimeout(600); // allow sorting to start and increment comparisons

      // Capture current comparisons (should be >0 after some time)
      const compLocator = page.locator('#stat-comp');
      let beforeCompText = await compLocator.innerText();
      let beforeComp = Number(beforeCompText);
      // It is possible beforeComp is still 0 if we were too quick; ensure we wait a bit more
      if (beforeComp === 0) {
        await page.waitForTimeout(600);
        beforeComp = Number(await compLocator.innerText());
      }
      expect(beforeComp).toBeGreaterThanOrEqual(0);

      // Press keyboard 'r' to trigger shuffle shortcut while sorting; shuffle handler will early-return if(sorting) return
      await page.keyboard.press('r');
      await page.waitForTimeout(120);

      // After attempting shuffle during sorting, comparisons should NOT be reset to zero by the shuffle handler.
      const afterComp = Number(await compLocator.innerText());
      // AfterComp may have increased as sorting continues, but must not have been reset to zero.
      expect(afterComp).not.toBe(0);

      // The shuffle button should remain disabled while sorting
      await expect(page.locator('#shuffleBtn')).toBeDisabled();
    });

    // Note: We deliberately do NOT wait for the full sorting to complete because the demo intentionally uses slow delays
    // (420ms per step) leading to long-running sorting. The FSM transition from S1 -> S0 occurs when sorting completes,
    // which would require waiting many seconds. We validate the entry into S1 and behavior while in S1 above.
  });

  test.describe('Keyboard shortcuts and accessibility bindings', () => {
    test('Keyboard shortcuts: "s" starts sorting, "r" shuffles when idle', async ({ page }) => {
      // Ensure Idle
      await expect(page.locator('#startBtn')).toBeEnabled();

      // Press 'r' to shuffle in idle state
      // Make a note of current start button text and stat values
      const startBtn = page.locator('#startBtn');
      const statComp = page.locator('#stat-comp');
      const statSwap = page.locator('#stat-swap');

      // Mutate counters by doing a shuffle first to ensure known state
      await page.click('#shuffleBtn');
      await page.waitForTimeout(120);
      await expect(startBtn).toHaveText(/Start Animation/i);
      await expect(statComp).toHaveText('0');
      await expect(statSwap).toHaveText('0');

      // Press 's' to start sorting via keyboard
      await page.keyboard.press('s');
      // Small wait for sorting entry actions
      await page.waitForTimeout(400);

      // After pressing 's' buttons should be disabled and start button text should say 'Sorting...'
      await expect(startBtn).toBeDisabled();
      await expect(page.locator('#shuffleBtn')).toBeDisabled();
      await expect(startBtn).toHaveText(/Sorting\.\.\./i);

      // Reload to return to Idle and test 'r' in idle
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(250);

      // Press 'r' to shuffle via keyboard now in Idle
      await page.keyboard.press('r');
      await page.waitForTimeout(120);

      // After pressing 'r' in idle, stats should be reset and start button should be 'Start Animation'
      await expect(page.locator('#startBtn')).toHaveText(/Start Animation/i);
      await expect(page.locator('#stat-comp')).toHaveText('0');
      await expect(page.locator('#stat-swap')).toHaveText('0');
    });
  });

  test.describe('Robustness and edge-case validations', () => {
    test('Bars maintain ARIA/role attributes and visual container exists', async ({ page }) => {
      // Validate that the axis role=img exists and bars container is present
      await expect(page.locator('.axis[role="img"]')).toHaveCount(1);
      await expect(page.locator('#barsContainer')).toBeVisible();

      // Verify that no bar has an empty data-index or data-value attribute
      const bars = page.locator('.bar');
      const count = await bars.count();
      for (let i = 0; i < count; i++) {
        const bar = bars.nth(i);
        const idx = await bar.getAttribute('data-index');
        const val = await bar.getAttribute('data-value');
        expect(idx, 'Each bar should have a data-index').not.toBeNull();
        expect(val, 'Each bar should have a data-value').not.toBeNull();
      }
    });

    test('No uncaught exceptions were logged during initialization and interactions', async ({ page }) => {
      // This test exercises a couple of interactions and then asserts no page errors or console.error have been emitted
      // Shuffle once
      await page.click('#shuffleBtn');
      await page.waitForTimeout(120);
      // Start and then immediately press 'r' to try to shuffle during sorting
      await page.click('#startBtn');
      await page.waitForTimeout(300);
      await page.keyboard.press('r');
      await page.waitForTimeout(120);

      // Validate none of these interactions produced uncaught errors
      const pageErrors = page['_pageErrors'] || [];
      expect(pageErrors.length, `Expected no page errors from interactions, got: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);

      const consoleErrors = (page['_consoleMessages'] || []).filter(m => m.type === 'error');
      expect(consoleErrors.length, `Expected no console.error entries from interactions, got: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
    });
  });
});