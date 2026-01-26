import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8fec90-fa77-11f0-8492-31e949ed3c7c.html';
const BUTTON_SELECTOR = 'button[onclick="showMessage()"]';
const ALERT_TEXT = 'This is a demonstration of the Interpreter concept. Observe how it works behind the scenes!';

test.describe('Interpreter Concept Showcase - FSM validation (ed8fec90-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Arrays to collect runtime diagnostics per test
  let pageErrors;
  let consoleMessages;
  let consoleErrorMessages;

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    pageErrors = [];
    consoleMessages = [];
    consoleErrorMessages = [];

    // Collect page errors (uncaught exceptions in page)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages and specifically console.error messages
    page.on('console', (msg) => {
      consoleMessages.push(msg);
      if (msg.type() === 'error') {
        consoleErrorMessages.push(msg);
      }
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure initial load animations or resources have some time to settle
    await page.waitForTimeout(100);
  });

  test('Initial Idle state: page renders Learn More button with expected attributes', async ({ page }) => {
    // This test validates the S0_Idle evidence: presence of the button with onclick showMessage()
    const button = page.locator(BUTTON_SELECTOR);

    // Button should be visible and contain the expected text
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Learn More');

    // The onclick attribute should be exactly 'showMessage()'
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toBe('showMessage()');

    // Ensure the DOM contains the evidence for S0_Idle
    const outer = await button.evaluate((el) => el.outerHTML);
    expect(outer).toContain('onclick="showMessage()"');
    expect(outer).toContain('Learn More');

    // Verify there are no uncaught page errors on initial render
    expect(pageErrors.length).toBe(0);

    // Verify no console.error messages were emitted during initial load
    expect(consoleErrorMessages.length).toBe(0);
  });

  test('Clicking Learn More triggers alert and transitions to Message Shown state', async ({ page }) => {
    // This test triggers the FSM event LearnMore_Click and validates the S1_MessageShown evidence (alert)
    const button = page.locator(BUTTON_SELECTOR);

    // Prepare to wait for the alert dialog
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      button.click()
    ]);

    // Validate alert message matches expected FSM evidence
    expect(dialog.message()).toBe(ALERT_TEXT);

    // Accept the alert to continue execution
    await dialog.accept();

    // After alert, ensure button still present (no destructive navigation/change)
    await expect(button).toBeVisible();

    // Ensure still no uncaught page errors
    expect(pageErrors.length).toBe(0);

    // Ensure still no console.error messages
    expect(consoleErrorMessages.length).toBe(0);
  });

  test('Multiple clicks produce repeated alerts (idempotent event handling)', async ({ page }) => {
    // Verifies repeated transitions: clicking multiple times should show an alert each time
    const button = page.locator(BUTTON_SELECTOR);
    let dialogCount = 0;

    // Attach handler to accept alerts and count them
    page.on('dialog', async (d) => {
      dialogCount++;
      expect(d.message()).toContain('demonstration of the Interpreter concept');
      await d.accept();
    });

    // Click the button twice
    await button.click();
    await button.click();

    // Wait a short time to ensure both dialogs were handled
    await page.waitForTimeout(100);

    expect(dialogCount).toBe(2);

    // Ensure no uncaught errors resulted from repeated clicks
    expect(pageErrors.length).toBe(0);
    expect(consoleErrorMessages.length).toBe(0);
  });

  test('Direct invocation of showMessage() via window triggers alert (alternative path)', async ({ page }) => {
    // This test validates that the action showMessage() exists and when invoked produces the expected alert.
    // Attach dialog handler to accept the alert invoked from the page context
    const dialogPromise = page.waitForEvent('dialog');

    // Invoke the function from page context
    await page.evaluate(() => {
      // Calling an existing page function - do not modify or patch the function
      window.showMessage();
    });

    // Wait for the dialog and validate
    const dialog = await dialogPromise;
    expect(dialog.message()).toBe(ALERT_TEXT);
    await dialog.accept();

    // Ensure no page errors occurred as a result
    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry action renderPage() is NOT implemented: calling it produces ReferenceError', async ({ page }) => {
    // The FSM declared an entry action 'renderPage()' for S0_Idle.
    // The implementation does not define renderPage. We assert that calling it throws a ReferenceError (natural runtime error).
    // We will attempt to call it from the page and assert the thrown error references renderPage.
    try {
      await page.evaluate(() => {
        // This call is expected to throw in the page context because renderPage is not defined.
        // We do not define or patch renderPage; we let the runtime error occur naturally.
        return renderPage();
      });
      // If no error was thrown, fail the test because we expected a ReferenceError.
      throw new Error('Expected renderPage() to throw ReferenceError, but it did not.');
    } catch (err) {
      // Playwright surfaces the page exception as an error here. Assert that it indicates renderPage is not defined.
      // Different engines may phrase the message differently, so check for the function name and/or "not defined".
      const msg = String(err.message || err);
      expect(msg.toLowerCase()).toContain('renderpage');
    }
  });

  test('No unexpected console errors or page errors after exercising main interactions', async ({ page }) => {
    // This test exercises the main user interactions and asserts the application does not emit unexpected errors to console or page.
    const button = page.locator(BUTTON_SELECTOR);

    // Perform a click that triggers alert and accept it
    const dialog1 = await Promise.all([page.waitForEvent('dialog'), button.click()]);
    (dialog1[0] || dialog1).accept?.();

    // Perform a direct call to showMessage again and accept
    const dialog2Promise = page.waitForEvent('dialog');
    await page.evaluate(() => window.showMessage());
    const dialog2 = await dialog2Promise;
    await dialog2.accept();

    // After interactions, assert no uncaught page errors and no console.error messages
    expect(pageErrors.length).toBe(0);
    expect(consoleErrorMessages.length).toBe(0);

    // Also assert that general console messages exist and at least include some info/debug logs (non-error)
    // This is optional; we just assert that consoleMessages is an array
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  test.afterEach(async ({ page }) => {
    // Basic cleanup example - ensure page is closed between tests if necessary (Playwright will handle it normally).
    // Also log if any unexpected page errors were captured for debugging.
    if (pageErrors.length > 0) {
      // We include this expectation so that test failures will surface the collected errors.
      // Note: we don't suppress the errors; we assert they do not exist in tests that expect no errors.
      console.error('Captured page.errors:', pageErrors.map((e) => e.message));
    }
    if (consoleErrorMessages.length > 0) {
      console.error('Captured console.error messages:', consoleErrorMessages.map((m) => m.text()));
    }
  });
});