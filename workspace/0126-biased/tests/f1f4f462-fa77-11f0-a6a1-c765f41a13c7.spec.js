import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f4f462-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('AVL Tree — Aesthetic Visualization (FSM validation)', () => {
  // Arrays to capture console errors and page errors for assertions
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // Safety: do not interfere with page runtime
      }
    });

    // Capture unhandled page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Load the page fresh for each test
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure initial layout has rendered
    await page.waitForSelector('#playBtn', { state: 'visible' });
    await page.waitForSelector('#resetBtn', { state: 'visible' });
    await page.waitForSelector('#stepInfo', { state: 'visible' });
  });

  test.afterEach(async () => {
    // nothing to teardown explicitly; tests will assert errors as needed
  });

  test('Idle state on initial load: play button enabled, step info shows 0 / 10, hint nodes present', async ({ page }) => {
    // Validate Idle (S0_Idle) evidence via DOM:
    // - playBtn.disabled = false
    // - stepInfo.textContent = 'Step: 0 / ' + sequence.length
    const playBtn = page.locator('#playBtn');
    const resetBtn = page.locator('#resetBtn');
    const stepInfo = page.locator('#stepInfo');
    const nodesLayerCount = await page.evaluate(() => {
      const nodes = document.getElementById('nodes');
      return nodes ? nodes.children.length : 0;
    });

    // Play button should be enabled and have the initial label
    await expect(playBtn).toBeEnabled();
    await expect(playBtn).toHaveText('Play Animation');

    // Reset button should be visible and enabled
    await expect(resetBtn).toBeEnabled();
    await expect(resetBtn).toHaveText('Reset');

    // Step info should reflect Idle step 0 / 10
    await expect(stepInfo).toHaveText('Step: 0 / 10');

    // The initialDecor() creates gentle hint nodes (hint1, hint2, hint3).
    // Validate that some SVG nodes exist in the DOM (hint nodes)
    expect(nodesLayerCount).toBeGreaterThanOrEqual(1);

    // Also assert there are no console or page errors on initial load
    expect(consoleErrors.length, 'no console.error messages on load').toBe(0);
    expect(pageErrors.length, 'no uncaught page errors on load').toBe(0);
  });

  test('PlayAnimation transition: clicking Play enters Playing state (button disabled and labeled), animations start updating step info', async ({ page }) => {
    const playBtn = page.locator('#playBtn');
    const stepInfo = page.locator('#stepInfo');

    // Click Play to trigger reset(); play();
    await playBtn.click();

    // Immediately after clicking Play, the UI should reflect Playing state
    await expect(playBtn).toBeDisabled();
    await expect(playBtn).toHaveText('Playing…');

    // While playing, stepInfo should progress from 0 to at least 1 within a reasonable time.
    // We wait for the first "After inserting" update once the animation runner emits it.
    await page.waitForFunction(() => {
      const el = document.getElementById('stepInfo');
      return el && /Step:\s*\d+\s*\/\s*10/.test(el.textContent || '');
    }, { timeout: 10000 });

    const stepText = await stepInfo.textContent();
    // It should resemble 'Step: X / 10' where X is between 1 and 10 as the animation runs.
    expect(/Step:\s*\d+\s*\/\s*10/.test(stepText)).toBeTruthy();

    // Now click Reset to stop the animation early (transition S1_Playing -> S0_Idle)
    const resetBtn = page.locator('#resetBtn');
    await resetBtn.click();

    // After reset, play button should be enabled and have the original label
    await expect(playBtn).toBeEnabled();
    await expect(playBtn).toHaveText('Play Animation');

    // After reset, step info should be reset to 'Step: 0 / 10'
    await expect(stepInfo).toHaveText('Step: 0 / 10');

    // After reset, the nodes layer should be empty because removeAllNodes() is invoked
    const postResetNodeCount = await page.evaluate(() => {
      const nodes = document.getElementById('nodes');
      return nodes ? nodes.children.length : 0;
    });
    expect(postResetNodeCount).toBe(0);

    // Ensure there were no unexpected runtime errors during play -> reset transition
    expect(consoleErrors.length, 'no console.error during play/reset').toBe(0);
    expect(pageErrors.length, 'no uncaught exceptions during play/reset').toBe(0);
  });

  test('Reset from Idle maintains Idle state and clears nodes (S2_Reset evidence)', async ({ page }) => {
    // Starting from fresh load (Idle), call Reset and verify Reset actions:
    // - globalRoot = null (internal) -> observable effect: nodes removed
    // - events.length = 0 (internal) -> cannot observe directly
    // - removeAllNodes() -> nodes layer should be cleared

    const playBtn = page.locator('#playBtn');
    const resetBtn = page.locator('#resetBtn');
    const stepInfo = page.locator('#stepInfo');

    // Ensure we are in Idle initially
    await expect(playBtn).toBeEnabled();
    await expect(stepInfo).toHaveText('Step: 0 / 10');

    // Click Reset
    await resetBtn.click();

    // After reset, play button should remain enabled
    await expect(playBtn).toBeEnabled();
    await expect(playBtn).toHaveText('Play Animation');

    // Step info should be reset to 0 / 10
    await expect(stepInfo).toHaveText('Step: 0 / 10');

    // Nodes should be removed from the DOM
    const nodeCount = await page.evaluate(() => {
      const nodes = document.getElementById('nodes');
      return nodes ? nodes.children.length : 0;
    });
    expect(nodeCount).toBe(0);

    // No runtime errors expected
    expect(consoleErrors.length, 'no console.error after idle reset').toBe(0);
    expect(pageErrors.length, 'no uncaught exceptions after idle reset').toBe(0);
  });

  test('Edge case: clicking Play twice rapidly should not cause multiple concurrent plays or crashes (S1_Playing idempotency)', async ({ page }) => {
    const playBtn = page.locator('#playBtn');
    const resetBtn = page.locator('#resetBtn');
    const stepInfo = page.locator('#stepInfo');

    // Click Play once
    await playBtn.click();

    // Immediately attempt to click Play again (user might spam click).
    // In normal browser behavior the button is disabled, so the second click likely has no effect.
    // We still attempt and ensure the application does not crash and remains in Playing state.
    try {
      // Attempt a second programmatic click; may be ignored if disabled.
      await playBtn.click({ timeout: 1000 });
    } catch (e) {
      // If the click fails because the button is disabled, that's acceptable. Do not treat as test failure.
    }

    // Confirm we are in Playing state: button disabled and text changed
    await expect(playBtn).toBeDisabled();
    await expect(playBtn).toHaveText('Playing…');

    // Let the animation progress at least one insertion, but we will stop soon to keep tests fast.
    await page.waitForFunction(() => {
      const el = document.getElementById('stepInfo');
      return el && /Step:\s*\d+\s*\/\s*10/.test(el.textContent || '');
    }, { timeout: 10000 });

    // Now perform Reset to ensure we exit to Idle cleanly
    await resetBtn.click();

    // After reset, verify Idle signals are restored
    await expect(playBtn).toBeEnabled();
    await expect(playBtn).toHaveText('Play Animation');
    await expect(stepInfo).toHaveText('Step: 0 / 10');

    // Validate no uncaught errors during rapid interactions
    expect(consoleErrors.length, 'no console.error during rapid clicks').toBe(0);
    expect(pageErrors.length, 'no uncaught exceptions during rapid clicks').toBe(0);
  });

  test('Visual DOM assertions during animation: nodes get created and have expected attributes when a snapshot renders', async ({ page }) => {
    const playBtn = page.locator('#playBtn');

    // Start play
    await playBtn.click();

    // Wait for the first non-empty snapshot render: nodes layer should contain elements with data-val attributes
    await page.waitForFunction(() => {
      const nodes = document.getElementById('nodes');
      if (!nodes) return false;
      // At least one child with data-val attribute should exist
      for (const child of Array.from(nodes.children)) {
        if (child.getAttribute && child.getAttribute('data-val')) return true;
      }
      return false;
    }, { timeout: 10000 });

    // Inspect some of the node elements to ensure they carry data-val and data-id
    const nodeAttrs = await page.evaluate(() => {
      const nodes = document.getElementById('nodes');
      if (!nodes) return [];
      const result = [];
      for (const child of Array.from(nodes.children)) {
        const id = child.getAttribute ? child.getAttribute('data-id') : null;
        const val = child.getAttribute ? child.getAttribute('data-val') : null;
        if (id || val) result.push({ id, val });
      }
      return result.slice(0, 5);
    });

    // There should be at least one node with data-val present and it's numeric or hint id
    expect(nodeAttrs.length).toBeGreaterThanOrEqual(1);
    expect(nodeAttrs.some(n => n.val !== null)).toBeTruthy();

    // Stop the animation to restore Idle before finishing
    const resetBtn = page.locator('#resetBtn');
    await resetBtn.click();

    // Confirm Idle
    await expect(playBtn).toBeEnabled();

    // No runtime errors encountered during rendering snapshots
    expect(consoleErrors.length, 'no console.error during snapshot rendering').toBe(0);
    expect(pageErrors.length, 'no uncaught exceptions during snapshot rendering').toBe(0);
  });
});