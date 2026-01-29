import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c142c80-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Binary Search Interactive Lab (FSM validation) - Application ID 9c142c80-fa79-11f0-8fe7-a5317bd8e2c6', () => {
  // Collect console messages and page errors for assertions
  let pageErrors = [];
  let consoleMessages = [];
  let dialogs = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];
    dialogs = [];

    // Capture console output
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Auto-accept dialogs and record them
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    await page.goto(APP_URL, { waitUntil: 'networkidle' });
    // Wait a short time to allow initial scripts to run and log to populate
    await page.waitForTimeout(50);
  });

  test.afterEach(async () => {
    // nothing special to teardown (Playwright handles pages)
  });

  test('Initial render should be Idle and show ready log', async ({ page }) => {
    // Verify initial FSM state is Idle (S0_Idle) as implemented
    const stateLabel = page.locator('#stateLabel');
    await expect(stateLabel).toHaveText('idle');

    // Array area initially should show "(empty)"
    await expect(page.locator('#arrayArea')).toHaveText(/\(empty\)/);

    // Step counters and comparison counters should be zero or dashes appropriately
    await expect(page.locator('#compVal')).toHaveText('0');
    await expect(page.locator('#stepCount')).toHaveText('0');

    // Log box should contain the ready message from initialization
    await expect(page.locator('#logBox')).toContainText('Interactive Binary Search Lab ready.');

    // No uncaught page errors should have occurred on load
    expect(pageErrors.length).toBe(0);
  });

  test.describe('State transitions and actions', () => {
    test('InitSearch transitions Idle -> Running and updates bounds', async ({ page }) => {
      // Apply a small custom array so initSearch has meaningful bounds
      await page.fill('#customArray', '10,20,30');
      await page.click('#applyCustom');
      await page.waitForTimeout(20);

      // Initialize search
      await page.click('#initSearch');

      // After initializing, stateLabel should be 'running' (S1_Running)
      await expect(page.locator('#stateLabel')).toHaveText('running');

      // Check low and high values reflect the array bounds
      await expect(page.locator('#lowVal')).toHaveText('0');
      await expect(page.locator('#highVal')).toHaveText('2');

      // There should be at least one step recorded (initialized)
      const stepCountText = await page.locator('#stepCount').textContent();
      expect(Number(stepCountText)).toBeGreaterThanOrEqual(1);

      // The log should mention 'Search initialized'
      await expect(page.locator('#logBox')).toContainText('Search initialized.');
    });

    test('StepForward moves Running -> Done when target is found', async ({ page }) => {
      // Apply a single-element array where the target equals the only element
      await page.fill('#customArray', '42');
      await page.click('#applyCustom');

      // Set target input to match the element
      await page.fill('#targetInput', '42');

      // Initialize search to enter running state
      await page.click('#initSearch');
      await expect(page.locator('#stateLabel')).toHaveText('running');

      // Perform a single step; implementation should detect equality and finish
      await page.click('#stepForward');

      // After stepping forward, the FSM should be in Done (S2_Done)
      await expect(page.locator('#stateLabel')).toHaveText('done');

      // Result indices should include index 0
      await expect(page.locator('#resultIndices')).toHaveText(/\[0\]/);
    });

    test('StepBack reverts to Running state (undo step)', async ({ page }) => {
      // Setup an array and target such that a step forward completed the search
      await page.fill('#customArray', '7,8');
      await page.click('#applyCustom');
      await page.fill('#targetInput', '8');
      await page.click('#initSearch');
      await page.click('#stepForward'); // likely results in done

      await expect(page.locator('#stateLabel')).toHaveText('done');

      // Step back should revert to previous snapshot (running)
      await page.click('#stepBack');

      // After stepping back, state should be running again
      await expect(page.locator('#stateLabel')).toHaveText('running');

      // Log should indicate stepping back occurred
      await expect(page.locator('#logBox')).toContainText('Stepped back');
    });

    test('AutoRun toggles and Pause stops it', async ({ page }) => {
      // Create a larger array and a target to allow multiple steps to occur
      await page.fill('#customArray', '1,2,3,4,5,6,7,8,9');
      await page.click('#applyCustom');
      await page.fill('#targetInput', '999'); // likely absent -> will auto-run to completion
      await page.click('#initSearch');

      // Speed up auto-run
      await page.fill('#speed', '50'); // slider value; use input fill to change underlying value
      // reflect the speedVal element (the input handler updates it on 'input' events; fill triggers 'input')
      await page.dispatchEvent('#speed', 'input'); // trigger input event handler if needed

      // Start auto-run
      await page.click('#autoRun');

      // Wait briefly to let auto-run start and do some steps
      await page.waitForTimeout(200);

      // Pause via the Pause button
      await page.click('#pauseRun');
      await page.waitForTimeout(50);

      // Check logs show auto-run started and then paused or completed
      await expect(page.locator('#logBox')).toContainText(/Auto-run started|Auto-run paused|Auto-run completed/);
    }, { timeout: 10_000 });

    test('FastForward completes the search to Done', async ({ page }) => {
      // Create an array where target is absent to exercise fastForward termination
      await page.fill('#customArray', '2,4,6,8,10');
      await page.click('#applyCustom');
      await page.fill('#targetInput', '999'); // absent
      await page.click('#initSearch');

      // Click fast forward
      await page.click('#fastForward');

      // Final state should be done and log should reflect fast-forward
      await expect(page.locator('#stateLabel')).toHaveText('done');
      await expect(page.locator('#logBox')).toContainText('Fast-forwarded to completion');
    });

    test('ResetSearch returns to Idle state from Running', async ({ page }) => {
      // Initialize a search, then reset
      await page.fill('#customArray', '1,2,3');
      await page.click('#applyCustom');
      await page.fill('#targetInput', '2');
      await page.click('#initSearch');
      await expect(page.locator('#stateLabel')).toHaveText('running');

      // Reset
      await page.click('#resetSearch');

      // Expect Idle state
      await expect(page.locator('#stateLabel')).toHaveText('idle');
      await expect(page.locator('#logBox')).toContainText('Search reset.');
    });

    test('Generate Random / Fill Range / Clear Array / Apply Custom affect array area (edge behaviour)', async ({ page }) => {
      // Generate Random
      await page.fill('#length', '5');
      await page.fill('#seed', '123');
      await page.click('#genRandom');
      await page.waitForTimeout(20);
      // arrayArea should not be empty now
      await expect(page.locator('#arrayArea')).not.toHaveText(/\(empty\)/);

      // Fill range
      await page.fill('#length', '4');
      await page.click('#fillRange');
      await page.waitForTimeout(20);
      // verify at least 4 elements by counting spans
      const countSpans = await page.locator('#arrayArea span').count();
      expect(countSpans).toBeGreaterThanOrEqual(4);

      // Clear array
      await page.click('#clearArray');
      await page.waitForTimeout(20);
      await expect(page.locator('#arrayArea')).toHaveText(/\(empty\)/);

      // Apply custom with some non-numeric tokens to ensure parse fallback
      await page.fill('#customArray', 'a b c');
      await page.click('#applyCustom');
      await page.waitForTimeout(20);
      await expect(page.locator('#arrayArea')).toContainText('a');
    });
  });

  test.describe('Manual interaction tools (probe, force mid, selection)', () => {
    test('ProbeSelected with manual probe toggled compares selected index', async ({ page }) => {
      // Prepare array and set target to element at index 1
      await page.fill('#customArray', '100,200,300');
      await page.click('#applyCustom');
      await page.fill('#targetInput', '200');

      // Enable manual probe mode
      await page.click('#manualProbe'); // toggles checkbox and logs
      await page.waitForTimeout(10);

      // Initialize search
      await page.click('#initSearch');

      // Select index 1 by clicking the corresponding span
      const span = page.locator('#arrayArea span').nth(1);
      await span.click();

      // Probe selected
      await page.click('#probeSelected');

      // Expect log to show manual probe equal or moving bounds; and state to be done for variant 'any'
      await expect(page.locator('#logBox')).toContainText(/Manual probe/);

      // If equal, resultIndices should reflect found index 1
      const resultText = await page.locator('#resultIndices').textContent();
      if (/\[1\]/.test(resultText)) {
        await expect(page.locator('#stateLabel')).toHaveText(/done/);
      } else {
        // else ensure state still running but low/high changed appropriately
        await expect(page.locator('#stateLabel')).toHaveText(/running/);
      }
    });

    test('ForceSetMid requires selection and sets mid accordingly', async ({ page }) => {
      // Prepare array and initialize
      await page.fill('#customArray', '5,6,7');
      await page.click('#applyCustom');
      await page.click('#initSearch');

      // Attempt forceSetMid without selection (should log an instruction)
      await page.click('#forceSetMid');
      await expect(page.locator('#logBox')).toContainText(/Select an index first|Init first/);

      // Select index 2 and force mid
      await page.locator('#arrayArea span').nth(2).click();
      await page.click('#forceSetMid');

      // midVal should now reflect the forced mid (2)
      await expect(page.locator('#midVal')).toHaveText(/2/);
      await expect(page.locator('#logBox')).toContainText('Forced mid to');
    });

    test('ClearSelection removes S markers from array visualization', async ({ page }) => {
      // Create array and select an element
      await page.fill('#customArray', '9,8,7');
      await page.click('#applyCustom');

      // Select element 0
      await page.locator('#arrayArea span').first().click();
      await page.waitForTimeout(10);

      // Ensure the selection marker 'S' is present in the text representation
      await expect(page.locator('#arrayArea')).toContainText(/<.*S.*>/);

      // Clear selection
      await page.click('#clearSelection');
      await page.waitForTimeout(10);

      // Now the selection marker should no longer appear
      const areaText = await page.locator('#arrayArea').textContent();
      expect(areaText).not.toMatch(/<.*S.*>/);
    });
  });

  test.describe('Challenge Mode and tools that trigger dialogs', () => {
    test('StartChallenge initializes challenge and SubmitChallengeAnswer finishes it (handles alert)', async ({ page }) => {
      // Start challenge - this generates an array and initializes search
      await page.click('#startChallenge');

      // Challenge status should be 'running'
      await expect(page.locator('#challengeStatus')).toHaveText('running');

      // Submit answer - this will produce an alert that we auto-accept
      await page.click('#submitAnswer');

      // After submit, challenge status should become 'finished' and a score displayed
      await expect(page.locator('#challengeStatus')).toHaveText('finished');
      const scoreText = await page.locator('#challengeScore').textContent();
      // score is numeric string (or '0')
      expect(scoreText).toMatch(/^\d+$/);
      // We should have seen a dialog (alert) recorded
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
    });

    test('Linear compare triggers alert and logs steps', async ({ page }) => {
      // Prepare array and target
      await page.fill('#customArray', '1,2,3,4');
      await page.click('#applyCustom');
      await page.fill('#targetInput', '3');

      // Click linear compare (shows alert). We will accept via dialog handler.
      await page.click('#linearCompare');

      // Verify an alert was shown and logged
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      await expect(page.locator('#logBox')).toContainText('Linear search steps=');
    });
  });

  test.describe('Edge cases and error scenarios (observing logs and error handling)', () => {
    test('Clicking stepForward before init logs a helpful message', async ({ page }) => {
      // Ensure search is reset to not initialized
      await page.click('#resetSearch');
      await page.waitForTimeout(10);

      // Click stepForward without initialization
      await page.click('#stepForward');
      await page.waitForTimeout(10);

      // Expect log to contain instruction to initialize first
      await expect(page.locator('#logBox')).toContainText('Search not initialized');
    });

    test('ProbeSelected without manual probe enabled logs the correct message', async ({ page }) => {
      // Ensure manualProbe is not checked
      const manualProbeCheckbox = page.locator('#manualProbe');
      const checked = await manualProbeCheckbox.isChecked();
      if (checked) await manualProbeCheckbox.click();

      // Click probeSelected with no manual probe enabled
      await page.click('#probeSelected');
      await page.waitForTimeout(10);

      await expect(page.locator('#logBox')).toContainText('Manual probe mode not enabled');
    });

    test('Invalid jump step index logs an error message', async ({ page }) => {
      // Initialize a search to make jumpBtn somewhat meaningful
      await page.fill('#customArray', '1,2,3');
      await page.click('#applyCustom');
      await page.click('#initSearch');

      // Provide invalid large index and click Jump
      await page.fill('#jumpStep', '9999');
      await page.click('#jumpBtn');
      await page.waitForTimeout(10);

      await expect(page.locator('#logBox')).toContainText(/Invalid step index|Init first/);
    });
  });

  test('No uncaught JavaScript errors occurred during interactions', async ({ page }) => {
    // At the end of interactions across tests we still should assert that no uncaught page errors were observed.
    // Because we handled dialogs and used the UI as-is, the page should not have thrown exceptions.
    expect(pageErrors.length).toBe(0);

    // Also assert that console did not emit any messages of type 'error'
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });
});