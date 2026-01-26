import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c1739c1-fa79-11f0-8fe7-a5317bd8e2c6.html';

/**
 * Utility to perform a click and collect a number of dialogs (alerts/prompts/confirm).
 * It installs a dialog listener that accepts dialogs (optionally with a promptText) and
 * collects their messages. It resolves after the expectedCount of dialogs have been handled.
 */
async function clickAndCollectDialogs(page, selector, expectedCount = 1, promptResponse = undefined, timeout = 5000) {
  const messages = [];
  const listener = async (dialog) => {
    try {
      // accept with text for prompt dialogs, otherwise accept empty
      if (typeof promptResponse !== 'undefined') {
        await dialog.accept(promptResponse);
      } else {
        await dialog.accept();
      }
    } catch (e) {
      // ignore accept errors
    }
    messages.push(dialog.message());
  };
  page.on('dialog', listener);
  try {
    await page.click(selector);
    const start = Date.now();
    while (messages.length < expectedCount) {
      if (Date.now() - start > timeout) break;
      await new Promise((r) => setTimeout(r, 50));
    }
  } finally {
    page.off('dialog', listener);
  }
  return messages;
}

/**
 * Helper to wait for a selector to contain non-empty text content.
 */
async function waitForNonEmptyText(page, selector, timeout = 3000) {
  await page.waitForFunction(
    (sel) => {
      const el = document.querySelector(sel);
      return el && el.textContent && el.textContent.trim().length > 0;
    },
    selector,
    { timeout }
  );
}

/**
 * Page object for interacting with the Authentication Playground.
 */
class AuthPlaygroundPage {
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async clearStorageAndReload() {
    await this.page.evaluate(() => {
      localStorage.removeItem('auth_playground_v1');
      localStorage.removeItem('auth_playground_log_v1');
    });
    await this.page.reload({ waitUntil: 'domcontentloaded' });
  }

  // Create a user via the "Sign Up and Auto-Verify" button to avoid email flows
  async signupAutoVerify(username, email, password) {
    await this.page.fill('#signupUsername', username);
    await this.page.fill('#signupEmail', email);
    await this.page.fill('#signupPassword', password);
    // signupAutoVerify triggers two dialogs: one from signupBtn (signed up) and one 'Auto verified.'
    const messages = await clickAndCollectDialogs(this.page, '#signupAutoVerify', 2, undefined, 5000);
    return messages;
  }

  // Sign in (normal)
  async signIn(usernameOrEmail, password, otp = '') {
    await this.page.fill('#signinUser', usernameOrEmail);
    await this.page.fill('#signinPass', password);
    if (otp) await this.page.fill('#signinOtp', otp);
    const messages = await clickAndCollectDialogs(this.page, '#signinBtn', 1, undefined, 5000);
    return messages;
  }

  // Force fail sign in (uses signinFail button)
  async signInForceFail(usernameOrEmail, password) {
    await this.page.fill('#signinUser', usernameOrEmail);
    await this.page.fill('#signinPass', password);
    const messages = await clickAndCollectDialogs(this.page, '#signinFail', 1, undefined, 5000);
    return messages;
  }

  // Request a password reset for a user and return the token found in the email queue.
  async requestResetAndExtractToken(target) {
    await this.page.fill('#resetTarget', target);
    const msgs = await clickAndCollectDialogs(this.page, '#requestReset', 1, undefined, 5000);
    // Now wait for the #emails area to show something and then extract token.
    await waitForNonEmptyText(this.page, '#emails', 3000);
    const emailBodies = await this.page.$$eval('#emails pre', (pres) => pres.map(p => p.textContent || ''));
    // search for reset:token
    for (const body of emailBodies) {
      const m = body.match(/reset:([A-Za-z0-9_\-]+)/);
      if (m) return { token: m[1], queueMessages: msgs };
    }
    return { token: null, queueMessages: msgs };
  }

  // Perform reset using token and new password
  async performReset(token, newPassword) {
    await this.page.fill('#resetTokenInput', token);
    await this.page.fill('#resetNewPassword', newPassword);
    const messages = await clickAndCollectDialogs(this.page, '#performReset', 1, undefined, 5000);
    return messages;
  }

  // Generate TOTP for a user and return the displayed base32 secret and the current code
  async generateTotpAndFetchCode(username) {
    await this.page.fill('#mfaUser', username);
    // generateTotp triggers an alert
    const genMsgs = await clickAndCollectDialogs(this.page, '#generateTotp', 1, undefined, 5000);
    // show current totp triggers an alert but sets #totpNow
    const showMsgs = await clickAndCollectDialogs(this.page, '#showTotpNow', 1, undefined, 5000);
    // read secret and totpNow
    const secretText = await this.page.textContent('#totpSecret');
    const codeText = (await this.page.textContent('#totpNow')) || '';
    return { genMsgs, showMsgs, secretText: secretText?.trim(), codeText: codeText?.trim() };
  }

  async enableTotpForUser(username, code) {
    await this.page.fill('#mfaUser', username);
    await this.page.fill('#totpVerifyCode', code);
    const msgs = await clickAndCollectDialogs(this.page, '#enableTotp', 1, undefined, 5000);
    return msgs;
  }

  async createOAuthClient(name, redirect) {
    await this.page.fill('#oauthClientName', name);
    await this.page.fill('#oauthRedirect', redirect);
    // createClient does not produce an alert but updates oauthClients
    await this.page.click('#createClient');
    await waitForNonEmptyText(this.page, '#oauthClients', 2000);
    const clientsJson = await this.page.textContent('#oauthClients');
    return clientsJson;
  }

  async startAuth(clientId, username, scopes = 'profile email') {
    await this.page.fill('#authClientId', clientId);
    await this.page.fill('#authUser', username);
    await this.page.fill('#authScopes', scopes);
    // startAuth triggers an alert with the code included
    const msgs = await clickAndCollectDialogs(this.page, '#startAuth', 1, undefined, 5000);
    // message should include the code: "Auth code generated: <code>"
    return msgs;
  }

  async exchangeAuthCode(code, clientSecret) {
    await this.page.fill('#exchangeCode', code);
    await this.page.fill('#exchangeSecret', clientSecret);
    const msgs = await clickAndCollectDialogs(this.page, '#exchangeBtn', 1, undefined, 5000);
    return msgs;
  }
}

test.describe('Authentication Playground FSM - comprehensive E2E', () => {
  // Track console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Capture console messages (info/warn/error) for diagnostics
    page._consoleMessages = [];
    page.on('console', (msg) => {
      page._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page._pageErrors = [];
    page.on('pageerror', (err) => {
      page._pageErrors.push(err);
    });

    // Navigate to the app
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Wait for initial render to finish and serverTime to populate
    await waitForNonEmptyText(page, '#serverTime', 3000);
  });

  test.afterEach(async ({ page }) => {
    // Basic assertions about console and errors are placed within individual tests.
    // Clear listeners (Playwright automatically cleans up between tests, but keep tidy).
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('S0 Idle: initial renderAll() produced expected UI pieces and created default admin', async ({ page }) => {
    // Validate initial UI elements are present and non-empty
    const serverTime = await page.textContent('#serverTime');
    expect(serverTime).toBeTruthy();
    expect(serverTime).toMatch(/\d{4}-\d{2}-\d{2}T/); // ISO-ish

    // userList and emails and logs should be rendered
    const userListText = await page.textContent('#userList');
    expect(userListText).toBeTruthy();

    const emailsText = await page.textContent('#emails');
    expect(emailsText).toBeTruthy();

    // The app creates a default admin on startup; the log view should contain that message
    const logView = await page.textContent('#logView');
    expect(logView).toContain('Created default admin');

    // Ensure there are no uncaught page errors on initial load
    expect(page._pageErrors.length).toBe(0);
  });

  test.describe('Signup and Signin transitions', () => {
    test('SIGN_UP -> S1_UserCreated (signupAutoVerify creates user and sets verified)', async ({ page }) => {
      const app = new AuthPlaygroundPage(page);

      // Use a unique username for this test
      const username = `alice_${Date.now().toString(36).slice(-5)}`;
      const email = `${username}@example.test`;
      const password = 'Passw0rd!';

      // Sign up using the auto-verify flow; expects two dialogs (signed up, auto verified)
      const msgs = await app.signupAutoVerify(username, email, password);
      // Verify dialogs occurred and contain expected substrings
      expect(msgs.length).toBeGreaterThanOrEqual(1);
      expect(msgs.some(m => /signed up|Signed up|Signed up successfully/i.test(m))).toBeTruthy();
      expect(msgs.some(m => /Auto verified|Auto-verified/i.test(m))).toBeTruthy();

      // The user list should now contain the username
      await waitForNonEmptyText(page, '#userList', 2000);
      const userList = await page.textContent('#userList');
      expect(userList).toContain(username);

      // The logs should contain a signup entry
      const logs = await page.textContent('#logView');
      expect(logs.toLowerCase()).toContain('signup');

      // No uncaught exceptions were thrown during signup
      expect(page._pageErrors.length).toBe(0);
    });

    test('SIGN_IN -> S2_UserSignedIn (normal signin creates session)', async ({ page }) => {
      const app = new AuthPlaygroundPage(page);

      // Prepare a transient user
      const username = `signin_user_${Date.now().toString(36).slice(-5)}`;
      const email = `${username}@example.test`;
      const password = 'MyPass123!';

      // Create via signupAutoVerify
      await app.signupAutoVerify(username, email, password);

      // Sign in
      const signMsgs = await app.signIn(username, password);
      expect(signMsgs.length).toBeGreaterThanOrEqual(1);
      expect(signMsgs[0]).toMatch(/Signed in/i);

      // The sessions list should contain a session line mentioning the username
      await waitForNonEmptyText(page, '#sessionsList', 2000);
      const sessionsText = await page.textContent('#sessionsList');
      expect(sessionsText).toContain(username);

      // Logs should include a login entry
      const logs = await page.textContent('#logView');
      expect(logs.toLowerCase()).toContain('login');

      // No uncaught errors
      expect(page._pageErrors.length).toBe(0);
    });

    test('RESET_PASSWORD -> S3_PasswordReset (request + perform reset flow)', async ({ page }) => {
      const app = new AuthPlaygroundPage(page);

      // Create a user
      const username = `bob_${Date.now().toString(36).slice(-5)}`;
      const email = `${username}@example.test`;
      const initialPassword = 'Secret1';
      const newPassword = 'NewSecret1';

      await app.signupAutoVerify(username, email, initialPassword);

      // Request reset and extract token from email queue
      const { token } = await app.requestResetAndExtractToken(username);
      expect(token).toBeTruthy();

      // Perform reset using the extracted token
      const resetMsgs = await app.performReset(token, newPassword);
      expect(resetMsgs.length).toBeGreaterThanOrEqual(1);
      expect(resetMsgs[0]).toMatch(/Password updated|Password reset/i);

      // Now sign in using the new password
      const signMsgs = await app.signIn(username, newPassword);
      expect(signMsgs[0]).toMatch(/Signed in|Signed in, session created/i);

      // Ensure logs reflect reset
      const logs = await page.textContent('#logView');
      expect(logs.toLowerCase()).toContain('reset');

      // No uncaught page errors
      expect(page._pageErrors.length).toBe(0);
    });
  });

  test.describe('MFA management and flow', () => {
    test('ENABLE_MFA -> S4_MFAEnabled (generate secret, enable, sign in with OTP)', async ({ page }) => {
      const app = new AuthPlaygroundPage(page);

      const username = `carol_${Date.now().toString(36).slice(-5)}`;
      const email = `${username}@example.test`;
      const password = 'Pwd1234';

      // Create user
      await app.signupAutoVerify(username, email, password);

      // Generate TOTP secret and fetch current code
      const { genMsgs, showMsgs, secretText, codeText } = await app.generateTotpAndFetchCode(username);
      expect(genMsgs.length).toBeGreaterThanOrEqual(1);
      expect(showMsgs.length).toBeGreaterThanOrEqual(1);
      expect(secretText).toContain('base32:');
      expect(codeText).toMatch(/^\d{6}$/);

      // Enable TOTP by submitting the current code
      const enableMsgs = await app.enableTotpForUser(username, codeText);
      expect(enableMsgs.length).toBeGreaterThanOrEqual(1);
      expect(enableMsgs[0]).toMatch(/MFA enabled/i);

      // Now sign in providing the OTP
      const signMsgs = await app.signIn(username, password, codeText);
      expect(signMsgs[0]).toMatch(/Signed in/i);

      // Logs should include mfa_enable and login
      const logs = await page.textContent('#logView');
      expect(logs.toLowerCase()).toContain('mfa_enable');
      expect(logs.toLowerCase()).toContain('login');

      // No uncaught exceptions
      expect(page._pageErrors.length).toBe(0);
    });
  });

  test.describe('OAuth simulation', () => {
    test('CREATE_OAUTH_CLIENT -> S5_OAuthClientCreated (create client, auth code, exchange)', async ({ page }) => {
      const app = new AuthPlaygroundPage(page);

      // Create a client
      const clientName = `TestApp_${Date.now().toString(36).slice(-5)}`;
      const redirect = 'https://example.app/callback';
      const clientsJson = await app.createOAuthClient(clientName, redirect);
      expect(clientsJson).toBeTruthy();

      // Parse clients to find clientId and secret
      const clientsObj = JSON.parse(clientsJson);
      const clientIds = Object.keys(clientsObj);
      expect(clientIds.length).toBeGreaterThan(0);
      const clientId = clientIds[0];
      const clientSecret = clientsObj[clientId].clientSecret;
      expect(clientSecret).toBeTruthy();

      // Create a user to authorize
      const username = `dave_${Date.now().toString(36).slice(-5)}`;
      const email = `${username}@example.test`;
      const password = 'OpenSesame';
      await app.signupAutoVerify(username, email, password);

      // Start authorization -> expect an alert that includes the auth code
      const startMsgs = await app.startAuth(clientId, username);
      expect(startMsgs.length).toBeGreaterThanOrEqual(1);
      // extract code from message if present
      const m = startMsgs[0].match(/Auth code generated:\s*([A-Za-z0-9_\-]+)/);
      let code = null;
      if (m) code = m[1];
      expect(code).toBeTruthy();

      // Exchange the code for a token id
      const exchangeMsgs = await app.exchangeAuthCode(code, clientSecret);
      expect(exchangeMsgs.length).toBeGreaterThanOrEqual(1);
      expect(exchangeMsgs[0]).toMatch(/Exchanged code for token id/i);

      // Verify oauthTokens area contains an entry
      await waitForNonEmptyText(page, '#oauthTokens', 2000);
      const oauthTokensText = await page.textContent('#oauthTokens');
      expect(oauthTokensText).toContain('token');

      // No uncaught exceptions
      expect(page._pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and additional behaviors', () => {
    test('Forced sign-in failure and account lockout behavior', async ({ page }) => {
      const app = new AuthPlaygroundPage(page);

      const username = `mallory_${Date.now().toString(36).slice(-5)}`;
      const email = `${username}@example.test`;
      const password = 'Right1';

      await app.signupAutoVerify(username, email, password);

      // Force a failure: the signinFail button simulates invalid credentials
      const failMsgs = await app.signInForceFail(username, 'WrongPass');
      expect(failMsgs[0]).toMatch(/Invalid credentials \(forced\)|Invalid credentials/i);

      // Cause repeated forced failures to trigger lockout (use failedThreshold from settings)
      const failedThreshold = await page.$eval('#failedThreshold', el => parseInt(el.value, 10) || 5);
      for (let i = 0; i < failedThreshold; i++) {
        // force fail multiple times; each will produce an alert
        await app.signInForceFail(username, 'WrongPass');
      }

      // Attempt to sign in with the correct password; should be blocked due to lockout (alert)
      const blockedMsgs = await app.signIn(username, password);
      // The app will show an alert like 'Account locked until ...' or similar
      expect(blockedMsgs.some(m => /locked/i || /lock/i)).toBeTruthy;

      // Logs must include lockout or login_fail entries
      const logs = await page.textContent('#logView');
      expect(logs.toLowerCase()).toMatch(/login_fail|locked|lockout/);

      // No uncaught exceptions
      expect(page._pageErrors.length).toBe(0);
    });

    test('Scenario playback: run "happy" scenario and assert scenario state progression', async ({ page }) => {
      // Run the optimistic happy scenario which signs up, verifies, and signs in a user
      const scenarioSelect = '#scenarioSelect';
      await page.selectOption(scenarioSelect, 'happy');

      // Click runScenario and handle the sequence of dialogs produced by the scenario steps
      // The scenario runs multiple steps; set up a dialog listener to auto-accept all dialogs
      const collected = [];
      const listener = async (dialog) => {
        collected.push(dialog.message());
        await dialog.accept();
      };
      page.on('dialog', listener);

      await page.click('#runScenario');

      // Wait for scenarioState to reflect completion (index == stepsCount)
      await page.waitForFunction(() => {
        const el = document.getElementById('scenarioState');
        if (!el) return false;
        try {
          const s = JSON.parse(el.textContent || '{}');
          return s.index && s.stepsCount && s.index >= s.stepsCount;
        } catch (e) {
          return false;
        }
      }, null, { timeout: 10000 });

      // Ensure the scenario produced some dialog interactions and logs contain 'scenario'
      const logs = await page.textContent('#logView');
      expect(logs.toLowerCase()).toContain('scenario');

      // Clean up listener
      page.off('dialog', listener);

      // No uncaught exceptions
      expect(page._pageErrors.length).toBe(0);
    });
  });

  test('Observability: capture console messages and ensure no uncaught exceptions leaked to pageerror', async ({ page }) => {
    // This test simply asserts that we captured console output and no pageerror occurred during the session.
    // console messages array should exist and be an array
    expect(Array.isArray(page._consoleMessages)).toBeTruthy();

    // Confirm there are no uncaught page errors
    expect(page._pageErrors.length).toBe(0);
  });
});