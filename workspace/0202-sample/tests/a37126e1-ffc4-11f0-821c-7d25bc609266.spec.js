import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a37126e1-ffc4-11f0-821c-7d25bc609266.html';

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runSelector = '#run-demo';
    this.outputSelector = '#demo-output';
  }

  // Navigate to the application URL
  async goto() {
    await this.page.goto(APP_URL);
  }

  // Click the Run Demo button
  async clickRun() {
    await this.page.click(this.runSelector);
  }

  // Get the raw text content of the demo output div
  async getOutputText() {
    return (await this.page.textContent(this.outputSelector)) || '';
  }

  // Wait until the Running message appears in the output
  async waitForRunningMessage(timeout = 1000) {
    const marker = 'Running Bellman-Ford Algorithm...';
    await this.page.waitForFunction(
      ([sel, m]) => {
        const el = document.querySelector(sel);
        return !!el && el.textContent.includes(m);
      },
      [this.outputSelector, marker],
      { timeout }
    );
  }

  // Wait for final output marker that indicates completion
  async waitForFinalOutput(timeout = 3000) {
    const finalMarker = "Final shortest distances from source 'A':";
    await this.page.waitForFunction(
      ([sel, m]) => {
        const el = document.querySelector(sel);
        return !!el && el.textContent.includes(m);
      },
      [this.outputSelector, finalMarker],
      { timeout }
    );
    return this.getOutputText();
  }

  // Convenience: ensure the Run button is visible and enabled
  async expectRunButtonVisible() {
    await expect(this.page.locator(this.runSelector)).toBeVisible();
    await expect(this.page.locator(this.runSelector)).toBeEnabled();
  }

  // Convenience: ensure demo output element exists
  async expectOutputElementExists() {
    await expect(this.page.locator(this.outputSelector)).toBeVisible();
  }
}

test.describe('Bellman-Ford Demo - FSM validation and UI behavior', () => {
  // Collect console errors and page errors for each test
  test.beforeEach(async ({ page }) => {
    // No-op here; listeners are added within tests where needed.
  });

  // Test the initial Idle state (S0_Idle)
  test('Initial Idle state: button present and demo output empty', async ({ page }) => {
    // Capture console errors / page errors that may occur during load
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(String(err)));

    const demo = new DemoPage(page);
    await demo.goto();

    // Validate presence of button and output element
    await demo.expectRunButtonVisible();
    await demo.expectOutputElementExists();

    // The FSM S0_Idle shows evidence of the button and initially the demo output should be empty
    const outputText = await demo.getOutputText();
    // The output may contain whitespace; assert it's empty or whitespace only at Idle state.
    expect(outputText.trim()).toBe('');

    // Assert no console errors or page errors happened during initial load
    expect(consoleErrors, `Console errors during page load: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `Page errors during page load: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  // Test transitions: S0_Idle -> S1_RunningDemo on click, and S1_RunningDemo -> S2_DemoOutput after computation
  test('Clicking Run transitions to RunningDemo then to DemoOutput with final distances', async ({ page }) => {
    // Collect console and page errors during interactions
    const consoleErrors = [];
    const pageErrors = [];
    const consoleMessages = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(String(err)));

    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure starting state
    await demo.expectRunButtonVisible();
    expect((await demo.getOutputText()).trim()).toBe('');

    // Click the run button to trigger transition to S1_RunningDemo
    await demo.clickRun();

    // Immediately the UI should update to show the Running message per entry action
    await demo.waitForRunningMessage(1000);
    const runningText = await demo.getOutputText();
    expect(runningText).toContain('Running Bellman-Ford Algorithm...');

    // Now wait for the demo to finish and final output to appear (S2_DemoOutput)
    const finalText = await demo.waitForFinalOutput(3000);

    // Final output must include negative cycle check and final distances as described in FSM/evidence
    expect(finalText).toContain('No negative-weight cycles detected.');
    expect(finalText).toContain("Final shortest distances from source 'A':");

    // Check the expected distances as described in the HTML implementation
    // The sample provided states dist[A]=0, B=3, C=2, D=0, E=6
    // The output lines look like " A : 0"
    expect(finalText).toContain('A : 0');
    expect(finalText).toContain('B : 3');
    expect(finalText).toContain('C : 2');
    expect(finalText).toContain('D : 0');
    expect(finalText).toContain('E : 6');

    // Ensure there were no console errors or uncaught page errors during the run
    expect(consoleErrors, `Console errors during demo run: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `Page errors during demo run: ${pageErrors.join(' | ')}`).toHaveLength(0);

    // Optionally assert that we saw some console activity (not required), but at least capture what was logged
    // This helps debugging if future regressions print unexpected errors.
    // We assert that there were some console calls (could be empty) but not errors.
    // No strict expectation for consoleMessages length beyond the error check above.
  });

  // Edge case: clicking multiple times in quick succession should not cause uncaught exceptions
  test('Multiple quick clicks do not throw errors and produce correct final output', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', err => pageErrors.push(String(err)));

    const demo = new DemoPage(page);
    await demo.goto();

    // Click twice quickly to simulate a user double-clicking the Run button
    await demo.clickRun();
    // Click again almost immediately to simulate rapid user interaction
    await demo.clickRun();

    // After clicks, the UI should show the running message
    await demo.waitForRunningMessage(1000);
    expect((await demo.getOutputText()).includes('Running Bellman-Ford Algorithm...')).toBeTruthy();

    // Wait for final result - the last scheduled computation should complete and replace the output
    const finalText = await demo.waitForFinalOutput(5000);

    // Confirm final expected content still present
    expect(finalText).toContain("Final shortest distances from source 'A':");
    expect(finalText).toContain('No negative-weight cycles detected.');
    expect(finalText).toContain('A : 0');
    expect(finalText).toContain('B : 3');
    expect(finalText).toContain('C : 2');
    expect(finalText).toContain('D : 0');
    expect(finalText).toContain('E : 6');

    // Assert no runtime errors occurred due to multiple clicks
    expect(consoleErrors, `Console errors after multiple clicks: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `Page errors after multiple clicks: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  // Accessibility and DOM attributes validation (component evidence)
  test('DOM structure and accessibility attributes match FSM components evidence', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // The Run button exists with correct id per FSM evidence
    const runButton = page.locator('#run-demo');
    await expect(runButton).toHaveCount(1);
    await expect(runButton).toHaveText('Run Bellman-Ford Demo');

    // The demo output div exists with class "demo-output" and aria-live="polite"
    const output = page.locator('#demo-output');
    await expect(output).toHaveCount(1);
    await expect(output).toHaveClass(/demo-output/);
    const ariaLive = await output.getAttribute('aria-live');
    expect(ariaLive).toBe('polite');

    // Initially, output should be empty (Idle state)
    expect((await demo.getOutputText()).trim()).toBe('');
  });

  // Negative test: ensure that no unexpected exceptions like ReferenceError/SyntaxError/TypeError appear during normal usage
  test('No unexpected runtime exceptions (ReferenceError, SyntaxError, TypeError) during normal interactions', async ({ page }) => {
    const runtimeErrors = [];
    const consoleErrors = [];
    page.on('pageerror', err => runtimeErrors.push(err));
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const demo = new DemoPage(page);
    await demo.goto();

    // Perform typical user action
    await demo.clickRun();
    await demo.waitForFinalOutput(3000);

    // Assert there were zero runtime exceptions captured
    // If any of ReferenceError/SyntaxError/TypeError happen, pageerror will capture them and this assertion will fail.
    expect(runtimeErrors.length, `Runtime exceptions: ${runtimeErrors.map(e => String(e)).join(' | ')}`).toBe(0);
    expect(consoleErrors.length, `Console errors: ${consoleErrors.join(' | ')}`).toBe(0);
  });
});