import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/de3d6044-fa74-11f0-a1b6-4b9b8151441a.html';

// Page object encapsulating common interactions and queries
class VCSPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.makeChange = page.locator('#makeChange');
    this.createBranch = page.locator('#createBranch');
    this.mergeBranch = page.locator('#mergeBranch');
    this.reset = page.locator('#reset');
    this.currentBranch = page.locator('#currentBranch');
    this.fileText = page.locator('#fileText');
    this.commitHistory = page.locator('#commitHistory');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // ensure initial UI render
    await this.page.waitForSelector('#commitHistory');
  }

  async getCurrentBranchText() {
    return (await this.currentBranch.textContent())?.trim();
  }

  async getFileTextContent() {
    // fileText contains a heading and a <pre id="fileText"> element in the DOM; ensure we get the pre text
    return (await this.page.locator('#fileText #fileText, #fileText pre, #fileText').nth(0).textContent())?.trim() ?? (await this.page.locator('#fileText pre, #fileText').textContent())?.trim();
  }

  // Get the number of commits displayed in the history
  async getCommitCount() {
    return await this.page.$$eval('#commitHistory .commit', nodes => nodes.length);
  }

  // Get latest commit title text (most recent commit appears first due to reverse rendering)
  async getLatestCommitTitle() {
    const first = this.page.locator('#commitHistory .commit').first();
    return (await first.locator('.commit-title').textContent())?.trim();
  }

  // Click the Make a Change button
  async clickMakeChange() {
    await this.makeChange.click();
  }

  // Click the Create Branch button
  async clickCreateBranch() {
    await this.createBranch.click();
  }

  // Click the Merge Branch button
  async clickMergeBranch() {
    await this.mergeBranch.click();
  }

  // Click the Reset button
  async clickReset() {
    await this.reset.click();
  }
}

test.describe('Version Control Demonstration - FSM states and transitions', () => {
  let pageErrors;
  let consoleErrors;

  test.beforeEach(async ({ page }) => {
    // Arrays to collect page errors and console error messages for assertions
    pageErrors = [];
    consoleErrors = [];

    page.on('pageerror', (err) => {
      // capture any uncaught errors from the page
      pageErrors.push(err);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
  });

  test.describe('S0_Idle (Initial state) validations', () => {
    test('Initial UI should reflect Idle state with initial commit and file content', async ({ page }) => {
      // Validate initial state: initial commit present, file content shows "Initial content", current branch is main
      const vcs = new VCSPage(page);
      await vcs.goto();

      // Assertions for Idle state (S0_Idle)
      const currentBranchText = await vcs.getCurrentBranchText();
      expect(currentBranchText).toBe('main'); // current branch should be main

      // File content should show "Initial content"
      const fileContent = await page.locator('#fileText pre, #fileText').textContent();
      expect(fileContent).toContain('Initial content');

      // There should be at least 1 commit (the initial commit)
      const commitCount = await vcs.getCommitCount();
      expect(commitCount).toBeGreaterThanOrEqual(1);

      // The most recent commit title should include 'Initial commit' (the constructor created it)
      const latestTitle = await vcs.getLatestCommitTitle();
      expect(latestTitle).toContain('Initial commit');

      // Verify no uncaught page errors or console errors occurred during initial load
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('MakeChange event and S1_ChangeMade transition', () => {
    test('Clicking Make a Change should create a new commit and update file content', async ({ page }) => {
      const vcs1 = new VCSPage(page);
      await vcs.goto();

      const beforeCount = await vcs.getCommitCount();
      const beforeFileText = await page.locator('#fileText pre, #fileText').textContent();

      // Click Make a Change and wait for UI update (commit pushes and updateUI called)
      await vcs.clickMakeChange();

      // After click, commit count should increase by 1
      const afterCount = await vcs.getCommitCount();
      expect(afterCount).toBe(beforeCount + 1);

      // File content should have additional lines appended after the initial content
      const afterFileText = await page.locator('#fileText pre, #fileText').textContent();
      expect(afterFileText.length).toBeGreaterThan(beforeFileText.length);
      expect(afterFileText).toContain('Commit'); // random change appends " (Commit N)" so we expect "Commit" text

      // Latest commit title should match one of the expected change messages (or at least not be "Initial commit")
      const latestTitle1 = await vcs.getLatestCommitTitle();
      expect(latestTitle).not.toBe('Initial commit');

      // Ensure no uncaught page errors or console errors during this transition
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Edge case: multiple rapid Make a Change clicks create multiple commits', async ({ page }) => {
      const vcs2 = new VCSPage(page);
      await vcs.goto();

      const before = await vcs.getCommitCount();

      // Click 3 times rapidly
      await Promise.all([
        vcs.clickMakeChange(),
        vcs.clickMakeChange(),
        vcs.clickMakeChange()
      ]);

      // The commit count should have increased by 3
      const after = await vcs.getCommitCount();
      expect(after).toBeGreaterThanOrEqual(before + 3);

      // No page errors produced by rapid interactions
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('CreateBranch event and S2_BranchCreated transition', () => {
    test('Creating a new branch and switching to it updates current branch (confirm accepted)', async ({ page }) => {
      const vcs3 = new VCSPage(page);
      await vcs.goto();

      // Set up dialog handler: first prompt for branch name -> supply 'feature-x', then confirm -> accept to switch
      page.once('dialog', async (dialog) => {
        // Expect a prompt to enter new branch name
        expect(dialog.type()).toBe('prompt');
        expect(dialog.message()).toContain('Enter new branch name:');
        await dialog.accept('feature-x');
      });

      // The createBranch click will invoke prompt; it will then call confirm to ask switch - intercept that next
      // Listen for the confirm dialog and accept it to switch branches
      const confirmPromise = new Promise((resolve) => {
        page.once('dialog', async (dialog) => {
          expect(dialog.type()).toBe('confirm');
          expect(dialog.message()).toContain("Switch to branch 'feature-x'?");
          await dialog.accept();
          resolve(true);
        });
      });

      await vcs.clickCreateBranch();
      await confirmPromise;

      // After switching, current branch should be 'feature-x'
      const current = await vcs.getCurrentBranchText();
      expect(current).toBe('feature-x');

      // No page errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Creating an existing branch should trigger an alert and not create/switch', async ({ page }) => {
      const vcs4 = new VCSPage(page);
      await vcs.goto();

      // Attempt to create a branch with name 'main' which already exists
      page.once('dialog', async (dialog) => {
        // prompt for name
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('main');
      });

      // The createBranch handler will call vcs.createBranch('main'), which should alert 'Branch already exists!'
      const alertPromise = new Promise((resolve) => {
        page.once('dialog', async (dialog) => {
          expect(dialog.type()).toBe('alert');
          expect(dialog.message()).toContain('Branch already exists!');
          await dialog.accept();
          resolve(true);
        });
      });

      await vcs.clickCreateBranch();
      await alertPromise;

      // Current branch should remain main
      const current1 = await vcs.getCurrentBranchText();
      expect(current).toBe('main');

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('MergeBranch event and S3_BranchMerged transition', () => {
    test('Merging a branch with commits into current branch results in a MERGED: content and merge commit', async ({ page }) => {
      const vcs5 = new VCSPage(page);
      await vcs.goto();

      // 1) Create branch 'feature-merge' and switch to it
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('feature-merge');
      });
      const confirmSwitch = new Promise((resolve) => {
        page.once('dialog', async (dialog) => {
          expect(dialog.type()).toBe('confirm');
          await dialog.accept(); // switch to new branch
          resolve(true);
        });
      });

      await vcs.clickCreateBranch();
      await confirmSwitch;

      // 2) Make a change on 'feature-merge' so the source branch has a commit
      await vcs.clickMakeChange();
      const commitsAfterFeatureChange = await vcs.getCommitCount();
      expect(commitsAfterFeatureChange).toBeGreaterThanOrEqual(2); // at least initial + feature commit

      // 3) Switch back to 'main' using existing in-page API (call checkoutBranch directly)
      // This uses the page's existing method and does not inject new code; it's invoking an existing function.
      const checkoutResult = await page.evaluate(() => {
        try {
          return vcs.checkoutBranch('main');
        } catch (e) {
          // propagate
          return { error: e.message };
        }
      });
      expect(checkoutResult).toBe(true);

      // Ensure current branch is main
      const currentAfterSwitch = await vcs.getCurrentBranchText();
      expect(currentAfterSwitch).toBe('main');

      // 4) Merge 'feature-merge' into main via the Merge Branch button (prompt for branch name)
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        expect(dialog.message()).toContain('Enter branch to merge:');
        await dialog.accept('feature-merge');
      });

      await vcs.clickMergeBranch();

      // After merge, fileText should contain "MERGED:" prefix
      const fileText = await page.locator('#fileText pre, #fileText').textContent();
      expect(fileText).toContain('MERGED:');

      // A merge commit should have been created; latest commit title should reference Merge branch
      const latestTitle2 = await vcs.getLatestCommitTitle();
      expect(latestTitle).toContain("Merge branch 'feature-merge'");

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Merging a non-existent branch should show alert "Source branch does not exist!"', async ({ page }) => {
      const vcs6 = new VCSPage(page);
      await vcs.goto();

      // Provide a non-existent branch name in the prompt
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('nonexistent-branch');
      });

      const alertPromise1 = new Promise((resolve) => {
        page.once('dialog', async (dialog) => {
          expect(dialog.type()).toBe('alert');
          expect(dialog.message()).toContain('Source branch does not exist!');
          await dialog.accept();
          resolve(true);
        });
      });

      await vcs.clickMergeBranch();
      await alertPromise;

      // No uncaught page errors beyond expected alerts
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Attempting to merge the current branch into itself should alert and do nothing', async ({ page }) => {
      const vcs7 = new VCSPage(page);
      await vcs.goto();

      // We're on 'main' initially; attempt to merge 'main' into 'main'
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('main');
      });

      const alertPromise2 = new Promise((resolve) => {
        page.once('dialog', async (dialog) => {
          expect(dialog.type()).toBe('alert');
          expect(dialog.message()).toContain('Cannot merge a branch with itself!');
          await dialog.accept();
          resolve(true);
        });
      });

      await vcs.clickMergeBranch();
      await alertPromise;

      // Ensure current branch remains 'main'
      const current2 = await vcs.getCurrentBranchText();
      expect(current).toBe('main');

      // No uncaught runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Reset event and S4_RepositoryReset transition', () => {
    test('Canceling reset should leave repository state unchanged (confirm dismissed)', async ({ page }) => {
      const vcs8 = new VCSPage(page);
      await vcs.goto();

      // Capture state before attempting reset
      const beforeBranch = await vcs.getCurrentBranchText();
      const beforeFile = await page.locator('#fileText pre, #fileText').textContent();
      const beforeCount1 = await vcs.getCommitCount();

      // Intercept confirm and dismiss (i.e., cancel reset)
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toContain('Reset the entire repository?');
        await dialog.dismiss(); // cancel reset
      });

      await vcs.clickReset();

      // After canceling, state should remain unchanged
      const afterBranch = await vcs.getCurrentBranchText();
      const afterFile = await page.locator('#fileText pre, #fileText').textContent();
      const afterCount1 = await vcs.getCommitCount();

      expect(afterBranch).toBe(beforeBranch);
      expect(afterFile).toBe(beforeFile);
      expect(afterCount).toBe(beforeCount);

      // No uncaught page errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Accepting reset should reload the page and reset repository to initial state', async ({ page }) => {
      const vcs9 = new VCSPage(page);
      await vcs.goto();

      // Make a change so state differs from initial to verify reset effect
      await vcs.clickMakeChange();
      const modifiedCount = await vcs.getCommitCount();
      expect(modifiedCount).toBeGreaterThanOrEqual(2);

      // Handle confirm - accept -> this should trigger window.location.reload()
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('confirm');
        expect(dialog.message()).toContain('Reset the entire repository?');
        await dialog.accept();
      });

      // Wait for navigation caused by reload
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'load' }),
        vcs.clickReset()
      ]);

      // After reload, the page should have reinitialized and the UI should reflect initial state
      const currentBranch = await page.locator('#currentBranch').textContent();
      expect(currentBranch?.trim()).toBe('main');

      const fileText1 = await page.locator('#fileText1 pre, #fileText1').textContent();
      expect(fileText).toContain('Initial content');

      const commitCount1 = await page.$$eval('#commitHistory .commit', nodes => nodes.length);
      // After reload, constructor creates initial commit; expect at least 1 commit
      expect(commitCount).toBeGreaterThanOrEqual(1);

      // No uncaught page errors produced during reset flow
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Observability of updateUI entry actions and robustness checks', () => {
    test('updateUI is invoked indirectly (DOM updates reflect entry_actions on state transitions)', async ({ page }) => {
      const vcs10 = new VCSPage(page);
      await vcs.goto();

      const beforeCommitCount = await vcs.getCommitCount();

      // Make a change; updateUI is called inside commit -> DOM should update
      await vcs.clickMakeChange();

      const afterCommitCount = await vcs.getCommitCount();
      expect(afterCommitCount).toBe(beforeCommitCount + 1);

      // The currentBranch element should be updated by updateUI (no error in reading)
      const current3 = await vcs.getCurrentBranchText();
      expect(current).toBeDefined();

      // No page errors indicating updateUI failures
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Edge case: invoking createBranch with empty input should do nothing', async ({ page }) => {
      const vcs11 = new VCSPage(page);
      await vcs.goto();

      // Provide an empty string via prompt -> handler in page should not create branch
      page.once('dialog', async (dialog) => {
        expect(dialog.type()).toBe('prompt');
        await dialog.accept('   '); // blank input (spaces)
      });

      // No subsequent confirm should be shown; perform click and ensure no confirm/alert
      await vcs.clickCreateBranch();

      // Ensure still on main and commit count unchanged (i.e., nothing created)
      const current4 = await vcs.getCurrentBranchText();
      expect(current).toBe('main');

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });
});