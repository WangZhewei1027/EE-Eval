import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a0ec21-fa7b-11f0-8b01-9f078a0ff214.html';

// Page Object for the Heap Sort page
class HeapSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      heading: 'h1',
      demoButton: '.btn',
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getHeadingText() {
    return this.page.textContent(this.selectors.heading);
  }

  async getButtonText() {
    return this.page.textContent(this.selectors.demoButton);
  }

  async clickDemo() {
    await this.page.click(this.selectors.demoButton);
  }

  async focusDemoButton() {
    await this.page.focus(this.selectors.demoButton);
  }

  async getButtonOnclickAttr() {
    return this.page.getAttribute(this.selectors.demoButton, 'onclick');
  }

  async hasFunctionInPage(funcName) {
    return this.page.evaluate((name) => typeof window[name], funcName);
  }
}

test.describe('Heap Sort Explained - FSM and UI tests (Application ID: d5a0ec21-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Collect console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Attach listeners to capture runtime issues and console output
    page.__consoleErrors = [];
    page.__pageErrors = [];

    page.on('console', (msg) => {
      // capture console error/warning/info messages for assertions
      const entry = { type: msg.type(), text: msg.text() };
      page.__consoleErrors.push(entry);
    });

    page.on('pageerror', (err) => {
      // capture uncaught exceptions
      page.__pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Small pause to let any async errors surface
    await page.waitForTimeout(50);
    // Expose arrays to logs for debugging if needed (but do not modify page)
  });

  test('S0_Idle state: initial render displays expected heading and button (verifies Idle state evidence)', async ({ page }) => {
    // This test validates the Idle state S0_Idle:
    // - The page should load and render the H1 heading that evidences S0_Idle.
    // - The "Show Heap Sort Demonstration" link/button should be present.
    // - Verify that the FSM-declared onEnter action "renderPage" is not present in the page (i.e., not inadvertently defined).
    const heapPage = new HeapSortPage(page);
    await heapPage.goto();

    // Assert heading text matches FSM evidence
    const headingText = await heapPage.getHeadingText();
    expect(headingText).toBeTruthy();
    expect(headingText).toContain('Heap Sort: A Comprehensive Explanation');

    // Assert button exists and has the expected visible text from the component extraction
    const btnText = await heapPage.getButtonText();
    expect(btnText).toBeTruthy();
    expect(btnText).toContain('Show Heap Sort Demonstration');

    // Verify the onclick attribute references displayDemo() as described in FSM evidence
    const onclickAttr = await heapPage.getButtonOnclickAttr();
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain('displayDemo');

    // Verify whether a function named renderPage exists in the page context.
    // FSM mentions renderPage() as an entry action for S0_Idle. The implementation does not define it.
    // We assert that renderPage is not defined to show the implementation did not execute that FSM action.
    const renderPageType = await heapPage.hasFunctionInPage('renderPage');
    expect(renderPageType).toBe('undefined');

    // Ensure there were no page errors or console errors during initial load
    expect(page.__pageErrors.length).toBe(0);
    // Filter console messages for error severity
    const consoleErrorCount = page.__consoleErrors.filter(c => c.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('S1_DemoDisplayed state: clicking the demo button triggers an alert with expected demo text (verifies transition ShowDemo)', async ({ page }) => {
    // This test validates the transition from S0_Idle to S1_DemoDisplayed triggered by ShowDemo event:
    // - Click the .btn link and expect an alert dialog containing the demo text (evidence: alert(demoText))
    // - Verify no unexpected runtime/page errors occur as a result of the click.
    const heapPage = new HeapSortPage(page);
    await heapPage.goto();

    // Prepare to capture dialogs
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      // Capture type and message, then accept the alert so the page can continue.
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Ensure displayDemo function exists as it's referenced by the onclick attribute.
    const displayDemoType = await heapPage.hasFunctionInPage('displayDemo');
    expect(displayDemoType).toBe('function');

    // Click the button to trigger the alert
    await heapPage.clickDemo();

    // Wait a small amount to ensure the dialog handler runs
    await page.waitForTimeout(50);

    // Assert that a dialog was shown and its content contains expected phrasing
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const alertMessage = dialogs[0].message;
    expect(alertMessage).toContain('Heap Sort is a classical sorting algorithm');
    expect(dialogs[0].type).toBe('alert');

    // Verify that after handling the alert there were no uncaught exceptions
    expect(page.__pageErrors.length).toBe(0);
    const consoleErrorCount = page.__consoleErrors.filter(c => c.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Edge cases: multiple activations and keyboard activation produce repeated alerts and do not introduce errors', async ({ page }) => {
    // This test covers edge cases:
    // - Clicking the demo button multiple times should produce multiple alerts.
    // - Activating the link via keyboard (Enter) should also trigger the demo.
    // - No runtime errors should be produced during repeated activations.
    const heapPage = new HeapSortPage(page);
    await heapPage.goto();

    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    // Click it twice in succession (handled by accepting each alert)
    await heapPage.clickDemo();
    await page.waitForTimeout(30);
    await heapPage.clickDemo();
    await page.waitForTimeout(30);

    // Focus and press Enter to trigger third activation
    await heapPage.focusDemoButton();
    await page.keyboard.press('Enter');
    await page.waitForTimeout(50);

    // Verify three alerts were shown
    expect(dialogs.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < 3; i++) {
      expect(dialogs[i].type).toBe('alert');
      expect(dialogs[i].message).toContain('Heap Sort is a classical sorting algorithm');
    }

    // Ensure DOM is still intact: heading remains
    const headingText = await heapPage.getHeadingText();
    expect(headingText).toContain('Heap Sort: A Comprehensive Explanation');

    // Confirm no uncaught exceptions were emitted during repeated interactions
    expect(page.__pageErrors.length).toBe(0);
    const consoleErrorCount = page.__consoleErrors.filter(c => c.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('FSM evidence verification: check transition evidence and ensure displayDemo exists but renderPage does not (verifies expected onEnter/onExit actions mentioned in FSM)', async ({ page }) => {
    // This test explicitly checks FSM-provided evidence:
    // - The link element uses onclick="displayDemo()" as in FSM evidence.
    // - displayDemo function exists on the page.
    // - renderPage (entry action for S0_Idle per FSM) is not present (verify onEnter action is not invoked/defined).
    const heapPage = new HeapSortPage(page);
    await heapPage.goto();

    // Check the onclick attribute again to be thorough
    const onclickAttr = await heapPage.getButtonOnclickAttr();
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain('displayDemo()');

    // Confirm displayDemo is defined and callable type is 'function'
    const displayDemoType = await heapPage.hasFunctionInPage('displayDemo');
    expect(displayDemoType).toBe('function');

    // Confirm renderPage is not defined
    const renderPageType = await heapPage.hasFunctionInPage('renderPage');
    expect(renderPageType).toBe('undefined');

    // No runtime errors emitted on page load
    expect(page.__pageErrors.length).toBe(0);
    const consoleErrorCount = page.__consoleErrors.filter(c => c.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  test('Negative check: ensure there are no unexpected ReferenceError/TypeError/SyntaxError on page load and interaction', async ({ page }) => {
    // This test explicitly observes console/page errors and asserts none of the common JS fatal error types occurred.
    const heapPage = new HeapSortPage(page);
    await heapPage.goto();

    // Interact once to surface potential deferred errors
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.accept();
    });

    // Trigger demo to ensure any code executed by displayDemo is also observed for errors
    await heapPage.clickDemo();
    await page.waitForTimeout(50);

    // Check captured page errors
    const pageErrors = page.__pageErrors.map(e => String(e));
    // Fail if any page error is of the critical types
    for (const err of pageErrors) {
      expect(err).not.toContain('ReferenceError');
      expect(err).not.toContain('TypeError');
      expect(err).not.toContain('SyntaxError');
    }

    // Check console errors
    const consoleErrors = page.__consoleErrors.filter(c => c.type === 'error').map(c => c.text);
    for (const msg of consoleErrors) {
      expect(msg).not.toContain('ReferenceError');
      expect(msg).not.toContain('TypeError');
      expect(msg).not.toContain('SyntaxError');
    }

    // If there are any console/page errors at all, fail the test to surface issues.
    expect(page.__pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});