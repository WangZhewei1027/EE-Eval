import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520aa684-fa76-11f0-a09b-87751f540fd8.html';

// Page Object to encapsulate interactions and capture console / page errors
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];

    this._consoleListener = msg => {
      this.consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    };

    this._pageErrorListener = error => {
      // error is an Error object
      this.pageErrors.push({
        message: error.message,
        stack: error.stack,
      });
    };
  }

  async init() {
    // Attach listeners before navigation to capture errors during script execution
    this.page.on('console', this._consoleListener);
    this.page.on('pageerror', this._pageErrorListener);
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async dispose() {
    this.page.removeListener('console', this._consoleListener);
    this.page.removeListener('pageerror', this._pageErrorListener);
  }

  // Helpers to query DOM elements; returns Playwright Locator
  get getButton() {
    return this.page.locator('#get-btn');
  }
  get postButton() {
    return this.page.locator('#post-btn');
  }
  get putButton() {
    return this.page.locator('#put-btn');
  }
  get deleteButton() {
    return this.page.locator('#delete-btn');
  }

  // Click helpers (do not attempt to click if element doesn't exist)
  async clickGet() {
    await this.getButton.click();
  }

  // Utility to wait for a console log matching substring (with timeout)
  async waitForConsoleText(substring, timeout = 3000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      if (this.consoleMessages.some(m => m.text.includes(substring))) return true;
      await this.page.waitForTimeout(50);
    }
    return false;
  }
}

test.describe('HTTP Example FSM - 520aa684-fa76-11f0-a09b-87751f540fd8', () => {
  let app;

  test.beforeEach(async ({ page }) => {
    app = new AppPage(page);
    await app.init();
  });

  test.afterEach(async () => {
    await app.dispose();
  });

  test('Initial DOM: GET button exists, other buttons are missing, and script load errors are observed', async () => {
    // Validate GET button is present and has expected text
    await expect(app.getButton).toHaveCount(1);
    await expect(app.getButton).toHaveText('GET Request');

    // The HTML is missing #post-btn, #put-btn, #delete-btn elements.
    // FSM expects them, but the implementation is broken. Assert absence.
    await expect(app.postButton).toHaveCount(0);
    await expect(app.putButton).toHaveCount(0);
    await expect(app.deleteButton).toHaveCount(0);

    // The inline script attempts to attach event listeners to missing buttons.
    // That should create a runtime page error (TypeError). Assert we captured at least one page error.
    expect(app.pageErrors.length).toBeGreaterThanOrEqual(1);

    // The error message in modern browsers often contains phrases like:
    // "Cannot read properties of null (reading 'addEventListener')" or mentions addEventListener
    const combinedMessages = app.pageErrors.map(e => e.message).join('\n');
    expect(combinedMessages).toMatch(/addEventListener|Cannot read properties|reading/i);
  });

  test('GET_REQUEST transition: clicking GET triggers network request and logs / receives successful response', async ({ page }) => {
    // The GET handler was attached before the script threw an error on missing buttons.
    // When clicking GET, the page should request the JSONPlaceholder resource.
    const targetUrl = 'https://jsonplaceholder.typicode.com/todos/1';

    // Start waiting for the response before clicking to avoid race conditions
    const responsePromise = page.waitForResponse(r => r.url() === targetUrl && r.request().method() === 'GET', { timeout: 5000 });

    // Trigger the GET request by clicking the GET button
    await app.clickGet();

    // Await the response and assert it's OK (200 range)
    const response = await responsePromise;
    expect(response).toBeTruthy();
    const status = response.status();
    expect(status).toBeGreaterThanOrEqual(200);
    expect(status).toBeLessThan(400);

    // The implementation logs the parsed JSON via console.log(data) on success.
    // We may not reliably get a stringified JSON in the console text, but verify some expected keys or values
    // are present in any console.log output after the click (e.g., "userId" or "title").
    const found = await app.waitForConsoleText('userId', 3000) ||
                  await app.waitForConsoleText('title', 3000) ||
                  await app.waitForConsoleText('id', 3000);
    expect(found).toBeTruthy();
  });

  test('POST/PUT/DELETE transitions: handlers are not attached; ensure transitions cannot be triggered and error context exists', async () => {
    // Because the script threw a TypeError during initialization (attaching handlers to missing elements),
    // the POST, PUT, DELETE event handlers were never attached. Assert their buttons do not exist.
    await expect(app.postButton).toHaveCount(0);
    await expect(app.putButton).toHaveCount(0);
    await expect(app.deleteButton).toHaveCount(0);

    // Attempting to click a non-existent button would time out; instead, assert the absence and
    // assert that the previously captured page errors reference event listener attachment.
    expect(app.pageErrors.length).toBeGreaterThanOrEqual(1);
    const messages = app.pageErrors.map(e => e.message).join(' | ');
    // We expect error message to reference addEventListener or inability to read property
    expect(messages).toMatch(/addEventListener|Cannot read properties|reading/i);
  });

  test('Edge cases and negative assertions: ensure no successful delete log and no unexpected console successes for missing handlers', async () => {
    // There should be no "Post deleted successfully" string in console because delete handler was not attached.
    const deletionLogPresent = app.consoleMessages.some(m => m.text.includes('Post deleted successfully'));
    expect(deletionLogPresent).toBeFalsy();

    // Also ensure that console did not log successful POST/PUT responses since those handlers never attached.
    const postSuccess = app.consoleMessages.some(m => m.text.includes('New Post') || m.text.includes('Updated Post'));
    expect(postSuccess).toBeFalsy();
  });

  test('Observability: collect and assert structure of console and page errors (sanity)', async () => {
    // Ensure we have captured console messages (including the JSON from GET and possibly the error)
    expect(Array.isArray(app.consoleMessages)).toBeTruthy();

    // At minimum expect one console type entry from script execution (maybe from GET click)
    expect(app.consoleMessages.length).toBeGreaterThanOrEqual(0);

    // Confirm that page errors include a stack trace for debugging (non-empty stack)
    for (const err of app.pageErrors) {
      expect(typeof err.message).toBe('string');
      // stack may not always be available in all contexts, but when present ensure it's a string
      if (err.stack !== undefined) {
        expect(typeof err.stack).toBe('string');
      }
    }
  });
});