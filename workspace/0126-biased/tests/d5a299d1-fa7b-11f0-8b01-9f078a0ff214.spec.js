import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a299d1-fa7b-11f0-8b01-9f078a0ff214.html';
const EXPECTED_ALERT_TEXT = "This is a simple demonstration of HTTPS!";

/**
 * Page Object for the Understanding HTTPS page.
 * Encapsulates operations and selectors used by the tests.
 */
class HttpsPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // prefer semantic locator by text to avoid brittle escaping issues
    this.showButton = page.getByRole('button', { name: 'Show HTTPS Demo' });
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonText() {
    return await this.showButton.innerText();
  }

  async getOnclickAttribute() {
    return await this.showButton.getAttribute('onclick');
  }

  // Clicks the show button and returns the dialog object that appears.
  async clickShowButtonAndCaptureDialog() {
    // Wait for the dialog to appear as a result of the click
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.showButton.click(),
    ]);
    // Accept the dialog to avoid blocking further actions
    await dialog.accept();
    return dialog;
  }

  async clickShowButton() {
    await this.showButton.click();
  }

  async isButtonVisible() {
    return await this.showButton.isVisible();
  }
}

test.describe('Understanding HTTPS - FSM and UI tests', () => {
  // collects console messages and page errors every test
  test.beforeEach(async ({ page }) => {
    // No special global patches - we only observe
  });

  test('S0_Idle: Page renders and initial Idle state elements are present', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) according to the FSM:
    // - The page renders
    // - The "Show HTTPS Demo" button exists and has expected text and onclick attribute
    // - The FSM's declared entry action "renderPage()" is not present in the page (we assert it's undefined)
    const httpsPage = new HttpsPage(page);
    const consoleMessages = [];
    const pageErrors = [];

    // Observe console and page errors
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await httpsPage.goto();

    // Ensure the main button is visible and labeled correctly
    expect(await httpsPage.isButtonVisible()).toBe(true);
    expect(await httpsPage.getButtonText()).toBe('Show HTTPS Demo');

    // Verify the inline onclick attribute exists and contains the expected alert call
    const onclickAttr = await httpsPage.getOnclickAttribute();
    expect(onclickAttr).toBe("alert('This is a simple demonstration of HTTPS!');");

    // Verify that the page does not define renderPage (FSM listed renderPage() as entry action,
    // but the page does not implement it). We check typeof to be 'undefined'.
    const typeofRenderPage = await page.evaluate(() => typeof renderPage);
    expect(typeofRenderPage).toBe('undefined');

    // There should be no dialogs automatically opened on page load (Idle state should not trigger alert)
    // Confirm no dialog has been emitted by ensuring we do not receive any 'dialog' synchronously.
    // (If a dialog had appeared it would block; Playwright would throw. The absence is validated by continuing.)

    // No serious page errors should have been emitted on load for this simple static page
    expect(pageErrors.length).toBe(0);

    // Collect and assert console messages do not contain 'error' level entries (best-effort)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition ShowHttpsDemo: Clicking the button triggers the alert (S0_Idle -> S1_DemoShown)', async ({ page }) => {
    // This test validates the transition defined in the FSM:
    // - User clicks the button (event ShowHttpsDemo)
    // - The expected observable is an alert with the exact message
    // - After the alert, the DOM remains present (button still visible)
    const httpsPage = new HttpsPage(page);
    const pageErrors = [];
    const consoleMessages = [];

    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => consoleMessages.push({ type: msg.type(), text: msg.text() }));

    await httpsPage.goto();

    // Click and capture the dialog. Playwright will provide a Dialog object we can inspect.
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      httpsPage.showButton.click()
    ]);

    try {
      // Verify the alert text matches the expected FSM entry action for S1
      expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);
      // Accept the dialog to continue the test flow
      await dialog.accept();
    } catch (e) {
      // Ensure we don't leave dialogs open on exception
      try { await dialog.dismiss(); } catch (_) {}
      throw e;
    }

    // The button should still be present after the dialog (the page did not navigate away)
    expect(await httpsPage.isButtonVisible()).toBe(true);

    // Confirm no unexpected page errors were recorded during the interaction
    expect(pageErrors.length).toBe(0);

    // Confirm no console errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: Clicking the Show HTTPS Demo button multiple times produces multiple alerts', async ({ page }) => {
    // This test verifies repeated interactions and that each click produces an alert
    const httpsPage = new HttpsPage(page);
    await httpsPage.goto();

    // Click twice, capturing both dialogs
    const dialogPromise1 = page.waitForEvent('dialog');
    await httpsPage.showButton.click();
    const dialog1 = await dialogPromise1;
    expect(dialog1.message()).toBe(EXPECTED_ALERT_TEXT);
    await dialog1.accept();

    const dialogPromise2 = page.waitForEvent('dialog');
    await httpsPage.showButton.click();
    const dialog2 = await dialogPromise2;
    expect(dialog2.message()).toBe(EXPECTED_ALERT_TEXT);
    await dialog2.accept();

    // Ensure still present after repeated interactions
    expect(await httpsPage.isButtonVisible()).toBe(true);
  });

  test('FSM entry action verification: invoking missing renderPage() causes a ReferenceError in page context', async ({ page }) => {
    // The FSM lists renderPage() as an entry action for the Idle state.
    // The HTML does not implement renderPage. We explicitly attempt to call it inside the page
    // context and capture the thrown ReferenceError to verify its absence is detectable.
    await page.goto(APP_URL);

    // Execute in page context: call renderPage() and capture thrown error object
    const result = await page.evaluate(() => {
      try {
        // Intentionally call the undefined function to provoke a ReferenceError that we catch
        renderPage();
        return { called: true };
      } catch (e) {
        // Return a serializable representation of the error
        return { called: false, name: e && e.name, message: e && e.message };
      }
    });

    // We expect that renderPage is not available and that invoking it resulted in ReferenceError
    expect(result.called).toBe(false);
    expect(result.name).toBe('ReferenceError');
    // The error message should reference renderPage or be descriptive
    expect(result.message).toContain('renderPage');
  });

  test('Uncaught ReferenceError scenario: an unhandled JS error surfaces as a pageerror event', async ({ page }) => {
    // This test intentionally triggers an unhandled ReferenceError in the page context
    // (allowed by the requirements) and asserts that Playwright observes it via the 'pageerror' event.
    await page.goto(APP_URL);

    // Prepare to wait for a pageerror event
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Trigger an asynchronous unhandled ReferenceError inside the page
    // Using setTimeout without try/catch ensures the error is uncaught and will be reported
    await page.evaluate(() => {
      setTimeout(() => {
        // This will throw an uncaught ReferenceError
        nonExistentFunctionThatDoesNotExist();
      }, 0);
    });

    // Wait for the pageerror to be emitted and inspect it
    const error = await pageErrorPromise;
    // The name should be ReferenceError
    expect(error.name).toBe('ReferenceError');
    // The message should reference the missing function
    expect(error.message).toContain('nonExistentFunctionThatDoesNotExist');
  });

  test('DOM parsing observation: malformed HTML snippet is present in source, but page renders expected content', async ({ page }) => {
    // The provided HTML has a malformed list item tag "<liThe server responds..." (missing closing angle bracket).
    // This test verifies that the page still contains the semantic text "The server responds" somewhere,
    // and that the page did not throw parsing-related runtime errors in console.
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (m) => consoleMessages.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (e) => pageErrors.push(e));

    await page.goto(APP_URL);

    // The text from the malformed list item should still be present in the page content (browser HTML parser auto-corrects)
    const fullContent = await page.content();
    expect(fullContent).toContain('The server responds');

    // No runtime page errors should have been emitted as a result of malformed HTML parsing
    expect(pageErrors.length).toBe(0);

    // There should be no console error messages produced just by loading the malformed HTML
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});