import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1af73-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object Model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('button[onclick]');
    this.heading = page.locator('h1');
    this.sections = page.locator('section');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getHeadingText() {
    return this.heading.innerText();
  }

  async getNumberOfSections() {
    return this.sections.count();
  }

  async getButtonText() {
    return this.button.innerText();
  }

  async getButtonOnclickAttr() {
    return this.button.getAttribute('onclick');
  }

  // Click the demo button and wait for the dialog to appear, then accept it.
  // Returns the dialog message text.
  async clickDemoAndAcceptAlert() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.button.click(),
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }
}

test.describe('Understanding Sliding Window Technique - interactive demo', () => {
  // Arrays to capture console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (including console.error)
    page.on('console', (msg) => {
      // store type and text for later inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect unhandled page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      // capture the error message so tests can assert on it
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // detach listeners to avoid leaks between tests (Playwright will usually handle this,
    // but this is explicit - no modification of page objects is performed).
    // (No teardown actions that change page behavior are performed.)
  });

  test('Page contains expected static content and structure', async ({ page }) => {
    // Validate basic page structure and content (FSM S0_Idle evidence)
    const demo = new DemoPage(page);

    // Validate the main heading exists and contains expected text
    const headingText = await demo.getHeadingText();
    expect(headingText).toContain('Understanding the Sliding Window Technique');

    // Validate there are multiple informational sections describing the technique
    const sectionsCount = await demo.getNumberOfSections();
    expect(sectionsCount).toBeGreaterThanOrEqual(5);

    // Validate the demo button exists and has the expected visible text
    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Click for Demo');

    // Validate the button includes an inline onclick attribute that triggers the alert
    const onclickAttr = await demo.getButtonOnclickAttr();
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("alert('This is a demonstration of the sliding window concept in action!')");

    // Assert no uncaught page errors occurred during load
    // (This test observes and asserts whether errors occurred; none are expected for this HTML.)
    expect(pageErrors).toEqual([]);
  });

  test('Clicking the demo button triggers an alert with the exact expected message (FSM event: ButtonClick)', async ({ page }) => {
    // This test validates the ButtonClick event/transition: clicking the button triggers alert()
    const demo = new DemoPage(page);

    // Use waitForEvent to capture the dialog produced by the inline onclick alert
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      demo.button.click(),
    ]);

    // Validate the dialog message exactly matches the FSM evidence
    const expectedMessage = "This is a demonstration of the sliding window concept in action!";
    expect(dialog.message()).toBe(expectedMessage);

    // Accept the alert to continue
    await dialog.accept();

    // After handling the dialog ensure no page errors occurred as a result
    expect(pageErrors).toEqual([]);

    // Ensure console did not log an 'error' level message during this interaction
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Repeated clicks produce repeated alert dialogs (verifies state remains Idle and transition loops)', async ({ page }) => {
    // This test validates the transition loops S0_Idle -> S0_Idle triggered by ButtonClick repeatedly.
    const demo = new DemoPage(page);

    const expectedMessage = "This is a demonstration of the sliding window concept in action!";

    // Click multiple times and collect messages
    const captured = [];
    for (let i = 0; i < 3; i++) {
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        demo.button.click(),
      ]);
      captured.push(dialog.message());
      await dialog.accept();
    }

    // All dialog messages should equal the expected message
    expect(captured).toHaveLength(3);
    captured.forEach((msg) => expect(msg).toBe(expectedMessage));

    // Confirm no unexpected page errors were introduced during repeated interactions
    expect(pageErrors).toEqual([]);
  });

  test('Edge case: interacting with a non-existent element should raise an error (error scenario)', async ({ page }) => {
    // This test intentionally exercises an error scenario: clicking a selector that doesn't exist.
    // We assert that Playwright throws as expected (this validates the test harness behavior).
    const nonExistentLocator = page.locator('#this-element-does-not-exist');

    // Attempt to click with a short timeout and expect a rejection/throw.
    // The exact error type may be a TimeoutError thrown by Playwright.
    let threw = false;
    try {
      await nonExistentLocator.click({ timeout: 1000 });
    } catch (err) {
      threw = true;
      // Validate that the thrown error contains text consistent with Playwright timeouts / not found.
      // We don't attempt to patch or suppress the error; we only assert its occurrence and message content.
      expect(String(err.message)).toMatch(/Timeout|element/i);
    }
    expect(threw).toBe(true);
  });

  test('Observe console messages and page errors on navigation and interactions', async ({ page }) => {
    // This test collects console messages and page errors and asserts expected patterns.
    // It is intentionally permissive: we verify that console messages were captured correctly
    // and that any page errors are recorded in the pageErrors array (none expected).

    const demo = new DemoPage(page);

    // Trigger one interaction that is expected to produce a dialog (not console output)
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      demo.button.click(),
    ]);
    await dialog.accept();

    // Validate that consoleMessages is an array of objects with type and text
    expect(Array.isArray(consoleMessages)).toBe(true);
    for (const m of consoleMessages) {
      expect(m).toHaveProperty('type');
      expect(m).toHaveProperty('text');
      expect(typeof m.type).toBe('string');
      expect(typeof m.text).toBe('string');
    }

    // Validate that no uncaught page errors were recorded while performing the operations
    // (If there were any, they are captured in pageErrors and this assertion would fail,
    // which is the desired behavior for surfacing runtime errors.)
    expect(pageErrors).toEqual([]);
  });

  test('Verify the inline onclick attribute is not malformed and alert text matches FSM evidence exactly', async ({ page }) => {
    // This ensures the onclick attribute string is identical to the FSM evidence and that
    // invoking it produces the same alert string (defensive check for whitespace/different quoting).
    const demo = new DemoPage(page);

    const onclickAttr = await demo.getButtonOnclickAttr();

    // Check the attribute contains the expected alert invocation
    const expectedFragment = "alert('This is a demonstration of the sliding window concept in action!')";
    expect(onclickAttr).toContain(expectedFragment);

    // Execute the click and assert the alert's message is exactly the inner alert text
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      demo.button.click(),
    ]);
    expect(dialog.message()).toBe("This is a demonstration of the sliding window concept in action!");
    await dialog.accept();
  });
});