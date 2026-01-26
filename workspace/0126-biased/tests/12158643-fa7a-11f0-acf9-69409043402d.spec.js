import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12158643-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the Mutex Interactive Explorer
class MutexApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      mutexNameCreate: '#mutexNameCreate',
      btnCreateMutex: '#btnCreateMutex',
      threadNameCreate: '#threadNameCreate',
      btnCreateThread: '#btnCreateThread',
      selectThread: '#selectThread',
      selectMutex: '#selectMutex',
      actionSelect: '#actionSelect',
      timeoutInput: '#timeoutInput',
      priorityInput: '#priorityInput',
      btnPerformAction: '#btnPerformAction',
      btnShowStatus: '#btnShowStatus',
      statusOutput: '#statusOutput',
      btnReset: '#btnReset',
      btnAdvanceTime: '#btnAdvanceTime',
      customTimeAdvance: '#customTimeAdvance',
      btnAdvanceCustomTimeSubmit: '#btnAdvanceCustomTimeSubmit',
      btnClearLog: '#btnClearLog',
      log: '#log'
    };
  }

  async fill(selector, value) {
    await this.page.fill(selector, String(value));
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async getLogText() {
    return (await this.page.locator(this.selectors.log).innerText()).trim();
  }

  async waitForLogContains(text, timeout = 2000) {
    await expect(this.page.locator(this.selectors.log)).toContainText(text, { timeout });
  }

  async createMutex(name) {
    await this.fill(this.selectors.mutexNameCreate, name);
    await this.click(this.selectors.btnCreateMutex);
  }

  async createThread(name) {
    await this.fill(this.selectors.threadNameCreate, name);
    await this.click(this.selectors.btnCreateThread);
  }

  async selectThread(name) {
    await this.page.selectOption(this.selectors.selectThread, { value: name });
  }

  async selectMutex(name) {
    await this.page.selectOption(this.selectors.selectMutex, { value: name });
  }

  async setAction(actionValue) {
    await this.page.selectOption(this.selectors.actionSelect, { value: actionValue });
  }

  async setTimeout(ms) {
    await this.fill(this.selectors.timeoutInput, String(ms));
  }

  async setPriority(n) {
    await this.fill(this.selectors.priorityInput, String(n));
  }

  async performAction() {
    await this.click(this.selectors.btnPerformAction);
  }

  async showStatus() {
    await this.click(this.selectors.btnShowStatus);
    return await this.page.locator(this.selectors.statusOutput).innerText();
  }

  async clearLog() {
    await this.click(this.selectors.btnClearLog);
  }

  async advanceTime100() {
    await this.click(this.selectors.btnAdvanceTime);
  }

  async advanceCustomTime(ms) {
    await this.fill(this.selectors.customTimeAdvance, String(ms));
    await this.click(this.selectors.btnAdvanceCustomTimeSubmit);
  }

  async resetAll(acceptConfirm = true) {
    // The app calls window.confirm - we must handle dialog in the test.
    const promise = this.page.waitForEvent('dialog');
    await this.click(this.selectors.btnReset);
    const dialog = await promise;
    if (acceptConfirm) await dialog.accept();
    else await dialog.dismiss();
    // allow effects to take place
    await this.page.waitForTimeout(50);
  }

  async getStatusOutput() {
    return await this.page.locator(this.selectors.statusOutput).innerText();
  }
}

test.describe('Mutex Interactive Explorer - FSM and UI tests', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
    // Wait for seeded initial data log to appear to ensure page script executed
    await expect(page.locator('#log')).toContainText("Seeded initial mutex 'mutexA' and threads 'T1', 'T2', 'T3'.");
  });

  test.afterEach(async () => {
    // Sanity: ensure no unexpected page errors were thrown during the test
    // We assert that there were no uncaught JS errors (pageerror events).
    // If there are errors, include them in assertion message for debugging.
    expect(pageErrors.length, `Expected no uncaught page errors, but got: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
    // Also assert no console messages of type error were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `Expected no console errors/warnings, but got: ${consoleErrors.map(m => m.text).join('; ')}`).toBe(0);
  });

  test('Initial Idle state: page renders title and seeded data', async ({ page }) => {
    const app = new MutexApp(page);
    // Validate document title and heading
    await expect(page).toHaveTitle('Mutex Interactive Explorer');
    await expect(page.locator('h1')).toHaveText('Mutex Interactive Explorer');

    // The seeded initial data must be present in the log
    const logText = await app.getLogText();
    expect(logText).toContain("Seeded initial mutex 'mutexA' and threads 'T1', 'T2', 'T3'.");

    // The select elements must contain the seeded options
    const threadOptions = await page.locator('#selectThread option').allTextContents();
    expect(threadOptions.sort()).toEqual(['T1', 'T2', 'T3'].sort());

    const mutexOptions = await page.locator('#selectMutex option').allTextContents();
    expect(mutexOptions).toContain('mutexA');
  });

  test('Create Mutex and handle empty/duplicate names (CreateMutex event, S1_MutexCreated)', async ({ page }) => {
    const app = new MutexApp(page);

    // Successful creation of a new mutex
    await app.createMutex('myMutex');
    await app.waitForLogContains("Mutex 'myMutex' created.");
    // The select should now include 'myMutex'
    const mutexOptions = await page.locator('#selectMutex option').allTextContents();
    expect(mutexOptions).toContain('myMutex');

    // Attempt to create with empty name should trigger alert
    const dialogPromise1 = page.waitForEvent('dialog');
    await app.createMutex('   '); // blank after trim
    const dialog1 = await dialogPromise1;
    expect(dialog1.type()).toBe('alert');
    expect(dialog1.message()).toContain('Mutex name cannot be empty.');
    await dialog1.accept();

    // Attempt to create duplicate name should alert
    const dialogPromise2 = page.waitForEvent('dialog');
    await app.createMutex('myMutex');
    const dialog2 = await dialogPromise2;
    expect(dialog2.type()).toBe('alert');
    expect(dialog2.message()).toContain('Mutex with that name already exists.');
    await dialog2.accept();
  });

  test('Create Thread (CreateThread event, S2_ThreadCreated) and duplicate/empty validation', async ({ page }) => {
    const app = new MutexApp(page);

    // Create a new thread
    await app.createThread('worker1');
    await app.waitForLogContains("Thread 'worker1' created.");
    const threadOptions = await page.locator('#selectThread option').allTextContents();
    expect(threadOptions).toContain('worker1');

    // Empty thread name should alert
    const dialogPromise = page.waitForEvent('dialog');
    await app.createThread('   ');
    const dialog = await dialogPromise;
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('Thread name cannot be empty.');
    await dialog.accept();

    // Duplicate thread name should alert
    const dialogPromise2 = page.waitForEvent('dialog');
    await app.createThread('worker1');
    const dialog2 = await dialogPromise2;
    expect(dialog2.type()).toBe('alert');
    expect(dialog2.message()).toContain('Thread with that name already exists.');
    await dialog2.accept();
  });

  test('Perform lock/tryLock/unlock actions and queueing with priority (PerformAction event, S3_ActionPerformed)', async ({ page }) => {
    const app = new MutexApp(page);

    // Ensure selects contain seeded entries
    await app.selectThread('T1');
    await app.selectMutex('mutexA');

    // 1) T1 acquires mutexA immediately
    await app.setAction('lock');
    await app.setTimeout(0); // infinite wait semantics if needed
    await app.setPriority(0);
    await app.performAction();
    await app.waitForLogContains("Thread 'T1' acquired lock 'mutexA' immediately.");

    // Verify status shows T1 holding mutexA
    const status1 = await app.showStatus();
    expect(status1).toContain("Mutex 'mutexA':");
    expect(status1).toContain("Locked By: T1");

    // 2) T2 tries tryLock on locked mutexA -> should fail immediately
    await app.selectThread('T2');
    await app.setAction('tryLock');
    await app.setPriority(0);
    await app.performAction();
    await app.waitForLogContains("Thread 'T2' tryLock on 'mutexA' failed immediately (locked by 'T1').");

    // 3) T2 and T3 request lock and get queued with different priorities
    await app.selectThread('T2');
    await app.setAction('lock');
    await app.setPriority(1);
    await app.setTimeout(0); // infinite wait to be queued
    await app.performAction();
    await app.waitForLogContains("Thread 'T2' blocked on mutex 'mutexA' indefinitely (no timeout). Added to wait queue.");

    await app.selectThread('T3');
    await app.setAction('lock');
    await app.setPriority(5);
    await app.setTimeout(0);
    await app.performAction();
    await app.waitForLogContains("Thread 'T3' blocked on mutex 'mutexA' indefinitely (no timeout). Added to wait queue.");

    // 4) T1 unlocks -> T3 (higher priority) should be granted the lock from wait queue
    await app.selectThread('T1');
    await app.setAction('unlock');
    await app.performAction();
    await app.waitForLogContains("Thread 'T1' fully unlocked mutex 'mutexA'.");
    await app.waitForLogContains("Thread 'T3' acquired lock 'mutexA' from wait queue.");

    // Verify T3 holds the lock now
    const status2 = await app.showStatus();
    expect(status2).toContain("Locked By: T3");

    // 5) Attempt unlocking from a thread that does not hold the lock (T2 tries to unlock) -> error log expected
    await app.selectThread('T2');
    await app.setAction('unlock');
    await app.performAction();
    await app.waitForLogContains("Thread 'T2' cannot unlock 'mutexA' because it does not hold the lock.");
  });

  test('Timeout behavior: wait with timeout expires after advancing time (AdvanceCustomTime, AdvanceTime events)', async ({ page }) => {
    const app = new MutexApp(page);

    // Ensure mutexA is free first by unlocking if needed
    // For robustness, unlock by any holder if locked (attempt from T3 or T1)
    // We'll fetch status and if Locked By appears unlock with that thread
    const statusBefore = await app.getStatusOutput();
    let lockedByMatch = statusBefore.match(/Locked By: (\w+)/);
    if (lockedByMatch) {
      const holder = lockedByMatch[1];
      // Perform unlock via UI using the holder
      await app.selectThread(holder);
      await app.setAction('unlock');
      await app.performAction();
      // wait for unlock log
      await app.waitForLogContains(`fully unlocked mutex 'mutexA'`);
    }

    // T1 locks mutexA again
    await app.selectThread('T1');
    await app.setAction('lock');
    await app.setPriority(0);
    await app.setTimeout(0);
    await app.performAction();
    await app.waitForLogContains("Thread 'T1' acquired lock 'mutexA' immediately.");

    // T2 attempts lock with timeout 100ms -> gets queued
    await app.selectThread('T2');
    await app.setAction('lock');
    await app.setPriority(0);
    await app.setTimeout(100);
    await app.performAction();
    await app.waitForLogContains("Thread 'T2' blocked on mutex 'mutexA' with timeout 100 ms. Added to wait queue.");

    // Advance custom time by 150ms -> expect timeout expired log
    await app.advanceCustomTime(150);
    await app.waitForLogContains("Timeout expired: Thread 'T2' removed from wait queue on mutex 'mutexA'.");

    // T2 should now be running and not blocked; verify in status
    const statusAfter = await app.showStatus();
    expect(statusAfter).toContain("Thread 'T2':");
    expect(statusAfter).toContain("State: running");
    expect(statusAfter).toContain("Blocked on mutex: (none)");
  });

  test('Blocked threads cannot initiate locks / tryLock (edge case)', async ({ page }) => {
    const app = new MutexApp(page);

    // Ensure mutexA is free then have T1 lock it
    // Make T1 hold mutexA
    await app.selectThread('T1');
    await app.setAction('lock');
    await app.setTimeout(0);
    await app.performAction();
    await app.waitForLogContains("Thread 'T1' acquired lock 'mutexA' immediately.");

    // Block T2 on mutexA (infinite wait)
    await app.selectThread('T2');
    await app.setAction('lock');
    await app.setTimeout(0);
    await app.performAction();
    await app.waitForLogContains("Thread 'T2' blocked on mutex 'mutexA' indefinitely (no timeout). Added to wait queue.");

    // Now, while T2 is blocked, attempt to make T2 performTryLock on mutexA -> should log cannot perform tryLock
    await app.selectThread('T2');
    await app.setAction('tryLock');
    await app.performAction();
    await app.waitForLogContains("Thread 'T2' is currently blocked and cannot perform tryLock.");

    // Similarly attempt to performLock from T2 while blocked -> should log cannot initiate lock
    await app.selectThread('T2');
    await app.setAction('lock');
    await app.setTimeout(0);
    await app.performAction();
    await app.waitForLogContains("Thread 'T2' is blocked and cannot initiate lock.");
  });

  test('Show Current Status (ShowStatus event, S4_StatusShown) and Clear Log (ClearLog event, S5_LogCleared)', async ({ page }) => {
    const app = new MutexApp(page);

    // Click Show Status and inspect output contains sections
    const status = await app.showStatus();
    expect(status).toContain('Simulated Time:');
    expect(status).toContain('=== Mutexes ===');
    expect(status).toContain('=== Threads ===');

    // Clear log and verify it is empty
    await app.clearLog();
    const logAfterClear = await app.getLogText();
    expect(logAfterClear).toBe('');
  });

  test('Reset All control paths: dismiss and accept confirm (ResetAll event)', async ({ page }) => {
    const app = new MutexApp(page);

    // Create a temporary mutex and thread so we can observe reset behavior
    await app.createMutex('tempMutex');
    await app.waitForLogContains("Mutex 'tempMutex' created.");
    await app.createThread('tempThread');
    await app.waitForLogContains("Thread 'tempThread' created.");

    // Dismiss reset confirmation -> state should remain (not cleared)
    // The resetAll helper handles the dialog
    await app.resetAll(false); // dismiss
    // The temp entries should still exist in selects
    const mutexOptionsAfterDismiss = await page.locator('#selectMutex option').allTextContents();
    expect(mutexOptionsAfterDismiss).toContain('tempMutex');
    const threadOptionsAfterDismiss = await page.locator('#selectThread option').allTextContents();
    expect(threadOptionsAfterDismiss).toContain('tempThread');

    // Accept reset confirmation -> state should be cleared
    await app.resetAll(true); // accept
    // After reset, selects should contain only what seedInitialData would have created.
    // But seedInitialData is invoked only at init - reset cleared seeded too. So selects should be empty.
    const mutexOptionsAfterAccept = await page.locator('#selectMutex option').allTextContents();
    const threadOptionsAfterAccept = await page.locator('#selectThread option').allTextContents();
    expect(mutexOptionsAfterAccept.length).toBe(0);
    expect(threadOptionsAfterAccept.length).toBe(0);

    // status output and log should be cleared
    const statusOut = await app.getStatusOutput();
    expect(statusOut).toBe('');
    const logAfterReset = await app.getLogText();
    expect(logAfterReset).toBe('');
  });
});