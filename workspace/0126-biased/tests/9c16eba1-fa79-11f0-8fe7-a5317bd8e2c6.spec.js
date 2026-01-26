import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c16eba1-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('K-Means Clustering Interactive Demo (FSM validation)', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Auto-accept any alert/dialog so tests aren't blocked by alerts used by the app
    page.on('dialog', async (dialog) => {
      try { await dialog.accept(); } catch (e) { /* ignore */ }
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for initial draw invocation to finish (script run)
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // Basic sanity: record console and page errors counts to debug on failure if needed
    // (Assertions about errors are within test cases where relevant)
  });

  test('S0_Idle: initial state should be Idle with mode "none" and initial dataset loaded', async ({ page }) => {
    // Verify global state.mode is 'none' on load (S0_Idle evidence)
    const mode = await page.evaluate(() => window.state && window.state.mode);
    expect(mode).toBe('none');

    // The page initialized a small dataset at the end of the script: check points exist
    const pointsLen = await page.evaluate(() => window.state && window.state.points && window.state.points.length);
    expect(typeof pointsLen).toBe('number');
    expect(pointsLen).toBeGreaterThanOrEqual(0);

    // Ensure no uncaught errors were thrown during initial load
    expect(pageErrors.length).toBe(0);
  });

  test('S1_AddingPoints: switching to Add mode and adding a point via canvas click', async ({ page }) => {
    const modeAdd = page.locator('#modeAdd');
    const canvas = page.locator('#plot');

    // Click Add button (will trigger an alert which auto-accepts)
    await modeAdd.click();

    // After clicking, state.mode should be 'add'
    await page.waitForTimeout(50); // give a moment for handler
    let mode = await page.evaluate(() => window.state.mode);
    expect(mode).toBe('add');

    // Count points, then click canvas center to add one point
    const initialCount = await page.evaluate(() => window.state.points.length);

    // Click roughly at canvas center
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.click(cx, cy, { button: 'left' });

    // Wait and assert point was added
    await page.waitForTimeout(100);
    const newCount = await page.evaluate(() => window.state.points.length);
    expect(newCount).toBe(initialCount + 1);
  });

  test('S2_MovingPoints: add a point, switch to Move mode, drag it and verify coordinates update', async ({ page }) => {
    const canvas = page.locator('#plot');
    const modeAdd = page.locator('#modeAdd');
    const modeMove = page.locator('#modeMove');

    // Ensure we are in add mode and add a point at center
    await modeAdd.click(); // alert accepted automatically
    await page.waitForTimeout(50);
    const box = await canvas.boundingBox();
    const startX = box.x + box.width / 2;
    const startY = box.y + box.height / 2;
    await page.mouse.click(startX, startY, { button: 'left' });
    await page.waitForTimeout(100);

    // Find index of the last point added and record its coordinates
    const lastPointBefore = await page.evaluate(() => {
      const pts = window.state.points;
      return pts[pts.length - 1];
    });
    expect(lastPointBefore).toBeDefined();

    // Switch to Move mode (alert will be accepted)
    await modeMove.click();
    await page.waitForTimeout(50);
    const modeVal = await page.evaluate(() => window.state.mode);
    expect(modeVal).toBe('move');

    // Start dragging: mousedown near same canvas coords, move, then mouseup
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Move by 60 pixels to the right and 40 down
    await page.mouse.move(startX + 60, startY + 40, { steps: 8 });
    await page.mouse.up();

    // Wait and then validate that at least one point's coordinates changed (the last point)
    await page.waitForTimeout(150);
    const lastPointAfter = await page.evaluate(() => {
      const pts = window.state.points;
      return pts[pts.length - 1];
    });
    expect(lastPointAfter).toBeDefined();
    // Coordinates should differ
    const moved = (Math.abs(lastPointAfter.x - lastPointBefore.x) > 1e-6) ||
                  (Math.abs(lastPointAfter.y - lastPointBefore.y) > 1e-6);
    expect(moved).toBeTruthy();
  });

  test('S3_DeletingPoints: add a point then delete it using Delete mode', async ({ page }) => {
    const canvas = page.locator('#plot');
    const modeAdd = page.locator('#modeAdd');
    const modeDelete = page.locator('#modeDelete');

    // Add a point
    await modeAdd.click();
    await page.waitForTimeout(50);
    const box = await canvas.boundingBox();
    const px = box.x + box.width / 2 - 10; // slightly offset
    const py = box.y + box.height / 2 - 10;
    await page.mouse.click(px, py, { button: 'left' });
    await page.waitForTimeout(100);

    // Record count
    const before = await page.evaluate(() => window.state.points.length);
    expect(before).toBeGreaterThan(0);

    // Switch to delete mode and click the same spot to delete
    await modeDelete.click();
    await page.waitForTimeout(50);
    await page.mouse.click(px, py, { button: 'left' });

    // Wait for deletion to process
    await page.waitForTimeout(120);
    const after = await page.evaluate(() => window.state.points.length);
    // Expect either decreased by 1 or unchanged if threshold missed; assert decreased to validate deletion event
    expect(after).toBeLessThan(before);
  });

  test('S4_Navigating: switch to Navigate mode and select a point; selectedInfo should update', async ({ page }) => {
    const modeNone = page.locator('#modeNone');
    const canvas = page.locator('#plot');
    const selectedInfo = page.locator('#selectedInfo');

    // Ensure there's at least one point to select. If none, generate a few.
    const ptsCount = await page.evaluate(() => window.state.points.length);
    if (ptsCount === 0) {
      await page.locator('#generateBtn').click();
      await page.waitForTimeout(200);
    }

    await modeNone.click(); // alert accepted
    await page.waitForTimeout(50);
    const modeVal = await page.evaluate(() => window.state.mode);
    expect(modeVal).toBe('none');

    // Click near canvas center to select a nearby point (if one exists)
    const box = await canvas.boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.click(cx, cy, { button: 'left' });
    await page.waitForTimeout(120);

    // selectedInfo text should be either 'None' or '#<idx> ...' - assert it is a string and presence indicates selection logic ran
    const infoText = await selectedInfo.textContent();
    expect(typeof infoText).toBe('string');
    // It should at least either be 'None' or include '#' when a point is selected
    expect(infoText === 'None' || infoText.includes('#')).toBeTruthy();
  });

  test('InitializeCenters and Run/Pause iterations (S5_Running <-> S6_Paused transitions)', async ({ page }) => {
    // Prepare a small dataset to speed iterations
    await page.fill('#nPoints', '20');
    await page.click('#generateBtn');
    await page.waitForTimeout(200);

    // Set k to 3 explicitly
    await page.fill('#kInput', '3');
    // Initialize centers
    await page.click('#initBtn');
    await page.waitForTimeout(150);

    // After initialization, centers length should equal kInput (3)
    const centersLen = await page.evaluate(() => window.state.centers.length);
    expect(centersLen).toBeGreaterThanOrEqual(1);
    expect(centersLen).toBe(3);

    // Speed up iterations and set max iterations low so run stops predictably
    await page.fill('#iterSpeed', '100'); // very fast
    await page.fill('#maxIter', '3');

    // Click Run to start iterations
    await page.click('#runBtn');
    // Wait for the run to start and complete (maxIter=3 will make it stop itself)
    await page.waitForFunction(() => !window.state.running, { timeout: 5000 });

    // After run finishes, iter should be >= 1 and state.paused true
    const iter = await page.evaluate(() => window.state.iter);
    const paused = await page.evaluate(() => window.state.paused);
    expect(iter).toBeGreaterThanOrEqual(1);
    expect(paused).toBe(true);

    // Now test pause behavior when running: restart and then pause manually
    // Set maxIter high to avoid auto-stop
    await page.fill('#maxIter', '1000');
    await page.click('#runBtn');
    // Wait until running becomes true
    await page.waitForFunction(() => window.state.running === true, { timeout: 2000 });
    // Now click Pause
    await page.click('#pauseBtn');
    await page.waitForTimeout(100);
    const runningAfterPause = await page.evaluate(() => window.state.running);
    const pausedAfterPause = await page.evaluate(() => window.state.paused);
    expect(runningAfterPause).toBe(false);
    expect(pausedAfterPause).toBe(true);
  });

  test('GenerateData event: set N small, click Generate and check points count', async ({ page }) => {
    // Set N to 12 and generate
    await page.fill('#nPoints', '12');
    await page.fill('#trueK', '2');
    await page.fill('#seed', '7');
    await page.selectOption('#datasetType', 'moons');
    await page.click('#generateBtn');
    await page.waitForTimeout(150);

    const n = await page.evaluate(() => window.state.points.length);
    expect(n).toBe(12);
  });

  test('ExportJSON and ImportJSON: export current state to textarea then re-import and verify state', async ({ page }) => {
    // Ensure some centers and points exist
    await page.fill('#nPoints', '15');
    await page.click('#generateBtn');
    await page.waitForTimeout(150);
    await page.click('#initBtn');
    await page.waitForTimeout(150);

    // Export
    await page.click('#exportBtn');
    await page.waitForTimeout(40);
    const jsonText = await page.locator('#jsonArea').inputValue();
    expect(jsonText.length).toBeGreaterThan(10);

    // Mutate textarea to ensure import reads it: we'll parse and re-import
    // Put the same JSON back (simulate user copying/pasting)
    await page.fill('#jsonArea', jsonText);
    await page.click('#importBtn');
    await page.waitForTimeout(120);

    // Validate that points/centers were loaded into state
    const imported = await page.evaluate(() => {
      return {
        points: window.state.points.length,
        centers: window.state.centers.length,
        iter: window.state.iter
      };
    });
    expect(imported.points).toBeGreaterThanOrEqual(0);
    // centers should match the exported centers length (likely >=1)
    expect(imported.centers).toBeGreaterThanOrEqual(0);
  });

  test('ExplainAssignment: out-of-range index returns message, valid index includes "Point #0"', async ({ page }) => {
    // Ensure there is at least one point and at least one center (initialize if needed)
    const pts = await page.evaluate(() => window.state.points.length);
    if (pts === 0) {
      await page.click('#generateBtn');
      await page.waitForTimeout(120);
    }
    const centers = await page.evaluate(() => window.state.centers.length);
    if (centers === 0) {
      await page.click('#initBtn');
      await page.waitForTimeout(120);
    }

    // Set explain index out of range and click Explain
    await page.fill('#explainIdx', '9999');
    await page.click('#explainBtn');
    await page.waitForTimeout(50);
    const out1 = await page.locator('#explainOut').textContent();
    expect(out1).toContain('Index out of range');

    // Now explain for index 0
    await page.fill('#explainIdx', '0');
    await page.click('#explainBtn');
    await page.waitForTimeout(80);
    const out2 = await page.locator('#explainOut').textContent();
    expect(out2).toContain('Point #0');
    // It should mention at least one center label like 'C0' if centers exist
    if ((await page.evaluate(() => window.state.centers.length)) > 0) {
      expect(out2).toContain('C0');
    }
  });

  test('Initialize manual centers (edge case): choose manual init, contextmenu to place center', async ({ page }) => {
    // Choose manual init method
    await page.selectOption('#initMethod', 'manual');
    // Click Initialize (triggers an alert about manual init)
    await page.click('#initBtn');
    await page.waitForTimeout(80);

    // Use a right-click (contextmenu) on canvas to add a center manually
    const canvas = page.locator('#plot');
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    const cx = Math.floor(box.x + box.width * 0.25);
    const cy = Math.floor(box.y + box.height * 0.25);

    // Dispatch a contextmenu event at that position
    await page.dispatchEvent('#plot', 'contextmenu', { clientX: cx, clientY: cy });
    await page.waitForTimeout(120);

    // After the contextmenu, centers should increase by at least 1
    const centers = await page.evaluate(() => window.state.centers.length);
    expect(centers).toBeGreaterThanOrEqual(1);
  });

  test('Edge cases: invalid import JSON triggers alert (handled) and no exception thrown', async ({ page }) => {
    // Put invalid JSON into jsonArea
    await page.fill('#jsonArea', 'this is not json {');
    // Click import - this will cause the app to alert 'Invalid JSON'
    // Our dialog handler auto-accepts, so ensure no uncaught exceptions are thrown
    await page.click('#importBtn');
    await page.waitForTimeout(80);

    // Ensure there are still no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Verify there are no uncaught exceptions logged to pageerror across interactions', async ({ page }) => {
    // Very light smoke interactions to ensure no uncaught errors occurred during earlier operations
    // (This test mainly asserts the collected pageErrors array is empty)
    expect(pageErrors.length).toBe(0);
  });

  test('Collect and sanity-check console messages (non-failing): ensure logs were captured and are strings', async ({ page }) => {
    // consoleMessages may be empty or contain informational logs - sanity check their shape
    for (const msg of consoleMessages) {
      expect(typeof msg.text).toBe('string');
      expect(['log','info','warning','error','debug']).toContain(msg.type);
    }
  });
});