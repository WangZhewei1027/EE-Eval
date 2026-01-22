import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e181be0-d5c5-11f0-92ee-f5994b4f4c99.html';

test.describe('Heap Sort interactive application (FSM: S0_Idle)', () => {
  // This suite validates the single FSM state (Idle), verifies the entry action
  // mention (renderPage) is not present on the page, observes console output,
  // and intentionally triggers/observes the ReferenceError that would arise if
  // the missing entry action were invoked.

  test('S0_Idle: page renders expected static elements (h1 and #heap)', async ({ page }) => {
    // Capture console messages and page errors for assertions
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => consoleMessages.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => pageErrors.push(err));

    // Navigate to the page
    await page.goto(APP_URL);

    // Validate the page title and header content (evidence for Idle state)
    await expect(page.locator('h1')).toHaveText('Heap Sort');

    // Validate the #heap component exists and is empty per implementation
    const heap = page.locator('#heap');
    await expect(heap).toBeVisible();
    // The FSM evidence includes "<div id=\"heap\"></div>", so expect empty innerHTML or no children
    const heapInnerHTML = await heap.evaluate(node => node.innerHTML.trim());
    expect(heapInnerHTML === '' || heapInnerHTML === undefined).toBeTruthy();

    // Ensure there are no unexpected fatal page errors during normal load (we'll check error details elsewhere)
    expect(pageErrors.length).toBe(0);

    // Confirm that the script logged the heap array to console at least once.
    // We don't assert exact formatting (browser differences), but we expect some console log containing numeric values from the heap.
    const logTexts = consoleMessages.filter(m => m.type === 'log').map(m => m.text);
    const combinedLogs = logTexts.join('\n');
    // Expect the logged heap to include at least one of the known values from the array.
    expect(combinedLogs.includes('1') || combinedLogs.includes('5') || combinedLogs.includes('9')).toBeTruthy();
  });

  test('FSM entry action "renderPage" should not be present as a function on the page', async ({ page }) => {
    // We only load page and inspect presence/absence of the entry action function.
    await page.goto(APP_URL);

    // Check typeof renderPage from within the page context. If absent, typeof returns 'undefined' (no ReferenceError).
    const typeofRenderPage = await page.evaluate(() => {
      // Using typeof avoids throwing a ReferenceError if the identifier is completely absent.
      return typeof renderPage;
    });
    expect(typeofRenderPage).toBe('undefined');

    // Also verify that accessing window.renderPage yields undefined (explicit global check)
    const windowHasRenderPage = await page.evaluate(() => {
      return Object.prototype.hasOwnProperty.call(window, 'renderPage') ? typeof window.renderPage : 'absent';
    });
    // Either absent or undefined are acceptable; confirm it's not a function.
    expect(windowHasRenderPage === 'absent' || windowHasRenderPage === 'undefined').toBeTruthy();
  });

  test('Invoking missing entry action "renderPage()" triggers a ReferenceError (observed as pageerror)', async ({ page }) => {
    // Attach listener to capture any page errors that occur when we attempt to invoke the missing function.
    const pageErrors = [];
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // Attempt to call renderPage() in the page global scope. This will naturally throw a ReferenceError
    // because renderPage is not declared anywhere in the page's scripts.
    let evalError = null;
    try {
      // Intentionally call identifier directly (not via window.renderPage) to provoke ReferenceError for an undeclared identifier.
      await page.evaluate(() => {
        // This will throw ReferenceError: renderPage is not defined in the page context
        // We intentionally do this to validate FSM's entry action is missing in runtime.
        // Do not try to catch here; let it bubble so Playwright surfaces it.
        // However, we wrap in a function executed by evaluate so Playwright can catch it.
        // The thrown error will be propagated back to the test as well as emitted as a 'pageerror' event.
        // eslint-disable-next-line no-undef
        return renderPage();
      });
    } catch (err) {
      // Capture the error thrown by page.evaluate so we can assert on it.
      evalError = err;
    }

    // We expect an error to have been thrown when calling the missing function.
    expect(evalError).not.toBeNull();
    // The message should indicate ReferenceError or 'renderPage is not defined' in some form.
    // Playwright may wrap the original error, so we check the message text.
    expect(String(evalError.message)).toContain('renderPage');

    // Confirm that a pageerror event was emitted and its name or message indicates ReferenceError
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    const matching = pageErrors.some(e => {
      // e.name is typically 'ReferenceError' and e.message contains the identifier name
      const nameMatches = e.name && e.name.toLowerCase().includes('referenceerror');
      const msgMatches = e.message && e.message.includes('renderPage');
      return nameMatches || msgMatches;
    });
    expect(matching).toBeTruthy();
  });

  test('Sanity: no interactive controls present and no transitions in FSM (page is static)', async ({ page }) => {
    // The FSM extraction indicates no events or transitions. Verify there are no buttons or form controls on the page.
    await page.goto(APP_URL);

    // No <button>, no input[type="button"], no .interactive elements.
    const buttons = await page.locator('button').count();
    const inputs = await page.locator('input, select, textarea').count();
    const interactiveClass = await page.locator('.interactive').count();

    expect(buttons).toBe(0);
    expect(inputs).toBe(0);
    expect(interactiveClass).toBe(0);

    // Also assert that the heap div remains unchanged after a short wait (no dynamic transitions)
    const before = await page.locator('#heap').evaluate(node => node.innerHTML);
    await page.waitForTimeout(200); // small wait to allow any dynamic script to run (there shouldn't be any)
    const after = await page.locator('#heap').evaluate(node => node.innerHTML);
    expect(after).toBe(before);
  });

  test('Console and script loading: capture any errors emitted by external scripts (jest inclusion)', async ({ page }) => {
    // Some pages include third-party scripts that may produce console warnings/errors.
    // Capture console.error and pageerror messages during navigation.
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(err));

    await page.goto(APP_URL);

    // The inclusion of the external jest script may or may not produce console output.
    // We assert that if there are errors, they are of recognizable JS runtime types (ReferenceError, SyntaxError, TypeError).
    if (pageErrors.length > 0 || consoleErrors.length > 0) {
      const combined = [
        ...pageErrors.map(e => (e && e.name ? `${e.name}: ${e.message}` : String(e))),
        ...consoleErrors
      ].join('\n');

      // Ensure that the errors, if present, are JavaScript runtime errors (we accept ReferenceError, SyntaxError, TypeError)
      const hasExpectedError = combined.match(/ReferenceError|SyntaxError|TypeError/i);
      expect(hasExpectedError).not.toBeNull();
    } else {
      // If no errors occurred, that's also acceptable: assert that there are simply no console errors.
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    }
  });
});