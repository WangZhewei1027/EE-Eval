import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520acd94-fa76-11f0-a09b-87751f540fd8.html';

// Helper: wait until the predicate returns true or timeout elapses
async function waitFor(predicate, { interval = 100, timeout = 3000 } = {}) {
  const start = Date.now();
  while (true) {
    if (await predicate()) return;
    if (Date.now() - start > timeout) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise((r) => setTimeout(r, interval));
  }
}

test.describe('Load Balancer FSM - Idle State (S0_Idle)', () => {
  // Captured console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset capture arrays
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Defensive: if msg.text() throws, capture minimal info
        consoleMessages.push({ type: msg.type(), text: '<unserializable console message>' });
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test and wait for load to complete.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('renders static content and visual elements correctly', async ({ page }) => {
    // Validate page title as part of the static UI
    await expect(page).toHaveTitle('Load Balancing');

    // Validate heading text
    const heading = await page.locator('h1').textContent();
    expect(heading && heading.trim()).toBe('Load Balancer Example');

    // Validate descriptive paragraph
    const paragraph = await page.locator('.container p').textContent();
    expect(paragraph).toContain('simple load balancer example');

    // Validate image exists and its src points to the expected placeholder domain
    const img = page.locator('.container img');
    await expect(img).toBeVisible();
    const src = await img.getAttribute('src');
    expect(src).toContain('picsum.photos');

    // Ensure there are no uncaught page errors immediately after load for this test
    expect(pageErrors.length).toBe(0);
  });

  test('onEnter (loadBalancer) is invoked on page load and logs server busy messages', async ({ page }) => {
    // The FSM states indicate loadBalancer() is an entry action for Idle.
    // The implementation calls loadBalancer multiple times on load, which logs:
    // "Server is busy, please wait..." (10 times per call, immediate + delayed).
    const targetText = 'Server is busy, please wait...';

    // Wait until we observe at least 4 such messages (script calls loadBalancer 4 times,
    // each enqueues a 0ms timeout which should generate immediate log entries).
    await waitFor(
      async () => {
        const count = consoleMessages.filter((m) => m.text.includes(targetText)).length;
        return count >= 4;
      },
      { interval: 100, timeout: 3000 }
    );

    const occurrences = consoleMessages.filter((m) => m.text.includes(targetText)).length;
    // Expect at least 4 immediate occurrences (one per loadBalancer invocation).
    expect(occurrences).toBeGreaterThanOrEqual(4);

    // Also assert that the console messages are of type 'log' (consistent with console.log)
    const nonLogTypes = consoleMessages.filter((m) => m.text.includes(targetText) && m.type !== 'log');
    expect(nonLogTypes.length).toBe(0);
  });

  test('handleRequest* functions exist and return expected values and log handling messages', async ({ page }) => {
    // Validate that the global handleRequest functions return "Request handled"
    // and that they log "Handling request: <payload>" to the console.

    // Helper to call a named function in page context and assert behavior
    async function callAndAssert(fnName, arg) {
      // Call function in page context and get return value
      const returnValue = await page.evaluate(
        ({ fnName, arg }) => {
          // Access the function by name on the window object
          // This will throw if the function does not exist (which we want to detect in a separate test)
          // eslint-disable-next-line no-undef
          return window[fnName](arg);
        },
        { fnName, arg }
      );

      expect(returnValue).toBe('Request handled');

      // The function logs: `Handling request: ${request}`
      const expectedLog = `Handling request: ${String(arg)}`;

      // Wait for the console to include this log
      await waitFor(
        async () => consoleMessages.some((m) => m.text.includes(expectedLog)),
        { interval: 50, timeout: 1000 }
      );

      const found = consoleMessages.some((m) => m.text.includes(expectedLog));
      expect(found).toBe(true);
    }

    // Call each of the defined functions with a sample payload
    await callAndAssert('handleRequest', 'alpha');
    await callAndAssert('handleRequest2', 'beta');
    await callAndAssert('handleRequest3', 'gamma');
    await callAndAssert('handleRequest4', 'delta');

    // Confirm no uncaught page errors were produced by calling these functions
    expect(pageErrors.length).toBe(0);
  });

  test('calling an undefined function in page context produces a ReferenceError', async ({ page }) => {
    // Intentionally call a non-existent function to let a ReferenceError occur naturally.
    // We assert that the page.evaluate promise rejects and that the pageerror event captures the error.

    const evaluatePromise = page.evaluate(() => {
      // This should throw in the page context
      // eslint-disable-next-line no-undef
      return nonExistentFunction('test');
    });

    // Expect the evaluate to reject due to reference error in the page context
    await expect(evaluatePromise).rejects.toThrow(/is not defined|not defined|is not a function/);

    // The page may also emit a pageerror event for this uncaught exception; wait briefly for it.
    await waitFor(
      async () => pageErrors.length > 0,
      { interval: 50, timeout: 1000 }
    );

    // Assert that at least one page error message mentions the missing function name
    const errorMessages = pageErrors.map((e) => (e && e.message) || String(e));
    const foundRelevant = errorMessages.some((msg) => msg.includes('nonExistentFunction') || /is not defined/.test(msg));
    expect(foundRelevant).toBe(true);
  });

  test('edge cases: handleRequest called with undefined and null arguments still returns and logs', async ({ page }) => {
    // Call with undefined
    const returnUndefined = await page.evaluate(() => handleRequest(undefined));
    expect(returnUndefined).toBe('Request handled');
    await waitFor(
      async () => consoleMessages.some((m) => m.text.includes('Handling request: undefined')),
      { interval: 50, timeout: 500 }
    );
    expect(consoleMessages.some((m) => m.text.includes('Handling request: undefined'))).toBe(true);

    // Call with null
    const returnNull = await page.evaluate(() => handleRequest(null));
    expect(returnNull).toBe('Request handled');
    await waitFor(
      async () => consoleMessages.some((m) => m.text.includes('Handling request: null')),
      { interval: 50, timeout: 500 }
    );
    expect(consoleMessages.some((m) => m.text.includes('Handling request: null'))).toBe(true);

    // Confirm no uncaught page errors for these edge calls
    expect(pageErrors.length).toBe(0);
  });

  test('stress-like scenario: multiple sequential calls to handler do not modify DOM unexpectedly', async ({ page }) => {
    // Record DOM snapshot of the container before calls
    const beforeHtml = await page.locator('.container').innerHTML();

    // Make several calls to different handleRequest functions
    await page.evaluate(() => {
      handleRequest('1');
      handleRequest2('2');
      handleRequest3('3');
      handleRequest4('4');
    });

    // Allow short time for logs to flush
    await page.waitForTimeout(200);

    // Ensure the DOM container remains the same (functions should not alter DOM)
    const afterHtml = await page.locator('.container').innerHTML();
    expect(afterHtml).toBe(beforeHtml);

    // Ensure expected logs for the above calls are present
    expect(consoleMessages.some((m) => m.text.includes('Handling request: 1'))).toBe(true);
    expect(consoleMessages.some((m) => m.text.includes('Handling request: 2'))).toBe(true);
    expect(consoleMessages.some((m) => m.text.includes('Handling request: 3'))).toBe(true);
    expect(consoleMessages.some((m) => m.text.includes('Handling request: 4'))).toBe(true);
  });
});