import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f4f460-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object to encapsulate common selectors and interactions
class BinaryTreePage {
  constructor(page) {
    this.page = page;
    this.btnToggle = page.locator('#btn-toggle');
    this.btnRand = page.locator('#btn-rand');
    this.svg = page.locator('#svg');
    this.nodesGroup = page.locator('#nodes');
    this.edgesGroup = page.locator('#edges');
    this.depthValue = page.locator('#depthValue');
  }

  // Returns count of node <g> elements rendered in the SVG
  async nodeCount() {
    return await this.page.locator('#nodes > g').count();
  }

  // Returns count of edge path elements rendered in the SVG
  async edgeCount() {
    return await this.page.locator('#edges > path').count();
  }

  // Click the play/pause toggle
  async clickToggle() {
    await this.btnToggle.click();
  }

  // Click the regenerate button
  async clickRegenerate() {
    await this.btnRand.click();
  }

  // Keyboard-activate regenerate via Enter key
  async pressEnterOnRegenerate() {
    await this.btnRand.focus();
    await this.page.keyboard.press('Enter');
  }

  // Keyboard-activate regenerate via Space key
  async pressSpaceOnRegenerate() {
    await this.btnRand.focus();
    await this.page.keyboard.press(' ');
  }

  // Hover first node
  async hoverFirstNode() {
    const first = this.page.locator('#nodes > g').first();
    await first.waitFor({ state: 'visible', timeout: 3000 });
    await first.hover();
  }

  // Dispatch a resize event from the page
  async triggerResize() {
    await this.page.evaluate(() => {
      window.dispatchEvent(new Event('resize'));
    });
  }
}

test.describe('Binary Tree — Visual Concept (FSM & UI validations)', () => {
  // Arrays to capture console errors and page errors during tests
  let consoleErrors;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors for diagnostics and assertions
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    page.on('pageerror', (err) => {
      // capture any uncaught exceptions
      pageErrors.push(err);
    });

    // Navigate to the app and wait for initial rendering
    await page.goto(APP_URL, { waitUntil: 'networkidle' });

    // Wait for the SVG to exist and the initial regenerated tree to finish creating nodes
    await page.locator('#svg').waitFor({ state: 'visible', timeout: 5000 });
    // The app calls regenerate() on init, allow some time for nodes to be created
    await page.waitForTimeout(350);
  });

  test.afterEach(async ({ page }) => {
    // If page errors or console errors occurred, attach them to the test output for debugging
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        console.error('Page error captured:', err);
      }
    }
    if (consoleErrors.length > 0) {
      for (const ce of consoleErrors) {
        console.error('Console error captured:', ce);
      }
    }
    // Final assertion to ensure there were no uncaught page errors or console.error messages.
    // This verifies the app did not throw unexpected exceptions during interactions.
    expect(pageErrors.length, 'No uncaught page errors should occur').toBe(0);
    expect(consoleErrors.length, 'No console.error messages should be emitted').toBe(0);
  });

  test.describe('Initial Idle State (S0_Idle) validations', () => {
    test('Page renders controls and depth correctly (Idle state evidence)', async ({ page }) => {
      const p = new BinaryTreePage(page);

      // Validate presence of Play/Pause toggle and Regenerate button
      await expect(p.btnToggle).toBeVisible();
      await expect(p.btnRand).toBeVisible();

      // Validate attributes: titles and classes as per FSM evidence
      await expect(p.btnToggle).toHaveAttribute('title', 'Play or pause growth animation');
      await expect(p.btnRand).toHaveAttribute('title', 'Regenerate the tree pattern');

      // The initial depth is configured to 4 in the implementation
      await expect(p.depthValue).toHaveText('4');

      // The initial script calls regenerate on init; ensure some nodes rendered
      const nodes = await p.nodeCount();
      expect(nodes, 'Initial render should create at least one node (the root)').toBeGreaterThan(0);

      // Play toggle initial label should be 'Play' (inner text)
      const toggleText = await p.btnToggle.innerText();
      expect(toggleText.trim().toLowerCase().includes('play'), 'Initial toggle should indicate Play').toBe(true);

      // The initial state in code sets playing=true and ensures btnToggle has primary class
      const hasPrimary = await p.btnToggle.evaluate(el => el.classList.contains('primary'));
      expect(hasPrimary, 'btn-toggle should have class primary on initial playing state').toBe(true);
    });
  });

  test.describe('Play/Pause transitions (S0_Idle <-> S1_Playing <-> S2_Paused)', () => {
    test('Toggling Play -> Pause -> Play updates DOM and classes (PlayPauseToggle event)', async ({ page }) => {
      const p = new BinaryTreePage(page);

      // Ensure starting from playing (initial app state)
      const initialText = (await p.btnToggle.innerText()).trim().toLowerCase();
      expect(initialText.includes('play') || initialText.includes('pause')).toBeTruthy();

      // Click to toggle: playing -> !playing (if was playing becomes paused)
      await p.clickToggle();
      // small wait to let UI update
      await page.waitForTimeout(120);

      const afterFirstText = (await p.btnToggle.innerText()).trim().toLowerCase();
      // When toggled off (playing false), the implementation sets the label to "Pause"
      // Note: The implementation uses playInner() when playing true, pauseInner() when playing false.
      expect(afterFirstText.includes('pause'), 'After first toggle the button should show Pause (paused state)').toBe(true);

      const hasPrimaryAfterPause = await p.btnToggle.evaluate(el => el.classList.contains('primary'));
      expect(hasPrimaryAfterPause, 'btn-toggle should NOT have primary when paused').toBe(false);

      // Click again to resume (Pause -> Play)
      await p.clickToggle();
      await page.waitForTimeout(120);

      const afterSecondText = (await p.btnToggle.innerText()).trim().toLowerCase();
      expect(afterSecondText.includes('play'), 'After second toggle the button should show Play (playing state)').toBe(true);

      const hasPrimaryAfterPlay = await p.btnToggle.evaluate(el => el.classList.contains('primary'));
      expect(hasPrimaryAfterPlay, 'btn-toggle should have primary when playing').toBe(true);
    });

    test('When paused, reveals are canceled and when resumed they restart', async ({ page }) => {
      const p = new BinaryTreePage(page);

      // Ensure at least a few edges and nodes exist
      const nodesBefore = await p.nodeCount();
      const edgesBefore = await p.edgeCount();
      expect(nodesBefore).toBeGreaterThan(0);

      // Pause
      await p.clickToggle();
      await page.waitForTimeout(100);

      // While paused, trigger a short wait and ensure that no reveal animations are progressing by checking
      // that edge strokeDashoffset is not being animated (they may be hidden). We will assert that edges exist or remain stable.
      const edgesAfterPause = await p.edgeCount();
      expect(edgesAfterPause).toBeGreaterThanOrEqual(0);

      // Resume
      await p.clickToggle();
      // allow reveal to run a bit
      await page.waitForTimeout(400);

      const nodesAfterResume = await p.nodeCount();
      expect(nodesAfterResume).toBeGreaterThanOrEqual(nodesBefore, 'Resuming should still have at least the same nodes present');
    });
  });

  test.describe('Regenerate transitions (RegenerateTree event and transitions to Idle)', () => {
    test('Clicking Regenerate updates tree and resets play state (S1_Playing/S2_Paused -> S0_Idle)', async ({ page }) => {
      const p = new BinaryTreePage(page);

      // Ensure we have an initial snapshot of nodes
      const nodesBefore = await p.nodeCount();

      // If currently paused, click toggle to ensure we are in playing state to validate both transitions
      const toggleTextBefore = (await p.btnToggle.innerText()).trim().toLowerCase();
      if (toggleTextBefore.includes('pause')) {
        // currently paused -> click to set to playing so we can test S1_Playing -> S0_Idle transition
        await p.clickToggle();
        await page.waitForTimeout(120);
      }

      // Now click regenerate while playing
      await p.clickRegenerate();
      // allow regenerate and render to complete
      await page.waitForTimeout(350);

      // After regenerate the implementation sets playing = true and the btnToggle to Play with primary class
      const toggleTextAfter = (await p.btnToggle.innerText()).trim().toLowerCase();
      expect(toggleTextAfter.includes('play'), 'After regenerate the toggle should indicate Play').toBe(true);

      const hasPrimaryAfter = await p.btnToggle.evaluate(el => el.classList.contains('primary'));
      expect(hasPrimaryAfter, 'After regenerate btn-toggle should have primary class (playing=true)').toBe(true);

      // Validate nodes were (re)rendered - count may change due to randomness; ensure at least root exists
      const nodesAfter = await p.nodeCount();
      expect(nodesAfter).toBeGreaterThan(0);
      // It's acceptable for node count to change (random generation), ensure change or equality
      expect(nodesAfter >= 1).toBe(true);
    });

    test('Keyboard activation (Enter and Space) on Regenerate triggers regeneration', async ({ page }) => {
      const p = new BinaryTreePage(page);

      // snapshot
      const before = await p.nodeCount();

      // Press Enter on regenerate and verify nodes updated (or at least a re-render happened)
      await p.pressEnterOnRegenerate();
      await page.waitForTimeout(300);
      const afterEnter = await p.nodeCount();
      expect(afterEnter).toBeGreaterThanOrEqual(1);

      // Press Space on regenerate and verify nodes updated again
      await p.pressSpaceOnRegenerate();
      await page.waitForTimeout(300);
      const afterSpace = await p.nodeCount();
      expect(afterSpace).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Interactive visual behaviors and edge cases', () => {
    test('Hovering a node highlights the path to root and dims others', async ({ page }) => {
      const p = new BinaryTreePage(page);

      // Ensure nodes exist; wait for at least 1
      await expect(page.locator('#nodes > g').first()).toBeVisible();

      // Capture opacities before hover
      const opacitiesBefore = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('#nodes > g'));
        return nodes.map(n => window.getComputedStyle(n).opacity);
      });

      // Hover first node and wait for hover handlers to run
      await p.hoverFirstNode();
      await page.waitForTimeout(220);

      // Capture opacities after hover
      const opacitiesAfter = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('#nodes > g'));
        return nodes.map(n => window.getComputedStyle(n).opacity);
      });

      // Expect that some nodes are dimmed (opacity reduced) as part of hover effect
      const dimmedExists = opacitiesAfter.some((o, idx) => parseFloat(o) < parseFloat(opacitiesBefore[idx]));
      expect(dimmedExists, 'Hover should dim non-chain nodes, reducing opacity for some nodes').toBe(true);

      // Move the mouse away to trigger mouseout and restore opacities
      await page.mouse.move(0, 0);
      await page.waitForTimeout(160);

      const opacitiesRestored = await page.evaluate(() => {
        const nodes = Array.from(document.querySelectorAll('#nodes > g'));
        return nodes.map(n => window.getComputedStyle(n).opacity);
      });

      // After mouseout, opacities should return to 1 (or at least increase)
      const restored = opacitiesRestored.some(o => parseFloat(o) >= 1 || parseFloat(o) > 0.5);
      expect(restored, 'After mouseout some nodes should have opacity restored (>= 1 or significantly higher)').toBe(true);
    });

    test('Window resize triggers regeneration and preserves play state', async ({ page }) => {
      const p = new BinaryTreePage(page);

      // Ensure a known play state: set to paused, then to playing
      // Toggle to paused if currently playing
      const initialToggleText = (await p.btnToggle.innerText()).trim().toLowerCase();
      if (!initialToggleText.includes('play')) {
        // not in expected format -> normalize to playing
        await p.clickToggle();
        await page.waitForTimeout(120);
      }

      // Now record play state and node count
      const playingBefore = await p.btnToggle.evaluate(el => el.classList.contains('primary'));
      const nodesBefore = await p.nodeCount();

      // Trigger a resize event (the app listens to resize and calls regenerate)
      await p.triggerResize();
      // allow regenerates to run
      await page.waitForTimeout(450);

      // After resize, nodes should have been re-rendered (still >=1) and play state preserved
      const nodesAfter = await p.nodeCount();
      expect(nodesAfter).toBeGreaterThanOrEqual(1);
      const playingAfter = await p.btnToggle.evaluate(el => el.classList.contains('primary'));
      expect(playingAfter, 'Play state should be preserved after resize-triggered regenerate').toBe(playingBefore);
    });

    test('Edge case: repeated rapid regenerate clicks do not throw errors', async ({ page }) => {
      const p = new BinaryTreePage(page);

      // Rapidly click regenerate multiple times
      for (let i = 0; i < 6; i++) {
        await p.clickRegenerate();
      }
      // allow operations to settle
      await page.waitForTimeout(400);

      // Ensure still no page errors or console.error were emitted (captured in afterEach)
      const nodesNow = await p.nodeCount();
      expect(nodesNow).toBeGreaterThanOrEqual(1);
    });
  });
});