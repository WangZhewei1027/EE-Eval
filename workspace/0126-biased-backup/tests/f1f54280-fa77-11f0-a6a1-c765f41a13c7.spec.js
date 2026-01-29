import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f54280-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('Max Heap — Visualized (f1f54280-fa77-11f0-a6a1-c765f41a13c7)', () => {
  // Collect console.error and pageerror events for assertions about runtime errors.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen for console messages to detect runtime errors logged to console
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Listen for page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app page
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Wait a short while for the initial UI entrance animations to complete
    await page.waitForTimeout(600);
  });

  test.afterEach(async () => {
    // noop - teardown handled by Playwright
  });

  // Helper: read array row values as an array of strings
  async function readArrayRowValues(page) {
    return await page.$$eval('#arrayRow .arr-box .val', nodes => nodes.map(n => n.textContent.trim()));
  }

  // Helper: count token elements in stage
  async function countTokens(page) {
    return await page.$$eval('#stage .token', t => t.length);
  }

  // Helper: capture token positions (left, top) for each token element, returns array of {left,top}
  async function tokenPositions(page) {
    return await page.$$eval('#stage .token', nodes => nodes.map(n => {
      const style = window.getComputedStyle(n);
      return { left: style.left, top: style.top, id: n.dataset.id || null, html: n.innerHTML };
    }));
  }

  // Helper: count spark elements (celebration)
  async function countSparks(page) {
    return await page.$$eval('#stage .spark', s => s.length);
  }

  test.describe('Initial Idle State (S0_Idle) and setupInterface()', () => {
    test('initial UI elements exist and setupInterface populated DOM', async ({ page }) => {
      // Validate play and reset buttons exist with correct attributes (component evidence)
      const playBtn = page.locator('#playBtn');
      const resetBtn = page.locator('#resetBtn');

      await expect(playBtn).toHaveText('Play');
      await expect(playBtn).toHaveAttribute('title', 'Play or pause the animation');
      await expect(resetBtn).toHaveText('Reset');
      await expect(resetBtn).toHaveAttribute('title', 'Reset to initial array');

      // Validate arrayRow boxes created (initialArray length = 9 from HTML script)
      const arrBoxes = page.locator('#arrayRow .arr-box');
      await expect(arrBoxes).toHaveCount(9);

      // Validate tokens are present in the stage
      const tokenCount = await countTokens(page);
      expect(tokenCount).toBeGreaterThanOrEqual(9);

      // Validate actions (computed by computeActions at startup) have been attached to window.__heapViz
      const actionsLength = await page.evaluate(() => {
        // window.__heapViz.actions was attached in the script; confirm it's an array and return its length
        return Array.isArray(window.__heapViz && window.__heapViz.actions) ? window.__heapViz.actions.length : -1;
      });
      expect(actionsLength).toBeGreaterThanOrEqual(0);

      // Assert no uncaught page errors or console.error messages during initial load
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('reset called on initial load keeps the interface consistent (idempotent)', async ({ page }) => {
      // Call reset via exposed API and ensure DOM remains valid
      await page.evaluate(() => window.__heapViz && window.__heapViz.reset && window.__heapViz.reset());

      // After reset, arrayRow still has 9 boxes and play button text is Play
      const arrCount = await page.$$eval('#arrayRow .arr-box', n => n.length);
      expect(arrCount).toBe(9);
      const playText = await page.$eval('#playBtn', b => b.textContent.trim());
      expect(playText).toBe('Play');

      // No runtime errors produced by calling reset synchronously
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Playing State (S1_Playing) and PlayToggle events', () => {
    test('clicking Play toggles to Playing state and begins animations', async ({ page }) => {
      // Capture initial array order and initial token positions
      const beforeValues = await readArrayRowValues(page);
      const beforePositions = await tokenPositions(page);

      // Start the animation via Play button
      await page.click('#playBtn');

      // Play button should reflect playing state
      await expect(page.locator('#playBtn')).toHaveText('Pause');

      // There should be at least one action to animate; get actions length to compute wait time
      const actionsLen = await page.evaluate(() => (window.__heapViz && Array.isArray(window.__heapViz.actions)) ? window.__heapViz.actions.length : 0);
      // Wait a reasonable time for at least one swap to complete (900ms for a swap + small buffer)
      const waitForOneAction = 1100;
      await page.waitForTimeout(waitForOneAction);

      // After some time, array values should have changed if at least one action exists
      const afterValues = await readArrayRowValues(page);
      if (actionsLen > 0) {
        // Expect at least one differing entry between before and after
        const differ = beforeValues.some((v, i) => v !== afterValues[i]);
        expect(differ).toBeTruthy();
      } else {
        // If no actions planned, the array should remain unchanged
        expect(afterValues).toEqual(beforeValues);
      }

      // Token positions should have started moving (some tokens' left/top should differ)
      const afterPositions = await tokenPositions(page);
      const posChanged = beforePositions.some((p, i) => p.left !== afterPositions[i].left || p.top !== afterPositions[i].top);
      // If there were tokens and actions, expect some movement
      if (actionsLen > 0) expect(posChanged).toBeTruthy();

      // Pause to avoid long-running animation for subsequent tests
      await page.click('#playBtn');
      await expect(page.locator('#playBtn')).toHaveText('Play');

      // Ensure no uncaught errors happened during play
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('clicking while Playing toggles to Idle (pause) and halts progression', async ({ page }) => {
      // Start playback
      await page.click('#playBtn');
      await expect(page.locator('#playBtn')).toHaveText('Pause');

      // Wait a short while then pause
      await page.waitForTimeout(250);
      // Pause
      await page.click('#playBtn');
      await expect(page.locator('#playBtn')).toHaveText('Play');

      // Capture values immediately after pause
      const valuesAtPause = await readArrayRowValues(page);

      // Wait a longer time (longer than action animation) to ensure nothing further happens while paused
      await page.waitForTimeout(1500);

      const valuesLater = await readArrayRowValues(page);
      expect(valuesLater).toEqual(valuesAtPause);

      // Ensure no uncaught runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Animation Completion (S2_Finished) and celebration()', () => {
    test('running to completion triggers celebration and final UI state', async ({ page }) => {
      // Determine how many actions need to run so we can wait for them to complete
      const actionsLen = await page.evaluate(() => (window.__heapViz && Array.isArray(window.__heapViz.actions)) ? window.__heapViz.actions.length : 0);

      // Start the animation
      await page.click('#playBtn');
      await expect(page.locator('#playBtn')).toHaveText('Pause');

      // Estimate total duration: for each action animateSwap2 uses duration ~900ms + 30ms buffer + 140ms between actions
      const perAction = 900 + 30 + 140;
      const estimated = Math.max(1000, actionsLen * perAction + 800); // minimal wait to allow celebration

      // Wait up to an upper bound but don't hang tests forever: cap wait to 30000ms
      const waitMs = Math.min(estimated, 30000);
      await page.waitForTimeout(waitMs);

      // After completion, celebration() should have added spark elements
      const sparks = await countSparks(page);
      expect(sparks).toBeGreaterThanOrEqual(1);

      // Play button text should have returned to Play (isPlaying false)
      await expect(page.locator('#playBtn')).toHaveText('Play');

      // Verify at least the root token gets highlighted momentarily by celebration (token highlight may have been removed)
      // We assert that tokens still exist and DOM is not broken
      const tokens = await countTokens(page);
      expect(tokens).toBeGreaterThanOrEqual(1);

      // Edge: clicking Play after finished should NOT restart (start() returns early if finished)
      await page.click('#playBtn');
      // Since the app prevents starting after finished, the Play button should remain 'Play'
      await expect(page.locator('#playBtn')).toHaveText('Play');

      // Ensure no uncaught runtime errors occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Reset event and edge cases', () => {
    test('Reset from Idle restores initial array and visual state', async ({ page }) => {
      // Mutate state by performing one animation step if possible
      const actionsLen = await page.evaluate(() => (window.__heapViz && Array.isArray(window.__heapViz.actions)) ? window.__heapViz.actions.length : 0);
      let mutBefore = await readArrayRowValues(page);

      if (actionsLen > 0) {
        // Start and wait for one action to complete, then pause
        await page.click('#playBtn');
        await page.waitForTimeout(1200);
        await page.click('#playBtn'); // pause
        const afterOne = await readArrayRowValues(page);
        // If changed, we can now reset
        if (afterOne.join(',') === mutBefore.join(',')) {
          // nothing changed, but still perform reset to ensure idempotency
        }
      }

      // Click reset
      await page.click('#resetBtn');

      // After reset, the array should equal the initial array declared in the page script
      const afterReset = await readArrayRowValues(page);

      // The initial array in the HTML is [7, 3, 19, 1, 8, 9, 12, 20, 10]
      const initial = ['7','3','19','1','8','9','12','20','10'];
      expect(afterReset).toEqual(initial);

      // Play button should be in Play state
      await expect(page.locator('#playBtn')).toHaveText('Play');

      // There should be no celebration sparks after reset
      const sparks = await countSparks(page);
      expect(sparks).toBe(0);

      // Ensure no uncaught runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('rapid successive resets do not break the UI (edge case)', async ({ page }) => {
      // Click reset multiple times quickly
      await page.click('#resetBtn');
      await page.click('#resetBtn');
      await page.click('#resetBtn');

      // After rapid resets, ensure arrayRow still has 9 boxes and values equal the initial array
      const arrCount = await page.$$eval('#arrayRow .arr-box', n => n.length);
      expect(arrCount).toBe(9);

      const after = await readArrayRowValues(page);
      const initial = ['7','3','19','1','8','9','12','20','10'];
      expect(after).toEqual(initial);

      // No runtime exceptions must have been thrown
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Runtime observation: console and page errors', () => {
    test('no uncaught ReferenceError/SyntaxError/TypeError occurred during load and interactions', async ({ page }) => {
      // Perform a few interactions to surface any latent runtime issues
      await page.click('#playBtn');
      await page.waitForTimeout(300);
      await page.click('#playBtn');
      await page.click('#resetBtn');
      await page.waitForTimeout(300);

      // Assert that no pageerror events (uncaught exceptions) happened
      // This ensures ReferenceError / TypeError / SyntaxError did not occur during these interactions
      expect(pageErrors.length).toBe(0);

      // Also assert there were no console.error messages emitted
      expect(consoleErrors.length).toBe(0);
    });
  });
});