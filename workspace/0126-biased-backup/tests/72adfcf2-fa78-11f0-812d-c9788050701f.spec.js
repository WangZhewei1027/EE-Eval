import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/72adfcf2-fa78-11f0-812d-c9788050701f.html';

// Page Object for the Celestial Authentication app
class AuthPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.form = page.locator('.auth-form');
    this.email = page.locator('#email');
    this.password = page.locator('#password');
    this.loginBtn = page.locator('#login-btn');
    this.successMessage = page.locator('#success-message');
    this.closeBtn = page.locator('#close-btn');
    this.starsContainer = page.locator('#stars');
    this.particlesContainer = page.locator('#particles');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async fillCredentials(email, pass) {
    await this.email.fill(email);
    await this.password.fill(pass);
  }

  async submit() {
    await this.loginBtn.click();
  }

  async waitForSuccessActive(timeout = 2000) {
    await this.page.waitForSelector('#success-message.active', { timeout });
  }

  async isSuccessActive() {
    return await this.successMessage.evaluate((el) => el.classList.contains('active'));
  }

  async successOpacity() {
    return await this.successMessage.evaluate((el) => {
      return window.getComputedStyle(el).opacity;
    });
  }

  async starsCount() {
    return await this.starsContainer.evaluate((el) => el.children.length);
  }

  async particlesCount() {
    return await this.particlesContainer.evaluate((el) => el.children.length);
  }
}

test.describe('Celestial Authentication (FSM validation) - 72adfcf2-fa78-11f0-812d-c9788050701f', () => {
  // Capture console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // store the full Error object message for assertions/debugging
      pageErrors.push(err.message || String(err));
    });
  });

  test.afterEach(async ({ page }) => {
    // After each test assert that there were no uncaught page errors
    // This validates that the app didn't throw runtime exceptions during the scenario.
    expect(pageErrors, `Unexpected page errors: ${JSON.stringify(pageErrors, null, 2)}`).toEqual([]);

    // Also assert there are no console messages logged as "error"
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors, `Console 'error' messages found: ${JSON.stringify(consoleErrors, null, 2)}`).toEqual([]);
  });

  test.describe('Initial Idle state (S0_Idle) and entry actions', () => {
    test('renders the auth form, inputs and Sign In button; background assets are created', async ({ page }) => {
      // This test validates the Idle state: the page renders the form and entry actions
      // (renderPage()) are expected to create stars and particles.
      const auth = new AuthPage(page);
      await auth.goto();

      // Verify main form elements exist
      await expect(auth.form).toBeVisible();
      await expect(auth.email).toBeVisible();
      await expect(auth.password).toBeVisible();
      await expect(auth.loginBtn).toBeVisible();

      // Verify the button text
      await expect(auth.loginBtn).toHaveText('Sign In');

      // Check that the decorative entry assets (stars, particles) were created by the page scripts
      const stars = await auth.starsCount();
      const particles = await auth.particlesCount();

      // There should be multiple stars and at least a few particles
      expect(stars).toBeGreaterThanOrEqual(10);
      expect(particles).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Transitions and event handling (FormSubmit -> Success, CloseSuccessMessage -> Idle)', () => {
    test('submitting valid credentials shows success message (S0_Idle -> S1_Success)', async ({ page }) => {
      // This test validates the FormSubmit event triggers the transition to Success
      const auth = new AuthPage(page);
      await auth.goto();

      // Fill inputs with valid values so browser validation allows submit
      await auth.fillCredentials('user@example.com', 'SuperSecret123');

      // Click Sign In to submit; the page's submit handler should add the "active" class
      await auth.submit();

      // Wait for the success message to become active
      await auth.waitForSuccessActive();

      // Assert the success message element has the active class and is visible (opacity/style)
      expect(await auth.isSuccessActive()).toBe(true);
      const opacity = await auth.successOpacity();
      // The CSS sets opacity to '1' when active and '0' when not; accept values close to '1'
      expect(Number(opacity)).toBeGreaterThan(0.9);

      // Verify success content text is present
      await expect(auth.successMessage).toContainText('Authentication Successful');
      await expect(auth.successMessage).toContainText("Welcome back");
    });

    test('clicking close hides the success message and returns to Idle (S1_Success -> S0_Idle)', async ({ page }) => {
      // This test validates the CloseSuccessMessage event transitions back to Idle
      const auth = new AuthPage(page);
      await auth.goto();

      // Show success message first by submitting valid credentials
      await auth.fillCredentials('someone@star.com', 'Password1!');
      await auth.submit();
      await auth.waitForSuccessActive();

      // Now click the close button
      await expect(auth.closeBtn).toBeVisible();
      await auth.closeBtn.click();

      // After clicking, the 'active' class should be removed; wait briefly for transition
      await page.waitForTimeout(300); // let CSS transition run

      expect(await auth.isSuccessActive()).toBe(false);
      // opacity should be small (0) when not active
      const opacityAfter = await auth.successOpacity();
      expect(Number(opacityAfter)).toBeLessThan(0.5);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('submitting with empty required fields does NOT show success message (validation prevents submit)', async ({ page }) => {
      // This test checks the browser's constraint validation prevents the submit event from firing
      // and therefore the success message should not appear.
      const auth = new AuthPage(page);
      await auth.goto();

      // Ensure inputs are empty
      await auth.email.fill('');
      await auth.password.fill('');

      // Click the Sign In button; because inputs are required, the form should not submit
      await auth.submit();

      // Wait a short time to observe whether the success message appears (it should NOT)
      await page.waitForTimeout(400);

      // Assert the success message is still not active
      expect(await auth.isSuccessActive()).toBe(false);
    });

    test('clicking close when success message is not active does not throw and leaves UI stable', async ({ page }) => {
      // This test clicks the close button while the success message is hidden to ensure no errors thrown
      // and no unexpected state changes occur.
      const auth = new AuthPage(page);
      await auth.goto();

      // Ensure the success message is not active initially
      expect(await auth.isSuccessActive()).toBe(false);

      // Click the close button even though it's not active
      // The element exists in the DOM; interactions should be safe
      await auth.closeBtn.click();

      // Wait briefly to allow any event handlers to run (if any)
      await page.waitForTimeout(200);

      // Confirm success message remains not active
      expect(await auth.isSuccessActive()).toBe(false);
    });

    test('verify no runtime exceptions or console errors during a full flow (load, submit, close)', async ({ page }) => {
      // This test performs a full user flow and checks console/page errors captured by the harness.
      const auth = new AuthPage(page);

      // Note: page error and console listeners are attached in beforeEach and checked in afterEach.
      await auth.goto();

      // full flow: fill & submit -> close
      await auth.fillCredentials('fullflow@star.org', 'abcDEF123!');
      await auth.submit();
      await auth.waitForSuccessActive();
      await auth.closeBtn.click();

      // allow short time for any asynchronous errors to bubble up to pageerror
      await page.waitForTimeout(250);
      // The afterEach will assert that no page errors or console error messages were recorded.
    });
  });
});