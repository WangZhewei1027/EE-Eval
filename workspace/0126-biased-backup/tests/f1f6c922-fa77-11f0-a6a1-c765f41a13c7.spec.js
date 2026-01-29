import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f6c922-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('f1f6c922-fa77-11f0-a6a1-c765f41a13c7 — Greedy Algorithms Visual Symphony', () => {
  // Capture console messages and page errors for assertions
  test.beforeEach(async ({ page }) => {
    // arrays to store diagnostics on each test run
    page.context()._testConsoleMessages = [];
    page.context()._testPageErrors = [];

    page.on('console', msg => {
      // store for later assertions
      // eslint-disable-next-line no-underscore-dangle
      page.context()._testConsoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // eslint-disable-next-line no-underscore-dangle
      page.context()._testPageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Ensure initial layout loaded
    await expect(page.locator('body')).toBeVisible();
  });

  test.afterEach(async ({ page }) => {
    // If any page errors were observed, emit them as part of the test diagnostics.
    // This will not modify page behavior, only provide test-time visibility.
    // eslint-disable-next-line no-underscore-dangle
    const pageErrors = page.context()._testPageErrors || [];
    const consoleMessages = page.context()._testConsoleMessages || [];
    if (pageErrors.length) {
      consoleErrorsSummary(pageErrors, consoleMessages);
    }
    // No teardown modifications to the page environment — tests must not patch runtime.
  });

  // Helper to log diagnostics to test output when failures occur.
  function consoleErrorsSummary(pageErrors, consoleMessages) {
    // Use test.info() to attach diagnostics if needed, but keep it simple:
    // Print to stdout (Playwright will capture).
    // eslint-disable-next-line no-console
    console.error('Page errors observed during test run:');
    for (const e of pageErrors) {
      // eslint-disable-next-line no-console
      console.error(String(e));
    }
    // eslint-disable-next-line no-console
    console.error('Console messages captured:');
    for (const m of consoleMessages) {
      // eslint-disable-next-line no-console
      console.error(`[${m.type}] ${m.text}`);
    }
  }

  test('Initial Idle state renders expected controls and baseline DOM (S0_Idle)', async ({ page }) => {
    // Validate the initial (Idle) state per FSM:
    // - Play and Reset buttons are present
    // - solutionTotal shows 0¢
    // - stepList shows 0
    // - solutionStack is empty
    const playBtn = page.locator('#playBtn');
    const resetBtn = page.locator('#resetBtn');
    const solutionTotal = page.locator('#solutionTotal');
    const stepList = page.locator('#stepList');
    const solutionStack = page.locator('#solutionStack');

    await expect(playBtn).toBeVisible();
    await expect(playBtn).toHaveAttribute('title', 'Play the greedy selection animation');
    await expect(resetBtn).toBeVisible();
    await expect(resetBtn).toHaveAttribute('title', 'Reset the visualization');

    await expect(solutionTotal).toBeVisible();
    await expect(solutionTotal).toHaveText('0¢');

    await expect(stepList).toBeVisible();
    await expect(stepList).toHaveText('0');

    // solutionStack should be empty initially
    await expect(solutionStack).toBeVisible();
    await expect(solutionStack.locator('.coin')).toHaveCount(0);

    // Ensure no page errors on initial render
    // eslint-disable-next-line no-underscore-dangle
    const pageErrors = page.context()._testPageErrors || [];
    expect(pageErrors.length).toBe(0);
  });

  test('Play animation transitions from Idle to Playing and completes with expected result (S0_Idle -> S1_Playing)', async ({ page }) => {
    // This test validates:
    // - clicking Play disables controls during animation
    // - intermediate visual cues appear (pile.active, .coin.float clones, .spark, code highlight)
    // - final solution total equals 63¢, six coins in stack, steps equal 6
    // - Play button re-enabled after completion
    const playBtn = page.locator('#playBtn');
    const resetBtn = page.locator('#resetBtn');
    const solutionTotal = page.locator('#solutionTotal');
    const stepList = page.locator('#stepList');
    const solutionStack = page.locator('#solutionStack');

    // Start playing
    await expect(playBtn).toBeEnabled();
    await playBtn.click();

    // Immediately after clicking, the app sets animating true and disables buttons
    await expect(playBtn).toBeDisabled();
    await expect(resetBtn).toBeDisabled();

    // During the animation we expect:
    // - some pile receives 'active' class
    // - floating coin clones appear (class coin.float.coin-clone)
    // - spark elements appear
    // - code lines get .highlight class at times

    // Wait for at least one pile to become active (during animatePick)
    await page.waitForSelector('.pile.active', { timeout: 5000 });

    // Wait for a floating coin clone element to appear
    // Note: created with classes 'coin float coin-clone'
    const floatingCoinLocator = page.locator('div.coin.float.coin-clone');
    await expect(floatingCoinLocator.first()).toBeVisible({ timeout: 5000 });

    // Spark effect should appear at least once during a pick
    await page.waitForSelector('.spark', { timeout: 7000 });

    // At least one code line should be highlighted during the animation
    await page.waitForSelector('.line.highlight', { timeout: 5000 });

    // Wait for the overall animation to complete: the UI resets animating and re-enables buttons.
    // Rather than rely on internal flags, observe final expected DOM state:
    // solutionTotal should eventually become '63¢' and stepList '6'
    await expect(solutionTotal).toHaveText('63¢', { timeout: 20000 });
    await expect(stepList).toHaveText('6', { timeout: 20000 });

    // Ensure exactly 6 coin nodes were appended to solutionStack
    await expect(solutionStack.locator('.coin')).toHaveCount(6, { timeout: 1000 });

    // Play and Reset should be re-enabled after the run completes
    await expect(playBtn).toBeEnabled({ timeout: 5000 });
    await expect(resetBtn).toBeEnabled({ timeout: 5000 });

    // Validate the sum of appended coins equals 63¢ by reading their text content
    const coinTexts = await solutionStack.locator('.coin').allTextContents();
    const coinValues = coinTexts.map(t => Number(t.replace('¢', '').trim()));
    const sum = coinValues.reduce((a, b) => a + b, 0);
    expect(sum).toBe(63);

    // Confirm there were no unhandled page errors during the animation
    // eslint-disable-next-line no-underscore-dangle
    const pageErrors = page.context()._testPageErrors || [];
    expect(pageErrors.length).toBe(0);
  });

  test('Reset action clears solution and returns to Idle (S1_Playing -> S0_Idle)', async ({ page }) => {
    // Validate reset when idle (no animation): resets UI.
    const playBtn = page.locator('#playBtn');
    const resetBtn = page.locator('#resetBtn');
    const solutionTotal = page.locator('#solutionTotal');
    const stepList = page.locator('#stepList');
    const solutionStack = page.locator('#solutionStack');

    // First produce a completed solution by invoking play via keyboard (Space) to use alternate trigger
    // Use keyboard to trigger the accessible hint
    await page.keyboard.press('Space');

    // Wait for completion
    await expect(solutionTotal).toHaveText('63¢', { timeout: 20000 });
    await expect(stepList).toHaveText('6', { timeout: 20000 });
    await expect(solutionStack.locator('.coin')).toHaveCount(6);

    // Click Reset and ensure returned to initial state
    await resetBtn.click();

    await expect(solutionTotal).toHaveText('0¢');
    await expect(stepList).toHaveText('0');
    await expect(solutionStack.locator('.coin')).toHaveCount(0);

    // No code lines highlighted after reset
    await expect(page.locator('.line.highlight')).toHaveCount(0);

    // Ensure no page errors occurred
    // eslint-disable-next-line no-underscore-dangle
    const pageErrors = page.context()._testPageErrors || [];
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: clicking Play repeatedly while animating should not cause errors or duplicate runs', async ({ page }) => {
    // This test ensures that repeated clicks do not crash the runtime and do not create extra duplicated state.
    const playBtn = page.locator('#playBtn');
    const resetBtn = page.locator('#resetBtn');
    const solutionTotal = page.locator('#solutionTotal');
    const stepList = page.locator('#stepList');
    const solutionStack = page.locator('#solutionStack');

    // Click Play to begin animation
    await playBtn.click();

    // While play is ongoing (buttons disabled), attempt to click Play multiple times.
    // Because the button is disabled in the UI, clicks should have no effect and should not produce errors.
    for (let i = 0; i < 5; i++) {
      // attempt to click via JS only if button is enabled — ideally it's disabled; this attempts to click regardless to
      // simulate a user hammering (Playwright click will fail if disabled, so use evaluate to call click()).
      // NOTE: We are intentionally not patching functions; we only call the DOM click() which may no-op when disabled.
      // Do not replace or redefine handlers.
      // eslint-disable-next-line no-await-in-loop
      await page.evaluate(() => {
        const b = document.getElementById('playBtn');
        if (b) {
          // Try calling click() in the DOM; if disabled, browser may still invoke click but handler checks animating flag.
          // This is allowed per instructions: do not modify global environment.
          try { b.click(); } catch (e) { /* swallow errors from invocation here; pageerror will capture unexpected ones */ }
        }
      });
      // small pause between attempts
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(120);
    }

    // Wait for the animation to finish normally
    await expect(solutionTotal).toHaveText('63¢', { timeout: 20000 });
    await expect(stepList).toHaveText('6', { timeout: 20000 });
    await expect(solutionStack.locator('.coin')).toHaveCount(6);

    // If multiple runs were mistakenly triggered in parallel, we might observe more than 6 coins.
    // Assert that we have exactly 6 coins (expected for amount 63¢)
    const coinCount = await solutionStack.locator('.coin').count();
    expect(coinCount).toBe(6);

    // Ensure no page errors occurred due to repeated interactions
    // eslint-disable-next-line no-underscore-dangle
    const pageErrors = page.context()._testPageErrors || [];
    expect(pageErrors.length).toBe(0);

    // Reset for cleanup
    await resetBtn.click();
  });

  test('Edge case: attempt to Reset while animating — should be ignored and not crash (reset is disabled during play)', async ({ page }) => {
    // This test ensures clicking Reset during play does not throw and does not clear currently animating state.
    const playBtn = page.locator('#playBtn');
    const resetBtn = page.locator('#resetBtn');
    const solutionTotal = page.locator('#solutionTotal');
    const solutionStack = page.locator('#solutionStack');

    // Start play
    await playBtn.click();

    // Immediately attempt to invoke reset via DOM (simulate aggressive user).
    // Because resetBtn is disabled, the UI prevents it; calling click() may still call handler if browser allows, but handler
    // itself checks animating and returns early. We do not patch anything; we simply call click() to surface any errors.
    await page.evaluate(() => {
      const rb = document.getElementById('resetBtn');
      if (rb) {
        try { rb.click(); } catch (e) { /* let pageerror capture if any thrown */ }
      }
    });

    // While animating, ensure some floating coin appears to confirm animation in progress
    await page.waitForSelector('div.coin.float.coin-clone', { timeout: 5000 });

    // After normal completion, ensure the solution is still correct (reset call during animation did not clear final state)
    await expect(solutionTotal).toHaveText('63¢', { timeout: 20000 });
    await expect(solutionStack.locator('.coin')).toHaveCount(6);

    // Confirm no page errors observed
    // eslint-disable-next-line no-underscore-dangle
    const pageErrors = page.context()._testPageErrors || [];
    expect(pageErrors.length).toBe(0);

    // Cleanup: reset to idle
    await page.locator('#resetBtn').click();
    await expect(solutionTotal).toHaveText('0¢');
  });

  test('Verify pseudo-code highlighting cycles during the animation (visual indicators)', async ({ page }) => {
    // Validate that code lines get the .highlight class during animation and eventually clear.
    const playBtn = page.locator('#playBtn');
    await playBtn.click();

    // Wait for highlight to appear at some point
    await page.waitForSelector('.line.highlight', { timeout: 7000 });

    // Capture which line(s) are highlighted at least once during animation by polling a few times.
    const observedLines = new Set();
    for (let i = 0; i < 8; i++) {
      // eslint-disable-next-line no-await-in-loop
      const highlighted = await page.$$eval('.line.highlight', els => els.map(e => e.dataset.line));
      for (const ln of highlighted) observedLines.add(ln);
      // eslint-disable-next-line no-await-in-loop
      await page.waitForTimeout(300);
    }

    // We expect at least one of the core lines (5,6,7,8) to have been highlighted during run according to implementation.
    const intersection = ['5', '6', '7', '8'].filter(l => observedLines.has(l));
    expect(intersection.length).toBeGreaterThan(0);

    // Wait for completion and ensure highlights are cleared
    await expect(page.locator('#solutionTotal')).toHaveText('63¢', { timeout: 20000 });
    await expect(page.locator('.line.highlight')).toHaveCount(0);
  });

  test('Diagnostic: ensure no unexpected console errors or exceptions occurred across interactions', async ({ page }) => {
    // Run a full scenario: play -> reset -> play via keyboard -> reset and then assert no page errors were emitted.
    const playBtn = page.locator('#playBtn');
    const resetBtn = page.locator('#resetBtn');

    // Play (mouse)
    await playBtn.click();
    await expect(page.locator('#solutionTotal')).toHaveText('63¢', { timeout: 20000 });

    // Reset
    await resetBtn.click();
    await expect(page.locator('#solutionTotal')).toHaveText('0¢');

    // Play (keyboard)
    await page.keyboard.press('Space');
    await expect(page.locator('#solutionTotal')).toHaveText('63¢', { timeout: 20000 });

    // Reset again
    await resetBtn.click();
    await expect(page.locator('#solutionTotal')).toHaveText('0¢');

    // Check console and page errors
    // eslint-disable-next-line no-underscore-dangle
    const pageErrors = page.context()._testPageErrors || [];
    // eslint-disable-next-line no-underscore-dangle
    const consoleMessages = page.context()._testConsoleMessages || [];

    // Assert no page exceptions were thrown during these scenarios
    expect(pageErrors.length).toBe(0);

    // Also assert there are no console messages of type 'error' (some libraries may log benign warnings; we restrict to 'error')
    const errorConsoles = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(errorConsoles.length).toBe(0);
  });
});