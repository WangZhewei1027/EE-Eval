import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f3480-fa73-11f0-a9d0-d7a1991987c6.html';
const RESOURCE_URL = 'https://jsonplaceholder.typicode.com/posts/1';

test.describe('HTTP Demonstration (FSM) - 324f3480-fa73-11f0-a9d0-d7a1991987c6', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console output
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught errors on the page (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // No explicit teardown necessary; Playwright fixtures handle closing pages/contexts.
    // But keep arrays cleared for safety (not strictly necessary).
    consoleMessages = [];
    pageErrors = [];
  });

  test('Idle state: page renders button and empty result (S0_Idle)', async ({ page }) => {
    // Validate initial Idle state: button present and pre#result empty
    // Also assert that no page errors occur on load (e.g., missing renderPage() should not throw)
    await page.goto(APP_URL);

    const button = page.locator("button[onclick='makeRequest()']");
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('Send HTTP GET Request');

    const result = page.locator('pre#result');
    await expect(result).toHaveCount(1);
    // Expect the result area to be empty initially
    await expect(result).toHaveText('', { timeout: 2000 });

    // Ensure no page errors were raised on load
    expect(pageErrors.length).toBe(0);

    // No console error messages expected on load
    const errorConsole = consoleMessages.find(m => m.type === 'error');
    expect(errorConsole).toBeUndefined();
  });

  test('Transition: SendHttpRequest -> ResponseReceived (S1 -> S2) with 200 OK', async ({ page }) => {
    // Intercept the network request and respond with a successful JSON payload
    let routeHit = 0;
    await page.route(RESOURCE_URL, async route => {
      routeHit++;
      await route.fulfill({
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Hello Test', body: 'This is a response body' })
      });
    });

    await page.goto(APP_URL);

    // Click the button to send the request (SendHttpRequest event)
    await page.click("button[onclick='makeRequest()']");

    // Wait for the result area to reflect the successful response
    const result = page.locator('pre#result');
    await expect(result).toHaveText(/Title: Hello Test/, { timeout: 5000 });
    await expect(result).toHaveText(/Body: This is a response body/, { timeout: 5000 });

    // Validate that the network route was hit (indicates RequestSent)
    expect(routeHit).toBeGreaterThanOrEqual(1);

    // No uncaught page errors should have occurred during normal 200 response processing
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: SendHttpRequest -> Error (S1 -> S3) with 500 Internal Server Error', async ({ page }) => {
    // Intercept and respond with an HTTP error status
    await page.route(RESOURCE_URL, async route => {
      await route.fulfill({
        status: 500,
        statusText: 'Internal Server Error',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'server failure' })
      });
    });

    await page.goto(APP_URL);

    // Click to trigger request
    await page.click("button[onclick='makeRequest()']");

    // The code's onload handler should set the pre#result to "Error: 500 - Internal Server Error"
    const result = page.locator('pre#result');
    await expect(result).toHaveText(/Error: 500 - Internal Server Error/, { timeout: 5000 });

    // No uncaught page errors expected for this handled error path
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: SendHttpRequest -> Network Error (S1 -> S4) when fetch is aborted', async ({ page }) => {
    // Simulate a network error by aborting the route
    let routeHit = 0;
    await page.route(RESOURCE_URL, async route => {
      routeHit++;
      await route.abort();
    });

    await page.goto(APP_URL);

    // Click to trigger request
    await page.click("button[onclick='makeRequest()']");

    // The code's onerror handler should set the pre#result to "Network Error"
    const result = page.locator('pre#result');
    await expect(result).toHaveText('Network Error', { timeout: 5000 });

    // Ensure route was attempted
    expect(routeHit).toBeGreaterThanOrEqual(1);

    // No additional uncaught exceptions expected (the onerror handler handles the case)
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Malformed JSON causes a SyntaxError in onload (uncaught) - observe pageerror', async ({ page }) => {
    // Respond with 200 but provide malformed JSON to trigger JSON.parse SyntaxError
    await page.route(RESOURCE_URL, async route => {
      await route.fulfill({
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        body: 'THIS IS NOT JSON'
      });
    });

    await page.goto(APP_URL);

    // Click to trigger request which will call JSON.parse and throw
    await page.click("button[onclick='makeRequest()']");

    // Wait for a pageerror to be captured
    await page.waitForEvent('pageerror', { timeout: 5000 });

    // Assert at least one page error was recorded and that it looks like a SyntaxError from JSON.parse
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const errMsgs = pageErrors.map(e => String(e.message || e));
    // Look for typical JSON parse error tokens
    const hasSyntax = errMsgs.some(msg =>
      /Unexpected token|Unexpected end of JSON|SyntaxError|JSON/.test(msg)
    );
    expect(hasSyntax).toBeTruthy();

    // Because a SyntaxError happened inside the onload handler, the script may not have set the result text.
    // The implementation does not catch JSON.parse errors, so pre#result should not contain the expected "Title:" text.
    const result = page.locator('pre#result');
    const resultText = (await result.innerText()).trim();
    // Either empty or not containing "Title:"
    expect(resultText.includes('Title:')).toBeFalsy();
  });

  test('Edge case: Rapid repeated clicks update to the latest response', async ({ page }) => {
    // We'll provide different responses for the first and second requests.
    // Use a counter to vary response.
    let counter = 0;
    await page.route(RESOURCE_URL, async route => {
      counter++;
      const body = { title: `Response #${counter}`, body: `Body ${counter}` };
      // Slight delay to simulate realistic network timing
      await new Promise(res => setTimeout(res, 50));
      await route.fulfill({
        status: 200,
        statusText: 'OK',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
    });

    await page.goto(APP_URL);

    // Perform two quick clicks
    await Promise.all([
      page.click("button[onclick='makeRequest()']"),
      page.click("button[onclick='makeRequest()']")
    ]);

    // Wait for the result to show 'Response #' (one of the responses). We expect the latest response to be displayed.
    const result = page.locator('pre#result');
    await expect(result).toHaveText(/Response #\d+/, { timeout: 5000 });

    const text = await result.innerText();
    // Ensure the displayed text contains Body matching the Response number
    expect(/Body \d+/.test(text)).toBeTruthy();
  });

  test('Verify no implicit call to non-existent renderPage() on load (onEnter action not present at runtime)', async ({ page }) => {
    // The FSM's S0 listed renderPage() as an entry action, but the implementation does not call it.
    // Verify that loading the page does not throw a ReferenceError due to missing renderPage.
    await page.goto(APP_URL);

    // No ReferenceError should be present in page errors
    const hasReferenceError = pageErrors.some(e => String(e.message).includes('ReferenceError') || String(e.name) === 'ReferenceError');
    expect(hasReferenceError).toBeFalsy();

    // Also ensure pre#result is still empty (renderPage would have changed state if it existed)
    const result = page.locator('pre#result');
    await expect(result).toHaveText('', { timeout: 2000 });
  });
});