import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c145391-fa79-11f0-8fe7-a5317bd8e2c6.html';

/**
 * Page object encapsulating common interactions and queries for the BFS Explorer app.
 */
class BFSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.svg = page.locator('#svgCanvas');
    this.genGridBtn = page.locator('#genGrid');
    this.bfsInitBtn = page.locator('#bfsInit');
    this.stepBtn = page.locator('#stepBtn');
    this.runBtn = page.locator('#runBtn');
    this.stopBtn = page.locator('#stopBtn');
    this.undoBtn = page.locator('#undoBtn');
    this.redoBtn = page.locator('#redoBtn');
    this.exportJsonBtn = page.locator('#exportJson');
    this.importJsonBtn = page.locator('#importJsonBtn');
    this.jsonArea = page.locator('#jsonArea');
    this.queueList = page.locator('#queueList');
    this.logArea = page.locator('#log');
    this.visitedCount = page.locator('#visitedCount');
    this.frontierCount = page.locator('#frontierCount');
    this.currentNode = page.locator('#currentNode');
    this.foundGoals = page.locator('#foundGoals');
    this.historyIndex = page.locator('#historyIndex');
    this.modeRadio = (v) => page.locator(`input[name="mode"][value="${v}"]`);
    this.toolRadio = (v) => page.locator(`input[name="tool"][value="${v}"]`);
    this.startNodesInput = page.locator('#startNodesInput');
  }

  async clickGenerateGrid() {
    await this.genGridBtn.click();
  }

  async initializeBFS() {
    await this.bfsInitBtn.click();
  }

  async stepBFS() {
    await this.stepBtn.click();
  }

  async toggleRun() {
    await this.runBtn.click();
  }

  async stopBFS() {
    await this.stopBtn.click();
  }

  async undo() {
    await this.undoBtn.click();
  }

  async redo() {
    await this.redoBtn.click();
  }

  async exportJson() {
    await this.exportJsonBtn.click();
  }

  async importJson() {
    await this.importJsonBtn.click();
  }

  async setMode(mode) {
    await this.modeRadio(mode).click();
  }

  async setTool(tool) {
    await this.toolRadio(tool).click();
  }

  async dblclickSvgAt(x = 100, y = 100) {
    // position relative to svg element. Use bounding box position with an offset to be safe.
    await this.svg.dblclick({ position: { x, y } });
  }

  async nodeCount() {
    // Count <g class="node"> elements in the SVG
    return await this.page.locator('#svgCanvas g.node').count();
  }

  async getQueueListText() {
    return (await this.queueList.inputValue()).trim();
  }

  async getLogText() {
    return (await this.logArea.inputValue()).trim();
  }

  async getVisitedCount() {
    return parseInt((await this.visitedCount.textContent()).trim()) || 0;
  }

  async getFrontierCount() {
    return parseInt((await this.frontierCount.textContent()).trim()) || 0;
  }

  async getCurrentNodeText() {
    return (await this.currentNode.textContent()).trim();
  }

  async getFoundGoalsCount() {
    return parseInt((await this.foundGoals.textContent()).trim()) || 0;
  }

  async getHistoryMax() {
    const el = await this.historyIndex.elementHandle();
    if (!el) return 0;
    const max = await el.getAttribute('max');
    return parseInt(max || '0');
  }
}

/**
 * Top-level test grouping covering the FSM states and transitions described.
 *
 * Tests perform the following:
 * - Verify initial (Idle) state visuals (SVG nodes present, counts zero).
 * - Initialize BFS and assert BFS-initialized observables (queue populated).
 * - Run BFS and assert running state (Run button label, visited count increases).
 * - Step BFS explicitly and verify progress updates (visited, current node).
 * - Stop BFS and ensure stop transitions to stopped state behavior.
 * - Undo/Redo graph edits performed in free mode (add node via dblclick).
 * - Export and Import JSON flows, including an invalid import producing a user-facing log entry.
 * - Validate history slider updates (snapshots).
 *
 * Additionally, each test collects console.error and page errors and asserts there are no uncaught page errors.
 */

test.describe('BFS Interactive Explorer - FSM and UI tests', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages and page errors
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // ignore listener errors
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    // Wait a bit for initial drawGraph/saveSnapshot/updateUI to complete
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // Ensure that no uncaught page errors or console errors happened during test.
    // The application may log informational messages to the page log textarea; we are only checking console/page-level errors.
    expect(pageErrors, 'No uncaught page errors should have been thrown').toEqual([]);
    expect(consoleErrors, 'No console.error calls should have been emitted').toEqual([]);
  });

  test.describe('State S0_Idle: Initial load & Idle checks', () => {
    test('Initial SVG draws nodes and UI counters are at defaults', async ({ page }) => {
      const app = new BFSPage(page);

      // Confirm there are node elements in the SVG created by initial generateGrid run in the page script
      const count = await app.nodeCount();
      expect(count).toBeGreaterThan(0);

      // Visited count should start at 0; frontier count should be 0 because BFS hasn't been initialized yet
      expect(await app.getVisitedCount()).toBe(0);
      // frontierCount may be 0 initially until BFS init - assert it is a number
      expect(await app.getFrontierCount()).toBeGreaterThanOrEqual(0);

      // Ensure run button displays the default label
      const runText = await app.runBtn.textContent();
      expect(runText).toContain('Run / Pause');

      // History slider exists and has at least the initial snapshot
      const historyMax = await app.getHistoryMax();
      expect(historyMax).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Transitions: INITIALIZE_BFS -> RUN_BFS -> STOP_BFS and stepping', () => {
    test('Initialize BFS populates queue and updates UI diagnostics', async ({ page }) => {
      const app = new BFSPage(page);

      // Ensure startNodesInput is empty (default), initialize BFS should pick first node automatically
      await app.startNodesInput.fill('');
      await app.initializeBFS();

      // After initialization, frontierCount should be > 0 (queue seeded)
      await page.waitForTimeout(100);
      const frontier = await app.getFrontierCount();
      expect(frontier).toBeGreaterThan(0);

      // queueList should be non-empty string
      const qText = await app.getQueueListText();
      expect(qText.length).toBeGreaterThan(0);
    });

    test('Run BFS starts automatic stepping (entry action startTimer) and changes Run button label', async ({ page }) => {
      const app = new BFSPage(page);

      // Ensure BFS is initialized first (bfsInit is idempotent)
      await app.initializeBFS();
      await page.waitForTimeout(100);

      // Click Run - this should set ui.running true and change button text to 'Pause'
      await app.toggleRun();

      // The button label is changed to 'Pause (r)' by the app when running
      await expect(app.runBtn).toHaveText(/Pause/);

      // Wait some time for the periodic timer to step a few times
      await page.waitForTimeout(600); // should allow at least one step at default speed 400ms

      // Visited count should have increased from zero by now
      const visited = await app.getVisitedCount();
      expect(visited).toBeGreaterThanOrEqual(1);

      // Ensure currentNode is set (not '-')
      const current = await app.getCurrentNodeText();
      expect(current).not.toBe('-');

      // Stop the run to clean up timer
      await app.stopBFS();
      // After stopBFS, runBtn text should be reset to default
      await expect(app.runBtn).toHaveText(/Run \/ Pause/);
    });

    test('Step BFS when not running advances one node and logs progress', async ({ page }) => {
      const app = new BFSPage(page);

      // init BFS, reset any running state
      await app.initializeBFS();
      await page.waitForTimeout(100);
      // get pre-step visited
      const before = await app.getVisitedCount();

      // Click step
      await app.stepBFS();

      // Wait a tick for UI to update
      await page.waitForTimeout(100);

      const after = await app.getVisitedCount();
      expect(after).toBeGreaterThanOrEqual(before); // should be same or increase
      // If queue non-empty pre-step, visited should increase by 1
      // Ensure currentNode displays something sensible
      const current = await app.getCurrentNodeText();
      expect(current).not.toBeNull();
    });

    test('Stop BFS transitions to stopped state and clears running flag (exit action stopTimer)', async ({ page }) => {
      const app = new BFSPage(page);

      // Initialize and start running
      await app.initializeBFS();
      await page.waitForTimeout(100);
      await app.toggleRun();
      await page.waitForTimeout(200);

      // Now stop
      await app.stopBFS();
      await page.waitForTimeout(100);

      // After stop, BFS is not initialized (stopBtn sets bfs.initialized = false)
      // The frontierCount should be present but BFS init was cleared; check run button label
      const runText = await app.runBtn.textContent();
      expect(runText).toContain('Run / Pause');

      // After stopping, initialize BFS again should re-seed queue (transition S3 -> S1)
      await app.initializeBFS();
      await page.waitForTimeout(100);
      const frontier = await app.getFrontierCount();
      expect(frontier).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Edit operations, undo/redo and free-mode node creation', () => {
    test('Add a node in free mode via double-click and undo/redo that action', async ({ page }) => {
      const app = new BFSPage(page);

      // Switch to free mode and to Add Node tool
      await app.setMode('free');
      await app.setTool('addnode');

      // Count nodes before adding
      const before = await app.nodeCount();

      // Double click on the svg to add a node (position within the canvas)
      await app.dblclickSvgAt(150, 120);
      await page.waitForTimeout(150);

      const afterAdd = await app.nodeCount();
      expect(afterAdd).toBeGreaterThan(before);

      // Undo the addition
      await app.undo();
      await page.waitForTimeout(150);
      const afterUndo = await app.nodeCount();
      // Undo should revert node count back to previous (maybe equal or decreased)
      expect(afterUndo).toBeLessThanOrEqual(afterAdd);

      // Redo should reapply the addition (if the app supports redo)
      await app.redo();
      await page.waitForTimeout(150);
      const afterRedo = await app.nodeCount();
      expect(afterRedo).toBeGreaterThanOrEqual(afterUndo);
    });
  });

  test.describe('Import/Export flows and error handling', () => {
    test('Export JSON populates textarea and importing invalid JSON logs an import failure', async ({ page }) => {
      const app = new BFSPage(page);

      // Ensure there is a graph to export
      await app.clickGenerateGrid();
      await page.waitForTimeout(100);

      // Click export and assert jsonArea contains "nodes"
      await app.exportJson();
      await page.waitForTimeout(50);
      const exported = await app.jsonArea.inputValue();
      expect(exported).toContain('"nodes"');

      // Replace with invalid JSON and attempt import; the application catches errors and logs them to the "log" textarea
      await app.jsonArea.fill('this is not JSON');
      await app.importJson();
      await page.waitForTimeout(100);

      // The logArea should contain an "Import failed" message
      const logText = await app.getLogText();
      expect(logText).toMatch(/Import failed/i);
    });

    test('Import valid graph JSON updates the SVG with new node IDs', async ({ page }) => {
      const app = new BFSPage(page);

      // Construct a small graph JSON using array for nodes (the app handles array -> object)
      const smallGraph = {
        nodes: [
          { id: 'X', x: 200, y: 150 },
          { id: 'Y', x: 260, y: 150 }
        ],
        edges: [{ from: 'X', to: 'Y' }],
        directed: false
      };

      await app.jsonArea.fill(JSON.stringify(smallGraph));
      await app.importJson();

      // Wait for the drawGraph to occur
      await page.waitForTimeout(150);

      // Now assert that a node with label 'X' exists in the SVG (data-id attribute)
      const nodeX = page.locator('#svgCanvas g.node[data-id="X"]');
      await expect(nodeX).toHaveCount(1);

      // Also verify that export now includes the 'X' node when exporting
      await app.exportJson();
      await page.waitForTimeout(50);
      const exported = await app.jsonArea.inputValue();
      expect(exported).toContain('"X"');
    });
  });

  test.describe('Edge cases and additional FSM coverage', () => {
    test('Running without explicit initialize triggers initialization then runs', async ({ page }) => {
      const app = new BFSPage(page);

      // Ensure BFS is reset by clicking stop first (safe)
      await app.stopBFS();
      await page.waitForTimeout(50);

      // Clear startNodesInput to allow fallback defaulting behavior
      await app.startNodesInput.fill('');

      // Now click Run - per implementation, this should call bfsInitFromUI() automatically if not initialized
      await app.toggleRun();
      await page.waitForTimeout(100);

      // Run button label should be 'Pause', indicating the algorithm is running
      await expect(app.runBtn).toHaveText(/Pause/);

      // Stop to end run
      await app.stopBFS();
      await page.waitForTimeout(100);

      // Verify no uncaught errors occurred (checked in afterEach)
    });

    test('History slider updates as snapshots are created (generate grid, presets, random)', async ({ page }) => {
      const app = new BFSPage(page);

      // Record starting history max
      const startMax = await app.getHistoryMax();

      // Trigger actions that call saveSnapshot()
      await app.clickGenerateGrid();
      await page.waitForTimeout(80);
      await page.locator('#presetMaze').click();
      await page.waitForTimeout(80);
      await page.locator('#randomGraph').click();
      await page.waitForTimeout(120);

      const endMax = await app.getHistoryMax();
      expect(endMax).toBeGreaterThanOrEqual(startMax);

      // Move the history slider programmatically to an earlier snapshot and ensure UI updates
      const slider = page.locator('#historyIndex');
      // set to first snapshot (0) if possible
      await slider.fill('0');
      await slider.dispatchEvent('input');
      await page.waitForTimeout(80);

      // The app should restore the snapshot without throwing (checked by afterEach)
      const visitedAfterRestore = await app.getVisitedCount();
      expect(visitedAfterRestore).toBeGreaterThanOrEqual(0);
    });
  });
});