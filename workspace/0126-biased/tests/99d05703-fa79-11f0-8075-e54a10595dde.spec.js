import { test, expect } from '@playwright/test';

const PAGE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d05703-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Interactive HTTP Model page
class HttpInteractivePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Request configuration selectors
    this.method = page.locator('#method');
    this.url = page.locator('#url');
    this.header = page.locator('#header');
    this.body = page.locator('#body');
    this.sendRequestBtn = page.locator('#sendRequest');
    this.responseDisplay = page.locator('#responseDisplay');

    // State management selectors
    this.stateInput = page.locator('#stateInput');
    this.updateStateBtn = page.locator('#updateState');
    this.resetStateBtn = page.locator('#resetState');
    this.currentStateDisplay = page.locator('#currentState');

    // Environment selectors
    this.envInput = page.locator('#envInput');
    this.setEnvBtn = page.locator('#setEnv');
    this.envDisplay = page.locator('#envDisplay');
  }

  async goto() {
    await this.page.goto(PAGE_URL);
  }

  // Trigger sending request with given params
  async sendRequest({ method = 'GET', url = '', header = '', body = '' } = {}) {
    await this.method.selectOption(method);
    await this.url.fill(url);
    await this.header.fill(header);
    await this.body.fill(body);
    await this.sendRequestBtn.click();
  }

  // Read the response display text
  async getResponseText() {
    return (await this.responseDisplay.innerText()).trim();
  }

  // Trigger update state
  async updateState(value) {
    await this.stateInput.fill(value);
    await this.updateStateBtn.click();
  }

  // Trigger reset state
  async resetState() {
    await this.resetStateBtn.click();
  }

  // Read current state display
  async getCurrentStateText() {
    return (await this.currentStateDisplay.innerText()).trim();
  }

  // Set environment variable
  async setEnv(value) {
    await this.envInput.fill(value);
    await this.setEnvBtn.click();
  }

  // Read env display
  async getEnvDisplayText() {
    return (await this.envDisplay.innerText()).trim();
  }
}

test.describe('HTTP Interactive Model - states and transitions', () => {
  // Collect page errors and console messages for each test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // Record the error object (message & name) for assertions
      pageErrors.push({
        message: err.message,
        name: err.name,
        stack: err.stack
      });
    });

    // Capture console messages (log/warn/error)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  });

  test.afterEach(async () => {
    // After each test we assert that there were no critical runtime errors:
    // This helps catch unexpected ReferenceError/SyntaxError/TypeError if they occur.
    // If an error occurred intentionally in the application, the test above would fail here.
    expect(pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
    // Also assert no console errors were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors, 'No console.error messages should have been emitted').toEqual([]);
  });

  test('Idle state renders expected controls and initial DOM (Idle entry actions)', async ({ page }) => {
    // Validate the initial rendered UI contains the primary controls described in the FSM
    const app = new HttpInteractivePage(page);
    await app.goto();

    // Check presence and initial values of components
    await expect(app.method).toBeVisible();
    await expect(app.url).toBeVisible();
    await expect(app.header).toBeVisible();
    await expect(app.body).toBeVisible();
    await expect(app.sendRequestBtn).toBeVisible();
    await expect(app.responseDisplay).toBeVisible();

    // State and env controls present
    await expect(app.stateInput).toBeVisible();
    await expect(app.updateStateBtn).toBeVisible();
    await expect(app.resetStateBtn).toBeVisible();
    await expect(app.currentStateDisplay).toBeVisible();
    await expect(app.envInput).toBeVisible();
    await expect(app.setEnvBtn).toBeVisible();
    await expect(app.envDisplay).toBeVisible();

    // Initial DOM value for currentState per HTML is "N/A"
    const currentStateInitial = await app.getCurrentStateText();
    expect(currentStateInitial).toBe('N/A');

    // Response area should be empty initially
    const initialResponse = await app.getResponseText();
    expect(initialResponse).toBe('');

    // Env area should be empty initially
    const initialEnv = await app.getEnvDisplayText();
    expect(initialEnv).toBe('');
  });

  test('Send Request transitions to "Request Sent" and updates responseDisplay', async ({ page }) => {
    // This test validates the SendRequest event and that responseDisplay contains the JSON response
    const app = new HttpInteractivePage(page);
    await app.goto();

    // Prepare inputs and send request
    const req = {
      method: 'POST',
      url: 'https://example.test/api',
      header: 'Authorization:Bearer token',
      body: '{"name":"playwright"}'
    };

    await app.sendRequest(req);

    // Read the response text and parse as JSON
    const responseText = await app.getResponseText();
    expect(responseText).not.toBe('', 'responseDisplay should be populated after sending request');

    // The page sets response via JSON.stringify(response, null, 2)
    // Parse and validate fields
    let response;
    try {
      response = JSON.parse(responseText);
    } catch (e) {
      // If parsing fails, fail with the response text for debugging
      throw new Error('Response was not valid JSON: ' + responseText);
    }

    expect(response).toEqual({
      method: req.method,
      url: req.url,
      header: req.header,
      body: req.body,
      status: 200,
      message: 'Success'
    });

    // Also verify the JSON stringification formatting includes newlines/indentation
    expect(responseText).toContain('"method": "POST"');
    expect(responseText).toContain('\n  "url":');
  });

  test('Update State transitions to "State Updated" and reflects new value', async ({ page }) => {
    // Validates the UpdateState event: clicking updateState copies stateInput into currentState
    const app = new HttpInteractivePage(page);
    await app.goto();

    // Update to a normal string
    await app.updateState('My New State');
    let currentState = await app.getCurrentStateText();
    expect(currentState).toBe('My New State');

    // Update to an empty string (edge case)
    await app.updateState('');
    currentState = await app.getCurrentStateText();
    expect(currentState).toBe('', 'Updating with empty input should set currentState to an empty string');

    // Update to a long string (edge case)
    const longValue = 'x'.repeat(2048);
    await app.updateState(longValue);
    currentState = await app.getCurrentStateText();
    expect(currentState).toBe(longValue);
  });

  test('Reset State transitions to "State Reset" and restores Initial State', async ({ page }) => {
    // Validates ResetState event: resets currentState to 'Initial State'
    const app = new HttpInteractivePage(page);
    await app.goto();

    // Set a different state first
    await app.updateState('Temporary');
    let currentState = await app.getCurrentStateText();
    expect(currentState).toBe('Temporary');

    // Now reset
    await app.resetState();
    currentState = await app.getCurrentStateText();
    expect(currentState).toBe('Initial State', 'Reset should restore the currentState to "Initial State"');
  });

  test('Set Env transitions to "Environment Variable Set" and updates envDisplay', async ({ page }) => {
    // Validates SetEnv event: clicking setEnv writes "Environment Variable Set: " + envVar
    const app = new HttpInteractivePage(page);
    await app.goto();

    // Typical value
    await app.setEnv('production');
    let envText = await app.getEnvDisplayText();
    expect(envText).toBe('Environment Variable Set: production');

    // Special characters / edge case
    const special = 'line1\nline2\t\u2603';
    await app.setEnv(special);
    envText = await app.getEnvDisplayText();
    expect(envText).toBe('Environment Variable Set: ' + special);

    // Long environment variable
    const longEnv = 'env_' + 'a'.repeat(1000);
    await app.setEnv(longEnv);
    envText = await app.getEnvDisplayText();
    expect(envText).toBe('Environment Variable Set: ' + longEnv);
  });

  test('Send Request with empty fields produces response with empty strings and status 200 (edge case)', async ({ page }) => {
    // Edge case: all inputs empty -> response object should still include fields (empty strings) and success status
    const app = new HttpInteractivePage(page);
    await app.goto();

    // Use defaults (method stays default GET) but clear others
    await app.method.selectOption('GET');
    await app.url.fill('');
    await app.header.fill('');
    await app.body.fill('');
    await app.sendRequestBtn.click();

    const responseText = await app.getResponseText();
    expect(responseText).not.toBe('');

    const response = JSON.parse(responseText);
    expect(response.method).toBe('GET');
    expect(response.url).toBe('');
    expect(response.header).toBe('');
    expect(response.body).toBe('');
    expect(response.status).toBe(200);
    expect(response.message).toBe('Success');
  });

  test('Console and runtime error monitoring - no unexpected ReferenceError/SyntaxError/TypeError', async ({ page }) => {
    // This test intentionally loads the page and asserts that no uncaught runtime errors (ReferenceError, SyntaxError, TypeError) occur.
    // The page event handlers from beforeEach will collect errors; here we perform some interactions to exercise code paths.
    const app = new HttpInteractivePage(page);
    await app.goto();

    // Exercise events
    await app.sendRequest({ method: 'PUT', url: 'http://localhost/test', header: 'X-Test:1', body: 'payload' });
    await app.updateState('state-for-error-check');
    await app.resetState();
    await app.setEnv('env-for-error-check');

    // The afterEach hook will assert no pageErrors and no console.error messages.
    // Additionally, explicitly assert that none of the captured errors (if any) are common JS critical errors:
    // We check the collected pageErrors array via the page.on listener defined in beforeEach.
    // (Note: the actual assertion of emptiness is in afterEach.)
    // Here we can assert that console messages do not include "Uncaught ReferenceError" or similar patterns.
    const errorConsoleMsgs = consoleMessages.filter(m => /ReferenceError|SyntaxError|TypeError|Uncaught/i.test(m.text));
    expect(errorConsoleMsgs, 'No console messages indicating reference/syntax/type errors').toEqual([]);
  });

  test('DOM evidence assertions - elements match FSM evidence strings', async ({ page }) => {
    // Verify DOM contains elements as described in the FSM evidence snippets (presence and minimal text)
    const app = new HttpInteractivePage(page);
    await app.goto();

    // Evidence checks (we don't modify or patch the page; just assert existence)
    await expect(page.locator('button#sendRequest')).toHaveText('Send Request');
    await expect(page.locator('button#updateState')).toHaveText('Update State');
    await expect(page.locator('button#resetState')).toHaveText('Reset State');
    await expect(page.locator('button#setEnv')).toHaveText('Set Env');

    // Check the presence of input/textarea selectors used by FSM
    await expect(page.locator('#url')).toBeVisible();
    await expect(page.locator('#header')).toBeVisible();
    await expect(page.locator('#body')).toBeVisible();
    await expect(page.locator('#stateInput')).toBeVisible();
    await expect(page.locator('#envInput')).toBeVisible();
  });
});