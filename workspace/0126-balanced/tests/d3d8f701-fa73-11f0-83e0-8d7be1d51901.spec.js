import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d8f701-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('d3d8f701-fa73-11f0-83e0-8d7be1d51901 - Deadlock Demonstration E2E', () => {
  let page;
  let pageConsole = [];
  let pageErrors = [];

  // Utility: wait for text to appear in #log (polling)
  async function waitForLogContains(page, substr, { timeout = 5000 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const text = await page.locator('#log').innerText();
      if (text.includes(substr)) return text;
      await page.waitForTimeout(100);
    }
    throw new Error(`Timed out waiting for log to contain "${substr}"`);
  }

  // Utility: short sleep
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();

    // Capture console lines and page errors for assertions
    pageConsole = [];
    pageErrors = [];
    page.on('console', msg => {
      pageConsole.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    // Wait a short time to let initialization run (resetAll on init)
    await page.waitForLoadState('load');
    await sleep(200);
  });

  test.afterEach(async () => {
    if (page && !page.isClosed()) await page.close();
  });

  test.describe('Idle state (S0_Idle)', () => {
    test('initial UI reflects Idle state and resetAll was called', async () => {
      // Validate process statuses are Idle
      await expect(page.locator('#procAStatus')).toHaveText('Idle');
      await expect(page.locator('#procBStatus')).toHaveText('Idle');

      // Owners should be empty (—)
      await expect(page.locator('#ownerR1')).toHaveText('—');
      await expect(page.locator('#ownerR2')).toHaveText('—');

      // Resource dots should show free class
      const dotR1 = page.locator('#dotR1');
      const dotR2 = page.locator('#dotR2');
      await expect(dotR1).toHaveClass(/free/);
      await expect(dotR2).toHaveClass(/free/);

      // Log should be cleared by resetAll on initialization
      const logText = await page.locator('#log').innerText();
      expect(logText.trim().length).toBeLessThanOrEqual(0);

      // No page runtime errors during initial load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Deadlock scenario (S1_Deadlock) and transitions', () => {
    test('start deadlock triggers processes and detection (S0 -> S1)', async () => {
      // Start Deadlock
      await page.locator('#startDead').click();

      // Expect top-level log entry about starting deadlock
      await waitForLogContains(page, 'Starting DEADLOCK scenario');

      // Processes should log starts
      await waitForLogContains(page, 'Process A: start');
      await waitForLogContains(page, 'Process B: start');

      // Wait-for graph should eventually detect a cycle => deadlock detection
      await waitForLogContains(page, 'Deadlock detected (cycle)', { timeout: 7000 });

      // UI should display detection message in the graph area
      await expect(page.locator('#cycleInfo')).toContainText('Deadlock detected!');

      // The graph description should show wait-for edges indicating circular wait
      await expect(page.locator('#graphDesc')).toContainText('Wait-for edges');

      // Ensure no uncaught page errors occurred
      expect(pageErrors.length).toBe(0);
    });

    test('clicking start while simulation running logs "Simulation already running"', async () => {
      // Start Deadlock
      await page.locator('#startDead').click();
      await waitForLogContains(page, 'Starting DEADLOCK scenario');

      // Attempt to start Ordered while simulation is running
      await page.locator('#startOrdered').click();

      // The UI script logs "Simulation already running"
      await waitForLogContains(page, 'Simulation already running');

      // No page errors occurred
      expect(pageErrors.length).toBe(0);
    });

    test('break deadlock forces release and processes can complete (S1 -> S3)', async () => {
      // Start Deadlock
      await page.locator('#startDead').click();
      await waitForLogContains(page, 'Starting DEADLOCK scenario');
      // Wait until deadlock is detected
      await waitForLogContains(page, 'Deadlock detected (cycle)', { timeout: 7000 });
      await expect(page.locator('#cycleInfo')).toContainText('Deadlock detected!');

      // Break deadlock by clicking the break button
      await page.locator('#breakDead').click();

      // The log should mention force-releasing R2
      await waitForLogContains(page, 'Force-releasing R2 to break deadlock');

      // After breaking, the cycleInfo should no longer claim a deadlock
      // It may take a short moment for UI update; wait a bit
      await page.waitForTimeout(300);
      const cycleText = await page.locator('#cycleInfo').innerText();
      // Either the cycle info becomes empty or no longer contains "Deadlock detected!"
      expect(cycleText.includes('Deadlock detected!')).toBeFalsy();

      // Wait for processes to finish (become Done). They should continue after forced release.
      await expect(page.locator('#procAStatus')).toHaveText(/Done/, { timeout: 6000 });
      await expect(page.locator('#procBStatus')).toHaveText(/Done/, { timeout: 6000 });

      // Owners should be released
      await expect(page.locator('#ownerR1')).toHaveText('—');
      await expect(page.locator('#ownerR2')).toHaveText('—');

      // No page errors occurred
      expect(pageErrors.length).toBe(0);
    });

    test('reset from deadlock returns to Idle (S1 -> S0)', async () => {
      // Start Deadlock
      await page.locator('#startDead').click();
      await waitForLogContains(page, 'Starting DEADLOCK scenario');

      // Click reset while simulation running
      await page.locator('#reset').click();

      // Log should include Reset simulation
      await waitForLogContains(page, 'Reset simulation');

      // Ensure statuses reset to Idle
      await expect(page.locator('#procAStatus')).toHaveText('Idle');
      await expect(page.locator('#procBStatus')).toHaveText('Idle');

      // Owners should be cleared
      await expect(page.locator('#ownerR1')).toHaveText('—');
      await expect(page.locator('#ownerR2')).toHaveText('—');

      // Graph should show no active waits
      await expect(page.locator('#graphDesc')).toHaveText('No active waits.');

      // No page errors occurred
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Ordered scenario (S2_Ordered) and transitions', () => {
    test('start ordered avoids deadlock and processes complete (S0 -> S2)', async () => {
      // Ensure starting from idle
      await expect(page.locator('#procAStatus')).toHaveText('Idle');

      // Click start ordered scenario
      await page.locator('#startOrdered').click();

      // Log should indicate ordered start
      await waitForLogContains(page, 'Starting ORDERED scenario');

      // Processes should start and eventually finish without a deadlock detection message
      await waitForLogContains(page, 'Process A: start');
      await waitForLogContains(page, 'Process B: start');

      // Ensure there is NO "Deadlock detected" log for ordered scenario within the time the processes run
      // Wait sufficiently for processes to run and release (max ~1s-2s)
      await page.waitForTimeout(1400);
      const logTextAfter = await page.locator('#log').innerText();
      expect(logTextAfter.includes('Deadlock detected (cycle)')).toBeFalsy();

      // Processes should reach Done
      await expect(page.locator('#procAStatus')).toHaveText(/Done/, { timeout: 4000 });
      await expect(page.locator('#procBStatus')).toHaveText(/Done/, { timeout: 4000 });

      // After completion, owners should be cleared
      await expect(page.locator('#ownerR1')).toHaveText('—');
      await expect(page.locator('#ownerR2')).toHaveText('—');

      // No page errors occurred
      expect(pageErrors.length).toBe(0);
    });

    test('break deadlock in ordered mode acts as safety but leaves system stable (S2 -> S3)', async () => {
      // Start Ordered
      await page.locator('#startOrdered').click();
      await waitForLogContains(page, 'Starting ORDERED scenario');

      // Click break while ordered is running (should be benign)
      await page.locator('#breakDead').click();
      await waitForLogContains(page, 'Force-releasing R2 to break deadlock');

      // Wait for processes to still complete or be stable
      await page.waitForTimeout(500);
      // Processes should either be running or finish without throwing errors
      // Check that owner fields are either '—' or have a valid value; but ensure no exceptions.
      expect(pageErrors.length).toBe(0);
    });

    test('reset from ordered returns to Idle (S2 -> S0)', async () => {
      // Start Ordered
      await page.locator('#startOrdered').click();
      await waitForLogContains(page, 'Starting ORDERED scenario');

      // Click reset
      await page.locator('#reset').click();
      await waitForLogContains(page, 'Reset simulation');

      // Validate Idle state restored
      await expect(page.locator('#procAStatus')).toHaveText('Idle');
      await expect(page.locator('#procBStatus')).toHaveText('Idle');
      await expect(page.locator('#ownerR1')).toHaveText('—');
      await expect(page.locator('#ownerR2')).toHaveText('—');

      // No page errors occurred
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Detection toggle and UI controls', () => {
    test('detect toggle toggles auto-detection text and enables/disables detection loop', async () => {
      // Initially ON
      await expect(page.locator('#detectToggle')).toHaveText(/Auto-detect: ON/);

      // Toggle OFF
      await page.locator('#detectToggle').click();
      await expect(page.locator('#detectToggle')).toHaveText(/Auto-detect: OFF/);

      // Toggle back ON
      await page.locator('#detectToggle').click();
      await expect(page.locator('#detectToggle')).toHaveText(/Auto-detect: ON/);

      // No page errors occurred
      expect(pageErrors.length).toBe(0);
    });

    test('breakDead on idle logs the force-release message and does not error', async () => {
      // Ensure idle
      await expect(page.locator('#procAStatus')).toHaveText('Idle');

      // Click breakDead when nothing running
      await page.locator('#breakDead').click();
      await waitForLogContains(page, 'Force-releasing R2 to break deadlock');

      // Owners remain free
      await expect(page.locator('#ownerR1')).toHaveText('—');
      await expect(page.locator('#ownerR2')).toHaveText('—');

      // No page errors occurred
      expect(pageErrors.length).toBe(0);
    });

    test('clicking resource areas triggers manual force-release and logs it', async () => {
      // Click res1 and res2 and verify logs
      await page.locator('#res1').click();
      await waitForLogContains(page, 'R1 force-released (manual)');

      await page.locator('#res2').click();
      await waitForLogContains(page, 'R2 force-released (manual)');

      // No page errors occurred
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('multiple rapid toggles and starts do not cause runtime exceptions', async () => {
      // Rapidly toggle detect and press start buttons
      for (let i = 0; i < 3; i++) {
        await page.locator('#detectToggle').click();
        await sleep(50);
      }

      // Attempt to start ordered and deadlock rapidly
      await page.locator('#startOrdered').click();
      await sleep(50);
      await page.locator('#startDead').click();

      // Reset to clean up
      await page.locator('#reset').click();
      await waitForLogContains(page, 'Reset simulation');

      // Ensure there were no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('monitor console for unexpected runtime errors during typical flows', async () => {
      // Run another full deadlock and break cycle to exercise code paths
      await page.locator('#startDead').click();
      await waitForLogContains(page, 'Starting DEADLOCK scenario');
      await waitForLogContains(page, 'Deadlock detected (cycle)', { timeout: 7000 });
      await page.locator('#breakDead').click();
      await waitForLogContains(page, 'Force-releasing R2 to break deadlock');
      await page.locator('#reset').click();
      await waitForLogContains(page, 'Reset simulation');

      // Assert captured page errors array remains empty (no ReferenceError/SyntaxError/TypeError)
      expect(pageErrors.length).toBe(0);

      // Also assert there were no console.error entries captured
      const consoleErrors = pageConsole.filter(c => c.type === 'error' || c.type === 'warning');
      expect(consoleErrors.length).toBe(0);
    });
  });
});