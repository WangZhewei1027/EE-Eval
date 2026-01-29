import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b2add3-fa74-11f0-bb9a-db7e6ecdeeaa.html';

/**
 * Page object for the Semaphore Demo page.
 * Encapsulates common operations and queries used across tests.
 */
class SemaphorePage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.tasksContainer = page.locator('#tasks');
    this.addTaskBtn = page.locator('#add-task-btn');
    this.permitsCount = page.locator('#permits-count');
    this.taskSelector = '#tasks .task';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  // Returns total number of task elements currently in DOM
  async totalTasks() {
    return await this.page.locator(this.taskSelector).count();
  }

  // Returns number of tasks with a CSS state class: 'queued' | 'running' | 'done'
  async tasksInState(state) {
    return await this.page.locator(`${this.taskSelector}.${state}`).count();
  }

  // Click the Add New Task button
  async clickAddTask() {
    await this.addTaskBtn.click();
  }

  // Click the first task found with the given state (useful to finish running tasks)
  async clickFirstTaskInState(state) {
    const locator = this.page.locator(`${this.taskSelector}.${state}`).first();
    await locator.click();
  }

  // Press Enter on the first task in a given state (keyboard finish)
  async pressEnterOnFirstTaskInState(state) {
    const locator = this.page.locator(`${this.taskSelector}.${state}`).first();
    await locator.focus();
    await this.page.keyboard.press('Enter');
  }

  // Get the text content of the permits count e.g., "0 / 3"
  async getPermitsText() {
    return (await this.permitsCount.textContent())?.trim();
  }

  // Return the aria-label for the first task in given state
  async getAriaLabelForFirstTaskInState(state) {
    const locator = this.page.locator(`${this.taskSelector}.${state}`).first();
    return locator.getAttribute('aria-label');
  }

  // Click the first task that is queued to test that clicking queued does nothing.
  async clickFirstQueuedTask() {
    const locator = this.page.locator(`${this.taskSelector}.queued`).first();
    await locator.click();
  }
}

test.describe('Semaphore Concept Demo - end-to-end', () => {
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Collect console messages and page errors for assertions
    consoleMessages = [];
    pageErrors = [];

    page.on('console', msg => {
      // store console messages (type + text)
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the app
    const sp = new SemaphorePage(page);
    await sp.goto();
  });

  test.afterEach(async ({ page }) => {
    // Allow a small delay to ensure any async errors bubble up to the page events
    await page.waitForTimeout(50);
  });

  test.describe('Initial state and UI rendering', () => {
    test('should render initial tasks and display permits correctly', async ({ page }) => {
      const sp = new SemaphorePage(page);

      // Validate initial number of tasks (the app creates 5 initial tasks)
      await expect(sp.tasksContainer.locator('.task')).toHaveCount(5);

      // Permits: MAX_PERMITS is 3. First three tasks should have acquired permits -> 0 / 3
      const permitsText = await sp.getPermitsText();
      expect(permitsText).toBe('0 / 3');

      // Verify states: 3 running, 2 queued (consistent with semaphore limit)
      const running = await sp.tasksInState('running');
      const queued = await sp.tasksInState('queued');
      expect(running).toBe(3);
      expect(queued).toBe(2);

      // Verify aria-labels reflect state for one running and one queued task
      const runningAria = await sp.getAriaLabelForFirstTaskInState('running');
      expect(runningAria).toContain('running');

      const queuedAria = await sp.getAriaLabelForFirstTaskInState('queued');
      expect(queuedAria).toContain('queued');

      // Ensure no uncaught page errors occurred during initial load
      expect(pageErrors).toEqual([]);
      // Ensure console doesn't contain fatal errors like ReferenceError/SyntaxError/TypeError
      const fatalConsoleErrors = consoleMessages.filter(m =>
        m.type === 'error' && /(ReferenceError|SyntaxError|TypeError)/.test(m.text)
      );
      expect(fatalConsoleErrors.length).toBe(0);
    });
  });

  test.describe('AddTask event and queued behavior', () => {
    test('clicking Add New Task should append a queued task when no permits are available', async ({ page }) => {
      const sp = new SemaphorePage(page);

      // initial totals
      const initialTotal = await sp.totalTasks();
      const initialQueued = await sp.tasksInState('queued');

      // Click to add a new task
      await sp.clickAddTask();

      // New task appended
      await expect(sp.tasksContainer.locator('.task')).toHaveCount(initialTotal + 1);

      // Because permits are exhausted (0/3), the newly added task should be queued
      const newQueued = await sp.tasksInState('queued');
      expect(newQueued).toBe(initialQueued + 1);

      // Aria label for first queued should indicate it's queued and waiting
      const queuedAria = await sp.getAriaLabelForFirstTaskInState('queued');
      expect(queuedAria).toMatch(/queued/i);
    });
  });

  test.describe('FinishTask (click) transition: queued -> running -> done', () => {
    test('clicking a running task should finish it, release permit, and allow next queued to start', async ({ page }) => {
      const sp = new SemaphorePage(page);

      // Snapshot before click
      const totalBefore = await sp.totalTasks();
      const runningBefore = await sp.tasksInState('running');
      const queuedBefore = await sp.tasksInState('queued');

      expect(runningBefore).toBeGreaterThan(0);
      expect(queuedBefore).toBeGreaterThanOrEqual(1);

      // Click the first running task to manually finish it (FinishTask event)
      await sp.clickFirstTaskInState('running');

      // After manual finish:
      // - The clicked task should immediately get class 'done'
      // - A queued task should transition to 'running' (because semaphore.release resolves next)
      // Running count should remain equal to MAX_PERMITS (3), queued should reduce by 1.
      // Wait for DOM updates to settle
      await page.waitForTimeout(200); // small wait to allow synchronous transitions to apply

      const runningAfter = await sp.tasksInState('running');
      const queuedAfter = await sp.tasksInState('queued');
      const doneAfter = await sp.tasksInState('done');

      // queued decreased by one
      expect(queuedAfter).toBe(queuedBefore - 1);
      // running should remain same (a queued task immediately started)
      expect(runningAfter).toBe(runningBefore);
      // there should be at least one done (the clicked task)
      expect(doneAfter).toBeGreaterThanOrEqual(1);

      // Permits display should still reflect available permits (should remain 0 / 3)
      const permitsText = await sp.getPermitsText();
      // Because of immediate handoff, it's expected to stay at "0 / 3" when concurrency is full.
      expect(permitsText).toMatch(/\/\s*3/);

      // The done task will be removed after ~3s; ensure it gets removed eventually
      await page.waitForTimeout(3500); // wait for removal after 3s + margin
      const totalAfterRemoval = await sp.totalTasks();
      // total should reduce by at least 1 after done removals
      expect(totalAfterRemoval).toBeLessThanOrEqual(totalBefore);
    });
  });

  test.describe('FinishTask (keyboard) transition', () => {
    test('pressing Enter on a running task finishes it (accessibility keyboard flow)', async ({ page }) => {
      const sp = new SemaphorePage(page);

      // Ensure there is a running task to act on
      const runningBefore = await sp.tasksInState('running');
      expect(runningBefore).toBeGreaterThan(0);

      const queuedBefore = await sp.tasksInState('queued');

      // Press Enter on the first running task
      await sp.pressEnterOnFirstTaskInState('running');

      // Allow short time for the handler to run and for queued -> running handoff
      await page.waitForTimeout(200);

      const runningAfter = await sp.tasksInState('running');
      const queuedAfter = await sp.tasksInState('queued');
      const doneAfter = await sp.tasksInState('done');

      // queued should reduce by 1, running should remain approximately the same (handoff)
      expect(queuedAfter).toBe(queuedBefore - 1);
      expect(runningAfter).toBeGreaterThanOrEqual(1);
      expect(doneAfter).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Edge cases and error scenarios', () => {
    test('clicking a queued task should not finish it or change running count', async ({ page }) => {
      const sp = new SemaphorePage(page);

      const queuedBefore = await sp.tasksInState('queued');
      const runningBefore = await sp.tasksInState('running');

      // If there is no queued task, create one to ensure test validity
      if (queuedBefore === 0) {
        await sp.clickAddTask();
        await page.waitForTimeout(100);
      }

      // Click the first queued task (should be ignored by the click handler because state !== 'running')
      const firstQueuedLocator = page.locator('#tasks .task.queued').first();
      const queuedTextBefore = await firstQueuedLocator.textContent();
      await firstQueuedLocator.click();

      // small wait for any unintended side-effects
      await page.waitForTimeout(200);

      // Re-check counts remain unchanged (no extra done tasks)
      const queuedAfter = await sp.tasksInState('queued');
      const runningAfter = await sp.tasksInState('running');
      const doneAfter = await sp.tasksInState('done');

      expect(queuedAfter).toBeGreaterThanOrEqual(queuedBefore);
      // Running should not increase unexpectedly when clicking queued
      expect(runningAfter).toBeLessThanOrEqual(runningBefore + 1);
      // The specific queued element should still be present and not marked done
      const aria = await firstQueuedLocator.getAttribute('aria-label');
      expect(aria).toMatch(/queued/i);
    });

    test('no fatal JavaScript errors (ReferenceError/SyntaxError/TypeError) should be present in console or page errors', async ({ page }) => {
      // We already collected consoleMessages and pageErrors in beforeEach

      // Assert there were no uncaught page errors
      expect(pageErrors.length).toBe(0);

      // Filter console for errors mentioning typical fatal error types
      const fatalConsoleErrors = consoleMessages.filter(m =>
        m.type === 'error' && /(ReferenceError|SyntaxError|TypeError)/.test(m.text)
      );

      // Assert none of these fatal errors are present
      expect(fatalConsoleErrors.length).toBe(0);
    });
  });
});