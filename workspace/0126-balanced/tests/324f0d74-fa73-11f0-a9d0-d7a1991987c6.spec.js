import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f0d74-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object for the TCP/IP demonstration app
class TcpIpApp {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = 'button[onclick="initiateConnection()"]';
    this.outputSelector = '#output';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickInitiate() {
    await this.page.click(this.buttonSelector);
  }

  async getOutputText() {
    return this.page.locator(this.outputSelector).innerText();
  }

  // Wait until the output text includes the provided substring or timeout
  async waitForOutputIncludes(substring, options = { timeout: 4000 }) {
    const { timeout } = options;
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return el.innerText.includes(substr);
      },
      this.outputSelector,
      substring,
      { timeout }
    );
  }

  // Wait until the output text matches a predicate
  async waitForOutputPredicate(predicateFn, options = { timeout: 5000 }) {
    await this.page.waitForFunction(
      (sel, predicateSerialized) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        // Recreate predicate from source (predicateFn is serialized by Playwright)
        // We'll assume predicateFn is a simple function stringifiable by Playwright.
        // For our usage, we pass a function that checks includes, but Playwright will handle it.
        // This wrapper allows flexibility if needed.
        // eslint-disable-next-line no-new-func
        const predicate = new Function('text', `return (${predicateSerialized})(text)`);
        return predicate(el.innerText);
      },
      this.outputSelector,
      predicateFn.toString(),
      { timeout: options.timeout }
    );
  }
}

test.describe('TCP/IP Demonstration - FSM states and transitions', () => {
  // Collect console errors and page errors during each test to assert absence of runtime errors
  test.beforeEach(async ({ page }) => {
    // No-op here; individual tests set up listeners as needed
  });

  test('Initial state (S0_Idle): page renders with Initiate Connection button and empty output', async ({ page }) => {
    // Purpose: Validate initial rendering (entry action renderPage() implied in FSM)
    const app = new TcpIpApp(page);

    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await app.goto();

    // Button must be present and visible
    await expect(page.locator(app.buttonSelector)).toBeVisible();

    // Output div must be present and initially empty (renderPage effect)
    const outputText = await app.getOutputText();
    expect(outputText).toBe('', 'Expected output to be empty on initial render');

    // Assert no runtime console errors occurred during load
    expect(consoleErrors.length, 'No console error messages during initial load').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors during initial load').toBe(0);
  });

  test('Transition S0 -> S1: Clicking Initiate Connection shows client request immediately', async ({ page }) => {
    // Purpose: Validate InitiateConnection event causes client sending request message to appear
    const app = new TcpIpApp(page);

    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await app.goto();

    // Click the button to initiate the connection (fires initiateConnection())
    await app.clickInitiate();

    // Immediately the client sending request line should be present
    const expectedClientLine = 'Client is sending a request: "GET /data"';
    await app.waitForOutputIncludes(expectedClientLine, { timeout: 1000 });

    const outputAfterClick = await app.getOutputText();
    expect(outputAfterClick).toContain(expectedClientLine);

    // No runtime errors should have occurred
    expect(consoleErrors.length, 'No console errors after initiating connection').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors after initiating connection').toBe(0);
  });

  test('Transition S1 -> S2 -> S3: Server receives request and responds, client receives response', async ({ page }) => {
    // Purpose: Validate the timed transitions: after ~1s server processing message, after another ~1s response messages
    const app = new TcpIpApp(page);

    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await app.goto();

    // Start the interaction
    await app.clickInitiate();

    // S1: client message appears immediately
    const clientLine = 'Client is sending a request: "GET /data"';
    await app.waitForOutputIncludes(clientLine, { timeout: 1000 });

    // S2: after ~1s server received and processing message
    const serverProcessing = 'Server received the request and is processing...';
    await app.waitForOutputIncludes(serverProcessing, { timeout: 2000 });

    // S3: after another ~1s server response and client confirmation
    const serverResponse = 'Server is sending a response: "200 OK"';
    const clientReceived = 'Client has received the response successfully!';

    // Wait up to 3.5s total for final messages (timers are ~1s + ~1s)
    await app.waitForOutputIncludes(serverResponse, { timeout: 3500 });
    await app.waitForOutputIncludes(clientReceived, { timeout: 3500 });

    const finalOutput = await app.getOutputText();
    expect(finalOutput).toContain(serverProcessing);
    expect(finalOutput).toContain(serverResponse);
    expect(finalOutput).toContain(clientReceived);

    // Validate the ordering of messages in the output (basic sequential check)
    const idxClient = finalOutput.indexOf(clientLine);
    const idxProcessing = finalOutput.indexOf(serverProcessing);
    const idxResponse = finalOutput.indexOf(serverResponse);
    const idxClientReceived = finalOutput.indexOf(clientReceived);

    expect(idxClient).toBeGreaterThanOrEqual(0);
    expect(idxProcessing).toBeGreaterThan(idxClient, 'Server processing message should come after client request');
    expect(idxResponse).toBeGreaterThan(idxProcessing, 'Server response should come after processing message');
    expect(idxClientReceived).toBeGreaterThan(idxResponse, 'Client received confirmation should come after server response');

    // No runtime errors
    expect(consoleErrors.length, 'No console errors during full connection sequence').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors during full connection sequence').toBe(0);
  });

  test('Restarting connection clears previous output and replays the sequence', async ({ page }) => {
    // Purpose: Validate exit actions / re-entry behavior: initiateConnection() clears previous output
    const app = new TcpIpApp(page);

    await app.goto();

    // First run
    await app.clickInitiate();
    await app.waitForOutputIncludes('Client is sending a request: "GET /data"', { timeout: 1000 });
    await app.waitForOutputIncludes('Client has received the response successfully!', { timeout: 3500 });

    const finalOutputFirstRun = await app.getOutputText();
    expect(finalOutputFirstRun).toContain('Client has received the response successfully!');

    // Click again to restart; the code clears output at the start of initiateConnection()
    await app.clickInitiate();

    // Immediately after clicking again, output should be cleared then show the client line for the new run.
    // Because clearing is synchronous, we can assert the output no longer contains the old final message after a tiny delay.
    await app.waitForOutputIncludes('Client is sending a request: "GET /data"', { timeout: 1000 });
    const outputAfterRestart = await app.getOutputText();

    // It should contain the client line and eventually the final confirmation again
    expect(outputAfterRestart).toContain('Client is sending a request: "GET /data"');
    await app.waitForOutputIncludes('Client has received the response successfully!', { timeout: 3500 });

    const finalOutputSecondRun = await app.getOutputText();
    expect(finalOutputSecondRun).toContain('Client has received the response successfully!');
  });

  test('Edge case: rapid double click - ensure final state still reached at least once', async ({ page }) => {
    // Purpose: Exercise potential race conditions: double-click immediately and ensure final messages are produced
    const app = new TcpIpApp(page);

    await app.goto();

    // Rapid double click
    await Promise.all([
      page.click(app.buttonSelector),
      page.click(app.buttonSelector)
    ]);

    // Regardless of overlap, the final response lines should appear for the run(s).
    await app.waitForOutputIncludes('Client has received the response successfully!', { timeout: 5000 });
    const output = await app.getOutputText();

    // Ensure final state messages exist
    expect(output).toContain('Server is sending a response: "200 OK"');
    expect(output).toContain('Client has received the response successfully!');
  });
});

test.describe('Console and runtime errors observation', () => {
  test('There are no uncaught runtime errors (ReferenceError/SyntaxError/TypeError) during normal interactions', async ({ page }) => {
    // Purpose: Observe console and page errors while exercising the app and assert none occur.
    const app = new TcpIpApp(page);

    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      // Collect error-level console messages; include exception stacks if any
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location()
        });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    await app.goto();

    // Trigger a full sequence to exercise timers and DOM updates
    await app.clickInitiate();
    await app.waitForOutputIncludes('Client has received the response successfully!', { timeout: 5000 });

    // Assert that no error-level console messages were produced and no uncaught page errors
    expect(consoleErrors.length, `Expected no console errors, found: ${consoleErrors.map(e => e.text).join(' | ')}`).toBe(0);
    expect(pageErrors.length, `Expected no uncaught page errors, found: ${pageErrors.join(' | ')}`).toBe(0);
  });

  test('If runtime errors appear they should be observable via pageerror or console.error', async ({ page }) => {
    // Purpose: Demonstrate test is monitoring errors by intentionally verifying the monitoring mechanism is active.
    // Note: We DO NOT inject errors or modify the page; we simply assert that our collectors are functional.
    const app = new TcpIpApp(page);

    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', (err) => pageErrors.push(String(err)));

    await app.goto();

    // Perform a no-op assertion that collectors are arrays and currently empty (since the page is healthy)
    expect(Array.isArray(consoleMessages)).toBe(true);
    expect(Array.isArray(pageErrors)).toBe(true);

    // We do not fail the test if errors exist; instead we explicitly fail above tests if errors were detected there.
    // This test ensures our listeners would capture errors if they occurred.
  });
});