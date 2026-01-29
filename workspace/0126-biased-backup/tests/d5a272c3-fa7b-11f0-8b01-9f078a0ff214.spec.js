import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a272c3-fa7b-11f0-8b-01-9f078a0ff214.html';
const BUTTON_SELECTOR = '.button';
const EXPECTED_ALERT_MESSAGE = "Think of the OSI Model as a layered cake where each layer has its unique ingredients to create the final product";

class OSIPage {
  /**
   * Page Object for the OSI Model interactive page.
   * Encapsulates common interactions and queries.
   */
  constructor(page) {
    this.page = page;
    this.locator = page.locator(BUTTON_SELECTOR);
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async exists() {
    return await this.locator.count() > 0;
  }

  async text() {
    return (await this.locator.innerText()).trim();
  }

  async getAttribute(name) {
    return await this.locator.getAttribute(name);
  }

  /**
   * Clicks the analogy button and awaits the resulting alert dialog.
   * Returns the dialog object so the caller can inspect and accept/dismiss it.
   */
  async clickAndWaitForDialog() {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.locator.click();
    const dialog = await dialogPromise;
    return dialog;
  }

  /**
   * Activate the button via keyboard (Enter) and wait for dialog.
   */
  async keyboardActivateAndWaitForDialog() {
    await this.locator.focus();
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.page.keyboard.press('Enter');
    const dialog = await dialogPromise;
    return dialog;
  }
}

test.describe('d5a272c3-fa7b-11f0-8b-01-9f078a0ff214 - Understanding the OSI Model (FSM validation)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for observation and assertions
    pageErrors = [];
    consoleMessages = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Push the Error object for later assertions
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Helpful debug output in test traces/logs if a test fails
    if (pageErrors.length > 0) {
      // Attach nothing; just ensure they are available in the console (do not modify page)
      // This avoids mutating the page environment and still surfaces information in test output logs.
      // (Note: We do not throw here — individual tests will assert pageErrors as appropriate.)
    }
  });

  test('Initial state S0_Idle: button is present with correct text and attributes', async ({ page }) => {
    // Validate initial idle state: the link/button exists and exposes evidence expected by FSM
    const osi = new OSIPage(page);
    await osi.goto();

    // The button should exist in the DOM
    expect(await osi.exists()).toBeTruthy();

    // The visible text should match the FSM evidence
    const text = await osi.text();
    expect(text).toBe('Click for a Simple Analogy');

    // The href attribute should be present and point to '#'
    const href = await osi.getAttribute('href');
    expect(href).toBe('#');

    // The onclick attribute should include the expected alert call (evidence in the FSM)
    const onclick = await osi.getAttribute('onclick');
    expect(onclick).toContain("alert('Think of the OSI Model as a layered cake");

    // At page load (S0_Idle) there should be no dialogs automatically triggered.
    // We assert that no page errors occurred on load.
    expect(pageErrors.length).toBe(0);

    // Also check that console didn't log unexpected errors
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrorMsgs.length).toBe(0);
  });

  test('Transition ClickForAnalogy: clicking the button displays the expected alert (S1_AnalogyDisplayed)', async ({ page }) => {
    // This test validates the FSM transition from S0_Idle -> S1_AnalogyDisplayed via ClickForAnalogy
    const osi = new OSIPage(page);
    await osi.goto();

    // Capture current URL to ensure clicking doesn't navigate away (edge behavior)
    const beforeUrl = page.url();

    // Click and wait for the alert dialog to appear
    const dialog = await osi.clickAndWaitForDialog();

    // Verify the alert content matches the expected analogy message (onEnter action)
    expect(dialog.message()).toBe(EXPECTED_ALERT_MESSAGE);

    // Accept the dialog so the page can resume
    await dialog.accept();

    // Ensure the click did not navigate to a different page (href='#' should not change path)
    const afterUrl = page.url();
    expect(afterUrl).toBe(beforeUrl);

    // Ensure no page errors were produced by the interaction
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: multiple rapid clicks generate sequential alerts (each representing entering S1_AnalogyDisplayed)', async ({ page }) => {
    // Validate that repeated user actions still produce the alert each time (no suppression)
    const osi = new OSIPage(page);
    await osi.goto();

    // Click twice sequentially and accept both dialogs
    const dialog1Promise = page.waitForEvent('dialog');
    await osi.locator.click();
    const dialog1 = await dialog1Promise;
    expect(dialog1.message()).toBe(EXPECTED_ALERT_MESSAGE);
    await dialog1.accept();

    const dialog2Promise = page.waitForEvent('dialog');
    await osi.locator.click();
    const dialog2 = await dialog2Promise;
    expect(dialog2.message()).toBe(EXPECTED_ALERT_MESSAGE);
    await dialog2.accept();

    // No page errors should have occurred during repeated interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Activation via keyboard triggers the same onEnter action (alert) - accessibility check', async ({ page }) => {
    // Verify keyboard activation (Enter) also triggers the alert defined by onclick
    const osi = new OSIPage(page);
    await osi.goto();

    const dialog = await osi.keyboardActivateAndWaitForDialog();
    expect(dialog.message()).toBe(EXPECTED_ALERT_MESSAGE);
    await dialog.accept();

    // Ensure no unexpected page errors after keyboard activation
    expect(pageErrors.length).toBe(0);
  });

  test('DOM remains stable after transition; no DOM changes expected for S1_AnalogyDisplayed', async ({ page }) => {
    // The FSM's transition produces an alert but no DOM mutation; assert DOM structure unchanged pre/post
    const osi = new OSIPage(page);
    await osi.goto();

    // Snapshot a few DOM metrics before interaction
    const sectionsBefore = await page.locator('.section').count();
    const bodyHtmlBefore = await page.locator('body').innerHTML();

    // Trigger the alert and accept
    const dialog = await osi.clickAndWaitForDialog();
    expect(dialog.message()).toBe(EXPECTED_ALERT_MESSAGE);
    await dialog.accept();

    // Re-evaluate DOM metrics after interaction
    const sectionsAfter = await page.locator('.section').count();
    const bodyHtmlAfter = await page.locator('body').innerHTML();

    // Expect no structural changes (alert should not mutate DOM)
    expect(sectionsAfter).toBe(sectionsBefore);
    expect(bodyHtmlAfter).toBe(bodyHtmlBefore);

    // Still no page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Observes console and page errors: fail if unexpected runtime errors occur on the page', async ({ page }) => {
    // This test intentionally asserts that there are no uncaught runtime errors on load and interaction.
    // If runtime errors (ReferenceError, TypeError, SyntaxError) happen naturally, this test will fail
    // and surface the errors in the test output, which is the desired behavior per constraints.
    const osi = new OSIPage(page);
    await osi.goto();

    // Perform the expected interaction
    const dialog = await osi.clickAndWaitForDialog();
    await dialog.accept();

    // Assert no uncaught page errors were emitted
    // If the application has thrown an error naturally, it will be present here and cause the assertion to fail.
    expect(pageErrors.length).toBe(0);

    // Also assert no console error-level messages occurred (which often indicate issues)
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMsgs.length).toBe(0);
  });

  test('Negative/edge scenario: clicking on a non-existent selector should not throw in test runner', async ({ page }) => {
    // Attempt to click a selector that does not exist on the page and verify Playwright reports an error
    await page.goto(APP_URL);

    // We deliberately try to click a selector that doesn't exist to ensure the app itself remains untouched,
    // and that Playwright surfaces the locator failure (this is an edge test for test harness behavior).
    let thrown = false;
    try {
      await page.click('.non-existent-button', { timeout: 1000 });
    } catch (e) {
      thrown = true;
      // Ensure the thrown error is a Playwright error about strictness/timeout - do not assert specific message to avoid brittle test
      expect(e).toBeInstanceOf(Error);
    }
    expect(thrown).toBe(true);
  });
});