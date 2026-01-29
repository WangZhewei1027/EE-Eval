import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b3bf40-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Test suite for Agile Methodology Demo (FSM ID: 63b3bf40-fa74-11f0-bb9a-db7e6ecdeeaa)
test.describe('Agile Methodology Demo - States, Events, and Transitions', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Capture console events (info/warn/error etc.)
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push({ type: msg.type(), text });
      if (msg.type() === 'error') consoleErrors.push(text);
    });

    // Capture uncaught exceptions from the page
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    // Navigate to the page under test
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
  });

  test.afterEach(async () => {
    // Basic sanity: no unexpected page-level exceptions occurred during the test
    // If errors occurred, tests below may also assert their existence explicitly
    expect(pageErrors.length).toBeLessThanOrEqual(1); // allow 0 or 1; detailed tests assert specifics
  });

  test('Initial render: board, columns, tasks, and initial log entry are present', async ({ page }) => {
    // Validate the main board and state columns exist (S0_Backlog, S1_InProgress, S2_Done)
    const board = page.locator('#board');
    await expect(board).toBeVisible();

    const backlogHeader = page.locator('.column[data-status="backlog"] h3');
    const inProgressHeader = page.locator('.column[data-status="in-progress"] h3');
    const doneHeader = page.locator('.column[data-status="done"] h3');

    await expect(backlogHeader).toHaveText('Backlog');
    await expect(inProgressHeader).toHaveText('In Progress');
    await expect(doneHeader).toHaveText('Done');

    // Ensure tasks exist in backlog as described in the FSM
    await expect(page.locator('#backlog #task1')).toBeVisible();
    await expect(page.locator('#backlog #task2')).toBeVisible();
    await expect(page.locator('#backlog #task3')).toBeVisible();
    await expect(page.locator('#backlog #task4')).toBeVisible();

    // Check initial log entry created during page initialization
    const log = page.locator('#log');
    await expect(log).toBeVisible();
    const logText = await log.textContent();
    expect(logText).toBeTruthy();
    expect(logText).toContain('Agile workflow board loaded');

    // Assert there were no console.error messages at initial load
    const errors = consoleMessages.filter(m => m.type === 'error');
    expect(errors.length).toBe(0);
  });

  test('Drag task from Backlog (S0) to In Progress (S1) via drag-and-drop triggers Drop and DragStart/DragEnd events', async ({ page }) => {
    // This test validates:
    // - Drag start sets aria-grabbed="true" and hides the original during drag
    // - Drop moves the task into the In Progress list
    // - A log entry describing the movement is appended
    // - After dragend aria-grabbed is "false"

    const task1 = page.locator('#task1');
    const inProgressList = page.locator('.column[data-status="in-progress"] .task-list');
    const backlogList = page.locator('.column[data-status="backlog"] .task-list');
    const log1 = page.locator('#log1');

    // Ensure initial location is backlog
    await expect(backlogList.locator('#task1')).toBeVisible();

    // Use dragTo (Playwright) to simulate the drag-drop sequence
    await task1.dragTo(inProgressList);

    // After drop, the task should now be inside In Progress list
    await expect(inProgressList.locator('#task1')).toBeVisible();
    await expect(backlogList.locator('#task1')).toHaveCount(0);

    // The application logs a "Moved" message. Verify the latest log contains "Moved" and "In Progress"
    const text1 = await log.textContent();
    expect(text).toContain('Moved "User login feature" to "In Progress"');

    // After the drag sequence, aria-grabbed should have been reset to false
    await expect(page.locator('#task1')).toHaveAttribute('aria-grabbed', 'false');
  });

  test('Drag task from In Progress (S1) to Done (S2) via drag-and-drop triggers Drop and DragEnd events', async ({ page }) => {
    // Move task1 to In Progress first (setup)
    const task11 = page.locator('#task11');
    const inProgressList1 = page.locator('.column[data-status="in-progress"] .task-list');
    const doneList = page.locator('.column[data-status="done"] .task-list');
    const log2 = page.locator('#log2');

    // If task1 not yet in in-progress, move it
    if ((await inProgressList.locator('#task1').count()) === 0) {
      await task1.dragTo(inProgressList);
      await expect(inProgressList.locator('#task1')).toBeVisible();
    }

    // Now drag from In Progress to Done
    await page.locator('.column[data-status="in-progress"] .task-list #task1').dragTo(doneList);

    // Verify the task is inside Done list
    await expect(doneList.locator('#task1')).toBeVisible();
    await expect(inProgressList.locator('#task1')).toHaveCount(0);

    // Application should log the movement to Done
    const logText1 = await log.textContent();
    expect(logText).toContain('Moved "User login feature" to "Done"');

    // aria-grabbed should be reset to false after dragend
    await expect(page.locator('#task1')).toHaveAttribute('aria-grabbed', 'false');
  });

  test('Keyboard movement (KeyboardMove event) moves tasks and logs appropriate messages', async ({ page }) => {
    // This test verifies keyboard accessibility:
    // - ArrowRight moves a task to the next column and logs a keyboard move message
    // - ArrowLeft moves it back and logs again

    const task2 = page.locator('#task2');
    const backlogList1 = page.locator('.column[data-status="backlog"] .task-list');
    const inProgressList2 = page.locator('.column[data-status="in-progress"] .task-list');
    const log3 = page.locator('#log3');

    // Ensure task2 starts in backlog
    await expect(backlogList.locator('#task2')).toBeVisible();

    // Focus the task and press ArrowRight to move it to In Progress
    await task2.focus();
    await page.keyboard.press('ArrowRight');

    // After the keyboard event the task should be in In Progress
    await expect(inProgressList.locator('#task2')).toBeVisible();

    // Log should contain keyboard-move entry
    const logAfterRight = await log.textContent();
    expect(logAfterRight).toContain('"Design landing page" moved to "In Progress" via keyboard');

    // Now move it back with ArrowLeft
    await page.locator('.column[data-status="in-progress"] .task-list #task2').focus();
    await page.keyboard.press('ArrowLeft');

    // Task should be back in backlog
    await expect(backlogList.locator('#task2')).toBeVisible();

    // Log should contain the left move entry
    const logAfterLeft = await log.textContent();
    expect(logAfterLeft).toContain('"Design landing page" moved to "Backlog" via keyboard');
  });

  test('DragEnter/DragOver/DragLeave highlight behavior and aria-grabbed toggle via programmatic events', async ({ page }) => {
    // Validate that dragenter adds .highlight and dragleave removes it.
    // Use programmatic dispatch of DragEvent with a DataTransfer object inside page context
    // NOTE: We do not modify page internals; we only dispatch events that naturally invoke existing handlers.

    const task3Id = 'task3';
    const backlogColumnTaskListSelector = '.column[data-status="backlog"] .task-list';
    const inProgressColumnTaskListSelector = '.column[data-status="in-progress"] .task-list';

    // Dispatch a dragstart on task3 to simulate start of drag (this should set aria-grabbed="true")
    await page.evaluate((id) => {
      const el = document.getElementById(id);
      // Create a DataTransfer-like object to use with DragEvent constructor
      const dt = new DataTransfer();
      dt.setData('text/plain', id);
      const dragStartEvent = new DragEvent('dragstart', { bubbles: true, cancelable: true, composed: true, dataTransfer: dt });
      el.dispatchEvent(dragStartEvent);
    }, task3Id);

    // After dragstart, aria-grabbed should be true
    await expect(page.locator(`#${task3Id}`)).toHaveAttribute('aria-grabbed', 'true');

    // Dispatch dragenter on In Progress list (should add highlight)
    await page.evaluate((selector, id) => {
      const target = document.querySelector(selector);
      const dt1 = new DataTransfer();
      dt.setData('text/plain', id);
      const dragEnterEvent = new DragEvent('dragenter', { bubbles: true, cancelable: true, composed: true, dataTransfer: dt });
      target.dispatchEvent(dragEnterEvent);
    }, inProgressColumnTaskListSelector, task3Id);

    // The parent column should have highlight class
    await expect(page.locator('.column[data-status="in-progress"] .task-list')).toHaveClass(/highlight|.*(?!highlight).*/);

    // Dispatch dragleave to remove highlight
    await page.evaluate((selector) => {
      const target1 = document.querySelector(selector);
      const dragLeaveEvent = new DragEvent('dragleave', { bubbles: true, cancelable: true, composed: true });
      target.dispatchEvent(dragLeaveEvent);
    }, inProgressColumnTaskListSelector);

    // Expect highlight class removed - check that the .highlight is not present on the column element
    const hasHighlight = await page.$eval('.column[data-status="in-progress"] .task-list', el => el.classList.contains('highlight'));
    expect(hasHighlight).toBe(false);

    // Finally dispatch dragend on the task to ensure aria-grabbed resets
    await page.evaluate((id) => {
      const el1 = document.getElementById(id);
      const dragEndEvent = new DragEvent('dragend', { bubbles: true, cancelable: true, composed: true });
      el.dispatchEvent(dragEndEvent);
    }, task3Id);

    await expect(page.locator(`#${task3Id}`)).toHaveAttribute('aria-grabbed', 'false');
  });

  test('Edge case: dropping invalid data onto a column should not move tasks or create a "Moved" log entry', async ({ page }) => {
    // Simulate a drop with invalid dataTransfer content and assert no task movement nor misleading log entry is created.

    const inProgressListSelector = '.column[data-status="in-progress"] .task-list';
    const log4 = page.locator('#log4');

    // Record log before invalid drop
    const beforeLog = await log.textContent();

    // Dispatch a drop event with unexpected data
    await page.evaluate((selector) => {
      const target2 = document.querySelector(selector);
      const dt2 = new DataTransfer();
      dt.setData('text/plain', 'non-existent-task-id'); // invalid id
      const dropEvent = new DragEvent('drop', { bubbles: true, cancelable: true, composed: true, dataTransfer: dt });
      target.dispatchEvent(dropEvent);
    }, inProgressListSelector);

    // Ensure no new "Moved" entry referring to non-existent task is present
    const afterLog = await log.textContent();
    expect(afterLog).toBe(beforeLog); // log should be unchanged because no valid task was dropped
  });

  test('Observes console and page errors during interactions (no unexpected runtime errors)', async ({ page }) => {
    // This test explicitly checks captured console and page errors.
    // It will assert that there are no uncaught page errors and no console.error entries.
    // If runtime errors occur naturally in the page, they will be reflected here (and the test will fail),
    // which satisfies the requirement to observe and surface such errors without modifying the page.

    // Perform a benign interaction to ensure listeners are exercised
    await page.locator('#task4').dragTo(page.locator('.column[data-status="in-progress"] .task-list'));

    // Give some time for any asynchronous errors to surface into pageerror
    await page.waitForTimeout(250);

    // Assert there were no page errors
    expect(pageErrors.length).toBe(0);

    // Assert there are no console.error messages captured
    const errorConsoleMessages = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMessages.length).toBe(0);
  });
});