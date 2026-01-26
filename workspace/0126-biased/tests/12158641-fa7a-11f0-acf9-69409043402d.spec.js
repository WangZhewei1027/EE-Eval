import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12158641-fa7a-11f0-acf9-69409043402d.html';

// Page Object encapsulating simulator interactions and queries
class SimulatorPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // selectors
    this.selectors = {
      pid: '#pid',
      arrival: '#arrival',
      burst: '#burst',
      priority: '#priority',
      addProcess: '#addProcess',
      setQuantum: '#setQuantum',
      quantum: '#quantum',
      quantumStatus: '#quantumStatus',
      startSim: '#startSim',
      stepSim: '#stepSim',
      autoSim: '#autoSim',
      pauseSim: '#pauseSim',
      resetSim: '#resetSim',
      strategy: '#strategy',
      cpuState: '#cpuState',
      readyQueue: '#readyQueue',
      currentTime: '#currentTime',
      processTableBody: '#processTable tbody',
      log: '#log',
      addProcessError: '#addProcessError',
      ganttHeader: '#ganttHeader',
      ganttProcess: '#ganttProcess',
    };
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Add a process with given attributes via UI
  async addProcess(pid, arrival = '0', burst = '1', priority = '0') {
    await this.page.fill(this.selectors.pid, pid);
    await this.page.fill(this.selectors.arrival, String(arrival));
    await this.page.fill(this.selectors.burst, String(burst));
    await this.page.fill(this.selectors.priority, String(priority));
    await Promise.all([
      this.page.waitForTimeout(50), // allow any debounce
      this.page.click(this.selectors.addProcess),
    ]);
  }

  async setQuantum(value) {
    await this.page.fill(this.selectors.quantum, String(value));
    await this.page.click(this.selectors.setQuantum);
  }

  async startSimulation() {
    await this.page.click(this.selectors.startSim);
  }

  async stepSimulation() {
    await this.page.click(this.selectors.stepSim);
  }

  async autoRun() {
    await this.page.click(this.selectors.autoSim);
  }

  async pauseSimulation() {
    await this.page.click(this.selectors.pauseSim);
  }

  async resetSimulation() {
    await this.page.click(this.selectors.resetSim);
  }

  async changeStrategy(value) {
    await this.page.selectOption(this.selectors.strategy, value);
    // trigger change event propagation
    await this.page.waitForTimeout(50);
  }

  // Queries

  async getCPUState() {
    return (await this.page.textContent(this.selectors.cpuState))?.trim();
  }

  async getReadyQueueText() {
    return (await this.page.textContent(this.selectors.readyQueue))?.trim();
  }

  async getCurrentTime() {
    const t = await this.page.textContent(this.selectors.currentTime);
    return Number(t?.trim());
  }

  async getProcessTableRows() {
    return await this.page.$$eval(`${this.selectors.processTableBody} tr`, rows =>
      rows.map(r => Array.from(r.querySelectorAll('td')).map(td => td.textContent?.trim()))
    );
  }

  async getLog() {
    return await this.page.$eval(this.selectors.log, el => el.value);
  }

  async getAddProcessErrorText() {
    return (await this.page.textContent(this.selectors.addProcessError))?.trim();
  }

  async getQuantumStatusText() {
    return (await this.page.textContent(this.selectors.quantumStatus))?.trim();
  }

  async isDisabled(selector) {
    return await this.page.$eval(selector, el => el.disabled === true);
  }

  async getGanttCellsText() {
    return await this.page.$$eval('#ganttProcess td', tds => tds.map(td => td.textContent?.trim()));
  }
}

test.describe('CPU Scheduling Simulator - FSM and UI integration tests', () => {
  let page;
  let sim;
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // capture console messages
    page.on('console', msg => {
      try {
        consoleMessages.push(msg.text());
      } catch (e) {
        consoleMessages.push(String(msg));
      }
    });

    // capture uncaught errors on the page
    page.on('pageerror', err => {
      pageErrors.push(err.message || String(err));
    });

    sim = new SimulatorPage(page);
    await sim.goto();
    // small stabilization wait
    await page.waitForLoadState('load');
  });

  test.afterEach(async () => {
    await page.close();
  });

  test('Initial Idle state: UI shows Idle and controls initially disabled/enabled correctly', async () => {
    // Validate initial Idle state evidence
    const cpuState = await sim.getCPUState();
    expect(cpuState).toBe('Idle');

    // Step, Auto, Pause should be disabled initially
    expect(await sim.isDisabled('#stepSim')).toBe(true);
    expect(await sim.isDisabled('#autoSim')).toBe(true);
    expect(await sim.isDisabled('#pauseSim')).toBe(true);

    // Start and Reset should be enabled
    expect(await sim.isDisabled('#startSim')).toBe(false);
    expect(await sim.isDisabled('#resetSim')).toBe(false);

    // Ready queue should be Empty
    expect(await sim.getReadyQueueText()).toBe('Empty');

    // No processes exist at initial state
    const rows = await sim.getProcessTableRows();
    expect(rows.length).toBe(0);

    // Verify no uncaught page errors occurred on load
    expect(pageErrors).toEqual([]);
  });

  test('AddProcess event: adding a process updates table, log and UI (including error on duplicate PID)', async () => {
    // Add a valid process
    await sim.addProcess('P1', 0, 2, 1);
    let rows = await sim.getProcessTableRows();
    expect(rows.length).toBe(1);
    expect(rows[0][0]).toBe('P1');
    expect(rows[0][2]).toBe('2'); // burst
    // Log contains added process message
    const log = await sim.getLog();
    expect(log).toContain('Added process P1');

    // Attempt to add duplicate PID -> expect validation error shown in addProcessError element
    await sim.addProcess('P1', 1, 1, 0);
    const errText = await sim.getAddProcessErrorText();
    expect(errText).toBe('PID must be unique');

    // Ensure console did not emit fatal errors
    expect(pageErrors).toEqual([]);
  });

  test('StartSimulation event: transitions Idle -> Simulation Running and enables step/auto', async () => {
    // Add one process first
    await sim.addProcess('P2', 0, 1, 0);

    // Start simulation - no alert expected (because process exists)
    await sim.startSimulation();

    // After starting: step and auto should be enabled; pause disabled; start disabled
    expect(await sim.isDisabled('#stepSim')).toBe(false);
    expect(await sim.isDisabled('#autoSim')).toBe(false);
    expect(await sim.isDisabled('#pauseSim')).toBe(true);
    expect(await sim.isDisabled('#startSim')).toBe(true);

    // Log should indicate simulation started
    const log = await sim.getLog();
    expect(log).toContain('Simulation started with 1 processes.');

    // CPU state still Idle until stepping (since startSim doesn't immediately run a CPU)
    const cpuState = await sim.getCPUState();
    expect(cpuState === 'Idle' || cpuState === 'P2').toBeTruthy();

    // No page errors
    expect(pageErrors).toEqual([]);
  });

  test('Start without processes triggers alert and no state change (edge case)', async () => {
    // Ensure no processes present
    const rowsBefore = await sim.getProcessTableRows();
    expect(rowsBefore.length).toBe(0);

    // Intercept dialog and assert message
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await sim.startSimulation();

    expect(dialogMessage).toBe('Add at least one process before starting simulation.');

    // Ensure simulation controls remain unchanged (still Idle)
    expect(await sim.isDisabled('#stepSim')).toBe(true);
    expect(await sim.isDisabled('#autoSim')).toBe(true);
    expect(await sim.isDisabled('#pauseSim')).toBe(true);
  });

  test('StepSimulation and SimulationEnded: stepping through runs processes to completion and disables controls', async () => {
    // Add a process with burst 2 to require multiple steps
    await sim.addProcess('P3', 0, 2, 0);

    // Start simulation
    await sim.startSimulation();

    // Step twice to complete process
    await sim.stepSimulation();
    // after first step: log should show running and remaining decreased
    let log = await sim.getLog();
    expect(log).toContain('Running process P3');
    await sim.stepSimulation();

    // After second step, process should finish; log should mention finished and all completed
    log = await sim.getLog();
    expect(log).toMatch(/Process P3 finished at time \d+/);
    expect(log).toContain('All processes completed execution');

    // Buttons state: step/auto/pause disabled, start enabled
    expect(await sim.isDisabled('#stepSim')).toBe(true);
    expect(await sim.isDisabled('#autoSim')).toBe(true);
    expect(await sim.isDisabled('#pauseSim')).toBe(true);
    expect(await sim.isDisabled('#startSim')).toBe(false);

    // CPU should be Idle at end
    expect(await sim.getCPUState()).toBe('Idle');

    // Process table should reflect remaining 0
    const rows = await sim.getProcessTableRows();
    expect(rows.length).toBe(1);
    expect(rows[0][3]).toBe('0'); // Remaining column

    // Gantt chart should show at least one process cell
    const ganttCells = await sim.getGanttCellsText();
    // There might be empty text for idle segments; ensure P3 appears somewhere if non-empty
    expect(ganttCells.join('')).toContain('P3');

    // No page errors
    expect(pageErrors).toEqual([]);
  });

  test('AutoRunSimulation and PauseSimulation: auto runs to completion and interval is cleared', async () => {
    test.slow(); // allow slightly more time for setInterval driven behavior

    // Add two quick processes
    await sim.addProcess('A', 0, 1, 0);
    await sim.addProcess('B', 0, 1, 0);

    // Start simulation
    await sim.startSimulation();

    // Start auto run
    await sim.autoRun();

    // Wait until log shows completion (timeout safety)
    await page.waitForFunction(() => {
      const log = document.getElementById('log');
      return log && log.value.includes('All processes completed execution');
    }, { timeout: 5000 });

    const log = await sim.getLog();
    expect(log).toContain('All processes completed execution');

    // After auto completion, ensure controls reflect ended state
    expect(await sim.isDisabled('#autoSim')).toBe(true);
    expect(await sim.isDisabled('#pauseSim')).toBe(true);
    expect(await sim.isDisabled('#stepSim')).toBe(true);
    expect(await sim.isDisabled('#startSim')).toBe(false);

    // No uncaught page errors
    expect(pageErrors).toEqual([]);
  });

  test('SetQuantum and Round Robin strategy: enabling quantum UI and setting quantum value including invalid input', async () => {
    // Initially strategy is fcfs; quantum input and button disabled
    expect(await sim.isDisabled('#quantum')).toBe(true);
    expect(await sim.isDisabled('#setQuantum')).toBe(true);

    // Change to roundrobin strategy (no simulation running)
    await sim.changeStrategy('roundrobin');

    // Quantum input/button should be enabled
    expect(await sim.isDisabled('#quantum')).toBe(false);
    expect(await sim.isDisabled('#setQuantum')).toBe(false);

    // Set invalid quantum -> expect 'Invalid quantum value' status
    await sim.setQuantum(0);
    expect(await sim.getQuantumStatusText()).toContain('Invalid quantum value');

    // Set valid quantum -> status updates and log updated
    await sim.setQuantum(3);
    expect(await sim.getQuantumStatusText()).toContain('(Quantum = 3)');
    const log = await sim.getLog();
    expect(log).toContain('Quantum time set to 3');

    // No page errors
    expect(pageErrors).toEqual([]);
  });

  test('ChangeSchedulingAlgorithm while running triggers confirmation and resets simulation when accepted', async () => {
    // Add a process
    await sim.addProcess('C', 0, 2, 0);
    await sim.startSimulation();

    // Ensure running state: step enabled or start disabled
    expect(await sim.isDisabled('#startSim')).toBe(true);

    // Intercept confirm dialog and accept it
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // Change strategy - should trigger confirm and then stop simulation
    await sim.changeStrategy('sjf');

    expect(dialogMessage).toContain('Changing scheduling algorithm resets simulation and stops it. Continue?');

    // After accepting, simulation should be reset/stopped: start should be enabled, step/auto/pause disabled
    expect(await sim.isDisabled('#startSim')).toBe(false);
    expect(await sim.isDisabled('#stepSim')).toBe(true);
    expect(await sim.isDisabled('#autoSim')).toBe(true);
    expect(await sim.isDisabled('#pauseSim')).toBe(true);

    // No page errors
    expect(pageErrors).toEqual([]);
  });

  test('ResetSimulation behavior from ended state: resets time and UI but keeps process list (edge case vs FSM expectation)', async () => {
    // Add a process and run to completion
    await sim.addProcess('D', 0, 1, 0);
    await sim.startSimulation();
    await sim.stepSimulation(); // finish

    // Current time should be > 0
    const currentTimeBefore = await sim.getCurrentTime();
    expect(currentTimeBefore).toBeGreaterThan(0);

    // Click reset (not full reset according to page code)
    await sim.resetSimulation();

    // After resetSimulation(false): processes remain, but currentTime should be 0 and UI Idle
    const currentTimeAfter = await sim.getCurrentTime();
    expect(currentTimeAfter).toBe(0);

    const rows = await sim.getProcessTableRows();
    expect(rows.length).toBeGreaterThan(0); // processes retained

    expect(await sim.getCPUState()).toBe('Idle');

    // No page errors
    expect(pageErrors).toEqual([]);
  });

  test('Validation: adding process with invalid fields shows appropriate error messages', async () => {
    // Empty PID
    await sim.addProcess('', 0, 1, 0);
    expect(await sim.getAddProcessErrorText()).toBe('PID must not be empty');

    // Invalid arrival
    await sim.addProcess('E', -1, 1, 0);
    expect(await sim.getAddProcessErrorText()).toBe('Arrival time must be a number >= 0');

    // Invalid burst
    await sim.addProcess('F', 0, 0, 0);
    expect(await sim.getAddProcessErrorText()).toBe('Burst time must be number >= 1');

    // Non-numeric priority
    // Fill inputs directly to simulate entering non-numeric
    await page.fill('#pid', 'G');
    await page.fill('#arrival', '0');
    await page.fill('#burst', '1');
    await page.fill('#priority', 'not-a-number');
    await page.click('#addProcess');
    expect(await sim.getAddProcessErrorText()).toBe('Priority must be a number');

    // No page errors
    expect(pageErrors).toEqual([]);
  });
});