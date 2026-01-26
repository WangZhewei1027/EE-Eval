import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cd8500-fa7c-11f0-ba20-415c525382ea.html';

// Page object for the Type Checker Demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#runDemo');
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getOutputText() {
    return await this.output.innerText();
  }

  async waitForOutputContains(text, options = {}) {
    // Use Playwright's expect with toContain to wait until the output contains the given text
    await expect(this.output).toContainText(text, options);
  }
}

test.describe('Type System Demo (FSM) - 25cd8500-fa7c-11f0-ba20-415c525382ea', () => {
  // Collect console.error and page errors during each test run
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Listen to console messages and collect errors
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Collect uncaught exceptions on the page (pageerror)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the application under test
    const demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // Teardown assertions about console/page errors are performed in a dedicated test below.
    // We keep afterEach minimal to not interfere with captured events.
  });

  test('Initial state (S0_Idle): Run button visible and output is empty', async ({ page }) => {
    // Validate the initial Idle state: the button should be present and demo output empty
    const demo = new DemoPage(page);

    await expect(demo.runButton).toBeVisible();
    await expect(demo.runButton).toHaveAttribute('aria-label', 'Run Type Checker Demo');
    await expect(demo.runButton).toHaveText('Run Type Checker Demo');

    // The demo output region should be present and initially empty (S0_Idle entry action: renderPage())
    await expect(demo.output).toBeVisible();
    const initialText = await demo.getOutputText();
    // Allow whitespace; empty string expected initially
    expect(initialText.trim()).toBe('');
  });

  test('Transition S0 -> S1 (RunDemoClick): immediate "Checking validExpr..." after clicking Run', async ({ page }) => {
    // Clicking the run button should immediately set output.textContent = 'Checking validExpr...'
    const demo = new DemoPage(page);

    await demo.clickRun();

    // The click handler sets the output synchronously before starting the timeouts
    await expect(demo.output).toHaveText('Checking validExpr...');
  });

  test('Transition S1 -> S2 (ValidExpressionChecked): shows type of validExpr and begins invalid check', async ({ page }) => {
    // After the initial "Checking validExpr...", after ~1200ms the output should update to include the type of the valid expression
    const demo = new DemoPage(page);

    await demo.clickRun();

    // Wait (with a timeout) for the valid expression to be checked and the next message to appear
    // The implementation uses setTimeout(..., 1200) before performing the valid check and updating the text.
    await demo.waitForOutputContains('Type of validExpr: Int', { timeout: 3000 });

    // Also assert that it indicates the next step: "Now checking invalid expression..."
    await demo.waitForOutputContains('Now checking invalid expression...', { timeout: 3000 });

    // Validate the combined message shape roughly matches the FSM expected final text in S2
    const out = await demo.getOutputText();
    expect(out).toContain('Type of validExpr: Int');
    expect(out).toContain('Now checking invalid expression...');
  });

  test('Transition S2 -> S3 -> S4 (InvalidExpressionChecked -> ErrorDetected): reports error for invalid expression', async ({ page }) => {
    // The demo runs a second setTimeout (1200ms) to check the invalid expression and appends an error message.
    const demo = new DemoPage(page);

    await demo.clickRun();

    // Wait for the valid expression step to complete first (ensures the sequence is running)
    await demo.waitForOutputContains('Type of validExpr: Int', { timeout: 3000 });

    // Now wait for the final error message appended after the invalid expression check
    // The total delay is roughly 1200ms + 1200ms; allow generous timeout
    await demo.waitForOutputContains('Error detected in invalidExpr:', { timeout: 6000 });

    // The implementation throws an error for an unknown expression type inside invalidExpr.
    // Assert the exact error message as produced by the running page.
    const finalText = await demo.getOutputText();

    // Ensure earliest messages remain present
    expect(finalText).toContain('Checking validExpr...');
    expect(finalText).toContain('Type of validExpr: Int');
    expect(finalText).toContain('Now checking invalid expression...');
    expect(finalText).toContain('Error detected in invalidExpr:');

    // The implementation uses `throw new Error("Unknown expression type: " + expr.type);`
    // So verify that the observed message matches the runtime behavior (we must not change the app code).
    expect(finalText).toMatch(/Unknown expression type: InvalidType/);
  });

  test('Edge case: multiple rapid clicks reset output and re-run the sequence', async ({ page }) => {
    // Clicking the Run button multiple times during the sequence should overwrite the output and start the sequence again.
    const demo = new DemoPage(page);

    // First click: will set "Checking validExpr..."
    await demo.clickRun();
    await expect(demo.output).toHaveText('Checking validExpr...');

    // Rapid second click (simulate user clicking again while demo is running)
    await page.waitForTimeout(100); // small gap
    await demo.clickRun();

    // Output should be reset to "Checking validExpr..." again (the click handler overwrites output.textContent synchronously)
    await expect(demo.output).toHaveText('Checking validExpr...');

    // Allow the sequence to complete and assert final error message appears for the second run as well
    await demo.waitForOutputContains('Error detected in invalidExpr:', { timeout: 7000 });
    const finalText = await demo.getOutputText();
    expect(finalText).toMatch(/Unknown expression type: InvalidType/);
  });

  test('No uncaught page errors and no console.error messages emitted during demo run', async ({ page }) => {
    // This test verifies the environment did not produce uncaught exceptions or console errors while loading and running the demo.
    // Note: The demo intentionally throws an Error inside try/catch; that error is caught and displayed in the DOM.
    // We assert that no uncaught exceptions leaked to the page scope (pageerror) and no console.error messages were emitted.
    const demo = new DemoPage(page);

    // Run the demo to exercise the flows
    await demo.clickRun();

    // Wait long enough for the full sequence to run
    await demo.waitForOutputContains('Error detected in invalidExpr:', { timeout: 7000 });

    // At this point, the consoleErrors and pageErrors arrays were populated via listeners in beforeEach.
    // The correct behavior of this demo is to catch runtime errors and append them to the output rather than letting them bubble up.
    // Therefore, we expect no uncaught page errors and no console.error messages.
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Behavioral assertion comparing FSM expected error vs actual implementation error', async ({ page }) => {
    // The FSM expected the invalid expression to produce a "Type error: Both operands to addition must be Int"
    // But the implemented HTML/JS produces "Unknown expression type: InvalidType" because of the InvalidType node.
    // This test documents that divergence by asserting the actual observed message and also verifying the FSM-expected message is NOT present.
    const demo = new DemoPage(page);

    await demo.clickRun();

    // Wait for final error
    await demo.waitForOutputContains('Error detected in invalidExpr:', { timeout: 7000 });
    const finalText = await demo.getOutputText();

    // Confirm actual runtime message is the 'Unknown expression type' message
    expect(finalText).toMatch(/Unknown expression type: InvalidType/);

    // Assert that the FSM-expected message does not appear (demonstrates a mismatch between spec and implementation).
    expect(finalText).not.toContain('Both operands to addition must be Int');
  });
});