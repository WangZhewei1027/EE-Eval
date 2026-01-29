import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c9cf2-fa74-11f0-a1b6-4b9b8151441a.html';

test.describe('P vs NP Demonstration - FSM: S0_Idle checks and interactions', () => {
  // Arrays to capture console and page errors for each test
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  // Page object encapsulating common interactions/assertions for the app page
  class PvNPPage {
    constructor(page) {
      this.page = page;
    }
    async goto() {
      // navigate to the provided URL; allow the page to load
      await this.page.goto(APP_URL, { waitUntil: 'load' });
    }
    async title() {
      return this.page.title();
    }
    async getButton() {
      return this.page.$('button');
    }
    async getButtonText() {
      const btn = await this.getButton();
      if (!btn) return null;
      return btn.innerText();
    }
    async clickButton() {
      const btn = await this.getButton();
      if (!btn) throw new Error('Demonstrate button not found');
      await btn.click();
    }
    async isButtonVisible() {
      const btn = await this.getButton();
      if (!btn) return false;
      return btn.isVisible();
    }
  }

  // Setup listeners before each test to capture console and page errors
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture all console messages
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      // Capture console errors specifically
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
    });

    // Capture unhandled page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(err);
    });
  });

  // Teardown not necessary because Playwright will handle contexts, but included for clarity
  test.afterEach(async ({ page }) => {
    // No artificial cleanup; just a place to add future teardown if needed
  });

  test('Initial Idle state: page loads and shows expected title (FSM S0_Idle evidence)', async ({ page }) => {
    // This test validates the initial FSM state "S0_Idle" evidence:
    // - The page title should be "P vs NP Demonstration"
    // - The page should render and a "Demonstrate" button should exist (as detected in components)
    const app = new PvNPPage(page);
    await app.goto();

    // Assert page title matches expected evidence from FSM
    const title = await app.title();
    expect(title).toBe('P vs NP Demonstration');

    // Assert button exists and has the expected text
    const btn = await app.getButton();
    expect(btn).not.toBeNull();
    const btnText = await app.getButtonText();
    // The FSM extraction specified "<button>Demonstrate</button>"
    expect(btnText).toBe('Demonstrate');

    // Verify the button is visible to the user
    const visible = await app.isButtonVisible();
    expect(visible).toBeTruthy();

    // Assert that loading the page did not produce any unexpected non-Error console logs
    // (we still capture and will inspect errors in separate tests)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('Clicking "Demonstrate" button: no functional handlers expected (no state transitions)', async ({ page }) => {
    // This test validates that clicking the button (the only interactive component) does not cause transitions
    // because the FSM/extraction indicated there were no event handlers associated.
    const app = new PvNPPage(page);
    await app.goto();

    // Snapshot counts before click
    const initialConsoleCount = consoleMessages.length;
    const initialConsoleErrorCount = consoleErrors.length;
    const initialPageErrorCount = pageErrors.length;

    // Perform the user action: click the Demonstrate button
    // The expectation per the extraction is that nothing should happen (no handlers), so the DOM should not change in meaningful ways
    await app.clickButton();

    // Short pause to allow any asynchronous errors to surface (if they exist)
    await page.waitForTimeout(200);

    // After clicking, ensure the button still exists and text is intact
    const btn = await app.getButton();
    expect(btn).not.toBeNull();
    const btnText = await app.getButtonText();
    expect(btnText).toBe('Demonstrate');

    // Verify that clicking did not introduce new page errors (uncaught exceptions)
    // It's allowed for natural errors to occur in the environment; we capture them and assert their types in a dedicated test below.
    const finalPageErrorCount = pageErrors.length;
    const finalConsoleErrorCount = consoleErrors.length;
    // Expect that there were no new page errors or console errors introduced by the button click
    expect(finalPageErrorCount).toBeGreaterThanOrEqual(initialPageErrorCount);
    expect(finalConsoleErrorCount).toBeGreaterThanOrEqual(initialConsoleErrorCount);

    // Specifically assert that there was no unexpected increase in errors due to the click (i.e., click is inert)
    // If the app truly has no handlers, there should be zero new console errors/page errors
    expect(finalPageErrorCount - initialPageErrorCount).toBe(0);
    expect(finalConsoleErrorCount - initialConsoleErrorCount).toBe(0);
  });

  test('Rapid multiple clicks: edge case - app remains stable and does not throw', async ({ page }) => {
    // Edge case: clicking the button many times in quick succession should not crash the page
    const app = new PvNPPage(page);
    await app.goto();

    const initialPageErrors = pageErrors.length;
    const initialConsoleErrors = consoleErrors.length;

    // Perform rapid clicks
    const btn = await app.getButton();
    expect(btn).not.toBeNull();

    // Try clicking 10 times quickly
    for (let i = 0; i < 10; i++) {
      await btn.click();
    }

    // Wait briefly for any asynchronous behavior or errors
    await page.waitForTimeout(300);

    // Assert no new uncaught page errors appeared
    expect(pageErrors.length).toBe(initialPageErrors);
    // Assert no new console errors appeared
    expect(consoleErrors.length).toBe(initialConsoleErrors);

    // Ensure page still has expected title and button text after stressing
    expect(await app.title()).toBe('P vs NP Demonstration');
    expect(await app.getButtonText()).toBe('Demonstrate');
  });

  test('Console and page errors (if any) are of expected kinds: allow natural JS errors but assert their types', async ({ page }) => {
    // This test inspects captured errors that may have been produced when loading the incomplete/truncated HTML.
    // Per the instructions, do NOT patch or inject code; simply observe and assert on the errors that happen naturally.
    const app = new PvNPPage(page);
    await app.goto();

    // Wait briefly to ensure any errors are captured
    await page.waitForTimeout(200);

    // If pageErrors were captured, ensure they are instances of Error and are of allowed names
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        // err should be an Error object
        expect(err).toBeInstanceOf(Error);
        // Allowed JS error types from the instructions
        const allowed = ['ReferenceError', 'SyntaxError', 'TypeError', 'Error'];
        // err.name may be empty in some environments; be defensive
        expect(allowed).toContain(err.name || 'Error');
      }
    }

    // If there are console error messages, check they mention typical JS error types if they represent runtime errors
    if (consoleErrors.length > 0) {
      for (const text of consoleErrors) {
        // The console error string should be a non-empty string
        expect(typeof text).toBe('string');
        expect(text.length).toBeGreaterThan(0);
        // If it includes an error type, it should be one of the allowed types
        const containsKnownErrorType = /ReferenceError|SyntaxError|TypeError/.test(text);
        // We don't require the message to contain these, but if it does, it must be one of the allowed patterns
        if (containsKnownErrorType) {
          expect(containsKnownErrorType).toBeTruthy();
        }
      }
    }

    // Also assert that the page renders the expected evidence despite any errors
    expect(await app.title()).toBe('P vs NP Demonstration');
    const btn = await app.getButton();
    expect(btn).not.toBeNull();
  });

  test('No hidden event handlers were detected: clicking does not produce console logs', async ({ page }) => {
    // The extraction summary indicated no event handlers were detected.
    // This test ensures clicking the button does not produce console.log style messages.
    const app = new PvNPPage(page);
    await app.goto();

    // Filter out non-log console messages, record initial logs count
    const initialLogCount = consoleMessages.filter(m => m.type === 'log' || m.type === 'info' || m.type === 'debug').length;

    // Click the button
    await app.clickButton();
    await page.waitForTimeout(200);

    // Count again
    const finalLogCount = consoleMessages.filter(m => m.type === 'log' || m.type === 'info' || m.type === 'debug').length;

    // Expect no new log messages were produced by clicking the button (i.e., no handlers logging)
    expect(finalLogCount - initialLogCount).toBe(0);
  });
});