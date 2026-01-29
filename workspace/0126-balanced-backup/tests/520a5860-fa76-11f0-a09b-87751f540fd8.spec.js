import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a5860-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the semaphore app
class SemaphorePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async semaphore() {
    return this.page.locator('#semaphore');
  }

  async message() {
    return this.page.locator('#message');
  }

  async clickSemaphore() {
    await this.page.click('#semaphore');
  }

  async getSemaphoreText() {
    return (await this.page.locator('#semaphore').innerText()).trim();
  }

  async hasRunningClass() {
    return await this.page.locator('#semaphore').evaluate((el) =>
      el.classList.contains('running')
    );
  }

  async getMessageText() {
    return (await this.page.locator('#message').innerText()).trim();
  }
}

// Capture console and page errors for each test
test.describe('Semaphore Example - FSM states and transitions', () => {
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Listen to console events and page errors
    page.on('console', (msg) => {
      const entry = { type: msg.type(), text: msg.text() };
      consoleMessages.push(entry);
      if (msg.type() === 'error') consoleErrors.push(entry);
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test ensure there were no uncaught page errors or console errors
    // These assertions ensure we observed the runtime as-is and no unexpected errors occurred.
    expect(pageErrors.length).toBe(0, `Unexpected page errors: ${pageErrors.map(e => e.message).join('; ')}`);
    expect(consoleErrors.length).toBe(0, `Unexpected console.error messages: ${consoleErrors.map(e => e.text).join('; ')}`);
  });

  test('Initial state S0_Idle: button shows "Start", no running class, empty message', async ({ page }) => {
    // Validate initial Idle state according to FSM and DOM
    const app = new SemaphorePage(page);
    await app.goto();

    // Check initial button text is "Start"
    const text = await app.getSemaphoreText();
    expect(text).toBe('Start');

    // No 'running' class initially
    const hasRunning = await app.hasRunningClass();
    expect(hasRunning).toBe(false);

    // Message should be empty
    const msg = await app.getMessageText();
    expect(msg).toBe('');
  });

  test('Transition S0_Idle -> S1_Running on click: immediate text "Running"', async ({ page }) => {
    // This test validates that clicking the semaphore from Idle immediately changes the button text to "Running"
    const app = new SemaphorePage(page);
    await app.goto();

    // Click to trigger transition
    await app.clickSemaphore();

    // Immediately after click, button text should be 'Running' (synchronous change in handler)
    const immediateText = await app.getSemaphoreText();
    expect(immediateText).toBe('Running');

    // Immediately after click, the 'running' class should NOT yet be present (it's added in the timeout)
    const hasRunningImmediately = await app.hasRunningClass();
    expect(hasRunningImmediately).toBe(false);

    // Wait for the scheduled timeout (500ms in implementation) plus margin and then assert Waiting state observables
    await page.waitForTimeout(600);

    // After timeout, FSM expects transition to Waiting: text 'Waiting' and message should be set
    const laterText = await app.getSemaphoreText();
    expect(laterText).toBe('Waiting');

    // Message expected by implementation for the first timeout from Idle->Running->Waiting is 'Semaphore released'
    const laterMessage = await app.getMessageText();
    expect(laterMessage).toBe('Semaphore released');

    // And the 'running' class should now be present
    const hasRunningLater = await app.hasRunningClass();
    expect(hasRunningLater).toBe(true);
  });

  test('Transition S2_Waiting -> S1_Running on click while running: immediate Running then Waiting with message "Waiting for semaphore to be released"', async ({ page }) => {
    // This test validates clicking when in the Waiting state (where class 'running' is present)
    // results in the expected sequence per the implementation:
    // - immediate text 'Running' (class removed)
    // - after timeout: text 'Waiting' and message 'Waiting for semaphore to be released'
    const app = new SemaphorePage(page);
    await app.goto();

    // Move to Waiting state first by clicking once and waiting for timeout
    await app.clickSemaphore();
    await page.waitForTimeout(600); // wait for initial timeout to finish

    // Confirm we are in Waiting state
    expect(await app.getSemaphoreText()).toBe('Waiting');
    expect(await app.hasRunningClass()).toBe(true);
    expect(await app.getMessageText()).toBe('Semaphore released');

    // Click while 'running' class is present; branch for contains('running') should execute
    await app.clickSemaphore();

    // Immediately after click the implementation removes 'running' and sets text to 'Running'
    const immediateText = await app.getSemaphoreText();
    expect(immediateText).toBe('Running');

    // Immediately after click, 'running' class should be removed
    expect(await app.hasRunningClass()).toBe(false);

    // Wait for the timeout to complete and assert final Waiting state and message
    await page.waitForTimeout(600);

    // After timeout, implementation sets: class 'running', text 'Waiting', message 'Waiting for semaphore to be released'
    expect(await app.getSemaphoreText()).toBe('Waiting');
    expect(await app.getMessageText()).toBe('Waiting for semaphore to be released');
    expect(await app.hasRunningClass()).toBe(true);
  });

  test('Edge case: multiple rapid clicks before timeout should result in the last scheduled timeout winning', async ({ page }) => {
    // This edge-case test validates behavior when the user clicks rapidly multiple times.
    // The implementation schedules multiple timeouts; the last one should determine the final displayed message.
    const app = new SemaphorePage(page);
    await app.goto();

    // Rapidly click three times (each within a short interval less than the 500ms timeout)
    await app.clickSemaphore(); // schedules timeout 1
    await page.waitForTimeout(50);
    await app.clickSemaphore(); // schedules timeout 2
    await page.waitForTimeout(50);
    await app.clickSemaphore(); // schedules timeout 3

    // Wait sufficiently for all timeouts to have fired; the last scheduled timeout should be the final state setter
    await page.waitForTimeout(800);

    // Inspect final state:
    // From initial Idle, the implementation's branch for no 'running' sets message 'Semaphore released' on timeout.
    // Because all three clicks are in the "not-running" state until the first timeout fires, the last timeout should set 'Semaphore released'.
    const finalMessage = await app.getMessageText();
    expect(finalMessage).toBe('Semaphore released');

    // Final text should be 'Waiting' (since each timeout ends setting 'Waiting')
    expect(await app.getSemaphoreText()).toBe('Waiting');

    // 'running' class should be present after final timeout
    expect(await app.hasRunningClass()).toBe(true);
  });

  test('Sanity check: ensure no unexpected console errors or uncaught exceptions during normal interactions', async ({ page }) => {
    // This test performs a typical flow and explicitly asserts that no JS errors or console.error messages were emitted.
    const app = new SemaphorePage(page);
    await app.goto();

    // Perform a sequence of interactions
    await app.clickSemaphore();
    await page.waitForTimeout(600);
    await app.clickSemaphore();
    await page.waitForTimeout(600);

    // At this point, after the interactions, our beforeEach/afterEach listeners will assert no page errors or console errors.
    // Additionally we assert programmatically here that there were no console errors or page errors recorded.
    // (Redundant with afterEach but makes the intent explicit inside the test.)
    // The arrays 'consoleErrors' and 'pageErrors' are captured in the surrounding scope.
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});