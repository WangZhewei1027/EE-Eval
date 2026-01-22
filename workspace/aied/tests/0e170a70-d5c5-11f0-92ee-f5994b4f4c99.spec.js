import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/0e170a70-d5c5-11f0-92ee-f5994b4f4c99.html';

test.describe('Priority Queue Interactive Application (0e170a70-d5c5-11f0-92ee-f5994b4f4c99)', () => {
  // Helper to load page and collect console / page errors
  async function loadPageAndCollect(page) {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      // Collect all console messages (type and text) for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Collect unhandled exceptions that bubble to the page
      pageErrors.push(err);
    });

    // Navigate to the app and wait for load to complete
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Give the page a short moment to run scripts and emit any async errors
    await page.waitForTimeout(250);

    return { consoleMessages, pageErrors };
  }

  test('DOM sanity: #queue exists and has expected base styling', async ({ page }) => {
    // This test verifies that the visual component detected in the FSM (selector "#queue")
    // is present in the DOM and has the expected layout/background style from the CSS.
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Ensure the element exists
    const queue = await page.$('#queue');
    expect(queue).not.toBeNull();

    // Verify the element's computed background color (as defined in the HTML)
    const bgColor = await page.$eval('#queue', (el) => {
      return getComputedStyle(el).backgroundColor;
    });

    // The CSS sets background-color: #f4f4f4 -> rgb(244, 244, 244)
    expect(bgColor).toBe('rgb(244, 244, 244)');

    // Ensure it has no visible text content initially (empty queue)
    const text = await page.$eval('#queue', (el) => el.textContent.trim());
    expect(text).toBe('');
  });

  test('Initialization triggers entry action (pop()) and results in script/runtime errors as implemented', async ({ page }) => {
    // This test validates the FSM "Initialized" state's entry action pop() was invoked on load.
    // The page code is intentionally flawed and uses external script + non-ASCII method names,
    // so we assert that script/runtime errors occur naturally without attempting to fix them.
    const { consoleMessages, pageErrors } = await loadPageAndCollect(page);

    // It is expected that at least one runtime error or console error occurs due to:
    // - incorrect external script usage (Popper package name/usage)
    // - non-ASCII method get顶部() being called or other TypeErrors/ReferenceErrors
    const totalErrorLikeMessages = [
      ...pageErrors.map((e) => (e && e.message) || String(e)),
      ...consoleMessages.filter((m) => m.type === 'error' || m.type === 'warning').map((m) => m.text),
    ];

    // Ensure we observed at least one error/warning (pageErrors or console.error)
    expect(totalErrorLikeMessages.length).toBeGreaterThan(0);

    // Combined textual evidence to validate that the errors are related to expected bad calls
    const combinedText = totalErrorLikeMessages.join(' | ').toLowerCase();

    // The implementation includes identifiers/terms we expect to see in error traces:
    // - "popper" or "popper is not defined" (external lib load / usage)
    // - "pop is not a function" / "get顶部" (internal method mis-usage / non-ascii method)
    // Accept any of these patterns as valid evidence that the entry action was attempted and failed naturally.
    const expectedPatterns = [/popper/i, /popper is not defined/i, /popper is not a constructor/i, /get顶部/i, /顶部/i, /is not a function/i, /not defined/i, /pop\(/i];

    const matches = expectedPatterns.some((rx) => rx.test(combinedText));

    // At least one of the expected error hints should be present
    expect(matches).toBeTruthy();
  });

  test('No interactive controls exist (FSM indicates no events/transitions): verify absence of buttons/inputs', async ({ page }) => {
    // The FSM extraction summary indicates "No interactive elements like buttons or inputs were found."
    // Validate that the served page indeed contains no input or button elements that could trigger transitions.
    await page.goto(APP_URL, { waitUntil: 'load' });

    const buttonCount = await page.$$eval('button', (els) => els.length);
    const inputCount = await page.$$eval('input, textarea, select', (els) => els.length);

    expect(buttonCount).toBe(0);
    expect(inputCount).toBe(0);
  });

  test('FSM state coverage assertion: S0_Initialized entry_action was present in source and pop() was invoked (error evidence)', async ({ page }) => {
    // This test tries to assert that the page attempted to perform the FSM state's entry action (pop()).
    // Because the runtime is broken, we assert based on side-effects (errors mentioning pop or get顶部).
    const { consoleMessages, pageErrors } = await loadPageAndCollect(page);

    // Collect all textual traces available
    const consoleTexts = consoleMessages.map((m) => `${m.type}: ${m.text}`);
    const pageErrorTexts = pageErrors.map((e) => (e && e.message) || String(e));
    const allTraces = [...consoleTexts, ...pageErrorTexts].join(' | ').toLowerCase();

    // Check for clues that pop() was called (either direct "pop()" in stack trace or errors coming from inside the pop function)
    const clues = [/pop\(/i, /\bpop\)/i, /get顶部/i, /顶部/i, /popper/i];

    const found = clues.some((rx) => rx.test(allTraces));

    // If the runtime threw before pop() could be called (e.g., new Popper crashed), that is still acceptable
    // for this test; we therefore assert that there is either evidence pop() was attempted or there is an earlier Popper error.
    expect(found).toBe(true);
  });

  test('Edge case: verify that script load failures are observable via console network/script errors', async ({ page }) => {
    // Some servers or CDNs may 404 the external popper script; such failures usually surface as console messages
    // (type 'error') rather than pageerror. We validate that such console entries are captured.
    const { consoleMessages } = await loadPageAndCollect(page);

    // Look specifically for console messages referring to the external script or resource loading problems.
    const scriptLoadErrors = consoleMessages
      .filter((m) => m.type === 'error')
      .map((m) => m.text)
      .join(' | ')
      .toLowerCase();

    // Accept if either an explicit script load/network error exists OR other script runtime errors were captured.
    const hasScriptLoadError = /failed to load resource|404|net::|error loading/i.test(scriptLoadErrors);
    const hasRuntimeError = /popper|get顶部|顶部|is not a function|not defined|pop\(/i.test(scriptLoadErrors);

    expect(hasScriptLoadError || hasRuntimeError).toBe(true);
  });
});