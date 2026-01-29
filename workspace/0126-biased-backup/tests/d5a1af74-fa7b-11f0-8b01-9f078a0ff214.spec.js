import { test, expect } from '@playwright/test';

// Test file for Application ID: d5a1af74-fa7b-11f0-8b01-9f078a0ff214
// HTML served at:
// http://127.0.0.1:5500/workspace/0126-biased/html/d5a1af74-fa7b-11f0-8b01-9f078a0ff214.html

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1af74-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object Model for the Two Pointers demo page
class TwoPointersPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator("button[onclick='showDemo()']");
    this.demoOutput = page.locator('#demoOutput');
    this.container = page.locator('.container');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // wait for main container to ensure page is loaded
    await expect(this.container).toBeVisible();
  }

  async clickDemonstrate() {
    await this.button.click();
  }

  async getDemoText() {
    return (await this.demoOutput.textContent()) ?? '';
  }
}

// The expected demo text from the FSM / HTML implementation
const EXPECTED_DEMO_TEXT =
  "In the example, if you start with left at index 0 (value 1) and right at index 4 (value 6), the sum is 7 which is greater than 6. So, move the right pointer to index 3, sum is now 5 (1 + 4) which is less than 6. Move left pointer to index 1, now the sum is 7 again (2 + 4). Move right pointer to index 2 and the sum is 6 (2 + 4). The indices 1 and 3 form the pair that sums to 6.";

test.describe('Two Pointers Interactive Application (FSM validation)', () => {
  // Arrays to capture runtime console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Reset capturing arrays before each test
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (log, error, warning, etc.)
    page.on('console', (msg) => {
      // store both type and text for precise assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (these are runtime exceptions)
    page.on('pageerror', (err) => {
      // store the error message for assertions
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Helpful to see any console output in test logs when debugging
    if (consoleMessages.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', consoleMessages);
    }
    if (pageErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors.map(e => e.message || String(e)));
    }
    // Allow Playwright to close the page in its fixtures; nothing to do here
  });

  test.describe('Idle state (S0_Idle) validations', () => {
    test('Initial Idle state shows the Demonstrate Example button and empty demo output', async ({ page }) => {
      // This test validates the initial FSM state S0_Idle:
      // - the Demonstrate Example button is present
      // - demoOutput is empty
      // - no runtime page errors occurred on load

      const twoPointers = new TwoPointersPage(page);
      await twoPointers.goto();

      // Button should be visible and have correct label
      await expect(twoPointers.button).toBeVisible();
      await expect(twoPointers.button).toHaveText('Demonstrate Example');

      // demoOutput should be present and initially empty
      await expect(twoPointers.demoOutput).toBeVisible();
      const initialText = await twoPointers.getDemoText();
      expect(initialText).toBe('', 'demoOutput should be empty in the Idle state');

      // FSM entry/exit actions for S0_Idle are empty; verify there were no unexpected page errors
      expect(pageErrors.length).toBe(0);
      // No console errors should be logged on a correct load
      const consoleErrors = consoleMessages.filter(c => c.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition DemonstrateExample and DemoShown state (S1_DemoShown)', () => {
    test('Clicking Demonstrate Example transitions to DemoShown and updates demoOutput', async ({ page }) => {
      // This test validates the transition from S0_Idle -> S1_DemoShown triggered by DemonstrateExample:
      // - click the button
      // - verify demoOutput.textContent matches the expected explanatory string
      // - ensure no runtime errors happened as a result

      const twoPointers = new TwoPointersPage(page);
      await twoPointers.goto();

      // Perform the user event from FSM: click the demonstrate button
      await twoPointers.clickDemonstrate();

      // After click, demoOutput should have the expected content
      await expect(twoPointers.demoOutput).toHaveText(EXPECTED_DEMO_TEXT);

      // Ensure the content exactly matches the FSM evidence string
      const actualText = await twoPointers.getDemoText();
      expect(actualText).toBe(EXPECTED_DEMO_TEXT);

      // Validate there were no uncaught page errors during the transition
      expect(pageErrors.length).toBe(0);

      // Validate there were no console.error messages emitted during the transition
      const consoleErrors = consoleMessages.filter(c => c.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Clicking the Demonstrate Example button multiple times is idempotent and does not cause errors', async ({ page }) => {
      // This test checks repeated interactions:
      // - clicking the button multiple times should not change the outcome
      // - no runtime errors should occur on subsequent clicks

      const twoPointers = new TwoPointersPage(page);
      await twoPointers.goto();

      // Click multiple times
      await twoPointers.clickDemonstrate();
      await twoPointers.clickDemonstrate();
      await twoPointers.clickDemonstrate();

      // The demo text should remain the same after multiple clicks
      const actualText = await twoPointers.getDemoText();
      expect(actualText).toBe(EXPECTED_DEMO_TEXT);

      // Ensure no new runtime errors or console.error messages
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(c => c.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('DemoShown state retains UI elements and semantics after demonstrating', async ({ page }) {
      // After transition to S1_DemoShown:
      // - the button should still exist (UI remains interactive)
      // - the explanatory text should be readable and present in DOM

      const twoPointers = new TwoPointersPage(page);
      await twoPointers.goto();

      await twoPointers.clickDemonstrate();

      // Button remains visible and enabled
      await expect(twoPointers.button).toBeVisible();
      // The demo output element should contain text and be accessible in the DOM
      const text = await twoPointers.getDemoText();
      expect(text.length).toBeGreaterThan(0);

      // No entry or exit actions were defined in FSM for S1_DemoShown; verify no page errors nonetheless
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and error scenario validations', () => {
    test('Clicking a non-existent selector results in a Playwright action error (expected failure)', async ({ page }) => {
      // This test intentionally attempts an invalid action to validate error handling in the test harness.
      // We do NOT inject or modify the page; we simply attempt to click a selector that does not exist.
      // The Playwright action should reject; we assert that an error is thrown by the action itself.
      await page.goto(APP_URL);
      // Ensure the page loaded in a consistent state first
      await expect(page.locator('.container')).toBeVisible();

      // Attempt to click a non-existent element; Playwright should throw an error.
      await expect(page.click('button#this-does-not-exist', { timeout: 1000 })).rejects.toThrow();
      // No uncaught page errors should have been recorded because this is a test-side error, not a page runtime error.
      expect(pageErrors.length).toBe(0);
    });

    test('No unexpected runtime ReferenceError, SyntaxError, or TypeError occur on load and interaction', async ({ page }) => {
      // This test explicitly documents that we observe runtime exceptions if they occur naturally.
      // For this page, we expect none. We assert that no uncaught exceptions of common types occurred.

      const twoPointers = new TwoPointersPage(page);
      await twoPointers.goto();

      // Interact to potentially surface runtime errors
      await twoPointers.clickDemonstrate();

      // Inspect captured page errors and make sure none are TypeError/ReferenceError/SyntaxError instances.
      // If any page errors occurred, fail the test and log them.
      const problematicErrors = pageErrors.filter(e => {
        const name = (e && e.name) || '';
        return name === 'ReferenceError' || name === 'TypeError' || name === 'SyntaxError';
      });

      expect(problematicErrors.length).toBe(0);
    });
  });
});