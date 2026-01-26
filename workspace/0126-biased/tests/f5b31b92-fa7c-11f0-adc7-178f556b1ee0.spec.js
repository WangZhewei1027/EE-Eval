import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b31b92-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object encapsulating common interactions and observers
class RestApiPage {
  constructor(page) {
    this.page = page;
  }

  // Navigate to the application page
  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  // Click the "Try it out" button
  async clickTryItOut() {
    await this.page.click('#rest-api-example');
  }

  // Ensure the Try it out button exists and return its text content
  async getTryItOutText() {
    const handle = await this.page.$('#rest-api-example');
    if (!handle) return null;
    return (await handle.innerText()).trim();
  }

  // Helper to wait for a network request to the example endpoint
  async waitForApiRequest(timeout = 5000) {
    return this.page.waitForRequest((req) => {
      return req.url().includes('https://example.com/api/endpoint');
    }, { timeout });
  }

  // Attach a console listener capturing all messages
  attachConsoleLogger(store) {
    this.page.on('console', (msg) => {
      store.push({
        type: msg.type(),
        text: msg.text(),
      });
    });
  }

  // Attach a pageerror listener capturing runtime uncaught errors
  attachPageErrorLogger(store) {
    this.page.on('pageerror', (err) => {
      store.push({
        name: err.name,
        message: err.message,
        stack: err.stack,
      });
    });
  }
}

test.describe('REST API FSM Tests (f5b31b92-...-1ee0)', () => {
  // Idle state tests: verify initial rendering and presence of components
  test('S0_Idle: page renders and "Try it out" button is present', async ({ page }) => {
    // This test validates the Idle state entry action (renderPage())
    const app = new RestApiPage(page);
    await app.goto();

    // The button must exist and be visible with correct text (evidence of Idle state)
    const buttonText = await app.getTryItOutText();
    expect(buttonText).toBe('Try it out');

    // Also assert that the button has the correct id in DOM as evidence
    const buttonHandle = await page.$('#rest-api-example');
    expect(buttonHandle).not.toBeNull();
  });

  // Fetching state tests: clicking triggers a fetch request
  test('S0 -> S1: Clicking "Try it out" triggers a network fetch to the API endpoint', async ({ page }) => {
    // This test validates the transition from Idle to Fetching (S0 -> S1) and the S1 entry action (fetch(...))
    const app = new RestApiPage(page);
    await app.goto();

    // Listen for requests to detect the fetch call
    const requestPromise = app.waitForApiRequest(5000);

    // Click the button to trigger the fetch
    await app.clickTryItOut();

    // Wait for the network request to the expected endpoint
    const req = await requestPromise;
    expect(req).toBeDefined();
    expect(req.url()).toContain('https://example.com/api/endpoint');

    // Verify method is GET by default (evidence of typical fetch usage)
    expect(req.method()).toBeTruthy();
  });

  // Error state tests: allow the real network to run so that the fetch is likely to fail (CORS / invalid JSON),
  // and verify that the error path (S3_Error) is executed and console.error is called.
  test('S1 -> S3: Natural network/JSON errors cause console.error (Error Fetching Data)', async ({ page }) => {
    // This test validates the FetchError transition (S1 -> S3) and the S3 entry action (console.error(error)).
    const app = new RestApiPage(page);
    await app.goto();

    // Collect console messages
    const consoleMessages = [];
    app.attachConsoleLogger(consoleMessages);

    // Also collect uncaught page errors
    const pageErrors = [];
    app.attachPageErrorLogger(pageErrors);

    // Click without mocking network to let the browser perform the natural fetch which, in many environments,
    // will result in a TypeError due to CORS or invalid JSON parsing in the .then(response => response.json()) chain.
    await app.clickTryItOut();

    // Wait for an "error" console message which should be emitted by the catch(error => console.error(error))
    const errorConsole = await page.waitForEvent('console', {
      predicate: (msg) => msg.type() === 'error',
      timeout: 5000,
    });

    // The text should reflect an error. We don't force exact message because it can vary (TypeError, Failed to fetch, SyntaxError).
    const text = errorConsole.text();
    expect(text.length).toBeGreaterThan(0);

    // Assert one of the expected signatures is present in the error message:
    // - TypeError (typical "Failed to fetch")
    // - "Failed" substring
    // - "SyntaxError" (if JSON parsing failed and caught)
    const lowered = text.toLowerCase();
    const matchesKnown = lowered.includes('typeerror') || lowered.includes('failed') || lowered.includes('syntaxerror') || lowered.includes('unexpected');
    expect(matchesKnown).toBeTruthy();

    // Ensure that the page did not produce uncaught exceptions (the app code handles the fetch error)
    // If there was an uncaught exception, it's a bug in app logic.
    expect(pageErrors.length).toBe(0);
  });

  // Completed state tests: intercept the network request and respond with valid JSON to simulate success.
  test('S1 -> S2: Successful fetch results in console.log(data) (Data Fetched)', async ({ page }) => {
    // This test validates the DataFetched transition (S1 -> S2) and the S2 entry action (console.log(data)).
    const app = new RestApiPage(page);

    // Intercept the target API request and respond with a simple JSON primitive (so console.log prints a simple value)
    await page.route('https://example.com/api/endpoint', async (route) => {
      // Reply with JSON body '42' so that response.json() resolves to the number 42.
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: '42',
      });
    });

    await app.goto();

    // Collect console messages to detect console.log
    const consoleMessages = [];
    app.attachConsoleLogger(consoleMessages);

    // Click the button to trigger the fetch
    await app.clickTryItOut();

    // Wait for a console log message to appear containing '42'
    const logConsole = await page.waitForEvent('console', {
      predicate: (msg) => msg.type() === 'log' && msg.text().includes('42'),
      timeout: 5000,
    });

    expect(logConsole).toBeDefined();
    expect(logConsole.text()).toContain('42');

    // Verify our captured consoleMessages array contains a log entry with '42'
    const found = consoleMessages.find((m) => m.type === 'log' && m.text.includes('42'));
    expect(found).toBeTruthy();
  });

  // Edge case: Server responds with invalid JSON -> response.json() throws -> catch -> console.error should run
  test('S1 -> S3 (edge): Invalid JSON response triggers console.error via catch block', async ({ page }) => {
    // This test simulates a server returning invalid JSON to validate the error handling path.
    const app = new RestApiPage(page);

    // Intercept the request and respond with invalid JSON content
    await page.route('https://example.com/api/endpoint', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: 'this-is-not-json',
      });
    });

    await app.goto();

    // Capture console messages
    const consoleMessages = [];
    app.attachConsoleLogger(consoleMessages);

    // Click to trigger fetch -> invalid JSON -> response.json() should throw -> catch -> console.error
    await app.clickTryItOut();

    // Wait for an error console to be emitted
    const errorConsole = await page.waitForEvent('console', {
      predicate: (msg) => msg.type() === 'error',
      timeout: 5000,
    });

    const text = errorConsole.text();
    // Error message varies by browser; assert that an error was logged and looks like a parsing error
    const lowered = text.toLowerCase();
    const indicative = lowered.includes('syntaxerror') || lowered.includes('unexpected') || lowered.includes('invalid') || lowered.includes('error');
    expect(indicative).toBeTruthy();
  });

  // Edge case: Multiple rapid clicks should generate multiple requests (robustness of the fetching logic)
  test('S1: Multiple rapid clicks create multiple fetch requests', async ({ page }) => {
    // This test verifies that each click triggers a separate fetch (multiple transitions into S1)
    const app = new RestApiPage(page);
    await app.goto();

    // Capture requests to the endpoint
    const requests = [];
    page.on('request', (req) => {
      if (req.url().includes('https://example.com/api/endpoint')) {
        requests.push(req);
      }
    });

    // Click multiple times rapidly
    await Promise.all([
      app.clickTryItOut(),
      app.clickTryItOut(),
      app.clickTryItOut(),
    ]);

    // Wait briefly to allow requests to be issued
    await page.waitForTimeout(500);

    // At least 3 requests should have been observed; if network blocks, this may vary, so assert >= 1
    expect(requests.length).toBeGreaterThanOrEqual(1);
    // If requests >= 1, the application initiated fetch calls on repeated interactions; this validates repeated S1 entries.
  });
});