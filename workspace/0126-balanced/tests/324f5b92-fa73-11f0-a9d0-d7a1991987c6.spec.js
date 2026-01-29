import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f5b92-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object for the REST API Demo page.
 * Encapsulates selectors and common interactions.
 */
class RestApiPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.fetchBtn = page.locator('.btn-fetch');
    this.createBtn = page.locator('.btn-create');
    this.dataDiv = page.locator('#data');
    this.userItems = page.locator('#data .user');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the Fetch Users button
  async clickFetch() {
    await this.fetchBtn.click();
  }

  // Click the Create User button
  async clickCreate() {
    await this.createBtn.click();
  }

  // Return number of .user elements currently rendered
  async userCount() {
    return await this.userItems.count();
  }

  // Wait until at least one user is rendered (used to assert Users Fetched state)
  async waitForUsers(timeout = 5000) {
    await this.page.waitForSelector('#data .user', { timeout });
  }

  // Get text content of first user (if exists)
  async firstUserText() {
    const count = await this.userCount();
    if (count === 0) return '';
    return await this.userItems.nth(0).innerText();
  }

  // Return the innerHTML of data div (useful for debugging/assertions)
  async dataHtml() {
    return await this.dataDiv.innerHTML();
  }
}

test.describe('REST API Demo - FSM states and transitions', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Ensure each test starts with a clean page and listeners
    // Listeners are added within tests to collect events relevant to that test
  });

  test.afterEach(async ({ page }) => {
    // No special teardown required; Playwright closes pages automatically
  });

  test('Idle state: initial UI shows Fetch and Create buttons and empty data div', async ({ page }) => {
    // Validate the Idle state: buttons are present and data div is empty
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (m) => consoleMessages.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const app = new RestApiPage(page);
    await app.goto();

    // Buttons should be visible
    await expect(app.fetchBtn).toBeVisible();
    await expect(app.createBtn).toBeVisible();

    // data div should exist and be empty initially
    await expect(app.dataDiv).toBeVisible();
    const initialHtml = await app.dataHtml();
    expect(initialHtml.trim()).toBe('', 'Expected #data to be empty in Idle state');

    // There should be no page errors or console errors on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: Fetch Users -> Users Fetched (displayUsers called implicitly via DOM change)', async ({ page }) => {
    // This test validates the "Fetch Users" event and the "Users Fetched" state:
    // - Click "Fetch Users"
    // - Wait for users to be displayed in #data
    // - Assert that at least one .user exists and content looks like name + email
    const consoleMessages1 = [];
    const pageErrors1 = [];

    page.on('console', (m) => consoleMessages.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const app1 = new RestApiPage(page);
    await app.goto();

    // Trigger the FetchUsers event
    await app.clickFetch();

    // Wait for the onEnter action displayUsers(users) to be observable via DOM
    await app.waitForUsers(10000); // allow generous timeout for network

    const count1 = await app.userCount();
    expect(count).toBeGreaterThan(0);

    // Validate the structure/content of the first user block
    const firstText = await app.firstUserText();
    expect(firstText).toMatch(/.+\n?Email: .+@.+\..+/, 'Expected first user to show a name and email');

    // Ensure no runtime page errors or console errors occurred during fetch
    const consoleErrors1 = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition: Create User -> User Created -> Users Fetched (alert shown and list refreshed)', async ({ page }) => {
    // This test validates the create user flow:
    // - Click "Create User"
    // - Capture the alert dialog that confirms creation (onCreate entry action)
    // - After accepting, ensure users list is refreshed (Users Fetched state)
    const consoleMessages2 = [];
    const pageErrors2 = [];

    page.on('console', (m) => consoleMessages.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const app2 = new RestApiPage(page);
    await app.goto();

    // Listen for the dialog that should be triggered by createUser -> alert(...)
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog', { timeout: 10000 }),
      app.clickCreate()
    ]);

    // Validate dialog contains expected confirmation text (User Created: <name>)
    expect(dialog.message()).toMatch(/User Created: /);
    // Accept the dialog to allow flow to continue (fetchUsers called afterwards)
    await dialog.accept();

    // After alert is accepted, the page calls fetchUsers() to refresh the list
    // Wait for refreshed users to appear
    await app.waitForUsers(10000);
    const countAfterCreate = await app.userCount();
    expect(countAfterCreate).toBeGreaterThan(0, 'Expected user list to be refreshed after creating a user');

    // Validate that the alert's name portion matches the name being created
    // The app sends name 'John Doe' in createUser, so expect that in the alert
    expect(dialog.message()).toContain('John Doe');

    // Ensure no runtime page errors or console errors occurred during create + refresh
    const consoleErrors2 = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case / Error scenario: Fetch fails -> page emits an error (simulate network failure)', async ({ page }) => {
    // This test simulates a network failure for the API endpoint to ensure the application
    // surfaces errors (we do not modify application code; we only intercept network in the test).
    // We expect that a page error or console error will be emitted when fetch() fails.
    // NOTE: The app code does not handle fetch errors (no try/catch), so an unhandled rejection or exception
    // may occur which Playwright surfaces as a pageerror. We assert that such an error occurs.

    const pageErrors3 = [];
    const consoleMessages3 = [];

    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (m) => consoleMessages.push({ type: m.type(), text: m.text() }));

    // Intercept network calls to the API and abort to simulate network failure.
    // This makes the fetch() promise reject and should produce an error in the page.
    await page.route('**/jsonplaceholder.typicode.com/users**', route => {
      // Abort the request to simulate a network failure (this should lead to a fetch error)
      route.abort();
    });

    const app3 = new RestApiPage(page);
    await app.goto();

    // Trigger fetch which will be aborted by our route handler
    await app.clickFetch();

    // Wait for a pageerror or console error to be emitted as a result of failed fetch
    // We poll for up to 5s to give the browser time to produce the error
    const timeout = 5000;
    const start = Date.now();
    while (Date.now() - start < timeout && pageErrors.length === 0 && !consoleMessages.some(m => m.type === 'error')) {
      await new Promise(r => setTimeout(r, 100));
    }

    // We expect at least one error (either pageerror or console error) because fetch was aborted
    const consoleErrors3 = consoleMessages.filter(m => m.type === 'error');
    const anyPageError = pageErrors.length > 0;
    const anyConsoleError = consoleErrors.length > 0;

    expect(anyPageError || anyConsoleError).toBeTruthy();

    // If a page error exists, assert its message contains a likely fetch failure description
    if (anyPageError) {
      // Typical messages might include "TypeError: Failed to fetch" or network-related text
      const messages = pageErrors.map(e => e.message || String(e));
      expect(messages.some(m => /fetch|Failed|TypeError|network/i.test(m))).toBeTruthy();
    }

    // If console error exists, assert it indicates network/fetch failure
    if (anyConsoleError) {
      const texts = consoleErrors.map(c => c.text);
      expect(texts.some(t => /fetch|Failed to fetch|TypeError|network/i.test(t))).toBeTruthy();
    }
  });

  test('Transition: From User Created -> Users Fetched via explicit fetch (simulate the subsequent FetchUsers event)', async ({ page }) => {
    // This test validates the transition described in the FSM where, after a user is created,
    // a subsequent fetchUsers() is called to transition to the Users Fetched state.
    // We'll invoke create flow (capture alert) and then explicitly trigger FetchUsers (click fetch)
    // to assert the Users Fetched state is reachable from S2_UserCreated as well.

    const consoleMessages4 = [];
    const pageErrors4 = [];

    page.on('console', (m) => consoleMessages.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    const app4 = new RestApiPage(page);
    await app.goto();

    // Create a user first and accept the alert
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog', { timeout: 10000 }),
      app.clickCreate()
    ]);
    await dialog.accept();

    // At this point the app calls fetchUsers() internally, but we also explicitly trigger FetchUsers
    // to validate the transition is idempotent / works from S2_UserCreated as described in FSM.
    await app.clickFetch();

    // After clicking fetch, ensure users are displayed
    await app.waitForUsers(10000);
    const count2 = await app.userCount();
    expect(count).toBeGreaterThan(0);

    // Ensure no runtime errors were produced during these transitions
    const consoleErrors4 = consoleMessages.filter(m => m.type === 'error');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});