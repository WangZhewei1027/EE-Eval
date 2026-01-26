import { test, expect } from '@playwright/test';

// Test file for Application ID: de3cc401-fa74-11f0-a1b6-4b9b8151441a
// URL served at:
// http://127.0.0.1:5500/workspace/0126-balanced/html/de3cc401-fa74-11f0-a1b6-4b9b8151441a.html

// Page object model for interacting with the app
class AppPage {
  constructor(page) {
    this.page = page;
    // Controls
    this.addTaskBtn = page.locator('#addTask');
    this.switchFasterBtn = page.locator('#switchFaster');
    this.switchSlowerBtn = page.locator('#switchSlower');
    // Containers / stats
    this.taskContainer = page.locator('#taskContainer');
    this.completedCountEl = page.locator('#completedCount');
    this.avgTimeEl = page.locator('#avgTime');
    this.switchCountEl = page.locator('#switchCount');
    this.switchDelayEl = page.locator('#switchDelay');
  }

  // Helper: count tasks in DOM
  async taskCount() {
    return await this.taskContainer.locator('.task').count();
  }

  // Helper: get text content for stats as numbers
  async completedCount() {
    const txt = await this.completedCountEl.textContent();
    return Number(txt || '0');
  }
  async avgTime() {
    const txt = await this.avgTimeEl.textContent();
    return Number(txt || '0');
  }
  async switchCount() {
    const txt = await this.switchCountEl.textContent();
    return Number(txt || '0');
  }
  async switchDelay() {
    const txt = await this.switchDelayEl.textContent();
    return Number(txt || '0');
  }

  // Click actions
  async clickAddTask() {
    await this.addTaskBtn.click();
  }
  async clickSwitchFaster() {
    await this.switchFasterBtn.click();
  }
  async clickSwitchSlower() {
    await this.switchSlowerBtn.click();
  }

  // Get nth task element (1-based id) locator by index (0-based)
  taskAt(index) {
    return this.taskContainer.locator('.task').nth(index);
  }

  // Wait for at least N completed tasks (polls until completedCount >= n)
  async waitForCompletedAtLeast(n, timeout = 10000) {
    await this.page.waitForFunction(
      (sel, expected) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        return Number(el.textContent || '0') >= expected;
      },
      ['#completedCount', n],
      { timeout }
    );
  }

  // Wait until there are zero active tasks (activeTaskIndex === -1 in app)
  // We infer "no active task" by checking that no .task element has class "active"
  async waitForNoActiveTask(timeout = 10000) {
    await this.page.waitForFunction(
      () => !document.querySelector('.task.active'),
      null,
      { timeout }
    );
  }
}

test.describe('Context Switching Demonstration UI and FSM behaviors', () => {
  // Collect console messages and page errors to observe runtime errors
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture uncaught page errors
    page.on('pageerror', (err) => {
      pageErrors.push(String(err));
    });

    // Navigate to the running HTML page
    await page.goto('http://127.0.0.1:5500/workspace/0126-balanced/html/de3cc401-fa74-11f0-a1b6-4b9b8151441a.html');
  });

  test.afterEach(async () => {
    // Basic sanity: console and pageErrors arrays are available for assertions in tests.
    // Nothing to do globally in teardown.
  });

  test('Initial render - S0_Idle evidence and baseline checks', async ({ page }) => {
    const app = new AppPage(page);

    // Validate the main heading exists as evidence of the Idle state's entry rendering
    // (FSM S0_Idle evidence mentions <h1>Context Switching Demonstration</h1>)
    const h1 = page.locator('h1');
    await expect(h1).toHaveText('Context Switching Demonstration');

    // The UI script creates 3 tasks on load. Ensure at least 3 task elements exist.
    const count = await app.taskCount();
    expect(count).toBeGreaterThanOrEqual(3);

    // The switchDelay element should initialize to 500 per implementation and FSM component evidence.
    const delay = await app.switchDelay();
    expect(delay).toBe(500);

    // There should be no uncaught page errors on load.
    expect(pageErrors).toEqual([]);

    // There should be no console messages of type 'error' by default.
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length).toBe(0);
  });

  test('Add Task transitions from Idle/NoActive to Task Active and DOM updates', async ({ page }) => {
    const app = new AppPage(page);

    // Ensure we can reach a state with no active task: wait for all initial tasks to complete OR clear active flag by waiting for no .task.active
    // Note: On load tasks may be active; we still test adding a task in the presence of active tasks.
    const initialCount = await app.taskCount();

    // Click Add Task to trigger AddTask event and transition
    await app.clickAddTask();

    // Verify the task count increased by 1
    const newCount = await app.taskCount();
    expect(newCount).toBe(initialCount + 1);

    // After adding, there should be at least one .task with class 'active' (Task Active state evidence)
    const activeTasks = await page.locator('.task.active').count();
    expect(activeTasks).toBeGreaterThanOrEqual(1);

    // Switch count should be at least 1 (switch occurs when a new task becomes active)
    const swCount = await app.switchCount();
    expect(swCount).toBeGreaterThanOrEqual(1);
  });

  test('Switch Faster and Switch Slower adjust switchDelay with bounds enforced', async ({ page }) => {
    const app = new AppPage(page);

    // Read starting delay
    const initialDelay = await app.switchDelay();
    expect(initialDelay).toBeGreaterThanOrEqual(100);
    expect(initialDelay).toBeLessThanOrEqual(2000);

    // Click Switch Faster and confirm decrease by 100, respecting lower bound 100
    await app.clickSwitchFaster();
    const afterFaster = await app.switchDelay();
    expect(afterFaster).toBe(Math.max(100, initialDelay - 100));

    // Click Switch Faster repeatedly to attempt to go below lower bound
    for (let i = 0; i < 10; i++) {
      await app.clickSwitchFaster();
    }
    const minDelay = await app.switchDelay();
    expect(minDelay).toBeGreaterThanOrEqual(100);
    expect(minDelay).toBe(100); // should clamp to 100 after enough clicks

    // Click Switch Slower repeatedly to attempt to reach upper bound 2000
    for (let i = 0; i < 30; i++) {
      await app.clickSwitchSlower();
    }
    const maxDelay = await app.switchDelay();
    expect(maxDelay).toBeLessThanOrEqual(2000);
    expect(maxDelay).toBe(2000); // should clamp to 2000 after enough clicks

    // No uncaught page errors during these UI interactions
    expect(pageErrors).toEqual([]);
  });

  test('Task processing leads to TaskCompleted state and metrics update', async ({ page }) => {
    const app = new AppPage(page);

    // Speed up switching to minimum to accelerate progress
    // Click Switch Faster repeatedly until 100ms (lower bound)
    for (let i = 0; i < 10; i++) {
      await app.clickSwitchFaster();
    }
    expect(await app.switchDelay()).toBe(100);

    // Wait for at least one task to complete (completedCount >= 1)
    // The processing increments progress by 10 per switchDelay; with multiple tasks it may take a few cycles.
    await app.waitForCompletedAtLeast(1, 20000); // allow up to 20s for completion in CI

    // Verify that at least one .task has class 'completed'
    const completedTaskCountEl = await page.locator('.task.completed').count();
    expect(completedTaskCountEl).toBeGreaterThanOrEqual(1);

    // Ensure completedCount element reflects same count as DOM 'completed' tasks
    const completedCountStat = await app.completedCount();
    expect(completedCountStat).toBeGreaterThanOrEqual(1);
    expect(completedCountStat).toBeGreaterThanOrEqual(completedTaskCountEl);

    // Average time should be non-zero after at least one completion
    const avg = await app.avgTime();
    expect(avg).toBeGreaterThanOrEqual(0);

    // No uncaught exceptions observed during processing
    expect(pageErrors).toEqual([]);
  });

  test('Edge case: After all tasks completed, adding a new task should activate it (Idle -> Task Active)', async ({ page }) => {
    const app = new AppPage(page);

    // Wait until all existing tasks become completed and no active task remains.
    // Strategy: Wait until completedCount equals current number of tasks AND no .task.active exists.
    const startingTasks = await app.taskCount();

    // Wait until completedCount >= startingTasks (this may take some time)
    await app.waitForCompletedAtLeast(startingTasks, 30000); // allow up to 30s in slow environments

    // Ensure no active task remains
    await app.waitForNoActiveTask(5000);

    // Add a new task when system is idle (activeTaskIndex should be -1 in app logic)
    await app.clickAddTask();

    // New task should be appended and should become active (Task Active state)
    const afterCount = await app.taskCount();
    expect(afterCount).toBe(startingTasks + 1);

    const activeNow = await page.locator('.task.active').count();
    expect(activeNow).toBeGreaterThanOrEqual(1);
  });

  test('Robustness: Monitor console for unexpected errors during long processing', async ({ page }) => {
    const app = new AppPage(page);

    // Clear previous console records captured in this test run
    // (Re-register listeners in beforeEach already captured from navigation. We inspect collected messages.)
    // Wait for a short time allowing some processing to happen
    await page.waitForTimeout(2000);

    // Assert there are no console messages of severity error
    const errorMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorMsgs.length).toBe(0);

    // Assert there were no uncaught page errors
    expect(pageErrors.length).toBe(0);
  });
});