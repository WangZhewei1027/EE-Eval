import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3e4aa2-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Authentication Demo - FSM validation (de3e4aa2-fa74-11f0-a1b6-4b9b8151441a)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      // store the whole message object for later inspection
      consoleMessages.push(msg);
    });

    // Capture uncaught exceptions from the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond listeners (they are automatically removed with the page)
  });

  test.describe('Initial state: Logged Out (S0_LoggedOut)', () => {
    test('renders login section and hides user section on load', async ({ page }) => {
      // Verify evidence of initial state: #login-section exists and #user-section has hidden class
      const loginSection = page.locator('#login-section');
      const userSection = page.locator('#user-section');

      await expect(loginSection).toBeVisible();
      await expect(userSection).toHaveClass(/hidden/); // user-section should have 'hidden' class

      // Verify presence of username/password inputs and login button (components evidence)
      await expect(page.locator('input#username')).toBeVisible();
      await expect(page.locator('input#password')).toBeVisible();
      await expect(page.locator('button[onclick="login()"]')).toBeVisible();

      // Ensure no uncaught page errors occurred during initial render
      expect(pageErrors.length).toBe(0);
      // Ensure there are no console.error messages logged on load
      const errorConsoleMessages = consoleMessages.filter(m => m.type() === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('shows validation message when attempting login with missing credentials (edge case)', async ({ page }) => {
      // Click login with empty fields
      await page.locator('button[onclick="login()"]').click();

      const message = page.locator('#login-message');
      await expect(message).toBeVisible();
      await expect(message).toHaveText('Please enter both username and password');
      await expect(message).toHaveClass(/error/);

      // Confirm still in logged out state: login-section visible, user-section hidden
      await expect(page.locator('#login-section')).toBeVisible();
      await expect(page.locator('#user-section')).toHaveClass(/hidden/);

      // No uncaught page errors should have occurred
      expect(pageErrors.length).toBe(0);
      const errorConsoleMessages = consoleMessages.filter(m => m.type() === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('shows error message on invalid credentials', async ({ page }) => {
      // Fill invalid credentials
      await page.fill('input#username', 'wrong');
      await page.fill('input#password', 'invalid');
      await page.locator('button[onclick="login()"]').click();

      const message = page.locator('#login-message');
      await expect(message).toBeVisible();
      await expect(message).toHaveText('Invalid username or password');
      await expect(message).toHaveClass(/error/);

      // Verify still logged out
      await expect(page.locator('#login-section')).toBeVisible();
      await expect(page.locator('#user-section')).toHaveClass(/hidden/);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
      const errorConsoleMessages = consoleMessages.filter(m => m.type() === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });
  });

  test.describe('Transition: LoginAttempt (S0_LoggedOut -> S1_LoggedIn)', () => {
    test('successful login transitions to Logged In state and updates UI accordingly', async ({ page }) => {
      // This test validates the transition from Logged Out to Logged In:
      // - login() action is performed by clicking the Login button
      // - login-section becomes hidden
      // - user-section becomes visible
      // - display username is updated
      // - session timer is started and begins decrementing

      // Fill valid credentials for a user present in the mock DB (admin/admin123)
      await page.fill('input#username', 'admin');
      await page.fill('input#password', 'admin123');

      // Intercept initial timer value for comparison after login
      const timerLocator = page.locator('#session-timer');
      // Click login button to trigger login()
      await page.locator('button[onclick="login()"]').click();

      // After successful login, login message should indicate success
      const message = page.locator('#login-message');
      await expect(message).toBeVisible();
      await expect(message).toHaveText('Login successful!');
      await expect(message).toHaveClass(/success/);

      // Verify sections toggled as expected (expected_observables)
      await expect(page.locator('#login-section')).toHaveClass(/hidden/);
      await expect(page.locator('#user-section')).not.toHaveClass(/hidden/);

      // Verify display username updated to the user's name
      await expect(page.locator('#display-username')).toHaveText('Administrator');

      // Verify session timer is present and has been initialized (starts at 5:00)
      const initialTimerText = await timerLocator.textContent();
      expect(initialTimerText).toMatch(/\d+:\d{2}/);

      // Wait 2 seconds to ensure timer decreases (the real app decrements every second)
      // This validates startSessionTimer() behavior indirectly.
      await page.waitForTimeout(2100);
      const laterTimerText = await timerLocator.textContent();

      // The timer should have decreased (not equal to initial), e.g., from 5:00 to 4:57 or similar
      expect(laterTimerText).not.toBe(initialTimerText);

      // Ensure there were no uncaught errors triggered by login action
      expect(pageErrors.length).toBe(0);
      const errorConsoleMessages = consoleMessages.filter(m => m.type() === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('login button has inline onclick handler attribute as evidenced', async ({ page }) => {
      // Verify presence of onclick attribute as part of evidence in FSM
      const loginButton = page.locator('button', { hasText: 'Login' });
      // The outer HTML should contain onclick="login()"
      const outer = await loginButton.evaluate((el) => el.outerHTML);
      expect(outer).toContain('onclick="login()"');
    });
  });

  test.describe('Transition: Logout (S1_LoggedIn -> S0_LoggedOut)', () => {
    test('logging out returns to Logged Out state and clears session', async ({ page }) => {
      // First perform a successful login (reuse valid credentials)
      await page.fill('input#username', 'user1');
      await page.fill('input#password', 'password1');
      await page.locator('button[onclick="login()"]').click();

      // Sanity checks for logged in state
      await expect(page.locator('#login-section')).toHaveClass(/hidden/);
      await expect(page.locator('#user-section')).not.toHaveClass(/hidden/);
      await expect(page.locator('#display-username')).toHaveText('John Doe');

      // Click the logout button to trigger logout()
      await page.locator('button[onclick="logout()"]').click();

      // After logout, login-section should be visible and user-section hidden
      await expect(page.locator('#login-section')).toBeVisible();
      await expect(page.locator('#user-section')).toHaveClass(/hidden/);

      // Username/password inputs should be cleared
      await expect(page.locator('input#username')).toHaveValue('');
      await expect(page.locator('input#password')).toHaveValue('');

      // login-message should show logout success
      await expect(page.locator('#login-message')).toBeVisible();
      await expect(page.locator('#login-message')).toHaveText('You have been logged out');
      await expect(page.locator('#login-message')).toHaveClass(/success/);

      // Ensure no uncaught page errors occurred during logout
      expect(pageErrors.length).toBe(0);
      const errorConsoleMessages = consoleMessages.filter(m => m.type() === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('logout button has inline onclick handler attribute as evidenced', async ({ page }) => {
      // Ensure logout button exists in the DOM (login first to reveal it)
      await page.fill('input#username', 'user2');
      await page.fill('input#password', 'password2');
      await page.locator('button[onclick="login()"]').click();

      const logoutButton = page.locator('button', { hasText: 'Logout' });
      const outer = await logoutButton.evaluate((el) => el.outerHTML);
      expect(outer).toContain('onclick="logout()"');
    });
  });

  test.describe('Edge cases and internal behaviors', () => {
    test('session expiration flow indirectly triggers logout when seconds run out (fast-check by manipulating wait)', async ({ page }) => {
      // We must not modify the page's JS globals. This test will only observe natural behavior.
      // Start a session and then wait a short period to ensure timer runs; we cannot wait full 5 minutes.
      // This test asserts the timer decrements over a small interval, covering the timer logic.
      await page.fill('input#username', 'admin');
      await page.fill('input#password', 'admin123');
      await page.locator('button[onclick="login()"]').click();

      // Read the initial timer value
      const timerLocator = page.locator('#session-timer');
      const t1 = await timerLocator.textContent();

      // Wait a few seconds and ensure it changed (validating updateTimerDisplay and startSessionTimer)
      await page.waitForTimeout(3100);
      const t2 = await timerLocator.textContent();

      expect(t2).not.toBe(t1);

      // No uncaught errors produced by the timer mechanism
      expect(pageErrors.length).toBe(0);
      const errorConsoleMessages = consoleMessages.filter(m => m.type() === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('no unexpected runtime errors on user interactions (capture console and page errors)', async ({ page }) => {
      // Perform a sequence of interactions to attempt to surface runtime errors:
      // - invalid login, valid login, minor wait, logout
      await page.fill('input#username', '');
      await page.fill('input#password', '');
      await page.locator('button[onclick="login()"]').click();

      await page.fill('input#username', 'user1');
      await page.fill('input#password', 'password1');
      await page.locator('button[onclick="login()"]').click();

      await page.waitForTimeout(1000);

      await page.locator('button[onclick="logout()"]').click();

      // Capture any page errors or console.error entries that happened during these interactions
      // The tests should assert whether such errors occurred; here we expect the implementation to be free of uncaught exceptions.
      // If runtime errors do occur naturally, the test will fail here and surface them.
      expect(pageErrors.length).toBe(0);
      const errorConsoleMessages = consoleMessages.filter(m => m.type() === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });
  });
});