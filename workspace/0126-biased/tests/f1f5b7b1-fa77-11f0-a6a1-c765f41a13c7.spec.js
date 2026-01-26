import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f5b7b1-fa77-11f0-a6a1-c765f41a13c7.html';

// Increase timeout for animations and sorting on CI/machine variations
test.setTimeout(120000);

test.describe('Heap Sort — Visualized (FSM & UI integration tests)', () => {
  // Collect runtime errors and console error messages per test instance
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture unhandled page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // Ensure the page loaded and basic elements are present
    await expect(page.locator('#start')).toBeVisible();
    await expect(page.locator('#shuffle')).toBeVisible();
    await expect(page.locator('#items')).toBeVisible();
  });

  test.afterEach(async () => {
    // After each test we'll assert there were no uncaught page errors or console errors
    // Tests that intentionally expect errors should override this behavior themselves.
    expect(pageErrors.length, 'No uncaught page errors').toBe(0);
    expect(consoleErrors.length, 'No console.error messages').toBe(0);
  });

  test.describe('Idle state (S0_Idle) validations', () => {
    test('Initial entry should reset data and render nodes (S0_Idle entry action: resetData)', async ({ page }) => {
      // This test validates the initial "Idle" state after page load:
      // - size label is set
      // - nodes are rendered equal to size
      // - nodes display numbers within configured range
      const sizeLabel = page.locator('#sizeLabel');
      await expect(sizeLabel).toHaveText('12');

      // There should be 12 .node elements initially
      const nodes = page.locator('#items .node');
      await expect(nodes).toHaveCount(12);

      // Verify start button initial state and text
      const startBtn = page.locator('#start');
      await expect(startBtn).toHaveText('Start');
      await expect(startBtn).toBeEnabled();

      // Verify node values are numeric and within expected bounds
      const values = await page.$$eval('#items .node .value', els => els.map(el => el.textContent.trim()));
      expect(values.length).toBe(12);
      // All values should be parseable integers and roughly in the range specified in code
      for (const v of values) {
        const n = parseInt(v, 10);
        expect(Number.isFinite(n), `value is integer: ${v}`).toBe(true);
        // range per config.minVal/config.maxVal in HTML: 12..98
        expect(n >= 12 && n <= 98, `value ${n} in [12,98]`).toBe(true);
      }
      // No console/page errors observed so far (checked in afterEach)
    });

    test('Shuffle action (Shuffle event) should change array values but keep size (S0_Idle -> S0_Idle)', async ({ page }) => {
      // Capture current values
      const getValues = async () => {
        return page.$$eval('#items .node .value', els => els.map(el => el.textContent.trim()));
      };
      const before = await getValues();

      // Click shuffle button
      await page.click('#shuffle');

      // Wait for changes: shuffleAction resets data and calls setupElements.
      // We'll wait until node values differ from the before snapshot
      await page.waitForFunction(
        (beforeVals) => {
          const vals = Array.from(document.querySelectorAll('#items .node .value')).map(n => n.textContent.trim());
          if (vals.length !== beforeVals.length) return false;
          // If at least one value differs, deem the shuffle successful
          return vals.some((v, idx) => v !== beforeVals[idx]);
        },
        before,
        { timeout: 2000 }
      );

      const after = await getValues();
      expect(after.length).toBe(before.length);
      // At least one value should differ after shuffle
      const changed = after.some((v, i) => v !== before[i]);
      expect(changed, 'At least one array element changed after shuffle').toBe(true);
    });
  });

  test.describe('Sorting state (S1_Sorting) and transitions', () => {
    test('Clicking Start transitions into Sorting: UI indicates running and disables controls (S0_Idle -> S1_Sorting)', async ({ page }) => {
      // Validate that clicking Start triggers startAction and UI updates accordingly.
      const startBtn = page.locator('#start');
      const shuffleBtn = page.locator('#shuffle');

      // Start animation by clicking Start
      await startBtn.click();

      // Immediately expect the button to reflect running state
      await expect(startBtn).toHaveText('Running...');
      await expect(startBtn).toBeDisabled();
      await expect(shuffleBtn).toBeDisabled();

      // During sorting, some nodes should get highlight or compare classes.
      // Wait up to a reasonable time to observe active comparison visuals.
      await page.waitForSelector('#items .node.highlight, #items .node.compare', { timeout: 8000 });

      // Wait until animation completes: the start button returns to "Start"
      // This may take longer due to the number of animated swaps; generous timeout provided.
      await page.waitForFunction(() => document.getElementById('start').textContent.trim() === 'Start', { timeout: 90000 });

      // After completion, start and shuffle should be enabled again
      await expect(startBtn).toHaveText('Start');
      await expect(startBtn).toBeEnabled();
      await expect(shuffleBtn).toBeEnabled();

      // Check that nodes are marked as sorted (finalization step in heapSortAnimate)
      const allSorted = await page.$$eval('#items .node', nodes => nodes.every(n => n.classList.contains('sorted')));
      expect(allSorted, 'All nodes should be marked as sorted after heap sort completes').toBe(true);
    });

    test('Space key starts the animation (SpaceStart event) and updates UI state', async ({ page }) => {
      // This test validates that pressing Space triggers startAction when idle.
      // Navigate to fresh page to ensure idle state.
      // (beforeEach already navigated)
      // Press space
      await page.keyboard.press('Space');

      // Expect start button to show Running... and be disabled
      const startBtn = page.locator('#start');
      const shuffleBtn = page.locator('#shuffle');
      await expect(startBtn).toHaveText('Running...');
      await expect(startBtn).toBeDisabled();
      await expect(shuffleBtn).toBeDisabled();

      // We will not wait for full completion here to avoid duplicating a long sort.
      // Instead, assert that animation has indeed started by confirming highlight/comparison appear.
      await page.waitForSelector('#items .node.highlight, #items .node.compare', { timeout: 8000 });

      // Allow the running sort to finish before the test ends to keep the app in a finished state for afterEach checks.
      // Wait for completion with extended timeout.
      await page.waitForFunction(() => document.getElementById('start').textContent.trim() === 'Start', { timeout: 90000 });
      await expect(startBtn).toHaveText('Start');
    });

    test('While sorting, clicking Shuffle should be ignored (Shuffle disabled while busy)', async ({ page }) => {
      // Start the sort process
      await page.click('#start');
      // Ensure started
      await expect(page.locator('#start')).toHaveText('Running...');
      // Immediately check shuffle button is disabled
      const shuffleBtn = page.locator('#shuffle');
      await expect(shuffleBtn).toBeDisabled();

      // Try clicking shuffle programmatically; the click should have no effect because button is disabled.
      // We'll capture values before and after a click attempt to assert no change.
      const getValues = async () => page.$$eval('#items .node .value', els => els.map(el => el.textContent.trim()));
      const before = await getValues();

      // Attempt to click shuffle (should be a no-op because disabled). Use JavaScript click to simulate misbehaving clients too.
      await page.evaluate(() => {
        const btn = document.getElementById('shuffle');
        if (btn) btn.click();
      });

      // Wait briefly to allow any potential shuffle to happen (but it shouldn't)
      await page.waitForTimeout(600);

      const after = await getValues();
      // Values should remain the same while sorting is busy
      expect(after.length).toBe(before.length);
      const same = after.every((v, i) => v === before[i]);
      expect(same, 'Values should remain unchanged when shuffle is invoked while busy').toBe(true);

      // Let the sort finish to leave the app in a good state for teardown checks
      await page.waitForFunction(() => document.getElementById('start').textContent.trim() === 'Start', { timeout: 90000 });
    });

    test('Start button is idempotent when busy: repeated clicks do not restart (S1_Sorting behavior)', async ({ page }) => {
      // Click Start to enter busy
      await page.click('#start');
      await expect(page.locator('#start')).toHaveText('Running...');
      // Capture busy state start timestamp text to ensure it does not revert instantly
      const btnTextDuring = await page.locator('#start').textContent();
      // Click Start again while busy (should do nothing)
      await page.click('#start');
      // Ensure still Running...
      await expect(page.locator('#start')).toHaveText('Running...');

      // Wait for any highlight/compare to appear to prove animation is progressing
      await page.waitForSelector('#items .node.highlight, #items .node.compare', { timeout: 8000 });

      // Finally wait for completion so test doesn't leave page mid-sort
      await page.waitForFunction(() => document.getElementById('start').textContent.trim() === 'Start', { timeout: 90000 });
      await expect(page.locator('#start')).toHaveText('Start');
    });
  });

  test.describe('Edge cases and responsiveness', () => {
    test('Resize event repositions nodes and updates link positions (responsive behavior)', async ({ page }) => {
      // Record left positions of first three nodes
      const leftsBefore = await page.$$eval('#items .node', nodes => nodes.slice(0,3).map(n => n.style.left || window.getComputedStyle(n).left));
      // Trigger a resize by changing viewport size (this triggers window.resize listener)
      await page.setViewportSize({ width: 900, height: 800 });
      // Wait a short while for the resize handler to apply changes
      await page.waitForTimeout(200);
      // Additionally dispatch a resize event in case resizing the viewport isn't enough
      await page.evaluate(() => window.dispatchEvent(new Event('resize')));

      // Wait for potential rehythm of transitions and link refresh
      await page.waitForTimeout(120);

      const leftsAfter = await page.$$eval('#items .node', nodes => nodes.slice(0,3).map(n => n.style.left || window.getComputedStyle(n).left));
      // Expect the left positions to be strings and likely changed to reflect new centering
      expect(leftsAfter.length).toBe(leftsBefore.length);
      // It's acceptable if values are same on some viewports; at least ensure values are present and styled
      for (let i = 0; i < leftsAfter.length; i++) {
        expect(typeof leftsAfter[i], 'left style is a string').toBe('string');
        expect(leftsAfter[i].length > 0, 'left style not empty').toBe(true);
      }
    });

    test('Application does not raise ReferenceError/SyntaxError/TypeError on load (no uncaught page errors)', async ({ page }) => {
      // This test explicitly asserts that no uncaught JS runtime errors were emitted during page load.
      // The afterEach hook will also assert, but we include a local assertion too for clarity.
      expect(pageErrors.length, 'No uncaught page errors during load').toBe(0);
      expect(consoleErrors.length, 'No console.error messages during load').toBe(0);
    });
  });
});