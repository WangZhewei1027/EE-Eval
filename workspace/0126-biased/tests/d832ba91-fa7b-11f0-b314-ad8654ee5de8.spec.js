import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/d832ba91-fa7b-11f0-b314-ad8654ee5de8.html';

// Page object for the demo area
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.button = page.locator('#demoBtn');
    this.console = page.locator('#demoConsole');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Ensure the main content is present
    await expect(this.page.locator('main.wrap')).toBeVisible();
  }

  // Returns the console text content trimmed
  async consoleText() {
    return (await this.console.textContent()) ?? '';
  }

  async clickRunDemo() {
    // Use the real user action to click the button as a user would.
    await this.button.click();
  }

  async isButtonDisabled() {
    return await this.button.evaluate((b) => b.disabled);
  }

  async buttonOpacity() {
    return await this.button.evaluate((b) => window.getComputedStyle(b).opacity);
  }

  async waitForConsoleContains(substring, timeout = 10000) {
    await this.page.waitForFunction(
      (sel, text) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.indexOf(text) !== -1;
      },
      this.console.selector,
      substring,
      { timeout }
    );
  }

  async waitForDemoComplete(timeout = 15000) {
    await this.waitForConsoleContains('Demo complete. Final:', timeout);
  }
}

test.describe('Stack Demo FSM - d832ba91-fa7b-11f0-b314-ad8654ee5de8', () => {
  let demo;
  let consoleMessages;
  let pageErrors;
  let consoleListener;
  let pageErrorListener;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages for inspection (all levels)
    consoleListener = (msg) => {
      // Record {type, text} to examine later
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    };
    page.on('console', consoleListener);

    // Capture uncaught page errors (ReferenceError, TypeError, SyntaxError, etc.)
    pageErrorListener = (err) => {
      pageErrors.push(err);
    };
    page.on('pageerror', pageErrorListener);

    demo = new DemoPage(page);
    await demo.goto();
  });

  test.afterEach(async ({ page }) => {
    if (consoleListener) page.off('console', consoleListener);
    if (pageErrorListener) page.off('pageerror', pageErrorListener);
    // Ensure navigation away at end of test to avoid cross-test interference
    try {
      await page.goto('about:blank');
    } catch (e) {
      // ignore
    }
  });

  test('S0_Idle: initial render shows demo button and console with expected content', async () => {
    // This test validates the Idle state (S0_Idle): the page renders the demo button and initial console text.
    // Verify button exists, is enabled, and has expected aria-controls.
    await expect(demo.button).toBeVisible();
    await expect(demo.button).toBeEnabled();
    await expect(demo.button).toHaveAttribute('id', 'demoBtn');
    await expect(demo.button).toHaveAttribute('aria-controls', 'demoConsole');
    await expect(demo.page.locator('#demoConsole')).toBeVisible();
    const text = await demo.consoleText();
    // The FSM evidence indicates the initial console contains "Demo output will appear here."
    expect(text).toContain('Demo output will appear here');
    // Validate accessibility attributes on the console element (FSM components evidence)
    await expect(demo.page.locator('#demoConsole')).toHaveAttribute('role', 'status');
    await expect(demo.page.locator('#demoConsole')).toHaveAttribute('aria-live', 'polite');

    // No unexpected page errors should have occurred during initial render
    expect(pageErrors.length, 'No uncaught page errors on initial load').toBe(0);
    // Log captured console messages for debugging if needed (but we assert there are no error-level console entries)
    const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleEntries.length, 'No console.error messages on initial load').toBe(0);
  });

  test('S0_Idle -> S1_DemoRunning: clicking the demo button starts the demo and disables the button', async () => {
    // This test validates the transition from Idle to Demo Running (S0 -> S1) by clicking the RunDemo button.
    // Click the demo button
    await demo.clickRunDemo();

    // Immediately after clicking, the button should be disabled (entry action startDemo() results in UI disabled)
    await demo.page.waitForTimeout(50); // tiny wait to let handler run synchronously
    expect(await demo.isButtonDisabled(), 'Button should be disabled immediately after starting demo').toBe(true);

    // The implementation sets style.opacity to '0.7' when disabled; verify visual feedback
    const opacity = await demo.buttonOpacity();
    expect(opacity === '0.7' || opacity === '0.7', 'Button opacity reduced while demo running').toBeTruthy();

    // The console should update to show demo starting text
    await demo.waitForConsoleContains('Demo starting...', 2000);
    const textAfterStart = await demo.consoleText();
    expect(textAfterStart).toContain('Demo starting');
    // Also expect the demo to append subsequent push/pop/peek lines as it runs — wait for the first action
    await demo.waitForConsoleContains('push(1)', 3000);
    const textWithPush = await demo.consoleText();
    expect(textWithPush).toContain('push(1)');
    // No page errors should have happened during demo start
    expect(pageErrors.length, 'No uncaught page errors during demo start').toBe(0);
  });

  test('S1_DemoRunning -> S1_DemoRunning (self-loop) and completion: demo produces expected sequence and re-enables button', async () => {
    // This test validates that the demo runs through its sequence (push, peek, pop, status) and then completes,
    // which corresponds to the S1 self-transition (performStackOperations()) and then ending the demo (endDemo()).
    // Click to start the demo.
    await demo.clickRunDemo();

    // Wait for the demo to run to completion (the page appends "Demo complete. Final: ...")
    // The overall expected time is approximately 300ms initial delay + 9 * 420ms step delays = ~4.2s; allow cushion.
    await demo.waitForDemoComplete(15000);

    // After completion, the button should be re-enabled (exit action endDemo())
    await demo.page.waitForTimeout(100); // small settle time
    expect(await demo.isButtonDisabled(), 'Button should be re-enabled after demo completion').toBe(false);

    // The console content should include the final status and a representation of the stack
    const finalText = await demo.consoleText();
    expect(finalText).toContain('Demo complete. Final:');
    // The demo's steps push 1,2,3 and perform pops/push 42 — ensure some of these lines are present
    expect(finalText).toContain('push(1)');
    expect(finalText).toContain('push(2)');
    expect(finalText).toContain('push(3)');
    expect(finalText).toContain('peek() ->');
    expect(finalText).toContain('pop() -> popped');

    // Ensure the console shows the final stack render (using 'Bottom [' from renderStack)
    expect(finalText).toMatch(/Final: \s*Bottom \[ .* \] Top/);

    // The FSM includes an error state S2 for empty stack operations; confirm that during the normal demo run no ERROR occurred
    expect(finalText.includes('ERROR (empty)'), 'Demo did not produce stack underflow errors in the predefined sequence').toBe(false);

    // No uncaught page errors should have been emitted during the demo run
    expect(pageErrors.length, 'No uncaught page errors during demo run and completion').toBe(0);

    // Also ensure console did not emit any error-level messages during the demo
    const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error');
    expect(errorConsoleEntries.length, 'No console.error messages during demo run').toBe(0);
  });

  test('S2_StackEmpty: verify that error messages for empty stack are not produced in standard demo; edge-case observation', async () => {
    // The FSM defines an error state S2_StackEmpty that would be reachable when pop()/peek() are called on an empty stack.
    // The page's pre-defined demo sequence does not produce such errors. This test asserts that S2 is not triggered for the default demo,
    // and records that S2 is available in code (by asserting the page contains code evidence text fragments).
    // Start the demo and wait to finish quickly to observe behavior.
    await demo.clickRunDemo();
    await demo.waitForDemoComplete(15000);

    const finalText = await demo.consoleText();

    // Assert that the console never contains the known error string for empty operations
    expect(finalText).not.toContain('pop() -> ERROR (empty)');
    expect(finalText).not.toContain('peek() -> ERROR (empty)');

    // As an additional verification, check that the page (HTML) includes the code snippets that would produce these messages
    // (evidence: the page source contains the string "pop() -> ERROR (empty)" in its JavaScript).
    // We will inspect the innerHTML of all script tags to see if the evidence appears (this does not modify runtime).
    const scriptsContent = await demo.page.$$eval('script', (nodes) => nodes.map((n) => n.textContent || ''));
    const joinedScripts = scriptsContent.join('\n');
    // The FSM evidence referenced these exact literal strings; assert that at least one appears in the script text
    const evidencePresent = joinedScripts.includes("pop() -> ERROR (empty)") || joinedScripts.includes("\\npop() -> ERROR (empty)");
    expect(evidencePresent, 'Script evidence for empty-stack error handling should exist in source').toBe(true);

    // Confirm no uncaught page errors were emitted (we are observing behavior only)
    expect(pageErrors.length, 'No uncaught page errors when verifying S2 absence').toBe(0);
  });

  test('Console & Page error monitoring: record and assert absence of runtime exceptions', async () => {
    // This test is focused on observing console and pageerror events while loading and interacting with the demo.
    // It asserts that the page does not produce ReferenceError/SyntaxError/TypeError at runtime under normal operation.

    // Interact: start and complete one demo run to exercise the script
    await demo.clickRunDemo();
    await demo.waitForDemoComplete(15000);

    // Inspect captured page errors and console messages
    // If any pageError exists, fail the test and log the error(s)
    if (pageErrors.length > 0) {
      // Provide extra info for debugging in test output
      for (const err of pageErrors) {
        // eslint-disable-next-line no-console
        console.error('Captured pageerror:', err.message);
      }
    }
    expect(pageErrors.length, 'No uncaught exceptions (ReferenceError/SyntaxError/TypeError) should be present').toBe(0);

    // Ensure there were no console.error messages captured
    const errorConsoleEntries = consoleMessages.filter((m) => m.type === 'error');
    if (errorConsoleEntries.length > 0) {
      for (const e of errorConsoleEntries) {
        // eslint-disable-next-line no-console
        console.error('Captured console.error:', e.text);
      }
    }
    expect(errorConsoleEntries.length, 'No console.error messages should be present during normal use').toBe(0);

    // We expect informational console messages to be zero or benign; assert we didn't capture fatal console events
    const fatalTypes = ['error'];
    const fatalCaptured = consoleMessages.some((m) => fatalTypes.includes(m.type));
    expect(fatalCaptured, 'No fatal console message types captured').toBe(false);
  });
});