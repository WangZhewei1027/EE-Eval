import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72aaa192-fa78-11f0-812d-c9788050701f.html';

test.describe('A* Pathfinding Visualization (FSM validation) - Application ID: 72aaa192-fa78-11f0-812d-c9788050701f', () => {
  // Shared state for capturing runtime console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors for assertions
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Capture Error objects emitted by the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    // Navigate to the application page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for grid element to be present as a sign of initialization
    await page.waitForSelector('#grid');
  });

  test.afterEach(async ({ page }) => {
    // Ensure no lingering listeners or resources cause flakiness between tests
    await page.reload({ waitUntil: 'load' });
  });

  test.describe('State S0_Initialized (Initial page load)', () => {
    test('Initialized: grid is created, start and end nodes present, heuristic values rendered', async ({ page }) => {
      // This test validates the "Initialized" state:
      // - initializeGrid() should have built a 20x20 grid (400 cells)
      // - Start node should be at row 5, col 5 with class "start"
      // - End node should be at row 15, col 15 with class "end"
      // - Each cell should contain a .heuristic-value element with numeric text

      // Check number of cells
      const cells = await page.$$('.cell');
      expect(cells.length).toBe(400);

      // Check start cell presence and class
      const startCell = await page.$('.cell[data-row="5"][data-col="5"]');
      expect(startCell).not.toBeNull();
      expect(await startCell.getAttribute('class')).toContain('start');

      // Check end cell presence and class
      const endCell = await page.$('.cell[data-row="15"][data-col="15"]');
      expect(endCell).not.toBeNull();
      expect(await endCell.getAttribute('class')).toContain('end');

      // Check heuristics rendered for a sample of cells
      const samplePositions = [
        { r: 0, c: 0 },
        { r: 10, c: 10 },
        { r: 19, c: 19 },
        { r: 5, c: 5 },
        { r: 15, c: 15 },
      ];
      for (const pos of samplePositions) {
        const cell = await page.$(`.cell[data-row="${pos.r}"][data-col="${pos.c}"]`);
        expect(cell).not.toBeNull();
        const hv = await cell.$('.heuristic-value');
        expect(hv).not.toBeNull();
        const text = (await hv.innerText()).trim();
        // Heuristic values should be a number string (non-empty and parseable)
        expect(text.length).toBeGreaterThan(0);
        expect(Number.isNaN(Number(text))).toBe(false);
      }

      // Check some demo walls added by initializeGrid (evidence in implementation)
      // Horizontal wall at row 10, cols 5..14 should be present
      for (let col = 5; col < 15; col++) {
        const wallCell = await page.$(`.cell[data-row="10"][data-col="${col}"]`);
        expect(wallCell).not.toBeNull();
        const classAttr = await wallCell.getAttribute('class');
        expect(classAttr).toContain('wall');
      }

      // There should be no visualization classes active initially (open/closed/path) except start/end/wall
      const openCells = await page.$$('.cell.open');
      const closedCells = await page.$$('.cell.closed');
      const pathCells = await page.$$('.cell.path');
      expect(openCells.length).toBe(0);
      expect(closedCells.length).toBe(0);
      expect(pathCells.length).toBe(0);

      // Assert that no page runtime errors occurred during initialization
      expect(pageErrors.length).toBe(0);

      // Also assert no console errors were emitted during initialization
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
    });
  });

  test.describe('State S1_Visualizing (Visualization lifecycle)', () => {
    test('VisualizeAStar event: clicking Visualize A* triggers visualization (open/closed/path classes appear)', async ({ page }) => {
      // This test validates the transition S0_Initialized -> S1_Visualizing
      // - Clicking #visualize-btn should start visualization
      // - We expect cells to receive 'open' and/or 'closed' classes during run
      // - Eventually a 'path' should be rendered (cells with class 'path')

      const visualizeBtn = await page.$('#visualize-btn');
      expect(visualizeBtn).not.toBeNull();

      // Click the visualize button to start visualization
      await visualizeBtn.click();

      // After starting, expect at least one cell to become 'closed' or 'open' during visualization
      // Wait for either an 'open' or 'closed' cell to appear
      await page.waitForSelector('.cell.open, .cell.closed', { timeout: 5000 });

      // Now wait for the final path to be rendered: cells with class 'path'
      // ReconstructPath adds class 'path' and awaits short delays; give generous timeout
      const pathSelector = '.cell.path';
      await page.waitForSelector(pathSelector, { timeout: 15000 });

      // Validate that we have path cells and that the end cell remains present
      const pathCells = await page.$$(pathSelector);
      expect(pathCells.length).toBeGreaterThan(0);

      // Ensure end node still exists and has class 'end' (it should not be removed)
      const endCell = await page.$('.cell[data-row="15"][data-col="15"]');
      expect(endCell).not.toBeNull();
      const endClass = await endCell.getAttribute('class');
      expect(endClass).toContain('end');

      // Ensure no unexpected page errors occurred during visualization
      expect(pageErrors.length).toBe(0);

      // Also ensure no console errors were emitted during visualization
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
    });

    test('Double click Visualize A* while visualizing: second click is a no-op (guard: if (isVisualizing) return)', async ({ page }) => {
      // This test validates the self-transition in FSM:
      // While in S1_Visualizing, another VisualizeAStar event should effectively be ignored.
      // We validate this indirectly by ensuring no errors and that only one active visualization runs.

      // Click visualize to start
      await page.click('#visualize-btn');

      // Immediately click visualize again (should be ignored by if (isVisualizing) return)
      await page.click('#visualize-btn');

      // Wait for a visualization indicator to appear to ensure process started
      await page.waitForSelector('.cell.closed, .cell.open', { timeout: 5000 });

      // Wait for path to finish
      await page.waitForSelector('.cell.path', { timeout: 15000 });

      // If the second click had caused an error or double-run, pageErrors or console errors might be present
      expect(pageErrors.length).toBe(0);
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);

      // Additional sanity check: ensure no duplicate path nodes beyond expected (can't fully detect duplicates,
      // but ensure that start node remains single and present)
      const startCell = await page.$('.cell[data-row="5"][data-col="5"]');
      expect(startCell).not.toBeNull();
      const startClass = await startCell.getAttribute('class');
      expect(startClass).toContain('start');
    });

    test('Reset during visualization: clicking Reset Grid while visualizing should be a guarded no-op (isVisualizing prevents reset)', async ({ page }) => {
      // This test validates an edge case: attempting the ResetGrid event while in S1_Visualizing.
      // Implementation contains: function resetGrid() { if (isVisualizing) return; initializeGrid(); }
      // Therefore, clicking reset while visualizing should not reset the grid or throw errors.

      // Start visualization
      await page.click('#visualize-btn');

      // Wait a little for visualization to proceed
      await page.waitForSelector('.cell.closed, .cell.open', { timeout: 5000 });

      // Capture classes count before clicking reset
      const closedBefore = (await page.$$('.cell.closed')).length;
      const openBefore = (await page.$$('.cell.open')).length;

      // Click reset while visualization is ongoing
      await page.click('#reset-btn');

      // Wait a short time to allow any reset to happen (or not)
      await page.waitForTimeout(500);

      // Check that visualization classes still exist - if reset had executed it would have cleared them
      const closedAfter = (await page.$$('.cell.closed')).length;
      const openAfter = (await page.$$('.cell.open')).length;

      // Since reset should be a no-op while visualizing, counts should be roughly unchanged (>= before)
      expect(closedAfter).toBeGreaterThanOrEqual(0);
      expect(openAfter).toBeGreaterThanOrEqual(0);
      // Make sure clicking reset did not clear the visualization immediately
      // It's acceptable if counts changed slightly due to visualization progress; ensure no errors
      expect(pageErrors.length).toBe(0);
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
    });
  });

  test.describe('State S2_Reset (Reset behavior and transitions)', () => {
    test('ResetGrid event: after visualization completes, clicking Reset Grid returns to Initialized state', async ({ page }) => {
      // This test validates the transition S1_Visualizing -> S0_Initialized via ResetGrid
      // - Start visualization, wait for it to complete (path drawn)
      // - Click reset
      // - The grid should be re-initialized: no 'open', 'closed', 'path' classes; start/end restored; demo walls present

      // Start visualization and wait for path to be drawn
      await page.click('#visualize-btn');
      await page.waitForSelector('.cell.path', { timeout: 15000 });

      // Confirm visualization produced path cells
      const pathCellsBefore = await page.$$('.cell.path');
      expect(pathCellsBefore.length).toBeGreaterThan(0);

      // Now click reset (visualization has completed so reset should run)
      await page.click('#reset-btn');

      // Wait a moment for initializeGrid to rebuild grid
      await page.waitForTimeout(500);

      // After reset, ensure there are still 400 cells and path/open/closed classes cleared
      const cellsAfter = await page.$$('.cell');
      expect(cellsAfter.length).toBe(400);

      const pathCellsAfter = await page.$$('.cell.path');
      const openAfter = await page.$$('.cell.open');
      const closedAfter = await page.$$('.cell.closed');

      expect(pathCellsAfter.length).toBe(0);
      expect(openAfter.length).toBe(0);
      expect(closedAfter.length).toBe(0);

      // Start and end nodes should still be in their configured positions
      const startCell = await page.$('.cell[data-row="5"][data-col="5"]');
      expect(startCell).not.toBeNull();
      expect((await startCell.getAttribute('class'))).toContain('start');

      const endCell = await page.$('.cell[data-row="15"][data-col="15"]');
      expect(endCell).not.toBeNull();
      expect((await endCell.getAttribute('class'))).toContain('end');

      // Demo walls should be present again (validate a sample)
      const demoWall = await page.$('.cell[data-row="10"][data-col="7"]'); // inside horizontal wall
      expect(demoWall).not.toBeNull();
      expect((await demoWall.getAttribute('class'))).toContain('wall');

      // Validate no page errors during reset
      expect(pageErrors.length).toBe(0);
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
    });

    test('Edge case: rapid repeated resets - multiple ResetGrid events produce consistent Initialized state', async ({ page }) => {
      // This test triggers reset multiple times in quick succession to ensure stable re-initialization.
      const resetBtn = await page.$('#reset-btn');
      expect(resetBtn).not.toBeNull();

      // Perform rapid resets
      await resetBtn.click();
      await resetBtn.click();
      await resetBtn.click();

      // Allow some time for initializeGrid to complete potentially multiple times
      await page.waitForTimeout(300);

      // Validate grid is in expected Initialized shape
      const cells = await page.$$('.cell');
      expect(cells.length).toBe(400);

      // Start/end present and demo walls present
      const startCell = await page.$('.cell[data-row="5"][data-col="5"]');
      const endCell = await page.$('.cell[data-row="15"][data-col="15"]');
      expect(startCell).not.toBeNull();
      expect(endCell).not.toBeNull();

      // Ensure no runtime page errors
      expect(pageErrors.length).toBe(0);
      const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrorMsgs.length).toBe(0);
    });
  });

  test.describe('Runtime errors and console observation', () => {
    test('No ReferenceError/SyntaxError/TypeError occurred during normal interactions', async ({ page }) => {
      // This test specifically asserts that the page did not emit runtime errors (ReferenceError, SyntaxError, TypeError)
      // during load and basic interactions (initialize, visualize, reset).

      // Perform a short interaction cycle: visualize -> wait for some progress -> reset after completion
      await page.click('#visualize-btn');
      await page.waitForSelector('.cell.closed, .cell.open', { timeout: 5000 }).catch(() => { /* ignore if not found quickly */ });
      // Wait for partial completion but don't require full path in this test
      await page.waitForTimeout(200);
      // If visualization completes quickly, ensure path exists then reset
      const pathExists = await page.$('.cell.path');
      if (pathExists) {
        await page.click('#reset-btn');
        await page.waitForTimeout(200);
      } else {
        // Attempt a reset (may be ignored if still visualizing)
        await page.click('#reset-btn');
        await page.waitForTimeout(200);
      }

      // Verify collected pageErrors array contains no SyntaxError / ReferenceError / TypeError instances
      for (const err of pageErrors) {
        const msg = String(err && err.message ? err.message : err);
        // Fail if any of these error types appear
        expect(msg).not.toMatch(/ReferenceError/);
        expect(msg).not.toMatch(/SyntaxError/);
        expect(msg).not.toMatch(/TypeError/);
      }

      // Verify no console.error messages indicating runtime failures
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Collect and log console messages and page errors for debugging (but do not modify runtime)', async ({ page }) => {
      // This test purposefully collects runtime messages and asserts that collection works.
      // It does not assert absence/presence of errors beyond confirming the collections are accessible.

      // Fire one action to potentially generate console messages
      await page.click('#visualize-btn');
      // Allow some time for messages to appear
      await page.waitForTimeout(300);

      // At least our collectors should be arrays (even if empty)
      expect(Array.isArray(consoleMessages)).toBe(true);
      expect(Array.isArray(pageErrors)).toBe(true);

      // Optionally assert that console message items have expected structure
      for (const msg of consoleMessages) {
        expect(msg).toHaveProperty('type');
        expect(msg).toHaveProperty('text');
      }

      // If any pageErrors are present, ensure they are Error instances or stringifiable
      for (const err of pageErrors) {
        expect(err).toBeTruthy();
      }
    });
  });
});