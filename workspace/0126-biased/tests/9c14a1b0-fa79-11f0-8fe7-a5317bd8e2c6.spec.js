import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c14a1b0-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page Object for the A* demo page to encapsulate common interactions
class AStarPage {
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#gridCanvas');
    this.logArea = page.locator('#log');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for canvas to be ready
    await this.canvas.waitFor({ state: 'visible' });
    // give the app a moment to run its initialization and log message
    await this.page.waitForTimeout(150);
  }

  async getCanvasSize() {
    const width = await this.page.$eval('#gridCanvas', c => c.width);
    const height = await this.page.$eval('#gridCanvas', c => c.height);
    return { width, height };
  }

  async setInputValue(selector, value) {
    const el = this.page.locator(selector);
    await el.fill(String(value));
    // dispatch change so app processes it
    await el.dispatchEvent('change');
  }

  async setSelectValue(selector, value) {
    await this.page.selectOption(selector, value);
    // fire change event listener if present
    await this.page.locator(selector).dispatchEvent('change');
  }

  async clickButton(id, options) {
    await this.page.locator(id).click(options);
  }

  // click on canvas at grid cell coordinates (x,y) in cell units (not pixels)
  async canvasClickCell(cellX, cellY) {
    const box = await this.canvas.boundingBox();
    const cellSize = await this.page.$eval('#inpCellSize', el => parseInt(el.value, 10));
    const cx = box.x + (cellX + 0.5) * cellSize;
    const cy = box.y + (cellY + 0.5) * cellSize;
    await this.page.mouse.click(cx, cy);
    // give app time to update and push snapshot/redraw
    await this.page.waitForTimeout(50);
  }

  // click with modifiers (e.g., Alt or Control)
  async canvasClickCellWithModifiers(cellX, cellY, modifiers = []) {
    const box = await this.canvas.boundingBox();
    const cellSize = await this.page.$eval('#inpCellSize', el => parseInt(el.value, 10));
    const cx = box.x + (cellX + 0.5) * cellSize;
    const cy = box.y + (cellY + 0.5) * cellSize;
    await this.page.mouse.click(cx, cy, { modifiers });
    await this.page.waitForTimeout(50);
  }

  // compute stat text
  async getStat(id) {
    return this.page.locator(id).innerText();
  }

  async getLog() {
    return this.logArea.inputValue();
  }

  async clearLog() {
    await this.page.locator('#btnClearLog').click();
    await this.page.waitForTimeout(20);
  }

  async setFileInput(name, mimeType, content) {
    // Playwright accepts file descriptor object
    await this.page.setInputFiles('#fileLoad', {
      name,
      mimeType,
      buffer: Buffer.from(content),
    });
    // setInputFiles triggers change automatically in Playwright
    // give time for file reader to process
    await this.page.waitForTimeout(150);
  }
}

test.describe('A* Search Interactive Demo (FSM & UI)', () => {
  // capture pageerrors and console messages for assertions
  test.beforeEach(async ({ page }) => {
    // Ensure a fresh context for each test; listeners attached per test below where needed
  });

  test('S0_Idle - initial state: canvas initialized and ready', async ({ page }) => {
    // Validate initial Idle state and onEnter action (initGrid)
    const astar = new AStarPage(page);
    const errors = [];
    page.on('pageerror', e => errors.push(e));
    await astar.goto();

    // The initial log should mention readiness -> evidence that initialization ran
    const log = await astar.getLog();
    expect(log).toContain('A* demo ready');

    // Canvas size should equal inpCols * inpCellSize and inpRows * inpCellSize
    const cols = Number(await page.$eval('#inpCols', e => e.value));
    const rows = Number(await page.$eval('#inpRows', e => e.value));
    const cellSz = Number(await page.$eval('#inpCellSize', e => e.value));
    const canvasSize = await astar.getCanvasSize();
    expect(canvasSize.width).toBe(cols * cellSz);
    expect(canvasSize.height).toBe(rows * cellSz);

    // No unexpected page errors should have occurred on load
    expect(errors.length).toBe(0);
  });

  test('S1_GridEdited - change cols/rows/cellSize, brush mode change, painting & undo/redo', async ({ page }) => {
    // Validate transitions that produce "Grid Edited" state effects
    const astar = new AStarPage(page);
    await astar.goto();

    // Change cols -> canvas width should update
    await astar.setInputValue('#inpCols', '10');
    let sizeAfterCols = await astar.getCanvasSize();
    const cellSz = Number(await page.$eval('#inpCellSize', e => e.value));
    expect(sizeAfterCols.width).toBe(10 * cellSz);

    // Change rows -> canvas height update
    await astar.setInputValue('#inpRows', '8');
    let sizeAfterRows = await astar.getCanvasSize();
    expect(sizeAfterRows.height).toBe(8 * cellSz);

    // Change cell size -> canvas resized
    await astar.setInputValue('#inpCellSize', '12');
    let sizeAfterCell = await astar.getCanvasSize();
    const colsNow = Number(await page.$eval('#inpCols', e => e.value));
    const rowsNow = Number(await page.$eval('#inpRows', e => e.value));
    expect(sizeAfterCell.width).toBe(colsNow * 12);
    expect(sizeAfterCell.height).toBe(rowsNow * 12);

    // set brush mode to wall (default) and paint a single cell via canvas click
    await astar.setSelectValue('#brushMode', 'wall');
    // Ensure Undo is disabled before editing (initial history)
    const undoBtn = page.locator('#btnUndo');
    const redoBtn = page.locator('#btnRedo');
    // After many initial initGrid snapshots, undo might be enabled or disabled, but after making an edit it should become enabled
    await astar.canvasClickCell(1, 1);
    await page.waitForTimeout(50);
    // After painting, Undo should be enabled (not disabled)
    expect(await undoBtn.isDisabled()).toBe(false);

    // Undo the edit and ensure button state toggles
    await undoBtn.click();
    await page.waitForTimeout(50);
    // Undo may become disabled if back to initial snapshot
    // We assert that redo becomes enabled after undo
    expect(await redoBtn.isDisabled()).toBe(false);

    // Redo the undone edit
    await redoBtn.click();
    await page.waitForTimeout(50);
    // After redo, redo may be disabled again or remain accordingly, but ensure no errors
    // Just assert that undo remains available after redo
    expect(await undoBtn.isDisabled()).toBe(false);
  });

  test('S1_GridEdited - Randomize, Clear, Generate Maze buttons update grid and log messages', async ({ page }) => {
    const astar = new AStarPage(page);
    await astar.goto();

    // Randomize grid: should log "Randomized grid..."
    await astar.clickButton('#btnRandom');
    await page.waitForTimeout(80);
    let log = await astar.getLog();
    expect(log).toContain('Randomized grid');

    // Clear grid: logs "Grid cleared"
    await astar.clickButton('#btnClear');
    await page.waitForTimeout(80);
    log = await astar.getLog();
    expect(log).toContain('Grid cleared');

    // Generate maze: logs "Maze generated"
    await astar.clickButton('#btnMaze');
    await page.waitForTimeout(200);
    log = await astar.getLog();
    expect(log).toContain('Maze generated');
  });

  test('S2_AlgorithmRunning & S3_AlgorithmPaused & S4_AlgorithmStopped - initialize, run, pause, step, step back, stop', async ({ page }) => {
    const astar = new AStarPage(page);
    await astar.goto();

    // Place a start (Alt+click) and a goal (Ctrl+click)
    // Pick distinct cells
    await astar.canvasClickCellWithModifiers(0, 0, ['Alt']); // set start
    await astar.canvasClickCellWithModifiers(5, 3, ['Control']); // set goal

    // Initialize runner
    await astar.clickButton('#btnInit');
    await page.waitForTimeout(120);
    let log = await astar.getLog();
    expect(log).toContain('Runner initialized');

    // Run algorithm: start background stepping; wait for some expansions to occur
    await astar.clickButton('#btnRun');
    // Wait until statExpanded becomes > 0 or timeout
    await page.waitForFunction(() => {
      const e = document.getElementById('statExpanded');
      return Number(e.innerText) > 0;
    }, { timeout: 3000 });

    let expandedText = await astar.getStat('#statExpanded');
    expect(Number(expandedText)).toBeGreaterThanOrEqual(0); // ensure numeric

    // Pause the run
    await astar.clickButton('#btnPause');
    await page.waitForTimeout(80);
    log = await astar.getLog();
    expect(log).toContain('Run paused');

    // Step the algorithm (single expansion)
    const prevExpanded = Number(await astar.getStat('#statExpanded'));
    await astar.clickButton('#btnStep');
    await page.waitForTimeout(120);
    const afterStepExpanded = Number(await astar.getStat('#statExpanded'));
    expect(afterStepExpanded).toBeGreaterThanOrEqual(prevExpanded);

    // Step back (visual snapshot)
    await astar.clickButton('#btnStepBack');
    await page.waitForTimeout(80);
    log = await astar.getLog();
    expect(log).toContain('Stepped back');

    // Now Stop -> should clear runner and reset stats
    await astar.clickButton('#btnStop');
    await page.waitForTimeout(120);
    log = await astar.getLog();
    expect(log).toContain('Run stopped and cleared');

    // After Stop the stats should reset to zeros
    expect(await astar.getStat('#statExpanded')).toBe('0');
    expect(await astar.getStat('#statOpen')).toBe('0');
    expect(await astar.getStat('#statClosed')).toBe('0');
  });

  test('S1_GridEdited - Save JSON, Load JSON (valid and invalid) and Export PNG', async ({ page }) => {
    const astar = new AStarPage(page);
    await astar.goto();

    // Save Grid JSON: clicking should trigger a synthetic download and log 'Saved grid JSON'
    await astar.clickButton('#btnSaveJSON');
    await page.waitForTimeout(80);
    let log = await astar.getLog();
    expect(log).toContain('Saved grid JSON');

    // Prepare a small valid grid JSON and load it via file input
    const validGrid = {
      cols: 5,
      rows: 5,
      cellSize: 12,
      grid: Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => ({ wall: false, weight: 1, start: false, goal: false })))
    };
    await astar.setFileInput('grid.json', 'application/json', JSON.stringify(validGrid));
    // The app logs 'Loaded grid JSON' on success
    log = await astar.getLog();
    expect(log).toContain('Loaded grid JSON');

    // Now provide invalid JSON to trigger parse error and logged message
    await astar.setFileInput('bad.json', 'application/json', 'not a json');
    // error parsing triggers a log like 'Error parsing JSON: ...'
    await page.waitForTimeout(150);
    log = await astar.getLog();
    expect(log).toMatch(/Error parsing JSON|Invalid JSON file/);

    // Export PNG should log 'Exported PNG'
    await astar.clickButton('#btnExportImage');
    await page.waitForTimeout(120);
    log = await astar.getLog();
    expect(log).toContain('Exported PNG');
  });

  test('Dynamic obstacles toggle and smooth path button behavior (edge/visual cases)', async ({ page }) => {
    const astar = new AStarPage(page);
    await astar.goto();

    // Place start and goal then initialize and run a few steps
    await astar.canvasClickCellWithModifiers(0, 0, ['Alt']);
    await astar.canvasClickCellWithModifiers(6, 4, ['Control']);
    await astar.clickButton('#btnInit');
    await page.waitForTimeout(120);
    await astar.clickButton('#btnStep');
    await page.waitForTimeout(120);

    // Toggle dynamic obstacles on; this sets an interval that may re-init runner and redraw
    await page.locator('#dynamicObs').check();
    await page.waitForTimeout(300); // let at least one dynamic update happen
    // Toggle off
    await page.locator('#dynamicObs').uncheck();
    await page.waitForTimeout(80);
    // no explicit assertion except no crash; check log exists
    const log = await astar.getLog();
    expect(log.length).toBeGreaterThan(0);

    // Try smoothing when a path may or may not exist; the app logs 'No path to smooth' or 'Path smoothed'
    await astar.clickButton('#btnSmooth');
    await page.waitForTimeout(100);
    const smoothLog = await astar.getLog();
    expect(smoothLog).toMatch(/No path to smooth|Path smoothed/);
  });

  test('Error scenario: Copy Log (btnSaveLog) may trigger TypeError in environments without clipboard', async ({ page }) => {
    // This test intentionally triggers the btnSaveLog handler which calls navigator.clipboard?.writeText(...).then(...)
    // In some headless environments navigator.clipboard is undefined and then() is invoked on undefined -> TypeError.
    // We observe pageerror and assert that such an error occurs naturally (per instructions).
    const astar = new AStarPage(page);
    await astar.goto();

    // Ensure there is some content in the log
    await astar.clearLog();
    await page.evaluate(() => {
      const ta = document.getElementById('log');
      ta.value = 'test-log-content\n' + (ta.value || '');
    });

    // Listen for the first pageerror event
    const pageErrorPromise = page.waitForEvent('pageerror', { timeout: 3000 }).catch(e => null);

    // Click the button that attempts to use navigator.clipboard
    await astar.clickButton('#btnSaveLog');

    // Wait a bit and see if a pageerror fired
    const err = await pageErrorPromise;
    // There are two possibilities:
    // - In some browser contexts clipboard exists -> no pageerror; in that case assert that log contains 'Log copied to clipboard' or 'Failed to copy log'
    // - In contexts where clipboard does not exist, a TypeError is likely thrown -> err will be non-null
    if (err) {
      // We expect a TypeError to be one of the plausible natural errors
      expect(err).toBeTruthy();
      // Basic sanity: message should include 'TypeError' or 'undefined'
      expect(String(err.message)).toMatch(/TypeError|undefined|cannot|not/);
    } else {
      // No pageerror thrown; confirm one of the expected log entries exist instead
      const log = await astar.getLog();
      expect(log).toMatch(/Log copied to clipboard|Failed to copy log/);
    }
  });

  test('Keyboard shortcuts and heuristic custom display toggle (small UI interactions)', async ({ page }) => {
    const astar = new AStarPage(page);
    await astar.goto();

    // Press 's' -> brushMode should be 'start'
    await page.keyboard.press('s');
    await page.waitForTimeout(30);
    let brush = await page.$eval('#brushMode', el => el.value);
    expect(brush).toBe('start');

    // Press 'g' -> brushMode 'goal'
    await page.keyboard.press('g');
    await page.waitForTimeout(30);
    brush = await page.$eval('#brushMode', el => el.value);
    expect(brush).toBe('goal');

    // Switch heuristic to custom -> customHeuristic input shows
    await astar.setSelectValue('#heuristic', 'custom');
    const visible = await page.$eval('#customHeuristic', el => getComputedStyle(el).display !== 'none');
    expect(visible).toBe(true);
    // Restore heuristic to manhattan
    await astar.setSelectValue('#heuristic', 'manhattan');
    const hidden = await page.$eval('#customHeuristic', el => getComputedStyle(el).display === 'none');
    expect(hidden).toBe(true);
  });

  test('Edge-case: Changing cell size outside min/max clamps the value', async ({ page }) => {
    const astar = new AStarPage(page);
    await astar.goto();

    // set a too-small cell size and dispatch change; the app clamps it to min (6)
    await page.fill('#inpCellSize', '1');
    await page.locator('#inpCellSize').dispatchEvent('change');
    await page.waitForTimeout(60);
    const clamped = await page.$eval('#inpCellSize', el => el.value);
    expect(Number(clamped)).toBeGreaterThanOrEqual(6);

    // set a too-large cell size and dispatch change; should clamp to max 64
    await page.fill('#inpCellSize', '9999');
    await page.locator('#inpCellSize').dispatchEvent('change');
    await page.waitForTimeout(60);
    const clampedHigh = await page.$eval('#inpCellSize', el => el.value);
    expect(Number(clampedHigh)).toBeLessThanOrEqual(64);
  });
});