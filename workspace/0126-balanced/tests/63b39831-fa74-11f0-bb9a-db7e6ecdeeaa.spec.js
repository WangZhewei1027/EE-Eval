import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b39831-fa74-11f0-bb9a-db7e6ecdeeaa.html';

test.describe('Version Control Demonstration - FSM end-to-end tests', () => {
  // Collect console messages and page errors for each test run
  let consoleMessages;
  let pageErrors;

  test.beforeEach(async ({ page }) => {
    // Initialize collectors
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', error => {
      pageErrors.push(error);
    });

    // Navigate to the app (load page exactly as-is)
    await page.goto(APP_URL, { waitUntil: 'load' });

    // Basic sanity: wait for editor to be present
    await expect(page.locator('#editor')).toBeVisible();
  });

  test.afterEach(async () => {
    // Assert there were no uncaught page errors during the test
    // This verifies whether runtime ReferenceError/SyntaxError/TypeError happened naturally
    expect(pageErrors.length, `Expected no page errors, got: ${pageErrors.map(e => e.message).join('\n')}`).toBe(0);

    // Also assert there are no console error messages
    const consoleErrors = consoleMessages.filter(m => m.type === 'error' || m.type === 'warning');
    expect(consoleErrors.length, `Expected no console errors/warnings, got: ${consoleErrors.map(c => c.text).join('\n')}`).toBe(0);
  });

  test.describe('Initial state (S0_Idle) and entry actions', () => {
    test('should render initial UI correctly (Idle state)', async ({ page }) => {
      // Validate entry evidence: commitBtn.disabled = true, revertBtn.disabled = true, versionLabel 'No commits yet'
      const commitBtn = page.locator('#commitBtn');
      const revertBtn = page.locator('#revertBtn');
      const versionLabel = page.locator('#versionLabel');
      const commitList = page.locator('#commitList');
      const diffOutput = page.locator('#diffOutput');

      await expect(commitBtn).toBeDisabled();
      await expect(revertBtn).toBeDisabled();
      await expect(versionLabel).toHaveText('No commits yet');
      await expect(commitList).toBeEmpty();
      // diffOutput initially hidden (style display:none)
      expect(await diffOutput.evaluate(el => window.getComputedStyle(el).display)).toBe('none');
    });
  });

  test.describe('Editing and enabling commit (S1_Editing -> S2_CommitReady)', () => {
    test('typing and commit message enable Commit button when valid (Commit Ready)', async ({ page }) => {
      const editor = page.locator('#editor');
      const commitMessage = page.locator('#commitMessage');
      const commitBtn1 = page.locator('#commitBtn1');

      // Initially disabled
      await expect(commitBtn).toBeDisabled();

      // Type content into editor (S1_Editing)
      await editor.fill('Hello World\nThis is the first version.');
      // Commit message input triggers updateCommitButton
      await commitMessage.fill('First commit');

      // Now commitBtn should be enabled (S2_CommitReady) because commits.length === 0 and non-empty text+message
      await expect(commitBtn).toBeEnabled();

      // Also ensure no commits exist yet
      await expect(page.locator('.commit')).toHaveCount(0);
    });

    test('commit button remains disabled if editor empty or commit message empty (edge cases)', async ({ page }) => {
      const editor1 = page.locator('#editor1');
      const commitMessage1 = page.locator('#commitMessage1');
      const commitBtn2 = page.locator('#commitBtn2');

      // Edge: empty editor
      await editor.fill('');
      await commitMessage.fill('Some message');
      await expect(commitBtn).toBeDisabled();

      // Edge: empty message
      await editor.fill('Non-empty text');
      await commitMessage.fill('');
      await expect(commitBtn).toBeDisabled();
    });
  });

  test.describe('Making commits and UI updates (S2_CommitReady -> S3_CommitMade)', () => {
    test('committing updates commit list, version label, and focuses editor', async ({ page }) => {
      const editor2 = page.locator('#editor2');
      const commitMessage2 = page.locator('#commitMessage2');
      const commitBtn3 = page.locator('#commitBtn3');
      const commitList1 = page.locator('#commitList1');
      const versionLabel1 = page.locator('#versionLabel1');
      const diffOutput1 = page.locator('#diffOutput1');

      // Prepare and make first commit
      await editor.fill('Line A\nLine B');
      await commitMessage.fill('First commit');
      await expect(commitBtn).toBeEnabled();

      await commitBtn.click();

      // After commit (S3_CommitMade):
      // - A commit element is rendered
      await expect(page.locator('.commit')).toHaveCount(1);
      // - Commit message input is cleared and commit button disabled
      await expect(commitMessage).toHaveValue('');
      await expect(commitBtn).toBeDisabled();
      // - versionLabel shows the latest commit message
      await expect(versionLabel).toContainText('Latest commit: "First commit"');
      // - diffOutput hidden after commit
      expect(await diffOutput.evaluate(el => window.getComputedStyle(el).display)).toBe('none');
      // - editor focused after commit (commit handler calls editor.focus())
      const activeId = await page.evaluate(() => document.activeElement && document.activeElement.id);
      expect(activeId).toBe('editor');

      // Ensure commit list item text contains message
      const commitItemText = await page.locator('.commit').first().textContent();
      expect(commitItemText).toContain('First commit');
    });

    test('subsequent input returns to Editing (S3_CommitMade -> S1_Editing) and disables commit when unchanged', async ({ page }) => {
      const editor3 = page.locator('#editor3');
      const commitMessage3 = page.locator('#commitMessage3');
      const commitBtn4 = page.locator('#commitBtn4');

      // Ensure there's at least one commit (create if needed)
      const commitCount = await page.locator('.commit').count();
      if (commitCount === 0) {
        await editor.fill('Initial text');
        await commitMessage.fill('Init');
        await page.locator('#commitBtn').click();
      }

      // Now change nothing: commitBtn should remain disabled even if commitMessage filled, because text equals last commit
      await commitMessage.fill('Another message');
      await expect(commitBtn).toBeDisabled();

      // Edit editor -> should re-enable/disable depending on difference
      await editor.fill('Changed text'); // S1_Editing
      await expect(commitBtn).toBeDisabled(); // message empty currently
      await commitMessage.fill('Second commit');
      await expect(commitBtn).toBeEnabled(); // now enabled because text differs from last commit
    });
  });

  test.describe('Selecting commits and showing diffs (S1_Editing -> S4_CommitSelected)', () => {
    test('selecting commit via click shows diff and enables revert (Commit Selected)', async ({ page }) => {
      const editor4 = page.locator('#editor4');
      const commitMessage4 = page.locator('#commitMessage4');
      const commitBtn5 = page.locator('#commitBtn5');
      const commitList2 = page.locator('#commitList2');
      const diffOutput2 = page.locator('#diffOutput2');
      const revertBtn1 = page.locator('#revertBtn1');
      const versionLabel2 = page.locator('#versionLabel2');

      // Ensure we have two commits to make diffs meaningful
      // Create first commit if none
      if ((await page.locator('.commit').count()) === 0) {
        await editor.fill('Alpha\nBeta\nGamma');
        await commitMessage.fill('Commit One');
        await commitBtn.click();
      }

      // Create second commit with different text
      await editor.fill('Alpha\nBeta\nGamma\nDelta');
      await commitMessage.fill('Commit Two');
      await commitBtn.click();

      // Now editor currently equals last commit text. Select the first commit (index 0) via click
      const firstCommit = page.locator('.commit').first();
      await firstCommit.click();

      // After selecting:
      // - diffOutput should be visible
      await expect(diffOutput).toBeVisible();
      // - revertBtn enabled
      await expect(revertBtn).toBeEnabled();
      // - versionLabel updated to "Selected commit:"
      await expect(versionLabel).toContainText('Selected commit: "');

      // Diff should contain removed lines (the first commit lacks Delta) or context lines
      const diffHtml = await diffOutput.innerHTML();
      expect(diffHtml.length).toBeGreaterThan(0);
      // Expect either an added/removed indicator in diff output (span classes)
      expect(diffHtml).toMatch(/diff-(added|removed|context)/);

      // Ensure the active commit element has .active class (renderCommitList adds active)
      const activeExists = await page.locator('.commit.active').count();
      expect(activeExists).toBeGreaterThan(0);
    });

    test('selecting commit via keyboard (Enter) triggers same behavior (CommitKeySelect)', async ({ page }) => {
      const editor5 = page.locator('#editor5');
      const commitMessage5 = page.locator('#commitMessage5');
      const commitBtn6 = page.locator('#commitBtn6');
      const diffOutput3 = page.locator('#diffOutput3');
      const revertBtn2 = page.locator('#revertBtn2');

      // Ensure at least one commit exists
      if ((await page.locator('.commit').count()) === 0) {
        await editor.fill('Keyboard test');
        await commitMessage.fill('KB Commit');
        await commitBtn.click();
      }

      const commitItem = page.locator('.commit').first();
      // Focus the commit item and press Enter
      await commitItem.focus();
      await page.keyboard.press('Enter');

      await expect(diffOutput).toBeVisible();
      await expect(revertBtn).toBeEnabled();
    });
  });

  test.describe('Reverting to a commit (S4_CommitSelected -> S5_Reverted)', () => {
    test('revert replaces editor text with selected commit text and updates version label', async ({ page }) => {
      const editor6 = page.locator('#editor6');
      const commitMessage6 = page.locator('#commitMessage6');
      const commitBtn7 = page.locator('#commitBtn7');
      const revertBtn3 = page.locator('#revertBtn3');
      const commitItems = page.locator('.commit');
      const versionLabel3 = page.locator('#versionLabel3');
      const diffOutput4 = page.locator('#diffOutput4');

      // Prepare two commits with distinct text so revert is observable
      await editor.fill('Original line');
      await commitMessage.fill('Original commit');
      await commitBtn.click();

      await editor.fill('Modified line');
      await commitMessage.fill('Modified commit');
      await commitBtn.click();

      // Select the first commit (Original commit)
      await commitItems.nth(0).click();

      // Click revert to selected commit
      await expect(revertBtn).toBeEnabled();
      await revertBtn.click();

      // After revert, editor.value should equal the selected commit text
      const editorValue = await editor.inputValue();
      expect(editorValue).toBe('Original line');

      // versionLabel should indicate revert
      await expect(versionLabel).toContainText('Reverted to commit: "Original commit"');

      // revertBtn should be disabled after revert and selectedCommitIndex cleared -> commit list not active
      await expect(revertBtn).toBeDisabled();
      const activeCount = await page.locator('.commit.active').count();
      expect(activeCount).toBe(0);

      // diffOutput hidden after revert
      expect(await diffOutput.evaluate(el => window.getComputedStyle(el).display)).toBe('none');
    });

    test('attempting to revert when no commit selected has no effect (edge case)', async ({ page }) => {
      const editor7 = page.locator('#editor7');
      const revertBtn4 = page.locator('#revertBtn4');
      const versionLabel4 = page.locator('#versionLabel4');

      // Ensure no selection: select none and ensure revertBtn disabled
      // If revertBtn is enabled (rare), try to clear selection by editing text
      if (await revertBtn.isEnabled()) {
        // Make a change to clear selection as app does on editor input
        await editor.fill((await editor.inputValue()) + '\n ');
      }
      await expect(revertBtn).toBeDisabled();

      // Capture version label before clicking (should remain unchanged)
      const before = await versionLabel.textContent();

      // Try clicking the disabled revert button: Playwright permits click but no handler should run
      // Use try/catch to ensure test doesn't fail due to Playwright's strictness if clicking disabled element is blocked.
      try {
        await revertBtn.click({ timeout: 500 }).catch(() => {});
      } catch {
        // ignore any click rejection - primary assertion is that state didn't change
      }

      const after = await versionLabel.textContent();
      expect(after).toBe(before);
    });
  });

  test.describe('Combined flows and transition coverage', () => {
    test('full scenario: create commit, edit, create second commit, select first, revert, edit again (covers many transitions)', async ({ page }) => {
      const editor8 = page.locator('#editor8');
      const commitMessage7 = page.locator('#commitMessage7');
      const commitBtn8 = page.locator('#commitBtn8');
      const revertBtn5 = page.locator('#revertBtn5');
      const commitItems1 = page.locator('.commit');
      const versionLabel5 = page.locator('#versionLabel5');

      // Start fresh edits and commits
      await editor.fill('State A');
      await commitMessage.fill('Commit A');
      await commitBtn.click();

      // Edit to new content, prepare second commit
      await editor.fill('State B');
      await commitMessage.fill('Commit B');
      await commitBtn.click();

      // Now select commit A (index 0)
      await commitItems.nth(0).click();
      await expect(versionLabel).toContainText('Selected commit: "Commit A"');
      await expect(revertBtn).toBeEnabled();

      // Revert to commit A
      await revertBtn.click();
      await expect(versionLabel).toContainText('Reverted to commit: "Commit A"');

      // Now in S5_Reverted. Editing should transition to S1_Editing and update UI accordingly
      await editor.fill('State A modified after revert');
      // commitMessage empty, so commitBtn disabled
      await expect(commitBtn).toBeDisabled();

      // Provide message and commit again
      await commitMessage.fill('Commit C');
      await expect(commitBtn).toBeEnabled();
      await commitBtn.click();

      // After commit, commit list should have 3 commits and version label updated
      await expect(page.locator('.commit')).toHaveCount(3);
      await expect(versionLabel).toContainText('Latest commit: "Commit C"');
    });
  });

  test.describe('Accessibility & DOM semantics', () => {
    test('commit list has role list and each commit is a listitem with keyboard focusable element', async ({ page }) => {
      const commitList3 = page.locator('#commitList3');
      const commitItems2 = page.locator('.commit');

      // Create a commit if none exist
      if ((await commitItems.count()) === 0) {
        await page.locator('#editor').fill('A11y Test');
        await page.locator('#commitMessage').fill('A11y Commit');
        await page.locator('#commitBtn').click();
      }

      // commitList role
      const role = await commitList.getAttribute('role');
      expect(role).toBe('list');

      // Each commit should have role listitem and be focusable (tabIndex=0)
      const first = commitItems.first();
      await expect(first).toHaveAttribute('role', 'listitem');
      const tabIndex = await first.getAttribute('tabindex');
      // In JS .tabIndex = 0 might render as "0" or absent; use evaluate to be precise
      const tabIndexEval = await first.evaluate(el => el.tabIndex);
      expect(tabIndexEval).toBe(0);
    });
  });
});