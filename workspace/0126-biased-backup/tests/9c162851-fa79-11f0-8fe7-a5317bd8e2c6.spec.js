import { test, expect } from '@playwright/test';

// Test suite for SDLC Interactive Lab (Application ID: 9c162851-fa79-11f0-8fe7-a5317bd8e2c6)
// The page is served at:
// http://127.0.0.1:5500/workspace/0126-biased/html/9c162851-fa79-11f0-8fe7-a5317bd8e2c6.html
//
// Notes:
// - Tests exercise the FSM states and transitions described in the spec:
//   S0_Idle -> S1_ProjectInitialized -> S2_TaskCreated -> S3_TaskSelected -> S4_TaskDetailOpened
//   -> S5_AutoRunStarted -> S6_AutoRunPaused
// - We observe the page log (#log), DOM state changes, and exposed window.SDLC.state where appropriate.
// - Dialogs (alert/prompt/confirm) used by the app are handled via Playwright's dialog handlers.
// - We also capture console and pageerror events and assert no uncaught page errors occurred during tests.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c162851-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('SDLC Interactive Lab - FSM transitions and behaviors', () => {
  // Per-test captured diagnostics
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for diagnostics
    page.on('console', msg => {
      // Collect console text and type
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait briefly for initialization log to appear (init() runs on load)
    await page.waitForSelector('#log');
    // ensure the app has run initProject (log contains 'Project initialized')
    await page.waitForFunction(() => {
      const el = document.getElementById('log');
      return el && /Project initialized/i.test(el.textContent || '');
    });
  });

  test.afterEach(async ({ page }) => {
    // Ensure no uncaught page errors happened during the test run
    expect(pageErrors.length, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test('S0_Idle -> S1_ProjectInitialized on Initialize button click', async ({ page }) => {
    // This test validates the InitializeProject event and the project initialization entry actions.
    // It checks that initProject() logs the expected project initialization message and that project inputs reflect state.

    // Prepare: read current project name and process model
    const projNameBefore = await page.$eval('#proj-name', el => el.value);
    const modelBefore = await page.$eval('#process-model', el => el.value);

    // Click the Initialize button to trigger initProject explicitly
    const initBtn = await page.waitForSelector('#init-proj');
    await initBtn.click();

    // Expect the log to contain the initialization message with project name and model
    await page.waitForFunction((name, model) => {
      const log = document.getElementById('log');
      return log && log.textContent.includes(`Project initialized: ${name} [${model}]`);
    }, projNameBefore, modelBefore);

    // Verify sim-day was reset to 0 (entry action resets day)
    const day = await page.$eval('#sim-day', el => el.textContent);
    expect(Number(day)).toBe(0);

    // Verify run-toggle text reset to 'Start Auto-Run'
    const runToggleText = await page.$eval('#run-toggle', el => el.textContent);
    expect(runToggleText).toBe('Start Auto-Run');

    // Also verify the project name and process model inputs reflect state
    const projName = await page.$eval('#proj-name', el => el.value);
    const processModel = await page.$eval('#process-model', el => el.value);
    expect(projName).toBe(projNameBefore);
    expect(processModel).toBe(modelBefore);
  });

  test('S1_ProjectInitialized -> S2_TaskCreated via Create Task form', async ({ page }) => {
    // This test validates creating a task from the form triggers createTaskFromForm()
    // and results in a .task element and a log entry. It asserts the created message content.

    // Fill new task fields
    await page.fill('#new-title', 'Task Title');
    await page.selectOption('#new-type', 'feature');
    await page.fill('#new-est', '4');

    // Ensure the start-stage select has options (populated by rebuildBoard)
    await page.waitForSelector('#start-stage option');

    // Click Create Task button
    await page.click('#create-task');

    // Wait for a .task element to appear
    const taskEl = await page.waitForSelector('.task', { timeout: 3000 });
    expect(taskEl).toBeTruthy();

    // Read the task id from the DOM (meta area contains #<id>)
    const metaText = await taskEl.$eval('.meta', el => el.textContent);
    // meta contains '#T1' or similar; extract the id
    const idMatch = metaText.match(/#(T\d+)/);
    expect(idMatch, 'Task id should be present in meta').toBeTruthy();
    const createdId = idMatch[1];

    // Assert the log contains a Created task message mentioning the created id and title/type
    await page.waitForFunction((id, title, type) => {
      const log = document.getElementById('log');
      return log && log.textContent.includes(`Created task ${id}: ${title} [${type}]`);
    }, createdId, 'Task Title', 'feature');

    // Verify selected-id remains 'none' (no automatic select on create)
    const selected = await page.$eval('#selected-id', el => el.textContent.trim());
    // The app sets selected-id to 'none' if no selection
    expect(selected === 'none' || selected === '').toBeTruthy();
  });

  test('S2_TaskCreated -> S3_TaskSelected -> S4_TaskDetailOpened on task click and open-detail', async ({ page }) => {
    // This test selects a created task, verifies selection state, then opens the detail view,
    // confirming #selected-id updated and #detail-form is visible with task details populated.

    // Create a new task via the form to ensure a fresh task exists
    await page.fill('#new-title', 'Selectable Task');
    await page.selectOption('#new-type', 'feature');
    await page.fill('#new-est', '2');
    await page.click('#create-task');

    // Wait for the new .task element and click it to select
    const task = await page.waitForSelector('.task >> text=Selectable Task', { timeout: 3000 });
    await task.click();

    // After clicking, selectTask calls openDetail(), so detail form should be visible.
    // Confirm selected-id updated to the new id
    const selectedId = await page.$eval('#selected-id', el => el.textContent.trim());
    expect(selectedId).not.toBe('none');
    expect(selectedId.length).toBeGreaterThan(0);

    // The detail form should be shown (not have 'hidden' class)
    const detailFormHidden = await page.$eval('#detail-form', el => el.classList.contains('hidden'));
    expect(detailFormHidden).toBe(false);

    // Confirm detail title and id displayed match selected task
    const detailTitle = await page.$eval('#detail-title', el => el.textContent.trim());
    const detailId = await page.$eval('#detail-id', el => el.textContent.trim());
    expect(detailTitle).toContain('Selectable Task');
    expect(detailId).toBe(selectedId);

    // Also assert the detail-stage select has a value matching the task stage
    const detailStageValue = await page.$eval('#detail-stage', el => el.value);
    expect(detailStageValue.length).toBeGreaterThan(0);
  });

  test('Open detail with no selection produces alert (edge case)', async ({ page }) => {
    // This test validates edge-case behavior: clicking "Open Details" with no selection should trigger an alert.
    // We handle the dialog and assert its message.

    // Ensure no selection
    await page.evaluate(() => { window.SDLC.state.selectedTask = null; document.getElementById('selected-id').textContent = 'none'; });

    // Setup dialog handler to capture alert message
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Click the Open Details button
    await page.click('#open-detail');

    // Wait for the dialog handler to have been called
    await page.waitForTimeout(200); // small pause to ensure dialog handler ran

    expect(dialogMessage, 'Expected alert about no task selected').toBeTruthy();
    expect(dialogMessage).toMatch(/No task selected/i);
  });

  test('S4_TaskDetailOpened -> S5_AutoRunStarted -> S6_AutoRunPaused via run-toggle and pause', async ({ page }) => {
    // This test ensures that starting auto-run changes UI and state accordingly and that pausing returns state.
    // It creates a task, selects it, opens detail, starts auto-run, then pauses and asserts state transitions/logs.

    // Create and select a task
    await page.fill('#new-title', 'AutoRun Task');
    await page.selectOption('#new-type', 'feature');
    await page.fill('#new-est', '1');
    await page.click('#create-task');

    const task = await page.waitForSelector('.task >> text=AutoRun Task');
    await task.click(); // this also opens detail

    // Ensure detail form visible
    await expect(page.locator('#detail-form')).toBeVisible();

    // Start auto-run by clicking run-toggle
    await page.click('#run-toggle');

    // Assert run-toggle text changed to 'Stop Auto-Run'
    await page.waitForFunction(() => document.getElementById('run-toggle').textContent.includes('Stop Auto-Run'));
    const runToggleText = await page.$eval('#run-toggle', el => el.textContent);
    expect(runToggleText).toBe('Stop Auto-Run');

    // The log should contain "Auto-run started"
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && /Auto-run started/i.test(log.textContent || '');
    });

    // Also verify window.SDLC.state.running is true
    const runningState = await page.evaluate(() => window.SDLC && window.SDLC.state ? window.SDLC.state.running : false);
    expect(runningState).toBe(true);

    // Now pause via the Pause button
    await page.click('#pause');

    // run-toggle text should now show 'Start Auto-Run'
    await page.waitForFunction(() => document.getElementById('run-toggle').textContent.includes('Start Auto-Run'));
    const runToggleAfter = await page.$eval('#run-toggle', el => el.textContent);
    expect(runToggleAfter).toBe('Start Auto-Run');

    // Log should contain 'Auto-run paused'
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && /Auto-run paused/i.test(log.textContent || '');
    });

    // Verify running flag false
    const runningAfter = await page.evaluate(() => window.SDLC && window.SDLC.state ? window.SDLC.state.running : true);
    expect(runningAfter).toBe(false);
  });

  test('Edge case: injectChangeRequest with no candidates triggers alert', async ({ page }) => {
    // This tests the inject change request behavior when there are no tasks in Done/Deploy/Production.
    // We expect an alert to say 'No candidates to send back'.

    // Ensure there are tasks but none in Done-like stages (create a fresh task in Backlog)
    await page.fill('#new-title', 'ChangeCandidateTask');
    await page.selectOption('#new-type', 'feature');
    await page.fill('#new-est', '2');
    await page.click('#create-task');

    // Make sure no tasks are in 'Done' or deploy-like stages by checking their stages are not deploy
    const tasksStages = await page.$$eval('.task .meta', metas => metas.map(m => m.textContent));
    // Not asserting content, just proceed to call injectChangeRequest which should detect no candidates and alert
    let dialogMsg = null;
    page.once('dialog', async dialog => {
      dialogMsg = dialog.message();
      await dialog.accept();
    });

    // Click Inject Change Request
    await page.click('#inject-change');

    // Small wait to let dialog be processed
    await page.waitForTimeout(200);
    expect(dialogMsg).toBeTruthy();
    expect(dialogMsg.toLowerCase()).toMatch(/no candidates/i);
  });

  test('Add dependency edge case: prompt a non-existent id -> alert "No such task id"', async ({ page }) => {
    // This test selects an existing task, then triggers Add Dependency action which prompts for an id.
    // It supplies a non-existent id via the prompt and expects an alert 'No such task id'.

    // Create and select a task
    await page.fill('#new-title', 'DepBaseTask');
    await page.selectOption('#new-type', 'feature');
    await page.fill('#new-est', '2');
    await page.click('#create-task');
    const task = await page.waitForSelector('.task >> text=DepBaseTask');
    await task.click();

    // Wait until detail form visible
    await expect(page.locator('#detail-form')).toBeVisible();

    // Prepare prompt response and subsequent alert
    // First the prompt to enter dependency id -> we provide a fake id 'T9999'
    page.once('dialog', async dialog => {
      // This will be the prompt for dependency id
      if (dialog.type() === 'prompt') {
        await dialog.accept('T9999');
      } else {
        await dialog.accept();
      }
    });

    // The code will then check existence and call alert('No such task id')
    let alertMsg = null;
    page.once('dialog', async dialog => {
      // This should be the alert about missing id
      alertMsg = dialog.message();
      await dialog.accept();
    });

    // Click the "Add Dependency (selected)" button
    await page.click('#create-dep');

    // Wait a little for dialogs to process
    await page.waitForTimeout(200);
    expect(alertMsg).toBeTruthy();
    expect(alertMsg.toLowerCase()).toMatch(/no such task id/i);
  });

  test('Script runner: create via script and run fast-run (advance) commands', async ({ page }) => {
    // This test validates the minimal DSL: create task via "create ..." and run fast forward using "run N"
    // It asserts tasks are created and the simulation day advances accordingly.

    // Clear the script area and enter commands:
    await page.fill('#script', 'create Scripted Task | feature | 1\nrun 2');

    // Click run-script
    await page.click('#run-script');

    // Assert that 'Scripted Task' exists on the board
    await page.waitForSelector('.task >> text=Scripted Task');

    // After "run 2" was executed, sim-day should have advanced by at least 2
    const dayVal = await page.$eval('#sim-day', el => Number(el.textContent));
    expect(dayVal).toBeGreaterThanOrEqual(2);

    // Confirm the log includes the script messages
    const logText = await page.$eval('#log', el => el.textContent);
    expect(logText).toContain('Scripted Task');
    expect(logText).toContain('run');
  });
});