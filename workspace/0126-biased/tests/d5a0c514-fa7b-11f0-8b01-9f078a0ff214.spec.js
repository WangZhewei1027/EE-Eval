import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a0c514-fa7b-11f0-8b01-9f078a0ff214.html';

// Expected alert message from showDemo() in the HTML
const EXPECTED_ALERT_TEXT = 'This is a simple demonstration of Merge Sort! Currently, only the explanation is provided. Please refer to the text above for a complete understanding.';

test.describe('Understanding Merge Sort - FSM and UI integration tests', () => {
  // Arrays to collect observations from the page
  let consoleMessages;
  let pageErrors;
  let dialogMessages;

  // Attach listeners for console and page errors before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Capture console messages for later assertions
    page.on('console', msg => {
      // store type and text to help debugging and assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture unhandled errors in the page context (ReferenceError, TypeError, etc.)
    page.on('pageerror', error => {
      // The error is an Error object; keep its message
      pageErrors.push(error);
    });

    // Global dialog handler to collect dialogs and automatically accept them
    page.on('dialog', async dialog => {
      dialogMessages.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });

    // Navigate to the application page
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Optional cleanup: ensure no leftover dialogs, nothing to do because we accept dialogs immediately.
    // Confirm navigation did not inadvertently change location away from the app (simple sanity)
    // (Not asserting here; this is teardown.)
  });

  test('S0_Idle: Page renders initial content and button exists with correct attributes', async ({ page }) => {
    // Validate top-level content indicating the page loaded correctly
    const title = await page.textContent('h1');
    expect(title).toContain('Understanding Merge Sort');

    // The FSM evidence includes an anchor with class "button" and onclick="showDemo()"
    const button = await page.locator('a.button');
    await expect(button).toHaveCount(1);

    // Validate the visible text of the button
    await expect(button).toHaveText('Show Merge Sort Demo');

    // Validate the onclick attribute is present and references showDemo()
    const onclickAttr = await button.getAttribute('onclick');
    expect(onclickAttr).toBe('showDemo()');

    // Validate that the outer HTML contains evidence as extracted by the FSM
    const outerHTML = await button.evaluate((el) => el.outerHTML);
    expect(outerHTML).toContain('onclick="showDemo()"');
    expect(outerHTML).toContain('class="button"');

    // FSM S0 had entry_actions: renderPage()
    // The page implementation does not define renderPage. Confirm that renderPage is not defined.
    // We assert the function is undefined on window to reflect the mismatch between FSM entry action and actual implementation.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    expect(hasRenderPage).toBe(false);
  });

  test('S0 -> S1 Transition: Clicking "Show Merge Sort Demo" triggers an alert (dialog) with expected text', async ({ page }) => {
    // Ensure no dialogs have been observed yet
    expect(dialogMessages.length).toBe(0);

    // Click the button which has an inline onclick that calls showDemo()
    await page.click('a.button');

    // Wait for the dialog handler to be invoked and recorded (handler accepts automatically)
    // Give a small timeout loop to permit the dialog to be processed
    await page.waitForTimeout(100);

    // We expect exactly one dialog message to have been recorded
    expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
    // The first dialog should be the alert from showDemo()
    const firstDialog = dialogMessages[0];
    expect(firstDialog.type).toBe('alert');
    expect(firstDialog.message).toBe(EXPECTED_ALERT_TEXT);

    // Ensure no uncaught page errors were produced by this action
    // (There could be other tests that generate errors; in this test we expect none)
    expect(pageErrors.length).toBe(0);

    // Also assert that no console.error was emitted (check collected console messages)
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('S1_DemoShown entry action: Directly invoking showDemo() produces the same alert', async ({ page }) => {
    // Call showDemo() directly in the page context. The page.on('dialog') handler will capture and accept it.
    // Using evaluate to invoke showDemo() the same way as the onclick would.
    await page.evaluate(() => {
      // Intentionally call the existing declared function showDemo()
      // If showDemo were missing, this would throw; in this app it exists.
      showDemo();
    });

    // Wait briefly for the dialog to be captured by the handler
    await page.waitForTimeout(100);

    // Expect at least one dialog message (plus any from previous tests in same group)
    // Filter dialog messages to the expected alert message to be robust across test order
    const matchedDialogs = dialogMessages.filter(d => d.message === EXPECTED_ALERT_TEXT && d.type === 'alert');
    expect(matchedDialogs.length).toBeGreaterThanOrEqual(1);
  });

  test('Edge case: Clicking the demo button multiple times triggers multiple alerts (dialogs)', async ({ page }) => {
    // Reset dialogMessages to only consider dialogs from this test action
    dialogMessages = [];

    // Click twice in succession
    await page.click('a.button');
    // small pause to allow dialog to be created and accepted
    await page.waitForTimeout(100);
    await page.click('a.button');
    await page.waitForTimeout(100);

    // We expect two dialogs to have been observed
    const alertsObserved = dialogMessages.filter(d => d.type === 'alert' && d.message === EXPECTED_ALERT_TEXT);
    expect(alertsObserved.length).toBeGreaterThanOrEqual(2);
  });

  test('FSM entry action mismatch detection: invoking undefined renderPage() results in ReferenceError observed as page error', async ({ page }) => {
    // Clear any previously recorded page errors
    pageErrors = [];

    // Attempt to call renderPage() which is not defined in the actual HTML.
    // We intentionally call it to allow a ReferenceError to occur naturally in the page context.
    // Use page.evaluate and catch the thrown error from the evaluation.
    let evalError = null;
    try {
      await page.evaluate(() => {
        // This will throw a ReferenceError in the page context because renderPage is undefined.
        // We do not define it; we let the runtime throw naturally.
        // The thrown error should be captured by page.on('pageerror').
        // eslint-disable-next-line no-undef
        renderPage();
      });
    } catch (err) {
      // Playwright surfaces an error for the failed evaluation; capture it for assertions.
      evalError = err;
    }

    // We expect the evaluation to throw (renderPage is not defined)
    expect(evalError).not.toBeNull();
    // The thrown error message should mention renderPage or be an evaluation failure that includes 'renderPage'
    const evalMessage = evalError.message || '';
    expect(evalMessage).toMatch(/renderPage/);

    // Additionally, the pageerror listener should have captured the runtime ReferenceError
    // Allow a short timeout for the pageerror to be delivered (it should be immediate)
    await page.waitForTimeout(50);

    // There should be at least one page error captured whose message mentions renderPage or "not defined"
    const matchingPageErrors = pageErrors.filter(e => {
      const msg = e && e.message ? e.message.toString() : '';
      return /renderPage/.test(msg) || /not defined/.test(msg);
    });

    expect(matchingPageErrors.length).toBeGreaterThanOrEqual(1);
  });

  test('Sanity checks: page contains expected explanatory content and examples from FSM description', async ({ page }) => {
    // Validate presence of explanation text and example blocks from the HTML implementation
    await expect(page.locator('h2', { hasText: 'What is Merge Sort?' })).toHaveCount(1);
    await expect(page.locator('.example')).toHaveCountGreaterThan(0);

    // Verify an example block contains expected array content
    const exampleText = await page.locator('.example').first().textContent();
    expect(exampleText).toContain('[38, 27, 43, 3, 9, 82, 10]');
  });

  test('Observe console output and ensure no unexpected console errors on load', async ({ page }) => {
    // At this point, page has loaded during beforeEach.
    // Confirm that there were no console 'error' messages emitted during navigation/render.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);

    // Similarly, assert there were no uncaught page errors on normal load (before any deliberate renderPage invocation)
    // Note: Some tests may intentionally create page errors; this test expects none because we run it fresh in its beforeEach.
    expect(pageErrors.length).toBe(0);
  });
});