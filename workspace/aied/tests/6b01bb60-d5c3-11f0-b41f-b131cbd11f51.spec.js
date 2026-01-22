import { test, expect } from '@playwright/test';

const APP_URL = 'http://127.0.0.1:5500/workspace/batch-1207/html/6b01bb60-d5c3-11f0-b41f-b131cbd11f51.html';

// Page Object for the visualization page
class VisualizerPage {
  /**
   * @param {import('@playwright/test').Page} page
   */
  constructor(page) {
    this.page = page;
    this.nextBtn = page.locator('#next-btn');
    this.prevBtn = page.locator('#prev-btn');
    this.resetBtn = page.locator('#reset-btn');
    this.autoBtn = page.locator('#auto-btn');
    this.problemSelect = page.locator('#problem-type');
    this.explanation = page.locator('#explanation');
    this.currentMax = page.locator('#current-max');
    this.windowPosition = page.locator('#window-position');
    this.windowSize = page.locator('#window-size');
    this.algorithmCode = page.locator('#algorithm-code');
    this.arrayContainer = page.locator('#array-container');
  }

  async goto() {
    await this.page.goto(APP_URL);
    // Wait for initialization to complete (array elements created)
    await expect(this.arrayContainer).toBeVisible();
    // ensure at least element-0 exists
    await this.page.waitForSelector('#element-0');
  }

  async clickNext() {
    await this.nextBtn.click();
  }

  async clickPrev() {
    await this.prevBtn.click();
  }

  async clickReset() {
    await this.resetBtn.click();
  }

  async clickAuto() {
    await this.autoBtn.click();
  }

  async selectProblem(value) {
    await this.problemSelect.selectOption(value);
  }

  async getExplanationText() {
    return (await this.explanation.textContent()) || '';
  }

  async getCurrentMaxText() {
    return (await this.currentMax.textContent()) || '';
  }

  async getWindowPositionText() {
    return (await this.windowPosition.textContent()) || '';
  }

  async getWindowSizeText() {
    return (await this.windowSize.textContent()) || '';
  }

  async getAlgorithmCodeText() {
    return (await this.algorithmCode.textContent()) || '';
  }

  async getElementClass(index) {
    const el = this.page.locator(`#element-${index}`);
    return (await el.getAttribute('class')) || '';
  }

  async isNextDisabled() {
    return await this.nextBtn.isDisabled();
  }

  async isPrevDisabled() {
    return await this.prevBtn.isDisabled();
  }

  async autoBtnText() {
    return (await this.autoBtn.textContent())?.trim() || '';
  }

  async elementCount() {
    return await this.arrayContainer.locator('.array-element').count();
  }
}

// Collect console errors/page errors helper
function attachErrorCollectors(page) {
  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push({ text: msg.text(), location: msg.location() });
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err);
  });

  return { consoleErrors, pageErrors };
}

test.describe('Sliding Window Algorithm Visualization - Full FSM tests', () => {
  test.beforeEach(async ({ page }) => {
    // no-op here; each test will navigate using the page object
  });

  test.describe('Initial load and init() entry action', () => {
    test('should load the page and run init() creating array elements and initial UI', async ({ page }) => {
      // Attach error collectors and navigate
      const { consoleErrors, pageErrors } = attachErrorCollectors(page);
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Verify init created array elements
      const count = await vp.elementCount();
      expect(count).toBeGreaterThanOrEqual(1);

      // Verify initial explanation is the expected initial text for maxSum (default)
      const explanation = await vp.getExplanationText();
      expect(explanation).toContain("Initial state. We'll calculate the sum of the first window");

      // Verify buttons initial states: prev disabled at initial step
      expect(await vp.isPrevDisabled()).toBe(true);

      // Verify algorithm code includes maxSum function snippet by default
      const code = await vp.getAlgorithmCodeText();
      expect(code).toContain('function maxSumSubarray');

      // Ensure no runtime page errors or console errors were emitted during load
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Max Sum problem flow (S0 -> S1 -> S2 -> S3 -> S4)', () => {
    test('advances through steps with Next and updates DOM accordingly', async ({ page }) => {
      const { consoleErrors, pageErrors } = attachErrorCollectors(page);
      const vp = new VisualizerPage(page);
      await vp.goto();

      // S0 -> click Next -> S1 (first highlighting / initial window sum)
      await vp.clickNext();
      await expect(vp.explanation).toContainText('Calculated sum of first window');
      expect(await vp.getCurrentMaxText()).not.toBe('0');
      expect(await vp.getWindowPositionText()).toContain('0-2');
      expect(await vp.isPrevDisabled()).toBe(false);

      // S1 -> click Next -> S2 (sliding)
      await vp.clickNext();
      const explanation2 = await vp.getExplanationText();
      // Should mention "Window slides to position" or similar
      expect(explanation2).toMatch(/Window slides to position|Window slides/);

      // Ensure some window-elements have the window-element class
      const elementClass1 = await vp.getElementClass(0);
      const elementClass2 = await vp.getElementClass(1);
      // At least one of the first window positions should have class
      expect(elementClass1.includes('window-element') || elementClass2.includes('window-element')).toBeTruthy();

      // Step forward until complete
      // Click Next repeatedly until explanation shows 'Algorithm complete!'
      let attempts = 0;
      let explanationText = await vp.getExplanationText();
      while (!explanationText.includes('Algorithm complete') && attempts < 20) {
        await vp.clickNext();
        explanationText = await vp.getExplanationText();
        attempts++;
      }
      expect(explanationText).toContain('Algorithm complete! The maximum sum of any subarray of size');

      // After completion Next should be disabled (per updateButtons logic when surpassing bounds)
      const nextDisabled = await vp.isNextDisabled();
      expect(nextDisabled).toBe(true);

      // No unexpected runtime errors during interactions
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Previous button moves back steps and does not go below zero', async ({ page }) => {
      const { consoleErrors, pageErrors } = attachErrorCollectors(page);
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Prev should be disabled at initial state
      expect(await vp.isPrevDisabled()).toBe(true);
      const initialExplanation = await vp.getExplanationText();

      // Click Prev at initial should do nothing (edge case)
      await vp.clickPrev();
      expect(await vp.getExplanationText()).toBe(initialExplanation);

      // Advance one, then go back
      await vp.clickNext();
      expect(await vp.isPrevDisabled()).toBe(false);

      await vp.clickPrev();
      // Should return to initial explanation text
      expect(await vp.getExplanationText()).toBe(initialExplanation);

      // No runtime errors
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Problem type change and Longest Substring flow', () => {
    test('changing problem type updates algorithm code and resets visualization (S0 -> S5)', async ({ page }) => {
      const { consoleErrors, pageErrors } = attachErrorCollectors(page);
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Select longestSubstring
      await vp.selectProblem('longestSubstring');

      // After change, algorithm code should reflect longest substring implementation
      const code = await vp.getAlgorithmCodeText();
      expect(code).toContain('function longestSubstringWithoutRepeating');

      // Explanation should be initial for longest substring
      const explanation = await vp.getExplanationText();
      expect(explanation).toContain("Initial state. We'll find the longest substring without repeating characters.");

      // Window size label should show "Variable"
      expect(await vp.getWindowSizeText()).toContain('Variable');

      // Prev should be disabled after reset-to-initial
      expect(await vp.isPrevDisabled()).toBe(true);

      // No runtime errors while switching problem
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Longest substring Next steps highlight windows and complete', async ({ page }) => {
      const { consoleErrors, pageErrors } = attachErrorCollectors(page);
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Switch problem type
      await vp.selectProblem('longestSubstring');

      // Advance a couple of steps and inspect explanation and highlighted elements
      await vp.clickNext(); // step 1
      let explanation = await vp.getExplanationText();
      expect(explanation).toMatch(/Checking substring up to position \d+/);

      // Some elements in the sliding window should have the class
      const class0 = await vp.getElementClass(0);
      const class1 = await vp.getElementClass(1);
      expect(class0.includes('window-element') || class1.includes('window-element')).toBeTruthy();

      // Fast-forward to completion: click next many times until 'Algorithm complete'
      for (let i = 0; i < 20; i++) {
        if ((await vp.getExplanationText()).includes('Algorithm complete')) break;
        await vp.clickNext();
      }
      expect((await vp.getExplanationText()).includes('Algorithm complete')).toBeTruthy();

      // No runtime errors emitted
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Auto Play and Reset behavior', () => {
    test('auto play toggles start/stop and can be stopped by clicking again', async ({ page }) => {
      const { consoleErrors, pageErrors } = attachErrorCollectors(page);
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Click auto to start autoplay
      await vp.clickAuto();
      // The button text should change immediately to "Stop Auto Play"
      await expect(vp.autoBtn).toHaveText(/Stop Auto Play/);

      // Clicking again should stop autoplay and revert text
      await vp.clickAuto();
      await expect(vp.autoBtn).toHaveText(/Auto Play/);

      // Also verify that reset stops autoplay if it were running:
      // Start autoplay, then reset; the reset should stop autoplay and set explanation to initial
      await vp.clickAuto();
      await expect(vp.autoBtn).toHaveText(/Stop Auto Play/);
      await vp.clickReset();
      await expect(vp.autoBtn).toHaveText(/Auto Play/);
      // Explanation should be initial maxSum initial state
      expect(await vp.getExplanationText()).toContain("Initial state. We'll calculate the sum of the first window");

      // No runtime errors emitted
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('Reset returns UI to initial state and clears computed values', async ({ page }) => {
      const { consoleErrors, pageErrors } = attachErrorCollectors(page);
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Advance some steps
      await vp.clickNext();
      await vp.clickNext();

      // Current max should not be '0' after progress
      const beforeResetMax = await vp.getCurrentMaxText();
      expect(beforeResetMax).not.toBe('0');

      // Reset
      await vp.clickReset();

      // After reset, current max returns to 0
      expect(await vp.getCurrentMaxText()).toBe('0');

      // Window position should show Not set
      expect((await vp.getWindowPositionText())).toContain('Not set');

      // Prev disabled at initial
      expect(await vp.isPrevDisabled()).toBe(true);

      // No runtime errors emitted
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });
  });

  test.describe('Edge cases and error observation', () => {
    test('clicking Next beyond completion disables Next and shows completion text (edge case)', async ({ page }) => {
      const { consoleErrors, pageErrors } = attachErrorCollectors(page);
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Click Next many times to ensure we go beyond sliding iterations
      for (let i = 0; i < 50; i++) {
        if (await vp.isNextDisabled()) break;
        await vp.clickNext();
      }

      // Should display completion message
      const expl = await vp.getExplanationText();
      expect(expl.includes('Algorithm complete') || expl.includes('complete')).toBeTruthy();

      // Next should be disabled when beyond bounds (updateButtons uses > array.length - windowSize + 2)
      expect(await vp.isNextDisabled()).toBe(true);

      // Ensure clicking Next when disabled has no effect and does not throw errors
      if (await vp.isNextDisabled()) {
        await vp.nextBtn.click({ force: true }).catch(() => {
          // if it throws because disabled, swallow - but ensure no page errors recorded
        });
      }

      // Confirm no page-level errors were emitted during this stress
      expect(pageErrors).toEqual([]);
      expect(consoleErrors).toEqual([]);
    });

    test('observes console and page errors and asserts none occurred during normal operation', async ({ page }) => {
      // This test explicitly observes console and page errors and asserts there are none.
      const { consoleErrors, pageErrors } = attachErrorCollectors(page);
      const vp = new VisualizerPage(page);
      await vp.goto();

      // Perform a variety of interactions rapidly to see if any runtime exceptions surface
      await vp.clickNext();
      await vp.clickNext();
      await vp.clickPrev();
      await vp.selectProblem('longestSubstring');
      await vp.clickNext();
      await vp.clickAuto();
      // Stop auto quickly
      await vp.clickAuto();
      await vp.clickReset();

      // Wait briefly to ensure any asynchronous page errors propagate
      await page.waitForTimeout(300);

      // Assert that no unhandled exceptions (pageerror) were thrown
      expect(pageErrors).toEqual([]);
      // Assert that no console.error messages were logged
      expect(consoleErrors).toEqual([]);
    });
  });
});