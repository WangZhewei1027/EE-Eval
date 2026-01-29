import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a18865-fa7b-11f0-8b01-9f078a0ff214.html';
const EXPECTED_ALERT_TEXT = "Dynamic Programming allows for efficient solutions by storing subproblem results.";
const BUTTON_SELECTOR = 'button';
const HEADER_SELECTOR = 'h1';

test.describe('FSM tests for Understanding Dynamic Programming (d5a18865-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Containers to collect console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Arrays to collect console messages and page errors for assertions
    await page.addInitScript(() => {
      // no-op: ensure we don't modify page runtime; placeholder to guarantee addInitScript usage is benign
    });
  });

  // Test the initial Idle state (S0_Idle)
  test('S0_Idle: Page renders correctly and button is present with correct attributes', async ({ page }) => {
    // Collect console messages and page errors during page load
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Load the page as-is
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Validate basic content reflecting Idle state renderPage() conceptual entry action:
    // - The header text is present (page content rendered)
    const header = await page.locator(HEADER_SELECTOR);
    await expect(header).toHaveText('Understanding Dynamic Programming');

    // - The summary button exists and is visible
    const button = page.locator(BUTTON_SELECTOR);
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Click for a Quick Summary!');

    // - The button has an onclick attribute containing the expected alert call
    const onclickAttr = await button.getAttribute('onclick');
    // The onclick attribute should include the alert invocation as defined in the HTML
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("alert(");
    expect(onclickAttr).toContain(EXPECTED_ALERT_TEXT);

    // Ensure there are no unexpected runtime errors during initial load (renderPage() is an entry action in FSM,
    // but the page does not call renderPage(); assert that no ReferenceError related to renderPage occurred)
    const hasRenderPageReferenceError = pageErrors.some(err => err.includes('renderPage') || err.includes('ReferenceError'));
    expect(hasRenderPageReferenceError).toBe(false);

    // Also assert there are no console error messages on load
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  // Test the transition from Idle to SummaryDisplayed (ButtonClick -> alert)
  test('Transition ButtonClick: clicking the button displays an alert (S1_SummaryDisplayed onEnter)', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Load the page
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Wait for the dialog triggered by the button click and assert its content
    // Prepare to catch the dialog event before triggering the click
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click(BUTTON_SELECTOR),
    ]);

    // Assert the dialog message matches the expected summary
    expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);
    // Accept (close) the alert so the page can continue
    await dialog.accept();

    // After the alert, ensure the button still exists and the DOM didn't unexpectedly change
    const button = page.locator(BUTTON_SELECTOR);
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Click for a Quick Summary!');

    // Verify no page errors were emitted as a result of the transition
    expect(pageErrors.length).toBe(0);

    // Verify there were no console errors emitted during the interaction
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  // Edge case: rapid repeated clicks should produce multiple alerts sequentially; verify behavior and stability
  test('Edge case: multiple rapid clicks produce multiple alerts and do not cause runtime errors', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];
    const capturedDialogMessages = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // Catch dialogs and accept them automatically, storing messages
    page.on('dialog', async dialog => {
      capturedDialogMessages.push(dialog.message());
      await dialog.accept();
    });

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Perform several rapid clicks; the dialog handler will capture and accept them
    // We click sequentially but without awaiting dialog each time; the on('dialog') handler will handle them.
    await page.click(BUTTON_SELECTOR);
    await page.click(BUTTON_SELECTOR);
    await page.click(BUTTON_SELECTOR);

    // Give the runtime a short moment to process all dialogs and events
    await page.waitForTimeout(200);

    // We expect three alert dialogs with the same message
    expect(capturedDialogMessages.length).toBeGreaterThanOrEqual(3);
    for (let i = 0; i < 3; i++) {
      expect(capturedDialogMessages[i]).toBe(EXPECTED_ALERT_TEXT);
    }

    // Assert no runtime page errors occurred as a result of rapid interactions
    expect(pageErrors.length).toBe(0);

    // Assert no console error messages
    const consoleErrorCount = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorCount).toBe(0);
  });

  // Verify onEnter and onExit semantics as captured by the FSM:
  // - S0 has entry action renderPage() (not actually invoked by this static HTML)
  // - S1 has entry action producing an alert (we validated alert on click)
  test('FSM onEnter/onExit verification: S0 entry not invoked erroneously; S1 entry (alert) observed', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    await page.goto(APP_URL, { waitUntil: 'load' });

    // Check S0 entry action "renderPage()" - since the page is static, ensure no ReferenceError about renderPage occurred
    const hasRenderPageReferenceError = pageErrors.some(err => err.includes('renderPage') || err.includes('renderPage is not defined'));
    expect(hasRenderPageReferenceError).toBe(false);

    // Now trigger S1 entry by clicking the button and assert the alert is shown (again)
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click(BUTTON_SELECTOR),
    ]);
    expect(dialog.message()).toBe(EXPECTED_ALERT_TEXT);
    await dialog.accept();

    // After S1 onEnter completed, ensure still no page errors
    expect(pageErrors.length).toBe(0);

    // Ensure that the console did not report errors pertaining to missing onEnter/onExit handlers
    const relevantConsoleErrors = consoleMessages.filter(m =>
      m.type === 'error' && (m.text.includes('onEnter') || m.text.includes('onExit') || m.text.includes('renderPage'))
    );
    expect(relevantConsoleErrors.length).toBe(0);
  });

  // Negative test / error scenario: verify the page does not throw SyntaxError/TypeError/ReferenceError upon load
  test('Error scenario: assert no uncaught SyntaxError/TypeError/ReferenceError during load', async ({ page }) => {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', err => pageErrors.push(err));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(APP_URL, { waitUntil: 'load' });

    // No uncaught exceptions expected; assert none of the pageErrors indicate SyntaxError/TypeError/ReferenceError
    const criticalErrorFound = pageErrors.some(err => {
      const msg = typeof err === 'string' ? err : err.message || '';
      return msg.includes('SyntaxError') || msg.includes('TypeError') || msg.includes('ReferenceError');
    });
    expect(criticalErrorFound).toBe(false, `Unexpected critical JS error(s) on page load: ${JSON.stringify(pageErrors)}`);

    // Also ensure no console errors that indicate such critical runtime problems
    const consoleCritical = consoleErrors.some(text =>
      text.includes('SyntaxError') || text.includes('TypeError') || text.includes('ReferenceError')
    );
    expect(consoleCritical).toBe(false, `Unexpected console critical error(s): ${JSON.stringify(consoleErrors)}`);
  });
});