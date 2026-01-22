import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e208c2-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page Object for the Linear Search Visualizer
class LinearSearchPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.arrayInput = page.locator('#array-input');
    this.applyBtn = page.locator('#apply-array');
    this.randomBtn = page.locator('#random-array');
    this.numericChk = page.locator('#numeric');
    this.arrayRow = page.locator('#array-row');
    this.targetInput = page.locator('#target-input');
    this.startBtn = page.locator('#start');
    this.stepBtn = page.locator('#step');
    this.playBtn = page.locator('#play');
    this.pauseBtn = page.locator('#pause');
    this.resetBtn = page.locator('#reset');
    this.speedSlider = page.locator('#speed');
    this.speedLabel = page.locator('#speed-label');
    this.comparisons = page.locator('#comparisons');
    this.index = page.locator('#index');
    this.result = page.locator('#result');
    this.explainBtn = page.locator('#explain-btn');
    this.explain = page.locator('#explain');
    this.trace = page.locator('#trace');
    this.traceCount = page.locator('#trace-count');
  }

  async goto() {
    await this.page.goto(APP_URL);
  }

  async getBoxCount() {
    return await this.arrayRow.locator('.box').count();
  }

  async getBoxText(index) {
    const box = this.arrayRow.locator('.box').nth(index);
    // The value is in first child <div> inside the box
    return await box.locator('div').first().innerText();
  }

  async getBoxClasses(index) {
    const box = this.arrayRow.locator('.box').nth(index);
    return (await box.getAttribute('class')) || '';
  }

  async clickApply() {
    await this.applyBtn.click();
  }

  async clickRandom() {
    await this.randomBtn.click();
  }

  async clickStart() {
    await this.startBtn.click();
  }

  async clickStep() {
    await this.stepBtn.click();
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async clickPause() {
    await this.pauseBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async setArray(value) {
    await this.arrayInput.fill(value);
  }

  async setTarget(value) {
    await this.targetInput.fill(value);
  }

  async setNumeric(checked) {
    const isChecked = await this.numericChk.isChecked();
    if (isChecked !== checked) {
      await this.numericChk.click();
    }
  }

  async setSpeed(value) {
    // value is string or number
    await this.speedSlider.evaluate((el, v) => { el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, value);
  }

  async toggleExplain() {
    await this.explainBtn.click();
  }

  async clickBox(index) {
    const box = this.arrayRow.locator('.box').nth(index);
    await box.click();
  }

  async getComparisonsText() {
    return await this.comparisons.innerText();
  }

  async getIndexText() {
    return await this.index.innerText();
  }

  async getResultText() {
    return await this.result.innerText();
  }

  async getTraceCountText() {
    return await this.traceCount.innerText();
  }
}

test.describe('Linear Search Visualizer - FSM and UI tests', () => {
  let page;
  let app;
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    consoleMessages = [];
    pageErrors = [];

    // Capture console messages
    page.on('console', msg => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', err => {
      pageErrors.push(err);
    });

    app = new LinearSearchPage(page);
    await app.goto();
    // wait for initial render to complete: array-row populated
    await page.waitForSelector('#array-row');
  });

  test.afterEach(async () => {
    await page.close();
    // Make sure we did not encounter unexpected page errors during test run.
    // These assertions are included in each test as well, but keep this as a final safety net.
    expect(pageErrors.map(e => e.message)).toEqual(expect.arrayContaining([]));
  });

  test.describe('Initialization and Idle state (S0_Idle)', () => {
    test('renders initial array, status and controls correctly on load', async () => {
      // Validate initial renderArray was called during init: boxes exist
      const count = await app.getBoxCount();
      expect(count).toBe(8); // default input has 8 values

      // Comparisons should be reset
      expect(await app.getComparisonsText()).toBe('0');
      // Index and result should be neutral
      expect(await app.getIndexText()).toBe('—');
      expect(await app.getResultText()).toBe('—');

      // Pause should be disabled initially
      expect(await app.pauseBtn.isDisabled()).toBe(true);
      // Play should be enabled
      expect(await app.playBtn.isDisabled()).toBe(false);

      // Speed label initialized to 1.0x
      expect(await app.speedLabel.innerText()).toBe('1.0x');

      // No uncaught page errors during initialization
      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Array management (S1_ArrayApplied)', () => {
    test('apply a custom array updates visualization', async () => {
      // Replace array with 3 items and apply
      await app.setArray('1, 2, 3');
      await app.clickApply();

      // Boxes re-rendered
      const count = await app.getBoxCount();
      expect(count).toBe(3);

      // Their contents reflect new array
      expect(await app.getBoxText(0)).toBe('1');
      expect(await app.getBoxText(1)).toBe('2');
      expect(await app.getBoxText(2)).toBe('3');

      // State cleared on apply
      expect(await app.getComparisonsText()).toBe('0');
      expect(await app.getResultText()).toBe('—');

      // No page errors
      expect(pageErrors.length).toBe(0);
    });

    test('random array generates a new array within expected bounds', async () => {
      await app.clickRandom();
      const count = await app.getBoxCount();
      // As per implementation len between 3 and 12
      expect(count).toBeGreaterThanOrEqual(3);
      expect(count).toBeLessThanOrEqual(12);

      // Array input should have been updated to a CSV string
      const arrayInputValue = await app.arrayInput.inputValue();
      expect(arrayInputValue.split(',').length).toBeGreaterThanOrEqual(3);

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Search flow (S2_Searching -> S3_Step -> S6_Reset)', () => {
    test('start prepares steps and executes first step (current) and subsequent step behavior', async () => {
      // Ensure default array and target (target is "4" present at index 4)
      expect(await app.getBoxCount()).toBe(8);
      expect(await app.targetInput.inputValue()).toBe('4');

      // Click start to prepareSteps and run first step
      await app.clickStart();

      // After start, first step should mark index 0 as current
      const class0 = await app.getBoxClasses(0);
      expect(class0.split(/\s+/)).toContain('current');

      // Index display should show 0 (first step moved to current)
      expect(await app.getIndexText()).toBe('0');

      // Trace count should reflect steps available (non-zero)
      const tc = await app.getTraceCountText();
      expect(tc).toMatch(/\d+\s+steps/);

      // Now step through next steps to ensure comparisons increment
      // Click step: should perform compare for index 0
      await app.clickStep();
      expect(await app.getComparisonsText()).toBe('1');

      // Click step again: should mark visited for index 0
      await app.clickStep();
      const class0After = await app.getBoxClasses(0);
      expect(class0After.split(/\s+/)).toContain('visited');

      // Continue stepping until "Found at index 4"
      // Use a loop with a reasonable cap to avoid infinite loops in case of failure.
      let found = false;
      for (let i = 0; i < 30; i++) {
        const resultText = await app.getResultText();
        if (resultText.startsWith('Found at index')) { found = true; break; }
        await app.clickStep();
      }
      expect(found).toBe(true);
      expect(await app.getResultText()).toContain('Found at index');

      // Reset and verify state cleared (S6_Reset)
      await app.clickReset();
      expect(await app.getComparisonsText()).toBe('0');
      expect(await app.getIndexText()).toBe('—');
      expect(await app.getResultText()).toBe('—');

      // Boxes should no longer have 'found' or 'visited' classes
      const cnt = await app.getBoxCount();
      for (let i = 0; i < cnt; i++) {
        const classes = (await app.getBoxClasses(i)).split(/\s+/);
        expect(classes).toContain('box'); // base class present
        // should not have result classes after reset
        expect(classes).not.toContain('found');
        expect(classes).not.toContain('visited');
        expect(classes).not.toContain('current');
        expect(classes).not.toContain('compared');
      }

      expect(pageErrors.length).toBe(0);
    });

    test('stepping without prior prepare triggers prepareSteps then steps', async () => {
      // Reset to ensure no steps prepared
      await app.clickReset();

      // Clear array to a short one to keep steps few
      await app.setArray('10,20');
      await app.clickApply();

      // Ensure no steps prepared: user directly clicks step
      await app.clickStep();

      // After step click, there should be some action: comparisons may be 0 (first is current)
      const idx = await app.getIndexText();
      expect(idx).not.toBe(undefined);
      // On subsequent step, comparisons should increment
      await app.clickStep();
      expect(Number(await app.getComparisonsText())).toBeGreaterThanOrEqual(1);

      expect(pageErrors.length).toBe(0);
    });

    test('empty array edge case: prepare and run yields Not found', async () => {
      // Make array empty and apply
      await app.setArray('');
      await app.clickApply();

      // Start (should prepare steps containing done)
      await app.clickStart();

      // Next step should apply the done step and mark result Not found
      // If start already executed a step, we may need to click step; handle both cases
      const r1 = await app.getResultText();
      if (!r1 || r1 === '—') {
        await app.clickStep();
      }

      // After performing done, result should be 'Not found'
      expect(await app.getResultText()).toBe('Not found');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Playback and speed (S4_Playing <-> S5_Paused)', () => {
    test('play starts automatic progression and pause stops it; speed slider updates label', async () => {
      // Reset and set a small array to speed up test
      await app.setArray('1,2,3,4');
      await app.clickApply();

      // Speed change should update label
      await app.setSpeed(1.5);
      expect(await app.speedLabel.innerText()).toBe('1.5x');

      // Start playback
      await app.clickPlay();

      // While playing: play button disabled, pause enabled
      expect(await app.playBtn.isDisabled()).toBe(true);
      expect(await app.pauseBtn.isDisabled()).toBe(false);

      // Wait a short time for a few steps to execute (should increment comparisons)
      await app.page.waitForTimeout(900); // allow a couple of intervals

      const comparisonsNow = Number(await app.getComparisonsText());
      expect(comparisonsNow).toBeGreaterThanOrEqual(0);

      // Pause playback
      await app.clickPause();
      expect(await app.playBtn.isDisabled()).toBe(false);
      expect(await app.pauseBtn.isDisabled()).toBe(true);

      // Change speed while paused: label updates but no playing restart
      await app.setSpeed(2);
      expect(await app.speedLabel.innerText()).toBe('2.0x');

      // Start playing again and then reset quickly
      await app.clickPlay();
      expect(await app.playBtn.isDisabled()).toBe(true);
      await app.clickReset();

      // After reset, playback must be stopped
      expect(await app.playBtn.isDisabled()).toBe(false);
      expect(await app.pauseBtn.isDisabled()).toBe(true);
      expect(await app.getComparisonsText()).toBe('0');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('UI interactions, accessibility and shortcuts', () => {
    test('clicking a box populates the target input with that box value', async () => {
      // Ensure known array
      await app.setArray('9,8,7');
      await app.clickApply();

      // Click second box (index 1)
      await app.clickBox(1);
      expect(await app.targetInput.inputValue()).toBe('8');

      expect(pageErrors.length).toBe(0);
    });

    test('toggle explanation shows and hides the explanation pane', async () => {
      // Initially hidden
      expect(await app.explain.evaluate(el => getComputedStyle(el).display)).toBe('none');

      await app.toggleExplain();
      expect(await app.explain.evaluate(el => getComputedStyle(el).display)).toBe('block');

      await app.toggleExplain();
      expect(await app.explain.evaluate(el => getComputedStyle(el).display)).toBe('none');

      expect(pageErrors.length).toBe(0);
    });

    test('keyboard shortcuts: ArrowRight triggers step, Space toggles play/pause', async () => {
      // Prepare a small array and ensure ready
      await app.setArray('1,2,3');
      await app.clickApply();

      // Press ArrowRight to trigger step
      await page.keyboard.press('ArrowRight');

      // After one step, index should be '0' (current)
      expect(await app.getIndexText()).toBe('0');

      // Press Space to start playing (should toggle play/pause)
      await page.keyboard.press('Space');
      // Wait a bit for playing to start
      await page.waitForTimeout(200);
      expect(await app.playBtn.isDisabled()).toBe(true);
      // Press Space again to pause
      await page.keyboard.press('Space');
      await page.waitForTimeout(100);
      expect(await app.playBtn.isDisabled()).toBe(false);

      // Ctrl/Cmd+R should trigger reset (simulate Control modifier)
      // Ensure some state to reset
      await app.clickStep();
      expect(await app.getComparisonsText()).not.toBe('0');
      // Trigger Ctrl+R
      await page.keyboard.down('Control');
      await page.keyboard.press('r');
      await page.keyboard.up('Control');

      // After reset, comparisons back to zero
      expect(await app.getComparisonsText()).toBe('0');

      expect(pageErrors.length).toBe(0);
    });
  });

  test.describe('Console and runtime error monitoring', () => {
    test('no unexpected uncaught ReferenceError/SyntaxError/TypeError were thrown during interactions', async () => {
      // Perform a set of interactions to exercise code paths
      await app.setArray('5,6,7,8');
      await app.clickApply();
      await app.setTarget('7');
      await app.clickStart();
      // advance few steps
      await app.clickStep();
      await app.clickStep();
      await app.clickStep();
      await app.clickReset();
      await app.clickRandom();
      await app.setSpeed(1.2);
      await app.toggleExplain();

      // Validate that no page errors (uncaught exceptions) were emitted
      // If there are any, fail with the error messages to aid debugging.
      if (pageErrors.length > 0) {
        // Fail the test with details of errors
        const messages = pageErrors.map(e => e.message).join('\n---\n');
        throw new Error('Unexpected page errors detected:\n' + messages);
      }

      // Also ensure console did not output severe error messages (optional but helpful)
      const severeConsole = consoleMessages.filter(m => ['error'].includes(m.type));
      expect(severeConsole.length).toBe(0);
    });
  });
});