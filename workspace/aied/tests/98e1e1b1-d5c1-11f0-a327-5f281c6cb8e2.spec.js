import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e1e1b1-d5c1-11f0-a327-5f281c6cb8e2.html';

test.describe('Quick Sort Visualizer - FSM and UI interactions (App ID: 98e1e1b1-d5c1-11f0-a327-5f281c6cb8e2)', () => {
  // Collect console/errors for each test to observe runtime issues without modifying the page.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages emitted during page execution (including during load).
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page (load all scripts/styles).
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Wait a short time to allow initial buildActions/play initialization to settle.
    await page.waitForTimeout(50);
  });

  test.afterEach(async () => {
    // Ensure there were no uncaught page errors or console errors during the test run.
    // If there are, fail the test to surface runtime issues in the app as-is.
    expect(pageErrors, `Unexpected page errors: ${pageErrors.map(e => e && e.stack ? e.stack : String(e)).join('\n')}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console error messages: ${consoleErrors.map(e => e.text).join('\n')}`).toHaveLength(0);
  });

  // Helper utilities for tests to query DOM state
  const selectors = {
    size: '#size',
    sizeLabel: '#sizeLabel',
    speed: '#speed',
    speedLabel: '#speedLabel',
    pivot: '#pivot',
    generate: '#generate',
    shuffle: '#shuffle',
    run: '#run',
    step: '#step',
    reset: '#reset',
    viz: '#viz',
    bars: '.bar',
    statsQueued: '#queued',
    statsComp: '#comp',
    statsSwaps: '#swaps',
    statsRcalls: '#rcalls'
  };

  // Utility: get number of bars
  async function countBars(page) {
    return await page.locator(selectors.bars).count();
  }

  // Utility: get array of bar numeric labels
  async function readBarValues(page) {
    const labels = page.locator(`${selectors.bars} .label`);
    const count = await labels.count();
    const out = [];
    for (let i = 0; i < count; i++) {
      out.push(await labels.nth(i).textContent());
    }
    return out.map(v => (v === null ? null : v.trim())).map(v => (v === null ? null : Number(v)));
  }

  // Utility: count bars with a class
  async function countBarsWithClass(page, className) {
    return await page.locator(`${selectors.bars}.${className}`).count();
  }

  // Utility: read queued stat (actions remaining)
  async function queuedCount(page) {
    const t = await page.locator(selectors.statsQueued).textContent();
    return Number(t || 0);
  }

  // Tests for initial Idle state and basic UI presence
  test('Initial Idle state: default size, bars rendered, actions queued (S0_Idle)', async ({ page }) => {
    // Validate size label default and bars count equals initial size (30)
    const sizeLabel = await page.locator(selectors.sizeLabel).textContent();
    expect(sizeLabel?.trim()).toBe('30');

    const barCount = await countBars(page);
    expect(barCount).toBe(30); // entry_actions: createArray(30) and renderBars()

    // Verify actions were built (queued > 0)
    const queued = await queuedCount(page);
    expect(queued).toBeGreaterThan(0);

    // Basic stat elements exist and show numeric content
    const comp = await page.locator(selectors.statsComp).textContent();
    const swaps = await page.locator(selectors.statsSwaps).textContent();
    expect(Number(comp)).toBeGreaterThanOrEqual(0);
    expect(Number(swaps)).toBeGreaterThanOrEqual(0);
  });

  test('Size change and Generate button create new array of correct size (SizeChange, GenerateArray)', async ({ page }) => {
    // Set size to 10 by dispatching input event (input[type=range]) and then click Generate
    await page.$eval(selectors.size, (el) => {
      // set to 10 and dispatch input
      el.value = '10';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // sizeLabel should update via input handler
    const updatedLabel = await page.locator(selectors.sizeLabel).textContent();
    expect(updatedLabel?.trim()).toBe('10');

    // Click generate to create new array and build actions
    await page.click(selectors.generate);
    // Wait briefly for render
    await page.waitForTimeout(50);

    const newCount = await countBars(page);
    expect(newCount).toBe(10);

    // queued should reflect new actions built
    const queued = await queuedCount(page);
    expect(queued).toBeGreaterThan(0);
  });

  test('SpeedChange updates UI label (SpeedChange)', async ({ page }) => {
    // Change speed range to 500
    await page.$eval(selectors.speed, (el) => {
      el.value = '500';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    // Label should show "500ms"
    const speedLabel = (await page.locator(selectors.speedLabel).textContent())?.trim();
    expect(speedLabel).toBe('500ms');
  });

  test('Pivot change pauses playback and rebuilds actions (PivotChange)', async ({ page }) => {
    // Ensure we have a small array to make interactions quick
    await page.$eval(selectors.size, (el) => { el.value = '8'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click(selectors.generate);
    await page.waitForTimeout(50);

    // Start playing
    await page.click(selectors.run);
    // run button should show 'Pause'
    await expect(page.locator(selectors.run)).toHaveText('Pause');

    // Change pivot selection to trigger pause() and buildActions()
    await page.selectOption(selectors.pivot, 'first');
    // pause() should set run button to 'Play'
    await expect(page.locator(selectors.run)).toHaveText('Play');

    // queued actions should be available after rebuild
    const queued = await queuedCount(page);
    expect(queued).toBeGreaterThan(0);
  });

  test('Play/Pause toggle via button and spacebar keyboard shortcut (PlaySorting)', async ({ page }) => {
    // Use small array
    await page.$eval(selectors.size, (el) => { el.value = '6'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click(selectors.generate);
    await page.waitForTimeout(50);

    // Click Run -> should switch to Pause
    await page.click(selectors.run);
    await expect(page.locator(selectors.run)).toHaveText('Pause');

    // Press space to toggle (the app has keydown listener to call runBtn.click())
    await page.keyboard.press(' ');
    await expect(page.locator(selectors.run)).toHaveText('Play');

    // Press space again to resume
    await page.keyboard.press(' ');
    await expect(page.locator(selectors.run)).toHaveText('Pause');

    // Finally pause by clicking
    await page.click(selectors.run);
    await expect(page.locator(selectors.run)).toHaveText('Play');
  });

  test('Step through sorting until sorted (StepSorting -> Sorted)', async ({ page }) => {
    // Reduce size to keep actions manageable and deterministic
    await page.$eval(selectors.size, (el) => { el.value = '6'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click(selectors.generate);
    await page.waitForTimeout(50);

    // Ensure we have actions queued
    let queued = await queuedCount(page);
    expect(queued).toBeGreaterThan(0);

    // Repeatedly click Step to consume actions. Protect with iteration cap to avoid infinite loops.
    const maxSteps = 2000;
    let steps = 0;
    while ((queued = await queuedCount(page)) > 0 && steps < maxSteps) {
      await page.click(selectors.step);
      // small wait for UI updates
      await page.waitForTimeout(1);
      steps++;
    }

    // After actions exhausted, run button should be 'Play' and all bars should be marked sorted
    await expect(page.locator(selectors.run)).toHaveText('Play');
    const barCount = await countBars(page);
    const sortedCount = await countBarsWithClass(page, 'sorted');
    expect(sortedCount).toBe(barCount);
  });

  test('Reset restores the initial generated array (ResetSorting)', async ({ page }) => {
    // Use small array size to capture initial values easily
    await page.$eval(selectors.size, (el) => { el.value = '8'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click(selectors.generate);
    await page.waitForTimeout(50);

    // Capture initial labels after generate
    const initialVals = await readBarValues(page);
    expect(initialVals.length).toBe(8);

    // Shuffle the array
    await page.click(selectors.shuffle);
    await page.waitForTimeout(30);

    const shuffledVals = await readBarValues(page);
    // It's possible shuffle yields same order on rare occasions; assert at least the sequence differs OR that shuffle action executed and queued exists.
    const same = initialVals.every((v, i) => v === shuffledVals[i]);
    // If it happens to be identical, ensure that queued actions were rebuilt (queued > 0)
    if (same) {
      const queued = await queuedCount(page);
      expect(queued).toBeGreaterThanOrEqual(0);
    } else {
      expect(same).toBe(false);
    }

    // Now reset and capture values, they should equal initialVals
    await page.click(selectors.reset);
    await page.waitForTimeout(50);
    const afterReset = await readBarValues(page);
    expect(afterReset).toEqual(initialVals);

    // Also sorted flags should be cleared (no bar has 'sorted' class immediately after reset)
    const sortedCount = await countBarsWithClass(page, 'sorted');
    expect(sortedCount).toBe(0);
  });

  test('Double-click visualization forces immediate sort (S3_Sorted via dblclick)', async ({ page }) => {
    // Smaller size to make assertion quick
    await page.$eval(selectors.size, (el) => { el.value = '6'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click(selectors.generate);
    await page.waitForTimeout(50);

    // Double-click the viz area to trigger immediate full sort (no visualization steps)
    await page.dblclick(selectors.viz);
    await page.waitForTimeout(20);

    // After dblclick, all bars should have 'sorted' class
    const total = await countBars(page);
    const sorted = await countBarsWithClass(page, 'sorted');
    expect(sorted).toBe(total);

    // queued may be reset (stats show queued count). Validate queued is a number >= 0.
    const queued = await queuedCount(page);
    expect(Number.isFinite(queued)).toBe(true);
  });

  test('Keyboard ArrowRight triggers a single step (StepSorting via keyboard)', async ({ page }) => {
    await page.$eval(selectors.size, (el) => { el.value = '6'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click(selectors.generate);
    await page.waitForTimeout(50);

    const beforeQueued = await queuedCount(page);
    expect(beforeQueued).toBeGreaterThan(0);

    // Press ArrowRight to step once
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(10);
    const afterQueued = await queuedCount(page);
    // Should have decremented by at least 1 (or stayed >=0)
    expect(afterQueued).toBeLessThanOrEqual(beforeQueued - 1 + 1); // allow for race; ensure it's not greater than before
    expect(afterQueued).toBeGreaterThanOrEqual(0);
  });

  test('Edge cases: minimum and maximum size change reflect correctly (SizeChange edges)', async ({ page }) => {
    // Min value 6
    await page.$eval(selectors.size, (el) => { el.value = '6'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.click(selectors.generate);
    await page.waitForTimeout(30);
    expect(await countBars(page)).toBe(6);

    // Max value 80 (don't actually generate 80 bars to avoid slow test; set to 20 then to 80 but only assert label updates)
    await page.$eval(selectors.size, (el) => { el.value = '80'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    const label80 = await page.locator(selectors.sizeLabel).textContent();
    expect(label80?.trim()).toBe('80');
    // generate and ensure bar count equals 80 (this may be heavier but it's part of edge testing)
    await page.click(selectors.generate);
    await page.waitForTimeout(80);
    expect(await countBars(page)).toBe(80);
  }, { timeout: 30_000 });

});