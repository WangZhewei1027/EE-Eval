import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d306e50-fa7a-11f0-ba5b-57721b046e74.html';

// Page object for the Semaphore demo page
class SemaphorePage {
  constructor(page) {
    this.page = page;
    this.semaphoreValue = page.locator('#semaphoreValue');
    this.currentSemaphore = page.locator('#currentSemaphore');
    this.threadCount = page.locator('#threadCount');
    this.operationDelay = page.locator('#operationDelay');
    this.setupThreadsBtn = page.locator('#setupThreads');
    this.signalBtn = page.locator('#signal');
    this.waitBtn = page.locator('#wait');
    this.tryWaitBtn = page.locator('#tryWait');
    this.resetBtn = page.locator('#reset');
    this.threadsContainer = page.locator('#threadsContainer');
    this.accessResourceBtn = page.locator('#accessResource');
    this.releaseResourceBtn = page.locator('#releaseResource');
    this.resourceStatus = page.locator('#resourceStatus');
    this.clearLogBtn = page.locator('#clearLog');
    this.operationLog = page.locator('#operationLog');
    this.deadlockBtn = page.locator('#deadlockScenario');
    this.starvationBtn = page.locator('#starvationScenario');
    this.priorityBtn = page.locator('#priorityScenario');
    this.setPriorityBtn = page.locator('#setPriority');
    this.prioritySelect = page.locator('#prioritySelect');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Helpers
  async getCurrentSemaphoreValue() {
    return (await this.currentSemaphore.innerText()).trim();
  }

  async setSemaphoreInput(value) {
    await this.semaphoreValue.fill(String(value));
    // trigger change event by blurring
    await this.semaphoreValue.press('Tab');
  }

  async setOperationDelayMs(ms) {
    await this.operationDelay.fill(String(ms));
    await this.operationDelay.press('Tab');
  }

  async setupThreads(count) {
    await this.threadCount.fill(String(count));
    await this.setupThreadsBtn.click();
  }

  async threadElements() {
    return this.page.locator('.thread');
  }

  async threadCountRendered() {
    return await this.threadElements().count();
  }

  async threadState(threadId) {
    // threadId is 1-based
    const el = this.page.locator('.thread').nth(threadId - 1).locator('.threadState');
    return (await el.innerText()).trim();
  }

  async threadPriority(threadId) {
    const el = this.page.locator('.thread').nth(threadId - 1).locator('.threadPriority');
    return (await el.innerText()).trim();
  }

  async clickThreadWait(threadId) {
    await this.page.locator('.thread').nth(threadId - 1).locator('.threadWait').click();
  }

  async clickThreadSignal(threadId) {
    await this.page.locator('.thread').nth(threadId - 1).locator('.threadSignal').click();
  }

  async clickThreadAccess(threadId) {
    await this.page.locator('.thread').nth(threadId - 1).locator('.threadAccess').click();
  }

  async clickSignal() {
    await this.signalBtn.click();
  }

  async clickWait() {
    await this.waitBtn.click();
  }

  async clickTryWait() {
    return await this.tryWaitBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async clickAccessResource() {
    await this.accessResourceBtn.click();
  }

  async clickReleaseResource() {
    await this.releaseResourceBtn.click();
  }

  async clearLog() {
    await this.clearLogBtn.click();
  }

  async getLogText() {
    return await this.operationLog.innerText();
  }

  async clickDeadlock() {
    await this.deadlockBtn.click();
  }

  async clickStarvation() {
    await this.starvationBtn.click();
  }

  async clickPriorityScenario() {
    await this.priorityBtn.click();
  }

  async setPrioritySelect(value) {
    await this.prioritySelect.selectOption(value);
  }

  async clickSetPriority() {
    await this.setPriorityBtn.click();
  }
}

test.describe('Semaphore Demonstration - FSM tests', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Capture page errors and console messages for each test
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // collect runtime errors
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  });

  test.describe('Initial state and basic configuration (S0_Idle)', () => {
    test('S0_Idle: initial semaphore input exists and updateSemaphoreValue runs on load', async ({ page }) => {
      const p = new SemaphorePage(page);
      await p.goto();

      // Verify the semaphore input exists and default value is 1
      await expect(p.semaphoreValue).toHaveValue('1');

      // Current semaphore DOM element should reflect the initialized value
      await expect(p.currentSemaphore).toHaveText('1');

      // The operation log should contain the initialization message "Semaphore initialized to 1"
      const logText = await p.getLogText();
      expect(logText).toContain('Semaphore initialized to 1');

      // No runtime page errors should have been emitted during initialization
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Thread setup and transitions (S1_Ready, S2_Blocked, S3_Running)', () => {
    test('SetupThreads: creates threads and logs creation (S0 -> S1)', async ({ page }) => {
      const p = new SemaphorePage(page);
      await p.goto();

      // Reduce delays to speed up timeouts in tests
      await p.setOperationDelayMs(200);

      // Setup 3 threads
      await p.setupThreads(3);

      // Verify 3 thread elements rendered
      expect(await p.threadCountRendered()).toBe(3);

      // Verify the log contains a "Created 3 threads" entry
      const logText = await p.getLogText();
      expect(logText).toContain('Created 3 threads');

      // Each thread should be in 'ready' state initially
      for (let i = 1; i <= 3; i++) {
        expect(await p.threadState(i)).toBe('ready');
      }

      expect(pageErrors.length).toBe(0);
    });

    test('Thread wait when semaphore > 0 sets running; when semaphore == 0 becomes blocked and can be unblocked by signal', async ({ page }) => {
      const p = new SemaphorePage(page);
      await p.goto();
      await p.setOperationDelayMs(200);
      // ensure 2 threads to test blocking/unblocking
      await p.setupThreads(2);

      // First thread performs wait -> should acquire semaphore (initial 1) and become running, semaphore becomes 0
      await p.clickThreadWait(1);

      await expect(p.currentSemaphore).toHaveText('0');
      expect(await p.threadState(1)).toBe('running');

      // Second thread attempts wait -> semaphore is 0 so should be blocked
      await p.clickThreadWait(2);
      expect(await p.threadState(2)).toBe('blocked');

      // When we click global signal, semaphore increments immediately and then after operationDelay the blocked thread should be unblocked and acquire semaphore
      await p.clickSignal();

      // After signal, semaphore will be at least '1' before the delayed unblocking occurs. Give some time for the delayed unblocking (operationDelay + buffer)
      await page.waitForTimeout(300 + 200); // buffer slightly > operationDelay

      // Eventually, blocked thread should transition to running (unblocked) by delayed action
      await page.waitForFunction(() => {
        const threadEls = document.querySelectorAll('.thread');
        if (threadEls.length < 2) return false;
        return threadEls[1].querySelector('.threadState').textContent.trim() === 'running';
      }, { timeout: 2000 });

      expect(await p.threadState(2)).toBe('running');

      // Verify operation log includes messages about blocking and unblocking
      const log = await p.getLogText();
      expect(log).toContain('blocked - semaphore unavailable');
      expect(log).toMatch(/unblocked and acquired semaphore/);

      expect(pageErrors.length).toBe(0);
    });

    test('Manual Wait button when semaphore unavailable logs failure (edge case)', async ({ page }) => {
      const p = new SemaphorePage(page);
      await p.goto();
      await p.setOperationDelayMs(200);

      // Reset semaphore to 0 by setting input and pressing reset
      await p.setSemaphoreInput(0);
      await p.clickReset();

      // Click manual wait (global wait) when semaphore == 0
      await p.clickWait();

      const log = await p.getLogText();
      expect(log).toContain('Manual wait failed - semaphore unavailable');

      expect(pageErrors.length).toBe(0);
    });

    test('TryWait succeeds only when semaphore > 0 and returns expected log', async ({ page }) => {
      const p = new SemaphorePage(page);
      await p.goto();
      await p.setOperationDelayMs(200);

      // Ensure semaphore = 2 for test
      await p.setSemaphoreInput(2);
      await p.clickReset();

      const before = await p.getCurrentSemaphoreValue();
      expect(before).toBe('2');

      // Click Try Wait -> should decrement by 1
      await p.clickTryWait();
      await expect(p.currentSemaphore).toHaveText('1');

      const log = await p.getLogText();
      expect(log).toContain('Try wait succeeded - semaphore now');

      expect(pageErrors.length).toBe(0);
    });

    test('ResetSemaphore resets semaphore and resource states (S1 -> S0)', async ({ page }) => {
      const p = new SemaphorePage(page);
      await p.goto();
      await p.setOperationDelayMs(200);

      // Setup threads and change some state
      await p.setupThreads(2);
      await p.clickThreadWait(1); // acquire
      await expect(p.currentSemaphore).toHaveText('0');

      // Change the semaphore input to 5 and click reset
      await p.setSemaphoreInput(5);
      await p.clickReset();

      // Verify semaphore reads the input value
      await expect(p.currentSemaphore).toHaveText('5');

      // Resource should be available after reset
      await expect(p.resourceStatus).toHaveText('available');

      // Threads should be reset to 'ready'
      expect(await p.threadState(1)).toBe('ready');
      expect(await p.threadState(2)).toBe('ready');

      const log = await p.getLogText();
      expect(log).toContain('System reset - semaphore = 5');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Resource usage and transitions (S4_ResourceInUse, S5_ResourceAvailable)', () => {
    test('Manual AccessResource acquires and releases resource with semaphore effects', async ({ page }) => {
      const p = new SemaphorePage(page);
      await p.goto();
      // shorten delays to speed test
      await p.setOperationDelayMs(150);

      // Ensure semaphore >=1
      await p.setSemaphoreInput(2);
      await p.clickReset();

      // Manual access should acquire the resource and set text to "in use (manual)"
      await p.clickAccessResource();
      await expect(p.resourceStatus).toContainText('in use');

      // Semaphore should have decreased by 1
      const afterAcquire = parseInt(await p.getCurrentSemaphoreValue(), 10);
      expect(afterAcquire).toBe(1);

      // Wait for the automatic release after operationDelay * 2
      await page.waitForTimeout(150 * 2 + 200);

      // Resource should be available again
      await expect(p.resourceStatus).toHaveText('available');

      // Semaphore should be incremented back (2)
      await expect(p.currentSemaphore).toHaveText('2');

      const log = await p.getLogText();
      expect(log).toContain('Resource acquired manually');
      expect(log).toContain('Resource released manually');

      expect(pageErrors.length).toBe(0);
    });

    test('ReleaseResource when resource not in use logs appropriately; when resource in use it force-releases', async ({ page }) => {
      const p = new SemaphorePage(page);
      await p.goto();
      await p.setOperationDelayMs(150);

      // Ensure semaphore and resource start clean
      await p.setSemaphoreInput(1);
      await p.clickReset();

      // Release resource when not in use
      await p.clickReleaseResource();
      let log = await p.getLogText();
      expect(log).toContain('Resource not in use - nothing to release');

      // Acquire resource manually
      await p.clickAccessResource();
      await expect(p.resourceStatus).toContainText('in use');

      // Now force-release
      await p.clickReleaseResource();
      await expect(p.resourceStatus).toHaveText('available');

      log = await p.getLogText();
      expect(log).toContain('Resource force-released manually');

      expect(pageErrors.length).toBe(0);
    });

    test('Thread-based resource access transitions thread states and resource status', async ({ page }) => {
      const p = new SemaphorePage(page);
      await p.goto();
      await p.setOperationDelayMs(150);

      // Setup threads and ensure semaphore at least 1
      await p.setSemaphoreInput(2);
      await p.clickReset();
      await p.setupThreads(2);

      // Thread 1 attempts to access resource -> should acquire resource and become running
      await p.clickThreadAccess(1);
      await expect(p.threadState(1)).toBe('running');
      expect(await p.resourceStatus.innerText()).toContain('in use by');

      // After the simulated usage (operationDelay * 2) it should release and thread becomes ready
      await page.waitForTimeout(150 * 2 + 250);
      expect(await p.resourceStatus.innerText()).toBe('available');
      expect(await p.threadState(1)).toBe('ready');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Advanced scenarios and priority handling', () => {
    test('DeadlockScenario logs deadlock messages when at least 2 threads exist', async ({ page }) => {
      const p = new SemaphorePage(page);
      await p.goto();
      await p.setOperationDelayMs(100);
      await p.setupThreads(2);

      await p.clickDeadlock();

      // Wait for the deadlock final message after operationDelay * 2
      await page.waitForTimeout(100 * 2 + 300);

      const log = await p.getLogText();
      expect(log).toContain('Deadlock occurred! Both threads are blocked waiting for each other\'s resources.');
      expect(pageErrors.length).toBe(0);
    });

    test('StarvationScenario sets priorities and logs expected behavior when at least 3 threads', async ({ page }) => {
      const p = new SemaphorePage(page);
      await p.goto();
      await p.setOperationDelayMs(50); // speed things up
      await p.setupThreads(3);

      await p.clickStarvation();

      // Wait for some scheduled logs to appear
      await page.waitForTimeout(50 * 5 + 300);

      const log = await p.getLogText();
      expect(log).toContain('Starting starvation simulation');
      expect(log).toContain('(high priority)');
      expect(log).toContain('(low priority)');
      expect(pageErrors.length).toBe(0);
    });

    test('Priority inversion scenario logs and updates priorities for threads', async ({ page }) => {
      const p = new SemaphorePage(page);
      await p.goto();
      await p.setOperationDelayMs(50);
      await p.setupThreads(3);

      await p.clickPriorityScenario();

      // Wait for scheduled log messages
      await page.waitForTimeout(50 * 3 + 300);

      const log = await p.getLogText();
      expect(log).toContain('Starting priority inversion simulation');
      expect(log).toContain('acquires resource');
      expect(log).toContain('preempting');
      expect(pageErrors.length).toBe(0);

      // Verify thread priorities have been updated in DOM as expected
      expect(await p.threadPriority(1)).toBe('high');
      expect(await p.threadPriority(2)).toBe('normal');
      expect(await p.threadPriority(3)).toBe('low');
    });

    test('SetPriority uses prompt and updates thread priority when valid thread id provided', async ({ page }) => {
      const p = new SemaphorePage(page);
      await p.goto();
      await p.setOperationDelayMs(50);
      await p.setupThreads(2);

      // Choose a priority from the select
      await p.setPrioritySelect('low');

      // Intercept the prompt dialog and supply thread id "1"
      page.once('dialog', async (dialog) => {
        // ensure it is a prompt
        await dialog.accept('1');
      });

      // Click set priority - the page code calls prompt synchronously; our handler will respond
      await p.clickSetPriority();

      // The log should show priority set
      await page.waitForTimeout(200); // small wait to allow log to be written
      const log = await p.getLogText();
      expect(log).toContain('priority set to low');

      // Verify thread 1 priority updated in DOM
      expect(await p.threadPriority(1)).toBe('low');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Logging and utility actions', () => {
    test('ClearLog empties the operation log', async ({ page }) => {
      const p = new SemaphorePage(page);
      await p.goto();
      await p.setOperationDelayMs(50);
      await p.setupThreads(1);

      // Ensure there's some log content
      let log = await p.getLogText();
      expect(log.length).toBeGreaterThan(0);

      // Clear the log
      await p.clearLog();

      // The operation log should be empty
      const cleared = await p.getLogText();
      expect(cleared.trim()).toBe('');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Observability: console messages and runtime errors', () => {
    test('No unexpected page errors during typical usage', async ({ page }) => {
      const p = new SemaphorePage(page);

      // Start and perform a sequence of operations to surface any runtime issues
      await p.goto();
      await p.setOperationDelayMs(50);
      await p.setupThreads(3);
      await p.clickThreadWait(1);
      await p.clickSignal();
      await p.clickAccessResource();
      await p.clickReleaseResource();
      await p.clickDeadlock();
      await p.clickStarvation();
      await p.clickPriorityScenario();

      // Wait briefly for scheduled logs to run
      await page.waitForTimeout(400);

      // Assert that there were no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Collect console messages for diagnostic purposes (but do not require any specific console output)
      // Ensure at least some console activity happened (the page writes logs to DOM but may not use console heavily)
      expect(Array.isArray(consoleMessages)).toBe(true);

      // If there are any console messages of type 'error' they should be exposed via pageErrors as well.
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });
});