import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12164991-fa7a-11f0-acf9-69409043402d.html';

/**
 * Page Object Model for the HTTP Interactive Explorer
 * Encapsulates common interactions and selectors used across tests.
 */
class HttpExplorerPage {
  constructor(page) {
    this.page = page;
    // inputs and controls
    this.urlInput = page.locator('#urlInput');
    this.methodSelect = page.locator('#methodSelect');
    this.httpVersionSelect = page.locator('#httpVersionSelect');
    this.headerCountInput = page.locator('#headerCountInput');
    this.headersArea = page.locator('#headersArea');
    this.bodyInput = page.locator('#bodyInput');

    // buttons
    this.buildRequestBtn = page.locator('#buildRequestBtn');
    this.sendRequestBtn = page.locator('#sendRequestBtn');
    this.clearLogsBtn = page.locator('#clearLogsBtn');
    this.viewParsedHeadersBtn = page.locator('#viewParsedHeadersBtn');
    this.viewCookiesBtn = page.locator('#viewCookiesBtn');
    this.viewStatusCodeBtn = page.locator('#viewStatusCodeBtn');

    this.simulateRedirectBtn = page.locator('#simulateRedirectBtn');
    this.simulateErrorBtn = page.locator('#simulateErrorBtn');
    this.simulateChunkedBtn = page.locator('#simulateChunkedBtn');
    this.simulateAuthBtn = page.locator('#simulateAuthBtn');
    this.simulateCacheBtn = page.locator('#simulateCacheBtn');
    this.simulateCompressionBtn = page.locator('#simulateCompressionBtn');

    // outputs / areas
    this.rawRequestView = page.locator('#rawRequestView');
    this.rawResponseView = page.locator('#rawResponseView');
    this.responseControls = page.locator('#responseControls');
    this.parsedHeadersArea = page.locator('#parsedHeadersArea');
    this.parsedHeadersPre = page.locator('#parsedHeadersPre');
    this.cookiesArea = page.locator('#cookiesArea');
    this.cookiesPre = page.locator('#cookiesPre');
    this.statusCodeInfoArea = page.locator('#statusCodeInfoArea');
    this.statusCodeInfoPre = page.locator('#statusCodeInfoPre');
    this.simulationOutput = page.locator('#simulationOutput');
  }

  // convenience to count header input pairs (two input elements per header row + separator text nodes exist, we count name inputs)
  async headerNameInputCount() {
    // header rows are div elements appended under headersArea. Each contains two inputs (name & value).
    return this.headersArea.locator('input[type="text"]').count().then(count => {
      // every header row uses 2 input[type=text], so number of headers = count / 2
      return Math.floor(count / 2);
    });
  }

  async setHeaderCount(n) {
    await this.headerCountInput.fill(String(n));
    // trigger change event by dispatching 'change' (focusing then pressing Tab or directly evaluate change)
    await this.headerCountInput.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
  }

  async buildRequest() {
    await this.buildRequestBtn.click();
  }

  async sendRequest() {
    await this.sendRequestBtn.click();
  }

  async clearLogs() {
    await this.clearLogsBtn.click();
  }

  async viewParsedHeaders() {
    await this.viewParsedHeadersBtn.click();
  }

  async viewCookies() {
    await this.viewCookiesBtn.click();
  }

  async viewStatusCodeInfo() {
    await this.viewStatusCodeBtn.click();
  }

  async waitForSimulationOutputContains(text, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, t) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.indexOf(t) !== -1;
      },
      '#simulationOutput',
      text,
      { timeout }
    );
  }

  async waitForRawResponseContains(text, timeout = 5000) {
    await this.page.waitForFunction(
      (sel, t) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.indexOf(t) !== -1;
      },
      '#rawResponseView',
      text,
      { timeout }
    );
  }
}

test.describe('HTTP Interactive Explorer - FSM coverage and interactions', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // collect console messages and errors
    pageErrors = [];
    consoleErrors = [];
    consoleMessages = [];

    page.on('pageerror', (err) => {
      // capture Uncaught exceptions from the page
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      const type = msg.type(); // e.g., 'log', 'error'
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // small pause to ensure any asynchronous timeouts in the app can surface errors
    await page.waitForTimeout(100);
    // As part of requirements we observe console logs and page errors and assert on them at the end of each test.
    // Here we assert that there were no unexpected page-level uncaught exceptions and no console.error entries.
    expect(pageErrors, 'No uncaught page errors should have occurred').toEqual([]);
    expect(consoleErrors, 'No console.error messages should have been emitted').toEqual([]);
  });

  test('Idle state: initial UI elements and default header inputs (buildHeadersInputs(2) entry action)', async ({ page }) => {
    // Validate the Idle state's entry actions and evidence:
    // - Title and descriptive paragraph are present
    // - headerCountInput default value is 2 and headersArea contains two header inputs
    const model = new HttpExplorerPage(page);

    // Check the main heading and description presence
    await expect(page.locator('h1')).toHaveText('HTTP Interactive Explorer');
    await expect(page.locator('p')).toContainText('This tool lets you build, send, and inspect HTTP requests and responses');

    // headerCountInput should default to '2'
    await expect(model.headerCountInput).toHaveValue('2');

    // headersArea should have 2 header input pairs (name & value each) due to buildHeadersInputs(2)
    const headerPairs = await model.headerNameInputCount();
    expect(headerPairs).toBe(2);

    // rawRequestView should be present but empty initially
    await expect(model.rawRequestView).toHaveText('');

    // rawResponseView shows "(No response yet)"
    await expect(model.rawResponseView).toHaveText('(No response yet)');
  });

  test.describe('Header count change and building requests', () => {
    test('HeaderCountChange event updates headers inputs accordingly', async ({ page }) => {
      const model = new HttpExplorerPage(page);

      // Increase header count to 4 and verify inputs
      await model.setHeaderCount(4);
      await page.waitForTimeout(50); // let DOM update
      expect(await model.headerCountInput.inputValue()).toBe('4');
      expect(await model.headerNameInputCount()).toBe(4);

      // Decrease header count to 1 and verify
      await model.setHeaderCount(1);
      await page.waitForTimeout(50);
      expect(await model.headerCountInput.inputValue()).toBe('1');
      expect(await model.headerNameInputCount()).toBe(1);
    });

    test('BuildRequest event builds a valid raw request and handles invalid/empty URL edge cases', async ({ page }) => {
      const model = new HttpExplorerPage(page);

      // Case 1: empty URL should trigger alert('Please enter a URL')
      // Listen for dialogs and assert message
      let dialogMessage = null;
      page.once('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });
      // Ensure urlInput is empty
      await model.urlInput.fill('');
      await model.buildRequestBtn.click();
      // Wait for the dialog callback to run
      await page.waitForTimeout(50);
      expect(dialogMessage).toBe('Please enter a URL');

      // Case 2: invalid URL triggers alert('Invalid URL')
      dialogMessage = null;
      page.once('dialog', async (dialog) => {
        dialogMessage = dialog.message();
        await dialog.dismiss();
      });
      await model.urlInput.fill('not a url');
      await model.buildRequestBtn.click();
      await page.waitForTimeout(50);
      expect(dialogMessage).toBe('Invalid URL');

      // Case 3: valid URL builds raw request text in rawRequestView
      await model.urlInput.fill('http://example.com/path?query=1');
      // ensure method and version defaults are present
      await expect(model.methodSelect).toHaveValue('GET');
      await expect(model.httpVersionSelect).toHaveValue('HTTP/1.1');

      // Set one header to demonstrate header inclusion
      await model.setHeaderCount(1);
      await page.waitForTimeout(20);
      // Fill the header name and value fields (they are the first two inputs under headersArea)
      const nameInput = model.headersArea.locator('input[type="text"]').nth(0);
      const valueInput = model.headersArea.locator('input[type="text"]').nth(1);
      await nameInput.fill('X-Test-Header');
      await valueInput.fill('test-value');

      await model.buildRequest();
      // rawRequestView should contain request line and Host header and custom header
      await expect(model.rawRequestView).toContainText('GET /path?query=1 HTTP/1.1');
      await expect(model.rawRequestView).toContainText('Host: example.com');
      await expect(model.rawRequestView).toContainText('X-Test-Header: test-value');

      // rawResponseView should be reset to "(No response yet)" as per entry actions on build
      await expect(model.rawResponseView).toHaveText('(No response yet)');
    });
  });

  test.describe('Send request and response inspection', () => {
    test('SendRequest transitions to Response Received and updateResponseControlsVisibility(true)', async ({ page }) => {
      const model = new HttpExplorerPage(page);

      // Build a request to '/'
      await model.urlInput.fill('http://example.com/');
      await model.setHeaderCount(0);
      await page.waitForTimeout(20);
      await model.buildRequest();

      // Spy on simulationOutput updates and click Send
      await model.sendRequest();

      // Wait for rawResponseView to receive HTTP/1.1 200 OK
      await model.waitForRawResponseContains('HTTP/1.1 200 OK', 3000);

      // responseControls should be visible after response received
      await expect(model.responseControls).toBeVisible();

      // simulationOutput should mention sending to http://example.com/
      await model.waitForSimulationOutputContains('Sending request to http://example.com/', 2000);
    });

    test('ViewParsedHeaders, ViewCookies, ViewStatusCodeInfo after receiving response', async ({ page }) => {
      const model = new HttpExplorerPage(page);

      // Build and send a request to '/'
      await model.urlInput.fill('http://example.com/');
      await model.setHeaderCount(0);
      await page.waitForTimeout(20);
      await model.buildRequest();
      await model.sendRequest();

      // Wait until response arrives
      await model.waitForRawResponseContains('HTTP/1.1 200 OK', 3000);

      // Initially, parsed headers area is hidden
      await expect(model.parsedHeadersArea).toBeHidden();
      await expect(model.cookiesArea).toBeHidden();
      await expect(model.statusCodeInfoArea).toBeHidden();

      // View parsed headers
      await model.viewParsedHeaders();
      await expect(model.parsedHeadersArea).toBeVisible();
      // For the root path simulated server sends Content-Type: text/plain
      await expect(model.parsedHeadersPre).toContainText('content-type: text/plain');

      // View cookies (root response has no cookies)
      await model.viewCookies();
      await expect(model.cookiesArea).toBeVisible();
      await expect(model.cookiesPre).toHaveText('(No cookies)');

      // View status code info - should include "200 - OK"
      await model.viewStatusCodeInfo();
      await expect(model.statusCodeInfoArea).toBeVisible();
      await expect(model.statusCodeInfoPre).toContainText('200 - OK');
    });

    test('ClearLogs resets views and internal visible areas (Logs Cleared state)', async ({ page }) => {
      const model = new HttpExplorerPage(page);

      // Build, send, and then clear logs
      await model.urlInput.fill('http://example.com/');
      await model.setHeaderCount(0);
      await page.waitForTimeout(20);
      await model.buildRequest();
      await model.sendRequest();
      await model.waitForRawResponseContains('HTTP/1.1 200 OK', 3000);

      // Show some areas
      await model.viewParsedHeaders();
      await model.viewCookies();
      await model.viewStatusCodeInfo();
      await expect(model.parsedHeadersArea).toBeVisible();
      await expect(model.cookiesArea).toBeVisible();
      await expect(model.statusCodeInfoArea).toBeVisible();

      // Clear logs
      await model.clearLogs();

      // rawRequestView cleared, rawResponseView set to '(No response yet)'
      await expect(model.rawRequestView).toHaveText('');
      await expect(model.rawResponseView).toHaveText('(No response yet)');

      // All response controls / areas hidden
      await expect(model.parsedHeadersArea).toBeHidden();
      await expect(model.cookiesArea).toBeHidden();
      await expect(model.statusCodeInfoArea).toBeHidden();
      await expect(model.responseControls).toBeHidden();

      // Simulation output cleared
      await expect(model.simulationOutput).toHaveText('');
    });
  });

  test.describe('Interactive simulations for HTTP concepts', () => {
    test('Simulate redirect chain results in multiple redirects and final 200 response', async ({ page }) => {
      const model = new HttpExplorerPage(page);

      // Click simulate redirect
      await model.simulateRedirectBtn.click();

      // Wait for some redirect messages to appear in simulationOutput
      await model.waitForSimulationOutputContains('Redirect 1:', 3000);
      // Eventually, the simulation should receive a 200 OK (the redirect chain ends back at '/')
      await model.waitForRawResponseContains('HTTP/1.1 200 OK', 6000);

      // simulationOutput should indicate following Location headers
      const simText = await model.simulationOutput.textContent();
      expect(simText).toContain('following Location header');

      // Ensure response controls are visible and final rawRequestView changed to a GET for the final URL
      await expect(model.responseControls).toBeVisible();
      await expect(model.rawRequestView).toContainText('GET / HTTP/1.1');
    });

    test('Simulate various HTTP error responses', async ({ page }) => {
      const model = new HttpExplorerPage(page);

      // Click simulate error and wait for the sequence to complete (uses setTimeout internally)
      await model.simulateErrorBtn.click();

      // Wait for at least one error response to appear in rawResponseView and simulationOutput to include "Finished error simulation."
      await model.waitForSimulationOutputContains('Finished error simulation.', 5000);

      // The last rawResponseView should contain a status line (e.g., HTTP/1.1 500 or similar)
      const rawResp = await model.rawResponseView.textContent();
      expect(rawResp.length).toBeGreaterThan(0);
      expect(rawResp).toMatch(/HTTP\/1\.\d\s+\d{3}\s+/);
    });

    test('Simulate chunked transfer encoding: Transfer-Encoding header and chunk markers present', async ({ page }) => {
      const model = new HttpExplorerPage(page);

      await model.simulateChunkedBtn.click();

      // Wait until raw response includes Transfer-Encoding: chunked
      await model.waitForRawResponseContains('Transfer-Encoding: chunked', 3000);

      // Validate raw response body contains chunk sizes (e.g., 'A' chunk size line)
      const rawResp = await model.rawResponseView.textContent();
      expect(rawResp).toContain('Transfer-Encoding: chunked');
      expect(rawResp).toMatch(/\r\nA\r\n/); // chunk size 'A' line present
    });

    test('Simulate HTTP Basic Auth flow: 401 then 200 when Authorization header provided', async ({ page }) => {
      const model = new HttpExplorerPage(page);

      await model.simulateAuthBtn.click();

      // First, unauthenticated request should produce a 401 Unauthorized response (simulationOutput contains text)
      await model.waitForSimulationOutputContains('Sending unauthenticated request...', 2000);
      // rawResponseView should show 401 at some point after first makeRequest
      await model.waitForRawResponseContains('401 Unauthorized', 3000);

      // After 1500ms the second authenticated request will be fired and should return 200
      await model.waitForRawResponseContains('200 OK', 5000);
      const rawResp = await model.rawResponseView.textContent();
      expect(rawResp).toMatch(/HTTP\/1\.\d\s+200\s+OK/);
    });

    test('Simulate Cache-Control and Conditional Requests: initial fetch then 304 Not Modified', async ({ page }) => {
      const model = new HttpExplorerPage(page);

      await model.simulateCacheBtn.click();

      // Wait for initial cached resource response (200)
      await model.waitForRawResponseContains('HTTP/1.1 200 OK', 3000);

      // After the setTimeout in the app, it should simulate the conditional GET and produce a 304 Not Modified response
      await model.waitForSimulationOutputContains('Now simulate client sends conditional GET', 4000);
      // The code calls simulateConditionalGet which sets rawResponseView to 'HTTP/1.1 304 Not Modified'
      await model.waitForRawResponseContains('304 Not Modified', 5000);

      const rawResp = await model.rawResponseView.textContent();
      expect(rawResp).toContain('304 Not Modified');
      // Also ensure response controls visible after the response
      await expect(model.responseControls).toBeVisible();
    });

    test('Simulate compressed response: Content-Encoding: gzip header present', async ({ page }) => {
      const model = new HttpExplorerPage(page);

      await model.simulateCompressionBtn.click();

      // Wait for compressed response headers
      await model.waitForRawResponseContains('Content-Encoding: gzip', 3000);

      const rawResp = await model.rawResponseView.textContent();
      expect(rawResp).toContain('Content-Encoding: gzip');

      // simulationOutput should include the note about "Content-Encoding header shows \"gzip\""
      const simText = await model.simulationOutput.textContent();
      expect(simText).toContain('Content-Encoding header shows "gzip"');
    });
  });

  test.describe('Edge cases and negative scenarios', () => {
    test('Building request with methods requiring body includes Content-Length when body present', async ({ page }) => {
      const model = new HttpExplorerPage(page);

      // Set method to POST and include a small body
      await model.methodSelect.selectOption({ label: 'POST' });
      await model.urlInput.fill('http://example.com/path');
      await model.setHeaderCount(0);
      await page.waitForTimeout(20);
      await model.bodyInput.fill('hello world');
      await model.buildRequest();

      // rawRequestView should include Content-Length header
      await expect(model.rawRequestView).toContainText('Content-Length:');
    });

    test('Multiple identical headers are concatenated with comma in the built raw request', async ({ page }) => {
      const model = new HttpExplorerPage(page);

      // Set two headers with same name
      await model.setHeaderCount(2);
      await page.waitForTimeout(20);
      const inputs = model.headersArea.locator('input[type="text"]');
      // name inputs at even indices 0 and 2, values at 1 and 3
      await inputs.nth(0).fill('X-Dupe');
      await inputs.nth(1).fill('value1');
      await inputs.nth(2).fill('X-Dupe');
      await inputs.nth(3).fill('value2');

      await model.urlInput.fill('http://example.com/dupe');
      await model.buildRequest();

      const raw = await model.rawRequestView.textContent();
      // Expect single header line with comma separated values
      expect(raw).toContain('X-Dupe: value1, value2');
    });
  });

  // The tests above asserted there were no console errors or uncaught page errors in the afterEach hook.
  // This respects the requirement to observe console logs and page errors and let them happen naturally.
});