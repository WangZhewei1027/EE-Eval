import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b2add1-fa74-11f0-bb9a-db7e6ecdeeaa.html';

test.describe('Deadlock Demonstration FSM - 63b2add1-fa74-11f0-bb9a-db7e6ecdeeaa', () => {
  // Helper to attach listeners to capture console messages and page errors for each test.
  async function attachDiagnostics(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    return { consoleMessages, pageErrors };
  }

  // Utility to read the log div's text easily
  async function getLogText(page) {
    return await page.evaluate(() => document.getElementById('log').textContent);
  }

  test.beforeEach(async ({ page }) => {
    // Ensure fresh navigation for each test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('Initial Idle state: Start button is present and log is empty', async ({ page }) => {
    // Validate initial rendered components per FSM S0_Idle
    const startBtn = page.locator('#startBtn');
    await expect(startBtn).toBeVisible();
    await expect(startBtn).toHaveText('Start Deadlock Simulation');

    const logDiv = page.locator('#log');
    await expect(logDiv).toBeVisible();
    const text = await logDiv.textContent();
    // On initial load log should be empty (entry action renderPage() expected to render the UI)
    expect(text).toBe('');
  });

  test('Starting simulation triggers SimulationStarted and Task waiting states (S1 -> S2 & S3)', async ({ page }) => {
    // Attach diagnostics to capture console and runtime errors
    const { consoleMessages, pageErrors } = await attachDiagnostics(page);

    // Pre-fill the log to validate that click handler clears it (S1 entry action: logDiv.textContent = "")
    await page.evaluate(() => {
      document.getElementById('log').textContent = 'PREVIOUS LOG CONTENT\n';
    });
    // Click start to trigger StartSimulation event
    await page.click('#startBtn');

    // Wait for the expected messages to appear in the log (S1 entry and S2/S3 evidence)
    await page.waitForFunction(() => {
      const log = document.getElementById('log').textContent;
      return log.includes('Starting deadlock simulation...') &&
             log.includes('Task 1 started and tries to acquire Resource A') &&
             log.includes('Task 2 started and tries to acquire Resource B') &&
             log.includes('Both tasks started. They will deadlock trying to acquire the second resource.');
    }, { timeout: 3000 });

    const finalLog = await getLogText(page);

    // Ensure previous log content was cleared (verifies onEnter action for S1)
    expect(finalLog).not.toContain('PREVIOUS LOG CONTENT');

    // Check presence of FSM-evident messages
    expect(finalLog).toContain('Starting deadlock simulation...');
    expect(finalLog).toContain('Task 1 started and tries to acquire Resource A');
    expect(finalLog).toContain('Task 2 started and tries to acquire Resource B');
    expect(finalLog).toContain('Both tasks started. They will deadlock trying to acquire the second resource.');

    // Ensure there were no runtime page errors or console errors emitted during normal startup
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Deadlock behavior: first locks are acquired, second locks are contested, tasks do not finish', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachDiagnostics(page);

    // Start the simulation
    await page.click('#startBtn');

    // Wait for the tasks to acquire their first locks (these should succeed immediately)
    await page.waitForFunction(() => {
      const log1 = document.getElementById('log1').textContent;
      return log.includes('acquired lock on Resource A') && log.includes('acquired lock on Resource B');
    }, { timeout: 4000 });

    // Confirm those acquisition messages exist
    const logAfterFirstAcquire = await getLogText(page);
    expect(logAfterFirstAcquire).toContain('acquired lock on Resource A');
    expect(logAfterFirstAcquire).toContain('acquired lock on Resource B');

    // After about 1s each task will "try to acquire" the second lock and then enter waiting/queue,
    // They should NOT acquire both locks nor finish, demonstrating deadlock.
    // Wait for the "tries to acquire" second-resource messages to show up.
    await page.waitForFunction(() => {
      const log2 = document.getElementById('log2').textContent;
      return log.includes('Task 1 tries to acquire Resource B') && log.includes('Task 2 tries to acquire Resource A');
    }, { timeout: 4000 });

    const logAfterTrySecond = await getLogText(page);
    expect(logAfterTrySecond).toContain('Task 1 tries to acquire Resource B');
    expect(logAfterTrySecond).toContain('Task 2 tries to acquire Resource A');

    // Give a bit more time to ensure neither task proceeds to "acquired both locks" nor "finished its work"
    // Deadlock means those messages should not appear.
    await page.waitForTimeout(1500);

    const finalLog1 = await getLogText(page);
    expect(finalLog).not.toContain('acquired both locks');
    expect(finalLog).not.toContain('finished its work and released both locks.');

    // Ensure no uncaught page errors or console error messages occurred
    const consoleErrors1 = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Multiple Start clicks reset the simulation and do not cause uncaught errors (edge case)', async ({ page }) => {
    const { consoleMessages, pageErrors } = await attachDiagnostics(page);

    // Click start once and wait for initial "Starting" log
    await page.click('#startBtn');
    await page.waitForFunction(() => document.getElementById('log').textContent.includes('Starting deadlock simulation...'), { timeout: 2000 });

    // Click start again to simulate user trying to restart mid-simulation.
    // According to implementation, second click clears the log and restarts, so previous logs should be gone.
    await page.click('#startBtn');

    // Wait for new "Starting deadlock simulation..." to appear after second click
    await page.waitForFunction(() => {
      const log3 = document.getElementById('log3').textContent;
      // ensure the log contains the starting message and does not still contain multiple "Starting..." lines
      const occurrences = (log.match(/Starting deadlock simulation\.\.\./g) || []).length;
      return occurrences === 1 && log.includes('Task 1 started and tries to acquire Resource A') && log.includes('Task 2 started and tries to acquire Resource B');
    }, { timeout: 3000 });

    const finalLog2 = await getLogText(page);

    // The log should contain a single fresh run's messages and not contain remnants from the earlier run
    const startOccurrences = (finalLog.match(/Starting deadlock simulation\.\.\./g) || []).length;
    expect(startOccurrences).toBe(1);
    expect(finalLog).toContain('Task 1 started and tries to acquire Resource A');
    expect(finalLog).toContain('Task 2 started and tries to acquire Resource B');

    // No runtime page errors or console errors should have been emitted by repeated starts
    const consoleErrors2 = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM evidence: verify S1 entry clears log and writes starting message (onEnter/onExit validation)', async ({ page }) => {
    // Pre-populate log content to assert the onEnter action clears it
    await page.evaluate(() => {
      document.getElementById('log').textContent = 'SHOULD_BE_CLEARED';
    });

    // Click start
    await page.click('#startBtn');

    // Immediately after click, assert previous content is gone and starting message present
    await page.waitForFunction(() => {
      const log4 = document.getElementById('log4').textContent;
      return !log.includes('SHOULD_BE_CLEARED') && log.includes('Starting deadlock simulation...');
    }, { timeout: 1000 });

    const logText = await getLogText(page);
    expect(logText).not.toContain('SHOULD_BE_CLEARED');
    expect(logText).toContain('Starting deadlock simulation...');
  });
});