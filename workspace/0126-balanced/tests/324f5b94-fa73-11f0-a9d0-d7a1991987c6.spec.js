import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/324f5b94-fa73-11f0-a9d0-d7a1991987c6.html';

/**
 * Page Object for the simple Git Concept Demo application.
 * Encapsulates common operations and selectors to keep tests readable.
 */
class RepoPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.commitHistory = page.locator('#commitHistory');
    this.commitMessageInput = page.locator('#commitMessage');
    this.commitButton = page.locator('#commitButton');
    this.resetButton = page.locator('#resetButton');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
  }

  async getHistoryText() {
    return (await this.commitHistory.textContent()) ?? '';
  }

  async getCommitMessageValue() {
    return (await this.commitMessageInput.inputValue()) ?? '';
  }

  async fillCommitMessage(text) {
    await this.commitMessageInput.fill(text);
  }

  async clickCommit() {
    await this.commitButton.click();
  }

  async clickReset() {
    await this.resetButton.click();
  }

  async addCommit(message) {
    await this.fillCommitMessage(message);
    await this.clickCommit();
  }

  async waitForHistoryContains(text, timeout = 2000) {
    await this.page.waitForFunction(
      (selector, expected) => {
        const el = document.querySelector(selector);
        return el && el.textContent.includes(expected);
      },
      this.commitHistory.selector(),
      text,
      { timeout }
    );
  }
}

// Collect console errors and page errors per test run
let consoleErrors = [];
let pageErrors = [];

// Attach listeners before each test and navigate to the app
test.beforeEach(async ({ page }) => {
  consoleErrors = [];
  pageErrors = [];

  page.on('console', (msg) => {
    // Capture console error messages for later assertions
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (err) => {
    // Capture unhandled exceptions from the page
    pageErrors.push(err);
  });

  // Navigate to the page under test
  await page.goto(APP_URL, { waitUntil: 'load' });
});

test.afterEach(async () => {
  // Basic sanity: ensure no unexpected console or page errors were recorded.
  // These assertions help detect runtime ReferenceError/SyntaxError/TypeError if they occur.
  expect(pageErrors, 'No page errors should occur during test').toHaveLength(0);
  expect(consoleErrors, 'No console.errors should be emitted during test').toHaveLength(0);
});

test.describe('Git Concept Demo - FSM validation and DOM behavior', () => {
  // Validate initial state and "onEnter" behavior (updateCommitHistory called on load)
  test('Initial State: commit history shows "No commits yet."', async ({ page }) => {
    // This test validates the S0_Initial state's entry action (updateCommitHistory)
    const repo = new RepoPage(page);

    // Confirm elements exist
    await expect(repo.commitHistory).toBeVisible();
    await expect(repo.commitMessageInput).toBeVisible();
    await expect(repo.commitButton).toBeVisible();
    await expect(repo.resetButton).toBeVisible();

    // Initial commit history should be 'No commits yet.' as a result of updateCommitHistory()
    const historyText = await repo.getHistoryText();
    expect(historyText.trim()).toBe('No commits yet.');
  });

  // Validate the Commit transition from S0_Initial -> S1_Committed
  test('Commit Transition: adding a commit updates history and clears input', async ({ page }) => {
    // This test validates the Commit event and the transition actions:
    // commits.push(...) and updateCommitHistory()
    const repo1 = new RepoPage(page);

    // Add first commit
    await repo.addCommit('Initial commit message');

    // Verify commit history updated and input cleared
    await repo.waitForHistoryContains('Commit 1: Initial commit message');
    const historyAfter1 = await repo.getHistoryText();
    expect(historyAfter1).toContain('Commit 1: Initial commit message');

    const inputValueAfter1 = await repo.getCommitMessageValue();
    expect(inputValueAfter1).toBe(''); // The implementation clears the input on successful commit

    // Add second commit to validate commitCount increments and multiple lines are shown
    await repo.addCommit('Second commit');
    await repo.waitForHistoryContains('Commit 2: Second commit');

    const historyAfter2 = await repo.getHistoryText();
    // Ensure both commits are present and in the correct order
    const lines = historyAfter2.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(lines[0]).toBe('Commit 1: Initial commit message');
    expect(lines[1]).toBe('Commit 2: Second commit');
  });

  // Edge case: clicking commit with empty input should trigger an alert and not change history
  test('Edge Case: empty commit message triggers alert and does not change history', async ({ page }) => {
    // This test validates that when commitMessage is empty the UI alerts the user
    // and no commit is added (transition should not occur).
    const repo2 = new RepoPage(page);

    // Ensure starting point has no commits
    const initialHistory = await repo.getHistoryText();
    expect(initialHistory.trim()).toBe('No commits yet.');

    // Listen for the dialog (alert) and assert its message
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      // Click commit without typing anything
      repo.clickCommit(),
    ]);

    try {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Please enter a commit message.');
    } finally {
      await dialog.dismiss();
    }

    // After dismissing, ensure history remains unchanged
    const historyAfterAlert = await repo.getHistoryText();
    expect(historyAfterAlert.trim()).toBe('No commits yet.');
  });

  // Validate Reset transition from S1_Committed -> S0_Initial
  test('Reset Transition: clears commit history and resets commit numbering', async ({ page }) => {
    // This test validates the Reset event and its transition actions:
    // commits = []; commitCount = 0; updateCommitHistory()
    const repo3 = new RepoPage(page);

    // Create two commits first to move into Committed state
    await repo.addCommit('Commit A');
    await repo.waitForHistoryContains('Commit 1: Commit A');
    await repo.addCommit('Commit B');
    await repo.waitForHistoryContains('Commit 2: Commit B');

    // Now click reset
    await repo.clickReset();

    // After reset, history should read 'No commits yet.'
    await page.waitForFunction(
      (selector) => (document.querySelector(selector)?.textContent ?? '').trim() === 'No commits yet.',
      repo.commitHistory.selector()
    );
    const historyAfterReset = await repo.getHistoryText();
    expect(historyAfterReset.trim()).toBe('No commits yet.');

    // Add a new commit to ensure commitCount was reset to 0 (so next commit becomes Commit 1)
    await repo.addCommit('Post-reset commit');
    await repo.waitForHistoryContains('Commit 1: Post-reset commit');
    const historyFinal = await repo.getHistoryText();
    expect(historyFinal).toContain('Commit 1: Post-reset commit');
    // Ensure only one line exists now (previous commits were cleared)
    const finalLines = historyFinal.split('\n').map((l) => l.trim()).filter(Boolean);
    expect(finalLines.length).toBe(1);
  });

  // Validate that updateCommitHistory (entry action) is called both on load and after commits
  test('Entry actions: updateCommitHistory called on load and after commit (observable via DOM)', async ({ page }) => {
    // The FSM describes updateCommitHistory() as an entry action for both states.
    // We validate its effects by observing the commitHistory DOM output after load and after a commit.
    const repo4 = new RepoPage(page);

    // On load (S0_Initial) commitHistory must be populated by updateCommitHistory()
    const initialText = await repo.getHistoryText();
    expect(initialText.trim()).toBe('No commits yet.');

    // After making a commit, updateCommitHistory should run again and reflect the new commit
    await repo.addCommit('Check entry action');
    await repo.waitForHistoryContains('Commit 1: Check entry action');

    const afterCommitText = await repo.getHistoryText();
    expect(afterCommitText).toContain('Commit 1: Check entry action');
  });

  // Validate that the page produces no runtime JS errors across a sequence of interactions
  test('Stability: sequence of interactions should not produce JS errors', async ({ page }) => {
    // This test performs multiple interactions and at the end asserts no page errors or console errors were emitted.
    const repo5 = new RepoPage(page);

    // Perform a series of interactions
    await repo.addCommit('Stable commit 1');
    await repo.addCommit('Stable commit 2');
    // Trigger the empty commit alert
    const dialogPromise = page.waitForEvent('dialog');
    await repo.clickCommit(); // empty input triggers alert
    const dialog = await dialogPromise;
    await dialog.dismiss();

    // Reset and add again
    await repo.clickReset();
    await repo.addCommit('Stable commit after reset');

    // Final assertions: ensure DOM is in expected state
    const history = await repo.getHistoryText();
    expect(history).toContain('Commit 1: Stable commit after reset');

    // pageErrors and consoleErrors arrays are asserted in test.afterEach to be empty.
  });
});