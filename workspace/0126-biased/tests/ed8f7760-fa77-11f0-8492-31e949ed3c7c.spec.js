import { test, expect } from '@playwright/test';

// Test file: ed8f7760-fa77-11f0-8492-31e949ed3c7c.spec.js
// Application URL (served as provided)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f7760-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the Load Balancer app
class LoadBalancerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#loadButton');
    this.servers = page.locator('.server');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Number of server elements
  async serverCount() {
    return await this.servers.count();
  }

  // Click the Distribute Load button
  async clickDistribute(options = {}) {
    await this.button.click(options);
  }

  // Return whether a given server (0-based index) has the 'active' class
  async isServerActive(index) {
    return await this.page.evaluate(
      (sel, idx) => {
        const el = document.querySelectorAll(sel)[idx];
        return !!(el && el.classList && el.classList.contains('active'));
      },
      '.server',
      index
    );
  }

  // Wait until a given server (0-based index) becomes active within timeout
  async waitForServerActive(index, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, idx) => {
        const el = document.querySelectorAll(sel)[idx];
        return !!(el && el.classList && el.classList.contains('active'));
      },
      '.server',
      index,
      { timeout }
    );
  }

  // Wait until a given server (0-based index) is not active within timeout
  async waitForServerInactive(index, timeout = 500) {
    await this.page.waitForFunction(
      (sel, idx) => {
        const el = document.querySelectorAll(sel)[idx];
        return !!(el && el.classList && !el.classList.contains('active'));
      },
      '.server',
      index,
      { timeout }
    );
  }
}

test.describe('Load Balancing Visualization - FSM tests', () => {
  // Containers for console and page errors per test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize error arrays
    consoleErrors = [];
    pageErrors = [];

    // Listen to console events and collect errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location(),
        });
      }
    });

    // Listen to page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });

    // No navigation here; each test will navigate via the page object.
  });

  test.afterEach(async () => {
    // After each test, assert that there were no console errors or uncaught page errors.
    // If errors occurred, fail the test with details so the broken runtime is visible.
    if (consoleErrors.length > 0 || pageErrors.length > 0) {
      // Build diagnostic message
      let msg = 'Runtime errors were observed during the test run:\n';
      if (consoleErrors.length > 0) {
        msg += `Console errors (${consoleErrors.length}):\n`;
        for (const e of consoleErrors) {
          msg += `  - text: ${e.text}\n`;
          if (e.location) {
            msg += `    location: ${JSON.stringify(e.location)}\n`;
          }
        }
      }
      if (pageErrors.length > 0) {
        msg += `Page errors (${pageErrors.length}):\n`;
        for (const e of pageErrors) {
          msg += `  - message: ${e.message}\n`;
          if (e.stack) {
            msg += `    stack: ${e.stack}\n`;
          }
        }
      }
      // Fail the test with details
      throw new Error(msg);
    }
  });

  test('Initial state S0_Idle - UI is present and servers are inactive', async ({ page }) => {
    // This test validates the Idle state: button exists and servers do not have "active" class.
    const lb = new LoadBalancerPage(page);
    await lb.goto();

    // Assert the Distribute Load button is present and visible
    await expect(lb.button).toBeVisible();
    await expect(lb.button).toBeEnabled();
    await expect(lb.button).toHaveText('Distribute Load');

    // There should be exactly three server visual elements
    const count = await lb.serverCount();
    expect(count).toBe(3);

    // None of the servers should have the 'active' class in Idle state
    for (let i = 0; i < count; i++) {
      const active = await lb.isServerActive(i);
      expect(active).toBe(false);
    }
  });

  test('Transition S0 -> S1 on DistributeLoad click: servers become active with staggered timing', async ({ page }) => {
    // This test validates that clicking the button triggers the Loading animation:
    // each server gets the 'active' class staggered by ~500ms.
    const lb = new LoadBalancerPage(page);
    await lb.goto();

    // Click to distribute load
    await lb.clickDistribute();

    // Server 0 should become active quickly (setTimeout with index 0 => 0ms)
    await lb.waitForServerActive(0, 500); // allow some margin
    expect(await lb.isServerActive(0)).toBe(true);

    // Server 1 should become active roughly after ~500ms
    await lb.waitForServerActive(1, 1000);
    expect(await lb.isServerActive(1)).toBe(true);

    // Server 2 should become active roughly after ~1000ms
    await lb.waitForServerActive(2, 1500);
    expect(await lb.isServerActive(2)).toBe(true);
  });

  test('Transition S1 -> S0 on repeated DistributeLoad: clicking while active removes then re-adds classes', async ({ page }) => {
    // This test validates the FSM transition from Loading back to Idle and re-trigger:
    // Clicking while servers are active removes 'active' classes immediately and then re-applies them staggered.
    const lb = new LoadBalancerPage(page);
    await lb.goto();

    // First click to ensure servers are active
    await lb.clickDistribute();
    await lb.waitForServerActive(0, 500);
    await lb.waitForServerActive(1, 1000);
    await lb.waitForServerActive(2, 1500);

    // Sanity check: all active now
    for (let i = 0; i < 3; i++) {
      expect(await lb.isServerActive(i)).toBe(true);
    }

    // Click again to trigger removal of active classes and staggered re-add
    await lb.clickDistribute();

    // Immediately after the click, servers should have their 'active' class removed.
    // We allow a small timeout for DOM updates.
    for (let i = 0; i < 3; i++) {
      await lb.waitForServerInactive(i, 300); // expect removal to be immediate
      const activeNow = await lb.isServerActive(i);
      expect(activeNow).toBe(false);
    }

    // Then the staggered re-add should happen again
    await lb.waitForServerActive(0, 500);
    expect(await lb.isServerActive(0)).toBe(true);
    await lb.waitForServerActive(1, 1000);
    expect(await lb.isServerActive(1)).toBe(true);
    await lb.waitForServerActive(2, 1500);
    expect(await lb.isServerActive(2)).toBe(true);
  });

  test('Edge case: rapid multiple clicks should not throw errors and results in eventual active servers', async ({ page }) => {
    // This test stresses the event handler by clicking the button rapidly multiple times
    // and verifies that no runtime errors are produced and that servers eventually become active.
    const lb = new LoadBalancerPage(page);
    await lb.goto();

    // Rapid clicks
    await lb.clickDistribute();
    await lb.clickDistribute();
    await lb.clickDistribute();

    // After bursts of clicks, servers should still eventually become active (staggered).
    await lb.waitForServerActive(0, 1000);
    await lb.waitForServerActive(1, 1500);
    await lb.waitForServerActive(2, 2000);

    for (let i = 0; i < 3; i++) {
      expect(await lb.isServerActive(i)).toBe(true);
    }
  });

  test('Event handler existence: DistributeLoad event is wired to the button', async ({ page }) => {
    // This test asserts that the button has an attached click handler by clicking it and observing DOM changes.
    const lb = new LoadBalancerPage(page);
    await lb.goto();

    // Before click: none active
    for (let i = 0; i < 3; i++) {
      expect(await lb.isServerActive(i)).toBe(false);
    }

    // Click should trigger DOM changes (class toggles). If no handler exists, nothing will change.
    await lb.clickDistribute();

    // Wait for at least the first server to reflect the handler action
    await lb.waitForServerActive(0, 500);
    expect(await lb.isServerActive(0)).toBe(true);
  });
});