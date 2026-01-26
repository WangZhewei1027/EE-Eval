import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2f0ec1-fa7a-11f0-ba5b-57721b046e74.html';

// Utility helpers used across tests
async function getStateText(page) {
  return (await page.locator('#state').textContent())?.trim();
}
async function getPathLengthText(page) {
  return (await page.locator('#pathLength').textContent())?.trim();
}
async function getNodesVisitedText(page) {
  return (await page.locator('#nodesVisited').textContent())?.trim();
}
async function getTimeTakenText(page) {
  return (await page.locator('#timeTaken').textContent())?.trim();
}
async function getGridCellCount(page) {
  return await page.locator('#grid .cell').count();
}
async function setRangeValue(page, selector, value) {
  await page.$eval(selector, (el, v) => {
    el.value = v;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, String(value));
}
async function selectValue(page, selector, value) {
  await page.selectOption(selector, value);
}
async function clickCell(page, x, y) {
  await page.click(`.cell[data-x="${x}"][data-y="${y}"]`);
}
async function cellHasClass(page, x, y, className) {
  return await page.$eval(`.cell[data-x="${x}"][data-y="${y}"]`, (el, cls) => el.classList.contains(cls), className);
}

test.describe('A* Search Application - FSM and UI validation', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console errors and page errors for assertions later
    consoleErrors = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Record console errors specifically
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application page exactly as-is
    await page.goto(APP_URL);
    // Ensure the page has rendered basic UI
    await expect(page.locator('h1')).toHaveText('A* Search Algorithm');
  });

  test.afterEach(async () => {
    // No teardown needed beyond built-in fixtures; errors will be asserted in tests
  });

  test.describe('Initialization and Controls', () => {
    test('initial state should be Ready and grid should render', async ({ page }) => {
      // Validate initial FSM state (S0_Ready)
      await expect(page.locator('#state')).toHaveText('Ready');
      await expect(page.locator('#pathLength')).toHaveText('-');
      await expect(page.locator('#nodesVisited')).toHaveText('0');
      await expect(page.locator('#timeTaken')).toHaveText('0');

      // Default grid size is 15 (15x15)
      await expect(page.locator('#gridSizeValue')).toHaveText('15x15');

      // Grid should contain 15*15 cells
      const count = await getGridCellCount(page);
      expect(count).toBe(15 * 15);

      // Assert no unexpected runtime errors during initialization
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('changing grid size re-initializes grid and updates start/end', async ({ page }) => {
      // Change grid size to 5 via input range and validate re-render (entry action: renderGrid())
      await setRangeValue(page, '#gridSize', 5);
      await expect(page.locator('#gridSizeValue')).toHaveText('5x5');

      // Grid should have 25 cells
      const count = await getGridCellCount(page);
      expect(count).toBe(5 * 5);

      // Start should be at 0,0 and end at 4,4 -> check classes on corners
      expect(await cellHasClass(page, 0, 0, 'start')).toBe(true);
      expect(await cellHasClass(page, 4, 4, 'end')).toBe(true);

      // No runtime errors from changing grid size
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('cell type selection updates selectedCellType', async ({ page }) => {
      // Change selected cell type to 'wall' and ensure the select holds the value
      await selectValue(page, '#cellType', 'wall');
      const val = await page.$eval('#cellType', el => el.value);
      expect(val).toBe('wall');

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('A* Execution (Run/NoPath/PathFound)', () => {
    test('Run A* on a clear small grid should find a path (S0_Ready -> S1_Running -> S2_PathFound)', async ({ page }) => {
      // Make grid small for deterministic and fast run
      await setRangeValue(page, '#gridSize', 5);
      // Ensure there are no walls: reset/clear
      await page.click('#reset'); // resetSearch keeps walls but we just re-init; safe
      await page.click('#clearWalls');

      // Confirm initial state
      await expect(page.locator('#state')).toHaveText('Ready');

      // Click Run -> should set state to 'Running...' (transition S0_Ready -> S1_Running)
      await page.click('#run');
      await expect(page.locator('#state')).toHaveText('Running...');

      // Wait until algorithm finishes and sets state to 'Path found'
      await page.waitForFunction(() => document.getElementById('state').textContent === 'Path found', {}, { timeout: 5000 });

      // Validate terminal state S2_PathFound observables
      await expect(page.locator('#state')).toHaveText('Path found');
      const pathLength = await getPathLengthText(page);
      expect(Number(pathLength) >= 1).toBeTruthy(); // path length should be at least 1
      const nodesVisited = Number(await getNodesVisitedText(page));
      expect(nodesVisited).toBeGreaterThan(0);
      const timeTaken = Number(await getTimeTakenText(page));
      expect(timeTaken).toBeGreaterThanOrEqual(0);

      // No uncaught errors observed during search
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Run A* with walls blocking should report No path found (S1_Running -> S3_NoPath)', async ({ page }) => {
      // Use small grid for determinism
      await setRangeValue(page, '#gridSize', 5);

      // Set cell type to wall to paint walls
      await selectValue(page, '#cellType', 'wall');

      // Paint walls on every cell except start (0,0) and end (4,4) to block any path
      for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
          if ((x === 0 && y === 0) || (x === 4 && y === 4)) continue;
          await clickCell(page, x, y);
        }
      }

      // Verify that walls exist by checking a sample cell
      expect(await cellHasClass(page, 1, 0, 'wall')).toBe(true);

      // Click Run
      await page.click('#run');
      // Should transition to Running...
      await expect(page.locator('#state')).toHaveText('Running...');

      // Wait for No path found state
      await page.waitForFunction(() => document.getElementById('state').textContent === 'No path found', {}, { timeout: 5000 });

      await expect(page.locator('#state')).toHaveText('No path found');

      // timeTaken should be set as runAStar computes it when aStarStep returns false
      const timeTaken = Number(await getTimeTakenText(page));
      expect(timeTaken).toBeGreaterThanOrEqual(0);

      // nodesVisited may be 0 or >0 depending on implementation, but ensure nodesVisited is a number
      const nodesVisited = Number(await getNodesVisitedText(page));
      expect(Number.isFinite(nodesVisited)).toBeTruthy();

      // Reset walls for cleanliness
      await page.click('#reset');

      // No page errors should have occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('running when start or end is missing should not start (edge case)', async ({ page }) => {
      // Make grid small to simplify
      await setRangeValue(page, '#gridSize', 5);

      // Select 'empty' and click on the start cell to remove it (edge case: startCell becomes null)
      await selectValue(page, '#cellType', 'empty');
      // Click where start is expected (0,0)
      await clickCell(page, 0, 0);

      // Now attempt to run - runAStar should early return because !startCell or !endCell
      await page.click('#run');

      // The state should remain 'Ready' because runAStar returns early
      await expect(page.locator('#state')).toHaveText('Ready');

      // Reinitialize the grid for following tests
      await page.click('#reset');

      // Ensure no runtime errors were thrown
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Stepping and Search Controls', () => {
    test('Step button enters stepping mode and can step to completion (S0_Ready -> S4_Paused -> S1_Running -> S2_PathFound/S3_NoPath)', async ({ page }) => {
      // Use a small clean grid
      await setRangeValue(page, '#gridSize', 5);
      await page.click('#reset');
      await page.click('#clearWalls');

      // Ensure stepping starts when pressing Step from Ready
      await page.click('#step');
      await expect(page.locator('#state')).toHaveText('Stepping...');

      // Now loop: click step repeatedly until state changes to Path found or No path found
      let finalState = null;
      for (let i = 0; i < 200; i++) {
        // Click the step button to advance one step if paused & running
        await page.click('#step');
        // Give some micro-wait for UI update
        await page.waitForTimeout(10);
        const state = await getStateText(page);
        if (state === 'Path found' || state === 'No path found') {
          finalState = state;
          break;
        }
      }

      expect(finalState === 'Path found' || finalState === 'No path found').toBeTruthy();

      // After stepping completes, pathLength should be set if path found
      if (finalState === 'Path found') {
        const pathLength = Number(await getPathLengthText(page));
        expect(pathLength).toBeGreaterThanOrEqual(1);
      }

      // No errors during stepping
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking cells while running should have no effect (guard clause)', async ({ page }) => {
      // Small grid, no walls
      await setRangeValue(page, '#gridSize', 5);
      await page.click('#reset');
      await page.click('#clearWalls');

      // Start the run
      await page.click('#run');
      await expect(page.locator('#state')).toHaveText('Running...');

      // Attempt to click a cell to turn it into a wall or move start - should be ignored due to isRunning guard
      // Record a property of a cell before clicking
      const beforeHasWall = await cellHasClass(page, 2, 2, 'wall');
      // Try clicking cell (should be no-op)
      await clickCell(page, 2, 2);
      const afterHasWall = await cellHasClass(page, 2, 2, 'wall');
      expect(beforeHasWall).toBe(afterHasWall); // should not change while running

      // Wait for algorithm to finish (path found)
      await page.waitForFunction(() => {
        const s = document.getElementById('state').textContent;
        return s === 'Path found' || s === 'No path found';
      }, {}, { timeout: 5000 });

      // No runtime errors produced
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Misc Actions: Reset, Clear Walls, Random Walls', () => {
    test('Random walls creates walls and clearWalls removes them', async ({ page }) => {
      await setRangeValue(page, '#gridSize', 5);
      await page.click('#reset');

      // Ensure initially there are no walls
      let anyWall = false;
      const total = await getGridCellCount(page);
      for (let i = 0; i < total; i++) {
        const cls = await page.locator('#grid .cell').nth(i).getAttribute('class');
        if (cls && cls.includes('wall')) {
          anyWall = true;
          break;
        }
      }
      // No guarantee for initial, but continue with randomWalls test
      await page.click('#randomWalls');

      // Wait a short time for render
      await page.waitForTimeout(100);

      // After randomWalls, expect at least one wall in the grid
      let foundWall = false;
      const total2 = await getGridCellCount(page);
      for (let i = 0; i < total2; i++) {
        const cls = await page.locator('#grid .cell').nth(i).getAttribute('class');
        if (cls && cls.includes('wall')) {
          foundWall = true;
          break;
        }
      }
      expect(foundWall).toBeTruthy();

      // Now clear walls
      await page.click('#clearWalls');
      await page.waitForTimeout(50);

      // After clearWalls, there should be no cells with 'wall' class
      let foundWallAfterClear = false;
      const total3 = await getGridCellCount(page);
      for (let i = 0; i < total3; i++) {
        const cls = await page.locator('#grid .cell').nth(i).getAttribute('class');
        if (cls && cls.includes('wall')) {
          foundWallAfterClear = true;
          break;
        }
      }
      expect(foundWallAfterClear).toBe(false);

      // Reset should put the app back to Ready
      await page.click('#reset');
      await expect(page.locator('#state')).toHaveText('Ready');

      // No runtime errors for these UI actions
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Console & Page Error Observations', () => {
    test('no unhandled page errors or console error messages observed during flows', async ({ page }) => {
      // Perform a few interactions to exercise app codepaths
      await setRangeValue(page, '#gridSize', 6);
      await selectValue(page, '#cellType', 'wall');
      // Paint a few walls
      await clickCell(page, 1, 1);
      await clickCell(page, 1, 2);
      await clickCell(page, 2, 1);

      // Run a short search and then reset
      await page.click('#run');
      // Wait a moment and then reset (we don't need to wait for completion here)
      await page.waitForTimeout(200);
      await page.click('#reset');

      // Inspect captured errors
      // The test framework instruction required observing console logs and page errors.
      // Assert that no unexpected runtime page errors occurred.
      expect(pageErrors.length).toBe(0);

      // Assert there were no console.error messages produced
      expect(consoleErrors.length).toBe(0);
    });
  });
});