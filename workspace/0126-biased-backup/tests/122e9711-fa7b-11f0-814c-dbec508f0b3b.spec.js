import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/122e9711-fa7b-11f0-814c-dbec508f0b3b.html';

// Page Object for the Authentication page
class AuthPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.username = page.locator('#username');
    this.password = page.locator('#password');
    // The page's markup has a Login button without an id; it's the first button[type="button"]
    this.loginButton = page.locator('button[type="button"]').first();
    this.forgotPasswordButton = page.locator('#forgot-password');
    this.createAccountButton = page.locator('#create-account');
    this.registerButton = page.locator('#register');
    this.errorMessage = page.locator('#error-message');
    this.heading = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async fillCredentials(user, pass) {
    await this.username.fill(user);
    await this.password.fill(pass);
  }

  async clickLogin() {
    await this.loginButton.click();
  }

  async clickForgotPassword() {
    await this.forgotPasswordButton.click();
  }

  async clickCreateAccount() {
    await this.createAccountButton.click();
  }

  async clickRegister() {
    await this.registerButton.click();
  }
}

test.describe('Authentication App (FSM validation) - 122e9711-fa7b-11f0-814c-dbec508f0b3b', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];
  let dialogs = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Capture console events
    page.on('console', (msg) => {
      const text = `${msg.type()}: ${msg.text()}`;
      consoleMessages.push(text);
    });

    // Capture uncaught exceptions from the page (pageerror)
    page.on('pageerror', (err) => {
      // err is an Error object; push message for assertions
      pageErrors.push(err.message || String(err));
    });

    // Capture dialogs (alerts)
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      // Accept to avoid blocking the page; still record it
      await dialog.accept().catch(() => {});
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // No special teardown required beyond Playwright fixtures;
    // kept to emphasise lifecycle management per requirements
  });

  test('Initial render (Idle state) - verifies page elements are present', async ({ page }) => {
    // This test validates the S0_Idle state rendering:
    // - H1 "Authentication" should be present
    // - Username and Password inputs should exist
    // - Error message container should exist and start empty
    const auth = new AuthPage(page);

    await expect(auth.heading).toHaveText('Authentication');
    await expect(auth.username).toBeVisible();
    await expect(auth.password).toBeVisible();
    await expect(auth.errorMessage).toBeVisible();
    // The page's JS is broken; however, DOM content is still rendered.
    await expect(auth.errorMessage).toHaveText(''); // initial empty state
  });

  test('Page script failure is observable via page errors (expects a SyntaxError / redeclaration)', async ({ page }) => {
    // The provided HTML contains duplicate variable declarations which should produce a SyntaxError
    // We assert that at least one page error was emitted and that it indicates a redeclaration or syntax issue.
    // This validates that onEnter/onExit script actions may not run due to runtime parse errors.
    // Wait briefly to ensure pageerror events have been delivered
    await page.waitForTimeout(250);

    expect(pageErrors.length).toBeGreaterThan(0);

    // The exact message may vary by browser/engine, so check for common substrings indicative of redeclaration/syntax errors.
    const joined = pageErrors.join(' ');
    expect(joined).toMatch(/already been declared|Identifier|SyntaxError|has already been declared/i);
  });

  test('Clicking interactive buttons does NOT trigger FSM transitions due to script error (no dialogs fired)', async ({ page }) => {
    // Because the page script contains a SyntaxError, event listeners will not be attached.
    // Ensure that clicking the Login / Forgot Password / Create Account / Register controls does not produce alerts.
    const auth = new AuthPage(page);

    // Ensure no dialogs yet
    expect(dialogs.length).toBe(0);

    // Attempt clicks for all relevant events
    await auth.clickLogin();
    await page.waitForTimeout(100);
    await auth.clickForgotPassword();
    await page.waitForTimeout(100);
    await auth.clickCreateAccount();
    await page.waitForTimeout(100);
    await auth.clickRegister();
    await page.waitForTimeout(200);

    // Since the script failed, no dialog() handlers should execute: dialogs should remain empty
    expect(dialogs.length).toBe(0);

    // Also, because the login handler didn't run, error-message text should remain unchanged (empty)
    await expect(auth.errorMessage).toHaveText('');
  });

  test('Edge case: filling credentials and clicking Login should not produce success alert (broken runtime)', async ({ page }) => {
    // This test attempts the successful login transition by filling credentials and clicking Login.
    // Because the runtime script has a SyntaxError, the login handler should not execute and no alert should appear.
    const auth = new AuthPage(page);

    // Fill in credentials
    await auth.fillCredentials('testuser', 's3cret');

    // Try clicking login
    await auth.clickLogin();

    // Wait to allow any potential dialog to appear (there should be none)
    await page.waitForTimeout(200);

    // No dialogs should have been produced
    expect(dialogs.length).toBe(0);

    // Also, the page-level variable isLogin is expected to be set by the script when login succeeds.
    // Because script failed to run, isLogin should be undefined on window.
    const isLoginType = await page.evaluate(() => typeof window.isLogin);
    expect(isLoginType).toBe('undefined');

    // And the error message should still be empty because the handler that sets it didn't execute.
    await expect(auth.errorMessage).toHaveText('');
  });

  test('Diagnostics: console output contains errors related to script parsing or missing elements', async ({ page }) => {
    // Inspect captured console messages to ensure the runtime issues are surfaced in console as well.
    // We assert there is at least one console entry and that it includes known failing identifiers.
    // Wait a moment to capture console logs
    await page.waitForTimeout(200);

    expect(consoleMessages.length).toBeGreaterThan(0);

    const joinedConsole = consoleMessages.join(' ');
    // Look for references to variable names or attempt to access missing elements as likely present in console output.
    expect(joinedConsole).toMatch(/forgotPasswordButton|login-button|create-account-button|register-button|already been declared|Uncaught/i);
  });
});