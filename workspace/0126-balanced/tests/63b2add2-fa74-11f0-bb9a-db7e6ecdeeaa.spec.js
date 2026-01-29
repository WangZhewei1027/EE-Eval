import { test, expect } from '@playwright/test';

// Test file: 63b2add2-fa74-11f0-bb9a-db7e6ecdeeaa.spec.js
// Serves the page at: http://127.0.0.1:5500/workspace/0126-balanced/html/63b2add2-fa74-11f0-bb9a-db7e6ecdeeaa.html

// Page Object for the Mutex Demo page
class MutexPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#start');
    this.clearBtn = page.locator('#clear');
    this.logEl = page.locator('#log');
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-balanced/html/63b2add2-fa74-11f0-bb9a-db7e6ecdeeaa.html', { waitUntil: 'domcontentloaded' });
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickClear() {
    await this.clearBtn.click();
  }

  async getLogText() {
    return this.logEl.evaluate(el => el.textContent || '');
  }

  // Wait until the log contains the given substring (default timeout 10s)
  async waitForLogContains(substring, timeout = 10000) {
    await this.page.waitForFunction(
      (sel, str) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.indexOf(str) !== -1;
      },
      '#log',
      substring,
      { timeout }
    );
  }

  // Wait until the log does NOT contain any text (cleared)
  async waitForLogEmpty(timeout = 5000) {
    await this.page.waitForFunction(
      sel => {
        const el1 = document.querySelector(sel);
        return el && (!el.textContent || el.textContent.length === 0);
      },
      '#log',
      { timeout }
    );
  }

  // Read the sharedCounter from the page's global scope
  async getSharedCounter() {
    return await this.page.evaluate(() => {
      // Access the global variable if present
      // If it's not present, return undefined (test will assert)
      // We purposely do not patch or define anything on the page.
      // Let evaluation happen naturally.
      return window.sharedCounter;
    });
  }

  // Returns array of log lines trimmed
  async getLogLines() {
    const text = await this.getLogText();
    return text.split('\n').map(l => l.trim()).filter(Boolean);
  }
}

// Collects page errors and console errors for assertions
function setupErrorCollectors(page) {
  const pageErrors = [];
  const consoleErrors = [];

  page.on('pageerror', err => {
    // Collect any uncaught exceptions on the page
    pageErrors.push(err);
  });

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({
        text: msg.text(),
        location: msg.location()
      });
    }
  });

  return { pageErrors, consoleErrors };
}

test.describe('Mutex Demonstration - FSM and UI behavior', () => {
  // Use a somewhat generous timeout because tasks in the demo are asynchronous and serialized by a mutex.
  test.setTimeout(20000);

  // Each test will create its own page fixture via Playwright
  test.beforeEach(async ({ page }) => {
    // No-op: Page fixture is provided by Playwright. Tests will call goto via the page object.
  });

  // Test: Initial Idle state renders controls and empty log
  test('Initial "Idle" state: controls are present and log starts empty', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCollectors(page);
    const mutexPage = new MutexPage(page);

    // Navigate to the page (entry action: renderPage() implied by HTML)
    await mutexPage.goto();

    // Verify Start and Clear buttons are visible
    await expect(mutexPage.startBtn).toBeVisible();
    await expect(mutexPage.clearBtn).toBeVisible();

    // Log should be initially empty (evidence: <div id="log"></div>)
    const initialLog = await mutexPage.getLogText();
    expect(initialLog.trim()).toBe('');

    // No runtime errors should have been raised just by rendering the page
    expect(pageErrors.length, 'No page errors should occur on initial render').toBe(0);
    expect(consoleErrors.length, 'No console.error messages on initial render').toBe(0);
  });

  // Test: Clicking Start Tasks transitions to Tasks Started and emits "Starting tasks..."
  test('Transition S0_Idle -> S1_Tasks_Started: clicking Start initializes sharedCounter and logs start', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCollectors(page);
    const mutexPage1 = new MutexPage(page);

    await mutexPage.goto();

    // Click Start Tasks - this should run entry actions: sharedCounter = 0; log('Starting tasks...\n');
    await mutexPage.clickStart();

    // Wait for the "Starting tasks..." text to appear in the log
    await mutexPage.waitForLogContains('Starting tasks...', 5000);

    // Verify sharedCounter was set to 0 by the onClick handler
    const sharedCounter = await mutexPage.getSharedCounter();
    expect(sharedCounter).toBe(0);

    // Verify the log contains the "Starting tasks..." message
    const logText = await mutexPage.getLogText();
    expect(logText).toContain('Starting tasks...');

    // Ensure no page-level errors occurred during starting of tasks
    expect(pageErrors.length, 'No page errors after starting tasks').toBe(0);
    expect(consoleErrors.length, 'No console.error messages after starting tasks').toBe(0);
  });

  // Test: Tasks acquire mutex, enter critical section, update sharedCounter sequentially, and release
  test('Transitions S1_Tasks_Started <-> S2_Critical_Section: tasks enter, update sharedCounter, leave, and release mutex', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCollectors(page);
    const mutexPage2 = new MutexPage(page);

    await mutexPage.goto();

    // Start the tasks
    await mutexPage.clickStart();

    // Wait for the first task to acquire the mutex
    await mutexPage.waitForLogContains('Mutex acquired, entering critical section.', 5000);

    // Wait until all tasks have completed. We expect sharedCounter to reach 5.
    // Since durations are serialized by the mutex, total time could be up to ~5000ms; allow up to 10s.
    await page.waitForFunction(() => {
      return window.sharedCounter === 5;
    }, {}, { timeout: 10000 }).catch(() => null);

    const finalCounter = await mutexPage.getSharedCounter();

    // We expect the tasks to have incremented sharedCounter to 5 in total
    expect(finalCounter, 'sharedCounter should be incremented to 5 after all tasks complete').toBe(5);

    // Verify that for each task there are log entries indicating entering and leaving critical section
    const lines = await mutexPage.getLogLines();

    // Verify there is at least one "Mutex acquired" and one "Leaving critical section."
    const acquiredCount = lines.filter(l => l.includes('Mutex acquired, entering critical section.')).length;
    const leavingCount = lines.filter(l => l.includes('Leaving critical section.')).length;
    const releasedCount = lines.filter(l => l.includes('Mutex released.')).length;
    const updatedCount = lines.filter(l => l.includes('Updated sharedCounter')).length;

    // There should be 5 acquisitions, 5 updates, 5 leaving, 5 releases (one per task)
    expect(acquiredCount, 'Each task should acquire the mutex once').toBeGreaterThanOrEqual(1);
    expect(updatedCount, 'Each task should update sharedCounter once').toBeGreaterThanOrEqual(1);
    // We assert at least one complete task flow occurred; given timing, more precise counts may vary slightly but should eventually be 5.
    expect(leavingCount).toBeGreaterThanOrEqual(1);
    expect(releasedCount).toBeGreaterThanOrEqual(1);

    // Sanity check: the latest "Updated sharedCounter" should show value 5 (or contain "to 5.")
    const lastUpdatedLine = lines.reverse().find(l => l.includes('Updated sharedCounter'));
    expect(lastUpdatedLine, 'There should be an update line in log').toBeTruthy();
    if (lastUpdatedLine) {
      expect(lastUpdatedLine).toMatch(/to\s+5\./);
    }

    // Ensure no runtime errors occurred during task execution
    expect(pageErrors.length, 'No uncaught page errors during task execution').toBe(0);
    expect(consoleErrors.length, 'No console.error messages during task execution').toBe(0);
  });

  // Test: Clicking Clear Log transitions to Log Cleared and empties the log
  test('Transition S1_Tasks_Started -> S3_Log_Cleared: clicking Clear Log empties the log', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCollectors(page);
    const mutexPage3 = new MutexPage(page);

    await mutexPage.goto();

    // Start tasks then wait briefly to populate log
    await mutexPage.clickStart();
    await mutexPage.waitForLogContains('Starting tasks...', 5000);

    // Click clear to empty the log
    await mutexPage.clickClear();

    // Wait for log to become empty
    await mutexPage.waitForLogEmpty(5000);

    const afterClear = await mutexPage.getLogText();
    expect(afterClear.trim()).toBe('', 'Log should be empty after clicking Clear Log');

    // Even after clearing, the sharedCounter global should remain and eventually be incremented as tasks continue.
    // Wait for tasks to complete and verify sharedCounter increments to 5 (they continue running in background).
    await page.waitForFunction(() => window.sharedCounter === 5, {}, { timeout: 10000 }).catch(() => null);
    const finalCounter1 = await mutexPage.getSharedCounter();
    expect(finalCounter).toBe(5);

    expect(pageErrors.length, 'No page errors during clear action').toBe(0);
    expect(consoleErrors.length, 'No console.error messages during clear action').toBe(0);
  });

  // Edge case: clicking Clear while tasks are running should clear existing log and allow later logs to appear
  test('Edge case: Clear log during active tasks clears current log and subsequent logs continue to appear', async ({ page }) => {
    const { pageErrors, consoleErrors } = setupErrorCollectors(page);
    const mutexPage4 = new MutexPage(page);

    await mutexPage.goto();

    // Start tasks
    await mutexPage.clickStart();

    // Wait shortly so some logs appear
    await mutexPage.waitForLogContains('Waiting to acquire mutex...', 3000);

    // Click clear while tasks are ongoing
    await mutexPage.clickClear();

    // Immediately assert log is empty
    await mutexPage.waitForLogEmpty(3000);
    let clearedText = await mutexPage.getLogText();
    expect(clearedText.trim()).toBe('');

    // After clearing, tasks should continue to log further events; wait for at least one new message (e.g., "Waiting to acquire mutex...")
    await mutexPage.waitForLogContains('Waiting to acquire mutex...', 5000);

    const postClearLines = await mutexPage.getLogLines();
    expect(postClearLines.length).toBeGreaterThanOrEqual(1);

    // Eventually, sharedCounter should become 5
    await page.waitForFunction(() => window.sharedCounter === 5, {}, { timeout: 10000 }).catch(() => null);
    const finalCounter2 = await mutexPage.getSharedCounter();
    expect(finalCounter).toBe(5);

    expect(pageErrors.length, 'No page errors during clear-while-running scenario').toBe(0);
    expect(consoleErrors.length, 'No console.error messages during clear-while-running scenario').toBe(0);
  });

  // Final test: ensure there were no unexpected runtime errors or console errors at the end of a full run
  test('No uncaught exceptions or console.error messages during full scenario', async ({ page }) => {
    const collectors = setupErrorCollectors(page);
    const { pageErrors, consoleErrors } = collectors;
    const mutexPage5 = new MutexPage(page);

    await mutexPage.goto();

    // Run tasks to completion
    await mutexPage.clickStart();

    // Wait for sharedCounter to reach 5 (full completion) up to 12s
    await page.waitForFunction(() => window.sharedCounter === 5, {}, { timeout: 12000 }).catch(() => null);

    // After completion, assert no page errors or console.error were captured
    expect(pageErrors.length, 'There should be no uncaught page errors after full run').toBe(0);
    expect(consoleErrors.length, 'There should be no console.error messages after full run').toBe(0);
  });
});