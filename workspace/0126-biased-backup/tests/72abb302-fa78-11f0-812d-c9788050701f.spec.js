import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72abb302-fa78-11f0-812d-c9788050701f.html';

// Page Object for the monitor page
class MonitorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.screen = page.locator('.screen');
    this.powerButton = page.locator('.power-button');
  }

  // Click the power button and wait briefly for transitions to take effect
  async clickPower() {
    await this.powerButton.click();
    // Allow CSS transitions / JS inline style changes to settle
    await this.page.waitForTimeout(250);
  }

  // Return the inline style.transform value (empty string if not set inline)
  async getInlineTransform() {
    return await this.screen.evaluate((el) => el.style.transform);
  }

  // Return the computed transform (matrix or none)
  async getComputedTransform() {
    return await this.screen.evaluate((el) => window.getComputedStyle(el).transform);
  }

  // Return the inline box-shadow value (empty string if not set inline)
  async getInlineBoxShadow() {
    return await this.screen.evaluate((el) => el.style.boxShadow);
  }

  // Return the computed box-shadow value
  async getComputedBoxShadow() {
    return await this.screen.evaluate((el) => window.getComputedStyle(el).boxShadow);
  }

  // Check whether the power button is visible and enabled
  async isPowerButtonVisible() {
    return await this.powerButton.isVisible();
  }
}

test.describe('QuantumView 4K Monitor - FSM Power Toggle (Application ID: 72abb302-fa78-11f0-812d-c9788050701f)', () => {
  // Arrays to collect console messages and uncaught page errors for each test
  let logs;
  let pageErrors;

  // Setup before each test: navigate to page and attach console / error listeners
  test.beforeEach(async ({ page }) => {
    logs = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      // collect text and type for diagnostics
      logs.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the provided HTML page (served externally)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Teardown / sanity check after each test
  test.afterEach(async ({},) => {
    // No automatic assertions here; individual tests will assert on logs/errors as appropriate.
  });

  test('Initial state (S0_PoweredOn): screen shows Powered On visuals and power button exists', async ({ page }) => {
    // This test validates the initial FSM state S0_PoweredOn as implemented in the page.
    // It checks computed styles coming from CSS and the presence of the power button.
    const monitor = new MonitorPage(page);

    // Power button should be visible and interactable
    expect(await monitor.isPowerButtonVisible()).toBe(true);

    // Inline transform should be empty initially since the initial rotate is applied via stylesheet,
    // not via inline style. This verifies the implementation uses CSS for initial powered-on appearance.
    const inlineTransform = await monitor.getInlineTransform();
    expect(inlineTransform === '' || inlineTransform === null).toBeTruthy();

    // The computed transform should reflect the rotateX set by the stylesheet.
    const computedTransform = await monitor.getComputedTransform();
    // Computed transform will be a matrix or 'none'. It should not be 'none' for the rotated screen.
    expect(computedTransform).not.toBe('none');

    // Computed box-shadow should contain the powered-on box-shadow values indicated in the FSM evidence.
    const computedBoxShadow = await monitor.getComputedBoxShadow();
    expect(computedBoxShadow).toContain('0 10px 25px');

    // No uncaught JS runtime errors should have been emitted during page load for a healthy initial render.
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S0_PoweredOn -> S1_PoweredOff: clicking power toggles to Powered Off (inline styles updated)', async ({ page }) => {
    // This test validates the transition from Powered On to Powered Off via PowerButtonClick event.
    const monitor = new MonitorPage(page);

    // Click the power button once to toggle power state off
    await monitor.clickPower();

    // After clicking, the script sets inline style.transform to 'rotateX(45deg)' for powered off.
    const inlineTransform = await monitor.getInlineTransform();
    expect(inlineTransform).toBe('rotateX(45deg)');

    // The inline boxShadow should match the powered-off style set by the script.
    const inlineBoxShadow = await monitor.getInlineBoxShadow();
    expect(inlineBoxShadow).toBe('0 2px 5px rgba(0, 0, 0, 0.2), inset 0 0 0 2px rgba(148, 163, 184, 0.05)');

    // Also confirm the computed transform is not 'none' and should correspond to the rotateX(45deg) matrix.
    const computedTransform = await monitor.getComputedTransform();
    expect(computedTransform).not.toBe('none');

    // Ensure no uncaught page errors were observed while performing the transition.
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_PoweredOff -> S0_PoweredOn: clicking power again toggles back to Powered On (inline styles updated)', async ({ page }) => {
    // This test validates toggling off and back on returns to the powered-on state.
    const monitor = new MonitorPage(page);

    // Click once to turn off
    await monitor.clickPower();

    // Click again to turn back on
    await monitor.clickPower();

    // After second click, the script sets inline style.transform to 'rotateX(8deg)'
    const inlineTransform = await monitor.getInlineTransform();
    expect(inlineTransform).toBe('rotateX(8deg)');

    // The inline boxShadow should be the powered-on shadow as set by the script on re-enable
    const inlineBoxShadow = await monitor.getInlineBoxShadow();
    expect(inlineBoxShadow).toBe('0 10px 25px rgba(0, 0, 0, 0.3), inset 0 0 0 2px rgba(148, 163, 184, 0.1)');

    // No uncaught runtime errors expected during toggling back on
    expect(pageErrors.length).toBe(0);
  });

  test('Rapid multiple PowerButtonClick events: parity of toggles respected (edge case)', async ({ page }) => {
    // This test validates the FSM's robustness when the user clicks the power button quickly multiple times.
    // From the initial powered-on state, an odd number of clicks should leave it powered off.
    const monitor = new MonitorPage(page);

    const clicks = 5; // odd number should end up powered off
    for (let i = 0; i < clicks; i++) {
      await monitor.powerButton.click();
    }
    // Allow styles to settle after rapid interactions
    await page.waitForTimeout(300);

    // Because we clicked an odd number of times, we expect inline transform to reflect the Powered Off state.
    const inlineTransform = await monitor.getInlineTransform();
    expect(inlineTransform).toBe('rotateX(45deg)');

    const inlineBoxShadow = await monitor.getInlineBoxShadow();
    expect(inlineBoxShadow).toBe('0 2px 5px rgba(0, 0, 0, 0.2), inset 0 0 0 2px rgba(148, 163, 184, 0.05)');

    // No uncaught runtime errors should have occurred as a result of rapid clicking.
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case & error scenario: attempting to click a non-existent control results in a Playwright error', async ({ page }) => {
    // This test intentionally triggers an interaction with a missing element to validate error behavior and handling.
    // We expect Playwright to throw a TimeoutError / locator error when the target does not exist.
    let thrown = null;
    try {
      // Attempt to click a selector that does not exist, but use a small timeout to fail fast.
      await page.locator('.non-existent-button').click({ timeout: 250 });
    } catch (err) {
      thrown = err;
    }

    // We expect an error to have been thrown by Playwright for the missing locator.
    expect(thrown).not.toBeNull();
    expect(thrown).toBeInstanceOf(Error);
    // The message should indicate the locator could not be clicked / timed out / not attached. We assert on common patterns.
    const msg = String(thrown.message);
    expect(
      msg.includes('Timeout') ||
      msg.includes('could not be found') ||
      msg.includes('waiting for selector') ||
      msg.includes('Element is not attached')
    ).toBeTruthy();
  });

  test('Console and page error observation: capture and assert no uncaught exceptions during normal use', async ({ page }) => {
    // This test aggregates console messages and page errors observed during a normal interaction flow.
    const monitor = new MonitorPage(page);

    // Perform a typical usage pattern: click power off and on
    await monitor.clickPower();
    await monitor.clickPower();

    // Wait briefly to allow any console messages or errors to surface
    await page.waitForTimeout(200);

    // Ensure we did not capture any uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Inspect the console logs for any severe-level messages. In browsers, 'error' console messages appear with type 'error'.
    const errorMessages = logs.filter((l) => l.type === 'error').map((l) => l.text);
    // For this application, we do not expect console.error messages during normal interactions.
    expect(errorMessages.length).toBe(0);

    // Still provide visibility into console output (this assertion documents that console messages may exist but should not include errors).
    // There may be informational logs like 'favicon' or CSS warnings—these are acceptable as long as they are not errors.
  });

});