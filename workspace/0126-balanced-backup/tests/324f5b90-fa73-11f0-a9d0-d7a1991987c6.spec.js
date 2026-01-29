import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f5b90-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object for the Load Balancing Simulation page.
 * Encapsulates interactions and read operations for clearer tests.
 */
class LoadBalancerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.sendButton = this.page.locator("button[onclick='sendRequest()']");
    this.load1 = this.page.locator('#load1');
    this.load2 = this.page.locator('#load2');
    this.load3 = this.page.locator('#load3');
  }

  // Click the Send Request button once
  async clickSend() {
    await this.sendButton.click();
  }

  // Click the Send Request button n times sequentially
  async clickSendTimes(n) {
    for (let i = 0; i < n; i++) {
      await this.sendButton.click();
      // small delay to allow script to run and DOM to update
      await this.page.waitForTimeout(10);
    }
  }

  // Read numeric loads for servers as an array of integers [l1, l2, l3]
  async getLoads() {
    const texts = await Promise.all([
      this.load1.textContent(),
      this.load2.textContent(),
      this.load3.textContent()
    ]);
    // parseInt may return NaN if text missing; keep that visible in assertions
    return texts.map(t => (t === null ? null : parseInt(t.trim(), 10)));
  }

  // Returns button text trimmed
  async getButtonText() {
    const txt = await this.sendButton.textContent();
    return txt === null ? '' : txt.trim();
  }
}

test.describe('Load Balancing Simulation (Application ID: 324f5b90-fa73-11f0-a9d0-d7a1991987c6)', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  // Set up listeners and navigate to the app before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages emitted by the page
    page.on('console', msg => {
      // store both type and text for diagnostics
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught exceptions (ReferenceError, TypeError, etc.)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    await page.goto(APP_URL);
  });

  // Basic teardown: capture nothing special here, but keep hook for future expansion
  test.afterEach(async ({ page }) => {
    // no-op: leaving hooks for completeness (could capture screenshot on failure here)
  });

  test.describe('Idle State - Initial Rendering', () => {
    test('Initial Idle state displays Send Request button and zero loads', async ({ page }) => {
      // This test validates the S0_Idle state from the FSM:
      // - the Send Request button exists and is visible
      // - each server load starts at 0
      const app = new LoadBalancerPage(page);

      // Ensure button exists and has correct label
      await expect(app.sendButton).toBeVisible();
      const btnText = await app.getButtonText();
      expect(btnText).toBe('Send Request');

      // Ensure each load element exists and shows "0"
      const loads = await app.getLoads();
      expect(loads).toEqual([0, 0, 0]);

      // Ensure no runtime page errors were emitted during initial load
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('SendRequest Event and Transition', () => {
    test('Single click updates the least-loaded server and logs to console', async ({ page }) => {
      // This test validates the SendRequest event from FSM:
      // - clicking the button triggers sendRequest()
      // - the UI is updated for the chosen server
      // - a console log with the expected message is emitted
      const app = new LoadBalancerPage(page);

      // Click once
      await app.clickSend();

      // Allow a short time for console messages and DOM updates to propagate
      await page.waitForTimeout(20);

      // After first click, the first server (server1) should have been chosen
      const loads = await app.getLoads();
      expect(loads).toEqual([1, 0, 0]);

      // Assert console logged the expected string for Server 1
      const logTexts = consoleMessages.map(m => m.text);
      const expectedLogFragment = 'Request sent to Server 1. Current load: 1';
      expect(logTexts.some(t => t.includes(expectedLogFragment))).toBeTruthy();

      // No runtime errors should have occurred
      expect(pageErrors.length).toBe(0);
    });

    test('Multiple clicks distribute requests to the currently least-loaded server (deterministic tie-breaking)', async ({ page }) => {
      // This test validates repeated transitions stay in the Idle state but update loads:
      // FSM transition S0_Idle -> S0_Idle on SendRequest multiple times.
      const app = new LoadBalancerPage(page);

      // Perform 3 clicks: should distribute one to each server in order 1,2,3
      await app.clickSendTimes(3);
      await page.waitForTimeout(20);
      let loads = await app.getLoads();
      expect(loads).toEqual([1, 1, 1]);

      // Click a 4th time: the first server (indexOf returns first min) should get incremented to 2
      await app.clickSend();
      await page.waitForTimeout(20);
      loads = await app.getLoads();
      expect(loads).toEqual([2, 1, 1]);

      // Verify console produced 4 messages corresponding to the 4 clicks
      // We allow other console types but expect at least 4 'log' entries that match the pattern.
      const logEntries = consoleMessages.filter(m => m.type === 'log' || m.type === 'info' || m.type === 'debug');
      expect(logEntries.length).toBeGreaterThanOrEqual(4);
      // Verify the last console message corresponds to the 4th click (Server 1, load 2)
      const lastLog = logEntries[logEntries.length - 1].text;
      expect(lastLog).toContain('Request sent to Server 1');
      expect(lastLog).toContain('Current load: 2');

      // No runtime page errors expected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge Cases & Error Scenarios', () => {
    test('Rapid multiple clicks: total load equals number of clicks and no runtime errors', async ({ page }) => {
      // This test validates robustness under repeated rapid interactions:
      // - clicking many times in quick succession still updates DOM correctly
      // - sum of loads equals number of clicks
      // - no ReferenceError/SyntaxError/TypeError occurred
      const app = new LoadBalancerPage(page);

      const clicks = 30;
      await app.clickSendTimes(clicks);

      // Allow extra time for all console messages and DOM updates
      await page.waitForTimeout(100);

      const loads = await app.getLoads();
      const total = loads.reduce((a, b) => a + b, 0);
      expect(total).toBe(clicks);

      // Expect console messages at least equal to clicks (one per sendRequest call)
      const logCount = consoleMessages.filter(m => m.type === 'log' || m.type === 'info').length;
      expect(logCount).toBeGreaterThanOrEqual(clicks);

      // Ensure there were no runtime uncaught exceptions
      expect(pageErrors.length).toBe(0);

      // Additionally ensure all load display elements show non-negative integers
      for (const l of loads) {
        expect(typeof l).toBe('number');
        expect(Number.isFinite(l)).toBeTruthy();
        expect(l).toBeGreaterThanOrEqual(0);
      }
    });

    test('No unexpected runtime errors (ReferenceError / SyntaxError / TypeError) were emitted during navigation and interactions', async ({ page }) => {
      // This test explicitly checks that there were no common runtime error types.
      // It observes pageErrors and inspects their messages.
      // Note: per instructions we do NOT patch or modify the page; we only observe and assert.

      // Short interaction to exercise the page
      const app = new LoadBalancerPage(page);
      await app.clickSendTimes(2);
      await page.waitForTimeout(20);

      // Check collected page errors (should be zero for a healthy implementation)
      if (pageErrors.length > 0) {
        // If there are errors, fail with diagnostics
        const msgs = pageErrors.map(e => String(e && e.stack ? e.stack : e));
        expect(pageErrors.length, `Page emitted runtime errors: ${msgs.join('\n---\n')}`).toBe(0);
      } else {
        // No errors recorded
        expect(pageErrors.length).toBe(0);
      }
    });
  });
});