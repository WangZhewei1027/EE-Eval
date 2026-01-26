import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b2e531-fa7c-11f0-9fa6-d1bbe297d459.html';

/**
 * Page Object for the Factorial Demo page.
 * Encapsulates common interactions and queries for the tests below.
 */
class FactorialDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator("button[onclick='runFactorialDemo()']");
    this.output = page.locator('#factorial-demo');
  }

  // Clicks the "Run Factorial Demo" button and waits for the final result to appear.
  async runDemo() {
    await this.button.click();
    // Wait for the final result paragraph to be added.
    await expect(this.output).toContainText('Final result:', { timeout: 2000 });
  }

  // Returns the output area innerText
  async getOutputText() {
    return await this.output.innerText();
  }

  // Convenience: ensures the button exists and is visible
  async expectButtonVisible() {
    await expect(this.button).toBeVisible();
  }

  // Clicks the button without waiting for final result
  async clickWithoutWait() {
    await this.button.click();
  }
}

test.describe('Comprehensive Guide to Recursion - Factorial Demo (FSM validation)', () => {
  // Arrays to collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  // Set up before each test: attach listeners before navigating so we capture load-time issues.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages (log, info, warn, error, etc.)
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture uncaught errors on the page (ReferenceError, TypeError, SyntaxError, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL);
  });

  // Teardown: after each test we keep the listeners but assert nothing here; individual tests assert as needed.
  test.afterEach(async ({ page }) => {
    // No explicit teardown necessary; Playwright closes page per test.
  });

  test('S0_Idle: initial render contains the Run Factorial Demo button and empty output', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) entry evidence:
    // - The page should render and display the Run Factorial Demo button.
    // - The factorial demo output container should exist and be initially empty.
    const demo = new FactorialDemoPage(page);

    // Button should exist and be visible (evidence for S0_Idle)
    await demo.expectButtonVisible();

    // Output container should exist
    await expect(page.locator('#factorial-demo')).toBeVisible();

    // Initially the output should be empty (renderPage entry action expected to have created the DOM)
    const initialText = await demo.getOutputText();
    expect(initialText.trim()).toBe('', 'Expected factorial output to be empty on initial idle render');

    // There should be no page errors during initial render
    expect(pageErrors.length).toBe(0);

    // There should be no console.error messages during initial render
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('RunFactorialDemo event transitions to S1_FactorialDemoRunning and produces expected output', async ({ page }) => {
    // This test exercises the RunFactorialDemo transition:
    // - Click the Run Factorial Demo button
    // - Verify the output includes "Calculating factorial(5)" (FSM expected observable)
    // - Verify recursive steps, base case, and final result are present in the DOM
    const demo = new FactorialDemoPage(page);

    // Pre-check: button exists
    await demo.expectButtonVisible();

    // Click the button and wait for completion
    await demo.runDemo();

    // Grab the output text
    const outputText = await demo.getOutputText();

    // Check for FSM expected observables and evidence lines
    await expect(demo.output).toContainText('Calculating factorial(5)');
    await expect(demo.output).toContainText('Calculating factorial(5) = 5 * factorial(4)');
    await expect(demo.output).toContainText('Calculating factorial(1) = 1 * factorial(0)');
    await expect(demo.output).toContainText('Base case reached: factorial(0) = 1');
    await expect(demo.output).toContainText('Returning factorial(5) = 120');
    await expect(demo.output).toContainText('Final result: 5! = 120');

    // Validate order: "Calculating factorial(5)" (h3) appears before "Base case reached"
    const firstIndex = outputText.indexOf('Calculating factorial(5)');
    const baseIndex = outputText.indexOf('Base case reached: factorial(0) = 1');
    const finalIndex = outputText.indexOf('Final result: 5! = 120');
    expect(firstIndex).toBeGreaterThanOrEqual(0);
    expect(baseIndex).toBeGreaterThan(firstIndex, 'Expected the base case message to appear after the first calculation message');
    expect(finalIndex).toBeGreaterThan(baseIndex, 'Expected the final result to appear after the base case message');

    // No uncaught page errors should have occurred during the run
    const refOrTypeOrSyntax = pageErrors.filter(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name));
    expect(refOrTypeOrSyntax.length).toBe(0, `Expected no ReferenceError/TypeError/SyntaxError, but found: ${refOrTypeOrSyntax.map(e => e.stack).join('\n')}`);

    // No console.error messages produced as a result of running the demo
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: clicking the Run Factorial Demo multiple times resets and re-runs cleanly', async ({ page }) => {
    // This test validates behavior when the user triggers the same transition multiple times:
    // - The output should be cleared at the start of each run (runFactorialDemo sets innerHTML = '')
    // - Only one "Final result" should be present after two successive runs (the last run should overwrite previous)
    const demo = new FactorialDemoPage(page);

    // Click once and wait for completion
    await demo.runDemo();

    // Capture output after first run
    const afterFirstRun = await demo.getOutputText();
    expect(afterFirstRun).toContain('Final result: 5! = 120');

    // Click a second time quickly and wait for completion again
    await demo.runDemo();

    // Capture output after second run
    const afterSecondRun = await demo.getOutputText();
    expect(afterSecondRun).toContain('Final result: 5! = 120');

    // Count occurrences of "Final result" to ensure the output is not duplicated from previous run
    const occurrences = (afterSecondRun.match(/Final result:/g) || []).length;
    expect(occurrences).toBe(1, 'Expected a single final result after re-running the demo (previous run should have been cleared)');

    // Ensure there were no page errors during the repeated runs
    const pageErrorsRelevant = pageErrors.filter(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name));
    expect(pageErrorsRelevant.length).toBe(0);
  });

  test('Programmatic invocation: calling runFactorialDemo() from the page context produces the same output', async ({ page }) => {
    // This test verifies that the S1 entry_action (runFactorialDemo) can be invoked programmatically
    // and yields the same DOM evidence as clicking the button.
    const demo = new FactorialDemoPage(page);

    // Ensure the function exists in global scope
    const hasFunction = await page.evaluate(() => typeof runFactorialDemo === 'function');
    expect(hasFunction).toBe(true);

    // Call the function directly from page context and wait for the output to be updated
    await page.evaluate(() => {
      // Call the existing global function; do not redefine or patch it.
      runFactorialDemo();
    });

    // Verify that the output contains expected evidence (same as the transition)
    await expect(demo.output).toContainText('Calculating factorial(5)');
    await expect(demo.output).toContainText('Base case reached: factorial(0) = 1');
    await expect(demo.output).toContainText('Final result: 5! = 120');

    // Ensure no page errors were thrown
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: capture and assert no unexpected console errors or runtime exceptions occurred during full interaction flow', async ({ page }) => {
    // This test runs the demo and aggregates console messages and page errors, asserting that
    // no unexpected errors (ReferenceError, TypeError, SyntaxError) occurred.
    const demo = new FactorialDemoPage(page);

    // Run the demo once
    await demo.runDemo();

    // Aggregate any console.error messages and page errors
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    const criticalPageErrors = pageErrors.filter(e => ['ReferenceError', 'TypeError', 'SyntaxError'].includes(e.name));

    // Assert no console.error messages were emitted
    expect(errorConsoleMessages.length).toBe(0, `Expected no console.error messages, but found: ${errorConsoleMessages.join(' | ')}`);

    // Assert no critical page errors occurred
    expect(criticalPageErrors.length).toBe(0, `Expected no critical runtime errors, but found: ${criticalPageErrors.map(e => e.stack).join('\n')}`);

    // For completeness, assert that we did receive some informative console logs only if they exist (not required)
    // This is not an assertion of failure; it's informational if logs exist.
    // (No assertion needed here beyond ensuring there are no errors.)
  });
});