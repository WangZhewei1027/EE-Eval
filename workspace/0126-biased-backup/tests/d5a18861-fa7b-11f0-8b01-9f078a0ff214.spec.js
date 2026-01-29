import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a18861-fa7b-11f0-8b01-9f078a0ff214.html';

// Page object model for the A* Search demo page
class AStarPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '.button';
    this.h1Selector = 'h1';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeadingText() {
    return this.page.textContent(this.h1Selector);
  }

  async getButtonText() {
    return this.page.textContent(this.buttonSelector);
  }

  async getButtonOnclickAttribute() {
    return this.page.getAttribute(this.buttonSelector, 'onclick');
  }

  async clickDemoButton() {
    await this.page.click(this.buttonSelector);
  }
}

test.describe('A* Search Algorithm Interactive Page - FSM tests (S0_Idle)', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    // Capture uncaught errors on the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Clear listeners to avoid cross-test leakage
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
    // ensure no modal dialogs remain (should be none)
    // Accept any unexpected dialog to not block further tests in some environments
    page.on('dialog', async (dialog) => {
      await dialog.dismiss().catch(() => {});
    });
  });

  test('Initial state S0_Idle: page loads and shows main content and demo button', async ({ page }) => {
    // This test validates the Idle state rendering and the presence of evidence elements (button)
    const p = new AStarPage(page);

    // Verify heading exists and has expected content
    const heading = await p.getHeadingText();
    expect(heading).toBeTruthy();
    expect(heading).toContain('A* Search Algorithm');

    // Verify demo button exists with the expected text
    const buttonText = await p.getButtonText();
    expect(buttonText).toBe('Show A* Search Demo');

    // Verify the button has the expected CSS class
    const buttonHandle = await page.$('.button');
    expect(buttonHandle).not.toBeNull();

    // Verify the onclick attribute evidence exists and contains the expected alert call
    const onclickAttr = await p.getButtonOnclickAttribute();
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("alert('Demonstration of A* Search will be developed in future versions!')");

    // Ensure no page-level errors were emitted synchronously on load
    expect(pageErrors.length).toBe(0);
  });

  test('Transition ShowDemo: clicking the demo button displays an alert with expected message', async ({ page }) => {
    // This test validates the transition triggered by the ShowDemo event (click on .button)
    // and asserts the expected observable: an alert dialog with the correct message.
    const p = new AStarPage(page);

    // Listen for the dialog event and assert message content
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      p.clickDemoButton(), // trigger the event
    ]);

    const expectedMessage = "Demonstration of A* Search will be developed in future versions!";
    expect(dialog.message()).toBe(expectedMessage);

    // Accept the dialog to continue
    await dialog.accept();

    // Confirm no page error was emitted as a result of this interaction
    expect(pageErrors.length).toBe(0);

    // Confirm no console error-level messages occurred
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition ShowDemo: multiple rapid clicks produce multiple alert dialogs', async ({ page }) => {
    // This test checks edge case behavior: clicking the demo button multiple times rapidly
    // should trigger an alert each time (the code uses inline onclick alert).
    const p = new AStarPage(page);

    const expectedMessage = "Demonstration of A* Search will be developed in future versions!";

    // We'll click the button 3 times and capture 3 dialogs sequentially.
    const dialogs = [];
    for (let i = 0; i < 3; i++) {
      // Wait for dialog created by each click
      const promiseDialog = page.waitForEvent('dialog');
      await p.clickDemoButton();
      const dialog = await promiseDialog;
      dialogs.push(dialog);
      // assert message on each dialog
      expect(dialog.message()).toBe(expectedMessage);
      await dialog.accept();
    }

    // Ensure we captured exactly 3 dialogs in this test context
    expect(dialogs.length).toBe(3);

    // Verify again that no page errors were emitted
    expect(pageErrors.length).toBe(0);
  });

  test('Entry action renderPage() verification: calling undefined renderPage should throw (let runtime error happen naturally)', async ({ page }) => {
    // The FSM metadata lists an entry action "renderPage()".
    // The HTML implementation does not define renderPage; this test intentionally
    // attempts to call renderPage() in the page context and asserts that calling it
    // results in a runtime error (ReferenceError or similar). We do NOT patch the page.
    // We allow the natural error to occur and assert on it.

    // Attempt to call renderPage() inside the page context and expect the evaluate to reject.
    // Note: Playwright will surface the page error as a rejected promise from evaluate.
    // We assert that the rejection message contains 'renderPage' which indicates the expected failure path.
    await expect(page.evaluate(() => {
      // Intentionally call the function expected by FSM entry action:
      // this will throw if renderPage is not defined (ReferenceError).
      // We deliberately do not catch it here: let it bubble up to the test runner.
      // This simulates observing an onEnter action failing naturally.
      // eslint-disable-next-line no-undef
      return renderPage();
    })).rejects.toThrow(/renderPage/);
  });

  test('DOM evidence check: ensure button has correct inline onclick code string', async ({ page }) => {
    // This test asserts the string form of the onclick attribute matches the FSM evidence exactly.
    const p = new AStarPage(page);
    const onclickAttr = await p.getButtonOnclickAttribute();

    // The FSM evidence includes the exact attribute declaration
    const expectedSnippet = "alert('Demonstration of A* Search will be developed in future versions!')";
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain(expectedSnippet);
  });

  test('Edge case: invoking button via keyboard (Enter) triggers alert dialog', async ({ page }) => {
    // This test ensures accessibility/keyboard activation also triggers the same ShowDemo transition.
    const p = new AStarPage(page);

    // Focus the button and press Enter
    await page.focus('.button');

    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.keyboard.press('Enter'),
    ]);

    const expectedMessage = "Demonstration of A* Search will be developed in future versions!";
    expect(dialog.message()).toBe(expectedMessage);
    await dialog.accept();

    // No unexpected page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Sanity: ensure no unexpected console errors during interactions', async ({ page }) => {
    // This test performs a variety of interactions and then asserts that no console
    // messages of type 'error' were emitted at any point of the test run.
    const p = new AStarPage(page);

    // Perform actions: click once, focus and press Enter (two different triggers)
    const dialog1 = page.waitForEvent('dialog');
    await p.clickDemoButton();
    (await dialog1).accept();

    const dialog2 = page.waitForEvent('dialog');
    await page.focus('.button');
    await page.keyboard.press('Enter');
    (await dialog2).accept();

    // Inspect captured console messages
    const errorConsoleMessages = consoleMessages.filter((m) => m.type === 'error');

    // Assert there were no console errors during these interactions
    expect(errorConsoleMessages.length).toBe(0);

    // Also assert there were no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });
});