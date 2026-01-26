import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d3158b2-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Application FSM - S0_Idle (Initial state) - 6d3158b2-fa7a-11f0-ba5b-57721b046e74', () => {
  // Arrays to capture console error messages and unhandled page errors
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console.error messages emitted by the page
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture unhandled exceptions on the page
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(err.message || String(err));
    });

    // Navigate to the page under test. We intentionally load the page exactly as-is.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing to teardown manually; individual tests rely on Playwright fixtures.
  });

  test('Initial raw HTML served should begin with the DOCTYPE evidence from FSM', async ({ request }) => {
    // Validate that the raw served file content starts with '<!DOCTYPE' as extracted in the FSM evidence.
    const response = await request.get(APP_URL);
    const bodyText = await response.text();

    // This checks the original file content sent by the server, not the browser DOM serialization.
    // The FSM evidence included "<!DOCTYPE" — ensure the raw response contains that prefix.
    expect(bodyText.trim().startsWith('<!DOCTYPE')).toBeTruthy();
  });

  test('Entry action renderPage() should not be defined and throwing it should produce a ReferenceError', async ({ page }) => {
    // This test deliberately attempts to invoke the identifier renderPage in the page context.
    // Per instructions we must not inject or redefine anything; we simply observe the natural error.
    // If renderPage is undefined in the page, referencing it should produce a ReferenceError.
    const result = await page.evaluate(() => {
      try {
        // Intentionally reference the identifier renderPage() which is expected to be missing.
        // This will throw a ReferenceError in page context if renderPage is not defined.
        // We catch the error and serialize useful fields back to the test runner.
        return { ok: renderPage() };
      } catch (e) {
        return {
          errorName: e && e.name ? e.name : String(e),
          errorMessage: e && e.message ? e.message : String(e),
        };
      }
    });

    // The FSM specified an entry action "renderPage()". The implementation provided is incomplete,
    // so we expect a ReferenceError to be produced when the page attempts to call or when we attempt to call it.
    expect(result).toHaveProperty('errorName');
    expect(result.errorName).toBe('ReferenceError');
    // Also assert the message references 'renderPage' to ensure the error is about the expected symbol.
    expect(result.errorMessage).toContain('renderPage');
  });

  test('Page should not contain interactive elements (no buttons, inputs, links) as FSM reported none', async ({ page }) => {
    // Validate that the DOM contains no interactive elements typical for event-driven apps.
    const counts = await page.evaluate(() => {
      const buttonCount = document.querySelectorAll('button').length;
      const inputCount = document.querySelectorAll('input, textarea, select').length;
      const linkCount = document.querySelectorAll('a').length;
      const onclickAttrCount = Array.from(document.querySelectorAll('*')).filter(el => {
        // Check for inline attributes that start with "on" (onclick, oninput, etc.)
        return Array.from(el.getAttributeNames ? el.getAttributeNames() : []).some(attr => attr.startsWith('on'));
      }).length;
      return { buttonCount, inputCount, linkCount, onclickAttrCount };
    });

    // The FSM extraction found no interactive components; assert zero counts.
    expect(counts.buttonCount).toBe(0);
    expect(counts.inputCount).toBe(0);
    expect(counts.linkCount).toBe(0);
    expect(counts.onclickAttrCount).toBe(0);
  });

  test('There should be at least one console or page error emitted by loading this malformed/incomplete HTML', async () => {
    // The provided HTML is incomplete ("<!DOCTYPE" only). The environment is expected to produce errors
    // (ReferenceError, SyntaxError, or other page errors). Assert that at least one such error was observed.
    const totalErrors = consoleErrors.length + pageErrors.length;

    // This assertion enforces that the runtime produced an error. If none occurred, this test fails,
    // which is intended because the instructions require observing runtime errors.
    expect(totalErrors).toBeGreaterThan(0);

    // Additionally assert that one of the captured errors references 'renderPage' or indicates a parsing problem.
    // It's acceptable if some messages do not include those strings, but at least one should hint at the expected issues.
    const combined = [...consoleErrors, ...pageErrors].join('\n').toLowerCase();
    const hintPresent = combined.includes('renderpage') || combined.includes('doctype') || combined.includes('syntax') || combined.includes('unexpected') || combined.includes('referenceerror') || combined.includes('typeerror');
    expect(hintPresent).toBeTruthy();
  });

  test('No client-side event handlers or transitions are registered (FSM had zero transitions/events)', async ({ page }) => {
    // We try to detect common patterns of registered handlers:
    // - inline attributes starting with 'on' (checked earlier)
    // - listeners registered via addEventListener are not trivially enumerable;
    //   however we can attempt to detect whether typical interactive events exist on common elements.
    const listenersDetected = await page.evaluate(() => {
      // Heuristic: create an element, attempt to serialize its properties that could hold handlers;
      // We will inspect a snapshot of the document for properties named like 'onclick', 'onchange', etc.
      const handlerProps = ['onclick', 'onchange', 'oninput', 'onsubmit', 'onkeydown', 'onkeyup', 'onfocus', 'onblur'];
      const nodes = Array.from(document.querySelectorAll('*'));
      let found = 0;
      for (const node of nodes) {
        for (const prop of handlerProps) {
          // Accessing DOM property may return null/undefined if not set
          try {
            if (node[prop]) found++;
          } catch (e) {
            // Ignore access errors
          }
        }
      }
      return found;
    });

    // FSM declared zero transitions/events. Heuristically we expect zero discovered DOM handler properties.
    expect(listenersDetected).toBe(0);
  });

  test('Edge case: attempting to call missing entry action from test context should produce page-side ReferenceError', async ({ page }) => {
    // As an additional check, attempt the same renderPage call but catch the thrown error on the page side
    // and verify the thrown error details are consistent with missing function.
    const errInfo = await page.evaluate(() => {
      try {
        // Deliberately reference renderPage by identifier (not via window.renderPage) so a ReferenceError arises
        // if it's not defined in the global scope.
        // We don't catch or suppress runtime errors elsewhere; this is purely observational.
        renderPage(); // expected to throw
        return { invoked: true };
      } catch (e) {
        return { invoked: false, name: e && e.name ? e.name : String(e), message: e && e.message ? e.message : String(e) };
      }
    });

    expect(errInfo.invoked).toBe(false);
    expect(errInfo.name).toBe('ReferenceError');
    expect(errInfo.message).toContain('renderPage');
  });
});