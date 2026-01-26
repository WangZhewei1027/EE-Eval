import { test, expect } from '@playwright/test';

// Test file for Application ID: 3c99fe70-fa78-11f0-857d-d58e82d5de73
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/3c99fe70-fa78-11f0-857d-d58e82d5de73.html

// Page Object for the HTTP demo
class HttpDemoPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('http://127.0.0.1:5500/workspace/0126-biased/html/3c99fe70-fa78-11f0-857d-d58e82d5de73.html', { waitUntil: 'load' });
  }

  btnRequest() {
    return this.page.locator('#btn-request');
  }

  btnReset() {
    return this.page.locator('#btn-reset');
  }

  tooltip() {
    return this.page.locator('#tooltip');
  }

  graphic() {
    return this.page.locator('.http-graphic');
  }

  // Return text content of tooltip
  async tooltipText() {
    return (await this.tooltip().innerText()).trim();
  }

  async isTooltipVisible() {
    return this.tooltip().evaluate((el) => el.classList.contains('visible'));
  }

  async clickRequest() {
    await this.btnRequest().click();
  }

  async clickReset() {
    await this.btnReset().click();
  }

  // Resolve inline styles applied to the graphic element (resetGraphic clears inline styles)
  async graphicInlineStyles() {
    return await this.graphic().evaluate((el) => ({
      transform: el.style.transform || '',
      boxShadow: el.style.boxShadow || '',
    }));
  }

  // Returns true/false for disabled attribute
  async isRequestDisabled() {
    return await this.btnRequest().evaluate((el) => el.disabled === true);
  }

  async isResetDisabled() {
    return await this.btnReset().evaluate((el) => el.disabled === true);
  }

  // Returns aria-pressed value
  async requestAriaPressed() {
    return await this.btnRequest().getAttribute('aria-pressed');
  }

  async resetAriaPressed() {
    return await this.btnReset().getAttribute('aria-pressed');
  }

  // Helper to wait for tooltip text to equal expected (with timeout)
  async waitForTooltipText(expected, timeout = 4000) {
    await this.page.waitForFunction(
      (selector, text) => {
        const el = document.querySelector(selector);
        return el && el.textContent.trim() === text && el.classList.contains('visible');
      },
      '#tooltip',
      expected,
      { timeout }
    );
  }

  // Helper to wait until tooltip becomes not visible
  async waitForTooltipHidden(timeout = 5000) {
    await this.page.waitForFunction(
      (selector) => {
        const el = document.querySelector(selector);
        return el && !el.classList.contains('visible');
      },
      '#tooltip',
      { timeout }
    );
  }
}

// Group related tests
test.describe('HTTP interactive demo - FSM validation and UI behavior', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen for console messages
    page.on('console', (msg) => {
      // collect all console messages for later assertions/inspection
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Listen for uncaught errors on the page
    page.on('pageerror', (err) => {
      // capture the error object/message
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // If there were page errors, attach a small report to the test output to aid debugging
    if (pageErrors.length > 0) {
      testInfo.attach('pageErrors', {
        body: pageErrors.map((e) => e.toString()).join('\n---\n'),
        contentType: 'text/plain',
      });
    }
    if (consoleMessages.length > 0) {
      testInfo.attach('consoleMessages', {
        body: JSON.stringify(consoleMessages, null, 2),
        contentType: 'application/json',
      });
    }
  });

  // Test initial Idle state (S0_Idle)
  test('Initial Idle state: UI renders and buttons are in expected initial state', async ({ page }) => {
    const demo = new HttpDemoPage(page);
    await demo.goto();

    // Validate elements exist
    await expect(demo.btnRequest()).toBeVisible();
    await expect(demo.btnReset()).toBeVisible();
    await expect(demo.graphic()).toBeVisible();
    await expect(demo.tooltip()).toBeVisible(); // tooltip element exists; it may be invisible by CSS

    // Button initial attributes per implementation
    // btnRequest should be enabled and aria-pressed 'false'
    expect(await demo.isRequestDisabled()).toBe(false);
    expect(await demo.requestAriaPressed()).toBe('false');

    // btnReset should be disabled initially (set in script)
    expect(await demo.isResetDisabled()).toBe(true);

    // Tooltip should be empty and hidden initially
    expect(await demo.tooltipText()).toBe('');
    expect(await demo.isTooltipVisible()).toBe(false);

    // Graphic inline styles should be empty at start (no inline transform applied)
    const styles = await demo.graphicInlineStyles();
    expect(styles.transform).toBe('');
    expect(styles.boxShadow).toBe('');

    // Assert that no uncaught page errors appeared during initial load
    expect(pageErrors.length).toBe(0);
  });

  // Test SendHttpRequest event and transition to S1_RequestSent
  test('Send HTTP Request -> Request Sent: clicking request triggers animation and tooltip', async ({ page }) => {
    const demo = new HttpDemoPage(page);
    await demo.goto();

    // Click the "Send HTTP Request" button
    // This should call animateRequest(), set aria-pressed true, disable the request button,
    // and show the tooltip 'HTTP Request sent – awaiting response...'
    await demo.clickRequest();

    // Immediately after click: tooltip should be visible with awaiting message
    await demo.waitForTooltipText('HTTP Request sent – awaiting response...', 1000);
    expect(await demo.tooltipText()).toBe('HTTP Request sent – awaiting response...');
    expect(await demo.isTooltipVisible()).toBe(true);

    // btnRequest should be disabled while request is in flight and aria-pressed true
    expect(await demo.isRequestDisabled()).toBe(true);
    expect(await demo.requestAriaPressed()).toBe('true');

    // btnReset should remain disabled until response arrives
    expect(await demo.isResetDisabled()).toBe(true);

    // Graphic should have inline style applied by animation after it starts (fill:'forwards')
    // We allow it a tick to ensure animation affected inline style
    const styles = await demo.graphicInlineStyles();
    // transform may be non-empty because the animation with fill:'forwards' applies it
    expect(styles.transform === '' ? false : true).toBe(true);

    // No uncaught page errors expected for this interaction
    expect(pageErrors.length).toBe(0);
  });

  // Test automatic Timeout transition to S2_ResponseReceived
  test('Timeout transition -> Response Received: tooltip updates and reset is enabled', async ({ page }) => {
    const demo = new HttpDemoPage(page);
    await demo.goto();

    // Trigger request
    await demo.clickRequest();

    // Wait for the response timeout to fire (2800ms in implementation). Use a small buffer.
    await demo.waitForTooltipText('HTTP Request sent – awaiting response...', 1000);

    // Wait past the 2800ms boundary to allow response message and enabling reset button
    await page.waitForTimeout(3200);

    // Tooltip should have updated to response message
    // The implementation calls showTooltip('HTTP Response received – content ready!');
    await demo.waitForTooltipText('HTTP Response received – content ready!', 1000);
    expect(await demo.tooltipText()).toBe('HTTP Response received – content ready!');
    expect(await demo.isTooltipVisible()).toBe(true);

    // Reset button should now be enabled
    expect(await demo.isResetDisabled()).toBe(false);

    // The request button remains in pressed state until reset
    expect(await demo.requestAriaPressed()).toBe('true');

    // No uncaught page errors for timeout transition
    expect(pageErrors.length).toBe(0);
  });

  // Test Reset event and transition back to Idle (S2 -> S0)
  test('Reset: clicking reset returns UI to Idle state and clears visual feedback', async ({ page }) => {
    const demo = new HttpDemoPage(page);
    await demo.goto();

    // Start request and wait to reach Response Received
    await demo.clickRequest();
    await demo.waitForTooltipText('HTTP Request sent – awaiting response...', 1000);
    await page.waitForTimeout(3200);
    await demo.waitForTooltipText('HTTP Response received – content ready!', 1000);

    // Click Reset - should call resetGraphic(), re-enable request button, disable reset,
    // clear tooltip text and visible class, and clear inline graphic styles.
    await demo.clickReset();

    // After reset: tooltip should be hidden and text empty
    // The implementation sets tooltip.textContent = '' and removes 'visible' class
    await demo.waitForTooltipHidden(1000);
    expect(await demo.tooltipText()).toBe('');
    expect(await demo.isTooltipVisible()).toBe(false);

    // Buttons should be reset:
    expect(await demo.isResetDisabled()).toBe(true);
    expect(await demo.isRequestDisabled()).toBe(false);
    expect(await demo.requestAriaPressed()).toBe('false');
    expect(await demo.resetAriaPressed()).toBe('false');

    // Graphic inline styles should be cleared by resetGraphic()
    const styles = await demo.graphicInlineStyles();
    expect(styles.transform).toBe('');
    expect(styles.boxShadow).toBe('');

    // No uncaught page errors during reset
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: clicking request multiple times while an existing request is in progress.
  test('Edge case: repeated clicks on Request during active request do not produce errors or multiple conflicting states', async ({ page }) => {
    const demo = new HttpDemoPage(page);
    await demo.goto();

    // Click request once to start
    await demo.clickRequest();
    await demo.waitForTooltipText('HTTP Request sent – awaiting response...', 1000);

    // Immediately attempt to click request again - animateRequest() guards with inRequest flag
    // which should prevent a second invocation. We assert no exceptions and stable state.
    await demo.clickRequest(); // second click should be a no-op

    // Ensure aria-pressed remains 'true' and button is still disabled
    expect(await demo.requestAriaPressed()).toBe('true');
    expect(await demo.isRequestDisabled()).toBe(true);

    // Wait for timeout to transition to response
    await page.waitForTimeout(3200);
    await demo.waitForTooltipText('HTTP Response received – content ready!', 1000);

    // Ensure reset gets enabled exactly once (we can't observe "once", but it's enabled)
    expect(await demo.isResetDisabled()).toBe(false);

    // Ensure no uncaught TypeError/ReferenceError/SyntaxError were thrown
    // We assert that there are zero pageErrors (uncaught exceptions)
    expect(pageErrors.length).toBe(0);
  });

  // Observability test: capture console output and page errors during a full scenario
  test('Observability: capture console logs and page errors during interactions', async ({ page }) => {
    const demo = new HttpDemoPage(page);
    await demo.goto();

    // Clear any prior console messages collected in beforeEach
    // (the beforeEach handler already collects; we continue to collect more)
    // Perform a full flow: request -> wait -> reset
    await demo.clickRequest();
    await demo.waitForTooltipText('HTTP Request sent – awaiting response...', 1000);
    await page.waitForTimeout(3200);
    await demo.waitForTooltipText('HTTP Response received – content ready!', 1000);
    await demo.clickReset();
    await demo.waitForTooltipHidden(1000);

    // Assert that we captured console messages (console may be empty; we allow that)
    // But ensure we did not capture any uncaught page errors.
    expect(pageErrors.length).toBe(0);

    // Additionally assert that if there were console errors (type === 'error'), they are not fatal.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    // It's acceptable to have zero console errors; we merely record them. Fail only if there are unhandled page errors.
    expect(Array.isArray(consoleMessages)).toBe(true);
    // Attach a non-failing check: if there are console errors, ensure they are strings and captured
    for (const err of consoleErrors) {
      expect(typeof err.text).toBe('string');
      expect(err.text.length).toBeGreaterThanOrEqual(0);
    }
  });
});