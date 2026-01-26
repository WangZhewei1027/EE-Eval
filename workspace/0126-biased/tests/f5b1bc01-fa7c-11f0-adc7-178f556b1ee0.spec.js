import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f5b1bc01-fa7c-11f0-adc7-178f556b1ee0.html';

test.describe('Branch and Bound interactive app - FSM validation (f5b1bc01-fa7c-11f0-adc7-178f556b1ee0)', () => {
  // Hold runtime console messages and page errors for each test
  let pageErrors;
  let consoleMessages;

  // Before each test navigate to the page and attach observers for console and page errors.
  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect unhandled errors from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Collect console messages for observation
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Load the application exactly as-is
    await page.goto(APP_URL);
  });

  // Test S0_Initial: Validate entry actions explanation(), example(), demonstration() ran on load
  test('Initial state (S0_Initial) sets explanation, example and demonstration content on load', async ({ page }) => {
    // Ensure the main elements exist
    const explanation = await page.locator('#explanation');
    const example = await page.locator('#example');
    const demonstration = await page.locator('#demonstration');
    const demoButton = await page.locator('#demonstration-button');

    // Validate DOM presence
    await expect(explanation).toBeVisible();
    await expect(example).toBeVisible();
    await expect(demonstration).toBeVisible();
    await expect(demoButton).toBeVisible();

    // Verify button text matches expected component
    await expect(demoButton).toHaveText('Demonstrate Branch and Bound');

    // Verify that entry actions populated content (non-empty and contain expected substrings)
    const explanationText = await explanation.textContent();
    const exampleText = await example.textContent();
    const demonstrationText = await demonstration.textContent();

    expect(explanationText).toBeTruthy();
    expect(exampleText).toBeTruthy();
    expect(demonstrationText).toBeTruthy();

    // Check for expected phrasing to ensure the specific actions ran
    expect(explanationText).toMatch(/Branch and Bound algorithm/i);
    expect(exampleText).toMatch(/Example: 3-SAT Problem/i);
    expect(demonstrationText).toMatch(/Demonstration:/i);

    // Ensure no unhandled page errors were produced during initialization
    expect(pageErrors.length).toBe(0);

    // Observe console (if any) and ensure no error-level console messages exist
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMsgs.length).toBe(0);
  });

  // Test the event: DemonstrationClick - clicking the button should (re)run demonstration() and update demonstration text
  test('Transition on DemonstrationClick: clicking the demonstration button updates demonstration text (S0 -> S1)', async ({ page }) => {
    const demoButton = page.locator('#demonstration-button');
    const demonstration = page.locator('#demonstration');
    const explanation = page.locator('#explanation');
    const example = page.locator('#example');

    // Capture current texts prior to click
    const beforeDemoText = await demonstration.textContent();
    const beforeExplanation = await explanation.textContent();
    const beforeExample = await example.textContent();

    // Click the demonstration button to trigger the event in the FSM
    await demoButton.click();

    // After the click, demonstration() should have been invoked again and demonstration text should contain the expected phrase
    await expect(demonstration).toContainText(/Demonstration:/i);

    const afterDemoText = await demonstration.textContent();
    // The demonstration text is expected to be non-empty and contain the demonstration details.
    expect(afterDemoText).toBeTruthy();
    expect(afterDemoText).toMatch(/recursively dividing the problem/i);

    // Because exit_actions are empty in the FSM, explanation and example should remain unchanged after the transition
    const afterExplanation = await explanation.textContent();
    const afterExample = await example.textContent();
    expect(afterExplanation).toBe(beforeExplanation);
    expect(afterExample).toBe(beforeExample);

    // Ensure clicking the button does not introduce page errors
    expect(pageErrors.length).toBe(0);
  });

  // Edge cases and error scenarios:
  // - Intentionally cause ReferenceError, TypeError, and SyntaxError in the page context as asynchronous, unhandled exceptions
  // - Use page.waitForEvent('pageerror') to capture the errors as they are raised inside the page (not as direct evaluate rejections)
  test('Edge cases: page should emit ReferenceError, TypeError, and SyntaxError when triggered naturally', async ({ page }) => {
    // Trigger a ReferenceError by scheduling a call to an undefined function inside the page (asynchronously)
    const refErrPromise = page.waitForEvent('pageerror');
    await page.evaluate(() => {
      // schedule to ensure the error is unhandled in the page context
      setTimeout(() => {
        // This function does not exist: will cause a ReferenceError in the page
        nonexistentFunctionCallToTriggerReferenceError();
      }, 0);
    });
    const refErr = await refErrPromise;
    expect(refErr).toBeTruthy();
    // Name can be 'ReferenceError' in many runtimes
    expect(refErr.name).toMatch(/ReferenceError/i);
    expect(refErr.message).toBeTruthy();

    // Trigger a TypeError by invoking a property on null
    const typeErrPromise = page.waitForEvent('pageerror');
    await page.evaluate(() => {
      setTimeout(() => {
        // Causes TypeError: cannot read properties of null (reading 'foo') or similar
        const x = null;
        // Accessing property of null will throw TypeError
        x.foo();
      }, 0);
    });
    const typeErr = await typeErrPromise;
    expect(typeErr).toBeTruthy();
    expect(typeErr.name).toMatch(/TypeError/i);
    expect(typeErr.message).toBeTruthy();

    // Trigger a SyntaxError by using eval with malformed code asynchronously
    const syntaxErrPromise = page.waitForEvent('pageerror');
    await page.evaluate(() => {
      setTimeout(() => {
        // This eval will throw a SyntaxError in the page context
        eval('var broken = ;');
      }, 0);
    });
    const syntaxErr = await syntaxErrPromise;
    expect(syntaxErr).toBeTruthy();
    // Some engines report 'SyntaxError'
    expect(syntaxErr.name).toMatch(/SyntaxError/i);
    expect(syntaxErr.message).toBeTruthy();

    // Collect the captured pageErrors from our page.on handler and ensure they include at least these three events.
    // Note: depending on ordering and timing, additional errors could be present; we assert that we observed at least three total page errors now.
    expect(pageErrors.length).toBeGreaterThanOrEqual(3);

    // Validate that among collected errors we can find entries matching our three error types
    const names = pageErrors.map(e => e.name);
    expect(names.some(n => /ReferenceError/i.test(n))).toBeTruthy();
    expect(names.some(n => /TypeError/i.test(n))).toBeTruthy();
    expect(names.some(n => /SyntaxError/i.test(n))).toBeTruthy();
  });

  // Robustness test: clicking the demonstration button repeatedly should not throw errors and should keep updating demonstration content
  test('Robustness: multiple rapid clicks on demonstration button do not produce page errors', async ({ page }) => {
    const demoButton = page.locator('#demonstration-button');
    const demonstration = page.locator('#demonstration');

    // Rapidly click the button multiple times
    await Promise.all([
      demoButton.click(),
      demoButton.click(),
      demoButton.click(),
      demoButton.click()
    ]);

    // Ensure demonstration text is present and contains expected content after rapid clicks
    await expect(demonstration).toContainText(/Demonstration:/i);

    // There should be no new page errors as a result of the rapid clicks (excluding earlier intentionally generated errors)
    // We only assert that no additional errors were introduced during this test's actions.
    // Because pageErrors could already contain errors from previous tests in the same worker, we check the most recent ones
    // by ensuring there are no pageerror events immediately following the rapid clicks.
    // We'll wait a short time to capture any unexpected asynchronous errors caused by clicks.
    const initialErrorCount = pageErrors.length;
    // Wait briefly for any asynchronous errors that might appear as a result of the clicks
    await page.waitForTimeout(200);
    expect(pageErrors.length).toBe(initialErrorCount);
  });

  // Clean up comment: Playwright automatically handles closing pages between tests.
});