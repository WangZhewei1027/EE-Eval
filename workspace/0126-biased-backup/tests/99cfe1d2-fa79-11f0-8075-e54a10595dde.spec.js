import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99cfe1d2-fa79-11f0-8075-e54a10595dde.html';

// Page object encapsulating interactions with the Semaphore demo page
class SemaphorePage {
  constructor(page) {
    this.page = page;
    this.selectors = {
      btnRequest: '#btnRequest',
      btnRelease: '#btnRelease',
      statusText: '#statusText',
      semaphoreCount: '#semaphoreCount',
      setCount: '#setCount',
      username: '#username',
      addUser: '#addUser',
      userSelect: '#userSelect',
      userRequest: '#requestAccess',
      userRelease: '#releaseAccess'
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
    await this.page.waitForSelector(this.selectors.statusText);
  }

  async getStatusText() {
    return (await this.page.locator(this.selectors.statusText).innerText()).trim();
  }

  async clickGlobalRequest() {
    await this.page.click(this.selectors.btnRequest);
  }

  async clickGlobalRelease() {
    await this.page.click(this.selectors.btnRelease);
  }

  async setSemaphoreCount(value) {
    await this.page.fill(this.selectors.semaphoreCount, String(value));
    await this.page.click(this.selectors.setCount);
  }

  async addUser(username) {
    await this.page.fill(this.selectors.username, username);
    await this.page.click(this.selectors.addUser);
  }

  async getUserOptions() {
    return this.page.$$eval(`${this.selectors.userSelect} option`, options => options.map(o => o.textContent));
  }

  async selectUser(username) {
    await this.page.selectOption(this.selectors.userSelect, String(username));
  }

  async clickUserRequest() {
    await this.page.click(this.selectors.userRequest);
  }

  async clickUserRelease() {
    await this.page.click(this.selectors.userRelease);
  }
}

test.describe('Semaphore Demonstration - FSM behavior and UI validations', () => {
  let consoleErrors;
  let pageErrors;
  let pageWarnings;

  test.beforeEach(async ({ page }) => {
    // Collect console errors and page errors for assertions
    consoleErrors = [];
    pageErrors = [];
    pageWarnings = [];

    page.on('console', msg => {
      const type = msg.type();
      if (type === 'error') consoleErrors.push(msg.text());
      if (type === 'warning') pageWarnings.push(msg.text());
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });
  });

  test.describe('Initial state and Idle (S0_Idle)', () => {
    test('Initial page load shows Available: 1 and no runtime errors', async ({ page }) => {
      // Validate initial state: status should reflect initial availableCount (1)
      const s = new SemaphorePage(page);
      await s.goto();

      const status = await s.getStatusText();
      // Entry action updateStatus() should have executed on load
      expect(status).toBe('Available: 1');

      // No runtime uncaught page errors or console errors should have occurred
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('RequestAccess (S0 -> S1) and edge cases', () => {
    test('Global Request Access decrements available and shows alert when none left', async ({ page }) => {
      const s = new SemaphorePage(page);
      await s.goto();

      // First request should decrement from 1 to 0
      await s.clickGlobalRequest();
      expect(await s.getStatusText()).toBe('Available: 0');

      // Second request should trigger an alert "No available permits!"
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        s.clickGlobalRequest()
      ]);
      expect(dialog.message()).toBe('No available permits!');
      await dialog.accept();

      // Status should remain unchanged after failed request
      expect(await s.getStatusText()).toBe('Available: 0');

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('ReleaseAccess (S0 -> S2) and edge cases', () => {
    test('Global Release Access increments available when possible and alerts when releasing too many', async ({ page }) => {
      const s = new SemaphorePage(page);
      await s.goto();

      // Bring available to 0 first
      await s.clickGlobalRequest();
      expect(await s.getStatusText()).toBe('Available: 0');

      // Release should increment available from 0 to 1
      await s.clickGlobalRelease();
      expect(await s.getStatusText()).toBe('Available: 1');

      // Releasing again (when available == semaphoreCount) should produce an alert
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        s.clickGlobalRelease()
      ]);
      expect(dialog.message()).toBe('Cannot release more than available!');
      await dialog.accept();

      // Status remains unchanged
      expect(await s.getStatusText()).toBe('Available: 1');

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('SetSemaphoreCount (S0 -> S3) validations and errors', () => {
    test('Setting semaphore count updates available and handles invalid counts', async ({ page }) => {
      const s = new SemaphorePage(page);
      await s.goto();

      // Set to 2 -> Available should reflect updated semaphoreCount
      await s.setSemaphoreCount(2);
      expect(await s.getStatusText()).toBe('Available: 2');

      // Set to 1 -> Available returns to 1
      await s.setSemaphoreCount(1);
      expect(await s.getStatusText()).toBe('Available: 1');

      // Setting to 0 should trigger "Count must be at least 1."
      // Use waitForEvent to capture the alert dialog produced by the click
      await page.fill(s.selectors.semaphoreCount, '0');
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click(s.selectors.setCount)
      ]);
      expect(dialog.message()).toBe('Count must be at least 1.');
      await dialog.accept();

      // Status should remain as last valid value (1)
      expect(await s.getStatusText()).toBe('Available: 1');

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('AddUser (S0 -> S0) and user-specific transitions', () => {
    test('Adding users populates the select, user request/release modify available as expected', async ({ page }) => {
      const s = new SemaphorePage(page);
      await s.goto();

      // Add a user "alice"
      await s.addUser('alice');

      // The select should now contain the user
      const options = await s.getUserOptions();
      expect(options).toContain('alice');

      // Select the user and request access on their behalf -> available should decrement
      await s.selectUser('alice');
      // Ensure available is > 0 before requesting; initial available is 1
      expect(await s.getStatusText()).toBe('Available: 1');

      await s.clickUserRequest();
      expect(await s.getStatusText()).toBe('Available: 0');

      // Now release for the user -> available increments
      await s.clickUserRelease();
      expect(await s.getStatusText()).toBe('Available: 1');

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('User actions show appropriate alerts when no user selected, duplicate usernames, or invalid releases', async ({ page }) => {
      const s = new SemaphorePage(page);
      await s.goto();

      // Ensure no user selected and clicking userRequest triggers "Select a user."
      const [dlg1] = await Promise.all([
        page.waitForEvent('dialog'),
        s.clickUserRequest()
      ]);
      expect(dlg1.message()).toBe('Select a user.');
      await dlg1.accept();

      // Add a user bob and ensure releasing without access triggers "User does not have access!"
      await s.addUser('bob');
      // Select bob explicitly
      await s.selectUser('bob');
      const [dlg2] = await Promise.all([
        page.waitForEvent('dialog'),
        s.clickUserRelease()
      ]);
      expect(dlg2.message()).toBe('User does not have access!');
      await dlg2.accept();

      // Attempt to add duplicate user 'bob' should alert "Enter a valid username."
      // Fill the username input with 'bob' again
      await page.fill(s.selectors.username, 'bob');
      const [dlg3] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click(s.selectors.addUser)
      ]);
      expect(dlg3.message()).toBe('Enter a valid username.');
      await dlg3.accept();

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Comprehensive integration: sequence of operations modeling FSM transitions', () => {
    test('Sequence: Add user -> set count -> user requests -> release -> edge alerts', async ({ page }) => {
      const s = new SemaphorePage(page);
      await s.goto();

      // Add user 'charlie'
      await s.addUser('charlie');
      const optionsAfterAdd = await s.getUserOptions();
      expect(optionsAfterAdd).toContain('charlie');

      // Increase semaphore count to 2
      await s.setSemaphoreCount(2);
      expect(await s.getStatusText()).toBe('Available: 2');

      // Charlie requests access twice (only once needed, but test repeated behavior)
      await s.selectUser('charlie');
      await s.clickUserRequest();
      expect(await s.getStatusText()).toBe('Available: 1');

      // Simulate another global request to reduce to 0
      await s.clickGlobalRequest();
      expect(await s.getStatusText()).toBe('Available: 0');

      // Further requests should trigger "No available permits!"
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        s.clickGlobalRequest()
      ]);
      expect(dialog.message()).toBe('No available permits!');
      await dialog.accept();

      // Release access globally and validate available increments
      await s.clickGlobalRelease();
      expect(await s.getStatusText()).toBe('Available: 1');

      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });
});