import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25cb3b12-fa7c-11f0-ba20-415c525382ea.html';

// Simple Page Object for the demo page
class BigODemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runBtnSelector = '#runDemoBtn';
    this.outputSelector = '#demoOutput';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  }

  async runButton() {
    return this.page.locator(this.runBtnSelector);
  }

  async output() {
    return this.page.locator(this.outputSelector);
  }

  async clickRunButton() {
    await this.page.click(this.runBtnSelector);
  }

  async getButtonText() {
    return (await this.runButton().innerText()).trim();
  }

  async isButtonDisabled() {
    return await this.runButton().getAttribute('disabled') !== null || await this.runButton().isDisabled();
  }

  async getOutputText() {
    return (await this.output().innerText()).trim();
  }
}

test.describe('Understanding Big-O Notation - Interactive Demo (FSM validation)', () => {
  let consoleMessages = [];
  let pageErrors = [];

  // Attach listeners and navigate to the page for each test.
  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Navigate to the app page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async ({}, testInfo) => {
    // If any page errors occurred, attach them to the test output for debugging.
    if (pageErrors.length > 0) {
      for (const err of pageErrors) {
        testInfo.attach('pageerror', { body: String(err), contentType: 'text/plain' });
      }
    }
    // Also attach any console errors if present
    const errorConsole = consoleMessages.filter(m => m.type === 'error');
    if (errorConsole.length > 0) {
      testInfo.attach('console-errors', { body: JSON.stringify(errorConsole, null, 2), contentType: 'application/json' });
    }
  });

  test.describe('Initial State: S0_Idle (renderPage entry)', () => {
    test('should render the page with Run Complexity Demo button and empty output', async ({ page }) => {
      const demo = new BigODemoPage(page);

      // Validate that the main elements exist
      const runBtn = await demo.runButton();
      const output = await demo.output();

      // Button should be visible and enabled in Idle state (S0_Idle)
      await expect(runBtn).toBeVisible();
      await expect(runBtn).toHaveText('Run Complexity Demo');
      expect(await demo.isButtonDisabled()).toBe(false);

      // Output div should be present and initially empty
      await expect(output).toBeVisible();
      const outText = await demo.getOutputText();
      expect(outText).toBe(''); // empty before demo runs

      // Verify accessibility attributes on output (as per FSM components)
      const ariaLive = await output.getAttribute('aria-live');
      const ariaAtomic = await output.getAttribute('aria-atomic');
      expect(ariaLive).toBe('polite');
      expect(ariaAtomic).toBe('true');

      // Ensure no uncaught page errors or console.error messages occurred during initial render
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length, 'No uncaught page errors expected on initial load').toBe(0);
      expect(consoleErrs.length, 'No console.error messages expected on initial load').toBe(0);
    });
  });

  test.describe('Transition: RunDemoClick -> S1_DemoRunning (runDemo entry)', () => {
    test('clicking Run Complexity Demo should populate output, disable the button and change its text', async ({ page }) => {
      const demo = new BigODemoPage(page);

      // Precondition: initial state checks
      await expect(demo.runButton()).toBeEnabled();
      expect(await demo.getOutputText()).toBe('');

      // Click the run button to trigger runDemo() (S0_Idle -> S1_DemoRunning)
      await demo.clickRunButton();

      // After click: button should be disabled and text should be "Demo Completed"
      await expect(demo.runButton()).toBeDisabled();
      await expect(demo.runButton()).toHaveText('Demo Completed');

      // Output should be generated and contain header and entries for given input sizes
      const outputText = await demo.getOutputText();
      expect(outputText.length).toBeGreaterThan(0);

      // Validate expected header
      expect(outputText).toContain('Operations Count for Various Big-O Complexities:');

      // Validate that each input size from the implementation appears
      expect(outputText).toContain('Input size (n): 10');
      expect(outputText).toContain('Input size (n): 100');
      expect(outputText).toContain('Input size (n): 1000');
      expect(outputText).toContain('Input size (n): 10000');

      // Validate a few representative complexity output lines (formatting may use commas)
      // For n=10: O(1) should be 1 operations, O(n) -> 10, O(n²) -> 100
      const lines = outputText.split('\n').map(l => l.trim()).filter(Boolean);

      // Find the block for n=10
      const idx10 = lines.findIndex(l => l.includes('Input size (n): 10'));
      expect(idx10).toBeGreaterThan(-1);
      // Next few lines should include O(1), O(log n), O(n), O(n log n), O(n²), O(2ⁿ)
      const block10 = lines.slice(idx10, idx10 + 7).join('\n');
      expect(block10).toMatch(/O\(1\):\s+1/);
      expect(block10).toMatch(/O\(n\):\s+10/);
      expect(block10).toMatch(/O\(n²\):\s+100/);
      // O(2ⁿ) for n=10 should show 1,024 (localized to en-US in page)
      expect(block10).toMatch(/O\(2ⁿ\):\s+1,024/);

      // For large n (10000), O(2ⁿ) should be "N/A (too large)"
      const idx10000 = lines.findIndex(l => l.includes('Input size (n): 10000'));
      expect(idx10000).toBeGreaterThan(-1);
      const block10000 = lines.slice(idx10000, idx10000 + 7).join('\n');
      expect(block10000).toMatch(/O\(2ⁿ\):\s+N\/A \(too large\)/);

      // Ensure that the output includes O(log n) values (they used Math.log2 with 2 decimal fixed)
      expect(outputText).toMatch(/O\(log n\):\s+\d+\.\d{2}/);

      // Confirm no new uncaught page errors or console.error during the demo run
      const consoleErrs = consoleMessages.filter(m => m.type === 'error');
      expect(pageErrors.length, 'No uncaught page errors expected after running demo').toBe(0);
      expect(consoleErrs.length, 'No console.error messages expected after running demo').toBe(0);
    });

    test('attempting to click the disabled button again should not change output or button text (idempotency)', async ({ page }) => {
      const demo = new BigODemoPage(page);

      // Run demo once
      await demo.clickRunButton();
      await expect(demo.runButton()).toBeDisabled();
      const outputAfterFirstRun = await demo.getOutputText();
      const btnTextAfterFirstRun = await demo.getButtonText();

      // Try clicking again - should be no-op since button disabled
      // Use try/catch to observe if Playwright throws due to disabled element; but operation should effectively not modify DOM
      let clickErrored = false;
      try {
        await demo.clickRunButton();
      } catch (e) {
        // Depending on Playwright implementation trying to click a disabled element may throw.
        clickErrored = true;
      }

      // After attempting second click, the output and button text should remain unchanged
      const outputAfterSecondAttempt = await demo.getOutputText();
      const btnTextAfterSecondAttempt = await demo.getButtonText();

      expect(outputAfterSecondAttempt).toBe(outputAfterFirstRun);
      expect(btnTextAfterSecondAttempt).toBe(btnTextAfterFirstRun);

      // It's acceptable for click on disabled to throw in the automation environment; we surface this as not altering state
      if (clickErrored) {
        // If a click error occurred, ensure it's not because of a page runtime error (we want a deterministic DOM state)
        expect(pageErrors.length, 'Disabled button click should not cause page runtime errors').toBe(0);
      }
    });
  });

  test.describe('Edge cases and robustness checks', () => {
    test('output contains consistent formatting and no infinite or extremely large unformatted numbers for provided input sizes', async ({ page }) => {
      const demo = new BigODemoPage(page);

      // Run the demo
      await demo.clickRunButton();
      const outputText = await demo.getOutputText();

      // Ensure there's no "Infinity" or "NaN" in the output
      expect(outputText).not.toContain('Infinity');
      expect(outputText).not.toContain('NaN');

      // Ensure extremely large numbers are represented as "N/A (too large)" where expected (n>20)
      // The page caps 2^n to "N/A (too large)" when n>20; our input list includes several >20
      expect(outputText).toContain('N/A (too large)');

      // Ensure output uses commas for thousands since toLocaleString('en-US') is used
      // Look for patterns like "1,000" for n=1000 O(n)
      expect(outputText).toMatch(/O\(n\):\s+1,000/);

      // Confirm no uncaught errors
      expect(pageErrors.length, 'No uncaught page errors in edge case checks').toBe(0);
      expect(consoleMessages.filter(m => m.type === 'error').length, 'No console.error messages in edge case checks').toBe(0);
    });

    test('page elements match FSM component definitions (selector, text, attributes)', async ({ page }) => {
      const demo = new BigODemoPage(page);

      // Validate button attributes as per FSM
      const runBtn = await demo.runButton();
      await expect(runBtn).toHaveAttribute('id', 'runDemoBtn');
      await expect(runBtn).toHaveClass(/btn-demo/);
      await expect(runBtn).toHaveText('Run Complexity Demo');

      // Validate output attributes as per FSM
      const output = await demo.output();
      await expect(output).toHaveAttribute('id', 'demoOutput');
      await expect(output).toHaveClass(/demo-output/);
      await expect(output).toHaveAttribute('aria-live', 'polite');
      await expect(output).toHaveAttribute('aria-atomic', 'true');

      // No page errors expected
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and runtime error observation (must not modify the page)', () => {
    test('should capture console logs and page errors and assert none of the critical runtime errors occurred', async ({ page }) => {
      const demo = new BigODemoPage(page);

      // Run the demo to trigger any potential runtime faults
      await demo.clickRunButton();

      // Wait a short moment to allow any asynchronous errors to surface
      await page.waitForTimeout(200);

      // Prepare lists for diagnostics
      const errors = pageErrors;
      const consoleErrs = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');

      // Assertions:
      // - There should be no uncaught page errors (ReferenceError, SyntaxError, TypeError, etc.)
      // - There should be no console.error or console.warn messages produced by the demo
      expect(errors.length, `Expected no uncaught page errors but found: ${errors.map(e => String(e)).join('; ')}`).toBe(0);
      expect(consoleErrs.length, `Expected no console error/warn messages but found: ${consoleErrs.map(c => c.text).join('; ')}`).toBe(0);

      // Also assert that we observed some console output (informational logs are allowed). We don't require any, but log the captured
      // This expectation is intentionally lenient: we don't assert that specific console logs exist, only check for absence of errors.
    });
  });
});