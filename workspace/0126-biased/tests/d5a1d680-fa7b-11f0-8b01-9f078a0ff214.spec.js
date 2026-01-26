import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1d680-fa7b-11f0-8b01-9f078a0ff214.html';

// Page object to encapsulate interactions with the Big-Theta demo page
class BigThetaPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = 'button[onclick]';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getHeadingText() {
    return this.page.textContent('h1');
  }

  async getButtonText() {
    return this.page.textContent(this.buttonSelector);
  }

  async getButtonOnclickAttribute() {
    return this.page.getAttribute(this.buttonSelector, 'onclick');
  }

  async clickSummaryButton() {
    await this.page.click(this.buttonSelector);
  }

  async isButtonVisible() {
    return this.page.isVisible(this.buttonSelector);
  }
}

test.describe('Big-Theta Notation Interactive Demo (FSM validation)', () => {
  // Collect console events and page errors to validate runtime behavior.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages with their type and text
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (e.g., ReferenceError, TypeError, SyntaxError)
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(err.message);
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright fixtures.
    // This hook exists to emphasize structured setup/teardown.
  });

  test('S0_Idle: Page renders and initial Idle state is correct', async ({ page }) => {
    // This test validates the initial "Idle" state (S0_Idle) per the FSM.
    // It verifies the page content is rendered, button exists with correct text and onclick attribute.
    const app = new BigThetaPage(page);
    await app.goto();

    // Verify the page header exists and contains the expected title content (evidence of render)
    const heading = await app.getHeadingText();
    expect(heading).toBeTruthy();
    expect(heading).toContain('Understanding Big-Theta (Θ) Notation');

    // Verify the summary button is visible and has the expected label
    const isVisible = await app.isButtonVisible();
    expect(isVisible).toBe(true);

    const buttonText = (await app.getButtonText())?.trim();
    expect(buttonText).toBe('Click for a Summary');

    // Verify the inline onclick attribute exists and exactly matches the FSM evidence string
    const onclickAttr = await app.getButtonOnclickAttribute();
    const expectedOnclick = "alert('This is a demonstration. The example provided helps summarize what Big-Theta notation expresses in algorithms!');";
    expect(onclickAttr).toBe(expectedOnclick);

    // Check that no uncaught runtime errors happened during page load
    // (Per instructions we observe page errors naturally; here we assert none occurred.)
    expect(pageErrors.length).toBe(0);

    // Check console did not emit an 'error' level message during initial render
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    expect(consoleErrorMsgs.length).toBe(0);
  });

  test('Transition ClickForSummary: clicking the button triggers alert and advances to SummaryDisplayed (S1_SummaryDisplayed)', async ({ page }) => {
    // This test validates the FSM transition from S0_Idle -> S1_SummaryDisplayed when the user clicks the button.
    // It asserts that an alert dialog appears with the exact expected message (entry action).
    const app = new BigThetaPage(page);
    await app.goto();

    // Prepare to capture dialog messages
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Click the summary button once
    await app.clickSummaryButton();

    // Wait for at least one dialog to have been handled
    await page.waitForTimeout(100); // small pause to allow dialog event to be processed

    // Validate that an alert dialog was shown with the expected message
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const expectedDialogMessage = 'This is a demonstration. The example provided helps summarize what Big-Theta notation expresses in algorithms!';
    // The first dialog should be the expected alert
    expect(dialogs[0].type).toBe('alert');
    expect(dialogs[0].message).toBe(expectedDialogMessage);

    // Verify that no additional dom changes were required for the "state transition" (the app uses alert for showing the summary)
    // The button should still be present after the alert (no navigation or removal)
    expect(await app.isButtonVisible()).toBe(true);

    // Verify no uncaught page errors occurred during interaction
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: rapid multiple clicks produce multiple alerts in sequence', async ({ page }) => {
    // This test ensures that multiple click events invoke multiple alert dialogs.
    // It asserts that each click produces a separate alert with the correct text and that all are handled.
    const app = new BigThetaPage(page);
    await app.goto();

    const capturedDialogMessages = [];
    page.on('dialog', async (dialog) => {
      capturedDialogMessages.push({ type: dialog.type(), message: dialog.message() });
      // Accept immediately to allow subsequent dialogs to appear (simulating user pressing OK)
      await dialog.accept();
    });

    // Perform multiple clicks in quick succession
    const clickCount = 3;
    for (let i = 0; i < clickCount; i++) {
      // The click is asynchronous but the dialog handler accepts dialogs, so small delays can help ensure ordering
      await app.clickSummaryButton();
      // Allow tiny delay so dialogs are queued/handled
      await page.waitForTimeout(50);
    }

    // Wait briefly to ensure all dialogs have been handled
    await page.waitForTimeout(200);

    // Validate we received the expected number of dialogs
    expect(capturedDialogMessages.length).toBeGreaterThanOrEqual(clickCount);

    const expectedMessage = 'This is a demonstration. The example provided helps summarize what Big-Theta notation expresses in algorithms!';
    for (let i = 0; i < clickCount; i++) {
      expect(capturedDialogMessages[i].type).toBe('alert');
      expect(capturedDialogMessages[i].message).toBe(expectedMessage);
    }

    // Confirm no uncaught runtime errors occurred as a result of rapid clicking
    expect(pageErrors.length).toBe(0);
  });

  test('Validate FSM evidence in DOM and event handler presence', async ({ page }) => {
    // This test checks the DOM contains the evidence string (the button markup)
    // and that the button's onclick attribute contains the evidence that triggers the alert.
    const app = new BigThetaPage(page);
    await app.goto();

    // Verify the page's HTML includes the evidence snippet for the button
    const bodyHTML = await page.content();
    expect(bodyHTML).toContain("<button onclick=\"alert('This is a demonstration. The example provided helps summarize what Big-Theta notation expresses in algorithms!');\">Click for a Summary</button>");

    // Additionally verify the onclick attribute (again) to ensure event wiring matches FSM
    const onclickAttr = await app.getButtonOnclickAttribute();
    expect(onclickAttr).toBeDefined();
    expect(onclickAttr).toContain("alert('This is a demonstration. The example provided helps summarize what Big-Theta notation expresses in algorithms!')");

    // Confirm that no unexpected console errors or page errors were emitted during these checks
    expect(pageErrors.length).toBe(0);
    const consoleErr = consoleMessages.find(m => m.type === 'error');
    expect(consoleErr).toBeUndefined();
  });

  test('Error observation test: record any ReferenceError/TypeError/SyntaxError if they naturally occur', async ({ page }) => {
    // Per the testing constraints, we do NOT modify page runtime.
    // This test observes and asserts whether any critical runtime errors occurred naturally.
    // If such errors exist, we include them in the assertion message to aid debugging.
    const app = new BigThetaPage(page);
    await app.goto();

    // Interact with the page once to ensure any lazy-executed scripts would run
    await app.isButtonVisible();

    // Wait briefly to capture asynchronous errors if any
    await page.waitForTimeout(100);

    // Build categorized lists based on pageErrors content (if available)
    const referenceErrors = pageErrors.filter(msg => msg.includes('ReferenceError'));
    const typeErrors = pageErrors.filter(msg => msg.includes('TypeError'));
    const syntaxErrors = pageErrors.filter(msg => msg.includes('SyntaxError'));

    // Assert that none of these critical error types were observed.
    // If they were, fail the test and include the details.
    expect(referenceErrors.length, `ReferenceErrors occurred: ${referenceErrors.join(' | ')}`).toBe(0);
    expect(typeErrors.length, `TypeErrors occurred: ${typeErrors.join(' | ')}`).toBe(0);
    expect(syntaxErrors.length, `SyntaxErrors occurred: ${syntaxErrors.join(' | ')}`).toBe(0);

    // Also assert that the overall pageErrors array is empty (no uncaught exceptions)
    expect(pageErrors.length, `Uncaught page errors: ${pageErrors.join(' | ')}`).toBe(0);
  });
});