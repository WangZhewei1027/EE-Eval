import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324fd0c1-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object Model for the Runtime Environment page.
 * Encapsulates selectors and common interactions to keep tests readable and maintainable.
 */
class RuntimePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showInfoBtn = page.locator('#showInfoBtn');
    this.runtimeInfo = page.locator('#runtimeInfo');
  }

  // Click the "Show Runtime Info" button
  async clickShowInfo() {
    await this.showInfoBtn.click();
  }

  // Get the text content of the runtime info <pre>
  async getRuntimeInfoText() {
    return await this.runtimeInfo.textContent();
  }

  // Wait until runtimeInfo is non-empty (InfoDisplayed state)
  async waitForInfoDisplayed(timeout = 2000) {
    await this.page.waitForFunction(() => {
      const el = document.getElementById('runtimeInfo');
      return el && el.textContent && el.textContent.trim().length > 0;
    }, null, { timeout });
  }

  // Return computed background color of the runtimeInfo element (for visual verification)
  async getRuntimeInfoBackgroundColor() {
    return await this.page.$eval('#runtimeInfo', (el) => {
      return window.getComputedStyle(el).backgroundColor;
    });
  }
}

test.describe('Runtime Environment FSM - Interactive Application', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Capture console messages and page errors for assertions and diagnostics.
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Collect console messages (type + text)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Collect unhandled page errors
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    // Small pause to allow any asynchronous page-side errors to surface before teardown.
    await page.waitForTimeout(50);
    // Optionally, you could log consoleMessages/pageErrors to stdout when debugging.
  });

  test('Initial Idle state: button exists and runtime info is empty', async ({ page }) => {
    // This test validates the S0_Idle state: renderPage() entry action was claimed by FSM,
    // but the actual HTML should render the page with the button and an empty <pre>.
    const runtimePage = new RuntimePage(page);

    // Validate the Show Runtime Info button exists and has correct label
    await expect(runtimePage.showInfoBtn).toBeVisible();
    await expect(runtimePage.showInfoBtn).toHaveText('Show Runtime Info');

    // Validate the runtimeInfo pre exists and is empty on initial render
    const initialText = await runtimePage.getRuntimeInfoText();
    expect(typeof initialText).toBe('string');
    // Should be empty string or only whitespace initially
    expect(initialText.trim()).toBe('');

    // Visual check: runtimeInfo has the expected background color as defined in the CSS (#eee)
    const bgColor = await runtimePage.getRuntimeInfoBackgroundColor();
    // '#eee' should be computed to 'rgb(238, 238, 238)'
    expect(bgColor).toBe('rgb(238, 238, 238)');

    // At this point, no unhandled page errors should have been emitted
    expect(pageErrors.length).toBe(0);
  });

  test('Clicking Show Runtime Info transitions to InfoDisplayed and displays JSON runtime info', async ({ page }) => {
    // This test validates the ShowInfo event and the S1_InfoDisplayed state.
    // It ensures that clicking the button updates #runtimeInfo with formatted JSON including the expected keys.
    const runtimePage1 = new RuntimePage(page);

    // Click the button to trigger the transition
    await runtimePage.clickShowInfo();

    // Wait for the runtimeInfo to be populated
    await runtimePage.waitForInfoDisplayed();

    // Get the text and validate it is JSON with expected keys
    const infoText = await runtimePage.getRuntimeInfoText();
    expect(infoText).toBeTruthy();
    // It should be formatted JSON with newlines and indentation (JSON.stringify(..., null, 2))
    expect(infoText.startsWith('{\n')).toBe(true);

    // Parse the JSON and assert expected properties exist
    let parsed;
    try {
      parsed = JSON.parse(infoText);
    } catch (e) {
      parsed = null;
    }
    expect(parsed).not.toBeNull();
    // Expected keys as per implementation
    expect(Object.prototype.hasOwnProperty.call(parsed, 'User Agent')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(parsed, 'Platform')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(parsed, 'Language')).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(parsed, 'Online Status')).toBe(true);

    // Validate types: User Agent, Platform, Language are strings; Online Status is boolean
    expect(typeof parsed['User Agent']).toBe('string');
    expect(typeof parsed['Platform']).toBe('string');
    expect(typeof parsed['Language']).toBe('string');
    // Online Status may be boolean or something convertible; assert boolean
    expect(typeof parsed['Online Status'] === 'boolean' || typeof parsed['Online Status'] === 'string').toBe(true);

    // Clicking the button again should update / re-render the info (idempotent update).
    const beforeSecondClick = await runtimePage.getRuntimeInfoText();
    await runtimePage.clickShowInfo();
    await runtimePage.waitForInfoDisplayed();
    const afterSecondClick = await runtimePage.getRuntimeInfoText();
    expect(afterSecondClick).toBeTruthy();
    // It's acceptable if content stays the same; at minimum, it should still be valid JSON and non-empty
    expect(() => JSON.parse(afterSecondClick)).not.toThrow();

    // Ensure there were no uncaught page errors triggered by the click handler
    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry action renderPage() is mentioned in metadata but is not defined in the page - calling it causes ReferenceError', async ({ page }) => {
    // The FSM definition listed an entry action "renderPage()". The page implementation does not define renderPage.
    // Per instructions, we must NOT patch the page. Instead, we observe the runtime and assert that invoking renderPage
    // results in a ReferenceError in the page context.
    //
    // We intentionally call renderPage inside page.evaluate and assert that the promise rejects with a ReferenceError.

    // Note: This will cause page.evaluate to reject; we assert the rejection and that the message indicates renderPage is not defined.
    const callRenderPage = page.evaluate(() => {
      // This will throw in the page context if renderPage is undefined
      // We do not catch it here so the evaluate() promise rejects.
      // eslint-disable-next-line no-undef
      return renderPage();
    });

    // Expect the evaluation to reject due to ReferenceError (renderPage is not defined)
    await expect(callRenderPage).rejects.toThrow(/renderPage is not defined|ReferenceError/);
    // Also ensure that such an attempt did not create other uncaught errors beyond the expected reject.
    // pageErrors may or may not include this thrown error depending on how the browser surfaces it;
    // we assert that if a pageError was recorded, it is an Error instance.
    for (const err of pageErrors) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  test('Edge cases: querying non-existent elements and ensuring robust behavior', async ({ page }) => {
    // This test exercises edge cases:
    // - Querying a non-existent selector should return null
    // - The page should handle multiple rapid clicks without throwing page errors
    const runtimePage2 = new RuntimePage(page);

    // Query non-existent element
    const nonExistent = await page.$('#nonExistentSelector_does_not_exist');
    expect(nonExistent).toBeNull();

    // Rapidly click the show info button multiple times to ensure no race-condition errors
    await runtimePage.showInfoBtn.click();
    await runtimePage.showInfoBtn.click();
    await runtimePage.showInfoBtn.click();

    // Wait for info to be displayed after rapid clicks
    await runtimePage.waitForInfoDisplayed(1000);

    // Validate that content is still valid JSON
    const text = await runtimePage.getRuntimeInfoText();
    expect(text).toBeTruthy();
    expect(() => JSON.parse(text)).not.toThrow();

    // Ensure no unhandled errors were recorded
    expect(pageErrors.length).toBe(0);
  });

  test('Observes console messages and page errors during normal usage (diagnostic)', async ({ page }) => {
    // This diagnostic test ensures we can capture console messages and page errors while interacting.
    // It verifies that normal usage does not produce console.error messages or unhandled page errors.
    const runtimePage3 = new RuntimePage(page);

    // Clear any previously captured messages for a clean check
    consoleMessages = [];
    pageErrors = [];

    // Perform an interaction
    await runtimePage.clickShowInfo();
    await runtimePage.waitForInfoDisplayed();

    // Inspect captured console messages for errors or warnings
    const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning');
    // Expect no console warnings or errors in normal usage
    expect(errorConsoleEntries.length).toBe(0);

    // Expect no unhandled page errors
    expect(pageErrors.length).toBe(0);

    // For completeness ensure there was at least one console message captured (browsers may not log anything)
    // We do not assert that consoleMessages.length > 0 because different browsers/environments may vary.
  });
});