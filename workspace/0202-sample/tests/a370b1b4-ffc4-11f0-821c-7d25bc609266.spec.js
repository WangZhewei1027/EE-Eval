import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a370b1b4-ffc4-11f0-821c-7d25bc609266.html';

// Page Object for the Selection Sort Demo page
class SelectionSortDemoPage {
  constructor(page) {
    this.page = page;
    this.runBtn = page.locator('#runDemoBtn');
    this.output = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(BASE_URL, { waitUntil: 'load' });
  }

  async isButtonVisible() {
    return await this.runBtn.isVisible();
  }

  async getButtonText() {
    return await this.runBtn.textContent();
  }

  async isButtonEnabled() {
    return await this.runBtn.isEnabled();
  }

  async clickRunButton() {
    await this.runBtn.click();
  }

  async getOutputText() {
    return await this.output.textContent();
  }

  async getOutputInnerText() {
    return await this.output.innerText();
  }

  async getOutputAriaLive() {
    return await this.output.getAttribute('aria-live');
  }

  async waitForOutputToContain(substring, timeout = 2000) {
    await this.page.waitForFunction(
      (sel, substr) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.indexOf(substr) !== -1;
      },
      '#demoOutput',
      substring,
      { timeout }
    );
  }
}

test.describe('Selection Sort Demo (a370b1b4-ffc4-11f0-821c-7d25bc609266)', () => {
  let pageErrors = [];
  let consoleMessages = [];

  test.beforeEach(async ({ page }) => {
    // Reset captured errors/messages for each test
    pageErrors = [];
    consoleMessages = [];

    // Capture runtime page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages and their types
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text(),
      });
    });
  });

  test.afterEach(async () => {
    // No specific teardown required beyond Playwright fixtures.
    // Tests will assert on pageErrors/consoleMessages as needed.
  });

  test('Initial Idle state: UI elements are rendered correctly (S0_Idle evidence)', async ({ page }) => {
    // This test validates the Idle state's evidence:
    // - The Run Demonstration button exists with correct attributes and is enabled
    // - The demo output exists and has aria-live="polite"
    const demo = new SelectionSortDemoPage(page);
    await demo.goto();

    // Verify no runtime errors occurred while rendering page
    expect(pageErrors.length).toBe(0);

    // Button presence and attributes
    expect(await demo.isButtonVisible()).toBe(true);
    expect((await demo.getButtonText()).trim()).toBe('Run Demonstration');
    expect(await demo.isButtonEnabled()).toBe(true);

    // Output area presence and aria-live attribute
    expect(await demo.getOutputAriaLive()).toBe('polite');

    // Output should be empty on initial render (S0 entry action evidence: renderPage())
    const initialOutput = (await demo.getOutputText()) || '';
    expect(initialOutput.trim()).toBe('');

    // Ensure no console errors were emitted on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Clicking Run Demonstration transitions to DemoRunning (S0 -> S1) and performs onEnter actions', async ({ page }) => {
    // This test validates the transition when user clicks the run button:
    // - demoBtn.disabled becomes true immediately
    // - output.textContent is cleared immediately
    // It also listens for console/page errors during the interaction.
    const demo = new SelectionSortDemoPage(page);
    await demo.goto();

    // Precondition: ensure output has initial content (should be empty)
    expect((await demo.getOutputText())?.trim()).toBe('');

    // Click the Run button and check immediate onEnter effects
    // We capture time-critical state quickly after click
    await Promise.all([
      // perform the click
      demo.clickRunButton(),
      // small micro-wait to allow immediate synchronous JS to run
      page.waitForTimeout(20),
    ]);

    // Immediately after click: button should be disabled (demoBtn.disabled = true)
    expect(await demo.isButtonEnabled()).toBe(false);

    // Immediately after click: output cleared (entry action output.textContent = '')
    // The output may already be empty, but ensure it's empty string
    const immediateOutput = (await demo.getOutputText()) || '';
    expect(immediateOutput.trim()).toBe('');

    // Validate that no uncaught exceptions were thrown so far
    expect(pageErrors.length).toBe(0);

    // Validate no console "error" messages were emitted immediately
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Demo completes and returns to Idle (S1 -> S0): output is populated and button re-enabled', async ({ page }) => {
    // This test validates the demo sequence completes:
    // - After the simulated delay the output is updated with the sorting steps
    // - The Run button is re-enabled (onExit action)
    const demo = new SelectionSortDemoPage(page);
    await demo.goto();

    // Click the run button to start the demo
    await demo.clickRunButton();

    // Wait for the demo to populate output (the page uses setTimeout(..., 250))
    // Allow up to 2s to be safe
    await demo.waitForOutputToContain('Sorted array:', 2000);

    const outputText = (await demo.getOutputText()) || '';

    // The output should include the "Initial array" line and "Iteration 1" and "Sorted array" final line
    expect(outputText).toContain('Initial array: [29, 10, 14, 37, 13]');
    expect(outputText).toContain('Iteration 1:');
    expect(outputText).toContain('Sorted array: [10, 13, 14, 29, 37]');

    // After completion the button should be re-enabled
    expect(await demo.isButtonEnabled()).toBe(true);

    // Ensure no uncaught runtime errors happened during the demo
    expect(pageErrors.length).toBe(0);

    // No console errors expected
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Edge case: attempting to click Run while demo is running should be blocked (disabled button)', async ({ page }) => {
    // This test validates that once the demo begins, the Run button is disabled and
    // attempts to click it using Playwright's normal click should fail (element not enabled).
    // We intentionally attempt a second click to assert the disabled behavior.
    const demo = new SelectionSortDemoPage(page);
    await demo.goto();

    // Start the demo
    await demo.clickRunButton();

    // Ensure it's disabled
    expect(await demo.isButtonEnabled()).toBe(false);

    // Attempt to click again using Playwright's click; this should reject because the element is disabled.
    // We catch the thrown error and assert that it's related to the button being disabled/not actionable.
    let clickError = null;
    try {
      await demo.clickRunButton();
    } catch (err) {
      clickError = err;
    }

    // We expect an error to be thrown when trying to click a disabled button
    expect(clickError).not.toBeNull();
    // The exact Playwright message can vary by version; check for common substrings
    const message = String(clickError?.message || '');
    const acceptableSubstrings = ['Element is not enabled', 'element is disabled', 'Element is not visible', 'Element is not enabled', 'is not enabled'];
    const containsIndicator = acceptableSubstrings.some(substr => message.includes(substr));
    expect(containsIndicator).toBe(true);

    // Wait for demo to finish to avoid polluting other tests (final state returns to enabled)
    await demo.waitForOutputToContain('Sorted array:', 2000);
    expect(await demo.isButtonEnabled()).toBe(true);

    // Ensure no uncaught page errors (page.on('pageerror')) were produced
    expect(pageErrors.length).toBe(0);
  });

  test('Robustness: rapid repeated interactions do not produce runtime errors or corrupted output', async ({ page }) => {
    // This test quickly starts the demo multiple times (attempts) and ensures:
    // - No runtime exceptions were thrown
    // - Output ends up with a valid sorted array result
    // - The button ends up enabled in Idle state
    const demo = new SelectionSortDemoPage(page);
    await demo.goto();

    // Start demo
    await demo.clickRunButton();

    // Immediately try to click again and ignore the expected Playwright click error here by using evaluate()
    // We call the DOM click() inside the browser context. This is intentionally using the page's environment
    // (we do not patch or alter any functions) and allows us to observe behavior naturally.
    // Note: HTML disabled buttons may not fire click handlers when disabled, but we don't assert on that detail here.
    await page.evaluate(() => {
      // Attempt to programmatically trigger a click on the button while disabled.
      // We let the browser decide how to handle disabled elements; we do not override behavior.
      const b = document.getElementById('runDemoBtn');
      if (b) {
        try { b.click(); } catch (e) { /* swallow DOM exceptions inside page context */ }
      }
    });

    // Wait for demo to finish
    await demo.waitForOutputToContain('Sorted array:', 2000);

    const out = (await demo.getOutputText()) || '';
    expect(out).toContain('Sorted array: [10, 13, 14, 29, 37]');

    // Final button state should be enabled
    expect(await demo.isButtonEnabled()).toBe(true);

    // Validate no uncaught exceptions were emitted during rapid interactions
    expect(pageErrors.length).toBe(0);

    // And no console errors were produced
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test('Console and page error observation: capture any unexpected errors during full demo run', async ({ page }) => {
    // This test runs a full demo and then asserts that captured console/page errors arrays are empty.
    // It documents observed console messages for debugging if something goes wrong.
    const demo = new SelectionSortDemoPage(page);
    await demo.goto();

    await demo.clickRunButton();

    await demo.waitForOutputToContain('Sorted array:', 2000);

    // After run, check captured messages
    const errors = pageErrors.map(e => String(e));
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');

    // If either of these arrays is non-empty, the test will fail and we log the messages for debugging
    expect(errors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});