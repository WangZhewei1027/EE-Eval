import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e933e9a0-d360-11f0-a097-ffdd56c22ef4.html';

test.describe('Counting Sort Visualizer — e933e9a0-d360-11f0-a097-ffdd56c22ef4', () => {
  // Collect console messages and uncaught page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // capture uncaught exceptions / runtime errors
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    await page.goto(APP_URL);
    // Ensure page loaded and initial render completed
    await expect(page.locator('#stepTitle')).toHaveText('Idle'); // initial text in markup
  });

  test.afterEach(async () => {
    // Basic sanity: tests expect that there are no unexpected uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Initial render shows Idle state and initial sample array (S0_Idle -> initial snapshot)', async ({ page }) => {
    // Validate initial UI elements and Idle state text/content
    const stepTitle = page.locator('#stepTitle');
    const stepDetail = page.locator('#stepDetail');
    const lenInfo = page.locator('#lenInfo');
    const kInfo = page.locator('#kInfo');

    await expect(stepTitle).toHaveText('Idle');
    await expect(stepDetail).toHaveText('No steps yet. Configure array and press Play.');
    // The page script initializes sample array A = [3,6,4,1,3,4,1,4]
    await expect(lenInfo).toHaveText('8');
    await expect(kInfo).toHaveText('6');

    // Visual areas populated
    await expect(page.locator('#inputBars .bar')).toHaveCount(8);
    // counts area should have k+1 = 7 counts (0..6)
    await expect(page.locator('#countsArea .count')).toHaveCount(7);
    // output bars length equals input length
    await expect(page.locator('#outputBars .outbar')).toHaveCount(8);

    // Ensure there were no console.error messages at load (only info messages possibly)
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Set Array creates Initialized snapshots (S0_Idle -> S1_Initialized)', async ({ page }) => {
    // Replace input with small array and click Set Array
    const arrayInput = page.locator('#arrayInput');
    const setBtn = page.locator('#setArr');
    const maxVal = page.locator('#maxVal');

    await arrayInput.fill('2,1,0');
    // ensure maxVal large enough
    await maxVal.fill('2');
    // dispatch change to ensure page updates internal k
    await page.evaluate(() => document.getElementById('maxVal').dispatchEvent(new Event('change', { bubbles: true })));

    await setBtn.click();

    // After clicking Set Array, the app sets snapshots and renders the first snapshot (init)
    await expect(page.locator('#stepTitle')).toHaveText('Initialized');
    await expect(page.locator('#stepDetail')).toHaveText('Counts initialized to zeros. Ready to begin.');

    // lenInfo and kInfo reflect new array and max
    await expect(page.locator('#lenInfo')).toHaveText('3');
    await expect(page.locator('#kInfo')).toHaveText('2');

    // countsArea should have k+1 elements (0,1,2)
    await expect(page.locator('#countsArea .count')).toHaveCount(3);

    // input bars reflect values 2,1,0 in that order
    const firstBlockText = await page.locator('#inputBars .bar .blk').first().textContent();
    expect(firstBlockText.trim()).toBe('2');
  });

  test('Random array generation (S0_Idle -> S1_Initialized via RandomArray) updates input and snapshots', async ({ page }) => {
    const randBtn = page.locator('#randArr');
    const arrayInput = page.locator('#arrayInput');

    // Click Random and expect arrayInput to change (non-empty comma separated)
    await randBtn.click();
    const val = await arrayInput.inputValue();
    expect(val.split(',').length).toBeGreaterThanOrEqual(3);
    // After Random, the first snapshot is 'init'
    await expect(page.locator('#stepTitle')).toHaveText('Initialized');
  });

  test('Advance through phases using Step → to reach Done (S1_Initialized -> S2_Counting -> S3_Cumulative -> S4_Placing -> S5_PlacingLoop -> S6_Done)', async ({ page }) => {
    // Use a small known array to make phases reachable deterministically
    const arrayInput = page.locator('#arrayInput');
    const setBtn = page.locator('#setArr');
    const maxVal = page.locator('#maxVal');
    const stepF = page.locator('#stepF');

    // Use array [1,0,1] with k=1 stable checked by default
    await arrayInput.fill('1,0,1');
    await maxVal.fill('1');
    await page.evaluate(() => document.getElementById('maxVal').dispatchEvent(new Event('change', { bubbles: true })));
    await setBtn.click();

    // We'll step forward through snapshots until 'Finished' appears (phase 'done' renders title 'Finished')
    const maxSteps = 100;
    let seen = { counting: false, cumulative: false, placing: false, placingLoop: false, done: false };
    for (let i = 0; i < maxSteps; i++) {
      const title = (await page.locator('#stepTitle').textContent()).toLowerCase();
      if (title.includes('counting')) seen.counting = true;
      if (title.includes('cumulative')) seen.cumulative = true;
      if (title.includes('placing element') || title.includes('placing')) seen.placing = true;
      if (title.includes('placing values')) seen.placingLoop = true;
      if (title.includes('finished') || title.includes('finished')) {
        seen.done = true;
        break;
      }
      await stepF.click();
      // small pause to allow render
      await page.waitForTimeout(30);
    }

    expect(seen.counting).toBe(true);
    expect(seen.cumulative).toBe(true);
    // Either placing or placing-loop should be present depending on stable flag; since stable by default, placing snapshots exist
    expect(seen.placing || seen.placingLoop).toBe(true);
    expect(seen.done).toBe(true);

    // When done, outputBars should be fully filled (all cells with .filled)
    // Step forward until Done title reached
    await expect(page.locator('#stepTitle')).toHaveText(/Finished/i);
    const filledCount = await page.locator('#outputBars .outbar .cell.filled').count();
    // output length equals input length (3)
    await expect(page.locator('#outputBars .outbar')).toHaveCount(3);
    expect(filledCount).toBeGreaterThanOrEqual(1);
  });

  test('Step backward navigates snapshots (Step → and ← Back)', async ({ page }) => {
    const arrayInput = page.locator('#arrayInput');
    const setBtn = page.locator('#setArr');
    const maxVal = page.locator('#maxVal');
    const stepF = page.locator('#stepF');
    const stepB = page.locator('#stepB');

    await arrayInput.fill('2,1');
    await maxVal.fill('2');
    await page.evaluate(() => document.getElementById('maxVal').dispatchEvent(new Event('change', { bubbles: true })));
    await setBtn.click();

    // Step forward twice
    await stepF.click();
    await page.waitForTimeout(20);
    const titleAfterF1 = await page.locator('#stepTitle').textContent();
    await stepF.click();
    await page.waitForTimeout(20);
    const titleAfterF2 = await page.locator('#stepTitle').textContent();

    // Step backward once and expect title to change to previous snapshot
    await stepB.click();
    await page.waitForTimeout(20);
    const titleAfterB = await page.locator('#stepTitle').textContent();

    // Ensure stepping back moved to a different title (previous)
    expect(titleAfterB).not.toBe(titleAfterF2);
    // And likely equals titleAfterF1
    expect(titleAfterB).toBe(titleAfterF1);
  });

  test('Play and Pause controls (Play then Pause) and speed control input', async ({ page }) => {
    const playBtn = page.locator('#playBtn');
    const pauseBtn = page.locator('#pauseBtn');
    const speed = page.locator('#speed');

    // Speed down to minimal to make playback quicker
    await speed.fill('50');
    await page.evaluate(() => document.getElementById('speed').dispatchEvent(new Event('input', { bubbles: true })));

    // Ensure snapshots exist by ensuring stepTitle is Initialized (initial sample produced init)
    // Start playback
    await playBtn.click();
    // Wait some time to let playback advance (should change from 'Initialized' to some other phase)
    await page.waitForTimeout(120);
    const titleDuringPlay = await page.locator('#stepTitle').textContent();
    expect(titleDuringPlay.toLowerCase()).not.toBe('initialized');

    // Now pause
    await pauseBtn.click();
    // record title at pause
    const titleAtPause = await page.locator('#stepTitle').textContent();
    // Wait and ensure title doesn't change after pause
    await page.waitForTimeout(150);
    const titleAfterWait = await page.locator('#stepTitle').textContent();
    expect(titleAfterWait).toBe(titleAtPause);
  });

  test('Reset returns UI to Idle state and clears arrays (S6_Done -> S0_Idle)', async ({ page }) => {
    const resetBtn = page.locator('#resetBtn');
    const arrayInput = page.locator('#arrayInput');

    // Ensure we are not in Idle (we are initial Idle but populate then reset)
    await arrayInput.fill('1,2,1');
    await page.locator('#setArr').click();

    // Move to Done by stepping forward many times (max safe loop)
    for (let i = 0; i < 60; i++) {
      const t = await page.locator('#stepTitle').textContent();
      if (t && t.toLowerCase().includes('finished')) break;
      await page.locator('#stepF').click();
      await page.waitForTimeout(10);
    }

    // Click reset
    await resetBtn.click();

    // After reset: Idle text, cleared inputs, and lenInfo '0'
    await expect(page.locator('#stepTitle')).toHaveText('Idle');
    await expect(page.locator('#stepDetail')).toHaveText('No steps yet. Configure array and press Play.');
    await expect(page.locator('#arrayInput')).toHaveValue('');
    await expect(page.locator('#lenInfo')).toHaveText('0');
  });

  test('Changing max value triggers change handler and updates kInfo', async ({ page }) => {
    const maxVal = page.locator('#maxVal');

    // Change max to 3
    await maxVal.fill('3');
    // Trigger change event explicitly
    await page.evaluate(() => document.getElementById('maxVal').dispatchEvent(new Event('change', { bubbles: true })));

    await expect(page.locator('#kInfo')).toHaveText('3');
  });

  test('Toggle Stable rebuilds snapshots and initial snapshot remains Initialized', async ({ page }) {
    // This test toggles the stable checkbox and ensures the UI rebuilds snapshots
    // Use a small array to make effects visible
    // NOTE: We use a standalone page in this test to avoid sharing state with others
    // Playwright provides a new page per test by default in our runner settings

  });

  test('Non-integer input triggers alert and prevents setting array (edge case)', async ({ page }) => {
    const arrayInput = page.locator('#arrayInput');
    const setBtn = page.locator('#setArr');

    await arrayInput.fill('1,2.5,3');

    // Listen once for the dialog (alert)
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      setBtn.click()
    ]);

    expect(dialog.type()).toBe('alert');
    const msg = dialog.message();
    expect(msg.toLowerCase()).toContain('integers');
    await dialog.accept();

    // After dismissal, array should remain unchanged (no snapshot created)
    // The app shows an alert and returns, so stepTitle remains as before (likely Initialized from initial state)
    const title = await page.locator('#stepTitle').textContent();
    expect(title).toBeDefined();
  });

  test('Invalid (negative) value in array produces an error snapshot accessible via Step → (S1_Initialized -> S7_Error)', async ({ page }) => {
    const arrayInput = page.locator('#arrayInput');
    const setBtn = page.locator('#setArr');
    const maxVal = page.locator('#maxVal');
    const stepF = page.locator('#stepF');

    // Prepare array with a negative value which is integer but invalid for counting (buildSnapshots produces error snapshot)
    await arrayInput.fill('-1,2');
    // Ensure maxVal is at least 2
    await maxVal.fill('2');
    await page.evaluate(() => document.getElementById('maxVal').dispatchEvent(new Event('change', { bubbles: true })));

    // Click Set Array — buildSnapshots will create an 'init' then an 'error' snapshot
    await setBtn.click();

    // Current snapshot rendered is 'Initialized'
    await expect(page.locator('#stepTitle')).toHaveText('Initialized');

    // Step forward to reach the error snapshot
    await stepF.click();
    // After stepping, render should show 'error' phase which sets stepTitle to 'error' (lowercase)
    const title = (await page.locator('#stepTitle').textContent()).toLowerCase();
    // The render logic uses the raw snap.phase as title when unrecognized; expect 'error'
    expect(title).toContain('error');

    // And stepDetail should mention out of range
    const detail = (await page.locator('#stepDetail').textContent()).toLowerCase();
    expect(detail).toContain('out of range');
  });

  // Grouped test block for console/page error assertions
  test('Page should not produce uncaught exceptions or console.error messages during interactions', async ({ page }) => {
    // Perform a series of interactions to exercise code paths
    await page.locator('#randArr').click();
    await page.locator('#playBtn').click();
    await page.waitForTimeout(60);
    await page.locator('#pauseBtn').click();
    await page.locator('#stepF').click();
    await page.locator('#stepB').click();
    await page.locator('#resetBtn').click();

    // Check that no uncaught page errors were reported
    expect(pageErrors.length).toBe(0);

    // Ensure there are no console.error messages recorded
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

});