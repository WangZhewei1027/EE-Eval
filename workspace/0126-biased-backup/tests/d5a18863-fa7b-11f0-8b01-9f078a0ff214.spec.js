import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a18863-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object Model for the Recursion demo page
class RecursionPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleErrors = [];
    this.pageErrors = [];
    this.consoleMessages = [];

    // Listen to console events and page errors to observe runtime issues naturally
    this.page.on('console', (msg) => {
      // Capture all console messages for inspection; categorize errors separately
      const text = msg.text();
      this.consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') {
        this.consoleErrors.push(text);
      }
    });

    this.page.on('pageerror', (err) => {
      // pageerror events capture unhandled exceptions (ReferenceError, TypeError, etc.)
      this.pageErrors.push(err && err.message ? err.message : String(err));
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  getShowButtonLocator() {
    return this.page.locator('button[onclick="document.getElementById(\'demo\').style.display=\'block\';"]');
  }

  getDemoLocator() {
    return this.page.locator('#demo');
  }

  async clickShowButton() {
    const btn = this.getShowButtonLocator();
    await expect(btn).toBeVisible(); // ensure button is visible before clicking
    await btn.click();
  }

  // Returns 'display' computed style, e.g., 'none' or 'block'
  async demoDisplayStyle() {
    return await this.page.$eval('#demo', (el) => window.getComputedStyle(el).display);
  }

  // Returns captured console errors
  getConsoleErrors() {
    return this.consoleErrors;
  }

  // Returns captured page errors (unhandled exceptions)
  getPageErrors() {
    return this.pageErrors;
  }

  // Returns all console messages recorded
  getConsoleMessages() {
    return this.consoleMessages;
  }
}

test.describe('Understanding Recursion Demo - FSM validation', () => {
  // Provide a fresh RecursionPage for each test
  test.beforeEach(async ({ page }) => {
    // No-op here; individual tests will create RecursionPage instances and navigate
  });

  test('S0_Idle: initial state should render page and show the "Show Factorial Demo" button', async ({ page }) => {
    // This test validates the Idle state (S0_Idle)
    // It asserts that the page is loaded, main content is present, the demo is hidden,
    // and the expected button with the inline onclick attribute exists.
    const rp = new RecursionPage(page);
    await rp.goto();

    // Validate basic page content exists (title and header)
    await expect(page).toHaveTitle(/Understanding Recursion/i);
    await expect(page.locator('h1')).toHaveText(/Understanding Recursion/i);

    // Validate the Show Factorial Demo button exists and has the expected inline onclick attribute
    const showBtn = rp.getShowButtonLocator();
    await expect(showBtn).toBeVisible();
    await expect(showBtn).toHaveText('Show Factorial Demo');
    await expect(showBtn).toHaveAttribute('onclick', "document.getElementById('demo').style.display='block';");

    // Validate that #demo exists but is not visible (display: none)
    const demo = rp.getDemoLocator();
    await expect(demo).toBeAttached();
    const displayBefore = await rp.demoDisplayStyle();
    expect(displayBefore).toBe('none');

    // Verify that there are no uncaught page errors or console errors on initial load.
    // We observe runtime errors naturally and assert none occurred.
    // Note: Per instructions we only observe and assert; we do NOT patch page code.
    expect(rp.getConsoleErrors().length).toBe(0);
    expect(rp.getPageErrors().length).toBe(0);
  });

  test('Transition ShowDemo: clicking the button displays #demo and enters S1_DemoVisible', async ({ page }) => {
    // This test verifies the FSM transition from S0_Idle -> S1_DemoVisible via ShowDemo (click).
    // It asserts that clicking the inline-onclick button sets #demo style to block and shows expected content.
    const rp = new RecursionPage(page);
    await rp.goto();

    // Click to trigger the transition/event
    await rp.clickShowButton();

    // After clicking, the demo should be displayed (display != 'none', specifically 'block')
    const displayAfter = await rp.demoDisplayStyle();
    expect(displayAfter === 'block' || displayAfter === 'inline' || displayAfter === 'flex').toBeTruthy();

    // Verify the header inside the demo is present and contains expected text
    await expect(rp.getDemoLocator().locator('h3')).toHaveText(/Factorial Recursive Call Tree/i);

    // Verify the demo preformatted content contains "factorial(5)" as evidence of the call tree
    await expect(rp.getDemoLocator().locator('pre')).toContainText('factorial(5)');

    // Ensure the button remains present and functional; clicking again should keep demo visible
    await rp.clickShowButton(); // second click should be idempotent given inline code just sets display='block'
    const displayAfterSecondClick = await rp.demoDisplayStyle();
    expect(displayAfterSecondClick === 'block' || displayAfterSecondClick === 'inline' || displayAfterSecondClick === 'flex').toBeTruthy();

    // Confirm there are still no console errors or unhandled exceptions produced by this interaction
    expect(rp.getConsoleErrors().length).toBe(0);
    expect(rp.getPageErrors().length).toBe(0);
  });

  test('Edge case: rapid repeated clicks do not cause exceptions and #demo remains visible', async ({ page }) => {
    // This test simulates a user rapidly clicking the Show Factorial Demo button multiple times
    // to ensure the transition is stable and no runtime errors occur.
    const rp = new RecursionPage(page);
    await rp.goto();

    const btn = rp.getShowButtonLocator();
    await expect(btn).toBeVisible();

    // Rapid clicks
    await Promise.all([
      btn.click(),
      btn.click(),
      btn.click(),
      btn.click()
    ]);

    // After rapid clicks, #demo must be visible
    const display = await rp.demoDisplayStyle();
    expect(display === 'block' || display === 'inline' || display === 'flex').toBeTruthy();

    // Inspect console and page errors captured during rapid interactions
    const consoleErrors = rp.getConsoleErrors();
    const pageErrors = rp.getPageErrors();

    // Assert there are no console errors (e.g., TypeError, ReferenceError) resulting from rapid clicks
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);

    // As additional validation, ensure the demo content still contains the factorial tree snippet
    await expect(rp.getDemoLocator().locator('pre')).toContainText('factorial(5)');
  });

  test('FSM metadata validation and entry-action observation: no missing onEnter implementation causing ReferenceError', async ({ page }) => {
    // The FSM listed an entry action "renderPage()" for S0_Idle.
    // We do not modify the page. We observe the runtime to see if a ReferenceError was thrown because renderPage() is missing.
    // If the page author did invoke renderPage() and it was missing, a ReferenceError would appear in page errors.
    // We assert that no such ReferenceError (or similar) occurred.
    const rp = new RecursionPage(page);
    await rp.goto();

    // Collect any page errors and console errors that mention typical missing-function errors.
    const pageErrors = rp.getPageErrors();
    const consoleErrors = rp.getConsoleErrors();

    // Check for presence of "renderPage" mention in errors (which would indicate an attempt to call it)
    const mentionsRenderPage = pageErrors.concat(consoleErrors).some((msg) => String(msg).includes('renderPage'));

    // Assert that renderPage was not reported missing (i.e., no error message mentions it).
    // If an error did mention renderPage, it indicates the page attempted to call it and failed; the test will fail here.
    expect(mentionsRenderPage).toBeFalsy();

    // Also assert there are no generic unhandled exceptions of the categories of interest
    const hasReferenceError = pageErrors.concat(consoleErrors).some((msg) => String(msg).includes('ReferenceError'));
    const hasTypeError = pageErrors.concat(consoleErrors).some((msg) => String(msg).includes('TypeError'));
    const hasSyntaxError = pageErrors.concat(consoleErrors).some((msg) => String(msg).includes('SyntaxError'));

    // Expect none of these standard runtime exceptions to have occurred during page load
    expect(hasReferenceError).toBeFalsy();
    expect(hasTypeError).toBeFalsy();
    expect(hasSyntaxError).toBeFalsy();
  });

  test('Observability: capture and report console output and page errors (if any) for diagnostics', async ({ page }) => {
    // This test intentionally gathers console messages and page errors and asserts on their structure.
    // It does not assume errors must exist; it verifies that we can observe them and that they conform to expectations.
    const rp = new RecursionPage(page);
    await rp.goto();

    // Trigger demo visibility to possibly surface any lazy-evaluated errors
    await rp.clickShowButton();

    // Wait briefly for any async console messages or errors to appear
    await page.waitForTimeout(200); // small pause to allow any console messages to flush

    const consoleMessages = rp.getConsoleMessages();
    const pageErrors = rp.getPageErrors();

    // Basic expectations about captured logs:
    // - consoleMessages is an array of objects with 'type' and 'text'
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    for (const msg of consoleMessages) {
      expect(msg).toHaveProperty('type');
      expect(msg).toHaveProperty('text');
    }

    // For this application we expect no unhandled exceptions; assert that pageErrors length is zero.
    // If there are errors, include them in the assertion message to aid debugging.
    expect(pageErrors.length, `Unexpected page errors: ${JSON.stringify(pageErrors)}`).toBe(0);

    // Also assert there are no console 'error' type messages
    const consoleErrorCount = consoleMessages.filter((m) => m.type === 'error').length;
    expect(consoleErrorCount, `Unexpected console errors: ${JSON.stringify(consoleMessages.filter((m) => m.type === 'error'))}`).toBe(0);
  });
});