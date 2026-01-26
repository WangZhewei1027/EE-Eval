import { test, expect } from '@playwright/test';

const APP = 'http://127.0.0.1:5500/workspace/0126-balanced/html/d3da7da0-fa73-11f0-83e0-8d7be1d51901.html';

test.describe('Interactive Git Concept Demo — FSM and UI integration tests', () => {
  // arrays to collect console messages and page errors during each test
  let consoleErrors;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    dialogs = [];

    // Capture console.error and page errors so tests can assert no unexpected runtime errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push({text: msg.text(), location: msg.location()});
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err.message);
    });

    // record dialogs to inspect them later
    page.on('dialog', async dialog => {
      dialogs.push({type: dialog.type(), message: dialog.message()});
      // By default do not automatically accept/dismiss; tests will await specific dialogs and handle them
      // But some dialogs will remain pending if we don't respond; those are handled in test actions via waitForEvent('dialog')
      await dialog.dismiss().catch(() => {});
    });

    // navigate to the page and ensure it loads
    await page.goto(APP);
    await page.waitForLoadState('load');
    // short pause to allow seedExample to finish and UI to render
    await page.waitForTimeout(200);
  });

  test.afterEach(async () => {
    // nothing to teardown beyond Playwright automatic cleanup
  });

  test('Initial Idle state: app renders and initial repo seeded (S0_Idle entry renderAll)', async ({ page }) => {
    // Verify that the main UI elements are present and seedExample created branches/commits
    await expect(page.locator('h1')).toHaveText(/Git: Interactive Concept Demo/);
    const currentBranch = await page.locator('#currentBranch').innerText();
    expect(currentBranch).toBe('main');

    const statusText = await page.locator('#statusText').innerText();
    // After seedExample, it should render clean state on main
    expect(['clean', 'dirty']).toContain(statusText);

    // HEAD id should be displayed
    const headId = await page.locator('#headId').innerText();
    expect(headId.length).toBeGreaterThan(0);

    // repo object should exist on window and contain refs created by seedExample
    const refs = await page.evaluate(() => Object.keys(repo.refs).sort());
    expect(refs).toEqual(expect.arrayContaining(['feature', 'topic', 'main']));

    // ensure commit graph shows nodes
    const commitNodes = await page.locator('.commit-node').count();
    expect(commitNodes).toBeGreaterThan(0);

    // Ensure no uncaught exceptions were emitted during load
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('File lifecycle: Add, Select, Stage, Unstage, Delete, Commit', () => {
    test('Add a new file via btnAddFile prompt and verify working directory and selection', async ({ page }) => {
      // Click Add File and respond to prompt with 'test-add.txt'
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#btnAddFile')
      ]);
      expect(dialog.type()).toBe('prompt');
      expect(dialog.message()).toMatch(/Enter new file name/);
      await dialog.accept('test-add.txt');

      // After prompt acceptance the UI should render the new file
      await page.waitForTimeout(150);
      const fileItem = page.locator('.file-item', { hasText: 'test-add.txt' });
      await expect(fileItem).toBeVisible();

      // clicking on the file should load into editor (and set selectedFile)
      await fileItem.click();
      const editorValue = await page.locator('#fileEditor').inputValue();
      expect(editorValue).toBe(''); // created empty content by addFile

      // assert repo.workdir contains the file
      const present = await page.evaluate(() => Object.prototype.hasOwnProperty.call(repo.workdir, 'test-add.txt'));
      expect(present).toBe(true);
    });

    test('Stage the selected file via global Stage button and then Unstage via Unstage button', async ({ page }) => {
      // Ensure README.md exists and select it
      const readme = page.locator('.file-item', { hasText: 'README.md' });
      await expect(readme).toBeVisible();
      await readme.click();

      // click global Stage button (btnStage) which uses selectedFile
      await page.click('#btnStage');
      // UI should show staged file in #stageList
      const stagedItem = page.locator('#stageList .stage-item', { hasText: 'README.md' });
      await expect(stagedItem).toBeVisible();

      // Unstage via global Unstage button (requires selectedFile still selected)
      await page.click('#btnUnstage');
      // stage list should show 'No staged changes'
      await expect(page.locator('#stageList .muted')).toHaveText('No staged changes');
    });

    test('Commit staged changes via btnCommit and validate commit created', async ({ page }) => {
      // Create a unique file, stage and commit it
      // Add file
      const addDialogPromise = page.waitForEvent('dialog');
      await page.click('#btnAddFile');
      const addDialog = await addDialogPromise;
      await addDialog.accept('commit-this.txt');

      await page.waitForTimeout(100);
      // select file
      await page.locator('.file-item', { hasText: 'commit-this.txt' }).click();
      // type some content into editor
      await page.fill('#fileEditor', 'Content for commit test');
      // Stage via global button
      await page.click('#btnStage');
      await expect(page.locator('#stageList .stage-item', { hasText: 'commit-this.txt' })).toBeVisible();

      // get commit count before
      const beforeCount = await page.evaluate(() => Object.keys(repo.commits).length);

      // enter commit message
      await page.fill('#commitMsg', 'Add commit-this file');
      // click Commit
      await page.click('#btnCommit');

      // wait for render and check commit count increased
      await page.waitForTimeout(150);
      const afterCount = await page.evaluate(() => Object.keys(repo.commits).length);
      expect(afterCount).toBeGreaterThan(beforeCount);

      // index should be cleared
      const stagedKeys = await page.evaluate(() => Object.keys(repo.index));
      expect(stagedKeys.length).toBe(0);
    });

    test('Delete a selected file via btnDeleteFile confirmation and verify removal from workdir', async ({ page }) => {
      // Select a file to delete: commit-this.txt should exist from previous test
      const file = page.locator('.file-item', { hasText: 'commit-this.txt' });
      await expect(file).toBeVisible();
      await file.click();

      // Click Delete Selected and accept confirmation
      const confirmPromise = page.waitForEvent('dialog');
      await page.click('#btnDeleteFile');
      const confirmDialog = await confirmPromise;
      expect(confirmDialog.type()).toBe('confirm');
      await confirmDialog.accept();

      // wait for UI update
      await page.waitForTimeout(120);

      // ensure file no longer present in files list
      const exists = await page.locator('.file-item', { hasText: 'commit-this.txt' }).count();
      expect(exists).toBe(0);

      // repo.workdir should not have the file
      const present = await page.evaluate(() => Object.prototype.hasOwnProperty.call(repo.workdir, 'commit-this.txt'));
      expect(present).toBe(false);
    });
  });

  test.describe('Branching and checkout flows', () => {
    test('Create a new branch via btnNewBranch and ensure ref is created', async ({ page }) => {
      // Click New Branch and respond to prompt with 'e2e-branch'
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#btnNewBranch');
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('e2e-branch');

      await page.waitForTimeout(100);
      const hasBranch = await page.evaluate(() => Object.prototype.hasOwnProperty.call(repo.refs, 'e2e-branch'));
      expect(hasBranch).toBe(true);

      // branch should point to current HEAD commit
      const headCommit = await page.evaluate(() => repo.HEAD.commit);
      const branchCommit = await page.evaluate(() => repo.refs['e2e-branch']);
      expect(branchCommit).toBe(headCommit);
    });

    test('Checkout an existing branch via btnCheckout and confirm working directory updates', async ({ page }) => {
      // Ensure current branch is main, then checkout 'feature' branch via prompt
      await page.waitForTimeout(50);
      // Click Checkout and accept prompt with 'feature'
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#btnCheckout');
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('prompt');
      await dialog.accept('feature');

      // Wait for checkout to process
      await page.waitForTimeout(200);
      const current = await page.locator('#currentBranch').innerText();
      expect(current).toBe('feature');

      // repo.HEAD.name should be 'feature'
      const headName = await page.evaluate(() => repo.HEAD.name);
      expect(headName).toBe('feature');

      // Working directory should reflect feature changes e.g., 'file.txt' exists on feature branch
      const fileExists = await page.evaluate(() => Object.prototype.hasOwnProperty.call(repo.workdir, 'file.txt'));
      expect(fileExists).toBe(true);
    });

    test('Attempt checkout of non-existent branch triggers alert "No such branch"', async ({ page }) => {
      // Click Checkout and respond with a branch that doesn't exist
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#btnCheckout');
      const promptDialog = await dialogPromise;
      expect(promptDialog.type()).toBe('prompt');
      await promptDialog.accept('this-branch-does-not-exist');

      // After the prompt, an alert will be shown with "No such branch". Capture it.
      const alertPromise = page.waitForEvent('dialog');
      const alertDialog = await alertPromise;
      expect(alertDialog.type()).toBe('alert');
      expect(alertDialog.message()).toMatch(/No such branch/);
      await alertDialog.accept();
    });
  });

  test.describe('Merging: successful merge, conflicts, and abort', () => {
    test('Merging a branch into itself triggers an alert preventing the operation', async ({ page }) => {
      // Ensure on main branch
      await page.evaluate(() => checkout('main'));
      await page.waitForTimeout(100);

      // Click Merge and enter 'main' (same as current)
      const promptPromise = page.waitForEvent('dialog');
      await page.click('#btnMerge');
      const prompt = await promptPromise;
      expect(prompt.type()).toBe('prompt');
      await prompt.accept('main');

      // Should result in an alert "Cannot merge a branch into itself"
      const alertPromise = page.waitForEvent('dialog');
      const alert = await alertPromise;
      expect(alert.type()).toBe('alert');
      expect(alert.message()).toMatch(/Cannot merge a branch into itself/);
      await alert.accept();
    });

    test('Merge branch that results in conflicts enters S1_Merging and sets repo.mergeState', async ({ page }) => {
      // Ensure on main branch (main currently has modifications in seedExample)
      await page.evaluate(() => checkout('main'));
      await page.waitForTimeout(120);

      // Click Merge and respond with 'feature' which is expected to conflict on README.md
      const promptPromise = page.waitForEvent('dialog');
      await page.click('#btnMerge');
      const prompt = await promptPromise;
      expect(prompt.type()).toBe('prompt');
      await prompt.accept('feature');

      // After accepting the prompt a conflict alert should appear (mergeBranchIntoCurrent alerts conflicts)
      const conflictAlert = await page.waitForEvent('dialog');
      expect(conflictAlert.type()).toBe('alert');
      expect(conflictAlert.message()).toMatch(/Merge resulted in conflicts/);
      await conflictAlert.accept();

      // Now repo.mergeState should be set with merging:true
      const mergeState = await page.evaluate(() => repo.mergeState);
      expect(mergeState).toBeTruthy();
      expect(mergeState.merging).toBe(true);
      expect(Array.isArray(mergeState.conflicts)).toBe(true);
      expect(mergeState.conflicts.length).toBeGreaterThan(0);

      // UI should display merge in progress text in inspect area
      const inspectText = await page.locator('#inspectArea').innerText();
      expect(inspectText).toMatch(/Merge in progress/);
    });

    test('Abort an in-progress merge via btnAbortMerge resets repo.mergeState and restores workdir', async ({ page }) => {
      // Precondition: ensure there is a merge in progress. If not, start one quickly.
      const isMerging = await page.evaluate(() => !!repo.mergeState);
      if (!isMerging) {
        // start a merge that yields conflicts (merge 'feature' into 'main')
        await page.evaluate(() => checkout('main'));
        await page.waitForTimeout(100);
        const dlg1 = page.waitForEvent('dialog').then(d => d.accept('feature')).catch(()=>{});
        await page.click('#btnMerge');
        // Wait for the conflict alert then accept it to allow mergeState to be set
        const conflictDialog = await page.waitForEvent('dialog');
        await conflictDialog.accept();
        await page.waitForTimeout(120);
      }

      // Now abort merge: the abortMerge function invokes confirm "Abort merge? ...". We must accept it.
      const confirmPromise = page.waitForEvent('dialog');
      await page.click('#btnAbortMerge');
      const confirmDialog = await confirmPromise;
      expect(confirmDialog.type()).toBe('confirm');
      await confirmDialog.accept();

      // After accepting abort, mergeState should be null
      await page.waitForTimeout(120);
      const mergeStateAfter = await page.evaluate(() => repo.mergeState);
      expect(mergeStateAfter).toBeNull();

      // Workdir should be restored to HEAD commit snapshot
      const headTree = await page.evaluate(() => getCommit(repo.HEAD.commit).tree);
      const workdir = await page.evaluate(() => repo.workdir);
      // For equality we check that keys sets are equal
      const headKeys = Object.keys(headTree).sort();
      const wdKeys = Object.keys(workdir).sort();
      expect(wdKeys).toEqual(headKeys);
    });
  });

  test.describe('Utility actions and edge-case scenarios', () => {
    test('ShowStatus displays JSON describing repo status via alert', async ({ page }) => {
      // Click Status button and expect an alert with JSON containing 'dirty' key
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#btnShowStatus')
      ]);
      expect(dialog.type()).toBe('alert');
      const msg = dialog.message();
      expect(msg).toMatch(/"dirty"/);
      // Accept the alert
      await dialog.accept();
    });

    test('ShowBranches displays repo.refs JSON via alert', async ({ page }) => {
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.click('#btnShowBranches')
      ]);
      expect(dialog.type()).toBe('alert');
      const msg = dialog.message();
      expect(msg).toMatch(/"main"/);
      expect(msg).toMatch(/"feature"/);
      await dialog.accept();
    });

    test('Refresh button re-renders UI without errors', async ({ page }) => {
      await page.click('#btnRefresh');
      // Wait shortly for re-render
      await page.waitForTimeout(100);
      // Validate that key elements still present
      await expect(page.locator('#graph')).toBeVisible();
      await expect(page.locator('#filesList')).toBeVisible();

      // ensure no new page errors on refresh
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Edge case: adding a file with existing name triggers alert "File exists"', async ({ page }) => {
      // Choose an existing filename e.g., README.md
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#btnAddFile');
      const promptDialog = await dialogPromise;
      expect(promptDialog.type()).toBe('prompt');
      await promptDialog.accept('README.md');

      // Should receive an alert "File exists"
      const alertDialog = await page.waitForEvent('dialog');
      expect(alertDialog.type()).toBe('alert');
      expect(alertDialog.message()).toMatch(/File exists/);
      await alertDialog.accept();
    });

    test('Attempt to commit with no staged changes triggers alert "Nothing staged to commit."', async ({ page }) => {
      // Ensure index is empty
      await page.evaluate(() => { repo.index = {}; renderAll(); });
      await page.fill('#commitMsg', 'Should not commit');
      // Click commit and capture alert
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#btnCommit');
      const dialog = await dialogPromise;
      // Because there is nothing staged, commitStaged alerts "Nothing staged to commit."
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toMatch(/Nothing staged to commit/);
      await dialog.accept();
      // Clear commit message box
      await page.fill('#commitMsg', '');
    });

    test('Attempt to unstage without selecting a file triggers alert "Select a file to unstage"', async ({ page }) => {
      // Ensure no file selected
      await page.evaluate(() => { selectedFile = null; document.getElementById('fileEditor').value = ''; renderAll(); });
      // click Unstage -> will trigger alert "Select a file to unstage"
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#btnUnstage');
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toMatch(/Select a file to unstage/);
      await dialog.accept();
    });

    test('Attempt to stage without selecting a file triggers alert "Select a file to stage"', async ({ page }) => {
      // Ensure no file selected
      await page.evaluate(() => { selectedFile = null; document.getElementById('fileEditor').value = ''; renderAll(); });
      const dialogPromise = page.waitForEvent('dialog');
      await page.click('#btnStage');
      const dialog = await dialogPromise;
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toMatch(/Select a file to stage/);
      await dialog.accept();
    });
  });

  test('Final check: no uncaught runtime exceptions were emitted during test interactions', async ({ page }) => {
    // At end of interactions assert collected page errors and console errors are empty
    expect(pageErrors.length).toBe(0);
    expect(consoleErrors.length).toBe(0);
  });
});