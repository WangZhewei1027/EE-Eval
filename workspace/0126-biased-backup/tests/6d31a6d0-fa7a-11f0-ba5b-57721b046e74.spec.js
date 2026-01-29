import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d31a6d0-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Application FSM: Socket Programming (Idle State)', () => {
  // Arrays to collect runtime diagnostics for each test
  let pageErrors;
  let consoleMessages;

  // Attach listeners and navigate to the page for each test
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors (uncaught exceptions from the page)
    page.on('pageerror', (err) => {
      // Capture the Error object for later assertions
      pageErrors.push(err);
    });

    // Collect console messages (logs, warnings, errors, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Load the application page and wait for full load
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Small pause to allow any deferred scripts or runtime errors to surface
    await page.waitForTimeout(100);
  });

  test.afterEach(async () => {
    // Nothing to teardown between tests in this simple suite,
    // but this hook is present to satisfy setup/teardown requirement.
  });

  // Validate the Idle state rendering and the page title presence.
  test('Idle state: page loads and title matches FSM evidence', async ({ page }) => {
    // This test validates:
    // - The page renders
    // - The document title matches the FSM evidence: "Socket Programming"
    const title = await page.title();
    expect(title).toBe('Socket Programming');

    // Also verify the <title> element exists in the DOM and contains the expected text
    const titleText = await page.evaluate(() => {
      const t = document.querySelector('title');
      return t ? t.textContent : null;
    });
    expect(titleText).toBe('Socket Programming');
  });

  // Verify that the page attempted any entry action and that runtime errors (if any)
  // are observed. FSM specified an entry_action "renderPage()", so we assert that
  // an error referencing renderPage or a ReferenceError occurs.
  test('Entry action observation: detect runtime ReferenceError for renderPage if invoked', async ({ page }) => {
    // This test validates:
    // - That page runtime errors are captured
    // - That an error referencing renderPage or a ReferenceError occurred as part of entry action

    // We must not modify the page. We only inspect captured page errors.
    // Assert that at least one page error occurred and that it looks like the missing renderPage error.
    // Per instructions we must let ReferenceError happen naturally and assert it occurs.
    expect(pageErrors.length).toBeGreaterThan(0);

    const matchesRenderPageError = pageErrors.some((err) => {
      const msg = String(err && (err.message || err));
      return /renderPage/i.test(msg) || /referenceerror/i.test(msg) || /is not defined/i.test(msg);
    });

    // The application FSM indicated an entry action of renderPage(); the implementation may
    // attempt to call it and thus produce a ReferenceError. We assert that such an error was observed.
    expect(matchesRenderPageError).toBeTruthy();
  });

  // Directly attempt to invoke renderPage in the page context and assert that it throws a ReferenceError.
  // This checks the edge case where renderPage is not defined on window.
  test('Edge case: calling renderPage() in page context throws ReferenceError', async ({ page }) => {
    // This test validates:
    // - Invoking the expected entry action directly triggers a ReferenceError when it's missing.
    // We intentionally do not define renderPage; we simply call it to let the runtime throw.

    let evaluateError = null;
    try {
      // Attempt to call renderPage() from within the page. If undefined, the evaluation will reject.
      await page.evaluate(() => {
        // Intentionally call the function that FSM says should run on entry.
        // If it does not exist, this should raise ReferenceError naturally.
        // We do not catch it here because we want Playwright to surface it to us.
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (err) {
      evaluateError = err;
    }

    // Expect an error to have been thrown when attempting to call renderPage.
    expect(evaluateError).toBeTruthy();

    // Check that the error message indicates a ReferenceError or mentions renderPage/is not defined.
    const msg = String(evaluateError.message || evaluateError);
    expect(/renderPage/i.test(msg) || /referenceerror/i.test(msg) || /is not defined/i.test(msg)).toBeTruthy();
  });

  // The FSM extraction notes that no interactive elements were detected.
  // Assert that the DOM contains no typical interactive controls.
  test('FSM extraction: no interactive elements present (buttons, inputs, links, selects, textareas)', async ({ page }) => {
    // This test validates:
    // - There are no buttons, inputs, anchors, selects, or textareas as described by the extraction summary.
    const counts = await page.evaluate(() => {
      const selectors = ['button', 'input', 'a', 'select', 'textarea'];
      const results = {};
      for (const s of selectors) {
        results[s] = document.querySelectorAll(s).length;
      }
      return results;
    });

    // Expect zero for all interactive element types detected in the extraction summary.
    for (const key of Object.keys(counts)) {
      expect(counts[key], `Expected zero <${key}> elements`).toBe(0);
    }
  });

  // Validate that user interactions (click) do not produce transitions since there are no transitions defined.
  test('No transitions: clicking the document does not change DOM (no state transitions)', async ({ page }) => {
    // This test validates:
    // - Clicking the body should not change the DOM (no transitions defined in FSM).
    const before = await page.evaluate(() => document.body.innerHTML);

    // Perform a click in the middle of the page
    await page.mouse.click(50, 50);

    // Wait briefly to allow any potential event handlers to run
    await page.waitForTimeout(100);

    const after = await page.evaluate(() => document.body.innerHTML);

    // If no transitions or interactive handlers exist, the body HTML should remain equal.
    expect(after).toBe(before);
  });

  // Inspect captured console messages to ensure we observed runtime diagnostics.
  test('Runtime diagnostics: console messages collected and reported', async () => {
    // This test validates:
    // - Console messages (including errors) are collected
    // - At least one console message or page error references the entry action or a runtime error

    // At least one diagnostic (console or page error) should have been recorded by the listeners in beforeEach
    const haveConsole = consoleMessages.length > 0;
    const havePageErrors = pageErrors.length > 0;

    // It's acceptable if only page errors exist or only console messages exist, but at least one should be present.
    expect(haveConsole || havePageErrors).toBeTruthy();

    // If console messages exist, ensure we capture their structure
    if (haveConsole) {
      const foundErrorLike = consoleMessages.some((m) =>
        /renderPage|referenceerror|is not defined/i.test(m.text)
      );
      // Either a console entry references the issue, or we have pageErrors to rely on.
      expect(foundErrorLike || havePageErrors).toBeTruthy();
    } else {
      // Ensure pageErrors contains a relevant message if no console messages are present
      const foundPageError = pageErrors.some((err) =>
        /renderPage|referenceerror|is not defined/i.test(String(err && err.message))
      );
      expect(foundPageError).toBeTruthy();
    }
  });
});