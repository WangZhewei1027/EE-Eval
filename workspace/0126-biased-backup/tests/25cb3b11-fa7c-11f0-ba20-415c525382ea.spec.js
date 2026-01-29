import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cb3b11-fa7c-11f0-ba20-415c525382ea.html';

// Page Object Model for the Two Pointers Demo page
class TwoPointersDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtnSelector = '#runDemoBtn';
    this.outputSelector = '#demo-output';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getRunButton() {
    return this.page.locator(this.runBtnSelector);
  }

  async clickRun() {
    await this.page.click(this.runBtnSelector);
  }

  async isRunButtonDisabled() {
    return this.page.locator(this.runBtnSelector).evaluate((btn) => btn.disabled);
  }

  async getOutputText() {
    return this.page.locator(this.outputSelector).innerText();
  }

  async waitForOutputContains(text, timeout = 15000) {
    await this.page.waitForFunction(
      (selector, expected) => {
        const el = document.querySelector(selector);
        return el && el.textContent.includes(expected);
      },
      this.outputSelector,
      text,
      { timeout }
    );
  }

  async waitForOutputNotContains(text, timeout = 3000) {
    // Wait briefly to ensure a specific message does not appear
    await this.page.waitForTimeout(200); // small delay to let in-flight updates happen
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const txt = await this.getOutputText();
      if (!txt.includes(text)) return;
      // if it includes, break (we want the opposite so we keep checking until timeout)
      await this.page.waitForTimeout(100);
    }
    // After waiting, ensure it's not present
    const final = await this.getOutputText();
    expect(final).not.toContain(text);
  }
}

test.describe('Two Pointers Demo - FSM validation (Application ID: 25cb3b11-fa7c-11f0-ba20-415c525382ea)', () => {
  let page;
  let demoPage;
  let consoleErrors;
  let pageErrors;

  // Setup: new page and listeners to record console errors and page errors
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    demoPage = new TwoPointersDemoPage(page);

    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and page errors for assertions
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    await demoPage.goto();
  });

  // Teardown: close page
  test.afterEach(async () => {
    await page.close();
  });

  // Test the initial Idle state (S0_Idle)
  test('Initial state S0_Idle: page renders Run Two Pointers Demo button and empty output', async () => {
    // Validate the Run button exists and is enabled (Idle state)
    const runBtn = await demoPage.getRunButton();
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toHaveText('Run Two Pointers Demo');
    const disabled = await demoPage.isRunButtonDisabled();
    expect(disabled).toBe(false);

    // Validate output area exists and is empty (no demo output yet)
    const outputText = await demoPage.getOutputText();
    expect(outputText.trim()).toBe('');

    // Ensure no console errors or page errors occurred during initial render
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Test transition S0_Idle -> S1_DemoRunning and validate entry actions
  test('Transition S0_Idle -> S1_DemoRunning: clicking Run disables button and shows starting message', async () => {
    // Click the run button and immediately assert the button becomes disabled (onEnter action)
    await demoPage.clickRun();

    // The button should be disabled immediately by the entry action demoBtn.disabled = true;
    const disabledAfterClick = await demoPage.isRunButtonDisabled();
    expect(disabledAfterClick).toBe(true);

    // The output should start with the starting message
    await demoPage.waitForOutputContains('Starting the Two Pointers demonstration', 2000);
    const output = await demoPage.getOutputText();
    expect(output).toContain('Starting the Two Pointers demonstration');

    // Also ensure that intermediate "Check elements at indices" appears as the demo runs
    // This verifies the demo is running and producing step-by-step text output.
    await demoPage.waitForOutputContains('Check elements at indices', 10000);

    // No unexpected console errors or page errors occurred during demo start
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Test transition S1_DemoRunning -> S2_PairFound and S1 exit action (button re-enabled)
  test('Transition S1_DemoRunning -> S2_PairFound: demo finds the pair and re-enables the button on exit', async () => {
    // Start the demo
    await demoPage.clickRun();

    // Wait for the demo to find the pair (this will occur by design for the provided dataset)
    // The demo finds a pair and outputs: "Sum equals target (...). Pair found: (...)"
    await demoPage.waitForOutputContains('Pair found', 20000);

    // Verify the output includes the expected pair-found message
    const outputText = await demoPage.getOutputText();
    expect(outputText).toMatch(/Pair found: \(\d+,\s*\d+\)/);

    // Ensure that the "Pointers have crossed" message is NOT present in this run
    expect(outputText).not.toContain('Pointers have crossed. No pair found matching the target.');

    // After demo completes, the button should be re-enabled (S1 exit action: demoBtn.disabled = false;)
    // Wait a short moment to allow the final re-enable to occur
    await page.waitForTimeout(100);
    const disabledAfterDemo = await demoPage.isRunButtonDisabled();
    expect(disabledAfterDemo).toBe(false);

    // Ensure no console or page errors happened during the full run
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Edge case: rapid multiple clicks should not start multiple demos (button disabling prevents re-entry)
  test('Edge case: multiple rapid clicks should not start multiple demos or duplicate starting messages', async () => {
    // Click the run button twice in quick succession
    // The second click should not start a second demo because the first click's entry action disables the button
    await demoPage.clickRun();

    // Immediately attempt another click; since the button should be disabled by now,
    // this should not append another "Starting the Two Pointers demonstration..." message.
    // We attempt it programmatically to assert no duplicate start messages appear.
    try {
      // This click may be ignored by the page because the button is disabled; wrap in try/catch to avoid throwing
      await demoPage.clickRun();
    } catch (e) {
      // If Playwright throws because the button is not clickable, that's fine for this test.
    }

    // Wait briefly for the demo to progress
    await demoPage.waitForOutputContains('Check elements at indices', 10000);

    // Count occurrences of the starting message
    const outputText = await demoPage.getOutputText();
    const occurrences = (outputText.match(/Starting the Two Pointers demonstration/g) || []).length;
    expect(occurrences).toBe(1);

    // Wait for pair found to finish the demo
    await demoPage.waitForOutputContains('Pair found', 20000);

    // Ensure no console or page errors occurred
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // FSM completeness: verify NoPairFound state is reachable/not reachable for this dataset.
  test('FSM state S3_NoPairFound: for the provided dataset, NoPairFound message should not appear', async () => {
    // Start demo
    await demoPage.clickRun();

    // Wait for demo to either find a pair or report no pair.
    // For this dataset, it should find a pair; wait for 'Pair found' and assert absence of 'Pointers have crossed' line.
    await demoPage.waitForOutputContains('Pair found', 20000);

    const finalOutput = await demoPage.getOutputText();
    // Confirm the demo reported a pair (S2) and did not report pointers crossing (S3)
    expect(finalOutput).toContain('Pair found');
    expect(finalOutput).not.toContain('Pointers have crossed. No pair found matching the target.');

    // If an implementation had produced the NoPairFound path, the following check would detect it:
    // But for this application/data, the NoPairFound state should not be emitted.
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  // Additional error scenario: ensure no runtime exceptions (ReferenceError/TypeError/SyntaxError) occurred while interacting
  test('Runtime: no uncaught exceptions (ReferenceError/TypeError/SyntaxError) emitted to page', async () => {
    // Interact minimally (load and click)
    await demoPage.clickRun();

    // Wait for demo to produce some output
    await demoPage.waitForOutputContains('Check elements at indices', 10000);

    // Assert we did not observe any page errors or console errors that would indicate ReferenceError/TypeError/SyntaxError
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});