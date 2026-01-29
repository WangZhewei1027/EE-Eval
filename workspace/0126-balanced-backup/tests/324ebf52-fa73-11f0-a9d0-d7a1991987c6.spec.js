import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324ebf52-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object representing the semaphore page.
 * Encapsulates selectors and common interactions to keep tests readable.
 */
class SemaphorePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.red = page.locator('#red');
    this.yellow = page.locator('#yellow');
    this.green = page.locator('#green');
    this.startButton = page.locator("button[onclick='startSemaphore()']");
  }

  // Clicks the Start Semaphore button
  async clickStart() {
    await this.startButton.click();
  }

  // Returns the computed opacity for an element locator
  async getOpacity(locator) {
    return await locator.evaluate(el => {
      // computed style ensures we observe the rendered opacity
      return window.getComputedStyle(el).opacity;
    });
  }

  async redOpacity() {
    return this.getOpacity(this.red);
  }
  async yellowOpacity() {
    return this.getOpacity(this.yellow);
  }
  async greenOpacity() {
    return this.getOpacity(this.green);
  }
}

test.describe('Semaphore FSM - Interactive Application (324ebf52-fa73-11f0-a9d0-d7a1991987c6)', () => {
  // Hold captured console messages and errors for assertions
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and classify errors
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test we don't forcibly change the page; we just make sure arrays are available
    // Individual tests will assert expected console/page errors as required.
  });

  test('Initial state: all lights are present and start dim (opacity 0.3)', async ({ page }) => {
    // Validate DOM elements exist and initial visual state matches expected (lights dim)
    const s = new SemaphorePage(page);

    // Ensure the three light elements and the button exist
    await expect(s.red).toBeVisible();
    await expect(s.yellow).toBeVisible();
    await expect(s.green).toBeVisible();
    await expect(s.startButton).toBeVisible();

    // On initial load the implementation sets currentLight = 0 but does not call setLight()
    // So each light should be dim (opacity 0.3) prior to starting the semaphore.
    const redOpacity = await s.redOpacity();
    const yellowOpacity = await s.yellowOpacity();
    const greenOpacity = await s.greenOpacity();

    expect(redOpacity).toBe('0.3');
    expect(yellowOpacity).toBe('0.3');
    expect(greenOpacity).toBe('0.3');

    // Assert no uncaught page errors happened during load
    expect(pageErrors).toEqual([]);
    // Assert no console.error messages were emitted on load
    expect(consoleErrors).toEqual([]);
  });

  test('Start Semaphore: immediate Red onEnter then cycles to Yellow and Green every ~2s', async ({ page }) => {
    // This test validates the FSM transitions:
    // S0_Red -> S1_Yellow -> S2_Green -> S0_Red when user clicks Start Semaphore
    const s = new SemaphorePage(page);

    // Ensure helper functions exist in the page environment (onEnter actions refer to setLight)
    const hasSetLight = await page.evaluate(() => typeof setLight === 'function');
    const hasStartSemaphore = await page.evaluate(() => typeof startSemaphore === 'function');

    expect(hasSetLight).toBe(true);
    expect(hasStartSemaphore).toBe(true);

    // Click Start Semaphore - this should call setLight(0) immediately (entry action for S0_Red)
    await s.clickStart();

    // Immediately after clicking, Red should be ON (opacity 1), others dim
    // Give a short delay to allow the immediate setLight(0) to apply (should be synchronous but we wait a tick)
    await page.waitForTimeout(50);

    let redOpacity = await s.redOpacity();
    let yellowOpacity = await s.yellowOpacity();
    let greenOpacity = await s.greenOpacity();

    expect(redOpacity).toBe('1');
    expect(yellowOpacity).toBe('0.3');
    expect(greenOpacity).toBe('0.3');

    // Wait a bit more than 2 seconds to observe the transition to Yellow (S1_Yellow)
    await page.waitForTimeout(2100);

    redOpacity = await s.redOpacity();
    yellowOpacity = await s.yellowOpacity();
    greenOpacity = await s.greenOpacity();

    expect(yellowOpacity).toBe('1');
    expect(redOpacity).toBe('0.3');
    expect(greenOpacity).toBe('0.3');

    // Wait ~2s more to observe transition to Green (S2_Green)
    await page.waitForTimeout(2100);

    redOpacity = await s.redOpacity();
    yellowOpacity = await s.yellowOpacity();
    greenOpacity = await s.greenOpacity();

    expect(greenOpacity).toBe('1');
    expect(redOpacity).toBe('0.3');
    expect(yellowOpacity).toBe('0.3');

    // Wait ~2s more to observe transition back to Red (S0_Red)
    await page.waitForTimeout(2100);

    redOpacity = await s.redOpacity();
    yellowOpacity = await s.yellowOpacity();
    greenOpacity = await s.greenOpacity();

    expect(redOpacity).toBe('1');
    expect(yellowOpacity).toBe('0.3');
    expect(greenOpacity).toBe('0.3');

    // Ensure there were no uncaught page errors while the intervals ran
    expect(pageErrors).toEqual([]);
    // Ensure console did not emit any error-level messages during the interactions
    expect(consoleErrors).toEqual([]);
  });

  test('Edge case: Clicking Start multiple times should not crash the page (may create multiple intervals)', async ({ page }) => {
    // This test validates that repeated user action (clicking Start) does not cause runtime exceptions.
    // Note: The implementation will create another setInterval on each click; we only assert stability.
    const s = new SemaphorePage(page);

    // Click once, then again quickly
    await s.clickStart();
    await page.waitForTimeout(100); // brief pause
    await s.clickStart();

    // Wait to allow intervals to run and not produce uncaught exceptions
    await page.waitForTimeout(2200);

    // At least one of the lights should be on (opacity 1). We check that exactly one is at full opacity
    const opacities = {
      red: await s.redOpacity(),
      yellow: await s.yellowOpacity(),
      green: await s.greenOpacity()
    };

    // Count how many are '1' (fully on). With multiple intervals it is still expected that at least one is fully on.
    const onCount = Object.values(opacities).filter(v => v === '1').length;
    expect(onCount).toBeGreaterThanOrEqual(1);

    // No uncaught page errors should have been emitted
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Validation of onEnter/onExit semantics where applicable', async ({ page }) => {
    // The FSM 'entry_actions' specify setLight(index). We validate that calling startSemaphore triggers setLight(0).
    // There are no explicit exit actions defined in the provided FSM; we still validate that state transitions
    // result in expected visual changes (which implies setLight was invoked as intended).

    const s = new SemaphorePage(page);

    // Spy whether setLight changes the DOM by toggling opacities. We cannot redefine setLight in the page.
    // Instead, we call startSemaphore and verify opacities as evidence of setLight execution.

    await s.clickStart();
    await page.waitForTimeout(50);
    expect(await s.redOpacity()).toBe('1');

    // Move forward to next state to show entry action of next state executed
    await page.waitForTimeout(2100);
    expect(await s.yellowOpacity()).toBe('1');

    // Another transition to green
    await page.waitForTimeout(2100);
    expect(await s.greenOpacity()).toBe('1');

    // Ensure no pageerrors occurred during these entry actions
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Observes console output and page errors during startup and interactions', async ({ page }) => {
    // This test explicitly collects console messages and page errors while interacting with the app.
    // It validates that normal operation is quiet (no errors), and documents any console messages.

    const s = new SemaphorePage(page);

    // Clear any previously captured messages (from beforeEach)
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Start the semaphore and let it run briefly
    await s.clickStart();
    await page.waitForTimeout(2500);

    // Check captured console messages array is available
    // We assert that no console.error messages were produced (implementation uses DOM manipulation only)
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);

    // For extra observability, assert that consoleMessages is an array (may be empty)
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});