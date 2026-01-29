import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3cc405-fa74-11f0-a1b6-4b9b8151441a.html';

// Simple Page Object encapsulating common operations and queries
class SemaphorePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Collect console messages and page errors for assertions
    this.page.on('console', (msg) => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(String(err?.message ?? err));
    });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Controls
  get incButton() {
    return this.page.locator('#incSem');
  }
  get decButton() {
    return this.page.locator('#decSem');
  }
  get addWorkerButton() {
    return this.page.locator('#addWorker');
  }
  get runAllButton() {
    return this.page.locator('#runAll');
  }
  get semValue() {
    return this.page.locator('#semValue');
  }
  get logContainer() {
    return this.page.locator('#log');
  }

  workerLocator(id) {
    return this.page.locator(`#worker-${id}`);
  }

  workerStatusLocator(id) {
    return this.page.locator(`#worker-${id} .status`);
  }

  workerRunButton(id) {
    return this.page.locator(`#worker-${id} .run-btn`);
  }

  async clickInc() {
    await this.incButton.click();
  }
  async clickDec() {
    await this.decButton.click();
  }
  async clickAddWorker() {
    await this.addWorkerButton.click();
  }
  async clickRunAll() {
    await this.runAllButton.click();
  }

  // Wait helpers with generous timeouts to accommodate the app's random delays
  async waitForSemValue(expected, timeout = 5000) {
    await expect(this.semValue).toHaveText(String(expected), { timeout });
  }

  async waitForWorkerStatus(id, expected, timeout = 10000) {
    const status = this.workerStatusLocator(id);
    await expect(status).toHaveText(expected, { timeout });
  }

  async waitForWorkerClass(id, className, present = true, timeout = 10000) {
    await this.page.waitForFunction(
      (id, className, present) => {
        const el = document.getElementById(`worker-${id}`);
        if (!el) return false;
        const has = el.classList.contains(className);
        return present ? has : !has;
      },
      { timeout },
      id,
      className,
      present
    );
  }

  async lastLogContains(substring, timeout = 3000) {
    await this.page.waitForFunction(
      (substring) => {
        const log = document.getElementById('log');
        if (!log) return false;
        const items = Array.from(log.children).map((c) => c.textContent || '');
        if (items.length === 0) return false;
        return items[items.length - 1].includes(substring);
      },
      { timeout },
      substring
    );
  }

  // Returns number of console errors captured
  getConsoleErrors() {
    return this.consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
  }
}

test.describe('Semaphore Demo - End-to-End FSM validation', () => {
  let pageObj;

  test.beforeEach(async ({ page }) => {
    pageObj = new SemaphorePage(page);
    await pageObj.goto();
    // Ensure initial UI settled
    await expect(page.locator('h1')).toHaveText('Semaphore Demonstration');
  });

  test.afterEach(async () => {
    // Assert that no unexpected runtime errors were emitted to the page during the test
    const consoleErrors = pageObj.getConsoleErrors();
    const pageErrors = pageObj.pageErrors;
    // We expect no page errors or console errors for a correct runtime;
    // If there are such errors they will be exposed by these assertions.
    expect(consoleErrors.length, `Console errors/warnings encountered: ${JSON.stringify(pageObj.consoleMessages)}`).toBe(0);
    expect(pageErrors.length, `Page errors encountered: ${JSON.stringify(pageErrors)}`).toBe(0);
  });

  test.describe('Initial state and controls (S0_Idle)', () => {
    test('Initial semaphore display and controls exist and reflect entry action updateSemaphoreDisplay()', async () => {
      // Validate initial semaphore value from the DOM matches the FSM entry action expectation
      await pageObj.waitForSemValue(2);

      // Buttons must be visible
      await expect(pageObj.incButton).toBeVisible();
      await expect(pageObj.decButton).toBeVisible();
      await expect(pageObj.addWorkerButton).toBeVisible();
      await expect(pageObj.runAllButton).toBeVisible();

      // There should be 3 initial worker elements created by the script (ids 1,2,3)
      await expect(pageObj.workerLocator(1)).toBeVisible();
      await expect(pageObj.workerLocator(2)).toBeVisible();
      await expect(pageObj.workerLocator(3)).toBeVisible();
    });
  });

  test.describe('Semaphore adjustments (IncreaseSemaphore / DecreaseSemaphore)', () => {
    test('Decrease then Increase updates semaphore display and writes to log', async () => {
      // Decrease once: 2 -> 1
      await pageObj.clickDec();
      await pageObj.waitForSemValue(1);
      // The code logs 'Decreased semaphore value' once the acquisition resolved
      await pageObj.lastLogContains('Decreased semaphore value');

      // Increase once: 1 -> 2
      await pageObj.clickInc();
      await pageObj.waitForSemValue(2);
      await pageObj.lastLogContains('Increased semaphore value');
    });

    test('Cannot decrease semaphore below 0 triggers an explicit log message (edge case)', async () => {
      // Reduce to 0 by clicking dec twice (2 -> 1 -> 0)
      await pageObj.clickDec();
      await pageObj.clickDec();
      await pageObj.waitForSemValue(0);

      // Attempt to decrease at 0, should log "Cannot decrease semaphore - already at 0"
      await pageObj.clickDec();
      await pageObj.lastLogContains('Cannot decrease semaphore - already at 0');
    });
  });

  test.describe('Worker lifecycle and transitions (WorkerRun, RunAllWorkers)', () => {
    test('AddWorker creates new worker element and logs the addition', async () => {
      // Before adding, worker 4 should not exist (initial created 1..3)
      await expect(pageObj.workerLocator(4)).toHaveCount(0);

      // Click Add Worker -> should create worker 4 and log addition
      await pageObj.clickAddWorker();
      await expect(pageObj.workerLocator(4)).toBeVisible();
      await pageObj.lastLogContains('Added Worker 4');
    });

    test('Running a specific worker demonstrates Waiting -> Working -> Completed states', async () => {
      // Ensure a fresh worker exists to run (add worker 5 to avoid interfering with initial ones)
      await pageObj.clickAddWorker();
      // The new id should be 5 (initial 1-3, after previous tests there might be 4, but ensure we target latest)
      // Find the highest worker id by querying DOM
      const workerIds = await pageObj.page.evaluate(() => {
        return Array.from(document.querySelectorAll('#workers .worker')).map((el) => {
          const idStr = el.id.replace('worker-', '');
          return Number(idStr);
        }).sort((a, b) => a - b);
      });
      const newWorkerId = workerIds[workerIds.length - 1];

      // Force semaphore to 0 so the worker will enter Waiting state when run.
      // Current semaphore might be 2 or other due to previous tests; bring it to 0 deterministically:
      // Read current value and click dec appropriate times.
      const currentValue = Number(await pageObj.semValue.textContent());
      for (let i = 0; i < currentValue; i++) {
        await pageObj.clickDec();
      }
      await pageObj.waitForSemValue(0);

      // Click Run on the worker -> should immediately show Waiting and have 'waiting' class
      await pageObj.workerRunButton(newWorkerId).click();
      await pageObj.waitForWorkerStatus(newWorkerId, 'Waiting for semaphore');
      await pageObj.waitForWorkerClass(newWorkerId, 'waiting', true);

      // Now release semaphore so the waiting worker can acquire it -> it should transition to Working
      await pageObj.clickInc();
      // After release, the waiting worker should become Working and remove waiting class, add working class
      await pageObj.waitForWorkerStatus(newWorkerId, 'Working');
      // class transitions
      await pageObj.waitForWorkerClass(newWorkerId, 'waiting', false);
      await pageObj.waitForWorkerClass(newWorkerId, 'working', true);

      // Finally the worker will complete after simulated work; wait for Completed and removal of 'working'
      await pageObj.waitForWorkerStatus(newWorkerId, 'Completed', 15000);
      await pageObj.waitForWorkerClass(newWorkerId, 'working', false);

      // Verify corresponding log messages exist for the lifecycle
      // There should be log entries mentioning attempting to acquire, acquired, and finished
      const logsText = await pageObj.page.evaluate(() => Array.from(document.getElementById('log').children).map(c => c.textContent).join('\n'));
      expect(logsText).toContain(`Worker ${newWorkerId} attempting to acquire semaphore`);
      expect(logsText).toContain(`Worker ${newWorkerId} acquired semaphore. Working`);
      expect(logsText).toContain(`Worker ${newWorkerId} finished working. Releasing semaphore.`);
    });

    test('Run All Workers starts all and results in some Working and some Waiting depending on semaphore value', async () => {
      // Ensure there are at least 3 workers created (1..3 exist by default). Add two more to broaden scenario.
      await pageObj.clickAddWorker();
      await pageObj.clickAddWorker();

      // Set semaphore to 1 so only one worker can run immediately and the rest wait.
      // Reduce current value down to 1
      let current = Number(await pageObj.semValue.textContent());
      while (current > 1) {
        await pageObj.clickDec();
        current = Number(await pageObj.semValue.textContent());
      }
      while (current < 1) {
        await pageObj.clickInc();
        current = Number(await pageObj.semValue.textContent());
      }
      await pageObj.waitForSemValue(1);

      // Click Run All -> should log and start each worker
      await pageObj.clickRunAll();
      await pageObj.lastLogContains('Running all workers...');

      // After a short time, assert that at least one worker has 'working' class and at least one has 'waiting'
      // We will poll the DOM within a timeout window
      await pageObj.page.waitForFunction(() => {
        const workers = Array.from(document.querySelectorAll('#workers .worker'));
        return workers.some(w => w.classList.contains('working')) && workers.some(w => w.classList.contains('waiting'));
      }, { timeout: 10000 });
      // Sanity: ensure there are multiple workers affected
      const anyWorking = await pageObj.page.evaluate(() => Array.from(document.querySelectorAll('#workers .worker')).some(w => w.classList.contains('working')));
      const anyWaiting = await pageObj.page.evaluate(() => Array.from(document.querySelectorAll('#workers .worker')).some(w => w.classList.contains('waiting')));
      expect(anyWorking).toBeTruthy();
      expect(anyWaiting).toBeTruthy();
    });
  });

  test.describe('FSM evidence & onEnter/onExit behaviors', () => {
    test('S0_Idle entry action updateSemaphoreDisplay reflected immediately on load', async () => {
      // The initial semValue was set during load by updateSemaphoreDisplay in constructor and entry; verify it matches internal value
      await pageObj.waitForSemValue(2);
    });

    test('S2_Waiting and S1_Working evidence: status text and class changes are performed as described', async () => {
      // Add a worker to exercise a direct WorkerRun -> waiting -> acquire flow
      await pageObj.clickAddWorker();
      const ids = await pageObj.page.evaluate(() => Array.from(document.querySelectorAll('#workers .worker')).map(el => Number(el.id.replace('worker-', ''))).sort((a,b)=>a-b));
      const id = ids[ids.length - 1];

      // Force semaphore to 0 to cause waiting
      let cur = Number(await pageObj.semValue.textContent());
      for (let i = 0; i < cur; i++) await pageObj.clickDec();
      await pageObj.waitForSemValue(0);

      // Run worker => should show Waiting evidence
      await pageObj.workerRunButton(id).click();
      await pageObj.waitForWorkerStatus(id, 'Waiting for semaphore');
      // ensure waiting class present
      await pageObj.waitForWorkerClass(id, 'waiting', true);

      // Release to allow Worker to acquire => evidence for Working
      await pageObj.clickInc();
      await pageObj.waitForWorkerStatus(id, 'Working');
      await pageObj.waitForWorkerClass(id, 'working', true);
    });
  });

  // Additional miscellaneous validations and error observation
  test.describe('Console and runtime error observation (must not patch page)', () => {
    test('Page does not emit runtime pageerrors or console errors during normal interactions', async () => {
      // Perform a sequence of typical interactions
      await pageObj.clickAddWorker();
      await pageObj.clickInc();
      await pageObj.clickDec();
      await pageObj.clickRunAll();

      // Give some time for asynchronous logs / actions
      await pageObj.page.waitForTimeout(1000);

      // Validate there were no console level errors/warnings captured
      const consoleErrors1 = pageObj.getConsoleErrors();
      const pageErrors1 = pageObj.pageErrors1;
      expect(consoleErrors.length, `Console errors/warnings: ${JSON.stringify(pageObj.consoleMessages)}`).toBe(0);
      expect(pageErrors.length, `Page errors: ${JSON.stringify(pageErrors)}`).toBe(0);
    });
  });
});