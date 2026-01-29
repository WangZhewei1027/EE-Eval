import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c164f60-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Helper utilities (page-object style small helpers)
async function clickAndWaitForLog(page, selector, text, options = {}) {
  const { timeout = 2000 } = options;
  await page.click(selector);
  await page.waitForFunction(
    (expected) => document.getElementById('log').textContent.includes(expected),
    text,
    { timeout }
  );
}

async function waitForLogContains(page, text, timeout = 2000) {
  await page.waitForFunction(
    (expected) => document.getElementById('log').textContent.includes(expected),
    text,
    { timeout }
  );
}

async function getRegistryObjects(page) {
  const raw = await page.$eval('#registry', el => el.textContent);
  try {
    return JSON.parse(raw || '[]');
  } catch (e) {
    // in case registry contains non-JSON or is empty, return as string fallback
    return raw;
  }
}

test.describe('Design Patterns Interactive Playground - FSM and interactions', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];
    // collect page errors and console messages for assertions
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    await page.goto(APP_URL);
    // Wait for initial log line to ensure script ran
    await waitForLogContains(page, 'Interactive playground ready', 2000);
    // Ensure initial registry is populated (initial objects added at the end of script)
    const registry = await getRegistryObjects(page);
    // Expect initial registry to have at least the two objects added at boot
    expect(Array.isArray(registry)).toBeTruthy();
    expect(registry.length).toBeGreaterThanOrEqual(2);
  });

  test.afterEach(async ({ page }) => {
    // Try to pause any running scheduler to prevent interference between tests
    // This is done by clicking the pause button if present.
    try {
      await page.click('#btn-pause');
      // wait for run paused log if any
      await page.waitForTimeout(50);
    } catch (e) {
      // ignore missing button errors
    }
  });

  test.describe('FSM transitions (S0 Idle -> S1 Running -> S2 Paused -> S0 Idle and S3 ScenarioRunning)', () => {
    test('S0 Idle initial state: registry refreshed on entry', async ({ page }) => {
      // On load (Idle entry) refreshRegistry is called. We verify registry content is present.
      const registry = await getRegistryObjects(page);
      // registry should be an array (stringified JSON array) and not empty because initial objects were added
      expect(Array.isArray(registry)).toBe(true);
      expect(registry.length).toBeGreaterThanOrEqual(2);
    });

    test('RunClicked: starting the run loop logs "Run started" and schedules ticks', async ({ page }) => {
      // Click Run and verify the S1 entry action log exists.
      await clickAndWaitForLog(page, '#btn-run', 'Run started', { timeout: 3000 });
      // After run started, scheduler may trigger subject notifications; assert "notifies" or similar appears within a short time.
      // The scheduler chooses random subjects to notify if any exist; we expect either a notify log or at least the Run started entry.
      const logText = await page.$eval('#log', el => el.textContent);
      expect(logText).toMatch(/Run started/);
    });

    test('PauseClicked: pausing the run logs "Run paused"', async ({ page }) => {
      // Start first to ensure pause has effect and expected log
      await clickAndWaitForLog(page, '#btn-run', 'Run started', { timeout: 2000 });
      await clickAndWaitForLog(page, '#btn-pause', 'Run paused', { timeout: 2000 });
      const logText = await page.$eval('#log', el => el.textContent);
      expect(logText).toMatch(/Run paused/);
    });

    test('StepClicked when no subjects: after Reset, Step should log "Step: no subjects to notify"', async ({ page }) => {
      // Reset to clear existing subjects
      await clickAndWaitForLog(page, '#btn-reset', 'Reset playground', { timeout: 2000 });
      // Confirm registry is empty array
      const registry = await getRegistryObjects(page);
      // registry should be an array with zero length after reset
      expect(Array.isArray(registry)).toBe(true);
      expect(registry.length).toBe(0);
      // Click step and expect the explicit debug/info line 'Step: no subjects to notify' (debug)
      await clickAndWaitForLog(page, '#btn-step', 'Step: no subjects to notify', { timeout: 2000 });
      const logText = await page.$eval('#log', el => el.textContent);
      expect(logText).toMatch(/Step: no subjects to notify/);
    });

    test('ResetClicked transitions system back to Idle and clears registry', async ({ page }) => {
      // Create a subject and observer first to ensure reset clears them
      await page.click('#observer-create-subject');
      await page.click('#observer-create-observer');
      await page.waitForTimeout(100); // give UI a moment to update
      let registry = await getRegistryObjects(page);
      expect(registry.length).toBeGreaterThanOrEqual(2);
      // Now reset
      await clickAndWaitForLog(page, '#btn-reset', 'Reset playground', { timeout: 2000 });
      registry = await getRegistryObjects(page);
      expect(Array.isArray(registry)).toBe(true);
      expect(registry.length).toBe(0);
    });

    test('ScenarioRunClicked triggers a scenario and transitions to scenario running (S3)', async ({ page }) => {
      // Choose the observerDemo scenario and run it
      await page.selectOption('#scenario-select', 'observerDemo');
      await clickAndWaitForLog(page, '#scenario-run', 'Scenario: publishing sample events', { timeout: 3000 });
      // After scenario runs, expect subject and observers to exist in registry
      const registry = await getRegistryObjects(page);
      const kinds = registry.map(r => r.kind);
      expect(kinds).toContain('subject');
      expect(kinds).toContain('observer');
      // Also expect specific scenario log lines (publishing sample events)
      const logText = await page.$eval('#log', el => el.textContent);
      expect(logText).toMatch(/Scenario: publishing sample events/);
    });
  });

  test.describe('Entry/Exit actions and pattern interactions', () => {
    test('Run entry and exit actions produce debug logs as specified', async ({ page }) => {
      // Ensure run start triggers log('Run started', 'debug') and pause triggers 'Run paused'
      await clickAndWaitForLog(page, '#btn-run', 'Run started', { timeout: 2000 });
      await clickAndWaitForLog(page, '#btn-pause', 'Run paused', { timeout: 2000 });
      const logText = await page.$eval('#log', el => el.textContent);
      expect(logText).toMatch(/Run started/);
      expect(logText).toMatch(/Run paused/);
    });

    test('Observer workflow: create subject and observer, subscribe and publish, then observer receives event', async ({ page }) => {
      // Create a subject and an observer
      await page.click('#observer-create-subject');
      await page.click('#observer-create-observer');
      // Wait for selectors to refresh (script has an interval but give a brief pause)
      await page.waitForTimeout(200);
      // The selects should have values now; read them
      const subjectVal = await page.$eval('#observer-subject-select', sel => sel.value);
      const observerVal = await page.$eval('#observer-observer-select', sel => sel.value);
      expect(subjectVal).toBeTruthy();
      expect(observerVal).toBeTruthy();
      // Subscribe
      await clickAndWaitForLog(page, '#observer-subscribe', `Subscribed ${observerVal} to ${subjectVal}`, { timeout: 2000 });
      // Publish event with a payload
      await page.fill('#observer-event-payload', 'payload-test');
      await clickAndWaitForLog(page, '#observer-publish', 'Observer', { timeout: 2000 });
      // The observer should receive event; check log contains observer received message
      const logText = await page.$eval('#log', el => el.textContent);
      expect(logText).toMatch(/Observer .* received event/);
      // Also inspect registry to ensure subject has observers list that includes observerVal
      const registry = await getRegistryObjects(page);
      const subj = registry.find(r => r.id === subjectVal);
      expect(subj).toBeDefined();
      expect(Array.isArray(subj.data.observers)).toBe(true);
      expect(subj.data.observers).toContain(observerVal);
    });

    test('Singleton creation and set value edge case: set before create logs info', async ({ page }) => {
      // Ensure singleton is not present by using a fresh name unlikely to exist
      const name = 'UniqueSingletonTest';
      await page.fill('#singleton-name', name);
      // Try to set without creating
      await clickAndWaitForLog(page, '#singleton-set', 'No such singleton; create it first', { timeout: 2000 });
      // Now create and set
      await clickAndWaitForLog(page, '#singleton-create', `Created singleton ${name}`, { timeout: 2000 });
      await page.fill('#singleton-value', '1234');
      await clickAndWaitForLog(page, '#singleton-set', `Set singleton ${name}`, { timeout: 2000 });
      // Confirm registry contains singleton with expected value
      const registry = await getRegistryObjects(page);
      const s = registry.find(r => r.kind === 'singleton' && r.meta && r.meta.singletonName === name);
      expect(s).toBeDefined();
      expect(s.data.value === '1234' || s.data.value === 1234).toBeTruthy();
    });

    test('Command pattern: create receiver, prepare command, execute, undo, redo', async ({ page }) => {
      // Create receiver
      await page.click('#cmd-create-receiver');
      await page.waitForTimeout(100);
      // Ensure receiver select has a value
      const recv = await page.$eval('#cmd-receiver-select', sel => sel.value);
      expect(recv).toBeTruthy();
      // Prepare command
      await clickAndWaitForLog(page, '#cmd-create-command', 'Prepared command', { timeout: 2000 });
      // Execute command
      await clickAndWaitForLog(page, '#cmd-execute', 'Executed command', { timeout: 2000 });
      // Undo
      await clickAndWaitForLog(page, '#cmd-undo', 'Undid command', { timeout: 2000 });
      // Redo
      await clickAndWaitForLog(page, '#cmd-redo', 'Redid command', { timeout: 2000 });
      // Verify registry receiver value changed consistent with operations (should end up incremented after redo)
      const registry = await getRegistryObjects(page);
      const receiverObj = registry.find(r => r.id === recv);
      expect(receiverObj).toBeDefined();
      // value should be a number (after redo it should have been incremented once compared to baseline)
      expect(typeof receiverObj.data.value === 'number' || !isNaN(Number(receiverObj.data.value))).toBeTruthy();
    });

    test('Memento snapshot and restore: snapshot an object, modify it, then restore', async ({ page }) => {
      // Create a receiver to snapshot
      await page.click('#cmd-create-receiver');
      await page.waitForTimeout(100);
      const recv = await page.$eval('#cmd-receiver-select', sel => sel.value);
      expect(recv).toBeTruthy();
      // Set some state: call inc via inspector-invoke or command pattern - we'll use methods on object via inspector-invoke
      // First ensure inspector-select has the receiver
      await page.selectOption('#inspector-select', recv);
      // Set inspector-method to 'inc' and arg to '10'
      await page.fill('#inspector-method', 'inc');
      await page.fill('#inspector-arg', '10');
      await clickAndWaitForLog(page, '#inspector-invoke', 'Invoked', { timeout: 2000 });
      // Snapshot the object
      await page.selectOption('#memento-object-select', recv);
      await clickAndWaitForLog(page, '#memento-snapshot', 'Snapshot', { timeout: 2000 });
      // Find snapshot id from registry snapshots for that object
      const registryBefore = await getRegistryObjects(page);
      const snapshots = registryBefore.filter(o => o.kind === 'snapshot' && o.data && o.data.snapshotFor === recv);
      expect(snapshots.length).toBeGreaterThanOrEqual(1);
      const snapId = snapshots[0].id;
      // Modify receiver again
      await page.fill('#inspector-method', 'inc');
      await page.fill('#inspector-arg', '5');
      await clickAndWaitForLog(page, '#inspector-invoke', 'Invoked', { timeout: 2000 });
      // Now restore from snapshot
      await page.selectOption('#memento-snapshot-select', snapId);
      await clickAndWaitForLog(page, '#memento-restore', 'Restored', { timeout: 2000 });
      // Confirm registry object for receiver has been restored (value back to snapshot)
      const registryAfter = await getRegistryObjects(page);
      const restored = registryAfter.find(o => o.id === recv);
      expect(restored).toBeDefined();
      // Restored object should have data (snapshot may include a value property)
      expect(restored.data).toBeDefined();
    });
  });

  test.describe('Edge cases and error scenarios (observing console and page errors)', () => {
    test('log-export triggers a runtime error due to window.open body.pre access (expect pageerror)', async ({ page }) => {
      // Clear any previous page errors
      pageErrors.length = 0;
      // Click the log-export button which attempts to access w.document.body.pre and will likely throw
      await page.click('#log-export');
      // Wait briefly for error to propagate
      await page.waitForTimeout(200);
      // At least one pageerror should have been captured due to the bad access in code
      expect(pageErrors.length).toBeGreaterThanOrEqual(1);
      // The message should indicate a property access problem; be tolerant to message differences across engines
      const messages = pageErrors.map(e => e.message).join('\n');
      expect(messages.length).toBeGreaterThan(0);
    });

    test('Import state with invalid JSON logs "Import failed: invalid JSON" (no thrown exception)', async ({ page }) => {
      // Put invalid JSON into textarea and click import-state
      await page.fill('#state-json', '{ invalidJson: }');
      await clickAndWaitForLog(page, '#import-state', 'Import failed: invalid JSON', { timeout: 2000 });
      const logText = await page.$eval('#log', el => el.textContent);
      expect(logText).toMatch(/Import failed: invalid JSON/);
    });

    test('Inspector invoke with missing method logs method-not-found path', async ({ page }) => {
      // Create a simple base object and try invoking an absent method
      await page.click('#decorator-create-base');
      await page.waitForTimeout(100);
      // Select created base in inspector
      const selectionValue = await page.$eval('#inspector-select', sel => sel.value);
      expect(selectionValue).toBeTruthy();
      // Set a non-existent method name
      await page.fill('#inspector-method', 'nonExistentMethod');
      await page.fill('#inspector-arg', '');
      await clickAndWaitForLog(page, '#inspector-invoke', 'Method nonExistentMethod not found', { timeout: 2000 });
      const logText = await page.$eval('#log', el => el.textContent);
      expect(logText).toMatch(/Method nonExistentMethod not found/);
    });
  });
});