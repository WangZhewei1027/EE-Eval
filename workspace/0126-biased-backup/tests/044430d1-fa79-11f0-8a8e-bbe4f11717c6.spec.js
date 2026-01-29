import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/044430d1-fa79-11f0-8a8e-bbe4f11717c6.html';

// Simple page object for this app to encapsulate selectors and actions
class RoutingExamplePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.navLinkLocator = page.locator('.nav-links li a');
    this.socialLinkLocator = page.locator('.social-links a');
    this.iconLocator = page.locator('.icon');
    this.buttonLocator = page.locator('.button');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async navLinksCount() {
    return await this.navLinkLocator.count();
  }

  async socialLinksCount() {
    return await this.socialLinkLocator.count();
  }

  async hasIcon() {
    return (await this.iconLocator.count()) > 0;
  }

  async hasButton() {
    return (await this.buttonLocator.count()) > 0;
  }

  async clickNavLink(index = 0) {
    const count = await this.navLinkLocator.count();
    if (count === 0) throw new Error('No nav links available to click');
    await this.navLinkLocator.nth(index).click();
  }

  async clickFirstNavLinkExpectingPageError() {
    // Click and return the pageerror that happens as a result (if any).
    // Caller should call page.waitForEvent('pageerror') if they want to await a specific error.
    await this.navLinkLocator.first().click();
  }

  async clickIcon() {
    await this.iconLocator.click();
  }

  async clickButton() {
    await this.buttonLocator.click();
  }
}

test.describe('Routing Example (FSM) - state & transition validation, and runtime errors', () => {
  // Collect page-level errors and console messages for assertions
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleMessages = [];

    // Listen for page errors (uncaught exceptions in page scripts)
    page.on('pageerror', (err) => {
      // store the Error object for later assertions
      pageErrors.push(err);
    });

    // Listen to console events so we can assert prints and absence of prints
    page.on('console', (msg) => {
      try {
        consoleMessages.push(String(msg.text()));
      } catch (e) {
        consoleMessages.push('<unserializable console message>');
      }
    });

    // Navigate to the app page. Do not try to patch or fix runtime errors in the page.
    await page.goto(APP_URL);
  });

  test('Initial DOM structure should match expectations (nav links present, social/icon/button missing)', async ({ page }) => {
    // This test validates that the DOM has the elements the FSM expects in part,
    // and also validates the missing elements which lead to runtime errors.
    const app = new RoutingExamplePage(page);

    // Validate there are exactly 3 navigation links as in the HTML
    const navCount = await app.navLinksCount();
    expect(navCount).toBe(3);

    // Validate social-links are absent in the HTML (expected by the implementation)
    const socialCount = await app.socialLinksCount();
    expect(socialCount).toBe(0);

    // icon and button elements are not present in the provided HTML -> confirm absence
    expect(await app.hasIcon()).toBe(false);
    expect(await app.hasButton()).toBe(false);

    // Because button and icon are absent the script in the page is expected to throw a runtime error
    // during load (TypeError when trying to call addEventListener on null). Assert that at least one
    // pageerror was captured and it's a TypeError.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    // Assert at least one of the captured errors is a TypeError
    const hasTypeError = pageErrors.some((e) => e && e.name === 'TypeError');
    expect(hasTypeError).toBeTruthy();