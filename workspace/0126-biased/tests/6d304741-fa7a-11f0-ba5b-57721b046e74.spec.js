import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d304741-fa7a-11f0-ba5b-57721b046e74.html';

/**
 * Page object encapsulating interactions with the Mutex Interactive Demonstration page.
 */
class MutexPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.sharedSelector = '#sharedResource';
    this.threadsContainer = '#threads';
    this.addThreadBtn = 'button[onclick="addThread()"]';
    this.removeThreadBtn = 'button[onclick="removeThread()"]';
    this.startBtn = '#startBtn';
    this.stopBtn = '#stopBtn';
    this.stepBtn = '#stepBtn';
    this.speedInput = 'input[type="range"]';
  }

  // Basic navigation
  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initial UI to populate
    await this.page.waitForSelector(this.threadsContainer);
  }

  // Buttons
  async clickAddThread() {
    await this.page.click(this.addThreadBtn);
  }
  async clickRemoveThread() {
    await this.page.click(this.removeThreadBtn);
  }
  async clickStart() {
    await this.page.click(this.startBtn);
  }
  async clickStop() {
    await this.page.click(this.stopBtn);
  }
  async clickStep() {
    await this.page.click(this.stepBtn);
  }
  async setSpeed(value) {
    await this.page.fill(this.speedInput, String(value));
    // Trigger input event by dispatching input (some browsers may not trigger by fill)
    await this.page.$eval(this.speedInput, (el, v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
  }

  // Thread utilities
  async getThreadDivs() {
    // The threads container has a header <h3> then a series of divs for threads
    // Select direct child divs only: '#threads > div'
    return this.page.locator('#threads > div');
  }

  async countThreads() {
    return await this.getThreadDivs().count();
  }

  // Find thread div by thread id (visible in header "Thread {id} (state)")
  async getThreadDivById(threadId) {
    const divs = this.getThreadDivs();
    const count = await divs.count();
    for (let i = 0; i < count; i++) {
      const header = await divs.nth(i).locator('h4').innerText();
      if (header.includes(`Thread ${threadId} (`)) {
        return divs.nth(i);
      }
    }
    return null;
  }

  // Click specific operation button in a thread UI (Add Lock, Add Unlock, etc.)
  async clickThreadOperationButton(threadId, buttonText) {
    const threadDiv = await this.getThreadDivById(threadId);
    if (!threadDiv) throw new Error(`Thread ${threadId} not found`);
    await threadDiv.locator('button', { hasText: buttonText }).click();
  }

  async addOperation(threadId, op) {
    // Map op to button text used in UI
    const map = {
      lock: 'Add Lock',
      unlock: 'Add Unlock',
      read: 'Add Read',
      increment: 'Add Increment',
      decrement: 'Add Decrement'
    };
    if (!map[op]) throw new Error(`Unknown op: ${op}`);
    await this.clickThreadOperationButton(threadId, map[op]);
  }

  async clearThreadOperations(threadId) {
    const threadDiv = await this.getThreadDivById(threadId);
    if (!threadDiv) throw new Error(`Thread ${threadId} not found`);
    await threadDiv.locator('button', { hasText: 'Clear Operations' }).click();
  }

  async getSharedResourceInfo() {
    const text = await this.page.locator(this.sharedSelector).innerText();
    // Parse Value, Locked, Waiting Threads lines
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const info = {
      value: null,
      locked: null,
      owner: null,
      waitingThreads: []
    };
    for (const line of lines) {
      if (line.startsWith('Value:')) {
        const v = line.replace('Value:', '').trim();
        info.value = Number(v);
      } else if (line.startsWith('Locked:')) {
        const rest = line.replace('Locked:', '').trim();
        if (rest.startsWith('Yes')) {
          info.locked = true;
          const match = rest.match(/\(Thread\s+(\d+)\)/);
          info.owner = match ? Number(match[1]) : null;
        } else {
          info.locked = false;
          info.owner = null;
        }
      } else if (line.startsWith('Waiting Threads:')) {
        const rest = line.replace('Waiting Threads:', '').trim();
        if (rest === 'None' || rest === '') {
          info.waitingThreads = [];
        } else {
          info.waitingThreads = rest.split(',').map(s => Number(s.trim())).filter(n => !Number.isNaN(n));
        }
      }
    }
    return info;
  }

  async getThreadState(threadId) {
    const threadDiv = await this.getThreadDivById(threadId);
    if (!threadDiv) throw new Error(`Thread ${threadId} not found`);
    const header = await threadDiv.locator('h4').innerText();
    // header looks like: "Thread X (state)"
    const match = header.match(/Thread\s+(\d+)\s+\(([^)]+)\)/);
    if (!match) return { id: null, state: null };
    return { id: Number(match[1]), state: match[2] };
  }

  async getThreadOperations(threadId) {
    const threadDiv = await this.getThreadDivById(threadId);
    if (!threadDiv) throw new Error(`Thread ${threadId} not found`);
    const opsText = await threadDiv.locator('p').first().innerText();
    // "Operations: lock | increment" etc.
    if (!opsText.includes('Operations:')) return [];
    const opsPart = opsText.replace('Operations:', '').trim();
    if (!opsPart) return [];
    return opsPart.split('|').map(s => s.trim()).filter(Boolean);
  }

  async getThreadLogLines(threadId) {
    const threadDiv = await this.getThreadDivById(threadId);
    if (!threadDiv) throw new Error(`Thread ${threadId} not found`);
    // Last div contains logs with reverse order
    const logContainer = threadDiv.locator('div').last();
    const html = await logContainer.innerHTML();
    // Extract lines from innerHTML by stripping tags
    const temp = await this.page.evaluate((html) => {
      const container = document.createElement('div');
      container.innerHTML = html;
      return Array.from(container.querySelectorAll('div')).map(d => d.innerText);
    }, html);
    // The UI reverses logs when rendering; we keep the array as-is (most recent first)
    return temp;
  }
}

test.describe('Mutex Interactive Demonstration - FSM and UI tests', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test('Initialization: page loads with 2 initial threads and shared resource default state', async ({ page }) => {
    // Validate basic initial state of the application.
    const app = new MutexPage(page);
    await app.goto();

    // There should be two threads initialized by the page script
    const threadCount = await app.countThreads();
    expect(threadCount).toBe(2);

    // Shared resource should start at value 0 and unlocked
    const info = await app.getSharedResourceInfo();
    expect(info.value).toBe(0);
    expect(info.locked).toBe(false);
    expect(info.owner).toBeNull();
    expect(Array.isArray(info.waitingThreads)).toBe(true);
    expect(info.waitingThreads.length).toBe(0);

    // Ensure no uncaught page errors were raised during initialization
    expect(pageErrors.length).toBe(0);
  });

  test('Lock acquisition and waiting behavior: Add Lock to two threads and Step', async ({ page }) => {
    // This test validates:
    // - A thread acquiring the mutex (resource becomes Locked with owner)
    // - A second thread attempting to lock becomes Waiting and is added to waitingThreads
    const app = new MutexPage(page);
    await app.goto();

    // Identify initial thread IDs by reading headers
    // Expect threads with IDs 1 and 2 (page script adds two threads incrementally)
    const t1 = 1;
    const t2 = 2;

    // Add lock operation to both threads via UI buttons
    await app.addOperation(t1, 'lock');
    await app.addOperation(t2, 'lock');

    // Step once: thread 1 should acquire lock; thread 2 should become waiting
    await app.clickStep();

    // Validate shared resource locked and owned by thread 1
    const infoAfter = await app.getSharedResourceInfo();
    expect(infoAfter.locked).toBe(true);
    expect(infoAfter.owner).toBe(1);

    // Waiting threads should include thread 2
    expect(infoAfter.waitingThreads).toContain(2);

    // Thread states: t1 should still be 'ready' (it acquired lock), t2 should be 'waiting'
    const state1 = await app.getThreadState(t1);
    const state2 = await app.getThreadState(t2);
    expect(state1.state).toBe('ready');
    expect(state2.state).toBe('waiting');

    // Check that the logs show "Acquired mutex" for t1 and "Waiting for mutex" for t2
    const t1logs = await app.getThreadLogLines(t1);
    const t2logs = await app.getThreadLogLines(t2);
    // We expect at least one of the logs to include these phrases
    expect(t1logs.some(l => l.includes('Acquired mutex'))).toBe(true);
    expect(t2logs.some(l => l.includes('Waiting for mutex'))).toBe(true);

    // Ensure no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Increment and Decrement operations under mutex control and passing mutex', async ({ page }) => {
    // This test validates:
    // - Increment happens only when thread owns mutex
    // - Unlock passes mutex to waiting thread and it can then perform protected operations
    const app = new MutexPage(page);
    await app.goto();

    const t1 = 1;
    const t2 = 2;

    // Set up scenario: t1 lock, t1 increment, t1 unlock; t2 lock, t2 decrement
    await app.addOperation(t1, 'lock');
    await app.addOperation(t1, 'increment');
    await app.addOperation(t1, 'unlock');

    await app.addOperation(t2, 'lock');
    await app.addOperation(t2, 'decrement');
    // Ensure t2 has lock attempt so it will wait behind t1

    // Step enough times to allow t1 to acquire lock and increment, then unlock and pass to t2, then t2 decrement.
    // First step: t1 acquires lock, t2 becomes waiting
    await app.clickStep();

    let info = await app.getSharedResourceInfo();
    expect(info.locked).toBe(true);
    expect(info.owner).toBe(1);

    // Step second time: t1 should execute increment (value -> 1)
    await app.clickStep();
    info = await app.getSharedResourceInfo();
    expect(info.value).toBe(1);

    // Step third time: t1 should perform unlock and pass mutex to t2
    await app.clickStep();
    info = await app.getSharedResourceInfo();
    // After unlock, owner should be t2 (passed) and locked true
    expect(info.locked).toBe(true);
    expect(info.owner).toBe(2);

    // t2 state should now be 'ready' (the unlock handler sets it to ready)
    const state2 = await app.getThreadState(t2);
    expect(state2.state).toBe('ready');

    // Step to let t2 perform its decrement (it owns the mutex now)
    await app.clickStep();
    info = await app.getSharedResourceInfo();
    // Value should be decremented back to 0
    expect(info.value).toBe(0);

    // Validate logs for passed mutex and increment/decrement actions
    const t1logs = await app.getThreadLogLines(t1);
    const t2logs = await app.getThreadLogLines(t2);
    expect(t1logs.some(l => l.includes('Incremented value'))).toBe(true);
    expect(t1logs.some(l => l.includes('Passed mutex to Thread'))).toBe(true);
    expect(t2logs.some(l => l.includes('Decremented value'))).toBe(true);

    // Ensure no uncaught errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('Clear operations leads to finishing and Remove Thread edge cases', async ({ page }) => {
    // This test validates:
    // - Clearing operations resets operations and that a subsequent step moves the thread to 'finished'
    // - Removing threads updates UI and releases locks when necessary
    const app = new MutexPage(page);
    await app.goto();

    // Create a new thread that will be manipulated
    await app.clickAddThread(); // creates thread 3
    const t3 = 3;

    // Add operations to t3 then clear them
    await app.addOperation(t3, 'read');
    // Verify operation added
    let ops = await app.getThreadOperations(t3);
    expect(ops.length).toBeGreaterThan(0);

    // Clear operations for t3
    await app.clearThreadOperations(t3);
    ops = await app.getThreadOperations(t3);
    expect(ops.length).toBe(0);

    // Now step: because operations length is 0, executeNext will mark thread as finished
    await app.clickStep();
    const state3 = await app.getThreadState(t3);
    expect(state3.state).toBe('finished');

    // Remove all threads one by one and ensure UI updates without errors.
    // Remove threads until none remain
    let remaining = await app.countThreads();
    while (remaining > 0) {
      await app.clickRemoveThread();
      // allow UI update
      await page.waitForTimeout(50);
      remaining = await app.countThreads();
    }
    expect(remaining).toBe(0);

    // Calling step when no threads exist should not throw errors (no page errors)
    await app.clickStep();
    expect(pageErrors.length).toBe(0);
  });

  test('Start and Stop execution buttons toggle correctly and interval behavior', async ({ page }) => {
    // This test validates:
    // - startExecution disables startBtn, enables stopBtn and disables stepBtn
    // - stopExecution reverts those states
    // We will not rely on intervals to change state of threads; just validate the control toggles.
    const app = new MutexPage(page);
    await app.goto();

    // Ensure initial button states: start enabled, stop disabled (as per HTML initial state)
    const startBtn = page.locator(app.startBtn);
    const stopBtn = page.locator(app.stopBtn);
    const stepBtn = page.locator(app.stepBtn);

    // Some browsers may reflect "disabled" as attribute; use isEnabled/isDisabled checks
    expect(await startBtn.isEnabled()).toBe(true);
    expect(await stopBtn.isDisabled()).toBe(true);

    // Click start and validate toggles
    await app.clickStart();
    // Wait a short time for JS to update UI
    await page.waitForTimeout(100);
    expect(await startBtn.isDisabled()).toBe(true);
    expect(await stopBtn.isEnabled()).toBe(true);
    expect(await stepBtn.isDisabled()).toBe(true);

    // Stop execution and validate toggles revert
    await app.clickStop();
    await page.waitForTimeout(100);
    expect(await startBtn.isEnabled()).toBe(true);
    expect(await stopBtn.isDisabled()).toBe(true);
    expect(await stepBtn.isEnabled()).toBe(true);

    // Ensure no page errors due to interval start/stop logic
    expect(pageErrors.length).toBe(0);
  });

  test('Edge cases: attempt operations when threads are waiting or no ownership', async ({ page }) => {
    // Validate that increment/decrement fail when not owning the mutex and that logs record the failure.
    const app = new MutexPage(page);
    await app.goto();

    const t1 = 1;
    const t2 = 2;

    // Ensure a clean state: clear operations on both threads
    await app.clearThreadOperations(t1);
    await app.clearThreadOperations(t2);

    // Give t2 a decrement without acquiring lock
    await app.addOperation(t2, 'decrement');

    // Step: t2 will try to decrement but does not own mutex, so should log failure
    await app.clickStep();

    const t2logs = await app.getThreadLogLines(t2);
    expect(t2logs.some(l => l.includes("Failed to decrement")) || t2logs.some(l => l.includes("don't own mutex"))).toBe(true);

    // Now verify that setting speed while running restarts the interval (no errors thrown).
    // Start execution, change speed, then stop.
    await app.addOperation(t1, 'lock');
    await app.clickStart();
    await page.waitForTimeout(50);
    await app.setSpeed(800); // change speed via range input
    await page.waitForTimeout(50);
    await app.clickStop();

    // Ensure the console did not capture any uncaught exceptions on these operations
    expect(pageErrors.length).toBe(0);
  });

  test.afterEach(async ({ page }) => {
    // Final assertion: no uncaught page errors across tests
    // (Also log console messages for debugging if needed by a developer running the tests)
    expect(pageErrors.length).toBe(0);
  });
});