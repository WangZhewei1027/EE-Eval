import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a3ab42-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object encapsulating interactions and selectors for the app
class AuthenticationPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = 'button[onclick]';
    this.expectedAlertText = "This is a simple demonstration of the authentication process!";
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure main content loaded
    await expect(this.page.locator('h1')).toHaveText('Understanding Authentication');
  }

  async getDemoButton() {
    return this.page.locator(this.buttonSelector);
  }

  async getDemoButtonText() {
    return (await this.getDemoButton()).innerText();
  }

  async getOnclickAttribute() {
    return this.page.getAttribute(this.buttonSelector, 'onclick');
  }

  // Clicks the demo button and returns the dialog object (after accepting it)
  async clickAndAcceptDemoAlert() {
    // Wait for dialog and perform click concurrently so we capture the dialog
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.click(this.buttonSelector)
    ]);
    const message = dialog.message();
    await dialog.accept();
    return message;
  }

  // Clicks the demo button but returns the dialog object without accepting it
  // Note: Leaving dialog open may block further interactions. Use with care.
  async clickDemoAlertWithoutAccepting() {
    const [dialog] = await Promise.all([
      this.page.waitForEvent('dialog'),
      this.page.click(this.buttonSelector)
    ]);
    return dialog;
  }
}

test.describe('Understanding Authentication (FSM) - d5a3ab42-fa7b-11f0-8b01-9f078a0ff214', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // No global setup required beyond default Playwright fixtures
  });

  test.afterEach(async ({ page }) => {
    // nothing special to teardown, Playwright cleans up the page fixture
  });

  test.describe('State S0_Idle - Initial render and component presence', () => {
    test('S0_Idle: Page renders, button present, onclick attribute exists, and renderPage is not defined', async ({ page }) => {
      // This test validates the initial Idle state:
      // - page content rendered
      // - demo button present with expected text and onclick attribute
      // - FSM entry action renderPage() is not present in the global scope (we assert it is undefined)
      const auth = new AuthenticationPage(page);

      // Collect console and page errors
      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      await auth.goto();

      // Verify the demo button exists and has the correct visible text
      const button = await auth.getDemoButton();
      await expect(button).toBeVisible();
      await expect(button).toHaveText('Click for a Simple Demo');

      // Verify the inline onclick attribute is present and contains the expected alert text
      const onclickAttr = await auth.getOnclickAttribute();
      expect(onclickAttr).toContain("alert('This is a simple demonstration of the authentication process!')");

      // Verify that renderPage is NOT defined on the window (matching the instruction to observe missing entry action)
      const renderPageValue = await page.evaluate(() => typeof window.renderPage);
      expect(renderPageValue).toBe('undefined');

      // Ensure no page errors were emitted during initial render
      expect(pageErrors).toEqual([]);

      // Ensure console does not contain error-level messages at initial render
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });
  });

  test.describe('Transitions: ClickDemoButton => Alerts and state cycling', () => {
    test('S0_Idle -> S1_DemoAlert: clicking button shows alert with expected message', async ({ page }) => {
      // This test validates that clicking the demo button triggers the alert (Demo Alert state)
      const auth = new AuthenticationPage(page);

      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      await auth.goto();

      // Click and accept the alert, ensuring message matches FSM expectation
      const message = await auth.clickAndAcceptDemoAlert();
      expect(message).toBe(auth.expectedAlertText);

      // After accepting the alert, the app should be back in Idle: the button should still be present and clickable
      const button = await auth.getDemoButton();
      await expect(button).toBeVisible();

      // No unexpected page errors should have occurred during the transition
      expect(pageErrors.length).toBe(0);

      // No console error messages
      const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
      expect(errorConsoleMessages.length).toBe(0);
    });

    test('S1_DemoAlert -> S0_Idle: alert can be dismissed and subsequent clicks reopen alert (cycle)', async ({ page }) => {
      // This test validates the round-trip transition:
      // - Click to show alert (enter DemoAlert)
      // - Accept to close alert (return to Idle)
      // - Click again to re-enter DemoAlert
      const auth = new AuthenticationPage(page);

      await auth.goto();

      // First cycle
      const firstMessage = await auth.clickAndAcceptDemoAlert();
      expect(firstMessage).toBe(auth.expectedAlertText);

      // After closing first alert, ensure we can trigger it again
      const secondMessage = await auth.clickAndAcceptDemoAlert();
      expect(secondMessage).toBe(auth.expectedAlertText);

      // The DOM should remain intact: demo button still present
      const button = await auth.getDemoButton();
      await expect(button).toBeVisible();
    });

    test('Edge case: invoking missing renderPage function throws ReferenceError in page context', async ({ page }) => {
      // The FSM indicated an entry action renderPage(), but the implementation does not define it.
      // This test intentionally invokes the missing function in the page context to observe the natural ReferenceError.
      // We assert that the evaluate rejects with ReferenceError and that a pageerror is emitted.
      const auth = new AuthenticationPage(page);

      const pageErrors = [];
      page.on('pageerror', err => pageErrors.push(err));

      await auth.goto();

      // Calling renderPage in the page context should reject with a ReferenceError
      let caught = null;
      try {
        await page.evaluate(() => {
          // Intentionally call a non-existent function to allow the runtime to produce an error
          return renderPage();
        });
      } catch (e) {
        caught = e;
      }

      // We expect an exception was thrown in the evaluate call
      expect(caught).not.toBeNull();
      // The thrown error message should indicate renderPage is not defined (Environment dependent wording tested loosely)
      expect(String(caught.message)).toMatch(/renderPage|is not defined|not defined/);

      // The pageerror event should have captured at least one error corresponding to the missing global
      // Note: Depending on browser and Playwright timing, pageerror may be reported or the evaluate rejection may suffice.
      // We assert that either a pageerror with matching message was captured OR the evaluate error indicates the issue.
      const hasReferenceErrorInPageErrors = pageErrors.some(err => /renderPage|is not defined|not defined/.test(String(err.message)));
      expect(hasReferenceErrorInPageErrors || /renderPage|is not defined|not defined/.test(String(caught.message))).toBeTruthy();
    });

    test('Edge case: rapid sequential clicks reopen alert reliably after accepting previous one', async ({ page }) => {
      // This test checks robustness: accept alert quickly and immediately re-click to ensure app returns to Idle properly
      const auth = new AuthenticationPage(page);

      await auth.goto();

      // First show and accept
      const firstMessage = await auth.clickAndAcceptDemoAlert();
      expect(firstMessage).toBe(auth.expectedAlertText);

      // Immediately trigger again and accept
      const secondMessagePromise = auth.clickAndAcceptDemoAlert();
      const secondMessage = await secondMessagePromise;
      expect(secondMessage).toBe(auth.expectedAlertText);
    });
  });

  test.describe('Observability: console and page error monitoring during interactions', () => {
    test('No unexpected console errors or page errors are emitted during normal usage', async ({ page }) => {
      // This test performs the normal user flow and asserts there are no console-level error messages
      // and no unhandled page exceptions during normal usage.
      const auth = new AuthenticationPage(page);

      const consoleMessages = [];
      const pageErrors = [];
      page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
      page.on('pageerror', err => pageErrors.push(err));

      await auth.goto();

      // Perform a normal click-accept-click sequence
      const msg1 = await auth.clickAndAcceptDemoAlert();
      expect(msg1).toBe(auth.expectedAlertText);

      const msg2 = await auth.clickAndAcceptDemoAlert();
      expect(msg2).toBe(auth.expectedAlertText);

      // Validate no unhandled page errors
      expect(pageErrors.length).toBe(0);

      // Validate no console errors were emitted during these interactions
      const errors = consoleMessages.filter(m => m.type === 'error');
      expect(errors.length).toBe(0);
    });

    test('Attempting to click a non-existent selector results in a Playwright error (error scenario)', async ({ page }) => {
      // This negative test intentionally clicks a selector that does not exist to validate the runtime error handling.
      // We expect Playwright to throw when trying to click a missing element.
      await page.goto(APP_URL);

      let thrown = null;
      try {
        await page.click('button#non-existent-button', { timeout: 1000 });
      } catch (e) {
        thrown = e;
      }

      // Playwright should have thrown an error indicating the element was not found
      expect(thrown).not.toBeNull();
      expect(String(thrown.message)).toMatch(/element|strict|not found|timeout|No element/);
    });
  });
});