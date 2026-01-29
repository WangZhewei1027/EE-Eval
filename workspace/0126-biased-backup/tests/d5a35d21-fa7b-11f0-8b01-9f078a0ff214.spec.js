import { test, expect } from '@playwright/test';

const PAGE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a35d21-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the Demonstration page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('button[onclick]');
    this.container = page.locator('.container');
    this.heading = page.locator('h1');
  }

  async goto() {
    await this.page.goto(PAGE_URL, { waitUntil: 'load' });
  }

  async getButtonText() {
    return this.button.innerText();
  }

  async clickDemoButton() {
    await this.button.click();
  }

  async isButtonVisible() {
    return this.button.isVisible();
  }

  async pageContent() {
    return this.page.content();
  }
}

test.describe('Understanding Support Vector Machines - Interactive Demo (FSM: Idle / ButtonClick)', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;
  let demo;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (log, warning, error, etc.)
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // Defensive: in case msg.text() throws; still push a placeholder
        consoleMessages.push({ type: msg.type ? msg.type() : 'unknown', text: '<could not read message text>' });
      }
    });

    // Capture uncaught errors on the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object from the page context
      pageErrors.push(err);
    });

    demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async ({ page }) => {
    // No teardown modifications to the page - only clear listeners implicitly by test fixture
    // Optionally assert no unexpected dialogs remain open by ensuring page is still connected
    // (Playwright automatically handles closing pages between tests)
  });

  test('Idle state: page loads and renders expected static content and demonstration button', async ({ page }) => {
    // Validate that the page title and main heading are present
    await expect(page).toHaveTitle(/Understanding Support Vector Machines/i);
    await expect(demo.heading).toHaveText(/Understanding Support Vector Machines/i);

    // The FSM's Idle state expects renderPage() as an entry action.
    // Verify the implementation: ensure renderPage is not present on window (evidence of mismatch).
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    // Comment: The FSM declared renderPage() as an entry action. The HTML implementation does not define it.
    // We assert that it is undefined.
    expect(renderPageType).toBe('undefined');

    // Ensure the demonstration button exists and has the expected text/content
    await expect(demo.button).toBeVisible();
    const btnText = await demo.getButtonText();
    expect(btnText).toBe('Click for Demonstration');

    // Verify container and some of the expected static content exists (sanity of rendered DOM)
    await expect(demo.container).toContainText('Support Vector Machines (SVM)');
    await expect(demo.container).toContainText('Kernel Trick');

    // There should be no page errors just from loading static content in a correct implementation
    // We assert that no uncaught page errors were emitted during load.
    expect(pageErrors.length).toBe(0);

    // No console errors should be present during load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('ButtonClick event: clicking the demonstration button shows alert with expected text and does not change DOM', async ({ page }) => {
    // Capture the page content before interaction
    const beforeContent = await demo.pageContent();

    // Prepare to wait for the alert dialog
    const dialogPromise = page.waitForEvent('dialog');

    // Click the button - should trigger an alert as per onclick attribute
    await demo.clickDemoButton();

    // Wait for the dialog and assert its message
    const dialog = await dialogPromise;
    try {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe("This is a simple demonstration alert. The goal is to stop interactivity.");
    } finally {
      // Always accept the dialog to proceed
      await dialog.accept();
    }

    // After dismissing the alert, DOM should remain in the Idle state (no visible state transition)
    const afterContent = await demo.pageContent();
    // The page's static content should be unchanged by the alert click
    expect(afterContent).toBe(beforeContent);

    // There should be no new uncaught page errors as a result of clicking the button
    expect(pageErrors.length).toBe(0);

    // No console error entries produced by clicking the button
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Repeated clicks: clicking the demo button multiple times triggers multiple alerts sequentially', async ({ page }) => {
    // Click and accept dialog multiple times to ensure the transition is idempotent and repeatable
    const clicks = 3;
    for (let i = 0; i < clicks; i++) {
      const dlg = await page.waitForEvent('dialog'); // start waiting before action
      await demo.clickDemoButton();
      const dialog = await dlg;
      // Validate dialog text each time
      expect(dialog.message()).toBe("This is a simple demonstration alert. The goal is to stop interactivity.");
      await dialog.accept();
    }

    // No uncaught page errors after repeated interactions
    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry action verification: attempting to invoke missing renderPage() results in ReferenceError', async ({ page }) => {
    // The FSM declared an entry action renderPage() that is not implemented in the HTML.
    // We attempt to invoke it from the page context and assert that a ReferenceError occurs naturally.
    // This allows us to validate the mismatch between FSM entry actions and the implementation.

    // Prepare to observe a pageerror event which should be emitted for the ReferenceError.
    let observedPageError = null;
    const handler = (err) => { observedPageError = err; };
    page.on('pageerror', handler);

    // Calling renderPage() in the page context should cause a ReferenceError and reject the evaluate promise.
    // We assert that the evaluate call rejects with an error and that the pageerror event is recorded.
    await expect(page.evaluate(() => {
      // Intentionally call the (nonexistent) entry action to let the ReferenceError happen naturally.
      // Do not catch it here: allow it to bubble so the page emits a pageerror.
      // Note: This will throw a ReferenceError in the browser context if renderPage is undefined.
      return renderPage();
    })).rejects.toThrow();

    // Small allowance for the event loop to emit pageerror and for our handler to run
    // Confirm that a pageerror was captured and that its message mentions "renderPage" or "ReferenceError"
    // observedPageError may be null in some environments if the error was handled differently; assert conservatively.
    expect(observedPageError).not.toBeNull();
    if (observedPageError) {
      // The message should indicate renderPage is not defined or a ReferenceError occurred
      const msg = String(observedPageError.message || observedPageError);
      expect(msg.toLowerCase()).toContain('renderpage');
    }

    // Clean up our temporary handler to avoid duplicate accumulation in subsequent tests
    page.removeListener('pageerror', handler);
  });

  test('Edge case: ensure no unexpected console errors or page errors appear during user interactions', async ({ page }) => {
    // Interact once to produce the alert and then inspect logs / errors
    const dlgPromise = page.waitForEvent('dialog');
    await demo.clickDemoButton();
    const dlg = await dlgPromise;
    await dlg.accept();

    // Validate there are no pageErrors of kinds TypeError / SyntaxError / ReferenceError captured
    const errorMessages = pageErrors.map(e => String(e.message || e));
    // We expect no such uncaught errors in the correct implementation
    // If errors exist, this test will fail and surface them
    const hasSeriousJsError = errorMessages.some(m =>
      /referenceerror|typeerror|syntaxerror/i.test(m)
    );
    expect(hasSeriousJsError).toBe(false);

    // Also assert no console 'error' messages were logged during these interactions
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});