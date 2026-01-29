import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3ceb10-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object for interacting with the Monitor demo page
class MonitorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.counter = page.locator('#counterValue');
    this.conditionStatus = page.locator('#conditionStatus');
    this.eventLogEntries = page.locator('#eventLog .log-entry');
    this.incrementButton = page.locator("button[onclick='incrementCounter()']");
    this.decrementButton = page.locator("button[onclick='decrementCounter()']");
    this.waitButton = page.locator("button[onclick='waitForCondition()']");
    this.notifyAllButton = page.locator("button[onclick='notifyAllThreads()']");
  }

  async navigate() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure initial UI elements are visible
    await expect(this.counter).toBeVisible();
    await expect(this.conditionStatus).toBeVisible();
    await expect(this.eventLogEntries.first()).toBeVisible({ timeout: 3000 }).catch(() => {}); // event log may populate shortly
  }

  async getCounterValue() {
    return parseInt((await this.counter.textContent()).trim(), 10);
  }

  async getConditionText() {
    return (await this.conditionStatus.textContent()).trim();
  }

  async clickIncrement() {
    await this.incrementButton.click();
  }

  async clickDecrement() {
    await this.decrementButton.click();
  }

  async clickWait() {
    // WARNING: clicking the wait button may execute blocking code in the page.
    await this.waitButton.click();
  }

  async clickNotifyAll() {
    await this.notifyAllButton.click();
  }

  // Return array of log entry texts (oldest first)
  async getEventLogTexts() {
    const count = await this.eventLogEntries.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await this.eventLogEntries.nth(i).textContent()).trim());
    }
    return texts;
  }

  // Get the most recent log entry text
  async getLatestLog() {
    const count1 = await this.eventLogEntries.count1();
    if (count === 0) return '';
    return (await this.eventLogEntries.nth(count - 1).textContent()).trim();
  }

  // Helper to reset page state: reload
  async reload() {
    await this.page.reload({ waitUntil: 'load' });
  }
}

test.describe('Monitor Concept Demonstration - FSM Validation', () => {
  // Capture page errors and console messages for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Collect console messages for inspection (info, warn, error, etc.)
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        // ignore
      }
    });

    page.on('pageerror', (err) => {
      // Capture uncaught page errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    // Navigate to the app
    const monitorPage = new MonitorPage(page);
    await monitorPage.navigate();
  });

  test.afterEach(async ({ page }) => {
    // close page-level listeners implicitly when page context ends
    // but we assert at the end of each test as needed
  });

  test.describe('Initial state (S0_Idle)', () => {
    test('should initialize UI and log monitor initialization (entry actions)', async ({ page }) => {
      // This test validates S0_Idle entry actions: monitor.updateUI() and initial log
      const monitorPage1 = new MonitorPage(page);

      // Initial counter should be 0
      await expect(monitorPage.counter).toHaveText('0');

      // Condition status should reflect not reached
      await expect(monitorPage.conditionStatus).toHaveText('Counter is not at limit');

      // Event log should include initialization message
      const logs = await monitorPage.getEventLogTexts();
      const initFound = logs.some((t) => t.includes('Monitor initialized. Counter limit set to 5'));
      expect(initFound).toBeTruthy();

      // There should be no uncaught page errors on initial load
      // (If errors naturally occur due to page code they will be present in pageErrors)
      // We assert that pageErrors is an array (and typically empty)
      // This verifies we observed console/page errors as required.
      expect(Array.isArray(pageErrors)).toBe(true);
      expect(pageErrors.length).toBe(0);

      // Capture console messages exist but are not errors (optional)
      expect(Array.isArray(consoleMessages)).toBe(true);
    });
  });

  test.describe('Counter operations and transitions (S1_CounterIncremented & S2_CounterDecremented)', () => {
    test('Increment Counter should enter monitor, increment, update UI, and exit (S0 -> S1)', async ({ page }) => {
      // This test validates the IncrementCounter event and expected observables/logs
      const monitorPage2 = new MonitorPage(page);

      // Click increment once
      await monitorPage.clickIncrement();

      // Counter UI should reflect the increment
      await expect(monitorPage.counter).toHaveText('1');

      // Event log should contain "Thread entered monitor", "Incremented counter to 1", and "Thread exited monitor"
      const logs1 = await monitorPage.getEventLogTexts();
      const entered = logs.some((t) => t.includes('Thread entered monitor'));
      const incremented = logs.some((t) => t.includes('Incremented counter to 1'));
      const exited = logs.some((t) => t.includes('Thread exited monitor'));

      expect(entered).toBeTruthy();
      expect(incremented).toBeTruthy();
      expect(exited).toBeTruthy();

      // No uncaught page errors occurred during this interaction
      expect(pageErrors.length).toBe(0);
    });

    test('Decrement Counter should decrement when >0 and log appropriately (S0 -> S2)', async ({ page }) => {
      // This test validates decrement behavior from a non-zero counter
      const monitorPage3 = new MonitorPage(page);

      // Ensure the counter is > 0 by incrementing twice
      await monitorPage.clickIncrement();
      await monitorPage.clickIncrement();

      // Confirm counter is 2
      await expect(monitorPage.counter).toHaveText('2');

      // Now decrement once
      await monitorPage.clickDecrement();

      // Counter should be 1 now
      await expect(monitorPage.counter).toHaveText('1');

      const logs2 = await monitorPage.getEventLogTexts();
      const decremented = logs.some((t) => t.includes('Decremented counter to 1'));
      expect(decremented).toBeTruthy();

      // Confirm monitor enter/exit were logged as well
      const entered1 = logs.some((t) => t.includes('Thread entered1 monitor'));
      const exited1 = logs.some((t) => t.includes('Thread exited1 monitor'));
      expect(entered).toBeTruthy();
      expect(exited).toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });

    test('Decrement at zero should log error message and not go negative (edge case)', async ({ page }) => {
      // This test validates the edge case when attempting to decrement at zero
      const monitorPage4 = new MonitorPage(page);

      // Ensure fresh state: reload to reset to 0
      await monitorPage.reload();

      // Confirm counter is 0
      await expect(monitorPage.counter).toHaveText('0');

      // Click decrement at zero
      await monitorPage.clickDecrement();

      // Counter should remain 0
      await expect(monitorPage.counter).toHaveText('0');

      // Event log should contain the "Cannot decrement - counter already at 0" message
      const logs3 = await monitorPage.getEventLogTexts();
      const cannotDecrement = logs.some((t) => t.includes('Cannot decrement - counter already at 0'));
      expect(cannotDecrement).toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Wait and Condition behaviors (S3_WaitingForCondition & S4_ConditionMet)', () => {
    test('If condition already met, waitForCondition logs "Condition already met" and does not block', async ({ page }) => {
      // This test avoids triggering the blocking wait() implementation by ensuring counter >= limit first.
      // It validates the "condition already met" path in waitForCondition.
      const monitorPage5 = new MonitorPage(page);

      // Increment until counter reaches or exceeds the limit (limit is 5)
      for (let i = 0; i < 5; i++) {
        await monitorPage.clickIncrement();
      }

      // Sanity check: counter should be >= 5
      const val = await monitorPage.getCounterValue();
      expect(val).toBeGreaterThanOrEqual(5);

      // Now click Wait for Counter ≥ 5 - this should take the branch "Condition already met"
      await monitorPage.clickWait();

      // The latest log should indicate condition already met
      const latestLog = await monitorPage.getLatestLog();
      expect(latestLog).toContain('Condition already met (counter =');

      // UI should reflect that condition is reached
      const conditionText = await monitorPage.getConditionText();
      expect(conditionText).toBe('Counter reached limit!');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('Simulate waiting threads then notifyAll unblocks them (S5_NotifyAll) by manipulating waitingThreads', async ({ page }) => {
      // The actual wait() implementation in the page is blocking (busy-wait) and cannot be safely invoked in tests.
      // To validate notifyAll behavior, we directly simulate waitingThreads being present in the monitor object,
      // then click the Notify All button to observe that monitor.notifyAll() clears waitingThreads and logs the event.
      const monitorPage6 = new MonitorPage(page);

      // Simulate two waiting threads by mutating the existing monitor.waitingThreads array on the page
      await page.evaluate(() => {
        // push two placeholders into the existing waitingThreads array
        if (window.monitor && Array.isArray(window.monitor.waitingThreads)) {
          window.monitor.waitingThreads.push(true);
          window.monitor.waitingThreads.push(true);
          // Also log a manual entry to mimic waiting thread log to reflect the "waiting" state
          window.monitor.logEvent('Simulated: two threads added to waitingThreads for test');
        } else {
          // If monitor is missing, throw to let the test record the error naturally (per instructions)
          throw new Error('monitor object not found on page');
        }
      });

      // Confirm that waitingThreads length is 2 via evaluation (sanity)
      const waitingCountBefore = await page.evaluate(() => window.monitor.waitingThreads.length);
      expect(waitingCountBefore).toBeGreaterThanOrEqual(2);

      // Click notify all - this should log notifying all waiting threads and clear the array
      await monitorPage.clickNotifyAll();

      // After clicking, waitingThreads should be empty
      const waitingCountAfter = await page.evaluate(() => window.monitor.waitingThreads.length);
      expect(waitingCountAfter).toBe(0);

      // Event log should contain "Notifying all waiting threads ("
      const logs4 = await monitorPage.getEventLogTexts();
      const notifyAllLogged = logs.some((t) => t.includes('Notifying all waiting threads'));
      expect(notifyAllLogged).toBeTruthy();

      // monitor.enter and monitor.exit should also be logged around notifyAll
      const entered2 = logs.some((t) => t.includes('Thread entered2 monitor'));
      const exited2 = logs.some((t) => t.includes('Thread exited2 monitor'));
      expect(entered).toBeTruthy();
      expect(exited).toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });

    test('Notify All when no waiting threads should do nothing but still enter/exit monitor', async ({ page }) => {
      // This ensures notifyAll does not throw when there are zero waiting threads and logs appropriate entries.
      const monitorPage7 = new MonitorPage(page);

      // Ensure waitingThreads is empty
      await page.evaluate(() => {
        if (window.monitor && Array.isArray(window.monitor.waitingThreads)) {
          window.monitor.waitingThreads = [];
          window.monitor.logEvent('Simulated: waitingThreads cleared for test');
        }
      });

      // Click notify all
      await monitorPage.clickNotifyAll();

      // Check logs: There should NOT be a "Notifying all waiting threads" message because there were none
      const logs5 = await monitorPage.getEventLogTexts();
      const notifyAllLogged1 = logs.some((t) => t.includes('Notifying all waiting threads'));
      expect(notifyAllLogged).toBe(false);

      // But there should still be entry/exit logs
      const entered3 = logs.some((t) => t.includes('Thread entered3 monitor'));
      const exited3 = logs.some((t) => t.includes('Thread exited3 monitor'));
      expect(entered).toBeTruthy();
      expect(exited).toBeTruthy();

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Observability: console and error handling', () => {
    test('should collect console messages (if any) and ensure no unexpected runtime errors', async ({ page }) => {
      // Note: The page logs events into the DOM and not the console.
      // This test asserts that we captured console messages array and that no uncaught page errors occurred.
      const monitorPage8 = new MonitorPage(page);

      // Interact a bit to potentially generate console output (none expected)
      await monitorPage.clickIncrement();
      await monitorPage.clickDecrement();

      // Validate consoleMessages is an array
      expect(Array.isArray(consoleMessages)).toBe(true);

      // We assert there are no uncaught page errors; if there are, they will be present in pageErrors
      // and failing the test will surface the naturally occurring errors as required.
      expect(pageErrors.length).toBe(0);
    });

    test('intentional check: if monitor object were missing, page would throw - we observe no such ReferenceError', async ({ page }) => {
      // This test ensures the monitor object exists and does not cause ReferenceError during normal operations.
      const monitorExists = await page.evaluate(() => typeof window.monitor !== 'undefined');
      expect(monitorExists).toBe(true);

      // If a ReferenceError happened naturally, it would be captured in pageErrors and fail earlier expectations.
      expect(pageErrors.length).toBe(0);
    });
  });
});