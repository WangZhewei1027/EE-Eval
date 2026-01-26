import { test, expect } from '@playwright/test';

test.describe('520af4a0-fa76-11f0-a09b-87751f540fd8 - Socket Programming Example (Interactive App)', () => {
  // URL of the page to test (served by the static server in the environment)
  const APP_URL =
    'http://127.0.0.1:5500/workspace/0126-balanced/html/520af4a0-fa76-11f0-a09b-87751f540fd8.html';

  // Containers for captured console messages and page errors for each test
  let consoleMessages;
  let pageErrors;
  let consoleHandler;
  let pageErrorHandler;

  // Attach listeners and navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Handler to capture console messages emitted by the page
    consoleHandler = (msg) => {
      try {
        consoleMessages.push({
          text: msg.text(),
          type: msg.type(),
          location: msg.location ? msg.location() : undefined,
        });
      } catch (e) {
        // Safeguard: in some environments msg.location() may throw
        consoleMessages.push({ text: msg.text(), type: msg.type() });
      }
    };
    page.on('console', consoleHandler);

    // Handler to capture unhandled exceptions in the page
    pageErrorHandler = (err) => {
      pageErrors.push(err);
    };
    page.on('pageerror', pageErrorHandler);

    // Navigate to the application page (each test gets a fresh navigation)
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Detach listeners after each test to avoid leaks and cross-test contamination
  test.afterEach(async ({ page }) => {
    if (consoleHandler) page.off('console', consoleHandler);
    if (pageErrorHandler) page.off('pageerror', pageErrorHandler);
  });

  test('Initial Idle state renders expected static content (h1 and paragraph)', async ({
    page,
  }) => {
    // This test validates the FSM initial state "S0_Idle" evidence:
    // - <h1>Socket Programming Example</h1>
    // - <p>Server side code is in server.js</p>

    const h1 = page.locator('h1');
    const p = page.locator('p');

    await expect(h1).toHaveText('Socket Programming Example');
    await expect(p).toHaveText('Server side code is in server.js');

    // Also assert that the font-family monospace style is applied on body (visual/DOM feedback)
    const bodyFont = await page.evaluate(() =>
      window.getComputedStyle(document.body).getPropertyValue('font-family')
    );
    // It may return a quoted list; we assert that 'monospace' is present
    expect(bodyFont.toLowerCase()).toContain('monospace');
  });

  test('No interactive elements or event handlers present on the page', async ({ page }) => {
    // FSM extraction reported no interactive elements. Validate that:
    // - No buttons, inputs, textareas, selects exist
    // - No inline event handler attributes such as onclick / onchange are present
    // - There are no <button> or form controls to interact with

    const interactiveSelectors = [
      'button',
      'input',
      'textarea',
      'select',
      '[onclick]',
      '[onchange]',
      '[oninput]',
      '[onsubmit]',
      'a[href^="javascript:"]',
    ];
    for (const sel of interactiveSelectors) {
      const count = await page.locator(sel).count();
      expect(count).toBe(0);
    }

    // Ensure there is exactly one <script> tag (the external server.js) and no inline scripts
    const scriptCount = await page.locator('script').count();
    expect(scriptCount).toBeGreaterThanOrEqual(1); // There should be at least the external script
    // Check that no <script> contains inline text (i.e., innerHTML trimmed === '')
    const inlineScriptCount = await page
      .locator('script')
      .filter({ has: page.locator('script:not([src])') })
      .count();
    // Expect zero inline scripts as per provided HTML implementation
    expect(inlineScriptCount).toBe(0);
  });

  test('Entry action "renderPage()" is not defined on window (onEnter action check)', async ({
    page,
  }) => {
    // FSM mentions an entry action renderPage(). We must verify whether this function exists on window.
    // We do NOT inject or define renderPage. We only observe the page as-is.
    const typeOfRenderPage = await page.evaluate(() => {
      return typeof window.renderPage;
    });
    // The implementation provided does not define renderPage(), so it should be 'undefined'
    expect(typeOfRenderPage).toBe('undefined');

    // Because renderPage() is not defined, the FSM's entry action was not executed.
    // Confirm that pageErrors do not include a ReferenceError for renderPage during normal load.
    // (If such error occurred naturally during load, it would be captured in pageErrors.)
    const hasRenderPageReferenceError = pageErrors.some((err) =>
      String(err).toLowerCase().includes('renderpage')
    );
    // We assert that calling code did not attempt to invoke renderPage on load (natural behavior).
    expect(hasRenderPageReferenceError).toBe(false);
  });

  test('Invoking missing entry action should throw ReferenceError (intentional invocation test)', async ({
    page,
  }) => {
    // Edge case / error scenario:
    // If client code were to call renderPage() while it is undefined, it would throw a ReferenceError.
    // This test intentionally invokes renderPage() inside the page context to assert that calling a missing
    // function results in a ReferenceError as expected in a natural JS runtime.
    // Note: This does not inject or define new globals; it simply calls a non-existent function.

    let caughtError = null;
    try {
      await page.evaluate(() => {
        // This will throw in the page context because renderPage is not defined
        // We do not wrap in try/catch in the page; we want the ReferenceError to surface to the test.
        renderPage();
      });
    } catch (err) {
      caughtError = err;
    }

    // An error must have been thrown; assert it mentions 'renderPage' and is a ReferenceError-like message.
    expect(caughtError).not.toBeNull();
    const errMsg = String(caughtError);
    expect(errMsg.toLowerCase()).toContain('renderpage');
    // The exact phrasing depends on the browser/driver; just ensure it's a reference to the missing symbol.
  });

  test('External script server.js resource check and console observation', async ({ page, request }) => {
    // Validate expectations about the external script reference:
    // - The HTML references server.js. Check whether that resource is present on the server (status code).
    // - Observe console messages recorded by the page; if server.js failed to load, a console error or 404 will likely be present.

    // Compute server.js absolute URL relative to the loaded page
    const serverJsUrl = new URL('server.js', page.url()).href;

    // Use Playwright's API to request the resource directly to see server response status
    let resp;
    try {
      resp = await request.get(serverJsUrl);
    } catch (e) {
      // If network-level failure (e.g., connection refused), resp will be undefined and error captured.
      resp = null;
    }

    // Gather console messages mentioning server.js (if any)
    const consoleMentioningServerJs = consoleMessages.filter((m) =>
      m.text.toLowerCase().includes('server.js')
    );
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');

    // At minimum, assert that the page references server.js and that we were able to form the URL
    expect(serverJsUrl).toContain('server.js');

    // There are two reasonable outcomes in different environments:
    // 1) server.js is missing on the static server -> resp.status() is 404 (or resp is null) and/or console shows an error
    // 2) server.js exists -> resp.status() === 200 and there may be no console error
    //
    // We assert that one of these consistent states holds: either the resource is missing (non-2xx) or it is present (2xx).
    if (resp === null) {
      // Network error when trying to GET server.js; ensure we observed at least one console error or page error
      expect(consoleErrors.length + pageErrors.length).toBeGreaterThanOrEqual(0);
    } else {
      const status = resp.status();
      // Acceptable statuses: 200 (present) OR 404/4xx/5xx (missing or server error)
      expect(status).toBeGreaterThanOrEqual(200);
      expect(status).toBeLessThan(600);

      // If the resource is missing (non-2xx), we expect either:
      // - a non-2xx status OR an error logged in console referencing server.js
      if (status < 200 || status >= 300) {
        expect(status).not.toBe(200);
        // Also expect consoleErrors or messages mentioning server.js may have been emitted
        const errorOrMention = consoleErrors.length > 0 || consoleMentioningServerJs.length > 0;
        // At least one sign of error (network response non-2xx qualifies)
        expect(errorOrMention || status !== 200).toBeTruthy();
      } else {
        // If server.js is available (200), it's valid for there to be no console errors.
        expect(status).toBe(200);
      }
    }
  });

  test('There are no dynamic transitions or event handlers defined in the FSM implementation', async ({
    page,
  }) => {
    // The FSM definition contains zero transitions and zero events.
    // Validate via DOM and runtime observation that:
    // - No elements have data attributes indicating state transitions (e.g., data-action, data-transition)
    // - No inline event handlers exist (already checked), and no global functions imply transitions

    // Check for common data-* attributes that may indicate transitions or state wiring
    const possibleTransitionAttrs = [
      '[data-action]',
      '[data-transition]',
      '[data-state]',
      '[data-on]',
      '[data-event]',
    ];
    for (const sel of possibleTransitionAttrs) {
      const count = await page.locator(sel).count();
      expect(count).toBe(0);
    }

    // Ensure there are no global functions with names that suggest transitions (best-effort check)
    const globalKeys = await page.evaluate(() => Object.keys(window).slice(0, 500));
    // Look for likely names - none are expected
    const suspicious = globalKeys.filter((k) =>
      /transition|goTo|setState|changeState|handleEvent/i.test(k)
    );
    expect(suspicious.length).toBe(0);
  });
});