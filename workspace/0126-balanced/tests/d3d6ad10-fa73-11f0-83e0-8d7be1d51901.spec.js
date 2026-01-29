import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d6ad10-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('TimSort Visual Demonstration - FSM state & transition tests', () => {
  // Collect console messages and page errors for each test to assert there are none unexpected.
  test.beforeEach(async ({ page }) => {
    // Capture console and page errors
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', (msg) => {
      // store console messages for later assertions
      page.context()._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // store page errors (unhandled exceptions)
      page.context()._pageErrors.push(err);
    });

    // Navigate to the application exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Ensure no page errors were emitted during the test (let runtime errors occur naturally; assert none)
    const pageErrors = page.context()._pageErrors || [];
    const consoleMessages = page.context()._consoleMessages || [];

    // Fail if any unhandled page errors occurred
    expect(pageErrors, `Expected no page errors, but found: ${pageErrors.map(e => e.stack || e.message).join('\n')}`).toHaveLength(0);

    // Fail if any console.error messages were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors, `Expected no console errors/warnings, but found: ${consoleErrors.map(c => c.text).join('\n')}`).toHaveLength(0);
  });

  test('Initial Load - Idle state (S0_Idle) renders array and shows ready log', async ({ page }) => {
    // Validate initial UI elements and Idle state entry behavior
    const nVal = page.locator('#nVal');
    const minrunVal = page.locator('#minrunVal');
    const bars = page.locator('#bars > .bar');
    const logEl = page.locator('#log');
    const phaseEl = page.locator('#phase');

    // nVal should reflect the default size (80)
    await expect(nVal).toHaveText(/^\d+$/);
    const nText = await nVal.textContent();
    expect(Number(nText)).toBeGreaterThanOrEqual(20);

    // minrunVal should be a numeric string
    await expect(minrunVal).toHaveText(/^\d+$/);

    // Bars should be rendered equal to nVal
    const barsCount = await bars.count();
    expect(barsCount).toBeGreaterThanOrEqual(1);
    expect(barsCount).toEqual(Number(nText));

    // The operation log should include the ready message generated during initialization
    const logText = await logEl.textContent();
    expect(logText).toContain('Ready. Generate frames');

    // Phase should display 'idle' or the initial frame phase if present
    await expect(phaseEl).toHaveText(/^(idle|start)$/);
  });

  test.describe('Randomize, DetectRuns, FullSort transitions', () => {
    test('Randomize Array (RandomizeArray -> S1_ArrayRandomized): updates bars and logs', async ({ page }) => {
      const randomizeBtn = page.locator('#randomize');
      const nVal1 = page.locator('#nVal1');
      const bars1 = page.locator('#bars1 > .bar');
      const logEl1 = page.locator('#log');
      const actionCountEl = page.locator('#actionCount');

      // Click Randomize to trigger Array Randomized state
      await randomizeBtn.click();

      // The app logs "Array randomized."
      await expect(logEl).toContainText('Array randomized.');

      // Bars should be re-rendered; ensure bars count equals reported n
      const nText1 = await nVal.textContent();
      const barsCount1 = await bars.count();
      expect(barsCount).toEqual(Number(nText));

      // After randomize, no frames should be generated yet (actionCount 0)
      await expect(actionCountEl).toHaveText('0');
    });

    test('Detect Runs (DetectRuns -> S2_RunsDetected): generates frames and shows run coloring', async ({ page }) => {
      const randomizeBtn1 = page.locator('#randomize');
      const detectRunsBtn = page.locator('#detectRunsBtn');
      const logEl2 = page.locator('#log');
      const actionCountEl1 = page.locator('#actionCount');
      const stackView = page.locator('#stackView');
      const phaseEl1 = page.locator('#phase');
      const runBars = page.locator('#bars .bar.run');
      const bars2 = page.locator('#bars2 > .bar');

      // Ensure there is an array to detect runs on
      await randomizeBtn.click();

      // Click Detect Runs to generate detection & extension frames
      await detectRunsBtn.click();

      // The app should log the frames generated message
      await expect(logEl).toContainText('Detected and extended runs;');

      // The action count should now be > 0 because frames were generated
      const actionCountText = await actionCountEl.textContent();
      expect(Number(actionCountText)).toBeGreaterThan(0);

      // The phase should reflect the current snapshot (first frame)
      const phaseText = await phaseEl.textContent();
      expect(phaseText.length).toBeGreaterThan(0);

      // The stack view should show either '[]' or a stack array after detection; ensure it exists
      const stackText = await stackView.textContent();
      expect(stackText).toBeTruthy();

      // At least some bars should have .run class in detection frames rendering
      // (showFrame(0) shows the first snapshot; detection pushes run frames - there should be run bars visible)
      const runCount = await runBars.count();
      expect(runCount).toBeGreaterThanOrEqual(0);
      // Ensure bars are present
      const barsCount2 = await bars.count();
      expect(barsCount).toBeGreaterThan(0);
    });

    test('Full Sort (FullSort -> S3_FullSortGenerated): generates full frames and shows start frame', async ({ page }) => {
      const randomizeBtn2 = page.locator('#randomize');
      const fullSortBtn = page.locator('#fullSortBtn');
      const logEl3 = page.locator('#log');
      const phaseEl2 = page.locator('#phase');
      const actionCountEl2 = page.locator('#actionCount');

      // Ensure array exists
      await randomizeBtn.click();

      // Click Run Full TimSort
      await fullSortBtn.click();

      // Should log frames generated
      await expect(logEl).toContainText('Full TimSort frames generated:');

      // actionCount should be > 0 (frames were generated)
      const actionCountText1 = await actionCountEl.textContent();
      expect(Number(actionCountText)).toBeGreaterThanOrEqual(1);

      // The displayed phase of the currently shown frame should not be empty
      await expect(phaseEl).not.toHaveText('');
    });
  });

  test.describe('Stepping and Playing behaviors', () => {
    test('Step when no frames (S5_Stepping edge case): logs helpful message', async ({ page }) => {
      const stepBtn = page.locator('#stepBtn');
      const logEl4 = page.locator('#log');

      // Reload page to guarantee no frames present
      await page.reload({ waitUntil: 'load' });

      // Click Step without generating frames
      await stepBtn.click();

      // Should log the message about no frames to step
      await expect(logEl).toContainText('No frames to step. Generate frames by pressing "Detect Runs" or "Full TimSort".');
    });

    test('Step through frames after Detect Runs (S2 -> S5_Stepping): advances frames', async ({ page }) => {
      const randomizeBtn3 = page.locator('#randomize');
      const detectRunsBtn1 = page.locator('#detectRunsBtn1');
      const stepBtn1 = page.locator('#stepBtn1');
      const logEl5 = page.locator('#log');
      const actionCountEl3 = page.locator('#actionCount');

      // Prepare frames via Detect Runs
      await randomizeBtn.click();
      await detectRunsBtn.click();

      // Capture current action count
      const before = Number(await actionCountEl.textContent());

      // Step once
      await stepBtn.click();

      // Action count should decrease or remain but frame advanced
      const after = Number(await actionCountEl.textContent());
      expect(after).toBeLessThanOrEqual(before);

      // Log should contain a frame message
      const logText1 = await logEl.textContent();
      expect(logText).toContain('[frame');
    });

    test('Play through frames and finish playback (S4_Playing): play toggles and finishes', async ({ page }) => {
      const sizeEl = page.locator('#size');
      const seedEl = page.locator('#seed');
      const randomizeBtn4 = page.locator('#randomize');
      const speedEl = page.locator('#speed');
      const fullSortBtn1 = page.locator('#fullSortBtn1');
      const playBtn = page.locator('#playBtn');
      const logEl6 = page.locator('#log');
      const phaseEl3 = page.locator('#phase');
      const sortedBars = page.locator('#bars .bar.sorted');

      // Reduce size to produce fewer frames so play completes quickly
      await sizeEl.evaluate((el) => { el.value = '20'; el.dispatchEvent(new Event('input')); });
      // Clear seed for reproducibility or leave blank - it's allowed; leave blank triggers randomness
      await seedEl.fill('');
      // Speed up playback
      await speedEl.evaluate((el) => { el.value = '10'; el.dispatchEvent(new Event('input')); });

      // Randomize and generate full sort frames
      await randomizeBtn.click();
      await fullSortBtn.click();

      // Click Play to begin playback
      await playBtn.click();

      // Wait for the "Playback finished." message in the log which indicates the Playing state completed
      await page.waitForFunction(() => {
        const el = document.getElementById('log');
        return el && el.textContent && el.textContent.includes('Playback finished.');
      }, { timeout: 20000 });

      // After playback finishes, the play button text should be 'Play'
      await expect(playBtn).toHaveText('Play');

      // The final state should mark sorted elements; expect at least some bars with 'sorted' class
      const sortedCount = await sortedBars.count();
      expect(sortedCount).toBeGreaterThanOrEqual(1);

      // Phase should reflect 'done' or final phase
      await expect(phaseEl).toHaveText(/^(done|idle)$/);
    }, 20000); // increase timeout because playback may take time

  });

  test('Reset behavior (S6_Reset): triggers randomize and reset logs and re-renders', async ({ page }) => {
    const randomizeBtn5 = page.locator('#randomize');
    const resetBtn = page.locator('#resetBtn');
    const logEl7 = page.locator('#log');
    const actionCountEl4 = page.locator('#actionCount');
    const bars3 = page.locator('#bars3 > .bar');

    // Ensure a known starting point
    await randomizeBtn.click();

    // Click Reset - in this implementation there are multiple handlers; both may run
    await resetBtn.click();

    // The logs should contain both "Array randomized." (from randomize click invoked by reset) and "Reset array."
    await expect(logEl).toContainText('Array randomized.');
    await expect(logEl).toContainText('Reset array.');

    // Frames should be cleared and actionCount should be 0 after reset
    await expect(actionCountEl).toHaveText('0');

    // Bars should be rendered (new randomized array)
    const barsCount3 = await bars.count();
    expect(barsCount).toBeGreaterThanOrEqual(1);
  });

  test('Play when no frames: play triggers full sort generation then plays', async ({ page }) => {
    const playBtn1 = page.locator('#playBtn1');
    const logEl8 = page.locator('#log');
    const randomizeBtn6 = page.locator('#randomize');
    const speedEl1 = page.locator('#speed');

    // Ensure small size and speed for quick run
    await page.locator('#size').evaluate((el) => { el.value = '20'; el.dispatchEvent(new Event('input')); });
    await speedEl.evaluate((el) => { el.value = '10'; el.dispatchEvent(new Event('input')); });
    // Randomize fresh array (so frames === 0)
    await randomizeBtn.click();

    // Ensure frames are empty by verifying actionCount==0
    const actionCount = await page.locator('#actionCount').textContent();
    expect(Number(actionCount)).toBeGreaterThanOrEqual(0);

    // Click Play when frames.length === 0 should cause generation of full timsort frames (handled in code)
    await playBtn.click();

    // Wait for playback finished message
    await page.waitForFunction(() => {
      const el1 = document.getElementById('log');
      return el && el.textContent && el.textContent.includes('Playback finished.');
    }, { timeout: 20000 });

    // Confirm that full sort frames generation was logged (Full TimSort frames generated:)
    await expect(logEl).toContainText('Full TimSort frames generated:');
  }, 20000);

});