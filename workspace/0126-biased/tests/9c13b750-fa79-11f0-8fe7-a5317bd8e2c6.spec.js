import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c13b750-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page object for the Suffix Tree Interactive Explorer
class ExplorerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    // Controls
    this.modeSelect = '#modeSelect';
    this.inputString = '#inputString';
    this.inputString2 = '#inputString2';
    this.termS = '#termS';
    this.termT = '#termT';
    this.algoSelect = '#algoSelect';
    this.buildBtn = '#buildBtn';
    this.resetBtn = '#resetBtn';
    this.randomBtn = '#randomBtn';
    this.randLen = '#randLen';
    this.randLenVal = '#randLenVal';

    this.stepBackBtn = '#stepBackBtn';
    this.stepForwardBtn = '#stepForwardBtn';
    this.playPauseBtn = '#playPauseBtn';
    this.jumpStartBtn = '#jumpStartBtn';
    this.jumpEndBtn = '#jumpEndBtn';
    this.speedSlider = '#speedSlider';
    this.autoStepAmount = '#autoStepAmount';

    this.patternInput = '#patternInput';
    this.searchAllBtn = '#searchAllBtn';
    this.searchStepBtn = '#searchStepBtn';
    this.searchResetBtn = '#searchResetBtn';
    this.maxMatches = '#maxMatches';

    this.computeSA = '#computeSA';
    this.computeLRS = '#computeLRS';
    this.computeLCS = '#computeLCS';
    this.countDistinct = '#countDistinct';

    this.exportBtn = '#exportBtn';
    this.importBtn = '#importBtn';
    this.importFile = '#importFile';

    // Views
    this.treeView = '#treeView';
    this.stepInfo = '#stepInfo';
    this.saView = '#saView';
    this.queryView = '#queryView';
    this.opLog = '#opLog';
    this.clearLogBtn = '#clearLogBtn';
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // ensure script initialization completed
    await this.page.waitForSelector(this.treeView);
  }

  async click(selector) {
    await this.page.click(selector);
  }

  async getText(selector) {
    return (await this.page.$eval(selector, el => el.innerText)).trim();
  }

  async getValue(selector) {
    return await this.page.$eval(selector, el => el.value);
  }

  async setValue(selector, value) {
    await this.page.fill(selector, value);
  }

  // Wait until treeView shows a built tree (contains "Full string") or timeout
  async waitForBuiltTree(timeout = 5000) {
    await this.page.waitForFunction(
      (sel) => {
        const el = document.querySelector(sel);
        return el && el.innerText && el.innerText.indexOf('Full string') !== -1;
      },
      this.treeView,
      { timeout }
    );
  }
}

test.describe('Suffix Tree Interactive Explorer - FSM and interactions', () => {
  // Collect console errors and page errors to assert there are none (runtime sanity)
  let consoleErrors = [];
  let pageErrors = [];

  // Use a fresh page for each test to avoid state leakage
  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    page.on('console', msg => {
      // Capture console errors for later assertions
      if (msg.type() === 'error') {
        consoleErrors.push({ text: msg.text(), location: msg.location() });
      }
    });
    page.on('pageerror', err => {
      pageErrors.push(err);
    });
  });

  test('Initial Idle state renders no snapshots and expected placeholders', async ({ page }) => {
    const explorer = new ExplorerPage(page);
    // Load the page exactly as-is
    await explorer.goto();

    // Verify Idle state's evidence: stepInfo and treeView exist and reflect the idle state
    const treeText = await explorer.getText(explorer.treeView);
    expect(treeText).toBe('(no snapshots)');

    const stepInfoText = await explorer.getText(explorer.stepInfo);
    expect(stepInfoText).toBe('');

    // No runtime errors at initial load
    expect(consoleErrors, 'No console error messages on initial load').toHaveLength(0);
    expect(pageErrors, 'No page errors on initial load').toHaveLength(0);
  });

  test('BuildStart transition: clicking Build generates snapshots and renders the tree (S0_Idle -> S1_Building)', async ({ page }) => {
    const explorer = new ExplorerPage(page);
    await explorer.goto();

    // Click Build to start building (this should generate snapshots)
    await Promise.all([
      page.waitForFunction(sel => {
        const el = document.querySelector(sel);
        return el && el.innerText && el.innerText.indexOf('Full string') !== -1;
      }, explorer.treeView),
      explorer.click(explorer.buildBtn)
    ]);

    // After build, treeView should contain the full string summary
    const treeText = await explorer.getText(explorer.treeView);
    expect(treeText.includes('Full string')).toBeTruthy();
    // stepInfo should show "Step 1 /" or similar, evidence of renderSnapshot entry action
    const stepInfo = await explorer.getText(explorer.stepInfo);
    expect(stepInfo.length).toBeGreaterThan(0);

    // Operation log should contain a build started entry
    const opLog = await explorer.getText(explorer.opLog);
    expect(opLog.toLowerCase()).toContain('build started');

    // Validate we can navigate snapshots: Step Forward should increase the step number
    const before = await explorer.getText(explorer.stepInfo);
    await explorer.click(explorer.stepForwardBtn);
    // small wait for UI update
    await page.waitForTimeout(100);
    const after = await explorer.getText(explorer.stepInfo);
    expect(after).not.toBe(before);

    // No runtime console errors or page errors occurred during build
    expect(consoleErrors, 'No console errors during build').toHaveLength(0);
    expect(pageErrors, 'No page errors during build').toHaveLength(0);
  });

  test('Reset transition from Building to Idle: Reset clears snapshots and UI', async ({ page }) => {
    const explorer = new ExplorerPage(page);
    await explorer.goto();

    // Build first to populate snapshots
    await Promise.all([
      page.waitForFunction(sel => {
        const el = document.querySelector(sel);
        return el && el.innerText && el.innerText.indexOf('Full string') !== -1;
      }, explorer.treeView),
      explorer.click(explorer.buildBtn)
    ]);

    // Now click Reset
    // Listen for possible log change
    await explorer.click(explorer.resetBtn);
    // UI should revert to idle "(no snapshots)"
    await page.waitForFunction(sel => document.querySelector(sel).innerText.trim() === '(no snapshots)', explorer.treeView);
    const treeText = await explorer.getText(explorer.treeView);
    expect(treeText).toBe('(no snapshots)');

    // opLog should include 'Reset explorer state.'
    const opLog = await explorer.getText(explorer.opLog);
    expect(opLog.toLowerCase()).toContain('reset explorer state');

    expect(consoleErrors, 'No console errors during reset').toHaveLength(0);
    expect(pageErrors, 'No page errors during reset').toHaveLength(0);
  });

  test('Randomize string and Play/Pause behavior (S0_Idle <-> S2_Playing)', async ({ page }) => {
    const explorer = new ExplorerPage(page);
    await explorer.goto();

    // Capture initial input value
    const beforeValue = await explorer.getValue(explorer.inputString);
    // Randomize string
    await explorer.click(explorer.randomBtn);
    // Small wait for UI to update
    await page.waitForTimeout(100);
    const afterValue = await explorer.getValue(explorer.inputString);
    expect(afterValue).not.toBe('');
    expect(afterValue).not.toBe(beforeValue);

    // Build to have snapshots for play to act on
    await Promise.all([
      page.waitForFunction(sel => document.querySelector(sel).innerText.indexOf('Full string') !== -1, explorer.treeView),
      explorer.click(explorer.buildBtn)
    ]);

    // Play -> should change the button text to 'Pause' and log 'Play started.'
    await explorer.click(explorer.playPauseBtn);
    await page.waitForTimeout(200); // allow play timer to initialize
    const playBtnText = await explorer.getText(explorer.playPauseBtn);
    expect(playBtnText).toBe('Pause');
    const opLog = await explorer.getText(explorer.opLog);
    expect(opLog.toLowerCase()).toContain('play started');

    // Pause -> toggle back and log 'Play paused.'
    await explorer.click(explorer.playPauseBtn);
    await page.waitForTimeout(100);
    const pausedText = await explorer.getText(explorer.playPauseBtn);
    expect(pausedText).toBe('Play');
    const opLog2 = await explorer.getText(explorer.opLog);
    expect(opLog2.toLowerCase()).toContain('play paused');

    expect(consoleErrors, 'No console errors during play/pause').toHaveLength(0);
    expect(pageErrors, 'No page errors during play/pause').toHaveLength(0);
  });

  test('Search flows: SearchAll (fast), SearchStep, stepping and reset (S0_Idle <-> S3_Searching)', async ({ page }) => {
    const explorer = new ExplorerPage(page);
    await explorer.goto();

    // Build first
    await Promise.all([
      page.waitForFunction(sel => document.querySelector(sel).innerText.indexOf('Full string') !== -1, explorer.treeView),
      explorer.click(explorer.buildBtn)
    ]);

    // Edge case: clicking searchAll with empty pattern triggers an alert
    let dialogMessage = null;
    page.once('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.dismiss();
    });
    await explorer.click(explorer.searchAllBtn);
    // Wait a brief moment for dialog handler to run
    await page.waitForTimeout(100);
    expect(dialogMessage).toBe('Enter a pattern to search');

    // Now perform a valid search: set pattern to 'a' (present in default/real string)
    await explorer.setValue(explorer.patternInput, 'a');
    await explorer.click(explorer.searchAllBtn);
    await page.waitForTimeout(100);
    const queryText = await explorer.getText(explorer.queryView);
    expect(queryText.toLowerCase()).toContain('pattern: "a"');
    expect(queryText.toLowerCase()).toContain('occurrences');

    // Search stepping: ensure pattern present; click SearchStep
    await explorer.setValue(explorer.patternInput, 'an'); // small pattern to walk through
    await explorer.click(explorer.searchStepBtn);
    await page.waitForTimeout(100);
    const queryFirst = await explorer.getText(explorer.queryView);
    expect(queryFirst.toLowerCase()).toContain('search stepping');
    // Use step forward/back buttons to traverse generated searchSteps
    await explorer.click(explorer.stepForwardBtn);
    await page.waitForTimeout(50);
    const stepAfterForward = await explorer.getText(explorer.queryView);
    expect(stepAfterForward.length).toBeGreaterThan(0);

    await explorer.click(explorer.stepBackBtn);
    await page.waitForTimeout(50);
    const stepAfterBack = await explorer.getText(explorer.queryView);
    expect(stepAfterBack.length).toBeGreaterThan(0);

    // Reset search steps
    await explorer.click(explorer.searchResetBtn);
    await page.waitForTimeout(50);
    const afterReset = await explorer.getText(explorer.queryView);
    expect(afterReset).toBe('');

    expect(consoleErrors, 'No console errors during search flows').toHaveLength(0);
    expect(pageErrors, 'No page errors during search flows').toHaveLength(0);
  });

  test('Compute SA & LCP, LRS, Count Distinct produce expected outputs', async ({ page }) => {
    const explorer = new ExplorerPage(page);
    await explorer.goto();

    // Build first
    await Promise.all([
      page.waitForFunction(sel => document.querySelector(sel).innerText.indexOf('Full string') !== -1, explorer.treeView),
      explorer.click(explorer.buildBtn)
    ]);

    // Compute SA & LCP
    await explorer.click(explorer.computeSA);
    await page.waitForTimeout(100);
    const saText = await explorer.getText(explorer.saView);
    expect(saText.toLowerCase()).toContain('suffix array');

    // Compute LRS
    await explorer.click(explorer.computeLRS);
    await page.waitForTimeout(100);
    const lrsText = await explorer.getText(explorer.queryView);
    // It may either report a repeated substring or say none; we assert it writes something and logs
    expect(lrsText.length).toBeGreaterThan(0);

    // Count distinct substrings
    await explorer.click(explorer.countDistinct);
    await page.waitForTimeout(100);
    const distinctText = await explorer.getText(explorer.queryView);
    expect(distinctText.toLowerCase()).toContain('distinct substrings');

    expect(consoleErrors, 'No console errors during SA/LRS/count distinct').toHaveLength(0);
    expect(pageErrors, 'No page errors during SA/LRS/count distinct').toHaveLength(0);
  });

  test('Generalized mode: toggling to generalized, building, and computing LCS', async ({ page }) => {
    const explorer = new ExplorerPage(page);
    await explorer.goto();

    // Toggle to generalized mode
    await explorer.click(explorer.modeSelect);
    await page.selectOption(explorer.modeSelect, 'generalized');
    // second string row and termT label should become visible (we check inputString2 exists and has value)
    const input2Val = await explorer.getValue(explorer.inputString2);
    expect(input2Val.length).toBeGreaterThan(0);

    // Edge case: make terminators equal -> Build should alert and abort
    await explorer.setValue(explorer.termS, '$');
    await explorer.setValue(explorer.termT, '$');

    let dialogMsg = null;
    page.once('dialog', async dialog => { dialogMsg = dialog.message(); await dialog.dismiss(); });
    await explorer.click(explorer.buildBtn);
    await page.waitForTimeout(100);
    expect(dialogMsg).toBe('Terminators for the two strings must differ. Change one.');

    // Now set different terminators and build generalized tree
    await explorer.setValue(explorer.termS, '#');
    await explorer.setValue(explorer.termT, '$');

    // Build
    await Promise.all([
      page.waitForFunction(sel => document.querySelector(sel).innerText.indexOf('Full string') !== -1, explorer.treeView),
      explorer.click(explorer.buildBtn)
    ]);

    // Compute generalized LCS
    await explorer.click(explorer.computeLCS);
    await page.waitForTimeout(150);
    const qv = await explorer.getText(explorer.queryView);
    // It may either find LCS or report none - assert that some output was produced
    expect(qv.length).toBeGreaterThan(0);

    expect(consoleErrors, 'No console errors in generalized mode').toHaveLength(0);
    expect(pageErrors, 'No page errors in generalized mode').toHaveLength(0);
  });

  test('Export snapshots triggers log entry; import flow exists (import will be triggered but we will not set file)', async ({ page }) => {
    const explorer = new ExplorerPage(page);
    await explorer.goto();

    // Build so we have snapshots to export
    await Promise.all([
      page.waitForFunction(sel => document.querySelector(sel).innerText.indexOf('Full string') !== -1, explorer.treeView),
      explorer.click(explorer.buildBtn)
    ]);

    // Click Export -> should produce log entry "Exported snapshots JSON."
    await explorer.click(explorer.exportBtn);
    await page.waitForTimeout(100);
    const opLog = await explorer.getText(explorer.opLog);
    expect(opLog.toLowerCase()).toContain('exported snapshots json');

    // Clicking Import triggers the hidden file input; we will not actually upload. We assert that clicking import triggers a click on the file input (no dialog) by listening to its 'change' not happening here.
    // We can at least invoke importBtn which calls importFile.click(); this should not throw.
    await explorer.click(explorer.importBtn);
    await page.waitForTimeout(100);

    expect(consoleErrors, 'No console errors during export/import click flows').toHaveLength(0);
    expect(pageErrors, 'No page errors during export/import click flows').toHaveLength(0);
  });

  test('Operation log clear works and Clear Log button empties the log', async ({ page }) => {
    const explorer = new ExplorerPage(page);
    await explorer.goto();

    // Build to generate log entries
    await Promise.all([
      page.waitForFunction(sel => document.querySelector(sel).innerText.indexOf('Full string') !== -1, explorer.treeView),
      explorer.click(explorer.buildBtn)
    ]);

    // Ensure opLog contains entries
    let opLogText = await explorer.getText(explorer.opLog);
    expect(opLogText.length).toBeGreaterThan(0);

    // Clear log
    await explorer.click(explorer.clearLogBtn);
    await page.waitForTimeout(50);
    const afterClear = await explorer.getText(explorer.opLog);
    expect(afterClear).toBe('');

    expect(consoleErrors, 'No console errors when clearing log').toHaveLength(0);
    expect(pageErrors, 'No page errors when clearing log').toHaveLength(0);
  });

  test('Final runtime sanity: there should be no uncaught page errors or console errors after typical usage', async ({ page }) => {
    const explorer = new ExplorerPage(page);
    await explorer.goto();

    // Perform a typical usage sequence: build, search, compute SA
    await Promise.all([
      page.waitForFunction(sel => document.querySelector(sel).innerText.indexOf('Full string') !== -1, explorer.treeView),
      explorer.click(explorer.buildBtn)
    ]);

    await explorer.setValue(explorer.patternInput, 'a');
    await explorer.click(explorer.searchAllBtn);
    await explorer.click(explorer.computeSA);
    await page.waitForTimeout(150);

    // Assert that no uncaught page errors or console error messages occurred during all interactions
    expect(consoleErrors, 'No console error messages after full usage scenario').toHaveLength(0);
    expect(pageErrors, 'No page errors after full usage scenario').toHaveLength(0);
  });
});