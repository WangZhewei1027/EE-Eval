import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d8751-fa74-11f0-a1b6-4b9b8151441a.html';

// Simple Page Object Model for the Agile app
class AgilePage {
  constructor(page) {
    this.page = page;
    this.dialogs = [];
    this.consoleErrors = [];
    this.pageErrors = [];
  }

  // Setup listeners for dialogs, console errors, and page errors
  async attachListeners() {
    this.page.on('dialog', async dialog => {
      try {
        this.dialogs.push(dialog.message());
        await dialog.accept();
      } catch (e) {
        // let it fail naturally if accepting is not possible
      }
    });

    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });

    this.page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
  }

  // Navigation and initial wait
  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main heading to confirm page loaded
    await expect(this.page.locator('h1')).toHaveText('Agile Methodology Demonstration');
  }

  // Helpers to locate UI elements
  backlogTaskLocator(index = 0) {
    return this.page.locator('#backlogItems .task').nth(index);
  }
  todoTaskLocator(index = 0) {
    return this.page.locator('#todoColumn .task').nth(index);
  }
  inProgressTaskLocator(index = 0) {
    return this.page.locator('#inProgressColumn .task').nth(index);
  }
  reviewTaskLocator(index = 0) {
    return this.page.locator('#reviewColumn .task').nth(index);
  }
  doneTaskLocator(index = 0) {
    return this.page.locator('#doneColumn .task').nth(index);
  }

  startSprintBtn() { return this.page.locator('#startSprintBtn'); }
  dailyScrumBtn() { return this.page.locator('#dailyScrumBtn'); }
  completeTaskBtn() { return this.page.locator('#completeTaskBtn'); }
  endSprintBtn() { return this.page.locator('#endSprintBtn'); }

  // Actions
  async clickFirstBacklogTask() {
    await this.backlogTaskLocator(0).click();
  }
  async clickTodoTask() {
    await this.todoTaskLocator(0).click();
  }
  async clickInProgressTask() {
    await this.inProgressTaskLocator(0).click();
  }
  async clickReviewTask() {
    await this.reviewTaskLocator(0).click();
  }
  async clickStartSprint() {
    await this.startSprintBtn().click();
  }
  async clickDailyScrum() {
    await this.dailyScrumBtn().click();
  }
  async clickCompleteTask() {
    await this.completeTaskBtn().click();
  }
  async clickEndSprint() {
    await this.endSprintBtn().click();
  }

  // Runtime state introspection helpers (read global variables from page)
  async getSprintActive() {
    return await this.page.evaluate(() => typeof sprintActive !== 'undefined' ? sprintActive : null);
  }
  async getSprintDaysRemaining() {
    return await this.page.evaluate(() => typeof sprintDaysRemaining !== 'undefined' ? sprintDaysRemaining : null);
  }
  async getCounts() {
    return await this.page.evaluate(() => {
      return {
        backlog: document.querySelectorAll('#backlogItems .task').length,
        todo: document.querySelectorAll('#todoColumn .task').length,
        inProgress: document.querySelectorAll('#inProgressColumn .task').length,
        review: document.querySelectorAll('#reviewColumn .task').length,
        done: document.querySelectorAll('#doneColumn .task').length,
        // expose arrays lengths if available
        sprintBacklogLen: typeof sprintBacklog !== 'undefined' ? sprintBacklog.length : null,
        todoTasksLen: typeof todoTasks !== 'undefined' ? todoTasks.length : null,
        inProgressLen: typeof inProgressTasks !== 'undefined' ? inProgressTasks.length : null,
        reviewLen: typeof reviewTasks !== 'undefined' ? reviewTasks.length : null,
        doneLen: typeof doneTasks !== 'undefined' ? doneTasks.length : null
      };
    });
  }
  async getRemainingStoryPoints() {
    return await this.page.evaluate(() => typeof remainingStoryPoints !== 'undefined' ? remainingStoryPoints : null);
  }
  async clearCapturedDialogs() {
    this.dialogs.length = 0;
  }
}

test.describe('Agile Methodology Demo - FSM verification', () => {
  // Provide a fresh page object for each test and attach listeners
  test.beforeEach(async ({ page }) => {
    // nothing here, each test will create its AgilePage and call goto()
  });

  // Test 1: Verify initial state (S0_Idle) and page loads correctly with no runtime errors
  test('Initial Idle state renders header, lists and exposes sprintActive=false (S0_Idle)', async ({ page }) => {
    const app = new AgilePage(page);
    await app.attachListeners();
    await app.goto();

    // Comments: Validate that the initial "Idle" evidence is present: the heading
    const heading = page.locator('h1');
    await expect(heading).toHaveText('Agile Methodology Demonstration');

    // Validate that the lists were rendered with Agile principles, events and roles
    const principlesCount = await page.locator('#principlesList li').count();
    const scrumEventsCount = await page.locator('#scrumEventsList li').count();
    const rolesCount = await page.locator('#rolesList li').count();

    expect(principlesCount).toBeGreaterThanOrEqual(10); // should match the provided principles list
    expect(scrumEventsCount).toBeGreaterThanOrEqual(3);
    expect(rolesCount).toBeGreaterThanOrEqual(1);

    // Ensure initial runtime state variable exists and indicates not active sprint
    const sprintActive = await app.getSprintActive();
    expect(sprintActive).toBe(false);

    // No unexpected page errors or console errors on load
    expect(app.consoleErrors).toEqual([]);
    expect(app.pageErrors).toEqual([]);
  });

  // Test 2: Edge case - starting sprint with no tasks should be blocked (alert shown)
  test('Start Sprint should be blocked when there are no tasks in the sprint (edge case)', async ({ page }) => {
    const app1 = new AgilePage(page);
    await app.attachListeners();
    await app.goto();

    // Ensure there are no tasks in the todo column initially
    const countsBefore = await app.getCounts();
    expect(countsBefore.todo).toBe(0);

    // Click Start Sprint - should show an alert asking to add tasks
    await app.clickStartSprint();

    // Wait briefly to ensure dialog handler captured the alert
    await page.waitForTimeout(100);

    // Validate that an alert was shown with the expected message substring
    expect(app.dialogs.length).toBeGreaterThanOrEqual(1);
    const found = app.dialogs.some(msg => msg.includes('Please add tasks to the sprint'));
    expect(found).toBe(true);

    // Sprint should remain inactive
    expect(await app.getSprintActive()).toBe(false);
  });

  // Test 3: Full sprint lifecycle, covering StartSprint -> MoveTask -> DailyScrum -> CompleteTask -> EndSprint
  test('Full Sprint lifecycle: move tasks, start sprint, progress tasks, complete task, and end sprint', async ({ page }) => {
    const app2 = new AgilePage(page);
    await app.attachListeners();
    await app.goto();

    // Ensure initial backlog has tasks
    const countsInitial = await app.getCounts();
    expect(countsInitial.backlog).toBeGreaterThanOrEqual(1);

    // Move one backlog task into the sprint (to To Do column)
    await app.clickFirstBacklogTask();
    await page.waitForTimeout(100); // small wait for DOM updates
    const countsAfterMove = await app.getCounts();
    expect(countsAfterMove.todo).toBe(1);
    expect(countsAfterMove.backlog).toBeLessThan(countsInitial.backlog);

    // Start the sprint now that there is at least one todo task
    await app.clearCapturedDialogs();
    await app.clickStartSprint();

    // A dialog should have been shown indicating sprint started
    await page.waitForTimeout(100);
    expect(app.dialogs.length).toBeGreaterThanOrEqual(1);
    const startedMsg = app.dialogs.find(msg => msg.includes('Sprint started!') || msg.includes('Sprint started'));
    expect(startedMsg).toBeTruthy();

    // SprintActive state should be true (S1_SprintActive)
    expect(await app.getSprintActive()).toBe(true);

    // Start button should be disabled after starting sprint
    await expect(app.startSprintBtn()).toBeDisabled();

    // Move the task from To Do -> In Progress by clicking it (MoveTask event during active sprint)
    await app.clickTodoTask();
    await page.waitForTimeout(100);
    const countsAfterTodoToInProg = await app.getCounts();
    expect(countsAfterTodoToInProg.todo).toBe(0);
    expect(countsAfterTodoToInProg.inProgress).toBe(1);

    // Move the task from In Progress -> Review by clicking it again
    await app.clickInProgressTask();
    await page.waitForTimeout(100);
    const countsAfterInProgToReview = await app.getCounts();
    expect(countsAfterInProgToReview.inProgress).toBe(0);
    expect(countsAfterInProgToReview.review).toBe(1);

    // Now complete a random task (there is exactly one in review) - CompleteTask event
    await app.clearCapturedDialogs();
    await app.clickCompleteTask();
    await page.waitForTimeout(100);
    // Should have received an alert "Task completed: <title>"
    const completeMsg = app.dialogs.find(msg => msg.includes('Task completed:'));
    expect(completeMsg).toBeTruthy();

    // After completion, the review should drop and done should increase
    const countsAfterComplete = await app.getCounts();
    expect(countsAfterComplete.review).toBe(0);
    expect(countsAfterComplete.done).toBeGreaterThanOrEqual(1);

    // Perform a Daily Scrum - this will decrement sprintDaysRemaining and may move tasks
    const daysBefore = await app.getSprintDaysRemaining();
    await app.clearCapturedDialogs();
    await app.clickDailyScrum();
    await page.waitForTimeout(100);
    // The daily scrum should have produced a dialog unless sprint ended
    const dailyMsg = app.dialogs.find(msg => msg.includes('Daily scrum completed!'));
    // dailyMsg may sometimes not appear if randomness triggers endSprint; accept either behavior but validate state change
    const daysAfter = await app.getSprintDaysRemaining();
    // daysAfter should be less than or equal to daysBefore (if defined)
    if (typeof daysBefore === 'number' && typeof daysAfter === 'number') {
      expect(daysAfter).toBeLessThanOrEqual(daysBefore);
    }

    // End the sprint (EndSprint) - this should set sprintActive = false and show summary alert
    await app.clearCapturedDialogs();
    await app.clickEndSprint();
    await page.waitForTimeout(200);
    const endMsg = app.dialogs.find(msg => msg.includes('Sprint ended!') || msg.includes('Sprint ended'));
    expect(endMsg).toBeTruthy();

    // Sprint should now be inactive (S2_SprintInactive)
    expect(await app.getSprintActive()).toBe(false);

    // After ending sprint, Start button should be enabled again
    await expect(app.startSprintBtn()).toBeEnabled();
  });

  // Test 4: Edge case validations for event handlers when preconditions aren't met
  test('Edge cases: DailyScrum and CompleteTask should be no-ops when sprint inactive or no review tasks', async ({ page }) => {
    const app3 = new AgilePage(page);
    await app.attachListeners();
    await app.goto();

    // Ensure sprint is inactive
    expect(await app.getSprintActive()).toBe(false);

    // Attempt Daily Scrum when sprint inactive - nothing should happen (no dialog)
    await app.clearCapturedDialogs();
    await app.clickDailyScrum();
    await page.waitForTimeout(100);
    // No 'Daily scrum completed!' dialog should be present
    const dailyShown = app.dialogs.some(msg => msg.includes('Daily scrum completed!'));
    expect(dailyShown).toBe(false);

    // Attempt to Complete Task when there are no review tasks (should be no dialog)
    await app.clearCapturedDialogs();
    await app.clickCompleteTask();
    await page.waitForTimeout(100);
    const completeShown = app.dialogs.some(msg => msg.includes('Task completed:'));
    expect(completeShown).toBe(false);
  });

  // Test 5: Validate there are no uncaught runtime errors during normal interactions
  test('No uncaught console errors or page errors observed during interactions', async ({ page }) => {
    const app4 = new AgilePage(page);
    await app.attachListeners();
    await app.goto();

    // Perform a set of interactions to exercise the code paths
    // Move a backlog task to todo and start/end a sprint if possible
    const backlogCount = await page.locator('#backlogItems .task').count();
    if (backlogCount > 0) {
      await app.clickFirstBacklogTask();
      await page.waitForTimeout(50);
      await app.clickStartSprint();
      // accept any dialogs already handled by listener
      await page.waitForTimeout(200);
      // Attempt to end sprint to go back to idle
      await app.clickEndSprint();
      await page.waitForTimeout(200);
    }

    // Assert that no console.error messages were emitted
    expect(app.consoleErrors).toEqual([]);

    // Assert that no page 'pageerror' events were emitted
    expect(app.pageErrors).toEqual([]);
  });
});