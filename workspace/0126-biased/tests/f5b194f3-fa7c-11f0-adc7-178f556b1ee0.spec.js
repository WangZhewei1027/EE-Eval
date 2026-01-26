import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b194f3-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('f5b194f3-fa7c-11f0-adc7-178f556b1ee0 - Dynamic Programming interactive app', () => {
  // Collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages emitted by the page
    page.on('console', (msg) => {
      // Store both type and text for richer assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions and runtime errors from the page
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(err);
    });

    // Navigate to the exact page under test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // Reset collectors (not strictly necessary because beforeEach reassigns)
    consoleMessages = [];
    pageErrors = [];
  });

  test('S0_Idle (Initial state) - Page renders and shows the Explore Dynamic Programming button', async ({ page }) => {
    // This test validates the Idle state per the FSM:
    // - The button #dp-example-btn should be present with the expected text
    // - No runtime page errors should be present immediately after load
    // - No console logs should be emitted on load (expected for this static page)
    const button = page.locator('#dp-example-btn');

    // Ensure the button exists and is visible
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Explore Dynamic Programming');

    // The FSM's S0 entry_action lists renderPage(), but the implementation does not call it.
    // Assert that no page-level errors were emitted during initial render.
    expect(pageErrors.length).toBe(0);

    // Assert no console messages were logged on initial load (sanity check)
    // There could be benign console output in some environments, so allow for >0 in that case.
    // Here we assert that there's no evidence that the FSM's S0 entry action produced logs.
    const hasRenderPageConsole = consoleMessages.some((m) => m.text.includes('renderPage'));
    expect(hasRenderPageConsole).toBeFalsy();
  });

  test('S1_Exploring (Transition on ButtonClick) - Clicking triggers attempt to call fibonacci and results in ReferenceError', async ({ page }) => {
    // This test validates the transition from Idle -> Exploring:
    // - Clicking #dp-example-btn triggers the attached event handler which calls fibonacci(10)
    // - Since fibonacci is not defined in the runtime, we expect a ReferenceError to be emitted as a pageerror
    // - We also verify that the intended console.log message ("The 10th Fibonacci number is: ...") does NOT appear because the call fails

    // Prepare to wait for a pageerror event that should be raised by the missing fibonacci function
    const pageErrorPromise = page.waitForEvent('pageerror');

    // Click the button to trigger the event handler
    await page.click('#dp-example-btn');

    // Wait for the pageerror to occur (timeout will fail the test if it doesn't happen)
    const err = await pageErrorPromise;

    // Assert that an error was captured and its message indicates fibonacci is not defined
    // Different engines may format messages slightly differently, but they commonly include 'fibonacci is not defined' text
    expect(err).toBeTruthy();
    expect(typeof err.message).toBe('string');
    expect(err.message.toLowerCase()).toContain('fibonacci');

    // The FSM expected a console.log with the fibonacci result.
    // Because fibonacci is missing, the console.log should not have executed.
    const fibLog = consoleMessages.find((m) => m.text.includes('The 10th Fibonacci number is:'));
    expect(fibLog).toBeUndefined();

    // Verify the button is still present and usable after the error (DOM should remain stable)
    const button = page.locator('#dp-example-btn');
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Explore Dynamic Programming');
  });

  test('Edge case: Multiple clicks produce multiple ReferenceErrors (errors accumulate per event handler execution)', async ({ page }) => {
    // This test validates repeated invocation of the failing event handler:
    // Each click should independently attempt to call fibonacci and therefore produce an error.

    // We will click the button twice and capture two pageerror events.
    const errors = [];
    // Use waitForEvent twice to collect two errors
    const firstErrorPromise = page.waitForEvent('pageerror');
    await page.click('#dp-example-btn');
    const firstErr = await firstErrorPromise;
    errors.push(firstErr);

    const secondErrorPromise = page.waitForEvent('pageerror');
    await page.click('#dp-example-btn');
    const secondErr = await secondErrorPromise;
    errors.push(secondErr);

    // Assert that we captured two distinct error occurrences
    expect(errors.length).toBeGreaterThanOrEqual(2);
    // Both error messages should indicate fibonacci problem
    for (const e of errors) {
      expect(e.message.toLowerCase()).toContain('fibonacci');
    }

    // Confirm that console did not contain the expected successful log in any of the clicks
    const fibLogs = consoleMessages.filter((m) => m.text.includes('The 10th Fibonacci number is:'));
    expect(fibLogs.length).toBe(0);
  });

  test('Implementation detail: The fibonacci implementation shown in <pre> is static text and does not define a runtime function', async ({ page }) => {
    // This test verifies that the code sample present in the <pre> block is not executed.
    // We assert that the source code text includes the fibonacci definition and that the global fibonacci is not defined.

    // Ensure the <pre> element includes the textual function definition
    const pre = page.locator('pre');
    await expect(pre).toContainText('function fibonacci');

    // Check that fibonacci is not defined on the window (typeof fibonacci should be 'undefined')
    const fibType = await page.evaluate(() => typeof fibonacci);
    expect(fibType).toBe('undefined');
  });

  test('Error observation: Ensure console and pageerror events were recorded as expected after interactions', async ({ page }) => {
    // This test demonstrates observing console and pageerror streams and asserts expected behavior end-to-end.

    // Initially no errors
    expect(pageErrors.length).toBe(0);

    // Click to trigger the error; wait for pageerror
    const err = await page.waitForEvent('pageerror', { timeout: 2000, predicate: e => !!e });
    await page.click('#dp-example-btn').catch(() => {
      // click may throw if page error interrupts handler, swallow to let waitForEvent handle
    });

    // Now ensure our pageErrors listener recorded it as well
    // Give the listener a tick to receive the event
    await page.waitForTimeout(50);

    // There should be at least one page error recorded by the listener
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);
    // The error(s) should have messages referencing fibonacci
    const recordedHasFibonacci = pageErrors.some((e) => e.message.toLowerCase().includes('fibonacci'));
    expect(recordedHasFibonacci).toBeTruthy();

    // Confirm consoleMessages do not contain the successful log message
    const successfulLogPresent = consoleMessages.some((m) =>
      m.text.includes('The 10th Fibonacci number is:')
    );
    expect(successfulLogPresent).toBeFalsy();
  });
});