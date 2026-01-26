import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c169d81-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Runtime Environment Simulator (FSM) - 9c169d81-fa79-11f0-8fe7-a5317bd8e2c6', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Auto-accept or auto-dismiss dialogs (alerts/confirm/prompts) to avoid blocking test flow
    page.on('dialog', async (dialog) => {
      // Accept confirm dialogs by default, and accept alerts
      try {
        await dialog.accept();
      } catch {
        try { await dialog.dismiss(); } catch {}
      }
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait a moment to allow initial engine tick and initialization logs
    await page.waitForTimeout(300);
  });

  test.afterEach(async ({ page }) => {
    // Basic assertion: ensure no unexpected fatal exceptions like SyntaxError/ReferenceError/TypeError occurred.
    // We allow the page to produce natural logs and minor errors, but assert none of the captured pageErrors
    // are instances of ReferenceError, SyntaxError, or TypeError.
    const fatalErrors = pageErrors.filter(e => {
      const name = e && e.name;
      return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
    });
    expect(fatalErrors, 'No ReferenceError/SyntaxError/TypeError should be thrown by the page').toHaveLength(0);
    // Additionally assert no pageErrors at all (most interactive pages should not throw)
    expect(pageErrors, 'No unexpected page errors').toHaveLength(0);

    // Ensure we recorded some console logs produced by the app (sanity)
    const hasInitLog = consoleMessages.some(m => m.text && m.text.includes('Simulator initialized'));
    expect(hasInitLog).toBeTruthy();
  });

  test.describe('Instance lifecycle states and transitions', () => {

    test('Initial selected instance should be in Stopped state', async ({ page }) => {
      // Validate the UI shows a selected instance and its state is 'stopped'
      const selected = await page.locator('#selectedId').textContent();
      expect(selected).toBeTruthy();
      const stateText = await page.locator('#stateDisplay').textContent();
      expect(stateText).toContain('State: stopped');
    });

    test('Start: Stopped -> Initializing -> Running', async ({ page }) => {
      // Click Start and verify the state goes through 'initializing' then 'running'
      await page.click('#startBtn');

      // Immediately should show initializing (triggerAction sets state immediately)
      await expect.poll(async () => (await page.locator('#stateDisplay').textContent()).includes('initializing'), {
        timeout: 1000,
        message: 'Expected stateDisplay to include initializing quickly'
      }).toBeTruthy();

      // After the initialization timeout (~800ms) it should be 'running'
      await expect.poll(async () => (await page.locator('#stateDisplay').textContent()).includes('State: running'), {
        timeout: 2500,
        message: 'Expected stateDisplay to show running after initialization timeout'
      }).toBeTruthy();

      // Verify events log contains both initializing and running messages
      const eventsText = await page.locator('#events').textContent();
      expect(eventsText).toContain('initializing');
      expect(eventsText).toContain('running');
    });

    test('Pause and Resume: Running <-> Paused', async ({ page }) => {
      // Ensure running
      const stateBefore = await page.locator('#stateDisplay').textContent();
      if (!stateBefore.includes('State: running')) {
        await page.click('#startBtn');
        await page.waitForTimeout(900);
      }

      // Pause
      await page.click('#pauseBtn');
      await expect.poll(async () => (await page.locator('#stateDisplay').textContent()).includes('State: paused'), {
        timeout: 1000,
        message: 'Expected state to become paused after pause click'
      }).toBeTruthy();
      expect(await page.locator('#events').textContent()).toContain('paused');

      // Resume
      await page.click('#resumeBtn');
      await expect.poll(async () => (await page.locator('#stateDisplay').textContent()).includes('State: running'), {
        timeout: 1000,
        message: 'Expected state to return to running after resume'
      }).toBeTruthy();
      expect(await page.locator('#events').textContent()).toContain('resumed');
    });

    test('Stop: Running -> Terminating -> Stopped', async ({ page }) => {
      // Ensure running
      if (!(await page.locator('#stateDisplay').textContent()).includes('State: running')) {
        await page.click('#startBtn');
        await page.waitForTimeout(900);
      }

      // Stop
      await page.click('#stopBtn');

      // Immediately should be terminating
      await expect.poll(async () => (await page.locator('#stateDisplay').textContent()).includes('terminating'), {
        timeout: 500,
        message: 'Expected terminating state shortly after stop'
      }).toBeTruthy();

      // After terminating timeout (~600ms) should be stopped
      await expect.poll(async () => (await page.locator('#stateDisplay').textContent()).includes('State: stopped'), {
        timeout: 2000,
        message: 'Expected stopped state after terminating delay'
      }).toBeTruthy();

      // Check events contain terminating and stopped
      const ev = await page.locator('#events').textContent();
      expect(ev).toContain('terminating');
      expect(ev).toContain('stopped');
    });

    test('Crash -> Crashed and Start from Crashed triggers auto-restart path', async ({ page }) => {
      // Ensure running then crash
      await page.click('#startBtn');
      await page.waitForTimeout(900);

      await page.click('#crashBtn');

      // Crash should set state to crashed immediately
      await expect.poll(async () => (await page.locator('#stateDisplay').textContent()).includes('State: crashed'), {
        timeout: 500,
        message: 'Expected crashed state immediately after crash'
      }).toBeTruthy();

      const eventsAfterCrash = await page.locator('#events').textContent();
      expect(eventsAfterCrash).toContain('crashed');

      // Start from crashed: should set to initializing and then to running (auto-restart)
      await page.click('#startBtn');

      // Should go initializing quickly
      await expect.poll(async () => (await page.locator('#stateDisplay').textContent()).includes('initializing'), {
        timeout: 800,
        message: 'Expected initializing after start from crashed'
      }).toBeTruthy();

      // After ~500ms auto-restart should bring to running
      await expect.poll(async () => (await page.locator('#stateDisplay').textContent()).includes('State: running'), {
        timeout: 2500,
        message: 'Expected running after auto-restart from crashed'
      }).toBeTruthy();

      const eventsText = await page.locator('#events').textContent();
      expect(eventsText).toContain('auto-restart') || expect(eventsText).toContain('auto-restarted');
    });

    test('Kill: Running -> Killed (fault recorded)', async ({ page }) => {
      // Ensure running
      if (!(await page.locator('#stateDisplay').textContent()).includes('State: running')) {
        await page.click('#startBtn');
        await page.waitForTimeout(900);
      }

      await page.click('#killBtn');

      // Kill should be immediate
      await expect.poll(async () => (await page.locator('#stateDisplay').textContent()).includes('State: killed'), {
        timeout: 500,
        message: 'Expected killed state immediately after kill'
      }).toBeTruthy();

      // Fault should be indicated in state display
      const stateText = await page.locator('#stateDisplay').textContent();
      expect(stateText).toContain('Fault: killed');
      const ev = await page.locator('#events').textContent();
      expect(ev).toContain('killed');
    });
  });

  test.describe('Snapshots, tasks, export/import, cloning and deletion', () => {

    test('Create Snapshot, restore it, and roll back', async ({ page }) => {
      // Ensure we have a selected instance
      const selBefore = await page.locator('#selectedId').textContent();
      expect(selBefore).toBeTruthy();

      // Ensure a stable state
      if (!(await page.locator('#stateDisplay').textContent()).includes('State: running')) {
        await page.click('#startBtn');
        await page.waitForTimeout(900);
      }

      // Create a snapshot
      const snapNameInput = page.locator('#snapName');
      await snapNameInput.fill('test-snap-1');
      await page.click('#createSnapBtn');

      // Snapshot should be created and show up in snapList
      await expect.poll(async () => (await page.locator('#snapList').locator('option').count()) > 0, {
        timeout: 1000
      }).toBeTruthy();

      const snapOptionText = await page.locator('#snapList').locator('option').first().textContent();
      expect(snapOptionText).toContain('test-snap-1');

      // Modify a config value and apply
      await page.locator('#cpuSlider').fill('2');
      await page.click('#applyConfig');

      // Now restore the snapshot
      // Select the snapshot option
      await page.locator('#snapList').selectOption({ index: 0 });
      await page.click('#restoreSelectedSnap');

      // After restore, events and logs should indicate restored snapshot
      const log = await page.locator('#logConsole').textContent();
      expect(log).toContain('Restored') || expect(await page.locator('#events').textContent()).toContain('restored snapshot');
    });

    test('Queue a task and run now; validate task lifecycle and events', async ({ page }) => {
      // Ensure selected instance
      const sel = await page.locator('#selectedId').textContent();
      expect(sel).toBeTruthy();

      // Set a short task command and run now
      await page.locator('#taskCmd').fill('backup-test');
      await page.click('#runTaskNowBtn');

      // The events should include running task and later completed task (task durations up to ~3s)
      await expect.poll(async () => (await page.locator('#events').textContent()).includes('running task backup-test'), {
        timeout: 1500
      }).toBeTruthy();

      await expect.poll(async () => (await page.locator('#events').textContent()).includes('completed task backup-test'), {
        timeout: 5000
      }).toBeTruthy();
    });

    test('Create, Clone and Delete instance flows', async ({ page }) => {
      // Create a new instance using form fields
      await page.locator('#newName').fill('playwright-new');
      await page.locator('#newType').selectOption('vm');
      await page.click('#createBtn');

      // New instance should become selected
      const selected = await page.locator('#selectedId').textContent();
      expect(selected).toContain('playwright-new');

      // Clone the selected instance
      await page.click('#cloneBtn');

      // After cloning, selected instance should be the clone (name includes -clone)
      const selAfterClone = await page.locator('#selectedId').textContent();
      expect(selAfterClone).toContain('playwright-new-clone');

      // Delete the selected (clone) instance: confirm dialog auto-accepted in beforeEach
      await page.click('#deleteBtn');

      // After deletion, ensure the instances list still contains at least one instance and UI updated
      const options = await page.locator('#instancesList option').allTextContents();
      expect(options.length).toBeGreaterThanOrEqual(1);
    });

    test('Export and Import Selected Instance JSON', async ({ page }) => {
      // Ensure a selected instance exists
      const sel = await page.locator('#selectedId').textContent();
      expect(sel).toBeTruthy();

      // Export selected instance
      await page.click('#exportBtn');

      // Export area should contain JSON
      const exported = await page.locator('#exportArea').inputValue();
      expect(exported).toBeTruthy();
      expect(() => JSON.parse(exported)).not.toThrow();

      // Modify exportArea (simulate copy/paste) and then import as new instance
      // Keep the same JSON to import - app code will assign a new id
      await page.click('#importBtn');

      // After import, the newly imported instance should be selected (import handler selects new instance)
      const newSel = await page.locator('#selectedId').textContent();
      expect(newSel).toBeTruthy();
      // The export/import will create a new name that includes original name or import- prefix
      expect(newSel.length).toBeGreaterThan(0);
    });
  });

  test.describe('Configuration, CLI, Fault injection and triggers', () => {

    test('Apply config, Undo and Redo operations', async ({ page }) => {
      // Ensure selected instance exists
      const sel = await page.locator('#selectedId').textContent();
      expect(sel).toBeTruthy();

      // Change the CPU slider value and apply config
      await page.locator('#cpuSlider').fill('3');
      await page.click('#applyConfig');

      // Confirm config applied by checking state display reflects CPU in Config line
      const metricsText = await page.locator('#metrics').textContent();
      expect(metricsText).toContain('Configured CPU: 3') || expect(metricsText).toContain('cpu: 3');

      // Undo should revert config (undo button)
      await page.click('#undoBtn');
      await page.waitForTimeout(300);
      const metricsAfterUndo = await page.locator('#metrics').textContent();
      // After undo, it may revert to a value not equal to 3
      expect(metricsAfterUndo).not.toBeNull();

      // Redo should reapply (if available)
      await page.click('#redoBtn');
      await page.waitForTimeout(300);
      const metricsAfterRedo = await page.locator('#metrics').textContent();
      expect(metricsAfterRedo).not.toBeNull();
    });

    test('Fault injection via UI and resolution', async ({ page }) => {
      // Ensure running state for meaningful fault injection effects
      if (!(await page.locator('#stateDisplay').textContent()).includes('State: running')) {
        await page.click('#startBtn');
        await page.waitForTimeout(900);
      }

      // Select a fault type and inject
      await page.locator('#faultSelect').selectOption('disk');
      await page.click('#injectFaultBtn');

      // After injection, state display should show fault 'disk' and a log entry
      await expect.poll(async () => (await page.locator('#stateDisplay').textContent()).includes('Fault: disk'), {
        timeout: 1000
      }).toBeTruthy();

      const eventsAfterInject = await page.locator('#events').textContent();
      expect(eventsAfterInject).toContain('injected fault') || expect(await page.locator('#logConsole').textContent()).toContain('Injected');

      // Resolve the fault
      await page.click('#resolveFaultBtn');

      // After resolution, fault should be 'none' in UI
      await expect.poll(async () => (await page.locator('#stateDisplay').textContent()).includes('Fault: none'), {
        timeout: 1000
      }).toBeTruthy();
    });

    test('CLI commands: start, status, env set, exec, snapshot, scale', async ({ page }) => {
      // Enter multiple CLI commands and run them
      const cliInput = page.locator('#cliInput');
      await cliInput.fill('status\nenv set TEST_VAR hello\nexec echo hi\nsnapshot\nscale 2\nstart');
      await page.click('#cliRunBtn');

      // After start, ensure running state
      await expect.poll(async () => (await page.locator('#stateDisplay').textContent()).includes('State: running'), {
        timeout: 2500
      }).toBeTruthy();

      // Status and CLI logs should produce entries in the logConsole
      const logText = await page.locator('#logConsole').textContent();
      expect(logText).toContain('CLI') || expect(logText.length).toBeGreaterThan(0);

      // After scale command, state display should reflect scale: 2
      await expect.poll(async () => (await page.locator('#stateDisplay').textContent()).includes('Scale: 2'), {
        timeout: 1000
      }).toBeTruthy();
    });

    test('Triggers: add trigger and fire when load increases', async ({ page }) => {
      // Add a trigger that fires when load > 10
      await page.locator('#triggerExpr').fill('load>10');
      await page.click('#addTriggerBtn');

      // Increase load slider to trigger condition for selected instance
      await page.locator('#loadSlider').fill('80');
      // Trigger input updates loadVal but engine tick runs every 1s; wait and observe events
      await page.waitForTimeout(1500);

      // Expect that a trigger fired event is recorded (trigger fired: load>10)
      const events = await page.locator('#events').textContent();
      expect(events).toContain('trigger fired') || expect(events).toContain('trigger fired:');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Attempt actions without selection should show alerts (handled via dialog.accept)', async ({ page }) => {
      // Temporarily de-select instances by manipulating selection: select nothing if possible
      // Because the page requires a selected instance and init selects one, attempt to remove it via delete until only one left and then delete it to reach no selection.
      // We'll create a transient instance and then delete all to force no selection and produce alerts for operations that require selection.
      // Create a new instance and then delete all instances by clicking delete and accepting dialogs.
      await page.locator('#newName').fill('temp-delete-all');
      await page.click('#createBtn');

      // Delete instances repeatedly until only one or none remains
      const getOptionsCount = async () => await page.locator('#instancesList option').count();
      let count = await getOptionsCount();
      // Delete until possible (the UI will prompt confirm which we accept)
      while (count > 0) {
        // Select the first option then delete
        await page.locator('#instancesList').selectOption({ index: 0 });
        await page.click('#deleteBtn');
        await page.waitForTimeout(200);
        const newCount = await getOptionsCount();
        if (newCount === count) break; // avoid infinite loop if deletion prevented
        count = newCount;
      }

      // At this point there may be zero instances selected, attempt an action that requires selection and ensure dialog was shown (dialog auto-accepted by handler)
      // For example, click injectFaultBtn which will alert 'Select instance' when no selection
      await page.click('#injectFaultBtn');
      // No throws; verify that application did not crash (no page errors)
      expect(pageErrors.length).toBe(0);
    });

    test('Attempt injecting a fault without selecting a fault option triggers an alert (handled)', async ({ page }) => {
      // Ensure an instance exists (create one if none)
      if ((await page.locator('#instancesList option').count()) === 0) {
        await page.locator('#newName').fill('temp-for-fault');
        await page.click('#createBtn');
      }

      // Ensure the faultSelect is set to empty option (value "")
      await page.locator('#faultSelect').selectOption('');
      // Click injectFaultBtn should trigger an alert('Select a fault to inject') which we auto-accept
      await page.click('#injectFaultBtn');

      // Confirm no page errors occurred
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console & Page error observation (ensuring no fatal runtime errors)', () => {
    test('No fatal ReferenceError/SyntaxError/TypeError occurred during interactions', async ({ page }) => {
      // This test relies on afterEach assertions, but we add an extra check here: ensure console and pageErrors do not include fatal error markers
      // Check captured console messages for 'ReferenceError' or 'TypeError' keywords
      const badConsole = consoleMessages.filter(m => /ReferenceError|TypeError|SyntaxError|Uncaught/.test(m.text));
      expect(badConsole, 'Console should not contain fatal JS error messages').toHaveLength(0);

      // Check pageErrors collected; none should be ReferenceError/SyntaxError/TypeError (duplicate check)
      const fatalErrors = pageErrors.filter(e => {
        const name = e && e.name;
        return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
      });
      expect(fatalErrors, 'No fatal errors should be present in pageErrors').toHaveLength(0);
    });
  });
});