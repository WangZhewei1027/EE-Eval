import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1217f740-fa7a-11f0-acf9-69409043402d.html';

/**
 * Page Object Model for the Authentication Exploration app.
 * Encapsulates common interactions used by the tests.
 */
class AuthApp {
  constructor(page) {
    this.page = page;
    this.newUsername = page.locator('#newUsername');
    this.addUserBtn = page.locator('#addUserBtn');
    this.userList = page.locator('#userList');
    this.deleteUserBtn = page.locator('#deleteUserBtn');
    this.userDetails = page.locator('#userDetails');

    this.authUserSelect = page.locator('#authUserSelect');
    this.authMethodSelect = page.locator('#authMethodSelect');
    this.startAuthBtn = page.locator('#startAuthBtn');

    this.authStepFieldset = page.locator('#authStepFieldset');
    this.authStepContent = page.locator('#authStepContent');
    this.authBackBtn = page.locator('#authBackBtn');
    this.authNextBtn = page.locator('#authNextBtn');

    this.clearLogBtn = page.locator('#clearLogBtn');
    this.logDiv = page.locator('#log');
  }

  // Utility to wait until the log contains expected text
  async waitForLogContains(text, timeout = 2000) {
    await expect(this.logDiv).toContainText(text, { timeout });
  }

  // Add a new user (returns after log entry appears)
  async addUser(username) {
    await this.newUsername.fill(username);
    await Promise.all([
      this.page.waitForEvent('dialog').then(d => d.accept()).catch(() => {}), // accept potential alert if invalid
      this.addUserBtn.click()
    ]);
    // either a log entry or an alert would have occurred; wait briefly for DOM update
    await this.page.waitForTimeout(150);
  }

  // Select a user in userList and refresh editor
  async selectUserInList(username) {
    await this.userList.selectOption({ value: username });
    // selecting triggers renderUserEditor: wait for userDetails to update
    await this.page.waitForTimeout(100);
  }

  // Delete the currently selected user (click delete button)
  async deleteSelectedUser() {
    await Promise.all([
      this.page.waitForEvent('dialog').then(d => d.accept()).catch(() => {}), // just in case
      this.deleteUserBtn.click()
    ]);
    await this.page.waitForTimeout(100);
  }

  // Start authentication for a username and method (assumes option exists in select)
  async startAuthentication(username, method) {
    await this.authUserSelect.selectOption({ value: username });
    await this.authMethodSelect.selectOption({ value: method });
    await Promise.all([
      // startAuth may show alerts; ensure dialogs are accepted automatically by the page dialog handler in tests
      this.startAuthBtn.click()
    ]);
    // allow UI to update
    await this.page.waitForTimeout(150);
  }

  // Click Next in auth flow
  async authNext() {
    await this.authNextBtn.click();
    await this.page.waitForTimeout(150);
  }

  // Click Back in auth flow
  async authBack() {
    await this.authBackBtn.click();
    await this.page.waitForTimeout(150);
  }

  // Clear the log
  async clearLog() {
    await this.clearLogBtn.click();
    await this.page.waitForTimeout(50);
  }

  // Retrieve text content of auth step content
  async authStepText() {
    return (await this.authStepContent.textContent()) || '';
  }

  // Retrieve text content of log
  async logText() {
    return (await this.logDiv.textContent()) || '';
  }
}

test.describe('Authentication System Interactive Demo - End-to-end', () => {
  // Arrays to capture console errors and page errors for assertion/inspection
  let consoleErrors;
  let pageErrors;
  let dialogMessages;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console error/warn messages
    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        consoleErrors.push({ type, text: msg.text() });
      }
    });

    // Capture uncaught exceptions and page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Capture dialogs (alerts) and accept them automatically to allow flows to continue
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      try {
        await dialog.accept();
      } catch (e) {
        // acceptance may fail in edge timing; ignore
      }
    });

    await page.goto(APP_URL);
    // small wait to let initial seeding run
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // After each test, we assert there were no unexpected page errors (uncaught exceptions)
    // and record any console errors. We assert none occurred to ensure app runs without runtime errors.
    expect(pageErrors.length, `No page errors should be thrown. Found: ${pageErrors.map(e => e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `No console errors/warnings expected. Found: ${consoleErrors.map(c => `${c.type}:${c.text}`).join('; ')}`).toBe(0);
  });

  test.describe('State S0 Idle & Initial Rendering', () => {
    test('renders heading and initial elements (Idle state entry)', async ({ page }) => {
      const app = new AuthApp(page);

      // Validate the page title and main heading exist
      await expect(page.locator('h1')).toHaveText('Authentication System Interactive Demo');

      // Verify log exists and is initially empty or only seeded messages after seedUsers
      await expect(app.logDiv).toBeVisible();
      const logText = await app.logText();
      // Seed users logs should not necessarily be present, but ensure log element is present
      expect(typeof logText).toBe('string');
    });
  });

  test.describe('User Setup (S1) - Add/Delete Users and Validation', () => {
    test('add a new valid user updates user list and logs (S0->S1 via AddUser)', async ({ page }) => {
      const app = new AuthApp(page);

      // Add a unique username
      const username = `testuser_${Date.now()}`;
      await app.addUser(username);

      // The user should appear in userList and authUserSelect
      await expect(app.userList).toContainText(username);
      await expect(app.authUserSelect).toContainText(username);

      // Log should contain "User added"
      await app.waitForLogContains(`User added: '${username}'.`);
    });

    test('prevent adding invalid username triggers alert and not added (edge case)', async ({ page }) => {
      const app = new AuthApp(page);

      // Try to add invalid username with spaces or duplicate
      const invalidName = 'invalid name';
      await app.addUser(invalidName);

      // An alert must have been shown and captured in dialogMessages
      expect(dialogMessages.length).toBeGreaterThan(0);
      expect(dialogMessages[dialogMessages.length - 1].toLowerCase()).toContain('invalid');

      // Ensure the user did not get added
      await expect(app.userList).not.toContainText(invalidName);
    });

    test('delete an existing user updates lists and logs (S1 self-transition DeleteUser)', async ({ page }) => {
      const app = new AuthApp(page);

      // Add then delete a user to ensure delete flow works
      const username = `todelete_${Date.now()}`;
      await app.addUser(username);
      await app.waitForLogContains(`User added: '${username}'.`);

      // Select user in list and delete
      await app.selectUserInList(username);
      // Ensure delete button is enabled
      await expect(app.deleteUserBtn).toBeEnabled();

      await app.deleteSelectedUser();

      // Log should contain deletion
      await app.waitForLogContains(`User deleted: '${username}'.`);
      // User should be removed from selects
      await expect(app.userList).not.toContainText(username);
      await expect(app.authUserSelect).not.toContainText(username);
    });
  });

  test.describe('Authentication Workflow (S2) - StartAuth and Steps', () => {
    test('Start Authentication displays auth step fieldset and logs (S1->S2 via StartAuth)', async ({ page }) => {
      const app = new AuthApp(page);

      // Use seeded user 'alice' (exists in seedUsers)
      await app.startAuthentication('alice', 'password');

      // Auth fieldset should be displayed
      await expect(app.authStepFieldset).toBeVisible();

      // Log should indicate authentication started for alice
      await app.waitForLogContains(`Authentication started for user 'alice' via method 'password'.`);
    });

    test('password authentication succeeds with correct password leading to success (S2->S3 via AuthNext)', async ({ page }) => {
      const app = new AuthApp(page);

      // Start auth for alice using password
      await app.startAuthentication('alice', 'password');

      // Ensure password input present
      const pwdInput = page.locator('#authPasswordInput');
      await expect(pwdInput).toBeVisible();

      // Enter correct password (seeded: password123)
      await pwdInput.fill('password123');

      // Click Next (process should set success)
      await app.authNext();

      // After success, auth step content should display success message
      await expect(app.authStepContent).toContainText('Authentication Success!');

      // Log should have a success entry
      await app.waitForLogContains(`Authentication successful for user 'alice' using method 'password'.`);
    });

    test('password authentication fails with incorrect password (S2 stays or shows failure after alerts)', async ({ page }) => {
      const app = new AuthApp(page);

      await app.startAuthentication('alice', 'password');

      const pwdInput = page.locator('#authPasswordInput');
      await expect(pwdInput).toBeVisible();

      // Enter wrong password
      await pwdInput.fill('wrongpassword');

      // Click Next - should trigger alert and not progress to success
      await app.authNext();

      // An alert should have been shown indicating incorrect password
      expect(dialogMessages.length).toBeGreaterThan(0);
      const lastDialog = dialogMessages[dialogMessages.length - 1].toLowerCase();
      expect(lastDialog).toContain('password incorrect');

      // Auth content should still allow retry (Next enabled)
      await expect(app.authNextBtn).toBeEnabled();
    });

    test('TOTP flow: set secret if missing, read displayed simulated code, enter it and succeed', async ({ page }) => {
      const app = new AuthApp(page);

      // Choose bob who does not have totpSecret set initially
      await app.startAuthentication('bob', 'totp');

      // Step 0: provide secret input
      const secretInput = page.locator('#authTOTPSecretInput');
      await expect(secretInput).toBeVisible();

      // Provide a valid secret
      await secretInput.fill('TESTSECRET123');

      // Click Next to set secret (the code sets it and advances render, returning false so we need to click Next again)
      await app.authNext();

      // After setting secret, UI will show current TOTP code and an input
      // Wait briefly for render
      await page.waitForTimeout(200);

      // The content includes the simulated code, capture it
      const stepText = await app.authStepText();
      const match = stepText.match(/Current TOTP code \(simulated\):\s*([0-9]{6})/);
      expect(match).not.toBeNull();
      const code = match[1];

      // Fill the displayed code into input
      const codeInput = page.locator('#authTOTPCodeInput');
      await expect(codeInput).toBeVisible();
      await codeInput.fill(code);

      // Click Next to validate
      await app.authNext();

      // Should result in success
      await expect(app.authStepContent).toContainText('Authentication Success!');
      await app.waitForLogContains(`Authentication successful for user 'bob' using method 'totp'.`);
    });

    test('TOTP back navigation works (AuthBack event reduces step)', async ({ page }) => {
      const app = new AuthApp(page);

      // Start totp for bob and set secret to reach code display
      await app.startAuthentication('bob', 'totp');
      const secretInput = page.locator('#authTOTPSecretInput');
      await expect(secretInput).toBeVisible();
      await secretInput.fill('ANOTHERSECRET');
      await app.authNext();

      // Now on step that shows code with an input
      const codeInput = page.locator('#authTOTPCodeInput');
      await expect(codeInput).toBeVisible();

      // Click Back should revert to previous step (and Back may become disabled if at step 0)
      await app.authBack();

      // After going back, we expect to see secret input again (step 0)
      const secretInputAgain = page.locator('#authTOTPSecretInput');
      await expect(secretInputAgain).toBeVisible();
    });

    test('Security Questions flow: correct answers lead to success; wrong answers can cause failure', async ({ page }) => {
      const app = new AuthApp(page);

      // Start security question auth for alice (she has 2 questions)
      await app.startAuthentication('alice', 'securityQuestion');

      // Q1
      const q1Input = page.locator('#authSQAnswerInput');
      await expect(q1Input).toBeVisible();
      await q1Input.fill('Smith'); // correct (case-insensitive)
      await app.authNext();

      // Q2
      const q2Input = page.locator('#authSQAnswerInput');
      await expect(q2Input).toBeVisible();
      await q2Input.fill('Blue'); // correct
      await app.authNext();

      // Should be successful
      await expect(app.authStepContent).toContainText('Authentication Success!');
      await app.waitForLogContains(`Authentication successful for user 'alice' using method 'securityQuestion'.`);
    });

    test('Email code flow: send code and accept correct code to succeed (S2->S3)', async ({ page }) => {
      const app = new AuthApp(page);

      // Start emailCode auth for alice who has an email
      await app.startAuthentication('alice', 'emailCode');

      // Step 0: message includes code, parse it
      const step0Text = await app.authStepText();
      const match = step0Text.match(/Email code sent to .*: (\d{6})/);
      expect(match).not.toBeNull();
      const code = match[1];

      // Click Next to go to input step
      await app.authNext();

      // Enter the code into the authEmailCodeInput
      const emailCodeInput = page.locator('#authEmailCodeInput');
      await expect(emailCodeInput).toBeVisible();
      await emailCodeInput.fill(code);

      // Click Next to validate
      await app.authNext();

      // Should be successful
      await expect(app.authStepContent).toContainText('Authentication Success!');
      await app.waitForLogContains(`Authentication successful for user 'alice' using method 'emailCode'.`);
    });

    test('CAPTCHA flow: shows captcha, enter correct value to succeed, wrong tries lead to failure', async ({ page }) => {
      const app = new AuthApp(page);

      // Start captcha for charlie (exists)
      await app.startAuthentication('charlie', 'captcha');

      // It shows a captcha in a div and an input
      // Read the captcha shown in authStepContent (it's in a div with bold text)
      const contentText = await app.authStepText();
      // The captcha is also presented as visible bold text; we'll query the inner element for exact value
      const captchaDiv = page.locator('#authStepContent div').first();
      const captchaValue = (await captchaDiv.textContent())?.trim();

      // Fill the correct captcha value
      const captchaInput = page.locator('#authCaptchaInput');
      await expect(captchaInput).toBeVisible();
      await captchaInput.fill(captchaValue || '');

      // Click Next to validate
      await app.authNext();

      // Should be success
      await expect(app.authStepContent).toContainText('Authentication Success!');
      await app.waitForLogContains(`Authentication successful for user 'charlie' using method 'captcha'.`);
    });
  });

  test.describe('Failure branches (S4) and Edge Flows', () => {
    test('Security questions: too many wrong answers leads to failure (S2->S4)', async ({ page }) => {
      const app = new AuthApp(page);

      // Start securityQuestion for bob who has 1 question
      await app.startAuthentication('bob', 'securityQuestion');

      // Provide wrong answer three times to trigger failure
      const input = page.locator('#authSQAnswerInput');
      await expect(input).toBeVisible();

      // 1st wrong attempt
      await input.fill('wrong1');
      await app.authNext();
      expect(dialogMessages[dialogMessages.length - 1].toLowerCase()).toContain('incorrect');

      // 2nd wrong attempt
      await input.fill('wrong2');
      await app.authNext();
      expect(dialogMessages[dialogMessages.length - 1].toLowerCase()).toContain('incorrect');

      // 3rd wrong attempt should trigger failure alert and log
      await input.fill('wrong3');
      await app.authNext();

      // Wait for failure UI to be shown
      await expect(app.authStepContent).toContainText('Authentication Failed');
      await app.waitForLogContains(`Too many wrong answers for security questions for user 'bob'.`);
    });

    test('Email code: expired or wrong codes eventually fail (S2->S4)', async ({ page }) => {
      const app = new AuthApp(page);

      // Start emailCode for alice
      await app.startAuthentication('alice', 'emailCode');

      // Parse code and then purposefully use wrong code three times to trigger failure
      const step0Text = await app.authStepText();
      const match = step0Text.match(/Email code sent to .*: (\d{6})/);
      expect(match).not.toBeNull();

      // Move to code input step
      await app.authNext();

      const emailCodeInput = page.locator('#authEmailCodeInput');
      await expect(emailCodeInput).toBeVisible();

      // Wrong attempt 1
      await emailCodeInput.fill('000000');
      await app.authNext();
      expect(dialogMessages[dialogMessages.length - 1].toLowerCase()).toContain('incorrect');

      // Wrong attempt 2
      await emailCodeInput.fill('111111');
      await app.authNext();
      expect(dialogMessages[dialogMessages.length - 1].toLowerCase()).toContain('incorrect');

      // Wrong attempt 3 should cause failure and log
      await emailCodeInput.fill('222222');
      await app.authNext();

      // Failure UI & log
      await expect(app.authStepContent).toContainText('Authentication Failed');
      await app.waitForLogContains(`Too many wrong email code entries for user 'alice'.`);
    });

    test('CAPTCHA: repeated wrong tries cause failure and proper log (S2->S4)', async ({ page }) => {
      const app = new AuthApp(page);

      await app.startAuthentication('charlie', 'captcha');

      const captchaInput = page.locator('#authCaptchaInput');
      await expect(captchaInput).toBeVisible();

      // Provide wrong values 3 times
      await captchaInput.fill('AAAAA');
      await app.authNext();
      expect(dialogMessages[dialogMessages.length - 1].toLowerCase()).toContain('captcha incorrect');

      await captchaInput.fill('BBBBB');
      await app.authNext();
      expect(dialogMessages[dialogMessages.length - 1].toLowerCase()).toContain('captcha incorrect');

      await captchaInput.fill('CCCCC');
      await app.authNext();

      // Should log failure and show failure UI
      await expect(app.authStepContent).toContainText('Authentication Failed');
      await app.waitForLogContains(`CAPTCHA failed for user 'charlie'.`);
    });
  });

  test.describe('Misc Controls and Observability', () => {
    test('Clear log button empties the log', async ({ page }) => {
      const app = new AuthApp(page);

      // Ensure there is something in the log (seeded or previous operations)
      const before = await app.logText();
      // Click clear
      await app.clearLog();

      // Log should be empty now
      const after = await app.logText();
      expect(after.trim()).toBe('');
    });

    test('No uncaught runtime errors or console errors emitted during typical flows', async ({ page }) => {
      const app = new AuthApp(page);

      // Perform a couple of operations that exercise code paths
      const username = `probe_${Date.now()}`;
      await app.addUser(username);
      await app.waitForLogContains(`User added: '${username}'.`);
      await app.startAuthentication('alice', 'password');
      const pwdInput = page.locator('#authPasswordInput');
      await expect(pwdInput).toBeVisible();
      await pwdInput.fill('password123');
      await app.authNext();

      // Final expectation is handled in afterEach: pageErrors and consoleErrors should be empty.
      // We also assert that the standard success log appears
      await app.waitForLogContains(`Authentication successful for user 'alice' using method 'password'.`);
    });
  });
});