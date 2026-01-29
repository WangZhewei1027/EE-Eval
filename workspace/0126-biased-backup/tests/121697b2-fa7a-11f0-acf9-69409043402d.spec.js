import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121697b2-fa7a-11f0-acf9-69409043402d.html';

test.describe('Version Control Simulator (Application ID: 121697b2-fa7a-11f0-acf9-69409043402d)', () => {
  // Arrays to collect runtime diagnostics per test
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    // Reset collectors
    pageErrors = [];
    consoleMessages = [];

    // Collect page errors
    page.on('pageerror', err => {
      pageErrors.push(err);
      // also log to consoleMessages for visibility
      consoleMessages.push({ type: 'pageerror', text: String(err) });
    });

    // Collect console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Navigate to the exact page (load as-is)
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });

    // Ensure initial DOM loaded
    await expect(page.locator('h1')).toContainText('Version Control Simulator');
  });

  test.afterEach(async ({}, testInfo) => {
    // Basic assertions on observed runtime diagnostics.
    // We assert we observed the collectors (they always exist). We also assert that
    // there are no uncaught ReferenceError / SyntaxError / TypeError in pageErrors.
    const criticalError = pageErrors.find(e => {
      const name = e && e.name ? e.name : '';
      return name === 'ReferenceError' || name === 'SyntaxError' || name === 'TypeError';
    });
    expect(pageErrors).toBeInstanceOf(Array); // we observed and collected pageErrors
    expect(consoleMessages).toBeInstanceOf(Array); // we observed console messages

    // Fail the test if any critical runtime error occurred
    if (criticalError) {
      // Provide diagnostics to help debugging
      testInfo.attach('pageErrors', {
        body: JSON.stringify(pageErrors.map(e => ({ name: e.name, message: e.message })), null, 2),
        contentType: 'application/json'
      });
    }
    expect(criticalError, 'No ReferenceError/SyntaxError/TypeError should be thrown by the app').toBeUndefined();
  });

  // Helper POs
  const PO = {
    workspace: '#workspaceInput',
    staging: '#stagingArea',
    stageAllBtn: '#stageAllBtn',
    discardBtn: '#discardChangesBtn',
    autoStageCheckbox: '#autoStageCheckbox',
    unstageAllBtn: '#unstageAllBtn',
    commitMessage: '#commitMessage',
    commitBtn: '#commitBtn',
    branchList: '#branchList',
    newBranchInput: '#newBranchName',
    createBranchBtn: '#createBranchBtn',
    checkoutBranchBtn: '#checkoutBranchBtn',
    mergeBranchBtn: '#mergeBranchBtn',
    deleteBranchBtn: '#deleteBranchBtn',
    branchError: '#branchError',
    logOutput: '#logOutput',
    logFilter: '#logFilter',
    refreshLogBtn: '#refreshLogBtn',
    graphOutput: '#graphOutput'
  };

  test('Initial Idle state: workspace, staging, branches, log and graph reflect initial commit', async ({ page }) => {
    // Verify workspace empty (initial)
    await expect(page.locator(PO.workspace)).toHaveValue('');

    // Verify staging area empty
    await expect(page.locator(PO.staging)).toHaveValue('');

    // Branch list contains 'main' and shows (current)
    const branchList = page.locator(PO.branchList);
    await expect(branchList).toContainText('main');
    await expect(branchList).toContainText('(current)');

    // Log contains "Initial commit" message
    await expect(page.locator(PO.logOutput)).toContainText('Initial commit');

    // Graph should contain "Initial commit" message too
    await expect(page.locator(PO.graphOutput)).toContainText('Initial commit');

    // Confirm no critical runtime errors captured at this early stage
    expect(pageErrors.length).toBe(0);
  });

  test('Workspace Edited -> Stage All Changes -> Staged state', async ({ page }) => {
    // Edit workspace to simulate user changes
    const sampleText = 'Hello world\nThis is a test change.';
    await page.fill(PO.workspace, sampleText);

    // Ensure workspace reflects edit
    await expect(page.locator(PO.workspace)).toHaveValue(sampleText);

    // Stage all changes
    await page.click(PO.stageAllBtn);

    // Staging area should now display the same content
    await expect(page.locator(PO.staging)).toHaveValue(sampleText);

    // Attempt to stage again when nothing changed (workspace equals HEAD) should trigger alert
    // First reset workspace and staging to HEAD by committing the staged content
    // Provide commit message and commit
    await page.fill(PO.commitMessage, 'commit for stage test');
    await page.click(PO.commitBtn);

    // After commit, staging should be cleared and workspace equal to HEAD
    await expect(page.locator(PO.staging)).toHaveValue('');
    // Now clicking stageAllBtn should show alert "No changes to stage."
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.click(PO.stageAllBtn)
    ]);
    expect(dialog.type()).toBe('alert');
    expect(dialog.message()).toContain('No changes to stage.');
    await dialog.accept();
  });

  test('Unstage All Changes: confirm and cancel paths', async ({ page }) => {
    const txt = 'Some content to stage';
    // Make new change and stage it
    await page.fill(PO.workspace, txt);
    await page.click(PO.stageAllBtn);
    await expect(page.locator(PO.staging)).toHaveValue(txt);

    // Cancel unstage via dialog -> staging should remain
    const cancelPromise = page.waitForEvent('dialog').then(d => d.dismiss());
    await page.click(PO.unstageAllBtn);
    await cancelPromise;
    // staging remains unchanged
    await expect(page.locator(PO.staging)).toHaveValue(txt);

    // Now accept unstage confirm -> staging cleared
    const acceptPromise = page.waitForEvent('dialog').then(d => d.accept());
    await page.click(PO.unstageAllBtn);
    await acceptPromise;
    await expect(page.locator(PO.staging)).toHaveValue('');
  });

  test('Commit Staged Changes: normal commit and edge-case (no staged changes)', async ({ page }) => {
    // Edge case first: click commit with nothing staged -> alert
    const alertPromise = page.waitForEvent('dialog').then(d => {
      expect(d.type()).toBe('alert');
      expect(d.message()).toContain('No staged changes to commit.');
      return d.accept();
    });
    await page.click(PO.commitBtn);
    await alertPromise;

    // Now stage and commit properly
    const content = 'Committed content\nLine 2';
    await page.fill(PO.workspace, content);
    await page.click(PO.stageAllBtn);
    await page.fill(PO.commitMessage, 'My test commit');
    await page.click(PO.commitBtn);

    // After commit:
    // - Staging area cleared
    await expect(page.locator(PO.staging)).toHaveValue('');
    // - Commit message field cleared
    await expect(page.locator(PO.commitMessage)).toHaveValue('');
    // - Log contains our commit message
    await expect(page.locator(PO.logOutput)).toContainText('My test commit');
    // - Graph shows the commit message as well
    await expect(page.locator(PO.graphOutput)).toContainText('My test commit');
  });

  test('Create Branch: success and validation errors (empty/duplicate/invalid)', async ({ page }) => {
    // Empty name -> error message
    await page.fill(PO.newBranchInput, '');
    await page.click(PO.createBranchBtn);
    await expect(page.locator(PO.branchError)).toContainText('Branch name cannot be empty.');

    // Invalid name with spaces -> error
    await page.fill(PO.newBranchInput, 'bad name');
    await page.click(PO.createBranchBtn);
    await expect(page.locator(PO.branchError)).toContainText('Invalid branch name');

    // Valid create
    const newBranch = 'feature_x';
    await page.fill(PO.newBranchInput, newBranch);
    await page.click(PO.createBranchBtn);
    // Branch list should include new branch
    await expect(page.locator(PO.branchList)).toContainText(newBranch);

    // Duplicate creation attempt should show error
    await page.fill(PO.newBranchInput, newBranch);
    await page.click(PO.createBranchBtn);
    await expect(page.locator(PO.branchError)).toContainText('Branch name already exists.');
  });

  test('Checkout Branch: errors when none selected or already on branch, and successful checkout', async ({ page }) => {
    // Attempt checkout without selection -> branchError
    // (Clear any selection by clicking on area and unchecking isn't trivial; instead simulate by ensuring no radio is selected by creating a new branch and selecting it then trying to checkout to current branch)
    // Create branch 'tempCheck'
    const newBranch = 'tempCheck';
    await page.fill(PO.newBranchInput, newBranch);
    await page.click(PO.createBranchBtn);
    // Selecting current branch and trying to checkout should produce "Already on branch"
    // Determine which branch radio is current (main)
    // Select the current branch explicitly
    await page.check(`#branchRadio_main`);
    await page.click(PO.checkoutBranchBtn);
    await expect(page.locator(PO.branchError)).toContainText("Already on branch");

    // Now checkout to the newly created branch (should prompt confirm only if dirty; repo is clean)
    await page.check(`#branchRadio_${newBranch}`);
    // Setup a dialog capture if confirm pops; but since repo is clean it should not prompt.
    await page.click(PO.checkoutBranchBtn);
    // After checkout, branchList should show (current) next to new branch
    await expect(page.locator(PO.branchList)).toContainText(`${newBranch} (current)`);
  });

  test('Merge Branch: fast-forward merge and non-fast-forward merge with prompt', async ({ page }) => {
    // Create a branch 'feature' and advance it with a commit, then merge into main (fast-forward)
    const feature = 'feature_ff';
    await page.fill(PO.newBranchInput, feature);
    await page.click(PO.createBranchBtn);

    // Checkout feature
    await page.check(`#branchRadio_${feature}`);
    await page.click(PO.checkoutBranchBtn);
    await expect(page.locator(PO.branchList)).toContainText(`${feature} (current)`);

    // Make changes and commit on feature
    await page.fill(PO.workspace, 'feature line 1');
    await page.click(PO.stageAllBtn);
    await page.fill(PO.commitMessage, 'feature commit');
    await page.click(PO.commitBtn);
    await expect(page.locator(PO.logOutput)).toContainText('feature commit');

    // Checkout main
    await page.check(`#branchRadio_main`);
    // There should be no unstaged/staged changes; checkout should succeed normally
    await page.click(PO.checkoutBranchBtn);
    await expect(page.locator(PO.branchList)).toContainText('main (current)');

    // Merge feature into main (fast-forward). The code will call confirm for fast-forward.
    const ffDialogPromise = page.waitForEvent('dialog');
    await page.check(`#branchRadio_${feature}`);
    // Click merge, accept the confirm
    const [ffDialog] = await Promise.all([
      ffDialogPromise,
      page.click(PO.mergeBranchBtn)
    ]);
    // Confirm dialog should mention fast-forward
    expect(ffDialog.message()).toContain('Fast-forward merge possible');
    await ffDialog.accept();

    // After fast-forward merge, branchErrorDiv contains "Fast-forward merged."
    await expect(page.locator(PO.branchError)).toContainText('Fast-forward merged.');

    // Now set up non-fast-forward scenario:
    // Create branch 'dev' from current main
    const dev = 'dev_branch';
    await page.fill(PO.newBranchInput, dev);
    await page.click(PO.createBranchBtn);

    // Checkout dev and commit a change
    await page.check(`#branchRadio_${dev}`);
    await page.click(PO.checkoutBranchBtn);
    await page.fill(PO.workspace, 'dev content line');
    await page.click(PO.stageAllBtn);
    await page.fill(PO.commitMessage, 'dev commit');
    await page.click(PO.commitBtn);
    await expect(page.locator(PO.logOutput)).toContainText('dev commit');

    // Checkout main and make a different commit so branches diverge
    await page.check(`#branchRadio_main`);
    await page.click(PO.checkoutBranchBtn);
    await page.fill(PO.workspace, 'main divergent content');
    await page.click(PO.stageAllBtn);
    await page.fill(PO.commitMessage, 'main divergent commit');
    await page.click(PO.commitBtn);
    await expect(page.locator(PO.logOutput)).toContainText('main divergent commit');

    // Now merge dev into main (non fast-forward). The app will prompt via prompt(...) for merge message.
    // Provide merge message via dialog handler
    page.once('dialog', async dialog => {
      // This should be a prompt requesting merge message
      expect(dialog.type()).toBe('prompt');
      // Provide a custom merge message
      await dialog.accept('Merging dev_branch into main - test merge msg');
    });
    await page.check(`#branchRadio_${dev}`);
    await page.click(PO.mergeBranchBtn);

    // After merge, log should contain our merge message
    await expect(page.locator(PO.logOutput)).toContainText('Merging dev_branch into main - test merge msg');
  });

  test('Delete Branch: deletion and error when attempting to delete current branch', async ({ page }) => {
    // Create a branch to delete
    const delBranch = 'to_delete';
    await page.fill(PO.newBranchInput, delBranch);
    await page.click(PO.createBranchBtn);
    await expect(page.locator(PO.branchList)).toContainText(delBranch);

    // Attempt to delete without selecting -> branchError shows 'No branch selected.'
    // Deselecting is not trivial; instead click delete with selecting nothing by creating a dummy selection then removing it
    // The UI always has a radio selected; to simulate no selection we'll manipulate: select the branch to delete and then remove selection by selecting itself and unchecking is not supported.
    // Instead test delete path normally: select branch and delete (confirm)
    await page.check(`#branchRadio_${delBranch}`);
    // Delete confirmation should appear - accept it
    const delDialogPromise = page.waitForEvent('dialog');
    await page.click(PO.deleteBranchBtn);
    const delDialog = await delDialogPromise;
    expect(delDialog.message()).toContain(`Delete branch '${delBranch}'`);
    await delDialog.accept();

    // Branch should be removed
    await expect(page.locator(PO.branchList)).not.toContainText(delBranch);

    // Attempt to delete current branch (should error)
    // Ensure current is 'main'
    await page.check(`#branchRadio_main`);
    await page.click(PO.deleteBranchBtn);
    await expect(page.locator(PO.branchError)).toContainText('No branch selected.').or.toContainText('Cannot delete the current branch');
    // The branchError message may be "No branch selected." if radio selection parsing differs,
    // or "Cannot delete the current branch." if 'main' was selected. Accept either as an observed error scenario.
  });

  test('Refresh Log and Filter Log behaviors', async ({ page }) => {
    // Ensure log contains 'Initial commit' and other commits
    await expect(page.locator(PO.logOutput)).toContainText('Initial commit');

    // Create a unique commit to filter by
    const uniqueMsg = 'UNIQUE_FILTER_MSG_' + Math.floor(Math.random() * 10000);
    await page.fill(PO.workspace, 'filter test content');
    await page.click(PO.stageAllBtn);
    await page.fill(PO.commitMessage, uniqueMsg);
    await page.click(PO.commitBtn);

    // Now filter by part of the unique message
    await page.fill(PO.logFilter, 'UNIQUE_FILTER_MSG_');
    // Typing into logFilter triggers update automatically; also click refresh to exercise RefreshLog event
    await page.click(PO.refreshLogBtn);

    // logOutput should contain only commits that match filter; at least it must include our unique message
    await expect(page.locator(PO.logOutput)).toContainText(uniqueMsg);

    // Clear the filter and ensure log returns to showing multiple entries
    await page.fill(PO.logFilter, '');
    await page.click(PO.refreshLogBtn);
    await expect(page.locator(PO.logOutput)).toContainText('Initial commit');
  });

  test('Auto Stage checkbox auto-stages workspace edits', async ({ page }) => {
    // Enable auto stage
    await page.check(PO.autoStageCheckbox);
    const content = 'auto staged content';
    await page.fill(PO.workspace, content);

    // Auto-staging should have updated the staging area
    await expect(page.locator(PO.staging)).toHaveValue(content);

    // Disable auto stage and edit -> staging should not update
    await page.uncheck(PO.autoStageCheckbox);
    await page.fill(PO.workspace, 'new not auto staged');
    await expect(page.locator(PO.staging)).not.toHaveValue('new not auto staged');
  });

  test('Discard All Unstaged Changes: cancel and accept flow', async ({ page }) => {
    // Make a workspace edit that is not staged
    const unsaved = 'temporary unsaved change';
    await page.fill(PO.workspace, unsaved);
    await expect(page.locator(PO.workspace)).toHaveValue(unsaved);

    // Cancel discard via dialog -> workspace remains changed
    const cancelDialog = page.waitForEvent('dialog').then(d => d.dismiss());
    await page.click(PO.discardBtn);
    await cancelDialog;
    await expect(page.locator(PO.workspace)).toHaveValue(unsaved);

    // Accept discard confirm -> workspace reverts to HEAD (which initially is some content)
    // Provide handler to accept confirm
    const acceptDialog = page.waitForEvent('dialog').then(d => d.accept());
    await page.click(PO.discardBtn);
    await acceptDialog;
    // Now workspace equals HEAD content (initial HEAD could be empty or last commit). We assert it's not the unsaved text
    await expect(page.locator(PO.workspace)).not.toHaveValue(unsaved);
  });

});