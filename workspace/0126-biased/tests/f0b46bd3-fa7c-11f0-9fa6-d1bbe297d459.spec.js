import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b46bd3-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('f0b46bd3-fa7c-11f0-9fa6-d1bbe297d459 - Comprehensive Guide to Integration Testing (FSM validation)', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (info, warning, error, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture unhandled page errors (Runtime errors)
    page.on('pageerror', (err) => {
      pageErrors.push({
        message: err.message,
        stack: err.stack,
      });
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No explicit teardown required; Playwright closes context automatically.
    // Retain captured logs in case debugging is needed in CI artifacts.
  });

  test.describe('Initial state (S0_Idle) validations', () => {
    test('Initial DOM: button exists with correct text and demo-output is hidden', async ({ page }) => {
      // Validate the presence of the button with onclick attribute
      const button = page.locator("button[onclick='showDemo()']");
      await expect(button).toHaveCount(1);
      await expect(button).toHaveText('Show Simple Integration Test Example');

      // The FSM expected an entry action "renderPage()" for S0_Idle.
      // The implementation does not define renderPage(); verify that it's not present on window.
      const renderPageType = await page.evaluate(() => {
        // Inspect whether renderPage is defined (do not call it)
        return typeof window.renderPage;
      });
      // If renderPage is not defined, typeof returns 'undefined' which is acceptable (we assert it's not a function).
      expect(renderPageType).not.toBe('function');

      // Validate #demo-output exists and is initially hidden (display: none)
      const demoOutput = page.locator('#demo-output');
      await expect(demoOutput).toHaveCount(1);

      const displayStyle = await demoOutput.evaluate((el) => {
        // Computed style is more robust than attribute
        return window.getComputedStyle(el).display;
      });
      expect(displayStyle).toBe('none');

      // Confirm that window.showDemo is available and is a function (the event handler referenced in the button)
      const showDemoType = await page.evaluate(() => typeof window.showDemo);
      expect(showDemoType).toBe('function');

      // Ensure there were no runtime page errors captured during initial load
      expect(pageErrors).toEqual([]);

      // Ensure no console errors were emitted at page load (info/warn are allowed but no 'error' type)
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe('Event: ShowDemo and transition to S1_DemoVisible', () => {
    test('Clicking the button displays the demo output with expected content (single click)', async ({ page }) => {
      const button = page.locator("button[onclick='showDemo()']");
      const demoOutput = page.locator('#demo-output');

      // Click the button to trigger the transition ShowDemo
      await button.click();

      // After clicking, #demo-output should be displayed (display != 'none' and block as implementation sets)
      await expect(demoOutput).toBeVisible();

      const displayStyleAfter = await demoOutput.evaluate((el) => window.getComputedStyle(el).display);
      expect(displayStyleAfter).toBe('block');

      // Validate that the demo output contains expected heading and descriptive content
      const html = await demoOutput.innerHTML();
      expect(html).toContain('Simple Integration Test Example');
      expect(html).toContain('Account Module');
      expect(html).toContain('Transaction Module');
      expect(html).toContain('Account Module creates an account with balance $1000');
      expect(html).toContain('Verify Account Module shows new balance of $800');

      // Validate that repeated clicks do not cause runtime exceptions and content remains consistent
      await button.click();
      await button.click();

      // Still visible and content unchanged (idempotent in this implementation)
      await expect(demoOutput).toBeVisible();
      const htmlAfterClicks = await demoOutput.innerHTML();
      expect(htmlAfterClicks).toBe(html);

      // Ensure no runtime page errors occurred during interactions
      expect(pageErrors).toEqual([]);

      // Ensure no console 'error' messages were emitted during interactions
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors).toHaveLength(0);
    });

    test('Edge case: Verify clicking when already visible keeps the element visible and content intact', async ({ page }) => {
      const button = page.locator("button[onclick='showDemo()']");
      const demoOutput = page.locator('#demo-output');

      // Make it visible first
      await button.click();
      await expect(demoOutput).toBeVisible();

      // Capture current content
      const initialContent = await demoOutput.innerHTML();

      // Click multiple times in rapid succession
      await Promise.all([button.click(), button.click(), button.click()]);

      // Ensure still visible and content unchanged
      await expect(demoOutput).toBeVisible();
      const afterRapidClicks = await demoOutput.innerHTML();
      expect(afterRapidClicks).toBe(initialContent);

      // No page errors and no console errors
      expect(pageErrors).toEqual([]);
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe('FSM actions and transitions verification', () => {
    test('Validate FSM evidence: button selector, onclick attribute and #demo-output behavior', async ({ page }) => {
      // Verify the component selectors and attributes match the FSM extraction
      const buttonHandle = await page.$("button[onclick='showDemo()']");
      expect(buttonHandle).not.toBeNull();

      // Confirm onclick attribute exact match
      const onclickAttr = await buttonHandle.getAttribute('onclick');
      expect(onclickAttr).toBe('showDemo()');

      // Confirm demo-output exists
      const demoOutputHandle = await page.$('#demo-output');
      expect(demoOutputHandle).not.toBeNull();

      // Trigger the transition and validate evidence lines: style.display = 'block' and innerHTML populated
      await page.click("button[onclick='showDemo()']");
      const displayStyleAfter = await page.$eval('#demo-output', (el) => window.getComputedStyle(el).display);
      expect(displayStyleAfter).toBe('block');

      const innerHTML = await page.$eval('#demo-output', (el) => el.innerHTML || '');
      expect(innerHTML.length).toBeGreaterThan(0);

      // No runtime errors observed
      expect(pageErrors).toEqual([]);
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors).toHaveLength(0);
    });

    test('Verify onEnter/onExit actions if present: detect presence of declared functions without invoking them', async ({ page }) => {
      // FSM listed entry action renderPage() for S0_Idle; the implementation does not define this function.
      // We assert that renderPage is not a function (safe, non-invasive check).
      const renderPageType = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageType).not.toBe('function');

      // The implementation defines showDemo; confirm its presence (entry action for S1_DemoVisible is showDemo())
      const showDemoType = await page.evaluate(() => typeof window.showDemo);
      expect(showDemoType).toBe('function');

      // Do not call renderPage (would cause ReferenceError if not present). We only check existence/non-existence.
      // Ensure no inadvertent runtime errors were recorded
      expect(pageErrors).toEqual([]);
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors).toHaveLength(0);
    });
  });

  test.describe('Console and page error observability (observing runtime problems naturally)', () => {
    test('Assert that no unexpected ReferenceError/SyntaxError/TypeError occurred during load and interactions', async ({ page }) => {
      // Interact with page to expose any latent runtime errors
      await page.click("button[onclick='showDemo()']");
      await page.click("button[onclick='showDemo()']");

      // Collect runtime page errors (if any, they were pushed into pageErrors in beforeEach handler)
      // The test requirement asks to observe console logs and page errors and assert their occurrence.
      // In this implementation there are no deliberate runtime errors, so assert that none occurred.
      expect(pageErrors.length).toBe(0);

      // Inspect console messages for error-level messages and assert none
      const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error');
      expect(errorConsoleEntries.length).toBe(0);

      // For transparency in CI logs, if there were any console messages (non-errors), they are allowed.
      // But we assert the critical runtime error categories are absent.
    });

    test('If runtime errors do occur naturally, they should be captured in pageErrors and console messages (test will fail if any are present)', async ({ page }) => {
      // This test intentionally asserts the absence of critical runtime errors but will surface any that happen naturally.
      // Trigger interactions again to ensure stability
      await page.click("button[onclick='showDemo()']");

      // Expect no page errors (ReferenceError, TypeError, etc.)
      expect(pageErrors).toEqual([]);

      // Ensure console has no 'error' entries
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors).toHaveLength(0);
    });
  });
});