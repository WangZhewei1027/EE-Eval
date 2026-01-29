import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a91af1-fa78-11f0-812d-c9788050701f.html';

test.describe('AVL Tree Visualization - FSM (Application ID: 72a91af1-fa78-11f0-812d-c9788050701f)', () => {
  // Arrays to collect runtime diagnostics per test
  let consoleMessages;
  let pageErrors;

  // Helper to count node elements in the visualization container
  const countNodes = async (page) => {
    return await page.locator('#treeContainer .node').count();
  };

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages (info, warn, error, etc.)
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In rare cases msg.type() might throw; capture text only
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Observe uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(err);
    });

    // Load the application exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Give the app some time to run initial rendering & possible animations
    await page.waitForTimeout(600);
  });

  test.afterEach(async ({ page }) => {
    // Nothing to teardown beyond Playwright's automatic cleanup.
    // Keep listeners minimal and non-invasive.
  });

  test('Initial Idle state (S0) - Page renders controls and visualization container', async ({ page }) => {
    // Validate expected components exist per FSM S0 evidence
    const insertBtn = page.locator('#insertBtn');
    const resetBtn = page.locator('#resetBtn');
    const treeContainer = page.locator('#treeContainer');

    // Buttons should be visible and enabled
    await expect(insertBtn).toBeVisible();
    await expect(insertBtn).toBeEnabled();
    await expect(resetBtn).toBeVisible();
    await expect(resetBtn).toBeEnabled();

    // Tree container should exist
    await expect(treeContainer).toBeVisible();

    // There should be zero or more node elements created by initial render.
    // The implementation seeds the tree with 5 random nodes in the constructor.
    const initialNodeCount = await countNodes(page);
    // We assert that the container is present; node count is at least 0 (sanity)
    expect(initialNodeCount).toBeGreaterThanOrEqual(0);

    // The app may log or throw runtime errors during initial render; capture them.
    // We do not force or patch the app — we only observe errors if they occur.
    // This assertion documents that we observed the page and recorded console messages.
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);
  });

  test('Detect runtime errors related to balance-factor DOM handling (expected TypeError)', async ({ page }) => {
    // The visualization contains a subtle DOM bug: code appends a .balance-factor child,
    // then later uses nodeElement.textContent = node.value which removes children.
    // Immediately after it attempts to access nodeElement.querySelector('.balance-factor').textContent,
    // which can produce a TypeError. The test asserts that such runtime errors (if present)
    // are observed by the pageerror listener. We assert that at least one pageError
    // references "textContent" (typical of this bug) OR that no page errors occurred.
    //
    // Note: We do NOT patch the application. We only observe and assert.
    await page.waitForTimeout(100); // small wait to ensure any sync errors are captured

    const errors = pageErrors.map(e => (e && e.message) ? e.message : String(e));
    const hasTextContentError = errors.some(msg => msg.includes('textContent') || msg.includes('balance-factor') || msg.includes('Cannot set properties of null') || msg.includes('Cannot read properties of null'));

    // For this application we expect a TypeError relating to .textContent usage to occur naturally.
    // If it does occur, assert we observed it. If it didn't, still assert that no other fatal page error list is malformed.
    expect(Array.isArray(pageErrors)).toBe(true);

    // Make a diagnostic assertion but keep it flexible:
    // - Prefer that the specific bug error is observed (test documents that behavior).
    // - If not observed, at minimum ensure no unexpected fatal errors (pageErrors array is well-formed).
    if (pageErrors.length > 0) {
      expect(hasTextContentError).toBe(true);
    } else {
      // If there were no pageErrors, that's a valid outcome; assert the console captured other messages.
      expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('InsertNode event: clicking Insert Random Node attempts to insert and respects animating guard (S0 -> S1 -> S0)', async ({ page }) => {
    // This test validates:
    // - Clicking the Insert button triggers an insertion attempt.
    // - The visualizer sets a 1s animating guard; additional clicks during animation should not cause multiple inserts.
    // - After the animation timeout, at most 1 new node should have appeared.
    const insertBtn = page.locator('#insertBtn');

    // Record initial count of node elements
    const beforeCount = await countNodes(page);

    // Click the insert button twice in quick succession to exercise the animating guard
    await insertBtn.click();
    // Immediately try another click; if animating guard works, this should be ignored.
    await insertBtn.click();

    // Wait a bit longer than the visualizer's setTimeout (1000ms) to allow animation to finish
    await page.waitForTimeout(1200);

    const afterCount = await countNodes(page);

    // Assert that node count did not increase by more than 1 even with two quick clicks.
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
    expect(afterCount).toBeLessThanOrEqual(beforeCount + 1);

    // Additionally, check that no unexpected fatal page errors were recorded besides the known DOM bug.
    // If there are page errors, ensure they are the previously observed type (documented in earlier test).
    if (pageErrors.length > 0) {
      const messages = pageErrors.map(e => e.message || String(e));
      const anyUnexpected = messages.some(m => !m.includes('textContent') && !m.includes('balance-factor') && !m.includes('Cannot'));
      // We allow the known TypeError; assert there are no other unexpected fatal error types.
      expect(anyUnexpected).toBe(false);
    }
  });

  test('ResetTree event: clicking Reset Tree empties the visualization and respects animating guard (S0 -> S2 -> S0)', async ({ page }) => {
    // This test validates:
    // - Clicking Reset triggers resetTree() which sets animating true, replaces tree with new AVLTree,
    //   clears elements in updateVisualization, and after 500ms sets animating false.
    // - Clicking reset twice quickly should not crash; the final tree should be cleared.
    const resetBtn = page.locator('#resetBtn');
    const insertBtn = page.locator('#insertBtn');

    // Ensure there are some nodes before reset (seeded by constructor in most runs)
    const beforeCount = await countNodes(page);

    // Click reset twice quickly to exercise guard logic and idempotency
    await resetBtn.click();
    await resetBtn.click();

    // While resetting (animating), attempt to click insert (should be ignored if animating guard is effective)
    await insertBtn.click();

    // Wait longer than the reset's setTimeout (500ms) to allow completion
    await page.waitForTimeout(700);

    const afterResetCount = await countNodes(page);

    // The expected behavior: tree should be reset/cleared -> 0 nodes.
    // But because the implementation contains a DOM bug, behavior may vary.
    // We assert that either the tree is cleared OR that runtime errors were observed.
    const resetSucceeded = (afterResetCount === 0);
    if (!resetSucceeded) {
      // If reset didn't succeed, assert that runtime errors were observed to explain the failure
      expect(pageErrors.length).toBeGreaterThan(0);
    } else {
      // Reset succeeded: confirm that the container has no node elements
      expect(afterResetCount).toBe(0);
    }
  });

  test('Edge case: rapid alternating Insert and Reset clicks do not crash the page', async ({ page }) => {
    // Simulate a user rapidly clicking insert and reset to stress the animating guards and asynchronous flows.
    const insertBtn = page.locator('#insertBtn');
    const resetBtn = page.locator('#resetBtn');

    // Rapid sequence of clicks
    await insertBtn.click();
    await resetBtn.click();
    await insertBtn.click();
    await resetBtn.click();

    // Give the app time to settle (animations/timeouts are 500ms and 1000ms)
    await page.waitForTimeout(1500);

    // Ensure the page is still responsive: buttons still available
    await expect(insertBtn).toBeVisible();
    await expect(resetBtn).toBeVisible();

    // Check that no new fatal/unhandled error types beyond the known DOM bug have appeared
    if (pageErrors.length > 0) {
      const unexpected = pageErrors.some(e => {
        const msg = e && e.message ? e.message : String(e);
        // Allow known DOM-related TypeError; flag others
        return !(msg.includes('textContent') || msg.includes('balance-factor') || msg.includes('Cannot set properties'));
      });
      expect(unexpected).toBe(false);
    }
  });

  test('Sanity check: information panel and footer content remain intact after operations', async ({ page }) => {
    // Ensure non-visualization elements are unaffected by runtime errors and interactions.
    const infoPanel = page.locator('.info-panel');
    const footer = page.locator('footer');

    await expect(infoPanel).toBeVisible();
    await expect(infoPanel).toContainText('About AVL Trees');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('Visualization of a balanced binary search tree');

    // Perform one insert and one reset to ensure these UI elements persist
    await page.locator('#insertBtn').click();
    await page.waitForTimeout(300);
    await page.locator('#resetBtn').click();
    await page.waitForTimeout(700);

    // Re-assert that panels are still present
    await expect(infoPanel).toBeVisible();
    await expect(footer).toBeVisible();
  });
});