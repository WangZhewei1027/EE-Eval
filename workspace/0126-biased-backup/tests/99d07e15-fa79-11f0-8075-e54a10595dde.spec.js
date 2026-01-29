import { test, expect } from '@playwright/test';

// Test file: 99d07e15-fa79-11f0-8075-e54a10595dde.spec.js
// Application under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/99d07e15-fa79-11f0-8075-e54a10595dde.html
//
// This test suite validates the FSM states and transitions described in the FSM:
// - S0_Idle (initial UI present)
// - S1_FetchingData (Fetch Data)
// - S2_PostingData (Post Data)
// - S3_UpdatingData (Update Data)
// - S4_DeletingData (Delete Data)
//
// Important: The page uses fetch(...) with response.json() and includes the non-standard
// "timeout" option which the browser may ignore. The page handlers catch fetch errors
// and write 'Error: ...' into #responseOutput. Tests observe DOM updates, console messages,
// and page errors without modifying the page. We assert that error observations occur naturally.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d07e15-fa79-11f0-8075-e54a10595dde.html';

// Page object encapsulating interactions with the demo
class ApiDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      apiEndpoint: '#apiEndpoint',
      fetchData: '#fetchData',
      postData: '#postData',
      postDataButton: '#postDataButton',
      updateDataId: '#updateDataId',
      updateData: '#updateData',
      updateDataButton: '#updateDataButton',
      deleteDataId: '#deleteDataId',
      deleteDataButton: '#deleteDataButton',
      timeout: '#timeout',
      responseOutput: '#responseOutput',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setEndpoint(value) {
    await this.page.fill(this.selectors.apiEndpoint, value);
  }

  async setTimeout(ms) {
    await this.page.fill(this.selectors.timeout, String(ms));
  }

  async clickFetch() {
    await this.page.click(this.selectors.fetchData);
  }

  async setPostData(value) {
    await this.page.fill(this.selectors.postData, value);
  }

  async clickPost() {
    await this.page.click(this.selectors.postDataButton);
  }

  async setUpdateId(id) {
    await this.page.fill(this.selectors.updateDataId, id);
  }

  async setUpdateData(value) {
    await this.page.fill(this.selectors.updateData, value);
  }

  async clickUpdate() {
    await this.page.click(this.selectors.updateDataButton);
  }

  async setDeleteId(id) {
    await this.page.fill(this.selectors.deleteDataId, id);
  }

  async clickDelete() {
    await this.page.click(this.selectors.deleteDataButton);
  }

  // Wait until the responseOutput has non-empty text content. Returns the text.
  async waitForResponseText({ timeout = 7000 } = {}) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('responseOutput');
      return !!el && el.textContent && el.textContent.trim().length > 0;
    }, undefined, { timeout });
    return this.page.locator(this.selectors.responseOutput).innerText();
  }

  async getResponseText() {
    return this.page.locator(this.selectors.responseOutput).innerText();
  }

  async getTimeoutValue() {
    return this.page.locator(this.selectors.timeout).inputValue();
  }
}

test.describe('REST API Interactive Demo (FSM validation) - 99d07e15-fa79-11f0-8075-e54a10595dde', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors so tests can assert their presence.
    page.on('console', msg => {
      try {
        // Collect text if available
        consoleMessages.push(String(msg.text()));
      } catch (e) {
        consoleMessages.push('<unserializable console message>');
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the app
    const demo = new ApiDemoPage(page);
    await demo.goto();
  });

  test.afterEach(async ({ page }) => {
    // Detach listeners by reloading to keep a clean slate (not modifying page logic)
    try {
      await page.evaluate(() => location.reload());
    } catch {
      // ignore reload errors
    }
  });

  test('Initial Idle state: UI elements are present and defaults are correct', async ({ page }) => {
    // This test validates the S0_Idle state: presence of inputs/buttons and default timeout.
    const demo = new ApiDemoPage(page);

    // Check that key elements exist and have the expected placeholders / default values.
    await expect(page.locator(demo.selectors.apiEndpoint)).toBeVisible();
    await expect(page.locator(demo.selectors.fetchData)).toBeVisible();
    await expect(page.locator(demo.selectors.postData)).toBeVisible();
    await expect(page.locator(demo.selectors.postDataButton)).toBeVisible();
    await expect(page.locator(demo.selectors.updateDataId)).toBeVisible();
    await expect(page.locator(demo.selectors.updateData)).toBeVisible();
    await expect(page.locator(demo.selectors.updateDataButton)).toBeVisible();
    await expect(page.locator(demo.selectors.deleteDataId)).toBeVisible();
    await expect(page.locator(demo.selectors.deleteDataButton)).toBeVisible();
    await expect(page.locator(demo.selectors.timeout)).toBeVisible();
    await expect(page.locator(demo.selectors.responseOutput)).toBeVisible();

    // Verify placeholder text and default timeout value are as documented in the HTML.
    const apiPlaceholder = await page.locator(demo.selectors.apiEndpoint).getAttribute('placeholder');
    expect(apiPlaceholder).toBe('Enter API Endpoint');

    const postPlaceholder = await page.locator(demo.selectors.postData).getAttribute('placeholder');
    expect(postPlaceholder).toContain('Enter JSON for POST');

    const updatePlaceholder = await page.locator(demo.selectors.updateData).getAttribute('placeholder');
    expect(updatePlaceholder).toContain('Enter JSON for Update');

    const timeoutValue = await demo.getTimeoutValue();
    expect(timeoutValue).toBe('5000');

    // Response output should be empty on load (Idle state).
    const resp = await demo.getResponseText();
    expect(resp.trim()).toBe('');

    // No page errors should have been thrown during initial load.
    // We allow console messages to exist (browsers may print benign messages),
    // but assert no uncaught pageerror during load.
    expect(pageErrors.length).toBe(0);
  });

  test.describe('Transitions from Idle (S0_Idle) to fetch/post/put/delete states', () => {
    // Helper to perform an interaction and assert that the page handled/fell back to an error response.
    async function performActionAndAssertError({ page, action }) {
      const demo = new ApiDemoPage(page);

      // Perform action (click) and wait for the responseOutput to be populated.
      await action();

      // Wait for the response area to be updated by the page's .then/.catch handlers.
      const responseText = await demo.waitForResponseText({ timeout: 8000 });
      // The implementation writes 'Error: ' + error to responseOutput when fetch fails or response.json() fails.
      expect(responseText).toMatch(/^Error:/);

      // Additionally assert we observed related console or page errors when available.
      // Typical failures include CORS errors, network errors (Failed to fetch), or JSON parse SyntaxError.
      const combinedLogs = consoleMessages.concat(pageErrors);
      const hasIndicativeLog = combinedLogs.some(msg =>
        /Failed to fetch|NetworkError|CORS|SyntaxError|TypeError|Unexpected token/i.test(msg)
      );

      // We expect at least either console/page error or a response error in the DOM.
      // The DOM error assertion was already done. If there are no console/page messages matching
      // the common patterns, still proceed but log the captured messages for debugging if the test fails.
      expect(hasIndicativeLog).toBeTruthy();
    }

    test('Fetch Data (S0_Idle -> S1_FetchingData): clicking Fetch triggers fetch and error handling', async ({ page }) => {
      // This test clicks the Fetch Data button (FSM event: FetchData) and verifies the S1_FetchingData transition
      // by observing the responseOutput being updated and console/page errors logged.
      const demo = new ApiDemoPage(page);

      // Use a cross-origin URL that will likely return HTML so response.json() fails with a SyntaxError,
      // or produce CORS errors in console. This allows the page's catch handler to run and write an Error string.
      await demo.setEndpoint('https://example.com');

      // Ensure timeout field present and set (page's fetch uses the non-standard timeout option; we still set it).
      await demo.setTimeout(3000);

      await performActionAndAssertError({
        page,
        action: async () => {
          await demo.clickFetch();
        }
      });
    });

    test('Post Data (S0_Idle -> S2_PostingData): clicking Post triggers POST fetch and error handling', async ({ page }) => {
      // This test clicks Post Data (FSM event: PostData).
      const demo = new ApiDemoPage(page);

      await demo.setEndpoint('https://example.com');
      // Provide a JSON-like payload string in the post input
      await demo.setPostData(JSON.stringify({ name: 'John' }));
      await demo.setTimeout(3000);

      await performActionAndAssertError({
        page,
        action: async () => {
          await demo.clickPost();
        }
      });
    });

    test('Update Data (S0_Idle -> S3_UpdatingData): clicking Update triggers PUT fetch and error handling', async ({ page }) => {
      // This test clicks Update Data (FSM event: UpdateData).
      const demo = new ApiDemoPage(page);

      await demo.setEndpoint('https://example.com');
      await demo.setUpdateId('123');
      await demo.setUpdateData(JSON.stringify({ name: 'Doe' }));
      await demo.setTimeout(3000);

      await performActionAndAssertError({
        page,
        action: async () => {
          await demo.clickUpdate();
        }
      });
    });

    test('Delete Data (S0_Idle -> S4_DeletingData): clicking Delete triggers DELETE fetch and error handling', async ({ page }) => {
      // This test clicks Delete Data (FSM event: DeleteData).
      const demo = new ApiDemoPage(page);

      await demo.setEndpoint('https://example.com');
      await demo.setDeleteId('123');
      await demo.setTimeout(3000);

      await performActionAndAssertError({
        page,
        action: async () => {
          await demo.clickDelete();
        }
      });
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Empty endpoint leads to fetch to relative path and error handling', async ({ page }) => {
      // Clicking any action while apiEndpoint is empty should still trigger a fetch (to a relative path)
      // and the page's catch handler should populate responseOutput with an Error string.
      const demo = new ApiDemoPage(page);

      // Clear endpoint input explicitly
      await demo.setEndpoint('');
      await demo.setPostData('{"name":"Edge"}');
      await demo.setTimeout(2000);

      // Click Post (could be any action) to exercise behavior with empty endpoint.
      await demo.clickPost();

      const responseText = await demo.waitForResponseText({ timeout: 7000 });
      expect(responseText).toMatch(/^Error:/);

      const combinedLogs = consoleMessages.concat(pageErrors);
      const hasIndicativeLog = combinedLogs.some(msg =>
        /Failed to fetch|NetworkError|CORS|SyntaxError|TypeError|Unexpected token/i.test(msg)
      );

      expect(hasIndicativeLog).toBeTruthy();
    });

    test('Malformed JSON provided as POST body is still sent; client-side error originates from response.json()', async ({ page }) => {
      // The app does not validate JSON before sending; it sends the raw string as the body.
      // If the server responds with non-JSON, response.json() will throw and be caught, producing an Error message.
      const demo = new ApiDemoPage(page);

      await demo.setEndpoint('https://example.com');
      // Intentionally malformed JSON-like string (no quotes around key)
      await demo.setPostData('{name:John}');
      await demo.setTimeout(2000);

      await demo.clickPost();

      const responseText = await demo.waitForResponseText({ timeout: 8000 });
      expect(responseText).toMatch(/^Error:/);

      // Confirm that the console or page errors capture a typical indicator (CORS/Network/JSON parse)
      const combinedLogs = consoleMessages.concat(pageErrors);
      const hasIndicativeLog = combinedLogs.some(msg =>
        /Failed to fetch|NetworkError|CORS|SyntaxError|TypeError|Unexpected token/i.test(msg)
      );

      expect(hasIndicativeLog).toBeTruthy();
    });
  });
});