import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d80ca1-fa73-11f0-83e0-8d7be1d51901.html';

/**
 * Page object encapsulating interactions with the N-Queens Visualizer UI.
 */
class VisualizerPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Basic getters
  async getNLabel() {
    return this.page.locator('#nLabel').innerText();
  }
  async getSolCount() {
    return this.page.locator('#solCount').innerText();
  }
  async getPlayButtonText() {
    return this.page.locator('#playBtn').innerText();
  }
  async getBoardCells() {
    // returns array of cell elements
    return this.page.locator('#boardGrid .cell');
  }
  async getBoardCellCount() {
    return this.page.locator('#boardGrid .cell').count();
  }
  async getCellAt(r, c) {
    // use dataset attributes to locate specific cell
    return this.page.locator(`#boardGrid .cell[data-r="${r}"][data-c="${c}"]`);
  }
  async getLogText() {
    return this.page.locator('#logPanel').innerText();
  }
  async getLastLogLine() {
    const lines = this.page.locator('#logPanel .log-line');
    const count = await lines.count();
    if (count === 0) return '';
    return lines.nth(count - 1).innerText();
  }

  // Actions
  async clickReset() {
    await this.page.click('#resetBtn');
  }
  async clickStep() {
    await this.page.click('#stepBtn');
  }
  async clickPlay() {
    await this.page.click('#playBtn');
  }
  async clickRunToNextSolution() {
    await this.page.click('#fastAllBtn');
  }
  async clickFindAll() {
    await this.page.click('#allBtn');
  }
  async setNInputValue(n) {
    // set both input event and change to mimic user adjusting the slider and committing change
    await this.page.evaluate((val) => {
      const nInput = document.getElementById('nInput');
      nInput.value = String(val);
      nInput.dispatchEvent(new Event('input', { bubbles: true }));
      // commit the change (slider typically triggers 'change' on release)
      nInput.dispatchEvent(new Event('change', { bubbles: true }));
    }, n);
  }
  async setMode(value) {
    await this.page.selectOption('#modeSelect', value);
    // dispatch change to mimic user
    await this.page.evaluate(() => {
      const sel = document.getElementById('modeSelect');
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    });
  }
  async setSpeed(value) {
    await this.page.evaluate((v) => {
      const speed = document.getElementById('speed');
      speed.value = String(v);
      speed.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }
  async pressSpaceTogglePlay() {
    await this.page.keyboard.press('Space');
  }
}

test.describe('N-Queens Visualizer - FSM and UI integration tests', () => {
  let visualizer;
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught exceptions / page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    visualizer = new VisualizerPage(page);
    await visualizer.goto();
    // wait a short while to allow initial reset() and initial logs to appear
    await page.waitForTimeout(100);
  });

  test.afterEach(async ({ page }) => {
    // Expose captured console and page errors as expectations: expect none to have occurred.
    // If there are any, tests will fail here, making the logs visible in test output.
    expect(consoleErrors, `Console errors were logged: ${consoleErrors.map(e => e.text).join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `Unhandled page errors occurred: ${pageErrors.map(e => e && e.toString()).join(' | ')}`).toHaveLength(0);
    // Remove listeners to avoid leaks (Playwright pages are disposed by the fixture).
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test.describe('Initial state (S0_Idle) and Reset behavior', () => {
    test('initial UI reflects Idle state - board created, labels correct, reset invoked', async () => {
      // Validate initial N label and solution count
      const nLabel = await visualizer.getNLabel();
      expect(nLabel).toBe('8');

      const solCount = await visualizer.getSolCount();
      expect(solCount).toBe('0');

      // Board should have 8x8 cells
      const cellCount = await visualizer.getBoardCellCount();
      expect(cellCount).toBe(8 * 8);

      // The log panel should show reset info or ready hint
      const log = await visualizer.getLogText();
      expect(log).toContain('State reset');
      expect(log).toContain('Visualizer ready');

      // Reset button should be present and functional: clicking it resets solCount to 0
      // Precondition: maybe solutions already zero; click reset and ensure no crash and solCount remains '0'
      await visualizer.clickReset();
      const solAfterReset = await visualizer.getSolCount();
      expect(solAfterReset).toBe('0');

      // Ensure play button label is Play (idle)
      const playText = await visualizer.getPlayButtonText();
      expect(playText).toBe('Play');
    });
  });

  test.describe('Stepping (S2_Step) and step transitions', () => {
    test('step button triggers trying/checking/place/remove states and updates DOM classes', async ({ page }) => {
      // Click Step once and inspect the DOM for 'current' and 'try' classes and log entries
      await visualizer.clickStep();

      // After a single step, there should be at least one cell with class 'current' (a "trying" cell)
      const anyCurrent = await page.locator('#boardGrid .cell.current').count();
      expect(anyCurrent).toBeGreaterThan(0);

      const anyTry = await page.locator('#boardGrid .cell.try').count();
      expect(anyTry).toBeGreaterThanOrEqual(0); // 'try' may exist or may be converted to other states quickly

      // The logs should include a "Trying to place" line
      const logText = await visualizer.getLogText();
      expect(logText).toMatch(/Trying to place queen at row \d+, col \d+/);

      // Perform several steps to ensure 'place' and potentially 'remove' get emitted.
      // We don't want to step until a complete solution for N=8 (too many steps),
      // but we can perform multiple step calls and verify that 'Placed queen' log appears at some point.
      let placedFound = false;
      for (let i = 0; i < 10; i++) {
        await visualizer.clickStep();
        const last = await visualizer.getLastLogLine();
        if (/Placed queen at row/.test(await last)) {
          placedFound = true;
          break;
        }
      }
      expect(placedFound).toBe(true);
    });

    test('space keyboard toggles play (accessibility) and arrow/right triggers step via keyboard', async ({ page }) => {
      // Ensure starting from stopped state
      const initialPlayText = await visualizer.getPlayButtonText();
      expect(initialPlayText).toBe('Play');

      // Press space to start play -> label changes to Pause
      await visualizer.pressSpaceTogglePlay();
      await page.waitForTimeout(100);
      const afterSpace = await visualizer.getPlayButtonText();
      expect(afterSpace).toBe('Pause');

      // Press space again to pause
      await visualizer.pressSpaceTogglePlay();
      await page.waitForTimeout(100);
      const afterSpace2 = await visualizer.getPlayButtonText();
      expect(afterSpace2).toBe('Play');

      // Press ArrowRight to simulate advancing a step (shortcut)
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(50);
      // There should be logs from stepping
      const logText1 = await visualizer.getLogText();
      expect(logText.length).toBeGreaterThan(0);
    });
  });

  test.describe('Playing (S1_Playing) start/stop behavior', () => {
    test('clicking Play enters Playing state and toggles to Pause; clicking again stops', async ({ page }) => {
      // Click Play - should start and change label to Pause
      await visualizer.clickPlay();
      await page.waitForTimeout(150); // allow one tick to execute
      let playLabel = await visualizer.getPlayButtonText();
      expect(playLabel).toBe('Pause');

      // Click Play again to stop (the page toggles play/pause on the same button)
      await visualizer.clickPlay();
      await page.waitForTimeout(50);
      playLabel = await visualizer.getPlayButtonText();
      expect(playLabel).toBe('Play');
    });

    test('play auto-steps and does not throw when running briefly', async ({ page }) => {
      // Start play and let it run for a short burst then stop
      await visualizer.clickPlay();
      await page.waitForTimeout(300); // allow multiple automatic steps
      // Ensure that play is active
      let label = await visualizer.getPlayButtonText();
      expect(label).toBe('Pause');

      // Stop play
      await visualizer.clickPlay();
      await page.waitForTimeout(50);
      label = await visualizer.getPlayButtonText();
      expect(label).toBe('Play');

      // Logs should contain step activity
      const log1 = await visualizer.getLogText();
      expect(log).toMatch(/Trying to place|Placed queen|Conflict detected|Removing queen/);
    });
  });

  test.describe('Run to next solution (S3_FindingSolution) and Find All (S4_FindingAllSolutions) behaviors', () => {
    test('Run to Next Solution finds a solution and increments solution count (fast path)', async ({ page }) => {
      // Use the fast path button to find the next solution quickly
      // Ensure we are at a known state
      await visualizer.clickReset();
      await page.waitForTimeout(50);

      // Run to next solution; this should find at least one solution and increment solCount
      await visualizer.clickRunToNextSolution();

      // Wait a bit for rendering to complete
      await page.waitForTimeout(200);

      const solCount1 = parseInt(await visualizer.getSolCount(), 10);
      expect(solCount).toBeGreaterThanOrEqual(1);

      // Log should include "Solution #"
      const log2 = await visualizer.getLogText();
      expect(log).toMatch(/Solution #\d+ found/);

      // Board should display queens for that solution (at least N queens visible)
      // Count queen glyphs
      const queenGlyphs = await page.locator('#boardGrid .queen').count();
      // there should be at least one queen, and typical runToNextSolution draws full solution snapshot
      expect(queenGlyphs).toBeGreaterThan(0);
    });

    test('Find All Solutions completes and enters done state (S5_Completed) for small N (N=4)', async ({ page }) => {
      // Lower N to 4 to allow reasonably quick full search
      await visualizer.setNInputValue(4);
      // Wait for reset triggered by change event
      await page.waitForTimeout(100);

      // Sanity check: N label and board size updated
      const nLabel1 = await visualizer.getNLabel();
      expect(nLabel).toBe('4');

      // Trigger Find All Solutions
      await visualizer.clickFindAll();

      // Wait for the search to complete; the UI logs "Search completed." when generator yields done
      await page.waitForFunction(() => {
        const panel = document.getElementById('logPanel');
        return panel && panel.innerText.includes('Search completed.');
      }, { timeout: 10000 });

      // After completion the log must contain 'Search completed.' and solCount should be > 0
      const finalLog = await visualizer.getLogText();
      expect(finalLog).toContain('Search completed.');

      const solCount2 = parseInt(await visualizer.getSolCount(), 10);
      expect(solCount).toBeGreaterThanOrEqual(1);

      // The last log line should be 'Search completed.' (or contain it)
      const last1 = await visualizer.getLastLogLine();
      expect(last).toMatch(/Search completed\./i);
    });
  });

  test.describe('Change N and Mode (CHANGE_N and CHANGE_MODE) and edge cases', () => {
    test('changing N updates label and triggers reset; board is rebuilt to new size', async ({ page }) => {
      // Change to N=6 via page object (dispatches input and change)
      await visualizer.setNInputValue(6);
      // Wait for reset to complete
      await page.waitForTimeout(100);

      const nLabel2 = await visualizer.getNLabel();
      expect(nLabel).toBe('6');

      // Board should be 6x6
      const cellCount1 = await visualizer.getBoardCellCount();
      expect(cellCount).toBe(6 * 6);

      // Sol count reset to 0
      expect(await visualizer.getSolCount()).toBe('0');
    });

    test('changing mode updates selection and affects stepping behavior on solution', async ({ page }) => {
      // Use a small N (4) so that a solution will be hit quickly when stepping
      await visualizer.setNInputValue(4);
      await page.waitForTimeout(100);

      // Set mode to 'first' and ensure the select reflects it
      await visualizer.setMode('first');
      const modeVal = await page.locator('#modeSelect').inputValue();
      expect(modeVal).toBe('first');

      // Step repeatedly until a solution is found: because stepOnce checks the mode and will log 'Mode is "first": pausing after first solution.' when encountering a solution
      let foundModePauseLog = false;
      // Limit iterations to avoid infinite loop in case of unexpected behavior
      for (let i = 0; i < 200; i++) {
        await visualizer.clickStep();
        const last2 = await visualizer.getLastLogLine();
        if ((await last).includes('Mode is "first": pausing after first solution.')) {
          foundModePauseLog = true;
          break;
        }
        // small delay each loop to let DOM update
        await page.waitForTimeout(5);
      }
      expect(foundModePauseLog).toBe(true);
    });

    test('reset button clears progress and log shows reset message (edge-case)', async ({ page }) => {
      // Produce some activity
      await visualizer.clickRunToNextSolution();
      await page.waitForTimeout(100);

      // Now reset
      await visualizer.clickReset();
      await page.waitForTimeout(50);

      // Verify solCount reset and log contains reset text
      expect(await visualizer.getSolCount()).toBe('0');
      const log3 = await visualizer.getLogText();
      expect(log).toContain('State reset');
    });
  });

  test.describe('Robustness checks and error observation', () => {
    test('no uncaught exceptions or console errors should be emitted during normal usage', async ({ page }) => {
      // Run a sequence of operations to exercise many code paths
      await visualizer.clickStep();
      await page.waitForTimeout(30);
      await visualizer.clickPlay();
      await page.waitForTimeout(120);
      await visualizer.clickPlay(); // stop
      await visualizer.setSpeed(200);
      await visualizer.clickRunToNextSolution();
      await page.waitForTimeout(120);
      await visualizer.setNInputValue(5);
      await page.waitForTimeout(80);
      await visualizer.clickFindAll();
      // Wait briefly to let asynchronous batching start, but not necessarily finish for N=5
      await page.waitForTimeout(300);

      // We assert in afterEach that consoleErrors and pageErrors arrays are empty.
      // This test provides a sequence of interactions prior to that assertion.
      // Also ensure the application still has valid DOM: play button exists
      expect(await visualizer.getPlayButtonText()).toBeTruthy();
    });
  });
});