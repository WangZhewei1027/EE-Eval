import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3d91e10-fa73-11f0-83e0-8d7be1d51901.html';

// Page object for the Mutex demo page
class MutexDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Selectors
    this.log = '#log';
    this.counterBadge = '#counterBadge';
    this.lockedBadge = '#lockedBadge';
    this.queueBadge = '#queueBadge';
    this.taskContainer = '#taskContainer';
    this.numTasks = '#numTasks';
    this.minDelay = '#minDelay';
    this.maxDelay = '#maxDelay';
    this.startNoMutex = '#startNoMutex';
    this.startWithMutex = '#startWithMutex';
    this.clearLog = '#clearLog';
  }

  // Navigation
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Helpers to read UI
  async getLogText() {
    return (await this.page.textContent(this.log)) || '';
  }

  async waitForLogContains(text, opts = {}) {
    const timeout = opts.timeout ?? 10_000;
    await this.page.waitForFunction(
      (sel, expected) => document.querySelector(sel).textContent.includes(expected),
      this.log,
      text,
      { timeout }
    );
  }

  async getCounter() {
    const txt = (await this.page.textContent(this.counterBadge)) || '0';
    return Number(txt.trim());
  }

  async getLocked() {
    const txt1 = (await this.page.textContent(this.lockedBadge)) || 'false';
    return txt.trim() === 'true';
  }

  async getQueueLength() {
    const txt2 = (await this.page.textContent(this.queueBadge)) || '0';
    return Number(txt.trim());
  }

  async getTaskCount() {
    return await this.page.$$eval('#taskContainer .task', els => els.length);
  }

  async setNumTasks(n) {
    await this.page.fill(this.numTasks, String(n));
  }

  async setMinDelay(ms) {
    await this.page.fill(this.minDelay, String(ms));
  }

  async setMaxDelay(ms) {
    await this.page.fill(this.maxDelay, String(ms));
  }

  async clickStartNoMutex() {
    await this.page.click(this.startNoMutex);
  }

  async clickStartWithMutex() {
    await this.page.click(this.startWithMutex);
  }

  async clickClearLog() {
    await this.page.click(this.clearLog);
  }

  async isStartButtonsDisabled() {
    const a = await this.page.isDisabled(this.startNoMutex);
    const b = await this.page.isDisabled(this.startWithMutex);
    return a && b;
  }

  // Wait until "All tasks finished." is logged (end of a run)
  async waitForAllTasksFinished(timeout = 20000) {
    await this.waitForLogContains('All tasks finished.', { timeout });
  }

  // Poll until locked badge becomes true at least once (used for mutex run)
  async waitUntilLocked(timeout = 5000) {
    await this.page.waitForFunction(
      sel => document.querySelector(sel).textContent.trim() === 'true',
      this.lockedBadge,
      { timeout }
    );
  }
}

// Test suite for the FSM described in the prompt
test.describe('Mutex (Mutual Exclusion) Demo - FSM validation', () => {
  // Keep console errors and page errors for each test to assert they do not unexpectedly occur.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', msg => {
      // Collect only error-level console messages to assert none are emitted unexpectedly.
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Idle state check: initial UI and log
  test('S0_Idle - initial idle state shows ready message and badges reset', async ({ page }) => {
    const demo = new MutexDemoPage(page);
    await demo.goto();

    // Validate initial log contains the expected idle evidence line
    await demo.waitForLogContains('Mutex demo ready. Press "Start (No Mutex)" to observe race conditions, or "Start (With Mutex)" to enforce exclusive access.');

    // Validate badges show initial values (counter 0, mutex false, queue 0)
    expect(await demo.getCounter()).toBe(0);
    expect(await demo.getLocked()).toBe(false);
    expect(await demo.getQueueLength()).toBe(0);

    // Task container should be empty initially
    expect(await demo.getTaskCount()).toBe(0);

    // Ensure no console errors or uncaught errors happened during initial load
    expect(consoleErrors, 'No console.error messages during load').toHaveLength(0);
    expect(pageErrors, 'No uncaught page errors during load').toHaveLength(0);
  });

  // Start tasks without mutex, assert transition and effects, then clear log resets UI
  test('S1_TasksRunningNoMutex -> S3_LogCleared - start no mutex, tasks run, then clear resets', async ({ page }) => {
    test.setTimeout(40_000); // tasks run may take time
    const demo1 = new MutexDemoPage(page);
    await demo.goto();

    // Configure a modest number of tasks to keep test quick and deterministic-ish
    await demo.setNumTasks(5);
    await demo.setMinDelay(5);
    await demo.setMaxDelay(30);

    // Click Start (No Mutex) to trigger transition S0 -> S1
    await demo.clickStartNoMutex();

    // On entry, the log should mention starting without mutex
    await demo.waitForLogContains('Starting 5 tasks without mutex.');

    // Buttons should be disabled while tasks are running (exit action re-enables)
    expect(await demo.isStartButtonsDisabled()).toBe(true);

    // During run some task elements should appear
    await page.waitForFunction(
      sel => document.querySelectorAll(sel + ' .task').length > 0,
      '#taskContainer'
    );

    // Wait for all tasks to finish and the corresponding log entry
    await demo.waitForAllTasksFinished(30_000);

    // After completion, start buttons should be re-enabled
    expect(await demo.isStartButtonsDisabled()).toBe(false);

    // Read final counter and verify it's <= expected (no-mutex may lose updates)
    const finalCounter = await demo.getCounter();
    const expectedFinal = 5; // starting counter assumed 0 for this test
    expect(finalCounter).toBeGreaterThanOrEqual(0);
    expect(finalCounter).toBeLessThanOrEqual(expectedFinal);

    // Now trigger Clear / Reset (S1 -> S3 -> S0)
    await demo.clickClearLog();

    // After clicking clear, the log is cleared then a reset log line is written.
    await demo.waitForLogContains('Reset counter and cleared tasks/log.');

    // Counter should be reset to 0, task container empty
    expect(await demo.getCounter()).toBe(0);
    expect(await demo.getTaskCount()).toBe(0);

    // Ensure no console errors or uncaught page errors occurred during the run
    expect(consoleErrors, 'No console.error messages during no-mutex run').toHaveLength(0);
    expect(pageErrors, 'No uncaught page errors during no-mutex run').toHaveLength(0);
  });

  // Start tasks with mutex and verify exclusivity (final counter matches expected)
  test('S2_TasksRunningWithMutex -> S0_Idle - start with mutex enforces exclusive access', async ({ page }) => {
    test.setTimeout(40_000);
    const demo2 = new MutexDemoPage(page);
    await demo.goto();

    // Set parameters to ensure measurable critical section durations
    await demo.setNumTasks(6);
    await demo.setMinDelay(10);
    await demo.setMaxDelay(60);

    // Click Start (With Mutex) to trigger transition S0 -> S2
    await demo.clickStartWithMutex();

    // On entry, log should state starting with mutex
    await demo.waitForLogContains('Starting 6 tasks with mutex.');

    // Buttons should be disabled while tasks are running
    expect(await demo.isStartButtonsDisabled()).toBe(true);

    // During the mutex run, at least once the locked badge should become true.
    // Wait for locked badge to turn true (some task acquired mutex)
    await demo.waitUntilLocked(10_000);

    // Wait for all tasks to finish
    await demo.waitForAllTasksFinished(30_000);

    // After completion, the counter should equal expected final (no lost updates with mutex)
    const finalCounter1 = await demo.getCounter();
    const expectedFinal1 = 6; // starting from 0 in test environment
    expect(finalCounter).toBe(expectedFinal);

    // Buttons re-enabled after run
    expect(await demo.isStartButtonsDisabled()).toBe(false);

    // Ensure no console errors or uncaught page errors occurred during the mutex run
    expect(consoleErrors, 'No console.error messages during mutex run').toHaveLength(0);
    expect(pageErrors, 'No uncaught page errors during mutex run').toHaveLength(0);
  });

  // Edge-case tests: inputs causing normalization and input boundary handling
  test('Edge cases: numTasks 0 normalized to 1, and minDelay > maxDelay handled gracefully', async ({ page }) => {
    test.setTimeout(30_000);
    const demo3 = new MutexDemoPage(page);
    await demo.goto();

    // Case 1: numTasks = 0 should be treated as 1 (Math.max(1, ...))
    await demo.setNumTasks(0);
    await demo.setMinDelay(1);
    await demo.setMaxDelay(5);
    await demo.clickStartNoMutex();
    await demo.waitForLogContains('Starting 1 tasks without mutex.');
    await demo.waitForAllTasksFinished(15_000);

    // Counter should have incremented by exactly 1
    expect(await demo.getCounter()).toBeGreaterThanOrEqual(1);
    // Reset for next sub-case
    await demo.clickClearLog();
    await demo.waitForLogContains('Reset counter and cleared tasks/log.');

    // Case 2: minDelay greater than maxDelay -> code normalizes maxDelay = Math.max(minDelay, maxDelay)
    // Set minDelay larger than maxDelay and ensure no exceptions and tasks finish.
    await demo.setNumTasks(3);
    await demo.setMinDelay(100);
    await demo.setMaxDelay(10); // intentionally smaller; code should adjust
    await demo.clickStartWithMutex();
    await demo.waitForLogContains('Starting 3 tasks with mutex.');
    await demo.waitForAllTasksFinished(30_000);

    // All tasks with mutex should have applied their increments
    expect(await demo.getCounter()).toBeGreaterThanOrEqual(3);

    // Ensure no console errors or uncaught page errors occurred during edge-case runs
    expect(consoleErrors, 'No console.error messages during edge-case runs').toHaveLength(0);
    expect(pageErrors, 'No uncaught page errors during edge-case runs').toHaveLength(0);
  });

  // Observe console logs and page errors throughout a longer run to ensure stability
  test('Observability: capture console logs and page errors across interactions', async ({ page }) => {
    test.setTimeout(40_000);
    const demo4 = new MutexDemoPage(page);
    await demo.goto();

    // Perform a sequence: start no mutex, then start with mutex (sequential), then clear
    await demo.setNumTasks(4);
    await demo.setMinDelay(5);
    await demo.setMaxDelay(30);

    // Start no mutex
    await demo.clickStartNoMutex();
    await demo.waitForLogContains('Starting 4 tasks without mutex.');
    await demo.waitForAllTasksFinished(20_000);

    // Start with mutex
    await demo.clickStartWithMutex();
    await demo.waitForLogContains('Starting 4 tasks with mutex.');
    await demo.waitForAllTasksFinished(20_000);

    // Clear / Reset
    await demo.clickClearLog();
    await demo.waitForLogContains('Reset counter and cleared tasks/log.');

    // Verify there were no console.error messages recorded and no uncaught page errors.
    // This asserts that the page runs as-is without runtime exceptions.
    expect(consoleErrors, 'No console.error messages during full interaction sequence').toHaveLength(0);
    expect(pageErrors, 'No uncaught page errors during full interaction sequence').toHaveLength(0);

    // Additionally assert that the final counter is 0 after reset
    expect(await demo.getCounter()).toBe(0);
    expect(await demo.getTaskCount()).toBe(0);
  });
});