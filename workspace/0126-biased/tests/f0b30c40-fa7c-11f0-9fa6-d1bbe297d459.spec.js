import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b30c40-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page object for the demo page to encapsulate common operations
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator("button[onclick='runSubsetDemo()']");
    this.output = page.locator('#demo-output');
    this.pre = this.output.locator('pre');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getOutputHTML() {
    return await this.output.innerHTML();
  }

  async getOutputText() {
    return await this.output.textContent();
  }

  // Returns array of lines inside the <pre> block (subsets)
  async getPreLines() {
    const hasPre = await this.pre.count();
    if (!hasPre) return [];
    const preText = await this.pre.textContent();
    if (!preText) return [];
    return preText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  }

  // Returns the "Total subsets generated" paragraph text if present
  async getTotalText() {
    const html = await this.getOutputHTML();
    // naive parse: get last <p> contents
    // Use DOM inside page to get exact node
    return await this.page.evaluate(() => {
      const out = document.getElementById('demo-output');
      if (!out) return null;
      const pNodes = out.querySelectorAll('p');
      if (!pNodes.length) return null;
      return pNodes[pNodes.length - 1].textContent;
    });
  }

  async waitForGeneratingText() {
    await this.page.waitForSelector('#demo-output >> text=Generating all subsets of [1, 2, 3] using backtracking:', { timeout: 2000 });
  }
}

test.describe('Backtracking: Subset Generation Demo (FSM Coverage)', () => {
  // Capture console messages and page errors for assertions across tests
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // record console messages for later inspection
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // capture unhandled page errors
      pageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // remove listeners to avoid leaking between tests (Playwright auto-cleans page on navigation but we do this defensively)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('Initial Idle state: page renders with Run button and empty demo output', async ({ page }) => {
    // Validate S0_Idle state presence
    // This test ensures the page loads and the expected UI elements for the Idle state are present.
    const demo = new DemoPage(page);
    await demo.goto();

    // Button should exist and have expected text (evidence of S0_Idle)
    await expect(demo.runButton).toHaveCount(1);
    await expect(demo.runButton).toHaveText('Run Subset Generation Demo');

    // The demo output container should exist and be empty or contain only whitespace initially
    await expect(demo.output).toHaveCount(1);
    const initialHTML = await demo.getOutputHTML();
    // The initial innerHTML is expected to be empty string based on implementation
    expect(initialHTML.trim()).toBe('');

    // There should be no unhandled page errors on initial load
    expect(pageErrors.length).toBe(0);

    // Optionally record console messages are benign (no error-level console messages)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoRunning -> S2_DemoCompleted: clicking Run Subset Generation Demo produces expected output', async ({ page }) => {
    // This test validates the click event (RunSubsetDemo) and subsequent demo output (Demo Running and Demo Completed states).
    const demo = new DemoPage(page);
    await demo.goto();

    // Click the run button to trigger runSubsetDemo() (FSM transition RunSubsetDemo)
    await demo.clickRun();

    // Wait for the generating message to appear (evidence of entering Demo Running)
    await demo.waitForGeneratingText();

    // Verify the generating message is present inside the demo output
    const outputText = await demo.getOutputText();
    expect(outputText).toContain('Generating all subsets of [1, 2, 3] using backtracking:');

    // Verify the subsets listing (<pre>) exists and contains 8 lines (subsets)
    const preLines = await demo.getPreLines();
    // The algorithm pushes the empty subset first and should produce 8 subsets total for [1,2,3]
    expect(preLines.length).toBe(8);

    // Expected subset textual representations (order matches the backtrack traversal in the implementation)
    const expectedSubsets = [
      '[∅]',
      '[1]',
      '[1, 2]',
      '[1, 2, 3]',
      '[1, 3]',
      '[2]',
      '[2, 3]',
      '[3]'
    ];
    // Compare normalized forms: remove extra spaces and ensure those expected substrings occur in the same order
    const normalizedPreLines = preLines.map(l => l.replace(/\s+/g, ' ').trim());
    for (let i = 0; i < expectedSubsets.length; i++) {
      expect(normalizedPreLines[i]).toBe(expectedSubsets[i]);
    }

    // Verify the total count paragraph exists and reports 8 subsets (evidence of S2_DemoCompleted)
    const totalText = await demo.getTotalText();
    expect(totalText).toBe('Total subsets generated: 8 (2^3 = 8)'.replace('^', '^')); // ensure presence
    expect(totalText).toContain('Total subsets generated: 8');

    // There should be no unhandled page errors during normal demo execution
    expect(pageErrors.length).toBe(0);

    // And there should be no console.error messages logged during the demo (indicates clean run)
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });

  test('Clicking Run multiple times resets and re-runs the demo without duplicating results', async ({ page }) => {
    // This edge case verifies idempotency/behavior when the Run button is pressed multiple times.
    const demo = new DemoPage(page);
    await demo.goto();

    // First run
    await demo.clickRun();
    await demo.waitForGeneratingText();
    const firstPreLines = await demo.getPreLines();
    expect(firstPreLines.length).toBe(8);
    const firstTotal = await demo.getTotalText();
    expect(firstTotal).toContain('Total subsets generated: 8');

    // Capture console and page errors count after first run
    const errorsAfterFirstRun = pageErrors.length;
    const consoleErrorsAfterFirstRun = consoleMessages.filter(m => m.type === 'error').length;

    // Run again
    await demo.clickRun();
    await demo.waitForGeneratingText();

    // After second run, ensure the pre contains 8 lines again (not accumulated duplicates)
    const secondPreLines = await demo.getPreLines();
    expect(secondPreLines.length).toBe(8);

    // The total line should still be present once and report 8
    const secondTotal = await demo.getTotalText();
    expect(secondTotal).toContain('Total subsets generated: 8');

    // Ensure running again did not introduce new unhandled page errors
    expect(pageErrors.length).toBe(errorsAfterFirstRun);

    // Ensure console error count didn't increase
    const consoleErrorsNow = consoleMessages.filter(m => m.type === 'error').length;
    expect(consoleErrorsNow).toBe(consoleErrorsAfterFirstRun);
  });

  test('FSM-declared entry/exit functions that are not implemented produce ReferenceError when invoked from page context', async ({ page }) => {
    // The FSM mentions entry action renderPage() for S0_Idle and exit_action clearDemoOutput() for S1_DemoRunning.
    // These functions are not implemented in the provided HTML. As per the test requirement, we should let
    // ReferenceError occur naturally and assert that these errors occur when attempting to call them.

    const demo = new DemoPage(page);
    await demo.goto();

    // Attempt to call renderPage() - expected to throw (renderPage is not defined)
    await expect(page.evaluate(() => {
      // Intentionally call a function that does not exist on the page to observe ReferenceError
      // We return the call so that the page.evaluate promise rejects if it throws.
      return renderPage();
    })).rejects.toThrow(/renderPage is not defined|renderPage is not a function/i);

    // Attempt to call clearDemoOutput() - expected to throw (clearDemoOutput is not defined)
    await expect(page.evaluate(() => {
      return clearDemoOutput();
    })).rejects.toThrow(/clearDemoOutput is not defined|clearDemoOutput is not a function/i);
  });

  test('Observe console logs and page errors while exercising the demo: ensure no unexpected runtime errors', async ({ page }) => {
    // This test focuses on capturing console and pageerror events while interacting with the app.
    const demo = new DemoPage(page);
    await demo.goto();

    // Interact with the page: run demo and wait for output
    await demo.clickRun();
    await demo.waitForGeneratingText();

    // Collect a snapshot of console messages and page errors
    // There should be no page errors produced by the working demo implementation
    expect(pageErrors.length).toBe(0);

    // Verify console messages do not contain uncaught exception logs
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);

    // There should be at least one informational console entry or none; we don't require specific logs,
    // but ensure the arrays are accessible and recorded (sanity).
    expect(Array.isArray(consoleMessages)).toBe(true);
  });
});