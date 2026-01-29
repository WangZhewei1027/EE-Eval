import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25c9db82-fa7c-11f0-ba20-415c525382ea.html';

/**
 * Page Object for the Quick Sort demo page.
 * Encapsulates common selectors and interactions.
 */
class QuickSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#demoButton';
    this.outputSelector = '#demoOutput';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the DOM is present
    await this.page.waitForSelector(this.buttonSelector);
    await this.page.waitForSelector(this.outputSelector);
  }

  async getButton() {
    return this.page.locator(this.buttonSelector);
  }

  async getOutput() {
    return this.page.locator(this.outputSelector);
  }

  async getOutputText() {
    return this.page.locator(this.outputSelector).textContent();
  }

  // Click the demo button (Playwright will respect the element state)
  async clickDemoButton() {
    await this.page.click(this.buttonSelector);
  }

  // Force-set output text (used to validate clearOutput() behavior)
  async setOutputText(text) {
    await this.page.evaluate(
      ({ selector, text }) => {
        const el = document.querySelector(selector);
        if (el) el.textContent = text;
      },
      { selector: this.outputSelector, text }
    );
  }

  // Returns true/false if the button is disabled
  async isButtonDisabled() {
    return this.page.evaluate(selector => {
      const el = document.querySelector(selector);
      return el ? Boolean(el.disabled) : null;
    }, this.buttonSelector);
  }

  // Wait until the demo output contains a given substring
  async waitForOutputContains(substring, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && typeof el.textContent === 'string' && el.textContent.includes(substr);
      },
      this.outputSelector,
      substring,
      { timeout }
    );
  }
}

test.describe('Quick Sort Demo FSM - Application 25c9db82-fa7c-11f0-ba20-415c525382ea', () => {
  // Arrays to capture console and page errors for each test
  /** @type {Array<import('@playwright/test').ConsoleMessage>} */
  let consoleMessages;
  /** @type {Array<Error>} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture all console messages for inspection (info, log, error, etc.)
    page.on('console', msg => {
      consoleMessages.push(msg);
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
  });

  test('Idle state: initial render shows demo button and empty output', async ({ page }) => {
    // This test validates the S0_Idle state (initial state)
    const qs = new QuickSortPage(page);
    await qs.goto();

    // Validate the button exists, is visible, enabled, and has expected attributes/text.
    const button = qs.getButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveCount(1);
    await expect(button).toHaveAttribute('id', 'demoButton');
    await expect(button).toHaveAttribute('aria-label', 'Run Quick Sort Demo');
    await expect(button).toHaveText('Run Quick Sort Demo');

    const isDisabled = await qs.isButtonDisabled();
    expect(isDisabled).toBe(false);

    // Validate the demo output exists and is initially empty (evidence of renderPage())
    const outputText = await qs.getOutputText();
    // outputText may be '' or null depending on implementation; assert that it's empty string or null treated as empty
    expect(outputText === '' || outputText === null).toBeTruthy();

    // Ensure no page errors or console error messages have occurred during initial render
    // We capture and assert no page errors like ReferenceError/SyntaxError/TypeError occurred
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMessages.filter(m => m.type() === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Transition Idle -> DemoRunning -> DemoCompleted: runs demo and displays sorted array', async ({ page }) => {
    // This test covers transitions from S0_Idle -> S1_DemoRunning -> S2_DemoCompleted
    // It checks entry actions (clearOutput, initializeArray, startQuickSortDemo) and final displaySortedArray.

    const qs = new QuickSortPage(page);
    await qs.goto();

    // Pre-fill the output to validate clearOutput() actually clears existing content when demo starts.
    await qs.setOutputText('PREVIOUS OUTPUT - SHOULD BE CLEARED');

    // Ensure pre-filled content is present
    const preText = await qs.getOutputText();
    expect(preText).toContain('PREVIOUS OUTPUT');

    // Click the demo button to trigger RunQuickSortDemo event and transition to DemoRunning
    await qs.clickDemoButton();

    // Immediately after click, the handler sets demoOutput.textContent = '' before doing work.
    // Because the demo proceeds synchronously, the final output will be fully populated.
    // We assert that the PREVIOUS OUTPUT was cleared (no longer present)
    const postClickText = await qs.getOutputText();
    expect(postClickText).not.toContain('PREVIOUS OUTPUT');

    // Assert that the initializeArray() is reflected by the presence of the "Initial array" line
    expect(postClickText).toContain('Initial array: [10, 7, 8, 9, 1, 5]');

    // The demo should log partitioning and swap steps in the output as it runs (startQuickSortDemo)
    expect(postClickText).toContain('Partitioning with pivot');
    expect(postClickText).toContain('Swap pivot');

    // Wait (with timeout) for the final "Sorted array" line to appear and assert final sorted sequence.
    await qs.waitForOutputContains('Sorted array: [');
    const finalText = await qs.getOutputText();
    // The original array [10,7,8,9,1,5] should be sorted to [1,5,7,8,9,10]
    expect(finalText).toContain('Sorted array: [1, 5, 7, 8, 9, 10]');

    // Verify exit action disableDemoButton() took effect (button should be disabled in DemoCompleted)
    const buttonDisabled = await qs.isButtonDisabled();
    expect(buttonDisabled).toBe(true);

    // Validate no unexpected JS errors occurred during the demo run
    // We check pageErrors captured and console errors
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMessages.filter(m => m.type() === 'error');
    expect(errorConsoleMsgs.length).toBe(0);

    // Additional assertion: the demo output should be non-empty and contain multiple lines (evidence of steps)
    expect(finalText.length).toBeGreaterThan(20); // arbitrary small sanity check
  });

  test('Edge case: Clicking the disabled button after demo completion does not cause errors or change output', async ({ page }) => {
    // This test validates the behavior and error handling when user attempts to interact after final state.

    const qs = new QuickSortPage(page);
    await qs.goto();

    // Run the demo to completion first
    await qs.clickDemoButton();
    await qs.waitForOutputContains('Sorted array: [');
    const finalTextBefore = await qs.getOutputText();

    // Ensure the button is disabled as part of exit actions
    const disabled = await qs.isButtonDisabled();
    expect(disabled).toBe(true);

    // Attempt to click the (disabled) button. Clicking a disabled button should not fire the handler.
    // We intentionally do the plain page.click to replicate a user attempting to click; it should not throw
    // and should not cause any new page errors.
    await page.click('#demoButton');

    // Small pause to allow any unexpected asynchronous errors to surface (if they were going to)
    await page.waitForTimeout(200);

    const finalTextAfter = await qs.getOutputText();
    // Output should remain unchanged
    expect(finalTextAfter).toBe(finalTextBefore);

    // Assert that no new page errors or console error messages occurred as a result of this interaction
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMessages.filter(m => m.type() === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Robustness: Multiple sequential runs not possible due to disable; validate idempotence and absence of runtime exceptions', async ({ page }) => {
    // This test tries to run through possible error scenarios:
    // - Ensure that the demo cannot be run a second time (button disabled)
    // - Ensure that toggling DOM elements or rapid interactions do not generate runtime exceptions

    const qs = new QuickSortPage(page);
    await qs.goto();

    // Run once
    await qs.clickDemoButton();
    await qs.waitForOutputContains('Sorted array: [');
    const outputAfterFirstRun = await qs.getOutputText();
    expect(outputAfterFirstRun).toContain('Sorted array:');

    // Try to programmatically remove the disabled attribute (simulating external DOM tampering)
    // IMPORTANT: We do not redefine functions or patch logic; we simply mutate DOM to simulate an edge case.
    // This helps test how the app would behave if the button were re-enabled externally.
    await page.evaluate(() => {
      const btn = document.getElementById('demoButton');
      if (btn) btn.removeAttribute('disabled');
    });

    // If the button was re-enabled via DOM tampering, simulate a user click.
    // According to instructions we must not patch or redefine runtime, so if the original click handler relies
    // on internal state that prevents re-run, the app may either run again or throw. We observe behavior.
    await page.click('#demoButton').catch(() => {
      // If Playwright throws because the click is not actionable, swallow to continue assertions.
    });

    // Wait briefly for any potential errors to surface
    await page.waitForTimeout(200);

    // Capture post-tamper output
    const outputAfterTamper = await qs.getOutputText();

    // The application should either:
    //  - have ignored the second click and kept the same output, or
    //  - have produced new output updating the demo.
    // We accept either, but assert that no uncaught exceptions (ReferenceError/SyntaxError/TypeError) were thrown.
    expect(pageErrors.length).toBe(0);
    const errorConsoleMsgs = consoleMessages.filter(m => m.type() === 'error');
    expect(errorConsoleMsgs.length).toBe(0);

    // At minimum, the output should still contain a valid "Sorted array" phrase somewhere
    expect(outputAfterTamper).toContain('Sorted array:');
  });
});