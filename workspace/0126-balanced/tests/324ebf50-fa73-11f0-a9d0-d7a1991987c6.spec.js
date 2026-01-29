import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324ebf50-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Deadlock Simulation (Application ID: 324ebf50-fa73-11f0-a9d0-d7a1991987c6) - FSM validation', () => {
  // Arrays to collect runtime information for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console output for later verification
    page.on('console', (msg) => {
      // Capture text for all console message types
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // no-op teardown; events removed automatically with page close
  });

  test('Initial Idle state (S0_Idle) - status is empty and UI elements are present', async ({ page }) => {
    // Validate the Start button exists and has correct text
    const startButton = page.locator('#start');
    await expect(startButton).toHaveCount(1);
    await expect(startButton).toHaveText('Start Simulation');

    // Validate the status div exists and is initially empty (Idle state)
    const status = page.locator('#status');
    await expect(status).toHaveCount(1);
    const initialStatus = await status.innerText();
    // FSM S0_Idle evidence expects status to be empty string
    expect(initialStatus).toBe('');

    // Ensure no runtime page errors before interaction
    expect(pageErrors.length).toBe(0);
  });

  test('StartSimulation event triggers both processes and resets status (S0 -> S1_Process1_WaitingForB / S3_Process2_WaitingForA)', async ({ page }) => {
    // Click Start Simulation and verify reset behavior and subsequent state transitions
    // We capture status text changes and console logs emitted during the simulation.
    const status1 = page.locator('#status1');

    // Pre-check: ensure status non-null before click
    const beforeClick = await status.innerText();
    expect(beforeClick).toBe('');

    // Click the start button
    await page.click('#start');

    // Immediately after click the handler resets status to empty string per implementation
    // Validate that status was cleared (S0 entry/exits behavior simulated by start handler)
    // Using a short wait to let the immediate handler run
    await expect.poll(async () => (await status.innerText()).trim()).toBe('');

    // Wait for Process 2 deadlock message - process2 uses setTimeout 500ms
    await expect.poll(async () => (await status.innerText()).trim(), { timeout: 2000 }).toBe('Deadlock: Process 2 is waiting for Resource A.');

    // After process1's timeout (1000ms) the status should update to Process 1 waiting for Resource B
    await expect.poll(async () => (await status.innerText()).trim(), { timeout: 3000 }).toBe('Deadlock: Process 1 is waiting for Resource B.');

    // Ensure no uncaught exceptions happened during the run
    expect(pageErrors.length).toBe(0);
  });

  test('Deadlock happens: acquired final states (S2/S4) are not reached in this combined run', async ({ page }) => {
    // This implementation starts both processes simultaneously and creates a deadlock.
    // Assert that neither "Acquired ... and completed." messages are shown in the status element.
    const status2 = page.locator('#status2');

    // Start simulation
    await page.click('#start');

    // Wait sufficiently long for either acquired outcome to appear if it would (use 2s)
    // Then assert that we never saw the "Acquired ... and completed." texts in the DOM's status.
    await page.waitForTimeout(2200); // let both timeouts (500ms and 1000ms) fire

    const currentStatus = (await status.innerText()).trim();

    // The implementation should lead to one of the Deadlock messages, not the successful acquisition messages.
    expect(currentStatus).not.toBe('Process 1: Acquired Resource B and completed.');
    expect(currentStatus).not.toBe('Process 2: Acquired Resource A and completed.');

    // Also ensure console logs do not indicate a completed acquisition message in status text
    const concatenatedConsole = consoleMessages.map(c => c.text).join(' | ');
    expect(concatenatedConsole).not.toContain('Acquired Resource B and completed');
    expect(concatenatedConsole).not.toContain('Acquired Resource A and completed');

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Console logs contain expected process lifecycle messages and ordering is plausible', async ({ page }) => {
    // Start simulation and capture console messages emitted by the in-page scripts
    await page.click('#start');

    // Wait long enough for all timeouts and logs to be emitted
    await page.waitForTimeout(1500);

    // Extract just the console text for easier assertions
    const texts = consoleMessages.map(m => m.text);

    // Verify expected messages exist in the logs
    // We expect both processes to request and acquire their initial resources immediately
    expect(texts.some(t => t.includes('Process 1: Requesting Resource A...'))).toBeTruthy();
    expect(texts.some(t => t.includes('Process 1: Acquired Resource A.'))).toBeTruthy();

    expect(texts.some(t => t.includes('Process 2: Requesting Resource B...'))).toBeTruthy();
    expect(texts.some(t => t.includes('Process 2: Acquired Resource B.'))).toBeTruthy();

    // Verify they attempt to request the other resource
    expect(texts.some(t => t.includes('Process 2: Requesting Resource A...'))).toBeTruthy();
    expect(texts.some(t => t.includes('Process 1: Requesting Resource B...'))).toBeTruthy();

    // Verify waiting logs that indicate deadlock behavior are present
    const p2Waiting = texts.some(t => t.includes('Process 2: Waiting for Resource A...') || t.includes('Waiting for Resource A'));
    const p1Waiting = texts.some(t => t.includes('Process 1: Waiting for Resource B...') || t.includes('Waiting for Resource B'));
    expect(p2Waiting).toBeTruthy();
    expect(p1Waiting).toBeTruthy();

    // Verify that there were no uncaught exceptions
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: clicking Start multiple times resets resources and does not throw errors', async ({ page }) => {
    // Clicking start multiple times should reset resources and status each time and re-run processes
    // We ensure the app continues to run and does not produce page errors or exceptions.

    // First click
    await page.click('#start');

    // Click again quickly to exercise reset logic inside the start handler
    await page.waitForTimeout(100);
    await page.click('#start');

    // Wait for the processes to emit their logs and update status
    await page.waitForTimeout(1500);

    // Ensure we still end up in a deadlock message (the implementation resets resources and restarted both processes)
    const finalStatus = (await page.locator('#status').innerText()).trim();
    // Final status likely becomes 'Deadlock: Process 1 is waiting for Resource B.' after both timeouts
    const allowedDeadlockMessages = [
      'Deadlock: Process 1 is waiting for Resource B.',
      'Deadlock: Process 2 is waiting for Resource A.'
    ];
    expect(allowedDeadlockMessages.includes(finalStatus)).toBeTruthy();

    // No uncaught exceptions occurred during repeated interaction
    expect(pageErrors.length).toBe(0);

    // Confirm that console messages increased (we expect multiple occurrences of the lifecycle logs)
    const requestAInstances = consoleMessages.filter(m => m.text.includes('Process 1: Requesting Resource A...')).length;
    expect(requestAInstances).toBeGreaterThanOrEqual(1);
  });

  test('DOM attributes and accessibility checks for components described in FSM', async ({ page }) => {
    // Verify the status div has the class "status" and the id "status", as described in components
    const status3 = page.locator('#status3');
    await expect(status).toHaveAttribute('id', 'status');
    await expect(status).toHaveClass(/status/);

    // Verify the start button's id is correct and is enabled
    const startButton1 = page.locator('#start');
    await expect(startButton).toHaveAttribute('id', 'start');
    await expect(startButton).toBeEnabled();
  });

  test('Negative test: ensure no unexpected runtime errors (ReferenceError/SyntaxError/TypeError) occurred', async ({ page }) => {
    // This test explicitly asserts that no unexpected runtime errors occurred during navigation and a sample run.
    await page.click('#start');
    await page.waitForTimeout(1200);

    // If any pageErrors were captured, fail and log them for debugging context
    if (pageErrors.length > 0) {
      // Make the error messages visible in the assertion failure
      const msgs = pageErrors.map(e => e.message).join(' || ');
      throw new Error('Unexpected page errors occurred: ' + msgs);
    }

    // Otherwise assert the array is empty
    expect(pageErrors.length).toBe(0);
  });
});