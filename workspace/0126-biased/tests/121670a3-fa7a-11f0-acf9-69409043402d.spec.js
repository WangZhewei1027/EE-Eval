import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121670a3-fa7a-11f0-acf9-69409043402d.html';

/**
 * Page Object for the Load Balancing Simulator app.
 * Encapsulates common interactions used across tests.
 */
class AppPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Servers
  async addServer(name, capacity = '10') {
    await this.page.fill('#newServerName', name);
    await this.page.fill('#serverCapacity', String(capacity));
    await this.page.click('#addServerBtn');
  }

  async selectServerByName(name) {
    // choose the server option whose text starts with name
    const opts = await this.page.$$('#serversList option');
    for (const opt of opts) {
      const text = await opt.textContent();
      if (text && text.startsWith(name)) {
        const value = await opt.getAttribute('value');
        await this.page.selectOption('#serversList', value);
        return value;
      }
    }
    return null;
  }

  async selectServerById(id) {
    await this.page.selectOption('#serversList', String(id));
  }

  async removeSelectedServer() {
    await this.page.click('#removeServerBtn');
  }

  async updateSelectedServerCapacity(newCapacity) {
    await this.page.fill('#serverCapacity', String(newCapacity));
    await this.page.click('#updateServerCapacity');
  }

  async clearTasksOnSelectedServer() {
    await this.page.click('#clearServerTasksBtn');
  }

  async getSelectedServerDetails() {
    const id = await this.page.textContent('#serverId');
    const name = await this.page.textContent('#serverName');
    const capacity = await this.page.inputValue('#serverCapacity');
    const load = await this.page.textContent('#serverLoad');
    const tasksCount = await this.page.textContent('#serverTasksCount');
    return { id: id?.trim(), name: name?.trim(), capacity: capacity?.trim(), load: load?.trim(), tasksCount: tasksCount?.trim() };
  }

  // Tasks
  async addTask(name, load = '1') {
    await this.page.fill('#newTaskName', name);
    await this.page.fill('#newTaskLoad', String(load));
    await this.page.click('#addTaskBtn');
  }

  async selectTaskByNameStartsWith(nameStart) {
    const opts = await this.page.$$('#tasksList option');
    for (const opt of opts) {
      const text = await opt.textContent();
      if (text && text.startsWith(nameStart)) {
        const value = await opt.getAttribute('value');
        await this.page.selectOption('#tasksList', value);
        return value;
      }
    }
    return null;
  }

  async assignSelectedTaskToSelectedServer() {
    await this.page.click('#assignTaskToServerBtn');
  }

  async unassignSelectedTask() {
    await this.page.click('#unassignTaskBtn');
  }

  async getSelectedTaskDetails() {
    const id = await this.page.textContent('#taskId');
    const name = await this.page.textContent('#taskName');
    const load = await this.page.textContent('#taskLoad');
    const assigned = await this.page.textContent('#taskAssignedServer');
    return { id: id?.trim(), name: name?.trim(), load: load?.trim(), assigned: assigned?.trim() };
  }

  // Manual assign/unassign
  async manualAssign(taskIdValue, serverIdValue) {
    await this.page.selectOption('#manualTaskSelector', String(taskIdValue));
    await this.page.selectOption('#manualServerSelector', String(serverIdValue));
    await this.page.click('#manualAssignBtn');
    return await this.page.textContent('#manualAssignFeedback');
  }

  async manualUnassign(taskIdValue) {
    await this.page.selectOption('#manualTaskSelector', String(taskIdValue));
    await this.page.click('#manualUnassignBtn');
    return await this.page.textContent('#manualAssignFeedback');
  }

  // Auto balance & algorithms
  async setAlgorithm(value) {
    await this.page.check(`input[name="algorithm"][value="${value}"]`);
  }

  async clickAutoBalance() {
    await this.page.click('#autoBalanceBtn');
  }

  async showSummary() {
    await this.page.click('#showSummaryBtn');
    return await this.page.textContent('#summaryReport');
  }

  // Simulation
  async simulateTasks(count, minLoad = 1, maxLoad = 5) {
    await this.page.fill('#simTaskCount', String(count));
    await this.page.fill('#simTaskMinLoad', String(minLoad));
    await this.page.fill('#simTaskMaxLoad', String(maxLoad));
    await this.page.click('#simulateTasksBtn');
  }

  // Reset / clear all assignments
  async clickResetAll() {
    await this.page.click('#resetAllBtn');
  }

  async clickClearAllTaskAssignments() {
    await this.page.click('#clearTaskAssignmentsBtn');
  }

  // Helpers to count elements
  async getServersOptionsText() {
    const opts = await this.page.$$eval('#serversList option', els => els.map(e => e.textContent));
    return opts.map(t => (t||'').trim());
  }

  async getTasksOptionsText() {
    const opts = await this.page.$$eval('#tasksList option', els => els.map(e => e.textContent));
    return opts.map(t => (t||'').trim());
  }
}

test.describe('Load Balancing Simulator — comprehensive FSM-driven tests', () => {
  let consoleMessages = [];
  let consoleErrors = [];
  let pageErrors = [];
  let dialogs = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Capture console messages and errors
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      consoleMessages.push({ type, text });
      if (type === 'error') consoleErrors.push(text);
    });

    // Capture uncaught page errors
    page.on('pageerror', err => {
      pageErrors.push(err.message || String(err));
    });

    // Collect dialogs
    page.on('dialog', async dialog => {
      dialogs.push({ type: dialog.type(), message: dialog.message() });
      // Default behavior: accept alerts/confirms/prompts unless a test expects dismissal.
      // Tests that need specialized behavior will set up page.once('dialog', ...) before triggering the action.
      try {
        await dialog.accept();
      } catch (e) {
        // ignore acceptance failures in listener
      }
    });

    // Navigate to the application
    await page.goto(APP_URL);
  });

  test.afterEach(async ({ page }) => {
    // Assert there are no uncaught runtime page errors
    expect(pageErrors, `Unexpected page errors: ${pageErrors.join(', ')}`).toEqual([]);
    // Assert there are no console.error outputs
    expect(consoleErrors, `Unexpected console.error logs: ${consoleErrors.join(' || ')}`).toEqual([]);
    // Keep the page open automatically cleaned up by Playwright
  });

  test.describe('Initial Idle state and onEnter actions', () => {
    test('Initial UI contains default servers and tasks (onEnter updateServersList/updateTasksList)', async ({ page }) => {
      const app = new AppPage(page);

      // Verify the default servers were added by the script initialization
      const servers = await app.getServersOptionsText();
      expect(servers.length).toBeGreaterThanOrEqual(3);
      expect(servers.some(s => s.startsWith('ServerA'))).toBeTruthy();
      expect(servers.some(s => s.startsWith('ServerB'))).toBeTruthy();
      expect(servers.some(s => s.startsWith('ServerC'))).toBeTruthy();

      // Verify the default tasks were added
      const tasks = await app.getTasksOptionsText();
      expect(tasks.length).toBeGreaterThanOrEqual(5);
      expect(tasks.some(t => t.startsWith('Task1'))).toBeTruthy();
      expect(tasks.some(t => t.startsWith('Task5'))).toBeTruthy();

      // Server details should reflect the selected server (first server by default)
      const serverDetails = await app.getSelectedServerDetails();
      expect(serverDetails.name).not.toBe('-');
      expect(parseInt(serverDetails.capacity)).toBeGreaterThan(0);

      // Task details should reflect the selected task
      const taskDetails = await app.getSelectedTaskDetails();
      expect(taskDetails.name).not.toBe('-');
      expect(parseInt(taskDetails.load)).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Server management interactions', () => {
    test('Add Server: creates a new server, clears input and resets capacity input to default', async ({ page }) => {
      const app = new AppPage(page);
      const name = 'ServerD';
      await app.addServer(name, 12);

      // Check server was added to list
      const servers = await app.getServersOptionsText();
      expect(servers.some(s => s.startsWith(name))).toBeTruthy();

      // Input fields should be reset: newServerName empty, serverCapacity reset to 10
      const nameVal = await page.inputValue('#newServerName');
      const capacityVal = await page.inputValue('#serverCapacity');
      expect(nameVal).toBe('');
      expect(Number(capacityVal)).toBe(10);
    });

    test('Remove Server: removes a server without tasks', async ({ page }) => {
      const app = new AppPage(page);
      const name = 'ServerToRemove';
      await app.addServer(name, 8);

      // Select the server we just added
      const value = await app.selectServerByName(name);
      expect(value).not.toBeNull();

      // Remove it; no confirm expected since no tasks assigned
      // Ensure dialog handling doesn't fail - we didn't set up a specialized dialog handler here
      await app.removeSelectedServer();

      const servers = await app.getServersOptionsText();
      expect(servers.some(s => s.startsWith(name))).toBeFalsy();
    });

    test('Update Server Capacity: updates capacity and list reflects change', async ({ page }) => {
      const app = new AppPage(page);
      // Select ServerA
      const selectedValue = await app.selectServerByName('ServerA');
      expect(selectedValue).not.toBeNull();

      // Update capacity to 8
      await app.updateSelectedServerCapacity(8);

      // After update, server details should show capacity 8
      const details = await app.getSelectedServerDetails();
      expect(Number(details.capacity)).toBe(8);

      // And servers list option should include new capacity string
      const servers = await app.getServersOptionsText();
      expect(servers.some(s => s.startsWith('ServerA') && s.includes('Cap:8')) || servers.some(s => s.startsWith('ServerA') && s.includes('Cap:8)'))).toBeTruthy();
    });

    test('Clear Tasks on Server: unassigns tasks and updates server/tasks lists', async ({ page }) => {
      const app = new AppPage(page);

      // Assign Task1 to ServerA
      const taskValue = await app.selectTaskByNameStartsWith('Task1');
      expect(taskValue).not.toBeNull();
      const serverValue = await app.selectServerByName('ServerA');
      expect(serverValue).not.toBeNull();

      await app.assignSelectedTaskToSelectedServer();

      // Verify task shows assigned server in task details
      const taskDetails = await app.getSelectedTaskDetails();
      expect(taskDetails.assigned).toMatch(/ServerA/);

      // Now clear tasks on ServerA
      await app.selectServerById(serverValue);
      await app.clearTasksOnSelectedServer();

      // Task should be unassigned
      await app.selectTaskByNameStartsWith('Task1');
      const afterUnassign = await app.getSelectedTaskDetails();
      expect(afterUnassign.assigned).toMatch(/Unassigned/);

      // Server tasks count should be 0
      await app.selectServerById(serverValue);
      const serverDetails = await app.getSelectedServerDetails();
      expect(Number(serverDetails.tasksCount)).toBe(0);
    });

    test('Remove server that has assigned tasks: confirm dialog is shown and removal proceeds when accepted', async ({ page }) => {
      const app = new AppPage(page);
      // Create a server and task, assign the task to the server
      const srvName = 'ServerWithTasks';
      await app.addServer(srvName, 20);
      const srvValue = await app.selectServerByName(srvName);
      expect(srvValue).not.toBeNull();

      const taskName = 'TaskForRemoval';
      await app.addTask(taskName, 1);
      const taskValue = await app.selectTaskByNameStartsWith(taskName);
      expect(taskValue).not.toBeNull();

      // Assign via manual selectors to ensure assignment happens
      await app.page.selectOption('#tasksList', String(taskValue));
      await app.page.selectOption('#serversList', String(srvValue));
      await app.assignSelectedTaskToSelectedServer();

      // Now attempt to remove server; a confirm dialog should appear because server has tasks.
      // Set up one-time dialog handler to verify message and accept.
      const [dialog] = await Promise.all([
        app.page.waitForEvent('dialog'),
        app.removeSelectedServer()
      ]);
      expect(dialog.message()).toMatch(/Server has assigned tasks/);
      await dialog.accept();

      // After acceptance, server should be removed and task should be unassigned
      const servers = await app.getServersOptionsText();
      expect(servers.some(s => s.startsWith(srvName))).toBeFalsy();

      // Verify task is unassigned
      await app.selectTaskByNameStartsWith(taskName);
      const taskDetails = await app.getSelectedTaskDetails();
      expect(taskDetails.assigned).toMatch(/Unassigned/);
    });
  });

  test.describe('Task management interactions', () => {
    test('Add Task: creates a new task and resets inputs', async ({ page }) => {
      const app = new AppPage(page);
      const taskName = 'NewTask1';
      await app.addTask(taskName, 5);

      const tasks = await app.getTasksOptionsText();
      expect(tasks.some(t => t.startsWith(taskName))).toBeTruthy();

      const nameVal = await page.inputValue('#newTaskName');
      const loadVal = await page.inputValue('#newTaskLoad');
      expect(nameVal).toBe('');
      expect(Number(loadVal)).toBe(1);
    });

    test('Remove Task: removes a selected task and updates lists', async ({ page }) => {
      const app = new AppPage(page);
      const taskName = 'TaskToDelete';
      await app.addTask(taskName, 2);

      // Select and remove
      await app.selectTaskByNameStartsWith(taskName);
      await page.click('#removeTaskBtn');

      const tasks = await app.getTasksOptionsText();
      expect(tasks.some(t => t.startsWith(taskName))).toBeFalsy();
    });

    test('Assign and Unassign Task via task details buttons (capacity enforcement)', async ({ page }) => {
      const app = new AppPage(page);

      // Create a small capacity server, create a big task and attempt to assign -> expect alert (capacity exceeded)
      const srvName = 'TinyServer';
      await app.addServer(srvName, 2);
      const srvValue = await app.selectServerByName(srvName);
      expect(srvValue).not.toBeNull();

      const bigTaskName = 'BigTask';
      await app.addTask(bigTaskName, 5);
      const taskValue = await app.selectTaskByNameStartsWith(bigTaskName);
      expect(taskValue).not.toBeNull();

      // Expect an alert about capacity exceeded when assigning; handle dialog
      const dialogPromise = page.waitForEvent('dialog');
      await app.assignSelectedTaskToSelectedServer();
      const dialog = await dialogPromise;
      // The code returns an object with success:false and a message which is shown via alert
      expect(dialog.message()).toMatch(/Server capacity exceeded|cannot be assigned/i);
      await dialog.accept();

      // Now create a task that fits and assign it, then unassign
      const smallTaskName = 'SmallTask';
      await app.addTask(smallTaskName, 2);
      const smallTaskValue = await app.selectTaskByNameStartsWith(smallTaskName);
      expect(smallTaskValue).not.toBeNull();

      // Select this server and assign the small task
      await app.page.selectOption('#serversList', String(srvValue));
      await app.page.selectOption('#tasksList', String(smallTaskValue));
      await app.assignSelectedTaskToSelectedServer();

      const smallTaskDetails = await app.getSelectedTaskDetails();
      expect(smallTaskDetails.assigned).toMatch(new RegExp(srvName));

      // Unassign using unassign button
      await app.unassignSelectedTask();
      const afterUnassign = await app.getSelectedTaskDetails();
      expect(afterUnassign.assigned).toMatch(/Unassigned/);
    });
  });

  test.describe('Load balancing algorithms and auto-balance', () => {
    test('AutoBalance (roundrobin): assigns tasks across servers without exceeding capacities', async ({ page }) => {
      const app = new AppPage(page);

      // Ensure algorithm is Round Robin
      await app.setAlgorithm('roundrobin');

      // Clear any current assignments
      await app.clickClearAllTaskAssignments();

      // Trigger auto balance
      await app.clickAutoBalance();

      // After auto balance, tasks should be either assigned or remain unassigned if capacity insufficient
      const tasks = await app.getTasksOptionsText();
      expect(tasks.length).toBeGreaterThan(0);

      // At least one task should display assigned (unless capacities are zero which they aren't)
      const assignedFound = tasks.some(t => /\[.*\]/.test(t) && !t.includes('Unassigned'));
      expect(assignedFound).toBeTruthy();
    });

    test('AutoBalance with Least Connections algorithm balances by load', async ({ page }) => {
      const app = new AppPage(page);

      // Select least connections algorithm
      await app.setAlgorithm('leastconn');

      // Clear assignments then auto balance
      await app.clickClearAllTaskAssignments();
      await app.clickAutoBalance();

      // Validate that tasks are assigned (no runtime errors) and summary reflects assignments
      const summary = await app.showSummary();
      expect(summary).toBeTruthy();
      expect(summary).toMatch(/Servers Summary:/);
      expect(summary).toMatch(/Tasks Summary:/);
    });

    test('Custom Weights: show inputs when selected and allow updating weights', async ({ page }) => {
      const app = new AppPage(page);

      // Ensure we have at least one server
      await app.addServer('WeightServer1', 20);
      await app.addServer('WeightServer2', 20);

      // Select custom algorithm
      await app.setAlgorithm('custom');

      // Wait for weights inputs to be visible and populated
      await page.waitForSelector('#weightsInputs', { state: 'visible' });

      // Update weights using the updateWeightsBtn
      // Set weights by directly filling input values based on generated inputs
      const weightInputs = await page.$$('#weightsInputs input[type="number"]');
      expect(weightInputs.length).toBeGreaterThanOrEqual(2);
      // Fill all weights with value 3
      for (const input of weightInputs) {
        await input.fill('3');
      }

      // Listen for the alert confirmation that weights are updated
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#updateWeightsBtn');
      const dialog = await dialogPromise;
      expect(dialog.message()).toMatch(/Custom weights updated/i);
      await dialog.accept();

      // Trigger auto balance to ensure no errors
      await app.clickAutoBalance();

      // Summary should still be present
      const summary = await app.showSummary();
      expect(summary).toContain('Servers Summary:');
    });
  });

  test.describe('Simulation and manual controls', () => {
    test('Simulate incoming tasks and auto balance them', async ({ page }) => {
      const app = new AppPage(page);

      // Ensure there is at least one server available
      await app.addServer('SimServer', 50);

      // Count tasks before simulation
      const beforeCount = (await app.getTasksOptionsText()).length;

      // Simulate 3 tasks
      await app.simulateTasks(3, 1, 3);

      // After simulation and auto balance, tasks should increase by at least 3
      const afterCount = (await app.getTasksOptionsText()).length;
      expect(afterCount).toBeGreaterThanOrEqual(beforeCount + 3);
    });

    test('Manual assignment feedback works correctly', async ({ page }) => {
      const app = new AppPage(page);

      // Create a server and a task
      await app.addServer('ManualSrv', 10);
      await app.addTask('ManualTask', 1);

      // Get their options values
      const srvVal = await app.selectServerByName('ManualSrv');
      const taskVal = await app.selectTaskByNameStartsWith('ManualTask');
      expect(srvVal).not.toBeNull();
      expect(taskVal).not.toBeNull();

      // Use manual assign controls
      await app.page.selectOption('#manualTaskSelector', String(taskVal));
      await app.page.selectOption('#manualServerSelector', String(srvVal));
      await app.page.click('#manualAssignBtn');

      // Feedback should say assigned
      const feedbackAfterAssign = (await page.textContent('#manualAssignFeedback')).trim();
      expect(feedbackAfterAssign).toMatch(/assigned/i);

      // Now manual unassign
      await app.page.selectOption('#manualTaskSelector', String(taskVal));
      await app.page.click('#manualUnassignBtn');
      const feedbackUnassign = (await page.textContent('#manualAssignFeedback')).trim();
      expect(feedbackUnassign).toMatch(/unassigned/i);
    });
  });

  test.describe('Reset and clearing assignments', () => {
    test('Clear all task assignments: assignments are removed and UI updates', async ({ page }) => {
      const app = new AppPage(page);
      // Ensure at least one server and task and assign
      await app.addServer('ClearAssignSrv', 10);
      await app.addTask('ClearAssignTask', 1);

      const srvVal = await app.selectServerByName('ClearAssignSrv');
      const taskVal = await app.selectTaskByNameStartsWith('ClearAssignTask');
      expect(srvVal).not.toBeNull();
      expect(taskVal).not.toBeNull();

      // Assign
      await app.page.selectOption('#serversList', String(srvVal));
      await app.page.selectOption('#tasksList', String(taskVal));
      await app.assignSelectedTaskToSelectedServer();

      // Confirm task assigned
      await app.selectTaskByNameStartsWith('ClearAssignTask');
      const assignedBefore = (await app.getSelectedTaskDetails()).assigned;
      expect(assignedBefore).toMatch(/ClearAssignSrv/);

      // Clear all assignments
      await app.clickClearAllTaskAssignments();

      // Task should be unassigned now
      await app.selectTaskByNameStartsWith('ClearAssignTask');
      const after = (await app.getSelectedTaskDetails()).assigned;
      expect(after).toMatch(/Unassigned/);
    });

    test('Reset All: confirm removal via dialog and lists are cleared', async ({ page }) => {
      const app = new AppPage(page);

      // Add a server and a task to ensure there is something to reset
      await app.addServer('ToResetSrv', 5);
      await app.addTask('ToResetTask', 1);

      // Trigger reset and accept confirmation via dialog handling
      const dialogPromise = page.waitForEvent('dialog');
      await app.clickResetAll();
      const dialog = await dialogPromise;
      expect(dialog.message()).toMatch(/This will delete all servers and tasks/);
      await dialog.accept();

      // After reset, servers and tasks lists should be empty
      const servers = await app.getServersOptionsText();
      const tasks = await app.getTasksOptionsText();
      // Note: the script upon initialization adds default servers/tasks. After a full reset the lists should be empty until re-initialization logic; however the app code resets servers/tasks arrays and then calls updateServersList/updateTasksList which would reflect empty lists.
      // Because initial script had defaults executed once at load, and reset clears arrays, expect empty lists
      expect(servers.length).toBe(0);
      expect(tasks.length).toBe(0);
    });
  });

  test.describe('Edge cases and validation errors', () => {
    test('Adding server with empty name shows alert and does not add server', async ({ page }) => {
      const app = new AppPage(page);

      // Prepare to capture the alert
      const dialogPromise = page.waitForEvent('dialog');
      // Attempt to add server with empty name
      await app.addServer('   ', 10);
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toMatch(/Server name cannot be empty/i);
      await dialog.accept();

      // Ensure no server with empty name was added
      const servers = await app.getServersOptionsText();
      expect(servers.some(s => s.trim() === '')).toBeFalsy();
    });

    test('Adding duplicate server name triggers validation alert', async ({ page }) => {
      const app = new AppPage(page);
      const dupName = 'DupServer';
      await app.addServer(dupName, 5);

      // Attempt to add the same name again
      const dialogPromise = page.waitForEvent('dialog');
      await app.addServer(dupName, 5);
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toMatch(/Server name must be unique/i);
      await dialog.accept();
    });

    test('Adding task with invalid load (0) shows alert', async ({ page }) => {
      const app = new AppPage(page);
      const dialogPromise = page.waitForEvent('dialog');
      await app.addTask('BadLoadTask', 0);
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toMatch(/Task load must be an integer/i);
      await dialog.accept();
    });

    test('Update server capacity without selection triggers alert', async ({ page }) => {
      const app = new AppPage(page);
      // Deselect any server by clearing options temporarily (simulate user with no selection)
      // The UI will treat empty selection as no value; select nothing by evaluating JS
      await page.evaluate(() => { document.getElementById('serversList').value = ''; });
      const dialogPromise = page.waitForEvent('dialog');
      await app.updateSelectedServerCapacity(5);
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toMatch(/Select a server first/);
      await dialog.accept();
    });

    test('Removing a task without selection triggers alert', async ({ page }) => {
      const app = new AppPage(page);
      // Deselect tasks
      await page.evaluate(() => { document.getElementById('tasksList').value = ''; });
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#removeTaskBtn');
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toMatch(/Select a task to remove/i);
      await dialog.accept();
    });
  });
});