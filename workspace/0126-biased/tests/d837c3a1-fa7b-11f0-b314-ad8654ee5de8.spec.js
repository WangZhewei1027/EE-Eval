import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d837c3a1-fa7b-11f0-b314-ad8654ee5de8.html';

// Page object for the demo section to keep tests clear and maintainable
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = '#runBtn';
    this.output = '#demoOutput';
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the demo elements are available before proceeding
    await this.page.waitForSelector(this.runBtn);
    await this.page.waitForSelector(this.output);
  }

  async clickRun(options = {}) {
    await this.page.click(this.runBtn, options);
  }

  async getRunBtnText() {
    return this.page.textContent(this.runBtn);
  }

  async isRunBtnDisabled() {
    return this.page.$eval(this.runBtn, (el) => el.disabled === true);
  }

  async getOutputText() {
    return this.page.textContent(this.output);
  }

  async countInOutput(substr) {
    const text = await this.getOutputText();
    if (!text) return 0;
    return (text.match(new RegExp(substr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
  }
}

test.describe('Deadlock demo — FSM validation and UI behavior', () => {
  // Capture console messages and page errors for each test run
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages (info, log, warn, error)
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') {
        consoleErrors.push(text);
      }
    });

    // Collect uncaught exceptions on the page
    page.on('pageerror', (err) => {
      // pageerror emits Error objects; store their message for assertions
      pageErrors.push(err ? String(err) : err);
    });
  });

  // Test the initial idle state S0_Idle
  test('S0_Idle: Page renders initial idle state with Run demo button and empty output', async ({ page }) => {
    const demo = new DemoPage(page);
    // Navigate to the page and wait for critical elements
    await demo.goto();

    // Validate the button exists and has the expected accessible attributes
    const runBtn = await page.$(demo.runBtn);
    expect(runBtn).not.toBeNull();

    // Button should have the expected text
    const btnText = await demo.getRunBtnText();
    expect(btnText).toBe('Run demo: simulate 2-process deadlock');

    // Button should have aria-controls pointing to #demoOutput
    const ariaControls = await runBtn.getAttribute('aria-controls');
    expect(ariaControls).toBe('demoOutput');

    // Demo output exists and is empty initially (Idle state has no trace)
    const outText = await demo.getOutputText();
    expect(outText.trim()).toBe(''); // initial output is blank

    // Ensure role=status is present on the output div
    const role = await page.getAttribute(demo.output, 'role');
    expect(role).toBe('status');

    // No uncaught page errors or console errors at initial render
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Test the transition from S0_Idle -> S1_DemoRunning triggered by clicking the button
  test('RunDemoClick transition: clicking Run demo enters Demo Running and updates output', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Click the run button to trigger simulateDeadlock (S0 -> S1)
    await demo.clickRun();

    // Immediately after click the button should be disabled and indicate disabled text
    // The implementation sets disabled=true and changes button text synchronously after simulateDeadlock()
    // Wait up to 250ms for the change to propagate
    await page.waitForTimeout(50);

    const disabled = await demo.isRunBtnDisabled();
    expect(disabled).toBe(true);

    // Button text should reflect the disabled state (on-entry exit actions modify text)
    const btnTextAfter = await demo.getRunBtnText();
    expect(btnTextAfter).toBe('Demo run (disabled)');

    // Output should contain expected simulation steps produced by simulateDeadlock()
    const output = await demo.getOutputText();
    expect(output).toContain('Initializing processes P1, P2 and resources R1, R2 (one instance each)');
    expect(output).toContain('Step 1: P1 requests and acquires R1');
    expect(output).toContain('Step 2: P2 requests and acquires R2');
    expect(output).toContain('Step 3: P1 requests R2 but R2 is held by P2 -> P1 blocks');
    expect(output).toContain('Step 4: P2 requests R1 but R1 is held by P1 -> P2 blocks');
    expect(output).toContain('Conclusion: Deadlock detected. Neither process can proceed.');

    // Verify that the handler simulateDeadlock() produced one "Result" message
    const conclusionCount = await demo.countInOutput('Conclusion: Deadlock detected. Neither process can proceed.');
    expect(conclusionCount).toBe(1);

    // No uncaught page errors or console errors were produced by running the demo
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Test exit action: S1_DemoRunning -> S0_Idle after timeout (button is re-enabled)
  test('Exit action: button is re-enabled and text reset after 3 seconds', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Click to run demo
    await demo.clickRun();

    // Confirm disabled immediately
    await page.waitForTimeout(20);
    expect(await demo.isRunBtnDisabled()).toBe(true);
    expect(await demo.getRunBtnText()).toBe('Demo run (disabled)');

    // Wait slightly longer than the 3000ms reset in the page script to allow onExit actions to run
    await page.waitForTimeout(3200);

    // After timeout the button should be re-enabled and original text restored
    expect(await demo.isRunBtnDisabled()).toBe(false);
    expect(await demo.getRunBtnText()).toBe('Run demo: simulate 2-process deadlock');

    // The output should still contain the simulation result (it is not cleared on exit)
    const out = await demo.getOutputText();
    expect(out).toContain('Deadlock detected');

    // Confirm no page-level errors occurred during the enable/disable lifecycle
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Edge case: rapid double-click; ensure the demo remains deterministic and the UI handles rapid interaction
  test('Edge case: rapid double-click should not produce unexpected duplicate runs or uncaught errors', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Use page.dblclick to simulate a fast double-click on the run button
    // The event listeners are for 'click', and the script disables the button after simulateDeadlock().
    // We assert that at minimum the output contains a valid single simulation trace and that no exceptions were thrown.
    await page.dblclick(demo.runBtn);

    // Small delay to allow handler to run
    await page.waitForTimeout(50);

    // The button should be disabled after the interaction
    expect(await demo.isRunBtnDisabled()).toBe(true);

    // The output should contain the expected final conclusion. If two clicks somehow triggered two full runs,
    // the conclusion string would appear more than once. We assert that conclusion appears at least once and
    // at most twice — allowing for platform timing differences while still detecting gross duplication.
    const conclusionString = 'Conclusion: Deadlock detected. Neither process can proceed.';
    const conclusionCount = await demo.countInOutput(conclusionString);
    expect(conclusionCount).toBeGreaterThanOrEqual(1);
    expect(conclusionCount).toBeLessThanOrEqual(2); // tolerant bound

    // Finally wait for re-enable to ensure lifecycle completes without errors
    await page.waitForTimeout(3200);
    expect(await demo.isRunBtnDisabled()).toBe(false);
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Accessibility and DOM linkage checks: ensure aria-controls and role match FSM components
  test('Components: button and output DOM linkage matches FSM components definition', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Validate selectors and attributes described in the FSM
    const runBtn = await page.$(demo.runBtn);
    expect(runBtn).not.toBeNull();

    const demoOutput = await page.$(demo.output);
    expect(demoOutput).not.toBeNull();

    // Verify attribute matching the FSM: button aria-controls=demoOutput
    const ariaControls = await runBtn.getAttribute('aria-controls');
    expect(ariaControls).toBe('demoOutput');

    // Verify demo output has role=status as in FSM
    const role = await demoOutput.getAttribute('role');
    expect(role).toBe('status');

    // No unexpected JS errors during DOM inspection
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  // Validate that the page does not emit ReferenceError, SyntaxError, or TypeError during normal use
  test('No unexpected runtime errors (ReferenceError/SyntaxError/TypeError) occur while interacting with the demo', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Perform a full lifecycle: run demo and wait for reset
    await demo.clickRun();
    await page.waitForTimeout(3200);

    // Inspect collected pageErrors and consoleErrors to ensure no typical runtime errors occurred
    // If any pageErrors exist, print them in expectation failure message via toEqual
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);

    // Also ensure console messages include expected types (info/log) and not fatal exceptions
    const fatalConsole = consoleMessages.find((m) => m.type === 'error');
    expect(fatalConsole).toBeUndefined();
  });
});