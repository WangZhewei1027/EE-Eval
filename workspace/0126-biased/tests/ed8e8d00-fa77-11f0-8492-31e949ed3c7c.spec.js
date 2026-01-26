import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8e8d00-fa77-11f0-8492-31e949ed3c7c.html';

/**
 * Page Object Model for the Visual Thread application.
 * Encapsulates common selectors and interactions to keep tests readable.
 */
class VisualThreadPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.container = page.locator('.container');
    this.header = page.locator('h1');
    this.paragraph = page.locator('p');
    this.button = page.locator('.button');
    this.threads = page.locator('.thread');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getHeaderText() {
    return this.header.textContent();
  }

  async getParagraphText() {
    return this.paragraph.textContent();
  }

  async getButtonText() {
    return this.button.textContent();
  }

  async clickObserve() {
    await this.button.click();
  }

  async threadsCount() {
    return this.threads.count();
  }

  async getButtonOnclickAttribute() {
    return this.page.locator('.button').getAttribute('onclick');
  }
}

test.describe('Visual Thread - FSM states and transitions', () => {
  // Arrays to collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  // Reset arrays before each test and attach listeners
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages (info, log, error etc.)
    page.on('console', (msg) => {
      try {
        const text = msg.text();
        consoleMessages.push({ type: msg.type(), text });
      } catch (e) {
        // If reading console message fails, push a placeholder
        consoleMessages.push({ type: 'unknown', text: '<unreadable>' });
      }
    });

    // Collect uncaught errors on page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('Initial load (S0_Idle) - DOM and visual elements are present and no unexpected runtime errors', async ({ page }) => {
    // This test validates the Idle state's render: presence of header, paragraph, button and threads.
    const vt = new VisualThreadPage(page);
    await vt.goto();

    // Check header and paragraph content
    await expect(vt.header).toHaveCount(1);
    expect(await vt.getHeaderText()).toContain('Visual Thread');

    await expect(vt.paragraph).toHaveCount(1);
    expect(await vt.getParagraphText()).toContain('Observe the beauty of design and interaction.');

    // Check the Observe button exists and has correct text
    await expect(vt.button).toBeVisible();
    expect((await vt.getButtonText()).trim()).toBe('Observe');

    // Ensure the inline onclick attribute exists and contains the expected alert call evidence from FSM
    const onclickAttr = await vt.getButtonOnclickAttribute();
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("alert('You are observing beauty!'");

    // Ensure the decorative thread items are present (expected 5 in the implementation)
    const threadsCount = await vt.threadsCount();
    expect(threadsCount).toBe(5);

    // Confirm there are no uncaught runtime errors on initial load (we expect none from the provided HTML)
    expect(pageErrors.length).toBe(0);

    // There should not be any console logs on pure load in this simple page (no startup logs in implementation)
    // But we don't fail if there are warnings; just assert there are no severe errors captured as page errors
  });

  test('Click Observe (ButtonClick event) transitions to Observed state (S1_Observed): alert is shown and console log occurs', async ({ page }) => {
    // This test validates the transition triggered by clicking the Observe button:
    // - alert('You are observing beauty!') should appear (from inline onclick)
    // - console log "Button clicked: Observe" should be emitted by the attached event listener
    const vt = new VisualThreadPage(page);
    await vt.goto();

    // Prepare to capture the dialog and console message
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      // capture message, then accept to continue flow
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      await dialog.accept();
    });

    const consoleEntries = [];
    page.on('console', (msg) => {
      consoleEntries.push({ type: msg.type(), text: msg.text() });
    });

    // Click the button and wait for the alert dialog event
    // Using waitForEvent ensures we wait for the modal to appear
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      vt.button.click(),
    ]);

    // Validate alert content (onEnter action for S1_Observed)
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe('You are observing beauty!');
    // The dialog handler registered above will accept the dialog; but we already validated it via the returned dialog

    // The event listener added in the script logs to console; ensure that message is emitted
    // Wait a short time to ensure console message arrives
    await page.waitForTimeout(50);

    const foundConsoleLog = consoleEntries.find((c) => c.text.includes('Button clicked: Observe'));
    expect(foundConsoleLog).toBeTruthy();

    // No uncaught page errors should have occurred during the transition
    expect(pageErrors.length).toBe(0);
  });

  test('S0 entry action "renderPage()" is not defined on the page - invoking it causes a ReferenceError (edge-case validation)', async ({ page }) => {
    // The FSM specified an entry action renderPage(). The provided HTML does not define renderPage.
    // This test attempts to call renderPage() in-page to assert that doing so throws a ReferenceError naturally.
    const vt = new VisualThreadPage(page);
    await vt.goto();

    // Attempting to call renderPage() should naturally result in a runtime error in the page context.
    // We assert that page.evaluate rejects with an error mentioning renderPage / ReferenceError.
    // Use expect(...).rejects.toThrow to assert the rejection.
    await expect(page.evaluate(() => {
      // Direct call to undefined function to provoke a ReferenceError in the page context
      // eslint-disable-next-line no-undef
      return renderPage();
    })).rejects.toThrow(/renderPage|ReferenceError/);

    // Additionally ensure that such an attempt registered as a pageerror if it were uncaught.
    // Note: page.evaluate rejection is enough; pageerror may or may not be emitted depending on the runtime.
    // We assert that any captured pageErrors (if any) include ReferenceError when they exist.
    if (pageErrors.length > 0) {
      const hasReferenceError = pageErrors.some((err) => /ReferenceError|renderPage/.test(String(err)));
      expect(hasReferenceError).toBeTruthy();
    }
  });

  test('Multiple rapid clicks: each click produces an alert and a console log (robustness / interaction stress)', async ({ page }) => {
    // This test ensures that repeated interactions are handled consistently and produce expected observables.
    const vt = new VisualThreadPage(page);
    await vt.goto();

    const capturedDialogs = [];
    page.on('dialog', async (dialog) => {
      capturedDialogs.push(dialog.message());
      await dialog.accept();
    });

    const consoleLogs = [];
    page.on('console', (msg) => {
      consoleLogs.push({ type: msg.type(), text: msg.text() });
    });

    // Perform a small sequence of clicks; handle each alert via the dialog handler above.
    const clickCount = 3;
    for (let i = 0; i < clickCount; i++) {
      // Wait for dialog specifically for each click to avoid race conditions
      const dialogPromise = page.waitForEvent('dialog');
      await vt.button.click();
      const d = await dialogPromise;
      expect(d).toBeTruthy();
      expect(d.type()).toBe('alert');
      expect(d.message()).toBe('You are observing beauty!');
      // Accepting is handled by page.on('dialog') listener; ensure we processed it
      // Small pause to allow console log to be emitted and captured
      await page.waitForTimeout(50);
    }

    // After interactions, verify we captured the expected number of alerts
    expect(capturedDialogs.length).toBe(clickCount);

    // Verify console log count: we expect at least one log per click that contains the signature message.
    const logsWithSignature = consoleLogs.filter(c => c.text.includes('Button clicked: Observe'));
    expect(logsWithSignature.length).toBeGreaterThanOrEqual(clickCount);

    // No uncaught runtime errors should have been thrown during repeated interaction
    expect(pageErrors.length).toBe(0);
  });

  test('Explicit error scenario: calling a clearly non-existent function throws a ReferenceError (assert natural error propagation)', async ({ page }) => {
    // This test deliberately calls a missing function name (nonExistentFn) in the page context
    // to verify that ReferenceError is thrown and allowed to propagate naturally.
    await page.goto(APP_URL);

    await expect(page.evaluate(() => {
      // eslint-disable-next-line no-undef
      return nonExistentFn();
    })).rejects.toThrow(/nonExistentFn|ReferenceError/);

    if (pageErrors.length > 0) {
      const found = pageErrors.some(e => /nonExistentFn|ReferenceError/.test(String(e)));
      expect(found).toBeTruthy();
    }
  });

  test('FSM evidence checks: ensure expected evidence strings exist in the DOM and script behavior', async ({ page }) => {
    // Validate evidence listed in the FSM:
    // - The button's HTML contains the inline onclick evidence
    // - The script attaches an event listener that logs 'Button clicked: Observe'
    const vt = new VisualThreadPage(page);
    await vt.goto();

    const onclickAttr = await vt.getButtonOnclickAttribute();
    expect(onclickAttr).toContain("alert('You are observing beauty!'");

    const logs = [];
    page.on('console', (msg) => logs.push(msg.text()));

    // Click once to cause listener to log
    const dialog = await Promise.all([
      page.waitForEvent('dialog'),
      vt.button.click(),
    ]);
    // Accept the alert (dialog handler returned it but not accepted here)
    // Playwright gives us the dialog object from waitForEvent; accept it to continue
    dialog[0].accept();

    // Wait briefly and then assert the console log evidence
    await page.waitForTimeout(50);
    const hasExpectedLog = logs.some(t => t.includes('Button clicked: Observe'));
    expect(hasExpectedLog).toBeTruthy();
  });

  // After all tests in this describe block, include a sanity test to ensure there were no unexpected unhandled rejections
  test.afterEach(async () => {
    // This hook runs after each test to provide an additional sanity assertion on pageErrors collected during setup
    // If there are unexpected page errors, fail with a descriptive message.
    if (pageErrors.length > 0) {
      // Format messages for easier debugging
      const messages = pageErrors.map((e, i) => `#${i + 1}: ${String(e)}`).join('\n');
      // Use expect to fail the test if pageErrors were present
      expect(pageErrors.length, `Unexpected page errors:\n${messages}`).toBe(0);
    }
  });
});