import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b34a12-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object Model for the HTTPS Demo page
class HttpsDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#simulateBtn');
    this.message = page.locator('#message');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickSimulate() {
    await this.button.click();
  }

  async isButtonDisabled() {
    return await this.button.evaluate((btn) => btn.disabled);
  }

  async getMessageText() {
    return await this.message.evaluate((el) => el.textContent || '');
  }

  async isMessageVisible() {
    // reflect the effective display style
    return await this.message.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && el.offsetParent !== null;
    });
  }

  async waitForMessageText(expectedText, timeout = 20000) {
    await this.page.waitForFunction(
      (expected) => {
        const el = document.querySelector('#message');
        return !!el && (el.textContent || '') === expected;
      },
      expectedText,
      { timeout }
    );
  }

  async getSteps() {
    // steps are defined in the page script as a global const; fetch them for orchestration
    return await this.page.evaluate(() => {
      // Return a shallow copy to the test context
      return typeof steps !== 'undefined' ? steps.map(s => ({ text: s.text, delay: s.delay })) : null;
    });
  }
}

test.describe('HTTPS Concept Demo - FSM validation', () => {
  // Collect console messages and page errors for each test to assert no unexpected errors occur.
  test.describe.configure({ mode: 'parallel' });

  let consoleMessages;
  let pageErrors;

  // Setup and teardown for each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // ignore unexpected console collection issues
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // detach listeners to avoid leaks in long test runs (Playwright tears down page automatically)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial Idle state is rendered correctly (S0_Idle)', async ({ page }) => {
    // Validate the initial Idle state: button present and enabled, message hidden and empty.
    const demo = new HttpsDemoPage(page);
    await demo.goto();

    // Ensure page loaded expected elements
    await expect(page.locator('#simulateBtn')).toBeVisible();
    await expect(page.locator('#message')).toBeHidden();

    // Button should be enabled
    const disabled = await demo.isButtonDisabled();
    expect(disabled).toBeFalsy();

    // Message text should be empty at start
    const msgText = await demo.getMessageText();
    expect(msgText).toBe('');

    // No runtime errors should have occurred up to initial render
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking simulate enters Handshake In Progress (S1_HandshakeInProgress) and disables button', async ({ page }) => {
    // Validate transition S0 -> S1: clicking the button disables it and sets the message visible with starting text.
    const demo = new HttpsDemoPage(page);
    await demo.goto();

    // Click the simulate button to trigger handshake
    await demo.clickSimulate();

    // Immediately after click, button should be disabled (transition action: btn.disabled = true)
    await page.waitForFunction(() => document.querySelector('#simulateBtn')?.disabled === true, {}, { timeout: 2000 }).catch(() => {});
    const disabled = await demo.isButtonDisabled();
    expect(disabled).toBe(true);

    // Message should be visible and show the starting handshake text (S1 entry action)
    await demo.waitForMessageText('Starting HTTPS handshake...', 3000);
    const visible = await demo.isMessageVisible();
    expect(visible).toBe(true);
    const msgText = await demo.getMessageText();
    expect(msgText).toBe('Starting HTTPS handshake...');

    // Ensure no uncaught exceptions happened on click/initial transition
    expect(pageErrors.length).toBe(0);
  });

  test('Handshake progresses through all steps and reaches Connection Established (S2_ConnectionEstablished)', async ({ page }) => {
    // This test validates the full handshake flow:
    // - messages transition through the steps array in order,
    // - the final message matches the secure established text,
    // - the button becomes re-enabled at the end (S2 -> S0 transition action).
    const demo = new HttpsDemoPage(page);
    await demo.goto();

    // Fetch the steps from the page so we know expected texts and can time waits accordingly.
    const steps = await demo.getSteps();
    expect(Array.isArray(steps)).toBe(true);
    expect(steps.length).toBeGreaterThan(0);

    // Start the handshake
    await demo.clickSimulate();

    // Immediately ensure starting message is set
    await demo.waitForMessageText('Starting HTTPS handshake...', 3000);
    expect(await demo.isButtonDisabled()).toBe(true);

    // For each step, wait for its text to appear. Use a timeout slightly larger than the step delay.
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      // Wait using the step delay + buffer (1500ms buffer)
      const waitTimeout = Math.max(5000, step.delay + 1500);
      await demo.waitForMessageText(step.text, waitTimeout);
      const currentText = await demo.getMessageText();
      expect(currentText).toBe(step.text);
      // Ensure button still disabled during handshake
      expect(await demo.isButtonDisabled()).toBe(true);
    }

    // After all steps, there is a final delay (2000ms in implementation), then final success text is set
    const finalText = '🔐 Secure HTTPS connection established! All data is now encrypted.';
    // Wait up to 5s (the implementation waits 2000ms after the last step)
    await demo.waitForMessageText(finalText, 7000);
    expect(await demo.getMessageText()).toBe(finalText);

    // Button should be re-enabled at the end (transition S2 -> S0 action)
    await page.waitForFunction(() => document.querySelector('#simulateBtn')?.disabled === false, {}, { timeout: 3000 }).catch(() => {});
    expect(await demo.isButtonDisabled()).toBe(false);

    // Ensure no uncaught exceptions occurred during the long-running handshake
    expect(pageErrors.length).toBe(0);
  }, 40000); // Allow extended timeout for this long-running test

  test('Clicking disabled button during handshake does not break flow (edge case)', async ({ page }) => {
    // Edge case: Attempt to click the button while it's disabled; this should not reset or break the handshake.
    const demo = new HttpsDemoPage(page);
    await demo.goto();

    // Start handshake
    await demo.clickSimulate();
    await demo.waitForMessageText('Starting HTTPS handshake...', 3000);
    expect(await demo.isButtonDisabled()).toBe(true);

    // Attempt to click while disabled. Playwright can still attempt to click; HTML disabled prevents the action.
    // We perform a direct DOM click via evaluate to mimic a user attempt to click (which should be ignored because disabled)
    await page.evaluate(() => {
      const btn = document.querySelector('#simulateBtn');
      try {
        // Attempt a programmatic click; browsers typically ignore clicks on disabled buttons for form activation,
        // but the event might still be dispatched in some environments. The implementation relies on the disabled state,
        // so any additional invocation should not cause duplicate flows or throw errors.
        btn && btn.click && btn.click();
      } catch (e) {
        // allow exceptions here to propagate to pageerror which we will assert below
      }
    });

    // Ensure handshake continues to the final state unchanged
    const steps = await demo.getSteps();
    for (let i = 0; i < steps.length; i++) {
      await demo.waitForMessageText(steps[i].text, Math.max(5000, steps[i].delay + 1500));
    }
    const finalText = '🔐 Secure HTTPS connection established! All data is now encrypted.';
    await demo.waitForMessageText(finalText, 7000);

    // No unexpected page errors should have occurred from the attempted click
    expect(pageErrors.length).toBe(0);

    // Button should be enabled again at the end
    expect(await demo.isButtonDisabled()).toBe(false);
  }, 40000);

  test('Reloading mid-handshake resets to Idle (S0_Idle) - edge case', async ({ page }) => {
    // Start handshake, then reload the page mid-way and ensure the app returns to Idle state with clean UI.
    const demo = new HttpsDemoPage(page);
    await demo.goto();

    // Start handshake
    await demo.clickSimulate();
    await demo.waitForMessageText('Starting HTTPS handshake...', 3000);
    expect(await demo.isButtonDisabled()).toBe(true);

    // Reload the page mid-handshake
    await page.reload({ waitUntil: 'load' });

    // After reload, the page should be back in Idle: message hidden, button enabled, message text empty
    await expect(page.locator('#simulateBtn')).toBeVisible();
    await expect(page.locator('#message')).toBeHidden();

    expect(await demo.isButtonDisabled()).toBe(false);
    expect(await demo.getMessageText()).toBe('');

    // No uncaught exceptions should have occurred because of reload
    expect(pageErrors.length).toBe(0);
  });

  test('Console output and runtime error observation', async ({ page }) => {
    // This test demonstrates observation of console messages and page errors.
    // It asserts that no ReferenceError/SyntaxError/TypeError occurred during normal operations.
    const demo = new HttpsDemoPage(page);
    await demo.goto();

    // Perform a short interaction
    await demo.clickSimulate();
    await demo.waitForMessageText('Starting HTTPS handshake...', 3000);

    // Wait a little to capture any asynchronous console messages or errors
    await page.waitForTimeout(500);

    // Assert there were no uncaught runtime errors
    // (The original instructions ask to observe and assert page errors; if the app has none, assert zero.)
    expect(pageErrors.length).toBe(0);

    // We capture console messages for diagnostics; ensure any console messages are strings
    for (const entry of consoleMessages) {
      expect(typeof entry.type).toBe('string');
      expect(typeof entry.text).toBe('string');
    }
  });
});