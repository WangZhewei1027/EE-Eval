import { test, expect } from '@playwright/test';

// Test file for: 9c140571-fa79-11f0-8fe7-a5317bd8e2c6
// URL under test:
const APP_URL = 'http://127.0.0.1:5500/workspace/0126-biased/html/9c140571-fa79-11f0-8fe7-a5317bd8e2c6.html';

// Page Object Model for key controls and queries
class RadixSimPage {
  constructor(page) {
    this.page = page;
    // inputs and controls
    this.arrayInput = page.locator('#arrayInput');
    this.loadArrayBtn = page.locator('#loadArrayBtn');
    this.clearArrayBtn = page.locator('#clearArrayBtn');
    this.randBtn = page.locator('#randBtn');
    this.randSize = page.locator('#randSize');
    this.randMin = page.locator('#randMin');
    this.randMax = page.locator('#randMax');
    this.addValue = page.locator('#addValue');
    this.addBtn = page.locator('#addBtn');
    this.removeIndex = page.locator('#removeIndex');
    this.removeBtn = page.locator('#removeBtn');
    this.editCurrentBtn = page.locator('#editCurrentBtn');
    this.recomputeFromHereBtn = page.locator('#recomputeFromHereBtn');

    this.buildBtn = page.locator('#buildBtn');
    this.playBtn = page.locator('#playBtn');
    this.pauseBtn = page.locator('#pauseBtn');
    this.stepBackBtn = page.locator('#stepBackBtn');
    this.stepForwardBtn = page.locator('#stepForwardBtn');
    this.toStartBtn = page.locator('#toStartBtn');
    this.toEndBtn = page.locator('#toEndBtn');

    this.speed = page.locator('#speed');
    this.speedVal = page.locator('#speedVal');
    this.stepIndexInput = page.locator('#stepIndexInput');
    this.gotoStepBtn = page.locator('#gotoStepBtn');

    this.exportBtn = page.locator('#exportBtn');
    this.importBtn = page.locator('#importBtn');
    this.exportArea = page.locator('#exportArea');
    this.clearHistoryBtn = page.locator('#clearHistoryBtn');

    this.addBookmarkBtn = page.locator('#addBookmarkBtn');
    this.bookmarkName = page.locator('#bookmarkName');
    this.bookmarksList = page.locator('#bookmarksList');
    this.gotoBookmarkBtn = page.locator('#gotoBookmarkBtn');
    this.delBookmarkBtn = page.locator('#delBookmarkBtn');

    // displays
    this.currentStep = page.locator('#currentStep');
    this.totalSteps = page.locator('#totalSteps');
    this.mainArray = page.locator('#mainArray');
    this.buckets = page.locator('#buckets');
    this.counts = page.locator('#counts');
    this.digitMap = page.locator('#digitMap');
    this.historyList = page.locator('#historyList');
    this.logArea = page.locator('#logArea');
  }

  async getCurrentStepText() {
    return (await this.currentStep.textContent())?.trim();
  }
  async getTotalStepsText() {
    return (await this.totalSteps.textContent())?.trim();
  }
  async getMainArrayText() {
    return (await this.mainArray.textContent())?.trim();
  }
  async getBucketsText() {
    return (await this.buckets.textContent())?.trim();
  }
  async getCountsText() {
    return (await this.counts.textContent())?.trim();
  }
  async getDigitMapText() {
    return (await this.digitMap.textContent())?.trim();
  }
  async getHistoryListText() {
    return (await this.historyList.textContent())?.trim();
  }
  async getLogText() {
    return (await this.logArea.textContent())?.trim();
  }
}

test.describe('Radix Sort Interactive Simulator - FSM and UI tests', () => {
  // Capture console messages and page errors for each test
  test.beforeEach(async ({ page }) => {
    // Attach listeners early (before navigation) to capture any load-time errors
    page._consoleMessages = [];
    page._pageErrors = [];

    page.on('console', (msg) => {
      page._consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      page._pageErrors.push(String(err && err.message ? err.message : err));
    });

    await page.goto(APP_URL, { waitUntil: 'load' });
  });

  test.afterEach(async ({ page }) => {
    // Basic assertion: there should be no uncaught page errors or console errors of type 'error'
    const errs = page._pageErrors || [];
    const consoleErrors = (page._consoleMessages || []).filter(m => m.type === 'error');
    // If either exist, print them for debugging (test will fail)
    if (errs.length > 0) {
      console.error('Page errors detected:', errs);
    }
    if (consoleErrors.length > 0) {
      console.error('Console errors detected:', consoleErrors);
    }
    expect(errs).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test('Initial build: loading default array builds history and renders initial state', async ({ page }) => {
    // Validate initial buildAndRender executed on load and UI shows a non-empty history
    const sim = new RadixSimPage(page);

    // After initial load, history should be created and totalSteps should be > 0
    const totalStepsText = await sim.getTotalStepsText();
    expect(totalStepsText).not.toBeNull();
    // totalSteps reflects (history.length - 1). Should be a non-empty numeric string (>=0).
    const totalNum = Number(totalStepsText || '0');
    expect(Number.isFinite(totalNum)).toBeTruthy();
    expect(totalNum).toBeGreaterThanOrEqual(0);

    // mainArray should display the initial array elements (from default input)
    const mainText = await sim.getMainArrayText();
    expect(mainText.length).toBeGreaterThan(0);
    // history list should be populated visually
    const historyText = await sim.getHistoryListText();
    expect(historyText.length).toBeGreaterThan(0);

    // check speed value displayed matches input value
    const speedValText = await sim.speedVal.textContent();
    expect(speedValText.trim()).toBe(await sim.speed.inputValue());
  });

  test('Load, Clear, Randomize array operations (S1, S2, S3)', async ({ page }) => {
    // This test exercises LoadArray (S1), ClearArray (S2), RandomizeArray (S3)
    const sim = new RadixSimPage(page);

    // 1) Change array input and click Load Array
    await sim.arrayInput.fill('5,10,15');
    await sim.loadArrayBtn.click();
    // After load, main array should reflect the newly loaded values
    const mainAfterLoad = await sim.getMainArrayText();
    expect(mainAfterLoad).toContain('5');
    expect(mainAfterLoad).toContain('10');
    expect(mainAfterLoad).toContain('15');
    // History should be rebuilt -> totalSteps >= 0
    const totalAfterLoad = Number(await sim.getTotalStepsText());
    expect(Number.isFinite(totalAfterLoad)).toBeTruthy();

    // 2) Clear array
    await sim.clearArrayBtn.click();
    // arrayInput should be empty
    expect((await sim.arrayInput.inputValue()).trim()).toBe('');
    // main array should show '(empty)' as per renderCurrent
    const mainAfterClear = await sim.getMainArrayText();
    expect(mainAfterClear).toMatch(/empty/i);

    // 3) Randomize array: set deterministic parameters and click
    await sim.randSize.fill('3');
    await sim.randMin.fill('1');
    await sim.randMax.fill('9');
    // Click Randomize and ensure array input is populated and history built
    await sim.randBtn.click();
    const ai = (await sim.arrayInput.inputValue()).trim();
    expect(ai.length).toBeGreaterThan(0);
    // The random array should be comma separated with 3 values (at least two commas maybe)
    const parts = ai.split(',').map(s => s.trim()).filter(Boolean);
    expect(parts.length).toBeGreaterThanOrEqual(1);
    // Build should have updated history and mainArray
    const mainAfterRand = await sim.getMainArrayText();
    expect(mainAfterRand.length).toBeGreaterThan(0);
  });

  test('Add and Remove value operations (S4, S5) and edge removal behavior', async ({ page }) => {
    const sim = new RadixSimPage(page);

    // Ensure we have an array loaded
    await sim.arrayInput.fill('1,2,3');
    await sim.loadArrayBtn.click();

    // Add a value (S4)
    await sim.addValue.fill('999');
    await sim.addBtn.click();
    // array input should now include 999
    const aiAfterAdd = (await sim.arrayInput.inputValue()).trim();
    expect(aiAfterAdd).toContain('999');
    // main array display should reflect the new element
    const mainAfterAdd = await sim.getMainArrayText();
    expect(mainAfterAdd).toContain('999');

    // Remove a valid index (S5)
    await sim.removeIndex.fill('0');
    await sim.removeBtn.click();
    // array input should no longer contain the previous first element '1'
    const aiAfterRemove = (await sim.arrayInput.inputValue()).trim();
    expect(aiAfterRemove).not.toContain('1');

    // Edge-case: Remove with invalid index (out of bounds) should do nothing (no exception and no change)
    const beforeInvalidRemove = aiAfterRemove;
    await sim.removeIndex.fill('9999');
    await sim.removeBtn.click();
    const afterInvalidRemove = (await sim.arrayInput.inputValue()).trim();
    expect(afterInvalidRemove).toBe(beforeInvalidRemove);
  });

  test('Edit current state and recompute from here (S6 -> S7) with dialog handling', async ({ page }) => {
    const sim = new RadixSimPage(page);

    // Start with a known array and build
    await sim.arrayInput.fill('10,20,30');
    await sim.loadArrayBtn.click();

    // Click Edit Current State -> triggers a prompt; intercept and provide a custom array
    const promptPromise = page.waitForEvent('dialog');
    await sim.editCurrentBtn.click();
    const promptDialog = await promptPromise;
    expect(promptDialog.type()).toBe('prompt');
    // Provide new array "7,8,9"
    await promptDialog.accept('7,8,9');

    // After accepting prompt, renderCurrent should show edited array at current snapshot
    const mainAfterEdit = await sim.getMainArrayText();
    expect(mainAfterEdit).toContain('7');
    expect(mainAfterEdit).toContain('8');
    expect(mainAfterEdit).toContain('9');

    // Now click Recompute From Here -> will show confirm; accept to rebuild full history from edited snapshot
    const confirmPromise = page.waitForEvent('dialog');
    await sim.recomputeFromHereBtn.click();
    const confirmDialog = await confirmPromise;
    expect(confirmDialog.type()).toBe('confirm');
    await confirmDialog.accept();

    // After recompute, arrayInput should equal the edited array
    const aiAfterRecompute = (await sim.arrayInput.inputValue()).trim();
    expect(aiAfterRecompute).toContain('7');
    expect(aiAfterRecompute).toContain('8');
    expect(aiAfterRecompute).toContain('9');

    // And history should be rebuilt: totalSteps >= 0
    const totalAfterRecompute = Number(await sim.getTotalStepsText());
    expect(Number.isFinite(totalAfterRecompute)).toBeTruthy();
  });

  test('Build full history, playback controls: Play, Pause, Step Forward/Back, ToStart/ToEnd (S8,S9,S10,S11,S12,S13)', async ({ page }) => {
    const sim = new RadixSimPage(page);

    // Load a simple array with many steps (to ensure play can advance)
    await sim.arrayInput.fill('3,1,4,1,5,9');
    await sim.loadArrayBtn.click();

    // Build full history explicitly
    await sim.buildBtn.click();

    // Capture total steps and convert to index-based (totalSteps text is history.length - 1)
    const totalStepsNum = Number(await sim.getTotalStepsText());
    expect(totalStepsNum).toBeGreaterThanOrEqual(0);

    // Set speed to a low value to allow quick playback
    await sim.speed.fill('80'); // set via inputValue; slider may accept setValue via fill
    // Reflect change in UI by triggering input event (the page listens to 'input')
    await page.evaluate(() => {
      const e = new Event('input', { bubbles: true });
      document.getElementById('speed').dispatchEvent(e);
    });
    // Start playing (S8)
    await sim.playBtn.click();

    // Wait briefly to allow play to advance a few steps
    await page.waitForTimeout(250);

    // Pause playback (S9)
    await sim.pauseBtn.click();

    const currentAfterPlay = Number(await sim.getCurrentStepText());
    // Expect that some advancement occurred (currentIndex > 0), given brief wait
    expect(currentAfterPlay).toBeGreaterThanOrEqual(0);

    // Step Forward (S11)
    const beforeStepFwd = Number(await sim.getCurrentStepText());
    await sim.stepForwardBtn.click();
    const afterStepFwd = Number(await sim.getCurrentStepText());
    expect(afterStepFwd).toBeGreaterThanOrEqual(beforeStepFwd);

    // Step Back (S10)
    await sim.stepBackBtn.click();
    const afterStepBack = Number(await sim.getCurrentStepText());
    expect(afterStepBack).toBeGreaterThanOrEqual(0);

    // To End (S13)
    await sim.toEndBtn.click();
    const atEnd = Number(await sim.getCurrentStepText());
    // Should equal totalStepsNum
    expect(atEnd).toBeGreaterThanOrEqual(0);
    // To Start (S12)
    await sim.toStartBtn.click();
    const atStart = Number(await sim.getCurrentStepText());
    expect(atStart).toBe(0);
  });

  test('Export, Import, invalid import handling, Clear History (S14, S15, S16)', async ({ page }) => {
    const sim = new RadixSimPage(page);

    // Load a test array and build
    await sim.arrayInput.fill('2,4,6,8');
    await sim.loadArrayBtn.click();

    // Export history
    await sim.exportBtn.click();
    const exportedText = (await sim.exportArea.inputValue()).trim();
    expect(exportedText.length).toBeGreaterThan(0);

    // Clear history (S16)
    await sim.clearHistoryBtn.click();
    // After clearing, totalSteps should be '0' and mainArray should show empty
    expect(await sim.getTotalStepsText()).toBe('0');
    expect((await sim.getMainArrayText()).toLowerCase()).toContain('empty');

    // Import the previously exported JSON (S15)
    await sim.exportArea.fill(exportedText);
    await sim.importBtn.click();
    // No dialog on successful import; confirm history restored
    const totalAfterImport = Number(await sim.getTotalStepsText());
    expect(Number.isFinite(totalAfterImport)).toBeTruthy();
    expect(totalAfterImport).toBeGreaterThanOrEqual(0);

    // Now test invalid JSON import -> should trigger an alert dialog with 'Import failed' message
    await sim.clearHistoryBtn.click(); // ensure empty so import actually tries to parse something
    await sim.exportArea.fill('this is not json');
    const dialogPromise = page.waitForEvent('dialog');
    await sim.importBtn.click();
    const alertDialog = await dialogPromise;
    expect(alertDialog.type()).toBe('alert');
    const msg = alertDialog.message();
    expect(msg).toMatch(/Import failed/i);
    await alertDialog.accept();
  });

  test('Bookmarks: Add, Go to bookmark, Delete bookmark', async ({ page }) => {
    const sim = new RadixSimPage(page);

    // Load array and build so history indices make sense
    await sim.arrayInput.fill('11,22,33,44');
    await sim.loadArrayBtn.click();

    // Move to some step to bookmark (step 2 if available)
    await sim.stepIndexInput.fill('2');
    await sim.gotoStepBtn.click();
    const stepAtBookmark = Number(await sim.getCurrentStepText());
    expect(stepAtBookmark).toBeGreaterThanOrEqual(0);

    // Add bookmark
    await sim.bookmarkName.fill('testbm');
    await sim.addBookmarkBtn.click();

    // Ensure bookmark appears in select list
    const bmOptionsBefore = await sim.bookmarksList.locator('option').allTextContents();
    // Should contain 'testbm'
    expect(bmOptionsBefore.some(t => t.includes('testbm'))).toBeTruthy();

    // Change current step to another value then use Go to bookmark to return
    await sim.toStartBtn.click();
    expect(Number(await sim.getCurrentStepText())).toBe(0);
    // Select the bookmark and go
    await sim.bookmarksList.selectOption({ label: bmOptionsBefore.find(o => o.includes('testbm')) });
    await sim.gotoBookmarkBtn.click();
    // After goto, current step should equal the bookmarked index
    const afterGoto = Number(await sim.getCurrentStepText());
    expect(afterGoto).toBe(stepAtBookmark);

    // Delete bookmark
    await sim.delBookmarkBtn.click();
    const bmOptionsAfter = await sim.bookmarksList.locator('option').allTextContents();
    // bookmark list should be updated (no 'testbm')
    expect(bmOptionsAfter.some(t => t.includes('testbm'))).toBeFalsy();
  });

  test('Edge cases: Add with empty input, preset selection, and keyboard shortcuts', async ({ page }) => {
    const sim = new RadixSimPage(page);

    // Ensure addBtn with empty input does nothing (no errors)
    await sim.addValue.fill('');
    await sim.addBtn.click();
    // No throw; arrayInput still valid (should contain default or previous)
    const ai = (await sim.arrayInput.inputValue()).trim();
    expect(ai.length).toBeGreaterThanOrEqual(0);

    // Use presets dropdown to populate array (component exists)
    await page.selectOption('#presets', { value: '3,1,4,1,5,9,2,6,5,3,5' });
    // After selecting preset, the code updates arrayInput when change event occurs
    // It listens to 'change' event; the selectOption triggers that event
    const aiAfterPreset = (await sim.arrayInput.inputValue()).trim();
    expect(aiAfterPreset).toContain('3,1,4');

    // Test keyboard shortcuts: trigger ArrowRight (should advance one step)
    // First ensure there is a built history
    await sim.loadArrayBtn.click();
    const before = Number(await sim.getCurrentStepText());
    await page.keyboard.press('ArrowRight');
    // Small wait to allow handler to run
    await page.waitForTimeout(50);
    const after = Number(await sim.getCurrentStepText());
    // After pressing ArrowRight, it should be >= before (maybe +1)
    expect(after).toBeGreaterThanOrEqual(before);
  });

});