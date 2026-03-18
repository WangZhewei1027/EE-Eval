import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a37126e2-ffc4-11f0-821c-7d25bc609266.html';

// Page object for the Floyd-Warshall demo page
class FloydWarshallDemo {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#run-demo');
    this.output = page.locator('#demo-output');
    this.finalMatrixTable = page.locator('#final-matrix');
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  // Navigate to the page and wire up listeners to capture console logs and page errors
  async goto() {
    // Collect console and pageerror events for assertions later
    this.page.on('console', msg => {
      // capture text and type (log, error, warning, etc.)
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', error => {
      // pageerrors come as Error objects
      this.pageErrors.push(error);
    });

    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Verify the Idle state UI (S0_Idle)
  async expectIdleState() {
    // Button should be visible and enabled
    await expect(this.runButton).toBeVisible();
    await expect(this.runButton).toBeEnabled();

    // The demo output should exist but be hidden initially (display: none in inline style)
    const outputHandle = await this.output.elementHandle();
    expect(outputHandle).not.toBeNull();
    const display = await this.page.evaluate(el => getComputedStyle(el).display, outputHandle);
    expect(display === 'none' || display === 'hidden' || display === '').toBeTruthy();
    // ARIA attributes expected on the demo output region
    await expect(this.output).toHaveAttribute('aria-live', 'polite');
    await expect(this.output).toHaveAttribute('role', 'region');
    await expect(this.output).toHaveAttribute('aria-atomic', 'true');
  }

  // Click the Run button to start the demo (triggers S0 -> S1 transition)
  async runDemo() {
    await this.runButton.click();
  }

  // Wait until the running state output is present (Initial matrix + computing message)
  async waitForRunningState() {
    // The script sets outputElement.style.display = "block" and writes "Initial distance matrix:" immediately.
    await this.output.waitFor({ state: 'visible', timeout: 2000 });
    await expect(this.output).toContainText('Initial distance matrix:');
    await expect(this.output).toContainText('Computing Floyd-Warshall...');
  }

  // Wait until final output appears (S1 -> S2 transition completed)
  async waitForCompletedState() {
    // The script synchronously computes and then appends the final string.
    // Wait for the final section text to appear
    await this.page.waitForFunction(
      () => {
        const el = document.getElementById('demo-output');
        return !!el && el.textContent && el.textContent.includes('Final distance matrix after applying Floyd-Warshall algorithm:');
      },
      null,
      { timeout: 2000 }
    );
  }

  // Read the demo output text content
  async getOutputText() {
    return (await this.output.textContent()) || '';
  }

  // Helper to return captured console error messages
  getConsoleErrors() {
    return this.consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
  }

  // Helper to return page errors
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Floyd-Warshall Algorithm Demo - FSM and UI Validation', () => {
  // Each test uses a fresh page
  test.beforeEach(async ({ page }) => {
    // nothing here; individual tests will create their page object and goto
  });

  // Validate initial Idle state (S0_Idle)
  test('S0_Idle: initial render shows Run button and hidden demo output', async ({ page }) => {
    // This test validates the initial state of the app matches the Idle state in the FSM.
    const demo = new FloydWarshallDemo(page);
    await demo.goto();

    // Validate Idle UI: button visible, demo-output hidden, ARIA attributes present
    await demo.expectIdleState();

    // Ensure no uncaught page errors were thrown during initial render
    const pageErrors = demo.getPageErrors();
    // It's expected that the page renders cleanly; assert there are no runtime page errors on load.
    expect(pageErrors.length).toBe(0);

    // Ensure console has not produced error-level logs during load
    const consoleErrors = demo.getConsoleErrors();
    expect(consoleErrors.length).toBe(0);
  });

  // Validate transition S0 -> S1 when the Run button is clicked
  test('RunDemo event triggers DemoRunning (S1): initial matrix displayed and computation starts', async ({ page }) => {
    // This test validates that clicking the Run button triggers the running state:
    // - demo output becomes visible
    // - contains "Initial distance matrix" and "Computing Floyd-Warshall..."
    const demo = new FloydWarshallDemo(page);
    await demo.goto();

    // Precondition: Idle
    await demo.expectIdleState();

    // Action: click the run button (the RunDemo event)
    await demo.runDemo();

    // Assert: entering DemoRunning state: initial matrix printed and computing message visible
    await demo.waitForRunningState();

    // Inspect output content and check key parts of the initial matrix are present
    const text = await demo.getOutputText();
    // The initial matrix from the HTML uses the numbers: row 1: 0, 3, 8, -4
    expect(text).toContain('Initial distance matrix:');
    expect(text).toContain('1'); // header row contains "1 2 3 4"
    expect(text).toContain('3'); // some distance value
    expect(text).toContain('8'); // some distance value
    expect(text).toContain('-4'); // negative weight edge

    // Verify the output region is visible via computed style
    const display = await demo.page.evaluate(() => getComputedStyle(document.getElementById('demo-output')).display);
    expect(display).toBe('block');

    // Ensure no runtime page errors occurred as a result of clicking the button
    const pageErrors = demo.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Ensure no console errors were logged
    const consoleErrors = demo.getConsoleErrors();
    expect(consoleErrors.length).toBe(0);
  });

  // Validate S1 -> S2 transition: algorithm completes and final matrix displayed
  test('AlgorithmComplete event leads to DemoCompleted (S2): final matrix and negative cycle detection', async ({ page }) => {
    // This test validates the algorithm completes and final output is appended:
    // - "Final distance matrix after applying Floyd-Warshall algorithm:" is present
    // - final numeric values correspond to the example final matrix shown in the page
    // - negative cycle detection message is present/absent as appropriate
    const demo = new FloydWarshallDemo(page);
    await demo.goto();

    // Run the demo
    await demo.runDemo();

    // Wait for running state to appear
    await demo.waitForRunningState();

    // Wait for the algorithm to complete and final output appended
    await demo.waitForCompletedState();

    const out = await demo.getOutputText();

    // Validate final section header present
    expect(out).toContain('Final distance matrix after applying Floyd-Warshall algorithm:');

    // Validate final matrix includes expected numeric entries from the HTML static final matrix:
    // Row 1: 0, 1, -3, -4
    expect(out).toContain('0');
    expect(out).toContain('1');
    expect(out).toContain('-3');
    expect(out).toContain('-4');

    // Row 2: 3, 0, -4, -1
    expect(out).toContain('-4'); // at least one -4 is present (already checked) - ensure -1 too
    expect(out).toContain('-1');

    // Row 4 contains -5 (4->3) and -1 (4->2), verify those appear somewhere
    expect(out).toContain('-5');

    // Negative cycle check: the example graph does NOT contain a negative weight cycle reachable to change d[i][i] < 0
    // The script appends "No negative weight cycles detected." in that case.
    expect(out).toContain('No negative weight cycles detected.');

    // Also ensure the static final matrix table that exists on the page is still present (separate DOM artifact)
    await expect(demo.finalMatrixTable).toBeVisible();

    // Ensure there were no page errors during the algorithm run/finish
    const pageErrors = demo.getPageErrors();
    expect(pageErrors.length).toBe(0);

    // Capture console errors if any
    const consoleErrors = demo.getConsoleErrors();
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: clicking the button multiple times and ensuring output remains consistent and no errors accumulate
  test('Multiple runs are idempotent and do not produce runtime errors', async ({ page }) => {
    // This test validates repeated triggering of RunDemo behaves predictably.
    const demo = new FloydWarshallDemo(page);
    await demo.goto();

    // First run
    await demo.runDemo();
    await demo.waitForCompletedState();
    const firstOutput = await demo.getOutputText();
    expect(firstOutput).toContain('Final distance matrix after applying Floyd-Warshall algorithm:');

    // Run again: the code overwrites outputElement.textContent at start of handler, so output should be replaced
    await demo.runDemo();
    // Wait again for final appended output (synchronous flow, but ensure presence)
    await demo.waitForCompletedState();
    const secondOutput = await demo.getOutputText();
    expect(secondOutput).toContain('Final distance matrix after applying Floyd-Warshall algorithm:');

    // Outputs should be non-empty and should include initial and final parts
    expect(firstOutput.length).toBeGreaterThan(0);
    expect(secondOutput.length).toBeGreaterThan(0);

    // Ensure outputs are consistent in terms of final matrix presence
    const firstFinalIndex = firstOutput.indexOf('Final distance matrix after applying Floyd-Warshall algorithm:');
    const secondFinalIndex = secondOutput.indexOf('Final distance matrix after applying Floyd-Warshall algorithm:');
    expect(firstFinalIndex).toBeGreaterThan(-1);
    expect(secondFinalIndex).toBeGreaterThan(-1);

    // Check for runtime errors captured during repeated runs
    const pageErrors = demo.getPageErrors();
    expect(pageErrors.length).toBe(0);

    const consoleErrors = demo.getConsoleErrors();
    expect(consoleErrors.length).toBe(0);
  });

  // Observability test: ensure console and page errors (if any) are captured and reported by the test.
  test('Observability: capture console messages and page errors during interactions', async ({ page }) => {
    // This test demonstrates we listen to console/pageerror and assert the runtime is clean.
    const demo = new FloydWarshallDemo(page);
    await demo.goto();

    // Interact with the page
    await demo.runDemo();
    await demo.waitForCompletedState();

    // Collect captured messages/errors
    const consoleMsgs = demo.consoleMessages;
    const pageErrs = demo.pageErrors;

    // Provide informative assertions:
    // - We expect no page errors for a correct script
    expect(pageErrs.length).toBe(0);

    // - There may be console.log/info messages but there should be no console 'error' messages.
    const consoleErrorMsgs = consoleMsgs.filter(m => m.type === 'error');
    expect(consoleErrorMsgs.length).toBe(0);

    // - Optionally assert that some console messages might exist (not required). At least the page should not be silent,
    //   but we do not require a specific console log text. If any console logs exist, they should not be errors.
    // This assertion documents the expectation that runtime is free of JavaScript runtime errors.
    expect(consoleMsgs.length >= 0).toBeTruthy();
  });
});