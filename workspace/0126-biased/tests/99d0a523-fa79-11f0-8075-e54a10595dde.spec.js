import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d0a523-fa79-11f0-8075-e54a10595dde.html';

// Page Object encapsulating interactions with the Agile Methodology Interactive Demo
class AgilePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Selectors used across tests
    this.selectors = {
      title: 'h1',
      userStoryInput: 'input#userStory',
      addUserStoryButton: 'button[onclick="addUserStory()"]',
      userStoryList: 'ul#userStoryList',
      sprintInput: 'input#sprintLength',
      setSprintButton: 'button[onclick="setSprint()"]',
      sprintInfo: 'p#sprintInfo',
      taskInput: 'input#taskDescription',
      addTaskButton: 'button[onclick="addTask()"]',
      taskList: 'ul#taskList',
      taskSelect: 'select#taskSelect',
      markAsDoneButton: 'button[onclick="markAsDone()"]',
      completedTaskList: 'ul#completedTaskList',
      feedbackInput: 'input#feedbackInput',
      feedbackButton: 'button[onclick="addFeedback()"]',
      feedbackList: 'ul#feedbackList'
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait for the main title to ensure the page has rendered
    await this.page.waitForSelector(this.selectors.title);
  }

  // User Story helpers
  async addUserStory(text) {
    await this.page.fill(this.selectors.userStoryInput, text);
    await this.page.click(this.selectors.addUserStoryButton);
  }

  async getUserStories() {
    return this.page.$$eval(`${this.selectors.userStoryList} li`, nodes => nodes.map(n => n.innerText));
  }

  async getUserStoryInputValue() {
    return this.page.$eval(this.selectors.userStoryInput, el => el.value);
  }

  // Sprint helpers
  async setSprint(length) {
    await this.page.fill(this.selectors.sprintInput, String(length));
    await this.page.click(this.selectors.setSprintButton);
  }

  async getSprintInfoText() {
    return this.page.$eval(this.selectors.sprintInfo, el => el.innerText);
  }

  async getSprintInputValue() {
    return this.page.$eval(this.selectors.sprintInput, el => el.value);
  }

  // Task helpers
  async addTask(text) {
    await this.page.fill(this.selectors.taskInput, text);
    await this.page.click(this.selectors.addTaskButton);
  }

  async getTasks() {
    return this.page.$$eval(`${this.selectors.taskList} li`, nodes => nodes.map(n => n.innerText));
  }

  async getTaskSelectOptions() {
    return this.page.$$eval(`${this.selectors.taskSelect} option`, opts => opts.map(o => ({ value: o.value, text: o.innerText })));
  }

  async selectTaskByValue(value) {
    await this.page.selectOption(this.selectors.taskSelect, value);
  }

  async markAsDone() {
    await this.page.click(this.selectors.markAsDoneButton);
  }

  async getCompletedTasks() {
    return this.page.$$eval(`${this.selectors.completedTaskList} li`, nodes => nodes.map(n => n.innerText));
  }

  async getTaskInputValue() {
    return this.page.$eval(this.selectors.taskInput, el => el.value);
  }

  // Feedback helpers
  async addFeedback(text) {
    await this.page.fill(this.selectors.feedbackInput, text);
    await this.page.click(this.selectors.feedbackButton);
  }

  async getFeedbacks() {
    return this.page.$$eval(`${this.selectors.feedbackList} li`, nodes => nodes.map(n => n.innerText));
  }

  async getFeedbackInputValue() {
    return this.page.$eval(this.selectors.feedbackInput, el => el.value);
  }
}

test.describe('Agile Methodology Interactive Demo - FSM validation (Application ID: 99d0a523-fa79-11f0-8075-e54a10595dde)', () => {
  let pageErrors = [];
  let consoleErrors = [];
  let consoleHandler;
  let pageErrorHandler;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleErrors = [];

    // Capture console 'error' messages
    consoleHandler = msg => {
      try {
        if (msg.type() === 'error') {
          consoleErrors.push({ text: msg.text(), location: msg.location() });
        }
      } catch (e) {
        // swallow unexpected exceptions in the handler
      }
    };
    page.on('console', consoleHandler);

    // Capture uncaught page errors
    pageErrorHandler = exception => {
      pageErrors.push(exception);
    };
    page.on('pageerror', pageErrorHandler);

    // Navigate to the application
    const agile = new AgilePage(page);
    await agile.goto();
  });

  test.afterEach(async ({ page }) => {
    // Remove listeners to avoid leakage between tests
    if (consoleHandler) page.off('console', consoleHandler);
    if (pageErrorHandler) page.off('pageerror', pageErrorHandler);
  });

  test('Initial render - S0_Idle entry action (renderPage) validation', async ({ page }) => {
    // Verify the page rendered expected static content as evidence of renderPage()
    const agile = new AgilePage(page);

    // Title should exist and be correct
    const titleText = await page.textContent('h1');
    expect(titleText).toBe('Agile Methodology Interactive Demo');

    // The user story, task, and feedback lists should initially be empty
    const userStories = await agile.getUserStories();
    expect(userStories).toEqual([]);

    const tasks = await agile.getTasks();
    expect(tasks).toEqual([]);

    const completedTasks = await agile.getCompletedTasks();
    expect(completedTasks).toEqual([]);

    const feedbacks = await agile.getFeedbacks();
    expect(feedbacks).toEqual([]);

    // sprintInfo should be empty initially
    const sprintInfo = await agile.getSprintInfoText();
    expect(sprintInfo).toBe('');

    // Ensure no console errors or uncaught exceptions occurred during initial render
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });

  test.describe('User Story flow - S1_UserStoryAdded and edge cases', () => {
    test('Add a user story transitions to S1_UserStoryAdded and updates DOM', async ({ page }) => {
      const agile = new AgilePage(page);

      // Add a valid user story
      await agile.addUserStory('As a user, I want to login');

      // Verify the input was cleared (evidence: userStoryInput.value = '')
      const inputVal = await agile.getUserStoryInputValue();
      expect(inputVal).toBe('');

      // Verify the user story appears in the list (evidence: updateUserStoryList)
      const stories = await agile.getUserStories();
      expect(stories).toContain('As a user, I want to login');

      // No runtime errors during this flow
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Edge case: adding an empty user story does nothing', async ({ page }) => {
      const agile = new AgilePage(page);

      const before = await agile.getUserStories();
      // Attempt to add empty story
      await agile.addUserStory('');
      const after = await agile.getUserStories();
      expect(after).toEqual(before); // no change expected

      // No runtime errors should be introduced by this edge case
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Sprint planning - S2_SprintSet and validation', () => {
    test('Set sprint length updates sprintInfo (evidence: sprintLength and sprintInfo text)', async ({ page }) => {
      const agile = new AgilePage(page);

      // Set sprint to 5 days
      await agile.setSprint(5);

      // Verify input value changed
      const sprintInputVal = await agile.getSprintInputValue();
      // Note: input.value will be string '5'
      expect(sprintInputVal).toBe('5');

      // Verify sprintInfo displays the correct message
      const info = await agile.getSprintInfoText();
      expect(info).toBe('Sprint set for 5 days.');

      // No runtime errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Edge case: set sprint with minimum allowed value (1) works', async ({ page }) => {
      const agile = new AgilePage(page);
      await agile.setSprint(1);
      const info = await agile.getSprintInfoText();
      expect(info).toBe('Sprint set for 1 days.');
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Task breakdown and completion - S3_TaskAdded and S4_TaskMarkedDone', () => {
    test('Add a task updates task list and select (evidence: tasks.push and updateTaskSelect)', async ({ page }) => {
      const agile = new AgilePage(page);

      await agile.addTask('Implement login endpoint');

      // Task input should be cleared
      const taskInputVal = await agile.getTaskInputValue();
      expect(taskInputVal).toBe('');

      // Task list should contain the new task
      const tasks = await agile.getTasks();
      expect(tasks).toContain('Implement login endpoint');

      // Task select should include an option for the task (more than just the placeholder)
      const options = await agile.getTaskSelectOptions();
      // first option is the placeholder; so expect at least 2 options now
      expect(options.length).toBeGreaterThanOrEqual(2);
      // check that one option's text matches the task
      const optionTexts = options.map(o => o.text);
      expect(optionTexts).toContain('Implement login endpoint');

      // No runtime errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Mark a task as done moves it to completed tasks (evidence: completedTasks.push and tasks.splice)', async ({ page }) {
      const agile = new AgilePage(page);

      // Ensure tasks list starts empty
      const initialTasks = await agile.getTasks();
      // Add a task to be marked done
      await agile.addTask('Write unit tests');

      // Select the recently added task. Option values are indices as strings ('0', '1', ...)
      // After adding a single task, its option value should be '0'
      await agile.selectTaskByValue('0');
      await agile.markAsDone();

      // The completed tasks list should contain the moved task
      const completed = await agile.getCompletedTasks();
      expect(completed).toContain('Write unit tests');

      // The task list and select should no longer contain that task
      const tasksAfter = await agile.getTasks();
      expect(tasksAfter).not.toContain('Write unit tests');

      const optionsAfter = await agile.getTaskSelectOptions();
      // After removing the only task, taskSelect should likely be back to only the placeholder
      const optionTextsAfter = optionsAfter.map(o => o.text);
      expect(optionTextsAfter).not.toContain('Write unit tests');

      // No runtime errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Edge case: marking as done when placeholder is selected does nothing', async ({ page }) => {
      const agile = new AgilePage(page);

      // Add a task and then set the select back to placeholder to simulate user error
      await agile.addTask('Refactor codebase');
      // The placeholder has text 'Select a task' and no explicit value; selecting it may result in value 'Select a task'
      await agile.selectTaskByValue('Select a task');
      await agile.markAsDone();

      // Since the placeholder was selected, no task should have moved to completed tasks
      const completed = await agile.getCompletedTasks();
      // It might contain tasks from previous tests but ensure that 'Refactor codebase' is not in completed
      expect(completed).not.toContain('Refactor codebase');

      // The task should still be in tasks list
      const tasks = await agile.getTasks();
      expect(tasks).toContain('Refactor codebase');

      // No runtime errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Edge case: adding an empty task does not modify lists', async ({ page }) => {
      const agile = new AgilePage(page);

      const before = await agile.getTasks();
      await agile.addTask('');
      const after = await agile.getTasks();
      expect(after).toEqual(before);

      // No runtime errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Feedback loop - S5_FeedbackSubmitted and edge cases', () => {
    test('Submitting feedback appends an li to feedbackList (evidence: createElement/li and appendChild)', async ({ page }) => {
      const agile = new AgilePage(page);

      await agile.addFeedback('Great sprint review today');

      // Feedback input should be cleared
      const feedbackInputVal = await agile.getFeedbackInputValue();
      expect(feedbackInputVal).toBe('');

      // Feedback list should contain the submitted feedback
      const feedbacks = await agile.getFeedbacks();
      expect(feedbacks).toContain('Great sprint review today');

      // No runtime errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });

    test('Edge case: submitting empty feedback does nothing', async ({ page }) => {
      const agile = new AgilePage(page);

      const before = await agile.getFeedbacks();
      await agile.addFeedback('');
      const after = await agile.getFeedbacks();
      expect(after).toEqual(before);

      // No runtime errors
      expect(consoleErrors).toEqual([]);
      expect(pageErrors).toEqual([]);
    });
  });

  test('Observe console and page errors throughout interactions (recording and assertions)', async ({ page }) => {
    // This test performs a sequence of interactions to observe any console/page errors
    const agile = new AgilePage(page);

    // Sequence of valid interactions covering multiple transitions
    await agile.addUserStory('Story for error observation');
    await agile.setSprint(3);
    await agile.addTask('Task for error observation');
    // Select the task and mark as done
    await agile.selectTaskByValue('0');
    await agile.markAsDone();
    await agile.addFeedback('Feedback for error observation');

    // After performing the interactions, assert there were no console error messages or uncaught exceptions
    // If any ReferenceError/SyntaxError/TypeError occurred naturally, they will be captured in pageErrors or consoleErrors
    expect(consoleErrors).toEqual([]);
    expect(pageErrors).toEqual([]);
  });
});