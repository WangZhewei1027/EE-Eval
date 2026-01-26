import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d2e2460-fa7a-11f0-ba5b-57721b046e74.html';

test.describe('Tim Sort Interactive Demo (6d2e2460-fa7a-11f0-ba5b-57721b046e74) - FSM and runtime validation', () => {
  // Arrays to capture runtime issues per test
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    // Reset capture arrays before each test and attach listeners before navigation
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      try {
        // pageerror may be an Error object; store its message for assertions
        pageErrors.push(err && err.message ? err.message : String(err));
      } catch (e) {
        pageErrors.push(String(err));
      }
    });

    page.on('console', (msg) => {
      // capture only error-level console messages (script parse/runtime errors often surface here)
      if (msg.type() === 'error' || msg.type() === 'warning') {
        consoleErrors.push(msg.text());
      }
    });

    // Navigate to the application page and wait for load
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test('Initial DOM elements are present and initial state is "Initial"', async ({ page }) => {
    // Validate presence of key UI elements described in FSM/components
    await expect(page.locator('#arraySize')).toHaveCount(1);
    await expect(page.locator('#initialOrder')).toHaveCount(1);
    await expect(page.locator('#minRunSize')).toHaveCount(1);
    await expect(page.locator('#generateArray')).toHaveCount(1);
    await expect(page.locator('#stepForward')).toHaveCount(1);
    await expect(page.locator('#runToEnd')).toHaveCount(1);
    await expect(page.locator('#reset')).toHaveCount(1);
    await expect(page.locator('#speed')).toHaveCount(1);

    // The static HTML includes Current State: Initial by markup; verify it
    const currentState = await page.locator('#currentState').textContent();
    expect(currentState).toBe('Initial');

    // Array container and log exist
    await expect(page.locator('#arrayContainer')).toBeVisible();
    await expect(page.locator('#log')).toBeVisible();

    // Because the page's script has issues (see other tests), we only assert static markup here
  });

  test('Page script fails to parse/execute resulting in pageerrors and console errors (syntax/runtime)', async ({ page }) => {
    // The application script intentionally contains a buggy log() implementation.
    // We expect a syntax/runtime error to be emitted during page load or execution.
    // Assert that at least one pageerror or console error was captured.

    // Allow some time for any pending script error events to surface
    await page.waitForTimeout(200);

    // There should be page errors or console errors (script parse/runtime issues)
    const hadPageErrors = pageErrors.length > 0;
    const hadConsoleErrors = consoleErrors.length > 0;

    expect(hadPageErrors || hadConsoleErrors).toBeTruthy();

    // If a page error exists, ensure it looks like a syntax/parse/runtime error
    if (hadPageErrors) {
      const joined = pageErrors.join(' | ');
      // Error messages vary across engines; check for common tokens
      expect(joined).toMatch(/Unexpected|Syntax|Reference|Type|Uncaught/i);
    }

    // If a console error exists, check it includes indicative tokens
    if (hadConsoleErrors) {
      const joinedConsole = consoleErrors.join(' | ');
      expect(joinedConsole).toMatch(/Unexpected|Syntax|Reference|Type|Uncaught|message>/i);
    }
  });

  test('Event handler functions are not available on window when script failed - trying to call them yields ReferenceError', async ({ page }) => {
    // We attempt to detect whether the key functions were defined.
    // If the script failed during parsing, these functions should be undefined.

    const genType = await page.evaluate(() => typeof window.generateArray);
    const stepType = await page.evaluate(() => typeof window.stepForward);
    const runType = await page.evaluate(() => typeof window.runToEnd);
    const resetType = await page.evaluate(() => typeof window.reset);

    // At least some of these are expected to be "undefined" if script failed to parse.
    // We assert that none of them are functioning functions.
    expect(['function']).not.toContain(genType);
    expect(['function']).not.toContain(stepType);
    expect(['function']).not.toContain(runType);
    expect(['function']).not.toContain(resetType);

    // Also, attempting to invoke them inside a safe try/catch should produce an error message
    const generateCallResult = await page.evaluate(() => {
      try {
        // try to call (will throw if not defined)
        // Use indirect call to avoid Playwright throwing if function is undefined
        if (typeof generateArray === 'function') {
          generateArray();
          return 'called';
        } else {
          // Attempt to reference generates a ReferenceError in non-strict eval when unbound;
          // but we use a thrown custom message to capture the undefined state.
          throw new Error('generateArray not defined');
        }
      } catch (e) {
        return e && e.message ? e.message : String(e);
      }
    });

    expect(generateCallResult).toMatch(/not defined|ReferenceError|generateArray/i);
  });

  test('Input controls can be changed but their update handlers are not active due to broken script', async ({ page }) => {
    // This validates the UpdateArraySize, UpdateMinRunSize, and UpdateSpeed events described in FSM.
    // Because the page script likely failed to attach handlers, updating the inputs will not change the corresponding display spans.

    // Capture initial display texts
    const initialArraySizeValue = await page.locator('#arraySizeValue').textContent();
    const initialMinRunValue = await page.locator('#minRunSizeValue').textContent();
    const initialSpeedValue = await page.locator('#speedValue').textContent();

    // Programmatically change the inputs and dispatch input events
    await page.evaluate(() => {
      const arraySize = document.getElementById('arraySize');
      const minRun = document.getElementById('minRunSize');
      const speed = document.getElementById('speed');

      // Set new values
      arraySize.value = '50';
      minRun.value = '8';
      speed.value = '1200';

      // Dispatch input events
      arraySize.dispatchEvent(new Event('input', { bubbles: true }));
      minRun.dispatchEvent(new Event('input', { bubbles: true }));
      speed.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Wait briefly for any handlers (if present) to run
    await page.waitForTimeout(100);

    // Because handlers likely didn't attach due to script error, displayed spans should remain their initial values.
    const afterArraySizeValue = await page.locator('#arraySizeValue').textContent();
    const afterMinRunValue = await page.locator('#minRunSizeValue').textContent();
    const afterSpeedValue = await page.locator('#speedValue').textContent();

    // If the page script had run correctly these would have updated; we assert they did not (given the broken script)
    expect(afterArraySizeValue).toBe(initialArraySizeValue);
    expect(afterMinRunValue).toBe(initialMinRunValue);
    expect(afterSpeedValue).toBe(initialSpeedValue);
  });

  test('Generate / Step / Run / Reset buttons do not produce FSM transitions when script did not initialize - current state stays "Initial"', async ({ page }) => {
    // The FSM transitions rely on script initialization. If parsing failed, clicking these buttons is a no-op.
    const currentStateLocator = page.locator('#currentState');

    // Ensure we start at "Initial"
    await expect(currentStateLocator).toHaveText('Initial');

    // Try clicking the primary control buttons
    await page.locator('#generateArray').click();
    await page.waitForTimeout(50);
    await expect(currentStateLocator).toHaveText('Initial');

    await page.locator('#stepForward').click();
    await page.waitForTimeout(50);
    await expect(currentStateLocator).toHaveText('Initial');

    await page.locator('#runToEnd').click();
    await page.waitForTimeout(50);
    await expect(currentStateLocator).toHaveText('Initial');

    await page.locator('#reset').click();
    await page.waitForTimeout(50);
    await expect(currentStateLocator).toHaveText('Initial');

    // Also verify that no new log messages were appended (log container is empty by markup initially)
    const logText = await page.locator('#log').textContent();
    // If the script never executed, log stays empty string
    expect(logText.trim() === '' || logText === null).toBeTruthy();
  });

  test('Edge case: repeated navigation still surfaces the same script error (idempotence of failure)', async ({ page }) => {
    // Reload the page and ensure the same category of error occurs again (syntax/runtime)
    // This validates consistent failure behavior (important for robust test expectations)
    pageErrors = [];
    consoleErrors = [];

    await page.reload({ waitUntil: 'load' });
    // give time for page errors to surface
    await page.waitForTimeout(200);

    const hadPageErrors = pageErrors.length > 0;
    const hadConsoleErrors = consoleErrors.length > 0;

    // Expect at least one error on reload as well
    expect(hadPageErrors || hadConsoleErrors).toBeTruthy();

    // If present, check contents are similar (contain 'Unexpected' or 'Syntax' etc)
    if (hadPageErrors) {
      expect(pageErrors.join(' | ')).toMatch(/Unexpected|Syntax|Reference|Type|Uncaught/i);
    }
    if (hadConsoleErrors) {
      expect(consoleErrors.join(' | ')).toMatch(/Unexpected|Syntax|Reference|Type|Uncaught|message>/i);
    }
  });

  // This final test documents the intended FSM transitions vs observed behavior.
  test('Documentation: FSM states exist in DOM and would be updated by script if it ran - verify placeholders exist', async ({ page }) => {
    // The FSM lists states: Initial, Finding Runs, Merging Runs, Checking Next Run, Merging Stack, Completed.
    // The page contains an element showing the current state; script would set these values.
    // We assert that the element exists and that, while script is broken, the initial placeholder is present.

    const currentStateLocator = page.locator('#currentState');
    await expect(currentStateLocator).toBeVisible();

    // Document the possible expected state strings from the FSM (not asserting they appear in sequence,
    // only that these values would be used by the app; presence in DOM is sufficient as placeholder).
    const possibleStates = [
      'Initial',
      'Finding Runs',
      'Merging Runs',
      'Checking Next Run',
      'Merging Stack',
      'Completed'
    ];

    // Verify that the currentState element's text is one of the expected states (should be 'Initial' right now)
    const text = (await currentStateLocator.textContent()).trim();
    expect(possibleStates).toContain(text);

    // Also verify that other stat placeholders exist (Current Step, Runs Identified, Merges Performed, Comparisons)
    await expect(page.locator('#currentStep')).toBeVisible();
    await expect(page.locator('#runsCount')).toBeVisible();
    await expect(page.locator('#mergesCount')).toBeVisible();
    await expect(page.locator('#comparisonsCount')).toBeVisible();
  });
});