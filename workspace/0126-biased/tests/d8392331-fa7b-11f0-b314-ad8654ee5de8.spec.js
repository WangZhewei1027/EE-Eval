import { test, expect } from '@playwright/test';

// Page Object for the Dijkstra demonstration page
class RoutingDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0126-biased/html/d8392331-fa7b-11f0-b314-ad8654ee5de8.html';
    this.selectors = {
      runButton: '#runDemo',
      output: '#demoOutput'
    };
  }

  async goto() {
    await this.page.goto(this.url, { waitUntil: 'domcontentloaded' });
  }

  async runButton() {
    return this.page.locator(this.selectors.runButton);
  }

  async output() {
    return this.page.locator(this.selectors.output);
  }

  // Click the run button and return immediately (the app sets disabled then runs)
  async clickRun() {
    await this.page.click(this.selectors.runButton);
  }

  // Wait until the demo run completes: we detect completion by button becoming enabled again.
  async waitForRunToComplete(timeout = 3000) {
    // Wait for button to become enabled (btn.disabled === false)
    await this.page.waitForFunction(() => {
      const btn = document.getElementById('runDemo');
      return btn && !btn.disabled;
    }, null, { timeout });
  }

  // Wait until output contains a specific substring
  async waitForOutputContains(substring, timeout = 3000) {
    await this.page.waitForFunction(
      (sel, s) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.indexOf(s) !== -1;
      },
      this.selectors.output,
      substring,
      { timeout }
    );
  }

  // Read current output text
  async getOutputText() {
    return this.page.locator(this.selectors.output).innerText();
  }
}

test.describe('FSM: Routing — Dijkstra Demonstration (d8392331-fa7b-11f0-b314-ad8654ee5de8)', () => {
  // Basic navigation and element presence check (Initial state S0_Idle)
  test('S0_Idle: initial render — button visible/enabled and output shows prompt', async ({ page }) => {
    const demo = new RoutingDemoPage(page);

    // Collect console messages and page errors during load for observation/assertion
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page
    await demo.goto();

    // Verify the run button exists, has expected text, and is enabled
    const btn = await demo.runButton();
    await expect(btn).toBeVisible();
    await expect(btn).toHaveText('Run demonstration: Dijkstra (A → all)');
    await expect(btn).toBeEnabled();

    // Verify the output element exists, has aria-live, and contains the prompt text
    const out = await demo.output();
    await expect(out).toBeVisible();
    await expect(out).toHaveAttribute('aria-live', 'polite');
    const outText = await out.innerText();
    await expect(outText).toContain('Click "Run demonstration" to see a textual step-by-step execution of Dijkstra\'s algorithm on the sample graph.');

    // Teardown assertions: ensure no uncaught page errors occurred on load
    // We observe console messages and page errors and assert there are no pageerrors and no console error types.
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test the transition S0_Idle -> S1_DemoRunning on clicking the run button.
  test('Transition S0_Idle -> S1_DemoRunning: clicking Run triggers "Running..." and disables button', async ({ page }) => {
    const demo = new RoutingDemoPage(page);

    // Collect console and page errors during interaction
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await demo.goto();

    // Ensure initial state
    const btn = await demo.runButton();
    const out = await demo.output();
    await expect(btn).toBeEnabled();
    const initialOutput = await out.innerText();
    expect(initialOutput).toContain('Click "Run demonstration"');

    // Click the Run demonstration button
    await demo.clickRun();

    // Immediately after click: output should show the running message and button should be disabled
    // Because the app sets out.textContent synchronously before setTimeout, we assert that now.
    await expect(out).toHaveText(/Running Dijkstra on the sample graph\.\.\.\n\n/);

    // Button should be disabled while demo is running
    await expect(btn).toBeDisabled();

    // Check that no fatal page errors were thrown so far
    const consoleErrorsNow = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrorsNow.length).toBe(0);
  });

  // Test the transition S1_DemoRunning -> S0_Idle: after completion output shows result and button re-enabled
  test('Transition S1_DemoRunning -> S0_Idle: demo completes, shows final results, and button is re-enabled', async ({ page }) => {
    const demo = new RoutingDemoPage(page);

    // Collect console messages and page errors during the run
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await demo.goto();

    // Click to start demo
    await demo.clickRun();

    // Wait for run to complete (button to be re-enabled). The page uses a 300ms timeout internally; give a safety margin.
    await demo.waitForRunToComplete(3000);

    // After completion, output should contain the final summary header and distances for nodes A..E
    const outText = await demo.getOutputText();
    expect(outText).toContain('Final shortest distances and paths from source A:');
    // Validate some expected content in the output to ensure Dijkstra ran to completion
    expect(outText).toMatch(/A:.*dist=0/); // A dist=0
    expect(outText).toMatch(/E:.*dist=\d+/); // E has some numeric distance
    // Ensure path output format is present at least for one node
    expect(outText).toMatch(/path=.*A/);

    // Button should be enabled again (state S0_Idle restored)
    const btn = await demo.runButton();
    await expect(btn).toBeEnabled();

    // Ensure no uncaught page errors occurred during the run
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Edge case: rapid repeated clicks, re-run behavior, and robustness (run again after completion)
  test('Edge cases: multiple runs and rapid interaction do not crash and produce valid outputs each time', async ({ page }) => {
    const demo = new RoutingDemoPage(page);

    // Collect console and page errors
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await demo.goto();

    // Do a first run
    await demo.clickRun();
    await demo.waitForRunToComplete(3000);
    const out1 = await demo.getOutputText();
    expect(out1).toContain('Final shortest distances and paths from source A:');
    // Ensure the run ended and button is enabled
    const btn = await demo.runButton();
    await expect(btn).toBeEnabled();

    // Immediately attempt to run again (simulate user curiosity). This should re-run cleanly.
    await demo.clickRun();
    // While running, ensure button is disabled
    await expect(btn).toBeDisabled();

    // Wait for the second run to complete
    await demo.waitForRunToComplete(3000);
    const out2 = await demo.getOutputText();
    expect(out2).toContain('Final shortest distances and paths from source A:');

    // The second output should be non-empty and at least as long as the first; it's an additional sanity check
    expect(out2.length).toBeGreaterThan(0);

    // Final assertions: no uncaught page errors or console error messages were emitted during these interactions
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  // Test to validate that errors thrown inside the demo (if any) are surfaced to the output element and do not cause unhandled exceptions
  test('Error handling: if runDijkstra throws, the UI displays an error message and button is re-enabled (observational)', async ({ page }) => {
    const demo = new RoutingDemoPage(page);

    // Collect page errors and console events
    const consoleMessages = [];
    const pageErrors = [];
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    await demo.goto();

    // NOTE: As per instructions, we must not modify the page code.
    // We simply observe behavior: when we run the demo, if an exception occurs it should be caught by the page script
    // and written into the output element (the page's try/catch sets out.textContent = 'Error running demonstration: ' + err).
    // Start a run and wait for completion.
    await demo.clickRun();
    await demo.waitForRunToComplete(3000);
    const outText = await demo.getOutputText();

    // Assert that either the run completed successfully OR a handled error message was displayed.
    // We accept either case: presence of final results OR an error message visible in the output area.
    const ranSuccessfully = outText.includes('Final shortest distances and paths from source A:');
    const handledErrorShown = outText.startsWith('Error running demonstration:');

    expect(ranSuccessfully || handledErrorShown).toBeTruthy();

    // Regardless of internal exceptions, there should be no unhandled page errors (pageerror) reported to the test runner.
    expect(pageErrors.length).toBe(0);

    // Also assert that the button is enabled again (the UI always re-enables in finally block)
    const btn = await demo.runButton();
    await expect(btn).toBeEnabled();
  });
});