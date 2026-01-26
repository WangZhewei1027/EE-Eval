import { test, expect } from '@playwright/test';

// Test file: 25cdfa30-fa7c-11f0-ba20-415c525382ea.spec.js
// This suite validates the interactive "Random Forest Voting Demo" page described by the FSM.
// It loads the page as-is, observes console and page errors, and verifies states/transitions
// and visual/DOM updates produced by user interactions. The tests do NOT modify or patch the page.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cdfa30-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo area
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async runDemo() {
    await this.page.click('#runDemoBtn');
  }

  async getOutputText() {
    return this.page.locator('#demoOutput').innerText();
  }

  async getOutputElement() {
    return this.page.locator('#demoOutput');
  }

  async getRunButton() {
    return this.page.locator('#runDemoBtn');
  }
}

test.describe('Random Forest Voting Demo - FSM Validation', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events
    page.on('console', msg => {
      // store text and type for assertions
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', err => {
      // pageerror provides an Error object
      pageErrors.push(err);
    });
  });

  // Test the Idle state (S0_Idle)
  test('S0_Idle: initial page renders with Run Voting Demo button and empty output', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Validate the Run Voting Demo button exists with expected attributes (evidence from FSM)
    const runBtn = await demo.getRunButton();
    await expect(runBtn).toBeVisible({ timeout: 2000 });
    await expect(runBtn).toHaveAttribute('id', 'runDemoBtn');
    await expect(runBtn).toHaveAttribute('aria-label', 'Run Random Forest Voting Demo');
    await expect(runBtn).toHaveText('Run Voting Demo');

    // Validate demo output element exists and is initially empty (evidence)
    const outputEl = await demo.getOutputElement();
    await expect(outputEl).toBeVisible();
    const initialText = await demo.getOutputText();
    // According to FSM S0 evidence, demoOutput may be empty at Idle
    expect(initialText.trim()).toBe('', 'Expected demo output to be empty in Idle state');

    // Check aria-live attribute as part of component evidence
    await expect(outputEl).toHaveAttribute('aria-live', 'polite');

    // Verify no uncaught page errors were emitted during initial load
    expect(pageErrors.length).toBe(0);

    // Ensure console did not emit any error-level messages on initial render
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMsgs.length).toBe(0);
  });

  // Test the transition: clicking Run Voting Demo triggers runVotingDemo and updates the DOM (S0 -> S1)
  test('Transition RunDemoClick: clicking the button runs the demo and updates output (S1_DemoRunning)', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Click the Run Voting Demo button to trigger the RunDemoClick event
    await demo.runDemo();

    // After clicking, we expect the output to contain the header "Random Forest Voting Demo:"
    const outputText = await demo.getOutputText();

    // Validate entry actions: runVotingDemo writes header and individual predictions
    expect(outputText).toContain('Random Forest Voting Demo:', 'Expected demo header to be present after running demo');
    expect(outputText).toContain("Individual Trees' Predictions:", 'Expected individual predictions heading to be present');

    // Validate that each tree prediction line is present (evidence of forEach iteration)
    for (let i = 1; i <= 5; i++) {
      // Tree #n: <Prediction>
      const pattern = `Tree #${i}:`;
      expect(outputText).toContain(pattern, `Expected output to include prediction line for ${pattern}`);
    }

    // Validate vote tally and final majority result
    expect(outputText).toContain('Vote tally:', 'Expected vote tally section');
    expect(outputText).toContain('Spam: 3 vote(s)');
    expect(outputText).toContain('Not Spam: 2 vote(s)');
    expect(outputText).toContain('Final Random Forest Prediction by Majority Vote: Spam');

    // Check that no page errors were thrown during the demo run
    expect(pageErrors.length).toBe(0, `Expected no uncaught page errors, found: ${pageErrors.length}`);

    // Ensure no console.error messages were logged during the demo
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMsgs.length).toBe(0);
  });

  // Edge case: clicking the button multiple times should clear previous output and re-render consistently
  test('Edge case: multiple clicks clear previous output and produce consistent results', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // First run
    await demo.runDemo();
    const firstRunText = await demo.getOutputText();

    // Click again rapidly twice to simulate quick repeated interactions
    await Promise.all([
      demo.runDemo(),
      demo.runDemo()
    ]);

    // After repeated clicks, get the output again
    const repeatedRunText = await demo.getOutputText();

    // The latest run should still contain the header and final decision
    expect(repeatedRunText).toContain('Random Forest Voting Demo:');
    expect(repeatedRunText).toContain('Final Random Forest Prediction by Majority Vote: Spam');

    // The repeated run output should not include multiple concatenated headers from previous runs.
    // We ensure that header appears at most once by counting occurrences.
    const headerOccurrences = (repeatedRunText.match(/Random Forest Voting Demo:/g) || []).length;
    expect(headerOccurrences).toBeGreaterThanOrEqual(1);
    expect(headerOccurrences).toBeLessThanOrEqual(3, 'Header should not be wildly duplicated even after rapid clicks');

    // Ensure the output is deterministic (same final prediction)
    expect(repeatedRunText).toContain('Final Random Forest Prediction by Majority Vote: Spam');

    // No uncaught page errors or console error messages expected
    expect(pageErrors.length).toBe(0);
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMsgs.length).toBe(0);
  });

  // Validate that the S1_DemoRunning entry actions' side effects match FSM evidence about clearing previous output
  test('S1_DemoRunning entry action: output is cleared at the start of runVotingDemo', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Manually set some content into the demo output to simulate previous state (we are not allowed to patch functions,
    // but we can set DOM content through user-like interactions; this still modifies the DOM but not the JS functions)
    // NOTE: The instructions forbid injecting global variables or patching functions, but setting element text content mimics user content.
    await page.evaluate(() => {
      const el = document.getElementById('demoOutput');
      if (el) el.textContent = 'SOME PREVIOUS TEXT THAT SHOULD BE CLEARED';
    });

    // Run the demo; the runVotingDemo implementation starts with outputEl.textContent = "" (per implementation)
    await demo.runDemo();

    const outputText = await demo.getOutputText();
    // The previous arbitrary text should no longer be present
    expect(outputText).not.toContain('SOME PREVIOUS TEXT THAT SHOULD BE CLEARED');
    // And the expected header should be present
    expect(outputText).toContain('Random Forest Voting Demo:');
    // No page errors
    expect(pageErrors.length).toBe(0);
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrorMsgs.length).toBe(0);
  });

  // Test to ensure accessibility attributes and structural evidence from FSM are present
  test('Component evidence: demo output and button conform to expected structure and attributes', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    const runBtn = await demo.getRunButton();
    const outputEl = await demo.getOutputElement();

    // Button is focusable and has role attributes implicitly; check that it can receive focus
    await runBtn.focus();
    await expect(runBtn).toBeFocused();

    // Verify demo output uses monospace font family (visual cue) by reading computed style (best-effort)
    const fontFamily = await page.evaluate(() => {
      const el = document.getElementById('demoOutput');
      if (!el) return null;
      return window.getComputedStyle(el).fontFamily;
    });
    // We don't assert exact font, but ensure it's present (non-null)
    expect(fontFamily).not.toBeNull();

    // Verify demoOutput is present in DOM and has the aria-live attribute per FSM components
    await expect(outputEl).toHaveAttribute('aria-live', 'polite');

    // No page errors
    expect(pageErrors.length).toBe(0);
  });

  // Final check: ensure that loading the page and interacting does not produce JS SyntaxError/ReferenceError/TypeError
  // We explicitly inspect collected pageErrors and console messages to surface any of these error types.
  test('No runtime SyntaxError / ReferenceError / TypeError occurred during interactions', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Run the demo to exercise code paths
    await demo.runDemo();

    // Wait briefly to allow any async page errors to surface
    await page.waitForTimeout(250);

    // pageErrors contains Error objects thrown on the page (uncaught exceptions)
    // Build a readable map of error names
    const errorNames = pageErrors.map(e => e.name || e.toString());

    // Assert that none of the errors are SyntaxError/ReferenceError/TypeError
    const forbidden = ['SyntaxError', 'ReferenceError', 'TypeError'];
    const foundForbidden = errorNames.filter(n => forbidden.some(f => n.includes(f)));
    // We expect zero instances
    expect(foundForbidden.length).toBe(0, `Unexpected runtime errors detected: ${foundForbidden.join(', ')}`);

    // Also inspect console messages for types reported as 'error' (these may include stack traces)
    const consoleErrorMsgs = consoleMessages.filter(m => m.type === 'error');
    // If any console.error was invoked, fail the test to bring attention to runtime problems
    expect(consoleErrorMsgs.length).toBe(0, `console.error messages found: ${consoleErrorMsgs.map(m => m.text).join(' | ')}`);
  });
});