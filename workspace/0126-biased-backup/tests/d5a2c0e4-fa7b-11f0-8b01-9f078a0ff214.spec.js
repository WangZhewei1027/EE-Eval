import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a2c0e4-fa7b-11f0-8b01-9f078a0ff214.html';

/**
 * Page Object for the Git demonstration page.
 * Encapsulates interactions and queries to keep tests clear and maintainable.
 */
class GitDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '.button';
  }

  // Navigate to the application page
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Return whether the demonstration button is present
  async hasShowDemonstrationButton() {
    return await this.page.$(this.buttonSelector) !== null;
  }

  // Get the visible text of the demonstration button
  async getShowButtonText() {
    const btn = await this.page.$(this.buttonSelector);
    if (!btn) return null;
    return await btn.innerText();
  }

  // Get the onclick attribute value of the button
  async getShowButtonOnclickAttr() {
    return await this.page.getAttribute(this.buttonSelector, 'onclick');
  }

  // Click the demonstration button which should trigger showDemonstration()
  async clickShowDemonstration() {
    await this.page.click(this.buttonSelector);
  }

  // Programmatically call showDemonstration() on the page and capture the dialog
  async callShowDemonstrationAndCaptureDialog() {
    const dialogPromise = this.page.waitForEvent('dialog');
    // Invoke the function in page context
    await this.page.evaluate(() => {
      // Intentionally call the existing function; if it does not exist this will throw
      return showDemonstration();
    });
    const dialog = await dialogPromise;
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  // Programmatically call renderPage() and return the thrown error (if any).
  // This helps validate FSM's onEnter action expectation where renderPage is declared but not implemented.
  async callRenderPageAndReturnError() {
    try {
      await this.page.evaluate(() => {
        // This will throw in the page context if renderPage is not defined
        return renderPage();
      });
      // If no error thrown, return null to indicate the function existed and ran
      return null;
    } catch (err) {
      // Playwright wraps the page error; normalize to a string message for assertions
      return err;
    }
  }
}

test.describe('Understanding Git: FSM and UI integration tests', () => {
  // Arrays to capture console messages and page errors during each test run
  let consoleMessages;
  let pageErrors;
  let gitPage;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console output for observation / assertions
    page.on('console', (msg) => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch {
        // Ignore any unexpected console listener errors
      }
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    gitPage = new GitDemoPage(page);
    await gitPage.goto();
  });

  // Test the Idle state (S0_Idle)
  test('S0_Idle: Page renders with "Show Demonstration" button and FSM entry action renderPage() is not defined', async ({ page }) => {
    // This test validates:
    // - The presence of the "Show Demonstration" button as evidence for Idle state.
    // - The FSM's declared entry action "renderPage()" is not implemented in the page,
    //   so invoking it should result in a ReferenceError (or evaluation error) when called directly.
    // - We intentionally do not patch or define renderPage; we let the error happen naturally and assert on it.

    // Verify the button exists
    const exists = await gitPage.hasShowDemonstrationButton();
    expect(exists).toBeTruthy();

    // Verify the button text matches expected evidence
    const text = await gitPage.getShowButtonText();
    expect(text).toMatch(/Show Demonstration/i);

    // Verify the onclick attribute for the button references the expected function
    const onclickAttr = await gitPage.getShowButtonOnclickAttr();
    expect(onclickAttr).toBe('showDemonstration()');

    // Now, attempt to call renderPage() which is declared as an entry action in the FSM but not defined in the HTML.
    // This should cause an evaluation failure / ReferenceError originating from the page context.
    const err = await gitPage.callRenderPageAndReturnError();

    // Assert that an error was indeed thrown when trying to invoke a missing function.
    // The error message typically includes "renderPage is not defined" or "ReferenceError".
    expect(err).toBeTruthy();
    const message = (err && err.message) ? err.message : String(err);
    const normalized = message.toLowerCase();

    // Accept either a ReferenceError wording or a generic evaluation-failed message that contains the function name.
    expect(
      normalized.includes('renderpage') ||
      normalized.includes('referenceerror') ||
      normalized.includes('not defined')
    ).toBeTruthy();
  });

  // Test the transition from S0_Idle -> S1_Demonstration by clicking the button
  test('Transition ShowDemonstration (click): triggers alert with expected demonstration message (S1_Demonstration entry action)', async ({ page }) => {
    // This test validates:
    // - Clicking the button triggers the showDemonstration() function.
    // - An alert dialog is displayed with the instructional content (evidence for S1_Demonstration).
    // - The alert's message matches the expected demonstration content from the FSM/HTML.

    // Wait for and capture the dialog produced by clicking the button
    const dialogPromise = page.waitForEvent('dialog');

    // Perform the user action: click the demonstration button
    await gitPage.clickShowDemonstration();

    // Obtain the dialog and verify its contents
    const dialog = await dialogPromise;
    const dialogText = dialog.message();

    // The message should contain the demonstration narrative and git commands
    expect(dialogText).toContain("Imagine you have modified 'file.txt'");
    expect(dialogText).toContain("git add file.txt");
    expect(dialogText).toContain("git commit -m \"Updated file.txt\"");

    // Accept the dialog to clear it
    await dialog.accept();

    // Ensure no uncaught runtime page errors occurred during the click/alert lifecycle
    expect(pageErrors.length).toBe(0);
  });

  // Test programmatically invoking showDemonstration() (S1 entry action) without clicking the button
  test('S1_Demonstration entry action: calling showDemonstration() programmatically shows the same alert', async ({ page }) => {
    // This test validates:
    // - The showDemonstration function exists on the page and can be invoked programmatically.
    // - Invoking it directly produces an alert with the same content as the click-triggered flow.

    // Use the page object's helper to call the function and capture the dialog message
    const dialogPromise = page.waitForEvent('dialog');
    // Call showDemonstration directly in page context
    await page.evaluate(() => {
      // If the function is missing, this will throw; the test will fail naturally.
      return showDemonstration();
    });
    const dialog = await dialogPromise;
    const dialogText = dialog.message();
    await dialog.accept();

    expect(dialogText).toContain("Imagine you have modified 'file.txt'");
    expect(dialogText).toContain("git add file.txt");
    expect(dialogText).toContain("git commit -m \"Updated file.txt\"");
  });

  // Edge case: clicking the button multiple times should consistently trigger alerts each time
  test('Edge case: multiple Show Demonstration clicks produce multiple alerts', async ({ page }) => {
    // This test validates:
    // - Repeated user interactions (clicks) produce the expected behavior each time.
    // - No unexpected state prevents subsequent alerts from appearing.

    // We'll click twice and capture two dialogs
    const firstDialogPromise = page.waitForEvent('dialog');
    await gitPage.clickShowDemonstration();
    const firstDialog = await firstDialogPromise;
    expect(firstDialog.message()).toContain('Imagine you have modified');
    await firstDialog.accept();

    const secondDialogPromise = page.waitForEvent('dialog');
    await gitPage.clickShowDemonstration();
    const secondDialog = await secondDialogPromise;
    expect(secondDialog.message()).toContain('Imagine you have modified');
    await secondDialog.accept();

    // Ensure no uncaught page errors occurred during multiple interactions
    expect(pageErrors.length).toBe(0);
  });

  // Observability test: ensure we captured console logs and page errors correctly
  test('Observability: Console and page error listeners capture runtime diagnostics', async ({ page }) => {
    // This test validates:
    // - Our instrumentation (console and pageerror listeners) is active.
    // - In normal operation of this page, there should be no uncaught page errors.
    // - Console output may be empty; we just assert that captured structures are present and well-formed.

    // Perform some benign interactions that shouldn't create console output or page errors
    // 1) Query the button's outer HTML
    const outerHTML = await page.$eval('.button', el => el.outerHTML);
    expect(outerHTML).toContain('Show Demonstration');

    // 2) Trigger and accept a dialog to ensure dialog handling doesn't produce page errors
    const dialogPromise = page.waitForEvent('dialog');
    await gitPage.clickShowDemonstration();
    const dialog = await dialogPromise;
    await dialog.accept();

    // Confirm our listeners captured something (arrays exist)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
    expect(Array.isArray(pageErrors)).toBeTruthy();

    // For this particular page, we expect zero uncaught runtime page errors under normal use
    expect(pageErrors.length).toBe(0);

    // Console messages may be empty; if there are any, ensure they have expected structure
    for (const m of consoleMessages) {
      expect(m).toHaveProperty('type');
      expect(m).toHaveProperty('text');
    }
  });

  test.afterEach(async ({ page }) => {
    // Teardown: ensure page is closed/clean for next test (Playwright usually handles this).
    try {
      await page.close();
    } catch {
      // Ignore errors during teardown to avoid masking test results
    }
  });
});