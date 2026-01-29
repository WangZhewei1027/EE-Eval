import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b2add4-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page object for the Monitor demo
class MonitorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startBtn = page.locator('#startBtn');
    this.notifyBtn = page.locator('#notifyBtn');
    this.notifyAllBtn = page.locator('#notifyAllBtn');
    this.log = page.locator('#log');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getLogText() {
    return (await this.log.evaluate(el => el.textContent)) || '';
  }

  // Wait until the log text contains the given substring (with timeout)
  async waitForLogContains(substring, opts = {}) {
    const timeout = opts.timeout ?? 5000;
    await this.page.waitForFunction(
      (sel, text) => {
        const el = document.querySelector(sel);
        return el && el.textContent.includes(text);
      },
      '#log',
      substring,
      { timeout }
    );
  }

  // Wait until the log contains all of the expected substrings
  async waitForAllLogContains(substrings, opts = {}) {
    const timeout1 = opts.timeout1 ?? 10000;
    const start = Date.now();
    while (true) {
      const text = await this.getLogText();
      const ok = substrings.every(s => text.includes(s));
      if (ok) return;
      if (Date.now() - start > timeout) {
        throw new Error(`Timed out waiting for log to contain all: ${JSON.stringify(substrings)}. Current log:\n${text}`);
      }
      await new Promise(r => setTimeout(r, 100));
    }
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickNotify() {
    // using click() on the button (it should be enabled when intended)
    await this.notifyBtn.click();
  }

  async clickNotifyAll() {
    await this.notifyAllBtn.click();
  }
}

test.describe('Monitor Concept Demonstration (FSM validation)', () => {
  /** Collect console error messages and page errors for each test */
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error' || /ReferenceError|TypeError|SyntaxError/.test(msg.text())) {
        consoleErrors.push({ type: msg.type(), text: msg.text() });
      }
    });

    // listen for uncaught exceptions in the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the demo page
    const monitor = new MonitorPage(page);
    await monitor.goto();
  });

  test.afterEach(async () => {
    // Assert that there were no console errors or page errors unless a test explicitly expects them
    expect(consoleErrors, `Page console errors:\n${consoleErrors.map(e => e.text).join('\n')}`).toEqual([]);
    expect(pageErrors, `Page uncaught errors:\n${pageErrors.map(e => e.toString()).join('\n')}`).toEqual([]);
  });

  test('Initial state (S0_Idle) - log cleared and UI buttons states', async ({ page }) => {
    // This test validates the Idle state evidence: resetDemo() cleared the log and initial button states.
    const monitor1 = new MonitorPage(page);

    // Verify log is empty at load (S0_Idle evidence)
    const initialLog = await monitor.getLogText();
    expect(initialLog).toBe('', 'Expected log to be empty on initial load (Idle state evidence).');

    // Verify button states: Start enabled, notify buttons disabled
    await expect(monitor.startBtn).toBeEnabled();
    await expect(monitor.notifyBtn).toBeDisabled();
    await expect(monitor.notifyAllBtn).toBeDisabled();
  });

  test('StartThreads -> transitions to Working and Waiting (S1_Working and S2_Waiting evidence)', async ({ page }) => {
    // This test validates that clicking Start Threads spawns 3 workers and they enter monitor and wait.
    const monitor2 = new MonitorPage(page);

    // Click start and wait for "Starting workers..." to appear
    await monitor.clickStart();
    await monitor.waitForLogContains('Starting workers...', { timeout: 2000 });

    // Wait for evidence that all three workers entered monitor and then waited
    // We ensure all "Entered monitor." and "Resource not ready, waiting..." lines for workers 1..3 appear.
    const expectedLines = [
      'Worker #1: Entered monitor.',
      'Worker #2: Entered monitor.',
      'Worker #3: Entered monitor.',
      'Worker #1: Resource not ready, waiting...',
      'Worker #2: Resource not ready, waiting...',
      'Worker #3: Resource not ready, waiting...'
    ];
    await monitor.waitForAllLogContains(expectedLines, { timeout: 10000 });

    // After starting, Start button should be disabled (the handler disables it)
    await expect(monitor.startBtn).toBeDisabled();

    // Notify buttons should have been enabled by resetDemo() at the start of the handler
    await expect(monitor.notifyBtn).toBeEnabled();
    await expect(monitor.notifyAllBtn).toBeEnabled();

    // Check that the log contains the FSM evidence strings for S1 and S2 states
    const logText = await monitor.getLogText();
    expect(logText.includes('Entered monitor'), 'Expected "Entered monitor" messages for workers.').toBeTruthy();
    expect(logText.includes('Resource not ready, waiting...'), 'Expected "Resource not ready, waiting..." messages for workers.').toBeTruthy();
  });

  test('NotifyOne - wakes a single worker and causes it to process (transition S2 -> S1)', async ({ page }) => {
    // This test ensures that when all workers are waiting, clicking Notify One wakes a single worker,
    // the main logs the action, and one worker proceeds to process the resource.
    const monitor3 = new MonitorPage(page);

    // Start the workers and wait until all are waiting (ensure all enqueued to conditionQueue)
    await monitor.clickStart();
    await monitor.waitForAllLogContains([
      'Worker #1: Resource not ready, waiting...',
      'Worker #2: Resource not ready, waiting...',
      'Worker #3: Resource not ready, waiting...'
    ], { timeout: 10000 });

    // Click notify one
    await monitor.clickNotify();

    // Verify main log entry indicating shared resource set to ready and notify one
    await monitor.waitForLogContains('Main: Shared resource set to ready. Notifying one worker.', { timeout: 2000 });

    // At least one worker should log "Notified, rechecking resource." and then "Resource ready! Processing..."
    await monitor.waitForLogContains('Notified, rechecking resource.', { timeout: 5000 });
    await monitor.waitForLogContains('Resource ready! Processing...', { timeout: 7000 });

    // And that processing completes for at least one worker ("Done processing.")
    await monitor.waitForLogContains('Done processing.', { timeout: 10000 });

    // Ensure not all workers were necessarily processed by a single notify (we expect at least one done)
    const logText1 = await monitor.getLogText();
    const doneCount = (logText.match(/Done processing\./g) || []).length;
    expect(doneCount).toBeGreaterThanOrEqual(1);

    // Verify FSM evidence: a worker logged "Notified, rechecking resource." which matches transition evidence
    expect(logText.includes('Notified, rechecking resource.'), 'Expected worker to log that it was notified and rechecking.').toBeTruthy();
  });

  test('NotifyAll - wakes all waiting workers and they all process (S1_Working self-transition evidence)', async ({ page }) => {
    // This test ensures that clicking Notify All wakes all waiting workers.
    // IMPORTANT: We wait for all workers to reach waiting state before notifying to avoid missed notifications.
    const monitor4 = new MonitorPage(page);

    // Start workers and wait until all are waiting
    await monitor.clickStart();
    await monitor.waitForAllLogContains([
      'Worker #1: Resource not ready, waiting...',
      'Worker #2: Resource not ready, waiting...',
      'Worker #3: Resource not ready, waiting...'
    ], { timeout: 10000 });

    // Click notifyAll to wake all of them
    await monitor.clickNotifyAll();

    // Verify the main log entry for notifyAll
    await monitor.waitForLogContains('Main: Shared resource set to ready. Notifying ALL workers.', { timeout: 2000 });

    // Each worker should log "Notified, rechecking resource." and then "Resource ready! Processing..." and "Done processing."
    await monitor.waitForAllLogContains([
      'Worker #1: Notified, rechecking resource.',
      'Worker #2: Notified, rechecking resource.',
      'Worker #3: Notified, rechecking resource.',
      'Worker #1: Resource ready! Processing...',
      'Worker #2: Resource ready! Processing...',
      'Worker #3: Resource ready! Processing...',
      'Worker #1: Done processing.',
      'Worker #2: Done processing.',
      'Worker #3: Done processing.'
    ], { timeout: 20000 });

    // Confirm counts: three "Notified" and three "Done processing"
    const logText2 = await monitor.getLogText();
    const notifiedCount = (logText.match(/Notified, rechecking resource\./g) || []).length;
    const doneCount1 = (logText.match(/Done processing\./g) || []).length;
    expect(notifiedCount).toBeGreaterThanOrEqual(3);
    expect(doneCount).toBeGreaterThanOrEqual(3);
  });

  test('Edge cases: notify buttons are disabled before starting and clicking disabled should be prevented', async ({ page }) => {
    // Validate edge case behavior: notify buttons are disabled before starting and cannot be used.
    const monitor5 = new MonitorPage(page);

    // Initially notify buttons disabled
    await expect(monitor.notifyBtn).toBeDisabled();
    await expect(monitor.notifyAllBtn).toBeDisabled();

    // Attempting to click a disabled button should throw in Playwright; instead assert disabled prevents interaction.
    let threw = false;
    try {
      await monitor.notifyBtn.click({ timeout: 1000 });
    } catch (e) {
      threw = true;
    }
    expect(threw).toBeTruthy();

    // Start and then ensure notify buttons enable (sanity)
    await monitor.clickStart();
    await monitor.waitForLogContains('Starting workers...', { timeout: 2000 });
    await expect(monitor.notifyBtn).toBeEnabled();
    await expect(monitor.notifyAllBtn).toBeEnabled();
  });

  test('No unexpected runtime errors in console or uncaught page errors during typical interactions', async ({ page }) => {
    // This test performs a sequence of interactions and asserts no console errors or uncaught page errors are emitted.
    // Note: afterEach already asserts no errors, but here we exercise typical sequence to observe console.
    const monitor6 = new MonitorPage(page);

    // Start, wait until all waiting, notify one, wait for at least one done, then notify all for remaining workers.
    await monitor.clickStart();
    await monitor.waitForAllLogContains([
      'Worker #1: Resource not ready, waiting...',
      'Worker #2: Resource not ready, waiting...',
      'Worker #3: Resource not ready, waiting...'
    ], { timeout: 10000 });

    await monitor.clickNotify();
    await monitor.waitForLogContains('Resource ready! Processing...', { timeout: 7000 });

    // After one processed, notifyAll to finish remaining
    await monitor.clickNotifyAll();
    await monitor.waitForAllLogContains([
      'Notifying ALL workers',
      'Done processing.'
    ], { timeout: 20000 });

    // The afterEach will validate no console/page errors occurred.
  });
});