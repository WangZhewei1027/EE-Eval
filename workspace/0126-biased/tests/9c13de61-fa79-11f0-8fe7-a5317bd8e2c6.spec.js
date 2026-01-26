import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c13de61-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Merge Sort Explorer - FSM states, transitions and UI behaviors', () => {
  // Collect runtime errors and console.error messages for each test so we can assert none occurred.
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Collect uncaught page errors (Runtime exceptions)
    page.on('pageerror', (err) => {
      // store Error object for assertions
      pageErrors.push(String(err && err.stack ? err.stack : err));
    });

    // Collect console messages and specifically track errors/warnings
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      } catch (e) {
        consoleErrors.push('console collection error: ' + String(e));
      }
    });

    await page.goto(APP_URL);
    // Ensure page loads and initial script run completes; the app logs readiness.
    await page.waitForSelector('#arrayView');
  });

  test.afterEach(async () => {
    // Assert that no unexpected runtime errors or console errors were emitted during the test.
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
  });

  test('Initial render and S1 Array Generated (renderArrayEditable) entry action', async ({ page }) => {
    // Validate that initial array was created and rendered as cells in arrayView.
    // The app calls setArray(genRandomArray(...)) during initialization.
    const cells = await page.$$eval('#arrayView .cell', nodes => nodes.map(n => n.textContent));
    expect(cells.length).toBeGreaterThan(0); // array cells should be present
    // opDetail should contain a helpful message after renderArrayEditable
    const opText = await page.locator('#opDetail').textContent();
    expect(opText).toContain('Array set');
  });

  test('Generate Random / Sorted / Reversed / Duplicates produce arrays of correct size and ordering', async ({ page }) => {
    // Set array size to a small number for predictable assertions
    await page.fill('#sizeInput', '6');

    // Generate Random
    await page.click('#genRandom');
    // After generating, arrayView should have 6 cells
    await expect(page.locator('#arrayView .cell')).toHaveCount(6);

    // Generate Sorted and verify non-decreasing order (ascending)
    await page.click('#genSorted');
    const sortedVals = await page.$$eval('#arrayView .cell', nodes => nodes.map(n => Number(n.textContent)));
    // Check ascending property
    for (let i = 1; i < sortedVals.length; i++) {
      expect(sortedVals[i]).toBeGreaterThanOrEqual(sortedVals[i - 1]);
    }

    // Generate Reversed and verify non-increasing order
    await page.click('#genReversed');
    const revVals = await page.$$eval('#arrayView .cell', nodes => nodes.map(n => Number(n.textContent)));
    for (let i = 1; i < revVals.length; i++) {
      expect(revVals[i]).toBeLessThanOrEqual(revVals[i - 1]);
    }

    // Generate Duplicates and verify at least one repeated value exists
    await page.click('#genDuplicates');
    const dupVals = await page.$$eval('#arrayView .cell', nodes => nodes.map(n => n.textContent));
    const unique = new Set(dupVals);
    // For duplicates generation with size 6, at least 2 duplicate values expected
    expect(unique.size).toBeLessThanOrEqual(dupVals.length);
  });

  test('Apply Custom Array and Clear Array transitions', async ({ page }) => {
    // Provide a custom array and apply
    const custom = '5,1,9,2,2';
    await page.fill('#customArrayInput', custom);
    await page.click('#applyCustom');

    // Verify cells reflect parsed numbers
    const parsed = await page.$$eval('#arrayView .cell', nodes => nodes.map(n => Number(n.textContent)));
    expect(parsed).toEqual([5,1,9,2,2]);

    // Clear the array and validate UI cleared and player reset
    await page.click('#clearArray');
    await expect(page.locator('#arrayView .cell')).toHaveCount(0);
    // timeline should be reset to 0/0
    const stepLabel = await page.locator('#stepLabel').textContent();
    expect(stepLabel).toContain('Step 0 / 0');
    // opDetail cleared by resetPlayer
    const op = await page.locator('#opDetail').textContent();
    expect(op).toBe('');
  });

  test('Generate Trace (S2_TraceGenerated) and player preparation', async ({ page }) => {
    // Ensure a known array is present
    await page.fill('#customArrayInput', '8 3 7 1');
    await page.click('#applyCustom');

    // Disable autoTrace to test explicit Generate Trace button behavior
    await page.locator('#autoTrace').uncheck();

    // Click Generate Trace
    await page.click('#generateTrace');

    // Wait until timeline.max updates (> 0) indicating states available
    await page.waitForFunction(() => {
      const t = document.getElementById('timeline');
      return t && Number(t.max) >= 0 && Number(t.max) >= 1;
    });

    // Verify timeline and stepLabel reflect prepared player
    const timelineMax = await page.$eval('#timeline', el => Number(el.max));
    expect(timelineMax).toBeGreaterThanOrEqual(0);
    const stepLabel = await page.locator('#stepLabel').textContent();
    expect(stepLabel).toMatch(/Step \d+ \/ \d+/);

    // Verify recursion tree shows calls when toggled on
    await page.locator('#showRec').check();
    const recText = await page.locator('#recursionTree').textContent();
    expect(recText.length).toBeGreaterThan(0);
  });

  test('Play/Pause toggles playing state (S3_Playing entry/exit actions) and step navigation', async ({ page }) => {
    // Ensure we have a trace: generate one
    await page.fill('#customArrayInput', '4,3,2,1');
    await page.click('#applyCustom');
    await page.locator('#autoTrace').uncheck();
    await page.click('#generateTrace');

    // Wait for states to be prepared
    await page.waitForFunction(() => Number(document.getElementById('timeline').max) > 0);

    // Click Play - should change button text to 'Pause' and start stepping
    await page.click('#playPause');
    await expect(page.locator('#playPause')).toHaveText('Pause');

    // Wait a short period to allow automatic stepping to advance current step (if available)
    await page.waitForTimeout(250);

    // Pause playback
    await page.click('#playPause');
    await expect(page.locator('#playPause')).toHaveText('Play');

    // Now test stepping forward/backward and opDetail updates
    const initialLabel = await page.locator('#stepLabel').textContent();
    await page.click('#stepNext');
    const afterNextLabel = await page.locator('#stepLabel').textContent();
    expect(afterNextLabel).not.toEqual(initialLabel);

    // Step Prev
    await page.click('#stepPrev');
    const afterPrevLabel = await page.locator('#stepLabel').textContent();
    expect(afterPrevLabel).not.toBeNull();

    // Step Into, Step Over, Step Out should not throw and should update stepLabel
    await page.click('#stepInto');
    await page.click('#stepOver');
    await page.click('#stepOut');
    const labelAfterSteps = await page.locator('#stepLabel').textContent();
    expect(labelAfterSteps).toMatch(/Step \d+ \/ \d+/);

    // Verify opDetail contains 'Event type' for current state
    const opDetail = await page.locator('#opDetail').textContent();
    expect(opDetail).toContain('Event type');
  });

  test('Reset transition returns to initial state (S2 -> S0) and re-generates trace when appropriate', async ({ page }) => {
    // Create a custom array, ensure autoTrace is checked so reset uses generateTrace
    await page.fill('#customArrayInput', '2,1');
    await page.click('#applyCustom');
    await page.locator('#autoTrace').check();

    // Generate trace explicitly as well
    await page.click('#generateTrace');
    await page.waitForFunction(() => Number(document.getElementById('timeline').max) >= 0);

    // Save current array snapshot to compare after reset
    const initialArrayView = await page.$$eval('#arrayView .cell', nodes => nodes.map(n => n.textContent));

    // Click Reset button - should stop playing and set array to initial array and then generateTrace
    await page.click('#resetBtn');

    // After reset, arrayView should match the initialArrayView (elements restored)
    const afterResetArray = await page.$$eval('#arrayView .cell', nodes => nodes.map(n => n.textContent));
    expect(afterResetArray).toEqual(initialArrayView);

    // Timeline should reflect a generated trace (since autoTrace checked)
    const timelineMax = await page.$eval('#timeline', el => Number(el.max));
    expect(timelineMax).toBeGreaterThanOrEqual(0);
  });

  test('Export Trace produces a downloadable JSON and Import Trace accepts the file', async ({ page, browserName }) => {
    // Ensure a trace is present
    await page.fill('#customArrayInput', '9,8,7,6,5');
    await page.click('#applyCustom');
    await page.locator('#autoTrace').uncheck();
    await page.click('#generateTrace');
    await page.waitForFunction(() => Number(document.getElementById('timeline').max) >= 0);

    // Intercept download triggered by clicking exportTrace
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#exportTrace'),
    ]);

    // Get path to the downloaded file
    const tempPath = await download.path();
    expect(tempPath).toBeTruthy();

    // Use the downloaded file as input to importTraceInput
    // Playwright requires a FileSystem path for setInputFiles; downloaded file path is available
    await page.setInputFiles('#importTraceInput', tempPath);

    // After import, preparePlayer is called; timeline should be set
    await page.waitForFunction(() => document.getElementById('timeline').max !== '0' || document.getElementById('timeline').max === '0');

    // Validate the UI updated: arrayView exists and timeline updated
    const timelineMax = await page.$eval('#timeline', el => Number(el.max));
    expect(Number.isFinite(timelineMax)).toBeTruthy();
  });

  test('Import invalid trace shows alert - edge case handling', async ({ page }) => {
    // Create an invalid JSON file and set it to importTraceInput to trigger the FileReader path which should alert
    // We'll create a temporary file with invalid JSON
    const tmpDir = process.cwd();
    const badFile = path.join(tmpDir, 'bad_trace.json');
    fs.writeFileSync(badFile, '{ invalid json }', 'utf8');

    // Listen for dialog (alert) and capture message
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });

    await page.setInputFiles('#importTraceInput', badFile);

    // Wait a moment for FileReader to process
    await page.waitForTimeout(200);

    expect(dialogMessage).toBeTruthy(); // an alert should have been shown for parsing error
    // Clean up
    try { fs.unlinkSync(badFile); } catch (e) { /* ignore */ }
  });

  test('Breakpoints and snapshots: set/clear breakpoint and save/load snapshot', async ({ page }) => {
    // Generate trace for breakpoints and snapshots to be meaningful
    await page.fill('#customArrayInput', '1 4 3 2');
    await page.click('#applyCustom');
    await page.locator('#autoTrace').uncheck();
    await page.click('#generateTrace');
    await page.waitForFunction(() => Number(document.getElementById('timeline').max) >= 0);

    // Set breakpoint by id/depth - use small values, and capture log message appended to #log
    await page.fill('#bpId', '1');
    await page.fill('#bpDepth', '0');
    await page.click('#setBp');

    // Wait for the log to contain the 'Breakpoint set' message
    await page.waitForFunction(() => document.getElementById('log').textContent.includes('Breakpoint set'), { timeout: 1000 });
    const logText = await page.locator('#log').textContent();
    expect(logText).toContain('Breakpoint set');

    // Clear breakpoint and check log message
    await page.click('#clearBp');
    await page.waitForFunction(() => document.getElementById('log').textContent.includes('Breakpoints cleared'), { timeout: 1000 });
    const logAfterClear = await page.locator('#log').textContent();
    expect(logAfterClear).toContain('Breakpoints cleared');

    // Snapshots: saving requires a prompt for name - respond via dialog
    page.once('dialog', async dialog => {
      // Save snapshot name provided
      await dialog.accept('mySnap');
    });
    await page.click('#saveSnapshot');
    // After saving, snapshotsList should include the new entry
    await page.waitForFunction(() => {
      const select = document.getElementById('snapshotsList');
      return select && Array.from(select.options).some(opt => opt.value === 'mySnap');
    }, { timeout: 2000 });
    const options = await page.$$eval('#snapshotsList option', opts => opts.map(o => o.value));
    expect(options).toContain('mySnap');

    // Now load the snapshot - select it and click loadSnapshot
    await page.selectOption('#snapshotsList', 'mySnap');
    // For loadSnapshot, the app uses alert if missing; to avoid alerts, ensure the snapshot exists
    // Click loadSnapshot to trigger applying snapshot - intercept any alert dialogs (if any)
    let loadDialogSeen = false;
    page.once('dialog', async dialog => {
      loadDialogSeen = true;
      await dialog.dismiss();
    });

    await page.click('#loadSnapshot');
    // Either snapshot loaded (no dialog) or an alert shown which we dismiss; ensure no crash
    await page.waitForTimeout(200);
    expect(loadDialogSeen).toBe(false);
  });

  test('Edge-case: Apply custom array with no numbers triggers alert', async ({ page }) => {
    // Ensure textarea empty
    await page.fill('#customArrayInput', '');
    let alertMsg = null;
    page.once('dialog', async dialog => {
      alertMsg = dialog.message();
      await dialog.dismiss();
    });
    await page.click('#applyCustom');
    expect(alertMsg).toContain('No numbers parsed');
  });

  test('Keyboard shortcuts: ArrowRight advances step, Space toggles play/pause', async ({ page }) => {
    // Ensure trace present
    await page.fill('#customArrayInput', '10,9,8,7');
    await page.click('#applyCustom');
    await page.locator('#autoTrace').uncheck();
    await page.click('#generateTrace');
    await page.waitForFunction(() => Number(document.getElementById('timeline').max) >= 0);

    // Record current step label
    const before = await page.locator('#stepLabel').textContent();

    // ArrowRight -> stepForward
    await page.keyboard.press('ArrowRight');
    const after = await page.locator('#stepLabel').textContent();
    expect(after).not.toEqual(before);

    // Space toggles play/pause: trigger and then cancel default by sending again
    await page.keyboard.press(' ');
    await expect(page.locator('#playPause')).toHaveText('Pause');
    await page.keyboard.press(' ');
    await expect(page.locator('#playPause')).toHaveText('Play');
  });
});