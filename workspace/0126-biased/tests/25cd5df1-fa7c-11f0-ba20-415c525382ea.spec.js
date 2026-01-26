import { test, expect } from '@playwright/test';

// URL of the page under test (as provided)
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cd5df1-fa7c-11f0-ba20-415c525382ea.html';

// Page Object Model for the Interpreter demo page
class InterpreterPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('#run-demo');
    this.output = page.locator('#demo-output');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Ensure the page loaded fully
    await expect(this.page).toHaveURL(APP_URL);
  }

  async isButtonVisible() {
    return await this.runButton.isVisible();
  }

  async isButtonEnabled() {
    // Playwright's isEnabled will check disabled attribute and also whether it's actionable
    return await this.runButton.isEnabled();
  }

  async clickRunDemo() {
    await this.runButton.click();
  }

  async getOutputText() {
    return await this.output.textContent();
  }

  async waitForFinalResult(timeout = 10000) {
    // Wait until final evaluated line appears in demo-output
    await this.page.waitForFunction(() => {
      const out = document.getElementById('demo-output');
      return out && out.textContent && out.textContent.includes('Final evaluated result: 11');
    }, null, { timeout });
  }

  async countOccurrences(substring) {
    const text = (await this.getOutputText()) || '';
    // simple split counting
    if (!substring) return 0;
    return text.split(substring).length - 1;
  }

  async outputHasAriaLive() {
    const attr = await this.output.getAttribute('aria-live');
    return attr === 'polite';
  }
}

// Keep track of console messages and page errors for each test run
test.describe('Interpreter Demo FSM (Application ID: 25cd5df1-fa7c-11f0-ba20-415c525382ea)', () => {
  // Per-test storage for console and page errors
  test.beforeEach(async ({ page }) => {
    // Attach listeners to collect console messages and page errors for assertions
    page['__consoleMessages'] = [];
    page['__pageErrors'] = [];

    page.on('console', msg => {
      // Collect console messages with type and text
      page['__consoleMessages'].push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      // Collect uncaught exceptions that bubble up to 'pageerror'
      page['__pageErrors'].push(err);
    });
  });

  test.afterEach(async ({ page }) => {
    // As part of teardown, we explicitly log the collected console messages and page errors
    // so that test output will contain contextual debugging info if needed.
    const msgs = page['__consoleMessages'] || [];
    const errs = page['__pageErrors'] || [];

    if (msgs.length) {
      // Log to test output so CI logs contain console messages
      console.log('Console messages collected during test:', msgs);
    }
    if (errs.length) {
      console.log('Page errors collected during test:', errs.map(e => e.message || String(e)));
    }
  });

  test('Initial state (S0_Idle): Run Demo button is present, enabled, and demo-output is empty', async ({ page }) => {
    // This test validates the Idle state entry action: renderPage() has placed the button and output div.
    const p = new InterpreterPage(page);
    await p.goto();

    // Assert that the Run Demo button exists and is visible
    await expect(page.locator('#run-demo')).toBeVisible({ timeout: 2000 });
    // Assert the button is enabled in Idle state
    expect(await p.isButtonEnabled()).toBe(true);

    // Assert the demo output div exists and is initially empty (or whitespace)
    const initialOutput = (await p.getOutputText()) || '';
    expect(initialOutput.trim()).toBe('', 'Expected demo-output to be empty on initial render');

    // Assert accessibility attribute aria-live exists and is polite
    expect(await p.outputHasAriaLive()).toBe(true);

    // Validate no console errors or uncaught page errors occurred on initial render
    const consoleMessages = page['__consoleMessages'] || [];
    const pageErrors = page['__pageErrors'] || [];
    // We expect no console-level 'error' messages and no uncaught page errors for a healthy page load
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length, 'No console.error messages expected on initial load').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors expected on initial load').toBe(0);
  });

  test('Transition S0 -> S1 (RunDemo event): clicking the button disables it and starts demoEvaluation', async ({ page }) => {
    // This test simulates the click event and validates entry actions and observables:
    // - Button becomes disabled immediately
    // - Demo output is populated step-by-step
    // - At the end, the button becomes enabled again (S1 -> S0 transition)
    const p = new InterpreterPage(page);
    await p.goto();

    // Click Run Demo and immediately assert the button becomes disabled (exit action of S0 and entry actions of S1)
    await p.clickRunDemo();
    // Immediately after click the button should be disabled
    expect(await p.isButtonEnabled()).toBe(false);

    // Assert that the demo output started to be populated with the initial line
    // Use a waitForFunction to allow the page script to append text asynchronously
    await page.waitForFunction(() => {
      const out = document.getElementById('demo-output');
      return out && out.textContent && out.textContent.includes('Interpreting expression: 2 + 3 * (4 - 1)');
    }, null, { timeout: 2000 });

    // Ensure that the "Interpreting expression" header occurred exactly once even if the user attempted extra clicks
    const interpretingCount = await p.countOccurrences('Interpreting expression: 2 + 3 * (4 - 1)');
    expect(interpretingCount).toBe(1);

    // While the demo runs, assert intermediate steps appear (non-final)
    // Wait for an intermediate step "Step 1" to be visible in output
    await page.waitForFunction(() => {
      const out = document.getElementById('demo-output');
      return out && out.textContent && out.textContent.includes('Step 1: Evaluate inner parentheses (4 - 1)');
    }, null, { timeout: 2500 });

    // The button should remain disabled during the demo execution
    expect(await p.isButtonEnabled()).toBe(false);

    // Wait for final result to appear (demo has several sleeps; allow up to 12s)
    await p.waitForFinalResult(12000);

    // Final asserted content should include the final evaluated result (FSM observable)
    const finalText = (await p.getOutputText()) || '';
    expect(finalText).toContain('Final evaluated result: 11', 'Expected demo to complete and output final result');

    // After demoEvaluation().finally(() => { btn.disabled = false; }) completes, button should be enabled again (S1 -> S0)
    // Wait up to a short period for the finally handler to re-enable the button
    await page.waitForFunction(() => {
      const btn = document.getElementById('run-demo');
      return btn && !btn.disabled;
    }, null, { timeout: 2000 });
    expect(await p.isButtonEnabled()).toBe(true);
  });

  test('Edge case: Rapid multiple clicks do not start multiple parallel demos', async ({ page }) => {
    // This test attempts to click the Run Demo button multiple times in quick succession
    // and validates that the demo runs once (button becomes disabled on first click)
    // and that output does not contain duplicated "Interpreting expression" headers.
    const p = new InterpreterPage(page);
    await p.goto();

    // Rapidly click the button multiple times using JavaScript to simulate quick user interactions
    // Note: Once disabled, subsequent clicks should have no effect.
    await Promise.all([
      p.runButton.click().catch(() => {}), // click once
      page.evaluate(() => {
        // attempt to simulate another click event quickly
        const btn = document.getElementById('run-demo');
        if (btn) {
          try { btn.click(); } catch(e) {}
        }
      })
    ]);

    // Immediately the button should be disabled
    expect(await p.isButtonEnabled()).toBe(false);

    // Wait for the demo to finish
    await p.waitForFinalResult(12000);

    // Ensure "Interpreting expression" only appears once (no duplicate runs)
    const interpretingCount = await p.countOccurrences('Interpreting expression: 2 + 3 * (4 - 1)');
    expect(interpretingCount).toBe(1, 'The demo should have started only once despite multiple quick clicks');

    // Confirm that the final result appears and the button is enabled again
    expect((await p.getOutputText()) || '').toContain('Final evaluated result: 11');
    expect(await p.isButtonEnabled()).toBe(true);
  });

  test('Accessibility and DOM contracts: demo-output has proper attributes and preserves newlines', async ({ page }) => {
    // Validate demo-output has class and aria attributes as declared in FSM components
    const p = new InterpreterPage(page);
    await p.goto();

    const out = page.locator('#demo-output');
    await expect(out).toBeVisible();
    await expect(out).toHaveClass(/demo-output/);
    expect(await out.getAttribute('aria-live')).toBe('polite');
    expect(await out.getAttribute('aria-atomic')).toBe('true');

    // Start the demo and ensure output uses newline-separated lines (white-space: pre-wrap)
    await p.clickRunDemo();
    await p.waitForFinalResult(12000);
    const finalText = (await p.getOutputText()) || '';

    // The output should contain multiple newline characters given step-by-step output
    expect((finalText.match(/\n/g) || []).length).toBeGreaterThanOrEqual(3);

    // Also ensure that important step labels are present
    expect(finalText).toContain('Step 1: Evaluate inner parentheses (4 - 1)');
    expect(finalText).toContain('Step 2: Multiply 3 * (result of parentheses) = 3 * 3');
    expect(finalText).toContain('Final evaluated result: 11');
  });

  test('Observability: capture console messages and uncaught page errors during demo run', async ({ page }) => {
    // This test observes console and page errors while running the demo.
    // It does not inject any errors; it only asserts whether errors occurred naturally.
    const p = new InterpreterPage(page);
    await p.goto();

    // Run the demo and wait for completion
    await p.clickRunDemo();
    await p.waitForFinalResult(12000);

    // Gather collected messages/errors
    const consoleMessages = page['__consoleMessages'] || [];
    const pageErrors = page['__pageErrors'] || [];

    // We expect the page to run without raising uncaught exceptions under normal circumstances.
    // If there are console.error messages or page errors, surface them as test failures with context.
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');

    // Provide helpful failure messages if anything unexpected happened
    expect(errorConsoleMsgs.length, `Expected no console.error messages during demo run, found: ${errorConsoleMsgs.length}`).toBe(0);
    expect(pageErrors.length, `Expected no uncaught page errors during demo run, found: ${pageErrors.length}`).toBe(0);
  });

  test('Negative test: ensure clicking disabled button does not throw and does not start a new demo', async ({ page }) => {
    // This test ensures safety: attempting to click when disabled does not produce errors or additional runs.
    const p = new InterpreterPage(page);
    await p.goto();

    // Start demo
    await p.clickRunDemo();
    // Ensure disabled
    expect(await p.isButtonEnabled()).toBe(false);

    // Attempt to programmatically click again while disabled; should not throw or start another run
    const beforeCount = await p.countOccurrences('Interpreting expression: 2 + 3 * (4 - 1)');
    // Try to click using DOM dispatch of click event (which might be ignored if disabled)
    await page.evaluate(() => {
      const btn = document.getElementById('run-demo');
      if (btn) {
        try {
          // Attempt both click and dispatchEvent to simulate user and programmatic click
          btn.click();
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        } catch (e) {
          // swallow any exceptions here; we assert later based on collected page errors
        }
      }
    });

    // Wait briefly for any spurious new run to start (there should be none)
    await page.waitForTimeout(500);

    const afterCount = await p.countOccurrences('Interpreting expression: 2 + 3 * (4 - 1)');
    expect(afterCount).toBe(beforeCount, 'No new demo run should have been started by extra clicks while disabled');

    // Complete the demo to re-enable button and verify no uncaught errors happened
    await p.waitForFinalResult(12000);
    expect(await p.isButtonEnabled()).toBe(true);

    // Ensure there were no uncaught page errors collected
    const pageErrors = page['__pageErrors'] || [];
    expect(pageErrors.length).toBe(0);
  });
});