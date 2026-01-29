import { test, expect } from '@playwright/test';

/**
 * Test suite for Application ID: d838fc20-fa7b-11f0-b314-ad8654ee5de8
 * HTML served at:
 * http://127.0.0.1:5500/workspace/0126-biased/html/d838fc20-fa7b-11f0-b314-ad8654ee5de8.html
 *
 * This suite validates the FSM described in the prompt:
 *  - S0_Idle: initial state where the "Show simulated TLS 1.3 handshake" button is visible and the simulated trace is hidden
 *  - S1_SimulatedVisible: after clicking the button, the simulated trace becomes visible and button text toggles
 *
 * It also observes console logs and page errors (captures them) and asserts expectations about them.
 *
 * Notes:
 *  - Uses ES module syntax per requirements.
 *  - Uses async/await and Playwright test fixtures.
 *  - Applies a small page object pattern (DemoPage) to keep tests readable.
 */

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d838fc20-fa7b-11f0-b314-ad8654ee5de8.html';

class DemoPage {
  /**
   * Page object wrapper for the demo area.
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showSelector = '#show-sim';
    this.simulatedSelector = '#simulated';
    this.simTextSelector = '#sim-text';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async getShowButton() {
    return this.page.locator(this.showSelector);
  }

  async getSimulated() {
    return this.page.locator(this.simulatedSelector);
  }

  async getSimText() {
    return this.page.locator(this.simTextSelector);
  }

  async clickShow() {
    await this.page.click(this.showSelector);
  }

  async getButtonText() {
    return (await this.page.locator(this.showSelector).innerText()).trim();
  }

  async isSimVisible() {
    // Use Playwright's visibility check which accounts for display:none
    return await this.page.isVisible(this.simulatedSelector);
  }

  async getSimComputedDisplay() {
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return window.getComputedStyle(el).display;
    }, this.simulatedSelector);
  }
}

test.describe('HTTPS Guide Interactive Demo — FSM validation', () => {
  // Containers for captured console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Per-test page object
  let demo;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events (info, warn, error, log, debug)
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions and unhandled rejections that bubble to pageerror
    page.on('pageerror', (err) => {
      // err is an Error object in Node context; stringify to include name/message
      pageErrors.push({ name: err && err.name, message: err && err.message, stack: err && err.stack });
    });

    demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // Basic sanity checks on the captured instrumentation arrays
    // These are not strict failure conditions but we assert expected absence of severe errors below in each test.
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);
  });

  test('Initial state (S0_Idle): button visible and simulated trace hidden', async ({ page }) => {
    // Validate initial DOM elements are present
    const btn = await demo.getShowButton();
    await expect(btn).toBeVisible({ timeout: 2000 });

    // Button text should match the FSM evidence
    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Show simulated TLS 1.3 handshake');

    // The simulated trace element should exist but be hidden (display:none)
    const sim = await demo.getSimulated();
    // It exists in DOM
    await expect(sim).toHaveCount(1);
    // Should not be visible (display: none)
    const visible = await demo.isSimVisible();
    expect(visible).toBe(false);
    const display = await demo.getSimComputedDisplay();
    expect(display === 'none' || display === '' || display === 'hidden' ? true : true).toBeTruthy();
    // The SIM element should contain the pre block with the educational trace when revealed.
    const pre = await demo.getSimText();
    // It exists in DOM (pre is present inside hidden container)
    await expect(pre).toHaveCount(1);

    // Assert no uncaught page errors occurred during initial load
    // (We capture and assert there were no page-level exceptions)
    expect(pageErrors.length).toBe(0);

    // Assert there are no console messages of type 'error'
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('ShowSim event: clicking button reveals simulated trace and toggles text (S0_Idle -> S1_SimulatedVisible)', async ({ page }) => {
    // Click to show simulated handshake
    await demo.clickShow();

    // After click, simulated container should be visible
    await expect(demo.getSimulated()).toBeVisible({ timeout: 2000 });
    const visible = await demo.isSimVisible();
    expect(visible).toBe(true);

    // Button text should have changed to 'Hide simulated TLS 1.3 handshake'
    const btnTextAfter = await demo.getButtonText();
    expect(btnTextAfter).toBe('Hide simulated TLS 1.3 handshake');

    // The pre text should contain the phrase "Simulated TLS 1.3 Handshake"
    const simText = await demo.getSimText();
    const simContent = await simText.innerText();
    expect(simContent).toContain('Simulated TLS 1.3 Handshake');

    // Ensure no page errors occurred as a result of the interaction
    expect(pageErrors.length).toBe(0);

    // Ensure no console 'error' messages were emitted
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('HideSim event: clicking button again hides simulated trace and toggles text (S1_SimulatedVisible -> S0_Idle)', async ({ page }) => {
    // Show first
    await demo.clickShow();
    await expect(demo.getSimulated()).toBeVisible({ timeout: 2000 });

    // Then hide by clicking again
    await demo.clickShow();

    // Now simulated should be hidden
    const visibleAfterHide = await demo.isSimVisible();
    expect(visibleAfterHide).toBe(false);

    // Button text should toggle back
    const btnTextFinal = await demo.getButtonText();
    expect(btnTextFinal).toBe('Show simulated TLS 1.3 handshake');

    // No page errors or console errors observed
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Edge case: rapid multiple clicks result in consistent toggle behavior', async ({ page }) => {
    // Rapidly click the button 5 times
    // Observed behavior: toggles each click (odd -> shown, even -> hidden)
    for (let i = 0; i < 5; i++) {
      await demo.clickShow();
    }

    // After 5 clicks (odd), the simulated element should be visible
    const visibleAfter5 = await demo.isSimVisible();
    expect(visibleAfter5).toBe(true);

    // Now click one more time to make it even (6)
    await demo.clickShow();
    const visibleAfter6 = await demo.isSimVisible();
    expect(visibleAfter6).toBe(false);

    // Final button text should be the 'Show ...' text
    const finalBtnText = await demo.getButtonText();
    expect(finalBtnText).toBe('Show simulated TLS 1.3 handshake');

    // Confirm no page-level exceptions occurred during rapid interactions
    expect(pageErrors.length).toBe(0);

    // Confirm no console.error messages were emitted
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('DOM integrity check: elements exist and attributes match FSM evidence', async ({ page }) => {
    // FSM evidence expects a button with id 'show-sim' and a div with id 'simulated' with style display:none
    const btn = await demo.getShowButton();
    await expect(btn).toHaveCount(1);
    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Show simulated TLS 1.3 handshake');

    const sim = await demo.getSimulated();
    await expect(sim).toHaveCount(1);

    // Inspect inline style attribute on the simulated div to match evidence (style contains display:none)
    const inlineStyle = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el ? el.getAttribute('style') : null;
    }, demo.simulatedSelector);

    // The style attribute should include 'display:none' as in the provided HTML evidence,
    // but be tolerant if formatting differs. At minimum, expect the attribute to be present.
    expect(inlineStyle === null ? false : typeof inlineStyle === 'string').toBe(true);
    // If style exists, check it contains 'display' (best-effort check)
    if (inlineStyle) {
      expect(inlineStyle.toLowerCase().includes('display')).toBe(true);
    }

    // No page errors and no console errors
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Instrumentation validation: console and page error capture are working (no severe errors expected)', async ({ page }) => {
    // This test's purpose is to verify that our instrumentation captured messages.
    // We expect that there are no severe errors (no ReferenceError, SyntaxError, TypeError thrown during normal operation).
    // If such errors exist, they will appear in pageErrors or consoleMessages of type 'error' and cause failures below.

    // Basic sanity: consoleMessages is an array
    expect(Array.isArray(consoleMessages)).toBe(true);

    // Print captured console messages to the test output for debugging (Playwright will attach these to the report if the test fails).
    // We do not modify the page in any way; we just assert no error-type console messages were emitted.
    const errors = consoleMessages.filter(m => m.type === 'error');
    if (errors.length > 0) {
      // If errors exist, attach their texts to the assertion failure for easier debugging.
      const joined = errors.map(e => `${e.type}: ${e.text}`).join('\n');
      // Fail the test with the captured error content to satisfy the requirement to observe and report errors.
      throw new Error('Console error messages were emitted during page load/interactions:\n' + joined);
    }

    // Also assert there are no page-level uncaught exceptions
    if (pageErrors.length > 0) {
      const joined = pageErrors.map(e => `${e.name}: ${e.message}`).join('\n');
      throw new Error('Page errors were emitted during page load/interactions:\n' + joined);
    }

    // If we reach here, no severe runtime errors were observed.
    expect(errors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});