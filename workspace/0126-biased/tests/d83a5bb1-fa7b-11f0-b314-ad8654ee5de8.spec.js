import { test, expect } from '@playwright/test';

// Test file for application: d83a5bb1-fa7b-11f0-b314-ad8654ee5de8
// Location served at:
// http://127.0.0.1:5500/workspace/0126-biased/html/d83a5bb1-fa7b-11f0-b314-ad8654ee5de8.html
//
// These tests validate the FSM states (S0_Idle, S1_DemoRunning) and the transition
// triggered by clicking the "#runDemo" button. They also observe console messages
// and page errors without altering the application code or runtime.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d83a5bb1-fa7b-11f0-b314-ad8654ee5de8.html';

// Page object encapsulating interactions with the demo section.
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = '#runDemo';
    this.output = '#demoOutput';
  }

  // Navigate to the demo page and wait for main elements to be ready.
  async goto() {
    await this.page.goto(APP_URL);
    await this.page.waitForSelector(this.runButton);
    await this.page.waitForSelector(this.output);
  }

  // Click the run demo button.
  async clickRun() {
    await this.page.click(this.runButton);
  }

  // Return the raw textContent of the output area.
  async getOutputText() {
    return (await this.page.locator(this.output).textContent()) ?? '';
  }

  // Return output lines as an array (splits on newlines and trims).
  async getOutputLines() {
    const txt = await this.getOutputText();
    return txt.split('\n').map(line => line.trim());
  }

  // Wait until the output contains a specific substring (with timeout).
  async waitForOutputContains(substring, opts = {}) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return !!el && el.textContent.indexOf(substr) !== -1;
      },
      this.output,
      substring,
      opts
    );
  }

  // Check if the output is empty.
  async isOutputEmpty() {
    const txt = await this.getOutputText();
    return txt.trim().length === 0;
  }

  // Set output text (used to test clear behavior by pre-populating).
  async setOutputText(value) {
    await this.page.evaluate(
      (sel, val) => {
        const el = document.querySelector(sel);
        if (el) el.textContent = val;
      },
      this.output,
      value
    );
  }
}

test.describe('Dynamic Typing — Tiny Demonstration (FSM validation)', () => {
  // Arrays to collect console messages and page errors so tests can assert on them.
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages; we will assert there are no error-level console logs.
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Collect unhandled page errors (uncaught exceptions).
    page.on('pageerror', error => {
      // error is an Error object from the page context
      pageErrors.push({
        message: error.message,
        stack: error.stack
      });
    });
  });

  test.afterEach(async ({ page }) => {
    // Cleanup listeners to avoid cross-test pollution if Playwright reuses the page.
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test('S0_Idle: initial Idle state shows Run demonstration button and empty output', async ({ page }) => {
    // Validate initial Idle state: button exists and output is empty.
    const demo = new DemoPage(page);
    await demo.goto();

    // The FSM's evidence expects a button with id #runDemo and an output div #demoOutput.
    const button = page.locator(demo.runButton);
    await expect(button).toBeVisible();
    await expect(button).toHaveAttribute('aria-label', 'Run the minimal dynamic typing demonstration');
    await expect(button).toHaveText('Run demonstration');

    const output = page.locator(demo.output);
    await expect(output).toBeVisible();
    // Initially, the demoOutput should be empty (Idle state entry renders page).
    const isEmpty = await demo.isOutputEmpty();
    expect(isEmpty, 'demoOutput should be empty in Idle state').toBe(true);

    // Accessibility attributes check for evidence in components.
    await expect(output).toHaveAttribute('aria-live', 'polite');
    await expect(output).toHaveAttribute('role', 'status');

    // Assert no uncaught page errors were emitted during initial load.
    // The application is expected to be stable on load (no ReferenceError / SyntaxError).
    expect(pageErrors.length, `Unexpected page errors on load: ${JSON.stringify(pageErrors)}`).toBe(0);

    // Assert there are no console.error messages on load.
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length, `Console error messages found on load: ${JSON.stringify(errorConsole)}`).toBe(0);
  });

  test('Transition RunDemoClick: clicking the button enters Demo Running and produces the trace', async ({ page }) => {
    // This test verifies the transition S0_Idle -> S1_DemoRunning:
    // - clearOutput() is invoked (out.textContent = "")
    // - appendOutput() appends the demonstration trace.
    const demo = new DemoPage(page);
    await demo.goto();

    // Pre-populate the output area to validate that the click handler clears it.
    await demo.setOutputText('OLD_CONTENT_SHOULD_BE_CLEARED');

    // Ensure pre-population took place
    let pre = await demo.getOutputText();
    expect(pre.includes('OLD_CONTENT_SHOULD_BE_CLEARED')).toBe(true);

    // Click the Run demonstration button (this should clear and then append).
    await demo.clickRun();

    // Wait for a known substring from the appended trace to appear.
    await demo.waitForOutputContains('Starting minimal dynamic-typing trace...', { timeout: 2000 });

    const outText = await demo.getOutputText();

    // Ensure the old content is removed (clearOutput effect).
    expect(outText.includes('OLD_CONTENT_SHOULD_BE_CLEARED')).toBe(false);

    // Validate some expected lines from the demonstration exist in the output.
    expect(outText).toContain('Starting minimal dynamic-typing trace...');
    expect(outText).toContain("1) let a = 10");
    expect(outText).toContain("2) a = \"hello\"");
    expect(outText).toContain("3) function f(x) { return x.toString(); }");
    expect(outText).toContain("6) f(null) -> trace:");
    expect(outText).toContain("Demonstration complete. For safety in production, combine tests with optional static checks where appropriate.");

    // No uncaught page errors should have occurred during the click and run.
    expect(pageErrors.length, `Page errors after clicking runDemo: ${JSON.stringify(pageErrors)}`).toBe(0);

    // No console.error messages should be emitted during the run.
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length, `Console error messages seen after running demo: ${JSON.stringify(errors)}`).toBe(0);
  });

  test('Repeated clicks: each click clears previous output and produces a single fresh trace', async ({ page }) => {
    // Validate idempotency of the button handler: repeated activation should clear previous output
    // and produce a fresh trace each time (not accumulate).
    const demo = new DemoPage(page);
    await demo.goto();

    // First click
    await demo.clickRun();
    await demo.waitForOutputContains('Starting minimal dynamic-typing trace...');
    const afterFirst = await demo.getOutputText();

    // Count occurrences of the "Starting minimal..." phrase
    const countOccurrences = (txt, substr) => {
      let idx = 0, count = 0;
      while ((idx = txt.indexOf(substr, idx)) !== -1) {
        count++;
        idx += substr.length;
      }
      return count;
    };

    const phrase = 'Starting minimal dynamic-typing trace...';
    let occ1 = countOccurrences(afterFirst, phrase);
    expect(occ1, 'Should see the starting phrase exactly once after first click').toBe(1);

    // Second click - should clear previous content and append fresh trace
    await demo.clickRun();
    await demo.waitForOutputContains(phrase);
    const afterSecond = await demo.getOutputText();
    let occ2 = countOccurrences(afterSecond, phrase);
    expect(occ2, 'Should see the starting phrase exactly once after second click (cleared then appended)').toBe(1);

    // Ensure the output after second click is not the concatenation of first and second traces
    expect(afterSecond.length).toBeLessThanOrEqual(afterFirst.length + 1000); // basic sanity check

    // Also ensure no uncaught errors or console error logs were produced during repeated invocation.
    expect(pageErrors.length, `Page errors after repeated clicks: ${JSON.stringify(pageErrors)}`).toBe(0);
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsole.length, `Console error messages after repeated clicks: ${JSON.stringify(errorConsole)}`).toBe(0);
  });

  test('Rapid multiple clicks: final output corresponds to the last click and remains consistent', async ({ page }) => {
    // Simulate rapid user interactions: multiple clicks in quick succession.
    const demo = new DemoPage(page);
    await demo.goto();

    // Rapidly invoke clicks without waiting for complete DOM update between them.
    const rapidClicks = 5;
    for (let i = 0; i < rapidClicks; i++) {
      // Fire and don't wait - simulate fast user.
      void demo.clickRun();
    }

    // Wait for the trace to appear (from the final click). If handler is synchronous, the final
    // output should reflect a single trace.
    await demo.waitForOutputContains('Demonstration complete', { timeout: 2000 });
    const finalOut = await demo.getOutputText();

    // The expected starting phrase should be present once.
    const startPhrase = 'Starting minimal dynamic-typing trace...';
    const occurrences = finalOut.split(startPhrase).length - 1;
    expect(occurrences, 'Final output should include the starting phrase at least once').toBeGreaterThanOrEqual(1);

    // The final output should contain the completion line.
    expect(finalOut).toContain('Demonstration complete.');

    // No uncaught page errors observed during rapid clicking.
    expect(pageErrors.length, `Page errors after rapid clicks: ${JSON.stringify(pageErrors)}`).toBe(0);

    // No console.error messages during rapid clicking.
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length, `Console error messages after rapid clicks: ${JSON.stringify(consoleErrs)}`).toBe(0);
  });

  test('FSM evidence and robustness: verify DOM evidence lines and absence of runtime ReferenceError/SyntaxError/TypeError', async ({ page }) => {
    // This test explicitly inspects console logs and page errors to ensure the runtime
    // does not emit ReferenceError, SyntaxError or TypeError during normal operation.
    // According to the instructions, we observe console and page errors without altering the runtime.

    const demo = new DemoPage(page);
    await demo.goto();

    // Run the demo to exercise the JS code path.
    await demo.clickRun();
    await demo.waitForOutputContains('Starting minimal dynamic-typing trace...');

    // Gather any messages that indicate exceptions or specific error names in logs.
    const errorLikeConsole = consoleMessages.filter(m =>
      m.type === 'error' ||
      /ReferenceError|SyntaxError|TypeError/i.test(m.text)
    );

    // Gather page errors that look like specific JS runtime error names.
    const errorLikePage = pageErrors.filter(e =>
      /ReferenceError|SyntaxError|TypeError/i.test(e.message)
    );

    // Assert no such errors occurred (the page implementation is expected to be correct).
    // If such errors had to be asserted as present (for other scenarios), this assertion would differ.
    expect(errorLikeConsole.length, `Unexpected console errors or error-like messages: ${JSON.stringify(errorLikeConsole)}`).toBe(0);
    expect(errorLikePage.length, `Unexpected page errors containing error names: ${JSON.stringify(errorLikePage)}`).toBe(0);

    // Verify some of the FSM "evidence" lines are present in the DOM output as part of the trace.
    const out = await demo.getOutputText();
    expect(out).toContain("out.textContent = \"\";".replace(/\\/g, '')); // evidence string mention in FSM
    // The actual script clears out.textContent explicitly; ensure the trace also documents the clearing.
    expect(out).toContain('Starting minimal dynamic-typing trace...');
    expect(out).toContain('1) let a = 10');
  });
});