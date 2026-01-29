import { test, expect } from '@playwright/test';

// File: 325045f4-fa73-11f0-a9d0-d7a1991987c6.spec.js
// Tests for Authentication Demo (Application ID: 325045f4-fa73-11f0-a9d0-d7a1991987c6)
// Served at: http://127.0.0.1:5500/workspace/0126-balanced/html/325045f4-fa73-11f0-a9d0-d7a1991987c6.html

// Page Object for the login page to keep tests organized and readable
class LoginPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.username = page.locator('#username');
    this.password = page.locator('#password');
    this.form = page.locator('#loginForm');
    this.submitButton = page.locator('button[type="submit"]');
    this.message = page.locator('#message');
    this.title = page.locator('h1');
  }

  async goto(url) {
    await this.page.goto(url);
  }

  async fillUsername(value) {
    await this.username.fill(value);
  }

  async fillPassword(value) {
    await this.password.fill(value);
  }

  async clickSubmit() {
    await this.submitButton.click();
  }

  async submitViaForm() {
    // trigger submit by clicking submit button to allow browser validation to run
    await this.clickSubmit();
  }

  async getMessageText() {
    return (await this.message.textContent()) ?? '';
  }

  async getMessageClasses() {
    return (await this.message.getAttribute('class')) ?? '';
  }

  async isUsernameRequired() {
    return await this.page.$eval('#username', el => el.required);
  }

  async isPasswordRequired() {
    return await this.page.$eval('#password', el => el.required);
  }

  async titleText() {
    return (await this.title.textContent()) ?? '';
  }

  async formExists() {
    return (await this.page.$('#loginForm')) !== null;
  }
}

test.describe('Authentication Demo - FSM Validation (Application ID: 325045f4-fa73-11f0-a9d0-d7a1991987c6)', () => {
  const url = 'http://127.0.0.1:5500/workspace/0126-balanced/html/325045f4-fa73-11f0-a9d0-d7a1991987c6.html';

  // capture console messages and page errors per test so we can assert on them
  test.beforeEach(async ({ page }) => {
    // Clear any default listeners and collect messages
    page.__consoleMessages = [];
    page.__pageErrors = [];

    page.on('console', msg => {
      // store type and text for debugging assertions
      page.__consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // store the error object / message
      page.__pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Assert that no uncaught page errors occurred during the test.
    // The application as provided should not throw runtime page errors.
    // If there are errors, surface them as test failures with helpful messages.
    const pageErrors = page.__pageErrors ?? [];
    if (pageErrors.length > 0) {
      // Re-throw the first error to fail the test and provide stack trace
      throw new Error(`Unexpected page errors detected: ${pageErrors.map(e => String(e)).join('\n')}`);
    }

    // Also assert that there are no console messages of type 'error'.
    const consoleErrors = (page.__consoleMessages ?? []).filter(m => m.type === 'error');
    expect(consoleErrors, `No console.error messages expected, found: ${JSON.stringify(consoleErrors)}`).toHaveLength(0);
  });

  test.describe('Initial Render / Idle State (S0_Idle)', () => {
    test('renders login page with heading and form (entry action renderPage())', async ({ page }) => {
      const login = new LoginPage(page);
      await login.goto(url);

      // Validate H1 exists and contains "Login" - evidence of S0_Idle
      const title = await login.titleText();
      expect(title.trim()).toBe('Login');

      // Validate the form exists and has the expected id
      expect(await login.formExists()).toBe(true);

      // Validate message div exists and initially empty (entry state)
      const messageText = await login.getMessageText();
      expect(messageText).toBe('');

      // The HTML initially gives the message div class 'success' by default.
      // This is part of the provided implementation and should be present.
      const messageClasses = await login.getMessageClasses();
      expect(messageClasses.split(/\s+/).filter(Boolean)).toContain('success');

      // Validate inputs have required attributes as indicated in the FSM components
      expect(await login.isUsernameRequired()).toBe(true);
      expect(await login.isPasswordRequired()).toBe(true);
    });

    test('attempting to submit with empty required fields does not call submit handler (browser validation)', async ({ page }) => {
      const login1 = new LoginPage(page);
      await login.goto(url);

      // Ensure fields are empty
      await login.fillUsername('');
      await login.fillPassword('');

      // Click submit - browser validation should prevent the submit event from firing.
      // As a result the message div should remain unchanged (empty text).
      await login.submitViaForm();

      // Small wait to allow any unexpected handlers to run
      await page.waitForTimeout(150);

      const messageText1 = await login.getMessageText();
      // Since browser validation blocks submit, message should still be empty
      // (the script clears and updates message on submit; if submit did not run, it remains as initial)
      expect(messageText).toBe('');
    });
  });

  test.describe('SubmitLogin event and transitions (SubmitLogin)', () => {
    test('valid credentials transition to Success state (S1_Success)', async ({ page }) => {
      const login2 = new LoginPage(page);
      await login.goto(url);

      // Fill valid hardcoded credentials as provided in the implementation
      await login.fillUsername('user');
      await login.fillPassword('pass');

      // Submit the form
      await login.submitViaForm();

      // Wait for any DOM updates
      await page.waitForTimeout(100);

      // Validate message text and class per S1_Success evidence
      const messageText2 = await login.getMessageText();
      expect(messageText).toBe('Login successful!');

      const classes = (await login.getMessageClasses()).split(/\s+/).filter(Boolean);
      expect(classes).toContain('success');
      expect(classes).not.toContain('error');

      // Additional check: ensure the h1 and form remain present after success (page doesn't navigate)
      expect(await login.titleText()).toBe('Login');
      expect(await login.formExists()).toBe(true);
    });

    test('invalid credentials transition to Error state (S2_Error)', async ({ page }) => {
      const login3 = new LoginPage(page);
      await login.goto(url);

      // Fill invalid credentials
      await login.fillUsername('wrongUser');
      await login.fillPassword('wrongPass');

      // Submit the form
      await login.submitViaForm();

      // Wait for any DOM updates
      await page.waitForTimeout(100);

      // Validate message text and class per S2_Error evidence
      const messageText3 = await login.getMessageText();
      expect(messageText).toBe('Invalid username or password!');

      const classes1 = (await login.getMessageClasses()).split(/\s+/).filter(Boolean);
      expect(classes).toContain('error');
      expect(classes).not.toContain('success');

      // The form should still be present after the error
      expect(await login.formExists()).toBe(true);
    });

    test('edge case: whitespace-only credentials are treated as invalid and produce Error state', async ({ page }) => {
      const login4 = new LoginPage(page);
      await login.goto(url);

      // Fill whitespace - these are non-empty so browser validation won't block submit
      await login.fillUsername('   ');
      await login.fillPassword('   ');

      // Submit
      await login.submitViaForm();

      // Wait for DOM updates
      await page.waitForTimeout(100);

      // Should be treated as invalid by simple equality check in implementation
      const messageText4 = await login.getMessageText();
      expect(messageText).toBe('Invalid username or password!');

      const classes2 = (await login.getMessageClasses()).split(/\s+/).filter(Boolean);
      expect(classes).toContain('error');
    });
  });

  test.describe('Observability and runtime errors', () => {
    test('no uncaught page errors or console.error messages during typical flows', async ({ page }) => {
      const login5 = new LoginPage(page);
      await login.goto(url);

      // Perform a typical flow: successful login
      await login.fillUsername('user');
      await login.fillPassword('pass');
      await login.submitViaForm();

      // Wait to allow any potential errors to surface
      await page.waitForTimeout(200);

      // Assert collected pageerrors and console errors arrays are empty.
      // Note: the global afterEach also asserts this, but we include a dedicated test here
      // to make the expectation explicit for this flow.
      const pageErrors1 = page.__pageErrors ?? [];
      expect(pageErrors.length).toBe(0);

      const consoleErrors1 = (page.__consoleMessages ?? []).filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('observes console messages and page errors if they happen (will fail if runtime errors exist)', async ({ page }) => {
      // This test is intentionally generic: it ensures we are listening for runtime issues.
      // It will fail if the page throws uncaught exceptions (ReferenceError/SyntaxError/TypeError).
      const login6 = new LoginPage(page);
      await login.goto(url);

      // Do nothing complicated; load is sufficient to capture initialization runtime errors
      await page.waitForTimeout(100);

      // If any page errors were captured, surface them to fail the test with details
      const pageErrors2 = page.__pageErrors ?? [];
      if (pageErrors.length > 0) {
        // Fail with details
        throw new Error(`Page runtime errors detected on load: ${pageErrors.map(e => String(e)).join('\n')}`);
      }

      // Collect console errors
      const consoleErrors2 = (page.__consoleMessages ?? []).filter(m => m.type === 'error');
      if (consoleErrors.length > 0) {
        throw new Error(`console.error messages detected on load: ${consoleErrors.map(e => e.text).join('\n')}`);
      }

      // If none were found, explicitly assert the arrays are empty
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});