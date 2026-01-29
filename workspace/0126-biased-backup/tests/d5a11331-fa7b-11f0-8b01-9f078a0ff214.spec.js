import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a11331-fa7b-11f0-8b01-9f078a0ff214.html';

// Simple page object encapsulating interactions with the demo page
class LinearSearchPage {
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  // Attach listeners to capture console messages and page errors for assertions
  async attachListeners() {
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      // Capture actual Error objects for inspection
      this.pageErrors.push(err);
    });
  }

  // Navigate to the application page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Returns a locator to the demonstration button
  get demonstrationButton() {
    return this.page.locator('#demonstrationButton');
  }

  // Click the demonstration button and return the dialog message (handles alert)
  async clickDemonstrationAndGetDialogText() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.demonstrationButton.click()
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }
}

test.describe('Understanding Linear Search - FSM and UI tests', () => {
  // Will be created for each test
  let pageObject;

  test.beforeEach(async ({ page }) => {
    // Create page object and attach listeners before navigation
    pageObject = new LinearSearchPage(page);
    await pageObject.attachListeners();
    await pageObject.goto();
  });

  test.afterEach(async ({ page }) => {
    // Extra safety: wait a tiny bit to allow pending console/pageerror events to propagate
    await page.waitForTimeout(50);
    // No teardown modifications required; Playwright will close the page/context.
  });

  test('Idle state (S0_Idle) - page renders correctly with expected elements', async ({ page }) => {
    // This test validates the initial Idle state as described in the FSM:
    // - Entry action conceptually is renderPage() (not necessarily implemented)
    // - The demonstration button must be present and visible
    // - No alert should be shown on initial load
    const button = page.locator('#demonstrationButton');

    // Assert the button exists and has the expected text
    await expect(button).toBeVisible({ timeout: 2000 });
    await expect(button).toHaveText('Show Linear Search Steps');

    // Verify that the page contains the example array text and the "index 3" conclusion
    const exampleBlock = page.locator('.example');
    await expect(exampleBlock).toBeVisible();
    await expect(exampleBlock).toContainText('Check index 3: 1 (match found!)');

    // No dialogs should have been emitted on load; confirm our captured arrays are empty
    // (We did not programmatically open any dialogs in beforeEach)
    // Ensure no JS runtime errors were recorded during render
    expect(pageObject.pageErrors.length).toBe(0);
    // Ensure there are no console.error messages initially
    const consoleErrors = pageObject.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition ShowDemonstration (S0_Idle -> S1_Demonstration) - clicking button shows expected alert', async () => {
    // This test validates the main transition:
    // - Trigger: click #demonstrationButton
    // - Action: alert with the demonstration steps
    // - Expected observable: dialog contains the steps and final index 3
    const dialogText = await pageObject.clickDemonstrationAndGetDialogText();

    // Assert that the alert contains key parts of the demonstration
    expect(dialogText).toContain('Demonstration: Start searching in the array [4, 2, 7, 1, 3] for the value 1.');
    expect(dialogText).toContain('1. Check index 0: 4 (not a match).');
    expect(dialogText).toContain('4. Check index 3: 1 (match found!)');
    expect(dialogText).toContain('The target value 1 is found at index 3.');

    // After accepting the alert the page should remain functional and the button should still be present
    await expect(pageObject.demonstrationButton).toBeVisible();

    // Ensure no JS runtime errors were recorded as a result of the interaction
    expect(pageObject.pageErrors.length).toBe(0);
    const consoleErrors = pageObject.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Repeated interactions: multiple rapid clicks produce multiple alerts with consistent content', async () => {
    // This test covers an edge case where the user clicks the demonstration button multiple times quickly.
    // We expect multiple alerts to appear sequentially and with consistent content for each click.
    const clicks = 3;
    const messages = [];

    for (let i = 0; i < clicks; i++) {
      // capture each dialog produced by a click
      const [dialog] = await Promise.all([
        pageObject.page.waitForEvent('dialog'),
        pageObject.demonstrationButton.click()
      ]);
      messages.push(dialog.message());
      await dialog.accept();
    }

    // Validate we received the expected number of dialogs and that their content matches expectations
    expect(messages.length).toBe(clicks);
    for (const msg of messages) {
      expect(msg).toContain('Start searching in the array [4, 2, 7, 1, 3] for the value 1.');
      expect(msg).toContain('The target value 1 is found at index 3.');
    }

    // Assert no runtime page errors were observed during the rapid interactions
    expect(pageObject.pageErrors.length).toBe(0);
    const consoleErrors = pageObject.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM coverage: asserting both states (S0_Idle and S1_Demonstration) are observable via UI behavior', async () => {
    // This test provides an explicit check that the two FSM states are represented by UI behavior.
    // S0_Idle: presence of button (checked)
    await expect(pageObject.demonstrationButton).toBeVisible();

    // S1_Demonstration: triggered by clicking button and observing an alert (dialog)
    const dialogText = await pageObject.clickDemonstrationAndGetDialogText();
    expect(dialogText).toContain('Demonstration: Start searching in the array [4, 2, 7, 1, 3] for the value 1.');

    // Confirm no unintended exceptions were thrown while entering S1_Demonstration
    expect(pageObject.pageErrors.length).toBe(0);
  });

  test('Edge case and error scenario: attempting to click a non-existent element should throw a timeout / not found error', async () => {
    // This test intentionally attempts an invalid interaction to validate how the system behaves
    // when an expected UI element is missing. We do not modify the page; we simply target a selector that does not exist.
    let thrownError = null;
    try {
      // Playwright will time out trying to click a non-existent locator
      await pageObject.page.click('#nonExistentButton', { timeout: 1000 });
    } catch (err) {
      thrownError = err;
    }

    // We expect an error to have been thrown by Playwright when the selector was not found / clickable
    expect(thrownError).not.toBeNull();
    // The error message should indicate a timeout or that the element could not be found
    expect(String(thrownError.message)).toMatch(/(Timeout|Element|no node|could not|not visible)/i);
  });

  test('No unexpected runtime errors (ReferenceError/SyntaxError/TypeError) occurred during normal usage', async () => {
    // Ensure normal use (load + single click) does not produce JS runtime exceptions
    // (Per instructions we observe errors if they occur naturally; here we assert none did.)
    // Perform a single demonstration click to exercise the code
    const dialogText = await pageObject.clickDemonstrationAndGetDialogText();
    expect(dialogText.length).toBeGreaterThan(0);

    // Confirm there were no page-level exceptions
    // If any ReferenceError/SyntaxError/TypeError were thrown naturally, they would be captured in pageObject.pageErrors
    expect(pageObject.pageErrors.length).toBe(0);

    // Confirm there are no console.error messages indicating runtime problems
    const consoleErrors = pageObject.consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});