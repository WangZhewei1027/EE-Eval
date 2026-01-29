import { test, expect } from '@playwright/test';

const APP_ID = '6d32df51-fa7a-11f0-ba5b-57721b046e74';
const URL = `http://127.0.0.1:5500/workspace/0126-biased/html/${APP_ID}.html`;

test.describe('Interactive Application - FSM validation for ' + APP_ID, () => {
  // Arrays to capture runtime diagnostics
  let consoleMessages = [];
  let pageErrors = [];

  // Attach listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages for inspection
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // If msg.text() throws, capture the generic message
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture page runtime errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object from the page context
      pageErrors.push({ name: err.name || 'Error', message: err.message || String(err) });
    });

    // Load the application page as-is (do not modify or patch the page)
    await page.goto(URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // A quick navigation to a blank page to trigger potential unload behavior (if any)
    // We keep this in teardown to avoid interfering with primary assertions.
    try {
      await page.goto('about:blank');
    } catch (e) {
      // Swallow navigation errors here; tests will assert observed errors separately.
    }
  });

  test('Idle state: page loads and contains an HTML root element', async ({ page }) => {
    // Validate the page has an HTML root node - evidence of Idle state's renderPage() entry action intent
    const content = await page.content();
    // We expect the raw HTML content to contain an <html ...> tag
    expect(content.toLowerCase()).toContain('<html', 'Expected the loaded document to include an <html> tag reflecting initial render.');
  });

  test('Idle state entry action: detect renderPage invocation or capture runtime errors', async () => {
    // The FSM indicates an entry action renderPage(). The implementation may:
    // - log something to console when renderPage runs, or
    // - attempt to call renderPage() but fail with a ReferenceError (or other runtime error).
    //
    // We assert that either evidence of renderPage appears in console logs OR that a runtime error occurred
    // (ReferenceError, TypeError, SyntaxError) — we do not modify the page to force behavior.
    const renderCalled = consoleMessages.some((m) => /renderpage/i.test(m.text));
    const errorIndicatesRender = pageErrors.some((e) => /renderpage/i.test(e.message));

    const runtimeErrorDetected = pageErrors.some((e) =>
      ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name)
    );

    // At least one of these should be true given the FSM's declared entry action and the instruction
    // to let natural runtime errors surface rather than patching the app.
    expect(renderCalled || errorIndicatesRender || runtimeErrorDetected).toBeTruthy(
      [
        'Expected either a console message mentioning "renderPage" (entry action) or a runtime error',
        '(ReferenceError / TypeError / SyntaxError) to have occurred while loading the page.',
        'Observed console messages: ' + JSON.stringify(consoleMessages.slice(0, 20)),
        'Observed page errors: ' + JSON.stringify(pageErrors.slice(0, 20)),
      ].join(' ')
    );
  });

  test('No interactive elements or event handlers detected (per FSM extraction)', async ({ page }) => {
    // FSM extraction reported no interactive components. Verify common interactive elements are absent.
    // We check for buttons, inputs, anchors, selects, textareas and inline event handler attributes.
    const interactiveLocator = page.locator('button, input, select, textarea, a, [onclick], [onchange], [oninput], [onsubmit], [onmouseover]');
    const interactiveCount = await interactiveLocator.count();

    // The FSM stated "No interactive elements or event handlers were found."
    expect(interactiveCount).toBe(
      0,
      `Expected no interactive elements or inline handlers based on the FSM extraction. Found ${interactiveCount}.` +
        ` Console logs: ${JSON.stringify(consoleMessages.slice(0, 20))}. Page errors: ${JSON.stringify(pageErrors.slice(0, 20))}.`
    );
  });

  test('Clicking the page does not trigger transitions or DOM changes (no transitions defined)', async ({ page }) => {
    // Capture the initial body HTML snapshot
    const initialBody = await page.evaluate(() => document.body ? document.body.innerHTML : '');
    // Click in the center of the page to simulate a user interaction
    await page.mouse.click(400, 200);

    // Give the page a short moment to react if there were listeners
    await page.waitForTimeout(300);

    const afterClickBody = await page.evaluate(() => document.body ? document.body.innerHTML : '');

    // Because FSM has no transitions, clicking should not change the DOM structure in a meaningful way.
    expect(afterClickBody).toBe(
      initialBody,
      'Expected no DOM changes after a generic click because FSM defines no transitions. ' +
        `Initial vs after-click body diff may indicate unexpected interactive behavior. Console: ${JSON.stringify(consoleMessages.slice(0, 20))}`
    );
  });

  test('No explicit exit actions defined — navigating away should not emit exit-related logs', async ({ page }) => {
    // FSM: exit_actions empty. We therefore assert that unloading the page does not produce a log mentioning exit/onExit.
    // Capture current console messages length to isolate new messages from the navigation.
    const beforeCount = consoleMessages.length;

    // Navigate away to trigger potential unload/exit actions
    await page.goto('about:blank');

    // Allow any unload handlers to run and logs to be emitted
    await page.waitForTimeout(200);

    const newMessages = consoleMessages.slice(beforeCount);
    const exitLikeMessage = newMessages.some((m) => /exit|onexit/i.test(m.text));

    expect(exitLikeMessage).toBe(
      false,
      'Expected no exit/onExit related console messages because FSM has no exit_actions. New console messages: ' +
        JSON.stringify(newMessages)
    );
  });

  test('Runtime errors analysis: report any captured page errors for debugging', async () => {
    // This test documents any runtime errors captured; it asserts nothing must occur,
    // but will fail if a SyntaxError was captured (indicating a broken script).
    // We fail the test ONLY if a SyntaxError is present, since that generally makes the page unusable.
    const syntaxErrors = pageErrors.filter((e) => e.name === 'SyntaxError');

    expect(syntaxErrors.length).toBe(
      0,
      'Unexpected SyntaxError(s) detected on the page load which likely indicate a malformed script: ' +
        JSON.stringify(syntaxErrors)
    );
  });
});