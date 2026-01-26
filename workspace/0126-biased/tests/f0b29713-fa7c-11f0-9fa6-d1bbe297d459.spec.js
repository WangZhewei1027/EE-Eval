import { test, expect } from '@playwright/test';

// Test file for application: f0b29713-fa7c-11f0-9fa6-d1bbe297d459
// URL: http://127.0.0.1:5500/workspace/0126-biased/html/f0b29713-fa7c-11f0-9fa6-d1bbe297d459.html
// This suite validates the FSM states and transitions as observed in the page.
// Important: The page contains a deliberate JavaScript syntax error inside a script block.
// Per instructions, we must NOT patch the page; instead we observe and assert that the errors occur.
// We also validate the Idle state (initial rendering) and assert that the demonstration does NOT run
// because the script fails to parse (hence event listeners are not attached).

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b29713-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page object for the demo page to encapsulate selectors and common actions
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      demoButton: '#demo-button',
      demoContainer: '#demo-container',
      demoOutput: '#demo-output',
      mstOutput: '#mst-output',
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async demoButton() {
    return this.page.locator(this.selectors.demoButton);
  }

  async demoContainer() {
    return this.page.locator(this.selectors.demoContainer);
  }

  async demoOutput() {
    return this.page.locator(this.selectors.demoOutput);
  }

  async mstOutput() {
    return this.page.locator(this.selectors.mstOutput);
  }

  // Click the demo button
  async clickDemoButton() {
    await (await this.demoButton()).click();
  }

  // Helper to get innerText of a selector
  async getText(selector) {
    const el = this.page.locator(selector);
    return el.evaluate(node => node.innerText);
  }
}

test.describe('Prim\'s Algorithm Interactive Demo - FSM validation and error observation', () => {
  // Collect console messages and page errors for assertions
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors (uncaught exceptions, syntax errors, etc.)
    page.on('pageerror', (err) => {
      // err is an Error object; store the message for assertions
      pageErrors.push(err && err.message ? err.message : String(err));
    });

    // Collect console messages (all levels)
    page.on('console', msg => {
      // store type and text
      try {
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      } catch {
        // in case msg.type() throws (very unlikely), fallback
        consoleMessages.push({ type: 'unknown', text: String(msg) });
      }
    });

    // Navigate to the application page and wait for load
    const demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async () => {
    // No special teardown needed beyond Playwright's automatic cleanup.
  });

  test('Idle state: initial render shows Run Demonstration button and demo container', async ({ page }) => {
    // Validate the initial Idle state per FSM (S0_Idle)
    const demo = new DemoPage(page);

    // The Run Demonstration button must be present and visible
    const button = await demo.demoButton();
    await expect(button).toBeVisible();
    await expect(button).toHaveText('Run Demonstration');

    // The demo container should contain the placeholder text before any demonstration runs
    const demoContainer = await demo.demoContainer();
    await expect(demoContainer).toBeVisible();

    const containerText = await demo.getText('#demo-container');
    // Check that the placeholder phrase is present
    expect(containerText).toContain('Demonstration will appear here');

    // The demo-output and mst-output elements should be present but empty initially
    const demoOutputText = await demo.getText('#demo-output');
    const mstOutputText = await demo.getText('#mst-output');

    // They may contain whitespace; trim and assert emptiness
    expect(demoOutputText.trim()).toBe('');
    expect(mstOutputText.trim()).toBe('');
  });

  test('Page contains a JavaScript SyntaxError that prevents the demo script from running', async ({ page }) => {
    // This test asserts that the script parsing/compilation failed (expected due to invalid graph literal).
    // We expect at least one pageerror captured and that it references a SyntaxError or unexpected token/string.
    // Because error messaging differs across engines, check for multiple common substrings.

    // Wait a short moment to ensure pageerror events (if any) have been received
    await page.waitForTimeout(250);

    // There should be at least one page error
    expect(pageErrors.length).toBeGreaterThan(0);

    // At least one error message should indicate a syntax problem
    const combined = pageErrors.join(' | ');
    // Accept several possible phrasings
    const syntaxIndicators = [/SyntaxError/i, /Unexpected token/i, /Unexpected string/i, /unterminated string/i];
    const found = syntaxIndicators.some(re => re.test(combined));
    expect(found).toBeTruthy();
  });

  test('Transition attempt: clicking Run Demonstration does NOT start the demo because event listener failed to attach', async ({ page }) => {
    // This test simulates the RunDemonstration event (clicking #demo-button) and asserts that
    // the demonstration does not start due to the script syntax error preventing the listener registration.
    const demo = new DemoPage(page);

    // Capture current demo-output and mst-output before click
    const beforeDemoOutput = (await demo.getText('#demo-output')).trim();
    const beforeMstOutput = (await demo.getText('#mst-output')).trim();

    // Click the button
    await demo.clickDemoButton();

    // Wait briefly to allow any potential handlers to run (they shouldn't)
    await page.waitForTimeout(500);

    // After clicking, because the script failed to parse, nothing should have changed:
    const afterDemoOutput = (await demo.getText('#demo-output')).trim();
    const afterMstOutput = (await demo.getText('#mst-output')).trim();

    // Assert no change in demo-output and mst-output
    expect(afterDemoOutput).toBe(beforeDemoOutput);
    expect(afterMstOutput).toBe(beforeMstOutput);

    // Also assert that no informative "step" text was appended to demo-output
    expect(afterDemoOutput).not.toContain('Start with vertex A');
    expect(afterDemoOutput).not.toContain('Add edge');

    // Ensure that the pageErrors still indicate the syntax failure (did not magically disappear)
    expect(pageErrors.length).toBeGreaterThan(0);
    const combined = pageErrors.join(' | ');
    expect(/SyntaxError|Unexpected token|Unexpected string/i.test(combined)).toBeTruthy();
  });

  test('FSM-derived expectations: startDemonstration/displayFinalOutput functions are not available due to script parse failure', async ({ page }) => {
    // The FSM mentions entry/exit actions like startDemonstration() and displayFinalOutput().
    // Because the script body failed to parse, such functions (if they were to be attached to window)
    // are not defined. We assert that accessing them yields undefined.

    // Evaluate in page context whether those symbols exist
    const startDemoType = await page.evaluate(() => {
      // Use typeof to avoid throwing ReferenceError on undefined globals
      return typeof window.startDemonstration;
    });

    const displayFinalType = await page.evaluate(() => {
      return typeof window.displayFinalOutput;
    });

    // Expect them to be 'undefined' (not functions)
    expect(startDemoType).toBe('undefined');
    expect(displayFinalType).toBe('undefined');

    // Also check that a naive attempt to call a non-existent function via evaluate results in a thrown ReferenceError if attempted.
    // We will perform the call inside the page and catch the resulting error on the Playwright side.
    const callResult = await page.evaluate(() => {
      try {
        // Intentionally call a non-existent function to observe the error thrown inside the page context.
        // This will throw; we catch and return the error message string for assertion.
        // We do NOT modify any global functions; this is a read-only test action.
        window.startDemonstration(); // expected to throw or be undefined -> throws
        return { ok: true };
      } catch (err) {
        return { ok: false, message: err && err.message ? err.message : String(err) };
      }
    });

    // Because startDemonstration is undefined, the page should have returned an error object
    expect(callResult.ok).toBe(false);
    // The message should indicate that the property is not a function or not defined. Accept several variants.
    const msg = String(callResult.message || '');
    const variantChecks = [
      /is not a function/i, // common: "window.startDemonstration is not a function"
      /not defined/i,        // "startDemonstration is not defined"
      /cannot read property/i,
    ];
    const variantFound = variantChecks.some(re => re.test(msg));
    expect(variantFound).toBeTruthy();
  });

  test('Edge case: multiple rapid clicks should not produce intermittent behavior when script parsing failed', async ({ page }) => {
    // Ensure that repeated user interactions do not cause unexpected DOM mutations or additional errors
    const demo = new DemoPage(page);

    // Clear previous console messages record for clarity
    consoleMessages.length = 0;

    // Perform multiple rapid clicks
    for (let i = 0; i < 5; i++) {
      await demo.clickDemoButton();
    }

    // Allow a short time for any handlers (none expected) and for any errors to surface
    await page.waitForTimeout(500);

    // demo-output and mst-output should remain unchanged / empty
    const demoOutputText = (await demo.getText('#demo-output')).trim();
    const mstOutputText = (await demo.getText('#mst-output')).trim();
    expect(demoOutputText).toBe('');
    expect(mstOutputText).toBe('');

    // No new page errors beyond the initial syntax error are strictly required, but at least the syntax error remains present
    expect(pageErrors.length).toBeGreaterThan(0);

    // Ensure that console did not log expected step-driven messages (which would indicate the demo ran)
    const consoleText = consoleMessages.map(m => `${m.type}:${m.text}`).join(' | ');
    expect(consoleText).not.toContain('Start with vertex A');
    expect(consoleText).not.toContain('Add edge');
  });

  test('Observability: captured console and page errors include helpful diagnostics for debugging the broken script', async ({ page }) => {
    // This test ensures that the test harness captured helpful diagnostics (console / page errors)
    // so developers can quickly locate the problem.

    // Wait briefly to ensure all messages are captured
    await page.waitForTimeout(200);

    // There should be at least one page error (syntax)
    expect(pageErrors.length).toBeGreaterThan(0);

    // The console messages might include errors as well; ensure we recorded some messages
    expect(consoleMessages.length).toBeGreaterThanOrEqual(0); // can be zero in some environments, but allowed

    // If there are console messages of type 'error', ensure they mention syntax or unexpected token/string in combination with the pageErrors
    const errorConsoleTexts = consoleMessages.filter(m => m.type === 'error').map(m => m.text).join(' | ');
    if (errorConsoleTexts) {
      const combined = `${errorConsoleTexts} | ${pageErrors.join(' | ')}`;
      const found = /SyntaxError|Unexpected token|Unexpected string/i.test(combined);
      expect(found).toBeTruthy();
    } else {
      // Fallback: ensure pageErrors contain syntax-related info
      const combinedPageErrors = pageErrors.join(' | ');
      expect(/SyntaxError|Unexpected token|Unexpected string/i.test(combinedPageErrors)).toBeTruthy();
    }
  });
});