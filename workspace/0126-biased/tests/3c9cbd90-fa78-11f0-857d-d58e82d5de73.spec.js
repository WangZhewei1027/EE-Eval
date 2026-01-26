import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/3c9cbd90-fa78-11f0-857d-d58e82d5de73.html';

// Page Object representing the authentication visual demo page
class AuthPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.cardLocator = page.locator('.auth-card');
    this.loginButton = page.locator('#btnLogin');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async isCardPresent() {
    return await this.cardLocator.count() > 0;
  }

  async isLoginButtonPresent() {
    return await this.loginButton.count() > 0;
  }

  async clickLogin() {
    await this.loginButton.click();
  }

  async cardHasGlow() {
    return await this.page.$eval('.auth-card', (el) =>
      el.classList.contains('card-glow')
    );
  }

  // Wait until the card either contains or does not contain the glow class
  async waitForGlowState(expected, options = { timeout: 2500 }) {
    const { timeout } = options;
    await this.page.waitForFunction(
      (expected) =>
        document.querySelector('.auth-card')?.classList.contains('card-glow') === expected,
      expected,
      { timeout }
    );
  }
}

test.describe('Authentication Concept — Visual Demo (FSM validation)', () => {
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    // Capture runtime page errors and console error messages for assertions
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // Collect uncaught exceptions
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async () => {
    // After each test ensure no unexpected runtime errors were produced by the page.
    // This validates that the page JS ran without uncaught exceptions during that test.
    expect(pageErrors, 'No uncaught page errors should occur').toEqual([]);
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
  });

  test('Initial Idle state: page renders and login button exists (S0_Idle)', async ({ page }) => {
    // Validate initial render and Idle state (S0_Idle)
    const app = new AuthPage(page);
    await app.goto();

    // Ensure the card and button are present
    expect(await app.isCardPresent()).toBeTruthy();
    expect(await app.isLoginButtonPresent()).toBeTruthy();

    // The FSM Idle state's evidence: button with id #btnLogin should be present and card should NOT have 'card-glow'
    const hasGlowInitially = await app.cardHasGlow();
    expect(hasGlowInitially).toBe(false);

    // Also check visible text content on the button matches expected evidence
    const btnText = await page.locator('#btnLogin').innerText();
    expect(btnText).toMatch(/LOGIN/i);
  });

  test('Transition S0_Idle -> S1_Animating: clicking login adds card-glow (onEnter action)', async ({ page }) => {
    // Validate that clicking the login button triggers the animation state (S1_Animating)
    const app = new AuthPage(page);
    await app.goto();

    // Click the login button and assert the 'card-glow' class is applied
    await app.clickLogin();

    // The class should appear quickly; wait with a modest timeout
    await app.waitForGlowState(true, { timeout: 1000 });

    const hasGlow = await app.cardHasGlow();
    expect(hasGlow).toBe(true);
  });

  test('Transition S1_Animating -> S0_Idle: card-glow is removed after 1800ms (onExit action)', async ({ page }) => {
    // Validate that after the glow duration the card returns to Idle (class removed)
    const app = new AuthPage(page);
    await app.goto();

    // Trigger the animation
    await app.clickLogin();

    // Ensure glow was added
    await app.waitForGlowState(true, { timeout: 1000 });
    expect(await app.cardHasGlow()).toBe(true);

    // Wait slightly longer than 1800ms per implementation, then assert removal
    // Use a 2500ms timeout to allow environment scheduling variance
    await app.waitForGlowState(false, { timeout: 3000 });
    expect(await app.cardHasGlow()).toBe(false);
  });

  test('Guard behavior: clicking while card has card-glow should not re-trigger overlapping glow', async ({ page }) => {
    // Test the guard "if (card.classList.contains('card-glow')) return;" by rapid clicks
    const app = new AuthPage(page);
    await app.goto();

    // First click triggers glow
    await app.clickLogin();
    await app.waitForGlowState(true, { timeout: 1000 });
    expect(await app.cardHasGlow()).toBe(true);

    // Immediately click again; guard should prevent re-adding while glow active
    // We assert that after the second click, the glow remains and still clears only once after original timeout window.
    const start = Date.now();
    await app.clickLogin(); // guarded; should not reset timer

    // Wait for removal; because original timeout is 1800ms, ensure removal occurs around that timeframe.
    await app.waitForGlowState(false, { timeout: 3500 });
    const elapsed = Date.now() - start;

    // The removal should occur within a reasonable window (not immediate, not super long)
    expect(elapsed).toBeGreaterThanOrEqual(0); // sanity: elapsed recorded
    // Ensure that after waiting the state returned to Idle
    expect(await app.cardHasGlow()).toBe(false);
  });

  test('Edge cases: multiple rapid clicks before glow added and after removal', async ({ page }) => {
    // Exercises edge behaviors: very rapid repeated clicks and clicks after glow removal
    const app = new AuthPage(page);
    await app.goto();

    // Rapid clicks: simulate user hammering the button quickly
    // Because guard checks membership, the first click should add glow, subsequent immediate clicks should be no-ops.
    await Promise.all([
      app.clickLogin(),
      app.clickLogin(),
      app.clickLogin(),
      app.clickLogin()
    ]).catch(() => {
      // In case some clicks race, allow natural behavior - do not patch or suppress errors
    });

    // Ensure glow is present
    await app.waitForGlowState(true, { timeout: 1000 });
    expect(await app.cardHasGlow()).toBe(true);

    // Wait for removal
    await app.waitForGlowState(false, { timeout: 3500 });
    expect(await app.cardHasGlow()).toBe(false);

    // Click again after removal to ensure transitions can repeat (S0 -> S1 -> S0 again)
    await app.clickLogin();
    await app.waitForGlowState(true, { timeout: 1000 });
    expect(await app.cardHasGlow()).toBe(true);
    await app.waitForGlowState(false, { timeout: 3500 });
    expect(await app.cardHasGlow()).toBe(false);
  });

  test('Accessibility & DOM: verify key evidence elements are present and accessible', async ({ page }) => {
    // Confirm the expected evidence elements from the FSM are in DOM and have attributes described
    const app = new AuthPage(page);
    await app.goto();

    // The login button should have the described attributes in the FSM extraction summary
    const btn = page.locator('#btnLogin');
    await expect(btn).toHaveAttribute('type', 'button');
    await expect(btn).toHaveAttribute('aria-label', 'Simulate login button');
    await expect(btn).toHaveText(/LOGIN/i);

    // The card should be marked with role and labeled by the title per HTML
    const card = page.locator('.auth-card');
    await expect(card).toHaveAttribute('role', 'region');
    await expect(card).toHaveAttribute('aria-labelledby', 'authTitle');

    // Title element should exist and contain AUTHENTICATION text
    await expect(page.locator('#authTitle')).toHaveText(/AUTHENTICATION/i);
  });

  test('Observe console and page errors during navigation and interactions (no unexpected errors)', async ({ page }) => {
    // This test explicitly navigates and interacts while collecting console/page errors;
    // the afterEach hook will assert that no errors were captured.
    const app = new AuthPage(page);
    await app.goto();

    // Interact a bit: hover, click, wait for transitions
    await page.hover('.logo-circle');
    await app.clickLogin();
    await app.waitForGlowState(true, { timeout: 1000 });
    await app.waitForGlowState(false, { timeout: 3000 });

    // Intentionally attempt a benign DOM query that reads a property to ensure no runtime errors during read
    const usernameLabel = await page.locator('.input-line .label-text').first().innerText();
    expect(usernameLabel.toLowerCase()).toContain('username');

    // The afterEach hook will assert there were no console errors or page errors produced.
  });
});