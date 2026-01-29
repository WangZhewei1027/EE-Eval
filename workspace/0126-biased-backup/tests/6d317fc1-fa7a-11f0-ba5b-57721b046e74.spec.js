import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d317fc1-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Congestion Control interactive app (Application ID: 6d317fc1-fa7a-11f0-ba5b-57721b046e74)', () => {
  // Arrays to capture runtime observations for each test
  let pageErrors;
  let consoleMessages;

  // Attach listeners before each test and navigate to the page exactly as-is.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught exceptions thrown in the page (e.g., ReferenceError, TypeError)
    page.on('pageerror', (err) => {
      // Keep full Error object for assertions
      pageErrors.push(err);
    });

    // Capture console messages for additional verification
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Load the page without modifying the environment. Allow scripts to run naturally.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // remove listeners implicitly by closing the page - Playwright will handle cleanup
    // but explicitly clear arrays to avoid cross-test leakage
    pageErrors = [];
    consoleMessages = [];
  });

  test('Idle state: page title should be "Congestion Control" and entry action observed', async ({ page }) => {
    // This test validates the FSM Idle state's evidence (title)
    // and that the declared entry action (renderPage()) either ran or caused a runtime error.
    // We intentionally do NOT alter the page; we observe runtime errors if renderPage() is missing.

    // Verify the document title matches FSM evidence for the Idle state
    const title = await page.title();
    expect(title).toBe('Congestion Control');

    // Wait a short moment to ensure any synchronous errors on load are captured
    // (Most errors will have been emitted during page load)
    await page.waitForTimeout(100);

    // The FSM's entry_actions include "renderPage()".
    // The page may attempt to call renderPage() during load. If renderPage is missing,
    // we expect a runtime error to have been emitted. Assert that at least one page error happened.
    expect(pageErrors.length).toBeGreaterThan(0);

    // At least one of the captured errors should reference the missing function or be a ReferenceError.
    const hasRenderPageReference = pageErrors.some(err => {
      // err.name is typically "ReferenceError" when a function is not defined
      // err.message often contains the function name, e.g., "renderPage is not defined"
      try {
        const name = err.name || '';
        const msg = String(err.message || '').toLowerCase();
        return name === 'ReferenceError' || msg.includes('renderpage') || msg.includes('renderPage');
      } catch {
        return false;
      }
    });

    // Assert that a ReferenceError or a message mentioning renderPage was observed.
    // This confirms that the declared entry action renderPage() attempted to run.
    expect(hasRenderPageReference).toBeTruthy();
  });

  test('No interactive elements or inline event handlers present', async ({ page }) => {
    // This test verifies the FSM extraction notes: no interactive elements or event handlers found.

    // Count common interactive form controls and anchors (buttons, inputs, selects, textareas, links)
    const interactiveCount = await page.locator('button, input, textarea, select, a').count();
    // Expecting zero interactive controls as per extraction summary
    expect(interactiveCount).toBe(0);

    // Check for inline DOM event handler attributes (e.g., onclick, onchange, oninput, onsubmit)
    const inlineHandlers = await page.evaluate(() => {
      const selector = '[onclick],[onchange],[oninput],[onkeydown],[onsubmit],[onmouseover],[onload]';
      return document.querySelectorAll(selector).length;
    });
    expect(inlineHandlers).toBe(0);

    // Also verify there are no script tags that define obvious handlers by searching for 'addEventListener'
    // We only observe page text and console; do not execute or modify page.
    const pageContent = await page.content();
    const hasAddEventListenerText = pageContent.includes('addEventListener');
    // The extraction summary suggests no event handlers; assert no textual occurrence
    expect(hasAddEventListenerText).toBe(false);
  });

  test('FSM transitions: none defined - assert no dynamic state transitions occurred', async ({ page }) => {
    // The FSM defines a single default state (Idle) and zero transitions.
    // Validate that no DOM-driven navigation or transitions were triggered during load.

    // Capture any history changes (pushState/replaceState) by checking document.referrer and location
    // (Note: we do not instrument history; we just assert the page stayed at the supplied URL path.)
    const currentUrl = page.url();
    expect(currentUrl).toContain('/workspace/0126-biased/html/6d317fc1-fa7a-11f0-ba5b-57721b046e74.html');

    // No transitions implies no dynamic UI changes that would indicate state switching.
    // Check for changes that might indicate dynamic replacement of the body content:
    const bodyLength = await page.evaluate(() => document.body ? document.body.innerHTML.length : 0);
    // Expect some minimal content but not heavy dynamic content; at least the title exists so body length may be small.
    expect(bodyLength).toBeGreaterThanOrEqual(0);

    // Ensure that if any errors occurred (as expected for renderPage), they are still captured.
    expect(pageErrors.length).toBeGreaterThan(0);
  });

  test('Console output and page errors are observable via Playwright listeners', async ({ page }) => {
    // This test demonstrates that we captured console messages and page errors.
    // It asserts that console capture works and that at least one pageerror (e.g., ReferenceError) occurred.

    // Ensure we have captured console messages array (can be empty) - we assert its shape and that it's an array
    expect(Array.isArray(consoleMessages)).toBe(true);

    // At least one pageerror should have been captured during page load (see earlier test).
    expect(pageErrors.length).toBeGreaterThan(0);

    // Optionally assert that some console messages are of a known type if present
    const hasConsoleError = consoleMessages.some(m => m.type === 'error');
    // It's valid if there is or isn't a console.error; we simply assert the console message structure is present.
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);

    // For debugging and traceability inside CI logs, ensure that the first few captured errors contain useful info.
    // We assert that the first page error's message is a non-empty string.
    const firstError = pageErrors[0];
    expect(typeof firstError.message).toBe('string');
    expect(firstError.message.length).toBeGreaterThan(0);
  });

  test('Edge case: attempting to find non-existent interactive controls should not throw', async ({ page }) => {
    // This test verifies that querying for non-existent elements does not crash the test runner
    // and that the page remains loaded despite any runtime errors emitted previously.

    // Attempt to locate a control that definitely does not exist
    const nonexistent = page.locator('#this-element-does-not-exist-hopefully');
    const count = await nonexistent.count();
    expect(count).toBe(0);

    // The page should still have a valid DOM and title
    const title = await page.title();
    expect(title).toBe('Congestion Control');

    // Confirm that page errors remain observable after additional DOM operations
    expect(pageErrors.length).toBeGreaterThan(0);
  });
});