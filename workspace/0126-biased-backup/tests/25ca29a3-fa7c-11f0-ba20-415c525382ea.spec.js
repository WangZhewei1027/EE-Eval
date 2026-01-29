import { test, expect } from '@playwright/test';

// Test file: 25ca29a3-fa7c-11f0-ba20-415c525382ea.spec.js
// Application URL (served by test harness)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25ca29a3-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the Interpolation Search Demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.btnSelector = '#demoBtn';
    this.outputSelector = '#demoOutput';
    // collectors for console/page errors to be inspected in tests
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  // Navigate to the page and set up listeners for console and page errors
  async goto() {
    // reset collectors
    this.consoleErrors = [];
    this.pageErrors = [];

    // attach listeners BEFORE navigation to catch any early errors
    this.page.on('console', (msg) => {
      // collect console errors only
      try {
        if (msg.type() === 'error') {
          this.consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore listener runtime issues
      }
    });
    this.page.on('pageerror', (err) => {
      try {
        this.pageErrors.push(err.message || String(err));
      } catch (e) {
        // ignore
      }
    });

    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // ensure main elements exist
    await expect(this.page.locator(this.btnSelector)).toBeVisible();
    await expect(this.page.locator(this.outputSelector)).toBeVisible();
  }

  // Returns the button element handle
  btn() {
    return this.page.locator(this.btnSelector);
  }

  // Click the demo button (Run Demo event)
  async clickRun() {
    await this.btn().click();
  }

  // Returns whether the run button is disabled
  async isButtonDisabled() {
    return await this.btn().evaluate((b) => b.disabled);
  }

  // Get the output text content
  async getOutputText() {
    return await this.page.locator(this.outputSelector).textContent();
  }

  // Wait for output to contain a substring (with generous timeout due to setTimeout in demo)
  async waitForOutputContains(substring, opts = {}) {
    const timeout = opts.timeout ?? 15000; // default 15s for demo progress
    await this.page.waitForFunction(
      (selector, text) => {
        const el = document.querySelector(selector);
        return el && el.textContent && el.textContent.includes(text);
      },
      this.outputSelector,
      substring,
      { timeout }
    );
  }

  // Expose collected errors
  getConsoleErrors() {
    return this.consoleErrors;
  }
  getPageErrors() {
    return this.pageErrors;
  }
}

test.describe('Interpolation Search Demo (FSM validation)', () => {
  // Use a fresh page for each test
  test.beforeEach(async ({ page }) => {
    // Nothing globally to set up here; tests will instantiate DemoPage and navigate
  });

  // --- Idle State Tests ---
  test('S0_Idle: initial page renders and Idle state evidence is present', async ({ page }) => {
    // Validate initial Idle state: button exists, enabled, and output is empty
    const demo = new DemoPage(page);
    await demo.goto();

    // Validate button presence and label (evidence from FSM)
    const btn = demo.btn();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Run Demo Search for 58');

    // Button should be enabled in Idle state
    const disabled = await demo.isButtonDisabled();
    expect(disabled).toBe(false);

    // Output should be initially empty (evidence: <div class="demo-output" id="demoOutput"></div>)
    const output = (await demo.getOutputText()) || '';
    expect(output.trim()).toBe('');

    // Ensure no console or page errors occurred on initial load
    expect(demo.getConsoleErrors().length).toBe(0);
    expect(demo.getPageErrors().length).toBe(0);
  });

  // --- Run Demo Transition S0 -> S1 ---
  test('Transition RunDemo (S0_Idle -> S1_DemoRunning): clicking runs demo and disables button', async ({ page }) => {
    // This test validates:
    // - Clicking the #demoBtn triggers the "Run Demo" event
    // - Button becomes disabled (exit/entry actions)
    // - Output text begins with "Running Interpolation Search Demo..."
    // - No unexpected console/page errors happen during start of demo

    const demo = new DemoPage(page);
    await demo.goto();

    // Click the button to start the demo
    await demo.clickRun();

    // Immediately after click, button should be disabled (btn.disabled = true action)
    // We check synchronously (may be immediate in the event handler)
    const isDisabledAfterClick = await demo.isButtonDisabled();
    expect(isDisabledAfterClick).toBe(true);

    // Output should at least contain the running message set on transition
    await demo.waitForOutputContains('Running Interpolation Search Demo...', { timeout: 2000 });
    const outputText = await demo.getOutputText();
    expect(outputText).toContain('Running Interpolation Search Demo...');

    // No uncaught console errors or page errors during the start of the demo
    expect(demo.getConsoleErrors().length).toBe(0);
    expect(demo.getPageErrors().length).toBe(0);
  });

  // --- Demo Running to Demo Completed S1 -> S2 ---
  test('Transition DemoCompleted (S1_DemoRunning -> S2_DemoCompleted): demo prints steps and re-enables button', async ({ page }) => {
    // Validates:
    // - Demo writes step-by-step lines into demoOutput (evidence lines in FSM)
    // - Eventually writes either "Element 58 found at index X." or "Element 58 not found in the array."
    // - Once printing completes, btn.disabled becomes false again (exit action)
    // - Visual feedback (presence of steps like "Step 1:", "Interpolated position", etc.)
    // - No uncaught exceptions occurred during the demo

    const demo = new DemoPage(page);
    await demo.goto();

    // Start demo
    await demo.clickRun();

    // During running, ensure disabled
    expect(await demo.isButtonDisabled()).toBe(true);

    // Wait for the final positive evidence for this dataset: Element 58 found at index 7.
    // The demo uses a 900ms setTimeout between lines; allow enough time.
    await demo.waitForOutputContains('Element 58 found at index 7.', { timeout: 15000 });

    // After completion, the button should be re-enabled (btn.disabled = false on end)
    // Wait for the button to become enabled (it is set in the printNext function's else branch)
    await demo.page.waitForFunction(
      (selector) => {
        const b = document.querySelector(selector);
        return b && b.disabled === false;
      },
      demo.btnSelector,
      { timeout: 5000 }
    );

    // Final assertions about output content and structure
    const finalOutput = (await demo.getOutputText()) || '';
    // Should contain step markers and the found message
    expect(finalOutput).toContain('Step 1:');
    expect(finalOutput).toContain('Interpolated position:');
    expect(finalOutput).toContain('arr[pos] =');
    expect(finalOutput).toContain('Element 58 found at index 7.');

    // Button should now be enabled again (Idle evidence)
    expect(await demo.isButtonDisabled()).toBe(false);

    // Verify no console / page errors occurred throughout
    expect(demo.getConsoleErrors().length).toBe(0);
    expect(demo.getPageErrors().length).toBe(0);
  });

  // --- Re-run Demo from Completed S2 -> S0 -> S1 ---
  test('Transition S2_DemoCompleted -> S0_Idle -> S1_DemoRunning: re-running demo resets output and repeats', async ({ page }) => {
    // Validates:
    // - After a completed demo, clicking the button again returns to Running state
    // - The output is reset to the initial "Running Interpolation Search Demo..." message
    // - Button is disabled during the re-run and re-enabled after completion
    // - The demo outputs the expected final message again
    // - No page errors occur during consecutive runs

    const demo = new DemoPage(page);
    await demo.goto();

    // Run once to completion
    await demo.clickRun();
    await demo.waitForOutputContains('Element 58 found at index 7.', { timeout: 15000 });
    await demo.page.waitForFunction(
      (selector) => {
        const b = document.querySelector(selector);
        return b && b.disabled === false;
      },
      demo.btnSelector,
      { timeout: 5000 }
    );

    // Confirm we are in Completed -> Idle (btn enabled)
    expect(await demo.isButtonDisabled()).toBe(false);

    // Click again to run demo a second time
    await demo.clickRun();

    // Immediately, output should have been reset to the Running message
    await demo.waitForOutputContains('Running Interpolation Search Demo...', { timeout: 2000 });
    let outputAfterSecondClick = await demo.getOutputText();
    expect(outputAfterSecondClick).toContain('Running Interpolation Search Demo...');

    // Button should be disabled while the demo runs
    expect(await demo.isButtonDisabled()).toBe(true);

    // Wait for final message again
    await demo.waitForOutputContains('Element 58 found at index 7.', { timeout: 15000 });

    // After completion, button should be re-enabled
    await demo.page.waitForFunction(
      (selector) => {
        const b = document.querySelector(selector);
        return b && b.disabled === false;
      },
      demo.btnSelector,
      { timeout: 5000 }
    );
    expect(await demo.isButtonDisabled()).toBe(false);

    // Final output contains expected content
    const finalOutput2 = (await demo.getOutputText()) || '';
    expect(finalOutput2).toContain('Element 58 found at index 7.');

    // Ensure no console or page errors across both runs
    expect(demo.getConsoleErrors().length).toBe(0);
    expect(demo.getPageErrors().length).toBe(0);
  });

  // --- Edge Cases & Error Observations ---
  test('Edge Cases: verify that no uncaught ReferenceError/SyntaxError/TypeError occurred during load and demo runs', async ({ page }) => {
    // This test collects console and page errors while performing a full run and asserts there were none.
    // The instructions require observing console logs and page errors without patching the environment.

    const demo = new DemoPage(page);
    await demo.goto();

    // Attach additional console listener to capture any console.* messages (including warnings)
    const otherConsoleMessages = [];
    demo.page.on('console', (msg) => {
      otherConsoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Start demo
    await demo.clickRun();

    // Wait for completion message or absence
    // The demo will either print "found at index 7" or "not found"; we wait for either
    await demo.page.waitForFunction(
      () => {
        const out = document.getElementById('demoOutput');
        return out && out.textContent && (out.textContent.includes('Element 58 found at index 7.') || out.textContent.includes('Element 58 not found in the array.'));
      },
      { timeout: 15000 }
    );

    // Give a small grace period for any asynchronous errors to surface
    await demo.page.waitForTimeout(500);

    // Assert that there were no page-level unhandled exceptions
    expect(demo.getPageErrors().length).toBe(0);

    // Assert that no console errors were emitted (console.error / runtime errors)
    const consoleErrors = demo.getConsoleErrors();
    // If there are console errors, include them in the failure message
    expect(consoleErrors.length, `Unexpected console.error messages: ${JSON.stringify(consoleErrors)}`).toBe(0);

    // As an additional sanity check, ensure the console messages captured include the expected types (info/log/debug) but not 'error'
    const hasConsoleErrorType = otherConsoleMessages.some((m) => m.type === 'error');
    expect(hasConsoleErrorType).toBe(false);
  });
});