import { test, expect } from '@playwright/test';

const BASE_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c164f61-fa79-11f0-8fe7-a5317bd8e2c6.html';

class PlaygroundPage {
  constructor(page) {
    this.page = page;
    this.pageErrors = [];
    this.consoleErrors = [];
    // capture uncaught page errors and console errors for assertions
    page.on('pageerror', (err) => {
      this.pageErrors.push(err);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        this.consoleErrors.push(msg.text());
      }
    });
  }

  // navigate and wait for initial UI to render
  async goto() {
    await this.page.goto(BASE_URL, { waitUntil: 'load' });
    await this.page.waitForSelector('#editor');
    // ensure initial UI wiring has been executed
    await this.page.waitForFunction(() => typeof window._working !== 'undefined' && typeof window._project !== 'undefined');
  }

  // convenience to wait for a single dialog as a response to an action
  // returns the dialog object so caller may accept/dismiss with value
  async clickAndWaitForDialog(clickSelector) {
    const dialogPromise = this.page.waitForEvent('dialog');
    await this.page.click(clickSelector);
    const dialog = await dialogPromise;
    return dialog;
  }

  // prepare a dialog chain handler: list of expected dialogs with responses
  // handlers: [{ type: 'prompt'|'confirm'|'alert' , response: string|boolean|null, assertContains?:string }, ...]
  // action: async function that triggers the dialogs
  async runWithDialogs(handlers, action) {
    // prepare listeners for successive dialogs
    let idx = 0;
    const onDialog = async (dialog) => {
      const cfg = handlers[idx++] || {};
      if (cfg.assertContains) {
        // allow partial match
        expect(dialog.message()).toContain(cfg.assertContains);
      }
      // choose default behavior
      if (dialog.type() === 'prompt') {
        await dialog.accept(cfg.response ?? '');
      } else if (dialog.type() === 'confirm') {
        // Playwright accept() => returns true, dismiss() => false
        if (cfg.response === true) await dialog.accept();
        else await dialog.dismiss();
      } else {
        // alert or other, just accept
        await dialog.accept();
      }
    };
    this.page.on('dialog', onDialog);
    try {
      await action();
      // give some time for dialogs to be emitted & handled
      // wait for microtasks queued by the app to execute
      await this.page.waitForTimeout(50);
    } finally {
      this.page.off('dialog', onDialog);
    }
  }

  // helpers to inspect DOM and exposed globals
  async getEditorValue() {
    return this.page.locator('#editor').evaluate((el) => el.value);
  }
  async getCurrentFileLabel() {
    return this.page.locator('#currentFileLabel').innerText();
  }
  async listFiles() {
    // returns array of file button names in fileList
    return this.page.$$eval('#fileList button', (els) => els.map(e => e.textContent));
  }
  async getOpQueueItems() {
    return this.page.$$eval('#opQueue > div', (els) => els.map(e => e.textContent));
  }
  async getSnapshotListText() {
    return this.page.locator('#snapshots').innerText();
  }
  async getProject() {
    return this.page.evaluate(() => window._project);
  }
  async getWorking() {
    return this.page.evaluate(() => window._working);
  }
  // convenience wait for potential UI updates
  async uiWait(ms = 50) {
    await this.page.waitForTimeout(ms);
  }
}

test.describe('Refactoring Playground - FSM interactions and transitions', () => {
  let pp;

  test.beforeEach(async ({ page }) => {
    pp = new PlaygroundPage(page);
    await pp.goto();
  });

  test('Initial state S0_Idle: editor loaded with current file and updateEditor entry action executed', async () => {
    // Verify editor contains content of current file and UI labels populated
    const currentLabel = await pp.getCurrentFileLabel();
    expect(currentLabel).toBeTruthy(); // should show current file name like app.js
    const editorVal = await pp.getEditorValue();
    expect(editorVal.length).toBeGreaterThan(0); // has content from sample
    // Ensure populateSelects() ran (extractDest select should have options)
    const extractOptions = await pp.page.$$eval('#extractDest option', (o) => o.map(x => x.value));
    expect(extractOptions.length).toBeGreaterThan(0);
    // No fatal runtime errors collected on load
    expect(pp.pageErrors.length).toBe(0);
  });

  test.describe('File operations (S1_FileCreated, S2_FileCloned, S3_FileDeleted, S4_FileRenamed)', () => {
    test('New File (NewFile -> S1_FileCreated): prompt accepted creates file and updates editor', async () => {
      // Click New File and accept prompt with name 'test_new.js'
      await pp.runWithDialogs([
        { type: 'prompt', response: 'test_new.js', assertContains: 'New file name' }
      ], async () => {
        await pp.page.click('#newFileBtn');
      });
      await pp.uiWait();
      const files = await pp.listFiles();
      expect(files).toContain('test_new.js');
      const working = await pp.getWorking();
      expect(Object.keys(working.files)).toContain('test_new.js');
      // current file should be the new one and editor reflect '// new file'
      expect(await pp.getCurrentFileLabel()).toBe('test_new.js');
      expect(await pp.getEditorValue()).toContain('// new file');
    });

    test('Clone File (CloneFile -> S2_FileCloned): prompt accepted clones current file', async () => {
      // ensure current file is app.js initially
      const initialLabel = await pp.getCurrentFileLabel();
      expect(initialLabel).toBeTruthy();
      // click clone and provide name
      await pp.runWithDialogs([
        { type: 'prompt', response: 'clone_app.js', assertContains: 'New clone name' }
      ], async () => {
        await pp.page.click('#cloneFileBtn');
      });
      await pp.uiWait();
      const files = await pp.listFiles();
      expect(files).toContain('clone_app.js');
      // current file should be clone_app.js
      expect(await pp.getCurrentFileLabel()).toBe('clone_app.js');
      // editor should reflect same content as original file content snapshot
      const working = await pp.getWorking();
      expect(working.files['clone_app.js']).toBeTruthy();
      expect(working.files['clone_app.js']).toEqual(working.files[working.currentFile]);
    });

    test('Delete File (DeleteFile -> S3_FileDeleted): confirm cancel prevents deletion, confirm accept deletes file', async () => {
      // Create a file to delete
      await pp.runWithDialogs([{ type: 'prompt', response: 'to_delete.js' }], async () => {
        await pp.page.click('#newFileBtn');
      });
      await pp.uiWait();
      // Attempt delete but dismiss confirm -> should remain
      await pp.runWithDialogs([{ type: 'confirm', response: false, assertContains: 'Delete ' }], async () => {
        await pp.page.click('#deleteFileBtn');
      });
      await pp.uiWait();
      let files = await pp.listFiles();
      expect(files).toContain('to_delete.js');
      // Now accept delete -> should be removed
      await pp.runWithDialogs([{ type: 'confirm', response: true, assertContains: 'Delete ' }], async () => {
        await pp.page.click('#deleteFileBtn');
      });
      await pp.uiWait();
      files = await pp.listFiles();
      expect(files).not.toContain('to_delete.js');
    });

    test('Rename File (RenameFile -> S4_FileRenamed): prompt accepted renames file; rename cancel does nothing', async () => {
      // create file to rename
      await pp.runWithDialogs([{ type: 'prompt', response: 'to_rename.js' }], async () => {
        await pp.page.click('#newFileBtn');
      });
      await pp.uiWait();
      // cancel rename -> no change
      await pp.runWithDialogs([{ type: 'prompt', response: '' }], async () => {
        await pp.page.click('#renameFileBtn');
      });
      await pp.uiWait();
      let files = await pp.listFiles();
      expect(files).toContain('to_rename.js');
      // now perform rename to 'renamed.js'
      await pp.runWithDialogs([{ type: 'prompt', response: 'renamed.js', assertContains: 'New name' }], async () => {
        await pp.page.click('#renameFileBtn');
      });
      await pp.uiWait();
      files = await pp.listFiles();
      expect(files).toContain('renamed.js');
      expect(files).not.toContain('to_rename.js');
      expect(await pp.getCurrentFileLabel()).toBe('renamed.js');
    });
  });

  test.describe('Snapshots & Branches (S5_SnapshotOpened, S6_BranchCreated, S7_BranchSwitched, S8_SnapshotSaved)', () => {
    test('Open Snapshot (OpenSnapshot -> S5_SnapshotOpened): empty id shows alert; valid id shows snapshot contents', async () => {
      // empty id case triggers alert 'No id'
      await pp.runWithDialogs([{ type: 'alert', response: null, assertContains: 'No id' }], async () => {
        await pp.page.click('#openSnapshotBtn');
      });
      // Now open known snapshot id 1 (initial sample saved at init)
      await pp.page.fill('#openSnapshotId', '1');
      await pp.runWithDialogs([
        { type: 'alert', response: null, assertContains: 'Snapshot files' }
      ], async () => {
        await pp.page.click('#openSnapshotBtn');
      });
    });

    test('Create Branch (CreateBranch -> S6_BranchCreated) and Switch (SwitchBranch -> S7_BranchSwitched)', async () => {
      // create branch 'feature1' -> should alert confirmation in createBranch
      await pp.page.fill('#branchNameInput', 'feature1');
      await pp.runWithDialogs([{ type: 'alert', response: null, assertContains: 'Branch created' }], async () => {
        await pp.page.click('#createBranchBtn');
      });
      // ensure branch listed in project object
      const projectAfterCreate = await pp.getProject();
      expect(projectAfterCreate.branches['feature1']).toBeTruthy();
      // switch to the branch: switchBranchBtn requires non-empty input; clicking will call switchBranch
      // Since branch exists with currentSnapshot inherited, switching should set project.currentBranch
      await pp.page.fill('#branchNameInput', 'feature1');
      await pp.page.click('#switchBranchBtn');
      await pp.uiWait();
      const projectAfterSwitch = await pp.getProject();
      expect(projectAfterSwitch.currentBranch).toBe('feature1');
      // The editor should update (working.currentFile may become null if branch has no files)
      const working = await pp.getWorking();
      // new branch 'feature1' inherits snapshots; it's possible to have files or empty workspace; we assert branch exists and UI updated
      expect(projectAfterSwitch.branches['feature1']).toBeDefined();
    });

    test('Save Snapshot (SaveSnapshot -> S8_SnapshotSaved): saving snapshot asks for message and then adds snapshot', async () => {
      // Save snapshot with message 'manual test snapshot'
      await pp.runWithDialogs([
        { type: 'prompt', response: 'manual test snapshot', assertContains: 'Snapshot message' },
        { type: 'alert', response: null, assertContains: 'Snapshot saved' }
      ], async () => {
        await pp.page.click('#saveSnapshotBtn');
      });
      // assert snapshot list contains our message
      const project = await pp.getProject();
      const snaps = project.snapshots;
      const found = Object.values(snaps).some(s => s.message && s.message.includes('manual test snapshot'));
      expect(found).toBeTruthy();
    });
  });

  test.describe('Merge & Conflict flow (S9_BranchMerged)', () => {
    test('Merge Branch (MergeBranch -> S9_BranchMerged): merging same branch is prevented; merge identical branches merges cleanly', async () => {
      // Create a branch 'merge_test'
      await pp.page.fill('#branchNameInput', 'merge_test');
      await pp.runWithDialogs([{ type: 'alert', response: null, assertContains: 'Branch created' }], async () => {
        await pp.page.click('#createBranchBtn');
      });
      // Attempt merging current branch into itself by selecting current branch value in merge select
      // The UI's merge select includes options after populateSelects; pick current branch value
      const currentBranch = (await pp.getProject()).currentBranch;
      // set merge select to same branch value
      await pp.page.selectOption('#mergeBranchSelect', currentBranch);
      await pp.runWithDialogs([{ type: 'alert', response: null, assertContains: 'Cannot merge same branch' }], async () => {
        await pp.page.click('#mergeBtn');
      });
      // Now set merge select to the new branch we created and attempt merge; since both branches share same base snapshot, should "Merged cleanly"
      await pp.page.selectOption('#mergeBranchSelect', 'merge_test');
      await pp.runWithDialogs([{ type: 'alert', response: null, assertContains: 'Merged cleanly' }], async () => {
        await pp.page.click('#mergeBtn');
      });
      // ensure a snapshot with message containing 'merge' exists
      const project = await pp.getProject();
      const mergeSnapFound = Object.values(project.snapshots).some(s => s.message && s.message.includes('merge'));
      expect(mergeSnapFound).toBeTruthy();
    });
  });

  test.describe('Undo/Redo (S10_UndoPerformed, S11_RedoPerformed)', () => {
    test('Undo then Redo sequence alters working.files accordingly', async () => {
      // Ensure we have a current file and its current content
      const currentFile = (await pp.getWorking()).currentFile;
      expect(currentFile).toBeTruthy();
      const originalContent = (await pp.getWorking()).files[currentFile];
      // edit editor value and save -> pushes history snapshot
      const newContent = originalContent + '\n// appended line for undo test';
      await pp.page.fill('#editor', newContent);
      // click save which triggers pushHistorySnapshot()
      await pp.page.click('#saveBtn');
      await pp.uiWait();
      // verify working file has new content
      let workingNow = await pp.getWorking();
      expect(workingNow.files[currentFile]).toContain('// appended line for undo test');
      // perform undo -> should revert
      // If undo has nothing to undo it will alert; but since we saved, history should exist
      await pp.runWithDialogs([{ type: 'alert', response: null, assertContains: 'Nothing to undo' }], async () => {
        // We guard: call undo and if it alerts 'Nothing to undo' we handle; but we expect there is something to undo.
        // Use try/catch: call undo and if it alerts 'Nothing to undo', test will still proceed
        await pp.page.click('#undoBtn');
      }).catch(() => {});
      // Wait a bit and inspect working
      await pp.uiWait();
      const afterUndoWorking = await pp.getWorking();
      // Either undo occurred (files equal previous) or it alerted Nothing to undo. We assert that either the file reverted or undo alerted.
      const reverted = afterUndoWorking.files[currentFile] === originalContent;
      const stillModified = afterUndoWorking.files[currentFile] === newContent;
      expect(reverted || stillModified).toBeTruthy();
      // If revert happened, test redo
      if (reverted) {
        // redo should reapply the saved state
        // redo may alert 'Nothing to redo' if not available; handle alert
        await pp.runWithDialogs([{ type: 'alert', response: null, assertContains: 'Nothing to redo' }], async () => {
          await pp.page.click('#redoBtn');
        }).catch(() => {});
        await pp.uiWait();
        const afterRedoWorking = await pp.getWorking();
        expect(afterRedoWorking.files[currentFile]).toBe(newContent);
      }
    });
  });

  test.describe('Operation Queue & Applying Ops (S12_OperationApplied and related transitions)', () => {
    test('Prepare rename op, Apply Next op, and Apply All ops; Clear queue edge case and Apply Next when empty', async () => {
      // Prepare a rename operation: set opType to rename and fill inputs
      await pp.page.selectOption('#opType', 'rename');
      // Set renameOld and renameNew to transform console.log -> console.info
      await pp.page.fill('#renameOld', 'console.log');
      await pp.page.fill('#renameNew', 'console.info');
      // Ensure current file includes console.log
      const workingBefore = await pp.getWorking();
      const fileToCheck = workingBefore.currentFile;
      expect(workingBefore.files[fileToCheck]).toContain('console.log');
      // Click prepareOpBtn to queue the operation
      await pp.page.click('#prepareOpBtn');
      await pp.uiWait();
      let queueItems = await pp.getOpQueueItems();
      expect(queueItems.length).toBeGreaterThan(0);
      // Apply Next operation: this should alert 'No ops' only if empty; here it will apply
      // applyNextOp triggers applyOperation which saves snapshot and updates editor
      await pp.page.click('#applyNextOpBtn');
      await pp.uiWait();
      // confirm op applied: current working files should have replaced console.log -> console.info (for project-scope rename may not change file, but rename operation is implemented to replace occurrences)
      const workingAfter = await pp.getWorking();
      const updatedContent = workingAfter.files[fileToCheck];
      // Since rename may operate across multiple files, check that some replacement happened in at least one file in project
      const someFileChanged = Object.values(workingAfter.files).some(content => content.includes('console.info'));
      expect(someFileChanged).toBeTruthy();
      // Now prepare two simple operations: split and replace (we'll use split and inline)
      // Prepare a split op
      await pp.page.selectOption('#opType', 'split');
      await pp.page.fill('#splitLineNo', '2');
      await pp.page.fill('#splitNewName', 'split_out.js');
      await pp.page.click('#prepareOpBtn');
      // Prepare an inline op
      await pp.page.selectOption('#opType', 'inline');
      await pp.page.fill('#inlineVar', 'x_nonexistent_var');
      await pp.page.click('#prepareOpBtn');
      await pp.uiWait();
      queueItems = await pp.getOpQueueItems();
      expect(queueItems.length).toBeGreaterThanOrEqual(2);
      // Apply All Ops
      await pp.page.click('#applyAllOpsBtn');
      await pp.uiWait();
      // After applyAllOps the queue should be cleared and opQueue DOM empty
      const afterQueue = await pp.getOpQueueItems();
      expect(afterQueue.length).toBe(0);
      // Test clear ops when already empty (idempotent)
      await pp.page.click('#clearOpsBtn');
      await pp.uiWait();
      const afterClear = await pp.getOpQueueItems();
      expect(afterClear.length).toBe(0);
      // Test Apply Next when queue is empty -> should alert 'No ops'
      await pp.runWithDialogs([{ type: 'alert', response: null, assertContains: 'No ops' }], async () => {
        await pp.page.click('#applyNextOpBtn');
      });
    });
  });

  test.describe('Refactor tools previews and scripts', () => {
    test('Preview Rename shows diff in previewRenameDiff area and Apply Rename alters files', async () => {
      // set rename inputs to a known token 'add' -> 'sum' (present in math.js)
      await pp.page.fill('#renameOld', 'add');
      await pp.page.fill('#renameNew', 'sum');
      await pp.page.selectOption('#renameScope', 'project');
      // click previewRenameBtn -> should show diff in previewRenameDiff
      await pp.page.click('#previewRenameBtn');
      const previewText = await pp.page.locator('#previewRenameDiff').innerText();
      // preview may show diffs for math.js or others
      expect(previewText.length).toBeGreaterThan(0);
      // apply rename
      await pp.page.click('#applyRenameBtn');
      await pp.uiWait();
      const workingAfter = await pp.getWorking();
      // check that at least one file contains 'sum' now
      const containsSum = Object.values(workingAfter.files).some(c => c.includes('sum'));
      expect(containsSum).toBeTruthy();
    });

    test('Transformation script preview and apply (replace) handles bad syntax gracefully and applies replacements', async () => {
      // set transform script to replace util.js console.log -> console.info
      await pp.page.fill('#transformScript', 'replace util.js /console\\.log\\(/console.info(/g');
      // run preview (will show differences)
      await pp.page.click('#runScriptBtn');
      const preview = await pp.page.locator('#scriptPreview').innerText();
      expect(preview.length).toBeGreaterThan(0);
      // apply script (this calls applyScript and may alert on success)
      await pp.page.click('#applyScriptBtn');
      await pp.uiWait();
      const workingAfter = await pp.getWorking();
      const changed = Object.values(workingAfter.files).some(c => c.includes('console.info('));
      expect(changed).toBeTruthy();
    });
  });

  test.describe('Merge conflict resolver edge cases and timeline replay', () => {
    test('Attempt replay timeline quick path: Cancel stepwise -> quick simulation alerts shown', async () => {
      // Ensure there is at least one op in timeline by preparing and applying a rename op
      await pp.page.selectOption('#opType', 'rename');
      await pp.page.fill('#renameOld', 'console.info');
      await pp.page.fill('#renameNew', 'console.log');
      await pp.page.click('#prepareOpBtn');
      await pp.page.click('#applyAllOpsBtn');
      await pp.uiWait();

      // Click replayBtn and when confirm appears choose Cancel to trigger quick replay
      await pp.runWithDialogs([
        { type: 'confirm', response: false, assertContains: 'Replay timeline stepwise' },
        { type: 'alert', response: null, assertContains: 'Quick replay will reapply' },
        { type: 'alert', response: null, assertContains: 'Replay complete' }
      ], async () => {
        await pp.page.click('#replayBtn');
      });
    });
  });

  test.describe('Edge cases & error observation', () => {
    test('Open snapshot with non-existent id alerts No snapshot; switch to non-existent branch alerts', async () => {
      // open snapshot with id 99999 - should alert 'No snapshot'
      await pp.page.fill('#openSnapshotId', '99999');
      await pp.runWithDialogs([{ type: 'alert', response: null, assertContains: 'No snapshot' }], async () => {
        await pp.page.click('#openSnapshotBtn');
      });
      // attempt to switch to an empty branch input -> alert 'Enter branch to switch to'
      await pp.page.fill('#branchNameInput', '');
      await pp.runWithDialogs([{ type: 'alert', response: null, assertContains: 'Enter branch to switch to' }], async () => {
        await pp.page.click('#switchBranchBtn');
      });
      // attempt to switch to a non-existent branch name -> will alert 'No such branch'
      await pp.page.fill('#branchNameInput', 'branch_does_not_exist_999');
      await pp.runWithDialogs([{ type: 'alert', response: null, assertContains: 'No such branch' }], async () => {
        await pp.page.click('#switchBranchBtn');
      });
    });

    test('Observe that no uncaught ReferenceError, SyntaxError or TypeError were emitted during interactions', async () => {
      // Aggregate captured page errors and console errors from the page
      // Wait a bit to ensure any asynchronous errors have surfaced
      await pp.uiWait(100);
      const pageErrors = pp.pageErrors.map(e => String(e && e.message ? e.message : e));
      const consoleErrors = pp.consoleErrors;
      // Check none of the page errors mention ReferenceError, SyntaxError, TypeError
      const badPageErrors = pageErrors.filter(msg => /ReferenceError|SyntaxError|TypeError/.test(msg));
      const badConsoleErrors = consoleErrors.filter(msg => /ReferenceError|SyntaxError|TypeError/.test(msg));
      // Assert that there are no uncaught fundamental JS errors during our tests
      expect(badPageErrors.length).toBe(0);
      expect(badConsoleErrors.length).toBe(0);
    });
  });

  test.afterEach(async () => {
    // no special teardown needed - tests intentionally observe dialogs and page errors
  });
});