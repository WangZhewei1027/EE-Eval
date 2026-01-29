import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b34a11-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Page Object for the HTTP demo page
class HttpDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.sendButton = page.locator('#send-request');
    this.requestPre = page.locator('#http-request');
    this.responsePre = page.locator('#http-response');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // ensure the main elements are present
    await expect(this.sendButton).toBeVisible();
    await expect(this.requestPre).toBeVisible();
    await expect(this.responsePre).toBeVisible();
  }

  async clickSend() {
    await this.sendButton.click();
  }

  async getRequestText() {
    return (await this.requestPre.textContent()) || '';
  }

  async getResponseText() {
    return (await this.responsePre.textContent()) || '';
  }

  async waitForResponseContains(substring, opts = {}) {
    // Wait until the responsePre contains the substring (case-insensitive option)
    const { timeout = 5000, caseInsensitive = false } = opts;
    const matcher = caseInsensitive ? substring.toLowerCase() : substring;
    await this.page.waitForFunction(
      (sel, matcher, ci) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const txt = el.textContent || '';
        return ci ? txt.toLowerCase().includes(matcher) : txt.includes(matcher);
      },
      this.responsePre.selector,
      matcher,
      caseInsensitive,
      { timeout }
    );
  }
}

test.describe('HTTP Concept Demo - FSM Tests', () => {
  // Collect console and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // After each test ensure there are no unexpected uncaught page errors
    // Tests that expect errors will assert specifically; here we assert none for general cases.
    // This is a safety check — it will fail the test if any uncaught exception bubbled up.
    expect(pageErrors.length).toBeLessThanOrEqual(0);
  });

  test('S0_Idle: Initial Idle state renders controls and placeholders', async ({ page }) => {
    // This test validates the Idle state: the button is present and both <pre> elements show initial placeholder text.
    const demo = new HttpDemoPage(page);
    await demo.goto();

    // Verify button label
    await expect(demo.sendButton).toHaveText('Send HTTP GET Request');

    // Verify initial request and response placeholder texts (exact match)
    await expect(demo.requestPre).toHaveText('// Request data will appear here');
    await expect(demo.responsePre).toHaveText('// Response data will appear here');

    // No console errors or page errors should have occurred during initial render
    expect(consoleMessages.filter(m => m.type === 'error').length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('S0_Idle -> S1_RequestSent: Clicking the button updates request and shows waiting response', async ({ page }) => {
    // This test validates the transition from Idle to RequestSent: immediate UI updates after clicking the button.
    const demo1 = new HttpDemoPage(page);
    await demo.goto();

    // Click the send button
    await demo.clickSend();

    // Immediately after click the request <pre> should show the HTTP GET format (starts with 'GET ')
    await expect(demo.requestPre).toContainText('GET https://jsonplaceholder.typicode.com/posts/1 HTTP/1.1');

    // The response <pre> should show the waiting message before the fetch resolves
    await expect(demo.responsePre).toHaveText('// Waiting for response...');

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });

  test('S1_RequestSent -> S2_ResponseReceived: Successful response shows status, headers and JSON body', async ({ page }) => {
    // This test validates the successful fetch flow: status line, headers and pretty-printed JSON body are rendered.
    // We intercept the network request to return a deterministic response.
    const demo2 = new HttpDemoPage(page);

    // Intercept the network request and fulfill with a mock JSON response
    await page.route('https://jsonplaceholder.typicode.com/posts/1', async (route) => {
      const body = JSON.stringify({
        userId: 1,
        id: 1,
        title: 'Mock Title',
        body: 'This is mock body text'
      });
      await route.fulfill({
        status: 200,
        statusText: 'OK',
        headers: {
          'Content-Type': 'application/json',
          'X-Mock-Header': 'mock-value'
        },
        body
      });
    });

    await demo.goto();

    // Click to send the request (this triggers RequestSent state)
    await demo.clickSend();

    // Wait for the responsePre to include the HTTP status line. App code uses response.httpVersion || '1.1',
    // so we expect 'HTTP/1.1 200 OK' to appear.
    await demo.waitForResponseContains('HTTP/1.1 200 OK');

    // Verify headers were rendered. The app iterates response.headers and concatenates "key: value\n".
    // Header keys are typically lower-cased in iteration, so check case-insensitively.
    const responseText = (await demo.getResponseText()).toLowerCase();
    expect(responseText).toContain('content-type: application/json');
    expect(responseText).toContain('x-mock-header: mock-value');

    // Verify that the JSON body (pretty-printed) was appended to the response area
    expect(responseText).toContain('"title": "Mock Title"');
    expect(responseText).toContain('"body": "This is mock body text"');

    // Ensure no uncaught page errors occurred
    expect(pageErrors.length).toBe(0);
  });

  test('S1_RequestSent -> S3_Error: Network failure leads to Error state and displays an error message', async ({ page }) => {
    // This test validates the error transition by forcing the network request to fail.
    const demo3 = new HttpDemoPage(page);

    // Intercept the route and abort it to simulate a network failure.
    await page.route('https://jsonplaceholder.typicode.com/posts/1', async (route) => {
      await route.abort(); // this should cause fetch to reject and trigger the .catch path
    });

    await demo.goto();

    // Click to send the request
    await demo.clickSend();

    // Wait for the responsePre to indicate an Error occurred. The code sets responsePre.textContent = 'Error: ' + error.message
    // We only assert that the text starts with 'Error: ' as message text can vary by environment/browser.
    await demo.page.waitForFunction((sel) => {
      const el1 = document.querySelector(sel);
      return el && (el.textContent || '').startsWith('Error: ');
    }, demo.responsePre.selector);

    const responseText1 = await demo.getResponseText();
    expect(responseText.startsWith('Error: ')).toBeTruthy();

    // No uncaught page errors expected; network error was handled by the app's .catch handler.
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Multiple rapid clicks start multiple requests and UI updates consistently', async ({ page }) => {
    // This test verifies behavior when the user clicks the button multiple times rapidly.
    // We supply responses for two requests so both can complete.
    const demo4 = new HttpDemoPage(page);

    let callCount = 0;
    await page.route('https://jsonplaceholder.typicode.com/posts/1', async (route) => {
      callCount += 1;
      const body1 = JSON.stringify({
        call: callCount,
        message: `response #${callCount}`
      });
      // Small delay for the first response to emulate concurrency
      if (callCount === 1) {
        // simulate slight delay
        setTimeout(async () => {
          await route.fulfill({
            status: 200,
            statusText: 'OK',
            headers: { 'Content-Type': 'application/json' },
            body
          });
        }, 100);
      } else {
        await route.fulfill({
          status: 200,
          statusText: 'OK',
          headers: { 'Content-Type': 'application/json' },
          body
        });
      }
    });

    await demo.goto();

    // Rapidly click twice
    await demo.clickSend();
    await demo.clickSend();

    // Ultimately the responsePre should contain the JSON from the most recent fulfilled response(s).
    await demo.waitForResponseContains('"message": "response #', { timeout: 5000 });

    const responseText2 = (await demo.getResponseText()).toLowerCase();
    expect(responseText).toContain('"message": "response #1"'.toLowerCase() || '"message": "response #2"'.toLowerCase());

    // No uncaught page errors
    expect(pageErrors.length).toBe(0);
  });
});