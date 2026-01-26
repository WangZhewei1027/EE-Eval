import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/ed8edb23-fa77-11f0-8492-31e949ed3c7c.html';

// Expected alert text from the implementation
const EXPECTED_ALERT_TEXT = 'This is a simplified overview of relational databases. Observe the structure and flow!';

test.describe('Relational Database Concept app - FSM tests (ed8edb23-fa77-11f0-8492-31e949ed3c7c)', () => {
  // Will collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages for inspection (info/warn/error/log)
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case reading the console message throws, still push a fallback
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Collect page errors (uncaught exceptions in the page)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page under test and wait for it to load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // detach listeners by closing the page (Playwright test runner handles cleanup),
    // but ensure there are no unexpected lingering page errors in this test context.
    // (No explicit teardown required beyond what Playwright already does.)
  });

  test('Initial state S0_Idle renders correctly and UI components exist', async ({ page }) => {
    // This test validates the Idle state (S0_Idle):
    // - The Learn More button exists and is visible
    // - The graphics image exists with the expected src and alt
    // - The button has an inline onclick attribute wired to showAlert()
    // - The showAlert function is present on window
    // - The FSM-declared renderPage() entry action is NOT present in the JS (verify absence)
    // - No unexpected page errors were emitted during initial load

    // Button exists and visible
    const button = page.locator('.button');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Learn More');

    // Graphics image exists with expected attributes
    const img = page.locator('img.graphics');
    await expect(img).toBeVisible();
    const src = await img.getAttribute('src');
    const alt = await img.getAttribute('alt');
    expect(src).toContain('https://via.placeholder.com/200x100.png?text=Database+Concept');
    expect(alt).toBe('Database Illustration');

    // The button should have an inline onclick attribute according to the implementation
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toBe('showAlert()');

    // The page defines showAlert() in its script — verify it's available on window
    const hasShowAlert = await page.evaluate(() => typeof window.showAlert === 'function');
    expect(hasShowAlert).toBe(true);

    // FSM entry action mentions renderPage(), but implementation does not define it.
    // Verify renderPage is not defined on window (evidence the listed entry action was not implemented)
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);

    // No uncaught page errors should have occurred during load (sanity check)
    expect(pageErrors.length).toBe(0);

    // Console may have messages (like network/info) but there should be no console.type === 'error'
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition LearnMore_Click triggers alert and moves to S1_AlertShown (dialog observed)', async ({ page }) => {
    // This test validates the transition from S0_Idle to S1_AlertShown:
    // - Clicking the Learn More button triggers the expected alert dialog
    // - The alert dialog message matches the implementation
    // - No page errors are produced as a result of the click/alert lifecycle

    // Wait for the dialog and click button concurrently
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('.button'),
    ]);

    // Validate dialog message, then accept/dismiss it
    const message = dialog.message();
    expect(message).toBe(EXPECTED_ALERT_TEXT);
    await dialog.accept();

    // Validate that showAlert remains present (the function was executed, not removed)
    const hasShowAlertAfter = await page.evaluate(() => typeof window.showAlert === 'function');
    expect(hasShowAlertAfter).toBe(true);

    // There should be no uncaught page errors after invoking the alert
    expect(pageErrors.length).toBe(0);

    // Console should not have error-level messages as a result of the click
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking Learn More multiple times shows multiple alerts consecutively', async ({ page }) => {
    // This test covers an edge case and repeated interactions:
    // - Clicking the button twice triggers two dialogs in sequence with the same message
    // - Each dialog is observed and accepted properly

    // First click -> dialog
    const [firstDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('.button'),
    ]);
    expect(firstDialog.message()).toBe(EXPECTED_ALERT_TEXT);
    await firstDialog.accept();

    // Second click -> dialog
    const [secondDialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('.button'),
    ]);
    expect(secondDialog.message()).toBe(EXPECTED_ALERT_TEXT);
    await secondDialog.accept();

    // Confirm that no uncaught page errors were emitted during repeated interactions
    expect(pageErrors.length).toBe(0);
  });

  test('Verifies FSM-declared onEnter action renderPage is absent and invoking it throws ReferenceError', async ({ page }) => {
    // The FSM lists renderPage() as an entry action for S0_Idle.
    // The implementation does not define renderPage.
    // This test ensures:
    // - renderPage is not defined on window
    // - attempting to call renderPage via page.evaluate results in a JS ReferenceError being thrown

    // Confirm undefined on the page
    const typeofRenderPage = await page.evaluate(() => typeof window.renderPage);
    expect(typeofRenderPage).toBe('undefined');

    // Attempt to invoke renderPage in the page context and assert it throws a ReferenceError.
    // We deliberately call it to demonstrate the missing entry action produces the expected error.
    let thrownError = null;
    try {
      await page.evaluate(() => {
        // This will throw in the page context if renderPage is not defined
        // We do not catch it here so that Playwright surface the error back to the test.
        // Intentionally invoking a missing function to validate the missing onEnter handler.
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (err) {
      // Capture the thrown error for assertion
      thrownError = err;
    }

    // An error should have been thrown when attempting to call renderPage()
    expect(thrownError).not.toBeNull();
    // The error message should indicate the function is not defined (ReferenceError)
    const messageStr = String(thrownError);
    expect(messageStr.toLowerCase()).toContain('renderpage');
    // It's acceptable that the exact wording may vary, but it should be a reference-type error mentioning renderPage
  });

  test('DOM attributes and accessibility checks: button role and image alt present', async ({ page }) => {
    // Additional DOM checks ensuring components are accessible and match FSM component listing.

    // Button should be focusable and have expected styling class
    const button = page.locator('.button');
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('class', /button/);

    // Ensure the button is keyboard focusable (tabindex default behavior)
    await button.focus();
    const activeTag = await page.evaluate(() => document.activeElement?.className || null);
    expect(activeTag).toContain('button');

    // Image has alt text (important for accessibility)
    const img = page.locator('img.graphics');
    const alt = await img.getAttribute('alt');
    expect(alt).toBeTruthy();
    expect(alt).toBe('Database Illustration');

    // No unexpected page errors
    expect(pageErrors.length).toBe(0);
  });

  test('Console and runtime sanity: no SyntaxError/TypeError occurred on load', async ({ page }) => {
    // This test explicitly inspects collected page errors and console output
    // to ensure there were no SyntaxError/TypeError occurrences during page load.

    // If the implementation had structural JS errors, they would be captured in pageErrors.
    // Assert there are no SyntaxError or TypeError among pageErrors.
    const problematicErrors = pageErrors.filter(err => {
      const msg = String(err).toLowerCase();
      return msg.includes('syntaxerror') || msg.includes('typeerror');
    });
    expect(problematicErrors.length).toBe(0);

    // Also ensure console did not emit error-level messages that suggest runtime issues.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});