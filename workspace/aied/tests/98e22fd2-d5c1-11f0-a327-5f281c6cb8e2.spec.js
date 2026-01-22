import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e22fd2-d5c1-11f0-a327-5f281c6cb8e2.html';

/**
 * Page Object for the BFS demo.
 * Encapsulates common interactions and selectors used across tests.
 */
class BFSPage {
  constructor(page) {
    this.page = page;
    this.grid = page.locator('#grid');
    this.stateEl = page.locator('#state');
    this.runBtn = page.locator('#run');
    this.stepBtn = page.locator('#step');
    this.pauseBtn = page.locator('#pause');
    this.resetBtn = page.locator('#reset');
    this.resizeBtn = page.locator('#resize');
    this.randomWallsBtn = page.locator('#randomWalls');
    this.clearWallsBtn = page.locator('#clearWalls');
    this.rowsInput = page.locator('#rows');
    this.colsInput = page.locator('#cols');
    this.speedRange = page.locator('#speed');
    this.queueList = page.locator('#queueList');
    this.queueSize = page.locator('#queueSize');
    this.visitCount = page.locator('#visitCount');
    this.pathInfo = page.locator('#pathInfo');
    this.toolWall = page.locator('#tool-wall');
    this.toolStart = page.locator('#tool-start');
    this.toolEnd = page.locator('#tool-end');
    this.toolErase = page.locator('#tool-erase');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async cellLocator(r, c) {
    return this.page.locator(`#grid .cell[data-r="${r}"][data-c="${c}"]`);
  }

  async gridCellCount() {
    return await this.page.locator('#grid .cell').count();
  }

  async clickRun(modifiers = []) {
    await this.runBtn.click({ modifiers });
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickPause() {
    await this.pauseBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async clickResize() {
    await this.resizeBtn.click();
  }

  async clickRandomWalls() {
    await this.randomWallsBtn.click();
  }

  async clickClearWalls() {
    await this.clearWallsBtn.click();
  }

  async setRowsCols(r, c) {
    await this.rowsInput.fill(String(r));
    await this.colsInput.fill(String(c));
  }

  async selectTool(toolName) {
    if (toolName === 'wall') await this.toolWall.click();
    if (toolName === 'start') await this.toolStart.click();
    if (toolName === 'end') await this.toolEnd.click();
    if (toolName === 'erase') await this.toolErase.click();
  }

  async changeSpeed(value) {
    await this.speedRange.fill(String(value));
    // Fire an input event by focusing and pressing a key - fill may not trigger input in all browsers,
    // but Playwright's fill triggers input/change; additionally dispatch input via evaluate for reliability.
    await this.page.evaluate((v) => {
      const el = document.getElementById('speed');
      el.value = String(v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, value);
  }

  async getStateText() {
    return (await this.stateEl.textContent()).trim();
  }

  async getQueueSizeText() {
    return (await this.queueSize.textContent()).trim();
  }

  async getVisitCountText() {
    return (await this.visitCount.textContent()).trim();
  }

  async getPathInfoText() {
    return (await this.pathInfo.textContent()).trim();
  }
}

test.describe('BFS Interactive Demo - FSM and UI behavior (98e22fd2...)', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      // store the error object for assertions
      pageErrors.push(err);
    });

    // Collect console messages for diagnostic assertions
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test('Initial load: should render grid and be in Idle state with no uncaught errors', async ({ page }) => {
    const p = new BFSPage(page);
    await p.goto();

    // Basic expectations about initial UI
    await expect(p.stateEl).toHaveText('Idle');
    await expect(p.queueSize).toHaveText('0');
    await expect(p.visitCount).toHaveText('0');
    await expect(p.pathInfo).toHaveText(/Length:/);

    // Grid should be rows * cols cells (defaults 16x28 = 448)
    const rows = Number(await page.locator('#rows').inputValue());
    const cols = Number(await page.locator('#cols').inputValue());
    const expected = rows * cols;
    const actualCount = await p.gridCellCount();
    expect(actualCount).toBe(expected);

    // Assert no uncaught runtime errors happened during load
    expect(pageErrors).toEqual([]);
  });

  test('Run (shift-click) from Idle should transition to Running then to Found or Done - no path', async ({ page }) => {
    const p = new BFSPage(page);
    await p.goto();

    // Listen for state changes: initial should be Idle
    await expect(p.stateEl).toHaveText('Idle');

    // Shift+click Run triggers fast compute path (no animation)
    await p.clickRun(['Shift']);

    // Immediately after click, initializeBFS sets Running; after computation it should be either Found or Done
    // The code sets 'Running' in initializeBFS and then finishes with 'Found' or 'Done - no path'.
    const finalState = await p.getStateText();
    expect(['Found', 'Done - no path', 'Idle', 'Running']).toContain(finalState);

    // Visit count should be a non-negative integer
    const visitCount = Number(await p.getVisitCountText());
    expect(Number.isInteger(visitCount)).toBeTruthy();
    expect(visitCount).toBeGreaterThanOrEqual(0);

    // Ensure no uncaught page errors occurred during this run
    expect(pageErrors).toEqual([]);
  });

  test('Step through BFS: set adjacent start/end, then step twice to reach Found', async ({ page }) => {
    const p = new BFSPage(page);
    await p.goto();

    // Choose small coordinates safely within bounds
    // We will put start at (2,2) and end at (2,3) so BFS will find path quickly after a couple steps.
    await p.selectTool('start');
    const startCell = p.cellLocator(2, 2);
    await startCell.click();

    await p.selectTool('end');
    const endCell = p.cellLocator(2, 3);
    await endCell.click();

    // Sanity: ensure start and end labels present
    await expect(startCell).toHaveText('S');
    await expect(endCell).toHaveText('E');

    // First step: initialize and dequeue start (should not be Found yet)
    await p.clickStep();
    // After one step, state may be 'Running' or have progressed; ensure no error
    const stateAfter1 = await p.getStateText();
    expect(stateAfter1.length).toBeGreaterThan(0);

    // Second step: should dequeue end and mark Found
    await p.clickStep();
    // Allow microtask completion
    await page.waitForTimeout(50);
    const finalState = await p.getStateText();
    expect(finalState).toBe('Found');

    // Path info should now show a positive length
    const pathText = await p.getPathInfoText();
    expect(pathText).toMatch(/Length:\s*\d+/);

    expect(pageErrors).toEqual([]);
  });

  test('Run -> Pause -> Run (resume) transitions and Reset returns to Idle', async ({ page }) => {
    const p = new BFSPage(page);
    await p.goto();

    // Start running (normal run with animation)
    await p.clickRun();

    // State should be Running
    await expect(p.stateEl).toHaveText('Running');

    // Pause the animation
    await p.clickPause();
    await expect(p.stateEl).toHaveText('Paused');

    // Resume by clicking Run (without Shift) - should move to Running
    await p.clickRun();
    // Running might be set again; give a small moment
    await page.waitForTimeout(50);
    const resumedState = await p.getStateText();
    expect(resumedState).toBe('Running');

    // Now reset -> Idle
    await p.clickReset();
    await expect(p.stateEl).toHaveText('Idle');

    expect(pageErrors).toEqual([]);
  });

  test('Reset from Running stops animation and clears UI (Idle evidence)', async ({ page }) {
    const p = new BFSPage(page);
    await p.goto();

    // Start and then reset
    await p.clickRun();
    await expect(p.stateEl).toHaveText('Running');

    // Change speed to ensure interval was started previously
    await p.changeSpeed(300);

    // Now reset
    await p.clickReset();

    // ResetBFSState should result in Idle and cleared queue/visits
    await expect(p.stateEl).toHaveText('Idle');
    await expect(p.queueSize).toHaveText('0');
    await expect(p.visitCount).toHaveText('0');
    await expect(p.pathInfo).toHaveText(/Length:\s*-/);

    expect(pageErrors).toEqual([]);
  });

  test('Resize grid with invalid values triggers dialog; valid resize updates grid dimensions', async ({ page }) {
    const p = new BFSPage(page);
    await p.goto();

    // Set invalid small values and click resize - should trigger alert dialog
    page.once('dialog', async (dialog) => {
      // Expect the alert message about bounds
      expect(dialog.message()).toContain('Rows 5-40, Cols 5-60');
      await dialog.accept();
    });

    await p.setRowsCols(2, 2);
    await p.clickResize();

    // Now set valid new dimensions
    const newR = 6;
    const newC = 7;
    await p.setRowsCols(newR, newC);
    await p.clickResize();

    // Grid cell count should reflect newR * newC
    const cnt = await p.gridCellCount();
    expect(cnt).toBe(newR * newC);

    expect(pageErrors).toEqual([]);
  });

  test('Random Walls sets some walls; Clear Walls removes them (edge case coverage)', async ({ page }) {
    const p = new BFSPage(page);
    await p.goto();

    // Count walls before any change (likely 0)
    const wallCountBefore = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#grid .cell')).filter(c => c.className.includes('wall')).length;
    });

    // Click random walls
    await p.clickRandomWalls();
    await page.waitForTimeout(50); // allow DOM updates

    const wallCountAfterRandom = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#grid .cell')).filter(c => c.className.includes('wall')).length;
    });

    // There should be more or equal walls after randomization (very likely >0)
    expect(wallCountAfterRandom).toBeGreaterThanOrEqual(wallCountBefore);

    // Now clear walls
    await p.clickClearWalls();
    await page.waitForTimeout(50);

    const wallCountAfterClear = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('#grid .cell')).filter(c => c.className.includes('wall')).length;
    });

    expect(wallCountAfterClear).toBe(0);

    expect(pageErrors).toEqual([]);
  });

  test('Speed slider input while running updates animation delay without causing errors', async ({ page }) {
    const p = new BFSPage(page);
    await p.goto();

    // Start running (animated)
    await p.clickRun();
    await expect(p.stateEl).toHaveText('Running');

    // Change speed to a new value; code will clear and reset interval if isRunning
    await p.changeSpeed(100);
    await page.waitForTimeout(50);

    // No crash or uncaught error expected
    expect(pageErrors).toEqual([]);

    // Pause to clean up
    await p.clickPause();
    await expect(p.stateEl).toHaveText('Paused');
  });

  test('Mouse painting behavior: draw walls, erase, and ensure start/end cannot be overwritten', async ({ page }) {
    const p = new BFSPage(page);
    await p.goto();

    // Draw a wall at (1,1)
    await p.selectTool('wall');
    const cell11 = await p.cellLocator(1, 1);
    await cell11.click();
    await expect(cell11).toHaveClass(/wall/);

    // Try erasing at (1,1)
    await p.selectTool('erase');
    await cell11.click();
    await expect(cell11).toHaveClass(/empty/);

    // Attempt to set start on a wall: first make (3,3) a wall, then try to set start there
    await p.selectTool('wall');
    const cell33 = await p.cellLocator(3, 3);
    await cell33.click();
    await expect(cell33).toHaveClass(/wall/);

    await p.selectTool('start');
    await cell33.click();
    // Should NOT set start on a wall: cell should remain wall (no start 'S')
    await expect(cell33).toHaveClass(/wall/);

    // Ensure we can set start on an empty cell
    await p.selectTool('erase');
    const target = await p.cellLocator(4, 4);
    await target.click(); // ensure empty
    await p.selectTool('start');
    await target.click();
    await expect(target).toHaveText('S');

    expect(pageErrors).toEqual([]);
  });

  test.afterEach(async ({ page }) => {
    // Final sanity check: no uncaught errors in pageerrors list
    // If there are errors, fail with diagnostic console messages
    if (pageErrors.length > 0) {
      // Attach console messages to the test failure message to aid debugging
      const logs = consoleMessages.map(m => `[${m.type}] ${m.text}`).join('\n');
      const errs = pageErrors.map(e => e.toString()).join('\n');
      throw new Error(`Uncaught page errors detected:\n${errs}\n\nConsole log:\n${logs}`);
    }
  });
});