import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520b69d0-fa76-11f0-a09b-87751f540fd8.html';

// Page Object for the Static Typing Example page
class StaticTypingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Return the main container element handle
  async container() {
    return this.page.locator('#container');
  }

  // Get the text content of the main heading
  async headingText() {
    return this.page.locator('#container h1').textContent();
  }

  // Get an array of paragraph texts inside the container
  async paragraphTexts() {
    const paragraphs = this.page.locator('#container p');
    const count = await paragraphs.count();
    const texts = [];
    for (let i = 0; i < count; i++) {
      texts.push((await paragraphs.nth(i).textContent()).trim());
    }
    return texts;
  }

  // Count interactive elements inside the container (buttons, inputs, links, selects, textareas)
  async interactiveElementCount() {
    return this.page.locator('#container').locator('button, input, select, textarea, a').count();
  }

  // Utility to attempt calling a global function by name in page context and return any thrown error info
  async callGlobalFunctionAndCatchError(functionName) {
    return this.page.evaluate((fnName) => {
      try {
        // Attempt to call the function. If it doesn't exist, this will naturally throw a ReferenceError.
        // We purposely don't define the function - we want to observe the natural error.
        // This error is captured and returned so tests can assert on it without creating an uncaught pageerror.
        const result = window[fnName]();
        return { ok: true, result };
      } catch (e) {
        return { ok: false, errorName: e.name, errorMessage: e.toString() };
      }
    }, functionName);
  }
}

test.describe('Static Typing Example - FSM S0_Idle', () => {
  // Shared collectors for console messages and page errors per test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console events (logs, warnings, errors, etc.)
    page.on('console', (msg) => {
      // Normalize text to make assertions robust
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('Idle state renders expected static content (FSM evidence)', async ({ page }) => {
    // This test validates the S0 Idle state's evidence from the FSM:
    // - The page renders the heading and paragraphs present in the HTML implementation.
    const app = new StaticTypingPage(page);

    // Verify heading text
    const heading = (await app.headingText()).trim();
    expect(heading).toBe('Static Typing Example');

    // Verify paragraphs - FSM evidence lists two paragraph strings
    const paragraphs1 = await app.paragraphTexts();
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    expect(paragraphs).toContain('This is a static typing example.');
    // Note: The HTML contains a second paragraph "This paragraph will not be rendered."
    // The FSM evidence mentioned it as well; here we assert it exists in the DOM as implemented.
    expect(paragraphs).toContain('This paragraph will not be rendered.');
  });

  test('No interactive elements or event handlers exist as per extraction notes', async ({ page }) => {
    // This test asserts there are no interactive elements inside the main container.
    const app1 = new StaticTypingPage(page);

    const interactiveCount = await app.interactiveElementCount();
    expect(interactiveCount).toBe(0);

    // Attempting to interact (click) the container should not navigate or change URL because there are no handlers.
    const beforeUrl = page.url();
    await (await app.container()).click();
    const afterUrl = page.url();
    expect(afterUrl).toBe(beforeUrl);
  });

  test('Script logs the greeting "Hello, John!" to the console', async ({ page }) => {
    // Validate that the inline script executed and produced the expected console.log output.
    // The page's script calls console.log(greet("John"));
    // We collected console messages in beforeEach; find the log entry.
    const found = consoleMessages.find((m) => m.type === 'log' && m.text.includes('Hello, John!'));
    expect(found).toBeTruthy();
  });

  test('No uncaught runtime errors occurred during page load', async ({ page }) => {
    // Ensure that there were no uncaught page errors during load.
    // If the page had runtime errors (ReferenceError, TypeError, etc.) that were unhandled, they'd appear here.
    expect(pageErrors.length).toBe(0);
  });

  test('Entry action renderPage() is referenced in FSM but not implemented on page -> calling it causes a ReferenceError', async ({ page }) => {
    // The FSM entry_actions mention renderPage(). The implementation does not define renderPage.
    // We intentionally attempt to call it in-page and assert that this produces a ReferenceError.
    // We capture the error via evaluate so it does not surface as an uncaught page error event.
    const app2 = new StaticTypingPage(page);

    const result1 = await app.callGlobalFunctionAndCatchError('renderPage');

    // We expect the call to fail (ok) and to report a ReferenceError referring to renderPage
    expect(result.ok).toBe(false);
    expect(result.errorName).toBe('ReferenceError');

    // Some engines format the message differently; assert it mentions the function name to ensure the error is about renderPage
    expect(result.errorMessage.toLowerCase()).toContain('renderpage');
  });

  test('Edge case: querying non-existent elements returns null/empty and does not throw', async ({ page }) => {
    // Query for an element that does not exist and ensure the test handles this gracefully.
    const nonExistent = await page.locator('#container .does-not-exist').count();
    expect(nonExistent).toBe(0);

    // Accessing a missing global variable from evaluate should produce undefined rather than crash unless invoked.
    const missingGlobal = await page.evaluate(() => {
      // Do not call or dereference; simply read a property that wasn't set.
      return typeof window.__SOME_NONEXISTENT_GLOBAL__;
    });
    expect(missingGlobal).toBe('undefined');
  });

  test.afterEach(async ({ page }) => {
    // Provide helpful debug information when a test fails by asserting that console errors are empty.
    // This does not modify page state; it only inspects collected messages.
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    // For this static page we expect no console errors; it's useful to assert that.
    expect(consoleErrors.length).toBe(0);
    // No teardown necessary beyond Playwright's built-in fixtures
  });
});