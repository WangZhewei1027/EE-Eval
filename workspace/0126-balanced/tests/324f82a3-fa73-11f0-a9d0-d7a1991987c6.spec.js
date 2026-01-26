import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f82a3-fa73-11f0-a9d0-d7a1991987c6.html';

test.describe('Integration Testing Demo - FSM validation (324f82a3-fa73-11f0-a9d0-d7a1991987c6)', () => {
  // Arrays to capture console errors and page errors for each test
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      // err is an Error object from the page
      pageErrors.push(err.message || String(err));
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No teardown modifications; listeners are removed automatically when pages are closed by Playwright
  });

  test.describe('State: S0_Idle (Initial state)', () => {
    test('Initial render shows header, registration form, empty user list and result', async ({ page }) => {
      // This test validates the Idle state entry evidence:
      // - <h1>Integration Testing Demo</h1>
      // - <form id="registrationForm">
      // - Inputs for #username and #email present and required
      // - #userList is empty
      // - #result is empty

      // Check page title header
      const header = page.locator('h1');
      await expect(header).toHaveText('Integration Testing Demo');

      // Check registration form and its controls exist
      const form = page.locator('#registrationForm');
      await expect(form).toBeVisible();

      const username = page.locator('#username');
      const email = page.locator('#email');
      const submitBtn = page.locator('button[type="submit"]');

      await expect(username).toBeVisible();
      await expect(email).toBeVisible();
      await expect(submitBtn).toHaveText('Register');

      // Inputs should have required attribute
      await expect(username).toHaveAttribute('required', '');
      await expect(email).toHaveAttribute('required', '');

      // User list should be empty and result div empty
      const userListItems = page.locator('#userList li');
      await expect(userListItems).toHaveCount(0);

      const resultDiv = page.locator('#result');
      await expect(resultDiv).toBeEmpty();

      // Ensure no console or page errors occurred on initial load
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Transition: SubmitForm -> S1_UserRegistered (User Registered state)', () => {
    test('Submitting valid form registers a user, updates list and displays result', async ({ page }) => {
      // This test validates the main transition:
      // - Fill username and email, submit the form
      // - updateUserList() should add the user to #userList
      // - displayResult() should show the registration message
      // - form should be reset after submit

      const usernameInput = page.locator('#username');
      const emailInput = page.locator('#email');
      const submitBtn = page.locator('button[type="submit"]');
      const userList = page.locator('#userList');
      const resultDiv = page.locator('#result');

      // Fill and submit
      await usernameInput.fill('alice');
      await emailInput.fill('alice@example.com');
      await submitBtn.click();

      // After submission, expect one list item with the registered user
      const items = page.locator('#userList li');
      await expect(items).toHaveCount(1);
      await expect(items.first()).toHaveText('alice (alice@example.com)');

      // Result div should contain the expected message
      await expect(resultDiv).toHaveText('User Registered: alice (alice@example.com)');

      // Form inputs should be reset
      await expect(usernameInput).toHaveValue('');
      await expect(emailInput).toHaveValue('');

      // Also verify the internal userService state via page.evaluate (read-only)
      const users = await page.evaluate(() => {
        if (window.userService && typeof window.userService.getAllUsers === 'function') {
          return window.userService.getAllUsers();
        }
        return null;
      });
      expect(Array.isArray(users)).toBeTruthy();
      expect(users.length).toBe(1);
      expect(users[0]).toEqual({ username: 'alice', email: 'alice@example.com' });

      // Ensure no console or page errors occurred during registration
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Registering multiple users accumulates in user list and shows latest result', async ({ page }) => {
      // Validate that subsequent submissions append to the list and display the latest result

      const usernameInput = page.locator('#username');
      const emailInput = page.locator('#email');
      const submitBtn = page.locator('button[type="submit"]');
      const items = page.locator('#userList li');
      const resultDiv = page.locator('#result');

      // Register first user
      await usernameInput.fill('bob');
      await emailInput.fill('bob@example.com');
      await submitBtn.click();

      await expect(items).toHaveCount(1);
      await expect(items.nth(0)).toHaveText('bob (bob@example.com)');
      await expect(resultDiv).toHaveText('User Registered: bob (bob@example.com)');

      // Register second user
      await usernameInput.fill('carol');
      await emailInput.fill('carol@example.org');
      await submitBtn.click();

      // Now there should be two items, in order of registration
      await expect(items).toHaveCount(2);
      await expect(items.nth(0)).toHaveText('bob (bob@example.com)');
      await expect(items.nth(1)).toHaveText('carol (carol@example.org)');

      // Result should reflect the most recent registration
      await expect(resultDiv).toHaveText('User Registered: carol (carol@example.org)');

      // Verify internal service state contains both users
      const users = await page.evaluate(() => window.userService.getAllUsers());
      expect(users.length).toBe(2);
      expect(users[0]).toEqual({ username: 'bob', email: 'bob@example.com' });
      expect(users[1]).toEqual({ username: 'carol', email: 'carol@example.org' });

      // No console or page errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Edge cases & validation (negative scenarios)', () => {
    test('Submitting with empty required fields does not register a user', async ({ page }) => {
      // Attempt to submit the form without filling required fields.
      // Expected: The browser will prevent submission due to required attributes,
      // and no user should be added to the user list and result should remain empty.

      const submitBtn = page.locator('button[type="submit"]');
      const items = page.locator('#userList li');
      const resultDiv = page.locator('#result');

      // Ensure fields are empty by default
      await expect(page.locator('#username')).toHaveValue('');
      await expect(page.locator('#email')).toHaveValue('');

      // Click the submit button; browser validation should prevent submit handler from running
      await submitBtn.click();

      // No items should be added; result should remain empty
      await expect(items).toHaveCount(0);
      await expect(resultDiv).toBeEmpty();

      // No console or page errors should be thrown as a result
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Submitting with invalid email does not register a user (HTML5 validation)', async ({ page }) => {
      // Fill username but invalid email; the input type="email" should prevent submission.
      // Expected: no new users added and no result shown.

      const usernameInput = page.locator('#username');
      const emailInput = page.locator('#email');
      const submitBtn = page.locator('button[type="submit"]');
      const items = page.locator('#userList li');
      const resultDiv = page.locator('#result');

      await usernameInput.fill('dave');
      await emailInput.fill('not-an-email'); // invalid email format
      await submitBtn.click();

      // Because of HTML5 validation, form should not submit and no list item added
      await expect(items).toHaveCount(0);
      await expect(resultDiv).toBeEmpty();

      // Fields may still contain the invalid value (browser does not clear them)
      await expect(usernameInput).toHaveValue('dave');
      await expect(emailInput).toHaveValue('not-an-email');

      // No console or page errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Page does not throw ReferenceError/SyntaxError/TypeError on normal interactions', async ({ page }) => {
      // This test explicitly observes the console and page errors while performing normal interactions.
      // It does not attempt to create errors; it asserts that no JS runtime errors have occurred.

      const usernameInput = page.locator('#username');
      const emailInput = page.locator('#email');
      const submitBtn = page.locator('button[type="submit"]');

      // Perform a valid submit
      await usernameInput.fill('eve');
      await emailInput.fill('eve@example.test');
      await submitBtn.click();

      // Give a small pause to allow any async errors to surface
      await page.waitForTimeout(100);

      // Assert that no console errors or page errors were captured
      // (If the app contained ReferenceError/SyntaxError/TypeError, they would have been captured above)
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });
});