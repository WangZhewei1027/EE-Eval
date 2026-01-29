import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b1e311-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Big-Theta Notation FSM - f5b1e311-fa7c-11f0-adc7-178f556b1ee0', () => {
  // Navigate to the page before each test
  test.beforeEach(async ({ page }) => {
    // Capture console and page errors in browser for debugging visibility (handlers will be set per test as needed)
    await page.goto(APP_URL);
  });

  test('S0_Idle: initial Idle state - demonstration button is present and visible', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) evidence:
    // - The button with id #demonstration-button exists and displays correct text.
    const button = page.locator('#demonstration-button');

    // Assert visibility and text content
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Demonstrate Big-Theta Notation');

    // Verify that prior to any interaction there are no page errors emitted immediately after load.
    // We listen for any pageerror events for a short window and assert none occur.
    const pageErrors: Error[] = [];
    const handle = (err: Error) => pageErrors.push(err);
    page.on('pageerror', handle);

    // small wait to capture any immediate runtime errors on load
    await page.waitForTimeout(200);

    // remove listener
    page.removeListener('pageerror', handle);

    // Expect no errors on page load (Idle state should be stable)
    expect(pageErrors.length).toBe(0);
  });

  test('S1_Demonstrating: clicking the demonstration button triggers transition and results in ReferenceError(s)', async ({ page }) => {
    // This test validates the transition S0_Idle -> S1_Demonstrating when the user clicks the button.
    // The provided HTML attaches an event listener that calls functions defined only inside a <pre> block (not executed).
    // According to the instructions we must not patch anything and must allow ReferenceError/TypeError to occur naturally.
    // We will assert that these runtime errors occur and that the expected console logs (entry_actions) do NOT appear due to the errors.

    // Collect console messages and page errors
    const consoleMessages: { type: string; text: string }[] = [];
    const pageErrors: Error[] = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Click the demonstration button to trigger the transition and the page script
    await page.click('#demonstration-button');

    // Wait briefly to allow console messages and page errors to be emitted
    await page.waitForTimeout(200);

    // At least one page error should have occurred because the click handler references functions (countElements, etc.)
    // that are present only as innert text in a <pre> block and are therefore not defined at runtime.
    expect(pageErrors.length).toBeGreaterThanOrEqual(1);

    // Inspect the error messages to assert they reference the missing functions
    // The first missing function call in the script is countElements(arr)
    const errorMessages = pageErrors.map(e => String(e && e.message ? e.message : e.toString()).toLowerCase());
    const combinedErrors = errorMessages.join(' | ');
    // The ReferenceError text can vary by engine, check for the function name to be present in the message
    expect(combinedErrors).toContain('countelements');

    // Since the first ReferenceError prevents subsequent lines from executing, the console.log entry_actions
    // that would print "Time complexity: Θ(5) = ..." will not be present. Assert that no such "Time complexity" logs exist.
    const timeComplexityLogs = consoleMessages.filter(m => m.text.includes('Time complexity'));
    expect(timeComplexityLogs.length).toBe(0);

    // For additional evidence that the event listener was attached and invoked, we should see at least one error
    // produced from the click handler. Validate the console also captured at least one console-level error or message.
    // Some engines may log the uncaught exception as a console.error as well; we assert that either console messages include
    // references to the missing function or that pageErrors captured them - we already asserted pageErrors.
    const consoleContainsFunctionName = consoleMessages.some(m =>
      /countelements|countnodes|countoperations/i.test(m.text)
    );
    // It's acceptable whether or not console captured it; ensure that either console or pageErrors contain the function names.
    expect(consoleContainsFunctionName || combinedErrors.length > 0).toBeTruthy();

    // EDGE CASE: Clicking the button multiple times should produce repeated errors (each click will attempt same calls).
    // Click twice more and assert that pageErrors increases (i.e., errors are thrown repeatedly).
    const initialErrorCount = pageErrors.length;
    await page.click('#demonstration-button');
    await page.waitForTimeout(100);
    await page.click('#demonstration-button');
    await page.waitForTimeout(100);

    expect(pageErrors.length).toBeGreaterThanOrEqual(initialErrorCount + 2);

    // Clean up listeners for clarity (not strictly necessary as Playwright handles test isolation)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Edge case: verify no DOM changes occur when the click handler errors (no accidental elements added)', async ({ page }) => {
    // This test ensures that because the click handler fails early with a ReferenceError, it does not modify DOM.
    // We snapshot the body child count before click and after click to assert no additions were made by the handler.
    const bodyChildrenBefore = await page.evaluate(() => document.body.childElementCount);

    // Perform click and allow errors to happen (we don't need to capture them here; they are expected)
    await page.click('#demonstration-button');
    await page.waitForTimeout(150);

    const bodyChildrenAfter = await page.evaluate(() => document.body.childElementCount);

    // Since the script does only console logging and no DOM mutations (and errors happen early),
    // the number of body children should remain the same.
    expect(bodyChildrenAfter).toBe(bodyChildrenBefore);
  });

  test('Verify that expected FSM onEnter log messages are absent due to runtime errors', async ({ page }) => {
    // The FSM entry_actions list contains three console.log statements that would print "Time complexity: Θ(5) = ${...} operations".
    // Because of ReferenceError, these logs will not be emitted. This test explicitly asserts their absence in console output.

    const consoleTexts: string[] = [];
    page.on('console', msg => consoleTexts.push(msg.text()));

    // Trigger the event
    await page.click('#demonstration-button');
    await page.waitForTimeout(200);

    // Assert no "Time complexity" strings in console output
    const foundTimeLogs = consoleTexts.filter(t => t.includes('Time complexity: Θ(5)'));
    expect(foundTimeLogs.length).toBe(0);

    page.removeAllListeners('console');
  });
});