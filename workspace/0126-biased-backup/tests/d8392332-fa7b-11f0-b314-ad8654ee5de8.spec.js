import { test, expect } from '@playwright/test';

// Test file: d8392332-fa7b-11f0-b314-ad8654ee5de8.spec.js
// Page under test:
// http://127.0.0.1:5500/workspace/0126-biased/html/d8392332-fa7b-11f0-b314-ad8654ee5de8.html

// Page Object for the demo section
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8392332-fa7b-11f0-b314-ad8654ee5de8.html';
    this.runBtn = '#runDemoBtn';
    this.output = '#demoOutput';
  }

  async goto() {
    await this.page.goto(this.url);
    // ensure the demo container is present
    await this.page.waitForSelector(this.runBtn);
    await this.page.waitForSelector(this.output);
  }

  async clickRun() {
    await this.page.click(this.runBtn);
  }

  async isButtonDisabled() {
    return await this.page.$eval(this.runBtn, (b) => b.disabled === true);
  }

  async getOutputText() {
    return await this.page.$eval(this.output, (el) => el.textContent || '');
  }

  // Wait until demo run completes by waiting for the end marker appended by the demo script
  async waitForDemoComplete(timeout = 5000) {
    await this.page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.includes('--- Demo complete ---');
      },
      this.output,
      { timeout }
    );
  }

  // Wait for button to be enabled again (used to validate guard timeout)
  async waitForButtonEnabled(timeout = 2000) {
    await this.page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && el.disabled === false;
      },
      this.runBtn,
      { timeout }
    );
  }

  // Count occurrences of a substring in the output
  async countOutputOccurrences(substr) {
    const text = await this.getOutputText();
    return (text.match(new RegExp(substr, 'g')) || []).length;
  }

  // Wait until output contains a specific substring
  async waitForOutputContains(substr, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, s) => {
        const el = document.querySelector(sel);
        return el && (el.textContent || '').includes(s);
      },
      this.output,
      substr,
      { timeout }
    );
  }
}

test.describe('Congestion Control AIMD Demo — FSM validation and UI behavior', () => {
  // Arrays to capture console errors and page errors for assertions
  let consoleErrors = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages and errors
    page.on('console', (msg) => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      } catch (e) {
        // ignore observer errors
      }
    });

    page.on('pageerror', (err) => {
      // record stack/message for assertions
      pageErrors.push(String(err && err.stack ? err.stack : err));
    });
  });

  test.afterEach(async () => {
    // Nothing to teardown beyond Playwright's fixtures; captured errors will be asserted in tests.
  });

  test('Initial state (S0_Idle) renders the Run button and initial text', async ({ page }) => {
    // This test validates the Idle state from the FSM:
    // - renderPage() implied: button and pre exist with initial prompt text
    const demo = new DemoPage(page);
    await demo.goto();

    // Button should exist and be enabled initially (Idle)
    const btn = await page.$(demo.runBtn);
    expect(btn).not.toBeNull();
    expect(await page.isVisible(demo.runBtn)).toBe(true);
    expect(await demo.isButtonDisabled()).toBe(false);

    // Pre element should contain the instructional text (evidence for Idle)
    const text = await demo.getOutputText();
    expect(text).toContain('Press "Run Simple AIMD Demo" to start the trace');

    // There should be no runtime page errors when loading the page
    expect(pageErrors).toEqual([]);
    // And no console.error messages captured at this point
    expect(consoleErrors).toEqual([]);
  });

  test('Transition S0_Idle -> S1_DemoRunning on click: demo output is generated and button is disabled during run', async ({ page }) => {
    // This test validates the RunDemoClick event and the DemoRunning state:
    // - clicking the run button triggers runDemo()
    // - output is cleared and new trace appears
    // - button is disabled immediately and re-enabled after the guard timeout
    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure initial text present
    const initialText = await demo.getOutputText();
    expect(initialText).toContain('Press "Run Simple AIMD Demo" to start the trace');

    // Click the Run button to trigger the demo
    await demo.clickRun();

    // Immediately after click, the button should be disabled (guard to avoid multiple starts)
    expect(await demo.isButtonDisabled()).toBe(true);

    // The demo's runDemo clears the output at start, so the initial prompt should no longer be present
    // Wait briefly for the script to execute and produce early output lines
    await demo.waitForOutputContains('Simple AIMD trace:', 2000);
    const textAfterRunStart = await demo.getOutputText();
    expect(textAfterRunStart).not.toContain('Press "Run Simple AIMD Demo" to start the trace');

    // The run produces the table header as evidence
    expect(textAfterRunStart).toContain('RTT\tPhase\tcwnd\tAction');

    // The deterministic loss events in the demo should be present (LOSS detected!)
    expect(textAfterRunStart).toContain('LOSS detected!');

    // Wait until the demo run completes (the demo app appends '--- Demo complete ---')
    await demo.waitForDemoComplete(5000);

    // After run completes, the button should be re-enabled (the code sets a timeout to re-enable after 600ms)
    await demo.waitForButtonEnabled(2000);
    expect(await demo.isButtonDisabled()).toBe(false);

    // Final output should contain the end marker
    const finalText = await demo.getOutputText();
    expect(finalText.trim().endsWith('--- Demo complete ---')).toBe(true);

    // Assert no unexpected runtime errors occurred during the run
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Guarding: rapid double-clicks do not start multiple concurrent demos', async ({ page }) => {
    // This test validates the guard behavior referenced in the FSM exit action (btn.disabled=true)
    // and the setTimeout(..., 600) evidence — rapid clicks should not cause two demo traces to appear.
    const demo = new DemoPage(page);
    await demo.goto();

    // Count occurrences of the run banner before any runs
    const countBefore = await demo.countOutputOccurrences('Simple AIMD trace:');

    // Click the run button twice in quick succession
    await demo.clickRun();
    // Attempt a second click immediately; since the button is disabled by script, this should not trigger another run
    // Playwright's page.click will attempt to click; if the element is disabled the click should be a no-op in the page
    try {
      await demo.clickRun();
    } catch (e) {
      // If Playwright throws due to element being detached / not clickable, swallow; we care about runtime behavior
    }

    // Wait for run completion
    await demo.waitForDemoComplete(5000);

    // Count occurrences of the run banner after the attempted double-start
    const countAfter = await demo.countOutputOccurrences('Simple AIMD trace:');

    // There should be exactly 1 additional occurrence vs before, not 2 (i.e., double-start prevented)
    expect(countAfter - countBefore).toBe(1);

    // Ensure no console / page errors occurred
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Consecutive runs produce fresh output and re-enable the button between runs', async ({ page }) => {
    // This test validates that after a run finishes, the application returns to Idle state
    // and can be transitioned to DemoRunning again on another click.
    const demo = new DemoPage(page);
    await demo.goto();

    // First run
    await demo.clickRun();
    await demo.waitForDemoComplete(5000);
    await demo.waitForButtonEnabled(2000);
    expect(await demo.isButtonDisabled()).toBe(false);

    const firstRunText = await demo.getOutputText();
    expect(firstRunText).toContain('Simple AIMD trace:');
    expect(firstRunText).toContain('--- Demo complete ---');

    // Second run
    await demo.clickRun();
    // After clicking again, the button should once again be disabled immediately
    expect(await demo.isButtonDisabled()).toBe(true);

    // Wait for second run completion
    await demo.waitForDemoComplete(5000);
    await demo.waitForButtonEnabled(2000);
    expect(await demo.isButtonDisabled()).toBe(false);

    const secondRunText = await demo.getOutputText();

    // The output should be refreshed; the second run should also contain the same markers
    expect(secondRunText).toContain('Simple AIMD trace:');
    expect(secondRunText).toContain('--- Demo complete ---');

    // The content for the second run should be non-empty and likely different from the first run because
    // the script clears the output at the start of each run. We assert that at least the run banner is present once.
    expect(await demo.countOutputOccurrences('Simple AIMD trace:')).toBeGreaterThanOrEqual(1);

    // No JS errors during consecutive runs
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Edge case: validate demo internal logic elements are present in DOM output (phases and loss ticks)', async ({ page }) => {
    // This test inspects the textual trace to ensure the demo produced expected internal events:
    // - SlowStart and CongAvoid phases included
    // - Several LOSS detected! lines appear at the deterministic times (t=8,16,24)
    const demo = new DemoPage(page);
    await demo.goto();

    await demo.clickRun();
    await demo.waitForDemoComplete(5000);

    const out = await demo.getOutputText();

    // There should be mentions of both phases
    expect(out).toContain('SlowStart');
    expect(out).toContain('CongAvoid');

    // There should be at least three LOSS occurrences as per the deterministic Set([8,16,24])
    const lossCount = (out.match(/LOSS detected!/g) || []).length;
    expect(lossCount).toBeGreaterThanOrEqual(3);

    // Check that RTT ticks (numbered lines) exist for the demo length (30 RTTs)
    // Look for '1\t' and '30\t' to ensure the loop covered the range
    expect(out).toContain('1\t');
    expect(out).toContain('30\t');

    // No JS errors while collecting output
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Console and page error observation: assert no unexpected runtime exceptions (ReferenceError/TypeError/SyntaxError) were thrown', async ({ page }) => {
    // This test explicitly inspects captured console and page errors and asserts none are present.
    const demo = new DemoPage(page);
    await demo.goto();

    // Run demo to exercise interactive JS paths
    await demo.clickRun();
    await demo.waitForDemoComplete(5000);
    await demo.waitForButtonEnabled(2000);

    // Inspect recorded pageErrors and consoleErrors for runtime exception mentions
    // They should be empty arrays; if not, the test will surface them for debugging.
    if (pageErrors.length > 0) {
      // Provide additional diagnostics in the assertion message
      throw new Error('Unexpected page errors were observed:\n' + pageErrors.join('\n\n'));
    }
    if (consoleErrors.length > 0) {
      throw new Error('Unexpected console.error messages were observed:\n' + consoleErrors.join('\n\n'));
    }

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});