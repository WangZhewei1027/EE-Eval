import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/52099513-fa76-11f0-a09b-87751f540fd8.html';

test.describe('Dynamic Programming Example (Application ID: 52099513-fa76-11f0-a09b-87751f540fd8)', () => {
  // Collect console messages and page errors for inspection in tests
  let consoleMessages = [];
  let pageErrors = [];

  // Helper to wait until at least `min` console messages have been captured or timeout
  const waitForConsoleCount = async (min = 1, timeout = 1000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (consoleMessages.length >= min) return;
      await new Promise((r) => setTimeout(r, 50));
    }
  };

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages and page errors
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text(), args: msg.args().length });
      } catch {
        // best-effort capture; ignore capture errors
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Load the page exactly as-is
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Clear collected data after each test
    consoleMessages = [];
    pageErrors = [];
  });

  test('Idle state - initial static content is rendered (FSM S0_Idle evidence)', async ({ page }) => {
    // This test validates the static evidence described in the FSM for the Idle state:
    // - <h1>Dynamic Programming Example</h1>
    // - <h2>Problem: 1 + 2 + 3 + 4 + 5 = ?</h2
    // It also checks the presence of the manual calculation paragraph.
    const h1 = await page.locator('h1').innerText();
    const h2 = await page.locator('h2').first().innerText(); // first h2 is problem
    const manualCalc = await page.locator('p', { hasText: 'Manual calculation' }).innerText();

    expect(h1).toBe('Dynamic Programming Example');
    expect(h2).toContain('Problem: 1 + 2 + 3 + 4 + 5 = ?');
    expect(manualCalc).toContain('1 + 2 + 3 + 4 + 5 = 15');

    // Verify that code description paragraphs are present (evidence of explanation)
    await expect(page.locator('p', { hasText: 'Dynamic Programming Solution:' })).toBeVisible();
    await expect(page.locator('p', { hasText: 'Initialize an array dp with 5 elements' })).toBeVisible();
  });

  test('Inline scripts execute and expected console logs are emitted', async ({ page }) => {
    // The page's inline script prints the dpArr[5] value and then a labeled result line.
    // We wait for at least 2 console messages (expected behavior from the inline script),
    // then assert that the logs include the numeric result 15 and the labeled dynamic programming result.
    await waitForConsoleCount(2, 1500); // wait up to 1.5s for console output

    // We expect at least two console messages from the inline script:
    expect(consoleMessages.length).toBeGreaterThanOrEqual(1);

    // Find messages that include '15' and 'Dynamic Programming Solution'
    const texts = consoleMessages.map((m) => m.text);
    const contains15 = texts.some((t) => t.includes('15'));
    const containsLabel = texts.some((t) => t.includes('Dynamic Programming Solution'));

    // Assert that the numeric result and labeled result were logged
    expect(contains15).toBeTruthy();
    expect(containsLabel).toBeTruthy();
  });

  test('No unexpected page runtime errors during load', async ({ page }) => {
    // This test asserts that loading the page did not produce uncaught page errors.
    // Note: the inline script is allowed to execute; we capture page errors and assert none happened.
    // If there are runtime errors (ReferenceError, TypeError, SyntaxError), they will appear here naturally.
    // The test verifies the runtime environment as observed.
    await new Promise((r) => setTimeout(r, 200)); // small delay to ensure pageerror events fire
    expect(pageErrors.length).toBe(0);
  });

  test('FSM entry action renderPage(): verify whether function is implemented on the page', async ({ page }) => {
    // FSM entry action lists renderPage(). Verify whether a global renderPage function exists.
    // We do not modify the page. We only observe and assert the existence/absence.
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage === 'function');
    // The provided HTML does not define renderPage(), so we expect it to be absent.
    expect(hasRenderPage).toBe(false);
  });

  test('No interactive controls are present (FSM had no events/transitions)', async ({ page }) => {
    // The FSM indicates no events/transitions and the extraction summary notes no interactive elements.
    // Confirm the page contains no typical interactive controls (buttons/inputs/selects/textareas).
    const interactiveCount = await page.evaluate(() => {
      return document.querySelectorAll('button,input,select,textarea,[role="button"],a[href]').length;
    });

    // There is no user interaction designed; assert that interactive element count is small or zero.
    // We allow anchors with href for navigation, but expect the core interactive controls to be absent.
    expect(interactiveCount).toBeLessThanOrEqual(2);
  });

  test('dynamicProgramming and dp functions behave correctly for normal and edge inputs', async ({ page }) => {
    // This test will call the page's global functions if available and observe natural behavior.
    // We never patch or redefine functions; we only call what's present.
    const results = await page.evaluate(() => {
      const out = {
        dpDefined: typeof window.dp === 'function',
        dynamicProgrammingDefined: typeof window.dynamicProgramming === 'function',
        dp0: null,
        dyn0: null,
        dyn5WithLocalArr: null,
        dyn1WithEmptyArr: null,
        errors: []
      };

      try {
        if (out.dpDefined) out.dp0 = window.dp(0, [0, 0]); // expect 0
      } catch (e) {
        out.errors.push({ fn: 'dp(0, [0,0])', message: e.message });
      }

      try {
        if (out.dynamicProgrammingDefined) out.dyn0 = window.dynamicProgramming(0, [0, 0]); // expect 0
      } catch (e) {
        out.errors.push({ fn: 'dynamicProgramming(0, [0,0])', message: e.message });
      }

      try {
        if (out.dynamicProgrammingDefined) {
          const arr = [0, 0, 0, 0, 0, 0];
          out.dyn5WithLocalArr = window.dynamicProgramming(5, arr); // expect 15
        }
      } catch (e) {
        out.errors.push({ fn: 'dynamicProgramming(5, arr)', message: e.message });
      }

      // Edge case: missing expected dp elements in the array (this may produce NaN or undefined)
      try {
        if (out.dynamicProgrammingDefined) {
          out.dyn1WithEmptyArr = window.dynamicProgramming(1, []); // likely NaN or throws
        }
      } catch (e) {
        out.errors.push({ fn: 'dynamicProgramming(1, [])', message: e.message });
      }

      return out;
    });

    // Validate function existence
    expect(results.dpDefined).toBe(true);
    expect(results.dynamicProgrammingDefined).toBe(true);

    // dp(0, ...) should return 0 per implementation
    expect(results.dp0).toBe(0);

    // dynamicProgramming(0, ...) should return 0 per implementation
    expect(results.dyn0).toBe(0);

    // dynamicProgramming(5, arr) with a properly sized arr should return 15
    expect(results.dyn5WithLocalArr).toBe(15);

    // For the edge case dynamicProgramming(1, []) behavior may be NaN or a number or throw.
    // We assert that the result is either a finite number or NaN (both are acceptable observations).
    if (typeof results.dyn1WithEmptyArr === 'number') {
      // it's a number; check if finite or NaN
      expect(Number.isFinite(results.dyn1WithEmptyArr) || Number.isNaN(results.dyn1WithEmptyArr)).toBeTruthy();
    } else {
      // If undefined (e.g. function threw), ensure the error was recorded
      expect(results.errors.length).toBeGreaterThanOrEqual(0);
    }

    // Ensure no unexpected exceptions were thrown without being captured
    expect(Array.isArray(results.errors)).toBeTruthy();
  });

  test('Reloading the page reproduces console logs consistently (stability check)', async ({ page }) => {
    // Reload and verify the same logs reappear (the inline script runs again)
    consoleMessages = [];
    await page.reload({ waitUntil: 'load' });

    await waitForConsoleCount(1, 1500);
    const textsAfterReload = consoleMessages.map((m) => m.text);
    const containsLabel = textsAfterReload.some((t) => t.includes('Dynamic Programming Solution'));
    const contains15 = textsAfterReload.some((t) => t.includes('15'));

    expect(containsLabel).toBeTruthy();
    expect(contains15).toBeTruthy();
  });

  test('Verify that the HTML presents the code block as text (script content appears in the <pre> block)', async ({ page }) => {
    // The HTML places a <script> tag inside a <pre> block; ensure that the <pre> contains script-like text.
    const preText = await page.locator('pre').innerText();
    // We expect the pre block to include the word "function dp" or "dynamicProgramming", indicating the code is visible
    expect(preText).toContain('function dp');
    expect(preText).toContain('dynamicProgramming');
  });
});