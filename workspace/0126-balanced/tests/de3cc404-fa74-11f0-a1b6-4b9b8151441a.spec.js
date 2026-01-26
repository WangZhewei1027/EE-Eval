import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3cc404-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the Mutex demo app
class MutexApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.locators = {
      startWithoutMutex: page.locator('#startWithoutMutex'),
      startWithMutex: page.locator('#startWithMutex'),
      reset: page.locator('#reset'),
      outputWithoutMutex: page.locator('#outputWithoutMutex'),
      outputWithMutex: page.locator('#outputWithMutex'),
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async isButtonDisabled(selector) {
    return await this.page.evaluate(el => el.disabled === true, await this.locators[selector].elementHandle());
  }

  async clickStartWithoutMutex() {
    await this.locators.startWithoutMutex.click();
  }

  async clickStartWithMutex() {
    await this.locators.startWithMutex.click();
  }

  async clickReset() {
    await this.locators.reset.click();
  }

  async getOutputHTML(id) {
    return await this.page.locator(id).innerHTML();
  }

  async getOutputText(id) {
    return await this.page.locator(id).innerText();
  }

  async getSharedCounter() {
    // read the global sharedCounter defined by the page
    return await this.page.evaluate(() => {
      // Access existing global; do not modify it.
      // If it's undefined, return undefined.
      // We purposely don't inject any globals.
      return typeof sharedCounter !== 'undefined' ? sharedCounter : undefined;
    });
  }

  async waitForFinalValueInOutput(selectorLocator, timeout = 5000) {
    // Wait until the output contains "Final value:" which indicates completion.
    await this.page.waitForFunction(
      (locator) => locator.innerText.includes('Final value:'),
      await this.page.locator(selectorLocator).elementHandle(),
      { timeout }
    );
  }
}

test.describe('Mutex Demonstration - FSM states and transitions', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (including errors)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('Idle state: initial UI elements present and enabled', async ({ page }) => {
    // Validate initial Idle state: buttons visible, enabled, outputs empty
    const app = new MutexApp(page);
    await app.goto();

    // Ensure no unexpected runtime errors occurred on load
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();

    // Buttons exist and are enabled initially
    await expect(app.locators.startWithoutMutex).toBeVisible();
    await expect(app.locators.startWithMutex).toBeVisible();
    await expect(app.locators.reset).toBeVisible();

    expect(await app.locators.startWithoutMutex.isEnabled()).toBeTruthy();
    expect(await app.locators.startWithMutex.isEnabled()).toBeTruthy();
    expect(await app.locators.reset.isEnabled()).toBeTruthy();

    // Outputs should be empty at start
    const outWithout = await app.getOutputText('#outputWithoutMutex');
    const outWith = await app.getOutputText('#outputWithMutex');
    expect(outWithout.trim()).toBe('');
    expect(outWith.trim()).toBe('');
  });

  test('Start Without Mutex: transitions to running state and produces read/write logs', async ({ page }) => {
    // This test validates the S0_Idle -> S1_WithoutMutexRunning transition and its observable outputs.
    const app = new MutexApp(page);
    await app.goto();

    // Start without mutex
    // Immediately after clicking, the UI should disable the start buttons
    await app.clickStartWithoutMutex();

    // After the click handler starts, the buttons must be disabled while work proceeds
    // Check disabled state
    expect(await app.locators.startWithoutMutex.isDisabled()).toBeTruthy();
    expect(await app.locators.startWithMutex.isDisabled()).toBeTruthy();

    // Wait for the operation to finish by waiting for the "Final value:" marker in the output
    await app.waitForFinalValueInOutput('#outputWithoutMutex');

    // After completion, buttons should be re-enabled
    expect(await app.locators.startWithoutMutex.isEnabled()).toBeTruthy();
    expect(await app.locators.startWithMutex.isEnabled()).toBeTruthy();

    // Verify the output contains expected "read" and "wrote" messages
    const html = await app.getOutputHTML('#outputWithoutMutex');
    const readMatches = (html.match(/Thread without mutex read:/g) || []).length;
    const wroteMatches = (html.match(/Thread without mutex wrote:/g) || []).length;

    // Expect at least 1 read/write and typically 5 reads and 5 writes (one per asynchronous operation).
    // Race conditions may lead to fewer unique increments but the app should always output read/write lines for each attempt.
    expect(readMatches).toBeGreaterThanOrEqual(1);
    expect(wroteMatches).toBeGreaterThanOrEqual(1);

    // Ensure "Final value" text exists in the output
    expect(html).toContain('Final value:');

    // Confirm no runtime page errors occurred during the operation
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  }, 15000);

  test('Start With Mutex: transitions to running state, produces ordered read/write logs and final value 5', async ({ page }) => {
    // This test validates the S0_Idle -> S2_WithMutexRunning transition and that the mutex enforces serialized access.
    const app = new MutexApp(page);
    await app.goto();

    // Start with mutex
    await app.clickStartWithMutex();

    // Buttons should be disabled while running
    expect(await app.locators.startWithMutex.isDisabled()).toBeTruthy();
    expect(await app.locators.startWithoutMutex.isDisabled()).toBeTruthy();

    // Wait for completion
    await app.waitForFinalValueInOutput('#outputWithMutex');

    // After completion, buttons re-enabled
    expect(await app.locators.startWithMutex.isEnabled()).toBeTruthy();
    expect(await app.locators.startWithoutMutex.isEnabled()).toBeTruthy();

    const html = await app.getOutputHTML('#outputWithMutex');
    const readMatches = (html.match(/Thread with mutex read:/g) || []).length;
    const wroteMatches = (html.match(/Thread with mutex wrote:/g) || []).length;

    // With a proper mutex, we expect exactly 5 reads and 5 writes (one per operation)
    expect(readMatches).toBe(5);
    expect(wroteMatches).toBe(5);

    // The final value should be 5 when mutex is used correctly
    expect(html).toContain('Final value: 5');

    // Confirm sharedCounter global is 5 (sanity check)
    const counter = await app.getSharedCounter();
    expect(counter).toBe(5);

    // Confirm no runtime page errors occurred during the operation
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  }, 15000);

  test('Reset transition: clears outputs and resets shared state', async ({ page }) => {
    // This test validates S1/S2 -> S0_Reset transition behaviour via the Reset button.
    const app = new MutexApp(page);
    await app.goto();

    // Run both modes to populate outputs and change sharedCounter
    await app.clickStartWithMutex();
    await app.waitForFinalValueInOutput('#outputWithMutex');

    await app.clickStartWithoutMutex();
    await app.waitForFinalValueInOutput('#outputWithoutMutex');

    // Verify outputs are non-empty before reset
    const beforeWith = (await app.getOutputText('#outputWithMutex')).trim();
    const beforeWithout = (await app.getOutputText('#outputWithoutMutex')).trim();
    expect(beforeWith.length).toBeGreaterThan(0);
    expect(beforeWithout.length).toBeGreaterThan(0);

    // Click Reset
    await app.clickReset();

    // After reset, outputs should be empty and buttons should be enabled
    const afterWith = (await app.getOutputText('#outputWithMutex')).trim();
    const afterWithout = (await app.getOutputText('#outputWithoutMutex')).trim();
    expect(afterWith).toBe('');
    expect(afterWithout).toBe('');

    expect(await app.locators.startWithoutMutex.isEnabled()).toBeTruthy();
    expect(await app.locators.startWithMutex.isEnabled()).toBeTruthy();

    // sharedCounter should be reset to 0
    const counter = await app.getSharedCounter();
    expect(counter).toBe(0);

    // Confirm no runtime errors occurred during reset
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  test('Edge case: Start buttons disabled during execution (no double-start)', async ({ page }) => {
    // Validate that when an operation is running the start buttons are disabled preventing reentrancy
    const app = new MutexApp(page);
    await app.goto();

    // Start the With Mutex operation
    const startPromise = (async () => {
      await app.clickStartWithMutex();
      // Wait for final value to ensure completion
      await app.waitForFinalValueInOutput('#outputWithMutex');
    })();

    // Immediately after initiating, both start buttons should be disabled
    expect(await app.locators.startWithMutex.isDisabled()).toBeTruthy();
    expect(await app.locators.startWithoutMutex.isDisabled()).toBeTruthy();

    // Attempting to click the start button again programmatically should not trigger a new run.
    // We check disabled property remains true until completion and ensure only 5 reads/writes occur after completion.
    await startPromise;

    // After completion the start buttons are enabled again
    expect(await app.locators.startWithMutex.isEnabled()).toBeTruthy();
    expect(await app.locators.startWithoutMutex.isEnabled()).toBeTruthy();

    const html = await app.getOutputHTML('#outputWithMutex');
    const readMatches = (html.match(/Thread with mutex read:/g) || []).length;
    const wroteMatches = (html.match(/Thread with mutex wrote:/g) || []).length;

    // Ensure counts equal exactly 5 (single run)
    expect(readMatches).toBe(5);
    expect(wroteMatches).toBe(5);

    // Confirm no runtime page errors occurred during the edge-case
    expect(pageErrors.length).toBe(0);
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  }, 15000);

  test('Observability: capture console and page errors while running both scenarios', async ({ page }) => {
    // This test purposefully collects console and pageerror events while running both scenarios.
    const app = new MutexApp(page);
    await app.goto();

    // Run without mutex
    await app.clickStartWithoutMutex();
    await app.waitForFinalValueInOutput('#outputWithoutMutex');

    // Run with mutex
    await app.clickStartWithMutex();
    await app.waitForFinalValueInOutput('#outputWithMutex');

    // Assert that no uncaught exceptions (pageerror) happened
    // The FSM and implementation are expected to run without throwing global errors.
    expect(pageErrors.length).toBe(0);

    // Assert no console messages of type 'error' were emitted
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // Optionally assert some informational console logs are absent (the app writes to DOM instead)
    // Ensure that output DOMs contain the final values
    expect((await app.getOutputText('#outputWithoutMutex')).includes('Final value:')).toBeTruthy();
    expect((await app.getOutputText('#outputWithMutex')).includes('Final value: 5')).toBeTruthy();
  }, 20000);
});