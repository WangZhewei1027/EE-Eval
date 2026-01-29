import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12170ce3-fa7a-11f0-acf9-69409043402d.html';

test.describe('Runtime Environment Interactive Explorer - FSM and UI tests', () => {
  let consoleMessages;
  let consoleErrors;
  let pageErrors;
  let dialogs;

  // Setup a fresh page for each test and attach listeners to capture runtime console messages, errors and dialogs
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    page.on('dialog', async dialog => {
      // Record dialog details and auto-accept so tests proceed.
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      // Accept with no prompt text changes (most dialogs are informational or confirms).
      try {
        await dialog.accept();
      } catch (e) {
        // swallow accept errors but record them in consoleErrors
        consoleErrors.push(`Dialog accept error: ${String(e)}`);
      }
    });

    await page.goto(APP_URL);
    // Ensure the page is fully initialized by waiting for a known element
    await page.waitForSelector('#createProc');
  });

  test.afterEach(async () => {
    // Basic sanity: ensure no page errors (ReferenceError/SyntaxError/TypeError) appeared unless a test invoked one intentionally.
    expect(pageErrors.length, 'No uncaught page errors expected').toBe(0);
    // Ensure no console.error messages were emitted during test unless specifically expected by a test
    expect(consoleErrors.length, 'No console.error messages expected').toBe(0);
  });

  test('Initial load: log initializes global environment variables', async ({ page }) => {
    // Validate the app logged initialization of global environment variables
    const logText = await page.locator('#log').textContent();
    expect(logText).toContain('Initialized global environment variables: PATH, HOME, LANG');

    // There should be a pre-filled global environment; confirm button states reflect no processes
    expect(await page.locator('#selectProc option').count()).toBe(0);
    expect(await page.locator('#startProc').isDisabled()).toBeTruthy();
  });

  test('Create process -> state becomes "created" and appears in process list', async ({ page }) => {
    // Create a new process with a unique name
    const pname = 'testProc_create';
    await page.fill('#procName', pname);
    await page.click('#createProc');

    // After creation select should have one option representing created process
    const options = page.locator('#selectProc option');
    await expect(options).toHaveCount(1);
    const optionText = await options.nth(0).textContent();
    expect(optionText).toContain(`"${pname}"`);
    expect(optionText).toContain('State:created');

    // Log should contain creation entry
    const log = await page.locator('#log').textContent();
    expect(log).toContain(`Created process`);

    // Start button should be enabled for created state
    expect(await page.locator('#startProc').isDisabled()).toBeFalsy();

    // No unexpected dialogs were shown (createProc uses alerts for error cases only)
    expect(dialogs.length).toBe(0);
  });

  test('Start process -> transitions to running, UI controls update', async ({ page }) => {
    const pname = 'testProc_start';
    await page.fill('#procName', pname);
    await page.click('#createProc');

    // Select the newly created process
    await page.selectOption('#selectProc', { label: /testProc_start/ });

    // Click start -> should change to running
    await page.click('#startProc');

    // Option text should indicate running state
    const optionText = await page.locator('#selectProc option').nth(0).textContent();
    expect(optionText).toContain('State:running');

    // Pause should be enabled, start should now be disabled
    expect(await page.locator('#pauseProc').isDisabled()).toBeFalsy();
    expect(await page.locator('#startProc').isDisabled()).toBeTruthy();

    // Log must have the state change message
    const log = await page.locator('#log').textContent();
    expect(log).toMatch(/changed state: created.*→ running/);
  });

  test('Pause process -> transitions to paused and updates controls', async ({ page }) => {
    const pname = 'testProc_pause';
    await page.fill('#procName', pname);
    await page.click('#createProc');
    await page.selectOption('#selectProc', { label: /testProc_pause/ });
    await page.click('#startProc');

    // Now pause
    await page.click('#pauseProc');

    // Option shows paused
    const optionText = await page.locator('#selectProc option').nth(0).textContent();
    expect(optionText).toContain('State:paused');

    // After pausing, start should be enabled (paused → start allowed), pause disabled
    expect(await page.locator('#startProc').isDisabled()).toBeFalsy();
    expect(await page.locator('#pauseProc').isDisabled()).toBeTruthy();

    // Log should reflect paused transition
    const log = await page.locator('#log').textContent();
    expect(log).toMatch(/changed state: running.*→ paused/);
  });

  test('Kill process -> transitions to killed from running (and disabled further state changes)', async ({ page }) => {
    const pname = 'testProc_kill';
    await page.fill('#procName', pname);
    await page.click('#createProc');
    await page.selectOption('#selectProc', { label: /testProc_kill/ });
    await page.click('#startProc');

    // Kill the running process
    await page.click('#killProc');

    // Option shows killed
    const optionText = await page.locator('#selectProc option').nth(0).textContent();
    expect(optionText).toContain('State:killed');

    // Attempting to start/ pause should now be disabled as process is killed
    expect(await page.locator('#startProc').isDisabled()).toBeTruthy();
    expect(await page.locator('#pauseProc').isDisabled()).toBeTruthy();

    // Log should note the state change to killed
    const log = await page.locator('#log').textContent();
    expect(log).toMatch(/changed state: .*→ killed/);
  });

  test('Invoke syscall "exit" -> process transitions to exited', async ({ page }) => {
    const pname = 'testProc_exit';
    await page.fill('#procName', pname);
    await page.click('#createProc');
    await page.selectOption('#selectProc', { label: /testProc_exit/ });
    await page.click('#startProc');

    // choose syscall exit
    await page.selectOption('#syscallSelect', 'exit');

    // Provide no args; exit doesn't require args
    await page.click('#invokeSyscall');

    // The process should now be in exited state
    const optionText = await page.locator('#selectProc option').nth(0).textContent();
    expect(optionText).toContain('State:exited');

    // Log should include the syscall invocation and exit result
    const log = await page.locator('#log').textContent();
    expect(log).toMatch(/syscall: exit\(/);
    expect(log).toMatch(/has exited/);
  });

  test('Select process change does not implicitly start the process (FSM transition expectation check)', async ({ page }) => {
    // Create a process but do not start it
    const pname = 'testProc_selectChange';
    await page.fill('#procName', pname);
    await page.click('#createProc');

    // Programmatic selection change - ensure selecting does not change state to running in implementation
    // Select the process (it is already selected by default with one option, but ensure change event is triggered)
    await page.selectOption('#selectProc', { label: /testProc_selectChange/ });

    // Implementation does not change state to 'running' on selection; verify it stays 'created'
    const optionText = await page.locator('#selectProc option').nth(0).textContent();
    expect(optionText).toContain('State:created');
  });

  test('Environment variables: set, list (alert), unset and edge cases', async ({ page }) => {
    // Set a new global environment variable
    await page.fill('#envKey', 'TEST_ENV');
    await page.fill('#envValue', '12345');
    await page.click('#setEnv');

    // Log should mention the set operation
    let log = await page.locator('#log').textContent();
    expect(log).toContain('Global environment variable set: TEST_ENV = 12345');

    // List environment variables triggers an alert dialog with contents
    // Clear previously recorded dialogs
    dialogs.length = 0;
    await page.click('#listEnv');
    // Wait briefly for dialog to be recorded
    await page.waitForTimeout(50);
    expect(dialogs.length).toBeGreaterThan(0);
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.message).toContain('Global Environment Variables');

    // Unset the variable
    await page.fill('#envKey', 'TEST_ENV');
    await page.click('#unsetEnv');
    log = await page.locator('#log').textContent();
    expect(log).toContain('Global environment variable unset: TEST_ENV');

    // Attempt to unset a non-existent variable should log a message that it does not exist
    await page.fill('#envKey', 'NONEXISTENT');
    await page.click('#unsetEnv');
    log = await page.locator('#log').textContent();
    expect(log).toMatch(/does not exist/);
  });

  test('Memory allocation workflow: errors when not running, allocate when running, inspect and free', async ({ page }) => {
    const pname = 'testProc_mem';
    await page.fill('#procName', pname);
    await page.click('#createProc');

    // Attempt to allocate memory when not running -> should trigger an alert
    dialogs.length = 0;
    await page.selectOption('#selectProc', { label: /testProc_mem/ });
    await page.click('#allocMem');
    // Allow dialog to be recorded
    await page.waitForTimeout(50);
    expect(dialogs.length).toBeGreaterThan(0);
    expect(dialogs[dialogs.length - 1].message).toContain('Process must be running to allocate memory');

    // Start the process and allocate memory properly
    await page.click('#startProc');
    await page.fill('#memSize', '16');
    await page.click('#allocMem');

    // Now memBlocks select should be enabled and contain one block
    expect(await page.locator('#memBlocks').isDisabled()).toBeFalsy();
    const blocksCount = await page.locator('#memBlocks option').count();
    expect(blocksCount).toBeGreaterThanOrEqual(1);

    // Inspect the first memory block -> memBlockInfo should populate
    await page.selectOption('#memBlocks', { index: 0 });
    await page.click('#inspectMemBlock');
    // memBlockInfo pre should contain details
    const memInfo = await page.locator('#memBlockInfo').textContent();
    expect(memInfo).toContain('Memory Block #');
    expect(memInfo).toContain('Size:');

    // Free memory: clicking free prompts a confirm which our dialog handler will accept
    dialogs.length = 0;
    await page.click('#freeMem');
    // Confirm was accepted automatically; check logs show freed memory
    await page.waitForTimeout(50);
    const log = await page.locator('#log').textContent();
    expect(log).toMatch(/Freed all memory for process/);

    // After freeing, memBlocks should be disabled again
    expect(await page.locator('#memBlocks').isDisabled()).toBeTruthy();
  });

  test('Edge cases: creating process with empty or duplicate name triggers alert', async ({ page }) => {
    // Empty name -> alert
    dialogs.length = 0;
    await page.fill('#procName', '');
    await page.click('#createProc');
    await page.waitForTimeout(50);
    expect(dialogs.length).toBeGreaterThan(0);
    expect(dialogs[dialogs.length - 1].message).toContain('Enter a non-empty process name');

    // Create a valid process and then try duplicate name
    const pname = 'testProc_dup';
    await page.fill('#procName', pname);
    await page.click('#createProc');

    // Attempt to create again with same name
    dialogs.length = 0;
    await page.fill('#procName', pname);
    await page.click('#createProc');
    await page.waitForTimeout(50);
    // Duplicate creation should produce an alert about existing name
    expect(dialogs.length).toBeGreaterThan(0);
    const msg = dialogs[dialogs.length - 1].message;
    expect(msg).toContain('Process name already exists');
  });

  test('Invoke syscalls with incorrect arguments cause alerts; valid syscalls produce log entries', async ({ page }) => {
    const pname = 'testProc_syscall';
    await page.fill('#procName', pname);
    await page.click('#createProc');
    await page.selectOption('#selectProc', { label: /testProc_syscall/ });

    // Attempt to invoke syscall while not running -> alert about selecting/ running
    dialogs.length = 0;
    await page.click('#invokeSyscall');
    await page.waitForTimeout(50);
    // Because invokeSyscallBtn is disabled when no process selected, but we did select;
    // However implementation alerts if process not running when invoking syscall.
    expect(dialogs.length).toBeGreaterThan(0);
    expect(dialogs[dialogs.length - 1].message).toMatch(/Process must be running to invoke syscalls/);

    // Start process and try read with missing args -> should alert
    await page.click('#startProc');
    await page.selectOption('#syscallSelect', 'read');
    dialogs.length = 0;
    await page.fill('#syscallArgs', '');
    await page.click('#invokeSyscall');
    await page.waitForTimeout(50);
    expect(dialogs.length).toBeGreaterThan(0);
    expect(dialogs[dialogs.length - 1].message).toContain('read(filename) requires at least 1 argument');

    // Now supply args for read and confirm success log entry
    await page.fill('#syscallArgs', 'somefile.txt');
    await page.click('#invokeSyscall');
    await page.waitForTimeout(50);
    const log = await page.locator('#log').textContent();
    expect(log).toMatch(/syscall: read\(somefile.txt\)/);
  });

  test('Show runtime environment info and clear log behavior', async ({ page }) => {
    // Show Runtime Environment Info -> alert with summary
    dialogs.length = 0;
    await page.click('#showREInfo');
    await page.waitForTimeout(50);
    expect(dialogs.length).toBeGreaterThan(0);
    expect(dialogs[dialogs.length - 1].message).toContain('Runtime Environment Info');

    // Clear log -> log becomes empty
    await page.click('#clearLog');
    const logText = await page.locator('#log').textContent();
    expect(logText.trim()).toBe('');
  });
});