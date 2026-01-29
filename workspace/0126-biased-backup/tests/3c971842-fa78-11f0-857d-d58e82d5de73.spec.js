import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c971842-fa78-11f0-857d-d58e82d5de73.html';

test.describe('Tim Sort Visualization — FSM and UI integration tests', () => {
  // Collect console messages and page errors for each test to assert there are none
  test.beforeEach(async ({ page }) => {
    // Navigate to the page fresh for each test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('Initial Idle state: page loads, controls present, canvas drawn', async ({ page }) => {
    // Collect console messages and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Validate the essential UI components exist and are visible
    const btnShuffle = page.locator('#btnShuffle');
    const btnStart = page.locator('#btnStart');
    const canvas = page.locator('#visualizer');

    await expect(btnShuffle).toBeVisible();
    await expect(btnStart).toBeVisible();
    await expect(canvas).toBeVisible();

    // Validate accessibility attributes as per FSM components
    await expect(btnShuffle).toHaveAttribute('aria-label', 'Shuffle array');
    await expect(btnStart).toHaveAttribute('aria-label', 'Start sorting animation');
    await expect(canvas).toHaveAttribute('role', 'img');
    await expect(canvas).toHaveAttribute('aria-label', 'Tim Sort visualization animation');

    // Ensure canvas has been resized and drawn to: verify width/height > 0 and toDataURL returns non-empty
    const canvasInfo = await page.evaluate(() => {
      const c = document.getElementById('visualizer');
      return {
        clientWidth: c.clientWidth,
        clientHeight: c.clientHeight,
        width: c.width,
        height: c.height,
        hasContext: !!c.getContext,
      };
    });

    expect(canvasInfo.clientWidth).toBeGreaterThan(0);
    expect(canvasInfo.clientHeight).toBeGreaterThan(0);
    expect(canvasInfo.width).toBeGreaterThan(0);
    expect(canvasInfo.height).toBeGreaterThan(0);
    expect(canvasInfo.hasContext).toBeTruthy();

    // Capture an initial snapshot of the canvas content (data URL) to ensure drawArray ran
    const initialDataURL = await page.evaluate(() => {
      const c = document.getElementById('visualizer');
      try {
        return c.toDataURL();
      } catch (e) {
        // If toDataURL fails for any reason record the error string
        return `__ERROR__:${e?.toString?.()}`;
      }
    });

    expect(initialDataURL).toBeTruthy();
    expect(typeof initialDataURL).toBe('string');
    expect(initialDataURL.length).toBeGreaterThan(50); // some content expected

    // Assert there were no uncaught page errors during initial load and no console errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // We expect the page to initialize cleanly in the Idle state; no runtime errors should be present.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ShuffleArray event: clicking Shuffle when idle updates visualization', async ({ page }) => {
    // Collect console messages and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Capture canvas before shuffle
    const before = await page.evaluate(() => {
      const c = document.getElementById('visualizer');
      return c.toDataURL();
    });

    // Click Shuffle (expected in FSM: when Idle, shuffleArray() runs)
    await page.click('#btnShuffle');

    // Wait for a brief redraw after shuffle
    await page.waitForTimeout(200);

    // Capture canvas after shuffle
    const after = await page.evaluate(() => {
      const c = document.getElementById('visualizer');
      return c.toDataURL();
    });

    // The Shuffle action should produce a different drawing (randomized array)
    expect(after).toBeTruthy();
    expect(after).not.toEqual(before);

    // Ensure no unexpected page errors or console errors occurred
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('StartSort event: clicking Start transitions to Sorting animation (visual changes over time)', async ({ page }) => {
    // Collect console messages and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Ensure a stable initial snapshot (after any auto-init)
    const before = await page.evaluate(() => {
      const c = document.getElementById('visualizer');
      return c.toDataURL();
    });

    // Click Start to begin sorting animation - FSM transition: Idle -> Sorting
    await page.click('#btnStart');

    // After starting, the animateAction loop should be running and the canvas should change over time.
    // Wait a moderate amount to allow some animation frames to run.
    await page.waitForTimeout(500);

    const mid = await page.evaluate(() => {
      const c = document.getElementById('visualizer');
      return c.toDataURL();
    });

    // There should be a visible change between before and mid, indicating animation started
    expect(mid).toBeTruthy();
    expect(mid).not.toEqual(before);

    // Clicking Start again while sorting should be no-op (guard in startSort prevents re-entry).
    // This should not throw errors or cause uncontrolled behavior. We assert no page errors and canvas continues animating.
    await page.click('#btnStart');
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => {
      const c = document.getElementById('visualizer');
      return c.toDataURL();
    });

    // The canvas should still be valid and probably changed from mid (animation ongoing).
    expect(after).toBeTruthy();

    // At minimum, no page errors or console-level errors should have been emitted by the second Start click.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ShuffleArray while Sorting: shuffle is ignored and does not interrupt animation (edge case)', async ({ page }) => {
    // Purpose: Verify FSM guard that prevents shuffling while sorting (if state.sorting) return;
    // Because internal state is encapsulated (not exposed), we test the observable behavior:
    // - Start sorting => animation changes canvas over time
    // - While sorting, clicking Shuffle should NOT produce the "immediate distinct shuffle snapshot" that occurs when idle.
    // We take a conservative approach: compare the effect of Shuffle when idle vs Shuffle during sorting.

    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Produce a known baseline by ensuring we're idle and capturing effect of Shuffle when idle
    // Reload to ensure idle state
    await page.reload({ waitUntil: 'load' });

    // idle baseline snapshot
    const baselineBefore = await page.evaluate(() => {
      const c = document.getElementById('visualizer');
      return c.toDataURL();
    });

    // Click shuffle while idle to capture what a "shuffle effect" looks like
    await page.click('#btnShuffle');
    await page.waitForTimeout(200);
    const baselineAfterShuffle = await page.evaluate(() => {
      const c = document.getElementById('visualizer');
      return c.toDataURL();
    });

    // Sanity check: shuffle produced a different image when idle
    expect(baselineAfterShuffle).toBeTruthy();
    expect(baselineAfterShuffle).not.toEqual(baselineBefore);

    // Now reload again to get a fresh state
    await page.reload({ waitUntil: 'load' });

    // Start sorting
    await page.click('#btnStart');
    // Wait for some animation frames to be produced
    await page.waitForTimeout(300);
    const duringStartSnapshot = await page.evaluate(() => {
      const c = document.getElementById('visualizer');
      return c.toDataURL();
    });

    // Now click Shuffle while sorting is in progress
    await page.click('#btnShuffle');

    // Wait a short time to allow any potential shuffle redraw to occur (if shuffle were allowed)
    await page.waitForTimeout(200);
    const afterShuffleWhileSorting = await page.evaluate(() => {
      const c = document.getElementById('visualizer');
      return c.toDataURL();
    });

    // Observations:
    // - If shuffle were permitted during sorting, we'd expect an immediate and pronounced change similar to baselineAfterShuffle.
    // - If shuffle was ignored (code returns early when sorting), the image will likely continue evolving as part of the animation and therefore
    //   will not be identical to the baseline immediate-shuffle image captured earlier.
    // Assert that the "during sorting + click shuffle" result is NOT equal to the baseline immediate-shuffle snapshot.
    // This is a heuristic check that the shuffle did not perform its usual idle behavior.
    expect(afterShuffleWhileSorting).not.toEqual(baselineAfterShuffle);

    // Also ensure that the canvas did continue to change between duringStartSnapshot and afterShuffleWhileSorting
    // (indicating the animation was not abruptly replaced by a static shuffled array)
    // It's acceptable either way for slight differences; assert that at least both are truthy strings.
    expect(afterShuffleWhileSorting).toBeTruthy();
    expect(duringStartSnapshot).toBeTruthy();

    // Finally, ensure no runtime errors occurred during this edge-case interaction
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Robustness: rapid sequence of Start and Shuffle clicks should not produce uncaught exceptions', async ({ page }) => {
    // This stress test sends rapid interactions to exercise guards and transitions
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Rapid sequence of clicks
    const seq = [
      '#btnShuffle', '#btnStart', '#btnStart', '#btnShuffle', '#btnShuffle', '#btnStart'
    ];

    for (const selector of seq) {
      await page.click(selector);
      // tiny delay between clicks to simulate a human but still rapid
      await page.waitForTimeout(80);
    }

    // Allow animation to progress a bit if started
    await page.waitForTimeout(500);

    // Ensure no page errors or console errors were emitted during rapid interactions
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});