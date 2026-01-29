import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1215ad50-fa7a-11f0-acf9-69409043402d.html';

// Page Object to encapsulate interactions with the Semaphore app
class SemaphorePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getText(selector) {
    return (await this.page.locator(selector).innerText()).trim();
  }

  async getValue(selector) {
    return await this.page.locator(selector).inputValue();
  }

  // Create semaphore with given initial count. Returns the dialog message if one appeared (e.g., validation).
  async createSemaphore(initialCount) {
    await this.page.fill('#initialCount', String(initialCount));
    // Wait for possible dialog - set up waitForEvent
    const dialogPromise = this.page.waitForEvent('dialog').catch(() => null);
    await this.page.click('#createSemaphore');
    const dialog = await dialogPromise;
    if (dialog) {
      const msg = dialog.message();
      await dialog.accept();
      return msg;
    }
    return null;
  }

  // Create process with given name. Returns dialog message if one appeared (e.g., missing semaphore or empty name).
  async createProcess(name) {
    await this.page.fill('#procName', name);
    const dialogPromise = this.page.waitForEvent('dialog').catch(() => null);
    await this.page.click('#createProcess');
    const dialog = await dialogPromise;
    if (dialog) {
      const msg = dialog.message();
      await dialog.accept();
      return msg;
    }
    return null;
  }

  // Select a process by its displayed name (prefix match). Returns true if selection successful.
  async selectProcessByName(name) {
    // Wait for options to exist
    await this.page.waitForTimeout(50); // small wait to ensure options updated
    const options = this.page.locator('#procSelect option');
    const count = await options.count();
    for (let i = 0; i < count; i++) {
      const text = (await options.nth(i).textContent()) || '';
      if (text.includes(name)) {
        const value = await options.nth(i).getAttribute('value');
        if (value) {
          await this.page.selectOption('#procSelect', value);
          await this.page.waitForTimeout(20);
          return true;
        }
      }
    }
    return false;
  }

  async clickWait(expectDialog = false) {
    const dialogPromise = expectDialog ? this.page.waitForEvent('dialog').catch(() => null) : null;
    await this.page.click('#procWait');
    if (dialogPromise) {
      const dialog = await dialogPromise;
      if (dialog) {
        const msg = dialog.message();
        await dialog.accept();
        return msg;
      }
      return null;
    }
    return null;
  }

  async clickSignal() {
    await this.page.click('#procSignal');
  }

  async clickBlock() {
    await this.page.click('#procBlock');
  }

  async clickUnblock() {
    await this.page.click('#procUnblock');
  }

  // Kill process: a confirm appears. This returns the confirm message.
  async clickKill(accept = true) {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.page.click('#procKill');
    const dialog = await dialogPromise;
    const msg = dialog.message();
    if (accept) await dialog.accept();
    else await dialog.dismiss();
    return msg;
  }

  async toggleAutoUnblock(enable) {
    const current = await this.page.isChecked('#autoUnblock');
    if (current !== enable) {
      await this.page.click('#autoUnblock');
    }
  }

  async setThrottle(ms) {
    await this.page.fill('#throttle', String(ms));
    // throttle change triggers a 'change' event and logs; we can trigger blur to ensure change event handled
    await this.page.locator('#throttle').press('Tab');
  }

  // Reset all: confirm appears. Returns confirm message.
  async clickResetAll(accept = true) {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.page.click('#resetAll');
    const dialog = await dialogPromise;
    const msg = dialog.message();
    if (accept) await dialog.accept();
    else await dialog.dismiss();
    return msg;
  }

  async getLogText() {
    return await this.page.locator('#log').inputValue();
  }

  async getSemaphoreStatus() {
    return await this.getText('#semaphoreStatus');
  }

  async getPermitsAvailable() {
    return (await this.getText('#permitsAvailable')).trim();
  }

  async getWaitingQueue() {
    return (await this.getText('#waitingQueue')).trim();
  }

  async getProcessList() {
    return (await this.getText('#processList')).trim();
  }

  // Helper to get option text for a process name (or null)
  async getProcSelectOptionText(name) {
    const options = this.page.locator('#procSelect option');
    const count = await options.count();
    for (let i = 0; i < count; i++) {
      const text = (await options.nth(i).textContent()) || '';
      if (text.includes(name)) return text.trim();
    }
    return null;
  }
}

// Tests grouped according to FSM states and transitions
test.describe('Semaphore Interactive Exploration - FSM validation', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let semaphorePage;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Collect page errors and console.error messages
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    semaphorePage = new SemaphorePage(page);
    await semaphorePage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Ensure no uncaught page errors or console.error happened during test runs
    // We assert this at the end of each test explicitly in each test too, but keep an extra sanity here.
    // (We don't forcibly fail here — individual tests have their own asserts)
  });

  test('Initial Idle state: UI renders without semaphore (S0_Idle)', async ({ page }) => {
    // Validate initial semaphore status and UI disabled elements as per entry actions of S0_Idle
    expect(await semaphorePage.getSemaphoreStatus()).toBe('Semaphore not created yet.');
    expect(await semaphorePage.getPermitsAvailable()).toBe('-');
    expect(await semaphorePage.getWaitingQueue()).toBe('empty');
    expect(await semaphorePage.getProcessList()).toBe('(none)');

    // Process controls section should be disabled initially
    const processControlsDisabled = await page.locator('#processControls').isDisabled();
    const advancedControlsDisabled = await page.locator('#advancedControls').isDisabled();
    expect(processControlsDisabled).toBeTruthy();
    expect(advancedControlsDisabled).toBeTruthy();

    // Log should contain welcome message inserted on load
    const log = await semaphorePage.getLogText();
    expect(log).toContain('Welcome! Configure semaphore');

    // No runtime JS errors expected on initial render
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Create Semaphore transition (S0_Idle -> S1_SemaphoreCreated)', async ({ page }) => {
    // Set initial count to 1 to make later states easier to assert
    const dialogMsg = await semaphorePage.createSemaphore(1);
    // Should not trigger an alert dialog for valid input
    expect(dialogMsg).toBeNull();

    // Verify semaphore created status updated and permits available reflect initial count
    expect(await semaphorePage.getSemaphoreStatus()).toContain('Semaphore created with 1 permit(s) available.');
    expect(await semaphorePage.getPermitsAvailable()).toBe('1');

    // Process and advanced controls should now be enabled
    expect(await page.locator('#processControls').isDisabled()).toBeFalsy();
    expect(await page.locator('#advancedControls').isDisabled()).toBeFalsy();

    // Validate log contains creation entry
    const log = await semaphorePage.getLogText();
    expect(log).toMatch(/Semaphore created with initial count 1\./);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Create Process transition (S1_SemaphoreCreated -> S2_ProcessCreated) and edge cases', async ({ page }) => {
    // Attempt to create a process without a name -> expect alert
    // First ensure semaphore exists
    await semaphorePage.createSemaphore(1);

    // Attempt empty name
    const emptyNameDialog = await semaphorePage.createProcess('');
    expect(emptyNameDialog).toBe('Process name cannot be empty.');

    // Create a valid process P1
    const dialogMsg = await semaphorePage.createProcess('P1');
    expect(dialogMsg).toBeNull();

    // Verify process list reflects creation
    expect(await semaphorePage.getProcessList()).toContain('P1[ready]');
    const optionText = await semaphorePage.getProcSelectOptionText('P1');
    expect(optionText).toBeTruthy();
    expect(optionText).toContain('P1 [ready]');

    // Attempt to create a duplicate (same name) -> should alert preventing duplicates
    const dupDialog = await semaphorePage.createProcess('P1');
    expect(dupDialog).toBe('Process with this name already exists.');

    // Validate the creation log entry exists
    const log = await semaphorePage.getLogText();
    expect(log).toMatch(/Created process "P1"\./);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Wait (P) operation: acquire permit when available', async ({ page }) => {
    // Create semaphore with 1 permit and create process P1
    await semaphorePage.createSemaphore(1);
    await semaphorePage.createProcess('P1');

    // Select P1 and perform Wait
    const selected = await semaphorePage.selectProcessByName('P1');
    expect(selected).toBeTruthy();
    await semaphorePage.clickWait();

    // After acquiring, permitsAvailable should be 0
    expect(await semaphorePage.getPermitsAvailable()).toBe('0');

    // The process should remain in ready state (acquired permit)
    expect(await semaphorePage.getProcessList()).toContain('P1[ready]');

    // Log should include acquired permit message
    const log = await semaphorePage.getLogText();
    expect(log).toMatch(/acquired a permit/);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Wait (P) operation: when permits exhausted -> process goes to waiting queue (S3_ProcessWaiting)', async ({ page }) => {
    // Create semaphore with 1 permit
    await semaphorePage.createSemaphore(1);

    // Create P1 and P2
    await semaphorePage.createProcess('P1');
    await semaphorePage.createProcess('P2');

    // P1 acquires first permit
    await semaphorePage.selectProcessByName('P1');
    await semaphorePage.clickWait();
    expect(await semaphorePage.getPermitsAvailable()).toBe('0');

    // P2 attempts to wait -> should become waiting
    await semaphorePage.selectProcessByName('P2');
    await semaphorePage.clickWait();

    // waitingQueue should contain P2
    expect(await semaphorePage.getWaitingQueue()).toContain('P2');

    // Process list should show P2 state as waiting
    expect(await semaphorePage.getProcessList()).toContain('P2[waiting]');

    // Log should mention waiting
    const log = await semaphorePage.getLogText();
    expect(log).toMatch(/is waiting \(blocked\) for a permit/);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Signal (V) operation behavior without and with auto-unblock (S3 -> S2 via ProcSignal)', async ({ page }) => {
    // Set up: semaphore with 1, create P1 and P2; P1 acquires permit; P2 waits.
    await semaphorePage.createSemaphore(1);
    await semaphorePage.createProcess('P1');
    await semaphorePage.createProcess('P2');

    await semaphorePage.selectProcessByName('P1');
    await semaphorePage.clickWait();
    expect(await semaphorePage.getPermitsAvailable()).toBe('0');

    await semaphorePage.selectProcessByName('P2');
    await semaphorePage.clickWait();
    expect(await semaphorePage.getWaitingQueue()).toContain('P2');

    // 1) Signal by selecting P1 (ready) while auto-unblock disabled
    await semaphorePage.selectProcessByName('P1');
    await semaphorePage.clickSignal();

    // Permits should increase (to 1). Waiting queue should remain (auto-unblock is disabled by default).
    const permitsAfterSignal = await semaphorePage.getPermitsAvailable();
    expect(permitsAfterSignal).toBe('1');
    expect(await semaphorePage.getWaitingQueue()).toContain('P2');

    // Log should mention released a permit
    let log = await semaphorePage.getLogText();
    expect(log).toMatch(/released a permit/);

    // 2) Enable auto-unblock and signal again; this should auto-unblock P2 (S3 -> S2)
    await semaphorePage.toggleAutoUnblock(true);

    // Confirm the auto-unblock log entry was added
    log = await semaphorePage.getLogText();
    expect(log).toMatch(/Auto-unblock waiting processes when permits released: Enabled/);

    // Signal again by selecting a ready process (P1)
    await semaphorePage.selectProcessByName('P1');
    await semaphorePage.clickSignal();

    // After auto-unblock, waiting queue should be empty and P2 should be ready
    expect(await semaphorePage.getWaitingQueue()).toBe('empty');
    const proc2OptionText = await semaphorePage.getProcSelectOptionText('P2');
    expect(proc2OptionText).toBeTruthy();
    expect(proc2OptionText).toContain('P2 [ready]');

    // Log should include auto-unblocking entry
    log = await semaphorePage.getLogText();
    expect(log).toMatch(/Auto-unblocking waiting process "P2"\./);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Blocking (S4_ProcessBlocked) and Unblocking (S4 -> S2 ProcUnblock) flow', async ({ page }) => {
    // Create semaphore and process P3
    await semaphorePage.createSemaphore(1);
    await semaphorePage.createProcess('P3');

    // Block P3
    await semaphorePage.selectProcessByName('P3');
    await semaphorePage.clickBlock();

    // Process should show blocked state
    expect(await semaphorePage.getProcessList()).toContain('P3[blocked]');
    // Log should contain blocked message
    let log = await semaphorePage.getLogText();
    expect(log).toMatch(/has been BLOCKED/);

    // Attempting to Wait should not work since button is disabled; attempt clicking Wait should show no dialog,
    // but state should remain blocked. We assert blocked remains.
    await semaphorePage.clickWait(); // button disabled; no effect expected
    expect(await semaphorePage.getProcessList()).toContain('P3[blocked]');

    // Unblock using UI
    await semaphorePage.clickUnblock();

    // Now process should be ready
    expect(await semaphorePage.getProcessList()).toContain('P3[ready]');
    log = await semaphorePage.getLogText();
    expect(log).toMatch(/has been UNBLOCKED/);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Kill Process (S5_ProcessTerminated) and Reset All (S5 -> S0 via ResetAll)', async ({ page }) => {
    // Create semaphore and two processes
    await semaphorePage.createSemaphore(2);
    await semaphorePage.createProcess('ToKill');
    await semaphorePage.createProcess('KeepAlive');

    // Kill 'ToKill' and accept the confirmation dialog
    await semaphorePage.selectProcessByName('ToKill');
    const killConfirmMsg = await semaphorePage.clickKill(true);
    // Confirm message should match pattern
    expect(killConfirmMsg).toContain('Are you sure you want to kill process "ToKill"');

    // After kill, process should be removed from list and log contains KILLED
    const processListAfterKill = await semaphorePage.getProcessList();
    expect(processListAfterKill).not.toContain('ToKill');
    const log = await semaphorePage.getLogText();
    expect(log).toMatch(/has been KILLED \(terminated\)\./);

    // Now test Reset All: clicking Reset triggers confirm; accept it
    const resetConfirmMsg = await semaphorePage.clickResetAll(true);
    expect(resetConfirmMsg).toContain('Reset everything including semaphore and all processes?');

    // After reset, semaphore should be null -> UI shows not created
    expect(await semaphorePage.getSemaphoreStatus()).toBe('Semaphore not created yet.');
    expect(await semaphorePage.getProcessList()).toBe('(none)');

    // The log area should be cleared as per implementation
    const postResetLog = await semaphorePage.getLogText();
    expect(postResetLog).toBe('');

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge cases: invalid initial count, signaling while waiting, and throttle logging', async ({ page }) => {
    // 1) Invalid initial count (e.g., -1) should trigger alert with specific message
    const invalidDialog = await semaphorePage.createSemaphore(-1);
    expect(invalidDialog).toBe('Initial count must be between 0 and 10');

    // 2) Setup for signaling while waiting - create semaphore with 1, create P1 & P2, make P2 wait
    await semaphorePage.createSemaphore(1);
    await semaphorePage.createProcess('A');
    await semaphorePage.createProcess('B');

    await semaphorePage.selectProcessByName('A');
    await semaphorePage.clickWait(); // A acquires permit

    await semaphorePage.selectProcessByName('B');
    await semaphorePage.clickWait(); // B goes to waiting

    // Now select B (waiting) and attempt to signal -> semaphore.signal should log that waiting proc cannot signal
    await semaphorePage.selectProcessByName('B');
    await semaphorePage.clickSignal();

    const log = await semaphorePage.getLogText();
    expect(log).toMatch(/is waiting and cannot signal until it acquires a permit/);

    // 3) Throttle change logs and affects operations (we won't wait for timing effects heavily, just assert the setting log)
    await semaphorePage.setThrottle(100);
    const throttleLog = await semaphorePage.getLogText();
    expect(throttleLog).toMatch(/Throttle delay per operation set to 100 ms\./);

    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});