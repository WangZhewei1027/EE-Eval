import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b405f0-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('FSM - Logistic Regression App (f5b405f0-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Shared containers for page errors and console messages populated per-test in beforeEach
  let pageErrors;
  let consoleMessages;

  // Attach listeners for page errors and console messages before every test.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture uncaught exceptions from the page (ReferenceError, TypeError, etc.)
    page.on('pageerror', (err) => {
      // store the Error object for assertions
      pageErrors.push(err);
    });

    // Capture console messages for inspection (info, log, error, etc.)
    page.on('console', (msg) => {
      // store the text + type to make assertions easier
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the application under test for each test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({ page }) => {
    // Basic teardown: remove listeners to avoid cross-test leakage.
    // Note: Playwright will normally clean up the page between tests, but remove handlers defensively.
    page.removeAllListeners?.('pageerror');
    page.removeAllListeners?.('console');
  });

  test('Idle State (S0_Idle): page renders and Run Demo button is present', async ({ page }) => {
    // Validate S0_Idle: the page should render and show the Run Demo button.
    const demoButton = page.locator('#demo-button');

    // Wait for the button to be available in the DOM
    await expect(demoButton).toBeVisible({ timeout: 2000 });

    // The button should have the expected text content
    await expect(demoButton).toHaveText('Run Demo');

    // The code sample (pre) should contain the textual "The probability..." string as evidence of instructional content.
    const preText = await page.locator('pre').innerText();
    expect(preText).toContain('The probability of a person being a smoker given their age and income is:');

    // Ensure no page errors occurred during initial render (i.e., no renderPage() ReferenceError)
    // This asserts the app did not attempt to call missing entry actions at load time.
    expect(pageErrors.length).toBe(0);

    // Also assert that the demo function is present on the window (should be defined in the script)
    const demoType = await page.evaluate(() => typeof demo);
    expect(demoType).toBe('function');

    // Confirm that the logisticRegression helper (which is only shown in the <pre>) is NOT defined as a function in runtime,
    // preparing the expected ReferenceError later when demo() tries to call it.
    const logisticType = await page.evaluate(() => typeof logisticRegression);
    expect(logisticType).toBe('undefined');
  });

  test('Transition RunDemo (S0 -> S1): clicking Run Demo calls demo() and raises ReferenceError for missing logisticRegression', async ({ page }) => {
    // This test validates the RunDemo event and the S1_DemoRunning state behavior:
    // - clicking the Run Demo button triggers demo()
    // - demo() attempts to call logisticRegression, which is not defined, causing a ReferenceError
    // We assert that the page throws a pageerror and that the error message references logisticRegression.

    // Prepare to wait for the first uncaught page error from the click
    const waitForError = page.waitForEvent('pageerror');

    // Perform the click that should trigger demo() and therefore the ReferenceError
    await page.click('#demo-button');

    // Wait for the pageerror event triggered by the missing function call
    const error = await waitForError;

    // The captured pageerror should be an Error object whose message references the missing symbol logisticRegression
    expect(error).toBeTruthy();
    expect(typeof error.message).toBe('string');
    expect(error.message).toContain('logisticRegression');

    // The message should indicate it's not defined (different browsers vary in wording, so use a flexible check)
    expect(/not defined|is not defined/i.test(error.message)).toBeTruthy();

    // Ensure that the expected console.log in the demo (the probability print) was NOT produced successfully
    // because the ReferenceError occurs before that console.log executes.
    const hasProbabilityLog = consoleMessages.some((m) =>
      m.text.includes('The probability of a person being a smoker given their age and income is:')
    );
    expect(hasProbabilityLog).toBe(false);
  });

  test('Edge case: multiple clicks produce repeated ReferenceError occurrences', async ({ page }) => {
    // Validate repeated interactions: clicking the Run Demo button multiple times should repeatedly attempt to execute demo()
    // and therefore repeatedly produce the ReferenceError about logisticRegression being undefined.

    const errorPromises = [];

    // Prepare to collect 3 errors by waiting for pageerror events
    for (let i = 0; i < 3; i++) {
      // Kick off waiting for the next pageerror before each click
      errorPromises.push(page.waitForEvent('pageerror'));
      await page.click('#demo-button');
      // Slightly yield to allow the error to be emitted
      // (no need for explicit wait; events are awaited via the promises)
    }

    // Await all pageerror events
    const errors = await Promise.all(errorPromises);

    // We expect three error objects and each should mention logisticRegression
    expect(errors.length).toBe(3);
    for (const err of errors) {
      expect(err).toBeTruthy();
      expect(err.message).toContain('logisticRegression');
      expect(/not defined|is not defined/i.test(err.message)).toBeTruthy();
    }
  });

  test('Event listener evidence: clicking triggers demo() (function exists) and leads to the expected runtime error', async ({ page }) => {
    // This test double-checks evidence that demo() was registered as a click handler (via addEventListener)
    // by verifying demo exists and that clicking triggers the expected pageerror.
    const demoExists = await page.evaluate(() => typeof demo === 'function');
    expect(demoExists).toBe(true);

    // Ensure logisticRegression is not present (so demo will fail)
    const logisticExists = await page.evaluate(() => typeof logisticRegression !== 'undefined');
    expect(logisticExists).toBe(false);

    // Use Promise.all to ensure we catch the pageerror produced by the click
    const [pageError] = await Promise.all([
      page.waitForEvent('pageerror'),
      page.click('#demo-button'),
    ]);

    expect(pageError).toBeTruthy();
    expect(pageError.message).toContain('logisticRegression');
  });

  test('Sanity check: DOM remains intact after demo() throws (no DOM modifications expected)', async ({ page }) => {
    // Validate that even though demo() throws a ReferenceError, the DOM is not unexpectedly altered.
    // Capture the HTML snapshot of the body before the click.
    const bodyBefore = await page.locator('body').innerHTML();

    // Trigger the error by clicking the button and wait for the pageerror
    await Promise.all([page.waitForEvent('pageerror'), page.click('#demo-button')]);

    // Capture the body after the click
    const bodyAfter = await page.locator('body').innerHTML();

    // The DOM should be effectively unchanged by the failed demo execution
    expect(bodyAfter).toBe(bodyBefore);
  });
});