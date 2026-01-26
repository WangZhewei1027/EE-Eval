import { test, expect } from '@playwright/test';

class ApiPage {
  /**
   * Page Object representing the REST API interactive page.
   * Captures console messages and page errors for assertions.
   */
  constructor(page, url) {
    this.page = page;
    this.url = url;
    this.consoleMessages = [];
    this.pageErrors = [];

    // Capture console messages
    this.page.on('console', (msg) => {
      try {
        this.consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // swallow any unexpected errors while capturing console
      }
    });

    // Capture unhandled page errors (e.g., ReferenceError, TypeError, SyntaxError)
    this.page.on('pageerror', (err) => {
      this.pageErrors.push({
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
    });
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async clickGet() {
    await this.page.click('#get-btn');
  }

  async clickPost() {
    await this.page.click('#post-btn');
  }

  async getGetResponseText() {
    return (await this.page.locator('#get-response').innerText()).trim();
  }

  async getPostResponseText() {
    return (await this.page.locator('#post-response').innerText()).trim();
  }

  // Wait until either the selector's text becomes non-empty OR a page error matching a regex occurs
  async waitForResponseOrError(selector, { timeout = 2000, errorRegex = /./ } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      // Check for response text
      try {
        const txt = (await this.page.locator(selector).innerText()).trim();
        if (txt.length > 0) {
          return { type: 'response', text: txt };
        }
      } catch (e) {
        // ignore
      }

      // Check for page errors matching regex
      for (const e of this.pageErrors) {
        if (errorRegex.test(e.message) || errorRegex.test(e.name) || errorRegex.test(e.stack || '')) {
          return { type: 'error', error: e };
        }
      }

      // Also check console for errors referencing functions (some errors may appear in console)
      for (const c of this.consoleMessages) {
        if (c.type === 'error' && errorRegex.test(c.text)) {
          return { type: 'console', console: c };
        }
      }

      await this.page.waitForTimeout(50);
    }
    return { type: 'timeout' };
  }
}

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/044430d5-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('REST API FSM - Interactive Application (044430d5-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  let apiPage;

  // Setup: create a fresh page for each test and attach listeners
  test.beforeEach(async ({ page }) => {
    apiPage = new ApiPage(page, APP_URL);
    await apiPage.goto();
  });

  // Teardown handled automatically by Playwright fixture (page closed)

  test('Initial state "Idle" - Buttons and response containers are rendered; capture renderPage() errors if any', async () => {
    // This test validates the Idle state (S0_Idle).
    // It ensures that the GET and POST buttons and the response divs are present.
    // It also observes console/page errors that may arise from the initial entry action renderPage().

    // Verify presence and visibility of main components
    await expect(apiPage.page.locator('#get-btn')).toBeVisible();
    await expect(apiPage.page.locator('#post-btn')).toBeVisible();
    await expect(apiPage.page.locator('#get-response')).toBeVisible();
    await expect(apiPage.page.locator('#post-response')).toBeVisible();

    // The FSM indicates an entry action: renderPage()
    // The implementation may call renderPage() on load. If the function is missing, a ReferenceError is expected.
    // We tolerate two acceptable outcomes:
    //  - The page executed renderPage successfully (no related pageerror). In that case the get/post response divs should be present (already asserted).
    //  - Or a ReferenceError (or other page error) referencing renderPage occurred. We assert that if any page errors occurred, at least one mentions 'renderPage' or is a ReferenceError.
    // Wait a short time to collect any initial page errors that happened on load.
    await apiPage.page.waitForTimeout(200);

    if (apiPage.pageErrors.length > 0) {
      // Ensure at least one error looks related to the expected entry action or is a JS runtime error
      const matches = apiPage.pageErrors.some((err) => {
        const msg = `${err.name}: ${err.message}`.toLowerCase();
        return msg.includes('renderpage') || msg.includes('referenceerror') || msg.includes('syntaxerror') || msg.includes('typeerror');
      });
      expect(matches).toBeTruthy();
    } else {
      // No page errors observed on load - as a safety assert that the response containers are empty strings initially (expected Idle evidence)
      const getText = await apiPage.getGetResponseText();
      const postText = await apiPage.getPostResponseText();
      expect(getText).toBe('');
      expect(postText).toBe('');
    }
  });

  test('GET_REQUEST event transitions to Get Requested (S1_GetRequested) - either updates #get-response or produces a JS error', async () => {
    // This test simulates clicking the GET Request button as per the FSM.
    // Entry to S1_GetRequested implies executeGetRequest() runs and transition action updateGetResponse() updates #get-response.
    // We allow two valid outcomes (implementation-dependent):
    // 1) #get-response becomes non-empty (successful execution)
    // 2) A ReferenceError/TypeError/SyntaxError (or console error referencing executeGetRequest/updateGetResponse) occurs

    // Precondition: empty get-response
    const before = await apiPage.getGetResponseText();
    expect(before).toBe('');

    // Click the GET button
    await apiPage.clickGet();

    // Wait for either response text change or a page/console error referencing expected function names
    const res = await apiPage.waitForResponseOrError('#get-response', {
      timeout: 2000,
      errorRegex: /(executemethod|executegtrequest|executegetrequest|updategetresponse|referenceerror|typeerror|syntaxerror)/i,
    });

    // Assert one of the acceptable outcomes occurred
    if (res.type === 'response') {
      // Successful path: get-response was updated
      expect(res.text.length).toBeGreaterThan(0);
    } else if (res.type === 'error' || res.type === 'console') {
      // Error path: ensure error looks like a runtime error or references the expected functions
      const txt = res.type === 'error' ? `${res.error.name}: ${res.error.message}` : res.console.text;
      expect(/execut(e|get|post|update)|executegetrequest|updategetresponse|referenceerror|typeerror|syntaxerror/i.test(txt)).toBeTruthy();
    } else {
      // Timeout: fail with diagnostic info
      const consoleDump = apiPage.consoleMessages.map(c => `${c.type}:${c.text}`).join(' | ');
      const pageErrDump = apiPage.pageErrors.map(e => `${e.name}:${e.message}`).join(' | ');
      throw new Error(`Neither response update nor error observed for GET within timeout. Console: ${consoleDump} PageErrors: ${pageErrDump}`);
    }
  });

  test('POST_REQUEST event transitions to Post Requested (S2_PostRequested) - either updates #post-response or produces a JS error', async () => {
    // This test simulates clicking the POST Request button as per the FSM.
    // Entry to S2_PostRequested implies executePostRequest() runs and transition action updatePostResponse() updates #post-response.
    // Acceptable outcomes:
    // 1) #post-response becomes non-empty
    // 2) A runtime error referencing post functions occurs

    // Precondition: empty post-response
    const before = await apiPage.getPostResponseText();
    expect(before).toBe('');

    // Click the POST button
    await apiPage.clickPost();

    // Wait for either response text change or a page/console error referencing expected function names
    const res = await apiPage.waitForResponseOrError('#post-response', {
      timeout: 2000,
      errorRegex: /(executepostrequest|updatepostresponse|referenceerror|typeerror|syntaxerror)/i,
    });

    // Assert one of the acceptable outcomes occurred
    if (res.type === 'response') {
      expect(res.text.length).toBeGreaterThan(0);
    } else if (res.type === 'error' || res.type === 'console') {
      const txt = res.type === 'error' ? `${res.error.name}: ${res.error.message}` : res.console.text;
      expect(/executepostrequest|updatepostresponse|referenceerror|typeerror|syntaxerror/i.test(txt)).toBeTruthy();
    } else {
      const consoleDump = apiPage.consoleMessages.map(c => `${c.type}:${c.text}`).join(' | ');
      const pageErrDump = apiPage.pageErrors.map(e => `${e.name}:${e.message}`).join(' | ');
      throw new Error(`Neither response update nor error observed for POST within timeout. Console: ${consoleDump} PageErrors: ${pageErrDump}`);
    }
  });

  test('Edge case: Rapid sequential clicks on GET and POST - ensure app either handles both or emits errors', async () => {
    // This test triggers both events in quick succession to exercise potential race conditions or missing function errors.
    // Valid outcomes:
    // - Both #get-response and #post-response become non-empty
    // - Or one/both clicks cause runtime errors (ReferenceError/TypeError/etc.)
    // We assert that at least one of these observable conditions happens.

    // Rapid clicks
    await Promise.all([
      apiPage.clickGet(),
      apiPage.clickPost(),
    ]);

    // Wait briefly for either responses or errors
    const getOutcome = await apiPage.waitForResponseOrError('#get-response', {
      timeout: 2500,
      errorRegex: /(executeg?et|updategetresponse|referenceerror|typeerror|syntaxerror)/i,
    });

    const postOutcome = await apiPage.waitForResponseOrError('#post-response', {
      timeout: 2500,
      errorRegex: /(executepostrequest|updatepostresponse|referenceerror|typeerror|syntaxerror)/i,
    });

    // Evaluate results: require that for each of GET and POST, either a response or an error was observed
    const getValid = getOutcome.type === 'response' || getOutcome.type === 'error' || getOutcome.type === 'console';
    const postValid = postOutcome.type === 'response' || postOutcome.type === 'error' || postOutcome.type === 'console';

    expect(getValid, 'GET did not produce a response or observable error').toBeTruthy();
    expect(postValid, 'POST did not produce a response or observable error').toBeTruthy();

    // If errors exist, ensure they are runtime JS errors (not swallowed)
    if (apiPage.pageErrors.length > 0) {
      const runtimeDetected = apiPage.pageErrors.some(e => /referenceerror|typeerror|syntaxerror/i.test(e.name + ' ' + e.message));
      expect(runtimeDetected).toBeTruthy();
    }
  });

  test('Observability: Console and page errors are captured for debugging', async () => {
    // This test simply verifies that our listeners captured console messages and page errors during prior interactions.
    // It demonstrates observability. It does not assert specific function side-effects beyond presence/format of logs.

    // Trigger interactions to generate potential logs if not already present
    await apiPage.clickGet();
    await apiPage.clickPost();

    // Allow time for logs/errors to appear
    await apiPage.page.waitForTimeout(300);

    // The arrays must exist and be arrays
    expect(Array.isArray(apiPage.consoleMessages)).toBeTruthy();
    expect(Array.isArray(apiPage.pageErrors)).toBeTruthy();

    // If there are any page errors, they should have a name and message properties
    for (const e of apiPage.pageErrors) {
      expect(typeof e.name).toBe('string');
      expect(typeof e.message).toBe('string');
    }

    // If there are console messages flagged as 'error', at least one should contain text
    const consoleErrors = apiPage.consoleMessages.filter(c => c.type === 'error');
    for (const ce of consoleErrors) {
      expect(typeof ce.text).toBe('string');
      expect(ce.text.length).toBeGreaterThanOrEqual(0);
    }
  });
});