import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a3ab41-fa7b-11f0-8b01-9f078a0ff214.html';

// Page object model for the Digital Signatures demo page
class DigitalSignaturePage {
  constructor(page) {
    this.page = page;
  }

  // Returns the first button element handle
  async getDemoButton() {
    return this.page.locator('button').first();
  }

  // Returns the button text content trimmed
  async getDemoButtonText() {
    const btn = await this.getDemoButton();
    return btn.textContent();
  }

  // Returns the raw onclick attribute of the button
  async getDemoButtonOnclick() {
    return this.page.getAttribute('button', 'onclick');
  }

  // Clicks the demo button and waits for the alert dialog to appear,
  // then accepts it and returns the dialog message.
  async clickAndAcceptAlert() {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.page.click('button');
    const dialog = await dialogPromise;
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  // Schedules a call to a missing function renderPage inside a setTimeout in the page,
  // which will produce an uncaught pageerror event asynchronously.
  async scheduleUncaughtRenderPageCall() {
    // This schedules an uncaught ReferenceError in the page execution context.
    return this.page.evaluate(() => {
      // eslint-disable-next-line no-undef
      setTimeout(() => {
        // Intentionally call a non-existent function to create an uncaught ReferenceError.
        // Do NOT define renderPage anywhere - we must let the error happen naturally.
        // The try/catch is intentionally omitted to produce an uncaught error.
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        // eslint-disable-next-line no-undef
        renderPage();
      }, 0);
    });
  }

  // Schedules an uncaught TypeError in the page via setTimeout
  async scheduleUncaughtTypeError() {
    return this.page.evaluate(() => {
      setTimeout(() => {
        const f = null;
        // This will throw a TypeError: f is not a function
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        f();
      }, 0);
    });
  }

  // Schedules an uncaught SyntaxError in the page via setTimeout (runtime eval)
  async scheduleUncaughtSyntaxError() {
    return this.page.evaluate(() => {
      setTimeout(() => {
        try {
          // Use eval with invalid code to throw a SyntaxError at runtime.
          // We do NOT catch this to let it become an uncaught error.
          eval('function)'); // invalid JS to cause SyntaxError
        } catch (e) {
          // The eval thrown SyntaxError inside setTimeout will be caught here if we keep this catch.
          // To ensure an uncaught SyntaxError, we rethrow it outside the catch asynchronously.
          setTimeout(() => {
            // Rethrow the error so it's uncaught in the page context.
            // eslint-disable-next-line no-undef
            throw e;
          }, 0);
        }
      }, 0);
    });
  }
}

test.describe('Understanding Digital Signatures - FSM and UI E2E', () => {
  // Collect pageerrors and console messages for assertions
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught errors from the page
    page.on('pageerror', (err) => {
      // Store the Error object for later assertions
      pageErrors.push(err);
    });

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Short defensive check: ensure page is still open and close if needed.
    try {
      await page.close();
    } catch {
      // ignore
    }
  });

  test('Idle state: page renders, main content and demo button are present', async ({ page }) => {
    // This test validates the S0_Idle state rendering and evidence:
    // - The page title and main heading exist
    // - The "Watch Digital Signature Demo" button exists with the expected onclick attribute
    // - No uncaught page errors occurred on initial load

    const model = new DigitalSignaturePage(page);

    // Validate page title
    const title = await page.title();
    expect(title).toContain('Understanding Digital Signatures');

    // Validate main heading text exists
    const h1 = await page.locator('h1').textContent();
    expect(h1).toContain('Understanding Digital Signatures');

    // Validate button presence and text
    const btnText = await model.getDemoButtonText();
    expect(btnText).toContain('Watch Digital Signature Demo');

    // Validate the onclick attribute evidence (must contain the alert string)
    const onclickAttr = await model.getDemoButtonOnclick();
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("alert('Digitial signature demonstration is currently not available. This button serves only as an example.'"); // partial contains check

    // Ensure there were no uncaught page errors immediately after load
    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry action renderPage() is missing -> calling it should throw ReferenceError', async ({ page }) => {
    // This test verifies that the onEnter action renderPage() (mentioned in FSM) is not defined
    // and that attempting to call it will produce a ReferenceError.
    const model = new DigitalSignaturePage(page);

    // Confirm the global function renderPage is undefined
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');

    // Attempting to call renderPage directly via evaluate will cause a rejected Promise.
    // We assert that evaluate rejects with an error containing "renderPage" or "not defined".
    await expect(page.evaluate(() => {
      // Direct call in evaluate context; Playwright will reject the Promise with the thrown error.
      // eslint-disable-next-line no-undef
      return renderPage();
    })).rejects.toThrow(/renderPage|not defined|ReferenceError/);
  });

  test('Uncaught ReferenceError from calling renderPage asynchronously produces pageerror event', async ({ page }) => {
    // This test ensures that an uncaught ReferenceError (as would occur if renderPage were called on enter)
    // is observable via the pageerror event. We schedule an async call to renderPage to let the error be uncaught.

    const model = new DigitalSignaturePage(page);

    // Start waiting for the pageerror event before triggering the error
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Schedule the uncaught ReferenceError in the page
    await model.scheduleUncaughtRenderPageCall();

    // Await the pageerror event that should result from the above
    const err = await pageErrorPromise;

    // The error message should reference renderPage and be a ReferenceError
    expect(err).toBeTruthy();
    expect(err.message).toMatch(/renderPage|not defined/);
    expect(err.name).toBe('ReferenceError');

    // Ensure our captured pageErrors array also has at least this error
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const hasRenderPageError = pageErrors.some(e => /renderPage|not defined/i.test(e.message));
    expect(hasRenderPageError).toBeTruthy();
  });

  test('Watch Demo event: clicking the button shows an alert dialog (DemoAlert state)', async ({ page }) => {
    // This test validates the WatchDemo event and the transition to the S1_DemoAlert state by:
    // - Clicking the button
    // - Observing the alert dialog message matches the FSM evidence (including the misspelling "Digitial")
    // - Accepting the dialog and ensuring the DOM remains (no transition to a different page)
    const model = new DigitalSignaturePage(page);

    // Listen for the dialog and click
    const dialogMessage = await model.clickAndAcceptAlert();

    // Validate dialog content matches the expected alert string from the HTML
    const expectedAlert = "Digitial signature demonstration is currently not available. This button serves only as an example.";
    expect(dialogMessage).toContain(expectedAlert);

    // After accepting the alert, verify that the same button is still present (no navigation)
    const btnTextAfter = await model.getDemoButtonText();
    expect(btnTextAfter).toContain('Watch Digital Signature Demo');

    // There should be no new uncaught JS errors produced by the alert action itself
    // (alert is a synchronous browser dialog, not an uncaught exception)
    // It's acceptable for other pageerrors to exist from previous tests; we assert that none were added
    // by the click action in this test by checking the last captured pageerror timestamp/length is unchanged.
    // Since we do not have per-test isolation of pageErrors array beyond beforeEach, ensure there's no pageerror with 'alert' in message.
    const alertErrors = pageErrors.filter(e => /alert|Digitial/.test(e.message));
    expect(alertErrors.length).toBe(0);
  });

  test('Multiple clicks produce multiple alert dialogs and remain functional', async ({ page }) => {
    // This test validates repeated WatchDemo events and ensures the UI remains responsive.
    const model = new DigitalSignaturePage(page);

    // Click the button twice and handle two alert dialogs sequentially
    for (let i = 0; i < 2; i++) {
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('button');
      const dialog = await dialogPromise;
      expect(dialog.message()).toContain('Digitial signature demonstration is currently not available');
      await dialog.accept();
    }

    // Ensure button still present after repeated interactions
    const btnText = await model.getDemoButtonText();
    expect(btnText).toContain('Watch Digital Signature Demo');
  });

  test('Edge cases: schedule uncaught TypeError and SyntaxError and observe pageerror events', async ({ page }) => {
    // This test intentionally provokes other kinds of runtime errors to validate that such
    // errors would be captured by the pageerror handler and are observable.
    const model = new DigitalSignaturePage(page);

    // Prepare to capture two pageerror events (TypeError and SyntaxError). We will await both.
    const errorPromises = [
      page.waitForEvent('pageerror'),
      page.waitForEvent('pageerror')
    ];

    // Schedule the errors (they will throw asynchronously inside the page)
    await model.scheduleUncaughtTypeError();
    await model.scheduleUncaughtSyntaxError();

    // Await both errors (order is not guaranteed)
    const errors = await Promise.all(errorPromises);

    // Expect at least one TypeError and one SyntaxError among the captured events
    const messages = errors.map(e => `${e.name}: ${e.message}`);
    const hasTypeError = messages.some(m => /TypeError/.test(m) || /not a function/.test(m));
    const hasSyntaxError = messages.some(m => /SyntaxError/.test(m) || /Unexpected token/.test(m) || /Unexpected end of input/.test(m));

    expect(hasTypeError).toBeTruthy();
    expect(hasSyntaxError).toBeTruthy();

    // Also ensure pageErrors array includes these captured errors
    const joinedMessages = pageErrors.map(e => `${e.name}: ${e.message}`).join('\n');
    expect(joinedMessages).toContain('TypeError', 'Expected a TypeError recorded in pageErrors');
    expect(joinedMessages).toContain('SyntaxError', 'Expected a SyntaxError recorded in pageErrors');
  });

  test('Diagnostics: console should not contain unexpected errors on load', async ({ page }) => {
    // This test examines console messages captured during the session
    // and asserts there are no console messages of type 'error' emitted during initial load.
    // Note: other tests may schedule errors; this test runs in the same describe but after beforeEach ensures fresh page.
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });
});