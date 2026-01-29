import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a13a40-fa7b-11f0-8b01-9f078a0ff214.html';

// Comprehensive Playwright tests for the "Understanding Binary Search" interactive page.
// The FSM describes a single Idle state with an entry action renderPage() (not implemented in the page)
// and a single button that triggers an alert via an inline onclick handler.
//
// Tests cover:
// - Page rendering and DOM verification for the Idle state.
// - The Demonstration Alert button existence, attributes, and click behavior (alert).
// - Verification of the FSM's entry action (renderPage) being absent -> ReferenceError when called.
// - Edge case error scenarios (SyntaxError, TypeError) executed in page context and asserted.
// - Observation of console messages and page errors (captured via event handlers).
//
// Notes:
// - Tests intentionally do not modify the page or patch any missing functions.
// - All thrown errors are allowed to happen naturally and are asserted in tests.
// - Uses ES module syntax and Playwright test fixtures.

test.describe('Application d5a13a40-fa7b-11f0-8b01-9f078a0ff214 - FSM and UI validation', () => {
  // Each test navigates to the page fresh to ensure a clean environment.
  test.beforeEach(async ({ page }) => {
    await page.goto(APP_URL);
  });

  test('Idle state: page renders and Demonstration Alert button is present with correct attributes', async ({ page }) => {
    // Capture any console messages and page errors during load
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', (m) => consoleMessages.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (err) => pageErrors.push(err));

    // Verify important static DOM elements that indicate the page rendered correctly
    await expect(page.locator('h1')).toHaveText('Understanding Binary Search');
    await expect(page.locator('h2', { hasText: 'Concept and Theory' })).toBeVisible();

    // The FSM indicates a button with selector .button and text "Demonstration Alert"
    const button = page.locator('.button');
    await expect(button).toHaveCount(1);
    await expect(button).toHaveText('Demonstration Alert');

    // Verify the inline onclick attribute exists and contains the expected alert message
    const onclick = await button.getAttribute('onclick');
    expect(onclick).toBeTruthy();
    expect(onclick).toContain("alert('Binary Search is a method to efficiently find a target value in a sorted array!");

    // Ensure that no unexpected page errors occurred during initial render
    expect(pageErrors.length).toBe(0);
    // Console may include informative messages but ensure there are no console-level errors
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Demonstration Alert event: clicking the button triggers an alert with expected message', async ({ page }) => {
    // Prepare to capture the alert dialog message
    let dialogMessage = null;
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Also capture page errors to ensure clicking doesn't produce uncaught exceptions
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    // Click the button to trigger the inline alert
    await page.click('.button');

    // Assert the alert dialog was shown and contains the expected complete message
    expect(dialogMessage).toBeTruthy();
    expect(dialogMessage).toContain('Binary Search is a method to efficiently find a target value in a sorted array!');
    expect(dialogMessage).toContain('Stay tuned for practical examples and applications.');

    // Ensure no uncaught page errors were produced by the click action
    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry action "renderPage()" is not implemented: calling it in page context throws ReferenceError', async ({ page }) => {
    // Capture pageerror events that may be emitted when the uncaught error occurs in the page context
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    // Attempt to call renderPage() in the page context; it is not defined in the provided HTML.
    // This should result in a ReferenceError. We explicitly allow the error to happen and assert it.
    let caughtError = null;
    try {
      // This will throw in the page context and reject the promise returned by page.evaluate
      await page.evaluate(() => {
        // Intentionally call the missing function from FSM entry_actions
        // Do not guard the call (no typeof check) to ensure a ReferenceError is produced naturally.
        // eslint-disable-next-line no-undef
        renderPage();
      });
    } catch (e) {
      caughtError = e;
    }

    // Assert that an error was indeed thrown and it's a ReferenceError referring to renderPage
    expect(caughtError).not.toBeNull();
    // Some engines include different messages; assert on the error name when available
    if (caughtError && typeof caughtError === 'object' && 'name' in caughtError) {
      expect(caughtError.name).toBe('ReferenceError');
    } else {
      // Fallback: assert message contains renderPage
      expect(String(caughtError)).toContain('renderPage');
    }

    // The page may also emit a pageerror event for the uncaught exception; assert at least one such event was captured
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const pageErrorNames = pageErrors.map(e => e?.name || String(e));
    expect(pageErrorNames.some(n => String(n).includes('ReferenceError') || String(n).includes('renderPage'))).toBeTruthy();
  });

  test('Edge case: executing invalid code in page context produces a SyntaxError', async ({ page }) => {
    // Capture any pageerror events arising from the evaluation
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    let caughtError = null;
    try {
      // Use eval with an intentionally malformed function to provoke a SyntaxError in the page context
      await page.evaluate(() => {
        // This eval contains a malformed function declaration and will throw a SyntaxError
        // The error should surface as a rejection of the evaluate() Promise.
        // eslint-disable-next-line no-eval
        eval('function brokenFunc( {');
      });
    } catch (e) {
      caughtError = e;
    }

    // Assert that an error was thrown and it's a SyntaxError (or at least includes 'Syntax')
    expect(caughtError).not.toBeNull();
    if (caughtError && typeof caughtError === 'object' && 'name' in caughtError) {
      // Some environments name the error 'SyntaxError'
      expect(String(caughtError.name)).toMatch(/SyntaxError/i);
    } else {
      expect(String(caughtError)).toMatch(/Syntax/i);
    }

    // Confirm pageerror event(s) were emitted
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    expect(pageErrors.some(e => String(e).toLowerCase().includes('syntax'))).toBeTruthy();
  });

  test('Edge case: executing invalid operation in page context produces a TypeError', async ({ page }) => {
    // Capture page errors
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    let caughtError = null;
    try {
      // Cause a TypeError by attempting to call a property on null
      await page.evaluate(() => {
        // This operation will throw a TypeError in the page environment
        // eslint-disable-next-line no-undef
        return null.nonexistentFunction();
      });
    } catch (e) {
      caughtError = e;
    }

    // Assert that the evaluation caused a TypeError
    expect(caughtError).not.toBeNull();
    if (caughtError && typeof caughtError === 'object' && 'name' in caughtError) {
      expect(String(caughtError.name)).toMatch(/TypeError/i);
    } else {
      expect(String(caughtError)).toMatch(/TypeError|cannot read property|cannot read properties/i);
    }

    // Confirm at least one pageerror event was captured and it corresponds to a TypeError
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    expect(pageErrors.some(e => String(e).toLowerCase().includes('typeerror') || String(e).toLowerCase().includes('cannot read'))).toBeTruthy();
  });

  test('Robustness: clicking button repeatedly still shows alert each time and does not degrade the page', async ({ page }) => {
    // Ensure no page errors emitted during repeated interactions
    const pageErrors = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const messages = [];
    page.on('dialog', async (d) => {
      messages.push(d.message());
      await d.accept();
    });

    // Click the button multiple times to ensure the inline onclick handler behaves consistently
    for (let i = 0; i < 3; i++) {
      await page.click('.button');
    }

    // Expect three dialogs captured with the expected text
    expect(messages.length).toBe(3);
    messages.forEach((msg) => {
      expect(msg).toContain('Binary Search is a method to efficiently find a target value in a sorted array!');
    });

    // No uncaught page errors should have occurred during repeated clicks
    expect(pageErrors.length).toBe(0);
  });
});