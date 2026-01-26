import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b47b21-fa7c-11f0-adc7-178f556b1ee0.html';

// Page Object to encapsulate interactions with the Hash Functions page
class HashPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#hash-function';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonText() {
    return this.page.textContent(this.buttonSelector);
  }

  // Click the hash button and wait for the prompt dialog to appear
  async clickAndWaitForPrompt() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.click(this.buttonSelector),
    ]);
    return dialog;
  }

  // Click the hash button and provide input (accept prompt with value)
  // Returns the dialog object for further inspection if needed
  async clickAndAcceptPromptWith(value) {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.page.click(this.buttonSelector);
    const dialog = await dialogPromise;
    await dialog.accept(value);
    return dialog;
  }

  // Click the hash button and dismiss the prompt (simulate cancel)
  async clickAndDismissPrompt() {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.page.click(this.buttonSelector);
    const dialog = await dialogPromise;
    await dialog.dismiss();
    return dialog;
  }

  // Click and accept with a value, also wait for the following alert and return it
  async clickAcceptAndWaitForAlert(value) {
    // first dialog is prompt, second is alert - handle both
    const promptPromise = this.page.waitForEvent('dialog');
    await this.page.click(this.buttonSelector);
    const promptDialog = await promptPromise;
    await promptDialog.accept(value);

    const alertDialog = await this.page.waitForEvent('dialog');
    return { promptDialog, alertDialog };
  }

  // Click and dismiss prompt, then wait for resulting alert
  async clickDismissAndWaitForAlert() {
    const promptPromise = this.page.waitForEvent('dialog');
    await this.page.click(this.buttonSelector);
    const promptDialog = await promptPromise;
    await promptDialog.dismiss();

    const alertDialog = await this.page.waitForEvent('dialog');
    return { promptDialog, alertDialog };
  }
}

test.describe('Hash Functions FSM - End-to-End', () => {
  // Common page object available to tests
  let page;
  let hashPage;

  test.beforeEach(async ({ browser }) => {
    // Create a fresh context and page for each test to isolate events/errors
    const context = await browser.newContext();
    page = await context.newPage();
    hashPage = new HashPage(page);
    // Navigate to the application page
    await hashPage.goto();
  });

  test.afterEach(async () => {
    // Close page/context handled by Playwright fixtures, ensure any leftovers are cleaned
    await page.close();
  });

  test('Initial state (S0_Idle): page renders with expected heading and button', async () => {
    // Validate that the page loaded and the main heading and button are present
    await expect(page.locator('h1')).toHaveText('Hash Functions');
    const buttonText = await hashPage.getButtonText();
    expect(buttonText).toContain('Try the Hash Function');

    // This validates evidence from the FSM: the button exists in Idle state
    const button = page.locator('#hash-function');
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  });

  test('Transition S0 -> S1: clicking the button opens a prompt dialog', async () => {
    // When the button is clicked, the FSM expects a prompt('Enter a string:')
    const dialogPromise = page.waitForEvent('dialog');
    await page.click('#hash-function');
    const dialog = await dialogPromise;

    // Validate that a prompt dialog appeared
    expect(dialog.type()).toBe('prompt');

    // Validate the prompt message matches the implementation
    expect(dialog.message()).toContain('Enter a string');

    // Dismiss the prompt to continue script execution
    await dialog.dismiss();

    // The implementation, when prompt returns null, should trigger an alert('Please enter a string')
    const alert = await page.waitForEvent('dialog');
    expect(alert.type()).toBe('alert');
    expect(alert.message()).toBe('Please enter a string');
    await alert.accept();
  });

  test('Transition S1 -> S2 (InputProvided): providing input triggers runtime error due to crypto usage', async () => {
    // This test provides an input to the prompt. The page code attempts to call crypto.createHash(...)
    // In the browser environment, that call will throw (TypeError or similar). We must let the error happen naturally
    // and assert that a pageerror (uncaught exception) occurs.

    // Prepare to capture an uncaught page error produced by the page JS
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Click and accept the prompt with a sample input
    const promptPromise = page.waitForEvent('dialog');
    await page.click('#hash-function');
    const prompt = await promptPromise;
    expect(prompt.type()).toBe('prompt');
    await prompt.accept('test-input');

    // Wait for the pageerror to occur
    const error = await pageErrorPromise;

    // Assert that an error was thrown and it relates to the crypto/createHash call
    // Different browsers may produce slightly different messages; check for key substrings.
    expect(error).toBeTruthy();
    const msg = String(error.message || error.toString());
    const lowered = msg.toLowerCase();
    const matches = lowered.includes('createhash') || lowered.includes('is not a function') || lowered.includes('crypto');
    expect(matches).toBeTruthy();

    // Because the exception occurs before the alert is shown, there should be no alert dialog here.
    // Try to see if an alert appears shortly - it should not. We'll wait briefly to ensure no dialogs.
    let dialogOccurred = false;
    page.on('dialog', () => { dialogOccurred = true; });
    // small timeout to allow any alerts; this does not block test for long
    await page.waitForTimeout(250);
    expect(dialogOccurred).toBe(false);
  });

  test('Transition S1 -> S3 (InputEmpty): accepting an empty string shows "Please enter a string" alert and no page error', async () => {
    // Provide an empty string to the prompt (falsy), which should trigger the else branch alert and NOT attempt crypto.createHash
    // So we should see an alert and no page error.

    // Set up listeners to detect any pageerror
    let pageErrorSeen = null;
    const onPageError = (err) => { pageErrorSeen = err; };
    page.on('pageerror', onPageError);

    // Click and accept prompt with empty string, then wait for the alert
    const dialogPromise = page.waitForEvent('dialog');
    await page.click('#hash-function');
    const prompt = await dialogPromise;
    expect(prompt.type()).toBe('prompt');
    await prompt.accept(''); // empty input

    // Now the code should trigger an alert('Please enter a string')
    const alert = await page.waitForEvent('dialog');
    expect(alert.type()).toBe('alert');
    expect(alert.message()).toBe('Please enter a string');
    await alert.accept();

    // Ensure no pageerror was reported
    // Allow a brief moment to capture any asynchronous errors (if any)
    await page.waitForTimeout(200);
    expect(pageErrorSeen).toBeNull();

    // cleanup listener
    page.off('pageerror', onPageError);
  });

  test('Prompt cancel (null) leads to empty input alert (S3) and no runtime error', async () => {
    // If user cancels the prompt (dialog.dismiss()), prompt returns null -> else branch shows alert and should not call crypto.createHash

    let pageErrorSeen = null;
    const onPageError = (err) => { pageErrorSeen = err; };
    page.on('pageerror', onPageError);

    // Click and dismiss prompt
    const promptPromise = page.waitForEvent('dialog');
    await page.click('#hash-function');
    const prompt = await promptPromise;
    expect(prompt.type()).toBe('prompt');
    await prompt.dismiss();

    // Should see the 'Please enter a string' alert
    const alert = await page.waitForEvent('dialog');
    expect(alert.type()).toBe('alert');
    expect(alert.message()).toBe('Please enter a string');
    await alert.accept();

    // Confirm no page error occurred
    await page.waitForTimeout(200);
    expect(pageErrorSeen).toBeNull();

    page.off('pageerror', onPageError);
  });

  test('Edge case: very long input still leads to the same runtime error (crypto not available) - observe pageerror', async () => {
    // Supply a very large string; the implementation still tries to call crypto.createHash and should throw
    const longInput = 'x'.repeat(100000); // 100k chars

    const pageErrorPromise = page.waitForEvent('pageerror');

    const promptPromise = page.waitForEvent('dialog');
    await page.click('#hash-function');
    const prompt = await promptPromise;
    await prompt.accept(longInput);

    const error = await pageErrorPromise;
    expect(error).toBeTruthy();
    const msg = String(error.message || error.toString()).toLowerCase();
    const matches = msg.includes('createhash') || msg.includes('crypto') || msg.includes('is not a function');
    expect(matches).toBeTruthy();
  });

  test('Verify DOM evidence listed in the FSM remains present after interactions', async () => {
    // Click and dismiss to exercise the page, then ensure the button remains present and visible (S0 evidence)
    const prompt = await hashPage.clickAndDismissPrompt();
    // After alert handled the DOM should not have been removed
    const button = page.locator('#hash-function');
    await expect(button).toBeVisible();
    await expect(page.locator('h1')).toHaveText('Hash Functions');

    // Ensure multiple interactions still find the button
    await expect(button).toBeEnabled();
  });
});