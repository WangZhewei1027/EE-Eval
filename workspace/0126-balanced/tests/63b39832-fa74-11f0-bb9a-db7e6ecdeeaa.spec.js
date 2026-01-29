import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-balanced/html/63b39832-fa74-11f0-bb9a-db7e6ecdeeaa.html';

// Helper to attach dialog handler that uses a queue of responses for prompts/confirms
async function attachDialogHandler(page, responseQueue, recordedDialogs) {
  // responseQueue is an array of objects like:
  // { type: 'prompt'|'confirm'|'alert', input?: 'text', accept?: boolean }
  page.on('dialog', async (dialog) => {
    recordedDialogs.push({
      type: dialog.type(),
      message: dialog.message(),
      defaultValue: dialog.defaultValue?.(),
    });
    // Determine next response in queue, if any
    const next = responseQueue.length > 0 ? responseQueue.shift() : undefined;
    try {
      if (dialog.type() === 'prompt') {
        // Use provided input or empty string if none
        const input = next && typeof next.input !== 'undefined' ? next.input : '';
        await dialog.accept(input);
      } else if (dialog.type() === 'confirm') {
        // If specified accept===true -> accept, else dismiss
        const accept = next && typeof next.accept !== 'undefined' ? next.accept : true;
        if (accept) await dialog.accept();
        else await dialog.dismiss();
      } else {
        // alert dialog - just accept
        await dialog.accept();
      }
    } catch (e) {
      // swallow - Playwright may throw if dialog already handled; we don't modify environment
    }
  });
}

test.describe('Git Concept Demonstration - FSM tests (63b39832-fa74-11f0-bb9a-db7e6ecdeeaa)', () => {
  // Capture console messages and page errors per test
  test.beforeEach(async ({ page }) => {
    // Nothing global here - each test will navigate and set up handlers as needed
    page.on('console', (msg) => {
      // keep defaults; tests will inspect console via provided arrays if they set up captures
    });
  });

  // Test S0 Idle - initial render
  test('Initial render - Idle state has expected UI elements and no JS errors', async ({ page }) => {
    const consoleEntries = [];
    const pageErrors = [];
    page.on('console', (m) => consoleEntries.push({ type: m.type(), text: m.text() }));
    page.on('pageerror', (err) => pageErrors.push(err.message));

    await page.goto(APP_URL);

    // Verify current branch is rendered as 'master'
    const currentBranch = await page.locator('#current-branch').innerText();
    expect(currentBranch).toBe('master');

    // Verify files list indicates no files
    const filesListText = await page.locator('#files-list').innerText();
    expect(filesListText).toContain('No files in working directory.');

    // Verify status shows clean working directory and no staged files
    const statusText = await page.locator('#status').innerText();
    expect(statusText).toContain('Working directory clean');
    expect(statusText).toContain('No files staged');

    // Verify log is empty / shows no commits yet when requested
    await page.click('#btn-log');
    const logText = await page.locator('#log').innerText();
    expect(logText).toBe('No commits yet.');

    // Assert no uncaught page errors and no console error messages
    expect(pageErrors).toHaveLength(0);
    const consoleErrors = consoleEntries.filter(c => c.type === 'error');
    expect(consoleErrors).toHaveLength(0);
  });

  // Test transition: AddFile -> FileAdded
  test('Add / Modify File triggers File Added state, updates files list and status', async ({ page }) => {
    const recordedDialogs = [];
    const responses = []; // alerts will be auto-accepted; no prompt/confirm in this flow
    page.on('pageerror', (err) => {
      // let errors surface if any; test will assert none at end implicitly by checking array length
    });
    await attachDialogHandler(page, responses, recordedDialogs);
    await page.goto(APP_URL);

    // Fill file name and content, and click add
    await page.fill('#file-name', 'index.html');
    await page.fill('#file-content', '<h1>Hello</h1>');
    await page.click('#btn-add-file');

    // One alert should have fired with message indicating file added/modified
    expect(recordedDialogs.length).toBeGreaterThanOrEqual(1);
    const lastAlert = recordedDialogs[recordedDialogs.length - 1];
    expect(lastAlert.type).toBe('alert');
    expect(lastAlert.message).toContain('File "index.html" added/modified in working directory.');

    // Files list should show the new file
    const filesList = await page.locator('#files-list').innerText();
    expect(filesList).toContain('index.html');

    // Status should show "Added files: index.html" and "No files staged."
    const status = await page.locator('#status').innerText();
    expect(status).toContain('Added files: index.html');
    expect(status).toContain('No files staged.');
  });

  // Test transition: StageFile from FileAdded -> FileStaged
  test('Staging a file transitions to File Staged and updates status', async ({ page }) => {
    const recordedDialogs1 = [];
    const responses1 = []; // no prompt/confirm
    await attachDialogHandler(page, responses, recordedDialogs);
    await page.goto(APP_URL);

    // Prepare: add a file first
    await page.fill('#file-name', 'app.js');
    await page.fill('#file-content', 'console.log("app");');
    await page.click('#btn-add-file');
    // consume the alert
    expect(recordedDialogs.pop()?.message).toContain('app.js');

    // Stage the file
    await page.fill('#file-name', 'app.js'); // ensure filename is set
    await page.click('#btn-stage');

    // Expect an alert that file staged
    expect(recordedDialogs.length).toBeGreaterThanOrEqual(1);
    const stagedAlert = recordedDialogs[recordedDialogs.length - 1];
    expect(stagedAlert.type).toBe('alert');
    expect(stagedAlert.message).toContain('File "app.js" staged.');

    // Status should now mention staged files
    const status1 = await page.locator('#status1').innerText();
    expect(status).toContain('Staged files: app.js');
  });

  // Test transition: Commit from FileStaged -> CommitSuccessful
  test('Committing staged files creates a commit and updates status and files (Commit Successful)', async ({ page }) => {
    const recordedDialogs2 = [];
    const responses2 = []; // no prompt/confirm in this flow
    await attachDialogHandler(page, responses, recordedDialogs);
    await page.goto(APP_URL);

    // Add and stage
    await page.fill('#file-name', 'readme.md');
    await page.fill('#file-content', 'Readme contents');
    await page.click('#btn-add-file');
    recordedDialogs.pop(); // consume add alert

    await page.fill('#file-name', 'readme.md');
    await page.click('#btn-stage');
    recordedDialogs.pop(); // consume stage alert

    // Attempt commit without commit message -> should alert to provide message
    await page.click('#btn-commit');
    // Because commit-msg is empty, an alert should appear asking to enter commit message
    // But we didn't capture dialogs prior to this assertion; check last recorded alert
    const commitMessagePrompt = recordedDialogs[recordedDialogs.length - 1];
    expect(commitMessagePrompt.type).toBe('alert');
    expect(commitMessagePrompt.message).toContain('Please enter a commit message.');

    // Now provide commit message and commit
    await page.fill('#commit-msg', 'Add readme');
    await page.click('#btn-commit');

    // Should receive an alert that commit successful
    const commitAlert = recordedDialogs[recordedDialogs.length - 1];
    expect(commitAlert.type).toBe('alert');
    expect(commitAlert.message).toContain('Commit successful on branch "master".');

    // Status should indicate working directory clean and no staged files
    const status2 = await page.locator('#status2').innerText();
    expect(status).toContain('Working directory clean');
    expect(status).toContain('No files staged');

    // Log should contain commit entry after clicking Show Log
    await page.click('#btn-log');
    const logText1 = await page.locator('#log').innerText();
    expect(logText).toContain('commit C'); // commit hash starts with C#
    expect(logText).toContain('Add readme');
  });

  // Creating a branch (without immediate checkout) - S0 -> S4 (BranchCreated)
  test('Create a new branch but do NOT checkout immediately (Branch Created, remain on master)', async ({ page }) => {
    const recordedDialogs3 = [];
    // First dialog is prompt for branch name (provide 'feature-x'), an alert will follow (auto-accepted),
    // then a confirm will appear asking whether to checkout; respond with dismiss -> do not checkout
    const responses3 = [
      { type: 'prompt', input: 'feature-x' },
      // alert will be auto-accepted, no entry required
      { type: 'confirm', accept: false },
    ];
    await attachDialogHandler(page, responses, recordedDialogs);
    await page.goto(APP_URL);

    // Click create branch
    await page.click('#btn-create-branch');

    // Ensure we recorded a prompt and an alert for branch creation
    const promptEntry = recordedDialogs.find(d => d.type === 'prompt' && d.message.includes('Enter new branch name:') === false);
    // The page's prompt message is 'Enter new branch name:' - recorded as prompt
    const promptDialogs = recordedDialogs.filter(d => d.type === 'prompt');
    expect(promptDialogs.length).toBeGreaterThanOrEqual(1);
    // The alert with branch creation:
    const alertDialog = recordedDialogs.find(d => d.type === 'alert' && d.message.includes('Branch "feature-x" created.'));
    expect(alertDialog).toBeTruthy();

    // Since we chose not to checkout, current branch should remain 'master'
    const currentBranch1 = await page.locator('#current-branch').innerText();
    expect(currentBranch).toBe('master');
  });

  // Creating a branch and checking out immediately - S0 -> S4 -> (checkout inside CreateBranch) -> S5
  test('Create a new branch and checkout immediately (Branch Created and Branch Checked Out)', async ({ page }) => {
    const recordedDialogs4 = [];
    // Prompt for branch name then accept confirm to checkout
    const responses4 = [
      { type: 'prompt', input: 'feature-y' },
      { type: 'confirm', accept: true },
    ];
    await attachDialogHandler(page, responses, recordedDialogs);
    await page.goto(APP_URL);

    await page.click('#btn-create-branch');

    // After sequence, we should have alert for branch creation then confirm accepted and UI updated
    const branchCreatedAlert = recordedDialogs.find(d => d.type === 'alert' && d.message.includes('Branch "feature-y" created.'));
    expect(branchCreatedAlert).toBeTruthy();

    // After checkout, current-branch should update to 'feature-y'
    const currentBranch2 = await page.locator('#current-branch').innerText();
    expect(currentBranch).toBe('feature-y');
  });

  // Checkout branch by clicking current branch span (S4 -> S5)
  test('Checkout an existing branch via current branch click (Branch Checked Out)', async ({ page }) => {
    const recordedDialogs5 = [];
    await page.goto(APP_URL);

    // Create a branch first and checkout it to ensure it exists (use dialog responses)
    const createResponses = [
      { type: 'prompt', input: 'temp-branch' },
      { type: 'confirm', accept: false }, // don't checkout now
    ];
    await attachDialogHandler(page, createResponses, recordedDialogs);
    await page.click('#btn-create-branch');
    // Clear recordedDialogs for the next flow
    recordedDialogs.length = 0;

    // Now click the current-branch span to trigger branch selection prompt
    // The prompt shows available branches; we will respond with 'temp-branch' to checkout
    const checkoutResponses = [
      { type: 'prompt', input: 'temp-branch' }, // respond to the branch selection prompt
    ];
    // Reattach a fresh handler for this test part by adding another listener (this will accumulate handlers,
    // but each will run; to avoid duplicates we create a new page or rely on captured dialogs. For simplicity,
    // we'll add a one-off listener that consumes checkoutResponses.)
    const oneOffCheckoutRecorded = [];
    await attachDialogHandler(page, checkoutResponses, oneOffCheckoutRecorded);

    await page.click('#current-branch');

    // The oneOffCheckoutRecorded should include a prompt and the subsequent alert for checkout
    const prompt = oneOffCheckoutRecorded.find(d => d.type === 'prompt');
    expect(prompt).toBeTruthy();

    // The checkout alert must have fired
    // Wait briefly for the alert to be recorded (should be synchronous because dialog handler accepts)
    const checkoutAlert = oneOffCheckoutRecorded.find(d => d.type === 'alert' && d.message.includes('Checked out branch "temp-branch".'));
    expect(checkoutAlert).toBeTruthy();

    // Verify UI updated: current branch text is 'temp-branch'
    const currentBranch3 = await page.locator('#current-branch').innerText();
    expect(currentBranch).toBe('temp-branch');
  });

  // Edge case: Attempt to stage a non-existent file
  test('Staging a non-existent file shows an error alert', async ({ page }) => {
    const recordedDialogs6 = [];
    const responses5 = []; // alerts auto-accepted
    await attachDialogHandler(page, responses, recordedDialogs);
    await page.goto(APP_URL);

    // Ensure file input is set to a name that doesn't exist
    await page.fill('#file-name', 'doesnotexist.txt');
    await page.click('#btn-stage');

    // Expect an alert indicating file does not exist
    expect(recordedDialogs.length).toBeGreaterThanOrEqual(1);
    const last = recordedDialogs[recordedDialogs.length - 1];
    expect(last.type).toBe('alert');
    expect(last.message).toContain('File "doesnotexist.txt" does not exist in working directory.');
  });

  // Edge case: Commit with empty commit message and also commit with no staged files
  test('Commit validations: empty commit message and nothing to commit scenarios', async ({ page }) => {
    const recordedDialogs7 = [];
    const responses6 = []; // alerts auto-accepted
    await attachDialogHandler(page, responses, recordedDialogs);
    await page.goto(APP_URL);

    // Case 1: Try to commit when no staged files exist -> should get "Nothing to commit" after providing a message
    await page.fill('#commit-msg', 'Trying to commit with no staged files');
    await page.click('#btn-commit');
    const nothingToCommitAlert = recordedDialogs[recordedDialogs.length - 1];
    expect(nothingToCommitAlert.type).toBe('alert');
    expect(nothingToCommitAlert.message).toContain('Nothing to commit. Staging area is empty.');

    // Case 2: Stage a file then attempt commit with empty commit message -> should prompt for commit message
    // Add a file and stage it
    await page.fill('#file-name', 'todo.txt');
    await page.fill('#file-content', 'todo item');
    await page.click('#btn-add-file');
    recordedDialogs.pop(); // consume add alert
    await page.fill('#file-name', 'todo.txt');
    await page.click('#btn-stage');
    recordedDialogs.pop(); // consume stage alert

    // Ensure commit message is empty and click commit
    await page.fill('#commit-msg', '');
    await page.click('#btn-commit');

    const enterMsgAlert = recordedDialogs[recordedDialogs.length - 1];
    expect(enterMsgAlert.type).toBe('alert');
    expect(enterMsgAlert.message).toContain('Please enter a commit message.');
  });

  // Edge case: Creating an existing branch should show an error
  test('Creating an already existing branch shows an error alert', async ({ page }) => {
    const recordedDialogs8 = [];
    await page.goto(APP_URL);

    // Create branch 'dup-branch' first
    const firstResponses = [
      { type: 'prompt', input: 'dup-branch' },
      { type: 'confirm', accept: false },
    ];
    await attachDialogHandler(page, firstResponses, recordedDialogs);
    await page.click('#btn-create-branch');
    // consume both dialogs
    recordedDialogs.length = 0;

    // Try creating the same branch again - expect an alert with error
    const secondResponses = [
      { type: 'prompt', input: 'dup-branch' },
      // no confirm because creation should throw and showAlert with error
    ];
    const secondRecorded = [];
    await attachDialogHandler(page, secondResponses, secondRecorded);
    await page.click('#btn-create-branch');

    // The secondRecorded should include a prompt and then an alert with branch exists message
    const alertExists = secondRecorded.find(d => d.type === 'alert' && d.message.includes('Branch "dup-branch" already exists.'));
    expect(alertExists).toBeTruthy();
  });

  // Monitor for unexpected JS errors and console errors during a typical user flow
  test('No unexpected JS runtime errors during common interaction sequence', async ({ page }) => {
    const pageErrors1 = [];
    const consoleEntries1 = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (m) => consoleEntries.push({ type: m.type(), text: m.text() }));

    const recordedDialogs9 = [];
    const responses7 = [
      // For new branch prompt + confirm accept
      { type: 'prompt', input: 'flow-branch' },
      { type: 'confirm', accept: true },
    ];
    await attachDialogHandler(page, responses, recordedDialogs);
    await page.goto(APP_URL);

    // Perform a flow: add file, stage, commit, create branch and checkout, show log
    await page.fill('#file-name', 'flow.txt');
    await page.fill('#file-content', 'flow content');
    await page.click('#btn-add-file');
    recordedDialogs.pop(); // consume add alert

    await page.fill('#file-name', 'flow.txt');
    await page.click('#btn-stage');
    recordedDialogs.pop(); // consume stage alert

    await page.fill('#commit-msg', 'flow commit');
    await page.click('#btn-commit');
    recordedDialogs.pop(); // commit success alert

    // Create branch and checkout (handled by dialog handler responses)
    await page.click('#btn-create-branch');

    // Show log
    await page.click('#btn-log');
    const logText2 = await page.locator('#log').innerText();
    expect(logText).toContain('flow commit');

    // Assert that there were no uncaught page errors and no console errors logged
    expect(pageErrors).toHaveLength(0);
    const consoleErrors1 = consoleEntries.filter(c => c.type === 'error');
    expect(consoleErrors).toHaveLength(0);
  });
});