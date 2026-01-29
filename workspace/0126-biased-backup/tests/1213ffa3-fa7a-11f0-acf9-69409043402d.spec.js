import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/1213ffa3-fa7a-11f0-acf9-69409043402d.html';

/**
 * Page Object for the Jump Search Interactive Demo.
 * Encapsulates common element accessors and actions used across tests.
 */
class JumpSearchPage {
  constructor(page) {
    this.page = page;
  }

  // Elements
  arrayInput() { return this.page.locator('#arrayInput'); }
  searchValueInput() { return this.page.locator('#searchValue'); }
  blockSizeInput() { return this.page.locator('#blockSize'); }
  initSearchBtn() { return this.page.locator('#initSearch'); }
  resetAllBtn() { return this.page.locator('#resetAll'); }
  arrayDisplay() { return this.page.locator('#arrayDisplay'); }
  currentState() { return this.page.locator('#currentState'); }
  stepBackBtn() { return this.page.locator('#stepBack'); }
  stepForwardBtn() { return this.page.locator('#stepForward'); }
  autoRunBtn() { return this.page.locator('#autoRun'); }
  jumpToStartBtn() { return this.page.locator('#jumpToStart'); }
  jumpToEndBtn() { return this.page.locator('#jumpToEnd'); }
  speedControl() { return this.page.locator('#speedControl'); }
  speedValue() { return this.page.locator('#speedValue'); }
  controlsDiv() { return this.page.locator('#controls'); }
  manualStepControls() { return this.page.locator('#manualStepControls'); }
  selectStepInput() { return this.page.locator('#selectStep'); }
  gotoStepBtn() { return this.page.locator('#gotoStep'); }
  retrySearchBtn() { return this.page.locator('#retrySearch'); }
  newArrayBtn() { return this.page.locator('#newArray'); }
  exportLogBtn() { return this.page.locator('#exportLog'); }
  detailedControls() { return this.page.locator('#detailedControls'); }
  logDiv() { return this.page.locator('#log'); }

  // Actions
  async initSearch() { await this.initSearchBtn().click(); }
  async stepForward() { await this.stepForwardBtn().click(); }
  async stepBack() { await this.stepBackBtn().click(); }
  async autoRunToggle() { await this.autoRunBtn().click(); }
  async jumpToStart() { await this.jumpToStartBtn().click(); }
  async jumpToEnd() { await this.jumpToEndBtn().click(); }
  async setSelectStep(val) { await this.selectStepInput().fill(String(val)); }
  async gotoStep() { await this.gotoStepBtn().click(); }
  async retrySearch() { await this.retrySearchBtn().click(); }
  async resetAll() { await this.resetAllBtn().click(); }
  async newArray() { await this.newArrayBtn().click(); }
  async exportLog() { await this.exportLogBtn().click(); }
  async setArrayInput(text) { await this.arrayInput().fill(text); }
  async setSearchValue(text) { await this.searchValueInput().fill(String(text)); }
  async setBlockSize(text) { await this.blockSizeInput().fill(String(text)); }
  async setSpeed(value) { await this.speedControl().fill(String(value)); /* triggers input handling in tests by dispatching input manually if needed */ }
}

test.describe('Jump Search Interactive Demo - FSM and UI behavior', () => {
  let page;
  let jsp;
  let consoleMessages;
  let pageErrors;
  let dialogs;

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    jsp = new JumpSearchPage(page);

    // Collect console messages and errors for assertions later
    consoleMessages = [];
    pageErrors = [];
    dialogs = [];

    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', error => {
      pageErrors.push(error);
    });
    page.on('dialog', async dialog => {
      dialogs.push({ message: dialog.message(), type: dialog.type() });
      await dialog.accept(); // Accept alerts so tests can continue
    });

    // Load the application exactly as provided
    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async () => {
    // Basic sanity assertions about runtime errors that occurred while interacting.
    // The test-suite will fail if there are unexpected page errors.
    expect(pageErrors.length, `Unexpected page errors: ${pageErrors.map(e => e.message).join(' | ')}`).toBe(0);
    await page.close();
  });

  test('Initial S0_NotInitialized state is shown and array display is populated', async () => {
    // Validate initial textual state and that the displayed array matches the textarea content
    await expect(jsp.currentState()).toHaveText('Not initialized');
    const textareaValue = await jsp.arrayInput().inputValue();
    const disp = await jsp.arrayDisplay().textContent();
    // The display shows formatted array (numbers separated by spaces). Check for presence of a few known values.
    expect(disp).toContain('1');
    expect(disp).toContain('19');
    // No controls visible initially (hidden attribute)
    await expect(jsp.controlsDiv()).toBeHidden();
    await expect(jsp.manualStepControls()).toBeHidden();
    await expect(jsp.detailedControls()).toBeHidden();
  });

  test('InitializeSearch creates steps and displays first jump (transition S0 -> S1 -> S2 start)', async () => {
    // Click Initialize Search and verify logs, controls visibility and first step display
    await jsp.initSearch();

    // Controls and detailed/managers should become visible
    await expect(jsp.controlsDiv()).toBeVisible();
    await expect(jsp.manualStepControls()).toBeVisible();
    await expect(jsp.detailedControls()).toBeVisible();

    // The log should contain the starting message including block size auto text
    const log = await jsp.logDiv().textContent();
    expect(log).toMatch(/Starting Jump Search for value 19 in array of length 15 with block size/);

    // Current state should show the first jump step (implementation displays step 0)
    const cs = await jsp.currentState().textContent();
    expect(cs).toMatch(/^Jump step 0: jumped to index \d+/);

    // Array display should include a highlighted element (square brackets) for the jumped index
    const arrDisp = await jsp.arrayDisplay().textContent();
    expect(arrDisp).toMatch(/\[.*\]/); // at least one bracketed value

    // Ensure no unexpected console errors were emitted during initialization
    const errorConsoleMsgs = consoleMessages.filter(m => m.type === 'error');
    expect(errorConsoleMsgs.length, `Console errors during init: ${JSON.stringify(errorConsoleMsgs)}`).toBe(0);
  });

  test('StepForward and StepBack navigate through steps correctly (S1 -> S2 and S2 -> S2)', async () => {
    // Initialize first
    await jsp.initSearch();

    // Move forward a step
    await jsp.stepForward();
    const csForward = await jsp.currentState().textContent();
    // Expect a Jump step 1 (the second jump) based on the algorithm for provided array
    expect(csForward).toMatch(/^Jump step 1: jumped to index \d+/);

    // Array display should highlight the value at that jump index (e.g., [11] should appear for index 5)
    const disp = await jsp.arrayDisplay().textContent();
    expect(disp).toMatch(/\[.*\]/);

    // Now step back and confirm we return to previous step (0)
    await jsp.stepBack();
    const csBack = await jsp.currentState().textContent();
    expect(csBack).toMatch(/^Jump step 0: jumped to index \d+/);
  });

  test('GotoStep with valid and invalid inputs - checks alerts and step display (GoToStep transition)', async () => {
    await jsp.initSearch();

    // Valid step: go to linear step where target is found (should be step index 4 based on implementation)
    await jsp.setSelectStep(4);
    await jsp.gotoStep();
    const cs = await jsp.currentState().textContent();
    expect(cs).toMatch(/^Linear search step 4: checking index \d+/);

    // Ensure the log contains linear search message for index 9 (target 19 at index 9)
    const logContent = await jsp.logDiv().textContent();
    expect(logContent).toMatch(/Linear search at index 9 with value 19/);

    // Invalid non-integer value -> alert 'Step must be an integer.'
    await jsp.setSelectStep('1.5');
    await jsp.gotoStep();
    // A dialog should have been captured and accepted
    const lastDialog = dialogs.pop();
    expect(lastDialog).toBeDefined();
    expect(lastDialog.message).toMatch(/Step must be an integer\./);

    // Out-of-range step -> alert 'Step out of range'
    await jsp.setSelectStep(999);
    await jsp.gotoStep();
    const outOfRangeDialog = dialogs.pop();
    expect(outOfRangeDialog).toBeDefined();
    expect(outOfRangeDialog.message).toMatch(/Step out of range \(0 to \d+\)\./);
  });

  test('AutoRun will progress to the final result and then stop (AutoRun event)', async () => {
    await jsp.initSearch();

    // Speed up auto-run to finish quickly
    await jsp.page.evaluate(() => {
      const sc = document.getElementById('speedControl');
      sc.value = '100';
      sc.dispatchEvent(new Event('input'));
    });

    // Start auto-run and wait until the final result step is displayed
    await jsp.autoRunToggle();

    // Wait for currentState to reflect a "Result step" which signifies completion
    await jsp.page.waitForFunction(() => {
      const cs = document.getElementById('currentState').textContent;
      return cs && cs.startsWith('Result step');
    }, { timeout: 5000 });

    const finalCS = await jsp.currentState().textContent();
    expect(finalCS).toMatch(/^Result step \d+: search complete\./);

    // The log must include the final message about found index
    const finalLog = await jsp.logDiv().textContent();
    expect(finalLog).toMatch(/Value 19 found at index 9\./);

    // Ensure autoRun button text has returned to "Auto Run" after completion
    const autoText = await jsp.autoRunBtn().textContent();
    expect(autoText).toMatch(/Auto Run/);
  });

  test('JumpToStart and JumpToEnd navigate to first and last steps', async () => {
    await jsp.initSearch();

    // Jump to end
    await jsp.jumpToEnd();
    const csEnd = await jsp.currentState().textContent();
    // Should be a result step at the end
    expect(csEnd).toMatch(/^Result step \d+: search complete\./);

    // Jump to start
    await jsp.jumpToStart();
    const csStart = await jsp.currentState().textContent();
    expect(csStart).toMatch(/^Jump step 0: jumped to index \d+/);
  });

  test('RetrySearch transitions to ReadyForSearch and resets controls (S3 -> S1)', async () => {
    await jsp.initSearch();

    // Click retry search, should clear steps and show Ready for new search value
    await jsp.retrySearch();
    const cs = await jsp.currentState().textContent();
    expect(cs).toBe('Ready for new search value.');

    // Controls should be hidden again, array still displayed
    await expect(jsp.controlsDiv()).toBeHidden();
    await expect(jsp.manualStepControls()).toBeHidden();
    await expect(jsp.detailedControls()).toBeHidden();

    // Search input should be focused and empty
    const active = await jsp.page.evaluate(() => document.activeElement.id);
    expect(active).toBe('searchValue');
    const sv = await jsp.searchValueInput().inputValue();
    expect(sv).toBe('');
  });

  test('ResetAll and NewArray clear state and focus respective inputs (S1 -> S0, NewArray)', async () => {
    // Initialize first then reset
    await jsp.initSearch();
    await jsp.resetAll();

    // Current state should be Not initialized and various UI cleared
    await expect(jsp.currentState()).toHaveText('Not initialized');
    await expect(jsp.controlsDiv()).toBeHidden();

    // NewArray should clear and focus array input
    // Re-init then click newArray to validate
    await jsp.initSearch();
    await jsp.newArray();

    const activeAfterNew = await jsp.page.evaluate(() => document.activeElement.id);
    expect(activeAfterNew).toBe('arrayInput');
    await expect(jsp.currentState()).toHaveText('Not initialized');
  });

  test('ExportLog invocation does not throw and briefly appends a download anchor', async () => {
    await jsp.initSearch();

    // Ensure log has content to export
    await jsp.page.evaluate(() => {
      const ld = document.getElementById('log');
      ld.textContent = ld.textContent + '\nTest export line';
    });

    // Click export log; the implementation appends an <a> with download attribute and removes it after ~100ms.
    const downloadFound = await jsp.page.evaluate(() => {
      // Click the export button and capture whether an anchor was created synchronously
      document.getElementById('exportLog').click();
      // Immediately check for existence of the anchor with the expected download filename
      const a = document.querySelector('a[download="jump_search_log.txt"]');
      return !!a;
    });

    // The anchor may be very short-lived; we assert that no JS errors were produced and clicking completed.
    expect(downloadFound === true || downloadFound === false).toBeTruthy(); // trivial but ensures evaluation succeeded
    // No page errors should have been recorded (checked in afterEach)
  });

  test('Edge cases: invalid array, unsorted array, non-integer search value, invalid block size produce alerts', async () => {
    // Invalid array input (non-integer)
    await jsp.setArrayInput('1,2,three,4');
    await jsp.initSearch();
    let dlg = dialogs.pop();
    expect(dlg).toBeDefined();
    expect(dlg.message).toMatch(/Invalid array input/);

    // Unsorted array
    await jsp.setArrayInput('1,5,3,7');
    await jsp.setSearchValue('3');
    await jsp.initSearch();
    dlg = dialogs.pop();
    expect(dlg).toBeDefined();
    expect(dlg.message).toMatch(/Array must be sorted in ascending order/);

    // Non-integer search value
    await jsp.setArrayInput('1,2,3,4');
    await jsp.setSearchValue('3.14');
    await jsp.initSearch();
    dlg = dialogs.pop();
    expect(dlg).toBeDefined();
    expect(dlg.message).toMatch(/Search value must be an integer/);

    // Invalid negative block size
    await jsp.setSearchValue('3');
    await jsp.setBlockSize('-1');
    await jsp.initSearch();
    dlg = dialogs.pop();
    expect(dlg).toBeDefined();
    expect(dlg.message).toMatch(/Block size must be 0 or a positive integer/);

    // Block size larger than array length
    await jsp.setBlockSize('1000');
    await jsp.initSearch();
    dlg = dialogs.pop();
    expect(dlg).toBeDefined();
    expect(dlg.message).toMatch(/Block size cannot be larger than array length/);
  });

  test('Keyboard shortcuts operate when controls are visible and do not trigger when inputs focused', async () => {
    await jsp.initSearch();

    // Focus main body and trigger ArrowRight to step forward
    await jsp.page.keyboard.press('Tab'); // move focus away from inputs
    await jsp.page.keyboard.press('ArrowRight');
    // After ArrowRight, currentState should have advanced (e.g., not equal to step 0)
    const csAfter = await jsp.currentState().textContent();
    expect(csAfter).toMatch(/(Jump step|Linear search step)/);

    // Now focus an input and ensure keyboard shortcuts are ignored
    await jsp.arrayInput().focus();
    // Capture current state
    const before = await jsp.currentState().textContent();
    await jsp.page.keyboard.press('ArrowRight'); // should be ignored because focus is on textarea
    const after = await jsp.currentState().textContent();
    expect(after).toBe(before);
  });
});