import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25ca29a2-fa7c-11f0-ba20-415c525382ea.html';

/**
 * Page Object for the Jump Search Demo page.
 * Encapsulates common locators and interactions to keep tests readable.
 */
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#run-demo-btn');
    this.output = page.locator('#demo-output');
  }

  // Clicks the Run Demo button.
  async clickRun() {
    await this.button.click();
  }

  // Returns the raw text content of the demo output.
  async getOutputText() {
    const txt = await this.output.textContent();
    return txt === null ? '' : txt;
  }

  // Returns whether the run button is disabled.
  async isButtonDisabled() {
    return await this.button.isDisabled();
  }

  // Waits until the demo completion text (finding 37) appears.
  async waitForCompletion(timeout = 5000) {
    await this.page.waitForFunction(
      () => {
        const el = document.getElementById('demo-output');
        if (!el) return false;
        return el.textContent && el.textContent.includes('Found 37 at index 7');
      },
      {},
      { timeout }
    );
    // Ensure Playwright's locator is updated
    await expect(this.output).toContainText('Found 37 at index 7', { timeout });
  }
}

test.describe('Understanding Jump Search - FSM behavioral tests (Application ID: 25ca29a2-fa7c-11f0-ba20-415c525382ea)', () => {
  let consoleMessages;
  let pageErrors;
  let demoPage;

  // Setup: track console messages and page errors, navigate to the page, instantiate the page object.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // capture console messages (type and text) for inspection in assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // capture runtime errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    await page.goto(APP_URL);
    demoPage = new DemoPage(page);

    // Basic sanity checks on initial load (Idle state expected)
    await expect(demoPage.button).toBeVisible();
    await expect(demoPage.button).toBeEnabled();
    await expect(demoPage.output).toBeVisible();
  });

  test.afterEach(async () => {
    // After each test we assert that no unexpected runtime errors occurred.
    // The FSM / app implementation should not trigger page errors in normal operation.
    expect(pageErrors.length).toBe(0);
  });

  test('Initial Idle state: page renders the Run Demo button and empty output', async () => {
    // This test validates FSM state: S0_Idle (initial)
    // - Entry action: renderPage() is expected by FSM (page content is present)
    // - Evidence: Run Demo button exists and demo output is empty
    const outputText = await demoPage.getOutputText();
    expect(outputText.trim()).toBe(''); // demo output starts empty

    // Button should match the label from the FSM
    await expect(demoPage.button).toHaveText('Run Demo: Search for 37');

    // No runtime errors should have occurred up to this point
    expect(pageErrors.length).toBe(0);

    // Console should not contain error-level messages (info/debug ok)
    const errorConsoleEntries = consoleMessages.filter(msg => msg.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoRunning on Run Demo click: output shows running and button is disabled', async () => {
    // This test validates the transition triggered by RunDemoClick
    // Actions on transition: btn.disabled = true; output.textContent = 'Running Jump Search...\n\n';
    // Verify that these observables occur immediately after the click.

    // Click the run button to start the demo
    await demoPage.clickRun();

    // Immediately after clicking:
    // - Button should be disabled (exit action)
    await expect(demoPage.button).toBeDisabled();

    // - Output should contain the "Running Jump Search..." message as per entry action of S1
    const out = await demoPage.getOutputText();
    expect(out).toContain('Running Jump Search...');
    // The implementation writes two newlines after the message; ensure message present.
    expect(out).toMatch(/Running Jump Search\.\.\.\s*/);

    // Check that no runtime errors were emitted by the click handler synchronously
    expect(pageErrors.length).toBe(0);

    // Also check console for error messages produced synchronously (there should be none)
    const errorConsoleEntries = consoleMessages.filter(msg => msg.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
  });

  test('Transition S1_DemoRunning -> S2_DemoCompleted: demo finishes and shows step-by-step output; button re-enabled', async () => {
    // This test validates the demo completes and the entry actions of S2_DemoCompleted execute:
    // output.textContent = result.steps.join('\n'); btn.disabled = false;

    // Start the demo
    await demoPage.clickRun();

    // Wait for the demo to complete (script uses setTimeout 100ms, allow generous timeout)
    await demoPage.waitForCompletion(3000);

    // After completion, the output should include the detailed steps and final "Found 37 at index 7."
    const finalOutput = await demoPage.getOutputText();

    // Check for expected jump steps (evidence lines from the FSM and implementation)
    expect(finalOutput).toContain('Jumping to index 2 (value: 12)');
    expect(finalOutput).toContain('Jumping to index 5 (value: 29)');
    expect(finalOutput).toContain('Linear searching between indexes 6 and 8');
    expect(finalOutput).toContain('Checking index 7 (value: 37)');
    expect(finalOutput).toContain('Found 37 at index 7.');

    // Button should be re-enabled after demo completes
    await expect(demoPage.button).toBeEnabled();

    // No runtime errors should have been emitted during the asynchronous demo
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: multiple sequential runs produce consistent results and toggle button state each run', async () => {
    // This test validates repeated transitions:
    // S0_Idle -> S1_DemoRunning -> S2_DemoCompleted -> S1_DemoRunning -> S2_DemoCompleted
    // Ensure multiple runs work, button toggles each time, and no runtime errors occur.

    // First run
    await demoPage.clickRun();
    await demoPage.waitForCompletion(3000);
    const firstOutput = await demoPage.getOutputText();
    expect(firstOutput).toContain('Found 37 at index 7.');
    await expect(demoPage.button).toBeEnabled();

    // Second run: click again to re-run the demo
    await demoPage.clickRun();

    // After clicking, should immediately show running text and button disabled
    await expect(demoPage.button).toBeDisabled();
    const runningText = await demoPage.getOutputText();
    expect(runningText).toContain('Running Jump Search...');

    // Wait for completion again
    await demoPage.waitForCompletion(3000);
    const secondOutput = await demoPage.getOutputText();
    expect(secondOutput).toContain('Found 37 at index 7.');
    await expect(demoPage.button).toBeEnabled();

    // Outputs from both runs should be similar and contain the expected steps
    expect(secondOutput).toContain('Linear searching between indexes 6 and 8');
    expect(firstOutput).toContain('Linear searching between indexes 6 and 8');

    // Ensure no runtime errors across the repeated runs
    expect(pageErrors.length).toBe(0);

    // And no console.error messages observed
    const errorConsoleEntries = consoleMessages.filter(msg => msg.type === 'error');
    expect(errorConsoleEntries.length).toBe(0);
  });

  test('Edge case: attempting to click while button is disabled should not cause runtime errors', async ({ page }) => {
    // Start the demo so the button becomes disabled
    await demoPage.clickRun();

    // Confirm it's disabled
    await expect(demoPage.button).toBeDisabled();

    // Attempt to click the disabled button programmatically.
    // Depending on Playwright and browser behaviors, this click may reject.
    // We assert that either:
    // - the click is rejected (Playwright throws because the element is disabled), OR
    // - the click does nothing (no additional side effects), but either way no runtime page errors should be produced.
    let clickRejected = false;
    try {
      // Short timeout so the call fails fast if it's going to block.
      await page.click('#run-demo-btn', { timeout: 500 });
    } catch (err) {
      clickRejected = true;
      // Ensure the error is expected to be due to actionability/disabled element; do not be overly strict on message text
      expect(err).toBeInstanceOf(Error);
    }

    // Wait for the demo to finish normally regardless of the click attempt
    await demoPage.waitForCompletion(3000);

    // After completion, ensure no runtime page errors were recorded
    expect(pageErrors.length).toBe(0);

    // The test accepts either behavior (rejected click or ignored click) as long as it caused no runtime errors
    expect([true, false]).toContain(clickRejected);
  });
});