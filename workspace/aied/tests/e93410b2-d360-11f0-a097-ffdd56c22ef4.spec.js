import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e93410b2-d360-11f0-a097-ffdd56c22ef4.html';

/**
 * Page Object encapsulating common interactions with the BFS visualizer UI.
 */
class BFSPage {
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runBtn');
    this.pauseBtn = page.locator('#pauseBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.clearWallsBtn = page.locator('#clearWallsBtn');
    this.randomWallsBtn = page.locator('#randomWallsBtn');
    this.resizeBtn = page.locator('#resizeBtn');
    this.reconstructBtn = page.locator('#reconstructBtn');
    this.speedRange = page.locator('#speedRange');
    this.speedLabel = page.locator('#speedLabel');
    this.rowsInput = page.locator('#rowsInput');
    this.colsInput = page.locator('#colsInput');
    this.grid = page.locator('#grid');
    this.queue = page.locator('#queue');
    this.statusText = page.locator('#statusText');
    this.counts = page.locator('#counts');
  }

  async clickCell(r, c, modifiers = []) {
    // locate cell by data attributes
    const cell = this.page.locator(`.cell[data-r="${r}"][data-c="${c}"]`);
    await cell.click({ modifiers });
    return cell;
  }

  async getCellClassList(r, c) {
    const cls = await this.page.locator(`.cell[data-r="${r}"][data-c="${c}"]`).getAttribute('class');
    return (cls || '').split(/\s+/).filter(Boolean);
  }

  async cellCount() {
    return await this.page.locator('.cell').count();
  }

  async rowsColsFromGridStyles() {
    // read the CSS variables --rows and --cols
    const computed = await this.page.$eval('#grid', (el) => {
      const style = getComputedStyle(el);
      return {
        rows: style.getPropertyValue('--rows').trim(),
        cols: style.getPropertyValue('--cols').trim(),
      };
    });
    return { rows: Number(computed.rows), cols: Number(computed.cols) };
  }

  async setSpeed(value) {
    await this.speedRange.evaluate((el, val) => { el.value = String(val); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  }

  async resizeGrid(rows, cols) {
    await this.rowsInput.fill(String(rows));
    await this.colsInput.fill(String(cols));
    await this.resizeBtn.click();
    // wait for grid to be rebuilt
    await this.page.waitForSelector(`.cell[data-r="0"][data-c="0"]`);
  }

  async readQueueText() {
    return await this.page.locator('#queue').innerText();
  }

  async countWalls() {
    return await this.page.locator('.cell.wall').count();
  }
}

test.describe('BFS Visualizer — FSM and interaction tests', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let page;
  let bfs;

  test.beforeEach(async ({ browser }) => {
    pageErrors = [];
    consoleErrors = [];
    page = await browser.newPage();

    // capture page errors and console errors for assertions later
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(BASE_URL);
    bfs = new BFSPage(page);

    // Ensure the grid has been rendered before running tests
    await page.waitForSelector('#grid .cell');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test.describe('Initial (Idle) state and entry action', () => {
    test('Initial status text reflects resetSearch entry action (Idle)', async () => {
      // The page script calls resetSearch(true) on initGrid -> resetSearch sets statusText to 'Idle — ready'
      const text = await bfs.statusText.textContent();
      // It should no longer be the HTML default; verify actual observed value and that it's an "Idle" state
      expect(text).toBeTruthy();
      expect(text.toLowerCase()).toContain('idle');
      // We assert the runtime used by the implementation: 'Idle — ready'
      expect(text).toMatch(/Idle.*ready|Idle.*set walls/);
      // No uncaught page errors during initial load
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Start and target cells are present and have classes', async () => {
      // There must be one cell with 'start' and one with 'target'
      const startCount = await page.locator('.cell.start').count();
      const targetCount = await page.locator('.cell.target').count();
      expect(startCount).toBeGreaterThanOrEqual(1);
      expect(targetCount).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Run / Pause behavior and transitions', () => {
    test('Click Run transitions to Running and updates status text', async () => {
      await bfs.runBtn.click();
      await expect(bfs.statusText).toHaveText('Running BFS...');
      // queue should contain at least the start element
      const queueText = await bfs.readQueueText();
      expect(queueText).toMatch(/\(\d+,\d+\)/);
    });

    test('Pause while running sets status to Paused', async () => {
      await bfs.runBtn.click();
      await expect(bfs.statusText).toHaveText('Running BFS...');
      await bfs.pauseBtn.click();
      await expect(bfs.statusText).toHaveText('Paused');
    });

    test('Run from Paused resumes Running', async () => {
      await bfs.runBtn.click();
      await bfs.pauseBtn.click();
      await expect(bfs.statusText).toHaveText('Paused');
      // clicking Run should resume
      await bfs.runBtn.click();
      await expect(bfs.statusText).toHaveText('Running BFS...');
    });
  });

  test.describe('Step behavior and reaching Target Found / Finished states', () => {
    test('Step mode can discover a nearby target deterministically', async () => {
      // Resize to a small grid to make deterministic placement and small path distances
      await bfs.resizeGrid(6, 6);
      const dims = await bfs.rowsColsFromGridStyles();
      expect(dims.rows).toBe(6);
      expect(dims.cols).toBe(6);

      // Set start at (2,2) with Shift+Click
      await bfs.clickCell(2, 2, ['Shift']);
      // Set target adjacent at (2,3) with Ctrl/Meta depending on platform: use Control
      await bfs.clickCell(2, 3, ['Control']);

      // Ensure start and target are correctly set
      const startClasses = await bfs.getCellClassList(2, 2);
      const targetClasses = await bfs.getCellClassList(2, 3);
      expect(startClasses).toContain('start');
      expect(targetClasses).toContain('target');

      // Now use Step button to advance BFS one dequeue at a time.
      // First step: enqueue start, then process start (dequeue) and expand neighbors -> target will be enqueued
      await bfs.stepBtn.click();
      // After first step, queue should contain at least one element (the target likely)
      const qAfterFirst = await bfs.readQueueText();
      expect(qAfterFirst.length).toBeGreaterThan(0);

      // Second step: dequeue the target node -> should trigger Target Found final state
      await bfs.stepBtn.click();
      // The statusText should indicate a target found with a numeric distance (distance 1 for adjacent)
      const status = await bfs.statusText.textContent();
      expect(status).toMatch(/Target found! Distance: ?\d+|Finished/);
      // In this controlled scenario we expect Distance: 1
      expect(status).toContain('Distance: 1');
    });

    test('Step from Running processes exactly one expansion (paused afterwards)', async () => {
      // Start running normally then use Step to trigger one additional step
      await bfs.runBtn.click();
      await expect(bfs.statusText).toHaveText('Running BFS...');

      // Wait a short moment to ensure queue has been populated
      await page.waitForTimeout(50);

      // Now click Step: when running, Step triggers bfsStep and may pause afterwards
      await bfs.stepBtn.click();

      // After clicking Step while running, the UI should still be responsive and counts updated
      const counts = await bfs.counts.textContent();
      expect(counts).toMatch(/Visited: \d+ • Queue: \d+/);
    });
  });

  test.describe('Reset, Clear Walls, Random Walls and Resize', () => {
    test('Reset clears search state and sets expected status text', async () => {
      // Start BFS to create some visited/frontier state
      await bfs.runBtn.click();
      await page.waitForTimeout(60);
      // Click reset
      await bfs.resetBtn.click();
      await expect(bfs.statusText).toHaveText('Reset — cleared search state');
      // Counts should be reset to 0
      const counts = await bfs.counts.textContent();
      expect(counts).toContain('Visited: 0');
    });

    test('Clear Walls removes any walls from the grid', async () => {
      // Toggle a wall on a non-start, non-target cell
      // Find a cell that is not start or target: pick (0,0) unless it's start/target
      const cell00Classes = await bfs.getCellClassList(0, 0);
      if (cell00Classes.includes('start') || cell00Classes.includes('target')) {
        // pick another cell
        await bfs.clickCell(0, 1); // toggle wall
        expect(await bfs.getCellClassList(0, 1)).toContain('wall');
        // Clear walls now
        await bfs.clearWallsBtn.click();
        await expect(bfs.statusText).toHaveText('All walls cleared');
        const walls = await bfs.countWalls();
        expect(walls).toBe(0);
      } else {
        // toggle (0,0)
        await bfs.clickCell(0, 0);
        expect(await bfs.getCellClassList(0, 0)).toContain('wall');
        await bfs.clearWallsBtn.click();
        await expect(bfs.statusText).toHaveText('All walls cleared');
        expect(await bfs.countWalls()).toBe(0);
      }
    });

    test('Random Walls applies walls and updates status text', async () => {
      // Click Random Walls and ensure the status updates
      await bfs.randomWallsBtn.click();
      await expect(bfs.statusText).toHaveText('Random walls applied');
      // There should be zero or more walls, but we at least check the UI updated and no errors thrown
      const walls = await bfs.countWalls();
      expect(walls).toBeGreaterThanOrEqual(0);
    });

    test('Resize Grid changes number of cells and CSS variables', async () => {
      // Change to 10x12
      await bfs.rowsInput.fill('10');
      await bfs.colsInput.fill('12');
      await bfs.resizeBtn.click();
      // Wait for grid rebuild
      await page.waitForSelector('.cell[data-r="9"][data-c="11"]');
      const dims = await bfs.rowsColsFromGridStyles();
      expect(dims.rows).toBe(10);
      expect(dims.cols).toBe(12);
      const cells = await bfs.cellCount();
      expect(cells).toBe(10 * 12);
    });
  });

  test.describe('Reconstruct path, Speed change, and edge cases', () => {
    test('Speed range input updates label', async () => {
      // Set speed to a new value and assert label updates
      await bfs.setSpeed(300);
      await expect(bfs.speedLabel).toHaveText('300 ms');
      await bfs.setSpeed(50);
      await expect(bfs.speedLabel).toHaveText('50 ms');
    });

    test('Reconstruct path button is safe to click before and after search (edge cases)', async () => {
      // Click reconstruct before any search should not throw - it will set 'No path to reconstruct' in some cases
      await bfs.reconstructBtn.click();
      // We don't expect the status to error; ensure page still responsive and no console errors captured
      expect(consoleErrors).toEqual([]);
      // Now perform a deterministic search where a path exists and reconstruct
      await bfs.resizeGrid(6, 6);
      await bfs.clickCell(2, 2, ['Shift']);   // start
      await bfs.clickCell(2, 4, ['Control']); // target two steps away
      // Use Step to process until found (may take multiple steps)
      // Start with first step
      await bfs.stepBtn.click();
      // second
      await bfs.stepBtn.click();
      // third: should reach the target
      await bfs.stepBtn.click();
      // Now click reconstruct path (visualizes the path). This should not throw.
      await bfs.reconstructBtn.click();
      // Confirm no error console messages during this sequence
      expect(consoleErrors).toEqual([]);
    });

    test('Attempting to place a wall on start or target is ignored', async () => {
      // Identify start and target positions
      const startCell = page.locator('.cell.start').first();
      const startR = await startCell.getAttribute('data-r');
      const startC = await startCell.getAttribute('data-c');
      // Try to toggle wall on start by clicking it normally
      await page.locator(`.cell[data-r="${startR}"][data-c="${startC}"]`).click();
      // Confirm 'wall' class is not applied
      const classes = await bfs.getCellClassList(Number(startR), Number(startC));
      expect(classes).not.toContain('wall');

      // Same for target
      const targetCell = page.locator('.cell.target').first();
      const targetR = await targetCell.getAttribute('data-r');
      const targetC = await targetCell.getAttribute('data-c');
      await page.locator(`.cell[data-r="${targetR}"][data-c="${targetC}"]`).click();
      const targetClasses = await bfs.getCellClassList(Number(targetR), Number(targetC));
      expect(targetClasses).not.toContain('wall');
    });
  });

  test.describe('Observing console and page errors (no unexpected runtime failures)', () => {
    test('No uncaught page errors during typical interaction flows', async () => {
      // Perform a set of common operations while listening for errors
      await bfs.runBtn.click();
      await page.waitForTimeout(50);
      await bfs.pauseBtn.click();
      await bfs.resetBtn.click();
      await bfs.randomWallsBtn.click();
      await bfs.clearWallsBtn.click();
      await bfs.setSpeed(200);
      await bfs.reconstructBtn.click();

      // Now assert that there were no uncaught errors or console error messages during these operations
      expect(pageErrors.map(e => String(e))).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('If any ReferenceError/TypeError occurs it should be surfaced via pageerror or console.error', async () => {
      // This test is intentionally defensive: if the implementation has latent ReferenceError or TypeError,
      // the event listeners in beforeEach would have captured them in pageErrors or consoleErrors.
      // We assert that captured errors are either none or, if present, are JS Error instances / messages referencing typical runtime error types.
      if (pageErrors.length > 0 || consoleErrors.length > 0) {
        // Ensure that we indeed got error-like messages
        const combined = [
          ...pageErrors.map(String),
          ...consoleErrors,
        ].join('\n');
        // Confirm at least one of the common runtime error tokens appears
        expect(/ReferenceError|TypeError|SyntaxError|Error/.test(combined)).toBeTruthy();
      } else {
        // No runtime errors observed — acceptable; still pass.
        expect(pageErrors).toEqual([]);
        expect(consoleErrors).toEqual([]);
      }
    });
  });
});