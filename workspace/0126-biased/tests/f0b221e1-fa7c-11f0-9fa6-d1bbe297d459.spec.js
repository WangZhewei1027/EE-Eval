import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b221e1-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the Radix Sort demo page
class RadixDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.demoButton = page.locator('#demoButton');
    this.demoOutput = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async isDemoButtonVisible() {
    return await this.demoButton.isVisible();
  }

  async demoButtonText() {
    return await this.demoButton.textContent();
  }

  async clickDemoButton() {
    await this.demoButton.click();
  }

  async getDemoOutputHTML() {
    return await this.demoOutput.innerHTML();
  }

  async getDemoOutputText() {
    return await this.demoOutput.textContent();
  }

  // Helper to wait until a substring is present in demoOutput
  async waitForOutputContains(substring, options = { timeout: 2000 }) {
    await this.page.waitForFunction(
      (selector, substr) => {
        const el = document.querySelector(selector);
        return el && el.innerText.indexOf(substr) !== -1;
      },
      '#demoOutput',
      substring,
      options
    );
  }

  // Returns array of paragraph texts inside demoOutput
  async getOutputParagraphs() {
    return await this.page.$$eval('#demoOutput p', ps => ps.map(p => p.textContent));
  }
}

test.describe('Radix Sort Explained - FSM and UI integration tests', () => {
  // Capture console and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console events (log, error, warning, etc.)
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture unhandled errors (ReferenceError, TypeError, etc.)
    page.on('pageerror', err => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });
  });

  test.afterEach(async () => {
    // Basic sanity: ensure we recorded events arrays (helpful for debugging if assertions fail)
    // No explicit action required here; test assertions will validate these arrays.
  });

  test('S0_Idle: Initial Idle state renders controls and no demo output', async ({ page }) => {
    // This test validates the Idle state (initial) per the FSM:
    // - The "Run Demonstration" button is present (evidence of S0_Idle)
    // - The demo output region exists and is initially empty
    // - No runtime page errors occurred during page load
    const demo = new RadixDemoPage(page);
    await demo.goto();

    // Verify the demo button is visible and has correct text
    expect(await demo.isDemoButtonVisible()).toBe(true);
    const btnText = await demo.demoButtonText();
    expect(btnText).toBe('Run Demonstration');

    // Verify demoOutput exists and initially contains no demonstration paragraphs
    const outputHTML = await demo.getDemoOutputHTML();
    // The HTML may be empty or contain whitespace; assert it does not contain the running message yet
    expect(outputHTML).not.toContain('Running Radix Sort demonstration...');

    // Verify that no page errors were emitted during load
    expect(pageErrors.length).toBe(0);

    // Verify there are no console messages of type 'error' emitted during load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S0_Idle -> S1_Demonstrating: Clicking Run Demonstration shows running output and passes', async ({ page }) => {
    // This test validates the transition from Idle to Demonstrating:
    // - Clicking the button triggers the JS handler
    // - demoOutput contains the running message, original array, pass outputs for each digit, and final sorted array
    // - No page errors occurred during the demonstration
    const demo = new RadixDemoPage(page);
    await demo.goto();

    // Click the demo button to start demonstration
    await demo.clickDemoButton();

    // Wait for first running line to appear
    await demo.waitForOutputContains('Running Radix Sort demonstration...');

    // Now assert expected content pieces are present
    const text = await demo.getDemoOutputText();

    // Evidence of entering Demonstrating state
    expect(text).toContain('Running Radix Sort demonstration...');

    // Evidence of original array printed
    expect(text).toContain('Original array: [170, 45, 75, 90, 802, 24, 2, 66]');

    // There should be outputs for 3 passes (units, tens, hundreds)
    expect(text).toContain('After pass 1 (units place):');
    expect(text).toContain('After pass 2 (tens place):');
    expect(text).toContain('After pass 3 (hundreds place):');

    // Final sorted array should match expected result from the example
    expect(text).toContain('Final sorted array: [2, 24, 45, 66, 75, 90, 170, 802]');

    // Inspect paragraph structure to make sure it's rendering multiple <p> elements
    const paragraphs = await demo.getOutputParagraphs();
    // At minimum we expect: Running line, original array, 3 pass lines, and final line => 6 paragraphs
    expect(paragraphs.length).toBeGreaterThanOrEqual(6);

    // Ensure no page errors happened during click/processing
    expect(pageErrors.length).toBe(0);

    // Ensure no console 'error' messages were emitted during the demo
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Transition S1_Demonstrating -> S1_Demonstrating: Repeated clicks update demo output consistently', async ({ page }) => {
    // This test validates the self-transition when the demo is triggered while already in Demonstrating state:
    // - Clicking the button again should re-run the demonstration (implementation replaces output then appends passes)
    // - The output after each run should include the same number of paragraphs (not cumulative tripling of content)
    const demo = new RadixDemoPage(page);
    await demo.goto();

    // First run
    await demo.clickDemoButton();
    await demo.waitForOutputContains('Running Radix Sort demonstration...');
    const paragraphsFirstRun = await demo.getOutputParagraphs();
    expect(paragraphsFirstRun.length).toBeGreaterThanOrEqual(6);

    // Second run (simulate user clicking while in Demonstrating state)
    await demo.clickDemoButton();
    await demo.waitForOutputContains('Running Radix Sort demonstration...');
    const paragraphsSecondRun = await demo.getOutputParagraphs();
    expect(paragraphsSecondRun.length).toBeGreaterThanOrEqual(6);

    // Because the implementation resets innerHTML at start of each run,
    // the paragraph count of the second run should be roughly the same as the first run,
    // not strictly cumulative. We assert they are equal in length here.
    expect(paragraphsSecondRun.length).toBe(paragraphsFirstRun.length);

    // Validate presence of pass lines again
    const text = await demo.getDemoOutputText();
    expect(text).toContain('After pass 1 (units place):');
    expect(text).toContain('After pass 2 (tens place):');
    expect(text).toContain('After pass 3 (hundreds place):');

    // Verify no page errors were emitted
    expect(pageErrors.length).toBe(0);
  });

  test('Edge case: Rapid double-clicks should not produce runtime errors and still produce valid output', async ({ page }) => {
    // This test simulates rapid user interaction:
    // - Perform two quick clicks and verify final output is valid and no runtime exceptions occurred
    const demo = new RadixDemoPage(page);
    await demo.goto();

    // Rapidly click twice
    await Promise.all([
      demo.clickDemoButton(),
      demo.clickDemoButton()
    ]);

    // Wait for content to appear
    await demo.waitForOutputContains('Final sorted array:', { timeout: 3000 });

    // Final content validation
    const text = await demo.getDemoOutputText();
    expect(text).toContain('Final sorted array: [2, 24, 45, 66, 75, 90, 170, 802]');

    // Ensure no page-level errors were observed
    expect(pageErrors.length).toBe(0);

    // Ensure no console.error messages were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('FSM-related helper functions (renderPage, resetDemoOutput) are not injected by the page - verify absence', async ({ page }) => {
    // The FSM definition referenced entry/exit actions like renderPage() and resetDemoOutput().
    // The page implementation does not define these global functions. We validate their absence.
    const demo = new RadixDemoPage(page);
    await demo.goto();

    // Check if renderPage is defined globally
    const renderPageType = await page.evaluate(() => {
      return typeof window.renderPage;
    });
    // Expect not defined (i.e., 'undefined')
    expect(renderPageType).toBe('undefined');

    // Check if resetDemoOutput is defined globally
    const resetDemoOutputType = await page.evaluate(() => {
      return typeof window.resetDemoOutput;
    });
    expect(resetDemoOutputType).toBe('undefined');

    // Also ensure no page errors were emitted during these checks
    expect(pageErrors.length).toBe(0);
  });

  test('Observability: Console messages and page errors are being captured by the test harness', async ({ page }) => {
    // This test ensures our listeners are correctly capturing console and page errors.
    // It also serves as a guard: if the application emits unexpected errors, this test will fail.
    const demo = new RadixDemoPage(page);
    await demo.goto();

    // Perform a normal run to generate logs (if any)
    await demo.clickDemoButton();
    await demo.waitForOutputContains('Running Radix Sort demonstration...');

    // At this point, we expect two types of observations:
    // - No page errors (uncaught exceptions) should have occurred
    // - Console messages may or may not exist; ensure none are of type 'error'
    expect(pageErrors.length).toBe(0);

    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);

    // For informational purposes (and debugging), assert that we captured some console messages or DOM output
    // It's acceptable if consoleMessages is empty; at minimum we assert the demo output contains expected text
    expect(await demo.getDemoOutputText()).toContain('Running Radix Sort demonstration...');
  });
});