import { test, expect } from '@playwright/test';

// Test file for CPU Scheduling Simulator
// Application ID: 6d302031-fa7a-11f0-ba5b-57721b046e74
// Served at: http://127.0.0.1:5500/workspace/0126-biased/html/6d302031-fa7a-11f0-ba5b-57721b046e74.html
//
// This suite validates the FSM states/transitions described in the provided spec:
// - Idle (initial render)
// - Process Added (after adding processes)
// - Simulation Running (after clicking Run Simulation)
// - Simulation Reset (after clicking Reset)
// It also observes console logs and page errors and asserts there are no unexpected runtime errors.
//
// Notes:
// - Tests use modern async/await and Playwright's ES module imports.
// - Page object pattern (SimulatorPage) encapsulates common operations.

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d302031-fa7a-11f0-ba5b-57721b046e74.html';

class SimulatorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.algorithm = page.locator('#algorithm');
    this.quantumControl = page.locator('#quantum-control');
    this.quantumInput = page.locator('#quantum');
    this.runButton = page.locator('#run');
    this.resetButton = page.locator('#reset');
    this.addButton = page.locator('#add-process');
    this.pidInput = page.locator('#pid');
    this.arrivalInput = page.locator('#arrival');
    this.burstInput = page.locator('#burst');
    this.priorityInput = page.locator('#priority');
    this.processTableBody = page.locator('#process-table tbody');
    this.outputDiv = page.locator('#output');
    this.ganttChart = page.locator('#gantt-chart');
    this.statsOutput = page.locator('#stats-output');
  }

  async selectAlgorithm(value) {
    await this.algorithm.selectOption(value);
  }

  async addProcess({ pid = '', arrival = null, burst = null, priority = null } = {}) {
    if (pid !== null) await this.pidInput.fill(pid);
    if (arrival !== null) await this.arrivalInput.fill(String(arrival));
    if (burst !== null) await this.burstInput.fill(String(burst));
    if (priority !== null) await this.priorityInput.fill(String(priority));
    await this.addButton.click();
  }

  async runSimulation() {
    await this.runButton.click();
  }

  async resetSimulation() {
    await this.resetButton.click();
  }

  async getProcessRows() {
    return this.processTableBody.locator('tr');
  }

  async getProcessTableText() {
    return this.processTableBody.innerText();
  }

  async getOutputText() {
    return this.outputDiv.innerText();
  }

  async getStatsText() {
    return this.statsOutput.innerText();
  }

  async isQuantumVisible() {
    return (await this.quantumControl.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none';
    }));
  }

  async removeProcessAt(index) {
    // Click the remove button in the given row index (0-based)
    const row = this.processTableBody.locator('tr').nth(index);
    const removeBtn = row.locator('button');
    await removeBtn.click();
  }
}

test.describe('CPU Scheduling Simulator - FSM and UI Integration', () => {
  // Capture console messages and page errors per test
  test.beforeEach(async ({ page }) => {
    // Default timeout for waiting short DOM updates
    page.setDefaultTimeout(5000);
  });

  // Helper to attach listeners and return captured arrays
  async function attachErrorCapture(page) {
    const consoleMessages = [];
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    return { consoleMessages, consoleErrors, pageErrors };
  }

  test('Initial render (Idle state) shows title and controls', async ({ page }) => {
    // Validate S0_Idle entry action renderPage() by checking initial DOM
    const { consoleErrors, pageErrors } = await attachErrorCapture(page);

    await page.goto(APP_URL);
    // Check header exists
    await expect(page.locator('h1')).toHaveText('CPU Scheduling Simulator');

    // Controls: algorithm select, run and reset buttons present
    await expect(page.locator('#algorithm')).toBeVisible();
    await expect(page.locator('#run')).toBeVisible();
    await expect(page.locator('#reset')).toBeVisible();

    // Quantum control should be hidden by default (policy: only visible for RR)
    const quantumControl = page.locator('#quantum-control');
    await expect(quantumControl).toHaveCSS('display', 'none');

    // No runtime errors should have occurred during page load
    expect(consoleErrors.length, 'No console.error messages on load').toBe(0);
    expect(pageErrors.length, 'No page errors on load').toBe(0);
  });

  test('Algorithm change event toggles quantum control visibility', async ({ page }) => {
    // Test AlgorithmChange event -> quantumControl shown for 'rr' and hidden otherwise
    const { consoleErrors, pageErrors } = await attachErrorCapture(page);

    await page.goto(APP_URL);
    const sim = new SimulatorPage(page);

    // Select Round Robin and expect quantum control to become visible
    await sim.selectAlgorithm('rr');
    await expect(sim.quantumControl).toHaveCSS('display', 'block');

    // Select FCFS and expect quantum control hidden
    await sim.selectAlgorithm('fcfs');
    await expect(sim.quantumControl).toHaveCSS('display', 'none');

    // Ensure no runtime errors on algorithm changes
    expect(consoleErrors.length, 'No console.error after algorithm changes').toBe(0);
    expect(pageErrors.length, 'No page errors after algorithm changes').toBe(0);
  });

  test('Add Process event transitions Idle -> ProcessAdded and updates table', async ({ page }) => {
    // Validate S0 -> S1 transition via AddProcess event
    const { consoleErrors, pageErrors } = await attachErrorCapture(page);

    await page.goto(APP_URL);
    const sim = new SimulatorPage(page);

    // Add a process and assert it appears in the process table
    await sim.addProcess({ pid: 'P1', arrival: 0, burst: 5, priority: 2 });

    // Wait for table row to appear
    const rows = sim.processTableBody.locator('tr');
    await expect(rows).toHaveCount(1);

    const firstRowText = await rows.nth(0).innerText();
    expect(firstRowText).toContain('P1');
    expect(firstRowText).toContain('0');
    expect(firstRowText).toContain('5');
    expect(firstRowText).toContain('2');

    // Adding another process increments rows
    await sim.addProcess({ pid: 'P2', arrival: 1, burst: 3, priority: 1 });
    await expect(rows).toHaveCount(2);

    // Check that add process resets some form fields: pid input cleared
    await expect(sim.pidInput).toHaveValue('');

    // Ensure no runtime errors during adding processes
    expect(consoleErrors.length, 'No console.error during add process').toBe(0);
    expect(pageErrors.length, 'No page errors during add process').toBe(0);
  });

  test('Edge case: Add Process with invalid numbers triggers alert', async ({ page }) => {
    // Validate error handling branch in addProcess (isNaN check)
    const { consoleErrors, pageErrors } = await attachErrorCapture(page);

    await page.goto(APP_URL);
    const sim = new SimulatorPage(page);

    // Clear numeric input to create NaN on parseInt
    await sim.arrivalInput.fill('');
    await sim.burstInput.fill('');
    await sim.priorityInput.fill('');

    // Listen for dialog
    let dialogMessage = null;
    page.on('dialog', (dialog) => {
      dialogMessage = dialog.message();
      dialog.dismiss();
    });

    await sim.addButton.click();

    // The page should have shown an alert with the expected message
    expect(dialogMessage).toBe('Please enter valid numbers');

    // Ensure no console errors were produced beyond the alert
    expect(consoleErrors.length, 'No console.error after invalid add attempt').toBe(0);
    expect(pageErrors.length, 'No page errors after invalid add attempt').toBe(0);
  });

  test('Run Simulation event prevents running with zero processes (alerts)', async ({ page }) => {
    // Validate RunSimulation when no processes -> alert
    const { consoleErrors, pageErrors } = await attachErrorCapture(page);

    await page.goto(APP_URL);
    const sim = new SimulatorPage(page);

    // Ensure process table empty
    await expect(sim.getProcessRows()).toHaveCount(0);

    // Listen for dialog
    let dialogMessage = null;
    page.on('dialog', (dialog) => {
      dialogMessage = dialog.message();
      dialog.dismiss();
    });

    await sim.runSimulation();

    expect(dialogMessage).toBe('Please add at least one process');

    // No runtime errors from attempting a run with no processes
    expect(consoleErrors.length, 'No console.error when running without processes').toBe(0);
    expect(pageErrors.length, 'No page errors when running without processes').toBe(0);
  });

  test('Run Simulation after adding processes displays results (S1 -> S2)', async ({ page }) => {
    // Validate transition S1_ProcessAdded -> S2_SimulationRunning and displayResults()
    const { consoleErrors, pageErrors } = await attachErrorCapture(page);

    await page.goto(APP_URL);
    const sim = new SimulatorPage(page);

    // Add two processes
    await sim.addProcess({ pid: 'A', arrival: 0, burst: 3, priority: 1 });
    await sim.addProcess({ pid: 'B', arrival: 2, burst: 2, priority: 2 });

    // Run FCFS simulation
    await sim.selectAlgorithm('fcfs');

    await sim.runSimulation();

    // Validate output timeline table exists and contains entries
    const outputText = await sim.getOutputText();
    expect(outputText).toContain('Execution Timeline');
    expect(outputText).toContain('Process');
    // There should be timeline entries for processes or Idle
    expect(outputText.length).toBeGreaterThan(0);

    // Gantt chart should contain blocks for the timeline
    await expect(sim.ganttChart).toContainText('Gantt Chart');

    // Stats should be populated
    const statsText = await sim.getStatsText();
    expect(statsText).toContain('Average Waiting Time');
    expect(statsText).toContain('Average Turnaround Time');

    // Process details table should include the two processes
    const detailsRows = sim.outputDiv.locator('table').nth(1).locator('tbody tr');
    // There might be multiple tables; we ensure at least 2 rows in details table
    await expect(detailsRows).toHaveCount(2);

    // No runtime errors during simulation
    expect(consoleErrors.length, 'No console.error during simulation run').toBe(0);
    expect(pageErrors.length, 'No page errors during simulation run').toBe(0);
  });

  test('Round Robin algorithm shows quantum control and runs with custom quantum', async ({ page }) => {
    // Validate RR algorithm path and roundRobin() invocation indirectly via results
    const { consoleErrors, pageErrors } = await attachErrorCapture(page);

    await page.goto(APP_URL);
    const sim = new SimulatorPage(page);

    // Add processes
    await sim.addProcess({ pid: 'X', arrival: 0, burst: 4, priority: 1 });
    await sim.addProcess({ pid: 'Y', arrival: 1, burst: 3, priority: 1 });

    // Select RR and ensure quantum control visible
    await sim.selectAlgorithm('rr');
    await expect(sim.quantumControl).toHaveCSS('display', 'block');

    // Change quantum to 1 and run
    await sim.quantumInput.fill('1');
    await sim.runSimulation();

    // Validate output exists and mentions Gantt Chart and Performance Metrics
    const out = await sim.getOutputText();
    expect(out).toContain('Execution Timeline');

    const stats = await sim.getStatsText();
    expect(stats).toContain('Average Waiting Time');

    // No runtime errors in the rr path
    expect(consoleErrors.length, 'No console.error during RR run').toBe(0);
    expect(pageErrors.length, 'No page errors during RR run').toBe(0);
  });

  test('Priority (preemptive) algorithm runs and produces results', async ({ page }) => {
    // Validate priorityPreemptive execution path (S2)
    const { consoleErrors, pageErrors } = await attachErrorCapture(page);

    await page.goto(APP_URL);
    const sim = new SimulatorPage(page);

    // Add processes with differing priorities and arrivals
    await sim.addProcess({ pid: 'P1', arrival: 0, burst: 5, priority: 2 });
    await sim.addProcess({ pid: 'P2', arrival: 1, burst: 2, priority: 1 });

    // Select preemptive priority
    await sim.selectAlgorithm('priority_p');
    await sim.runSimulation();

    // Validate outputs and details are present
    const out = await sim.getOutputText();
    expect(out).toContain('Execution Timeline');

    const stats = await sim.getStatsText();
    expect(stats).toContain('Average Waiting Time');

    // No runtime errors in priority preemptive path
    expect(consoleErrors.length, 'No console.error during priority preemptive run').toBe(0);
    expect(pageErrors.length, 'No page errors during priority preemptive run').toBe(0);
  });

  test('Remove process button works and reset clears all state (S2 -> S3 -> S0)', async ({ page }) => {
    // Validate removal of processes and resetSimulation() S3_SimulationReset -> S0_Idle
    const { consoleErrors, pageErrors } = await attachErrorCapture(page);

    await page.goto(APP_URL);
    const sim = new SimulatorPage(page);

    // Add processes
    await sim.addProcess({ pid: 'R1', arrival: 0, burst: 2, priority: 1 });
    await sim.addProcess({ pid: 'R2', arrival: 1, burst: 3, priority: 1 });

    // Remove first process using the Remove button
    let rows = sim.processTableBody.locator('tr');
    await expect(rows).toHaveCount(2);
    await sim.removeProcessAt(0);

    // After removal, expect 1 row
    rows = sim.processTableBody.locator('tr');
    await expect(rows).toHaveCount(1);

    // Run simulation with the remaining process
    await sim.runSimulation();
    await expect(sim.outputDiv).toContainText('Execution Timeline');

    // Now reset simulation
    await sim.resetSimulation();

    // After reset, process table and outputs should be cleared
    await expect(sim.processTableBody.locator('tr')).toHaveCount(0);
    await expect(sim.outputDiv).toHaveText('');
    await expect(sim.ganttChart).toHaveText('');
    await expect(sim.statsOutput).toHaveText('');

    // Inputs should be reset to defaults
    await expect(sim.pidInput).toHaveValue('');
    await expect(sim.arrivalInput).toHaveValue('0');
    await expect(sim.burstInput).toHaveValue('3');
    await expect(sim.priorityInput).toHaveValue('1');

    // No runtime errors during remove and reset flows
    expect(consoleErrors.length, 'No console.error during remove/reset flows').toBe(0);
    expect(pageErrors.length, 'No page errors during remove/reset flows').toBe(0);
  });

  test('Edge case: ensure invalid interactions do not create uncaught exceptions', async ({ page }) => {
    // Intentionally perform a series of actions in unusual order and assert no uncaught exceptions
    const { consoleErrors, pageErrors } = await attachErrorCapture(page);

    await page.goto(APP_URL);
    const sim = new SimulatorPage(page);

    // Try clicking Remove when no processes exist (no-op, but must not error)
    // There is no remove button visible in table; ensure no error thrown
    // Attempt to click a non-existent remove by invoking locator and safe-check
    const removeLocator = page.locator('#process-table tbody tr button').first();
    const exists = await removeLocator.count();
    if (exists > 0) {
      await removeLocator.click();
    }

    // Try running simulation with no processes -> handled by alert; capture and dismiss
    let dialogMessage = null;
    page.on('dialog', (dialog) => {
      dialogMessage = dialog.message();
      dialog.dismiss();
    });
    await sim.runSimulation();
    expect(dialogMessage).toBe('Please add at least one process');

    // No uncaught runtime errors
    expect(consoleErrors.length, 'No console.error after odd interactions').toBe(0);
    expect(pageErrors.length, 'No page errors after odd interactions').toBe(0);
  });
});