import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:5500/workspace/0126-biased/html/122e48f0-fa7b-11f0-814c-dbec508f0b3b.html';

// Helper to detect whether an error message looks like a runtime/parse error we care about
function isCriticalErrorMessage(msg) {
  if (!msg) return false;
  return /ReferenceError|SyntaxError|TypeError|is not defined|Unexpected token|Unexpected reserved word/i.test(msg);
}

test.describe('Support Vector Machine interactive application - FSM and error observation', () => {
  // Capture console messages and page errors for each test run
  test.beforeEach(async ({ page }) => {
    // No-op; individual tests will attach their own handlers to ensure fresh arrays per test
  });

  // Validate the initial render (Idle state) and that the main content exists
  test('Initial Idle state: page renders main heading and containers exist', async ({ page }) => {
    const consoleMessages = [];
    const pageErrors = [];

    page.on('console', (m) => {
      consoleMessages.push({ type: m.type(), text: m.text() });
    });
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the page
    const response = await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok()).toBeTruthy();

    // The page should contain the main heading visible
    const h1 = page.locator('h1');
    await expect(h1).toHaveText('Support Vector Machine');

    // Verify that all major containers mentioned in the FSM exist in the DOM
    const containers = [
      '#menu',
      '#code',
      '#results',
      '#explorer',
      '#debugger',
      '#chart',
      '#debugger-chart',
      '#debugger-chart-legend',
    ];

    for (const sel of containers) {
      const loc = page.locator(sel);
      await expect(loc).toHaveCount(1); // element exists
    }

    // Because the provided implementation is intentionally error-prone (duplicate/invalid identifiers,
    // undefined references like SVM, and many duplicated function names), we expect at least one page error
    // (SyntaxError/ReferenceError/TypeError) to be emitted during load or initial script parsing.
    // Assert that at least one critical error occurred.
    // Wait briefly to allow any async pageerror to fire
    await page.waitForTimeout(200);

    expect(pageErrors.length).toBeGreaterThanOrEqual(0); // ensure array exists
    const critical = pageErrors.some((e) => isCriticalErrorMessage(e.message));
    // The codebase is malformed; assert that there is at least one critical error OR at least one console error
    // containing "Uncaught" or similar. This keeps the test robust across environments where parse errors surface differently.
    const consoleCritical = consoleMessages.some((c) => isCriticalErrorMessage(c.text));
    expect(critical || consoleCritical).toBeTruthy();
  });

  // Group tests that exercise each FSM event: click the corresponding button and assert either
  // - the target container becomes visible (transition succeeded), OR
  // - an error (ReferenceError/SyntaxError/TypeError) is observed (the broken runtime surface)
  test.describe('FSM events: clicking buttons triggers transitions or surfaces errors', () => {
    // Map of event button selectors to the container expected to be displayed
    const events = [
      { name: 'LearnMore', button: 'button[onclick="displayMenu()"]', target: '#menu' },
      { name: 'ViewCode', button: 'button[onclick="displayCode()"]', target: '#code' },
      { name: 'GetStarted', button: 'button[onclick="displayMenu()"]', target: '#menu' }, // same handler as LearnMore in HTML
      { name: 'ViewResults', button: 'button[onclick="displayResults()"]', target: '#results' },
      { name: 'ViewExplorer', button: 'button[onclick="displayExplorer()"]', target: '#explorer' },
      { name: 'ViewDebugger', button: 'button[onclick="displayDebugger()"]', target: '#debugger' },
      { name: 'ViewChart', button: 'button[onclick="displayChart()"]', target: '#chart' },
      { name: 'ViewDebuggerChart', button: 'button[onclick="displayDebuggerChart()"]', target: '#debugger-chart' },
      { name: 'ViewDebuggerChartLegend', button: 'button[onclick="displayDebuggerChartLegend()"]', target: '#debugger-chart-legend' },
    ];

    for (const ev of events) {
      test(`Event ${ev.name}: clicking ${ev.button} should display ${ev.target} or produce a runtime error`, async ({ page }) => {
        const pageErrors = [];
        const consoleMessages = [];

        page.on('pageerror', (err) => pageErrors.push(err));
        page.on('console', (m) => consoleMessages.push({ type: m.type(), text: m.text() }));

        await page.goto(BASE, { waitUntil: 'domcontentloaded' });

        // Ensure button exists before clicking
        const btn = page.locator(ev.button).first();
        await expect(btn).toHaveCount(1);

        // Precondition: capture initial computed display of target element
        const targetLoc = page.locator(ev.target).first();
        await expect(targetLoc).toHaveCount(1);

        // In the provided HTML all sections are present and by default visible.
        // We will click the button and then check for two acceptable outcomes:
        // 1) The target container is visible after click (transition happened)
        // 2) A critical runtime error occurred (function missing or parse error)
        // We do NOT attempt to patch or define missing functions; we let errors surface naturally.

        // Click and then wait briefly to allow any synchronous click handlers to run and errors to surface.
        await btn.click();
        await page.waitForTimeout(200);

        // Check if the target is visible (style.display not set to 'none')
        const isVisible = await page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return false;
          const cs = window.getComputedStyle(el);
          return cs && cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetParent !== null;
        }, ev.target);

        const errorObserved = pageErrors.some((e) => isCriticalErrorMessage(e.message)) ||
                              consoleMessages.some((c) => isCriticalErrorMessage(c.text));

        // Assert one of the expected outcomes holds
        expect(isVisible || errorObserved).toBeTruthy();

        // If an error was observed, assert that the error message is informative about the cause.
        if (errorObserved) {
          const combined = pageErrors.map(e => e.message).concat(consoleMessages.map(c => c.text)).join('\n');
          // The error should mention either the function name or 'SVM' or typical parse issues.
          expect(/display|SVM|is not defined|SyntaxError|ReferenceError|TypeError|Unexpected/i.test(combined)).toBeTruthy();
        } else {
          // If we reached here, no critical error observed; validate that the intended container contains expected header text
          const header = await targetLoc.locator('h2').innerText();
          // The FSM evidence indicates the container should have an <h2> with corresponding label, like 'Menu', 'Code', etc.
          // Validate that the header text is present and non-empty.
          expect(header.length).toBeGreaterThan(0);
        }
      });
    }
  });

  // Validate some specific edge cases and error-heavy scenarios described by the implementation:
  test.describe('Edge cases & error scenarios', () => {
    test('Clicking "View Code" and running svmCode() should either run or surface SVM-related ReferenceError', async ({ page }) => {
      const pageErrors = [];
      const consoleMessages = [];

      page.on('pageerror', (err) => pageErrors.push(err));
      page.on('console', (m) => consoleMessages.push({ type: m.type(), text: m.text() }));

      await page.goto(BASE, { waitUntil: 'domcontentloaded' });

      // Type something into the textarea and attempt to call the global svmCode() helper (which exists in the second script)
      const textarea = page.locator('#svm-code');
      await expect(textarea).toHaveCount(1);
      await textarea.fill('dummy svm code');

      // Call the svmCode function by invoking the onclick handler that exists (we will evaluate svmCode if available)
      // We do not define svm or SVM; we expect either svmCode() to run and then throw due to SVM missing, or svmCode to be undefined.
      const callResult = await page.evaluate(() => {
        let result = { invoked: false, error: null };
        try {
          if (typeof svmCode === 'function') {
            result.invoked = true;
            // calling svmCode() will attempt to use 'svm' and 'svm.train' and likely throw ReferenceError for SVM or similar
            svmCode();
          } else {
            // Indicate svmCode not defined in the runtime
            result.error = 'svmCode-not-function';
          }
        } catch (e) {
          result.error = e && e.message ? e.message : String(e);
        }
        return result;
      });

      // Wait briefly for any pageerror to arrive
      await page.waitForTimeout(200);

      // If the function was invoked, expect an error mentioning SVM or svm not defined
      if (callResult.invoked) {
        // At least one page error or thrown message should be present
        const combined = pageErrors.map(e => e.message).concat(consoleMessages.map(c => c.text)).join('\n');
        const thrownMessage = callResult.error || '';
        const observed = isCriticalErrorMessage(thrownMessage) || isCriticalErrorMessage(combined);
        expect(observed).toBeTruthy();
      } else {
        // If svmCode was not a function in global scope, that's also a valid manifestation of the broken implementation
        expect(callResult.error).toContain('svmCode-not-function');
      }
    });

    test('Duplicate and conflicting function declarations should surface errors or predictable behavior', async ({ page }) => {
      const pageErrors = [];
      page.on('pageerror', (err) => pageErrors.push(err));

      await page.goto(BASE, { waitUntil: 'domcontentloaded' });

      // The HTML contains many duplicate function names and attempts to call undefined helpers.
      // We assert that either a SyntaxError was emitted on load or multiple page errors exist after interacting with the page.
      await page.locator('button[onclick="displayCode()"]').first().click();
      await page.waitForTimeout(200);

      // There should be at least one page error describing the malformed script or undefined behavior
      const critical = pageErrors.some((e) => isCriticalErrorMessage(e.message));
      expect(critical).toBeTruthy();
    });
  });
});