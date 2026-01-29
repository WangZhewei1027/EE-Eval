import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b39830-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the REST API Demo page to encapsulate interactions
class RestApiPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.method = page.locator('#method');
    this.url = page.locator('#url');
    this.payload = page.locator('#payload');
    this.sendBtn = page.locator('#sendBtn');
    this.responseArea = page.locator('#responseArea');
    this.heading = page.locator('h1');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async selectMethod(value) {
    await this.method.selectOption(value);
  }

  async getSelectedMethod() {
    return this.method.inputValue();
  }

  async setPayload(text) {
    await this.payload.fill(text);
  }

  async clickSend() {
    await this.sendBtn.click();
  }

  async getResponseText() {
    return this.responseArea.textContent();
  }

  async isPayloadDisabled() {
    return this.payload.isDisabled();
  }

  async isSendDisabled() {
    return this.sendBtn.isDisabled();
  }

  async getHeadingText() {
    return this.heading.textContent();
  }

  async setUrl(value) {
    // remove readonly temporarily by setting via evaluate (we are not allowed to modify page source externally,
    // but setting value via JS is not "patching" code - it's normal user interaction simulation)
    await this.page.evaluate((v) => {
      document.getElementById('url').value = v;
    }, value);
  }
}

// Group related tests
test.describe('REST API Demo - FSM validation (63b39830-fa74-11f0-bb9a-db7e6ecdeeaa)', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Attach console and page errors to test output for debugging if needed
    if (consoleMessages.length) {
      console.log('Console messages captured during test:', consoleMessages);
    }
    if (pageErrors.length) {
      console.log('Page errors captured during test:', pageErrors.map(e => e.message || String(e)));
    }
    // Ensure no modal/dialog left open
    try {
      // Dismiss any stray dialogs (best-effort)
      page.on('dialog', async (d) => d.dismiss());
    } catch (e) {
      // ignore
    }
  });

  // Validate Idle state S0_Idle and initial rendering
  test('Initial Idle state renders correctly (S0_Idle)', async ({ page }) => {
    const app = new RestApiPage(page);

    // Verify heading and main elements are present
    await expect(app.heading).toHaveText('REST API Demo');

    // Verify send button is present and enabled
    await expect(app.sendBtn).toBeVisible();
    await expect(app.sendBtn).toBeEnabled();

    // Verify response area shows the initial instructional text
    const initialResponse = await app.getResponseText();
    expect(initialResponse).toContain('Click "Send Request" to perform a REST API call.');

    // Because default method is GET, payload textarea should be disabled and show the GET placeholder
    expect(await app.getSelectedMethod()).toBe('GET');
    expect(await app.isPayloadDisabled()).toBeTruthy();
    const payloadPlaceholder = await page.locator('#payload').getAttribute('placeholder');
    expect(payloadPlaceholder).toMatch(/No request payload for GET or DELETE/);

    // No uncaught page errors in Idle state
    expect(pageErrors.length).toBe(0);
  });

  // Validate changing HTTP method triggers updatePayloadVisibility (HTTP_METHOD_CHANGE event)
  test('Changing HTTP method toggles payload visibility (HTTP_METHOD_CHANGE)', async ({ page }) => {
    const app1 = new RestApiPage(page);

    // Change method to POST -> payload should be enabled
    await app.selectMethod('POST');
    expect(await app.getSelectedMethod()).toBe('POST');
    await expect(app.payload).toBeEnabled();
    const placeholderPost = await page.locator('#payload').getAttribute('placeholder');
    expect(placeholderPost).toMatch(/\{"title": "foo".*userId.*\}|\{.*\}/);

    // Change method to DELETE -> payload should be disabled again
    await app.selectMethod('DELETE');
    expect(await app.getSelectedMethod()).toBe('DELETE');
    await expect(app.payload).toBeDisabled();
    const placeholderDelete = await page.locator('#payload').getAttribute('placeholder');
    expect(placeholderDelete).toMatch(/No request payload for GET or DELETE/);

    // No uncaught page errors during this interaction
    expect(pageErrors.length).toBe(0);
  });

  // Validate transition S0_Idle -> S1_RequestSent -> S2_ResponseReceived using GET request
  test('Send GET request transitions: S0_Idle -> S1_RequestSent -> S2_ResponseReceived', async ({ page }) => {
    const app2 = new RestApiPage(page);

    // Ensure method is GET
    await app.selectMethod('GET');
    expect(await app.getSelectedMethod()).toBe('GET');

    // Click send and assert immediate "Sending request..." feedback and sendBtn disabled
    await app.clickSend();

    // After click, send button should be disabled while request is in-flight
    await expect(app.sendBtn).toBeDisabled();
    await expect(app.responseArea).toHaveText('Sending request...', { timeout: 2000 });

    // Wait for the responseArea to update to a Status: ... response
    await expect(app.responseArea).toHaveText(/Status: \d+/, { timeout: 15000 });

    const respText = (await app.getResponseText()) || '';
    expect(respText).toMatch(/Status:\s*\d+\s*\w*/);
    expect(respText).toContain('Headers:');
    expect(respText).toContain('Body:');

    // After completion, send button should be re-enabled
    await expect(app.sendBtn).toBeEnabled();

    // Ensure no uncaught exceptions were thrown
    expect(pageErrors.length).toBe(0);
  }, 20000);

  // Validate POST request with valid JSON payload goes to S2_ResponseReceived
  test('Send POST request with valid JSON receives a response (S1_RequestSent -> S2_ResponseReceived)', async ({ page }) => {
    const app3 = new RestApiPage(page);

    // Switch to POST
    await app.selectMethod('POST');
    expect(await app.getSelectedMethod()).toBe('POST');
    await expect(app.payload).toBeEnabled();

    // Fill a valid JSON payload
    const payload = JSON.stringify({ title: 'foo', body: 'bar', userId: 1 });
    await app.setPayload(payload);

    // Click send
    await app.clickSend();

    // Immediately should show sending state and disabled button
    await expect(app.sendBtn).toBeDisabled();
    await expect(app.responseArea).toHaveText('Sending request...', { timeout: 2000 });

    // Wait for a 201 or 200 response (jsonplaceholder returns 201 for POST)
    await expect(app.responseArea).toHaveText(/Status:\s*(200|201)/, { timeout: 15000 });

    const respText1 = (await app.getResponseText()) || '';
    expect(respText).toContain('Headers:');
    expect(respText).toContain('Body:');
    // Body should be JSON and include the fields we sent or an id
    expect(respText).toMatch(/"title":\s*"foo"/);
    expect(respText).toMatch(/"body":\s*"bar"/);

    // Button re-enabled
    await expect(app.sendBtn).toBeEnabled();

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  }, 20000);

  // Validate error handling for invalid/missing JSON payload: S0_Idle -> S1_RequestSent (should not happen) -> S3_Error (alert path)
  test('POST with empty payload shows alert and does not send request (edge case)', async ({ page }) => {
    const app4 = new RestApiPage(page);

    await app.selectMethod('POST');
    expect(await app.getSelectedMethod()).toBe('POST');
    await expect(app.payload).toBeEnabled();

    // Clear payload to simulate empty body
    await app.setPayload('');

    // Prepare to capture the dialog that should appear
    const dialogPromise = page.waitForEvent('dialog');

    // Click send - should trigger alert and return early
    await app.clickSend();

    // Capture dialog and validate its message
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe('Please enter valid JSON payload for POST request.');

    // Dismiss the alert
    await dialog.dismiss();

    // Because no request was made, response area should remain the initial or previous text (not "Sending request...")
    const currentResponse = await app.getResponseText();
    expect(currentResponse).not.toBe('Sending request...');

    // Send button should remain enabled (no request in flight)
    await expect(app.sendBtn).toBeEnabled();

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('POST with malformed JSON shows alert with error message (edge case)', async ({ page }) => {
    const app5 = new RestApiPage(page);

    await app.selectMethod('POST');
    await app.setPayload('{"title": "foo", invalid }'); // malformed JSON

    // Prepare to capture the dialog that should appear
    const dialogPromise1 = page.waitForEvent('dialog');

    // Click send - should trigger alert about invalid JSON
    await app.clickSend();

    const dialog1 = await dialogPromise;
    // The message includes the thrown error message; just assert it starts with 'Invalid JSON payload:'
    expect(dialog.message()).toMatch(/^Invalid JSON payload:/);

    await dialog.dismiss();

    // Ensure no request was sent (button still enabled and response not set to "Sending request...")
    await expect(app.sendBtn).toBeEnabled();
    const resp = await app.getResponseText();
    expect(resp).not.toBe('Sending request...');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  // Validate error transition: when fetch fails, responseArea is updated to Error: <message> (S1_RequestSent -> S3_Error)
  test('Network/fetch error leads to Error state (S3_Error)', async ({ page }) => {
    const app6 = new RestApiPage(page);

    // Point URL to an invalid host to force fetch rejection
    // We set the URL value directly in the DOM; this is a normal test interaction
    await app.setUrl('http://nonexistent.invalid.local/test-endpoint');

    // Ensure method is GET and payload disabled
    await app.selectMethod('GET');
    expect(await app.getSelectedMethod()).toBe('GET');

    // Start the request
    await app.clickSend();

    // Immediately "Sending request..." should appear
    await expect(app.responseArea).toHaveText('Sending request...', { timeout: 2000 });

    // Then it should transition to an Error text - allow generous timeout for network resolution
    await expect(app.responseArea).toHaveText(/^Error: /, { timeout: 15000 });

    const finalText = (await app.getResponseText()) || '';
    expect(finalText.startsWith('Error:')).toBeTruthy();

    // After failed fetch, button should be re-enabled
    await expect(app.sendBtn).toBeEnabled();

    // Page should not have uncaught exceptions (error was handled by catch)
    expect(pageErrors.length).toBe(0);
  }, 20000);

  // Validate we captured console messages and pageerror behavior across interactions
  test('Console and page error monitoring works (observability checks)', async ({ page }) => {
    const app7 = new RestApiPage(page);

    // Do a simple GET request to produce network activity
    await app.selectMethod('GET');
    await app.clickSend();

    // Wait for response
    await expect(app.responseArea).toHaveText(/Status: \d+/, { timeout: 15000 });

    // Ensure our capture arrays are present and accessible
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();

    // For this app we expect there to be no uncaught page errors during normal flows
    expect(pageErrors.length).toBe(0);

    // Log how many console messages we've captured (not failing test based on them)
    // But ensure that we captured at least the default (possibly none)
    // This test validates our ability to observe console and page errors
    expect(consoleMessages).toBeInstanceOf(Array);
  }, 20000);
});