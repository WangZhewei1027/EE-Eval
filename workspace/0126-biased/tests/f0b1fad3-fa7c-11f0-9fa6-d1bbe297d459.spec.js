import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b1fad3-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('Quick Sort Demo FSM tests - f0b1fad3-fa7c-11f0-9fa6-d1bbe297d459', () => {
  // Collect console and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events (info, error, warning, etc.)
    page.on('console', msg => {
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch (e) {
        // best-effort capture; don't interfere with test flow
      }
    });

    // Capture uncaught page errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app page for each test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Basic sanity check: collected arrays exist
    if (!Array.isArray(consoleMessages)) consoleMessages = [];
    if (!Array.isArray(pageErrors)) pageErrors = [];
  });

  test('Idle state: page renders and "Run Quick Sort Demo" button is present', async ({ page }) => {
    // This test validates the S0_Idle evidence: the demo button should be present and output empty.
    const demoButton = page.locator('#demo-button');
    await expect(demoButton).toBeVisible();
    await expect(demoButton).toHaveText('Run Quick Sort Demo');

    const output = page.locator('#demo-output');
    // Initially the demo output should be empty (no innerText)
    const initialText = await output.innerText();
    expect(initialText.trim()).toBe('', 'Expected demo output to be empty in Idle state');

    // Verify FSM-declared entry action names (renderPage) are not defined on window.
    // We must not patch or define them; just assert their absence.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');
  });

  test('Demo runs and transitions through all FSM states in order', async ({ page }) => {
    // This test validates the sequence of messages appended to #demo-output
    // corresponding to states S1 through S8 and their expected timing.
    const outputHandle = await page.locator('#demo-output');
    const demoButton = page.locator('#demo-button');

    // Click to start the demo (transition S0 -> S1)
    await demoButton.click();

    // Immediately after click: S1 entry observable
    await expect(outputHandle).toContainText('Running Quick Sort on [5, 3, 8, 4, 2, 7, 1, 10]...', { timeout: 1000 });

    // Step 1 should appear at ~500ms
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.innerText.includes('Step 1: Pivot = 10 → Partitioning...');
    }, null, { timeout: 2000 });

    // After partition step 1 at ~1000ms
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.innerText.includes('After partition: [5, 3, 8, 4, 2, 7, 1, 10]');
    }, null, { timeout: 2500 });

    // Recursing left at ~1500ms
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.innerText.includes('Recursing on left: [5, 3, 8, 4, 2, 7, 1]');
    }, null, { timeout: 3000 });

    // Step 2 pivot = 1 at ~2000ms
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.innerText.includes('Step 2: Pivot = 1 → Partitioning...');
    }, null, { timeout: 3500 });

    // After partition step 2 at ~2500ms
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.innerText.includes('After partition: [1, 3, 8, 4, 2, 7, 5]');
    }, null, { timeout: 4000 });

    // Recursing right at ~3000ms
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.innerText.includes('Recursing on right: [3, 8, 4, 2, 7, 5]');
    }, null, { timeout: 5000 });

    // Final sorted array at ~4000ms (allow generous timeout)
    await page.waitForFunction(() => {
      const el = document.getElementById('demo-output');
      return el && el.innerText.includes('Final sorted array: [1, 2, 3, 4, 5, 7, 8, 10]');
    }, null, { timeout: 7000 });

    // Confirm the "Note" paragraph was appended with the final output
    await expect(outputHandle).toContainText('This is a simplified demonstration. A full implementation would show all recursive steps.', { timeout: 1000 });

    // Verify sequence order: check index positions of key substrings in the full innerText
    const fullText = await outputHandle.innerText();
    const idxRunning = fullText.indexOf('Running Quick Sort on');
    const idxStep1 = fullText.indexOf('Step 1: Pivot = 10');
    const idxAfter1 = fullText.indexOf('After partition: [5, 3, 8, 4, 2, 7, 1, 10]');
    const idxRecLeft = fullText.indexOf('Recursing on left: [5, 3, 8, 4, 2, 7, 1]');
    const idxStep2 = fullText.indexOf('Step 2: Pivot = 1');
    const idxAfter2 = fullText.indexOf('After partition: [1, 3, 8, 4, 2, 7, 5]');
    const idxRecRight = fullText.indexOf('Recursing on right: [3, 8, 4, 2, 7, 5]');
    const idxFinal = fullText.indexOf('Final sorted array: [1, 2, 3, 4, 5, 7, 8, 10]');

    // Ensure all pieces were found and in increasing order
    const indices = [idxRunning, idxStep1, idxAfter1, idxRecLeft, idxStep2, idxAfter2, idxRecRight, idxFinal];
    for (const idx of indices) {
      expect(idx).toBeGreaterThanOrEqual(0);
    }
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1]);
    }
  });

  test('Repeated clicks and edge case: clicking during a running demo resets output', async ({ page }) => {
    // This test explores an edge case: user clicks the demo button repeatedly while demo is running.
    const demoButton = page.locator('#demo-button');
    const output = page.locator('#demo-output');

    // Start the demo
    await demoButton.click();

    // Wait a short time (before Step 1) and click again to trigger reset behavior
    await page.waitForTimeout(250); // before first 500ms step
    await demoButton.click();

    // After the second click, the output should begin again but should not contain duplicated "Running..." lines.
    // We assert that the "Running Quick Sort..." appears and appears only once at the start.
    await expect(output).toContainText('Running Quick Sort on [5, 3, 8, 4, 2, 7, 1, 10]...', { timeout: 1000 });

    const textAfterSecondClick = await output.innerText();
    const occurrences = (textAfterSecondClick.match(/Running Quick Sort on \[/g) || []).length;
    expect(occurrences).toBe(1, 'Expected only one "Running Quick Sort on ..." message after a reset by second click');

    // Let the demo finish to ensure no runtime exceptions occur during overlapping timers
    await page.waitForFunction(() => document.getElementById('demo-output').innerText.includes('Final sorted array'), null, { timeout: 7000 });

    // Verify no uncaught page errors were emitted during this sequence
    expect(pageErrors.length).toBe(0, `Expected no uncaught page errors during repeated clicks, found: ${pageErrors.length}`);
  });

  test('Attempting to invoke declared but non-implemented FSM actions (startDemo/stopDemo) results in ReferenceError when called', async ({ page }) => {
    // The FSM mentions functions like startDemo() and stopDemo() in entry/exit actions.
    // The implementation does not define these; attempting to call them should raise a ReferenceError.
    // We do this to validate error scenarios without modifying the page code.

    // Confirm the properties are undefined
    const startDemoType = await page.evaluate(() => typeof window.startDemo);
    const stopDemoType = await page.evaluate(() => typeof window.stopDemo);
    expect(startDemoType).toBe('undefined');
    expect(stopDemoType).toBe('undefined');

    // Now attempt to call startDemo() inside the page context and assert a ReferenceError is thrown.
    // We capture the thrown error and verify its name/message contains 'startDemo' or 'is not defined'.
    let thrownErrorInfo = null;
    try {
      await page.evaluate(() => {
        // Intentionally invoke an undeclared function to observe ReferenceError in page context.
        // This is not modifying the page, only executing code in its JavaScript environment.
        // eslint-disable-next-line no-undef
        startDemo();
      });
    } catch (err) {
      // The error is thrown in Node context after propagation from page; capture details.
      thrownErrorInfo = err;
    }

    expect(thrownErrorInfo).not.toBeNull();
    // Depending on environment, error message might differ; check for ReferenceError name or mention of startDemo
    const msg = String(thrownErrorInfo.message || thrownErrorInfo);
    expect(msg.toLowerCase()).toContain('startdemo' || 'is not defined' || 'not defined');
  });

  test('No uncaught runtime errors during normal demo run (collect console and page errors)', async ({ page }) => {
    // Start with fresh arrays
    consoleMessages = [];
    pageErrors = [];

    const demoButton = page.locator('#demo-button');
    await demoButton.click();

    // Let the demo run to completion
    await page.waitForFunction(() => document.getElementById('demo-output').innerText.includes('Final sorted array'), null, { timeout: 7000 });

    // Validate there were no uncaught page errors (ReferenceError/TypeError etc.)
    expect(pageErrors.length).toBe(0, `Expected no uncaught page errors, found: ${pageErrors.length}`);

    // Optionally ensure console contains no 'error' type messages emitted by the page
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0, `Expected no console.error messages, found: ${consoleErrors.length}`);

    // For debugging and auditability, attach a small summary to the test output (Playwright will show assertion messages on failure)
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0);
  });
});