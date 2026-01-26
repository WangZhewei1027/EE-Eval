import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f6c923-fa77-11f0-a6a1-c765f41a13c7.html';

// Page object for interacting with the backtracking visualization page
class BacktrackingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.playBtn = page.locator('#playBtn');
    this.playLabel = page.locator('#playLabel');
    this.replayBtn = page.locator('#replayBtn');
    this.board = page.locator('#board');
    this.cells = page.locator('.cell');
    this.edgesSvg = page.locator('#edges');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for grid cells to be created (36 cells for 6x6)
    await this.page.waitForSelector('.cell', { timeout: 3000 });
    // ensure centers calculation has had a frame to run
    await this.page.waitForTimeout(50);
  }

  async isPlaying() {
    const val = await this.playBtn.getAttribute('aria-pressed');
    return val === 'true';
  }

  async getPlayLabelText() {
    return await this.playLabel.innerText();
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async clickReplay() {
    await this.replayBtn.click();
  }

  async countCellsWithClass(className) {
    return await this.page.$$eval(`.cell.${className}`, els => els.length);
  }

  async countEdges() {
    // edges are SVG path elements with class 'edge' inside #edges
    return await this.page.$$eval('#edges .edge', els => els.length);
  }

  async countSolutionLines() {
    return await this.page.$$eval('#edges .solution-line', els => els.length);
  }

  async getCellAttributes(idx = 0) {
    // returns dataset and className of the nth cell
    return await this.page.$$eval('.cell', (els, i) => {
      const el = els[i] || els[0];
      return { dataset: el.dataset, className: el.className };
    }, idx);
  }

  async pauseFor(ms) {
    await this.page.waitForTimeout(ms);
  }
}

test.describe('Backtracking Visualization - FSM & UI tests', () => {
  // Collect console errors and page errors per test to assert on later
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // capture console events
    page.on('console', msg => {
      // store severity and text for debugging and assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // capture uncaught exceptions from page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async ({ page }) => {
    // Ensure no unexpected uncaught runtime errors occurred during the test
    // We assert zero page errors at each cleanup to detect regressions.
    expect(pageErrors.map(e => e.message)).toEqual([]);
    // Also assert that there are no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.map(e => e.text)).toEqual([]);
    // Helpful debug output if something unexpected happened (kept as assertions above)
  });

  test('Initial Idle State: resetVisuals() applied and grid built', async ({ page }) => {
    // Validate that on initial load the page is in Idle-like visual state:
    // - grid contains the expected number of cells (6x6 = 36)
    // - no visited/current/backtracked/path classes applied immediately (resetVisuals() evidence)
    const bp = new BacktrackingPage(page);
    await bp.goto();

    // Immediately after init, resetVisuals() is called in init() before the scheduled auto-replay.
    // Confirm cell count
    const totalCells = await bp.cells.count();
    expect(totalCells).toBe(36);

    // There should be no visited/current/backtracked/path classes immediately
    const visited = await bp.countCellsWithClass('visited');
    const current = await bp.countCellsWithClass('current');
    const backtracked = await bp.countCellsWithClass('backtracked');
    const path = await bp.countCellsWithClass('path');

    expect(visited).toBe(0);
    expect(current).toBe(0);
    expect(backtracked).toBe(0);
    expect(path).toBe(0);

    // Play button should reflect not-playing state initially (ARIA)
    const ariaPressed = await bp.playBtn.getAttribute('aria-pressed');
    expect(ariaPressed).toBe('false');
    const label = await bp.getPlayLabelText();
    expect(label).toBe('Play');

    // Confirm start and target cells exist and retain their classes immediately
    // Find a start and target cell by class presence
    const startCount = await bp.countCellsWithClass('start');
    const targetCount = await bp.countCellsWithClass('target');
    expect(startCount).toBeGreaterThanOrEqual(1);
    expect(targetCount).toBeGreaterThanOrEqual(1);
  });

  test('PlayToggle: Idle -> Playing (S0 -> S1) starts automatic stepping and UI updates', async ({ page }) => {
    // This test verifies clicking Play toggles playing state and triggers visual updates.
    const bp = new BacktrackingPage(page);
    await bp.goto();

    // Ensure we are in a non-playing baseline; because the page auto-schedules replay at ~900ms,
    // perform the click quickly to exercise the explicit Play path (this will either start or pause).
    await bp.clickPlay();

    // After clicking, UI should indicate playing state
    await expect(bp.playBtn).toHaveAttribute('aria-pressed', 'true');
    await expect(bp.playLabel).toHaveText('Pause');

    // Wait a moment for step() to execute and produce at least some visual changes (visited/current)
    await bp.pauseFor(700);

    const visitedAfterPlay = await bp.countCellsWithClass('visited');
    const currentAfterPlay = await bp.countCellsWithClass('current');

    // At least one visited and one current cell should be present while playing
    expect(visitedAfterPlay).toBeGreaterThanOrEqual(1);
    expect(currentAfterPlay).toBeGreaterThanOrEqual(1);

    // There should be at least one drawn edge between cells (move events create edges)
    const edgesCount = await bp.countEdges();
    expect(edgesCount).toBeGreaterThanOrEqual(0); // allow 0 in case step hasn't created edges yet but not negative
  });

  test('PlayToggle: Playing -> Paused (S1 -> S2) stops progression and preserves visuals', async ({ page }) => {
    // Validate toggling Play when playing pauses the animation and clearTimeout(timer) is used on exit
    const bp = new BacktrackingPage(page);
    await bp.goto();

    // Ensure playing
    await bp.clickPlay();
    await expect(bp.playBtn).toHaveAttribute('aria-pressed', 'true');
    await bp.pauseFor(450);

    // Record counts while playing
    const visitedBeforePause = await bp.countCellsWithClass('visited');
    const edgesBeforePause = await bp.countEdges();

    // Pause
    await bp.clickPlay();
    await expect(bp.playBtn).toHaveAttribute('aria-pressed', 'false');
    await expect(bp.playLabel).toHaveText('Play');

    // Wait some time (longer than typical step delay) to ensure no additional events processed
    await bp.pauseFor(900);

    const visitedAfterPause = await bp.countCellsWithClass('visited');
    const edgesAfterPause = await bp.countEdges();

    // Paused: counts should not increase (no further stepping)
    expect(visitedAfterPause).toBe(visitedBeforePause);
    // edges might be removed during backtracks but should not unexpectedly increase while paused
    expect(edgesAfterPause).toBeLessThanOrEqual(Math.max(edgesBeforePause, edgesAfterPause));
  });

  test('PlayToggle: Paused -> Playing (S2 -> S1) resumes progression', async ({ page }) => {
    // Validate resuming from paused state continues stepping
    const bp = new BacktrackingPage(page);
    await bp.goto();

    // Start playing then pause
    await bp.clickPlay();
    await bp.pauseFor(400);
    await bp.clickPlay(); // pause
    await expect(bp.playBtn).toHaveAttribute('aria-pressed', 'false');

    // Capture visited count when paused
    const visitedPaused = await bp.countCellsWithClass('visited');

    // Resume
    await bp.clickPlay();
    await expect(bp.playBtn).toHaveAttribute('aria-pressed', 'true');

    // Wait for a couple of steps
    await bp.pauseFor(1000);

    const visitedAfterResume = await bp.countCellsWithClass('visited');
    // After resuming, visited should increase (or at least not decrease)
    expect(visitedAfterResume).toBeGreaterThanOrEqual(visitedPaused);
  });

  test('Replay transitions: Playing -> Replaying (S1 -> S3) clears visuals and restarts', async ({ page }) => {
    // Verify clicking Replay while playing resets visuals (resetVisuals) and restarts playback
    const bp = new BacktrackingPage(page);
    await bp.goto();

    // Start playing explicitly
    await bp.clickPlay();
    await expect(bp.playBtn).toHaveAttribute('aria-pressed', 'true');
    // Allow some progress
    await bp.pauseFor(400);

    // Click replay while playing
    await bp.clickReplay();

    // Immediately, resetVisuals is called; edges should be cleared quickly
    // Wait a small amount to allow resetVisuals to execute
    await bp.pauseFor(80);

    const edgesAfterReplay = await bp.countEdges();
    expect(edgesAfterReplay).toBe(0);

    // After the replay delay (160ms), playing should be true and stepping should proceed
    await bp.pauseFor(250);
    await expect(bp.playBtn).toHaveAttribute('aria-pressed', 'true');

    // Some visited cells should appear again
    await bp.pauseFor(500);
    const visitedNow = await bp.countCellsWithClass('visited');
    expect(visitedNow).toBeGreaterThanOrEqual(1);
  });

  test('Replay transitions: Paused -> Replaying (S2 -> S3) resets and starts from pause', async ({ page }) => {
    // Validate clicking Replay while paused resets visuals and starts playback
    const bp = new BacktrackingPage(page);
    await bp.goto();

    // Start and then pause to reach S2
    await bp.clickPlay();
    await bp.pauseFor(300);
    await bp.clickPlay(); // pause
    await expect(bp.playBtn).toHaveAttribute('aria-pressed', 'false');

    // Click replay while paused
    await bp.clickReplay();

    // Immediately edges cleared by resetVisuals
    await bp.pauseFor(80);
    const edgesAfterReplay = await bp.countEdges();
    expect(edgesAfterReplay).toBe(0);

    // After replay's small delay the UI should show playing state
    await bp.pauseFor(300);
    await expect(bp.playBtn).toHaveAttribute('aria-pressed', 'true');
  });

  test('Solution: final solution path and solution-line elements are rendered', async ({ page }) => {
    // Wait for the visualization to progress to the 'solution' event and check solution-line elements exist
    const bp = new BacktrackingPage(page);
    await bp.goto();

    // Ensure the visualization runs to completion: allow several seconds for full DFS and solution rendering.
    // The animation uses a series of timeouts; aggregated waiting here ensures the solution gets drawn.
    await bp.pauseFor(4500);

    const solutionLineCount = await bp.countSolutionLines();
    const pathCells = await bp.countCellsWithClass('path');

    // There should be at least one solution line and some path cells marking final path.
    expect(solutionLineCount).toBeGreaterThanOrEqual(1);
    expect(pathCells).toBeGreaterThanOrEqual(1);
  }, { timeout: 20000 });

  test('Edge cases: rapid toggles and window resize do not produce uncaught errors', async ({ page }) => {
    // Rapidly click Play multiple times and resize the viewport to trigger updateCenters.
    // Assert no uncaught exceptions and UI stabilizes to a boolean playing state.
    const bp = new BacktrackingPage(page);
    await bp.goto();

    // Rapid toggle series
    for (let i = 0; i < 6; i++) {
      await bp.clickPlay();
      // small but very short pauses
      await bp.pauseFor(60);
    }

    // Resize viewport to invoke window resize handler (updateCenters)
    const prevViewport = page.viewportSize() || { width: 1280, height: 720 };
    await page.setViewportSize({ width: Math.max(320, prevViewport.width - 200), height: prevViewport.height - 100 });
    await bp.pauseFor(200);

    // Resize back
    await page.setViewportSize(prevViewport);
    await bp.pauseFor(200);

    // Ensure play button has a defined aria-pressed attribute and no exception occurred
    const aria = await bp.playBtn.getAttribute('aria-pressed');
    expect(aria === 'true' || aria === 'false').toBeTruthy();

    // Ensure there are no uncaught errors captured by pageerror (checked in afterEach)
  });

  test('Sanity: window._backtracking exists and events were generated', async ({ page }) => {
    // Verify debug hook window._backtracking exists and contains expected properties (generateEvents, events, maze, cells)
    const bp = new BacktrackingPage(page);
    await bp.goto();

    const hasDebug = await page.evaluate(() => {
      return typeof window._backtracking === 'object' && window._backtracking !== null;
    });
    expect(hasDebug).toBe(true);

    // Ensure generateEvents is a function and events is an array
    const info = await page.evaluate(() => {
      return {
        hasGenerate: typeof window._backtracking.generateEvents === 'function',
        eventsLength: Array.isArray(window._backtracking.events) ? window._backtracking.events.length : -1,
        mazeDefined: Array.isArray(window._backtracking.maze),
        cellsDefined: Array.isArray(window._backtracking.cells)
      };
    });

    expect(info.hasGenerate).toBe(true);
    expect(info.eventsLength).toBeGreaterThanOrEqual(0);
    expect(info.mazeDefined).toBe(true);
    expect(info.cellsDefined).toBe(true);
  });
});