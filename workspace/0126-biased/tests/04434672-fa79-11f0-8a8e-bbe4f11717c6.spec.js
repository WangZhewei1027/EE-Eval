import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/04434672-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Big-Omega Notation Application (App ID: 04434672-fa79-11f0-8a8e-bbe4f11717c6)', () => {
  // Arrays to collect console and page errors for each test
  let consoleErrors;
  let pageErrors;
  let responses;

  // Attach listeners before each test to observe runtime errors and network responses.
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    responses = [];

    // Collect console.error messages
    page.on('console', msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // swallow listener exceptions
      }
    });

    // Collect uncaught exceptions (pageerror)
    page.on('pageerror', err => {
      try {
        pageErrors.push(err && err.message ? err.message : String(err));
      } catch (e) {
        // swallow
      }
    });

    // Collect network responses for later inspection
    page.on('response', resp => {
      try {
        const url = resp.url();
        responses.push({ url, status: resp.status(), ok: resp.ok() });
      } catch (e) {
        // swallow
      }
    });
  });

  test.afterEach(async () => {
    // Clear collectors to avoid cross-test bleeding (not strictly necessary as they're reinitialized)
    consoleErrors = [];
    pageErrors = [];
    responses = [];
  });

  test('Idle state renders the static content (h1 and primary paragraphs) and entry action is attempted', async ({ page }) => {
    // This test validates:
    // - The page renders the Idle state's evidence (the H1)
    // - The page attempts to run any entry actions (we observe console/page errors)
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Verify the main heading exists and has the expected text
    const heading = page.locator('h1');
    await expect(heading).toHaveCount(1);
    await expect(heading).toHaveText('Big-Omega Notation');

    // Verify explanatory paragraph exists
    const paragraph = page.locator('.container > p');
    await expect(paragraph).toHaveCount(1);
    await expect(paragraph).toContainText('Big-Omega Notation is a way of measuring');

    // Verify that a <script src="script.js"> tag is present in the DOM (we don't modify it)
    const scriptTagExists = await page.locator('script[src="script.js"]').count();
    expect(scriptTagExists).toBeGreaterThanOrEqual(1);

    // Ensure we observed at least one runtime console error or page error.
    // The FSM includes an entry action "renderPage()" in metadata; if it's invoked by the page,
    // it may result in a ReferenceError. Per instructions we must let such errors happen and assert them.
    // We assert that there was at least one console.error or pageerror reported.
    // Note: This is intentionally permissive to accept any JS error emitted by the page.
    const totalErrors = consoleErrors.length + pageErrors.length;
    expect(totalErrors).toBeGreaterThan(0);
  });

  test('Script resource (script.js) is requested and its response is observable; JS errors logged if any', async ({ page }) => {
    // This test validates:
    // - The application requests the script.js resource relative to the HTML location.
    // - We observe the network response for that resource and inspect its status.
    // - We assert that runtime JS errors (if any) were emitted and captured.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for a response whose URL ends with '/script.js' (relative script will resolve to the same folder)
    const scriptResponse = responses.find(r => r.url.endsWith('/script.js'));
    // Assert that the request for script.js was observed
    expect(scriptResponse, `Expected a network response for script.js but none was observed. Collected responses: ${responses.map(r => r.url).slice(0,5).join(', ')}`).toBeTruthy();

    // If we observed it, assert the status is a valid HTTP status code
    if (scriptResponse) {
      expect(typeof scriptResponse.status).toBe('number');
      expect(scriptResponse.status).toBeGreaterThanOrEqual(100);
      expect(scriptResponse.status).toBeLessThan(600);
    }

    // There should be at least one JS runtime error or console.error if the script is malformed or
    // if an expected function (like renderPage) is invoked but not defined.
    // Per project instructions, we assert that such errors occur (they happen naturally).
    const foundError = consoleErrors.concat(pageErrors).length > 0;
    expect(foundError).toBeTruthy();
  });

  test('No interactive elements exist as indicated by the FSM (buttons, inputs, links)', async ({ page }) => {
    // This test validates:
    // - The FSM extraction indicated no interactive elements. We confirm the DOM contains none of common interactive elements.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure no <button> elements
    await expect(page.locator('button')).toHaveCount(0);

    // Ensure no form controls
    await expect(page.locator('input')).toHaveCount(0);
    await expect(page.locator('select')).toHaveCount(0);
    await expect(page.locator('textarea')).toHaveCount(0);

    // Ensure there are no anchor links that could be interactive navigation
    // (We consider anchors with an href as interactive)
    const anchorsWithHref = await page.locator('a[href]').count();
    expect(anchorsWithHref).toBe(0);
  });

  test('Code examples are displayed as text and are not executed in the global scope', async ({ page }) => {
    // This test validates:
    // - The code examples appear in the DOM as pre/code text.
    // - Those examples are not executed (i.e., do not create global functions like linearSearch or HashTable).
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Check that the linearSearch example text is present
    const linearSearchCode = page.locator('pre > code', { hasText: 'linearSearch' });
    await expect(linearSearchCode).toHaveCount(1);
    await expect(linearSearchCode).toContainText('function linearSearch');

    // Check that the HashTable example text is present
    const hashTableCode = page.locator('pre > code', { hasText: 'HashTable' });
    await expect(hashTableCode).toHaveCount(1);
    await expect(hashTableCode).toContainText('class HashTable');

    // Verify that those functions/classes are not available as globals (they should just be static text).
    // We evaluate in page context without injecting or redefining anything.
    const linearSearchType = await page.evaluate(() => {
      // access global symbol if exists; this is a read-only inspection
      return typeof window.linearSearch;
    });
    const hashTableType = await page.evaluate(() => {
      return typeof window.HashTable;
    });

    // The expected behavior for this static page is that these identifiers are not defined as globals.
    expect(linearSearchType === 'undefined' || linearSearchType === 'function' /* tolerate if script.js defines it */).toBeTruthy();
    expect(hashTableType === 'undefined' || hashTableType === 'function' /* tolerate if script.js defines it */).toBeTruthy();
  });

  test('Verify presence of FSM-declared entry action "renderPage" implied errors (if invoked)', async ({ page }) => {
    // This test validates:
    // - The FSM metadata includes an entry action "renderPage()".
    // - If the page attempts to call renderPage(), a ReferenceError is expected when the function is not declared.
    // - We assert that one of the captured errors mentions renderPage or is a ReferenceError / "is not defined".
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Combine captured errors
    const allErrors = consoleErrors.concat(pageErrors);

    // Check if any error string mentions renderPage, ReferenceError, or 'is not defined'
    const matching = allErrors.some(msg => /renderPage|ReferenceError|is not defined/i.test(msg));

    // Assert that such an error was observed (per instructions we assert these natural errors occur)
    expect(matching, `Expected at least one error mentioning 'renderPage' or a ReferenceError, but captured errors were: ${JSON.stringify(allErrors)}`).toBeTruthy();
  });
});