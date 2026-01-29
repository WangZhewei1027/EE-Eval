import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/ca78fe10-fa75-11f0-9854-e7309e7cf385.html';

test.describe("Prim's Algorithm interactive app (FSM validation) - ca78fe10-fa75-11f0-9854-e7309e7cf385", () => {
  // Arrays to collect runtime errors and console messages emitted by the page.
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture page runtime errors (uncaught exceptions, syntax errors, etc.)
    page.on('pageerror', (err) => {
      // normalize to string for robust assertions
      try {
        pageErrors.push(String(err && (err.message || err)));
      } catch (e) {
        pageErrors.push(String(err));
      }
    });

    // Capture console messages for additional evidence
    page.on('console', (msg) => {
      consoleMessages.push(`${msg.type()}: ${msg.text()}`);
    });

    // Navigate to the provided HTML page and wait for load.
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright's automatic cleanup.
  });

  // Test: S0_Idle - initial render evidence
  test('S0_Idle: Page renders the expected static evidence (title <h1>)', async ({ page }) => {
    // Validate that the H1 from the FSM evidence is present and correct.
    const h1 = await page.locator('h1').first();
    await expect(h1).toHaveCount(1);
    await expect(h1).toHaveText("Prim's Algorithm");

    // Also check that the descriptive paragraphs from the HTML are present.
    const paragraphs = await page.locator('p').allTextContents();
    expect(paragraphs.length).toBeGreaterThanOrEqual(4);
    expect(paragraphs[0].toLowerCase()).toContain('prem\'s algorithm'.toLowerCase());
  });

  // Test: Verify entry action 'renderPage()' from FSM - ensure it's not defined and calling it produces a ReferenceError
  test('Entry action renderPage() should not exist on the page and calling it throws a ReferenceError', async ({ page }) => {
    // Check if renderPage is defined on the window
    const isDefined = await page.evaluate(() => typeof window.renderPage !== 'undefined' && typeof renderPage === 'function');
    expect(isDefined).toBeFalsy();

    // Attempt to call renderPage in the page context and capture the thrown error string.
    const callResult = await page.evaluate(() => {
      try {
        // Intentionally call the missing function to let the ReferenceError happen naturally.
        // This is allowed by the test instructions.
        renderPage();
        return { ok: true };
      } catch (e) {
        // Return the error as a string so assertions can be made on it in the test context.
        return { ok: false, error: (e && e.toString()) || String(e) };
      }
    });

    // Ensure the call failed and produced a ReferenceError-like message.
    expect(callResult.ok).toBe(false);
    expect(callResult.error).toMatch(/ReferenceError|is not defined|not defined/i);
  });

  // Test: The page script contains an illegal 'return' at top-level -> expect a SyntaxError / Illegal return statement to be reported
  test('Script produces a syntax/runtime error (illegal return statement) which should be observed by the page', async () => {
    // At least one page error should have been captured during navigation or previous evaluated calls.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // The error text should indicate the illegal return or a syntax-related issue.
    const joined = pageErrors.join(' | ');
    expect(joined).toMatch(/return|illegal return|syntaxerror/i);
  });

  // Test: Because the script likely failed to execute, elements created by the script (e.g., #result) should not exist
  test('No #result element was created by the script (document.getElementById("result") is null)', async ({ page }) => {
    // Direct DOM check for the element's presence
    const resultHandle = await page.$('#result');
    expect(resultHandle).toBeNull();

    // Accessing via document.getElementById inside the page should return null as well.
    const resultNull = await page.evaluate(() => document.getElementById('result') === null);
    expect(resultNull).toBe(true);

    // Attempting to use $eval to read it should reject (no element to evaluate on).
    await expect(page.$eval('#result', el => el.innerHTML)).rejects.toThrow();
  });

  // Test: Interactive elements (buttons, inputs, selects, textareas) should not be present per FSM extraction summary
  test('There are no interactive controls (buttons, inputs, selects, textareas) as FSM indicates no events/transitions', async ({ page }) => {
    const interactiveCount = await page.evaluate(() =>
      document.querySelectorAll('button, input, select, textarea, [role="button"]').length
    );
    expect(interactiveCount).toBe(0);
  });

  // Test: Variables defined in the script should not be available on window (script likely didn't run due to syntax error)
  test('Script variables (num, prevNum, pairs, result) are not defined on window due to script failure', async ({ page }) => {
    const vars = await page.evaluate(() => {
      return {
        num: typeof window.num,
        prevNum: typeof window.prevNum,
        pairs: typeof window.pairs,
        result: typeof window.result
      };
    });

    // Expect all to be 'undefined' because the top-level script likely failed to run.
    expect(vars.num).toBe('undefined');
    expect(vars.prevNum).toBe('undefined');
    expect(vars.pairs).toBe('undefined');
    expect(vars.result).toBe('undefined');
  });

  // Test: Observed console messages should be collected; include them in a non-failing assertion to document behavior
  test('Collect and assert presence of console/page errors for diagnostic purposes', async () => {
    // At least one console message or page error should have been recorded.
    const anyMessages = consoleMessages.length > 0 || pageErrors.length > 0;
    expect(anyMessages).toBe(true);

    // If there are console messages, ensure they are strings and non-empty
    for (const m of consoleMessages) {
      expect(typeof m).toBe('string');
      expect(m.length).toBeGreaterThanOrEqual(0);
    }

    // For page errors, assert they provide some textual information
    for (const e of pageErrors) {
      expect(typeof e).toBe('string');
      expect(e.length).toBeGreaterThan(0);
    }
  });

  // Edge-case test: Re-assert that there are no FSM transitions/events to interact with on the page
  test('FSM has no interactive transitions/events reflected in the page DOM (sanity check)', async ({ page }) => {
    // Since FSM described no transitions/events, ensure no clickable anchors or elements with onclick attributes exist.
    const clickableCount = await page.evaluate(() =>
      document.querySelectorAll('a[href], [onclick], button, [role="button"]').length
    );
    expect(clickableCount).toBe(0);
  });
});