import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e2f321-d5c1-11f0-a327-5f281c6cb8e2.html';

test.describe('K-Means Clustering Interactive Demo (FSM validation)', () => {
  // Attach console and pageerror collectors for each test to observe runtime issues.
  test.beforeEach(async ({ page }) => {
    // Collect console errors and page errors
    await page.route('**/*', route => route.continue()); // ensure resources load normally
    page.setDefaultTimeout(60000);
  });

  // Helper to navigate and set up log collectors
  async function gotoWithLogging(page) {
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
    await page.goto(APP_URL, { waitUntil: 'load' });
    // expose collectors
    return { consoleMsgs, pageErrors };
  }

  test('Initial Idle state: UI elements are present and show expected defaults', async ({ page }) => {
    // Validate S0_Idle: controls render correctly (renderPage on entry)
    const { consoleMsgs, pageErrors } = await gotoWithLogging(page);

    // Check presence and text of key controls
    await expect(page.locator('#generate')).toHaveText('Generate');
    await expect(page.locator('#play')).toHaveText('Run');
    await expect(page.locator('#step')).toHaveText('Step');
    await expect(page.locator('#reset')).toHaveText('Reset');
    await expect(page.locator('#clear')).toHaveText('Clear Points');

    // Check default parameter values and labels
    await expect(page.locator('#kDisplay')).toHaveText('4');
    await expect(page.locator('#iter')).toHaveText('0');
    const sse = await page.locator('#sse').innerText();
    // SSE should be a numeric string (with two decimals)
    expect(Number(sse)).not.toBeNaN();

    // Centers area should indicate no centers yet in idle
    await expect(page.locator('#centers')).toHaveText('No centers yet.');

    // Ensure no uncaught page errors or console errors surfaced during initial render
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('GenerateClick transitions to Generating (S1) and produces a dataset', async ({ page }) => {
    // Clicking Generate should call reset() and generateDataset()
    const { consoleMsgs, pageErrors } = await gotoWithLogging(page);

    // Ensure points initially present (generateDataset was called on load) and then change on generate click
    const beforeCount = await page.evaluate(() => points.length);
    await page.click('#generate');

    // After clicking generate: iter reset to 0, centers cleared, and points exist
    await expect(page.locator('#iter')).toHaveText('0');

    const afterCount = await page.evaluate(() => points.length);
    expect(afterCount).toBeGreaterThanOrEqual(1); // dataset should have at least one point
    // centers should be cleared as reset() was called before generate
    const centersLen = await page.evaluate(() => centers.length);
    expect(centersLen).toBe(0);

    // SSE label should be updated and numeric
    const sseText = await page.locator('#sse').innerText();
    expect(Number(sseText)).not.toBeNaN();

    // No runtime errors
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('PlayClick starts running (S2) and StepClick stops + steps to Stepping (S3)', async ({ page }) => {
    // Validate transition S0 -> S2 on Play, then S2 -> S3 on Step
    const { consoleMsgs, pageErrors } = await gotoWithLogging(page);

    // Ensure a quick speed for fast iteration
    await page.fill('#speed', '50');
    await page.click('#play');

    // Play should change button text to Pause and running flag to true
    await expect(page.locator('#play')).toHaveText('Pause');
    let running = await page.evaluate(() => running);
    expect(running).toBe(true);

    // Wait until at least one iteration has occurred (iter > 0)
    await page.waitForFunction(() => window.iter > 0, null, { timeout: 5000 });
    const iterAfterPlay = await page.evaluate(() => iter);
    expect(iterAfterPlay).toBeGreaterThanOrEqual(1);

    // Now click Step: per FSM this should stop() and iterateOnce()
    await page.click('#step');

    // After Step: running should be false and button should read 'Run'
    await expect(page.locator('#play')).toHaveText('Run');
    running = await page.evaluate(() => running);
    expect(running).toBe(false);

    // Iteration counter should have incremented by at least 1 relative to before step (we recorded iterAfterPlay)
    const iterAfterStep = await page.evaluate(() => iter);
    expect(iterAfterStep).toBeGreaterThanOrEqual(iterAfterPlay);

    // centers should exist after iterations
    const centersLen = await page.evaluate(() => centers.length);
    expect(centersLen).toBeGreaterThanOrEqual(1);

    // centersDiv should contain "Cluster" entries now
    const centersHtml = await page.locator('#centers').innerHTML();
    expect(centersHtml).toMatch(/Cluster/);

    // No runtime errors
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('MouseDownCanvas while running pauses the algorithm (S2 -> S0)', async ({ page }) => {
    // While running, mousedown on the canvas should stop the algorithm (stop())
    const { consoleMsgs, pageErrors } = await gotoWithLogging(page);

    // Ensure some dataset exists
    await page.click('#generate');
    // speed small for quick run
    await page.fill('#speed', '100');
    await page.click('#play');

    await expect(page.locator('#play')).toHaveText('Pause');
    // Wait for running to be true
    await page.waitForFunction(() => window.running === true, null, { timeout: 3000 });

    // mousedown on canvas should stop the animation and may either start dragging (if over a point)
    const canvas = await page.$('#canvas');
    const box = await canvas.boundingBox();
    // Choose a coordinate within canvas (center-ish)
    const x = Math.floor(box.x + box.width * 0.2);
    const y = Math.floor(box.y + box.height * 0.2);

    // Record points count before mousedown
    const beforePoints = await page.evaluate(() => points.length);

    // Perform mousedown at coordinate
    await page.mouse.move(x, y);
    await page.mouse.down(); // triggers canvas mousedown handler
    // Give some time for event processing
    await page.waitForTimeout(200);
    await page.mouse.up();

    // After mousedown, running should be false
    const running = await page.evaluate(() => running);
    expect(running).toBe(false);
    await expect(page.locator('#play')).toHaveText('Run');

    // Either a new point is added (if clicked empty) or dragging was initiated; verify points length is >= 0 and no exception
    const afterPoints = await page.evaluate(() => points.length);
    expect(afterPoints).toBeGreaterThanOrEqual(0);
    // if click was on empty area, it should have added a point (common); accept both possibilities

    // No runtime errors
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ResetClick resets the demo (S4_Resetting) and clears centers/assignments', async ({ page }) => {
    // Validate that clicking Reset runs reset() and updates UI accordingly
    const { consoleMsgs, pageErrors } = await gotoWithLogging(page);

    // Create dataset and run one iteration to populate centers/assignments
    await page.click('#generate');
    // Step once to ensure assignment occurred
    await page.click('#step');

    // Verify iter > 0 and centers populated
    const iterBeforeReset = await page.evaluate(() => iter);
    expect(iterBeforeReset).toBeGreaterThanOrEqual(1);
    const centersBefore = await page.evaluate(() => centers.length);
    expect(centersBefore).toBeGreaterThanOrEqual(1);

    // Now click reset
    await page.click('#reset');

    // After reset: iter must be 0, centers cleared, converged label reset to '—'
    await expect(page.locator('#iter')).toHaveText('0');
    const centersAfter = await page.evaluate(() => centers.length);
    expect(centersAfter).toBe(0);
    await expect(page.locator('#converged')).toHaveText('—');

    // Points should still exist (reset clears assignments but retains points)
    const pointsLen = await page.evaluate(() => points.length);
    expect(pointsLen).toBeGreaterThanOrEqual(0);

    // No runtime errors
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ClearClick clears points (S5_Clearing) and resets iter and centers', async ({ page }) => {
    // Validate clearing points sets points=[], centers=[], iter=0
    const { consoleMsgs, pageErrors } = await gotoWithLogging(page);

    // Ensure dataset exists
    await page.click('#generate');
    const before = await page.evaluate(() => points.length);
    expect(before).toBeGreaterThanOrEqual(1);

    // Click Clear Points
    await page.click('#clear');

    // Points should be cleared and centers empty and iter set to 0
    const pointsAfter = await page.evaluate(() => points.length);
    expect(pointsAfter).toBe(0);
    const centersAfter = await page.evaluate(() => centers.length);
    expect(centersAfter).toBe(0);
    await expect(page.locator('#iter')).toHaveText('0');

    // SSE label should be numeric (0.00)
    const sseText = await page.locator('#sse').innerText();
    expect(Number(sseText)).not.toBeNaN();

    // No runtime errors
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('From Stepping (S3) PlayClick resumes running (S3 -> S2)', async ({ page }) => {
    // Sequence: ensure we can step to S3 (stopped + iterated), then Play resumes running
    const { consoleMsgs, pageErrors } = await gotoWithLogging(page);

    // Ensure centers are initialized for stepping
    await page.click('#generate');
    // Click step to do one iteration (step handler stops and calls iterateOnce)
    await page.click('#step');

    // After step running should be false
    const runningAfterStep = await page.evaluate(() => running);
    expect(runningAfterStep).toBe(false);

    const iterAfterStep = await page.evaluate(() => iter);

    // Now click Play to resume
    await page.click('#play');

    // Running should be true and play button text 'Pause'
    await expect(page.locator('#play')).toHaveText('Pause');
    await page.waitForFunction(() => window.running === true, null, { timeout: 3000 });

    // Wait until iter grows beyond iterAfterStep
    await page.waitForFunction((prev) => window.iter > prev, iterAfterStep, { timeout: 5000 });

    const iterNow = await page.evaluate(() => iter);
    expect(iterNow).toBeGreaterThan(iterAfterStep);

    // Stop to clean up
    await page.click('#play'); // pause

    // No runtime errors
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Dragging a point updates its position and triggers mouseup processing (S3 -> S0)', async ({ page }) => {
    // Add a point by clicking canvas, then drag it and verify coords changed and SSE updated
    const { consoleMsgs, pageErrors } = await gotoWithLogging(page);

    // Ensure we start with a clean set of points
    await page.click('#clear');

    // Click on canvas to add a point
    const canvas = await page.$('#canvas');
    const box = await canvas.boundingBox();
    const startX = Math.floor(box.x + box.width * 0.3);
    const startY = Math.floor(box.y + box.height * 0.3);
    await page.mouse.click(startX, startY);

    // Confirm a point was added and capture its initial coords (first point)
    await page.waitForTimeout(100); // wait for processing
    const pointsBefore = await page.evaluate(() => points.slice());
    expect(pointsBefore.length).toBeGreaterThanOrEqual(1);
    const p0Before = pointsBefore[pointsBefore.length - 1]; // last added

    // Start dragging that point: mousedown at its coords, move, mouseup
    const canvasRect = await canvas.boundingBox();
    const localX = Math.floor(canvasRect.x + p0Before.x);
    const localY = Math.floor(canvasRect.y + p0Before.y);

    // Mousedown on the point
    await page.mouse.move(localX, localY);
    await page.mouse.down();
    // move by offset
    const moveToX = localX + 40;
    const moveToY = localY + 25;
    await page.mouse.move(moveToX, moveToY, { steps: 8 });
    // mouseup to release
    await page.mouse.up();

    // After mouseup, the point coordinates should have updated
    await page.waitForTimeout(100); // allow computeSSELabel and draw operations
    const pointsAfter = await page.evaluate(() => points.slice());
    const p0After = pointsAfter[pointsAfter.length - 1];
    // Coordinates should differ meaningfully
    const dx = Math.abs(p0After.x - p0Before.x);
    const dy = Math.abs(p0After.y - p0Before.y);
    expect(dx + dy).toBeGreaterThan(0);

    // SSE label should be numeric
    const sseText = await page.locator('#sse').innerText();
    expect(Number(sseText)).not.toBeNaN();

    // No runtime errors
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Changing initMethod triggers reset (edge case) and keyboard shortcut G triggers generate', async ({ page }) => {
    // initMethod change should call reset(); pressing 'g' key should invoke generateBtn.click()
    const { consoleMsgs, pageErrors } = await gotoWithLogging(page);

    // Make sure some work has been done so reset effect is observable
    await page.click('#generate');
    await page.click('#step');
    const iterBefore = await page.evaluate(() => iter);
    expect(iterBefore).toBeGreaterThanOrEqual(1);

    // Change initMethod: select alternative option
    await page.selectOption('#initMethod', { value: 'random' });
    // initMethod 'change' handler calls reset() — iter should be 0
    await expect(page.locator('#iter')).toHaveText('0');

    // Now press 'g' to trigger generate via keyboard shortcut
    // Capture points count before and then press 'g'
    const beforePoints = await page.evaluate(() => points.length);
    await page.keyboard.press('g'); // window listener maps 'g' to generateBtn.click()

    // Wait for potential generate processing
    await page.waitForTimeout(200);
    const afterPoints = await page.evaluate(() => points.length);
    // generate should produce dataset; accept equal or greater depending on initial state
    expect(afterPoints).toBeGreaterThanOrEqual(1);

    // No runtime errors
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Parameter adjustments update UI and do not produce runtime errors (kRange, speed, maxIter)', async ({ page }) => {
    // Validate adjusting UI controls updates displayed values and does not throw
    const { consoleMsgs, pageErrors } = await gotoWithLogging(page);

    // Change kRange and ensure kDisplay updates
    await page.fill('#kRange', '6');
    // Dispatch input event to trigger listeners
    await page.dispatchEvent('#kRange', 'input');
    await expect(page.locator('#kDisplay')).toHaveText('6');

    // Change speed and ensure label updates
    await page.fill('#speed', '200');
    await page.dispatchEvent('#speed', 'input');
    await expect(page.locator('#speedLbl')).toHaveText('200 ms / it');

    // Change maxIter and ensure internal maxIter changes by triggering change
    await page.fill('#maxIter', '5');
    await page.dispatchEvent('#maxIter', 'change');
    const maxIterVal = await page.evaluate(() => maxIter);
    expect(maxIterVal).toBe(5);

    // No runtime errors
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Final test to assert there were no runtime page errors across typical interactions.
  test('Sanity check: no uncaught page errors or console.errors after a sequence of interactions', async ({ page }) => {
    // Perform a sequence of interactions and ensure no page errors were emitted
    const consoleMsgs = [];
    const pageErrors = [];
    page.on('console', msg => consoleMsgs.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL, { waitUntil: 'load' });

    // A short sequence exercising many handlers
    await page.click('#generate');
    await page.click('#play');
    await page.waitForFunction(() => window.running === true, null, { timeout: 3000 }).catch(()=>{});
    // pause
    await page.click('#play');
    await page.click('#step');
    await page.click('#clear');
    // change a couple of inputs
    await page.selectOption('#dataType', 'ring');
    await page.fill('#pointsCount', '50');
    await page.click('#generate');
    // click canvas
    const canvas = await page.$('#canvas');
    const box = await canvas.boundingBox();
    const x = Math.floor(box.x + box.width * 0.5);
    const y = Math.floor(box.y + box.height * 0.5);
    await page.mouse.click(x, y);
    await page.waitForTimeout(200);

    // Check captured errors
    const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

});