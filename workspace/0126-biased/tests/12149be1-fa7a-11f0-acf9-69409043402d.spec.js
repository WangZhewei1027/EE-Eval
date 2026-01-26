import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12149be1-fa7a-11f0-acf9-69409043402d.html';

// A small page object to encapsulate repeated interactions with the demo page.
class AStarPage {
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and page errors for assertions and debugging.
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the logs textarea to be present and the initial welcome messages to appear.
    await this.page.waitForSelector('#logs');
    await this.waitForLogContains('Welcome to the A* Search interactive demo.');
  }

  async setGridSize(cols, rows) {
    await this.page.fill('#gridwidth', String(cols));
    await this.page.fill('#gridheight', String(rows));
  }

  async clickGenerateGrid() {
    await this.page.click('#generategrid');
  }

  async waitForLogContains(text, timeout = 2000) {
    await this.page.waitForFunction(
      (selector, expected) => {
        const el = document.querySelector(selector);
        return el && el.value.includes(expected);
      },
      '#logs',
      text,
      { timeout }
    );
  }

  async getLogs() {
    return await this.page.$eval('#logs', (el) => el.value);
  }

  async setPlaceMode(modeValue) {
    await this.page.selectOption('#placemode', modeValue);
    // The page logs the placement mode change on change event.
    await this.waitForLogContains(`Placement mode changed to: ${modeValue}`);
  }

  // Click the table cell at (r,c)
  async clickCell(r, c) {
    const selector = `#gridcontainer td[data-r="${r}"][data-c="${c}"]`;
    await this.page.waitForSelector(selector);
    await this.page.click(selector);
  }

  async getCellClass(r, c) {
    const selector = `#gridcontainer td[data-r="${r}"][data-c="${c}"]`;
    await this.page.waitForSelector(selector);
    return await this.page.$eval(selector, (td) => td.className);
  }

  async clickButton(selector) {
    await this.page.click(selector);
  }

  async setDiagMove(checked) {
    const current = await this.page.$eval('#diagmovechk', (el) => el.checked);
    if (current !== checked) {
      await this.page.click('#diagmovechk');
      // Wait for log entry about diagonal movement toggle
      await this.waitForLogContains(checked ? 'Diagonal movement enabled' : 'Diagonal movement disabled');
    }
  }

  async setHeuristic(value) {
    await this.page.selectOption('#heuristicselect', value);
    await this.waitForLogContains(`Heuristic changed to: ${value}`);
  }

  async setStepDelay(ms) {
    await this.page.fill('#stepdelay', String(ms));
    // trigger change handler
    await this.page.$eval('#stepdelay', (el) => el.dispatchEvent(new Event('change')));
    await this.waitForLogContains(`Step delay set to: ${ms} ms`);
  }

  async getTableDimensions() {
    await this.page.waitForSelector('#gridcontainer table');
    const rows = await this.page.$$eval('#gridcontainer table tr', (trs) => trs.length);
    const cols = await this.page.$$eval('#gridcontainer table tr:first-child td', (tds) => tds.length);
    return { rows, cols };
  }
}

test.describe('A* Search Interactive Demo - FSM and UI tests', () => {
  let astar;

  test.beforeEach(async ({ page }) => {
    astar = new AStarPage(page);
    await astar.goto();
  });

  test('Initial load: welcome logs and initial control states', async ({ page }) => {
    // Validate welcome messages exist and initial buttons are disabled per Idle state
    const logs = await astar.getLogs();
    expect(logs).toContain('Welcome to the A* Search interactive demo.');
    expect(await page.isEnabled('#generategrid')).toBeTruthy();
    // Start/Step/Run/Pause/Reset search should be disabled at initial Idle state
    expect(await page.getAttribute('#startsearch', 'disabled')).not.toBeNull();
    expect(await page.getAttribute('#stepsearch', 'disabled')).not.toBeNull();
    expect(await page.getAttribute('#runsearch', 'disabled')).not.toBeNull();
    expect(await page.getAttribute('#pausesearch', 'disabled')).not.toBeNull();
    expect(await page.getAttribute('#resetsearch', 'disabled')).not.toBeNull();
  });

  test.describe('Grid generation and controls', () => {
    test('Generate grid creates expected table dimensions and logs', async ({ page }) => {
      // Set a smaller grid and generate
      await astar.setGridSize(6, 5);
      await astar.clickGenerateGrid();

      // Verify log entry about grid generation (transition S0_Idle -> S1_GridGenerated)
      await astar.waitForLogContains('Generated grid 5 rows x 6 cols.');

      // Verify table dimensions match (rows x cols)
      const dims = await astar.getTableDimensions();
      expect(dims.rows).toBe(5);
      expect(dims.cols).toBe(6);
    });

    test('Invalid grid dimensions trigger alert dialog (edge case)', async ({ page }) => {
      // Try to generate an invalid grid size (< 5)
      await page.fill('#gridwidth', '2');
      await page.fill('#gridheight', '3');

      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#generategrid'),
      ]);
      expect(dialog.message()).toContain('Grid size must be between 5 and 50.');
      await dialog.dismiss();

      // Confirm no new grid generated log
      const logs = await astar.getLogs();
      expect(logs).not.toContain('Generated grid 3 rows x 2 cols.');
    });
  });

  test.describe('Placement modes, walls, and clearing operations', () => {
    test('Set start and end points, toggle a wall, clear walls, and clear path', async ({ page }) => {
      // Generate a small grid for deterministic interactions
      await astar.setGridSize(8, 6);
      await astar.clickGenerateGrid();
      await astar.waitForLogContains('Generated grid 6 rows x 8 cols.');

      // Set placement mode to start and place start at (0,0)
      await astar.setPlaceMode('start');
      await astar.clickCell(0, 0);
      const startClass = await astar.getCellClass(0, 0);
      expect(startClass).toContain('start');

      // Set placement mode to end and place end at (0,1)
      await astar.setPlaceMode('end');
      await astar.clickCell(0, 1);
      const endClass = await astar.getCellClass(0, 1);
      expect(endClass).toContain('end');

      // Toggle a wall at (2,2)
      await astar.setPlaceMode('wall');
      await astar.clickCell(2, 2);
      const wallClass = await astar.getCellClass(2, 2);
      expect(wallClass).toContain('wall');

      // Clear all walls and verify no cell contains 'wall'
      await astar.clickButton('#clearwalls');
      await astar.waitForLogContains('Cleared all walls');
      const anyWalls = await page.$$eval('#gridcontainer td', (tds) => tds.some((td) => td.className.includes('wall')));
      expect(anyWalls).toBeFalsy();

      // Clear path states (should be a no-op but must be callable)
      await astar.clickButton('#clearpath');
      await astar.waitForLogContains('Cleared path and search state');
    });

    test('Reset all clears start/end and walls and logs reset', async ({ page }) => {
      // Generate grid and place start/end and a wall, then resetAll
      await astar.setGridSize(7, 5);
      await astar.clickGenerateGrid();
      await astar.waitForLogContains('Generated grid 5 rows x 7 cols.');

      await astar.setPlaceMode('start');
      await astar.clickCell(1, 1);
      await astar.setPlaceMode('end');
      await astar.clickCell(1, 2);
      await astar.setPlaceMode('wall');
      await astar.clickCell(3, 3);

      // Reset all and verify no start/end/wall classes
      await astar.clickButton('#resetall');
      await astar.waitForLogContains('Reset all grid data');
      const classes = await page.$$eval('#gridcontainer td', (tds) => tds.map((td) => td.className));
      expect(classes.every((c) => c === '')).toBeTruthy();
    });
  });

  test.describe('Search lifecycle: start, step, run, pause, reset', () => {
    test('Step search until path found (S1 -> S2 -> S4)', async ({ page }) => {
      // Small grid where start and end are adjacent so search completes quickly
      await astar.setGridSize(5, 5);
      await astar.clickGenerateGrid();
      await astar.waitForLogContains('Generated grid 5 rows x 5 cols.');

      // Place start at (0,0) and end at (0,1)
      await astar.setPlaceMode('start');
      await astar.clickCell(0, 0);
      await astar.setPlaceMode('end');
      await astar.clickCell(0, 1);

      // Click step search twice to let the search initialize and then find a path
      // First click: will call initSearch() and perform one step
      await astar.clickButton('#stepsearch');
      // Wait for "Search initialized." log to ensure we are in Searching state
      await astar.waitForLogContains('Search initialized.');

      // Second click: step again and expect path found
      await astar.clickButton('#stepsearch');
      await astar.waitForLogContains('Path found!');

      // Verify at least one cell has path class and that start/end remain
      const anyPath = await page.$$eval('#gridcontainer td', (tds) =>
        tds.some((td) => td.className.includes('path'))
      );
      expect(anyPath).toBeTruthy();

      // After search completes, searching should be false and start/step/run buttons should be enabled (has start & end)
      expect(await page.isEnabled('#startsearch')).toBeTruthy();
      expect(await page.isEnabled('#stepsearch')).toBeTruthy();
      expect(await page.isEnabled('#runsearch')).toBeTruthy();
    });

    test('Run continuously then pause mid-run (S2 -> S2 (run) -> S3 on pause)', async ({ page }) => {
      // Generate grid and place start & end somewhat apart to allow a pause before completion
      await astar.setGridSize(12, 8);
      await astar.clickGenerateGrid();
      await astar.waitForLogContains('Generated grid 8 rows x 12 cols.');

      // Place start at (0,0) and end at (7,11)
      await astar.setPlaceMode('start');
      await astar.clickCell(0, 0);
      await astar.setPlaceMode('end');
      await astar.clickCell(7, 11);

      // Reduce step delay to speed up the process but still allow a pause
      await astar.setStepDelay(50);

      // Start continuous run
      await astar.clickButton('#runsearch');
      await astar.waitForLogContains('Continuous run started.');

      // Wait a short bit for run to begin and then request a pause
      await page.waitForTimeout(80);

      // Pause - a pause should be logged if interval was set
      await astar.clickButton('#pausesearch');
      await astar.waitForLogContains('Search paused.');

      // After pausing, ensure searching may still be true but searchPaused true per code
      const logs = await astar.getLogs();
      expect(logs).toContain('Continuous run started.');
      expect(logs).toContain('Search paused.');
    });

    test('Reset search while searching should stop and clear path states (S2 -> S5 via RESET_SEARCH)', async ({ page }) => {
      // Setup grid and start a search but reset before completion
      await astar.setGridSize(10, 6);
      await astar.clickGenerateGrid();
      await astar.waitForLogContains('Generated grid 6 rows x 10 cols.');

      // Place start and end
      await astar.setPlaceMode('start');
      await astar.clickCell(0, 0);
      await astar.setPlaceMode('end');
      await astar.clickCell(5, 9);

      // Initiate search by clicking stepsearch once (initializes)
      await astar.clickButton('#stepsearch');
      await astar.waitForLogContains('Search initialized.');

      // Now 'reset search' should be enabled; click it
      await astar.clickButton('#resetsearch');
      await astar.waitForLogContains('Search reset.');

      // Confirm that path states are cleared (no open/closed/path)
      const hasPathState = await page.$$eval('#gridcontainer td', (tds) => tds.some((td) =>
        td.className.includes('open') || td.className.includes('closed') || td.className.includes('path')
      ));
      expect(hasPathState).toBeFalsy();
    });
  });

  test.describe('Edge cases around starting search without setup', () => {
    test('Starting search without start and end prompts alert', async ({ page }) => {
      // Reset any existing placements (ensures no start/end)
      await astar.clickButton('#resetall');
      await astar.waitForLogContains('Reset all grid data');

      // Attempt to click Start Search - expect an alert dialog
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#startsearch'),
      ]);
      expect(dialog.message()).toContain('Set start and end nodes before searching.');
      await dialog.dismiss();
    });
  });

  test.describe('Console and page error observations', () => {
    test('No unexpected page errors or console errors during normal interactions', async ({ page }) => {
      // Run a typical flow that exercises many handlers
      await astar.setGridSize(9, 7);
      await astar.clickGenerateGrid();
      await astar.waitForLogContains('Generated grid 7 rows x 9 cols.');

      await astar.setPlaceMode('start');
      await astar.clickCell(1, 1);
      await astar.setPlaceMode('end');
      await astar.clickCell(1, 2);
      await astar.setPlaceMode('wall');
      await astar.clickCell(2, 2);
      await astar.clickButton('#clearwalls');
      await astar.waitForLogContains('Cleared all walls');

      // Verify that we captured console messages and page errors arrays are sane
      // We assert that there are NO uncaught page errors
      expect(astar.pageErrors.length).toBe(0);

      // Also assert there are no console messages of type 'error' referencing ReferenceError/SyntaxError/TypeError
      const errorMsgs = astar.consoleMessages.filter((m) => m.type === 'error' ||
        /ReferenceError|SyntaxError|TypeError/.test(m.text));
      expect(errorMsgs.length).toBe(0);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test failed, include console and page errors in the failure metadata for easier debugging
    if (testInfo.status !== testInfo.expectedStatus) {
      // This block purposefully does not change page state; it just logs for debugging.
      // The page object stored arrays that are accessible here via closure (astar).
      // Attach to test artifacts (Playwright will show in the report if enabled).
      // We won't assert here; this is teardown.
    }
  });
});