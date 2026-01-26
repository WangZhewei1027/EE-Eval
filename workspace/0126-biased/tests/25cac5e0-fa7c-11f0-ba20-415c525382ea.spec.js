import { test, expect } from '@playwright/test';

// Test file: 25cac5e0-fa7c-11f0-ba20-415c525382ea.spec.js
// Application URL (served by test harness):
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cac5e0-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo page to keep tests organized and readable
class TopoSortDemoPage {
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demo-button');
    this.demoOutput = page.locator('#demo-output');
  }

  // Navigate to the page and wait for essential elements
  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the button and output exist in the DOM
    await expect(this.demoButton).toBeVisible();
    await expect(this.demoOutput).toBeVisible();
  }

  // Click the demo button and wait for some output to appear
  async runDemo() {
    await this.demoButton.click();
    // The demo is synchronous and writes immediately, so wait for the output to contain "Step"
    await expect(this.demoOutput).toContainText('Step');
  }

  // Retrieve the textual content of the demo output
  async outputText() {
    return await this.demoOutput.textContent();
  }
}

test.describe('Topological Sort Demo (FSM states & transitions) - 25cac5e0-fa7c-11f0-ba20-415c525382ea', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset collectors before each test
    pageErrors = [];
    consoleMessages = [];

    // Collect runtime page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      // Capture the full Error object for assertions and diagnostics
      pageErrors.push(err);
    });

    // Collect console messages, with attention to error-level logs
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Navigate to the application under test
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // helpful debug output when running tests locally (not printed in CI unless failures)
    if (pageErrors.length) {
      console.error('Page errors captured:', pageErrors.map(e => e && e.message ? e.message : String(e)));
    }
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    if (errorConsoleMsgs.length) {
      console.error('Console error messages:', errorConsoleMsgs);
    }
    // No explicit teardown required (Playwright handles browser context)
  });

  test('Initial state (S0_Idle) - button and demo output are present and initial output is empty', async ({ page }) => {
    const demo = new TopoSortDemoPage(page);

    // Verify page loaded and main elements exist - corresponds to FSM S0_Idle evidence
    await demo.goto();

    // Button should have the expected label text
    await expect(demo.demoButton).toHaveText('Run Topological Sort Demo');

    // The demo output (pre) should initially be empty (entry action in FSM was renderPage() but page already rendered)
    const initialText = await demo.outputText();
    // Accept null or empty string as empty content
    expect(initialText === null || initialText.trim() === '').toBeTruthy();

    // Accessibility attributes: ensure aria-live and aria-atomic are present on demo output
    const ariaLive = await page.locator('#demo-output').getAttribute('aria-live');
    const ariaAtomic = await page.locator('#demo-output').getAttribute('aria-atomic');
    expect(ariaLive).toBe('polite');
    expect(ariaAtomic).toBe('true');

    // Ensure no uncaught page errors occurred on initial load
    expect(pageErrors.length).toBe(0);
    // Also ensure no console.error messages were logged during initial load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoRunning (RunDemo event) - clicking button runs Kahn\'s demo and shows steps', async ({ page }) => {
    const demo = new TopoSortDemoPage(page);
    await demo.goto();

    // Click the demo button to trigger demoKahns() - FSM transition RunDemo
    await demo.runDemo();

    // Validate that the demo output includes step-by-step output and final order
    const out = await demo.outputText();
    expect(out).not.toBeNull();
    const text = out.trim();

    // Should include at least one Step and a "Final topological order" line per implementation
    expect(text.includes('Step 1:')).toBeTruthy();
    expect(text.includes('Final topological order:')).toBeTruthy();

    // The specific demo implementation (as provided) should produce the following final order:
    // "Final topological order: [5, 4, 3, 2, 1, 0]"
    // Assert the final order appears exactly as produced by the page script
    expect(text).toContain('Final topological order: [5, 4, 3, 2, 1, 0]');

    // Ensure demo output shows queue snapshots and current order snapshots
    expect(text).toMatch(/Queue \(zero in-degree vertices\): \[.*\]/);
    expect(text).toMatch(/Current topological order: \[.*\]/);

    // Verify that no runtime page errors (uncaught exceptions) occurred while running the demo
    expect(pageErrors.length).toBe(0);

    // No console.error logs were produced during the run
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Running demo multiple times resets output and produces consistent final order', async ({ page }) => {
    const demo = new TopoSortDemoPage(page);
    await demo.goto();

    // First run
    await demo.runDemo();
    const out1 = (await demo.outputText() || '').trim();
    expect(out1.length).toBeGreaterThan(0);
    expect(out1).toContain('Final topological order: [5, 4, 3, 2, 1, 0]');

    // Second run should reset content and produce a fresh set of steps.
    // The implementation sets demoOutput.textContent = '' at the start of demoKahns()
    await demo.demoButton.click();
    // Wait until output again contains "Step 1" to ensure the second run completed
    await expect(demo.demoOutput).toContainText('Step 1');

    const out2 = (await demo.outputText() || '').trim();
    expect(out2.length).toBeGreaterThan(0);
    expect(out2).toContain('Final topological order: [5, 4, 3, 2, 1, 0]');

    // The outputs for the two runs should both include "Final topological order" and should not be identical only if timing or other effects occur
    // But crucially, ensure second output starts with "Step 1" indicating reset happened
    expect(out2.startsWith('Step 1:')).toBeTruthy();

    // Ensure no uncaught exceptions or console.error messages across runs
    expect(pageErrors.length).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case & error scenario checks: output format stability and absence of runtime Reference/Type/Syntax errors', async ({ page }) => {
    const demo = new TopoSortDemoPage(page);
    await demo.goto();

    // Sanity check: the demo output element has class "demo-output" and expected CSS properties (class presence)
    const classAttr = await page.locator('#demo-output').getAttribute('class');
    expect(classAttr).toContain('demo-output');

    // Run the demo once to exercise the JS path
    await demo.runDemo();

    const result = (await demo.outputText()) || '';
    // Validate the output uses bracketed arrays and comma-space separators added by join(', ')
    expect(result).toMatch(/\[([0-9]+(, )?)+\]/);

    // Check for typical runtime errors (ReferenceError, TypeError, SyntaxError) in page errors captured
    // We expect the page to run without such errors; assert that none were recorded.
    // If any such errors are present, the test will fail and the collected errors will help debugging.
    const runtimeErrorKinds = pageErrors.map(e => (e && e.name) || '');
    const caughtCriticalErrors = runtimeErrorKinds.filter(name =>
      ['ReferenceError', 'TypeError', 'SyntaxError'].includes(name)
    );
    // Assert no critical runtime errors occurred
    expect(caughtCriticalErrors.length).toBe(0);

    // Also scan console messages for 'ReferenceError' / 'TypeError' text in error logs (defensive)
    const consoleErrorTexts = consoleMessages.filter(m => m.type === 'error').map(m => m.text);
    const foundNamesInConsole = consoleErrorTexts.filter(t =>
      /ReferenceError|TypeError|SyntaxError/.test(t)
    );
    expect(foundNamesInConsole.length).toBe(0);
  });

  test('FSM evidence assertions: verify event handler presence & entry/exit behaviors implied by FSM', async ({ page }) => {
    // This test validates the artifacts/evidence cited in the FSM:
    // - The demo button exists (#demo-button)
    // - The page contains a call to demoKahns upon click (we verify the click event results)
    // - The S0_Idle entry evidence shows the button markup; S1_DemoRunning evidence is the event listener behavior

    const demo = new TopoSortDemoPage(page);
    await demo.goto();

    // Check the HTML source contains the button element as described in FSM evidence
    const pageSource = await page.content();
    expect(pageSource).toContain('<button id="demo-button">Run Topological Sort Demo</button>');

    // Confirm clicking the button triggers the demo (transition S0 -> S1)
    await demo.runDemo();
    const out = (await demo.outputText()) || '';
    expect(out).toContain('Step 1:');
    expect(out).toContain('Final topological order:');

    // There is no explicit onExit action in the FSM for S1, but ensure clicking again does not throw
    await demo.demoButton.click();
    const outAfter = (await demo.outputText()) || '';
    expect(outAfter).toContain('Final topological order:');

    // No unexpected runtime errors (this also validates we did not inject or patch any functions)
    expect(pageErrors.length).toBe(0);
  });
});