import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d3930-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the demo app
class HttpDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Selectors
    this.h1 = 'h1';
    this.statusResponse = '#statusResponse';
    this.apiResponse = '#apiResponse';
    this.headersResponse = '#headersResponse';
    this.statusButton = code => `button[onclick="fetchStatusCode(${code})"]`;
    this.fetchRandomBtn = 'button[onclick="makeActualRequest()"]';
    this.showHeadersBtn = 'button[onclick="showRequestHeaders()"]';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getTitleText() {
    return this.page.locator(this.h1).innerText();
  }

  async clickStatus(code) {
    await this.page.click(this.statusButton(code));
  }

  async getStatusResponseText() {
    return this.page.locator(this.statusResponse).innerText();
  }

  async getStatusResponseBgColor() {
    // Read computed style backgroundColor
    return await this.page.$eval(this.statusResponse, el => {
      return window.getComputedStyle(el).backgroundColor;
    });
  }

  async clickFetchRandomPost() {
    await this.page.click(this.fetchRandomBtn);
  }

  async waitForApiResponse(timeout = 5000) {
    // Wait until apiResponse text changes from the initial 'Fetching data...' or becomes non-empty
    const locator = this.page.locator(this.apiResponse);
    await expect(locator).toHaveJSProperty('innerText', await locator.evaluate(el => el.innerText), { timeout: 10 }).catch(() => {});
    // Use a robust wait: wait for either 'Response:' or 'Error:' substring
    await this.page.waitForFunction(() => {
      const el = document.getElementById('apiResponse');
      if (!el) return false;
      const txt = el.innerText || '';
      return txt.includes('Response:') || txt.startsWith('Error:') || txt.includes('Error:');
    }, null, { timeout });
    return this.page.locator(this.apiResponse).innerText();
  }

  async clickShowRequestHeaders() {
    await this.page.click(this.showHeadersBtn);
  }

  async getHeadersResponseText() {
    return this.page.locator(this.headersResponse).innerText();
  }
}

// Global arrays will be reinitialized per test in beforeEach
let consoleMessages = [];
let pageErrors = [];

test.describe('HTTP Concepts Demo - end-to-end tests for FSM states and transitions', () => {
  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages and page errors for assertions
    page.on('console', msg => {
      // store console messages with text and type
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', error => {
      // store Error objects (message, name)
      pageErrors.push(error);
    });
  });

  test('Initial render (S0_Idle): page loads and renders the main heading', async ({ page }) => {
    // Validate initial state entry action: renderPage() equivalent => the page should render heading
    const app = new HttpDemoPage(page);
    await app.goto();

    // The FSM S0_Idle evidence includes the H1 heading
    const title = await app.getTitleText();
    // Comment: verifying that the initial DOM contains expected heading text
    expect(title).toContain('HTTP Concepts Demonstration');

    // There should be no uncaught errors on initial load
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Status Code Simulation (S1_StatusCodeSimulated)', () => {
    const codes = [
      { code: 200, expectedText: 'Simulating response with status code: 200', expectedDetail: 'The request was successful!', expectedColorRgb: 'rgb(230, 255, 237)' },
      { code: 201, expectedText: 'Simulating response with status code: 201', expectedDetail: 'Resource was created successfully!', expectedColorRgb: 'rgb(230, 255, 237)' },
      { code: 400, expectedText: 'Simulating response with status code: 400', expectedDetail: "Server couldn't understand the request.", expectedColorRgb: 'rgb(255, 245, 245)' },
      { code: 401, expectedText: 'Simulating response with status code: 401', expectedDetail: 'Authentication is required!', expectedColorRgb: 'rgb(255, 245, 245)' },
      { code: 404, expectedText: 'Simulating response with status code: 404', expectedDetail: 'The requested resource was not found.', expectedColorRgb: 'rgb(255, 245, 245)' },
      { code: 500, expectedText: 'Simulating response with status code: 500', expectedDetail: 'Server encountered an unexpected error.', expectedColorRgb: 'rgb(255, 230, 230)' }
    ];

    for (const { code, expectedText, expectedDetail, expectedColorRgb } of codes) {
      test(`Clicking status code ${code} updates DOM with simulation and color`, async ({ page }) => {
        // Comment: This test validates the transition from Idle S0 to StatusCodeSimulated S1 for a given code
        const app1 = new HttpDemoPage(page);
        await app.goto();

        // Click the status code button
        await app.clickStatus(code);

        // Assert the response container contains the simulated status text and the detail message
        const text = await app.getStatusResponseText();
        expect(text).toContain(expectedText);
        expect(text).toContain(expectedDetail);

        // Assert inline background color corresponds to code ranges as implemented
        const bgColor = await app.getStatusResponseBgColor();
        // The computed style returns rgb(...). Compare to expected rgb string.
        expect(bgColor.replace(/\s+/g, ' ')).toBe(expectedColorRgb);

        // No uncaught page errors expected for status simulations
        expect(pageErrors.length).toBe(0);
      });
    }

    test('Rapidly clicking multiple status buttons results in last-clicked state visible', async ({ page }) => {
      // Comment: Edge-case: ensure last click wins when user clicks multiple status buttons quickly
      const app2 = new HttpDemoPage(page);
      await app.goto();

      // Click 200 then 404 rapidly
      await Promise.all([
        app.clickStatus(200),
        app.clickStatus(404)
      ]);

      // Wait briefly to allow DOM updates
      await page.waitForTimeout(100);

      const text1 = await app.getStatusResponseText();
      // Expect final visible text to reflect the last action (404)
      expect(text).toContain('Simulating response with status code: 404');
      expect(text).toContain('The requested resource was not found.');

      // No page errors expected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Actual HTTP Request (S2_ActualRequestFetching) and error observation', () => {
    test('Clicking "Fetch Random Post" shows fetching indicator and then handles response or error', async ({ page }) => {
      // Comment: Validate the transition from Idle S0 -> ActualRequestFetching S2.
      // This app has a bug: it references `response` inside the second .then, causing a ReferenceError.
      // The test asserts that:
      // - initial "Fetching data..." text appears,
      // - the code eventually reports an Error in the UI,
      // - a pageerror (ReferenceError) is emitted and contains message about `response` being undefined.

      const app3 = new HttpDemoPage(page);
      await app.goto();

      // Click to start actual request
      await app.clickFetchRandomPost();

      // Immediately the UI should show the fetching indicator
      await expect(page.locator('#apiResponse')).toHaveText(/Fetching data\.\.\./, { timeout: 1000 }).catch(() => { /* ignore if it updates quickly */ });

      // Wait for the request flow to complete (either success or the known ReferenceError path)
      const finalText = await app.waitForApiResponse(8000);

      // Because of the bug, the promise chain tries to access `response.headers` in a scope where response is not defined,
      // which should produce a ReferenceError and then be caught by the catch handler, producing an Error: ... message in the UI.
      // Assert the UI displays an Error message.
      expect(finalText).toMatch(/Error:/);

      // Assert at least one pageerror was emitted and that it is a ReferenceError mentioning 'response'
      const refErrors = pageErrors.filter(err => {
        const m = String(err.message || '');
        return m.toLowerCase().includes('response') || (err.name && err.name.toLowerCase().includes('referenceerror'));
      });
      // There should be at least one ReferenceError-like page error because of the bug
      expect(refErrors.length).toBeGreaterThanOrEqual(1);

      // Check that one of the page errors mentions 'response' is not defined (message varies by engine, so we check substring)
      const foundResponseMsg = refErrors.some(err => {
        const msg = String(err.message || '').toLowerCase();
        return msg.includes('response is not defined') || msg.includes('response') && msg.includes('is not');
      });
      expect(foundResponseMsg).toBeTruthy();

      // Also validate that console messages do not contain the 'Response headers:' log (since the bug prevents that log)
      const hasResponseHeadersLog = consoleMessages.some(m => m.text.includes('Response headers:'));
      expect(hasResponseHeadersLog).toBe(false);
    });
  });

  test.describe('Request Headers Demo (S3_RequestHeadersShown)', () => {
    test('Clicking "Show Request Headers" displays the expected header preview text', async ({ page }) => {
      // Comment: Validate transition from Idle S0 -> RequestHeadersShown S3.
      // The UI is expected to display "Request headers that would be sent:" and include the custom demo header.
      const app4 = new HttpDemoPage(page);
      await app.goto();

      await app.clickShowRequestHeaders();

      const headersText = await app.getHeadersResponseText();

      // The FSM evidence expects the text to include "Request headers that would be sent:"
      expect(headersText).toContain('Request headers that would be sent:');
      // And it should list the custom header added in the demo
      expect(headersText).toContain('X-Custom-Demo-Header: HelloFromHTTPDemo');

      // Ensure no unexpected page errors occurred during this demo action
      expect(pageErrors.length).toBe(0);
    });

    test('Headers demo does not actually send a request (UI-only) and remains stable when clicked multiple times', async ({ page }) => {
      // Comment: Edge-case: clicking the headers demo repeatedly should consistently update the headersResponse content
      const app5 = new HttpDemoPage(page);
      await app.goto();

      // Click multiple times in succession
      await Promise.all([app.clickShowRequestHeaders(), app.clickShowRequestHeaders(), app.clickShowRequestHeaders()]);

      // After clicks, the headers response should contain the header text
      const text2 = await app.getHeadersResponseText();
      expect(text).toContain('Request headers that would be sent:');
      expect(text).toContain('X-Custom-Demo-Header: HelloFromHTTPDemo');

      // No errors expected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Comprehensive FSM coverage and cleanup checks', () => {
    test('All interactive components exist and are actionable', async ({ page }) => {
      // Comment: This test ensures all buttons (events) defined in the FSM are present on page load
      const app6 = new HttpDemoPage(page);
      await app.goto();

      // Verify presence of all status code buttons and the two other buttons
      const selectors = [
        app.statusButton(200),
        app.statusButton(201),
        app.statusButton(400),
        app.statusButton(401),
        app.statusButton(404),
        app.statusButton(500),
        app.fetchRandomBtn,
        app.showHeadersBtn
      ];

      for (const sel of selectors) {
        const el1 = page.locator(sel);
        await expect(el).toBeVisible();
      }

      // No page errors at idle after checks
      expect(pageErrors.length).toBe(0);
    });
  });
});