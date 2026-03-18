import { test, expect } from '@playwright/test';

// Test file for Application ID: a3708aa1-ffc4-11f0-821c-7d25bc609266
// Served at: http://127.0.0.1:5500/workspace/0202-sample/html/a3708aa1-ffc4-11f0-821c-7d25bc609266.html
// This suite validates the FSM states (S0_Idle, S1_Inserting, S2_CompletedInsertion),
// the RunInsertionDemo event (click #demoBtn), visual DOM changes, and captures console/page errors.
// The tests do NOT modify the application source — they load the page as-is and observe behavior.

// Page object to encapsulate common interactions and queries.
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url = 'http://127.0.0.1:5500/workspace/0202-sample/html/a3708aa1-ffc4-11f0-821c-7d25bc609266.html';
    this.selectors = {
      demoBtn: '#demoBtn',
      demoOutput: '#demoOutput'
    };
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async demoButton() {
    return this.page.locator(this.selectors.demoBtn);
  }

  async demoOutput() {
    return this.page.locator(this.selectors.demoOutput);
  }

  // Clicks the Run Insertion Demo button.
  async clickRunDemo() {
    await this.page.click(this.selectors.demoBtn);
  }

  // Returns the raw text content of the output div.
  async getOutputText() {
    return (await this.page.locator(this.selectors.demoOutput).innerText()).trim();
  }

  // Returns whether the demo button is disabled.
  async isDemoButtonDisabled() {
    return await this.page.locator(this.selectors.demoBtn).isDisabled();
  }
}

test.describe('Heap Insertion Demo - FSM and UI tests', () => {
  // Collect page errors and console messages for assertions
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages and errors
    page.on('console', (msg) => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });
  });

  // ---------- S0: Idle state tests ----------
  test.describe('S0_Idle - Initial render and Idle state expectations', () => {
    test('Initial page should render demo button and initial output (Idle state)', async ({ page }) => {
      // Arrange
      const demo = new DemoPage(page);

      // Act
      await demo.goto();

      // Assert - initial UI
      const btn = await demo.demoButton();
      await expect(btn).toBeVisible();
      await expect(btn).toHaveText('Run Insertion Demo');
      await expect(btn).toBeEnabled();

      const output = await demo.demoOutput();
      await expect(output).toBeVisible();
      await expect(output).toHaveAttribute('aria-live', 'polite');
      await expect(output).toHaveAttribute('aria-atomic', 'true');

      const outputText = await demo.getOutputText();
      // The initial content is instructive text in the HTML
      await expect(outputText).toContain('Click the button above to see the insertion steps.');

      // No runtime errors should have occurred during initial render
      expect(pageErrors.length).toBe(0);
      // There may be no console messages, but at least capture them for debugging purposes
      expect(Array.isArray(consoleMessages)).toBe(true);
    });
  });

  // ---------- Transition S0 -> S1 (RunInsertionDemo) and S1 -> S2 (InsertionStepComplete) ----------
  test.describe('Run Insertion Demo - transitions and final heap state', () => {
    test('Clicking demo button disables it and produces insertion logs including final heap (S0 -> S1 -> S2)', async ({ page }) => {
      const demo = new DemoPage(page);

      // Navigate
      await demo.goto();

      // Before clicking, ensure Idle evidence present
      await expect(demo.demoButton()).toBeEnabled();
      await expect(demo.demoOutput()).toHaveText(/Click the button above to see the insertion steps\./);

      // Attach a short-lived listener to capture DOM mutations if needed
      // Act: Click the demo button to start insertion demo
      await demo.clickRunDemo();

      // Immediately after click the button should be disabled (action: btn.disabled = true;)
      await expect(demo.demoButton()).toBeDisabled();

      // Wait for the output to be populated - the script sets textContent synchronously,
      // but we wait for a specific expected marker to ensure the sequence finished.
      // The script pushes a starting message and multiple steps for six insertions.
      await page.waitForFunction(() => {
        const out = document.getElementById('demoOutput');
        return out && out.textContent && out.textContent.includes('Starting insertion into an empty Min-Heap.');
      });

      // Grab entire output
      const outputText = await demo.getOutputText();

      // Validate S1 evidence: insertion started
      await expect(outputText).toContain('Starting insertion into an empty Min-Heap.');

      // Validate presence of Step lines for each inserted value (6 values)
      for (let i = 1; i <= 6; i++) {
        await expect(outputText).toContain(`Step ${i}: Insert`);
      }

      // Validate that intermediate "Heap after insertion" lines exist and final heap matches expected final form.
      // Expected final heap after inserting [10,4,9,1,7,5] into a min-heap: [1, 4, 5, 10, 7, 9]
      await expect(outputText).toContain('Heap after insertion: [1, 4, 5, 10, 7, 9]');

      // Confirm that every insertion produced a "Heap after insertion" snapshot (there should be 6 occurrences)
      const occurrences = (outputText.match(/Heap after insertion:/g) || []).length;
      expect(occurrences).toBe(6);

      // Ensure no uncaught exceptions happened during the demo run
      expect(pageErrors.length).toBe(0);

      // Also assert there were no console.error messages during the run
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Attempting to trigger the demo again should not produce additional logs (button remains disabled)', async ({ page }) => {
      const demo = new DemoPage(page);

      await demo.goto();

      // Trigger demo once
      await demo.clickRunDemo();
      await expect(demo.demoButton()).toBeDisabled();

      // Capture output after first run
      const outputAfterFirstRun = await demo.getOutputText();

      // Try to click again - the button is disabled, Playwright will throw if we attempt to click it.
      // We assert that clicking a disabled control results in a rejected promise from Playwright.
      let clickThrew = false;
      try {
        await demo.clickRunDemo();
      } catch (err) {
        clickThrew = true;
        // Expect an error message indicating the element is not enabled or not clickable.
        expect(err).toBeTruthy();
      }
      expect(clickThrew).toBe(true);

      // Ensure the output hasn't changed after the failed second click attempt
      const outputAfterSecondAttempt = await demo.getOutputText();
      expect(outputAfterSecondAttempt).toBe(outputAfterFirstRun);

      // No uncaught page errors occurred during the second attempt
      expect(pageErrors.length).toBe(0);
    });
  });

  // ---------- Edge cases & error observation ----------
  test.describe('Edge cases and error observation', () => {
    test('Validate the output contains expected formatting and all inserted values appear at least once', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();
      await demo.clickRunDemo();

      // Wait for the demo to at least start and populate output
      await page.waitForFunction(() => {
        const out = document.getElementById('demoOutput');
        return out && out.textContent && out.textContent.includes('Step 1: Insert 10');
      });

      const text = await demo.getOutputText();

      // Ensure each inserted value appears in output (as part of Step lines or Heap snapshots)
      const expectedValues = ['10', '4', '9', '1', '7', '5'];
      for (const val of expectedValues) {
        expect(text).toContain(val);
      }

      // Ensure formatting includes the bullet-like "  - " introduced by the script for each path line
      expect(text.includes('  -')).toBe(true);

      // Check that no page errors (ReferenceError, TypeError, SyntaxError) occurred during the run.
      // The application is expected to run without raising uncaught exceptions.
      expect(pageErrors.length).toBe(0);
    });

    test('Observe console and pageerror streams and report if any unexpected messages exist', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Run demo
      await demo.clickRunDemo();

      // Wait for completion marker
      await page.waitForFunction(() => {
        const out = document.getElementById('demoOutput');
        return out && out.textContent && out.textContent.includes('Heap after insertion:');
      });

      // Collect a summary for assertions:
      //  - No page errors
      //  - Console messages (if any) should not include 'ReferenceError', 'TypeError', or 'SyntaxError'.
      expect(pageErrors.length).toBe(0);

      const concatenatedConsoleText = consoleMessages.map(m => `[${m.type}] ${m.text}`).join('\n');

      // Assert that the console does not contain common runtime error names (if it does, that will fail the test)
      expect(concatenatedConsoleText).not.toMatch(/ReferenceError/);
      expect(concatenatedConsoleText).not.toMatch(/TypeError/);
      expect(concatenatedConsoleText).not.toMatch(/SyntaxError/);

      // For completeness, ensure consoleMessages is an array and can be inspected
      expect(Array.isArray(consoleMessages)).toBe(true);
    });
  });

  test.afterEach(async ({ page }) => {
    // Tear down: remove listeners by closing the page to avoid leaking.
    // Playwright will handle cleanup; no explicit action required.
    await page.close();
  });
});