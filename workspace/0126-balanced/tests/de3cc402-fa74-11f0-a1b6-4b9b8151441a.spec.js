import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3cc402-fa74-11f0-a1b6-4b9b8151441a.html';

// Page Object for the CPU Scheduling Visualization app
class SchedulingPage {
  constructor(page) {
    this.page = page;
  }

  // Selectors
  async heading() {
    return this.page.locator('h1');
  }

  async processInputsContainer() {
    return this.page.locator('#process-inputs');
  }

  async processInputItems() {
    return this.page.locator('#process-inputs .process-input');
  }

  async addProcessButton() {
    return this.page.locator('button[onclick="addProcess()"]');
  }

  async removeButtons() {
    return this.page.locator('button[onclick="removeProcess(this)"]');
  }

  async algorithmSelect() {
    return this.page.locator('select#algorithm');
  }

  async quantumContainer() {
    return this.page.locator('#quantum-container');
  }

  async quantumInput() {
    return this.page.locator('#quantum');
  }

  async runSchedulingButton() {
    return this.page.locator('button[onclick="runScheduling()"]');
  }

  async ganttBars() {
    return this.page.locator('#gantt-container .gantt-process');
  }

  async timeMarkers() {
    return this.page.locator('#time-markers .time-unit');
  }

  async processTableRows() {
    return this.page.locator('#process-table-body tr');
  }

  async avgMetrics() {
    return this.page.locator('#avg-metrics');
  }

  // Actions
  async addProcess() {
    await (await this.addProcessButton()).click();
  }

  // Click remove on nth (0-based) process input
  async removeProcessAt(index) {
    const btn = this.page.locator('#process-inputs .process-input').nth(index).locator('button[onclick="removeProcess(this)"]');
    await btn.click();
  }

  async selectAlgorithm(value) {
    await (await this.algorithmSelect()).selectOption(value);
  }

  async runScheduling() {
    await (await this.runSchedulingButton()).click();
  }

  // Helpers to get counts / text
  async getProcessCount() {
    return await this.processInputItems().count();
  }

  async getRemoveButtonsCount() {
    return await this.removeButtons().count();
  }

  async getGanttBarsCount() {
    return await this.ganttBars().count();
  }

  async getTimeMarkersCount() {
    return await this.timeMarkers().count();
  }

  async getProcessTableRowsCount() {
    return await this.processTableRows().count();
  }

  async getHeadingText() {
    return await (await this.heading()).innerText();
  }

  async algorithmSelectedValue() {
    return await this.algorithmSelect().inputValue();
  }

  async isQuantumVisible() {
    return await this.quantumContainer().isVisible();
  }

  async getAvgMetricsText() {
    return await this.avgMetrics().innerText();
  }
}

// Test suite
test.describe('CPU Scheduling Visualization - de3cc402-fa74-11f0-a1b6-4b9b8151441a', () => {
  let consoleMessages = [];
  let pageErrors = [];
  let dialogMessages = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    dialogMessages = [];

    // Collect console messages
    page.on('console', msg => {
      consoleMessages.push({
        type: msg.type(),
        text: msg.text()
      });
    });

    // Collect uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Collect dialogs (alerts) so tests can assert messages; auto-accept to not block
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    await page.goto(APP_URL);
  });

  test.afterEach(async () => {
    // nothing to tear down globally; navigation per test isolates state
  });

  test.describe('Initial State (S0_Idle)', () => {
    test('should render the main heading and initial controls', async ({ page }) => {
      // Validate initial render (evidence for S0_Idle)
      const app = new SchedulingPage(page);

      // Check heading text exists as expected by FSM evidence
      const headingText = await app.getHeadingText();
      expect(headingText).toContain('CPU Scheduling Algorithms Visualization');

      // Algorithm select exists and default option is fcfs
      const algorithmValue = await app.algorithmSelectedValue();
      expect(algorithmValue).toBe('fcfs');

      // There should be initial process inputs (4 as per HTML)
      const procCount = await app.getProcessCount();
      expect(procCount).toBe(4);

      // Remove buttons should be present for each initial process input
      const removeCount = await app.getRemoveButtonsCount();
      expect(removeCount).toBe(4);

      // No runtime page errors should have occurred during initial load
      expect(pageErrors.length).toBe(0);

      // Ensure no console messages of type 'error'
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Process Management (S1_ProcessesAdded)', () => {
    test('should add a new process input when clicking "Add Process"', async ({ page }) => {
      // This validates the AddProcess event and transition S0 -> S1
      const app1 = new SchedulingPage(page);

      const beforeCount = await app.getProcessCount();
      await app.addProcess();
      const afterCount = await app.getProcessCount();

      expect(afterCount).toBe(beforeCount + 1);

      // New process input should contain Remove button (evidence of ProcessesAdded)
      const lastRemoveButton = page.locator('#process-inputs .process-input').nth(afterCount - 1).locator('button[onclick="removeProcess(this)"]');
      await expect(lastRemoveButton).toBeVisible();

      // Ensure inputs were renumbered correctly (check text of first child of the last input)
      const lastInputText = await page.locator('#process-inputs .process-input').nth(afterCount - 1).textContent();
      expect(lastInputText).toContain(`Process ${afterCount}:`);

      // No new page errors introduced
      expect(pageErrors.length).toBe(0);
    });

    test('should remove a process input and renumber remaining processes', async ({ page }) => {
      // This validates the RemoveProcess event and self-transition S1 -> S1
      const app2 = new SchedulingPage(page);

      // Ensure we have at least 3 to remove one safely
      await app.addProcess(); // increase count by 1
      let initialCount = await app.getProcessCount();
      expect(initialCount).toBeGreaterThanOrEqual(5 - 0); // initial 4 + 1 = 5

      // Remove the 2nd process (index 1)
      await app.removeProcessAt(1);

      const afterRemovalCount = await app.getProcessCount();
      expect(afterRemovalCount).toBe(initialCount - 1);

      // Validate renumbering: the process at index 1 should now be labeled Process 2
      const secondProcessText = await page.locator('#process-inputs .process-input').nth(1).textContent();
      expect(secondProcessText).toContain('Process 2:');

      // No console errors produced
      const consoleErrors1 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('should show alert when attempting to remove the last remaining process (edge case)', async ({ page }) => {
      // This validates the edge case behavior in removeProcess where an alert is shown
      const app3 = new SchedulingPage(page);

      // Remove processes until only one remains
      let count = await app.getProcessCount();
      while (count > 1) {
        // always remove the last one
        await app.removeProcessAt(count - 1);
        count = await app.getProcessCount();
      }
      expect(count).toBe(1);

      // Attempt to remove the last remaining process - should trigger an alert
      // dialogMessages collects dialog messages and auto-accepts them
      await app.removeProcessAt(0);

      // There should be at least one dialog captured and have expected message
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      const lastDialog = dialogMessages[dialogMessages.length - 1];
      expect(lastDialog).toContain('You need at least one process!');
    });
  });

  test.describe('Algorithm Selection (S2_AlgorithmSelected)', () => {
    test('should show quantum input when Round Robin (rr) is selected and hide otherwise', async ({ page }) => {
      // This validates SelectAlgorithm event and effects on the DOM
      const app4 = new SchedulingPage(page);

      // Select round robin
      await app.selectAlgorithm('rr');
      expect(await app.algorithmSelectedValue()).toBe('rr');

      // Quantum container should be visible
      expect(await app.isQuantumVisible()).toBe(true);

      // Select FCFS and quantum container should be hidden
      await app.selectAlgorithm('fcfs');
      expect(await app.algorithmSelectedValue()).toBe('fcfs');
      expect(await app.isQuantumVisible()).toBe(false);

      // No page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Run Scheduling (S3_SchedulingRunning)', () => {
    test('should run FCFS and populate Gantt chart, time markers, and metrics', async ({ page }) => {
      // This validates the RunScheduling event from S2 -> S3 with FCFS
      const app5 = new SchedulingPage(page);

      // Ensure we have the default algorithm fcfs
      await app.selectAlgorithm('fcfs');
      expect(await app.algorithmSelectedValue()).toBe('fcfs');

      // Run scheduling
      await app.runScheduling();

      // For the initial set of processes provided in HTML, FCFS should produce 4 gantt bars
      const ganttCount = await app.getGanttBarsCount();
      expect(ganttCount).toBe(4);

      // Time markers should exist and reflect the total end time (marker count > 0)
      const timeCount = await app.getTimeMarkersCount();
      expect(timeCount).toBeGreaterThan(0);

      // Process table should show 4 rows (one per process)
      const tableRows = await app.getProcessTableRowsCount();
      expect(tableRows).toBe(4);

      // Average metrics should be populated and contain "Average Turnaround Time"
      const avgText = await app.getAvgMetricsText();
      expect(avgText).toContain('Average Turnaround Time:');

      // No console errors
      const consoleErrors2 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });

    test('should run SJF and produce same number of completed processes but possibly different Gantt segmentation', async ({ page }) => {
      // Validate SJF algorithm execution
      const app6 = new SchedulingPage(page);

      await app.selectAlgorithm('sjf');
      await app.runScheduling();

      // Table rows should match number of processes (4)
      const tableRows1 = await app.getProcessTableRowsCount();
      expect(tableRows).toBe(4);

      // Gantt bars should be present
      const ganttCount1 = await app.getGanttBarsCount();
      expect(ganttCount).toBeGreaterThan(0);

      // No page errors occurred
      expect(pageErrors.length).toBe(0);
    });

    test('should run SRTF (preemptive) and produce at least one gantt entry and metrics', async ({ page }) => {
      // Validate SRTF algorithm execution
      const app7 = new SchedulingPage(page);

      await app.selectAlgorithm('srtf');
      await app.runScheduling();

      const ganttCount2 = await app.getGanttBarsCount();
      expect(ganttCount).toBeGreaterThan(0);

      const tableRows2 = await app.getProcessTableRowsCount();
      expect(tableRows).toBe(4);

      // time markers are present
      const timeCount1 = await app.getTimeMarkersCount();
      expect(timeCount).toBeGreaterThan(0);

      // No console errors
      const consoleErrors3 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('should run Round Robin with visible quantum and produce gantt alternating segments', async ({ page }) => {
      // Validate RR algorithm execution and the quantum UI behavior
      const app8 = new SchedulingPage(page);

      await app.selectAlgorithm('rr');
      expect(await app.isQuantumVisible()).toBe(true);

      // Set quantum to 2
      await app.quantumInput().fill('2');

      await app.runScheduling();

      // For RR, there will be multiple gantt segments; ensure at least more than or equal to 1
      const ganttCount3 = await app.getGanttBarsCount();
      expect(ganttCount).toBeGreaterThan(0);

      const tableRows3 = await app.getProcessTableRowsCount();
      expect(tableRows).toBe(4);

      // avg metrics present
      const avgText1 = await app.getAvgMetricsText();
      expect(avgText).toContain('Average Turnaround Time:');

      // No page errors
      expect(pageErrors.length).toBe(0);
    });

    test('should alert and not run scheduling when Priority is selected (edge case)', async ({ page }) => {
      // Validate that selecting Priority triggers alert and runScheduling returns early
      const app9 = new SchedulingPage(page);

      // Ensure enough processes exist (reset by reloading)
      await page.reload();

      // Reattach dialog listener collection after reload
      dialogMessages = [];
      page.on('dialog', async dialog => {
        dialogMessages.push(dialog.message());
        await dialog.accept();
      });

      await app.selectAlgorithm('priority');
      expect(await app.algorithmSelectedValue()).toBe('priority');

      // Run scheduling should produce an alert and not render a gantt
      await app.runScheduling();

      // Confirm we captured the priority alert message
      expect(dialogMessages.length).toBeGreaterThanOrEqual(1);
      expect(dialogMessages[dialogMessages.length - 1]).toContain('Priority scheduling would require priority inputs for each process');

      // Ensure no gantt bars were created after attempting priority scheduling
      const ganttCount4 = await app.getGanttBarsCount();
      expect(ganttCount).toBe(0);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Runtime Console & Error Observability', () => {
    test('should not emit uncaught page errors or console errors during normal interactions', async ({ page }) => {
      // Final smoke test: perform a series of interactions and assert no console or page errors occurred
      const app10 = new SchedulingPage(page);

      // Perform interactions
      await app.addProcess();
      await app.selectAlgorithm('sjf');
      await app.runScheduling();

      // Remove a process
      const countBefore = await app.getProcessCount();
      if (countBefore > 1) {
        await app.removeProcessAt(countBefore - 1);
      }

      // Run FCFS again
      await app.selectAlgorithm('fcfs');
      await app.runScheduling();

      // Assert there are no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Assert there are no console errors
      const consoleErrors4 = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });
});