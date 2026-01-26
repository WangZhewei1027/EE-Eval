import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72ac7650-fa78-11f0-812d-c9788050701f.html';

// Page Object Model for the HTTPS visualization page
class HttpsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.connectBtn = '#connect-btn';
    this.resetBtn = '#reset-btn';
    this.pathLine = '.path-line';
    this.lockIcons = '.lock-icon';
    this.encryptionBadge = '.encryption-badge';
    this.serverNode = '.server';
    this.clientNode = '.client';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Helpers to read inline style values (these are set directly by the page script)
  async getPathLineStyles() {
    return this.page.$eval(this.pathLine, el => ({
      width: el.style.width,
      left: el.style.left
    }));
  }

  async getLockIconsOpacity() {
    return this.page.$$eval(this.lockIcons, els => els.map(e => {
      // Prefer inline style if present; fall back to computed style
      return e.style.opacity || window.getComputedStyle(e).opacity;
    }));
  }

  async getEncryptionBadgeOpacity() {
    return this.page.$eval(this.encryptionBadge, el => el.style.opacity || window.getComputedStyle(el).opacity);
  }

  async getConnectButtonState() {
    return this.page.$eval(this.connectBtn, btn => ({
      disabled: btn.disabled,
      text: btn.textContent.trim(),
      opacity: btn.style.opacity || window.getComputedStyle(btn).opacity
    }));
  }

  async hasClass(selector, className) {
    return this.page.$eval(selector, (el, cls) => el.classList.contains(cls), className);
  }

  async clickConnect() {
    await this.page.click(this.connectBtn);
  }

  async clickReset() {
    await this.page.click(this.resetBtn);
  }

  // Wait utilities
  async waitForPathLine(expectedWidth, expectedLeft, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, w, l) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return el.style.width === w && el.style.left === l;
      },
      this.pathLine,
      expectedWidth,
      expectedLeft,
      { timeout }
    );
  }

  async waitForLockIconsOpacity(expectedOpacity, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, op) => {
        const els = Array.from(document.querySelectorAll(sel));
        if (els.length === 0) return false;
        return els.every(e => (e.style.opacity || window.getComputedStyle(e).opacity) === op);
      },
      this.lockIcons,
      expectedOpacity,
      { timeout }
    );
  }

  async waitForEncryptionBadgeOpacity(expectedOpacity, timeout = 2500) {
    await this.page.waitForFunction(
      (sel, op) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return (el.style.opacity || window.getComputedStyle(el).opacity) === op;
      },
      this.encryptionBadge,
      expectedOpacity,
      { timeout }
    );
  }
}

// Group related tests for the FSM behaviour
test.describe('The Beauty of HTTPS - FSM and UI behavior (Application: 72ac7650-fa78-11f0-812d-c9788050701f)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset collections for each test and attach listeners
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', err => {
      // capture page errors (uncaught exceptions)
      pageErrors.push(err);
    });

    page.on('console', msg => {
      // capture console messages with type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Ensure page listeners do not leak between tests (Playwright will normally detach with page)
    // We do not modify global environment or page behavior.
    // Append a short idle wait to allow any pending timeouts on the page to fire and be captured.
    await page.waitForTimeout(50);
  });

  test('Initial state (S0_Idle) - DOM and visual defaults are correct', async ({ page }) => {
    // This test validates the initial Idle state as described in the FSM.
    const p = new HttpsPage(page);

    // Assertions for components existence
    await expect(page.locator(p.connectBtn)).toBeVisible();
    await expect(page.locator(p.resetBtn)).toBeVisible();

    // Connect button initial text and enabled state
    const connectState = await p.getConnectButtonState();
    expect(connectState.text).toBe('Establish Secure Connection');
    expect(connectState.disabled).toBeFalsy();
    // Default inline style declares opacity unset; computed likely '1'
    expect(parseFloat(connectState.opacity)).toBeGreaterThanOrEqual(0.99);

    // Path line initial inline styles are width: 0%; left: 50%;
    const pathStyles = await p.getPathLineStyles();
    expect(pathStyles.width).toBe('0%');
    expect(pathStyles.left).toBe('50%');

    // Lock icons invisible initially (opacity 0)
    const locks = await p.getLockIconsOpacity();
    expect(locks.length).toBeGreaterThanOrEqual(1);
    locks.forEach(op => expect(op === '0' || op === '0' || parseFloat(op) === 0).toBeTruthy());

    // Encryption badge invisible initially
    const badgeOpacity = await p.getEncryptionBadgeOpacity();
    expect(badgeOpacity === '0' || parseFloat(badgeOpacity) === 0).toBeTruthy();

    // Client should have pulse class initially, server should not
    expect(await p.hasClass(p.clientNode, 'pulse')).toBeTruthy();
    expect(await p.hasClass(p.serverNode, 'pulse')).toBeFalsy();

    // Verify no uncaught page errors occurred during initial load
    expect(pageErrors.length, 'Expected no uncaught page errors on initial load').toBe(0);

    // Verify console has no error-level messages (but allow other console logs)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'Expected no console.error messages on initial load').toBe(0);
  });

  test('EstablishSecureConnection event transitions S0_Idle -> S1_ConnectionSecured', async ({ page }) => {
    // This test verifies clicking the connect button performs the transition and runs the onEnter actions:
    // - path line width and left update
    // - lock icons become visible after 800ms
    // - encryption badge appears after 1500ms
    // - server pulses, client stops pulsing
    // - connect button becomes disabled, opacity lowered, text updated
    const p = new HttpsPage(page);

    // Click the connect button to trigger the transition
    await p.clickConnect();

    // Immediately the path-line inline styles should be changed
    await p.waitForPathLine('50%', '25%', 1000);
    const pathStyles = await p.getPathLineStyles();
    expect(pathStyles.width).toBe('50%');
    expect(pathStyles.left).toBe('25%');

    // After ~800ms the lock icons should become visible (opacity '1')
    await p.waitForLockIconsOpacity('1', 1500);
    const locksAfter = await p.getLockIconsOpacity();
    locksAfter.forEach(op => expect(op === '1' || parseFloat(op) === 1).toBeTruthy());

    // After ~1500ms the encryption badge appears and server/client pulse classes update
    await p.waitForEncryptionBadgeOpacity('1', 2500);
    const badgeOpacity = await p.getEncryptionBadgeOpacity();
    expect(badgeOpacity === '1' || parseFloat(badgeOpacity) === 1).toBeTruthy();

    // Server should have 'pulse' and client should not
    expect(await p.hasClass(p.serverNode, 'pulse')).toBeTruthy();
    expect(await p.hasClass(p.clientNode, 'pulse')).toBeFalsy();

    // Connect button state: disabled true, opacity set to 0.7, and text changed
    const connectState = await p.getConnectButtonState();
    expect(connectState.disabled).toBeTruthy();
    // Inline style set to '0.7' earlier — check approximate equality
    expect(parseFloat(connectState.opacity)).toBeCloseTo(0.7, 1);
    expect(connectState.text).toBe('Connection Secured');

    // No uncaught page errors were thrown during the transition animations
    expect(pageErrors.length, 'Expected no uncaught page errors after establishing connection').toBe(0);
    // Also assert there are no console.error messages captured during the flow
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'Expected no console.error messages during establish connection').toBe(0);
  });

  test('ResetConnection event transitions S1_ConnectionSecured -> S0_Idle', async ({ page }) => {
    // This test:
    // - First establishes connection
    // - Then clicks Reset and verifies the onExit actions of S1 and onEnter of S0:
    //   pathLine resets to 0%/50%, lock icons hidden, encryption badge hidden,
    //   server pulse removed, client pulse added, connect button enabled and text restored.
    const p = new HttpsPage(page);

    // Establish connection first
    await p.clickConnect();
    await p.waitForPathLine('50%', '25%', 1000);
    await p.waitForLockIconsOpacity('1', 1500);
    await p.waitForEncryptionBadgeOpacity('1', 2500);

    // Now click Reset
    await p.clickReset();

    // Path line should immediately reset to width: 0% and left: 50%
    await p.waitForPathLine('0%', '50%', 1000);
    const pathStyles = await p.getPathLineStyles();
    expect(pathStyles.width).toBe('0%');
    expect(pathStyles.left).toBe('50%');

    // Lock icons should be hidden (opacity '0')
    await p.waitForLockIconsOpacity('0', 1000);
    const locksAfterReset = await p.getLockIconsOpacity();
    locksAfterReset.forEach(op => expect(op === '0' || parseFloat(op) === 0).toBeTruthy());

    // Encryption badge hidden
    await p.waitForEncryptionBadgeOpacity('0', 1000);
    const badgeOpacity = await p.getEncryptionBadgeOpacity();
    expect(badgeOpacity === '0' || parseFloat(badgeOpacity) === 0).toBeTruthy();

    // Server pulse removed, client gets pulse
    expect(await p.hasClass(p.serverNode, 'pulse')).toBeFalsy();
    expect(await p.hasClass(p.clientNode, 'pulse')).toBeTruthy();

    // Connect button restored to enabled state and original text
    const connectState = await p.getConnectButtonState();
    expect(connectState.disabled).toBeFalsy();
    expect(connectState.text).toBe('Establish Secure Connection');
    expect(parseFloat(connectState.opacity)).toBeGreaterThanOrEqual(0.99);

    // Confirm no uncaught page errors during the reset flow
    expect(pageErrors.length, 'Expected no uncaught page errors during reset').toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'Expected no console.error messages during reset').toBe(0);
  });

  test('Edge cases: clicking Connect when already disabled and Reset when already in Idle', async ({ page }) => {
    // This test covers edge cases:
    // - Clicking connect when already disabled (should not change state nor throw)
    // - Clicking reset while already in idle (no-op)
    const p = new HttpsPage(page);

    // Ensure idle initial state
    const initialConnect = await p.getConnectButtonState();
    expect(initialConnect.disabled).toBeFalsy();
    expect(initialConnect.text).toBe('Establish Secure Connection');

    // Click reset in idle — should be a no-op and should not produce errors
    await p.clickReset();
    // small timeout to let reset handlers run
    await page.waitForTimeout(100);
    const afterIdleReset = await p.getConnectButtonState();
    expect(afterIdleReset.disabled).toBeFalsy();
    expect(afterIdleReset.text).toBe('Establish Secure Connection');

    // Now establish connection
    await p.clickConnect();
    await p.waitForPathLine('50%', '25%', 1000);
    await p.waitForLockIconsOpacity('1', 1500);

    // Attempt to click connect again while it is disabled.
    // Playwright will attempt to click; ensure it does not throw and state remains unchanged.
    let clickError = null;
    try {
      await p.clickConnect();
    } catch (err) {
      // If Playwright throws due to disabled element, capture it but do not modify the page.
      clickError = err;
    }

    // The FSM should still be in the Connection Secured state irrespective of the attempted extra click
    const connectStateAfter = await p.getConnectButtonState();
    expect(connectStateAfter.text).toBe('Connection Secured');
    expect(connectStateAfter.disabled).toBeTruthy();

    // If the click produced a Playwright-level error (rare), ensure it's not a runtime page error:
    // We only captured Playwright exception; this is allowed but should not be a page-level uncaught error.
    expect(pageErrors.length, 'Expected no uncaught runtime page errors during edge-case interactions').toBe(0);

    // Also verify that no console.error messages were emitted during these interactions
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'Expected no console.error messages during edge-case interactions').toBe(0);

    // If Playwright raised an error attempting the disabled click, assert that it is related to the click attempt (optional)
    if (clickError) {
      // We assert that the page runtime did not throw; Playwright may throw because the element is disabled.
      // The presence of a Playwright click error is acceptable for this edge-case; do not fail the test for it.
      // Document occurrence for test visibility.
      expect(clickError).toBeTruthy();
    }
  });

  test('Observe console messages and page errors across full scenario (capture and report)', async ({ page }) => {
    // This test intentionally runs through full user scenario and asserts on the captured console/page errors
    // It demonstrates observation of in-page runtime behavior without modifying the page.

    const p = new HttpsPage(page);

    // Perform full flow: connect -> wait for animations -> reset
    await p.clickConnect();
    await p.waitForPathLine('50%', '25%', 1000);
    await p.waitForLockIconsOpacity('1', 1500);
    await p.waitForEncryptionBadgeOpacity('1', 2500);
    await p.clickReset();
    await p.waitForPathLine('0%', '50%', 1000);

    // Allow any delayed timers to run
    await page.waitForTimeout(200);

    // Verify that no uncaught page errors were observed throughout the scenario
    // As per the exercise instructions we "observe console logs and page errors" and assert expectations.
    // The application is expected to run without runtime exceptions; assert that.
    expect(pageErrors.length, `Expected zero page-level runtime errors but found: ${pageErrors.length}`).toBe(0);

    // Provide additional assertion: no console messages of type 'error' were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Expected zero console.error messages but found: ${consoleErrors.length}`).toBe(0);

    // Sanity: at least some console messages or interactions may exist (not required) — ensure we recorded navigation or other logs
    // This is not a strict requirement; just ensure our collector captured some events (document-level)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });
});