import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b21191-fa74-11f0-bb9a-db7e6ecdeeaa.html';

test.describe('Backtracking Demo: N-Queens (FSM validation)', () => {
  // Capture console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen for console output from the page
    page.on('console', (msg) => {
      try {
        const text = msg.text();
        consoleMessages.push(text);
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Capture any page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    // Navigate to the application
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // nothing global to teardown beyond Playwright's fixtures
  });

  // Helper to read the log content
  async function getLogText(page) {
    return (await page.locator('#log').textContent()) || '';
  }

  // Helper to read status text
  async function getStatusText(page) {
    return (await page.locator('#status').textContent()) || '';
  }

  // Helper to check if any cell contains a queen symbol
  async function boardHasQueen(page) {
    const content = await page.locator('#board').textContent();
    return content && content.includes('♛');
  }

  test('Initial Idle state on load: reset() has run and UI is initialized', async ({ page }) => {
    // Validate Idle state entry actions (reset executed on load)
    // - Board exists and is populated
    // - nextStep and autoRun are disabled, start is enabled
    // - status and log are empty
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('#nSize')).toHaveValue('8'); // default value
    await expect(page.locator('#nextStepBtn')).toBeDisabled();
    await expect(page.locator('#autoRunBtn')).toBeDisabled();
    await expect(page.locator('#startBtn')).toBeEnabled();
    await expect(page.locator('#status')).toHaveText('');
    await expect(page.locator('#log')).toHaveText('');
    // No runtime errors should have occurred during load
    expect(pageErrors.length, `Page errors on load: ${pageErrors.join(';')}`).toBe(0);
  });

  test('Start Backtracking triggers Running state and enables step controls', async ({ page }) => {
    // Set N to 4 to make the run quicker and deterministic-ish
    await page.fill('#nSize', '4');

    // Start should invoke reset(), set running, create generator and log start message
    await page.click('#startBtn');

    // The start handler immediately calls onStep(), so some log/status should be present
    const log = await getLogText(page);
    expect(log).toContain('Starting backtracking for N=4...');

    // Buttons state after entering Running
    await expect(page.locator('#startBtn')).toBeDisabled();
    await expect(page.locator('#nextStepBtn')).toBeEnabled();
    await expect(page.locator('#autoRunBtn')).toBeEnabled();

    // Status should reflect a first attempt or placement
    const status = await getStatusText(page);
    expect(
      status.includes('Trying to place queen') ||
        status.includes('Placed queen') ||
        status.includes('Backtracking'),
    ).toBeTruthy();

    // Confirm at least one console message recorded about starting
    const foundConsole = consoleMessages.some((m) => m.includes('Starting backtracking for N=4'));
    expect(foundConsole).toBeTruthy();

    // Ensure no uncaught page errors
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.join(';')}`).toBe(0);
  });

  test('NextStep transitions: Conflict Detected, Backtracking, and Solution Found are observable', async ({ page }) => {
    // Use N = 4 to ensure we will observe conflicts, removes, and solutions reasonably fast
    await page.fill('#nSize', '4');
    await page.click('#startBtn');

    let sawConflict = false;
    let sawRemove = false;
    let sawSolution = false;
    const maxSteps = 400;

    // The first step already executed by start; now iterate with Next Step until we observe the messages
    for (let i = 0; i < maxSteps; i++) {
      // Give the UI a moment to update between clicks
      await page.waitForTimeout(10);

      const log1 = await getLogText(page);
      if (log.includes('Conflict detected at')) sawConflict = true;
      if (log.includes('Removing queen at')) sawRemove = true;
      if (log.includes('=== Solution #1 ===') || log.includes('Solution #1')) sawSolution = true;

      if (sawConflict && sawRemove && sawSolution) break;

      // Only click if Next Step is enabled
      const nextDisabled = await page.locator('#nextStepBtn').isDisabled();
      if (nextDisabled) {
        // If disabled, we've likely reached the end — break to assert observed things
        break;
      }
      await page.click('#nextStepBtn');
    }

    // Assert we observed at least one conflict, one backtrack removal, and a solution
    expect(sawConflict, 'Expected to observe conflict logs (fail) during stepping').toBeTruthy();
    expect(sawRemove, 'Expected to observe backtracking removal logs').toBeTruthy();
    expect(sawSolution, 'Expected to observe at least one solution being found').toBeTruthy();

    // Also verify status shows solution text at some point
    const status1 = await getStatusText(page);
    expect(
      status.includes('Solution #') || status.includes('All solutions found'),
      `Status did not indicate solution; saw: "${status}"`,
    ).toBeTruthy();

    // Ensure no uncaught page errors happened during stepping
    expect(pageErrors.length, `Page errors during stepping: ${pageErrors.join(';')}`).toBe(0);
  });

  test('AutoRun toggles, pauses, and completes (Running -> Running while active -> Idle after finish)', async ({ page }) => {
    // Use N=4 to keep runtime reasonable
    await page.fill('#nSize', '4');
    await page.click('#startBtn');

    // Click Auto Run to start automatic stepping (should change text to 'Pause')
    await page.click('#autoRunBtn');
    await expect(page.locator('#autoRunBtn')).toHaveText(/Pause|Pause/);

    // Wait for at least one solution to appear or until timeout
    await page.waitForFunction(
      () => document.querySelector('#log') && document.querySelector('#log').textContent.includes('=== Solution #'),
      null,
      { timeout: 5000 },
    );

    // After a solution appears, allow a short time for the run to possibly complete
    await page.waitForTimeout(300);

    // If AutoRun completed the whole run, autoRunBtn should have reverted to 'Auto Run' and nextStep disabled
    const autoText = await page.locator('#autoRunBtn').textContent();
    const nextDisabled1 = await page.locator('#nextStepBtn').isDisabled();

    // Accept either: it has paused (text 'Pause') or completed (text 'Auto Run' and next disabled)
    const log2 = await getLogText(page);
    expect(log).toContain('=== Solution #1 ===');

    // Validate state consistency: startBtn should be enabled after completion or paused
    const startEnabled = await page.locator('#startBtn').isEnabled();
    expect(startEnabled).toBeTruthy();

    // Ensure no page errors and some console logs were captured for auto-run activity
    expect(pageErrors.length, `Page errors during auto-run: ${pageErrors.join(';')}`).toBe(0);
    const hadAutoConsole = consoleMessages.some((m) => m.includes('Starting backtracking') || m.includes('Placed queen'));
    expect(hadAutoConsole).toBeTruthy();
  });

  test('Reset clears the board and handles invalid N input (edge case)', async ({ page }) => {
    // Put an invalid N value (< 4) and click reset to trigger alert and correction
    await page.fill('#nSize', '3');

    // Intercept dialog and assert its text
    const dialogPromise = page.waitForEvent('dialog');
    await page.click('#resetBtn');

    const dialog = await dialogPromise;
    // Validate the alert message as per implementation
    expect(dialog.message()).toContain('Please enter a number between 4 and 12');
    await dialog.accept();

    // After dismissing, the code sets input back to 8
    await expect(page.locator('#nSize')).toHaveValue('8');

    // Now place some state (start) and then reset to verify clearing behavior
    await page.click('#startBtn');
    // After start, there will be at least one queen placed or attempted; ensure board may contain queen
    const hadQueen = await boardHasQueen(page);

    // Now click reset and assert board cleared, log cleared, status cleared, and controls in Idle
    await page.click('#resetBtn');
    await expect(page.locator('#board')).toBeVisible();
    await expect(page.locator('#log')).toHaveText('');
    await expect(page.locator('#status')).toHaveText('');
    await expect(page.locator('#nextStepBtn')).toBeDisabled();
    await expect(page.locator('#autoRunBtn')).toBeDisabled();
    await expect(page.locator('#startBtn')).toBeEnabled();

    // Ensure that if there was a queen prior to reset, the reset cleared it
    const hasQueenAfterReset = await boardHasQueen(page);
    expect(hasQueenAfterReset).toBeFalsy();

    // Ensure no uncaught page errors during reset flow
    expect(pageErrors.length, `Page errors during reset flow: ${pageErrors.join(';')}`).toBe(0);
  });

  test('Comprehensive console and error observation: ensure no uncaught runtime errors occurred', async ({ page }) => {
    // Basic smoke: start, step a bit, and then inspect captured console messages and page errors
    await page.fill('#nSize', '4');
    await page.click('#startBtn');

    // Do a few manual steps
    const steps = 10;
    for (let i = 0; i < steps; i++) {
      const disabled = await page.locator('#nextStepBtn').isDisabled();
      if (disabled) break;
      await page.click('#nextStepBtn');
      await page.waitForTimeout(5);
    }

    // We expect some console messages referencing the algorithm progress
    const joined = consoleMessages.join('\n');
    expect(joined.length).toBeGreaterThan(0);

    // Confirm particular expected message patterns are present at least once
    expect(
      consoleMessages.some((m) => m.includes('Starting backtracking for N=')) ||
        consoleMessages.some((m) => m.includes('Trying (r')),
      'Expected algorithm-related console output',
    ).toBeTruthy();

    // Verify there were no page errors like ReferenceError/TypeError
    expect(pageErrors.length, `Found page errors: ${pageErrors.join(';')}`).toBe(0);
  });
});