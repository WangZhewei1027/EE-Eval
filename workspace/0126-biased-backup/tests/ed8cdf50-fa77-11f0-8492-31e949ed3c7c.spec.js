import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8cdf50-fa77-11f0-8492-31e949ed3c7c.html';

// Page object encapsulating common interactions and locators
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.heading = page.locator('h1');
    this.setItems = page.locator('.set-item');
    this.observeButton = page.locator('.button');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async headingText() {
    return this.heading.textContent();
  }

  async countSetItems() {
    return this.setItems.count();
  }

  async setItemTextAt(index) {
    return this.setItems.nth(index).textContent();
  }

  async clickObserve() {
    await this.observeButton.click();
  }

  async clickSetItem(index) {
    await this.setItems.nth(index).click();
  }

  async getButtonOnclickAttr() {
    return this.observeButton.getAttribute('onclick');
  }

  async typeOfRenderPage() {
    return this.page.evaluate(() => typeof window.renderPage);
  }
}

test.describe('Beautiful Set Visualization - FSM tests (ed8cdf50-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Collect console messages, page errors and dialog messages for assertions
  let consoleMessages;
  let pageErrors;
  let dialogs;

  // Register listeners before each test to capture errors during navigation/load
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    page.on('console', (msg) => {
      // Capture console messages (log, warn, error, etc.)
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        // ignore any potential issues reading console message
      }
    });

    page.on('pageerror', (err) => {
      // Capture uncaught exceptions from the page (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    page.on('dialog', async (dialog) => {
      // Capture dialog messages and accept to allow tests to continue
      try {
        dialogs.push({ message: dialog.message(), type: dialog.type() });
      } finally {
        await dialog.accept();
      }
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Small sanity check that page is still reachable
    await expect(page).toHaveURL(APP_URL);
  });

  test('Initial Idle state renders correctly with heading, set items and observe button', async ({ page }) => {
    // This test validates the S0_Idle state:
    // - The page renders the title "Sets in Style"
    // - There are 4 set items labeled A, B, C, D
    // - The Observe the Sets button exists with correct onclick attribute
    const app = new AppPage(page);

    // Validate heading text
    const heading = await app.headingText();
    expect(heading).toBeTruthy();
    expect(heading.trim()).toBe('Sets in Style');

    // Validate there are four visual items A-D
    const count = await app.countSetItems();
    expect(count).toBe(4);

    const expectedLabels = ['A', 'B', 'C', 'D'];
    for (let i = 0; i < expectedLabels.length; i++) {
      const text = (await app.setItemTextAt(i))?.trim();
      expect(text).toBe(expectedLabels[i]);
    }

    // Validate the Observe button exists and has the onclick handler attribute as in the HTML
    const onclickAttr = await app.getButtonOnclickAttr();
    expect(onclickAttr).toContain('displayMessage()');

    // Verify that the page did not emit any uncaught exceptions during initial render
    expect(pageErrors.length).toBe(0);

    // Also verify no console error-level messages were emitted (allow informational logs)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Clicking Observe button triggers alert and represents transition to Observed state', async ({ page }) => {
    // This test validates the ObserveButtonClick event and the S1_Observed state's onEntry action:
    // - Clicking the .button triggers displayMessage() which calls alert(...) with the expected text
    // - The onclick attribute exists and matches expectation
    const app = new AppPage(page);

    // Ensure button exists
    await expect(app.observeButton).toBeVisible();

    // Click the button; dialog handler registered in beforeEach will capture and accept the alert
    await app.clickObserve();

    // The dialog should have been captured
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const lastDialog = dialogs[dialogs.length - 1];
    expect(lastDialog.type).toBe('alert');
    expect(lastDialog.message).toBe('Enjoy observing the visual representation of Sets!');

    // Ensure clicking triggered no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Ensure the onclick attribute remains present
    const onclickAttr = await app.getButtonOnclickAttr();
    expect(onclickAttr).toContain('displayMessage()');
  });

  test('Clicking each set item does not throw errors and elements remain unchanged', async ({ page }) => {
    // This test validates clicking the visual components:
    // - Clicking visual items is an expected interaction but there's no JS handler; the app should not error
    // - The DOM content of the items should remain the same after clicks
    const app = new AppPage(page);

    const initialTexts = [];
    const n = await app.countSetItems();
    for (let i = 0; i < n; i++) {
      initialTexts.push((await app.setItemTextAt(i)).trim());
    }

    // Click each item once and again to test idempotence / edge-case rapid interactions
    for (let i = 0; i < n; i++) {
      await app.clickSetItem(i);
      await app.clickSetItem(i);
    }

    // After interactions, texts should remain unchanged
    for (let i = 0; i < n; i++) {
      const text = (await app.setItemTextAt(i)).trim();
      expect(text).toBe(initialTexts[i]);
    }

    // Ensure there were no uncaught page errors triggered by these clicks
    expect(pageErrors.length).toBe(0);

    // Ensure no error-level console messages were emitted
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Rapid multiple Observe clicks produce multiple alerts (edge case)', async ({ page }) => {
    // Edge case test:
    // - If the user clicks the observe button multiple times rapidly, multiple alerts should be produced.
    // - We capture all dialogs via the dialog handler and assert their count and content.
    const app = new AppPage(page);

    // Click the observe button 3 times in quick succession
    await Promise.all([
      app.clickObserve(),
      app.clickObserve(),
      app.clickObserve()
    ]);

    // Since each click creates an alert and the dialog handler accepts them,
    // we expect at least 3 dialog captures. There could be timing differences,
    // but the dialog handler in beforeEach should capture each.
    expect(dialogs.length).toBeGreaterThanOrEqual(3);

    // Validate that each captured dialog has the expected message
    for (let i = 0; i < dialogs.length; i++) {
      expect(dialogs[i].message).toBe('Enjoy observing the visual representation of Sets!');
      expect(dialogs[i].type).toBe('alert');
    }

    // Ensure no uncaught page errors occurred during this rapid interaction
    expect(pageErrors.length).toBe(0);
  });

  test('renderPage is not defined on the window and invoking it causes ReferenceError', async ({ page }) => {
    // This test validates the S0_Idle entry_action mention of renderPage():
    // - The HTML/JS did not define renderPage, so typeof window.renderPage should be 'undefined'
    // - Intentionally attempting to call renderPage() via the page context should produce a ReferenceError.
    // We do not modify the runtime; we only execute the missing function to observe the resulting error.
    const app = new AppPage(page);

    // Verify the function is not defined
    const typeofRenderPage = await app.typeOfRenderPage();
    expect(typeofRenderPage).toBe('undefined');

    // Now attempt to call renderPage() inside the page and capture the thrown error information.
    // We wrap the call in try/catch within the page context so the test can assert on the error
    const invocationResult = await page.evaluate(() => {
      try {
        // This will throw a ReferenceError in the page context because renderPage is not defined
        // We deliberately invoke it to observe the natural ReferenceError.
        // This does not patch or modify the environment; it simply calls a missing function.
        // eslint-disable-next-line no-undef
        renderPage();
        return { success: true };
      } catch (e) {
        // Return the error name and message for assertion back in the test context
        return { success: false, name: e.name, message: e.message };
      }
    });

    // Ensure the invocation failed with a ReferenceError (natural error)
    expect(invocationResult.success).toBe(false);
    // Different browsers/environments might produce slightly different messages; assert on name first
    expect(invocationResult.name).toBe('ReferenceError');
    // Message should at least mention 'renderPage' or 'is not defined' in some form
    expect(invocationResult.message.toLowerCase()).toContain('renderpage');

    // Additionally, the pageerror listener should have captured at least one ReferenceError
    // (depending on the browser, the thrown error may also be surfaced as a pageerror)
    const hasReferenceErrorCaptured = pageErrors.some(err => err.name === 'ReferenceError' || (err.message && err.message.toLowerCase().includes('renderpage')));
    // We assert that either the page recorded the error or our evaluate-caught error exists (which it does).
    expect(invocationResult.success === false || hasReferenceErrorCaptured).toBeTruthy();
  });

  test('No unexpected console errors or page errors across full interaction flow', async ({ page }) => {
    // This end-to-end style test exercises major interactions and then asserts globally that
    // no uncaught exceptions or console errors happened during the flow.
    const app = new AppPage(page);

    // Interact with the page: click some set items and the observe button
    await app.clickSetItem(0);
    await app.clickSetItem(1);
    await app.clickObserve(); // will produce an alert captured in dialogs array

    // Final sanity checks: no uncaught page errors and no console.error messages
    expect(pageErrors.length).toBe(0);
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // Confirm the dialog we triggered was captured
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[dialogs.length - 1].message).toBe('Enjoy observing the visual representation of Sets!');
  });
});