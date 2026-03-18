import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a37126e0-ffc4-11f0-821c-7d25bc609266.html';

/**
 * Simple Page Object for the Dijkstra demo page.
 */
class DijkstraDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runDemoBtn');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickRun() {
    await this.runBtn.click();
  }

  async getOutputText() {
    return await this.output.textContent();
  }

  async waitForFinalOutput(timeout = 4000) {
    // Wait until the output includes the completion marker inserted by the demo
    await expect(this.output).toContainText('--- Algorithm completed ---', { timeout });
  }
}

test.describe('Dijkstra Demo - FSM states, transitions and DOM checks', () => {
  // Capture console messages and page errors for each test so we can assert on them.
  /** @type {Array<{type:string,text:string}>} */
  let consoleMessages;
  /** @type {Array<Error>} */
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Collect page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('S0_Idle: Page renders Idle state with Run button and empty demo output', async ({ page }) => {
    // Validate initial idle state - button is present and output is empty
    const demo = new DijkstraDemoPage(page);
    await demo.goto();

    // The FSM Idle state's evidence expects the run button to be present.
    await expect(demo.runBtn).toBeVisible();

    // The demo output should initially be empty (Idle state)
    const initialText = await demo.getOutputText();
    expect(initialText === '' || initialText === null).toBeTruthy();

    // Validate accessibility attributes for the output container
    const ariaLive = await page.getAttribute('#demoOutput', 'aria-live');
    const ariaAtomic = await page.getAttribute('#demoOutput', 'aria-atomic');
    expect(ariaLive).toBe('polite');
    expect(ariaAtomic).toBe('true');

    // No unexpected page errors should be thrown during initial render
    expect(pageErrors.length, `Unexpected page errors on load: ${pageErrors.map(e => e.stack).join('\n')}`).toBe(0);
    // No console errors printed
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors present: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Transition S0_Idle -> S1_Computing: clicking Run shows "Computing... please wait."', async ({ page }) => {
    // This test validates the onEnter action for the Computing state.
    const demo = new DijkstraDemoPage(page);
    await demo.goto();

    // Click the Run button to trigger the transition
    await demo.clickRun();

    // Immediately after clicking, the demoOutput should reflect the "Computing..." message
    await expect(demo.output).toHaveText('Computing... please wait.');

    // Ensure no page errors were thrown by clicking
    expect(pageErrors.length, `Page errors after clicking run: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors after clicking run: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Transition S1_Computing -> S2_Completed: after delay, final results are displayed and include expected distances', async ({ page }) => {
    // This test validates the timed transition to Completed state and the displayResults action.
    const demo = new DijkstraDemoPage(page);
    await demo.goto();

    // Start the demo
    await demo.clickRun();

    // While computing, we should still see the computing message first
    await expect(demo.output).toHaveText('Computing... please wait.');

    // Wait for the final algorithm output to appear (setTimeout uses 200ms in implementation).
    await demo.waitForFinalOutput(3000); // generous timeout to account for CI slowness

    // The final output should include algorithm progress lines and the final distances.
    const finalText = (await demo.getOutputText()) || '';

    // Check for visiting sequence and completion marker
    expect(finalText).toContain('Visiting vertex A');
    expect(finalText).toContain('--- Algorithm completed ---');
    expect(finalText).toContain('Final shortest path distances from source vertex A');

    // Validate the final distances are as expected per FSM/example:
    // dist(A) = 0, B = 3, C = 2, D = 8, E = 10
    // The implementation prints a mapping like "{A: 0, B: 3, C: 2, D: 8, E: 10}"
    expect(finalText).toContain('A: 0');
    expect(finalText).toContain('B: 3');
    expect(finalText).toContain('C: 2');
    expect(finalText).toContain('D: 8');
    expect(finalText).toContain('E: 10');

    // Ensure no uncaught exceptions occurred during the computation
    expect(pageErrors.length, `Page errors during computation: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors during computation: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Edge case: Multiple rapid clicks do not cause uncaught errors and final output is correct', async ({ page }) => {
    // This test simulates repeated user clicks (possible user behavior) and ensures the app handles it.
    const demo = new DijkstraDemoPage(page);
    await demo.goto();

    // Rapidly click the Run button multiple times
    await demo.runBtn.click();
    // Click again almost immediately to simulate accidental double-clicks
    await demo.runBtn.click();
    await demo.runBtn.click();

    // Immediately after clicks, the output should be the "Computing..." message
    await expect(demo.output).toHaveText('Computing... please wait.');

    // Wait for final output to appear; even with multiple enqueued timeouts, we expect a valid final state
    await demo.waitForFinalOutput(4000);

    const finalText = (await demo.getOutputText()) || '';
    // Validate final distances are still correct
    expect(finalText).toContain('{A: 0, B: 3, C: 2, D: 8, E: 10}');

    // Ensure repeated interactions didn't create page errors or console errors
    expect(pageErrors.length, `Page errors after multiple clicks: ${pageErrors.map(e => e.message).join(', ')}`).toBe(0);
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, `Console errors after multiple clicks: ${JSON.stringify(consoleErrors)}`).toBe(0);
  });

  test('Robustness check: Observes console & page errors across a typical interaction sequence', async ({ page }) => {
    // This test purposefully monitors console and errors across the full flow and asserts the absence of runtime errors.
    const demo = new DijkstraDemoPage(page);
    await demo.goto();

    // Start and wait for completion
    await demo.clickRun();
    await demo.waitForFinalOutput(3000);

    // Summarize any console warnings/errors captured for debugging if test fails
    const errors = consoleMessages.filter(m => m.type === 'error');
    const warnings = consoleMessages.filter(m => m.type === 'warning');

    // Assert there were no uncaught page errors
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.length > 0 ? pageErrors.map(e => e.stack).join('\n') : 'none'}`).toBe(0);

    // Allow warnings (non-fatal) but ensure no console.error entries
    expect(errors.length, `console.error messages found: ${errors.map(e => e.text).join(' | ')}`).toBe(0);

    // Add assertion that at least one informational console message was produced or DOM output is present
    expect((await demo.getOutputText())?.length > 0).toBeTruthy();
  });
});