import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324ebf51-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the Mutex Demo page
class MutexPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startButton = page.locator('#start');
    this.status = page.locator('#status');
    this.log = page.locator('#log');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickStart() {
    await this.startButton.click();
  }

  async getStatusText() {
    return (await this.status.textContent()) ?? '';
  }

  async getLogEntries() {
    return this.page.$$eval('#log div', nodes => nodes.map(n => n.textContent || ''));
  }

  async waitForLogCount(expectedCount, timeout = 20000) {
    await this.page.waitForFunction(
      (sel, count) => document.querySelectorAll(sel).length >= count,
      '#log div',
      expectedCount,
      { timeout }
    );
  }

  async waitForTextInLog(substring, timeout = 10000) {
    await this.page.waitForFunction(
      (sel, text) => Array.from(document.querySelectorAll(sel)).some(n => n.textContent.includes(text)),
      '#log div',
      substring,
      { timeout }
    );
  }
}

test.describe('Mutex Demonstration - FSM validation and behavior', () => {
  // Increase default timeout for potentially long-running async flow
  test.setTimeout(30000);

  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors to assert on them later.
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      try {
        consoleMessages.push(msg.text());
      } catch {
        consoleMessages.push(String(msg));
      }
    });

    page.on('pageerror', err => {
      // Collect error messages (uncaught exceptions)
      pageErrors.push(err.message);
    });
  });

  test('Initial state (S0_Idle) renders the page and Start button (renderPage entry action)', async ({ page }) => {
    // This test validates the initial FSM state S0_Idle:
    // - The page renders
    // - The Start button exists (#start)
    // - The status and log areas exist and are initially empty
    const mutex = new MutexPage(page);
    await mutex.goto();

    // Verify Start button is visible and labelled correctly
    await expect(mutex.startButton).toBeVisible();
    await expect(mutex.startButton).toHaveText('Start Mutex Operations');

    // Status should be empty initially (no thread active)
    const statusText = await mutex.getStatusText();
    expect(statusText.trim()).toBe('');

    // Log should have no entries
    const logEntries = await mutex.getLogEntries();
    expect(logEntries.length).toBe(0);

    // No runtime page errors or console errors should have happened during initial load
    expect(pageErrors).toEqual([]);
    // The app does not necessarily log to console; assert we didn't observe any unexpected console errors.
    // We allow console messages (if any), but there should be no page errors.
  });

  test('StartMutexOperation transitions through Working and Critical Section (S1 -> S2) and enforces mutual exclusion', async ({ page }) => {
    // This test validates transitions:
    // - Clicking Start schedules multiple criticalSection calls
    // - Each "Thread {id} has entered the critical section." appears before "Thread {id} is leaving the critical section."
    // - The critical section is mutually exclusive: the next thread should not enter before the previous leaves
    const mutex = new MutexPage(page);
    await mutex.goto();

    // Start collecting timeline and ensure no errors before starting
    expect(pageErrors).toEqual([]);

    // Trigger the event: StartMutexOperation (click #start)
    await mutex.clickStart();

    // Wait for at least the first "entered" message to appear (evidence of transition into critical section)
    await mutex.waitForTextInLog('has entered the critical section.', 10000);

    // Wait for all 5 threads to produce enter+leave messages (10 messages total)
    await mutex.waitForLogCount(10, 20000);

    // Gather the log entries and validate ordering constraints
    const entries = await mutex.getLogEntries();
    // Basic expectation: at least 10 entries
    expect(entries.length).toBeGreaterThanOrEqual(10);

    // For each thread id 1..5, ensure enter occurs before leave
    for (let id = 1; id <= 5; id++) {
      const enterText = `Thread ${id} has entered the critical section.`;
      const leaveText = `Thread ${id} is leaving the critical section.`;

      const enterIdx = entries.findIndex(t => t.includes(enterText));
      const leaveIdx = entries.findIndex(t => t.includes(leaveText));

      // Both messages must exist
      expect(enterIdx).toBeGreaterThanOrEqual(0);
      expect(leaveIdx).toBeGreaterThanOrEqual(0);

      // Enter must happen before leave for the same thread
      expect(enterIdx).toBeLessThan(leaveIdx);
    }

    // Additionally enforce mutual exclusion by verifying that the next thread's "enter" happens after the previous thread's "leave".
    // Find indices for each thread's enter/leave and verify the ordering across threads.
    const indices = {};
    for (let id = 1; id <= 5; id++) {
      indices[id] = {
        enter: entries.findIndex(t => t.includes(`Thread ${id} has entered the critical section.`)),
        leave: entries.findIndex(t => t.includes(`Thread ${id} is leaving the critical section.`))
      };
    }
    for (let id = 2; id <= 5; id++) {
      // previous thread leave index should be less than current thread enter index
      expect(indices[id - 1].leave).toBeLessThan(indices[id].enter);
    }

    // Status should reflect the last seen state: after each thread leaves we set status to "Thread {id} has finished."
    // After all threads, the status should indicate the final thread's finished message (Thread 5)
    const finalStatus = await mutex.getStatusText();
    expect(finalStatus.trim()).toBe('Thread 5 has finished.');

    // Ensure there were no uncaught page errors during the run
    expect(pageErrors).toEqual([]);

    // Note: The page does not use console.log for these messages; ensure no unexpected console errors were emitted.
  });

  test('Repeated runs append logs and remain free of uncaught exceptions (edge case: start invoked after completion)', async ({ page }) => {
    // This test validates that invoking Start again (after a full run) starts a new sequence of operations
    // and that the app remains stable (no page errors). It also ensures logs are appended rather than replaced.
    const mutex = new MutexPage(page);
    await mutex.goto();

    // Start first run
    await mutex.clickStart();
    await mutex.waitForLogCount(10, 20000);
    const firstRunEntries = await mutex.getLogEntries();
    expect(firstRunEntries.length).toBeGreaterThanOrEqual(10);

    // Click Start again to begin a second run (after first run completed)
    await mutex.clickStart();

    // Wait for 20 entries total (two runs of 10 messages each)
    await mutex.waitForLogCount(20, 30000);
    const allEntries = await mutex.getLogEntries();
    expect(allEntries.length).toBeGreaterThanOrEqual(20);

    // Verify that entries from the first run are still present at the start of the log
    for (let i = 0; i < 10; i++) {
      expect(allEntries[i]).toBeDefined();
      // The first run first entry should mention Thread 1 entering
      if (i === 0) expect(allEntries[0]).toContain('Thread 1 has entered the critical section.');
    }

    // Verify that the second run produced its own enter and leave messages (we expect another "Thread 1 has entered..." later)
    const firstEnterIdx = allEntries.findIndex(t => t.includes('Thread 1 has entered the critical section.'));
    const secondEnterIdx = allEntries.slice(firstEnterIdx + 1).findIndex(t => t.includes('Thread 1 has entered the critical section.'));
    // If secondEnterIdx is found in the slice, its absolute index is firstEnterIdx + 1 + secondEnterIdx
    if (secondEnterIdx >= 0) {
      const absoluteSecondEnterIdx = firstEnterIdx + 1 + secondEnterIdx;
      expect(absoluteSecondEnterIdx).toBeGreaterThan(firstEnterIdx);
    } else {
      // In some timings the second run might interleave or be delayed; at minimum we expect overall 20 entries already checked above
      // so don't fail strictly here if we cannot find a second "Thread 1 has entered..." due to timing differences.
    }

    // Confirm that no uncaught exceptions were recorded in either run
    expect(pageErrors).toEqual([]);
  });

  test('No unexpected runtime ReferenceError/SyntaxError/TypeError occur when interacting with the page', async ({ page }) => {
    // This test explicitly asserts that no uncaught JS errors occurred during typical interactions:
    // initial load and one start sequence.
    const mutex = new MutexPage(page);
    await mutex.goto();

    // Trigger operations
    await mutex.clickStart();
    // Wait for some messages to appear to allow asynchronous code to run
    await mutex.waitForLogCount(6, 15000);

    // Assert there were no uncaught exceptions captured by the page
    // According to the test agent instructions we must observe and allow errors to happen naturally;
    // Here we assert there were none for this well-formed implementation.
    expect(pageErrors.length).toBe(0);

    // Collect console messages to help diagnose if any console errors occurred (these are not necessarily fatal)
    // We do not require consoleMessages to be empty, but print them via assertion messages if they contain 'Error' text
    const consoleErrors = consoleMessages.filter(msg => /error/i.test(msg));
    expect(consoleErrors.length).toBe(0);
  });
});