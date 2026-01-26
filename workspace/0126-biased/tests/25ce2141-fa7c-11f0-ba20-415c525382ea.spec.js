import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/25ce2141-fa7c-11f0-ba20-415c525382ea.html';

// Page Object for the demo page
class DemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.consoleErrors = [];
    this.pageErrors = [];

    // Collect console and page errors for assertions later
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') this.consoleErrors.push(msg.text());
    });
    this.page.on('pageerror', (err) => {
      // pageerror receives Error objects
      this.pageErrors.push(err && err.message ? err.message : String(err));
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // ensure DOM is settled
    await this.page.waitForSelector('#run-demo');
    await this.page.waitForSelector('#demo-output');
  }

  runButton() {
    return this.page.locator('#run-demo');
  }

  outputLocator() {
    return this.page.locator('#demo-output');
  }

  async getOutputText() {
    // Get trimmed textContent preserving newlines
    const raw = await this.outputLocator().textContent();
    return raw === null ? '' : raw.trim();
  }

  async clickRun() {
    await this.runButton().click();
    // Wait a tiny bit for script to update output (script is synchronous but DOM may need microtask)
    await this.page.waitForTimeout(50);
  }

  async pressRunWithKeyboard() {
    await this.runButton().focus();
    await this.page.keyboard.press('Enter');
    await this.page.waitForTimeout(50);
  }
}

test.describe('25ce2141-fa7c-11f0-ba20-415c525382ea - K-NN Demo FSM tests', () => {
  // Basic smoke test: page loads and initial Idle state (S0_Idle)
  test('S0_Idle: initial render shows Run K-NN Demo button and initial demo output', async ({ page }) => {
    const demo = new DemoPage(page);
    await demo.goto();

    // Validate the Run button exists and is visible and enabled
    const runBtn = demo.runButton();
    await expect(runBtn).toBeVisible();
    await expect(runBtn).toBeEnabled();
    await expect(runBtn).toHaveText('Run K-NN Demo');

    // Validate the demo output initial content matches the FSM evidence
    const outputText = await demo.getOutputText();
    // The pre contains a prompt string; check it contains the expected substring
    expect(outputText).toContain('Click "Run K-NN Demo" to see classification details.');

    // Ensure no page errors or console errors occurred during initial render
    expect(demo.pageErrors.length).toBe(0);
    expect(demo.consoleErrors.length).toBe(0);
  });

  test.describe('Transitions and Demo Running (S0 -> S1)', () => {
    test('RunDemo event: clicking Run K-NN Demo transitions to Demo Running and prints expected details', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Click the Run button as the RunDemo event
      await demo.clickRun();

      const output = await demo.getOutputText();

      // On transition, output should have been cleared and new content appended
      // Check for the Query point line (evidence of S1_DemoRunning)
      expect(output).toContain('Query point: (x=5, y=5)');

      // Check presence of computing distances intro
      expect(output).toContain('Computing distances to dataset points:');

      // Check that all points 1..6 are listed
      for (let i = 1; i <= 6; i++) {
        expect(output).toContain(`Point ${i}`);
      }

      // Check that distances are printed with 3 decimal places as in implementation
      // We use the known computed values from the implementation
      const expectedDistances = [
        '3.606', // Point 1 (2,3)
        '2.236', // Point 2 (3,4)
        '3.162', // Point 3 (4,2)
        '2.236', // Point 4 (6,7)
        '2.236', // Point 5 (7,6)
        '4.243'  // Point 6 (8,8)
      ];
      // Ensure each expected distance appears at least once in the output
      for (const d of expectedDistances) {
        expect(output).toContain(d);
      }

      // Check neighbor selection heading and that three neighbors are selected
      expect(output).toContain('Selecting 3 nearest neighbors:');

      // The implementation sorts by distance; we expect top 3 neighbors to include two 'B' and one 'A'
      // Expect lines that show Neighbor 1..3 with labels and distances
      expect(output).toContain('Neighbor 1');
      expect(output).toContain('Neighbor 2');
      expect(output).toContain('Neighbor 3');
      // Ensure neighbor labels appear (A and B)
      expect(output).toMatch(/Label: [AB]/);

      // Final predicted class for the provided dataset and query should be 'B'
      expect(output).toContain('Predicted Class: B');

      // Ensure initial prompt text is not still present (output was cleared on click)
      expect(output).not.toContain('Click "Run K-NN Demo" to see classification details.');

      // Ensure no page errors or console errors occurred during the run
      expect(demo.pageErrors.length).toBe(0);
      expect(demo.consoleErrors.length).toBe(0);
    });

    test('Idempotency: clicking Run twice resets output and produces the same result (no duplication)', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // First run
      await demo.clickRun();
      const firstOutput = await demo.getOutputText();

      // Wait a bit and run again
      await demo.clickRun();
      const secondOutput = await demo.getOutputText();

      // Both outputs should be non-empty and equal (script clears before writing)
      expect(firstOutput.length).toBeGreaterThan(0);
      expect(secondOutput.length).toBeGreaterThan(0);
      expect(secondOutput).toEqual(firstOutput);

      // Ensure only one 'Query point' header exists in the content after each run
      const occurrencesQueryFirst = (firstOutput.match(/Query point:/g) || []).length;
      expect(occurrencesQueryFirst).toBe(1);

      // Ensure predicted class remains consistent
      expect(secondOutput).toContain('Predicted Class: B');

      // No page or console errors from repeated invocation
      expect(demo.pageErrors.length).toBe(0);
      expect(demo.consoleErrors.length).toBe(0);
    });

    test('Accessibility / keyboard activation: pressing Enter on focused Run button triggers the demo', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Use keyboard activation rather than click
      await demo.pressRunWithKeyboard();

      const output = await demo.getOutputText();
      expect(output).toContain('Query point: (x=5, y=5)');
      expect(output).toContain('Predicted Class: B');

      // No runtime errors should have been thrown
      expect(demo.pageErrors.length).toBe(0);
      expect(demo.consoleErrors.length).toBe(0);
    });
  });

  test.describe('Edge cases and robustness', () => {
    test('Rapid repeated clicks do not cause exceptions and produce consistent final output', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Rapidly click the button multiple times
      const clicks = 5;
      for (let i = 0; i < clicks; i++) {
        await demo.runButton().click();
      }

      // Give a short pause for any async logging (script is sync, but be tolerant)
      await page.waitForTimeout(100);

      const output = await demo.getOutputText();

      // Final output should still contain a single Query point header and predicted class
      const occurrencesQuery = (output.match(/Query point:/g) || []).length;
      expect(occurrencesQuery).toBe(1);
      expect(output).toContain('Predicted Class: B');

      // Ensure no page errors or console errors were produced under stress
      expect(demo.pageErrors.length).toBe(0);
      expect(demo.consoleErrors.length).toBe(0);
    });

    test('Output formatting sanity: newlines and neighbor listing exist', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      await demo.clickRun();
      const output = await demo.getOutputText();

      // Expect sections separated by blank lines as produced by the script
      expect(output).toMatch(/Query point:.*\n\s*\n/); // blank line after query
      expect(output).toMatch(/Computing distances to dataset points:[\s\S]*Selecting 3 nearest neighbors:/);
      expect(output).toMatch(/Predicted Class: [A-Z]/);

      // No runtime errors
      expect(demo.pageErrors.length).toBe(0);
      expect(demo.consoleErrors.length).toBe(0);
    });
  });

  test.describe('Console and page error observation', () => {
    test('No unexpected console errors or page exceptions occur during normal use', async ({ page }) => {
      const demo = new DemoPage(page);
      await demo.goto();

      // Perform normal interactions
      await demo.clickRun();
      await demo.clickRun(); // second time

      // Check collected console messages (capture as additional verification)
      const consoleTexts = demo.consoleMessages.map(c => `${c.type}:${c.text}`);

      // None of the collected console message types should be 'error' (since implementation is valid)
      expect(demo.consoleErrors.length).toBe(0);

      // There should be no unhandled page errors
      expect(demo.pageErrors.length).toBe(0);

      // For debugging / diagnostics if a test fails, expose console messages as part of assertion message
      // But don't fail the test here otherwise; we already asserted zero errors above.
      // Also verify that console captured something (optional) — it's acceptable if empty.
      expect(Array.isArray(consoleTexts)).toBeTruthy();
    });
  });
});