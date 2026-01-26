import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a2c0e5-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the SDLC demo page
class SDLCDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('.button');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getButtonText() {
    return await this.button.textContent();
  }

  async clickExplainButton() {
    await this.button.click();
  }

  async getButtonOnclickAttribute() {
    return await this.button.getAttribute('onclick');
  }

  // Evaluate whether showSDLCInfo exists on window and its type
  async isShowSDLCInfoFunction() {
    return await this.page.evaluate(() => typeof window.showSDLCInfo === 'function');
  }

  // Evaluate whether renderPage is defined on window
  async getRenderPageType() {
    return await this.page.evaluate(() => typeof window.renderPage);
  }
}

test.describe('SDLC Interactive Application - FSM Validation (d5a2c0e5-fa7b-11f0-8b01-9f078a0ff214)', () => {
  let page;
  let sdlcPage;
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    // Create a new context + page for isolation
    const context = await browser.newContext();
    page = await context.newPage();

    // Capture console messages for diagnostics
    consoleMessages = [];
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught page errors
    pageErrors = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    sdlcPage = new SDLCDemoPage(page);
    await sdlcPage.goto();
  });

  test.afterEach(async () => {
    // Basic sanity: log any console messages and errors for debugging if tests fail
    if (consoleMessages.length) {
      // eslint-disable-next-line no-console
      console.log('Console messages during test:', consoleMessages);
    }
    if (pageErrors.length) {
      // eslint-disable-next-line no-console
      console.log('Page errors during test:', pageErrors.map(e => e.message || String(e)));
    }
    // Close the page's context to clean up
    await page.context().close();
  });

  test('Idle state (S0_Idle): page loads and button exists with expected attributes', async () => {
    // Validate basic page rendering and Idle state evidence:
    // - Title contains SDLC
    await expect(page).toHaveTitle(/Software Development Life Cycle/i);

    // - The Explain SDLC Phases button is visible and has the expected label
    await expect(sdlcPage.button).toBeVisible();
    const buttonText = await sdlcPage.getButtonText();
    expect(buttonText?.trim()).toBe('Explain SDLC Phases');

    // - The button has the onclick attribute referencing showSDLCInfo()
    const onclickAttr = await sdlcPage.getButtonOnclickAttribute();
    expect(onclickAttr).toBe('showSDLCInfo()');

    // - The showSDLCInfo function should be defined on the page (S1 entry action exists as a function)
    const isShowFunction = await sdlcPage.isShowSDLCInfoFunction();
    expect(isShowFunction).toBe(true);

    // - The FSM's mentioned renderPage() is NOT present in the implementation, assert undefined
    const renderType = await sdlcPage.getRenderPageType();
    expect(renderType).toBe('undefined');

    // - No uncaught page errors just from loading the page
    expect(pageErrors.length).toBe(0);
  });

  test('Transition (ExplainSDLCPhases): clicking the button triggers an alert with SDLC phases (S1_SDLC_Info_Shown)', async () => {
    // This test validates the transition from Idle to SDLC Info Shown by clicking the button
    // and asserting the alert dialog text (entry action showSDLCInfo()).

    // Prepare to handle the dialog that should appear
    const dialogPromise = page.waitForEvent('dialog');

    // Click the button that triggers showSDLCInfo()
    await sdlcPage.clickExplainButton();

    // Wait for the dialog and assert its message content
    const dialog = await dialogPromise;
    const expectedMessage =
      'SDLC Phases: \n1. Requirement Analysis \n2. Planning \n3. Design \n4. Implementation \n5. Testing \n6. Deployment \n7. Maintenance';
    expect(dialog.message()).toBe(expectedMessage);

    // Accept the alert so it doesn't block further interactions
    await dialog.accept();

    // Confirm no unexpected page errors occurred during this normal flow
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: multiple clicks produce repeated alerts reliably', async () => {
    // Validate repeated transitions: clicking multiple times should produce separate alerts
    // We'll perform two clicks and assert two dialogs with the same expected text occur.

    const expectedMessageStart = 'SDLC Phases:';

    // First dialog
    const firstDialogPromise = page.waitForEvent('dialog');
    await sdlcPage.clickExplainButton();
    const firstDialog = await firstDialogPromise;
    expect(firstDialog.message()).toContain(expectedMessageStart);
    await firstDialog.accept();

    // Second dialog
    const secondDialogPromise = page.waitForEvent('dialog');
    await sdlcPage.clickExplainButton();
    const secondDialog = await secondDialogPromise;
    expect(secondDialog.message()).toContain(expectedMessageStart);
    await secondDialog.accept();

    // Ensure still no page errors after repeated use
    expect(pageErrors.length).toBe(0);
  });

  test('Error scenario: invoking undefined renderPage() triggers a ReferenceError pageerror', async () => {
    // The FSM listed renderPage() as an entry action, but the implementation does not define it.
    // This test intentionally triggers an uncaught call to renderPage() to validate that a ReferenceError occurs
    // and is observable as a pageerror event. We schedule the call asynchronously to let it be uncaught.

    // Wait for a pageerror event to occur
    const errorPromise = page.waitForEvent('pageerror');

    // Schedule an asynchronous call to the non-existent renderPage() to produce an uncaught exception
    // We do NOT catch it in the page context so that it becomes an uncaught page error.
    await page.evaluate(() => {
      setTimeout(() => {
        // Intentionally call undefined function to cause ReferenceError
        // This should produce an uncaught exception and be emitted as 'pageerror'
        // eslint-disable-next-line no-undef
        renderPage();
      }, 0);
    });

    // Await and assert the error
    const error = await errorPromise;
    // The message may vary across browsers, but should reference renderPage and be a ReferenceError
    const errMessage = error?.message || String(error);
    expect(errMessage.toLowerCase()).toContain('renderpage');
    // Also ensure 'referenceerror' substring is present for typical engine messages, but allow flexibility
    expect(errMessage.toLowerCase()).toMatch(/referenceerror|is not defined/);

    // Confirm that we captured at least one page error in the pageErrors array as well
    // (pageErrors is pushed by page.on('pageerror') in beforeEach)
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const captured = pageErrors.map(e => (e && e.message) || String(e));
    expect(captured.some(m => m.toLowerCase().includes('renderpage'))).toBe(true);
  });

  test('Observability: console messages and absence of unexpected errors during typical flows', async () => {
    // This final test performs a normal user flow and asserts there are no unexpected console errors or page errors.
    // It acts as a smoke test covering typical usage.

    // Click the explain button once
    const dialogPromise = page.waitForEvent('dialog');
    await sdlcPage.clickExplainButton();
    const dialog = await dialogPromise;
    await dialog.accept();

    // Allow a brief microtask tick for any console messages to flush
    await page.waitForTimeout(50);

    // Assert there were no uncaught page errors during normal operations
    expect(pageErrors.length).toBe(0);

    // Inspect console messages: none should be of type 'error' (if they exist, fail)
    const errorConsoleEntries = consoleMessages.filter(m => m.type === 'error');
    if (errorConsoleEntries.length > 0) {
      // If any console.error messages exist, fail with the recorded messages for diagnostics
      throw new Error('Unexpected console.error messages: ' + JSON.stringify(errorConsoleEntries));
    }

    // Otherwise, the app behaved without console errors during the typical flow
    expect(errorConsoleEntries.length).toBe(0);
  });
});