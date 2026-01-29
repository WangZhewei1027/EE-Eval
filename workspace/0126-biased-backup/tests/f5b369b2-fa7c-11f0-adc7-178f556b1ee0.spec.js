import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b369b2-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object for the Refactoring demo page
class RefactorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  // Navigate to the page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Get the refactor button locator
  refactorButton() {
    return this.page.locator('#refactor-button');
  }

  // Click the refactor button
  async clickRefactor() {
    await this.refactorButton().click();
  }

  // Helper to ensure the button is visible/enabled
  async isRefactorButtonVisible() {
    return await this.refactorButton().isVisible();
  }

  // Helper to get button text content
  async getRefactorButtonText() {
    return await this.refactorButton().innerText();
  }
}

test.describe('Refactoring: FSM and UI integration tests', () => {
  // Arrays to capture console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  // Setup: for each test, navigate to the page and attach listeners to collect runtime info.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Listen to all console events and store them
    page.on('console', (msg) => {
      // Normalize console text and type
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text()
        });
      } catch (e) {
        // In case msg.text() throws (very unlikely), store the raw object
        consoleMessages.push({
          type: 'unknown',
          text: String(msg)
        });
      }
    });

    // Capture uncaught page errors (e.g., ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    const refactorPage = new RefactorPage(page);
    await refactorPage.goto();
  });

  // Teardown: nothing special, but we keep the collected logs for inspection in tests.

  test.describe('State S0_Idle (Initial state) validations', () => {
    test('Idle state: refactor button is present, visible and labeled correctly', async ({ page }) => {
      // This test validates the initial FSM Idle state (S0_Idle):
      // - The button with id #refactor-button must exist
      // - Button should be visible and contain the expected text
      // - No runtime page errors should have occurred during load

      const refactorPage = new RefactorPage(page);

      // Button existence & visibility
      const isVisible = await refactorPage.isRefactorButtonVisible();
      expect(isVisible).toBeTruthy();

      // Button text
      const text = await refactorPage.getRefactorButtonText();
      expect(text).toContain('Refactor Code');

      // Ensure no uncaught errors on initial load
      expect(pageErrors.length).toBe(0);

      // Ensure no console error-level messages on initial load
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Transition RefactorButtonClick -> S1_Refactoring (Refactoring state) validations', () => {
    test('Clicking refactor button transitions to Refactoring and logs expected messages', async ({ page }) => {
      // This test validates the transition triggered by clicking the refactor button:
      // - After clicking, console should include "Original Code:" and "Refactored Code:"
      // - The full code strings logged should contain expected functions (e.g., add, subtract, multiply)
      // - No uncaught page errors should be raised by clicking

      const refactorPage = new RefactorPage(page);

      // Ensure starting from Idle
      expect(await refactorPage.isRefactorButtonVisible()).toBeTruthy();

      // Clear any previous console messages just in case
      consoleMessages = [];

      // Click the button to trigger the refactoring demonstration
      await refactorPage.clickRefactor();

      // Wait briefly for console events to be emitted
      // Poll until we see at least the 'Refactored Code:' entry or timeout
      const timeoutMs = 2000;
      const intervalMs = 50;
      let waited = 0;
      while (waited < timeoutMs) {
        // Check for the presence of key markers in collected console messages
        const texts = consoleMessages.map(m => m.text);
        const hasOriginalMarker = texts.some(t => t.includes('Original Code:'));
        const hasRefactoredMarker = texts.some(t => t.includes('Refactored Code:'));
        if (hasOriginalMarker && hasRefactoredMarker) break;
        await page.waitForTimeout(intervalMs);
        waited += intervalMs;
      }

      // After waiting, assert that the logs exist
      const messages = consoleMessages.map(m => m.text);

      // Check presence of the label logs
      expect(messages.some(t => t.includes('Original Code:'))).toBeTruthy();
      expect(messages.some(t => t.includes('Refactored Code:'))).toBeTruthy();

      // Check that the original code block logged includes 'function add' and 'function subtract'
      const originalLog = messages.find(t => t.includes('function add') && t.includes('function subtract'));
      expect(originalLog).toBeTruthy();

      // Check that the refactored code block logged includes 'function multiply'
      const refactoredLog = messages.find(t => t.includes('function multiply'));
      expect(refactoredLog).toBeTruthy();

      // Ensure the order: 'Original Code:' logged before 'Refactored Code:'
      const originalIndex = messages.findIndex(t => t.includes('Original Code:'));
      const refactoredIndex = messages.findIndex(t => t.includes('Refactored Code:'));
      expect(originalIndex).toBeGreaterThanOrEqual(0);
      expect(refactoredIndex).toBeGreaterThanOrEqual(0);
      expect(originalIndex).toBeLessThan(refactoredIndex);

      // Ensure no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Ensure clicking did not remove or disable the button (UI remains stable)
      expect(await refactorPage.isRefactorButtonVisible()).toBeTruthy();
      expect(await refactorPage.getRefactorButtonText()).toContain('Refactor Code');
    });

    test('Multiple rapid clicks produce repeated refactoring logs and remain error-free', async ({ page }) => {
      // This test validates that multiple clicks produce repeated console logs (idempotent behavior)
      // and do not generate uncaught exceptions.

      const refactorPage = new RefactorPage(page);

      // Reset captured messages
      consoleMessages = [];
      pageErrors = [];

      // Perform three rapid clicks
      await Promise.all([
        refactorPage.clickRefactor(),
        refactorPage.clickRefactor(),
        refactorPage.clickRefactor()
      ]);

      // Wait until we observe at least three occurrences of the 'Original Code:' marker
      const timeoutMs = 3000;
      const intervalMs = 50;
      let waited = 0;
      while (waited < timeoutMs) {
        const countOriginal = consoleMessages.filter(m => m.text.includes('Original Code:')).length;
        if (countOriginal >= 3) break;
        await page.waitForTimeout(intervalMs);
        waited += intervalMs;
      }

      const originalCount = consoleMessages.filter(m => m.text.includes('Original Code:')).length;
      const refactoredCount = consoleMessages.filter(m => m.text.includes('Refactored Code:')).length;

      // Expect at least three logs for each marker (one per click)
      expect(originalCount).toBeGreaterThanOrEqual(3);
      expect(refactoredCount).toBeGreaterThanOrEqual(3);

      // No uncaught errors should have been produced
      expect(pageErrors.length).toBe(0);
    });

    test('Edge case: attempting to click a non-existent selector throws a Playwright error', async ({ page }) => {
      // This test intentionally interacts with a non-existent DOM element to validate error scenarios
      // from the test harness perspective (not the page runtime). We assert that Playwright rejects.

      // Attempt to click an element that does not exist on the page.
      // The Playwright locator click should throw; verify that an error is thrown.
      let threw = false;
      try {
        // Use the locator API which will timeout trying to find the element.
        // We make the timeout small to keep the test fast and deterministic.
        await page.locator('#non-existent-selector').click({ timeout: 500 });
      } catch (err) {
        threw = true;
        // The specific error message can differ across Playwright versions/environments.
        // Verify it's an error about not being able to click/find the element.
        expect(String(err)).toBeTruthy();
      }
      expect(threw).toBeTruthy();

      // Ensure no uncaught page errors occurred as a result of this test harness interaction
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('FSM onEnter/onExit actions verification', () => {
    test('onEnter (S1_Refactoring) actions are executed via console side-effects', async ({ page }) => {
      // The FSM defines entry_actions for S1_Refactoring that console.log the original and refactored code.
      // This test asserts those onEnter actions are executed when the button is clicked.

      const refactorPage = new RefactorPage(page);

      // Clear any prior messages
      consoleMessages = [];

      // Click the button once
      await refactorPage.clickRefactor();

      // Wait for the entry logs
      const timeoutMs = 1500;
      const intervalMs = 50;
      let waited = 0;
      while (waited < timeoutMs) {
        const hasOriginal = consoleMessages.some(m => m.text.includes('Original Code:'));
        const hasRefactored = consoleMessages.some(m => m.text.includes('Refactored Code:'));
        if (hasOriginal && hasRefactored) break;
        await page.waitForTimeout(intervalMs);
        waited += intervalMs;
      }

      // Validate the entry action logs are present
      expect(consoleMessages.some(m => m.text.includes('Original Code:'))).toBeTruthy();
      expect(consoleMessages.some(m => m.text.includes('Refactored Code:'))).toBeTruthy();

      // Also validate that the actual code snippets are logged (not just labels)
      expect(consoleMessages.some(m => m.text.includes('function add('))).toBeTruthy();
      expect(consoleMessages.some(m => m.text.includes('function multiply('))).toBeTruthy();
    });
  });
});