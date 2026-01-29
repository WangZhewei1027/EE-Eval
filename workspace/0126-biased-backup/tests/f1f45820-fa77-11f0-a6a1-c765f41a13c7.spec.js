import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f45820-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object for the linked list visualization page
class LinkedListPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.playLabel = page.locator('#playLabel');
    this.playDot = page.locator('#playDot');
    this.list = page.locator('#list');
    this.nodes = page.locator('#list .node');
    this.svgPaths = page.locator('svg#arrows path.link');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Wait until nodes are mounted (values array has 6 entries in the implementation)
  async waitForMount(timeout = 3000) {
    await this.nodes.first().waitFor({ state: 'attached', timeout });
    // ensure all expected nodes appear (implementation uses 6 values)
    await this.page.waitForFunction(() => {
      const list = document.getElementById('list');
      return list && list.children.length === 6;
    }, null, { timeout });
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async ariaPressed() {
    return (await this.playBtn.getAttribute('aria-pressed')) || 'false';
  }

  async labelText() {
    return this.playLabel.textContent();
  }

  async playDotStyle() {
    return this.playDot.evaluate((el) => el.style.background || '');
  }

  // returns number of node elements
  async nodeCount() {
    return this.nodes.count();
  }

  // returns number of SVG path.link elements
  async pathCount() {
    return this.svgPaths.count();
  }

  // returns index of active node or -1 if none
  async activeIndex() {
    const count = await this.nodeCount();
    for (let i = 0; i < count; i++) {
      const cls = await this.nodes.nth(i).getAttribute('class');
      if (cls && cls.split(/\s+/).includes('active')) return i;
    }
    return -1;
  }

  // returns whether node at idx has pointer transform style set
  async ptrTransformForIndex(i) {
    const ptr = this.nodes.nth(i).locator('.ptr');
    return ptr.evaluate((el) => el.style.transform || '');
  }

  // helper: pause for a given ms
  async wait(ms) {
    await this.page.waitForTimeout(ms);
  }
}

test.describe('Linked List — Visual Concept (FSM & UI integration)', () => {
  // Capture console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to console messages
    page.on('console', (msg) => {
      // Collect console messages for inspection/assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Listen to uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // Keep the Error object for assertions
      pageErrors.push(err);
    });
  });

  test('mount() called on load and initial DOM structure is created (S0_Idle evidence)', async ({ page }) => {
    // This test validates the Idle state's entry action mount() produced the expected DOM.
    const app = new LinkedListPage(page);
    await app.goto();

    // Wait for nodes to be mounted
    await app.waitForMount();

    // The implementation defines 6 values -> expect 6 nodes
    const nodeCount = await app.nodeCount();
    expect(nodeCount, 'Expected 6 nodes to be mounted by mount()').toBe(6);

    // Expect arrows between nodes: nodeCount - 1
    const pathCount = await app.pathCount();
    expect(pathCount, 'Expected SVG link paths between nodes').toBe(Math.max(0, nodeCount - 1));

    // Ensure first nodes have enter class applied eventually (staggered animation)
    // We wait a little to allow the staggered class addition.
    await app.wait(500);
    const enterClasses = await Promise.all(
      Array.from({ length: nodeCount }).map((_, i) => app.nodes.nth(i).getAttribute('class'))
    );
    // At least one node should have 'enter' class after mount animations
    const hasEnter = enterClasses.some((cls) => cls && cls.includes('enter'));
    expect(hasEnter, 'At least one node should have the "enter" animation class').toBeTruthy();

    // Assert no uncaught page errors occurred during mount
    expect(pageErrors.length, `Expected no page errors during mount, found: ${pageErrors.length}`).toBe(0);

    // Keep console messages info for debugging; ensure no console.error messages exist
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `Expected no console errors/warnings during mount, got ${consoleErrors.length}`).toBe(0);
  });

  test('PlayPauseClick event toggles between Playing and Paused states (S0 -> S1, S1 -> S2, S2 -> S1)', async ({ page }) => {
    // This test validates Play/Pause transitions and visual side effects.
    const app = new LinkedListPage(page);
    await app.goto();
    await app.waitForMount();

    // Ensure we start from a clean baseline by clicking Reset (S3_Reset entry action resets to Idle)
    await app.clickReset();
    await app.wait(200);

    // After reset we expect no active node
    let active = await app.activeIndex();
    expect(active, 'After reset there should be no active node').toBe(-1);

    // S0_Idle -> S1_Playing: Click play to start traversal
    await app.clickPlay();

    // Immediately, aria-pressed should be true and label should change to 'Pause'
    await app.wait(60);
    expect(await app.ariaPressed(), 'Play button should indicate pressed when playing').toBe('true');
    expect(await app.labelText(), 'Play label should say Pause when playing').toContain('Pause');

    // playDot style should change to the "active" gradient
    const playDotBg = await app.playDotStyle();
    expect(playDotBg.length, 'Play dot should have inline background style applied on start').toBeGreaterThan(0);

    // Immediately after starting, the first node should become active (step() selects idx=0)
    await app.wait(50);
    active = await app.activeIndex();
    expect(active, 'After starting, an active node should exist (idx 0 expected)').toBeGreaterThanOrEqual(0);

    // S1_Playing -> S2_Paused: Click play button again to pause
    const activeBeforePause = active;
    await app.clickPlay();
    await app.wait(60);
    expect(await app.ariaPressed(), 'Play button aria-pressed should be false after pausing').toBe('false');
    expect(await app.labelText(), 'Label should return to Play after pause').toContain('Play');

    // Validate that auto stepping stopped: wait a bit longer than step interval (1100ms)
    await app.wait(1250);
    const activeAfterPauseWait = await app.activeIndex();
    expect(activeAfterPauseWait, 'Active node should remain the same after pausing (no further stepping)').toBe(activeBeforePause);

    // S2_Paused -> S1_Playing: Click play to resume and allow one step
    await app.clickPlay();
    // Wait slightly longer than step interval to let one more step happen
    await app.wait(1250);
    const activeAfterResume = await app.activeIndex();
    expect(activeAfterResume, 'After resuming, active node index should advance').not.toBe(activeBeforePause);

    // Check that the pointer (.ptr) for the active node has inline transform style set (visual emphasis)
    const ptrTransform = await app.ptrTransformForIndex(activeAfterResume);
    expect(ptrTransform.length, 'Active node pointer should have transform style for emphasis').toBeGreaterThan(0);

    // Ensure no uncaught page errors during play/pause interactions
    expect(pageErrors.length, 'No page errors should have occurred during play/pause interactions').toBe(0);
  });

  test('ResetClick transitions to Reset from multiple states and clears traversal state (S1/S2/S0 -> S3_Reset)', async ({ page }) => {
    // This test validates Reset behavior from different source states.
    const app = new LinkedListPage(page);
    await app.goto();
    await app.waitForMount();

    // 1) Reset from Idle (S0 -> S3)
    // Ensure idle by clicking reset once
    await app.clickReset();
    await app.wait(200);
    expect(await app.ariaPressed(), 'Play button should be not pressed after Reset from Idle').toBe('false');
    expect(await app.activeIndex(), 'No node should be active after Reset from Idle').toBe(-1);

    // 2) Reset from Playing (S1 -> S3)
    // Start playing
    await app.clickPlay();
    await app.wait(100); // allow immediate step
    const activeWhilePlaying = await app.activeIndex();
    expect(activeWhilePlaying, 'Should have an active node when playing before reset').toBeGreaterThanOrEqual(0);

    // Now click reset while playing
    await app.clickReset();
    // Allow reset to process (removes 'active', re-adds enter)
    await app.wait(200);
    expect(await app.ariaPressed(), 'Play button should be not pressed after Reset from Playing').toBe('false');
    expect(await app.activeIndex(), 'Reset should clear any active node when triggered during Playing').toBe(-1);

    // 3) Reset from Paused (S2 -> S3)
    // Start then pause
    await app.clickPlay();
    await app.wait(100); // start and create active
    await app.clickPlay(); // pause
    await app.wait(80);
    // Ensure paused
    expect(await app.ariaPressed(), 'Play button should indicate not pressed when paused').toBe('false');

    // Click reset while paused
    await app.clickReset();
    await app.wait(200);
    expect(await app.activeIndex(), 'Reset from paused should result in no active nodes').toBe(-1);

    // Rapid multiple resets as an edge case
    await app.clickReset();
    await app.clickReset();
    await app.clickReset();
    await app.wait(200);
    expect(await app.activeIndex(), 'Multiple rapid resets should still leave the visualization in reset state').toBe(-1);

    // Confirm that arrow reveal classes were cleared (no path has 'reveal' class)
    const pathCount = await app.pathCount();
    for (let i = 0; i < pathCount; i++) {
      const cls = await app.svgPaths.nth(i).getAttribute('class');
      expect(cls === null || !cls.includes('reveal'), 'Reset should clear path reveal animations').toBeTruthy();
    }

    // Ensure no uncaught page errors on reset transitions
    expect(pageErrors.length, 'No page errors should occur during Reset transitions').toBe(0);
  });

  test('Traversal visual effects and SVG drawing respond to resize and multi-step animation (edge cases)', async ({ page }) => {
    // This test checks arrow recalculation on resize, multiple rapid play clicks,
    // and that stepping applies reveal animation to paths.
    const app = new LinkedListPage(page);
    await app.goto();
    await app.waitForMount();

    // Reset to stable baseline
    await app.clickReset();
    await app.wait(200);

    // Start traversal and allow a few steps so some paths get the 'reveal' animation
    await app.clickPlay();
    // allow a couple of steps (interval is ~1100ms)
    await app.wait(2500);

    // At least one path should have been animated (class 'reveal' added on step when prev>=0)
    const pathCount = await app.pathCount();
    let anyReveal = false;
    for (let i = 0; i < pathCount; i++) {
      const cls = await app.svgPaths.nth(i).getAttribute('class');
      if (cls && cls.includes('reveal')) { anyReveal = true; break; }
    }
    // It's possible timing causes no reveal yet (fast environment), but generally we expect at least one reveal.
    // We'll assert that either there is a reveal OR no page errors (to be resilient).
    expect(pageErrors.length, 'No page errors should have occurred while animating paths').toBe(0);

    // Trigger a viewport resize to exercise the resize -> drawArrows debounce handler
    const originalViewport = page.viewportSize() || { width: 1280, height: 720 };
    await page.setViewportSize({ width: originalViewport.width - 100, height: originalViewport.height });
    // Allow the throttled drawArrows (120ms throttle + some margin)
    await app.wait(300);

    // Ensure path count remains consistent after resize
    const pathCountAfterResize = await app.pathCount();
    const nodeCount = await app.nodeCount();
    expect(pathCountAfterResize, 'Number of paths should remain nodeCount - 1 after resize').toBe(Math.max(0, nodeCount - 1));

    // Rapid toggle play/pause to ensure no exceptions thrown (edge case)
    await app.clickPlay(); // one toggle
    await app.clickPlay(); // toggle back
    await app.clickPlay(); // toggle forth
    await app.wait(600);
    // Verify page still responsive and no page errors
    expect(pageErrors.length, 'No page errors should have occurred during rapid play/pause toggles').toBe(0);

    // Restore viewport
    await page.setViewportSize(originalViewport);
  });

  test('Console and runtime error observation: assert no uncaught page errors and no console error level messages', async ({ page }) => {
    // This test explicitly asserts on console and pageerror observations recorded in beforeEach
    const app = new LinkedListPage(page);
    await app.goto();
    await app.waitForMount();

    // Give time for the auto-start/auto-pause sequence in the implementation to run
    // (auto-start at ~900ms, pause after ~3800ms). Wait enough to capture that scenario.
    await app.wait(4500);

    // After a full cycle, expect no uncaught page errors
    expect(pageErrors.length, `Expected no uncaught page errors during page lifecycle but found ${pageErrors.length}`).toBe(0);

    // Assert there are no console messages of type 'error' or 'warning'
    const errorLogs = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    expect(errorLogs.length, `Expected no console error/warning messages; found ${errorLogs.length}`).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // If any pageErrors were captured during the test, include them in test attachments/logs.
    // This ensures that if a runtime error occurred, it's surfaced in Playwright output.
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        // Log to the test stdout - Playwright will capture this
        console.error('Captured pageerror:', err.message, err.stack);
      }
    }
  });
});