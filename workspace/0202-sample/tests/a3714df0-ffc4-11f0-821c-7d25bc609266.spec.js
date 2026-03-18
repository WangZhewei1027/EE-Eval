import { test, expect } from '@playwright/test';

// Test suite for the interactive Topological Sort demo (Application ID: a3714df0-ffc4-11f0-821c-7d25bc609266)
// The tests validate the FSM states (Idle, Demo Running), transitions (RunDemoClick),
// DOM updates, accessibility attributes, and observe console / page errors during load and interaction.

// URL where the HTML is served (per requirements)
const APP_URL =
  'http://127.0.0.1:5500/workspace/0202-sample/html/a3714df0-ffc4-11f0-821c-7d25bc609266.html';

// Page Object Model for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButtonSelector = '#run-demo';
    this.outputSelector = '#demo-output';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getRunButton() {
    return this.page.locator(this.runButtonSelector);
  }

  async clickRunDemo() {
    const btn = await this.getRunButton();
    await btn.click();
  }

  async getOutput() {
    return this.page.locator(this.outputSelector);
  }

  async outputText() {
    return (await this.getOutput().textContent())?.trim() ?? '';
  }
}

test.describe('Topological Sort Demo - FSM and UI validation', () => {
  // Capture console messages and page errors occurring during navigation and interactions
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages
    page.on('console', (msg) => {
      const entry = {
        type: msg.type(),
        text: msg.text(),
      };
      consoleMessages.push(entry);
      if (msg.type() === 'error') consoleErrors.push(entry);
    });

    // Collect uncaught exceptions from the page
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test('Idle state on initial load: button present, output empty, and no runtime errors', async ({ page }) => {
    // This test validates the S0_Idle state evidence:
    // - The Run Kahn's Algorithm Demo button exists
    // - The demo output region exists and is empty on load
    // - No console errors or uncaught page errors were produced during load

    const demo = new DemoPage(page);

    // Navigate to the page (listeners set up in beforeEach will capture any errors during load)
    await demo.goto();

    // The run button should be visible with the expected id and accessible name
    const runButton = await demo.getRunButton();
    await expect(runButton).toBeVisible();
    await expect(runButton).toHaveAttribute('id', 'run-demo');
    await expect(runButton).toHaveText('Run Kahn\'s Algorithm Demo');

    // The output container should exist, be empty initially, and have the live region attributes
    const output = await demo.getOutput();
    await expect(output).toBeVisible();
    await expect(output).toHaveAttribute('aria-live', 'polite');
    await expect(output).toHaveAttribute('aria-atomic', 'true');

    // On initial load, the textContent should be empty (or whitespace only)
    const initialText = await demo.outputText();
    expect(initialText).toBe('', 'Expected demo output to be empty on initial load (Idle state)');

    // Verify that no uncaught exceptions or console.error messages were observed during load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_DemoRunning: clicking runs Kahn\'s algorithm and updates DOM', async ({ page }) => {
    // This test validates the RunDemoClick event and the Demo Running state:
    // - Clicking the Run button triggers the algorithm in the page code
    // - The demo output updates with the expected topological order
    // - No uncaught exceptions occur as a result of the interaction

    const demo = new DemoPage(page);
    await demo.goto();

    // Ensure run button is present
    await expect(demo.getRunButton()).toBeVisible();

    // Click the Run button to trigger the demo (this is the RunDemoClick event in the FSM)
    await demo.clickRunDemo();

    // Expected topological order text from the FSM definition / HTML implementation
    const expectedText = 'Topological order found: A, B, D, C, E, F';

    // Wait for the output element to contain the expected text
    await expect(demo.getOutput()).toHaveText(expectedText, { timeout: 2000 });

    // Double-check the textual content exactly matches expected
    const actualText = await demo.outputText();
    expect(actualText).toBe(expectedText);

    // Verify no page errors or console.error were produced during the click
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking the Run button multiple times consistently updates (idempotent visual result)', async ({ page }) => {
    // This test validates the behavior when the user activates the same transition multiple times:
    // - Subsequent clicks should produce the same textual output (textContent is replaced each time)
    // - There should be no accumulation or duplication in the output
    // - No runtime errors are introduced by repeated activations

    const demo = new DemoPage(page);
    await demo.goto();

    const expectedText = 'Topological order found: A, B, D, C, E, F';

    // First click
    await demo.clickRunDemo();
    await expect(demo.getOutput()).toHaveText(expectedText);

    // Capture output after first click
    const first = await demo.outputText();

    // Second click
    await demo.clickRunDemo();
    await expect(demo.getOutput()).toHaveText(expectedText);

    const second = await demo.outputText();

    // The output should be identical and not appended/duplicated
    expect(second).toBe(first, 'Output should remain identical after repeated runs');

    // Confirm no new uncaught errors after repeated interactions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM entry action verification (renderPage/runKahnsAlgorithm) - ensure no global functions were implicitly required', async ({ page }) => {
    // FSM metadata mentions entry actions like "renderPage()" and "runKahnsAlgorithm()".
    // The actual implementation in the HTML does not define these as global functions; the algorithm is contained in the click handler.
    // We verify:
    // - The page does not expose global functions named renderPage or runKahnsAlgorithm
    // - No ReferenceError was thrown related to these names during load (captured via pageErrors / console errors)

    const demo = new DemoPage(page);
    await demo.goto();

    // Evaluate presence of global symbols without modifying the page
    const hasRenderPage = await page.evaluate(() => typeof window.renderPage !== 'undefined');
    const hasRunKahnsAlgorithm = await page.evaluate(() => typeof window.runKahnsAlgorithm !== 'undefined');

    // Expect that these named functions are not defined as globals (implementation uses inline handler)
    expect(hasRenderPage).toBe(false);
    expect(hasRunKahnsAlgorithm).toBe(false);

    // Ensure that absence of these globals did not produce errors during load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Accessibility and DOM attributes remain correct after running demo', async ({ page }) => {
    // This test checks that after the transition to DemoRunning:
    // - The demo-output element retains its aria attributes
    // - The run button remains accessible and usable

    const demo = new DemoPage(page);
    await demo.goto();

    // Pre-check attributes
    await expect(demo.getOutput()).toHaveAttribute('aria-live', 'polite');
    await expect(demo.getOutput()).toHaveAttribute('aria-atomic', 'true');

    // Trigger the demo
    await demo.clickRunDemo();

    // After running, attributes must still be present and unchanged
    await expect(demo.getOutput()).toHaveAttribute('aria-live', 'polite');
    await expect(demo.getOutput()).toHaveAttribute('aria-atomic', 'true');

    // The run button should still be present and interactive
    const runBtn = await demo.getRunButton();
    await expect(runBtn).toBeEnabled();
    await expect(runBtn).toHaveText('Run Kahn\'s Algorithm Demo');

    // Confirm again there are no uncaught exceptions
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case observations: ensure "Cycle detected..." is not emitted for the provided graph', async ({ page }) => {
    // The FSM mentions that DemoRunning could output either a valid ordering or a cycle-detected message.
    // For the hard-coded example graph in the HTML, the expected outcome is the valid ordering.
    // This test asserts the cycle message does not appear for this input.

    const demo = new DemoPage(page);
    await demo.goto();

    // Click to run the demo
    await demo.clickRunDemo();

    const outputText = await demo.outputText();

    // Assert cycle message is not present and expected successful message is present
    expect(outputText).not.toBe('Cycle detected. No topological order possible.');
    expect(outputText).toBe('Topological order found: A, B, D, C, E, F');

    // No runtime errors occurred
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test('Observe page console messages and surface any unexpected errors (summary check)', async ({ page }) => {
    // This final test intentionally gathers and asserts on any console messages collected during an explicit page lifecycle.
    // It serves as a summary check and will fail if there are console.error messages or uncaught exceptions.

    const demo = new DemoPage(page);

    // Navigate and interact once
    await demo.goto();
    await demo.clickRunDemo();

    // Provide debugging context in case of failure: attach captured console messages to assertion error message
    // We assert no console.error messages and no uncaught page errors
    const consoleErrorTexts = consoleErrors.map((c) => c.text);
    const pageErrorMessages = pageErrors.map((e) => (e && e.message) || String(e));

    expect(consoleErrorTexts, `Unexpected console.error messages: ${JSON.stringify(consoleErrorTexts, null, 2)}`).toHaveLength(0);
    expect(pageErrorMessages, `Unexpected uncaught page errors: ${JSON.stringify(pageErrorMessages, null, 2)}`).toHaveLength(0);
  });
});