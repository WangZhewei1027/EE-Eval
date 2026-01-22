import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/f18251e2-d366-11f0-9b19-a558354ece3e.html';

// Page Object for the visualization page
class VisualizationPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.selectors = {
      arrayContainer: '#arrayContainer',
      stepInfo: '#stepInfo',
      explanation: '#explanation',
      prevBtn: '#prevBtn',
      nextBtn: '#nextBtn',
      resetBtn: '#resetBtn',
      algorithmSelect: '#algorithm',
      targetInput: '#target',
      targetContainer: '#targetContainer',
    };
  }

  async waitForLoad() {
    await this.page.waitForLoadState('load');
    await this.page.waitForSelector(this.selectors.stepInfo);
  }

  async getStepInfoText() {
    return (await this.page.locator(this.selectors.stepInfo).innerText()).trim();
  }

  async getExplanationText() {
    return (await this.page.locator(this.selectors.explanation).innerText()).trim();
  }

  async getArrayElements() {
    return this.page.locator(`${this.selectors.arrayContainer} .array-element`);
  }

  async getArrayCount() {
    return await this.getArrayElements().count();
  }

  async getArrayElementText(index) {
    const el = this.page.locator(`#element-${index}`);
    await el.waitFor({ state: 'attached' });
    return (await el.innerText()).trim();
  }

  async getArrayElementClasses(index) {
    return (await this.page.locator(`#element-${index}`).getAttribute('class')) || '';
  }

  async clickNext() {
    await this.page.click(this.selectors.nextBtn);
  }

  async clickPrev() {
    await this.page.click(this.selectors.prevBtn);
  }

  async clickReset() {
    await this.page.click(this.selectors.resetBtn);
  }

  async selectAlgorithm(value) {
    await this.page.selectOption(this.selectors.algorithmSelect, value);
  }

  async isPrevDisabled() {
    return await this.page.locator(this.selectors.prevBtn).isDisabled();
  }

  async isNextDisabled() {
    return await this.page.locator(this.selectors.nextBtn).isDisabled();
  }

  async isTargetVisible() {
    return await this.page.locator(this.selectors.targetContainer).isVisible();
  }

  async getTargetValue() {
    return await this.page.locator(this.selectors.targetInput).inputValue();
  }

  async setTargetValue(value) {
    // fill and trigger change by blurring
    await this.page.fill(this.selectors.targetInput, String(value));
    await this.page.locator(this.selectors.targetInput).dispatchEvent('change');
  }
}

test.describe('Two Pointers Algorithm Visualization - FSM and UI tests', () => {
  // Collect console and page errors per test
  test.beforeEach(async ({ page }) => {
    // Stabilize locale/timeouts if necessary
    page.setDefaultTimeout(5000);
  });

  test.describe('Initialization and algorithm selection (S0 -> S1)', () => {
    test('Initial load initializes visualization to Two Sum (S1_AlgorithmInitialized)', async ({ page }) => {
      // Collect console and page errors
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => pageErrors.push(err));

      await page.goto(APP_URL);
      const viz = new VisualizationPage(page);
      await viz.waitForLoad();

      // Verify step info shows Two Sum initial message
      const stepText = await viz.getStepInfoText();
      expect(stepText).toContain('Algorithm: Two Sum');
      expect(stepText).toContain('Click "Next Step" to start.');

      // Prev should be disabled at initialization
      expect(await viz.isPrevDisabled()).toBe(true);

      // Target input should be visible for twoSum by default
      expect(await viz.isTargetVisible()).toBe(true);
      expect(await viz.getTargetValue()).toBe('9');

      // Array elements generated and match expected array from code
      const count = await viz.getArrayCount();
      expect(count).toBe(7);
      expect(await viz.getArrayElementText(0)).toBe('1');
      expect(await viz.getArrayElementText(6)).toBe('11');

      // Ensure no runtime page errors or console error messages occurred during load
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Selecting a different algorithm re-initializes visualization (SelectAlgorithm event)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => pageErrors.push(err));

      await page.goto(APP_URL);
      const viz = new VisualizationPage(page);
      await viz.waitForLoad();

      // Select palindrome algorithm
      await viz.selectAlgorithm('palindrome');

      // Step info should update to Palindrome algorithm name
      await page.waitForFunction(() => document.getElementById('stepInfo').innerText.includes('Check Palindrome'));
      const stepText = await viz.getStepInfoText();
      expect(stepText).toContain('Check Palindrome');

      // Target container should be hidden for palindrome
      expect(await viz.isTargetVisible()).toBe(false);

      // Array content should reflect palindrome characters (r a c e c a r)
      const count = await viz.getArrayCount();
      expect(count).toBe(7);
      // Check first and last characters
      expect(await viz.getArrayElementText(0)).toBe('r');
      expect(await viz.getArrayElementText(6)).toBe('r');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Two Sum stepping and navigation (S1 <-> S2)', () => {
    test('NextStep advances through steps and finds a pair (S1 -> S2) and disables Next when done', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      const consoleMessages = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
        consoleMessages.push({ type: msg.type(), text: msg.text() });
      });
      page.on('pageerror', err => pageErrors.push(err));

      await page.goto(APP_URL);
      const viz = new VisualizationPage(page);
      await viz.waitForLoad();

      // Ensure default algorithm is twoSum
      const initialStep = await viz.getStepInfoText();
      expect(initialStep).toContain('Two Sum');

      // Click Next repeatedly until algorithm reports found pair or finished
      // We know the algorithm will eventually find the pair 4 + 5 = 9 for the default array.
      // Click Next until Next button becomes disabled (done)
      for (let i = 0; i < 10; i++) {
        // Stop early if next is disabled (done)
        if (await viz.isNextDisabled()) break;
        await viz.clickNext();
        // small wait to allow DOM updates
        await page.waitForTimeout(100);
      }

      // Now stepInfo should contain 'Found:' indicating successful find
      const finalText = await viz.getStepInfoText();
      expect(finalText).toMatch(/Found:\s*\d+\s*\+\s*\d+\s*=\s*9/);

      // Next should be disabled when done
      expect(await viz.isNextDisabled()).toBe(true);

      // The last highlighted elements should correspond to the found pair indices.
      // For the provided array the found pair is 4 + 5 = 9 -> indices 2 and 3.
      const classLeft = await viz.getArrayElementClasses(2);
      const classRight = await viz.getArrayElementClasses(3);
      expect(classLeft).toContain('current');
      expect(classRight).toContain('current');

      // Previous should be enabled after steps
      expect(await viz.isPrevDisabled()).toBe(false);

      // Ensure no runtime page errors occurred
      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('PreviousStep navigates back to initial state message when stepping back to 0 (S2 -> S1)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err));

      await page.goto(APP_URL);
      const viz = new VisualizationPage(page);
      await viz.waitForLoad();

      // Advance to done state
      for (let i = 0; i < 10; i++) {
        if (await viz.isNextDisabled()) break;
        await viz.clickNext();
        await page.waitForTimeout(50);
      }

      // Ensure we are in done state
      expect(await viz.isNextDisabled()).toBe(true);
      expect(await viz.isPrevDisabled()).toBe(false);

      // Click Prev until we reach initial (prev disabled)
      let safety = 0;
      while (!(await viz.isPrevDisabled()) && safety < 10) {
        await viz.clickPrev();
        await page.waitForTimeout(50);
        safety++;
      }

      // After navigating back fully, prev should be disabled and stepInfo should show Algorithm initial text
      expect(await viz.isPrevDisabled()).toBe(true);
      const stepText = await viz.getStepInfoText();
      expect(stepText).toContain('Algorithm: Two Sum');
      expect(stepText).toContain('Click "Next Step" to start.');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Reset re-initializes visualization and clears steps (S1 -> S1 via Reset)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err));

      await page.goto(APP_URL);
      const viz = new VisualizationPage(page);
      await viz.waitForLoad();

      // Take a couple of steps
      await viz.clickNext();
      await page.waitForTimeout(50);
      await viz.clickNext();
      await page.waitForTimeout(50);

      // Reset
      await viz.clickReset();
      await page.waitForTimeout(100);

      // After reset, stepInfo should be the initial algorithm message
      const stepText = await viz.getStepInfoText();
      expect(stepText).toContain('Algorithm: Two Sum');
      expect(stepText).toContain('Click "Next Step" to start.');

      // Prev should be disabled and Next enabled (ready to start)
      expect(await viz.isPrevDisabled()).toBe(true);
      expect(await viz.isNextDisabled()).toBe(false);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Edge case: extremely large target results in "No two numbers found" after steps', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err));

      await page.goto(APP_URL);
      const viz = new VisualizationPage(page);
      await viz.waitForLoad();

      // Set a large target that cannot be achieved
      await viz.setTargetValue(1000);

      // Because changing target triggers initialize, wait a bit
      await page.waitForTimeout(100);

      // Step through until Next becomes disabled (algorithm finished without finding)
      for (let i = 0; i < 20; i++) {
        if (await viz.isNextDisabled()) break;
        await viz.clickNext();
        await page.waitForTimeout(50);
      }

      const finalText = await viz.getStepInfoText();
      expect(finalText).toMatch(/No two numbers found that sum to 1000/);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Other algorithms (palindrome, container) and target visibility', () => {
    test('Container algorithm steps produce area messages and maintain pointer highlights', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err));

      await page.goto(APP_URL);
      const viz = new VisualizationPage(page);
      await viz.waitForLoad();

      // Select container algorithm
      await viz.selectAlgorithm('container');

      // Target input should be hidden for container
      expect(await viz.isTargetVisible()).toBe(false);

      // Take a few steps and assert messages contain 'Area with heights' and 'Max so far'
      let seenAreaMessage = false;
      for (let i = 0; i < 5; i++) {
        await viz.clickNext();
        await page.waitForTimeout(80);
        const text = await viz.getStepInfoText();
        if (text.includes('Area with heights')) {
          seenAreaMessage = true;
          // ensure we see 'Max so far'
          expect(text).toContain('Max so far');
        }
      }
      expect(seenAreaMessage).toBe(true);

      // Ensure some elements are marked as current (pointers)
      const count = await viz.getArrayCount();
      let anyCurrent = false;
      for (let i = 0; i < count; i++) {
        const classes = await viz.getArrayElementClasses(i);
        if (classes.includes('current')) { anyCurrent = true; break; }
      }
      expect(anyCurrent).toBe(true);

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });

    test('Changing target only reinitializes when algorithm is Two Sum (InputTargetChange event)', async ({ page }) => {
      const consoleErrors = [];
      const pageErrors = [];
      page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
      page.on('pageerror', err => pageErrors.push(err));

      await page.goto(APP_URL);
      const viz = new VisualizationPage(page);
      await viz.waitForLoad();

      // Select palindrome algorithm (target hidden) and attempt to change target (should have no effect)
      await viz.selectAlgorithm('palindrome');
      expect(await viz.isTargetVisible()).toBe(false);

      // Now select twoSum and change target - it should reinitialize
      await viz.selectAlgorithm('twoSum');
      const before = await viz.getStepInfoText();
      await viz.setTargetValue(11);
      await page.waitForTimeout(100);
      const after = await viz.getStepInfoText();

      // Since initializeVisualization is called on target change for twoSum, stepInfo should still show Two Sum initial message
      expect(before).toContain('Two Sum');
      expect(after).toContain('Two Sum');

      expect(await viz.getTargetValue()).toBe('11');

      expect(pageErrors.length).toBe(0);
      expect(consoleErrors.length).toBe(0);
    });
  });

  test.describe('Console and runtime error observation', () => {
    test('Page should not emit console errors or page errors during typical flows', async ({ page }) => {
      const consoleErrors = [];
      const consoleAll = [];
      const pageErrors = [];
      page.on('console', msg => {
        consoleAll.push({ type: msg.type(), text: msg.text() });
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });
      page.on('pageerror', err => pageErrors.push(err));

      await page.goto(APP_URL);
      const viz = new VisualizationPage(page);
      await viz.waitForLoad();

      // Interact with the app: select algorithms, step, reset
      await viz.selectAlgorithm('container');
      await page.waitForTimeout(50);
      await viz.clickNext();
      await page.waitForTimeout(50);
      await viz.selectAlgorithm('palindrome');
      await page.waitForTimeout(50);
      await viz.selectAlgorithm('twoSum');
      await page.waitForTimeout(50);
      await viz.setTargetValue(15);
      await page.waitForTimeout(50);
      await viz.clickNext();
      await page.waitForTimeout(50);
      await viz.clickPrev();
      await page.waitForTimeout(50);
      await viz.clickReset();
      await page.waitForTimeout(50);

      // We assert there were no page errors and no console errors
      expect(pageErrors.length, `page errors: ${pageErrors.map(e => String(e)).join('; ')}`).toBe(0);
      expect(consoleErrors.length, `console errors: ${consoleAll.filter(m => m.type === 'error').map(m => m.text).join('; ')}`).toBe(0);

      // Also ensure consoleAll captured various messages (not required to have any particular content)
      expect(Array.isArray(consoleAll)).toBe(true);
    });
  });
});