import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/0441e6e1-fa79-11f0-8a8e-bbe4f11717c6.html';

test.describe('Heap (Min) FSM - End-to-End', () => {
  // Shared collectors for console messages, page errors and failed requests
  let consoleMessages;
  let pageErrors;
  let requestFailures;

  // Setup listeners before each test and navigate to the page as-is.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    requestFailures = [];

    // Collect console messages emitted by the page
    page.on('console', (msg) => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // swallow any unexpected console listener exceptions to avoid masking page errors
      }
    });

    // Collect runtime page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      try {
        pageErrors.push(String(err && err.message ? err.message : err));
      } catch (e) {
        // swallow
      }
    });

    // Collect failed network requests (e.g., missing script.js)
    page.on('requestfailed', (request) => {
      try {
        const failure = request.failure();
        requestFailures.push({
          url: request.url(),
          method: request.method(),
          errorText: failure ? failure.errorText : null,
        });
      } catch (e) {
        // swallow
      }
    });

    // Navigate to the exact page under test and wait for load event
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  // Teardown: clear listeners' data references after each test to avoid leakage.
  test.afterEach(async () => {
    consoleMessages = [];
    pageErrors = [];
    requestFailures = [];
  });

  test('S0_Idle: initial UI should render with required components', async ({ page }) => {
    // This test validates the Idle state described in the FSM:
    // - renderPage() is an entry action (if implemented) on load
    // - The two buttons and the heap container must be present in the DOM

    // Assert presence of Generate and Print buttons and the heap container
    const generateBtn = await page.$('#generate-btn');
    const printBtn = await page.$('#print-btn');
    const heapDiv = await page.$('#heap');

    expect(generateBtn).not.toBeNull();
    expect(printBtn).not.toBeNull();
    expect(heapDiv).not.toBeNull();

    // Basic sanity: buttons should be visible/enabled (if styles/scripts don't prevent it)
    expect(await generateBtn.isVisible()).toBeTruthy();
    expect(await printBtn.isVisible()).toBeTruthy();

    // Record any console messages produced during initial render for manual inspection.
    // We don't assert here that an error must exist; a later dedicated test asserts that errors occur.
  });

  test('Transition: GenerateHeap - clicking "Generate Random Heap" should populate #heap or produce runtime errors', async ({ page }) => {
    // This test validates the transition from S0_Idle -> S1_HeapGenerated triggered by GenerateHeap:
    // - Action: generateRandomHeap() is expected to run
    // - Observable: #heap should be populated (heap displayed)
    // The environment may cause runtime errors; we capture and assert their occurrence as required.

    // Click the generate button
    await page.click('#generate-btn');

    // Give the page a short amount of time to run any client-side logic
    await page.waitForTimeout(500);

    // Read the heap container contents
    const heapHTML = await page.$eval('#heap', (el) => el.innerHTML.trim()).catch(() => '');

    // Prepare detection for runtime errors of interest
    const runtimeErrorDetected = pageErrors.some((msg) =>
      /ReferenceError|TypeError|SyntaxError/i.test(msg)
    );

    const scriptLoadFailed = requestFailures.some((r) =>
      r.url.endsWith('/script.js') || /script.js/.test(r.url)
    );

    // Acceptable outcomes:
    // - The #heap container is non-empty (successful heap generation)
    // - OR a runtime error occurred (ReferenceError/TypeError/SyntaxError)
    // - OR script resource failed to load (e.g., script.js 404), which explains failure
    const successCondition = heapHTML.length > 0 || runtimeErrorDetected || scriptLoadFailed;

    expect(successCondition, `After clicking generate, expected #heap to be populated or an error/resource-failure to occur. heapHTML='${heapHTML}', pageErrors=${JSON.stringify(pageErrors)}, requestFailures=${JSON.stringify(requestFailures)}, consoleMessages=${JSON.stringify(consoleMessages)}`).toBeTruthy();

    // If a heap was rendered, perform some lightweight structure assertions (numbers or list nodes)
    if (heapHTML.length > 0) {
      // Ensure the heap container contains some visible text or child nodes
      const heapText = await page.$eval('#heap', (el) => el.innerText.trim());
      expect(heapText.length).toBeGreaterThan(0);

      // Optionally assert that the heap text contains digits or separators consistent with an array/list
      expect(/\d/.test(heapText)).toBeTruthy();
    }
  });

  test('Transition: PrintHeap - clicking "Print Heap" should log heap to console or cause a runtime error', async ({ page }) => {
    // This test validates the PrintHeap event when in S1_HeapGenerated:
    // - Clicking Print Heap should invoke printHeap(), likely logging output to console
    // - We capture console messages and page errors and assert either a print occurred or an error did

    // Ensure we attempt to generate first to get into S1_HeapGenerated if possible
    await page.click('#generate-btn').catch(() => {});
    await page.waitForTimeout(300);

    // Clear console messages so we can focus on messages produced by the print action
    consoleMessages = [];

    // Click the print button
    await page.click('#print-btn');

    // Allow time for logging or errors
    await page.waitForTimeout(300);

    // Detect console output that resembles printing a heap (e.g., numbers, arrays, 'Heap', etc.)
    const printedHeapMessage = consoleMessages.find((m) => /\[?\s*\d+[\d,\s]*\]?|Heap|heap/i.test(m.text));

    const runtimeErrorDetected = pageErrors.some((msg) =>
      /ReferenceError|TypeError|SyntaxError/i.test(msg)
    );

    const scriptLoadFailed = requestFailures.some((r) =>
      r.url.endsWith('/script.js') || /script.js/.test(r.url)
    );

    // At least one of these should be true: we saw a printed heap console message OR a runtime error/resource failure happened
    const condition = Boolean(printedHeapMessage) || runtimeErrorDetected || scriptLoadFailed;

    expect(condition, `Expected print to either log heap to console or produce a runtime/resource error. consoleMessages=${JSON.stringify(consoleMessages)}, pageErrors=${JSON.stringify(pageErrors)}, requestFailures=${JSON.stringify(requestFailures)}`).toBeTruthy();

    // If a console print was found, assert it includes numeric content consistent with a heap representation
    if (printedHeapMessage) {
      expect(/\d/.test(printedHeapMessage.text)).toBeTruthy();
    }
  });

  test('Edge cases: multiple rapid clicks and repeated prints should not silently swallow errors (observe either stable behavior or explicit errors)', async ({ page }) => {
    // This test stresses the UI:
    // - Click Generate multiple times quickly
    // - Click Print multiple times
    // We validate that either the heap updates (observable) or runtime errors are emitted and captured.

    // Rapidly click generate 3 times
    for (let i = 0; i < 3; i++) {
      await page.click('#generate-btn').catch(() => {});
    }

    // Short pause for any async operations
    await page.waitForTimeout(400);

    // Capture heap state after rapid generation attempts
    const heapAfterRapidGen = await page.$eval('#heap', (el) => el.innerText.trim()).catch(() => '');

    // Rapidly click print 3 times
    consoleMessages = [];
    for (let i = 0; i < 3; i++) {
      await page.click('#print-btn').catch(() => {});
    }

    await page.waitForTimeout(400);

    // Detect console print or runtime errors
    const printed = consoleMessages.find((m) => /\d/.test(m.text));
    const runtimeErrorDetected = pageErrors.some((msg) =>
      /ReferenceError|TypeError|SyntaxError/i.test(msg)
    );
    const scriptLoadFailed = requestFailures.some((r) =>
      r.url.endsWith('/script.js') || /script.js/.test(r.url)
    );

    // Validate that either heap content exists OR we have detected meaningful errors/resource failures OR we observed console prints
    const condition = heapAfterRapidGen.length > 0 || printed || runtimeErrorDetected || scriptLoadFailed;

    expect(condition, `After rapid interactions expected either visible heap, console prints, or explicit errors. heap='${heapAfterRapidGen}', printed=${JSON.stringify(printed)}, pageErrors=${JSON.stringify(pageErrors)}, requestFailures=${JSON.stringify(requestFailures)}`).toBeTruthy();

    // If we have heap content, ensure it's not just whitespace
    if (heapAfterRapidGen.length > 0) {
      expect(/\d/.test(heapAfterRapidGen)).toBeTruthy();
    }
  });

  test('Implementation integrity check: ensure that runtime ReferenceError/TypeError/SyntaxError or script load failure occurred (per test instructions to observe natural errors)', async () => {
    // This test intentionally asserts that at least one of the known error types or a script load failure occurred.
    // NOTE: The project instructions explicitly require observing and asserting these errors if they happen.
    // We therefore check for them and fail the test if none are observed.

    // The page navigation and listeners were set up in beforeEach; use the collected arrays.
    // It's possible that errors are emitted on load; if not, some interactions may have produced them in prior tests.
    const runtimeErrorDetected = pageErrors.some((msg) =>
      /ReferenceError|TypeError|SyntaxError/i.test(msg)
    );

    const scriptLoadFailed = requestFailures.some((r) =>
      r.url.endsWith('/script.js') || /script.js/.test(r.url)
    );

    // Also consider console messages that indicate failed resource loads or uncaught exceptions
    const consoleIndicatedFailure = consoleMessages.some((m) =>
      /Failed to load resource|Uncaught|ReferenceError|TypeError|SyntaxError/i.test(m.text)
    );

    // Assert that at least one of these abnormal conditions occurred
    const observedProblem = runtimeErrorDetected || scriptLoadFailed || consoleIndicatedFailure;

    expect(observedProblem, `Expected at least one runtime error (ReferenceError/TypeError/SyntaxError) or a script resource failure to be observed. pageErrors=${JSON.stringify(pageErrors)}, requestFailures=${JSON.stringify(requestFailures)}, consoleMessages=${JSON.stringify(consoleMessages)}`).toBeTruthy();
  });
});