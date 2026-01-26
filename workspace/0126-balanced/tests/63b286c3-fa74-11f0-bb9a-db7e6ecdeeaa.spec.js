import { test, expect } from '@playwright/test';

// Test file for Application ID: 63b286c3-fa74-11f0-bb9a-db7e6ecdeeaa
// Served at: http://127.0.0.1:5500/workspace/0126-balanced/html/63b286c3-fa74-11f0-bb9a-db7e6ecdeeaa.html
// This suite validates the FSM states: Idle (S0_Idle), Computing (S1_Computing), Completed (S2_Completed)
// It verifies transitions StartComputation, WorkerProgress, WorkerDone and the onEnter/onExit logging behavior.
// NOTE: We do not modify the page; we observe console messages and page errors and assert expected behavior.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b286c3-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Simple Page Object to encapsulate selectors and common actions
class ThreadDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.logEl = page.locator('#log');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async getLogText() {
    return await this.logEl.evaluate((el) => el.textContent || '');
  }

  async isStartDisabled() {
    return await this.startBtn.evaluate((btn) => btn.disabled);
  }
}

test.describe('Thread Concept Demonstration - FSM states and transitions', () => {
  // Increase default timeout because the worker computes a large prime count (may take several seconds)
  test.setTimeout(120000); // 2 minutes per test file

  // Arrays to capture runtime console messages and page errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for later assertions
    page.on('console', (msg) => {
      // store text for assertion; include type to make debugging easier
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case msg.text() throws, still push basic string
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture page errors (unhandled exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('Initial Idle state: page renders start button and empty log', async ({ page }) => {
    // Validate S0_Idle entry actions: renderPage() implies start button present and log exists/empty
    const model = new ThreadDemoPage(page);
    await model.goto();

    // Verify start button is visible and enabled
    await expect(model.startBtn).toBeVisible();
    await expect(model.startBtn).toBeEnabled();

    // Verify log element exists and is empty initially
    const initialLog = await model.getLogText();
    expect(initialLog).toBe('');

    // Ensure no unexpected page errors on load
    expect(pageErrors.length).toBe(0);

    // There may be no console messages on load; assert we captured zero or more but no errors
    const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
  });

  test('StartComputation transition: clicking start enters Computing state', async ({ page }) => {
    // This validates transition from S0_Idle -> S1_Computing:
    // - logEl.textContent should be cleared,
    // - "Main thread: Starting heavy computation in worker thread..." should appear,
    // - startBtn should become disabled
    const model = new ThreadDemoPage(page);
    await model.goto();

    // Precondition: ensure log has something before click to prove it gets cleared.
    // We set some text by clicking start then reloading to set up test? Instead, directly verify clearing happens on click.
    // Click start
    await model.clickStart();

    // Immediately after click, log should have been reset and then the main thread message appended
    await expect(model.logEl).toContainText('Main thread: Starting heavy computation in worker thread...');

    // Start button should be disabled during computation
    await expect(model.startBtn).toBeDisabled();

    // Ensure the DOM contained the expected entry action text (evidence)
    const logContent = await model.getLogText();
    expect(logContent.includes('Main thread: Starting heavy computation in worker thread...')).toBe(true);

    // No page-level JS errors should have occurred just by starting
    expect(pageErrors.length).toBe(0);
  });

  test('WorkerProgress events produce progress messages and stay in Computing state', async ({ page }) => {
    // Validates WorkerProgress messages (S1_Computing -> S1_Computing)
    // We click start and wait for at least one progress message to appear in the log.
    const model = new ThreadDemoPage(page);
    await model.goto();

    // Click to start computation
    await model.clickStart();

    // Wait for a progress log entry - worker posts progress every ~10% of the range
    // This can take some time; allow a generous timeout
    await page.waitForFunction(() => {
      const el = document.getElementById('log');
      return el && el.textContent && /Worker thread: Progress \d+%/.test(el.textContent);
    }, { timeout: 60000 });

    // Assert that at least one 'Progress' message exists in the log
    const logText = await model.getLogText();
    const progressMatches = logText.match(/Worker thread: Progress \d+%/g) || [];
    expect(progressMatches.length).toBeGreaterThanOrEqual(1);

    // While progress messages are being received, the start button should still be disabled
    expect(await model.isStartDisabled()).toBe(true);

    // No page errors were thrown while processing progress events
    expect(pageErrors.length).toBe(0);
  });

  test('WorkerDone transition: computation completes and UI returns to idle (Completed state)', async ({ page }) => {
    // Validates S1_Computing -> S2_Completed transition:
    // - Worker posts done message and primes count
    // - Log contains the 'Computation done' message and 'Worker thread finished' entry action
    // - startBtn is re-enabled
    // - main thread logs 'UI ready for next task.'
    const model = new ThreadDemoPage(page);
    await model.goto();

    // Start computation
    await model.clickStart();

    // Wait for 'Computation done' message in log - allow ample time for worker to finish
    await page.waitForFunction(() => {
      const el = document.getElementById('log');
      return el && el.textContent && /Worker thread: Computation done! Number of primes found: \d+/.test(el.textContent);
    }, { timeout: 120000 });

    // Once done, the main thread also logs that worker finished and enables the button
    const finalLog = await model.getLogText();

    // Check presence of the worker done message and the main-thread finished log
    expect(finalLog).toMatch(/Worker thread: Computation done! Number of primes found: \d+/);
    expect(finalLog).toContain('Main thread: Worker thread finished computation.');

    // After worker termination, start button must be enabled again (S2_Completed exit to Idle)
    await expect(model.startBtn).toBeEnabled();

    // The background interval logs 'Main thread: UI ready for next task.' after the button is enabled
    expect(finalLog).toContain('Main thread: UI ready for next task.');

    // Ensure primes number is a positive integer in the log message
    const match = finalLog.match(/Number of primes found: (\d+)/);
    expect(match).not.toBeNull();
    const primesCount = parseInt(match[1], 10);
    expect(Number.isInteger(primesCount)).toBe(true);
    expect(primesCount).toBeGreaterThanOrEqual(0);

    // Ensure no unhandled page errors occurred during the run
    expect(pageErrors.length).toBe(0);
  }, 120000);

  test('Edge case: attempting to click Start while disabled does not duplicate start action', async ({ page }) => {
    // Validates that clicking the disabled button (or trying to) does not trigger the StartComputation transition again.
    // We capture console messages to count occurrences of the main start message in DOM log.
    const model = new ThreadDemoPage(page);
    await model.goto();

    // Start once
    await model.clickStart();

    // Immediately attempt another click (should be ignored because button is disabled)
    // Use JavaScript to attempt to trigger a click regardless of disabled state to ensure page logic isn't susceptible.
    // We will not patch functions; we simply try to dispatch native click which should have no effect when disabled.
    await page.evaluate(() => {
      const btn = document.getElementById('startBtn');
      if (btn) {
        // Try to dispatch a click event directly
        const ev = new MouseEvent('click', { bubbles: true, cancelable: true, composed: true });
        btn.dispatchEvent(ev);
      }
    });

    // Wait for first progress to appear to ensure worker started only once
    await page.waitForFunction(() => {
      const el = document.getElementById('log');
      return el && /Main thread: Starting heavy computation in worker thread.../.test(el.textContent);
    }, { timeout: 30000 });

    // Count occurrences of the starting message in the log; should be exactly 1
    const logText = await model.getLogText();
    const startCount = (logText.match(/Main thread: Starting heavy computation in worker thread.../g) || []).length;
    expect(startCount).toBe(1);

    // Additionally ensure start button stayed disabled until worker done
    expect(await model.isStartDisabled()).toBe(true);

    // No page errors introduced by attempting the second click
    expect(pageErrors.length).toBe(0);
  });

  test('Robustness: full run should not generate JS runtime errors (pageerror)', async ({ page }) => {
    // This test captures and asserts that no unhandled exceptions (pageerror) occur during a full run.
    const model = new ThreadDemoPage(page);
    await model.goto();

    // Start computation and wait for completion
    await model.clickStart();

    await page.waitForFunction(() => {
      const el = document.getElementById('log');
      return el && /Worker thread: Computation done! Number of primes found: \d+/.test(el.textContent);
    }, { timeout: 120000 });

    // Assert no page errors were captured
    // We intentionally "observe console logs and page errors" per instructions and confirm none happened
    expect(pageErrors.length).toBe(0);
  }, 120000);

  test('Observability: console capture contains zero error-type entries during a normal run', async ({ page }) => {
    // Verify we did not capture console.error messages during normal operation
    const model = new ThreadDemoPage(page);
    await model.goto();

    await model.clickStart();

    // Wait for worker done
    await page.waitForFunction(() => {
      const el = document.getElementById('log');
      return el && /Worker thread: Computation done! Number of primes found: \d+/.test(el.textContent);
    }, { timeout: 120000 });

    // Filter console messages for errors
    const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    // We expect zero error/warning console entries for this demo
    expect(errorConsoleEntries.length).toBe(0);
  }, 120000);
});