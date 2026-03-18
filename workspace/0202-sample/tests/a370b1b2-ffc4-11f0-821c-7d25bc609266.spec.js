import { test, expect } from '@playwright/test';

// Test file: a370b1b2-ffc4-11f0-821c-7d25bc609266.spec.js
// This suite validates the Priority Queue demo page and the FSM described in the prompt.
// It exercises the Idle -> Extraction In Progress -> Extraction Completed transitions,
// verifies DOM updates and visual feedback, and observes console/page errors.
// Note: Tests load the page exactly as-is and do NOT modify application code.

const APP_URL =
  'http://127.0.0.1:5500/workspace/0202-sample/html/a370b1b2-ffc4-11f0-821c-7d25bc609266.html';

// Simple page object for the demo
class PriorityQueueDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.buttonSelector = '#demoButton';
    this.outputSelector = '#demoOutput';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getButtonHandle() {
    return this.page.$(this.buttonSelector);
  }

  async getButtonText() {
    const el = await this.getButtonHandle();
    return el ? (await el.textContent()).trim() : null;
  }

  async isButtonDisabled() {
    return this.page.$eval(this.buttonSelector, (b) => b.disabled);
  }

  async clickDemoButton() {
    // Use Playwright click; if disabled, clicking will throw — caller should check isButtonDisabled first if desired.
    await this.page.click(this.buttonSelector);
  }

  async getOutputText() {
    return this.page.$eval(this.outputSelector, (el) => el.textContent || '');
  }
}

test.describe('Priority Queue Demo - FSM and UI behavior', () => {
  // Arrays to collect console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  // Setup listeners before each test
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    page.on('console', (msg) => {
      // Collect console messages with type and text
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', (err) => {
      // Capture uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
      pageErrors.push(err);
    });
  });

  // Test Idle state: verify UI renders correctly before interaction
  test('S0_Idle: initial render shows demo button and empty output', async ({ page }) => {
    const demo = new PriorityQueueDemoPage(page);
    // Navigate to the page (load exactly as provided)
    await demo.goto();

    // Verify no page errors on initial load
    expect(pageErrors.length).toBe(0);

    // Button must exist and be enabled in Idle state
    const buttonText = await demo.getButtonText();
    expect(buttonText).toBe('Show Extraction Sequence');

    const disabled = await demo.isButtonDisabled();
    expect(disabled).toBeFalsy();

    // Output area should be present and initially empty
    const outputText = await demo.getOutputText();
    // It may be empty string; assert it's falsy (empty)
    expect(outputText).toBe('');

    // Ensure no console 'error' messages were produced on load
    const errorConsoles = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoles.length).toBe(0);
  });

  // Test the click event and transitions S0 -> S1 and S1 -> S2
  test('ShowExtractionSequence click triggers extraction, disables button, and prints steps', async ({ page }) => {
    const demo = new PriorityQueueDemoPage(page);
    await demo.goto();

    // Ensure Idle precondition
    expect(await demo.isButtonDisabled()).toBe(false);

    // Click the demo button to start the extraction sequence
    // Capture the time before clicking to help reason about synchronous behavior
    await demo.clickDemoButton();

    // After clicking, the implementation disables the button as part of the handler.
    // This verifies the S0 -> S1 exit action (button.disabled = true)
    const disabledAfterClick = await demo.isButtonDisabled();
    expect(disabledAfterClick).toBe(true);

    // The output should contain the full extraction log: initial heap + 5 steps (extracted + heap after each)
    const outputText = await demo.getOutputText();
    expect(typeof outputText).toBe('string');
    expect(outputText.length).toBeGreaterThan(0);

    // Validate specific expected lines per the implementation and FSM evidence
    expect(outputText).toContain('Initial heap array (max-heap): [40,30,15,10,5]');
    expect(outputText).toContain('Step 1: Extracted max = 40');
    expect(outputText).toContain('Heap after extraction: [30,10,15,5]');
    expect(outputText).toContain('Step 5: Extracted max = 5');
    expect(outputText).toContain('Heap after extraction: []');

    // The implementation pushes two lines per extraction plus the initial line.
    // For 5 elements: 1 + 5*2 = 11 lines.
    const lines = outputText.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(lines.length).toBe(11);

    // Verify ordering: initial line should be first, final heap (empty) should be last (after step 5)
    expect(lines[0]).toBe('Initial heap array (max-heap): [40,30,15,10,5]');
    expect(lines[lines.length - 1]).toBe('Heap after extraction: []');

    // No uncaught page errors should have occurred during the click/processing
    expect(pageErrors.length).toBe(0);

    // No console errors either
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: Attempt to click the button again after it's disabled
  test('After extraction completed (S2), button remains disabled and additional clicks do not alter output', async ({ page }) => {
    const demo = new PriorityQueueDemoPage(page);
    await demo.goto();

    // Trigger extraction once
    await demo.clickDemoButton();

    // Confirm disabled
    const isDisabled = await demo.isButtonDisabled();
    expect(isDisabled).toBe(true);

    // Snapshot output after the first run
    const outputAfterFirstRun = await demo.getOutputText();

    // Attempt to click again - Playwright will attempt click, but since element has disabled=true,
    // the page's event listener should not run again (and in many browsers clicking disabled button is a no-op).
    // We still attempt to click to assert that nothing changes on the page.
    try {
      await demo.clickDemoButton();
    } catch (err) {
      // Some browsers/drivers disallow click on disabled elements and throw; this is acceptable.
      // We do not alter page runtime; just proceed to verify that output didn't change.
    }

    // Output should remain exactly the same (no duplicate logs)
    const outputAfterSecondClick = await demo.getOutputText();
    expect(outputAfterSecondClick).toBe(outputAfterFirstRun);

    // Ensure no new page errors were introduced
    expect(pageErrors.length).toBe(0);

    // Ensure no console 'error' messages
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Negative / robustness test: verify page behaves without throwing runtime errors
  test('No uncaught JavaScript errors occur during full demo run', async ({ page }) => {
    const demo = new PriorityQueueDemoPage(page);
    await demo.goto();

    // Clear any earlier logs (within this test we track only new ones)
    // (We reinitialize listeners in beforeEach so arrays are fresh.)

    // Run the demo
    await demo.clickDemoButton();

    // Wait a short time to ensure any synchronous or microtask errors surface
    // (The implementation is synchronous, but this is defensive)
    await page.waitForTimeout(50);

    // Assert no page errors captured
    expect(pageErrors.length).toBe(0);

    // Assert no console errors captured
    const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  // Clean-up note: Playwright automatically closes pages between tests (built-in fixtures).
});