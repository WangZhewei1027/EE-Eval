import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d16875-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Authentication Demo
class AuthPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.loginForm = page.locator('#loginForm');
    this.signupForm = page.locator('#signupForm');
    this.authStatus = page.locator('#authStatus');
    this.username = page.locator('#username');
    this.password = page.locator('#password');
    this.loginBtn = page.locator('#loginBtn');
    this.showSignup = page.locator('#showSignup');

    this.newUsername = page.locator('#newUsername');
    this.newPassword = page.locator('#newPassword');
    this.signupBtn = page.locator('#signupBtn');
    this.cancelSignup = page.locator('#cancelSignup');

    this.statusMessage = page.locator('#statusMessage');
    this.logoutBtn = page.locator('#logoutBtn');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the main elements are present before interacting
    await Promise.all([
      this.page.waitForSelector('#loginForm'),
      this.page.waitForSelector('#signupForm'),
      this.page.waitForSelector('#authStatus'),
    ]);
  }

  // Helpers to check visibility consistent with .hidden class
  async isLoginFormVisible() {
    return await this.loginForm.isVisible();
  }
  async isSignupFormVisible() {
    return await this.signupForm.isVisible();
  }
  async isAuthStatusVisible() {
    return await this.authStatus.isVisible();
  }
  async isLogoutVisible() {
    return await this.logoutBtn.isVisible();
  }

  async login(username, password) {
    await this.username.fill(username);
    await this.password.fill(password);
    await this.loginBtn.click();
  }

  async openSignup() {
    await this.showSignup.click();
  }

  async signup(newUsername, newPassword) {
    await this.newUsername.fill(newUsername);
    await this.newPassword.fill(newPassword);
    await this.signupBtn.click();
  }

  async cancelSignupFlow() {
    await this.cancelSignup.click();
  }

  async logout() {
    await this.logoutBtn.click();
  }

  async getStatusText() {
    return await this.statusMessage.innerText();
  }

  async getUsernameValue() {
    return await this.username.inputValue();
  }
  async getPasswordValue() {
    return await this.password.inputValue();
  }
}

test.describe('Authentication Demo - FSM tests (99d16875-fa79-11f0-8075-e54a10595dde)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console messages for assertions
    pageErrors = [];
    consoleMessages = [];

    page.on('pageerror', err => {
      // collect runtime errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the app URL
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // After each test assert there are no unexpected runtime errors.
    // If runtime errors were present they will be surfaced here and fail the test.
    // We assert that there are no ReferenceError, TypeError or SyntaxError.
    const criticalErrors = pageErrors.filter(e =>
      /ReferenceError|TypeError|SyntaxError/.test(String(e))
    );
    expect(criticalErrors.length, `Unexpected runtime errors: ${pageErrors.map(String).join('\n')}`).toBe(0);
    // Also assert there were no console.error entries
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.map(c => c.text).join('\n')}`).toBe(0);
  });

  test.describe('Initial State (S0_Login) validations', () => {
    test('Login view should be visible; signup and auth status hidden', async ({ page }) => {
      // Validate initial state of the UI matches FSM S0_Login
      const auth = new AuthPage(page);
      await auth.goto();

      // Login form visible
      expect(await auth.isLoginFormVisible()).toBeTruthy();

      // Signup form hidden
      expect(await auth.isSignupFormVisible()).toBeFalsy();

      // Auth status hidden
      expect(await auth.isAuthStatusVisible()).toBeFalsy();

      // Logout hidden
      expect(await auth.isLogoutVisible()).toBeFalsy();

      // Status message default text should exist in DOM (even if hidden)
      const statusText = await auth.getStatusText();
      expect(statusText.trim()).toBe('You are not logged in.');
    });
  });

  test.describe('Transitions between states', () => {
    test('ShowSignup (S0_Login -> S1_Signup): clicking Sign Up shows signup form', async ({ page }) => {
      const auth = new AuthPage(page);
      await auth.goto();

      // Click "Sign Up"
      await auth.openSignup();

      // After transition: loginForm hidden, signupForm visible
      expect(await auth.isLoginFormVisible()).toBeFalsy();
      expect(await auth.isSignupFormVisible()).toBeTruthy();

      // No auth status
      expect(await auth.isAuthStatusVisible()).toBeFalsy();
    });

    test('CancelSignup (S1_Signup -> S0_Login): clicking Cancel returns to login', async ({ page }) => {
      const auth = new AuthPage(page);
      await auth.goto();

      // Go to signup first
      await auth.openSignup();
      expect(await auth.isSignupFormVisible()).toBeTruthy();

      // Click cancel
      await auth.cancelSignupFlow();

      // After transition: signup hidden, login visible
      expect(await auth.isSignupFormVisible()).toBeFalsy();
      expect(await auth.isLoginFormVisible()).toBeTruthy();
    });

    test('SignupAttempt success (S1_Signup -> S0_Login): creating account returns to login and shows alert', async ({ page }) => {
      const auth = new AuthPage(page);
      await auth.goto();

      // Go to signup
      await auth.openSignup();
      expect(await auth.isSignupFormVisible()).toBeTruthy();

      // Expect an alert with success message when filling both fields
      const dialogPromise = page.waitForEvent('dialog');

      // Fill and submit
      await auth.signup('newuser', 'newpass');

      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Account created successfully! You can now log in.');
      await dialog.accept();

      // After accepting: back to login view
      expect(await auth.isSignupFormVisible()).toBeFalsy();
      expect(await auth.isLoginFormVisible()).toBeTruthy();
    });

    test('SignupAttempt failure: missing fields shows validation alert and stays on signup form', async ({ page }) => {
      const auth = new AuthPage(page);
      await auth.goto();

      // Go to signup
      await auth.openSignup();
      expect(await auth.isSignupFormVisible()).toBeTruthy();

      // Clear inputs to ensure empty
      await auth.newUsername.fill('');
      await auth.newPassword.fill('');

      const dialogPromise = page.waitForEvent('dialog');
      await auth.signup('', '');

      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Please fill in both fields.');
      await dialog.accept();

      // Remain on signup form
      expect(await auth.isSignupFormVisible()).toBeTruthy();
      expect(await auth.isLoginFormVisible()).toBeFalsy();
    });

    test('LoginAttempt success (S0_Login -> S2_Authenticated): valid credentials authenticate', async ({ page }) => {
      const auth = new AuthPage(page);
      await auth.goto();

      // Fill credentials
      await auth.login('alice', 'password123');

      // After login: authStatus visible, statusMessage updated, logout visible, login form hidden
      expect(await auth.isAuthStatusVisible()).toBeTruthy();
      expect(await auth.isLogoutVisible()).toBeTruthy();
      expect(await auth.isLoginFormVisible()).toBeFalsy();

      const status = await auth.getStatusText();
      expect(status).toContain('Welcome, alice! You are logged in.');
    });

    test('LoginAttempt failure: empty fields produce alert and remain on login', async ({ page }) => {
      const auth = new AuthPage(page);
      await auth.goto();

      // Ensure inputs are empty
      await auth.username.fill('');
      await auth.password.fill('');

      const dialogPromise = page.waitForEvent('dialog');
      await auth.login('', '');

      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Please fill in both fields.');
      await dialog.accept();

      // Still in login view
      expect(await auth.isLoginFormVisible()).toBeTruthy();
      expect(await auth.isAuthStatusVisible()).toBeFalsy();
    });

    test('Logout (S2_Authenticated -> S0_Login): logging out hides auth state and clears credentials', async ({ page }) => {
      const auth = new AuthPage(page);
      await auth.goto();

      // Log in successfully first
      await auth.login('bob', 'secure');
      expect(await auth.isAuthStatusVisible()).toBeTruthy();
      expect(await auth.isLogoutVisible()).toBeTruthy();

      // Now click logout
      await auth.logout();

      // After logout: authStatus hidden, login form visible, inputs cleared, logout hidden, status message reset
      expect(await auth.isAuthStatusVisible()).toBeFalsy();
      expect(await auth.isLoginFormVisible()).toBeTruthy();
      expect(await auth.isLogoutVisible()).toBeFalsy();

      const uname = await auth.getUsernameValue();
      const pwd = await auth.getPasswordValue();
      expect(uname).toBe('');
      expect(pwd).toBe('');

      const status = await auth.getStatusText();
      expect(status.trim()).toBe('You are not logged in.');
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Attempt to click logout when not authenticated should do nothing and not throw', async ({ page }) => {
      const auth = new AuthPage(page);
      await auth.goto();

      // logout button is hidden; attempt to click should be guarded by Playwright (will throw if not visible)
      // Instead, simulate checking that it is not visible and no error occurs in console if trying to access it via JS.
      expect(await auth.isLogoutVisible()).toBeFalsy();

      // Execute a safe JS access to the element (should not throw) and confirm it's present but hidden
      const hiddenClass = await page.evaluate(() => {
        const el = document.getElementById('logoutBtn');
        return el ? el.className : null;
      });
      expect(hiddenClass).toContain('hidden');

      // Ensure no runtime errors were generated during this check (captured in afterEach)
    });

    test('Multiple rapid signup/showLogin toggles should maintain consistent DOM state', async ({ page }) => {
      const auth = new AuthPage(page);
      await auth.goto();

      // Rapidly toggle between signup and login UI
      for (let i = 0; i < 5; i++) {
        await auth.openSignup();
        expect(await auth.isSignupFormVisible()).toBeTruthy();
        await auth.cancelSignupFlow();
        expect(await auth.isLoginFormVisible()).toBeTruthy();
      }

      // Final sanity check - still in login view and no auth status visible
      expect(await auth.isLoginFormVisible()).toBeTruthy();
      expect(await auth.isAuthStatusVisible()).toBeFalsy();
    });
  });
});