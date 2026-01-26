import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/12158642-fa7a-11f0-acf9-69409043402d.html';

/**
 * Test file: 12158642-fa7a-11f0-acf9-69409043402d.spec.js
 *
 * These tests validate the Deadlock Demonstration interactive simulator.
 * They exercise the FSM states and transitions described in the FSM definition:
 *  - S0_Idle (reset/initial)
 *  - S1_SystemInitialized (after initialize)
 *  - S2_SimulationRunning (run)
 *  - S3_SimulationPaused (pause)
 *  - S4_DeadlockDetected (detect)
 *  - S5_DeadlockResolved (resolve)
 *
 * The tests:
 *  - load the page as-is (no patching)
 *  - observe console logs and page errors
 *  - perform user interactions via DOM controls
 *  - assert expected log messages and DOM updates
 *  - verify edge-case alerts and error handling
 *
 * Note: All interactions are done in the same way a user would (click/fill).
 */

// Helper Page Object for simulator interactions
class SimulatorPage {
  constructor(page) {
    this.page = page;
    // Locators
    this.processCount = page.locator('#processCount');
    this.resourceCount = page.locator('#resourceCount');
    this.initSystemBtn = page.locator('#initSystemBtn');
    this.resourcesFieldset = page.locator('#resourcesFieldset');
    this.resourceInputsContainer = page.locator('#resourceInputsContainer');
    this.setAvailableBtn = page.locator('#setAvailableBtn');
    this.processControls = page.locator('#processControls');
    this.processTableBody = page.locator('#processTable tbody');
    this.autoFillRequestsBtn = page.locator('#autoFillRequestsBtn');
    this.autoFillAllocationsBtn = page.locator('#autoFillAllocationsBtn');
    this.policySelect = page.locator('#policySelect');
    this.stepBtn = page.locator('#stepBtn');
    this.runBtn = page.locator('#runBtn');
    this.pauseBtn = page.locator('#pauseBtn');
    this.detectDeadlockBtn = page.locator('#detectDeadlockBtn');
    this.resolveDeadlockBtn = page.locator('#resolveDeadlockBtn');
    this.resolutionStrategy = page.locator('#resolutionStrategy');
    this.simulationLog = page.locator('#simulationLog');
  }

  async navigate() {
    await this.page.goto(APP_URL);
    // Wait for the initial log message produced by resetSystemState() on load
    await expect(this.simulationLog).toBeVisible();
  }

  async getLog() {
    return (await this.simulationLog.inputValue()).trim();
  }

  async clearLogNotNeeded() {
    // The page exposes no direct clear button; the script has logClear() internal but no button.
    // We will just read & assert substrings rather than exact equality when needed.
  }

  async clickInitSystem(pCount = null, rCount = null) {
    if (pCount !== null) {
      await this.processCount.fill(String(pCount));
    }
    if (rCount !== null) {
      await this.resourceCount.fill(String(rCount));
    }
    await this.initSystemBtn.click();
  }

  async setAvailableResources(values) {
    // values: array of numbers length == resourceCount
    // Ensure resource inputs exist
    const inputs = this.resourceInputsContainer.locator('input[type=number]');
    const count = await inputs.count();
    for (let i = 0; i < values.length; i++) {
      // Use nth because inputs are in order
      await inputs.nth(i).fill(String(values[i]));
    }
    await this.setAvailableBtn.click();
  }

  async fillProcessVector(pid, type /* 'request'|'allocation' */, vector) {
    // vector is array of numbers with length resourceCount
    for (let r = 0; r < vector.length; r++) {
      const selector = `input[data-pid="${pid}"][data-type="${type}"][data-resource-index="${r}"]`;
      // Data attributes in code use dataset.resourceIndex set as string of index.
      // Playwright selectors are case-insensitive for attribute names. Ensure attribute format matches.
      const input = this.page.locator(`input[data-pid="${pid}"][data-type="${type}"][data-resourceindex="${r}"], input[data-pid="${pid}"][data-type="${type}"][data-resource-index="${r}"]`);
      await input.fill(String(vector[r]));
      // trigger change by blurring
      await input.evaluate((el) => el.dispatchEvent(new Event('change', { bubbles: true })));
    }
  }

  async terminateProcess(pid) {
    const btn = this.processTableBody.locator(`button[data-pid="${pid}"]`, { hasText: 'Terminate' });
    await btn.click();
  }

  async resetProcessVectors(pid) {
    const btn = this.processTableBody.locator('button', { hasText: 'Reset Req/Alloc' }).filter({ has: this.page.locator(`[data-pid="${pid}"]`) });
    // The above filter may not match; use a safer search: find the row for Ppid then the Reset button in that row
    const row = this.processTableBody.locator('tr').filter({ hasText: `P${pid}` }).first();
    const resetBtn = row.locator('button', { hasText: 'Reset Req/Alloc' });
    await resetBtn.click();
  }

  async clickAutoFillRequests() {
    await this.autoFillRequestsBtn.click();
  }
  async clickAutoFillAllocations() {
    await this.autoFillAllocationsBtn.click();
  }
  async clickStep() {
    await this.stepBtn.click();
  }
  async clickRun() {
    await this.runBtn.click();
  }
  async clickPause() {
    await this.pauseBtn.click();
  }
  async clickDetectDeadlock() {
    await this.detectDeadlockBtn.click();
  }
  async clickResolveDeadlock() {
    await this.resolveDeadlockBtn.click();
  }

  async setPolicy(policyValue) {
    await this.policySelect.selectOption(policyValue);
  }

  async setResolutionStrategy(strategyValue) {
    await this.resolutionStrategy.selectOption(strategyValue);
  }

  async countProcessRows() {
    return await this.processTableBody.locator('tr').count();
  }

  async countResourceInputs() {
    return await this.resourceInputsContainer.locator('input[type=number]').count();
  }

  async getProcessStateText(pid) {
    const row = this.processTableBody.locator('tr').filter({ hasText: `P${pid}` }).first();
    return await row.textContent();
  }
}

// Global arrays to capture console/errors per test
test.describe('Deadlock Demonstration Simulator - FSM and interactions', () => {
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (err) => {
      pageErrors.push(err);
    });

    // Capture console messages and filter 'error' type
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.afterEach(async () => {
    // After each test, ensure no unexpected runtime errors were swallowed.
    // These assertions will fail if there were uncaught runtime errors.
    expect(pageErrors, `No uncaught page errors expected but found: ${pageErrors.map(e=>String(e)).join(' | ')}`).toEqual([]);
    expect(consoleErrors, `No console.error messages expected but found: ${consoleErrors.join(' | ')}`).toEqual([]);
  });

  test('Initial load triggers resetSystemState -> System Initialized (S0 -> S1)', async ({ page }) => {
    // Validate that on load the system calls resetSystemState and logs initialization.
    const sim = new SimulatorPage(page);
    await sim.navigate();

    const log = await sim.getLog();
    // The initial resetSystemState() invocation logs the default initialization message (value defaults: processes=3, resources=2)
    expect(log).toContain('System initialized with 3 processes and 2 resource types.');

    // Check initial DOM visibility for generated sections
    await expect(sim.resourcesFieldset).toBeVisible();
    await expect(sim.processControls).toBeVisible();
    await expect(sim.simulationLog).toBeVisible();

    // Validate number of generated resource inputs equals default resource count
    const resCount = await sim.countResourceInputs();
    expect(resCount).toBe(2);

    // Validate number of process table rows equals default process count
    const procRows = await sim.countProcessRows();
    expect(procRows).toBe(3);
  });

  test('Initialize system with custom values triggers new SystemInitialized entry action', async ({ page }) => {
    // Changing inputs and clicking Initialize should produce a new initialization log and regenerate controls.
    const sim = new SimulatorPage(page);
    await sim.navigate();

    // set new counts and initialize
    await sim.clickInitSystem(4, 3);
    // Wait a short while for DOM updates
    await page.waitForTimeout(100);

    const log = await sim.getLog();
    // Should contain new initialization message
    expect(log).toContain('System initialized with 4 processes and 3 resource types.');

    // Check resource inputs count and process rows match the new values
    expect(await sim.countResourceInputs()).toBe(3);
    expect(await sim.countProcessRows()).toBe(4);
  });

  test('Set available resources and verify log and DOM updates', async ({ page }) => {
    const sim = new SimulatorPage(page);
    await sim.navigate();

    // Ensure resource inputs exist (default 2)
    expect(await sim.countResourceInputs()).toBeGreaterThanOrEqual(1);

    // Set available vector to [1, 2]
    await sim.setAvailableResources([1, 2]);
    await page.waitForTimeout(50);

    const log = await sim.getLog();
    expect(log).toContain('Available resource vector set to: [1, 2]');
  });

  test('Auto-fill requests and allocations produce expected log entries and update table inputs', async ({ page }) => {
    const sim = new SimulatorPage(page);
    await sim.navigate();

    // Click auto-fill requests
    await sim.clickAutoFillRequests();
    await page.waitForTimeout(50);
    let log = await sim.getLog();
    expect(log).toContain('Random requests filled for all processes.');

    // Click auto-fill allocations
    await sim.clickAutoFillAllocations();
    await page.waitForTimeout(50);
    log = await sim.getLog();
    expect(log).toContain('Random allocations filled for all processes.');

    // After auto-fill, process table inputs should still exist
    expect(await sim.countProcessRows()).toBeGreaterThanOrEqual(1);
  });

  test('Step simulation and Run/Pause transitions (S1 -> S2 -> S3) and onExit action pauseSimulation', async ({ page }) => {
    const sim = new SimulatorPage(page);
    await sim.navigate();

    // Ensure policy is selectable and step works
    await sim.setPolicy('fifo');
    await sim.clickStep();
    await page.waitForTimeout(50);
    let log = await sim.getLog();
    expect(log).toContain('Simulation step under policy: fifo');

    // Run continuously, allow at least one interval tick, then pause
    await sim.clickRun();
    // runBtn becomes disabled while running; ensure it was clicked
    await expect(sim.runBtn).toBeDisabled();

    // Wait enough for one interval to run (setInterval is 1000ms)
    await page.waitForTimeout(1200);

    // Pause simulation
    await sim.clickPause();
    await page.waitForTimeout(50);
    log = await sim.getLog();
    // The pauseSimulation function logs 'Simulation paused.'
    expect(log).toContain('Simulation paused.');
    // After pausing, run button should be enabled again
    await expect(sim.runBtn).toBeEnabled();
    await expect(sim.pauseBtn).toBeDisabled();
  });

  test('Detect and resolve a deterministic deadlock scenario (S2 -> S4 -> S5)', async ({ page }) => {
    const sim = new SimulatorPage(page);
    await sim.navigate();

    // For deterministic deadlock we will:
    // - Set resource counts to 2 types and 2 units total: We'll emulate total system resources implicitly by allocations+available.
    // - Set available vector to [0,0]
    // - Create two processes P0 and P1 with allocations and requests forming a cycle:
    //   P0: allocation [1,0], request [0,1]
    //   P1: allocation [0,1], request [1,0]
    //
    // Reset system to 2 processes and 2 resources for clarity
    await sim.clickInitSystem(2, 2);
    await page.waitForTimeout(100);

    // Set available resources to [0,0]
    await sim.setAvailableResources([0, 0]);
    await page.waitForTimeout(50);

    // Fill allocations and requests for P0 and P1
    // Allocation inputs: data-type="allocation"
    // Request inputs: data-type="request"
    await sim.fillProcessVector(0, 'allocation', [1, 0]);
    await sim.fillProcessVector(0, 'request', [0, 1]);
    await sim.fillProcessVector(1, 'allocation', [0, 1]);
    await sim.fillProcessVector(1, 'request', [1, 0]);
    await page.waitForTimeout(100);

    // Click detect deadlock
    await sim.clickDetectDeadlock();
    await page.waitForTimeout(50);
    let log = await sim.getLog();
    // Should detect deadlock and list both processes (order may vary)
    expect(log).toContain('Deadlock detected!');
    expect(log).toContain('P0');
    expect(log).toContain('P1');

    // Attempt to resolve using abortOne (should abort smallest pid -> P0)
    await sim.setResolutionStrategy('abortOne');
    await sim.clickResolveDeadlock();
    await page.waitForTimeout(100);
    log = await sim.getLog();
    expect(log).toContain('Attempting to resolve deadlock using strategy: abortOne');
    expect(log).toContain('Process P0 aborted to resolve deadlock.');
    expect(log).toContain('Deadlock resolution attempted.');

    // Verify that P0's state in the table indicates terminated
    const p0RowText = await sim.getProcessStateText(0);
    expect(p0RowText).toContain('terminated');

    // If any processes remain deadlocked (P1), abort all blocked
    await sim.setResolutionStrategy('abortAllBlocked');
    await sim.clickResolveDeadlock();
    await page.waitForTimeout(50);
    log = await sim.getLog();
    expect(log).toContain('Attempting to resolve deadlock using strategy: abortAllBlocked');
    // After abortAllBlocked, P1 should be aborted too
    const p1RowText = await sim.getProcessStateText(1);
    expect(p1RowText).toContain('terminated');
  });

  test('Edge cases: invalid initialization and invalid available resource inputs trigger alerts', async ({ page }) => {
    const sim = new SimulatorPage(page);
    await sim.navigate();

    // Capture dialogs (alerts)
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    // Invalid process count (0) should trigger alert on init
    await sim.processCount.fill('0');
    await sim.resourceCount.fill('2');
    await sim.initSystemBtn.click();
    // Wait briefly for dialog to be caught
    await page.waitForTimeout(50);
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    expect(dialogs[dialogs.length - 1]).toContain('Process count must be 1-10');

    // Now fix counts and initialize correctly
    await sim.processCount.fill('2');
    await sim.initSystemBtn.click();
    await page.waitForTimeout(50);

    // Now set a negative available resource to trigger alert in setAvailableBtn handler
    // Two resource inputs exist
    const resourceInputs = page.locator('#resourceInputsContainer input[type=number]');
    await resourceInputs.nth(0).fill('-1');
    await resourceInputs.nth(1).fill('0');
    await sim.setAvailableBtn.click();
    await page.waitForTimeout(50);

    // Expect another alert about non-negative integers
    expect(dialogs.length).toBeGreaterThanOrEqual(2);
    expect(dialogs[dialogs.length - 1]).toContain('Available resources must be non-negative integers.');
  });
});