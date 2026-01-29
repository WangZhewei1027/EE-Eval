import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324e4a21-fa73-11f0-a9d0-d7a1991987c6.html';

// Page Object encapsulating interactions with the demo page
class BacktrackingPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nInput = page.locator('#n');
    this.solveButton = page.locator('#solve');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getNValue() {
    return (await this.nInput.inputValue()).trim();
  }

  async setN(value) {
    // Clear and fill the input using keyboard to mimic a real user
    await this.nInput.click({ clickCount: 3 });
    await this.nInput.fill(String(value));
  }

  async clickSolve() {
    await this.solveButton.click();
  }

  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  async waitForOutputChange(previousText, timeout = 2000) {
    // wait until output text differs from previousText or timeout
    await this.page.waitForFunction(
      (selector, prev) => document.querySelector(selector).textContent !== prev,
      '#output',
      previousText,
      { timeout }
    );
    return this.getOutputText();
  }
}

test.describe('Backtracking Demo (N-Queens) - FSM validation and behavior', () => {
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console error messages and page errors for assertions
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  // Validate Idle state (S0_Idle): presence of input and Solve button and default value
  test('S0_Idle: Page renders input, default N and Solve button', async ({ page }) => {
    const demo = new BacktrackingPage(page);
    await demo.goto();

    // Verify the input and button exist and the output is empty (Idle state evidence)
    await expect(demo.nInput).toBeVisible();
    await expect(demo.solveButton).toBeVisible();

    const nValue = await demo.getNValue();
    // Default provided in the HTML is "4"
    expect(nValue).toBe('4');

    const outputText = await demo.getOutputText();
    expect(outputText.trim()).toBe('');

    // Ensure no runtime errors were reported on page load
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test successful solving path (S1_Solving -> S3_DisplaySolutions) for N=4
  test('S1_Solving -> S3_DisplaySolutions: Solving N=4 yields two solutions', async ({ page }) => {
    const demo = new BacktrackingPage(page);
    await demo.goto();

    // Capture previous output (should be empty)
    const prevOutput = await demo.getOutputText();

    // Click Solve (triggers solveNQueens(N))
    await demo.clickSolve();

    // Wait for output to change and retrieve it
    const output = await demo.waitForOutputChange(prevOutput);

    // Solutions are separated by a blank line (two newlines). Split accordingly.
    const rawSolutions = output.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);

    // For N=4, there are known to be 2 distinct solutions
    expect(rawSolutions.length).toBe(2);

    // Validate shapes: each solution should have 4 lines, each line length 4, consisting of Q and .
    for (const sol of rawSolutions) {
      const lines = sol.split('\n');
      expect(lines.length).toBe(4);
      for (const line of lines) {
        expect(line.length).toBe(4);
        // Only 'Q' and '.' characters are present
        expect(/^[Q.]{4}$/.test(line)).toBe(true);
      }
    }

    // Ensure no console or page errors occurred during the computation
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Test no-solution path (S1_Solving -> S2_NoSolutions) for N=2
  test('S1_Solving -> S2_NoSolutions: Solving N=2 yields "No solutions found."', async ({ page }) => {
    const demo = new BacktrackingPage(page);
    await demo.goto();

    // Set N to 2 which has no solutions for the N-Queens problem
    await demo.setN(2);
    const prevOutput = await demo.getOutputText();

    await demo.clickSolve();

    const output = await demo.waitForOutputChange(prevOutput);
    expect(output.trim()).toBe('No solutions found.');

    // Ensure no console/page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Edge case: invalid input (<1) triggers validation message
  test('Validation: N < 1 shows validation error message', async ({ page }) => {
    const demo = new BacktrackingPage(page);
    await demo.goto();

    // Enter 0 which is invalid according to the app logic
    await demo.setN(0);
    const prevOutput = await demo.getOutputText();

    await demo.clickSolve();

    const output = await demo.waitForOutputChange(prevOutput);
    expect(output.trim()).toBe('Please enter a valid number of queens.');

    // Check that no runtime errors occurred
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Edge and correctness: N=1 should produce a single solution "Q"
  test('S3_DisplaySolutions: N=1 yields a single single-cell solution', async ({ page }) => {
    const demo = new BacktrackingPage(page);
    await demo.goto();

    await demo.setN(1);
    const prevOutput = await demo.getOutputText();

    await demo.clickSolve();

    const output = await demo.waitForOutputChange(prevOutput);
    const rawSolutions = output.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);

    expect(rawSolutions.length).toBe(1);
    expect(rawSolutions[0].trim()).toBe('Q');

    // Ensure no console/page errors
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Verify repeated interactions: changing N and clicking Solve updates output deterministically
  test('Repeated solves update the output correctly when N changes', async ({ page }) => {
    const demo = new BacktrackingPage(page);
    await demo.goto();

    // First solve N=4
    await demo.setN(4);
    let prev = await demo.getOutputText();
    await demo.clickSolve();
    let out1 = await demo.waitForOutputChange(prev);
    expect(out1.trim().length).toBeGreaterThan(0);
    const solCount1 = out1.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).length;
    expect(solCount1).toBe(2);

    // Now change to N=3 (no solutions) and ensure it updates
    await demo.setN(3);
    prev = out1;
    await demo.clickSolve();
    const out2 = await demo.waitForOutputChange(prev);
    expect(out2.trim()).toBe('No solutions found.');

    // Change to N=1 and ensure update again
    await demo.setN(1);
    prev = out2;
    await demo.clickSolve();
    const out3 = await demo.waitForOutputChange(prev);
    const solCount3 = out3.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean).length;
    expect(solCount3).toBe(1);
    expect(out3.trim()).toBe('Q');

    // Final sanity: no console/page errors across the repeated interactions
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });

  // Observability: ensure that clicking the Solve button is wired to an event handler
  test('Event wiring: Solve button click triggers handler (observable through output change)', async ({ page }) => {
    const demo = new BacktrackingPage(page);
    await demo.goto();

    // The existence of the click event listener is observable by the fact that clicking changes the output.
    // We'll use N=2 which is deterministic: clicking Solve should set output to "No solutions found."
    await demo.setN(2);
    const prev = await demo.getOutputText();
    await demo.clickSolve();
    const output = await demo.waitForOutputChange(prev);
    expect(output.trim()).toBe('No solutions found.');

    // No runtime errors triggered by the click
    expect(consoleErrors.length).toBe(0);
    expect(pageErrors.length).toBe(0);
  });
});