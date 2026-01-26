import { test, expect } from '@playwright/test';

// Test file for Application ID: 04439492-fa79-11f0-8a8e-bbe4f11717c6
// URL under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/04439492-fa79-11f0-8a8e-bbe4f11717c6.html

// Page Object for the Deadlock demo
class DeadlockPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/04439492-fa79-11f0-8a8e-bbe4f11717c6.html';
    this.container = page.locator('.container');
    this.header = page.locator('.header h1');
    this.button = page.locator('.button');
    this.content = page.locator('.content');
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async clickSimulate() {
    await this.button.click();
  }

  async getButtonOnclick() {
    return await this.button.getAttribute('onclick');
  }

  async getButtonText() {
    return await this.button.textContent();
  }

  async getHeaderText() {
    return await this.header.textContent();
  }
}

test.describe('Deadlock App - FSM validation and interactions', () => {
  // Keep arrays per test to capture console messages and uncaught page errors.
  test.beforeEach(async ({ page }) => {
    // Ensure a clean console/error capture for each test
    page.context()._consoleMessages = [];
    page.context()._pageErrors = [];

    page.on('console', msg => {
      // Capture console messages for optional assertions / debugging
      page.context()._consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    page.on('pageerror', err => {
      // Capture uncaught exceptions
      page.context()._pageErrors.push(err);
    });
  });

  test('Initial render - Idle state (S0_Idle) elements are present and correct', async ({ page }) => {
    // This test validates the initial UI matches the Idle state evidence:
    // - The button exists with class .button and text "Click me"
    // - The button's onclick attribute references deadlock()
    const deadlock = new DeadlockPage(page);
    await deadlock.goto();

    // Verify main container and header exist
    await expect(deadlock.container).toBeVisible();
    await expect(deadlock.header).toBeVisible();
    const headerText = await deadlock.getHeaderText();
    expect(headerText).toContain('Deadlock');

    // Verify descriptive content exists
    await expect(deadlock.content.locator('p')).toBeVisible();

    // Verify the interactive component from FSM: the button
    await expect(deadlock.button).toBeVisible();
    const btnText = (await deadlock.getButtonText())?.trim();
    expect(btnText).toBe('Click me');

    // The FSM evidence includes an onclick handler: check attribute exists and contains deadlock()
    const onclickAttr = await deadlock.getButtonOnclick();
    expect(typeof onclickAttr).toBe('string');
    expect(onclickAttr).toContain('deadlock()');

    // Assert that no uncaught page errors occurred during initial render
    // (we capture errors into the page context in beforeEach)
    const pageErrors = page.context()._pageErrors || [];
    expect(Array.isArray(pageErrors)).toBeTruthy();
    // It's expected that the provided HTML should not produce uncaught exceptions on load
    expect(pageErrors.length).toBe(0);
  });

  test('Transition: clicking the button triggers deadlock() alerts (S0_Idle -> S1_Deadlock_Simulated)', async ({ page }) => {
    // This test validates the ButtonClick event and the S1_Deadlock_Simulated state:
    // - Clicking the button triggers two alerts with the expected messages in order.
    const deadlock = new DeadlockPage(page);
    await deadlock.goto();

    // Collect dialog events (alerts)
    const dialogs = [];
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      // Accept to allow the page script to continue
      await dialog.accept();
    });

    // Click the button to trigger the deadlock() function which issues two alerts.
    await deadlock.clickSimulate();

    // Wait briefly to ensure both dialogs were emitted and handled.
    // The page's script shows two consecutive alerts; our handler accepts both.
    await page.waitForTimeout(200);

    // Assert that exactly two dialogs (alerts) were shown
    expect(dialogs.length).toBe(2);

    // Verify messages match the FSM "evidence" entry actions
    expect(dialogs[0].type).toBe('alert');
    expect(dialogs[0].message).toBe('Thread 1 is waiting for Thread 2 to release a resource...');

    expect(dialogs[1].type).toBe('alert');
    expect(dialogs[1].message).toBe('Thread 2 is waiting for Thread 1 to release a resource...');

    // No uncaught page errors should have been produced by clicking & alert handling
    const pageErrors = page.context()._pageErrors || [];
    expect(pageErrors.length).toBe(0);
  });

  test('Verify onEnter action renderPage() is not defined and calling it yields ReferenceError', async ({ page }) => {
    // The FSM mentions an entry_action "renderPage()" for S0_Idle.
    // The provided HTML does not define renderPage(). We verify that:
    // - typeof renderPage is "undefined"
    // - attempting to call it (from page context) results in a ReferenceError that we can observe.
    const deadlock = new DeadlockPage(page);
    await deadlock.goto();

    // Check typeof renderPage in page context
    const typeofRenderPage = await page.evaluate(() => {
      return typeof window.renderPage;
    });
    expect(typeofRenderPage).toBe('undefined');

    // Attempt to call renderPage() inside the page context and capture the thrown error
    // We catch it inside the page function so the test runner does not fail with an unhandled exception.
    const callResult = await page.evaluate(() => {
      try {
        // Intentionally call the missing function to allow a ReferenceError to be thrown naturally in the page context
        // and then catch it to return its details.
        // This does not modify any globals; it simply invokes an identifier that does not exist.
        renderPage();
        return { success: true };
      } catch (err) {
        return {
          success: false,
          name: err && err.name ? err.name : String(typeof err),
          message: err && err.message ? err.message : String(err)
        };
      }
    });

    // The missing function should have thrown a ReferenceError in the page context.
    expect(callResult.success).toBe(false);
    expect(callResult.name).toBe('ReferenceError');
    expect(callResult.message).toMatch(/renderPage|renderPage is not defined/);
  });

  test('Edge cases: capture and assert common JS errors (SyntaxError and TypeError) inside page context', async ({ page }) => {
    // This test intentionally triggers two different error types inside the page context
    // to validate how the app/environment reports them. These are edge-case simulations,
    // performed within page.evaluate (no globals are persisted beyond the evaluation).
    const deadlock = new DeadlockPage(page);
    await deadlock.goto();

    // 1) SyntaxError via malformed eval
    const syntaxResult = await page.evaluate(() => {
      try {
        // Intentionally evaluate malformed code to cause a SyntaxError
        eval('function broken(');
        return { threw: false };
      } catch (e) {
        return { threw: true, name: e && e.name ? e.name : null, message: e && e.message ? e.message : null };
      }
    });
    expect(syntaxResult.threw).toBe(true);
    expect(syntaxResult.name).toBe('SyntaxError');

    // 2) TypeError from trying to call a property on null
    const typeResult = await page.evaluate(() => {
      try {
        // This will throw a TypeError: cannot read property 'f' of null OR null is not an object...
        null.f();
        return { threw: false };
      } catch (e) {
        return { threw: true, name: e && e.name ? e.name : null, message: e && e.message ? e.message : null };
      }
    });
    expect(typeResult.threw).toBe(true);
    // Different browsers/runtimes may produce slightly different message text, but the name should be TypeError
    expect(typeResult.name).toBe('TypeError');
  });

  test('Observe console messages and ensure console capture works', async ({ page }) => {
    // This test verifies that console events are being observed and collected.
    // The page itself doesn't log to console in the provided HTML; we assert that the capture array exists
    // and is an array. We then, inside the page context, write a console message and validate its capture.
    const deadlock = new DeadlockPage(page);
    await deadlock.goto();

    // Ensure captured console messages start empty
    let initialConsole = page.context()._consoleMessages || [];
    expect(Array.isArray(initialConsole)).toBeTruthy();

    // Emit a console.log inside the page and ensure it is captured by our listener
    const uniqueMessage = 'playwright-console-test-' + Date.now();
    await page.evaluate(msg => console.log(msg), uniqueMessage);

    // Wait briefly for the console event to be propagated to the test runner
    await page.waitForTimeout(50);

    const consoleMessages = page.context()._consoleMessages || [];
    // There should be at least one captured message that includes our unique message
    const found = consoleMessages.some(entry => entry.text && entry.text.includes(uniqueMessage));
    expect(found).toBeTruthy();
  });
});