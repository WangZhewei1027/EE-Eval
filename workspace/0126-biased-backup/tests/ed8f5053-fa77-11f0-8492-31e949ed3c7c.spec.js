import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f5053-fa77-11f0-8492-31e949ed3c7c.html';

// Page Object for the routing demo
class RouterPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.home = page.locator('#home');
    this.about = page.locator('#about');
    this.navigateButton = page.locator('#navigate');
    this.navigateHomeButton = page.locator('#navigate-home');
    this.content = page.locator('#content');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickNavigate() {
    await this.navigateButton.click();
  }

  async clickNavigateHome() {
    await this.navigateHomeButton.click();
  }

  async isHomeActive() {
    return await this.home.evaluate((el) => el.classList.contains('active'));
  }

  async isAboutActive() {
    return await this.about.evaluate((el) => el.classList.contains('active'));
  }

  // Returns computed opacity as string (e.g., "0" or "1")
  async contentComputedOpacity() {
    return await this.content.evaluate((el) => getComputedStyle(el).opacity);
  }

  // Returns inline style opacity if present (may be empty string)
  async contentInlineOpacity() {
    return await this.content.evaluate((el) => el.style.opacity || '');
  }
}

test.describe('Elegant Routing Demo - FSM states and transitions', () => {
  // Arrays to collect console errors and page errors for each test
  let consoleErrors;
  let pageErrors;
  let consoleMessages;
  let handlers;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleErrors = [];
    pageErrors = [];
    consoleMessages = [];
    handlers = [];

    // Attach console listener to capture all console messages, especially errors
    const consoleHandler = (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    };
    page.on('console', consoleHandler);
    handlers.push({ name: 'console', fn: consoleHandler });

    // Attach pageerror listener to capture runtime exceptions
    const pageErrorHandler = (err) => {
      // err is an Error object from the page context
      pageErrors.push(String(err));
    };
    page.on('pageerror', pageErrorHandler);
    handlers.push({ name: 'pageerror', fn: pageErrorHandler });

    // Navigate to the app after listeners are attached to ensure we capture load-time issues
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid leaking between tests (page is per-test fixture, but keep clean)
    for (const h of handlers) {
      page.off(h.name, h.fn);
    }
  });

  test('Initial state (S0_Home): Home should be active, About should not be active', async ({ page }) => {
    // This test validates the initial FSM state S0_Home entry actions and DOM
    const router = new RouterPage(page);

    // Verify the Home page has the 'active' class as per entry action
    const homeActive = await router.isHomeActive();
    expect(homeActive).toBe(true);

    // Verify the About page does NOT have the 'active' class
    const aboutActive = await router.isAboutActive();
    expect(aboutActive).toBe(false);

    // Verify content initial computed opacity is '0' per CSS (content hidden until navigation)
    const computedOpacity = await router.contentComputedOpacity();
    expect(computedOpacity).toBe('0');

    // Buttons should exist and be visible
    await expect(router.navigateButton).toBeVisible();
    await expect(router.navigateHomeButton).toBeVisible();

    // No runtime/page errors should have occurred on initial load
    expect(pageErrors.length).toBe(0);
    // No console error messages should have been emitted
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: NavigateToAbout moves from Home -> About and applies expected observables', async ({ page }) => {
    // This test executes the NavigateToAbout event and asserts exit/entry actions
    const router = new RouterPage(page);

    // Click "Go to About"
    await router.clickNavigate();

    // After clicking, About should become active and Home should lose active class
    // Wait for DOM changes; observe up to a short timeout
    await page.waitForTimeout(50);

    const aboutActive = await router.isAboutActive();
    const homeActive = await router.isHomeActive();
    expect(aboutActive, 'About should have class active after navigating to About').toBe(true);
    expect(homeActive, 'Home should no longer have class active after navigating to About').toBe(false);

    // The script sets content.style.opacity = 1 on navigation: check inline style and computed style
    const inlineOpacity = await router.contentInlineOpacity();
    const computedOpacity = await router.contentComputedOpacity();
    expect(inlineOpacity === '1' || computedOpacity === '1').toBeTruthy();

    // No runtime/page errors should happen as a result of clicking navigate
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: NavigateHome moves from About -> Home and applies expected observables', async ({ page }) => {
    // This test ensures returning to Home works via NavigateHome event
    const router = new RouterPage(page);

    // First navigate to About so we can navigate back
    await router.clickNavigate();
    await page.waitForTimeout(30);

    // Sanity: we are on About
    expect(await router.isAboutActive()).toBe(true);
    expect(await router.isHomeActive()).toBe(false);

    // Click "Back Home"
    await router.clickNavigateHome();
    await page.waitForTimeout(50);

    // After clicking, Home should be active again and About should be inactive
    const homeActiveAfter = await router.isHomeActive();
    const aboutActiveAfter = await router.isAboutActive();
    expect(homeActiveAfter, 'Home should be active after navigating back').toBe(true);
    expect(aboutActiveAfter, 'About should not be active after navigating back').toBe(false);

    // content opacity should be set to 1 (inline style)
    const inlineOpacityAfter = await router.contentInlineOpacity();
    const computedOpacityAfter = await router.contentComputedOpacity();
    expect(inlineOpacityAfter === '1' || computedOpacityAfter === '1').toBeTruthy();

    // No runtime/page errors should happen as a result of clicking navigate-home
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});

test.describe('Robustness, edge cases, and error observations', () => {
  let consoleErrors;
  let pageErrors;
  let handlers;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    handlers = [];

    const consoleHandler = (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    };
    page.on('console', consoleHandler);
    handlers.push({ name: 'console', fn: consoleHandler });

    const pageErrorHandler = (err) => pageErrors.push(String(err));
    page.on('pageerror', pageErrorHandler);
    handlers.push({ name: 'pageerror', fn: pageErrorHandler });

    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    for (const h of handlers) page.off(h.name, h.fn);
  });

  test('Repeated clicking of Navigate does not throw and results in About being active', async ({ page }) => {
    // Clicking the same navigation repeatedly should not throw errors and should result in About active
    const router = new RouterPage(page);

    // Click the "Go to About" button multiple times quickly
    await Promise.all([router.clickNavigate(), router.clickNavigate(), router.clickNavigate()]);

    // Allow microtasks and DOM updates to settle
    await page.waitForTimeout(100);

    // Expect About active and Home inactive
    expect(await router.isAboutActive()).toBe(true);
    expect(await router.isHomeActive()).toBe(false);

    // Ensure no page errors or console errors were emitted during rapid interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Rapid toggling between routes results in stable final state and no runtime errors', async ({ page }) => {
    // Simulate quick user toggling between About and Home to check for race conditions
    const router = new RouterPage(page);

    // Rapid sequence
    await router.clickNavigate(); // to About
    await page.waitForTimeout(20);
    await router.clickNavigateHome(); // back to Home
    await page.waitForTimeout(20);
    await router.clickNavigate(); // to About
    await page.waitForTimeout(50);

    // Final state should reflect the last action: About active
    expect(await router.isAboutActive()).toBe(true);
    expect(await router.isHomeActive()).toBe(false);

    // No runtime/page errors due to rapid toggling
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('No unexpected console errors or page errors during normal usage', async ({ page }) => {
    // This test simply walks the app and asserts error collections remain empty
    const router = new RouterPage(page);

    // Visit About and back to Home
    await router.clickNavigate();
    await page.waitForTimeout(30);
    await router.clickNavigateHome();
    await page.waitForTimeout(30);

    // Collect any console messages for debugging (not required to assert content)
    const allConsoleMsgs = await page.evaluate(() =>
      // collect console is not accessible here; this just demonstrates no exceptions occurred on page
      0
    );

    // Validate no page errors or console errors were captured
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});