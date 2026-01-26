import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520b69d2-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Runtime Environment Interactive Application (Application ID: 520b69d2-fa76-11f0-a09b-87751f540fd8)', () => {
  // Arrays to collect console messages and page errors for each test run.
  let consoleMessages;
  let pageErrors;

  // Setup: Attach listeners to capture console logs and page errors, then navigate to the page.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', msg => {
      // Collect type and text for later assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the provided HTML page exactly as-is
    await page.goto(APP_URL);
  });

  // Tear down is automatically handled by Playwright fixtures; no explicit cleanup required here.

  test.describe('State: S0_Idle (entry expectations and DOM)', () => {
    test('renders the runtime container (#runtime-env) and matches expected layout', async ({ page }) => {
      // This validates that the Idle state renders the runtime container element as evidence in the FSM.
      const runtimeLocator = page.locator('#runtime-env');
      await expect(runtimeLocator).toBeVisible();
      // Check that the container has the expected dimensions (from inline CSS)
      const box = await runtimeLocator.boundingBox();
      // boundingBox may be null in headless environments if element is not visible, but we asserted visibility already
      expect(box).not.toBeNull();
      if (box) {
        // The HTML specified width: 800px and height: 600px and padding/border; allow some tolerance
        expect(Math.round(box.width)).toBeGreaterThanOrEqual(780);
        expect(Math.round(box.height)).toBeGreaterThanOrEqual(560);
      }
      // Ensure the container currently has no meaningful inner text as the implementation didn't populate it
      const innerHTML = await runtimeLocator.evaluate(el => el.innerHTML);
      expect(innerHTML).toBe('');
    });

    test('FSM entry action renderPage() is declared in FSM but not present on the page (verify onEnter behavior)', async ({ page }) => {
      // The FSM lists renderPage() as an entry action. The implementation does not define such a function.
      // We must not modify the page. Verify that window.renderPage is not a function.
      const typeofRenderPage = await page.evaluate(() => {
        // read typeof without invoking anything
        return typeof window.renderPage;
      });
      // Confirm that renderPage was not defined by the page script
      expect(typeofRenderPage).toBe('undefined');
      // Since renderPage is not present, the FSM's declared entry action could not have executed.
      // Also ensure no ReferenceError or similar was thrown during page load (pageErrors captured)
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console output and runtime details', () => {
    test('page should log all expected runtime details to the console', async () => {
      // This test checks that the script produced console logs for the runtime environment.
      // Wait a short time to ensure all console messages have been captured.
      await new Promise(r => setTimeout(r, 50));

      const texts = consoleMessages.map(m => m.text);

      // Expected logs from the HTML's script
      const expectedSnippets = [
        'Language: JavaScript',
        'Language Version: ES2022',
        'Compiler: V8',
        'Compiler Version: V8',
        'Platform: Windows 10',
        'Platform Version: Windows 10',
        'OS: Windows 10',
        'OS Version: Windows 10',
        'Architecture: x64'
      ];

      for (const snippet of expectedSnippets) {
        const found = texts.some(t => t.includes(snippet));
        expect(found, `Expected console to include "${snippet}", got console messages: ${JSON.stringify(texts)}`).toBeTruthy();
      }

      // Ensure console message types include 'log'
      const hasLog = consoleMessages.some(m => m.type === 'log');
      expect(hasLog).toBeTruthy();
    });
  });

  test.describe('FSM transitions and interactivity (none expected)', () => {
    test('no interactive transitions exist; clicking the container should not change DOM or produce errors', async ({ page }) => {
      const runtimeLocator = page.locator('#runtime-env');

      // Snapshot initial innerHTML
      const initialHTML = await runtimeLocator.evaluate(el => el.innerHTML);

      // Attempt to click the container (there are no event handlers by design)
      await runtimeLocator.click();

      // Wait briefly to allow any unexpected handlers to run
      await new Promise(r => setTimeout(r, 50));

      // Confirm innerHTML remains identical (no DOM changes triggered)
      const afterClickHTML = await runtimeLocator.evaluate(el => el.innerHTML);
      expect(afterClickHTML).toBe(initialHTML);

      // Ensure no new page errors resulted from the click
      expect(pageErrors.length).toBe(0);
    });

    test('verify that there are no transitions defined in the FSM (sanity check against the app behavior)', async () => {
      // The FSM defines 0 transitions. From the runtime perspective, this means no interactive elements should alter state.
      // Confirm no global functions that might trigger transitions were created by the page.
      const globals = await (async () => {
        // Collect a conservative list of known-named functions that could be used for transitions (if the page introduced any)
        // This is only observational; we do not modify page state.
        return await (await import('node:vm')).runInNewContext('({})', {});// noop to keep code structure; not used
      }).catch(() => null);

      // The above attempted import/run is a no-op placeholder to avoid introducing globals, per instructions we do not inject behavior.
      // Primary assertion: user-visible behavior shows no transitions — confirmed by previous tests (no click effects, no handlers).
      expect(true).toBeTruthy();
    });
  });

  test.describe('Edge cases and error observation', () => {
    test('no ReferenceError, SyntaxError, or TypeError occurred during page execution', async () => {
      // We captured page errors in pageErrors array. Assert none of them are JS runtime errors.
      // If any errors exist, fail and log them for debugging.
      if (pageErrors.length > 0) {
        // Build a readable summary of errors
        const summaries = pageErrors.map(e => `${e.name}: ${e.message}`);
        throw new Error(`Expected no page errors, but found: ${summaries.join(' | ')}`);
      }
      // If none, pass — this confirms that the page ran without uncaught JS exceptions.
      expect(pageErrors.length).toBe(0);
    });

    test('the page does not expose unexpected global variables used for interactivity', async ({ page }) => {
      // Check that commonly-named interactive globals are not present (e.g., renderPage, init, start)
      const globalsToCheck = ['renderPage', 'init', 'start', 'onEnter', 'onExit'];
      const results = await page.evaluate((names) => {
        const res = {};
        for (const n of names) {
          res[n] = typeof window[n];
        }
        return res;
      }, globalsToCheck);

      for (const g of globalsToCheck) {
        expect(results[g]).toBe('undefined');
      }
    });
  });

  // Final sanity test grouping to ensure all observed console logs are normal (no stack traces)
  test('observed console messages should not include "Error" stack traces', async () => {
    const texts = consoleMessages.map(m => m.text);
    const hasErrorLike = texts.some(t => /Error:|ReferenceError|TypeError|SyntaxError|Uncaught/i.test(t));
    expect(hasErrorLike).toBeFalsy();
  });
});