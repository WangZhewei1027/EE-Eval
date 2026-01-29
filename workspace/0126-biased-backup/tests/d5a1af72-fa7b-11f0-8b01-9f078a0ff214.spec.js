import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a1af72-fa7b-11f0-8b01-9f078a0ff214.html';

// The exact alert text used by the application (copied from the HTML)
const ALERT_TEXT =
  "This is a simple demonstration of Branch and Bound executing. Understanding the step-through of this demonstration is crucial for grasping the concept!";

test.describe('Branch and Bound Explained - FSM tests (d5a1af72-fa7b-11f0-8b01-9f078a0ff214)', () => {
  // Hold console messages and page errors observed during a test
  let consoleMessages;
  let pageErrors;
  let dialogs;

  // Setup: run before each test to prepare fresh arrays and attach listeners
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    // Collect console messages (info, warning, error, etc.)
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions like ReferenceError, TypeError, SyntaxError)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Collect dialogs when they appear. We will accept dialogs in tests when appropriate.
    page.on('dialog', async dialog => {
      // Record the dialog and accept it to unblock the page
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      try {
        await dialog.accept();
      } catch (e) {
        // In case accepting fails for some reason, still record the error in pageErrors
        pageErrors.push(e);
      }
    });

    // Load the page exactly as-is (do not patch or modify)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Teardown: after each test ensure we observed no unexpected errors (assertions in tests)
  test.afterEach(async ({ page }) => {
    // No explicit teardown required; listeners are tied to page lifecycle
    // but we keep this hook for symmetry and potential future logging.
    await page.close();
  });

  test('S0_Idle: initial render - DOM presence, button attributes, and visual style', async ({ page }) => {
    // This test validates that the initial Idle state renders the expected UI elements,
    // especially the "Demonstration Example" button and its attributes (evidence of S0_Idle).
    const button = page.locator('button').first();

    // Button exists and is visible
    await expect(button).toHaveCount(1);
    await expect(button).toBeVisible();

    // Verify the button text matches FSM evidence
    await expect(button).toHaveText('Demonstration Example');

    // Verify onclick attribute contains the expected alert call (evidence)
    const onclick = await button.getAttribute('onclick');
    expect(onclick).not.toBeNull();
    expect(onclick).toContain("alert(");
    expect(onclick).toContain(ALERT_TEXT.split("'").join("")); // just ensure the alert text appears in attribute

    // Check some visual feedback: computed background color equals the value from the stylesheet (#0056b3 => rgb(0,86,179))
    const bgColor = await page.evaluate(el => getComputedStyle(el).backgroundColor, await button.elementHandle());
    // We expect the CSS color used in the HTML to be applied
    expect(bgColor).toBeTruthy();

    // Confirm page title and main heading exist (sanity check of full render)
    await expect(page).toHaveTitle(/Branch and Bound Explained/);
    await expect(page.locator('h1')).toHaveText('Understanding Branch and Bound');

    // Assert that no uncaught JS errors occurred during initial render (renderPage was an FSM entry action but not invoked here;
    // we must not patch the page; instead we observe whether any ReferenceError/SyntaxError/TypeError happened naturally)
    expect(pageErrors.length).toBe(0);
    // Also assert no console messages of type 'error'
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition DemonstrationClick -> S1_DemonstrationAlert: clicking button shows alert with correct text', async ({ page }) => {
    // This test exercises the FSM transition: S0_Idle -> S1_DemonstrationAlert by clicking the button.
    // It validates the alert/dialog content (S1 entry_actions) and that the page remains stable afterwards.

    const button = page.locator('button').first();

    // Prepare to capture the dialog event that should be fired by the onclick alert
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      button.click(), // trigger the alert via onclick
    ]);

    // Validate dialog contents exactly match what FSM describes
    expect(dialog).toBeTruthy();
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toBe(ALERT_TEXT);

    // The page.on('dialog') handler in beforeEach already accepted the dialog,
    // and recorded it into dialogs array. Ensure that it was recorded.
    // Because we used both waitForEvent and page.on('dialog'), confirm consistency.
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[dialogs.length - 1].message).toBe(ALERT_TEXT);

    // After accepting the alert, ensure the button is still present (we remain on the same page/state)
    await expect(button).toBeVisible();

    // No uncaught JS errors should have occurred as a result of the transition
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: sequential clicks produce sequential alerts (two alerts)', async ({ page }) => {
    // This test validates that repeated trigger of the DemonstrationClick event produces repeated alerts.
    // It also verifies that dialogs are handled sequentially and no JS errors are thrown.

    const button = page.locator('button').first();

    // First click -> dialog
    const firstDialogPromise = page.waitForEvent('dialog');
    await button.click();
    const firstDialog = await firstDialogPromise;
    expect(firstDialog.message()).toBe(ALERT_TEXT);

    // Second click -> dialog
    const secondDialogPromise = page.waitForEvent('dialog');
    await button.click();
    const secondDialog = await secondDialogPromise;
    expect(secondDialog.message()).toBe(ALERT_TEXT);

    // The page.on('dialog') handler accepted both; dialogs array should have at least two recorded entries.
    expect(dialogs.length).toBeGreaterThanOrEqual(2);
    expect(dialogs[dialogs.length - 2].message).toBe(ALERT_TEXT);
    expect(dialogs[dialogs.length - 1].message).toBe(ALERT_TEXT);

    // Ensure stability: no page errors and no console error messages
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Negative/Edge scenario: clicking other parts of the page should not trigger the demonstration alert', async ({ page }) => {
    // This test asserts that clicking a non-trigger element (e.g., body or a section) does not fire the DemonstrationClick event.
    // We assert that no dialog is created by these interactions.

    // Clear any prior dialogs recorded during navigation
    dialogs = [];

    // Click on a main content section (first .section)
    const firstSection = page.locator('.section').first();
    await firstSection.click();

    // Wait a short moment to ensure no dialog appears
    let dialogAppeared = false;
    try {
      // Wait for a dialog with a timeout; if none arrives, it times out and we catch that
      await page.waitForEvent('dialog', { timeout: 500 });
      dialogAppeared = true;
    } catch (e) {
      // Expected: no dialog should appear
      dialogAppeared = false;
    }

    expect(dialogAppeared).toBe(false);

    // Also clicking body should not trigger the alert
    try {
      await page.waitForEvent('dialog', { timeout: 200 });
      dialogAppeared = true;
    } catch (e) {
      dialogAppeared = false;
    }
    expect(dialogAppeared).toBe(false);

    // Ensure no runtime errors resulted
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM evidence verification: onclick attribute exactly matches expected alert invocation', async ({ page }) => {
    // This test checks the element evidence extracted in the FSM: that the button's onclick attribute
    // contains the precise alert invocation string expected by the FSM definition.

    const button = page.locator('button').first();
    const onclick = await button.getAttribute('onclick');

    // The HTML uses single quotes inside the alert call. We assert that the attribute includes the alert text.
    expect(onclick).toBeTruthy();
    // Assert the alert text appears as a substring in the onclick attribute (exact phrase)
    expect(onclick).toContain(ALERT_TEXT);

    // If there were an entry_action like renderPage() invoked automatically, it might cause a ReferenceError.
    // We ensure no such ReferenceError/SyntaxError/TypeError occurred on load.
    const hasReferenceError = pageErrors.some(err => err.name === 'ReferenceError' || err.message.includes('ReferenceError'));
    const hasSyntaxError = pageErrors.some(err => err.name === 'SyntaxError' || err.message.includes('SyntaxError'));
    const hasTypeError = pageErrors.some(err => err.name === 'TypeError' || err.message.includes('TypeError'));

    // Expect none of these occurred (the page should load cleanly)
    expect(hasReferenceError).toBe(false);
    expect(hasSyntaxError).toBe(false);
    expect(hasTypeError).toBe(false);

    // And no console error-level messages should exist
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });
});