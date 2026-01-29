import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/520a3150-fa76-11f0-a09b-87751f540fd8.html';

test.describe('CPU Scheduling Interactive Application (FSM states & transitions)', () => {
  // Arrays to collect runtime observations
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      try {
        // Prefer text representation for assertions
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // Collect uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(err.message || String(err));
    });

    // Load the page and wait for full load (scripts run on load)
    await page.goto(APP_URL, { waitUntil: 'load' });
    // Give a small moment to ensure all synchronous console logs have been emitted
    await page.waitForTimeout(50);
  });

  test.afterEach(async () => {
    // No teardown actions required beyond GC - collectors reset in beforeEach
  });

  test('Initial Idle state: page renders and initial DOM is present', async ({ page }) => {
    // This validates the S0_Idle state: entry action (renderPage) is expected by the FSM,
    // but the implementation does not define renderPage(). We still validate that the page rendered.
    // Check that the heading exists and has correct text
    const title = await page.locator('h1').innerText();
    expect(title).toBe('CPU Scheduling');

    // Check there is a .cpu container and three .process elements inside
    const processCount = await page.locator('.cpu .process').count();
    expect(processCount).toBe(3);

    // Verify that no unexpected fatal page errors occurred during initial render
    expect(pageErrors.length).toBe(0);

    // Confirm that the initial automatic scheduling and execution (calls in script) emitted console logs
    // We expect logs from scheduleProcesses and executeProcesses to be present
    // The script logs messages like: "Process Process 1 started at 0 seconds"
    const hasStartLog = consoleMessages.some(msg => /Process\s+Process\s+1\s+started at\s+0 seconds/.test(msg));
    expect(hasStartLog).toBeTruthy();

    // There should be at least one "finished at" message present from the automatic run
    const hasAnyFinished = consoleMessages.some(msg => /finished at \d+ seconds/.test(msg));
    expect(hasAnyFinished).toBeTruthy();
  });

  test('Processes Scheduled state (S1): scheduleProcesses called and produced expected logs', async ({ page }) => {
    // The scheduleProcesses function is called on load using processes (timeSpent initially 0).
    // Each scheduled process should finish at 0 seconds (since timeSpent is 0 initially).
    const finishedAtZero = consoleMessages.filter(msg => /finished at 0 seconds/.test(msg));
    // Expect at least three occurrences for three processes scheduled (guard for implementation variants)
    expect(finishedAtZero.length).toBeGreaterThanOrEqual(3);

    // Ensure scheduleProcesses-related logs exist for Process 1, 2, 3
    for (let i = 1; i <= 3; i++) {
      const re = new RegExp(`Process\\s+Process\\s+${i}\\s+started at\\s+0 seconds`);
      expect(consoleMessages.some(m => re.test(m))).toBeTruthy();
    }
  });

  test('Processes Executed state (S2): executeProcesses called and cumulative times are correct', async ({ page }) => {
    // The executeProcesses function is called on load with processesWithTime: [10,5,8]
    // Cumulative finished times should be 10, 15, 23 seconds.

    // Check for those specific finish logs
    expect(consoleMessages.some(m => /finished at 10 seconds/.test(m))).toBeTruthy();
    expect(consoleMessages.some(m => /finished at 15 seconds/.test(m))).toBeTruthy();
    expect(consoleMessages.some(m => /finished at 23 seconds/.test(m))).toBeTruthy();

    // Also ensure the started logs reference starting times as expected (0,10,15)
    expect(consoleMessages.some(m => /Process\s+Process\s+1\s+started at\s+0 seconds/.test(m))).toBeTruthy();
    expect(consoleMessages.some(m => /Process\s+Process\s+2\s+started at\s+10 seconds/.test(m))).toBeTruthy();
    expect(consoleMessages.some(m => /Process\s+Process\s+3\s+started at\s+15 seconds/.test(m))).toBeTruthy();
  });

  test('FSM entry action renderPage missing: calling renderPage() causes ReferenceError', async ({ page }) => {
    // FSM mentioned renderPage() on S0 entry, but the implementation doesn't define it.
    // We attempt to call it and assert that a ReferenceError occurs naturally in the page context.
    let evalError = null;
    try {
      // This will reject because renderPage is not defined in the page context
      await page.evaluate(() => {
        // Intentionally call the missing function to let ReferenceError occur naturally
        // Do not catch it here; allow it to propagate to the test.
        // Note: this is executing in browser context.
        return renderPage();
      });
    } catch (e) {
      evalError = e;
    }

    // The evaluation should have thrown
    expect(evalError).not.toBeNull();
    // The error message should indicate a ReferenceError or mention renderPage/not defined
    expect(String(evalError.message)).toMatch(/renderPage|ReferenceError|not defined/i);

    // Also confirm the pageerror handler captured an error mentioning renderPage or ReferenceError
    const matchedPageError = pageErrors.some(msg => /renderPage|ReferenceError|not defined/i.test(msg));
    // Depending on the engine, pageerror may or may not be populated for evaluate() thrown error,
    // but in either case we assert at least one of these conditions: evaluation threw and/or page error captured.
    expect(matchedPageError || !!evalError).toBeTruthy();
  });

  test('Edge case: calling scheduleProcesses with undefined -> TypeError about sort', async ({ page }) => {
    // Clear previous console & errors observations
    consoleMessages.length = 0;
    pageErrors.length = 0;

    let evalError1 = null;
    try {
      // Calling scheduleProcesses(undefined) should attempt to call .sort on undefined and throw.
      await page.evaluate(() => {
        // Intentionally pass undefined to provoke a runtime error (natural TypeError)
        return scheduleProcesses(undefined);
      });
    } catch (e) {
      evalError = e;
    }

    // Ensure an error was thrown from the page evaluation
    expect(evalError).not.toBeNull();
    // The message should indicate an issue related to 'sort' or accessing properties on undefined
    expect(String(evalError.message)).toMatch(/sort|Cannot read properties|not a function|undefined/i);

    // Confirm page error handler saw something similar (some engines produce different phrasing)
    const hasRelevantPageError = pageErrors.some(msg => /sort|Cannot read properties|is not iterable|undefined/i.test(msg));
    expect(hasRelevantPageError || !!evalError).toBeTruthy();
  });

  test('Edge case: calling executeProcesses with undefined -> TypeError about iteration', async ({ page }) => {
    // Clear previous console & errors observations
    consoleMessages.length = 0;
    pageErrors.length = 0;

    let evalError2 = null;
    try {
      // Calling executeProcesses(undefined) should attempt to iterate over undefined and throw.
      await page.evaluate(() => {
        // Intentionally pass undefined to provoke a runtime error (natural TypeError)
        return executeProcesses(undefined);
      });
    } catch (e) {
      evalError = e;
    }

    // Ensure an error was thrown from the page evaluation
    expect(evalError).not.toBeNull();
    // The message should indicate an iteration/iterable issue or accessing properties on undefined
    expect(String(evalError.message)).toMatch(/is not iterable|Cannot read properties|undefined|TypeError/i);

    // Confirm page error handler saw something similar
    const hasRelevantPageError1 = pageErrors.some(msg => /iterable|is not iterable|Cannot read properties|undefined/i.test(msg));
    expect(hasRelevantPageError || !!evalError).toBeTruthy();
  });

  test('Edge case: calling scheduleProcesses with empty array should not throw and logs nothing new', async ({ page }) => {
    // Clear console messages and errors
    consoleMessages.length = 0;
    pageErrors.length = 0;

    // Calling with empty array should not throw; it will just iterate zero times.
    let threw = false;
    try {
      await page.evaluate(() => {
        scheduleProcesses([]);
      });
    } catch (e) {
      threw = true;
    }
    expect(threw).toBeFalsy();

    // No new console entries should be produced for an empty array call
    // (function logs only inside the loop)
    expect(consoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: calling executeProcesses with empty array should not throw and logs nothing new', async ({ page }) => {
    // Clear console messages and errors
    consoleMessages.length = 0;
    pageErrors.length = 0;

    let threw1 = false;
    try {
      await page.evaluate(() => {
        executeProcesses([]);
      });
    } catch (e) {
      threw = true;
    }
    expect(threw).toBeFalsy();

    // No console messages produced for an empty array call
    expect(consoleMessages.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});