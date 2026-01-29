import { test, expect } from '@playwright/test';

// Page object for the Amortized Analysis demo page
class AmortizedDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.url =
      'http://127.0.0.1:5500/workspace/0126-balanced/html/63b286c1-fa74-11f0-bb9a-db7e6ecdeeaa.html';
    this.simulateBtn = page.locator('#simulateBtn');
    this.output = page.locator('#output');
  }

  async goto() {
    await this.page.goto(this.url);
  }

  async clickSimulate() {
    await this.simulateBtn.click();
  }

  async getOutputText() {
    return (await this.output.innerText()).replace(/\r/g, '');
  }

  async waitForSimulationStart() {
    // wait until the output contains the header line indicating simulation started
    await expect(this.output).toContainText('Insertion');
  }

  async waitForSimulationComplete() {
    // After clicking, there should be the last amortized line for 32 insertions.
    // We wait for the final amortized value which we expect to be "1.97".
    await expect(this.output).toContainText('1.97');
  }
}

test.describe('Amortized Analysis Demonstration - FSM validation and UI tests', () => {
  // Capture console errors and page errors for each test to assert runtime health.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and page errors without interfering.
    page.on('console', (msg) => {
      // capture only error-type console messages
      if (msg.type() === 'error') {
        consoleErrors.push({
          text: msg.text(),
          location: msg.location ? msg.location() : undefined,
        });
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });
  });

  test.afterEach(async () => {
    // Ensure no uncaught page errors or console errors occurred during a test run
    expect(consoleErrors.length, 'No console.error messages should have been emitted').toBe(0);
    expect(pageErrors.length, 'No uncaught page errors should have been thrown').toBe(0);
  });

  test('S0_Idle state: initial render shows button and empty output', async ({ page }) => {
    // Validate initial idle state (S0_Idle): renderPage() equivalent -> DOM ready
    const demo = new AmortizedDemoPage(page);
    await demo.goto();

    // Validate that the simulate button is present and has the expected label.
    await expect(demo.simulateBtn).toBeVisible();
    await expect(demo.simulateBtn).toHaveText('Run Simulation (Insert 32 elements)');

    // Validate output area exists and is initially empty (entry action renderPage should leave output empty).
    const outText = await demo.getOutputText();
    // It may contain whitespace, so trim for the assertion of emptiness.
    expect(outText.trim(), 'Output should be empty on initial render (Idle state)').toBe('');
  });

  test('Transition RunSimulation: clicking button triggers simulation and logs expected lines', async ({ page }) => {
    // Validate transition from S0_Idle -> S1_Simulating via click on #simulateBtn
    const demo = new AmortizedDemoPage(page);
    await demo.goto();

    // Click to run simulation (event: RunSimulation)
    await demo.clickSimulate();

    // Wait until simulation header appears (onEnter of S1 is simulateDynamicArrayInsertions)
    await demo.waitForSimulationStart();

    // Wait until simulation completes (we expect final amortized 1.97 to appear)
    await demo.waitForSimulationComplete();

    const text = await demo.getOutputText();
    const lines = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);

    // Validate header is present as first meaningful line
    expect(lines[0]).toContain('Insertion');
    expect(lines[0]).toContain('Capacity');
    expect(lines[1]).toContain('----'); // separator line presence

    // There should be 32 insertion lines logged (plus header, separator, blank, and two notice lines).
    // Find insertion lines between header/separator and notice lines by matching lines that start with a number.
    const insertionLines = lines.filter((l) => /^\d+\b/.test(l));
    expect(insertionLines.length).toBe(32);

    // Validate specific insertion behaviors for several indices to ensure doubling occurred at correct times:
    // Resize should occur at inserts 2,3,5,9,17
    const idxToExpectedResize = {
      1: 'Insert only', // first insertion: no resize
      2: 'Resize from 1 to 2 + insert',
      3: 'Resize from 2 to 4 + insert',
      5: 'Resize from 4 to 8 + insert',
      9: 'Resize from 8 to 16 + insert',
      17: 'Resize from 16 to 32 + insert',
      32: null, // we'll validate final totals for insertion 32 separately
    };

    for (const [idxStr, expectedOp] of Object.entries(idxToExpectedResize)) {
      const idx = Number(idxStr);
      const line = insertionLines[idx - 1]; // insertionLines are ordered from 1..32
      expect(line, `Insertion line ${idx} should exist`).toBeTruthy();

      if (expectedOp) {
        // Confirm the operation description appears in the line for this insertion
        expect(line).toContain(expectedOp);
      }
    }

    // Validate final totals (insertion 32) -> totalCost should be 63 and amortized 1.97
    const finalLine = insertionLines[31]; // index 31 -> insertion 32
    expect(finalLine).toContain('32'); // contains insertion index
    expect(finalLine).toContain('63'); // total cost 63 should appear somewhere in the final line
    expect(finalLine).toContain('1.97'); // amortized cost rounded to 2 decimals

    // Validate the informational notice at the end of the output is present
    const joined = lines.join('\n');
    expect(joined).toContain('the amortized cost per insertion stays low');
    expect(joined).toContain('amortized cost of insertions in dynamic arrays is O(1)');
  });

  test('Edge case: clicking the simulate button multiple times resets and re-runs the simulation', async ({ page }) => {
    // Clicking multiple times should clear the output and re-render the same simulation each time.
    const demo = new AmortizedDemoPage(page);
    await demo.goto();

    // First run
    await demo.clickSimulate();
    await demo.waitForSimulationComplete();
    const firstRunText = await demo.getOutputText();

    // Second run - click again and ensure output is replaced (not appended)
    await demo.clickSimulate();
    await demo.waitForSimulationComplete();
    const secondRunText = await demo.getOutputText();

    // The outputs should be identical between runs, meaning the function reset output.textContent at start
    expect(secondRunText.trim(), 'Second run output should match first run output').toBe(
      firstRunText.trim()
    );

    // Quick double click: simulate a user clicking rapidly twice; should still produce a valid single run result
    await demo.clickSimulate();
    await demo.clickSimulate();
    await demo.waitForSimulationComplete();
    const rapidRunText = await demo.getOutputText();
    expect(rapidRunText.trim()).toBe(firstRunText.trim());
  });

  test('Runtime health: observe console and page errors during load and simulation (should be none)', async ({ page }) => {
    // This test explicitly exercises the page and asserts there are no runtime errors in console or page.
    const demo = new AmortizedDemoPage(page);
    await demo.goto();

    // Trigger simulation
    await demo.clickSimulate();
    await demo.waitForSimulationComplete();

    // At this point the afterEach hook will assert that consoleErrors and pageErrors arrays are empty.
    // Additionally assert here for explicitness:
    expect(consoleErrors.length, 'No console.error messages during runtime').toBe(0);
    expect(pageErrors.length, 'No uncaught exceptions during runtime').toBe(0);
  });
});