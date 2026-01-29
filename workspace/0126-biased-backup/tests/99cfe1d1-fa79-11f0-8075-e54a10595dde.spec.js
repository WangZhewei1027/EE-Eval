import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cfe1d1-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Mutex Simulation page
class MutexPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      lockBtn: '#lockBtn',
      unlockBtn: '#unlockBtn',
      startThread1: '#startThread1',
      startThread2: '#startThread2',
      stopThread1: '#stopThread1',
      stopThread2: '#stopThread2',
      mutexState: '#mutexState',
      thread1State: '#thread1State',
      thread2State: '#thread2State',
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async lock() {
    await this.page.click(this.selectors.lockBtn);
  }

  async unlock() {
    await this.page.click(this.selectors.unlockBtn);
  }

  async startThread1() {
    await this.page.click(this.selectors.startThread1);
  }

  async startThread2() {
    await this.page.click(this.selectors.startThread2);
  }

  async stopThread1() {
    await this.page.click(this.selectors.stopThread1);
  }

  async stopThread2() {
    await this.page.click(this.selectors.stopThread2);
  }

  async getMutexStateText() {
    return (await this.page.locator(this.selectors.mutexState).textContent())?.trim();
  }

  async getThread1StateText() {
    return (await this.page.locator(this.selectors.thread1State).textContent())?.trim();
  }

  async getThread2StateText() {
    return (await this.page.locator(this.selectors.thread2State).textContent())?.trim();
  }
}

test.describe('Mutex FSM - States and Transitions', () => {
  // Shared variables to capture dialogs, console messages, and page errors
  let dialogs;
  let consoleMessages;
  let pageErrors;
  let mutexPage;

  test.beforeEach(async ({ page }) => {
    dialogs = [];
    consoleMessages = [];
    pageErrors = [];

    // capture dialogs (alerts) emitted by the page
    page.on('dialog', async (dialog) => {
      // record and accept so the test can continue
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // capture console messages for inspection (info, warning, error, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    mutexPage = new MutexPage(page);
    await mutexPage.goto();
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond playwright's automatic cleanup.
    // Tests assert on the captured arrays as needed.
  });

  test('Initial state is Idle with mutex unlocked and threads idle', async ({}) => {
    // Validate initial onEnter actions effect -> DOM reflects initial state
    expect(await mutexPage.getMutexStateText()).toBe('Mutex is Unlocked');
    expect(await mutexPage.getThread1StateText()).toBe('Thread 1 State: Idle');
    expect(await mutexPage.getThread2StateText()).toBe('Thread 2 State: Idle');

    // No alerts or errors should have been produced merely by loading
    expect(dialogs.length).toBe(0);
    expect(pageErrors.length).toBe(0);
    // Ensure there are no console error messages
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Locking the mutex transitions to Locked and double-lock shows alert', async ({}) => {
    // From Idle -> Lock
    await mutexPage.lock();
    expect(await mutexPage.getMutexStateText()).toBe('Mutex is Locked');

    // Clicking lock again should trigger alert "Mutex is already locked!"
    await mutexPage.lock();
    // Wait for the dialog to be handled by our listener
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    // The last dialog should be the "already locked" message
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.type).toBe('alert');
    expect(lastDialog.message).toBe('Mutex is already locked!');

    // No page errors should result from clicking lock repeatedly
    expect(pageErrors.length).toBe(0);
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
  });

  test('Unlocking the mutex transitions to Unlocked and double-unlock shows alert', async ({}) => {
    // Initial is unlocked; clicking unlock should show "Mutex is already unlocked!"
    await mutexPage.unlock();
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const unlockDialog = dialogs[dialogs.length - 1];
    expect(unlockDialog.type).toBe('alert');
    expect(unlockDialog.message).toBe('Mutex is already unlocked!');

    // Now lock then unlock to test normal transition
    await mutexPage.lock();
    expect(await mutexPage.getMutexStateText()).toBe('Mutex is Locked');

    await mutexPage.unlock();
    expect(await mutexPage.getMutexStateText()).toBe('Mutex is Unlocked');

    // No page errors from these actions
    expect(pageErrors.length).toBe(0);
  });

  test('Start and Stop Thread 1 transitions correctly when mutex is unlocked', async ({}) => {
    // Ensure mutex unlocked to allow starting threads
    expect(await mutexPage.getMutexStateText()).toBe('Mutex is Unlocked');

    // Start Thread 1 -> should set thread1Active = true and update DOM
    await mutexPage.startThread1();
    expect(await mutexPage.getThread1StateText()).toBe('Thread 1 State: Running');

    // Stop Thread 1 -> should set thread1Active = false and update DOM
    await mutexPage.stopThread1();
    expect(await mutexPage.getThread1StateText()).toBe('Thread 1 State: Idle');

    // Starting Thread 1 while mutex locked should show an alert
    await mutexPage.lock();
    await mutexPage.startThread1();
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.message).toBe('Cannot start Thread 1, Mutex is locked!');

    // Clean up: unlock so other tests are not impacted
    await mutexPage.unlock();
  });

  test('Start and Stop Thread 2 transitions correctly when mutex is unlocked', async ({}) => {
    // Start Thread 2 when unlocked
    await mutexPage.startThread2();
    expect(await mutexPage.getThread2StateText()).toBe('Thread 2 State: Running');

    // Stop Thread 2
    await mutexPage.stopThread2();
    expect(await mutexPage.getThread2StateText()).toBe('Thread 2 State: Idle');

    // Attempt to start Thread 2 while mutex locked should show alert
    await mutexPage.lock();
    await mutexPage.startThread2();
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.message).toBe('Cannot start Thread 2, Mutex is locked!');

    // Unlock to restore initial conditions
    await mutexPage.unlock();
  });

  test('Both threads can run concurrently when mutex is unlocked, and stopping works independently', async ({}) => {
    // Ensure unlocked
    expect(await mutexPage.getMutexStateText()).toBe('Mutex is Unlocked');

    // Start both threads
    await mutexPage.startThread1();
    await mutexPage.startThread2();
    expect(await mutexPage.getThread1StateText()).toBe('Thread 1 State: Running');
    expect(await mutexPage.getThread2StateText()).toBe('Thread 2 State: Running');

    // Stop thread1 only
    await mutexPage.stopThread1();
    expect(await mutexPage.getThread1StateText()).toBe('Thread 1 State: Idle');
    // thread2 should remain running
    expect(await mutexPage.getThread2StateText()).toBe('Thread 2 State: Running');

    // Stop thread2
    await mutexPage.stopThread2();
    expect(await mutexPage.getThread2StateText()).toBe('Thread 2 State: Idle');

    // Ensure no unexpected page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Locking while a thread is running locks mutex but does not stop threads (onExit/onEnter behavior check)', async ({}) => {
    // Start a thread
    await mutexPage.startThread1();
    expect(await mutexPage.getThread1StateText()).toBe('Thread 1 State: Running');

    // Now lock the mutex while thread is running
    await mutexPage.lock();
    expect(await mutexPage.getMutexStateText()).toBe('Mutex is Locked');

    // Thread should still be running because code does not force stop on lock
    expect(await mutexPage.getThread1StateText()).toBe('Thread 1 State: Running');

    // Now stop the thread and ensure it becomes idle
    await mutexPage.stopThread1();
    expect(await mutexPage.getThread1StateText()).toBe('Thread 1 State: Idle');

    // Unlock to restore baseline
    await mutexPage.unlock();
  });
});

test.describe('Edge Cases, Alerts and Runtime Observability', () => {
  let dialogs;
  let consoleMessages;
  let pageErrors;
  let mutexPage;

  test.beforeEach(async ({ page }) => {
    dialogs = [];
    consoleMessages = [];
    pageErrors = [];

    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    mutexPage = new MutexPage(page);
    await mutexPage.goto();
  });

  test('Alerts are emitted with exact expected text for invalid actions', async ({}) => {
    // Attempt to unlock when already unlocked (initial state)
    await mutexPage.unlock();
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[dialogs.length - 1].message).toBe('Mutex is already unlocked!');

    // Lock, then attempt to start threads which should show specific alerts
    await mutexPage.lock();
    await mutexPage.startThread1();
    expect(dialogs[dialogs.length - 1].message).toBe('Cannot start Thread 1, Mutex is locked!');
    await mutexPage.startThread2();
    expect(dialogs[dialogs.length - 1].message).toBe('Cannot start Thread 2, Mutex is locked!');

    // Attempt to lock again should produce "already locked" alert
    await mutexPage.lock();
    expect(dialogs[dialogs.length - 1].message).toBe('Mutex is already locked!');
  });

  test('No runtime page errors or console errors are produced during normal and edge interactions', async ({}) => {
    // Perform a sequence of interactions that exercise normal and edge behavior
    await mutexPage.startThread1();
    await mutexPage.lock();       // locking while thread running
    await mutexPage.startThread2(); // should show alert because mutex is locked
    await mutexPage.unlock();
    await mutexPage.startThread2();
    await mutexPage.stopThread1();
    await mutexPage.stopThread2();
    await mutexPage.lock();
    await mutexPage.unlock();

    // Ensure there were alert dialogs during the interactions (we expect some)
    expect(dialogs.length).toBeGreaterThanOrEqual(1);

    // The page should not have thrown uncaught exceptions
    expect(pageErrors.length).toBe(0);

    // There should be no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});