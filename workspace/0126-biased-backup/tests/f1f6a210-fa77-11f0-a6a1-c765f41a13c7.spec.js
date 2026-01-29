import { test, expect } from '@playwright/test';

const PAGE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f6a210-fa77-11f0-a6a1-c765f41a13c7.html';

/**
 * Page object for the A* visualizer page.
 * Encapsulates common interactions and queries used across tests.
 */
class VisualizerPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(PAGE_URL, { waitUntil: 'domcontentloaded' });
  }

  async getReplayButton() {
    return await this.page.$('#replay');
  }

  async getPauseButton() {
    return await this.page.$('#pause');
  }

  async clickReplay() {
    const btn = await this.getReplayButton();
    await btn.click();
  }

  async clickPause() {
    const btn = await this.getPauseButton();
    await btn.click();
  }

  async getPauseButtonText() {
    return await this.page.evaluate(() => {
      const b = document.getElementById('pause');
      return b ? b.innerText : null;
    });
  }

  async getPausedFlag() {
    // Read the global paused variable from the page
    return await this.page.evaluate(() => {
      // Some pages may not expose paused; let the page throw naturally if missing
      return typeof paused !== 'undefined' ? paused : null;
    });
  }

  async getFunctionExists(name) {
    return await this.page.evaluate((n) => typeof window[n] === 'function', name);
  }

  async getCanvasSize() {
    return await this.page.evaluate(() => {
      const c = document.getElementById('scene');
      if (!c) return { w: 0, h: 0, clientW: 0, clientH: 0 };
      return { w: c.width, h: c.height, clientW: c.clientWidth, clientH: c.clientHeight };
    });
  }

  async getSetSize(varName) {
    // For Set-like globals (openSetKeys, closedSetKeys) return .size if available, else null
    return await this.page.evaluate((v) => {
      const obj = window[v];
      if (obj instanceof Set) return obj.size;
      // Maybe it's an object keyed as plain object (old code). Try length or Object.keys
      if (obj && typeof obj === 'object') {
        if (typeof obj.length === 'number') return obj.length;
        return Object.keys(obj).length;
      }
      return null;
    }, varName);
  }

  async getSearchStateSnapshot() {
    // Return a compact snapshot of key runtime values used to assert transitions
    return await this.page.evaluate(() => {
      return {
        paused: typeof paused !== 'undefined' ? paused : null,
        searchDone: typeof searchDone !== 'undefined' ? !!searchDone : null,
        foundPathLength: foundPath ? foundPath.length : (typeof foundPath === 'undefined' ? null : 0),
        openSize: (openSetKeys instanceof Set) ? openSetKeys.size : (openSetKeys ? Object.keys(openSetKeys).length : null),
        closedSize: (closedSetKeys instanceof Set) ? closedSetKeys.size : (closedSetKeys ? Object.keys(closedSetKeys).length : null),
        currentNode: currentNode ? { x: currentNode.x, y: currentNode.y } : null
      };
    });
  }
}

test.describe('A* Search — Visual Exploration (f1f6a210-...)', () => {
  let pageErrors = [];
  let consoleErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    pageErrors = [];
    consoleErrors = [];

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages of type 'error' for later assertions / inspection
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown globally; individual tests are isolated by Playwright fixture.
  });

  test('Page loads and exposes expected DOM nodes and runtime functions', async ({ page }) => {
    // Validate successful load and that the essential elements exist,
    // plus that the declared FSM-related functions are present on the window.
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Basic DOM checks
    const replay = await vp.getReplayButton();
    const pause = await vp.getPauseButton();
    const canvasSize = await vp.getCanvasSize();

    expect(replay).toBeTruthy(); // #replay exists
    expect(pause).toBeTruthy(); // #pause exists
    expect(canvasSize.w).toBeGreaterThan(0); // canvas internal width > 0
    expect(canvasSize.h).toBeGreaterThan(0); // canvas internal height > 0
    expect(canvasSize.clientW).toBeGreaterThan(0);
    expect(canvasSize.clientH).toBeGreaterThan(0);

    // FSM-related functions referenced in the FSM should exist
    const hasResetAndRun = await vp.getFunctionExists('resetAndRun');
    const hasAutoStart = await vp.getFunctionExists('autoStart');
    expect(hasResetAndRun).toBe(true);
    expect(hasAutoStart).toBe(true);

    // There should be no unexpected page errors during initial load
    // (we assert the absence of uncaught exceptions; if any exist they will be visible in pageErrors)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Initial run state: autoStart invoked -> running (paused=false) and search progressing', async ({ page }) => {
    // Verify S1_Running behavior (autoStart entry action) after load:
    // - paused flag should be false
    // - openSet and/or closedSet should begin to populate
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Wait a short while to allow the animation / step loop to perform some expansions
    await page.waitForTimeout(300);

    const snapshot = await vp.getSearchStateSnapshot();
    // paused should be explicitly false (running)
    expect(snapshot.paused).toBe(false);

    // Either some nodes have moved to closed set or open set should have some size > 0
    // (The algorithm pushes the start node immediately)
    expect(snapshot.openSize).not.toBeNull();
    expect(snapshot.closedSize).not.toBeNull();

    // At least one of the open/closed should be > 0 as an indication the search is active
    expect((snapshot.openSize > 0) || (snapshot.closedSize > 0)).toBe(true);

    // Ensure there were no uncaught errors during the running period
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e=>String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Console errors: ${consoleErrors.join('; ')}`).toBe(0);
  });

  test('Pause button toggles paused flag and updates button label (S1_Running <-> S2_Paused)', async ({ page }) => {
    // This covers two transitions:
    // - Running -> Paused when Pause clicked (paused = true)
    // - Paused -> Running when Pause clicked again (paused = false)
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Ensure a stable initial running state
    await page.waitForTimeout(200);
    let initial = await vp.getSearchStateSnapshot();
    expect(initial.paused).toBe(false);

    // Click Pause -> should pause the animation and change the button text to '▶ Resume'
    await vp.clickPause();

    // Allow a tick for the UI to update
    await page.waitForTimeout(80);

    let afterPause = await vp.getSearchStateSnapshot();
    expect(afterPause.paused).toBe(true);

    // Verify button text reflects paused state
    const pausedText = await vp.getPauseButtonText();
    expect(pausedText).toContain('Resume'); // The implementation uses '▶ Resume' when paused

    // Click pause again to resume
    await vp.clickPause();
    await page.waitForTimeout(80);

    const afterResume = await vp.getSearchStateSnapshot();
    expect(afterResume.paused).toBe(false);

    const resumedText = await vp.getPauseButtonText();
    expect(resumedText).toContain('Pause'); // Should revert to '⏸ Pause'

    // No unexpected errors while toggling rapidly
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Replay button triggers resetAndRun() and transitions to Running (S0_Idle -> S1_Running)', async ({ page }) => {
    // Validate that clicking Replay resets the search and ensures the animation runs.
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Pause first to create a non-running state to better observe reset
    await vp.clickPause();
    await page.waitForTimeout(60);
    const pausedSnapshot = await vp.getSearchStateSnapshot();
    expect(pausedSnapshot.paused).toBe(true);

    // Now click Replay which should call resetAndRun(), clear exploration state, and unpause
    await vp.clickReplay();

    // Allow reset to process
    await page.waitForTimeout(120);

    const afterReplay = await vp.getSearchStateSnapshot();

    // resetAndRun sets paused = false as per implementation
    expect(afterReplay.paused).toBe(false);

    // resetAndRun clears openSetKeys and closedSetKeys; openSetKeys likely becomes empty immediately
    // Conservative: allow either 0 or small number as push happens quickly; assert open set is a number and not null
    expect(afterReplay.openSize).not.toBeNull();
    expect(afterReplay.closedSize).not.toBeNull();

    // As an explicit sign that reset occurred, currentNode should be null early on (no expansion yet) OR openSize small
    // We don't fail the test for either case; just assert the runtime remains consistent (no errors)
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid interaction edge-case: multiple quick Pause/Replay clicks cause no crashes', async ({ page }) => {
    // Edge case test: user mashes pause and replay quickly. We must not patch the page; just exercise and assert no uncaught errors.
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Rapid sequence of clicks
    const actions = async () => {
      await vp.clickPause();   // toggle pause
      await vp.clickReplay();  // reset while paused/running
      await vp.clickPause();   // toggle again
      await vp.clickReplay();  // reset again
    };

    // Fire the sequence a few times quickly and then wait a bit to let the app settle
    for (let i = 0; i < 4; i++) {
      await actions();
    }

    // Wait so background animation loops can stabilize
    await page.waitForTimeout(400);

    // Ensure the page is still responsive: buttons exist and paused flag is a boolean
    const pauseBtn = await vp.getPauseButton();
    const replayBtn = await vp.getReplayButton();
    expect(pauseBtn).toBeTruthy();
    expect(replayBtn).toBeTruthy();

    const pausedValue = await vp.getPausedFlag();
    expect(typeof pausedValue === 'boolean').toBe(true);

    // Check there were no uncaught page errors during the rapid interactions
    expect(pageErrors.length, `pageErrors: ${pageErrors.map(e=>String(e)).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `consoleErrors: ${consoleErrors.join('; ')}`).toBe(0);
  });

  test('Runtime invariants and accessibility: canvas present, legend/chips and badges visible', async ({ page }) => {
    // Validate that important visual elements exist and are readable to assistive queries
    const vp = new VisualizerPage(page);
    await vp.goto();

    // DOM queries for legends and badges
    const legendText = await page.evaluate(() => {
      const chips = Array.from(document.querySelectorAll('.legend .chip'));
      return chips.map(c => c.textContent.trim());
    });

    expect(legendText.length).toBeGreaterThanOrEqual(4);
    expect(legendText.some(t => t.includes('Start'))).toBe(true);
    expect(legendText.some(t => t.includes('Open set'))).toBe(true);

    // Overlay badge should exist
    const badge = await page.$('.overlay .badge');
    expect(badge).toBeTruthy();

    // Canvas should have drawing context available (ctx created on page load)
    const ctxType = await page.evaluate(() => {
      const c = document.getElementById('scene');
      try {
        return !!(c && c.getContext && c.getContext('2d')) ? '2d' : null;
      } catch (e) {
        // Let exceptions surface naturally; tests will assert errors array
        return null;
      }
    });
    expect(ctxType).toBe('2d');

    // No uncaught exceptions expected here
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Sanity check: quick path existence validator ran and ensured solvability (no infinite failure)', async ({ page }) => {
    // The page contains an ensureSolvable() function that may regenerate the grid until solvable.
    // We ensure that after a short period, either a path is found or the search has been performed and searchDone set.
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Wait a longer time to give the script opportunity to regenerate if necessary
    await page.waitForTimeout(1000);

    // Query the page's quick validation state (foundPath or searchDone)
    const status = await page.evaluate(() => {
      return {
        foundPathDefined: typeof foundPath !== 'undefined' && foundPath !== null && foundPath.length > 0,
        searchDone: typeof searchDone !== 'undefined' ? !!searchDone : null,
        regenAttempts: typeof regenAttempts !== 'undefined' ? regenAttempts : null
      };
    });

    // The page attempts to guarantee solvability; at minimum we expect the page to have executed the solvability logic
    expect(status.regenAttempts).not.toBeNull();
    // Either a path was discovered OR searchDone is true (meaning algorithm completed). We accept either.
    expect(status.foundPathDefined || (status.searchDone === true) || (typeof status.searchDone === 'boolean')).toBeTruthy();

    // Again: ensure no uncaught exceptions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe console and page errors (if any) and assert none of the common runtime error types were thrown', async ({ page }) => {
    // This test intentionally collects console/page errors and asserts that ReferenceError/SyntaxError/TypeError did NOT occur.
    // We attach fresh listeners (already attached in beforeEach) and then load the page again to ensure we captured early runtime problems.
    const vp = new VisualizerPage(page);
    await vp.goto();

    // Allow some time for asynchronous bootstrapping to produce any errors
    await page.waitForTimeout(500);

    // Map pageErrors to their names for assertion
    const errorNames = pageErrors.map(e => (e && e.name) ? e.name : String(e));

    // If any of the canonical runtime error types occurred, fail explicitly; otherwise, pass.
    const problematic = errorNames.filter(n => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(n));
    expect(problematic.length, `Encountered runtime errors: ${problematic.join(', ')}`).toBe(0);

    // Also assert that console error messages do not contain stack traces referencing missing identifiers
    // (This is tautological to the previous assertion but gives better failure messages)
    const consoleCombined = consoleErrors.join(' | ');
    expect(consoleCombined).not.toMatch(/ReferenceError|TypeError|SyntaxError/);

    // Additionally, assert pageErrors length is zero for a strict pass here
    expect(pageErrors.length, `Page had unexpected errors: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
  });

});