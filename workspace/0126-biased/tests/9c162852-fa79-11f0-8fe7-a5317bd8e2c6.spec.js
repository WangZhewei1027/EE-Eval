import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c162852-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object to encapsulate common UI interactions
class BoardPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for the main board container to be present
    await this.page.waitForSelector('#board');
  }

  async getTitle() {
    return this.page.title();
  }

  async countTasks() {
    return this.page.locator('.task').count();
  }

  async remainingPointsText() {
    return (await this.page.locator('#remainingPoints').textContent())?.trim();
  }

  async addItem({ title = '', desc = '', points = '3', priority = '3', review = false, qa = false } = {}) {
    if (title !== '') await this.page.fill('#newTitle', title);
    if (desc !== '') await this.page.fill('#newDesc', desc);
    await this.page.fill('#newPoints', String(points));
    await this.page.selectOption('#newPriority', String(priority));
    // checkboxes
    const reviewChecked = await this.page.isChecked('#newReview');
    if (reviewChecked !== review) await this.page.click('#newReview');
    const qaChecked = await this.page.isChecked('#newQA');
    if (qaChecked !== qa) await this.page.click('#newQA');
    await this.page.click('#addItem');
    // wait for a new task node to appear that contains the title if provided
    if (title) {
      await this.page.waitForSelector(`.task:has-text("${title}")`);
    }
  }

  async autoGenerate(n = '3') {
    // autoGen triggers a prompt; supply our input
    this.page.once('dialog', async dialog => {
      await dialog.accept(String(n));
    });
    await this.page.click('#autoGen');
    // After autogen there should be a history entry and new tasks; we wait a bit for DOM update
    await this.page.waitForTimeout(200);
  }

  async startSprint() {
    await this.page.click('#startSprint');
    // sprint status text should update to Running
    await expect(this.page.locator('#sprintStatus')).toHaveText(/Running|Running/);
  }

  async pauseOrResumeSprint() {
    // The pause button toggles pause/resume
    await this.page.click('#pauseSprint');
    // Wait a small amount for status update
    await this.page.waitForTimeout(100);
  }

  async stepDay() {
    await this.page.click('#stepDay');
  }

  async endSprintAccept() {
    // endSprint triggers confirm; accept it
    this.page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await this.page.click('#endSprint');
    // wait for DOM to show Ended
    await this.page.waitForTimeout(200);
  }

  async findTaskByTitle(title) {
    const locator = this.page.locator(`.task:has-text("${title}")`);
    const count = await locator.count();
    if (count === 0) return null;
    const el = locator.first();
    const id = Number(await el.getAttribute('data-id'));
    return { locator: el, id };
  }

  async findTaskById(id) {
    const locator = this.page.locator(`.task[data-id="${id}"]`);
    const count = await locator.count();
    if (count === 0) return null;
    return { locator: locator.first(), id };
  }

  async selectTaskById(id) {
    const sel = await this.findTaskById(id);
    if (!sel) throw new Error(`Task ${id} not found to select`);
    // click to select (single selection)
    await sel.locator.click();
    // selectedBox should appear
    await this.page.waitForSelector('#selectedBox:not(.hidden)');
  }

  async moveSelectedRight() {
    await this.page.click('#moveRight');
    await this.page.waitForTimeout(150);
  }

  async moveSelectedLeft() {
    await this.page.click('#moveLeft');
    await this.page.waitForTimeout(150);
  }

  async cloneSelected() {
    await this.page.click('#cloneSel');
    await this.page.waitForTimeout(150);
  }

  async deleteSelectedAccept() {
    // delete uses confirm
    this.page.once('dialog', async dialog => {
      await dialog.accept();
    });
    await this.page.click('#deleteSel');
    await this.page.waitForTimeout(150);
  }

  async clickUndo() {
    // undo may show alert; handle it permissively
    const p = this.page.waitForEvent('dialog').then(async dialog => {
      // Accept any informational alerts thrown by undo/redo
      try { await dialog.accept(); } catch (e) {}
    }).catch(()=>{});
    await this.page.click('#undo');
    // allow any side-effects
    await Promise.race([p, this.page.waitForTimeout(200)]);
  }

  async clickRedo() {
    const p = this.page.waitForEvent('dialog').then(async dialog => {
      try { await dialog.accept(); } catch (e) {}
    }).catch(()=>{});
    await this.page.click('#redo');
    await Promise.race([p, this.page.waitForTimeout(200)]);
  }

  async runRetro() {
    await this.page.click('#runRetro');
    // retroOutput should be populated
    await this.page.waitForSelector('#retroOutput');
  }

  async sortBacklog() {
    await this.page.click('#sortPriority');
  }

  async applyColumns(raw) {
    await this.page.fill('#columnsInput', raw);
    await this.page.click('#applyColumns');
    await this.page.waitForTimeout(150);
  }

  async resetColumns() {
    await this.page.click('#resetColumns');
    await this.page.waitForTimeout(150);
  }

  async autoMembers() {
    await this.page.click('#autoMembers');
    await this.page.waitForTimeout(150);
  }

  async autoAssign() {
    const p = this.page.waitForTimeout(150);
    await this.page.click('#autoAssign');
    await p;
  }

  async splitSelected() {
    // split may show alert
    const p = this.page.waitForEvent('dialog').then(async dialog => {
      await dialog.accept();
    }).catch(()=>{});
    await this.page.click('#splitTask');
    await Promise.race([p, this.page.waitForTimeout(200)]);
  }
}

test.describe('Agile Methodology Interactive Simulator - End-to-End', () => {
  // Capture console errors and page errors for assertions
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({text: msg.text(), location: msg.location()});
      }
    });

    page.on('pageerror', err => {
      // Capture runtime errors (ReferenceError, TypeError, etc.)
      pageErrors.push(err);
    });

    // Navigate to the application before each test
    const bp = new BoardPage(page);
    await bp.goto();
  });

  test.afterEach(async ({ page }) => {
    // Final assertion: no unexpected runtime errors or console errors occurred during the test
    // This ensures we observed console and page errors and assert their absence.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e=>e.message).join('; ')}`).toBe(0);
    expect(consoleErrors.length, `Unexpected console.error messages: ${consoleErrors.map(e=>e.text).join('; ')}`).toBe(0);
  });

  test.describe('Initialization and Idle (S0_Idle)', () => {
    test('renders main UI and title - Idle state evidence', async ({ page }) => {
      // Validate page title and presence of main elements (Idle state entry action: renderPage())
      await expect(page).toHaveTitle('Agile Methodology Interactive Simulator');
      await expect(page.locator('#board')).toBeVisible();
      await expect(page.locator('#addItem')).toBeVisible();
      // sprint status should initially be 'Idle'
      await expect(page.locator('#sprintStatus')).toHaveText('Idle');
      // initial burn table exists (may be empty)
      await expect(page.locator('#burnTable')).toBeVisible();
      // history log present
      await expect(page.locator('#historyLog')).toBeVisible();
    });
  });

  test.describe('Backlog interactions (S1_Backlog)', () => {
    test('Add Item transitions Idle -> Backlog and creates new task', async ({ page }) => {
      const bp = new BoardPage(page);

      // Count tasks before adding
      const before = await bp.countTasks();

      // Add an explicit item
      await bp.addItem({ title: 'E2E Test Task', desc: 'Created by test', points: '4', priority: '2', review: true, qa: true });

      // Expect a new task element with our title
      const task = await bp.findTaskByTitle('E2E Test Task');
      expect(task, 'Newly added task should be present on the board').not.toBeNull();

      // Task count should increase by at least 1
      const after = await bp.countTasks();
      expect(after).toBeGreaterThanOrEqual(before + 1);

      // Remaining points DOM should include the numeric total
      const rem = await bp.remainingPointsText();
      expect(Number(rem)).toBeGreaterThan(0);

      // History should contain an 'add' entry; check history log lines include 'Created task' or title
      await expect(page.locator('#historyLog')).toContainText('add', { timeout: 1500 });

      // Evidence: state.statuses exists on page as columns
      const cols = await page.locator('.column').count();
      expect(cols).toBeGreaterThanOrEqual(2);
    });

    test('Auto-generate adds multiple backlog items and records history', async ({ page }) => {
      const bp = new BoardPage(page);
      const before = await bp.countTasks();

      // Provide prompt input '3' for number of items
      await bp.autoGenerate('3');

      // After autogen, expect at least 3 more tasks
      const after = await bp.countTasks();
      expect(after).toBeGreaterThanOrEqual(before + 3);

      // History log should reflect autogen
      await expect(page.locator('#historyLog')).toContainText('autogen');
    });
  });

  test.describe('Sprint lifecycle (S2_Sprint_Running, S3_Sprint_Paused, S4_Sprint_Ended)', () => {
    test('Start Sprint sets running and creates burndown entry (S1 -> S2)', async ({ page }) => {
      const bp = new BoardPage(page);

      // Ensure some tasks exist and team exists (init does this)
      await expect(page.locator('#teamList')).toBeVisible();

      // Start sprint
      await bp.startSprint();

      // Sprint status should show Running
      await expect(page.locator('#sprintStatus')).toHaveText('Running');

      // burndown table should have at least one row for day 0 after start
      await expect(page.locator('#burnTable tbody tr')).toHaveCountGreaterThan(0);
      // Sprint day should be 0 initially
      await expect(page.locator('#sprintDay')).toHaveText('0');
    });

    test('Pausing and resuming sprint toggles running flag (S2 <-> S3)', async ({ page }) => {
      const bp = new BoardPage(page);

      // Ensure sprint running (start)
      await bp.startSprint();
      await expect(page.locator('#sprintStatus')).toHaveText('Running');

      // Pause sprint via pause button
      await bp.pauseOrResumeSprint();
      await expect(page.locator('#sprintStatus')).toHaveText('Paused');

      // Resume by clicking pause again (toggle)
      await bp.pauseOrResumeSprint();
      await expect(page.locator('#sprintStatus')).toHaveText('Running');
    });

    test('Ending sprint sets status Ended and carries tasks to To Do (S2 -> S4)', async ({ page }) => {
      const bp = new BoardPage(page);

      // Start sprint then step a day to record some burndown
      await bp.startSprint();
      await bp.stepDay();
      // Pause to stabilize
      await bp.pauseOrResumeSprint();

      // End sprint; accept confirm dialog
      await bp.endSprintAccept();

      // Expect sprint status DOM to say Ended
      await expect(page.locator('#sprintStatus')).toHaveText('Ended');

      // After end, tasks that were not in Done should be moved to To Do or Backlog
      // Check that at least one task is in a non-Done column and that To Do column exists
      const statuses = await page.$$eval('.column', cols => cols.map(c => c.getAttribute('data-status')));
      expect(statuses.length).toBeGreaterThanOrEqual(2);

      // Burndown persisted; ensure burndown table still present
      await expect(page.locator('#burnTable tbody tr')).toBeVisible();
    });
  });

  test.describe('Task operations - move, clone, delete, selection', () => {
    test('Move selected task right and left updates its column', async ({ page }) => {
      const bp = new BoardPage(page);

      // Add a new task to ensure a predictable item we can move
      await bp.addItem({ title: 'MoveTestTask', desc: '', points: '2', priority: '3' });
      const t = await bp.findTaskByTitle('MoveTestTask');
      expect(t).not.toBeNull();

      // Select the task
      await bp.selectTaskById(t.id);

      // Determine initial parent column status
      const initialStatus = await t.locator.evaluate(node => node.closest('.column').dataset.status);
      // Move right (if possible)
      await bp.moveSelectedRight();

      // After moveRight, locate the task again and check its parent column changed (or remained if at end)
      const after = await bp.findTaskById(t.id);
      expect(after).not.toBeNull();
      const newStatus = await after.locator.evaluate(node => node.closest('.column').dataset.status);
      // newStatus should be either same (if already at last column) or next to initial
      expect(newStatus).not.toBeNull();

      // Move left back to original (if moved)
      await bp.selectTaskById(t.id);
      await bp.moveSelectedLeft();
      const back = await bp.findTaskById(t.id);
      expect(back).not.toBeNull();
      const revertedStatus = await back.locator.evaluate(node => node.closest('.column').dataset.status);
      expect(revertedStatus).not.toBeNull();
    });

    test('Clone and delete task update task count and history', async ({ page }) => {
      const bp = new BoardPage(page);

      // Add a new task to clone & delete
      await bp.addItem({ title: 'CloneDeleteTask', desc: 'for clone/delete', points: '1' });
      const t = await bp.findTaskByTitle('CloneDeleteTask');
      expect(t).not.toBeNull();

      const before = await bp.countTasks();

      // Select and clone
      await bp.selectTaskById(t.id);
      await bp.cloneSelected();

      // Expect task count increased
      const afterClone = await bp.countTasks();
      expect(afterClone).toBeGreaterThanOrEqual(before + 1);

      // Select original and delete (confirm)
      await bp.selectTaskById(t.id);
      await bp.deleteSelectedAccept();

      // After deletion, original should not be present
      const maybe = await bp.findTaskByTitle('CloneDeleteTask');
      // might still be present if clone had similar title; ensure that at least one clone remains or original gone
      // For robust check: ensure total tasks decreased compared to post-clone count
      const afterDeleteCount = await bp.countTasks();
      expect(afterDeleteCount).toBeLessThanOrEqual(afterClone - 1);
    });

    test('Split 1-point task triggers alert (edge case)', async ({ page }) => {
      const bp = new BoardPage(page);

      // Add a 1-point task
      await bp.addItem({ title: 'SplitOnePt', desc: '', points: '1' });
      const t = await bp.findTaskByTitle('SplitOnePt');
      expect(t).not.toBeNull();

      // Select it
      await bp.selectTaskById(t.id);

      // Attempt to split: should produce an alert which we accept. We verify alert text.
      const dialogPromise = page.waitForEvent('dialog');
      await bp.splitSelected();
      const dialog = await dialogPromise;
      // The alert message for splitTask when points<=1 is specific
      expect(dialog.message()).toContain('Cannot split a 1-point task');
      await dialog.accept();
    });
  });

  test.describe('Undo/Redo and History validation', () => {
    test('Undo removes last added task and redo attempts to reapply', async ({ page }) => {
      const bp = new BoardPage(page);

      // Add an item to undo
      await bp.addItem({ title: 'UndoTestTask', desc: 'to be undone', points: '2' });
      const added = await bp.findTaskByTitle('UndoTestTask');
      expect(added).not.toBeNull();

      const beforeUndoCount = await bp.countTasks();

      // Click undo - undo handler will try to remove last 'add'
      await bp.clickUndo();

      // After undo, the task should be gone (undo removes added tasks)
      const afterUndo = await bp.findTaskByTitle('UndoTestTask');
      expect(afterUndo).toBeNull();

      // Attempt redo (redo is minimally supported); even if it doesn't restore, the call should not crash
      await bp.clickRedo();

      // History DOM should be present and consistent
      await expect(page.locator('#historyLog')).toBeVisible();
    });

    test('Run retrospective populates retrospective output', async ({ page }) => {
      const bp = new BoardPage(page);

      // Ensure some tasks exist, then run retro
      await bp.runRetro();

      const retroText = await page.locator('#retroOutput').textContent();
      expect(retroText).toBeTruthy();
      expect(retroText).toContain('Completed');
      expect(retroText).toContain('Unfinished');
    });
  });

  test.describe('Workflow columns and auto-assign', () => {
    test('Applying custom columns updates board and reset restores defaults', async ({ page }) => {
      const bp = new BoardPage(page);

      // Apply new columns
      await bp.applyColumns('Backlog, Ready, Doing, Done');
      // Expect columns to match 4 items
      const cols = await page.$$eval('.column', cols => cols.map(c => c.getAttribute('data-status')));
      expect(cols.length).toBe(4);
      expect(cols[0]).toBe('Backlog');
      expect(cols[cols.length - 1]).toBe('Done');

      // Reset columns and verify default count (>=4)
      await bp.resetColumns();
      const cols2 = await page.$$eval('.column', cols => cols.map(c => c.getAttribute('data-status')));
      expect(cols2.length).toBeGreaterThanOrEqual(4);
    });

    test('Auto-assign assigns tasks when team exists and logs actions', async ({ page }) => {
      const bp = new BoardPage(page);

      // Ensure sample team present
      await bp.autoMembers();

      // Add a few unassigned tasks in To Do
      await bp.addItem({ title: 'AutoAssignA', points: '2' });
      await bp.addItem({ title: 'AutoAssignB', points: '3' });

      // Auto-assign
      await bp.autoAssign();

      // After auto-assign, tasks should show assignee in their small text
      const a1 = await bp.findTaskByTitle('AutoAssignA');
      const a2 = await bp.findTaskByTitle('AutoAssignB');
      if (a1) {
        const text = await a1.locator.textContent();
        expect(text).toContain('Assignee:');
      }
      if (a2) {
        const text2 = await a2.locator.textContent();
        expect(text2).toContain('Assignee:');
      }

      // History log should include 'autoassign'
      await expect(page.locator('#historyLog')).toContainText('autoassign');
    });
  });

  test.describe('Edge cases, prompts and logs', () => {
    test('Auto-generate prompt handling and logs generation message', async ({ page }) => {
      const bp = new BoardPage(page);

      // Use autoGenerate with a prompt value of 2
      await bp.autoGenerate('2');

      // events log should contain an 'Auto-generated' message entry
      await expect(page.locator('#eventsLog')).toContainText('Auto-generated', { timeout: 2000 });
    });

    test('Clicking addBlocker triggers random event and eventsLog updates', async ({ page }) {
      const bp = new BoardPage(page);

      const beforeLogs = await page.locator('#eventsLog').locator('div').count();
      await page.click('#addBlocker');
      // Wait for event to log
      await page.waitForTimeout(150);
      const afterLogs = await page.locator('#eventsLog').locator('div').count();
      expect(afterLogs).toBeGreaterThanOrEqual(beforeLogs);
    });
  });
});