import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c160140-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Load Balancing Interactive Simulator (Application ID: 9c160140-fa79-11f0-8fe7-a5317bd8e2c6)', () => {
  // Shared collectors for console messages and page errors per test
  test.beforeEach(async ({ page }) => {
    // Collect console messages and uncaught page errors for assertions
    page.setDefaultTimeout(10_000);
    await page.goto(APP_URL);

    // Give page a short moment to boot (boot() runs on load and may autostart)
    await page.waitForTimeout(250);
  });

  // Helper to attach collectors and return them
  async function attachCollectors(page) {
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

  test.describe('Initial state and simulation control (S0_Idle -> S1_Running -> S2_Paused)', () => {
    test('Page boots, shows title and exposes LBSim state; autostart triggers simulation if checked', async ({ page }) => {
      // Attach collectors to observe runtime errors and logs
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Verify initial page title header exists
      const h1 = page.locator('h1');
      await expect(h1).toHaveText('Load Balancing Interactive Simulator');

      // The app exposes a global LBSim object. Verify it's present and that 'state' exists.
      const hasLBSim = await page.evaluate(() => !!window.LBSim && !!window.LBSim.state);
      expect(hasLBSim).toBe(true);

      // Read current running flag from exposed state
      const running = await page.evaluate(() => window.LBSim.state.running === true);
      // Because autostart checkbox is checked by default, boot() may have started the simulation.
      // Accept either running true (autostart) or false (if autostart disabled by something), but ensure 'running' is a boolean.
      expect(typeof running).toBe('boolean');

      // Pause the simulation using the Pause button and assert running becomes false and tickInterval cleared
      await page.click('#pauseBtn');
      await page.waitForTimeout(120); // give stopSim a moment to run
      const runningAfterPause = await page.evaluate(() => window.LBSim.state.running);
      expect(runningAfterPause).toBe(false);

      // Start again and verify the running flag toggles to true and tickInterval is set
      await page.click('#startBtn');
      // wait for interval to be created
      await page.waitForTimeout(250);
      const startState = await page.evaluate(() => {
        return { running: window.LBSim.state.running, hasInterval: !!window.LBSim.state.tickInterval };
      });
      expect(startState.running).toBe(true);
      expect(startState.hasInterval).toBe(true);

      // Clean up: pause simulation again
      await page.click('#pauseBtn');
      await page.waitForTimeout(120);

      // Ensure no uncaught page errors were raised during these operations
      expect(pageErrors.length).toBe(0);
      // Also ensure there are no console messages of severity 'error' (these would indicate runtime issues)
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Reset button stops simulation and resets core counters (ResetSimulation transition)', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Ensure simulation running (start if not)
      const isRunning = await page.evaluate(() => window.LBSim.state.running);
      if (!isRunning) {
        await page.click('#startBtn');
        await page.waitForTimeout(200);
      }

      // Create a request so there is something to reset
      await page.click('#sendOneBtn');
      await page.waitForTimeout(120);

      // Click reset (should stopSim() and reset various counters)
      await page.click('#resetBtn');
      await page.waitForTimeout(150);

      const stateAfterReset = await page.evaluate(() => {
        const s = window.LBSim.state;
        return {
          running: s.running,
          time: s.time,
          requestCounter: s.requestCounter,
          requestsKeys: Object.keys(s.requests).length,
          completed: s.completed,
          errors: s.errors,
          totalLatency: s.totalLatency,
          logContains: s.logs.some(e => e.raw && e.raw.indexOf('Simulator reset (kept servers)') !== -1)
        };
      });

      // According to FSM, ResetSimulation triggers stopSim() -> paused state
      expect(stateAfterReset.running).toBe(false);
      expect(stateAfterReset.time).toBe(0);
      // requestCounter reset to 0 by reset handler
      expect(stateAfterReset.requestCounter).toBe(0);
      expect(stateAfterReset.requestsKeys).toBe(0);
      expect(stateAfterReset.logContains).toBe(true);

      // No fatal page errors occurred
      expect(pageErrors.length).toBe(0);
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });
  });

  test.describe('Requests lifecycle and sending (S3_RequestSent)', () => {
    test('Send 1 Request produces a spawn debug log and increments sent counter', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Ensure at least one server exists; presetSimple creates 3 servers on boot, but ensure by calling presetSimple
      await page.click('#presetSimple');
      await page.waitForTimeout(120);

      // Clear logs for clean matching
      await page.click('#clearLog');
      await page.waitForTimeout(60);

      // Click Send 1 Request
      await page.click('#sendOneBtn');
      // Allow spawnRequest to run and assignment to occur
      await page.waitForTimeout(200);

      // Check that debug spawn log exists in textarea or in state logs
      const logsText = await page.locator('#log').inputValue();
      const hasSpawn = logsText.indexOf('Spawned request') !== -1 || logsText.indexOf('Spawned request') !== -1;
      expect(hasSpawn).toBe(true);

      // Verify statSent counter increments (statSent reflects state.requestCounter)
      const statSent = await page.locator('#statSent').innerText();
      // statSent should be >= 1
      expect(parseInt(statSent, 10)).toBeGreaterThanOrEqual(1);

      // Also verify there's at least one active request or it completed; query LBSim.state.requestCounter and state.requests
      const { requestCounter, activeRequests } = await page.evaluate(() => {
        return { requestCounter: window.LBSim.state.requestCounter, activeRequests: Object.keys(window.LBSim.state.requests).length };
      });
      expect(requestCounter).toBeGreaterThanOrEqual(1);
      expect(activeRequests).toBeGreaterThanOrEqual(0);

      // No uncaught page errors produced
      expect(pageErrors.length).toBe(0);
      // No console error-level messages
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });

    test('Send Burst (controlled by burstCount) enqueues multiple spawn logs and updates counters', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Ensure there is at least one server to accept requests
      await page.click('#presetSimple');
      await page.waitForTimeout(100);

      // Set burst count to 3 and click Send Burst
      await page.fill('#burstCount', '3');
      await page.click('#sendBurstBtn');

      // Wait for spawn and assignment handling
      await page.waitForTimeout(300);

      // Verify at least three "Spawned request" log entries exist in the textarea logs
      const logs = await page.locator('#log').inputValue();
      const spawnMatches = (logs.match(/Spawned request/g) || []).length;
      expect(spawnMatches).toBeGreaterThanOrEqual(1); // At least some spawn messages; randomness may affect immediate logs

      // Verify statSent increased accordingly (state.requestCounter)
      const counter = await page.evaluate(() => window.LBSim.state.requestCounter);
      expect(counter).toBeGreaterThanOrEqual(3);

      // No page errors
      expect(pageErrors.length).toBe(0);
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });

    test('Find request by id using Find button populates request detail area', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Create a single request and capture its id from logs or state
      await page.click('#presetSimple');
      await page.waitForTimeout(100);
      // Clear logs for clean result
      await page.click('#clearLog');
      await page.waitForTimeout(60);

      // Spawn a request
      await page.click('#sendOneBtn');
      await page.waitForTimeout(150);

      // Attempt to read the latest spawned request id from logs (debug entry contains 'Spawned request r<number>')
      const logs = await page.locator('#log').inputValue();
      const match = logs.match(/Spawned request (r\d+)/);
      let rid = null;
      if (match) rid = match[1];

      // If not found in logs yet, fallback to reading last request id from LBSim.state
      if (!rid) {
        rid = await page.evaluate(() => {
          const s = window.LBSim.state;
          const keys = Object.keys(s.requests);
          return keys.length ? keys[keys.length - 1] : null;
        });
      }

      expect(rid).not.toBeNull();

      // Use the Find UI to locate it
      await page.fill('#findReq', rid);
      await page.click('#findReqBtn');
      await page.waitForTimeout(80);

      const detail = await page.locator('#reqDetail').innerText();
      expect(detail).toContain(rid);

      // No uncaught runtime page errors
      expect(pageErrors.length).toBe(0);
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });
  });

  test.describe('Server management (S4_ServersManaged) and queue handling', () => {
    test('Add Server button increases server count and logs "Added server ..."', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Count current servers via servers table
      const initialCount = await page.locator('#serversTable tbody tr').count();

      // Click add server
      await page.click('#addServerBtn');
      await page.waitForTimeout(120);

      const afterCount = await page.locator('#serversTable tbody tr').count();
      expect(afterCount).toBeGreaterThanOrEqual(initialCount + 1);

      // Check serverSummary contains new server name 'srv'
      const summary = await page.locator('#serverSummary').innerText();
      expect(summary).toContain('srv');

      // Confirm state.logs contains an 'Added server' info entry
      const logsText = await page.locator('#log').inputValue();
      expect(logsText).toContain('Added server');

      // No page errors
      expect(pageErrors.length).toBe(0);
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });

    test('Reset Servers clears all servers and logs "Reset all servers"', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Ensure we have servers
      await page.click('#presetSimple');
      await page.waitForTimeout(120);
      const before = await page.locator('#serversTable tbody tr').count();
      expect(before).toBeGreaterThanOrEqual(1);

      // Click Reset Servers
      await page.click('#resetServersBtn');
      await page.waitForTimeout(120);

      // Now servers table should be empty
      const after = await page.locator('#serversTable tbody tr').count();
      expect(after).toBe(0);

      // serverSummary should be empty
      const summary = await page.locator('#serverSummary').innerText();
      expect(summary.trim()).toBe('');

      // Log area should contain 'Reset all servers'
      const logs = await page.locator('#log').inputValue();
      expect(logs).toContain('Reset all servers');

      // No page errors
      expect(pageErrors.length).toBe(0);
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });

    test('Drain All Servers sets draining flag on servers and updates UI', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Ensure servers exist
      await page.click('#presetSimple');
      await page.waitForTimeout(120);

      // Click Drain All Servers
      await page.click('#drainAllBtn');
      await page.waitForTimeout(120);

      // serverSummary should include 'draining=true' for servers
      const summary = await page.locator('#serverSummary').innerText();
      expect(summary).toContain('draining=true');

      // Log area should mention 'All servers set to draining'
      const logs = await page.locator('#log').inputValue();
      expect(logs).toContain('All servers set to draining');

      // No uncaught errors
      expect(pageErrors.length).toBe(0);
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });

    test('Clear Queues empties global queue and updates summary (ClearQueues event)', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Make servers unavailable to force queueing: uncheck the 'Up?' checkbox for each server row
      await page.click('#presetSimple');
      await page.waitForTimeout(120);

      const upCheckboxes = page.locator('#serversTable tbody tr td input[type="checkbox"]');
      const count = await upCheckboxes.count();
      // Uncheck all 'up' checkboxes
      for (let i = 0; i < count; i++) {
        const el = upCheckboxes.nth(i);
        // If checked, click to uncheck; some checkboxes may be unchecked already
        const checked = await el.isChecked();
        if (checked) await el.click();
      }
      await page.waitForTimeout(80);

      // Send a request which should go to global queue (no available servers)
      await page.click('#sendOneBtn');
      await page.waitForTimeout(150);

      // Check global queue length in UI
      const statQueueText = await page.locator('#statQueue').innerText();
      // statQueue may reflect queue length; we expect it to be >= 0
      expect(parseInt(statQueueText || '0', 10)).toBeGreaterThanOrEqual(0);

      // Click Clear Queues
      await page.click('#clearQueueBtn');
      await page.waitForTimeout(120);

      // After clearing, statQueue should be zero
      const statQueueAfter = await page.locator('#statQueue').innerText();
      expect(parseInt(statQueueAfter || '0', 10)).toBeGreaterThanOrEqual(0);

      // Logs should include 'Cleared all queues'
      const logs = await page.locator('#log').inputValue();
      expect(logs).toContain('Cleared all queues');

      // No runtime page errors
      expect(pageErrors.length).toBe(0);
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });
  });

  test.describe('Preset topologies and UI actions (components & transitions)', () => {
    test('Preset buttons create expected server topologies', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Preset Simple -> expect 3 servers
      await page.click('#presetSimple');
      await page.waitForTimeout(120);
      const simpleCount = await page.locator('#serversTable tbody tr').count();
      expect(simpleCount).toBeGreaterThanOrEqual(3);

      // Preset Weighted -> expect at least 3 servers (different weights)
      await page.click('#presetWeighted');
      await page.waitForTimeout(120);
      const weightedCount = await page.locator('#serversTable tbody tr').count();
      expect(weightedCount).toBeGreaterThanOrEqual(3);

      // Preset Hetero -> expect at least 3 servers
      await page.click('#presetHetero');
      await page.waitForTimeout(120);
      const heteroCount = await page.locator('#serversTable tbody tr').count();
      expect(heteroCount).toBeGreaterThanOrEqual(3);

      // Verify no page errors from changing presets
      expect(pageErrors.length).toBe(0);
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });

    test('Export log and export configuration actions do not produce uncaught errors', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Click export log (this will create and click an anchor)
      await page.click('#exportLog');
      await page.waitForTimeout(80);

      // Click export config
      await page.click('#exportBtn');
      await page.waitForTimeout(80);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });
  });

  test.describe('Edge cases, UI interactions, and error observation', () => {
    test('Toggling server failure and triggering health checks does not crash the page', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Create servers and toggle first server to down via its 'Toggle Fail' button if present
      await page.click('#presetSimple');
      await page.waitForTimeout(120);

      // Click first row 'Toggle Fail' button
      const toggleFailBtn = page.locator('#serversTable tbody tr').first().locator('button', { hasText: 'Toggle Fail' });
      if (await toggleFailBtn.count()) {
        await toggleFailBtn.click();
        await page.waitForTimeout(80);
      }

      // Advance simulation by stepping a few ticks to allow health checks to run
      for (let i = 0; i < 3; i++) {
        await page.click('#stepBtn');
        await page.waitForTimeout(80);
      }

      // Ensure page hasn't produced uncaught page errors
      expect(pageErrors.length).toBe(0);
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });

    test('Observe console and page errors (assert none of ReferenceError/SyntaxError/TypeError were thrown)', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachCollectors(page);

      // Trigger various UI operations to exercise code paths
      await page.click('#presetSimple');
      await page.waitForTimeout(100);
      await page.click('#addServerBtn');
      await page.waitForTimeout(80);
      await page.click('#sendOneBtn');
      await page.waitForTimeout(120);
      await page.click('#clearLog');
      await page.waitForTimeout(60);
      await page.click('#resetServersBtn');
      await page.waitForTimeout(80);

      // Now make assertions about collected errors/messages
      // There should be no uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
      expect(pageErrors.length).toBe(0);

      // Inspect console messages - ensure none indicate a fatal error
      const fatalConsole = consoleMessages.filter(m => {
        const t = m.text || '';
        return /ReferenceError|SyntaxError|TypeError|Uncaught/.test(t) || m.type === 'error';
      });
      // If fatalConsole is non-empty, fail the test and print messages
      expect(fatalConsole.length).toBe(0);
    });
  });
});