import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f82a1-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object for the Sprint Tracker app.
 * Encapsulates common interactions and selectors used across tests.
 */
class SprintTrackerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.taskInput = page.locator('#task-input');
    this.addButton = page.locator('#add-task button');
    this.sprintsContainer = page.locator('#sprints');
  }

  async goto() {
    await this.page.goto(BASE_URL);
    // Wait for initial render evidence (h1) to ensure the page script has loaded.
    await this.page.waitForSelector('h1:has-text("Agile Methodology - Sprint Tracker")');
  }

  async addTask(taskText) {
    await this.taskInput.fill(taskText);
    await this.addButton.click();
  }

  // Returns locator for sprint by number
  sprintLocator(sprintNumber) {
    return this.page.locator(`#sprint-${sprintNumber}`);
  }

  // Returns locator for task-list of a sprint
  taskListLocator(sprintNumber) {
    return this.page.locator(`#task-list-${sprintNumber}`);
  }

  completedCountLocator(sprintNumber) {
    return this.page.locator(`#completed-${sprintNumber}`);
  }

  totalCountLocator(sprintNumber) {
    return this.page.locator(`#total-${sprintNumber}`);
  }

  // Returns locator for the first checkbox inside a sprint's task list (if present)
  firstCheckboxInSprint(sprintNumber) {
    return this.page.locator(`#task-list-${sprintNumber} input[type="checkbox"]`).first();
  }
}

test.describe('Agile Methodology - Sprint Tracker (FSM validation)', () => {
  // We'll collect console errors and page errors for each test and assert none occurred.
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    // Collect console error messages
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });

    // Collect page runtime errors (uncaught exceptions)
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });
  });

  test.afterEach(async () => {
    // After each test assert there were no console errors or page errors.
    // Tests will fail if unexpected runtime errors occurred.
    expect(consoleErrors, `Console errors occurred: ${JSON.stringify(consoleErrors, null, 2)}`).toHaveLength(0);
    expect(pageErrors, `Page errors occurred: ${JSON.stringify(pageErrors, null, 2)}`).toHaveLength(0);
  });

  test('Initial state (S0_Idle): page renders expected title and empty sprints container', async ({ page }) => {
    // Validate initial rendering evidence (onEnter: renderPage()) and FSM initial state evidence
    const app = new SprintTrackerPage(page);
    await app.goto();

    // Verify h1 title exists as evidence of the Idle state
    const title = page.locator('h1');
    await expect(title).toHaveText('Agile Methodology - Sprint Tracker');

    // Verify sprints container exists and is initially empty
    const sprints = page.locator('#sprints');
    await expect(sprints).toBeVisible();
    await expect(sprints).toHaveJSProperty('childElementCount', 0);
  });

  test('Add Task transition (S0_Idle -> S1_TaskAdded): valid task creates a new sprint and task', async ({ page }) => {
    // This test validates the AddTask event, FSM transition, DOM updates, and attributes evidences.
    const app = new SprintTrackerPage(page);
    await app.goto();

    const testTask = 'Implement login flow';

    // Ensure the add button has the expected onclick attribute evidence
    const addButton = page.locator('#add-task button');
    await expect(addButton).toBeVisible();
    const onclickAttr = await addButton.getAttribute('onclick');
    // Evidence mentioned in FSM: onclick="addTask()"
    expect(onclickAttr, 'Add button should have onclick attribute invoking addTask()').toContain('addTask');

    // Perform AddTask event
    await app.addTask(testTask);

    // After adding, a new sprint should be created. Since sprintCounter starts at 0, first sprint is 1.
    const sprint1 = app.sprintLocator(1);
    await expect(sprint1).toBeVisible();

    // Task list should have one item containing the entered text
    const taskList1 = app.taskListLocator(1);
    await expect(taskList1).toBeVisible();
    await expect(taskList1.locator('li')).toHaveCount(1);
    const liText = await taskList1.locator('li').first().innerText();
    expect(liText).toContain(testTask);

    // Verify total and completed counts
    await expect(app.totalCountLocator(1)).toHaveText('1');
    await expect(app.completedCountLocator(1)).toHaveText('0');

    // Verify the input was cleared after adding (evidence of using taskInput.value.trim())
    await expect(page.locator('#task-input')).toHaveValue('');

    // Verify the created checkbox includes onclick handler evidence updateProgress(${sprintNumber}, this)
    const checkbox = app.firstCheckboxInSprint(1);
    await expect(checkbox).toBeVisible();
    const checkboxOnclick = await checkbox.getAttribute('onclick');
    expect(checkboxOnclick, 'Checkbox should have onclick calling updateProgress with sprint number').toContain('updateProgress(1');
  });

  test('UpdateProgress event: checking and unchecking updates completed count and triggers alert when all completed', async ({ page }) => {
    // This test validates the UpdateProgress event and its loop-back transition (S1_TaskAdded -> S1_TaskAdded)
    const app = new SprintTrackerPage(page);
    await app.goto();

    // Prepare to capture dialog messages
    const dialogs = [];
    page.on('dialog', async (dialog) => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept();
    });

    // Add a single task which will create sprint 1 with total=1
    const singleTask = 'Write unit tests';
    await app.addTask(singleTask);

    // The checkbox should exist
    const checkbox = app.firstCheckboxInSprint(1);
    await expect(checkbox).toBeVisible();

    // Check the box -> completed should go from 0 to 1 and alert should fire saying all tasks completed
    await checkbox.check();
    await expect(app.completedCountLocator(1)).toHaveText('1');

    // There should be a dialog captured indicating completion for sprint 1
    expect(dialogs.length).toBeGreaterThanOrEqual(1);
    const completionDialog = dialogs.find(d => d.message.includes('All tasks in Sprint 1 are completed!'));
    expect(completionDialog, `Expected completion dialog with sprint number 1; got dialogs: ${JSON.stringify(dialogs)}`).toBeTruthy();

    // Uncheck the box -> completed should decrement to 0; no dialog on uncheck
    await checkbox.uncheck();
    await expect(app.completedCountLocator(1)).toHaveText('0');
  });

  test('Edge case: Adding empty task shows alert and does not create a sprint', async ({ page }) => {
    // Validate error scenario: clicking Add Task with empty/whitespace input should alert and not change sprints
    const app = new SprintTrackerPage(page);
    await app.goto();

    // Prepare dialog capture
    let capturedDialog = null;
    page.on('dialog', async (dialog) => {
      capturedDialog = { message: dialog.message(), type: dialog.type() };
      await dialog.accept();
    });

    // Ensure input is empty or whitespace
    await page.locator('#task-input').fill('    ');
    // Click Add Task -> should trigger alert('Please enter a task!')
    await page.locator('#add-task button').click();

    // Assert dialog appeared with expected message
    expect(capturedDialog, 'Expected an alert dialog for empty task input').not.toBeNull();
    expect(capturedDialog.message).toContain('Please enter a task');

    // Ensure no new sprints were created (still zero)
    await expect(app.sprintsContainer).toHaveJSProperty('childElementCount', 0);
  });

  test('Multiple AddTask calls create multiple sprints (each task creates a new sprint)', async ({ page }) => {
    // Validate that each AddTask creates a new sprint as per implementation
    const app = new SprintTrackerPage(page);
    await app.goto();

    const tasks = ['Task A', 'Task B', 'Task C'];

    for (const t of tasks) {
      await app.addTask(t);
    }

    // Expect as many sprints as tasks, each with its own counts
    for (let i = 1; i <= tasks.length; i++) {
      const sprint = app.sprintLocator(i);
      await expect(sprint).toBeVisible();
      await expect(app.taskListLocator(i).locator('li')).toHaveCount(1);
      const liText = await app.taskListLocator(i).locator('li').first().innerText();
      expect(liText).toContain(tasks[i - 1]);
      await expect(app.totalCountLocator(i)).toHaveText('1');
      await expect(app.completedCountLocator(i)).toHaveText('0');
    }

    // Ensure sprints container has correct number of children
    await expect(app.sprintsContainer).toHaveJSProperty('childElementCount', tasks.length);
  });

  test('Sanity check: event handler attributes exist exactly as described in FSM extraction', async ({ page }) => {
    // This test explicitly checks the presence of evidence strings mentioned in the FSM extraction summary.
    const app = new SprintTrackerPage(page);
    await app.goto();

    // Verify add button's inline onclick evidence
    const addButton = page.locator('#add-task button');
    const addOnclick = await addButton.getAttribute('onclick');
    // Evidence expected: "onclick=\"addTask()\""
    expect(addOnclick).toContain('addTask');

    // Add a task to create a sprint and a checkbox to inspect its onclick attribute
    await app.addTask('Check handler existence');

    const checkbox = app.firstCheckboxInSprint(1);
    const cbOnclick = await checkbox.getAttribute('onclick');
    // Evidence expected: "onclick=\"updateProgress(${sprintNumber}, this)\"" which should contain updateProgress
    expect(cbOnclick).toContain('updateProgress(1');
  });
});