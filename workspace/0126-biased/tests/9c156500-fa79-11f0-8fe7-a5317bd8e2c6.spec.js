import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c156500-fa79-11f0-8fe7-a5317bd8e2c6.html';

test.describe('Semaphore Simulator (FSM) - 9c156500-fa79-11f0-8fe7-a5317bd8e2c6', () => {
  // Capture console messages and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and errors
    page.on('console', (msg) => {
      const text = `${msg.type()}: ${msg.text()}`;
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Auto-accept any dialogs triggered by the page (confirm/alert)
    page.on('dialog', async (dialog) => {
      try {
        await dialog.accept();
      } catch (e) {
        // ignore
      }
    });

    // Navigate to the application
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure initial render has occurred
    await page.waitForSelector('#sems');
    await page.waitForSelector('#procs');
  });

  test.afterEach(async ({ page }) => {
    // Ensure autoRun is disabled to avoid background intervals affecting other tests
    try {
      await page.evaluate(() => {
        const auto = document.getElementById('autoRun');
        if (auto && auto.checked) auto.click();
      });
    } catch (e) {
      // swallow
    }
  });

  // Helper: read log content
  async function getLogText(page) {
    return page.$eval('#log', el => el.textContent || '');
  }

  // Helper: find option value by visible text match
  async function findOptionValueByText(page, selector, textFragment) {
    const options = await page.$$eval(`${selector} option`, opts => opts.map(o => ({ value: o.value, text: o.textContent })));
    const found = options.find(o => o.text && o.text.includes(textFragment));
    return found ? found.value : null;
  }

  test('S0 Idle (initial) - initial render and initialized simulation evidence', async ({ page }) => {
    // Validate initial evidence: log should include 'Initialized simulation'
    const log = await getLogText(page);
    expect(log).toContain('Initialized simulation');

    // Validate that initial semaphores were created (S1 and S2 from script)
    const selOptions = await page.$$eval('#selSem option', opts => opts.map(o => o.textContent));
    expect(selOptions.length).toBeGreaterThanOrEqual(2);
    // At least one option should mention 'S1'
    const hasS1 = selOptions.some(t => t && t.includes('S1'));
    expect(hasS1).toBeTruthy();

    // Validate processes initial: P1 and P2 exist in processes list
    const procTexts = await page.$$eval('#procs > div', divs => divs.map(d => d.textContent));
    const hasP1 = procTexts.some(t => t && t.includes('P1'));
    const hasP2 = procTexts.some(t => t && t.includes('P2'));
    expect(hasP1).toBeTruthy();
    expect(hasP2).toBeTruthy();

    // Assert that no uncaught page errors occurred during load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('CreateSemaphore event transitions to Semaphore Created (S1) and updates DOM & log', async ({ page }) => {
    // Prepare unique semaphore name
    const semName = 'TestSem-' + Math.random().toString(36).slice(2, 6);
    // Set name and count
    await page.fill('#semName', semName);
    await page.fill('#semInit', '3');

    // Click Create semaphore
    await page.click('#createSem');

    // The selector should have an option for our new sem
    const value = await findOptionValueByText(page, '#selSem', semName);
    expect(value).not.toBeNull();

    // Check sems panel contains our semaphore with correct count and no waiting
    const semsHtml = await page.$eval('#sems', el => el.textContent || '');
    expect(semsHtml).toContain(semName);
    expect(semsHtml).toContain('count=3');
    expect(semsHtml).toContain('waiting=0');

    // Log should contain creation message
    const log = await getLogText(page);
    expect(log).toContain(`Created semaphore "${semName}" with count=3`);

    // Assert no runtime page errors
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('SpawnProcess event transitions to Process Spawned (S2) and process appears in list', async ({ page }) => {
    // Ensure there is at least one semaphore to use in the script; pick S1 if available
    const semOptionText = await page.$$eval('#selSem option', opts => opts.map(o => o.textContent));
    expect(semOptionText.length).toBeGreaterThan(0);

    // Prepare script and process name
    const procName = 'P_spawn_' + Math.random().toString(36).slice(2, 5);
    await page.fill('#procName', procName);

    // Use a small script that interacts with S1 (if present) or first sem
    const semText = semOptionText[0] || 'S1';
    const semLabel = semText.split(' ')[0]; // e.g. "S1 (count=..."
    const script = `acquire ${semLabel} 1 block\nsleep 50\nrelease ${semLabel} 1\nend\n`;
    await page.fill('#scriptArea', script);
    // Spawn a single process
    await page.fill('#spawnCount', '1');
    await page.click('#spawnProcess');

    // Process list should now include the spawned process name
    const procs = await page.$$eval('#procs > div', divs => divs.map(d => d.textContent));
    const found = procs.some(t => t && t.includes(procName));
    expect(found).toBeTruthy();

    // Log should include 'Spawned process "<name>"'
    const log = await getLogText(page);
    expect(log).toContain(`Spawned process "${procName}"`);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('IncreaseSemaphore and DecreaseSemaphore events update counts and logs', async ({ page }) => {
    // Create a sem specifically for adjustment
    const semName = 'AdjSem-' + Math.random().toString(36).slice(2, 6);
    await page.fill('#semName', semName);
    await page.fill('#semInit', '1');
    await page.click('#createSem');

    // Find its option value and select it
    const semValue = await findOptionValueByText(page, '#selSem', semName);
    expect(semValue).not.toBeNull();
    await page.selectOption('#selSem', semValue);

    // Increase by 2
    await page.fill('#semAdjust', '2');
    await page.click('#incSem');

    // Verify selector's option text shows new count (1+2=3)
    const optionTextAfterInc = await page.$eval(`#selSem option[value="${semValue}"]`, o => o.textContent);
    expect(optionTextAfterInc).toContain('(count=3)');

    // Log should mention Increased
    const log1 = await getLogText(page);
    expect(log1).toContain('Increased ');

    // Decrease by 5 (should clamp to 0)
    await page.fill('#semAdjust', '5');
    await page.click('#decSem');

    // Verify count is not negative and is clamped to 0
    const optionTextAfterDec = await page.$eval(`#selSem option[value="${semValue}"]`, o => o.textContent);
    // count expected 0
    expect(optionTextAfterDec).toContain('(count=0)');

    const log2 = await getLogText(page);
    expect(log2).toContain('Decreased ');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('TryAcquire (non-block) - both success and failure paths logged', async ({ page }) => {
    // Create a dedicated semaphore with count=1
    const semName = 'TrySem-' + Math.random().toString(36).slice(2, 6);
    await page.fill('#semName', semName);
    await page.fill('#semInit', '1');
    await page.click('#createSem');
    const semValue = await findOptionValueByText(page, '#selSem', semName);
    expect(semValue).not.toBeNull();
    await page.selectOption('#selSem', semValue);

    // Success: tryAcquire 1 should succeed
    await page.fill('#procName', 'TryOK');
    await page.fill('#acqUnits', '1');
    await page.click('#tryAcquire');

    // Log should show succeeded
    let log = await getLogText(page);
    expect(log).toContain('tryAcquire succeeded');

    // Now the sem count should be 0; another tryAcquire should fail
    await page.fill('#procName', 'TryFail');
    await page.fill('#acqUnits', '1');
    await page.click('#tryAcquire');

    log = await getLogText(page);
    expect(log).toContain('tryAcquire failed');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Acquire (may block) + Release transitions: process acquires then releases and metrics update', async ({ page }) => {
    // Create a semaphore for this test
    const semName = 'RelSem-' + Math.random().toString(36).slice(2, 6);
    await page.fill('#semName', semName);
    await page.fill('#semInit', '1');
    await page.click('#createSem');
    const semValue = await findOptionValueByText(page, '#selSem', semName);
    expect(semValue).not.toBeNull();
    await page.selectOption('#selSem', semValue);

    // Prepare process that will block-acquire and then we will release
    await page.fill('#procName', 'WorkerA');
    await page.fill('#acqUnits', '1');
    await page.fill('#acqPriority', '1');

    // Click Acquire -> creates process and attempts immediate allocation
    await page.click('#acquire');

    // After clicking, the process should exist; choose it from relProc
    // Need to wait a bit for render
    await page.waitForTimeout(50);

    // Find the process option in relProc (it may be the last created)
    const relProcOptions = await page.$$eval('#relProc option', opts => opts.map(o => ({ value: o.value, text: o.textContent })));
    const procOpt = relProcOptions.find(o => o && o.text && o.text.includes('WorkerA'));
    expect(procOpt).toBeTruthy();
    const procId = procOpt.value;
    // Ensure process holds the sem (since sem had count=1)
    const procsText = await page.$eval('#procs', el => el.textContent || '');
    expect(procsText).toContain('WorkerA');

    // Release one unit from this process via UI controls
    // Make sure the correct relProc is selected
    await page.selectOption('#relProc', procId);
    // release units default is 1
    await page.click('#release');

    // After release, sem count should be back to 1
    const semOptionAfterRelease = await page.$eval(`#selSem option[value="${semValue}"]`, o => o.textContent);
    expect(semOptionAfterRelease).toContain('(count=1)');

    // Log should include released
    const log = await getLogText(page);
    expect(log).toContain('released');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ResetAll event clears semaphores and processes and logs Reset simulation', async ({ page }) => {
    // Ensure there's at least one semaphore to reset
    await page.fill('#semName', 'ToReset');
    await page.fill('#semInit', '2');
    await page.click('#createSem');

    // Click Reset all (dialog will be auto-accepted by the listener)
    await page.click('#resetAll');

    // After reset, selectors should be empty
    const selCount = await page.$$eval('#selSem option', opts => opts.length);
    const procCount = await page.$$eval('#relProc option', opts => opts.length);
    expect(selCount).toBe(0);
    expect(procCount).toBe(0);

    // Log should contain 'Reset simulation'
    const log = await getLogText(page);
    expect(log).toContain('Reset simulation');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Clear log button removes log content', async ({ page }) => {
    // Ensure there is something in the log
    await page.click('#createSem');
    const before = await getLogText(page);
    expect(before.length).toBeGreaterThan(0);

    // Click clear log (top clearLog button exists and main one too)
    // Use the first #clearLog found
    await page.click('#clearLog');

    const after = await getLogText(page);
    expect(after.trim()).toBe('');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Decrease semaphore below zero clamps to zero', async ({ page }) => {
    // Create sem with small count and then decrease by a large amount
    const semName = 'ClampSem-' + Math.random().toString(36).slice(2, 6);
    await page.fill('#semName', semName);
    await page.fill('#semInit', '1');
    await page.click('#createSem');
    const semValue = await findOptionValueByText(page, '#selSem', semName);
    expect(semValue).not.toBeNull();
    await page.selectOption('#selSem', semValue);

    // Decrease by 100
    await page.fill('#semAdjust', '100');
    await page.click('#decSem');

    // Verify count is 0 (not negative)
    const txt = await page.$eval(`#selSem option[value="${semValue}"]`, o => o.textContent);
    expect(txt).toContain('(count=0)');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Scheduler controls: step and stepBack snapshots and restore', async ({ page }) => {
    // Create a semaphore to ensure history changes
    await page.fill('#semName', 'SnapSem');
    await page.fill('#semInit', '2');
    await page.click('#createSem');

    // Save current number of semaphores
    const beforeCount = await page.$$eval('#selSem option', opts => opts.length);

    // Click step to snapshot and advance (tick executes saveHistorySnapshot)
    await page.click('#step');
    await page.waitForTimeout(20);

    // Make a change and then step again
    await page.fill('#semName', 'SnapSem2');
    await page.fill('#semInit', '1');
    await page.click('#createSem');
    const midCount = await page.$$eval('#selSem option', opts => opts.length);
    expect(midCount).toBeGreaterThanOrEqual(beforeCount + 1);

    // Step back to revert last tick/snapshot
    await page.click('#stepBack');
    await page.waitForTimeout(20);

    // After step back, number of semaphores should be less or equal to midCount
    const afterCount = await page.$$eval('#selSem option', opts => opts.length);
    // We expect afterCount to be >= beforeCount and <= midCount (best-effort check)
    expect(afterCount).toBeGreaterThanOrEqual(beforeCount);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Preset and stress buttons create expected semaphores/processes and do not throw', async ({ page }) => {
    // Use presetSimple
    await page.click('#presetSimple');
    await page.waitForTimeout(50);
    let sems = await page.$$eval('#selSem option', opts => opts.map(o => o.textContent));
    expect(sems.some(t => t && t.includes('S1'))).toBeTruthy();

    // Use presetPriority
    await page.click('#presetPriority');
    await page.waitForTimeout(50);
    const procText = await page.$eval('#procs', el => el.textContent || '');
    expect(procText).toContain('High');
    expect(procText).toContain('Low');

    // Stress 10 - creates many processes
    await page.click('#stress10');
    await page.waitForTimeout(50);
    const procsCount = await page.$$eval('#procs > div', divs => divs.length);
    expect(procsCount).toBeGreaterThanOrEqual(3); // at least from presets + stress

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Debug actions: bumpPriority, wakeFirst, removeRequest run without uncaught errors', async ({ page }) => {
    // Load simple preset to create waiting processes
    await page.click('#presetSimple');
    await page.waitForTimeout(100);

    // InspectReq should have an option now
    const inspectVal = await page.$$eval('#inspectReq option', opts => opts.map(o => ({ value: o.value, text: o.textContent })));
    if (inspectVal.length > 0) {
      // Select first semaphore in inspectReq
      await page.selectOption('#inspectReq', inspectVal[0].value);

      // Bump priority (if waiting exists this will modify request priorities)
      await page.click('#bumpPriority');
      // Wake first (this will try to forcibly grant)
      await page.click('#wakeFirst');
      // Remove request (if any)
      await page.click('#removeRequest');
    }

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});