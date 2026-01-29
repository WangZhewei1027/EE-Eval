import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d72240-fa73-11f0-83e0-8d7be1d51901.html';

// Page Object for BFS app interactions
class BFSPage {
  constructor(page) {
    this.page = page;
  }

  // Click controls
  async clickStart() { await this.page.click('#startBtn'); }
  async clickStep() { await this.page.click('#stepBtn'); }
  async clickPause() { await this.page.click('#pauseBtn'); }
  async clickReset() { await this.page.click('#resetBtn'); }
  async clickMode(mode) {
    // mode: 'wall'|'start'|'target'
    const selector = mode === 'wall' ? '#modeWall' : mode === 'start' ? '#modeStart' : '#modeTarget';
    await this.page.click(selector);
  }
  async clickRandomWalls() { await this.page.click('#randomWalls'); }
  async clickClearWalls() { await this.page.click('#clearWalls'); }
  async clickResize() { await this.page.click('#resize'); }

  // Set speed slider (value)
  async setSpeed(value) {
    await this.page.fill('#speed', String(value));
    // dispatch input event to update internal speed variable
    await this.page.dispatchEvent('#speed', 'input', { target: { value: String(value) } });
  }

  // Resize grid using selects then clicking resize
  async resizeGrid(cols, rows) {
    await this.page.selectOption('#cols', String(cols));
    await this.page.selectOption('#rows', String(rows));
    await this.clickResize();
  }

  // Get textual elements
  async getLastActionText() {
    return (await this.page.textContent('#lastAction'))?.trim();
  }
  async getVisitCountText() {
    return (await this.page.textContent('#visitCount'))?.trim();
  }
  async getLogText() {
    return (await this.page.textContent('#log')) ?? '';
  }
  async getQueueItems() {
    return this.page.$$eval('.queue-item', nodes => nodes.map(n => n.textContent?.trim()));
  }
  async isModeActive(mode) {
    const selector1 = mode === 'wall' ? '#modeWall' : mode === 'start' ? '#modeStart' : '#modeTarget';
    return this.page.$eval(selector, el => el.classList.contains('mode-active'));
  }

  // Canvas interactions: click specific cell coordinates (x,y) in grid cell space
  // cellX and cellY are zero-based cell indices.
  async clickCanvasCell(cellX, cellY) {
    const coords = await this.page.evaluate(({cellX, cellY}) => {
      const canvas = document.getElementById('grid');
      const rect = canvas.getBoundingClientRect();
      const cols = parseInt(document.getElementById('cols').value, 10);
      const rows = parseInt(document.getElementById('rows').value, 10);
      const clientX = rect.left + (cellX + 0.5) * rect.width / cols;
      const clientY = rect.top + (cellY + 0.5) * rect.height / rows;
      return { x: clientX, y: clientY, cols, rows, rectWidth: rect.width, rectHeight: rect.height };
    }, { cellX, cellY });

    // Move and click using mouse to trigger pointer events
    await this.page.mouse.move(coords.x, coords.y);
    await this.page.mouse.down();
    await this.page.mouse.up();
    // small pause to allow UI updates
    await this.page.waitForTimeout(50);
  }

  // Get canvas size (style width/height)
  async getCanvasSize() {
    return this.page.$eval('#grid', (c) => {
      return { cssWidth: c.style.width, cssHeight: c.style.height, offsetWidth: c.offsetWidth, offsetHeight: c.offsetHeight };
    });
  }

  // Get pause button text
  async getPauseBtnText() {
    return (await this.page.textContent('#pauseBtn'))?.trim();
  }

  // Press keyboard key
  async pressKey(key) {
    await this.page.keyboard.press(key);
  }
}

test.describe('BFS Visualization - FSM and interaction tests', () => {
  let pageErrors;
  let consoleErrors;
  let page;
  let bfs;

  test.beforeEach(async ({ browser }) => {
    pageErrors = [];
    consoleErrors = [];

    page = await browser.newPage();
    // capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
    // capture console errors / messages
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    bfs = new BFSPage(page);

    // Wait for initial log text to be added by the app
    await page.waitForFunction(() => {
      const el = document.getElementById('log');
      return el && el.textContent && el.textContent.length > 0;
    }, { timeout: 2000 });
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial Idle state: app loads and shows Ready state', async () => {
    // Validate initial UI elements reflect Idle state per FSM S0_Idle
    const last = await bfs.getLastActionText();
    expect(last).toBe('Ready');

    const visit = await bfs.getVisitCountText();
    expect(visit).toMatch(/^Visited:\s*0$/);

    // Default mode should be 'wall' and mode button should be active
    expect(await bfs.isModeActive('wall')).toBe(true);
    expect(await bfs.isModeActive('start')).toBe(false);
    expect(await bfs.isModeActive('target')).toBe(false);

    // The initial log should contain the Ready helper text
    const log = await bfs.getLogText();
    expect(log.toLowerCase()).toContain('click on the grid to add walls');

    // No runtime page errors should have occurred during load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Mode selection toggles mode-active class for Draw Walls / Set Start / Set Target', async () => {
    // Click Set Start
    await bfs.clickMode('start');
    expect(await bfs.isModeActive('start')).toBe(true);
    expect(await bfs.isModeActive('wall')).toBe(false);

    // Click Set Target
    await bfs.clickMode('target');
    expect(await bfs.isModeActive('target')).toBe(true);
    expect(await bfs.isModeActive('start')).toBe(false);

    // Click Draw Walls back
    await bfs.clickMode('wall');
    expect(await bfs.isModeActive('wall')).toBe(true);
    expect(await bfs.isModeActive('target')).toBe(false);
  });

  test('Set Start and Set Target by clicking canvas updates last action and log', async () => {
    // Choose cell coordinates away from border to set as start and target
    // Using 5,5 and 6,6 as sample coordinates (they will be clamped if needed)
    await bfs.clickMode('start');
    await bfs.clickCanvasCell(5, 5);
    // log should contain Start set
    const logAfterStart = await bfs.getLogText();
    expect(logAfterStart).toMatch(/Start set to \(\d+,\d+\)/);

    await bfs.clickMode('target');
    await bfs.clickCanvasCell(6, 6);
    const logAfterTarget = await bfs.getLogText();
    expect(logAfterTarget).toMatch(/Target set to \(\d+,\d+\)/);
  });

  test('Random Walls and Clear Walls buttons produce expected logs and update queue UI', async () => {
    // Generate random walls
    await bfs.clickRandomWalls();
    // Random walls action logs a message
    await page.waitForTimeout(100);
    let log1 = await bfs.getLogText();
    expect(log.toLowerCase()).toContain('random walls generated');

    // Ensure visit count cleared and queue empty after generating walls
    expect(await bfs.getVisitCountText()).toMatch(/^Visited:\s*0$/);
    expect(await bfs.getQueueItems()).toEqual([]);

    // Clear walls
    await bfs.clickClearWalls();
    await page.waitForTimeout(100);
    log = await bfs.getLogText();
    expect(log.toLowerCase()).toContain('all walls cleared');

    expect(await bfs.getVisitCountText()).toMatch(/^Visited:\s*0$/);
    expect(await bfs.getQueueItems()).toEqual([]);
  });

  test('Resize grid updates canvas size and logs resize message', async () => {
    // Pick smaller grid dimensions to force change
    await bfs.resizeGrid(30, 10);
    // Wait a bit for resize to complete and the log to include the message
    await page.waitForTimeout(150);
    const log2 = await bfs.getLogText();
    expect(log).toMatch(/Grid resized to 30 x 10/);

    const size = await bfs.getCanvasSize();
    // CSS width should be present and offsetWidth non-zero
    expect(size.cssWidth).toBeTruthy();
    expect(size.offsetWidth).toBeGreaterThan(0);
  });

  test('Step through BFS (S3_Step): Step button executes one BFS operation and pauses', async () => {
    // Ensure we have a fresh BFS generator by clicking Step
    await bfs.clickStep();

    // The app sets paused = true when stepping; pause button text becomes 'Resume'
    const pauseText = await bfs.getPauseBtnText();
    expect(pauseText).toBe('Resume');

    // After a single step, queueList should reflect at least empty or one item,
    // and visit count should be >= 0. We assert that the UI updated visit count text.
    const visitText = await bfs.getVisitCountText();
    expect(visitText).toMatch(/^Visited:\s*\d+$/);

    // The log should include an operation like ENQUEUE or DEQUEUE (logged in uppercase)
    const log3 = await bfs.getLogText();
    expect(/ENQUEUE|DEQUEUE|FOUND|BFS finished/i.test(log)).toBeTruthy();
  });

  test('Start (S1_Running) and Pause/Resume (S2_Paused) transitions: running updates queue and pause toggles', async () => {
    // Speed up the run to observe progress quickly
    await bfs.setSpeed(50);

    // Start the BFS run
    await bfs.clickStart();

    // Wait for BFS to produce some queue items (asynchronous)
    await page.waitForFunction(() => {
      const q = document.getElementById('queueList');
      return q && q.children.length > 0;
    }, { timeout: 3000 });

    // Confirm queue has items
    const items = await bfs.getQueueItems();
    expect(items.length).toBeGreaterThan(0);

    // Pause the run
    await bfs.clickPause();
    await page.waitForTimeout(50);
    expect(await bfs.getPauseBtnText()).toBe('Resume');

    // Resume the run by clicking pause again (toggle)
    await bfs.clickPause();
    await page.waitForTimeout(50);
    expect(await bfs.getPauseBtnText()).toBe('Pause');

    // Stop the run gracefully by clicking Reset
    await bfs.clickReset();
    // Reset writes a log line we can assert
    await page.waitForTimeout(50);
    const resetLog = await bfs.getLogText();
    expect(resetLog).toMatch(/Reset BFS state \(kept walls and start\/target\)\./i);
    // After reset, queue should be empty and visit count reset
    expect(await bfs.getQueueItems()).toEqual([]);
    expect(await bfs.getVisitCountText()).toMatch(/^Visited:\s*0$/);
  });

  test('Reset BFS (S4_Reset) while running stops the run and clears visitation', async () => {
    // Start a run
    await bfs.setSpeed(50);
    await bfs.clickStart();

    // wait some progress
    await page.waitForTimeout(200);
    // Ensure something happened
    const preResetItems = await bfs.getQueueItems();

    // Reset
    await bfs.clickReset();

    // After reset, the generator should be cleared and UI reset
    await page.waitForTimeout(50);
    expect(await bfs.getVisitCountText()).toMatch(/^Visited:\s*0$/);
    expect(await bfs.getQueueItems()).toEqual([]);
    expect(await bfs.getLastActionText()).toBe('Ready');

    // Ensure reset produced the expected log entry
    const log4 = await bfs.getLogText();
    expect(log.toLowerCase()).toContain('reset bfs state');
  });

  test('Edge cases: clicking Start while already running should be no-op and not produce errors', async () => {
    // Speed up, start
    await bfs.setSpeed(50);
    await bfs.clickStart();
    // Wait a bit
    await page.waitForTimeout(150);

    // Click Start again while running (should be gracefully ignored)
    await bfs.clickStart();
    await page.waitForTimeout(150);

    // No page errors should have been emitted
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Stop by Reset to clean up
    await bfs.clickReset();
  });

  test('Keyboard shortcuts: s,t,w to change modes; r and c to randomize/clear; space to start/pause', async () => {
    // s -> start mode
    await bfs.pressKey('s');
    expect(await bfs.isModeActive('start')).toBe(true);

    // t -> target
    await bfs.pressKey('t');
    expect(await bfs.isModeActive('target')).toBe(true);

    // w -> wall
    await bfs.pressKey('w');
    expect(await bfs.isModeActive('wall')).toBe(true);

    // r -> random walls (should create walls and log)
    await bfs.pressKey('r');
    await page.waitForTimeout(100);
    let log5 = await bfs.getLogText();
    expect(log.toLowerCase()).toContain('random walls generated');

    // c -> clear walls
    await bfs.pressKey('c');
    await page.waitForTimeout(100);
    log = await bfs.getLogText();
    expect(log.toLowerCase()).toContain('all walls cleared');

    // space -> start/pause toggle
    await bfs.setSpeed(50);
    await bfs.pressKey('Space'); // maps to ' ' in some environments; Playwright accepts 'Space'
    // Wait for something to enqueue
    await page.waitForFunction(() => {
      const q1 = document.getElementById('queueList');
      return q && q.children.length > 0;
    }, { timeout: 2000 });

    // Press space again to pause
    await bfs.pressKey('Space');
    await page.waitForTimeout(100);
    expect(await bfs.getPauseBtnText()).toBe('Resume');

    // Ensure no page errors generated during shortcut use
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Cleanup
    await bfs.clickReset();
  });

  test('No unexpected runtime errors observed across interactions', async () => {
    // Perform a sequence of interactions to try to surface runtime errors
    await bfs.clickMode('start');
    await bfs.clickCanvasCell(3, 3);
    await bfs.clickMode('target');
    await bfs.clickCanvasCell(8, 8);
    await bfs.clickMode('wall');
    await bfs.clickCanvasCell(4, 4); // draw wall
    await bfs.clickRandomWalls();
    await bfs.clickClearWalls();
    await bfs.resizeGrid(40, 15);
    await bfs.setSpeed(60);
    await bfs.clickStep();
    await bfs.clickStart();
    await page.waitForTimeout(200);
    await bfs.clickPause();
    await bfs.clickReset();

    // There should be no uncaught page errors and no console errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});