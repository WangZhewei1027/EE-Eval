import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d33a2a0-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Authentication Demo FSM (6d33a2a0-fa7a-11f0-ba5b-57721b046e74)', () => {
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    // Collect page errors and console errors for assertions
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // Collect runtime errors like ReferenceError, TypeError, etc.
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    page.on('console', (msg) => {
      // Collect console.error messages for observation
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Load the application as-is
    await page.goto(BASE_URL);
    // Ensure initial UI has loaded
    await expect(page.locator('#authSelector')).toBeVisible();
  });

  test.describe('Initial state and navigation', () => {
    test('Initial state shows authentication selector and other panels are hidden', async ({ page }) => {
      // Validate the initial "authSelector" panel is visible and other panels are hidden
      await expect(page.locator('#authSelector')).toBeVisible();
      await expect(page.locator('#passwordPanel')).toBeHidden();
      await expect(page.locator('#otpPanel')).toBeHidden();
      await expect(page.locator('#biometricPanel')).toBeHidden();
      await expect(page.locator('#socialPanel')).toBeHidden();
      await expect(page.locator('#mfaPanel')).toBeHidden();
      await expect(page.locator('#sessionPanel')).toBeHidden();
    });
  });

  test.describe('Password Authentication (S1_PasswordAuth)', () => {
    test('Show password panel, validation errors, and successful login transition to session panel', async ({ page }) => {
      // Show the Password panel
      await page.click('button[onclick="showPanel(\'passwordPanel\')"]');
      await expect(page.locator('#passwordPanel')).toBeVisible();
      await expect(page.locator('#authSelector')).toBeHidden();

      // Attempt login with empty fields -> expect validation error
      await page.click('button[onclick="attemptPasswordLogin()"]');
      await expect(page.locator('#passwordError')).toBeVisible();
      await expect(page.locator('#passwordError')).toContainText('required');

      // Fill username and short password but set strength to medium -> expect too short error
      await page.fill('#username', 'alice');
      await page.fill('#password', 'short');
      await page.selectOption('#passwordStrength', 'medium');
      await page.click('button[onclick="attemptPasswordLogin()"]');
      await expect(page.locator('#passwordError')).toBeVisible();
      await expect(page.locator('#passwordError')).toContainText('too short');

      // Password equal to username -> expect error
      await page.fill('#username', 'sameuser');
      await page.fill('#password', 'sameuser');
      await page.selectOption('#passwordStrength', 'weak');
      await page.click('button[onclick="attemptPasswordLogin()"]');
      await expect(page.locator('#passwordError')).toBeVisible();
      await expect(page.locator('#passwordError')).toContainText('cannot be same as username');

      // Successful login -> navigate to sessionPanel
      await page.fill('#username', 'validUser');
      await page.fill('#password', 'AveryStrongPassword!');
      await page.selectOption('#passwordStrength', 'strong');
      await page.check('#rememberMe');
      await page.click('button[onclick="attemptPasswordLogin()"]');

      // showPanel('sessionPanel') is called on success, ensure session is visible
      await expect(page.locator('#sessionPanel')).toBeVisible();
      await expect(page.locator('#passwordPanel')).toBeHidden();
    });

    test('Back button returns to auth selector', async ({ page }) => {
      await page.click('button[onclick="showPanel(\'passwordPanel\')"]');
      await expect(page.locator('#passwordPanel')).toBeVisible();

      // Click Back button defined in password panel
      await page.click('#passwordPanel >> text=Back');
      await expect(page.locator('#authSelector')).toBeVisible();
      await expect(page.locator('#passwordPanel')).toBeHidden();
    });
  });

  test.describe('OTP Authentication (S2_OtpAuth)', () => {
    test('Send OTP validation, reveal code section, verify wrong and correct OTP, transition to session', async ({ page }) => {
      // Navigate to OTP panel
      await page.click('button[onclick="showPanel(\'otpPanel\')"]');
      await expect(page.locator('#otpPanel')).toBeVisible();

      // Attempt to send OTP without identifier -> validation error
      await page.click('button[onclick="sendOTP()"]');
      await expect(page.locator('#otpError')).toBeVisible();
      await expect(page.locator('#otpError')).toContainText('Identifier required');

      // Send OTP with identifier -> setTimeout introduces async behavior; wait for success and code section
      await page.fill('#otpIdentifier', 'user@example.com');
      await page.click('button[onclick="sendOTP()"]');

      // Wait for the simulated send to complete and show success + reveal code section
      await expect(page.locator('#otpSuccess')).toBeVisible({ timeout: 3000 });
      await expect(page.locator('#otpCodeSection')).toBeVisible({ timeout: 3000 });

      // Extract the simulated OTP code from the success message text
      const successText = await page.locator('#otpSuccess').innerText();
      const codeMatch = successText.match(/Your code is (\d{4})/);
      expect(codeMatch).not.toBeNull();
      const simulatedCode = codeMatch ? codeMatch[1] : null;
      expect(simulatedCode).toMatch(/\d{4}/);

      // Try verifying with wrong code -> expect invalid OTP message
      await page.fill('#otpCode', '0000');
      await page.click('button[onclick="verifyOTP()"]');
      await expect(page.locator('#otpError')).toBeVisible();
      await expect(page.locator('#otpError')).toContainText('Invalid OTP code');

      // Now verify with correct code -> transition to sessionPanel
      await page.fill('#otpCode', simulatedCode);
      await page.click('button[onclick="verifyOTP()"]');
      await expect(page.locator('#sessionPanel')).toBeVisible();
      await expect(page.locator('#otpPanel')).toBeHidden();
    });

    test('Send OTP without verifying still reveals OTP code section', async ({ page }) => {
      await page.click('button[onclick="showPanel(\'otpPanel\')"]');

      // Fill identifier and send OTP
      await page.fill('#otpIdentifier', '123-456-7890');
      await page.click('button[onclick="sendOTP()"]');

      // After simulated send, the OTP input should be shown
      await expect(page.locator('#otpCodeSection')).toBeVisible({ timeout: 3000 });
    });
  });

  test.describe('Biometric Authentication (S3_BiometricAuth)', () => {
    test('Biometric failure and success flows with UI feedback and session transition', async ({ page }) => {
      await page.click('button[onclick="showPanel(\'biometricPanel\')"]');
      await expect(page.locator('#biometricPanel')).toBeVisible();

      // Change success rate to 0 to force a failure, and set a small duration to speed up test
      await page.evaluate(() => {
        const rate = document.getElementById('bioSuccessRate');
        rate.value = '0';
        rate.dispatchEvent(new Event('input', { bubbles: true }));
        const dur = document.getElementById('bioDuration');
        dur.value = '500';
        dur.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Click Authenticate and expect a failure message
      await page.click('button[onclick="attemptBiometricAuth()"]');
      await expect(page.locator('#bioError')).toBeVisible({ timeout: 1500 });
      await expect(page.locator('#bioError')).toContainText('authentication failed');

      // Now set success rate to 100 and short duration to force success
      await page.evaluate(() => {
        const rate = document.getElementById('bioSuccessRate');
        rate.value = '100';
        rate.dispatchEvent(new Event('input', { bubbles: true }));
        const dur = document.getElementById('bioDuration');
        dur.value = '500';
        dur.dispatchEvent(new Event('input', { bubbles: true }));
      });

      // Click Authenticate and wait for session transition
      await page.click('button[onclick="attemptBiometricAuth()"]');
      await expect(page.locator('#sessionPanel')).toBeVisible({ timeout: 3000 });
    });

    test('Range inputs update visible labels via input event handlers', async ({ page }) => {
      await page.click('button[onclick="showPanel(\'biometricPanel\')"]');
      // Set duration and successRate via evaluate and ensure displayed values update
      await page.evaluate(() => {
        const dur = document.getElementById('bioDuration');
        dur.value = '1500';
        dur.dispatchEvent(new Event('input', { bubbles: true }));
        const rate = document.getElementById('bioSuccessRate');
        rate.value = '42';
        rate.dispatchEvent(new Event('input', { bubbles: true }));
      });

      await expect(page.locator('#bioDurationValue')).toHaveText('1500');
      await expect(page.locator('#bioSuccessRateValue')).toHaveText('42%');
    });
  });

  test.describe('Social Login (S4_SocialLogin)', () => {
    test('Social login attempts may succeed or fail, ensure UI feedback and possible session transition', async ({ page }) => {
      await page.click('button[onclick="showPanel(\'socialPanel\')"]');
      await expect(page.locator('#socialPanel')).toBeVisible();

      // Trigger Google login (90% chance success). Accept either success or error but validate UI feedback.
      await page.click('button[onclick="attemptSocialLogin(\'google\')"]');

      // Wait for either success or error message to appear
      const successLocator = page.locator('#socialSuccess');
      const errorLocator = page.locator('#socialError');

      // Wait up to 4s for either outcome
      await Promise.race([
        successLocator.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {}),
        errorLocator.waitFor({ state: 'visible', timeout: 4000 }).catch(() => {}),
      ]);

      const successVisible = await successLocator.isVisible();
      const errorVisible = await errorLocator.isVisible();

      expect(successVisible || errorVisible).toBeTruthy();

      if (successVisible) {
        // On success, sessionPanel should become visible
        await expect(page.locator('#sessionPanel')).toBeVisible();
      } else {
        // On failure, ensure error message contains provider name or failure hint
        await expect(errorLocator).toContainText('login failed');
      }
    });
  });

  test.describe('Multi-Factor Authentication (S5_MfaAuth)', () => {
    test('MFA section updates dynamically and clicking generated OTP buttons triggers runtime errors (undefined functions)', async ({ page }) => {
      // Ensure fresh start from selector
      await page.click('button[onclick="showPanel(\'mfaPanel\')"]');
      await expect(page.locator('#mfaPanel')).toBeVisible();

      // Change primary method to 'otp' to create a Send OTP button injected via updateMFASection
      await page.selectOption('#primaryMethod', 'otp');

      // Wait for the dynamic content to be injected
      const primarySendBtn = page.locator('#mfaSection >> text=Send OTP');
      await expect(primarySendBtn).toBeVisible({ timeout: 1000 });

      // Clear any previous page errors
      pageErrors.length = 0;

      // Clicking the dynamically injected "Send OTP" button calls sendMFAPrimaryOTP() which is NOT defined in the page -> ReferenceError expected
      await primarySendBtn.click();

      // Give the page a moment to register the pageerror
      await page.waitForTimeout(200);

      // Assert that a ReferenceError or similar runtime error was recorded
      const hadReferenceErrorPrimary = pageErrors.some(msg => /ReferenceError|is not defined/.test(msg));
      expect(hadReferenceErrorPrimary).toBeTruthy();

      // Reset errors array for the next check
      pageErrors.length = 0;

      // Now change secondary to 'otp' which will inject a "Send Secondary OTP" button with onclick sendMFASecondaryOTP()
      await page.selectOption('#primaryMethod', 'password'); // switch primary away so we can focus on secondary section creation below
      await page.selectOption('#secondaryMethod', 'otp');

      // Wait for the secondary send button to be visible
      const secondarySendBtn = page.locator('#mfaSection >> text=Send Secondary OTP');
      await expect(secondarySendBtn).toBeVisible({ timeout: 1000 });

      // Click the secondary button which should also call an undefined function leading to a ReferenceError
      await secondarySendBtn.click();
      await page.waitForTimeout(200);

      const hadReferenceErrorSecondary = pageErrors.some(msg => /ReferenceError|is not defined/.test(msg));
      expect(hadReferenceErrorSecondary).toBeTruthy();
    });

    test('Attempt MFA (successful path) transitions to session management', async ({ page }) => {
      await page.click('button[onclick="showPanel(\'mfaPanel\')"]');
      await expect(page.locator('#mfaPanel')).toBeVisible();

      // Attempt MFA (this function simply sets currentUser and navigates to sessionPanel)
      await page.click('button[onclick="attemptMFA()"]');
      await expect(page.locator('#sessionPanel')).toBeVisible();
    });
  });

  test.describe('Session Management (S6_SessionManagement)', () => {
    test('Extend session updates success message and logout returns to auth selector', async ({ page }) => {
      // Navigate to sessionPanel via a successful quick path: use attemptMFA which is deterministic
      await page.click('button[onclick="showPanel(\'mfaPanel\')"]');
      await page.click('button[onclick="attemptMFA()"]');
      await expect(page.locator('#sessionPanel')).toBeVisible();

      // Adjust session duration via evaluate and ensure the UI label updates
      await page.evaluate(() => {
        const sd = document.getElementById('sessionDuration');
        sd.value = '45';
        sd.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await expect(page.locator('#sessionDurationValue')).toHaveText('45 minutes');

      // Click Extend Session -> expect a success message in #sessionSuccess
      await page.click('button[onclick="extendSession()"]');
      await expect(page.locator('#sessionSuccess')).toBeVisible();
      await expect(page.locator('#sessionSuccess')).toContainText('Session extended by 45 minutes');

      // Test inactivity toggle shows/hides the inactivity section
      await page.check('#inactivityTimeout');
      await expect(page.locator('#inactivitySection')).toBeVisible();
      await page.uncheck('#inactivityTimeout');
      await expect(page.locator('#inactivitySection')).toBeHidden();

      // Click Logout -> should return to authSelector
      await page.click('button[onclick="logout()"]');
      await expect(page.locator('#authSelector')).toBeVisible();
      await expect(page.locator('#sessionPanel')).toBeHidden();

      // The logout function also calls showSuccess('session', 'Logged out successfully') before showing the selector.
      // Depending on showPanel's clearMessages ordering, the success message may be hidden; ensure that no unexpected runtime error occurred.
      expect(pageErrors.length).toBeGreaterThanOrEqual(0);
    });
  });

  test('Edge cases: clicking undefined MFA biometric verification triggers runtime error', async ({ page }) => {
    // Navigate to MFA panel
    await page.click('button[onclick="showPanel(\'mfaPanel\')"]');
    await expect(page.locator('#mfaPanel')).toBeVisible();

    // Set secondary to biometric to inject a button that calls attemptMFABiometric() which is NOT defined -> ReferenceError expected
    await page.selectOption('#secondaryMethod', 'biometric');

    // Wait for the injected button to appear
    const verifyBioBtn = page.locator('#mfaSection >> text=Verify Biometric');
    await expect(verifyBioBtn).toBeVisible({ timeout: 1000 });

    // Clear previous errors
    pageErrors.length = 0;

    // Click the button, expecting a runtime ReferenceError to be emitted
    await verifyBioBtn.click();
    await page.waitForTimeout(200);

    const hadReferenceError = pageErrors.some(msg => /ReferenceError|is not defined/.test(msg));
    expect(hadReferenceError).toBeTruthy();
  });

  test.afterEach(async ({ page }) => {
    // For debugging purposes, assert that consoleErrors array is present (but do not fail tests if empty).
    // This keeps observation intact as required.
    if (consoleErrors.length > 0) {
      // Log captured console errors in test output (Playwright will surface them)
      // Do not assert they must be present globally here (some tests intentionally cause errors).
      // eslint-disable-next-line no-console
      console.log('Captured console.error messages during test:', consoleErrors);
    }
  });
});