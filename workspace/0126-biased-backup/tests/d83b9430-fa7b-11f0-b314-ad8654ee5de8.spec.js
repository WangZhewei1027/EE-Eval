import { test, expect } from '@playwright/test';

// Test file for Application ID: d83b9430-fa7b-11f0-b314-ad8654ee5de8
// This suite validates the FSM for the "Minimal Interactive Demonstration (one button only)"
// It checks the Idle state (S0_Idle), the Demo Visible state (S1_DemoVisible),
// and the transitions ShowDemo and HideDemo triggered by clicking #showDemoBtn.
// The tests also observe console logs and page errors and assert there are none.

// URL where the HTML is served
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83b9430-fa7b-11f0-b314-ad8654ee5de8.html';

// Page Object Model for the encryption demo page
class EncryptionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#showDemoBtn');
    this.demo = page.locator('#demoResult');
    this.demoExample = page.locator('#demoResult .example');
  }

  // Wait for core elements to be present in the DOM
  async waitForLoad() {
    await Promise.all([
      this.page.waitForSelector('#showDemoBtn', { state: 'attached' }),
      this.page.waitForSelector('#demoResult', { state: 'attached' })
    ]);
  }

  // Return the button text content
  async getButtonText() {
    return (await this.button.textContent())?.trim() ?? '';
  }

  // Click the toggle button
  async clickToggle() {
    await this.button.click();
  }

  // Whether the demo region is currently visible (computed visibility)
  async isDemoVisible() {
    return await this.demo.isVisible();
  }

  // Whether the demo region has the 'hidden' class
  async demoHasHiddenClass() {
    const classAttr = await this.demo.getAttribute('class');
    if (!classAttr) return false;
    return classAttr.split(/\s+/).includes('hidden');
  }

  // Grab attributes of demo region for accessibility checks
  async getDemoAttributes() {
    const role = await this.demo.getAttribute('role');
    const ariaLive = await this.demo.getAttribute('aria-live');
    const style = await this.demo.getAttribute('style');
    return { role, ariaLive, style };
  }

  // Retrieve the example ciphertext text to validate content when visible
  async getExampleText() {
    return (await this.demoExample.textContent())?.trim() ?? '';
  }
}

test.describe('Encryption Demo FSM - Comprehensive Tests', () => {
  // Collect console messages and page errors across each test
  test.beforeEach(async ({ page }) => {
    // Ensure we fail fast on navigation errors
    await page.goto('about:blank');

    // Clear any listeners and set up new collectors
    page._consoleMessages = [];
    page._pageErrors = [];

    page.on('console', (msg) => {
      page._consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', (err) => {
      page._pageErrors.push(err);
    });

    // Navigate to the application under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Sanity: detach listeners if necessary (cleanup)
    page.removeAllListeners && page.removeAllListeners('console');
    page.removeAllListeners && page.removeAllListeners('pageerror');
  });

  test('S0_Idle: Initial render shows toggle button and demo is hidden', async ({ page }) => {
    // This test validates the initial Idle state (S0_Idle)
    const app = new EncryptionPage(page);
    await app.waitForLoad();

    // Validate the toggle button exists and has correct initial text
    await expect(app.button).toBeVisible();
    const btnText = await app.getButtonText();
    expect(btnText).toBe('Show Caesar Cipher Demo');

    // Validate accessibility attribute aria-controls
    const ariaControls = await app.button.getAttribute('aria-controls');
    expect(ariaControls).toBe('demoResult');

    // Validate the demo region exists and is hidden (by class and by visibility)
    await expect(app.demo).toBeAttached();
    const hasHiddenClass = await app.demoHasHiddenClass();
    expect(hasHiddenClass).toBe(true);

    const visible = await app.isDemoVisible();
    expect(visible).toBe(false);

    // Validate demo's ARIA attributes per FSM / component spec
    const attrs = await app.getDemoAttributes();
    expect(attrs.role).toBe('region');
    expect(attrs.ariaLive).toBe('polite');

    // Observe console and page errors: assert no runtime errors were emitted during load
    // (Collect messages and assert none are of type 'error' and pageErrors is empty)
    const errors = page._consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
    expect(page._pageErrors.length).toBe(0);
  });

  test('ShowDemo transition: clicking button reveals demo and updates button text', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_DemoVisible (ShowDemo event)
    const app = new EncryptionPage(page);
    await app.waitForLoad();

    // Precondition: ensure demo hidden
    expect(await app.isDemoVisible()).toBe(false);
    expect(await app.getButtonText()).toBe('Show Caesar Cipher Demo');

    // Trigger: click the toggle button to show demo
    await app.clickToggle();

    // After click: demo should be visible (class 'hidden' removed), button text updates
    await expect(app.demo).toBeVisible();
    expect(await app.getButtonText()).toBe('Hide Caesar Cipher Demo');

    // Verify demo contains the example ciphertext to ensure content rendered
    const exampleText = await app.getExampleText();
    // The example block contains "Plaintext:" and "Ciphertext:" details; check for ciphertext token
    expect(exampleText).toContain('Plaintext:');
    expect(exampleText).toContain('Ciphertext:');

    // Verify the computed hidden class was removed
    const hasHiddenClassAfter = await app.demoHasHiddenClass();
    expect(hasHiddenClassAfter).toBe(false);

    // Accessibility sanity: role/aria-live should still be present
    const attrs = await app.getDemoAttributes();
    expect(attrs.role).toBe('region');
    expect(attrs.ariaLive).toBe('polite');

    // Observe console and page errors: assert none occurred during interaction
    const errors = page._consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
    expect(page._pageErrors.length).toBe(0);
  });

  test('HideDemo transition: clicking button twice hides demo and restores button text', async ({ page }) => {
    // This test validates the transition S1_DemoVisible -> S0_Idle (HideDemo event)
    const app = new EncryptionPage(page);
    await app.waitForLoad();

    // Click once to show
    await app.clickToggle();
    await expect(app.demo).toBeVisible();
    expect(await app.getButtonText()).toBe('Hide Caesar Cipher Demo');

    // Click again to hide
    await app.clickToggle();

    // After second click: demo should be hidden and button text restored
    await expect(app.demo).not.toBeVisible();
    expect(await app.getButtonText()).toBe('Show Caesar Cipher Demo');

    // Confirm the 'hidden' class is present again
    const hasHiddenClass = await app.demoHasHiddenClass();
    expect(hasHiddenClass).toBe(true);

    // Observe console and page errors: assert none occurred during these clicks
    const errors = page._consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
    expect(page._pageErrors.length).toBe(0);
  });

  test('Edge case: rapid successive clicks toggle state deterministically', async ({ page }) => {
    // This test validates robustness: multiple rapid clicks should still toggle state consistently.
    const app = new EncryptionPage(page);
    await app.waitForLoad();

    // Perform an odd number of clicks and expect visible, even -> hidden
    const clicks = 5;
    for (let i = 0; i < clicks; i++) {
      // Fire clicks with minimal delay to simulate fast user interactions
      await app.button.click();
    }

    // After 5 clicks (odd), demo should be visible
    expect(await app.isDemoVisible()).toBe(true);
    expect(await app.getButtonText()).toBe('Hide Caesar Cipher Demo');

    // Now click once more to make it even (6 total) - should be hidden
    await app.button.click();
    expect(await app.isDemoVisible()).toBe(false);
    expect(await app.getButtonText()).toBe('Show Caesar Cipher Demo');

    // Ensure no JavaScript errors were thrown during rapid interactions
    const errors = page._consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
    expect(page._pageErrors.length).toBe(0);
  });

  test('Accessibility and DOM invariants: button has aria-controls and demo region retains aria-live', async ({ page }) => {
    // This test validates several DOM invariants regardless of state
    const app = new EncryptionPage(page);
    await app.waitForLoad();

    // Validate aria-controls link target exists in DOM
    const ariaControls = await app.button.getAttribute('aria-controls');
    expect(ariaControls).toBe('demoResult');
    const targetExists = await page.$(`#${ariaControls}`);
    expect(targetExists).not.toBeNull();

    // Toggle to visible and ensure aria-live remains set so screen readers are notified
    await app.clickToggle();
    const attrs = await app.getDemoAttributes();
    expect(attrs.ariaLive).toBe('polite');

    // The demo region should retain role=region
    expect(attrs.role).toBe('region');

    // No runtime errors
    const errors = page._consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
    expect(page._pageErrors.length).toBe(0);
  });

  test('Edge case / error scenario observation: ensure no unexpected console errors or uncaught exceptions on load and interactions', async ({ page }) => {
    // This test explicitly collects and asserts the absence of console errors and page errors
    // It is included to satisfy requirement to observe console logs and page errors.
    const app = new EncryptionPage(page);
    await app.waitForLoad();

    // Do a sequence of interactions covering show/hide
    await app.clickToggle(); // show
    await app.clickToggle(); // hide
    await app.clickToggle(); // show

    // Summarize any console messages
    const consoleMessages = page._consoleMessages || [];
    const pageErrors = page._pageErrors || [];

    // If any console error messages exist, fail with diagnostic info
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    if (consoleErrors.length > 0) {
      // Provide diagnostic content for debugging; still assert to fail the test
      const texts = consoleErrors.map(e => e.text).join(' | ');
      throw new Error(`Console errors were emitted during test: ${texts}`);
    }

    // Assert no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });
});