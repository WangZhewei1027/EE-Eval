import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cb6222-fa7c-11f0-ba20-415c525382ea.html';

// Page object model for the demo page
class DemoPage {
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

  async isRunButtonVisible() {
    return await this.runBtn.isVisible();
  }

  async isRunButtonEnabled() {
    return await this.runBtn.isEnabled();
  }

  async clickRunButton() {
    await this.runBtn.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async getOutputAttribute(attr) {
    return this.output.getAttribute(attr);
  }

  // Count lines that start with "Operation count:"
  async countOperationLines() {
    const text = await this.getOutputText();
    return text.split('\n').filter(line => line.trim().startsWith('Operation count:')).length;
  }
}

test.describe('Understanding Time Complexity Demo - FSM validation and DOM behavior', () => {
  // Arrays to collect console messages and page errors for assertions
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      // store the error message string to allow assertions later
      pageErrors.push(String(err && err.message ? err.message : err));
    });

    // Navigate to the page before each test
    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // No special teardown required; listeners are tied to the page lifecycle and will be cleaned up by Playwright.
  });

  test('S0_Idle: initial Idle state renders correctly (button and demo area present)', async ({ page }) => {
    // This test validates the Idle state (S0_Idle) entry evidence:
    // - "Show Demo Output" button exists and is enabled
    // - demo output area exists, is empty initially, and has aria-live="polite"
    const demo = new DemoPage(page);

    // Button visible and enabled
    await expect(demo.runBtn).toBeVisible({ timeout: 2000 });
    await expect(demo.runBtn).toHaveText('Show Demo Output');
    await expect(demo.runBtn).toBeEnabled();

    // Demo output area exists and is empty initially
    await expect(demo.output).toBeVisible();
    const initialText = await demo.getOutputText();
    expect(initialText.trim()).toBe('', 'Expected demo output to be empty on initial render (Idle state)');

    // Accessibility attribute present as in the implementation
    await expect(await demo.getOutputAttribute('aria-live')).toBe('polite');

    // Assert that loading the page did not raise any uncaught page errors
    expect(pageErrors, 'No uncaught page errors on initial load').toEqual([]);

    // Assert that no console.error messages were emitted on load
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console.error messages should be emitted on initial load').toBe(0);
  });

  test('Transition ShowDemoOutput: clicking the Show Demo Output button runs the demo (S0 -> S1) and produces expected output', async ({ page }) => {
    // This test validates the transition triggered by the ShowDemoOutput event:
    // - runDemo() behavior: output begins with the expected header text
    // - nested loop produces 25 operation lines for n=5
    // - final summary line indicates 25 operations
    // - on exit action disableButton() results in the button being disabled
    const demo = new DemoPage(page);

    // Pre-condition: Idle state
    await expect(demo.runBtn).toBeEnabled();
    await expect(demo.output).toBeEmpty();

    // Click the button to trigger the demo
    await demo.clickRunButton();

    // Wait for the summary text indicating the demo finished.
    // The implementation appends "Total operations performed: 25"
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.textContent && el.textContent.includes('Total operations performed:');
    }, { timeout: 2000 });

    const fullOutput = await demo.getOutputText();

    // Check that the output includes the header line described in the FSM evidence
    expect(fullOutput.includes('Counting operations in nested loops with n=5:'), 'Expected demo header to be present').toBe(true);

    // Validate that there are exactly 25 "Operation count:" lines (n*n where n=5)
    const opLines = fullOutput.split('\n').filter(l => l.trim().startsWith('Operation count:'));
    expect(opLines.length, 'Expected 25 operation lines (n=5 => 25)').toBe(25);

    // Validate first and last operation lines for correctness
    expect(opLines[0].includes('Operation count: 1 (i=0, j=0)'), 'First operation line should match expected i=0, j=0').toBe(true);
    expect(opLines[opLines.length - 1].includes('Operation count: 25 (i=4, j=4)'), 'Last operation line should match expected i=4, j=4').toBe(true);

    // Validate summary line exists and indicates 25 total operations
    expect(fullOutput.includes('Total operations performed: 25'), 'Expected final summary indicating 25 total operations').toBe(true);

    // Verify onExit action: button should be disabled after demo finishes
    await expect(demo.runBtn).toBeDisabled();

    // Ensure that no uncaught page errors occurred during the demo run
    expect(pageErrors, 'No uncaught page errors during demo run').toEqual([]);

    // Ensure there were no console.error messages emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console.error messages should be emitted during demo run').toBe(0);
  });

  test('Exit action disableButton is enforced: further user interaction is prevented (clicking disabled button fails)', async ({ page }) => {
    // This test validates that after the exit action (disableButton),
    // subsequent user clicks cannot trigger the demo again.
    // It attempts to click the disabled button and expects a click failure (Playwright will throw).
    const demo = new DemoPage(page);

    // Trigger the demo run to reach the exit action
    await demo.clickRunButton();
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.textContent && el.textContent.includes('Total operations performed:');
    }, { timeout: 2000 });

    // Confirm button is disabled
    await expect(demo.runBtn).toBeDisabled();

    // Attempting to click a disabled button via normal user interaction should fail.
    // We assert that a normal page.click (without force) will be rejected/thrown by Playwright.
    // Use expect(...).rejects to ensure the click does not silently succeed.
    await expect(page.click('#runDemoBtn')).rejects.toThrow();

    // Also validate that the output text remains unchanged after a failed click attempt
    const outputAfter = await demo.getOutputText();
    expect(outputAfter.includes('Total operations performed: 25'), 'Output unchanged after attempting to click disabled button').toBe(true);
  });

  test('Edge case: multiple rapid clicks before the script completes should not produce duplicate runs or errors', async ({ page }) => {
    // This test simulates a user rapidly clicking the button multiple times.
    // The implementation runs synchronously and then disables the button, but the test ensures:
    // - no duplicated final summary lines indicating multiple runs
    // - no uncaught page errors or console.error messages
    const demo = new DemoPage(page);

    // Rapidly attempt to click the button multiple times in quick succession.
    // Use a small loop with non-forced clicks; given the script runs synchronously, subsequent clicks
    // will likely be ignored once the button is disabled. We still perform them to exercise edge behavior.
    const clickPromises = [];
    for (let k = 0; k < 5; k++) {
      // Wrap in try/catch to avoid failing the test on intermediate click rejections.
      // We'll still observe overall page state and errors.
      clickPromises.push((async () => {
        try {
          await demo.runBtn.click();
        } catch (err) {
          // swallow - we will assert behavior via DOM and captured errors instead
        }
      })());
    }
    await Promise.all(clickPromises);

    // Wait until the demo output summary is present
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.textContent && el.textContent.includes('Total operations performed: 25');
    }, { timeout: 2000 });

    const finalText = await demo.getOutputText();

    // Ensure exactly one summary line for total operations exists (no duplicated runs)
    const summaryLines = finalText.split('\n').filter(l => l.includes('Total operations performed:'));
    expect(summaryLines.length, 'Exactly one final summary line should be present even after rapid clicks').toBe(1);

    // Ensure the number of operation lines is still 25
    const opLines = finalText.split('\n').filter(l => l.trim().startsWith('Operation count:'));
    expect(opLines.length, 'Operation lines should be 25 even after rapid clicks').toBe(25);

    // Ensure no uncaught page errors occurred
    expect(pageErrors, 'No uncaught page errors after rapid clicking').toEqual([]);

    // Ensure no console.error messages were emitted
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length, 'No console.error messages after rapid clicking').toBe(0);
  });

  test('Observability: verify console and page error listeners are capturing events (no errors expected in this implementation)', async ({ page }) => {
    // This test explicitly asserts observability hooks: that we can capture console and page errors,
    // and for this correct implementation, we expect none to be present.
    const demo = new DemoPage(page);

    // No actions - just ensure initial instrumentation works
    expect(Array.isArray(consoleMessages), 'consoleMessages is an array').toBe(true);
    expect(Array.isArray(pageErrors), 'pageErrors is an array').toBe(true);

    // Now run the demo to exercise any runtime behavior
    await demo.clickRunButton();
    await page.waitForFunction(() => {
      const el = document.getElementById('demoOutput');
      return el && el.textContent && el.textContent.includes('Total operations performed:');
    }, { timeout: 2000 });

    // After running, assert that no uncaught page errors were captured
    expect(pageErrors.length, 'No uncaught page errors should have been captured').toBe(0);

    // Assert that no console.error messages were captured during the run
    const consoleErrs = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrs.length, 'No console.error messages should have been captured').toBe(0);

    // For completeness, note that other console message types (like 'log') are acceptable but not required here.
  });

});