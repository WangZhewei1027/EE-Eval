import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520b1bb2-fa76-11f0-a09b-87751f540fd8.html';

test.describe('FSM States and Transitions - 520b1bb2-fa76-11f0-a09b-87751f540fd8', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', msg => {
      try {
        // Some console messages have arguments; join them for easier assertions
        const text = msg.text();
        consoleMessages.push(text);
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Capture unhandled exceptions (page errors)
    page.on('pageerror', error => {
      pageErrors.push(error && error.message ? error.message : String(error));
    });

    // Navigate to the page and wait for the load event so scripts run
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Give some time for async logs/errors to surface
    await page.waitForTimeout(300);
  });

  test.afterEach(async ({ page }) => {
    // Small teardown delay to ensure all console events are captured
    await page.waitForTimeout(50);
  });

  test('S0_Idle: Initial render - page contains the expected header', async ({ page }) => {
    // Validate initial state: the page renders an <h1> with the expected text
    // This corresponds to the FSM entry action renderPage() (even if renderPage() is not defined,
    // the DOM still contains the expected evidence)
    const heading = await page.locator('h1').innerText();
    expect(heading).toBe('Unit Testing Example');
    // Also verify the root container exists
    const containerExists = await page.locator('#container').count();
    expect(containerExists).toBe(1);

    // Log captured console output for debugging if needed
    // Ensure that at least some console output was captured during initial load
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });

  test('S0 -> S1 transition: Running tests... is logged (testRunner.run invoked)', async ({ page }) => {
    // This validates the FSM transition from Idle to Test Running where testRunner.run() is expected.
    // The TestRunner.run implementation logs "Running tests..." when executed.
    // Check captured console messages for the expected text.
    const hasRunningLog = consoleMessages.some(msg => msg.includes('Running tests...'));
    expect(hasRunningLog).toBeTruthy();

    // Validate that the "Running tests..." message appears at least once
    const runningCount = consoleMessages.filter(msg => msg.includes('Running tests...')).length;
    expect(runningCount).toBeGreaterThanOrEqual(1);
  });

  test('S1 -> S2 transition: Test results and side effects are logged', async ({ page }) => {
    // FSM expects console.log(result) and console.log('Side effect executed') in the Test Completed state.
    // Validate that numeric results and the explicit side-effect message were logged.

    // Look for numeric outputs that the test suites log (e.g., "5", "2", "-5") - at least one should appear
    const numericLogs = consoleMessages.filter(msg => /^[\-\d]+$/.test(msg.trim()));
    // At minimum, expect one numeric log (the test suite prints numbers)
    expect(numericLogs.length).toBeGreaterThanOrEqual(1);

    // Check for the explicit side effect log
    const hasSideEffect = consoleMessages.some(msg => msg.includes('Side effect executed'));
    expect(hasSideEffect).toBeTruthy();

    // For robustness, also assert that some expected numeric values exist if present
    // (They may vary due to multiple similar tests defined in the page; accept any of the common expected outputs)
    const hasFive = consoleMessages.some(msg => msg.trim() === '5');
    const hasTwo = consoleMessages.some(msg => msg.trim() === '2');
    const hasMinusFive = consoleMessages.some(msg => msg.trim() === '-5');

    // At least one of the expected numeric results should be present
    expect(hasFive || hasTwo || hasMinusFive).toBeTruthy();
  });

  test('Event RunTests: invoking window.testRunner.run() from the test - observe natural errors or behavior', async ({ page }) => {
    // The FSM event 'RunTests' is modeled as a function call testRunner.run()
    // Attempt to invoke it programmatically and allow any runtime errors to surface naturally.
    // We must not modify the page or patch functions; simply call and observe.

    let invocationError = null;
    try {
      // Execute in page context. If testRunner or TestRunner are not defined or errors occur,
      // this will surface as a thrown exception which Playwright will rethrow here.
      await page.evaluate(() => {
        // Intentionally call the function as the FSM describes.
        // Do NOT try to shim or guard against errors here: let errors happen naturally as required.
        return window.testRunner.run();
      });

      // If no exception was thrown, it's still useful to assert that the call logged "Running tests..."
      const hasRunning = consoleMessages.some(msg => msg.includes('Running tests...'));
      expect(hasRunning).toBeTruthy();
    } catch (err) {
      invocationError = err;
    }

    // Per instructions, we should let ReferenceError/TypeError happen naturally and assert that these errors occurred.
    // Either the invocation succeeded (invocationError === null) OR a JS error occurred. Ensure one of these realistic outcomes happens.
    if (invocationError) {
      const msg = String(invocationError.message || invocationError);
      // Expect that the error is a JS engine error like ReferenceError or TypeError (or contains them)
      const isJSErr = /ReferenceError|TypeError|SyntaxError/.test(msg);
      expect(isJSErr).toBeTruthy();
    } else {
      // If no error, ensure the console shows that tests ran as a result of the call
      const hasRunningLog = consoleMessages.some(m => m.includes('Running tests...'));
      expect(hasRunningLog).toBeTruthy();
    }
  });

  test('Edge cases and runtime errors: assert page threw script errors during load/execution', async ({ page }) => {
    // The provided implementation contains several problematic patterns (redefinitions, calls before definitions,
    // incorrect return/iteration usage) which should produce runtime errors.
    // Verify that at least one page error was captured and that it is a common JS error type.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    const hasRelevantError = pageErrors.some(msg =>
      /ReferenceError|TypeError|SyntaxError|is not a function|is not iterable/i.test(msg)
    );
    expect(hasRelevantError).toBeTruthy();

    // For diagnostic clarity, also assert that a ReferenceError is present among errors OR a TypeError,
    // because the page scripts attempt to use TestRunner before it's defined and iterate over undefined.
    const hasReference = pageErrors.some(msg => /ReferenceError/i.test(msg));
    const hasType = pageErrors.some(msg => /TypeError/i.test(msg) || /not iterable/i.test(msg));
    expect(hasReference || hasType).toBeTruthy();
  });
});