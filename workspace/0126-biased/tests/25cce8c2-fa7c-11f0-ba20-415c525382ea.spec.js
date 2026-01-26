import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cce8c2-fa7c-11f0-ba20-415c525382ea.html';

// Page object model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.fetchBtn = page.locator('#fetchUserBtn');
    this.result = page.locator('#demoResult');
  }

  async goto() {
    // Navigate to the page and ensure the main content has loaded
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await expect(this.page).toHaveTitle(/Comprehensive Guide to REST API/);
  }

  async clickFetch() {
    await this.fetchBtn.click();
  }

  async getResultText() {
    // Return trimmed text content (normalize whitespace)
    const text = await this.result.textContent();
    return text === null ? '' : text.trim();
  }

  async waitForFetchingMessage(timeout = 1000) {
    // Wait until the fetching message appears
    await expect(this.result).toHaveText('Fetching user resource #10...', { timeout });
  }

  async waitForJsonResult(timeout = 3000) {
    // Wait until the result looks like JSON (starts with "{" or "[")
    await this.page.waitForFunction(() => {
      const el = document.getElementById('demoResult');
      if (!el) return false;
      const txt = el.textContent ? el.textContent.trim() : '';
      return txt.startsWith('{') || txt.startsWith('[');
    }, null, { timeout });
    return this.getResultText();
  }
}

test.describe('REST API demo FSM (Application ID: 25cce8c2-fa7c-11f0-ba20-415c525382ea)', () => {
  /** @type {import('@playwright/test').Page} */
  let page;
  /** @type {Array<Error>} */
  let pageErrors;
  /** @type {Array<import('@playwright/test').ConsoleMessage>} */
  let consoleMessages;

  test.beforeEach(async ({ browser }) => {
    // Create a fresh context+page per test to isolate console/err handlers
    const context = await browser.newContext();
    page = await context.newPage();

    pageErrors = [];
    consoleMessages = [];

    // Capture page runtime errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      // Collect but do not modify runtime behavior
      pageErrors.push(err);
    });

    // Capture console messages for inspection
    page.on('console', (msg) => {
      consoleMessages.push(msg);
    });

    // Navigate to the app
    const demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // If there were any page errors, log them to make debugging easier in CI logs.
    if (pageErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.error('Captured page errors:', pageErrors);
    }
    if (consoleMessages.length > 0) {
      // eslint-disable-next-line no-console
      console.log(
        'Captured console messages:',
        consoleMessages.map((m) => ({ type: m.type(), text: m.text() })),
      );
    }

    // Assert there were no unexpected runtime errors unless a test specifically expects them.
    // Most tests in this suite expect the page to run without ReferenceError/SyntaxError/TypeError.
    expect(pageErrors.length).toBe(0);
    // Close the page's context to clean up.
    await page.context().close();
  });

  test('Initial Idle state (S0_Idle) renders the button and initial message', async () => {
    // This test validates the S0_Idle state's evidence:
    // - The button with id #fetchUserBtn should exist and be visible with the correct text.
    // - The result element #demoResult should have the initial instructional text and correct ARIA attributes.
    const demo = new DemoPage(page);

    // Button checks
    await expect(demo.fetchBtn).toBeVisible();
    await expect(demo.fetchBtn).toHaveText('Fetch User #10');

    // Initial demoResult checks
    const initialText = await demo.getResultText();
    expect(initialText).toContain('Click the button above to simulate fetching a user resource.');

    // Verify ARIA attributes as part of the visual component contract
    const ariaLive = await page.locator('#demoResult').getAttribute('aria-live');
    const ariaAtomic = await page.locator('#demoResult').getAttribute('aria-atomic');
    expect(ariaLive).toBe('polite');
    expect(ariaAtomic).toBe('true');
  });

  test('Transition S0_Idle -> S1_Fetching when button clicked (FetchUser event)', async () => {
    // This test validates the transition from Idle to Fetching:
    // - Clicking the button triggers the immediate "Fetching user resource #10..." message.
    const demo = new DemoPage(page);

    await demo.clickFetch();

    // The FSM's transition action displayFetchingMessage() should set this text immediately.
    await demo.waitForFetchingMessage();

    // Ensure no runtime errors occurred as a result of the click
    expect(pageErrors.length).toBe(0);
  });

  test('Transition S1_Fetching -> S2_UserFetched: after delay JSON is displayed', async () => {
    // This test validates the transition from Fetching to UserFecthed:
    // - After clicking, following the simulated network delay, the formatted JSON for the user should appear.
    const demo = new DemoPage(page);

    await demo.clickFetch();

    // Verify fetching message first
    await demo.waitForFetchingMessage();

    // Then wait for the JSON result to appear (script uses a 1000ms timeout)
    const resultText = await demo.waitForJsonResult(3000); // allow some margin

    // The page sets JSON.stringify(simulatedResponse, null, 2)
    // Parse the JSON and assert expected properties exist and are correct.
    let parsed;
    try {
      parsed = JSON.parse(resultText);
    } catch (e) {
      // If parsing fails, make the test fail with helpful message
      throw new Error(`Expected JSON in #demoResult but got:\n${resultText}`);
    }

    expect(parsed).toBeTruthy();
    expect(parsed.id).toBe(10);
    expect(parsed.username).toBe('rest_user');
    expect(parsed.email).toBe('rest.user@example.com');
    expect(parsed.name).toBe('REST API User');
    expect(Array.isArray(parsed.roles)).toBe(true);
    expect(parsed.roles).toEqual(expect.arrayContaining(['user', 'editor']));
    expect(parsed.created_at).toBe('2021-11-15T14:25:00Z');

    // Confirm that the textual representation indeed includes formatted JSON (multiple lines)
    // The page uses JSON.stringify with indentation; expect at least one newline in the displayed text.
    expect(resultText).toContain('\n');
  });

  test('Edge case: rapid repeated clicks should still result in correct final JSON (concurrent transitions)', async () => {
    // This test explores an edge case: the user clicks multiple times quickly.
    // The implementation uses setTimeout to update the result; multiple scheduled updates should
    // still result in the correct final JSON payload being displayed.
    const demo = new DemoPage(page);

    // Click twice rapidly to schedule multiple timeouts
    await demo.clickFetch();
    // Small micro-delay to simulate a fast second click
    await page.waitForTimeout(50);
    await demo.clickFetch();

    // After clicks, the fetching message should be shown (most recent click will set it again)
    await demo.waitForFetchingMessage();

    // Wait for the JSON to settle; even if multiple timeouts run, the final state should be the JSON object
    const finalText = await demo.waitForJsonResult(4000);
    let parsed;
    try {
      parsed = JSON.parse(finalText);
    } catch (e) {
      throw new Error(`Expected JSON after repeated clicks but got:\n${finalText}`);
    }

    expect(parsed.id).toBe(10);
    expect(parsed.username).toBe('rest_user');

    // Ensure there are no page runtime errors resulting from multiple clicks
    expect(pageErrors.length).toBe(0);
  });

  test('Visual and accessibility checks for the result component (S0/S1/S2 evidence)', async () => {
    // This test verifies visual/DOM evidence the FSM describes:
    // - Styles are applied to #demoResult (background-color / border exist)
    // - The pre element uses monospace font and has white-space configured to preserve formatting
    const demoResult = page.locator('#demoResult');

    // Check some computed style properties exist and are reasonable (not asserting exact color values across environments)
    const bgColor = await demoResult.evaluate((el) => window.getComputedStyle(el).backgroundColor);
    const borderStyle = await demoResult.evaluate((el) => window.getComputedStyle(el).borderStyle);
    const whiteSpace = await demoResult.evaluate((el) => window.getComputedStyle(el).whiteSpace);
    expect(bgColor).toBeTruthy();
    expect(borderStyle).toContain('solid');
    // The CSS sets white-space: pre-wrap; ensure whitespace behavior will preserve JSON formatting
    expect(['pre-wrap', 'pre', 'pre-line', 'normal']).toContain(whiteSpace);

    // Confirm the element is announced politely (aria-live) - attribute already checked elsewhere
    const ariaLive = await demoResult.getAttribute('aria-live');
    expect(ariaLive).toBe('polite');
  });

  test('Observability: capture console messages and ensure no unexpected console errors occur', async () => {
    // This test validates that the page does not emit console.error messages under normal use.
    // We will perform the main interaction and then inspect captured console messages.

    const demo = new DemoPage(page);
    await demo.clickFetch();
    // Wait for JSON to appear
    await demo.waitForJsonResult(3000);

    // Inspect captured console messages: ensure none are of type 'error'
    const errorConsoleMessages = consoleMessages.filter((m) => m.type() === 'error');
    // Fail the test if there are console.error messages
    expect(errorConsoleMessages.length).toBe(0);
    // Also ensure no runtime page errors were captured
    expect(pageErrors.length).toBe(0);
  });

  test('Negative/robustness: ensure missing elements would cause observable failures (intentional check)', async () => {
    // This test does not modify the page. It documents that if elements were missing,
    // interactions would throw. We assert that the current page has the expected DOM so no exceptions are thrown.
    // This is effectively a sanity check for the environment used by the FSM tests.

    // Ensure the button and result exist; if they did not, subsequent FSM tests would naturally throw errors.
    const hasButton = await page.locator('#fetchUserBtn').count();
    const hasResult = await page.locator('#demoResult').count();
    expect(hasButton).toBe(1);
    expect(hasResult).toBe(1);
  });
});