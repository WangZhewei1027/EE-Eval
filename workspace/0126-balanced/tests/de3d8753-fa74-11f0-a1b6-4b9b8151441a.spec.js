import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d8753-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('Integration Testing Demo - FSM validation', () => {
  // Helper to capture console and page errors per test
  async function attachLogging(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      // capture console messages with type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    return { consoleMessages, pageErrors };
  }

  test.beforeEach(async ({ page }) => {
    // Navigate to the application before each test
    await page.goto(APP_URL);
    // ensure page loaded
    await expect(page.locator('h1')).toHaveText('Integration Testing Demonstration');
  });

  test('Idle state renders initial UI correctly (S0_Idle)', async ({ page }) => {
    // Validate Idle state: header, description, buttons and empty results
    const { consoleMessages, pageErrors } = await attachLogging(page);

    // Basic UI elements
    await expect(page.locator('h1')).toHaveText('Integration Testing Demonstration');
    await expect(page.locator('#runAuthTest')).toHaveText('Run Authentication Test');
    await expect(page.locator('#runCheckoutTest')).toHaveText('Run Checkout Test');

    // results area should be empty on load
    await expect(page.locator('#results')).toHaveText('');

    // No runtime errors should have been emitted while loading Idle state
    expect(pageErrors.length).toBe(0);
    // No console errors of type 'error' expected at idle
    const hasConsoleErrors = consoleMessages.some(m => m.type === 'error');
    expect(hasConsoleErrors).toBeFalsy();
  });

  test.describe('Authentication Test Flow (S1 -> S2/S3)', () => {
    test('Run Authentication Test -> passes (S1_AuthTestRunning -> S2_AuthTestPassed)', async ({ page }) => {
      // Validate the "running" UI and eventual pass outcome
      const { consoleMessages, pageErrors } = await attachLogging(page);

      const authButton = page.locator('#runAuthTest');
      const authResult = page.locator('#authResult');
      const results = page.locator('#results');

      // Click to start auth test: should show "Running tests..." immediately
      await authButton.click();

      // onEnter action: Running tests...
      await expect(authResult).toContainText('Running tests...', { timeout: 1000 });

      // Wait for the async test to complete and for the pass message to appear (setTimeout 500ms in app)
      await expect(authResult.locator('.pass')).toHaveText(/✓ Authentication test passed! All components work together correctly\./, { timeout: 3000 });

      // The summary results should have a PASS entry for the integration test
      await expect(results).toContainText('✓ PASS: User Authentication Integration', { timeout: 1000 });

      // Test clean-up: sessionManager.destroySession() should have been called in testUserAuthentication,
      // so sessionManager.currentSession should be null
      const currentSession = await page.evaluate(() => {
        // read existing global sessionManager; do not redefine it
        return typeof sessionManager !== 'undefined' ? sessionManager.currentSession : null;
      });
      expect(currentSession).toBeNull();

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
      // No console errors for the successful path
      const hasConsoleErrors1 = consoleMessages.some(m => m.type === 'error');
      expect(hasConsoleErrors).toBeFalsy();
    });

    test('Run Authentication Test -> fails (S1_AuthTestRunning -> S3_AuthTestFailed) by removing users', async ({ page }) => {
      // Simulate a failing authentication integration by removing all users from userDatabase
      // Note: we do not redefine functions; we mutate existing data to trigger assertions inside testUserAuthentication
      const { consoleMessages, pageErrors } = await attachLogging(page);

      // Remove users to force user lookup failure inside testUserAuthentication
      await page.evaluate(() => {
        if (typeof userDatabase !== 'undefined' && Array.isArray(userDatabase.users)) {
          userDatabase.users = []; // cause findUser to return undefined -> assertion failure
        }
      });

      const authButton1 = page.locator('#runAuthTest');
      const authResult1 = page.locator('#authResult1');
      const results1 = page.locator('#results1');

      // Start the test
      await authButton.click();

      // onEnter running state should be shown
      await expect(authResult).toContainText('Running tests...', { timeout: 1000 });

      // Wait for fail result to appear
      await expect(authResult.locator('.fail')).toHaveText(/✗ Authentication test failed. Check console for details\./, { timeout: 3000 });

      // Summary should record a FAIL entry
      await expect(results).toContainText('✗ FAIL: User Authentication Integration', { timeout: 1000 });

      // Ensure no uncaught page errors bubbled up (runTest catches exceptions)
      expect(pageErrors.length).toBe(0);
      const hasConsoleErrors2 = consoleMessages.some(m => m.type === 'error');
      expect(hasConsoleErrors).toBeFalsy();

      // Restore users back to initial state so other tests are not affected
      await page.evaluate(() => {
        if (typeof userDatabase !== 'undefined') {
          userDatabase.users = [
            { email: 'test@example.com', password: 'password123', name: 'Test User' },
            { email: 'admin@example.com', password: 'admin123', name: 'Admin User' }
          ];
        }
      });
    });

    test('Clicking Run Authentication Test multiple times accumulates results', async ({ page }) => {
      // Edge case: multiple rapid clicks produce multiple result entries
      const { pageErrors } = await attachLogging(page);

      const authButton2 = page.locator('#runAuthTest');
      const results2 = page.locator('#results2');

      // Click twice in quick succession
      await authButton.click();
      await authButton.click();

      // Wait long enough for both to complete
      await page.waitForTimeout(1200);

      // Expect at least two PASS entries (or PASS + PASS/FAIL depending on timing) for the auth test name
      const resultsText = await results.innerText();
      const occurrences = (resultsText.match(/User Authentication Integration/g) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(2);

      // Ensure no uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Checkout Test Flow (S4 -> S5/S6)', () => {
    test('Run Checkout Test -> passes (S4_CheckoutTestRunning -> S5_CheckoutTestPassed)', async ({ page }) => {
      const { consoleMessages, pageErrors } = await attachLogging(page);

      const checkoutButton = page.locator('#runCheckoutTest');
      const checkoutResult = page.locator('#checkoutResult');
      const results3 = page.locator('#results3');

      // Click to start checkout test
      await checkoutButton.click();

      // onEnter: Running tests...
      await expect(checkoutResult).toContainText('Running tests...', { timeout: 1000 });

      // Wait for pass message after the timeout in application
      await expect(checkoutResult.locator('.pass')).toHaveText(/✓ Checkout test passed! All components work together correctly\./, { timeout: 3000 });

      // Ensure summary shows PASS entry for Checkout integration
      await expect(results).toContainText('✓ PASS: Checkout Process Integration', { timeout: 1000 });

      // Ensure cart is cleared after test (cleanup step in testCheckoutProcess)
      const cartContents = await page.evaluate(() => {
        return typeof cartManager !== 'undefined' ? cartManager.cart : null;
      });
      expect(Array.isArray(cartContents)).toBeTruthy();
      expect(cartContents.length).toBe(0);

      // No uncaught page errors or console errors
      expect(pageErrors.length).toBe(0);
      const hasConsoleErrors3 = consoleMessages.some(m => m.type === 'error');
      expect(hasConsoleErrors).toBeFalsy();
    });

    test('Run Checkout Test -> fails (S4_CheckoutTestRunning -> S6_CheckoutTestFailed) by forcing payment failure', async ({ page }) => {
      // To reach the failed checkout state we mutate the existing paymentProcessor.processPayment implementation
      // WARNING: We are modifying an existing global function to simulate a failing payment scenario for testing FSM transitions.
      // This intentionally reassigns a function on the existing global object (not introducing new globals).
      const { consoleMessages, pageErrors } = await attachLogging(page);

      // Replace paymentProcessor.processPayment with a function that always fails.
      await page.evaluate(() => {
        if (typeof paymentProcessor !== 'undefined') {
          // mutate the existing object method to return failure - this simulates a failing component
          paymentProcessor.processPayment = function (amount, card) {
            return { success: false, error: 'Forced failure for test' };
          };
        }
      });

      const checkoutButton1 = page.locator('#runCheckoutTest');
      const checkoutResult1 = page.locator('#checkoutResult1');
      const results4 = page.locator('#results4');

      // Start the test
      await checkoutButton.click();

      // onEnter: Running tests...
      await expect(checkoutResult).toContainText('Running tests...', { timeout: 1000 });

      // Wait for fail message
      await expect(checkoutResult.locator('.fail')).toHaveText(/✗ Checkout test failed. Check console for details\./, { timeout: 3000 });

      // Summary should have a FAIL entry for the Checkout test
      await expect(results).toContainText('✗ FAIL: Checkout Process Integration', { timeout: 1000 });

      // No uncaught page errors (runTest catches thrown assertions)
      expect(pageErrors.length).toBe(0);
      const hasConsoleErrors4 = consoleMessages.some(m => m.type === 'error');
      expect(hasConsoleErrors).toBeFalsy();

      // Restore original paymentProcessor.processPayment implementation to avoid affecting other tests.
      // We will reassign to the original implementation by reloading the page to get fresh script state.
      await page.reload();
      await expect(page.locator('h1')).toHaveText('Integration Testing Demonstration');
    });

    test('Edge case: clicking Run Checkout Test multiple times accumulates results', async ({ page }) => {
      const { pageErrors } = await attachLogging(page);

      const checkoutButton2 = page.locator('#runCheckoutTest');
      const results5 = page.locator('#results5');

      await checkoutButton.click();
      await checkoutButton.click();

      // Wait for both to have completed
      await page.waitForTimeout(1200);

      const resultsText1 = await results.innerText();
      const occurrences1 = (resultsText.match(/Checkout Process Integration/g) || []).length;
      expect(occurrences).toBeGreaterThanOrEqual(2);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test('Verify FSM evidence: event handlers exist for both buttons', async ({ page }) => {
    // Confirm that event handlers are attached by triggering click and observing running state update
    const { pageErrors } = await attachLogging(page);

    // For Auth button
    await page.click('#runAuthTest');
    await expect(page.locator('#authResult')).toContainText('Running tests...', { timeout: 1000 });

    // For Checkout button
    await page.click('#runCheckoutTest');
    await expect(page.locator('#checkoutResult')).toContainText('Running tests...', { timeout: 1000 });

    // No uncaught errors from handler invocation
    expect(pageErrors.length).toBe(0);
  });
});