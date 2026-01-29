import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b286c4-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object Model for the Context Switching Demo
class ContextSwitchingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.startTask1 = page.locator('#startTask1');
    this.pauseTask1 = page.locator('#pauseTask1');
    this.startTask2 = page.locator('#startTask2');
    this.pauseTask2 = page.locator('#pauseTask2');
    this.startContextSwitching = page.locator('#startContextSwitching');
    this.count1 = page.locator('#count1');
    this.n2 = page.locator('#n2');
    this.fact2 = page.locator('#fact2');
    this.log = page.locator('#log');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickStartTask1() {
    await this.startTask1.click();
  }
  async clickPauseTask1() {
    await this.pauseTask1.click();
  }
  async clickStartTask2() {
    await this.startTask2.click();
  }
  async clickPauseTask2() {
    await this.pauseTask2.click();
  }
  async clickStartContextSwitching() {
    await this.startContextSwitching.click();
  }

  async getCount1Text() {
    return (await this.count1.textContent()).trim();
  }
  async getN2Text() {
    return (await this.n2.textContent()).trim();
  }
  async getFact2Text() {
    return (await this.fact2.textContent()).trim();
  }
  async getLogText() {
    return (await this.log.textContent()).trim();
  }

  async startContextSwitchingButtonText() {
    return (await this.startContextSwitching.textContent()).trim();
  }

  async isStartTask1Enabled() {
    return await this.startTask1.isEnabled();
  }
  async isPauseTask1Enabled() {
    return await this.pauseTask1.isEnabled();
  }
  async isStartTask2Enabled() {
    return await this.startTask2.isEnabled();
  }
  async isPauseTask2Enabled() {
    return await this.pauseTask2.isEnabled();
  }
  async isStartContextSwitchingEnabled() {
    return await this.startContextSwitching.isEnabled();
  }
}

test.describe('Context Switching Demo - FSM validation', () => {
  // Will capture console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    page.on('console', (msg) => {
      // capture console messages (log, warn, error)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // capture uncaught exceptions on the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('dialog', async (dialog) => {
      // capture any dialogs (e.g., alert) so tests can assert on them and accept/close
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // basic sanity: console messages and page errors are retained for each test to assert
  });

  test.describe('Initial state - S0_Idle', () => {
    test('should load and execute S0 entry actions (resetTask1/resetTask2) and show initial UI', async ({ page }) => {
      const demo = new ContextSwitchingPage(page);

      // Validate initial DOM values set by resetTask1/resetTask2
      expect(await demo.getCount1Text()).toBe('0');
      expect(await demo.getN2Text()).toBe('1');
      expect(await demo.getFact2Text()).toBe('1');

      // Validate button enabled/disabled states as per component definitions in FSM
      expect(await demo.isStartTask1Enabled()).toBeTruthy();
      expect(await demo.isPauseTask1Enabled()).toBeFalsy();
      expect(await demo.isStartTask2Enabled()).toBeTruthy();
      expect(await demo.isPauseTask2Enabled()).toBeFalsy();
      expect(await demo.isStartContextSwitchingEnabled()).toBeFalsy();

      // The page logs a load message - assert it exists
      const logText = await demo.getLogText();
      expect(logText).toContain('Load complete. Please start both tasks to enable context switching.');

      // Assert no uncaught page errors occurred during load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Task 1 interactions and transitions (S1_Task1_Running -> S2_Task1_Paused)', () => {
    test('Start Task 1 should run one step (entry action runTask1Once) and then result in a paused state', async ({ page }) => {
      const demo1 = new ContextSwitchingPage(page);

      // Click Start Task 1 - this will create the generator, set running true,
      // enable pause button, then call runTask1Once which advances generator once and auto-pauses
      await demo.clickStartTask1();

      // Allow small time for synchronous operations and logs to settle
      await page.waitForTimeout(200);

      // After a single step, count should have incremented at least to 1
      const countText = await demo.getCount1Text();
      expect(Number(countText)).toBeGreaterThanOrEqual(1);

      // Log should indicate Task 1 started and the counting log
      const logText1 = await demo.getLogText();
      expect(logText).toContain('Task 1 started.');
      expect(logText).toMatch(/Task 1: counted to \d+/);

      // Because runTask1Once auto-pauses by clicking the pause button,
      // verify that the UI reflects the paused state:
      expect(await demo.isPauseTask1Enabled()).toBeFalsy();
      expect(await demo.isStartTask1Enabled()).toBeTruthy();

      // The pause action's log entry should also be present
      expect(logText).toContain('Task 1 paused.');

      // Ensure no uncaught exceptions were thrown during these interactions
      expect(pageErrors.length).toBe(0);
    });

    test('Edge: invoking Pause Task 1 should disable pause and enable start (observed via auto-click during start)', async ({ page }) => {
      const demo2 = new ContextSwitchingPage(page);

      // Ensure starting once produces the pause log (pause happens by runTask1Once calling pause button)
      await demo.clickStartTask1();
      await page.waitForTimeout(200);

      // Confirm pause log exists - this validates the PauseTask1 event handler was executed
      const logText2 = await demo.getLogText();
      expect(logText).toContain('Task 1 paused.');

      // There should be no page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Task 2 interactions and transitions (S3_Task2_Running -> S4_Task2_Paused)', () => {
    test('Start Task 2 should run one step (entry action runTask2Once) and then result in a paused state', async ({ page }) => {
      const demo3 = new ContextSwitchingPage(page);

      // Start Task 2; like Task 1, it runs one step and auto-pauses
      await demo.clickStartTask2();
      await page.waitForTimeout(200);

      // Validate that Task 2 displayed at least the first factorial computation
      const n2Text = await demo.getN2Text();
      const fact2Text = await demo.getFact2Text();
      expect(Number(n2Text)).toBeGreaterThanOrEqual(1);
      expect(Number(fact2Text)).toBeGreaterThanOrEqual(1);

      // Logs should show Task 2 started and a factorial entry
      const logText3 = await demo.getLogText();
      expect(logText).toContain('Task 2 started.');
      expect(logText).toMatch(/Task 2: factorial\(\d+\) = \d+/);

      // Because runTask2Once auto-clicks pause, verify the paused UI state
      expect(await demo.isPauseTask2Enabled()).toBeFalsy();
      expect(await demo.isStartTask2Enabled()).toBeTruthy();

      // Ensure no uncaught exceptions
      expect(pageErrors.length).toBe(0);
    });

    test('Edge: Pause Task 2 event was triggered by auto-step and recorded in logs', async ({ page }) => {
      const demo4 = new ContextSwitchingPage(page);

      await demo.clickStartTask2();
      await page.waitForTimeout(200);

      const logText4 = await demo.getLogText();
      expect(logText).toContain('Task 2 paused.');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Context switching (S5_Context_Switching) and transitions', () => {
    test('Attempting to start context switching with only one task started should trigger an alert', async ({ page }) => {
      const demo5 = new ContextSwitchingPage(page);

      // Start only Task 1
      await demo.clickStartTask1();
      await page.waitForTimeout(200);

      // Try to start context switching - should show an alert since both generators aren't present
      await demo.clickStartContextSwitching();
      await page.waitForTimeout(200);

      // The dialog handler in beforeEach captured dialogs; assert the alert message matches expected text
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      const found = dialogs.some(d => d.message.includes('Start both tasks first to enable context switching.'));
      expect(found).toBeTruthy();

      // No page errors expected
      expect(pageErrors.length).toBe(0);
    });

    test('Starting context switching after both tasks started should run scheduler and alternate task execution', async ({ page }) => {
      const demo6 = new ContextSwitchingPage(page);

      // Start both tasks (each step will auto-pause but generators will be created)
      await demo.clickStartTask1();
      await demo.clickStartTask2();

      // Allow small time for generators to be set up and logs to be appended
      await page.waitForTimeout(200);

      // Now start context switching - since both genTask1 and genTask2 exist, this should start scheduler
      await demo.clickStartContextSwitching();

      // Allow scheduler to run for a couple of quanta (quantumMs = 500ms). Wait 1300ms to capture a few cycles
      await page.waitForTimeout(1300);

      // The log should contain entries indicating the scheduler started and that it ran each task
      const logText5 = await demo.getLogText();
      expect(logText).toContain('Context switching started.');
      expect(logText).toContain('Scheduler: Running Task 1');
      expect(logText).toContain('Scheduler: Running Task 2');

      // While scheduler is running, the Start/ Pause buttons should be disabled as per implementation
      expect(await demo.isStartTask1Enabled()).toBeFalsy();
      expect(await demo.isPauseTask1Enabled()).toBeFalsy();
      expect(await demo.isStartTask2Enabled()).toBeFalsy();
      expect(await demo.isPauseTask2Enabled()).toBeFalsy();

      // The Start Context Switching button's text should have toggled to "Stop Context Switching"
      expect(await demo.startContextSwitchingButtonText()).toBe('Stop Context Switching');

      // Stop context switching by clicking the same button
      await demo.clickStartContextSwitching();
      await page.waitForTimeout(200); // wait for stop logic to run

      // Confirm the scheduler stopped message exists
      const postStopLog = await demo.getLogText();
      expect(postStopLog).toContain('Context switching stopped.');

      // After stopping, start buttons are re-enabled and pause buttons disabled per implementation
      expect(await demo.isStartTask1Enabled()).toBeTruthy();
      expect(await demo.isPauseTask1Enabled()).toBeFalsy();
      expect(await demo.isStartTask2Enabled()).toBeTruthy();
      expect(await demo.isPauseTask2Enabled()).toBeFalsy();

      // No uncaught page errors during scheduler operation
      expect(pageErrors.length).toBe(0);
    });

    test('Edge: while scheduler running, pause buttons are disabled and cannot be used to directly pause (observed behavior)', async ({ page }) => {
      const demo7 = new ContextSwitchingPage(page);

      // Start both tasks first
      await demo.clickStartTask1();
      await demo.clickStartTask2();
      await page.waitForTimeout(200);

      // Start scheduler
      await demo.clickStartContextSwitching();
      await page.waitForTimeout(600); // allow one tick

      // Pause buttons should be disabled when scheduler is active
      expect(await demo.isPauseTask1Enabled()).toBeFalsy();
      expect(await demo.isPauseTask2Enabled()).toBeFalsy();

      // Attempting to click them would have no effect; ensure no page errors if attempted programmatically
      // We avoid forcibly clicking disabled elements; we assert they are disabled instead.
      expect(pageErrors.length).toBe(0);

      // Stop scheduler to cleanup
      await demo.clickStartContextSwitching();
      await page.waitForTimeout(200);
    });
  });

  test.describe('Logging and runtime error observation', () => {
    test('should not produce uncaught ReferenceError/SyntaxError/TypeError during normal flows', async ({ page }) => {
      const demo8 = new ContextSwitchingPage(page);

      // Perform a set of typical interactions exercising the main flows
      await demo.clickStartTask1();
      await page.waitForTimeout(150);
      await demo.clickStartTask2();
      await page.waitForTimeout(150);

      // Start and stop scheduler to exercise generator.next calls
      await demo.clickStartContextSwitching();
      await page.waitForTimeout(700);
      await demo.clickStartContextSwitching();
      await page.waitForTimeout(200);

      // Inspect captured page errors
      // We expect zero uncaught page errors (no ReferenceError/SyntaxError/TypeError).
      // If runtime errors do happen naturally, they will populate pageErrors and this assertion will fail,
      // making the test report that such errors occurred (as required to observe them).
      expect(pageErrors.length).toBe(0);

      // Also verify console logs contain expected lifecycle messages
      const msgTypes = consoleMessages.map(m => m.type);
      const hasLog = consoleMessages.some(m => m.text.includes('Context switching started.'));
      expect(hasLog).toBeTruthy();
    });
  });
});