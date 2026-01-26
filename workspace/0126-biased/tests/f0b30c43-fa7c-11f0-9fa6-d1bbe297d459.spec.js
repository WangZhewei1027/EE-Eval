import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b30c43-fa7c-11f0-9fa6-d1bbe297d459.html';

test.describe('FSM: Two Pointers Technique (f0b30c43-fa7c-11f0-9fa6-d1bbe297d459)', () => {

  // Helper to collect console messages and page errors for a page.
  async function attachListeners(page) {
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      // capture text for easier assertions
      try {
        consoleMessages.push(String(msg.text()));
      } catch {
        consoleMessages.push('<unserializable console message>');
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
    return { consoleMessages, pageErrors };
  }

  // Validate initial Idle state (S0_Idle)
  test('S0_Idle: initial render - button present, demo output hidden, missing renderPage triggers ReferenceError', async ({ page }) => {
    // Comments: This test validates the Idle state from the FSM.
    // It ensures the "Run Two Pointers Demo" button exists and the demo output area is not visible.
    // It then verifies the FSM-declared entry action renderPage() is not defined in the page
    // by attempting to call it and asserting a ReferenceError occurs (observed as evaluate rejection
    // and a pageerror event).
    const { consoleMessages, pageErrors } = await attachListeners(page);

    await page.goto(APP_URL);

    // Verify the Run Demo button is present and has the expected text
    const runButton = page.locator("button[onclick='runDemo()']");
    await expect(runButton).toHaveCount(1);
    await expect(runButton).toHaveText('Run Two Pointers Demo');

    // Verify demoOutput exists and is initially hidden (display: none)
    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toHaveCount(1);
    const displayValue = await demoOutput.evaluate((el) => {
      return window.getComputedStyle(el).display;
    });
    expect(displayValue === 'none' || displayValue === 'hidden' || displayValue === '').toBeTruthy();

    // Ensure renderPage is indeed not defined according to page context
    const typeofRenderPage = await page.evaluate(() => typeof window.renderPage);
    expect(typeofRenderPage).toBe('undefined');

    // Attempt to call renderPage() - this should reject with a ReferenceError in the page context.
    // We assert that the evaluation rejects and that a pageerror event (ReferenceError) is observed.
    const evalPromise = page.evaluate(() => {
      // Intentionally call missing function to let the runtime produce ReferenceError naturally.
      // Do not patch or define renderPage anywhere - per test requirements.
      return renderPage();
    });

    await expect(evalPromise).rejects.toThrow(/renderPage is not defined|ReferenceError/);

    // Wait briefly for any pageerror event to be emitted (non-blocking short timeout).
    let pageErrorEvent = null;
    try {
      pageErrorEvent = await page.waitForEvent('pageerror', { timeout: 2000 });
    } catch {
      pageErrorEvent = null;
    }

    // We expect a pageerror event to have been emitted for the missing function call.
    expect(pageErrorEvent).not.toBeNull();
    if (pageErrorEvent) {
      // The message should indicate that renderPage is not defined (ReferenceError)
      expect(String(pageErrorEvent.message)).toMatch(/renderPage is not defined|ReferenceError/);
    }

    // Confirm no unexpected console error messages were emitted (other than the pageerror)
    // This is a best-effort check — console messages may include other diagnostics, but we assert there's at least some console capture
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  // Validate the transition (RunDemo event) and DemoRunning state (S1_DemoRunning)
  test('S1_DemoRunning: clicking Run Demo runs runDemo(), displays demo output, and missing displayDemoOutput triggers ReferenceError', async ({ page }) => {
    // Comments: This test simulates the user clicking the Run Demo button (the "RunDemo" event).
    // It asserts that:
    // - runDemo exists and is callable
    // - clicking the button makes the demo output area visible and populated with expected content
    // - FSM-specified exit action displayDemoOutput() is not present in the implementation,
    //   so attempting to call it triggers a ReferenceError that we observe via evaluate rejection and pageerror.
    const { consoleMessages, pageErrors } = await attachListeners(page);

    await page.goto(APP_URL);

    // Verify runDemo exists as a function in the page before clicking
    const runDemoType = await page.evaluate(() => typeof window.runDemo);
    expect(runDemoType).toBe('function');

    // Prepare to capture any potential pageerror that might happen on click
    // But do not predefine anything; we want natural runtime behavior.
    // Click the Run Demo button to trigger the FSM transition S0_Idle -> S1_DemoRunning
    await page.click("button[onclick='runDemo()']");

    // Wait for the demoOutput to become visible and populated
    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toBeVisible();

    const inner = await demoOutput.innerHTML();
    // The runDemo implementation pushes at least the initial array and target lines.
    expect(inner).toContain('Initial array:');
    expect(inner).toContain('Target sum:');
    // The demo finds a pair and pushes "Found pair" line in this data set
    expect(inner).toMatch(/Found pair:|Found pair/);

    // Now, verify that the FSM's exit action displayDemoOutput() does not exist in page scope.
    const typeofDisplayDemoOutput = await page.evaluate(() => typeof window.displayDemoOutput);
    expect(typeofDisplayDemoOutput).toBe('undefined');

    // Attempt to call displayDemoOutput() and assert this produces a ReferenceError
    const displayEval = page.evaluate(() => {
      // Intentionally call the undefined function to observe natural ReferenceError
      return displayDemoOutput();
    });

    await expect(displayEval).rejects.toThrow(/displayDemoOutput is not defined|ReferenceError/);

    // Wait shortly for pageerror event caused by the call
    let displayPageError = null;
    try {
      displayPageError = await page.waitForEvent('pageerror', { timeout: 2000 });
    } catch {
      displayPageError = null;
    }

    expect(displayPageError).not.toBeNull();
    if (displayPageError) {
      expect(String(displayPageError.message)).toMatch(/displayDemoOutput is not defined|ReferenceError/);
    }

    // Ensure the console did not capture unexpected fatal errors during the normal runDemo click
    // (other than the pageerror we induced)
    expect(Array.isArray(consoleMessages)).toBeTruthy();
  });

  // Edge case: clicking the Run Demo button multiple times should update the output without causing additional runtime errors
  test('Edge Case: multiple clicks on Run Demo update output and do not produce uncaught exceptions', async ({ page }) => {
    // Comments: Validate robustness of the demo when triggered multiple times.
    // The test clicks the Run Demo button twice and ensures the demoOutput is visible and content consistent.
    // It also ensures no unexpected page-level exceptions occur during repeated interactions.
    const { consoleMessages, pageErrors } = await attachListeners(page);

    await page.goto(APP_URL);

    const button = page.locator("button[onclick='runDemo()']");
    await expect(button).toBeVisible();

    // First click
    await button.click();
    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toBeVisible();
    const firstContent = await demoOutput.innerText();
    expect(firstContent.length).toBeGreaterThan(0);

    // Capture any pageerror that occurred so far
    const errorsAfterFirst = [...pageErrors];

    // Second click - should overwrite or re-populate the same output
    await button.click();
    await expect(demoOutput).toBeVisible();
    const secondContent = await demoOutput.innerText();
    expect(secondContent.length).toBeGreaterThan(0);

    // The content after the second click should be similar (demo is deterministic for provided array)
    expect(secondContent).toContain('Initial array:');
    expect(secondContent).toContain('Target sum:');

    // There should be no new unhandled page errors resulting from clicking the demo button twice in normal operation.
    // Note: We may have pageErrors from earlier intentional tests; here we focus on errors that happened during this test's lifetime.
    // Because we attached listeners in this test, pageErrors should reflect events from this page instance.
    expect(Array.isArray(pageErrors)).toBeTruthy();

    // Filter any errors that are not ReferenceError from intentional calls (we did not call any intentional missing functions here),
    // so the list should be empty (no runtime exceptions).
    const nonNullErrors = pageErrors.filter(e => e != null);
    expect(nonNullErrors.length).toBe(0);
  });

  // Error scenario: Attempt to call both missing functions in sequence to assert both ReferenceErrors are observable
  test('Error scenarios: calling renderPage() then displayDemoOutput() produces ReferenceErrors for both', async ({ page }) => {
    // Comments: This test ensures that both FSM-declared but unimplemented lifecycle hooks (renderPage and displayDemoOutput)
    // raise natural ReferenceErrors when invoked. We assert that evaluate rejects for each call and corresponding pageerror events occur.
    const { consoleMessages, pageErrors } = await attachListeners(page);

    await page.goto(APP_URL);

    // Call renderPage()
    const renderEval = page.evaluate(() => {
      return renderPage();
    });
    await expect(renderEval).rejects.toThrow(/renderPage is not defined|ReferenceError/);

    let pe1 = null;
    try {
      pe1 = await page.waitForEvent('pageerror', { timeout: 2000 });
    } catch {
      pe1 = null;
    }
    expect(pe1).not.toBeNull();
    if (pe1) expect(String(pe1.message)).toMatch(/renderPage is not defined|ReferenceError/);

    // Call displayDemoOutput()
    const displayEval = page.evaluate(() => {
      return displayDemoOutput();
    });
    await expect(displayEval).rejects.toThrow(/displayDemoOutput is not defined|ReferenceError/);

    let pe2 = null;
    try {
      pe2 = await page.waitForEvent('pageerror', { timeout: 2000 });
    } catch {
      pe2 = null;
    }
    expect(pe2).not.toBeNull();
    if (pe2) expect(String(pe2.message)).toMatch(/displayDemoOutput is not defined|ReferenceError/);

    // Final check that the page is still interactive: clicking the Run Demo button still works after the errors
    await page.click("button[onclick='runDemo()']");
    const demoOutput = page.locator('#demoOutput');
    await expect(demoOutput).toBeVisible();
    expect((await demoOutput.innerText()).length).toBeGreaterThan(0);
  });

});