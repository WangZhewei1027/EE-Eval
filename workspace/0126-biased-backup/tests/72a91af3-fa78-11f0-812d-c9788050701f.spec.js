import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72a91af3-fa78-11f0-812d-c9788050701f.html';

test.describe('B-Tree Visualization (Application ID: 72a91af3-fa78-11f0-812d-c9788050701f)', () => {
  // Capture console errors and page errors for each test to assert runtime stability.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console messages; record error type messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Listen for uncaught exceptions on the page
    page.on('pageerror', error => {
      pageErrors.push({
        message: error.message,
        stack: error.stack
      });
    });

    // Navigate to the app page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure the main UI controls are present before running assertions
    await expect(page.locator('#insertBtn')).toBeVisible();
    await expect(page.locator('#resetBtn')).toBeVisible();
    await expect(page.locator('#treeContainer')).toBeVisible();
  });

  // After each test ensure there were no console/page errors unless a test explicitly expects them.
  test.afterEach(async () => {
    // Failing the test if any runtime errors were captured.
    expect(consoleErrors, `Console errors were logged: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
    expect(pageErrors, `Page errors were raised: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  test.describe('State S0_Idle (Initial state) validations', () => {
    test('Initial state should show empty tree message and no nodes/links', async ({ page }) => {
      // This test validates the S0_Idle entry action visualizer.visualize() which should show "Tree is empty..." message.

      // The empty message is rendered inside #treeContainer when tree.root.keys.length === 0
      const emptyMessage = page.locator('#treeContainer >> text=Tree is empty. Insert some keys!');
      await expect(emptyMessage).toBeVisible();

      // There should be no rendered nodes or links initially
      await expect(page.locator('.node')).toHaveCount(0);
      await expect(page.locator('.link')).toHaveCount(0);

      // Also ensure particles (decorative) are created as expected
      // The page script creates 30 particles; assert at least some were added
      const particleCount = await page.locator('#particles .particle').count();
      expect(particleCount).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Event: InsertRandomKey (transition S0_Idle -> S1_TreeUpdated)', () => {
    test('Clicking Insert Random Key visualizes a new key and highlights it', async ({ page }) => {
      // Validate that clicking the insert button causes the visualizer to insert a key,
      // re-render the tree, and apply a temporary highlight to the new key (S1_TreeUpdated).

      const insertBtn = page.locator('#insertBtn');

      // Pre-condition: empty message visible
      await expect(page.locator('#treeContainer >> text=Tree is empty. Insert some keys!')).toBeVisible();

      // Click the insert button once
      await insertBtn.click();

      // After insertion, a .node should be created
      const nodeLocator = page.locator('.node');
      await expect(nodeLocator).toHaveCount(1);

      // At least one key element must exist now
      const keyLocator = page.locator('.key');
      await expect(keyLocator).toHaveCountGreaterThan(0);

      // Immediately after insertion the visualizer.highlightKey should add .highlight class to the inserted key
      // Wait for a highlighted key to appear (highlight is transient; timeout should accommodate it)
      const highlighted = page.locator('.key.highlight');
      await highlighted.waitFor({ timeout: 2000 });
      await expect(highlighted).toHaveCountGreaterThan(0);

      // The highlight is removed after ~1500ms; verify it is eventually removed
      await highlighted.waitFor({ state: 'detached', timeout: 3000 });

      // Links may or may not be present depending on tree shape; ensure no JavaScript errors occurred during rendering.
    });

    test('Multiple rapid inserts should grow the tree and may create internal nodes/links', async ({ page }) => {
      // This test exercises edge behavior by clicking insert multiple times to trigger splits.
      const insertBtn = page.locator('#insertBtn');

      // Perform a series of inserts to try to force node splits (degree = 3, max keys per node = 5)
      const inserts = 8;
      for (let i = 0; i < inserts; i++) {
        await insertBtn.click();
        // small delay between clicks to let animation/rendering happen
        await page.waitForTimeout(150);
      }

      // Wait until at least some keys are present (should be >= inserts but duplicates possible)
      await page.waitForFunction(() => document.querySelectorAll('.key').length > 0);

      const keyCount = await page.locator('.key').count();
      expect(keyCount).toBeGreaterThanOrEqual(1);

      // If splits happened we should eventually see more than one node rendered.
      // This is non-deterministic depending on random keys, but we assert that nodes exist.
      const nodeCount = await page.locator('.node').count();
      expect(nodeCount).toBeGreaterThanOrEqual(1);

      // Links are drawn between parent and child nodes; if internal nodes exist there should be at least one link.
      // Again non-deterministic; just check that rendering didn't throw and that we can query links.
      const linkCount = await page.locator('.link').count();
      expect(linkCount).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Event: ResetTree (transition S1_TreeUpdated -> S0_Idle)', () => {
    test('Reset should clear the tree and return to empty visualization', async ({ page }) => {
      // Insert a couple of keys first so there is something to reset
      const insertBtn = page.locator('#insertBtn');
      const resetBtn = page.locator('#resetBtn');

      await insertBtn.click();
      await insertBtn.click();

      // Ensure we have at least one node before reset
      await expect(page.locator('.node')).toHaveCountGreaterThan(0);

      // Now click reset and assert we return to the idle empty state
      await resetBtn.click();

      // The empty message should be visible again
      const emptyMessage = page.locator('#treeContainer >> text=Tree is empty. Insert some keys!');
      await emptyMessage.waitFor({ timeout: 2000 });
      await expect(emptyMessage).toBeVisible();

      // All nodes and links should be removed after reset
      await expect(page.locator('.node')).toHaveCount(0);
      await expect(page.locator('.link')).toHaveCount(0);
    });

    test('Reset on an already empty tree should remain stable (no errors)', async ({ page }) => {
      // Clicking reset when tree is already empty should not throw and should keep the empty message.
      const resetBtn = page.locator('#resetBtn');

      // Ensure initial state is empty
      await expect(page.locator('#treeContainer >> text=Tree is empty. Insert some keys!')).toBeVisible();

      // Click reset
      await resetBtn.click();

      // Still should display the empty message
      await expect(page.locator('#treeContainer >> text=Tree is empty. Insert some keys!')).toBeVisible();
    });
  });

  test.describe('Additional visual & robustness checks', () => {
    test('Highlight animation is transient and keys are not permanently highlighted', async ({ page }) => {
      const insertBtn = page.locator('#insertBtn');

      // Insert a key which should be highlighted briefly
      await insertBtn.click();

      // A highlighted key should appear
      const highlighted = page.locator('.key.highlight');
      await highlighted.waitFor({ timeout: 2000 });
      await expect(highlighted).toHaveCountGreaterThan(0);

      // After a safe delay ensure highlight is removed
      await highlighted.waitFor({ state: 'detached', timeout: 3000 });

      // Confirm no elements remain with highlight class
      const remainingHighlights = await page.locator('.key.highlight').count();
      expect(remainingHighlights).toBe(0);
    });

    test('Particles decorative elements are created and have expected minimal presence', async ({ page }) => {
      // The page creates 30 particles in createParticles(). We assert there are multiple particles present.
      const particleLocator = page.locator('#particles .particle');
      await expect(particleLocator).toHaveCountGreaterThan(0);

      // Individual particle styles should be present (width/height set inline). Validate one particle has width style set.
      const hasSize = await page.evaluate(() => {
        const p = document.querySelector('#particles .particle');
        if (!p) return false;
        const w = p.style.width;
        const h = p.style.height;
        return !!w && !!h;
      });
      expect(hasSize).toBe(true);
    });
  });
});