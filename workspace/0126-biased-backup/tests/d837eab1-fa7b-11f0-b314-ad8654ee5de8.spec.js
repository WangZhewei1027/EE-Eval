import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d837eab1-fa7b-11f0-b314-ad8654ee5de8.html';

// Page object for the small semaphore demo
class DemoPage {
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runDemo');
    this.log = page.locator('#log');
    // capture raw text quickly
    this.logHandle = () => this.page.locator('#log');
  }

  // Click run demo button
  async clickRun() {
    await this.runBtn.click();
  }

  // Return current log text (full textContent)
  async getLogText() {
    return (await this.log.evaluate(el => el.textContent)) || '';
  }

  // Wait until log contains `substring`
  async waitForLogContains(substring, opts = {}) {
    const timeout = opts.timeout ?? 3000;
    await this.page.waitForFunction(
      (sel, text) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.indexOf(text) !== -1;
      },
      '#log',
      substring,
      { timeout }
    );
  }

  // Count how many times a substring occurs in the log
  async countLogOccurrences(substring) {
    const text = await this.getLogText();
    if (!substring) return 0;
    return (text.match(new RegExp(substring.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  }

  // Check if run button is disabled
  async isRunButtonDisabled() {
    return await this.runBtn.evaluate((btn) => btn.disabled === true);
  }
}

test.describe('Semaphore Demo (d837eab1-fa7b-11f0-b314-ad8654ee5de8) - FSM validation', () => {
  // Arrays to collect console messages & page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Observe console messages
    page.on('console', (msg) => {
      // store type and text for assertions later
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Observe page errors (uncaught exceptions etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app page
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // no-op; we want page fixtures to auto-close
  });

  test('Initial state S0_Idle: button present, enabled and initial log text', async ({ page }) => {
    // Validate Idle state and renderPage() entry action by DOM presence
    const demo = new DemoPage(page);

    // The Run button must be visible and enabled
    await expect(demo.runBtn).toBeVisible();
    await expect(demo.runBtn).toBeEnabled();

    // The log should contain the initial instructional text
    const initialLog = await demo.getLogText();
    expect(initialLog).toContain('Demo log will appear here.');
    expect(initialLog).toContain('Click "Run Simple Demo" to simulate two workers using a semaphore initialized to 1');

    // Ensure no page errors or console error messages at initial load
    const consoleErrors = consoleMessages.filter(c => c.type === 'error');
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0 -> S1 (RunDemo): clicking run starts demo, clears log and disables button', async ({ page }) => {
    // This test verifies the RunDemo event and its observable effects described in the FSM:
    // - runDemoOnce() invoked (observed by 'Simulation start' entry log)
    // - button gets disabled
    // - log is reset before appending new messages

    const demo = new DemoPage(page);

    // Ensure initial content present
    const beforeClick = await demo.getLogText();
    expect(beforeClick).toContain('Demo log will appear here.');

    // Click run
    await demo.clickRun();

    // Immediately after click: button should be disabled
    expect(await demo.isRunButtonDisabled()).toBe(true);

    // Immediately after click: log should have been cleared and new simulation start message appended
    await demo.waitForLogContains('Simulation start — binary semaphore initialized to 1', { timeout: 2000 });
    const logText = await demo.getLogText();
    // The implementation prefixes messages with time [HH:MM:SS] so we assert substring
    expect(logText).toContain('Simulation start — binary semaphore initialized to 1');

    // Verify that the previous instructional text is not present (log reset)
    expect(logText).not.toContain('Demo log will appear here.');

    // Check no unexpected console errors or page errors during start
    const consoleErrs = consoleMessages.filter(c => c.type === 'error');
    expect(consoleErrs.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('States S2 and S3: Worker-A and Worker-B enter critical section in correct order (mutual exclusion)', async ({ page }) => {
    // Validate that Worker-A enters first, Worker-B attempts then later also enters after A leaves.
    // This tests the semaphore behavior and the FSM transitions from DemoRunning -> WorkerA_Entered and -> WorkerB_Entered.

    const demo = new DemoPage(page);

    // Start demo
    await demo.clickRun();

    // Wait for Worker-A enter message
    await demo.waitForLogContains('Worker-A: entered critical section', { timeout: 3000 });
    const afterAEnter = await demo.getLogText();
    expect(afterAEnter).toContain('Worker-A: entered critical section');

    // Worker-B attempting to enter should be logged (blocked) earlier than B entering; assert the attempt message exists
    expect(afterAEnter).toContain('Worker-B: attempting to enter critical section');

    // Worker-B should not enter before Worker-A leaves; to validate, ensure 'Worker-B: entered critical section'
    // appears only after 'Worker-A: leaving critical section' OR at least later in the log ordering.
    // Wait for Worker-A leaving message
    await demo.waitForLogContains('Worker-A: leaving critical section', { timeout: 4000 });
    const afterALeave = await demo.getLogText();
    expect(afterALeave).toContain('Worker-A: leaving critical section');

    // Now Worker-B should enter (some time after A leaves)
    await demo.waitForLogContains('Worker-B: entered critical section', { timeout: 3000 });
    const afterBEnter = await demo.getLogText();
    expect(afterBEnter).toContain('Worker-B: entered critical section');

    // Confirm ordering: position of the substrings in log text
    const full = afterBEnter;
    const idxAEnter = full.indexOf('Worker-A: entered critical section');
    const idxALeave = full.indexOf('Worker-A: leaving critical section');
    const idxBEnter = full.indexOf('Worker-B: entered critical section');

    expect(idxAEnter).toBeGreaterThan(-1);
    expect(idxALeave).toBeGreaterThan(idxAEnter);
    expect(idxBEnter).toBeGreaterThan(idxALeave);

    // Ensure no console errors occurred
    const consoleErrs = consoleMessages.filter(c => c.type === 'error');
    expect(consoleErrs.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('States S4 and S5 and transition back to S1: Workers leave and simulation completes; button re-enabled', async ({ page }) => {
    // This test verifies Worker-A leaving (S4), Worker-B leaving (S5), and the final ContinueDemo transition
    // which appends 'Simulation complete.' and re-enables the Run button.

    const demo = new DemoPage(page);

    // Start demo run
    await demo.clickRun();

    // Wait for both leaving messages to appear
    await demo.waitForLogContains('Worker-A: leaving critical section', { timeout: 4000 });
    await demo.waitForLogContains('Worker-B: leaving critical section', { timeout: 6000 });

    // Finally, the simulation complete message should be appended
    await demo.waitForLogContains('Simulation complete.', { timeout: 3000 });

    const finalLog = await demo.getLogText();
    expect(finalLog).toContain('Simulation complete.');

    // After completion, the button should be re-enabled — representing return to DemoRunning / Idle as appropriate
    // (The FSM describes returning to DemoRunning and enabling the button)
    // Wait for the button to be enabled again (demo uses setTimeout 900ms; allow more)
    await expect(demo.runBtn).toBeEnabled({ timeout: 3000 });

    // No page errors or console errors
    const consoleErrs = consoleMessages.filter(c => c.type === 'error');
    expect(consoleErrs.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: clicking the Run button twice rapidly should only start a single demo run', async ({ page }) => {
    // The button is disabled at the start of runDemoOnce; assert that a rapid double-click doesn't start two demos
    // We'll click twice in quick succession and assert that "Simulation start ..." occurs only once.

    const demo = new DemoPage(page);

    // Rapidly click twice: the second click should have no additional effect because the button is disabled in the handler
    await Promise.all([
      demo.runBtn.click(),
      demo.runBtn.click().catch(() => { /* second click may be ignored, swallow any click rejection */ })
    ]);

    // Wait for the simulation start message
    await demo.waitForLogContains('Simulation start — binary semaphore initialized to 1', { timeout: 2000 });

    // Count how many times the simulation start message appears
    const occurrences = await demo.countLogOccurrences('Simulation start — binary semaphore initialized to 1');
    expect(occurrences).toBe(1);

    // Also ensure there is only one 'Simulation complete.' occurrence after the run completes
    await demo.waitForLogContains('Simulation complete.', { timeout: 1500 + 2000 }); // allow for longer end timing
    const completeOccurrences = await demo.countLogOccurrences('Simulation complete.');
    expect(completeOccurrences).toBe(1);

    // Confirm no console errors or page errors
    const consoleErrs = consoleMessages.filter(c => c.type === 'error');
    expect(consoleErrs.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Robustness: ensure no ReferenceError / SyntaxError / TypeError occurred during demo run', async ({ page }) => {
    // This test explicitly inspects captured page errors & console error messages to assert that no common JS runtime errors occurred.
    const demo = new DemoPage(page);

    // Run the demo to exercise code paths
    await demo.clickRun();

    // Wait for simulation to complete
    await demo.waitForLogContains('Simulation complete.', { timeout: 4000 });

    // Inspect pageErrors captured from 'pageerror' events
    // We expect zero pageErrors; if any exist, assert their types
    if (pageErrors.length > 0) {
      // If errors exist, fail with diagnostic details
      const errNames = pageErrors.map(e => e.name + ': ' + e.message).join('\n---\n');
      throw new Error('Page errors were detected during demo run:\n' + errNames);
    }

    // Inspect console error messages (console.error)
    const consoleErrs = consoleMessages.filter(c => c.type === 'error');
    if (consoleErrs.length > 0) {
      const texts = consoleErrs.map(c => c.text).join('\n---\n');
      throw new Error('Console error messages detected during demo run:\n' + texts);
    }

    // If we reached here, no ReferenceError/SyntaxError/TypeError were observed
    expect(pageErrors.length).toBe(0);
    expect(consoleErrs.length).toBe(0);
  });
});