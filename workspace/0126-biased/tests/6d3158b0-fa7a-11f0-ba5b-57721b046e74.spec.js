import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d3158b0-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object to encapsulate interactions with the app
class HttpExplorerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.methodSelect = page.locator('#methodSelect');
    this.urlInput = page.locator('#urlInput');
    this.bodyInput = page.locator('#bodyInput');
    this.addHeaderButton = page.locator('#addHeader');
    this.headersContainer = page.locator('#headersContainer');
    this.authUsername = page.locator('#authUsername');
    this.authPassword = page.locator('#authPassword');
    this.sendRequestButton = page.locator('#sendRequest');
    this.requestDetails = page.locator('#requestDetails');
    this.responseDetails = page.locator('#responseDetails');
    this.historyList = page.locator('#historyList');
  }

  async waitForLoad() {
    // Ensure init() ran and DOM initialised
    await this.page.waitForSelector('#methodSelect');
    await this.page.waitForSelector('#urlInput');
    await this.page.waitForSelector('#headersContainer');
  }

  async getHeaderInputs() {
    // Returns array of { nameLocator, valueLocator, removeLocator }
    const headerDivs = await this.headersContainer.locator('div').elementHandles();
    const results = [];
    for (let i = 0; i < headerDivs.length; i++) {
      const root = headerDivs[i];
      const nameHandle = await root.$('.header-name');
      const valueHandle = await root.$('.header-value');
      const removeHandle = await root.$('.remove-header');
      results.push({
        nameLocator: nameHandle ? this.page.locator('xpath=.' , { has: this.page.locator('.header-name', { hasText: '' }), timeout: 1 }).first() : null,
      });
    }
    // Simpler: read via DOM queries using evaluate
    const count = await this.page.evaluate(() => document.querySelectorAll('#headersContainer > div').length);
    const arr = [];
    for (let i = 0; i < count; i++) {
      arr.push({
        name: this.page.locator(`#headersContainer input.header-name[data-index="${i}"]`),
        value: this.page.locator(`#headersContainer input.header-value[data-index="${i}"]`),
        remove: this.page.locator(`#headersContainer button.remove-header[data-index="${i}"]`)
      });
    }
    return arr;
  }

  async addHeader() {
    await this.addHeaderButton.click();
    // Wait for DOM update
    await this.page.waitForTimeout(50);
  }

  async setHeader(index, name, value) {
    const inputs = await this.getHeaderInputs();
    if (index >= inputs.length) throw new Error('Header index out of range');
    await inputs[index].name.fill(name);
    // Trigger change event
    await inputs[index].name.press('Tab');
    if (value !== undefined) {
      await inputs[index].value.fill(value);
      await inputs[index].value.press('Tab');
    }
  }

  async removeHeader(index) {
    const inputs = await this.getHeaderInputs();
    if (index >= inputs.length) throw new Error('Header index out of range');
    await inputs[index].remove.click();
    // Wait for DOM update
    await this.page.waitForTimeout(50);
  }

  async changeMethod(method) {
    await this.methodSelect.selectOption({ label: method });
    // 'change' listeners run synchronously
    await this.page.waitForTimeout(20);
  }

  async setUrl(url) {
    await this.urlInput.fill(url);
    // trigger change event explicitly by blurring
    await this.urlInput.press('Tab');
    await this.page.waitForTimeout(20);
  }

  async setBody(body) {
    await this.bodyInput.fill(body);
    // input event triggers on fill
    await this.page.waitForTimeout(20);
  }

  async setAuth(username, password) {
    if (username !== undefined) {
      await this.authUsername.fill(username);
      await this.authUsername.press('Tab');
    }
    if (password !== undefined) {
      await this.authPassword.fill(password);
      await this.authPassword.press('Tab');
    }
    await this.page.waitForTimeout(20);
  }

  async clickSend() {
    await this.sendRequestButton.click();
  }

  async getRequestDetailsText() {
    return this.requestDetails.innerText();
  }

  async getResponseDetailsText() {
    return this.responseDetails.innerText();
  }

  async getHistoryItems() {
    return this.historyList.locator('li');
  }

  async clickHistoryItem(index) {
    const items = this.historyList.locator('li');
    await items.nth(index).click();
    await this.page.waitForTimeout(50);
  }
}

test.describe('HTTP Interactive Explorer - FSM and interactions (6d3158b0-fa7a-11f0-ba5b-57721b046e74)', () => {
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the application (init() runs onload)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Assert that no unexpected console errors or page errors occurred during the test.
    // This verifies the runtime did not produce uncaught exceptions in normal flows.
    expect(consoleErrors, 'No console.error messages should be emitted').toEqual([]);
    expect(pageErrors, 'No uncaught page errors should be emitted').toEqual([]);
  });

  test('Idle state on load: init() runs and initial UI reflects currentRequest', async ({ page }) => {
    // Validate the S0_Idle entry actions and initial display values.
    const app = new HttpExplorerPage(page);
    await app.waitForLoad();

    // Method should default to GET (as per currentRequest)
    await expect(app.methodSelect).toHaveValue('GET');

    // URL should be prefilled with jsonplaceholder endpoint
    await expect(app.urlInput).toHaveValue('https://jsonplaceholder.typicode.com/posts/1');

    // Body should be empty and disabled for GET
    await expect(app.bodyInput).toHaveValue('');
    await expect(app.bodyInput).toBeDisabled();

    // There should be two headers initially (Content-Type and Accept)
    const headers = await app.getHeaderInputs();
    expect(headers.length).toBeGreaterThanOrEqual(2);

    // Auth fields should be empty
    await expect(app.authUsername).toHaveValue('');
    await expect(app.authPassword).toHaveValue('');

    // Request and response panes should be empty
    const requestText = await app.getRequestDetailsText();
    const responseText = await app.getResponseDetailsText();
    expect(requestText.trim()).toBe('');
    expect(responseText.trim()).toBe('');
  });

  test('AddHeader event: adding, editing, and removing headers updates DOM and currentRequest', async ({ page }) => {
    // Validate AddHeader, HeaderChange, and RemoveHeader events keep machine in Idle (S0)
    const app = new HttpExplorerPage(page);
    await app.waitForLoad();

    // Count existing headers
    const before = await app.getHeaderInputs();
    const beforeCount = before.length;

    // Add a header (S0_Idle -> S0_Idle)
    await app.addHeader();
    let headers = await app.getHeaderInputs();
    expect(headers.length).toBe(beforeCount + 1);

    // Edit the newly added header (HeaderChange)
    const newIndex = headers.length - 1;
    await app.setHeader(newIndex, 'X-Test-Header', 'test-value');

    // Verify inputs show the edited values
    await expect(app.page.locator(`#headersContainer input.header-name[data-index="${newIndex}"]`)).toHaveValue('X-Test-Header');
    await expect(app.page.locator(`#headersContainer input.header-value[data-index="${newIndex}"]`)).toHaveValue('test-value');

    // Remove the header (RemoveHeader)
    await app.removeHeader(newIndex);
    headers = await app.getHeaderInputs();
    expect(headers.length).toBe(beforeCount);
  });

  test('MethodChange and BodyInput events: toggling methods enables/disables body and preserves body for non-GET', async ({ page }) => {
    // Validate MethodChange transitions and BodyInput updates (S0_Idle behaviors)
    const app = new HttpExplorerPage(page);
    await app.waitForLoad();

    // Change to POST: body should become enabled
    await app.changeMethod('POST');
    await expect(app.methodSelect).toHaveValue('POST');
    await expect(app.bodyInput).toBeEnabled();

    // Set body content
    const sampleBody = JSON.stringify({ hello: 'world' });
    await app.setBody(sampleBody);
    await expect(app.bodyInput).toHaveValue(sampleBody);

    // Change to HEAD: body should be disabled and content preserved in currentRequest (but UI disabled)
    await app.changeMethod('HEAD');
    await expect(app.methodSelect).toHaveValue('HEAD');
    await expect(app.bodyInput).toBeDisabled();

    // Change back to POST: body should re-enable and preserve previous content
    await app.changeMethod('POST');
    await expect(app.bodyInput).toBeEnabled();
    await expect(app.bodyInput).toHaveValue(sampleBody);
  });

  test('UrlChange event: updating URL updates internal state and appears in request details when sending', async ({ page }) => {
    // Validate UrlChange and SendRequest transitions (S0_Idle -> S1_RequestSent)
    const app = new HttpExplorerPage(page);
    await app.waitForLoad();

    const newUrl = 'https://jsonplaceholder.typicode.com/posts/2';
    await app.setUrl(newUrl);
    await expect(app.urlInput).toHaveValue(newUrl);

    // Send the request and wait for response to appear (S1_RequestSent -> S2_ResponseReceived)
    await app.clickSend();

    // Wait for either Response or Error section to appear in responseDetails
    await page.waitForFunction(() => {
      const el = document.getElementById('responseDetails');
      return el && el.innerText.trim().length > 0;
    }, { timeout: 5000 });

    // Validate request details reflect the new URL
    const reqText = await app.getRequestDetailsText();
    expect(reqText).toContain(newUrl);
    expect(reqText).toContain('POST', /* may be GET by default; ensure that method displays */);

    // Validate response details contain Status or Error info
    const resText = await app.getResponseDetailsText();
    // It should either contain 'Status:' or 'Error' depending on network
    expect(resText.length).toBeGreaterThan(0);
    expect((/Status: \d+/.test(resText)) || (/Error/i.test(resText))).toBeTruthy();

    // Validate history updated if response succeeded (there should be at least 0..1 items)
    const historyCount = await app.historyList.locator('li').count();
    // If response included a status, we expect at least one history item. If network failed, history may remain empty.
    if (/Status: \d+/.test(resText)) {
      expect(historyCount).toBeGreaterThanOrEqual(1);
    }
  });

  test('Authentication inputs produce Authorization header in requestDetails and are encoded as Basic', async ({ page }) => {
    // Validate AuthUsernameInput and AuthPasswordInput events affect headers used in request creation
    const app = new HttpExplorerPage(page);
    await app.waitForLoad();

    // Use a known URL that will accept the request (or at least run request logic)
    await app.setUrl('https://jsonplaceholder.typicode.com/posts/1');

    // Set username and password
    await app.setAuth('user123', 'p@ssw0rd');

    // Send the request; requestDetails is always rendered before fetch completes
    await app.clickSend();

    // Wait for requestDetails to be populated
    await page.waitForFunction(() => {
      const el = document.getElementById('requestDetails');
      return el && el.innerText.trim().length > 0;
    }, { timeout: 2000 });

    const reqText = await app.getRequestDetailsText();
    // The Authorization header should be present in the requestDetails innerHTML
    expect(reqText).toContain('Authorization');
    // Basic auth value should be present (btoa of 'user123:p@ssw0rd')
    const expectedPrefix = 'Basic ';
    expect(reqText).toContain(expectedPrefix);
  });

  test('Error scenario: sending to an invalid URL triggers catch block and displays an error', async ({ page }) => {
    // This tests edge case and ensures response error branch is exercised
    const app = new HttpExplorerPage(page);
    await app.waitForLoad();

    // Use an invalid/non-routable URL to force a network error quickly.
    // This should cause the fetch to reject and the catch block to populate responseDetails with Error.
    await app.setUrl('http://127.0.0.1:9999/this-path-should-not-exist-xyz');

    // Send the request
    await app.clickSend();

    // Wait for responseDetails to show an Error message
    await page.waitForFunction(() => {
      const el = document.getElementById('responseDetails');
      return el && /Error/i.test(el.innerText);
    }, { timeout: 5000 });

    const resText = await app.getResponseDetailsText();
    expect(/Error/i.test(resText)).toBeTruthy();
  });

  test('HistoryClick event loads a past request back into the builder', async ({ page }) => {
    // Validate transition S2_ResponseReceived -> S0_Idle via HistoryClick
    const app = new HttpExplorerPage(page);
    await app.waitForLoad();

    // Ensure there is at least one history entry by sending a quick request
    await app.setUrl('https://jsonplaceholder.typicode.com/posts/1');
    await app.clickSend();

    // Wait for responseDetails to be populated
    await page.waitForFunction(() => {
      const el = document.getElementById('responseDetails');
      return el && el.innerText.trim().length > 0;
    }, { timeout: 5000 });

    // If a history entry was added, click it
    const itemCount = await app.historyList.locator('li').count();
    if (itemCount === 0) {
      // If there is no history item (network failed), we still consider the test valid but skip the rest.
      test.skip('No history items available to test HistoryClick');
      return;
    }

    // Read the first history item's text for later comparison
    const firstText = await app.historyList.locator('li').nth(0).innerText();

    // Click the first history item to load into builder
    await app.clickHistoryItem(0);

    // After loading from history, the builder inputs should reflect the selected history entry.
    // The URL input should equal the URL contained in the history text.
    // Extract URL substring from the history item: it's typically "METHOD URL - STATUS (time)"
    const parts = firstText.split(' ');
    const historyMethod = parts[0];
    const historyUrl = parts[1];

    // Validate method and URL loaded into builder
    await expect(app.methodSelect).toHaveValue(historyMethod);
    await expect(app.urlInput).toHaveValue(historyUrl);
  });
});