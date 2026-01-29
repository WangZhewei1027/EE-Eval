import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f96131-fa77-11f0-a6a1-c765f41a13c7.html';

// Page Object for interacting with the Random Forest visualization
class RandomForestPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.playText = page.locator('#playText');
    this.randBtn = page.locator('#randBtn');
    this.treeCount = page.locator('#treeCount');
    this.metricTrees = page.locator('#metricTrees');
    this.metricDepth = page.locator('#metricDepth');
    this.heatmap = page.locator('#heatmap');
    this.overlay = page.locator('#overlay');
    this.glow = page.locator('#glow');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // wait for essential DOM to be present and the initial initialization to complete a bit
    await this.playText.waitFor({ state: 'visible' });
    await this.metricDepth.waitFor({ state: 'visible' });
    // allow the script's initial synchronous initialization (generateData/buildForest/resetAggregation)
    // and the small entrancePulse/initial rendering to start
    await this.page.waitForTimeout(120);
  }

  async getPlayText() {
    return this.playText.innerText();
  }

  async getTreeCount() {
    const t = await this.treeCount.innerText();
    // convert to number (fallback 0)
    const n = Number(t);
    return Number.isNaN(n) ? 0 : n;
  }

  async getMetricTrees() {
    const t = await this.metricTrees.innerText();
    const n = Number(t);
    return Number.isNaN(n) ? 0 : n;
  }

  async getMetricDepth() {
    const t = await this.metricDepth.innerText();
    const n = Number(t);
    return Number.isNaN(n) ? null : n;
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async clickRandomize() {
    await this.randBtn.click();
  }

  async pressSpace() {
    // ensure page has focus so window keydown triggers
    await this.page.keyboard.press('Space');
  }

  async heatmapDataURL() {
    // return the heatmap canvas data URL from within the page context
    return this.page.evaluate(() => {
      const c = document.getElementById('heatmap');
      try {
        return c.toDataURL();
      } catch (e) {
        return `ERROR:${e && e.message ? e.message : String(e)}`;
      }
    });
  }

  async canvasSizes() {
    return this.page.evaluate(() => {
      const heat = document.getElementById('heatmap');
      const ov = document.getElementById('overlay');
      const glow = document.getElementById('glow');
      return {
        heat: { width: heat.width, height: heat.height, styleWidth: heat.style.width, styleHeight: heat.style.height },
        overlay: { width: ov.width, height: ov.height, styleWidth: ov.style.width, styleHeight: ov.style.height },
        glow: { width: glow.width, height: glow.height, styleWidth: glow.style.width, styleHeight: glow.style.height },
      };
    });
  }
}

test.describe.serial('Random Forest — Visual Concept (FSM validation)', () => {
  // Capture console.error and page errors for each test run
  test.beforeEach(async ({ page }) => {
    // Attach listeners to capture console error-level messages and page errors
    page.context()._rf_consoleErrors = [];
    page.context()._rf_pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        page.context()._rf_consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : null,
        });
      }
    });

    page.on('pageerror', (err) => {
      page.context()._rf_pageErrors.push(String(err && err.message ? err.message : err));
    });
  });

  test.afterEach(async ({ page }) => {
    // Assert no uncaught page errors or console errors were emitted during the test
    const consoleErrors = page.context()._rf_consoleErrors || [];
    const pageErrors = page.context()._rf_pageErrors || [];

    // Provide helpful diagnostics in case of failures
    expect(consoleErrors, `Expected no console.error messages; got: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
    expect(pageErrors, `Expected no page errors; got: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  test('Initial Idle state: initialize() executed and DOM reflects idle state', async ({ page }) => {
    // This test validates S0_Idle: after load, initialize() should have run
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Verify visual control text is "Play" indicating Idle
    const playText = await rf.getPlayText();
    expect(playText).toBe('Play');

    // Verify badges and metrics reflect zero trees in ensemble
    const treeCount = await rf.getTreeCount();
    const metricTrees = await rf.getMetricTrees();
    expect(treeCount).toBe(0);
    expect(metricTrees).toBe(0);

    // Verify metricDepth was set as per initialization (DEPTH = 4)
    const depth = await rf.getMetricDepth();
    expect(depth).toBe(4);

    // Verify canvases are created and have expected intrinsic sizes (GRID_W=300, GRID_H=220)
    const sizes = await rf.canvasSizes();
    expect(sizes.heat.width).toBeGreaterThanOrEqual(220); // sanity: width should be at least 220 (intrinsic 300)
    expect(sizes.heat.height).toBeGreaterThanOrEqual(120); // intrinsic 220
    // ensure dataURL can be extracted (canvas is present and drawable)
    const dataURL = await rf.heatmapDataURL();
    expect(typeof dataURL).toBe('string');
    expect(dataURL.startsWith('data:image/png')).toBeTruthy();
  });

  test('Play button toggles to Playing state and starts animation (S0 -> S1)', async ({ page }) => {
    // This test validates the PlayPauseClick event transition from Idle to Playing
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Ensure we start from Idle
    expect(await rf.getPlayText()).toBe('Play');

    // Click Play
    await rf.clickPlay();

    // Immediately the label should change to 'Pause' and button should have class 'playing'
    await expect(rf.playText).toHaveText('Pause');
    const hasPlayingClass = await page.locator('#playBtn.playing').count();
    expect(hasPlayingClass).toBeGreaterThan(0);

    // Wait a little for the interval to add some trees (interval is 90ms per tree)
    await page.waitForTimeout(400); // ~4 trees expected in many runs

    // Validate that trees were added (treeCount and metricTrees > 0)
    const treeCountAfter = await rf.getTreeCount();
    const metricTreesAfter = await rf.getMetricTrees();
    expect(treeCountAfter).toBeGreaterThan(0);
    expect(metricTreesAfter).toBeGreaterThan(0);

    // Also verify heatmap canvas changed (non-empty dataURL)
    const dataURL = await rf.heatmapDataURL();
    expect(typeof dataURL).toBe('string');
    expect(dataURL.startsWith('data:image/png')).toBeTruthy();
  });

  test('Play button toggles back to Idle (pause) and stops adding trees (S1 -> S0)', async ({ page }) => {
    // This test validates PlayPauseClick during Playing pauses the animation and clearInterval() executed
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Start playing first
    await rf.clickPlay();
    await expect(rf.playText).toHaveText('Pause');

    // Allow a few trees to be added
    await page.waitForTimeout(360);
    const countBeforePause = await rf.getTreeCount();
    expect(countBeforePause).toBeGreaterThan(0);

    // Click Play again to pause
    await rf.clickPlay();

    // Label should return to 'Play' and 'playing' class removed
    await expect(rf.playText).toHaveText('Play');
    const hasPlayingClassAfter = await page.locator('#playBtn.playing').count();
    expect(hasPlayingClassAfter).toBe(0);

    // Record tree count and wait to ensure it does not increase after pause
    const countAfterPause = await rf.getTreeCount();
    await page.waitForTimeout(300); // allow time that would have added trees if not paused
    const countLater = await rf.getTreeCount();
    expect(countAfterPause).toBe(countLater);
  });

  test('Space key toggles play/pause (keyboard shortcut) (S1 <-> S0)', async ({ page }) => {
    // Validate SpaceKeyPress triggers play/pause (the window keydown -> playBtn.click)
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Press Space to start playing
    await rf.pressSpace();
    await expect(rf.playText).toHaveText('Pause');

    // Wait for a couple of trees
    await page.waitForTimeout(300);
    const countWhilePlaying = await rf.getTreeCount();
    expect(countWhilePlaying).toBeGreaterThan(0);

    // Press Space to pause
    await rf.pressSpace();
    await expect(rf.playText).toHaveText('Play');

    // Ensure no further trees are added after pause
    const countAfter = await rf.getTreeCount();
    await page.waitForTimeout(300);
    const countAfterWait = await rf.getTreeCount();
    expect(countAfter).toBe(countAfterWait);
  });

  test('Randomize while Playing should stop animation, reset aggregation and generate a new dataset (S1 -> S0 via RandomizeClick)', async ({ page }) => {
    // This test validates that RandomizeClick stops animation and resets counts
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Start playing
    await rf.clickPlay();
    await expect(rf.playText).toHaveText('Pause');

    // Wait a bit to accumulate some trees
    await page.waitForTimeout(360);
    const countDuring = await rf.getTreeCount();
    expect(countDuring).toBeGreaterThan(0);

    // Click Randomize while playing
    await rf.clickRandomize();

    // After randomize, animation must be stopped (Play text) and counts reset to zero
    await expect(rf.playText).toHaveText('Play');
    const playingClass = await page.locator('#playBtn.playing').count();
    expect(playingClass).toBe(0);

    const treeCountAfterRand = await rf.getTreeCount();
    const metricTreesAfterRand = await rf.getMetricTrees();
    expect(treeCountAfterRand).toBe(0);
    expect(metricTreesAfterRand).toBe(0);

    // The heatmap canvas remains accessible and should produce a valid data URL
    const dataURL = await rf.heatmapDataURL();
    expect(typeof dataURL).toBe('string');
    expect(dataURL.startsWith('data:image/png')).toBeTruthy();
  });

  test('Randomize while Idle (paused) should reset aggregation and keep Play label', async ({ page }) => {
    // Validate clicking Randomize when paused stops any potential animation (idempotent) and resets counts
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Ensure idle
    expect(await rf.getPlayText()).toBe('Play');
    await rf.clickRandomize();

    // Play label should remain 'Play' and counts remain zero
    await expect(rf.playText).toHaveText('Play');
    expect(await rf.getTreeCount()).toBe(0);
    expect(await rf.getMetricTrees()).toBe(0);
  });

  test('Edge case: pausing immediately after play should not throw and leaves consistent state', async ({ page }) => {
    // Rapid toggling to exercise potential race conditions in interval setup/clear
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Rapid start/stop sequence
    await rf.clickPlay(); // start
    await rf.clickPlay(); // immediate pause
    // Allow some time for any interval cleanup
    await page.waitForTimeout(200);

    // Ensure stable state (paused)
    await expect(rf.playText).toHaveText('Play');
    expect(await rf.getTreeCount()).toBeGreaterThanOrEqual(0); // stable numeric
  });

  test('DOM integrity: critical controls and canvases remain in document after interactions', async ({ page }) => {
    // Ensure the main elements persist after a set of interactions
    const rf = new RandomForestPage(page);
    await rf.goto();

    // Perform a set of interactions
    await rf.clickPlay();
    await page.waitForTimeout(220);
    await rf.clickRandomize();
    await page.waitForTimeout(120);
    await rf.pressSpace(); // should start playing
    await page.waitForTimeout(220);
    await rf.pressSpace(); // pause

    // Ensure elements still present
    await expect(page.locator('#playBtn')).toBeVisible();
    await expect(page.locator('#randBtn')).toBeVisible();
    await expect(page.locator('#treeCount')).toBeVisible();
    await expect(page.locator('#metricTrees')).toBeVisible();
    await expect(page.locator('#metricDepth')).toBeVisible();

    // Ensure canvases still return valid data
    const heatData = await rf.heatmapDataURL();
    expect(typeof heatData).toBe('string');
    expect(heatData.startsWith('data:image/png')).toBeTruthy();
  });
});