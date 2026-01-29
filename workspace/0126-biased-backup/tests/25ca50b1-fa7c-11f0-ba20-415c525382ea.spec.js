import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25ca50b1-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo page
class TernaryDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  get runButton() {
    return this.page.locator('#run-demo');
  }

  get output() {
    return this.page.locator('#demo-output');
  }

  async clickRun() {
    await this.runButton.click();
  }

  async getButtonText() {
    return this.runButton.textContent();
  }

  async isButtonDisabled() {
    return this.runButton.evaluate((b) => b.disabled);
  }

  async getOutputText() {
    return this.output.textContent();
  }
}

test.describe('Ternary Search Demo - FSM states and transitions', () => {
  // capture console messages and page errors per test
  test.beforeEach(async ({ page }) => {
    // Ensure we capture console messages and page errors so we can assert their presence/absence
    page.context()._capturedConsole = [];
    page.context()._capturedPageErrors = [];

    page.on('console', (msg) => {
      // Store a simplified record for assertions
      page.context()._capturedConsole.push({
        type: msg.type(),
        text: msg.text(),
      });
    });

    page.on('pageerror', (err) => {
      page.context()._capturedPageErrors.push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // Helpful debugging output if a test fails - but do not modify page behavior
    const consoles = page.context()._capturedConsole || [];
    const pageErrors = page.context()._capturedPageErrors || [];
    // Attach to test output (Playwright will show these when a test fails)
    if (consoles.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Captured console messages:', consoles);
    }
    if (pageErrors.length > 0) {
      // eslint-disable-next-line no-console
      console.log('Captured page errors:', pageErrors);
    }
  });

  test('S0_Idle: initial render shows Run button and empty demo output', async ({ page }) => {
    // Validate initial state (Idle) per FSM: renderPage() entry action should have produced the button
    const demo = new TernaryDemoPage(page);
    await demo.goto();

    // The Run button should be present, enabled, and have the expected text
    await expect(demo.runButton).toBeVisible();
    await expect(demo.runButton).toHaveAttribute('type', 'button');
    await expect(await demo.getButtonText()).toContain('Run Ternary Search Demo');
    expect(await demo.isButtonDisabled()).toBe(false);

    // The demo output container should exist and be empty initially
    await expect(demo.output).toBeVisible();
    const initialText = (await demo.getOutputText()) || '';
    expect(initialText.trim()).toBe('');

    // Verify aria-live attribute presence for visual component
    await expect(demo.output).toHaveAttribute('aria-live', 'polite');

    // Ensure no runtime errors (ReferenceError/SyntaxError/TypeError) were emitted during load
    const pageErrors = page.context()._capturedPageErrors || [];
    expect(pageErrors.length).toBe(0);

    const consoles = page.context()._capturedConsole || [];
    // No console error-level messages should have been emitted on page load
    const errorConsoles = consoles.filter(c => c.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(c.text));
    expect(errorConsoles.length).toBe(0);
  });

  test('S0_Idle -> S1_DemoRunning -> S2_DemoCompleted: clicking Run triggers demo and completes', async ({ page }) => {
    // This test validates the transition chain described in the FSM:
    // - From Idle, RunDemo click starts the demo (S1_DemoRunning entry action startDemo())
    // - Demo finishes and button is disabled with text 'Demo Completed' (S2_DemoCompleted entry action displayResults())
    const demo = new TernaryDemoPage(page);
    await demo.goto();

    // Listen for potential console logs during the demo run (already set up in beforeEach)

    // Click the run button to start the demo
    await demo.clickRun();

    // Wait for the demo to complete: the implementation sets button.disabled = true and text to 'Demo Completed'
    await page.waitForFunction(() => {
      const btn = document.querySelector('#run-demo');
      return btn && btn.disabled === true && btn.textContent.includes('Demo Completed');
    }, { timeout: 5000 });

    // Validate button state reflects S2_DemoCompleted exit/entry actions
    expect(await demo.isButtonDisabled()).toBe(true);
    expect((await demo.getButtonText()).trim()).toBe('Demo Completed');

    // Validate output contains the expected demonstration log and final approximations
    const outputText = (await demo.getOutputText()) || '';
    // There should be at least one iteration recorded
    expect(outputText).toContain('Iteration 1:');
    // There should be a final "Approximate maximum found at x ≈" line
    expect(outputText).toMatch(/Approximate maximum found at x ≈/);
    // And a function value line
    expect(outputText).toMatch(/Function value at maximum f\(x\) ≈/);

    // Ensure the result is near the theoretical maximum x = 2, value = 3
    // Extract the approximate x and y from the output to validate convergence
    const lines = outputText.split('\n').map(l => l.trim()).filter(Boolean);
    const approxLine = lines.find(l => l.startsWith('Approximate maximum found at x ≈'));
    const valueLine = lines.find(l => l.startsWith('Function value at maximum f(x) ≈'));
    expect(approxLine).toBeTruthy();
    expect(valueLine).toBeTruthy();

    // Parse numeric values if present
    const xMatch = approxLine.match(/x ≈ ([0-9.+-Ee]+)/);
    const yMatch = valueLine.match(/f\(x\) ≈ ([0-9.+-Ee-]+)/);
    if (xMatch && yMatch) {
      const x = Number(xMatch[1]);
      const y = Number(yMatch[1]);
      // The approximation should be close to x=2 and y=3 within a reasonable tolerance given epsilon=0.001
      expect(Math.abs(x - 2)).toBeLessThan(0.01);
      expect(Math.abs(y - 3)).toBeLessThan(0.01);
    }

    // Ensure no runtime page errors of the common error types occurred during this interaction
    const pageErrors = page.context()._capturedPageErrors || [];
    expect(pageErrors.length).toBe(0);

    const consoles = page.context()._capturedConsole || [];
    const criticalConsoleErrors = consoles.filter(c => c.type === 'error' || /ReferenceError|SyntaxError|TypeError/.test(c.text));
    expect(criticalConsoleErrors.length).toBe(0);
  });

  test('Edge case: clicking the Run button after completion does not change state or output', async ({ page }) => {
    // Verify idempotent behavior after demo completion (button disabled => clicking should not trigger additional logs)
    const demo = new TernaryDemoPage(page);
    await demo.goto();

    // Run demo once
    await demo.clickRun();
    await page.waitForFunction(() => {
      const btn = document.querySelector('#run-demo');
      return btn && btn.disabled === true;
    }, { timeout: 5000 });

    const beforeOutput = await demo.getOutputText();

    // Attempt to click the button after it is disabled. Playwright will throw if trying to click a disabled button
    // So we guard this by checking disabled state and attempting to click via JS to simulate a pathological user (not recommended)
    // IMPORTANT: We will not modify page functions; we will attempt a direct DOM click only if the button is not disabled.
    const disabled = await demo.isButtonDisabled();
    expect(disabled).toBe(true);

    // Because the button is disabled, a user click shouldn't trigger anything. Ensure output remains identical after attempting to interact.
    // Try to dispatch a synthetic click event that respects the disabled property (browser won't dispatch for disabled buttons).
    // We will still attempt to click via JS but expect no changes to output within a small timeout.
    await page.evaluate(() => {
      const btn = document.querySelector('#run-demo');
      if (btn && !btn.disabled) {
        btn.click();
      }
      // If disabled, do nothing - this mirrors browser behavior: disabled buttons do not react to user clicks.
    });

    // Wait briefly for any unexpected changes (there should be none)
    await page.waitForTimeout(250);

    const afterOutput = await demo.getOutputText();
    expect(afterOutput).toBe(beforeOutput);
  });

  test('Error observation: assert no ReferenceError / SyntaxError / TypeError occurred during full lifecycle', async ({ page }) => {
    // This test explicitly inspects console and page errors for the common runtime error types.
    // Per instructions we "observe" console logs and page errors and assert their (non-)occurrence.
    const demo = new TernaryDemoPage(page);
    await demo.goto();

    // Run the demo to exercise the full script
    await demo.clickRun();

    // Wait until completion
    await page.waitForFunction(() => {
      const btn = document.querySelector('#run-demo');
      return btn && btn.disabled === true;
    }, { timeout: 5000 });

    // Now check captured consoles and page errors
    const consoles = page.context()._capturedConsole || [];
    const pageErrors = page.context()._capturedPageErrors || [];

    // There should be no page errors at all
    expect(pageErrors.length).toBe(0);

    // There should be no console entries that indicate SyntaxError, ReferenceError, or TypeError
    const errorPattern = /ReferenceError|SyntaxError|TypeError/;
    const matched = consoles.filter(c => errorPattern.test(c.text) || c.type === 'error');
    expect(matched.length).toBe(0);
  });

  test('FSM evidence checks: ensure event handler presence and demo output shows iteration logging', async ({ page }) => {
    // Confirm that DOM contains evidence strings referenced in FSM: event listener (we cannot introspect JS functions directly),
    // but we can ensure that clicking the button produces logs consistent with the handler being set up.
    const demo = new TernaryDemoPage(page);
    await demo.goto();

    // Verify the button element exists as FSM component evidence
    await expect(page.locator('button#run-demo')).toHaveCount(1);

    // Before clicking, the output is empty
    expect((await demo.getOutputText()).trim()).toBe('');

    // Click to trigger the event handler
    await demo.clickRun();

    // The output should now contain iteration logs demonstrating the handler executed
    await page.waitForFunction(() => {
      const out = document.querySelector('#demo-output');
      return out && /Iteration 1:/.test(out.textContent || '');
    }, { timeout: 3000 });

    const outputText = await demo.getOutputText();
    expect(outputText).toContain('Iteration 1:');

    // Ensure the output contains lines indicating Decision steps per FSM expected_observables
    expect(outputText).toMatch(/Decision: f\(m1\) (?:<|>=) f\(m2\)/);

    // Final state validation (button disabled & 'Demo Completed' text) per FSM evidence for S2_DemoCompleted
    await page.waitForFunction(() => {
      const btn = document.querySelector('#run-demo');
      return btn && btn.disabled && btn.textContent.includes('Demo Completed');
    }, { timeout: 3000 });

    expect(await demo.isButtonDisabled()).toBe(true);
  });
});