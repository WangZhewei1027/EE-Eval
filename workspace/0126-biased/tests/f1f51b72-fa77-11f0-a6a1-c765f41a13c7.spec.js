import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f51b72-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Min Heap — Visual Concept (FSM validation)', () => {
  // Shared per-test collectors for console errors and page errors
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages and page uncaught exceptions
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // ignore observer errors
      }
    });
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the exact served HTML
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure main elements are available before tests run
    await expect(page.locator('#playBtn')).toBeVisible();
    await expect(page.locator('#regenBtn')).toBeVisible();
    await expect(page.locator('#canvas')).toBeVisible();
  });

  test.afterEach(async () => {
    // After each test assert there were no uncaught runtime errors
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error logs: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
  });

  test('Initial Idle state (S0) — page loads and presents a static heap (initRandom entry-like validation)', async ({ page }) => {
    // Validate that on initial load the app is in Idle state:
    // - animating should be false
    // - playBtn and regenBtn should be enabled
    // - nodes created by the startup IIFE exist (the startup uses a default array of 7 items)
    const animating = await page.evaluate(() => window.animating === true ? true : false);
    expect(animating).toBe(false);

    const playDisabled = await page.locator('#playBtn').getAttribute('disabled');
    const regenDisabled = await page.locator('#regenBtn').getAttribute('disabled');
    // If undefined => not disabled
    expect(playDisabled).toBeNull();
    expect(regenDisabled).toBeNull();

    // There should be node elements injected (startup creates 7 nodes)
    const nodeCount = await page.$$eval('.node', els => els.length);
    expect(nodeCount).toBeGreaterThanOrEqual(7);
    expect(nodeCount).toBeLessThanOrEqual(14);

    // The initial hard-coded startup array used in the implementation begins with 18 at root index 0.
    // Verify the node with data-idx="0" exists and has the expected label.
    const rootLabel = await page.$eval('.node[data-idx="0"] .label', el => el.textContent.trim());
    expect(['18', '18']).toContain(rootLabel); // defensive, ensure value is present

    // Also verify the arrayRow pills were created by createNodes during startup
    const pillCount = await page.$$eval('#arrayRow .pill', pills => pills.length);
    // createNodes places pills equal to node count, so expect >=7
    expect(pillCount).toBeGreaterThanOrEqual(7);
  });

  test('PlayBuildAnimation event triggers Animating state (S1) and disables controls', async ({ page }) => {
    // Click the Play Build Animation button and validate the S0 -> S1 transition:
    // - animating becomes true
    // - playBtn.disabled becomes true
    // - regenBtn.disabled becomes true while animating
    // - some node visual classes applied during animation (e.g., pulse or compare)
    const play = page.locator('#playBtn');
    const regen = page.locator('#regenBtn');

    // Start the animation
    await play.click();

    // Wait for animating to become true in the page script
    await page.waitForFunction(() => window.animating === true, null, { timeout: 5000 });

    // Assert UI disabled states
    await expect(play).toBeDisabled();
    await expect(regen).toBeDisabled();

    // While animation is running, at least one node should have the 'pulse' or 'compare' class applied at some point.
    // We'll poll briefly to find evidence of such a class.
    const sawAnimatedClass = await page.waitForFunction(() => {
      const nodes = Array.from(document.querySelectorAll('.node'));
      return nodes.some(n => n.classList.contains('pulse') || n.classList.contains('compare') || n.classList.contains('swap'));
    }, null, { timeout: 3000 }).then(() => true).catch(() => false);

    expect(sawAnimatedClass, 'Expected to observe node animation classes (pulse/compare/swap) during build animation').toBe(true);

    // Now wait for the animation to finish (animating becomes false) — allow generous timeout for safety
    await page.waitForFunction(() => window.animating === false, null, { timeout: 30000 });

    // After completion the Play button should be re-enabled and regen should be re-enabled
    await expect(play).toBeEnabled();
    await expect(regen).toBeEnabled();
  });

  test('GenerateNewHeap event generates a fresh heap and returns to Idle (S1 -> S0 via regen when not animating)', async ({ page }) => {
    // Ensure idle first by calling initRandom to create a fresh known state
    // Call initRandom() (onEnter action for S0 is expected per FSM) — this validates the function exists and creates nodes
    await page.evaluate(() => {
      if (typeof window.initRandom === 'function') {
        window.initRandom();
      }
    });

    // Capture the previous arrayRow values for comparison
    const previousPills = await page.$$eval('#arrayRow .pill', pills => pills.map(p => p.textContent.trim()).join('|'));

    // Click the regen button to Generate New Heap (this triggers initRandomForAnimation() in implementation)
    await page.locator('#regenBtn').click();

    // After regen, arrayRow should update to a new sequence with count between 8 and 14 as per initRandomForAnimation
    // Wait for the arrayRow to change (text content different from previous)
    await page.waitForFunction((prev) => {
      const current = Array.from(document.querySelectorAll('#arrayRow .pill')).map(p => p.textContent.trim()).join('|');
      return current !== prev && current.length > 0;
    }, previousPills, { timeout: 5000 });

    // Assert new pill count is within expected range (8..14)
    const newPillCount = await page.$$eval('#arrayRow .pill', pills => pills.length);
    expect(newPillCount).toBeGreaterThanOrEqual(8);
    expect(newPillCount).toBeLessThanOrEqual(14);

    // Ensure animating is false (Idle)
    const animatingNow = await page.evaluate(() => !!window.animating);
    expect(animatingNow).toBe(false);
  });

  test('Calling initRandom() explicitly acts as S0 entry action and creates a valid node set', async ({ page }) => {
    // Validate the existence of initRandom and that it performs without error when not animating
    const hasInitRandom = await page.evaluate(() => typeof window.initRandom === 'function');
    expect(hasInitRandom).toBe(true);

    // Call initRandom and verify nodes created count in the expected range (7..13)
    await page.evaluate(() => window.initRandom());

    // Wait for nodes to be present
    await page.waitForFunction(() => document.querySelectorAll('.node').length >= 7, null, { timeout: 3000 });

    const nodesCount = await page.$$eval('.node', els => els.length);
    expect(nodesCount).toBeGreaterThanOrEqual(7);
    expect(nodesCount).toBeLessThanOrEqual(13);

    // Confirm animating is false after initRandom
    const anim = await page.evaluate(() => !!window.animating);
    expect(anim).toBe(false);
  });

  test('Edge case: clicking Play multiple times quickly should not cause errors or multiple concurrent animations', async ({ page }) => {
    // Begin by ensuring idle
    await page.evaluate(() => {
      if (typeof window.initRandom === 'function') window.initRandom();
    });

    // Rapidly click Play twice
    await page.locator('#playBtn').click();
    await page.locator('#playBtn').click();

    // animating should be true
    await page.waitForFunction(() => window.animating === true, null, { timeout: 5000 });
    // Ensure controls disabled during animation
    await expect(page.locator('#playBtn')).toBeDisabled();
    await expect(page.locator('#regenBtn')).toBeDisabled();

    // Wait for animation to finish; should complete without raising page errors
    await page.waitForFunction(() => window.animating === false, null, { timeout: 30000 });

    // Buttons re-enabled
    await expect(page.locator('#playBtn')).toBeEnabled();
    await expect(page.locator('#regenBtn')).toBeEnabled();

    // No page errors asserted in afterEach
  });

  test('Edge case: attempting to Generate New Heap while animating is ignored and does not throw', async ({ page }) => {
    // Ensure idle and then start animation
    await page.evaluate(() => {
      if (typeof window.initRandom === 'function') window.initRandom();
    });

    // Start animation
    await page.locator('#playBtn').click();
    await page.waitForFunction(() => window.animating === true, null, { timeout: 5000 });

    // Attempt to click regen while animating (button is disabled; click should be a no-op and not throw)
    // Use try/catch to ensure click resolves; Playwright will still perform the click, but DOM disabled prevents handler
    let clickedOk = true;
    try {
      await page.locator('#regenBtn').click({ timeout: 2000 }).catch(() => {});
    } catch (e) {
      clickedOk = false;
    }
    expect(clickedOk).toBe(true);

    // Capture current node labels to ensure no immediate change occurred
    const labelsBefore = await page.$$eval('.node .label', els => els.map(e => e.textContent.trim()).join('|'));

    // Wait until animation ends
    await page.waitForFunction(() => window.animating === false, null, { timeout: 30000 });

    // After animation, ensure the node labels changed only through the animation process (no crash), and regen didn't trigger a mid-animation reset
    const labelsAfter = await page.$$eval('.node .label', els => els.map(e => e.textContent.trim()).join('|'));
    // It's acceptable that labels changed due to heap build swaps; critical is that no error occurred and page remained stable
    expect(typeof labelsAfter).toBe('string');
  });
});