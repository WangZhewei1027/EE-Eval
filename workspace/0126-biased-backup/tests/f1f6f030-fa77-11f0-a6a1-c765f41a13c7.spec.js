import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f6f030-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object for the demo to encapsulate common interactions and queries
class DemoPage {
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.stepLabel = page.locator('#stepLabel');
    this.visitedCount = page.locator('#visitedCount');
    this.incumbent = page.locator('#incumbent');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Let the small intro pulse (window.load adds a transient active class for ~900ms).
    // We wait slightly longer to avoid flakiness when asserting initial Idle state.
    await this.page.waitForLoadState('load');
    await this.page.waitForTimeout(1100);
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async pressSpace() {
    // send a keydown that the app listens for
    await this.page.keyboard.press('Space');
  }

  async pressR() {
    await this.page.keyboard.press('r');
  }

  async getPlayButtonTextTrimmed() {
    const txt = await this.playBtn.textContent();
    return (txt || '').trim();
  }

  async getStepLabelText() {
    return (await this.stepLabel.textContent())?.trim();
  }

  async getVisitedCountText() {
    return (await this.visitedCount.textContent())?.trim();
  }

  async getIncumbentText() {
    return (await this.incumbent.textContent())?.trim();
  }

  // helper to check class presence on an element by selector
  async hasClass(selector, className) {
    return await this.page.locator(selector).evaluate((el, cls) => el.classList.contains(cls), className);
  }

  // helper to ensure certain nodes are free of known state classes
  async nodeHasAnyStateClass(selector) {
    return await this.page.locator(selector).evaluate((el) => {
      const states = ['active', 'explored', 'pruned', 'best'];
      return states.some(s => el.classList.contains(s));
    });
  }
}

// Collect console errors and page errors during tests
let consoleErrors;
let pageErrors;

test.describe('Branch & Bound — Visual Demo (f1f6f030-fa77-11f0-a6a1-c765f41a13c7)', () => {
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    const demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // Assert that no unexpected runtime errors were emitted to the console or as page errors.
    // This ensures the application runs without uncaught exceptions during the interactions we exercise.
    expect(pageErrors, 'no uncaught page errors').toEqual([]);
    expect(consoleErrors, 'no console errors').toEqual([]);
  });

  test('Initial Idle state is correct on load', async ({ page }) => {
    // Validate Idle state: step label, play button text, visited/incumbent default values
    // This test ensures the "S0_Idle" state evidence is visible on the DOM.
    const demo = new DemoPage(page);

    await expect(demo.stepLabel).toHaveText('Idle');
    const playText = await demo.getPlayButtonTextTrimmed();
    expect(playText).toContain('▶ Play');

    await expect(demo.visitedCount).toHaveText('0');
    await expect(demo.incumbent).toHaveText('—');

    // Ensure no node is incorrectly in a final state right after the initial intro pulse has finished
    const anyStateOnRoot = await demo.nodeHasAnyStateClass('#node-root');
    // root might have had a transient active class during intro; after waiting in goto it should not.
    expect(anyStateOnRoot).toBe(false);
  });

  test('PlayPause button toggles Running state and pause works (Idle -> Running -> Idle)', async ({ page }) => {
    // This validates the PlayPause event and the S0_Idle -> S1_Running transition evidence.
    const demo = new DemoPage(page);

    // Click Play to start running.
    await demo.clickPlay();

    // The start() entry action should immediately set playBtn inner text to '⏸ Pause' and run the first step label.
    await expect.poll(async () => await demo.getPlayButtonTextTrimmed(), {
      message: 'play button should show pause'
    }).toMatch(/⏸|Pause/);

    // First step runs immediately (runStep called in scheduleNext), so stepLabel should update.
    await expect.poll(async () => await demo.getStepLabelText(), {
      timeout: 3000
    }).toBe('Start at root');

    // The root node should have acquired the 'active' class as part of the first highlight.
    const rootActive = await demo.hasClass('#node-root', 'active');
    expect(rootActive).toBe(true);

    // Now click Play again to pause - should revert to Idle-esque Play button text.
    await demo.clickPlay();
    await expect.poll(async () => await demo.getPlayButtonTextTrimmed(), {
      timeout: 2000
    }).toBe('▶ Play');
  });

  test('Keyboard Space toggles play/pause (KeySpace event)', async ({ page }) => {
    // Validate that space key toggles playback via the window.keydown listener.
    const demo = new DemoPage(page);

    // Use Space key to start
    await demo.pressSpace();

    await expect.poll(async () => await demo.getPlayButtonTextTrimmed(), {
      timeout: 3000
    }).toMatch(/⏸|Pause/);

    // Use Space key again to pause
    await demo.pressSpace();
    await expect.poll(async () => await demo.getPlayButtonTextTrimmed(), {
      timeout: 2000
    }).toBe('▶ Play');
  });

  test('Run demo to completion updates incumbent, visited count, prunes left subtree and finalizes best (S1_Running -> S2_Complete transition)', async ({ page }) => {
    // This test runs the demo to completion (may take several seconds) and verifies observable outcomes:
    // - final step label becomes 'Complete'
    // - incumbent updated to 75 (best leaf B1)
    // - visited count equals 2 (B1 and B2)
    // - left subtree nodes are pruned (a1, a2, left)
    // - best node (b1) has class 'best'
    const demo = new DemoPage(page);

    // Start the demo
    await demo.clickPlay();

    // Wait until the demo signals completion. The implementation sets stepLabel to 'Complete' once finished.
    await expect(demo.stepLabel).toHaveText('Complete', { timeout: 45000 }); // generous timeout to allow full animation run

    // After completion, the play button should be back to Play
    const finalPlayText = await demo.getPlayButtonTextTrimmed();
    expect(finalPlayText).toBe('▶ Play');

    // Incumbent should have been updated to 75 (from visitLeaf on b1)
    await expect(demo.incumbent).toHaveText('75');

    // Visited count should reflect two leaf evaluations (b1 and b2)
    await expect(demo.visitedCount).toHaveText('2');

    // Verify pruning: left subtree nodes (a1, a2, left) should have 'pruned' class
    const leftPruned = await demo.hasClass('#node-left', 'pruned');
    const a1Pruned = await demo.hasClass('#node-left-left', 'pruned');
    const a2Pruned = await demo.hasClass('#node-left-right', 'pruned');
    expect(leftPruned).toBe(true);
    expect(a1Pruned).toBe(true);
    expect(a2Pruned).toBe(true);

    // Verify best node B1 has 'best' class applied
    const b1Best = await demo.hasClass('#node-right-left', 'best');
    expect(b1Best).toBe(true);
  }, 60000); // allow up to 60s for this long-running test

  test('Reset button restarts the demo and returns to Idle (Restart event)', async ({ page }) => {
    // Validate that clicking Restart resets visuals and brings the FSM back to S0_Idle.
    const demo = new DemoPage(page);

    // Run to completion first (rely on previous logic) to get into a non-idle state (or at least animate some state changes)
    await demo.clickPlay();
    await expect(demo.stepLabel).toHaveText('Complete', { timeout: 45000 });

    // Now click Reset to restart
    await demo.clickReset();

    // After reset, step label should be Idle, visited and incumbent reset, play button shows Play
    await expect(demo.stepLabel).toHaveText('Idle');
    await expect(demo.visitedCount).toHaveText('0');
    await expect(demo.incumbent).toHaveText('—');
    await expect.poll(async () => await demo.getPlayButtonTextTrimmed(), {
      timeout: 2000
    }).toBe('▶ Play');

    // Ensure nodes no longer have best/pruned/explored classes
    const nodes = ['#node-root','#node-left','#node-right','#node-right-left','#node-right-right','#node-left-left','#node-left-right'];
    for (const sel of nodes) {
      const hasState = await demo.nodeHasAnyStateClass(sel);
      expect(hasState).toBe(false);
    }
  }, 60000);

  test('Pressing "r" key triggers Restart (KeyR event) even while running', async ({ page }) => {
    // Validate keyboard 'r' triggers resetBtn.click() and that reset interrupts running demo.
    const demo = new DemoPage(page);

    // Start running
    await demo.clickPlay();

    // Wait for the first step to start
    await expect.poll(async () => await demo.getStepLabelText(), {
      timeout: 3000
    }).toBe('Start at root');

    // Press 'r' to reset while running
    await demo.pressR();

    // After reset via keyboard, the UI should be returned to Idle and visited/incumbent reset
    await expect(demo.stepLabel).toHaveText('Idle');
    await expect(demo.visitedCount).toHaveText('0');
    await expect(demo.incumbent).toHaveText('—');

    // Play button should show Play
    await expect.poll(async () => await demo.getPlayButtonTextTrimmed(), {
      timeout: 2000
    }).toBe('▶ Play');
  });

  test('Edge case: clicking Reset while running pauses and resets (Restart from Running)', async ({ page }) => {
    // Verify the reset handler properly pauses the run and resets visuals.
    const demo = new DemoPage(page);

    // Start demo
    await demo.clickPlay();
    await expect.poll(async () => await demo.getStepLabelText(), { timeout: 3000 }).toBe('Start at root');

    // Click Reset while in Running state
    await demo.clickReset();

    // Reset should have paused (play button '▶ Play') and cleared state
    await expect(demo.stepLabel).toHaveText('Idle');
    await expect(demo.visitedCount).toHaveText('0');
    await expect(demo.incumbent).toHaveText('—');
    await expect(demo.playBtn).toHaveText(/\u25B6 Play/); // ▶ Play
  });

  test('Observability: no console errors or uncaught exceptions during typical interactions', async ({ page }) => {
    // This test exercises common interactions and asserts no runtime errors are emitted.
    // It is intentionally separate to group error-observation assertions together.
    const demo = new DemoPage(page);

    // Perform a sequence of interactions
    await demo.clickPlay();
    await demo.pressSpace(); // pause
    await demo.clickPlay();  // resume
    await demo.pressR();     // reset
    await demo.clickPlay();
    // Let a little progress happen
    await page.waitForTimeout(1200);
    await demo.clickReset();

    // After these interactions the beforeEach/afterEach assertions will check that there were no page errors or console errors.
    // We also add a final sanity check: the app shows Idle state again.
    await expect(demo.stepLabel).toHaveText('Idle');
  });
});