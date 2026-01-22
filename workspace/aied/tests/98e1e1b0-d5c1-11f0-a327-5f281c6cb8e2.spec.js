import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e1e1b0-d5c1-11f0-a327-5f281c6cb8e2.html';

test.describe.parallel('Merge Sort Visualizer — FSM and UI tests (App ID: 98e1e1b0-d5c1-11f0-a327-5f281c6cb8e2)', () => {
  // Capture console messages and page errors for each test to assert runtime behavior.
  test.beforeEach(async ({ page }) => {
    // Nothing global here; each test will set up its own listeners after navigation.
  });

  // Utility: navigate and attach listeners, returning captured arrays
  async function gotoAndAttach(page) {
    const consoleMsgs = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMsgs.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Ensure initial layout/rendering has settled
    await page.waitForLoadState('domcontentloaded');
    // small wait to allow initial script execution
    await page.waitForTimeout(100);

    return { consoleMsgs, pageErrors };
  }

  test.describe('Initial state and rendering (S0_Idle)', () => {
    test('Initial Idle state: array rendered, size label set, status shows Ready message, pause disabled', async ({ page }) => {
      // Arrange: load page and attach listeners
      const { consoleMsgs, pageErrors } = await gotoAndAttach(page);

      // Assert: size label reflects initial range value and array has that many bars
      const sizeValue = await page.$eval('#sizeRange', el => el.value);
      const sizeLabelText = await page.$eval('#sizeLabel', el => el.textContent.trim());
      expect(sizeLabelText).toBe(sizeValue);

      // The initial generateArray was called during initialization; bars should exist
      const bars = page.locator('#arrayCanvas .bar');
      await expect(bars).toHaveCount(Number(sizeValue));

      // The actionStat should show the Idle entry evidence message
      const statText = await page.$eval('#actionStat', el => el.textContent.trim());
      expect(statText).toContain('Ready — click Start to visualize Merge Sort.');

      // Pause button should be disabled on initial load
      const pauseDisabled = await page.$eval('#pauseBtn', btn => btn.disabled);
      expect(pauseDisabled).toBe(true);

      // Ensure no runtime page errors or console errors occurred during load
      const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
      expect(pageErrors.length, `Unexpected page errors:\n${pageErrors.map(String).join('\n')}`).toBe(0);
      expect(consoleErrors.length, `Unexpected console error messages:\n${consoleErrors.map(c => c.text).join('\n')}`).toBe(0);
    });
  });

  test.describe('Array generation (S0_Idle -> S4_ArrayGenerated)', () => {
    test('ShuffleClick generates a new array and resets actions/stat', async ({ page }) => {
      // Arrange
      const { consoleMsgs, pageErrors } = await gotoAndAttach(page);

      // Act: click shuffle button
      await page.click('#shuffleBtn');

      // Assert: actionStat contains the expected phrase for new array
      await expect(page.locator('#actionStat')).toContainText('New array generated — record actions to begin.');

      // After shuffle, start should be enabled and pause should be disabled
      await expect(page.locator('#startBtn')).toBeEnabled();
      await expect(page.locator('#pauseBtn')).toBeDisabled();

      // The displayed "Action X/Y" template in actionStat should be present (the implementation uses Action 1/0 currently)
      const statText = await page.$eval('#actionStat', el => el.textContent.trim());
      expect(statText).toMatch(/^Action\s+\d+\/\d+\s+—\s+New array generated/);

      // Ensure no page errors or console errors occurred during this interaction
      const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Changing array size updates sizeLabel and subsequent Shuffle produces that many bars', async ({ page }) => {
      const { consoleMsgs, pageErrors } = await gotoAndAttach(page);

      // Change sizeRange value to 10 (via DOM and dispatch input event)
      await page.$eval('#sizeRange', (el, v) => {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }, '10');

      // sizeLabel should reflect change
      await expect(page.locator('#sizeLabel')).toHaveText('10');

      // Now click shuffle to generate a new array of that size
      await page.click('#shuffleBtn');

      // Bars count should equal 10
      const bars = page.locator('#arrayCanvas .bar');
      await expect(bars).toHaveCount(10);

      // Ensure no page errors or console errors occurred
      const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Playback controls & transitions (S4_ArrayGenerated <-> S1_Playing <-> S2_Paused)', () => {
    test('StartClick from generated array enters Playing: start disabled, pause enabled, shuffle disabled', async ({ page }) => {
      const { consoleMsgs, pageErrors } = await gotoAndAttach(page);

      // To keep the test quick, set a small size and fast speed then shuffle
      await page.$eval('#sizeRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '6');
      // click shuffle to generate array of size 6
      await page.click('#shuffleBtn');

      // Set speedRange low for fast playback
      await page.$eval('#speedRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '10');

      // Click start to record actions and begin playing
      await page.click('#startBtn');

      // Immediately after clicking start, startBtn should be disabled and pauseBtn enabled
      await expect(page.locator('#startBtn')).toBeDisabled();
      await expect(page.locator('#pauseBtn')).toBeEnabled();
      await expect(page.locator('#shuffleBtn')).toBeDisabled();

      // actionStat should reflect that actions are being played (starts with Action)
      await expect(page.locator('#actionStat')).toContainText('Action ');

      // Pause playback to allow deterministic assertions for next tests
      await page.click('#pauseBtn');
      await expect(page.locator('#pauseBtn')).toBeDisabled();
      await expect(page.locator('#startBtn')).toBeEnabled();
      await expect(page.locator('#actionStat')).toContainText('Paused');

      // Ensure no page errors or console errors occurred during playback start/pause
      const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('PauseClick from Playing transitions to Paused and updates UI accordingly', async ({ page }) => {
      const { consoleMsgs, pageErrors } = await gotoAndAttach(page);

      // Prepare small test array & fast speed
      await page.$eval('#sizeRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '6');
      await page.click('#shuffleBtn');
      await page.$eval('#speedRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '8');

      // Start playback
      await page.click('#startBtn');
      await expect(page.locator('#startBtn')).toBeDisabled();

      // Pause
      await page.click('#pauseBtn');
      // After pause, pauseBtn must be disabled, start enabled
      await expect(page.locator('#pauseBtn')).toBeDisabled();
      await expect(page.locator('#startBtn')).toBeEnabled();

      // status should show 'Paused'
      await expect(page.locator('#actionStat')).toHaveText(/Paused/);

      // Ensure no page errors or console errors occurred
      const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Resuming from Paused via StartClick returns to Playing', async ({ page }) => {
      const { consoleMsgs, pageErrors } = await gotoAndAttach(page);

      // Setup: generate small array and start, then pause
      await page.$eval('#sizeRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '6');
      await page.click('#shuffleBtn');
      await page.$eval('#speedRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '8');

      await page.click('#startBtn');
      await page.click('#pauseBtn');

      // Now click start to resume
      await page.click('#startBtn');
      await expect(page.locator('#startBtn')).toBeDisabled();
      await expect(page.locator('#pauseBtn')).toBeEnabled();

      // Clean up: pause again
      await page.click('#pauseBtn');

      // Ensure no page errors or console errors occurred during resume
      const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Stepping behavior (S1_Playing/S2_Paused -> S3_Stepping)', () => {
    test('Clicking Step while Playing pauses and performs one step (Playing -> Stepping)', async ({ page }) => {
      const { consoleMsgs, pageErrors } = await gotoAndAttach(page);

      // Prepare small array and fast speed
      await page.$eval('#sizeRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '6');
      await page.click('#shuffleBtn');
      await page.$eval('#speedRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '6');

      // Start playing
      await page.click('#startBtn');
      await expect(page.locator('#startBtn')).toBeDisabled();

      // Click step while playing: should pause then perform a single action
      await page.click('#stepBtn');

      // After clicking step, playback should be paused and we should have an updated stat mentioning 'Stepped' OR an action message
      const stat = await page.$eval('#actionStat', el => el.textContent);
      expect(/Stepped|Compare|Write|Write value|Merging|Range \[/.test(stat)).toBeTruthy();

      // There should be at least one visual highlight from the action (compare/write/mergeRange/sorted)
      const hasCompare = await page.$$('#arrayCanvas .bar.compare').then(list => list.length > 0);
      const hasWrite = await page.$$('#arrayCanvas .bar.write').then(list => list.length > 0);
      const hasMergeRange = await page.$$('#arrayCanvas .bar.mergeRange').then(list => list.length > 0);
      const hasSorted = await page.$$('#arrayCanvas .bar.sorted').then(list => list.length > 0);

      expect(hasCompare || hasWrite || hasMergeRange || hasSorted).toBeTruthy();

      // Ensure no runtime errors occurred
      const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking Step while Paused performs one step (Paused -> Stepping)', async ({ page }) => {
      const { consoleMsgs, pageErrors } = await gotoAndAttach(page);

      // Prepare
      await page.$eval('#sizeRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '6');
      await page.click('#shuffleBtn');
      // Ensure actions are recorded on the first step if none are present
      // Pause state: ensure paused
      // Click step (no need to start)
      await page.click('#stepBtn');

      // After single step, actionStat should mention "Stepped" or specific action text
      const stat = await page.$eval('#actionStat', el => el.textContent);
      expect(/Stepped|Compare|Write value|Merging|Range \[/.test(stat)).toBeTruthy();

      // Ensure no runtime errors occurred
      const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Stepping repeatedly until completion for a very small array eventually reports Already finished or Done', async ({ page }) => {
      const { consoleMsgs, pageErrors } = await gotoAndAttach(page);

      // Use array size 5 to limit number of recorded actions
      await page.$eval('#sizeRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '5');
      await page.click('#shuffleBtn');

      // Record actions by ensuring one initial record (the first step will record actions)
      // Repeatedly click step until we see "Already finished" or reach a reasonable click limit
      const maxSteps = 500;
      let finished = false;
      for (let i = 0; i < maxSteps; i++) {
        await page.click('#stepBtn');
        // small wait to let UI update
        await page.waitForTimeout(8);
        const stat = await page.$eval('#actionStat', el => el.textContent);
        if (/Already finished|Done — array sorted/.test(stat)) {
          finished = true;
          break;
        }
      }

      expect(finished, 'Expected stepping to reach a finished state within click limit').toBeTruthy();

      // Ensure no runtime errors occurred
      const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    }, { timeout: 120000 });
  });

  test.describe('Speed control and responsiveness', () => {
    test('Adjusting speedRange updates speedLabel and affects timing variable', async ({ page }) => {
      const { consoleMsgs, pageErrors } = await gotoAndAttach(page);

      // Set speed to 50 via input event
      await page.$eval('#speedRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '50');

      // speedLabel should reflect "50 ms"
      await expect(page.locator('#speedLabel')).toHaveText(/50\s*ms/);

      // No runtime errors occurred
      const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Window resize triggers re-render of bars without errors', async ({ page }) => {
      const { consoleMsgs, pageErrors } = await gotoAndAttach(page);

      // resize the viewport to trigger the resize handler
      await page.setViewportSize({ width: 800, height: 600 });
      // small delay to allow throttled re-rendering
      await page.waitForTimeout(200);

      // Resize again
      await page.setViewportSize({ width: 600, height: 800 });
      await page.waitForTimeout(200);

      // Ensure bars still exist and no runtime errors
      const bars = await page.$$('#arrayCanvas .bar');
      expect(bars.length).toBeGreaterThan(0);

      const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Keyboard shortcuts & edge cases', () => {
    test('Space toggles play/pause via keyboard shortcut', async ({ page }) => {
      const { consoleMsgs, pageErrors } = await gotoAndAttach(page);

      // Ensure we have an array and actions are recorded by pressing space to start
      // Make speed fast and small array to avoid long running animation
      await page.$eval('#sizeRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '6');
      await page.click('#shuffleBtn');
      await page.$eval('#speedRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '8');

      // Press Space to start (space triggers startBtn.click)
      await page.keyboard.press(' ');
      await expect(page.locator('#startBtn')).toBeDisabled();

      // Press Space again to pause
      await page.keyboard.press(' ');
      await expect(page.locator('#pauseBtn')).toBeDisabled();

      // Ensure no runtime errors occurred
      const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Edge case: rapid shuffle during playback cancels timers and does not throw', async ({ page }) => {
      const { consoleMsgs, pageErrors } = await gotoAndAttach(page);

      // Prepare a small array and start playing at fast speed
      await page.$eval('#sizeRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '6');
      await page.click('#shuffleBtn');
      await page.$eval('#speedRange', (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); }, '6');

      await page.click('#startBtn');
      // Immediately click shuffle multiple times to simulate rapid user interactions
      for (let i = 0; i < 3; i++) {
        await page.click('#shuffleBtn');
      }

      // After rapid shuffles, UI should remain responsive: start should be enabled, pause disabled
      await expect(page.locator('#startBtn')).toBeEnabled();
      await expect(page.locator('#pauseBtn')).toBeDisabled();

      // No uncaught errors should have been produced
      const consoleErrors = consoleMsgs.filter(m => m.type === 'error');
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});