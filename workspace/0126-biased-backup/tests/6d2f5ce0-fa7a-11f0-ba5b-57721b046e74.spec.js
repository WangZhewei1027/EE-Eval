import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2f5ce0-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Backtracking Interactive Demo - FSM and UI behavior', () => {
  // Containers for console and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Ensure no uncaught page errors were emitted during the test run.
    // The application should run without producing runtime exceptions.
    expect(pageErrors, `Unexpected uncaught page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toHaveLength(0);
    expect(consoleErrors, `Unexpected console.error logs: ${consoleErrors.map(e => e.text).join(' | ')}`).toHaveLength(0);
  });

  test('Initial Idle state is set up correctly (S0_Idle entry actions)', async ({ page }) => {
    // Validate initial UI reflects resetProblem() was called during initialization
    // Check default values and that visualization & state details exist
    const startBtn = page.locator('#startBtn');
    const sizeValue = page.locator('#sizeValue');
    const speedValue = page.locator('#speedValue');
    const stepsCount = page.locator('#stepsCount');
    const backtrackCount = page.locator('#backtrackCount');
    const visualization = page.locator('#visualization');
    const stateDetails = page.locator('#stateDetails');

    await expect(startBtn).toHaveText('Start');
    await expect(sizeValue).toHaveText('4');
    await expect(speedValue).toHaveText('500ms');
    await expect(stepsCount).toHaveText('Steps: 0');
    await expect(backtrackCount).toHaveText('Backtracks: 0');

    const vizText = await visualization.textContent();
    expect(vizText && vizText.length).toBeGreaterThan(0);

    const detailsText = await stateDetails.textContent();
    // default problem is nqueens so expect "Placed queens" to be present
    expect(detailsText).toContain('Placed queens');

    // No runtime errors during initial load
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('StartButtonClick: transitions Idle -> Running and Running -> Idle (S0_Idle <-> S1_Running)', async ({ page }) => {
    // Ensure starting sets running behavior and clicking again stops it.
    const startBtn = page.locator('#startBtn');
    const stepsCount = page.locator('#stepsCount');
    const speedInput = page.locator('#speed');

    // Reduce speed for fast feedback: set to 50ms
    await speedInput.evaluate((el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, '50');

    // Click Start -> should switch to Stop and start incrementing steps
    await startBtn.click();
    await expect(startBtn).toHaveText('Stop');

    // Wait enough for at least one interval to run
    await page.waitForTimeout(120);
    const afterStartStepsText = await stepsCount.textContent();
    const afterStartSteps = parseInt((afterStartStepsText || 'Steps: 0').replace('Steps: ', ''), 10);
    expect(afterStartSteps).toBeGreaterThanOrEqual(1);

    // Click Start (Stop) again -> should stop algorithm
    await startBtn.click();
    await expect(startBtn).toHaveText('Start');

    // Record steps and wait to ensure no further increments (algorithm stopped)
    const stepsAfterStop = await stepsCount.textContent();
    const recorded = parseInt((stepsAfterStop || 'Steps: 0').replace('Steps: ', ''), 10);
    await page.waitForTimeout(150);
    const stepsFinalText = await stepsCount.textContent();
    const final = parseInt((stepsFinalText || 'Steps: 0').replace('Steps: ', ''), 10);
    expect(final).toBe(recorded);

    // No runtime errors during start/stop transition
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('StepButtonClick: performs a single step when idle (S2_Stepping entry action performStep)', async ({ page }) => {
    // Ensure clicking Step while not running performs exactly one step
    const stepBtn = page.locator('#stepBtn');
    const stepsCount = page.locator('#stepsCount');
    const stateDetails = page.locator('#stateDetails');

    const initialText = await stepsCount.textContent();
    const initial = parseInt((initialText || 'Steps: 0').replace('Steps: ', ''), 10);

    // Click Step (should only work when not running)
    await stepBtn.click();

    // After step, steps should increment by 1 and stateDetails updated
    const afterText = await stepsCount.textContent();
    const after = parseInt((afterText || 'Steps: 0').replace('Steps: ', ''), 10);
    expect(after).toBe(initial + 1);

    const details = await stateDetails.textContent();
    expect(details.length).toBeGreaterThan(0);

    // No runtime errors from performing a step
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('ResetButtonClick resets state from both Idle and Running (S3_ProblemReset entry initializeProblem)', async ({ page }) => {
    const startBtn = page.locator('#startBtn');
    const resetBtn = page.locator('#resetBtn');
    const stepsCount = page.locator('#stepsCount');
    const backtrackCount = page.locator('#backtrackCount');

    // Start the algorithm to verify reset during Running stops it
    await startBtn.click();
    await expect(startBtn).toHaveText('Stop');

    // Wait a short moment for algorithm to modify state
    await page.waitForTimeout(120);

    // Now click Reset - should stop the algorithm and reinitialize problem
    await resetBtn.click();

    // startBtn should be 'Start' because resetProblem() calls stopAlgorithm()
    await expect(startBtn).toHaveText('Start');

    // Steps and backtracks should be reset to initial values: Steps: 0, Backtracks: 0
    await expect(stepsCount).toHaveText('Steps: 0');
    await expect(backtrackCount).toHaveText('Backtracks: 0');

    // Additionally, clicking Reset when already idle should keep things stable
    await resetBtn.click();
    await expect(stepsCount).toHaveText('Steps: 0');

    // No runtime errors triggered by reset operations
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('ProblemTypeChange triggers resetProblem() and updates visualization (S3_ProblemReset -> S0_Idle)', async ({ page }) => {
    const problemType = page.locator('#problemType');
    const visualization = page.locator('#visualization');
    const stateDetails = page.locator('#stateDetails');

    // Change to "maze" to exercise maze initialization logic
    await problemType.selectOption('maze');

    // After change, visualization should reflect maze (contain S and E tokens)
    const vizText = await visualization.textContent();
    expect(vizText).toContain('S');
    expect(vizText).toContain('E');

    // State details should reference current position for maze
    const details = await stateDetails.textContent();
    expect(details).toContain('Current position');

    // No runtime errors when changing problem type
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('ProblemSizeInput adjusts size and triggers resetProblem() (S3_ProblemReset -> S0_Idle)', async ({ page }) => {
    const sizeInput = page.locator('#problemSize');
    const sizeValue = page.locator('#sizeValue');
    const visualization = page.locator('#visualization');

    // Increase size to 6 and dispatch input event
    await sizeInput.evaluate((el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, '6');

    await expect(sizeValue).toHaveText('6');

    // Visualization should reflect updated size (number of rows should be >= 6 lines for grid-like outputs)
    const vizText = await visualization.textContent();
    // For visual checks, ensure something rendered and content length reasonable
    expect(vizText && vizText.length).toBeGreaterThan(10);

    // No runtime errors during size change
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('SpeedInput updates speed and while running restarts interval as expected (Speed change behavior)', async ({ page }) => {
    const speedInput = page.locator('#speed');
    const startBtn = page.locator('#startBtn');
    const stepsCount = page.locator('#stepsCount');

    // Set speed to a slower value (200ms) and start
    await speedInput.evaluate((el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, '200');

    await startBtn.click(); // Start
    await expect(startBtn).toHaveText('Stop');

    // Wait for a couple intervals
    await page.waitForTimeout(450);
    const stepsAfterStartText = await stepsCount.textContent();
    const stepsAfterStart = parseInt((stepsAfterStartText || 'Steps: 0').replace('Steps: ', ''), 10);
    expect(stepsAfterStart).toBeGreaterThanOrEqual(2);

    // Now change speed to faster (50ms) - handler should clearInterval and restart
    await speedInput.evaluate((el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, '50');

    // Wait for a short period and expect steps to continue increasing (fast pace)
    await page.waitForTimeout(160);
    const stepsAfterChangeText = await stepsCount.textContent();
    const stepsAfterChange = parseInt((stepsAfterChangeText || 'Steps: 0').replace('Steps: ', ''), 10);
    expect(stepsAfterChange).toBeGreaterThan(stepsAfterStart);

    // Stop algorithm
    await startBtn.click();
    await expect(startBtn).toHaveText('Start');

    // No runtime errors during speed changes
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('VisualModeChange updates visualization formatting (VisualModeChange event)', async ({ page }) => {
    const visualMode = page.locator('#visualMode');
    const visualization = page.locator('#visualization');

    // Ensure current problem is nqueens for a predictable visualization format
    await page.locator('#problemType').selectOption('nqueens');
    // Change to compact representation
    await visualMode.selectOption('compact');

    const vizTextCompact = await visualization.textContent();
    // Compact mode for nqueens should include "Row" strings
    expect(vizTextCompact).toContain('Row 0');

    // Switch back to full and expect board-like characters (Q or .)
    await visualMode.selectOption('full');
    const vizTextFull = await visualization.textContent();
    expect(vizTextFull).toMatch(/[Q\.]\s/);

    // No runtime errors when changing visual mode
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('HeuristicChange does not crash application even if logic is undefined (HeuristicChange event)', async ({ page }) => {
    const heuristic = page.locator('#heuristic');

    // Change heuristic - the code contains a commented handler; ensure no crash
    await heuristic.selectOption('mrv');

    // The application should remain responsive and no uncaught errors are expected
    const startBtn = page.locator('#startBtn');
    await expect(startBtn).toHaveText('Start');

    // No runtime errors expected
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

  test('Edge case: set problemSize to minimum (3) and run a few steps to ensure stability', async ({ page }) => {
    const sizeInput = page.locator('#problemSize');
    const sizeValue = page.locator('#sizeValue');
    const startBtn = page.locator('#startBtn');
    const stepsCount = page.locator('#stepsCount');

    // Set to minimum allowed value 3
    await sizeInput.evaluate((el, val) => {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, '3');

    await expect(sizeValue).toHaveText('3');

    // Start algorithm briefly and then stop to verify no exceptions with small sizes
    await startBtn.click();
    await expect(startBtn).toHaveText('Stop');
    await page.waitForTimeout(200);
    await startBtn.click();
    await expect(startBtn).toHaveText('Start');

    const finalStepsText = await stepsCount.textContent();
    expect(finalStepsText).toMatch(/^Steps: \d+$/);

    // No runtime errors encountered
    expect(pageErrors).toHaveLength(0);
    expect(consoleErrors).toHaveLength(0);
  });

});