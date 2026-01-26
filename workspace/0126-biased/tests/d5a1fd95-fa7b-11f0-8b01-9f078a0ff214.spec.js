import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1fd95-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object encapsulating interactions with the demo page
class SchedulingDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator("button[onclick='showDemo()']");
    this.demo = page.locator('#demo');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure the page has finished loading main elements
    await expect(this.button).toBeVisible({ timeout: 5000 });
  }

  async clickShowDemo() {
    await this.button.click();
  }

  async isDemoVisible() {
    // Use getComputedStyle to check visibility because style.display may be empty if CSS applied.
    return await this.page.evaluate(() => {
      const el = document.getElementById('demo');
      if (!el) return false;
      return window.getComputedStyle(el).display === 'block';
    });
  }

  async getButtonText() {
    return await this.button.innerText();
  }

  async getDemoHeadingText() {
    const el = this.page.locator('#demo h3');
    return await el.innerText();
  }

  async removeDemoElement() {
    await this.page.evaluate(() => {
      const el = document.getElementById('demo');
      if (el && el.parentNode) el.parentNode.removeChild(el);
    });
  }

  async hasOnClickAttribute() {
    return await this.page.evaluate(() => {
      const btn = document.querySelector("button[onclick='showDemo()']");
      return btn ? btn.getAttribute('onclick') : null;
    });
  }
}

// Group related tests for the CPU Scheduling demo FSM
test.describe('CPU Scheduling Demo FSM - d5a1fd95-fa7b-11f0-8b01-9f078a0ff214', () => {
  // arrays capture runtime console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  // Attach listeners before each test and navigate to the page
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Test initial Idle state (S0_Idle): button present and demo hidden
  test('S0_Idle: initial render - button present and demo hidden', async ({ page }) => {
    const p = new SchedulingDemoPage(page);
    // Navigate to the exact URL as provided
    await p.goto();

    // Validate the button exists and has the expected label
    await expect(p.button).toHaveCount(1);
    const btnText = await p.getButtonText();
    expect(btnText.trim()).toBe('See a Simple Scheduling Demo');

    // Validate the demo element exists in DOM but is not visible (display: none via CSS)
    const demoExists = await page.locator('#demo').count();
    expect(demoExists).toBe(1);

    const visible = await p.isDemoVisible();
    expect(visible).toBe(false);

    // Verify the onclick attribute points to showDemo()
    const onclickAttr = await p.hasOnClickAttribute();
    expect(onclickAttr).toBe("showDemo()");

    // Ensure no uncaught errors were produced during initial load
    expect(pageErrors.length).toBe(0);

    // No console errors expected; gather any console messages but do not fail on benign logs
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  // Test S0_Idle -> S1_DemoVisible transition via ShowDemo click
  test('Transition S0_Idle -> S1_DemoVisible: click shows demo', async ({ page }) => {
    const p = new SchedulingDemoPage(page);
    await p.goto();

    // Click the button to show the demo
    await p.clickShowDemo();

    // Demo should now be visible (display: block)
    await expect.poll(async () => await p.isDemoVisible(), {
      timeout: 2000,
      message: 'Waiting for demo to become visible after clicking'
    }).toBe(true);

    // Check demo content to ensure correct rendering
    const heading = await p.getDemoHeadingText();
    expect(heading).toContain('Demonstration of Round Robin Scheduling');

    // Ensure no page errors were raised by this normal interaction
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors emitted
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  // Test S1_DemoVisible -> S2_DemoHidden transition via ShowDemo click
  test('Transition S1_DemoVisible -> S2_DemoHidden: click hides demo', async ({ page }) => {
    const p = new SchedulingDemoPage(page);
    await p.goto();

    // Ensure demo is visible first
    await p.clickShowDemo();
    await expect.poll(async () => await p.isDemoVisible(), { timeout: 2000 }).toBe(true);

    // Click again to hide
    await p.clickShowDemo();

    // Demo should now be hidden
    await expect.poll(async () => await p.isDemoVisible(), { timeout: 2000 }).toBe(false);

    // Confirm no uncaught errors or console errors occurred
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  // Test S2_DemoHidden -> S1_DemoVisible transition via ShowDemo click
  test('Transition S2_DemoHidden -> S1_DemoVisible: click shows demo again', async ({ page }) => {
    const p = new SchedulingDemoPage(page);
    await p.goto();

    // Toggle twice: show then hide to reach S2 (hidden)
    await p.clickShowDemo();
    await expect.poll(async () => await p.isDemoVisible(), { timeout: 2000 }).toBe(true);
    await p.clickShowDemo();
    await expect.poll(async () => await p.isDemoVisible(), { timeout: 2000 }).toBe(false);

    // Now click to go back to visible
    await p.clickShowDemo();
    await expect.poll(async () => await p.isDemoVisible(), { timeout: 2000 }).toBe(true);

    // Validate content again
    const heading = await p.getDemoHeadingText();
    expect(heading).toMatch(/Round Robin/);

    // No page errors expected for normal toggle
    expect(pageErrors.length).toBe(0);
  });

  // Verify mentioned entry action renderPage() - we check for its presence and ensure lack of it doesn't break page
  test('Verify entry action renderPage() is not defined but page still functions', async ({ page }) => {
    const p = new SchedulingDemoPage(page);
    await p.goto();

    // Check if a global renderPage function exists
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    // The FSM mentions renderPage() as an entry action, but the implementation does not provide it.
    // Assert that it is not defined (so we detect discrepancy) and that the app still loads and works.
    expect(hasRenderPage).toBe(false);

    // Ensure normal interaction still works
    await p.clickShowDemo();
    await expect.poll(async () => await p.isDemoVisible(), { timeout: 2000 }).toBe(true);

    // No page errors for this normal scenario
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: remove the demo element from the DOM and then trigger the click.
  // This should cause the showDemo() function to attempt demo.style and produce a runtime TypeError.
  test('Edge case / error scenario: clicking when demo element is missing should produce a page error', async ({ page }) => {
    const p = new SchedulingDemoPage(page);
    await p.goto();

    // Remove the demo element to simulate a broken DOM scenario
    await p.removeDemoElement();

    // Wait for the DOM mutation to take effect
    const demoCount = await page.locator('#demo').count();
    expect(demoCount).toBe(0);

    // Create a promise that resolves on the next pageerror event
    const errorPromise = page.waitForEvent('pageerror');

    // Attempt to click the button which calls showDemo(); because #demo is missing,
    // accessing demo.style should throw a TypeError in the page context.
    await p.clickShowDemo();

    // Wait for the error event to be emitted, with timeout to avoid flakiness
    const err = await errorPromise;

    // Basic assertions about the captured error: ensure it's an Error and message references 'style' or 'null'
    expect(err).toBeTruthy();
    const msg = String(err.message || err.toString() || '');
    const looksLikeNullStyleAccess = /style/.test(msg) && /null|undefined|cannot/i.test(msg);
    // Allow for various browser messages, check heuristically
    expect(looksLikeNullStyleAccess).toBe(true);

    // Confirm our aggregated pageErrors captured the same error
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // We expect at least one console entry (depending on runtime this may or may not be an error),
    // but the core assertion is that an uncaught exception occurred and was observed.
  });

  // Additional robustness check: multiple rapid toggles should not throw errors
  test('Robustness: rapid toggles of show/hide should not produce uncaught exceptions', async ({ page }) => {
    const p = new SchedulingDemoPage(page);
    await p.goto();

    // Rapidly click the button multiple times
    for (let i = 0; i < 6; i++) {
      await p.clickShowDemo();
      // small delay to allow DOM updates; do not await for full stability so it's "rapid"
      await page.waitForTimeout(50);
    }

    // After rapid toggles, demo should be in a consistent boolean state (either visible or hidden).
    // Check that reading visibility does not throw and returns boolean.
    const visible = await p.isDemoVisible();
    expect(typeof visible).toBe('boolean');

    // Ensure no uncaught errors were produced during these rapid interactions
    // (we tolerate 0 pageErrors for normal behavior)
    expect(pageErrors.length).toBe(0);
  });
});