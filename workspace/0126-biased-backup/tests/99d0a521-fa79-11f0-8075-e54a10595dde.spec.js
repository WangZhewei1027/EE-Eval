import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/99d0a521-fa79-11f0-8075-e54a10595dde.html';

// Page Object for the Git Interactive Demo
class GitDemoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.branchNameInput = page.locator('#branchName');
    this.commitMessageInput = page.locator('#commitMessage');
    this.createBranchButton = page.locator("button[onclick='createBranch()']");
    this.commitChangesButton = page.locator("button[onclick='commitChanges()']");
    this.mergeBranchesButton = page.locator("button[onclick='mergeBranches()']");
    this.viewLogsButton = page.locator("button[onclick='viewLogs()']");
    this.outputDiv = page.locator('#output');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async setBranchName(name) {
    await this.branchNameInput.fill('');
    if (name !== '') {
      await this.branchNameInput.fill(name);
    }
  }

  async setCommitMessage(message) {
    await this.commitMessageInput.fill('');
    if (message !== '') {
      await this.commitMessageInput.fill(message);
    }
  }

  async clickCreateBranch() {
    await this.createBranchButton.click();
  }

  async clickCommitChanges() {
    await this.commitChangesButton.click();
  }

  async clickMergeBranches() {
    await this.mergeBranchesButton.click();
  }

  async clickViewLogs() {
    await this.viewLogsButton.click();
  }

  async getOutputText() {
    // return textContent without HTML <br/> tags
    return await this.page.evaluate(() => {
      const out = document.getElementById('output');
      return out ? out.innerText : '';
    });
  }

  async getOutputHTML() {
    return await this.outputDiv.innerHTML();
  }

  async getRepository() {
    // returns a deep copy of repository to the test context
    return await this.page.evaluate(() => {
      // clone so tests get a snapshot
      return JSON.parse(JSON.stringify(window.repository || {}));
    });
  }

  async appendDirectToRepository(branch, commitMessage) {
    // helper used only in tests to simulate commits on a branch that the UI cannot target
    await this.page.evaluate(
      ({ branch, commitMessage }) => {
        if (!window.repository) return;
        if (!window.repository.branches) window.repository.branches = {};
        if (!window.repository.branches[branch])
          window.repository.branches[branch] = [];
        window.repository.branches[branch].push(commitMessage);
        window.repository.commitHistory.push({ branch: branch, message: commitMessage });
      },
      { branch, commitMessage }
    );
  }
}

test.describe('Git Interactive Demo - FSM Validation (99d0a521-fa79-11f0-8075-e54a10595dde)', () => {
  let page;
  let gitPage;
  let consoleMessages;
  let consoleErrors;
  let pageErrors;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    consoleErrors = [];
    pageErrors = [];

    // Collect console messages and errors for each test
    page.on('console', msg => {
      const entry = { type: msg.type(), text: msg.text() };
      consoleMessages.push(entry);
      if (msg.type() === 'error') {
        consoleErrors.push(entry);
      }
    });

    page.on('pageerror', error => {
      // pageerror events are thrown for uncaught exceptions in the page context
      pageErrors.push({ message: error.message, stack: error.stack });
    });

    gitPage = new GitDemoPage(page);
    await gitPage.goto();
  });

  test.afterEach(async () => {
    // Assert that there are no uncaught page errors for the test run
    // (This ensures the page executed without runtime exceptions unless test expects them)
    expect(pageErrors, 'No uncaught page errors should be emitted').toEqual([]);
    // Also assert there were no console.error messages
    expect(consoleErrors, 'No console.error messages expected').toEqual([]);

    await page.close();
  });

  test('Idle state: initial render and UI elements are present (S0_Idle)', async () => {
    // Validate UI elements exist as described in the FSM Idle state's evidence
    await expect(gitPage.createBranchButton).toBeVisible();
    await expect(gitPage.commitChangesButton).toBeVisible();
    await expect(gitPage.mergeBranchesButton).toBeVisible();
    await expect(gitPage.viewLogsButton).toBeVisible();
    await expect(gitPage.branchNameInput).toBeVisible();
    await expect(gitPage.commitMessageInput).toBeVisible();
    await expect(gitPage.outputDiv).toBeVisible();

    // Verify output is initially empty
    const outputText = await gitPage.getOutputText();
    expect(outputText.trim()).toBe('');

    // Verify the FSM-specified entry action renderPage() is NOT defined in the page (the implementation didn't include it).
    // We check that calling typeof renderPage is 'undefined' to document that the onEnter action from the FSM is not implemented.
    const renderPageType = await page.evaluate(() => typeof window.renderPage);
    expect(renderPageType).toBe('undefined');
  });

  test('Create Branch transition (S0_Idle -> S1_BranchCreated) - successful and empty input edge case', async () => {
    // Attempt to create branch with empty name -> expect prompt message
    await gitPage.setBranchName('');
    await gitPage.clickCreateBranch();
    let out = await gitPage.getOutputText();
    expect(out).toContain('Please enter a branch name.');

    // Now create a valid branch and validate repository state and DOM output
    const branch = 'feature-1';
    await gitPage.setBranchName(branch);
    await gitPage.clickCreateBranch();

    out = await gitPage.getOutputText();
    expect(out).toContain(`Branch '${branch}' created.`);

    // Verify repository.branches[branch] exists (inspect page state)
    const repo = await gitPage.getRepository();
    expect(repo.branches).toBeDefined();
    expect(repo.branches[branch]).toBeDefined();
    expect(Array.isArray(repo.branches[branch])).toBeTruthy();
    expect(repo.branches[branch].length).toBe(0); // newly created branch has no commits yet
  });

  test('Commit Changes transition (S0_Idle -> S2_ChangesCommitted) - successful and empty message edge case', async () => {
    // Attempt to commit with empty message -> expect prompt
    await gitPage.setCommitMessage('');
    await gitPage.clickCommitChanges();
    let out = await gitPage.getOutputText();
    expect(out).toContain('Please enter a commit message.');

    // Commit a valid message to currentBranch (default 'main')
    const message = 'Initial commit';
    await gitPage.setCommitMessage(message);
    await gitPage.clickCommitChanges();

    out = await gitPage.getOutputText();
    expect(out).toContain(`Committed to 'main': ${message}`);

    // Validate repository state: branches['main'] contains the commit and commitHistory updated
    const repo = await gitPage.getRepository();
    expect(repo.branches).toBeDefined();
    expect(repo.branches['main']).toBeDefined();
    expect(repo.branches['main']).toContain(message);
    expect(repo.commitHistory).toBeDefined();
    // Last commitHistory entry should correspond to the commit we just made
    const lastEntry = repo.commitHistory[repo.commitHistory.length - 1];
    expect(lastEntry).toEqual({ branch: 'main', message: message });
  });

  test('Merge Branches transition (S0_Idle -> S3_BranchMerged) - merge existing branch and handle non-existent branch', async () => {
    // Prepare: create a branch named 'feature-x' and add commits directly (UI does not support committing to non-current branch)
    const branchToMerge = 'feature-x';
    await gitPage.setBranchName(branchToMerge);
    await gitPage.clickCreateBranch();

    // Because commitChanges commits only to repository.currentBranch (main), simulate commits on 'feature-x'
    // This uses the page's repository object (allowed) to set up the merge scenario.
    await gitPage.appendDirectToRepository(branchToMerge, 'feat: add feature-x v1');
    await gitPage.appendDirectToRepository(branchToMerge, 'feat: add feature-x v2');

    // Ensure main branch exists so merge's push into currentBranch will work
    // Commit something to main if necessary
    const repoBeforeMerge = await gitPage.getRepository();
    if (!repoBeforeMerge.branches || !repoBeforeMerge.branches.main) {
      await gitPage.setCommitMessage('prepare main');
      await gitPage.clickCommitChanges();
    }

    // Now set branchName input to branchToMerge and perform merge
    await gitPage.setBranchName(branchToMerge);
    await gitPage.clickMergeBranches();

    const out = await gitPage.getOutputText();
    expect(out).toContain(`Merged branch '${branchToMerge}' into 'main'.`);

    // Verify commits from branchToMerge were appended to repository.branches['main'] and commitHistory updated
    const repoAfterMerge = await gitPage.getRepository();
    expect(repoAfterMerge.branches['main']).toBeDefined();
    // Check that at least one of the feature commits is now present in main branch
    expect(repoAfterMerge.branches['main'].some(c => c.includes('feature-x'))).toBeTruthy();

    // Edge case: merge a non-existent branch
    const nonExistBranch = 'no-such-branch';
    await gitPage.setBranchName(nonExistBranch);
    await gitPage.clickMergeBranches();
    const out2 = await gitPage.getOutputText();
    expect(out2).toContain(`Branch '${nonExistBranch}' does not exist.`);
  });

  test('View Logs transition (S0_Idle -> S4_LogsViewed) - displays commit history', async () => {
    // Ensure there are some commits in commitHistory by performing two commits
    await gitPage.setCommitMessage('log commit one');
    await gitPage.clickCommitChanges();
    await gitPage.setCommitMessage('log commit two');
    await gitPage.clickCommitChanges();

    // Click view logs and validate the output contains "Commit Logs:" and the commit entries
    await gitPage.clickViewLogs();
    const out = await gitPage.getOutputText();
    expect(out).toContain('Commit Logs:');
    expect(out).toContain('main: log commit one');
    expect(out).toContain('main: log commit two');

    // Additionally validate that the HTML output used <br/> separators as implementation replaces newlines with <br/>
    const html = await gitPage.getOutputHTML();
    // The viewLogs call appends HTML with <br/> - ensure that substring is present at least once
    expect(html.includes('Commit Logs:')).toBeTruthy();
    expect(html.includes('<br/>')).toBeTruthy();
  });

  test('Comprehensive flow: create branch, commit on main, merge feature, view logs and inspect repository', async () => {
    // Create branch 'integration'
    const branch = 'integration';
    await gitPage.setBranchName(branch);
    await gitPage.clickCreateBranch();
    expect(await gitPage.getOutputText()).toContain(`Branch '${branch}' created.`);

    // Add commits to 'integration' directly
    await gitPage.appendDirectToRepository(branch, 'integration commit A');
    await gitPage.appendDirectToRepository(branch, 'integration commit B');

    // Make a commit on main
    await gitPage.setCommitMessage('main commit before merge');
    await gitPage.clickCommitChanges();
    expect(await gitPage.getOutputText()).toContain(`Committed to 'main': main commit before merge`);

    // Merge 'integration' into main
    await gitPage.setBranchName(branch);
    await gitPage.clickMergeBranches();
    expect(await gitPage.getOutputText()).toContain(`Merged branch '${branch}' into 'main'.`);

    // View logs to confirm commitHistory includes expected entries in order
    await gitPage.clickViewLogs();
    const logsText = await gitPage.getOutputText();
    expect(logsText).toContain('Commit Logs:');
    expect(logsText).toContain('main: main commit before merge');
    expect(logsText).toContain('main: integration commit A');
    expect(logsText).toContain('main: integration commit B');

    // Inspect repository for correctness
    const repo = await gitPage.getRepository();
    expect(Array.isArray(repo.commitHistory)).toBeTruthy();
    const messages = repo.commitHistory.map(e => `${e.branch}: ${e.message}`);
    expect(messages).toEqual(expect.arrayContaining([
      'main: main commit before merge',
      'main: integration commit A',
      'main: integration commit B'
    ]));
  });

  test('Console and runtime behavior: ensure no unexpected ReferenceError/SyntaxError/TypeError occurred during interaction', async () => {
    // This test explicitly interacts with the page and then checks console and page errors
    // Perform some interactions
    await gitPage.setBranchName('console-test-branch');
    await gitPage.clickCreateBranch();
    await gitPage.setCommitMessage('console test commit');
    await gitPage.clickCommitChanges();
    await gitPage.clickViewLogs();

    // After interactions, assert that no page errors (uncaught exceptions) were observed
    // NOTE: .afterEach also asserts this, but we assert here explicitly too for clarity
    expect(pageErrors.length).toBe(0);

    // And ensure no console.error messages were emitted
    expect(consoleErrors.length).toBe(0);

    // Also optionally ensure no console messages include 'ReferenceError'/'SyntaxError'/'TypeError' text
    const problematic = consoleMessages.filter(m =>
      /ReferenceError|SyntaxError|TypeError/.test(m.text)
    );
    expect(problematic.length).toBe(0);
  });
});