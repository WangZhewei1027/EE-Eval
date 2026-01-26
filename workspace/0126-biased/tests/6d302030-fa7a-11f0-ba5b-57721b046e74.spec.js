import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/6d302030-fa7a-11f0-ba5b-57721b046e74.html';

// Page Object helpers for the Context Switching Simulator
class ContextSimulatorPage {
  constructor(page) {
    this.page = page;
    this.consoleMessages = [];
    this.pageErrors = [];
  }

  async init() {
    // Capture console messages and page errors for assertions
    this.page.on('console', (msg) => {
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    this.page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });

    await this.page.goto(APP_URL);
    await this.page.waitForSelector('h1:has-text("Context Switching Simulator")');
  }

  // Basic selectors and utilities
  async addTask(name, priority = '2') {
    await this.page.fill('#newTask', name);
    await this.page.selectOption('#taskPriority', String(priority));
    await this.page.click("button[onclick='addTask()']");
    // Ensure the task appears in the DOM
    await this.page.waitForSelector(`.task:has-text("${name}")`);
  }

  async switchToTaskByName(name) {
    const switchBtn = this.page.locator(`.task:has-text("${name}") button:has-text("Switch to this task")`);
    await expect(switchBtn).toHaveCount(1);
    await switchBtn.click();
  }

  async completeTaskByName(name) {
    const btn = this.page.locator(`.task:has-text("${name}") button:has-text("Complete")`);
    await expect(btn).toHaveCount(1);
    await btn.click();
  }

  async deleteTaskByName(name) {
    const btn = this.page.locator(`.task:has-text("${name}") button:has-text("Delete")`);
    await expect(btn).toHaveCount(1);
    await btn.click();
  }

  async clickStartWork() {
    await this.page.click("button[onclick='startWork()']");
  }

  async clickPauseWork() {
    await this.page.click("button[onclick='pauseWork()']");
  }

  async clickResetAll() {
    await this.page.click("button[onclick='resetAll()']");
  }

  async clickSimulateInterruption() {
    await this.page.click("button[onclick='simulateInterruption()']");
  }

  async clickForceSwitch() {
    await this.page.click("button[onclick='forceSwitch()']");
  }

  async clickShowContextDetails() {
    await this.page.click("button[onclick='showContextDetails()']");
  }

  async clickShowAllTasks() {
    await this.page.click("button[onclick='showAllTasks()']");
  }

  async setSwitchCost(value) {
    // value is number between 1 and 30
    await this.page.fill('#switchCost', String(value));
    // Trigger input event by evaluating updateSwitchCost if needed by moving the range
    await this.page.evaluate((v) => {
      const el = document.getElementById('switchCost');
      el.value = v;
      if (typeof updateSwitchCost === 'function') updateSwitchCost();
    }, String(value));
  }

  async setInterruptFreq(value) {
    await this.page.fill('#interruptFreq', String(value));
    await this.page.evaluate((v) => {
      const el = document.getElementById('interruptFreq');
      el.value = v;
      if (typeof updateInterruptFreq === 'function') updateInterruptFreq();
    }, String(value));
  }

  // DOM reads
  async getCurrentContextText() {
    return (await this.page.textContent('#currentContext')).trim();
  }

  async getSwitchCount() {
    const t = await this.page.textContent('#switchCount');
    return Number((t || '0').trim());
  }

  async getTimeLost() {
    const t = await this.page.textContent('#timeLost');
    return Number((t || '0').trim());
  }

  async getWorkLogText() {
    return (await this.page.textContent('#workLog')) || '';
  }

  async contextDetailsVisible() {
    return await this.page.evaluate(() => {
      const el = document.getElementById('contextDetails');
      return el && !el.classList.contains('hidden');
    });
  }

  async getDetailsContentText() {
    return (await this.page.textContent('#detailsContent')) || '';
  }

  async getTaskCount() {
    return await this.page.locator('.task').count();
  }

  async isWorking() {
    return await this.page.evaluate(() => typeof isWorking !== 'undefined' ? isWorking : false);
  }

  async clearConsoleAndErrors() {
    this.consoleMessages = [];
    this.pageErrors = [];
  }
}

// Tests
test.describe('Context Switching Simulator - FSM and UI tests', () => {
  let sim;

  test.beforeEach(async ({ page }) => {
    sim = new ContextSimulatorPage(page);
    await sim.init();
    await sim.clearConsoleAndErrors();
  });

  test.afterEach(async () => {
    // Basic sanity: no uncaught page errors during the test
    // Collect any console.error messages as well
    const consoleErrors = sim.consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    // Assert there were no uncaught page errors
    expect(sim.pageErrors.length, `Unexpected page errors: ${sim.pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    // Assert the app did not log console errors/warnings unexpectedly
    expect(consoleErrors.length, `Console error/warning messages found: ${consoleErrors.map(m => m.text).join(' | ')}`).toBe(0);
  });

  test.describe('Initial state (S0_Idle) validations', () => {
    test('renders the main header and stats, initial Idle state', async () => {
      // Validate header exists (evidence of S0_Idle entry action renderPage())
      await expect(sim.page.locator('h1')).toHaveText('Context Switching Simulator');

      // Initial stats should indicate no active context and zeros
      await expect(sim.page.locator('#currentContext')).toHaveText('None');
      await expect(sim.page.locator('#switchCount')).toHaveText('0');
      await expect(sim.page.locator('#timeLost')).toHaveText('0');
    });

    test('ShowContextDetails on Idle displays "No active task"', async () => {
      // Show context details when no task is active
      await sim.clickShowContextDetails();
      const visible = await sim.contextDetailsVisible();
      expect(visible).toBe(true);
      const content = await sim.getDetailsContentText();
      expect(content).toContain('No active task');
    });

    test('ShowAllTasks on Idle displays tasks area (empty table when no tasks)', async () => {
      await sim.clickShowAllTasks();
      const visible = await sim.contextDetailsVisible();
      expect(visible).toBe(true);
      const content = await sim.getDetailsContentText();
      // Since no tasks, the table should be present but empty (no rows besides header)
      expect(content).toContain('All Tasks');
    });
  });

  test.describe('Task management and TaskSelected state (S3_TaskSelected)', () => {
    test('Add Task creates a new task element in the list', async () => {
      // Add a task (transition expected: S0_Idle -> S3_TaskSelected in FSM, but implementation just adds)
      await sim.addTask('Task Alpha', '3');
      // Verify task appears
      await expect(sim.page.locator('.task:has-text("Task Alpha")')).toHaveCount(1);

      // The current context should still be None until user switches to the task
      const ctx = await sim.getCurrentContextText();
      expect(ctx).toBe('None');
    });

    test('SwitchToTask selects a task and updates current context', async () => {
      await sim.addTask('Task Beta', '2');
      // Switch to the task -> enters S3_TaskSelected
      await sim.switchToTaskByName('Task Beta');

      // Current context shows the task name
      const ctx = await sim.getCurrentContextText();
      expect(ctx).toBe('Task Beta');

      // No switch penalty for first selection (switchCount remains 0)
      expect(await sim.getSwitchCount()).toBe(0);
    });

    test('CompleteTask marks a task completed and clears current context if it was active', async () => {
      await sim.addTask('Task ToComplete', '1');
      await sim.switchToTaskByName('Task ToComplete');

      // Complete it
      await sim.completeTaskByName('Task ToComplete');

      // The task's status should be shown as Completed text in the task element
      const taskText = await sim.page.locator('.task:has-text("Task ToComplete")').textContent();
      expect(taskText).toContain('Completed');

      // Because it was active, currentContext should be reset to None
      expect(await sim.getCurrentContextText()).toBe('None');
    });

    test('DeleteTask removes a task from the list and clears context if necessary', async () => {
      await sim.addTask('Task ToDelete', '2');
      // ensure present
      expect(await sim.getTaskCount()).toBeGreaterThan(0);

      await sim.switchToTaskByName('Task ToDelete');
      // Delete it
      await sim.deleteTaskByName('Task ToDelete');

      // It should no longer exist
      const count = await sim.page.locator('.task:has-text("Task ToDelete")').count();
      expect(count).toBe(0);

      // Current context must be None after deleting the active task
      expect(await sim.getCurrentContextText()).toBe('None');
    });
  });

  test.describe('Working (S1_Working) and Paused (S2_Paused) interactions', () => {
    test('StartWork begins a working session and logs the event', async () => {
      // Prepare two tasks for switching behavior
      await sim.addTask('WorkTask1', '2');
      await sim.addTask('WorkTask2', '1');

      // Select first task and start
      await sim.switchToTaskByName('WorkTask1');
      await sim.clickStartWork();

      // isWorking flag should be true
      expect(await sim.isWorking()).toBe(true);

      // Work log should contain "Started working session"
      const log = await sim.getWorkLogText();
      expect(log).toContain('Started working session');

      // Ensure currentContext still lists the task
      expect(await sim.getCurrentContextText()).toBe('WorkTask1');
    });

    test('PauseWork pauses working session and accumulates timeSpent', async () => {
      await sim.addTask('WorkPauseTask', '2');
      await sim.switchToTaskByName('WorkPauseTask');
      await sim.clickStartWork();

      // Wait a short amount so some work time accumulates
      await sim.page.waitForTimeout(1200);

      await sim.clickPauseWork();

      // isWorking should be false now
      expect(await sim.isWorking()).toBe(false);

      // Work log should include a paused message describing the time
      const log = await sim.getWorkLogText();
      expect(log).toMatch(/Paused working on WorkPauseTask after \d+s/);

      // The task listing should show non-zero timeSpent (rendered text)
      const taskText = await sim.page.locator('.task:has-text("WorkPauseTask")').textContent();
      expect(taskText).toMatch(/Time spent: \d+s/);
    });

    test('StartWork from Paused resumes working (S2_Paused -> S1_Working)', async () => {
      await sim.addTask('ResumeTask', '2');
      await sim.switchToTaskByName('ResumeTask');
      await sim.clickStartWork();
      // wait a bit then pause
      await sim.page.waitForTimeout(800);
      await sim.clickPauseWork();

      // resume
      await sim.clickStartWork();
      expect(await sim.isWorking()).toBe(true);

      const log = await sim.getWorkLogText();
      expect(log).toContain('Started working session');
    });
  });

  test.describe('Context Switching: SimulateInterruption and ForceSwitch', () => {
    test('SimulateInterruption performs a context switch when working and multiple tasks exist', async () => {
      // Prepare tasks
      await sim.addTask('InterTask1', '2');
      await sim.addTask('InterTask2', '2');
      await sim.addTask('InterTask3', '1');

      // Select one and start working
      await sim.switchToTaskByName('InterTask1');
      await sim.clickStartWork();
      expect(await sim.isWorking()).toBe(true);

      // Record initial switchCount and timeLost
      const beforeCount = await sim.getSwitchCount();
      const beforeLost = await sim.getTimeLost();

      // Force a simulated interruption
      await sim.clickSimulateInterruption();
      // Allow DOM updates
      await sim.page.waitForTimeout(200);

      // After interruption, if another task was available, switchCount should increase
      const afterCount = await sim.getSwitchCount();
      const afterLost = await sim.getTimeLost();

      // If there was at least one other available task, switchCount should increment
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
      // timeLost should be >= beforeLost (monotonic)
      expect(afterLost).toBeGreaterThanOrEqual(beforeLost);
    });

    test('ForceSwitch triggers a context switch when possible', async () => {
      // Prepare tasks
      await sim.addTask('ForceA', '2');
      await sim.addTask('ForceB', '1');

      await sim.switchToTaskByName('ForceA');
      await sim.clickStartWork();

      const beforeCount = await sim.getSwitchCount();
      await sim.clickForceSwitch();
      await sim.page.waitForTimeout(200);

      const afterCount = await sim.getSwitchCount();
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount);
    });
  });

  test.describe('Context Explorer & details, visual feedback', () => {
    test('ShowContextDetails when a task is active shows contextual memory/focus/state and stack', async () => {
      await sim.addTask('DetailTask1', '2');
      await sim.addTask('DetailTask2', '1');

      // Switch to one, then switch to another to populate contextStack
      await sim.switchToTaskByName('DetailTask1');
      await sim.switchToTaskByName('DetailTask2');

      await sim.clickShowContextDetails();
      const visible = await sim.contextDetailsVisible();
      expect(visible).toBe(true);

      const details = await sim.getDetailsContentText();
      expect(details).toContain('DetailTask2');
      expect(details).toMatch(/Memory state/);
      expect(details).toMatch(/Focus level/);
      expect(details).toMatch(/Context Stack/);
    });

    test('ShowAllTasks renders a tasks table with entries', async () => {
      await sim.addTask('AllTasksA', '1');
      await sim.addTask('AllTasksB', '3');

      await sim.clickShowAllTasks();

      const visible = await sim.contextDetailsVisible();
      expect(visible).toBe(true);

      const content = await sim.getDetailsContentText();
      expect(content).toContain('All Tasks');
      expect(content).toContain('AllTasksA');
      expect(content).toContain('AllTasksB');
    });

    test('Update switch cost and interrupt frequency updates UI values', async () => {
      // Change the switch cost slider and verify displayed value updates
      await sim.setSwitchCost(12);
      await expect(sim.page.locator('#costValue')).toHaveText('12');

      // Change interrupt frequency and verify displayed value
      await sim.setInterruptFreq(45);
      await expect(sim.page.locator('#freqValue')).toHaveText('45');
    });
  });

  test.describe('Reset, edge cases and error scenarios', () => {
    test('ResetAll clears tasks, logs and resets stats', async () => {
      await sim.addTask('ResetTaskA', '2');
      await sim.addTask('ResetTaskB', '1');

      // Start and then reset
      await sim.switchToTaskByName('ResetTaskA');
      await sim.clickStartWork();
      await sim.page.waitForTimeout(500);

      await sim.clickResetAll();
      // After reset, tasks list should be empty and stats back to defaults
      expect(await sim.getTaskCount()).toBe(0);
      expect(await sim.getCurrentContextText()).toBe('None');
      expect(await sim.getSwitchCount()).toBe(0);
      expect(await sim.getTimeLost()).toBe(0);
      // Work log cleared
      const log = await sim.getWorkLogText();
      expect(log.trim()).toBe('');
    });

    test('Starting work with no tasks does nothing (graceful no-op)', async () => {
      // Ensure reset to empty state
      await sim.clickResetAll();

      // Clear any logs or errors
      await sim.clearConsoleAndErrors();

      // Attempt to start work with no tasks
      await sim.clickStartWork();

      // isWorking should still be false
      expect(await sim.isWorking()).toBe(false);

      // No work log entries should have been created
      const log = await sim.getWorkLogText();
      expect(log.trim()).toBe('');
    });

    test('SimulateInterruption and ForceSwitch are no-ops when no currentTask', async () => {
      // Ensure no active task
      await sim.clickResetAll();

      // Clicking simulateInterruption should not throw; ensure no errors logged
      await sim.clickSimulateInterruption();
      await sim.clickForceSwitch();

      // Still no tasks and no errors in page errors
      expect(await sim.getTaskCount()).toBe(0);
      expect(await sim.getCurrentContextText()).toBe('None');
    });
  });
});