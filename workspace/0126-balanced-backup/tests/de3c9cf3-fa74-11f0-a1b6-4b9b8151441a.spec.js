import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3c9cf3-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object encapsulating interactions with the amortized analysis page
class AmortizedPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.runButton = page.locator("button[onclick='runSimulation()']");
    this.clearButton = page.locator("button[onclick='clearOutput()']");
    this.output = page.locator('#output');
  }

  // Click the Run Simulation button and wait for results to render
  async runSimulation() {
    await this.runButton.click();
    // Wait for the simulation to at least begin by waiting for the "Running dynamic array simulation..." text
    await expect(this.output).toContainText('Running dynamic array simulation...');
    // Wait for the simulation results section to be appended
    await expect(this.output).toContainText('Simulation Results:');
  }

  // Click the Clear Output button and wait for the output to reset
  async clearOutput() {
    await this.clearButton.click();
    await expect(this.output).toHaveText('Results will appear here...');
  }

  // Get the raw text content of the output area
  async getOutputText() {
    return (await this.output.textContent()) ?? '';
  }

  // Get innerHTML of the output area
  async getOutputHTML() {
    return await this.output.evaluate(el => el.innerHTML);
  }

  // Count number of table rows inside the output (if any)
  async getTableRowCount() {
    const html = await this.getOutputHTML();
    // If no table, return 0 quickly
    if (!html.includes('<table')) return 0;
    return await this.output.evaluate(el => {
      const table = el.querySelector('table');
      if (!table) return 0;
      return table.querySelectorAll('tr').length;
    });
  }
}

test.describe('Amortized Analysis Demonstration - FSM and UI Tests', () => {
  // Arrays to capture console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  // Setup for each test: navigate to the page and attach listeners BEFORE navigation to capture load-time errors
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Capture console messages of type 'error'
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Capture uncaught exceptions on the page
    page.on('pageerror', err => {
      // err is an Error object
      pageErrors.push(err.message);
    });

    // Navigate to the application page
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Sanity check: ensure output and buttons exist before running tests
    const pageObj = new AmortizedPage(page);
    await expect(pageObj.runButton).toBeVisible();
    await expect(pageObj.clearButton).toBeVisible();
    await expect(pageObj.output).toBeVisible();
  });

  test.afterEach(async () => {
    // No-op: listeners are removed automatically when page fixture is torn down.
    // Keeping this hook so future teardown logic can be added easily.
  });

  test('S0_Idle: Initial Idle state renders buttons and default output', async ({ page }) => {
    // This test validates the Idle state (S0) per FSM:
    // - Entry rendering shows Run Simulation and Clear Output buttons
    // - Output div contains the placeholder text
    const pageObj = new AmortizedPage(page);

    // Validate presence and labels of interactive controls
    await expect(pageObj.runButton).toBeVisible();
    await expect(pageObj.runButton).toHaveText('Run Simulation');

    await expect(pageObj.clearButton).toBeVisible();
    await expect(pageObj.clearButton).toHaveText('Clear Output');

    // Validate default output text as evidence for S0 Idle
    await expect(pageObj.output).toHaveText('Results will appear here...');

    // Assert that there were no console errors or page errors during load
    expect(consoleErrors.length, `Console errors: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `Page errors: ${pageErrors.join(' | ')}`).toBe(0);
  });

  test('S0 -> S1: Clicking Run Simulation transitions to Simulation Running and displays results', async ({ page }) => {
    // This test validates the transition triggered by RunSimulation event:
    // - Click Run Simulation
    // - Verify "Running dynamic array simulation..." text appears
    // - Verify resizing logs and simulation results table are appended
    // - Verify final amortized cost message is present
    const pageObj = new AmortizedPage(page);

    // Click Run Simulation and wait for it to render core pieces
    await pageObj.runSimulation();

    // Validate the output contains the expected initial Running message (evidence for S1 entry action)
    const outputText = await pageObj.getOutputText();
    expect(outputText).toContain('Running dynamic array simulation...');

    // The implementation logs resizing events when capacity doubles. Expect at least one resize message
    expect(outputText).toMatch(/Resizing from \d+ to \d+ \(cost: \d+\)/);

    // The simulation appends a "Simulation Results:" label and a table
    expect(outputText).toContain('Simulation Results:');
    // Check that a table with header+rows is present by counting table rows
    const rowCount = await pageObj.getTableRowCount();
    // There should be a header row + 20 data rows = 21 rows
    expect(rowCount).toBeGreaterThanOrEqual(21);

    // The final amortized cost text appended at the very end should be present
    expect(outputText).toMatch(/Final amortized cost: .* per operation/);

    // Assert no console/page errors occurred during the simulation
    expect(consoleErrors.length, `Console errors during simulation: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `Page errors during simulation: ${pageErrors.join(' | ')}`).toBe(0);
  });

  test('S0 -> S2: Clicking Clear Output resets output to placeholder (Output Cleared state)', async ({ page }) => {
    // This test validates the ClearOutput event:
    // - Click Clear Output
    // - Verify output text is reset to "Results will appear here..."
    const pageObj = new AmortizedPage(page);

    // Perform the clear action
    await pageObj.clearOutput();

    // Verify output cleared as expected (evidence for S2 entry action)
    await expect(pageObj.output).toHaveText('Results will appear here...');

    // No console/page errors should have occurred
    expect(consoleErrors.length, `Console errors on clear: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `Page errors on clear: ${pageErrors.join(' | ')}`).toBe(0);
  });

  test('Edge Case: Running the simulation multiple times does not throw and replaces output', async ({ page }) => {
    // This test checks robustness:
    // - Click Run Simulation twice in a row quickly
    // - Ensure the output updates and no exceptions are raised
    const pageObj = new AmortizedPage(page);

    // First run
    await pageObj.runSimulation();
    const firstRunText = await pageObj.getOutputText();
    expect(firstRunText).toContain('Running dynamic array simulation...');
    expect(firstRunText).toContain('Simulation Results:');

    // Second run immediately after
    await pageObj.runSimulation();
    const secondRunText = await pageObj.getOutputText();
    expect(secondRunText).toContain('Running dynamic array simulation...');
    expect(secondRunText).toContain('Simulation Results:');

    // The second run should produce a table as well
    const rowCount = await pageObj.getTableRowCount();
    expect(rowCount).toBeGreaterThanOrEqual(21);

    // Ensure there are still no console/page errors after repeated runs
    expect(consoleErrors.length, `Console errors after repeated runs: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `Page errors after repeated runs: ${pageErrors.join(' | ')}`).toBe(0);
  });

  test('Edge Case: Run Simulation then Clear Output - verifies transition ordering and no errors', async ({ page }) => {
    // This test ensures transitions back-to-back (S0->S1 then S1->S2) behave as expected:
    // - Run Simulation
    // - Then Clear Output
    // - Verify final state is S2 with placeholder text and no errors
    const pageObj = new AmortizedPage(page);

    // Trigger simulation
    await pageObj.runSimulation();
    const afterRunText = await pageObj.getOutputText();
    expect(afterRunText).toContain('Simulation Results:');

    // Now clear
    await pageObj.clearOutput();
    await expect(pageObj.output).toHaveText('Results will appear here...');

    // No console/page errors expected
    expect(consoleErrors.length, `Console errors after run+clear: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `Page errors after run+clear: ${pageErrors.join(' | ')}`).toBe(0);
  });

  test('Sanity check for DOM-based evidence described in FSM components', async ({ page }) => {
    // This test cross-validates the FSM-detected components with the actual DOM:
    // - Buttons exist with the expected onclick attributes
    // - Output element exists with the expected id and class
    const pageObj = new AmortizedPage(page);

    // Verify run button has the onclick attribute exactly as in the FSM
    const runOnclick = await page.locator("button[onclick='runSimulation()']").evaluate(btn => btn.getAttribute('onclick'));
    expect(runOnclick).toBe('runSimulation()');

    // Verify clear button onclick
    const clearOnclick = await page.locator("button[onclick='clearOutput()']").evaluate(btn => btn.getAttribute('onclick'));
    expect(clearOnclick).toBe('clearOutput()');

    // Verify output element id and class
    const outputId = await page.locator('#output').evaluate(el => el.id);
    const outputClass = await page.locator('#output').evaluate(el => el.className);
    expect(outputId).toBe('output');
    expect(outputClass).toContain('output');

    // Final sanity: no console/page errors from load
    expect(consoleErrors.length, `Console errors on DOM sanity check: ${consoleErrors.join(' | ')}`).toBe(0);
    expect(pageErrors.length, `Page errors on DOM sanity check: ${pageErrors.join(' | ')}`).toBe(0);
  });
});