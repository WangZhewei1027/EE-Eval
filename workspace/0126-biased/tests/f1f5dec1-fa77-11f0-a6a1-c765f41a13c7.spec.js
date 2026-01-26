import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f1f5dec1-fa77-11f0-a6a1-c765f41a13c7.html';

test.describe('TimSort — Elegant Visual Demonstration (FSM validation)', () => {
  // Shared instrumentation arrays for console messages and page errors
  let consoleMessages;
  let pageErrors;

  // Helper to wait until an element's text equals expected
  async function waitForText(locator, expected, timeout = 5000) {
    await expect(locator).toHaveText(expected, { timeout });
  }

  // Setup for each test: navigate and wire listeners to capture console and page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // capture the Error object/message for assertions
      pageErrors.push(err);
    });

    // Navigate to the app page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for key UI to appear to ensure the app has initialized
    await expect(page.locator('#playBtn')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#shuffleBtn')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#status')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#stepLog')).toBeVisible({ timeout: 5000 });
  });

  // Teardown per test: assert there were no uncaught page errors and no console.error messages
  test.afterEach(async () => {
    // Assert there were no uncaught page errors
    // If there are any, we surface them to help debugging
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);

    // Additionally assert there are no console messages of error severity
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `Console error/warning messages present: ${consoleErrors.map(e => e.text).join('; ')}`).toBe(0);
  });

  test('Initial state S0_Idle: UI elements show Idle and Play', async ({ page }) => {
    // Validate initial Idle state per FSM: status and step log should match idle texts
    const status = page.locator('#status');
    const stepLog = page.locator('#stepLog');
    const playBtn = page.locator('#playBtn');

    // Wait for exact initial texts
    await waitForText(status, 'Idle');
    await waitForText(stepLog, 'Press Play to begin the guided animation.');
    await expect(playBtn).toHaveText('Play');

    // Validate number of tiles rendered equals COUNT (36). We check for .tile elements.
    const tiles = page.locator('.tile');
    await expect(tiles).toHaveCount(36);

    // No errors should have been emitted so far (after initial load)
    // The afterEach will assert pageErrors and console errors are empty.
  });

  test('Transition S0_Idle -> S1_Running on PlayButtonClick: Detecting runs and Play->Pause', async ({ page }) => {
    // Clicking Play should start visualization and update status and play button
    const status = page.locator('#status');
    const stepLog = page.locator('#stepLog');
    const playBtn = page.locator('#playBtn');

    // Click play
    await playBtn.click();

    // Expect status to reflect run detection
    await waitForText(status, 'Detecting runs');

    // Play button should change to Pause
    await expect(playBtn).toHaveText('Pause');

    // stepLog should change to indicate detection started
    await expect(stepLog).toContainText('Detecting natural runs');

    // Ensure some visual annotations (run overlay) are present (run-overlay children)
    const runChunks = page.locator('#runOverlay .run-chunk');
    // It's possible at least one run is present; check at least 1
    await expect(runChunks).toHaveCountGreaterThan(0);

    // Pause quickly to avoid long-running animations in this test
    await playBtn.click();

    // After clicking while running, play button click handler should set Paused texts
    await waitForText(status, 'Paused');
    await waitForText(page.locator('#stepLog'), 'Visualization paused. Press Play to resume.');

    // After this test, afterEach will assert no uncaught errors occurred.
  });

  test('Transition S1_Running -> S2_Paused -> S1_Running on PlayButtonClick (pause/resume)', async ({ page }) => {
    const status = page.locator('#status');
    const playBtn = page.locator('#playBtn');
    const stepLog = page.locator('#stepLog');

    // Start running
    await playBtn.click();
    await waitForText(status, 'Detecting runs');
    await expect(playBtn).toHaveText('Pause');

    // Pause by clicking Play (which becomes Pause)
    await playBtn.click();
    await waitForText(status, 'Paused');
    await waitForText(stepLog, 'Visualization paused. Press Play to resume.');
    await expect(playBtn).toHaveText('Play');

    // Resume by clicking Play again
    await playBtn.click();
    // After resuming, the visualization resets running state and should set Detecting runs again
    await waitForText(status, 'Detecting runs');
    await expect(playBtn).toHaveText('Pause');

    // Now pause to leave test in stable state
    await playBtn.click();
    await waitForText(status, 'Paused');
  });

  test('Transition S2_Paused -> S0_Idle on ShuffleButtonClick: Shuffle resets to Idle', async ({ page }) => {
    const playBtn = page.locator('#playBtn');
    const shuffleBtn = page.locator('#shuffleBtn');
    const status = page.locator('#status');
    const stepLog = page.locator('#stepLog');

    // Start and then pause
    await playBtn.click();
    await waitForText(status, 'Detecting runs');
    await playBtn.click();
    await waitForText(status, 'Paused');

    // Click Shuffle while paused - should re-init and return to Idle
    await shuffleBtn.click();

    await waitForText(status, 'Idle');
    await waitForText(stepLog, 'Press Play to begin the guided animation.');
    await expect(playBtn).toHaveText('Play');

    // Validate tiles were re-rendered (still should be 36)
    const tiles = page.locator('.tile');
    await expect(tiles).toHaveCount(36);
  });

  test('Edge case: rapid double-click Play toggles resume/pause without throwing', async ({ page }) => {
    // This test ensures quick user interactions don't produce runtime errors
    const playBtn = page.locator('#playBtn');
    const status = page.locator('#status');

    // Rapidly click Play twice: start then immediately pause
    await playBtn.click();
    await playBtn.click();

    // Status should eventually be 'Paused' (second click should pause)
    await waitForText(status, 'Paused');

    // No page errors should have been emitted during rapid interaction (checked in afterEach)
  });

  test('Completion: run full visualization to S3_Completed', async ({ page }) => {
    // This test runs the full visualization and waits for final Completed state.
    // It can be long-running; extend timeout for this test.
    test.setTimeout(180000); // 3 minutes

    const playBtn = page.locator('#playBtn');
    const status = page.locator('#status');
    const stepLog = page.locator('#stepLog');

    // Start visualization
    await playBtn.click();

    // Wait for status to eventually become Completed
    // The code sets statusEl.textContent = "Completed" when finished
    await page.waitForFunction(() => {
      const el = document.getElementById('status');
      return el && el.textContent === 'Completed';
    }, { timeout: 120000 }); // wait up to 120s for completion

    // Validate final texts
    await waitForText(status, 'Completed', 5000);
    await waitForText(stepLog, 'Array fully sorted. TimSort has merged all runs into a single sorted sequence.', 5000);

    // Validate playBtn returned to 'Play' after completion
    await expect(playBtn).toHaveText('Play');

    // As a final check ensure tiles are present and their displayed values are non-decreasing (sorted)
    const tileValues = await page.$$eval('.tile .value', els => els.map(e => Number(e.textContent)));
    // Confirm non-decreasing
    for (let i = 1; i < tileValues.length; i++) {
      expect(tileValues[i] >= tileValues[i - 1], `Tile values should be non-decreasing after completion. Index ${i - 1} -> ${i}: ${tileValues[i - 1]} > ${tileValues[i]}`).toBeTruthy();
    }
  });

  test('Shuffle during Running should cancel and re-init (S1_Running -> S0_Idle)', async ({ page }) => {
    const playBtn = page.locator('#playBtn');
    const shuffleBtn = page.locator('#shuffleBtn');
    const status = page.locator('#status');
    const stepLog = page.locator('#stepLog');

    // Start the visualization
    await playBtn.click();
    await waitForText(status, 'Detecting runs');

    // Click Shuffle to force cancellation and re-init
    await shuffleBtn.click();

    // After shuffle, status should be Idle and stepLog reset
    await waitForText(status, 'Idle');
    await waitForText(stepLog, 'Press Play to begin the guided animation.');

    // Play button should be reset to Play
    await expect(playBtn).toHaveText('Play');
  });

  test('UI invariants: Run stack shows counts and updates after operations', async ({ page }) => {
    // Validate that runStack shows some run-pill elements after detecting runs
    const playBtn = page.locator('#playBtn');
    const runStack = page.locator('#runStack');

    // Initially stack may be empty (Hidden), but after starting it should populate
    await playBtn.click();
    // Wait briefly for detection to annotate runs
    await page.waitForTimeout(600);
    // After detection, runStack should have at least one child
    await expect(runStack.locator('.run-pill').first()).toBeVisible();
    const count = await runStack.locator('.run-pill').count();
    expect(count).toBeGreaterThan(0);

    // Pause to avoid long runs
    await page.locator('#playBtn').click();
    await waitForText(page.locator('#status'), 'Paused');
  });

  // Additional robust check: ensure window resize handler executes without errors
  test('Resizing window triggers reflow without errors', async ({ page }) => {
    // Resize the viewport to trigger the resize listener
    await page.setViewportSize({ width: 400, height: 800 });
    // wait for debounce timeout in the app (120ms + buffer)
    await page.waitForTimeout(250);
    // Resize back
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.waitForTimeout(250);

    // Validate tiles still present
    const tiles = page.locator('.tile');
    await expect(tiles).toHaveCount(36);
  });

});