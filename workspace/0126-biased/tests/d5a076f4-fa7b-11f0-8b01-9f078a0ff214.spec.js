import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a076f4-fa7b-11f0-8b01-9f078a0ff214.html';

// The exact alert message as provided in the HTML onclick attribute
const DEMO_ALERT_MESSAGE = "This is a demonstration! Explore further materials to understand more about Max Heaps.";

// Page Object to encapsulate interactions with the demo page
class MaxHeapDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('.container');
    this.heading = page.locator('h1');
    this.demoButton = page.locator('button[onclick]');
  }

  // Navigate to the app
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Get the button's visible text, trimmed
  async getButtonText() {
    const txt = await this.demoButton.textContent();
    return txt ? txt.trim() : '';
  }

  // Get the button's onclick attribute string
  async getButtonOnclickAttribute() {
    return this.demoButton.getAttribute('onclick');
  }

  // Click the demo button and wait for the alert dialog, then accept it.
  // Returns the dialog message.
  async clickButtonAndAcceptDialog() {
    // Start waiting for dialog before clicking to avoid races
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.demoButton.click(),
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  // Focus the button and press Enter to activate it (keyboard interaction)
  async pressEnterOnButtonAndAcceptDialog() {
    await this.demoButton.focus();
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.keyboard.press('Enter'),
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  // Check that main content is present (verifies page rendering)
  async isMainContentPresent() {
    return await this.container.isVisible();
  }

  // Get current h1 text
  async getHeadingText() {
    const txt = await this.heading.textContent();
    return txt ? txt.trim() : '';
  }
}

test.describe('Understanding Maximum Heap - Interactive Demo (Application ID: d5a076f4-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Arrays to collect runtime diagnostics for assertions
  let pageErrors = [];
  let consoleErrors = [];

  // Setup before each test: create new page and attach listeners
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Collect page errors (unhandled exceptions in the page)
    page.on('pageerror', (err) => {
      // store full name and message for analysis
      pageErrors.push({ name: err.name, message: err.message, stack: err.stack });
    });

    // Collect console messages of type 'error'
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text() });
      }
    });
  });

  // Teardown: after each test ensure listeners do not leak (Playwright handles page disposal)
  test.afterEach(async ({ page }) => {
    // As an extra precaution, remove listeners if needed (not strictly necessary here)
    // No modification or patching of the page code, only cleanup of test-side listeners.
  });

  test('S0_Idle: Page renders correctly and contains expected elements (entry action: renderPage())', async ({ page }) => {
    // This test validates the Idle state rendering and presence of components listed in the FSM.
    const demo = new MaxHeapDemoPage(page);
    await demo.goto();

    // Basic page-level assertions
    await expect(page).toHaveTitle(/Understanding Maximum Heap|Understanding Max Heaps/i);

    // The container should be visible indicating the page rendered (entry action expectation)
    expect(await demo.isMainContentPresent()).toBeTruthy();

    // Heading should match the topic
    expect(await demo.getHeadingText()).toMatch(/Understanding Max Heaps/i);

    // The demonstration button must be present and have the expected visible text
    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Show a Simple Demonstration');

    // The button must include an onclick attribute that triggers the expected alert (evidence from FSM)
    const onclickAttr = await demo.getButtonOnclickAttribute();
    expect(onclickAttr).toContain("alert(");
    expect(onclickAttr).toContain(DEMO_ALERT_MESSAGE);

    // Assert that no runtime page errors or console.errors were emitted on initial load
    // We observe and assert naturally occurring errors (if any) — here we expect none.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('ShowDemonstration event: Clicking the button shows an alert with the exact message and stays in Idle', async ({ page }) => {
    // This test validates the transition triggered by the button click: alert is shown with exact message,
    // and the app remains in the same Idle state (no DOM changes that indicate a state change).
    const demo = new MaxHeapDemoPage(page);
    await demo.goto();

    // Capture the current DOM snapshot details before interaction
    const headingBefore = await demo.getHeadingText();
    const btnTextBefore = await demo.getButtonText();
    const onclickAttrBefore = await demo.getButtonOnclickAttribute();

    // Click the demo button and capture dialog message
    const message = await demo.clickButtonAndAcceptDialog();
    expect(message).toBe(DEMO_ALERT_MESSAGE);

    // After closing the alert, verify DOM remains consistent (transition loops back to Idle in FSM)
    const headingAfter = await demo.getHeadingText();
    const btnTextAfter = await demo.getButtonText();
    const onclickAttrAfter = await demo.getButtonOnclickAttribute();

    expect(headingAfter).toBe(headingBefore);
    expect(btnTextAfter).toBe(btnTextBefore);
    expect(onclickAttrAfter).toBe(onclickAttrBefore);

    // Verify no page errors or console errors were emitted during the interaction
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Clicking the demonstration button multiple times triggers repeated alerts without errors', async ({ page }) => {
    // This test clicks the button multiple times to ensure consistent behavior and no resource leaks or errors.
    const demo = new MaxHeapDemoPage(page);
    await demo.goto();

    const clicks = 3;
    for (let i = 0; i < clicks; i++) {
      const message = await demo.clickButtonAndAcceptDialog();
      // Each alert should show the exact message
      expect(message).toBe(DEMO_ALERT_MESSAGE);
    }

    // After repeated interactions, assert no page errors or console errors occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);

    // Ensure the button still exists and is clickable (DOM stability)
    expect(await demo.getButtonText()).toBe('Show a Simple Demonstration');
  });

  test('Accessibility/keyboard interaction: Pressing Enter on the focused button triggers the alert', async ({ page }) => {
    // This test verifies keyboard activation (Enter key) which should also trigger the same onclick handler.
    const demo = new MaxHeapDemoPage(page);
    await demo.goto();

    // Press Enter with focus on the button and capture dialog
    const message = await demo.pressEnterOnButtonAndAcceptDialog();
    expect(message).toBe(DEMO_ALERT_MESSAGE);

    // No runtime errors expected
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Diagnostics: observe console and page errors if any (assert none for this implementation)', async ({ page }) => {
    // This test intentionally gathers console and page errors while loading and interacting with the page.
    // We do not alter the page; we observe what occurs naturally and assert results.

    const demo = new MaxHeapDemoPage(page);
    await demo.goto();

    // Perform a single interaction to surface any runtime problems
    const message = await demo.clickButtonAndAcceptDialog();
    expect(message).toBe(DEMO_ALERT_MESSAGE);

    // Report collected diagnostics as part of assertions:
    // If any page errors are present, fail and print their details for debugging.
    if (pageErrors.length > 0) {
      // Provide details in assertion messages
      const details = pageErrors.map(e => `${e.name}: ${e.message}`).join('\n');
      // This will fail the test with helpful diagnostics
      expect(pageErrors.length, `Encountered page errors:\n${details}`).toBe(0);
    }

    if (consoleErrors.length > 0) {
      const details = consoleErrors.map(e => e.text).join('\n');
      expect(consoleErrors.length, `Encountered console.error messages:\n${details}`).toBe(0);
    }

    // As an explicit check, we assert that no ReferenceError/SyntaxError/TypeError occurred.
    const problematic = pageErrors.filter(e => ['ReferenceError', 'SyntaxError', 'TypeError'].includes(e.name));
    expect(problematic.length, 'No ReferenceError, SyntaxError, or TypeError should have been thrown by the page').toBe(0);
  });
});