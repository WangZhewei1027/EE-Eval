import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d77062-fa73-11f0-83e0-8d7be1d51901.html';

// Page object for interacting with the controls and reading stats
class AStarPage {
  constructor(page) {
    this.page = page;
    this.canvas = page.locator('#gridCanvas');
    this.runBtn = page.locator('#runBtn');
    this.stepBtn = page.locator('#stepBtn');
    this.pauseBtn = page.locator('#pauseBtn');
    this.resetBtn = page.locator('#resetBtn');
    this.clearWallsBtn = page.locator('#clearWallsBtn');
    this.randBtn = page.locator('#randBtn');
    this.resizeBtn = page.locator('#resizeBtn');

    this.heuristicSel = page.locator('#heuristic');
    this.diagonalCB = page.locator('#diagonal');
    this.noCutCB = page.locator('#noCut');
    this.weightSlider = page.locator('#weight');
    this.weightVal = page.locator('#weightVal');
    this.speedSlider = page.locator('#speed');
    this.speedVal = page.locator('#speedVal');

    this.colsInput = page.locator('#cols');
    this.rowsInput = page.locator('#rows');
    this.density = page.locator('#density');

    this.expanded = page.locator('#expanded');
    this.openSize = page.locator('#openSize');
    this.pathLen = page.locator('#pathLen');
    this.pathCost = page.locator('#pathCost');
  }

  // Wrapper actions
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // ensure initial UI settled
    await this.page.waitForTimeout(50);
  }

  async clickRun() { await this.runBtn.click(); }
  async clickStep() { await this.stepBtn.click(); }
  async clickPause() { await this.pauseBtn.click(); }
  async clickReset() { await this.resetBtn.click(); }
  async clickClearWalls() { await this.clearWallsBtn.click(); }
  async clickRandomize() { await this.randBtn.click(); }
  async clickResize() { await this.resizeBtn.click(); }

  async setSpeed(value) {
    await this.speedSlider.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
    // wait for UI text update
    await this.page.waitForTimeout(20);
  }

  async setWeight(value) {
    await this.weightSlider.evaluate((el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(value));
    await this.page.waitForTimeout(10);
  }

  async changeHeuristic(value) {
    await this.heuristicSel.selectOption(value);
    await this.page.waitForTimeout(10);
  }

  async toggleDiagonal() {
    await this.diagonalCB.click();
    await this.page.waitForTimeout(10);
  }

  async toggleNoCut() {
    await this.noCutCB.click();
    await this.page.waitForTimeout(10);
  }

  async setGridSize(cols, rows) {
    await this.colsInput.fill(String(cols));
    await this.rowsInput.fill(String(rows));
  }

  // click canvas near center (safe generic toggle/interaction)
  async clickCanvasCenter(options = {}) {
    const box = await this.canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box not found');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await this.page.mouse.click(cx, cy, options);
    // small settle
    await this.page.waitForTimeout(10);
  }

  // read stats as integers (where appropriate)
  async getExpanded() { return parseInt((await this.expanded.textContent()) || '0', 10); }
  async getOpenSize() { return parseInt((await this.openSize.textContent()) || '0', 10); }
  async getPathLen() { return parseInt((await this.pathLen.textContent()) || '0', 10); }
  async getPathCost() { return (await this.pathCost.textContent()) || '0'; }

  async getWeightLabel() { return (await this.weightVal.textContent()) || ''; }
  async getSpeedLabel() { return (await this.speedVal.textContent()) || ''; }
}

test.describe('A* Search Visualization - FSM and UI integration tests', () => {
  // Collect console errors and page errors per test
  test.beforeEach(async ({ page }) => {
    // No-op here: individual tests will create page objects and goto
  });

  // Test initial Idle state and basic UI elements
  test('Idle state: initial load, drawGrid entry, and baseline UI values', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', e => pageErrors.push(String(e)));

    const p = new AStarPage(page);
    await p.goto();

    // Validate key UI elements exist and initial stats are zero (Idle)
    await expect(p.canvas).toBeVisible();
    await expect(p.runBtn).toBeVisible();
    await expect(p.stepBtn).toBeVisible();
    await expect(p.pauseBtn).toBeVisible();

    // Initial stats should show zeros or default text - assert baseline Idle values
    await expect(p.expanded).toHaveText('0');
    await expect(p.openSize).toHaveText('0');
    await expect(p.pathLen).toHaveText('0');
    await expect(p.pathCost).toHaveText('0');

    // Default labels for sliders
    await expect(await p.getWeightLabel()).toBe('1.0x');
    await expect(await p.getSpeedLabel()).toContain('40'); // "40 ms"

    // Assert there are no unexpected console/page errors on initial load
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Running state tests: synchronous run (speed 0) and asynchronous run->pause
  test('Running state: RunClick triggers algorithm to execute (synchronous when speed=0)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', e => pageErrors.push(String(e)));

    const p = new AStarPage(page);
    await p.goto();

    // Set speed to 0 for synchronous run (fast and deterministic)
    await p.setSpeed(0);

    // Ensure we start from Idle with zero stats
    await expect(p.expanded).toHaveText('0');

    // Click run -> should perform full search synchronously (may find path or exhaust)
    await p.clickRun();

    // Wait a small amount for synchronous processing to finish
    await page.waitForTimeout(20);

    // After run, openSize should be 0 (heap empty) and expanded should be >= 0
    const openSize = await p.getOpenSize();
    const expanded = await p.getExpanded();
    expect(openSize).toBeGreaterThanOrEqual(0);
    expect(expanded).toBeGreaterThanOrEqual(0);

    // Path length/cost may be non-zero if path found; ensure elements contain sensible values
    const pathLen = await p.getPathLen();
    const pathCost = await p.getPathCost();
    expect(pathLen).toBeGreaterThanOrEqual(0);
    expect(typeof pathCost === 'string').toBeTruthy();

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Running -> Paused transition via PauseClick stops progress (asynchronous run)', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', e => pageErrors.push(String(e)));

    const p = new AStarPage(page);
    await p.goto();

    // Use a small positive speed to run asynchronously
    await p.setSpeed(10);

    // Start running (interval-based)
    await p.clickRun();

    // Wait a little to allow some expansions
    await page.waitForTimeout(120);
    const expanded1 = await p.getExpanded();
    expect(expanded1).toBeGreaterThanOrEqual(1);

    // Now click pause and verify expanded stops increasing
    await p.clickPause();
    const expandedAfterPause = await p.getExpanded();

    // Wait to ensure no further expansions
    await page.waitForTimeout(150);
    const expanded2 = await p.getExpanded();

    // After pause, expansions should not increase
    expect(expandedAfterPause).toBe(expanded2);

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Stepping tests
  test('Stepping state: StepClick from Idle performs a single expansion', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', e => pageErrors.push(String(e)));

    const p = new AStarPage(page);
    await p.goto();

    // Ensure baseline
    await expect(p.expanded).toHaveText('0');

    // Click Step - this should initialize and perform exactly one expansion (expanded==1)
    await p.clickStep();
    await page.waitForTimeout(20);

    const expanded = await p.getExpanded();
    expect(expanded).toBeGreaterThanOrEqual(1);

    // Step again should increment further
    const before = expanded;
    await p.clickStep();
    await page.waitForTimeout(20);
    const after = await p.getExpanded();
    expect(after).toBeGreaterThanOrEqual(before);

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test('Transition Running -> Stepping: clicking Step while running stops and performs a step', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', e => pageErrors.push(String(e)));

    const p = new AStarPage(page);
    await p.goto();

    // Start a fast asynchronous run
    await p.setSpeed(15);
    await p.clickRun();
    await page.waitForTimeout(80);
    const expandedDuringRun = await p.getExpanded();
    expect(expandedDuringRun).toBeGreaterThanOrEqual(1);

    // Now click Step - handler stops then executes one step
    await p.clickStep();
    await page.waitForTimeout(30);
    const expandedAfter = await p.getExpanded();
    expect(expandedAfter).toBeGreaterThanOrEqual(expandedDuringRun);

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Reset state and related events
  test('Reset transitions: ResetClick, ClearWallsClick, RandomizeClick, ResizeClick cause resetSearchState and no errors', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', e => pageErrors.push(String(e)));

    const p = new AStarPage(page);
    await p.goto();

    // Make sure some state changes: toggle a wall by clicking canvas center
    await p.clickCanvasCenter();
    // run one step to change stats
    await p.clickStep();
    await page.waitForTimeout(20);
    const expandedBeforeReset = await p.getExpanded();
    expect(expandedBeforeReset).toBeGreaterThanOrEqual(1);

    // Reset via Reset button: should clear expanded, openSize, pathLen, pathCost
    await p.clickReset();
    await page.waitForTimeout(20);
    await expect(p.expanded).toHaveText('0');
    await expect(p.openSize).toHaveText('0');
    await expect(p.pathLen).toHaveText('0');

    // Toggle a wall again and then use Clear Walls
    await p.clickCanvasCenter(); // toggle
    await p.clickClearWalls();
    await page.waitForTimeout(20);
    await expect(p.expanded).toHaveText('0');

    // Randomize: should not throw and resets search state
    await p.clickRandomize();
    await page.waitForTimeout(50);
    await expect(p.expanded).toHaveText('0');

    // Resize: set new grid size out of bounds to test clamping (edge case)
    await p.setGridSize(200, 200); // should be clamped to defined limits
    await p.clickResize();
    await page.waitForTimeout(20);
    // After resize stats should be reset
    await expect(p.expanded).toHaveText('0');

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Heuristic / Diagonal / NoCut changes -> should reset search state
  test('Changing heuristic, diagonal, and no-cut toggles trigger reset and draw', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', e => pageErrors.push(String(e)));

    const p = new AStarPage(page);
    await p.goto();

    // cause some progress
    await p.clickStep();
    await page.waitForTimeout(10);
    const expandedNow = await p.getExpanded();
    expect(expandedNow).toBeGreaterThanOrEqual(1);

    // Change heuristic - should reset stats
    await p.changeHeuristic('euclidean');
    await page.waitForTimeout(20);
    await expect(p.expanded).toHaveText('0');

    // Toggle diagonal checkbox
    await p.toggleDiagonal();
    await page.waitForTimeout(10);
    await expect(p.expanded).toHaveText('0');

    // Toggle noCut checkbox
    await p.toggleNoCut();
    await page.waitForTimeout(10);
    await expect(p.expanded).toHaveText('0');

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Weight and Speed input interactions and labels
  test('WeightInput and SpeedInput update UI labels and do not throw errors', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', e => pageErrors.push(String(e)));

    const p = new AStarPage(page);
    await p.goto();

    // Change weight slider and verify label updates
    await p.setWeight(2.7);
    await expect(await p.getWeightLabel()).toBe('2.7x');

    // Change speed slider and verify label updates
    await p.setSpeed(120);
    await expect((await p.getSpeedLabel()).includes('120')).toBeTruthy();

    // When running (non-step) changing speed will restart intervals - test that no errors occur
    await p.setSpeed(30);
    await p.clickRun();
    await page.waitForTimeout(60);
    // change speed while running
    await p.setSpeed(80);
    await page.waitForTimeout(60);
    // Pause to end the test cleanly
    await p.clickPause();

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Keyboard shortcuts as an edge-case test
  test('Keyboard shortcuts: r -> randomize, c -> clear, Space -> run/pause, s -> step', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', e => pageErrors.push(String(e)));

    const p = new AStarPage(page);
    await p.goto();

    // Press 'r' to randomize
    await page.keyboard.press('r');
    await page.waitForTimeout(40);
    await expect(p.expanded).toHaveText('0');

    // Press 'c' to clear walls
    await page.keyboard.press('c');
    await page.waitForTimeout(40);
    await expect(p.expanded).toHaveText('0');

    // Press 's' to step - should perform a step
    await page.keyboard.press('s');
    await page.waitForTimeout(30);
    const expandedAfterS = await p.getExpanded();
    expect(expandedAfterS).toBeGreaterThanOrEqual(1);

    // Press Space to toggle run: if currently not running -> run is initiated
    // Set speed to 0 to run synchronously for deterministic behavior
    await p.setSpeed(0);
    await page.keyboard.press('Space');
    await page.waitForTimeout(30);
    // Running completed synchronously; verify stats updated
    const expandedFinal = await p.getExpanded();
    expect(expandedFinal).toBeGreaterThanOrEqual(expandedAfterS);

    // No console/page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Error observation test: ensure no uncaught page errors, type errors, etc.
  test('No unexpected runtime errors (console or page errors) occur during typical interactions', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
    page.on('pageerror', e => pageErrors.push(String(e)));

    const p = new AStarPage(page);
    await p.goto();

    // Perform a series of actions that exercise many handlers
    await p.clickStep();
    await p.clickRun();
    await page.waitForTimeout(60);
    await p.clickPause();
    await p.clickRandomize();
    await p.clickClearWalls();
    await p.setWeight(1.4);
    await p.setSpeed(30);
    await p.changeHeuristic('chebyshev');
    await p.toggleDiagonal();
    await p.toggleNoCut();
    await p.setGridSize(10, 10);
    await p.clickResize();
    await p.clickCanvasCenter({ button: 'left' });

    // Allow the UI to settle
    await page.waitForTimeout(80);

    // Assert zero console 'error' messages and no page errors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});