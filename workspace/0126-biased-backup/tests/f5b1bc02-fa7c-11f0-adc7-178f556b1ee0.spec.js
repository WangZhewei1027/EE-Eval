import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b1bc02-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Sliding Window Explanation - f5b1bc02-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  // Setup before each test: open the page and attach listeners to capture runtime errors and console output.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // In case reading console message fails, capture a fallback
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app after attaching listeners so we don't miss errors during load.
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // teardown: just clear arrays (Playwright handles page/context disposal)
    consoleMessages = [];
    pageErrors = [];
  });

  test('Initial load: Idle state rendered and demonstration button is present (S0_Idle)', async ({ page }) => {
    // This test validates:
    // - The page loads and renders the Idle state UI (heading and demonstration button).
    // - We expect the runtime environment to produce a ReferenceError because the implementation
    //   references slidingWindow which is not defined in the executable JS on the page.
    // - Capture and assert that such an error is present in pageErrors.

    // Check that the main heading is present (basic UI sanity check)
    await expect(page.locator('h1')).toHaveText(/Sliding Window Explanation/);

    // The FSM evidence expects a button with id #demonstration-button in Idle state
    const demoButton = page.locator('#demonstration-button');
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveText('Demonstrate Sliding Window');

    // Assert that a runtime error occurred during load due to missing slidingWindow function.
    // The application script executes `const result = slidingWindow(...);` but slidingWindow
    // is only shown inside a <pre><code> block (not executed), so we expect a ReferenceError.
    expect(pageErrors.length).toBeGreaterThan(0);
    // At least one of the errors should mention 'slidingWindow' (name of the missing function)
    const hasSlidingWindowRefError = pageErrors.some(err => {
      try {
        return String(err.message).includes('slidingWindow') || String(err).includes('slidingWindow');
      } catch {
        return false;
      }
    });
    expect(hasSlidingWindowRefError).toBeTruthy();
  });

  test('Clicking Demonstrate Sliding Window attempts transition to Demonstrating state (S1_Demonstrating) and runtime error occurs', async ({ page }) => {
    // This test validates:
    // - The click event described in the FSM (DemonstrateClick) is triggered by user interaction.
    // - Because the slidingWindow function is not defined/executable in the runtime, we assert that
    //   invoking the demonstration either results in a ReferenceError or yields no console result output.
    // - We do NOT patch or inject slidingWindow; we let errors happen naturally and assert their presence.

    // Ensure the button exists before trying to click
    const demoButton = page.locator('#demonstration-button');
    await expect(demoButton).toBeVisible();

    // Record current counts of console and errors before the click so we can detect new events caused by the click
    const initialConsoleCount = consoleMessages.length;
    const initialErrorCount = pageErrors.length;

    // Perform the user action described by the FSM
    await demoButton.click();

    // Give a short time window for any synchronous handlers to run and for events to be emitted.
    await page.waitForTimeout(500);

    // Check if a new page error was produced by clicking the button.
    const newErrors = pageErrors.slice(initialErrorCount);
    const newConsoleMessages = consoleMessages.slice(initialConsoleCount);

    // There are two realistic outcomes given the broken implementation:
    // 1) The initial error prevented attaching the click handler, so clicking does nothing -> no new errors, no result logs.
    // 2) The click handler was attached and runs but calling slidingWindow throws ReferenceError -> new error observed.
    //
    // Both scenarios are acceptable for this test as long as we observe that the missing slidingWindow problem exists.
    const clickProducedRefError = newErrors.some(err => {
      try {
        return String(err.message).includes('slidingWindow') || String(err).includes('slidingWindow');
      } catch {
        return false;
      }
    });

    // Assert that either (a) a new ReferenceError mentioning slidingWindow occurred on click,
    // or (b) there is still an absence of a successful result in the console (i.e., no array/object result printed).
    if (clickProducedRefError) {
      // Expected: clicking produced a ReferenceError due to calling slidingWindow
      expect(clickProducedRefError).toBeTruthy();
    } else {
      // If no new ReferenceError on click, then ensure we did not log a successful result (an array/object)
      const printedResultLike = newConsoleMessages.some(msg => {
        const t = msg.text || '';
        // The intended code would console.log an array of result objects; check for '[' or 'filtered' or 'max' as hints of that output
        return t.includes('[') || t.includes('filtered') || t.includes('max') || /\{.*filtered.*\}/.test(t);
      });
      // We expect that no valid demonstration result was printed because slidingWindow is not defined.
      expect(printedResultLike).toBeFalsy();
    }
  });

  test('Example code visibility and evidence of missing executable definition', async ({ page }) => {
    // This test validates:
    // - The example code snippet explaining slidingWindow is present on the page (user-visible educational artifact).
    // - The code block contains the textual definition "function slidingWindow", indicating that the function is shown
    //   as an example but not actually present in the executing JS context (which leads to ReferenceError).
    const codeBlock = page.locator('pre code');
    await expect(codeBlock).toBeVisible();
    await expect(codeBlock).toContainText('function slidingWindow');

    // Confirm that despite the example being present in the DOM, the runtime did not define slidingWindow,
    // evidenced by the earlier captured page errors referencing slidingWindow.
    const hasSlidingWindowRefError = pageErrors.some(err => {
      try {
        return String(err.message).includes('slidingWindow') || String(err).includes('slidingWindow');
      } catch {
        return false;
      }
    });
    expect(hasSlidingWindowRefError).toBeTruthy();
  });

  test('Robustness check: no accidental successful demonstration output produced', async ({ page }) => {
    // This edge-case test ensures that at no point did the page successfully execute the demonstration and print
    // the expected result array/object. Given the intentional/accidental omission of slidingWindow as an executable
    // function, we assert that no console message containing typical result signatures was produced.
    //
    // Typical printed result would be an array representation or object with keys like "filtered", "sorted", "max".
    const seenResultSignature = consoleMessages.some(msg => {
      const t = msg.text || '';
      return t.includes('filtered') || t.includes('sorted') || t.includes('max') || t.trim().startsWith('[');
    });

    // The correct behavior for this broken implementation is to NOT produce a valid demonstration output.
    expect(seenResultSignature).toBeFalsy();

    // Additionally, we assert that we have observed at least one runtime error (the missing slidingWindow).
    expect(pageErrors.length).toBeGreaterThan(0);
  });
});