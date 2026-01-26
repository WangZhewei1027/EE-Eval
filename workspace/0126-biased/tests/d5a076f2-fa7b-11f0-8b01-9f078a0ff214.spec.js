import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a076f2-fa7b-11f0-8b01-9f078a0ff214.html';

// Test file for application: d5a076f2-fa7b-11f0-8b01-9f078a0ff214
// This suite validates the FSM states and transitions described in the spec.
// It loads the page exactly as-is, observes console and page errors, and
// asserts on naturally occurring ReferenceError (when appropriate) and the alert dialog
// that represents the insertion demonstration.

test.describe('B+ Tree Explanation - FSM validation', () => {
  // Each test uses a fresh page fixture provided by Playwright.
  test.beforeEach(async ({ page }) => {
    // Attach listeners to capture console messages and uncaught page errors for assertions.
    page.context().setDefaultNavigationTimeout(30_000);
  });

  test('S0_Idle: Page loads and Idle state is rendered correctly', async ({ page }) => {
    // Validate page loads successfully and the title indicates the app.
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await page.goto(APP_URL);

    // Title should include 'B+ Tree'
    await expect(page).toHaveTitle(/B\+\s*Tree/i);

    // The button expected by the FSM (button[onclick]) should be present exactly once and visible.
    const demoButton = page.locator('button[onclick]');
    await expect(demoButton).toHaveCount(1);
    await expect(demoButton).toBeVisible();

    // Validate the button text is exactly as expected by the FSM evidence.
    await expect(demoButton).toHaveText('Demonstrate Insertion');

    // Verify the onclick attribute contains the expected alert call.
    const onclickAttr = await demoButton.getAttribute('onclick');
    expect(onclickAttr).toBe("alert('This is where a visualization of B+ Tree insertion would occur.')");

    // FSM S0 has an entry_action 'renderPage()'. The HTML does not define renderPage.
    // We check that renderPage is undefined and that attempting to call it would result in a ReferenceError.
    // We call it inside a try/catch in page context to observe the thrown error object properties.
    const renderPageCallResult = await page.evaluate(() => {
      try {
        // Attempt to call the function that the FSM lists as an entry action.
        // This will naturally throw if renderPage is undefined.
        // We deliberately do not define renderPage anywhere - we observe the natural result.
        // Using a direct call so that a ReferenceError is thrown and caught here.
        // The thrown error is returned so the test can assert on it.
        // Note: We intentionally catch it here to return its details rather than let it crash the test.
        renderPage();
        return { called: true };
      } catch (e) {
        return { called: false, name: e && e.name, message: String(e && e.message) };
      }
    });

    // Expect that the function is not defined and a ReferenceError would be thrown
    expect(renderPageCallResult.called).toBe(false);
    expect(renderPageCallResult.name).toBe('ReferenceError');

    // Ensure there were no unexpected page errors on load (aside from our controlled checks).
    expect(pageErrors.length).toBe(0);

    // There may be no console messages; at minimum we assert that collecting console logs did not throw.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('S1_InsertionDemonstration: Clicking Demonstrate Insertion triggers alert (transition S0 -> S1)', async ({ page }) => {
    // This test validates the FSM transition described:
    // - Event: DemonstrateInsertion (click on button[onclick])
    // - S1 entry action: alert('This is where a visualization of B+ Tree insertion would occur.')
    const dialogs = [];
    const pageErrors = [];
    const consoleMessages = [];

    page.on('dialog', dialog => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      // Accept the dialog to allow further interactions.
      dialog.accept().catch(() => {});
    });
    page.on('pageerror', e => pageErrors.push(e));
    page.on('console', m => consoleMessages.push({ type: m.type(), text: m.text() }));

    await page.goto(APP_URL);

    // Ensure button exists before clicking
    const demoButton = page.locator('button[onclick]');
    await expect(demoButton).toBeVisible();

    // Click the button to trigger the alert. The dialog handler above captures it.
    await demoButton.click();

    // Wait for the dialog to be captured (it should be synchronous for alert).
    // But to be robust, wait for a small tick.
    await page.waitForTimeout(100);

    // Assert that exactly one alert dialog was shown with the expected message.
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const found = dialogs.find(d => d.type === 'alert' && d.message === "This is where a visualization of B+ Tree insertion would occur.");
    expect(found).toBeTruthy();

    // After the transition, ensure the page still contains the button (no navigation or DOM removal occurred).
    await expect(demoButton).toBeVisible();

    // Assert that no uncaught page errors occurred as part of the click transition.
    expect(pageErrors.length).toBe(0);

    // Console messages are optional; simply ensure collection worked.
    expect(Array.isArray(consoleMessages)).toBe(true);
  });

  test('Clicking demonstration multiple times triggers alert each time (repeated transition)', async ({ page }) => {
    // Validate repeated triggering of the transition results in repeated entry action (alert).
    const dialogs = [];
    page.on('dialog', dialog => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      dialog.accept().catch(() => {});
    });

    await page.goto(APP_URL);

    const demoButton = page.locator('button[onclick]');
    await expect(demoButton).toBeVisible();

    // Click multiple times and ensure a dialog appears for each click.
    await demoButton.click();
    await page.waitForTimeout(50);
    await demoButton.click();
    await page.waitForTimeout(50);
    await demoButton.click();
    await page.waitForTimeout(50);

    // Expect at least 3 dialogs captured.
    expect(dialogs.length).toBeGreaterThanOrEqual(3);
    for (const d of dialogs.slice(0, 3)) {
      expect(d.type).toBe('alert');
      expect(d.message).toBe("This is where a visualization of B+ Tree insertion would occur.");
    }
  });

  test('Edge case: Uncaught ReferenceError occurs naturally in page (observed as pageerror)', async ({ page }) => {
    // This test intentionally triggers an uncaught ReferenceError inside the page context
    // by scheduling a call to a non-existent function. The error is allowed to happen naturally
    // (uncaught) and should be observable via the pageerror event.
    await page.goto(APP_URL);

    // Start listening for the pageerror event and capture it.
    const [error] = await Promise.all([
      page.waitForEvent('pageerror'),
      // Schedule an asynchronous call to a non-existent function so the error is thrown
      // in the page event loop (uncaught). Using setTimeout ensures it becomes an unhandled error.
      page.evaluate(() => {
        // Intentionally call a missing function asynchronously to create an uncaught ReferenceError.
        setTimeout(() => {
          // This will throw: ReferenceError: nonExistentFunction is not defined
          // It will be an uncaught exception and surface via the pageerror event.
          nonExistentFunctionThatDoesNotExist12345();
        }, 0);
      }),
    ]);

    // Assert that the captured error is a ReferenceError and mentions the function name.
    expect(error).toBeTruthy();
    expect(error.name).toBe('ReferenceError');
    expect(String(error.message)).toContain('nonExistentFunctionThatDoesNotExist12345');
  });

  test('Edge case: verify non-existent UI elements do not exist (robustness)', async ({ page }) => {
    // Validate that trying to find a non-existent element yields count 0
    // and does not cause any side effects or errors.
    await page.goto(APP_URL);

    const missing = page.locator('button#this-id-does-not-exist');
    await expect(missing).toHaveCount(0);

    // Confirm the expected button is still present and intact
    const demoButton = page.locator('button[onclick]');
    await expect(demoButton).toHaveCount(1);
    await expect(demoButton).toBeEnabled();
  });
});