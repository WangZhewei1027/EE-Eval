import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d5a0c510-fa7b-11f0-8b01-9f078a0ff214.html';

// The FSM describes:
// - S0_Idle: entry action renderPage() (not present in the page source)
// - S1_GraphDisplayed: entry action is an alert triggered by clicking the button
// The tests below:
// - Verify DOM evidence for S0 (button exists, attributes match)
// - Assert that calling the non-existent renderPage() produces a ReferenceError when invoked
// - Verify the transition (ShowGraphDemonstration) produces an alert with the expected message
// - Observe and assert page errors (pageerror events) when missing functions are invoked asynchronously
// - Include edge cases: repeated clicks and asynchronous invocation of missing function

test.describe('Understanding Undirected Graphs - FSM validation and UI checks', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // reset capture arrays
    consoleMessages = [];
    pageErrors = [];

    // Listen to console events for diagnostic purposes
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions in the page as pageerror events
    page.on('pageerror', err => {
      // Keep the Error object for assertions (message, name)
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Small sanity: capture final console and errors to the test output if any unexpected failure
    // (No modification to the page is performed here.)
    // This is left intentionally minimal to avoid altering runtime behavior.
  });

  test('S0_Idle: initial load shows button evidence and renderPage() is not present (assert ReferenceError)', async ({ page }) => {
    // Validate page title to ensure the correct document loaded
    await expect(page).toHaveTitle(/Understanding Undirected Graphs/);

    // Locate the button that is evidence of the Idle state
    const button = page.locator('.button');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Show Graph Demonstration');

    // Verify the inline onclick attribute exists and includes the expected alert text
    const onclickAttr = await page.getAttribute('.button', 'onclick');
    expect(onclickAttr).toBeTruthy();
    expect(onclickAttr).toContain("This would normally trigger a graphical display of an undirected graph.");

    // The FSM entry action for S0 references renderPage().
    // The HTML/JS provided does NOT define renderPage(), so attempting to call it as a free identifier
    // in the page context should result in a ReferenceError: "renderPage is not defined".
    // We assert that calling renderPage() via page.evaluate rejects with a ReferenceError.
    await expect(page.evaluate(() => {
      // Direct unqualified call to renderPage() -> if not defined, should produce ReferenceError in browser context.
      // We do not define or patch anything; we only attempt to call it and let the runtime error occur naturally.
      // This promise will reject and Playwright will surface that rejection here.
      return renderPage();
    })).rejects.toThrow(/renderPage is not defined|ReferenceError/);

    // Also ensure no pageerror (uncaught exception) has been recorded so far from normal page load.
    // Since we invoked renderPage() inside page.evaluate, the error was surfaced to the evaluate promise,
    // but not necessarily emitted as an uncaught pageerror. We assert that there are zero pageerrors at this point.
    expect(pageErrors.length).toBe(0);

    // Confirm we have recorded console messages (if any) but none should be error-level from initial load.
    const errorConsoles = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });

  test('Transition ShowGraphDemonstration: clicking the button triggers an alert with expected message (S1_GraphDisplayed)', async ({ page }) => {
    // Prepare to wait for the dialog that is triggered by the button's onclick
    const expectedDialogText = "This would normally trigger a graphical display of an undirected graph.";

    // Click the button and wait for the dialog; ensure the dialog contains the expected text
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('.button')
    ]);
    try {
      expect(dialog.message()).toBe(expectedDialogText);
    } finally {
      // Always accept/dismiss the dialog to not block the page
      await dialog.accept();
    }

    // After the transition, verify there are still no page errors emitted from the page (normal alert should not create errors)
    expect(pageErrors.length).toBe(0);

    // Check that clicking again produces another alert (state can be re-entered)
    const [dialog2] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click('.button')
    ]);
    try {
      expect(dialog2.message()).toBe(expectedDialogText);
    } finally {
      await dialog2.accept();
    }
  });

  test('Edge case: clicking the button rapidly multiple times produces multiple dialogs that can be handled', async ({ page }) => {
    const expectedDialogText = "This would normally trigger a graphical display of an undirected graph.";

    // Rapidly click three times; handle each dialog sequentially
    for (let i = 0; i < 3; i++) {
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('.button')
      ]);
      try {
        expect(dialog.message()).toBe(expectedDialogText);
      } finally {
        await dialog.accept();
      }
    }

    // No unhandled page errors should have been emitted as a result
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case / error scenario: asynchronous invocation of missing renderPage() emits a pageerror', async ({ page }) => {
    // This test deliberately triggers an asynchronous, uncaught invocation of the missing function
    // so that a pageerror event is emitted (uncaught exception in page context).
    // We do this by scheduling a setTimeout to call renderPage() without catching it.

    // Start waiting for the pageerror event before scheduling the call
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Schedule the asynchronous call inside the page. This will not be caught by page.evaluate's
    // promise because it happens asynchronously in the event loop of the page.
    await page.evaluate(() => {
      // Intentionally call an undefined function asynchronously to trigger an uncaught exception in the page.
      setTimeout(() => {
        // This will throw in the page context; because it is uncaught it should emit a pageerror event.
        // We do not define renderPage() anywhere; allow runtime to produce the natural error.
        renderPage();
      }, 0);
    });

    // Wait for the pageerror and assert that it mentions the missing function name.
    const pageError = await pageErrorPromise;
    expect(pageError).toBeTruthy();
    // The message could vary across browsers/environments (could be "renderPage is not defined" or similar).
    // Assert it contains the function name and indicates a reference/definition issue.
    expect(pageError.message).toMatch(/renderPage/);
    expect(pageError.message).toMatch(/not defined|is not defined|is not a function|ReferenceError/i);

    // Ensure our captured pageErrors (from the page.on listener) also includes this error object or similar
    // (there may be slight timing differences, but at least one recorded error message should reference renderPage)
    const recorded = pageErrors.map(e => e && e.message ? e.message : '').join('\n');
    expect(recorded).toMatch(/renderPage/);
  });

  test('DOM and accessibility checks for the component evidence described in the FSM', async ({ page }) => {
    // Ensure only one primary evidence button exists as detected by the FSM
    const buttons = page.locator('button.button');
    await expect(buttons).toHaveCount(1);

    // Ensure the button is reachable and has appropriate visual attributes (class, inline style absence/presence)
    const button = buttons.first();
    await expect(button).toHaveAttribute('class', /button/);
    // Inspect computed styles minimally by checking visibility and bounding box (ensures it's rendered)
    const box = await button.boundingBox();
    expect(box).not.toBeNull();

    // Inspect the surrounding text to ensure the explanatory content is present (evidence of the page context for FSM)
    await expect(page.locator('h1')).toHaveText(/Understanding Undirected Graphs/);
    await expect(page.locator('h2')).toContainText(/Demonstration|Components of an Undirected Graph/);
  });

});