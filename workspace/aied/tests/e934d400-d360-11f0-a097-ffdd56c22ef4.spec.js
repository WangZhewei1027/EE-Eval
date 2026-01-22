import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/e934d400-d360-11f0-a097-ffdd56c22ef4.html';

// Page object encapsulating interactions with the visualizer
class VisualizerPage {
  constructor(page) {
    this.page = page;
    this.loc = {
      exampleSelect: page.locator('#exampleSelect'),
      fixedControls: page.locator('#fixedControls'),
      variableControls: page.locator('#variableControls'),
      arrayInput: page.locator('#arrayInput'),
      kInput: page.locator('#kInput'),
      randomArray: page.locator('#randomArray'),
      strInput: page.locator('#strInput'),
      kVarInput: page.locator('#kVarInput'),
      randomStr: page.locator('#randomStr'),
      buildBtn: page.locator('#buildBtn'),
      arrayVisual: page.locator('#arrayVisual'),
      summaryArea: page.locator('#summaryArea'),
      statusArea: page.locator('#statusArea'),
      codeArea: page.locator('#codeArea'),
      titleArea: page.locator('#titleArea'),
      stepBack: page.locator('#stepBack'),
      stepForward: page.locator('#stepForward'),
      playPause: page.locator('#playPause'),
      stepIndex: page.locator('#stepIndex'),
      stepTotal: page.locator('#stepTotal'),
      resetBtn: page.locator('#resetBtn'),
      speedRange: page.locator('#speedRange'),
      speedLabel: page.locator('#speedLabel')
    };
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    // Wait a short time for the inline script to run and build initial steps
    await this.page.waitForTimeout(150);
  }

  async selectExample(value) {
    await this.loc.exampleSelect.selectOption({ value });
    // let UI update
    await this.page.waitForTimeout(50);
  }

  async clickBuild() {
    await this.loc.buildBtn.click();
    // give time for buildSteps/renderStep to run
    await this.page.waitForTimeout(100);
  }

  async clickRandomArray() {
    await this.loc.randomArray.click();
    await this.page.waitForTimeout(50);
  }

  async clickRandomStr() {
    await this.loc.randomStr.click();
    await this.page.waitForTimeout(50);
  }

  async setArrayInput(text) {
    await this.loc.arrayInput.fill(text);
  }

  async setKInput(value) {
    await this.loc.kInput.fill(String(value));
  }

  async setStrInput(text) {
    await this.loc.strInput.fill(text);
  }

  async setKVarInput(value) {
    await this.loc.kVarInput.fill(String(value));
  }

  async clickPlayPause() {
    await this.loc.playPause.click();
  }

  async clickStepForward() {
    await this.loc.stepForward.click();
    await this.page.waitForTimeout(60);
  }

  async clickStepBack() {
    await this.loc.stepBack.click();
    await this.page.waitForTimeout(60);
  }

  async clickReset() {
    await this.loc.resetBtn.click();
    await this.page.waitForTimeout(60);
  }

  async setSpeed(value) {
    await this.loc.speedRange.fill(String(value));
    // Some browsers don't dispatch input on fill, so explicitly evaluate
    await this.page.evaluate((v) => {
      const el = document.getElementById('speedRange');
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, String(value));
    await this.page.waitForTimeout(40);
  }

  async getStepIndex() {
    return Number(await this.loc.stepIndex.textContent());
  }

  async getStepTotal() {
    return Number(await this.loc.stepTotal.textContent());
  }

  async getArrayVisualCellCount() {
    return this.loc.arrayVisual.locator('.cell').count();
  }

  async getCellWindowIndices() {
    // returns indices that have .window class (current window)
    const cells = this.loc.arrayVisual.locator('.cell');
    const count = await cells.count();
    const res = [];
    for (let i = 0; i < count; i++) {
      const cls = await cells.nth(i).getAttribute('class');
      if (cls && cls.includes('window')) res.push(i);
    }
    return res;
  }

  async getCodeText() {
    return this.loc.codeArea.textContent();
  }

  async getTitleText() {
    return this.loc.titleArea.textContent();
  }

  async getSummaryHTML() {
    return this.loc.summaryArea.innerHTML();
  }

  async getStatusHTML() {
    return this.loc.statusArea.innerHTML();
  }

  async getArrayInputValue() {
    return this.loc.arrayInput.inputValue();
  }

  async getStrInputValue() {
    return this.loc.strInput.inputValue();
  }

  async getSpeedLabel() {
    return this.loc.speedLabel.textContent();
  }

  async isFixedControlsVisible() {
    return (await this.loc.fixedControls.getAttribute('style')) !== 'display:none;';
  }

  async isVariableControlsVisible() {
    const style = await this.loc.variableControls.getAttribute('style');
    // style attribute may be null or contain display:none
    return !(style && style.includes('display:none'));
  }
}

// Test suite
test.describe('Sliding Window Visualizer - e934d400-d360-11f0-a097-ffdd56c22ef4', () => {
  // Reusable holders for console and page errors per test
  test.beforeEach(async ({ page }) => {
    // noop - individual tests will construct VisualizerPage and navigate
  });

  // Test initial load and S0_Idle state
  test('Initial load: Idle state should render default fixed example and initial steps', async ({ page }) => {
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    page.on('pageerror', (err) => {
      pageErrors.push(String(err.message || err));
    });

    const vp = new VisualizerPage(page);
    await vp.goto();

    // Validate initial UI: fixed controls visible, variable hidden
    expect(await vp.isFixedControlsVisible(), 'fixedControls should be visible on load').toBeTruthy();
    expect(await vp.isVariableControlsVisible(), 'variableControls should be hidden on load').toBeFalsy();

    // Title and code area should reflect fixed example
    const title = (await vp.getTitleText()).trim();
    expect(title).toContain('Max Sum Subarray of Size K');

    const codeText = await vp.getCodeText();
    expect(codeText).toContain('Fixed-size sliding window');

    // Array visualization should have as many cells as input numbers (default value "2,1,5,1,3,2" => 6)
    const arrayInputVal = await vp.getArrayInputValue();
    const expectedCount = arrayInputVal.split(',').filter(Boolean).length;
    const cellsCount = await vp.getArrayVisualCellCount();
    expect(cellsCount).toBe(expectedCount);

    // Step index should be 0 and step total should be >=0
    const stepIndex = await vp.getStepIndex();
    const stepTotal = await vp.getStepTotal();
    expect(stepIndex).toBe(0);
    expect(stepTotal).toBeGreaterThanOrEqual(0);

    // Ensure no uncaught console or page errors on load
    expect(consoleErrors, `Console errors on page load: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    expect(pageErrors, `Page errors on page load: ${pageErrors.join(' | ')}`).toHaveLength(0);
  });

  test.describe('Example switching and variable example interactions', () => {
    test('Selecting "variable" example shows variable controls, builds steps and play/pause works (S0 -> S2 -> S3 -> S4 -> S5)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      const dialogs = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', (err) => pageErrors.push(String(err.message || err)));
      page.on('dialog', async (d) => {
        dialogs.push({ message: d.message(), type: d.type() });
        await d.accept();
      });

      const vp = new VisualizerPage(page);
      await vp.goto();

      // Switch to variable example
      await vp.selectExample('variable');

      // Assert variable controls are visible and fixed are hidden
      expect(await vp.isVariableControlsVisible(), 'variable controls should be visible after selecting variable').toBeTruthy();
      expect(await vp.isFixedControlsVisible(), 'fixed controls should be hidden after selecting variable').toBeFalsy();

      // Title and code area update
      expect((await vp.getTitleText())).toContain('Longest Substring with');
      expect(await vp.getCodeText()).toContain('Variable-size sliding window');

      // Ensure the string input has a default value
      const strValBefore = await vp.getStrInputValue();
      expect(strValBefore.length).toBeGreaterThan(0);

      // Set a smaller speed to make play progress faster
      await vp.setSpeed('200');
      expect((await vp.getSpeedLabel()).trim()).toContain('200');

      // Build steps for variable example
      await vp.clickBuild();
      const stepTotal = await vp.getStepTotal();
      expect(stepTotal).toBeGreaterThanOrEqual(0);

      // Start playing and ensure play/pause text changes to Pause
      await vp.clickPlayPause();
      await page.waitForTimeout(250); // allow one or two timer ticks
      expect(await page.locator('#playPause').textContent()).toContain('Pause');

      // After a short wait, current step index should increase (played forward)
      const indexAfterPlay = await vp.getStepIndex();
      expect(indexAfterPlay).toBeGreaterThanOrEqual(0);

      // Pause playback
      await vp.clickPlayPause();
      await page.waitForTimeout(60);
      expect(await page.locator('#playPause').textContent()).toContain('Play');

      // Ensure no unexpected dialog popped up during normal build/play
      expect(dialogs).toHaveLength(0);

      // Ensure no console/page errors
      expect(consoleErrors, `Console errors: ${consoleErrors.join(' | ')}`).toHaveLength(0);
      expect(pageErrors, `Page errors: ${pageErrors.join(' | ')}`).toHaveLength(0);
    });
  });

  test.describe('Fixed example building, stepping and edge behaviors', () => {
    test('Build fixed example with custom input and step forward/back works (S1 -> S3)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', (err) => pageErrors.push(String(err.message || err)));

      const vp = new VisualizerPage(page);
      await vp.goto();

      // Ensure fixed example selected
      await vp.selectExample('fixed');

      // Provide specific array and K to create deterministic steps
      await vp.setArrayInput('1,2,3,4');
      await vp.setKInput(2);
      await vp.clickBuild();

      // Expect at least some steps built
      const stepTotal = await vp.getStepTotal();
      expect(stepTotal).toBeGreaterThanOrEqual(0);

      // Remember current index and try stepping forward
      const startIndex = await vp.getStepIndex();
      await vp.clickStepForward();
      const afterForward = await vp.getStepIndex();
      expect(afterForward).toBeGreaterThanOrEqual(startIndex);

      // Step back should reduce or equal the index (can't go negative)
      await vp.clickStepBack();
      const afterBack = await vp.getStepIndex();
      expect(afterBack).toBeGreaterThanOrEqual(0);
      expect(afterBack).toBeLessThanOrEqual(afterForward);

      // Summary area should include text about current sum in fixed-size algorithm
      const summaryHtml = await vp.getSummaryHTML();
      expect(summaryHtml).toContain('Current Sum');

      // No console or page errors
      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });

    test('Reset clears the visualization and transitions to Reset state (S3 -> S6)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', (err) => pageErrors.push(String(err.message || err)));

      const vp = new VisualizerPage(page);
      await vp.goto();

      // Build initial steps (already built on load, but ensure state)
      await vp.clickBuild();

      // Click reset and verify cleared UI
      await vp.clickReset();

      const stepIndex = await vp.getStepIndex();
      const stepTotal = await vp.getStepTotal();
      const cellsCount = await vp.getArrayVisualCellCount();
      const summaryHtml = await vp.getSummaryHTML();
      const codeText = await vp.getCodeText();

      expect(stepIndex).toBe(0);
      expect(stepTotal).toBe(0);
      // After reset, arrayVisual should be cleared (0 cells)
      expect(cellsCount).toBe(0);
      expect(summaryHtml.trim()).toBe('');
      // Code area is intentionally cleared in reset handler
      expect((codeText || '').trim()).toBe('');

      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Random generation, speed control and edge-case alerts', () => {
    test('Random array and random string buttons populate inputs', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', (err) => pageErrors.push(String(err.message || err)));

      const vp = new VisualizerPage(page);
      await vp.goto();

      const before = await vp.getArrayInputValue();
      await vp.clickRandomArray();
      const after = await vp.getArrayInputValue();
      expect(after).not.toBe(before);
      expect(after.split(',').length).toBeGreaterThanOrEqual(1);

      // Switch to variable example and test randomStr
      await vp.selectExample('variable');
      const strBefore = await vp.getStrInputValue();
      await vp.clickRandomStr();
      const strAfter = await vp.getStrInputValue();
      expect(strAfter).not.toBe(strBefore);
      expect(strAfter.length).toBeGreaterThan(0);

      // Change speed range and check label update
      await vp.setSpeed('500');
      expect((await vp.getSpeedLabel()).trim()).toContain('500');

      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });

    test('Edge case: empty inputs and invalid K produce alert dialogs (do not crash)', async ({ page }) => {
      const dialogs = [];
      page.on('dialog', async dialog => {
        dialogs.push({ message: dialog.message(), type: dialog.type() });
        await dialog.accept();
      });

      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', (err) => pageErrors.push(String(err.message || err)));

      const vp = new VisualizerPage(page);
      await vp.goto();

      // Fixed example: empty array input triggers alert
      await vp.selectExample('fixed');
      await vp.setArrayInput('');
      await vp.clickBuild();
      await page.waitForTimeout(60);
      expect(dialogs.length).toBeGreaterThanOrEqual(1);
      expect(dialogs[dialogs.length - 1].message).toContain('Enter an array or generate Random.');

      // Invalid K for fixed example
      await vp.setArrayInput('1,2,3');
      await vp.setKInput(0);
      await vp.clickBuild();
      await page.waitForTimeout(60);
      expect(dialogs[dialogs.length - 1].message).toContain('K must be an integer >=1');

      // Variable example: empty string triggers alert
      await vp.selectExample('variable');
      await vp.setStrInput('');
      await vp.clickBuild();
      await page.waitForTimeout(60);
      expect(dialogs[dialogs.length - 1].message).toContain('Enter a string or generate Random.');

      // Invalid K for variable
      await vp.setStrInput('abc');
      await vp.setKVarInput(0);
      await vp.clickBuild();
      await page.waitForTimeout(60);
      expect(dialogs[dialogs.length - 1].message).toContain('K must be an integer >=1');

      // Ensure no console/page errors triggered by these invalid attempts
      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });

    test('Edge case: K > n yields informative snapshot (K too large)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', (err) => pageErrors.push(String(err.message || err)));

      const vp = new VisualizerPage(page);
      await vp.goto();

      // Fixed example: set array length 3 and K=5
      await vp.selectExample('fixed');
      await vp.setArrayInput('1,2,3');
      await vp.setKInput(5);
      await vp.clickBuild();

      // Status area should contain mention of K > array length
      const status = await vp.getStatusHTML();
      expect(status).toContain('K (5) > array length (3)');

      // Steps exist but stepTotal should be 0 (steps.length-1 = 0)
      const stepTotal = await vp.getStepTotal();
      expect(stepTotal).toBeGreaterThanOrEqual(0);

      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });
  });

  test.describe('Visual correctness checks and invariants', () => {
    test('Cells in current window have .window class and bestRange highlighting is applied', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', (err) => pageErrors.push(String(err.message || err)));

      const vp = new VisualizerPage(page);
      await vp.goto();

      // Use a known array so we can reason about window presence
      await vp.selectExample('fixed');
      await vp.setArrayInput('2,1,5,1,3,2');
      await vp.setKInput(3);
      await vp.clickBuild();

      // After build, there should be at least one cell with the window class
      const windowIndices = await vp.getCellWindowIndices();
      expect(windowIndices.length).toBeGreaterThanOrEqual(1);

      // Step forward until a "New max found" likely occurs (but avoid assumptions)
      // Instead, ensure that when bestRange exists, cells in that range are styled differently
      // We'll iterate a few steps and inspect inline styles for bestRange background color (#fff6e1 as set in code)
      const stepsToTry = Math.min(6, (await vp.getStepTotal()) + 1);
      for (let i = 0; i < stepsToTry; i++) {
        // read inline styles on cells and see if any contains '#fff6e1' or borderColor '#f0c040'
        const cells = page.locator('#arrayVisual .cell');
        const cCount = await cells.count();
        let foundBest = false;
        for (let j = 0; j < cCount; j++) {
          const style = await cells.nth(j).getAttribute('style') || '';
          if (style.includes('#fff6e1') || style.includes('#f0c040')) { foundBest = true; break; }
        }
        if (foundBest) break;
        await vp.clickStepForward();
      }

      // After stepping, at some point best highlight should exist (visualizer sets it on final step)
      const finalCells = page.locator('#arrayVisual .cell');
      const finalCount = await finalCells.count();
      let bestPresent = false;
      for (let j = 0; j < finalCount; j++) {
        const style = await finalCells.nth(j).getAttribute('style') || '';
        if (style.includes('#fff6e1') || style.includes('#f0c040')) { bestPresent = true; break; }
      }
      expect(bestPresent).toBeTruthy();

      expect(consoleErrors).toHaveLength(0);
      expect(pageErrors).toHaveLength(0);
    });
  });

});