import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a24bb1-fa7b-11f0-8b01-9f078a0ff214.html';

/**
 * Page Object for the SQL demo page.
 * Encapsulates selectors and common interactions.
 */
class SQLDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.showButtonSelector = "button[onclick='showSQLDemo()']";
    this.demoOutputSelector = '#demoOutput';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickShowButton() {
    await this.page.click(this.showButtonSelector);
  }

  async isDemoVisible() {
    // Check computed style to determine visibility
    return await this.page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
    }, this.demoOutputSelector);
  }

  async getDemoInnerText() {
    return await this.page.textContent(this.demoOutputSelector);
  }

  async hasShowFunction() {
    return await this.page.evaluate(() => typeof window.showSQLDemo === 'function');
  }
}

test.describe('Understanding SQL demo - FSM validation and UI behavior', () => {
  // Arrays to collect console and page errors for assertions in tests
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for later inspection
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('Idle state: initial render shows button and demo output is hidden', async ({ page }) => {
    // This validates the initial FSM S0_Idle state: the page is rendered with the button and the demo output hidden.
    const p = new SQLDemoPage(page);
    await p.goto();

    // Ensure the "Show Example Query" button exists and has the expected text.
    const button = await page.locator("button[onclick='showSQLDemo()']");
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('Show Example Query');

    // The demoOutput element should be present in the DOM but initially hidden per the inline style.
    const demo = page.locator('#demoOutput');
    await expect(demo).toHaveCount(1);

    // Check inline style attribute is present with display:none (evidence from FSM/components)
    const inlineStyle = await demo.getAttribute('style');
    expect(inlineStyle).toBeTruthy();
    expect(inlineStyle).toContain('display:none');

    // Check computed visibility is hidden
    const visible = await p.isDemoVisible();
    expect(visible).toBe(false);

    // There should be no uncaught page errors on initial load (the page's JS is small and expected to be valid).
    expect(pageErrors.length).toBe(0);

    // No console errors or severe console messages should have been emitted on load.
    const severe = consoleMessages.find(m => m.type === 'error' || m.type === 'warning');
    expect(severe).toBeUndefined();
  });

  test('Transition: clicking "Show Example Query" triggers showSQLDemo and demo becomes visible (S0 -> S1)', async ({ page }) => {
    // This validates the FSM transition ShowExampleQuery: user clicks the button and the demo output is displayed.
    const p = new SQLDemoPage(page);
    await p.goto();

    // Ensure the function showSQLDemo exists on the page before interacting (S1 entry_action is to call showSQLDemo)
    const hasFunc = await p.hasShowFunction();
    expect(hasFunc).toBe(true);

    // Click the button to trigger the transition
    await p.clickShowButton();

    // After clicking, demoOutput should be visible (demoOutput.style.display === 'block')
    const visibleAfter = await p.isDemoVisible();
    expect(visibleAfter).toBe(true);

    // Verify the demoOutput contains expected content (heading and SQL code snippet)
    const text = await p.getDemoInnerText();
    expect(text).toContain('Example Output');
    expect(text).toContain("SELECT name FROM employees;");

    // Ensure no uncaught errors occurred during the click transition
    expect(pageErrors.length).toBe(0);
  });

  test('Calling showSQLDemo() directly sets demo visible and is idempotent (entry action verification)', async ({ page }) => {
    // Validate that invoking the entry action showSQLDemo() programmatically transitions to DemoVisible
    const p = new SQLDemoPage(page);
    await p.goto();

    // Call the function directly in page context
    const result = await page.evaluate(() => {
      // Call the function; we expect it to exist and set display to 'block'
      // Return the resultant style for assertion
      window.showSQLDemo();
      const el = document.getElementById('demoOutput');
      return el ? el.style.display : null;
    });

    expect(result).toBe('block');

    // Calling it again should not throw and should leave the element visible (idempotency)
    const second = await page.evaluate(() => {
      try {
        window.showSQLDemo();
        const el = document.getElementById('demoOutput');
        return el ? el.style.display : null;
      } catch (e) {
        return { error: e.toString() };
      }
    });

    expect(second).toBe('block');

    // No uncaught page errors from these direct calls
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: clicking button multiple times does not produce errors and demo remains visible', async ({ page }) => {
    // Click multiple times and ensure stability; verifies robustness of the transition/action.
    const p = new SQLDemoPage(page);
    await p.goto();

    // Clear any previously captured messages (from beforeEach)
    consoleMessages = [];
    pageErrors = [];

    // Click the button several times
    for (let i = 0; i < 5; i++) {
      await p.clickShowButton();
    }

    // Demo must be visible
    const visible = await p.isDemoVisible();
    expect(visible).toBe(true);

    // Ensure no uncaught page errors occurred while clicking multiple times
    expect(pageErrors.length).toBe(0);

    // No console error messages
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('FSM entry action renderPage() is not defined on this page -> calling it throws ReferenceError (verify error observation)', async ({ page }) => {
    // The FSM mentions an entry action renderPage() for S0_Idle, but the HTML doesn't define renderPage().
    // We validate that attempting to invoke renderPage() results in a ReferenceError and that a pageerror is emitted.
    const p = new SQLDemoPage(page);
    await p.goto();

    // Prepare to capture a pageerror event that should be triggered by an uncaught exception in the page context.
    // Note: page.evaluate's exception will also be thrown in Node; we assert both the thrown error message and that pageerror was emitted.
    const pageErrorPromise = page.waitForEvent('pageerror').catch(() => null);

    let evalError = null;
    try {
      // Intentionally attempt to call a non-existent function as the FSM suggests. This should fail naturally.
      await page.evaluate(() => {
        // This will throw a ReferenceError in the page context
        renderPage();
      });
    } catch (e) {
      // Playwright surfaces the page exception as an error here. Capture it for assertions.
      evalError = e;
    }

    // We expect the evaluation to have failed with a ReferenceError mention.
    expect(evalError).toBeTruthy();
    // The Playwright error message should include 'ReferenceError' and mention renderPage
    expect(String(evalError.message)).toContain('ReferenceError');

    // Await the pageerror event if it occurred
    const pageErr = await pageErrorPromise;
    // If the browser emitted a pageerror, assert it's a ReferenceError and contains 'renderPage'
    if (pageErr) {
      expect(pageErr.name).toBe('ReferenceError');
      expect(String(pageErr.message)).toContain('renderPage');
    } else {
      // In some environments the page.evaluate rejection is surfaced only to Node and not as pageerror.
      // We still consider the test successful if evalError indicated a ReferenceError.
      expect(evalError).toBeTruthy();
    }
  });

  test('Negative/robustness: attempting to call a non-function property does not get silently swallowed', async ({ page }) => {
    // This test tries to invoke a value that's not a function on purpose to observe behavior.
    // It ensures the page surfaces appropriate errors if code tries to call something that's not callable.
    const p = new SQLDemoPage(page);
    await p.goto();

    // Set a non-function global on the page in a safe way (we are not allowed to redefine existing functions).
    // However, adding a new global here is considered interacting with the page — we will not mutate built-ins.
    // Instead we attempt to call a known non-existent property as a function which should cause a ReferenceError.
    let caught = null;
    try {
      await page.evaluate(() => {
        // Attempt to call a property that doesn't exist: someNonExistentFunc -> ReferenceError
        someNonExistentFunc();
      });
    } catch (e) {
      caught = e;
    }

    expect(caught).toBeTruthy();
    expect(String(caught.message)).toContain('ReferenceError');
  });
});