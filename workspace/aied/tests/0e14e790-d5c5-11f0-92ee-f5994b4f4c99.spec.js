import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e14e790-d5c5-11f0-92ee-f5994b4f4c99.html';

test.describe('FSM: Set (Application ID: 0e14e790-d5c5-11f0-92ee-f5994b4f4c99)', () => {
  // Arrays to collect console messages and page errors for each test run
  let consoleMessages = [];
  let pageErrors = [];

  // Attach listeners and navigate to the page before each test.
  // We capture console messages and runtime errors so tests can assert their presence/contents.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages with their type and text
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Defensive: if msg.type() throws, still record raw text
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect page-level runtime errors (unhandled exceptions)
    page.on('pageerror', (error) => {
      // error is typically an Error object with message and name
      pageErrors.push(error);
    });

    // Navigate to the application under test and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Allow a short buffer for inline scripts to execute and any async behavior to surface
    await page.waitForTimeout(500);
  });

  // Tear down: remove listeners to avoid cross-test contamination.
  test.afterEach(async ({ page }) => {
    // Remove all listeners attached to the page for clean-up
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('S0_Idle entry action "renderPage()" should be attempted and cause a ReferenceError if not defined', async ({ page }) => {
    // This test checks that the page attempted to call renderPage() as per the FSM entry action.
    // If renderPage() is not defined in the page, we expect a ReferenceError or an error mentioning renderPage.
    // Collect evidence from pageErrors and console logs.

    // Assert that the page object exists and body is present
    const bodyHandle = await page.$('body');
    expect(bodyHandle).not.toBeNull();

    // Check for a runtime error (pageerror) that references renderPage or is a ReferenceError.
    const hasRenderPageError = pageErrors.some((err) => {
      if (!err || !err.message) return false;
      return /renderPage|ReferenceError|is not defined/.test(err.message);
    });

    // Also check console messages for similar error hints
    const consoleIndicatesError = consoleMessages.some((m) => /renderPage|ReferenceError|is not defined/i.test(m.text));

    // We assert that at least one of these sources indicates the missing renderPage or a ReferenceError.
    expect(hasRenderPageError || consoleIndicatesError).toBeTruthy();

    // Provide a helpful failure message when neither source contained the expected evidence.
    if (!hasRenderPageError && !consoleIndicatesError) {
      // Dump captured logs to help debugging
      const consoleDump = consoleMessages.map((m) => `[${m.type}] ${m.text}`).join('\n') || '<no console messages>';
      const errorDump = pageErrors.map((e) => e && e.message ? e.message : String(e)).join('\n') || '<no page errors>';
      throw new Error(`Expected a ReferenceError or mention of renderPage, but none found.\nConsole:\n${consoleDump}\nPageErrors:\n${errorDump}`);
    }
  });

  test('Verify that no interactive components (buttons/inputs/selects/textareas) are present as per FSM extraction', async ({ page }) => {
    // FSM extraction summary reported no interactive elements. Validate the DOM for common interactive tags.
    const interactiveCount = await page.evaluate(() => {
      const selectors = ['button', 'input', 'select', 'textarea', '[role="button"]', 'a[href]'];
      // Count elements that are typically interactive. We do not modify the page.
      return selectors.reduce((acc, s) => acc + document.querySelectorAll(s).length, 0);
    });

    // The FSM reported 0 detected components. We assert there are no common interactive elements.
    expect(interactiveCount).toBe(0);
  });

  test('Assert that the global function "renderPage" is not defined on the window (so calling it would produce a ReferenceError)', async ({ page }) => {
    // Evaluate typeof window.renderPage without creating it or modifying the page.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    // If the function is not defined, typeof should be 'undefined' which aligns with the expected ReferenceError.
    expect(renderPageType).toBe('undefined');
  });

  test('Console logs should include at least one error-like entry if the page attempted invalid JS operations', async () => {
    // This test relies only on the captured consoleMessages array populated in beforeEach.
    // We consider messages of type 'error' to be strong indicators of runtime problems.
    const errorTypeMessages = consoleMessages.filter((m) => m.type === 'error' || /error/i.test(m.text));
    // We expect at least one error-like console message given that the page's entry action likely failed.
    expect(errorTypeMessages.length).toBeGreaterThan(0);
  });

  test('Edge case: ensure page loads and DOM content is reachable even when entry action fails', async ({ page }) => {
    // Even if renderPage() caused an error, the document should be in a reachable state.
    // Check that document.readyState is one of the acceptable states and that we can query the title/body.
    const readyState = await page.evaluate(() => document.readyState);
    expect(['loading', 'interactive', 'complete']).toContain(readyState);

    const title = await page.title();
    // Title can be empty string, but the call should succeed and return a string.
    expect(typeof title).toBe('string');

    const bodyText = await page.evaluate(() => document.body ? document.body.innerText : null);
    expect(bodyText === null || typeof bodyText === 'string').toBeTruthy();
  });

  test('Failure diagnostic: if no errors are present, fail with captured console dump to highlight discrepancy', async () => {
    // This test enforces that we must see errors (per instructions). If none were captured, fail and print logs.
    if (pageErrors.length === 0 && consoleMessages.every((m) => !/error|referenceerror|is not defined|renderPage/i.test(m.text))) {
      const consoleDump = consoleMessages.map((m) => `[${m.type}] ${m.text}`).join('\n') || '<no console messages>';
      throw new Error(`No runtime errors or error-like console messages were captured. Captured console messages:\n${consoleDump}`);
    }
    // If we have errors, explicitly assert that at least one pageError exists.
    expect(pageErrors.length + consoleMessages.filter((m) => /error|referenceerror|renderPage|is not defined/i.test(m.text)).length).toBeGreaterThan(0);
  });
});