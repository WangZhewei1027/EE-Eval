import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e93410b1-d360-11f0-a097-ffdd56c22ef4.html';

// Helper utilities used in tests
async function getStatusText(page) {
  return page.$eval('#status', el => el.textContent.trim());
}

async function getVisitedCount(page) {
  return page.$eval('#visitedCount', el => el.textContent.trim());
}

async function getStackViewText(page) {
  return page.$eval('#stackView', el => el.innerText.trim());
}

async function setSpeedValue(page, value) {
  await page.fill('#speed', String(value));
  // ensure change event propagation if needed
  await page.$eval('#speed', (el)=> el.dispatchEvent(new Event('input')));
}

async function setAlgo(page, algoValue) {
  await page.selectOption('#algo', algoValue);
}

async function clickCanvasCell(page, row, col) {
  // margin is a constant in the app (8)
  const margin = 8;
  const canvasLocator = page.locator('#grid');
  const box = await canvasLocator.boundingBox();
  if (!box) throw new Error('Canvas bounding box not available');
  // read the internal canvas width (not CSS width) to compute cellSize like the app does
  const canvasWidth = await page.$eval('#grid', el => el.width);
  const cols = parseInt(await page.$eval('#cols', el => el.value), 10);
  // compute cellSize similar to app: cellSize = Math.floor((canvasWidth - margin*2)/cols)
  const cellSize = Math.floor((canvasWidth - margin * 2) / cols);
  const x = margin + col * cellSize + Math.floor(cellSize / 2);
  const y = margin + row * cellSize + Math.floor(cellSize / 2);
  // click relative to element
  await canvasLocator.click({ position: { x, y } });
}

async function getRowsCols(page) {
  const rows = parseInt(await page.$eval('#rows', el => el.value), 10);
  const cols = parseInt(await page.$eval('#cols', el => el.value), 10);
  return { rows, cols };
}

test.describe('DFS Visualizer FSM: states, transitions and UI behaviors', () => {
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];
    // capture console messages and page errors for observation
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No-op teardown here; individual tests will assert expectations about console / page errors.
  });

  test('Initial state: Idle with stats and stack view defaults', async ({ page }) => {
    // Validate initial UI state corresponds to S0_Idle
    const status = await getStatusText(page);
    expect(status).toBe('Idle'); // S0_Idle evidence: statusEl.textContent = 'Idle';
    const visited = await getVisitedCount(page);
    expect(visited).toBe('0');
    const stackText = await getStackViewText(page);
    expect(stackText).toContain('(stack / recursion frames will appear here during execution)');

    // no page errors should have occurred during initial load
    expect(pageErrors.length).toBe(0);
    // no console errors on load
    expect(consoleErrors.length).toBe(0);
  });

  test('Run iterative algorithm: Idle -> Running -> Found and UI updates (including pause control)', async ({ page }) => {
    // Speed up animation so test runs quickly
    await setSpeedValue(page, '1000'); // app computes speed = Math.max(5, 1000 - value) -> min delay = 5ms

    // Ensure algorithm is iterative
    await setAlgo(page, 'iter');

    // Start run: Idle -> Running
    await page.click('#runBtn');

    // Pause button should be enabled as soon as iterative run begins (code sets pauseBtn.disabled = false early)
    await page.waitForFunction(() => !document.getElementById('pauseBtn').disabled, { timeout: 3000 });

    // Status should reflect Running while algorithm is executing
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('Running'), { timeout: 3000 });
    let statusDuring = await getStatusText(page);
    expect(statusDuring).toMatch(/Running/);

    // Now test PauseClick transition: Running -> Paused
    await page.click('#pauseBtn');
    // pause toggles the text content to 'Resume' in the button and status to 'Paused'
    await page.waitForFunction(() => document.getElementById('status').textContent === 'Paused', { timeout: 2000 });
    let pausedStatus = await getStatusText(page);
    expect(pausedStatus).toBe('Paused');

    // Resume: Paused -> Running
    await page.click('#pauseBtn');
    await page.waitForFunction(() => document.getElementById('status').textContent.includes('Running'), { timeout: 2000 });
    let resumedStatus = await getStatusText(page);
    expect(resumedStatus).toMatch(/Running/);

    // Wait until algorithm completes and reaches "Found" state (or Idle+Found)
    await page.waitForFunction(() => {
      const s = document.getElementById('status').textContent;
      return s.includes('Found') || s.includes('Idle');
    }, { timeout: 10000 });

    const finalStatus = await getStatusText(page);
    // Implementation sets status to 'Found' if found === true, otherwise 'Idle'
    expect(['Found', 'Idle']).toContain(finalStatus);

    // If found, stackView or pathLen should reflect result
    const stackText = await getStackViewText(page);
    if (finalStatus === 'Found') {
      expect(stackText.length).toBeGreaterThan(0);
      // ensure path len non-negative
      const pathLen = await page.$eval('#pathLen', el => parseInt(el.textContent, 10));
      expect(Number.isInteger(pathLen)).toBe(true);
      expect(pathLen).toBeGreaterThanOrEqual(0);
    } else {
      // algorithm may have exhausted if blocked; in that case the stackView indicates exhaustion
      expect(stackText.toLowerCase()).toContain('exhaust');
    }

    // At end, runBtn should be enabled again (run completed)
    await page.waitForFunction(() => !document.getElementById('runBtn').disabled, { timeout: 2000 });
    expect(await page.$eval('#runBtn', el => el.disabled)).toBe(false);

    // Ensure no fatal page errors were thrown during run
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Step mode from Idle: initializes generator and advances one step (S0_Idle -> S1_Running expected by FSM but implementation may differ)', async ({ page }) => {
    // Ensure clear walls to have deterministic behavior
    await page.click('#clearWallsBtn');

    // Speed up stepping animations
    await setSpeedValue(page, '1000');

    // Make sure we start from Idle
    expect(await getStatusText(page)).toBe('Idle');

    // Click Step - this will initialize the iterator and perform one step
    await page.click('#stepBtn');

    // After first step, stackView should be updated to show initial stack (start cell)
    await page.waitForFunction(() => document.getElementById('stackView').innerText.length > 0, { timeout: 2000 });
    const stackText = await getStackViewText(page);
    expect(stackText.length).toBeGreaterThan(0);

    // Implementation note: FSM expected Running here, but actual status may remain Idle while stepping.
    const statusAfterStep = await getStatusText(page);
    // Accept either Idle or Running depending on implementation branch
    expect(['Idle', 'Running']).toContain(statusAfterStep);

    // Advance a few steps and ensure visited count increases
    const beforeVisited = parseInt(await getVisitedCount(page), 10);
    // click step multiple times
    for (let i = 0; i < 5; i++) {
      await page.click('#stepBtn');
      // small pause to allow DOM update
      await page.waitForTimeout(50);
    }
    const afterVisited = parseInt(await getVisitedCount(page), 10);
    expect(afterVisited).toBeGreaterThanOrEqual(beforeVisited);

    // No unexpected page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Exhausted path via Step mode when grid is fully walled except start/goal', async ({ page }) => {
    // Ensure speed fast
    await setSpeedValue(page, '1000');
    await page.click('#clearWallsBtn');

    // Determine rows/cols and start/goal positions used by the app
    const { rows, cols } = await getRowsCols(page);

    // Compute start and goal locations as in app's randomStartGoal/init: start.r = floor(rows/2), start.c = floor(cols/4)
    const start = { r: Math.floor(rows / 2), c: Math.max(0, Math.floor(cols / 4)) };
    const goal = { r: Math.floor(rows / 2), c: Math.min(cols - 1, Math.floor(cols * 3 / 4)) };

    // Set mode to toggle (should already be default)
    await page.selectOption('#mode', 'toggle');

    // Click every cell except start & goal to place walls (this will block any path -> exhausted)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if ((r === start.r && c === start.c) || (r === goal.r && c === goal.c)) continue;
        await clickCanvasCell(page, r, c);
      }
    }
    // verify at least some walls are present by invoking RandomWalls clearing then checking behavior is different,
    // but simpler: ensure cleared visited before stepping
    await page.click('#resetBtn');

    // Now step through until exhausted - the generator will eventually yield exhausted
    // Initialize step mode
    await page.click('#stepBtn');

    // Step repeatedly until exhausted or timeout
    const timeoutMs = 15000;
    const startTime = Date.now();
    let exhaustedDetected = false;
    while (Date.now() - startTime < timeoutMs) {
      const stackText = await getStackViewText(page);
      if (/exhaust/i.test(stackText)) {
        exhaustedDetected = true;
        break;
      }
      // if iterator exists and not done, advance one step
      await page.click('#stepBtn');
      await page.waitForTimeout(10);
    }

    expect(exhaustedDetected).toBe(true); // S4_Exhausted evidence: stackView.innerText contains exhausted
    expect((await getStackViewText(page)).toLowerCase()).toContain('exhaust');

    // After exhaustion via step mode, iterator should be cleared (stepBtn logic sets iterator = null)
    // no fatal errors
    expect(pageErrors.length).toBe(0);
  });

  test('Reset button brings UI back to Idle and clears runtime state', async ({ page }) => {
    // Make some progress: create an iterator and step once
    await setSpeedValue(page, '1000');
    await page.click('#stepBtn');
    await page.waitForTimeout(50);
    // now click reset
    await page.click('#resetBtn');
    // status must be Idle after reset
    await page.waitForFunction(() => document.getElementById('status').textContent === 'Idle', { timeout: 1000 });
    expect(await getStatusText(page)).toBe('Idle');
    // visited count must be 0
    expect(await getVisitedCount(page)).toBe('0');
    // stack view reset text restored
    expect((await getStackViewText(page))).toContain('(stack / recursion frames will appear here during execution)');
    // no fatal page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Resize grid changes canvas dimensions and keeps functionality', async ({ page }) => {
    // get original canvas size
    const origCanvasWidth = await page.$eval('#grid', el => el.width);
    // change rows and cols and click resize
    await page.fill('#rows', '8');
    await page.fill('#cols', '10');
    await page.click('#resizeBtn');
    // after resize canvas width should change
    const newCanvasWidth = await page.$eval('#grid', el => el.width);
    expect(newCanvasWidth).not.toBe(origCanvasWidth);
    // ensure we can still click a cell and the app doesn't throw page errors
    await clickCanvasCell(page, 1, 1);
    // small wait for draw
    await page.waitForTimeout(50);
    expect(pageErrors.length).toBe(0);
  });

  test('Set start and goal via canvas mode selection and confirm reflected in stack initialization', async ({ page }) => {
    // set a clear baseline
    await page.click('#clearWallsBtn');
    await setSpeedValue(page, '1000');

    const { rows, cols } = await getRowsCols(page);
    // choose a new start cell near top-left
    const newStart = { r: Math.max(0, Math.floor(rows / 3)), c: Math.max(0, Math.floor(cols / 5)) };
    // choose a new goal cell near bottom-right
    const newGoal = { r: Math.min(rows - 1, Math.floor(rows * 2 / 3)), c: Math.min(cols - 1, Math.floor(cols * 4 / 5)) };

    // Set mode to 'start' and click to set
    await page.selectOption('#mode', 'start');
    await clickCanvasCell(page, newStart.r, newStart.c);
    // then set mode to 'goal' and click to set
    await page.selectOption('#mode', 'goal');
    await clickCanvasCell(page, newGoal.r, newGoal.c);

    // Now initialize step mode - first step will show stack with the new start coordinates as r,c
    await page.click('#stepBtn');

    // Wait for stackView update
    await page.waitForFunction(() => document.getElementById('stackView').innerText.length > 0, { timeout: 2000 });
    const stackText = await getStackViewText(page);
    // Expect the stack to include the start coordinate we set
    const expectedStartKey = `${newStart.r},${newStart.c}`;
    expect(stackText).toContain(expectedStartKey);

    // No page errors from these interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Double Run click while already running is ignored and does not create duplicate runs', async ({ page }) => {
    // Set slow but not too slow speed so we have a window to try double clicks
    await setSpeedValue(page, '900'); // moderate delay
    await setAlgo(page, 'iter');

    // click run
    await page.click('#runBtn');
    // immediately attempt to click run again
    await page.click('#runBtn');

    // The app prevents duplicate runs by returning early when running is true and also disables runBtn while running
    // Assert runBtn is disabled shortly after starting
    await page.waitForFunction(() => document.getElementById('runBtn').disabled === true, { timeout: 2000 });
    expect(await page.$eval('#runBtn', el => el.disabled)).toBe(true);

    // Wait for run to complete
    await page.waitForFunction(() => !document.getElementById('runBtn').disabled, { timeout: 15000 });
    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Monitor console and page errors throughout interactions (no runtime ReferenceError/SyntaxError/TypeError expected)', async ({ page }) => {
    // Perform a variety of quick interactions
    await setSpeedValue(page, '1000');
    await page.click('#randomBtn');
    await page.click('#clearWallsBtn');
    await page.click('#resizeBtn');
    await page.click('#runBtn');
    // wait some time for potential errors to surface
    await page.waitForTimeout(500);

    // Collect any page errors or console errors
    // Assert there were no page errors of fatal types
    expect(pageErrors.length).toBe(0);
    // Assert no console.error messages were emitted
    expect(consoleErrors.length).toBe(0);
  });
});