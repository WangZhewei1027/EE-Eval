import { test, expect } from '@playwright/test';

const APP = 'http://127.0.0.1:5500/workspace/batch-1207/html/e933e9a1-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Radix Sort Visualizer (LSD) — Interactive Demo (e933e9a1-d360-11f0-a097-ffdd56c22ef4)', () => {
  // Helper to attach listeners for console errors and page errors and return arrays
  const attachErrorCollectors = (page) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      // capture error-level console messages
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push({ text: msg.text(), type: msg.type() });
      }
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    return { consoleErrors, pageErrors };
  };

  // Utility to dispatch input/change events on an element and optionally wait a small tick
  const setRangeValue = async (page, selector, value, trigger = 'input') => {
    await page.$eval(selector, (el, v) => {
      el.value = String(v);
      const ev = new Event('input', { bubbles: true });
      el.dispatchEvent(ev);
    }, value);
    if (trigger === 'change') {
      await page.$eval(selector, (el) => {
        const ev = new Event('change', { bubbles: true });
        el.dispatchEvent(ev);
      });
    }
    // Wait a short tick to let UI update
    await page.waitForTimeout(50);
  };

  test.beforeEach(async ({ page }) => {
    // Navigate fresh for each test
    await page.goto(APP);
    // Ensure page loaded
    await expect(page).toHaveTitle(/Radix Sort Visualizer/);
  });

  test('Initial load: Start state initialized (initRandom executed) and no runtime errors on load', async ({ page }) => {
    // Attach collectors
    const { consoleErrors, pageErrors } = attachErrorCollectors(page);

    // After initialization, the UI should display the 'start' state and steps count > 0
    const stateText = await page.textContent('#stateBadge');
    expect(stateText.trim().toLowerCase()).toBe('start');

    // stepsBadge should show a positive integer (states length)
    const stepsText = await page.textContent('#stepsBadge');
    const stepsNum = Number(String(stepsText).trim());
    expect(Number.isFinite(stepsNum) && stepsNum >= 1).toBeTruthy();

    // digit badge initially should be '—'
    const digitText = await page.textContent('#digitBadge');
    expect(String(digitText).trim()).toBe('—');

    // There should be bars rendered for the array
    const bars = await page.$$('#arrayRow .bar');
    // Size default is 10; but assert at least 3 (minimum allowed)
    expect(bars.length).toBeGreaterThanOrEqual(3);

    // Confirm window._radixVisualizer was exposed (debug hook) and has a states array
    const hasDebug = await page.evaluate(() => {
      try { return !!(window._radixVisualizer && Array.isArray(window._radixVisualizer.states)); }
      catch(e){ return false; }
    });
    expect(hasDebug).toBe(true);

    // Assert no critical console or page errors happened during initialization
    expect(consoleErrors.length, `console errors: ${JSON.stringify(consoleErrors)}`).toBe(0);
    expect(pageErrors.length, `page errors: ${JSON.stringify(pageErrors.map(e=>String(e)))}`).toBe(0);
  });

  test('Size and Max value inputs update badges and trigger array rebuild on change', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachErrorCollectors(page);

    // Change the size via input (input event updates sizeValue but change triggers initRandom)
    await setRangeValue(page, '#sizeRange', 5, 'input');
    expect((await page.textContent('#sizeValue')).trim()).toBe('5');

    // Trigger change to cause new random array to be generated (initRandom)
    await page.$eval('#sizeRange', (el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    await page.waitForTimeout(100); // wait for initRandom and UI updates

    // Now arrayRow should contain exactly 5 bars
    const barsAfterSizeChange = await page.$$('#arrayRow .bar');
    expect(barsAfterSizeChange.length).toBe(5);

    // Max value input: change to a higher max and ensure maxValue updates and arrays regenerate on change
    await setRangeValue(page, '#maxRange', 500, 'input');
    expect((await page.textContent('#maxValue')).trim()).toBe('500');

    // Trigger change to regenerate
    await page.$eval('#maxRange', (el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    await page.waitForTimeout(100);
    // Confirm bars count still equals current size (5)
    const barsAfterMaxChange = await page.$$('#arrayRow .bar');
    expect(barsAfterMaxChange.length).toBe(5);

    // No runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Base (radix) change clamps value and rebuilds states, radixBadge updates', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachErrorCollectors(page);

    // Set baseInput to a large value to test clamping to max 16
    await page.fill('#baseInput', '100');
    // Dispatch change
    await page.$eval('#baseInput', (el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    await page.waitForTimeout(100);

    // radixBadge should be clamped to 16
    const radixText = (await page.textContent('#radixBadge')).trim();
    expect(radixText).toBe('16');

    // stepsBadge should be updated to a positive integer
    const stepsNum = Number((await page.textContent('#stepsBadge')).trim());
    expect(Number.isFinite(stepsNum) && stepsNum >= 1).toBeTruthy();

    // Further check setting base to a low value clamps to at least 2
    await page.fill('#baseInput', '1');
    await page.$eval('#baseInput', (el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    await page.waitForTimeout(100);
    expect((await page.textContent('#radixBadge')).trim()).toBe('2');

    // No runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Shuffle / Randomize and Reset buttons produce a start state with array displayed', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachErrorCollectors(page);

    // Click Shuffle / Randomize
    await page.click('#randomBtn');
    await page.waitForTimeout(120);
    expect((await page.textContent('#stateBadge')).trim().toLowerCase()).toBe('start');

    // Get steps count and array bars present
    const steps1 = Number((await page.textContent('#stepsBadge')).trim());
    expect(steps1).toBeGreaterThanOrEqual(1);
    expect((await page.$$('#arrayRow .bar')).length).toBeGreaterThanOrEqual(3);

    // Click Reset (should also call initRandom)
    await page.click('#resetBtn');
    await page.waitForTimeout(120);
    expect((await page.textContent('#stateBadge')).trim().toLowerCase()).toBe('start');

    // No runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Set custom array via input and Set button reflects in UI and adjusts sliders', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachErrorCollectors(page);

    // Enter a custom array and click Set
    await page.fill('#arrayInput', '170,45,75');
    await page.click('#setArray');

    // Wait for UI update
    await page.waitForTimeout(100);

    // After setting, state should be 'start'
    expect((await page.textContent('#stateBadge')).trim().toLowerCase()).toBe('start');

    // Size slider value should reflect array length (clamped between 3 and 18); here 3
    expect((await page.textContent('#sizeValue')).trim()).toBe('3');

    // Max range should reflect max value (>= 170 and at least minimum 9)
    const maxValText = (await page.textContent('#maxValue')).trim();
    expect(Number(maxValText)).toBeGreaterThanOrEqual(170);

    // Array row should display bars with the exact values 170, 45, 75 (values appear inside .value elements)
    const values = await page.$$eval('#arrayRow .bar .value', nodes => nodes.map(n => n.textContent.trim()));
    // There may be padding/format, but expect those numbers in the list in some order at start state (array shows initial order)
    expect(values).toEqual(['170', '45', '75']);

    // No runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Next and Previous step navigation goes through distribution and collection states', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachErrorCollectors(page);

    // Ensure we have an initial known small array to reason about states
    await page.fill('#arrayInput', '3,1,2');
    await page.click('#setArray');
    await page.waitForTimeout(100);

    // state 0: start
    expect((await page.textContent('#stateBadge')).trim().toLowerCase()).toBe('start');

    // Click next => should move to distribution for digit 0
    await page.click('#nextBtn');
    await page.waitForTimeout(80);
    const s1 = (await page.textContent('#stateBadge')).trim().toLowerCase();
    expect(['distribution','collection','start']).toContain(s1);
    // For a fresh array, next from start should be distribution
    expect(s1).toBe('distribution');

    // Click next => collection
    await page.click('#nextBtn');
    await page.waitForTimeout(80);
    expect((await page.textContent('#stateBadge')).trim().toLowerCase()).toBe('collection');

    // Click prev => back to distribution
    await page.click('#prevBtn');
    await page.waitForTimeout(80);
    expect((await page.textContent('#stateBadge')).trim().toLowerCase()).toBe('distribution');

    // Navigate to the end by repeatedly clicking next; ensure it stops at last state
    const stepsTotal = Number((await page.textContent('#stepsBadge')).trim());
    for (let i = 0; i < stepsTotal + 2; i++) {
      await page.click('#nextBtn');
      await page.waitForTimeout(40);
    }
    // After exhausting steps, stepBadge should still reflect last state (collection or distribution), and no exceptions thrown
    const finalState = (await page.textContent('#stateBadge')).trim().toLowerCase();
    expect(['distribution','collection','start']).toContain(finalState);

    // No runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Play/Pause animation advances steps automatically and can be paused', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachErrorCollectors(page);

    // Reduce speed to make automatic stepping faster (but code enforces minimum 120ms)
    await page.$eval('#speed', (el) => { el.value = '200'; el.dispatchEvent(new Event('input', { bubbles: true })); });
    // Reset to start
    await page.click('#randomBtn');
    await page.waitForTimeout(120);

    const beforeState = (await page.textContent('#stateBadge')).trim();

    // Start autoplay
    await page.click('#playBtn');
    // Wait enough time for at least one auto-advance (>=120ms enforced)
    await page.waitForTimeout(500);

    const midwayState = (await page.textContent('#stateBadge')).trim();
    // The state should have advanced (not necessarily predictable which label but likely not identical)
    expect(midwayState).not.toBe(beforeState);

    // Pause autoplay
    await page.click('#playBtn');
    await page.waitForTimeout(150);

    // Ensure play button shows play symbol again (▶️)
    const playBtnText = (await page.textContent('#playBtn')).trim();
    expect(playBtnText).toContain('▶️');

    // No runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: invalid custom array prompts alert and does not change state', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachErrorCollectors(page);

    // Provide an invalid array input that yields no valid integers
    await page.fill('#arrayInput', 'foo,bar,baz');
    // Listen for dialog and capture message
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click Set -> should trigger alert and not change the stateBadge from previous
    const prevState = (await page.textContent('#stateBadge')).trim();
    await page.click('#setArray');
    // wait a bit for dialog to appear and be handled
    await page.waitForTimeout(120);
    expect(dialogMessage).toBeTruthy();
    expect(dialogMessage).toMatch(/Enter a comma-separated list/i);
    // State should be unchanged
    expect((await page.textContent('#stateBadge')).trim()).toBe(prevState);

    // No runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Render buckets and explanations for distribution/collection states (visual feedback)', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachErrorCollectors(page);

    // Use a small custom array with varying digits
    await page.fill('#arrayInput', '12,3,5,23');
    await page.click('#setArray');
    await page.waitForTimeout(100);

    // Next -> distribution for digit 0 should render buckets (non-empty)
    await page.click('#nextBtn');
    await page.waitForTimeout(80);
    const stateNow = (await page.textContent('#stateBadge')).trim().toLowerCase();
    expect(stateNow).toBe('distribution');

    // Buckets container should have children representing buckets
    const bucketCount = await page.$$eval('#buckets .bucket', (nodes) => nodes.length);
    expect(bucketCount).toBeGreaterThanOrEqual(2); // base at least 2

    // Explanation text should mention 'Distribution' when in distribution state
    const explain = (await page.textContent('#explainText')).trim();
    expect(explain.toLowerCase()).toContain('distribution');

    // Click next to go to collection and ensure buckets remain visible and explanation updates
    await page.click('#nextBtn');
    await page.waitForTimeout(80);
    const explain2 = (await page.textContent('#explainText')).trim();
    expect(explain2.toLowerCase()).toContain('collection');

    // No runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Access internal debug object and validate states array shape (S0,S1,S2 present)', async ({ page }) => {
    const { consoleErrors, pageErrors } = attachErrorCollectors(page);

    // Access the debug hook and inspect state objects
    const statesInfo = await page.evaluate(() => {
      try {
        const dbg = window._radixVisualizer;
        if(!dbg || !Array.isArray(dbg.states)) return null;
        // Provide a small snapshot: count types present
        const types = dbg.states.map(s => s.type);
        return { count: dbg.states.length, types: types.slice(0,20) };
      } catch(e) { return null; }
    });
    expect(statesInfo).toBeTruthy();
    expect(statesInfo.count).toBeGreaterThanOrEqual(1);
    // The first state should be 'start'
    expect(statesInfo.types[0]).toBe('start');

    // Ensure distribution and collection strings appear somewhere in the sequence (if more than 1 digit)
    const hasDistribution = statesInfo.types.includes('distribution');
    const hasCollection = statesInfo.types.includes('collection');
    expect(hasDistribution || hasCollection).toBeTruthy();

    // No runtime errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});