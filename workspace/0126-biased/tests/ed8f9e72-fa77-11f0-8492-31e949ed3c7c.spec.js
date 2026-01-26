import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8f9e72-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page object model for the Agile Methodology interactive page.
 * Encapsulates common selectors and interactions used across tests.
 */
class AgilePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '.button';
    this.headerSelector = 'header h1';
    this.contentSelector = '.content';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeaderText() {
    return this.page.textContent(this.headerSelector);
  }

  async getButtonText() {
    return this.page.textContent(this.buttonSelector);
  }

  async hasButton() {
    return this.page.$(this.buttonSelector).then(el => !!el);
  }

  async getButtonOnclickAttribute() {
    const handle = await this.page.$(this.buttonSelector);
    if (!handle) return null;
    return handle.getAttribute('onclick');
  }

  async clickLearnMoreAndCaptureDialog() {
    // Use waitForEvent to capture the alert dialog that is expected from showMore()
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog', { timeout: 3000 }),
      this.page.click(this.buttonSelector),
    ]);
    const message = dialog.message();
    await dialog.dismiss();
    return message;
  }

  async callShowMoreFunctionDirectlyAndCaptureDialog() {
    // Calling showMore() directly in page context and capturing dialog via waitForEvent
    const promiseDialog = this.page.waitForEvent('dialog', { timeout: 3000 });
    await this.page.evaluate(() => {
      // call the function defined in the page (if present)
      // If showMore is not defined, the evaluate will throw and the test will catch it.
      // We intentionally do not wrap in try/catch here to let the error surface naturally to the test.
      showMore();
    });
    const dialog = await promiseDialog;
    const message = dialog.message();
    await dialog.dismiss();
    return message;
  }
}

test.describe('Agile Methodology Interactive Page - FSM validation', () => {
  // Containers for console and page errors observed during tests
  let consoleMessages;
  let pageErrors;

  // Reusable page object
  let agilePage;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      try {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
        });
      } catch (e) {
        // ignore any issues serializing console messages
      }
    });

    // Capture unhandled page errors
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    agilePage = new AgilePage(page);
    // Navigate to the app page
    await agilePage.goto();
  });

  test.afterEach(async ({ page }) => {
    // Basic sanity: no fatal uncaught errors should persist (unless specific test asserts them)
    // Tests that intentionally cause exceptions will assert them explicitly.
    // Here we only ensure that there are no unexpected errors at end of each test (if none were expected).
    // This guard can be adjusted per-test if that test asserts an error happened.
    // We do not fail globally here; each test contains its own assertions on pageErrors.
  });

  test('S0_Idle state: initial render shows header and "Learn More" button with expected attributes', async ({ page }) => {
    // Validate initial UI elements present as evidence for S0_Idle
    const headerText = await agilePage.getHeaderText();
    expect(headerText).toBeTruthy();
    expect(headerText.trim()).toContain('Agile Methodology');

    const hasButton = await agilePage.hasButton();
    expect(hasButton).toBe(true);

    const buttonText = await agilePage.getButtonText();
    expect(buttonText.trim()).toBe('Learn More');

    const onclickAttr = await agilePage.getButtonOnclickAttribute();
    // FSM evidence expects onclick="showMore()"
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr.replace(/\s+/g, '')).toContain('showMore()');

    // No unhandled page errors immediately after load (S0 entry should not produce runtime errors)
    expect(pageErrors.length).toBe(0);

    // Ensure there were no console.error messages on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition LearnMore_Click: clicking the Learn More button triggers an alert with Agile information (S0 -> S1)', async ({ page }) => {
    // This test validates the FSM transition triggered by LearnMore_Click
    const expectedAlertText = 'Agile encourages adaptive planning, evolutionary development, and ongoing improvement.';

    // Click the button and capture the alert's text (S1 entry observable)
    const alertText = await agilePage.clickLearnMoreAndCaptureDialog();
    expect(alertText).toBe(expectedAlertText);

    // After the transition, ensure no unexpected page errors were emitted
    expect(pageErrors.length).toBe(0);

    // No console.error emitted as a result of clicking
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Calling showMore() directly triggers the same alert message as clicking the button', async ({ page }) => {
    // Validate that the function referenced by onclick exists and behaves as expected
    // First ensure showMore exists in page context
    const typeofShowMore = await page.evaluate(() => typeof window.showMore);
    expect(typeofShowMore).toBe('function');

    // Capture dialog when calling the function directly in the page context
    const expectedAlertText = 'Agile encourages adaptive planning, evolutionary development, and ongoing improvement.';
    // Use a safe pattern: wait for dialog and call the function via evaluate
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog', { timeout: 3000 }),
      page.evaluate(() => showMore()),
    ]);
    expect(dialog.message()).toBe(expectedAlertText);
    await dialog.dismiss();

    // No unexpected page errors produced by calling the function directly
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: multiple clicks should produce multiple alerts (repeated transitions)', async ({ page }) => {
    // Click the button twice and confirm two dialogs happen sequentially with the same message
    const expectedAlertText = 'Agile encourages adaptive planning, evolutionary development, and ongoing improvement.';

    // First click
    const firstDialogPromise = page.waitForEvent('dialog', { timeout: 3000 });
    await page.click('.button');
    const firstDialog = await firstDialogPromise;
    expect(firstDialog.message()).toBe(expectedAlertText);
    await firstDialog.dismiss();

    // Second click
    const secondDialogPromise = page.waitForEvent('dialog', { timeout: 3000 });
    await page.click('.button');
    const secondDialog = await secondDialogPromise;
    expect(secondDialog.message()).toBe(expectedAlertText);
    await secondDialog.dismiss();

    // Ensure still no unexpected page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Verify onEnter action renderPage() mentioned in FSM is not present and invoking it produces a ReferenceError-like failure', async ({ page }) => {
    // The FSM mentions an entry_action renderPage() for S0_Idle.
    // The HTML/JS implementation does not define renderPage. We should verify that:
    // - renderPage is undefined on the window object
    // - attempting to invoke it causes an exception (ReferenceError or TypeError),
    //   and that the exception mentions "renderPage" so it's clear why the action would fail.

    // Check typeof renderPage
    const typeofRenderPage = await page.evaluate(() => typeof window.renderPage);
    expect(typeofRenderPage === 'undefined' || typeofRenderPage === 'function' || typeofRenderPage === 'object').toBeTruthy();
    // We specifically expect undefined because the page does not define renderPage
    expect(typeofRenderPage).toBe('undefined');

    // Attempt to call renderPage in the page context and capture the thrown error in Node.
    // We allow the evaluate to throw and catch it to assert the error message contains "renderPage".
    let observedError = null;
    try {
      await page.evaluate(() => {
        // This is intentionally calling an undefined function; per instructions we must let the error happen naturally.
        // The error will be surfaced to the test (promise rejection) which we catch below.
        // NOTE: We are not redefining or patching the page; only invoking what's described.
        // eslint-disable-next-line no-undef
        renderPage();
      });
    } catch (err) {
      observedError = err;
    }

    // We expect an error to have been thrown when trying to call renderPage()
    expect(observedError).not.toBeNull();
    // The exact message may vary by engine, but it should reference renderPage.
    expect(String(observedError)).toContain('renderPage');

    // Because we invoked renderPage intentionally inside evaluate, the error was caught by Playwright and surfaced.
    // We also check pageErrors array for any unhandled errors that bubbled to the page context.
    // It is acceptable for pageErrors to be empty because evaluate's thrown error may not be an unhandled runtime error.
    // We'll assert that if pageErrors are present, they at least mention renderPage as well.
    if (pageErrors.length > 0) {
      const joined = pageErrors.map(e => String(e)).join(' | ');
      expect(joined).toContain('renderPage');
    }
  });

  test('Negative scenario: clicking unrelated elements should not produce the Agile alert', async ({ page }) => {
    // Click on header and ensure no dialog appears
    // We will attempt to click and then wait briefly for any dialogs (should timeout)
    await page.click('header');

    // Wait a short time to ensure no dialogs are created as a side-effect
    let dialogOccurred = false;
    try {
      await page.waitForEvent('dialog', { timeout: 500 });
      dialogOccurred = true;
    } catch (e) {
      // timeout expected - no dialog should appear
    }
    expect(dialogOccurred).toBe(false);

    // No unexpected page errors from clicking header
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: capture console messages and ensure no unexpected console.error on interactions', async ({ page }) => {
    // Interact with the page: click the Learn More button once
    const expectedAlertText = 'Agile encourages adaptive planning, evolutionary development, and ongoing improvement.';
    const dialogPromise = page.waitForEvent('dialog', { timeout: 3000 });
    await page.click('.button');
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe(expectedAlertText);
    await dialog.dismiss();

    // Inspect console messages collected during test run
    // We expect informational logs maybe, but there should be no console.error entries for a healthy UI
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });
});