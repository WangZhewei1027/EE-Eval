import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/f0b221e0-fa7c-11f0-9fa6-d1bbe297d459.html';

// Page Object for the Counting Sort demo page
class CountingSortPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator('.button[onclick="runDemo()"]');
    this.demoOutput = page.locator('#demoOutput');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  // Click the Run Demo button
  async clickRunDemo() {
    await this.runButton.click();
  }

  // Get demoOutput text content
  async getDemoOutputText() {
    return await this.demoOutput.innerText();
  }

  // Check if runDemo exists on window and is a function
  async isRunDemoFunction() {
    return await this.page.evaluate(() => typeof window.runDemo === 'function');
  }

  // Check if renderPage exists on window
  async isRenderPageDefined() {
    return await this.page.evaluate(() => typeof window.renderPage !== 'undefined');
  }
}

test.describe('Counting Sort Interactive Application (FSM: Idle -> DemoRunning)', () => {
  // Arrays to capture console messages and page errors for each test
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push({
        name: err.name,
        message: err.message,
        stack: err.stack
      });
    });
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid leakage across tests (Playwright pages are ephemeral in fixtures,
    // but being explicit helps in complex setups)
    page.removeAllListeners('console');
    page.removeAllListeners('pageerror');
  });

  test.describe('S0_Idle (Idle) state validations', () => {
    // Validate the initial Idle state: DOM renders, button is present, demoOutput shows placeholder text,
    // FSM-specified entry_action renderPage() is not implemented (so calling it should throw).
    test('Idle: initial render shows Run button and placeholder output; renderPage is not implemented', async ({ page }) => {
      const demo = new CountingSortPage(page);
      await demo.goto();

      // The Run button should be present and visible
      await expect(demo.runButton).toBeVisible();
      await expect(demo.runButton).toHaveText('Run Counting Sort Demo');

      // The button should have the onclick attribute exactly 'runDemo()'
      const onclickAttr = await page.locator('.button').getAttribute('onclick');
      expect(onclickAttr).toBe('runDemo()');

      // The demoOutput should contain the initial placeholder text
      await expect(demo.demoOutput).toContainText('Demo output will appear here after clicking the button');

      // FSM mentions an entry action renderPage() for Idle, but the HTML implementation does NOT define it.
      // Attempting to call renderPage() from the page context should raise a ReferenceError.
      // We assert that invoking renderPage() rejects with an error mentioning renderPage.
      await expect(page.evaluate(() => {
        // Directly call to cause the error in page context; Playwright will propagate the rejection.
        // This should produce a ReferenceError because renderPage is not defined in the provided HTML.
        return renderPage();
      })).rejects.toThrow(/renderPage/);

      // Ensure that the runDemo function itself is present as a function on the window (it should be defined).
      const hasRunDemo = await demo.isRunDemoFunction();
      expect(hasRunDemo).toBe(true);

      // No uncaught page errors should have been received so far (the previous renderPage call was handled via rejection).
      expect(pageErrors.length).toBe(0);

      // No console errors should appear in initial load
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('S1_DemoRunning (Demo Running) state validations and transitions', () => {
    // Validate that clicking the Run Demo button transitions to the DemoRunning state
    // and that the demo output is rendered step-by-step as expected.
    test('Transition: clicking Run Counting Sort Demo triggers demo output with steps and final sorted array', async ({ page }) => {
      const demo = new CountingSortPage(page);
      await demo.goto();

      // Click the Run Demo button to trigger runDemo()
      await demo.clickRunDemo();

      // The demoOutput should update to include the demonstration heading
      await expect(demo.demoOutput.locator('h3')).toHaveText('Counting Sort Demonstration');

      // Verify key steps are present in the demo output
      const outputText = await demo.getDemoOutputText();

      // The original array should be shown
      expect(outputText).toContain('Original Array');
      expect(outputText).toContain('[4, 2, 2, 8, 3, 3, 1]');

      // Step 1: Maximum value should be displayed and equal to 8
      expect(outputText).toMatch(/Maximum value\s*=\s*8/);

      // Step 2: Initialized count array (should show zeros array)
      expect(outputText).toMatch(/Initialized count array/);
      expect(outputText).toContain('[0, 0, 0, 0, 0, 0, 0, 0, 0]');

      // Step 3: After counting occurrences - should show counts with 1,2,2,1 etc.
      expect(outputText).toMatch(/After counting occurrences/);
      expect(outputText).toContain('[0, 1, 2, 2, 1, 0, 0, 0, 1]');

      // Step 4: Cumulative counts
      expect(outputText).toMatch(/After cumulative counts/);
      expect(outputText).toContain('[0, 1, 3, 5, 6, 6, 6, 6, 7]');

      // Step 5: Final sorted array must be present and match expected sorted output
      expect(outputText).toMatch(/Final sorted array/);
      expect(outputText).toContain('[1, 2, 2, 3, 3, 4, 8]');

      // Confirm that invoking runDemo() programmatically does not throw and returns undefined
      await expect(page.evaluate(() => runDemo())).resolves.toBeUndefined();

      // No uncaught page errors occurred during the demo run
      expect(pageErrors.length).toBe(0);

      // No console error messages were emitted during the demo run
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });

    // Edge case: clicking the button multiple times should re-render the demo output consistently without errors.
    test('Edge case: multiple clicks re-run demo and produce consistent final output without runtime errors', async ({ page }) => {
      const demo = new CountingSortPage(page);
      await demo.goto();

      // Click the demo button multiple times
      await demo.clickRunDemo();
      await demo.clickRunDemo();
      await demo.clickRunDemo();

      // After multiple invocations, the demoOutput should still contain the correct final sorted array
      const text = await demo.getDemoOutputText();
      expect(text).toContain('[1, 2, 2, 3, 3, 4, 8]');

      // No uncaught page errors during repeated interactions
      expect(pageErrors.length).toBe(0);

      // Ensure console did not record any 'error' type messages
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrs.length).toBe(0);
    });
  });

  test.describe('Error observation and validation', () => {
    // This test ensures no unexpected TypeError or SyntaxError occurred during page load/interactions.
    test('No unexpected TypeError or SyntaxError observed in the page', async ({ page }) => {
      const demo = new CountingSortPage(page);
      await demo.goto();

      // Perform a normal run to exercise the script
      await demo.clickRunDemo();

      // Gather any recorded page errors
      // pageErrors were populated in the beforeEach handler
      // Assert that none of the collected page errors are TypeError or SyntaxError
      const problematicErrors = pageErrors.filter(e => e.name === 'TypeError' || e.name === 'SyntaxError');
      expect(problematicErrors.length).toBe(0);

      // Also assert no console-level errors referencing TypeError or SyntaxError
      const consoleProblematic = consoleMessages.filter(m =>
        m.type === 'error' && (/TypeError|SyntaxError/.test(m.text))
      );
      expect(consoleProblematic.length).toBe(0);
    });
  });
});