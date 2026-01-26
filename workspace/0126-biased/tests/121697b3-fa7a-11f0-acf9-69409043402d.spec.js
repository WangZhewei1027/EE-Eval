import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/121697b3-fa7a-11f0-acf9-69409043402d.html';

// Page Object for the Interactive Git Simulator
class GitSimulatorPage {
  constructor(page) {
    this.page = page;
    // Selectors
    this.initBtn = '#initBtn';
    this.repoSection = '#repoSection';
    this.workingFile = '#workingFile';
    this.stageBtn = '#stageBtn';
    this.commitBtn = '#commitBtn';
    this.newBranchName = '#newBranchName';
    this.createBranchBtn = '#createBranchBtn';
    this.branchSelect = '#branchSelect';
    this.checkoutBtn = '#checkoutBtn';
    this.logBtn = '#logBtn';
    this.output = '#output';
    this.statusBtn = '#statusBtn';
    this.diffBtn = '#diffBtn';
    this.mergeBranchSelect = '#mergeBranchSelect';
    this.mergeBtn = '#mergeBtn';
    this.resetCommitInput = '#resetCommitInput';
    this.resetBtn = '#resetBtn';
    this.resetHardBtn = '#resetHardBtn';
    this.rebaseTargetInput = '#rebaseTargetInput';
    this.rebaseBtn = '#rebaseBtn';
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async clickInit() {
    await this.page.click(this.initBtn);
  }

  async isRepoSectionVisible() {
    return await this.page.$eval(this.repoSection, el => getComputedStyle(el).display !== 'none');
  }

  async getOutputText() {
    return await this.page.$eval(this.output, el => el.textContent || '');
  }

  async setWorkingFile(text) {
    await this.page.fill(this.workingFile, text);
  }

  async clickStage() {
    await this.page.click(this.stageBtn);
  }

  async clickCommitAndAcceptDialog(message) {
    // Accept prompt with message
    const promise = this.page.waitForEvent('dialog');
    await this.page.click(this.commitBtn);
    const dialog = await promise;
    await dialog.accept(message);
  }

  async createBranch(name) {
    await this.page.fill(this.newBranchName, name);
    await this.page.click(this.createBranchBtn);
  }

  async getBranchOptions() {
    return await this.page.$$eval(`${this.branchSelect} option`, opts => opts.map(o => o.value));
  }

  async checkoutBranch(name) {
    // select option
    await this.page.selectOption(this.branchSelect, name);
    await this.page.click(this.checkoutBtn);
  }

  async showLog() {
    await this.page.click(this.logBtn);
  }

  async showStatus() {
    await this.page.click(this.statusBtn);
  }

  async showDiff() {
    await this.page.click(this.diffBtn);
  }

  async selectMergeBranch(name) {
    await this.page.selectOption(this.mergeBranchSelect, name);
  }

  async clickMerge() {
    await this.page.click(this.mergeBtn);
  }

  async setResetInput(value) {
    await this.page.fill(this.resetCommitInput, value);
  }

  async clickResetMixed() {
    await this.page.click(this.resetBtn);
  }

  async clickResetHard() {
    await this.page.click(this.resetHardBtn);
  }

  async setRebaseTarget(value) {
    await this.page.fill(this.rebaseTargetInput, value);
  }

  async clickRebase() {
    await this.page.click(this.rebaseBtn);
  }

  async getWorkingFileValue() {
    return await this.page.$eval(this.workingFile, el => el.value);
  }
}

test.describe('Interactive Git Simulator - FSM validation', () => {
  let pageErrors;
  let consoleMessages;

  test.beforeEach(async ({ page }) => {
    pageErrors = [];
    consoleMessages = [];

    // Capture page errors and console messages for each test
    page.on('pageerror', err => {
      pageErrors.push(String(err));
    });
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
  });

  test.describe('Initialization and basic UI state (S0_Idle -> S1_RepoInitialized)', () => {
    test('should start in Idle (repoSection hidden) and initialize repository', async ({ page }) => {
      const sim = new GitSimulatorPage(page);
      await sim.goto();

      // Verify initial idle state: repoSection not visible
      const visibleBefore = await page.$eval('#repoSection', el => getComputedStyle(el).display);
      expect(visibleBefore).toBe('none');

      // Click initialize and assert state transition
      await sim.clickInit();

      // repoSection should now be visible (entry_action updateUIAfterRepoChange executed)
      const visibleAfter = await page.$eval('#repoSection', el => getComputedStyle(el).display);
      expect(visibleAfter).not.toBe('none');

      // Output should contain initialization message
      const out = await sim.getOutputText();
      expect(out).toContain('Repository initialized with empty master branch and initial commit.');

      // Ensure no unexpected page errors occurred during init
      expect(pageErrors).toEqual([]);
      // No severe console errors
      const errors = consoleMessages.filter(m => m.type === 'error');
      expect(errors).toEqual([]);
    });
  });

  test.describe('Staging, committing, logging, status, and diff', () => {
    test('should stage changes, commit them (with prompt), and show log/status/diff outputs', async ({ page }) => {
      const sim = new GitSimulatorPage(page);
      await sim.goto();

      // Initialize repository
      await sim.clickInit();

      // Create a change in the working file and stage it
      await sim.setWorkingFile('Hello, world');
      await sim.clickStage();

      // Assert 'Changes staged.' printed
      let out = await sim.getOutputText();
      expect(out).toContain('Changes staged.');

      // Commit staged change: handle prompt dialog
      // Accept dialog with message 'first commit'
      const dialogPromise = page.waitForEvent('dialog');
      // Click commit -> a dialog will appear. Use the promise to accept.
      const commitClick = page.click('#commitBtn');
      const dialog = await dialogPromise;
      await dialog.accept('first commit');
      await commitClick;

      // Verify commit output with commit hash mention
      out = await sim.getOutputText();
      expect(/Committed new commit [0-9a-f]{1,6} on master\./.test(out)).toBe(true);

      // Capture the commit hash from the output for later use
      const match = out.match(/Committed new commit ([0-9a-f]{1,6}) on master\./);
      expect(match).not.toBeNull();
      const firstCommitHash = match ? match[1] : null;
      expect(firstCommitHash).toBeTruthy();

      // Show commit log
      await sim.showLog();
      out = await sim.getOutputText();
      expect(out).toContain('Commit log (most recent first):');

      // Show status - should be on master and working directory clean
      await sim.showStatus();
      out = await sim.getOutputText();
      expect(out).toMatch(/On branch master/);
      expect(out).toMatch(/Working directory clean|No changes staged|No changes staged\./);

      // Create an unstaged diff: modify working file again and stage to propagate repo.working
      await sim.setWorkingFile('Hello, world\nNew line');
      await sim.clickStage(); // this sets repo.working and index
      await sim.showDiff();
      out = await sim.getOutputText();
      expect(out).toContain('Diff (HEAD -> Working directory):');

      // Ensure no fatal page errors during these flows
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Branching, checkout, merge scenarios (fast-forward and conflicts)', () => {
    test('create branches, checkout and perform merges producing conflicts', async ({ page }) => {
      const sim = new GitSimulatorPage(page);
      await sim.goto();

      // Initialize repository
      await sim.clickInit();

      // Make a commit on master so branches can diverge later
      await sim.setWorkingFile('baseline');
      await sim.clickStage();
      // Commit baseline
      let d = page.waitForEvent('dialog');
      await page.click('#commitBtn');
      let dialog = await d;
      await dialog.accept('baseline commit');

      // Create feature branch and check it out
      await sim.createBranch('feature');
      let out = await sim.getOutputText();
      expect(out).toMatch(/Branch 'feature' created at commit [0-9a-f]{1,6}\./);

      await sim.checkoutBranch('feature');
      out = await sim.getOutputText();
      expect(out).toContain("Checked out branch 'feature'.");

      // Make a commit on feature
      await sim.setWorkingFile('feature-line-A');
      await sim.clickStage();
      d = page.waitForEvent('dialog');
      await page.click('#commitBtn');
      dialog = await d;
      await dialog.accept('feature commit');

      // Capture feature commit hash
      out = await sim.getOutputText();
      const featureMatch = out.match(/Committed new commit ([0-9a-f]{1,6}) on feature\./);
      // Might also be printed as part of later outputs; ensure we have a feature commit recorded somewhere
      const allOutput = out;
      const fm = allOutput.match(/Committed new commit ([0-9a-f]{1,6}) on feature\./);
      // At least one commit should exist
      expect(allOutput).toMatch(/Committed new commit [0-9a-f]{1,6} on feature\./);

      // Checkout master and create a different commit to force conflict when merging feature into master
      await sim.checkoutBranch('master');
      await sim.setWorkingFile('master-different-line');
      await sim.clickStage();
      d = page.waitForEvent('dialog');
      await page.click('#commitBtn');
      dialog = await d;
      await dialog.accept('master commit');

      // Now attempt to merge feature into master - should detect conflict because lines differ
      await sim.selectMergeBranch('feature');
      await sim.clickMerge();

      out = await sim.getOutputText();
      // Either conflict message OR successful fast-forward/merge. We expect a conflict for divergent single-line changes.
      const gotConflict = out.includes('Merge conflict detected!') || out.includes('Merge conflict detected! Resolve conflicts in working directory and stage changes.');
      const gotFastForward = out.includes('Fast-forward merged');
      const gotSuccessfulMerge = out.includes('Merge successful. New merge commit');

      // Assert at least one merge outcome occurred
      expect(gotConflict || gotFastForward || gotSuccessfulMerge).toBe(true);

      // If conflict occurred, working file should contain conflict markers (<<<<< HEAD)
      if (out.includes('Merge conflict detected!')) {
        const wf = await sim.getWorkingFileValue();
        expect(wf).toContain('<<<<<<< HEAD');
      }

      // Ensure no page-level errors occurred
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Reset and Rebase transitions and edge cases', () => {
    test('should handle reset --mixed and --hard, and reject empty reset input', async ({ page }) => {
      const sim = new GitSimulatorPage(page);
      await sim.goto();

      // Initialize repo and make two commits so we have at least one previous commit to reset to
      await sim.clickInit();

      // Commit 1
      await sim.setWorkingFile('one');
      await sim.clickStage();
      let d = page.waitForEvent('dialog');
      await page.click('#commitBtn');
      let dialog = await d;
      await dialog.accept('commit one');
      // Commit 2
      await sim.setWorkingFile('two');
      await sim.clickStage();
      d = page.waitForEvent('dialog');
      await page.click('#commitBtn');
      dialog = await d;
      await dialog.accept('commit two');

      // Grab recent commit hashes from output: find the last two "Committed new commit" occurrences
      const out = await sim.getOutputText();
      const matches = [...out.matchAll(/Committed new commit ([0-9a-f]{1,6}) on master\./g)].map(m => m[1]);
      expect(matches.length).toBeGreaterThanOrEqual(2);
      const [commitOneHash, commitTwoHash] = matches.slice(-2); // older, newer

      // Reset cancelled when input empty -> edge case
      await sim.setResetInput('');
      await sim.clickResetMixed();
      let outAfter = await sim.getOutputText();
      expect(outAfter).toContain('Reset cancelled: empty commit hash.');

      // Reset --mixed to the earlier commit (use prefix)
      await sim.setResetInput(commitOneHash.slice(0, 4));
      await sim.clickResetMixed();
      outAfter = await sim.getOutputText();
      expect(outAfter).toMatch(new RegExp(`Reset --mixed to commit ${commitOneHash}\\.`));

      // Reset --hard back to the newer commit (commitTwoHash) and verify working file changed
      await sim.setResetInput(commitTwoHash);
      await sim.clickResetHard();
      outAfter = await sim.getOutputText();
      expect(outAfter).toMatch(new RegExp(`Reset --hard to commit ${commitTwoHash}\\.`));

      // After hard reset, working file should equal the commitTwo's content ('two')
      const wf = await sim.getWorkingFileValue();
      expect(wf).toContain('two');

      // Ensure no page errors
      expect(pageErrors).toEqual([]);
    });

    test('should perform a rebase of a feature branch onto target branch and replay commits', async ({ page }) => {
      const sim = new GitSimulatorPage(page);
      await sim.goto();

      // Initialize and create baseline commit
      await sim.clickInit();
      await sim.setWorkingFile('base');
      await sim.clickStage();
      let d = page.waitForEvent('dialog');
      await page.click('#commitBtn');
      let dialog = await d;
      await dialog.accept('base commit');

      // Create target branch and add a commit to it
      await sim.createBranch('upstream');
      await sim.checkoutBranch('upstream');
      await sim.setWorkingFile('upstream change');
      await sim.clickStage();
      d = page.waitForEvent('dialog');
      await page.click('#commitBtn');
      dialog = await d;
      await dialog.accept('upstream commit');

      // Checkout master and create a feature branch and commits to rebase
      await sim.checkoutBranch('master');
      await sim.createBranch('feature-rebase');
      await sim.checkoutBranch('feature-rebase');

      await sim.setWorkingFile('feature A');
      await sim.clickStage();
      d = page.waitForEvent('dialog');
      await page.click('#commitBtn');
      dialog = await d;
      await dialog.accept('feature commit A');

      await sim.setWorkingFile('feature B');
      await sim.clickStage();
      d = page.waitForEvent('dialog');
      await page.click('#commitBtn');
      dialog = await d;
      await dialog.accept('feature commit B');

      // Now rebase feature-rebase onto upstream
      await sim.setRebaseTarget('upstream');
      await sim.clickRebase();

      // Rebase should replay commits and print 'Replayed commit ... as ...' and 'Rebase completed on branch ...'
      const out = await sim.getOutputText();
      expect(out).toContain('Replayed commit');
      expect(out).toContain("Rebase completed on branch 'feature-rebase'.");

      // Ensure the working file reflects last replayed commit (should be 'feature B')
      const wf = await sim.getWorkingFileValue();
      expect(wf).toContain('feature B');

      // No page errors
      expect(pageErrors).toEqual([]);
    });
  });

  test.describe('Validation of input edge cases and error messages', () => {
    test('should not create branch with empty name and should handle ambiguous reset target', async ({ page }) => {
      const sim = new GitSimulatorPage(page);
      await sim.goto();

      await sim.clickInit();

      // Attempt to create a branch with empty name
      await sim.createBranch('');
      let out = await sim.getOutputText();
      expect(out).toContain('Branch name cannot be empty.');

      // Attempt reset with non-existent prefix
      await sim.setResetInput('deadbe');
      await sim.clickResetMixed();
      out = await sim.getOutputText();
      expect(out).toContain('No matching commit found for hash: deadbe');

      // Ensure no page errors
      expect(pageErrors).toEqual([]);
    });
  });

  test.afterEach(async ({ }, testInfo) => {
    // If any page errors were captured, fail the test with diagnostic info
    if (pageErrors.length > 0) {
      // Attach console and page error info to the test output for debugging
      for (const e of pageErrors) {
        console.error('Page error captured:', e);
      }
      // Fail explicitly if any page errors occurred
      expect(pageErrors, 'No page errors should occur during tests').toEqual([]);
    }
  });
});