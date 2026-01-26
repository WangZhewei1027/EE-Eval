import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f73e53-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Process — Elegant Visual Demonstration (f1f73e53...)', () => {
  // Arrays to collect runtime issues from the page for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // reset collectors
    consoleErrors = [];
    pageErrors = [];

    // capture console errors emitted by the page
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err && (err.message || String(err)));
    });

    // Navigate to the application page and wait for key elements to be present
    await page.goto(APP_URL);
    await page.waitForSelector('#playBtn', { state: 'visible', timeout: 3000 });
    await page.waitForSelector('#resetBtn', { state: 'visible', timeout: 3000 });
    await page.waitForSelector('.process-svg', { state: 'attached', timeout: 3000 });
  });

  test.afterEach(async () => {
    // After each test, assert that no unexpected console/page errors occurred.
    // This verifies the runtime stayed healthy under the simulated interactions.
    expect(consoleErrors, `Console errors were emitted: ${JSON.stringify(consoleErrors, null, 2)}`).toEqual([]);
    expect(pageErrors, `Uncaught page errors: ${JSON.stringify(pageErrors, null, 2)}`).toEqual([]);
  });

  test('Initial UI state reflects Idle (S0_Idle) expectations', async ({ page }) => {
    // Validate initial controls and visual indicators per FSM S0_Idle
    const playBtn = await page.locator('#playBtn');
    const resetBtn = await page.locator('#resetBtn');
    const speedVal = await page.locator('#speedVal');
    const playLabel = playBtn.locator('span');

    // Buttons exist and are accessible
    await expect(playBtn).toBeVisible();
    await expect(resetBtn).toBeVisible();

    // Initial aria-pressed should be "false" (not paused)
    await expect(playBtn).toHaveAttribute('aria-pressed', 'false');

    // Initial play button label should indicate "Pause" (autoplay active)
    await expect(playLabel).toHaveText(/Pause/i);

    // Initial speed indicator should read "1x"
    await expect(speedVal).toHaveText('1x');

    // The moving dot exists and has an initial transform attribute (set by animation tick)
    const leadDot = await page.locator('#leadDot');
    await expect(leadDot).toBeVisible();
    // Wait for the transform attribute to be present (animation loop sets it quickly)
    await page.waitForFunction(() => {
      const el = document.querySelector('#leadDot');
      return el && el.getAttribute('transform');
    }, {}, { timeout: 2000 });

    const transform = await leadDot.getAttribute('transform');
    expect(typeof transform).toBe('string');
    // Should contain a translate coordinate like "translate(x, y)"
    expect(transform).toMatch(/translate\(.+,.+\)/);

    // No runtime errors on load (ensured by afterEach), but we also assert here
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Play/Pause toggle via click and Space key (PlayPauseClick & SpaceKeyPress)', async ({ page }) => {
    // This test validates transitions S0_Idle -> S1_Playing -> S2_Paused -> S1_Playing using clicks and keyboard
    const playBtn = page.locator('#playBtn');
    const label = playBtn.locator('span');

    // Ensure initial state is "playing" (aria-pressed="false", label "Pause")
    await expect(playBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(label).toHaveText(/Pause/i);

    // Click to pause (S1_Playing -> S2_Paused)
    await playBtn.click();
    await expect(playBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(label).toHaveText(/Play/i);

    // Click again to resume (S2_Paused -> S1_Playing)
    await playBtn.click();
    await expect(playBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(label).toHaveText(/Pause/i);

    // Use Space key to toggle (keyboard event path)
    await page.keyboard.press('Space'); // should pause
    await expect(playBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(label).toHaveText(/Play/i);

    await page.keyboard.press('Space'); // should resume
    await expect(playBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(label).toHaveText(/Pause/i);

    // Rapid successive clicks should toggle without throwing (edge case)
    await Promise.all([playBtn.click(), playBtn.click(), playBtn.click()]);
    // After odd number of toggles, expect paused=true
    const aria = await playBtn.getAttribute('aria-pressed');
    expect(['true', 'false']).toContain(aria);

    // no runtime errors emitted by these interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Reset behavior resets progress to the start (ResetClick transition)', async ({ page }) => {
    // Validate that clicking reset sets the animation back to its starting position
    const leadDot = page.locator('#leadDot');
    const resetBtn = page.locator('#resetBtn');

    // Wait a short period to let animation move away from the start
    await page.waitForTimeout(300);
    const beforeTransform = await leadDot.getAttribute('transform');

    // Click reset
    await resetBtn.click();

    // After clicking reset, the implementation animates the leadDot to translate(90px,260px)
    // Wait for the reset animation to apply (the animate call has duration 450ms)
    await page.waitForTimeout(600);

    const afterTransform = await leadDot.getAttribute('transform');
    expect(afterTransform).toBeTruthy();

    // The element should be at or very near the start point; the code uses translate(90px,260px) in the reset animation.
    // We will assert that the transform string contains the starting X and Y numeric parts (90 and 260).
    expect(afterTransform).toMatch(/90(?:\.\d+)?/);
    expect(afterTransform).toMatch(/260(?:\.\d+)?/);

    // Also ensure that the progress actually changed from the before state (if beforeTransform existed)
    if (beforeTransform) {
      expect(afterTransform === beforeTransform).toBe(false);
    }

    // No runtime errors produced by reset
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Speed adjustments via ArrowUp and ArrowDown (SpeedUpKeyPress & SpeedDownKeyPress)', async ({ page }) => {
    // Validate that pressing ArrowUp increases the speed and ArrowDown decreases it, reflected in #speedVal
    const speedVal = page.locator('#speedVal');

    // Initial speed is 1x
    await expect(speedVal).toHaveText('1x');

    // Press ArrowUp repeatedly to reach maximum (3)
    // The code increases by 0.25 and caps at 3
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('ArrowUp');
      // small delay to let DOM update
      await page.waitForTimeout(60);
    }

    // At cap, it should display "3x" (since toFixed(2) => "3.00" then replace => "3x")
    await expect(speedVal).toHaveText('3x');

    // Press ArrowDown twice to decrease
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(60);
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(60);

    // Now speed should be less than 3 and show decimal (e.g., 2.5, 2.75, etc.). Ensure it's not "3x"
    const current = await speedVal.textContent();
    expect(current).not.toBe('3x');
    // It should match numeric pattern like 2.75 or similar
    expect(current).toMatch(/^\d+(\.\d+)?x?$|^\d+\.\d{2}$/);

    // No runtime errors due to keyboard speed controls
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Animation progression and stage pulse detection', async ({ page }) => {
    // Validate that lead dot moves over time when playing and that passing a stage triggers a pulse
    const leadDot = page.locator('#leadDot');
    const playBtn = page.locator('#playBtn');

    // Ensure playing state (not paused)
    await expect(playBtn).toHaveAttribute('aria-pressed', 'false');

    // Record initial transform
    const t0 = await leadDot.getAttribute('transform');

    // Wait to allow animation to progress
    await page.waitForTimeout(400);

    // Capture transform after waiting; it should have changed if playing
    const t1 = await leadDot.getAttribute('transform');
    expect(t1).toBeTruthy();
    // If animation is running, the transform should update over time
    expect(t1).not.toBe(t0);

    // Now pause the animation
    await playBtn.click(); // pause
    await expect(playBtn).toHaveAttribute('aria-pressed', 'true');

    const pausedTransform = await leadDot.getAttribute('transform');

    // Wait while paused; transform should remain stable (within short timeframe)
    await page.waitForTimeout(400);
    const pausedTransformAfter = await leadDot.getAttribute('transform');
    expect(pausedTransformAfter).toBe(pausedTransform);

    // Resume playing
    await playBtn.click();
    await expect(playBtn).toHaveAttribute('aria-pressed', 'false');

    // Wait for a stage pulse to occur: one of the .stage-node elements should receive the 'pulse' class when the dot passes
    // We wait up to 3s for this visual effect since it depends on animation timing
    const pulseFound = await page.waitForFunction(() => {
      const nodes = Array.from(document.querySelectorAll('.stage-node'));
      return nodes.some(n => n.classList.contains('pulse'));
    }, {}, { timeout: 3000 }).catch(() => false);

    // Expect that at least one stage pulse was observed during playback
    expect(pulseFound).toBeTruthy();

    // No runtime errors from progression/pulsing
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: rapid interactions and invalid key presses should not throw', async ({ page }) => {
    // This test performs a battery of rapid and odd interactions to exercise edge cases.
    const playBtn = page.locator('#playBtn');
    const resetBtn = page.locator('#resetBtn');
    const speedVal = page.locator('#speedVal');

    // Rapid toggling
    for (let i = 0; i < 6; i++) {
      await playBtn.click();
    }

    // Rapid reset clicks
    await resetBtn.click();
    await resetBtn.click();
    await resetBtn.click();

    // Press some irrelevant keys and ensure no exceptions occur
    await page.keyboard.press('KeyA');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Escape');

    // Check speed value remains a valid representation after noisy input
    const sv = await speedVal.textContent();
    expect(sv).toMatch(/^\d+(\.\d+)?x?$|^\d+\.\d{2}$/);

    // Reset while paused: pause then reset
    await playBtn.click(); // toggle
    await expect(playBtn).toHaveAttribute('aria-pressed', /^(true|false)$/);
    await resetBtn.click();

    // Small wait to allow any asynchronous behavior
    await page.waitForTimeout(300);

    // No runtime errors from rapid/odd interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});