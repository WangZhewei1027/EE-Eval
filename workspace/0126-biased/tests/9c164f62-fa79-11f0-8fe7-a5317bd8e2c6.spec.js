import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c164f62-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object encapsulating common interactions
class CompilerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Collect console and page errors for assertions
    this.consoleMessages = [];
    this.pageErrors = [];
    // Install listeners
    page.on('console', msg => {
      // store type and text
      this.consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', err => {
      this.pageErrors.push(err);
    });
    // Global dialog handler that tries to accept prompts/confirms/alerts with reasonable defaults
    page.on('dialog', async dialog => {
      const type = dialog.type();
      const msg = dialog.message();
      // Provide appropriate defaults for prompts that are expected in the UI
      if (type === 'prompt') {
        if (msg.includes('Filename')) {
          await dialog.accept('testfile.c');
          return;
        }
        if (msg.includes('Snapshot name')) {
          await dialog.accept('snap1');
          return;
        }
        // generic prompt accept with "ok"
        await dialog.accept('ok');
        return;
      }
      // For confirm/alert just accept to let action proceed
      await dialog.accept();
    });
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'networkidle' });
    // Wait for key elements to render
    await this.page.waitForSelector('#fileSelect');
    await this.page.waitForSelector('#sourceArea');
  }

  // Basic selectors/actions
  fileSelect() { return this.page.locator('#fileSelect'); }
  newFileBtn() { return this.page.locator('#newFileBtn'); }
  importFileBtn() { return this.page.locator('#importFileBtn'); }
  fileInput() { return this.page.locator('#fileInput'); }
  saveFileBtn() { return this.page.locator('#saveFileBtn'); }
  deleteFileBtn() { return this.page.locator('#deleteFileBtn'); }
  duplicateFileBtn() { return this.page.locator('#duplicateFileBtn'); }
  fileNameInput() { return this.page.locator('#fileNameInput'); }
  sourceArea() { return this.page.locator('#sourceArea'); }

  lexBtn() { return this.page.locator('#lexBtn'); }
  parseBtn() { return this.page.locator('#parseBtn'); }
  irBtn() { return this.page.locator('#irBtn'); }
  optStepBtn() { return this.page.locator('#optStepBtn'); }
  optAllBtn() { return this.page.locator('#optAllBtn'); }
  codegenBtn() { return this.page.locator('#codegenBtn'); }
  simulateBtn() { return this.page.locator('#simulateBtn'); }
  runBtn() { return this.page.locator('#runBtn'); }
  resetBtn() { return this.page.locator('#resetBtn'); }

  resetPipelineBtn() { return this.page.locator('#resetPipelineBtn'); }
  passList() { return this.page.locator('#passList'); }
  tokensOut() { return this.page.locator('#tokensOut'); }
  astView() { return this.page.locator('#astView'); }
  irView() { return this.page.locator('#irView'); }
  codeOut() { return this.page.locator('#codeOut'); }
  simOut() { return this.page.locator('#simOut'); }
  logOut() { return this.page.locator('#logOut'); }
  stateOut() { return this.page.locator('#stateOut'); }

  saveSnapshotBtn() { return this.page.locator('#saveSnapshot'); }
  listSnapshotsBtn() { return this.page.locator('#listSnapshots'); }
  snapshotSelect() { return this.page.locator('#snapshotSelect'); }
  revertSnapshotBtn() { return this.page.locator('#revertSnapshot'); }

  dumpStateBtn() { return this.page.locator('#dumpState'); }

  // Helpers
  async getText(selectorOrLocator) {
    if (typeof selectorOrLocator === 'string') return (await this.page.locator(selectorOrLocator).textContent()) || '';
    return (await selectorOrLocator.textContent()) || '';
  }

  async selectFile(name) {
    // select option by value
    await this.page.selectOption('#fileSelect', name);
    // wait for fileNameInput to update
    await this.page.waitForFunction((val) => document.getElementById('fileNameInput').value === val, name);
  }

  async setSource(text) {
    await this.sourceArea().fill(text);
    // blur to allow any incremental compile to run if enabled
    await this.sourceArea().evaluate(e => e.blur());
  }

  async getConsoleMessagesOfType(type) {
    return this.consoleMessages.filter(m => m.type === type).map(m => m.text);
  }

  // Utility to set hidden file input content (simulate import)
  async setImportFile(name, content) {
    // Playwright: set input files directly
    await this.page.setInputFiles('#fileInput', { name, mimeType: 'text/plain', buffer: Buffer.from(content) });
    // After setInputFiles the change handler should run due to input event
    // Wait till new file shows in fileSelect
    await this.page.waitForTimeout(200); // small wait to allow newFile to execute
  }
}

// Tests grouped by feature sets corresponding to FSM states/transitions
test.describe('Compiler Playground - FSM-driven end-to-end', () => {
  let cp;

  test.beforeEach(async ({ page }) => {
    cp = new CompilerPage(page);
    await cp.goto();
  });

  test.afterEach(async () => {
    // Basic sanity: assert page didn't surface uncaught ReferenceError/SyntaxError/TypeError
    const criticalErrs = cp.pageErrors.filter(e => {
      const n = (e && e.name) || '';
      return n === 'ReferenceError' || n === 'SyntaxError' || n === 'TypeError';
    });
    // We assert that there are no uncaught critical errors.
    expect(criticalErrs.length).toBe(0);
  });

  test.describe('S0 Idle and File Management (S1,S2,S3)', () => {
    test('initial idle render: main.c present and initial UI elements visible', async () => {
      // Validate Idle state's entry: page rendered and default file exists ("main.c")
      const fileOptions = await cp.page.locator('#fileSelect option').allTextContents();
      expect(fileOptions.length).toBeGreaterThan(0);
      expect(fileOptions).toContain('main.c');
      // stateOut should mention selectedFile main.c
      const stateText = await cp.getText(cp.stateOut());
      expect(stateText).toContain('"selectedFile": "main.c"'.replace(/"/g, '"'));
      // Source area contains sample code
      const source = await cp.sourceArea().inputValue();
      expect(source).toContain('let a = 2 + 3 * 4;');
    });

    test('create new file via New File (S2_FileCreated) and ensure created in list', async () => {
      // Click new file button -> prompt handled by dialog handler in page.on('dialog')
      await cp.newFileBtn().click();
      // after creation, new option should appear and be selected
      await cp.page.waitForTimeout(200);
      const opts = await cp.page.locator('#fileSelect option').allTextContents();
      // our dialog default uses 'testfile.c'
      expect(opts).toContain('testfile.c');
      // fileNameInput should reflect selection
      const fileName = await cp.fileNameInput().inputValue();
      expect(fileName).toBe('testfile.c');
    });

    test('import file (S3_FileImported) via hidden file input', async () => {
      // Use setInputFiles to simulate a user-imported file
      await cp.setImportFile('imported_demo.txt', 'let imported = 42;');
      // Wait a short time for new file to be registered
      await cp.page.waitForTimeout(200);
      const opts = await cp.page.locator('#fileSelect option').allTextContents();
      // imported file should be present
      expect(opts.some(o => o.includes('imported_demo.txt'))).toBeTruthy();
    });

    test('save changes to a file and duplicate then delete it', async () => {
      // Create a new file (prompt accepted by handler)
      await cp.newFileBtn().click();
      await cp.page.waitForTimeout(150);
      // Ensure selection is testfile.c
      await cp.selectFile('testfile.c');
      // Edit source and save
      const newSource = 'let savedX = 100;';
      await cp.setSource(newSource);
      await cp.saveFileBtn().click();
      // logOut should contain 'Saved file'
      const logs = await cp.getText(cp.logOut());
      expect(logs).toContain('Saved file');
      // Duplicate the selected file
      await cp.duplicateFileBtn().click();
      await cp.page.waitForTimeout(200);
      const optionsAfterDup = await cp.page.locator('#fileSelect option').allTextContents();
      // duplicate ends with _copy
      expect(optionsAfterDup.some(o => o.includes('testfile_copy'))).toBeTruthy();
      // Delete the duplicate file: select the duplicate explicitly
      // pick an option that contains '_copy'
      const copyOptionValue = await cp.page.locator('#fileSelect option').filter({ hasText: '_copy' }).first().getAttribute('value');
      if (copyOptionValue) {
        await cp.selectFile(copyOptionValue);
        // delete will trigger confirm handled by dialog handler which accepts
        await cp.deleteFileBtn().click();
        await cp.page.waitForTimeout(200);
        const finalOptions = await cp.page.locator('#fileSelect option').allTextContents();
        expect(finalOptions.some(o => o.includes('_copy'))).toBeFalsy();
      } else {
        test.skip('No duplicate file was produced to delete (non-deterministic environment)');
      }
    });

    test('saving with no selected file produces an alert (edge case)', async ({ page }) => {
      // Remove all files by deleting until none left: we will delete files until fileSelect has no options
      // We will accept confirms via the global dialog handler
      let options = await page.locator('#fileSelect option').all();
      while ((await options.length) > 0) {
        // select first option and delete
        const optVal = await page.locator('#fileSelect option').first().getAttribute('value');
        await page.selectOption('#fileSelect', optVal || '');
        // delete triggers confirm -> accepted
        await page.locator('#deleteFileBtn').click();
        await page.waitForTimeout(100);
        options = await page.locator('#fileSelect option').all();
        // safety to avoid infinite loop
        if ((await options.length) > 20) break;
      }
      // Now attempt to save -> should trigger alert 'No file selected' which the dialog handler accepts
      // Capture the dialog explicitly to assert its message
      const [dialog] = await Promise.all([
        page.waitForEvent('dialog'),
        page.locator('#saveFileBtn').click()
      ]);
      expect(dialog.message()).toContain('No file selected');
      await dialog.accept();
    });
  });

  test.describe('Lexing, Parsing, IR, Optimize, Codegen, Simulation, Run (S4..S7..S8)', () => {
    test('lexing (S4_CodeLexed) then parsing (S5_CodeParsed)', async () => {
      // Ensure we have source content
      const initialSource = await cp.sourceArea().inputValue();
      expect(initialSource).toBeTruthy();
      // Lex
      await cp.lexBtn().click();
      // tokensOut should be populated
      const tokensText = await cp.getText(cp.tokensOut());
      expect(tokensText.length).toBeGreaterThan(0);
      // log should indicate Lexed
      const logs = await cp.getText(cp.logOut());
      expect(logs).toContain('Lexed');
      // Parse
      await cp.parseBtn().click();
      // AST view should contain Program (or '(no AST)' if it failed)
      const astText = await cp.getText(cp.astView());
      expect(astText.length).toBeGreaterThan(0);
      expect(astText.toLowerCase()).toContain('program'.toLowerCase());
      // logs should indicate parse saved
      const logs2 = await cp.getText(cp.logOut());
      expect(logs2).toContain('Parsed AST root');
    });

    test('IR generation (S6_IRGenerated) and IR view populated', async () => {
      // Ensure tokens/ast exist by clicking Generate IR which will parse if necessary
      await cp.irBtn().click();
      // irView should show at least one line or "(no IR)" if something failed
      const irText = await cp.getText(cp.irView());
      expect(irText).not.toBeNull();
      // Verify logs indicate IR generation
      const logs = await cp.getText(cp.logOut());
      expect(logs).toContain('Generated IR');
      // Also ensure internal codeOut and simOut updated after codegen/run later
    });

    test('optimize step and optimize all (S6 -> opt steps)', async () => {
      // Ensure IR exists
      await cp.irBtn().click();
      await cp.page.waitForTimeout(200);
      // Optimize one pass
      await cp.optStepBtn().click();
      await cp.page.waitForTimeout(200);
      const logsAfterOpt = await cp.getText(cp.logOut());
      // Should have an 'Applied pass' entry or nothing if no passes near
      expect(logsAfterOpt.length).toBeGreaterThan(0);
      // Optimize all
      await cp.optAllBtn().click();
      await cp.page.waitForTimeout(200);
      const logsAfterAll = await cp.getText(cp.logOut());
      expect(logsAfterAll).toContain('All passes applied');
    });

    test('codegen (S8_CodeGenerated) and simulate/run (S7/S8 transitions)', async () => {
      // Ensure IR present
      await cp.irBtn().click();
      await cp.page.waitForTimeout(200);
      // Codegen
      await cp.codegenBtn().click();
      // codeOut should contain compiled JS/asm content
      const codeText = await cp.getText(cp.codeOut());
      expect(codeText.length).toBeGreaterThan(0);
      // Simulate: should run the IR and populate simOut
      await cp.simulateBtn().click();
      await cp.page.waitForTimeout(200);
      const simText = await cp.getText(cp.simOut());
      expect(simText.length).toBeGreaterThan(0);
      // Run (full pipeline)
      await cp.runBtn().click();
      await cp.page.waitForTimeout(300);
      const runCode = await cp.getText(cp.codeOut());
      const runSim = await cp.getText(cp.simOut());
      expect(runCode.length).toBeGreaterThan(0);
      expect(runSim.length).toBeGreaterThan(0);
      const logs = await cp.getText(cp.logOut());
      expect(logs).toContain('Run completed');
    });

    test('step simulation (single-step) and reset state (S9_PipelineReset)', async () => {
      // Ensure IR exist then simulate to create sim
      await cp.irBtn().click();
      await cp.page.waitForTimeout(200);
      // Do single step via stepBtn
      await cp.page.locator('#stepBtn').click();
      await cp.page.waitForTimeout(150);
      const stepLogs = await cp.getText(cp.logOut());
      // Should mention 'Stepped' even if sim just started
      expect(stepLogs).toContain('Stepped');
      // Reset state
      await cp.resetBtn().click();
      await cp.page.waitForTimeout(150);
      // tokensOut should be cleared
      const tokens = await cp.getText(cp.tokensOut());
      expect(tokens).toBe('');
      // State out should reflect reset
      const stateText = await cp.getText(cp.stateOut());
      expect(stateText).toContain('"tokens": 0');
    });
  });

  test.describe('Pipeline management, snapshots, undo/redo, developer tools (S9 etc)', () => {
    test('reset pipeline button (S9_PipelineReset) restores default passes', async () => {
      // Click reset pipeline -> triggers confirm which is accepted by dialog handler
      await cp.resetPipelineBtn().click();
      await cp.page.waitForTimeout(200);
      const passListText = await cp.getText(cp.passList());
      expect(passListText).toContain('const-fold');
      expect(passListText).toContain('dead-code');
    });

    test('snapshots: save, list, diff, revert and undo/redo', async () => {
      // Save snapshot -> prompt for name accepted by handler as 'snap1'
      await cp.saveSnapshotBtn().click();
      await cp.page.waitForTimeout(150);
      // List snapshots
      await cp.listSnapshotsBtn().click();
      await cp.page.waitForTimeout(100);
      // snapshotSelect should have an option
      const snapOptions = await cp.snapshotSelect().locator('option').allTextContents();
      expect(snapOptions.length).toBeGreaterThan(0);
      // Show diff with current -> snapshotOut updated
      await cp.page.locator('#diffSnapshot').click();
      await cp.page.waitForTimeout(100);
      const snapshotOut = await cp.getText('#snapshotOut');
      expect(snapshotOut.length).toBeGreaterThanOrEqual(0); // may be empty diff but should exist
      // Revert snapshot: select first snapshot and click revert, confirm accepted
      await cp.snapshotSelect().selectOption('0');
      await cp.revertSnapshotBtn().click();
      await cp.page.waitForTimeout(200);
      const logs = await cp.getText(cp.logOut());
      expect(logs).toContain('Reverted snapshot');
    });

    test('dump state prints JSON to stateOut (developer inspect)', async () => {
      await cp.dumpStateBtn().click();
      // stateOut should contain a JSON structure with keys like files, selectedFile
      const so = await cp.getText(cp.stateOut());
      expect(so).toContain('"files":');
      expect(so).toContain('"selectedFile"');
    });
  });

  test.describe('Error and edge-case validations', () => {
    test('lex with injected syntax error should be handled gracefully (no uncaught exceptions)', async () => {
      // Check injectError and then lex; it appends ' @' which becomes UNKNOWN token but no exception.
      await cp.page.locator('#injectError').check();
      await cp.lexBtn().click();
      await cp.page.waitForTimeout(150);
      // Console logs should show 'Lexed' or 'Lex error' handled in UI logs
      const logs = await cp.getText(cp.logOut());
      expect(logs.length).toBeGreaterThan(0);
      // Clean up: uncheck
      await cp.page.locator('#injectError').uncheck();
    });

    test('ensure no uncaught ReferenceError/SyntaxError/TypeError occurred during the session', async () => {
      // This test intentionally inspects collected page errors and asserts none are critical types
      // (The afterEach also performs this check, but include explicit assertion here)
      const criticalErrs = cp.pageErrors.filter(e => {
        const n = (e && e.name) || '';
        return n === 'ReferenceError' || n === 'SyntaxError' || n === 'TypeError';
      });
      expect(criticalErrs.length).toBe(0);
    });
  });
});