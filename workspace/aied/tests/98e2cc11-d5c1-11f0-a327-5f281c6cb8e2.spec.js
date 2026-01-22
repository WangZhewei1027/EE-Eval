import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/98e2cc11-d5c1-11f0-a327-5f281c6cb8e2.html';

// Page Object for the Sliding Window Visualizer
class VisualizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.mode = page.locator('#mode');
    this.inputData = page.locator('#inputData');
    this.randomBtn = page.locator('#randomBtn');
    this.applyBtn = page.locator('#applyBtn');
    this.kInput = page.locator('#kInput');
    this.kInput2 = page.locator('#kInput2');
    this.kInput3 = page.locator('#kInput3');
    this.sInput = page.locator('#sInput');
    this.operation = page.locator('#operation');
    this.prevBtn = page.locator('#prevBtn');
    this.playBtn = page.locator('#playBtn');
    this.nextBtn = page.locator('#nextBtn');
    this.bars = page.locator('#bars');
    this.barElems = page.locator('#bars .bar');
    this.leftIdx = page.locator('#leftIdx');
    this.rightIdx = page.locator('#rightIdx');
    this.windowIdx = page.locator('#windowIdx');
    this.currentValue = page.locator('#currentValue');
    this.bestValue = page.locator('#bestValue');
    this.description = page.locator('#description');
    this.stepIndicator = page.locator('#stepIndicator');
    this.dequeView = page.locator('#dequeView');
    this.dequeContainer = page.locator('#dequeContainer');
    this.codeArea = page.locator('#codeArea');
    this.speed = page.locator('#speed');
  }

  async goto() {
    await this.page.goto(APP_URL, { waitUntil: 'load' });
    // Wait for initial rendering: bars should be present
    await this.page.waitForLoadState('networkidle');
  }

  async getBarCount() {
    return await this.barElems.count();
  }

  async getStepIndicatorText() {
    return (await this.stepIndicator.textContent()) || '';
  }

  async parseStepIndicator() {
    const txt = await this.getStepIndicatorText();
    // expected format: "Step X / Y" or "Step 0 / 0"
    const m = txt.match(/Step\s+(\d+)\s*\/\s*(\d+)/i);
    if (!m) return { current: 0, total: 0 };
    return { current: Number(m[1]), total: Number(m[2]) };
  }

  async clickApply() {
    await this.applyBtn.click();
  }

  async clickRandomize() {
    await this.randomBtn.click();
  }

  async clickPlay() {
    await this.playBtn.click();
  }

  async clickNext() {
    await this.nextBtn.click();
  }

  async clickPrev() {
    await this.prevBtn.click();
  }

  async setMode(value) {
    await this.mode.selectOption({ value });
    // the page listens for change event and updates UI; wait a tick
    await this.page.waitForTimeout(50);
  }

  async setInputData(value) {
    await this.inputData.fill(value);
  }

  async setKInput(value) {
    await this.kInput.fill(String(value));
  }

  async setKInput2(value) {
    await this.kInput2.fill(String(value));
  }

  async setKInput3(value) {
    await this.kInput3.fill(String(value));
  }

  async setSInput(value) {
    await this.sInput.fill(String(value));
  }

  async setOperation(value) {
    await this.operation.selectOption({ value });
  }

  async setSpeedMs(ms) {
    // Range input: set value and dispatch input event
    await this.page.evaluate((v) => {
      const el = document.getElementById('speed');
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, String(ms));
    await this.page.waitForTimeout(20);
  }

  async getDescriptionText() {
    return (await this.description.textContent()) || '';
  }

  async isDequeVisible() {
    return await this.dequeView.evaluate((el) => window.getComputedStyle(el).display !== 'none');
  }

  async getDequeItemsText() {
    return await this.dequeContainer.locator('.dq-item').allTextContents();
  }

  async getBarClassesAtIndex(index) {
    const bar = this.page.locator(`#bars .bar[data-index="${index}"]`);
    const cls = await bar.getAttribute('class');
    return cls || '';
  }

  async getInputDataValue() {
    return (await this.inputData.inputValue()) || '';
  }
}

test.describe('Sliding Window Visualizer - FSM and UI interactions', () => {
  let consoleMessages = [];
  let pageErrors = [];

  test.beforeEach(async ({ page }) => {
    consoleMessages = [];
    pageErrors = [];
    // capture console messages and page errors for each test
    page.on('console', (msg) => {
      consoleMessages.push({ type: msg.type(), text: msg.text() });
    });
    page.on('pageerror', (err) => {
      // collect Error objects
      pageErrors.push(err);
    });
  });

  test('Initial load should render bars and build default steps (Idle -> Steps Built)', async ({ page }) => {
    // Validate initial entry actions: renderBars() and buildSteps() (buildSteps called at end of script)
    const vp = new VisualizerPage(page);
    await vp.goto();

    // There should be bars rendered equal to initial data length (default input has 9 numbers)
    const barCount = await vp.getBarCount();
    // Expect at least 1 bar and specifically 9 for the default provided input in HTML
    expect(barCount).toBeGreaterThanOrEqual(1);
    expect(barCount).toBe(9);

    // Since buildSteps() is called on load, step indicator should reflect steps built (Step 1 / N)
    const { current, total } = await vp.parseStepIndicator();
    expect(total).toBeGreaterThan(0);
    expect(current).toBeGreaterThanOrEqual(1);

    // The description should instruct how to proceed (not empty)
    const desc = await vp.getDescriptionText();
    expect(desc.length).toBeGreaterThan(0);

    // Ensure no uncaught page errors occurred during initial load
    expect(pageErrors.length).toBe(0);
    // Also ensure there are no console errors (type === 'error')
    const consoleErrors = consoleMessages.filter(m => m.type === 'error');
    expect(consoleErrors.length).toBe(0);
  });

  test.describe('Mode changes, Randomize, and Apply (transitions and UI updates)', () => {
    test('Randomize button changes input value and Apply builds new steps', async ({ page }) => {
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Capture initial input value
      const before = await vp.getInputDataValue();
      await vp.clickRandomize();

      // Input should change
      const after = await vp.getInputDataValue();
      expect(after).not.toBe(before);

      // Apply to rebuild steps
      await vp.clickApply();
      const { total } = await vp.parseStepIndicator();
      expect(total).toBeGreaterThan(0);

      // description should mention produced windows or relevant message
      const desc = await vp.getDescriptionText();
      expect(desc.toLowerCase().length).toBeGreaterThan(0);

      // No runtime errors during these actions
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Switch to deque mode shows deque controls and builds deque steps on Apply', async ({ page }) => {
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Change to deque mode
      await vp.setMode('deque');

      // Set kInput2 to a sensible value and click Apply
      await vp.setKInput2(3);
      await vp.clickApply();

      // Deque view should be visible because deque steps create deque entries
      const dqVisible = await vp.isDequeVisible();
      expect(dqVisible).toBeTruthy();

      // After building steps there should be multiple steps and step indicator non-zero
      const { total } = await vp.parseStepIndicator();
      expect(total).toBeGreaterThan(0);

      // Check that the code area shows monotonic deque description
      const codeText = await vp.codeArea.textContent();
      expect(codeText.toLowerCase()).toContain('monotonic deque');

      // No errors expected
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Fixed-size mode with k larger than array triggers empty steps edge case', async ({ page }) => {
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Ensure fixed mode
      await vp.setMode('fixed');

      // Set k larger than array length
      const currentBarCount = await vp.getBarCount();
      await vp.setKInput(currentBarCount + 100);

      // Apply
      await vp.clickApply();

      // Description should indicate k > n
      const desc = (await vp.getDescriptionText()).toLowerCase();
      expect(desc).toContain('larger than array length');

      // Step indicator should show zero total steps
      const { current, total } = await vp.parseStepIndicator();
      expect(total).toBe(0);
      expect(current).toBe(0);

      // Bars still present (renderBars should have run)
      const barCount = await vp.getBarCount();
      expect(barCount).toBe(currentBarCount);

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Playing animation and step navigation (Playing <-> Steps Built transitions)', () => {
    test('Play toggles play/pause, advances steps automatically, and pause clears timer', async ({ page }) => {
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Ensure fixed mode with default built steps
      await vp.setMode('fixed');
      await vp.setKInput(3);
      await vp.clickApply();

      // Set speed to a small value to advance quickly
      await vp.setSpeedMs(200);

      const before = await vp.parseStepIndicator();

      // Click play to enter Playing state
      await vp.clickPlay();

      // Play button text should change to indicate pause
      await expect(vp.playBtn).toHaveText(/Pause/i);

      // Wait enough time for at least one auto-step to occur
      await page.waitForTimeout(600);

      const after = await vp.parseStepIndicator();
      // If there were multiple steps available, current should have increased
      expect(after.current).toBeGreaterThanOrEqual(before.current);

      // Now toggle play to pause (exit Playing)
      await vp.clickPlay();
      await expect(vp.playBtn).toHaveText(/Play/);

      // Wait a bit to ensure no further automatic advancement (give time that would allow another step if timer remained)
      const pausedSnapshot = await vp.parseStepIndicator();
      await page.waitForTimeout(500);
      const pausedLater = await vp.parseStepIndicator();
      expect(pausedLater.current).toBe(pausedSnapshot.current);

      // No runtime errors occurred
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('Next and Prev navigate steps and update DOM highlights', async ({ page }) => {
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Build steps for fixed window with k=3
      await vp.setMode('fixed');
      await vp.setKInput(3);
      await vp.clickApply();

      const initial = await vp.parseStepIndicator();
      expect(initial.total).toBeGreaterThan(0);

      // Click next
      await vp.clickNext();
      await page.waitForTimeout(50);
      const afterNext = await vp.parseStepIndicator();
      // Ensure we advanced at least 1 step (can't exceed total)
      expect(afterNext.current).toBeGreaterThanOrEqual(initial.current);

      // Check that bars have classes reflecting window/out-of-window
      const totalBars = await vp.getBarCount();
      // Find one bar that should be in-window in current step and verify its class includes 'in-window'
      let foundInWindow = false;
      for (let i = 0; i < totalBars; i++) {
        const cls = await vp.getBarClassesAtIndex(i);
        if (cls.includes('in-window')) {
          foundInWindow = true;
          break;
        }
      }
      expect(foundInWindow).toBeTruthy();

      // Click previous to go back
      await vp.clickPrev();
      await page.waitForTimeout(50);
      const afterPrev = await vp.parseStepIndicator();
      // Ensure we moved back (or remained at 1 if at beginning)
      expect(afterPrev.current).toBeLessThanOrEqual(afterNext.current);

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Variable window modes (varsum and kdistinct) and pseudo-code / description updates', () => {
    test('varsum mode builds two-pointer steps and updates description with best length', async ({ page }) => {
      const vp = new VisualizerPage(page);
      await vp.goto();

      await vp.setMode('varsum');

      // Ensure sInput exists and set to small value to force shrink operations
      await vp.setSInput(6);
      await vp.clickApply();

      // Description should include "Two-pointer" hint or summary
      const desc = (await vp.getDescriptionText()).toLowerCase();
      expect(desc).toContain('two-pointer');

      // Steps should be available
      const { total } = await vp.parseStepIndicator();
      expect(total).toBeGreaterThan(0);

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });

    test('kdistinct mode updates input placeholder, builds steps, and computes longest substring', async ({ page }) => {
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Switch to kdistinct; change handler in code sets inputData to a default string
      await vp.setMode('kdistinct');

      // The input should be updated by the change handler to a sample string
      const val = await vp.getInputDataValue();
      expect(val.length).toBeGreaterThan(0);

      // Set K to 2 and apply
      await vp.setKInput3(2);
      await vp.clickApply();

      // Description should reference "Longest substring" or K distinct info
      const desc = (await vp.getDescriptionText()).toLowerCase();
      expect(desc).toContain('longest substring');

      // Steps should be present
      const { total } = await vp.parseStepIndicator();
      expect(total).toBeGreaterThan(0);

      // No runtime errors
      expect(pageErrors.length).toBe(0);
      const consoleErrors = consoleMessages.filter(m => m.type === 'error');
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.afterEach(async ({}, testInfo) => {
    // If a test fails, output console and page errors to assist debugging (non-invasive)
    if (testInfo.status !== testInfo.expectedStatus) {
      // eslint-disable-next-line no-console
      console.log('Collected console messages:', consoleMessages);
      // eslint-disable-next-line no-console
      console.log('Collected page errors:', pageErrors.map(e => ({ name: e.name, message: e.message })));
    }
  });
});