import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0202-sample/html/a370b1b3-ffc4-11f0-821c-7d25bc609266.html';

// Increase default timeout for tests that wait for the full demo to complete
test.describe.configure({ timeout: 60000 });

/**
 * Page Object for the Bubble Sort demo page.
 * Encapsulates selectors and common interactions.
 */
class BubbleSortDemoPage {
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
  }

  async getButtonText() {
    return await this.runButton.textContent();
  }

  async isButtonDisabled() {
    return await this.runButton.evaluate((btn) => btn.disabled);
  }

  async getOutputText() {
    return await this.output.textContent();
  }

  async clickRunDemo() {
    await this.runButton.click();
  }

  /**
   * Wait until the demo output contains the provided substring.
   * @param {string} substring
   * @param {number} timeout
   */
  async waitForOutputContains(substring, timeout = 15000) {
    await this.page.waitForFunction(
      (sel, text) => {
        const el = document.querySelector(sel);
        return el && el.textContent && el.textContent.includes(text);
      },
      ['#demo-output', substring],
      { timeout }
    );
  }

  /**
   * Wait until the demo completes by waiting for the final text 'Array is sorted.'
   * and for the Run button to be re-enabled.
   */
  async waitForDemoCompletion(timeout = 45000) {
    await this.page.waitForFunction(() => {
      const out = document.getElementById('demo-output');
      const btn = document.getElementById('run-demo');
      return out && out.textContent && out.textContent.includes('Array is sorted.') && btn && btn.disabled === false;
    }, { timeout });
  }
}

test.describe('Bubble Sort: FSM-driven demo tests (a370b1b3-ffc4-11f0-821c-7d25bc609266)', () => {
  // Collect console messages and page errors for assertions
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture runtime page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.describe('Initial Idle State (S0_Idle)', () => {
    test('Initial page render shows Run Demonstration button and empty demo output', async ({ page }) => {
      // Comment: Verify initial Idle state UI matches FSM evidence and entry actions.
      const demo = new BubbleSortDemoPage(page);
      await demo.goto();

      // Ensure no unexpected runtime errors occurred during page load
      expect(pageErrors.length, 'No page errors should occur during initial load').toBe(0);

      // The Run Demonstration button should be present, enabled, and have the correct text.
      await expect(demo.runButton).toBeVisible();
      const text = await demo.getButtonText();
      expect(text && text.trim()).toBe('Run Demonstration');

      const disabled = await demo.isButtonDisabled();
      expect(disabled, 'Button should be enabled in Idle state').toBe(false);

      // The demo output container should be present and initially empty
      await expect(demo.output).toBeVisible();
      const outputText = (await demo.getOutputText()) || '';
      expect(outputText.trim()).toBe('', 'Demo output should be empty on initial render');
    });
  });

  test.describe('Transition: S0_Idle -> S1_DemoRunning (RunDemo_Click)', () => {
    test('Clicking Run Demonstration disables button and starts textual demo', async ({ page }) => {
      // Comment: Validate that clicking the button triggers S1 entry actions:
      // - demoButton.disabled = true (immediate)
      // - demoOutput.textContent = '' (cleared) and then first step displayed
      const demo = new BubbleSortDemoPage(page);
      await demo.goto();

      // Click the Run Demonstration button
      await demo.clickRunDemo();

      // Immediately after the click the button should be disabled (onEnter action)
      const disabledAfterClick = await demo.isButtonDisabled();
      expect(disabledAfterClick, 'Button should be disabled immediately after starting demo').toBe(true);

      // The code sets demoOutput.textContent = '' then immediately sets the first step synchronously.
      // So the output should quickly contain the initial array line.
      await demo.waitForOutputContains('Initial array: [4, 2, 7, 3]', 5000);
      const outputNow = await demo.getOutputText();
      expect(outputNow).toContain('Initial array: [4, 2, 7, 3]');

      // Ensure there are no runtime page errors caused by starting the demo
      expect(pageErrors.length, 'No runtime page errors should occur when starting demo').toBe(0);

      // Also ensure no console messages of type 'error' were emitted so far
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages should be emitted when starting demo').toBe(0);
    });

    test('Demo produces expected intermediate steps (checks for Compare/Swap messages)', async ({ page }) => {
      // Comment: Validate mid-demo behavior - the demo should emit Pass and Compare lines.
      const demo = new BubbleSortDemoPage(page);
      await demo.goto();

      // Start demo
      await demo.clickRunDemo();

      // Wait for a known intermediate token that should appear during processing.
      // 'Pass 1:' should appear early in the sequence.
      await demo.waitForOutputContains('Pass 1:', 8000);
      const midOutput = await demo.getOutputText();

      // It should contain compare and swap/no-swap lines
      expect(midOutput).toContain('Compare 4 and 2:');
      // Because 4 > 2 there should be a Swap line at some point in the output
      expect(midOutput).toContain('Swap', { contains: true });

      // No page errors should have been produced during mid-demo
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Transition: S1_DemoRunning -> S2_DemoCompleted (Demo Completion)', () => {
    test('Demo completes and re-enables the Run Demonstration button; final message present', async ({ page }) => {
      // Comment: This test waits for the demo to run to completion, asserts final state S2,
      // checks that 'Array is sorted.' is present and that the Run button is re-enabled (onExit).
      const demo = new BubbleSortDemoPage(page);
      await demo.goto();

      // Start the demo run
      await demo.clickRunDemo();

      // Wait for the demo to finish. The page uses setInterval with 1400ms per step.
      // Provide a generous timeout for the entire run.
      await demo.waitForDemoCompletion(45000);

      // On completion, the demo output must contain the final sentence
      const finalText = await demo.getOutputText();
      expect(finalText).toContain('Array is sorted.');

      // And the button should be re-enabled (exit action)
      const buttonDisabledAtEnd = await demo.isButtonDisabled();
      expect(buttonDisabledAtEnd, 'Button should be re-enabled after demo completes').toBe(false);

      // Confirm no page errors and no console.error entries occurred during the full run
      expect(pageErrors.length, 'No uncaught page errors during full demo run').toBe(0);
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages should be emitted during demo run').toBe(0);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('Rapid double-click does not crash and does not create duplicate demo runs', async ({ page }) => {
      // Comment: Simulate clicking the Run button twice quickly; ensure second click is ignored due to disabled flag,
      // and no runtime errors occur.
      const demo = new BubbleSortDemoPage(page);
      await demo.goto();

      // Rapid double click: attempt to click twice with minimal delay
      // The page code disables the button synchronously inside the click handler, so the second click should not start another run.
      await demo.runButton.click();
      // Try to click again immediately; if the button is disabled synchronously, this should have no effect.
      // Use evaluate to attempt to click via DOM even if Playwright's click fails due to disabled; but instruction forbids patching globals.
      // We'll use Playwright's click which respects disabled, so trying to click again should fail to dispatch a second click.
      // To keep to the requirement "only load page as-is", do not attempt to modify DOM.
      try {
        await demo.runButton.click({ timeout: 200 });
      } catch (e) {
        // It's acceptable if the second click cannot be performed because the button is disabled.
        // We'll not fail the test for that; instead record that we attempted a second click.
      }

      // Wait shortly for the demo to start and produce initial output
      await demo.waitForOutputContains('Initial array: [4, 2, 7, 3]', 5000);

      // Ensure no console errors or page errors occurred due to rapid interactions
      expect(pageErrors.length, 'No page errors should result from rapid double-click').toBe(0);
      const consoleErrors = consoleMessages.filter((m) => m.type === 'error');
      expect(consoleErrors.length, 'No console.error messages should be emitted from rapid double-click').toBe(0);

      // Allow demo to complete to cleanup the interval and re-enable the button
      await demo.waitForDemoCompletion(45000);
      const finalText = await demo.getOutputText();
      expect(finalText).toContain('Array is sorted.');
      expect(await demo.isButtonDisabled()).toBe(false);
    });

    test('Page does not throw ReferenceError/SyntaxError/TypeError on load or during demo', async ({ page }) => {
      // Comment: Observe collected page errors and console errors; assert that none of them are JavaScript runtime errors.
      const demo = new BubbleSortDemoPage(page);
      await demo.goto();

      // Start and complete the demo to exercise the script thoroughly
      await demo.clickRunDemo();
      await demo.waitForDemoCompletion(45000);

      // Inspect captured page errors (uncaught exceptions)
      // If any exist, fail and include their messages. Otherwise pass.
      if (pageErrors.length > 0) {
        // Provide detailed messages to help debugging if the environment produced errors.
        const messages = pageErrors.map((e) => (e && e.message) || String(e)).join('\n---\n');
        // Fail with the collected errors
        throw new Error(`Expected no uncaught page errors, but found:\n${messages}`);
      }

      // Inspect console.error messages captured
      const consoleErrorMsgs = consoleMessages.filter((m) => m.type === 'error').map((m) => m.text);
      if (consoleErrorMsgs.length > 0) {
        const joined = consoleErrorMsgs.join('\n---\n');
        throw new Error(`Expected no console.error messages, but found:\n${joined}`);
      }

      // If we reach here, there were no ReferenceError/SyntaxError/TypeError thrown during load/run
      expect(pageErrors.length).toBe(0);
      expect(consoleErrorMsgs.length).toBe(0);
    });
  });

  test.afterEach(async ({ page }) => {
    // On teardown, ensure we didn't leave any unexpected runtime errors captured.
    if (pageErrors.length > 0) {
      // Attach the errors to the test output to aid debugging if any slipped through.
      const details = pageErrors.map((e) => (e && e.message) || String(e)).join('\n');
      // Use expect to fail the test if pageErrors were captured unexpectedly.
      expect(pageErrors.length, `No uncaught page errors expected, but got:\n${details}`).toBe(0);
    }
  });
});